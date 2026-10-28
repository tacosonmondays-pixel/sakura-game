> Handoff note (Oct 28): this plan was written on another machine. Paths under /home/user/wt-* and /tmp/claude-0/... (audit screenshots, scratch tools) are not in the repo; retake what you need. The home screen is OUT of scope here: the owner picked the "Quiet Home" layout (branch concept/home-b), which merges into feature/ui-v2 separately.

# UI v2 "Ink & Paper": every menu, and the Potential Board (plan)

Written Oct 27, 2026 from an audit of `origin/feature/ui-v2` at `b6e30cc3` (private worktree, now removed). This is a
plan only: nothing in the repo changed. The build starts after the home work's kit commit lands on `feature/ui-v2`.

**Owner's words this follows:** "Let's finish the ui first before the ultimates! Then go into the ultimates" and "follow
those designs for all the menus and bring the constellations [...] be efficient keep quality".

**"Those designs"** = the approved Ink & Paper look already in the repo (V1 kit: `src/ui/styles/ink.css`, `src/ui/kit.js`,
line glyphs, the ink top bar, the E3 rail, the night home being built now), the blue "after" condense boards
(`refvault/vault/Sakura Sentinels/Attachments/ui/after/*.png`, contact sheet `scratchpad/ui-v2-after-sheet.jpg`; the
HTML versions are in the repo at `docs/specs/ui-mock/`), and `docs/specs/UI_DIRECTION.md` §1-8 (number budgets, 12 px
floor, contrast, 44 px taps, one yellow).

**"The constellations"** = the per-girl Potential chart, built as the **Potential Board** (decisions 80, 107, 109,
110): academy-tech nodes linked by light paths, laid out per girl from her role, in her colours, with a star-chart feel.
It has no zodiac animal silhouettes and no sign names. It is milestone **M4**, part of the girl page work.

---

## 0. Before building: base, constants, rules

- **Base branch.** `origin/feature/ui-v2` did **not** contain `origin/main` when I audited (main is at v0.1.53 "Hubs and
  Hosts"; ui-v2 merged `feature/ui-m5` at `bd85e42` and main at v0.1.47). Another agent is merging them now. Start every
  milestone from the merged `feature/ui-v2`, after the home kit commit. What main adds on top of my shots: the M5 final
  review fixes M5-1 to M5-4 (`0324846`: hubs.css, missions.js, titans.js), the Profile tablet fix (`4836ef9`), the seven
  academy girls as hosts (`04edc25`), the lobby arrow fix and the Halloween lobby art (home, excluded). My Missions,
  Titan Trials and Profile shots are from before those fixes.
- **Display only.** The audited branch has sim id `92e2e22527cf` and `COOP_PROTOCOL` 8. No milestone here may change
  either. Check with `node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"` after every milestone.
  Nothing new is imported by `src/sim/**`. The new data files (`potentialBoards.js`, the `card` / `chips` text) are UI-only,
  like `potentialText.js` already is.
- **Reuse, do not rebuild:** the V1 kit (`ink.css` part 1, `kit.js`: `chip`, `statStrip`, `rarityTag`, `rail`, `sideRail`,
  `plateHead`, `countdownChip`, `inkBtn`, `secondaryBtn`, `lockedTile`, `offSeasonBand`, `ico`), the kit classes
  `.ui-tabbed` (folder tabs, S4), `.ui-np` (night nameplate), `.ui-girltile`, `.ui-gtile`, `.ui-hubtile`, `.ui-sheet`,
  `.ui-opt`/`.ui-seg`, `.ui-strip`, `.ui-cost`, `.ui-hit`, the host girl (E1) and the selected-tile rule (medium 3), the
  shipped item tile (`itemTile`, the slanted plate, C1), `src/ui/format.js` (`fmtNum`), and **the colour coin and gem
  icons and the motion layer that the home kit commit adds**. No milestone draws its own currency icons or its own
  entry/press animations.
- **Scope fence.** Every new rule sits under `body.ui-day` (menus) or `.ui-night-zone` (the Potential Board's night
  plate inside a day page), as ink.css does today. The battle, the title and the story scene player get no surface mode
  and nothing here reaches them.
- **Stable hooks.** Route names, tab ids and every existing `data-testid` stay. New controls get new test ids.
- **One owner per file.** Each milestone below lists the files it owns. Two builders never edit the same file at once.
  New rules go in a **new stylesheet per milestone**, imported by that milestone's own screen modules (the way
  `hubs.css` and `girl.css` are loaded today), so nobody needs `src/main.js`. Deleting dead legacy rules in a shared
  sheet (`meta-a.css`, `meta-b.css`, `hubs.css`) is done only by the lane that owns that sheet (section 4), or waits for
  M9.
- **Kit lock.** `ink.css`, `kit.js`, `components.js`, `lineGlyphs.js`, `sheet.js`, `badges.js` and `wallets.js` have one
  holder at a time. M0 takes it first; after that a milestone that needs a kit addition (M3 `girlTile()`, M5 hub tiles,
  M6 the bar) takes the lock for one short "kit commit" at its start, then releases it.
- **Review gate (HANDOFF §6).** Every milestone needs an independent reviewer's OK on its own before/after shots (zoomed
  into panel corners and edges) before it counts as done. A fix is re-reviewed by a fresh reviewer.
- **Never** write other games' or anime names in code, comments, commits or repo docs, never put players' names
  anywhere, never commit reference images. Temp scripts live in the scratchpad. `rm -rf dist` after builds.

## 1. What I audited and where it is

- Screens: 83 screenshots at **844x390** (touch, reduced motion, Central time, the `ink` seed of `e2e/uiSeed.mjs`: the
  mock-ups' mid-game save, Ruri LV 24/40 P4 in three pieces, chapters 1-3 and 4-1..4-3 cleared, 284,650 coins,
  16,570 gems, 12 tickets, two friends' co-op invites on the local test server for the online screens) in
  `scratchpad/ui-v2/menus-audit/<screen>-844x390.png`.
- Contact sheets: `menus-audit/sheets/index-all.jpg` (every shot) and `sheets/s01.jpg` ... `s12.jpg` (six per sheet,
  full size). The kit fixture: `menus-audit/kit/kit-sheet.jpg`.
- Numbers: `menus-audit/probe-844x390.json`, the repo's own probe (`e2e/probe.mjs`, `v2: true`) per shot: smallest
  text, numbers (classic and v2 with the top bar), the most numbers in one tile, ellipsis, sideways overflow, yellow
  fills, taps under 44 px with the first offenders named, rounded corners. The tools are in `menus-audit/tools/`
  (`shoot.mjs`, `shoot2.mjs`, `sheet.py`, `kit.mjs`); M0 turns them into a repo gate.
- Not shot: the battle **Results** sheet and the Backpack's gear piece sheet (the page screenshot times out on the
  container's software WebGL; `e2e/transitions.mjs` shoots Results as `result-victory`); a single Mail letter (letters
  open in place); the SSR Select Ticket and the Workbench (this save has neither item); Recruit's Rates and History
  sheets; a Clan you are in (only Find/Create); the Students filter sheet. Their targets are still planned below.

## 2. What I found

1. **The V1 kit reached every menu, but only the chrome.** The ink top bar, line icons, per-screen wallets, flat
   chamfered white panels, slanted flat buttons, the E3 rail, the badge set, the countdown chip and flat sheets are
   everywhere. Layouts did not move (V1 kept sizes and places on purpose). So the screens that were already condensed
   (the girl page from M1, the M5 hubs, Achievements, Mall, Mailroom, Happening Now, Settings) look finished, and the
   ones that were not (Stage prep, Backpack, Story, Journal, the event page, the online screens, Bestiary, Wiki) still
   carry the old layouts under the new paint.
2. **Worst readable offenders** (probe, 844x390): Journal **9.6 px**, Stage prep **9.92 px** with **3 cut-off
   difficulty rules** and 15 numbers, Messages/Friends and the player card **9.92 px**, Backpack **10.08 px** with a
   **sideways-scrolling tab rail** on every tab and 13-23 taps under 40 px, the Co-op room 10.56 px with a **17 px Join**
   and 4 yellow fills, Story archive 10.56 px with sideways overflow, Bestiary/Wiki 11.2-11.5 px, Recruit's pull result
   29 numbers and 10 controls painted over.
3. **One kit-level gap:** at `max-height: 480px` the kit's tab rail is 40 px tall (`--tab-h: 40px` in ink.css), so
   **every tab is a 40.5 px tap** (girl page, Commissions, Achievements). The v2 probe asserts 44. The girl plate's
   **P sticker is a 31x22 px button** and the "+N" trait chip 27x24. M0 fixes these once, in the kit.
4. **One yellow per screen** fails on Campaign (4 yellow fills), Achievements (5), Journal (6), the Notice (4), Co-op (4),
   the Backpack item sheet (4 Teleport buttons), Titan Trials (2) and Stage prep (2).
5. **Already at or near target:** the girl page tabs (Info 10 numbers, text 12 px, content window 350 px), Happening
   Now, Mailroom History, Settings sections, Mall offers (1-3 numbers). Their remaining work is the V3/V4/V5 look and
   44 px taps.
6. **Shared with `feature/abilities`** (it edits these on its branch): `student.js` (+48 lines), `girlView.js` (+115:
   the ⚡ ability chip and its Details sheet on the Info tab), `girlGear.js`, `gearView.js`, `gearUr.js`, `girl.css`,
   `gear-ur.css`, `tree-grid.css`, `treeGrid.js`, `treeModel.js`, `kit.js`, `components.css`, `format.js`,
   `settings.js`, `coop.js`, `battle/results.js` and `battle.css`. The owner said UI first, so the menus land first and
   the abilities lane merges them; the plan keeps edits in those files small and leaves a slot for the ⚡ chip.

## 3. Screen inventory

Columns: **Before** = probe at 844x390: smallest text px · numbers (v2, top bar counted) · taps under 44 px · notes.
**Done** = what M0-M5 (the condense milestones) and V1 already did. **Target** = Ink & Paper + the after board where
one exists + the UI_DIRECTION budgets. **Job**: S ≤ half a day, M about a day, L about two days, XL three or more.

### Roster and the girl page

| Screen (route) | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Students (`#/students`) | students, students-end | 11 · 2 · 6 · 24 rounded corners, 11 px P pill | V1 bar and segments; old `unitCard` tiles | girl tiles (`.ui-girltile`, V3) in the 5.6 frame ladder, ≤ 2 numbers a tile (LV, P), filter/sort row at 44 px, Growth sort (M4) | M | M3 |
| Menu hold sheet (hold any girl) | students-hold | 11 · 8 · 3 | M1 Glance sheet (Build, Info, Tree) | night nameplate + ink strip from the kit, 3 slot tiles, Full page ▸, 44 px taps | S | M3 |
| Girl page frame + Info (`#/student/:id?tab=info`) | girl-info, girl-aoi-info, girl-info-scroll | 12 · 10 · 7 (tabs 40.5, P sticker 31x22, "+4" 27x24) | M1 condense (art band, plate, rail, strip, matchup, Potential row), V1 look | folder tabs on the content panel (S4), her name on the night nameplate (`.ui-np`), 44 px hits, a fixed slot for the ⚡ ability chip; the Potential row becomes the Board panel (M4) | M | M3 |
| Level tab | girl-level, girl-level-manual | 12 · 12 (17 with Manual) · 8 | M1 Manual toggle, Ascension gate card | folder tabs; steppers and material chips at 44 px; ≤ 12 numbers with Manual closed | S | M3 |
| Awaken tab | girl-awaken | 12 · 13 · 8 | M1 next-star view | ≤ 12 numbers, material chips 44 px | S | M3 |
| Gear tab | girl-gear | 12 · 8 · 6 | M1b slot tiles + gear strip | slot tiles drawn with M2's gear tile | S | M3 |
| Gear piece sheet + picker | girl-gear-sheet | 12 · 13 · 8 · 1 yellow | M1b, V1 medium 3 | kit sheet with the bleed ink head; the picker is M2's gear grid; ≤ 12 numbers | M | M3 |
| Gear totals sheet | girl-gear-totals | 12 · 19 · 1 | Details sheet | a Details sheet (no number budget): type, contrast, 44 px | S | M3 |
| Tree tab (+ hero track) | girl-tree, girl-tree-hero | 12 · 6 / 10 · 21 (cells, tabs) | M1a 3x5 grid | folder tabs; cell hits to 44 px by padding only. The grid's own look (`tree-grid.css`, `treeGrid.js`) is shared with the battle tree and waits for the ultimates merge | S | M3 |
| Outfit sheet | girl-outfit | 12 · 11 · 2 | V1 sheet | kit sheet, outfit tiles as girl tiles, 44 px | S | M3 |
| Potential sheet (today) → **Potential Board** | girl-potential | 12 · **41** · 1 · 1 clipped | P3 six-node track + a text sheet | the Board (section 6) | L | **M4** |
| Formation (`#/formation`) | formation, formation-pick | 12 / 11 · 4 / 2 · 4 (37 px) / 2 · 1 yellow | V1, medium 3 pick marks | the squad as a grid of girl tiles (V3), counter needs as kit rows, the pick grid = girl tiles, one yellow (Go to 4-4) | M | M3 |

### Campaign, stage prep and results

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Campaign (`#/campaign?chapter=N`) | campaign, campaign-ch1 | 12 · 7 · 5 · **sideways overflow** (chapter rail) · **4 yellow fills** · 28 rounded | M5b cleaner cards, V1 bar | chapter rail that fits (or a chapter sheet), stage cards as kit tiles (tier on a plate, medals, NEXT sticker, locked chip), ≤ 2 numbers a card, one yellow | M | M1 |
| Stage prep, not cleared (`#/stage/4-4`) | stage-prep-new (+scroll) | **9.92** · 15 · 0 · **3 cut rules** · 2 yellow fills | V1 panels and buttons only | the after board (UI_DIRECTION 6.3): no scroll; map band with the stage strip WAVES · ♥ · START; 2x2 difficulty with unearned rewards; one rule line; Counters, Drops and Mode rows opening sheets; Start · Normal next to the choice | L | M1 |
| Stage prep, cleared (`#/stage/2-3`) | stage-prep-cleared | 9.92 · 13 · 3 painted over | same | same, with Sweep ×1 / ×10 as secondary | (in above) | M1 |
| Stage prep sheets (counters, drops, mode + Freeplay, "i") | new | – | today inline | kit sheets | (in above) | M1 |
| Stage prep, event stage and Continue | not shot | – | events line, battle-save Continue | keep both working in the new layout | (in above) | M1 |
| Results (Victory / Defeat sheet) | not shot | – | battle files | night Ink & Paper after the ultimates merge (`battle/results.js` and `battle.css` change on `feature/abilities`) | M | post-ultimates |

### Backpack and items

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Backpack: All, Enhancement, Awakening, Tickets, Tokens (`#/backpack?tab=`) | backpack-all, -enhancement, -awakening, -tickets, -tokens | **10.08**-11.52 · 7-9 · 12-14 · **sideways overflow** on every tab | V1 bar and panels; shipped item tiles | one-word rail ALL · ENHANCE · AWAKEN · GEAR · TICKETS · TOKENS that fits at 844, red dots not counts, Filter and Sort buttons, item grid | M | M2 |
| Backpack: Equipment | backpack-equipment, -end | 11.2 · 9 (22 at the end) · 22 · overflow | V1 | the after board (6.4): toolbar Supplies ▸ · Filter · Sort · Salvage; gear grid of 96 px tiles (+level, main stat icon, wearer face), 14 in view; ≤ 32 numbers for 30 pieces | L | M2 |
| Salvage mode | backpack-salvage | 11.2 · 10 · 23 (17 px) | V1 medium 3 marks | kit salvage bar, danger button, 44 px picks | S | M2 |
| Item sheet (`showItemInfo`) | backpack-item-sheet | 10.08 · 17 · 3 · **4 yellow** (Teleport) | V1 sheet | kit sheet; "Where to get" rows with secondary Go buttons, one yellow at most | S | M2 |
| Gear piece sheet from the Backpack, hold-to-compare | not shot | – | M1b sheet (`girlGear.js`) | the M3 sheet with a compare view; the Backpack only opens it | S | M3 |
| Supplies sheet, Filter sheet | new | – | inline today (boxes, dice, 4 dropdowns) | kit sheets | (in Equipment) | M2 |
| SSR Select Ticket, Workbench (craft room) | not shot | – | first-impressions modals | kit sheets with girl tiles / item tiles | S | M2 |

### Hubs (V4: hub cards and hosts)

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Missions hub (`#/missions`) | missions | 12 · 7 · 1 · 1 ellipsis ("2x drops this w…") · host 35% | UI v2 hub, M5b host, V1 | hub tiles `.ui-hubtile` (painted art over an ink caption band), no ellipsis | M | M5 |
| Commissions: Daily, Weekly | commissions-daily, -weekly | 12 · 3 / 2 · 16 / 15 | M5 host, plate head, V1 | 44 px tabs (M0), kit rows with one Claim each | S | M5 |
| Login calendar | commissions-login | 12 · 0 · 17 | V1 Today frame | day cards rebuilt (V4), reward tiles 44 px | S | M5 |
| Codes | commissions-codes | 12 · 1 · 6 | V1 | kit input | S | M5 |
| Achievements (+ ribbon case, category and ladder sheets, claim fanfare) | achievements, achievements-case | 12 · 2 / 3 · 8 / 10 · **5 yellow fills** | M5b condense (the after board) | one yellow (Claim all), row Claims ink, case rows 44 px | M | M5 |
| Bounty (`#/bounty`) | bounty | 12 · 2 · 3 (locked tier row 23.5 px) | V2 location select, M5b host | V4 card, tier rows 44 px | M | M5 |
| Total Assault | assault | 12 · 4 · 1 | M5b | V4 boss cards | S | M5 |
| Titan Trials (+ shelf; its result sheet is battle-side) | titans | 12 · 7 · 10 · 2 yellow · host 37% | Ascension + M5b (main has M5 fixes) | host ≤ 35%, one yellow (Fight · 1 key), target and tier chips 44 px | M | M5 |
| Tactical Challenge | challenge | 11.52 · 1 · 1 · 1 ellipsis | V2 polish | V4 card, 12 px floor | S | M5 |
| Sandbox (header and map cards) | sandbox | 11.2 · 10 · 5 | Sandbox port | map cards as kit tiles; the squad picker uses M3's girl tiles | S | M5 |
| Happening Now (In progress, Coming up, Free pulls) | happening, -soon, -free | 12 · 1 / 1 / 5 · 3 / 0 / 0 | M5c rail and host, V1 | done but for kit rows and 44 px | S | M5 |
| Mailroom (Unclaimed, History) | mail, mail-history | 12 · 2 / 1 · 9 / 0 | M5c, V1 flat letters | letters rebuilt as kit rows (V4), Claim 44 px | S | M5 |
| Multiplayer hub (+ PvP Rival Run sheet) | multiplayer | 12 · 3 · 7 (34.5 px) | M5d hub + host | V4 hub tiles, 44 px | S | M5 |

### Shops and Recruit (V5: the bar)

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Top bar wallets on every day screen | all | – | V1 per-screen wallets; token shops keep theirs in the plate head | token wallets move into the bar (`wallets.js`), drawn with the home kit's colour icons; said once (P7) | S | M6 |
| Mall: General, Gems, Recruit, Boss, Bounty, Memento (`#/mall?tab=`) | mall-* | 12 · 1-3 · 4-7 (item tiles 29 px tall, costs 40.75) · host 26% | M5c rail + host, V1 plate heads | offer cards from the kit, the wallet in the bar, 44 px | M | M6 |
| Buy sheet | mall-buy | 12 · 7 · 7 (steppers 37.75) | V1 sheet | the kit's buy sheet (in the ink-kit fixture), 44 px steppers | S | M6 |
| Recruit (`#/recruit`) + Rates, History, Spark sheets | recruit | 12 · 13 · 3 | M5c pity once, V1 | banner, one pity/spark strip, pull buttons from the kit, ≤ 12 numbers | M | M6 |
| Recruit pull result (10-pull summary) | recruit-result | 11.2 · **29** · 2 · 10 painted over | night moment screen | girl tiles in the result grid, ≤ 12 numbers outside tiles, 12 px floor; the reveal itself stays a moment | M | M6 |

### Records, story, events and the codex

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Sensei Profile (`#/profile`) | profile | 12 · 5 · 4 (fav swap 27.75) | Profile build, M5d tidy (main has the tablet fix) | kit panels, showcase as girl tiles, 44 px | M | M7a |
| Edit profile, showcase editor, pin picker, more sheet | profile-edit | 12 · 5 · 9 · **18 painted over** · 46 rounded | Profile sheets | kit side sheet with a section rail, 44 px | M | M7a |
| Story archive (`#/story`) | story | 10.56 · 7 · 4 · overflow · 2 stray pinks | story look, untouched by V1 | kit list screen: chapter rail, episode cards, host stand | M | M7a |
| Captain's Journal (`#/journal`) | journal | **9.6** · 7 · 6 (33.75) · **6 yellow fills** · 5 stray pinks | story look | list + detail on kit panels, one yellow (Claim) | M | M7a |
| Event page: Story, Operations, Missions, Exchange, Daily Gifts (`#/event/:id`) | event-* | 12 · 3-12 · 6-24 (event pill 28.5, gift tiles 34.5) | events look, V1 bar | kit tabs, operation cards as kit tiles, Daily Gifts as M5's calendar, 44 px | M | M7a |
| Notice + Patch notes (modal; also from the title) | notice | 12 · 20 · 4 · **4 yellow** · 1 ellipsis | first-impressions look | kit dialog (list left, article right), one yellow (Claim all), ≤ 12 numbers outside the version rows | M | M7b |
| Bestiary (`#/bestiary`) | bestiary | 11.52 · 10 · 4 · overflow (family rail) | meta-b look | family rail that fits, enemy tiles, the enemy strip HP · SPEED · trait (5.2) | M | M7b |
| Wiki (`#/wiki`) | wiki | 11.2 · 0 · 9 (search field 21.5 px) | meta-b look | kit input and chips, article type scale | S | M7b |

### Online and Settings

| Screen | Shot | Before | Done | Target | Job | M |
|---|---|---|---|---|---|---|
| Co-op room (`#/coop`) | coop | 10.56 · 10 · 11 (**Join 17 px**) · **4 yellow** | online look, V1 bar | kit panels, one yellow (Create / Rejoin), invite rows with secondary Join, the offline banner once | M | M8 |
| Messages: Chats, Friends, Requests, Blocked, thread (`#/messages`) | messages, messages-friends | **9.92**-10.56 · 4-5 · 4-12 · overflow | social look | kit list + thread, 44 px | M | M8 |
| Chat (`#/chat`) | chat | 10.56 · 3 · 8 | online look | kit, 44 px | S | M8 |
| Clan: Find/Create; Members, Chat, Requests, Clan Boss, Applicants, Supply Bot (`#/clan`) | clan | 10.56 · 1 · 16 · 21 rounded | online look | kit tabs and rows | M | M8 |
| Player card, report dialog, invite toast, needs-update | player-card | **9.92** · 5 · 7 · overflow · 2 yellow | social look | kit dialog, one yellow | S | M8 |
| Settings: Display, Audio, Battle, Account, About, Licences, import/export/reset (`#/settings`) | settings* | 12-13 · 0-1 · 1-8 ("i" buttons 23 px, sliders 31 px) | M5c five sections + rail, V1 | 44 px "i" and sliders, segmented choices as kit options | S | M8 |

### Everything else

| Screen | Before | Target | Job | M |
|---|---|---|---|---|
| Title (`#/title`) | 9.28 px side buttons; no surface mode (a moment screen) | keep the look; side buttons to 12 px and 44 px only | S | M9 |
| Shared modal shell, confirm dialog, toasts, beta gift / thank-you, update and stale banners, rotate prompt, loading corner | not shot one by one; V1 gave the dialog its bleed ink head | sweep against the gates | S | M9 |

## 4. Lanes (who may edit what at the same time)

| Lane | Shared files it owns | Milestones, in order |
|---|---|---|
| **Kit** | `ink.css`, `kit.js`, `components.js`, `lineGlyphs.js`, `sheet.js`, `badges.js`, `wallets.js` | M0, then short kit commits inside M3, M5, M6 |
| **A** (meta-a) | `meta-a.css`, `hubs.css`, `modes.css`, `achievements.css`, `titans.css` (hub part), `sandbox.css` | M1 → M5 → M6 → M7b (Notice) → M8 (Settings) |
| **B** (meta-b) | `meta-b.css`, `girl.css`, `unit-build.css`, `unit-info.css` (menu parts), `gearFilter.css`, `potential.css` | M2 → M3 → M4 → M7b (Bestiary, Wiki) |
| **C** (own sheets) | `profile.css`, `story.css` (archive part), `journal.css`, `events.css`, `online.css` and `social.css` (menu parts) | M7a, M8 (online part); any time after M0 |

With three builders: A runs M1, M5, M6; B runs M2, M3, M4; C runs M7a and the online half of M8; then M7b, the Settings
half of M8 and M9. Players get the stage flow and the Backpack in the first wave.

## 5. Milestones, in order of the biggest visible win

| # | Milestone | Size | Lane | Waits for | Players see |
|---|---|---|---|---|---|
| M0 | Tooling + the kit's tap gaps | S | kit | home kit commit, main merge | tabs easier to hit |
| M1 | Stage flow: Campaign + Stage prep | L | A | M0 | every battle starts from one tidy screen |
| M2 | Backpack + gear grid | L | B | M0 | the Backpack opens on the gear itself |
| M3 | Roster + girl page (V3) | L | B | M2 | girl tiles, folder tabs, the night nameplate |
| M4 | **Potential Board** | L + M text | B | M3 (pure parts earlier, lane C) | her board lights up node by node |
| M5 | Hubs + hosts (V4) | L | A | M1 | one look for every hub |
| M6 | The bar + shops + Recruit (V5) | M | A | M5, the home | wallets in the bar, Mall and Recruit match |
| M7a | Profile, Story, Journal, event page | M | C | M0 | those screens readable and matching |
| M7b | Notice, Bestiary, Wiki | M | A (Notice) / B | M6 + the home / M4 | patch notes and codex match |
| M8 | Online screens + Settings | M | C / A | M0 / M6 | co-op, messages, clan, settings readable |
| M9 | Sweep + release check | M | all | everything above | the whole menu side finished |

Every milestone's done-when includes these **standard gates** (not repeated below):
- `npm test`, `nice npx vite build` then `rm -rf dist`, `node e2e/smoke.mjs`, `node e2e/nav-back.mjs`,
  `node e2e/ink-kit.mjs`, and the sim id and `COOP_PROTOCOL` unchanged.
- `node e2e/menus.mjs --milestone <id>` (M0's gate) at **844x390, 1280x720 and 390x844**: text ≥ 12 px (≥ 13 px at
  1280x720), no sideways overflow, no ellipsis on a stat, price or rule, taps ≥ 44 px (40 px only in rows the milestone
  names as dense), at most one yellow fill, no stray pink, no rounded corner off a circle on rebuilt surfaces, nothing
  painted over a control, host ≤ 35% on hubs and ≤ 28% art band on detail screens, content window ≥ 300 px.
- Contrast: every text pair on its real background ≥ 4.5:1, numbers of 22 px and up ≥ 3:1 (`e2e/pixels.mjs`
  `contrastOnPixels`, `tools/contrast.mjs` for new token pairs).
- `node tools/cssFloor.mjs`: the new stylesheet has 0 declarations under 12 px, and every legacy count only goes down.
- Before/after pairs of every touched screen at the three sizes in the scratchpad, and an independent reviewer's OK.

### M0. Tooling and the kit's tap gaps (S)

- **Screens:** none rebuilt; every tab rail and the girl plate's stickers get 44 px taps.
- **Files:** `e2e/menus.mjs` (new: this audit as a gate; every shot from section 3 with its kind, list and a per-shot
  number limit where the after board allows more than 10, e.g. girl Equipment 12, stage prep 11), `e2e/shots/`
  (new: one shot list per milestone, so builders never edit one big file at once; `e2e/ui-shots.mjs` reads them),
  `e2e/uiSeed.mjs` (add: a 30-piece gear save for M2, one girl at each Potential state for M4: P1, P4 with Raise
  affordable, P6, a hero; a clan member for M8), `src/ui/styles/ink.css` (tab rails and folder tabs reach 44 px through
  `.ui-hit` padding at 480 px height without growing the bar; the P sticker and "+N" chip get 44 px hit areas).
- **Kit reused:** `.ui-hit`. **Waits for:** the home kit commit and the main merge on `feature/ui-v2`.
- **Done when:** `node e2e/menus.mjs` runs all audited shots and reproduces this audit's numbers as the "before" file;
  girl page and Commissions tabs measure ≥ 44 px; `e2e/girl-page.mjs`, `e2e/lists.mjs`, `e2e/pixels.mjs` pass.
- **Owner sees:** nothing new, except tabs that are easier to hit on a phone.

### M1. Stage flow: Campaign and Stage prep (L) · lane A

- **Screens:** Campaign (chapter rail, stage cards), Stage prep (new, cleared with Sweep, event stage, Continue a
  saved battle) and its four sheets (Counters, Drops, Mode with battle modes and Freeplay, "i" with the mission text
  and map rule).
- **Files:** `src/ui/screens/stage.js`, `src/ui/screens/stageModes.js`, `src/ui/screens/campaign.js`,
  `src/ui/styles/modes.css` (stage and campaign parts), new `src/ui/styles/v2-stage.css`, `e2e/shots/m1-stage.mjs`;
  dead rules in `meta-a.css` "stage prep", "campaign", "Solo freeplay (stage prep)" and "V2 polish: campaign" at the end.
  Read only: `events.css` (keep the event line's selectors), `src/systems/battleSave.js`.
- **Kit reused:** `.ui-strip` (WAVES · ♥ LIVES · START), `.ui-opt` as the 2x2 difficulty grid, `.ui-chip`, `.ui-sticker`
  (tier, FIRST, NEXT), `itemTile` in rarity frames for drops, `.ui-sheet`, the yellow Start, `secondaryBtn` (Sweep),
  `.ui-girltile` faces in the Counters sheet once M3 lands (until then today's portraits), the colour gem icon for
  difficulty rewards, the motion layer for sheets.
- **Done when:** stage prep fits one screen at 844x390 with **≤ 11 numbers** (today 15), **text ≥ 12 px** (today 9.92),
  **0 cut rules** (today 3), Start beside the difficulty choice, one yellow (today 2); Campaign has **no sideways
  scroll** (today it scrolls), ≤ 2 numbers per stage card, one yellow (today 4). E2E: `battle-save.mjs`,
  `codex-modes.mjs`, `solo-freeplay.mjs`, `halloween.mjs`, `story.mjs`, `tutorial.mjs`, `transitions.mjs`,
  `item-art.mjs`, `hubs.mjs` (campaign).
- **Leave room for:** an energy cost on Start ("Start · ⚡ 6", `docs/specs/ENERGY_RESET.md`); the energy work fills it.
- **Owner sees:** every battle now starts from one tidy screen: the map with its waves, lives and start coins, four big
  difficulty buttons, counters and drops on one line each, and Start right beside them, with no scrolling.

### M2. Backpack and the gear grid (L) · lane B

- **Screens:** Backpack (all six tabs), Equipment with Supplies, Filter and Sort sheets, salvage mode, the item sheet,
  SSR Select Ticket, Workbench. The gear piece sheet a tile opens is `girlGear.js` (M3's); M2 only opens it.
- **Files:** `src/ui/screens/backpack.js`, `src/ui/gearTile.js`, `src/ui/gearFilterBar.js`, `src/ui/styles/gearFilter.css`,
  `src/ui/selectTicket.js`, `src/ui/craftRoom.js`, new `src/ui/styles/v2-backpack.css`, `e2e/shots/m2-backpack.mjs`;
  dead rules in `meta-b.css` "Backpack" at the end. Not edited: `girlGear.js`, `gearView.js` (lane B gives them to M3;
  the abilities branch changes them), and `meta-a.css`'s Select Ticket rules (lane A; deleted in M9).
- **Kit reused:** `rail()` one-word tabs with red dots, `secondaryBtn` (Supplies, Filter, Sort), the danger button
  (Salvage), `.ui-gtile` (+level bottom right, main stat icon top right, wearer face bottom left, 5.6 ladder ready for UR
  gear), `itemTile` (shipped plate), the selected-tile rule, `.ui-sheet`, the colour coin icon.
- **Done when:** the tab rail **fits at 844 with no sideways scroll** (today it scrolls on every tab), the first screen
  of Equipment **shows gear** (14 tiles), **1 number per gear tile**, the whole Equipment tab for 30 pieces is **≤ 32
  numbers and ≤ 2.5 screens** (today 147 numbers over 7.2 screens per the Oct 20 audit), **text ≥ 12 px** (today 10.08),
  **taps ≥ 44 px** (today 13-23 under 40), the item sheet has one yellow (today 4). E2E: `gear-filter.mjs`,
  `multi-salvage.mjs`, `ur-gear.mjs`, `item-art.mjs`, `ascension.mjs`.
- **Owner sees:** the Backpack opens on the gear itself: a clean grid with each piece's level, main-stat icon and who
  wears it; boxes, dice and the four filters moved behind two buttons; tap a piece for its card.

### M3. Roster and the girl page (V3) (L) · lane B, after M2

- **Screens:** Students (grid, filter, sort, locked girls), the menu hold sheet, the girl page frame on all five tabs
  (folder tabs, night nameplate, 3D toggle, outfit sheet), Level (Manual, gate card), Awaken, Gear tab and its piece
  sheet + picker (on M2's tile), the gear totals, base stats and profile sheets, the hero track band, Formation (squad
  grid, counter needs, pick grid). The Sandbox squad picker and the Profile showcase pick up the girl tile for free.
- **Files:** kit commit first: `girlTile()` in `src/ui/components.js` (replacing `unitCard` at its call sites; same
  test ids); then `src/ui/screens/students.js`, `src/ui/screens/student.js`, `src/ui/girlFrame.js`, `src/ui/girlView.js`,
  `src/ui/girlGear.js`, `src/ui/gearView.js`, `src/ui/girlDetail.js`, `src/ui/heroTrack.js`, `src/ui/unitSheet.js`,
  `src/ui/unitBuild.js`, `src/ui/hold.js`, `src/ui/screens/formation.js`, `src/ui/styles/girl.css`, `unit-build.css`,
  `unit-info.css` (menu sheet rules only), `gear-ur.css` and `ur.css` (menu rules only; both also draw in battle and
  `gear-ur.css` changes on `feature/abilities`), new `src/ui/styles/v2-roster.css`, `e2e/shots/m3-roster.mjs`; dead rules in
  `meta-b.css` "Students", "Student detail", "Formation" at the end. **Not edited:** `tree-grid.css`, `treeGrid.js`,
  `treeModel.js` (shared with the battle tree; after the ultimates merge).
- **Coordination:** the Info tab keeps one chip row free for the ⚡ ability chip that `feature/abilities` adds in
  `girlView.js` (`abilityInfoView`); keep `student.js` / `girlView.js` / `girl.css` diffs surgical so the abilities lane's
  merge is small. Tell that lane when M3 lands.
- **Kit reused:** `.ui-girltile` (R flat, SR tinted, SSR glow, UR rainbow; LR Nightglass when the duo ships; selected =
  the pink caption bar), `.ui-tabbed` folder tabs (S4), `.ui-np` nameplate, `statStrip`, `chip` / `moreChip`,
  `starRow`, `rarityTag`, `.ui-sheet`, `.ui-ibtn`, the motion layer for tab changes and sheets.
- **Done when:** roster tiles **≤ 2 numbers**, **text ≥ 12 px** (today the P pill is 11 px), filter/sort row 44 px
  (today 40.5), no rounded corners on tiles (today 24); girl page **Info ≤ 10, Equipment ≤ 12, Tree ≤ 6, Level ≤ 12,
  Awaken ≤ 12** numbers (today Awaken 13), **tab and sticker hits ≥ 44 px** (today 40.5 and 31x22), content window ≥
  300 px, Compact and Detailed both pass; Formation one yellow, squad tiles ≤ 2 numbers, taps ≥ 44 px (today 37).
  E2E: `girl-page.mjs` (both looks), `hero.mjs`, `companions.mjs`, `returning-girls.mjs`, `stat-display.mjs`,
  `ur-awaken.mjs`, `ur-gear.mjs`, `breakthrough-refresh.mjs`, `unit-info.mjs` (menu sheet), `potential.mjs`,
  `ascension.mjs`, `gear-filter.mjs` (picker), `profile.mjs` (showcase), `story.mjs` (Students locks).
- **Owner sees:** every girl's tile, list and page in the new look: drawn tiles with clean rarity frames in Students and
  Formation, and her page with folder tabs and her name on a night plate.

### M4. The Potential Board (L, plus an M for the text) · lane B, after M3

Details in section 6. The pure modules (layout, growth, the data table, the card text) can be written in lane C during
M3; the hooks into `student.js` and `students.js` wait for M3 to land. If the owner wants the Board sooner, swap M3 and
M4: its hooks are three small call sites.

- **Owner sees:** tap her P sticker, her Growth ring or the Potential panel and her Board lights up: a glowing node map
  in her colours on a night plate. Tap any node to see what it gives; Raise ignites the next node with a burst, and P6
  ends in "Full Potential!".

### M5. Hubs and hosts (V4) (L) · lane A, after M1

- **Screens:** Missions hub, Commissions (Daily, Weekly, Login calendar, Codes), Achievements (list, ribbon case,
  category and ladder sheets, claim fanfare), Bounty, Total Assault, Titan Trials (hub and shelf), Tactical Challenge,
  Sandbox (header and map cards), Happening Now (three sections), Mailroom (Unclaimed, History, letters), Multiplayer hub
  (+ the PvP Rival Run sheet).
- **Files:** kit commit first: a `hubTile()` builder on `.ui-hubtile` in `kit.js`; then `src/ui/screens/missions.js`,
  `commissions.js`, `bounty.js`, `assault.js`, `titans.js`, `challenge.js`, `sandbox.js`, `rewards.js`, `mail.js`,
  `multiplayer.js`, `src/ui/screens/achievements/*`, `src/ui/happening.js`, `src/ui/mailroom.js`, `src/ui/hubHost.js`,
  `src/ui/hubArt.js`, `src/ui/hubStates.js`, `src/ui/hubDrops.js`, `src/ui/listScreen.js`, `hubs.css`, `achievements.css`,
  `titans.css` (hub part; its result-sheet rules are imported by `battle/results.js` and stay), `sandbox.css`, new
  `src/ui/styles/v2-hubs.css`, `e2e/shots/m5-hubs.mjs`; dead rules in `meta-a.css` hub sections at the end.
- **Kit reused:** `.ui-hubtile`, the host girl and bubble (E1), `plateHead` (E2), `sideRail` (E3), `countdownChip`,
  the badge set, `.ui-row`, `.ui-cost`, `inkBtn` (Claim), `lockedTile`, `offSeasonBand` (E9), colour coin/gem icons on
  reward amounts, the motion layer.
- **Done when:** one yellow on every hub (today Achievements 5, Titan Trials 2), host ≤ 35% (Titan Trials 37% today),
  **no ellipsis** (Missions and Challenge have one each), taps ≥ 44 px (today the tabs, login days, Bounty's locked tier
  row at 23.5 px, Multiplayer tiles at 34.5 px), rows ≤ 2 numbers each, Achievements whole list ≤ 10 screens for the
  audit save. E2E: `hubs.mjs`, `lists.mjs`, `achievements.mjs`, `ascension.mjs`, `sandbox.mjs`, `multiplayer.mjs`,
  `item-art.mjs`, `m5-kit.mjs`.
- **Owner sees:** all hub screens share one look: painted tiles with ink captions, the host girl with her line, sections
  on a left rail, and one clear Claim or Go on each row.

### M6. The bar, the shops and Recruit (V5) (M) · lane A, after M5

- **Screens:** the top bar on every day screen (token wallets move into it), Mall (six shops), the buy sheet, Recruit
  (banner, pity and spark strip, Rates, History and Spark sheets), the 10-pull result summary.
- **Files:** kit commit first: `src/ui/wallets.js`, `topBar()` / `currencyPills()` in `components.js`; then
  `src/ui/screens/mall.js`, `src/ui/mallView.js`, `src/ui/screens/recruit.js`, new `src/ui/styles/v2-shop.css`,
  `e2e/shots/m6-shop.mjs`; dead rules in `meta-a.css` "recruit" and "tabs / mall", `hubs.css` mall parts.
  **Waits for the home** to land too: it reads `wallets.js` ("the home all three").
- **Kit reused:** the kit top bar and `.ui-cur` wallets with the home kit's colour icons, the kit offer card, `.ui-cost`,
  the buy sheet from the ink-kit fixture, `countdownChip`, M3's girl tiles in the pull result.
- **Done when:** each wallet appears once, in the bar (today a token shop shows it in its plate head), Recruit ≤ 12
  numbers (today 13), the pull result ≤ 12 numbers outside tiles (today 29) with text ≥ 12 px (today 11.2) and nothing
  painted over (today 10), Mall and buy-sheet taps ≥ 44 px (today 29 px tiles and 37.75 px steppers). E2E: `lists.mjs`,
  `item-art.mjs`, `potential-m0.mjs`, `potential.mjs`, `achievements.mjs`, `ascension.mjs`, `ur-awaken.mjs`.
- **Owner sees:** the top bar shows exactly what each screen spends, event and shop tokens included, with the new coin
  and gem icons; the Mall and Recruit match the rest of the menus.

### M7a. Profile, Story, Journal and the event page (M) · lane C, any time after M0

- **Screens:** Sensei Profile and its sheets (edit, showcase editor, pin picker, more, preview), Story archive, Captain's
  Journal, the event page's five tabs.
- **Files:** `src/ui/screens/profile.js`, `src/ui/profile/*`, `profile.css`, `src/ui/story/archive.js`,
  `src/ui/story/journal.js`, `story.css` (archive rules only; the scene player is a moment screen), `journal.css`,
  `src/ui/screens/event.js`, `src/ui/events/*` except `events/lobby.js` (home), `events.css`, new
  `src/ui/styles/v2-records.css`, `e2e/shots/m7-records.mjs`.
- **Kit reused:** `.ui-panel`, `sideRail` for the edit sheet, `.ui-tabbed` or `rail()` for the event tabs, M5's calendar
  for Daily Gifts (copy its classes, do not edit `hubs.css`), girl tiles from M3 for the showcase (until then today's
  cards), `.ui-row`, `itemTile`.
- **Done when:** Journal text ≥ 12 px (today 9.6) and one yellow (today 6), Story archive ≥ 12 px (today 10.56) with no
  sideways scroll, no stray pink on either (today 5 and 2), Profile taps ≥ 44 px (today 27.75) and its edit sheet with
  nothing painted over (today 18) and no rounded corners (today 46), event taps ≥ 44 px (today 24 under on Daily Gifts).
  E2E: `profile.mjs`, `story.mjs`, `tutorial.mjs`, `halloween.mjs`, `event-title.mjs`.
- **Owner sees:** Profile, Story, the Journal and the Halloween event page wear the same look and read cleanly on a phone.

### M7b. Notice, Bestiary and Wiki (M) · Notice in lane A after M6, Bestiary and Wiki in lane B after M4

- **Screens:** the Notice board and Patch notes (opened from the home and the title), Bestiary (families, enemy
  detail), Wiki (search, categories, article).
- **Files:** `src/ui/lobby/notice.js` (only after the home has landed: it lives in the home's folder; agree with that
  lane), the "Notice board modal" and "Patch notes" rules in `meta-a.css`; `src/ui/screens/bestiary.js`,
  `src/ui/screens/wiki.js` and their `meta-b.css` sections; new `src/ui/styles/v2-codex.css`, `e2e/shots/m7b-codex.mjs`.
- **Done when:** the Notice has one yellow (today 4), no ellipsis, ≤ 12 numbers outside the version rows (today 20);
  Bestiary and Wiki text ≥ 12 px (today 11.52 / 11.2), the family rail fits (today it scrolls), the Wiki search field
  44 px (today 21.5). E2E: `patch-notes.mjs`, `audio-dense.mjs`, `final-tier.mjs`, `update-check.mjs`.
- **Owner sees:** the patch notes and the encyclopedia screens match the rest.

### M8. Online screens and Settings (M) · online half in lane C, Settings in lane A after M6

- **Screens:** Co-op room, Messages (four lists and the thread), Chat, Clan (find/create and all six tabs), the player
  card, report dialog, invite toast and needs-update sheet; Settings (five sections, Licences, import, export, reset).
- **Files:** `src/ui/screens/coop.js` (menu parts only; `feature/abilities` touches it lightly), `messages.js`, `chat.js`,
  `clan.js`, `src/ui/online/*` except `coopHud.js` (battle), `online.css` and `social.css` (menu rules only; their co-op
  HUD rules stay), `coop-modes.css`; then `src/ui/screens/settings.js` (abilities adds two lines there),
  `src/ui/settingsSections.js`, `meta-a.css` "settings"; new `src/ui/styles/v2-online.css`, `e2e/shots/m8-online.mjs`.
- **Done when:** text ≥ 12 px everywhere (today 9.92-10.56), taps ≥ 44 px (Co-op Join is 17 px today, Messages 30.5,
  the Settings "i" buttons 23), one yellow (Co-op 4 today), no sideways scroll (Messages, player card), the "online
  features offline" note said once per screen. E2E: `online.mjs`, `social.mjs`, `multiplayer.mjs`, `coop-rejoin.mjs`,
  `coop-freeplay.mjs`, `codex-modes-coop.mjs`, `event-title.mjs`, `audio.mjs`, `camera-lock.mjs`, `transitions.mjs`,
  `update-check.mjs`.
- **Owner sees:** Co-op, Messages, Chat, Clan and Settings are readable on a phone and look like the rest.

### M9. Sweep and the release check (M) · all lanes closed

- **Screens:** the shared modal shell, confirm dialog, toasts, beta gift and thank-you, update and stale banners, the
  rotate prompt, the loading corner, the title's side buttons (12 px and 44 px only, same look), anything a milestone
  left behind.
- **Files:** the leftovers above; the dead legacy rules in `meta-a.css`, `meta-b.css`, `hubs.css`, `online.css`,
  `social.css` that no screen uses any more (Select Ticket's included); `tools/cssFloor.baseline.json`.
- **Done when:** `node e2e/menus.mjs` passes every shot at all three sizes; `cssFloor` reads **0** for `meta-a.css`,
  `meta-b.css`, `journal.css`, `unit-build.css`, `gearFilter.css`, `modes.css` and `sandbox.css` (today 37, 35, 7, 20,
  1, 9, 4), and no menu rule under 12 px is left in the mixed sheets `online.css`, `social.css`, `story.css`,
  `potential.css`, `gear-ur.css`, `ur.css` and `unit-info.css` (today 41, 29, 8, 13, 11, 6, 44 in all; their battle,
  co-op HUD and scene-player rules wait for the post-ultimates restyle); `battle.css`, `battle-modes.css`, `coach.css`
  and `coop-modes.css` are untouched; every e2e above passes; a before/after contact sheet of all 83 screens; an independent final review; a
  draft patch note for the owner.
- **Owner sees:** the whole menu side finished, with one before/after sheet to check on a real phone.

### After the ultimates merge (not in this plan's build)

The battle drawer, hero drawer, HUD, ability bar, live upgrade tree and in-battle hold sheet (owned by
`feature/abilities` A3 M4/M5), the Results sheet and the pause menu (`battle/results.js`, `battle/pauseMenu.js` and
`battle.css` change on that branch), and the shared 3x5 tree grid's look (`tree-grid.css`, `treeGrid.js`). They get
the night Ink & Paper look once the ultimates have merged, on the abilities lane.

## 6. M4 in detail: the Potential Board

**What it replaces.** Today's Potential surfaces: the six bloom pips in the Info tab's Potential row
(`potentialSection` in `src/ui/potential.js`) and the Potential sheet (`openPotential` in `student.js`: 41 numbers,
paragraphs, a six-cell track). The `potPill` stays on cards and in battle.

**Look (owner decision 109 / 110).** A night ink plate (the `.ui-night-zone` surface inside the day page, never black)
with faint star dust and a fine academy grid: a star-chart feel. Her six Potential steps are **academy-tech nodes**
(hex sockets with one chamfered corner, the kit's cut language), joined by **light paths** in her hue (2.4 px with a
soft glow; an unlit path is a 1.4 px dashed `--on-plate-dim` line). The ten level gates sit on the paths as small
diamonds; level dots run along the paths; her thumb portrait marks where she is; a ring marks LV 85; LR units get the
Nightglass twin-star crest after it (exclusive to LR). **No animal or zodiac silhouettes, no sign names, no "sign" or
"constellation" wording, nothing laid out like a six-star duplicate screen**: the reviewer checks this by eye.

**Layout per girl, from her role.** Five layout families drawn as node graphs in a 100 x 64 box; each girl gets her
family's variant picked from her id (a stable hash), mirrored or not by the same hash, in her own hue, with her role's
line emblem in the centre socket. Default family by class (a builder may move a girl):

| Family | Shape | Default classes |
|---|---|---|
| Spear | nodes climb a forward-leaning spine to a tip; P6 at the tip | marksman, sniper, duelist, skirmisher, cleaver, falconer |
| Burst | P1 in the centre, nodes on a spiral of rays; P6 on the outer crown | bombardment, artillery, chain, alchemist, trapper, spiker, bowler, mirror |
| Ring | nodes on a ring around a centre socket; P6 in the centre | support, enchanter, exorcist, controller, displacement, purifier, hexer, ring, council |
| Circuit | nodes on a right-angled circuit trace; P6 on the chip | economy, engineer, manager, builder, summoner, botanist |
| Crest | a symmetric crest; P6 at the top | the heroes (vanguard, mystic, tideguard, champion, puppeteer, stormrider) |

**Route and gates (from SPEC §2.2 of the scratch mock, kept):** P1 → gates 1-5 with LV 1-60 → P2 → gate 6 → LV 61-63
→ P3 → gate 7 → 64-67 → P4 → gate 8 → 68-72 → P5 → gate 9 → 73-78 → P6 → gate 10 → 79-85 → LV 85 ring (→ LR crest).
This is the real rule (gate k ≥ 6 needs P(k − 4)), so the Board teaches it without text. Gates light from her level,
nodes from her Potential: "P4 but behind on gates" shows at a glance.

**Where it lives.** Glance: the Info tab's Potential panel becomes a Board thumbnail (nodes and lit paths only),
"Next ✦ <step>" and "Board ▸"; the plate gets a **Growth ring** with its percent (tap opens the Board; hidden while it
is open). Details: the Board opens as a sheet over the tabs and content window; the art band and plate stay. Route
params `#/student/<id>?tab=info&board=1&sel=p5` (`p1`..`p6`, `g15`, `g6`..`g10`, `end`, `lr`). Escape closes a card,
then the Board.

**Cards (tap a node, a gate or the end ring).** The right column becomes the card: P sticker and step name, state
(✓ Hers / Next / Locked · after P4), the stat chip plus at most two kit chips (each names its stat), one sentence of
at most 60 characters, an FX preview loop, "Opens LV cap 78", Details ▸ for the full `long` text, and Raise on the next
node only. Gates 1-5 share one card ("4/5 broken", Level tab ▸); gates 6-10 show their state, cap change and up to
three material chips, Level tab ▸. With nothing tapped, the column shows what her steps give (three bars to MAX by role)
and the next step with **Raise** (the screen's one yellow; "Raise · ◆ 1 · 10,000" with the home kit's icons; when she
cannot afford it, the disabled style and one line saying what is missing).

**Earning a node.** Raise calls the existing `essence.raisePotential` (as today's sheet does), saves, then plays one
skippable timeline: the essence arcs to the node, the path draws with a light at its head, the node ignites (scale
0.15 → 1.35 → 1, a ring flash, eight sparks), the card turns to that node with the one NEW sticker, the plate's P bumps,
Growth counts up, the gate it opens pulses once. **P6** adds every path turning sakura, the nodes bumping in turn, the
five-petal crown over P6 and a **"Full Potential!"** banner for at most 1.2 s, never over the board's centre for long.
Transform, opacity and stroke-dashoffset only, through the home kit's motion layer; reduced motion = 120-150 ms fades;
Low graphics = no blur filters (a second wide stroke instead).

**Growth %** (computed, never saved): `0.5 × (P − 1) / 5 + 0.3 × gates / 10 + 0.2 × (level − 1) / 84`, floored; an LR
unit `0.9 × growth + 0.1 × (LR done)`. Shown on the plate ring and the Board header, and as a **Growth** sort in Students
(no rewards, no badges).

**Data it reads (display only; nothing here is new game logic):**
- `src/systems/potential.js`: `potentialLevel`, `potentialView` (per node: `active`, `next`, `kit`, `parts`, `stat`,
  `cap`, `tags`), `potentialNext`, `potentialStepInfo`, `potentialSteps` / `potentialFold` (the three role bars),
  `describePotentialStep`, `potentialStatLabel`, `isKitStep`, `hasPotentialNew` / `clearPotentialNew`, `MAX_POTENTIAL`.
- `src/systems/essence.js`: `essenceBalance`, `essenceCap`, `raiseCost`, `canRaisePotential`, `raisePotential` (the one
  action, unchanged), `boughtP`, `MAX_P`.
- `src/systems/progression.js`: `GATE_CAPS`, `BASE_GATES`, `MAX_BREAKTHROUGH`, `MAX_LEVEL`, `gatePotential`,
  `gatesAllowed`, `levelCapAt`, `levelCapInfo`, `potentialLevelCap`, `breakthroughCost`, `canBreakthrough`.
- `src/data/potentialText.js` (`node`, `long`, `fx`) and the unit defs (`id`, class, `rarity`, `kind`).
- New, UI-only, never imported by `src/sim/**`: `src/data/potentialBoards.js` (per girl: family, variant, mirror, hue
  sampled once from her card art, emblem; defaults by class so a new girl is never blank) and two fields per step in
  `potentialText.js`: `card` (one sentence ≤ 60 characters, at most one number) and `chips` (≤ 2, ≤ 14 characters).
  Until a girl's lines are written, the card falls back to `node` and the first sentence of `long`.

**Files:** new `src/ui/potentialBoard/layout.js` (pure: families, variants, route bands, items on paths, label and
token placement), `draw.js` (SVG, full and thumbnail), `card.js`, `earn.js`, `growth.js`, `index.js`
(`openBoard(host, def, unitState, { sel, onRaise, onClose })`); new `src/data/potentialBoards.js`; `src/data/potentialText.js`
(the new fields); new `src/ui/styles/potential-board.css`; `src/ui/styles/potential.css` (menu rules only: the
`potPill` keeps its battle look); `src/ui/potential.js` (the panel), `src/ui/screens/student.js`
(open/close, params, Raise → earn), `src/ui/screens/students.js` (Growth sort); new tests
`tests/ui/potentialBoardLayout.test.js`, `tests/ui/growth.test.js`, `tests/data/potentialBoards.test.js`, extended
`tests/data/potentialText.test.js`; new `e2e/potential-board.mjs`; a short spec `docs/specs/POTENTIAL_BOARD.md` (the
scratch `ui-next/potential/SPEC.md` rewritten for the Board, without signs) and a note in UI_DIRECTION 6.2. The scratch
mock's route and placement code (`ui-next/potential/mock.js`) can be ported; its silhouettes and sign data cannot.

**Done when:**
- Unit tests: every one of the 35 girls (and any later id) resolves a board; every point inside the box; six nodes +
  end; LR units have the crest point; at 844x390 every node centre is **≥ 44 px from every other node** and every hit
  target ≥ 44 px; labels and her token clear of nodes, gates and each other (≥ 2 px); bands cover LV 1-85 with no gap;
  phones label only the next node; Growth examples (Aoi P4, LV 48, 4 gates = 53%; 100% at P6 · LV 85 · 10 gates; LR
  90 without the step, 100 with it); `card` ≤ 60 characters; no other game's name in any string.
- Budgets at 844x390: Info tab **≤ 10 numbers** with the panel; the Board open **≤ 12** (today's sheet: 41); a card
  open ≤ 12; text ≥ 12 px; contrast on the plate ≥ 4.5:1; one yellow (Raise).
- `e2e/potential-board.mjs` at 844x390 (touch), 1280x720 and 390x844: open from the panel, the P sticker and the ring;
  tap P5 → Next card → Raise → after the timeline the card says ✓ Hers + NEW, the plate says P5, coins went down by
  `raiseCost`, Growth went up; a tap during the show skips to the end; gate 9 and the gates 1-5 card open; Escape closes
  the card then the Board; reduced motion fades only; Students sort by Growth puts the highest first.
  `e2e/potential.mjs` and `e2e/girl-page.mjs` still pass. Sim id and `COOP_PROTOCOL` unchanged.
- An independent visual review on Aoi (Spear), Kaede (Spear), Chika (Circuit), Umeko (Ring), Akane (Burst), Hikari
  (Crest) and a P6 girl, checking the "not a copy" rule above.

## 7. Excluded, and why

- **The home**: the lobby, its menu sheet, news and objective cards, the secretary, the background picker and the event
  lobby card are being redesigned now (`/home/user/wt-ui2`, `wt-home-a/-b/-c`). The Notice moves in M7b only after that
  lands, by agreement with that lane.
- **The battle UI**: the battle drawer, hero drawer, HUD, ability bar, live upgrade tree and in-battle hold sheet belong
  to `feature/abilities` A3 M4 / M5. With them, the Results sheet, the pause menu and the shared tree grid's look wait
  for the ultimates merge (section 5, last part).
- **Moment screens without a surface mode**: the story scene player, the title (except its side buttons' text floor in
  M9) and the recruit reveal animation (its summary is in M6). `#/soundtest` is a dev page.
