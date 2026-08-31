// backend/src/routes/order.js
//
// MarketBridge — Order Routes
//
// Core principles:
// 1. MarketBridge is an intermediary marketplace.
// 2. Seller remains owner/price authority over agricultural produce.
// 3. Transport may be arranged by:
//      - SELLER
//      - BUYER
//      - JOINT
// 4. Transport may use:
//      - OWN_TRUCK
//      - HIRE_TRANSPORTER
// 5. OWN_TRUCK does NOT create a transporter-hiring commission.
// 6. Hired transport is selected through the TransportJob/TransportQuote
//    workflow.
// 7. Buyer confirms receipt only after the transport job reaches DELIVERED.
//

const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();


// ============================================================================
// GET ALL ORDERS FOR CURRENT USER
// ============================================================================
//
// Returns orders where the authenticated user is either:
// - buyer
// - seller
//
// Transport details include:
// - arranging party
// - transport method
// - current transport status
// - selected transporter
// - selected truck
// - transporter quotes
//
// ============================================================================

router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { buyerId: req.user.id },
          { sellerId: req.user.id },
        ],
      },

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

        transportJob: {
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

            quotes: {
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
            },
          },
        },

        payments: true,

        disputes: true,

        ratings: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ orders });
  } catch (error) {
    console.error('GET /orders error:', error);

    return res.status(500).json({
      error: 'Failed to load orders',
    });
  }
});


// ============================================================================
// GET SINGLE ORDER
// ============================================================================
//
// Buyer, seller, or admin may view the order.
//
// ============================================================================

router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id,
      },

      include: {
        listing: true,

        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        transportJob: {
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

            quotes: {
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
            },
          },
        },

        payments: true,

        disputes: true,

        ratings: true,

        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;
    const isAdmin = req.user.roles?.includes('ADMIN');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        error: 'Not authorized to view this order',
      });
    }

    return res.json({ order });
  } catch (error) {
    console.error('GET /orders/:id error:', error);

    return res.status(500).json({
      error: 'Failed to load order',
    });
  }
});


// ============================================================================
// BUYER CONFIRMS RECEIPT
// ============================================================================
//
// This is the final physical-delivery confirmation.
//
// Required sequence:
//
// TransportJob
//     ↓
// DELIVERED
//     ↓
// Buyer confirms receipt
//     ↓
// Order COMPLETED
//
// The buyer cannot confirm receipt while transport is still:
// - REQUESTED
// - QUOTED
// - ACCEPTED
// - PICKUP
// - IN_TRANSIT
//
// ============================================================================

router.patch(
  '/:id/confirm-receipt',
  authenticate,
  async (req, res) => {
    try {
      const order = await prisma.order.findUnique({
        where: {
          id: req.params.id,
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

      // Only the buyer can confirm receipt.
      if (order.buyerId !== req.user.id) {
        return res.status(403).json({
          error: 'Only the buyer can confirm receipt',
        });
      }

      // Prevent duplicate completion.
      if (order.status === 'COMPLETED') {
        return res.status(400).json({
          error: 'Order has already been completed',
        });
      }

      // A completed physical agricultural order must have a delivery record.
      if (!order.transportJob) {
        return res.status(400).json({
          error: 'No transport record exists for this order',
        });
      }

      if (order.transportJob.status !== 'DELIVERED') {
        return res.status(400).json({
          error:
            `Receipt cannot be confirmed while transport status is ${order.transportJob.status}`,
        });
      }

      const updated = await prisma.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: 'COMPLETED',
        },

        include: {
          listing: true,
          transportJob: {
            include: {
              truckOwner: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  rating: true,
                },
              },

              truck: {
                select: {
                  id: true,
                  registration: true,
                  truckType: true,
                  capacity: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      return res.json({
        message: 'Receipt confirmed. Order completed.',
        order: updated,
      });
    } catch (error) {
      console.error(
        'PATCH /orders/:id/confirm-receipt error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to confirm receipt',
      });
    }
  }
);


module.exports = router;
