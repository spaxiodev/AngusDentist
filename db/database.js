const { createClient } = require('@libsql/client');

let client;

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:data/clinic.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

async function ensureDb() {
  const db = getClient();

  await db.batch([
    `CREATE TABLE IF NOT EXISTS submissions (
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
    )`,
    `CREATE TABLE IF NOT EXISTS admin_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      action        TEXT NOT NULL,
      submission_id INTEGER,
      admin_user    TEXT,
      details       TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS site_content (
      "key"       TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'text',
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ], 'write');
}

const queries = {
  async insert(data) {
    const result = await getClient().execute({
      sql: `INSERT INTO submissions (first_name, last_name, phone, email, service, message, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [data.firstName, data.lastName, data.phone,
             data.email || null, data.service || null,
             data.message || null, data.ipAddress || null]
    });
    return { lastInsertRowid: Number(result.lastInsertRowid) };
  },

  async getAll(status) {
    const db = getClient();
    if (status && status !== 'all') {
      const result = await db.execute({
        sql: 'SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC',
        args: [status]
      });
      return result.rows;
    }
    const result = await db.execute('SELECT * FROM submissions ORDER BY created_at DESC');
    return result.rows;
  },

  async getById(id) {
    const result = await getClient().execute({
      sql: 'SELECT * FROM submissions WHERE id = ?',
      args: [id]
    });
    return result.rows[0] || null;
  },

  async updateStatus(id, status, notes) {
    return getClient().execute({
      sql: `UPDATE submissions SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [status, notes !== undefined ? notes : null, id]
    });
  },

  async delete(id) {
    return getClient().execute({
      sql: 'DELETE FROM submissions WHERE id = ?',
      args: [id]
    });
  },

  async getStats() {
    const db = getClient();
    const exec = async (sql, ...args) => {
      const r = await db.execute({ sql, args });
      return r.rows[0];
    };
    return {
      total:     (await exec("SELECT COUNT(*) as c FROM submissions")).c,
      new:       (await exec("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'new')).c,
      contacted: (await exec("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'contacted')).c,
      resolved:  (await exec("SELECT COUNT(*) as c FROM submissions WHERE status = ?", 'resolved')).c,
      today:     (await exec("SELECT COUNT(*) as c FROM submissions WHERE date(created_at) = date('now')")).c,
    };
  },

  async logAction(action, submissionId, adminUser, details) {
    return getClient().execute({
      sql: `INSERT INTO admin_log (action, submission_id, admin_user, details) VALUES (?, ?, ?, ?)`,
      args: [action, submissionId, adminUser, details]
    });
  },

  async getAllContent() {
    const result = await getClient().execute('SELECT "key", value, type FROM site_content');
    return result.rows;
  },

  async setContent(key, value, type = 'text') {
    return getClient().execute({
      sql: `INSERT INTO site_content ("key", value, type, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT("key") DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = CURRENT_TIMESTAMP`,
      args: [key, value, type]
    });
  },

  async deleteContent(key) {
    return getClient().execute({
      sql: 'DELETE FROM site_content WHERE "key" = ?',
      args: [key]
    });
  }
};

module.exports = { ensureDb, getClient, queries };
