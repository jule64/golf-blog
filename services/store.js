import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scorecardsDir = path.join(rootDir, 'scorecards');
const roundsDir = path.join(rootDir, 'rounds');

const venues = new Map();   // id → venue
const sessions = new Map(); // id → session

// ---- Parsers ----

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

function extractSection(text, heading) {
  const re = new RegExp(`## ${heading}[ \\t]*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// Handles DD/MM/YYYY (old files) and YYYY-MM-DD (written by markdownService)
function parseDateFm(str) {
  if (!str) return null;
  const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

// Parses venue scorecard rows: | hole | yards | par | si |
function parseHoleRows(text) {
  const holes = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(\d*)\s*\|\s*(\d+)\s*\|\s*(\d*)\s*\|/);
    if (!m) continue;
    holes.push({
      hole: parseInt(m[1]),
      yards: m[2] ? parseInt(m[2]) : null,
      par: parseInt(m[3]),
      si: m[4] ? parseInt(m[4]) : null,
    });
  }
  return holes;
}

// Parses session hole rows from the ## Scorecard section.
// Handles both:
//   | Hole | Par | Yards | S.I. | Strokes | +/- |  (6 cols, strokes at index 4)
//   | Hole | Strokes |                               (2 cols, strokes at index 1)
function parseSessionHoles(text) {
  const section = extractSection(text, 'Scorecard');
  if (!section) return [];
  const holes = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    if (cells.length < 2) continue;
    const hole = parseInt(cells[0]);
    if (isNaN(hole)) continue;
    const strokes = cells.length >= 5 ? parseInt(cells[4]) : parseInt(cells[1]);
    if (!isNaN(strokes)) holes.push({ hole, strokes });
  }
  return holes;
}

// ---- Loaders ----

function loadAllVenues() {
  if (!existsSync(scorecardsDir)) return;
  for (const file of readdirSync(scorecardsDir).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(path.join(scorecardsDir, file), 'utf8');
    const fm = parseFrontMatter(text);
    const id = parseInt(fm.id);
    if (!fm.name || isNaN(id)) continue;
    venues.set(id, {
      id,
      name: fm.name,
      created_at: fm.created_at || new Date().toISOString().replace('T', ' ').split('.')[0],
      markdown_file: `scorecards/${file}`,
      holes: parseHoleRows(text),
    });
  }
}

function loadAllSessions() {
  if (!existsSync(roundsDir)) return;
  const venuesByName = new Map([...venues.values()].map(v => [v.name, v]));

  for (const file of readdirSync(roundsDir).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(path.join(roundsDir, file), 'utf8');
    const fm = parseFrontMatter(text);
    const id = parseInt(fm.id);
    const date = parseDateFm(fm.date);
    if (isNaN(id) || !date) continue;

    const type = fm.type === 'range' ? 'range' : 'round';
    const venueName = fm.venue || null;
    const score = fm.score && fm.score !== '' ? parseInt(fm.score) : null;
    const coursePar = fm.par && fm.par !== '' ? parseInt(fm.par) : null;
    const ratingMatch = fm.rating ? fm.rating.match(/^([1-5])/) : null;
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
    const note = extractSection(text, 'My Notes');
    const aiSummary = extractSection(text, 'AI Summary') || null;
    const venue = venueName ? (venuesByName.get(venueName) ?? null) : null;

    sessions.set(id, {
      id,
      type,
      date,
      venue_id: venue?.id ?? null,
      venue_name: venueName,
      score: score != null && !isNaN(score) ? score : null,
      course_par: coursePar != null && !isNaN(coursePar) ? coursePar : null,
      rating,
      note: note || null,
      ai_summary: aiSummary,
      markdown_file: `rounds/${file}`,
      holes: parseSessionHoles(text),
    });
  }
}

export function initStore() {
  loadAllVenues();
  loadAllSessions();
  console.log(`Store loaded: ${venues.size} venues, ${sessions.size} sessions`);
}

// ---- Helpers ----

function nextId(map) {
  return map.size === 0 ? 1 : Math.max(...map.keys()) + 1;
}

// ---- Sessions ----

export function getSessions(typeFilter) {
  let all = [...sessions.values()];
  if (typeFilter) all = all.filter(s => s.type === typeFilter);
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export function getSession(id) {
  return sessions.get(Number(id)) ?? null;
}

export function createSession(data) {
  const id = nextId(sessions);
  const session = { ...data, id };
  sessions.set(id, session);
  return session;
}

export function updateSession(id, updates) {
  const existing = sessions.get(Number(id));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: existing.id };
  sessions.set(existing.id, updated);
  return updated;
}

export function deleteSession(id) {
  return sessions.delete(Number(id));
}

// ---- Venues ----

export function getVenues() {
  return [...venues.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getVenue(id) {
  return venues.get(Number(id)) ?? null;
}

export function getVenueByName(name) {
  for (const v of venues.values()) {
    if (v.name === name) return v;
  }
  return null;
}

export function createVenue(name) {
  if (getVenueByName(name)) return null;
  const id = nextId(venues);
  const venue = {
    id,
    name,
    created_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    markdown_file: null,
    holes: [],
  };
  venues.set(id, venue);
  return venue;
}

export function updateVenue(id, updates) {
  const existing = venues.get(Number(id));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: existing.id };
  venues.set(existing.id, updated);
  return updated;
}

export function deleteVenueWithSessions(id) {
  const venue = venues.get(Number(id));
  if (!venue) return { ok: false, deletedSessions: [] };
  const deletedSessions = [...sessions.values()].filter(s => s.venue_id === venue.id);
  for (const s of deletedSessions) sessions.delete(s.id);
  venues.delete(Number(id));
  return { ok: true, deletedSessions };
}
