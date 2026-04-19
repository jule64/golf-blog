import { Router } from 'express';
import { getDB } from '../db/database.js';
import { writeScorecardMarkdown, deleteScorecardMarkdown, scorecardMarkdownPath } from '../services/markdownService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

router.get('/', (req, res) => {
  const db = getDB();
  const venues = db.prepare('SELECT * FROM venues ORDER BY name').all();
  res.json(venues);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  const holes = db.prepare('SELECT * FROM scorecard_holes WHERE venue_id = ? ORDER BY hole').all(venue.id);
  res.json({ ...venue, holes });
});

router.post('/', (req, res) => {
  const db = getDB();
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const result = db.prepare('INSERT INTO venues (name) VALUES (?)').run(name.trim());
    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(venue);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Venue already exists' });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  // Remove old markdown if name changes
  if (venue.markdown_file && name.trim() !== venue.name) {
    deleteScorecardMarkdown(venue.markdown_file);
  }

  db.prepare('UPDATE venues SET name = ? WHERE id = ?').run(name.trim(), venue.id);
  const updated = db.prepare('SELECT * FROM venues WHERE id = ?').get(venue.id);
  res.json(updated);
});

router.post('/:id/holes', (req, res) => {
  const db = getDB();
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const { holes } = req.body;
  if (!Array.isArray(holes) || holes.length === 0) return res.status(400).json({ error: 'holes array required' });

  const upsert = db.prepare(`
    INSERT INTO scorecard_holes (venue_id, hole, yards, par, si)
    VALUES (@venue_id, @hole, @yards, @par, @si)
    ON CONFLICT(venue_id, hole) DO UPDATE SET yards=excluded.yards, par=excluded.par, si=excluded.si
  `);

  const upsertMany = db.transaction((rows) => {
    for (const h of rows) upsert.run({ venue_id: venue.id, hole: h.hole, yards: h.yards || null, par: h.par, si: h.si || null });
  });

  upsertMany(holes);

  const allHoles = db.prepare('SELECT * FROM scorecard_holes WHERE venue_id = ? ORDER BY hole').all(venue.id);

  // Write scorecard markdown
  const relPath = writeScorecardMarkdown(venue, allHoles);
  db.prepare('UPDATE venues SET markdown_file = ? WHERE id = ?').run(relPath, venue.id);

  res.json({ ...venue, markdown_file: relPath, holes: allHoles });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  deleteScorecardMarkdown(venue.markdown_file);
  db.prepare('DELETE FROM venues WHERE id = ?').run(venue.id);
  res.json({ ok: true });
});

export default router;
