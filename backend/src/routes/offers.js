const express = require('express');
const { body, validationResult } = require('express-validator');

const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();


// ============================================================
// BUYER MAKES AN OFFER
// ============================================================

router.post(
  '/',
  authenticate,
  requireRole('BUYER'),
  [
    body('listingId')
      .notEmpty()
      .withMessage('listingId is required'),

    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be greater than zero'),

    body('message')
      .optional()
      .isString()
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

      const {
        listingId,
        amount,
        message,
      } = req.body;

      const listing = await prisma.listing.findUnique({
        where: {
          id: listingId,
        },
      });

      if (!listing) {
        return res.status(404).json({
          error: 'Listing not found',
        });
      }

      if (listing.status !== 'ACTIVE') {
        return res.status(400).json({
          error: 'Listing is not open for offers',
        });
      }

      if (listing.sellerId === req.user.id) {
        return res.status(403).json({
          error: 'You cannot make an offer on your own listing',
        });
      }

      const offer = await prisma.offer.create({
        data: {
          listingId,
          buyerId: req.user.id,
          amount: Number(amount),
          message: message || null,
        },
      });

      await prisma.listing.update({
        where: {
          id: listingId,
        },

        data: {
          status: 'UNDER_NEGOTIATION',
        },
      });

      return res.status(201).json({
        message: 'Offer submitted successfully',
        offer,
      });

    } catch (error) {
      console.error('CREATE OFFER ERROR:', error);

      return res.status(500).json({
        error: 'Could not create offer',
        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================
// BUYER — MY OFFERS
// ============================================================

router.get(
  '/mine',
  authenticate,
  async (req, res) => {
    try {
      const offers = await prisma.offer.findMany({
        where: {
          buyerId: req.user.id,
        },

        include: {
          listing: true,
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        offers,
        count: offers.length,
      });

    } catch (error) {
      console.error('MY OFFERS ERROR:', error);

      return res.status(500).json({
        error: 'Could not load your offers',
      });
    }
  }
);


// ============================================================
// SELLER — RESPOND TO OFFER
//
// Actions:
// ACCEPT
// REJECT
// COUNTER
//
// Seller is the price authority.
// ============================================================

router.patch(
  '/:id',
  authenticate,
  requireRole('SELLER'),
  async (req, res) => {
    try {
      const {
        action,
        counterAmount,
      } = req.body;

      if (
        !['ACCEPT', 'REJECT', 'COUNTER'].includes(action)
      ) {
        return res.status(400).json({
          error:
            'Invalid action. Use ACCEPT, REJECT, or COUNTER.',
        });
      }

      const offer = await prisma.offer.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          listing: true,
        },
      });

      if (!offer) {
        return res.status(404).json({
          error: 'Offer not found',
        });
      }

      // Only the seller who owns the listing can respond.
      if (
        offer.listing.sellerId !== req.user.id
      ) {
        return res.status(403).json({
          error:
            'Only the farmer who owns this listing can respond to offers',
        });
      }

      // --------------------------------------------------------
      // ACCEPT
      // --------------------------------------------------------

      if (action === 'ACCEPT') {

        if (
          !['PENDING', 'COUNTERED'].includes(
            offer.status
          )
        ) {
          return res.status(400).json({
            error:
              `Offer cannot be accepted because it is ${offer.status}`,
          });
        }

        // If the seller previously countered,
        // the counter price becomes the final price.
        const finalPrice =
          offer.status === 'COUNTERED' &&
          offer.counterAmount !== null &&
          offer.counterAmount !== undefined
            ? offer.counterAmount
            : offer.amount;

        const result = await prisma.$transaction(
          async (tx) => {

            const updatedOffer =
              await tx.offer.update({
                where: {
                  id: offer.id,
                },

                data: {
                  status: 'ACCEPTED',
                },
              });

            // Reject all other pending/countered offers.
            await tx.offer.updateMany({
              where: {
                listingId: offer.listingId,

                id: {
                  not: offer.id,
                },

                status: {
                  in: [
                    'PENDING',
                    'COUNTERED',
                  ],
                },
              },

              data: {
                status: 'REJECTED',
              },
            });

            // Listing becomes sold/reserved.
            await tx.listing.update({
              where: {
                id: offer.listingId,
              },

              data: {
                status: 'SOLD',
              },
            });

            // Create the marketplace order.
            const order =
              await tx.order.create({
                data: {
                  listingId: offer.listingId,

                  buyerId: offer.buyerId,

                  sellerId: req.user.id,

                  finalPrice,

                  status: 'PENDING_PAYMENT',
                },
              });

            return {
              offer: updatedOffer,
              order,
            };
          }
        );

        return res.json({
          message:
            'Offer accepted and order created successfully',

          offer: result.offer,

          order: result.order,
        });
      }


      // --------------------------------------------------------
      // REJECT
      // --------------------------------------------------------

      if (action === 'REJECT') {

        if (
          !['PENDING', 'COUNTERED'].includes(
            offer.status
          )
        ) {
          return res.status(400).json({
            error:
              `Offer cannot be rejected because it is ${offer.status}`,
          });
        }

        const updated =
          await prisma.offer.update({
            where: {
              id: offer.id,
            },

            data: {
              status: 'REJECTED',
            },
          });

        return res.json({
          message: 'Offer rejected',
          offer: updated,
        });
      }


      // --------------------------------------------------------
      // COUNTER
      // --------------------------------------------------------

      if (action === 'COUNTER') {

        if (
          counterAmount === undefined ||
          counterAmount === null ||
          !Number.isFinite(Number(counterAmount)) ||
          Number(counterAmount) <= 0
        ) {
          return res.status(400).json({
            error:
              'counterAmount must be greater than zero',
          });
        }

        if (
          !['PENDING', 'COUNTERED'].includes(
            offer.status
          )
        ) {
          return res.status(400).json({
            error:
              `Offer cannot be countered because it is ${offer.status}`,
          });
        }

        const updated =
          await prisma.offer.update({
            where: {
              id: offer.id,
            },

            data: {
              status: 'COUNTERED',

              counterAmount:
                Number(counterAmount),
            },
          });

        return res.json({
          message: 'Counter-offer submitted',
          offer: updated,
        });
      }

    } catch (error) {
      console.error(
        'RESPOND TO OFFER ERROR:',
        error
      );

      return res.status(500).json({
        error: 'Could not respond to offer',

        details:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined,
      });
    }
  }
);


// ============================================================
// GET OFFERS FOR A LISTING
//
// Seller can see offers for their own listing.
// Buyer can see offers for a listing if they have made one.
// Admin can see all.
// ============================================================

router.get(
  '/listing/:listingId',
  authenticate,
  async (req, res) => {
    try {

      const listing =
        await prisma.listing.findUnique({
          where: {
            id: req.params.listingId,
          },
        });

      if (!listing) {
        return res.status(404).json({
          error: 'Listing not found',
        });
      }

      const isSeller =
        listing.sellerId === req.user.id;

      const isAdmin =
        req.user.roles?.includes('ADMIN');

      const isBuyer =
        req.user.roles?.includes('BUYER');

      if (!isSeller && !isAdmin && !isBuyer) {
        return res.status(403).json({
          error: 'Not authorized to view these offers',
        });
      }

      const offers =
        await prisma.offer.findMany({
          where: {
            listingId: req.params.listingId,
          },

          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                rating: true,
                verificationStatus: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },
        });

      return res.json({
        offers,
        count: offers.length,
      });

    } catch (error) {
      console.error(
        'GET LISTING OFFERS ERROR:',
        error
      );

      return res.status(500).json({
        error: 'Could not load listing offers',
      });
    }
  }
);


module.exports = router;
