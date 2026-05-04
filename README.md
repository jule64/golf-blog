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

### 1. Generate a local SSL certificate

The app runs over HTTPS and expects `key.pem` and `cert.pem` in the project root. Generate them with:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

Your browser will warn about the self-signed cert — just accept the exception.

### 2. Configure credentials

Copy `.env.example` to `.env` and set your login credentials and session secret:

```
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_password
SESSION_SECRET=some_random_string
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [https://localhost:3000](https://localhost:3000).

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
├── middleware/
│   └── auth.js              # Session-based auth guard
├── routes/
│   ├── auth.js
│   ├── sessions.js
│   ├── scorecards.js
│   └── stats.js
├── services/
│   ├── store.js             # In-memory store, loaded from markdown on startup
│   ├── claudeService.js     # AI summary generation
│   ├── markdownService.js   # Read/write .md files
│   └── statsService.js      # Score calculations
├── rounds/                  # One .md file per session (auto-created)
├── scorecards/              # One .md file per venue
└── public/                  # Frontend (HTML + vanilla JS + CSS)
```
