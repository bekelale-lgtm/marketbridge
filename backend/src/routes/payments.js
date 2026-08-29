const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Creates a payment record (Marketplace / Transport / Inspector / Advertising).
// Real gateway integration (Telebirr/CBE API) is stubbed — wire up the
// provider's confirm-webhook to flip status PENDING -> PAID.
router.post(
  '/',
  authenticate,
  [
    body('type').isIn(['MARKETPLACE', 'TRANSPORT', 'INSPECTOR', 'ADVERTISING']),
    body('amount').isFloat({ gt: 0 }),
    body('method').isIn(['TELEBIRR', 'CBE', 'QR', 'OTHER']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId, type, amount, method, reference } = req.body;
    const payment = await prisma.payment.create({
      data: { orderId, type, amount, method, reference, status: 'PENDING' },
    });
    res.status(201).json({ payment });
  }
);

// Stub webhook / manual confirmation endpoint
router.patch('/:id/confirm', authenticate, async (req, res) => {
  const payment = await prisma.payment.update({
    where: { id: req.params.id },
    data: { status: 'PAID' },
  });

  if (payment.orderId) {
    await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } });
  }

  res.json({ payment });
});

router.get('/order/:orderId', authenticate, async (req, res) => {
  const payments = await prisma.payment.findMany({ where: { orderId: req.params.orderId } });
  res.json({ payments });
});

module.exports = router;
