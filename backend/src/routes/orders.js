// backend/src/routes/orders.js
//
// MarketBridge — Order Routes
//
// Rules:
// - Buyer and seller can view their orders.
// - Admin can view any order.
// - Buyer confirms receipt only after transport reaches DELIVERED.
// - Transport details include selected truck/transporter and quotes.
// - OWN_TRUCK does not create a transporter commission.
// - HIRE_TRANSPORTER uses the TransportQuote workflow.

const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();


// ============================================================================
// COMMON TRANSPORT INCLUDE
// ============================================================================

const transportInclude = {
  truckOwner: {
    select: {
      id: true,
      name: true,
      phone: true,
      rating: true,
      verificationStatus: true,
    },
  },

  truck: {
    select: {
      id: true,
      registration: true,
      truckType: true,
      capacity: true,
      operatingArea: true,
      availability: true,
      verificationStatus: true,
      rating: true,
    },
  },

  quotes: {
    include: {
      truckOwner: {
        select: {
          id: true,
          name: true,
          phone: true,
          rating: true,
          verificationStatus: true,
        },
      },

      truck: {
        select: {
          id: true,
          registration: true,
          truckType: true,
          capacity: true,
          operatingArea: true,
          availability: true,
          verificationStatus: true,
          rating: true,
        },
      },
    },

    orderBy: {
      amount: 'asc',
    },
  },
};


// ============================================================================
// GET CURRENT USER ORDERS
// ============================================================================

router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.roles?.includes('ADMIN');

    const orders = await prisma.order.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { buyerId: req.user.id },
              { sellerId: req.user.id },
            ],
          },

      include: {
        listing: true,

        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        transportJob: {
          include: transportInclude,
        },

        payments: true,
        disputes: true,
        ratings: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);

    return res.status(500).json({
      error: 'Failed to load orders',
    });
  }
});


// ============================================================================
// GET SINGLE ORDER
// ============================================================================

router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id,
      },

      include: {
        listing: true,

        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            rating: true,
            verificationStatus: true,
          },
        },

        transportJob: {
          include: transportInclude,
        },

        payments: true,
        disputes: true,
        ratings: true,

        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;
    const isAdmin = req.user.roles?.includes('ADMIN');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        error: 'Not authorized to view this order',
      });
    }

    return res.json({ order });
  } catch (error) {
    console.error('GET /api/orders/:id error:', error);

    return res.status(500).json({
      error: 'Failed to load order',
    });
  }
});


// ============================================================================
// BUYER CONFIRMS RECEIPT
// ============================================================================
//
// Required:
//
// TRANSPORT DELIVERED
//        ↓
// BUYER CONFIRMS RECEIPT
//        ↓
// ORDER COMPLETED
//
// ============================================================================

router.patch('/:id/confirm-receipt', authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id,
      },

      include: {
        transportJob: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    if (order.buyerId !== req.user.id) {
      return res.status(403).json({
        error: 'Only the buyer can confirm receipt',
      });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({
        error: 'Order has already been completed',
      });
    }

    if (!order.transportJob) {
      return res.status(400).json({
        error: 'No transport record exists for this order',
      });
    }

    if (order.transportJob.status !== 'DELIVERED') {
      return res.status(400).json({
        error:
          `Receipt cannot be confirmed while transport status is ${order.transportJob.status}`,
      });
    }

    const updated = await prisma.order.update({
      where: {
        id: order.id,
      },

      data: {
        status: 'COMPLETED',
      },

      include: {
        listing: true,

        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
          },
        },

        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
          },
        },

        transportJob: {
          include: transportInclude,
        },

        payments: true,
      },
    });

    return res.json({
      message: 'Receipt confirmed. Order completed.',
      order: updated,
    });
  } catch (error) {
    console.error(
      'PATCH /api/orders/:id/confirm-receipt error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to confirm receipt',
    });
  }
});


module.exports = router;
      return res.status(500).json({
        error: 'Failed to confirm receipt',
      });
    }
  }
);


module.exports = router;
