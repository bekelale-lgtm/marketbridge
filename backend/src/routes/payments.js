const express = require('express');
const { body, validationResult } = require('express-validator');

const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();


// ============================================================
// HELPERS
// ============================================================

function isAdmin(user) {
  return (
    Array.isArray(user.roles) &&
    user.roles.includes('ADMIN')
  );
}


// ============================================================
// CREATE PAYMENT
//
// POST /api/payments
//
// Payment types:
//
// MARKETPLACE
// TRANSPORT
// INSPECTOR
// ADVERTISING
//
// Important:
// Creating a payment record does NOT mean the payment has
// actually been received.
//
// Initial status:
// PENDING
//
// Actual Telebirr/CBE/QR verification should eventually be
// performed by an authorized confirmation/webhook process.
// ============================================================

router.post(
  '/',
  authenticate,
  [
    body('type')
      .isIn([
        'MARKETPLACE',
        'TRANSPORT',
        'INSPECTOR',
        'ADVERTISING',
      ])
      .withMessage('Invalid payment type'),

    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be greater than zero'),

    body('method')
      .isIn([
        'TELEBIRR',
        'CBE',
        'QR',
        'OTHER',
      ])
      .withMessage('Invalid payment method'),

    body('orderId')
      .optional()
      .isString()
      .withMessage('orderId must be a string'),

    body('reference')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Invalid payment reference'),
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
        type,
        amount,
        method,
        reference,
      } = req.body;

      const numericAmount = Number(amount);


      // ========================================================
      // MARKETPLACE / TRANSPORT PAYMENT
      // ========================================================

      if (
        type === 'MARKETPLACE' ||
        type === 'TRANSPORT'
      ) {
        if (!orderId) {
          return res.status(400).json({
            error:
              `${type} payment requires orderId`,
          });
        }

        const order =
          await prisma.order.findUnique({
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


        // ------------------------------------------------------
        // Only buyer or seller connected to order may create
        // the payment record.
        // ------------------------------------------------------

        const isBuyer =
          order.buyerId === req.user.id;

        const isSeller =
          order.sellerId === req.user.id;

        if (!isBuyer && !isSeller && !isAdmin(req.user)) {
          return res.status(403).json({
            error:
              'You are not authorized to create a payment for this order',
          });
        }


        // ------------------------------------------------------
        // MARKETPLACE PAYMENT
        //
        // Buyer is responsible for marketplace purchase payment.
        // ------------------------------------------------------

        if (type === 'MARKETPLACE') {

          if (!isBuyer && !isAdmin(req.user)) {
            return res.status(403).json({
              error:
                'Only the buyer may create the marketplace payment',
            });
          }

          if (
            ![
              'PENDING_PAYMENT',
              'CONFIRMED',
            ].includes(order.status)
          ) {
            return res.status(400).json({
              error:
                `Marketplace payment cannot be created while order is ${order.status}`,
            });
          }

          // Amount must match negotiated final price.
          if (
            Math.abs(
              numericAmount -
              Number(order.finalPrice)
            ) > 0.01
          ) {
            return res.status(400).json({
              error:
                'Marketplace payment amount must match the order final price',
              expectedAmount: Number(order.finalPrice),
              submittedAmount: numericAmount,
            });
          }
        }


        // ------------------------------------------------------
        // TRANSPORT PAYMENT
        //
        // Transport payment is separate from marketplace
        // produce payment.
        //
        // The transport amount is NOT stored on TransportJob
        // in the current Prisma schema, so we do not attempt
        // to compare it here.
        // ------------------------------------------------------

        if (type === 'TRANSPORT') {

          if (!order.transportJob) {
            return res.status(400).json({
              error:
                'A transport job must exist before transport payment can be created',
            });
          }

          // The person arranging transport may create the
          // transport payment.
          const arrangingParty =
            order.arrangingParty;

          if (
            arrangingParty === 'BUYER' &&
            !isBuyer &&
            !isAdmin(req.user)
          ) {
            return res.status(403).json({
              error:
                'Only the buyer may pay for buyer-arranged transport',
            });
          }

          if (
            arrangingParty === 'SELLER' &&
            !isSeller &&
            !isAdmin(req.user)
          ) {
            return res.status(403).json({
              error:
                'Only the seller may pay for seller-arranged transport',
            });
          }

          if (
            arrangingParty === 'JOINT' &&
            !isBuyer &&
            !isSeller &&
            !isAdmin(req.user)
          ) {
            return res.status(403).json({
              error:
                'Only the buyer or seller may pay for joint transport',
            });
          }
        }


        // ------------------------------------------------------
        // Prevent duplicate active payments.
        // ------------------------------------------------------

        const existingPayment =
          await prisma.payment.findFirst({
            where: {
              orderId,
              type,
              status: {
                in: [
                  'PENDING',
                  'PAID',
                ],
              },
            },

            orderBy: {
              createdAt: 'desc',
            },
          });

        if (existingPayment) {
          return res.status(409).json({
            error:
              `An active ${type} payment already exists for this order`,
            payment: existingPayment,
          });
        }
      }


      // ========================================================
      // NON-ORDER PAYMENTS
      //
      // INSPECTOR
      // ADVERTISING
      //
      // Current schema allows these payments without orderId.
      // ========================================================

      if (
        type === 'INSPECTOR' ||
        type === 'ADVERTISING'
      ) {
        if (orderId) {
          return res.status(400).json({
            error:
              `${type} payment should not use orderId in the current payment model`,
          });
        }

        // These payments may currently be created by an
        // authenticated user. Later, if you add direct
        // inspector/advertisement foreign keys to Payment,
        // authorization can be made more specific.
      }


      // ========================================================
      // CREATE PAYMENT
      // ========================================================

      const payment =
        await prisma.payment.create({
          data: {
            orderId: orderId || null,

            type,

            amount: numericAmount,

            method,

            reference:
              reference || null,

            status: 'PENDING',
          },
        });


      return res.status(201).json({
        message:
          'Payment record created. Payment is awaiting confirmation.',

        payment,

        paymentConfirmed: false,
      });

    } catch (error) {
      console.error(
        'CREATE PAYMENT ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not create payment',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================
// CONFIRM PAYMENT
//
// PATCH /api/payments/:id/confirm
//
// SECURITY:
// Only ADMIN can confirm a payment.
//
// This endpoint represents manual/admin verification.
// It should later be replaced or supplemented by official
// Telebirr/CBE webhook verification.
//
// IMPORTANT:
// Only MARKETPLACE payment confirmation changes the order
// from PENDING_PAYMENT -> CONFIRMED.
//
// TRANSPORT payment does NOT confirm the produce order.
// ============================================================

router.patch(
  '/:id/confirm',
  authenticate,
  async (req, res) => {
    try {

      if (!isAdmin(req.user)) {
        return res.status(403).json({
          error:
            'Only an administrator can confirm payments',
        });
      }


      const payment =
        await prisma.payment.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            order: true,
          },
        });


      if (!payment) {
        return res.status(404).json({
          error: 'Payment not found',
        });
      }


      // --------------------------------------------------------
      // Prevent invalid state changes.
      // --------------------------------------------------------

      if (payment.status === 'PAID') {
        return res.status(400).json({
          error:
            'Payment has already been confirmed',
          payment,
        });
      }

      if (payment.status === 'REFUNDED') {
        return res.status(400).json({
          error:
            'A refunded payment cannot be confirmed',
        });
      }


      if (payment.status === 'FAILED') {
        return res.status(400).json({
          error:
            'A failed payment must be recreated before confirmation',
        });
      }


      // ========================================================
      // CONFIRM PAYMENT + UPDATE ORDER ATOMICALLY
      // ========================================================

      const result =
        await prisma.$transaction(
          async (tx) => {

            const updatedPayment =
              await tx.payment.update({
                where: {
                  id: payment.id,
                },

                data: {
                  status: 'PAID',
                },
              });


            let updatedOrder = null;


            // --------------------------------------------------
            // MARKETPLACE PAYMENT
            //
            // Payment confirms purchase.
            // Transport is NOT automatically created.
            // --------------------------------------------------

            if (
              payment.type === 'MARKETPLACE' &&
              payment.orderId
            ) {

              updatedOrder =
                await tx.order.update({
                  where: {
                    id: payment.orderId,
                  },

                  data: {
                    status: 'CONFIRMED',
                  },
                });
            }


            // --------------------------------------------------
            // TRANSPORT PAYMENT
            //
            // Do NOT change order status.
            //
            // Transport status is controlled by transport.js.
            // --------------------------------------------------

            if (
              payment.type === 'TRANSPORT' &&
              payment.orderId
            ) {
              // Intentionally no order status change.
            }


            return {
              payment:
                updatedPayment,

              order:
                updatedOrder,
            };
          }
        );


      return res.json({
        message:
          'Payment confirmed successfully',

        payment:
          result.payment,

        order:
          result.order,

        transportAutomaticallyAssigned:
          false,
      });

    } catch (error) {
      console.error(
        'CONFIRM PAYMENT ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not confirm payment',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================
// GET PAYMENTS FOR ORDER
//
// GET /api/payments/order/:orderId
//
// Buyer and seller can see payments for their order.
// Admin can see all.
// ============================================================

router.get(
  '/order/:orderId',
  authenticate,
  async (req, res) => {
    try {

      const order =
        await prisma.order.findUnique({
          where: {
            id: req.params.orderId,
          },
        });


      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
        });
      }


      const isBuyer =
        order.buyerId === req.user.id;

      const isSeller =
        order.sellerId === req.user.id;

      const admin =
        isAdmin(req.user);


      if (!isBuyer && !isSeller && !admin) {
        return res.status(403).json({
          error:
            'You are not authorized to view payments for this order',
        });
      }


      const payments =
        await prisma.payment.findMany({
          where: {
            orderId: req.params.orderId,
          },

          orderBy: {
            createdAt: 'desc',
          },
        });


      return res.json({
        payments,
        count: payments.length,
      });

    } catch (error) {
      console.error(
        'GET ORDER PAYMENTS ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not load order payments',
      });
    }
  }
);


// ============================================================
// GET SINGLE PAYMENT
//
// GET /api/payments/:id
//
// Buyer/seller connected to the payment's order or admin.
// ============================================================

router.get(
  '/:id',
  authenticate,
  async (req, res) => {
    try {

      const payment =
        await prisma.payment.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            order: true,
          },
        });


      if (!payment) {
        return res.status(404).json({
          error: 'Payment not found',
        });
      }


      // Non-order payments currently have no owner relation
      // in the Prisma schema, therefore only ADMIN can inspect
      // them through this endpoint.

      if (!payment.order) {

        if (!isAdmin(req.user)) {
          return res.status(403).json({
            error:
              'Only an administrator can view this payment',
          });
        }

      } else {

        const isBuyer =
          payment.order.buyerId === req.user.id;

        const isSeller =
          payment.order.sellerId === req.user.id;

        if (
          !isBuyer &&
          !isSeller &&
          !isAdmin(req.user)
        ) {
          return res.status(403).json({
            error:
              'You are not authorized to view this payment',
          });
        }
      }


      return res.json({
        payment,
      });

    } catch (error) {
      console.error(
        'GET PAYMENT ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not load payment',
      });
    }
  }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;
