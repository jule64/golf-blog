const PUBLIC = ['/login.html', '/css/style.css'];

export function requireAuth(req, res, next) {
  if (PUBLIC.includes(req.path) || req.path.startsWith('/api/auth/')) return next();
  if (req.session?.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login.html');
}
