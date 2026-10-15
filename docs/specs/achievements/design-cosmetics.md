# Achievements expansion: cosmetics and UX design

Oct 15, 2026. Design only: nothing in any repo or worktree was edited.

**Owner request (verbatim):** "Can you add more achievements some will grant you like gear boxes alongside gems and maybe even some ribbons? Special ribbons will have a cool effect to them!! And maybe titles too?"

**Lens:** cosmetics and UX. That covers what Honor Ribbons and titles look like, how the special effects work and what they cost, and every screen where a player meets them. The reward amounts and the integrity rules come from `design-economy.md`. This design builds on them and changes them only where §9 says so.

**Citations:**
- Plain `path:line` is the live game `/home/user/sakura-game` at `fddf01c` (v0.1.27).
- `SPEC:` is `scratchpad/profile/SPEC.md`. `MOCK:` is `scratchpad/profile/mock/`.
- `ECON` is `design-economy.md`. `RM` is `research-metrics-cosmetics.md`. `RS` is `research-systems.md`. All three are in this folder.

**Mock-up.** The mock is a working page built on the game's real `base.css`, `ur.css` and fonts, the same files the profile mock copies. It has screenshots at 1280×720 and 844×390 (§11).

---

## 0. Summary

| Owner asked for | This design |
|---|---|
| (a) **More achievements** | The economy design's 62 new achievements (ECON §2.2), plus **2 cosmetic-first ones** proposed here: `a_ur_1` Rainbow Bright (first UR) and `a_fp_crimson` Under the Crimson Moon. Each pays a Radiant box and 0 gems. The new **Achievements tab** groups everything into 9 categories, collapses tiered steps into **series rows**, and adds **Secrets** (§4.1). |
| (b) **Gear boxes alongside gems** | Every row shows its reward chips in a fixed order: **gems, gear box(es), other items, Honor Ribbon, Title**. Claim all ends in one modal with an **"Open N gear boxes"** button (§4.4). |
| (c) **Ribbons** | **24 Honor Ribbons**, each with **its own name and its own art** (emblem + colours). There are **3 classes, and each class has its own shape**: **10 Plain**, **6 Shiny** and **8 Special**. 22 ship at launch, 1 comes with Codex modes and 1 with social. A ribbon is owned when its achievement is claimed, so it is never stored (ECON §6.2). |
| (d) **Special ribbons with a cool effect** | **8 specials, each with a different effect:** **Prism** rainbow (the first UR), **Sakura Drift** petals, **Sunrise** light sweep, **Starfield**, **Ember Glow** (Crimson Moon), **Thunderclap** lightning, **Aurora** and **Holo Foil**. They use only CSS `transform` and `opacity`. Each is measured at **0 style recalcs and 1 to 6 ms of main thread per second** on a 4× slowed CPU. At most 3 to 4 animate on any screen, and each one stands still with a still pose under Reduce Motion (§2.3 to §2.5). |
| (e) **Titles** | **37 titles** in **3 plate tiers**. **Standard** (17) is the profile's violet plate. **Gold** (13) is a gold foil plate. **Prism** (7, the rarest) is a dark plate with a turning rainbow edge and rainbow letters. The Prism plate is rebuilt to be compositor-only: the profile's letter shimmer measured about 200 ms/s (§3). |
| Where they show | The Achievements tab, an unlock toast, the claim fanfare, the Claim-all modal, the **Honor Ribbon Case** (a gallery), and the **Sensei Profile**. On the profile they appear as the title under the name, ribbons on the pin shelf, an Honor Ribbons strip, and Edit Profile → Title (§4). |

---

## 1. Decisions that shape everything

1. **Name and silhouette.** In the UI it is an **"Honor Ribbon"**; in code it is `honor`. The game already has three "ribbon-like" things, and each keeps its own shape:
   - **Difficulty medal:** a disc **hanging from** a V-ribbon (`src/art/icons.js:200`).
   - **Gear slot "Ribbon":** a **bow** icon (`src/data/types.js:233`; mock `icons/gear-ribbon-*.svg`).
   - **Codex mode ribbon:** a **round badge** (`MOCK:icons/mode-*.svg`). The Codex "All 20" perfect-stage rosette is a **five-colour wedge** rosette (`MOCK:profile.html:76-85`).
   - **Honor Ribbon:** a **pleated prize rosette with tails hanging below**, and a unique emblem in the centre. At 40 px it reads differently from all of the above (`mock/shots/sheet-set.png`).
2. **One art system, unique art per ribbon.** Each ribbon is a procedural 64×64 SVG built from three parts:
   - the class silhouette;
   - a colourway of 8 colours;
   - one of 24 emblems.

   No two ribbons look alike. The economy design used 5 shared "looks", which would have made about 12 identical blue ribbons. Adding a ribbon later means adding one data row and possibly one emblem path.
3. **The class is shown by shape, not only by colour.** This works for colour-blind players and when nothing is moving:
   - **Plain:** one pleat ring, 2 tails.
   - **Shiny:** two pleat rings, a foil disc, 2 tails.
   - **Special:** two pleat rings, a **12-point sunburst halo** and **3 tails**.

   Every screen also writes the class as a text pill.
4. **Ownership is derived, never stored.** This is the ECON §6.2 rule: `earnedHonors(p)` reads `missions.achievements[id] === true`. Nothing in this design writes a new save key. The only new stored values are numeric `missions.counters` marks for "seen" dots (§4.6).
5. **Motion budget.** A governor (§2.5) lets **at most 3 specials animate at once in lists** and at most 4 on the profile pin shelf, plus one large one in a detail view or fanfare.
   - Ribbons off-screen, under an open modal, or in a hidden tab get `animation: none`. Pausing is not enough, because paused animations keep their layers (RM §3.2).
   - Under Reduce Motion nothing loops, and every effect shows a designed **still pose** (from here on called the "rest frame").

---

## 2. Honor Ribbons

### 2.1 Art system

**Geometry (viewBox 64×64; rosette centre at 32,27).**

| Part | Plain | Shiny | Special |
|---|---|---|---|
| Tails | 2 swallowtails | 2 swallowtails, slightly longer | 3 (the middle tail is longest) |
| Pleat rings | 1 (20 pleats, r 23.5/20.5) | 2 (22 pleats outside, 18 inside, in a second colour) | 2, the same as Shiny |
| Halo | none | none | **12-point sunburst** behind the rosette (r 30.5/25.2) in a light tint |
| Disc | r 15, radial gradient | r 13.6, plus a **foil highlight gradient** | r 13.4, plus a foil highlight |
| Emblem | white, about 18 units, a single accent colour | the same | the same |

**Colourway.** Each ribbon has 8 colours: `[pleat, pleatDark, discLight, discDark, tailLight, tailDark, emblemAccent, innerPleat]` (`mock/js/ribbons.js` `HONORS`).
- **Locked ribbons** use one grey palette (`#d7e0ec` / `#9fb0c8`), a faded emblem and a small padlock in the corner.
- **Secret ribbons** replace the emblem with a "?".

**Emblems (24, as SVG paths in a 24×24 box).** `bud`, `school`, `quad` (four medal dots), `blossom`, `crown`, `slime`, `shield` (shield with a heart), `knot` (two rings), `book`, `heartplus`, `laurel`, `cap` (graduation cap), `bookstar`, `wrench`, `constellation`, `calendar`, `gem`, `double` (two-layer blossom), `sunrise`, `eclipse`, `moon`, `bolt`, `tree` (a sakura tree), `codex` (the five mode dots around a star).

**Sizes.** Each size is rendered natively (no `scale()`, which would blur, RM §3.3 rule 4).

| Size | Where |
|---|---|
| **40 px** (s) | achievement rows (48 px on PC), the toast, pins (40 PC / 36 phone), reward chips (38) |
| **64 px** (m) | Case grid (58-72), the Claim-all strip (56), Freeplay and profile minis (26, static) |
| **160 px** (l) | Case detail, fanfare (196 PC / 140 phone) |

Each size tier turns on more effect layers (table in §2.3).

**Implementation notes:**
- **SVG gradient ids get a per-instance suffix** (`hr<no>-<uid>`). This avoids the "first copy is hidden" bug (RM §3.4).
- **Effect masks come from the same paths.** Each is a `data:` SVG set once on `:root`: `--rbm-plain|shiny|special` (silhouette), `--rbm-ring-<cls>` (pleats only), `--rbm-disc-special`, `--rbm-rosette`, `--rbm-aura-ring`. An effect can never spill outside the art (RM §3.3 rule 3).

### 2.2 The 24 Honor Ribbons

- The **No.** is the case number, shown as `HR-NN`. It is display order only, **append-only**, and never published.
- Ids and achievement names come from ECON §2.2 / §2.3 and `src/data/missions.js:56-78`.
- † marks the two achievements this design proposes (§9). "TA", "CX" and "S" mark ribbons that ship with train A, Codex modes or social.

| No. | Honor Ribbon | Granted by (id · name) | Class | Emblem · colours | Ships |
|---:|---|---|---|---|---|
| 01 | First Bud Ribbon | `a_first_win` · First Patrol (retrofit) | Plain | bud · sky blue, green tails | launch (every player, day 1) |
| 02 | Homeroom Ribbon | `a_login_7` · Settling In | Plain | school · mint, sunflower tails | launch (week 1) |
| 03 | Report Card Ribbon | `a_quad_1` · Four-Medal Report Card | Plain | four medal dots · periwinkle | launch |
| 04 | Sakura Watch Ribbon | `a_sakura_10` · Sakura Sentinel (retrofit) | Plain | blossom · pink, violet tails | launch |
| 05 | Assault Crown Ribbon | `a_boss_3` · Total Assault (retrofit) | Plain | crown · coral, navy tails | launch |
| 06 | Jelly Jar Ribbon | `a_slime_15` · Slime Specialist | Plain | smiling slime · lime, sky tails | launch |
| 07 | Petal Shield Ribbon | `a_flawless_10` · Not a Petal Lost | Plain | shield with heart · aqua, pink tails | launch (new counter) |
| 08 | Friendship Knot Ribbon | `a_coop_25` · Team Spirit | Plain | two linked rings · apricot, blue tails | launch (new counter) |
| 09 | Logbook Ribbon | `a_journal_all` · Captain's Logbook | Plain | open book · indigo, gold tails | TA |
| 10 | Helping Hands Ribbon | `a_donate_10` · Helping Hands | Plain | heart with plus · rose, mint tails | S |
| 11 | Valedictorian Laurel | `a_gold_40` · Valedictorian (retrofit) | **Shiny** | laurel + star · gold, orange tails | launch |
| 12 | Graduation Ribbon | `a_chapter_8` · Chapter 8 Complete (retrofit) | **Shiny** | graduation cap · navy, gold tails | launch |
| 13 | Encyclopedia Ribbon | `a_bestiary_100` · Encyclopedia Sakura (retrofit) | **Shiny** | book + star · teal, silver tails | launch |
| 14 | Master Crafter Ribbon | `a_leg_plus10` · Celestial Craftwork | **Shiny** | wrench + star · silver, teal tails | launch |
| 15 | Constellation Ribbon | `a_stars_50` · Starry Sky | **Shiny** | constellation · violet, gold tails | launch |
| 16 | Hundred Days Ribbon | `a_login_100` · Perfect Attendance Award | **Shiny** | calendar with check · sky, pink tails | launch |
| 17 | Rainbow Bright Ribbon | `a_ur_1` † · Rainbow Bright | **Special: Prism** | faceted gem · pearl, rainbow ring | launch |
| 18 | Thousand Petals Ribbon | `a_sakura_40` · Thousand-Petal Sentinel | **Special: Sakura Drift** | two-layer blossom · sakura | launch |
| 19 | Laureate's Sunrise Ribbon | `a_quad_40` · Academy Laureate | **Special: Sunrise** | rising sun · amber, flame tails | launch |
| 20 | Eclipse Starfield Ribbon | `a_fp_wyrm` · Eclipse Watcher | **Special: Starfield** | eclipse · night violet | launch |
| 21 | Crimson Ember Ribbon | `a_fp_crimson` † · Under the Crimson Moon | **Special: Ember Glow** | crescent moon · crimson, ember tails | launch |
| 22 | Stormproof Ribbon | `a_boss_sak_3` · Dawn After the Storm | **Special: Thunderclap** | lightning bolt · storm blue, sakura tails | launch |
| 23 | Aurora Year Ribbon | `a_login_365` · Academy Anniversary | **Special: Aurora** | sakura tree · aurora teal | launch (a year of play) |
| 24 | Holo Codex Ribbon | `a_mr_800` · Every Ribbon, Every Stage | **Special: Holo Foil** | five mode dots + star · pearl foil | CX |

**Why this pacing works for a kid:**
- **Day 1:** First Bud.
- **Week 1:** Homeroom.
- **Weeks 2–4:** Report Card, Jelly Jar, Petal Shield, Logbook.
- **Month 2:** Sakura Watch, Assault Crown, the shinies.
- **Months 3–12:** the specials.

One special can be reached by **any** patient player: Aurora Year, which only needs visits on 365 days. Rainbow Bright is the special a mid-game player can realistically chase.

**Update day:** a late veteran's save lights about 8 ribbons at once. These include Valedictorian Laurel (shiny), Graduation (shiny), Rainbow Bright (special, if they own a UR) and possibly Eclipse Starfield. That is the "wow" on day one, and it costs 0 gems.

### 2.3 Special effects: look, technique, sizes and rest frame

**Shared rules for every effect:**
- Effects are **sibling `<span>` layers** over the SVG, clipped by the class mask. They animate **`transform` and `opacity` only**.
- They run only while the ribbon has `.live` (§2.5).
- All `.live` rules sit inside `@media (prefers-reduced-motion: no-preference)` **and** behind `html:not([data-reduce-motion])`. So even if a ribbon were marked live, reduced motion keeps the rest frame (`mock/css/ribbons.css`, end block).
- The game's global 1 ms rule (`src/ui/styles/base.css:375`) is not relied on, because it would strobe infinite loops (RM §2.4).

| Effect | Ribbon | The look | Technique (layers) | 40 px | 64 px | 160 px | Cycle | Rest frame / Reduce Motion |
|---|---|---|---|---|---|---|---|---|
| **Prism** | Rainbow Bright (first UR) | The UR rainbow swirls through the pleats; glints twinkle | `.rb-ring`: conic `--ur-rainbow` (`src/ui/styles/ur.css:13`) turning (`ur-spin`) inside the pleat-ring mask, as `ur.css:21-35` does. `.rb-glints`: 1–3 four-point stars | ring + 1 glint | ring + 2 glints | ring + 3 glints + static glow | 5 s | rainbow ring still; glints still at 0.9 |
| **Sakura Drift** | Thousand Petals | Petals fall across the ribbon, past its edges | `.rb-petals`: 4 or 8 `<i>` petals on `translate3d + rotate` (the lobby petal pattern, `src/ui/styles/meta-a.css:322`, `:384`), overflow visible | 1 pink glint (petals don't read at 40) | 4 petals + glint | 8 petals + 2 glints + glow | 6.4–8.6 s, staggered | 2 petals resting on the tails |
| **Sunrise** | Laureate's Sunrise | Gold rays slowly turn between the halo points; a light band sweeps across | `.rb-rays`: repeating conic rays masked to the halo ring (halo minus rosette), `rotate` over 40 s. `.rb-sweep`: a white band on `translateX` masked to the silhouette (`ur-sheen` recipe, `ur.css:83-89`) | rays + 1 glint (a sweep is invisible at 40, RM §3.2) | rays + sweep + glint | the same + glow | sweep 4.2 s, rays 40 s | rays still; no sweep |
| **Starfield** | Eclipse Starfield | A night sky drifts behind the eclipse; three stars twinkle | `.rb-stars b`: a 200%-wide layer of 6 radial-gradient stars (static paint), `translateX` loop. A second `.far` layer runs slower in reverse (parallax). Disc mask. Plus glints | 2 twinkles | 1 star layer + 2 twinkles | 2 layers + 3 twinkles + violet glow | 18 s / 30 s | stars still; twinkles still at 0.9 |
| **Ember Glow** | Crimson Ember (Crimson Moon) | A warm pulse at the rim; embers float up from the tails | `.rb-halo`: a radial ring glow pulsing on `opacity + scale` (a pre-drawn gradient, never an animated `filter`). `.rb-embers`: 4 or 7 dots rising on `translate3d` + opacity | halo pulse | halo + 4 embers | halo + 7 embers + glow | 2.4 s pulse, 3.2–4 s embers | halo still at 0.8; 3 embers resting above the rosette |
| **Thunderclap** | Stormproof | Short bolts crackle on the rim, then calm; the disc brightens a little | `.rb-bolts i`: `clip-path` bolt shapes placed around the rim (`rotate` + `translate`), **opacity in `steps()`**: 2 quick flashes, then quiet. `.rb-flash`: a disc-masked white layer, opacity 0 → 0.32 → 0 | 1 bolt | 2 bolts | 3 bolts + disc flash + glow | 3.6 s (flashes in the last 12% only) | one bolt shown still at 0.85 |
| **Aurora** | Aurora Year | Soft green-teal-violet bands drift across the rosette | `.rb-aurora i`: 1–3 elliptical radial-gradient bands (pre-softened, no blur filter), `translateX + rotate + scaleY` alternating, rosette mask | 1 band | 2 bands | 3 bands + 2 glints + glow | 9 / 11 / 13 s, alternating | bands still |
| **Holo Foil** | Holo Codex (Codex modes) | Pastel foil with fine stripes shifts as if the card were tilted; a rainbow-tinted sweep | `.rb-foil::before`: a 200% pastel rainbow plus stripe gradient (static paint) on `translate` alternating, silhouette mask. `.rb-sweep.holo` | foil (still) + 1 glint | foil drift + sweep | the same + glow | 6 s alternating, 4.2 s sweep | foil still at mid position |

**Big sizes.** At 160 px a ribbon gets a soft glow: a `::before` radial-gradient layer **behind** the art. I replaced the prototype's `filter: drop-shadow`, because a filter over animated children risks repaints.

**Photosensitivity (Thunderclap).**
- At most 2 flashes in a 3.6 s cycle (under 1 per second).
- The flash covers the disc only, at ≤ 0.32 opacity.
- It never flashes full screen.
- WCAG 2.3.1 allows 3 flashes per second, so this sits well below it.

**Kid-readable copy.** The detail view gives each effect a one-line description: "Prism: a rainbow swirls around the ribbon", "Sakura Drift: petals drift across the ribbon", and so on.

### 2.4 Shiny: one light pass, no loop

- A shiny ribbon is static foil art: a second pleat ring and a highlight gradient on the disc.
- It shows motion **once**: when it first scrolls into view, or when it is claimed, the governor adds `.reveal` and a single white band crosses it (`rb-once`, 1.1 s, `transform` only).
- It costs nothing afterwards, and it is skipped under Reduce Motion.
- This gives "shiny" a little life without adding to the loop budget.

### 2.5 The live governor (`src/ui/honorFx.js`) and the measured cost

**Rules:**
1. **One IntersectionObserver per screen root.** Only on-screen specials are candidates.
2. **Budget by screen:**

   | Screen | Specials live at once |
   |---|---|
   | Lists (Achievements tab, Case grid) | **3** |
   | Profile pin shelf | **4** (only the pins) |
   | Detail view or fanfare | 1 large, plus the list budget **drops to 0 while a modal or overlay is open** |

   **Priority:** detail/fanfare > pins > ready rows > earned case cells > the rest.
3. **In the Case grid, a soft "spotlight" moves to the next earned special every 6 s.** It is a static radial light over the cell. Only the spotlit cell and the selected one animate, so the shelf looks curated rather than busy.
4. **Losing `.live` means `animation: none`, never `paused`.** Paused animations keep their layers (RM §3.2: 1,595 → 76 layers).
5. **Live is cleared everywhere when:**
   - `document.hidden` is true;
   - `prefers-reduced-motion: reduce` is set;
   - `html[data-reduce-motion]` is set (`src/ui/components.js:164-171`).

   Under reduced motion the governor grants nothing.

**Measured cost** (`mock/fxBench.mjs` and `mock/fxIsolate.mjs`). Chromium headless, DPR 2, CPU throttled 4×, 4 s windows, median of 3 runs. Other jobs share the machine, so read the numbers as relative.

| Screen (mock) | Main thread ms/s | Style recalcs/s | Layouts/s | Infinite anims running | Layers |
|---|---:|---:|---:|---:|---:|
| Achievements list, 1280×720 | 5.9 | 0 | 0 | 4 | 41 |
| Achievements list, 844×390 | 4.6 | 0 | 0 | 2 | 36 |
| Honor Ribbon Case, 1280×720 | 1.1 | 0 | 0 | 10 (3 ribbons) | 47 |
| Special fanfare, 844×390 | 3.3 | 0 | 0 | 14* | 83 |
| Achievements list, Reduce Motion | 1.2 | 0 | 0 | 0 | — |
| **Approved profile mock as it is** (`MOCK:profile.html?state=own`) | **211** | 24 | 0 | 5 | — |
| Profile + this design's honors | 244 | 20 | 0 | 9 | 48 |
| Profile + honors, with `.ur-text` shimmer disabled | **14.8** | **0** | 0 | — | — |
| Fanfare, first draft (shimmering kicker + title) | **455** | 50 | 0 | — | — |

\* The mock leaves the list's ribbons live under the overlay. The build drops them (rule 2), which leaves 3 to 4.

**Finding.** The honor ribbon effects themselves cost **about 0**. The one expensive motion is the painted **rainbow letter shimmer**:
- It is `.ur-text`, a `background-position` slide on `background-clip: text` (`src/ui/styles/ur.css:59-69`).
- Every frame repaints the text on the main thread. That is about 200 ms/s on this rig, already in the **approved profile mock** and in the live UR badges.
- Software raster in headless exaggerates paint cost, so confirm on a real phone. It is still the one thing to avoid.

**So:**
- The Prism title plate (§3.1) and the fanfare kicker use **static** rainbow letters with compositor-only motion around them. That took the fanfare from 455 to 3.3 ms/s.
- **Recommendation for the profile build (outside this lens):** on the profile screen, show UR letters still. If wanted, put the shimmer only on the favourite girl's nameplate. Consider doing the same in `ur.css` for screens that show many UR badges.

### 2.6 Data shape

The game fields stay on the achievement def, which keeps ECON §6.1's rule that cosmetics sit beside `rewards`, never inside it. The art lives in its own client table.

```js
// src/data/missions.js (one def)
{ id: 'a_sakura_40', name: 'Thousand-Petal Sentinel', ..., rewards: [...],
  honor: { no: 18, name: 'Thousand Petals Ribbon', cls: 'special', fx: 'sakura' },   // cls: plain | shiny | special
  title: { text: 'Thousand-Petal Sentinel', tier: 'prism' },                          // tier: std | gold | prism
  series: 'sakura' }                                                                  // UI only (§4.1)

// src/art/honors.js (client art, never published)
export const HONOR_ART = { a_sakura_40: { emblem: 'double', c: ['#ffa8cf', '#b5306a', '#fff0f6', '#ff6fae', '#b28dff', '#6741d9', '#ff6fae', '#ffd6e8'] }, ... };
export function honorSVG(id, { locked, secret }) { ... }   // the silhouette + colourway + emblem builder from mock/js/ribbons.js
export const HONOR_FX = ['prism', 'sakura', 'sunrise', 'starfield', 'ember', 'storm', 'aurora', 'holo'];
```

**Changes from ECON's shape:**
- ECON's `honor: { look, fx }` becomes `{ no, name, cls, fx }`, plus the art table.
- `title` becomes `{ text, tier }`.

The title id stays the achievement id (ECON §6.3), and the public card is unchanged.

---

## 3. Titles

### 3.1 Plate tiers

| Tier | Count | Plate | Motion | Rule for the tier |
|---|---:|---|---|---|
| **Standard** | 17 | The profile spec's violet → pink slanted plate with ✦ (`SPEC:108`; `MOCK:css/profile.css:105-106`) | none | ECON tier 1–3 and mid-game shipped achievements |
| **Gold** | 13 | A gold foil gradient (`#c98a00 → #f2b705 → #ffe9a0 → #f7c62a → #c98a00`), navy-brown text, a white inner hairline, ★ | none (static foil) | ECON tier 4 and the big shipped milestones |
| **Prism** | 7 | A dark navy plate with a **rainbow edge turning inside a masked ring** (the `ur-ring` recipe), **static rainbow letters**, and a soft light sweep every 5 s | `transform` only, 2 layers. Only the equipped title under the name moves; plates in lists (Edit Profile, chips) are still | capstones (ECON tier 5) and the hardest freeplay title |

- **Measured:** the Prism plate adds about 0 paints (§2.5).
- **Under Reduce Motion:** the ring is still and there is no sweep; the rainbow stays.
- **Rule of thumb for future titles:**
  ```js
  titleTier(a) = a.honor?.cls === 'special' || a.tier === 5 ? 'prism' : a.tier === 4 ? 'gold' : 'std'
  ```
  Hand overrides are allowed for shipped ids.

### 3.2 The 37 titles

- The title id is the achievement id, or `fp_*` for freeplay titles (`SPEC:333-335`).
- Every id matches `^[a-z][a-z0-9_]{0,23}$` (`SQL:135`).
- The longest text is 23 characters ("Thousand-Petal Sentinel"), which fits the plate at both sizes.

| # | Title | Id · from | Tier | Ships |
|---:|---|---|---|---|
| 1 | Crimson Slayer | `fp_crimson` · Ashwing Matriarch on Crimson Moon (existing, `src/online/coop/rewards.js:38`, `:303`) | **Prism** | live |
| 2 | Thousand-Petal Sentinel | `a_sakura_40` | **Prism** | launch |
| 3 | Academy Laureate | `a_quad_40` | **Prism** | launch |
| 4 | Stormproof Sentinel | `a_boss_sak_3` | **Prism** | launch |
| 5 | Eclipse Watcher | `a_fp_wyrm` | **Prism** | launch |
| 6 | Sensei of the Year | `a_login_365` | **Prism** | launch |
| 7 | All-Round Sensei | `a_mr_800` | **Prism** | CX |
| 8 | Valedictorian | `a_gold_40` (retrofit) | Gold | launch |
| 9 | Academy Graduate | `a_chapter_8` (retrofit) | Gold | launch |
| 10 | Ashwing Slayer | `fp_ashwing` (existing) | Gold | live |
| 11 | Walking Encyclopedia | `a_bestiary_100` (retrofit) | Gold | launch |
| 12 | Perfect Score | `a_level_60` (retrofit) | Gold | launch |
| 13 | Radiant Halo | `a_awaken_5` (retrofit) | Gold | launch |
| 14 | Sakura Sentinel | `a_sakura_10` (retrofit) | Gold | launch |
| 15 | Assault Squad Leader | `a_boss_gold_3` | Gold | launch |
| 16 | Head of the Class | `a_lv60_5` | Gold | launch |
| 17 | **Stargazer Sensei** (ECON had "Starry-Eyed Sensei") | `a_stars_50` | Gold | launch |
| 18 | Master Crafter | `a_leg_plus10` | Gold | launch |
| 19 | Petal Storm | `a_kills_100k` | Gold | launch |
| 20 | Versatile Strategist | `a_mr_400` | Gold | CX |
| 21 | **Rookie Sentinel** (new) | `a_first_win` (retrofit) | Standard | launch |
| 22 | Golden Student | `a_gold_10` (retrofit) | Standard | launch |
| 23 | Monster Scholar | `a_bestiary_50` (retrofit) | Standard | launch |
| 24 | Assault Veteran | `a_boss_3` (retrofit) | Standard | launch |
| 25 | Legend of the Academy | `a_kills_25000` (retrofit) | Standard | launch |
| 26 | Straight-A Sensei | `a_quad_10` | Standard | launch |
| 27 | Club Captain | `a_bountyg_15` | Standard | launch |
| 28 | Seasoned Sentinel | `a_wins_500` | Standard | launch |
| 29 | Perfect Attendance | `a_login_100` | Standard | launch |
| 30 | Class Representative | `a_daily_100` | Standard | launch |
| 31 | Dragon Spotter | `a_dragon_4` | Standard | launch |
| 32 | Team Spirit | `a_coop_25` | Standard | launch |
| 33 | Slime Specialist | `a_slime_15` | Standard | launch |
| 34 | Flawless Guardian | `a_flawless_10` | Standard | launch |
| 35 | Homework Hero | `a_daily_30` | Standard | launch |
| 36 | Bookworm Sensei | `a_journal_all` | Standard | TA |
| 37 | Helping Hands | `a_donate_10` | Standard | S |

**Totals:** 34 at launch (counting the 2 live freeplay titles), 2 with Codex modes, 1 with social.

### 3.3 Content rules

**Every title is checked against these rules:**
- wholesome;
- about **doing** something (school life, the academy, sakura, this game's enemies and bosses);
- never about appearance;
- never mocking;
- never a spending signal;
- original.

**Changes:**
1. **"Starry-Eyed Sensei" → "Stargazer Sensei".** The idiom is about eyes and naivety, so it is close to an appearance or teasing reading. The new name is about stars.
2. **"Rookie Sentinel"** goes on `a_first_win`, so every player can try equipping a title on day 1. ECON's early save had 0 titles.
3. **"Gambler's Eye" stays excluded.**
   - It gets **no title**, and ECON §2.3 already renames its display text to "Keen Tinkerer" (`src/data/missions.js:77`).
   - Its pin (`ach:a_reroll_10`) should be refused by `pinOptions` too. Without that, the old name would surface as a plaque on older viewers.
4. **No title, pin or ribbon** for `a_pulls_*`, `a_units_all` or any recruit, gem or Potential count (`SPEC:726`; ECON §2.1 rule 5).
5. **"Slayer"** is in two freeplay titles. They are already shipped and pinned by tests (`tests/online/coopRewards.test.js`), so they are kept. If the owner wants softer wording, only the **display text** in `TITLES` would change, to "Ashwing Champion" / "Crimson Champion". The stored strings in `progress.freeplay.titles` stay as they are. Owner question 4.

### 3.4 Where titles show

| Place | Look |
|---|---|
| Under the name on the profile | The equipped plate, at full motion if Prism (§4.6) |
| Achievement row reward chip | A "TITLE" label plus a small still plate (§4.1) |
| Fanfare | A "New title" chip with the plate |
| Claim-all modal | A "New titles" strip of still plates, each with an **Equip** link |
| Edit Profile → Title | A grid grouped by tier, with locked plates greyed (§4.6) |

On the profile, Freeplay Records shows only freeplay titles plus an "All titles N/37 ›" chip (§4.6).

---

## 4. Screens

**Layout numbers** were measured from the mock. PC is 1280×720 and phone is 844×390 in landscape. The phone rules sit under `@media (max-height: 480px)`, the game's own breakpoint (`src/ui/styles/base.css:126`).

### 4.1 The Achievements tab (`#/commissions?tab=achievements`, rewrite of `achievementsView`, `src/ui/screens/commissions.js:210-266`)

Shots: `mock/shots/1280x720-list.png`, `mock/shots/844x390-list.png`.

**Frame:**

| Region | PC 1280×720 | Phone 844×390 |
|---|---|---|
| Top bar · tabs | 50 px · 40 px (unchanged) | 42 px · 32 px |
| Panel | 1200 × about 606, padding 12 | full width, about 304 tall, padding 8 |
| **Category rail** | Left, 196 px. 10 rows of 39 px: icon tile 26 px, label, "done/total", yellow ready count. The **Honor Ribbon Case card** (118 px, dark glass) sits at the bottom | Replaced by a **chip scroller** in the header row (30 px chips, small ready badges) |
| **Header** | 52 px: "▌Achievements" (italic 900, 1.22 rem), a segmented meter "44/104 completed", "12 Honor Ribbons · 9 Titles", then three buttons: **Ribbon Case chip** (dark, 38 px, ribbon + "12/24"), **Titles chip** (gold mini plate + "9/37" + a pink "new" dot), **Claim all (n)** (yellow, `ach-claim-all`) | 38 px: chip scroller, Case chip (icon + count), Claim all |
| **List** | Scrolls inside the panel. About 6.5 rows visible | About 3.7 rows visible; the live tab showed about 2.7 |

**Categories:**
- They follow ECON §7.5: **Campaign, Bounty & Assault, Bestiary, Students, Gear, Battles, Freeplay, Academy Life, Secrets**, plus **Codex** when it ships, and **All**.
- **Icons** come from the existing ui glyphs: map, assault, bestiary, students, upgrade, sword, challenge, calendar, sparkle.
- **Each category has a colour pair** used for its icon tile (Campaign green, Bounty orange, Bestiary amber, Students blue, Gear violet, Battles pink, Freeplay crimson, Academy Life teal).

**Sections inside the list:**
1. **READY TO CLAIM · n** (yellow count).
2. **IN PROGRESS.**
3. **COMPLETED · n ▸**, collapsed. Today all 30 rows render at once (`commissions.js:236-263`).

Section labels use spaced small caps in tech blue with a fading rule. Rows are built per category on demand: 92 defs collapse to about 45 series rows (below).

**Row anatomy:**

| | PC | Phone |
|---|---|---|
| Height | 72–76 px, radius 10, left accent bar 5 px | 58–60 px |
| Left accent bar | grey (in progress), **yellow** (ready), **rainbow** (ready and grants a special), green at 62% opacity (claimed), dotted violet (secret) | same |
| Icon (56 PC / 44 phone) | **The Honor Ribbon** (48 / 40 px) when the def has one. Otherwise the **category icon tile** (gradient of the category colours), which replaces today's identical trophy (`commissions.js:238`). Ready: a warm glow behind it. Claimed: a green ✓ stamp | same |
| Name line | Italic 900 navy 1 rem. Then **series pips** (§ "Tiers" below), then "STEP 2 OF 3". New-counter rows add a violet **"Counts from v0.1.N"** chip (ECON §5.3 rule 2) | 0.88 rem, no "step" text |
| Description | 0.76 rem muted, one line, ellipsis | 0.66 rem |
| Progress | Bar 230×8 (blue; **yellow** when ready) plus "14 / 20" | 150×6 |
| **Reward chips**, right-aligned in this order | **gems → gear box(es) → other items → Honor Ribbon → Title** | the same, at 38 px |
| Action (96 / 74 px) | **Claim** (yellow, `ach-claim-<id>`), **Go ›** (ghost; routes like `EVENT_ROUTE`, `commissions.js:20-32`), **"After stage 2-1"** lock chip (ECON §4.6), or **???** for secrets | same |

**Reward chips in detail:**

| Chip | PC | Phone | Notes |
|---|---|---|---|
| Item tile | 46×46, 2 px border in the item's rarity colour | 38×38 | Real item art from `src/art/icons.js` `itemIcon`, "×n" bottom-right. Gem gold, Ornate violet, Radiant red, Celestial amber, Recruit Ticket pink |
| Honor Ribbon | the same 46 px tile with a 38 px ribbon (special ones animate only when the row is live) and a tiny "HR" corner tag | 38 px | Border by class: Plain sky, Shiny gold, Special rainbow (`border-box` gradient) |
| Title | 46 px tall, ≤ 150 wide: a "TITLE" micro-label over a still mini plate in its tier | 38 px, ≤ 98 wide, label hidden | |
| Hidden reward | violet "?" tiles | same | |

Tapping a ribbon or title chip opens a small info sheet (ribbon at 160 px, its class, its effect line) instead of today's "Owned: 0" item info (RS §3.3).

**Tiers: series rows.**
- Defs that are steps of one ladder share `series` (UI only). The row shows the **lowest unclaimed step**.
- **Pips:** slanted 12×7 bars. Blue = claimed, yellow = ready, grey = later.
- **If the series ends in an Honor Ribbon,** an 18 px mini of the **capstone ribbon** sits after the pips. This is a goal preview: "Sakura in Full Bloom ▰▰▱▱ 🎀".
- **Claiming advances the row in place.** If the next step is also met (common for veterans), the button stays.
- **Series list:**
  - `gold` (10/20/40), `sakura` (1/10/20/40), `quad` (1/10/40), `chapter` (1–8), `bestiary` (25/50/100), `level` (20/40/60);
  - `awaken` (1/5), `units` (10/15/all), `kills` (1k/5k/25k/100k), `wins` (100/500), `login` (7/30/100/365), `daily` (30/100);
  - `bounty` (5/15), `plus10` (1/10), `coop` (1/25), `stars` (25/50), `class` (lv20×10/lv40×10/lv60×5), `gearRarity` (SR/Mythic/Legendary), `reroll` (10/50);
  - Codex: `mr` (1/100/400/800).
- `a_pulls_*` keeps its rows but shows no ribbon or title.

**Hidden achievements (Secrets).**
- The ids come from the catalogue job (`hidden: true, hint`).
- **Before they are met:**
  - a dotted violet row, "Secret achievement";
  - an italic hint ("Go back to the very first stage…");
  - no progress bar ("Hint · progress hidden");
  - "?" reward chips.
- **When met:** a "Secret found!" toast (§4.2), and the row reveals its real name and rewards.
- **The header counts them:** "Secrets 1/6".
- **Rule: no special ribbon is ever secret.** Kids should be able to see what to aim for. A secret may grant a Plain ribbon, shown in the Case as a "?" silhouette until earned.

**Sort.** Ready (specials first) → locked-but-met ("after 2-1") → in progress by % → secrets → completed. This is deterministic (ECON §7.1).

**Claim and Claim all** follow ECON §7.1: the marker is set before the payout, one commit and one modal, with a busy guard. The sequence with cosmetics is in §4.3–4.4.

### 4.2 Unlock toast ("Achievement complete")

Shot: `mock/shots/1280x720-toast.png`.

**When it shows:**
- It comes from a pure `achievementsReady(prevReadyIds, nextReadyIds)` computed after commits.
- **Never during battle.** Toasts queue and show on the results sheet or the next screen.
- **No toasts on app start or update day.** The first check after load only sets the baseline. Update day uses ECON's one-time intro notice instead, which this design extends with a row of up to 6 already-earned ribbons ("You've already earned 9 Honor Ribbons!").

**Look:**
- **PC:** 470×66, top-centre at y = 60 (under the top bar).
- **Phone:** 400×56 at y = 48.
- A white card with a 5 px left accent: yellow, rainbow for a special, violet for a secret.
- **Content:**
  - the ribbon (44 px) or the category tile;
  - a "ACHIEVEMENT COMPLETE" micro-label (or "SECRET FOUND!");
  - the name (italic 900);
  - a reward line ("💎 50 · 📦 Ornate Gear Box · Honor Ribbon · Title");
  - a **Claim ›** button.
- **One toast at a time.** It stays 3.2 s. Others coalesce into a "+N more" pill.
- **Tap** opens the tab with that row highlighted.

**Motion and build:**
- It slides in 14 px over 420 ms. Under Reduce Motion it appears with no slide (`base.css:368-375` already covers `.toast`).
- It reuses `toast()` (`src/ui/components.js:353-360`) with a new `kind: 'ach'` that accepts a node instead of a string.

### 4.3 Claim fanfare (three levels)

| Claim contains | What the player sees | Sound (`src/audio/economy.js`) |
|---|---|---|
| Only items | Today's rewards modal (`showRewardsModal`, `src/ui/screens/stage.js:162-174`) | `'achievements'` (`:24`) |
| A Plain or Shiny ribbon and/or a title | The modal's `extra` slot gets a **hero strip**: the ribbon at 96 px pops in (one-shot, 900 ms; shiny ones do their single light pass), then the title plate with **Equip** | `'achievements'` |
| **A Special ribbon** | First a **full-screen fanfare** (`mock/shots/*-fanfare.png`), then the modal | `'achievements-special'` (ECON §7.4): the claim cue, then the `awaken` jingle (`src/audio/economy.js:57-58`) |

**Fanfare layout** (`.ff`, overlay z-index 300):

| | PC | Phone |
|---|---|---|
| Backdrop | radial violet → navy | same |
| Rays | one-shot fade and turn in 1.4 s, then still | same |
| Sparks | 16 one-shot, 1.3 s | same |
| Kicker | "SPECIAL HONOR RIBBON" in static rainbow letters | 0.72 rem |
| Stage | 230×230, cyan corner brackets | 168×168 |
| Ribbon | **196 px**, live, popping in (0.4 → 1.08 → 1 scale with a small turn, 900 ms) | **140 px** |
| Name | 2.1 rem italic white | 1.5 rem |
| Tech line | "HR-18 · Effect: Sakura Drift" | same |
| Then | "from **Thousand-Petal Sentinel** · Sakura medals on all 40 campaign stages", a **New title** chip with the Prism plate, and "TAP TO SEE ALL REWARDS"; **Skip ›** top-right | same |

**Behaviour:**
- It waits for a tap; it does not auto-close.
- **Claim all with several specials** shows them in sequence (tap → next, at most 3). With 4 or more, one card shows a grid of all of them. **Skip** jumps to the modal.
- **Reduce Motion:** no rays turning, no sparks, no pop, no text rise. The ribbon shows its rest frame and the text is there at once.

**Cost:** 3.3 ms/s (§2.5). The list underneath drops its live ribbons while the overlay is open.

### 4.4 Claim-all rewards modal

Shots: `mock/shots/1280x720-claimall.png`, `mock/shots/844x390-claimall.png`.

**Frame:**
- `showRewardsModal({ title: 'Achievement rewards · 9 claimed', rewards: merged, extra })`.
- Width 820 on PC; full width (−20 px) and ≤ 370 tall on phone.

**`extra` contains three strips, each with a spaced-caps header and a fading rule:**

| Strip | PC | Phone |
|---|---|---|
| **NEW HONOR RIBBONS · n** | Cards 92 px wide: ribbon 56 (specials live, budget 1–2), a class pill, the name (2 lines). Order: special → shiny → plain. At most 8, then "+N" | ribbon 42, pills hidden |
| **NEW TITLES · n** | Still plates, each with an **Equip** link (→ Edit Profile → Title with it preselected) | same |
| **REWARDS** | Merged item tiles (58 px with names), e.g. "Gems ×1,250 · Ornate Gear Box ×9 · Radiant Gear Box ×3 · Lock Pin · Prism Dice" | 42 px tiles, scrolling sideways |

- **Note line:** "Gear boxes wait in Backpack → Equipment until you open them."
- **Actions:**
  - **Later** (ghost);
  - **Open N gear boxes** (blue): ECON §7.3, opens exactly the boxes this claim granted, then shows a summary;
  - **OK** (yellow).

### 4.5 The Honor Ribbon Case (gallery) and ribbon detail

Shots: `mock/shots/1280x720-case.png`, `844x390-case.png`, `844x390-detail.png`.

**Entry points:**
- the rail card and the header Case chip;
- the profile's Honor Ribbons strip;
- Equip / "see all" links.

It is a view of the Achievements tab (`?tab=achievements&view=case`, kept with `rememberParams`, `commissions.js:84`), so no new route is needed.

**The case (PC: left pane, about 850 px; phone: full width):**
- **Display-case look:**
  - a navy glass panel (`#1a2747 → #22385c`) with a faint 24 px cyan grid and a cyan inner hairline;
  - a "‹" back button, the title **Honor Ribbon Case**, and a tech line "12 / 24 EARNED · 1 NEW";
  - filter pills: **All · Earned · Not yet**.
- **Three shelves, each above a glass ledge** (a light gradient bar with a bright top edge):

  | Shelf | Header | Cells |
  |---|---|---|
  | **SPECIAL · COOL EFFECTS 2/8** | rainbow-tinted label | 8 cells, ribbons at 72 px (44 on phone) |
  | **SHINY 3/6** | gold label | 6 cells at 66 px (44 on phone) |
  | **RIBBONS 7/10** | blue-grey label | 10 cells at 58 px (40 on phone) |

- **Earned cells:** the ribbon and its short name (2 lines PC, 1 line phone).
- **Not-yet cells:** the grey silhouette with a padlock and the muted name. Kids see what exists and can tap for how to earn it.
- **"NEW"** pink tag until it has been looked at. It is tracked by the high-water count `missions.counters['ach:seenHR']`, a number that survives older builds (RS §1.4).
- **Animation:** the selected ribbon (in the detail pane) and the spotlit earned special animate. Everything else rests. 1.1 ms/s measured.

**Detail** (PC: right pane 320 px; phone: a 640 px modal with the ribbon on the left and the text on the right):
- A 206 px stage with cyan brackets and a soft radial glow, and the ribbon at **160 px, live, full effect layers**.
- A meta row: `HR-17` · class pill · NEW.
- **Name** (1.3 rem italic).
- "From **Rainbow Bright** · Awaken an SSR student all the way to UR (★5)."
- A small grid: **EFFECT** "Prism: a rainbow swirls around the ribbon"; **EARNED** "Yes ✓ · shows on your profile when pinned". When not earned, "How: …" with **Go ›**.
- **Actions:** **Pin to profile** (pink; opens the profile's pin picker with `ach:<id>` preselected; hidden if not earned) and **Achievement ›**.

### 4.6 Sensei Profile integration

Shots: `mock/shots/1280x720-profile-own.png`, `-visit`, `-editt`, and the 844×390 versions. The mock is `mock/profile-honors.html`, built by `mock/build-profile.mjs` from the approved mock by exact string patches.

| Place (SPEC section) | Change |
|---|---|
| **Title under the name** (SPEC §1.4, `:108`) | `sensei.title` renders as its **tier plate** (§3.1). The tier and text come from the viewer's own `TITLES` table, so the card is unchanged. An unknown id is hidden (`SPEC:453`). Only this plate moves: a Prism ring and sweep. |
| **Pinned shelf** (SPEC §1.7, `:182-196`) | An `ach:<id>` plaque **draws its Honor Ribbon at 40 px** (36 on phone) instead of the trophy. This is the "per-achievement badges in M3" slot (`SPEC:189`). The pin dot sits on the rosette's top, and the art rises 5 px so the plaque stays 118×77. **Plaque title = achievement name** ("Eclipse Watcher", "Valedictorian"), subline "Honor Ribbon". **Background by class:** Plain sky, Shiny gold foil, Special lavender with a rainbow hairline. Special pins animate (≤ 4 on screen). Achievements without a ribbon keep the trophy. |
| **Panel header** (`MOCK:profile.html:175`) | "171 medals · 150 **mode** ribbons". Three things say "ribbon", so each count names its kind. |
| **Honor Ribbons strip** (new, under the pins) | **Own:** a dark navy strip 36 px tall: "HONOR RIBBONS **15**/24", 7 latest ribbons at 26 px (static), "Ribbon Case ›". **Visitor:** "HONOR RIBBONS **19**" only if the optional card field `st.h` is adopted (ECON §6.3); otherwise the strip is hidden for visitors. |
| **Freeplay Records chips** (`SPEC:202`) | Keep the freeplay titles and frame chips, and add **"All titles 15/37 ›"**. Listing every earned title there (as SPEC reads today) would be 37 chips. |
| **Edit Profile → Title** (`SPEC:214`) | **"None" first, then three groups** with spaced-caps headers and counts: **PRISM · RAREST 2/7**, **GOLD 6/13**, **STANDARD 7/17**. **Plates:** earned ones are full colour; locked ones are greyed with a small padlock, and tap shows "How: …". The equipped one has a cyan bracket and a green ✓. **Filter:** All / Earned. **Live preview** card on the right (PC). A **pink dot** on the nav item while `earnedTitleCount > counters['ach:seenTT']` (ECON §7.2's "seen" pattern, here split per kind). Copy: "Titles come from achievements. Nothing you buy gives a title." |
| **Pin picker → Achievements tab** (`SPEC:191-193`) | Shows the ribbon art. Order: specials, shinies, plains, then titled achievements without a ribbon. `a_pulls_*` and `a_reroll_10` are never listed. |
| **Viewer of an older build** | An unknown `ach:` pin shows ECON §6.3's neutral plaque ("A newer trophy · update to see it"). A known id whose `fx` this viewer lacks shows the static art. |

**Motion on the profile:**
- up to 4 special pins;
- the title plate (2 layers);
- the approved mock's own UR letter shimmer. That shimmer is what costs; see §2.5 for the recommendation.

### 4.7 Other touch points

- **Battle results** (`src/ui/battle/results.js:348`, next to the freeplay milestone lines): "★ 2 achievements ready ›", with up to 3 ribbon minis at 22 px (static). It never auto-claims.
- **Lobby:** dots only, as today (`src/ui/screens/lobby.js:37-50`, `:375`, `:529-536`). Locked rows don't count (ECON §7.2).
- **Lobby level badge** (`lobby.js:328`): the profile spec moves it to the Profile (`SPEC:71`). The Profile's strip and Edit Title link back to the Achievements tab and Case.
- **Backpack:** gear box "Where to get" shows "Achievements (n)" (ECON §7.3).

---

## 5. Visual style and tech accents

**The base is the game's existing look:**
- white glass panels, the blue → white headers with a yellow underline (`base.css:137-150`);
- slanted pills and plates (`--skew: -8deg`);
- italic navy Nunito headings;
- the item tiles, buttons and tabs from `base.css`.

The mock loads the real `base.css` and `ur.css`.

**Tech accents** (sleek and subtle, in the owner's direction):

| Accent | Where |
|---|---|
| **Cyan corner brackets** `.tk` (`--tech: #4fc3ff`, 10 px arms, 1.5 px) | selected case cell, detail stage, fanfare stage, rail Case card, the equipped title in Edit Profile |
| **Spaced small-caps labels** `.tl` (0.6 rem, 0.14 em tracking) | "READY TO CLAIM", "ACHIEVEMENT COMPLETE", "HR-17", "EFFECT" |
| **Segmented meter** (10% ticks) | header completion bar |
| **Faint 24 px grid and glass ledges** | the Case |

**Classic/Tactical toggle hook.** All accents hang off two tokens and two classes:
- `html[data-ui="classic"]` hides the `.tk::after` brackets;
- it sets `.tl { letter-spacing: 0.02em; text-transform: none }`;
- it drops the Case grid.

Nothing else changes, so the toggle costs one CSS block.

**Colour tokens:**
- `--cls-plain: #6fb6f2`, `--cls-shiny: #f2b705`; special uses `--ur-rainbow` (`ur.css:13`);
- tech `--tech: #4fc3ff`, `--tech-ink: #1d6fb8`, `--tech-dark: #18233f`.

---

## 6. Accessibility and kid-safety

- **Reduce Motion:**
  - every effect has a designed rest frame (§2.3);
  - the fanfare, toast and pops become instant;
  - the Prism title ring and sweep stop;
  - verified: 0 running infinite animations from honors and 1.2 ms/s (`mock/shots/sheet-fx-reduced.png`).
- **Photosensitivity:** Thunderclap at ≤ 2 small, low-contrast flashes per 3.6 s. No full-screen flash anywhere, including the fanfare (its rays fade, they don't flash).
- **Colour-blind safe:** class by **shape** (tails, rings, halo) and a text pill. Ready state by a yellow bar **and** a "Claim" button. Locked by grey **and** a padlock.
- **Tap targets ≥ 32 px on phone.** Chips are 30–38 px high and buttons 32 px.
- **No pressure loops:**
  - no time-limited or seasonal ribbons in v1;
  - attendance ribbons count days visited, never streaks;
  - no ribbon, title or pin for spending, recruit counts or duplicates;
  - no friend-count or message goals.
- **Copy:** short, plain and positive: "Claim after stage 2-1", "Counts from v0.1.N" (so nobody thinks progress was lost), "Nothing you buy gives a title."

---

## 7. Build notes

### 7.1 Files

| File | What |
|---|---|
| `src/art/honors.js` (new) | `HONOR_ART`, the 24 emblems, the three silhouettes, `honorSVG(id, opts)` with per-instance gradient ids, and `installHonorMasks()` (sets the `--rbm-*` vars once at boot). Port of `mock/js/ribbons.js`. |
| `src/ui/honorFx.js` (new) | `ribbonEl(id, px, opts)` (picks the size tier and the effect layers) and the governor `liveHonors(root, { budget, prio })`: IntersectionObserver, modal-open drop, `document.hidden`, both reduced-motion sources, case spotlight rotation, the `.reveal` pass for shinies. |
| `src/ui/styles/honors.css` (new) | `mock/css/ribbons.css` (effects, rest frames, the guarded live block) + `mock/css/titles.css` (plates) + the `.ac-/.act/.ff-/.cm-/.hc-/.hd-` rules from `mock/css/ach.css`. |
| `src/ui/screens/commissions.js` | `achievementsView` rewritten as `achievements/list.js`, `case.js` and `fanfare.js`. Categories, series, sections, chips, testids, chunked rendering, `view=case`. |
| `src/ui/components.js` | `toast()` gets a node form (`kind: 'ach'`), or a new `achToast()`. |
| `src/ui/screens/stage.js` | `showRewardsModal` unchanged; the strips go through `extra` (`:162-174`). |
| `src/audio/economy.js` + `tests/audio/*` | `'achievements-special'` (ECON §7.4). |
| Profile build (`src/ui/profile/parts.js`, `profile.css`) | Tier plates, honor plaques, the strip, Edit → Title grid (§4.6). |
| `src/systems/honors.js` (ECON §6.2) | `earnedHonors`, `earnedAchievementTitles`, plus `titleTier(a)` and `honorCounts(p) = { plain, shiny, special }`. |

### 7.2 Tests to add (cosmetics side; ECON §8 covers economy and integrity)

**Unit tests:**
- Every `honor` def has an `HONOR_ART` entry and vice versa.
- `no` is unique, 1..N, and append-only (a frozen fixture).
- Every `emblem` exists.
- Every `fx` is in `HONOR_FX`. Specials have a non-null fx; plain and shiny have null.
- **8 specials and 8 distinct fx values.**
- `cls` is one of the three.
- Every `title.tier` is one of the three. Title text ≤ 24 characters and unique. Every title id passes `^[a-z][a-z0-9_]{0,23}$`.
- No `honor` or `title` on `a_pulls_*`, `a_units_all` or `a_reroll_10`.
- No special is `hidden`.

**Governor tests** (jsdom with a stubbed IntersectionObserver):
- never more than `budget` `.live`;
- 0 under `data-reduce-motion`;
- 0 while a modal is flagged open.

**e2e** (`e2e/achievements.mjs`, both viewports, extending ECON §8):
- running infinite animations ≤ 6 on the list, ≤ 4 in the Case, ≤ 6 on the profile excluding `.ur-text`;
- 0 honor animations under `data-reduce-motion`;
- no horizontal overflow;
- the fanfare appears for a special and is skippable;
- `ach-claim-all` → the modal shows the New Honor Ribbons and New Titles strips.

---

## 8. What each class and screen costs (summary)

| Thing | Ongoing cost | Notes |
|---|---|---|
| Plain ribbon | 0 | static SVG |
| Shiny ribbon | 0 (one 1.1 s pass when first seen) | |
| Special ribbon, live | about 1–2 ms/s each, 0 style, 0 layout | ≤ 3–4 live per screen |
| Prism title (equipped) | about 0 paints | ring + sweep on transform |
| UR letter shimmer (existing) | **about 200 ms/s on this rig** | not part of this design; see the §2.5 recommendation |

---

## 9. Reconciliation with `design-economy.md`

| Topic | ECON | This design | Why |
|---|---|---|---|
| Ribbon count | 41 (34 new + 7 retrofit), 5 shared looks | **24, all with unique art** (10 / 6 / 8) | Unique art makes each one memorable and a gallery worth filling; about 12 identical blue ribbons would be wallpaper. |
| Ribbons dropped (19 placements) | `a_quad_10`, `a_sakura_20`, `a_csak_1`, `a_bountyg_15`, `a_boss_gold_3`, `a_dragon_4`, `a_lv40_10`, `a_lv60_5`, `a_stars_25`, `a_gear_leg`, `a_box_25`, `a_salvage_100`, `a_kills_100k`, `a_wins_500`, `a_fp_seasons`, `a_daily_100`, `a_perfect_1`, `a_mr_400`, `a_awaken_5` | These keep their gems, boxes and titles, and show a category icon | Nothing is shipped yet, so dropping costs nothing. Grind steps (`a_box_25`, `a_salvage_100`) stop granting a collectible. Series middles stop diluting their capstones. |
| Specials | 8 on 4 shared effects: prism ×2, sakura ×2, starlight ×2, sunrise ×2. Includes `a_gold_40` and `a_bestiary_100` | **8 with 8 different effects.** `a_gold_40` and `a_bestiary_100` become **Shiny**. **New specials:** `a_ur_1` (Prism, the UR rainbow) and `a_fp_crimson` (Ember). **Re-themed:** `a_quad_40` prism → Sunrise, `a_boss_sak_3` sunrise → Thunderclap, `a_login_365` sakura → Aurora, `a_mr_800` prism → Holo Foil | The owner asked for "cool effects": one effect per special makes each one a reason to chase it. Rainbow belongs to UR, as the orchestrator asked. ECON's cap (specials ≤ 8) is kept. |
| **Proposed achievements** (cosmetic-first) | none | **`a_ur_1` "Rainbow Bright"**: own an SSR student at ★5 (UR; the metric counts SSR units with `awaken >= 5` in systems, not `src/ui/rarity.js`). **`a_fp_crimson` "Under the Crimson Moon"**: `missions.counters['fpm:crimson:matriarch']`, or the legacy string 'Crimson Slayer'. Both retro, **0 gems, 1 Radiant box each**, `cat` students / freeplay. `a_fp_crimson` grants **no new title** (Crimson Slayer already exists). | Radiant at launch goes 16 → 18 (cap 20). The late save gets +1–2 Radiant on update day and 0 gems. Gem totals are unchanged. |
| Titles | 36 | **37** (+ "Rookie Sentinel" on `a_first_win`), "Starry-Eyed Sensei" → **"Stargazer Sensei"**, plus the tier field | §3.3 |
| Data shape | `honor: { look, fx }`, `title: 'text'` | `honor: { no, name, cls, fx }` + `HONOR_ART`; `title: { text, tier }`; `series` (UI only) | The art stays client-side; tiers are needed for plates. |
| "Seen" marks | `ach:seen` (one number) | `ach:seenHR` (ribbons) and `ach:seenTT` (titles), both numeric `missions.counters` high-water marks | Separate dots for the Case and Edit → Title. Both survive older builds (`src/systems/save.js:238`). |

---

## 10. Questions for the owner

1. **Ribbon set size:** 24 distinct ribbons (this design), or a ribbon on more achievements with shared looks (ECON's 41)? The art system supports either.
2. **The two proposed achievements:** Rainbow Bright (first UR) and Under the Crimson Moon. Both are cosmetic-first, with 0 gems.
3. **Show the Honor Ribbon count to visitors?** That is ECON's optional `st.h`, and it must be decided before the profile SQL is first pasted.
4. **Freeplay title wording:** keep "Ashwing Slayer" / "Crimson Slayer", or show them as "… Champion"? Only the display text would change.

---

## 11. Files

**The design:**
- `docs/specs/achievements/design-cosmetics.md` — this document.

**Mock pages:**
- `docs/specs/achievements/mock/achievements.html` — `?s=list|toast|fanfare|claimall|case|detail`, plus `&rm=1` for Reduce Motion.
- `docs/specs/achievements/mock/sheet.html` — `?part=set|fx&rm=1`: all 24 ribbons and the 8 effects at 40/64/160.
- `docs/specs/achievements/mock/profile-honors.html` — `?state=own|visit|editt`, generated by `mock/build-profile.mjs` from the approved profile mock (read-only source).

**Mock code:**
- `docs/specs/achievements/mock/js/ribbons.js` — art, effects, governor.
- `docs/specs/achievements/mock/js/app.js` — the screens.
- `docs/specs/achievements/mock/css/` — `ribbons.css`, `titles.css`, `ach.css`, `profile-honors.css`.
- `docs/specs/achievements/mock/items.js` — real item and medal SVGs dumped read-only from `src/art/icons.js` by `mock/_items.mjs`.

**Screenshots, in `docs/specs/achievements/mock/shots/`:**
- `1280x720-{list,toast,fanfare,claimall,case}.png`
- `844x390-{list,toast,fanfare,claimall,case,detail}.png`
- `{1280x720,844x390}-profile-{own,visit,editt}.png`
- `sheet-set.png`, `sheet-fx.png`, `sheet-fx-reduced.png`, `_fx-vs-reduced.png`
- `fxbench.json`

**Scripts:**
- `mock/shoot.mjs` — the mock screenshots.
- `mock/shoot-profile.mjs` — the profile screenshots.
- `mock/shootSheet.mjs` — the ribbon sheets.
- `mock/fxBench.mjs` — per-screen cost.
- `mock/fxIsolate.mjs` — the shimmer isolation.
