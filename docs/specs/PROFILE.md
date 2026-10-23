# Sensei Profile: build spec (v1)

Oct 15, 2026. Lands in the repo as `docs/specs/PROFILE.md`.

Inputs judged: `research.md`, `design-ux.md` (Design A, screens) and `design-data.md` (Design B, data and safety), all in `docs/specs/profile/`. Where A and B disagree, the ruling is in §0.2 and the rest of this spec follows it. Design B's original sketch files are kept in `designB-original/`; the files next to this spec are amended to the v1 card format below and re-proven (§6.6).

**Owner request (Oct 15, verbatim):** "When you add profiles allow them to be displayed on your profile!! In your profile, it'll be your username, bio, maybe you can set favorite units, and then it can be like [reference games] where you can display your top 8 units that you can add or remove if you press and hold it'll bring up their info so you can see others builds. Whoever you set as your favorite girl, she'll be on the left side as her portrait. What else? Profile picture and a banner? Ribbon and medal showcase!" ("them" = Codex-mode ribbons and difficulty medals.)

---

## 0. Summary

### 0.1 What v1 is

One screen, `#/profile` (yours) and `#/profile/<userId>` (someone else's):

- **Left:** the favorite girl's full stand (`cut` art) with a nameplate.
- **Top:** a banner, then the picture with its frame, the online name, account level, one title, clan tag, "Sensei since <month>" and an 80-character bio.
- **Showcase:** your top 8 girls in your order. Hold one (or tap, on someone else's profile) to open **her build**: level, breakthrough, stars, UR, Potential, 3 gear pieces with stats, gear totals and battle stats. This reuses the train-a Unit Sheet with a new Build tab.
- **Medals & Ribbons:** medal counts over all 59 stages, ribbon counts per mode once Codex modes ship, and 4 pinned trophies.
- **Freeplay Records:** best wave per tier, plus your earned titles and frames.
- **Stats:** students owned, stages cleared, bestiary %, enemies defeated.
- **Visiting:** Message, Co-op, Add friend and ⋯ (Block, Report).
- **Safety:** privacy "Everyone / Friends & clan / Only me". A block looks exactly like "Only me". Bio filter, reports with evidence, automatic hiding.

Mock-up: `mock/profile.html` (`?state=own|build|visit|vbuild|edit|editp`). Screenshots are in `mock/shots/` at 1280×720 and 844×390.

### 0.2 Rulings (A vs B and open points)

| # | Topic | Ruling | Why |
|---|---|---|---|
| R1 | Migration file | **A separate file, `supabase/migrations/20261016000000_profile.sql`**, run after social (B §9) | Social ships exactly as reviewed. A profile mistake can't break DMs or reports. One extra paste, once. |
| R2 | Where data lives | New table `profile_cards`: RLS on, no grants, read only through `profile_view()`. No new `profiles` columns. | Every `profiles` column is readable by everyone, including players you blocked. |
| R3 | "Favorite units" | **= the ordered top-8 showcase.** The unused `units[id].favorite` flag stays untouched for v1. A's heart toggle on the student page moves to Later. | One concept, not two. The owner's "favorite units… top 8" reads as one feature. |
| R4 | Pins | **One shelf of 4 pins**, mixing medal, ribbon, perfect stage and achievement (A, as in the mock). B's separate 3 stage pins + 6 badges is dropped. | Matches the mock and the owner's "ribbon and medal showcase". Simpler card. |
| R5 | Titles | Freeplay titles **plus achievement names** (except recruit-count ones) in v1 | Only 2 freeplay titles exist, so most players would otherwise have "None". The data already exists. |
| R6 | Frames in v1 | Default, **UR Rainbow** (reuses `ur-ring`) and **Eclipse** (placeholder SVG from the mock). Sakura and Laurel come with art in M3; Rosette comes with ribbons. | Ship what has art. Ids are pattern-checked, so new frames need no SQL. |
| R7 | Freeplay on the card | Per tier `{ w, s, c }` (A's three rows), not B's single best | The screen shows three rows |
| R8 | Stats on the card | Add `st: { u, s, b, k }` | A shows them; B's card lacked them |
| R9 | Substat upgrade marks | Substats may carry a 3rd number, `ups` 0–9 | The build sheet shows ▲ marks (gear `subs[i].upgrades`) |
| R10 | "Updated N days ago" for visitors | **Dropped** (B wins) | It would reveal when someone was last online. |
| R11 | "Sensei since" | Month only: the server returns `'YYYY-MM'` | A's privacy rule; B's sketch returned the day |
| R12 | Blocked | Owner blocked the viewer → the same answer as "Only me" ("keeps their profile private"). The viewer blocked the owner → "You blocked this Sensei". | Never reveal a block (B). A's "isn't available" for both directions is replaced. |
| R13 | Bio authority | The server is authoritative (moderation, reset keeps it); the save holds a mirror. Edits only when online. | B. The bio survives RESET67 like the name does. |
| R14 | Visitor tap on a showcase girl | Tap **or** hold opens the build | A: younger players may never find the hold |
| R15 | Cheer stamps, heart toggle, frame in chat | **Later**, not v1 | Each needs new plumbing and none was asked for |
| R16 | Route | `#/profile/<uuid>` (the router's `id` param, like `#/student/aoi`), not `?u=` | Router convention (`parseHash`) |
| R17 | Global hold on the profile | `profile` is **not** added to `HOLD_ROUTES`. The screen wires its own `createHoldGesture` per card, and the root has `data-hold-info="off"`. | Portraits carry `data-unit`; the global hold would open *your* copy of their girl. |

### 0.3 Dependencies

| Needs | For | Status |
|---|---|---|
| train-a (v0.1.28): `src/ui/unitSheet.js`, `src/ui/hold.js` | M0 (sheet API) and M1 | Shipping next |
| `src/online/textRules.js` (pure, from feature/social) | Bio rules (M0 module, used in M2) | If profile M0/M1 must ship before social, cherry-pick this one file (it has no dependencies). |
| feature/social frontend + `20261013000000_social.sql` run | M2 (`player_card`, blocks, reports, mutes, `social_me`) | SQL not yet run |
| origin/feature/codex-modes | Ribbon tally, ribbon and perfect pins, Rosette | On a branch. The profile works without it (§5.3). |
| Potential: `potentialLevel(st)` in train-a's `src/systems/potential.js` (passives on potential-m0) | `p` on the card and the Potential tile | Arrives with train-a; still optional on the card |
| feature/roster save v3 (`units[id].skin`) | `sk` on the card and the Outfit chip | Optional field. Whichever of roster or profile merges second adds the `sensei` line to roster's `migrateProfile`. |

**Branch:** `feature/profile`, off live after train-a merges (rebased onto social when it merges).

---

## 1. Screens

### 1.1 Entry points and routes

| From | Action |
|---|---|
| Lobby top-left level badge (`lobby.js` `buildTop`, today `levelBadge(profile, { name: 'Sensei', onClick: → commissions achievements })`) | `name` becomes the online name (or "Sensei" when there is none) and `onClick` goes to `navigate('profile')`. Achievements stays in the Missions hub and gets an "All achievements →" link in the profile's Medals & Ribbons panel. (Owner Q3.) |
| Player card (`src/ui/online/playerCard.js`, opened from chat, clan roster, friends list and co-op room) | New **View profile** button at the top of the card. Tapping the card's avatar does the same. Hidden when `blockedByMe`. |
| Messages thread header | View profile |
| Co-op room, the ally's chip | View profile. Holding an ally's girl chip opens **the ally's** build (fixes today's bug, §7.4). |
| Routes | `registerRoute('profile', () => import('./ui/screens/profile.js'))` in `src/main.js`. `nav.js` `parentRoute('profile')` → `lobby`. Back returns to the opener through history, as the router already does. |

### 1.2 Layout

The style is our academy look: white translucent panels, blue→white headers with a yellow underline, slanted pills, italic navy Nunito headings. New CSS goes in `src/ui/styles/profile.css` with the class prefix `.pf-`. The measurements below come from the mock (`mock/css/profile.css` is the starting point).

| Region | PC 1280×720 | Phone 844×390 |
|---|---|---|
| Top bar | 50 px: back, title ("Sensei Profile" / "Hoshino's Profile"), actions on the right | 42 px |
| Favorite column (fixed; only the right column scrolls) | 372 px wide, stand about 600 px tall, plate 347×91 | 236 px, stand about 300 px, plate 220×54 |
| Banner | 214 px tall, full width under the translucent top bar, fixed crop (centre, 58% down), fades into the sky | 150 px |
| Identity panel | 882×147: 104 px avatar rising 44 px into the banner; 4 stat tiles on the right | 583×117: 70 px avatar; the stat tiles move to a "Records" panel lower down |
| Showcase | 8 cards in one row, 99×124 (4:5) | 8 in one row, 66×82 (stars hidden, name 0.62 rem) |
| Bottom row | Medals & Ribbons (517 px) next to Freeplay Records | Stacked, then Records |
| Above the fold | Everything | Banner, identity, bio and the full showcase |

### 1.3 Favorite girl (left column)

- One owned girl: `sensei.favorite`, or the secretary when that is null, so it is never empty.
- Art: `portraitHTML(id, 'cut')` over a soft white-violet halo and ring with a few petals. A future girl without `cut` falls back to `full` with `pt-edge`.
- Nameplate: a slanted white plate with a pink "♥ Favorite" ribbon, UR badge or rarity, name, title (`unit.title`), level, stars and a Potential pill (P2+, once Potential ships).
- **Own profile:** the pink ⟳ button opens the girl picker (the Edit Profile → Favorite tab). Tap → `navigate('student', { id })`. Hold → her build (live).
- **Someone else's profile:** tap or hold → her build from the snapshot. If the snapshot has no entry for her (she isn't in their showcase), the sheet opens the Info tab with `owner` set and no build numbers.
- **Card field:** `fav`. Viewers ignore unknown ids and fall back to `hikari`.

### 1.4 Identity panel

| Item | Own | Someone else's |
|---|---|---|
| Picture | `sensei.avatar` (owned girl), else the secretary. Drawn `thumb` portrait in a ring. The ✎ badge opens Edit Profile → Picture. | `player_card.avatar` (unknown → `hikari`) |
| Frame | `sensei.frame` (earned), drawn around the picture; its name shows under it ("Eclipse frame") | card `frm` |
| Name | Online name from `readIdentity()`; "Sensei" when there is none, plus the strip "Pick an online name to share your profile" (opens the existing `askName`) | `player_card.name` |
| Level | `accountLevel(profile)` on the navy slanted badge | `player_card.level` |
| Title | `sensei.title` on a violet→pink ribbon; nothing when null | card `ttl` → `TITLES[ttl]`; unknown → hidden |
| Clan chip | `[TAG] Name` from the cached own clan when online; hidden offline | `player_card.clan` (the dev clan is already hidden by `player_card`). Not tappable in v1. |
| Sensei since | `profile_view(me).since` when online (PC only) | `since` ('YYYY-MM') → "Sensei since Oct 2026" (PC only) |
| Bio | `sensei.bio` (the mirror). If the server says hidden: "Your bio is hidden while it's checked." | `profile.bio`. `''` (empty, hidden or muted) → no bio box. Rendered with `h()` text only. |
| Stats | 4 tiles (PC) or the Records panel (phone): Students `u/UNITS.length`, Stages cleared `s/59`, Bestiary `b%`, Enemies defeated `k` (25.3k) | card `st`, clamped (§6.4) |

### 1.5 Showcase (top 8)

- Up to 8 owned girls, in the order you choose; all cards are the same size.
- **Empty `sensei.showcase`** → the 8 highest `unitPower` girls, applied at display and build time and never stored. The own view adds a small "Auto · tap Edit to choose" hint.
- **Card:** `card` art cropped to the face; rarity badge or UR badge with `ur-ring` and sweep; Potential pill from P2 (P6 in the sakura style); name, level and stars; ♥ before the favorite girl's name.
- **Fewer than 8:** dashed "+ Add" slots on your own profile; nothing on someone else's.
- **Gestures** (each card has its own `createHoldGesture`; the screen root carries `data-hold-info="off"`):

| | Tap | Hold (450 ms, ring) |
|---|---|---|
| Own | Edit Showcase with that slot selected | Build sheet (live save) |
| Someone else's | Build sheet (snapshot) | Build sheet (snapshot) |

- **Hint text:** own "Tap to swap · hold for build"; someone else's "Hold a girl to see her build".

**Edit Showcase sheet** (`mock/shots/*-edit.png`):
- **Top:** 8 numbered slots, each with × (remove) and a drag grip.
- **Below:** "Your students", sorted by Power | Rarity | Level. Girls already placed are dimmed and show their slot number.
- **Add:** tap a girl to put her in the selected slot or the first empty one.
- **Reorder:** drag, or tap one slot then another to swap them.
- **Hold** a girl in the picker to see her build.
- **Footer:** Auto-fill by power | Cancel | **Save showcase**.
- **Save** writes `sensei.showcase` → `store.commit('sensei')` → marks the profile sync dirty.

### 1.6 Build sheet (press and hold)

It is the train-a Unit Sheet (`openUnitSheet`) with a new **Build** tab and a snapshot mode (API in §7). The frame is unchanged: 1000×650 modal on PC, 828×374 on the phone.

**Header:** UR badge, name and title. In snapshot mode, an **owner chip** ("Hoshino's build" with her picture). Then level / cap, stars, Potential pill, Power and ✕.

**Left column:**
- The card art in its rarity or UR frame.
- Outfit chip (once skins ship).
- P6 signature box (PC only, once Potential ships).
- One button:
  - your own girl: "Open her page";
  - snapshot mode: none in M2, **Compare with mine** in M3;
  - never Recruit in snapshot mode. If the viewer doesn't own her, M3's compare line reads "Not in your roster yet".

**Tabs:** **Build** | Info | Upgrades.
- Build is the default when opened from a profile or from co-op.
- The Build tab appears only when the girl exists in the profile being shown.
- Info is the student page's `infoTab`, with the column labelled "yours" or "theirs".
- Upgrades is the static tree, unchanged.

**The Build tab** (new `src/ui/unitBuild.js`):
1. **Growth:** four tiles.
   - Breakthrough · Level ("60 / 60" + 5 pips).
   - Awakening (★ + UR badge, "Fully awakened").
   - Potential (P4 / 6 on a six-node track; this tile is hidden until Potential ships).
   - Power (`unitPower(prof, id)`).
2. **Equipment:** 3 cards (charm, ribbon, shoes). Each has the gear icon in its rarity colour, slot, rarity pill and `+level`, the main stat band, and up to 4 substats with one ▲ per upgrade.
   - **Gear names are never shown**, not even for your own gear in this tab, so both modes render the same.
   - An empty slot reads "No charm equipped". From co-op it reads "Gear isn't shared in co-op".
3. **Gear totals:** chips from `gearStatTotals(prof, id)`.
4. **Battle stats:** damage, attack speed, range, crit and cost from `unitBattleStats(prof, id)`, each with its % over base. Computed **on the viewer's client**.
5. **Snapshot footnote:** "Shared from Hoshino's game · numbers are what her game reported." No date (R10).

**Phone:** the art column is 142 px; growth tiles and gear cards each fit one row; totals and stats are one scroll down; the signature box moves to Info.

### 1.7 Medals & Ribbons panel

**Tally (automatic):**
- **Medals:** `medalIcon` × 4 (bronze, silver, gold, sakura = easy, normal, hard, nightmare), each with a count out of 59, and a total out of 236. Counted over `STAGES` (40 campaign, 15 resource, 3 boss, 1 challenge).
- **Ribbons:** 5 mode badges (reverse, rush, ironclad, frugal, laststand), each out of 160, total out of 800.
  - Hidden until codex-modes is merged; Medals then takes the full width.
  - `ribbonTally(p)` returns null until then (§5.3).

**Pinned shelf: 4 plaques** (PC one row of 118×77; phone 2×2). Each plaque has a pin, an icon, a title and one line.

| Kind | Pin string | Icon | Example | Available |
|---|---|---|---|---|
| Stage medal | `8-5:nightmare` | that medal | "Sakura Medal · Stage 8-5" | v1 |
| Mode ribbon | `7-3:nightmare:laststand` | mode badge | "Last Petal · Nightmare 7-3" | with codex-modes |
| Perfect stage | `3-2:perfect` (all 20 ribbons) | rosette (placeholder SVG in the mock) | "All 20 Ribbons · Stage 3-2" | with codex-modes |
| Achievement | `ach:a_gold_40` | trophy (per-achievement badges in M3) | "Valedictorian · Achievement" | v1 |

- **Pin picker** (the **Pin** button): Medals | Ribbons | Achievements tabs.
  - It lists only what you have earned, best first (Sakura → Gold → Silver → Bronze, then later stages first).
  - Recruit-count achievements (`a_pulls_*`) are never listed.
- **Empty `sensei.pins`:** the best 4 medals, at display and build time. With no medals the shelf shows "Clear stages to earn medals" on your own profile and is hidden for visitors.
- **Own profile:** "All achievements →" opens Achievements.
- **M3:** tapping one of your own stage plaques opens a popover with the stage thumbnail, its 4 medals and a 5×4 ribbon grid.

### 1.8 Freeplay Records panel

- **One row per tier** in `FREEPLAY_TIERS` order (Blossom, Tempest, Crimson Moon): tier pill, the stage with the best wave (id + name), "Wave N", and a small "co-op" tag when that best came from co-op. A tier never played shows "—".
  - The best is the max of `coopBestWave[tier]` and `freeplayBest[tier]` over all stages; ties go to solo.
- **Own profile only:** chips for every earned title (violet) and frame (dark, with the frame's mini icon). Tapping a chip opens Edit Profile → Title or Picture.
  - Visitors see only the equipped title and frame.

### 1.9 Edit Profile sheet

Opened from "Edit profile" in the top bar (`mock/shots/*-editp.png`). Left nav sections, with a live **Preview** card on the right on PC.

| Section | Contents | Needs online |
|---|---|---|
| Bio | Text field, `80 / 80` counter, inline error from `bioError()`, rules note ("No links, emails, phone numbers or social handles, and no real names or school names. Be kind: other Senseis can report a bio."), **Quick lines** (one tap fills the field), and Name with "Change name" (the existing `askName`, 3 changes a day) | yes (bio is server-owned). Offline or not ready: read-only with "Connect to change your bio". |
| Picture | Grid of owned girls (drawn thumbnails) plus the frame row; locked frames show how to earn them | no |
| Banner | Grid with lock reasons | no |
| Title | Earned titles, plus "None" | no |
| Favorite | Owned-girl picker | no |
| Privacy | "Who can see my profile: Everyone / Friends & clan / Only me" | yes |

- **Footer:** "Saved to your game. Your bio and privacy save when you're online." | Cancel | **Save**.
- **Save:**
  - writes the save picks;
  - calls `setProfileBio` if the bio changed and `setProfileVisibility` if privacy changed;
  - then `syncProfile({ reason: 'edit' })`.
  - Server errors show with `errorText()` next to the field.
- **Preview** (top bar, own profile): renders the visitor layout from `cleanViewedCard(buildCard(profile))` plus the bio, so it goes through exactly the visitor's code path.
  - M1 uses the local card. M2 uses the server copy when it exists.
  - When privacy is "Only me", a strip reads "Only you can see your profile."

### 1.10 Someone else's profile

- **Title:** "<Name>'s Profile".
- **Top bar** (keeps the identity panel the same height):

| Button | PC | Phone | Rules |
|---|---|---|---|
| Message | primary | "Message" | `canMessage` / `why` from `player_card` (same texts as the card, `whyText`) |
| Invite to co-op | yellow | "Co-op" | social's co-op invite rules |
| Add friend | ghost | icon | `canFriend` / `friendWhy`, `friend` state |
| ⋯ | Invite to [TAG], Block, Report | same | Report → `openReportDialog(userId, { context: 'profile' })` with the existing reasons (bullying, inappropriate, spam, personal_info, other). No friend control (the top bar has it). Closes after an action that reloads the page, and when the page is left (also by a system back). |

- Why Message / Co-op (or Add friend) are off is said on the page, under the bio (the card's `whyText` / `friendWhyText`), and the disabled buttons point to it (`aria-describedby`).
- After an action the page loads once (one `profile_view` per tap).
- Factor the action rules out of `playerCard.js` into `playerActions(card)` so the card and the profile can never disagree. `playerActions.js` imports `social.css` itself (the visit loads it without the player card).
- Not shown on someone else's profile: last active, earned title/frame lists, pin popovers, cheers.

### 1.11 States

| State | Detection | Shown |
|---|---|---|
| **Own, offline / local / no backend** | `profileStatus() !== 'ready'` | Full own profile from the save. Bio from the mirror, read-only. Visiting unavailable. The usual offline pill. |
| **Own, no online name** | no identity name | As above plus the "Pick an online name to share your profile" strip |
| **Own, server lacks the profile SQL** | `profileStatus() === 'needs_update'` (also whenever social is `needs_update`) | Own profile works. A note: "Other Senseis will see your profile after the next server update." Bio and Privacy are read-only. |
| **Own, ready** | | Everything. Sync on open. Bio hidden → "Your bio is hidden while it's checked." Locked → "You can change your bio again on <date>." Muted → "You can't change your bio right now." |
| **Other, shown** | `profileWhy === null` | Full visitor view |
| **Other, private** | `'private'` (their setting excludes you, **or they blocked you**: the same answer) | Basic card (picture, name, level, clan) + "This Sensei keeps their profile private." + actions per `player_card` |
| **Other, you blocked them** | `'blocked_by_me'` | Basic card + "You blocked this Sensei." + Unblock (social's existing unblock) |
| **Other, no profile yet** | `'none'` (or a row with no card: `{ v: 1 }` only) | A basic profile from `player_card`: picture, name, tag chips, level, clan, "Sensei since", last active (when the card shows it), the visit's top-bar actions (Message · Co-op · friend · ⋯ Invite / Block / Report) + "Their girls and medals show up here after they open the game again." Private and blocked keep their own screens. |
| **Other, needs update / offline** | status | "Profiles need the latest server update" (Retry → `recheckProfile`) / the offline pill |
| **Other, gone** | `not_found` from `player_card` | "This Sensei couldn't be found." + Back |
| **Other, rate limited** | `rate_limited` ('card' 120/h) | "Too many profiles opened, try again in a bit." |
| **Snapshot values out of range** | `cleanViewedCard` | Unknown ids dropped, numbers clamped, silently. No accusation. |
| **Reduced motion** | `data-reduce-motion` / media query | The UR ring, sweep, petals and glints stand still |

---

## 2. Local save: `profile.sensei`

### 2.1 Shape (new `src/systems/senseiSave.js`)

```js
export function newSensei() {
  return {
    avatar: null,          // owned unit id; null = the secretary
    favorite: null,        // owned unit id on the left; null = the secretary
    banner: 'academy:day', // BANNERS id (§3.3)
    frame: null,           // FRAMES id (§3.2); null = Default
    title: null,           // TITLES id (§3.1); null = none
    showcase: [],          // ≤ 8 owned unit ids, in order; [] = "my 8 strongest" (never stored)
    pins: [],              // ≤ 4 PIN strings (§1.7); [] = "my best 4 medals" (never stored)
    bio: '',               // MIRROR of the server bio (server is authoritative, R13)
    lost: false,           // migrate found no block (an older build dropped it): restore once from the server
  };
}
```

### 2.2 `cleanSensei(raw, p)`

It runs in `migrateProfile` after units, progress, missions and secretary are cleaned.

| Field | Rule |
|---|---|
| `avatar`, `favorite` | a string id owned in `p.units`, else null |
| `banner` | in `BANNERS` and `bannerUnlocked(p, id)`, else `'academy:day'` |
| `frame` | in `earnedFrames(p)`, else null |
| `title` | in `earnedTitles(p)`, else null |
| `showcase` | array of owned, distinct ids, ≤ 8, order kept |
| `pins` | match `PIN_RE`, `pinEarned(p, pin)`, distinct, ≤ 4 |
| `bio` | string, trimmed, ≤ 80 code points, else `''` (not re-checked: it only mirrors the server) |
| `lost` | boolean |

### 2.3 Hooks in `src/systems/save.js` (no SAVE_VERSION bump)

```js
// createProfile()
sensei: newSensei(),
// migrateProfile(), at the end (after p.secretary / p.social)
p.sensei = isObj(raw.sensei) ? cleanSensei(raw.sensei, p) : { ...newSensei(), lost: true };
```

- **`migrationDropsData`:** cosmetic drops in `sensei` (an unowned showcase girl, an unearned pin) never count as lossy.
- **Roster v3:** its `migrateProfile` needs the same line. Whoever merges second adds it; a test covers it (§9).
- **`src/online/identity.js` `profileCard(profile)`:** `avatar: profile.sensei?.avatar || profile.secretary || 'hikari'`. `ensureOnline` already pushes avatar changes to `profiles.avatar`, so old clients show the new picture with no server change.

### 2.4 Reset, import, transfer, older tabs

| Event | Result |
|---|---|
| RESET67 / Settings reset | `createProfile()` gives an empty block. The next sync publishes an auto card (strongest girls, best medals). The bio comes back from the server through the mirror (account data, like the name). Privacy is untouched (server). |
| Import | The imported block, cleaned against the imported save, is published under this account. The bio still mirrors this account's server bio. |
| Transfer code → new device | The save brings the block. The new anonymous account has no row, so the first sync publishes the card and sends `sensei.bio` once through `setProfileBio` (checked again; refused → cleared locally). Privacy starts at the default. |
| Older cached build saves | It drops `sensei`. The new build migrates with `lost: true`. On the first ready sync, `restorePicks(p, own.card, profiles.avatar)` brings back favorite, banner, frame, title, showcase and pins from the server card (each re-cleaned against the save), then clears `lost`. |
| Old tab still open | Its `ensureOnline` pushes avatar = secretary; the avatar flips until that tab closes. Cosmetic, accepted. |
| Two new-build tabs | Social's `saveRev` guard stops the stale tab from saving. The server keeps the last card written. |
| `store.replace` (reset / import / transfer) | `store.on('change', { reason: 'replace' })` marks the profile sync dirty |

---

## 3. Unlock tables (new `src/data/profileArt.js`)

All ids match the server patterns. Display text and art come **only** from these tables, so the viewer never shows a string from the network except the name and the bio.

### 3.1 Titles: `TITLES` (id → name)

| Id | Name | Earned when (`earnedTitles(p)`) |
|---|---|---|
| `fp_ashwing` | Ashwing Slayer | `missions.counters['fpm:blossom:matriarch']` or `['fpm:tempest:matriarch']`, or legacy `progress.freeplay.titles` contains 'Ashwing Slayer' |
| `fp_crimson` | Crimson Slayer | `fpm:crimson:matriarch`, or the legacy string |
| `<achievement id>` | the achievement's name (e.g. `a_gold_40` → Valedictorian, `a_sakura_10` → Sakura Sentinel, `a_bestiary_50` → Monster Scholar) | `missions.achievements[id] === true` and not `a_pulls_*` |

- Reading `fpm:` keys means an older tab that dropped `progress.freeplay` can't wipe titles (research §0.7).
- Titles are stored and published as **ids, never strings**.

### 3.2 Frames: `FRAMES`

| Id | Name | Earned when (`earnedFrames(p)`) | Art | Ships |
|---|---|---|---|---|
| (null) | Default | always | white ring | M1 |
| `ur` | UR Rainbow | owns any girl whose `displayRarity` is UR | reuses `ur-ring` | M1 |
| `eclipse` | Eclipse | any `fpm:<tier>:wyrm`, or legacy `progress.freeplay.frames` contains 'eclipse' | placeholder SVG (mock) → final art M3 | M1 |
| `sakura` | Sakura | Sakura medal on 10 campaign stages (computed from progress, not the claim) | needed | M3 |
| `laurel` | Laurel | Gold on all 40 campaign stages | needed | M3 |
| `rosette` | Rosette | all 20 ribbons on any stage | needed | with codex-modes |

- Frames show around the picture on the profile screen only in v1 (frame in chat = Later).
- The equipped frame's name shows under the picture so players know it can be earned.

### 3.3 Banners: `BANNERS`

| Ids | Art | Unlock |
|---|---|---|
| `academy:day`, `academy:sunset`, `academy:night` | `academy.webp` + the lobby tint overlays (`TINTS`) | free |
| `theme:sakura\|lake\|shrine\|mountain\|marsh\|foundry\|festival\|volcano` | `themeBackdropSVG(theme)` (1100×400) | clear every stage of the chapter with that theme, on any difficulty |
| `scene:hikari\|aoi\|sango` (every girl in `SCENES`) | `public/art/lobby/<id>.webp` | own her |

- The 3 extra theme skies (snow, night, arena) are Later.
- The picker shows locked banners with their reason ("Clear Chapter 3").
- Thumbnails: the lobby `thumbs/` webps, and the theme SVG rendered small.

### 3.4 Quick lines: `QUICK_LINES`

"Looking for co-op buddies!", "Collecting every ribbon ✦", "Say hi in clan chat!", "Nightmare grinder", "New Sensei, be nice ♥", "Freeplay forever".

All six pass `bioError` (checked), and a test keeps it so.

---

## 4. Stats and trophies (new `src/systems/profileTrophies.js`, pure)

| Function | Returns |
|---|---|
| `earnedTitles(p)` / `earnedFrames(p)` | id arrays (§3) |
| `bannerUnlocked(p, id)` | boolean |
| `medalTally(p)` | `[easy, normal, hard, nightmare]` counts over `STAGES` (`stageMedals`) |
| `ribbonTally(p)` | `[reverse, rush, ironclad, frugal, laststand]` counts, or **null until codex-modes is merged** (§5.3) |
| `pinOptions(p)` | earned pins, best first, by kind |
| `pinEarned(p, pin)` | medal: `progress.stages[s][d] === true`. Ribbon: `modeRibbons(p, s)['d:m']` (codex). Perfect: `ribbonCount(p, s).have === 20` (codex). Achievement: claimed and not `a_pulls_*`. Before codex-modes, ribbon and perfect pins are never earned. |
| `autoPins(p)` | best 4 medal pins |
| `autoShowcase(p)` | top 8 owned by `unitPower`, ties by rarity then id |
| `freeplayByTier(p)` | `{ [tier]: { w, s, c? } }`: the max over stages of `coopBestWave[tier]` and `freeplayBest[tier]` |
| `collectionStats(p)` | `{ u: owned units, s: stages cleared (any difficulty, all 59), b: bestiaryPercent(p), k: stats.kills }` |

---

## 5. The public card (format v1)

### 5.1 Shape

```jsonc
{
  "v": 1,
  "fav": "luna",                       // favorite girl | null
  "ban": "theme:festival",             // banner id | null
  "frm": "eclipse",                    // frame id | null
  "ttl": "fp_crimson",                 // title id | null
  "units": [                           // ≤ 8, the owner's order (auto = 8 strongest)
    { "id": "luna", "lv": 60, "bt": 5, "aw": 5,
      "p": 4,                          // Potential level (optional; once Potential ships)
      "sk": "luna_sentinel",           // outfit (optional; once roster v3 ships)
      "g": [                           // equipped gear, slots in order charm, ribbon, shoes (optional)
        { "s": "charm", "r": "legendary", "l": 10,
          "m": ["atkPct", 0.2420],                       // main [stat, value]
          "x": [["critChance", 0.056, 2], ["critDmg", 0.142, 1], ["ratePct", 0.041], ["armorPen", 2]] } ] } ],
  "med": { "a": [59, 59, 41, 12],      // medals per difficulty over all 59 stages
           "r": [48, 40, 22, 31, 9],   // ribbons per mode (only once codex-modes ships)
           "pins": ["8-5:nightmare", "3-2:perfect", "7-3:nightmare:laststand", "ach:a_gold_40"] },
  "fp": { "blossom": { "w": 212, "s": "5-4" }, "tempest": { "w": 168, "s": "8-1" }, "crimson": { "w": 121, "s": "7-3", "c": 1 } },
  "st": { "u": 15, "s": 59, "b": 72, "k": 25310 }
}
```

**Never published** (`buildCard` builds this whitelist; it is not a copy of the save):
- gear `uid`, `locked`, `name`, `equippedBy`;
- `exp`, `obtainedAt`, bond;
- currencies, `pulls`, `gemsEarned`, inventory, mail, codes, friend code, settings;
- clan (`player_card` carries it with the dev-clan rule);
- any timestamp.

### 5.2 `buildCard(profile)` (pure, `src/online/profileCard.js`)

- **`units`:** `sensei.showcase` or `autoShowcase(p)`.
  - Gear comes from `p.gear[st.gear[slot]]`.
  - Values are rounded to 4 decimals.
  - `x[i][2]` = `subs[i].upgrades` when > 0.
  - `p` = `potentialLevel(st)` when Potential exists; `sk` = `st.skin` when skins exist.
- **`fav`:** `sensei.favorite || secretary`. **`ban`, `frm`, `ttl`:** from `sensei`.
- **`med.a`:** `medalTally(p)`. **`med.r`:** `ribbonTally(p)`, left out when null. **`med.pins`:** `sensei.pins` or `autoPins(p)`.
- **`fp`:** `freeplayByTier(p)`, left out when empty. **`st`:** `collectionStats(p)`.
- **Hash:** `cardHash(card)` = FNV-1a 32-bit of the JSON in base 36, sent with the card.
- **Budget:** `JSON.stringify(card).length ≤ 6000` (client), and `octet_length(card::text) ≤ 8192` (server).
  - Measured heaviest v1 card (8 girls × 3 legendary +10 pieces × 4 substats with upgrades, skins, Potential, 4 pins, 3 tiers, 5 ribbon counts, stats): **4,587 B** JSON, **5,227 B** jsonb text, **973 B** stored.
  - About 10 MB per 10,000 players.

### 5.3 Ribbons before and after codex-modes

- Live `migrateProfile` drops `progress.stages[id].modes` today, so ribbons cannot exist until codex-modes merges.
- `ribbonTally` returns null, ribbon and perfect pins are never earned, the UI hides the Ribbons half and the card leaves out `med.r`.
- **The codex-modes merge** (whichever branch merges second):
  - replaces `ribbonTally` and `pinEarned`'s two branches with `modeRibbons` / `ribbonCount` from `src/systems/unlocks.js`;
  - adds the Rosette frame.
- **No SQL change:** the server already accepts `med.r` (1–8 counts) and the ribbon and perfect pin grammar.

### 5.4 Viewer trust boundary: `cleanViewedCard(card)`

**Rule: never show a string the client can't turn into its own text or art.**

- **Ids:** unknown `fav` → `hikari`. Unknown `ban` → `academy:day`. Unknown `frm` / `ttl` → none.
- **Units:** unknown unit ids are dropped; an unknown `sk` is dropped.
- **Clamps:**
  - `bt` 0–5, `aw` 0–5, `lv` 1–`levelCap({ breakthrough: bt })`, `p` 1–6.
- **Gear:**
  - unknown slot or rarity → piece dropped;
  - the main stat must be in `GEAR_MAIN_STATS[slot]`;
  - substats must be known, distinct, not the main stat, and at most `GEAR_SUBSTATS_BY_RARITY[r]`;
  - values clamped to `mainStatRange` / `substatRange` at max level and upgrades;
  - `l` 0–10, `ups` 0–`floor(l / SUB_GROWTH_EVERY)` (3; export the constant from `gear.js`).
- **Counts:**
  - `med.a[i]` ≤ 59, `med.r[i]` ≤ 160;
  - pins re-checked against the stage and achievement tables (unknown → dropped);
  - `fp` tiers in `FREEPLAY_TIERS` and stages in `STAGE_MAP`;
  - `st.u` ≤ `UNITS.length`, `st.s` ≤ 59, `st.b` ≤ 100.
- A build inflated with dev codes still shows, inflated. That is cosmetic and accepted: nothing in the game reads cards (rewards, ranks, co-op never do).

### 5.5 Snapshot → mini-profile (for the sheet)

```js
export function snapshotToMiniProfile(u) {           // u = one cleaned card.units entry
  const gear = {};
  const slots = { charm: null, ribbon: null, shoes: null };
  for (const g of u.g || []) {
    const uid = `snap:${u.id}:${g.s}`;
    slots[g.s] = uid;
    gear[uid] = { uid, slot: g.s, rarity: g.r, level: g.l, main: { stat: g.m[0], value: g.m[1] },
      subs: (g.x || []).map(([stat, value, ups = 0]) => ({ stat, value, upgrades: ups })), locked: false, equippedBy: u.id, name: '' };
  }
  return { units: { [u.id]: { level: u.lv, exp: 0, breakthrough: u.bt, awaken: u.aw, dupes: (u.p || 1) - 1,
    skin: u.sk || null, gear: slots, favorite: false, obtainedAt: 0 } }, gear };
}
```

- `unitBattleStats`, `unitPower`, `levelCap`, `displayRarity` and `gearStatTotals` already accept this shape.
- `loadoutToMiniProfile(stats)` (co-op chips) builds the same with no gear.

---

## 6. Server: `supabase/migrations/20261016000000_profile.sql`

**Full text:** `docs/specs/profile/20261016000000_profile.sql` (amended to v1, about 480 lines, idempotent). It is copied into the repo as is.

### 6.1 Order guard and header

- The file refuses to run unless `social_version()` and `reports` exist ("Run 20261013000000_social.sql first…"). The whole paste is one transaction, so a refused paste creates nothing.
- The header lists what it creates, the limits and the paste order.

### 6.2 Table

```sql
create table if not exists public.profile_cards (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '',
  visibility text not null default 'everyone' check (visibility in ('everyone', 'friends_clan', 'nobody')),
  card jsonb not null default '{"v": 1}'::jsonb,
  card_hash text not null default '',
  bio_changed_at timestamptz, bio_hidden boolean not null default false,
  bio_strikes int not null default 0, bio_strike_at timestamptz, bio_locked_until timestamptz,
  updated_at timestamptz not null default now(), created_at timestamptz not null default now());
alter table public.profile_cards add column if not exists bio_hidden_text text; -- the text reports hid
alter table public.profile_cards enable row level security;   -- no policies: functions only
revoke all on public.profile_cards from anon, authenticated;
```

- There is deliberately **no** check constraint on `bio` or `card`. A NOT VALID check still runs on every UPDATE of an old row, so a stricter rule later would lock players out (social's lesson with names).
- The functions check what changes, and `profile_view` re-checks the bio on every read.

### 6.3 Entry points

All are SECURITY DEFINER, identify the caller with `social_me()`, and are granted to `authenticated` only.

| Function | Does | Limit |
|---|---|---|
| `profile_version() → 1` | deploy probe | — |
| `profile_view(p_user uuid) → json` | `player_card(p_user)` + `since` ('YYYY-MM') + `profileWhy` + `profile: { bio, card }` when shown + `own` (your own profile only) | `card` 120/h (through `player_card`) |
| `my_profile_card() → json` | `{ exists, bio, visibility, card, hash, bioHidden, bioLockedUntil, muted, updatedAt }` | — |
| `set_profile_card(p_card jsonb, p_hash text) → { hash }` | `valid_profile_card`, then upsert | `profile` 1/s, 60/h |
| `set_profile_bio(p_bio text) → own json` | Trims. `''` is always allowed. Otherwise ≤ 80 chars, `valid_dm_body`, `profile_contact_free`; refused while muted or locked. The same text again is no change (a hidden bio stays hidden); new text shows again. The text reports hid stays hidden whenever it is set again, also after clearing the bio (`bio_hidden_text`). | `bio` 10/day |
| `set_profile_visibility(p_value text)` | `everyone` / `friends_clan` / `nobody` | `settings` 20/h |

**`profileWhy` (checked in this order):**

| Situation | `profileWhy` | `profile` |
|---|---|---|
| Own, row exists | null | `{ bio, card }` + `own` |
| Own, no row | `none` | null + `own.exists = false` |
| You blocked them | `blocked_by_me` | null |
| They have no row | `none` | null |
| They blocked you, or their visibility excludes you | `private` (identical) | null |
| Otherwise | null | `{ bio, card }` |

- **"Friends & clan":** `social_are_friends` or `social_clanmates(owner, viewer, 72)`. These are the same people "Friends & clan" means for DMs.
- **The bio reads as `''` for others** while hidden, under an owner mute, or when it fails today's `profile_bio_ok`.
- **Never sent to others:** `updated_at`, their visibility value, moderation state.
- **Known leak:** comparing answers from a second account can reveal a block. This is the same unavoidable leak as social's.

### 6.4 `valid_profile_card(p jsonb)`: what the server accepts

| Part | Rule |
|---|---|
| Whole | object, `octet_length(p::text) ≤ 8192`, keys ⊆ `v fav ban frm ttl units med fp st`, `v = 1` |
| `fav`, `frm`, `ttl` | absent, null or `^[a-z][a-z0-9_]{0,23}$` |
| `ban` | absent, null or `^[a-z]{1,12}:[a-z0-9_-]{1,24}$` |
| `units` | ≤ 8 objects, keys ⊆ `id lv bt aw p sk g`. Distinct ids by the id pattern. `lv` 1–999, `bt` 0–9, `aw` 0–9, `p` 1–9 (whole numbers). `sk` `^[a-z][a-z0-9_]{0,31}$`. |
| `g` | ≤ 4 pieces, keys ⊆ `s r l m x`, distinct `s` (`^[a-z]{1,12}$`), `r` `^[a-zA-Z]{1,12}$`, `l` 0–99. `m` = `[stat, 0–100000]`. `x` ≤ 6 × `[stat, value]` or `[stat, value, 0–9]`. |
| `med` | keys ⊆ `a r pins`. `a` = exactly 4 counts 0–9999. `r` = 1–8 counts 0–9999. `pins` ≤ 4 distinct, matching `^([a-z0-9-]{1,24}:((easy\|normal\|hard\|nightmare)(:[a-z]{1,16})?\|perfect)\|ach:[a-z][a-z0-9_]{0,31})$` |
| `fp` | null or an object of ≤ 4 tiers (`^[a-z]{1,16}$`) → `{ w 0–999999, s ^[a-z0-9-]{1,24}$, c 0–1 }` |
| `st` | keys ⊆ `u s b k`: `u`, `s` 0–999; `b` 0–100; `k` 0–2,000,000,000 (whole numbers) |

These ceilings sit a little above today's game, so new girls, outfits, titles, banners, modes and stages need no new paste.

### 6.5 Reports, auto-hide, lock, mutes

- **Reporting** from a profile uses the existing `report_player(target, reason, note, 'profile', null)`. `report_player` and the social file are unchanged.
- **Trigger `reports_profile_evidence`** (BEFORE INSERT, or UPDATE OF evidence on `reports`):
  - adds `evidence.profile = { bio, bioChangedAt, bioHidden, visibility, fav, ban, frm, ttl, units: [ids], pins, earlier: [{ bio, at }] }`;
  - `earlier` keeps the newest 3 previously reported bios, once each, so editing after a report never erases it;
  - social's evidence is untouched.
- **Trigger `reports_profile_hide`** (AFTER INSERT, or UPDATE OF context, updated_at) → `profile_maybe_hide`:
  - **Counting:** distinct reporters with an open `'profile'` report filed or repeated since the bio's last change, whose accounts are ≥ 24 h old.
  - **3 or more** → `bio_hidden` + one strike; `bio_hidden_text` remembers the text, so setting it again (also after clearing the bio, or another bio in between) keeps it hidden, with its change time unchanged.
  - **A second strike within 30 days** → bio edits locked for 7 days (clearing still allowed).
- **Known limitation:** reports from the player card (chat, roster) also use context `'profile'`, so they count too. Adding a `'bio'` context would mean re-creating `report_player`; not worth it.
- **Mutes:**
  - any social mute refuses new bio text;
  - an **owner** mute also hides the bio from everyone else at read time (the owner's lever, no new SQL).
- **Owner moderation queries** (copied into `docs/ONLINE.md` → Moderation): Design B §4.5 has the full text:
  - hidden bios and bios with open reports;
  - the reported bio and the earlier ones;
  - remove a bio and lock it 30 days;
  - un-hide a bio;
  - bios today's rules would refuse.
- **End of file:**
  - a revoke-by-name loop over every function the file creates (all overloads);
  - grants on the 6 entry points;
  - `notify pgrst, 'reload schema'`.

### 6.6 Amendments to Design B's sketch (done, re-proven)

| Change | Where |
|---|---|
| Card keys: `ach` removed, `st` added | `valid_profile_card` |
| `med`: `c` and `rib` replaced by `a` (4) and `r` (1–8); pins ≤ 4 with the medal / ribbon / perfect / `ach:` grammar | `valid_profile_card`, new helper `profile_counts_ok` |
| Substats may carry `ups` (0–9) | `profile_stat_ok(p, p_ups)` (the old 1-argument overload is dropped first) |
| `fp` per tier | `valid_profile_card` |
| `since` → `to_char(created_at, 'YYYY-MM')` | `profile_view` |
| Evidence no longer copies `ach` | `profile_evidence` |
| JS mirror updated (`PINS_MAX 4`, `PIN_RE`, `validCard`) | `profileRules.sketch.js` |

**Proof** (PGlite against the real online and social files from `/home/user/wt-social`, run with `cd /home/user/wt-social && node docs/specs/profile/probe.mjs`):
- `probe.mjs`: **136 checks, all pass.** They cover the order guard, ACLs, the heaviest card plus 35 refused shapes, bio rules, visibility, blocks, mutes, evidence, auto-hide, the lock, rate limits and re-paste orders.
- `parity.mjs`: **57 bio strings and 29 card shapes** agree between the JS mirror and the SQL.

### 6.7 Deploy (owner runbook text)

1. `20261008000000_online.sql`: live already.
2. `20261013000000_social.sql`: when social ships. Check: `select public.social_version();` → 1.
3. `20261016000000_profile.sql`: when M2 ships, any time after step 2. Check: `select public.profile_version();` → 1.

- **The frontend ships first.** Until step 3, profiles show "needs the latest server update" and nothing else changes.
- **Re-pasting `online.sql`:** paste social, then profile, again right after it (online revokes every function grant).
- **Re-pasting social:** nothing else needed (the triggers and grants survive).
- **Re-pasting profile:** harmless.
- **GitHub integration:** files apply in filename order (…16… after …13…), so the guard never fires.

---

## 7. Client code

### 7.1 Pure rules: `src/online/profileRules.js` (mirrors the SQL, no game imports)

**Constants** (a lint test compares them with the SQL):
- `BIO_MAX 80`, `SHOWCASE_MAX 8`, `PINS_MAX 4`, `GEAR_MAX 4`, `SUBS_MAX 6`, `FP_TIERS_MAX 4`, `RIBBON_MODES_MAX 8`
- `CARD_TEXT_MAX 8192`, `CARD_JSON_BUDGET 6000`
- `PROFILE_VISIBILITY` (default `'everyone'`)
- `BIO_HIDE { reporters 3, minAccountHours 24, strikeWindowDays 30, lockStrikes 2, lockDays 7 }`
- `ID_RE`, `SKIN_RE`, `BANNER_RE`, `PIN_RE`
- `CONTACT_PATTERNS`, `CONTACT_APPS`, `CONTACT_WORDS`

**Functions:** `profileFlat`, `contactFree`, `bioError(text)` (player-facing message or null), `validCard`, `cardHash`. They reuse `MESSAGE_INVISIBLE`, `VISIBLE_CHAR`, `COMBINING_RUN`, `MARK_SET` and `LOOKALIKE_*` from `textRules.js`.

**Starting point:** `profileRules.sketch.js` (in `docs/specs/profile/`).

### 7.2 Game-aware card code: `src/online/profileCard.js`

`buildCard(profile)`, `cleanViewedCard(card)`, `snapshotToMiniProfile(u)`, `loadoutToMiniProfile(stats)` and `restorePicks(profile, card, avatar)`.

### 7.3 Backend, adapters, limits, sync

- **`src/online/backend.js`:**
  - `PROFILE_METHODS = ['profileView', 'myProfileCard', 'setProfileCard', 'setProfileBio', 'setProfileVisibility']`
  - limiter mapping `{ profileView: 'card', setProfileCard: 'profile', setProfileBio: 'bio', setProfileVisibility: 'settings' }`
  - `api.profileStatus()` returns `'ready' | 'needs_update' | 'offline'`. It is `needs_update` whenever `socialStatus()` is; otherwise it probes `profile_version` (cached like `socialStatus`).
  - `api.recheckProfile()`
- **`src/online/adapters/supabase.js`:** the six methods through `srpc`, which already maps a missing function or a lost grant to `needs_update`. Design B §5.3 has the code.
- **`src/online/adapters/localProfile.js`** (new, mixed into `createLocalDb()` like `localSocial.js`):
  - the same rules over `state.profile.cards[uid]`, reusing social's `isBlocked`, `areFriends`, `clanmates`, `muted`, `ownerMuted`;
  - `localSocial.report` gains an `afterReport` hook for evidence and auto-hide;
  - `?profile=0` simulates the server without the profile SQL; `?social=0` implies it.
- **`src/online/limits.js` RULES:**
  - `profile: { gapMs: 1000, max: 60, windowMs: HOUR, label: 'profile update' }`
  - `bio: { gapMs: 0, max: 10, windowMs: DAY, label: 'bio change' }`, with `'bio'` added to `ROLLING_DAILY`
- **`src/online/profileSync.js`:** `syncProfile({ reason })` as in Design B §5.5:
  1. the bio mirror (the server wins; a new account gets the save's bio once);
  2. `lost` → `restorePicks` once;
  3. `buildCard` → `cardHash` → publish only when the hash differs from `own.hash`.

  | Trigger | Reason | Throttle |
  |---|---|---|
  | End of `ensureOnline()` (`src/ui/online/common.js`); the boot reaches it for every player with an account (a stored name, or a kept sign-in after "Not now": `src/main.js` → `startSocialHub`), so no one has to open Profile | `online` | 10 min unless dirty |
  | Social hub refresh tick | `tick` | 10 min |
  | Opening your own profile | `online` | 10 min unless dirty |
  | Edit Showcase / Edit Profile save | `edit` | none (the server's 1/s still applies) |
  | `store.on('change')` with `reason === 'replace'` | marks dirty | next trigger |

  Errors are quiet, except in the editor.

### 7.4 Unit Sheet changes (train-a files)

```js
// src/ui/unitSheet.js
openUnitSheet(unitId, {
  tab = 'info',            // + 'build'
  allowFullPage = true,
  origin = null,
  profile = null,          // NEW: mini-profile { units, gear }; null = store.profile
  owner = null,            // NEW: { name, avatar } → "<name>'s build" chip; forces allowFullPage = false; never "Recruit"
  compare = false,         // NEW (M3): your own values under each Growth / battle stat
})
```

- Every `store.profile` read in the sheet becomes `const prof = profile || store.profile`. There are 6 reads, including `displayRarity`, `levelCap`, `unitPower` and the owned state.
- **`src/ui/screens/student.js`:** `infoTab(unit, { profile, label = 'yours' })` and `statsTable(unit, battle, { owned, label })` stop reading the store.
- **`src/ui/components.js`:** `unitCard(unitId, { …, profile })`.
- **New `src/ui/unitBuild.js`:** `buildTab(unit, prof, { snapshotOwner, compareWith })` (§1.6).
- **`openSheetFor`** passes the options through unchanged. Global holds elsewhere keep today's behaviour, except that the Build tab now appears for owned girls.
- **Co-op room fix** (`src/ui/screens/coop.js`): the ally's girl chips get `data-hold-info="off"` and their own gesture → `openUnitSheet(id, { tab: 'build', profile: loadoutToMiniProfile(ally.stats[id]), owner: { name: ally.name, avatar: ally.avatar }, allowFullPage: false })`.

### 7.5 Profile UI files

| File | What |
|---|---|
| `src/ui/screens/profile.js` | route screen: own and visitor, every state in §1.11 |
| `src/ui/profile/showcaseEditor.js` | Edit Showcase sheet |
| `src/ui/profile/editProfile.js` | Edit Profile sheet (Bio, Picture, Banner, Title, Favorite, Privacy, Preview) |
| `src/ui/profile/pinPicker.js` | pin picker; the stage popover in M3 |
| `src/ui/profile/parts.js` | banner, avatar + frame, title ribbon, plaques, freeplay rows (shared by the own view, the visitor view and Preview) |
| `src/ui/styles/profile.css` | `.pf-*` styles |
| `src/art/profileArt.js` | Eclipse frame and rosette SVGs (placeholders from `mock/`), frame rings |
| `src/ui/online/playerActions.js` | action rules factored out of `playerCard.js` |

Glyphs (edit, hold, chat, friend, more) come from `mock/js/glyphs.js` and go into `uiIcon`.

---

## 8. Safety rules mirrored client ↔ server

| Rule | Client | Server | Test |
|---|---|---|---|
| Bio 0–80 characters after trim | `bioError` | `set_profile_bio`, `profile_bio_ok` | parity |
| DM text rules: no invisible, bidi or control characters, no stacked marks, needs a visible character | `bioError` via `textRules.js` | `valid_dm_body` | parity |
| Normalising: NFKD, marks, variation selectors, joiners dropped; look-alikes → Latin; odd dots → `.`; lower case | `profileFlat` | `profile_flat` | parity |
| No links, `www`, TLDs, "dot com", `/paths`, `@`, `#1234` tags, 7+ digit runs, app names (letters only, leet digits), short app words | `contactFree` (`CONTACT_PATTERNS` / `APPS` / `WORDS`) | `profile_contact_free` (the same strings) | lint: each string appears verbatim in the SQL; parity on 57 vectors |
| Muted or locked → no new bio (clearing allowed) | editor reads `own.muted`, `bioLockedUntil` | `set_profile_bio` | schema |
| Bio re-checked on every read; hidden or owner-muted → `''` | — | `profile_view` | schema |
| Card shape, ranges and size | `validCard` + `CARD_JSON_BUDGET` | `valid_profile_card` (≤ 8 KB) | parity on 29 shapes |
| Ids only; viewer renders its own text and art | `cleanViewedCard` + `profileArt.js` tables | id patterns refuse text (`ttl: "add me on discord"`, `ach:add me…`) | profileCard test + probe |
| Private fields never published | `buildCard` whitelist | unknown keys refused | buildCard test asserts the JSON has no `uid`, `locked`, `name`, `gems`, `pulls` |
| Visibility; a block reads as "Only me"; no presence | screen states | `profile_can_see`, `profile_view` | schema matrix |
| Rate limits: profile 1/s, 60/h; bio 10/day; settings 20/h; card 120/h | `limits.js` RULES | `enforce_rate` | lint (numbers equal) |
| Report evidence keeps the bio and earlier bios | `openReportDialog(…, { context: 'profile' })` | `reports_profile_evidence` | schema |
| Auto-hide (3 reporters ≥ 24 h; second strike in 30 d → 7 d lock) | `localProfile.js` mirror | `profile_maybe_hide` | schema + local |
| Plain-text rendering of name and bio | `h()` text only, never `innerHTML` | — | e2e: `<b>x</b>` renders literally |
| No spending signals | `pinOptions` / `earnedTitles` exclude `a_pulls_*`; no gems or pulls on the card | unknown keys refused | trophies test |

**Player-facing messages:**
- `Bios are up to 80 characters.`
- `Bios can't contain invisible characters.`
- `Keep links, e-mails, @names, phone numbers and other apps out of your bio.`
- `You can't change your bio right now.`

**Known false positives** (accepted; the message says what to change): `8-5 8-4 8-3 8-2`, `oh snap`, `insta kill lol`.

**Deliberately allowed:** a friend code (`ABCD2345 add me`), stating an age.

**No profanity list** (owner's earlier decision); reports and auto-hide cover it.

---

## 9. "What else?": ranked, with v1 status

| # | Item | Status |
|---|---|---|
| 1 | **Title** under your name: freeplay titles and achievement names | v1, M1 |
| 2 | **Picture frame**: Default, UR Rainbow, Eclipse now; Sakura and Laurel with art; Rosette with ribbons | v1, M1 (M3 for art) |
| 3 | **Pinned trophy shelf** (4 medal / ribbon / perfect / achievement plaques) | v1, M1 (ribbon kinds when codex-modes lands) |
| 4 | **Freeplay Records**: best wave per tier, plus earned titles and frames | v1, M1 |
| 5 | **Collection stats**: students, stages, bestiary %, enemies defeated | v1, M1 |
| 6 | **Social buttons on a profile**: Message, Co-op, Add friend, Block / Report | v1, M2 |
| 7 | **Clan tag chip** + "Sensei since <month>" | v1, M2 |
| 8 | **Compare with mine** in the build sheet | v1, M3 |
| 9 | **Drawn portrait as your picture** in chat, clan roster, co-op and player card (replacing the procedural doll) | v1, M3 |
| 10 | Stage plaque popover (4 medals + 5×4 ribbon grid) | v1, M3 |
| 11 | Cheer stamps (6 preset reactions, 1 per profile per day, no public counter) | Later |
| 12 | ♥ favorite toggle on the student page to sort Students | Later |
| 13 | Frame shown in chat (needs a public frame field) | Later |
| 14 | Favorite girl's voice line or theme; 3D chibi on the profile; event frames and banners; co-op win counter | Later |
| — | Birthday or age, location, photo upload, links or socials, public likes or followers, gem or pull counts | **Never** (kids) |

---

## 10. Milestones

### M0: Data (no visible change; merges after train-a)

**Deliverables:**
- `src/systems/senseiSave.js`, plus the `save.js` hooks (`createProfile`, `migrateProfile`, `migrationDropsData`)
- `src/data/profileArt.js` (TITLES, FRAMES, BANNERS, QUICK_LINES)
- `src/systems/profileTrophies.js`
- `src/online/profileRules.js` and `src/online/profileCard.js`
- `identity.profileCard` avatar change
- Unit Sheet refactor: the `profile` / `owner` options, `infoTab` / `statsTable` / `unitCard` parameters, the new Build tab (`unitBuild.js`)

**Done when:**
- unit tests in §11.1 (senseiSave, profileTrophies, profileRules, profileCard, unitSheet) pass;
- `e2e/unit-info.mjs` still passes;
- vitest, build and smoke are green;
- an old save loads with `lost: true` and loses nothing.

### M1: Own profile UI (offline-capable; no server change)

**Deliverables:**
- `#/profile` route, lobby badge entry, nav parent
- Full own screen per §1.2–1.8: favorite column, banner, identity, showcase, build sheet on hold, Medals tally + pins + picker, Freeplay Records, stats
- Edit Showcase; Edit Profile (Picture, Banner, Title, Frame, Favorite; Bio and Privacy read-only "after the server update")
- Preview from the local card
- `profile.css`, reduced motion

**Done when:**
- `e2e/profile.mjs` (own part) passes at 844×390 and 1280×720;
- screenshots match the mock (`mock/shots/*-own.png`, `*-build.png`, `*-edit.png`, `*-editp.png`);
- RESET67 → an auto showcase appears, and import keeps the picks;
- vitest, build and smoke are green.

**Ships as its own version.**

### M2: Server + viewing others

**Needs:** social shipped and its SQL run.

**Deliverables:**
- `supabase/migrations/20261016000000_profile.sql`
- Backend facade, Supabase adapter, `localProfile.js`, `limits.js`, `profileSync.js` + the `ensureOnline` hook
- Bio editor live, with Quick lines; Privacy live
- `#/profile/<uuid>` with every visitor state (§1.11)
- Entry points: player card "View profile" and avatar tap, messages header, co-op room
- Visitor actions via `playerActions`; Report with context `'profile'`
- Co-op ally chip hold fix
- `socialSchema.test.js` ALLOWED list; `docs/ONLINE.md` runbook + moderation queries; CONTRACTS §13

**Done when:**
- profileSchema, localProfile, backendProfile and profileSync tests pass;
- `e2e/profile.mjs` (all 7 visitor steps) passes;
- the frontend shows "needs update" against a server without the file;
- the owner pastes the SQL and `profile_version()` returns 1.

### M3: Polish

- Compare with mine.
- Drawn-thumbnail avatars everywhere.
- Art: final Eclipse frame, Sakura and Laurel frames, per-achievement badges (at least the medal and collection ones), banner picker thumbnails.
- Stage plaque popover; phone spacing pass.
- Lazy portrait loading on the profile.
- Accessibility labels on plaques and cards.

**When codex-modes lands** (either order): ribbon tally, ribbon and perfect pins, Rosette frame and art, the perfect-stage rosette.

---

## 11. Tests

### 11.1 Unit (vitest)

| File | Covers |
|---|---|
| `tests/systems/senseiSave.test.js` | `createProfile` has the block. Migration keeps it; a missing block → `lost: true`. `cleanSensei` drops unowned, unearned and over-limit picks and `a_pulls_*` pins. Export/import round trip. `migrationDropsData` ignores cosmetic drops. Roster v3 `migrateProfile` keeps `sensei` (added by whoever merges second). |
| `tests/systems/profileTrophies.test.js` | Titles from `fpm:` keys with `progress.freeplay` dropped; legacy strings mapped. Achievement titles exclude `a_pulls_*`. Frames (UR from `displayRarity`, Eclipse from `:wyrm`). Banner unlocks. `medalTally` over 59. `ribbonTally` is null before codex. `pinEarned` for each kind. `autoPins`, `autoShowcase`, `freeplayByTier` (co-op flag, ties go to solo). `collectionStats`. |
| `tests/online/profileRules.test.js` | `bioError` messages. Every contact vector from Design B §4.3, including the false positives and the allowed cases. All `QUICK_LINES` pass. The `validCard` table (the 29 parity shapes). `cardHash` is stable. |
| `tests/online/profileCard.test.js` | `buildCard`: a fresh save → valid with auto showcase and auto pins; a maxed save → valid and ≤ 6,000 B; the JSON has no `uid`, `locked`, `name`, `gems`, `pulls`, `gemsEarned`; `med.r` absent before codex. `cleanViewedCard` drops unknown ids, clamps to the level cap, removes duplicate and illegal substats, never returns an unknown title or banner. `snapshotToMiniProfile` round trip gives the owner's `unitBattleStats`, `unitPower` and `gearStatTotals` within rounding. `restorePicks` keeps only what this save owns or has earned. |
| `tests/ui/unitSheet.test.js` (extend train-a's) | With `profile` + `owner`: the header shows the snapshot level even when `store.profile` lacks the girl; the owner chip shows; no "Open full page"; no Recruit; the Build tab shows 3 gear cards and no gear name. Without options: unchanged. |
| `tests/online/profileSchema.test.js` (PGlite; every migration file, with and without default grants) | The `probe.mjs` scenarios as vitest: lint (RLS, no grants, rate numbers = RULES, contact strings in the SQL), ACLs (6 entry points; none for anon), order guard, heaviest card + 35 refusals, bio parity, visibility matrix (friend; clanmate under and over 72 h), blocks (owner-blocked ≡ nobody; `blocked_by_me`), no presence, `since` is a month, mutes and locks, evidence + `earlier`, auto-hide + strike + lock, owner review update, rate limits, re-paste orders |
| `tests/online/localProfile.test.js` | The same scenario table against the local adapter |
| `tests/online/backendProfile.test.js` | Social `needs_update` ⇒ profile `needs_update` with no request; probe caching; limiter mapping |
| `tests/online/profileSync.test.js` (fake backend) | Bio mirror (the server wins; an owner-cleared bio clears locally); a new account → one `setProfileBio`; `lost` → `restorePicks` once; unchanged hash → no write; throttle; `replace` marks dirty |
| `tests/online/socialSchema.test.js` | `ALLOWED` += the 6 profile functions |

### 11.2 e2e: `e2e/profile.mjs`

Local adapter; pages A, B, C, D; both viewports; screenshots in `e2e/out/profile/`.

**M1 steps:**
1. A taps the lobby badge → `#/profile` shows the favorite stand, an auto showcase of 8 and the medal tally.
2. A edits the showcase: taps 8 girls, drags one, saves.
3. A holds card 1 → Build tab, 3 gear cards.
4. A sets banner, favorite, title, frame and 2 pins.
5. A opens Preview.

**M2 steps:**
1. A's bio `discord.gg/x` → inline error. Then `Hikari is the best!` saves.
2. B: clan chat → A's name → card → View profile. B sees the bio, the favorite, 8 tiles and the medal row. B holds tile 1 → the sheet shows **A's** level and gear, the owner chip, and no "Open full page".
3. A sets "Only me" → B sees the private card.
4. A sets "Everyone" and blocks B → B sees the identical private card.
5. B, C and D (accounts aged) report the bio → B no longer sees it, A sees "hidden while it's checked", and the local db dump has `evidence.profile.bio`.
6. A tab with `&profile=0` shows "needs the latest server update" on the profile; chat and DMs still deliver.
7. A runs RESET67 → after sync the showcase is auto, the bio survives, privacy is unchanged.
8. Co-op room: holding the ally's girl chip shows the ally's level, not A's.

**Also green:** `e2e/unit-info.mjs`, `e2e/social.mjs`, smoke (dev and `--prod`).

---

## 12. Owner answers (Oct 15, 2026)

The owner answered all three questions: "Default everyone! Free typing yes! Opens profile".

1. **Who sees your profile by default?** **Everyone.** Each player can switch to Friends & clan or Only me.
2. **Bio input:** **free typing with the safety filter, plus one-tap Quick lines.**
3. **Lobby "Sensei" badge:** **opens the Profile.** Achievements stay in the Missions hub, with an "All achievements →" link on the profile.

---

## 13. File index (in the repo)

All files are under `docs/specs/profile/` (this spec is `docs/specs/PROFILE.md`):

| File | What |
|---|---|
| `SPEC.md` | this spec |
| `OWNER_NOTE.md` | 10-line note for the owner |
| `20261016000000_profile.sql` | the migration, amended to v1 |
| `profileRules.sketch.js` | the JS mirror, amended to v1 |
| `probe.mjs`, `parity.mjs` | proofs: 136 checks; 57 bios + 29 cards |
| `designB-original/` | Design B's sketch files before the amendments |
| `research.md`, `design-ux.md`, `design-data.md` | inputs |
| `mock/profile.html`, `mock/css/profile.css`, `mock/js/glyphs.js`, `mock/art/`, `mock/icons/` | the mock-up and its assets |
| `mock/shots/` | screenshots (`own`, `own-scrolled`, `build`, `visit`, `visit-scrolled`, `vbuild`, `edit`, `editp` at `1280x720` and `844x390`) |
