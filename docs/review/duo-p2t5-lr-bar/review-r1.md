# Review r1: fix/duo-p2t5-lr-bar @ 47bf83b5 (on main eb0b1ab9, v0.1.67)

**Verdict: OK.** The 8M urset gate is principled, the buff is isolated to the duo's LR p2t5 cells, every LR build
clears ×1.25 on both benches, and the determinism plumbing is right. There are no blockers. The three findings
below are a doc gap, a test-coverage gap, and the patch note that must land before merge.

The review used a fresh clone at 47bf83b5 and a live worktree at eb0b1ab9. The branch's `noNerfGate.mjs`,
`r5Bench.mjs`, `maxedProfile.mjs` and `lrBar.mjs` were copied into the live tree as tools only.

## 1. The 8M urset crowd is principled, not tuned

`axes(…, { profile: 'urset:geometry', crowdHp })` at 2M / 8M / 30M (crowd, boss in M):

| build | 2M | 8M | 30M |
|---|---:|---:|---:|
| kohaku_tsubaki p2t5 LR | 58.00 / 30.17 | 70.10 / 30.17 | 70.10 / 30.17 |
| akane p0t5 (the bar) | 53.21 / 3.32 | 53.21 / 3.32 | 53.21 / 3.32 |
| kohaku_tsubaki p0t5 LR | 80.35 / 64.95 | 80.35 / 64.95 | 80.35 / 64.95 |
| tenka p1t5 LR | 71.11 / 67.21 | 71.11 / 67.21 | 71.11 / 67.21 |

The duo's p2t5 also reads 70.105M at 3M, 4M and 6M, so the knee lies between 2M and 3M. 8M is about 3× past
it, and 8M and 30M read the same, as the branch claims. Only the one build that was capped at 2M moves. The
boss axis does not depend on the crowd HP.

A full `lrBar.mjs --gear urset` re-measure at 8M (7.5 min) reproduces the pinned `URSET_BAR` exactly: crowd
Akane p0t5 53,211,832 (Geometry), boss Aoi p2t5c1 13,257,709 (Geometry). The #2 crowd row is Akane p0t5c1 at
51.42M and #3 is 32.88M, so the seed-9 screen with top 8 is not close to missing a candidate.

The default bench is unchanged. `CROWD_HP` stays 2M (r5Bench.mjs:43); the diff only threads a `crowdHp`
parameter that defaults to it, and `LR_BAR` is untouched. noNerfGate (below) shows no non-LR cell moved, so
LR_BAR's crowd 17.40M and boss 6.46M stand.

## 2. The buff is isolated

The data diff is one number: `LR_ROWS.kohaku_tsubaki.t5.refraction.dmg` 2.0 → 2.1 (src/data/balance.js:113).
`lrRowFor` applies it only when `lr` is set and her p2 tier is ≥5. Its one consumer is `powerFor`, called from
`resolveStats` (src/sim/mods.js:1090).

noNerfGate, live eb0b1ab9 against the branch:

| run | cells | under live ×0.995 | moved |
|---|---:|---:|---|
| duo, tiers 1–5 × 3 paths × 3 targets, profiles maxed/l1/l40, LR on and off, `--support um` | 270 | 0 | LR p2t5 boss / bossw / crowd, ×1.0500 each |
| the same, `--support none` | 270 | 0 | LR p2t5 boss / bossw / crowd, ×1.0500 each |
| every girl, maxed tier 5, `--support um` (incl. 18 LR-off cells) | 297 | 0 | the same three duo cells only |

There were no missing or errored cells, and `--compare` exited 0. The LR-off cells and the l1/l40 cells never
move, as expected.

## 3. Every LR build is ≥ 1.25× on both benches

| LR build | default crowd | default boss | urset crowd | urset boss |
|---|---:|---:|---:|---:|
| kohaku_tsubaki p0t5 | ×1.33 | ×3.16 | ×1.51 | ×4.90 |
| kohaku_tsubaki p1t5 | ×1.32 | ×3.56 | ×1.33 | ×5.57 |
| kohaku_tsubaki p2t5 | **×1.38** | ×2.29 | **×1.32** | ×2.45 (Freeze Tag) |
| tenka p0t5 | ×1.32 | ×4.37 | ×1.36 | ×6.65 |
| tenka p1t5 | ×1.32 | ×3.31 | ×1.34 | ×5.07 |
| tenka p2t5 | ×1.32 | ×4.20 | ×1.47 | ×6.38 |

These match docs/BALANCE.md. The tightest margin is ×1.32 on several cells.

For context, at live 2.0 the fixed 8M gate already reads the duo p2t5 crowd at **×1.255** (66.77M), which is a
pass by 0.005. The 2.0 → 2.1 buff is margin rather than a strict requirement of the fixed gate. That is a
reasonable owner call, since ×1.255 would fail on any small non-LR raise, and the doc says so.

## 4. Determinism

- **simId.** `simId().id` is `e3c222f3ad44`, which equals `KNOWN[16]`. Live eb0b1ab9 reads `0fe7c5c04aec`,
  which is KNOWN[15].
- **COOP 16 refuses 15 both ways.** `sameVersion` compares `proto` first (version.js:109). coopFreeplay.test
  asserts both directions for 15 and every older proto, and coopSession.test checks a proto-15 hello and start
  message. Both pass.
- **Engines e2e** (`node e2e/engines.mjs`) passes: Node V8, Bun JSC and Chrome V8 match on every scenario.
  Firefox and WebKit are not installed here. The DUO battle reads 30980 ticks, final 1057973614, hashes
  186a7e7f on all three, the same as the pinned values.
- **The fixture claim is correct.** DUO_START's host LR duo makes five refraction upgrades, but gold limits it
  to tier 4: the pinned `tiers: '004 023 000 000'` (tests/online/engines.test.js:568). No fixture reaches LR
  p2t5 refraction, so no re-pin was needed.
- **New replay at LR p2t5.** This used `runPotentialBattle`, which runs two lockstep clients over a jittered
  link. The setup is the DUO_START map and seed with both players on an LR duo, `costMul 0.03`, and five
  refraction upgrades each. Both reach `005 005` at frame 7093.
  - At `damageMul 0.5`, two runs on the branch were identical: 36987 ticks, won wave 22, final 2273858258,
    64 checkpoints → `55073ef9`. Lockstep agreed and there were no refusals.
  - The same script on live reads final 52134182, hashes `7ded3f17`. The row is exercised, and the battle
    differs from live, so the bump is needed.
  - Tower damage is 649.2 on live and 681.6 on the branch (×1.05).
  - At `damageMul 3` every hit overkills, so live and the branch hash the same even though the stats differ by
    ×1.05. See F2.

## 5. Patch note

The branch has no patch note, so one must be added at merge time (F3). The suggested wording is plain player
text and names no other game. A ready entry:

```js
changed: [
  "Kohaku & Tsubaki's LR Refraction build hits harder: at tier 5, Refraction's LR bonus goes from ×2.0 to ×2.1.",
],
```

The co-op version changes (protocol 16), so players on 0.1.67 can't join this version until they update. That
is the usual version banner and needs no note line.

## 6. Test runs

- `npm test`: **427 files passed, 2 skipped; 6727 tests passed, 11 skipped, 0 failed** (536 s).
- `node e2e/coop-rejoin.mjs`: all checks ok, 21 ok lines, 161 s.
- `node e2e/multiplayer.mjs`: all checks passed, 85 ok lines.
- `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED**, 678 ok lines. The two known "drag (touch)" failures did not
  occur in this run.
- `node e2e/engines.mjs`: OK on 3 runs over 2 engines (V8, JSC).
- `lrBar.mjs` (default) and `lrBar.mjs --gear urset`: every LR build ok, both exit 0.

## Findings

| # | severity | where | finding | fix |
|---|---|---|---|---|
| F1 | low (docs) | docs/HANDOFF.md:177 | The balance-gate procedure still says to run `lrBar.mjs --bar` and re-pin `LR_BAR` when a non-LR unit is raised. It does not mention `--gear urset` / `URSET_BAR`. The new test only checks LR rows against the pinned `URSET_BAR`, so a non-LR raise that lifts the urset bar would pass silently unless someone re-measures. | Add to that bullet: "and `lrBar.mjs --gear urset`, re-pin `URSET_BAR` from its URSET BAR line". Optionally add `expect(URSET_BAR.crowd.dps).toBeGreaterThanOrEqual(LR_BAR.crowd.dps)` for the boss axis as well (tests/sim/lrBar.test.js:28 covers crowd only). |
| F2 | low (test coverage) | e2e/engines/scriptedBattle.js:2710, tests/online/engines.test.js:568 | No scripted or engines battle reaches LR p2t5 refraction: DUO_START stops at `004`. With DUO_STATS `damageMul 3`, a tier-5 variant would also overkill and hash the same across row changes. Cross-engine coverage of this row (and of the starfall and corridor t5 rows) therefore rests on the generic stat path. | When the next duo change touches the sim, add a DUO_T5 scenario like the replay in §4: both LR, `costMul 0.03`, `damageMul 0.5`, five refraction upgrades. Pin its final and hashes. Not needed for this fix. |
| F3 | medium (release process) | src/data/patchNotes.js:21 | The branch has no patch note. CLAUDE.md requires one at the top for every push to main. | When merging, add the entry from §5 to the next v0.1.N, or fold it into the release's note under `changed`. |

No other issues. The code paths are straightforward. `urSetProfile` throws on an unknown set. `checkUrSet` and
`measureUrSet` use the same `URSET_CROWD_HP` for the bar and the LR rows, so the comparison is like for like.
