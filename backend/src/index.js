require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const offerRoutes = require('./routes/offers');
const inspectionRoutes = require('./routes/inspections');
const transportRoutes = require('./routes/transport');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const adRoutes = require('./routes/ads');
const disputeRoutes = require('./routes/disputes');
const ratingRoutes = require('./routes/ratings');
const digitalRoutes = require('./routes/digital');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'marketbridge-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/digital-products', digitalRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MarketBridge API listening on port ${PORT}`));
