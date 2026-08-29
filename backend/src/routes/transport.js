const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

const router = express.Router();

// CORE RULE: after purchase confirmation, transport is NOT auto-assigned to
// the buyer. Either seller or buyer (or both, jointly) may arrange it.
// method OWN_TRUCK => no transporter-hiring commission is generated.
router.post(
  '/',
  authenticate,
  requireRole('SELLER', 'BUYER'),
  [
    body('orderId').notEmpty(),
    body('arrangingParty').isIn(['SELLER', 'BUYER', 'JOINT']),
    body('method').isIn(['OWN_TRUCK', 'HIRE_TRANSPORTER']),
    body('pickupLocation').notEmpty(),
    body('destination').notEmpty(),
    body('load').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const order = await prisma.order.findUnique({ where: { id: req.body.orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the buyer or seller on this order may arrange transport' });
    }
    if (order.status !== 'CONFIRMED' && order.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ error: `Order status ${order.status} does not allow arranging transport` });
    }

    const {
      arrangingParty, method, truckOwnerId, truckId, pickupLocation, destination,
      load, requiredCapacity, specialRequirements,
    } = req.body;

    const job = await prisma.transportJob.create({
      data: {
        orderId: order.id,
        arrangingParty,
        method,
        truckOwnerId: method === 'HIRE_TRANSPORTER' ? truckOwnerId : null,
        truckId: truckId || null,
        pickupLocation,
        destination,
        load,
        requiredCapacity,
        specialRequirements,
        status: method === 'OWN_TRUCK' ? 'PICKUP' : 'REQUESTED',
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { arrangingParty, status: 'TRANSPORT_ARRANGED' },
    });

    // No transport-hiring commission when the party uses its own truck —
    // simply do not create a TRANSPORT-type Payment record here.
    res.status(201).json({ transportJob: job });
  }
);

// Transport matching: find registered truck owners by proximity/capacity/type
router.get('/match', authenticate, async (req, res) => {
  const { area, minCapacity, truckType } = req.query;
  const trucks = await prisma.truck.findMany({
    where: {
      availability: 'AVAILABLE',
      ...(area && { operatingArea: { contains: area, mode: 'insensitive' } }),
      ...(truckType && { truckType: { contains: truckType, mode: 'insensitive' } }),
      ...(minCapacity && { capacity: { gte: Number(minCapacity) } }),
    },
    include: { owner: { select: { id: true, name: true, rating: true, phone: true } } },
    orderBy: { rating: 'desc' },
  });
  res.json({ trucks });
});

// Truck owner accepts/quotes a hire request
router.patch('/:id/respond', authenticate, requireRole('TRUCK_OWNER'), async (req, res) => {
  const { action } = req.body; // 'ACCEPT' | 'QUOTE'
  const job = await prisma.transportJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Transport job not found' });

  const status = action === 'QUOTE' ? 'QUOTED' : 'ACCEPTED';
  const updated = await prisma.transportJob.update({
    where: { id: req.params.id },
    data: { status, truckOwnerId: req.user.id },
  });
  res.json({ transportJob: updated });
});

// Status progression: pickup -> in transit -> delivered
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status, incidentNotes } = req.body;
  const validTransitions = ['PICKUP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
  if (!validTransitions.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const job = await prisma.transportJob.findUnique({ where: { id: req.params.id }, include: { order: true } });
  if (!job) return res.status(404).json({ error: 'Transport job not found' });

  const data = { status, ...(incidentNotes && { incidentNotes }) };
  if (status === 'PICKUP') data.pickupConfirmedAt = new Date();
  if (status === 'DELIVERED') data.deliveredConfirmedAt = new Date();

  const updated = await prisma.transportJob.update({ where: { id: req.params.id }, data });

  if (status === 'DELIVERED') {
    await prisma.order.update({ where: { id: job.orderId }, data: { status: 'DELIVERED' } });
  }

  res.json({ transportJob: updated });
});

// Truck owner registers/updates a truck
router.post(
  '/trucks',
  authenticate,
  requireRole('TRUCK_OWNER'),
  [body('registration').notEmpty(), body('truckType').notEmpty(), body('capacity').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { registration, truckType, capacity, operatingArea } = req.body;
    const truck = await prisma.truck.create({
      data: { ownerId: req.user.id, registration, truckType, capacity, operatingArea },
    });
    res.status(201).json({ truck });
  }
);

router.patch('/trucks/:id/availability', authenticate, requireRole('TRUCK_OWNER'), async (req, res) => {
  const { availability } = req.body; // AVAILABLE | BUSY | OFFLINE
  const truck = await prisma.truck.findUnique({ where: { id: req.params.id } });
  if (!truck || truck.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your truck' });
  const updated = await prisma.truck.update({ where: { id: req.params.id }, data: { availability } });
  res.json({ truck: updated });
});

module.exports = router;
