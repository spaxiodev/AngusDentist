const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { queries } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

// GET /admin/login — serve login page
router.get('/login', (req, res) => {
  if (req.session.adminAuthenticated) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

// POST /admin/login — authenticate
router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (
    username === (process.env.ADMIN_USERNAME || 'admin') &&
    password === (process.env.ADMIN_PASSWORD || 'admin123')
  ) {
    req.session.adminAuthenticated = true;
    req.session.adminUser = username;
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// GET /admin — serve dashboard
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// --- API routes (all protected) ---

// GET /admin/api/stats
router.get('/api/stats', requireAuth, (req, res) => {
  try {
    res.json(queries.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/submissions?status=new|contacted|resolved|all
router.get('/api/submissions', requireAuth, (req, res) => {
  try {
    const { status } = req.query;
    const submissions = queries.getAll(status);
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/submissions/:id
router.get('/api/submissions/:id', requireAuth, (req, res) => {
  try {
    const submission = queries.getById(parseInt(req.params.id));
    if (!submission) return res.status(404).json({ error: 'Not found' });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/api/submissions/:id
router.patch('/api/submissions/:id', requireAuth, express.json(), (req, res) => {
  try {
    const { status, notes } = req.body;
    const id = parseInt(req.params.id);
    const existing = queries.getById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    queries.updateStatus(id, status || existing.status, notes !== undefined ? notes : existing.notes);
    queries.logAction('update_status', id, req.session.adminUser, `Status: ${status}, Notes: ${notes}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/api/submissions/:id
router.delete('/api/submissions/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = queries.getById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    queries.delete(id);
    queries.logAction('delete', id, req.session.adminUser, `Deleted: ${existing.first_name} ${existing.last_name}`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Site Content API (inline editor) ---

// GET /admin/api/content — get all saved content
router.get('/api/content', requireAuth, (req, res) => {
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

// POST /admin/api/content — save all content changes
router.post('/api/content', requireAuth, express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { changes } = req.body;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'Invalid changes payload' });
    }
    for (const [key, entry] of Object.entries(changes)) {
      if (typeof key !== 'string' || key.length > 500) continue;
      queries.setContent(key, entry.value, entry.type || 'text');
    }
    queries.logAction('edit_site', null, req.session.adminUser, `Updated ${Object.keys(changes).length} content items`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/upload — upload an image (base64)
router.post('/api/upload', requireAuth, express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !filename) {
      return res.status(400).json({ error: 'Missing data or filename' });
    }

    // Validate file extension
    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Extract base64 content
    const matches = data.match(/^data:image\/\w+;base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }

    // Ensure uploads dir exists
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
