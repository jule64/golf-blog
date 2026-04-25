import { Router } from 'express';
import {
  getSessions, getSession, createSession, updateSession, deleteSession, getVenue,
} from '../services/store.js';
import { writeSessionMarkdown, deleteSessionMarkdown } from '../services/markdownService.js';
import { generateSessionSummary } from '../services/claudeService.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getSessions(req.query.type));
});

router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.post('/', async (req, res) => {
  const { type, date, venue_id, venue_name, score, course_par, rating, note, holes } = req.body;
  if (!type || !date || !rating) return res.status(400).json({ error: 'type, date, rating are required' });

  let resolvedVenueName = venue_name;
  let resolvedVenueId = venue_id ? Number(venue_id) : null;
  if (resolvedVenueId) {
    const venue = getVenue(resolvedVenueId);
    if (venue) resolvedVenueName = venue.name;
  }

  const sessionHoles = Array.isArray(holes) ? holes : [];

  let session = createSession({
    type,
    date,
    venue_id: resolvedVenueId,
    venue_name: resolvedVenueName,
    score: score || null,
    course_par: course_par || null,
    rating,
    note: note || null,
    ai_summary: null,
    markdown_file: null,
    holes: sessionHoles,
  });

  const scorecard = resolvedVenueId ? (getVenue(resolvedVenueId)?.holes ?? []) : [];
  const venue = resolvedVenueId ? getVenue(resolvedVenueId) : null;

  if (process.env.AI_SUMMARIES === 'true') {
    try {
      const aiSummary = await generateSessionSummary(session, venue, sessionHoles, scorecard);
      session = updateSession(session.id, { ai_summary: aiSummary });
    } catch (e) {
      console.error('Claude summary failed:', e.message);
    }
  }

  const relPath = writeSessionMarkdown(session, sessionHoles, scorecard);
  session = updateSession(session.id, { markdown_file: relPath });

  res.status(201).json(session);
});

router.put('/:id', async (req, res) => {
  const existing = getSession(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session not found' });

  const { type, date, venue_id, venue_name, score, course_par, rating, note, holes, regenerate_ai } = req.body;

  let resolvedVenueName = venue_name !== undefined ? venue_name : existing.venue_name;
  let resolvedVenueId = venue_id !== undefined ? (venue_id ? Number(venue_id) : null) : existing.venue_id;
  if (resolvedVenueId) {
    const venue = getVenue(resolvedVenueId);
    if (venue) resolvedVenueName = venue.name;
  }

  const sessionHoles = Array.isArray(holes) ? holes : existing.holes;

  let session = updateSession(existing.id, {
    type: type || existing.type,
    date: date || existing.date,
    venue_id: resolvedVenueId,
    venue_name: resolvedVenueName,
    score: score !== undefined ? (score || null) : existing.score,
    course_par: course_par !== undefined ? (course_par || null) : existing.course_par,
    rating: rating || existing.rating,
    note: note !== undefined ? (note || null) : existing.note,
    holes: sessionHoles,
  });

  const scorecard = resolvedVenueId ? (getVenue(resolvedVenueId)?.holes ?? []) : [];
  const venue = resolvedVenueId ? getVenue(resolvedVenueId) : null;

  if (regenerate_ai && process.env.AI_SUMMARIES === 'true') {
    try {
      const aiSummary = await generateSessionSummary(session, venue, sessionHoles, scorecard);
      session = updateSession(session.id, { ai_summary: aiSummary });
    } catch (e) {
      console.error('Claude summary failed:', e.message);
    }
  }

  deleteSessionMarkdown(existing.markdown_file);
  const relPath = writeSessionMarkdown(session, sessionHoles, scorecard);
  session = updateSession(session.id, { markdown_file: relPath });

  res.json(session);
});

router.delete('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  deleteSessionMarkdown(session.markdown_file);
  deleteSession(session.id);
  res.json({ ok: true });
});

router.post('/:id/regenerate-summary', async (req, res) => {
  if (process.env.AI_SUMMARIES !== 'true') {
    return res.status(503).json({ error: 'AI summaries are disabled. Set AI_SUMMARIES=true in .env to enable.' });
  }

  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const scorecard = session.venue_id ? (getVenue(session.venue_id)?.holes ?? []) : [];
  const venue = session.venue_id ? getVenue(session.venue_id) : null;

  try {
    const aiSummary = await generateSessionSummary(session, venue, session.holes, scorecard);
    let updated = updateSession(session.id, { ai_summary: aiSummary });
    const relPath = writeSessionMarkdown(updated, updated.holes, scorecard);
    updateSession(session.id, { markdown_file: relPath });
    res.json({ ai_summary: aiSummary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
