import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db/database.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scorecardsDir = path.join(rootDir, 'scorecards');
const roundsDir = path.join(rootDir, 'rounds');

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

function parseHoleRows(text) {
  const holes = [];
  for (const line of text.split('\n')) {
    // Match data rows: | number | ... | — skip header, separator, and summary rows (Out/In/Total)
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

function extractSection(text, heading) {
  const re = new RegExp(`## ${heading}[ \\t]*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// DD/MM/YYYY → YYYY-MM-DD
function parseDateFm(str) {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function syncSessions() {
  if (!existsSync(roundsDir)) return;

  const db = getDB();
  const files = readdirSync(roundsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const relPath = `rounds/${file}`;
    const existing = db.prepare('SELECT id FROM sessions WHERE markdown_file = ?').get(relPath);
    if (existing) continue;

    const text = readFileSync(path.join(roundsDir, file), 'utf8');
    const fm = parseFrontMatter(text);

    const date = parseDateFm(fm.date);
    if (!date) continue;

    const type = fm.type === 'range' ? 'range' : 'round';
    const venueName = fm.venue || null;
    const score = fm.score && fm.score !== '' ? parseInt(fm.score) : null;
    const coursePar = fm.par && fm.par !== '' ? parseInt(fm.par) : null;
    const ratingMatch = fm.rating ? fm.rating.match(/^([1-5])/) : null;
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
    const note = extractSection(text, 'My Notes');
    const aiSummary = extractSection(text, 'AI Summary') || null;

    let venueId = null;
    if (venueName) {
      let venue = db.prepare('SELECT id FROM venues WHERE name = ?').get(venueName);
      if (!venue) {
        const r = db.prepare('INSERT INTO venues (name) VALUES (?)').run(venueName);
        venueId = r.lastInsertRowid;
      } else {
        venueId = venue.id;
      }
    }

    db.prepare(`
      INSERT INTO sessions (type, date, venue_id, venue_name, score, course_par, rating, note, ai_summary, markdown_file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, date, venueId, venueName, score, coursePar, rating, note || null, aiSummary, relPath);

    console.log(`Imported session from ${relPath}`);
  }
}

export function syncScorecards() {
  if (!existsSync(scorecardsDir)) return;

  const db = getDB();
  const files = readdirSync(scorecardsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const relPath = `scorecards/${file}`;
    // Skip if already tracked
    const existing = db.prepare('SELECT id FROM venues WHERE markdown_file = ?').get(relPath);
    if (existing) continue;

    const text = readFileSync(path.join(scorecardsDir, file), 'utf8');
    const fm = parseFrontMatter(text);
    const name = fm.name;
    if (!name) continue;

    const holes = parseHoleRows(text);
    if (holes.length === 0) continue;

    // Upsert venue (may already exist by name without a markdown_file pointer)
    let venue = db.prepare('SELECT * FROM venues WHERE name = ?').get(name);
    if (!venue) {
      const r = db.prepare('INSERT INTO venues (name, markdown_file) VALUES (?, ?)').run(name, relPath);
      venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(r.lastInsertRowid);
    } else {
      db.prepare('UPDATE venues SET markdown_file = ? WHERE id = ?').run(relPath, venue.id);
    }

    const upsertHole = db.prepare(`
      INSERT INTO scorecard_holes (venue_id, hole, yards, par, si)
      VALUES (@venue_id, @hole, @yards, @par, @si)
      ON CONFLICT(venue_id, hole) DO UPDATE SET yards=excluded.yards, par=excluded.par, si=excluded.si
    `);
    const insertAll = db.transaction(hs => {
      for (const h of hs) upsertHole.run({ venue_id: venue.id, ...h });
    });
    insertAll(holes);

    console.log(`Imported scorecard from ${relPath} (${holes.length} holes)`);
  }
}
