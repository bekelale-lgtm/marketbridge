const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [
    body('type').isIn(['FEATURED_LISTING', 'TOP_OF_CATEGORY', 'SPONSORED_SEARCH', 'BANNER', 'TELEGRAM_PROMOTION']),
    body('startDate').notEmpty(),
    body('endDate').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { type, listingId, startDate, endDate, amountPaid } = req.body;
    const ad = await prisma.advertisement.create({
      data: {
        advertiserId: req.user.id,
        type,
        listingId: listingId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        amountPaid,
        status: 'PENDING', // admin approves before it goes ACTIVE
      },
    });
    res.status(201).json({ ad });
  }
);

router.get('/active', async (req, res) => {
  const now = new Date();
  const ads = await prisma.advertisement.findMany({
    where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } },
    include: { listing: true },
  });
  res.json({ ads });
});

// Admin approves/rejects
router.patch('/:id/status', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { status } = req.body; // ACTIVE | REJECTED | EXPIRED
  const ad = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status } });
  res.json({ ad });
});

module.exports = router;
