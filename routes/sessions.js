import { Router } from 'express';
import { getDB } from '../db/database.js';
import { writeSessionMarkdown, deleteSessionMarkdown, sessionMarkdownPath } from '../services/markdownService.js';
import { generateSessionSummary } from '../services/claudeService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function getSessionWithHoles(db, id) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) return null;
  const holes = db.prepare('SELECT * FROM session_holes WHERE session_id = ? ORDER BY hole').all(id);
  return { ...session, holes };
}

function getScorecard(db, venue_id) {
  if (!venue_id) return [];
  return db.prepare('SELECT * FROM scorecard_holes WHERE venue_id = ? ORDER BY hole').all(venue_id);
}

router.get('/', (req, res) => {
  const db = getDB();
  let query = 'SELECT * FROM sessions';
  const params = [];
  if (req.query.type) { query += ' WHERE type = ?'; params.push(req.query.type); }
  query += ' ORDER BY date DESC, created_at DESC';
  const sessions = db.prepare(query).all(...params);
  res.json(sessions);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const session = getSessionWithHoles(db, req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.post('/', async (req, res) => {
  const db = getDB();
  const { type, date, venue_id, venue_name, score, course_par, rating, note, holes } = req.body;

  if (!type || !date || !rating) return res.status(400).json({ error: 'type, date, rating are required' });

  // Resolve venue name
  let resolvedVenueName = venue_name;
  let resolvedVenueId = venue_id || null;
  if (venue_id) {
    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venue_id);
    if (venue) resolvedVenueName = venue.name;
  }

  const result = db.prepare(`
    INSERT INTO sessions (type, date, venue_id, venue_name, score, course_par, rating, note)
    VALUES (@type, @date, @venue_id, @venue_name, @score, @course_par, @rating, @note)
  `).run({ type, date, venue_id: resolvedVenueId, venue_name: resolvedVenueName, score: score || null, course_par: course_par || null, rating, note: note || null });

  const sessionId = result.lastInsertRowid;

  // Insert holes
  if (Array.isArray(holes) && holes.length > 0) {
    const insertHole = db.prepare('INSERT OR REPLACE INTO session_holes (session_id, hole, strokes) VALUES (?, ?, ?)');
    const insertAll = db.transaction((hs) => { for (const h of hs) insertHole.run(sessionId, h.hole, h.strokes); });
    insertAll(holes);
  }

  let session = getSessionWithHoles(db, sessionId);
  const scorecard = getScorecard(db, resolvedVenueId);
  const venue = resolvedVenueId ? db.prepare('SELECT * FROM venues WHERE id = ?').get(resolvedVenueId) : null;

  // Generate AI summary
  let aiSummary = null;
  try {
    aiSummary = await generateSessionSummary(session, venue, session.holes, scorecard);
  } catch (e) {
    console.error('Claude summary failed:', e.message);
  }

  if (aiSummary) {
    db.prepare('UPDATE sessions SET ai_summary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(aiSummary, sessionId);
    session = getSessionWithHoles(db, sessionId);
  }

  // Write markdown
  const relPath = writeSessionMarkdown(session, session.holes, scorecard);
  db.prepare('UPDATE sessions SET markdown_file = ?, updated_at = datetime(\'now\') WHERE id = ?').run(relPath, sessionId);
  session.markdown_file = relPath;

  res.status(201).json(session);
});

router.put('/:id', async (req, res) => {
  const db = getDB();
  const existing = getSessionWithHoles(db, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session not found' });

  const { type, date, venue_id, venue_name, score, course_par, rating, note, holes, regenerate_ai } = req.body;

  let resolvedVenueName = venue_name || existing.venue_name;
  let resolvedVenueId = venue_id !== undefined ? (venue_id || null) : existing.venue_id;
  if (resolvedVenueId) {
    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(resolvedVenueId);
    if (venue) resolvedVenueName = venue.name;
  }

  db.prepare(`
    UPDATE sessions SET
      type = @type, date = @date, venue_id = @venue_id, venue_name = @venue_name,
      score = @score, course_par = @course_par, rating = @rating, note = @note,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: existing.id,
    type: type || existing.type,
    date: date || existing.date,
    venue_id: resolvedVenueId,
    venue_name: resolvedVenueName,
    score: score !== undefined ? (score || null) : existing.score,
    course_par: course_par !== undefined ? (course_par || null) : existing.course_par,
    rating: rating || existing.rating,
    note: note !== undefined ? (note || null) : existing.note,
  });

  if (Array.isArray(holes)) {
    db.prepare('DELETE FROM session_holes WHERE session_id = ?').run(existing.id);
    if (holes.length > 0) {
      const insertHole = db.prepare('INSERT INTO session_holes (session_id, hole, strokes) VALUES (?, ?, ?)');
      const insertAll = db.transaction((hs) => { for (const h of hs) insertHole.run(existing.id, h.hole, h.strokes); });
      insertAll(holes);
    }
  }

  let session = getSessionWithHoles(db, existing.id);
  const scorecard = getScorecard(db, resolvedVenueId);
  const venue = resolvedVenueId ? db.prepare('SELECT * FROM venues WHERE id = ?').get(resolvedVenueId) : null;

  if (regenerate_ai) {
    try {
      const aiSummary = await generateSessionSummary(session, venue, session.holes, scorecard);
      db.prepare('UPDATE sessions SET ai_summary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(aiSummary, session.id);
      session = getSessionWithHoles(db, session.id);
    } catch (e) {
      console.error('Claude summary failed:', e.message);
    }
  }

  // Delete old markdown if path changed (venue name change)
  deleteSessionMarkdown(existing.markdown_file);
  const relPath = writeSessionMarkdown(session, session.holes, scorecard);
  db.prepare('UPDATE sessions SET markdown_file = ?, updated_at = datetime(\'now\') WHERE id = ?').run(relPath, session.id);
  session.markdown_file = relPath;

  res.json(session);
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  deleteSessionMarkdown(session.markdown_file);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
  res.json({ ok: true });
});

router.post('/:id/regenerate-summary', async (req, res) => {
  const db = getDB();
  const session = getSessionWithHoles(db, req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const scorecard = getScorecard(db, session.venue_id);
  const venue = session.venue_id ? db.prepare('SELECT * FROM venues WHERE id = ?').get(session.venue_id) : null;

  try {
    const aiSummary = await generateSessionSummary(session, venue, session.holes, scorecard);
    db.prepare('UPDATE sessions SET ai_summary = ?, updated_at = datetime(\'now\') WHERE id = ?').run(aiSummary, session.id);
    const updated = getSessionWithHoles(db, session.id);
    const relPath = writeSessionMarkdown(updated, updated.holes, scorecard);
    db.prepare('UPDATE sessions SET markdown_file = ? WHERE id = ?').run(relPath, session.id);
    res.json({ ai_summary: aiSummary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
