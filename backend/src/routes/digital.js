const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

router.get('/', async (req, res) => {
  const { productType, search } = req.query;
  const products = await prisma.digitalProduct.findMany({
    where: {
      status: 'ACTIVE',
      ...(productType && { productType }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    },
    include: { seller: { select: { id: true, name: true, rating: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ products });
});

router.post(
  '/',
  authenticate,
  requireRole('SELLER'),
  [body('title').notEmpty(), body('productType').notEmpty(), body('price').isFloat({ gt: 0 }), body('fileUrl').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, productType, price, fileUrl, description } = req.body;
    // Independent sellers retain ownership; MarketBridge only facilitates
    const product = await prisma.digitalProduct.create({
      data: { sellerId: req.user.id, title, productType, price, fileUrl, description },
    });
    res.status(201).json({ product });
  }
);

module.exports = router;
