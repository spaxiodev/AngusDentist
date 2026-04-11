require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { ensureDb, queries } = require('../db/database');
const contactRoutes = require('../routes/contact');
const adminRoutes = require('../routes/admin');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting for the contact API
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' }
});

// Ensure DB is initialized before handling requests
let dbReady = false;
app.use(async (req, res, next) => {
  if (!dbReady) {
    await ensureDb();
    dbReady = true;
  }
  next();
});

// Public API: site content for the inline editor
app.get('/api/content', async (req, res) => {
  try {
    const rows = await queries.getAllContent();
    const content = {};
    for (const row of rows) {
      content[row.key] = { value: row.value, type: row.type };
    }
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.use('/api/contact', contactLimiter, contactRoutes);
app.use('/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
