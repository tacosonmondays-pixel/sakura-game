# Balance round 5: final review, round 2 (`feature/balance-r5` at 7b042643)

Independent re-review of `git diff 5a2fbf84 7b042643`: Hotaru ×1.06; Momo's Coin Wheel toss coins ×0.98 → ×1 and her
row ×1.06; `tools/balance/noNerfGate.mjs`; the LR footnote (`lrBoostText`); the re-pins. No product code was changed.
Worktrees: live `origin/main` a741aef7 (v0.1.63; `git rev-parse origin/main` checked), 5a2fbf84, and 7b042643. Live
has no round-5 tools, so `noNerfGate.mjs`, `r5Bench.mjs` and `maxedProfile.mjs` were copied into the live worktree as
untracked files. They import `src/` relative to their own folder, so the live side really runs live's sim and data:
for example Kaede 2-0-4 on a held boss reads 78,900 live and 144,338 on the branch.

**Verdict: NOT OK, one small fix.** Both misses from the last review are fixed and every gate is clean. One cell still
breaks the coordinator's rule that "below live on average at any seed count is a nerf": Noa 2-0-3 on a walking boss
with supports. I think it is seed noise, but the rule is explicit, and the fix is one number.

## Findings

### MEDIUM (fails the rule as given)

1. **Noa 2-0-3, walking boss, Umeko + Midori (`src/data/balance.js:75`).** Live vs branch, seeds 1…N:

   - 64 seeds: live 54.7, branch 57.8 (×1.057).
   - Seeds 9/1/2 (the gate's own set): live 171, branch 169.
   - Running prefixes 1…N: the branch is below live at N = 1, 2, 4–7 and 10–15 (worst N = 12: 660 vs 682, ×0.968).
   - Alone (`--support none`), 32 seeds: bit-identical per seed. Her own kit did not move; only the supports did.

   It is real by the rule, though it looks like noise: her number is tiny (about 55 a second) and one seed swings by ±10%.

   **Fix: `noa: { dmg: 1.04, buff: 1.05, reach: 1.1 }`.** Tested in a scratch tree on 64 seeds:

   | Noa `dmg` | 64-seed mean (live 54.7) | Seeds 9/1/2 (live 171) | Prefixes below live |
   |---|---:|---:|---|
   | none (today) | 57.8 | 169 | 1, 2, 4–7, 10–15 |
   | 1.02 | 58.8 | 172 | 1, 2, 12 |
   | **1.04** | 59.9 | 175 | 1, 2 |
   | 1.06 | 61.1 | 178 | 1 |

   Seed 1 alone needs ×1.10 (live 57, branch 52). Chasing single seeds is not meaningful, so ×1.04 is the smallest row
   that holds every count of 3 or more seeds. The change moves the sim id, so it needs a new PENDING_BUMP, a new
   mods hash and new engines pins, plus a gate re-run.

### LOW

2. **`docs/BALANCE.md:311-315` cannot be reproduced with the tool's defaults.** With the defaults (tiers 1–4 on seed 9),
   the supported sweep gives 6 cells under live, not 1 (table below). The same six appear in the last review's
   table. The doc's single Noa 2-0-3 cell (57 → 56) matches `--seeds 9,1,2` on every tier, and its "8 seeds 440 vs
   438" did not reproduce (seeds 1–8 give 442 vs 442).
   Fix: state the exact command and seeds. Make `--seeds 9,1,2` the default, or list the six cells with their
   16-seed results.
3. **Gate blind spots.** I covered these by hand; none hid a nerf:
   - Heroes are excluded (`noNerfGate.mjs:38`). Statically, every `HERO_POWER` value and every `POWER` value is ≥ 1.
     The hero kits are identical to live except Kanna's Lv 24 quake rings, which only add.
   - LR units are measured only at LR. I ran the duo and Tenka with `lr: false`: 90 cells per support setting, 0
     under live.
   - Only the maxed profile is measured. I sampled two bare profiles (L1 ★0, and L40 ★3 with 4 gates and P2, no gear)
     on 10 girls (Hotaru, Momo, Kaede, Kage, Noa, Suzu, Aoi, Rei, Kinu, Iroha), all paths, tiers 1–5, three targets,
     alone, seeds 9/1/2: 450 cells each, 0 under.
   - `--compare` silently skips cells that are missing or errored on one side (`noNerfGate.mjs:63`). Nothing was
     skipped here (0 errors, 1,395 = 1,395), but the skips should be counted and printed.
   - Stage 4-5 only.
4. **Footnote nit.** The wording is clear, and the footnote shows only for `tenka` and `kohaku_tsubaki`. Every other
   unit returns the old text or `null`. The duo's text says "her LR form", where "their" may read better for a duo.

## Gate tables (my runs, default seeds: tier 5 on 9/1/2, tiers 1–4 on 9)

| Supports | t1 | t2 | t3 | t4 | t5 | under |
|---|---:|---:|---:|---:|---:|---:|
| none | 0/279 | 0/279 | 0/279 | 0/279 | 0/279 | **0** |
| Umeko + Midori | 2/279 | 2/279 | 0/279 | 2/279 | 0/279 | 6 |
| LR units with `lr: false` (none / um) | 0/18 | 0/18 | 0/18 | 0/18 | 0/18 | 0 / 0 |
| Bare L1 / L40 profiles, 10 girls | 0/90 | 0/90 | 0/90 | 0/90 | 0/90 | 0 / 0 |

The six supported cells are all walking boss. Over 16 seeds (1–16) the branch is above live on every running prefix:

| Cell | Live | Branch |
|---|---:|---:|
| Suzu 2-2-0 | 320 | 592 |
| Kaede 2-0-4 | 2,374 | 4,024 |
| Noa 2-1-0 | 20.3 | 21.9 |
| Noa 2-0-1 | 40.8 | 43.6 |
| Noa 2-2-0 | 20.3 | 21.9 |
| Noa 2-0-4 | 265 | 283 |

The two previous misses, checked over more seeds:

- Momo 2-0-4 alone on a held boss, 16 seeds: 5,458 → 5,698 (×1.044). Every seed is at or above live; the closest is
  seed 9, 5,178 → 5,209.
- Hotaru 3-0-2 alone on a crowd, 8 seeds: 16,290 → 16,437 (×1.009). Every seed is above live, by about +0.9%. That
  margin is thin but consistent.

## Re-pins

`simId` = `1367fa81bfd2` = `PENDING_BUMP {13}`. Live is `be940ecb2087` on COOP 13, so the bump is still to be applied at
assembly, as before.

The mods hash is `456:19f2bb53`; the comment chain matches the two data steps.

All five engines fixtures contain Hotaru and/or Momo (`e2e/engines/scriptedBattle.js`: POTENTIAL_START,
POTENTIAL_BOSS_START, the abilities loadout, TENKA_START, SHAPES_START). What moved:

- **Potential:** 32 fewer ticks; the wallets are the same.
- **Potential boss:** still lost, 347 ticks later, with the wallets changed (a stronger team lasts longer).
- **Abilities:** hashSim only.
- **Tenka:** hashes and both digests; the ticks and every count are the same (Momo's ×1.06).
- **Shapes:** 5 fewer ticks; the shapes went 136/320 → 134/318 (the Coin Wheel toss coins).

All of these are explained by the change, and no outcome flipped.

## Counts

- `npm test`: 399 files passed, 2 skipped; 6,272 tests passed, 11 skipped; exit 0.
- `node e2e/smoke.mjs`: 678 ok, ALL SMOKE CHECKS PASSED, exit 0.
