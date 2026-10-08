# Online features: chat, clans, clan boss, co-op, transfer codes

Sakura Sentinels is a static site on GitHub Pages. The online features talk to a **Supabase** project on
the free plan. Supabase provides anonymous accounts, Postgres with Row Level Security, and Realtime. The
game itself never needs the server: saves stay on the device, and every screen works offline.

| Feature | Where | What it does |
|---|---|---|
| Online profile | first online action, Settings → Online | Anonymous account, a display name (2–16 characters), your account level, and your lobby secretary as avatar |
| Global chat | chat bubble at the top right of the lobby (slide-in drawer), or `#/chat` | Last 50 messages live, names, levels, avatars and times; "Slow down — 1.4 s" feedback |
| Clans | Menu → Clan, or `#/clan` | Create (name, TAG, emblem, open / request / invite code), search, join or request, leave; leader / officer / member roles; member list with last active; clan chat; clan level from members' activity |
| Clan boss | Clan → Clan Boss | Weekly boss with one shared HP pool. Every member's battle damage counts (3 attempts per 24 h). Damage ranking and claimable reward tiers S / A / B / C |
| Developer clan | Clan → Join with a code → `Rosie777` | "Sakura Dev Lab" [DEV] with the **Supply Bot**, a clearly labelled DEVELOPER SANDBOX that grants any item or currency in any quantity to *your own local save* |
| Co-op | Missions → Co-op, Menu → Co-op, a clanmate's Co-op button, or `#/coop` | 2-player real-time battle on any unlocked campaign stage with enemy HP ×1.6. Each player has their own coins, girls and colour. Create a room, then join by its 5-letter code or from a clan invite |
| Transfer codes | Settings → Online | Copy your save to another device with a one-time code (XXXX-XXXX) that expires after 24 h |

No profanity filter for now (owner's decision). Client **and** server rate limits are always on.

## Setup (about 5 minutes)

**Already done for this repository.** The owner created the project and connected Supabase's GitHub
integration. Anonymous sign-ins are on. `.env.production` holds the project URL and the publishable key.
**What is left:** merge to `main`. The integration then applies the migration, and the Pages workflow
builds the game against the project. Use the steps below for a fresh project, or to check settings.

1. **Create a project** at <https://supabase.com/dashboard> (the free plan is enough). Pick the region
   closest to most players: co-op latency depends on it.
2. **Create the database.** Use one of these:
   - **GitHub integration (recommended).** Go to Project Settings → Integrations → GitHub. Connect
     this repository, set the Supabase directory to `supabase`, set the production branch to `main`,
     and turn on deploying to production. Every migration in `supabase/migrations/` is then applied
     when it reaches `main`.
   - **By hand.** Open SQL Editor → New query, paste all of
     `supabase/migrations/20261008000000_online.sql`, then Run. The file is idempotent, so running it
     again is harmless.
3. **Allow anonymous sign-ins.** Go to Authentication → Sign In / Providers and switch on **Allow
   anonymous sign-ins**. Players never type an e-mail; the game makes an anonymous account the first
   time they open chat, a clan or co-op.
4. **Point the game at the project.** Go to Project Settings → API Keys / Data API and copy two values:
   - the **Project URL**, `https://<ref>.supabase.co`
   - the **publishable** key (`sb_publishable_…`), or the legacy **anon** key

   Then do one of these:
   - Put them in `.env.production` as `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`. This is what
     the repository does now. Both values are public by design: they end up in every player's browser,
     and Row Level Security is what protects the data.
   - Or add them as **repository secrets** with the same two names, under GitHub → Settings → Secrets
     and variables → Actions. `.github/workflows/deploy.yml` passes them into the build, and they
     override `.env.production`. If a secret is empty or missing, it is ignored (see `vite.config.js`).

   **Never** put the `service_role` / `sb_secret_…` key or the database password anywhere in the
   repository, the workflow or the game. The game does not need them.
5. **Deploy.** Push to `main`. When the Pages workflow finishes, open the game, then Chat, and pick a
   name. The pill at the top right reads **Online**. Open the game on a second device to see messages
   arrive live.

If no URL or key is configured, the build still succeeds. The game then runs in local mode, and the
pill reads **Online features offline**.

## Modes

| Mode | When | Behaviour |
|---|---|---|
| Online | the build has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Supabase: anonymous auth, tables, Realtime |
| Local test mode | the URL has `?online=local` (dev, tests, e2e) | Chat, clans, the boss and co-op run between **tabs of one browser** (BroadcastChannel + localStorage). Each tab is a separate player |
| Online features offline | no config in the build, or the server cannot be reached | Same as local test mode, with a grey pill. Nothing leaves the device |

`npm run dev` and the e2e tests use `?online=local`. A local `npm run build` picks up `.env.production`
and talks to the real project.

## Security and limits

- **Row Level Security on every table.**
  - Players can read profiles, but can only write their own.
  - Global chat is readable by every signed-in player. Clan chat is readable only by members of that clan.
  - Messages are posted as yourself only. A trigger stamps your real name, level and avatar on each one.
  - All other changes go through `SECURITY DEFINER` functions that check the caller (`auth.uid()`) and
    their clan role. These are joining, leaving, roles, kicks, boss damage, rewards and transfer codes.
  - Helper functions (`add_member`, `enforce_rate`, `system_message`, …) cannot be called by players.
- **Rate limits.** The same numbers are in `src/online/limits.js` (client, for instant feedback) and in
  the SQL (server, authoritative).

  | Action | Limit |
  |---|---|
  | Chat message | 1 per 2 s, 20 per minute |
  | Create clan | 1 per 10 min, 3 per day |
  | Join / request / leave | 10 per hour |
  | Clan boss attempt | 3 per rolling 24 h; damage capped at 200,000 per attempt |
  | Transfer code (create or redeem) | 5 per hour |
  | Co-op room (client only) | 1 per second, 20 per hour |

- **Developer clan.** It is invisible when browsing, and only the code joins it. The code `Rosie777` is
  in this public repository, so treat the dev clan as a toy. The Supply Bot only changes the player's own
  local save. There is no server-side economy for it to break. To change the code, run this in the SQL
  editor:

  ```sql
  update clan_codes set code = 'NewCode' where clan_id = '00000000-0000-4000-8000-000000000777';
  ```

  Then change `DEV_CODE` in `src/online/clanRules.js` too, for local mode.
- **Transfer codes** work like a password for your save. Each code works once and expires after 24 h.
  The payload is a copy of the save; the original stays on the device.
- **Housekeeping.** Chat older than 14 days and rate-limit records older than 25 hours are deleted as
  new rows arrive. There is no cron job.

**Free plan quotas.** These are the ones that matter, as of 2026; check the Supabase pricing page.

- **Realtime:** 200 concurrent connections, 100 messages per second, 2 million messages per month.
  - Chat and clan updates use very little.
  - A co-op battle sends about 10 lockstep packets per second per player. Realtime counts messages both
    sent and received, so that is roughly 40 per second for the room, or about 15,000 for a 6-minute
    battle. That allows roughly 130 co-op battles per month before the monthly quota.
  - To spend less, raise `heartbeatMs` and `inputDelay` in `openRoom()` in
    `src/online/adapters/supabase.js`. That trades messages for command lag.
- **Inactive projects are paused** after a week without traffic. Restore the project in the dashboard;
  until then the online screens show "Online features are offline right now".
- **Anonymous sign-ins** are limited to 30 per hour per IP by default (Authentication → Rate Limits).

## How it works

```
src/online/backend.js            picks the adapter, signs in, runs the client limiter, normalizes errors
src/online/limits.js             rate-limit table (shared numbers with the SQL) + sliding-window limiter
src/online/errors.js             OnlineError codes: rate_limited (retryMs), offline, not_member, name_taken, forbidden, …
src/online/clanRules.js          roles, clan XP → level, ISO week, weekly boss rotation, reward tiers, DEV_CODE
src/online/identity.js           online name (own storage key ss-online-v1, outside the save), level, avatar
src/online/supply.js             Supply Bot grants (developer clan)
src/online/adapters/supabase.js  supabase-js (loaded only when an online screen opens)
src/online/adapters/local.js     BroadcastChannel + localStorage transport (two tabs = two players)
src/online/adapters/localDb.js   the local adapter's "server": the same rules as the SQL, pure and tested
src/online/coop/                 lockstep.js, commands.js (wallets, ownership), simHash.js, session.js (room lobby), loadout.js, rewards.js
src/data/coop.js                 co-op tuning: HP ×1.6, cash share 0.6, input delay, heartbeat, hash interval, timeouts, colours, stage list
src/ui/online/                   chat panel + lobby drawer, name prompt, status pill, Supply Bot, co-op HUD, Settings → Online
src/ui/screens/{chat,clan,coop}.js   #/chat, #/clan, #/coop/<CODE>
supabase/migrations/*.sql        tables, RLS, functions, rate limits, realtime publication, dev clan seed
supabase/config.toml             Supabase CLI config (anonymous sign-ins, realtime) for local stacks / preview branches
```

### Co-op lockstep

- **Same simulation on both clients.** The host's start message carries:
  - the seed, stage and difficulty;
  - both players' girls: the host brings the hero plus 5 girls, the guest brings 6 girls.

  Both clients build the same seeded Sim from it, with enemy HP ×1.6 through the stage's `hpScale`.
  `src/sim` is unchanged.
- **Only commands travel.** These are place, upgrade, sell, target, ult, wave, auto-start and speed.
  - Each command is stamped with a tick a few frames ahead: 6 ticks on local tabs, 12 on Supabase,
    multiplied by the game speed.
  - Both clients execute it at exactly that tick.
  - Commands that land on the same tick run in player, then sequence order.
- **Promises.**
  - Every heartbeat says "I will send nothing more up to tick N". A client only runs tick T when its ally
    has promised T. Otherwise it shows **Waiting for ally…** and raises its input delay a little.
  - Unacknowledged commands are re-sent with every heartbeat, so a lossy link is fine.
- **Wallets.**
  - Each player starts with 60% of the stage's coins.
  - Each command runs with its player's coins and loadout swapped into the Sim. This also enforces
    "only your own girls".
  - Coins earned are split evenly, with the odd coin alternating.
  - Only a girl's owner can upgrade, retarget or sell her.
- **Desync check.** Both clients exchange a state hash every 120 ticks.
  - On a mismatch the guest asks the host for its command log and replays it from the start.
  - A second mismatch within 30 s ends the link. Both players continue solo.
- **Disconnect.** A peer is dropped when it says bye (Leave, closing the tab) or is silent for 12–20 s.
  It gets longer while the ally's battle is still loading.
  - The ally's girls stay on the map and keep fighting.
  - Their future income goes to the survivor.
  - The survivor's battle never stops.
- **Rewards.** Each player gets the stage drops on their own device. Medals stay solo.

## Tests

```bash
npx vitest run tests/online
node e2e/online.mjs
node e2e/online.mjs --viewport 844x390 --shots /tmp/online
```

The vitest suite covers:

- `limits.test.js`: rate limiter.
- `localDb.test.js` and `localAdapter.test.js`: the local server, and two tabs chatting, joining clans
  and finishing a co-op handshake and battle.
- `clanRules.test.js`
- `lockstep.test.js`: two clients with random latency stay identical through a whole battle. It also
  covers loss, desync repair, a disconnect and slow devices.
- `schema.test.js`:
  - lints the migration;
  - runs it twice on real Postgres (PGlite) against a stub of Supabase's auth schema;
  - exercises RLS, every function and the server rate limits as several players.
- `supabaseAdapter.test.js`: runs the Supabase adapter against a recording fake of supabase-js. Every
  table, column, function, parameter and realtime filter it uses must exist in the migration.

The e2e test opens two pages of one browser in local mode. It checks:

- chat delivery and rate-limit feedback;
- clan create and join;
- the clan boss;
- the Rosie777 Supply Bot;
- a co-op battle where both players place a girl and the state hashes match.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Pill says **Online features offline** on the live site | The build had no URL or key. Check `.env.production`, or the repository secrets, and redeploy |
| "The game server is not set up yet" / "Online features are offline right now" | The migration has not run. Check the GitHub integration's log in Supabase, or paste the migration into the SQL editor. If the project was paused, restore it |
| "Anonymous sign-ins are disabled" | Authentication → Sign In / Providers → Allow anonymous sign-ins |
| Co-op shows **Waiting for ally…** often | High latency between the players. The input delay adapts up to 18 ticks; a closer Supabase region helps |
| Chat says "Slow down" | Working as intended: 1 message per 2 s and 20 per minute |
