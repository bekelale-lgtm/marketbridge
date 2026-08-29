const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [
    body('orderId').notEmpty(),
    body('toUserId').notEmpty(),
    body('role').isIn(['SELLER', 'BUYER', 'INSPECTOR', 'TRUCK_OWNER']),
    body('score').isInt({ min: 1, max: 5 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { orderId, toUserId, role, score, comment } = req.body;
    const rating = await prisma.rating.create({
      data: { orderId, fromUserId: req.user.id, toUserId, role, score, comment },
    });

    // Recalculate the recipient's average rating
    const all = await prisma.rating.findMany({ where: { toUserId } });
    const avg = all.reduce((sum, r) => sum + r.score, 0) / all.length;
    await prisma.user.update({ where: { id: toUserId }, data: { rating: avg } });

    res.status(201).json({ rating });
  }
);

router.get('/user/:userId', async (req, res) => {
  const ratings = await prisma.rating.findMany({
    where: { toUserId: req.params.userId },
    include: { fromUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ratings });
});

module.exports = router;
