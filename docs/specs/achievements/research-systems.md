# Achievements expansion: systems research

Scope: how achievements and other once-per-account rewards work today, end to end. The goal is to add many more achievements that pay gems, gear boxes, ribbons (special ones animated) and titles without a double payout.

Unless a line says otherwise, paths are in the live repo `/home/user/sakura-game` (v0.1.27, `fddf01c`). Other prefixes:
- **TA:** train A (`git -C /home/user/wt-traina show HEAD:<path>`, `917027e`).
- **SO:** social (`/home/user/wt-social` HEAD `c731c6e`).
- **CX:** `origin/feature/codex-modes` (`6c7e0d0`).
- **PS:** the profile spec (`scratchpad/profile/SPEC.md` and `scratchpad/profile/20261016000000_profile.sql`).

Two probe scripts check the save behaviour directly against the live code (read-only imports):
- `scratchpad/achievements/_sys/probe-save.mjs`
- `scratchpad/achievements/_sys/probe-data.mjs`

Their output is quoted below.

---

## 0. Short answers

1. **An older build keeps unknown achievement ids and unknown numeric counters.**
   - `cleanMissions` copies every truthy `missions.achievements[k]` as `true` (`src/systems/save.js:237`).
   - It copies every finite numeric `missions.counters[k]` (`save.js:137-145`, `:238`).
   - Both lines have been in the code since the first full build (`f3bbe0f`, Oct 5). The same lines are in TA (`save.js:254-255`).
   - The probe confirms it: `a_future_xyz: true` and `'ach:a_future_xyz': 1` survive `migrateProfile`. A `true` boolean counter and an object counter are dropped. The string `'7'` becomes `7`.
2. **An older build drops everything else that is new.** Specifically:
   - unknown top-level keys: `migrateProfile` builds a fresh profile and copies only whitelisted fields (`save.js:302-436`);
   - unknown item ids: `save.js:314` keeps only `ITEMS` ids, and `migrationDropsData` then flags the save as `'lossy'` with a backup modal (`save.js:444-450`);
   - unknown fields inside a stage entry (`save.js:358-376`), for example CX's `modes`;
   - unknown reward ids inside mail letters (`save.js:258`, `:276`).
3. **So a new achievement can pay twice only if its "claimed" marker lives outside `missions.achievements` / `missions.counters`.** If the marker is `missions.achievements[id] = true` (what `claimAchievement` already does, `src/systems/missions.js:253`), no older build can erase it. Gems and gear boxes are known items, so they survive too.
4. **The real loss risk is for cosmetics, not for gems.** If a title or ribbon is stored in a new key (for example `profile.honors`), an older tab drops it while the claim survives in `missions.achievements`. The player then keeps "claimed" but loses the cosmetic, and nothing re-grants it.
   - Fix: never store cosmetic ownership. Derive it from the claimed achievement ids (and other surviving marks), the way the profile spec already derives titles from `missions.achievements` and `fpm:` marks (PS §3.1, SPEC.md:329-338).
5. **Gear boxes need no new code.**
   - `gearbox_<rarity>` are regular items (`src/data/items.js:167-174`).
   - `addItems` grants them (`src/systems/inventory.js:50-57`).
   - The player opens them from Backpack → Equipment (`src/ui/screens/backpack.js:243-266`, `src/systems/gear.js:149-162`).
6. **Ribbons and titles need a new reward channel.**
   - A reward entry today is `{ id, count }` and must be a known item. Tests enforce this (`tests/integration/consistency.test.js:81-89`, `tests/systems/items.test.js:60-69`). One test pins the exact `ITEMS` key list (`items.test.js:26`).
   - `addItems` accepts any id, so `addItems(p, [{id:'title_x'}])` would write `profile.items.title_x`. The next load drops it and shows the "lossy" backup modal.
   - Cosmetics must therefore be separate fields on the achievement def, not entries in `rewards`.

---

## 1. Data, metrics, claim flow, save

### 1.1 `ACHIEVEMENTS` shape (`src/data/missions.js:43-79`)

`A(id, name, desc, metric, goal, rewards, param?)` builds `{ id, name, desc, metric, goal, rewards: [{id,count}], param? }` (`:43-45`). A `gems(n)` helper sits at `:46`.

There are 30 entries. From `probe-save.mjs`:

| metric | count | ids |
|---|---:|---|
| stagesCleared | 1 | a_first_win (`:56`) |
| chapterClear (param = chapter 1..8, goal 5) | 8 | a_chapter_1..8 (`:57`): 100+25c gems; even chapters add a ticket |
| medals (param = difficulty) | 4 | a_gold_10, a_gold_40 (`'hard'`), a_sakura_1, a_sakura_10 (`'nightmare'`) (`:58-61`) |
| bestiaryPct | 3 | a_bestiary_25/50/100 (`:62-64`) |
| pulls | 3 | a_pulls_10/100/300 (`:65-67`) |
| maxLevel | 3 | a_level_20/40/60 (`:68-70`) |
| maxAwaken | 2 | a_awaken_1/5 (`:71-72`) |
| unitsOwned | 2 | a_units_10, a_units_all (goal = `UNITS.length`, dynamic, `:74`) |
| kills | 2 | a_kills_1000/25000 (`:75-76`) |
| gearRerolls | 1 | a_reroll_10 (`:77`) |
| bossClears | 1 | a_boss_3 (`:78`) |

- `wins` is a defined metric (`missions.js:229`) but no achievement uses it.
- Totals from the probe: **7,070 gems**, ticket_recruit ×8, ticket_recruit10 ×1 (18 pulls), book_rare 3, book_superRare 2, book_mythic 1, book_legendary 1, lock_pin 2, crown_oni 1, crown_dragon 1, star_fragment 40.
- These match `docs/ECONOMY.md:52` (7,070 / 18 / 76.9 recruits / "30 achievements").
- No achievement grants a gear box today.
- Every id matches the profile-card id pattern `^[a-z][a-z0-9_]{0,23}$`. The longest is 14 characters.

### 1.2 How each metric is computed (`src/systems/missions.js:216-234`)

Everything is computed live from profile state. Nothing is stored per achievement except the claim.

| metric | source | line |
|---|---|---|
| stagesCleared | `CAMPAIGN_IDS` with any difficulty boolean true (`cleared()` `:214`) | `:220` |
| chapterClear | the same, filtered by `id.startsWith(\`${param}-\`)` | `:221` |
| medals | `CAMPAIGN_IDS.filter(id => stages[id]?.[param])` (Standard difficulty booleans only) | `:222` |
| bestiaryPct | `bestiaryPercent()`: floor(discovered / discoverable × 100). Discoverable = enemies in any stage, cached (`:197-212`); 74 of 78 today | `:223` |
| pulls | `profile.gacha.totalPulls` | `:224` |
| maxLevel / maxAwaken | max over `profile.units` | `:225-226` |
| unitsOwned | `Object.values(profile.units).length` | `:227` |
| kills / wins | `profile.stats.kills` / `.wins` (`src/systems/rewards.js:121-123`; solo freeplay `src/systems/freeplayRewards.js:96`) | `:228-229` |
| gearRerolls | `profile.missions.counters.gearReroll` (lifetime counter written by `track`) | `:230` |
| bossClears | `STAGES` of kind `'boss'` cleared (boss-lych, boss-colossus, boss-ashwing) | `:231` |
| unknown metric | `0` (the achievement can never complete) | `:232` |

**Lifetime counters available today.** `track(profile, event, n)` adds to `missions.counters[event]` for every event, known or not (`missions.js:67-71`). Events reported now (`src/data/missions.js:11`): battleWin, battleWinHard, pull, levelUp, gearReroll, sweep, kill, bossKill, login (one per day, `missions.js:54`), spendCoins, dailyDone. Every build since `f3bbe0f` has counted them, so achievements on these are retroactive for veterans.

Other durable state a metric can read, all kept by every build:
- `stats.{battles,wins,kills,pulls,gemsEarned}` (`save.js:432`);
- `bestiary[id].kills` (`save.js:404-411`);
- `progress.stages[id]` difficulty booleans, `clears`, `bestWave`, `coopBestWave`, `freeplayBest` (`save.js:358-376`);
- `units[id].level/breakthrough/awaken/favorite` (`save.js:147-163`);
- `bond[id]` (`save.js:250-256`);
- the gear map (`save.js:321-344`);
- `redeemed` (`save.js:425`);
- the `fpm:` freeplay marks.

### 1.3 Claim flow

- **List:** `achievementList(p)` (`missions.js:237-244`) maps every def to `{ id, name, desc, progress: min(goal, metric), goal, rewards (copies), claimable: !claimed && progress >= goal, claimed }`. Claimed means `!!m.achievements[id]`.
- **Claim:** `claimAchievement(p, id)` (`missions.js:247-255`):
  - unknown id → `'unknown'` (`:250`);
  - already claimed → `'claimed'` (`:251`);
  - metric below goal → `'incomplete'` (`:252`);
  - otherwise it sets `m.achievements[id] = true` (`:253`), then calls `addItems(p, a.rewards)` and returns the normalized list (`:254`).
  - It is synchronous: the marker is set before the payout in the same tick, so it cannot double-pay inside one tab.
- **Setup:** `ensure()` creates every `missions` field lazily (`missions.js:16-29`).
- **Persistence:** the UI calls `store.commit('achievements')` (`commissions.js:228`, `:255`). That debounces `saveNow` by 150 ms (`src/core/store.js:89-98`). `beforeunload` and `visibilitychange→hidden` also save (`store.js:126-131`).

### 1.4 What the save holds

`profile.missions` (`save.js:53-65`, created at `:94`):

```
{ day, daily:{id:progress}, dailyClaimed:[], week, weekly:{}, weeklyClaimed:[],
  login:{lastDay,streak,claimedDays:[]}, achievements:{ [id]: true }, counters:{ [key]: number } }
```

Achievement progress is never stored, only the claim. `counters` already holds:
- lifetime event totals;
- once-per-account marks from other features:
  - `fpm:<tier>:<id>` (live, freeplay);
  - `pg:<noteId>` (TA patch gifts);
  - `pot:<unitId>` and `pot:at` (TA Potential shadow, TA `src/systems/potential.js:31-32`);
  - `story:new`, `story:ann`, `sl:<lesson>`, `ss:<scene>` (TA `src/systems/story.js:46-50`).

### 1.5 Cleaning and migration (`src/systems/save.js`)

- `createProfile()` (`:72-106`): a fixed key list. Missions come from `emptyMissions()` (`:94`). TA adds `patchGifts`, `battleSaves` and `story`, seeds `missions.counters` with `pot:*` and `story:new`, and moves the starter 10× ticket to a story mail (TA `save.js:77-120`).
- `migrateProfile(raw)` (`:302-436`):
  - starts from `createProfile()` and copies only known fields;
  - unknown units are dropped (`:318`);
  - unknown items are dropped (`:314`, allow-list `ITEMS[id] && category !== 'currency'`);
  - stage entries are rebuilt from known fields only (`:358-376`);
  - `progress.freeplay` is kept as `{done, titles, frames}` string lists (`:378-381`);
  - mail is cleaned through `cleanMail`, where reward ids must pass `isRewardId` (`:258`, `:261-286`);
  - `redeemed` is kept as a string list (`:425`);
  - `version` is set to `SAVE_VERSION = 2` (`:13`, `:434`).
- `cleanMissions(raw)` (`:222-240`): `achievements` keeps any key with a truthy value (`:237`). `counters = cleanNumberMap(raw.counters)` keeps any key with a finite number or numeric string (`:137-145`, `:238`). Neither list has a whitelist or a key cap.
- `migrationDropsData(raw)` (`:444-450`): true only for unknown units, unknown items or unreadable gear. Unknown achievements and counters are never "lossy".
- `loadSaveText` (`:462-478`) handles three cases:
  - newer `version` → a **fresh profile** with `backup: 'newer'`;
  - lossy → migrated with a backup;
  - corrupt → fresh profile.

### 1.6 What an older cached build does on save (exact)

Live `store.js` writes its in-memory profile wholesale with no revision check (`store.js:95-98`). The live build loads through `migrateProfile` (`store.js:63-76`). Combining the two:

| New-build data | Older build loads and then saves | Double pay? |
|---|---|---|
| `missions.achievements.a_new = true` | kept (`save.js:237`); inert, because `achievementList` iterates only its own `ACHIEVEMENTS` and `claimAchievement('a_new')` returns `'unknown'` (probe) | No |
| `missions.counters['xx:yy'] = 1` (number) | kept (`save.js:238`) | No |
| `missions.counters.k = true` or an object | dropped | — (never store marks as booleans) |
| gems or gear boxes granted by the claim | kept (`currencies`, known items) | No |
| new item id (e.g. `ribbon_*` as an `ITEMS` entry) | dropped, and the save is flagged `'lossy'` with a backup modal (`save.js:314`, `:448`; `main.js:102-107`) | The item is lost and a warning shows |
| new top-level key (`profile.honors`, `profile.sensei`, …) | dropped (probe: `honors_kept: false`) | Loss. It double-pays only if the claim marker lives there |
| new field in a stage entry (CX `modes`) | dropped (probe: `stage11` without `modes`) | Ribbons lost; CX pays 0 gems for them |

**Two-tab stale overwrite.** An old tab that loaded before the claim and writes later rolls back the whole profile: gems and the claim marker together. That is lost progress, never a double pay, because the profile is one JSON value written by one `setItem`. The guards against this exist only on newer builds:
- TA guards battle saves only (`stale` / `lostRunElsewhere`, TA `store.js` diff);
- SO adds a general `saveRev` guard (SO `src/core/store.js:1-13`, `:35`, `:102-115`).

An old live tab still overwrites everything.

**Do not bump `SAVE_VERSION` as a guard.** When an older build *loads* a newer-version save, it starts a fresh profile (`save.js:472`). If the backup fits, `holdSaves` stays false (`store.js:67-71`). `main.js:42` then commits `'app-start'`, and the fresh profile is written over the save. The real save survives only in `BACKUP_KEY`, and live has no restore UI (no use of `BACKUP_KEY` outside `save.js` and `store.js`). CX's plan to bump `SAVE_VERSION` if ribbon gems are ever enabled (CX `docs/specs/CODEX_MODES.md:290-291`) has this hazard. The `missions.counters` mirror is the safe pattern.

---

## 2. Once-per-account reward precedents

| Feature | Where it lives | Guard | Survives an older build? |
|---|---|---|---|
| **Achievements** | `missions.achievements[id] = true` set before `addItems` (`missions.js:253-254`) | the marker | Yes (`save.js:237`) |
| **Medal and first-clear gems** | `progress.stages[id][difficulty]` booleans; `newMedal` / `firstClear` computed before setting them (`src/systems/rewards.js:130-137`) | the booleans | Yes (`save.js:363`) |
| **Freeplay milestones** (co-op and solo) | `progress.freeplay.done` plus `missions.counters['fpm:' + tier:id] = 1` written together (`src/online/coop/rewards.js:301-302`). `freeplayRecords()` merges `fpm:` keys back into `done` on every read (`:221-234`); `MILESTONE_MARK = 'fpm:'` (`:237`). Solo goes through the same path (`freeplayRewards.js:80`). Tests: `tests/online/coopRewards.test.js:107-145` | the counters mark | Yes. The **titles and frames** themselves are display strings in `progress.freeplay.titles/frames` (`rewards.js:303-305`), and pre-0.1.27 builds drop that block. PS re-derives titles from the `fpm:` marks (SPEC.md:333-337) |
| **Patch-note gifts** (TA) | `profile.patchGifts[id] = true` plus `missions.counters['pg:'+id] = 1` (TA `src/systems/patchGifts.js:62-65`). `cleanPatchGifts` unions the marks back on load (`:46-51`); `markPatchGifts` re-writes marks (`:54-58`); hooked in TA `save.js:449-450` | either one | Yes (via `pg:`) |
| **Story lessons and welcome pull** (TA) | `story.lessons[id].claimed` plus `counters['sl:'+id]` (TA `story.js:400-411`). Welcome 10-pull: `story.welcome === 'pending'` AND the mail id not yet in `mail.delivered` (TA `story.js:322-340`) | marks plus `mail.delivered` | Yes |
| **Potential** (TA) | `units[id].dupes` plus a shadow `counters['pot:'+id]` (TA `potential.js:31-32`; `creditPotential` TA `save.js:471+`) | the shadow | Yes |
| **Beta gift and mail** | `deliverMail` refuses ids already in `mail.delivered` (`src/systems/mail.js:79-81`); `claimMail` flips `claimed` before `addItems` (`:127-134`); `ensureBetaGift` at app start (`main.js:41`, `mail.js:169-172`) | `delivered` and `claimed` | Yes for builds that have mail. A save with no `mail` becomes `legacy: true` (`save.js:262-265`). Mail **rewards must be known items** (`save.js:276`), so a cosmetic cannot be mailed |
| **Redeem codes** | `profile.redeemed` string list checked before paying (`missions.js:271-280`); the action code `RESET67` is `repeatable` (`data/missions.js:90`) | the list | Yes (`save.js:425`) |
| **Login, daily, weekly** | `missions.login.lastDay`, `dailyClaimed`, `weeklyClaimed` (`missions.js:112-123`, `:180-189`) | the lists | Yes |

The pattern for anything new: put a numeric mark in `missions.counters` (a short prefix plus the id). Optionally keep a richer block elsewhere that is re-derived from the marks on load. Achievements already have the equivalent in `missions.achievements`.

---

## 3. UI plumbing

### 3.1 Achievements tab (`src/ui/screens/commissions.js`)

- **Route:** `#/commissions?tab=daily|weekly|login|achievements|codes` (`:1`, `:17`), registered at `src/main.js:25`. The tab is remembered with `rememberParams` (`:84`).
- **Tab red dots:** `badges()` (`:66-76`) sets `achievements: achievementList(p).some(a => a.claimable)`. `tabs()` draws a plain `span.tab-badge` dot (`src/ui/components.js:245`).
- **Header** (`:216-233`): "Achievements", "`done/total` completed", and a **Claim all (n)** button (icon `trophy`, no `testid`). Claim all loops `claimAchievement` over the snapshot (`:222-227`), then:
  - `store.commit('achievements')`;
  - `showRewardsModal({ title: 'Achievement rewards', rewards: mergeRewards(all) })` (`:228-229`; `mergeRewards` `:268-272`).
- **Sort** (`:234`): claimable first, then unclaimed, then by progress ratio. There are no categories, filters, sections or paging.
- **Row** (`:237-262`), `div.ma-mission.ach(.ready|.claimed)`:
  - the same `uiIcon('trophy')` for every row (`:238`);
  - name, desc, progress bar and `progress/goal` (`:239-243`);
  - `rewardTiles(a.rewards, {size:46})` (`:244`);
  - action: "Done" check, a **Claim** button (no `testid`, unlike commissions' `claim-${id}` at `:154`), or a `NN%` label.
  - Claim → `claimAchievement`, `store.commit('achievements')`, `showRewardsModal({ title: a.name, rewards })` (`:252-257`).
- **Redraw:** the whole tab rebuilds on every claim (`redraw`). It also listens for `store` `'replace'` (`:102`).

### 3.2 Lobby and hub counts

- `commissionsNotice(profile)` (`src/ui/screens/lobby.js:37-50`): `ach` = the number of claimable achievements, folded into `any`, `ach` (bool) and `count`. It is used by:
  - the lobby **Tasks** shortcut: dot when `missions || ach`; opens the achievements tab when only achievements are claimable (`lobby.js:375`);
  - the **dock** Commissions dot (`lobby.js:529-536`);
  - the secretary lines, which never mention achievements (`lobby.js:296-307`);
  - the **Missions hub** Commissions tile ("In Progress" ribbon and dot, `src/ui/screens/missions.js:48`, `:75`).
- **Sensei level badge** (top-left): today it opens `commissions?tab=achievements` (`lobby.js:328`). PS changes it to open the Profile, with an "All achievements →" link (SPEC.md:71, :880).
- **Cost:** `commissionsNotice` runs `achievementList` up to 3 times per lobby render (`:296`, `:362`, `:529`). Each metric is O(stages ≤ 59) or O(units). Hundreds of achievements is still trivial, but caching it per render would be cleaner.

### 3.3 Reward popups, toasts and the results sheet

- **`showRewardsModal`** (`src/ui/screens/stage.js:162-174`) takes `{ title, rewards, gear, note, extra, actions }`:
  - `rewards` → item tiles with names (`tile()`, `:57-63`, → `itemTile` `components.js:373-391`);
  - `gear` → gear tiles;
  - **`extra` is any DOM node**. This is the ready seam for a "Title unlocked" chip or an animated ribbon in the same popup.
- **Cosmetic ids cannot go through tiles.** `itemTile` with an unknown id shows the fallback "?" art (`src/art/icons.js:58-69`) and the raw id as the name. Tapping it opens `showItemInfo` with "Owned: 0" and no sources (`components.js:394+`).
- **`rewardTiles`** (`stage.js:73-75`) is used by the rows.
- **`toast(message, kind, ms)`** (`components.js:353-360`) is used by TA patch gifts (TA `src/ui/lobby/notice.js:69-71`).
- **Battle results sheet** (`src/ui/battle/results.js`): the freeplay part already prints one-time milestones as text: "Title: Ashwing Slayer", "New profile frame" (`:348`). This is where a battle could announce "achievement complete" if wanted. Today it never mentions achievements.
- **Events screen** (`#/rewards`, `src/ui/screens/rewards.js:80-127`): the F2P income chart's one-time table includes an **Achievements** row computed from `ACHIEVEMENTS` (`missions.js:346`, `:353`). It updates itself, but `docs/ECONOMY.md:44-55` is hand-written and must be updated.

### 3.4 Audio claim reasons (`src/audio/economy.js`)

- `snapshot()` (`:5-22`) tracks coins, gems, the total item count, gearCount and gearLevels.
- `CLAIM_REASONS = {'missions','achievements','login','redeem'}` (`:24`). Commit reasons on that list play `eco.claim`, then gems, coins and item sfx staggered 120 ms apart (`:96-100`, `:39-49`). This fires through `installEconomy` (`:109-122`; wired in `src/audio/index.js:209-212`).
  - A gear-box reward bumps `items` and plays `eco.item`.
  - A cosmetic-only claim changes nothing in the snapshot, so it plays only `eco.claim`.
  - A "special ribbon" fanfare needs one of two changes:
    - a new reason (for example `'honor'`), added to `CLAIM_REASONS` or given its own `case` with a jingle such as `{ music: 'awaken' }` (`:57-59`);
    - or a snapshot field.
- TA's `'patch-gift'` reason (TA `notice.js:69`) is **not** in `CLAIM_REASONS`, so patch-gift claims are silent. This is an unrelated side note.
- Tests pin the reasons:
  - `tests/audio/economy.test.js:9-29`;
  - `tests/audio/manifest.test.js:102-105`. It lists every reason, including `'achievements'`, and checks that each sfx id exists in the manifest, so a new sfx id needs a manifest entry.

---

## 4. Tests that pin achievements

| Test | What it pins | Impact of new achievements |
|---|---|---|
| `tests/systems/missions.test.js:99-120` | `a_pulls_10` claim cycle (incomplete → claimable at 12 pulls, progress capped at 10 → ok → `'claimed'`); `a_bestiary_50` claimable at 50 % | Keep both ids and semantics |
| `tests/systems/missions.test.js:211-226` (F2P income) | recurring 28-day pulls stay in 70–80; `oneTime.length > 3`; `oneTimeTotals.pulls > 0` | Achievements are one-time, so more gems do not affect the 70–80 band |
| `tests/integration/consistency.test.js:81-89` | every `rewards[].id` of daily, weekly, login and achievements exists in `ITEMS` | Cosmetics must not go in `rewards`; `gearbox_<rarity>` is fine |
| `tests/systems/items.test.js:60-69` | the same for stages, shop, missions, login, achievements and codes | Same |
| `tests/systems/items.test.js:11-28` | `Object.keys(ITEMS)` equals an exact list (`:26`); `itemsByTab('enhancement')` has 40 entries (`:52-58`) | Adding ribbons or titles as items breaks this (and the old-build drop in §1.6) |
| `tests/systems/save.test.js` | missions defaults (`:22`, `:59-69`) | Additive fields are fine |
| `tests/online/coopRewards.test.js:107-145` | `fpm:` mirror behaviour, title strings `'Ashwing Slayer'` / `'Crimson Slayer'`, frame `'eclipse'` | Do not rename stored freeplay strings |
| `tests/audio/economy.test.js`, `tests/audio/manifest.test.js:102-105` | claim reasons and sfx ids | Add any new reason and sfx here |
| e2e `e2e/smoke.mjs:294-311` | Commissions daily claim and codes tab; achievements are not touched | New `testid`s on achievement Claim / Claim all would let e2e cover them |
| e2e `e2e/nav-back.mjs:482-496` | the Tasks shortcut and dock lead to `commissions` | Keep the route |

New tests the expansion should add:
- every new def has a unique id matching `^[a-z][a-z0-9_]{0,23}$` (the PS title and pin grammar);
- every metric is known (`metricValue` returns 0 for unknown metrics, `missions.js:232`), and every reward id is an item;
- every cosmetic id exists in its table;
- the derived cosmetic set survives a round trip through a save without `profile.<newkey>`;
- no achievement pays twice after `migrateProfile` of a save with the new block deleted (the coopRewards pattern at `:130-145`).

---

## 5. Item granting and cosmetics

- **Grant path:** `addItems(profile, rewards)` (`src/systems/inventory.js:50-57`) → `normalizeList` merges duplicate ids and drops counts ≤ 0 (`:13-22`) → `setCount`:
  - `coins` and `gems` go to `profile.currencies`, `recruitPoints` to `profile.gacha`;
  - **anything else** goes to `profile.items[id]` (`:36-42`), **without checking the id**;
  - gems also add to `stats.gemsEarned` (`:54`).
- **Item ids today** (`src/data/items.js:3-10`, `:133-191`):
  - `mat_<family>_<rarity>`, `book_<rarity>`, `crown_slime|iron|cog|oni|dragon`;
  - `dice_reroll`, `dice_prism`, `lock_pin`, `star_fragment`;
  - `gearbox_common|rare|superRare|mythic|legendary` (Plain / Sturdy / Ornate / Radiant / Celestial, `:110-116`);
  - `ticket_recruit`, `ticket_recruit10`, `ticket_ssr_select` (used from the Backpack);
  - `token_boss`, `token_bounty`, `coins`, `gems`.
- **Gear boxes:**
  - From stage drops they are opened at once (`rollStageDrops`, `src/systems/rewards.js:42-44`).
  - From the shop, mail or achievements they stay as `profile.items.gearbox_*`, and the player opens them in Backpack → Equipment (`backpack.js:257-266` → `openGearBox`, `gear.js:149-162`, commit `'gearbox-open'`, `backpack.js:246`).
  - Their art exists (`icons.js:48-49`).
  - "Where to get" shows achievement sources automatically (`inventory.js:164`). The existing gear-box note "Gear boxes open into real gear the moment they drop." (`inventory.js:168-170`) is only true for drops.
  - Keeping `claimAchievement` free of RNG (boxes go to the Backpack) keeps it pure and testable.
- **Cosmetics today:**
  - Freeplay **titles and frames** are display strings in `progress.freeplay.titles/frames` (`coop/rewards.js:303-305`). They are not items, not ids, and only shown on the results sheet.
  - Codex **mode ribbons** are booleans in `progress.stages[id].modes['d:m']` (CX `src/systems/unlocks.js:72-80`, saved by CX `save.js:295`, `:380`). They pay 0 gems (CX spec `:405`).
  - Profile titles and frames (PS) are **ids derived from progress**, never stored as owned lists (SPEC.md:329-351). `sensei.title` / `.frame` hold only the *equipped* id, re-validated against `earnedTitles(p)` / `earnedFrames(p)` on load (SPEC.md:283-292).
- **Can a reward carry a cosmetic today? No.**
  - A `{id,count}` entry must be an `ITEMS` id (tests, §4), and an older build drops unknown item ids and flags the save lossy.
  - Mail reward lists are filtered to item ids (`save.js:276`).
  - There is no reward "kind" field: every list is plain `[{id,count}]` (`inventory.js:3-4`).
  - **Recommendation:** add optional fields on the achievement def, outside `rewards`, for example `title: 't_<id>'` and `ribbon: { id, special: true }`. Compute `earnedTitles` / `earnedRibbons` from `missions.achievements` (plus `fpm:` marks).
  - Nothing new is persisted except the equipped choice (in `sensei`, per PS). Tests, the old-build drop and mail cleaning all stay untouched.

---

## Integration seams

1. **`src/data/missions.js` `ACHIEVEMENTS` (`:55-79`).** Append new defs; never rename or reuse ids.
   - Add optional `category`, `title`, `ribbon` (`{ id, tier, special }`) and `icon` fields. Keep `rewards` items-only; `{ id: 'gearbox_mythic', count: 1 }` works as-is.
   - Extend the `A()` helper (`:43-45`) or use a second helper for the extra fields.
2. **`src/systems/missions.js` `metricValue` (`:216-234`).** Add new metric cases, for example:
   - `counter` with a `param` event: login days, sweeps, coins spent, boss kills, daily-done days, battleWinHard;
   - `stats` (battles, wins, gemsEarned);
   - `bond`, `gearOwned` / `gearMaxLevel` / `gearRarity`, `enemyKills` (`bestiary[param].kills`);
   - `freeplayBest` (max over `freeplayBest` / `coopBestWave`), `freeplayMark` (`fpm:` key);
   - `ribbons` (CX `ribbonCount`, returning 0 until CX merges, as in PS §5.3);
   - `achievementsClaimed` (meta).

   `achievementList` / `claimAchievement` (`:237-255`) need no change apart from returning the new fields to the UI. If a "notify on complete" toast is wanted, add `achievementsJustCompleted(prev, next)` there, pure.
3. **Cosmetic derivation, a new module** (for example `src/systems/honors.js`): `earnedRibbons(p)` / `earnedTitles(p)` read `missions.achievements` (and `fpm:`). This plugs into PS's `src/data/profileArt.js` `TITLES` and `src/systems/profileTrophies.js`:
   - PS currently makes *every* achievement name a title except `a_pulls_*` (SPEC.md:36, :335). With an explicit `title` field, that rule becomes "achievements that declare a title".
   - Ribbon pins can use the existing `ach:<id>` pin grammar (PS SQL `:193`), so no server change is needed.
   - A separate public ribbon list would need a new card key: the SQL whitelists keys at `:146`.
4. **`src/systems/save.js`.** Nothing is needed if cosmetics are derived. If any new block is stored, follow the `cleanPatchGifts` / `markPatchGifts` pattern (TA `save.js:449-450`) with a numeric `missions.counters` mark. Never bump `SAVE_VERSION`.
5. **`src/ui/screens/commissions.js` `achievementsView` (`:210-266`).** Add:
   - categories or filter chips;
   - a per-row icon or ribbon art instead of the shared trophy (`:238`);
   - cosmetic chips next to `rewardTiles` (`:244`);
   - `testid`s on Claim / Claim all;
   - a cosmetic "unlocked" node passed through `showRewardsModal({ extra })` (`stage.js:162-170`).
6. **`src/ui/screens/lobby.js` `commissionsNotice` (`:37-50`).** Counts carry over automatically. Optionally add a secretary line for claimable achievements (`:300-302`).
7. **`src/audio/economy.js` (`:24`, `:50-101`).** Add a reason or case for special ribbons or titles (a jingle), and update `tests/audio/*`.
8. **`src/ui/battle/results.js` (`:348`).** An optional "achievement complete" line after a battle.
9. **Docs:** `docs/ECONOMY.md:44-55` / `:59-70` (one-time totals) and `CONTRACTS.md:566`, `:579-580`.
10. **Art:** ribbon SVGs belong next to `src/art/icons.js` (not `itemIcon`, which is for items only). Animated "special" ribbons must respect `settings.reduceMotion` (`save.js:41`; `applyMotionPreference`, `components.js:164`).

---

## Risks

1. **Storing cosmetic ownership in a new block** (`profile.honors`, `progress.ribbons`, …). An older tab erases it while the claim survives. The cosmetic is lost for good, or it pays twice if that block also holds the claim marker. Mitigation: derive from `missions.achievements`, or mirror to numeric `missions.counters` marks.
2. **Cosmetics as `ITEMS` or `{id,count}` rewards** break three things:
   - `items.test.js:26` and `consistency.test.js:86-88`;
   - older builds drop them and show the "lossy" backup modal on every load (`save.js:314`, `:448`);
   - mail strips them (`save.js:276`).
3. **The name "ribbon" is used three times.** It is a gear slot (`charm/ribbon/shoes`, `items.js:172`, `save.js:50`), the CX mode ribbon (800 per campaign, `med.r` on the card), and now the achievement ribbon. Pick a distinct player-facing name and id prefix for achievement ribbons, and keep the profile's "Medals & Ribbons" panel and pin grammar unambiguous.
4. **Renaming or reusing an existing id** (for example renaming `a_gold_40`) makes it claimable again (double gems) and loses its derived title. Ids are permanent.
5. **Dynamic goals and denominators:**
   - `a_units_all` uses `UNITS.length` (`data/missions.js:74`) and grows with the roster merge (19 units now);
   - `bestiaryPct` drops when enemies are added (74 discoverable now);
   - `a_gold_40` says "all 40" (stage doubling would make that untrue).

   A claim already made is safe, but an unclaimed "claimable" state can flip back to false. Use fixed numeric goals for new achievements.
6. **Retroactive burst.** Metrics are live, so veterans see dozens claimable on day one: a big lobby dot, a long Claim-all modal, and a large one-time gem jump (today 7,070 gems ≈ 59 pulls; the ECONOMY.md one-time total is 26,290). Budget the expansion explicitly.
7. **Old tabs keep overwriting.** Live and TA have no general revision guard; SO's `saveRev` only helps between new-build tabs. That is rollback, not double pay, but a player can "lose" a claim and the reward together. This exists already and is not new.
8. **The `SAVE_VERSION` bump hazard (§1.6).** It would make an older build start fresh and write over the save. Do not use it as a double-pay guard (this also applies to the CX plan).
9. **Content.** Kid-safe, wholesome titles only. PS R5 turns *every* achievement name into a title. The existing `a_reroll_10` "Gambler's Eye" (`data/missions.js:77`) would become a public title with a gambling reference; it should be excluded or renamed as display text while keeping the id. New names must be original and must not name other commercial games.
10. **Id grammar for the profile card.**
    - Title and frame ids must match `^[a-z][a-z0-9_]{0,23}$` (PS SQL `:135`).
    - `ach:` pins allow up to 32 characters (`:193`).
    - Hyphens, colons and capitals are rejected server-side, and an unknown title on a viewer's older build is hidden (PS §5.4).
11. **Counter growth.** `missions.counters` has no key cap. Per-stage or per-ribbon marks (up to 800 CX ribbons) would add about 20–30 KB to a save. The transfer-code limit is 300 KB (`supabase/migrations/20261008000000_online.sql:196`, `:743`). Prefer deriving from existing progress over per-item marks.
12. **New counter-based metrics** count only events reported by builds that track them. An old tab's battles never increment a new event name. Prefer metrics over durable state (§1.2) or over the existing 11 events.
