const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const VIEWS_DIR = path.join(__dirname, '../views/admin');
const CONTENT_FILE = path.join(__dirname, '../db/content.json');
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

function readContent() {
  try {
    return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  } catch {
    return { text: {}, images: {}, doctors: [], services: [], testimonials: [] };
  }
}

function writeContent(data) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Page routes ─────────────────────────────────────────────

// GET /admin/login
router.get('/login', (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'login.html'));
});

// GET /admin — serve admin panel (auth checked client-side via localStorage JWT)
router.get('/', (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'index.html'));
});

// ── Auth API ─────────────────────────────────────────────────

// POST /api/admin/login
router.post('/api/login', express.json(), (req, res) => {
  const { username, password } = req.body || {};
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'angus2024';

  if (username === validUser && password === validPass) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// POST /api/admin/logout  (just confirmation — client drops token)
router.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ── Content API ──────────────────────────────────────────────

// GET /api/admin/content — full content (protected)
router.get('/api/content', requireAuth, (req, res) => {
  res.json(readContent());
});

// PUT /api/admin/content — save full content (protected)
router.put('/api/content', requireAuth, express.json({ limit: '20mb' }), (req, res) => {
  try {
    const current = readContent();
    const incoming = req.body;

    // Merge carefully: only overwrite known top-level keys
    if (incoming.text && typeof incoming.text === 'object') current.text = incoming.text;
    if (incoming.images && typeof incoming.images === 'object') current.images = incoming.images;
    if (Array.isArray(incoming.doctors)) current.doctors = incoming.doctors;
    if (Array.isArray(incoming.services)) current.services = incoming.services;
    if (Array.isArray(incoming.testimonials)) current.testimonials = incoming.testimonials;

    writeContent(current);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Image Upload API ─────────────────────────────────────────

// POST /api/admin/upload — upload image as base64 (protected)
router.post('/api/upload', requireAuth, express.json({ limit: '20mb' }), (req, res) => {
  try {
    const { data, filename } = req.body || {};
    if (!data || !filename) return res.status(400).json({ error: 'Missing data or filename' });

    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'Invalid file type' });

    if (!data.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });

    // On Vercel (read-only FS), return the data URL directly so it can be embedded
    if (process.env.VERCEL === '1') {
      return res.json({ url: data });
    }

    // Local dev: save to /public/uploads/
    const matches = data.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid base64 data' });

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const safeName = crypto.randomBytes(8).toString('hex') + ext;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, Buffer.from(matches[1], 'base64'));

    res.json({ url: `/uploads/${safeName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/upload/:filename — delete uploaded image (protected)
router.delete('/api/upload/:filename', requireAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
