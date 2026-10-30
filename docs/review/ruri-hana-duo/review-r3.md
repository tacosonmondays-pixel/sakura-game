# Ruri's rework and the Ruri & Hana duo: independent review, round 3

Reviewer: an agent that wrote neither the spec nor reviews r1 and r2 (review gate, HANDOFF §6).
Reviewed: `spec/ruri-hana-duo` at `cebdfca2`. It changes two files on top of review r2 (`261215d5`):
`docs/specs/RURI_HANA_DUO.md` ("spec", r3, which opens with "Changes since r2") and
`docs/review/ruri-hana-duo/OWNER_BOARD.md` ("board").

**Code references.**
- A bare `file:line` points at `main` `60ce9cad` (v0.1.61, COOP 13), which is still `origin/main`.
- Round 5 is cited at the tip of `feature/balance-r5`, `d6f092b7` (Oct 30, 07:13 UTC). It has not moved since
  r2, so the spec's sha is the live tip. Tip references are written `d6f092b7:path:line`.
- `src/sim/snapshot.js` is the co-op serializer; `src/ui/battle/snapshot.js` is the battle save.

**Bench.** None run (the machine is loaded, and r3 changes no measured figure). Every number below is checked
against the code and round 5's own tables.

**Verdict: NOT OK.** 0 BLOCKER, 0 HIGH, 1 MEDIUM, 6 LOW.

The three r2 MEDIUMs are fixed in the rules:
- the LR figures are right and re-based on the live round-5 tip;
- a lure's push lock now holds until the walker is back where it was lured, with `pushLockBy = −1`;
- Kon's stretch is stored on the forward path and mirrored on a turned road.

Every r2 LOW is answered. The names are clean, and "default all" spends nothing.

It is not OK for one reason:
- **R3-M1.** The lure-bound test, which is part of R1's gate, asserts a bound per walker that the rules do not
  give. On a correct build it would fail. Q3 states the same bound to the owner as exact.

The fix is small, and it is in the test and the wording, not in the lure rules.

---

## 1. The round-2 findings, checked in the code

| r2 | What r3 does (checked in the code) | Status |
|---|---|---|
| **M1** LR figures | **Re-based on the tip.** The figures match round 5's own LR table on the tip (`d6f092b7:docs/specs/DUO_LR.md:349-355`). <br>• The first duo reads 2.58 / 3.01, 3.38 / 2.79 and 5.63 / 2.85 across her three builds; Tenka's Rail Arms reads 3.58 / 2.75. (spec `:516-519`; board `:94-95`)<br>• Joint Research (0.52 / 0.48) and Singularity (0.27 / 0.05) are named as round 5's open owner question (`d6f092b7:docs/specs/DUO_LR.md:363-366`; spec `:520-525`).<br>• Tenka's ×1.21 is gone. Her 3.58× is called her LR form (`:164`, `:524`).<br>**The rows.** `LR_POWER` is `kohaku_tsubaki: { dmg: 1.05, boss: 1.6 }` and `tenka: { boss: 3.4 }` (`d6f092b7:src/data/balance.js:92-100`). It applies only with `lr` (`:143-155`), read from `us.lr === true` (`d6f092b7:src/sim/mods.js:1027`).<br>**Her floor.** The crowd floor is max(3×, the weakest other LR unit's best crowd) = min(5.63, 3.58) = 3.58×. 3.58 × 1.83M ≈ 6.55M (`:508`).<br>**Her knob.** It is a `ruri_hana` row in `LR_POWER`, and `RH_LR_MUL` is gone (`:482`, `:817`). | **Fixed.** D1's file table misses `balance.js`: R3-L3. |
| **M2** lure + re-push | **The lock.** A lure keeps `e.lureFrom` and holds the lock with `pushLockBy = −1` until the walker is back there (`:265-268`). That closes both holes r2 found:<br>• Fuu's gusts and gather check only `pushLock > 0` (`src/sim/Sim.js:643`, `:679`);<br>• Backdraft Fan passes only its caster's own lock (`src/sim/abilities.js:1103`), and −1 is never a tower uid.<br>**What the rule proves.** No locked push acts on the ground a lure took back, at most two lures a wave, so "never held". | **The rule is fixed. The per-walker figure and its test are not:** R3-M1. The lock's mechanics: R3-L1. |
| **M3** reversed roads | **Stored forward.** `t.kon = { …, pathIndex, dFwd }` comes from `relaySamples`, which is built on the forward paths and carries `d` and `pathIndex` (`src/sim/towers.js:1397-1402`, `:1445`).<br>**Mirrored live.** `d0 = routeReversed ? L − dFwd : dFwd` (`:414`) matches `reversePath`. That function keeps `p.index` and mirrors `d → L − d`, tunnels included (`src/sim/rules.js:56-64`).<br>**Lure foxes and Follow the Fox.** They read the live road (`:236`), and their trap spots are dropped on a flip (`src/sim/Sim.js:1706-1711`).<br>**Only between waves.** The road turns only in `startNextWave`, from 'prep' or 'between' (`src/sim/Sim.js:868-874`). So no live enemy, lure fox or run crosses a flip.<br>**Tests.** Both test files take a Rear Ambush even wave (`:752`, `:754`). | **Fixed.** |
| **L1** whose lock, which pushes | • The lock is −1.<br>• The list of locked pushes is complete: Fuu, gather, `pushLock` specs, `movePush` (`:269-273`). Those are all the lock sites in `src/sim`.<br>• Grounded flyers are excluded through `airborne`, which grounding leaves set (`src/sim/combat.js:27-28`). | **Fixed.** The *unlocked* list reads as complete but is not: R3-L2. |
| **L2** strip records | • The lure branch (`:246`), the 0.4-tile trigger (`:245`), and the effects on Azami's and Suzu's spots, with a test (`:251-255`).<br>• The display rows cite the right code: `actors.js:728-736`, `placedProps.js:510-518`, and `companionLogic.js:86-93` (`konSpot` reads `t.origin`) (`:653`, `:679`). | **Fixed.** One counter to name: R3-L6. |
| **L3** Kon's run edges | • No stretch beyond 4.2 tiles (`:412`).<br>• One run in flight, with the timer counted from his return (`:422`).<br>• Bosses are bitten but never Startled, because runners drop statuses on bosses (`src/sim/runners.js:115`, `:172`; spec `:427-429`).<br>• Shared roads use `sameRoad` (`src/sim/balls.js:50-57`) at `RUNNER_HIT_RADIUS` (`src/sim/constants.js:261`).<br>• Closed lanes (`:419`). | **Fixed.** |
| **L4** `du` restore | • The restore reads `du` only behind `t.stats.duo` and clamps to `PRISM_BEAM_TICK` = 6 (`src/ui/battle/snapshot.js:585-591`; `src/sim/constants.js:344`).<br>• The new duo's def-level `duo: { members }` is not `stats.duo`: only `base.duo` becomes the stats block (`src/sim/mods.js:481`; `src/data/unitsDuo.js:31` vs `:57`).<br>• So a separate `pair` branch is needed. §5.1 and §5.4 add one, with the three tower gates (`src/sim/towers.js:332`, `:1958`, `:1993`), and the planned test checks that the timer is not clamped (`:756`). | **Fixed.** |
| **L5** Q4 and refund | Both builds are named, with per-build floors against round 5 (`:210-214`; board `:51-54`), and the refund says "above tier 2" (`:610`; board `:58`). | **Fixed.** Q4's "other option": R3-L5. |
| **L6** Bounding Fox | "A tile more reach; the hunt is a look" (`:227`; board `:23`), with a real-coin check (`:326`). | **Fixed.** |
| **L7** tools, chain | • capBot builds R and D (`:332-334`).<br>• `headless.js` scores `lure`, `prints` and `pair` (`:335`, `:648`, `:674`). `pathScore` is at `src/sim/headless.js:156-196`, and the file is hashed (`tools/simId.mjs:20`).<br>• Silent Stalk's leap prints stop one short, and only a bolt fills a stack (`:287`). | **Fixed.** The capBot measure and cost: R3-L4. |
| **L8** text | • One banner name everywhere (`:89`, `:572`, `:720`; board `:106`, `:148`).<br>• D2-alone gets a real line (`:776`), in line with `src/data/patchNotes.js:12-13`. | **Fixed.** |

## 2. The round-1 findings are still fixed

- **H1, the cap.** Still a floor, never a cap (`:494`, `:782`; board `:81`, `:87`). No unit is lowered by this spec.
- **M2, the hunting Kon.** Kon's firing point never moves (`:228`, `:233`).
- **M3, the lures.** The count, the gap, the refusal of a locked walker, Resolve and the blink are all kept, and
  the lock is stronger (`:262-277`).
- **M4, Kon's run.** The duo has no relay, and the run is written out (`:405-435`).
- **M5, the battle saves.** The `kv: 2` drop, the timer classes, and `t.kon` as `derived` (`:732-743`).
- **M6, the banner.** "Fox and Falcon Premiere".
- **The r1 LOWs.** All still in place: the gift worked out at load, "Fast Friends", the art keys as environment
  secrets, the full gate for R2, and every milestone with a patch note.

## 3. New problems from the fixes

### 3.1 Determinism

**No new problem.**
- `e.lureFrom` is a float compared with `e.dist`, and `d0 = L − dFwd` is a subtraction. Neither uses rng or trig.
- Both clients take the same branch, because both read the same `routeReversed` and path lengths.

### 3.2 Co-op checkpoints

**No new problem.**
- The serializer stores every field, shared reference and Set (`src/sim/snapshot.js:6-15`). So `e.lureFrom`, a
  held lock, `t.kon` and the run records all travel.
- The mid-wave checkpoint test covers them (`:755`).
- The route flips only between waves (§1, M3), so a checkpoint never holds a lure across a flip.

### 3.3 Battle saves

**No new problem.**
- Enemies are not saved, and lure foxes end at the wave clear (`src/sim/strips.js:281-302`; Ruri has no `carry`).
  So a calm point has no lure state.
- `snapshot.js:351` writes the traps, but none of them is Ruri's at a calm point.

### 3.4 Cost of the test plan

**Mostly fine, with two gaps in R3-L4.**
- The lure-bound test is two short sims.
- capBot is 24 Freeplay runs for build R (3 paths × 2 stages × 2 seeds, before and after), plus build D. That is
  real CPU, and the spec should say it runs once in the R1 gate, not in `npm test`.

### 3.5 The lure-bound test itself

See R3-M1.

## 4. Names and content

**No clashes.**
- I searched `src/`, `docs/`, `tests/`, `tools/` and `e2e/` on `main`, and on `origin/feature/balance-r5`, for
  every new name.
- The names searched: Bounding Fox, Fox Tricks, Paw Prints, Lure Fox, Follow the Fox, Spirit Fox, Silver Fangs,
  Lapis Fox, Hundred-Fox Trick, Silent Stalk, Startle Bark, Cloudbreak Stoop, Scatter Run, Great Stoop, Trusty
  Pair, Sure Grip, Quick Trot, Keen Pair, Fast Friends, Kon Meets Kaze, The Field Survey, Duo Rangers, Wind Chase,
  Paw and Feather, and Fox and Falcon.
- None appears anywhere outside this spec and its board.

**No other games' or anime names.** I listed every capitalised word in both files. The only outside names are
tools (Tripo, Meshy, NovelAI) and JS engines (JavaScriptCore, SpiderMonkey). The r3 commit message is clean too.

**Wholesome.**
- Both girls stay in uniform and are framed at eye level or above (`:712`).
- The bio is two shy club members whose companions met (`:563-567`).
- No Sensei, no romance, no gore.

## 5. The owner board

**Real decisions, sensible defaults.**
- Q1–Q7 and Q9–Q15 are real decisions, each with a sensible default.
- Q3 now gives the true rules, but its per-lure figure is too exact (R3-M1).
- Q8 is not this spec's decision. Its other option, and Q4's, are nerfs (R3-L5).

**No spend in "default all".**
- It leaves out Q13's roughly 60 Anlas (board `:4`, `:130`).
- Q14's default is the owner's own Tripo work.
- Meshy is the already-approved spend, with a test run first and every run's cost reported (board `:139`).

---

## 6. Findings

### MEDIUM

**R3-M1 MEDIUM: the lure-bound test asserts a per-walker bound the rules do not give, and Q3 states it as
exact.** Spec `:278-282`, `:753`, `:780`; board `:46`.

The test asserts that "each runner's leak time in B minus A is at most the sum of its own lure detours … plus
one step". That is not a property of the rules, for three reasons.

1. **Runners that are never lured get delayed too.**
   - **How Fuu aims.** Her volley picks up to `projectiles` targets in target-mode order (`volleyFrom` →
     `selectTargets`, `src/sim/towers.js:822-825`). At Returning Gale 5-2-0 she has 3 + 2 + 2 = 7 gusts
     (`src/data/unitsExpansion.js:232`, `:238-239`) and about 3.6 tiles of reach (`:232`, `:242`, `:256`).
   - **The stream outnumbers her gusts.** Goblin Runners every 0.5 s at 1.7 tiles a second
     (`src/data/enemies.js:279`) are 0.85 tiles apart, or less when slowed. So her reach often holds more than 7.
   - **What a lure does to her aim.** When runner X is lured, it drops down the 'first' order and is locked (a gust
     that hits it pushes nothing, `src/sim/Sim.js:643`). A runner W that was 8th, and unpushed in A, now gets a
     gust in B.
   - **The result.** W's leak time grows with no lure of its own, and the assertion fails on a correct build.
2. **Lured runners meet Fuu's push cycle at a different phase.**
   - The lock is a countdown (`e.pushLock -= dt`, `src/sim/enemies.js:497`; 1.5 s, `src/sim/constants.js:237`), and
     her gusts are projectiles in flight at speed 13.
   - A runner back at `e.lureFrom` can take one more or one fewer push than it did at that spot in A. One push is
     1.6–1.7 tiles (round 5's Returning Gale). A slowed runner needs seconds to walk that again, not one step.
3. **The test can pass while testing nothing.**
   - A push-locked walker cannot be Lured (`:268`). With Ruri "beside" Fuu, the runners in her reach are locked most
     of the time.
   - Yet the test never asserts that any lure happened.

**What does hold.** These follow from the rules, and they are what the owner needs:
- every walker still leaks ("never held");
- at most two lures per walker a wave (minibosses one);
- no locked push between a lure and the walker's return to `e.lureFrom`;
- per lure, about its own detour, plus at most about one more of Fuu's pushes when she is near.

*Fix:*
- **The per-walker bound on one runner.** Assert it with one runner alone on the lane, so Fuu's aim cannot shift,
  and allow one Fuu push per lure: its tiles at the runner's speed, plus `PUSH_LOCK`.
- **The stream test asserts:**
  - every runner leaks;
  - at most two lures each;
  - no locked push inside a lock window;
  - **at least N lures happened** (place Ruri so her lure foxes land before or at the edge of Fuu's reach);
  - an aggregate bound: the last leak, or the sum of leak times, in B minus A is at most the sum of all detours
    plus the same allowance per lure.
- **Name the runner count and a time cap,** so a stall fails the test instead of hanging it.
- **Q3 and §2.2.** Word the per-lure cost as "about its lure time plus walking that ground again (near Fuu, at
  most one more of her pushes)". Keep "she can slow a walker but never hold it", which is true.

### LOW

**R3-L1 LOW: say how the lock is held, and that it ends the step the walker is back.** Spec `:265-268`, `:347`.

**How the lock is held.**
- `e.pushLock` is a countdown, decremented every step (`src/sim/enemies.js:497`) and read as `> 0` at three sites
  (`src/sim/Sim.js:643`, `:679`; `src/sim/abilities.js:1103`).
- So "holds until it is back" needs the lure code to keep it above 0 every step while `e.dist < e.lureFrom`.

**When it ends.** "Then lapses as a normal lock would" can be read as "then runs out its 1.5 s".
- That gives a walker 1.5 s of immunity *beyond* `e.lureFrom`, inside Fuu's reach, where in A she would push it.
- So with a 2.5 s lure, Fuu + Ruri can let a walker gain ground over Fuu alone.

*Fix:* the lock ends the step the walker reaches `e.lureFrom` (`pushLock = 0`, and `lureFrom` cleared).

**Norika's Detour Sign.** It moves a walker to another branch and rewrites `e.pathIndex` and `e.dist`
(`src/sim/barricades.js:435-453`), so `e.lureFrom` would then be compared across two roads.

*Fix:* clear `lureFrom` on a path change, or keep its `pathIndex` and compare on that road only.

**R3-L2 LOW: the list of unlocked moves reads as complete, but is not.** Spec `:275`, `:281`; board `:45`.

"It does not cover Kogane's plow or ordinary knockback from hits" leaves out three more moves that never check the
lock:
- a hero ability's push-back (`src/sim/hero.js:370-376`);
- Norika's barricade pushes and One-Way Street (`src/sim/barricades.js:340-345`, `:387-395`);
- the pull of Tenka's wells and Critical Mass (`pullAlong`, `src/sim/zones.js:250-262`).

The bound still holds: they act the same with or without Ruri.

*Fix:* add them to the list, or say "every move that does not check the push lock, for example …".

**R3-L3 LOW: D1's file table misses `src/data/balance.js`.** Spec `:482`, `:657-682`, `:817`.
- **Why it is needed.** Her LR knob is a `ruri_hana` row in `LR_POWER`, which lives in `src/data/balance.js`. That
  file is hashed: `src/sim/mods.js` imports `powerFor` (`d6f092b7:src/sim/mods.js:1027`).
- **Where it is listed now.** D1's table names only `unitsDuo.js`, `abilities.js`, `potential.js` and `unitKit.js`
  as hashed data. R1's `balance.js` row is for her solo row only (`:638`).

*Fix:*
- Add the file to D1.
- Add a test like round 5's `duoLongBeam.test.js` LR check (`d6f092b7:tests/sim/duoLongBeam.test.js:184-188`):
  her row applies only with `lr`, and never in a titan battle.

**R3-L4 LOW: the test tools need a few words.** Spec `:331-334`, `:753`, `:760`.

- **The bench harness.** `tools/bench.mjs` is a CLI with no exports. It reads `process.argv` at load
  (`tools/bench.mjs:25`) and heals inline (`:127`). The lure test must copy the heal and the STRONG preset (`:45`),
  not import "the bench harness".
- **capBot's measure.**
  - capBot plays until the run falls (`tools/capBot.mjs:3`, `:320`), so every run ends with no lives left.
    "Keeps at least as many lives" should be "falls no earlier, and first leaks no earlier" (`fell`, `reached` and
    `firstLeak` are in its output).
  - Build A's plans are per copy (`aoi: ['0-2-5', '5-0-2', null, '0-2-4']`, `:58`), so "run once for each of her
    main paths" needs its copy plans.
  - Build D should say whether the duo is UR or LR, since the profile sets no `lr`.
- **The cost.** 24 runs for build R alone, plus D. Say they run once in the R1 and D1 gates, with a `--maxWave`,
  not in `npm test`.

**R3-L5 LOW: Q8 is not this spec's decision, and two "other options" are nerfs.** Board `:61`, `:89-102`.

**Q8.**
- Round 5's LR lift is round 5's own change, on its own branch, with its own open owner question.
- Q8's other option, "undo round 5's LR boost", would leave the first duo at 1.66–1.79× and Tenka at 0.81× on
  bosses: below the owner's own floor, and a nerf of what round 5 ships.

**Q4.** Its other option ("no job falls" only) cuts the 2-0-5 build's crowd and the 2-5-0 build's boss numbers.
The owner has said "no nerfs, ever".

*Fix:*
- Turn Q8 into a note ("round 5 already lifts both; its own board asks about Tenka's two low builds").
- Drop the nerf options, or mark each "(a nerf: against your no-nerfs rule)".

**R3-L6 LOW: smaller points in the text.** Spec `:249`, `:506`.
- **Her lure-fox cap.** The cap must count on `t.trapCount`. Evictions and wave ends decrement it for every
  non-extra strip (`src/sim/strips.js:72`, `:298`; `src/sim/towers.js:2170`). With a separate counter, an evicted
  fox would never free her cap. Say so in the lure branch.
- **"Both rulers".** In §1.3, "both rulers" means the light bench and round 5's bench (`:136`). In §3.6 it means
  crowd and boss (`:506`, "every tier-5 build is at least 2.5× on both rulers"), and the light bench has no LR
  (`:494`). Write "on crowds and on bosses" there.

---

## 7. Verdict

**NOT OK.**

This must be fixed, and the fix re-reviewed, before anyone builds from this spec:
- **R3-M1.** Make the lure-bound test assert only what the rules give:
  - a per-walker bound on a lone runner, with one Fuu push allowed per lure;
  - in the stream: every runner leaks, at most two lures each, no locked push in a lock window, a minimum lure
    count, and an aggregate bound;
  - a runner count and a time cap;
  - Q3 and §2.2 worded to match.

The LOW findings (R3-L1 to R3-L6) can be fixed in the same pass, and none blocks on its own. The rules themselves
(the lure lock, the mirrored stretch, the LR floors) are sound. Only the test and the per-lure wording stand
between this spec and OK.

This is round 3 of the review gate. HANDOFF §6 says that after three failed rounds the work stops and is reported
"not approved", so the coordinator should take that verdict to the owner. The fix is small enough that one more
pass would close it, if the owner allows it.
