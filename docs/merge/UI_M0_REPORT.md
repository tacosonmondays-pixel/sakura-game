# UI M0 report: tokens, type scale and number formatting

Branch `feature/ui-condense`. Draft PR: https://github.com/tacosonmondays-pixel/sakura-game/pull/23 (into `claude/sakura-sentinels`).
Spec: `docs/specs/UI_DIRECTION.md` §7 M0, built from §2–§5 and the appendix. Display only.

## Sim id

| | id |
|---|---|
| Before (`685b40b`, specs/next-wave) | `37b5428d7657` |
| After (this branch) | `37b5428d7657` |

**They match.** Nothing under `src/sim/**`, data definitions, saves or `src/online/coop/**` changed. COOP_PROTOCOL is not touched, and there is no patch-notes entry.

## What changed

1. **Tokens** (`src/ui/styles/base.css`). The §4 tokens are added to the existing `:root`, with the phone values in a `@media (max-height: 480px)` block:
   - text-safe colours, the ink plate set, and type (`--font-num`, `--fs-*`, `--lh-*`, `--track-label`);
   - space and size, including `--hud-ability-h: 0px`, which is reserved for the ability bar;
   - shape, motion, rarity, and LR Nightglass (`--rar-lr`, `--lr-edge`, `--lr-gold`, `--lr-comet`).

   No token is renamed or removed. The one value change is **`--muted` #6b7a99 → #56647f**. The old value is kept as `--muted-line`, for non-text use only.
2. **Barlow Condensed 600 and 700**, self-hosted from the fontsource latin subset, at `src/ui/styles/fonts/BarlowCondensed-{600,700}.woff2`. Each is about 22 KB (44.7 KB in the build) and loads with `font-display: swap`. The SIL Open Font License is next to them in `fonts/OFL.txt`. Only `.num` and `.lbl` use the font.
3. **`src/ui/styles/components.css`** is imported in `src/main.js` right after `base.css`. It adds:
   - `.num` (with `.s` and `.l` sizes), `.lbl` and `.ui-pair`;
   - the stat chip `.ui-chip` (`.on-plate`, `.up`/`.dn`, `.tag`, `.more-n`);
   - the ink strip `.ui-strip` > `.ui-cell` (`.num.acc`, `.ui-delta`) and `.ui-plate`;
   - stickers `.ui-sticker` and the MORE sticker `.ui-more` (it has a 44 px hit box);
   - the cost button `.ui-cost` (`.poor`, `.dense`; never opacity);
   - the rarity tag `.ui-rtag` for every girl and gear rarity, plus UR and LR gradient letters through an inner `<span>`;
   - the frame ladder `.ui-fr`, including LR Nightglass (the navy edge, the white-gold inner line, the twin-star crest `.ui-lr-crest`, and the comet on `.ui-fr.lr.big`, which rests at the top-right under reduced motion);
   - the tab rail `.ui-rail` > `.ui-tab` (`.on`, `.locked`, `.ui-dot`);
   - the scrim, sheet and drawer shells: `.ui-scrim`, `.ui-sheet` (`.full` is the Details sheet), `.ui-drawer` (it sits under `--hud-top-h` and above `--hud-ability-h`), `.ui-head`, `.ui-title`, `.ui-close` (44 px) and `.ui-body`.

   Everything except `.num` and `.lbl` uses the `ui-` prefix, because the game already uses `.chip`, `.tab`, `.tabs`, `.btn`, `.more` and `.panel`. That keeps M0 from restyling any screen. No screen uses the new classes yet.
4. **`src/ui/format.js`, `fmtNum(value, kind, { detail, round, whole, cap, of })`**. The kinds are `count` (the default), `stack`, `money`, `pct`, `flat`, `rate`, `mul`, `time`, `range`, `level` and `progress`, following the §2 table:
   - counts shorten from 10,000; money stays exact up to 999,999;
   - one decimal at most, lowercase k, uppercase M and B;
   - the rounding direction depends on the kind: balances and owned counts round down, prices and requirements round up, stats round to the nearest value. A value that rounds up moves to the next unit (999,950 → 1M);
   - negative numbers use the real minus sign, and a missing value shows "–".

   There are 22 unit tests in `tests/ui/format.test.js`. The formatters it replaces:
   - `ui/lobby/mailbox.js` `compactCount` (removed). Tiles now show `fmtNum(n, 'stack')`, so "×300K" becomes "×300k";
   - `ui/profile/parts.js` `shortNumber` (removed). The kill count uses `count`, rounding down;
   - `unitBuild.js` `fmt`: damage and power use `count`; cost is the battle's own price, `roundCost` from `sim/Sim.js` (nearest 5, as `placeCost` charges on Normal), shown with `money` (train v0.1.38 fix; M0 first rounded the raw product up);
   - `unitSheet.js` `fmt`: power uses `count`;
   - `upgradeGrid.js` `fmt`: prices and shortfalls use `money` rounding up (null still shows "–");
   - `ui/battle/upgradeTree.js` `fmt`: the deploy cost uses `money` rounding up.
5. **The rarity-token test** (`tests/ui/rarityTokens.test.js`). It checks that `--rar-r/sr/ssr` equal `UNIT_RARITIES`, `--rar-ur` equals `UR` / `rarityInfo('UR')`, and `--gear-*` equal `ITEM_RARITIES`. It fails if a JS rarity has no token. It also checks LR once the JS defines it; until then `--rar-lr` must equal `--lr-gold`. Finally, it checks that every pre-M0 token still exists and that only `--muted` changed.
6. **The CSS floor lint** (`tools/cssFloor.mjs`, with the baseline in `tools/cssFloor.baseline.json`):
   - It counts `font-size` and `font:` declarations under 12 px, outside `.deco` rules, in every stylesheet under `src/`.
   - px counts as is, rem and em at 16 px, and pt × 4/3; `clamp()`, `min()` and `max()` count by their smallest fixed size.
   - `--update` can only lower a file's number, and never adds a file: a new stylesheet stays at 0, so any declaration under 12 px in it fails. A screen built before M0 (UI_DIRECTION §7 rule 2) comes in only with `--update --admit <path>`, named in the commit (train v0.1.38: `src/ui/styles/events.css` at 13).
   - `tests/tools/cssFloor.test.js` runs the ratchet inside the suite and checks that `components.css` has none.
7. **The contrast table** (`tools/contrast.mjs`, `tests/ui/contrast.test.js`). It reads the real token values from `base.css` and composites translucent backgrounds over the surface they sit on, using the worst case where it varies.
8. **`e2e/ui-shots.mjs`** seeds a fixed save (every girl, Aoi Lv 48, 6 gear rolls from fixed seeds, 284,650 coins and 16,570 gems, no auto-start). It shoots the six screens at both sizes, so later milestones can reuse it.

## Gates

| Gate | Result | Log |
|---|---|---|
| vitest (full) | **pass**: 174 files passed, 1 skipped; **2532 tests passed, 10 skipped**. The pre-M0 baseline was 2497 passed, 10 skipped; the 35 new tests are format 22, rarity tokens 5, floor lint 6, contrast 2 | `vitest-after.log` |
| vite build | **pass**. The fonts are emitted as `BarlowCondensed-600-*.woff2` (22.30 kB) and `-700-*.woff2` (22.44 kB) | `build.log` |
| `node e2e/smoke.mjs` (1280x720 + 844x390) | **pass**: 426 ok, 0 FAIL, "ALL SMOKE CHECKS PASSED" | `smoke.log` |
| `BUN=/root/.bun/bin/bun node e2e/engines.mjs` | **pass**: 3 runs on 2 engines (V8, JavaScriptCore) were identical, and the wave-40 checkpoint restored and replayed. Firefox and WebKit are skipped because they are not installed in this container | `engines.log` |
| CSS floor lint | **pass**: 618 before, 618 after; no file went up; `components.css` has 0 | `cssfloor-after.log` |
| Contrast table | **pass**: 52 of 52 pairs | below |
| Sim id | **match**: `37b5428d7657` | above |

The logs are in the session scratchpad; the build session keeps them.

## Contrast table

Every pair is text at body or label size, so all of them are held to 4.5:1. The 3:1 allowance for numbers of 22 px and up is not needed anywhere. The figures match the spec's own (for example `--muted` 5.96 on white, 4.72 on `--sky-2`; white on the plate 17.49). The old `--muted` was 4.31 on white, 3.42 on `--sky-2`.

| Text | Background (bottom first) | Used for | Ratio | Needs | |
|---|---|---|---|---|---|
| `--ink` | white | body text on a white panel | 14.26 | 4.5 | pass |
| `--ink` | `--sky-1` | stat chip number on its --sky-1 fill | 12.98 | 4.5 | pass |
| `--ink` | `--sky-3` + rgba(255, 255, 255, 0.72) | inactive tab word on the rail (over --sky-3, the darkest sky) | 12.51 | 4.5 | pass |
| `--ink` | `--yellow` | MORE sticker / primary button label | 10.65 | 4.5 | pass |
| `--plate` | `--pink` | pink sticker letters | 7.17 | 4.5 | pass |
| `--muted` | white | secondary text on white | 5.96 | 4.5 | pass |
| `--muted` | `--panel-solid` + `--panel` | secondary text on a glass panel | 5.96 | 4.5 | pass |
| `--muted` | `--sky-3` + `--panel` | secondary text on a glass panel over --sky-3 | 5.69 | 4.5 | pass |
| `--muted` | `--sky-1` | chip label on --sky-1 | 5.43 | 4.5 | pass |
| `--muted` | `--sky-2` | secondary text on --sky-2 | 4.72 | 4.5 | pass |
| `--muted` | `--blue-soft` | secondary text on --blue-soft | 5.02 | 4.5 | pass |
| `--muted` | `--sky-3` + rgba(255, 255, 255, 0.72) | locked tab word on the rail | 5.23 | 4.5 | pass |
| `--muted` | black + rgba(255, 255, 255, 0.92) | drawer body text (worst case: a black map behind it) | 4.98 | 4.5 | pass |
| `--blue-text` | white | links, "+N" chip, ghost button | 6.52 | 4.5 | pass |
| `--blue-text` | `--sky-2` | selected text on --sky-2 | 5.17 | 4.5 | pass |
| `white` | `--blue-text` | white on a --blue-text fill | 6.52 | 4.5 | pass |
| `--pink-text` | white | hero / selection text on white | 6.81 | 4.5 | pass |
| `--pink-text` | `--pink-soft` | in-progress text on --pink-soft | 5.56 | 4.5 | pass |
| `--good-text` | white | ▲ delta chip on white | 6.18 | 4.5 | pass |
| `--good-text` | `--sky-1` | ▲ delta chip on its --sky-1 fill | 5.63 | 4.5 | pass |
| `--good-text` | `--sky-2` | ready text on --sky-2 | 4.90 | 4.5 | pass |
| `--bad-text` | white | ▼ delta chip / danger label on white | 6.41 | 4.5 | pass |
| `--bad-text` | `--sky-1` | ▼ delta chip on its --sky-1 fill | 5.84 | 4.5 | pass |
| `--bad-text` | `--sky-2` | warning on --sky-2 | 5.08 | 4.5 | pass |
| `--on-plate` | `--plate` | numbers and names on a plate | 17.49 | 4.5 | pass |
| `--on-plate` | `--sky-3` + `--plate-glass` | white on the glass plate over a light map | 14.13 | 4.5 | pass |
| `--on-plate` | `--plate` + rgba(255, 255, 255, 0.08) | number in an on-plate chip | 14.07 | 4.5 | pass |
| `--on-plate-dim` | `--plate` | caps labels on a plate; an unaffordable price | 9.09 | 4.5 | pass |
| `--on-plate-dim` | `--plate` + rgba(255, 255, 255, 0.08) | label in an on-plate chip | 7.31 | 4.5 | pass |
| `--on-plate-dim` | `--sky-3` + `--plate-glass` | caps label on the glass plate over a light map | 7.34 | 4.5 | pass |
| `--plate-accent` | `--plate` | the accent number / an affordable price | 13.07 | 4.5 | pass |
| `--good-on-plate` | `--plate` | ▲ delta on a plate | 10.78 | 4.5 | pass |
| `--good-on-plate` | `--plate` + rgba(255, 255, 255, 0.08) | ▲ delta in an on-plate chip | 8.67 | 4.5 | pass |
| `--bad-on-plate` | `--plate` | ▼ delta / warning on a plate | 7.31 | 4.5 | pass |
| `--bad-on-plate` | `--plate` + rgba(255, 255, 255, 0.08) | ▼ delta in an on-plate chip | 5.88 | 4.5 | pass |
| `--blue-on-plate` | `--plate` | links / selection on a plate | 9.33 | 4.5 | pass |
| `--rar-r` | `--plate` | R tag | 6.96 | 4.5 | pass |
| `--rar-sr` | `--plate` | SR tag | 11.42 | 4.5 | pass |
| `--rar-ssr` | `--plate` | SSR tag | 7.53 | 4.5 | pass |
| `--rar-ur` | `--plate` | UR tag (flat) | 6.79 | 4.5 | pass |
| `#ff9bc8` | `--plate` | UR tag gradient stop 1 | 8.98 | 4.5 | pass |
| `#ffe066` | `--plate` | UR tag gradient stop 2 | 13.42 | 4.5 | pass |
| `#8ef0b0` | `--plate` | UR tag gradient stop 3 | 12.70 | 4.5 | pass |
| `#7fd3ff` | `--plate` | UR tag gradient stop 4 | 10.55 | 4.5 | pass |
| `#c9a8ff` | `--plate` | UR tag gradient stop 5 | 8.77 | 4.5 | pass |
| `--rar-lr` | `--lr-edge` | LR tag (gold end) | 12.29 | 4.5 | pass |
| `white` | `--lr-edge` | LR tag (white end) | 17.49 | 4.5 | pass |
| `--gear-common` | `--plate` | Common tag | 6.99 | 4.5 | pass |
| `--gear-rare` | `--plate` | Rare tag | 5.31 | 4.5 | pass |
| `--gear-super` | `--plate` | Super Rare tag | 5.17 | 4.5 | pass |
| `--gear-mythic` | `--plate` | Mythic tag | 5.83 | 4.5 | pass |
| `--gear-legendary` | `--plate` | Legendary tag | 9.97 | 4.5 | pass |

52/52 pairs pass

## CSS floor-lint baseline (taken on `685b40b`, before M0)

The total is **618**. Files not listed have 0. The spec's §8 said "595 today" for its Oct 20 audit. This counter finds 618 on today's `specs/next-wave`: that tree has the Potential v3 styles and also counts `font:` shorthands and `@media` rules. M0 leaves every file at its baseline.

| File | Under 12 px |
|---|---|
| `src/ui/styles/achievements.css` | 51 |
| `src/ui/styles/base.css` | 10 |
| `src/ui/styles/battle-modes.css` | 3 |
| `src/ui/styles/battle.css` | 86 |
| `src/ui/styles/coach.css` | 4 |
| `src/ui/styles/coop-modes.css` | 2 |
| `src/ui/styles/gearFilter.css` | 1 |
| `src/ui/styles/honors.css` | 1 |
| `src/ui/styles/journal.css` | 7 |
| `src/ui/styles/meta-a.css` | 132 |
| `src/ui/styles/meta-b.css` | 47 |
| `src/ui/styles/modes.css` | 9 |
| `src/ui/styles/online.css` | 41 |
| `src/ui/styles/potential.css` | 22 |
| `src/ui/styles/profile.css` | 83 |
| `src/ui/styles/sandbox.css` | 4 |
| `src/ui/styles/social.css` | 29 |
| `src/ui/styles/story.css` | 8 |
| `src/ui/styles/title.css` | 6 |
| `src/ui/styles/unit-build.css` | 20 |
| `src/ui/styles/unit-info.css` | 46 |
| `src/ui/styles/ur.css` | 6 |

## Battle call sites left for later (abilities track)

The spec lists `ui/battle/util.js` (two formatters: `fmtCoins` and `fmtBig`) and `ui/battle/scout.js` (`fmtMul` and `fmtMulShort`). They are untouched, and so are their callers, because those callers import from `util.js`. Each swap is a one-line import change per call site: `fmtCoins` → `fmtNum(n, 'money')` (`round: 'up'` for prices), `fmtBig` → `fmtNum(n)` (HP and damage, nearest), and `fmtMul`/`fmtMulShort` → `fmtNum(x, 'mul')` for small values and `'×' + fmtNum(x)` for large ones. Do this before or after the abilities merge, not during it.

**Name clash to watch:** `ui/battle/util.js` already exports its own `fmtNum(n, digits = 2)`, a decimal trimmer imported by `towerPanel.js` and `chikaPanel.js`. M0 does not touch it. When the battle files switch over, import the new one under its own name, or rename the battle helper, so the two never mix in one module.

| File | Line (helper) |
|---|---|
| `src/ui/battle/bossBar.js` | 64 (fmtBig ×3) |
| `src/ui/battle/chikaPanel.js` | 194, 195, 225, 226, 227, 241, 298, 299, 300 (fmtCoins) |
| `src/ui/battle/controller.js` | 752, 925, 929, 1200 (×3), 1201 (fmtCoins) |
| `src/ui/battle/heroLevels.js` | 84, 211 (fmtCoins) |
| `src/ui/battle/heroWidget.js` | 75, 77 (fmtCoins) |
| `src/ui/battle/hud.js` | 89 (fmtCoins) |
| `src/ui/battle/placement.js` | 68, 85 (fmtCoins) |
| `src/ui/battle/results.js` | 236 (fmtBig); 262, 391, 392 (fmtCoins) |
| `src/ui/battle/sandboxPanel.js` | 267 (×2), 327 (fmtCoins) |
| `src/ui/battle/scout.js` | 111 (fmtMul definition, uses fmtBig), 115/122/128 (fmtMul), 136 and 215 (fmtBig), 179 (fmtMulShort) |
| `src/ui/battle/towerBar.js` | 121 (fmtCoins) |
| `src/ui/battle/towerPanel.js` | 221, 261, 268 (×2), 270, 465, 556, 567, 568, 599, 605, 606, 624 (×2) (fmtCoins) |
| `src/ui/online/coopHud.js` | 49 (fmtCoins) |

The definitions are `src/ui/battle/util.js:15` (`fmtCoins`), `:26` (`fmtBig`), `src/ui/battle/scout.js:111` (`fmtMul`) and `:114` (`fmtMulShort`).

## Before/after screenshots

Taken with `node e2e/ui-shots.mjs --out <dir>`: the "before" set on a clean worktree of `685b40b`, the "after" set on this branch, with the same seeded save. Pixels that changed (a channel difference over 8):

| Screen | 844x390 changed | 1280x720 changed |
|---|---|---|
| Lobby | 0.64% | 0.36% |
| Girl page, Info | 1.13% | 0.74% |
| Backpack, Equipment | 1.02% | 0.69% |
| Stage prep (2-3) | 0.99% | 0.76% |
| Battle 1-1, Aoi's drawer open | 1.24% | 0.80% |
| Achievements | 0.29% | 0.36% |

I checked the diff overlays. Every change is muted ink: subtitles, inactive tab words, "Kills / Damage", "Invested", kickers, the stage and achievement descriptions, and the girl plate's "Lv." line. Everything else is noise from time and rendering: the lobby clock and the login-gift icon's idle bounce, and dithering in the WebGL map. There are no layout changes.

None of the values on these six screens is 10,000 or more, so the number-style change does not show in them. It shows where a value goes through `fmtNum` at that size, for example a mailbox tile reading "×300k" instead of "×300K", or a profile kill count of 25,310 reading "25.3k"; `tests/ui/format.test.js` covers those. The Barlow face only appears where `.num` or `.lbl` is used, and no screen uses them yet (M1 onwards).

**Committed (844x390, webp, 436 KB in all):** `docs/merge/ui-m0/<screen>-844x390-{before,after}.webp`, where `<screen>` is `lobby`, `girl-info`, `backpack-equipment`, `stage-prep`, `battle-drawer` or `achievements`.

**1280x720 pairs:** these are not committed. To recreate them, run `node e2e/ui-shots.mjs --viewport 1280x720 --out <dir>` on `685b40b` and on this branch.

## Notes for the coordinator
- **Commit trailers:** these use the Claude-Session line from the task brief (`session_01V3cmFg3aKCuDQGLA9Topgo`). This build ran in session `session_01LuNNb2hAuX7ABZxvEFKWRd`, which is the session linked in the PR body.
- **New UI in any track** can use the M0 classes now. LR uses `.ui-rtag.lr` and `.ui-fr.lr` (with `.big` and a `.ui-lr-crest` child). The ability bar should set `--hud-ability-h`.
- **Lowering the floor baseline:** `node tools/cssFloor.mjs --update` after a milestone lowers its counts. CI keeps any file from going up.
