import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.AUTH_USERNAME && password === process.env.AUTH_PASSWORD) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
