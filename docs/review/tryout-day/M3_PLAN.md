# Tryout Day M3: the Ink & Paper screens (plan)

Starts after v0.1.56 (the ultimates) is on main: merge origin/main once, then `feature/ui-v2-menus` (0956ec4 or
later), then build. Kit pieces and the don't-edit list: `M3_KIT_NOTES.md`. Spec: `docs/specs/TRYOUT_DAY.md` §13. No sim
change: M3 is menus and battle chrome only, so the sim id and the co-op tests must not move.

## 1. Screens → kit pieces

| Screen (spec) | Today (plain) | M3 build |
|---|---|---|
| Hub `#/tryout` (§13.2) | `src/ui/screens/tryout.js` panels | `hubHost('tryout', …)` with Wakaba (a `tryout` entry in `hostLines.js`: fresh / run in progress / weekly done / locked lines); `hubTile`s for Start, Weekly Timetable (`corner: countdownChip(ms, { urgent: false })`), Marble Jar, Yearbook, Records; a Continue band as a `.ui-panel` with small `girlTile`s; Marbles via `registerWallet({ id: 'marbles', … screens: ['tryout', 'tryout/jar', 'tryout/yearbook'] })` |
| Before Class (§13.3) | hub panel | map cards as `.ui-opt` with thumbnails; the six as `girlTile`s (`selected`, our `.ui-chip.ink` "Yours · band cap" / "Loaner" above the caption); hero picker from `.ui-opt`; Grade stepper `segRow` (1-12, locked items say why) with the twist line under it; Half / Full Day `.ui-opt`; **Start class** `button.ui-hit > span.ui-btn.pri` with its reason line |
| Marble Jar (§10.3, §13.10) | `src/ui/screens/tryoutJar.js` | `sideRail` shelves (Desk Supplies, Cosmetics, Materials) with counts as `.num`; items as `.ui-panel` cards, one primary per card; switches for perks |
| Yearbook (§10.4, §13.10) | `src/ui/screens/tryoutYearbook.js` | `sideRail` (Students n/29, Pep Talks, Bosses, Records); students as `girlTile` (`owned: false, rule: 'Not in your class yet'` = pencil); a girl page with `namePlate` |
| Class Photo / Make-up sheets (§13.9) | battle overlay sheets | squad in two rows of `girlTile`s (hero at the side), the stamp grid, reward lines, **Again** primary; Early Dismissal title; Practice ribbon. In-battle, so it stays in the battle layer, restyled with kit tokens (not `openSheet`, which is a menu sheet) |
| Co-op room (§13.10) | `src/ui/screens/coop.js` tryout panel | the same girl tiles, `segRow` for Grades, `.ui-opt` for map and length |

In-battle pieces (pick sheet, tracker, class bar, break bar, timetable strip §13.4) follow the battle HUD, not the menus:
M3 gives them the Stationery card frames (§13.1) and the timetable strip, nothing else.

## 2. Stationery card frames (§13.1)

`--pep-r` … `--pep-lr` in `src/ui/styles/tryout.css`, copying `ink.css`'s girl-tile step recipe with the shared tokens
(`--rar-*`, `--frame-w`, `--frame-w-strong`): R flat, SR tinted, SSR glow, **UR gold foil (one glint on reveal), LR
Pressed Blossom** (navy face, pressed sakura, gold-leaf corner). Never rainbow or Nightglass on a card. Labels:
`rarityTag(r)` (navy plate pills).

## 3. Line glyphs (append-only in `src/ui/lineGlyphs.js`)

marble, eraser, hall-pass, desk, stamp, chalk (24×24, stroke only, currentColor, 2 px, round caps), a `GLYPH_GROUPS`
row and the "our own drawings" comment.

## 4. Files

New or rewritten: `src/ui/screens/tryout.js` (hub), `tryoutSetup.js` (Before Class, split out of the hub),
`tryoutJar.js`, `tryoutYearbook.js`; `src/ui/battle/tryout/timetable.js`; `src/ui/styles/tryout.css` (scoped under
`.ui-day` for menus); `src/ui/hostLines.js` (one entry); `src/ui/lineGlyphs.js` (append). Untouched: the kit's
lock-held files, `src/sim/**`, `src/data/tryout.js`.

## 5. Tests and checks

- Unit: the named-import test (`tests/ui/tryoutScreensLoad.test.js`) extended to the new files; a host-lines test that
  every Tryout state has a line; `tests/tools/cssFloor.test.js` (12 px) and `tests/ui/contrast.test.js` on the new CSS.
- e2e (`e2e/tryout.mjs`): every existing check keeps its testid (or is moved with it), plus: the hub tiles' states
  (locked before 2-5, Weekly locked before Grade 4, countdown shown), Marbles in the top bar on Tryout routes only,
  the Grade `segRow` (a locked tap says why), Before Class tiles selected, the Jar rail, Yearbook pencil tiles, no
  horizontal scroll at 844×390 and 1280×720.
- `e2e/tryout-coop.mjs` at both sizes; `e2e/smoke.mjs`; `vite build`.
- Review gate: an independent review of look (screenshots at both sizes) and logic; the M3 board under
  `docs/review/tryout-day/m3/`.
