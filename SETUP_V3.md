# Fantasy Time Machine v3 — setup

## Run locally (Windows PowerShell)
1. Extract this ZIP to a new folder. Keep the original project as a backup.
2. Open PowerShell in the extracted `fantasy-time-machine` folder.
3. Run `npm install` and then `npm run dev`.
4. Open http://localhost:3000.

## Shared leaderboard (optional, requires Supabase)
1. Create a Supabase project at https://supabase.com.
2. Open **SQL Editor**, paste all of `supabase.sql`, and run it.
3. In the project root create `.env.local` with:

   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_SERVICE_ROLE_KEY

4. Find those values in Supabase project settings/API keys. **Keep the service-role key secret.** Never place it in a `NEXT_PUBLIC_` variable, commit it to GitHub, or paste it into chat.
5. Restart `npm run dev`. The page will automatically use the shared leaderboard.
6. To deploy on Vercel, add both variables under Project > Settings > Environment Variables and redeploy.

## Important limitations
- Included player data is **2000–2024**, not 2025. The existing importer source did not provide a verified 2025 season. The game only offers years present in its dataset.
- Kickers are disabled until historical kicker records are imported and validated. Do not enable the checkbox manually.
- The 14-game record and playoff outcomes are **illustrative**, not historical game-by-game simulation.
- The server validates roster size, positions, player IDs, duplicates and recalculates PPR points; however, **it does not verify the random years/player choices shown to each user**. Therefore the shared leaderboard is not cheat-proof, and players can impersonate other display names. A production competitive version needs server-created draft sessions and identity/authentication.
- One highest score per case-insensitive display name per Eastern day per mode/kicker category is enforced atomically by the database. The leaderboard displays up to 500 stored entries before filtering client-side.
- Without Supabase configured, the leaderboard falls back to localStorage on each device.

## Updating player data
`build_players.py` still uses the original nflverse weekly CSV. It requires `pandas`, `requests`, and a working internet connection. Its validation currently requires 2000–2024, and its output has no kickers. Verify a suitable updated dataset before expanding the year range or adding kicker scoring.
