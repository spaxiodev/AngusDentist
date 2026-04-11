require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const { initDb } = require('./db/database');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// Rate limiting for the contact API
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' }
});

// Public API: site content for the inline editor
const { queries } = require('./db/database');
app.get('/api/content', (req, res) => {
  try {
    const rows = queries.getAllContent();
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

// Serve main site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Init DB then start server
initDb();
app.listen(PORT, () => {
  console.log(`\n🦷  Clinique Dentaire Angus`);
  console.log(`    Server: http://localhost:${PORT}`);
  console.log(`    Admin:  http://localhost:${PORT}/admin\n`);
});
