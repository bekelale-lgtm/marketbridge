// backend/src/routes/transport.js
//
// MarketBridge — Transport Routes
//
// FINAL TRANSPORT RULES
//
// 1. MarketBridge is a facilitator/intermediary.
// 2. The agricultural seller/farmer may arrange transportation.
// 3. The buyer may arrange transportation.
// 4. Seller + buyer may jointly arrange transportation.
// 5. Either party may:
//      - use their own truck
//      - hire a registered truck owner through MarketBridge
// 6. MarketBridge does NOT automatically assign a truck.
// 7. OWN_TRUCK creates NO transporter-hiring commission.
// 8. HIRE_TRANSPORTER creates a transport marketplace request.
// 9. Multiple truck owners may submit quotes.
// 10. The arranging party selects the transporter/quote.
// 11. Truck owners only receive transport requests created through
//     the platform.
// 12. Transport lifecycle:
//
//     REQUESTED
//        ↓
//     QUOTED
//        ↓
//     ACCEPTED
//        ↓
//     PICKUP
//        ↓
//     IN_TRANSIT
//        ↓
//     DELIVERED
//
//     CANCELLED can occur before completion.
//

const express = require('express');
const { body, validationResult } = require('express-validator');

const prisma = require('../config/db');

const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();


// ============================================================================
// HELPERS
// ============================================================================

const isAdmin = (req) => {
  return req.user?.roles?.includes('ADMIN');
};


const canArrangeTransport = (order, userId, roles = []) => {
  return (
    order.buyerId === userId ||
    order.sellerId === userId ||
    roles.includes('ADMIN')
  );
};


const canManageTransportJob = (job, userId, roles = []) => {
  return (
    job.order.buyerId === userId ||
    job.order.sellerId === userId ||
    roles.includes('ADMIN')
  );
};


// ============================================================================
// CREATE TRANSPORT JOB
// ============================================================================
//
// POST /transport
//
// SELLER / BUYER may create the transport request.
//
// arrangingParty:
//   SELLER
//   BUYER
//   JOINT
//
// method:
//   OWN_TRUCK
//   HIRE_TRANSPORTER
//
// OWN_TRUCK:
//   - no transporter is assigned
//   - no transport quote is required
//   - no transport-hiring commission
//
// HIRE_TRANSPORTER:
//   - creates REQUESTED job
//   - registered truck owners can see it
//   - truck owners submit TransportQuote records
//
// ============================================================================

router.post(
  '/',
  authenticate,
  requireRole('SELLER', 'BUYER'),

  [
    body('orderId')
      .notEmpty()
      .withMessage('orderId is required'),

    body('arrangingParty')
      .isIn(['SELLER', 'BUYER', 'JOINT'])
      .withMessage('Invalid arrangingParty'),

    body('method')
      .isIn(['OWN_TRUCK', 'HIRE_TRANSPORTER'])
      .withMessage('Invalid transport method'),

    body('pickupLocation')
      .notEmpty()
      .withMessage('pickupLocation is required'),

    body('destination')
      .notEmpty()
      .withMessage('destination is required'),

    body('load')
      .notEmpty()
      .withMessage('load is required'),

    body('requiredCapacity')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('requiredCapacity must be greater than zero'),
  ],

  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }

      const {
        orderId,
        arrangingParty,
        method,
        truckId,
        pickupLocation,
        destination,
        load,
        requiredCapacity,
        specialRequirements,
      } = req.body;


      // ----------------------------------------------------------------------
      // Find order
      // ----------------------------------------------------------------------

      const order = await prisma.order.findUnique({
        where: {
          id: orderId,
        },

        include: {
          transportJob: true,
        },
      });


      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
        });
      }


      // ----------------------------------------------------------------------
      // Only buyer/seller on the order may arrange transport
      // ----------------------------------------------------------------------

      if (!canArrangeTransport(
        order,
        req.user.id,
        req.user.roles || []
      )) {
        return res.status(403).json({
          error:
            'Only the buyer or seller on this order may arrange transport',
        });
      }


      // ----------------------------------------------------------------------
      // Validate order state
      // ----------------------------------------------------------------------

      const allowedOrderStatuses = [
        'CONFIRMED',
        'PENDING_PAYMENT',
      ];

      if (!allowedOrderStatuses.includes(order.status)) {
        return res.status(400).json({
          error:
            `Order status ${order.status} does not allow arranging transport`,
        });
      }


      // ----------------------------------------------------------------------
      // Prevent duplicate transport jobs
      // ----------------------------------------------------------------------

      if (order.transportJob) {
        return res.status(409).json({
          error:
            'A transport arrangement already exists for this order',
          transportJob: order.transportJob,
        });
      }


      // ----------------------------------------------------------------------
      // JOINT arrangement requires both parties to be involved.
      //
      // Since this endpoint is authenticated for one party at a time,
      // we record JOINT as the selected arrangement method.
      // Further joint confirmation can be added later if required.
      // ----------------------------------------------------------------------


      // ----------------------------------------------------------------------
      // OWN_TRUCK validation
      //
      // If using an own truck, truckId must identify a truck owned by
      // the arranging party.
      //
      // For JOINT arrangements, either the buyer or seller may own the truck.
      // ----------------------------------------------------------------------

      if (method === 'OWN_TRUCK') {
        if (!truckId) {
          return res.status(400).json({
            error:
              'truckId is required when using OWN_TRUCK',
          });
        }

        const truck = await prisma.truck.findUnique({
          where: {
            id: truckId,
          },
        });

        if (!truck) {
          return res.status(404).json({
            error: 'Truck not found',
          });
        }

        const ownerIsBuyer = truck.ownerId === order.buyerId;
        const ownerIsSeller = truck.ownerId === order.sellerId;

        if (!ownerIsBuyer && !ownerIsSeller) {
          return res.status(403).json({
            error:
              'The selected own truck must belong to the buyer or seller on this order',
          });
        }
      }


      // ----------------------------------------------------------------------
      // HIRE_TRANSPORTER
      //
      // Do NOT accept a truckOwnerId here.
      //
      // Truck owners must submit independent TransportQuote records.
      // This prevents the creator of the transport request from secretly
      // assigning a transporter.
      // ----------------------------------------------------------------------

      const job = await prisma.transportJob.create({
        data: {
          orderId: order.id,

          arrangingParty,

          method,

          truckOwnerId: null,

          truckId:
            method === 'OWN_TRUCK'
              ? truckId
              : null,

          pickupLocation,

          destination,

          load,

          requiredCapacity,

          specialRequirements,

          status:
            method === 'OWN_TRUCK'
              ? 'PICKUP'
              : 'REQUESTED',
        },

        include: {
          truck: true,
          truckOwner: true,
          quotes: true,
        },
      });


      // ----------------------------------------------------------------------
      // Update order
      // ----------------------------------------------------------------------

      await prisma.order.update({
        where: {
          id: order.id,
        },

        data: {
          arrangingParty,

          status: 'TRANSPORT_ARRANGED',
        },
      });


      // ----------------------------------------------------------------------
      // IMPORTANT:
      //
      // OWN_TRUCK:
      // No TRANSPORT Payment record is created.
      //
      // HIRE_TRANSPORTER:
      // No commission is generated at request creation.
      //
      // Transport payment/commission should only be created by the
      // appropriate payment/settlement workflow after a transporter
      // has been selected and the applicable fee is known.
      // ----------------------------------------------------------------------

      return res.status(201).json({
        message:
          method === 'OWN_TRUCK'
            ? 'Own-truck transport arrangement created'
            : 'Transport hiring request created',

        transportJob: job,
      });

    } catch (error) {
      console.error(
        'POST /transport error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to create transport arrangement',
      });
    }
  }
);


// ============================================================================
// FIND AVAILABLE TRUCKS
// ============================================================================
//
// GET /transport/match
//
// Used as a discovery/matching endpoint.
//
// Filters:
//   area
//   minCapacity
//   truckType
//
// Results are ranked primarily by rating.
//
// NOTE:
// Actual distance calculation/GPS matching can be added later.
// This endpoint currently uses operatingArea as the geographic filter.
//

router.get(
  '/match',
  authenticate,
  async (req, res) => {
    try {
      const {
        area,
        minCapacity,
        truckType,
      } = req.query;


      const parsedCapacity =
        minCapacity !== undefined
          ? Number(minCapacity)
          : undefined;


      if (
        parsedCapacity !== undefined &&
        (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0)
      ) {
        return res.status(400).json({
          error: 'minCapacity must be a positive number',
        });
      }


      const trucks = await prisma.truck.findMany({
        where: {
          availability: 'AVAILABLE',

          verificationStatus: 'VERIFIED',

          ...(area && {
            operatingArea: {
              contains: area,
              mode: 'insensitive',
            },
          }),

          ...(truckType && {
            truckType: {
              contains: truckType,
              mode: 'insensitive',
            },
          }),

          ...(parsedCapacity !== undefined && {
            capacity: {
              gte: parsedCapacity,
            },
          }),
        },

        include: {
          owner: {
            select: {
              id: true,
              name: true,
              phone: true,
              rating: true,
              verificationStatus: true,
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
      });

    } catch (error) {
      console.error(
        'GET /transport/match error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to find available trucks',
      });
    }
  }
);


// ============================================================================
// MY TRANSPORT JOBS
// ============================================================================
//
// GET /transport/mine
//
// Truck owners see jobs assigned to them.
//
// Includes:
// - order
// - listing
// - buyer
// - seller
// - selected truck
// - quotes
//
// ============================================================================

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
          order: {
            include: {
              listing: true,

              buyer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  rating: true,
                },
              },

              seller: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  rating: true,
                },
              },
            },
          },

          truck: true,

          quotes: {
            include: {
              truck: true,
              truckOwner: {
                select: {
                  id: true,
                  name: true,
                  rating: true,
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
      });

    } catch (error) {
      console.error(
        'GET /transport/mine error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to load transport jobs',
      });
    }
  }
);


// ============================================================================
// OPEN TRANSPORT REQUESTS
// ============================================================================
//
// GET /transport/open
//
// Truck owners see unassigned HIRE_TRANSPORTER jobs.
//
// OWN_TRUCK jobs are never shown here.
//

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

          status: {
            in: [
              'REQUESTED',
              'QUOTED',
            ],
          },
        },

        include: {
          order: {
            include: {
              listing: true,

              buyer: {
                select: {
                  id: true,
                  name: true,
                  rating: true,
                },
              },

              seller: {
                select: {
                  id: true,
                  name: true,
                  rating: true,
                },
              },
            },
          },

          quotes: {
            select: {
              id: true,
              truckOwnerId: true,
              truckId: true,
              amount: true,
              message: true,
              status: true,
              createdAt: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });


      return res.json({
        jobs,
      });

    } catch (error) {
      console.error(
        'GET /transport/open error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to load open transport requests',
      });
    }
  }
);


// ============================================================================
// SUBMIT TRANSPORT QUOTE
// ============================================================================
//
// POST /transport/:id/quotes
//
// Truck owner submits a quote for an open transport request.
//
// Required:
//   amount
//
// Optional:
//   truckId
//   message
//
// A truck owner cannot quote their own order.
//

router.post(
  '/:id/quotes',
  authenticate,
  requireRole('TRUCK_OWNER'),

  [
    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be greater than zero'),

    body('truckId')
      .optional()
      .notEmpty()
      .withMessage('truckId cannot be empty'),

    body('message')
      .optional()
      .isString(),
  ],

  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }


      const job = await prisma.transportJob.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          order: true,
        },
      });


      if (!job) {
        return res.status(404).json({
          error: 'Transport job not found',
        });
      }


      if (job.method !== 'HIRE_TRANSPORTER') {
        return res.status(400).json({
          error:
            'Quotes can only be submitted for hired transport requests',
        });
      }


      if (
        job.status !== 'REQUESTED' &&
        job.status !== 'QUOTED'
      ) {
        return res.status(400).json({
          error:
            `Transport job status ${job.status} does not accept new quotes`,
        });
      }


      // Prevent buyer/seller from acting as transporter on their own order
      if (
        job.order.buyerId === req.user.id ||
        job.order.sellerId === req.user.id
      ) {
        return res.status(403).json({
          error:
            'Buyer or seller cannot submit a transporter quote for their own order',
        });
      }


      // ----------------------------------------------------------------------
      // Select a truck owned by this transporter.
      //
      // If truckId is supplied, verify ownership and availability.
      // ----------------------------------------------------------------------

      let truckId = req.body.truckId || null;


      if (truckId) {
        const truck = await prisma.truck.findUnique({
          where: {
            id: truckId,
          },
        });


        if (!truck) {
          return res.status(404).json({
            error: 'Truck not found',
          });
        }


        if (truck.ownerId !== req.user.id) {
          return res.status(403).json({
            error: 'You can only quote using your own truck',
          });
        }


        if (truck.availability !== 'AVAILABLE') {
          return res.status(400).json({
            error:
              'The selected truck is not currently available',
          });
        }


        if (
          job.requiredCapacity &&
          truck.capacity < job.requiredCapacity
        ) {
          return res.status(400).json({
            error:
              'The selected truck does not have sufficient capacity',
          });
        }
      }


      // ----------------------------------------------------------------------
      // Check for an existing quote.
      //
      // Prisma schema:
      // @@unique([transportJobId, truckOwnerId])
      //
      // One transporter may have only one quote per job.
      // ----------------------------------------------------------------------

      const existingQuote = await prisma.transportQuote.findUnique({
        where: {
          transportJobId_truckOwnerId: {
            transportJobId: job.id,
            truckOwnerId: req.user.id,
          },
        },
      });


      if (existingQuote) {
        return res.status(409).json({
          error:
            'You have already submitted a quote for this transport request',
          quote: existingQuote,
        });
      }


      const quote = await prisma.transportQuote.create({
        data: {
          transportJobId: job.id,

          truckOwnerId: req.user.id,

          truckId,

          amount: Number(req.body.amount),

          message: req.body.message || null,

          status: 'PENDING',
        },

        include: {
          truck: true,

          truckOwner: {
            select: {
              id: true,
              name: true,
              phone: true,
              rating: true,
              verificationStatus: true,
            },
          },
        },
      });


      // If the job was REQUESTED, mark it QUOTED.
      if (job.status === 'REQUESTED') {
        await prisma.transportJob.update({
          where: {
            id: job.id,
          },

          data: {
            status: 'QUOTED',
          },
        });
      }


      return res.status(201).json({
        message: 'Transport quote submitted',
        quote,
      });

    } catch (error) {
      console.error(
        'POST /transport/:id/quotes error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to submit transport quote',
      });
    }
  }
);


// ============================================================================
// LIST QUOTES FOR A TRANSPORT JOB
// ============================================================================
//
// GET /transport/:id/quotes
//
// Only buyer/seller on the order or ADMIN can see quotes.
//
// Truck owners should not see competing transporter quotes.
//

router.get(
  '/:id/quotes',
  authenticate,

  async (req, res) => {
    try {
      const job = await prisma.transportJob.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          order: true,
        },
      });


      if (!job) {
        return res.status(404).json({
          error: 'Transport job not found',
        });
      }


      if (!canManageTransportJob(
        job,
        req.user.id,
        req.user.roles || []
      )) {
        return res.status(403).json({
          error:
            'Only the buyer or seller on this order may view transporter quotes',
        });
      }


      const quotes = await prisma.transportQuote.findMany({
        where: {
          transportJobId: job.id,

          status: {
            in: [
              'PENDING',
              'ACCEPTED',
              'REJECTED',
            ],
          },
        },

        include: {
          truckOwner: {
            select: {
              id: true,
              name: true,
              phone: true,
              rating: true,
              verificationStatus: true,
            },
          },

          truck: {
            select: {
              id: true,
              registration: true,
              truckType: true,
              capacity: true,
              operatingArea: true,
              availability: true,
              verificationStatus: true,
              rating: true,
            },
          },
        },

        orderBy: {
          amount: 'asc',
        },
      });


      return res.json({
        quotes,
      });

    } catch (error) {
      console.error(
        'GET /transport/:id/quotes error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to load transport quotes',
      });
    }
  }
);


// ============================================================================
// ACCEPT / SELECT A TRANSPORT QUOTE
// ============================================================================
//
// PATCH /transport/quotes/:quoteId/select
//
// Buyer or seller selects the winning transporter.
//
// The selected quote becomes ACCEPTED.
// All other pending quotes become REJECTED.
//
// The selected truck owner and truck are copied onto TransportJob.
//
// This is the point at which the transporter becomes assigned.
//
// ============================================================================

router.patch(
  '/quotes/:quoteId/select',
  authenticate,
  requireRole('SELLER', 'BUYER', 'ADMIN'),

  async (req, res) => {
    try {
      const quote = await prisma.transportQuote.findUnique({
        where: {
          id: req.params.quoteId,
        },

        include: {
          transportJob: {
            include: {
              order: true,
            },
          },

          truckOwner: true,

          truck: true,
        },
      });


      if (!quote) {
        return res.status(404).json({
          error: 'Transport quote not found',
        });
      }


      const job = quote.transportJob;


      if (!canManageTransportJob(
        job,
        req.user.id,
        req.user.roles || []
      )) {
        return res.status(403).json({
          error:
            'Only the buyer or seller on this order may select the transporter',
        });
      }


      if (job.method !== 'HIRE_TRANSPORTER') {
        return res.status(400).json({
          error:
            'A transporter can only be selected for HIRE_TRANSPORTER jobs',
        });
      }


      if (
        job.status !== 'REQUESTED' &&
        job.status !== 'QUOTED'
      ) {
        return res.status(400).json({
          error:
            `Transport job status ${job.status} does not allow transporter selection`,
        });
      }


      if (quote.status !== 'PENDING') {
        return res.status(400).json({
          error:
            `Quote status ${quote.status} cannot be selected`,
        });
      }


      if (!quote.truckOwnerId) {
        return res.status(400).json({
          error:
            'This quote has no transporter assigned',
        });
      }


      // ----------------------------------------------------------------------
      // Use a transaction so quote selection and job assignment happen
      // atomically.
      // ----------------------------------------------------------------------

      const result = await prisma.$transaction(async (tx) => {

        // Accept selected quote
        const acceptedQuote = await tx.transportQuote.update({
          where: {
            id: quote.id,
          },

          data: {
            status: 'ACCEPTED',
          },
        });


        // Reject all competing pending quotes
        await tx.transportQuote.updateMany({
          where: {
            transportJobId: job.id,

            id: {
              not: quote.id,
            },

            status: 'PENDING',
          },

          data: {
            status: 'REJECTED',
          },
        });


        // Assign transporter + truck
        const updatedJob = await tx.transportJob.update({
          where: {
            id: job.id,
          },

          data: {
            truckOwnerId: quote.truckOwnerId,

            truckId: quote.truckId,

            status: 'ACCEPTED',
          },

          include: {
            truckOwner: {
              select: {
                id: true,
                name: true,
                phone: true,
                rating: true,
                verificationStatus: true,
              },
            },

            truck: true,

            quotes: true,
          },
        });


        return {
          acceptedQuote,
          transportJob: updatedJob,
        };
      });


      return res.json({
        message:
          'Transporter selected successfully',

        ...result,
      });

    } catch (error) {
      console.error(
        'PATCH /transport/quotes/:quoteId/select error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to select transporter',
      });
    }
  }
);


// ============================================================================
// TRANSPORTER WITHDRAWS OWN QUOTE
// ============================================================================
//
// PATCH /transport/quotes/:quoteId/withdraw
//
// ============================================================================

router.patch(
  '/quotes/:quoteId/withdraw',
  authenticate,
  requireRole('TRUCK_OWNER'),

  async (req, res) => {
    try {
      const quote = await prisma.transportQuote.findUnique({
        where: {
          id: req.params.quoteId,
        },
      });


      if (!quote) {
        return res.status(404).json({
          error: 'Transport quote not found',
        });
      }


      if (quote.truckOwnerId !== req.user.id) {
        return res.status(403).json({
          error: 'You can only withdraw your own quote',
        });
      }


      if (quote.status !== 'PENDING') {
        return res.status(400).json({
          error:
            `Quote status ${quote.status} cannot be withdrawn`,
        });
      }


      const updated = await prisma.transportQuote.update({
        where: {
          id: quote.id,
        },

        data: {
          status: 'WITHDRAWN',
        },
      });


      return res.json({
        message: 'Transport quote withdrawn',
        quote: updated,
      });

    } catch (error) {
      console.error(
        'PATCH /transport/quotes/:quoteId/withdraw error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to withdraw transport quote',
      });
    }
  }
);


// ============================================================================
// TRANSPORT STATUS
// ============================================================================
//
// PATCH /transport/:id/status
//
// Allowed progression:
//
// ACCEPTED → PICKUP
// PICKUP → IN_TRANSIT
// IN_TRANSIT → DELIVERED
//
// CANCELLED may be used where appropriate.
//
// OWN_TRUCK:
// Seller/buyer may update the trip.
//
// HIRE_TRANSPORTER:
// Assigned truck owner may update the trip.
// Buyer/seller may also confirm relevant milestones where permitted.
//
// ============================================================================

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
        },
      });


      if (!job) {
        return res.status(404).json({
          error: 'Transport job not found',
        });
      }


      const userId = req.user.id;
      const roles = req.user.roles || [];

      const isBuyer = job.order.buyerId === userId;
      const isSeller = job.order.sellerId === userId;
      const isTruckOwner = job.truckOwnerId === userId;
      const admin = roles.includes('ADMIN');


      if (
        !isBuyer &&
        !isSeller &&
        !isTruckOwner &&
        !admin
      ) {
        return res.status(403).json({
          error:
            'You are not authorized to update this transport job',
        });
      }


      // ----------------------------------------------------------------------
      // Transport status transition validation
      // ----------------------------------------------------------------------

      const allowedTransitions = {
        REQUESTED: ['CANCELLED'],

        QUOTED: ['CANCELLED'],

        ACCEPTED: [
          'PICKUP',
          'CANCELLED',
        ],

        PICKUP: [
          'IN_TRANSIT',
          'CANCELLED',
        ],

        IN_TRANSIT: [
          'DELIVERED',
          'CANCELLED',
        ],

        DELIVERED: [],

        CANCELLED: [],
      };


      if (
        !allowedTransitions[job.status]?.includes(status)
      ) {
        return res.status(400).json({
          error:
            `Invalid transport transition: ${job.status} → ${status}`,
        });
      }


      // ----------------------------------------------------------------------
      // Role-specific status permissions
      // ----------------------------------------------------------------------

      if (
        job.method === 'HIRE_TRANSPORTER' &&
        !admin
      ) {

        // Before transporter assignment:
        // buyer/seller may cancel, but cannot mark pickup/in-transit/delivered.
        if (!job.truckOwnerId) {

          if (
            status !== 'CANCELLED' ||
            (!isBuyer && !isSeller)
          ) {
            return res.status(403).json({
              error:
                'A transporter must be selected before transport progress can be recorded',
            });
          }
        }


        // After transporter assignment:
        // transporter can progress the physical trip.
        if (
          job.truckOwnerId &&
          !isTruckOwner &&
          status !== 'CANCELLED'
        ) {
          return res.status(403).json({
            error:
              'Only the assigned transporter may update transport progress',
          });
        }
      }


      // ----------------------------------------------------------------------
      // OWN_TRUCK
      //
      // Buyer/seller can control their own transport.
      // ----------------------------------------------------------------------

      if (
        job.method === 'OWN_TRUCK' &&
        !admin &&
        !isBuyer &&
        !isSeller
      ) {
        return res.status(403).json({
          error:
            'Only the buyer or seller may manage own-truck transport',
        });
      }


      const data = {
        status,

        ...(incidentNotes && {
          incidentNotes,
        }),
      };


      if (status === 'PICKUP') {
        data.pickupConfirmedAt = new Date();
      }


      if (status === 'DELIVERED') {
        data.deliveredConfirmedAt = new Date();
      }


      const updated = await prisma.$transaction(
        async (tx) => {

          const updatedJob =
            await tx.transportJob.update({
              where: {
                id: job.id,
              },

              data,

              include: {
                truckOwner: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    rating: true,
                  },
                },

                truck: true,
              },
            });


          // When physical delivery occurs, order becomes DELIVERED.
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


          // If transport is cancelled, return order to CONFIRMED
          // so a new transport arrangement can be created.
          if (status === 'CANCELLED') {
            await tx.order.update({
              where: {
                id: job.orderId,
              },

              data: {
                status: 'CONFIRMED',
                arrangingParty: null,
              },
            });
          }


          return updatedJob;
        }
      );


      return res.json({
        message:
          `Transport status updated to ${status}`,

        transportJob: updated,
      });

    } catch (error) {
      console.error(
        'PATCH /transport/:id/status error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to update transport status',
      });
    }
  }
);


// ============================================================================
// MY TRUCKS
// ============================================================================
//
// GET /transport/trucks/mine
//
// ============================================================================

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
      });

    } catch (error) {
      console.error(
        'GET /transport/trucks/mine error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to load trucks',
      });
    }
  }
);


// ============================================================================
// REGISTER TRUCK
// ============================================================================
//
// POST /transport/trucks
//
// ============================================================================

router.post(
  '/trucks',
  authenticate,
  requireRole('TRUCK_OWNER'),

  [
    body('registration')
      .notEmpty()
      .withMessage('registration is required'),

    body('truckType')
      .notEmpty()
      .withMessage('truckType is required'),

    body('capacity')
      .isFloat({ gt: 0 })
      .withMessage('capacity must be greater than zero'),

    body('operatingArea')
      .notEmpty()
      .withMessage('operatingArea is required'),
  ],

  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }


      const {
        registration,
        truckType,
        capacity,
        operatingArea,
      } = req.body;


      // Prevent duplicate truck registration.
      const existing = await prisma.truck.findFirst({
        where: {
          registration,
        },
      });


      if (existing) {
        return res.status(409).json({
          error:
            'A truck with this registration already exists',
        });
      }


      const truck = await prisma.truck.create({
        data: {
          ownerId: req.user.id,

          registration,

          truckType,

          capacity: Number(capacity),

          operatingArea,

          availability: 'AVAILABLE',

          verificationStatus: 'UNVERIFIED',
        },
      });


      return res.status(201).json({
        message:
          'Truck registered successfully. Verification is required before it appears in matching.',

        truck,
      });

    } catch (error) {
      console.error(
        'POST /transport/trucks error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to register truck',
      });
    }
  }
);


// ============================================================================
// UPDATE TRUCK AVAILABILITY
// ============================================================================
//
// PATCH /transport/trucks/:id/availability
//
// AVAILABLE
// BUSY
// OFFLINE
//
// ============================================================================

router.patch(
  '/trucks/:id/availability',
  authenticate,
  requireRole('TRUCK_OWNER'),

  async (req, res) => {
    try {
      const {
        availability,
      } = req.body;


      const validAvailability = [
        'AVAILABLE',
        'BUSY',
        'OFFLINE',
      ];


      if (!validAvailability.includes(availability)) {
        return res.status(400).json({
          error:
            'Invalid truck availability',
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
        message:
          'Truck availability updated',

        truck: updated,
      });

    } catch (error) {
      console.error(
        'PATCH /transport/trucks/:id/availability error:',
        error
      );

      return res.status(500).json({
        error:
          'Failed to update truck availability',
      });
    }
  }
);


// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
