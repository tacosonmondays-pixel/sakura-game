# Review r2: `feature/more-page-dps` @ 768da799 (delta from 7467f96f)

This is a delta review of the one commit "More page r1 fixes" by a fresh, independent reviewer working in a fresh clone. Round 1 is in `docs/review/more-page-dps/review-r1.md` (branch `review/more-page-dps-r1`).

## Verdict: **OK**

- M1 and L1–L5 are fixed.
- The change still only displays data: no writes and an identical hash, and the sim id is still `0fe7c5c04aec`.
- The fix adds no measurable frame cost and makes no extra DOM writes in steady state.

Three Lows remain: L6 from r1 (patch note) and two new test-strength gaps, L7 and L8. There are two Info notes. Nothing blocks the merge.

## 1. M1: live kit counts in the browser

**Setup.** My own Playwright harness on map 1-3 at 1280x720:

- The page's own loop was held (`__ab.hold`).
- Each frame was one `sim.update(1/60)` and then the real `ui.panel.update()`, with More open.
- After every frame, each `kit-<key>` cell's DOM text was compared with a fresh `kitRows(t, towerStats)`.

"Stale" counts the frames where the DOM differed from the live value.

| Girl / build | Row | Frames | 7467f96f (base) | 768da799 (branch) |
|---|---|---|---|---|
| Chigusa 2-5-0 | Vines | 1200 | **91 stale**, stuck on "1/2" | 0 stale, 1/2 ↔ 2/2 tracked |
| Yuzuha 5-0-0 | Sentries | 1200 | **1144 stale**, stuck on "3/6" | 0 stale, 3/6 → 6/6 tracked |
| Norika (hero) | Barricades | 900 | **5 stale**, "3/3" while all were down | 0 stale, 3/3 → 0/3 → 3/3 |
| Tenka 2-0-0 → 3-0-0 (More open) | Lab team | 540 | 0 | 0 ("round 1 of 1 · 3 girls") |
| Iroha 5-0-0 | Mirrors, Allies' shots | 1200 | 0 | 0 ("5/5 placed", "reflecting now", permanent reflect) |
| Iroha 3-0-0, ⚡ on Auto | Allies' shots | 2400 | 0 | 0 ("while her ⚡ runs" ↔ "reflecting now") |

**Staging.** Norika's barricades were knocked down by setting `b.down` in the harness, as the branch's unit test does.

**Why Tenka and Iroha were never stale.** Tenka's lab only changes on an upgrade, and the mirror count and ⚡ state are already in the drawer's signature, so those rows re-render either way. `paintKitCells` now also covers them, and they matched on every frame.

## 2. Still display only

**Proxy write trap.** A recursive Proxy (set, defineProperty and deleteProperty traps) wrapped the tower `t` and `towerStats`. Each run then called `paintKitCells` (with cells for every row), `kitRows`, `dealsDamage` and `damageSplit`, with `hashSim` checked before and after each call.

- **Coverage:** all 39 units × 8 builds (5-0-0, 0-5-0, 0-0-5, 2-5-0, 0-2-5, 2-0-5, 5-2-0, 3-0-0; heroes at Lv 25), **256 builds** in all.
- **Frames:** every 4th step of an 8 s fight, **30,720 frames** in all.
- **Live keys hit:** all six (`vine`, `sentry`, `barricade`, `lab`, `mirrors`, `allyBounces`).
- **Result:** **0 writes**, **0 hash changes**.
- **Positive control:** the same trap recorded writes to `t.eff.vine.max`, `t.kills` and a new key, so the trap works.

**Sim id.** `simId()` from `tools/simId.mjs` returns **`0fe7c5c04aec`**. The diff touches only `src/ui/battle/kitRows.js`, `src/ui/battle/towerPanel.js`, the test and the audit doc, and none of them is a sim entry. `COOP_PROTOCOL` is still 15.

## 3. Per-frame cost

**Setup.** `ui.panel.update()` was timed over 300 frames with More open, on a 150-enemy crowd of bears whose HP was refilled each frame. Text writes were counted by patching the `Node.prototype.textContent` setter, counting only nodes inside the drawer and only during `panel.update()`.

Each cell is mean / p95 in ms, then text writes per frame. In brackets is how many of those writes set the same text the node already had.

| Girl | main (eb0b1ab9) | 7467f96f | 768da799 |
|---|---|---|---|
| Chigusa 2-5-0 | 0.38 / 0.9 · 6.00 (4.97) | 0.38 / 0.9 · 6.00 (4.97) | 0.31 / 0.5 · **6.01** (4.97) |
| Yuzuha 5-0-0 | 0.19 / 0.4 · 6 (5.14) | 0.16 / 0.3 · 6 (5.20) | 0.19 / 0.4 · **6** (5.13) |
| Iroha 5-0-0 | 0.24 / 0.6 · 6 (4.20) | 0.25 / 0.6 · 6 (4.16) | 0.29 / 0.6 · **6** (4.20) |
| Midori 0-2-5 | 0.28 / 0.5 · 6 | 0.31 / 0.8 · 6.02 | 0.20 / 0.4 · 6.06 |
| Tenka 2-0-0 | 0.19 / 0.2 · 5 | 0.16 / 0.3 · 5 | 0.27 / 0.6 · 5 |
| Norika (hero) | 0.45 / 1.2 · 3 | 0.44 / 0.7 · 5 | 0.63 / 1.5 · 5 |

**DOM writes.** The kit repaint adds about 0 writes a frame: Chigusa's +0.01 is her vine count actually changing. There is no thrash.

- The same-text writes are older code that writes on every frame whatever the value: DPS live/avg, Kills and Damage dealt. They are the same on main.
- Norika's 3 → 5 comes from the hero grid in the earlier commit (r1), not from this one.

**Timing.** Times are within noise under load; the machine was also running the serial test suite. Everything is far under a 16.7 ms frame.

**Node microbench.** One `paintKitCells` call costs about 20–70 µs when the girl has a live key (Iroha's is the most). It costs 0.2 µs when she has none, because it returns early. See Info 1.

## 4. L2 is real: an injected write is caught

I injected one line at the top of `kitRows()` in a scratch worktree and did not commit it:

`if (t && t.targetMode && t.targetMode !== 'last') t.targetMode = 'last';`

| Checkout | `tests/battle-ui/kitRows.test.js` |
|---|---|
| 768da799 + injection | **FAIL**: `display only › … never write the tower`, "iroha 5,0,0 co-op hash: expected 3160882446 to be 3547921946" |
| 7467f96f + same injection | 48/48 **pass** (the old `sim.hash?.()` check never ran) |

`targetMode` is not in the test's six-field JSON snapshot, so the `hashSim` assertion alone caught the write. L2 is fixed. Both worktrees were restored afterwards.

A second injection, `t.vines.pop()`, was **not** caught by the display-only test; see L7.

## 5. Other r1 fixes

- **L1:** Iroha 0-0-5 now reads "… · once her ⚡ unlocks". The new unit test covers it.
- **L3:** the hero now has `damageDealt` and `stats.damageByTower` reset after leveling (`kitRows.test.js:30-35`).
- **L4:** shares under 0.5% now read "<1%", and an exact 0 still reads "0%" (`kitRows.js:79-81`). The test covers it.
- **L5:** the row now reads "Prismfall · unlocks at Refraction tier 3", and the audit doc's example is updated to match.

## 6. Tests

| Run | Result |
|---|---|
| `npm test` (`vitest run --no-file-parallelism`, serial) | **6,781 passed, 11 skipped, 0 failed** (430 files: 428 passed, 2 skipped) |
| `tests/battle-ui/kitRows.test.js` | 54/54 |
| `node e2e/more-page.mjs` | all checks passed, **81 ok** (3 viewports) |
| `node e2e/smoke.mjs` | **676 ok, 2 FAIL**: the 2 known "drag (touch)" failures (aimed [9.8,4.8] → [10.31,4.8]; [7.3,5.3] → [7.3,4.88]), fixed on the release branch |

## Findings

### L6 (Low, process, carried over from r1): no patch note

- **Where:** `src/data/patchNotes.js` is still untouched on the branch.
- **Fix:** add a top entry before this lands on `main` (CLAUDE.md), or add it on the release branch.

### L7 (Low, test): the display-only test does not call `paintKitCells`, and its 2 s fights never hold a vine

- **Where:** `tests/battle-ui/kitRows.test.js:132-147`.
- **What happens.**
  - The per-frame function this commit adds is outside the hash-checked test.
  - After 2 s Chigusa has 0 vines, so writes to the live lists are unguarded. An injected `t.vines.pop()` inside `kitRows` passed the display-only test.
  - Only the paint test failed, and only by accident: it waits for the count to change.
- **Fix:** in that loop, also call `paintKitCells(new Map(kitRows(t, st).map((r) => [r.key, { textContent: '' }])), t, st)`, and fight for about 8 s, or snapshot `t.vines`, `t.sentries` and `t.bars` lengths too. My Proxy run shows no writes today, so this guards against future changes; it is not a current bug.

### L8 (Low, test): the wiring test is a source-text regex

- **Where:** `kitRows.test.js` "the drawer wires it" (about line 183).
- **What happens.** The test matches `towerPanel.js` text, so a harmless refactor breaks it, and code that is wired up wrong can still match. e2e/more-page.mjs does not check that a live count changes with More open.
- **Fix:** add one e2e step to more-page.mjs, for example Yuzuha 5-0-0 with More open: step 10 s and assert that `kit-sentry` matches `t.sentries.length`. My harness does exactly this (section 1).

### Info

1. **`paintKitCells` rebuilds every kit row each frame** (`kitRows.js:206-216`). That is about 20–70 µs a frame, for one open drawer only. It is cheap, but a count signature would skip most frames: `${t.vines?.length}|${t.sentries?.length}|${bars up}|${t.lab?.rounds}|${mirrors}|${t.abil?.active > 0}`. Optional.
2. **Older same-text writes.** `updateLive` sets the DPS live/avg, Kills and Damage dealt text on every frame without comparing (about 4–5 same-text writes a frame, also on main). Writing a text node with the same text is cheap, so this is optional cleanup. It is not from this commit.

*Reviewer scripts (live-repaint and per-frame-cost Playwright harness, Proxy write trap, microbench, injection diff) were kept outside the repo and are not committed.*
