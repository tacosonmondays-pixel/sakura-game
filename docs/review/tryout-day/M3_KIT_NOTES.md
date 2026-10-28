# Tryout Day M3: the Ink & Paper kit pieces to build on

From the menus session (branch `feature/ui-v2-menus`, Oct 28). Merge source: `feature/ui-v2-menus` at the stable sha it
sends once origin/main is merged into it. Everything below exists there unless marked otherwise.

## Do not edit (lock-held by the menus work)

`ink.css`, `kit.js`, `components.js`, `sheet.js`, `badges.js`, `wallets.js`, `motion.js` / `motion.css`, `base.css`.
Exceptions: appending glyphs to `src/ui/lineGlyphs.js` and adding a `tryout` entry to `src/ui/hostLines.js`. Tryout rules
go in `src/ui/styles/tryout.css`, scoped under `.ui-day` to its own screens. Anything that belongs in the kit goes to
the menus session as a request.

## Hub (`#/tryout`)

- Host: `hubHost(screen, profile, { state, guest, mode, testid })` / `listHost(...)` (`src/ui/hubHost.js`); Wakaba's
  lines come from a `tryout` entry in `src/ui/hostLines.js`.
- Tiles: `hubTile({ title, kicker, line, art, corner, sticker, lock, dot, sm, onClick, testid, cls, label })` in
  `kit.js` — **on M5, not merged yet** (`wip/ui-v2-menus-m5`). Locked = `lock: 'rule text'`; fresh = `sticker` or `dot`;
  done = the line text.
- Countdown: `countdownChip(msLeft, { label, testid, now, doneText, cls, urgent, onDone })`; `urgent: false` for the
  weekly reset.
- Continue band: no builder; a `.ui-panel` with small `girlTile`s and one line.
- Wallet: no registry yet (`registerWallet({ id, item, art|glyph, label, plus, screens })` comes in the menus' M6 kit
  commit). Until then Marbles stay in the hub's own panel; never edit `wallets.js`.

## Before Class

- Map cards: `.ui-opt` (options with `aria-pressed` / `.on`) or a `.ui-panel` with a thumbnail (stage prep's pieces
  are not exported).
- Primary: `button.ui-hit > span.ui-btn.pri` (the one yellow); disabled = `ui-hit:disabled` plus one muted reason line.
  Secondary: `secondaryBtn(label, { icon, onClick, testid, title, disabled, reason, cls })`.
- Hero picker: none exported (Formation's is private): build one from `.ui-opt`.
- Grade stepper: a row of `.ui-opt` buttons (44 px), two rows on phones (`.ui-seg` is a pip bar, not a control).

## Girl tiles

- `girlTile(unitId, { onClick, owned, level, selected, profile, potential, rule, testid, cls })`
  (`src/ui/components.js`): her real frame, role glyph, LV, P chip, selected state.
- Pencil (Yearbook, not owned): `owned: false` with `rule: 'Not in your class yet'`.
- "Yours · band cap" / "Loaner": our own `.ui-chip.ink` above the caption, never over her face
  (`src/ui/faceAnchors.js`). No attack-type glyph on the tile.
- Yearbook girl page: `namePlate(unit, profile, { onPotential, potTestid })`, `potSticker`, `potPips`
  (`src/ui/girlFrame.js`).

## Kit

- `.ui-panel`, `.ui-btn` (`.pri` / `.sec`), `.ui-chip`; sheets: `openSheet({ title, body, full, testid, cls, onClose,
  head })` (`src/ui/sheet.js`) for the Class Photo and Make-up sheets.
- Left rail: `sideRail(tabs, active, onPick, { testidPrefix, label, cls })` → `.ui-srail` (Jar shelves, Yearbook);
  progress as a `.num` ("3/12") in the tab.
- `moreSticker(onClick, { testid, label })`, `folderTabs(...)`, `rarityTag(rarity, { testid, ring, title })` (navy
  plate pill).
- Glyphs: `LINE_GLYPHS` in `src/ui/lineGlyphs.js` — inner SVG on a 24×24 viewBox, stroke only (currentColor, 2 px,
  round caps), no fill; add a `GLYPH_GROUPS` row; draw with `lineGlyph(name)` / `ico(name)`. Our own drawings need no
  credit line: list them in the "our own drawings" comment. Planned: marble, eraser, hall-pass, desk, stamp, chalk.

## Tokens

`--rar-r` … `--rar-lr`, `--frame-w` (2 px), `--frame-w-strong` (3 px) in `base.css`. Frame steps 1-4 are drawn by
`ink.css` for `.ui-girltile.sr/.ssr/.ur` (GIRL_STEP in `components.js`); the Pep Talk "Stationery" frames copy that
recipe into `tryout.css` with the same tokens (§13.1: UR = gold foil, LR = Pressed Blossom, never rainbow/Nightglass).

## Out of scope for the menus

The in-battle pieces (pick sheet, tracker, break bar, timetable strip) follow the battle HUD.
