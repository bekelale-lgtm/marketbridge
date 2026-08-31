// backend/src/routes/orders.js
//
// MarketBridge — Order Routes
//
// Rules:
// - Buyer and seller can view their orders.
// - Admin can view any order.
// - Buyer confirms receipt only after transport reaches DELIVERED.
// - Transport details include selected truck/transporter.
// - OWN_TRUCK does not create a transporter commission.
// - HIRE_TRANSPORTER uses the registered truck-owner workflow.
//
// IMPORTANT:
// This file is consistent with the current Prisma schema.
// TransportJob currently has:
//   - truckOwner
//   - truck
//   - pickupLocation
//   - destination
//   - load
//   - requiredCapacity
//   - specialRequirements
//   - status
//
// There is currently NO TransportQuote model/relation in the supplied
// Prisma schema, so this route does not reference "quotes".
//

const express = require('express');

const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();


// ============================================================================
// COMMON USER SELECT
// ============================================================================

const userSelect = {
  id: true,
  name: true,
  phone: true,
  location: true,
  rating: true,
  verificationStatus: true,
};


// ============================================================================
// COMMON TRANSPORT INCLUDE
// ============================================================================
//
// Consistent with the current Prisma TransportJob model.
//
// TransportJob relations:
//   truckOwner -> User
//   truck      -> Truck
//
// There is currently no "quotes" relation.
// ============================================================================

const transportInclude = {
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
};


// ============================================================================
// COMMON ORDER INCLUDE
// ============================================================================

const orderInclude = {
  listing: true,

  buyer: {
    select: userSelect,
  },

  seller: {
    select: userSelect,
  },

  transportJob: {
    include: transportInclude,
  },

  payments: true,

  disputes: true,

  ratings: true,
};


// ============================================================================
// GET CURRENT USER ORDERS
// ============================================================================
//
// GET /api/orders
//
// Buyer:
//   sees orders where buyerId = current user
//
// Seller:
//   sees orders where sellerId = current user
//
// Admin:
//   sees all orders
//
// ============================================================================

router.get(
  '/',
  authenticate,
  async (req, res) => {
    try {
      const isAdmin =
        Array.isArray(req.user.roles) &&
        req.user.roles.includes('ADMIN');

      const orders =
        await prisma.order.findMany({
          where: isAdmin
            ? {}
            : {
                OR: [
                  {
                    buyerId:
                      req.user.id,
                  },

                  {
                    sellerId:
                      req.user.id,
                  },
                ],
              },

          include:
            orderInclude,

          orderBy: {
            createdAt:
              'desc',
          },
        });

      return res.json({
        orders,
        count: orders.length,
      });
    } catch (error) {
      console.error(
        'GET /api/orders ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Failed to load orders',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================================
// GET SINGLE ORDER
// ============================================================================
//
// GET /api/orders/:id
//
// Buyer, seller, or admin only.
//
// ============================================================================

router.get(
  '/:id',
  authenticate,
  async (req, res) => {
    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id:
              req.params.id,
          },

          include: {
            ...orderInclude,

            messages: {
              orderBy: {
                createdAt:
                  'asc',
              },
            },
          },
        });

      if (!order) {
        return res.status(404).json({
          error:
            'Order not found',
        });
      }

      const isBuyer =
        order.buyerId ===
        req.user.id;

      const isSeller =
        order.sellerId ===
        req.user.id;

      const isAdmin =
        Array.isArray(req.user.roles) &&
        req.user.roles.includes(
          'ADMIN'
        );

      if (
        !isBuyer &&
        !isSeller &&
        !isAdmin
      ) {
        return res.status(403).json({
          error:
            'Not authorized to view this order',
        });
      }

      return res.json({
        order,
      });
    } catch (error) {
      console.error(
        'GET /api/orders/:id ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Failed to load order',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================================
// BUYER CONFIRMS RECEIPT
// ============================================================================
//
// PATCH /api/orders/:id/confirm-receipt
//
// Required workflow:
//
// TRANSPORT REQUESTED
//        ↓
// TRANSPORT ACCEPTED
//        ↓
// PICKUP
//        ↓
// IN_TRANSIT
//        ↓
// DELIVERED
//        ↓
// BUYER CONFIRMS RECEIPT
//        ↓
// ORDER COMPLETED
//
// The buyer cannot complete the order before transport reaches DELIVERED.
//
// ============================================================================

router.patch(
  '/:id/confirm-receipt',
  authenticate,
  async (req, res) => {
    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id:
              req.params.id,
          },

          include: {
            transportJob: true,
          },
        });

      if (!order) {
        return res.status(404).json({
          error:
            'Order not found',
        });
      }

      // ----------------------------------------------------------
      // BUYER ONLY
      // ----------------------------------------------------------

      if (
        order.buyerId !==
        req.user.id
      ) {
        return res.status(403).json({
          error:
            'Only the buyer can confirm receipt',
        });
      }

      // ----------------------------------------------------------
      // ALREADY COMPLETED
      // ----------------------------------------------------------

      if (
        order.status ===
        'COMPLETED'
      ) {
        return res.status(400).json({
          error:
            'Order has already been completed',
        });
      }

      // ----------------------------------------------------------
      // TRANSPORT REQUIRED
      // ----------------------------------------------------------

      if (!order.transportJob) {
        return res.status(400).json({
          error:
            'No transport record exists for this order',
        });
      }

      // ----------------------------------------------------------
      // TRANSPORT MUST BE DELIVERED
      // ----------------------------------------------------------

      if (
        order.transportJob.status !==
        'DELIVERED'
      ) {
        return res.status(400).json({
          error:
            `Receipt cannot be confirmed while transport status is ${order.transportJob.status}`,
        });
      }

      // ----------------------------------------------------------
      // COMPLETE ORDER
      // ----------------------------------------------------------

      const updated =
        await prisma.$transaction(
          async (tx) => {

            /*
             * Re-check the order inside the transaction.
             *
             * This reduces the possibility of two receipt
             * confirmations being processed simultaneously.
             */
            const currentOrder =
              await tx.order.findUnique({
                where: {
                  id:
                    order.id,
                },

                include: {
                  transportJob: true,
                },
              });

            if (!currentOrder) {
              throw new Error(
                'Order no longer exists'
              );
            }

            if (
              currentOrder.buyerId !==
              req.user.id
            ) {
              throw new Error(
                'Only the buyer can confirm receipt'
              );
            }

            if (
              currentOrder.status ===
              'COMPLETED'
            ) {
              throw new Error(
                'Order has already been completed'
              );
            }

            if (
              !currentOrder.transportJob
            ) {
              throw new Error(
                'No transport record exists for this order'
              );
            }

            if (
              currentOrder
                .transportJob
                .status !==
              'DELIVERED'
            ) {
              throw new Error(
                `Receipt cannot be confirmed while transport status is ${currentOrder.transportJob.status}`
              );
            }

            // ----------------------------------------------------
            // COMPLETE ORDER
            // ----------------------------------------------------

            const completedOrder =
              await tx.order.update({
                where: {
                  id:
                    currentOrder.id,
                },

                data: {
                  status:
                    'COMPLETED',
                },

                include: {
                  ...orderInclude,
                },
              });

            return completedOrder;
          }
        );

      return res.json({
        message:
          'Receipt confirmed. Order completed.',

        order:
          updated,
      });
    } catch (error) {
      console.error(
        'PATCH /api/orders/:id/confirm-receipt ERROR:',
        error
      );

      /*
       * Known business-validation errors.
       */
      const knownErrors = [
        'Order no longer exists',
        'Only the buyer can confirm receipt',
        'Order has already been completed',
        'No transport record exists for this order',
      ];

      if (
        knownErrors.includes(
          error.message
        ) ||
        error.message.startsWith(
          'Receipt cannot be confirmed'
        )
      ) {
        return res.status(400).json({
          error:
            error.message,
        });
      }

      return res.status(500).json({
        error:
          'Failed to confirm receipt',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================================
// EXPORT ROUTER
// ============================================================================

module.exports = router;
