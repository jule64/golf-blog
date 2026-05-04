# Golf Blog — Claude Code Context

A personal, single-user golf round tracker and blog running locally. Built entirely with Claude Code.

## What it does

- Log golf rounds and range/practice sessions
- Store session data as individual markdown files in `rounds/` (loaded into memory on startup)
- Store venue scorecards as individual markdown files in `scorecards/` (loaded into memory on startup)
- Generate AI-written first-person blog entries per session (Claude, ghostwriting in the user's voice)
- Track progress over time: stats summary, score chart (vs raw / vs par / vs 100)

## Stack

- **Backend**: Node.js (ESM) + Express — `server.js`
- **Store**: in-memory, loaded from markdown files on startup — `services/store.js`
- **AI**: `@anthropic-ai/sdk`, model `claude-sonnet-4-6` — `services/claudeService.js`
- **Frontend**: Vanilla JS + Chart.js (CDN) — `public/`

## Key design decisions

- **Markdown is the source of truth** — every session and scorecard is a `.md` file; the in-memory store is rebuilt from them on startup.
- **Score mode**: vs par when `course_par` is set on the session, vs 100 otherwise.
- **AI summaries are gated** by `AI_SUMMARIES=true` in `.env` (off by default — requires Anthropic API credits).
- `ANTHROPIC_API_KEY` is loaded from the shell environment, not `.env`.
- Single user — login required, credentials set via `.env`.

## Project structure

```
server.js                  # Express entry point, mounts routes, calls initStore()
middleware/
  auth.js                  # requireAuth — guards all routes except /login and /api/auth/*
routes/
  auth.js                  # POST /api/auth/login, /api/auth/logout
  sessions.js              # CRUD + /regenerate-summary — mounted at /api/sessions
  scorecards.js            # Venue + hole CRUD, writes scorecard markdown — mounted at /api/venues
  stats.js                 # /summary and /chart endpoints — mounted at /api/stats
services/
  store.js                 # In-memory store; loads all rounds/ and scorecards/ on startup
  markdownService.js       # writeSessionMarkdown(), writeScorecardMarkdown(), delete helpers
  claudeService.js         # generateSessionSummary() — first-person blog entry prompt
  statsService.js          # calcSummary(), calcChartData()
rounds/                    # One .md file per session (YYYY-MM-DD_venue-slug.md)
scorecards/                # One .md file per venue (venue-slug.md)
public/
  index.html + js/history.js        # Round history, filter; cards are clickable → session detail
  session.html + js/session.js      # Full session detail: notes, AI blog entry, hole-by-hole table
  add-session.html + js/add-session.js  # Add/edit session, hole grid, star rating
  scorecard.html + js/scorecard.js  # Venue list + inline scorecard editor
  stats.html + js/stats.js          # Stats cards + Chart.js progress chart
  css/style.css                     # All styles, CSS variables, no framework
```

## Environment

```
PORT=3000
AI_SUMMARIES=false   # set to true to enable Claude session summaries
# ANTHROPIC_API_KEY must be set in shell environment
```

## Running

```bash
npm run dev   # node --watch server.js
```

## Ideas

<!-- Add feature ideas and improvements here -->

