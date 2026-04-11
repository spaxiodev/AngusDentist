const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { queries } = require('../db/database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
const VIEWS_DIR = path.join(__dirname, '../views/admin');

// GET /admin/login — serve login page
router.get('/login', (req, res) => {
  const token = req.cookies?.admin_token;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      return res.redirect('/admin');
    } catch {}
  }
  res.sendFile(path.join(VIEWS_DIR, 'login.html'));
});

// POST /admin/login — authenticate
router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (
    username === (process.env.ADMIN_USERNAME || 'admin') &&
    password === (process.env.ADMIN_PASSWORD || 'admin123')
  ) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/admin/login');
});

// GET /admin — serve dashboard
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'index.html'));
});

// --- API routes (all protected) ---

// GET /admin/api/stats
router.get('/api/stats', requireAuth, async (req, res) => {
  try {
    res.json(await queries.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/submissions?status=new|contacted|resolved|all
router.get('/api/submissions', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const submissions = await queries.getAll(status);
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/submissions/:id
router.get('/api/submissions/:id', requireAuth, async (req, res) => {
  try {
    const submission = await queries.getById(parseInt(req.params.id));
    if (!submission) return res.status(404).json({ error: 'Not found' });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/api/submissions/:id
router.patch('/api/submissions/:id', requireAuth, express.json(), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const id = parseInt(req.params.id);
    const existing = await queries.getById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await queries.updateStatus(id, status || existing.status, notes !== undefined ? notes : existing.notes);
    await queries.logAction('update_status', id, req.adminUser, `Status: ${status}, Notes: ${notes}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/api/submissions/:id
router.delete('/api/submissions/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await queries.getById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await queries.delete(id);
    await queries.logAction('delete', id, req.adminUser, `Deleted: ${existing.first_name} ${existing.last_name}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Site Content API (inline editor) ---

// GET /admin/api/content
router.get('/api/content', requireAuth, async (req, res) => {
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

// POST /admin/api/content
router.post('/api/content', requireAuth, express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { changes } = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Invalid changes payload' });
    }
    for (const [key, entry] of Object.entries(changes)) {
      if (typeof key !== 'string' || key.length > 500) continue;
      await queries.setContent(key, entry.value, entry.type || 'text');
    }
    await queries.logAction('edit_site', null, req.adminUser, `Updated ${Object.keys(changes).length} content items`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/upload — upload an image
router.post('/api/upload', requireAuth, express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !filename) {
      return res.status(400).json({ error: 'Missing data or filename' });
    }

    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (!data.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    // On Vercel (no persistent filesystem), return the data URL directly
    if (process.env.VERCEL === '1') {
      return res.json({ url: data });
    }

    // Local dev: save to disk
    const matches = data.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const safeName = crypto.randomBytes(8).toString('hex') + ext;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, Buffer.from(matches[1], 'base64'));

    res.json({ url: `/uploads/${safeName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
