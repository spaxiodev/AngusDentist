// Uses Node.js built-in sqlite (node:sqlite) — no native compilation required.
// Requires Node.js >= 22.5.0 (stable in Node 24).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'clinic.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
  }
  return db;
}

function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      phone       TEXT NOT NULL,
      email       TEXT,
      service     TEXT,
      message     TEXT,
      status      TEXT NOT NULL DEFAULT 'new',
      notes       TEXT,
      ip_address  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      action        TEXT NOT NULL,
      submission_id INTEGER,
      admin_user    TEXT,
      details       TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_content (
      "key"       TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'text',
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Database initialized at', DB_PATH);
}

// Submission queries
const queries = {
  insert(data) {
    const stmt = getDb().prepare(`
      INSERT INTO submissions (first_name, last_name, phone, email, service, message, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.firstName, data.lastName, data.phone,
      data.email || null, data.service || null,
      data.message || null, data.ipAddress || null
    );
  },

  getAll(status) {
    const db = getDb();
    if (status && status !== 'all') {
      return db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  },

  updateStatus(id, status, notes) {
    return getDb().prepare(`
      UPDATE submissions
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, notes !== undefined ? notes : null, id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM submissions WHERE id = ?').run(id);
  },

  getStats() {
    const db = getDb();
    const get = (sql, ...args) => db.prepare(sql).get(...args);
    return {
      total:     get("SELECT COUNT(*) as c FROM submissions").c,
      new:       get("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'new').c,
      contacted: get("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'contacted').c,
      resolved:  get("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'resolved').c,
      today:     get("SELECT COUNT(*) as c FROM submissions WHERE date(created_at) = date('now')").c,
    };
  },

  logAction(action, submissionId, adminUser, details) {
    return getDb().prepare(`
      INSERT INTO admin_log (action, submission_id, admin_user, details)
      VALUES (?, ?, ?, ?)
    `).run(action, submissionId, adminUser, details);
  },

  // Site content (inline editor)
  getAllContent() {
    return getDb().prepare('SELECT "key", value, type FROM site_content').all();
  },

  setContent(key, value, type = 'text') {
    return getDb().prepare(`
      INSERT INTO site_content ("key", value, type, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT("key") DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, type);
  },

  deleteContent(key) {
    return getDb().prepare('DELETE FROM site_content WHERE "key" = ?').run(key);
  }
};

module.exports = { initDb, getDb, queries };
