# Sensei Profile: research map (Oct 15, 2026)

Scope: what the owner's profile request can reuse today, and what it has to work around. The request covers username, bio, favorite units, a top-8 showcase (press and hold opens another player's build), the favorite girl's portrait on the left, a profile picture, a banner, and a ribbon and medal showcase.

Sources (all read-only):
- live `/home/user/sakura-game` (v0.1.27, branch `claude/sakura-sentinels`)
- `/home/user/wt-social` (`feature/social`; its SQL has not been run yet)
- `/home/user/wt-traina` (`release/train-a`, which ships as v0.1.28)
- `origin/feature/codex-modes`, `origin/feature/potential-m0` (already merged into train-a), `feature/roster`, `origin/feature/hero-rework`

Path prefixes used below: `L:` = live, `S:` = wt-social, `T:` = wt-traina, `C:` = `git show origin/feature/codex-modes:<path>`, `R:` = `git show feature/roster:<path>`.

---

## 0. Key findings (read this first)

1. **A "player card" already exists, but only on feature/social, and it is a small modal.**
   - It shows name, level, avatar, clan, presence (friends and clanmates only) and the action buttons Message, Invite to co-op, Add friend, Block and Report.
   - It has no bio, no showcase and no art.
   - It comes from `player_card(uuid)` (`S:supabase/migrations/20261013000000_social.sql:928-979`) and `openPlayerCard()` (`S:src/ui/online/playerCard.js:36-197`).
   - Live has no player card at all: `L:src/ui/online/` has no `playerCard.js`.
2. **The `profiles` row is fully public to every signed-in player.**
   - Columns: `id, name, level, avatar, last_active, created_at`.
   - Policy `using (true)` plus a table-level `grant select` (`L:supabase/migrations/20261008000000_online.sql:33-40, 240, 293`).
   - Any column added to `profiles` becomes readable by everyone, including players you blocked. Profile content that should respect blocks or privacy belongs in a separate table with no grants, read only through a SECURITY DEFINER function, the way `player_card` works.
3. **Nothing on the server is verified.**
   - `level` is computed by the client and written by the client (1–999).
   - `avatar` is free text of up to 32 characters, set to the lobby secretary's id.
   - The server never sees saves (`S:…social.sql:52-55`).
   - Every showcase number (units, gear, medals, ribbons) is self-reported, and the dev codes make it easy to inflate: `VERITY777` gives 999,999 gems and the Supply Bot gives any item (`L:src/data/missions.js:89-90`).
   - So these numbers are bragging only. The server checks shape and ranges; the viewer's client sanitizes before rendering.
4. **No link filter exists anywhere.**
   - Chat and DM text rules cover invisible, bidi and control characters, stacked marks, 1–200 characters and visibility (`S:src/online/socialRules.js:83-90`, `S:src/online/textRules.js`, SQL `valid_dm_body` `S:…social.sql:113-120`).
   - Nothing blocks URLs, emails, handles or phone numbers.
   - A bio needs new rules on both client and SQL: no links, no emails, no long digit runs. Report and evidence also need to snapshot the bio.
5. **The Unit Sheet cannot show another player's girl as-is.**
   - It, and the student `infoTab` and `statsTable` it embeds, read `store.profile` in 6 places.
   - It never shows gear, even for your own girls.
   - The hold system is keyed on `data-unit` and always opens the viewer's own data.
   - The co-op lobby already has this bug: holding the ally's girl chip shows your own copy of her, or "Recruit" if you don't own her (`T:src/ui/screens/coop.js:136-140, 491`).
   - Precedent for a fix: POTENTIAL §7.6 already defines the "mini-profile snapshot" rule for an ally's girl.
6. **The pieces of a build are pure functions of `{units, gear}`.**
   - `unitBattleStats`, `unitPower`, `levelCap`, `displayRarity` and `gearCard` all work on a snapshot shaped like `{ units: {id: st}, gear: {uid: g} }`.
   - A top-8 snapshot with 3 gear pieces each is about 4.2 KB compact, or 10 KB if it copies the save's shape (measured; see §2.4).
7. **Titles and frames are stored but not shown anywhere, and can be silently lost.**
   - Freeplay titles and frames live in `progress.freeplay.{titles, frames}` (`L:src/online/coop/rewards.js:220-235, 297-308`).
   - Docs say "no display yet" (`L:docs/ONLINE.md:403`); results say "New profile frame" (`L:src/ui/battle/results.js:348`).
   - Titles are stored as display strings ('Ashwing Slayer'), not ids. No frame art exists.
   - Only the milestone `done` keys are mirrored into `missions.counters` (`fpm:`). If an older tab drops `progress.freeplay`, the titles and frames are lost for good, and the milestone never pays again.
   - Fix: derive titles and frames from the `fpm:` keys.
8. **Medals are live; ribbons are on a branch.**
   - Medals: 4 difficulties × every stage (`progress.stages[id].easy|normal|hard|nightmare`). Art: `medalIcon()`.
   - Ribbons (codex-modes, not merged): 20 per campaign stage, so 800 in all (`progress.stages[id].modes['hard:rush']`). They pay 0 gems and have no dedicated ribbon art, only the six mode badges `modeIcon()`.
9. **Identity lives outside the save.**
   - The online name is in localStorage `ss-online-v1` (`L:src/online/identity.js:1-39`). The avatar is the lobby secretary.
   - Reset, Import and transfer codes only replace the local save (`L:src/core/store.js:101-119`).
   - A transfer moves the save but not the anonymous account: no name, friends, clan or DMs.
   - So profile choices belong in the save (they travel with export and transfer). The server keeps a published copy that is re-synced on `ensureOnline`, exactly like level and avatar are today.
10. **The save loader is an allowlist** (`L:src/systems/save.js:302-435`). A new top-level block, for example `profile.card`, must be added to `createProfile` and `migrateProfile`, or it disappears on the next load. Older cached builds will drop it when they save. That is acceptable for cosmetics (codex-modes used the same "additive, no bump" reasoning), or the server copy can restore it.
11. **There is enough art for a first version.**
   - 19 girls × 6 portrait kinds (the transparent `cut` stand is right for the favorite girl on the left).
   - 11 SVG theme banners (2.75:1), 3 painted lobby scenes, the academy backdrop × 3 tints, and 49 stage thumbnails.
   - 4 medal icons and the UR rainbow ring.
   - Missing: frame art, ribbon art, title art, achievement icons (all use one `trophy` icon), and a drawn-portrait avatar (online `avatar()` still draws the procedural SVG doll).
12. **The deploy pattern to copy:** a separate migration with a `*_version()` probe, the frontend shipping before the SQL with a "Needs the latest server update" state, and re-paste ordering. Re-pasting `online.sql` revokes every function grant (`L:…online.sql:826`; `S:…social.sql:8-9`).

---

## 1. Player card and profiles today

### 1.1 The `profiles` table (first migration; live and social identical)

`L:supabase/migrations/20261008000000_online.sql`:
- `:33-40` table:
  - `id uuid` (FK auth.users)
  - `name` (2–16 characters, no `<>`, default 'Sensei')
  - `level int 1..999`
  - `avatar text ≤32`, default 'hikari'
  - `last_active`, `created_at`
- `:45-56` `valid_display_name()`: no control or bidi characters, no reserved names (system, admin, mod, dev, staff, gm, sakurasentinels…). Added as a NOT VALID check.
- `:59-71` trigger `profiles_before_write`: the server stamps `last_active` on every write and keeps `id` and `created_at`.
- `:240-244` RLS: `profiles_read … using (true)`, insert and update only your own row.
- `:289-296` grants: `select` on the whole table to `authenticated`; insert `(id, name, level, avatar)`; update `(name, level, avatar)`.
- `:363-389` the chat insert trigger copies `name, level, avatar` from `profiles` into each message (`messages` `:110-121` has name/level/avatar columns), so old messages keep the name as it was.
- `:574-577` `touch_active()`.
- `:826-835` `revoke execute on all functions … grant execute on function …` (the re-paste hazard).

### 1.2 What other players can already read (any signed-in, anonymous account)

| Data | How | Ref |
|---|---|---|
| `profiles.*`: id, name, level, avatar, **last_active**, **created_at** | direct table select | online.sql `:240, :293` |
| clan membership: user_id, clan_id, role, joined_at | `clan_members_read using (true)` | online.sql `:256` |
| clans (not the dev clan unless you're in it) | `clans_read` | online.sql `:248` |
| chat: global plus own clan, with name/level/avatar at send time | `messages_read` | online.sql `:263-264` |
| player_card: clan, `lastActive` only for friends/clanmates/self, friend state, canMessage/why, myPrivacy (the viewer's own), threadId | RPC | social.sql `:930-979` |
| co-op peer: uid, name, level, avatar, loadout `[{unitId, stats}]`, hero | Realtime hello | `L:src/online/coop/session.js:134, 353`; `L:src/online/coop/loadout.js:16-23` |

The social SQL says it plainly: "every profile row (id, name, level) is readable anyway" (`S:…social.sql:33-34`). The `lastActive` gate is "cosmetic: profiles.last_active is readable anyway" (`:966`).

**Implication:** a profile must not add new private data:
- no gems, coins or wealth
- no redeemed codes, mail or friend code (the friend code is shown only on your own card, `S:playerCard.js:151-163`)
- no presence beyond what the card already shows

Showcase data is game data (fine to show), but keep it out of `profiles` columns if blocks or privacy should apply.

### 1.3 `player_card()` (feature/social SQL, not run yet)

`S:supabase/migrations/20261013000000_social.sql`:
- `:928-929` comment: nothing about the other player's settings or blocks leaks; `why` is one of self, blocked_by_me, muted, my_setting, clan_new, name, not_allowed.
- `:930-979` the function:
  - `enforce_rate('card', 0, 120, 1 h)` at `:944`.
  - The dev clan is hidden unless the viewer is in it (`:946-947`).
  - Returns `userId, name, level, avatar, clan{id,name,tag}, clanmate, lastActive (gated), isSelf, friend, requestId, blockedByMe, canMessage, why, myPrivacy, canFriend, friendWhy, threadId` (`:962-978`).
- `:909-910` `social_version()` returns 1. The frontend probes it and shows "Needs the latest server update" (`S:src/online/adapters/supabase.js:379-386`, `S:src/online/backend.js:36-49, 143-160`).
- `:1963-1973` grants: `player_card(uuid)` to authenticated.
- Local mirror: `S:src/online/adapters/localSocial.js:352-380` (`?online=local`, two tabs).
- Client limiter: `card: 120/h` (`S:src/online/limits.js:44-45`; `S:src/online/backend.js:31`).

### 1.4 Player card UI (feature/social)

`S:src/ui/online/playerCard.js`:
- `:36-48` `openPlayerCard(userId, hint, ctx)`:
  - a `modal({ title: 'Player', cls: 'sc-card-modal' })`
  - head row: `avatar(hint.avatar, 64)`, name, `levelChip`
  - clan line and presence below
- `:51-72` loads `ensureOnline()`, then `socialStatus()`, then `backend.playerCard(userId)`.
- `:82-119` other player: Message, Invite to co-op (or "In your co-op room"), friend row, Block/Unblock, Report.
- `:151-163` self: "This is you.", your friend code, "Who can message me", and a link to Online settings.
- `:179-193` block confirm text and report (`openReportDialog`, context `ctx.context || 'profile'`).

Entry points (all `S:`):
- chat name tap: `src/ui/online/chatPanel.js:55`
- clan roster: `src/ui/screens/clan.js:324`
- friends list: `src/ui/screens/messages.js:259` (context 'profile')
- co-op ally avatar: `src/ui/screens/coop.js:513` (context 'coop')

The live lobby's top-left account badge is hard-coded to the name "Sensei" and opens Achievements (`L:src/ui/screens/lobby.js:328`; `levelBadge` `L:src/ui/components.js:141-163`). It is the natural "my profile" entry point (Blue Archive style).

No `profile` route exists. Routes are registered in `T:src/main.js:11-38`; social adds `messages`.

### 1.5 Name, level and avatar sync

- `L:src/online/identity.js:1-39`:
  - `IDENTITY_KEY = 'ss-online-v1'` in localStorage (sessionStorage per tab in local mode)
  - "outside the save, so the save format stays unchanged"
  - `profileCard(profile) = { level: accountLevel(profile).level, avatar: profile.secretary || 'hikari' }`
- `L:src/ui/components.js:105-137` `accountLevel()`: derived, never stored (medal XP 15/25/40/60, clears, wins, battles, pulls, roster, unit levels and awakens; max 99).
- `L:src/ui/online/common.js:32-64` `ensureOnline()`: `backend.init({level, avatar, name})`. If name, level or avatar differ from the server, it calls `updateProfile`.
  - Social version: `S:src/ui/online/common.js:32-64` (a stored name the rules no longer accept is never sent; a rename refusal keeps syncing level and avatar).
- `L:src/ui/online/common.js:67-100` `askName()`: `writeIdentity` (`:68`; `S:` `:79`) runs before `updateProfile`.
- `S:src/online/adapters/supabase.js`:
  - `:183-205` `signIn`: anonymous auth; upserts the row (auto name `Sensei####`, `L:src/online/clanRules.js:48-52`) or updates level and avatar.
  - `:209-216` `me()` selects explicit columns ("never profiles.*").
  - `:217-225` `updateProfile`.
- When sync runs: on any online screen, and in the lobby when a name is stored (`L:src/ui/online/lobbyChat.js:21-24` `ensureOnline({ask:false})`). Social also starts the hub 1.5 s after boot if `ss-online-v1` has a name (`S:src/main.js:111-120`).

### 1.6 Safety machinery a profile can reuse

| Piece | Where | Reusable for the profile? |
|---|---|---|
| Name rules: valid_display_name + visible_name + reserved/look-alike (name_key) | online.sql `:45-56`; social.sql `:142-210` (`visible_name`, `reserved_name`, `name_key`), trigger `:1728-1740`; client `L:src/online/clanRules.js validateName`, `S:src/online/textRules.js:37-70` | The username is the existing online name: reuse as-is |
| Rename limit 3/day | social.sql `:1744-1753` | yes |
| Message body rules (1–200, invisible, stacked marks, visible) | `S:socialRules.js:83-95`; SQL `valid_dm_body` social.sql `:113-120` | Base for the bio, **plus a new no-links/no-contact rule** (none exists) |
| Report (reasons bullying, inappropriate, spam, personal_info, other; context includes `'profile'`) | social.sql `:326-345` (table), `:1394-1430` (`report_player`), `:761-800` (`social_report_evidence`: target name and level, plus DMs) | yes, but the evidence must also copy the reported bio and showcase text (a bio can be edited after a report) |
| Block (silent to the blocked player) | social.sql header `:22-31`; card `:948-961` | the profile view should honour it (blocked_by_me: hide bio? show minimal) |
| Owner mutes / auto-mute | social.sql `:353-361`, `social_maybe_auto_mute` | a muted player's bio edits should be refused (as with DMs) |
| Rate limits (`enforce_rate`) | online.sql `:304-340`; `S:src/online/limits.js` | add `profile_edit` (e.g. 10/h) |
| Plain-text rendering | `h()` sets textContent | bio must always be text, never `html:` |

### 1.7 Deploy and migration status

- The social SQL "is NOT yet run by the owner" and is still being finalized. Its header (`S:…social.sql:1-72`) documents the run steps and the re-paste rule: "if 20261008000000_online.sql is ever pasted again, paste THIS file again right after it".
- **Option A:** fold profile tables and RPCs into the social file before the owner runs it: one paste, but it grows a file that is already judged and finalized.
- **Option B:** a third migration (`2026101x_profile.sql`) with `profile_version()`. The frontend ships first with "needs update" gating, following the `social_version` pattern.
- Testing: the PGlite harness (`S:tests/online/pgHarness.js`, `socialSchema.test.js`, `schema.test.js`) and the local adapter mirror (`S:src/online/adapters/localSocial.js`, `localDb.js:226-240`).

---

## 2. Unit Sheet and the hold gesture (release/train-a, ships as v0.1.28)

### 2.1 Hold gesture (`T:src/ui/hold.js`)

- `:13-19` timings: `HOLD_MS 450`, ring from 120 ms, cancel past 10 px, click swallowed for 700 ms.
- `:22` `HOLD_ROUTES` = formation, students, stage, recruit, coop, wiki, backpack, mall, campaign, rewards. There is no `profile` route, and the player card is a modal over chat, clan or messages routes, so it is not a hold route.
- `:27` `HOLD_EXCLUDE`. Opt-out per subtree: `[data-hold-info="off"]`.
- `:31` `NO_FULL_PAGE = {coop}`.
- `:47-116` `createHoldGesture()`: pure, reusable, unit-tested (`T:tests/ui/hold.test.js`).
- `:127-161` `showHoldRing()` / `hideHoldRing()`; `:175-204` `swallowNextClick()`; `:215-223` `onEscape()`.
- `:230-237` `holdTarget()`: `closest('[data-hold-unit],[data-unit]')`, unit id only; `:246-250` `openSheetFor(unitId, opts)`.
- `:255-369` `installHoldInfo()`: delegated document listeners, right-click, `i` key, prefetch of the sheet chunk.
- Contract: `T:CONTRACTS.md:1078-1092`.
- **Gotcha:** every `portraitHTML` `<img>` carries `data-unit` (`L:src/art/portraits.js:135`), and `unitCard` sets `data-unit` (`L:src/ui/components.js:437`). Any portrait of another player's girl on a hold route opens the **viewer's** sheet unless an ancestor has `data-hold-info="off"`.

### 2.2 What the sheet shows for a girl (`T:src/ui/unitSheet.js`)

- `:42` `openUnitSheet(unitId, { tab, allowFullPage, origin })`. There is no profile or snapshot parameter.
- `:47-49` `const profile = store.profile; st = profile.units[unit.id]; shown = displayRarity(unit, profile)` (UR when an owned SSR is at awaken 5).
- `:68-76` header meta: `Lv. st.level / levelCap(st)` (breakthrough sets the cap), `stars(st.awaken, MAX_AWAKEN)`, `unitPower(profile, id)`. If not owned: a lock plus "Starter / Free after X / Recruit".
- `:85-94` "Open full page" goes to `#/student?id=…` (the viewer's own page).
- `:95-96` card art `portraitHTML(unit,'card',{awaken})` plus `applyUrFrame(art, unit, profile)`.
- `:136-150` Info tab = `student.js infoTab(unit)` word for word (`T:src/ui/screens/student.js:324-371`):
  - role and subclass, good/bad, chips, type effectiveness, capabilities, hero ult and levels
  - "Profile" (quote, `unit.bio`, personality, how-to-get if not owned), tips
  - "Base stats" via `statsTable(unit, unitBattleStats(profile,id))` with a "yours" column (`:172-204`, owned check `:174`)
  - awakening passive on/off from `st.awaken >= 3`
- `:152-187` Upgrades tab: `buildTreeModel({ def: unit, mode: 'static' })`. Static and independent of the profile (Self / Allies / Enemies / Coins legend, 3×5 tree, tier details, hero block, ★3 passive).
- **Not shown anywhere in the sheet:** gear (the student page's Equipment tab `T:student.js:640-700` is interactive: enhance, reroll, equip), breakthrough count (implied by the cap only), Potential (M0 has no UI), outfit/skin, bond, obtained date.

### 2.3 Can it render another player's girl? Not without changes

Every read of the viewer's save:

| Place | Reads |
|---|---|
| `T:src/ui/unitSheet.js:47-49` | `store.profile`, `st`, `displayRarity(unit, profile)` |
| `T:src/ui/unitSheet.js:71-73` | `levelCap(st)`, `st.awaken`, `unitPower(profile, id)` (pure given a profile) |
| `T:src/ui/unitSheet.js:96` | `applyUrFrame(art, unit, profile)` |
| `T:src/ui/unitSheet.js:85-94` | "Open full page" goes to the viewer's student page: must be hidden (`allowFullPage:false`) |
| `T:src/ui/screens/student.js:325-330` (`infoTab`) | `store.profile`, `unitBattleStats(profile,id)`, `profile.units[id]` |
| `T:src/ui/screens/student.js:174` (`statsTable`) | `store.profile.units[unit.id]` for the "yours" column |
| `L:src/ui/components.js:430-446` (`unitCard`) | `displayRarity(u, store.profile)`, `applyUrFrame(el, u, store.profile)` |

Already pure, so they accept a snapshot mini-profile `{ units: { [id]: st }, gear: { [uid]: g } }`:
- `L:src/systems/progression.js:265-287` `unitBattleStats`, `:293-304` `unitPower`, `:28` `levelCap`
- `L:src/systems/gear.js:350-361` `gearStatTotals` (reads `profile.units[id].gear[slot]` → `profile.gear[uid]`)
- `L:src/ui/rarity.js:32-37` `displayRarity`, `:72` `applyUrFrame`
- `T:src/ui/screens/backpack.js:102` `gearCard(gear, {compact})` (no store reads)

Precedents for "an ally's girl from her owner's data":
- `T:docs/specs/POTENTIAL.md:575-578` (§7.6): "both the P pill and the UR badge come from her owner's battle stats (`isUR(def, { units: { [def.id]: { awaken: t.unitStats.awaken } } })`)".
- The co-op loadout carries `stats = unitBattleStats(...)` per girl (`L:src/online/coop/loadout.js:16-23`), including `level, awaken, breakthrough` but not gear pieces.
- **Existing bug with the same root cause:** `T:src/ui/screens/coop.js:136-140` `unitChip(unitId)` sets `data-unit`, and the room card lists **the ally's** loadout (`:491`). Holding an ally's girl in the co-op lobby opens the viewer's sheet: your own level, or "Recruit" if you don't own her. The profile work should fix both paths with one `openUnitSheet(id, { snapshot, ownerName, allowFullPage:false })` API.

Minimal change set (for the spec):
- `openUnitSheet(unitId, { profile = store.profile, readonly, ownerName })`
- `infoTab(unit, { profile })`
- `statsTable(unit, battle, { owned })`
- `unitCard(…, { profile })`
- a new read-only **Build** block (level/cap, breakthrough, ★, Potential, 3 gear cards, gear totals, outfit)
- the showcase subtree marked `data-hold-info="off"`, with its own `createHoldGesture` + `showHoldRing` + `swallowNextClick` handlers that open the snapshot sheet
- tap = add/remove in edit mode on your own profile; hold = info

### 2.4 Data a "build" needs and its size

Per girl:
- `unitId`
- `level` (1–60)
- `breakthrough` (0–5, sets the cap: `min(60, 10+10·bt)`, `L:src/systems/save.js:150-151`)
- `awaken` (0–5; UR = SSR at 5)
- `dupes`/Potential (train-a, 1–6)
- `skin` (feature/roster, v3)
- 3 gear pieces, each `{slot, rarity, level 0–10, main{stat,value}, subs[≤4]{stat,value}}` (`L:src/systems/save.js:173-197`)

Measured with `node` (scratchpad `size.mjs`), 8 girls with full gear plus profile extras:
- **4,173 bytes** in compact form
- **10,008 bytes** if it copies the save's shape (uid, base, upgrades, name, equippedBy, locked)

Suggested cap: `pg_column_size(snapshot) <= 6 KB`, with a strict JSON shape check in SQL, like `valid_dm_meta`. Gear uid, lock and name must not be published.

---

## 3. Collectibles to showcase: storage, branch status, art

| Thing | Stored in the save | Branch / status | Art | Notes |
|---|---|---|---|---|
| **Difficulty medals** | `progress.stages[id].{easy,normal,hard,nightmare}: bool` (`L:src/systems/save.js:362-363`) | live | `medalIcon(d,{earned})` (bronze, silver, gold, sakura) `L:src/art/icons.js:189-216`; `medalRow` `L:src/ui/screens/stage.js:107` | `DIFFICULTIES[d].medal` `L:src/data/types.js:178-184`; `stageMedals` `L:src/systems/unlocks.js:40-43`. Stages: 40 campaign (8 chapters), 15 resource, 3 boss, 1 challenge. Achievements count campaign medals only. |
| **Mode ribbons** | `progress.stages[id].modes['hard:rush']: true` | `origin/feature/codex-modes` (not merged) | no ribbon art: the stage-prep corner uses `uiIcon('check'/'star')` (`C:src/ui/screens/stageModes.js:47-51`); mode badges `modeIcon()` `C:src/art/icons.js:239-256` (6 coloured circles); names and colours `C:src/ui/text/modes.js:5-12` | 5 ribbon modes × 4 difficulties = 20 per campaign stage; Nightmare × Last Petal derives from the Nightmare medal (`C:src/systems/unlocks.js:72-79`); `ribbonCount` `:82`, `chapterRibbons` `:89` (100 per chapter, 800 total). `cleanModeRibbons` `C:src/systems/save.js:295-302`, migrate `:377-381`. 0 gems (`C:src/systems/rewards.js:19-20`); spec `C:docs/specs/CODEX_MODES.md:29-34, 283-294, 373-406`. Ribbons come only from wins in the five non-Standard modes, solo only (co-op earns no medals or ribbons). |
| **Freeplay titles** | `progress.freeplay.titles: string[]` (display strings 'Ashwing Slayer', 'Crimson Slayer') | live | none | milestone table `L:src/online/coop/rewards.js:34-40`; awarded `:297-308`; sanitized `L:src/systems/save.js:377-381`; shown only once on results `L:src/ui/battle/results.js:348`. **Not mirrored** into counters (only `fpm:tier:id` done-keys are, `:221-237`), so an old tab can erase them for good. Derive from `fpm:blossom|tempest:matriarch` → 'Ashwing Slayer', `fpm:crimson:matriarch` → 'Crimson Slayer'. |
| **Freeplay frames** | `progress.freeplay.frames: ['eclipse']` | live | **no frame art** | Eclipse Wyrm kill, any tier (`rewards.js:39`). Same loss risk; derive from `fpm:*:wyrm`. |
| **Freeplay best waves** | `progress.stages[id].coopBestWave{blossom,tempest,crimson}` and `freeplayBest{…}` (solo) | live | none | `L:src/systems/save.js:364-374`; tiers `L:src/data/freeplay.js:92,111,122`. A "Best wave 147/15 (Crimson Moon)" stat fits a showcase. |
| **Achievements** (30) | `missions.achievements[id] = true` when **claimed**; progress is computed | live | one generic `uiIcon('trophy')` (`L:src/ui/screens/commissions.js:238`) | defs `L:src/data/missions.js:55-79`; `achievementList` / `claimAchievement` `L:src/systems/missions.js:237-255`. Names suit "badges" (First Patrol, Valedictorian, Sakura Sentinel, Encyclopedia Sakura…). |
| **UR** | derived: SSR with `units[id].awaken >= 5` | live (`ffc4d23`) | rainbow frame `urRing/urSparkles/urBadge/applyUrFrame` `L:src/ui/rarity.js:53-80`, `L:src/ui/styles/ur.css` | display only. |
| **Potential P1–P6** | `units[id].dupes` plus shadow `missions.counters['pot:<id>']` | M0 (counting only) merged in train-a; P1–P6 passives and UI not built | none yet (spec: "P3" pill) | `T:src/systems/potential.js:1-12, 46-48`; spec `T:docs/specs/POTENTIAL.md:99, 575-578`. |
| **Outfits / skins** | `units[id].skin`, `profile.skins[]`; **SAVE_VERSION 3** | `feature/roster` (not merged) | 3D chibi only; "her drawn portraits always show her main design" (`R:src/data/skins.js:4-6`); thumbs `R:public/art/skins/*.webp` (23 files) + `public/art/future/*.webp` | `R:src/systems/save.js:14-15, 46, 101, 402-403`. The v3 bump is a coordination point for any profile save field. |
| **Lobby backgrounds** | `lobbyBg { girl: bgId }` | live | 98 entries: 3 scene illustrations, 57 stand×tint, 38 bond (no art, locked) | `L:src/data/lobbyArt.js:1-16, 38-60`; count via `LOBBY_BACKGROUNDS`. |
| **Secretary** | `secretary` (owned id, else hero, else first owned) | live | the lobby drawn art | `L:src/systems/save.js:98, 427`; `L:src/ui/lobby/secretaryOf.js:6-12`. **Today it is also the online avatar** (`identity.js:38`). |
| **Bond** | `bond { girl: 0..10 }` | live but **always 0**: nothing raises it (only initialised, `L:src/systems/unlocks.js:30-31`) | none | future city/gift system. |
| **Per-girl "favorite" flag** | `units[id].favorite: bool` | live, **unused anywhere** | none | `L:src/systems/save.js:50, 161`. Can carry the owner's "favorite units" with no migration. |
| **Account level, stats** | derived level; `stats {battles,wins,kills,pulls,gemsEarned}` | live | `levelBadge` | `L:src/ui/components.js:105-163`; `L:src/systems/save.js:432`. Avoid `gemsEarned`/`pulls` on a public profile (wealth and spending signals). |
| **Heroes** | `units[hero]` keeps a meta level; the hero-rework adds no profile field | `origin/feature/hero-rework` | — | `HERO_REWORK.md` §1 item 10: "No profile field, no SAVE_VERSION bump". |

---

## 4. Art available for avatars, banners and the favorite girl

**Drawn portraits.** 19 girls (hikari luna nami aoi rei yuki momo akane sango kage umeko shiro midori suzu raika miko hotaru kaede chika) × 6 kinds = 114 webp, 7.0 MB, in `L:public/art/portraits/`. Spec: `L:src/art/portraits.js:1-15, 45-75`.

| Kind | Size | Fits |
|---|---|---|
| `thumb` | 160×160 | avatar |
| `bust` | 512×512 | big avatar / profile picture |
| `card` | 300×500 | showcase tiles; `unitCard` default |
| `full` | 768×1024 (3:4) | face-cropped illustration, `PORTRAIT_DATA.face` |
| `cut` | transparent full-figure stand, 1000 px tall (aspect 0.41–0.75, e.g. hikari 564×1000) | **the favorite girl standing on the left** (Blue Archive / Genshin style). Already used by the lobby, title and missions hub. |
| `cutS` | the same stand, 360 px tall (e.g. 203×360) | small stand |

`portraitHTML(unit, kind, {awaken})` (`:121-136`) falls back to `cardArtSVG` for girls with no files, for example future roster girls.

**Online avatar today.** `avatar(unitId)` draws the **procedural SVG doll** (`cardArtSVG(variant 'thumb')`), not the drawn thumb (`L:src/ui/online/common.js:168-182`; `S:` `:179-193`). Unknown ids fall back to hikari. Switching to `portraitHTML(u,'thumb')` is a cheap improvement, but it adds `data-unit` (hold target).

**Banners.**
- `themeBackdropSVG(theme)`: 11 procedural scenes at 1100×400 (2.75:1): sakura, lake, shrine, mountain, marsh, foundry, festival, volcano, snow, night, arena (`L:src/art/backdrops.js:212-219`). Already used for chapter, assault and challenge cards. A good first banner set; it crops with `slice` to the 844 px-wide strip.
- Painted lobby art: `L:public/art/lobby/academy.webp` 1536×1024 (+ day, sunset and night CSS tints, `lobbyArt.js:41-46`), and scene illustrations `hikari.webp`, `aoi.webp`, `sango.webp` at 1376×768 (`lobbyArt.js:49-53`), with `thumbs/`.
- `lobbyBackdropSVG()` seaside classroom (`backdrops.js:98`); `stageThumbSVG(mapDef)` at 320×200 for 49 maps (`L:src/art/stageThumb.js:78`).
- Possible unlock hooks: chapter banners unlocked by chapter clear, and the 3 lobby scenes unlocked when you own the girl.

**Badges and icons.**
- `medalIcon` × 4 (difficulties)
- `modeIcon` × 6 and `ruleIcon` × 15 (codex branch, `C:src/art/icons.js:239-256`)
- `uiIcon('trophy'|'star'|'heart'|…)` (`L:src/art/icons.js:223+`)
- the UR rainbow ring and sparkles

**Missing art:** avatar frames (the 'eclipse' frame has none), ribbon art, title plates, per-achievement badges, bond/date art.

**Layout fit at 844×390.** A left column of about 30% width × 390 px holds a `cut` stand (aspect ≤0.75 → ≤290 px wide). An 8-tile showcase as 4×2 `card` tiles (300×500 → about 70×116 each) fits beside it. A `bust`/`thumb` avatar overlaps the banner.

---

## 5. Settings name entry, "reset 67", transfer and import flows

### 5.1 Name entry
- Settings → Online: `L:src/ui/online/settingsOnline.js:16` (name label), `:25-33` `rename()` → `askName({ current })`, `:98-100` row "Online name — Shown in chat, clans and co-op." Social adds "Who can message me", the friend code and the blocked list (`S:` `:11-95, 192`).
- `askName` modal: `L:src/ui/online/common.js:67-100` (2–16 characters; "Not now" keeps `Sensei####`). It writes `ss-online-v1` **before** the server accepts the name (`L:` `:68`, `S:` `:79`). Social's `ensureOnline` copes with a later refusal: invalid or rate-limited names keep the old server name (`S:` `:44-55`).
- The profile's "username" **is** this online name. It should be edited from the profile through the same `askName`, so there is one source and one set of rules (2–16 characters, rename 3 per day, reserved and look-alike checks).

### 5.2 Reset flows (all call `store.reset()` → `store.replace(createProfile())`, `L:src/core/store.js:101-110`)
- Code `RESET67`, which is repeatable and a dev code (`L:src/data/missions.js:90`; normalizer `L:src/systems/missions.js:262-276`):
  - Title screen code modal: `L:src/ui/screens/title.js:208-216` (stays on the title screen)
  - Commissions → Codes: `L:src/ui/screens/commissions.js:294-302` (then navigates to the lobby)
- Settings → Save data → Reset (type RESET): `L:src/ui/screens/settings.js:243-256`.
- **None of them touch the online identity or the server row.** Name, account and friends survive. On the next `ensureOnline` (any online screen; the lobby chat icon when a name is stored) the client pushes the new `level` (now low) and `avatar` (hikari).
- Consequence for the profile: a server-side showcase would keep showing girls and medals the player no longer has until it is re-published. Rule: publish the profile snapshot from `ensureOnline` whenever its hash differs (as level and avatar do), and after any `store.replace`.
- Open question: does "reset" also clear the bio, banner and title? The name survives today (identity); progress-derived parts (showcase, medals, titles) must reset.

### 5.3 Import and transfer codes
- Import: `L:src/ui/screens/settings.js:239-241, 290-332` `importSaveText` (preview → confirm → `store.importSave` → `store.replace`).
- Transfer:
  - create: `L:src/ui/online/settingsOnline.js:35-54` (`createTransfer(store.exportSave())`; the payload is **only the save**, ≤300 KB, 24 h, one use; `L:…online.sql:194-201, 736-777`)
  - redeem: `:57-85` → `importText` → `store.replace`
  - Social blocks creating a code while a donation ledger is busy (`S:settingsOnline.js:122-126`).
- **Transfers move the save, not the account:** the new device signs in as a new anonymous user (new uid, name prompt, no friends, clan or DMs). Profile choices stored in the save (bio, favorite, showcase picks, banner, avatar choice, pinned medals, title, frame) travel; anything stored only server-side under the old uid does not. **Recommendation: the save is the source of truth; the server holds a published copy.**
- Text fields in the save, the bio especially, come from an editable client. The server must validate on publish anyway, and an imported bio goes through the same rules.

### 5.4 Older tabs and builds
- `migrateProfile` is an allowlist (`L:src/systems/save.js:302-435`): unknown keys are dropped. A new `profile.card` block (or similar) must be added to `createProfile` (`:72-106`) and `migrateProfile`. Older cached builds drop it when they save.
- Precedents:
  - Potential shadows into `missions.counters` (`T:src/systems/potential.js:7-10`).
  - Freeplay milestones mirrored as `fpm:` (`L:src/online/coop/rewards.js:221-237`).
  - codex-modes chose "additive, no SAVE_VERSION bump" for cosmetic ribbons (`C:docs/specs/CODEX_MODES.md:290-291`).
  - `profile.social` (`S:src/online/socialSave.js:1-3`) does the same.
- A bio string cannot be mirrored into numeric counters. Options:
  - accept the cosmetic loss
  - restore the block from the server copy at sign-in when it is missing locally
- Two tabs: social's `saveRev` makes a stale tab stop saving (`S:src/core/store.js:1-11, 33-42, 88`). This only works between tabs running the new build.
- `feature/roster` bumps `SAVE_VERSION` to 3 (`R:src/systems/save.js:14-15`). Coordinate if the profile ever needs a bump; it should not.

---

## 6. Constraints and decisions for the spec

1. **Where profile content lives on the server.** Keep it out of `profiles` columns (readable by all, ignores blocks). Use a new `profile_cards` table (no grants), written by `set_profile_card(jsonb)` with validation and a rate limit, and read through `player_card()` (extended) or `profile_view(uuid)`. Fold it into the unrun social SQL, or write a third migration with `profile_version()`?
2. **Bio rules.**
   - Length (BA uses about 40–60 characters; 1–80 suggested)
   - `valid_dm_body` + **new** no links / domains / emails / `@handles` / ≥5-digit runs (phone numbers), in SQL and client together
   - Refuse edits while muted
   - Rename-style rate limit
   - Report captures the bio in the evidence
   - Viewer-side: plain text only
   - Alternative or extra for kids: a set of preset "status lines" picked from a list (no free text)
3. **Block and privacy view.** What a blocked or blocking pair sees, without revealing the block: the same "minimal card" for everyone hidden? Should there be a "Who can see my profile" setting, or is the profile public to all signed-in players like name and level?
4. **Snapshot trust.** The server checks shape and ranges only: unit-id regex, ≤8 units, numeric clamps, ≤6 KB. The viewer sanitizes with save-like cleaners (drop unknown units and stats, clamp levels to the cap, ≤4 subs, no duplicate stats). Inflated dev-code builds are accepted as cosmetic. Never publish gear uid, lock or name, or wealth.
5. **Favorite girl and the 8 picks.**
   - Favorite girl: a single `favorite` id (default = secretary) shown as the `cut` stand.
   - Showcase: an ordered list of ≤8 owned unit ids.
   - Reuse `units[id].favorite` for the "favorite units" star (unused today), or keep the showcase as its own list.
6. **Avatar (profile picture).** Decouple it from the secretary? `profiles.avatar` is a ≤32-character text that old clients render via `getUnit(id) ? id : 'hikari'`. Keep it a plain unit id, add a separate frame field, and render drawn thumbs.
7. **Banner set v1.** 11 theme banners (unlock by chapter clear?) + 3 lobby scenes (own the girl) + the academy × 3 tints (free).
8. **Medal and ribbon showcase.** Totals per difficulty (x/40 Sakura…), pinned stages (up to 3?), ribbon totals once codex-modes merges (x/800), chapter completion. Achievement badges need icons, or a generic trophy plus name.
9. **Titles and frames.** Switch to ids, derive from `fpm:` keys (fixes the loss risk), draw the 'eclipse' frame, and decide whether achievements also grant titles.
10. **Hold for info on another player's girl.** Snapshot API for `openUnitSheet` (§2.3), plus a read-only Build block with gear. Also fix the co-op lobby ally chips.
11. **Entry points.** Lobby top-left badge (`L:lobby.js:328`) → `#/profile`; player card → "View profile"; co-op room card; friends list.
12. **Sync triggers.** `ensureOnline` (hash compare), after edits, after `store.replace` (reset, import, transfer). Local mode mirror for e2e.

---

## 7. File index (quick jump)

- Live SQL: `/home/user/sakura-game/supabase/migrations/20261008000000_online.sql`
- Social SQL: `/home/user/wt-social/supabase/migrations/20261013000000_social.sql`
- Player card UI: `/home/user/wt-social/src/ui/online/playerCard.js`; helpers `/home/user/wt-social/src/ui/online/common.js`; adapter `/home/user/wt-social/src/online/adapters/supabase.js`, `localSocial.js`
- Text rules: `/home/user/wt-social/src/online/textRules.js`, `socialRules.js`, `clanRules.js`
- Identity: `/home/user/sakura-game/src/online/identity.js`; Settings online: `/home/user/sakura-game/src/ui/online/settingsOnline.js`
- Save: `/home/user/sakura-game/src/systems/save.js`; store `/home/user/sakura-game/src/core/store.js` (social: `/home/user/wt-social/src/core/store.js`)
- Unit Sheet: `/home/user/wt-traina/src/ui/unitSheet.js`, `/home/user/wt-traina/src/ui/hold.js`, `/home/user/wt-traina/src/ui/screens/student.js`
- Medals and level: `/home/user/sakura-game/src/systems/unlocks.js`, `/home/user/sakura-game/src/art/icons.js`, `/home/user/sakura-game/src/ui/components.js`
- Ribbons: `git -C /home/user/sakura-game show origin/feature/codex-modes:<path>` for `src/data/modes.js`, `src/systems/unlocks.js`, `src/systems/save.js`, `src/ui/screens/stageModes.js`, `src/ui/text/modes.js`, `docs/specs/CODEX_MODES.md`
- Freeplay titles and frames: `/home/user/sakura-game/src/online/coop/rewards.js`
- Art: `/home/user/sakura-game/src/art/portraits.js`, `/home/user/sakura-game/src/art/backdrops.js`, `/home/user/sakura-game/src/data/lobbyArt.js`, `/home/user/sakura-game/public/art/`
- Size probe: `docs/specs/profile/size.mjs`
