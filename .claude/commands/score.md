Extract hole-by-hole scores from the notes of a session markdown file and output them in a simple format.

## Input

The file name is passed as the argument: `$ARGUMENTS` (e.g. `2026-04-26_brent-valley.md`)
Could also be an incomplete name like `26apr26 brent valley` — find the closest match and confirm with the user before continuing.

## Steps

1. Find and read the session markdown file under `./rounds/`.

2. Read the `## My Notes` section carefully and extract a stroke count for each hole mentioned. Use reasoning:
   - Explicit scores ("scored a 7", "scoring 6, 6, 6 and 4 on the first 4 holes") are high confidence.
   - Implicit scores can be inferred from shot sequences (tee, approach, chip, putts) — count the strokes including penalty strokes.
   - "+/- on my 100 scale" references can help: 100-scale par is typically 6 for par 4, 4–5 for par 3.

3. Output only the holes you could determine, in this format:
   ```
   H1=6, H2=6, H3=6, H4=4, H5=7
   ```
   Do not write anything to the file. Do not output holes you couldn't determine.
