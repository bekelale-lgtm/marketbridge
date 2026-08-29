const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
    include: { listing: true, transportJob: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});

router.get('/:id', authenticate, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      listing: true,
      buyer: { select: { id: true, name: true, rating: true } },
      seller: { select: { id: true, name: true, rating: true } },
      transportJob: true,
      payments: true,
      disputes: true,
      ratings: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.user.id && order.sellerId !== req.user.id && !req.user.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Not authorized to view this order' });
  }
  res.json({ order });
});

// Buyer confirms receipt — final step before ratings/records
router.patch('/:id/confirm-receipt', authenticate, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyerId !== req.user.id) return res.status(403).json({ error: 'Only the buyer can confirm receipt' });

  const updated = await prisma.order.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } });
  res.json({ order: updated });
});

module.exports = router;
