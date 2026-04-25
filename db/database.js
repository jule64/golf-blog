import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'golf.db');

let db;

export function getDB() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDB() {
  const db = getDB();
  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrateDB(db);
}

function migrateDB(db) {
  // Make rating nullable (originally NOT NULL CHECK BETWEEN 1 AND 5)
  const col = db.prepare("PRAGMA table_info(sessions)").all().find(c => c.name === 'rating');
  if (col && col.notnull === 1) {
    db.exec(`
      ALTER TABLE sessions RENAME TO sessions_old;
      CREATE TABLE sessions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        type          TEXT NOT NULL CHECK(type IN ('round','range')),
        date          TEXT NOT NULL,
        venue_id      INTEGER REFERENCES venues(id) ON DELETE SET NULL,
        venue_name    TEXT,
        score         INTEGER,
        course_par    INTEGER,
        rating        INTEGER CHECK(rating IS NULL OR rating BETWEEN 1 AND 5),
        note          TEXT,
        ai_summary    TEXT,
        markdown_file TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO sessions SELECT * FROM sessions_old;
      DROP TABLE sessions_old;
    `);
    console.log('Migrated: rating column is now nullable');
  }
}
