# Review r1: Tryout Day Pep Talks list + Ink & Paper battle layer

- Branch `feature/tryout-pep-talks` at `d3262ed7` (base `60ce9cad`, v0.1.61). It merges cleanly with `origin/main` `0b8e234f` (v0.1.62).
- The reviewer did not build this change. The review covers look and logic (HANDOFF §6 review gate).
- Date: Oct 30.

## What was run

| Check | Result |
|---|---|
| `node -e "import('./tools/simId.mjs')…"` | `be940ecb2087` (unchanged). None of the 9 changed files is in the hashed set. |
| `npx vitest run` (full suite, on a loaded machine) | 6172 passed, 1 failed: `tests/sim/rules.test.js` "calm point 4-1" **timed out** at 5 s under load. Re-run alone: 25/25 pass. The branch does not touch the sim. |
| `tests/ui/tryoutPepTalks.test.js` | 15/15 pass |
| `node tools/cssFloor.mjs` | 266 under 12 px, at the baseline of 266 (no new ones) |
| `node tools/contrast.mjs` | 190/190 pass. The new pairs the tool does not list, checked by hand: `--on-ink-dim` on `--plate` 9.09, `--pink-on-ink` on `--plate` 8.97, `--cyan-text` on `--cyan-wash` 4.96 (Team-wide tag), `--muted` on white 5.96. All pass AA. |
| `e2e/tryout.mjs` 844x390 + 1280x720 | **0 FAIL**. Every new Pep Talks check passes at the tracker, the break bar, the Class Photo and the Yearbook page. |
| `e2e/tryout.mjs` 390x844 | Run 1 timed out clicking a Before Class tile (`tryout.mjs:817`) under load. Run 2 (`--slow`) has 5 FAILs, the same 5 as the builder's `/tmp/tpt/before-390.log` on main: Before Class "six / maps / heroes above the foot" ×4 and "no horizontal scroll in the Marble Jar". All of them are pre-existing, and every Pep Talks check passes. |
| `e2e/tryout-coop.mjs` (branch, `nice`) | Run 1: "both picks land by themselves" FAIL, then the run crashed. Run 2: **all checks passed**, including both co-op Pep Talks checks. |
| `e2e/tryout-coop.mjs` (`origin/main` 0b8e234f, `nice`) | Run 1: "both battles mount with the run UI" FAIL, then the run crashed. Run 2: "the Random Class reveal shows on both screens" and "both picks land by themselves" FAIL. |

**Co-op verdict:** main fails at the same steps under load and the branch passed clean on its retry, so the branch's co-op failures are load, not this change. Load average was 9 to 21 on 4 cores, with other sessions' e2e and vitest running.

## Logic

- **`pepLedger`, `drawbacksOf`, `varsityOf`, `deskOf`** (`src/ui/battle/tryout/pepTalks.js`) are pure. They give one row per card, or one per girl for a One girl card. A row's stack count `n` and its tiers per rarity (a Brush Up shows as the raised `r`) match `players[i].cards`. P06 refills are read from `players[i].refills`, the same map `sim/tryout/index.js:379,643` writes and spends.
- **Seat Change:** "Hall Passes per break" uses the same sum as `openBreak` (`breaks.js:251-252`: the Grade's passes + `passBonus` + the drawbacks). Seats come from `seatCount`/`seatBonus` (pure readers), the seated girls from `seats.holder`, and the moves from `players[i].moves` / `result().players[i].moves`.
- **No sim writes:** the panel never calls `send`; it only reads `seatBonus`, `seatCount`, `sim.getTower` and `sim.result()`.
- **No clock or randomness:** the new code has no `Math.random`, `Date` or `performance`. All state is in `sim.tryout`, which the snapshot serialises, so a save/reload rebuilds the same list. The e2e reload at the break confirms this.
- **Co-op:** the tabs only switch a local `pepsSlot`; nothing goes over lockstep.
- **Grade twist:** uses the UI `affixOf` (`adapters.js:145`), which returns an id, so `DARE_SHORT[id]` resolves correctly.
- **Double Dare: not correct.** See F1.

## Findings

### F1 HIGH: the Double Dare line prints "[object Object]"
`src/ui/battle/tryout.js:240`: `if (t.dare) now.push(PEP_LIST_TEXT.dareNow(DARE_SHORT[t.dare] || t.dare));`

`sim.tryout.dare` is the curse **object**, not its id:
- `dareOf` returns `{ ...list[k] }` (`src/sim/tryout/index.js:547`).
- The period log stores `ty.dare ? ty.dare.id : null` (`index.js:678`).

So `DARE_SHORT[t.dare]` is `undefined`, and the line reads "Double Dare this period: [object Object]" in every dared period, solo or co-op. That is the drawback the owner most needs to see mid-run, and the brief names it.

No test catches this. The e2e opens the list only at a break and on the Class Photo, where `t.base` is null, so the "this period" lines (the Dare and the Grade twist) are never drawn.

**Fix:** `const id = t.dare.id; now.push(PEP_LIST_TEXT.dareNow(DARE_SHORT[id] || id));`. Add a test that opens the list mid-period with the Dare on, and one with a Grade 8+ twist. The e2e already turns the Dare on at the class bar (screenshot `ty-class-844x390`), so opening the tracker's list once the next period runs covers it.

### F2 MEDIUM: the phone opener is a 24 px tap with no hit area
- **The tracker-head Pep Talks button** is the only opener during a break on phones, because `.ty-break .ty-peps-btn` is hidden at ≤700 px / ≤430 px (`tryoutBattle.css:413`). It is drawn `--h: 26px` (`tryoutBattle.css:288`), and 24 px on phones (`:411`). Nothing extends its hit area.
- **The kit's rule:** buttons are `--tap` (44/48 px, `ink.css:336`). A shape drawn shorter than a tap goes inside `.ui-hit` or carries a `::before` tap square (`ink.css:381-399`). This button does neither.
- **The panel's ×** is 40 px, and 36 px on phones (`tryoutBattle.css:554, 596`). The kit's `.ui-close` is `--tap + 4px` (`ink.css:1220`).
- **Fix:** give `.ty-peps-head` (and the ×) a 44 px `::before` hit square, as `.ui-ibtn` / `.ui-back` do. It can hang into the band and the tracker body, since the head is the top of the tracker.

The other dense battle buttons (36/32/30 px) are a step up from main's `bt-btn` (24-30 px), so they are not a regression and are not counted here.

### F3 LOW: the Double Dare curse is cut off on a portrait phone
- `tryoutBattle.css:325` ellipsizes the switch label. At 390x844 it reads "Double Dare: off · swift fo…" (screenshot `ty-peps-open-390x844`, class bar). Main wrapped it in full.
- The curse name is the one thing the player decides on, and touch screens have no tooltip.
- **Fix:** let the label wrap (`white-space: normal`), or drop the "Double Dare:" prefix on phones.

### F4 LOW: co-op omits the partner's drawbacks that also hit you
- **Which drawbacks:** X01's foe HP applies whenever *any* player holds it (`hasCards`, `index.js:573`), and B08's −10 max hearts lowers the shared `sim.maxLives` (`pep.js:338`).
- **Yours tab:** "Drawbacks and twists in play" lists only your own cards' drawbacks (`pepTalks.js:128, 131`).
- **Partner tab:** these cards are not tagged Team-wide (`pepTalks.js:36` uses `c.team`), so nothing tells the player the partner's Hundred Points makes their foes tougher.
- **Fix:** in co-op, also list the partner's run-wide drawbacks on Yours, marked "(partner's)".

### F5 LOW: the Class Photo shows "0 free upgrades left" for Free Refills
- `tryout.js:257` passes `refills: {}` once the run ended, and `pepLedger` still gives P06 rows a number (`pepTalks.js:37`), so the photo says 0 even when refills went unspent.
- **Fix:** pass a flag so the end view omits the refills line.

### F6 LOW: at 1280x720 the break bar's primary action wraps to its own row
- With the Pep Talks button added (`tryout.js:705`), "Back to class" drops to a second line alone (screenshot `ty-peps-open-1280x720`). It still works, but the primary action reads as an afterthought.
- **Fix:** move the Pep Talks button after "Back to class", or let the bar widen.

### F7 LOW: co-op tab counts go stale while the panel is open
- `pepsSig` (`tryout.js:264`) covers only the viewed slot's cards. If the other player takes a card, the other tab's "· n" count does not update until something repaints.

### F8 LOW: Yearbook Pep Talk chips are 24-28 px taps
- They are now buttons (`tryoutYearbook.js:127`, `tryout.css:237`) but keep the chip height (`--chip-h` 24/28 px in the kit), with no tap square.
- The grid is dense, so a `::before` hit area that does not overlap its neighbours may not fit. Worth a look.

### F9 LOW: the co-op e2e check has nothing to check yet
- **Coverage:** the co-op Pep Talks check (`e2e/tryout-coop.mjs:245-267`) runs right after the first Random Class pick, which is a girl, so both lists are empty (`mine 0 / partner 0`). It proves the tabs and Escape, but not that the partner's rows render.
- **Not a weakening.** No assertion was removed or loosened.

## The e2e edits (item 2)
- **`page.reload({ timeout: 180000 })`** ×3 (`tryout.mjs:496, 759, 930`) only raises the navigation timeout. Every check after a reload is unchanged.
- **`--slow`** (`tryout.mjs:91-92`) is opt-in and only raises Playwright's default action timeout from 30 s to 90 s. No assertion, threshold or step changes.
- **The Yearbook step** stamps E01 as taken through the store. This is set-up, the same as the girl-stamp step above it, and the check still fails if no card page opens.
- **Verdict:** these are legitimate harness changes; nothing is weakened or skipped.

## Look (item 4)
Screenshots: 844x390, 1280x720 and 390x844, plus the builder's board `/tmp/tpt/tryout-pep-talks-board.png`. The panel, the tracker and the break bar were zoomed in at their edges and corners.

- **Kit consistency:**
  - The tracker, class bar and break bar are now white paper, with one navy hairline and a cut top-right corner.
  - Each sheet has a bleed ink head, with its × inside the band.
  - Buttons are `.ui-btn` with one yellow per surface. Paths are `.ui-opt` and Double Dare is the kit switch. They match the menus.
  - The panel's chamfer and ring are clean at top-right and bottom-left.
  - Rarity colour appears only on the row's left edge and its tag.
- **Layout:**
  - 844x390 and 1280x720: docked right; at 1280 the board stays visible on the left.
  - 390x844: a bottom sheet at most 75% high. It opens only on tap and closes with ×, Escape or a tap outside, so it never covers the board permanently.
  - No sideways scroll, no overlap with the ability bar while closed, and no cut text inside the panel.
- **Pre-existing, not counted:** girl names cut to "Mar…" / "Su…" on girl tiles in the pick sheet and on the Class Photo.
- **Contrast:** passes (see the table).

## Names (item 5)
The diff and the commit message name no other games or anime.

## Patch note
The branch has no patch note. That is right for a feature branch; the release that ships it adds one at the top of `src/data/patchNotes.js`.

## Verdict

**NOT OK.**

- **F1 (HIGH):** the Double Dare line in the list shows "[object Object]"; it needs a test that opens the list mid-period.
- **F2 (MEDIUM):** the tracker-head Pep Talks opener (24-26 px) and the panel × (36-40 px) have no 44 px tap area.

F3-F9 are LOW and can be fixed in the same pass or noted. Everything else checks out: the logic, determinism, the sim id, the hashed files, the e2e edits and the kit look. Co-op failures are load, the same on main.
