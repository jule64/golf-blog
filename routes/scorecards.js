import { Router } from 'express';
import {
  getVenues, getVenue, createVenue, updateVenue, deleteVenueWithSessions, getSessions,
} from '../services/store.js';
import { writeScorecardMarkdown, deleteScorecardMarkdown, deleteSessionMarkdown } from '../services/markdownService.js';

const router = Router();

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

router.get('/', (req, res) => {
  res.json(getVenues());
});

router.get('/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  res.json(venue);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const venue = createVenue(name.trim());
  if (!venue) return res.status(409).json({ error: 'Venue already exists' });
  // Write stub markdown so the venue persists across restarts
  const relPath = writeScorecardMarkdown(venue, []);
  const withPath = updateVenue(venue.id, { markdown_file: relPath });
  log(`VENUE created — id=${venue.id} name="${venue.name}"`);
  res.status(201).json(withPath);
});

router.put('/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  if (venue.markdown_file && name.trim() !== venue.name) {
    deleteScorecardMarkdown(venue.markdown_file);
  }

  const updated = updateVenue(venue.id, { name: name.trim(), markdown_file: null });
  log(`VENUE updated — id=${venue.id} name="${updated.name}"`);
  res.json(updated);
});

router.post('/:id/holes', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const { holes } = req.body;
  if (!Array.isArray(holes) || holes.length === 0) return res.status(400).json({ error: 'holes array required' });

  // Upsert holes into existing set
  const holeMap = new Map(venue.holes.map(h => [h.hole, h]));
  for (const h of holes) {
    holeMap.set(h.hole, { hole: h.hole, yards: h.yards || null, par: h.par, si: h.si || null });
  }
  const allHoles = [...holeMap.values()].sort((a, b) => a.hole - b.hole);

  const withHoles = updateVenue(venue.id, { holes: allHoles });
  const relPath = writeScorecardMarkdown(withHoles, allHoles);
  const withPath = updateVenue(venue.id, { markdown_file: relPath });

  res.json(withPath);
});

router.delete('/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  // Delete session markdown files for sessions at this venue
  const venueSessions = getSessions().filter(s => s.venue_id === venue.id);
  for (const s of venueSessions) deleteSessionMarkdown(s.markdown_file);

  deleteScorecardMarkdown(venue.markdown_file);
  deleteVenueWithSessions(venue.id);
  log(`VENUE deleted — id=${venue.id} name="${venue.name}"`);
  res.json({ ok: true });
});

export default router;
