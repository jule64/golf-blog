Generate AI summaries for golf sessions, writing the summaries yourself (do not call the app's API or enable AI_SUMMARIES).

## Input

`$ARGUMENTS` is optional:
- **Provided** (e.g. `29Apr26` or `rounds/2026-04-29_brent-valley.md`): generate a summary for that single session only, then stop.
- **Not provided**: scan all sessions in `rounds/` and generate summaries for any that are missing one.

### Resolving a single file from `$ARGUMENTS`

The argument can be:
- A file path: `rounds/2025-04-26_brent-valley.md` — use it directly.
- A short date like `26Apr25` → parse as DDMMMYY, convert to `YYYY-MM-DD_` prefix (e.g. `2025-04-26_`), then find the matching file with `ls rounds/ | grep "^2025-04-26_"`. If exactly one match is found, use it. If zero or multiple matches are found, report the issue and stop.

## Steps

### Single-file mode (argument provided)

1. Resolve the file path as described above.
2. Read the file for full context (frontmatter, notes, hole data).
3. Check if a matching scorecard exists in `scorecards/` based on the venue name (for hole-by-hole par/yards/SI context).
4. Generate and write the summary (see Writing the summary below).
5. Report which file was updated.

### Batch mode (no argument)

1. Scan `rounds/` for sessions missing a summary. A session needs a summary if:
   - It has no `## AI Summary` section at all, OR
   - The `## AI Summary` section exists but is empty (immediately followed by `## Scorecard` or end-of-file with no text in between).

2. For each session found, follow steps 2–4 from single-file mode above.

3. Report which sessions were updated.

## Writing the summary

Generate a first-person blog entry following this prompt:
> You are ghostwriting a personal golf blog entry. Write in first person as if the golfer is writing it themselves — natural, honest, conversational. Use the session data and notes as the raw material. Bring the round to life: how it felt, what happened, the highs and lows. Plain prose only — no bullet points, no headers. 2-3 paragraphs.

Then write it into the markdown file:
- If `## AI Summary` section exists but is empty: insert the text after the section heading.
- If `## AI Summary` section is missing: append it before `## Scorecard` (or at end of file).
