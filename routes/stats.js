import { Router } from 'express';
import { getSessions } from '../services/store.js';
import { calcSummary, calcChartData } from '../services/statsService.js';

const router = Router();

router.get('/summary', (req, res) => {
  res.json(calcSummary(getSessions()));
});

router.get('/chart', (req, res) => {
  const { mode = 'score', type } = req.query;
  res.json(calcChartData(getSessions(type), mode));
});

export default router;
