# Sensei Profile — Design B: data, sync and safety (Oct 15, 2026)

How a profile is stored, published, read, moderated and tested. Design A (screens) and the Unit Sheet work consume the contracts defined here.

The SQL below is a working sketch. It ran on PGlite against the real `20261008000000_online.sql` and `20261013000000_social.sql` from `/home/user/wt-social`:
- **Probe:** 120 checks, all pass.
- **Parity:** a JS mirror of the rules agrees with the SQL on 57 bio strings and 16 card shapes.

Scratchpad files (all under `docs/specs/profile/`):

| File | What it is |
|---|---|
| `20261016000000_profile.sql` | The migration sketch (463 lines, idempotent) |
| `profileRules.sketch.js` | The client mirror: bio rules, card shape, hash |
| `probe.mjs` | Runs the migration sketch on PGlite. Run with `cd /home/user/wt-social && node <path>/probe.mjs` |
| `parity.mjs` | Compares the JS mirror with the SQL on the same strings and cards |

---

## 0. Decisions at a glance

| # | Decision | Choice |
|---|---|---|
| D1 | Where the SQL goes | **A separate migration, `20261016000000_profile.sql`,** run after the social file. The social file stays as it is (§9). |
| D2 | Where profile data lives on the server | **A new table, `profile_cards`.** Row Level Security on, no grants, no policies. It is read only through `profile_view()`, which builds on `player_card()`. No new columns on `profiles`, which every signed-in player can read and which ignores blocks. |
| D3 | Account data vs save data | **The account (server) owns:** name, bio and "Who can see my profile". **The save owns:** profile picture, favorite girl, banner, frame, title, the 8 showcase girls, pins and badges. **The card's numbers** are worked out from the save each time it is published. |
| D4 | Trust | **The card is self-reported display data.** The server checks shape, ranges and size only. The viewer's client cleans it again. Nothing in the game may ever read it for rewards, ranks or co-op. |
| D5 | Bio safety | **0–80 characters.** The DM text rules apply, plus new contact rules: no links, e-mails, @names, Discord tags, phone numbers or other apps. Edits are refused while muted. Reports carry the bio as evidence. 3 reporters hide it; a second hide within 30 days locks bio edits for 7 days. |
| D6 | Privacy | **"Who can see my profile": Everyone (default) / Friends & clan / Only me.** A player who blocked you looks exactly like "Only me". Nothing tells others when a card changed, because that would show when someone is online. |
| D7 | Save format | **An additive `profile.sensei` block, no SAVE_VERSION bump.** If an older build drops the block, the next sync restores it once from the server copy. |
| D8 | Sync | **Publish when the card's hash changes:** at the end of `ensureOnline`, on a social-hub tick (at most once per 10 minutes), after an edit, and after a save is replaced (reset, import or transfer). |

---

## 1. What lives where

| Piece | Lives in | Who sees it | Why there |
|---|---|---|---|
| Username | `ss-online-v1` (`identity.js`) → `profiles.name` | every signed-in player (already) | Unchanged: the same `askName` prompt and rules, 3 renames a day |
| Profile picture | save `sensei.avatar` (a unit id, or null = the secretary) → `profiles.avatar` | every signed-in player (already) | Old clients already show `profiles.avatar` as a portrait; unknown ids fall back to Hikari. No server change. |
| Bio | **server `profile_cards.bio` is authoritative**; save `sensei.bio` is a mirror | per visibility | Moderation acts on the server copy. The bio survives a reset like the name does, and moves to a new device through the mirror. |
| Who can see my profile | server `profile_cards.visibility` only | nobody else | A safety setting stays with the account: a reset or an imported save never quietly sets it back to "Everyone". Same reasoning as `dm_privacy`. |
| Favorite girl, banner, frame, title, top 8, pins, badges | save `profile.sensei` → published card | per visibility | These depend on progress: a reset clears them and a transfer takes them along |
| Levels, gear, medal and ribbon counts, best wave | worked out from the save when the card is built | per visibility | Never stored a second time in the save |

The owner's "favorite units" are the ordered top-8 showcase. The unused per-girl flag `units[id].favorite` stays untouched; a Students-list star could mirror the showcase later.

---

## 2. Local save: `profile.sensei`

### 2.1 Shape

New file `src/systems/senseiSave.js`, following the `socialSave.js` pattern:

```js
export function newSensei() {
  return {
    avatar: null,          // owned unit id; null = the secretary (today's behaviour)
    favorite: null,        // owned unit id shown on the left; null = the secretary
    banner: 'academy:day', // banner id ('academy:day|sunset|night', 'theme:<11 themes>', 'lobby:<scene>')
    frame: null,           // earned frame id ('eclipse')
    title: null,           // earned title id ('fp_ashwing', 'fp_crimson')
    showcase: [],          // ≤ 8 owned unit ids, in order (empty = "my 8 strongest" at build time)
    pins: [],              // ≤ 3 earned 'stage:difficulty' or 'stage:difficulty:mode'
    badges: [],            // ≤ 6 claimed achievement ids (recruit-count ones are not pinnable)
    bio: '',               // MIRROR of the server's bio; edited online only
    lost: false,           // set by migrate when the save had no block (an older build dropped it)
  };
}
```

### 2.2 Cleaning: `cleanSensei(raw, p)`

It runs after units, progress and missions have been cleaned.
- **`avatar`, `favorite`:** an owned unit or null.
- **`showcase`:** owned, distinct, at most 8, original order kept.
- **`pins`:** must match `PIN_RE` and be earned (`progress.stages[id][d] === true`, or `modes['d:m']`), distinct, at most 3.
- **`badges`:** `missions.achievements[id] === true`, not in `BADGE_EXCLUDE` (`a_pulls_*`, which signal spending), at most 6.
- **`title`, `frame`:** in `earnedTitles(p)` / `earnedFrames(p)` (§2.4), else null.
- **`banner`:** known and unlocked, else `'academy:day'`.
- **`bio`:** a string, trimmed, at most 80 characters, else `''`. It is not re-checked against the text rules: it only mirrors the server, which re-checks it.

### 2.3 Hooks in `save.js` (no SAVE_VERSION bump)

```js
// createProfile()
sensei: newSensei(),
// migrateProfile(), after p.social = cleanSocial(raw.social)
p.sensei = isObj(raw.sensei) ? cleanSensei(raw.sensei, p) : { ...newSensei(), lost: true };
```

- **`migrationDropsData`:** dropped profile picks (a showcased girl no longer owned) are cosmetic and must not count as "lossy".
- **feature/roster (save version 3):** its `migrateProfile` needs the same line. That is a coordination note for whichever branch merges second.
- **`identity.profileCard(profile)`:** becomes `avatar: profile.sensei?.avatar || profile.secretary || 'hikari'`. `ensureOnline` already pushes avatar changes.

### 2.4 Titles and frames become ids, worked out from `fpm:` keys

New `src/data/titles.js`:
- `TITLES = { fp_ashwing: 'Ashwing Slayer', fp_crimson: 'Crimson Slayer' }`
- `FRAMES = { eclipse: { … } }`

`earnedTitles(p)` reads `missions.counters`, which every older build keeps word for word:
- `fpm:blossom:matriarch` or `fpm:tempest:matriarch` → `fp_ashwing`
- `fpm:crimson:matriarch` → `fp_crimson`
- `fpm:<tier>:wyrm` → frame `eclipse`
- Old display strings in `progress.freeplay.titles` are mapped by name.

This removes the loss risk from the research map §0.7. Titles from achievements can be added later as more ids.

### 2.5 Reset, import, transfer, older tabs, two tabs

| Event | What happens to the profile |
|---|---|
| Reset (RESET67, Settings) | `createProfile()` → the block is empty, so the next sync publishes an empty showcase. The bio comes back from the server through the mirror; it is account data, like the name. Visibility is untouched. |
| Import | The imported block, cleaned against the imported save, is published under this account. The bio still mirrors this account's server bio. |
| Transfer code → new device | The save brings the block. The new anonymous account has no row, so the first sync publishes the card and also sends `sensei.bio` once through `set_profile_bio` (checked again). Visibility starts at the default, as `dm_privacy` does. The old account's card stays orphaned. |
| An older cached build saves | It drops `sensei`. The new build loads with `lost: true`. On the first sync, the picks (favorite, banner, frame, title, showcase, pins, badges) come back from the server card; the avatar comes from `profiles.avatar` when the player owns that girl. Each is cleaned again, then `lost` is cleared. |
| Old tab still open | Its `ensureOnline` pushes avatar = secretary, so the avatar flips back and forth until it closes. This is cosmetic. |
| Two new-build tabs | Social's `saveRev` stops the stale tab from saving. The server keeps whichever card was written last; both come from the same save. |

---

## 3. The published card (format v1)

### 3.1 Shape

Short keys, because the measured size is half that of copying the save's shape:

```jsonc
{
  "v": 1,
  "fav": "hikari",                    // favorite girl (left portrait) | null
  "ban": "theme:festival",            // banner id | null
  "frm": "eclipse",                   // avatar frame id | null
  "ttl": "fp_crimson",                // title id | null
  "units": [                          // the top 8, in the owner's order
    { "id": "hikari", "lv": 60, "bt": 5, "aw": 5,
      "p": 6,                         // Potential (once train-a ships; optional)
      "sk": "hikari_sentinel",        // outfit (once feature/roster ships; optional)
      "g": [                          // equipped gear, one piece per slot (optional)
        { "s": "charm", "r": "legendary", "l": 10,
          "m": ["atkPct", 0.1234],    // main stat
          "x": [["critChance", 0.0512], ["armorPen", 12.4]] } ] } ],
  "med": { "c": [40, 40, 38, 12],     // campaign medals per difficulty (easy, normal, hard, nightmare)
           "a": [59, 59, 55, 14],     // every stage
           "rib": 312,                // ribbons (once codex-modes ships)
           "pins": ["8-5:nightmare", "1-1:hard:rush"] },  // ≤ 3
  "fp": { "w": 147, "t": "crimson", "s": "8-5" },  // best freeplay wave | null
  "ach": ["a_gold_40", "a_sakura_10"]  // ≤ 6 pinned achievement badges
}
```

**Never published:**
- gear `uid`, `locked`, `name`, `equippedBy`
- `exp`, `obtainedAt`, bond
- gems, coins, pulls, `gemsEarned`, inventory, codes, mail, friend code
- clan (the player card already shows it, with the dev-clan rule)
- any timestamp

**Server limits are set a little above today's game, so new content needs no new paste:**
- ids are checked by pattern, not by list
- `lv` up to 999, at most 4 gear pieces, at most 6 substats per piece

### 3.2 Size

Measured on PGlite with the heaviest possible card: 8 girls, each with 3 legendary +10 pieces carrying 4 substats, plus skins, Potential, 3 pins and 6 badges.

| Measure | Bytes |
|---|---|
| `JSON.stringify` (client) | 4,452 |
| `octet_length(card::text)` (jsonb text adds spaces) | 5,029 |
| Stored (TOAST-compressed) | 893 |

- **Limits:** the client keeps `JSON.stringify(card)` at or under **6,000**; the server refuses `octet_length(card::text) > 8,192`.
- **Rounding:** gear values are rounded to 4 decimals when the card is built.
- **Storage:** about 1 KB stored per player, so 10,000 players come to about 10 MB of the 500 MB free plan.

### 3.3 Building the card: `buildCard(profile)` (pure, in `profileRules.js`)

- **`units`:**
  - Taken from `sensei.showcase`; if it is empty, the 8 strongest girls by `unitPower` are used. That default is applied when the card is built and never stored, so a new player's profile is not empty.
  - Each girl's gear comes from `profile.gear[st.gear[slot]]`, slots in the order charm, ribbon, shoes.
  - `p` is `potentialLevel(st)` once train-a ships; `sk` is `st.skin` once roster ships. Both are left out when absent.
- **`fav`:** `sensei.favorite || secretary`.
- **`med.c` / `med.a`:** counts per difficulty over `CAMPAIGN_IDS` / `STAGES`.
- **`med.rib`:** `ribbonCount(p)` once codex-modes is merged, otherwise left out.
- **`fp`:** the maximum over every stage and tier of `coopBestWave` and `freeplayBest`.
- **Hash:** `cardHash(card)` = FNV-1a 32-bit of the JSON, in base 36, sent next to the card.

### 3.4 What the viewer does: `cleanViewedCard(card)` — the trust boundary

**Rule: never show a string the client cannot turn into its own text or art.**
- Unknown unit, skin, banner, title, frame, achievement, stage or mode ids are dropped. An unknown banner falls back to the default.
- Levels are clamped to `levelCap(bt)`; `bt` to 0–5, `aw` to 0–5, `p` to 1–6.
- Gear:
  - unknown slots or rarities are dropped
  - a main stat must be allowed for its slot (`GEAR_MAIN_STATS`)
  - substats must be known, distinct and within `GEAR_SUBSTATS_BY_RARITY`
  - values are clamped to the game's highest possible roll
- Medal counts are clamped to the real stage totals (40 campaign, 59 in all, 800 ribbons).
- A build inflated with dev codes still shows, inflated. That is cosmetic and accepted.

### 3.5 Hold for info: the snapshot as a mini-profile for the Unit Sheet

```js
export function snapshotToMiniProfile(u) {           // u = one cleaned card.units entry
  const gear = {};
  const slots = { charm: null, ribbon: null, shoes: null };
  for (const g of u.g || []) {
    const uid = `snap:${u.id}:${g.s}`;
    slots[g.s] = uid;
    gear[uid] = { uid, slot: g.s, rarity: g.r, level: g.l, main: { stat: g.m[0], value: g.m[1] },
      subs: (g.x || []).map(([stat, value]) => ({ stat, value })), locked: false, equippedBy: u.id, name: '' };
  }
  return { units: { [u.id]: { level: u.lv, exp: 0, breakthrough: u.bt, awaken: u.aw, dupes: (u.p || 1) - 1,
    skin: u.sk || null, gear: slots, favorite: false, obtainedAt: 0 } }, gear };
}
```

- **Calling it:** `openUnitSheet(id, { profile: mini, readonly: true, ownerName })`. `unitBattleStats`, `unitPower`, `levelCap`, `displayRarity` and `gearStatTotals` already accept this shape.
- **Test:** build the card from a save, convert it to a mini-profile, and get the owner's own stats for that girl back, to within the 4-decimal rounding.
- **Co-op ally chips** can use the same path: a mini-profile built from the loadout's `stats` (level, breakthrough, awaken; no gear).

---

## 4. The server

### 4.1 Table

```sql
create table if not exists public.profile_cards (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '',
  visibility text not null default 'everyone' check (visibility in ('everyone', 'friends_clan', 'nobody')),
  card jsonb not null default '{"v": 1}'::jsonb,
  card_hash text not null default '',
  bio_changed_at timestamptz,
  bio_hidden boolean not null default false,
  bio_strikes int not null default 0,
  bio_strike_at timestamptz,
  bio_locked_until timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profile_cards enable row level security;   -- no policies: functions only
revoke all on public.profile_cards from anon, authenticated;
```

There is deliberately no check constraint on `bio` or `card`. A NOT VALID check still runs on every UPDATE of an old row, so a later, stricter rule would lock players out of publishing; the social file learned this with names. The functions check what changes, and `profile_view` re-checks the bio when it reads it, so a stricter rule hides old bios immediately.

### 4.2 Entry points

All are SECURITY DEFINER, identify the caller through `social_me()`, and are granted only to `authenticated`.

| Function | Does | Limit |
|---|---|---|
| `profile_version() → 1` | The deploy probe ("Needs the latest server update") | — |
| `profile_view(p_user uuid) → json` | `player_card(p_user)` plus `since` (the account's creation day; `profiles.created_at` is already readable), `profileWhy`, `profile: { bio, card }` when shown, and `own` (on your own profile only) | `card` 120/h (through `player_card`) |
| `my_profile_card() → json` | Your own state: `{ exists, bio, visibility, card, hash, bioHidden, bioLockedUntil, muted, updatedAt }` | — |
| `set_profile_card(p_card jsonb, p_hash text) → { hash }` | Checks the card with `valid_profile_card`, then upserts it | `profile` 1/s, 60/h |
| `set_profile_bio(p_bio text) → own json` | Trims; `''` always allowed. Otherwise: at most 80 characters, `valid_dm_body`, `profile_contact_free`; refused while muted or locked. The same text again changes nothing (a hidden bio stays hidden); a new bio shows again. | `bio` 10/day |
| `set_profile_visibility(p_value text)` | `everyone` / `friends_clan` / `nobody` | `settings` 20/h |

**What `profileWhy` can be** (the order matters):

| Situation | `profileWhy` | `profile` |
|---|---|---|
| Your own profile, row exists | null | yes, plus `own` |
| Your own profile, no row yet | `none` | null, plus `own` (`exists: false`) |
| You blocked them | `blocked_by_me` | null |
| They have no card | `none` | null |
| They blocked you, or their setting excludes you | `private` (identical answer) | null |
| Otherwise | null | `{ bio, card }` |

- **Who counts for "Friends & clan":** `social_are_friends`, or `social_clanmates(owner, viewer, 72)`. These are the same people who could message you under that DM setting, so the words mean one thing everywhere.
- **When the bio shows as `''` to others:** while it is hidden, while its owner is under an owner mute, or when it fails today's `profile_bio_ok`. Its owner always sees it, with `own.bioHidden`.
- **Not sent to others:** `updated_at` (it would show when someone is online), the other player's visibility value, and moderation state.
- **What a block still reveals:** comparing with a second account can show that you are blocked, the same unavoidable leak as social's "room full" answer.

### 4.3 The bio's contact rules (`profile_flat` + `profile_contact_free`)

**Normalising.** `profile_flat` turns the bio into the text the rules check:
- NFKD: fullwidth becomes ASCII, circled and maths digits become 0–9, every space becomes `' '`, and `＠` becomes `@`
- marks, variation selectors, keycaps and ZWJ/ZWNJ are dropped
- the look-alike table of `name_key()` is applied (Cyrillic and Greek letters to Latin)
- `。 ․ ‧ ·` become `.`
- everything is lower-cased

**Refusing.** The bio is refused when the normalised text matches any of:

```sql
       t ~ '(https?|ftp) *:|://|(^|[^a-z0-9])w ?w ?w ?\.[a-z0-9]'
    or t ~ '[a-z0-9]\.(com|net|org|gg|io|me|tv|ly|co|uk|us|ca|au|xyz|app|dev|link|live|to|be|gl|info|biz|site|online|club|ru|de|fr|jp|cn|kr|tk|ml|ga|cf|gq|page|top|store|shop|fun|chat|social|games)([^a-z0-9]|$)'
    or t ~ '[a-z0-9] *(\( *dot *\)|\[ *dot *\]|\{ *dot *\}| dot ) *(com|net|org|gg|io|me|tv|ly|co|uk|us|xyz|app)([^a-z0-9]|$)'
    or t ~ '\.[a-z]{2,}/'
    or t ~ '@'
    or t ~ '# *[0-9]{4}'
    or t ~ '[0-9]([^0-9a-z]{0,2}[0-9]){6,}'
    or translate(regexp_replace(t, '[^a-z0-9]', '', 'g'), '013457', 'oieast') ~ '(discord|snapchat|instagram|tiktok|whatsapp|telegram|facebook|twitter|youtube|gmail|hotmail|icloud|venmo|cashapp|paypal|skype|reddit|onlyfans)'
    or translate(regexp_replace(t, '[^a-z0-9]+', ' ', 'g'), '013457', 'oieast') ~ '(^| )(kik|insta|snap|yt|fb|dc|ig|twitch)( |$)'
```

All patterns use ASCII spaces only; there is no `\s` or locale class anywhere, so JS and SQL behave the same. `profileRules.js` exports each pattern as a string, and a lint test checks that each one appears word for word in the SQL.

**Results (identical in SQL and JS):**

| Allowed | Refused |
|---|---|
| `Lv 60 Hikari ★5 P6` | `visit sakura.gg` |
| `Cleared 8-5 on Nightmare 🌸` | `discord.gg/abc` |
| `wave 147 on 8-5 crimson moon` | `www.example.org`, `w w w.sakura` |
| `I love Aoi. Me too!` | `Ｈｉｋａｒｉ．ｃｏｍ`, `hikari。com`, `ѕakura.com` (Cyrillic ѕ) |
| `wait...me too`, `No.1 Luna fan`, `St.Hikari academy` | `sakura dot com`, `sakura (dot) gg`, `hikari.io/me` |
| `polka dot dress fan` | `add me @hikari_fan`, `hikari＠mail`, `Hikari#1234` |
| `GG! #1 Kaede fan` | `call 555-1234`, `(555) 123 4567`, `５５５１２３４５６７`, `my bday 2014/03/09` |
| `うちのひかりちゃん最高www`, `最高www.`, `lol www` | `add me on d1sc0rd`, `ⓓⓘⓢⓒⓞⓡⓓ`, `Dïscörd`, `my Snap Chat: hikari`, `find me on tik tok` |
| `my eye twitches`, `1-1 1-2 1-3` | `kik me`, `yt: hikari`, `ig hikari_fan`, `my insta hikari_fan`, `my twitch is hikari` |

**Known false positives (accepted; the message says what to change):**
- `8-5 8-4 8-3 8-2` (8 digits in a row with separators)
- `oh snap`, `insta kill lol`

**Deliberately allowed:**
- A friend code (`ABCD2345 add me`). Codes are meant to be shared, and a request still needs the player to accept it.
- Stating an age (`I am 12 years old`).

There is still no profanity filter (the owner's decision); reports and the auto-hide cover bad words. The short-word list (`kik insta snap yt fb dc ig twitch`) is the part the owner may want to tune.

**Player-facing messages:**
- `Bios are up to 80 characters.`
- `Bios can't contain invisible characters.`
- `Keep links, e-mails, @names, phone numbers and other apps out of your bio.`
- `You can't change your bio right now.`

### 4.4 Reports, auto-hide, lock

Reporting from the profile uses the existing `report_player(target, reason, note, 'profile', null)`; `openReportDialog`'s default context is already `'profile'`. Two triggers, created by the profile file, only add to the social `reports` table. Pasting the social file again keeps them (proven), and `report_player()` needs no change.

**`reports_profile_evidence`** (BEFORE INSERT, or UPDATE OF evidence)
- Adds `evidence.profile = { bio, bioChangedAt, bioHidden, visibility, fav, ban, frm, ttl, units:[ids], pins, ach, earlier:[{bio, at}] }`.
- `earlier` keeps the previously reported bios: once each, newest 3. So a bio edited after a report never erases what was reported.
- Social's evidence (DMs, the reported message, the target) is unchanged.

**`reports_profile_hide`** (AFTER INSERT, or UPDATE OF context, updated_at) → `profile_maybe_hide(target)`:
- **Counting:** distinct reporters with an open `context = 'profile'` report filed or repeated since the bio's last change, whose account is at least 24 hours old.
- **3 or more** → `bio_hidden = true` and one strike.
- **A second strike within 30 days** → `bio_locked_until = now() + 7 days`. Clearing the bio is still allowed while locked.
- **Why 24 hours, not social's "7 days + contact":** hiding a bio does little harm, while leaving a harmful one up does more, so the bar is lower. Throwaway accounts still have to wait a day.
- **Known limitation:** reports filed from the player card in chat or the clan roster also use context `'profile'`, so they count too. Adding a separate `'bio'` context would mean re-creating `report_player`, which is the same hazard as `join_room`.

**Mutes:**
- Any social mute (auto or owner) refuses new bio text.
- An **owner** mute also hides the bio from everyone else at read time. The owner gets a moderation lever without new SQL.

### 4.5 Owner moderation (adds to docs/ONLINE.md → Moderation)

```sql
-- bios hidden by reports, or with open profile reports
select c.user_id, p.name, c.bio, c.bio_hidden, c.bio_strikes, c.bio_locked_until, c.bio_changed_at,
  (select count(*) from reports r where r.target_id = c.user_id and r.status = 'open' and r.context = 'profile') as open_reports
from profile_cards c join profiles p on p.id = c.user_id
where c.bio_hidden or exists (select 1 from reports r where r.target_id = c.user_id and r.status = 'open' and r.context = 'profile')
order by c.updated_at desc;

-- the bio a report was about (and the ones before it)
select r.id, r.reason, r.evidence -> 'profile' ->> 'bio' as bio, r.evidence -> 'profile' -> 'earlier' as earlier
from reports r where r.id = 123;

-- remove a bio and keep new ones out for 30 days (the game's mirror clears it on the next sync)
update profile_cards set bio = '', bio_hidden = false, bio_locked_until = now() + interval '30 days' where user_id = '<uuid>';

-- a bio hidden by mistake: show it again
update profile_cards set bio_hidden = false, bio_strikes = greatest(bio_strikes - 1, 0) where user_id = '<uuid>';

-- after a rule change: bios today's rules refuse (they are already hidden when read)
select user_id, bio from profile_cards where bio <> '' and not profile_bio_ok(bio);
```

### 4.6 The rest of the SQL file

The order guard comes first, so a paste in the wrong order creates nothing:

```sql
do $$
begin
  if to_regprocedure('public.social_version()') is null or to_regclass('public.reports') is null then
    raise exception 'Run 20261013000000_social.sql first: this file needs its blocks, reports and text rules';
  end if;
end $$;
```

The header lists what the file creates and the limits; `valid_profile_card` is a sequential plpgsql check (§3.1); the remaining functions are in §4.2–4.4. The file ends with a revoke-by-name loop over every function it creates, then grants on the 6 entry points and `notify pgrst, 'reload schema'`, exactly as the social file does.

Full text: `docs/specs/profile/20261016000000_profile.sql`.

---

## 5. Client API

### 5.1 `src/online/profileRules.js` (pure; sketched in `profileRules.sketch.js`)

**Constants** (the SQL repeats them; the lint test compares):
- `BIO_MAX 80`, `SHOWCASE_MAX 8`, `PINS_MAX 3`, `BADGES_MAX 6`
- `GEAR_MAX 4`, `SUBS_MAX 6` (server limits)
- `CARD_TEXT_MAX 8192`, `CARD_JSON_BUDGET 6000`
- `PROFILE_VISIBILITY` and its default `'everyone'`
- `BIO_HIDE { reporters 3, minAccountHours 24, strikeWindowDays 30, lockStrikes 2, lockDays 7 }`
- `ID_RE`, `SKIN_RE`, `BANNER_RE`, `PIN_RE`, `BADGE_RE`
- `CONTACT_PATTERNS`, `CONTACT_APPS`, `CONTACT_WORDS`

**Functions:**
- `profileFlat`, `contactFree`, `bioError(text)` (a player-facing message or null)
- `validCard`, `buildCard(profile)`, `cardHash`
- `cleanViewedCard`, `snapshotToMiniProfile`, `restorePicks(profile, card)`

It reuses `MESSAGE_INVISIBLE`, `VISIBLE_CHAR`, `COMBINING_RUN`, `MARK_SET` and `LOOKALIKE_*` from `textRules.js`.

**Additions to `limits.js` RULES:**
- `profile: { gapMs: 1000, max: 60, windowMs: HOUR, label: 'profile update' }`
- `bio: { gapMs: 0, max: 10, windowMs: DAY, label: 'bio change' }`
- `'bio'` is added to `ROLLING_DAILY`.

### 5.2 Backend facade (`backend.js`)

```js
export const PROFILE_METHODS = ['profileView', 'myProfileCard', 'setProfileCard', 'setProfileBio', 'setProfileVisibility'];
// LIMITED += { profileView: 'card', setProfileCard: 'profile', setProfileBio: 'bio', setProfileVisibility: 'settings' }
api.profileStatus()   // 'ready' | 'needs_update' | 'offline'; 'needs_update' whenever socialStatus() is;
                      // otherwise probes profile_version (adapter.profileProbe), cached like socialStatus
api.recheckProfile()  // the "Retry" button
for (const name of PROFILE_METHODS) api[name] = (...args) => profileCall(name, args); // socialCall's twin
```

### 5.3 Supabase adapter

Each method uses `srpc`, which already turns a missing function or a lost grant into `needs_update`.

```js
async profileProbe()            { try { await srpc('profile_version'); return 'ready'; } catch (e) { return e?.code === 'needs_update' ? 'needs_update' : 'offline'; } },
async profileView(userId)       { const r = await srpc('profile_view', { p_user: userId });
                                  return { ...r, lastActive: tsOrNull(r.lastActive), since: tsOrNull(r.since), requestId: r.requestId ?? null, threadId: r.threadId ?? null }; },
async myProfileCard()           { const r = await srpc('my_profile_card'); return { ...r, bioLockedUntil: tsOrNull(r.bioLockedUntil), updatedAt: tsOrNull(r.updatedAt) }; },
async setProfileCard(card, hash){ return srpc('set_profile_card', { p_card: card, p_hash: hash }); },
async setProfileBio(bio)        { const r = await srpc('set_profile_bio', { p_bio: bio }); return { ...r, bioLockedUntil: tsOrNull(r.bioLockedUntil) }; },
async setProfileVisibility(v)   { await srpc('set_profile_visibility', { p_value: v }); return true; },
```

The profile screen calls only `profileView`, because it already includes the player card. The card modal's "View profile" button just navigates to `#/profile?u=<uuid>`.

### 5.4 Local mode mirror (`?online=local`)

New file `src/online/adapters/localProfile.js`, mixed into `createLocalDb()` the way `localSocial.js` is. It keeps the same rules over `state.profile.cards[uid]`.

- **Imports:** `profileRules.js`.
- **Uses social's helpers:** `isBlocked`, `areFriends`, `clanmates`, `muted`, `ownerMuted`. `createLocalSocial` exposes these alongside `guardChat` and the others.
- **Report hook:** `localSocial.report` gains an `afterReport(s, report)` hook. It adds `evidence.profile` (keeping `earlier`) and runs `maybeHide`.
- **Feature flag:** `features.profile` from `?profile=0`, which simulates the live server before the profile SQL is pasted. `?social=0` implies `profile=0`.

### 5.5 Sync (`src/online/profileSync.js`)

```js
export async function syncProfile({ reason = 'online' } = {}) {
  const backend = getBackend();
  if ((await backend.profileStatus()) !== 'ready') return 'skipped';
  if (reason !== 'edit' && !dirty && Date.now() - lastAuto < 10 * 60e3) return 'throttled';
  const p = store.profile; const s = p.sensei;
  let own = await backend.myProfileCard();
  // 1. bio: the server's text is the one that counts (moderation, other devices); a new account
  //    gets the save's bio once (a transfer)
  if (own.exists) { if (s.bio !== own.bio) { s.bio = own.bio; store.commit('sensei'); } }
  else if (s.bio && !bioError(s.bio)) { try { own = await backend.setProfileBio(s.bio); } catch { s.bio = ''; store.commit('sensei'); } }
  // 2. picks an older build dropped: once, from the server copy (cleaned against this save)
  if (s.lost) { if (own.exists && own.card) restorePicks(p, own.card, backend.user?.avatar); s.lost = false; store.commit('sensei'); }
  // 3. the card, only when it changed
  const card = buildCard(p); const hash = cardHash(card);
  if (hash !== own.hash) await backend.setProfileCard(card, hash);
  dirty = false; lastAuto = Date.now();
  return 'synced';
}
```

| Trigger | Reason | Throttle |
|---|---|---|
| End of `ensureOnline()` (every online screen; the lobby chat icon; the social hub 1.5 s after boot when a name is stored) | `online` | 10 min unless dirty |
| Social hub refresh tick | `tick` | 10 min |
| Profile editor "Save" (bio goes through `setProfileBio` directly; the editor needs to be online for the bio) | `edit` | none (the server's 1 s / 60 per hour still applies) |
| `store.on('change')` with `reason === 'replace'` (reset, import, transfer) | marks dirty | next trigger |
| Opening your own profile | `online` | as above |

- **Write volume:** at most about 6 automatic writes per hour, plus edits. An unchanged card is never sent again.
- **On failure:** sync errors stay quiet (as the social hub's do). The editor shows them with `errorText()`.

---

## 6. Kid safety: summary

- **Only one piece of free text:** the bio. 80 characters, no newlines, DM text rules plus the contact rules, checked on the server when written and again when read.
- **Kept small:** bios are never shown in chat, friend lists or notifications, only on the profile screen. Everything else on the card is ids the viewer turns into its own text and art; unknown ids never show. That stops anyone smuggling words in through ids such as `ttl: "add me on discord"`, which the server's patterns also refuse.
- **Reportable:** reports work like DM reports and keep server-made evidence, including earlier bios. 3 reporters hide a bio, the second time locks bio edits, mutes refuse edits, and an owner mute takes the bio down. The owner has a moderation query.
- **Private when wanted:** "Only me" and "Friends & clan". A block looks exactly like "Only me". No presence leaks through the card's update time.
- **No wealth or spending signals:** no gems, pulls or `gemsEarned`; recruit-count achievements cannot be pinned.
- **Never trusted by the game:** self-reported numbers stay cosmetic.

---

## 7. Tests

### 7.1 New tests

**`tests/online/profileRules.test.js`** (pure)
- `bioError` messages
- the contact vectors from §4.3, including the documented false positives and the deliberately allowed cases
- `validCard` accept/refuse table (the same 16 shapes as `parity.mjs`, plus the oversized-literal case)
- `buildCard`:
  - a fresh save → valid, with the "8 strongest" default
  - a maxed save → valid and within `CARD_JSON_BUDGET`
  - no `uid`, `locked`, `name`, gems or pulls in the JSON
- `cardHash` is stable
- `cleanViewedCard` drops unknown ids, clamps to the level cap, removes duplicate substats and never returns an unknown title or banner string
- the `snapshotToMiniProfile` round trip gives the owner's `unitBattleStats`, `unitPower` and `gearStatTotals` to within rounding
- `restorePicks` keeps only what this save owns or has earned

**`tests/online/profileSchema.test.js`** (PGlite; all migration files twice, with and without default grants — the `probe.mjs` scenarios turned into vitest)
- **Lint:**
  - RLS on `profile_cards` and no player grants
  - the `profile` and `bio` rate numbers equal `RULES`
  - every `CONTACT_PATTERNS` / `CONTACT_APPS` / `CONTACT_WORDS` string appears in the SQL
- **ACLs:**
  - the 6 entry points only, nothing for anon, helpers refused
  - no direct select, insert, delete or truncate on `profile_cards`
- **Order guard:** profile before social raises and creates nothing.
- **Publishing:** the heaviest card is accepted (size logged); 22 shapes are refused.
- **Bio parity:** the shared vectors give identical results through `profile_contact_free` / `profile_bio_ok` and through `contactFree` / `bioError`.
- **Visibility matrix:**
  - everyone
  - `friends_clan` with a stranger, a friend, a clanmate under 72 h and one over 72 h
  - nobody
  - your own profile, with no row and with a row
- **Blocks:**
  - owner blocked the viewer → the `profileWhy` / `profile` answer equals the "nobody" answer
  - viewer blocked the owner → `blocked_by_me`
- **No presence:** neither `updatedAt` nor `own` appears in another player's view.
- **Mutes and locks:**
  - muted → new text refused, clearing allowed
  - owner mute → hidden for others, `own.bioHidden` true for the owner
- **Evidence:** `evidence.profile` carries the bio and ids, social's fields are unchanged, and `earlier` survives an edit followed by a repeat report.
- **Auto-hide:**
  - 2 counted reporters plus a fresh account → still shown
  - 3 counted → hidden
  - the same text again stays hidden
  - new text shows again
  - 3 new reports → second strike → locked
  - while locked: new text refused, clearing allowed
- **Owner review:** `update reports set status = 'reviewed'` still works.
- **Rate limits:** two publishes in one second → `rate_limited`.
- **Re-pastes:**
  - social again → triggers and grants kept
  - online again → `permission denied` (the game shows needs_update)
  - online → social → profile → everything restored

**`tests/online/localProfile.test.js`** — the same scenario table against the local adapter, the way `localSocial.test.js` mirrors the social schema test.

**`tests/online/backendProfile.test.js`**
- facade gating: social `needs_update` ⇒ profile `needs_update` without a request; the probe is cached
- limiter mapping; `profileView` counts as `card`

**`tests/online/profileSync.test.js`** (fake backend)
- the bio mirror (server wins; owner-cleared → local cleared)
- a new account → a one-time `setProfileBio`
- `lost` → `restorePicks` once
- unchanged hash → no write
- throttling; `replace` marks the card dirty

**`tests/systems/senseiSave.test.js`**
- `createProfile` has the block
- migration keeps it; a missing block → `lost: true`
- `cleanSensei` drops unowned, unearned and over-limit picks and recruit-count badges
- export/import round trip
- `earnedTitles` comes from `fpm:` keys even when `progress.freeplay` was dropped; legacy title strings are mapped

### 7.2 e2e: `e2e/profile.mjs`

Local adapter; pages A, B, C, D; viewports 844×390 and 1280×720; screenshots.

1. A: lobby badge → `#/profile`.
   - Bio `discord.gg/x` shows the inline error. Then `Hikari is the best!`.
   - Set banner, favorite, 8 showcase taps, 2 pins, "Everyone" → Save.
2. B: clan chat → A's name → card → View profile.
   - B sees the bio, the favorite portrait, 8 tiles and the medal row.
   - Holding tile 1 opens the Unit Sheet read-only with **A's** level and gear, without "Open full page".
3. A sets "Only me" → B sees the private card.
4. A sets "Everyone" again and blocks B → B sees the same private card.
5. B, C and D (accounts aged) report the bio → B no longer sees it; A sees "hidden while it's checked". The local db dump has `evidence.profile.bio`.
6. A tab with `&profile=0` shows the "Needs the latest server update" card on the profile; chat and DMs still deliver.
7. A runs RESET67 → the showcase is empty after sync, the bio survives through the mirror, and visibility is unchanged.

### 7.3 Existing tests that change

- **`tests/online/socialSchema.test.js` `ALLOWED`:** add `profile_version`, `profile_view`, `my_profile_card`, `set_profile_card`, `set_profile_bio`, `set_profile_visibility`. `pgHarness.js` concatenates every migration file, and that test scans every public function.
- Its publication list and the social lint slice are unaffected: the profile file adds no Realtime table and no player grants.

---

## 8. Migration order and deploy (owner runbook text)

1. `20261008000000_online.sql`: live already.
2. `20261013000000_social.sql`: when social ships. Check with `select public.social_version();` → 1.
3. `20261016000000_profile.sql`: when the profile ships, any time after step 2. Check with `select public.profile_version();` → 1.

- **The frontend ships first.** Until step 3 has run, the profile shows "Needs the latest server update" (the probe) and nothing else changes.
- **Pasting `online.sql` again:** paste social, then profile, again right after it. The first file revokes every function grant in `public`; proven above.
- **Pasting `social.sql` again:** nothing more is needed. It revokes only its own function names, and the report triggers survive.
- **Pasting `profile.sql` again:** harmless (idempotent).
- **Wrong order:** the profile file refuses before social with a clear message and creates nothing; the whole paste is one transaction.
- **With Supabase's GitHub integration**, files apply in filename order (`…16…` after `…13…`), so the guard never fires.
- **If the profile frontend is ready the same week as social**, give the owner both files in one sitting: two pastes, about 2 minutes.

---

## 9. D1 in detail: fold into the unrun social SQL, or a separate migration?

| | A: fold into `20261013000000_social.sql` | **B: separate `20261016000000_profile.sql`** |
|---|---|---|
| Owner effort when the profile ships | 0 extra pastes **only if** the profile SQL is final before the owner runs social. Otherwise the owner re-pastes the 2,000-line social file. | 1 extra paste of about 460 lines, plus 1 check query |
| Risk to social | Reopens a file that has been through review and is finalized. Its tests and evidence functions get edited (`report_player`, `player_card`). | None. Social is untouched; the profile composes `player_card()` and adds triggers to `reports`. |
| Timing | The profile depends on the train-a Unit Sheet (v0.1.28), codex-modes ribbons and roster outfits, so it is later than social. Folding either delays social or freezes the card format too early. | Independent. The card format already accepts `p`, `sk` and `rib`, so those merges need no SQL change. |
| Later tweaks (bio word list, limits) | Each one means re-pasting the 2,000-line social file | Re-paste only the small file |
| Order hazards | None new | One new rule (online → social → profile), enforced by the guard and covered by the probe |

**Recommendation: B.**
- **Owner cost:** one extra paste, once.
- **What it buys:**
  - The social file ships exactly as reviewed.
  - A mistake in the profile SQL cannot break DMs or reports.
  - The profile can be revised on its own schedule.

The only real gain from A is one fewer paste, and only if both features are finished together, which the dependencies make unlikely.

---

## 10. Owner decisions (with defaults if unanswered)

1. **Who can see a profile by default.** Default **Everyone**: name, level and avatar are already public, and the card holds game data plus a filtered bio. The alternative is Friends & clan.
2. **The bio.** Default **free text with the filter**, plus optional quick-pick lines in the editor that simply fill the field. The alternative is preset lines only.
3. **Reset keeps the bio.** Default yes: it is account data, like the name, and RESET67 is used often.
4. **The short-word list (`snap`, `insta`, …).** Default **keep it**. Its false positives (`oh snap`, `insta kill`) are listed in §4.3.
5. **Retention.** Default **keep cards forever**: about 1 KB per player after compression. Optional later: prune cards of accounts inactive for more than 180 days.
