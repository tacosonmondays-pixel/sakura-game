# UI direction: condense and clarify

**Status:** approved by the owner on Oct 20 ("all defaults looks good for now!"). Build starts with M0.

**Owner answers (Oct 20):**
- **Hosts on hub screens:** yes, up to 35% of the width on hub and list screens only (5.10 E1).
- **Left section rail:** yes, on list screens with 2-5 sections (5.10 E3).
- **Headline stats:** chosen by role. Shooters DMG · RATE · RANGE; supports BUFF · RANGE · AFFECTS; income COINS/WAVE · RANGE ·
  COST; heroes DMG · RATE · ULT.
- **Damage numbers:** on, big hits only (crits, super-effective hits, +coins, leaks). Settings gets a switch: All, Big hits, Off.
- **LR frame:** Nightglass (5.6). LR is a real step, earned through the Starfall Trial.
- **Buying in the battle drawer:** two taps. The first tap opens the row (tier name and 3 effect chips) and arms the price as
  "Buy · 565"; the second tap buys. The full tree keeps its own Buy button.
- **Gear tiles in the backpack:** the main-stat value shows in Salvage mode only.
- **The battle look (owner pick):** the Oct 14 tactical draft for the battle drawer and the boss warning band. See M2.
**Goal (the owner's request):** condense stats and info so they are not all in the player's face, make everything easier to see
and read, and follow the game's art direction: a bright **Academy** surface with bold **Street** structure.
**Primary size:** landscape phone **844x390**. Desktop **1280x720** values are in brackets.
**Sources:** the Oct 20 UI audit (every main screen measured at both sizes: visible labels, numbers, smallest text and contrast)
and the style rules drafted the same day. Every "before" number below comes from that audit. Every "after" number is a
design target, counted with the same probe.

Contents
1. Principles
2. Number formatting
3. Type scale
4. Tokens (extends the existing `:root`)
5. Component rules
6. Condense plan for the six most cluttered screens
7. Rollout plan
8. How to check (gates)
Appendix: token CSS draft

---

## 1. Principles

These are the rules every screen follows. Reviews can cite them by id.

### P1. Progressive disclosure: Glance, Tap, Details
Information lives at one of three depths:

| Depth | What it holds | How the player gets there |
|---|---|---|
| **Glance** (always on) | Icon + number pairs, names, state (owned, locked, new), the one primary action | Nothing to do |
| **Tap** | A drawer or bottom sheet with the summary (3 headline stats, one sentence, the actions) | One tap on the card, tile or chip. The drawer keeps **at least 50%** of the screen (the art, the grid or the map) visible |
| **Details** | Every stat, formula, substat, ladder, rule paragraph and breakdown | The **MORE** sticker in a summary, or **hold** (the existing 450 ms hold gesture) on a girl or an item |

- Rule text (how paths combine, what a difficulty does, how sweep unlocks) sits behind an **"i"** button. It is never printed in
  full on a Glance surface.
- At most **2 layers** are stacked (for example the battle drawer plus its Details sheet). A layer closes on a tap outside it, on its
  own close button, or with Escape.
- Details sheets may scroll. The budgets in P3 do not apply inside Details, but the type floor and contrast rules do.

### P2. One job per surface, one primary action per card
- Each card or panel has **one primary action**. Secondary actions are smaller (ghost or icon buttons) or move into the Tap layer.
- Each screen has **at most one yellow primary button**. Buy actions in battle and shops use the **cost button** (an ink plate
  with a yellow number), not a second yellow button.
- A card that is itself the action (a gear slot, a stage card, a girl card) has no extra button on it.

### P3. Number budgets
Counted at 844x390 on the visible screen. The currency bar is not counted.

| Surface | Max numbers | Max sentences |
|---|---|---|
| Grid tile (girl, gear, item, stage card) | **2** (gear tiles: **1**) | 0 |
| Card or panel section | **4** | 1 (at most 60 characters) |
| Whole screen, outside repeated tiles | **12** | – |
| Battle HUD, always on | **4** (lives, coins, wave, speed) + **1 per tower card** (its cost) + **1 per ability button while it cools down** | 0 |

Repeated collections (a gear grid, an achievement list) are budgeted per tile or row, not per screen. A grid that shows 14 tiles
is fine if each tile keeps to its budget.

### P4. Icon + number pairs
- Write **"♥ 100"**, not "Lives: 100". The icon is the label.
- A caps label (12 px) sits next to a number only in a stat strip, in Details, or the first time a player sees that icon.
- An icon and its number never wrap apart (`white-space: nowrap` on the pair).

### P5. One number style everywhere
See section 2. One shared formatter, one rounding rule per kind of number, tabular digits.

### P6. Readable at 844x390
- **Text floor 12 px** [13 px]. Body text 13 px [15 px]. The only exception is a decorative, `aria-hidden` serial or code, at
  most one per panel.
- **At most 5 text sizes** on any screen (section 3).
- **Contrast:** text and labels **≥ 4.5:1** on their real background, numbers of 22 px and larger **≥ 3:1**. Text never sits on a
  rarity fill, a light gradient or an art area without a plate behind it.
- **Tap targets ≥ 44 px** (40 px minimum in dense rows).
- **No ellipsis on stats, prices or rules.** If something does not fit, it moves behind Tap or "i". Ellipsis is allowed only on
  player-written text (names, bios, chat).
- **Content windows ≥ 300 px tall** on phones. Fixed art columns on detail screens take **≤ 28% of the width**.

### P7. Say each fact once, and hide empty states
- A fact appears **once** per screen. Level, stars and Potential live on the girl's plate, not also in the sheet header. The
  coin balance lives in the currency bar, not also in a panel.
- **Hide zero and irrelevant states:** "0/160", "Not played yet", "0 Enemies defeated", a capacity that is far from full, a
  reward the player already took, and "×1" on a single reward.
- Badges follow one vocabulary: red dot = something to claim or read; red number = unread count; "n/m" = progress; pink slanted
  ribbon = in progress; yellow NEW sticker = new content. Tab labels carry a red dot, never a count of items.

### P8. Academy surface, Street structure
- **Academy (the surface):** sky gradient, white glass panels, navy ink, the yellow primary button, sakura pink for selection and
  heroes, the −8° slant on tabs, pills and buttons.
- **Street (the structure):** navy **ink plates** for data, big condensed tabular **numbers** with small caps **labels**,
  **stickers** (tilted tags with a 2 px ink outline), and details behind a **MORE** sticker.
- **Street punctuation** (halftone dots, diagonal stripes, a brush underline, a huge outlined word) is limited to **one per
  screen**, on headers, banners, results, rewards and the recruit reveal only, and never under readable text. Hazard stripes mean
  danger only (boss, leak, locked).
- Never black: plates are navy. No lime or acid-green accent, no retro TV or tape motifs, no glitch effects outside boss
  warnings, no grunge textures, no always-on scrolling tickers.

### P9. Keep it cute and wholesome
- Names stay Nunito 900 italic, body text stays M PLUS Rounded 1c, and the art and chibis stay at the centre of the screen.
- The girls are students. Every banner, sticker, frame and pose stays cute, modest and fully clothed. Nothing body-focused.

---

## 2. Number formatting

One helper, `fmtNum(value, kind)` in a new `src/ui/format.js`, replaces the local formatters that disagree today
(`ui/lobby/mailbox.js`, `ui/profile/parts.js`, `ui/battle/util.js` (two), `ui/battle/scout.js`, and the `fmt` helpers in
`unitBuild.js`, `unitSheet.js`, `upgradeGrid.js` and `ui/battle/upgradeTree.js`). Today the game prints "300K" in one place and
"300k" in another, and shortens from 1,000 in one helper, 10,000 in two others and 100,000 in the battle ones.

| Kind | Glance and Tap | Details | Rounding |
|---|---|---|---|
| Count, reward, damage, HP, progress | below 10,000: **2,600**. From 10,000: **12.3k**. From 1,000,000: **1.2M**. From 1,000,000,000: **1.2B** | exact, with separators: **34,687** | see below |
| **Money the player spends:** a balance (coins, gems, tokens) and any price paid from it | exact up to 999,999: **284,650**, **16,570**. From 1,000,000: **1.2M** | exact | see below |
| Percent bonus | integer: **+22%** | one decimal: **+22.4%** | nearest |
| Flat bonus | **+4**, **+2.1** (one decimal at most) | as stored | nearest |
| Rate | **1.9/s** (the unit in label style) | **1.92/s** | nearest |
| Multiplier | **×1.5** (the × sign, not the letter x) | **×1.25** | nearest |
| Time | **0.5s**, **12s**, **1:05** from 60 s; ability cooldowns in whole seconds | same | up (never show "0s" while something still runs) |
| Range | **4.3** with a RANGE label (no "tiles" word on Glance) | **4.30 tiles** | nearest |
| Level | **LV 48** (label + number); **48/50** only where the cap matters (the plate, Level Up) | same | – |
| Item stack | **×42** in the count corner; on an item tile the tile form **x42.3K** (5.7) | same | down |
| Progress | **3/5**, no spaces; hidden at 0 on Glance surfaces unless 0 is the call to action | same | down |

- **Short form:** one decimal at most, a trailing ".0" is dropped (**12k**, not 12.0k). Lowercase **k**, uppercase **M** and **B**.
- **Why money is exact longer:** a price and the balance it is paid from sit on the same screen and get compared. "14,830 coins"
  next to a "14.9k" price would read as "can't afford" when the player can. Both stay exact, so they compare honestly.
- **Rounding direction, so a short number never promises more than is true:**
  - balances, owned counts and progress round **down** (×42,350 of an item shows **×42.3k**; 1,284,650 coins shows **1.2M**);
  - prices and requirements round **up** (a 1,250,000 requirement shows **1.3M**);
  - stats, damage and HP round to the **nearest** value (34,687 damage shows **34.7k**).
- Whether something is affordable is always decided from the exact values, never from the short form.
- Signs: bonuses always carry **+** or **−** (the real minus sign). Deltas carry **▲** or **▼** as well as colour.
- Every number uses tabular digits (`font-variant-numeric: tabular-nums`), so HUD readouts and timers do not jitter.
- Numbers are never truncated and never split from their icon.

---

## 3. Type scale

Phone values apply at `max-height: 480px`, the breakpoint the stylesheets already use for landscape phones. The default values
are for desktop and tablets.

| Token | Phone | Desktop | Face and weight | Case and tracking | Line height | Use |
|---|---|---|---|---|---|---|
| `--fs-label` | 12 | 13 | Barlow Condensed 600 | UPPERCASE, +0.06em | 1.1 | stat names, chip labels, section kickers, the caps half of "LV 48" |
| `--fs-body` | 13 | 15 | M PLUS Rounded 1c 500 (700 for emphasis) | sentence case | 1.35 | one-line descriptions, rule lines, tab text (in the label face) |
| `--fs-name` | 16 | 19 | Nunito 900 italic | as written | 1.15 | girl names, card and panel titles, path names, button labels |
| `--fs-num-s` | 16 | 19 | Barlow Condensed 700, tabular | – | 1 | chip numbers, prices on cards and buttons, HUD readouts, tile badges |
| `--fs-num` | 22 | 28 | Barlow Condensed 700, tabular | – | 1 | headline stats in a stat strip, big counters |
| `--fs-title` | 28 | 36 | Nunito 900 italic | as written | 1.1 | screen titles, hub tiles, result headers |
| `--fs-display` | 40 | 56 | Nunito 900 italic | as written | 1 | banners, the results rank, the recruit reveal (at most one per screen) |

- `--fs-num-s` shares its size with `--fs-name` on purpose, so the phone scale has **five sizes: 12, 13, 16, 22 and 28** (plus 40
  for display). That is the most any single screen may use.
- **Numbers are always bigger and heavier than their labels.** A label never matches the size of the number it describes.
- Barlow Condensed 600 and 700 (Latin, OFL) are self-hosted as woff2, about 45 KB for both weights, with `font-display: swap`.
  The fallback chain is `'Barlow Condensed', 'Arial Narrow', 'Nunito', system-ui, sans-serif`. Its tabular digits are about
  0.50 em wide against 0.60 em for Nunito 900, so a number in the same box can be about 20% larger.
- Today the stylesheets hold 71–76 distinct sizes, and 41% of all `font-size` declarations are under 12 px. Phones get *smaller*
  text than desktop. The scale above replaces all of them.

---

## 4. Tokens

The existing `:root` in `src/ui/styles/base.css` (and `--ur-rainbow`, `--ur-glow`, `--ur-ink` in `ur.css`) **stays as it is**:
no token is renamed or removed, so work built on today's tokens keeps working. One existing value changes (`--muted`, below).
Everything else is added.

Contrast figures are WCAG ratios, computed against the listed backgrounds.

### 4.1 Existing tokens (kept)

`--sky-1` #eaf6ff · `--sky-2` #cfe8ff · `--sky-3` #9fd0ff · `--blue` #2b7fff · `--blue-soft` #dbeeff · `--blue-deep` #1d4e89 ·
`--navy` #22385c · `--ink` #1f2a44 · `--panel` white 0.9 · `--panel-solid` · `--panel-border` · `--line` #d6e6f7 ·
`--yellow` #ffdd4a · `--yellow-deep` #f2b705 · `--pink` #ff7aa8 · `--pink-soft` #ffe0ec · `--good` #2bb673 · `--bad` #ff4d6d ·
`--shadow` · `--shadow-strong` · `--radius` 12px · `--skew` −8deg · `--font` · `--font-head` · `--safe-*` · `--gutter` 16px ·
`--ease` · `--t-press` 100ms · `--t-panel` 220ms · `--t-screen` 380ms.

`--blue`, `--pink`, `--good` and `--bad` stay as **fill** colours (buttons, bars, icons, frames). Text uses the text-safe twins
in 4.2.

### 4.2 Text-safe colours

| Token | Value | Purpose | Contrast |
|---|---|---|---|
| `--muted` (**changed**, was #6b7a99) | **#56647f** | secondary text: subtitles, descriptions, fact labels | 5.96 on white, 5.43 on `--sky-1`, 5.02 on `--blue-soft`, 4.72 on `--sky-2` (the old value was 4.31 / 3.93 / 3.63 / 3.42). An earlier draft value, #5a6888, still failed on `--sky-2` at 4.41 |
| `--muted-line` (new) | #6b7a99 | the old muted value, for borders and icons that relied on it | non-text use only |
| `--blue-text` | #1459c0 | links, selected chip text, interactive text on light | 6.52 on white, 5.17 on `--sky-2`; white on it 6.52 |
| `--pink-text` | #b0174f | hero, selection and "in progress" text on light | 6.81 on white, 5.56 on `--pink-soft` |
| `--good-text` | #166f47 | "In formation", ▲ deltas, ready states | 6.18 on white, 4.90 on `--sky-2`, 5.49 on a light green chip |
| `--bad-text` | #b81d3b | warnings, ▼ deltas, the Sell button label | 6.41 on white, 5.08 on `--sky-2`, 5.49 on a light red chip |

### 4.3 Ink plate (the Street half)

| Token | Value | Purpose | Contrast |
|---|---|---|---|
| `--plate` | #0e1930 | stat strips, active tabs, headers of drawers and sheets, HUD readouts, rarity tags | white on it 17.49 |
| `--plate-glass` | rgba(14, 25, 48, 0.9) | plates over art or the map (no blur over WebGL) | white on it about 13.6 over `--sky-2` |
| `--on-plate` | #ffffff | numbers and names on plates | 17.49 |
| `--on-plate-dim` | #a9bcdc | caps labels on plates | 9.09 |
| `--plate-accent` | var(--yellow) | the one accent number on a plate (headline stat, affordable price) | 13.07 |
| `--plate-line` | rgba(255, 255, 255, 0.14) | hairline dividers inside a plate | non-text |
| `--good-on-plate` | #5fe39a | ▲ deltas and "ready" on plates | 10.78 |
| `--bad-on-plate` | #ff8095 | ▼ deltas and warnings on plates | 7.31 |
| `--blue-on-plate` | #7cc4ff | links and selected states on plates | 9.33 |

### 4.4 Type

| Token | Phone | Desktop | Purpose |
|---|---|---|---|
| `--font-num` | 'Barlow Condensed', 'Arial Narrow', 'Nunito', system-ui, sans-serif | same | numbers (700) and caps labels (600) |
| `--fs-label` | 12px | 13px | caps labels |
| `--fs-body` | 13px | 15px | body text |
| `--fs-name` | 16px | 19px | names, titles of cards, button labels |
| `--fs-num-s` | 16px | 19px | small numbers (chips, prices, HUD) |
| `--fs-num` | 22px | 28px | headline numbers |
| `--fs-title` | 28px | 36px | screen titles |
| `--fs-display` | 40px | 56px | banners and reveals |
| `--lh-tight` | 1.1 | 1.1 | labels, names, titles |
| `--lh-body` | 1.35 | 1.35 | body text |
| `--track-label` | 0.06em | 0.06em | letter spacing of caps labels |

### 4.5 Space and size

| Token | Phone | Desktop | Purpose |
|---|---|---|---|
| `--sp-1` | 4px | same | hairline gaps: icon to number inside a chip |
| `--sp-2` | 8px | same | gaps between chips and between grid tiles (the minimum, so the LR crest never touches a neighbour) |
| `--sp-3` | 12px | same | panel padding on phones, gaps between panels |
| `--sp-4` | 16px | same | panel padding on desktop (`--gutter` stays 16 px for the screen edge) |
| `--sp-5` | 24px | same | gaps between sections inside a Details sheet |
| `--sp-6` | 32px | same | gaps between the art band and content on desktop |
| `--tap` | 44px | 48px | minimum tap target |
| `--tap-dense` | 40px | 44px | minimum in dense rows (tree cells, chip rows) |
| `--icon-s` | 20px | 24px | icons in chips and inline pairs |
| `--icon` | 24px | 28px | icons in tiles, tabs and buttons |
| `--chip-h` | 28px | 32px | stat chip height |
| `--strip-h` | 56px | 68px | stat strip height |
| `--tab-h` | 36px | 40px | tab rail height |
| `--topbar-h` | 40px | 48px | screen top bar height |
| `--art-band-w` | 28% (236 px at 844) | 30% | the fixed art band on detail screens |
| `--drawer-w` | 288px | 340px | side drawers (battle girl and hero drawer); never over 300 px on phones |
| `--sheet-max-h` | 60dvh | 60dvh | bottom sheets |
| `--hud-top-h` | 44px | 52px | the battle top strip |
| `--hud-ability-h` | 0px | 0px | **reserved for the battle ability bar.** The ability bar sets it when present; the girl drawer, toasts and banners keep clear of it |

### 4.6 Shape

| Token | Value | Purpose |
|---|---|---|
| `--radius-plate` | 4px | ink plates and stat strips (`--radius` 12px stays for glass panels) |
| `--radius-chip` | 6px | chips, stickers, rarity tags |
| `--cut` | 12px phone, 14px desktop | the single 45° chamfer at the top-right of a glass panel |
| `--sticker-tilt` | −4deg | stickers (MORE, NEW, grades) |
| `--sticker-line` | 2px solid var(--plate) | sticker outline |
| `--sticker-drop` | 0 2px 0 var(--plate) | sticker drop shadow |
| `--scrim` | rgba(14, 25, 48, 0.35) | behind drawers and sheets |

### 4.7 Motion

| Token | Value | Purpose |
|---|---|---|
| `--t-sticker` | 240ms | sticker slap (scale 1.12 → 1, one overshoot) |
| `--ease-pop` | cubic-bezier(0.34, 1.56, 0.64, 1) | the one-overshoot curve for stickers and badges |
| `--t-count` | 400ms | number count-up, results and rewards only |
| `--t-banner` | 1200ms | the longest a banner or toast may cover the map |

Drawers and tabs keep `--t-panel` (220 ms). Screen transitions keep `--t-screen`. Reduce motion turns everything into a 150 ms
fade, as it does today.

### 4.8 Rarity

These mirror the colours in `src/data/types.js` (`UNIT_RARITIES`, `ITEM_RARITIES`) and `src/ui/rarity.js` (UR). The JS stays the
source of truth for game data. A unit test checks that the CSS tokens match it.

| Token | Value | Purpose | Letters on `--plate` |
|---|---|---|---|
| `--rar-r` | #7aa7d9 | R frame and tag | 6.96 |
| `--rar-sr` | #ffc94d | SR | 11.42 |
| `--rar-ssr` | #ff7ad9 | SSR | 7.53 |
| `--rar-ur` | #b78bff | UR flat fallback (the frame itself uses `--ur-rainbow`) | 6.79 |
| `--rar-lr` | #ffd27a | LR flat colour (sorting, small chips), always on `--plate` | 12.29 |
| `--gear-common` | #9aa5b1 | Common gear | 6.99 |
| `--gear-rare` | #4a90e2 | Rare | 5.31 |
| `--gear-super` | #a86bff | Super Rare | 5.17 |
| `--gear-mythic` | #ff5a7a | Mythic | 5.83 |
| `--gear-legendary` | #ffb627 | Legendary | 9.97 |
| `--frame-w` | 2px | flat frames | – |
| `--frame-w-strong` | 3px | tinted, glow, metal and rainbow frames | – |
| `--lr-edge` | `var(--plate)` (#0e1930) | LR Nightglass edge: the ink-plate navy, never black | – |
| `--lr-gold` | #ffd27a | LR white-gold line (white → gold), comet head, crest gold star, sticker letters | – |
| `--lr-comet` | 6s | one comet lap; big frames only | – |

Rarity colours have no text-safe twin on purpose: rarity is never written as coloured text on white (see 5.6).

---

## 5. Component rules

New shared classes live in one new stylesheet loaded right after `base.css`. Screens adopt them milestone by milestone.

### 5.1 Stat chip
An icon + number pair, with an optional caps label.

- **Anatomy:** icon (`--icon-s`) · number (`--fs-num-s`, tabular) · optional label (`--fs-label`, caps). Height `--chip-h`, padding
  4 × 8 px, radius `--radius-chip`, 4 px gaps.
- **On light panels:** `--sky-1` fill, 1 px `--line` border, `--ink` number, `--muted` label.
- **On plates:** no fill, `--on-plate` number, `--on-plate-dim` label.
- **Delta chip:** ▲ or ▼ plus the number in `--good-text` / `--bad-text` (`--good-on-plate` / `--bad-on-plate` on plates). The arrow
  carries the meaning, not only the colour.
- **Rules:**
  - one fact per chip, never a sentence;
  - at most **3 chips in a row**, then a **"+N"** chip that opens the rest;
  - a chip is not a button unless it shows a chevron;
  - the accessible name is the full fact ("Attack +22%").
- Tags (Self / Allies / Enemies, damage types) use the same shape **without** a number: an icon plus one word. One tag per path
  or per card, never one per cell.

### 5.2 Stat summary card (the ink strip)
The standard summary of a girl, a gear piece, an enemy or a stage: **exactly 3 headline stats + MORE**.

- **Shape:** a `--plate` strip, `--strip-h` tall, radius `--radius-plate`, three cells split by `--plate-line`, then the MORE sticker.
- **Cell:** caps label (`--fs-label`, `--on-plate-dim`) above the number (`--fs-num`, `--on-plate`) and a small unit
  ("1.9/s"). Only the **first** number of the strip may take `--plate-accent` (yellow).
- **The three stats are chosen by role:**

  | Summary of | Headline stats |
  |---|---|
  | Shooter | DMG · RATE · RANGE |
  | Aura or support | BUFF · RANGE · AFFECTS |
  | Income | COINS/WAVE · RANGE · COST |
  | Hero | DMG · RATE · ULT (its level or state) |
  | Enemy | HP · SPEED · one trait icon |
  | Gear | the main stat + the 2 best substats |
  | Gear totals on a girl | her role's three stats, gear share only |
  | Stage | WAVES · ♥ LIVES · START COINS |

- **Upgrade preview:** a ▲ delta under the number, in `--good-on-plate`.
- **MORE sticker:** yellow fill, `--ink` caps text "MORE ▸", `--sticker-tilt`, `--sticker-line`, `--sticker-drop`. It always
  opens Details and looks the same everywhere.
- Never 4 stats in a strip, never a sentence inside it. Crit, armor pierce, multipliers, other substats, Potential deltas and
  formulas live only in Details.

### 5.3 Tabs
- **Page tabs:** a slanted rail (`--skew`), `--tab-h` tall. Each tab is an icon + **one word** in the label face at `--fs-body`
  size, at least 44 × 36 px.
  - **Active:** `--plate` fill, white text, a 3 px yellow bar under it.
  - **Inactive:** transparent, `--ink` text (today the inactive tabs are 3.76–3.89:1; ink on the rail is over 11:1).
  - **Locked:** a lock icon before the word, text stays ≥ 4.5:1.
- **At most 5 tabs visible** at 844x390; the rest go behind a "⋯" tab. A category rail may hold 6 one-word tabs only if they fit
  at 844 without sideways scrolling.
- **Badges:** a red dot only. Tabs do not show item counts.
- **At most two levels:** page tabs on top, filter chips (or one Filter button) under them. On hub screens, category tabs that swap
  the whole page sit on the bottom edge, in thumb reach.
- Tab ids and `data-testid` values stay the same when labels get shorter.

### 5.4 Panels, drawers and sheets
- **Glass panel:** white at 92%, radius `--radius`, one `--cut` chamfer at the top-right, `--shadow`. Its title is `--fs-name`
  Nunito 900 italic with the short yellow underline the game already uses.
  - One job per panel: at most **4 numbers and 1 sentence** (P3).
  - Padding 12 px [16 px]. Panels do not nest more than one level deep.
  - Data inside a panel goes on an ink strip (5.2). The panel itself stays white.
- **Side drawer** (battle): `--drawer-w` wide, full height under the top strip, a `--plate` header, glass body. It never covers
  the ability bar (`--hud-ability-h`), the pause button or the speed button.
- **Bottom sheet** (meta screens): at most `--sheet-max-h`, a `--plate` header with the title and a 44 px close button, `--scrim`
  behind it. It closes on an outside tap, on swipe-down and on Escape.
- **Details sheet:** full height, may scroll, may have its own tabs. It is the only place for tables, ladders, formulas and long text.
- **Empty, locked and insufficient states** are designed, never a plain alert: an icon, one line saying what unlocks it or what
  is missing, and the one action that helps ("Where to get", "Go to 2-1").

### 5.5 Buttons

| Kind | Look | Use |
|---|---|---|
| **Primary** | `--yellow` fill, `--ink` label (10.65:1), slanted | the one main action of a screen (Start, Level up, Claim all) |
| **Cost** | `--plate` fill, coin icon + price in `--plate-accent` (`--fs-num-s`) | buy actions: path upgrades, hero levels, shop items. Not affordable: the price turns `--on-plate-dim` with a small lock-coin icon |
| **Secondary** | white glass, 2 px `--line` border, `--ink` label | Sweep, Filter, Change, Open all |
| **Danger** | white, 2 px `--bad` border, `--bad-text` label | Sell, Salvage |
| **Ghost** | text only, `--blue-text` | Where to get, Full page |
| **Icon** | 44 × 44, icon only, an accessible name | close, "i", 3D toggle, Tree |

- **Label:** a verb of at most two words, plus an optional price: "Level up · 145". The label is `--fs-name`, the price `--fs-num-s`.
- **Heights:** `--tap` (44 px [48 px]); `--tap-dense` in dense rows.
- **Disabled:** never `opacity: 0.5`, which drops text below 3:1. Use a `--sky-1` fill, `--muted` text (≥ 4.5:1), a lock icon,
  and one line with the reason.
- **Press:** `--t-press` (100 ms) at scale 0.96.

### 5.6 Rarity frames
One ladder of frame treatments for girls and gear. Each step must read as "higher" at a glance, even at 40 px.

| Step | Treatment | Girls | Gear |
|---|---|---|---|
| 1 Flat | `--frame-w` solid border in the rarity colour, white tile | R | Common, Rare |
| 2 Tinted | `--frame-w-strong` border + a 12% rarity tint in the tile | SR | Super Rare |
| 3 Glow | step 2 + an inner glow (1 px white inset, then an 8 px glow in the rarity colour at 50%) | SSR | Mythic |
| 4 Metal | `--frame-w-strong` gold gradient (light → `--gear-legendary` → `--yellow-deep`) + one glint on reveal | – | Legendary |
| 5 Rainbow | the animated rainbow ring (`--ur-rainbow`, `--ur-glow`, the glints), exactly as `ur.css` draws it today | UR | UR gear (being built) |
| 6 **LR (Nightglass)** | see below | LR | – |

**LR: Nightglass** (owner's choice, Oct 20; the full spec is in the duo design, §2.5):
- **Edge:** a `--frame-w-strong` dark-navy edge (`--lr-edge`, the ink-plate navy, never black).
- **Inner line:** a thin 1 px white-gold line just inside the edge (white → `--lr-gold`).
- **Comet:** one comet light (a short gold-to-white arc) that travels around the edge, one lap per `--lr-comet`, **on big
  frames only** (her page, the unit sheet, the reveal). Grids and the battle HUD stay still. Reduced motion rests the comet at
  the top-right corner.
- **Crest:** a twin-star crest at the top centre: two overlapping four-point stars, one gold and one white (12 px [17 px]). It
  overhangs the top edge by 8 px, so every grid keeps at least an 8 px (`--sp-2`) gap.
- **Label:** "LR" in white-to-gold letters on a navy sticker tilted −4° with a 2 px white outline (R9).
- **The rainbow stays UR's.** LR does not reuse the UR ring.
- **Exclusive:** the Nightglass edge, the comet and the twin-star crest are used **only** for LR units and for the Nightglass
  avatar frame that an LR clear unlocks. Titles, honors and events may not use them.
- **Cost:** like UR, transform and opacity (or one registered angle property) only. Reduced motion holds it still and keeps the colours.
- LR is a real step (owner, Oct 20): max her at UR, awaken her, then clear her Starfall Trial. Kohaku & Tsubaki are first. The
  step itself belongs to the abilities and new-girls track; this spec only draws it.

**Rarity labels and colour use:**
- A rarity label is always a **`--plate` pill with rarity-coloured letters**, as the UR badge already is. The lowest pair is
  Super Rare at 5.17:1. **Never white text on a rarity fill:** today "Legendary" is 1.75:1, "R" 2.51:1 and SSR 2.32:1.
- Rarity colour appears **only** on frames and rarity labels. It never colours names, stats or bullets (the ◆ substat bullets in
  rarity colour go).
- The label pill is wide enough for three letters ("SSR"), so "UR" and "LR" fit the same slot.

### 5.7 Tiles and badges (shared by every grid)
- **Fixed corners:**
  - status at the **top-left** (NEW sticker, check, equipped face);
  - type or main stat icon at the **top-right**;
  - count or level at the **bottom-right** (an ink circle or pill with a white number);
  - a lock in the **centre**, with its 12 px unlock rule under it.
- At most 2 stickers per tile. Names show under the tile only where the art alone is not enough (items, not girls).
- **Item tiles (the owner's pick, Oct 20: the slanted plate; this replaces the item-tile frame and count pill drafted
  for the item-icon redo):** a 1.09:1 plate slanted −8° with rounded corners, a 1 px tier border and a white inner
  rim, the tier tint fading to white by 80 %, a sheen of three faint sakura petals and one diagonal white band (not
  facet triangles), and a soft tile shadow. The art is not slanted. The count sits bottom right **without a pill**:
  heavy navy italics (`#2b4467`) with a crisp white outline, 13 px on the 62 px phone tile, in the tile form
  `x2400` / `x42.3K` / `x450K` (lowercase x, uppercase K/M/B, rounded down; `fmtItemCount`). Rainbow, UR-display
  and Zenith items wear a rainbow plate. Built in `itemTile` (`src/ui/components.js`) and `base.css` "Items".

### 5.8 Toasts and banners
- One toast at a time, one line, at most `--t-banner`. Others queue.
- A wave banner never fires together with two feed toasts. The map rule shows as an icon in the top strip, and its text is one tap away.
- Nothing covers the centre 50% of the map for longer than 1.2 s.

---

### 5.9 Countdown chip
- One component for every timer: events, mail expiry, shop restock, banners and seasons.
- A `--plate` pill with a clock icon and the time from `fmtNum(…, 'time')` ("6d 4h", "11h", "12:05"). Under 24 h the time turns
  `--bad-on-plate`. No other way of writing "time left" is allowed on Glance surfaces.

### 5.10 Hub extensions (owner-approved Oct 20, from the reference study)
The owner approved E1 (hosts at 35%) and E3 (the left section rail) on Oct 20. The rest are additive and follow the existing rules.
- **E1 Screen hosts (approved).** A host girl with a speech bubble on **hub and list screens only**: Missions, Commissions, Mall,
  Bounty, Total Assault and Titan Trials, Happening Now, Attendance and the Mailroom.
  - Her art may take up to **35%** of the width there. Detail screens (her page, stage prep) keep `--art-band-w` 28%.
  - The bubble is white glass, radius 24 px, with a tail. It holds one line of at most 60 characters in `--fs-body` 700 and
    sits over her lower third, never over the list.
  - The line comes from a small table per screen, picked by state ("3 ready", "Event ends tomorrow", "Nothing to claim, nice
    work"). Reduced motion: no bounce. Hosts stay cute and in uniform (P9).
- **E2 Plate header band on list panels.** A list panel gets a `--plate` slanted strip as its title bar with the title in white
  display italics. Glass panels with the yellow underline stay for content panels.
- **E3 Left section rail (approved).** List screens with **2-5 sections** (Mailroom, Mall, Happening Now, Workbench) put their tabs
  in a vertical rail on the left edge: active = a `--plate` slab with yellow italic text and the −8° slant; inactive = white glass
  with `--ink` text; red dots only; at least 44 px tall. Hub category tabs stay on the bottom edge (5.3).
- **E4 Countdown chip.** See 5.9.
- **E5 Item tile frame (for the item-icon redo).** The 5.7 tile with a soft 10° slant on the top-right corner; the field is a
  diagonal gradient from white to the item's rarity colour (4.8 tokens) at 12-18% with 2-3 faint facet triangles. Rarity reads from
  the field and the frame, never from text (5.6) and never from glows painted into the item art. The count sits in the 5.7
  bottom-right ink pill. Selected = a 3 px `--yellow` ring. LR Nightglass stays exclusive (5.6).
- **E6 A painted location per hub.** A blurred, dimmed academy location behind the glass panels: Mall = the shop counter,
  Commissions = the staff room, Backpack = the locker room, Recruit = the admissions hall, Mailroom = the post room, Workbench = the
  club lab. Text always sits on a panel or a plate, never on the painting (P6).
- **E7 Chapter slate and the loading corner.** A chapter title slate counts as the screen's one Street punctuation (P8) and holds
  for at most `--t-banner`. The loading chip never covers a primary button or the bottom-right corner cluster.
- **E8 Keyboard hints on desktop.** A small `--plate` chip ("Space") under the primary button and "Esc" on close buttons; 12 px;
  hidden on touch (`@media (hover: none)`).
- **E9 Off-season and idle states.** Seasonal modes between seasons: full-bleed location art, one `--plate` band with one sentence
  and the next date.
- **E10 3D girls in Formation and Quick Pick.** The squad stands as our 3D chibis (still, not animated, in grids).
- **Badge vocabulary (adds to P7):** red dot = claim, yellow dot = new, pink slanted "In Progress", navy "New" tab, yellow "Open!"
  sticker for a newly available mode.

## 6. Condense plan for the six most cluttered screens

Ranked by the Oct 20 audit at 844x390. **Numbers** means visible text elements that contain a digit, counted the way the audit
counted them (currency bar and HUD included, so before and after compare directly). **Whole** means everything in the screen's
main scroller, on screen and off.

### Summary

| # | Screen | Visible numbers, before → after | Whole screen, before → after | Scroll, before → after (screens) | Smallest text |
|---|---|---|---|---|---|
| 1 | Battle upgrade tree, live | **52 → 7** | one screen | 1 → 1 | 8.5 → 12 px |
| 1 | Battle upgrade tree, hold sheet (girl not deployed) | **61 → 8** | one screen | 1 → 1 | 8.5 → 12 px |
| 2 | Girl page, Info | 7 → 10 | **39 → 10** | 6.6 → 1.3 | 10.9 → 12 px |
| 2 | Girl page, Equipment | 17 → 12 | **58 → 12** | 7.4 → 1 | 11 → 12 px |
| 2 | Girl page, Tree | 18 → 6 (11 with a tier tapped) | **108 → 6** | 3.9 + sideways overflow → 1 | 10.4 → 12 px |
| 3 | Stage prep, 4-3 (not cleared) | 16 → 11 | **84 → 11** | 5.8 → 1 | 9.9 → 12 px |
| 3 | Stage prep, 2-3 (cleared) | 16 → 11 | **59 → 11** | 5.1 → 1 | 9.9 → 12 px |
| 4 | Backpack, Equipment | 17 → 16 (now 14 gear pieces in view, before none) | **147 → 32** | 7.2 → about 2.5 | 9 → 12 px |
| 5 | Achievements | 20 → 12 | 316 → about 2 per row | 20.4 → target ≤ 10 | 8 → 12 px |
| 6 | Battle, selected-girl drawer | **23 → 13** | drawer 22 → 4 | 2.1 → 1 | 9 → 12 px |
| 6 | Battle, hero drawer | **32 → 13** | drawer 27 → 4 | 1.9 → 1 | 9 → 12 px |
| 6 | Battle HUD, mid-wave (no drawer) | 16 → 12 | – | – | 9 → 12 px |

Two rows go up on purpose. The Info tab gains its 3 headline stats, which used to sit six screens down in a 12-row table. The
backpack shows the same count, but now the numbers are the levels of 14 gear pieces, where the first screen used to show tab and
box counts and no gear at all.

---

### 6.1 Battle upgrade tree: the live tree and the hold sheet (score 5)

**Before (844x390):** 102–104 labels and 52–61 numbers on one screen. 87–94 of them are under 11 px (the smallest is 8.5 px).
Fifteen cells each pack a tier number, an icon, a name, an effect line (cut off), tag chips and a cost. A left column repeats
the card art, the passive, a tag legend and the path rule, and the rule is printed again on the locked row. The row numbers
are 1.9–2.0:1 and the locked path sits at opacity 0.5 (about 2:1).

**After: layout**
- **Header** (`--plate`, 44 px): portrait (32 px) · name · tier code ("2-0-1", live only) · one status chip ("Paused" or
  "Paused · stage prices") · "i" · close.
- **Grid** (left, about 560 px wide): 3 path rows × 5 cells.
  - **Path row label:** path icon + path name (`--fs-name`) + **one** tag sticker (the path's main target: Self, Allies or Enemies).
  - **Cell** (about 104 × 72 px): the tier icon (36 px) in a state ring:
    - **owned:** a filled ring and a check;
    - **next:** a highlighted ring, with a **cost button** under it;
    - **later:** a plain ring;
    - **locked path:** a lock-tinted ring, with text kept ≥ 4.5:1 (no opacity fade).
  - The 5th column uses the capstone frame. A capstone already held by another girl of the same type shows a small portrait
    sticker on it.
- **Detail panel** (right, about 236 px; the existing tap-detail view): the tier name · "TIER 4 · KUNAI CRAFT" · **3 effect chips**
  (for example +5 DMG, +25% DMG, +4 PIERCE) · MORE (the full effect text: armor ignore, stun chances) · **Buy** (live only, primary
  cost button). Before anything is tapped, it shows the next tier of the most-upgraded path.
- **Locked path:** one line, "Locked: two paths in use", with an "i".

| Stays visible | Behind tap | Behind "i" or MORE | Merged | Removed |
|---|---|---|---|---|
| path names, one tag per path, 15 icons with owned / next / later / locked states, the next price on each open path, the tier code | any cell → the detail panel (name, 3 chips; the price if it is not a "next" cell) | the path rule (one path to 5, one to 2, third locks; one capstone per path per girl type), the tag legend, the full tier text | "Not deployed" + "Paused while open" → one status chip; left column + detail → one detail panel | the card art (she is on the board), the passive (it lives on her page), per-cell tier numbers (the column says it), per-cell tag chips, the repeated rule |

**Visible numbers after:**
- Live tree (Aoi, 2-0-1), **7 at most:** the tier code, 2 next prices (path 2 is locked), and in the detail panel "Tier 3" plus up
  to 3 chips. The Buy button shows no price because the price is on the selected cell.
- Hold sheet (Kage, not deployed, a later tier selected), **8:** 3 next prices, "Tier 4" plus 3 chips, and the selected tier's price.
- About 22 labels instead of 102–104. Nothing under 12 px.

**At 1280x720:** each cell also shows the tier name under its icon, never the effect line.

---

### 6.2 Girl page: Info, Equipment and Tree tabs (score 5)

**Before:** a 42 px top bar and a 40 px tab row leave a **286 px** content window beside a fixed card column of about 290 px (35%).
- Info: 102 labels and 39 numbers over **6.6 screens** (Chika 8.2).
- Equipment: 137 labels and 58 numbers over **7.4 screens**.
- Tree: 160 labels and 108 numbers, with the path columns overflowing sideways.
- Inactive tabs are 3.76–3.89:1, the "R" tag 2.51:1, and the tree pips 1.44:1.

**After: the frame (all tabs)**
- **Art band** (`--art-band-w`, 236 px): the card art fills it.
  - **Prev and next** chevrons sit on the art edges (44 px).
  - The **3D chibi** toggle becomes an icon button on the art's top-right corner, replacing the 44 px "Card Art / 3D Chibi" row.
  - **The plate** is an ink plate over the bottom of the art: the name, the class in caps, the rarity tag, **LV 48/50**, the star
    glyphs, a **P5** sticker and **⚔ 934**. This is the only place level, stars, Potential and power appear (P7).
  - The band stays still while tabs change.
- **Top bar:** back, "Students", currency pills. The name moves to the plate.
- **Tab rail:** INFO · LEVEL · AWAKEN · GEAR · TREE, `--tab-h`.
- **Content window:** about 564 × 300 px (was 508 × 286).

**Info tab**

| Stays visible | Behind tap | Details (MORE, "Base stats" or "Profile") | Merged | Removed |
|---|---|---|---|---|
| role icon + role name + role sticker; up to 3 trait chips + "+N"; one sentence; the **ink strip** with 3 headline stats + MORE; a matchup row (▲▲ / ▲ / ▼ with the armor word); a Potential row (6 pips + one line naming the next unlock, "Next P6: …") | "+N" chips; a matchup chip → that armor type in one line; capability icons → one line each | the base-versus-yours stat table, the type table with multipliers (×1.25, ×0.75), good-against and limitation sentences, the bio, quote, tips, "unlocked through upgrades" | the 5-tile type table + good against + limitation → one matchup row; capabilities → one icon strip | nothing is deleted; long text moves to the Profile and Base stats sheets |

- **Visible numbers after: 10.** Currencies 2, plate 3 (LV 48/50, P5, ⚔ 934), the "+2" trait chip, the 3 headline stats
  (DMG 11.8, RATE 1.9/s, RANGE 4.3) and the Potential line.
- Whole tab 10, about 1.3 screens.

**Equipment tab**

| Stays visible | Behind tap | Details | Merged | Removed |
|---|---|---|---|---|
| 3 slot tiles, each with the gear icon in its rarity frame, a **+level** badge and the **main stat** chip (an empty slot shows "+" and "Equip"); a gear-totals ink strip with her role's 3 stats + MORE | a slot → the item sheet (substats, Enhance, Reroll subs, Reroll main, Lock, Unequip, with Enhance as the primary); "Change" in the sheet → the gear picker (filter + sort + the gear grid from 6.4) | all 8 gear totals; substat growth ("next substat growth in 3 levels") | the 8 total chips → one strip; the 4 dropdowns + rarity row → one Filter button inside the picker | the inline gear list (it is the picker now) |

- **Visible numbers after: 12.** Currencies 2, plate 3, two filled slots × 2 (+6 / ATK +22%, +10 / ULT HASTE +26%), and the
  3 strip stats (ATK +22%, RATE +13%, RANGE +22%).
- Whole tab 12, one screen, no scroll.

**Tree tab**

| Stays visible | Behind tap | Behind "i" | Merged | Removed |
|---|---|---|---|---|
| the same 3 × 5 icon grid as the battle tree (6.1), without prices; one rule line ("One path to tier 5, a second to tier 2") | a cell → the detail panel: tier name, 3 effect chips, base price | the full path rule and the valid / not allowed examples | the rules box and the 3-row path summary → the grid itself | the "5-2-0 / 3-3-0" notation from the Glance view |

- **Visible numbers after: 6.** Currencies 2, plate 3, the rule line. **11** with a tier tapped.
- No sideways overflow at 844.
- **Hero track (Hikari):** show the current level band (the current level ±2 rows) and the ult. The full 25-row track goes behind
  "Full track".

**Level Up and Awakening** (same milestone, lighter touch):
- **Level Up:** the LV bar with the cap, the EXP preview, **Auto select** and **Level up** (primary). Per-book steppers go behind a
  "Manual" toggle.
  - Every requirement keeps its icon, owned/required and a "Where to get" button (teleport), as the game requires.
- **Awakening:** the star row, the next star's single bonus, the cost and **Awaken**. The per-star tiles that repeat "+5% DMG"
  go into Details.

**The hold info sheet in menus** (score 4): this becomes the Glance sheet: plate, ink strip, 3 slot tiles, the ult and **Full page ▸**.
Its Info tab (190 labels over 10.2 screens today) is dropped in favour of "Full page". The header no longer repeats level, stars
and P.

**At 1280x720:** the same structure. The art band is 30% and the Info tab shows the matchup row and capabilities side by side.

**Compact / Detailed** (owner, Oct 21: the condensed page made equipment stats hard to see): Settings → Display → **Girl page**
(`profile.settings.girlPage`, `'compact'` by default; additive, display only, the co-op sim id is unchanged). Compact is the page
above. Detailed keeps the same frame and components and puts the Details on the page itself (`src/ui/girlDetail.js`):
- **Info:** the base-versus-yours stat table under the strip, every matchup entry with its multiplier, each capability with its line.
- **Equipment:** each slot card adds its main stat value and every substat; every gear total (MAX marked), the fill-in line and the
  set bonuses that are on replace the 3-cell strip (tap them: the totals sheet).
- **Level Up:** the Manual steppers start open. **Awakening:** every star with its bonus, the next one highlighted.
- **Tree:** the picked path's five tiers with their effects under the grid (the first path until a cell is tapped).
- An open girl page follows the switch at once. `e2e/girl-page.mjs` checks both looks at 844x390 and 1280x720.

---

### 6.3 Stage prep (score 5)

**Before:** 33 labels and 16 numbers visible. The whole screen holds **202 labels and 84 numbers in a right column 5.8 screens
tall** (4-3).
- The difficulty subtitles are cut off at 9.9 px.
- The decision (difficulty, then Start) is split between the top and the bottom.
- Start is a sticky footer that covers part of the scroller.
- The advanced tier sticker ("Storm" since v0.1.45) is 2.05:1, "In formation" 2.61:1, and the Waves / Lives / Start cash labels 3.93:1.

**After: layout, with no scrolling at 844x390**
- **Left map band** (about 300 px):
  - the map thumbnail with the stage name plate and the tier sticker ("Storm": ink letters on the tier colour);
  - under it, the **stage ink strip**: WAVES 25 · ♥ 100 · START 780;
  - one mission sentence (≤ 60 characters) + "i" for the full mission text and the map rule.
- **Right column**, top to bottom:
  1. **Difficulty**, a 2 × 2 grid of big buttons. Each shows the medal (earned or not), the name, and the reward only while it is
     not yet earned (for example "💎 40"). The selected difficulty's **one rule sentence** sits under the grid. It leaves out
     what the stage strip already shows (on Nightmare the strip already reads ♥ 1, so the line reads "+75% HP, no income").
  2. **Counters:** one row, "Counters 3/3 ✓". Tap → the counters sheet (each need, the girls who cover it, Add).
  3. **Drops:** one row of up to 5 drop icons in rarity frames (the first-clear reward first, with a FIRST sticker) and a "›".
     Tap → the drops sheet with percentages and quantity ranges.
  4. **Mode:** one chip, "Standard ▾". Tap → the mode sheet: battle modes and Freeplay, with their explainers and locks.
  5. **Footer:** **Start · Normal** (primary). Sweep ×1 and ×10 (secondary) appear only when sweep is unlocked; otherwise one
     line, "Sweep: clear on Hard".

| Stays visible | Behind tap | Behind "i" | Merged | Removed |
|---|---|---|---|---|
| title, stage strip (waves, lives, start coins), one mission line, 4 difficulty buttons with unearned rewards, the selected rule, "Counters 3/3", drop icons, the mode chip, Start, Sweep when unlocked | counter details and Add; drop % and quantities; battle modes and Freeplay | the full mission text, the map rule, map name and clears | Waves / Lives / Start cash tiles → one strip; 4 cut-off subtitles → one sentence for the selected difficulty; battle mode + Freeplay → one Mode chip; first-clear gems → the first drop icon | "Mission 4-3" and the "4-3" map sticker (the title says it), "Ribbons 0/20" while 0, rewards already earned |

**Visible numbers after:**
- 4-3, Normal selected, **11:** the title, 2 currencies, 3 strip stats, 4 difficulty rewards and "3/3". Normal's rule line has
  no number.
- 2-3, cleared, Nightmare selected, **11:** the title, 2 currencies, 3 strip stats, 1 unearned reward, the rule line, "3/3",
  ×1 and ×10.
- Whole screen = visible, with no scroll.

**At 1280x720:** the same layout. The counters row may show the three needs as icons with checks.

---

### 6.4 Backpack › Equipment (score 4–5)

**Before:** 41 labels and 17 numbers visible, but **312 labels and 147 numbers over 7.2 screens**.
- The first screen is tab counts, 3 reroll items and 5 gear boxes, each with three buttons. The first gear piece appears on the
  third screen, after slot chips and four dropdowns.
- Each gear card carries about 10 labels: a three-line name, rarity, slot, +level, the main stat, up to 4 substats with ▲ marks,
  and the owner.
- The tab rail overflows sideways (927 px wide in an 844 px screen). The tab counts are 2.66–3.44:1.

**After: layout**
- **Tab rail:** ALL · ENHANCE · AWAKEN · GEAR · TICKETS · TOKENS. These are one-word labels for the same categories, they fit at
  844 without scrolling, and they carry red dots, not counts.
- **Toolbar** (40 px): **Supplies ▸** (red dot when a box can be opened) · **Filter** (rarity, slot, main stat, substat, show) ·
  **Sort** ("Best first") · **Salvage** (icon, danger). Gear capacity ("30/1000") appears in the toolbar only when 90% or more
  is used.
- **Gear grid:** tiles of about 96 px, 7 per row at 844, 2½ rows in view. Each tile (5.7):
  - the gear icon in its rarity frame (the ladder in 5.6, ready for UR gear);
  - the main stat **icon** at the top-right;
  - **+level** at the bottom-right;
  - the wearer's face at the bottom-left.
- **Tap** a tile → the item sheet (name, rarity tag, the main stat value, substats with ▲, Enhance as primary, Reroll, Lock,
  Equip on…). **Hold** → the same sheet with a comparison against the piece the wearer has in that slot.
- **Supplies sheet:** the 5 gear boxes (icon, ×count, **Open**, Open ×10, Open all) and the 3 reroll items (icon, ×count, what
  they do in one line). Dice and pins stay in the Equipment category; they only move off the first screen.

| Stays visible | Behind tap | Behind hold | Merged | Removed |
|---|---|---|---|---|
| the gear grid (icon, rarity frame, main stat icon, +level, wearer), Supplies, Filter, Sort, Salvage | item sheet: name, main stat value, substats, actions; Supplies sheet; Filter sheet | compare with the equipped piece | reroll items + gear boxes → Supplies; 4 dropdowns + rarity chips + slot chips → Filter; "Take from …" → "Equip on…" in the sheet | tab counts; the capacity line while far from full; the three-line names and substats from the grid |

**Visible numbers after: 16.** Currencies 2 and 14 fully visible tiles × 1 (+level). The main stat value moves into the sheet;
its icon stays on the tile.
- Whole tab for 30 pieces: **32** (was 147).
- Labels per piece: about 10 → 1.

**At 1280x720:** 10 tiles per row. The tile may add the main stat value under its icon; it never shows substats or names.

---

### 6.5 Achievements (score 4)

**Before:** 45 labels and 20 numbers visible, and **486 labels and 316 numbers over 20.4 screens**.
- The tab row, category chips, "Ribbon case 0/33" and "Claim all" leave a **229 px** list window.
- The "HR" badges are 8 px (6.4 px stars at 1280), and "Rookie Sentinel" is 2.56:1.
- Tier ladders open inline (8 steps × 3 lines). Each row carries 2–4 reward tiles.

**After: layout**
- **Header row** (44 px): a category chip "All ▾" (opens a category sheet with each category's ready count), the ribbon case
  icon button, and **Claim all** (primary, with a count badge). The list window grows to about 270 px.
- **Groups:** **Ready** first (a header with its count), then **In progress**, then **Done**, collapsed by default.
- **Row** (60 px):
  - the icon;
  - the title (`--fs-name`);
  - one description line;
  - a progress bar with "n/m" (in-progress rows only; a ready row shows a full bar and Claim);
  - **one** reward icon with its amount, plus a stacked-icon hint when there are more;
  - Claim.
- **Tap** a row → the ladder sheet (all tiers, all rewards, the title and ribbon it grants).

| Stays visible | Behind tap | Merged | Removed |
|---|---|---|---|
| Claim all, the Ready count, per row: icon, title, one line, bar, one reward, Claim | the tier ladder, every reward, the title and ribbon preview, the category counts | category chips → one category chip; ribbon case + "0/33" → an icon button (progress inside); 2–4 reward tiles → one reward + a stack hint | "1/1" on ready rows, "×1" on single rewards, "0 / 24" category zeroes, inline ladders, completed rows (collapsed) |

**Visible numbers after: about 12.** Currencies 2, Claim all 1, Ready 1, and about 2 per row (the digits in the description and
the reward amount) over 4 rows.
- Whole list: about 2 numbers per row instead of 3–5, and target **≤ 10 screens** for the audited save (was 20.4) once Done is
  collapsed and the ladders move to the sheet.

---

### 6.6 Battle: the selected-girl drawer, the hero drawer and the HUD (score 4)

**Before:** the girl panel shows 49 labels and 23 numbers, and is 340 × 330 px (about 40% of the board).
- It shows: the name, tier code, P5, "role · type", Kills and Damage, a 5-way target selector, and 3 path cards. Each path card
  has a name, a cut-off focus line, 5 pips, the tier name, a tag chip, a description, and a struck-through old price next to the
  new one.
- The locked-path note is 3 lines at 2.83:1, and the stats grid is a second scroll page.
- The hero panel shows 48 labels and 32 numbers: "Hi…" truncated, three "Next / Then / Then" lines and the ult rank text. The
  HUD hero widget repeats the level, the ult and LV UP.

**After: girl drawer** (`--drawer-w` 288 px, about 34%)
- **Header** (`--plate`): portrait (40 px), the full name, role and type **icons**, the tier code, Tree (icon), close.
- **Target:** one stepper, "‹ FIRST ›" (44 px arrows), cycling First / Last / Strong / Close / Priority.
- **Paths:** all 3 visible without scrolling. Each row has the path icon, the path name, 5 pips and the **cost button** for the
  next tier.
  - A locked path shows a lock icon and the word "Locked"; tap for the one-line reason.
  - A finished path shows a MAX sticker.
  - Tapping a row body expands one line under it: the next tier's name + up to 3 effect chips.
- **Footer:** **Sell · 364** (danger) and MORE (the stats sheet: DPS, damage, attacks/s, range, pierce, armor pen, crit, the
  upgrade discount, invested, kills, damage dealt, P level).

| Stays visible | Behind tap | Details (MORE) | Merged | Removed |
|---|---|---|---|---|
| name, role and type icons, tier code, target, 3 paths with pips and next price, Sell | the next tier's name and chips (row tap); the lock reason; what a stat is (a tap on it, M4) | the stats grid, Kills and Damage, Invested, P level, the discount | "role · type" text → 2 icons; focus line + tier name + tag + description → one expandable line | the struck-through old price (the price shown is the real one), the 3-line lock note, the second scroll page |

**After: hero drawer:** header (portrait, the full name, UR tag, **LV 1**) · the XP bar (no numbers on it) · **Level up · 145**
(cost button) · one line "Next: Steady Guard · +1 DMG" · the ult icon with "Unlocks at LV 3" (or its rank) · Move · MORE (the
full 25-level track and the ult text). **The HUD hero widget hides while the hero drawer is open.**

**After: HUD top strip** (`--hud-top-h` 44 px, floating readouts, not a full bar):
- **Always on:** pause · ♥ 100 · coins 1,850 · WAVE 1/20 · the next-wave enemy **icons** with trait icons (counts on tap) · the
  map-rule icon (its text on tap) · speed 2×.
- The stage id and difficulty move to the pause menu.
- A "New!" sticker shows the first time only.
- **Card row:** card art + the cost strip (the existing ink + yellow pattern, now `--fs-num-s`).
- **Hero widget:** portrait + a level badge + LV UP price. The ult shows as a fill ring with no number.
- **Ability bar:** owned by the abilities work. Its height goes into `--hud-ability-h`, and the drawer, toasts and banners keep
  clear of it. Each ability button is an icon + cooldown ring, with **at most one number** (seconds left) while it cools.

**Visible numbers after:**
- **Girl drawer open (Aoi), 13:** HUD 4 (100, 1,850, 1/20, 2×) + 5 card costs in view + drawer 4 (2-0-1, 565, 175, Sell 364).
- **Hero drawer open, 13:** HUD 4 + 5 card costs + drawer 4 (LV 1, Level up 145, the "Next" line, "LV 3").
- **Mid-wave, no drawer, 12:** HUD 4 + 8 card costs (was 16; the ×4 counts, the "NEXT 2" number and "2-3" go).
- **With the ability bar:** + at most 1 per cooling ability.

**At 1280x720:** the drawer is 340 px (27%). The expanded tier line may show the full sentence.

---

## 7. Rollout plan

Each milestone ships on its own: its own version, a before/after screenshot pair at 844x390 and 1280x720 for every screen it
touches, and an owner check on a real phone. The owner approved this direction on Oct 20; work starts with M0.

### Rules that keep this safe alongside the other tracks
1. **Tokens are additive.** No existing token is renamed or removed. The only value change is `--muted` (darker), which helps
   every screen at once, including screens being built right now.
2. **New screens built today with existing tokens are fine.** The UR gear screens and the Ascension screens are being built with
   today's tokens. They need no rework to merge. Once M0 lands, new UI in any track should use the new components (stat chip,
   ink strip, cost button, rarity tag). Anything built before that is swept in M5.
3. **Display only.** Nothing here touches `src/sim/**`, data definitions or the co-op compatibility id. UR and LR frames are
   display rules here; the LR step itself is built by the new-girls track.
4. **Stable hooks:** route names, tab ids and `data-testid` values stay the same, so the e2e suites keep working.
5. **One owner per file at a time.** When a milestone and another track both need the same stylesheet section, the one that is
   ready first merges and the other rebases. The coordination points are listed per milestone.
6. **A gate ratchet, not a big bang:** the CSS floor lint (section 8) may only go down per file. Each milestone takes its own
   screens to zero.

### M0: tokens, type scale and number formatting (foundation)
- **Scope:**
  - the tokens in section 4 (additive, plus the darker `--muted`);
  - self-hosted Barlow Condensed 600/700;
  - the shared component stylesheet (`.num`, `.lbl`, stat chip, ink strip, MORE sticker, cost button, rarity tag, tab rail,
    sheet and drawer shells);
  - `src/ui/format.js` (`fmtNum`) with unit tests, replacing the local formatters listed in section 2;
  - the CSS-token-equals-JS-rarity test.
- **What changes on screen:** muted text gets darker, and numbers that go through `fmtNum` change to the one style ("300K"
  becomes "300k"). There are no layout changes.
- **Coordination:** `ui/battle/util.js` and `ui/battle/scout.js` are battle files the abilities work also touches. The formatter
  swap there is a one-line import change per call site; land it before or after their merge, not during.
- **Done when:** vitest, build and smoke pass; the contrast table for every token pair used as text passes; screenshots differ
  only in muted ink and number style.

### M1: the girl page
- **M1a: the frame, Info and Tree.**
  - Scope: the art band and plate, the tab rail, the Info tab, and the shared **3 × 5 tree grid** component (built here without
    prices, reused by M2 with prices), the hero track band, and the menu hold sheet as a Glance sheet.
- **M1b: Equipment, Level Up and Awakening.**
  - Scope: the slot tiles, the gear-totals strip, the item sheet and the gear picker (the picker reuses the M3 grid tile, so build
    the tile here), the Level Up Manual toggle, and the Awakening next-star view.
- **Coordination:**
  - The UR gear work adds gear awakening, new substats and sets to the Equipment tab and the gear sheet. The Ascension work adds
    level gates (60 → 85) to Level Up.
  - M1b starts after those merge, or ships first and those tracks rebase onto the new slot tile and item sheet. Decide whichever
    is ready first; do not run both in the same files at once.
  - UR gear frames use step 5 of the rarity ladder (5.6).
- **Done when:** Info ≤ 10, Equipment ≤ 12 and Tree ≤ 6 visible numbers; no sideways overflow; the content window ≥ 300 px;
  no text under 12 px; no truncated stats or rules.

### M2: the battle drawer, hero drawer, HUD and upgrade tree
- **The owner's pick (Oct 20): the battle uses the Oct 14 tactical draft.** References: `docs/specs/ui-mock/tactical-oct14/`
  (`battle-panel-844x390.webp`, `boss-warning-844x390.webp`, `battle.html`, `moments.html`, `tactical-kit.css`).
  - **Girl drawer and hero drawer:** a full **ink-plate panel** (navy glass, the one `--cut` chamfer, hairline dividers) instead
    of the white drawer in 6.6. Inside: the portrait, the name in display italics with the path code (2-0-1), the role and
    attack chips; the **target chips** (FIRST · LAST · STRONG · CLOSE, the active one filled); the **stat row** as caps labels
    over big numbers (the role's 3 headline stats, plus PIERCE where the girl pierces); the **path rows**: a coloured edge, the
    path name in italics, "T3 · tier name" in caps, tier pips, and a **yellow price button** (two-tap buy); a locked path says
    why in one line; **Invested** and **Sell +N** at the bottom.
  - From the draft, change only what the rules require: numbers use Barlow Condensed tabular (not mono); the cyan accent
    becomes the ink accent (yellow for prices, text-safe blue for selection on white); every text pair passes 4.5:1; no text
    under 12 px. The number budgets below still apply.
  - **Top strip:** the draft's ink plates (LIVES, COINS, WAVE n/N with its segmented bar, the next-wave enemy chip). Keep it
    within the HUD budget; if the enemy counts push it over, they go one tap away.
  - **Boss warning band:** when a boss enters, a band with hazard stripes crosses the map: a small caps line ("BOSS · PHASE 1/3"),
    the boss name in display type, and one line of traits (for example "ARMORED · SUMMONS GUARDS AT 50%"), with thin WARNING
    tickers above and below. It slides in, holds and leaves so the map centre is never covered for more than `--t-banner`
    (1.2 s). It counts as the one banner (5.8), plays with the existing boss warning sound, and reduced motion shows it still
    for the same time. Hazard stripes stay danger-only (boss, leak, locked).
- **Scope:** the girl drawer (288 px), the hero drawer, the top strip, the card cost strip at `--fs-num-s`, the hero widget, the
  live tree and the in-battle hold sheet (the M1a grid plus cost buttons and the detail panel), the boss warning band, and the
  toast queue.
- **Coordination with the abilities work (it adds an ability bar to the HUD):**
  - If the ability bar lands first, M2 restyles it with tokens (cost button style, cooldown number at `--fs-num-s`) **without
    moving it**, and sets `--hud-ability-h` to its height.
  - If M2 lands first, the ability bar is built with the M0 components and sets `--hud-ability-h` itself.
  - Either way, the drawer, toasts and banners read `--hud-ability-h`, so neither side has to redo layout.
  - `battle.css` and `unit-info.css` have one owner at a time.
- **Done when:**
  - the HUD shows ≤ 4 numbers + card costs (+ cooling abilities);
  - the drawer is ≤ 300 px on phones;
  - the girl drawer shows ≤ 13 numbers with HUD, and the tree ≤ 8;
    - *Reading in use (the abilities branch's drawer, A3 M4; the owner has not ruled on it yet):* the 13 count the drawer
      itself, a cooling ability's seconds the one extra. The HUD and the card strip keep the first line's budget (≤ 4
      numbers + card costs, M5's work). With all three in view an 844 screen shows about 25–28 numbers, as the approved
      tactical mock-up does; the drawer's own required content (the stat row, tier codes, prices, Invested, Sell) cannot
      fit 13 together with the HUD. Ask the owner before M5 calls this line met;
  - nothing covers the centre 50% of the map for more than 1.2 s;
  - co-op runs unchanged (display only).

### M3: gear and the backpack
- **Item tiles:** every item and gear tile uses the 5.10 E5 frame, together with the item-icon redo.
- **Scope:** the Backpack Equipment tab (toolbar, Supplies sheet, Filter sheet, the gear grid with M1b tiles, the item sheet with
  hold-to-compare), the one-word category rail, and the All, Enhance and Awaken tabs moved to the same tile.
- **Coordination:** the UR gear work's new rarity and set icons go into the tile's corners (5.7) and the ladder (5.6). Gear set
  bonuses, if they ship, appear as one set icon on the tile and as a strip in the item sheet, never as text on the tile.
- **Done when:** gear tiles carry 1 number each; the first screen shows gear; the whole tab is ≤ 2.5 screens for 30 pieces;
  the tab rail does not scroll sideways at 844.

### M4: stage prep and results
- **Scope:**
  - Stage prep (section 6.3).
  - Results: Victory and Rewards. Glance: the medal, drops and Next stage. The damage breakdown and the time go behind tap. The
    freeplay strip moves onto a plate (it is 1.46:1 today).
- **Coordination:** new stage types from the Ascension work (its weekly boss trials) use the same stage prep layout: stage strip,
  difficulty or tier buttons, counters line, drops row, one primary Start.
- **Done when:** stage prep fits one screen at 844 with ≤ 12 visible numbers; Start sits next to the difficulty choice; there
  are no cut-off difficulty rules.

### M5: the rest
- **Scope, in audit order:**
  - Achievements (6.5);
  - the menu hold sheet leftovers;
  - Profile (hide the zero states, stop the name being cut by its chips);
  - Campaign stage select (tier labels onto plates; waves, ribbons and mechanic chips move to stage prep);
  - Formation, the girls list, the lobby (fold the top-left buttons into one tray), Bounty, Recruit (pity once), the Mall (the
    balance once), Settings (descriptions behind "i"), Commissions, Pause, the wave banner and toasts;
  - a sweep of any screens the other tracks built with the old tokens.
  - the hub extensions in 5.10: hosts with speech bubbles, plate header bands, the left section rail, the countdown chip
    everywhere, a painted location per hub, off-season states and the badge vocabulary.
- **Done when:** the CSS floor lint reports **zero** declarations under 12 px outside `.deco`, and every main screen passes the
  section 8 probe.

### Order and overlap at a glance

| Milestone | Can run alongside | Waits for |
|---|---|---|
| M0 tokens | everything | owner approval |
| M1a girl frame, Info, Tree | UR gear, Ascension, abilities | M0 |
| M1b Equipment, Level, Awakening | abilities | M1a; UR gear and Ascension merges (or they rebase onto M1b) |
| M2 battle | UR gear, Ascension | M1a (tree grid); a merge-order call with the abilities work |
| M3 gear and backpack | Ascension, abilities | M1b (tile); UR gear merge (or it rebases) |
| M4 stage prep and results | UR gear, abilities | M0; Ascension trial screens adopt it |
| M5 the rest | everything | M0 |

---

## 8. How to check (gates for every milestone)

1. **CSS floor lint:** count `font-size` and `font:` declarations under 12 px, failing on anything outside `.deco`. The count may
   only go down, per file. Today the count is 595.
2. **Size count:** distinct font sizes per screen ≤ 5 (plus display), and the stylesheets move toward the 7 tokens in section 3.
   Today there are 71–76.
3. **DOM probe at 844x390 and 1280x720** on every touched screen (the same probe as the Oct 20 audit):
   - the smallest computed size of visible text (≥ 12 / 13 px);
   - visible numbers per screen, card and tile against P3 and the targets in section 6;
   - truncated stats or rules (target 0);
   - drawer width as a share of the viewport;
   - content window height (≥ 300 px on phones);
   - no sideways overflow.
4. **Contrast table:** every token pair used as text ≥ 4.5:1 (≥ 3:1 for numbers of 22 px and up), measured on the real
   composited background.
5. **Owner check on a real phone:** before and after shots of each touched screen.

---

## Appendix: token CSS draft

```css
/* Additions to :root. Existing tokens are unchanged except --muted. */
:root {
  /* text-safe colours (the originals stay as fills) */
  --muted: #56647f;            /* was #6b7a99 */
  --muted-line: #6b7a99;       /* old value, non-text only */
  --blue-text: #1459c0;
  --pink-text: #b0174f;
  --good-text: #166f47;
  --bad-text: #b81d3b;

  /* ink plate */
  --plate: #0e1930;
  --plate-glass: rgba(14, 25, 48, 0.9);
  --on-plate: #ffffff;
  --on-plate-dim: #a9bcdc;
  --plate-accent: var(--yellow);
  --plate-line: rgba(255, 255, 255, 0.14);
  --good-on-plate: #5fe39a;
  --bad-on-plate: #ff8095;
  --blue-on-plate: #7cc4ff;

  /* type (desktop defaults; phone values below) */
  --font-num: 'Barlow Condensed', 'Arial Narrow', 'Nunito', system-ui, sans-serif;
  --fs-label: 13px; --fs-body: 15px; --fs-name: 19px; --fs-num-s: 19px;
  --fs-num: 28px; --fs-title: 36px; --fs-display: 56px;
  --lh-tight: 1.1; --lh-body: 1.35; --track-label: 0.06em;

  /* space and size */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
  --tap: 48px; --tap-dense: 44px; --icon-s: 24px; --icon: 28px;
  --chip-h: 32px; --strip-h: 68px; --tab-h: 40px; --topbar-h: 48px;
  --art-band-w: 30%; --drawer-w: 340px; --sheet-max-h: 60dvh;
  --hud-top-h: 52px; --hud-ability-h: 0px;

  /* shape */
  --radius-plate: 4px; --radius-chip: 6px; --cut: 14px;
  --sticker-tilt: -4deg; --sticker-line: 2px solid var(--plate); --sticker-drop: 0 2px 0 var(--plate);
  --scrim: rgba(14, 25, 48, 0.35);

  /* motion */
  --t-sticker: 240ms; --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1); --t-count: 400ms; --t-banner: 1200ms;

  /* rarity (mirrors src/data/types.js and src/ui/rarity.js) */
  --rar-r: #7aa7d9; --rar-sr: #ffc94d; --rar-ssr: #ff7ad9; --rar-ur: #b78bff;
  --gear-common: #9aa5b1; --gear-rare: #4a90e2; --gear-super: #a86bff; --gear-mythic: #ff5a7a; --gear-legendary: #ffb627;
  --frame-w: 2px; --frame-w-strong: 3px;
  /* LR Nightglass: do not use for anything else */
  --rar-lr: #ffd27a; --lr-edge: var(--plate); --lr-gold: #ffd27a; --lr-comet: 6s;
}

/* landscape phones: the breakpoint the stylesheets already use */
@media (max-height: 480px) {
  :root {
    --fs-label: 12px; --fs-body: 13px; --fs-name: 16px; --fs-num-s: 16px;
    --fs-num: 22px; --fs-title: 28px; --fs-display: 40px;
    --tap: 44px; --tap-dense: 40px; --icon-s: 20px; --icon: 24px;
    --chip-h: 28px; --strip-h: 56px; --tab-h: 36px; --topbar-h: 40px;
    --art-band-w: 28%; --drawer-w: 288px; --hud-top-h: 44px; --cut: 12px;
  }
}

.num { font-family: var(--font-num); font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.lbl { font-family: var(--font-num); font-weight: 600; font-size: var(--fs-label); line-height: var(--lh-tight);
       text-transform: uppercase; letter-spacing: var(--track-label); }
```
