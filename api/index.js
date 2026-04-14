const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const contactRoutes = require('../routes/contact');
const adminRoutes = require('../routes/admin');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (public/)
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting for the contact API
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' }
});

// ── Public content API ────────────────────────────────────────
// GET /api/content — returns website content from Supabase
app.get('/api/content', async (req, res) => {
  try {
    const sbRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/content?id=eq.1&select=data`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const rows = await sbRes.json();
    res.json(rows.length ? rows[0].data : { text: {}, images: {}, doctors: [], services: [], testimonials: [] });
  } catch {
    res.json({ text: {}, images: {}, doctors: [], services: [], testimonials: [] });
  }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/contact', contactLimiter, contactRoutes);

// Admin panel — pages at /admin and /admin/login
// Admin API at /api/admin/*  (but mounted as /admin/api/* in the router)
app.use('/admin', adminRoutes);

// Rewrite /api/admin/* → admin router handles it as /api/*
// The admin router defines routes like router.get('/api/content', ...)
// which Express mounts as /admin/api/content — matches /api/admin/...? No.
// Actually we need /api/admin/* to also hit the admin router.
// Let's add a second mount:
app.use('/api/admin', (req, res, next) => {
  // Rewrite path so the admin router sees /api/...
  req.url = '/api' + req.url;
  adminRoutes(req, res, next);
});

// Serve main site for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
