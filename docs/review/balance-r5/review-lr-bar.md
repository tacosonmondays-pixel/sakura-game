# Review: the LR bar (feature/balance-r5 04bcc258, diff from b2f4345c)

**Verdict: OK.** Every LR build clears 1.25× the true bar on the round-5 bench, including a stronger crowd build the bar
missed. The LR-off copies are unchanged and the no-nerf gate matches the claim. Five non-blocking findings are below.

## Reproduced
- `lrBar.mjs --bar` gives the pinned bar exactly: crowd Akane p0t5 16,470,821; boss Iroha KNOWN 5.96M.
- `lrBar.mjs` gives every LR build ×1.39–1.40 crowd and ×2.36–4.74 boss (exit 0), the same as the BALANCE.md table.
- The diff touches only `LR_ROWS` t5 values, tools, tests and docs (no `src/sim` change), so the non-LR cells stay identical.

## Hunt for missed non-LR builds
Scratch probes ran a copy of `r5Bench.measure` with free tiers and supports (3 seeds unless noted).

| Probe | Best crowd | Best boss |
|---|---:|---:|
| Bench (Umeko 2-5-0 + Midori 5-0-2) | Akane 5-0-2 16.47M | (Iroha KNOWN 5.96M) / Aoi **0-2-5** 4.40M |
| Other crosspath (5-2-0, 0-5-2, 0-2-5), seed 9 | Akane 5-2-0 16.28M | Aoi 0-2-5 4.40M |
| Tiers 3–4, every crosspath, seed 9 | Tenka 4-2-0 1.88M | Tenka 4-2-0 0.62M |
| Abilities on Auto, seed 9 | Akane 11.81M (lower) | Aoi 4.40M |
| Heroes, Lv 25 + Mastery | Kanna 8.10M | Kogane 1.78M |
| Bare L40, no gear | Akane 0.47M | Shiro 0.21M |
| Single-support screen (every girl × 3 paths) | Umeko 2-5-0 is best, then Midori 2-0-5, Miko 5-0-2 and Chika x-5-0 (Wakaba is weaker) | |
| **Umeko 2-5-0 + Chika 2-5-0** | **Akane 5-0-2 17.40M** | Aoi 3.98M |
| Umeko + Midori 2-0-5 | Akane 16.59M | Aoi 3.80M |

The true crowd bar is **17.40M**. The weakest LR crowd (duo Constellation, 22.84M) is ×1.31 of it, so the 1.25× rule still holds.

## Findings (non-blocking)
1. **The bar misses the Umeko + Chika pairing** (`tools/balance/lrBar.mjs:31-34`): Akane 5-0-2 makes 17.40M with Umeko + Chika, 5.6% over the pin. Fix: re-pin the crowd to 17.40M (Akane, Umeko + Chika) or add it to `KNOWN`, and update the BALANCE.md table. The test still passes at ×1.31.
2. **The margin only holds on this bench.** When both sides get the same non-default supports, Tenka Joint Research 5-0-2 crowd falls to ×1.24 of Akane with Umeko + Chika, and to ×1.16 with Umeko + Midori 2-0-5 + Chika. LRs still win every time, but not always by 1.25. Fix: none needed in code. Tell the owner in BALANCE.md that the 1.25× margin applies to the fixed bench only.
3. **The bar checks only one crosspath per path** (`lrBar.mjs:68`, `r5Bench.mjs` `CROSS`): it misses Aoi 0-2-5 on a boss (4.40M), which would be the second-best live boss after Iroha's pin. This doesn't change the result, but `--bar` without the Iroha pin would understate the boss bar. Fix: have `--bar` try both crosspaths.
4. **Stale comment** (`src/data/balance.js:107`): it says the boss bar is "Tenka's lab… 3.55M", but `LR_BAR` pins Iroha at 5.96M. Fix: change the comment to match.
5. **The Iroha pin can't be reproduced or checked.** The 5.96M / 8.70M come from a ~200-layout search on `feature/iroha-mirrors`, and that search isn't committed on either branch. `lrBar.test.js` only compares constants to each other (`LR_BAR ≥ max(KNOWN)`), so nothing breaks when Iroha merges, and nothing notices if her review changes those numbers. After she merges, `--bar` measures her on Auto (2.77M / 6.96M) and can't see the layout. The re-pin note ("re-pin when a unit is raised or merged in", `lrBar.mjs:29`) doesn't name a tool or say what to do when Iroha merges. Fix: record her layout (mirror coordinates) or commit the search, and add a HANDOFF/BALANCE line: "When iroha-mirrors merges, re-run her layout search, update `KNOWN`, re-run `lrBar.mjs`".

## Numeric safety (10^8–10^9)
- `simHash`: it hashes enemy HP, not damage, and enemy HP has a high part above 2^27 (`simHash.js:49`). Damage counters aren't hashed, so they can't overflow it.
- Display: floating numbers and the DPS view use `fmtNum` 'count', which shortens to k/M/B/T (`BattleRenderer.js:555`, `format.js:56`), so 446M shows as "446.4M".
- Co-op: `e2e/engines.mjs` runs Rail Arms tier 5 in the LR form (×3.5) in its Tenka battle, and V8 and JavaScriptCore produce identical results. The re-pinned hash is 74403ee3.

## No-nerf gate (origin/main c6d06118 vs 04bcc258, 4,455 cells each)
- Alone: 0 missing, 0 under.
- With supports: 0 missing, 6 under. They are the six known cells: Sango 2-0-4 crowd L1, Shiro 2-0-1 crowd / 4-0-2 / 5-0-2 boss L1, Midori 2-0-3 walking boss L1, Suzu 5-0-2 held boss L40. All are already explained in BALANCE.md.

## Counts
- `npm test`: 400 files passed, 2 skipped; 6274 tests passed, 11 skipped.
- `node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (678 ok lines).
- `node e2e/engines.mjs`: OK, 3 runs on 2 engines (Firefox and WebKit not installed).
