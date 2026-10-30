# Balance round 5: final review, round 3 (`feature/balance-r5` at ff94f402)

Independent re-review of `git diff 7b042643 ff94f402`: Noa's row ×1.04 damage; the duo's non-LR row ×1.01 → ×1.12;
`noNerfGate.mjs` (seeds 9,1,2 on every tier, the missing-cell count, the LR-off pass, the L1/L40 bare profiles); the
"their LR form" footnote; the re-pins; `duoBeam`'s `powerOff`. No product code was changed. Live is `origin/main`
a741aef7 (checked), with the three bench tools copied in as untracked files, so they read live's `src/`.

**Verdict: OK.** Nothing found that makes a player's unit weaker than live. Two LOW notes are below. Neither blocks.

## Gate (my run: tool defaults, both support settings, live vs branch)

| Supports | cells | missing | under live ×0.995 |
|---|---:|---:|---:|
| none (maxed, L1, L40, LR off ×3) | 4,455 | 0 | **0** |
| Umeko + Midori | 4,455 | 0 | 6 |

The six are exactly the cells claimed: Sango 2-0-4 crowd L1, Shiro 2-0-1 crowd / 4-0-2 boss / 5-0-2 boss L1,
Midori 2-0-3 walking boss L1, and Suzu 5-0-2 held boss L40 (152 → 0: a trap girl hits a parked boss on 1 seed in 16).
On seeds 1–16 they read the same as the doc (live → branch): Sango 4,001 → 4,339; Shiro 126 → 135, 5,097 → 5,394,
99,233 → 105,027; Suzu 28.5 → 31.9. Midori reads 3.6 → 3.4 on 16 seeds because `measure` rounds to a whole number.
Run over 400 s, her 16 seeds total 48 live and 60 on the branch, so she is not under. Sango and Shiro 2-0-1 go
further to 48 seeds: 3,985 → 4,301 and 126.8 → 137.9.

## Checks

- **Only the duo moved between ×1.01 and ×1.12.** I put ×1.01 into a scratch copy of ff94f402 and ran tier 5, maxed
  and L40, with supports, for the duo, Noa, Kaede and Umeko. Every Noa, Kaede and Umeko cell is identical. All 36 duo
  cells rise by ×1.1089–1.1089 (= 1.12 / 1.01), including the LR-off cells.
- **7-3 Hard goldens.** These are the scripted bot's plan, not a weaker unit. From 7b042643 the only data change is
  Noa ×1.04 (a buff) and the duo, who is not in either team. The teams are full (Wakaba, Noa, Suzu, Midori, Yuzuha,
  Shiro, Umeko, Kage, plus Nami) and base (Noa, Suzu, Midori, Shiro, Umeko, Kage, Sango, Yuki, plus Nami). The bot
  plays at about L35 with no gear, which is closest to the L40 profile. At L40, the lowest cell per girl against live
  (cells over 20 dps) is: Noa 1.04, Suzu 1.78 alone, Midori 0.999, Yuzuha 3.59, Shiro 0.995 (supported), Umeko 1.05,
  Kage 1.00, Sango 1.00, Yuki 1.36. The one exception is Suzu's held-boss noise cell. Wakaba is a pure buffer (row buff
  ×1.05). Against live itself: full 7-3 Hard is L15 live → W29/12; base is L15 → L14; the 19-girl team is L14 → W29/6.
- **duoBeam `powerOff`.** `powerOff` only sets `rows: false` in `powerFor` (`src/sim/mods.js:1027`). The STRONG preset
  has no `lr`, so it removes exactly the ×1.12 row. The OLD table was recorded at b5c272e8, before round 5, so the
  test now compares like with like. Its tolerances (3% held and crowd, 6% walk-through) are unchanged. All rows are
  within them (−4.9% … +1.8%), and a ±12% row change would still fail them. The test still means something.
- **Sim id.** `simId().id` = `3e9875ef40f9` = PENDING_BUMP 13 (`tests/art/itemArtRuntime.test.js:210`).
- The footnote, `LOW_PROFILES`, `profile` passthrough and missing-cell exit code read correctly.

## Findings (LOW)

1. **Two seed counts are under by the round-2 bar.** Round 2 used "every running mean from 3 seeds up".
   On seeds 1…3 only, Sango 2-0-4 crowd L1 and Shiro 2-0-1 crowd L1 are under live. Every N from 4 to 48 is above, and
   so is the gate's own set 9,1,2. Noa ×1.04 also fails at N = 1 and 2, so the bar is a choice either way. I read this
   as noise (Sango's per-seed range is 2,900–5,781). Fix if the owner wants the letter of the rule: none needed, but
   `docs/BALANCE.md:334` could say "seeds 1–3 dip, 4–48 above" for these two.
2. **`tests/sim/links.test.js:466` timed out under load.** It has the default 5 s timeout and took 6.1 s while the gate
   ran. It passed alone (20/20). Fix: give it an explicit timeout (for example `}, 60000);`), like the other
   battle tests.

## Counts

- `npm test` (full, while the gate ran): 401 files, 6,283 tests: 6,271 passed, 11 skipped, 1 failed (the timeout
  above; it passes alone).
- `node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (678 ok, 0 fail).
