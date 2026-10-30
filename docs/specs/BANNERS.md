> **Owner decisions (Oct 28, 2026).** Build this now (owner: "Keep it and work fast!! Let's do this"). The design defaults
> are accepted (docs/HANDOFF.md §4: "defaults accepted unless the owner says otherwise"). Tenka does NOT wait for banners: she
> ships first with the ultimates update as a featured girl in today's Recruit; when banners ship, her LR/launch banner
> (§F) runs as her proper rate-up. Kohaku & Tsubaki are one duo unit and the first LR unit (docs/specs/DUO_LR.md).
> This spec was written Oct 20 against an older base (v0.1.36-v0.1.40): reconcile every roster name, rarity and
> heroes list with live main (v0.1.53) and feature/abilities before building, and keep the owner's rules (balance last,
> free players fine, LR never sparkable, pity 90 shared by gem banners).


---
title: Banners, LR units, new heroes, Friend Support and the Workbench
type: spec
status: design r2 (every critic issue resolved or answered in §Z; owner reviews; balance is last)
date: 2026-10-20
base: origin/train/next-wave 7288010 (sim 3786777a98fb, COOP_PROTOCOL 5) + feature/roster-wave 75a3ada + feature/new-girls-w1 efcb843 + feature/abilities 3a70786 (Tenka T0)
inputs: survey-economy.md, survey-roster.md, survey-social-craft.md (this folder); abilities/DUO_LR_DESIGN.md (incl. §5 owner decision); abilities/BUILD_PLAN.md §6, §9; core-units/GAPS.md §5; core-units/_roster_spec.tmp §7; docs/specs/{ASCENSION,POTENTIAL,GEAR_AWAKEN,HERO_REWORK}.md on origin/specs/next-wave
monte_carlo: spec-tools/mc.mjs (r1) and spec-tools/mc2.mjs (r2: carved LR rates, debut schedules), seeded, 200,000 players per row, 4M pulls per rate row
---

# Banners, LR units, new heroes, Friend Support and the Workbench

Design only. Nothing in a repo or worktree was changed. Every number is a first pass sized against today's free income
(1,700 gems + 5 tickets a week = 19.2 pulls; 76.7 pulls per 28 days, patch-note gifts excluded, see §H). The owner asked for
balance last, so the bench sets the final numbers; each knob is named where it matters.

Words used here. **Players and Sensei are "they"** everywhere (game text has no gender for Sensei). **LR unit** is the
player-facing name; the class key in code is `legend`. **Spotlight** is a daily gem banner; the girl it features carries a
Premium or Standard tag.

## 0. The whole design on one screen

| Topic | Default |
|---|---|
| **Banners** | Six kinds: **Student Spotlight** (towers) and **Guardian Spotlight** (heroes), both gems and daily; **LR Banner** (gems, its own tab, live every day); **Standard** (gems, permanent); **Coin** (coins, 20 a week, opens after 6-5); **Friendship** (Friend Points). |
| **Featured slots** | **Every banner** has **1 select SSR + 3 SR rate-ups** (owner rule). Gem banners: select **1.0%** of the 1.5% SSR rate, each SR **3.0%**. Standard: the player picks its select SSR. Coin and Friendship: a weekly select standard SSR (2/3 of their tiny SSR line) and 3 SRs at 2.5%. |
| **Rotation** | Spotlights change every game day at **7 PM Central**. Deterministic lists in `src/data/banners.js`; a list update never changes a day players were already shown. **Exception to daily rotation:** an LR unit's launch banner runs **7 game days**. |
| **Standard vs premium** | The **five original SSRs** (Hikari, Luna, Hotaru, Kaede, Chika) and **every R and SR** are **Standard**. **Every SSR from the roster wave on** is **Premium** (only on her Spotlight). **Tenka** and **Kohaku & Tsubaki** are **LR units**. The Standard banner never holds a premium or LR unit. |
| **Pity and spark** | One **90-pull pity** shared by every gem banner (as today). **200-point spark** on any standard SSR any day, and on a premium SSR **on her Spotlight day**. **LR units are never sparkable** (enforced in the system, not only the UI); LR pulls still earn points for other girls. Coin and Friendship pulls **never** touch pity or points, not even through spares. |
| **LR units** | Pulled only on their own **LR Banner**: LR **0.5%** taken **out of** the 1.5% SSR rate (debut week **0.7%**), never sparked, never a Select Ticket. **Legend Promise:** the 300th pull on her LR Banners is her. They arrive in **SSR form**, become **UR** at ★5 and **LR** through **Limit Break** (fee + a special solo stage). |
| **Stat boosts** | **UR Resonance** (every SSR at ★5): **+10% damage, +4% attack speed** along her own Potential axis (×1.144 DPS). **LR**: **+15% damage, +5% attack speed** on top (×1.208), plus the LR ability form (≤ +4%). |
| **Tenka** | **LR unit from launch** on **her own LR Banner**, "Tenka · Physics Club Premiere" (7 game days at 0.7%, 3 SR rate-ups). Ships with a small **G2-min** slice whenever her gates pass, not waiting for the full rotation. LR form later ("Thesis Defense"). Sells for 70%; powerhouse price band. |
| **New heroes** | **Kogane** (SSR, premium) and **Norika** (SR, standard), re-cast as adult academy staff, full 25-level kits (§D). **Marumi, Chigusa and Sorano stay towers**, as asked on Oct 14. |
| **Friend Support** | Borrow 1 friend's **Support Student** in solo campaign, Bounty and Freeplay (not Titan Trials in v1). FP pays at wave 3: borrower **+10** (5 a day), lender **+10** per friend (100 a day). A support run pays drops and FP and can make a first Easy/Normal clear, but never a Hard/Nightmare medal, a sweep, a Titan gate or an achievement. The borrowed girl is clamped to the borrower's own range. |
| **Workbench** | **Timed** crafts next to the instant Craft Room. 2 slots (3rd after 6-5), 1–12 h timers, weekly caps **no higher than the matching shop rows**, no speed-ups, no server. |
| **Free players** | Gem income unchanged; SSR-class rate unchanged on every banner (2.02%). A chosen featured or standard girl: **54% in one month, 91% in two, certain by 200 pulls**. An LR unit: **32% / 64% / 80%** in 1 / 2 / 3 months, **certain by 300 pulls**. Tenka with no saved gems: 35% / 66%; with 40 pulls saved: 60% / 77%. |
| **Co-op id** | Banners, the class table, coin, friendship, Workbench, Friend Support (solo) and both stat boosts touch **no co-op-hashed file** (`units.js` is not edited for classes). Only the new units (Tenka, the duo, Kogane, Norika), the LR ability forms and the G6 `statLimits` bump change the sim id, inside their own releases. |

---

## K. Your decisions → where they live (read this first)

| # | Your words (Oct 20) | Where | Status |
|---|---|---|---|
| D1 | "Lr's will be harder to pull, they do get rate up on their banners but no spark! They can spark other units though." | §A.1 rates (LR carved out of the 1.5%), §A.1 spark row, §C.1 | **Done.** LR 0.5% inside the SSR rate; no spark, enforced in `spark()`; LR pulls earn points for other girls. The Legend Promise is a guarantee (J3 says plainly that it works like a 300-pull spark with no choice). |
| D2 | "We also need to choose which unit will be standard and which units will be premium." | §B | **Default** (J1). Transition for the five roster-wave SSRs: §A.6, J11. |
| D3 | "premium banners standard banner coin banner and friendship banner you get when friends use your characters" | §A.2, §E | **Done.** Spotlights (premium girls live here), Standard, Coin, Friendship (FP from friends using your Support Student). |
| D4 | "a distinction between hero banners and regular tower banners!!" | §A.2 | **Done.** Student Spotlight = towers only; Guardian Spotlight = heroes as the select SSR. |
| D5 | "They can rotate out daily for now!!" | §A.4 | **Done**, with one stated exception: an LR unit's launch banner runs 7 game days ("her own banner"). After that the LR tab also rotates daily (J10). |
| D6 | "Banners will have their select ssr with 3 sr rate ups!" | §A.1, §A.2, §A.3 | **Done on every banner**, Coin, Friendship and Standard included. |
| D7 | "Standard banner will include a set of standard ssr's never premium units!" | §B, §A.6, §I.4 | **Done**, including the v0.1.39 gap: today's banner is renamed "Open Enrollment" until banners ship (§A.6). |
| D8 | "lr should give a bigger stat boost! Awakening to ur should as well!!" | §C.3 | **Default** (J7): UR ×1.144, LR ×1.208 (×1.25 with the form). |
| D9 | Duo LR (approved design), "the first unit to go from SSR to UR to LR", "max out ... awaken ... limit break ... a special stage" | §C.1, §C.2, §C.5 | **Done.** "Kohaku & Tsubaki · Prism Battery", Prismfall · Twin Star, Starfall Trial + "Starfall Promise" story, navy + white-gold frame, ember, 8-5 Nightmare stand-in, "Starfall Premiere" debut. |
| D9b | "She's the only planned Lr for now, actually maybe tenka too" | §F, J5 | **Default:** Tenka is an LR unit from launch. J5 says it rests on your "maybe" and gives the alternative. |
| D10 | "make some of the new units heroes you pick everything that goes with that" | §D | **Default** (J8): Kogane and Norika, full kits. The three Oct 14 tower answers stay towers. |
| D11 | Tenka: "definitely her own banner with rate up!", 70% sell, powerhouse price band | §F | **Done.** Her own 7-day LR Banner at 0.7% with 3 SR rate-ups, shipped with G2-min so she never waits for G1. |
| D12 | Crafting: "Keep it timed" | §G | **Default reading:** a timed Workbench added next to the instant Craft Room. |
| D13 | Balance is last, free players stay viable | §H | **Done.** Every number sized against 76.7 pulls / 28 days; the bench sets finals. |

---

## A. Banner types

### A.1 Shared rules (every gem banner)

| Rule | Value | Today |
|---|---|---|
| Price | 120 gems a pull, 1,200 for 10×. Recruit Tickets, 10× tickets and the Moonpearl 10× ticket work on **every gem banner** (Student, Guardian, LR, Standard), used before gems | same (`GACHA`, `gacha.js:58-76`) |
| Base rates | **SSR-class 1.5% · SR 18.5% · R 80%** on every gem banner. On an LR Banner the LR is **carved out of the 1.5%**: **LR 0.5% + standard SSRs 1.0%** (debut week: **LR 0.7% + SSRs 0.8%**) | SSR 1.5 · SR 18.5 · R 80 |
| Weights | Each banner is a table of **integer weights in ppm** (total exactly 1,000,000), drawn with `rng.int(1e6)`; the last bucket is the `else` case, so a roll near 1 still returns a unit | float thresholds |
| Select SSR | **1.0%** (2/3 of the SSR rate). The other SSRs of that banner's pool share 0.5% | none |
| 3 SR rate-ups | **3.0% each (9.0%)**; the other SRs of the pool share the remaining 9.5% | none |
| Pity | **One counter for all gem banners**: the 90th pull without an SSR-class result is SSR-class. On an LR Banner that pull is the LR with chance **0.5 / 1.5 = 33%** (debut 0.7 / 1.5 = 47%), else a standard SSR. Any SSR or LR resets it. Stored where it is today (`profile.gacha.pity`, clamp 0–89) | same counter |
| 10× guarantee | at least one SR in every 10× (the 10th is lifted to SR; the rate-up split applies to it) | same |
| Recruit points | +1 per gem-banner pull (tickets included), LR Banners included. Spares **from gem pulls** add points as today (R ⅕, SR 1, SSR 5) | same |
| Spark (200 points) | any **standard** SSR, any day; a **premium** SSR only in her **spark window** (her Spotlight day; see A.4 for lists longer than 6); **never an LR unit**; never an event girl. Enforced inside `spark()` through `unitClass(id)` (§I.1 G0), so a stale Mall row or a direct call is refused too | any SSR |
| SSR Select Ticket | any standard or premium SSR; **never an LR unit** (enforced in `redeemSelectTicket()`) | any SSR |
| Essence items | **Kindred SSR Essence** works on an owned LR unit (it needs her already, gives Potential, not the unit). **Chosen SSR Essence** (Moonpearls): any owned standard SSR, or an owned premium SSR on her Spotlight day; **never an LR unit** (J14) | Chosen: any owned SSR |
| Duplicates | +1 Essence or a spare, exactly as Ascension (`essence.js:131-145`) | same |
| Stale banner | a pull, a spark and a Mall spark purchase carry `{ bannerId, dayKey }`; if the game day rolled over, they are refused with `'rotated'` **before payment** and the screen refreshes | — |

Consolidated SSR-class rate with pity (4M-pull runs, `mc2.mjs`): **2.02% on every gem banner**, LR Banners included (standard
2.023%; LR Banner 2.016%, of which **LR 0.68%** per pull; debut 2.019%, of which **LR 0.94%**). LR pulls are therefore never a
better general-purpose pull than a Spotlight.

### A.1b Coin and Friendship pulls (the two "fixed" banners)

- **Own roll.** `rollFixed(table, rng)` reads and writes **no** `profile.gacha` state: never `pity`, `totalPulls` or
  `recruitPoints`, never `gl:`, `gs:`, `spk:r`. Results go through `grantUnit(..., { source: 'coin' | 'friend' })`.
- **Spares pay coins only:** R **1,000** · SR **5,000** · SSR **20,000** coins. **No recruit points, no Mementos, no
  Moonpearls.** A copy that is not a spare gives Essence as usual (feeding R and SR Potential is what these pulls are for).
- **10×:** at least one SR, on both.
- **Counting:** not in `stats.pulls` or the pull achievements; tracked as `coinPulls` / `friendPulls`.

Why: late game almost every R and SR copy is a spare. With today's spare table, the coin and FP caps would add about 10.6
recruit points, 81 Mementos and 5.9 Moonpearls a week (economy re-run), so coins and FP would turn into premium sparks, Moonpearl
10× tickets and Chosen Essence. With this rule they cannot.

### A.2 The six banners

| Banner (game text) | Currency | Pool | Select SSR | 3 SR rate-ups | Pity / spark | Rotation |
|---|---|---|---|---|---|---|
| **Student Spotlight** (`slot: 'tower'`) | gems, tickets | **towers only**: the select SSR tower + standard SSR towers; all standard SR towers; all R towers | 1 SSR tower, Premium or Standard (1.0%) | 3 SR towers (3.0% each) | shared 90 · spark the select (in her window) or any standard SSR | daily |
| **Guardian Spotlight** (`slot: 'hero'`) | gems, tickets | SSR: the select SSR hero + standard SSR heroes (Hikari, Luna); SR: every standard SR, heroes and towers; R: all R towers (there are no R heroes) | 1 SSR hero (1.0%); **Hikari is never featured** (starter) | **1 SR hero** (rotating: Nami, Norika) **+ 2 SR towers** (gacha-only girls first) | shared 90 · same spark rule | daily, its own list |
| **LR Banner · \<name\>** (`slot: 'legend'`) | gems, tickets | the LR unit + **all standard SSRs**; all standard SR; all R | the LR unit (**0.5%**, **0.7%** in her debut week), inside the 1.5% | 3 SR, set per LR unit | shared 90 · **no spark for her** (points still earned) · **Legend Promise 300** | debut week, then **daily** in its own tab (§A.4) |
| **Standard** | gems, tickets | **standard units only**: 5 standard SSRs, every standard SR, every R | **the player picks** one of the 5 standard SSRs (1.0%), changeable once a game day | 3 standard SRs, weekly | shared 90 · spark any standard SSR any day · **first 10× ever guarantees a standard SSR** (§A.2 note) | permanent |
| **Coin** | **25,000 coins** a pull, 250,000 for 10× | R 82% · SR 17.75% · SSR **0.25%** (standard SSRs only) | 1 standard SSR, weekly (**0.167%**) | 3 standard SRs, weekly (2.5% each) | **no pity, no points** (§A.1b) · cap **20 pulls a game week** (forward-only, like `craft:wk`) · **opens after the first 6-5 clear** | weekly picks, permanent tab |
| **Friendship** | **100 Friend Points** a pull, 1,000 for 10× | R 85% · SR 14.7% · SSR **0.3%** (standard SSRs only) | 1 standard SSR, weekly (**0.2%**) | 3 standard SRs, weekly (2.5% each) | no pity, no points (§A.1b) · wallet cap 5,000 FP | weekly picks; opens with Friend Support (§E) |

- **Standard first 10×.** Every account's first Standard 10× after the update guarantees a standard SSR: one the player does not
  own yet if there is one, otherwise any standard SSR (it becomes Essence). It **resets pity** like any SSR, so a player at pity
  85 does not get two. It is an intended one-time "welcome to banners" gift for existing and new accounts (worth about 40 pulls;
  §H one-time row). `gs:first = 1` once used.
- **Coin tab safety.** The Coin banner opens after the first 6-5 clear, when Titan Trials Hard opens and coin income rises; before
  that a 25k pull would compete with levelling. Its pull buttons show **"Coins after this pull: X · next level-up needs Y"**.
- **Why Coin and Friendship keep a tiny SSR line:** their select SSR is 2/3 **of** their 0.25% / 0.3% SSR line, so the owner's
  "select SSR + 3 SR" rule holds on every banner without adding a single SSR to the economy.

### A.3 Per-unit rates on an example day (W1 roster)

**Student Spotlight, select Iroha (i = 0):** Iroha **1.000%** · Hotaru, Kaede, Chika 0.167% each · rate-up Akane, Ruri, Raika
**3.000%** each · the other 9 SR towers 1.056% each · the 9 R towers 8.889% each.

**Guardian Spotlight, select Kanna (i = 0, before Norika ships):** Kanna **1.000%** · Hikari, Luna 0.250% each · rate-up Nami +
Umeko + Shiro **3.000%** each · the other 10 SRs 0.950% each · the 9 R towers 8.889% each.

**Standard (player picked Hotaru):** Hotaru **1.000%** · Hikari, Luna, Kaede, Chika 0.125% each · 3 weekly SR rate-ups 3.000% each ·
the other 10 SRs 0.950% each · 9 Rs 8.889% each.

**Tenka's debut:** Tenka **0.700%** · the 5 standard SSRs **0.160%** each · rate-up Miko, Umeko, Raika 3.000% each · the other 10 SRs
0.950% each · 9 Rs 8.889% each. **After the debut:** Tenka **0.500%**, standard SSRs **0.200%** each, the rest unchanged.

**Coin (week's select Kaede):** Kaede **0.167%** · the other 4 standard SSRs 0.021% each · 3 SR rate-ups 2.500% each · the other 10
SRs 1.025% each · 9 Rs 9.111% each. **Friendship:** select **0.200%** · the other 4 SSRs 0.025% each · 3 SR rate-ups 2.500% each ·
the other 10 SRs 0.720% each · 9 Rs 9.444% each.

The rates page prints this table from `ratesTable(bannerId, day)`; a test checks that every banner's ppm weights total exactly
1,000,000 and that a forced `rng.next()` of 0.9999999 still returns a unit.

### A.4 Rotation (deterministic, on the game day)

- **Banner day.** `d = bannerDay(now) = max(gameDayNumber(now + serverOffset), gb:seen)` (`src/core/reset.js:111`).
  `gb:seen` is a **forward-only** game-day high-water mark in `missions.counters`, written when the recruit screen opens and on
  each pull. A clock set back shows the latest day already seen, never an earlier window; a clock set forward holds the player on
  that day until real time catches up. `serverOffset` comes from any RPC reply that carries `serverNow` (`donation_state`,
  `support_state`, `use_support`); offline it is 0 (the device clock, as energy and missions, ENERGY A10). When online, a
  debut or spark window the server says has ended is refused.
- **Index.** `mod = (a, n) => ((a % n) + n) % n`; for a list version, `i = d − dayNumber(version.since)` (negative before it),
  and every pick uses `mod`, so days before the release day keep cycling into list[0] on the release day (built: review r1 M4).
- **Lists** live in `src/data/banners.js` as **versions** `{ since, list }`. A new version's `since` must be (a) at least
  **3 game days after** the patch-note date of the release that adds it and (b) a day on which the old version's cycle ends
  (`i_old mod n_old = 0`). Each version counts from its own `since`, so the 2-day look-ahead players were shown never changes.
  A client whose online build check reports a newer build shows **"New banners: please update"**.

  | List | Order (W1 roster; new units append in a new version) |
  |---|---|
  | Student Spotlight select | Iroha, Hotaru, Ena, Kaede, Chika (+ Sorano when she ships) |
  | Guardian Spotlight select | Kanna, Luna, Yoriko, Seiran (+ Kogane when she ships) |
  | SR towers (gacha-only first) | Akane, Ruri, Raika, Miko, Sango, Kage, Umeko, Shiro, Midori, Suzu, Noa, Yuzuha (+ Ouka, Marumi, Chigusa) |
  | SR heroes | Nami (+ Norika when she ships) |
  | LR units | Tenka (+ Kohaku & Tsubaki when they ship) |
  | Standard SSRs (Coin, Friendship, Standard picker) | Hotaru, Kaede, Chika, Luna, Hikari |

- **Picks** (m = SR tower count, w = `gameWeekNumber` index):
  - Student select `TOWER[mod(i, n)]`; Student SRs `SR[mod(3i, m)]`, `SR[mod(3i+1, m)]`, `SR[mod(3i+2, m)]`.
  - Guardian select `HERO[mod(i, h)]`; Guardian SRs `SRH[mod(i, k)]` + `SR[mod(3i+6, m)]`, `SR[mod(3i+7, m)]` (never the same as
    today's Student SRs while m ≥ 8).
  - Standard, Coin and Friendship SRs from `SR` by `w` with offsets 0 / 4 / 8; Coin select `STD[mod(w, 5)]`, Friendship select
    `STD[mod(w + 2, 5)]`.
- **Spark windows as lists grow.** While a list has 6 girls or fewer, a premium girl's spark window is her Spotlight day. When a
  list passes 6, each of its premium girls is sparkable on her day **and the 2 game days after it**, so her window never shrinks
  below 3 days in 7–9.
- **LR slot.** A debut **pin** wins: 7 game days at 0.7%. Otherwise the **LR Banner is live every day** and rotates daily among
  released LR units: `LR[mod(d − LR.since, n)]` (Tenka every day until the duo ships; then Tenka and the duo on alternate game
  days). During the duo's debut week the tab shows the duo; Tenka returns the day after. Alternative (J10): LR Weekends only.
- **Pins** (owner): `{ slot: 'tower'|'hero'|'legend', unit, start: '2026-11-06 19:00 America/Chicago', days, sr?: [a,b,c], rate?, name? }`
  in `PINS`. The start is an **instant**, converted with `gameDay()` (game-day keys are named by the date the day *ends*, so a
  key-based pin would be a day off). The rotation index keeps counting underneath, so a pin never shifts later days. Tests:
  every id exists and is the right kind and class; a script prints each pin's start and end instant; two pins in the same slot
  may not overlap; no LR unit on a Spotlight.

### A.5 What the recruit screen shows (844×390 first, 1280×720)

```
┌───────────┬───────────────────────────────────────────────────────────────┐
│ ◆ LR      │  STUDENT SPOTLIGHT · A Garden of Mirrors       ⏱ 4h 12m         │
│   Tenka   │  ┌──────────────┐   Featured SSR  IROHA  1.0%  · Premium        │
│ ● STUDENT │  │ select girl  │   Rate-up SR   [Akane] [Ruri] [Raika]  3.0%  │
│ ○ GUARDIAN│  │  cut stand   │   Next: tomorrow Hotaru · then Ena           │
│ ○ STANDARD│  └──────────────┘   Pity 37/90 ▓▓▓▓░░░░   Points 142/200 ▓▓▓░  │
│ ○ COIN    │                     [Rates] [History]   [Spark Iroha]           │
│ ○ FRIEND  │                     [ Recruit ×1  120 ]  [ Recruit ×10  1,200 ] │
└───────────┴───────────────────────────────────────────────────────────────┘
```

- **Left rail** (UI_DIRECTION left section rail): one tab per live banner with its kind colour and a countdown; icon-only on phone,
  labels on PC. Order: LR, Student, Guardian, Standard, Coin (after 6-5), Friendship (once Friend Support is live).
- **Main panel:** the select girl's `cut` stand, the banner name, "Featured SSR … 1.0% · Premium/Standard", the three SR chips,
  **"Next: tomorrow X · then Y"**, the pity bar, the recruit-points bar with a Spark button while the select girl is sparkable,
  Rates and History, and the pull buttons with the right currency.
- **LR tab:** "**LR Banner · Tenka**", Nightglass navy frame with the white-gold edge (DUO §2.5), "LR unit · no spark", the
  **Legend Promise bar "143/300"**, "Pulls here still earn recruit points for other girls", the countdown to the next LR switch.
  During a debut: "Debut · ends <day> 7 PM Central" and, in the 2-day look-ahead and the lobby notice before it, **"Coming <date>
  · save gems for her debut week"**.
- **Standard tab:** "Your pick: Hotaru · change (once a day)".
- **Coin tab:** "This week 6/20 · resets Sunday 7 PM Central" and the coins-after line. **Friendship tab:** the FP wallet and
  "Earn Friend Points when friends team up with your Support Student".
- **Rates page** (one per banner): §A.3 lines, pity, 10× rule, spark window, Legend Promise, spare rule, consolidated rate.
- **History:** each line shows the banner name; the sanitizer keeps `banner`, `spark` and `select` (today it drops them).
- **Lobby:** one carousel slide per live Spotlight and LR Banner; `RECRUIT_FEATURED` (`notice.js:23`) and `FEATURED` (`recruit.js:26`)
  read today's banners.
- Kind colours (the UI condense track sets the tokens): Student sakura pink · Guardian amber gold · LR Nightglass navy `#0e1930`
  with white-gold `#ffd27a` · Standard academy blue · Coin copper · Friendship mint.
- **Reveal of an LR unit:** the navy frame with an **unlit LR crest** and "**LR unit · Limit Break to awaken her LR form**".

### A.6 From today's single banner to banners (the five roster-wave SSRs)

Kanna, Yoriko, Seiran, Iroha and Ena ship in v0.1.39 with roster-wave into today's only banner, before Spotlights exist.

- **v0.1.39 (G0):** today's banner kicker becomes **"Sakura Academy Open Enrollment · until banners arrive"** (the word "Standard"
  goes away, so no premium girl is ever on a banner called Standard). The patch note says: "Kanna, Yoriko, Seiran, Iroha and Ena
  move to their own Spotlights when banners arrive (<date>). Until then, and for 30 days after, you can spark them any day."
- **Grace:** for **30 game days** after a save first loads G1 (`gs:g1` = that game day, forward-only), these five stay sparkable
  any day. After that they follow the premium spark window. The Mall rows show "Spotlight in N days".
- Select Tickets may still pick them (premium girls are allowed on Select Tickets).

---

## B. Standard vs premium (every unit)

Rule: **Standard** units are in the Standard banner and in every gem banner's off-rate. **Premium** SSRs appear only as a
Spotlight's select SSR. **LR units** appear only on LR Banners. **Free (stage)** girls are granted by a stage and are also in the
standard pool, so their duplicates keep feeding Potential. **Free-only** units are never in any pool: that is reserved for event
girls (EVENT_SPEC E6). The class lives in one table, `unitClass(id)` in `src/systems/banners.js` (data in `src/data/banners.js`,
not `units.js`).

| Unit | Kind · rarity | Class | Reason |
|---|---|---|---|
| Hikari | hero SSR | Standard (starter) | everyone owns her; pulls are her Potential; never featured |
| Luna | hero SSR | Standard | one of the original five SSRs; keeps a standard hero besides Hikari |
| Nami | hero SR | Standard (free 1-5) | free SR hero; Guardian Spotlight SR rate-up |
| Aoi, Rei | tower R | Standard (starters) | starters |
| Yuki | tower R | Standard (free 1-2) | free |
| Momo | tower R | Standard | all R are standard |
| Akane, Raika, Miko | tower SR | Standard | all SR are standard; gacha-only SRs lead the rate-up list |
| Sango, Kage, Umeko, Shiro, Midori, Suzu | tower SR | Standard (free) | free stage girls |
| Hotaru, Kaede, Chika | tower SSR | Standard | the original SSR towers every current player could already pull |
| Kanna, Yoriko, Seiran | hero SSR | **Premium** | new to players in the roster wave (§A.6 transition) |
| Iroha, Ena | tower SSR | **Premium** | new to players in the roster wave (§A.6 transition) |
| Fuu, Kinu | tower R | Standard | R |
| Hana | tower R | Standard (free 7-5) | free |
| Ruri | tower SR | Standard | SR |
| Noa | tower SR | Standard (free 6-2) | free |
| Azami, Wakaba | tower R | Standard (free 2-2, 6-5) | free |
| Yuzuha | tower SR | Standard (free 4-2) | free |
| **Tenka** | tower SSR | **LR unit** | the powerhouse; her own LR Banner (§F) |
| **Kohaku & Tsubaki** | duo tower SSR → UR → LR | **LR unit** | the first unit to go SSR → UR → LR (§C) |
| Ouka, Marumi, Chigusa | tower SR (planned, wave 2) | Standard | SR |
| Sorano | tower SSR (planned, wave 3) | **Premium** | new SSR |
| **Norika** | **hero** SR (planned, §D) | Standard | SR hero: the second rotating SR hero rate-up |
| **Kogane** | **hero** SSR (planned, §D) | **Premium** | new SSR hero |
| Tomoe, Hiiro | tower (future slots, no kit) | Standard if R/SR, Premium if SSR | decided when they get a kit |
| Mizuha, Sayo | hero (future slots, no kit) | same rule | same |
| Event girls | any | **Free-only** | EVENT_SPEC E6: never in a pool, a spark or a banner |

Totals after this spec: **Standard SSR 5** (2 heroes, 3 towers) · **Premium SSR 7** (4 heroes: Kanna, Yoriko, Seiran, Kogane; 3
towers: Iroha, Ena, Sorano) · **LR 2** · every R and SR standard.

- "Full Roster: own 19" (`a_units_all`) stays a free goal: the original 19 are all standard.
- "Own 30" (`a_units_30`): the W1 roster has 27 standard units, and wave 2 (Ouka, Marumi, Chigusa) makes 30. Until then the last 3
  can be any premium or LR girl, all of which free gems can pull. `achievements.test.js` pins "standard units ≥ 30" from wave 2.
- **Graduation (later):** the owner may move a premium SSR to standard (never the reverse). One line in `banners.js`.

---

## C. LR units and LR

### C.1 How "harder to pull" fits "SSR → UR → LR"

**The sentence to repeat:** you pull an **LR unit**; she starts in **SSR form** and climbs to **UR**, then **LR**.

- **Pull:** only on her own LR Banner, at 0.5% inside the 1.5% SSR rate (0.7% in her debut week), never sparked, never a Select
  Ticket, never Chosen Essence.
- **Form:** rarity data stays `SSR`, so `UNIT_RARITIES` and `tests/ui/ur-rarity.test.js` keep R/SR/SSR. Every rarity-keyed rule that
  must exclude her calls `unitClass` instead (§I.1 G0 lists them).
- **Climb:** ★5 makes her **UR**, exactly like every SSR; the **Limit Break** stage makes her **LR**. LR is display rank 4, as UR is 3.
- **Legend Promise.** `gl:<unit>` counts **pulls made on that unit's LR Banners**; it resets when the player receives her, from
  any source. The **300th** counted pull is her. It never carries over to another LR unit. On the tab it is the "Legend
  Promise", never a spark.

| Measured (`mc2.mjs`, 200k players) | Featured premium SSR (1.0%, spark 200) | LR unit (0.5% carved, Promise 300) | LR unit, no Promise |
|---|---|---|---|
| Median pulls to her | 70 | **105** | 105 |
| Mean | 72 | **133** | 149 |
| 90th percentile | 150 | 300 | 322 |
| Worst case | 200 (spark) | **300** (Promise) | 1% need ≈ 630 |
| Within 77 / 154 / 231 pulls | 54% / 91% / 100% | **32% / 64% / 80%** | 32% / 64% / 80% |

So an LR unit costs about **1.8×** a featured SSR on average and **1.5×** at worst. Stricter knob: LR 0.4% (median 133, within
77 / 154 / 231 = 27% / 55% / 72%).

### C.2 Limit Break (owner, Oct 20: "max out the unit, and awaken it, then you can limit break … a special stage")

The route is DUO_LR_DESIGN **§5** (the owner's own words; the §2.3 bond story becomes optional scenes):

1. **Max out:** level **60 with all 5 breakthrough gates** (one copy reaches it; levels past 60 need duplicates). J6 offers 85.
2. **Awaken to ★5** = UR (today's costs: 190 Star Fragments, crowns, 770k coins).
3. **Limit Break button** on her page (only at UR + L60 gate 5): **450,000 coins + 6 legendary + 3 Zenith of her family + 1
   Rainbow Crown** (the size of gate 9; about 0.4 Rainbow Crowns a week for a free player at Nightmare). Paid once; opens her trial.
4. **The trial:** solo, **no Support Student**, she must be placed from the player's **own loadout entry**, free retries, no energy,
   a short scene before and after. First clear = **LR**, plus a one-time **300 gems + 1 Recruit Ticket**.

| | Kohaku & Tsubaki · **Prism Battery** (role `battery`, ember) | Tenka (role `powerhouse`, cog) |
|---|---|---|
| Trial stage | **"Starfall Trial"**: one hard map built for the duo, mixed ground and flying waves | **"Thesis Defense"**: armoured elites and two bosses ("prove the theory") |
| Stand-in until the map exists | clear **8-5 on Nightmare** with the duo placed from the player's own entry, solo, **credited only when the run record has no `support` entry** | same rule with Tenka |
| LR ability form | **Prismfall · Twin Star**: a white-gold finishing shell (DUO §1.4) | **Critical Mass · Event Horizon**: the blast collapses into a 1.5 s gravity pull and detonates again for 50% |
| LR crest | twin stars | an orbit ring around a spark |
| Bond story (optional, scenes only) | **"Starfall Promise"**: DUO §2.3 steps 1–4 as flavour missions + scenes; a profile title | "Lab Notes": 4 short missions + scenes |
| Until the trial ships | — | (shipped on the stand-in: her page shows the Limit Break panel; "LR form coming" stays for a future LR unit without a trial) |

Rewards: the LR state, the 300 gems + 1 ticket (one-time per LR unit, §H one-time row), scenes, a profile title and the Nightglass
avatar frame.

### C.3 The stat boosts ("lr should give a bigger stat boost! Awakening to ur should as well!!")

Today ★5 adds +5% damage inside the additive level term, worth **×1.021** at L60 gate 5 over ★4; the UR look adds nothing. The
duo's LR added only Twin Star (≤ +4%).

| Boost | Who | Effect (multiplies on top) | DPS | Sized against |
|---|---|---|---|---|
| **UR Resonance** | every SSR at ★5, heroes and LR units included | **along her own Potential axis** (POTENTIAL v3): attackers and drone or trap girls damage **×1.10** and attack speed **×1.04** (whole-girl, so Chika's drones and Suzu's traps get it); an aura row's bonus **×1.10** (a +20% aura becomes +22%) plus her own shots ×1.04; a coins row's coins ×1.10 | **×1.144** | ★4→★5 becomes a **×1.168** step (★5's own ×1.021 included), about **1.4 full SSR Potential steps**; needs **no duplicates**, so free players get it as early as spenders |
| **Limit Break (LR)** | LR units after their trial | damage **×1.15**, attack speed **×1.05** on the same axis, plus the LR form (≤ +4%) | **×1.208** (×1.25 with the form) | UR + LR on one copy is ×1.38–1.43, about a **P4 SSR** (P1→P4 = 1.10·1.12·1.15 = ×1.417) |

- **Spender gap stays where Ascension put it:** Potential v3's SSR steps multiply to ×2.28 for P1→P6, and L60→L85 is ×1.283, so a
  P6 L85 copy leads a one-copy L60 copy by **×2.93**, with or without UR and LR (both sides get them).
- **Where it lives:** two factors in `unitBattleStats` (`src/systems/progression.js`, not co-op hashed). Stats travel in the loadout,
  so co-op needs no change. **Co-op caps:** `statLimits.js` documents the honest maximum as damageMul 7.57 (UR gear, L85); UR makes
  8.33 (under the cap of 10), UR + LR 9.58 (4% headroom). G6 (which changes `statLimits.js` anyway) raises the cap to **15**, and
  `coopStatLimits.test.js`' `maxedProfile` gains ★5 SSRs and an LR unit so the "honest loadout is the identity" test fails before
  any honest stat is clamped.
- **Start time:** the factors switch on at the **first weekly reset** after their release (`RESONANCE_FROM` game week), so a Titan
  board week is never split.
- **Bench gates before ship, one combined pass** with UR, LR **and the Workbench outputs (§G)**: Potential B5 (±10% of the
  reference), GEAR_AWAKEN R22 (UR_LATE never beats the Eclipse Wyrm), ASCENSION K2 (P3's month-6 board inside 195–209), Titan tiers
  (Whale A still needs UR gear for Mayhem +1). **Knob order** if a gate fails: (1) Workbench caps, (2) UR ×1.06 / ×1.02, (3) LR
  ×1.10 / ×1.03. Campaign levels are never tuned on UR or LR stats.

### C.4 How it shows

| Where | UR (live look + new line) | LR (new) |
|---|---|---|
| Card frame | rainbow ring + "UR" (unchanged) | Nightglass navy frame, white-gold inner line, comet light on big frames only, the unit's crest, "LR" sticker (DUO §2.5) |
| Her page, Info tab | new row **"UR Resonance · +10% damage · +4% attack speed"** (or "+10% aura" / "+10% coins") | **"Limit Break · +15% damage · +5% attack speed"** + her LR form; before LR a checklist chip "L60 ✓ · ★5 ✓ · fee · Starfall Trial" |
| Awakening panel at ★4 | preview "★5 → UR: +5% damage and UR Resonance" | — |
| Recruit reveal | — | navy frame, unlit LR crest, "LR unit · Limit Break to awaken her LR form" |
| Power number | rises by the boost (`unitPower` reads the same stats) | same |
| Profile showcase / support card | rainbow ring (from `aw` 5) | **`aw: 6` means LR**. The SQL already allows `aw` 0–9; older viewers clamp `aw` to MAX_AWAKEN 5 (`profileCard.js:184`) and show UR. **No new card key**, so no profile publish is ever refused |

### C.5 The duo's debut banner

"**Kohaku & Tsubaki · Starfall Premiere**": 7 game days at 0.7% (carved), rate-ups **Akane, Sango, Shiro** (ember and flyer-minded
girls; the owner may change them), Promise `gl:kohaku_tsubaki`, launched with G6. Then the duo joins the daily LR rotation.

---

## D. New heroes

### D.1 Who and why

Candidates: the 11 not-yet-shipped units (GAPS §5, roster spec §7), excluding the 9 returning girls and the 4 wave-1 girls.

| Unit | Becomes | Why |
|---|---|---|
| **Kogane** | **SSR hero**, "Facilities Crew Chief" (premium) | Her mech's Move already **is** the hero Move (GAPS §5.12, P-12), so no `moveTower` or `tmv` is needed; Clear the Road reuses the `runner` ult. As a tower she was P3 ("cut her first"); as a hero she is cheaper and fits better |
| **Norika** | **SR hero**, "Traffic Safety Officer" (standard) | A crossing-guard officer is naturally an adult. One copy per player caps her barricades (survey F5), a hero's Move lets the player re-site her line, and her STOP-paddle wave earns damage XP (F6) |
| Marumi | stays SR tower | your Oct 14 P1 tower answer: "bombs that roll up the road"; as a hero most battles would not have her |
| Chigusa | stays SR tower | your Oct 14 P1 nature caster |
| Sorano | stays SSR tower (premium) | your Oct 14 P1 tracking firebird that hunts the whole map; as a hero it would shrink to a short leash |
| Ouka | stays SR tower | no attack (heroes level from damage XP), and her office radius works by being placed among girls |
| **Tenka** | stays SSR tower (LR) | your 70% sell refund and the powerhouse price band need a sellable, coin-priced tower; heroes deploy free and cannot be sold (`canSell` returns `'hero'`) |
| Kohaku & Tsubaki | stays tower (LR) | approved design: two girls on one base, one slot |
| Tomoe, Hiiro | tower slots | no kit yet |
| Mizuha, Sayo | hero slots already | no kit yet; they stay planned heroes |

Together: **8 heroes** (SSR 6: Hikari, Luna, Kanna, Yoriko, Seiran, Kogane; SR 2: Nami, Norika). Guardian Spotlights rotate one SR
hero (Nami, Norika) plus two SR towers.

**Adults.** Every hero is an adult by rule and test (`units.test.js:363-365`). Kogane and Norika keep their names, colours and props
and are re-cast as **academy staff** in work uniforms (wholesome). J8 offers the old four-hero picks; their kits are kept in
Appendix M.

### D.2 How hero banners work with free in-battle levels

A hero copy sells **her unlock** (one more hero to bring; she deploys free and climbs 1–25 in every battle at the same pace for a
free player and a spender) and, through duplicates, **her Potential** (kit steps from P2, capstone at P6) and **gates past 60**,
which multiply on top of the battle track. A banner **never sells battle levels**. A player fields one hero, so a hero copy is
narrower than a tower copy but is in every battle; Guardian Spotlights therefore use the same rates, pity and spark as Student
Spotlights.

### D.3 Kogane · Facilities Crew Chief (SSR hero, premium)

- **UnitDef:** `kind 'hero'`, `adult: true`, role **`pilot`** (Mech Pilot), pierce, land, family **blade**, `GACHA_ONLY`. Base:
  projectile, damage **6**, rate **1.1**, range **2.8**, projectile speed 16, ignores 1 armour, ground only.
- **Look:** short messy brown hair, a hard hat with a sakura sticker and goggles, safety-yellow work jacket with reflective tape
  over a navy staff polo, cargo work trousers, steel-toe boots. She drives **Big Yellow**, a small two-legged construction walker
  with an open cockpit. Enums: short · messy · *new* `hardhat` · jumpsuit · wrench · gear.
- **Bio (game text):** "The academy's facilities crew chief. She keeps every path on campus clear, and when monsters block one, Big
  Yellow clears it too."
- **Ult (Lv 3) Clear the Road**, cd 70: `runner`, look `plow`, enters at her aim point (or the busiest path's exit end) and plows 8
  tiles back up the road in 2.5 s; each enemy touched takes 120 pierce damage and is pushed back 2 tiles (minibosses and bosses
  take the damage only). Rank 2 (Lv 10): 10 tiles, 180, push 2.5, cd ×0.85. Rank 3 (Lv 20): 12 tiles, 260, push 3, minibosses
  pushed 1.5, stun 1 s, cd ×0.85.
- **Skill (Lv 7) Pod Salvo**, `strike`, local, cd 28: the 4 strongest enemies within her range ×1.3 take 4× her hit, splash 0.4,
  ignore 3 armour. Auto: 4+ enemies or an elite. Rank 2 (Lv 17): 6 targets, 5×, cd 24.
- **Awaken passive (★3) Reinforced Frame:** +8% damage; Move recharges 3 s faster.
- **Track** (paths `drill`, `dozer`, `pods`):

| Lv | From | Bonus |
|---|---|---|
| 1 | base | rivets from Big Yellow's arm gun; ignore 1 armour |
| 2 | L2 | Warm Engine: +1 damage |
| 3 | L3 | Clear the Road unlocked; +5% attack speed |
| 4 | drill.1 | Hardened Bit: +2 damage |
| 5 | dozer.1 | Treads: Move recharges 4 s faster |
| 6 | pods.1 | Pod Mount: +1 damage; rivets reach flyers |
| 7 | L4 | Site Survey: Veil Sight |
| 8 | drill.2 | Long Drill: +0.3 range; ignores 1 more armour |
| 9 | dozer.2 | Big Blade: hits push back 0.15 tiles (not bosses) |
| 10 | pods.2 | Twin Pods: +1 rivet per shot · ult rank 2 |
| 11 | L5 | Steady Hands: +2 damage, +5% crit chance |
| 12 | drill.3 | Core Drill: ignores 2 more armour; ×1.2 vs elites |
| 13 | L6 | Extra Lap: +0.2 range, +1 damage |
| 14 | dozer.3 | Bulldozer Blade: push +0.15; 20% of hits stagger 0.3 s |
| 15 | pods.3 | Swarm Pods: splash 0.4 |
| 16 | L7 | Crew Pride: +10% damage |
| 17 | drill.4 | Rock Breaker: +10 damage; hits crack 2 armour for 4 s · skill rank 2 |
| 18 | L8 | Second Wind: +10% attack speed |
| 19 | dozer.4 | Reinforced Frame: +6 damage; ×1.25 vs barriers |
| 20 | pods.4 | Heavy Ordnance: +8 damage; splash +0.4 · ult rank 3 |
| 21 | L9 | Fine-Tuned: +3 damage |
| 22 | drill.5 | Mountain Mover: +22 damage; ×1.4 vs bosses; 25% of hits stun 0.4 s |
| 23 | dozer.5 | Demolition Day: +14 damage; push +0.2; +25% attack speed |
| 24 | pods.5 | Full Payload: +1 rivet, +12 damage, splash +0.2; 15% stun 0.3 s |
| 25 | L10 | Leave It to Big Yellow!: +15% damage |

- **Potential** (SSR slots +5/+7/+7/+8/+9%): P2 ✦ Spare Rivets (every 6th shot fires 2 more) · P3 ✦ Quick Clutch (Move downtime
  3 → 2 s) · P4 ✦ Wide Blade (Clear the Road +2 tiles) · P5 ✦ Hydraulics (ult recharges 10% faster) · P6 ✦ **Big Yellow Overdrive**
  (after each Move during a wave, +30% attack speed for 6 s).
- **New sim:** a per-hero Move cooldown key `moveCd` (`hero.js` `HERO_MOVE` use) and `pushback` on the `runner` ult (the `tide`
  helper, `hero.js:335-341`). Both are snapshot fields (§D.6).

### D.4 Norika · Traffic Safety Officer (SR hero, standard)

- **UnitDef:** `kind 'hero'`, `adult: true`, role **`blocker`** (Blockade, GAPS §5.11), blast, land, family **rime**, standard pool.
  Base attack **STOP Wave**: projectile (a paddle-swing shockwave), damage **4**, rate **0.8**, range **2.2**, splash 0.8,
  knockback 0.15 (push lock), projectile speed 10, ground only.
- **Barricade (her trait):** **1 barricade** on the road within her range, auto-placed at the road point in range nearest the exit
  (no new command). Hold budget **120**; a ground enemy that reaches it stops and drains it per second (normal 10, elite 25,
  miniboss 60, boss 200). Flyers pass over; **blinkers hop it** (their counterplay). Rebuilt 3 s after it breaks. Her barricades
  re-site when she Moves. Caps: own barricades ≤ 4, Hold the Line barricades ≤ 4 at once (GAPS §7.2 road-object caps; per player in
  co-op).
- **Look (adult re-cast):** a navy staff blazer under a reflective high-visibility safety sash, white gloves, a yellow safety cap,
  navy slacks, rain boots, a whistle on a lanyard; two low tied tails kept from her first design; a round STOP paddle and folding
  A-frame barriers. Enums: twintails · straight · cap · blazer (*new* `sash`) · shield (*new* `sign`) · ring.
- **Bio (game text):** "The academy's traffic safety officer. She walks every student across the road and blows her whistle at
  everything, pigeons included. Monsters are no exception."
- **Ult (Lv 3) Hold the Line**, cd 60, aimed: 2 temporary barricades at the aim point on the road, budget 400 each, 12 s; held
  enemies take +10% damage. Rank 2 (Lv 10): budget 700, 15 s, +15%, cd ×0.9. Rank 3 (Lv 20): 3 barricades, budget 1,200, 18 s, they
  also stop minibosses, +20%.
- **Skill (Lv 7) Whistle Stop**, `strike`, local, cd 26: the 5 lead ground enemies in her range ×1.3 stop for 1.2 s (minibosses
  0.6 s; bosses take the damage only) and take 3× her hit. Auto: 5+ enemies in range or an elite. Rank 2 (Lv 17): 8 enemies,
  1.6 s, 4×, cd 22.
- **Awaken passive (★3) Safety First:** +6% damage; barricade budget +20%.
- **Track** (paths `barrier`, `guard`, `detour`; the GAPS tower paths Heavy Barriers, Crossing Guard, Detour):

| Lv | From | Bonus |
|---|---|---|
| 1 | base | STOP waves; one barricade on the road in range |
| 2 | L2 | Morning Patrol: +1 damage |
| 3 | L3 | Hold the Line unlocked; +5% attack speed |
| 4 | barrier.1 | Sandbags: barricade budget +80 |
| 5 | guard.1 | Whistle: +0.4 range |
| 6 | detour.1 | Reflective Paint: +1 damage; waves reach flyers |
| 7 | L4 | Bright Sash: Veil Sight; held enemies are revealed |
| 8 | barrier.2 | Double Barrier: +1 barricade |
| 9 | guard.2 | Crosswalk Drill: +10% attack speed |
| 10 | detour.2 | Bounce Back: an enemy that reaches a full barricade is knocked back 0.4 tiles once (push lock) · ult rank 2 |
| 11 | L5 | Clipboard: +2 damage, +5% crit chance |
| 12 | barrier.3 | Steel Barriers: budget +300; held enemies take +15% damage |
| 13 | L6 | Extra Patrol: +0.3 range |
| 14 | guard.3 | Speed Bumps: waves slow ground enemies 25% for 1.5 s |
| 15 | detour.3 | Detour Sign: at forks, enemies her waves hit before the fork take the longer branch; on maps without forks, barricades +50% budget |
| 16 | L7 | Patrol Captain: +10% damage |
| 17 | barrier.4 | Water-filled Barriers: budget +1,000; a barricade that breaks splashes a 50% slow for 2 s · skill rank 2 |
| 18 | L8 | Second Whistle: +10% attack speed |
| 19 | guard.4 | School Zone: +1 barricade; slow 35% |
| 20 | detour.4 | Long Way Round: enemies released by a barricade are slowed 20% for 3 s; knockback +0.15 · ult rank 3 |
| 21 | L9 | Steady Hands: +3 damage |
| 22 | barrier.5 | Fortress Gate: budget +3,000; minibosses push at half rate; rebuilt in 1 s |
| 23 | guard.5 | Road Closed: +8 damage; +25% attack speed; Hold the Line +1 barricade |
| 24 | detour.5 | One-Way Street: once per wave, the first 20 enemies to reach her barricades are sent back 6 tiles (minibosses 2, bosses 0) |
| 25 | L10 | Officer of the Year: +15% damage |

- **Potential** (SR slots): P2 ✦ Sturdy Cones (barricade budget +25%) · P3 ✦ Quick Rebuild (rebuilt 1 s faster) · P4 ✦ Longer Line
  (Hold the Line +4 s) · P5 ✦ Loud Whistle (Whistle Stop +2 enemies) · P6 ✦ **Safety Week** (+1 barricade; held enemies take +10%
  more damage).
- **New sim:** blockers in the enemy step (GAPS P-11), shared stretches (P-17) so a barricade on a shared road holds every path
  through it, the detour switch (equal shared prefix only, tested per map), aimed temporary barricades. Rule-5 counters come
  early (flyers Lv 6, Veil Sight Lv 7).

### D.5 Art, data and waves

- **Art (each):** 6 portrait crops (`<id>-full/card/bust/thumb/cut/cut-s.webp`) of the adult staff design; a battle model (Blender
  stand-in first, then the GLB pipeline); attack FX; ult FX (`plow` runner look; barricade and STOP-sign props); a skill icon; a
  Spotlight `cut` stand for Kogane. Biggest single item: **Big Yellow** (one GLB). Unique hair hex and hairStyle|accessory pair
  each; the GAPS §4.3 originality check before any art.
- **Data:** UnitDef (`adult: true`, cost 0, `paths: []`, `hero`), `HERO_TRACKS` entry (checked with `tools/heroTrack.mjs`), skill row in
  `abilities.js` + `abilityText.js`, Potential row + text, `ROLES` keys `pilot` and `blocker` with wiki subclass and icon, wiki text.
- **Waves:** wave 2 stays as planned (Ouka, Chigusa, Marumi as towers, the `new-girls-w1` session's next step unchanged); Norika
  (hero) with Sorano (tower) in wave 3; Kogane (hero) in wave 4.
- **Reach:** Kogane only on Guardian Spotlights (premium, sparkable in her window). Norika is in every standard pool and
  alternates with Nami as the Guardian SR rate-up.

### D.6 Hero sim state and determinism

- New per-battle fields are **snapshot** fields and listed in `KNOWN_SIM_KEYS` (`snapshot.js:105`): Kogane's `moveCd`; Norika's
  barricade spots and budgets, Hold the Line timers and the One-Way Street per-wave count. A Continue test (Quit → `migrateProfile`
  → Continue) checks each.
- In co-op each player brings a hero; road-object caps are per player. (If J8 picks the alternative, Chigusa's 10-life cap is per **battle**, not per hero, so two Chigusas in co-op still give at most 10.)
- Each hero wave adds co-op engines scenarios (Norika blockers on a forked map; Kogane plow pushback) and re-pins the goldens.

---

## E. Friend Support and Friend Points

### E.1 The rules

- **Lend:** each Sensei lends **1 Support Student** (any owned tower; default the first tower in the showcase). Setting: "Lend my
  Support Student to: Friends (default) · Nobody". Heroes are not lent.
- **Borrow:** stage prep gets a **Support** slot listing friends' Support Students (online first, "FP paid today" marked). The
  Support Student is an **extra card** beside the 8; if 10 cards do not fit the tower bar at 844×390, the student takes one of
  the 8 instead (UNVERIFIED, test at build). A student the borrower already brings is greyed out.
- **Where (v1):** campaign, Bounty and solo Freeplay. **Not:** Titan Trials, Total Assault, the clan boss, Sandbox, the tutorial,
  fixed-baseline modes, Limit Break trials and the 8-5 stand-in credit, PvP, and **co-op in v1**.
- **What a support run may change** (`record.support` set):

  | Pays / counts | Never |
  |---|---|
  | the run's drops, kills and mission ticks; FP (E.2); a **first clear on Easy or Normal** (opens the next stage and pays that difficulty's one-time first-clear reward, as a solo clear would) | a **Hard or Nightmare medal** (they open sweeps, `rewards.js` `canSweep`, and 8-5 opens the Nightmare Titan tier), ribbons, achievements, trophies, Freeplay bests and milestones, board posts, LR trial or stand-in credit, `tbest` / `tfc` (Titan Trials are excluded anyway) |

- **Clamp (borrower side):** the borrowed girl is built at most at the borrower's own range: **level ≤ the borrower's highest girl
  + 10** (gates follow that level), **Potential ≤ P3**, **★ ≤ the borrower's highest ★** (UR Resonance only if the borrower has a UR
  girl), **no LR form** (`aw` 6 read as 5 until #189), gear through the profile viewer's clamps. A forged max card therefore lends
  roughly "a friend about your level".
- **Battle record:** `record.support = { unitId, owner, key, card }` at the **record** level (`cleanRecord` keeps unknown top-level
  fields through `...rest`; `battleSave.cleanEntry` keeps only `{unitId, stats}` per entry, so a per-entry marker would be lost).
  The battle UI looks her up with `profileFor(unitId)` from the record, so level and frame survive Continue.
- **Co-op later** (J9): the borrower's 6th loadout slot when the player brings a hero, appended in `src/ui/screens/coop.js` (not
  hashed); `clampPlayer` already allows 6 entries.

### E.2 Friend Points (FP; code prefix `frp:` because `fp` is Freeplay)

| | Amount | Cap |
|---|---|---|
| Borrower, per paying borrow | **+10 FP** | **5 paying borrows a game day (50 FP)** |
| Lender, per friend who borrows their student | **+10 FP** (collected with a tap, server ledger) | **100 FP a game day** |
| Pair rule | one paying use per (borrower, lender) pair per game day | — |
| When it pays | when the run **reaches wave 3** (or wins a shorter stage): `use_support` reserves the pair at battle start, `settle_support(key)` pays 10 + 10; unsettled reservations are voided at the next game day | — |
| Wallet | client-side, clamp 0–5,000 | 5,000 FP |
| Use | **Friendship banner only** (100 FP a pull, 1,000 for 10×) | — |

A use beyond a cap is allowed and pays 0, so nobody is blocked from playing. Every paying use pays both sides equally, so across
the network lender FP equals borrower FP: a **typical** player earns about **40–70 FP a day ≈ 3–5 Friendship pulls a week**; the
cap is 150 FP a day (10.5 pulls a week).

### E.3 Friendship banner pool

R 85% (all R) · SR 14.7% (all standard SR, 3 weekly rate-ups at 2.5%) · SSR **0.3%** (the 5 standard SSRs; weekly select 0.2%); no
pity, no points, no premium or LR units, SR guaranteed in a 10×, spares pay coins only (§A.1b). At 4 pulls a week that is
≈ 0.012 SSR a week against 0.39 from gems: friends help, but they are never required.

### E.4 Anti-abuse and the trust boundary

- Friendship at least **24 h** old (`friends.since`), both accounts at least **7 days** old, no block either way (a block reads as
  "That Support Student isn't available"), no FP for 7 days after leaving the dev clan (the donation rule), the 50-friend cap.
- Caps on the server's game day (`game_day_key`, 7 PM Central). One owner of N alt accounts still earns at most 100 FP a day as
  lender and 50 as borrower (≈ 10.5 Friendship pulls a week, ≈ 0.03 SSR a week, and no points or Moonpearls through spares).
- **What the server enforces:** lender credits, the pair rule and the daily caps. **What stays client-side** until #189 (like gems):
  the FP wallet and the Friendship pulls. `support_cards` is self-reported battle input, clamped by E.1 on the borrower's side; the
  profile SQL's "nothing may read the card" promise stays true because support reads its own table.
- FP never buys gems, tickets, Essence or premium pulls.

### E.5 SQL (one new migration; the owner pastes it)

- **Order guard:** the migration refuses to run unless `profile_gear` (`20261020000000_profile_gear.sql`) and `titan_board` are
  applied.
- **Tables** (RLS on, no grants, functions only):
  `support_cards(user_id pk, unit jsonb, unit_hash, lend 'friends'|'nobody', updated_at)`;
  `support_uses(id, borrower_id, owner_id, unit, game_day, borrower_key, paid boolean, settled_at, owner_points, borrower_points, claim_key, claimed_at, created_at)`
  with `unique(borrower_id, borrower_key)` (idempotency) and a **partial** `unique(borrower_id, owner_id, game_day) WHERE paid`, so
  a second same-pair use the same day is recorded unpaid instead of failing; indexes on `(created_at)` and `(owner_id, claimed_at)`;
  `support_claims(user_id, key, total, at, primary key(user_id, key))`.
- **Shared validator:** `valid_card_unit(jsonb)` is built from the **`profile_gear.sql`** version of `valid_profile_card` (which has the
  gear club key `c`), and both `valid_profile_card` and `set_support` call it. **No new key** (LR is `aw: 6`). A PGlite regression
  test runs a fixed set of cards (UR gear, club `c`, 8 units, the reject cases) through the old and the new function and expects
  the same answers.
- **RPCs** (SECURITY DEFINER, `auth.uid()`): `support_version`, `set_support`, `my_support`, `support_candidates`,
  `use_support(owner, unit, key, p_day)` (takes the borrower lock, then `select … from support_cards where user_id = p_owner for
  update` so the lender's cap is serialised per lender; refuses `'stale_day'` when `p_day` is not today; returns `serverNow`),
  `settle_support(key)`, `support_state`, `claim_support_points(key, p_room)` (stamps only rows that fit `p_room` = 5,000 − wallet; a
  replay returns the stored `support_claims.total`; a key older than 24 h is refused `'stale_key'`), `support_summary` (hub badge).
- **Rate rules** in `src/online/limits.js` matching the SQL (`support_set`, `support_list`, `support_use`). Housekeeping: bounded
  deletes (`limit 500`) of unclaimed rows after 7 days and claimed rows after 30. The FP tab says "Uncollected FP expires after 7
  days".
- **Client:** `backend.supportStatus()`, adapters (supabase + local mocks), a `supportLedger` reusing `donateLedger`'s `beginClaim →
  server → applyClaim`, profile sync step 4 (publish the Support Student when its hash changes). Candidates are **cached 5 minutes**
  per session with a manual refresh. A failed `use_support` (offline, `rate_limited`, `needs_update`, a stale card) **never blocks
  the battle**: it starts without FP and retries the same key only while the game day is unchanged.

---

## F. Tenka's launch banner

| | Default |
|---|---|
| Class | **LR unit from launch** (`unitClass('tenka') = 'legend'` in `banners.js`; her committed UnitDef is not edited): never sparked, never a Select Ticket or Chosen Essence, not on Standard or any Spotlight |
| Form at launch | **SSR form**, UR at ★5 (gets UR Resonance). Her page shows **"LR form coming"** until "Thesis Defense" ships after the duo's Limit Break |
| Banner | **"Tenka · Physics Club Premiere"**, 7 game days from a **literal start instant** in `PINS`, set when her release is cut and at least 3 game days after that release ships |
| Rates | Tenka **0.7%** + standard SSRs **0.8%** (inside the 1.5%) · SR 18.5% with rate-ups **Miko, Umeko, Raika** (3.0% each; aura girls that suit her) · R 80% |
| Guarantees | shared 90 pity (a pity pull is her 47% of the time in the debut, 33% after); **Legend Promise 300**, counted on her LR Banners |
| Points | +1 per pull, usable to spark other girls |
| After launch | the daily LR tab at 0.5% (alternating days with the duo once it ships) |
| Notice | the release before hers pre-announces **"Tenka is coming · save gems for her debut week"**, at least 7 days ahead; the lobby notice and the 2-day look-ahead repeat it |
| In battle | sells for **70%** of her own coins; base 1,800 with the **powerhouse price band** exception |
| Ships with | **G2-min** (§I.1), not G1. The `legend` filter itself already ships in G0, so she can never leak into the plain pool, spark or Select Ticket even if G1 is late |

**Odds for a free player** (`mc2.mjs`, 19.2 pulls a week; debut pulls at 0.7%, the rest at 0.5%):

| Gems saved before her debut | By the end of month 1 | By the end of month 2 | Median pulls |
|---|---|---|---|
| none (19 debut pulls) | **35%** | **66%** | 99 |
| 40 pulls (~2 weeks of income) | **60%** | **77%** | 90 |
| 80 pulls (~4 weeks) | **75%** | **86%** | 90 |
| all pulls at 0.7% (reference) | 42% (77 pulls) | 78% (154) | 90 (mean 102) |

Why LR from launch rather than "SSR now, LR later": LR units are unsparkable. If she launched sparkable and became LR later,
players would lose a route they had and early sparkers would have skipped the rule. The rule can only move toward generous later
(J5).

---

## G. The timed Workbench ("Keep it timed")

**Default reading:** a **new** timed Workbench, the "club lab" hub UI_DIRECTION already names, **next to** the instant Craft Room. The
Craft Room keeps family-material combine and swap exactly as approved (ASCENSION §B.6). The hub has two sections on its left rail:
**Workbench (timed)** and **Craft Room (instant)**; the Backpack item-sheet entry stays.

| Id | Recipe (inputs: any one family, chosen per craft) | Output | Timer | Weekly cap | Matching shop cap |
|---|---|---|---|---|---|
| 1 | 6 common + 2 rare + 4,000 coins | 2 Fortune Dice | 1 h | **3 crafts (6 dice)** | Gem Shop 6 dice a week (3 for 120 gems, 2 a week) |
| 2 | 10 common + 2 rare + 6,000 coins | 3 Academy Textbooks (6,000 EXP) | 4 h | 7 | Mall rare books 6,000 coins for 2, 3 a day |
| 3 | 6 rare + 2 SR + 8,000 coins | 1 Sage's Codex (8,000 EXP) | 8 h | 4 | — |
| 4 | 4 rare + 2 SR + 10,000 coins | 1 Lock Pin | 4 h | **2** | Gem Shop 2 a week |
| 5 | 3 SR + 1 mythic + 15,000 coins | 1 Ornate Gear Box (SR box) | 4 h | **2** | Gem Shop 2 a week |
| 6 | 2 mythic + 1 legendary + 40,000 coins | 1 Radiant Gear Box (mythic box) | 8 h | 1 | Bounty 1 a week |
| 7 | 2 legendary + 1 Zenith + 60,000 coins | 1 Prism Dice | 12 h | **1 every other game week** (`everyOtherWeek`, as `ts_kindred_shard`) | Boss Exchange 1 a week |
| — | event recipes (later) | event items | 1–12 h | per event | — |

- **Throughput is set by the caps**, not the timers (about 93 slot-hours of craftable work a week at these caps, against 336 with 2 slots).
  "Timed" is the feel the owner asked for: start, leave, come back. The caps are the **first knob** if a §C.3 gate fails.
- **Slots:** 2, a 3rd after the first clear of 6-5. One craft per slot. **Cancel** refunds everything before it finishes. **Collect**
  with a tap.
- **Speed-ups: none in v1.** Nothing to buy with gems; the free player is the full player.
- **Never crafts** gems, tickets, Essence, crowns, Zenith, Rainbow Seeds or Starlight Needles. It is a sink for the surplus family
  materials Titan Trials pile up (ASCENSION §E.2: ≈ 130 legendary / 354 mythic banked by week 24).
- **Timers:** device clock (ENERGY A10); a clock rolled back more than 10 minutes re-anchors every running slot (time left kept),
  so a rollback can only delay; weekly caps on `gameWeekNumber`, forward-only like `craft:wk`.
- **Ready:** a lobby dot, a countdown chip per slot ("2h 14m"), and an in-tab toast outside battles. No push notifications.
- **Save:** `missions.counters` prefix `wb:` (`wb:<slot>:r` = **stable recipe id**, `wb:<slot>:n/s/e`, `wb:seen`, `wb:wk`,
  `wb:cap:<id>`); recipes in a new `src/data/workbench.js` with **append-only numeric ids** and a test that pins id → output. A slot
  whose id this build does not know shows "Update to collect" and is never cleared. `wb:seen` is written only on Workbench actions
  (open, start, collect), at most once a minute. No server, no co-op file.

---

## H. Economy check (free player)

| Per 28 days | Before (today, one pool) | After (this spec) |
|---|---|---|
| Gem + ticket pulls | 76.7 | **76.7** (no new gem or ticket source) |
| Coin-banner pulls | — | 0 before 6-5 … **80** late (cap 20 a week, 500k coins) |
| Friendship pulls | — | ≈ 12–20 typical, ≤ 42 at caps |
| SSR-class results | 1.55 | **1.55 gem** (2.02% on every gem banner, LR Banners included) + 0–0.20 coin + 0.04–0.06 friend = **1.59–1.81** (the extras are standard SSRs only) |
| A **chosen featured SSR** | no rate-up: 20.8% a month in a 5-SSR pool, **11.0%** in the 10-SSR pool after the merges | **54%** in one month, 91% in two, **certain by 200 pulls (2.6 months)** with the spark |
| A chosen standard SSR | as above | the same **54% / 91%** on Standard with her picked; spark any day |
| An **LR unit** | — | **32% / 64% / 80%** in 1 / 2 / 3 months; certain by **300 pulls (3.9 months)**. Tenka, nothing saved: 35% / 66% |
| Spark pace | early every ≈ 10.4 weeks (19.2 points a week); late ≈ 7.7 weeks (≈ 25.9 with gem spares) | **the same**: coin and FP pulls add no points, Mementos or Moonpearls, even through spares |
| One-time | new account ≈ 393 pulls ≈ 7.9 SSRs, ≈ 2 sparks | the same + the Standard first-10× SSR (≈ 40 pulls' worth, once) + 300 gems and 1 ticket per Limit Break trial |

**Patch-note gifts** (100 gems per version, not in the rows above):

| Releases a week | 0 | 1 | 3 | 10 | 18 (Oct 7–20 pace) |
|---|---|---|---|---|---|
| Gem + ticket pulls per 28 days | 76.7 | 80.0 | 86.7 | 110.0 | 136.7 |

Every odds row above is therefore a **floor**; at the current release pace a free player gets roughly 1.8× the pulls. No cap is
proposed (the owner's existing gift stays as it is).

**Expected time to LR** (active free player at Nightmare titans): the pulls (median 105 = 5.5 weeks of income, or at once from a
bank) + about **3–4 weeks** of resources (1.62M coins for 1 → 60 + gates + ★5, 190 Star Fragments, the ★4/★5 crowns, then the Limit
Break fee incl. 1 Rainbow Crown at ≈ 0.4 a week) ≈ **2.3 months**; worst case ≈ **4.5 months**. LR is late-game by design.

**Why free players stay viable:**
1. Gem income is unchanged, the SSR-class rate is unchanged on every banner, and **banners make a chosen girl about 5× more
   reachable** than the post-merge single pool.
2. Every premium SSR has a spark window every 5–6 days (3-day windows once a list passes 6), and the 30-day grace covers the five
   roster-wave SSRs, so nobody's saved points are lost.
3. LR units are bounded by the Promise, and their pulls still build sparks for other girls.
4. UR Resonance needs no duplicates; LR needs one copy.
5. **Coins and FP never become gem-tier pulls** (§A.1b): their SSR line is 0.25% / 0.3% (standard only, capped), and their results
   never touch pity, recruit points, Mementos or Moonpearls, so they cannot speed a spark, a Moonpearl 10× ticket or a Chosen Essence.
6. No campaign stage needs a premium or LR unit; levels are never tuned on UR or LR stats.
7. The "certain by 200 pulls" line assumes recruit points are saved for the spark; points spent on `rp_fragment` (30 points → 10
   Star Fragments, 3 a week), which ★5 now makes more tempting, push the spark later.

`f2pIncomeSummary()` gains `coinPulls`, `friendPulls` and their spare coin yields; the pinned 70–80 gem-pull test stays.

---

## I. Build plan

### I.1 Milestones

| # | Scope | Release | Co-op id | Size |
|---|---|---|---|---|
| **G0 class table + transition** | `src/data/banners.js` class table + `unitClass(id)` in `src/systems/banners.js` (`standard`/`premium`/`legend`/`event`; ids not yet in `UNITS` allowed through a `PLANNED` list); system-level LR filters in `spark()`, `redeemSelectTicket()`, the shop purchase path, the Mall spark rows (`shop.js:57`), the Select picker (`selectTicket.js:45`), the spark dialog (`recruit.js:81`), Chosen and Kindred eligibility, the backpack line (`backpack.js:111`) and the UR counts (`achievementMetrics.js:156`, `profileTrophies.js:70`); a scan test that fails on `POOL.SSR` or `rarity === 'SSR'` outside an allowlist; banner relabel "Open Enrollment" + the five's patch note (§A.6); **Beta letter fix** (below); register counter prefixes `gl:`, `gs:`, `gb:`, `gc:`, `frp:`, `wb:`, `lr:`, `lbt:`; history sanitizer keeps `banner`/`spark`/`select`; stale lines (lesson "Star Fragments", wiki "every girl is in the pool") | **v0.1.39** (rides next-wave + roster-wave) | no | S |
| **G2-min Tenka's banner** | a two-tab recruit (Open Enrollment + LR Banner); the LR kind, ppm weights and carved rates, `gl:tenka`, the debut pin as a start instant, the daily LR tab after the debut, the navy tab and rates page, `gb:seen` + `serverOffset`, history `banner` | **Tenka's release** (planned v0.1.40; whenever her own gates pass) | rides Tenka's own bump | S–M |
| **G1 banners** | lists with versions, pins, `rotation(now)`, `activeBanners`, `bannerPool`, `ratesTable`, `canSpark` (windows, grace `gs:g1`); `gacha.js` (`bannerId`, `'rotated'`, featured split, SR rate-ups, shared pity, Standard pick + first 10×); full recruit screen (rail, key art, countdown, look-ahead, rates, history); Mall "Spotlight in N days"; Chosen Essence by day; lobby carousel; wiki | v0.1.40 or later; it never blocks a girl | no | L |
| **G3 UR Resonance** | the factors in `unitBattleStats` (own-axis), Info / awakening / Power lines, the combined bench pass | its release; active from the next weekly reset | no | S + bench |
| **G4 Coin banner + Workbench** | `rollFixed`, coin pulls with the cap and 6-5 unlock, spare coin table; Workbench data, system, hub, lobby dot | v0.1.40 or v0.1.41 | no | M |
| **G5 Friend Support** | migration + adapters + ledger + stage-prep Support slot + clamp + `record.support` + progress rules + Friendship banner + FP wallet | v0.1.41 (owner pastes SQL) | no (solo) | L |
| **G6 LR** | `units[id].lr` + mirror, Limit Break button and fee, Starfall Trial (8-5 Nightmare stand-in, own entry, no support), first-clear reward, `lr.css`, Twin Star, LR boost, card `aw: 6`, `statLimits` damageMul 15, duo debut "Starfall Premiere"; then Thesis Defense + Event Horizon for Tenka | the duo release (after roster B3 and Tenka) | yes (duo + LR forms + statLimits) | L |
| **G7 heroes** | Norika (wave 3), Kogane (wave 4): data, tracks, skills, Potential, blockers / shared stretches / detour, `moveCd`, runner pushback, snapshot keys, art | each wave's release | yes (each wave) | M each |

**Beta letter fix (G0).** `deliverMail` copied "choose ANY SSR student you like" into every opened account's
`profile.mail.letters`, and `items.js:237` says "Choose ANY SSR". G0 rewrites the stored body of the letter with id
`beta-thanks-2026` on load (in `cleanMail`, once, with a counter mark) and the `ticket_ssr_select` description, adding the friendly
line **"LR units arrive only through their LR Banners."**, plus a patch-note line. Test: an old save with the letter shows the new
text after `migrateProfile`. (J13 offers honouring the old wording instead.)

### I.2 What changes the co-op sim id

- **Never** (a test checks that these are absent from `simId().files`, and CI runs `node tools/simId.mjs` before and after):
  `src/data/banners.js`, `src/systems/banners.js`, `gacha.js`, `recruit.js`, `shop.js`, `items.js`, `save.js`, `missions.js`,
  `progression.js` (both boosts), `workbench.js`, Friend Support in solo, coin and FP pulls, all SQL. `banners.js` is never imported
  by `src/sim/**` or the co-op files. Gacha classes never go into `units.js`.
- **Yes, inside their own releases:** Tenka's and the duo's UnitDefs (their own bumps), the LR ability forms and the `statLimits.js`
  cap, Kogane and Norika (UnitDefs, roles in `types.js`, tracks, skills, the sim keys). The coordinator bumps `COOP_PROTOCOL` once
  per ship.
- UR/LR boosts change battle **values** in co-op (they travel in the loadout) but not the id: each player brings their own stats.

### I.3 Saves (additive, no `SAVE_VERSION` bump)

`profile.gacha.pity`, `totalPulls`, `recruitPoints` unchanged. New numbers live in `missions.counters`, which older builds keep word
for word: `gl:<unit>` (Legend Promise), `gs:first` (Standard first 10× used), `gs:pick` / `gs:pickDay` (Standard select), `gs:g1`
(grace start), `gb:seen` (banner day high-water mark), `gc:wk` / `gc:n` (coin week and count), `frp:bal` (FP wallet), `lr:<unit>`
(LR mirror of `units[id].lr`), `lbt:<unit>` (Limit Break fee paid / trial cleared), `wb:*`. The battle record gains `support`. An
older tab still sees one pool (client-side gacha until #189), never touches the counters and cannot take LR away.

### I.4 Tests

- `tests/systems/banners.test.js`: rotation vectors across DST (ROSTER_SPEC 7.6 dates and the Nov 1 change); `now < EPOCH` (no
  negative index); list versions (`since` rules, the look-ahead never changes after a version ships); pins (start instants,
  no overlap); pools (Standard has no premium or LR unit; Student banners no heroes; Hikari never featured); ppm totals exactly
  1,000,000 and a forced 0.9999999 roll; featured ≈ 2/3 of SSRs and LR ≈ 0.68% over 300k seeded rolls; SR rate-ups 3.0% each;
  shared pity across banners (LR share 33% / 47%); Legend Promise at 300 and never carried to another LR unit; `'rotated'` before
  payment on pulls, sparks and Mall purchases with a screen left open across 7 PM; spark windows (day, 3-day rule, 30-day grace);
  `gb:seen` with the clock set back and forward; coin cap forward-only; Standard first 10× (unowned, all owned, resets pity);
  Coin and Friendship 10× SR guarantee.
- `gacha.test.js`: `spark(p, 'tenka')` and `redeemSelectTicket(p, 'tenka')` return an error at the system level; 100 coin pulls
  and 100 FP pulls on a maxed roster leave `pity`, `totalPulls`, `recruitPoints`, `spk:r`, Mementos and Moonpearls unchanged; the
  class-scan test.
- `missionCounters.test.js` (new prefixes; an older-build round trip with `frp:bal` lowered), `first-impressions.test.js` and the
  Select tests (Select and Chosen exclude LR units; Kindred allowed), `consistency.test.js` (banner pools ⊂ POOL), `ur-rarity.test.js`
  (LR display rank 4, `UNIT_RARITIES` still R/SR/SSR), `progression.test.js` (UR/LR factors by axis), `profileCard.test.js` (`aw: 6`
  is LR; older clamp shows UR), `achievements.test.js` (standard ≥ 30 from wave 2), mail test (Beta letter rewrite),
  `missions.test.js` (income fields), `workbench.test.js` (stable ids, unknown id kept, caps, `everyOtherWeek`).
- Friend Support: `tests/online/supportSchema.test.js` (PGlite: a card with an LR girl against the current validator; old vs new
  validator answers; a second same-pair use; a sixth borrow; key replay; `stale_day`; `stale_key`; `p_room`); a real-Postgres CI
  case (or an assertion that the `for update` lock statement is in the function) for the lender cap under concurrency; a battle
  test that a support Victory leaves `tbest`, `tfc`, medals and achievements unchanged and that the 8-5 stand-in rejects a support
  run; Continue with a support girl (frame, level, still flagged).
- `coopStatLimits.test.js` (★5 SSRs and an LR unit in `maxedProfile`, G6); hero data / track / ability / Potential tests; snapshot
  Continue tests for the new hero fields; engines scenarios for the LR forms and the hero waves.
- e2e at 844×390 touch and 1280×720 with a fake clock (Playwright `page.clock`) across 7 PM Central and across the weekly reset:
  recruit tabs, countdown, rates, `'rotated'` toast, spark on a featured day, Legend Promise bar, coin cap, Workbench timers,
  Support slot with two accounts (`e2e/social.mjs`).

### I.5 Risks

1. **Tenka before banners** → removed: the `legend` filter ships in G0 and her tab in G2-min.
2. **Beta Select Ticket promise** → the stored letter and item text are rewritten in G0 (J13 for the generous option).
3. **Premium spark rule** surprises point savers → 30-day grace, patch notes, "Spotlight in N days", look-ahead.
4. **Device clock** → `gb:seen` forward-only, `serverOffset` online. Accepted residual risk offline until #189.
5. **Power creep** from UR, LR and the Workbench → one combined bench pass, knob order Workbench → UR → LR.
6. **844×390 space** (six rail tabs) → icon-only rail on phone, labels on PC.
7. **Hero re-casts** (Kogane, Norika) change two planned identities → J8 before any art.
8. **Friend Support trust** → clamp, progress rules, no Titan Trials, server-side caps only.
9. **Transition gap** for the five roster-wave SSRs → §A.6.
10. **Save sanitizer** drops new gacha fields → counters for every new number (§I.3).

---

## J. Owner questions (each has a default; nothing waits)

| # | Question | Default |
|---|---|---|
| J1 | Standard = the 5 original SSRs + every R and SR; every SSR from the roster wave on = Premium? | **Yes.** |
| J2 | Premium SSRs sparkable only on their Spotlight day (3-day window once a list has more than 6 girls)? | **Yes.** |
| J3 | The Legend Promise works like a 300-pull spark with no points and no choice. Keep it, counting only pulls on her own LR Banners? If "no spark" meant "no guarantee at all", turn it off: then the unluckiest 1% need about 630 pulls. | **Keep it.** |
| J4 | LR rate 0.5% (0.7% in a debut week), taken out of the 1.5% SSR rate so LR days are never better pull days? | **Yes.** Stricter: 0.4%. |
| J5 | You said "maybe" for Tenka. LR from launch (0.7% debut, Promise 300, no spark, LR form later)? This can only be relaxed later, never tightened. Alternative: a premium SSR on her own 7-day banner at 1.0%, sparkable there, no LR form. | **LR from launch.** |
| J6 | "Max out" before Limit Break = level 60 with all 5 gates (one copy), not level 85 (needs duplicates)? | **Level 60.** |
| J7 | UR Resonance +10% damage / +4% speed; LR +15% / +5% (the bench sets the final numbers)? | **Yes.** |
| J8 | Heroes: Kogane (SSR) and Norika (SR) as adult staff; Marumi, Chigusa and Sorano stay towers as your Oct 14 answers? Alternative: the old picks (Kogane, Sorano, Marumi, Chigusa as heroes), but then the bomb, the nature caster and the firebird are one-per-battle and Sorano's firebird no longer hunts the whole map. | **Kogane + Norika.** |
| J9 | Friend Support solo first; co-op as a 6th slot later? | **Solo first.** |
| J10 | After a debut week, LR units rotate daily in their own tab, or appear only on LR Weekends (Fri 7 PM → Mon 7 PM)? | **Daily tab.** |
| J11 | The five roster-wave SSRs: today's banner renamed "Open Enrollment" in v0.1.39, then Spotlight-only, with 30 days of any-day spark after banners arrive? | **Yes.** |
| J12 | Spotlights may feature standard SSRs on non-premium days (Hotaru, Kaede, Chika), or only premium SSRs (Iroha and Ena would alternate daily)? | **May feature standard SSRs.** |
| J13 | Beta Select Tickets: exclude LR units (letter amended kindly), or honour "ANY SSR" including Tenka as a one-time thank-you? | **Exclude, amended.** |
| J14 | Essence on LR units: Kindred SSR Essence yes (she must be owned; it is Potential, not the unit), Chosen SSR Essence no? | **Yes / no.** |

---

## Z. Answered critic points (adopted differently, or not a real problem)

1. **Workbench timers do not slow throughput** (the caps do). Intended: "timed" is the owner's requested feel; the caps were lowered
   to the matching shop rows and Prism Dice to every other week, and the caps are the first knob.
2. **Chosen SSR Essence on LR banner days** (owner lens) vs **never** (economy and tech lenses): default **never** (J14), because
   Moonpearls already come from every spare and a weekly chosen Essence would be the cheapest steady route into an LR unit's
   Potential. Kindred stays allowed: it is gem- or token-priced, capped and needs the girl.
3. **`a_units_30` as a paid goal:** not a real problem. Premium and LR girls are pulled with free gems, and wave 2 brings the
   standard count to 30 (§B, pinned in a test).
4. **Patch-gift cap:** not adopted. The gift is the owner's existing feature; §H now shows the sensitivity and calls every odds row a
   floor.
5. **LR Weekend crossing the Sunday reset:** moot under the new daily default. If the owner picks LR Weekends (J10), number weekends
   by their first day (`weekendIndex = Math.floor((gameDayNumber(t) − 2) / 7)`, day 2 being the first Saturday-keyed day), write the
   window as game-day keys whose UTC weekday is 6, 0 or 1, let a debut pin win an overlap, and test 2026-10-24/25/26 and the Nov 1
   weekend.
6. **Standard first 10× for existing saves:** kept as an **intended** one-time gift (§A.2), with the "all owned" fallback and a pity
   reset, rather than migrated away.
7. **Friend Support: clamp or no-progress?** The tech lens asked to pick one; this spec does both. The clamp alone still lets a
   support run open a permanent sweep tier; the progress rule alone still spreads forged LR girls into every solo stage. Titan Trials
   are simply off the Support list in v1.
8. **A J question for "select SSR + 3 SR on every banner":** not needed; it is the owner's own unconditional rule, now applied
   everywhere (§K D6).
9. **Grace for the five via `gs:grand` points tracking:** replaced by a plain 30-game-day window from the first G1 load; same
   effect, no per-point bookkeeping.
10. **`lr` card key and `valid_card_unit` change order:** replaced by `aw: 6`, so no publish can be refused while a migration waits
    for the owner's paste.
11. **Recast Marumi/Chigusa/Sorano kits:** kept in Appendix M (with the tone renames) only as the J8 alternative.

---

## Appendix M. Alternative hero kits (only if J8 picks the old four)

These were r1's kits. If J8 keeps the default, Marumi, Chigusa and Sorano are built as the GAPS towers instead and this appendix is
unused. Renames applied: Strangler Vine → Clinging Vine; Harvest Basket coins go "to Sensei's wallet".

### M.1 Sorano · Observatory Keeper (SSR hero, premium)

- **UnitDef:** role **`caller`** (Firebird Caller), mystic, element fire, land, family **rime**. Base: projectile, damage **5**,
  rate **0.9**, range **3.2**, burn 2/s for 2 s, hits flyers; **Little Firebird**: one drone (the Chika drone record) on a
  1.5-tile leash, 2 damage × 1.5/s, hits flyers.
- **Look:** long silver hair with a cool blue sheen and a comet clip, a navy faculty coat over a star-chart scarf, a brass star
  pointer and a star atlas; the firebird is made of starlight. Enums: long · straight · hairpin · coat · staff · star.
- **Bio:** "The academy observatory's night keeper and the Astronomy Club's advisor. She names every monster after a
  constellation, and her firebird helps her find them."
- **Ult (Lv 3) Star Parade**, cd 66: `runner`, look `shades`, 7 star shades enter at her aim point and walk back up the road 10
  tiles in 3.5 s; 110 mystic damage to each enemy touched, stun 0.3 s, mark +15% damage taken for 5 s. Rank 2: 12 tiles, 9
  shades, 160. Rank 3: 14 tiles, 12 shades, 230, stun 0.6 s, mark +20%.
- **Skill (Lv 7) Starfire Hunt**, `boost`, self, cd 30, 8 s: +40% attack speed, +20% damage (her and the firebird). Rank 2
  (Lv 17): 10 s, +50% / +30%, cd 25.
- **Awaken passive Wishing Star:** +6% damage; the firebird +1 damage.
- **Track** (paths `meteor`, `firebird`, `constellation`):

| Lv | From | Bonus |
|---|---|---|
| 1 | base | burning star bolts; the Little Firebird flames the nearest enemy |
| 2 | L2 | Night Air: +1 damage |
| 3 | L3 | Star Parade unlocked; +0.2 range |
| 4 | meteor.1 | Hot Stars: +1 damage; burn 3/s |
| 5 | firebird.1 | Ember Wings: +15% attack speed |
| 6 | constellation.1 | Star Map: +0.4 range; Veil Sight |
| 7 | L4 | Clear Night: +1 damage; bolts pierce 1 |
| 8 | meteor.2 | Shooting Star: +0.3 range |
| 9 | firebird.2 | Bird Watching: firebird +1 damage |
| 10 | constellation.2 | Clear Sky: +1 damage; pierce +1 · ult rank 2 |
| 11 | L5 | Comet Clip: +2 damage, +5% crit chance |
| 12 | meteor.3 | Meteor Fall: every 6th bolt is a meteor (×3 damage, splash 0.6) |
| 13 | L6 | Star Atlas: +10% attack speed |
| 14 | firebird.3 | Fire Wings: firebird +2 damage, splash 0.4 |
| 15 | constellation.3 | Star Shades: hits leave Brittle +10% for 2 s |
| 16 | L7 | Night Owl: +10% damage |
| 17 | meteor.4 | Comet Trail: +6 damage; burn 6/s · skill rank 2 |
| 18 | L8 | Starlit Path: +0.3 range |
| 19 | firebird.4 | Blazing Plumage: firebird +6 damage; bolts +5 damage |
| 20 | constellation.4 | Great Bear: +6 damage; pierce +1 · ult rank 3 |
| 21 | L9 | Meridian: +3 damage |
| 22 | meteor.5 | Meteor Avenue: +18 damage; a meteor every 4th bolt; +25% attack speed |
| 23 | firebird.5 | Eternal Firebird: firebird ×2 damage, leash +1 tile; bolts +10 damage |
| 24 | constellation.5 | Grand Constellation: +14 damage; Brittle +15%; 20% stun 0.3 s |
| 25 | L10 | Keeper of the Stars: +15% damage |

- **Potential:** P2 ✦ Bright Wings (firebird +50% damage) · P3 ✦ Wishing Meteor (meteor every 5th bolt from Lv 12) · P4 ✦ Long
  Parade (+2 shades) · P5 ✦ Afterglow (burns last +1 s) · P6 ✦ **Supernova Night** (every 12th bolt calls a 3-shade parade).
- **New sim:** none beyond a check that the drone record works on a hero record (test), the `shades` runner look (renderer) and
  the v3 every-Nth proc for meteors.

### M.2 Marumi · Bowling Club Coach (SR hero, standard)

- **UnitDef:** role **`bowler`** (Demolition Bowler), blast, land, family **ember**. Base: lobbed projectile, damage **8**, rate
  **0.5**, range **3.0**, splash 0.9, knockback 0.3 (push lock), projectile speed 9, ground only.
- **Look:** orange bob with a headband (distinct hex and style from Chika's), a two-tone retro bowling-club coach jacket over a
  staff shirt, slacks, two-tone bowling shoes, a coach's whistle, a polished bowling-ball bomb with a cartoon fuse. Enums: bob ·
  messy · headband · hoodie · *new* `ball` · flame.
- **Bio:** "The Bowling Club's coach. Loud, proud and sure that every problem is a strike waiting to happen."
- **Ult (Lv 3) Giant Strike**, cd 62: `runner`, look `ball`, ground only: a giant ball rolls from her aim point 9 tiles back up
  the road in 2.5 s; 150 blast damage to each ground enemy, push back 1.5 tiles (not minibosses or bosses), stun 0.6 s. Rank 2:
  11 tiles, 220, push 2. Rank 3: 13 tiles, 320, push 2.5, stun 1 s.
- **Skill (Lv 7) Sticky Ball**, `strike`, local, cd 24: the strongest enemy within her range ×1.2 gets a ball that sticks for
  2 s (`delay 2`) and explodes for 6× her hit, splash 1.0, stun 0.5 s. Rank 2 (Lv 17): 2 targets, 8×, cd 20.
- **Awaken passive STRIKE!:** +6% damage; splash +0.1.
- **Track** (paths `heavy`, `lane`, `spin`):

| Lv | From | Bonus |
|---|---|---|
| 1 | base | a lobbed bowling bomb that splashes and knocks back |
| 2 | L2 | Warm-up Roll: +1 damage |
| 3 | L3 | Giant Strike unlocked; +5% attack speed |
| 4 | heavy.1 | Heavier Core: +3 damage |
| 5 | lane.1 | Quick Release: +15% attack speed |
| 6 | spin.1 | Lob Shot: her bombs can hit flyers |
| 7 | L4 | Lane Sight: +0.3 range |
| 8 | heavy.2 | Big Blast: splash +0.3; knockback +0.1 |
| 9 | lane.2 | Long Lane: +0.4 range |
| 10 | spin.2 | Hook Spin: +2 damage; 15% of bombs stun 0.4 s · ult rank 2 |
| 11 | L5 | Team Spirit: +2 damage |
| 12 | heavy.3 | Concussion: 25% of blasts stun 0.4 s (not bosses) |
| 13 | L6 | Practice Lane: +10% attack speed |
| 14 | lane.3 | Split Pins: +2 damage; splash +0.3 |
| 15 | spin.3 | Sticky Coat: ×1.3 vs elites |
| 16 | L7 | Coach's Whistle: +10% damage |
| 17 | heavy.4 | Wrecking Ball: +12 damage; ×1.5 vs barriers · skill rank 2 |
| 18 | L8 | Lane Oil: +10% attack speed |
| 19 | lane.4 | Perfect Game: +8 damage; knockback +0.1 |
| 20 | spin.4 | Split Lane: +1 bomb per throw · ult rank 3 |
| 21 | L9 | Spare Pickup: +3 damage |
| 22 | heavy.5 | Bowling Thunder: +30 damage; 30% stun 0.8 s; knockback +0.2 |
| 23 | lane.5 | Turkey Strike: +18 damage; +25% attack speed; splash +0.2 |
| 24 | spin.5 | Spare Maker: +16 damage; ×1.4 vs bosses |
| 25 | L10 | Hall of Fame: +15% damage |

- **Potential:** P2 ✦ Heavy Core (+20% knockback) · P3 ✦ Lucky Pin (every 6th bomb stuns 0.5 s) · P4 ✦ Long Alley (Giant Strike
  +2 tiles) · P5 ✦ Sticky Fingers (Sticky Ball +1 target) · P6 ✦ **Perfect 300** (every 10th bomb is a giant: ×3, splash ×1.5).
- **New sim:** `pushback` and `groundOnly` on the `runner` ult (shared with Kogane).

### M.3 Chigusa · Greenhouse Keeper (SR hero, standard)

- **UnitDef:** role **`botanist`**, pierce, land, family **rime**. Base: projectile, 3 seeds in a fan, damage **2**, pierce 2, rate
  **0.8**, range **3.0**; **Creeping Vine**: every 5th throw holds the lead ground enemy 1 s (stun; minibosses 0.5 s; bosses
  immune), using v3's every-Nth proc.
- **Look:** wavy moss-green hair with a leaf tie, a straw sun hat, an olive cardigan over a white blouse, a long skirt with a
  gardening apron, rubber boots, cotton gloves, a watering can, a potted sprout riding on her shoulder. Enums: wavy · swept ·
  *new* `sunhat` · apron · *new* `wateringCan` · leaf.
- **Bio:** "The keeper of the academy greenhouse. Gentle and patient: she talks to plants and slimes in exactly the same voice."
- **Ult (Lv 3) Overgrowth**, cd 60: `nova` around her, radius 3.5: 60 damage, ground enemies held 2.5 s (bosses take the damage
  only). Rank 2: radius 4.0, 90, 3 s. Rank 3: radius 4.5, 130, 3.5 s, poison 2/s for 5 s.
- **Skill (Lv 7) Harvest Basket**, `econ`, player, cd 45: +80 coins to Sensei's wallet. Auto when ready. Rank 2 (Lv 17): +200, cd 40.
- **Awaken passive Green Thumb:** +6% damage; the vine every 4th throw.
- **Track** (paths `growth`, `greenhouse`, `harvest`):

| Lv | From | Bonus |
|---|---|---|
| 1 | base | three thorn seeds; a vine holds the lead ground enemy every 5th throw |
| 2 | L2 | Morning Dew: +1 damage |
| 3 | L3 | Overgrowth unlocked; +0.2 range |
| 4 | growth.1 | Fresh Seeds: +1 damage |
| 5 | greenhouse.1 | Creepers: seeds slow 15% for 1 s |
| 6 | harvest.1 | Compost: +0.4 range; seeds reach flyers |
| 7 | L4 | Gentle Hands: +10% attack speed |
| 8 | growth.2 | Sunlight: +15% attack speed |
| 9 | greenhouse.2 | Thorn Seeds: pierce +1; poison 1/s for 3 s |
| 10 | harvest.2 | Vegetable Patch: +25 coins a wave · ult rank 2 |
| 11 | L5 | Watering Can: +1 damage, +5% crit chance |
| 12 | growth.3 | Bloom Rush: +1 seed |
| 13 | L6 | Greenhouse Glass: +0.3 range |
| 14 | greenhouse.3 | Clinging Vine: the vine every 4th throw, holds 1.5 s |
| 15 | harvest.3 | Herb Garden: +1 life per wave cleared (at most 10 a battle; never in one-life modes; respects `noIncome`) |
| 16 | L7 | Patient Gardener: +10% damage |
| 17 | growth.4 | Full Bloom: +4 damage; +1 seed · skill rank 2 |
| 18 | L8 | Sprout Friend: +10% attack speed |
| 19 | greenhouse.4 | Thorn Hedge: poison 2/s; held enemies take +15% damage |
| 20 | harvest.4 | Bumper Crop: +80 coins a wave; girls within 2 tiles +5% damage · ult rank 3 |
| 21 | L9 | Compost Heap: +2 damage |
| 22 | growth.5 | Season of Plenty: +10 damage; +1 seed; +25% attack speed |
| 23 | greenhouse.5 | Forest Corridor: the vine every 3rd throw, holds 2 s; +8 damage |
| 24 | harvest.5 | Golden Harvest: +150 coins and +1 more life a wave (cap 10); girls within 2 tiles +10% damage |
| 25 | L10 | Greenhouse in Bloom: +15% damage |

- **Potential:** P2 ✦ Deep Roots (vine holds +0.5 s) · P3 ✦ Seed Bank (+1 seed) · P4 ✦ Bountiful (Harvest Basket +50%) · P5 ✦
  Wild Thicket (Overgrowth radius +0.5) · P6 ✦ **Evergreen** (every 8th throw plants a thorn bed: 4 hits of 3× a seed, the W1
  spike-strip record).
- **New sim:** a `lifePerWave` key paid at wave end beside income (cap 10 a battle for a hero). Her coins go to Sensei's
  wallet (owner coins from A2).

