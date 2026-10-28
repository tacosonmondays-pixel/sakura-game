> Handoff note (Oct 28): written on another machine. Paths under /home/user/wt-* and /tmp/claude-0/... are not in the repo; use your own worktree and scratch folder. The approved spec is docs/specs/GATE_ARC.md.

# Gate Arc · Step 1 build plan

Written Oct 27, 2026 against `feature/gate-arc` at `f4cf107b` (main, v0.1.53). The approved spec is
`gate-arc/repo/GATE_ARC.md` with the defaults in its §22 (Q1-Q23; Q19 answered: a full lethal war with no gore).
This plan covers Step 1 only: foundations plus Act 1 "Rush Hour" (1-6 to 1-10). Nothing here ships. The branch merges
into a bundled co-op release later.

---

## 0. Baseline and setup (done)

| Item | Value |
|---|---|
| Worktree | `/home/user/wt-gate`, branch `feature/gate-arc` from `origin/main` `f4cf107b`, pushed and tracking `origin/feature/gate-arc` |
| node_modules | symlink to `/home/user/sakura-game/node_modules` |
| Sim id (baseline) | `92e2e22527cf` (`node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"`) |
| Co-op data hash (baseline) | `1e0af7d3` (`node -e "import('./src/online/coop/version.js').then(m=>console.log(m.coopVersion().data))"`) |
| COOP_PROTOCOL | 8 (`src/online/coop/version.js:48`). This branch does not bump it (§7) |
| Prototype | `origin/proto/modern-city` `e02ac311` (base `685b40b2`). It merges into main with only one conflict, at the end of `src/render/props.js` |
| Disk | 2.6 GB free after setup. Keep it above 1.5 GB |

**Rules for every builder session**
- Work only in `/home/user/wt-gate`. Push only `feature/gate-arc`. Never force-push or rewrite history. Never run a bare `git stash`.
- Every commit ends with exactly these two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01V3cmFg3aKCuDQGLA9Topgo`
- Temp scripts, measurements and screenshots go in `/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/gate-arc/step1/`, never in the repo.
- Dev servers use ports 5241-5245 only (`npx vite --port 5241 --strictPort`; `node e2e/ui-shots.mjs --port 5242 …`). The e2e scripts that pick a free port themselves are fine.
- After a build, run `rm -rf /home/user/wt-gate/dist`. Check `df -h /` before any big step.
- Never write other games' or anime names, or player names, anywhere. Sensei is never gendered. No gore: defeat is shown by absence.
- **Review gate (HANDOFF §6):** a milestone is done only after an independent reviewer gives an explicit OK, with at most three fix rounds. Then the next milestone starts.
- **Hash log:** at the end of each milestone, append the sim id, the data hash and the commit to
  `…/gate-arc/step1/HASHES.md`, and put the same two values in the milestone's last commit message.
- **Screenshots for the owner (owner, Oct 27: "can I see screenshots?"):** every milestone ends with the shots listed under
  "What the owner sees", at 844x390 and 1280x720, saved under `…/gate-arc/step1/shots/<milestone>/` and sent to the owner.
- **Owner, Oct 27: "enemy rebuild sure but after":** the enemy model rebuild is not part of Step 1 and comes after it.
  Step 1 changes no enemy GLB. The Frostbitten Heir is a new EnemyDef on the shipped Slime Prince GLB.

### Why the sim id moves even without sim code
`tools/simId.mjs` hashes `src/sim` and everything it imports. That includes `src/data/{stages,maps,enemies,rules,units,
unitsNewGirls,modes,freeplay}.js`. So **any edit to stages.js, maps.js, enemies.js, rules.js or units*.js changes the
sim id**, and the co-op data hash also changes whenever `STAGES`, `MAPS`, `ENEMIES` or `UNITS` change. Expected moves:

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| S1a | changes | changes | stages.js builder and fields; modes.js `modeChapter` |
| S1b | **unchanged** | **unchanged** | render, art and audio only. This is a done-when check |
| S1c | changes | **unchanged** | placement.js, waves.js, Sim.js, headless.js, freeplay.js. No MAPS/STAGES edits |
| S1d | changes | changes | 5 maps, 5 stages, 1 enemy, 5 rule placements, Yuzuha's acquisition |

---

## 1. The code map today (re-located from TECH.md's Oct 20 numbers)

| What | Where today |
|---|---|
| Difficulty ramp | `src/data/stages.js:46-47` (`HP_TOP`, `hpScaleAt`), `HERO_HP_PASS` `:53-62`, `cashScaleFor` `:65`, `startCashAt` `:67` |
| Drops and first clear | `campaignDrops` `stages.js:73`, `campaignFirstClear(chapter, finale)` `:106-112` |
| Stage builder | `campaign()` `stages.js:124-164`: `requires` = previous id in `CAMPAIGN_ORDER` (`:125-127`), `finale = id.endsWith('-5')` (`:129`) |
| Chapters and ids | `CHAPTERS` `stages.js:168-217`, `STAGES` `:1035`, `campaignStages()` `:1052`, `CAMPAIGN_IDS` `:1095` |
| Unlocks | `src/systems/unlocks.js`: `isStageUnlocked` `:156-160`, `chapterProgress` `:186`, `nextStage` `:200-202`, `chapterRibbons` `:101`, `campaignShowcase` `:149` |
| Story unlock copy | `src/systems/story.js` `stageOpen` `:224-228` (a copy of the unlock rule; story.js cannot import unlocks.js) |
| Story queue | `src/systems/storyTriggers.js`: `campaignIndex` `:15-18`, queue sort `:69`, `nextQueued` sort `:99`, `requirementFor` `:139-150` |
| Lock text, Go to button | `src/ui/screens/stage.js` `requirementText` `:184-193`, `reqStage` button `:659-661` |
| "Next" after a win | `src/ui/battle/setup.js` `followingStage` `:193-196` |
| Medal gems | `src/systems/rewards.js:274` (`DIFFICULTIES[d].firstClearGems` 20/40/60/100, `src/data/types.js:204-207`); `MODE_RIBBON_GEMS` `:24` is all 0, so C2 is moot |
| Achievements | `src/data/achievements.js`: chapter rows `:86-96`, `a_gold_40` `:98`, `a_sakura_40` `:129`, `a_quad_40` `:132`, `ACHIEVEMENT_WAVES` `:27`, `achievementLive` `:248`; metrics `src/systems/achievementMetrics.js` `chapterClear` `:261` (the `'c-'` prefix bug), `medals` / `medalsAll` `:262-263`, `storyChapters` `:162-165` |
| Laurel text, comment | `src/data/profileArt.js:34`; `src/ui/profile/parts.js:165` ("40 × 4") |
| Campaign screen | `src/ui/screens/campaign.js`: tab lock `:56`, one grid of `chapter.stages` `:84-90`, summary `:103-107`, banner `:112-138`, `isFinale` `:152`, BOSS chip `:173` |
| Scene index | `src/data/story/sceneIndex.js:7-16` (`CHAPTER_SCENE_IDS`, Act I only) |
| Scene registry order | `src/data/story/index.js:24` (`ALL = [...opening, ...ch1, ..., ...ch8, ...lessons]`) |
| Scene format | `src/data/story/format.js`: `SCENE_KINDS` `:52`, `ENEMY_SPEAKERS` `:57`, `NPCS` `:61`, `META_KEYS` `:91`, `scene()` `:228`; player kicker `src/ui/story/player.js:47` (kind `event` → "Event Story") |
| Story lint | `tests/story/content.test.js`: `BANNED` `:37-42` (includes kill/die/dead/death/blood), `SCENE_LIST.length` 32 `:125`, archive order by `CAMPAIGN_IDS` `:148-163`, free-girl join text `:166-176`, mystery `:304`, story gems ≤ 600 `:384-394` |
| Free joins | `src/data/unitsNewGirls.js:216` (yuzuha, `free('4-2')`); `src/systems/catchUpJoins.js:34` (`CATCH_UP_UNITS`), `joinStageOf` `:37-39`; shipped `ch4.yuzuha` join scene `src/data/story/scenes/ch4.js:27` (after 4-2) |
| Placement | `src/sim/placement.js`: `SQUARE_BLOCKERS` `:28`, land/water test `:157-158`; autoPlan lattice `src/sim/headless.js:265-266`; girl height `src/render/actors.js:294`, shadow disc `:715` |
| Waves | `src/sim/waves.js`: `generateWave` `:71`, fixed path pick `:150-158`, lane pick `:164`; `src/sim/freeplay.js:404`; `Sim._getWave` `src/sim/Sim.js:743-750`, `waveStart` emit `:774` |
| Rules | `src/data/rules.js` `STAGE_RULES` `:43`; display `src/ui/text/rules.js` `RULE_TEXT` `:4-20`; call sites `src/ui/battle/modes.js:108`, `src/ui/screens/coop.js:668`, `src/ui/screens/stageModes.js:70`, `:165` |
| Ironclad by chapter | `src/data/modes.js:42` (`stage.chapter`) |
| Theme pipeline | `src/render/themes.js` `THEMES` `:46`, `resolveLook` `:328`; `textures.js` `createAtlas` `:43`, `GROUND_STYLES` `:912`, `paintGround` `:940`, `detailTexture` `:1246`, `pathTexture` `:1373`; `terrain.js` `SCENERY` `:42`, `INTRO_KEYWORDS` `:155`, `FAMILY_KEYWORDS` `:162`, `place` `:408`, spawn gate `:592`, goal gate `:599`, `buildSlots` `:672` |
| Outside the battle | `src/art/stageThumb.js` `MAP_THEMES` `:10`; `src/art/backdrops.js` `THEME_SKY` `:212`, `themeBackdropSVG` `:219`; `src/audio/routes.js` `THEME_FAMILY` `:8-20` |
| Tests pinned on the old shape | `tests/data/world.test.js`: `MAP_OPTIONAL` `:33`, `STAGE_OPTIONAL` `:38`, `THEMES` `:38`, `TILE_CHARS` `:39`, enemies 60-75 `:72-80`, minibosses `:216-219`, IoU `:384`, turning `:392`, 40/59 stages `:538-551`, 8×5 `:553`, requires chain `:632-660`, free recruits `:661`, water `:745`, FREE-COUNTER `:760-789`; `tests/data/achievements.test.js` (132 rows, gem caps, frozen ledger); `tests/integration/balance.test.js` `freeUnitsBefore` `:38-47` (array order), `EXPECTED_LEVEL` `:36` |

---

## 2. Decisions this plan makes where the spec is silent, stale or overtaken by shipped code

1. **Two-key requires.** `requires` may be a string or an array. Act I keeps its string chain, untouched. Act II uses
   x-6 = `'c-5'` for c = 1, else `['c-5', '(c-1)-10']`, and x-7…x-10 = the previous Act II id.
   A single helper `stageRequires(stage) → string[]` in `stages.js` is the only reader of the field. Every consumer moves
   to it: unlocks, story.js `stageOpen`, `requirementFor`, the stage-screen lock text and Go-to button, and co-op through
   `isStageUnlocked`. In Step 1 only chapter 1 exists, so the array branch is covered by unit tests on synthetic stages.
2. **Act II numbers** come from the PROPOSED table in TECH §5.2, computed rather than typed in:
   - `hpScale = round2(hpScaleAt(5c+k-1) × mean(HERO_HP_PASS of chapter c))`;
   - `cashScale = cashScaleFor(rung)` and `startCash = startCashAt(5c+k-1)`, capped at 900;
   - waves from chapter c+1's Act I row (chapter 8: 30/30/31/31/32);
   - `hpPass` = the chapter mean; tier = the tier of stage `(c+1)-k` (chapter 8: expert);
   - drops = `campaignDrops(min(c+1, 8), …)`; first clear = `campaignFirstClear(c, k === 5)`, so 1-10 pays 120 gems
     and a ticket;
   - `medalGemMul: 0.5` and `modeChapter: min(8, c+1)`.

   A test pins all 40 values against the TECH table. The chapter means are 1.69/1.77/1.40/2.15/1.92/1.77/2.19/1.25,
   which matches the TECH table. Spot-checked: 1-6 → 2.15 and 7-10 → 14.24.
3. **Ordering.** `CAMPAIGN_IDS` = Act I (40, unchanged order), then Act II appended in (chapter, n) order. Every list
   that means "play order" sorts by `stageOrderKey(id) = (chapter, act, n)`. `nextStage` keeps "Act I first": a veteran's
   pointer does not jump back to 1-6 (TECH B2). Act II is reached through the campaign screen's new row and its NEW badge.
4. **Achievements.**
   - `chapterClear` counts `CHAPTERS[c].stages` (Act I) instead of the id prefix. This fixes the `'1-'` bug before
     1-6 exists.
   - The three "all 40" descriptions become "…on 40 campaign stages". Ids and rewards stay the same, so the frozen
     ledger is untouched.
   - New rows: "Chapter c · Act II Complete" (`a_ch{c}_act2`, half of `a_chapter_c` gems: 62/75/87/100/112/125/137/150,
     ≈ 850 in all) and the 80-stage rows (`a_clear_80`, `a_gold_80`, `a_sakura_80`, `a_quad_80`), with item and title
     rewards inside the existing tier bands.
   - A row is only **live** when all its stages exist. In Step 1 only `a_ch1_act2` is live; the other seven and the 80
     rows stay hidden.
   - `achievements.test.js` counts and caps are updated, and every shipped row in the ledger stays byte-identical.
5. **Story scenes.**
   - The 7 Act 1 scenes live in a new file `src/data/story/scenes/g1.js`, filed right after `ch1` in `ALL`. This keeps
     the mystery lint order and the archive tab by chapter.
   - Kind: `event`, so they pay 0 gems (Q8; the 600 cap is untouched).
   - New scene meta: `act: 2` and `note` (the content note).
   - The player kicker reads "Chapter 1 · Rush Hour" for `act: 2` instead of "Event Story".
   - Mahiru, Commander Kuroe and Lt. Mori speak as `unknown` with a `name` plate, as the spec says until portraits exist.
     The frozen slimes and Wobble use `slime_droplet` with a plate, as `ch1.js:47` already does. The Heir is added to
     `ENEMY_SPEAKERS`.
6. **Scene index.** `CHAPTER_SCENE_IDS` stays Act I, so `storyChapters` and its achievements never go backwards. A new
   `ACT_SCENE_IDS = { '1:2': [7 ids] }` is checked against the scene chunk by the index test.
7. **Yuzuha's join moves to after 1-7** (spec §12, §21; STORY §13). The spec was written before v0.1.40 shipped her
   join at 4-2. What changes:
   - `free('1-7')`; 1-7 `unlocks: ['yuzuha']`; 4-2 no longer grants her.
   - `catchUpJoins.js` gets `LEGACY_JOIN_STAGES = { yuzuha: ['4-2'] }`. A save that cleared 4-2 but never opened
     v0.1.40 or later still gets her once, with the letter. The `join:` mark is unchanged.
   - The shipped `ch4.yuzuha` scene stays word for word, with the same trigger and reward. `g1.yuzuha` is written so it
     works whether or not the player already has her.
   - **Flag for the story reviewer:** for a new player, `ch4.yuzuha` now reads as a second introduction.
   - Checked today: no Act I stage relies on Yuzuha as a counter. Her `antiAir` / `summon` arrive earlier for players who
     play Act II.
8. **Rule skins** are display-only text in `src/ui/text/rules.js` (`STAGE_RULE_SKINS` + `ruleTextFor(stage)`), keyed by
   stage id. They are outside the sim and data hashes. The numbers stay the rule's own.
9. **Rooftops (U).**
   - U counts as land.
   - A girl whose centre is on U needs her whole footprint on U.
   - For a girl standing on the ground, U tiles block like `H`.
   - Water girls cannot stand on roofs. There is no range bonus.
   - The renderer lifts roof girls to ≤ 0.6.
   - Fallback (Q14): 1-7's U tiles become `.` loading yards (data only).
10. **Lane schedule.**
    - `waveGen.laneCycle: [[0,1],[1]]`: wave n uses entry `(n-1) % len`.
    - Generated groups go round-robin over the open lanes.
    - A fixed spawn on a closed lane moves to the first open lane, and bosses take the longest open lane.
    - Freeplay waves follow the same cycle.
    - `waveStart` carries `lanes` for the barrier, the train and the HUD.
11. **Out of Step 1** (spec items not in the task list; each is noted where it lands later):
    - in-battle radio lines and Brigade barks;
    - x-10 cosmetics (stage still as a lobby background, the "Rush Hour Regular" title);
    - the Captain's Journal "We have been here before." line (the journal holds lessons only);
    - grief, anger and shock faces; new music cues (Noon city, war, requiem);
    - portraits for Mahiru, Kuroe and Mori;
    - the Brigade enemy family (Step 3);
    - energy (Step 0, §7).

---

## 3. S1a · Foundations (data + systems; no new maps visible)

**Goal.** All the Act II plumbing exists and is tested. No Act II stage is registered yet, so the game plays exactly as
v0.1.53, apart from three reworded achievement descriptions.

| File | Change | Class |
|---|---|---|
| `docs/specs/GATE_ARC.md` (new) | The repo-safe spec, copied from `gate-arc/repo/GATE_ARC.md`. Status line: "approved Oct 27 with the §22 defaults; Q19 answered". §19's co-op paragraph is updated: COOP is 8 today and the bundled release sets it once (§7). Run a name scan from a list kept in scratch, never in the repo | docs |
| `src/data/stages.js` | `campaign()` gets `act: 1` and an explicit `finale` (slot 5). The Act I `requires` chain is computed among Act I ids only. New `ACT2_PLAN` (40 rows: id, chapter, k, waves, hpScale, hpPass, cashScale, startCash, tier, requires) built from the §2.2 rule. New `act2Stage(o)` builder (S1d calls it). Fields: `act`, `finale`, `medalGemMul`, `modeChapter`. Helpers `stageRequires`, `requirementsMet(stage, isCleared)`, `stageOrderKey`, `actStages(chapterId, act)`, `nextInAct(id)`. `CHAPTERS[i]` gets `act2: []`, plus `act2Name` / `act2Theme` / `act2Desc`, filled in S1d. Export `CHAPTER_HP_PASS_MEAN` | data (sim graph) |
| `src/data/modes.js:42` | Ironclad reads `stage.modeChapter ?? stage.chapter` | data (sim graph) |
| `src/systems/unlocks.js` | `isStageUnlocked` → `requirementsMet`. `chapterProgress` / `chapterRibbons` take `act = 1`. `nextStage` stays "first uncleared in CAMPAIGN_IDS" (Act I first) | systems |
| `src/systems/story.js:224` | `stageOpen` → `requirementsMet` | systems |
| `src/systems/storyTriggers.js` | `campaignIndex` → `stageOrderKey` compare at `:69` and `:99`. `requirementFor` lists every requirement ("Clear 2-5 and 1-10") | systems |
| `src/ui/screens/stage.js:184-193`, `:659` | Lock text names the uncleared requirement(s). Go-to goes to the first uncleared one | UI |
| `src/ui/battle/setup.js:193` | `followingStage` → next in the same act (Act I: 8-5 → null, never 1-6; Act II: x-10 → (c+1)-6 when it exists) | UI |
| `src/systems/rewards.js:274` | Medal gems × `stage.medalGemMul ?? 1` (rounded) | systems |
| `src/systems/achievementMetrics.js:261` | `chapterClear` over `CHAPTERS[c].stages`. New `chapterActClear` (param `'c:2'`) | systems |
| `src/data/achievements.js` | Reword the 3 "all 40" descriptions. Add the 8 Act II chapter rows and 4 "80" rows. Liveness rule: hidden until their stages exist | data |
| `src/data/profileArt.js:34`, `src/ui/profile/parts.js:165` | Laurel "how" text "on 40 campaign stages"; comment fix | UI text |
| `src/data/story/sceneIndex.js` | Add `ACT_SCENE_IDS` (empty `'1:2'` in S1a; filled in S1d) | data |
| `src/ui/screens/campaignActs.js` (new) + `src/ui/styles/campaign-acts.css` (new) | Pure helpers `actRows(profile, chapter)` (one row per act with ids, header "Act I · The Morning" / "Act II · <act2Name>", lock text) and `actIsNew(profile, chapter, act)` (unlocked, nothing cleared). Small DOM builders for the row header and the NEW badge (reusing `src/ui/badges.js`). Kept separate from campaign.js and meta-a.css so UI v2 can restyle it | UI |
| `src/ui/screens/campaign.js` | `drawChapter` draws `actRows`: a single act shows **no header**, so it looks the same as today. Tab shows NEW when `actIsNew(…, 2)`. `isFinale` → `stage.finale`. Summary keeps `/ CAMPAIGN_IDS.length` | UI |
| `CONTRACTS.md` §4, `docs/CAMPAIGN.md` | StageDef `act`, `finale`, `requires: string\|string[]`, `medalGemMul`, `modeChapter`; the (chapter, act, n) order rule; the Act II numbers rule | docs |

**Tests (add or update)**
- `tests/data/world.test.js`:
  - A13: the requires chain test is rewritten per act. Act I keeps every assertion (`campaign.filter(act 1)`, 40,
    8-5 base 6-7 and 30 waves). Act II gets its own chain and ramp, asserted on `ACT2_PLAN`: x-6 two-key, x-7…x-10 the
    previous stage, hpScale non-decreasing in an act, waves from the c+1 row.
  - `STAGE_OPTIONAL` += `act`, `finale`, `medalGemMul`, `modeChapter`. Counts become "40 Act I + registered Act II".
  - A15: FREE-COUNTER and introduces/order use **unlock ancestors** (`stageRequires`, transitive) instead of array
    index. Act I results are identical.
- `tests/data/act2Plan.test.js` (new): the 40 rows equal the TECH §5.2 table (±0.01). Chapter means are as listed.
  Startcash ≤ 900. Tiers come from the c+1 slot. 1-10 first clear = 120 gems + 1 ticket.
- `tests/systems/act2Unlocks.test.js` (new):
  - `requirementsMet` with a string and with an array.
  - **Old-save safety:** for the veteran fixtures (`tests/fixtures/veterans.js`) and a "cleared up to 3-2" save, every
    Act I stage's unlocked state equals the old rule `!requires || cleared(requires)`, `nextStage` is unchanged, and
    `followingStage('8-5') === null`.
- `tests/systems/storyTriggers` cases (in `tests/story/system.test.js`): queue order by (chapter, act, n) on synthetic
  scenes (a `1-10` after-scene plays before a waiting `2-1` one); `requirementFor` with two requirements.
- `tests/systems/achievementMetrics.test.js`: `chapterClear` ignores `1-6…1-10` progress (synthetic ids in
  `progress.stages`) and `chapterActClear` counts them.
- `tests/data/achievements.test.js`: new row count, caps, ledger unchanged for every shipped id, and `a_ch1_act2` hidden
  in S1a (no 1-6 yet).
- `tests/systems/rewards.test.js`: a stage with `medalGemMul: 0.5` pays 10/20/30/50.
- `tests/ui/campaignActs.test.js` (new, no DOM): one act → one row and no header. With a synthetic chapter that has
  `act2`: two rows, the lock text of a two-key x-6, NEW only when unlocked and uncleared.

**Done when**
- `npm test` is all green. `node e2e/smoke.mjs` passes. `nice npx vite build` succeeds, then `rm -rf dist`.
- `git grep -n "endsWith('-5')" src` is empty.
- No consumer reads `stage.requires` directly except `stageRequires` (and `events.js`, which has its own event stages).
- The campaign screen at 844x390 and 1280x720 with the `m5` seed (`node e2e/ui-shots.mjs --screens campaign --port 5242`)
  looks the same as main, pixel for pixel or with only an explained difference.
- Sim id and data hash recorded (both change).
- Independent reviewer OK.

**What the owner sees.** Nothing new in play: the campaign looks the same (screenshots before/after side by side), and
the three "all 40" achievements now say "40 campaign stages" (achievements screenshot).

**Commits.** (1) docs/specs/GATE_ARC.md; (2) stages.js plan + helpers + tests; (3) unlocks/story/rewards/achievements;
(4) campaign acts UI + docs. Push after each.

---

## 4. S1b · The city look v1 (render only)

**Goal.** A `city` theme (Itomachi, Noon, day) that the renderer can draw, within the phone budget. It is shown on a
preview board only, because no stage uses it yet.

**Port, don't restart.**
1. `git checkout origin/proto/modern-city -- src/render/city/` (buildings.js, cityGround.js, cityKit.js,
   cityMaterials.js, cityProps.js).
2. Hand-apply the prototype's small hooks to today's files: `terrain.js` (+43: painter `extra`, crisp road, `look.rocks`,
   H blocks to the kit when `look.city`, gate selection by `look.spawnGate` / `goalGate`, `buildCity` call,
   update/dispose/shadows), `textures.js` (+79: `asphalt` path style, `paved` ground), `trackMesh.js` (+39: the
   square `subway` tunnel style), `props.js` (`Object.assign(BUILDERS, CITY_BUILDERS)` after today's Halloween props,
   the one merge conflict).
3. Re-scope the prototype's eras. Its `downtown`/`campus` were "future" and `town` was "modern". The spec's Noon `city`
   = the prototype's `town` variant (houses, corner store, vending machines, utility poles, railway with level crossing)
   plus downtown's shop rows and offices.
4. **Drop** the maglev and the hologram signs (future-only; Step 6 `vesper`) and the surge/war code (Step 3 `ruined`).
   Leave campus for Step 2.

| File | Change |
|---|---|
| `src/render/themes.js` | One `THEMES.city` entry (look from TECH §3.1, tuned on screen): `groundStyle 'paved'`, `path.style 'asphalt'`, `spawnGate 'petalRift'`, `goalGate 'shelterDoor'`, frame ring of `guardRail`/`planterBox`/`bollard`, `life` without koi or fireflies, `look.city` kit config. Add the optional `nightLight` read in `resolveLook` (≈3 lines; used from Step 2) |
| `src/render/textures.js` | `paved` in `GROUND_STYLES` (with `slabs` and `kerb` painter flags), `detailTexture('paved')`, `pathTexture('asphalt')` (white dashed centre line, edge lines), atlas regions `zebra`, `junctionBox`, `stopLine`, `cracks` |
| `src/render/groundFeatures.js` | `crosswalk` / `junctionBox` marks at flat crossings (reuse `junctionChevrons`' points); 0 draw calls through `AmbientSystem.drawMarks` |
| `src/render/props.js` + `src/render/city/cityProps.js` | About 25 builders, ≤ 6 variants each, near and far LOD. **Street:** cityBlock (shop row, apartment, office, convenience store, clinic, police box), cityTower (skirt), cityWall, streetLamp, trafficLight, vendingMachine, busStop, billboard, parkedCar, roadCone, barricade, bollard, hydrant, trashBin, bikeRack, streetTree (cherry), powerPole, planterBox, guardRail, laundryLine, catOnWall, pigeonGroup, missingPoster (pigeon cover). **Act 1 set pieces:** stationHall front, ticketGates, clockTower, levelCrossing (barrier reads the wave from S1c), waterBus, lockGate, arcadeRibs (frames only, never a roof over the road), shopFront/bunSteamer, roofBlock (the U tile base, used in S1c). **Gates:** `petalRift` (asphalt slabs and a bent sign leaning into a torn ring, violet-pink seams and the portal disc as glow geometry, a `debris` emitter + petals + frost motes) replaces the prototype's `cityGate`; `shelterDoor` (Shelter 3's steel door with the shipped heart sign; variants station shelter / school main door / school back door) |
| `src/render/terrain.js` | `SCENERY` keywords (streetLamps, trafficLights, vendingMachines, busStops, parkedCars, roadWorks, streetBits, powerLines, strays, billboards); the height class (interior H within 2 tiles of a road ≤ 0.9 tall; the camera is 48°); gate selection; `buildCity` |
| `src/render/trackMesh.js` | `tunnel.style 'subway'` portal (stairs and canopy) and the station hall over a tunnel under ≥ 2 H |
| `src/render/ambient.js` | City day life: pigeons on wires (the bird flock, grey and low), cat, laundry sway, a traffic-signal glow cycle, one instanced train on the skirt rail every 40 s (≤ 6 cars), a water-bus, and Brigade drones high overhead (one instanced mover, navy and amber, **dressing only**: no gun fire, never targets). Paper litter via `look.weatherColors` |
| `src/art/stageThumb.js:10`, `src/art/backdrops.js:212-219` | `MAP_THEMES.city` palette; `THEME_SKY.city` + a skyline case in `themeBackdropSVG` |
| `src/audio/routes.js:8-20` | `THEME_FAMILY.city = 'blossom'` (reuse; a Noon city cue is a later item) |
| `previews/city.html` + `previews/city.js` + `previews/cityMaps.js` | The prototype's preview, re-pointed. Its fixture maps live under `previews/` (never in `MAPS`, never imported by `src/`). `vite.config.js` has no `previews/` input, so they stay out of the bundle |
| `tests/render/terrain-v2.test.js:17` | `GROUND_STYLES` += `paved`; the theme loop then covers `city` automatically (painter colours, frame ring, gate colours, scatter, keywords) |
| `tests/render/cityKit.test.js` (new) | Every city builder builds near and far with ≤ 6 variants. Per-prop triangle caps (the TECH §3.6 numbers ×1.25). `petalRift` / `shelterDoor` carry the portal/goal emitter. No transparent materials. Kit output is deterministic per map id |

**Budget check** (copy `gate-arc/tools/measure.mjs` + `page/measure.html` into `step1/`, root `/home/user/wt-gate`,
server `port: 5241, strictPort`): every preview city board at high/medium/low must have
- ≤ 10 terrain draw calls plus ≤ 3 instanced movers (train, drones, portal shards);
- ≤ 90k triangles on high, ≤ 65k on low;
- ≤ 250 glow sprites and ≤ 40 emitters;
- 0 sorted transparent meshes.

The prototype measured 175-204k triangles **whole frame** (shadows and bloom included), so terrain-only must be measured
on its own. Trim the skyline and sidewalk detail first.

**Done when**
- `npm test` is green. **Sim id = the S1a value and data hash = the S1a value** (proves render-only).
- The budget table is recorded in `step1/HASHES.md` and is within budget on all three qualities.
- Greyscale check at 844x390 (spec §18.6 #7): the road, the gates and every enemy are visible.
- Build OK and `dist` removed. Independent visual reviewer OK (zooming into edges and corners).

**What the owner sees.** Screenshots of the preview board with the real Sim running:
- downtown Itomachi by day at 844x390 and 1280x720;
- a `petalRift` close-up and a `shelterDoor` close-up;
- the greyscale check;
- one portrait-phone shot (390x844).

---

## 5. S1c · Sim features (rooftops, lane schedule, echo exemption, rule skins)

**Goal.** The four engine pieces Act 1 needs, each with tests, on fixture maps and stages. No real map or stage changes.

| Piece | Files | Class |
|---|---|---|
| **Rooftops** (U) | `src/sim/placement.js` (`'U'` = land; a centre on U needs `distanceToNonRoof ≥ r`; U tiles are square blockers for a centre off U; new `isRoof(x, y)`); `src/sim/headless.js:265` (lattice takes U as land and tags `roof`); `src/data/maps.js` (`defineMap` accepts `U`; `buildableTiles` counts it as land); `src/render/terrain.js` + `city/cityKit.js` (a `roofBlock` under each connected U region, ≤ 0.6 tall, parapet and AC units); `src/render/actors.js:294`, `:715` (lift roof girls and their shadow disc to the roof height); `src/render/boardInput.js` (re-intersect taps at roof height inside a U region: at 48° a 0.6 roof shifts the ground hit ≈ 0.54 tiles); the forbidden-zone overlay shows roofs as buildable with an edge ring | sim + render |
| **Lane schedule** | `src/sim/waves.js:150-167` (`gen.laneCycle`; round-robin over open lanes; closed-lane fixed spawns move to the first open lane; bosses take the longest open lane); `src/sim/freeplay.js:382-404` (same); `src/sim/Sim.js:774` (`waveStart` gets `lanes`); `src/render/city/cityProps.js` `levelCrossing` barrier and the train react to `lanes`; a HUD line in the wave banner ("Crossing closed: long way round"), UI only | sim + render + UI |
| **Echo exemption** | `tests/data/trackShape.js` (`isDeclaredEcho(a, b)`: `a.echoOf === b.id` or the reverse); `tests/data/world.test.js` silhouette `:384` and turning `:392` tests skip declared pairs only. New test "echoes": at most 3; `echoOf` names an existing map of a **different era** (era by theme: Morning = the 11 shipped themes, Noon = city/campus/drowned, Evening = vesper); paths, crossings and tunnels deep-equal; rows equal except tiles listed in the map's `echoDiff` (for example the dry basin `~ → .`). `MAP_OPTIONAL` += `echoOf`, `echoDiff`, `city` | test (+ MapDef fields) |
| **Rule skins** | `src/ui/text/rules.js` (`STAGE_RULE_SKINS = {}` and `ruleTextFor(stage)`, which merges `{name, short, desc, toast}` over `RULE_TEXT[rule.id]`); call sites `src/ui/battle/modes.js:108`, `src/ui/screens/coop.js:668`, `src/ui/screens/stageModes.js:70`, `:165` | UI only |

**Tests**
- `tests/sim/placement.test.js`:
  - a roof-centred girl fits; one straddling the edge is `blocked`;
  - a ground girl cannot overlap a roof;
  - a water girl on a roof gets `needsWater`; an amphibious girl may stand there;
  - a hero fits only on a region big enough;
  - `autoPlan` uses roofs on a fixture map;
  - the same seed gives the same placements.
- `tests/sim/waves.test.js`:
  - with `laneCycle [[0,1],[1]]`, odd waves use both lanes and even waves only lane 1;
  - no spawn on a closed lane; a fixed spawn is moved; the boss takes the longest open lane; freeplay waves follow the cycle;
  - **a stage without `laneCycle` gives byte-identical waves for all 40 Act I stages**. The existing
    `tests/sim/campaignGolden.test.js` and `modesGolden` also stay unchanged.
- `tests/data/world.test.js`: the echo test runs on a synthetic echo pair (a fixture copy of `sakura_court` with
  `theme: 'city'`) and checks that an undeclared copy still fails IoU.
- `tests/ui/ruleSkins.test.js`: a skin replaces the name and description; every number in the base description appears
  in the skin's description; stages without a skin are unchanged.
- `tests/core/track.test.js` or `world.test.js`: `U` is in `TILE_CHARS`; a path may not cross a U tile.

**Done when**
- `npm test` is green.
- **The data hash equals S1b's** (no MAPS/STAGES change). The sim id changes and is recorded.
- Preview fixture demo:
  - a girl standing on a roof reads clearly at 844x390;
  - the barrier drops on even waves and the column takes the long lane.
- Engines check if the repo's `e2e/engines.mjs` covers waves (V8 at least).
- Build OK, `dist` removed. Independent reviewer OK.

**What the owner sees.** Preview screenshots: a girl on a shop roof covering two alleys; the level crossing open (odd
wave) and closed with the column on the long lane (even wave); the rule card showing a modern skin name.

**COOP note.** This is the milestone that adds real sim mechanics. The place message is unchanged (an `x, y` on a U tile)
and lanes add no commands, so there is no message-shape change. The sim id still changes, so the release needs the
COOP bump described in §7.

---

## 6. S1d · Act 1 content (maps, stages, boss, joins, scenes)

**Goal.** Chapter 1 gets an "Act II · Rush Hour" row: five city stages playable after 1-5, the Frostbitten Heir, Yuzuha
joining after 1-7, seven scenes and the content note. Lint passes.

### Maps (`src/data/maps.js`, theme `city`, 20×12, `city` render hints)

| Stage | Map id · name | Route (MAPS.md §1.2) | Engine | Watch-outs |
|---|---|---|---|---|
| 1-6 | `noon_station_plaza` · Station Plaza | spawn on the west bus lane (a `petalRift`); east, a wide hairpin round the taxi-rank island, back west under the station concourse (3-tile underpass, ≥ 2 H over it = station hall); out north through the ticket-gate forecourt. ≈ 40 tiles | tunnel | IoU vs `sakura_terrace` (S + hairpin); canal on the south edge with a moored water-bus; MISSING poster (pigeon) on the station wall |
| 1-7 | `noon_covered_arcade` · The Covered Arcade | comb: the shopping street along the north third, three narrow U-teeth (5 deep, r 1.5) drop south and climb back; exit east. ≈ 62 tiles | **U roofs** on the two shop blocks between the teeth | the "meanders ≤ 2" test (`world.test.js:408`) and radius ≥ 1.4 on the teeth; fallback: U → `.` |
| 1-8 | `noon_corner_store` · Convenience Corner | spawn south, up the avenue, anticlockwise loop round the store block, back across its own approach at a **flat** four-way crossing, exit west. ≈ 50 tiles | flat junction + crosswalk marks | flat junctions ≥ 2 tiles apart; IoU vs `sakura_loop`; pocket-park pond + west canal |
| 1-9 | `noon_canal_crossing` · Canal Crossing | spawn north; fork at the railway: short lane straight over the level crossing (path 0), long lane a wide D east round the canal basin (≥ 40 water tiles) over the road bridge (path 1); both rejoin before the south exit | fork + join; `laneCycle [[0,1],[1]]` | IoU vs `lake_reeds` (eye); lock gates, crossing bell, `levelCrossing` on path 0 |
| 1-10 | `noon_dry_fountain` · The Dry Fountain | **echo of `sakura_court`**: same rows, paths, overpass and arcade tunnel. `echoDiff`: the 9 fountain `~` become blocked dry basin carrying the `dryFountain` set piece | echo | `echoOf: 'sakura_court'`, its own `concept` text; T tiles become street trees; the stage card shows the 1-5 thumbnail as a faint ghost (campaignActs) |

### Stages (`src/data/stages.js`, via `act2Stage`)

Numbers come from `ACT2_PLAN`:

| Stage | Waves | hpScale | Tier |
|---|---|---|---|
| 1-6 | 18 | 2.15 | beginner |
| 1-7 | 20 | 2.25 | intermediate |
| 1-8 | 20 | 2.37 | intermediate |
| 1-9 | 22 | 2.48 | intermediate |
| 1-10 | 22 | 2.60 | advanced |

For every stage: `hpPass` 1.69, `medalGemMul` 0.5, drops from the chapter-2 table, `modeChapter` 2.

Pools use only chapter-1 families (MAPS §1.2):
- 1-6: slime green/gold, goblin runner.
- 1-7: goblin runner/dasher, slime green.
- 1-8: slime gold/green, goblin dasher, a few orc grunts.
- 1-9: orc grunt, boar, slime, goblin.
- 1-10: all of these + `slime_courtier`, with `F(22, 'slime_frost_heir', 1, 2, 6)` and a crown drop like 1-5.

Budgets start from the same-slot chapter-2 Act I budgets and are tuned only by the Easy gate. 1-7 `unlocks: ['yuzuha']`.

Other stage wiring:
- `scenery.props`: city keywords. `introduces` is only `['slime_frost_heir']` on 1-10.
- `CHAPTERS[0].act2 = ['1-6'…'1-10']`, `act2Name 'Rush Hour'`, `act2Theme 'city'`, `act2Desc`.
- **Brigade drones are ambient dressing only. There are no Brigade enemy defs.**

### Rules (`src/data/rules.js` `STAGE_RULES`) and skins (`src/ui/text/rules.js`)

| Stage | Rule | Skin |
|---|---|---|
| 1-6 | `petal_sanctuary` | "Rush-hour evacuation" |
| 1-7 | `tailwind` | "Rush hour" |
| 1-8 | `firefly_chorus` | "Time sale" |
| 1-9 | `changing_tides` | "Lock cycle" |
| 1-10 | `supply_ship` | "Brigade airdrop" (the crates parachute in; the numbers are the rule's own) |

`rules.test.js` holds (placements = `CAMPAIGN_IDS.length − 3`).

### Boss (`src/data/enemies.js`)

`slime_frost_heir` "The Frostbitten Heir":
- slime family, tier `miniboss` (like the Prince it retells);
- `variant: 'royal'`, `props: ['crown', 'cape']`, frost colours (pale ice body, white-blue accent): **the Slime Prince
  GLB, no new model**;
- `splitter → slime_courtier ×3`;
- two announced phases using only chapter-1 mechanics (gold slimes spill out; a shivering sprint);
- HP and threat above the Prince's, budgeted in the wave;
- lore and counters written by absence ("It goes home through the crack"), `introducedIn: '1-10'`;
- added to `ENEMY_SPEAKERS` (it says "Throne. ...Cold." in `g1.boss`).

Test pins to update: the minibosses list and the campaign-enemy cap 60-75 → 60-110 (spec). `FAMILY_IDS` stays 12, and
the GLB budget is unchanged.

### Yuzuha (§2.7)

- `src/data/unitsNewGirls.js:229`: `free('1-7', 'Joins after 1-7: …')`.
- 4-2 drops her unlock.
- `src/systems/catchUpJoins.js`: `LEGACY_JOIN_STAGES` and the letter's stage name. Update the order comment.

### Story (`src/data/story/scenes/g1.js`, new; registered after `ch1` in `src/data/story/index.js:24`)

| Id | Trigger | Title | Notes |
|---|---|---|---|
| `g1.pro` | before 1-6 | Two Sunrises | SAMPLE_SCENES scene 2 part 1 (16 lines + the Sensei choice "That's my old school." / "Is that... my rooftop?"); `note: 'This arc contains war and loss.'` shown as a title card before line 1 (format.js `META_KEYS` += `note`, `act`; `src/ui/story/player.js` renders it; exactly one scene carries it) |
| `g1.mahiru` | after 1-6 | You Came Back | sample part 2 (18 lines); Mahiru as `unknown` + plate "Mahiru"; the pigeon on the MISSING poster |
| `g1.yuzuha` | after 1-7 | Deploying | the join: `{name:yuzuha}` + her portrait in cast; Kuroe and Mori arrive (plates "Commander Kuroe", "Lt. Mori"); Mori: "Channel 9. Keep it open." |
| `g1.mid` | before 1-8 | Hot Case | goblins in the convenience store; Sango vs the ticket gate; Rei's ledger; Hikari: "They're not raiding. They're shivering." |
| `g1.poster` | after 1-8 | Missing | side; Aoi straightens the poster, Wobble (`slime_droplet`, plate "Wobble") sits on it |
| `g1.boss` | before 1-10 | The Dry Fountain | the Heir on the throne; the wardstone; drones circling with guns unlocked |
| `g1.epi` | after 1-10 | First Silence | "First light."; the little frostbitten slime hit by a drone that did not pop: it went still and grey (absence only, no wound, no body described); Kuroe: "Hostile neutralised."; Hikari: "It was cold. That's all it was."; music cue `silence` |

Writing rules for all seven:
- kind `event`, `act: 2`;
- 8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, opens with narration or Hikari, Hikari speaks;
- every line ≤ 110 characters, roster names as `{name:id}` tokens;
- Sensei is never gendered (Q1); no ages, no romance;
- backgrounds are `stage:1-6…1-10` stills (rendered by `src/ui/story/backdrop.js` from the city maps) and the shipped
  academy/cg backgrounds for the Wall;
- faces from the shipped set only (`sad`, `surprise`, `deadpan`): grief/shock faces are a later item.

Other story changes:
- `src/data/story/sceneIndex.js`: `ACT_SCENE_IDS['1:2']` = the 7 ids.
- `src/ui/story/player.js:47`: the `act: 2` kicker.

### Tests (update)

- `tests/story/content.test.js`:
  - `SCENE_LIST.length` 32 → 39;
  - archive order by (chapter, act, index);
  - an Act II shape test: chapter 1 Act II has a `before 1-6` opener, a `before 1-10` boss intro and an `after 1-10`
    closer;
  - the free-girl test now expects `{name:yuzuha}` after 1-7;
  - **lint scoping:** `kill/killed/kills/die/dies/died/dying/dead/death` are allowed only in scene ids starting with
    `g` (Arc 1). `blood`/`bloody` and every romance or body word stay banned everywhere;
  - the mystery lint (no "dragon"/"Matriarch") covers g1;
  - one content note.
- `tests/data/storySceneIndex.test.js`: `ACT_SCENE_IDS` matches the chunk.
- `tests/systems/catchUpJoins.test.js`:
  - a 4-2-only save gets Yuzuha once with a letter;
  - a 1-7 save gets her too; an owned girl gets nothing;
  - running it twice is a no-op;
  - an older tab's marks are respected.
- `tests/data/world.test.js`:
  - `THEMES` += `city`;
  - stage and map counts (MAPS 49 → 54, STAGES 59 → 64, campaign 45);
  - every authoring test passes for the five maps, with the echo pair exempted only by declaration;
  - the free recruits match (1-7: yuzuha);
  - water (chapter-1 Act II has no water floor; keep the canals anyway).
- `tests/audio/routes.test.js` (city → blossom) and `tests/ui/ui-v2.test.js` (city backdrop) pass.
- `tests/integration/balance.test.js`:
  - `freeUnitsBefore` uses unlock ancestors;
  - `EXPECTED_LEVEL` for Act II of chapter c = `EXPECTED_LEVEL[min(8, c+1)]`;
  - **the Easy gate wins 1-6…1-10** (45/45);
  - record `BALANCE=full` rows for 1-6…1-10 in `step1/` (Hard/Nightmare; tuning is the later balance pass).

### Done when (the spec's Step 1 gates)

- **Easy-gate bot run passes on 1-6…1-10.**
- **An old save keeps every unlock** (S1a test + an e2e with the `m5` seed: Act I unchanged; Act II row unlocked with
  NEW; 1-6 opens with the content note and `g1.pro`).
- **IoU and turning tests pass.**
- `npm test`, `node e2e/smoke.mjs` and `node e2e/story.mjs` pass. Build OK, `dist` removed. The S1b budget measurement
  is re-run on the five real maps (≤ 10 calls, ≤ 90k / 65k).
- Name scan clean. Sim id and data hash recorded.
- An independent reviewer OK on data, sim and story; an independent visual reviewer OK on the five maps and the scenes;
  a story-safety pass (no gore, no gendered Sensei, students never sexualised).
- **Owner playtest** happens on the release candidate at the ship decision. It is not a Step 1 build gate.

**What the owner sees.**
- Campaign chapter 1 with the new "Act II · Rush Hour" row and NEW badge (844x390, 1280x720, 390x844).
- Each of the five maps mid-battle (5 × 2 sizes).
- A girl on a 1-7 roof.
- The 1-9 crossing closed on an even wave.
- The Frostbitten Heir (battle + bestiary card).
- The content note card.
- One frame from each of the seven scenes.
- Yuzuha's join card after 1-7.
- The 1-10 stage card with the 1-5 ghost.

**Commits.** (1) maps; (2) stages + rules + skins; (3) enemy; (4) Yuzuha move + catch-up; (5) scenes + format/player +
lint; (6) balance/test updates + docs (`CONTRACTS.md`, `docs/CAMPAIGN.md`, a `docs/HANDOFF.md` §3 row for
`feature/gate-arc`).

---

## 7. For the ship decision (not done on this branch)

- **COOP_PROTOCOL.** Step 1 changes the sim id (S1a, S1c, S1d) and the data hash (S1a, S1d). The house rule is that a
  sim change needs a bump.
  - The bundled co-op release sets `COOP_PROTOCOL` **once** for the whole bundle, with one comment line listing Gate
    Arc Step 1 (rooftops, lane schedule, Act II stages, the Heir).
  - `feature/abilities` already plans 8 → 9. If both go out together, 9 covers both. If Gate Arc ships after
    abilities, it needs 10.
  - The release's go/no-go records the merged sim id.
- **Energy is not built.** The spec's Step 0 names energy and the 7 PM reset as a prerequisite. Step 1 does not build it.
  - Without it, Act II adds +550 medal gems (110 × 5) and 1-10's 120 gems + 1 ticket, and Act 1 sweeps are unlimited
    like every stage today (`MAX_SWEEPS` 10 per tap).
  - Act II of chapter c uses chapter c+1's drop table, but it unlocks at the same moment as (c+1)-1 (both need x-5), so
    no drop becomes reachable earlier than today.
  - The owner decides whether Step 1 may ship before energy.
- **Events.** Never ship a data-hash change in a live event week. Halloween is open until Nov 1 and its exchange until
  Nov 8.
- **Patch note** at the top of `src/data/patchNotes.js` at ship time (not on this branch). Mention Act II, the content
  note, Yuzuha's earlier join and the halved Act II medal gems.

---

## 8. Risks

1. **Merging `feature/abilities`.**
   - It touches `src/sim/Sim.js` (+66), `src/ui/battle/setup.js` (+16) and `src/render/textures.js` (+3). S1c edits
     `Sim.js:774` (waveStart) and S1a edits `setup.js:193`. Expect small conflicts.
   - Its sim changes also move every balance number: re-run the Easy gate and the S1d balance rows after the merge.
   - COOP coordination (§7).
2. **Merging `feature/ui-v2`.** It has merged main and has not touched `campaign.js` yet, but V3-V6 will restyle the
   campaign and story screens. The act rows live in `campaignActs.js` + `campaign-acts.css` (not `meta-a.css`), and
   `campaign.js` changes are a few lines. The content-note card in `player.js` may conflict with a story-player restyle.
3. **The prototype is over budget whole-frame** (175-204k triangles high). The terrain-only numbers are unknown until
   S1b measures them; trimming may cost look.
4. **Rooftop input.** Parallax at a 48° camera and the portrait 90° yaw. The tap re-intersection must be tested at 390x844.
   Roof girls must stay readable (≤ 0.6).
5. **1-7's comb may trip the "meanders ≤ 2" or IoU tests.** The fallback is to reshape the teeth. Rooftops have their own
   fallback (U → `.`).
6. **Echo exemption scope.** It must stay limited to declared pairs between eras (≤ 3), or real traces slip through.
7. **Yuzuha.**
   - Moving her join off 4-2 touches shipped content (`ch4.yuzuha`, the v0.1.40 catch-up).
   - The legacy-stage catch-up must not grant twice.
   - The second-introduction read is flagged for the story reviewer.
8. **Pinned tests.** The achievements counts, gem caps and frozen ledger, the 32-scene count, the minibosses list, the
   enemy cap and the 40/59 stage counts are all deliberate guards. Each update must keep shipped rewards identical.
9. **Story lint scoping.** Allowing war words only in `g*` scenes must not loosen any romance or body word or
   `blood`/`bloody`.
10. **Pointer semantics.**
    - `nextStage` stays Act I first, so a veteran is not pulled back to 1-6. Act II discovery relies on the NEW badge
      (owner may prefer otherwise).
    - Profile ribbon pins sort Act II as "later" stages (`profileTrophies.js:198`).
11. **Untuned difficulty.** The Act II hpScale is the proposed starting table. Only the Easy gate is required now;
    Normal/Hard tuning belongs to the balance pass. Yuzuha arriving at 1-7 gives Act II players an early anti-air girl.
12. **Disk.** About 2.6 GB free with other workflows running. Remove `dist` after every build, keep screenshots small
    (WebP), and never copy the prototype's `docs/proto` images into the repo.
13. **Line numbers drift.** §1 is today's map; re-check before editing if another branch merges first.
