# Review r2: Tryout Day Pep Talks list (fixes for r1)

- Branch `feature/tryout-pep-talks` at `0abb2d73`. The diff reviewed is `36470e58..0abb2d73`, read against `review-r1.md`.
- The reviewer is fresh and did not build this change or review round 1 (HANDOFF §6 review gate).
- Date: Oct 30.

## Verdict: **OK**

All nine r1 findings are fixed. One new cosmetic LOW (N1) can ship as it is or get a one-line fix.

## What was run

| Check | Result |
|---|---|
| sim id (`tools/simId.mjs`) | `be940ecb2087`, unchanged. None of the changed files is in the hashed set. |
| `npm test` (full suite, once) | 387 files passed, 2 skipped; **6178 tests passed, 11 skipped, 0 failed** |
| `node tools/cssFloor.mjs` | 266, at the baseline of 266 |
| `node tools/contrast.mjs` | 190/190 pass |
| `node e2e/smoke.mjs` | 679 ok, **ALL SMOKE CHECKS PASSED** |
| `node e2e/tryout.mjs --viewports 844x390,1280x720` | 370 ok, **all checks passed** |
| `node e2e/tryout.mjs --viewports 390x844 --slow` | 179 ok and 5 FAIL. All 5 are the known, out-of-scope ones: Before Class "above the foot" ×4 and the Marble Jar's sideways scroll. Every Pep Talks check passes. |
| `node e2e/tryout-coop.mjs` ×2 | Run 1 used a scratch copy with an extra screenshot step: 40 ok, all passed. Run 2 used the stock script: 40 ok, all passed. |

No run failed under load.

## Each r1 finding

- **F1 HIGH: fixed.**
  - `twistsNow` (`src/ui/battle/tryout/pepTalks.js:88`) reads `t.dare.id`, because the sim's `dareOf` returns the object. `tryout.js:241` uses `twistsNow`.
  - The unit tests build the Dare with the real `dareOf` and add a Grade twist. They also cover every curse and the "no base" case.
  - The e2e now opens the list mid-period with the Dare on and a twist set. It saw "Double Dare this period: swift / shielded / regenerating foes" and "Grade twist this period: …" at all three sizes. The builder's shots show the same.
  - `pepsSig` now uses `t.dare?.id`.
- **F2 MEDIUM: fixed.**
  - The tracker-head opener is now the kit's `.ui-hit` around the drawn button (`tryout.js:231`, `tryoutBattle.css:291`). Its margins keep the band's height.
  - The × is `--tap` (`tryoutBattle.css:564`).
  - Measured by the e2e: opener 57×44 (844), 128×48 (1280) and 57×48 (390); × 44 to 48. `elementFromPoint` at the drawn button's corners hits the opener.
  - The hit hangs about 18 px into the tracker body, which has nothing to tap there.
- **F3: fixed.** The switch label wraps. At 390 it reads "Double Dare: on · regenerating foes" in full (`shots-r2-review/dare-label-390x844.png`).
- **F4: fixed.**
  - `teamDrawback` (`pepTalks.js:18`) covers foeHp and maxHearts, which matches X01 and B08 in the data.
  - In co-op, Yours lists "Hundred Points (partner's): … Team-wide", checked live (`coop-yours-partners-drawback.png`). The partner's tab names it "(yours)" from the other side.
- **F5: fixed.** The photo passes `refills: null`, so no count shows. A live 0 reads "No free upgrades left".
- **F6: fixed.** Back to class comes before the Pep Talks button, and the bar is now 700 px wide. The e2e checks that Back to class is on the first row at 844 and 1280.
- **F7: fixed.** `pepsSig` covers every player's cards. The co-op e2e saw "Partner · 2 → Partner · 3" while the list was open.
- **F8: fixed.** Each Yearbook chip sits in a `.ui-hit` slot of `--tap` height with `row-gap: 0`, so the targets do not overlap. The Yearbook e2e still opens a card page.
- **F9: fixed.** The co-op e2e stages cards on both Sims while both locksteps are held, the same way the vote step is staged. It asserts the partner's rows, X01 on Yours and the live count, then removes its extra card. No assertion was weakened.

## Determinism and safety

- No `Math.random`, `Date` or `performance` in the changed code, and no `send`. Co-op tabs only switch local state.
- The e2e edits are display checks. The Dare now stays on for one period; the sim turns it off when a period starts, and every later check still passes.
- No other game's or anime's name appears in the diff.

## New findings

### N1 LOW: the "Team-wide" tag breaks across lines
- **Where:** `src/ui/styles/tryoutBattle.css:592` (`.ty-pep-team`).
- **What happens:** when the tag follows a long drawback line, it wraps at its hyphen into "Team-" / "wide" (co-op, the partner tab at 1280x720: `shots-r2-review/coop-partner-teamwide-wrap.png`).
- **Fix:** add `white-space: nowrap; display: inline-block;` to `.ty-pep-team`.

### Nits (no action needed)
- The e2e Dare-label check (`e2e/tryout.mjs:617`) reads the label before it repaints. At 844 and 1280 it saw "off · …" right after the switch turned on, so it proves "not cut" on the off text. The 390 run read "on". The screenshots show the "on" label in full.
- In co-op the tabs are in seat order, so seat 2 sees "Partner · n" first and "Yours" second. This is consistent, but "Yours" first may read better.

## Look
I zoomed in on the panel edges, the tracker head at 390, and the break bars at 390 and 844:
- The chamfers and the ink head are clean.
- The × sits inside the band.
- The bottom sheet at 390 is at most 75% of the screen.
- There is no sideways scroll in the battle layer.
- Contrast is unchanged.
