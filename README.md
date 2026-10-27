# Fantasy Time Machine — starter

Next.js prototype for the 2000–2025 historical fantasy draft. Game format: 14 regular-season games and 2 playoff rounds.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Required historical dataset

Put `players.json` in `/public/players.json` with one record per player, year, and position. This project intentionally does **not** ship invented historical stats or player ranks. The app will disable Start until the dataset exists.

Example **schema only** (numbers are illustrative, NOT a factual player record):

```json
[{"id":"2000-example-qb","name":"Example Player","team":"ABC","year":2000,"position":"QB","rank":1,"points":300,"games":16,"stats":{"Pass Yds":4000,"Pass TD":30,"INT":10}}]
```

Dataset requirements:
- All seasons 2000–2025; all top 32 QB/RB/TE/K and top 50 WR per season (if available).
- Compute rank **within year and position** from the same scoring formula used for points.
- Use full-PPR scoring: 1 per reception, 0.1 per rushing/receiving yard, 0.04 per passing yard, 4 passing TD, 6 rushing/receiving TD, -2 interceptions, and document fumble/kicking rules.
- Include correct regular-season games played and year-specific team.
- Handle tied ranks consistently and avoid duplicate player records.
- FLEX includes eligible RB/WR/TE; the current selection uniformly samples from the combined pool.
- This prototype uses `Math.random()` for draws; production should use unbiased sampling and server validation.

## Before public launch

1. Import and validate licensed/open historical data, especially kicker totals.
2. Move drafts, scores, and daily leaderboard to a shared database (e.g., Supabase) with authentication or guest identities and server-side score validation. Current board is **localStorage only** and is not shared between users.
3. Replace illustrative 14-game record and two-round playoff estimates with a calibrated simulation using historical weekly opponents; choose a defensible baseline for kicker and no-kicker formats.
4. Add daily leaderboard history and prevent client score tampering.
5. Add automated scoring and data-quality tests.
