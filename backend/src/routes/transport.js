const express = require('express');
const { body, validationResult } = require('express-validator');

const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

// ============================================================
// CREATE TRANSPORT JOB
// Buyer or Seller may arrange transport.
// ============================================================

router.post(
  '/',
  authenticate,
  requireRole('SELLER', 'BUYER'),
  [
    body('orderId').notEmpty(),
    body('arrangingParty').isIn(['SELLER', 'BUYER', 'JOINT']),
    body('method').isIn(['OWN_TRUCK', 'HIRE_TRANSPORTER']),
    body('pickupLocation').notEmpty(),
    body('destination').notEmpty(),
    body('load').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array(),
        });
      }

      const {
        orderId,
        arrangingParty,
        method,
        truckOwnerId,
        truckId,
        pickupLocation,
        destination,
        load,
        requiredCapacity,
        specialRequirements,
      } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          transportJob: true,
        },
      });

      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
        });
      }

      if (
        order.buyerId !== req.user.id &&
        order.sellerId !== req.user.id
      ) {
        return res.status(403).json({
          error: 'Only the buyer or seller on this order may arrange transport',
        });
      }

      if (
        order.status !== 'CONFIRMED' &&
        order.status !== 'PENDING_PAYMENT'
      ) {
        return res.status(400).json({
          error: `Order status ${order.status} does not allow transport arrangement`,
        });
      }

      if (order.transportJob) {
        return res.status(409).json({
          error: 'Transport has already been arranged for this order',
          transportJob: order.transportJob,
        });
      }

      // --------------------------------------------------------
      // Validate arranging party
      // --------------------------------------------------------

      if (
        arrangingParty === 'BUYER' &&
        order.buyerId !== req.user.id
      ) {
        return res.status(403).json({
          error: 'Only the buyer can arrange transport as BUYER',
        });
      }

      if (
        arrangingParty === 'SELLER' &&
        order.sellerId !== req.user.id
      ) {
        return res.status(403).json({
          error: 'Only the seller can arrange transport as SELLER',
        });
      }

      if (arrangingParty === 'JOINT') {
        if (
          order.buyerId !== req.user.id &&
          order.sellerId !== req.user.id
        ) {
          return res.status(403).json({
            error: 'Only the buyer or seller may arrange a joint transport job',
          });
        }
      }

      // --------------------------------------------------------
      // OWN TRUCK
      // The selected truck must belong to the person arranging it.
      // --------------------------------------------------------

      if (method === 'OWN_TRUCK') {
        if (!truckId) {
          return res.status(400).json({
            error: 'truckId is required when using OWN_TRUCK',
          });
        }

        const truck = await prisma.truck.findUnique({
          where: { id: truckId },
        });

        if (!truck) {
          return res.status(404).json({
            error: 'Selected truck was not found',
          });
        }

        if (truck.ownerId !== req.user.id) {
          return res.status(403).json({
            error: 'You can only use a truck that belongs to you',
          });
        }

        if (truck.availability !== 'AVAILABLE') {
          return res.status(400).json({
            error: 'Selected truck is not currently available',
          });
        }
      }

      // --------------------------------------------------------
      // HIRE TRANSPORTER
      // Truck owner may be supplied later or selected now.
      // --------------------------------------------------------

      if (method === 'HIRE_TRANSPORTER') {
        if (truckId) {
          const truck = await prisma.truck.findUnique({
            where: { id: truckId },
          });

          if (!truck) {
            return res.status(404).json({
              error: 'Selected truck was not found',
            });
          }

          if (truck.availability !== 'AVAILABLE') {
            return res.status(400).json({
              error: 'Selected truck is not currently available',
            });
          }

          if (
            truckOwnerId &&
            truck.ownerId !== truckOwnerId
          ) {
            return res.status(400).json({
              error: 'Selected truck does not belong to the specified truck owner',
            });
          }
        }

        if (truckOwnerId) {
          const owner = await prisma.user.findUnique({
            where: { id: truckOwnerId },
          });

          if (!owner) {
            return res.status(404).json({
              error: 'Truck owner not found',
            });
          }

          if (!owner.roles.includes('TRUCK_OWNER')) {
            return res.status(400).json({
              error: 'Selected user is not registered as a truck owner',
            });
          }
        }
      }

      const job = await prisma.$transaction(async (tx) => {
        const createdJob = await tx.transportJob.create({
          data: {
            orderId: order.id,
            arrangingParty,
            method,

            truckOwnerId:
              method === 'HIRE_TRANSPORTER'
                ? truckOwnerId || null
                : req.user.id,

            truckId: truckId || null,

            pickupLocation,
            destination,
            load,
            requiredCapacity: requiredCapacity
              ? Number(requiredCapacity)
              : null,
            specialRequirements:
              specialRequirements || null,

            status:
              method === 'OWN_TRUCK'
                ? 'PICKUP'
                : truckOwnerId
                  ? 'REQUESTED'
                  : 'REQUESTED',
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            arrangingParty,
            status: 'TRANSPORT_ARRANGED',
          },
        });

        if (method === 'OWN_TRUCK' && truckId) {
          await tx.truck.update({
            where: { id: truckId },
            data: {
              availability: 'BUSY',
            },
          });
        }

        return createdJob;
      });

      return res.status(201).json({
        message: 'Transport arrangement created successfully',
        transportJob: job,
        commissionGenerated: false,
      });
    } catch (error) {
      console.error('CREATE TRANSPORT JOB ERROR:', error);

      return res.status(500).json({
        error: 'Could not create transport job',
        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);

// ============================================================
// FIND AVAILABLE TRUCKS
// ============================================================

router.get('/match', authenticate, async (req, res) => {
  try {
    const {
      area,
      minCapacity,
      truckType,
    } = req.query;

    const capacity =
      minCapacity !== undefined
        ? Number(minCapacity)
        : undefined;

    if (
      minCapacity !== undefined &&
      (!Number.isFinite(capacity) || capacity <= 0)
    ) {
      return res.status(400).json({
        error: 'minCapacity must be a positive number',
      });
    }

    const trucks = await prisma.truck.findMany({
      where: {
        availability: 'AVAILABLE',

        ...(area
          ? {
              operatingArea: {
                contains: area,
                mode: 'insensitive',
              },
            }
          : {}),

        ...(truckType
          ? {
              truckType: {
                contains: truckType,
                mode: 'insensitive',
              },
            }
          : {}),

        ...(capacity
          ? {
              capacity: {
                gte: capacity,
              },
            }
          : {}),
      },

      include: {
        owner: {
          select: {
            id: true,
            name: true,
            rating: true,
            phone: true,
          },
        },
      },

      orderBy: [
        {
          rating: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return res.json({
      trucks,
      count: trucks.length,
    });
  } catch (error) {
    console.error('TRUCK MATCH ERROR:', error);

    return res.status(500).json({
      error: 'Could not find available trucks',
    });
  }
});

// ============================================================
// TRUCK OWNER — MY JOBS
// ============================================================

router.get(
  '/mine',
  authenticate,
  requireRole('TRUCK_OWNER'),
  async (req, res) => {
    try {
      const jobs = await prisma.transportJob.findMany({
        where: {
          truckOwnerId: req.user.id,
        },

        include: {
          truck: true,

          order: {
            include: {
              listing: true,

              buyer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },

              seller: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        jobs,
        count: jobs.length,
      });
    } catch (error) {
      console.error('MY TRANSPORT JOBS ERROR:', error);

      return res.status(500).json({
        error: 'Could not load your transport jobs',
      });
    }
  }
);

// ============================================================
// TRUCK OWNER — OPEN HIRE REQUESTS
// ============================================================

router.get(
  '/open',
  authenticate,
  requireRole('TRUCK_OWNER'),
  async (req, res) => {
    try {
      const jobs = await prisma.transportJob.findMany({
        where: {
          method: 'HIRE_TRANSPORTER',
          truckOwnerId: null,
          status: 'REQUESTED',
        },

        include: {
          order: {
            include: {
              listing: true,

              buyer: {
                select: {
                  id: true,
                  name: true,
                },
              },

              seller: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        jobs,
        count: jobs.length,
      });
    } catch (error) {
      console.error('OPEN TRANSPORT JOBS ERROR:', error);

      return res.status(500).json({
        error: 'Could not load open transport jobs',
      });
    }
  }
);

// ============================================================
// TRUCK OWNER — ACCEPT / QUOTE
// ============================================================

router.patch(
  '/:id/respond',
  authenticate,
  requireRole('TRUCK_OWNER'),
  async (req, res) => {
    try {
      const { action, truckId } = req.body;

      if (!['ACCEPT', 'QUOTE'].includes(action)) {
        return res.status(400).json({
          error: 'Action must be ACCEPT or QUOTE',
        });
      }

      const job = await prisma.transportJob.findUnique({
        where: {
          id: req.params.id,
        },
      });

      if (!job) {
        return res.status(404).json({
          error: 'Transport job not found',
        });
      }

      if (job.method !== 'HIRE_TRANSPORTER') {
        return res.status(400).json({
          error: 'Own-truck jobs cannot be claimed by another truck owner',
        });
      }

      if (job.status !== 'REQUESTED') {
        return res.status(400).json({
          error: `This job is already ${job.status}`,
        });
      }

      let selectedTruckId = truckId || null;

      if (selectedTruckId) {
        const truck = await prisma.truck.findUnique({
          where: {
            id: selectedTruckId,
          },
        });

        if (!truck) {
          return res.status(404).json({
            error: 'Selected truck not found',
          });
        }

        if (truck.ownerId !== req.user.id) {
          return res.status(403).json({
            error: 'You can only assign your own truck',
          });
        }

        if (truck.availability !== 'AVAILABLE') {
          return res.status(400).json({
            error: 'Selected truck is not available',
          });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedJob = await tx.transportJob.update({
          where: {
            id: job.id,
          },

          data: {
            status: action === 'QUOTE'
              ? 'QUOTED'
              : 'ACCEPTED',

            truckOwnerId: req.user.id,

            ...(selectedTruckId
              ? {
                  truckId: selectedTruckId,
                }
              : {}),
          },
        });

        if (selectedTruckId) {
          await tx.truck.update({
            where: {
              id: selectedTruckId,
            },
            data: {
              availability: 'BUSY',
            },
          });
        }

        return updatedJob;
      });

      return res.json({
        message:
          action === 'QUOTE'
            ? 'Quote submitted successfully'
            : 'Transport job accepted successfully',

        transportJob: updated,
      });
    } catch (error) {
      console.error('RESPOND TRANSPORT JOB ERROR:', error);

      return res.status(500).json({
        error: 'Could not respond to transport job',
      });
    }
  }
);

// ============================================================
// UPDATE TRANSPORT STATUS
// ============================================================

router.patch(
  '/:id/status',
  authenticate,
  async (req, res) => {
    try {
      const {
        status,
        incidentNotes,
      } = req.body;

      const validStatuses = [
        'PICKUP',
        'IN_TRANSIT',
        'DELIVERED',
        'CANCELLED',
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid transport status',
        });
      }

      const job = await prisma.transportJob.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          order: true,
          truck: true,
        },
      });

      if (!job) {
        return res.status(404).json({
          error: 'Transport job not found',
        });
      }

      const isBuyer =
        job.order.buyerId === req.user.id;

      const isSeller =
        job.order.sellerId === req.user.id;

      const isTruckOwner =
        job.truckOwnerId === req.user.id;

      if (!isBuyer && !isSeller && !isTruckOwner) {
        return res.status(403).json({
          error: 'You are not authorized to update this transport job',
        });
      }

      const allowedTransitions = {
        REQUESTED: ['CANCELLED'],
        QUOTED: ['CANCELLED'],
        ACCEPTED: ['PICKUP', 'CANCELLED'],
        PICKUP: ['IN_TRANSIT', 'CANCELLED'],
        IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
        DELIVERED: [],
        CANCELLED: [],
      };

      if (
        !allowedTransitions[job.status]?.includes(status)
      ) {
        return res.status(400).json({
          error: `Cannot change transport status from ${job.status} to ${status}`,
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const data = {
          status,
        };

        if (incidentNotes) {
          data.incidentNotes = incidentNotes;
        }

        if (status === 'PICKUP') {
          data.pickupConfirmedAt = new Date();
        }

        if (status === 'DELIVERED') {
          data.deliveredConfirmedAt = new Date();
        }

        const updatedJob = await tx.transportJob.update({
          where: {
            id: job.id,
          },
          data,
        });

        if (status === 'IN_TRANSIT') {
          await tx.order.update({
            where: {
              id: job.orderId,
            },
            data: {
              status: 'IN_TRANSIT',
            },
          });
        }

        if (status === 'DELIVERED') {
          await tx.order.update({
            where: {
              id: job.orderId,
            },
            data: {
              status: 'DELIVERED',
            },
          });
        }

        if (status === 'CANCELLED') {
          await tx.order.update({
            where: {
              id: job.orderId,
            },
            data: {
              status: 'CONFIRMED',
            },
          });
        }

        if (
          job.truckId &&
          ['DELIVERED', 'CANCELLED'].includes(status)
        ) {
          await tx.truck.update({
            where: {
              id: job.truckId,
            },
            data: {
              availability: 'AVAILABLE',
            },
          });
        }

        return updatedJob;
      });

      return res.json({
        message: 'Transport status updated successfully',
        transportJob: updated,
      });
    } catch (error) {
      console.error('TRANSPORT STATUS ERROR:', error);

      return res.status(500).json({
        error: 'Could not update transport status',
      });
    }
  }
);

// ============================================================
// TRUCK OWNER — MY TRUCKS
// ============================================================

router.get(
  '/trucks/mine',
  authenticate,
  requireRole('TRUCK_OWNER'),
  async (req, res) => {
    try {
      const trucks = await prisma.truck.findMany({
        where: {
          ownerId: req.user.id,
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        trucks,
        count: trucks.length,
      });
    } catch (error) {
      console.error('MY TRUCKS ERROR:', error);

      return res.status(500).json({
        error: 'Could not load your trucks',
      });
    }
  }
);

// ============================================================
// REGISTER TRUCK
// ============================================================

router.post(
  '/trucks',
  authenticate,
  requireRole('TRUCK_OWNER'),
  [
    body('registration')
      .trim()
      .notEmpty()
      .withMessage('Registration is required'),

    body('truckType')
      .trim()
      .notEmpty()
      .withMessage('Truck type is required'),

    body('capacity')
      .isFloat({ gt: 0 })
      .withMessage('Capacity must be greater than zero'),

    body('operatingArea')
      .optional({ values: 'falsy' })
      .trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array(),
        });
      }

      const registration =
        req.body.registration.trim();

      const truckType =
        req.body.truckType.trim();

      const capacity =
        Number(req.body.capacity);

      const operatingArea =
        (req.body.operatingArea || '').trim();

      const existing = await prisma.truck.findFirst({
        where: {
          registration: {
            equals: registration,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          error: 'A truck with this registration is already registered',
        });
      }

      const truck = await prisma.truck.create({
        data: {
          ownerId: req.user.id,
          registration,
          truckType,
          capacity,
          operatingArea,
          availability: 'AVAILABLE',
        },
      });

      return res.status(201).json({
        message: 'Truck registered successfully',
        truck,
      });
    } catch (error) {
      console.error('REGISTER TRUCK ERROR:', error);

      return res.status(500).json({
        error: 'Could not register truck',
        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);

// ============================================================
// TRUCK AVAILABILITY
// ============================================================

router.patch(
  '/trucks/:id/availability',
  authenticate,
  requireRole('TRUCK_OWNER'),
  async (req, res) => {
    try {
      const {
        availability,
      } = req.body;

      const allowed = [
        'AVAILABLE',
        'BUSY',
        'OFFLINE',
      ];

      if (!allowed.includes(availability)) {
        return res.status(400).json({
          error: 'Invalid availability',
        });
      }

      const truck = await prisma.truck.findUnique({
        where: {
          id: req.params.id,
        },
      });

      if (!truck) {
        return res.status(404).json({
          error: 'Truck not found',
        });
      }

      if (truck.ownerId !== req.user.id) {
        return res.status(403).json({
          error: 'Not your truck',
        });
      }

      const updated = await prisma.truck.update({
        where: {
          id: truck.id,
        },

        data: {
          availability,
        },
      });

      return res.json({
        message: 'Truck availability updated',
        truck: updated,
      });
    } catch (error) {
      console.error('TRUCK AVAILABILITY ERROR:', error);

      return res.status(500).json({
        error: 'Could not update truck availability',
      });
    }
  }
);

module.exports = router;
