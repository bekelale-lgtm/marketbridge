const express = require('express');
const { body, validationResult } = require('express-validator');

const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| BUYER — Make an offer
|--------------------------------------------------------------------------
|
| Buyer submits an offer against an ACTIVE agricultural listing.
|
*/

router.post(
  '/',
  authenticate,
  requireRole('BUYER'),
  [
    body('listingId')
      .trim()
      .notEmpty()
      .withMessage('listingId is required'),

    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be greater than 0'),

    body('message')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('message is too long'),
  ],
  async (req, res) => {
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

    // Seller cannot make an offer on their own listing.
    if (listing.sellerId === req.user.id) {
      return res.status(403).json({
        error: 'You cannot make an offer on your own listing',
      });
    }

    // Prevent another active offer from the same buyer
    // on the same listing.
    const existingOffer = await prisma.offer.findFirst({
      where: {
        listingId,
        buyerId: req.user.id,
        status: {
          in: ['PENDING', 'COUNTERED'],
        },
      },
    });

    if (existingOffer) {
      return res.status(409).json({
        error: 'You already have an active offer on this listing',
        offer: existingOffer,
      });
    }

    const offer = await prisma.offer.create({
      data: {
        listingId,
        buyerId: req.user.id,
        amount: Number(amount),
        message: message || null,
        status: 'PENDING',
      },
      include: {
        listing: true,
      },
    });

    // Move listing into negotiation.
    await prisma.listing.update({
      where: {
        id: listingId,
      },
      data: {
        status: 'UNDER_NEGOTIATION',
      },
    });

    return res.status(201).json({
      offer,
    });
  }
);

/*
|--------------------------------------------------------------------------
| BUYER — My offers
|--------------------------------------------------------------------------
*/

router.get(
  '/mine',
  authenticate,
  requireRole('BUYER'),
  async (req, res) => {
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
    });
  }
);

/*
|--------------------------------------------------------------------------
| SELLER — View offers for one of my listings
|--------------------------------------------------------------------------
|
| Only the seller who owns the listing or an ADMIN can see
| all buyer offers for that listing.
|
*/

router.get(
  '/listing/:listingId',
  authenticate,
  async (req, res) => {
    const listing = await prisma.listing.findUnique({
      where: {
        id: req.params.listingId,
      },
      select: {
        id: true,
        sellerId: true,
      },
    });

    if (!listing) {
      return res.status(404).json({
        error: 'Listing not found',
      });
    }

    const isOwner = listing.sellerId === req.user.id;
    const isAdmin =
      Array.isArray(req.user.roles) &&
      req.user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Only the listing seller or an administrator can view these offers',
      });
    }

    const offers = await prisma.offer.findMany({
      where: {
        listingId: req.params.listingId,
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            rating: true,
            phone: true,
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
    });
  }
);

/*
|--------------------------------------------------------------------------
| SELLER — Accept / Reject / Counter
|--------------------------------------------------------------------------
|
| ACCEPT:
|   - Uses counterAmount if one exists
|   - Otherwise uses original amount
|   - Rejects competing active offers
|   - Marks listing SOLD
|   - Creates PENDING_PAYMENT order
|
| REJECT:
|   - Rejects the offer
|
| COUNTER:
|   - Saves seller's counter price
|
*/

router.patch(
  '/:id',
  authenticate,
  requireRole('SELLER'),
  [
    body('action')
      .isIn(['ACCEPT', 'REJECT', 'COUNTER'])
      .withMessage('Invalid action'),

    body('counterAmount')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('counterAmount must be greater than 0'),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      action,
      counterAmount,
    } = req.body;

    const offer = await prisma.offer.findUnique({
      where: {
        id: req.params.id,
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
      },
    });

    if (!offer) {
      return res.status(404).json({
        error: 'Offer not found',
      });
    }

    /*
     * Only the farmer/seller who owns the listing
     * can respond to the offer.
     */
    if (offer.listing.sellerId !== req.user.id) {
      return res.status(403).json({
        error: 'Only the farmer who owns this listing can respond to offers',
      });
    }

    /*
     * Do not allow responses after an offer has already
     * been finalized.
     */
    if (!['PENDING', 'COUNTERED'].includes(offer.status)) {
      return res.status(400).json({
        error: `This offer is already ${offer.status.toLowerCase()}`,
      });
    }

    /*
     * Do not allow accepting an offer for a listing that
     * has already been sold/cancelled.
     */
    if (
      action === 'ACCEPT' &&
      !['ACTIVE', 'UNDER_NEGOTIATION'].includes(offer.listing.status)
    ) {
      return res.status(400).json({
        error: `Listing status ${offer.listing.status} does not allow accepting this offer`,
      });
    }

    /*
     |--------------------------------------------------------------------------
     | COUNTER
     |--------------------------------------------------------------------------
     */

    if (action === 'COUNTER') {
      if (counterAmount === undefined || counterAmount === null) {
        return res.status(400).json({
          error: 'counterAmount is required when sending a counter-offer',
        });
      }

      const updated = await prisma.offer.update({
        where: {
          id: offer.id,
        },
        data: {
          status: 'COUNTERED',
          counterAmount: Number(counterAmount),
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
        },
      });

      return res.json({
        offer: updated,
      });
    }

    /*
     |--------------------------------------------------------------------------
     | REJECT
     |--------------------------------------------------------------------------
     */

    if (action === 'REJECT') {
      const updated = await prisma.offer.update({
        where: {
          id: offer.id,
        },
        data: {
          status: 'REJECTED',
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
        },
      });

      /*
       * If there are no remaining active offers,
       * return the listing to ACTIVE.
       */
      const remainingOffers = await prisma.offer.count({
        where: {
          listingId: offer.listingId,
          status: {
            in: ['PENDING', 'COUNTERED'],
          },
        },
      });

      if (remainingOffers === 0) {
        await prisma.listing.update({
          where: {
            id: offer.listingId,
          },
          data: {
            status: 'ACTIVE',
          },
        });
      }

      return res.json({
        offer: updated,
      });
    }

    /*
     |--------------------------------------------------------------------------
     | ACCEPT
     |--------------------------------------------------------------------------
     */

    if (action === 'ACCEPT') {
      /*
       * IMPORTANT:
       *
       * If the seller has countered the buyer, the counterAmount
       * becomes the final sale price.
       *
       * Otherwise, the original buyer offer is the final price.
       */
      const finalPrice =
        offer.counterAmount !== null &&
        offer.counterAmount !== undefined
          ? Number(offer.counterAmount)
          : Number(offer.amount);

      /*
       * Use a transaction so all related changes succeed/fail
       * together.
       */
      const result = await prisma.$transaction(async (tx) => {
        /*
         * Re-check the listing inside the transaction.
         */
        const currentListing = await tx.listing.findUnique({
          where: {
            id: offer.listingId,
          },
        });

        if (!currentListing) {
          throw new Error('Listing not found');
        }

        if (
          !['ACTIVE', 'UNDER_NEGOTIATION'].includes(
            currentListing.status
          )
        ) {
          throw new Error(
            `Listing is no longer available. Current status: ${currentListing.status}`
          );
        }

        /*
         * Re-check that the offer has not already been finalized.
         */
        const currentOffer = await tx.offer.findUnique({
          where: {
            id: offer.id,
          },
        });

        if (!currentOffer) {
          throw new Error('Offer not found');
        }

        if (!['PENDING', 'COUNTERED'].includes(currentOffer.status)) {
          throw new Error(
            `Offer is already ${currentOffer.status.toLowerCase()}`
          );
        }

        /*
         * Accept selected offer.
         */
        const updatedOffer = await tx.offer.update({
          where: {
            id: offer.id,
          },
          data: {
            status: 'ACCEPTED',
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
          },
        });

        /*
         * Reject all other active offers.
         */
        await tx.offer.updateMany({
          where: {
            listingId: offer.listingId,
            id: {
              not: offer.id,
            },
            status: {
              in: ['PENDING', 'COUNTERED'],
            },
          },
          data: {
            status: 'REJECTED',
          },
        });

        /*
         * Mark agricultural listing as SOLD.
         */
        await tx.listing.update({
          where: {
            id: offer.listingId,
          },
          data: {
            status: 'SOLD',
          },
        });

        /*
         * Create the order.
         *
         * Transport is intentionally NOT created here.
         *
         * Buyer/seller decide how transport is arranged after
         * purchase confirmation/payment.
         */
        const order = await tx.order.create({
          data: {
            listingId: offer.listingId,
            buyerId: offer.buyerId,
            sellerId: req.user.id,
            finalPrice,
            status: 'PENDING_PAYMENT',
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
          },
        });

        return {
          offer: updatedOffer,
          order,
        };
      });

      return res.json(result);
    }

    return res.status(400).json({
      error: 'Invalid action. Use ACCEPT, REJECT, or COUNTER.',
    });
  }
);

module.exports = router;  if (action === 'ACCEPT') {
    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
    // Reject all other pending offers on this listing
    await prisma.offer.updateMany({
      where: { listingId: offer.listingId, id: { not: offer.id }, status: { in: ['PENDING', 'COUNTERED'] } },
      data: { status: 'REJECTED' },
    });
    await prisma.listing.update({ where: { id: offer.listingId }, data: { status: 'SOLD' } });

    const order = await prisma.order.create({
      data: {
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        sellerId: req.user.id,
        finalPrice: updated.amount,
        status: 'PENDING_PAYMENT',
      },
    });

    return res.json({ offer: updated, order });
  }

  if (action === 'REJECT') {
    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'REJECTED' } });
    return res.json({ offer: updated });
  }

  if (action === 'COUNTER') {
    if (!counterAmount) return res.status(400).json({ error: 'counterAmount required' });
    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'COUNTERED', counterAmount },
    });
    return res.json({ offer: updated });
  }

  res.status(400).json({ error: 'Invalid action. Use ACCEPT, REJECT, or COUNTER.' });
});

router.get('/listing/:listingId', authenticate, async (req, res) => {
  const offers = await prisma.offer.findMany({
    where: { listingId: req.params.listingId },
    include: { buyer: { select: { id: true, name: true, rating: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ offers });
});

module.exports = router;
