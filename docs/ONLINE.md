# Online features: chat, clans, clan boss, co-op, transfer codes

Sakura Sentinels is a static site on GitHub Pages. The online features talk to a **Supabase** project on
the free plan. Supabase provides anonymous accounts, Postgres with Row Level Security, and Realtime. The
game itself never needs the server: saves stay on the device, and every screen works offline.

| Feature | Where | What it does |
|---|---|---|
| Online profile | first online action, Settings → Online | Anonymous account, a display name (2–16 characters; "Not now" keeps an automatic `Sensei1234` name until you pick one), your account level, and your lobby secretary as avatar |
| Global chat | chat bubble at the top right of the lobby (slide-in drawer), or `#/chat` | Last 50 messages live, names, levels, avatars and times; "Slow down — 1.4 s" feedback |
| Clans | Menu → Clan, or `#/clan` | Create (name, TAG, emblem, open / request / invite code), search, join or request, leave; leader / officer / member roles; member list with last active; clan chat; clan level from members' activity |
| Clan boss | Clan → Clan Boss | Weekly boss with one shared HP pool. Every member's battle damage counts (3 attempts per 24 h). Damage ranking and claimable reward tiers S / A / B / C |
| Developer clan | Clan → Join with a code → `Rosie777` | "Sakura Dev Lab" [DEV] with the **Supply Bot**, a clearly labelled DEVELOPER SANDBOX that grants any item or currency in any quantity to *your own local save* |
| Co-op | Missions → Co-op, Menu → Co-op, a clanmate's Co-op button, or `#/coop` | 2-player real-time battle on any unlocked campaign stage with enemy HP ×1.6. Each player has their own coins, girls and colour. Create a room, then join by its 5-letter code or from a clan invite |
| Transfer codes | Settings → Online | Copy your save to another device with a one-time code (`XXXX-XXXX-XXXX`, 60 random bits) that expires after 24 h. One live code per player: a new code replaces the last |

No profanity filter for now (owner's decision). Client **and** server rate limits are always on.

## Setup (about 5 minutes)

**The schema is one file:** `supabase/migrations/20261008000000_online.sql`. It is the brief's
`schema.sql`, kept in the Supabase CLI layout so that Supabase's GitHub integration can apply it. Paste
that file into the SQL Editor if you set the database up by hand.

### Status for this repository (checklist)

The owner created the project and sent its URL and publishable key. Last checked on the live project
on 2026-10-13 (read-only requests with the publishable key): anonymous sign-ins are on, but **the
database is still empty** — no `clans` table and no `current_week()` function, so the migration has
not run yet. Until it runs, the live game's chat, clans and co-op say "The game server is not set up
yet". Do the next step first.

- [x] Supabase project created (free plan).
- [x] **Allow anonymous sign-ins** is on.
- [x] The game knows the project: `.env.production` holds the public URL and publishable key (see
      step 4 below for the alternative, repository secrets).
- [ ] **Create the tables (not done yet).** Either paste the migration now — Supabase → SQL Editor →
      New query, paste all of `supabase/migrations/20261008000000_online.sql`, Run (it is idempotent,
      so a later run by the GitHub integration is harmless) — or connect the GitHub integration:
      Project Settings → Integrations → GitHub: this repository, Supabase directory `supabase`,
      production branch `main`, "Deploy to production" on. Pasting is the quickest; the integration
      keeps later migrations automatic.
- [ ] **Merge to `main`.** The Pages workflow builds and deploys the game (and, if connected, the
      integration applies the migration; its log is under Integrations → GitHub).
- [ ] Quick server check without the game (optional): open
      `https://<ref>.supabase.co/rest/v1/clans?select=id&limit=1` with header `apikey: <publishable key>`
      (or `curl -H "apikey: …" …`). `PGRST205 … Could not find the table` = migration not run yet;
      `permission denied` / HTTP 401 = the tables exist (only signed-in players may read them).
- [ ] **Verify on the live site (2 minutes, after the Pages workflow is green):**
  1. Open the game, then the chat bubble in the lobby (or `#/chat`), and pick a name.
  2. The pill at the top right must read **Online**, and the chat must show no yellow "Local test
     mode" / "Online features are offline" banner.
  3. Send a message, then open the game on a phone (or a private window) and see it arrive.
  4. If the chat says **"The game server is not set up yet"**, the migration has not run: open
     Supabase → SQL Editor → New query, paste all of `supabase/migrations/20261008000000_online.sql`,
     and Run. Reload the game.
  5. Optional: Clan → Join with a code → `Rosie777` opens the developer clan and its Supply Bot.

### Fresh project (or checking the settings)

1. **Create a project** at <https://supabase.com/dashboard> (the free plan is enough). Pick the region
   closest to most players: co-op latency depends on it.
2. **Create the database.** Use one of these:
   - **GitHub integration (recommended).** Go to Project Settings → Integrations → GitHub. Connect
     this repository, set the Supabase directory to `supabase`, set the production branch to `main`,
     and turn on deploying to production. Every migration in `supabase/migrations/` is then applied
     when it reaches `main`.
   - **By hand.** Open SQL Editor → New query, paste all of
     `supabase/migrations/20261008000000_online.sql`, then Run. The file is idempotent: running it
     again, or running a newer version of it over an older one, is safe.
3. **Allow anonymous sign-ins.** Go to Authentication → Sign In / Providers and switch on **Allow
   anonymous sign-ins**. Players never type an e-mail; the game makes an anonymous account the first
   time they open chat, a clan or co-op.
4. **Point the game at the project.** Go to Project Settings → API Keys / Data API and copy two values:
   - the **Project URL**, `https://<ref>.supabase.co`
   - the **publishable** key (`sb_publishable_…`), or the legacy **anon** key

   Then do one of these:
   - Put them in `.env.production` as `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`. This is what
     the repository does now, because the owner supplied them. Both values are public by design: they
     end up in every player's browser, and Row Level Security is what protects the data.
     **Side effect:** every production build made from a clone (`npm run build`, `npm run preview`)
     talks to the live project. To build without a server, run `npx vite build --mode offline` (any
     mode other than `production` skips `.env.production`); for local testing use `npm run dev`
     (local mode).
   - Or add them as **repository secrets** with the same two names, under GitHub → Settings → Secrets
     and variables → Actions, and delete `.env.production`. `.github/workflows/deploy.yml` passes them
     into the build, and they override `.env.production`. If a secret is empty or missing, it is
     ignored (see `vite.config.js`). Which of the two to keep is the owner's call.

   **Never** put the `service_role` / `sb_secret_…` key or the database password anywhere in the
   repository, the workflow or the game. The game does not need them.
5. **Deploy.** Push to `main`, then run the verification in the checklist above.

If no URL or key is configured, the build still succeeds. The game then runs in local mode, the pill
reads **Online features offline**, and chat, clans and co-op say in a yellow banner that they only reach
other tabs of the same browser.

## Modes

| Mode | When | Behaviour |
|---|---|---|
| Online | the build has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Supabase: anonymous auth, tables, Realtime |
| Local test mode | the URL has `?online=local` (dev, tests, e2e) | Chat, clans, the boss and co-op run between **tabs of one browser** (BroadcastChannel + localStorage). Each tab is a separate player |
| Online features offline | no config in the build, or the server cannot be reached | Same as local test mode, with a grey pill. Nothing leaves the device |

`npm run dev` and the e2e tests use `?online=local`. A local `npm run build` picks up `.env.production`
and talks to the real project (see step 4 above). In both local modes a yellow banner in chat, clans
and co-op says that messages, clans and rooms only reach other tabs of this browser.

## Security and limits

- **Row Level Security on every table.**
  - Players can read profiles, but can only write their own name, level and avatar. The server stamps
    `last_active` and `created_at` itself.
  - Global chat is readable by every signed-in player. Clan chat is readable only by members of that clan.
  - Messages are posted as yourself only. A trigger stamps your real name, level and avatar on each one.
  - All other changes go through `SECURITY DEFINER` functions that check the caller (`auth.uid()`) and
    their clan role. These are joining, leaving, roles, kicks, the clan boss, rewards, co-op rooms and
    transfer codes.
  - Helper functions (`add_member`, `enforce_rate`, `rate_retry_ms`, `random_code`, `system_message`, …)
    cannot be called by players.
  - Table privileges are granted explicitly, not left to the project's defaults. Players may read the
    game tables, insert or edit only `name`, `level` and `avatar` on their profile, and insert only
    `channel`, `body`, `kind` and `meta` on a message (and `user_id`, which must be themselves).
    Nothing can be updated, deleted or truncated directly. Transfer codes, co-op rooms, open boss
    battles and rate-limit records cannot be read at all.
- **What a row may hold** (table constraints, mirrored in `src/online/clanRules.js` and the local
  adapter):
  - Chat body: 1–200 characters. `meta` must be empty on a text message; on a co-op invite it may only be
    `{ room: 5 letters/digits, stage?: ≤ 16 characters }` and at most 256 bytes. (Without this, one
    player could post megabytes per message into the column every chat reader downloads.)
  - Display names: 2–16 characters, no `<` `>`, no invisible or control characters (Unicode Cf / Cc:
    bidi overrides, zero-width joiners, …), and none of the reserved names that would pass for a system
    notice, the Supply Bot or staff (`System`, `Supply Bot`, `Admin`, `Moderator`, `Developer`, …).
- **Codes are unguessable and guessing is limited.**
  - Transfer codes are 12 characters from a 32-letter alphabet (60 random bits from the server's
    cryptographic random source); invite codes are 8 such characters (40 bits).
  - A wrong code is *counted*: the functions return the miss instead of raising it, so the rate-limit
    row commits. After 5 transfer tries an hour (or 10 clan joins / code tries) even the right code is
    refused until the window passes.
- **Clan boss damage is checked against time.** "Fight" calls `start_boss_attempt()`, which records when
  the battle began. `submit_boss_damage(attempt, damage)` only counts what a battle of that length
  could deal: nothing under 10 s, then up to the boss's per-battle cap × (seconds ÷ 50), and never more
  than the cap itself (175,000 – 230,000 depending on the boss, a maxed team's full clear
  plus ~15%). A submit with nothing to count uses no attempt. The weekly HP pool scales with the clan:
  cap × 3 attempts × members (at least 2) × +20% per clan level. The damage number still comes from the
  client, so a cheater can at most score one perfect battle per attempt.
- **Co-op rooms are private.** `open_room()` registers the room code for the host, `join_room()` gives the
  one free seat to the first guest, and only those two receive the room secret. The Realtime channel is
  `coop:<CODE>:<secret>`, so knowing the 5-letter code is not enough to listen to or write into a room.
- **Rate limits.** The same numbers are in `src/online/limits.js` (client, for instant feedback) and in
  the SQL (server, authoritative). A test checks they match.

  | Action | Limit |
  |---|---|
  | Chat message | 1 per 2 s, 20 per minute |
  | Create clan | 1 per 10 min, 3 per day |
  | Join / request / leave / invite-code try (a wrong code too) | 10 per hour |
  | Clan boss attempt (a scored battle) | 3 per rolling 24 h |
  | Clan boss battle start | 20 per hour |
  | Transfer code (create or redeem, a wrong code too) | 5 per hour |
  | Co-op room (open or join, a wrong code too) | 1 per second, 20 per hour |

- **Developer clan.** It is invisible when browsing, and only the code joins it. The code `Rosie777` is
  in this public repository, so treat the dev clan as a toy. The Supply Bot only changes the player's own
  local save. There is no server-side economy for it to break. To change the code, run this in the SQL
  editor:

  ```sql
  update clan_codes set code = 'NewCode' where clan_id = '00000000-0000-4000-8000-000000000777';
  ```

  Then change `DEV_CODE` in `src/online/clanRules.js` too, for local mode.
- **Transfer codes** work like a password for your save. Each code works once and expires after 24 h,
  and creating a new one deletes your previous unused one. The payload is a copy of the save; the
  original stays on the device.
- **Housekeeping.** Chat older than 14 days and rate-limit records older than 25 hours are deleted as
  new rows arrive. There is no cron job.

**Free plan quotas.** These are the ones that matter, as of 2026; check the Supabase pricing page.

- **Realtime:** 200 concurrent connections, 100 messages per second for the whole project, 2 million
  messages per month.
  - Chat and clan updates use very little.
  - Co-op on Supabase sends one lockstep packet when a player gives an order and otherwise about 4 a
    second per player while the battle runs (1 a second when nothing changes). State hashes ride on
    those packets. Counting each packet once sent and once received, a room uses about 16 messages a
    second, or about 6,000 for a 6-minute battle: roughly **330 co-op battles a month**, and about
    **6 rooms at the same moment** before the 100-per-second cap starts throttling (which would also slow
    chat). The local transport keeps the faster 20-a-second profile.
  - The knobs are `net` in `openRoom()` in `src/online/adapters/supabase.js` (`heartbeatMs` 250,
    `inputDelay` 30 ticks, `keepaliveMs` 1000). If co-op ever outgrows this, the next step is a WebRTC
    DataChannel between the two players, with Supabase broadcast used only to set it up.
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

### Co-op lobby: finding each other

- **The room channel is broadcast only.** `openRoom()` in `src/online/adapters/supabase.js` joins
  `coop:<CODE>:<secret>` with `broadcast: { self: false, ack: false }` and nothing else: no presence key,
  no presence listener, no `track()`. (Until 2026-10-13 it tracked presence; on some Realtime server nodes
  that call hung, the server crashed the channel every ~6 s, and the player on such a node could hear
  but never be heard. See Troubleshooting.)
- **Messages go out as soon as the channel is joined.** Anything sent while it is down waits in a small
  outbox: only the newest heartbeat / start / ready / stage message of each kind is kept, and hellos are
  not kept at all (they are re-sent on every join).
- **The channel heals itself.** After `CHANNEL_ERROR` or `TIMED_OUT` realtime-js rejoins the same channel
  (after 1, 2, 5, 10 s). A channel that is `CLOSED`, or not joined 12 s after a (re)join began, is replaced
  by a fresh one on the same secret after a backoff of 1 s, 2 s, 4 s … 15 s (±20%). No new `open_room` /
  `join_room` call is needed for that, so the room rate limit is not touched. Every state change is
  reported to the lobby: `connecting` → `connected` (again with `rejoin: true`) → `reconnecting`.
- **The handshake heals itself too** (`src/online/coop/session.js`). Broadcast is lossy: a message sent
  while the other side is not subscribed is gone. So nothing is said only once:
  - each side says `hello` right after every (re)join;
  - the hello says whom I see (`sees`) and carries my ready flag, and the host's carries the stage;
  - until the other side's hello says it sees me, I say hello every second, and I answer every hello
    that does not see me yet (at most every 0.4 s);
  - once both see each other, a keepalive hello every 3 s; a lost `ready` or stage change fixes itself
    with the next one;
  - an ally silent for 10 s while my own link is up has left (a `leave` message or closing the tab is
    instant);
  - a version mismatch clears as soon as the same player says hello again on my version (after a
    reload).
  Normally the guest sees the host within one round trip of its channel joining (well under 3 s).
- **What the lobby shows.** "Connecting to room…" until the channel is joined, then "Waiting for your
  ally…" (host) or "Looking for the host…" (guest), "Reconnecting…" while the link is down, and after
  15 s without a host (or without a link) a banner with what to check and a **Retry** button. Retry takes
  the seat again (`join_room` / `open_room`, so a room that is gone says "No room uses that code") on a
  fresh channel. A code with a typo is refused by `join_room` straight away: "No room uses that code".
- **Lobby traffic** is small: 1 hello a second per player while they look for each other, 1 every 2 s
  for a host waiting alone, then 1 every 3 s each.

### Co-op lockstep

- **Same simulation on both clients.** The host's start message carries:
  - the seed, stage and difficulty;
  - both players' girls: the host brings the hero plus 5 girls, the guest brings 6 girls.

  Both clients build the same seeded Sim from it, with enemy HP ×1.6 through the stage's `hpScale`.
  `src/sim` is unchanged.
- **Compatible versions on both clients.** After a deploy, a tab left open (or an `index.html` the
  browser kept for GitHub Pages' 10 minutes) can meet an updated client, and that pair would desync
  every time. `hello` and `start` carry `coopVersion()` (`src/online/coop/version.js`): the protocol
  number, the **sim id** (a hash of every source file the lockstep battle runs on — the import graph of
  `src/sim`, `src/online/coop` and `src/online/adapters`, computed by `tools/simId.mjs` in
  `vite.config.js`), a hash of the battle data, the git commit and the player-facing version. Two
  clients pair when protocol, sim id and data match, so deploys that only change art, audio, menus or
  the renderer don't split players. When they differ the lobby names both versions and who is behind
  ("Chuu is on v0.1.16 and you're on v0.1.17 …"); the one behind gets an **Update** button.
- **Version number + updates.** Every deploy gets a player-facing version `<major>.<minor>.<deploy
  number>` (GitHub Actions run number; local builds say `0.1.dev`), shown on the title screen, in
  Settings → About (with *Check for updates*) and in the co-op room. The build writes `version.json`
  next to `index.html`; the game fetches it uncached every 5 minutes, when the tab comes back and on
  the co-op screens (`src/core/updates.js`). A newer deploy shows a "New version ready" pill (never
  during a battle; on the title screen it just reloads). Update reloads into `?v=<build>`, a URL the
  browser never cached, so the new `index.html` really loads. A screen whose file vanished in a deploy
  makes the page reload itself once into the new build; within a minute of that it shows "This screen
  did not load" with Try again / Reload instead of a blank page.
- **Same math on every engine.** JavaScript does not require `Math.sin`, `cos`, `atan2`, `hypot`, … to
  be correctly rounded, and the engines really differ in the last bit (`node e2e/engines.mjs` shows it:
  V8, JavaScriptCore and SpiderMonkey all disagree on `Math.sin`, and even Node 22 and Chromium 141
  do). Over a long battle such a bit can flip a range check, so an iPhone and an Android phone would
  drift apart. Every co-op Sim call therefore runs inside `withDetMath()`
  (`src/core/detMath.js`, re-exported from `src/online/coop/detMath.js`), which swaps those functions
  for ports of FreeBSD's msun built only from + − × ÷ and `Math.sqrt` (which IEEE-754 fixes to the
  bit). The **map builder** (`src/core/track.js`, `src/data/maps.js`) runs when the game loads,
  outside any battle, so it calls the ports directly (`DET_MATH`): with the engines' own trig, desktop
  Chrome and iPhone Safari built road samples 1 ulp apart, the lobby's battle-data hash differed and
  the two could never pair ("both on v0.1.17" yet refused). `tests/core/engineMath.test.js` nudges
  every Math function by one ulp and requires the same lobby hash, and lints `src/core/track.js` +
  `src/data/*.js` for engine Math. `e2e/engines.mjs` runs one whole scripted co-op battle in Node,
  Chromium, Bun, WebKit and Firefox and requires identical battle hashes **and lobby data hash**
  (Bun = JavaScriptCore, the iPhone engine: `BUN=~/.bun/bin/bun node e2e/engines.mjs`).
  Single-player battles keep the native functions.
- **Only commands travel.** These are place, upgrade, sell, target, ult, wave, auto-start and speed.
  - Each command is stamped with a tick a little ahead: 6 ticks (0.1 s) on local tabs, 30 ticks
    (0.5 s) on Supabase, multiplied by the game speed. Tower defense hardly notices half a second.
  - Both clients execute it at exactly that tick.
  - Commands that land on the same tick run in player, then sequence order.
  - A command from the ally is checked again on arrival: a girl id that is not hers, an unknown
    targeting mode or upgrade path, or coordinates that are not on the 1/1024 grid do nothing.
- **Promises.**
  - Every heartbeat says "I will send nothing more up to tick N". A client only runs tick T when its ally
    has promised T. Otherwise it shows **Waiting for ally…** and raises its input delay (up to 3×).
  - A heartbeat goes out at once when the player gives an order; otherwise only when the promise has
    moved on by half an input delay (local: every 50 ms; Supabase: at most every 250 ms) or, when
    nothing changes, as a keepalive (Supabase: once a second).
  - Unacknowledged commands are re-sent with every heartbeat, so a lossy link is fine.
- **Wallets.**
  - Each player starts with 60% of the stage's coins.
  - Each command runs with its player's coins and loadout swapped into the Sim. This also enforces
    "only your own girls".
  - Coins earned are split evenly, with the odd coin alternating.
  - Only a girl's owner can upgrade, retarget or sell her.
- **Desync check.** Both clients compute a state hash every 120 ticks; the last two ride along on every
  heartbeat.
  - On a mismatch the guest asks the host for its command log and replays it from the start.
  - A second mismatch within 30 s ends the link. Both players continue solo.
- **Disconnect.** A peer is dropped when it says bye (Leave, closing the tab) or is silent for 12–20 s.
  It gets longer (30 s) while the ally's battle is still loading.
  - The ally's girls stay on the map and keep fighting.
  - Their future income goes to the survivor.
  - The survivor's battle never stops.
- **Reconnect.** A peer that was only *lost* (a phone switching apps, a long load, a network hiccup) is
  taken back as soon as its packets arrive again; leaving on purpose is final.
  - The host offers its timeline: the start message plus its whole command log, in which the drop and
    the return are recorded as `gone` / `join` markers at exact ticks.
  - A guest that was only frozen (its battle never ran on alone: a long load, a phone switching
    apps) is still on the host's timeline: it keeps its battle screen, takes the host's newer
    commands and fast-forwards in place.
  - A guest that played on alone meanwhile rebuilds the battle from that log (its battle screen
    reloads), fast-forwards to the host's tick, and both continue in lockstep. Orders the guest gave
    while it was cut off are lost.
  - Every packet carries the timeline's epoch, so stale packets from before the rejoin are ignored.
  - An offer that is not taken within 6 s (a one-way link) is withdrawn and retried later with a
    doubling pause (8 s … 60 s), so the host never waits long.
  - Each client keeps its last 40 connection events (`lockstep.trace`: mount, live, drop, bye,
    rejoin, adopt, resync with tick and time) for debugging.
- **Rewards.** Each player gets the stage drops on their own device. Medals stay solo.

## Tests

```bash
npx vitest run tests/online
node e2e/online.mjs
node e2e/online.mjs --viewport 844x390 --shots /tmp/online
node e2e/engines.mjs          # the same co-op battle in V8, JavaScriptCore and SpiderMonkey
```

The vitest suite covers:

- `limits.test.js`: rate limiter.
- `localDb.test.js` and `localAdapter.test.js`: the local server, and two tabs chatting, joining clans
  and finishing a co-op handshake and battle; meta and name checks, counted wrong codes, timed boss
  attempts, private rooms, and a client of another build refused in the co-op lobby.
- `clanRules.test.js` and `clanBoss.test.js`: roles, levels, names, invite meta, boss caps against
  real Total Assault clears.
- `lockstep.test.js`: two clients with random latency stay identical through a whole battle. It also
  covers loss, desync repair, a disconnect, slow devices and reconnecting (a frozen guest, a cut in
  both directions, a one-way cut, a deliberate leave, and the replayed drop/return markers), the
  Supabase message budget (about 4 packets a second, hashes folded in), forged or junk commands.
- `detMath.test.js`: the deterministic sin / cos / atan2 / hypot / … stay within 2 ulp of the engine's own,
  are swapped in only while a co-op call runs, and keep a battle bit-identical when Math is perturbed.
- `engines.test.js`: keeps the cross-engine battle (`e2e/engines/scriptedBattle.js`) finishing in sync
  with every scripted order accepted.
- `battleRoute.test.js`: solo battle routes never pick up a co-op session.
- `coopSession.test.js`: the lobby handshake over a fake network with simulated time: pairing time, a
  mute host found as soon as its link works (no reconnect needed), a lost answer, hello on every rejoin,
  a lost `ready`, the 10 s silence rule (not while my own link is down), a mismatch that clears, the
  15 s "cannot find the host" state and Retry, a code with a typo, the lobby message budget, a third
  player, and the start message re-sent until the guest answers.
- `supabaseRoom.test.js`: the Supabase room channel against a scriptable fake: no presence, the outbox
  flushed at the join, status reports, realtime-js's own rejoin, a fresh channel after `CLOSED` or when
  stuck (with backoff, and not while the socket itself is down), Retry, and close.
- `schema.test.js`:
  - lints the migration;
  - runs it twice on real Postgres (PGlite) against a stub of Supabase's auth schema, once with
    Supabase's classic default table grants and once with none;
  - exercises RLS, the table and column grants, every function and the server rate limits as
    several players, including a 2 MB `meta` (refused), the 6th wrong transfer code in an hour
    (refused, then even the right one), wrong invite codes, boss damage against the battle's length,
    and room secrets.
- `supabaseAdapter.test.js`: runs the Supabase adapter against a recording fake of supabase-js. Every
  table, column, function, parameter and realtime filter it uses must exist in the migration, and
  every column it writes must be granted to players.

The e2e test opens two pages of one browser in local mode. It checks:

- chat delivery and rate-limit feedback, the local-mode banner, and the lobby's chat bubble drawer;
- clan create and join;
- the clan boss, including one attempt through a real battle that lands on the damage ranking;
- the Rosie777 Supply Bot;
- the co-op lobby with faked connection faults (`window.__coop.room._cut()` / `_heal()` in local mode):
  a code with a typo, a mute host that the guest cannot find (the 15 s banner and Retry) and then finds
  within seconds once the host's link works again, a `ready` lost on a mute link, and a dropped guest
  link that shows "Reconnecting…" and comes back paired and still ready;
- a co-op battle where both players place a girl and the state hashes match, a dropped and re-admitted
  guest, and the host playing on alone.

`e2e/engines.mjs` bundles `e2e/engines/scriptedBattle.js` once and runs it in Node, Bun, and Playwright's
Chromium, Firefox and WebKit (whichever are installed; at least two engines must run, `--require-all`
needs all). Install the extra browsers with `npx playwright install --with-deps firefox webkit`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Pill says **Online features offline** on the live site | The build had no URL or key. Check `.env.production`, or the repository secrets, and redeploy |
| "The game server is not set up yet" | The migration has not run. Check the GitHub integration's log in Supabase, or paste `supabase/migrations/20261008000000_online.sql` into the SQL editor |
| "Online features are offline right now" | The project cannot be reached: it may be paused (restore it in the dashboard) or down |
| "Anonymous sign-ins are disabled" | Authentication → Sign In / Providers → Allow anonymous sign-ins |
| Co-op lobby says the ally **is on an older / newer version** | The one with the lower number taps **Update** (or reloads). Settings → About shows your version and has *Check for updates* |
| Co-op shows **Waiting for ally…** often | High latency between the players. The input delay adapts up to 3× (1.5 s on Supabase); a closer Supabase region helps |
| Co-op says "No room uses that code" | The host closed the room, or the code is older than a day, or it has a typo. Ask for a new one |
| Co-op guest keeps saying **Looking for the host…**, then "The host … has not answered yet" | The host's page is closed, asleep (phone screen off) or on another version. The host opens the room again (or makes a new one); the guest taps **Retry**. If it still fails, check the browser console of both players for `phx_error` on a `coop:` topic and see the next section |
| Co-op lobby or battle says **Reconnecting…** | That player's Realtime connection dropped (network change, phone sleeping). The game rejoins on its own within 1–15 s and says hello again; nothing to do. If it never ends, reload the page |

### Realtime presence crashed co-op rooms (found 2026-10-13, fixed in the game)

**Symptom (before the fix).** Joining "didn't work": the host saw the guest, the guest never saw the host,
and Ready stayed disabled. In the browser's network panel (WS frames) the host's `coop:…` channel got
`phx_error {"reason":"channel_crash"}` about 5 s after every join, rejoined, and crashed again.

**Cause (server side).** On some Supabase Realtime server nodes a presence `track()` did not finish within
the server's 5 s limit, so the server killed the channel. While the call hung, nothing the player sent was
processed, and everything was dropped when the channel crashed. Which node a connection lands on is luck:
on 2026-10-13 (16:14–16:38 and 21:25–21:45 UTC, through Cloudflare's IAD edge) about half of all
connections did. It reproduced outside the browser (plain Node `ws` and Node's built-in WebSocket), with
any presence payload, with or without broadcasts, and with the JSON or the binary protocol; without
`track()` the same connections paired in 65–130 ms.

**Fix (client side, no owner action needed).** Co-op rooms no longer use presence at all (see "Co-op
lobby" above); the lobby's own hellos tell who is in the room. Nothing in SQL or the dashboard has to
change.

**Owner steps (optional).**
1. Keep **Realtime → Settings → "Allow public access"** switched on. Co-op rooms are public channels whose
   name contains the room secret; with public access off, joining fails with "Unauthorized: You do not
   have permissions to read from this Channel topic" (the project has no `realtime.messages` policies).
2. If you want Supabase to look at it: Dashboard → Support → new ticket, product **Realtime**, with the
   project ref, the times above and this summary: "presence `track` on a public channel takes > 5 s and
   the channel is killed with `channel_crash` on about half of connections; the same connections track in
   ~40 ms on other nodes". The investigation's logs (one socket × several topics: 3 of 6 sockets crashed
   on every topic, the others answered in 35–58 ms) are in the session's scratchpad, not in this repository.
3. Do not add presence back to co-op rooms. If a "who is online" feature ever needs presence, give it
   its own channel, so a slow track cannot block a room's messages, and never use it to decide that a
   player left.
| Chat says "Slow down" | Working as intended: 1 message per 2 s and 20 per minute |
| A transfer code is refused with "try again in …" | 5 tries an hour, wrong codes included. Wait, then type the code again carefully (`XXXX-XXXX-XXXX`) |
