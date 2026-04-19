import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../db/database.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const scorecardsDir = path.join(rootDir, 'scorecards');

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
