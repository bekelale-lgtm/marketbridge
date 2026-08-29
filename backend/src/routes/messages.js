const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, [body('receiverId').notEmpty(), body('content').notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { receiverId, content, orderId } = req.body;
  const message = await prisma.message.create({
    data: { senderId: req.user.id, receiverId, content, orderId },
  });
  res.status(201).json({ message });
});

router.get('/thread/:userId', authenticate, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.user.id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ messages });
});

module.exports = router;
