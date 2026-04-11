const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret';

function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    return res.redirect('/admin/login');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminUser = decoded.user;
    next();
  } catch {
    res.clearCookie('admin_token');
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    res.redirect('/admin/login');
  }
}

module.exports = { requireAuth, JWT_SECRET };
