import { Router } from 'express';

const router = Router();

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.AUTH_USERNAME && password === process.env.AUTH_PASSWORD) {
    req.session.authenticated = true;
    log(`LOGIN success — user=${username} ip=${req.ip}`);
    res.json({ ok: true });
  } else {
    log(`LOGIN failed — user=${username} ip=${req.ip}`);
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

router.post('/logout', (req, res) => {
  log(`LOGOUT ip=${req.ip}`);
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
