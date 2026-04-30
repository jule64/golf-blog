import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const roundsDir = path.join(rootDir, 'rounds');
const scorecardsDir = path.join(rootDir, 'scorecards');

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function starRating(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// --- Session markdown ---

export function sessionMarkdownPath(session) {
  const slug = slugify(session.venue_name || 'session');
  return path.join(roundsDir, `${session.date}_${slug}.md`);
}

export function writeSessionMarkdown(session, holes = [], scorecard = []) {
  mkdirSync(roundsDir, { recursive: true });

  const vsPar = session.course_par != null
    ? (session.score - session.course_par >= 0 ? '+' : '') + (session.score - session.course_par)
    : null;

  const vs100 = session.score != null
    ? (session.score - 100 >= 0 ? '+' : '') + (session.score - 100)
    : null;

  const scoreLine = session.type === 'round' && session.score != null
    ? `**Score:** ${session.score}${vsPar != null ? ` (${vsPar} vs par)` : vs100 != null ? ` (${vs100} vs 100)` : ''}  `
    : '';

  const parMap = Object.fromEntries(scorecard.map(h => [h.hole, h]));

  let scorecardTable = '';
  if (holes.length > 0 && scorecard.length > 0) {
    const rows = holes.map(h => {
      const sc = parMap[h.hole];
      const diff = sc ? h.strokes - sc.par : null;
      const diffStr = diff != null ? (diff >= 0 ? `+${diff}` : `${diff}`) : '';
      return `| ${h.hole} | ${sc?.par ?? ''} | ${sc?.yards ?? ''} | ${sc?.si ?? ''} | ${h.strokes} | ${diffStr} |`;
    });
    scorecardTable = `| Hole | Par | Yards | S.I. | Strokes | +/- |
|------|-----|-------|------|---------|-----|
${rows.join('\n')}`;
  } else if (holes.length > 0) {
    const rows = holes.map(h => `| ${h.hole} | ${h.strokes} |`);
    scorecardTable = `| Hole | Strokes |
|------|---------|
${rows.join('\n')}`;
  }

  const content = `---
id: ${session.id}
type: ${session.type}
date: ${session.date}
venue: ${session.venue_name || ''}
${session.score != null ? `score: ${session.score}` : ''}
${session.course_par != null ? `par: ${session.course_par}` : ''}
${vsPar != null ? `vs_par: ${vsPar}` : ''}
rating: ${session.rating}/5
---

# ${session.venue_name || 'Session'} — ${formatDate(session.date)}

${scoreLine}
**Rating:** ${starRating(session.rating)}

## My Notes

${session.note || ''}

## AI Summary

${session.ai_summary || ''}

## Scorecard

${scorecardTable}`;

  const filePath = sessionMarkdownPath(session);
  writeFileSync(filePath, content.trimStart(), 'utf8');
  return path.relative(rootDir, filePath);
}

export function deleteSessionMarkdown(relativePath) {
  if (!relativePath) return;
  const fullPath = path.join(rootDir, relativePath);
  if (existsSync(fullPath)) unlinkSync(fullPath);
}

// --- Scorecard (venue) markdown ---

export function scorecardMarkdownPath(venue) {
  return path.join(scorecardsDir, `${slugify(venue.name)}.md`);
}

export function writeScorecardMarkdown(venue, holes) {
  mkdirSync(scorecardsDir, { recursive: true });

  const front9 = holes.filter(h => h.hole <= 9);
  const back9 = holes.filter(h => h.hole >= 10);

  function sumField(arr, field) {
    return arr.reduce((s, h) => s + (h[field] || 0), 0);
  }

  function renderRows(arr) {
    return arr.map(h =>
      `| ${h.hole} | ${h.yards ?? ''} | ${h.par} | ${h.si ?? ''} |`
    ).join('\n');
  }

  const outYards = sumField(front9, 'yards');
  const outPar = sumField(front9, 'par');
  const inYards = sumField(back9, 'yards');
  const inPar = sumField(back9, 'par');
  const totalYards = outYards + inYards;
  const totalPar = outPar + inPar;

  const content = `---
id: ${venue.id}
name: ${venue.name}
par: ${totalPar}
yards: ${totalYards}
tee: yellow
created_at: ${venue.created_at}
---

# ${venue.name} — Scorecard (Yellow Tees)

| Hole | Yards | Par | S.I. |
|------|-------|-----|------|
${renderRows(front9)}
| **Out** | **${outYards}** | **${outPar}** | |
${renderRows(back9)}
| **In** | **${inYards}** | **${inPar}** | |
| **Total** | **${totalYards}** | **${totalPar}** | |
`;

  const filePath = scorecardMarkdownPath(venue);
  writeFileSync(filePath, content, 'utf8');
  return path.relative(rootDir, filePath);
}

export function deleteScorecardMarkdown(relativePath) {
  if (!relativePath) return;
  const fullPath = path.join(rootDir, relativePath);
  if (existsSync(fullPath)) unlinkSync(fullPath);
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}
