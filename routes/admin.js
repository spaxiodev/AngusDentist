const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const VIEWS_DIR = path.join(__dirname, '../views/admin');
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_CONTENT = { text: {}, images: {}, doctors: [], services: [], testimonials: [] };

async function readContent() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/content?id=eq.1&select=data`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return rows.length ? rows[0].data : DEFAULT_CONTENT;
}

async function writeContent(content) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/content?id=eq.1`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ data: content, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase write failed: ' + err);
  }
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
router.get('/api/content', requireAuth, async (req, res) => {
  try {
    const content = await readContent();
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/content — save full content (protected)
router.put('/api/content', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const current = await readContent();
    const incoming = req.body;

    // Merge carefully: only overwrite known top-level keys
    if (incoming.text && typeof incoming.text === 'object') current.text = incoming.text;
    if (incoming.images && typeof incoming.images === 'object') current.images = incoming.images;
    if (Array.isArray(incoming.doctors)) current.doctors = incoming.doctors;
    if (Array.isArray(incoming.services)) current.services = incoming.services;
    if (Array.isArray(incoming.testimonials)) current.testimonials = incoming.testimonials;

    await writeContent(current);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Image Upload API ─────────────────────────────────────────

// POST /api/admin/upload — upload image as base64 (protected)
router.post('/api/upload', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { data, filename } = req.body || {};
    if (!data || !filename) return res.status(400).json({ error: 'Missing data or filename' });

    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'Invalid file type' });

    if (!data.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });

    const matches = data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid base64 data' });

    const mimeSubtype = matches[1];
    const base64Data = matches[2];
    const safeName = crypto.randomBytes(8).toString('hex') + ext;

    // On Vercel (read-only FS), upload to Supabase Storage
    if (process.env.VERCEL === '1') {
      const buffer = Buffer.from(base64Data, 'base64');
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/uploads/${safeName}`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': `image/${mimeSubtype}`,
          },
          body: buffer,
        }
      );
      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error('Supabase Storage upload failed: ' + err);
      }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/uploads/${safeName}`;
      return res.json({ url: publicUrl });
    }

    // Local dev: save to /public/uploads/
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

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
