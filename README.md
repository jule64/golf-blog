# Golf Blog

A personal golf round tracker and blog. Log rounds and practice sessions, track progress over time, and get AI-generated coaching summaries powered by Claude.

> 🤖 This app was built 100% with [Claude Code](https://claude.ai/code)!

![Golf Blog history page](docs/v1.1%20main%20page.png)

![Golf Blog stats page](docs/v1.1%20stats%20page.png)

## Features

- **Log rounds and range sessions** — date, venue, score, rating, notes
- **Hole-by-hole scoring** — optional per-hole entry when a venue scorecard is loaded
- **Session detail view** — click any history card to see the full session, AI blog entry, and a hole-by-hole score table with par, S.I., and per-hole +/− diff
- **AI blog entries** — Claude ghostwrites a first-person blog entry for each session; history cards show an excerpt, session detail shows the full entry with a toggle to reveal your original notes
- **Score tracking** — vs par (when available) or vs 100 as a default handicap baseline
- **Progress chart** — score over time, switchable between raw score / vs par / vs 100
- **My Stats** — rounds played, best score, average score, average vs par, scoring trend
- **Session counts** — rounds and range session totals shown in the history filter tabs
- **Markdown storage** — every session and scorecard is saved as a human-readable `.md` file; markdown is the source of truth, loaded into an in-memory store on startup

## Stack

- **Backend** — Node.js + Express
- **Storage** — In-memory store backed by markdown files in `rounds/` and `scorecards/`
- **AI** — Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
- **Frontend** — Vanilla JS, Chart.js

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` set in your shell environment

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

### Adding a scorecard

Go to **Scorecards** and add a venue with its yellow tee hole data (yards, par, S.I.). The scorecard is saved as `scorecards/<venue-slug>.md`.

You can also drop a markdown file directly into the `scorecards/` directory — it will be imported into the app automatically on the next startup.

### Logging a session

Go to **Add Session**. Select a venue if you have a scorecard loaded — this unlocks optional hole-by-hole score entry and auto-fills course par. Without a scorecard, scores are tracked vs 100.

Each session is saved as `rounds/YYYY-MM-DD_<venue>.md` with front-matter, your notes, the AI summary, and a full hole breakdown.

### Viewing a session

Click any history card to open the full session detail: your complete notes, the AI-written blog entry, and a hole-by-hole breakdown comparing your scores to par.

### Editing or deleting

Use the **Edit** / **Delete** buttons on any history card or session detail page. Editing a session regenerates the AI summary and rewrites the markdown file.

## File structure

```
├── server.js
├── db/
│   ├── schema.sql
│   └── database.js
├── routes/
│   ├── sessions.js
│   ├── scorecards.js
│   └── stats.js
├── services/
│   ├── claudeService.js     # AI summary generation
│   ├── markdownService.js   # Read/write .md files
│   ├── statsService.js      # Score calculations
│   └── syncService.js       # Import scorecards from markdown on startup
├── rounds/                  # One .md file per session (auto-created)
├── scorecards/              # One .md file per venue
└── public/                  # Frontend (HTML + vanilla JS + CSS)
```
