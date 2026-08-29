const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

// Buyer makes an offer
router.post(
  '/',
  authenticate,
  requireRole('BUYER'),
  [body('listingId').notEmpty(), body('amount').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { listingId, amount, message } = req.body;
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'ACTIVE') return res.status(400).json({ error: 'Listing is not open for offers' });

    const offer = await prisma.offer.create({
      data: { listingId, buyerId: req.user.id, amount, message },
    });

    await prisma.listing.update({ where: { id: listingId }, data: { status: 'UNDER_NEGOTIATION' } });

    res.status(201).json({ offer });
  }
);

// Seller (farmer only — price authority) counters, accepts, or rejects
router.patch('/:id', authenticate, requireRole('SELLER'), async (req, res) => {
  const { action, counterAmount } = req.body; // action: 'ACCEPT' | 'REJECT' | 'COUNTER'
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (offer.listing.sellerId !== req.user.id) {
    return res.status(403).json({ error: 'Only the farmer who owns this listing can respond to offers' });
  }

  if (action === 'ACCEPT') {
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
