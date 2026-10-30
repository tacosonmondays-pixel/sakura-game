# Balance round 5: final review (`feature/balance-r5` at 5a2fbf84)

Independent review of `git diff f1fd0681 5a2fbf84` (Blade Cyclone aimed volley + arms at 0.25, mirror `scale`, the LR
premium, OVERTIME bands from 201, the new tools), measured against live `origin/main` a741aef7 (v0.1.63). No product
code was changed. Worktrees: live, f1fd0681 and 5a2fbf84. Live has no round-5 tools, so `tools/balance/r5Bench.mjs`,
`maxedProfile.mjs`, `capBot.mjs` and `potentialProfiles.mjs` were copied from the branch into the live worktree as
untracked files. They drive the game's own `unitBattleStats` and Sim, so each side runs its own sim and data.

**Verdict: NOT OK (fix then ship).** Two small no-nerf misses remain on the bench with no supports. Both were already
there at f1fd0681; this diff did not cause them. Everything else holds.

## Findings

### HIGH

1. **Hotaru 3-0-2 alone on a crowd is 1.0% under live.** `r5Bench --support none`, crowd, 6 seeds (9/1/2/3/4/5):
   live 16,302 → branch 16,139 (×0.990). Every seed is under live by the same ~1%. f1fd0681 read ×0.980, so the
   ×1.04 row (`src/data/balance.js:52`) halved the gap but did not close it. Her 4-0-2 (×1.005) and 5-0-2 (×1.029)
   pass, and so does 3-0-2 with Umeko and Midori beside her.
   Fix: raise Hotaru's `dmg` to ≥ 1.052 (1.06 leaves a margin), or stop the Firefly Halo shape costing her own bolts
   at tier 3.
2. **Momo 2-0-4 alone on a held boss is 2.3% under live.** `--support none`, boss, 6 seeds: live 5,443 → 5,320
   (×0.977). 5 of 6 seeds are under (−0.2% to −4.2%). f1fd0681 reads the same, so the cause is earlier r5 work. Her
   2-0-3 (×1.03) and 2-0-5 (×1.011) pass.
   Fix: raise Momo's `dmg` 1.03 → ~1.06 (`src/data/balance.js:80`), or find what changed in her 2-0-4 boss hit.

The 279-cell claim is true, but only with Umeko and Midori supporting. Both misses show up only without them. Add
`--support none` and the tier-4 builds to the ship gate.

### MEDIUM

3. **LR Tenka's Joint Research lab with a full team is 72× the best Kage T5.** `labBench` reproduces it: crowd
   176.9M (×72.5), boss 184.4M (×68.4). At f1fd0681 it was 96.7M / 83.4M. The lab's weapons read `t.eff.damage`
   (`src/sim/lab.js:182`), so they take the whole ×11.5 LR `t5` row. That row was written to lift "her own bolts"
   (`src/data/balance.js` comment). This is within the owner's "never a cap" rule, but it is the most extreme number
   in the game. The owner should confirm the lab weapons are meant to take the premium. If not, divide the LR `t5`
   row out of the lab weapons' spec.
   Numeric safety checked and fine:
   - Damage is plain doubles (exact well past 1e15).
   - The co-op hash already covers HP ≥ 2^27 with its high-part term (`simHash.js:49`).
   - `fmtNum` shortens through k/M/B/T.
   - Akane's live crowd is already 5.39B on the ability bench, so these magnitudes are not new.
   - Nothing on the damage path rounds to Int32 or uses fround (grep of `src/sim`).

### LOW

4. The girl page footnote (`src/ui/girlView.js:176`) shows `POWER` rows only. It never mentions the LR rows: Tenka's
   ×11.5 / ×22.5 and the duo's ×2.35 are invisible outside battle. The battle drawer shows them, because they sit in
   `eff.damage`. Consider an "LR form" line on the footnote.
5. OVERTIME makes the one-time Eclipse Wyrm achievement (`a_fp_wyrm`, 100 gems) and the `wyrm` milestone (a frame,
   0 gems) reachable. This is intended. They pay once, so this is not a farm.

## Re-run tables

**r5Bench sweep.** 31 girls × 3 paths × tiers 1–5 × boss / walking boss / crowd = 1,395 cells per side, Umeko and
Midori supporting. T5 uses seeds 9/1/2; T1–T4 use seed 9.

| tier | cells | min ratio branch / live | cells under live |
|---|---|---|---|
| T5 | 279 | 1.000 | **0** (the claim holds) |
| T3 | 279 | 1.000 | 0 |
| T1, T2, T4 | 837 | 0.62 on seed 9 | 6 on one seed, all walking boss |

On 8 seeds all six T1/T2/T4 cells are at or above live, and each equals f1fd0681 (seed noise):

| cell | live | branch |
|---|---|---|
| Kaede 2-0-4 | 1,951 | 3,635 |
| Noa 2-0-1 | 41 | 44 |
| Noa 2-1-0 | 20 | 22 |
| Noa 2-2-0 | 20 | 22 |
| Suzu 2-2-0 | 319 | 579 |
| Noa 2-0-4 | 261 | 277 |

**The same sweep with no supports** (all 1,395 cells, seed 9): two cells under live, findings 1 and 2. Both are
confirmed on 6 seeds.

**Kage**, branch vs live (r5Bench): crowd 2.44M vs 1.82M. Hotaru's 5-0-2 crowd is 8.67M; the LR rows sit at ≥ 2.59×
Kage, per the doc.

**Freeplay** (`capBot --build A2 --profile full`, Blossom Normal, seed 7):

| stage | live falls at | branch | s / wave at 200–249 (live → branch) |
|---|---|---|---|
| 1-5 | 225 | **270+** (no leak; the Wyrm is killed) | 56.2 → 50.9 |
| 4-5 | 220 | **250** (dies to the Wyrm) | 57.8 → 51.5 |
| 8-5 | 224 | **250** (the Wyrm walks through) | 61.5 → 57.7 |

Rewards:
- Freeplay pays a flat 40 coins × `rewardMul` per wave (capped at the stage's normal coins per wave), a cache every
  25 waves (Tomes capped at 2 a week, a Needle once a week), ≤ 10 tokens a run, and one-time milestones. No wave
  225/250 milestone pays gems.
- Waves 200–250 now run about 10% faster than live. That is about 2.8k coins an hour on Blossom against live's 2.6k,
  the same as the existing rate at waves 150–200 (50.5 s a wave).
- Each run now lasts 25–46 more waves: about +1–2 caches and +1.0–1.8k coins a run.
- **Not farmable.** Only enemy numbers moved in `src/data/freeplay.js`. Every player-side value only rose: balance
  rows, the LR rows and `SPIN_ARMS_SHARE` are additive.

**LR gating.** `powerFor(..., { lr: us.lr === true })` (`src/sim/mods.js:1027`) is the only path to `lrRowFor`.
`us.lr` is set from the Limit Break in `unitBattleStats`, and the co-op loadout checks it as a BOOL
(`statLimits.js:59`). A non-LR copy (UR, `--no-lr`) does not read the rows.

**Determinism.**
- `tools/simId.mjs` gives `0dd9e6460b51`, matching `PENDING_BUMP {13}`. Live is `be940ecb2087`, f1fd0681 is
  `daca12604a84`. COOP_PROTOCOL 13 is unchanged, which is correct while unshipped.
- `src/sim/mirrors.js` is in the hashed set: a one-character edit changed the id, and it was then restored.
- The mirror copy now carries `scale`, the volley's damage share. A copy without it would have dealt a full shot, so
  this is a fix, not a buff loophole.

**Suites** (at 5a2fbf84):
- `npm test`: 399 files passed, 2 skipped; 6,271 tests passed, 11 skipped, 0 failed (520 s).
- `node e2e/engines.mjs`: OK. V8 and JavaScriptCore computed identical runs for every scenario: S1–S4, Tenka, abilities, freeplay, the Wyrm and the checkpoints. Firefox and WebKit are not installed here.
- `node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (678 ok lines, rc 0).
