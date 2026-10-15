# Achievements expansion: metrics and cosmetics research

Oct 15, 2026. Research only: nothing in any repo or worktree was edited.

**Owner request:** "Can you add more achievements some will grant you like gear boxes alongside gems and maybe even some ribbons? Special ribbons will have a cool effect to them!! And maybe titles too?"

**Sources read:**
- live `/home/user/sakura-game` at `fddf01c` (v0.1.27), cited as plain `path:line`;
- train A `/home/user/wt-traina` HEAD `917027e`, cited `A:path:line`;
- social `/home/user/wt-social` HEAD `c731c6e`, cited `S:path:line`;
- `origin/feature/codex-modes` `6c7e0d0`, cited `CX:path:line`;
- `origin/feature/hero-rework`, cited `HR:path:line`;
- `origin/feature/roster`, cited `RO:path:line`;
- the Profile spec and mock, cited `SPEC:line`, `SQL:line`, `RULES:line` (`profileRules.sketch.js`) and `MOCK:file:line`.

Prototype and measurements: `proto/ribbons.html`, `tools/*.mjs`, screenshots in `proto/shots/` (all under this folder).

---

## 0. Findings that shape the design

1. **Gear boxes work as achievement rewards with no new code.**
   - `gearbox_<rarity>` ids are real items (`src/data/items.js:110-116`, `:168-174`).
   - `addItems` puts them in `profile.items` (`src/systems/inventory.js:36-42`, `:50-57`).
   - The Backpack opens them (`src/systems/gear.js:149-161`; UI `src/ui/screens/backpack.js:246`, `:258`).
   - Two tests require every achievement reward to be a known item id: `tests/integration/consistency.test.js:86-91` and `tests/systems/items.test.js:67-68`. Gear boxes pass.
   - **Price anchors:**
     - Super Rare box: 180 gems in the Gem Shop (`src/data/shop.js:36`).
     - Bounty Exchange, in tokens: Rare 8, Super Rare 25, Mythic 80, Legendary 200 (`src/data/shop.js:55-59`).

2. **Ribbons and titles must NOT be reward ids.**
   - An unknown id given to `addItems` lands in `profile.items` (`inventory.js:40`).
   - On the next load, `migrateProfile` drops it (`src/systems/save.js:314`).
   - `migrationDropsData` then flags the whole save as `lossy` and triggers a backup notice (`save.js:448`, `:474`; `src/core/store.js:67-73`).
   - The two tests above would also fail.
   - **Fix:** honor ribbons and titles are fields on the achievement definition (for example `ribbon: {...}`, `title: '...'`). They are *derived from the claim* (`missions.achievements[id] === true`), which is exactly how the Profile spec derives titles (SPEC:335).

3. **New lifetime counters belong in `profile.missions.counters`.**
   - `migrateProfile` rebuilds the profile from a fresh one (`save.js:302-435`). Every older build therefore drops any top-level field or `stats` key it doesn't know (`stats` is rebuilt with 5 keys at `save.js:432`).
   - `missions.counters` is kept word for word (`cleanNumberMap`, `save.js:137-145`, `:238`).
   - `missions.achievements` keeps every truthy key, known or not (`save.js:237`), so claims of new achievements also survive an older tab and can never pay twice.
   - This is the rule the freeplay `fpm:` mark (`src/online/coop/rewards.js:225-237`, `:302`) and train A's `pg:`, `pot:`, `story:*`, `sl:` and `ss:` marks follow (`A:src/systems/patchGifts.js:5-9`, `:20`; `A:src/systems/potential.js:7-9`, `:31-32`; `A:src/systems/story.js:8-12`, `:46-50`).

4. **Eleven lifetime counters already exist, from account creation.**
   - `track()` adds every event to `missions.counters[event]` before it touches commissions (`src/systems/missions.js:67-80`, line 71).
   - So these counters are lifetime totals today: `battleWin`, `battleWinHard`, `pull`, `levelUp`, `gearReroll`, `sweep`, `kill`, `bossKill`, `login`, `spendCoins`, `dailyDone` (`src/data/missions.js:11`).

5. **Co-op progress is barely recorded.**
   - `applyCoopResult` adds sightings and per-enemy kills, plus `track('kill')` (`src/online/coop/rewards.js:71-87`).
   - It does not count battles or wins, it calls no `track('battleWin')`, and it does not add to `stats.kills` or `bossKill`.
   - Co-op wins therefore need a new counter.
   - The kill metric of today's achievements (`profile.stats.kills`, `missions.js:228`) silently excludes co-op kills. `missions.counters.kill` includes them.

6. **Profile card limits on ids (no SQL change needed if respected).**
   - Title ids must match `^[a-z][a-z0-9_]{0,23}$`, i.e. at most 24 characters (`RULES:30`, `SQL:135`, `:148`).
   - An achievement pin is `ach:` plus at most 32 characters (`RULES:34`, `SQL:193`).
   - Viewers show unknown ids as nothing (SPEC:453).
   - The card has no field for honor ribbons. Its key whitelist is `v fav ban frm ttl units med fp st` (`SQL:146`, `RULES:98`), and `med` is `a r pins` (`SQL:185`).
   - Honor ribbons can be shown publicly today only as pinned `ach:<id>` plaques.
   - Adding a ribbon count or a ribbon list means amending `valid_profile_card`. That file has **not been pasted yet** (SPEC:56, :610), so amending it now costs one edit plus the parity tests (§2.1).

7. **The word "ribbon" already means two other things.**
   - It is a gear slot (`src/data/types.js:233`; `save.js:50`; gear box text "charm, ribbon or shoes", `items.js:172`).
   - It is a Codex *mode ribbon*: 800 of them, counted as "Ribbons 150/800" on the profile mock.
   - Achievement ribbons need a distinct name: **"Honor Ribbons"** in the UI, and a code namespace that doesn't say just `ribbon`.

8. **Kid-safety flags in the existing data.**
   - Under Profile spec R5 (SPEC:36), every claimed achievement name becomes a title. That would make **"Gambler's Eye"** (`src/data/missions.js:77`) a public title. Rename it or exclude it.
   - Recruit-count achievements (`a_pulls_*`) are already excluded as a spending signal (SPEC:335, :726). The same exclusion should apply to Potential (dupes from recruits) and to any gem-spend metric.
   - Friend-count and DM-based goals should not exist: they push kids to add strangers.

9. **Performance budget today, measured.**
   - The live Achievements tab runs **0 infinite animations**: 30 rows, 4 on screen at 844×390 and 7 at 1280×720 (`tools/achTab.mjs` against the live `dist` build, `fddf01c`).
   - The profile mock runs **5** (2 UR rings and 3 UR letter shimmers) at both viewports (`tools/countAnims.mjs`).
   - The lobby runs 12 petal animations (`src/ui/screens/lobby.js:103-104`, `src/ui/styles/meta-a.css:384`).

10. **Ribbon effect cost, prototyped and measured (§3).**
    - CSS transform/opacity effects (conic ring, mask-clipped sheen, glints) cost about 10-45 ms of main thread per second for 40 ribbons at 4× CPU throttle, with 0 paints.
    - An animated SVG gradient (SMIL) cost about **1,070 ms/s with 1,230 paints/s** and keeps moving under reduced motion. Never use it.
    - Paused animations keep their compositor layers. In a 150-row list, layers went from 1,595 to 76 only when off-screen ribbons got `animation: none`.

---

## 1. Metrics inventory

**Status key:**
- **LIVE**: in v0.1.27 (`fddf01c`).
- **A**: train A (v0.1.28, in testing).
- **S**: social (next).
- **CX**: Codex modes branch.
- **later**: hero-rework, potential (P1-P6), roster, chika.

**Retro** means the metric can be computed from the save as it already is, so players get credit for past play.

### 1.1 How achievements read metrics today

- **Definition:** `{ id, name, desc, metric, goal, rewards, param? }`, built by the `A()` helper (`src/data/missions.js:43-46`). There are 30 achievements (`:55-79`), totalling 7,070 gems and 18 recruit-ticket pulls (`docs/ECONOMY.md:52`).
- **Progress:** `metricValue(profile, a)` is a `switch` over 12 metric names (`src/systems/missions.js:216-234`). It is recomputed on every call; nothing is cached.
- **Claim:** `m.achievements[id] = true` (`missions.js:253`). No timestamp. Note that `cleanMissions` rewrites any truthy value to `true` (`save.js:237`), so a stored claim time would come back as `true` after one load.
- **Callers:**
  - lobby notice badge: `src/ui/screens/lobby.js:44`
  - Commissions tab badge: `src/ui/screens/commissions.js:73`
  - the list: `commissions.js:210-266`, which renders every row at once (`:236-263`) with a generic trophy icon (`:238`)
  - F2P chart: `missions.js:346`, `:353`. It counts gems and tickets only, so gear boxes from achievements will not appear in that chart.
- **Cost:** with 100+ achievements and richer metrics (for example `campaignShowcase` over 40 stages), compute one metric snapshot per `achievementList` call instead of one per achievement.

### 1.2 Feature-by-feature inventory

| Feature (status) | Already tracked, and where | Retro? | New counters for richer achievements (key → where to increment) |
|---|---|---|---|
| **Campaign stages + medals** (LIVE) | `progress.stages[id] = { easy, normal, hard, nightmare, clears, bestWave? }`. Medal set on a win at `src/systems/rewards.js:131-137`; `clears` at `:136`, and sweeps add to it at `:198-199`. Metrics `stagesCleared`, `chapterClear`, `medals` at `missions.js:220-222`. Helpers in `src/systems/unlocks.js:40-56`, `:88`. 40 campaign stages, 8 chapters. | Yes | None for medal counts: all-Sakura in a chapter, all 4 medals on N stages, all Gold, and so on are derivable. A **flawless win** (`livesLeft === maxLives`, from `Sim.result()` at `src/sim/Sim.js:878-879`) is not recorded: add `flawless` in `applyBattleResult`'s won branch (`rewards.js:130-152`). Nightmare has 1 life (`types.js:182`), so restrict it to Easy, Normal and Hard. |
| **Battle stats per run** (LIVE) | `Sim.result().stats` carries `leaks`, `towersPlaced`, `upgrades`, `ultsUsed`, `cashSpent`, `damageByTower`, `towerUnits` and `heroLevel` (`Sim.js:111-113`, `:882-893`). **None of it is saved**: `applyBattleResult` reads only `kills`, `encountered`, `won`, `wavesCleared` and `livesLeft` (`rewards.js:85-161`). | No | `ults` (+= `stats.ultsUsed`), `upgradesBought` (+= `stats.upgrades`), and a small-squad win (`Object.keys(stats.towerUnits).length ≤ N` on a win, stored as `squadWin:<N>`), all in `applyBattleResult` after `rewards.js:121-123`. In co-op `stats` covers the whole room, so solo only. |
| **Wins / battles / kills** (LIVE) | `stats.battles`, `stats.wins`, `stats.kills` (`rewards.js:121-123`; solo freeplay adds kills at `src/systems/freeplayRewards.js:96`). `counters.battleWin` (`rewards.js:151`), `counters.kill` (solo `:156`, co-op `coop/rewards.js:84`, `:275`), `counters.bossKill` (boss + miniboss, solo `:117`, `:157`; solo freeplay `freeplayRewards.js:89`, `:97`). | Yes | Use `counters.kill` for lifetime kills: it is the only one that includes co-op. `stats.kills` does not. |
| **Bestiary** (LIVE) | `bestiary[id] = { seen, discovered, kills }` (`save.js:404-411`). Discovered only on a solo win (`rewards.js:101-107`) or a solo freeplay kill (`freeplayRewards.js:90-94`). Per-enemy kills from every mode (`rewards.js:114`, `coop/rewards.js:58-59`). Metric `bestiaryPct` (`missions.js:197-212`, denominator = enemies met in some stage). 78 enemies in 12 families (slime 15, goblin 8, orc 6, ghost 5, ghoul 7, oni 7, lizard 4, construct 7, beast 4, fae 5, plant 5, dragon 5); 4 minibosses and 7 bosses. | Yes | None. Per-family discovery ("Every slime colour"), per-boss kill counts ("Defeat the Grave Lych 10 times" = `bestiary.grave_lych.kills`) and the freeplay-only bosses (`fp_foundry_titan`, `fp_gloom_regent`, `fp_hyakki_daimyo`, `fp_eclipse_wyrm`) are all derivable. Note the `fp_*` bosses are not in the % denominator. |
| **Recruits** (LIVE) | `gacha.totalPulls` (`src/systems/gacha.js:48`), `stats.pulls` (`:102`), `counters.pull` (`:103`), `recruitPoints` (`:49`). `gacha.history` holds the last 100 only (`gacha.js:13`, `:101`; `save.js:351-354`). Sparks are marked in history (`gacha.js:121`). | Partly | Lifetime SSR pulls cannot be rebuilt (history is capped): `pullSSR` would go in `pull()` (`gacha.js:94-100`). **Recommend no new recruit achievements and no recruit titles** (spending signal, SPEC:726). "Own N students" (`unitsOwned`, `missions.js:227`) is fine. |
| **Units: levels, breakthrough, awakening, UR** (LIVE) | `units[id] = { level ≤ 60, breakthrough ≤ 5, awaken ≤ 5, gear, favorite }` (`save.js:147-163`). `counters.levelUp` (levels gained, `src/systems/progression.js:113`). Breakthrough (`:200-206`) and awakening (`:246-253`) only track coins spent. UR = SSR at ★5, display only (`src/ui/rarity.js:32`). Metrics `maxLevel` and `maxAwaken` (`missions.js:225-226`). Account level is derived (`src/ui/components.js:118-138`). | Yes (state-based) | None: "N girls at Lv 60", "all breakthroughs on one girl", "first UR", "3 URs" and "N stars in total" all derive from `profile.units`. `accountLevel` lives in the UI layer; move it to systems before a metric uses it (systems must not import `ui/`). |
| **Gear** (LIVE): upgrades +N, rarity, rerolls, salvage | Instances in `profile.gear[uid] = { slot, rarity, level 0-10, main, subs[≤4] with upgrades }` (`save.js:173-197`). `counters.gearReroll` covers both substat (`gear.js:246`) and Prism main-stat rerolls (`:275`); the metric is `gearRerolls` (`missions.js:230`). Enhancing (`gear.js:298-318`), salvage (`:335-344`; multi-salvage loops over it, `salvage.js:52-64`) and opening boxes (`gear.js:149-161`) record nothing. Drops add gear through `addGear` (`gear.js:135-143`, called from `rewards.js:56-63`). | Owned state only | `gearEnhance` (+1 per level, `gear.js:304`); `gearMaxed` when `gear.level` reaches 10 (`:304`); `salvage` (+1 in `salvageGear` at `:341`); `boxOpen` (+n, `gear.js:153-160`); `gear:<rarity>` = pieces ever obtained (`addGear`, `gear.js:141`, the single entry point for drops and boxes); `prismReroll` (`rerollMainStat`, `:275`). Owned state ("own a Legendary +10", "full Legendary set on one girl") is retro from `profile.gear`, but salvaged pieces vanish, so lifetime goals need the counters. |
| **Total Assault** (LIVE) | 3 boss stages (`boss-lych`, `boss-colossus`, `boss-ashwing`) using the same medal entry. Metric `bossClears` (`missions.js:231`). | Yes | None: "Sakura medal on every Total Assault boss" derives from medals. |
| **Clan boss** (LIVE, online) | Damage is submitted to the server (`src/ui/battle/controller.js:810-822`); nothing is kept locally. | No | `clanBossHit` (+1) and/or `clanBossDmg` (+= `counted`) after `submitBossDamage` resolves (`controller.js:819-822`). Server-side only today. |
| **Bounty arenas** (LIVE) | 5 arenas × 3 stages = 15 `resource` stages (`bountyArenas()`), medals plus `clears` (sweeps included, `rewards.js:198-199`). `counters.sweep` (`rewards.js:200`). Weekly double-drop event: `currentEvent` (`missions.js:291-305`); `out.eventBonus` is set at `rewards.js:146` but not counted. | Yes (runs, medals) | `eventWin` (+1 when `out.eventBonus`, `rewards.js:146`) for "Help out at 5 weekly events". Runs per arena = sum of `clears`. |
| **Tactical Challenge / endless** (LIVE) | Colosseum `progress.stages.challenge.bestWave` (`rewards.js:127`); old campaign-map endless bests (`src/ui/screens/challenge.js:32-36`). | Yes | None. |
| **Solo freeplay** (LIVE): Blossom, Tempest, Crimson Moon | Per stage and tier: `progress.stages[id].freeplayBest[tier]` (`save.js:370-374`; written at `coop/rewards.js:287-291` with `bestKey = 'freeplayBest'`, `freeplayRewards.js:80`). Tiers are in `src/data/freeplay.js:90-135`. | Yes | None for waves. "Defeat the Ashwing Matriarch on Crimson Moon" is retro from the `fpm:` marks (next row). |
| **Co-op freeplay** (LIVE) | `progress.stages[id].coopBestWave[tier]` (`save.js:366-369`). One-time milestones per tier: `w100`, `w150`, `matriarch` (title Ashwing Slayer / Crimson Slayer), `wyrm` (frame `eclipse`) (`coop/rewards.js:35-40`, `:293-308`), stored as `progress.freeplay.done` / `titles` / `frames` plus `missions.counters['fpm:<tier>:<id>']` (`:302`). Tokens for boss-rank kills, capped (`:282-284`). Finish vote: `src/ui/battle/freeplay.js:103`. | Yes | None for records. **Don't double-pay:** milestones already pay 50/100/200 gems (`coop/rewards.js:36-38`). An achievement on the same condition should give a ribbon or title, not the same gems again. `fpFinish` (a run ended by an agreed Finish, `result.finished`, `Sim.js:899`) would go in `applyCoopFreeplayEnd` (`coop/rewards.js:259`) if wanted. |
| **Co-op battles** (LIVE) | Only kills and sightings (`coop/rewards.js:71-87`). Rooms: `src/online/coop/session.js:140` (`openSession`, `isHost`); last room `src/online/coop/lastRoom.js:32`. | **No** | `coopPlay` (+1) and `coopWin` (+1 when `result.won`) inside `applyCoopResult` (`coop/rewards.js:71-87`). Freeplay banks its clear through `applyCoopClear` → `applyCoopResult(won:true)` (`:99-105`), guarded once per battle by the ledger (`:121-124`), so one increment there covers normal and freeplay wins without double counting. Hosting is not worth a counter (trivial, and it pushes room-making). |
| **Codex modes** (CX) | Ribbons in `progress.stages[id].modes['<diff>:<mode>'] = true` (`CX:src/systems/rewards.js:155-163`; sanitizer `CX:src/systems/save.js:295-303`, `:378-381`). Nightmare × Last Petal is earned with the Nightmare medal (`CX:rewards.js:181-186`; `CX:src/systems/unlocks.js:72-79`). Five ribbon modes (`CX:src/data/modes.js:28`, `:31`). Gems per ribbon are 0 in v1 (`CX:rewards.js:20`). Co-op mode wins pay drops but **write no ribbons** (`CX:src/online/coop/rewards.js:78-81`). Map rules: 15 rules placed per stage (`CX:src/data/rules.js`, `STAGE_RULES`). | Yes, from the CX save | None. Use the helpers: `modeRibbons`, `ribbonCount` (perfect stage = `have === 20`), `chapterRibbons`, `stageShowcase`, `campaignShowcase` (`CX:unlocks.js:63-141`, §2.2). Per-mode totals and "every Last Petal ribbon in chapter 7" derive from these. Map-rule goals ("Clear every Lunar Eclipse stage on Hard") derive from `STAGE_RULES` × medals. Live `migrateProfile` drops `modes` today (SPEC:442), so no ribbon achievement before CX merges. |
| **Potential** (A: M0 counting; later: P1-P6 passives) | `units[id].dupes`, Potential = `min(6, 1 + dupes)` (`A:src/systems/potential.js:46-48`). Shadow `missions.counters['pot:<id>']` and `pot:at` (`:31-32`, `:56-60`). | Yes | None. **Recommend no Potential achievements or titles**: it is driven by recruit duplicates (a spending signal). |
| **Hero rework** (later) | Heroes cost 0 to deploy and level 1-25 inside a battle (`HR:docs/specs/HERO_REWORK.md:30`, `:83`). No new save field (`:39`, `:558`). `Sim.result().stats.heroLevel` already exists live (`Sim.js:891`). | n/a | `heroMax` as a max-record (the highest in-battle hero level) in `applyBattleResult`, solo. "Your hero reached Lv 25" lands with the rework. Today `heroLevel` means something else, so don't ship a hero-level achievement before it. |
| **Story / Captain's Journal** (A) | `profile.story` with `lessons[id].claimed` (12 lessons, `A:src/data/story/lessons.js:20`) and `seen` scenes, mirrored as `sl:<lesson>` and `ss:<scene>` marks (`A:src/systems/story.js:46-50`, `:177-185`). | Yes (A) | None: "Read every lesson" = all 12 `sl:` marks; "Read chapter 3's story" = its `ss:` marks (`chapterScenes`, `A:src/data/story/index.js:49`). Legacy saves have `story.legacy` (`A:story.js:87-89`) and never saw the opening, so don't make the opening an achievement. |
| **Battle saves** (A) | `profile.battleSaves[slot]`, at most 5 (`A:src/systems/battleSave.js:19`, `:32`). Saved runs roll fixed drops (`A:src/systems/rewards.js:96`). | n/a | Low value as a goal (saving is a convenience). Skip. |
| **Patch gifts** (A) | `patchGifts[noteId]` plus `pg:` marks (`A:patchGifts.js:46-65`). | Yes | Skip: a log-in reward, not an accomplishment. |
| **Login / commissions** (LIVE) | `counters.login` = days the game was opened (`missions.js:54`). `login.streak` = total calendar check-ins; misses don't reset it (`missions.js:186`). `counters.dailyDone` = days with every daily claimed (`missions.js:121`). Weekly completions are not counted. | Yes | `weeklyDone` (+1 when all weeklies are claimed, in `claimMission`, `missions.js:112-123`). Prefer cumulative goals ("Check in on 30 days") over streaks: no-pressure, kid-friendly. |
| **Spending coins** (LIVE) | `counters.spendCoins` (levels, gear, shop: `progression.js:114`, `gear.js:247`, `:316`, `src/systems/shop.js:92`). | Yes | Fine as a goal (coins are earned, not bought). |
| **Social: friends, DMs, blocks, reports** (S) | Server-side only. The save holds only the donation ledgers. | No | **Don't make achievements** for friend counts, messages or invites (pushes kids to add strangers). |
| **Clan donations** (S) | `profile.social.donated` keeps only the last 50 keys (`S:src/online/socialSave.js:7`, `:14-17`). Finalized at `S:src/online/donateLedger.js:77-87`. Donor reward is coins (`S:src/online/donateRules.js:26-28`). | No | `donate` (+1 per finalized donation) in `finalizeDonation` after `donated.push` (`S:donateLedger.js:84`). It is idempotent per key, so it can't double count. Fine as a "help your clan" goal; it gates on 72 h clan tenure (`S:donateRules.js:31`). |
| **Skins / outfits** (RO, later) | `units[id].skin`, `profile.skins` (shop and event outfits, none exist yet; `RO:src/systems/skins.js:1-7`). Roster bumps `SAVE_VERSION` to 3 (`RO:src/systems/save.js:15`). | Yes (RO) | None. "Dress 5 girls in their Sentinel Style" is derivable. Don't reward with purchasable outfits. |
| **Sandbox** (later) | No rewards by design. | n/a | Must never count. `applyBattleResult`'s practice guard (`rewards.js:90-93`) is the model to copy. |

### 1.3 Where to put new counters (one helper, three kinds)

- **Event counts:** call `track(profile, '<key>', n)` (`missions.js:67-80`). It already writes `counters[key]`, and keys that aren't commission events never touch commissions.
  - Do not add these keys to `TRACK_EVENTS` unless a commission uses them.
  - The Commissions "Go" table (`commissions.js:20-32`) ignores unknown keys.
- **Max records** (`heroMax`): add a small `recordMax(profile, key, v)` that writes `counters[key] = Math.max(old, v)`. It survives older builds the same way.
- **Prefixed keys:** use `ach:` for anything achievement-specific that is not an event (for example `ach:squad3`).
  - Existing prefixes are `fpm:`, `pg:`, `pot:`, `story:`, `sl:` and `ss:`.
  - Plain event names never contain `:`, so prefixed keys cannot collide with them.

**Retro-computable (no counter needed):** medals, chapters, Total Assault and Bounty medals, Bounty runs, best waves per tier, freeplay milestones (`fpm:`), bestiary discovery and per-enemy kills, owned units, levels, breakthroughs, stars and UR, owned gear by rarity and level, the 11 lifetime event counters, login days, daily completions, Codex ribbons and perfect stages (once CX ships), story lessons and scenes (once A ships).

**Moving targets to avoid:**
- `a_units_all` uses `UNITS.length` as its goal (`missions.js:74`). The roster merge adds 11 girls, so the goal jumps from 19 to 30 and unclaimed progress appears to go backwards.
- Prefer fixed numbers ("Own 15 students"), or snapshot "every girl" goals per release.
- `discoverableEnemies()` grows the same way (`missions.js:197-204`).

---

## 2. Cosmetics already planned

### 2.1 Sensei Profile (approved spec, not built)

**Titles** (`TITLES`, SPEC:329-338):
- `fp_ashwing` (Ashwing Slayer) and `fp_crimson` (Crimson Slayer), earned from `fpm:<tier>:matriarch` or the legacy strings.
- Plus **every claimed achievement id except `a_pulls_*`**, using the achievement's name (R5, SPEC:36).
- Stored and published as ids, never as text (SPEC:338).
- **Recommended change for the expansion:** make titles opt-in, with a `title` field on the achievement.
  - With 100+ achievements, R5 would turn every one into a title, "Gambler's Eye" included.
  - An opt-in field lets a title differ from the achievement name ("Monster Scholar" is fine; "Chapter 3 Complete" is not a title).
  - The title id can stay the achievement id, so no SQL change is needed.

**Frames** (`FRAMES`, SPEC:340-352):

| Frame | Earned from | Art | Ships |
|---|---|---|---|
| Default | always | | M1 |
| `ur` | owns a UR girl | reuses `ur-ring` | M1 |
| `eclipse` | `fpm:<tier>:wyrm` | placeholder SVG (`MOCK:profile.html:59-75`) | M1 |
| `sakura` | Sakura on 10 campaign stages | needed | M3 |
| `laurel` | Gold on all 40 | needed | M3 |
| `rosette` | any perfect stage | needed | with CX |

Frame ids are pattern-checked (`^[a-z][a-z0-9_]{0,23}$`), so achievement-earned frames need no SQL change (R6, SPEC:37).

**Banners** (SPEC:354-364):
- `academy:day|sunset|night`: free.
- `theme:<8 chapter themes>`: clear the chapter.
- `scene:<girl>`: own her.
- Pattern `^[a-z]{1,12}:[a-z0-9_-]{1,24}$` (`SQL:149`).
- An achievement could unlock an `ach:<id>` banner. The pattern allows it.

**Pins** (SPEC:174-196, R4 SPEC:35):
- One shelf of **4 plaques**, each `118×77` on PC and 2×2 on phone. The plaque art is **34 px**, not 64 (`MOCK:css/profile.css:183-195`, art at `:190`).
- Kinds: medal `8-5:nightmare`, mode ribbon `7-3:nightmare:laststand`, perfect stage `3-2:perfect`, achievement `ach:a_gold_40`.
- The achievement plaque icon is a trophy until "per-achievement badges in M3" (SPEC:189). **Honor ribbon art is exactly that M3 badge**, so the expansion can deliver it.

**Card format v1** (SPEC:395-416) and its validation:
- **Client, own save:** `cleanSensei` keeps only earned titles, frames and pins (SPEC:283-296).
- **Client, viewer:** `cleanViewedCard` resolves unknown `ttl`/`frm` to none and drops unknown pins (SPEC:449-468). The rule is "never show a string the client can't turn into its own text or art" (SPEC:451).
- **JS mirror:** `profileRules.js` (`RULES:30-34` patterns, `:98-99` key whitelist, `:122` pins).
- **Server:** `valid_profile_card` (`SQL:132-220`).
  - Keys ⊆ `v fav ban frm ttl units med fp st` (`SQL:146`).
  - `fav`, `frm` and `ttl` match the id pattern (`SQL:148`).
  - `med` ⊆ `a r pins`: `a` = 4 counts, `r` = 1-8 counts ≤ 9999, at most 4 pins matching the pin grammar (`SQL:181-194`).
  - `st` ⊆ `u s b k` (`SQL:213-219`).
  - Card ≤ 8192 bytes on the server and ≤ 6000 B of JSON on the client (SPEC:436-438).
- **Implications for honor ribbons and titles:**
  - **v1-compatible with no SQL change:** new titles (ids ≤ 24 characters, lowercase snake case); pinning an achievement as `ach:<id>` and drawing its honor ribbon on the plaque (the id must be ≤ 32 characters); new frames and banners.
  - **Needs a SQL and RULES amendment** (cheap now, since `20261016000000_profile.sql` has not been pasted): a public honor-ribbon count (for example `st.r`), or a list of up to N showcased honor ribbons (a new key such as `hr: [ids]`). Both also need `probe.mjs` and `parity.mjs` updated (SPEC:602-604).
  - Do not overload `med.r`: it is per-mode Codex counts clamped to ≤ 160 (SPEC:464).

### 2.2 Codex mode ribbon API (CX, `src/systems/unlocks.js`)

| Helper | Lines | Returns |
|---|---|---|
| `modesUnlocked(p, stageId)` | `CX:63-65` | true on a campaign stage after its first clear |
| `modeRibbons(p, stageId)` | `CX:72-79` | `{ 'easy:reverse': bool, … }`, 20 keys; `nightmare:laststand` is also true from the Nightmare medal |
| `ribbonCount(p, stageId)` | `CX:82-86` | `{ have, total: 20 }` |
| `chapterRibbons(p, chapterId)` | `CX:89-99` | `{ have, total }` |
| `stageShowcase(p, stageId)` | `CX:109-134` | `{ stageId, chapter, cleared, modesUnlocked, grid[mode][difficulty] = { earned, kind: 'medal'\|'ribbon', merged? }, medals: { have, total: 4 }, ribbons: { have, total: 20 } }` |
| `campaignShowcase(p)` | `CX:137-141` | `{ stages: [...40 showcases], medals: { have, total: 160 }, ribbons: { have, total: 800 } }` |

- Mode names: Reverse Route, Goblin Rush, Ironclad, Half Income, Last Petal (`CX:src/ui/text/modes.js:5-12`).
- Mode badge art is circle `modeIcon` (`CX:src/art/icons.js:239-256`).
- **There is no ribbon artwork in CX.** The ribbon state is a `check`/`star` ui glyph (`CX:src/ui/screens/stageModes.js:47-50`).
- The profile mock draws modes with the circle badges and a placeholder "All 20" rosette (`MOCK:profile.html:76-85`).
- The honor ribbon art built for achievements (§3) can also give mode ribbons and the Rosette frame a shared visual language.

### 2.3 Existing medal, ribbon and shine art and CSS

- **`medalIcon(difficulty, { earned })`** (`src/art/icons.js:189-215`):
  - 64×64 inline SVG: two ribbon tails over a gradient disc with a star, or a blossom for Sakura.
  - A dashed grey placeholder when not earned.
  - Gradient ids `md-<medal>-g` are shared by every copy (`:205`). Identical copies are harmless, but a hidden first instance can break later references (risk noted in §3.4).
  - Helpers: `starPoints`, `sparklePath`, `blossom`, `linGrad` (`src/art/svgUtil.js:94`, `:105`, `:117`, `:125`).
  - Every icon is wrapped by `icon64` (`src/art/icons/items.js:10-13`).
- **Generic badge:** `badge(kind, key, color, shape)` (`src/art/icons.js:105-111`) for circle, hex, shield and drop shapes. `uiIcon('trophy')` is the current achievement icon (`icons.js:223-227`, `commissions.js:238`). The achievement icon tile CSS is at `src/ui/styles/meta-a.css:954-960`.
- **UR rainbow** (`src/ui/styles/ur.css`), which is the house pattern for "special" effects:
  - The **ring** is a static mask with a conic rainbow turning inside it (`transform: rotate` only, `ur.css:21-35`).
  - **Glints** are clip-path four-point stars animated on opacity and transform (`:38-56`).
  - The **letters' shimmer** is the only painted motion: a `background-position` slide on text (`:59-69`).
  - A **light sweep** on big frames uses transform (`:83-89`).
  - Many tiny minis use a **still** rainbow edge (`:232-233`).
  - The cost rationale is written down at `ur.css:4-9`.
  - Helpers: `urRing`, `urSparkles`, `urBadge`, `applyUrFrame` (`src/ui/rarity.js:53-76`).
- **Painted shimmers elsewhere** (single elements only): the freeplay wave pill's `background-position` flow and shine (`src/ui/styles/battle.css:722-748`).
- **Pulses:** `ma-dot-pulse` and `ma-glow-pulse` (`meta-a.css:26-27`, `:973-974`).
- **Lobby petals:** 12 elements on transform (`lobby.js:103-104`, `meta-a.css:384-387`).
- **Train A additions:** the `us-shimmer` skeleton (`A:src/ui/styles/unit-info.css:232-236`) and the coach ring and pulse (`A:src/ui/styles/coach.css:22`, `:120`, `:131`).

### 2.4 Reduced motion in the codebase

- **Sources:** the system preference `prefers-reduced-motion: reduce`, and the in-game Settings / pause-menu "Reduce motion" (`DEFAULT_SETTINGS.reduceMotion`, `save.js:41`; `src/ui/battle/pauseMenu.js:97`). The in-game setting is mirrored to `<html data-reduce-motion>` by `applyMotionPreference` (`src/ui/components.js:163-171`).
- **Global rule:** `html[data-reduce-motion] *` shortens every animation to 1 ms with 1 iteration (`src/ui/styles/base.css:368-375`). The comment at `:373-374` explains why: an infinite animation squeezed to 1 ms strobes.
- **Consequence:** every looping effect must set an explicit `animation: none !important` under **both** the media query and the attribute, as `ur.css:236-249` does. That rule keeps the rainbow and the glints visible but still, and hides the sweep.
- **Per-screen variants:** `meta-a.css:711-712`, `:1167-1171`; `meta-b.css:28-31`; `battle.css:749-751`, `:786-788`; `title.css:108-109`; `A:coach.css:131`; `A:hold.css:29`; `A:unit-info.css:484-489`.
- **JS-driven motion** checks both sources: `src/ui/screens/title.js:82`, `src/ui/screens/recruit.js:287`.
- **SMIL ignores all of the above** (measured, §3.2).

### 2.5 Animated elements and phone constraints (measured)

| Screen | Infinite animations at once | Source |
|---|---|---|
| Live Achievements tab (dist `fddf01c`) | **0**. 30 rows, all built at once; 4 on screen at 844×390 (row 66 px, icon 40 px), 7 at 1280×720 (row 72 px). Rows carry 76 inline SVGs. | `tools/achTab.mjs`, `proto/shots/live-achievements-*.png` |
| Profile mock, own and visit, both viewports | **5** (2 `ur-spin` rings, 3 `ur-shimmer` letters) | `tools/countAnims.mjs` |
| Profile worst case (8 UR girls in the showcase plus a UR favorite) | about 8 rings + 9 letter shimmers ≈ 17. The letters are painted, the rings are compositor. | derived from the mock structure (`MOCK:profile.html:29`, `:91`) |
| Lobby | 12 petals + background shafts and motes | `lobby.js:103-104` |

**Budget for honor ribbons:**
- **Achievement list:** at most **6 ribbons animating at once** (only those on screen). 4 rows show on a phone and 7 on PC, so the cap is never visible to players.
- **Profile:** at most **4 animated pins** (the shelf).
- **Detail view:** one large animated ribbon.
- Everything else is static.

---

## 3. Special ribbons: rendering that is cheap and crisp at every size

### 3.1 The prototype

`proto/ribbons.html` draws one honor ribbon as a 64×64 inline SVG: two tails, a 22-pleat rosette, a centre disc with a sakura emblem, and a highlight.

- **Tiers:** bronze, silver, gold, sakura and prism.
- **Effects:** CSS layers clipped to the ribbon's silhouette by a CSS `mask` built from the *same* paths as a `data:` SVG, so the effect can never spill outside the art.

**Techniques compared** (screenshots `proto/shots/sheet.png`, `sheet-reduced.png`, `sheet-os-reduced.png`):

| Effect | How it works |
|---|---|
| **sheen** | A soft white band on a `::before` element slides across on `transform` |
| **ring** | A conic rainbow turns inside the pleat ring only (evenodd mask), like `ur-ring` |
| **glints** | 2 four-point stars on `opacity` and `transform`, like `ur-sparkles` |
| **combo** | ring + sheen + glints |
| **smil** | `<animateTransform>` on an SVG `gradientTransform` |
| **canvas** | 10 petals drawn on a `<canvas>` with a `requestAnimationFrame` loop, paused when off-screen or hidden |

### 3.2 Measurements

**Setup:**
- Chromium headless, DPR 2, CPU throttled 4× (a mid-range phone).
- 4 s window after a 2.5 s warm-up, median of 3 runs.
- Other jobs share this machine, so read the numbers as relative.
- Scripts: `tools/ribbonBench.mjs` (results in `proto/shots/bench.json`), `tools/extraBench.mjs`, `tools/layerCount.mjs`, `tools/smilReduced.mjs`.

| Case | Running anims | Main thread ms/s (runs) | Style / layout ms/s | Paints/s |
|---|---:|---:|---:|---:|
| 40 static ribbons, 40 px | 0 | 1 (1/1/1) | 0 / 0 | 0 |
| 40 × sheen | 40 | 11 (6/17/11) | 0 / 0 | 0 |
| 40 × ring | 40 | 16 (17/13/16) | 0 / 0 | 0 |
| 40 × glints | 80 | 45 (45/15/47) | 0 / 0 | 0 |
| 40 × combo | 160 | 21 (66/14/21) | 0 / 0 | 0 |
| **40 × SMIL gradient** | (SMIL) | **1,066** (0*/1109/1066) | 80 / 102 | **1,230** |
| 4 × combo, 64 px (pin shelf) | 16 | 10 | 0 / 0 | 0 |
| 1 canvas, 160 px (~52 fps loop) | 0 | **232-403** | 0 / 0 | n/a |
| 40 × combo, reduced motion | 0 | 1 | 0 / 0 | 0 |

\* One SMIL run read 0, apparently a stalled SMIL timeline in that run. The two others agree.

**Compositor layers** (844×390, a list of 150 rows):

| Case | Layers |
|---|---:|
| static | 4 |
| combo on every row | **1,595** (1,221 drawing) |
| combo, off-screen rows paused (`animation-play-state: paused`) | **1,595** (pausing frees nothing) |
| combo, off-screen rows set to `animation: none` (IntersectionObserver toggles `.live`) | **76** (24 running animations) |
| 4 × combo pin shelf | 51 |

**Reduced motion:** the CSS effects stand still under both the OS setting and `data-reduce-motion`. **SMIL keeps moving under both** (`tools/smilReduced.mjs`: "still moving = true").

**Crispness** (`sheet.png`):
- Vector art stays sharp from 40 to 160 px at DPR 2. Strokes of 1.2-1.6 units out of 64 give at least 1.5 device px at 40 css px.
- The **sheen is invisible at 40 px**. At 34-40 px only the ring and glints read.
- The rainbow ring reads well at every size.
- Canvas petals look good only at 160 px.

### 3.3 Recommendation by size

| Where | Size | Static ribbons | Special ribbons |
|---|---|---|---|
| Achievement row | 40 px (the current `.ma-ach-icon` is 40 px, `meta-a.css:954`) | inline SVG, no motion | **ring** (or 1 glint for non-rainbow specials). Only while on screen: an IntersectionObserver adds `.live`; off-screen gets `animation: none`, never `paused`. Cap 6 live. No sheen (invisible at this size). |
| Profile pin plaque | **34 px today** (`MOCK:css/profile.css:190`). At 64 px only if the plaque is redesigned. | same | at 34 px, as a row (ring or 1 glint). At 64 px, combo (ring + sheen + 2 glints): 4 pins = 16 animations, about 10 ms/s, 51 layers. |
| Detail view (tap a ribbon or achievement) | 160 px | same | combo plus **CSS petals** (6-8 `<i>` on transform, the lobby petal pattern at `meta-a.css:384`), for about 0 main-thread cost. Use canvas only for many particles: one canvas, `requestAnimationFrame` gated by IntersectionObserver and `document.hidden`, capped at 30 fps, never in lists. |
| Claim moment | modal | n/a | a one-shot burst (like `ur-ascend`, `ur.css:141-185`): transform/opacity keyframes that end. Skipped under reduced motion. |

**Rules:**
1. Animate only `transform` and `opacity`. They run on the compositor: 0 paints and 0 style work measured.
2. Never use SMIL, animated SVG attributes, animated `filter`, or `background-position` slides on repeated icons. These repaint every frame, and SMIL also ignores reduced motion. The existing painted shimmers (`ur.css:59-69`, `battle.css:722-747`) are single elements and are fine as they are.
3. Clip effects with a CSS `mask` from the art's own paths (one `data:` URL per silhouette set once on `:root`), as the UR ring does with `mask-composite` (`ur.css:21-27`).
4. Render each ribbon at its target size. Don't `transform: scale()` a small one up: layers raster at their own size and blur.
5. **Off-screen means `animation: none`.** Paused animations kept about 10 layers per ribbon in the prototype.
6. The whole 30-row list is built at once today (`commissions.js:236-263`). With 100+ achievements, add category tabs or render in chunks. Static SVG rows are cheap (1 ms/s for 40), but DOM size and `achievementList` cost grow (§1.1).

**Kid-friendly special effects** built only from these primitives (names are suggestions, all original):

| Effect | Built from | Fits |
|---|---|---|
| **Prism** | the turning rainbow ring (shares the UR rainbow `--ur-rainbow`, `ur.css:13`) | UR / collection goals |
| **Sakura Drift** | pink glints at 40 px; CSS petals in the detail view | medals and Sakura goals |
| **Starlight** | navy disc with 2-3 twinkling glints | freeplay and Crimson Moon / Eclipse goals |
| **Sunrise** | a gold sheen pass (64 px and up) plus one glint at 40 px | campaign completion |

### 3.4 Reduced motion, ids and other details

- **Reduced motion:** mirror `ur.css:236-249` under both `@media (prefers-reduced-motion: reduce)` and `html[data-reduce-motion]`:
  - `animation: none !important` on every looping part;
  - hide the sheen and petals;
  - keep the rainbow ring and the glints visible but still (`opacity: 0.9`);
  - stop and hide the canvas: JS checks `matchMedia` and `settings.reduceMotion`, as `src/ui/screens/title.js:82` does.
  - The prototype implements exactly this (`proto/ribbons.html`, the reduced-motion block).
- **SVG gradient ids:**
  - Give every tier and fx variant its own id prefix, like `md-<medal>-g` (`icons.js:205`).
  - **Risk to test:** a gradient referenced by `url(#id)` resolves to the first element with that id in the document. If that first copy sits in a `display:none` subtree (a closed tab, a hidden sheet), browsers may fail to paint the later copies.
  - Mitigation: suffix ids per instance, or move the colours to CSS (`fill: var(--rb-a)`).
- **Static and special share one SVG.** The effect layers are siblings. A ribbon can be upgraded (for example "special after claiming all of a category") without new art.
- **Data shape** (suggestion for the list designers):

  ```js
  { ..., ribbon: { tier: 'gold', fx: 'prism' | 'sakura' | 'starlight' | 'sunrise' | null }, title: 'Monster Scholar' | null }
  ```

  - **Earned when:** `missions.achievements[id]` is true.
  - **Pinned as:** `ach:<id>` (no SQL change).
  - **Id length:** keep ids ≤ 24 characters so any of them can also be a title id (`RULES:30`).

---

## 4. Files produced

- `docs/specs/achievements/research-metrics-cosmetics.md`: this report.
- `docs/specs/achievements/proto/ribbons.html`: the ribbon art and effects prototype.
  - `?bench=<static|sheen|ring|glints|combo|smil|canvas>&count=N&size=S[&list=1][&io=1][&rm=1]`
- `docs/specs/achievements/proto/shots/`:
  - `sheet.png`, `sheet-reduced.png`, `sheet-os-reduced.png` (+ `-fx` crops);
  - `bench.json`;
  - `live-achievements-844x390.png`, `live-achievements-1280x720.png`.
- `docs/specs/achievements/tools/`:
  - `countAnims.mjs` (profile mock animation count);
  - `achTab.mjs` (live Achievements tab rows and animations; needs the live `dist` served on port 8765);
  - `ribbonBench.mjs`, `extraBench.mjs`, `layerCount.mjs`, `smilCheck.mjs`, `smilReduced.mjs` (effect cost);
  - `sheetShots.mjs` (screenshots).
- `docs/specs/achievements/count.mjs`: data counts (stages, enemies, units, achievement totals).
