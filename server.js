import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import path from 'path';
import { initStore } from './services/store.js';
import { requireAuth } from './middleware/auth.js';
import sessionRoutes from './routes/sessions.js';
import scorecardRoutes from './routes/scorecards.js';
import statsRoutes from './routes/stats.js';
import authRoutes from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'golf-blog-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
}));

app.use(express.json());
app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/venues', scorecardRoutes);
app.use('/api/stats', statsRoutes);
app.get('/api/config', (req, res) => res.json({ aiEnabled: process.env.AI_SUMMARIES === 'true' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initStore();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Golf tracker running at http://localhost:${port}`));
