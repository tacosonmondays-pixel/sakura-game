# Review r1: feature/sandbox-catchup @ e30311ca

Independent reviewer, fresh clone. Branch base `main` fc978aba; live `main` eb0b1ab9 (v0.1.67).

**Verdict: OK.** I found nothing blocking. All six findings are Low (polish or hardening), and the branch can merge as it is.

## 1. Merge with live main

- `git merge-tree e30311ca eb0b1ab9` is clean. A real merge auto-merges `CONTRACTS.md` and `src/ui/battle/sandboxPanel.js` with no conflicts.
- The merged tree's sim id is **0fe7c5c04aec**, the same as live `main` eb0b1ab9 (COOP 15). The branch adds no sim change.
- On the merged tree, `tests/systems/sandbox*`, `tests/battle-ui/sandbox.test.js`, `tests/online/**` and my real-save parity test (below) give 57 files and 838 tests, all passing.
- At ship it still needs the usual patch note at the top of `src/data/patchNotes.js`. The branch has none, which matches the release process (HANDOFF §7).

## 2. Nothing leaks to the save or to progress: verified

**Code paths** (`src/ui/battle/controller.js`, `results.js` and `setup.js` on the branch):

- `parseSandbox` never sets `req.titan` or `req.freeplay`. `freeplay` is `null`, and a titan run goes in as `stageDef` plus `sandboxRun.titan`.
- So:
  - `titanTracker` (controller.js:1479) stays null.
  - Key spending and the board submit are never reached.
  - `soloLedger` (controller.js:1360) is null, because it needs `req.freeplay || req.keepGoing`. So there is no `paySoloFreeplay`, no `bankSoloClear`, and no `rememberFreeplayRun` in `freeplay.js:243`.
- `supportOk` (controller.js:242) excludes `req.sandbox`, so friends' support is never used.
- `isSavableRun` refuses sandbox runs, so there is no saver and no battle save.
- `ctx.applyResult = sandboxOutcome`. `results.apply` skips `store.commit` and `saveNow` for sandbox runs.
- `creditLimitBreak` returns early on `result.sandbox`.
- Co-op cannot reach the sandbox path. The `req` chain in controller.js:121-129 builds a co-op request from the lockstep, or an error; `parseBattleParams` is never called for `params.coop`.
- A `titan=` link goes to `parseTitanParams` (the real Titan Trials path). The sandbox uses its own `ttn=`/`ttier=`/`trank=` params, so the two never mix.

**`sandboxProfile` never reaches `store.profile`.** I grepped every caller:

- `sandboxProfile` is called only inside `src/systems/sandbox.js` (by `sandboxUnitStats`) and in tests.
- `sandboxUnitStats` is called only by `createSandboxSim` (setup.js:229).
- The screen only reads `store.profile` (formation and unlock state); its own choice lives in `sessionStorage['sakura.sandbox.v1']`.
- No `sbx:` gear uid ever reaches the bag.

**Runtime.** My own probe, `tools/rv-e2e.mjs.txt`, runs at 1280x720. It wraps `store.commit` and `saveNow`, hashes **every** localStorage key (no filtering), compares the full in-memory profile JSON, and logs every request that leaves the page:

| Run | commits / saveNow | localStorage | profile | req.titan / req.freeplay / saver |
|---|---|---|---|---|
| `ev-halloween-boss` Nightmare, Tenka + duo + Umeko + Kogane, ended from the panel | 0 | identical | identical | none |
| Titan `wyrm` Mayhem +30, lives switched on, 1 life, ended mid-wave | 0 | identical | identical | none |
| 4-5 Hard, freeplay Crimson, start wave 200, squad build `85-6-5-1-ur-spirit`, **quit mid-run** from wave 200 (Matriarch queued) | 0 | identical | identical | none |

During the runs the page made no requests to Supabase (REST, RPC or functions). The only requests were blob URLs and Google Fonts. So nothing reaches the leaderboard, the published profile, mail or friends.

The branch's own `e2e/sandbox-catchup.mjs` also covers freeplay wave 200 with the Matriarch, and a Titan Mayhem +30 run. Both are byte-identical at both viewports.

## 3. The numbers are right: verified against a real save

`tools/realSaveParity.test.js.txt` (rename to `.test.js` under `tests/` to run it) builds a **real** save with the game's own functions:

- **Unit:**
  - `createProfile`, then `receiveDuplicate` + `raisePotential` (Essence) up to P6.
  - `levelUp(autoSelectBooks)` and `breakthrough` up to L85 / 10 gates.
  - `awaken` up to ★5.
  - LR via `payLimitBreak`, then `creditLimitBreak`, given a won stand-in trial result.
- **Each piece:**
  - `rollGear` with a lucky RNG for the top rolls. The substat *choice* is set to the sandbox's lines, standing in for a lucky draw.
  - `tieArmband` for the coach club.
  - `enhanceGear` to +10, `awakenGear`, `enhanceGear` to +12, `limitBreakGear('set'|'blank')`, `enhanceGear` to +18.
  - `stitchSub` gold, rainbow and Nightglass, `topMainRoll` (Tie Pin), `topSubRoll` ×1 or 2 (Collar Pins), then `equipGear`.

It then compares **every key** of `unitBattleStats(realSave)` with `sandboxUnitStats`:

| Girl | Build | Result |
|---|---|---|
| tenka (LR) | max: L85 P6 ★5 LR, LR coach set | identical |
| kohaku_tsubaki (duo LR) | max | identical |
| umeko (support) | max | identical |
| kogane (hero) | max | identical |
| hotaru (SSR) | max | identical |
| umeko | L72 P4 ★3, UR Spirit Squad set | identical |
| tenka | L60 P1 ★5 LR, Blank LR ×5 | identical |
| kage | L40 ★2, best Legendary (no set) | identical |

Every step the sandbox assumes is reachable in the real game: stitch placement, both Collar Pins on LR, the armband club, and the growth order (`nextGrowthIndex` is deterministic when enhancing).

"True maximum" holds against `progression.js` and `potential.js`: `MAX_LEVEL` 85 is the last value of `POTENTIAL_LEVEL_CAPS`, with `MAX_BREAKTHROUGH` 10, `MAX_POTENTIAL` 6 and `MAX_AWAKEN` 5. Every unit's default stats read exactly those values (coverage test), and `lr` is true exactly for the LR units. Bond has no battle effect. UR Resonance follows the clock for everyone.

## 4. Determinism

- At e30311ca, `import { simId } from tools/simId.mjs` gives **b2ff5e0e884b**, the same as fc978aba. COOP stays 14 on the branch; no bump is needed.
- The start wave writes `sim.wave` and `sim.wavesCleared` on the solo Sim before it runs; no sim code changes. Co-op cannot reach it (§2).
- The "Send next wave" change in `sandboxPanel.js` is UI-side and sandbox-only.
- `e2e/engines.mjs` is **green**: V8 and JavaScriptCore compute identical battles, including freeplay and the wave-40 checkpoint restore. Firefox and WebKit are skipped (not installed).

## 5. Does the coverage test really guard?

These are local mutations in a scratch worktree, none committed:

| Mutation | `sandboxCoverage.test.js` |
|---|---|
| A stage of a new kind (`raid-1`, kind `raid`) appended to `STAGES` | **fails** ("knows every stage kind…") |
| A set id `fakeset` added to `SET_IDS` without data | **fails** (the suite breaks on import) |
| A fake unit pushed to `UNITS` | passes: the roster *is* `UNITS`, so it is offered automatically |
| A titan tier `apocalypse` added to `TITAN_TIERS` | passes: both the tier picker and the test iterate `TITAN_TIERS` |

The passes are by design: those lists come straight from the game data, so a new entry shows up without any change. The guard bites where the sandbox has its own mapping: stage kinds and groups, gear presets against set data, the enemy picker and the default build. See L1.

## 6. UI at 390x844, 844x390 and 1280x720 (touch)

Screenshots are in `shots/`, all JPEGs under 140 KB.

- No page-level horizontal overflow on the map step (Titan tab, and 4-5 with freeplay and wave 200), the squad step, or the per-girl build modal, at any of the three sizes.
- The modal fits the 390 px landscape height (top 57, bottom 333), and its Done button is visible.
- The mode tabs are a horizontal scroller (`overflow-x: auto`). The next tab shows cut off at the edge, so the strip reads as scrollable, and every tab can be tapped after a scroll.
- The selects are full-width, native, and 30–36 px tall.

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| L1 | Low | `tests/systems/sandboxCoverage.test.js:35` | The unit, titan-tier, battle-mode and set checks can never fail for "not offered", because the sandbox lists *are* the data lists. If someone later filters the roster grid or the mode select in the screen, the test would not notice. | Add a small DOM test that renders `#/sandbox/team` and `#/sandbox`, then asserts one tile per `UNITS` entry, one tab per `SANDBOX_GROUPS` group, one option per `MODE_ORDER` mode, and the right tier count. |
| L2 | Low | `src/ui/screens/sandbox.js:255-261` | The level list is built from a literal `85`, and the Potential (`[1..6]`) and Awakening (`[5..0]`) options are literals too. If a cap rises, `SANDBOX_MAX_BUILD` fails its test, but the screen would still offer no levels above 85. | Build the lists from `MAX_LEVEL`, `MAX_POTENTIAL` and `MAX_AWAKEN`. |
| L3 | Low | `src/ui/screens/sandbox.js:333` (`.sbx-bar-diff`) | At 844x390 the squad bar's run chip cuts off at "Normal · Freeplay Blossom · from w…". The start wave, the new setting, is hidden in landscape (shot `844x390-squad.jpg`). | Let the chip wrap, or shorten it ("Blossom · W200"), or put the full line in `title`. |
| L4 | Low | `src/ui/styles/sandbox.css:72` (`.sbx-slot-build`), `:60` and `:64` | Touch targets are small. The per-girl Build buttons are 28 px tall at every size. At 844x390 the tabs and wave chips measure 30 px, and the wave input 84x30. They are tappable, but under the 44 px comfort size. | Use a 36–40 px minimum height, at least for `.sbx-slot-build` and the landscape tabs and chips. |
| L5 | Low | squad tiles (`.mb-fslot` label) | At 390x844 the student tiles read "Aoi Lv•••", so the build level is lost (shot `390x844-squad.jpg`). | Drop the "Lv" label on narrow tiles; the Build button's `title` and the modal already show it. |
| L6 | Low | `src/ui/screens/sandbox.js:92` | `sandboxBattleParams` gets `choice.builds` for every girl ever given her own build, including girls since removed from the squad. The `sx=` route param carries the stale entries. It is harmless, since `buildFor` reads only squad girls. | Filter `builds` to `towers` and `hero` before building the params. |

Open questions 1–4 in the spec (a typical-roll profile, a Resonance switch, a late-start hero level, Tryout Day) are product choices, not defects.

## Test counts

| Gate | Result |
|---|---|
| `npm test` (vitest) @ e30311ca | **423 files passed, 2 skipped; 6672 tests passed, 11 skipped; 0 failed** |
| `e2e/sandbox-catchup.mjs` (390x844 + 844x390, touch) | **60/60 ok** |
| `e2e/sandbox.mjs` @ e30311ca | 77 ok, **2 FAIL**: "Back leads to the Sandbox squad (#/sandbox/team)" at both viewports |
| `e2e/sandbox.mjs` @ fc978aba (main) | 77 ok, **the same 2 FAIL**: confirmed pre-existing |
| `e2e/smoke.mjs` | 676 ok, 2 FAIL: the 2 known "drag (touch)" failures, nothing else |
| `e2e/engines.mjs` | **OK**: V8 and JavaScriptCore identical (Firefox and WebKit not installed) |
| Reviewer leak probe (`tools/rv-e2e.mjs.txt`) | 19/19 ok on the leak runs; layout pass at three viewports, with the scrolling tab strip judged acceptable (see §6) |
| Reviewer real-save parity (`tools/realSaveParity.test.js.txt`) | 8/8 identical, at e30311ca and on the merge with eb0b1ab9 |
| Sim id | b2ff5e0e884b @ branch (= fc978aba); 0fe7c5c04aec on the merge (= live eb0b1ab9) |
