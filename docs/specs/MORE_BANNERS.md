# More banners: an 8-week recruit calendar (design spec)

Design only. Nothing in the game changes until the owner says yes on the board. Written Oct 31, 2026, on
`spec/more-banners` (off `release/v0.1.66`). Builds on `docs/specs/BANNERS.md` (the banner system that shipped in v0.1.59)
and `docs/specs/ACCESSORIES.md` §4 (the Accessory Banner, on `spec/gear-update`).

Owner request: **"more banners"**.

Owner board: `docs/specs/more-banners/board.png` (phone version: `board-phone.png`; source: `board.html`). It uses only the
game's own art from `public/art/portraits/` and `public/art/items/`.

---

## 0. On one page

- **Today's banners stay as they are.** That covers Student and Guardian Spotlights every day, the LR tab alternating Tenka
  and Kohaku & Tsubaki, Standard, and Coin. Pity stays at 90 and is shared, the spark costs 200 points, and the Legend
  Promise stays at 300. **No live rate changes.** Every new banner uses the rates that are live today.
- **Five new banner kinds.** Each one is a data row once it is built:

  | New | What it is | Code needed |
  |---|---|---|
  | **Rework Days** | Spotlight pins that change a day's 3 SR rate-ups and title to the reworked girls, or put a premium girl on a day that would have featured a standard SSR | **none** (`PINS`, live today) |
  | **Featured** | A limited 3–7 day banner in its own tab. It runs **beside** the daily Spotlights and never replaces one. Seasonal frames (Halloween, winter) are a theme on it | once (≈ 1 day) |
  | **Legend Week** | Both LR tabs open every day for 7 days, with new SR rate-ups. Rates and the Promise are unchanged | **none** (`PINS`, live today) |
  | **Spotlight Selector** | A Featured banner where **you pick** the featured SSR from a short list (the Standard-pick idea, for premium girls) | small, on top of Featured |
  | **Fresh Start** | A one-time beginner banner for every account: three 10× pulls of Standard girls at 900 gems each, with a standard SSR guaranteed by the 30th pull | once (≈ 1 day) |
  | **Accessory Banner** | Exactly as ACCESSORIES.md §4: an LR's personal accessory at 1.0%, with its own pity of 80 per LR | in ACCESSORIES A2 |

- **No gear gacha.** The gear spec says a Set Box never has a gem price (GEAR_UPDATE §5.1). This spec keeps that rule and
  offers an optional gem-free "Set Week" shelf instead (§3.7, Q6).
- **The calendar (§4) runs Nov 5 to Dec 31.** Every one of the reworked girls is featured at least twice. That means the 12
  attack-shape girls who can be featured (8 SRs as rate-ups; Hotaru, Luna, Kanna and Ena as the featured SSR) plus Iroha.
  The 4 R girls with new shapes (Rei, Yuki, Momo, Fuu) have no rate-up mechanism, so the banner cards show them in a
  "New moves" strip. There are two Halloween banners, three winter banners, two Legend Weeks, two Selectors, Fresh Start,
  and up to two Accessory Banners.
- **More banners does not mean more pulls.** No new gem or ticket source is added. A free player still gets about 19 pulls
  a week, about 154 over the 8 weeks before patch-note gifts. The calendar leaves gaps so players can save (§7).
- **Nothing here touches the battle sim.** Banners are never imported by `src/sim/**` or the co-op files (BANNERS §I.2).
  The sim id and `COOP_PROTOCOL` stay as they are.

---

## 1. Rules this spec follows

| Rule | Where it comes from | How it holds here |
|---|---|---|
| Every banner has 1 select SSR + 3 SR rate-ups | owner, BANNERS §A.2 | Featured, Selector, Fresh Start and Legend Week all have them. The Accessory Banner is gear, not girls |
| LR units are harder to pull, get rate-up banners, are never sparked | HANDOFF §5 | LR stays at 0.5% inside the 1.5% SSR line; no spark, Select Ticket or Chosen Essence |
| No pay-to-win changes to live rates without the owner's OK | coordinator brief | No live rate moves. Fresh Start is a discount and the Legend Week boost is optional, so both are owner questions (Q3, Q5) |
| Pity carries as today | coordinator brief | One 90-pull counter for every gem banner (`profile.gacha.pity`); the Legend Promise per LR (`gl:<unit>`); the Accessory pity per LR (ACCESSORIES §4) |
| Event girls are free only | EVENT_SPEC E6 | No seasonal banner ever features an event girl |
| A Set Box never has a gem price | GEAR_UPDATE §5.1 | No gem gear banner (§3.7) |
| Content rules | CLAUDE.md, HANDOFF §6 | Seasonal banners use the girls' own art and titles. Outfits are never sold on a banner (Q7), and there are never swimsuits |
| The look-ahead players were shown never changes | BANNERS §A.4 | Every new row starts **at least 3 game days after** the patch note that adds it; tests check this |

---

## 2. What is live today

### 2.1 The banners (`src/data/banners.js`, `src/systems/banners.js`)

| Tab | Currency | Featured | Rotation | Pity / spark / promise |
|---|---|---|---|---|
| **LR Banner** (`legend`) | gems, tickets | Tenka or Kohaku & Tsubaki at **0.5%** (0.7% in a debut week), carved out of the 1.5% SSR line; 3 SR rate-ups per LR (`LEGEND_SR`) | debut pins (both premieres end Nov 4 and Nov 5, 7 PM Central), then **alternating every game day** (`LISTS.legend`) | shared 90 · no spark · **Legend Promise 300** (`gl:<unit>`, resets when she drops, carries across all her LR Banners) |
| **Student Spotlight** (`tower`) | gems, tickets | 1 SSR tower at 1.0% + 3 SR towers at 3.0% | daily: Iroha, Hotaru, Ena, Kaede, Chika | shared 90 · spark the select on her day, or any standard SSR |
| **Guardian Spotlight** (`hero`) | gems, tickets | 1 SSR hero at 1.0% (never Hikari) + Nami + 2 SR towers | daily: Kanna, Luna, Yoriko, Seiran | the same |
| **Standard** ("Open Enrollment") | gems, tickets | the player's pick of the 5 standard SSRs; 3 weekly SRs | permanent | shared 90 · spark any standard SSR · the first 10× ever guarantees an SSR |
| **Coin** (after 6-5) | 25,000 coins | 1 standard SSR at 0.167%, 3 SRs at 2.5% | weekly | no pity, no points · 20 pulls a week |
| **Friendship** | 100 Friend Points | standard SSR at 0.2% | weekly | no pity, no points · switched off until Friend Support is live |

Rail order: LR, Student, Guardian, Standard, Coin, Friendship. Pins (`PINS`) can take over a Spotlight or LR slot for
N game days. The v0.1.65 Gate cinematic plays the same way on every banner (blue, rainbow for SSR, Nightglass sky for LR),
so new banners get it for free.

### 2.2 Who is on which day (computed with `towerBanner` / `heroBanner` / `legendBanners`, Nov 6 – Dec 31)

| Cycle | Student select · its 3 SRs | Guardian select (Nami + 2 SRs) | LR tab |
|---|---|---|---|
| 5-day / 4-day / 2-day | Iroha · Akane, Ruri, Raika → Hotaru · Miko, Sango, Kage → Ena · Umeko, Shiro, Midori → Kaede · Suzu, Noa, Yuzuha → Chika · Ouka, Marumi, Chigusa | Kanna → Luna → Yoriko → Seiran (the SRs vary) | Tenka ↔ Kohaku & Tsubaki |

**One finding:** there are 15 SR towers and 5 Student selects, and the SR index is `3i mod 15`. So **each Student select
always gets the same 3 SRs.** Chigusa is only ever a rate-up beside Chika, and Kage only beside Hotaru. A data-only list
reorder cannot fix this, because every 15-girl order keeps the 5-day period. The fix is one line in `towerBanner`
(`3i + floor(i / 5)`, which shifts the trio each cycle), and it goes live with a new list version `since` so the
look-ahead never changes. Q9 (default: yes, with F1).

---

## 3. The new banner kinds

### 3.1 Rework Days: Spotlight pins (live code, data only)

A `PINS` row with `slot: 'tower'` or `'hero'` already takes over a Spotlight for N game days, with its own `sr` and
`name` (`towerBanner`, `heroBanner`). This spec allows only **two safe kinds** of Spotlight pin, so no premium girl
ever loses a spark day:

1. **Same select:** the pin's `unit` is the girl that day's rotation features anyway, and it changes only the 3 SRs
   and the title. Example: on Iroha's day the rate-ups become Kage, Miko and Suzu, the girls whose shots her mirrors split.
2. **Standard day:** the rotation's select that day is a **standard** SSR (Hotaru, Kaede, Chika, Luna), so she is
   sparkable on any day anyway. The pin may give that day to a premium girl, which adds an extra spark day for her.

New test: every Spotlight pin is kind 1 or kind 2. A pin is 1 game day (`days: 1`) and starts at a 7 PM Central reset
(the existing test).

Rates, pity, spark and look-ahead are the Spotlight's own. The pin is the day's Spotlight; the lobby slide and Notice
read it as they do today.

### 3.2 Featured: a limited banner beside the dailies (new slot, built once)

| Field | Value |
|---|---|
| Data | `FEATURES` in `src/data/banners.js`: `{ id, start, days, pool: 'tower'\|'hero', select, sr: [a, b, c], name, theme?: 'halloween'\|'winter'\|null, pick?: [...] }` |
| Tab | `slot: 'feature'`, `BANNER_KINDS.feature = { label: 'Featured', short: 'Featured', color: '#9b6be8' }` (violet), second in the rail after LR. Countdown "ends Sun 7 PM Central" |
| Pool | as the Spotlight of that kind: tower or hero select + standard SSRs of that kind; standard SRs; R towers |
| Rates | **the Spotlight's** (`RATES.gem`, `select` 10,000, `srUp` 30,000). No new rate |
| Currency | gems, Recruit Tickets, 10× tickets, the Moonpearl 10× ticket (as every gem banner) |
| Pity | the shared 90 counter |
| Recruit points | +1 a pull, spares as today |
| Spark | a premium select is **sparkable for the whole window** (`inSpotlightWindow` also reads the live feature); standard selects any day as today |
| Rules (tests) | at most **one** Featured at a time; never an LR, held or event girl; `sr` are standard SRs in the pool; `select` matches `pool`; starts at a 7 PM reset; starts ≥ 3 game days after the patch note that adds it |
| Theme | `theme` picks the card frame (Halloween: dusk orange with a lantern edge; winter: frost blue with a snow edge). It is CSS only and never changes rates |
| Never | replaces a daily Spotlight; changes pity or the spark price; features an R |

Why a new slot instead of more pins: a multi-day Spotlight pin would push the daily rotation's premium girls off their
spark days (§3.1). A Featured tab adds a banner and takes nothing away.

### 3.3 Spotlight Selector (a Featured row with `pick`)

- `pick: [ids]` lists 3–5 SSRs of the pool's kind. The player chooses the featured SSR, and can change it **once a game
  day** (the Standard-pick rule, `canChangePick`). The choice is stored in the counter `gf:pick:<featureId>` (an index + 1).
- **Spark:** the current pick is sparkable while the Selector runs (Q4 offers "all of the list" instead).
- The rates, pity and SR rate-ups are as for Featured; the SRs are fixed by the row.
- The tab shows "Your pick: Ena · change (once a day)" and the pick's own art.

### 3.4 Legend Week: both LR tabs every day (live code, data only)

Two `PINS` rows with `slot: 'legend'`, the same start and `days: 7`, one per LR unit, `debut` false, `rate` 5,000 (Q5),
each with its own `sr` and a `name`. `legendBanners(d)` already shows one tab per pin, and the tests already allow two LR
pins side by side when they are different units.

- **The Legend Promise counts on both tabs**, because each tab is her own LR Banner (`gl:<unit>`). A player who is at
  143/300 on Tenka keeps that count and keeps counting.
- **Why:** players chasing one LR wait every other day today. Legend Week gives them 7 straight days, and the everyday
  alternation comes back after it.
- **Never:** a rate above 0.5% unless the owner says so (Q5).

### 3.5 Fresh Start: a beginner banner for everyone, once (new slot, built once)

| Field | Value |
|---|---|
| Tab | `slot: 'starter'`, label "Fresh Start" (mint), last in the rail; it disappears once used up |
| Who | **every account, once**: new players and veterans alike, as with the Standard first-10× gift. The counter `gs:fs` holds the 10× pulls used (0–3) |
| Pool and rates | **Standard's** (standard units only; the select is the player's Standard pick; Standard's weekly SRs) |
| Price | **10× only, 900 gems** (a quarter off), at most 3 times = 30 pulls. Gems only (no tickets, so a ticket is never "wasted" at a discount) |
| Guarantee | if the first 29 Fresh Start pulls gave no SSR, the 30th is a standard SSR (one she does not own yet if any). It resets pity like any SSR |
| Pity and points | the shared 90, +1 point a pull |
| Value | 900 gems saved per account, once, plus a floor of 1 standard SSR in 30 pulls (30 pulls with no SSR happen about 64% of the time at the 1.5% rate, since pity only reaches 90) |
| Never | premium or LR girls (it only reaches girls the Standard banner already has) |

It is a discount, so it needs the owner's OK (Q3). The default is yes, because it gives no power a free player cannot
reach and it helps the first week, when a new player has only Hikari and the R girls.

### 3.6 Seasonal banners (a theme on Featured)

- A seasonal banner is a **Featured row with `theme`** and a seasonal title. It features the girls' own art; there is
  no seasonal outfit and no event girl.
- **Halloween** (the event runs until Nov 15, 7 PM Central; the exchange until Nov 22). Before F1 ships, the Halloween
  banners are Rework Days pins (title only, §4). After F1 they get the dusk frame.
- **Winter** (Dec 10–20). Banners can run without a winter event. A winter event is a separate spec (Q8).
- **Event exchanges** keep giving 1–3 Recruit Tickets, as Halloween does (HALLOWEEN_2026 §216). This spec adds no new
  event gems.

### 3.7 A gear / Set Box banner: not recommended

GEAR_UPDATE §5.1: a Set Box is "Never: a gem price, a stage drop, a Workbench output". A gem gear banner would break that
rule and turn gear, which is farmed today, into a gem purchase. **Recommended: none.** If the owner wants gear on the
calendar, the gem-free option is a **Set Week**. For 7 days the Boss Exchange Titan shelf sells the **choose-a-set**
Mythic Set Box (`setbox_pick_mythic`) for the usual 150 Assault Tokens instead of the Titan of the Week's set box,
1 a week as now. That is a data change in `shop.js` that ships with gear M2. Q6 (default: no Set Week until gear M2 has
been live for 2 weeks).

### 3.8 Accessory Banner (ACCESSORIES §4, unchanged)

| Field | Value |
|---|---|
| Featured | one LR's personal accessory: Tenka's **Lab Goggles** or the duo's **Walkie-Talkie Pair**; one banner per LR at a time |
| Price | 120 gems, 1,200 for 10×; **no tickets, no Recruit Points, no free pulls** |
| Rates | personal 1.0%; standard accessories Legendary 6%, Mythic 28%, Rare 65%; 10× gives at least one Mythic+ |
| Pity | **80 pulls without it gives it**. It carries to that LR's next Accessory Banner, never to another LR's, and is separate from the 90 and the Promise |
| Tab | its own kind (`accessory`, Nightglass navy with a silver edge), shown only while one runs |
| Gate | ships only with ACCESSORIES A2 and the owner's yes on Q17 there. On the calendar it is a **tentative** slot |

### 3.9 Legend Promise (live; how it reaches the new banners)

- The Promise is live: the 300th pull counted on an LR unit's own LR Banners is her (`rollBanner`, `gacha.js`). The count
  resets when she drops and **carries across every one of her banners** (everyday, debut, Legend Week, future reruns).
- This spec keeps 300. It adds a **"Promise 143/300" line on the lobby slide** of each LR banner, so a player can see how
  close they are without opening Recruit (display only).
- The Accessory Banner's pity of 80 is the same idea for her accessory, counted separately.
- Not proposed: moving a Promise count from one LR to another (it would make LR pulls fungible), or a Promise on
  Featured banners (the 200-point spark already guarantees those girls).

---

## 4. The calendar (Nov 5 – Dec 31)

Every start and end is **7 PM Central** (the daily reset; CST from Nov 1). "Key" days are named by the date the game day
ends. Rows marked **P0** need no new code; **F1** needs the Featured slot; **F4** needs Fresh Start; **A2** needs the
accessory build. A free player gets about **19 pulls a week**.

| Week | Dates (7 PM → 7 PM) | Banner (game text) | Kind | Featured | 3 SR rate-ups | Notes |
|---|---|---|---|---|---|---|
| 1 | Nov 5 | — | — | Both premieres have ended. The LR tab alternates again | — | — |
| 1 | Nov 6 → 7 | **A Garden of Mirrors** | P0 same select | Iroha (premium) | Kage, Miko, Suzu | her mirrors split their shots |
| 1 | Nov 6 → 7 | **Moonlit Study Hall** | P0 same select (Guardian) | Luna (standard) | Nami, Umeko, Raika | Moonbeam Sweep |
| 1 | Nov 7 → 8 | **Lanterns at Dusk** 🎃 | P0 same select | Hotaru (standard) | Akane, Umeko, Chigusa | Firefly Halo |
| 1 | Nov 8 → 9 | **Charms and Curses** 🎃 | P0 same select | Ena (premium) | Midori, Raika, Akane | the spreading curse |
| 1 | Nov 9 → 10 | **Captain of the Guard** | P0 same select (Guardian) | Kanna (premium) | Nami, Kage, Suzu | Ripple Quake |
| 2 | Nov 13 → 14 | **Curses at Midnight** 🎃 | P0 same select | Ena | Midori, Chigusa, Miko | Halloween finale |
| 2 | Nov 14 → 15 | **The Last Lantern** 🎃 | P0 standard day (Kaede's) | Hotaru | Akane, Suzu, Raika | the event's last day |
| 3 | Nov 19 → 22 | **Captain of the Guard** | F1 Featured (hero) | Kanna | Nami, Umeko, Midori | 3 days of Kanna spark |
| 3 | Nov 19 → | **Fresh Start** | F4 | your Standard pick | Standard's weekly | open until used |
| 3–4 | Nov 22 → 29 | **Legend Week**: Physics Club · Starfall | P0 two LR pins | Tenka 0.5% · Kohaku & Tsubaki 0.5% | Tenka: Raika, Suzu, Akane · duo: Umeko, Miko, Chigusa | the exchange closes Nov 22 |
| 4–5 | Nov 29 → Dec 6 | **Pick Your Spotlight** | F1 Selector (tower) | your pick: Ena, Iroha, Hotaru | Akane, Kage, Midori | 7 days |
| 5 | Dec 4 → 5 | **Moonlit Study Hall · Finals Week** | P0 same select (Guardian) | Luna | Nami, Chigusa, Raika | — |
| 5–6 | Dec 6 → 13 | **Lab Goggles** (tentative) | A2 Accessory | Tenka's personal accessory 1.0% | — | only if A2 ships |
| 5–6 | Dec 6 → 10 | (quiet days) | — | the dailies only | — | save for winter |
| 6 | Dec 10 → 13 | **First Snow** ❄ | F1 Featured (tower) | Iroha | Suzu, Chigusa, Kage | frost-glass mirrors |
| 6 | Dec 13 → 17 | **Winter Recital** ❄ | F1 Featured (hero) | Yoriko | Nami, Suzu, Miko | — |
| 7 | Dec 17 → 20 | **Lantern Walk** ❄ | F1 Featured (tower) | Hotaru | Umeko, Midori, Raika | — |
| 7–8 | Dec 20 → 27 | **Year-End Legend Week** | P0 two LR pins | Tenka · Kohaku & Tsubaki 0.5% | Tenka: Kage, Miko, Midori · duo: Akane, Raika, Chigusa | — |
| 8 | Dec 24 → 31 | **Walkie-Talkie Pair** (tentative) | A2 Accessory | the duo's personal accessory 1.0% | — | only if A2 ships |
| 8 | Dec 27 → Jan 3 | **Year-End Encore** | F1 Selector (tower) | your pick: Ena, Iroha, Hotaru | Umeko, Suzu, Kage | — |

Not dated: **Kogane** ("Clear the Road", Guardian) and **Norika** debut as Guardian pins when their drawn art lands
(`HELD`). Any third LR unit would get a debut pin like Tenka's; none is planned.

**Release timing.** The P0 rows for weeks 1–2 need a patch note by **Nov 3** (3 game days before Nov 6). That is a
data-only release (`PINS` + a patch note), with no sim change and the fast lane's review. F1 + F4 must be live by
**Nov 16** for the Nov 19 rows. If F1 slips, its weeks 3–8 rows become P0 pins on standard days, and the Selectors wait.

### 4.1 Who is featured (the reworked girls)

| Girl | Rarity · class | Times featured | Where |
|---|---|---|---|
| Ena | SSR premium | 4 | Charms and Curses, Curses at Midnight, 2 Selectors (choice), + her daily days |
| Iroha | SSR premium | 4 | A Garden of Mirrors, First Snow, 2 Selectors |
| Hotaru | SSR standard | 5 | Lanterns at Dusk, The Last Lantern, Lantern Walk, 2 Selectors |
| Kanna | SSR premium (hero) | 2 | Captain of the Guard (pin + Featured) |
| Luna | SSR standard (hero) | 2 | Moonlit Study Hall, Finals Week |
| Akane | SR | 6 | Dusk, Curses, Last Lantern, Legend Week, Selector, Year-End LW |
| Kage | SR | 6 | Mirrors, Guard, Selector, First Snow, Year-End LW, Encore |
| Umeko | SR | 6 | Study Hall, Dusk, Guard F1, Legend Week, Lantern Walk, Encore |
| Midori | SR | 6 | Curses, Midnight, Guard F1, Selector, Lantern Walk, Year-End LW |
| Suzu | SR | 7 | Mirrors, Guard, Last Lantern, Legend Week, First Snow, Recital, Encore |
| Raika | SR | 7 | Study Hall, Curses, Last Lantern, Legend Week, Finals Week, Lantern Walk, Year-End LW |
| Miko | SR | 5 | Mirrors, Midnight, Legend Week, Recital, Year-End LW |
| Chigusa | SR | 6 | Dusk, Midnight, Legend Week, Finals Week, First Snow, Year-End LW |
| Rei, Yuki, Momo, Fuu | R | — | R girls have no rate-up (each is already 8.9%). Their new moves show in the cards' "New moves" strip (display only, Q2) |

---

## 5. Rates (ppm; every table totals 1,000,000; printed by `bannerRates`)

| Banner | Featured | Other SSRs | 3 SR rate-ups | Other SRs | Rs |
|---|---|---|---|---|---|
| Featured / Selector / Rework Day, tower (e.g. Ena) | **1.000%** | Hotaru, Kaede, Chika 0.167% each | **3.000%** each | the other 12 SR towers 0.792% each | 9 R towers 8.889% each |
| Featured / Rework Day, hero (e.g. Kanna) | **1.000%** | Hikari, Luna 0.250% each | Nami + 2 SR towers **3.000%** each | the other 13 SRs 0.731% each | 9 R towers 8.889% each |
| Legend Week (each tab) | LR **0.500%** | the 5 standard SSRs 0.200% each | **3.000%** each | the other 13 SRs 0.731% each | 9 Rs 8.889% each |
| Fresh Start | the Standard pick **1.000%** | 4 standard SSRs 0.125% each | **3.000%** each | the other 13 SRs 0.731% each | 9 Rs 8.889% each |
| Accessory Banner | personal **1.0%** | Legendary 6% · Mythic 28% · Rare 65% (standard accessories) | — | — | — |

The SSR line is 1.5% on every gem banner, with a consolidated 2.02% including pity (BANNERS §A.1). The new banners do
not change it.

---

## 6. Pity, spark and promises across banners

| Banner | Shared 90 pity | Recruit points | Spark | Legend Promise 300 | Accessory pity 80 | Tickets |
|---|---|---|---|---|---|---|
| Student / Guardian (incl. Rework Days) | yes | yes | select on her day | — | — | yes |
| **Featured** | yes | yes | premium select for the whole window | — | — | yes |
| **Selector** | yes | yes | your current pick while it runs | — | — | yes |
| LR (everyday, debut, **Legend Week**) | yes | yes | never her | yes, her own count | — | yes |
| Standard | yes | yes | any standard SSR | — | — | yes |
| **Fresh Start** | yes | yes | (any standard SSR, as Standard) | — | — | **no** (gems only) |
| **Accessory** | **no** | **no** | never | no | yes, per LR | **no** |
| Coin / Friendship | no | no | — | — | — | — |

Stale-banner refusal (`'rotated'` before payment) covers every new tab, because each banner id carries its day.

---

## 7. Economy check (free player, the 8 weeks)

- **Income does not change:** 1,700 gems + 5 tickets a week ≈ **19.2 pulls**, ≈ **154 pulls** from Nov 5 to Dec 31,
  plus 100 gems per patch note and 1–3 tickets per event exchange.
- **What that buys** (the BANNERS §H odds, unchanged): a chosen featured SSR is 54% likely in 4 weeks and certain with
  the spark at 200 points. An LR from zero is about 32% / 64% in 1 / 2 months, and certain by 300 pulls.
- **The calendar gives choice, not pressure:** about one premium girl a week, two Legend Weeks a month apart, quiet days
  before winter, and every premium girl still on her daily Spotlight days. A player who skips every Featured banner
  loses nothing they had before.
- **Fresh Start adds 900 gems' worth once per account** (about 5% of a free player's 8-week income; about half a
  week's gems). It is the only new value in this spec, and it is Q3.
- **Accessory Banner cost** (ACCESSORIES §4): R1 is about 55 pulls on average and at most 80. It is a late-game
  purchase. The board shows its cost line next to the banner.

---

## 8. How it plugs into the data (a banner is a row)

| Banner | Row | File | Code before the first row |
|---|---|---|---|
| Rework Day | `{ slot: 'tower'\|'hero', unit, start, days: 1, sr, name }` in `PINS` | `src/data/banners.js` | none; add the pin-kind test (§3.1) |
| Legend Week | two `{ slot: 'legend', unit, start, days: 7, rate: 5000, sr, name }` in `PINS` | same | none |
| Featured / seasonal | `{ id, start, days, pool, select, sr, name, theme }` in `FEATURES` | same | **F1**: `featureBanner(d)` in `src/systems/banners.js`, rail slot + icon + about text + theme CSS in `src/ui/screens/recruit.js`, `inSpotlightWindow` and `daysToSpotlight` read the feature, `lookAhead('feature')`, the lobby slide via `activeBanners` |
| Selector | `FEATURES` row + `pick` | same | **F1b**: `setFeaturePick`, `gf:pick:<id>`, the picker sheet |
| Fresh Start | `STARTER = { price: 900, tens: 3, guaranteeAt: 30 }` | same | **F4**: `starterBanner`, `pullCost` with the price, the guarantee in `pull()`, `gs:fs` |
| Accessory | `ACC_BANNERS` rows | ACCESSORIES §4 | ACCESSORIES A2 |
| A new SSR girl | a new `LISTS.tower`/`hero` version with `since` ≥ 3 days after its patch note (live rule) | same | none |

- **Saves:** counters only (`gf:pick:*`, `gs:fs`), additive, no `SAVE_VERSION` bump. An older build ignores unknown
  counters and never sees the new tabs.
- **Sim and co-op:** unchanged. `src/data/banners.js` is never imported by `src/sim/**`. The checks are
  `node tools/simId.mjs` printing the same id and `COOP_PROTOCOL` unchanged.
- **Tests** (`tests/systems/banners.test.js`): every row's ids exist with the right class and kind; ppm totals; at most
  one Featured live; Spotlight pins are kind 1 or 2; every row starts ≥ 3 game days after its release's patch-note date;
  a premium Featured select is sparkable on every day of its window and not the day after; the Selector pick changes
  once a game day; Fresh Start stops at 3 tens and its 30th pull is SSR when 29 gave none; Accessory pulls never move
  `profile.gacha`.
- **Patch notes:** each data release names its banners and dates, e.g. "Rework Days: from Nov 6, the Spotlights feature
  the girls with new attacks", and every push to `main` carries a note.
- **Art:** each banner uses the girl's existing `-cut` / `-card` art. A theme frame is CSS. There is no new art and no
  generator spend.

## 9. Build plan

| Step | What | Code | Ships | Gate |
|---|---|---|---|---|
| **P0** | Rework Days weeks 1–2 + the Legend Week pins + the pin-kind test | data + 1 test | by **Nov 3** (fast lane: data only, no sim) | one independent reviewer + go/no-go |
| **F1** | Featured slot + theme frames + the SR-trio fix (Q9) | ≈ 1 day | by **Nov 16** | full gate (UI + data) |
| **F1b** | Selector pick | ≈ ½ day | with F1 or by Nov 26 | full gate |
| **F4** | Fresh Start | ≈ 1 day | with F1 | full gate (it touches `pull()`) |
| **A2** | Accessory Banner | ACCESSORIES §11 | when the owner says yes to Q17 there | its own gates |
| Data rows | weeks 3–8 | data | one release covering 2–3 weeks each, ≥ 3 days ahead | fast lane |

---

## 10. Open questions for the owner (each has a default, so nothing waits)

| # | Question | Default |
|---|---|---|
| Q1 | Go ahead with this calendar: Rework Days now, Featured from Nov 19, two Legend Weeks, winter banners in December? | **Yes** |
| Q2 | The 4 R girls with new moves (Rei, Yuki, Momo, Fuu) cannot be rate-ups. Is a "New moves" strip on the banner cards enough? | **Yes** (no R rate-up mechanism) |
| Q3 | Fresh Start: three 10× pulls at 900 gems for **every** account once (veterans too), standard girls only, SSR by the 30th pull? | **Yes, everyone once** |
| Q4 | Selector spark: only your current pick, or every girl on the list while it runs? | **Only your pick** |
| Q5 | Legend Week LR rate: keep **0.5%**, or the debut 0.7%? (0.7% is kinder to players but it is a live-rate change) | **Keep 0.5%** |
| Q6 | A gear banner: none (the gear spec says Set Boxes never cost gems), or a gem-free "Set Week" on the Titan shelf after gear M2 has been live for 2 weeks? | **None for now; Set Week later if you want it** |
| Q7 | Seasonal banners: girls only, never outfits on a banner (outfits stay event and exchange rewards)? | **Yes, never outfits on a banner** |
| Q8 | Winter: run the winter banners on their own (titles and frames), and write a winter event spec separately? | **Yes** |
| Q9 | Fix the "same 3 SRs on the same girl's day" pattern in the Student Spotlight (one line, new list version)? | **Yes, with F1** |
| Q10 | Accessory Banners on Dec 6 (Lab Goggles) and Dec 24 (Walkie-Talkie Pair), if ACCESSORIES A2 is ready? | **Yes, tentative** |
| Q11 | Show "Promise N/300" on each LR's lobby slide? | **Yes** |
