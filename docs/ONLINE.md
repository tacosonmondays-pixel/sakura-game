# Online features: chat, clans, clan boss, co-op, messages, transfer codes

Sakura Sentinels is a static site on GitHub Pages. The online features talk to a **Supabase** project on
the free plan. Supabase provides anonymous accounts, Postgres with Row Level Security, and Realtime. The
game itself never needs the server: saves stay on the device, and every screen works offline.

| Feature | Where | What it does |
|---|---|---|
| Online profile | first online action, Settings → Online | Anonymous account, a display name (2–16 characters; "Not now" keeps an automatic `Sensei1234` name until you pick one), your account level, and your lobby secretary as avatar |
| Global chat | chat bubble at the top right of the lobby (slide-in drawer), or `#/chat` | Last 50 messages live, names, levels, avatars and times; "Slow down — 1.4 s" feedback |
| Clans | Menu → Clan, or `#/clan` | Create (name, TAG, emblem, open / request / invite code), search, join or request, leave; leader / officer / member roles; member list with last active; clan chat; clan level from members' activity |
| Clan boss | Clan → Clan Boss | Weekly boss with one shared HP pool. Every member's battle damage counts (3 attempts per 24 h). Damage ranking and claimable reward tiers S / A / B / C |
| Developer clan | Clan → Join with a code → the developer clan's private code (set by the owner in the database) | "Sakura Dev Lab" [DEV] with the **Supply Bot**, a clearly labelled DEVELOPER SANDBOX that grants any item or currency in any quantity to *your own local save* |
| Co-op | Missions → Co-op, Menu → Co-op, a clanmate's Co-op button, or `#/coop` | 2-player real-time battle on any unlocked campaign stage with enemy HP ×1.6. Each player has their own coins, girls and colour. Create a room, then join by its 5-letter code or from a clan invite |
| Transfer codes | Settings → Online | Copy your save to another device with a one-time code (`XXXX-XXXX-XXXX`, 60 random bits) that expires after 24 h. One live code per player: a new code replaces the last |
| Messages (DMs) and friends | tap a name (chat, clan roster, clan chat, co-op room, friends list) → player card; Menu → Messages; `#/messages` | Private text messages between friends (and, for players who choose Friends & clan, clanmates after 3 days in the same clan), unread badges, live delivery, block, report (press and hold a message to report that one), "Who can message me" (Friends only — the default · Friends & clan · Nobody). Friends by request (from any player card, global chat included) or by friend code (`K7Q2-ZP4M`) |
| Co-op invites by DM | a conversation's **Invite to co-op**, a player card, or the room lobby's **Invite a friend** | Opens a room for you as host and sends the invite once the server registered it; the friend gets a pop-up on any screen with **Join** (no code typing). Invites expire after 15 min or when the room closes or fills (a host's **Leave** keeps the room for "Your last room", so an invite into it stays good until it expires) |
| Clan requests | Clan → Requests | Once per game day ask your clan for one material; clanmates donate from their own backpacks (30 donation points a day each, +50 coins and +1 clan XP per point); collect what arrived with one tap. Everything resets at **7 PM Central** |

No profanity filter for now (owner's decision). Client **and** server rate limits are always on.

## Setup (about 5 minutes)

**The schema is two files**, applied in order: `supabase/migrations/20261008000000_online.sql` (chat,
clans, clan boss, co-op, transfer codes; already applied on the live project — never edit it) and
`supabase/migrations/20261013000000_social.sql` (messages, friends, co-op invites by DM, clan requests;
see "Run the social update" below). They are kept in the Supabase CLI layout so that Supabase's GitHub
integration can apply them. Paste them into the SQL Editor in that order if you set the database up by
hand; both are idempotent.

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
- [ ] **Run the social update** once the game update with Messages is live (see "Run the social
      update" below). Until then those features say "Needs the latest server update".
- [ ] **Run the clan invites update** once the game update with clan invites is live (see "Run the clan
      invites update" below). Until then "Invite to clan" and the recruiting post stay hidden.
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
  5. Optional: set the developer clan's code (see "Rotate the developer clan code" below); then
     Clan → Join with a code → that code opens the developer clan and its Supply Bot.

### Run the social update (messages, friends, co-op invites by DM, clan requests)

The game update that adds these features goes live **before** its database part. Until the owner runs
it, Messages, the player card's buttons, Settings → Online → "Who can message me" and Clan → Requests say
**"Needs the latest server update"**; chat, clans, the clan boss and co-op keep working exactly as before.

1. Wait until the game update is live (the Pages workflow is green).
2. Open the new migration's raw file on GitHub:
   <https://raw.githubusercontent.com/tacosonmondays-pixel/sakura-game/main/supabase/migrations/20261013000000_social.sql>
   (or open `supabase/migrations/20261013000000_social.sql` on GitHub and press **Raw**). Select all
   (Ctrl+A / ⌘A) and copy.
3. Supabase → **SQL Editor** → **New query** → paste → **Run**. It should end with **Success**.
   The file is idempotent: running it again is safe. (If the GitHub integration is connected, merging
   to `main` already applied it; check Integrations → GitHub's log.) Never paste a service-role key
   anywhere: nothing here needs one.
   **Running the social SQL** while players play is fine: the file runs as one transaction and first
   waits for a quiet moment to lock the tables it changes all at once (players' requests wait the
   second or two it needs; no "deadlock detected"). If it stops with **"The game is busy right now, so
   nothing was changed"** — or any other error — nothing at all was applied: press **Run** again (a
   minute later, or at a quieter time).
4. Check: run `select public.social_version();` in the SQL Editor. It returns `1`.
5. Reload the game. Settings → Online shows "Who can message me" and your friend code; Menu → Messages
   opens; Clan → Requests shows "Ask for materials". Open screens notice by themselves within 5 minutes.

**Important:** if `20261008000000_online.sql` is ever pasted again, paste `20261013000000_social.sql`
again right after it (the old file resets every function grant and restores the old `join_room()`
without the block check).

### Run the clan invites update (invite players to your clan, the daily recruiting post)

The game update goes live **before** its database part. Until the owner runs it, nobody sees "Invite to
clan", invite cards or the "Post to global chat" button; chat, clans, messages, friends and co-op keep
working exactly as before.

**What to paste:** `supabase/migrations/20261018000000_clan_invites.sql`, once, **after**
`20261013000000_social.sql` and `20261015000000_social_open_friends.sql` (run those first if they haven't
been yet). The profile and player-tags files don't matter for it: before or after is fine.

1. Wait until the game update is live (the Pages workflow is green).
2. Open the raw file on GitHub:
   <https://raw.githubusercontent.com/tacosonmondays-pixel/sakura-game/main/supabase/migrations/20261018000000_clan_invites.sql>
   (or open `supabase/migrations/20261018000000_clan_invites.sql` on GitHub and press **Raw**). Select
   all (Ctrl+A / ⌘A) and copy.
3. Supabase → **SQL Editor** → **New query** → paste → **Run**. It should end with **Success**. The file
   runs as one transaction: on any error nothing at all was applied, so press **Run** again (it first
   waits up to 30 seconds for a quiet moment in chat; "The game is busy right now" means try again in a
   minute). Safe to run more than once. No key of any kind is needed or should be pasted anywhere.
   If it stops with **"Run 20261013000000_social.sql first"**, the social update is missing: run that
   (see above), then this file again.
4. **Check query:** run `select public.clan_invites_version();` in the SQL Editor. It returns `1`.
5. **What success looks like:** reload the game.
   - As a clan leader or officer, tap the name of a player who is in no clan (in global chat, or open a
     conversation's ⋯ menu): **Invite to [TAG]** is there. They see the invite in Messages → Requests (and
     on Clan → Find a clan) with **Join** / **Decline**.
   - The clan screen shows **Post to global chat** for the leader and officers. After posting, a card with
     the clan's emblem, name, members and **View clan** / **Join** appears in global chat, and the button
     reads "Posted today" until 7 PM Central.

**Important:** if `20261008000000_online.sql` is ever pasted again, paste the social files and then
`20261018000000_clan_invites.sql` again right after them (the first file restores the old chat rules, and
new recruiting posts would be refused until this file runs again).

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
| Local test mode | the URL has `?online=local` (dev, tests, e2e) | Chat, clans, the boss, co-op and the social features run between **tabs of one browser** (BroadcastChannel + localStorage). Each tab is a separate player. Add `&social=0` to play a server without the social update ("Needs the latest server update") |
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

- **Developer clan.** It is invisible when browsing, and only the developer clan's private code (set
  by the owner in the database) joins it. That code is never in this public repository: the migration
  seeds the clan without a code, and pasting the migration again never resets or re-creates it. The
  owner sets and rotates it in the SQL editor (see "Rotate the developer clan code" below). The Supply
  Bot only changes the player's own local save. The offline test backend (local mode, everything in
  one browser) has its own public test code, `LOCAL_DEV_CODE` in `src/online/clanRules.js`, which
  works only there and only in dev builds and tests; a production build's local mode has no developer
  clan code at all.
- **Transfer codes** work like a password for your save. Each code works once and expires after 24 h,
  and creating a new one deletes your previous unused one. The payload is a copy of the save; the
  original stays on the device.
- **Housekeeping.** Chat older than 14 days and rate-limit records older than 25 hours are deleted as
  new rows arrive. There is no cron job.

### Rotate the developer clan code

Only for the owner, in Supabase → SQL Editor. Pick a new code (up to 16 characters, the game's input
limit; long and random is best), and **never commit it** or write it in an issue, a doc or a chat.
Codes are matched without regard to case.

```sql
-- set / rotate the code (replace the placeholder; keep the quotes)
update public.clan_codes set code = '<NEW-DEV-CODE>'
where clan_id = '00000000-0000-4000-8000-000000000777';

-- a brand-new project has no code row yet (the update above says "UPDATE 0"): insert it once instead
insert into public.clan_codes (clan_id, code)
values ('00000000-0000-4000-8000-000000000777', '<NEW-DEV-CODE>')
on conflict (clan_id) do update set code = excluded.code;
```

Rotating the code does not remove anyone. Members stay until they leave or are removed:

```sql
-- who is in the developer clan
select m.user_id, p.name, m.joined_at
from public.clan_members m join public.profiles p on p.id = m.user_id
where m.clan_id = '00000000-0000-4000-8000-000000000777'
order by m.joined_at;

-- remove one member (rotate the code first, or they can join again)
delete from public.clan_members
where clan_id = '00000000-0000-4000-8000-000000000777' and user_id = '<their user_id>';
```

### Messages, friends, co-op invites and clan requests (the social update)

Everything below is in `supabase/migrations/20261013000000_social.sql`; the client mirrors live in
`src/online/socialRules.js`, `src/online/donateRules.js` and `src/online/limits.js`. Players may be
young, so the defaults are the safe ones.

- **Who can message whom.** A DM needs *both* players' "Who can message me" to allow it:
  - **Friends only** (default): a friendship needs the player to accept a request, while anyone can
    join an open clan and wait 3 days, so friends are the safe default for young players.
  - **Friends & clan**: friends, and clanmates once *both* have been in the same clan for 3 days (the
    developer clan never counts). A player chooses it in Settings → Online or Messages.
  - **Nobody** (no DMs and no DM invites at all, friends included).
  - Strangers can never message each other; there is no "Everyone". To add someone met in global
    chat, swap friend codes. A missing setting means the default, never "open".
  - Never if either player blocked the other, or the sender is muted. A blocked sender gets exactly the
    same refusal as a privacy refusal ("… can't get messages from you yet"), so a block is never revealed;
    the same goes for donations (the request of someone who blocked you is simply not listed, like a
    filled one, and `donate()` says "closed") and co-op rooms (a block either way reads "full").
  - What the card says when Message is off depends only on what the viewer may know: "Only friends and
    clanmates can message each other" (strangers — no setting allows them), the viewer's *own* setting
    (Friends only / Nobody, sent as `myPrivacy`), "clanmates after 3 days", or "X isn't taking messages
    right now" for a friend whose side says no (a block and a setting read the same).
- **Friends.** Mutual (request → accept). Anyone may ask from a player card anywhere, global chat
  included (owner, 2026-10-15: `20261015000000_social_open_friends.sql`; before it a request needed the
  same clan, a co-op game in the last 7 days, or the friend code). The request is stored with how it came
  (`clan`, `coop`, `code`, or `any`). Requests carry no text, only the sender's name as it
  was when sent (names can change 3 times a day). A declined, blocked or "Nobody" request is silently
  swallowed for 30 days (the sender still sees "Requested"); a full queue (30) drops its oldest request.
  A cancelled request stays as a tombstone: asking again within a day is swallowed too (request → cancel
  → request cannot pop up again and again), and a block + unblock keeps every tombstone (it never resets
  "declined"). 50 friends at most; the caps (50 friends, 10 requests a day per recipient) take a lock on
  the players involved, so they hold when many requests or accepts arrive at once. Friend codes are 8
  characters (40 random bits), shown only to their owner, and reset with **New code**. A code decides who
  may *ask*; it is no secret identity (every profile's id, name and level is readable, see Known limits).
- **What a DM may hold.** Text only, 1–200 characters, shown as plain text (no links, no images, no
  HTML). No control / bidi / zero-width / tag characters, no blank-looking fillers, line separators or
  invisible marks (combining grapheme joiner, Khmer inherent vowels, the null notehead), at least one
  *visible* character (spaces of every kind — NBSP, U+2000–U+200A, the ideographic space — joiners,
  variation selectors and lone marks don't count), at most 4 stacked marks in a row — accents, Hebrew
  points, Arabic harakat, Thai and Lao vowel / tone marks alike (a wall of 150 Thai tone marks on one
  letter is refused; chat and DM bubbles also clip anything taller than their text). Emoji sequences (ZWJ),
  Japanese ideographic variants and an ideographic space inside a sentence are fine. The sets are code
  points in SQL and JS alike (never a locale class). The server stamps the sender's name, level and
  avatar. The same rule applies to new chat messages (`messages_social_guard` trigger).
- **Names** (new and changed ones only — a trigger, `profiles_name_rules`, never a check constraint, so a
  name accepted before the social SQL never locks its player out of chat, clans or co-op): visible
  letters, no space of any kind at either end, and no look-alike of a reserved name (fullwidth letters,
  accents, Cyrillic / Greek look-alikes such as "Ѕystem" or "Supply Bоt" are compared as plain Latin:
  `name_key()` = `nameKey()` in `src/online/textRules.js`; so are Cherokee, Lisu, Armenian, Coptic,
  small-capital, "fancy text" syllabics, stroked and boxed look-alikes such as "Ꭺdmin" or "ᴅᴇᴠ", and
  invisible characters inside a word are dropped first), no Latin letters mixed with letters of those
  look-alike alphabets ("ᎠEV Rosie": `lookalike_mix()` = `mixesLookalikes()`), no staff word anywhere
  in it with digits read as letters ("Staff Hana", "Adm1n", "SupplyB0t", "Sakura Sentine1s";
  "Badminton" is fine) and no gm / dev / mod as a word of its own ("GM Rosie", "Dev Rosie", "D.E.V.
  Team", "GMRosie", "DevTeam"; "Devi", "Devon" and "Modé" are fine) — `reserved_name()` =
  `reservedName()` in `src/online/clanRules.js`. A player who kept such an old name
  can still chat and play co-op; DMs, invites and friend requests ask them to change it first.
- **Clans** (new and changed ones only — a trigger, `clans_text_rules`; clans from before the social
  SQL are untouched and the paste never fails on them): the name follows the DM text rule with
  visible letters (no zero-width or right-to-left tricks), mixes no look-alike alphabet into Latin
  letters ("Sakura ᎠEV Lab"), is not reserved or staff-looking, never reads as the developer clan
  ("Sakura Devs") and is not another clan's name in a different spelling ("Moon-Clan" next to "Moon
  Clan", "さくら組" with an invisible joiner next to "さくら組": `clan_name_key()` = `clanNameKey()`;
  "さくら Clan" and "ひまわり Clan" are different names); the description follows the DM text rule; the tags DEV, GM, MOD, ADM, STAF, SYS,
  BOT (and their plurals / digit spellings such as D3V) and the `wiki` emblem belong to the developer
  clan. `validateClan()` says the same in the game first. A **kicked** player cannot join that clan
  again by themselves (open or by code) for 7 days (`clan_bans`, no player access); a leader or
  officer accepting their join request lets them back in. Leaving by yourself bans nobody.
- **Co-op invites by DM** follow the DM rules. Only the host of a room with a free seat can invite; the
  server writes the invite text and its expiry (15 min); one live invite per pair (a new one replaces the
  old) and 4 per hour to the same player. When the host leaves the room lobby (Leave, a new room, or
  another screen) their invites into it expire (`expire_coop_invites`), so nobody joins an empty room.
  "Later" on the pop-up closes that pop-up only (the invite waits in Co-op → Invites and in the
  conversation; the next invite pops up again). Co-op → Invites shows the newest invite per sender and
  asks the server whether it is still open. The pop-up shows for 20 s (a DM 6 s, a friend request 7 s);
  one under the pointer / finger or with keyboard focus stays until it is let go (then 4 s more), and an
  invite still closes when it expires. Reply / Join / View close any open window (Menu, a gift, a card)
  before they open their screen. On a phone held sideways the pop-ups sit on the left under the top bar
  (the coins and the chat drawer stay free). "Invite to co-op" on the card of the ally already in my
  room says "In your co-op room"; leaving a room for a new one is asked first.
- **Block** (≤ 200): no DMs, invites, friend requests or donations between the two, the friendship
  goes, the blocked player's pending request is swallowed (they keep seeing "Requested", as after a
  decline), the conversation leaves the blocker's inbox, the blocker no longer sees their chat lines,
  their clan requests or the clan's system notices about them ("X joined the clan."): each notice
  carries who it is about (`messages.about`, written only by the server), so a rename changes nothing;
  older notices are matched by the exact names the blocked player was seen with. Co-op: a block frees
  the blocked player's seat in the blocker's room and changes the room's secret (their Realtime
  channel goes dead; the blocker's lobby reopens the room on the new one by itself) — also when they
  sat in that room earlier and left (they still know its secret), unless someone else has the seat
  now — a
  blocker who sat in the blocked player's room leaves it, and `join_room` answers "full" when either
  player blocked the other. The lobby never pairs with a player you blocked
  (`src/online/coop/socialRoom.js` drops their lobby hellos; it wraps the session from outside so the
  co-op compatibility id below stays the same).
- **Report**: reason chips (bullying, inappropriate words, spam, asked for personal info, something
  else), an optional note, "Also block" (on by default). In a conversation, press and hold (or
  right-click) one of their messages to report exactly that one; the conversation menu's Report sends
  their newest. The **server** copies the evidence (the reported message, the newest DMs between the
  two — up to 20, ≤ 8 KB —, `dmsTotal` and `dmsFromTarget`: how many DMs the two have in all and how many
  the target sent, the target's name) into `reports`, which no player can read. While a report is
  **open** the whole conversation of the two is kept (up to 90 days), so the owner reads all of it
  (Moderation below) before marking it reviewed. One open report per reporter and target: a repeat
  *adds* to the evidence (`message` is the newest reported one, `earlier` the ones reported before,
  and every line of the first snapshot stays), "Asked for personal info" stays the reason, an empty
  note never replaces the child's note, and every earlier reason / note / place is kept in
  `evidence->'earlierReports'` (the newest 10). `reports.message_id` is the message the server found
  and checked (`evidence->'message'`), never the number the game sent.
- **Auto-mute**: 3 reporters within 24 h whose report *counts* — online accounts at least 7 days old that
  the target reached through what the mute silences (a DM, a co-op invite or a friend request in the
  last 7 days) — mute the target from DMs, invites and friend requests for 24 h. Seeing one public chat
  line is no contact, and chat is only muted by the owner. `reports.qualified` (backed by contact) is
  recomputed on every repeat; `reports.qualified_at` decides the mute, and a repeat report counts again
  only after *new* contact, so the same three accounts cannot mute someone day after day. Brand-new alt
  accounts cannot mute anyone.
- **Who reads what.** Players read only three new tables directly, for Realtime: DMs they sent or
  received, friend requests sent *to* them (pending only) and their clan's material requests. Every other
  read and every write is a `SECURITY DEFINER` function that checks `auth.uid()`. Internal helpers are
  `SECURITY INVOKER` and revoked; a test fails if players can execute any function outside an explicit
  allow-list. URLs carry conversation ids, never account ids. (A friend code's answer carries no account
  id either, but name + level + avatar can be matched against the readable profiles: the code only
  decides who may ask — see Known limits.)
- **Clan requests and donations.** The server never sees backpacks (saves are local), so a donation is
  "the server lets a clanmate grant up to the caps": the caps, not the donor's honesty, bound what anyone
  can receive.
  - Requestable: materials only (7 families), common · rare · super rare · mythic. Never legendary,
    books, crowns, Star Fragments, dice, pins, gear boxes, tickets, tokens, coins, gems or event items.

    | Rarity | Request size | Most from one donor | Points per piece | Extra rule |
    |---|---:|---:|---:|---|
    | Common | 10 | 5 | 1 | |
    | Rare | 6 | 3 | 2 | |
    | Super rare | 3 | 2 | 5 | 3 requests per rolling 7 days |
    | Mythic | 1 | 1 | 10 | 1 per 7 days; clan ≥ 14 days old with ≥ 5 members of ≥ 3 days |

  - **One request per player per game day** (across clans; cancelling does not give it back), after a
    day in the clan. **Donors: 30 points per game day** (≤ 1,500 coins), +50 coins and +1 clan XP per
    point; donors need 3 days in the clan and an online account at least 7 days old, and cannot donate
    for 7 days after leaving the developer clan (its Supply Bot grants anything).
  - The **game day** ends at **7 PM America/Chicago** (DST-aware; `game_day_key()` names it by the date
    it ends). Requests close at the next 7 PM; donations wait 7 days for their requester, even after
    leaving or being removed from the clan (the clan list shows "Donations waiting for you").
  - Exactly once with a local save: a donation leaves the backpack before the server call (escrow in
    the save) and comes back only after a definitive refusal or after `settle_donations()` voided its
    key; collecting uses a replayable key (24 h). See `src/online/donateLedger.js`.
- **Social rate limits** (client + server, same numbers):

  | Action | Limit |
  |---|---|
  | Private message (and DM invite text) | 1 per 2 s, 20 per minute, 300 per rolling day |
  | New conversation (first message to someone) | 10 per rolling day |
  | Co-op invite by DM | 1 per 5 s, 20 per hour; 4 per hour to the same player |
  | Friend request / friend-code try (a wrong code too) | 10 per hour |
  | Block / unblock | 30 per hour |
  | Report | 1 per 10 s, 10 per rolling day |
  | Privacy change / new friend code | 20 per hour |
  | Player card | 120 per hour |
  | Name change | 3 per rolling day |
  | Donation | 1 per 500 ms, 60 per hour (the real caps are the daily points) |
  | Donation check (`settle_donations`) | 30 per hour; at most 100 voided keys per player at a time |

- **Retention** (deleted as new rows arrive, no cron): DMs after 14 days — every DM of those 14 days is
  kept (no per-conversation trim: a flood could otherwise push an abusive message out of a report's
  evidence; 300 DMs a day per sender bound the storage), and the DMs of two players with an open report
  between them until the report is reviewed (90 days at most); clan bans when they end; friend
  requests after 30 days; donations 7 days
  unclaimed / 30 days claimed; donation key tombstones: voided after 2 days (a late donate() can only
  land on the same game day), applied after 90; ended automatic mutes after 30 days; reports and owner
  mutes are kept until the owner deletes them.
- **Realtime.** `direct_messages`, `friend_requests` and `donation_requests` join the publication
  (`postgres_changes`, filtered and RLS-checked per player). The social features never use Realtime
  presence (see "Realtime presence crashed co-op rooms").
- **Known limits.** `profiles` (id, name, level, avatar, `last_active`) is readable by every signed-in
  player since the first migration (the social functions only hand `last_active` to friends and
  clanmates), so a friend code's owner can be matched to an account id by name + level + avatar.
  Supabase does not apply Row Level Security to Realtime DELETE events: a listener could see the ids of
  deleted DM / request rows (ids only, no content; the game never listens to DELETEs). If the first
  migration is ever pasted again it revokes the social grants (the game then shows "Needs the latest
  server update" until the social SQL is pasted again) and restores the old `join_room()`. Hiding the column needs
  column grants that old cached clients would trip over; the new client already reads profiles with
  explicit columns, so a later migration can do it. Friends, DMs and donations belong to the device's
  anonymous online account: a transfer code moves the save, not the account.

#### Moderation (owner, SQL Editor)

Check reports weekly (Table Editor → `reports`, filter `status = open`), sooner for "Asked for personal
info". Optional: a Database Webhook (Database → Webhooks, or Integrations → Database Webhooks) on
`reports` INSERT that posts to an e-mail / chat service of your choice (dashboard only; no keys go into
the repository).

```sql
-- open reports, "Asked for personal info" first, then newest; earlier = what the child said in earlier reports
select r.id, r.created_at, r.reason, r.note, r.context, r.reporter_name, r.target_name, r.qualified, r.target_id,
  r.evidence -> 'earlierReports' as earlier, r.evidence
from reports r where r.status = 'open' order by (r.reason = 'personal_info') desc, r.created_at desc;

-- the whole conversation behind a report (kept while the report is open; evidence->'dmsTotal'
-- says how many lines there are when the stored snapshot holds only the newest ones)
select m.id, m.created_at, case when m.sender_id = r.target_id then 'TARGET' else 'reporter' end as who, m.body
from reports r join direct_messages m
  on (m.sender_id = r.target_id and m.recipient_id = r.reporter_id) or (m.sender_id = r.reporter_id and m.recipient_id = r.target_id)
where r.id = 123 order by m.id;

-- mark one reviewed (or 'actioned'); the next housekeeping lets its conversation go after 14 days
update reports set status = 'reviewed', updated_at = now() where id = 123;

-- mute a player for 3 days (owner mutes also cover global / clan chat)
insert into social_mutes (user_id, until, reason, created_by)
values ('<target uuid>', now() + interval '3 days', 'report 123', 'owner')
on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_by = 'owner';

-- lift a mute
delete from social_mutes where user_id = '<target uuid>';

-- names from before the social SQL that today's rules would refuse (they keep working; DMs ask
-- those players to pick a new name). Optional cleanup: give them the automatic name.
select id, name from profiles where not social_name_ok(name);
-- update profiles set name = 'Sensei ' || upper(left(replace(id::text, '-', ''), 4)) where not social_name_ok(name);

-- delete one player's private messages
delete from direct_messages where sender_id = '<target uuid>';

-- clans that look like staff or the developer clan (new ones are refused; this finds older ones)
select id, name, tag, emblem from clans where not is_dev
  and (emblem = 'wiki' or reserved_clan_tag(tag) or reserved_clan_name(name) or lookalike_mix(name)
       or name_key(name) ~ 'devlab|admin|staff|official|developer');
-- update clans set emblem = 'assault' where id = '<clan uuid>';   -- (the trigger checks a new name / tag)

-- kicked players who can't rejoin a clan by themselves yet; lift one
select b.clan_id, c.name, b.user_id, p.name as player, b.until from clan_bans b
  join clans c on c.id = b.clan_id join profiles p on p.id = b.user_id order by b.until;
-- delete from clan_bans where clan_id = '<clan uuid>' and user_id = '<player uuid>';

-- how big the DM table is (the free plan has 500 MB for everything)
select pg_size_pretty(pg_total_relation_size('direct_messages'));
```

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
  - The knobs are `COOP_NET.supabase` in `src/data/coop.js` (`heartbeatMs` 250, `inputDelay` 30
    ticks, `keepaliveMs` 1000; both players must use the same ones, so they are part of the co-op
    compatibility id). If co-op ever outgrows this, the next step is a WebRTC DataChannel between the
    two players, with Supabase broadcast used only to set it up.
  - Lobbies are cheap but not free. An hour of an idle paired lobby costs about 900 messages (one
    keepalive every 8 s per player, each counted sent and received), a guest stuck without its host
    about 180, a host waiting alone about 180; a lobby nobody touches for 30 minutes closes itself.
    (Before 2026-10-14 a paired idle lobby cost ~2,400 an hour, ~57k a day: almost the whole free
    quota of ~66k a day.)
- **Inactive projects are paused** after a week without traffic. Restore the project in the dashboard;
  until then the online screens show "Online features are offline right now".
- **Anonymous sign-ins** are limited to 30 per hour per IP by default (Authentication → Rate Limits).

### Clan invites and the daily recruiting post

Everything below is in `supabase/migrations/20261018000000_clan_invites.sql`; the client rules live in
`src/online/clanInviteRules.js`, the local mirror in `src/online/adapters/localClanInvites.js`, the UI in
`src/ui/online/clanInvite.js`.

- **Who invites:** the leader and officers of a clan; in an **open** clan every member (anyone could join
  it anyway). Never the developer clan.
- **Who can be invited:** a player in no clan. A player who blocked the inviter, whose "Who can message me"
  is Nobody, or who is in the developer clan gets nothing, and the inviter still sees "Invited" (a block or
  a setting is never shown). The inviter has to unblock someone before inviting them.
- **Join:** works whatever the clan's join mode (the invite opens a "By request" or "Invite code" clan for
  that player), within the member cap. An invite from the leader or an officer also lets a player who was
  removed come back (like accepting their request); a plain member's invite does not. The inviter must
  still be in the clan.
- **Limits:** one pending invite per clan and player; invites end after 7 days and a declined one swallows
  repeats from that clan for 7 days; 10 invites a day and 20 pending per invited player; 1 invite per 2 s
  and 20 an hour per sender; joining counts as a clan join (10 an hour).
- **Recruiting post:** once per clan per game day (7 PM Central), by the leader or an officer. It is a
  global chat line of kind `recruit` whose clan card (`meta`: id, tag, name, emblem, members, max, join
  mode, level) the server writes from the clan row; players can't post that kind themselves. Its text says
  the same in words ("[PS] Petal Squad is recruiting! 12/30 members · open to all. Find them in Clan → Find
  a clan."), so an older game shows a readable line. It also counts as a chat message, and 5 a day per
  player.

## How it works

```
src/online/backend.js            picks the adapter, signs in, runs the client limiter, normalizes errors
src/online/limits.js             rate-limit table (shared numbers with the SQL) + sliding-window limiter
src/online/errors.js             OnlineError codes: rate_limited (retryMs), offline, not_member, name_taken, forbidden, …
src/online/clanRules.js          roles, clan XP → level, ISO week, weekly boss rotation, reward tiers, LOCAL_DEV_CODE (offline test backend only)
src/online/identity.js           online name (own storage key ss-online-v1, outside the save), level, avatar
src/online/supply.js             Supply Bot grants (developer clan)
src/online/adapters/supabase.js  supabase-js (loaded only when an online screen opens)
src/online/adapters/local.js     BroadcastChannel + localStorage transport (two tabs = two players)
src/online/adapters/localDb.js   the local adapter's "server": the same rules as the SQL, pure and tested
src/online/coop/                 lockstep.js, commands.js (wallets, ownership), simHash.js, session.js (room lobby), socialRoom.js (block filter + seat signal around the session, not hashed), loadout.js, rewards.js
src/data/coop.js                 co-op tuning: HP ×1.6, cash share 0.6, input delay, heartbeat, hash interval, timeouts, colours, stage list
src/ui/online/                   chat panel + lobby drawer, name prompt, status pill, Supply Bot, co-op HUD, Settings → Online
src/ui/screens/{chat,clan,coop}.js   #/chat, #/clan, #/coop/<CODE>
src/online/socialRules.js        [social] privacy, friends, DM text rules, invite meta, report reasons, auto-mute numbers, player-facing reasons
src/online/donateRules.js        [social] what a clan may ask for, sizes, per-donor caps, points, 30 points a day, coins / clan XP per point
src/online/donateLedger.js       [social] exactly-once donations and collects with a local save (escrow, settle, replayable collect key)
src/online/socialSave.js         [social] profile.social sanitizer (the ledgers live in the save)
src/online/adapters/localSocial.js  [social] the local adapter's copy of the social SQL rules (?online=local; &social=0 = server not updated)
src/core/reset.js                the 7 PM Central game day: gameDay(), nextDailyReset(), formatCountdown() (shared with the energy update)
src/ui/online/socialHub.js       [social] badges, the live inbox subscription, DM / friend / invite pop-ups (held during a battle)
src/ui/online/{playerCard,reportDialog,inviteToast,coopInvite,donatePanel,needsUpdate,inboxButton}.js
src/ui/screens/messages.js       #/messages, #/messages/<threadId> (conversations, friends + friend code, requests, blocked)
supabase/migrations/*.sql        tables, RLS, functions, rate limits, realtime publication, dev clan seed (no code)
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
  - once both see each other, a keepalive hello every 8 s; a lost `ready` or stage change fixes itself
    with the next one;
  - an ally silent for 25 s while my own link is up has left (a `leave` message or closing the tab is
    instant);
  - a version mismatch clears as soon as the same player says hello again on my version (after a
    reload), says `leave`, or is not heard from for 45 s (then the search, and its Retry, start again).
  Normally the guest sees the host within one round trip of its channel joining (well under 3 s).
- **A one-way link heals itself.** If I hear my ally but its hellos have not said for 7 s that it hears
  me (what I send does not get out: a mute channel on a bad server node, a socket that died while the
  phone slept), the lobby asks for a fresh channel, from the second try on a fresh socket too, with a
  doubling pause (7 s, 14 s, 28 s … 60 s). It never re-takes the seat for that (`join_room` is
  rate-limited). Both host and guest do this; the side whose link works does nothing.
- **Only paired players can get ready.** The ally's card says "Connecting to <name>…" until both
  sides see each other; Ready (guest) and Start (host) unlock only then, so a guest can never be
  "ready" for a host that cannot hear it.
- **Traffic.** Hellos are fast only during a fresh handshake: 1 a second while we look for each other
  (the first 15 s of a search; a host alone: every 4 s), then a slow beacon every 20 s (a stuck guest, a
  host waiting long, a version mismatch on screen). A hidden tab hellos at most every 20 s and says
  hello at once when it is shown again. Every (re)join and Retry still says hello at once, and a hello
  that does not see me yet is answered at once. A lobby with no ally joining or leaving, no Ready, no
  stage change and no Retry for 30 minutes closes ("This room closed after 30 minutes without a
  battle").
- **Leaving says goodbye, even by closing the tab.** realtime-js closes its socket in its own
  `pagehide` handler, which used to run before the lobby's, so the `leave` (and the battle's `bye`)
  never got out. The Supabase adapter now registers its `pagehide` listener before it creates the
  client and lets the room say goodbye first; the seat is freed with `leave_room` sent as a
  `fetch(..., { keepalive: true })` with the session's cached access token and the publishable key
  (supabase-js would first await its session and never get to send). Leave, Back and Retry still go
  through supabase-js. A page restored from the back/forward cache opens its room again.
- **Waking up.** A phone locked for a while can come back with a socket that looks open but is dead
  (WebKit does not always report the close; realtime-js only notices at its next missed heartbeat,
  25–50 s later). Back on the tab after at least 3 s, the room sends a heartbeat and replaces the socket
  when it is not answered within 4 s. Retry replaces the socket too.
- **What the lobby shows.** "Connecting to room…" until the channel is joined, then "Waiting for your
  ally…" (host) or "Looking for the host…" (guest), "Connecting to <name>…" while only one side hears
  the other, "Reconnecting…" while the link is down, and after 15 s without a host (or without a link)
  a banner with what to check and a **Retry** button. Retry takes the seat again (`join_room` /
  `open_room`, so a room that is gone says "No room uses that code") on a fresh socket and channel. A
  code with a typo is refused by `join_room` straight away: "No room uses that code". A third player
  gets a "Room full" page (no seats, no Ready). When the ally leaves or vanishes, the host sees
  "<name> left the room" with a **New room** button: someone coming back from another browser or
  device is a different account and may find the seat still taken.

### Co-op: the room stays after a battle

Owner, Oct 14: "When you lose and go back to coop make it so the room stays and you can rejoin the
room". Nobody retypes a code or makes a new room to play again:

- **Back to the room.** The results screen offers **Back to the room**, **Leave room** and **Home**.
  Back to the room (or the phone's back gesture / the browser's Back once the battle is over) takes
  the session back to its lobby on the same channel (`session.backToLobby()`): the code, the seats
  and the ally stay. It tells the ally (`{ type: 'lobby' }`); an ally still on its results reads
  "Aiko is back in the room" on the results sheet. The two pair again with a fresh handshake as soon
  as both are back; the guest taps Ready again and the host starts a fresh battle (a new lockstep).
- **Waiting for the ally.** The one back first waits ("Waiting for Bea… They are still on the battle
  screen") as long as the ally's battle screen keeps talking: a finished battle beats every 8 s
  (`LOBBY.restBeatMs`; once both are at the end, instead of every second) only to say "still here".
  An ally silent for 25 s counts as gone silent ("Lost contact with Bea", the guest's Retry banner
  after 15 s more). A guest whose host left the room waits without an alarm: the room stays.
- **Left for good** is only a room `leave` (Leave, Home, closing the tab), never a lockstep goodbye: a
  fatal desync now says `{ type: 'bye', why: 'desync' }`, so the other side reads "Lost sync", and
  back in the room it waits for its ally instead of calling the room closed.
- **A host that steps away keeps its room.** Leave, Home, Leave co-op and closing or reloading the
  tab only stop listening (`close({ keep: true })`, no `leave_room`): `open_room` hands the host the
  same secret again ("my room"), so an ally still waiting in the channel hears it at once. **New room**
  and a lobby closed after 30 idle minutes give the code up (`leave_room` deletes the row, as before).
  A guest always frees its seat.
- **Your last room.** The co-op menu remembers the room you were last let into (for two hours, per
  player, `src/online/coop/lastRoom.js`, saved only once the server accepted the seat) and offers **Rejoin**:
  the host opens it again with its stage (and its freeplay setting), a guest joins it. A reloaded co-op
  battle page leads back into the same room too ("Back to the room").

### Co-op freeplay: the room setting

Owner, Oct 14: "can you add freeplay stages too to coop? … once you get past what you need like 15/15
… 16/15". Freeplay is a room setting next to the difficulty: **Off**, **Blossom**, **Tempest** or
**Crimson Moon** (`session.freeplay`: `null` or a tier id; the waves past the goal come from
`src/data/freeplay.js` and `src/sim/freeplay.js`, see CONTRACTS §6).

- **The host picks it**, the guest's **Ready is consent.** It rides in the `room` message, the host's
  hellos and the `start` message, and the guest takes it from each, so a lost `room` message fixes
  itself with the next hello. A guest's hello and `ready` say which setting its Ready was given for: a
  changed setting clears the guest's Ready, and Start stays locked until the guest has readied for the
  setting the host has now (a stale "ready" sent before the change never counts). A stage change alone
  keeps the Ready, as before.
- **Both build the same run.** The battle is built from the start message (`start.freeplay`), and so is
  every resync and rejoin (they rebuild from it), so both clients always agree on the mode and the
  waves past the goal.
- **The Finish vote** is a lockstep command, `end[true]` (or `end[false]` to take it back). It counts
  only after the goal; the run ends (a win, `finished`) on the tick every player still in the battle has
  voted. A player who drops out or leaves no longer blocks it (the drop is a `gone` marker in the
  command log, so a replay agrees), and one who comes back keeps her vote.
- **Leaving a run for the room.** "Back to the room" also works while the battle still runs: the ally
  plays on alone (her drop marker lets her finish alone), and instead of lockstep beats nobody needs
  she sends `{ type: 'fighting', wave, goal }` every 10 s (`LOBBY.fightingMs`) and once more when her
  run ends. The one waiting reads it as `session.returning.fighting` ("Rin is still fighting — wave
  87") and keeps waiting while it comes; each beacon also counts as room activity, so the room's
  30-minute idle close never fires during an hour-long run. The `lobby` message that tells her is said
  again (at most every 2 s, `LOBBY.lobbyEchoMs`) while her battle's beats still arrive, so a lost one
  costs no 12 s stall. "Back to the room" keeps the setting on both sides.
- **A battle that ended stays ended.** A client whose run finished (or fell) while the two were cut
  off — e.g. her Finish vote counted alone after the drop — says `done` in her beats: the host offers
  her no rejoin, and a finished guest ignores any offer, so the results screen (already paid) is never
  pulled back into the run.
- **Compatibility.** `COOP_PROTOCOL` is 3 (the `start.freeplay` field, the `end` command, the goal
  event) and the freeplay table is part of the battle-data hash, so a build from before freeplay and
  one with it refuse to pair (the version banner).

### Co-op freeplay: the room, the battle, the rewards

- **Room.** The host's stage picker (hub "Host a room" → Change stage, and the room's Change) has a
  **Freeplay: Off · Blossom · Tempest · Crimson Moon** row (pink / storm-indigo / crimson; remembered in
  the co-op prefs and by "Your last room"). The guest sees a **FREEPLAY · TEMPEST** chip next to the
  difficulty and cannot change it; a toast tells the guest when the host's change took their Ready back.
  The Battlefield panel says what freeplay brings on this stage and tier ("15 waves, then freeplay
  (Tempest): visitors from every chapter, bosses every 10 waves (every 5 deep in), big bosses from wave
  80, titans from wave 170, the Ashwing Matriarch at 200." — from the same pure schedule the battle
  uses), "Your best: 87/15 (Tempest)", advice ("Bring Veil Sight, Anti-Air, Armor Pierce and a boss
  killer"), the Nightmare warning ("1 life — the first leak ends freeplay"), and after a run "Last run:
  147/15 · Tempest · fell to the Grave Lych". The clan invite reads "4-5 Normal · Freeplay Tempest ·
  best 130/26". While the ally's run goes on after you came back: "Rin is still fighting — wave 87/15".
- **The clear (the goal wave cleared).** STAGE CLEAR! — "Rewards saved ✓ · Freeplay ready", the victory
  sting over the music (the battle goes on), the clear banked and saved at once (toast "Clear rewards
  saved ✓ — drops for both"), and the wave button becomes the clear card: **STAGE CLEAR ✓** over a
  violet → pink **GO BEYOND ▶ Wave 16/15** (the normal `wave` command, either player; with Auto on a
  ring counts the 8 s pause down) and a small **Finish here** pill (this player's Finish vote).
- **16/15.** Past the goal the HUD wave pill overflows: the number in a shimmering white with pink and
  cyan edges over a flowing tier gradient (Blossom violet → pink → gold, Tempest indigo → cyan,
  Crimson Moon deep red → gold), the "/15" dimmed, a slam on every new wave, the label BEYOND
  (OVERTIME past wave 200; WAVE on narrow phones). Reduced motion keeps the static colours and edges.
  The first wave past the goal brings a glitch banner "16/15 — BEYOND THE LAST WAVE · Blossom", a pink
  edge flash and a riser sting; later waves a short "WAVE 37 · 37/15 · Beyond" ribbon (skipped on short
  screens), milestones at 50 / 100 / 150, TWIN BOSSES, TITAN — "Breaks into two Iron Colossi!", the
  countdown to the Matriarch (195–199), "WAVE 200 — THE ASHWING MATRIARCH", "MATRIARCH DOWN!", "LAST
  LIGHT — THE ECLIPSE WYRM", visitor toasts ("Visitors from Chapter 5 (Gloomfen Marsh): Ghouls & Plants ·
  Swift") and HP surges at each band edge. A boss gets the big ribbon on its first appearance only
  ("Grave Lych returns!" after that). The scout strip reads "NEXT 16/15" and ends in a pressure chip
  (HP ×, +armor, +speed, Resolve; orange once Resolve is 4 s or less; tap for the full explanation).
  Boss bars use k / M / B / T ("132M / 132M"). The next wave's visiting families load between waves.
- **Finish and leaving.** The co-op MENU after the goal has **Finish run** (my vote; "Ends the run for
  both of you once Rin agrees") and **Back to the room**. The ally's vote shows a prompt "Rin wants to
  finish here — Finish / Keep going" and a flag on her HUD chip. Leaving after the goal says "Your clear
  rewards are saved; you'll get the freeplay bonus for 37 waves. Your girls stay with Rin." and pays it.
- **Results.** A run that went past the goal ends on a third sheet: **FREEPLAY OVER** (fell) or
  **FREEPLAY COMPLETE** (the Finish vote), the big overflow pill "147/15", "Cleared wave 147 / 15",
  "Fell on wave 148 to the Grave Lych" / "Finished together after wave 147", "New best on 1-3
  (Tempest)!", the bosses beaten, the Stage clear (saved at 15/15), the Freeplay bonus, Top damage and
  the debrief. Finishing right at the goal is today's VICTORY sheet; falling before it is a DEFEAT.
- **Rewards** (`src/online/coop/rewards.js`, outside the co-op id). At the goal: the normal co-op win
  (stage drops without gear, 300 + 40 × goal coins, sightings, kills, kill missions), banked once and
  saved. At the end (fell, Finish, or leaving after the goal): 40 coins × freeplay waves × the tier
  (Blossom ×1, Tempest ×1.5, Crimson Moon ×2), a freeplay cache every 25 freeplay waves (a stage drop
  roll without gear, crowns or tokens), one Assault Token per boss-rank kill since the clear (minibosses
  none, at most 10 a run), only the kills and sightings since the bank, the best wave per stage and
  tier (`progress.stages[id].coopBestWave = { blossom, tempest, crimson }`), and once per account and
  tier: wave 100 → 50 gems, wave 150 → 100 gems, the Matriarch → 200 gems and the title "Ashwing
  Slayer" ("Crimson Slayer" on Crimson Moon), the Eclipse Wyrm → a profile frame
  (`progress.freeplay = { done, titles, frames }`; titles and frames have no display yet). Measured
  per real minute at 3×: the waves pay 125–210 coins (Blossom), 185–300 (Tempest), 230–370 (Crimson
  Moon), the caches about 170–450 more — at most ~80 % of farming normal co-op clears (660–1,050 a
  minute), so freeplay is never the better farm. A battle's
  payout ledger lives on the co-op session (`session.freeplayRuns[seed]`: one-shot effects shown, the
  bank, the end), so a resync remount neither shows nor pays anything twice. That ledger is in memory,
  so after every freeplay wave the save also keeps what the end payout needs
  (`progress.freeplayPending[seed]`, at most 3 runs; `payFreeplayEnd` removes it): a run whose page was
  reloaded, closed or thrown away by the phone mid-run is paid at the next app start, from the last
  wave it saved, with a toast ("Freeplay run paid: 1-3 · Blossom · 87/15 · +2,880 coins").

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
  `src/sim`, the co-op protocol files `src/online/coop/{session,lockstep,commands,loadout,version}.js`
  and `src/data/coop.js` with the net settings, computed by `tools/simId.mjs` in `vite.config.js`), a
  hash of the battle data, the git commit and the player-facing version. Two clients pair when
  protocol, sim id and data match, so deploys that only change art, audio, menus, the save, missions,
  post-battle rewards, the room adapters (chat / clan / social code, including the lobby's block filter
  and seat signal in `socialRoom.js`) or the renderer don't split players. A change to any hashed file does: both players then need the new deploy. When they differ the lobby names both versions and who is behind
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
    After 10 s without a stall the delay steps back toward its base (half the excess per step), so one
    hiccup does not slow every later order for the rest of the battle. Lowering it is always safe:
    promises never shrink, and new orders are scheduled after the last promise.
  - A heartbeat goes out at once when the player gives an order; otherwise only when the promise has
    moved on by half an input delay (local: every 50 ms; Supabase: at most every 250 ms) or, when
    nothing changes, as a keepalive (Supabase: once a second).
  - Idle saver (Supabase rooms): after 10 s without an order a client promises its horizon 1 s ahead,
    a new hash waits for the next beat, and the keepalive is every 2 s — about 2 messages a second
    instead of ~4 (measured: 3.84 → 2.00 per client in `lockstep.test.js`). The next order lands up
    to 1 s later, then the normal delay applies again.
  - Unacknowledged commands are re-sent with every heartbeat, so a lossy link is fine.
- **Wallets.**
  - Each player starts with 60% of the stage's coins.
  - Each command runs with its player's coins and loadout swapped into the Sim. This also enforces
    "only your own girls".
  - Coins earned are split evenly, with the odd coin alternating.
  - Only a girl's owner can upgrade, retarget or sell her.
- **Desync check.** Both clients compute a state hash every 120 ticks; the last two ride along on every
  heartbeat.
  - On a mismatch the guest asks the host for its state: the host answers with its newest wave-end
    checkpoint and its command log, and the guest restores the checkpoint and replays only the commands
    since (one wave, not the whole run). It asks again every 4 s until the answer arrives.
  - A second mismatch within 30 s ends the link. Both players continue solo.
- **Long runs (co-op freeplay goes on for an hour and more).**
  - Checkpoints: at every wave end the host keeps a snapshot of the whole battle (`src/sim/snapshot.js`:
    towers, enemies, projectiles, statuses, the rng, wallets, owners, votes — ~100–150 KB of JSON with
    60 girls). Resyncs and rejoins carry it.
  - Rebuilds never freeze the page: a resync, a rejoin and a catch-up replay as a background job, about
    10 ms per frame, while the old battle stays on screen under a "Re-syncing with Aiko… Wave 12 of 150"
    card. Orders wait until it is done. A `busy` beat every second keeps the ally from dropping the
    rebuilding player, and the ally's chip says "Bea is re-syncing… 45%".
  - Messages bigger than 24 000 characters (a checkpoint) travel in parts on Supabase rooms (Realtime
    limits a message's size) and are put back together on arrival.
  - A player who rebuilt reloads her battle screen; the ally waits up to 60 s for it (instead of the
    normal 12–20 s drop timeout), showing "Bea is re-syncing…".
  - Measured (`node e2e/coop-longrun.mjs`, a strong scripted pair on Blossom 1-3, cut past the drop
    timeout at wave 150 = 413k ticks): the rejoin restored the host's checkpoint (51 KB with 17 girls; a
    60-girl board is ~140 KB) in 7–13 ms and replayed 2 412 ticks in 236–824 ms of CPU — about 0.25–0.45 s
    at 60 frames a second, slices of 19 ms at most in Chromium — in Node, Bun and Chromium alike. The old
    rebuild replayed the whole run from tick 0 in one go: 12–15 s of frozen page (16–36 s under heavier
    load), longer than the drop timeout. Two pages (`node e2e/coop-rejoin.mjs`): a rejoin and a resync
    at wave 16 each replayed under 700 ticks with the guest's page never blocked more than ~120 ms.
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
  - A guest that played on alone meanwhile rebuilds the battle from the host's newest checkpoint and
    the log since (its battle screen reloads), catches up to the host's tick, and both continue in
    lockstep. Orders the guest gave while it was cut off are lost. A guest that was only frozen also
    restores the checkpoint instead of fast-forwarding in place when that replays clearly less.
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
node e2e/social.mjs           # DMs, friends, invites by DM, clan requests, block / report, needs-update
node e2e/online.mjs --viewport 844x390 --shots /tmp/online
node e2e/engines.mjs          # the same co-op battle in V8, JavaScriptCore and SpiderMonkey
node e2e/coop-rejoin.mjs      # two pages: a freeplay run past the goal, a cut link, a rejoin and a resync through the checkpoint
node e2e/coop-longrun.mjs     # a rejoin at freeplay wave 150, timed in Node, Bun and Chromium
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
  Freeplay: both clients play 1-1 Crimson Moon through the goal and 20 waves past it (two boss waves) in
  sync, the Finish vote refused before the goal, one vote not enough, both votes ending the run on the
  same tick; a resync after the goal (the votes come back with the log), an ally dropping out (the one
  left finishes alone; the replayed log agrees), a frozen guest re-admitted with her earlier vote.
  Long runs: a resync deep in freeplay restores the host's checkpoint and replays one wave, then 10
  waves in sync; a network cut deep in freeplay ends in a rejoin through the checkpoint and 10 waves in
  sync; a rebuild runs in many short slices and reaches the same battle as replaying in one go (from tick
  0 or the checkpoint); a slow rebuild longer than the drop timeout keeps the host waiting (busy beats);
  a resync in parts with one part lost (the guest asks again); the idle saver's message rate.
- `tests/sim/snapshot.test.js`: battle snapshots restored into fresh Sims run 20 000 ticks against the
  original without drifting; the co-op checkpoint (wallets, owners, votes) and 10 more waves.
- `coopFreeplay.test.js`: `start.freeplay` → the freeplay Sim (only for a real tier), the `end` command's
  rules, protocol 3.
- `coopRewards.test.js`: the freeplay payouts — the bank pays exactly the normal co-op win, the end pays
  only the freeplay part and only kills since the bank, the tier multiplier, caches without gear /
  crowns / tokens, the token cap, the best wave per tier (kept by the save), milestones once per tier,
  and the ledger: banked once per battle even across a remount, the end paid once.
- `detMath.test.js`: the deterministic sin / cos / atan2 / hypot / … stay within 2 ulp of the engine's own,
  are swapped in only while a co-op call runs, and keep a battle bit-identical when Math is perturbed.
- `engines.test.js`: keeps the cross-engine battle (`e2e/engines/scriptedBattle.js`) finishing in sync
  with every scripted order accepted.
- `battleRoute.test.js`: solo battle routes never pick up a co-op session.
- `coopSession.test.js`: the lobby handshake over a fake network with simulated time: pairing time, a
  mute host found as soon as its link works, a lost answer, hello on every rejoin, a lost `ready`, the
  25 s silence rule (not while my own link is down), a mismatch that clears (same player again, its
  `leave`, or its silence), the 15 s "cannot find the host" state and Retry, a code with a typo, a
  one-way link on either side healed with fresh channels / sockets and a backoff (never re-taking the
  seat), the lobby message budget per hour (stuck, alone, paired, hidden, mismatched), an untouched
  lobby closing after 30 min, a third player, and the start message re-sent until the guest answers.
  The rematch: battles played to their real end (Nightmare, the first enemy through), both back in
  the room in either order and paired again with no code typed, Ready again before Start, a fresh
  battle 2 (start re-sent even after a results screen kept beating into the room), the host or the
  guest going Home, the "lobby" drop, waiting while the ally's battle screen still talks and the
  silence rule after that, a desync that is not a departure, the slow beat of a finished battle, and
  which closes keep the host's room. Freeplay: the setting in hello / room / start (a lost `room`
  message healed by the next hello), Ready as consent (a stale ready never starts the battle), a
  protocol-2 hello or start refused, the setting kept through "Back to the room" (and Off again a plain
  battle), and a run one player leaves for the room: the other plays on with a `fighting` beacon instead
  of lockstep beats, finishes alone, and they pair again.
- `lastRoom.test.js`: "Your last room" (two hours, per player, forgotten only by its own code), and a
  freeplay room reopened as one by its host.
- `supabaseRoom.test.js`: the Supabase room channel against a scriptable fake: no presence, the outbox
  flushed at the join, status reports, realtime-js's own rejoin, a fresh channel after `CLOSED` or when
  stuck (with backoff, and not while the socket itself is down), Retry (seat + socket) and the one-way
  heal (neither), the tab closing (the goodbye gets out before realtime-js closes the socket, the seat
  is freed with a keepalive `leave_room`; a host keeps its room), the wake-up probe, close, and a host
  that steps away (`close({ keep: true })`: no `leave_room`, the same secret when it opens the room
  again).
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
- `socialSchema.test.js` (the social migration on PGlite, both grant modes, applied twice, as ten
  players): the function allow-list (no helper executable by players), no direct reads or writes, the
  7 PM Central game day across DST, the privacy matrix with no settings row and no clan, friend codes,
  text rules, every social rate limit, Friends only / Nobody and the 72 h clan rule, blocks (same words
  as privacy), decline tombstones and the full queue, renames, co-op invites by DM, reports + qualified
  auto-mute, material requests, donations (caps, 30 points, clan XP, filled notice), settle / void, collect
  replay, yesterday's request, leave / kick / disband, and races (same-key retries, two donors for the
  last pieces, the 30-point cap with two requests at once, settle vs a late donate, two collects).
- `socialFixes.test.js`: the verifier findings of the social update, each reproduced on PGlite and
  shown fixed: players with names the first migration accepted keep chat / level sync / co-op once
  the social SQL runs; one public chat line is no auto-mute contact and a repeat report needs new
  contact; `settle_donations` is rate-limited and capped; a 200-DM flood keeps the abusive message for
  the report; request → cancel → request and block → unblock cannot ping again; a block reads like a
  closed request / a full room; blank-looking bodies and names and look-alike reserved names (JS and
  SQL compared on the same strings); the friend caps' locks; `expire_coop_invites`; and the judge's
  re-verification, each failing on the file before the fix: the evidence counts the conversation and
  it is kept while a report is open (90 days at most), a repeat report adds to the evidence, a block
  frees the co-op seat both ways and changes the room secret, the clan text rules (live look-alike
  clans survive the paste; online → social → online → social keeps the triggers and the 57 player
  functions), the 7-day kick ban, Friends only by default, a blocker's request gone, the blocked
  player's request swallowed, stacked marks of every script, staff words inside names; and the final
  verification (R1–R5): a repeat report keeps the child's reason and note, look-alike alphabets /
  letters one by one / camel case / invisible characters never pass for staff, blocking an ex-guest
  changes the room secret, clan notices carry who they are about, the paste locks first. (The concurrency of
  #8 needs real parallel connections: the verifier's probe p11 on Postgres 16 — 50 friends and 10
  requests a day hold.)
- `localSocial.test.js`: the same rules on the local adapter with an injected clock (the 7 PM rollover),
  including the same verifier and judge scenarios.
- `tests/core/storeTabs.test.js`: two open tabs on one save (two stores, one storage, the real
  donation ledger): an older tab never writes over a newer save (it turns stale and shows "Open in
  another tab — reload"), the donation ledger re-reads the newest save, one tab alone is unchanged;
  during an update a tab still on the older build (no revisions) can no longer roll the ledger back.
- `socialRules.test.js`, `donateLedger.test.js` (escrow / refund / settle / claim replay after a crash at
  every step), `backendSocial.test.js` (the deploy order: `needs_update` without a request, chat and clans
  unaffected), `tests/core/reset.test.js` (the game clock) and `tests/ui/social.test.js` (pop-up rules,
  the invites kept for a room, the Messages back arrow).

The e2e test opens two pages of one browser in local mode. It checks:

- chat delivery and rate-limit feedback, the local-mode banner, and the lobby's chat bubble drawer;
- clan create and join;
- the clan boss, including one attempt through a real battle that lands on the damage ranking;
- the developer clan's Supply Bot, joined with the offline backend's test code (`LOCAL_DEV_CODE`);
- the co-op lobby with faked connection faults (`window.__coop.room._cut()` / `_heal()` in local mode):
  a code with a typo, a mute host that shows "Connecting to Bea…" with Start locked and heals its
  one-way link by itself, the guest leaving ("Bea left the room" + New room), a host whose link is dead
  both ways (the guest's 15 s banner and Retry, then found within seconds once the host's link works
  again), a third player's "Room full", a `ready` lost on a mute link, and a dropped guest link that
  shows "Reconnecting…" and comes back paired and still ready;
- the rematch: a Nightmare battle that ends on both screens at the same tick, both results screens,
  the host back in the room first ("Waiting for Bea…", her results say Aiko is back), then the guest
  through the browser's Back (the phone's back gesture): same code, paired again, Start locked until
  the guest taps Ready again;
- battle 2, where both players place a girl and the state hashes match, a dropped and re-admitted
  guest, and the host playing on alone;
- "Your last room": the guest (gone Home) and then the host (Leave co-op) find the room on their
  co-op menu, tap Rejoin, and are paired again in it.

`e2e/social.mjs` drives three players in local mode: friend request from the clan-chat player card, DMs
both ways with badges and pop-ups, a co-op invite from the conversation → **Join** → both in the lobby
(no code typed), the room's **Invite a friend** list, a material request → donation → collect (a reload
pays nothing twice), the daily caps, a removed clanmate collecting from the clan list, report + block,
Settings → Online, and a fourth tab with `&social=0` (the server before the owner runs the SQL) showing
"Needs the latest server update" while clan chat still delivers.

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
| Co-op says "No room uses that code" | The host made a new room, its lobby closed after 30 idle minutes, the code is older than a day, or it has a typo. Ask for a new one |
| Co-op guest keeps saying **Looking for the host…**, then "The host … has not answered yet" | The host's page is closed, asleep (phone screen off) or on another version. The host opens the room again (or makes a new one); the guest taps **Retry**. If it still fails, check the browser console of both players for `phx_error` on a `coop:` topic and see the next section |
| Co-op lobby or battle says **Reconnecting…** | That player's Realtime connection dropped (network change, phone sleeping). The game rejoins on its own within 1–15 s and says hello again; nothing to do. If it never ends, reload the page |
| Co-op says **This room already has two players** to a friend who was just in it | They came back from another browser or device (a different anonymous account) while their old seat was still held (a crash or a tab killed by the phone skips the goodbye). The host taps **New room** (shown when the ally left) and sends the new code. See "Proposal: the host frees the seat" below |
| Co-op lobby says **This room closed after 30 minutes without a battle** | Working as intended (Realtime bills every lobby message). Open a new room |
| Chat says "Slow down" | Working as intended: 1 message per 2 s and 20 per minute |
| A transfer code is refused with "try again in …" | 5 tries an hour, wrong codes included. Wait, then type the code again carefully (`XXXX-XXXX-XXXX`) |
| Messages / Clan → Requests say **Needs the latest server update** | The social SQL has not run: see "Run the social update" above. Chat, clans and co-op are unaffected |
| The clan screen has no **Post to global chat** / a player card has no **Invite to clan** | The clan invites SQL has not run (see "Run the clan invites update"), or you are a plain member of a clan that isn't open (leaders and officers invite; every member may in an open clan), or that player is already in a clan |
| "Daily limit reached" on **Post to global chat** | Working as intended: one recruiting post per clan per game day (7 PM Central) |
| "… can't get messages from you yet" | Their "Who can message me" setting (or yours) does not include the other player, or one blocked the other (deliberately not told apart). Add each other as friends (friend code) |
| "Daily limit reached — resets at 7 PM Central" | Working as intended: one material request and 30 donation points per game day |
| "Checking your donation…" stays | The answer to a donation was lost. The game asks the server again on the next visit (Retry appears after two tries); the items come back only if the server never applied it |

### Proposal: the host frees the seat (server change, not applied)

The client now frees the guest's seat when the tab closes (a keepalive `leave_room`), but a browser
that is killed, crashes or loses its network on the way out still leaves `guest_id` set, and
`join_room` refuses anyone else for up to a day. The host already sees that the guest is gone (no
hellos for 25 s, or its `leave`), so a host-only function would close the gap. This is a proposal only;
it is **not** in `supabase/migrations` and the game does not call it. To adopt it, paste this into the
SQL editor, add it to a new migration, and have the lobby call it when its ally left or went silent:

```sql
-- The host gives the guest seat back (its ally left or went silent): the next join_room can take it.
create or replace function public.free_seat(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  update coop_rooms set guest_id = null
   where code = upper(trim(coalesce(p_code, ''))) and host_id = auth.uid();
end $$;
revoke all on function public.free_seat(text) from public, anon;
grant execute on function public.free_seat(text) to authenticated;
```

The secret does not change, so a guest who comes back on the same account simply takes the seat again.
Until then, **New room** is the way out.

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
