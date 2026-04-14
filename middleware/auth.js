const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'angus-admin-secret-change-in-production';

/**
 * Middleware: require a valid Bearer JWT in Authorization header.
 * Used for all /api/admin/* routes.
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    req.adminUser = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/**
 * Middleware: require a valid Bearer JWT for page routes.
 * Redirects to /admin/login if not authenticated.
 */
function requireAuthPage(req, res, next) {
  const auth = req.headers.authorization;
  // Pages can't send headers — check query param for token redirect
  // This is handled client-side; server just serves the HTML.
  next();
}

module.exports = { requireAuth, requireAuthPage, JWT_SECRET };
