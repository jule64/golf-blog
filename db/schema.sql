CREATE TABLE IF NOT EXISTS venues (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  markdown_file   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scorecard_holes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  hole     INTEGER NOT NULL,
  yards    INTEGER,
  par      INTEGER NOT NULL,
  si       INTEGER,
  UNIQUE(venue_id, hole)
);

CREATE TABLE IF NOT EXISTS sessions (
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

CREATE TABLE IF NOT EXISTS session_holes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  hole       INTEGER NOT NULL,
  strokes    INTEGER NOT NULL,
  UNIQUE(session_id, hole)
);
