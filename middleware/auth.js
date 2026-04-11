function requireAuth(req, res, next) {
  if (req.session && req.session.adminAuthenticated) {
    return next();
  }
  // API requests get 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Page requests redirect to login
  res.redirect('/admin/login');
}

module.exports = { requireAuth };
