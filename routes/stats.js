import { Router } from 'express';
import { getDB } from '../db/database.js';
import { calcSummary, calcChartData } from '../services/statsService.js';

const router = Router();

router.get('/summary', (req, res) => {
  const db = getDB();
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY date DESC').all();
  res.json(calcSummary(sessions));
});

router.get('/chart', (req, res) => {
  const db = getDB();
  const { mode = 'score', type } = req.query;
  let query = 'SELECT * FROM sessions';
  const params = [];
  if (type) { query += ' WHERE type = ?'; params.push(type); }
  query += ' ORDER BY date ASC';
  const sessions = db.prepare(query).all(...params);
  res.json(calcChartData(sessions, mode));
});

export default router;
