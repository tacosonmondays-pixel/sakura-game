---
type: design
category: Design Proposals
tags:
  - design-proposal
  - units
  - rarity
  - abilities
status: proposal
source: "_roster_spec.tmp §5.2 (Tsubaki, Kohaku); GAPS.md §4.1-4.3, §7; ABILITIES_SPEC.md §3, §5.2, §8; wt-abil (v0.1.36 + Potential v3): src/ui/rarity.js, src/ui/styles/ur.css, src/systems/progression.js, src/data/types.js, src/sim/placement.js; docs/specs/POTENTIAL.md, ASCENSION.md, GEAR_AWAKEN.md, NEXT_WAVE.md; ui-condense/STYLE.md"
date: 2026-10-20
game_version: v0.1.36 + Potential v3
aliases:
  - Duo and LR
  - Kohaku & Tsubaki
---

# Kohaku & Tsubaki: the duo unit and LR

> **Owner, Oct 20:** "Also tsubaki and I forgot the other, the duo unit will be the first unit to go from SSR to UR to LR!!"

**Who "the other" is:** it is **Kohaku**. Tsubaki appears in only one pair picture, `kohaku-tsubaki` (Kohaku on the left, Tsubaki on the right). The other six pair pictures are chika-ruri, ena-kanna, fuu-hana, kaede-suzu, noa-iroha and yoriko-seiran, so no other girl could be meant.

This is a design note. Nothing in any repo was changed. Every number is a first pass, and the bench sets the final ones at the balance check (you asked for balance last).

> [!summary] On one screen
> - **One unit, two girls:** "Kohaku & Tsubaki", title **Prism Battery**. SSR tower. Both girls stand on one round base and cost one slot.
> - **How she plays:** Tsubaki drops aimed star shells anywhere on the map, on the ground only. Kohaku guards the sky up close with a constant beam that pierces enemies and hits flyers. **Together:** Kohaku's prism splits some of Tsubaki's shells into shards of light that land around the target.
> - **Three paths:** Starfall Battery (Tsubaki leads), Prism Corridor (Kohaku leads) and **Refraction ⚡** (the two together). The ⚡ ability is **Prismfall**: a barrage of split shells on a spot you pick.
> - **Getting her:** SSR recruit pool, spark and the SSR Select Ticket, like Tenka. Base price **850 coins**; today's SSR towers cost 600–650 and Tenka 1,800.
> - **LR, recommended path:** first reach **UR** (★5 awakening, as today), then finish her 5-step bond story, **"Starfall Promise"**. Free players can get there; it needs no extra duplicates.
> - **What LR gives:** its own look and a stronger form of her ability. The look is a dark-navy frame with a white-gold edge, one travelling light and a twin-star crest, plus an "LR" sticker. The ability form, **Twin Star**, adds one big final shell. That adds at most about 4% to her damage, and everything else is cosmetic.
> - **LR is not rainbow.** Rainbow stays UR's colour, so LR uses navy and white-gold.

---

## 1. The duo: "Kohaku & Tsubaki · Prism Battery"

### 1.1 How a duo tower plays

- **One unit, one footprint, one price, one upgrade panel.** You place them together, upgrade them together and sell them together. The base is the size of a hero's (0.5 tiles; other girls use 0.42, `src/sim/placement.js:19-21`), so the two of them read clearly.
- **Two weapons, each on its own timer.** Tsubaki's mortar is the main weapon; Kohaku's beam is the second one. This is the same "extra attack on one tower" idea Tenka needs (GAPS P-13), so it is built once and both units use it.
- **Each girl covers the other's weak spot.** Tsubaki reaches the whole map but cannot hit flyers. Kohaku's reach is short, but she hits flyers. Players learn the duo in one sentence: **"Tsubaki takes the far ground, Kohaku takes the sky, and the prism splits the shells."**
- **The combo works from the moment you place them,** not only after upgrades (GAPS counts a girl as unique only when her base kit is).

### 1.2 Base kit (first-pass numbers)

| Part | What it does | Numbers |
|---|---|---|
| **Tsubaki's star shells** (main weapon) | She fires at her aim point. A warning ring appears, and the shell lands 1 s later. Without an aim point she aims ahead of her current target. | 12 damage, a volley every ~2.9 s (rate 0.35), splash 1.1, whole map, **ground only**, blast |
| **Kohaku's prism beam** (second weapon) | A constant line beam that pierces enemies in a row: it stays on while she has a target in reach and deals a damage tick every 6 steps (0.1 s), each tick 6 / beamTicks(rate) of one flash, so the DPS is the flash beam's (`src/sim/duo.js`, Oct 28). Each beam holds its own enemy. | 5 damage, rate 0.7, range 3.6, pierces 4, **hits flyers**, mystic |
| **Refraction** (the duo trick) | Every **4th** shell passes through Kohaku's prism and splits into **3 shards**. The shards land in a small fixed triangle around the spot. | each shard 40% of a shell, splash 0.6, mystic, also hits flyers |

The shards are light, so the duo deals **two damage types** (blast and mystic). That suits the Foundry Titan, which is weak to both (ASCENSION §C.1).

### 1.3 Three paths

The usual rule holds: only one path can go above tier 2 (`src/sim/mods.js` crosspath rule). Prices sit inside today's windows (T2 ≤ 450, T3 ≤ 1,400, T4 ≤ 4,500, T5 12k–36k), so they need no special price exception.

| Path | Who leads | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| **Starfall Battery** (more and bigger shells; elites and bosses) | Tsubaki | Packed Charges 180: +2 damage | Quick Reload 400: +15% speed | Starfall Battery 1,300: +1 shell per volley, +0.2 splash | Falling Star 4,200: +10 damage, ×1.3 vs elites, breaks barriers | Thousand Star Bombardment 26,000: +2 shells, +30 damage, ×1.4 vs bosses, short stun |
| **Prism Corridor** (beam, flyers, armour) | Kohaku | Polished Lens 170: +1 pierce | Long Focus 380: +0.3 range | Prism Corridor 1,250: +1 beam, ignores 2 armour, ×1.3 vs flyers | Resonant Light 4,000: a beam grows stronger the longer it holds the same enemy (+8% for every old flash interval, up to +60%; a switch starts over) | Grand Spectrum 24,000: +2 beams, +16 damage, pierces 8, silences 1 s on lock-on and every 2 s held |
| **Refraction ⚡** (the two together) | Both | Cut Facets 160: every **3rd** shell splits | Twin Timing 400: shards slow 20% for 1 s | **⚡ Refraction 1,350:** every **2nd** shell splits into 4 shards; **unlocks Prismfall** | Shatterlight 4,300: shards crack armour (−2) and make enemies Brittle (+12%) | **⚡+ Constellation Lattice 28,000:** **every** shell splits into 5 shards, shards +20 damage; **upgrades Prismfall** |

**Awakening passive (★3): Twin Star Bond.** Every split shell makes 1 more shard, and she deals +6% damage.

### 1.4 Her ⚡ ability: Prismfall (one ability, by the ability rules)

| | Value |
|---|---|
| Unlock and upgrade | Refraction tier 3 unlocks it; tier 5 upgrades it (ABILITIES_SPEC §3.1). Ability coins: 850 + 160 + 400 + 1,350 = **2,760**. |
| Kind and scope | burst, aimed, **map-wide**: one cooldown per player, so three duos cannot chain it (ABILITIES_SPEC §3.3). |
| Tier 3 | Tsubaki fires **8 shells over 2 s** at her aim point, or at the densest crowd anywhere if she has none. Each shell hits for **3× her shell hit** (splash 1.15), and Kohaku splits **each** one into 2 shards (1× hit, splash 0.6). Everything hit turns **Brittle +10% for 4 s**. Cooldown **45 s**; it starts ⅓ charged. |
| Tier 5 (Constellation Lattice) | 12 shells, 4× hit, 3 shards each, Brittle +15%. Cooldown **38 s**. |
| LR form, **Twin Star** (§2) | After the last shell, one **Twin Star** shell lands on the same spot: 6× hit, splash 1.6, white-gold. |
| Auto-cast (setting, default Off) | When 6 or more enemies stand within 1.5 tiles of one spot, or a boss is on the road. |
| Before manual aim exists (milestone A6) | She picks the densest spot herself, as every ability does in A1–A5. |

It replaces the two abilities planned for the girls when they were separate: **Fire Mission** (Tsubaki) and **Rainbow Lattice** (Kohaku, ABILITIES_SPEC §5.2). Dropping "Rainbow Lattice" also keeps the word *rainbow* for UR only.

### 1.5 Rarity, how to get her, price

- **Rarity: SSR**, so a full ★5 awakening shows her as **UR** today, with no new code (`src/ui/rarity.js:32-37`). LR comes after that (§2).
- **How to get her:** the SSR recruit pool, a spark (200 recruit points) and the **SSR Select Ticket**, exactly like Tenka. There is no free stage slot (2-2, 4-2 and 6-5 are kept for Azami, Yuzuha and Wakaba). A launch rate-up would change the economy, so it waits for your answer (§3, Q6).
- **Duplicates** give her Essence for Potential, like every girl after Ascension. She gets **one** Potential row (SSR track, kit steps from P2). Suggested P6 capstone: every 8th volley splits completely.
- **Price band:** base **850** (the live window allows up to 900), tiers as in §1.3. She sits between a single SSR (600–650) and Tenka (1,800). **Bench target:** within ±10% of Chika 5-0-2 at equal coins (your SSR bar) and always below Tenka.
- **Material family:** **ember** (Tsubaki's). Only Akane and Sango use ember today, so it is the least crowded family, and the Eclipse Wyrm already drops it. Kohaku's rune is shared by seven girls once the returning girls land (Q8).

### 1.6 How both girls appear

| Where | Look |
|---|---|
| **Battle model** | **Two chibis on one round base**, side by side, each at 85% size so the pair fits. Each girl is her own game-ready Meshy GLB (`kohaku.glb`, `tsubaki.glb` + LOD: the 25-joint game skeleton, five clips each, painted eyes with a per-figure hair guard, FX anchors; `tools/art/src/meshy-oct20/DUO_READY.md`), built through the GLB runtime like any girl's; the duo unit maps to these two files (`src/models/duo.js` `modelIds`), never to a `kohaku_tsubaki.glb`. Tsubaki stands on the left and Kohaku on the right, each turned 12° outward (`DUO_LAYOUT`). The procedural stand-ins in their drawn looks (`DUO_MEMBERS`) remain only as the fallback when a GLB fails to load. The FX read Kohaku's lens and Tsubaki's muzzle from the figure's `userData.anchors.lens` / `.muzzle` (world space). Like the staff heroes, the pair keeps its faces to the battle camera (`src/render/facing.js`). Each plays her own attack: Tsubaki the mortar recoil, Kohaku the staff and beam. When Prismfall is cast, both play `cheer` together. One selection ring goes around both. |
| **Portrait** | **Their existing pair art** (`merge/portraits/kohaku-tsubaki.webp`, 1536×1024). The **card** is a slanted split card: Kohaku's half and Tsubaki's half meet at a −8° seam, which is our own slant shape (STYLE R9). **Bust and thumb** show both faces with the same seam. The **full-figure stand** is the two half-body cut-outs side by side (Tsubaki was already planned as a half-body stand). |
| **Tower bar** | One card, one cost number, and the split thumb. |
| **Battle panel** | One panel with **Overall / Tsubaki / Kohaku** stat tabs, the pattern Chika already uses for Overall / Chika / Drones (`towerPanel.js:181`). Glance view: **SHELL · BEAM · RANGE** and a MORE sticker (STYLE R4). |
| **Name and wiki** | "Kohaku & Tsubaki", one student page, two short bios and two quotes. Her page shows both girls, and the Info tab lists her as "Duo". |

The pair art shows the older fantasy outfits: Kohaku in robes, Tsubaki in a navy officer's coat. Your rule for new girls is school uniforms (OWNER_DECISIONS #3). The planned uniforms are a security-corps cadet look for Tsubaki and a student-council blazer with a lab coat for Kohaku (GAPS §4.2). **Default:** ship with the pair art now. Redraw both in uniforms later, through the same pipeline as Tenka, once you approve Tenka's art test (Q7).

### 1.7 What changes in the plans

- Kohaku and Tsubaki are **no longer two separate units**. Track 5 (`feature/roster-wave`) already builds 9 girls without them. Their solo rows in the roster spec, GAPS §4.1 and ABILITIES_SPEC §5.2 become the duo's.
- The duo needs roster B3's mortar shells, beam and aim point. That code comes from track 5, so the duo is built after B3 lands in the release train, after Tenka ("Tenka first").

---

## 2. LR: a new rarity above UR

### 2.1 What tops out a girl today

| Step | What it takes | What players see |
|---|---|---|
| Level 1 → 60 + gates 1–5 | EXP, family materials, coins | level number |
| **Awakening ★1–★5** | boss crowns + 190 Star Fragments + 770k coins in total (`progression.js:347-353`) | ★ stars; **★5 SSR = UR**: turning rainbow ring + rainbow "UR" (display only) |
| **Potential P1–P6** | duplicates → Essence + coins (Ascension) | P pill, ✦ kit steps, five-petal crown at P6 |
| Gates 6–10 → level 85 | Zenith items, 2 Rainbow Crowns, about 2.2M coins; gate *k* opens at P(k − 4), so **level 85 needs P6** | level 85 |
| Gear | gold → rainbow UR gear (Rainbow Bloom) | rainbow ring on gear |

So rainbow already means four things: UR girls, UR gear, Zenith items and the Rainbow Crown. **LR needs a look of its own.**

### 2.2 Three ways a unit could reach LR

| | **A. Legend Crest** | **B. Bond Story** (recommended) | **C. Legend Gate** |
|---|---|---|---|
| **How** | UR + **P6 + level 85** + 1 **Legend Crest** (new item from Mayhem Titan Trials, 10 shards → 1 crest) | UR (★5) + a **5-step bond story** played with the duo, "Starfall Promise" | UR + P6 + level 85 + an **11th gate** to level 90 (2 Rainbow Crowns + 1 Legend Crest + 500k coins) |
| **What LR gives** | the LR look + Twin Star + a +5% stat step | the LR look + Twin Star (≤ about +4% of her own damage) + the story scenes | the LR look + Twin Star + 5 more levels (about +9% damage) |
| **Can a free player get there?** | Hardly: P6 on a new SSR takes 5 duplicates, so it is mostly for spenders, for months | **Yes**: ★5 needs no duplicates, and the steps are skill and play | Hardly (same as A, plus crowns) |
| **Balance risk** | medium (power on top of the maxed girl) | **low** | high: it moves the level-85 endpoint the Ascension model is built on |
| **Work** | a new item, drop tables, shop rows | missions, counters, 5 short scenes, the LR look | a new gate, items, a balance re-run |

### 2.3 Recommendation

> [!tip] Recommended: B, "Starfall Promise" (with these defaults)
> - **Opens:** when you own the duo at **★5 (UR)**. Her page shows one chip, **"LR 0/5"**; tap it for the five steps.
> - **The five steps** (each plays a short scene of 2–4 lines: they practise together, Kohaku works out the prism angle, Tsubaki times the shot, and they promise to guard the academy's night sky):
>   1. **First Light:** win 3 battles with the duo placed.
>   2. **Clear Skies:** defeat 300 flying enemies with the duo.
>   3. **Mark the Spot:** cast Prismfall 30 times.
>   4. **Same Stars:** be the battle's MVP on a Hard or Nightmare stage.
>   5. **Starfall Promise:** beat any titan on Nightmare or higher with the duo placed, in solo. If Titan Trials is not live yet: clear 8-5 on Nightmare with the duo placed.
> - **Rewards:** the scenes, then **LR** at step 5. No gems or items, so the economy does not change.
> - **Co-op:** steps 1–4 also count in co-op when the duo is yours. Step 5 counts only in solo, because co-op never unlocks things (the co-op rewards rule).
> - **Later:** LR opens for other SSR girls one at a time, each with her own bond story. The duo is the only LR unit at launch.

### 2.4 What LR gives

| Kind | What | Power? |
|---|---|---|
| **Look** | The LR frame and label everywhere her card appears (the same places as UR: students, her page, formation, stage prep, the battle bar and panel, unit sheet, profile showcase, lobby pickers) | none |
| **Ability form** | **Prismfall: Twin Star**: a big white-gold finishing shell, and the barrage turns white-gold | **small**: capped at about +4% of her own damage over a wave, checked on the bench |
| **Aura** | A faint starlight ring under their base, and star trails on the shells | none (visual only) |
| **Moment** | The **"LR!"** fanfare (§2.5) and a duet voice line on the first Prismfall of each battle | none |
| **Profile** | A **Nightglass** avatar frame unlock, and the LR edge on her showcase slot | none |

If you would rather have LR be pure show, like UR, set Twin Star to visual only (Q4). Then LR changes nothing in battle at all.

### 2.5 How LR shows in the UI (and how it differs from UR)

| | **UR** (live) | **LR** (new) |
|---|---|---|
| Frame | a turning rainbow ring and three coloured glints | **Nightglass:** a dark-navy edge (`#0e1930`, the ink-plate navy, never black), a thin **white-gold line** inside it, **one comet light** that travels around the frame, and a **twin-star crest** at the top centre (two overlapping four-point stars, one gold and one white) |
| Label | "UR" in rainbow letters on a dark pill | **"LR"** in white-to-gold letters on a **navy sticker** tilted −4° with a 2 px outline (STYLE R9) |
| Flat colour (sorting, small chips) | violet `#b78bff` | gold `#ffd27a` on navy `#0e1930` |
| Motion | the ring spins (4.5 s) | the comet does one lap every 6 s, **on big frames only** (her page, the unit sheet, the reveal). Grids and the battle HUD stay still. With reduced motion, the comet rests at the top-right corner. |
| Sort order | above SSR | above UR |
| Unlock moment | "Awakened" | **"LR: Starfall Promise"**: the two halves of the pair art slide in from both sides and meet at the slanted seam, the crest stamps on (a 240 ms sticker slap), and "LR" fills white to gold. Under 1.2 s, and it never blocks taps (STYLE R14). |

**Not confused with SR or gold gear.** SR's label (`#ffc94d`) and Legendary gear (`#ffb627`) are flat gold on a light card. LR is always **on navy, with the crest**, so its shape and plate tell it apart, even for players who see colours differently.

**It fits the UI cleanup you asked for** (condensed and easy to read):
- the LR sticker **replaces** the rarity label instead of adding a badge;
- LR adds **no numbers**;
- the bond story is **one chip** ("LR 3/5"), with the list one tap away;
- at most one moving thing per screen;
- text is never smaller than 12 px.

### 2.6 Why the duo is first

1. **You chose it.**
2. **A duo is the natural home for a bond story:** a legend the two girls earn together. The twin-star crest is literally two stars, Tsubaki's star and Kohaku's light.
3. **She is brand new.** Nobody has maxed her yet, so no player suddenly falls behind. The LR rules and look also get tested on one unit before other girls get LR.
4. **One update:** a new unit changes the co-op version anyway, so Twin Star's small battle effect ships in the same change at no extra cost.

### 2.7 Rules that keep it safe

- **The look is display only,** like UR: gacha rates, pity, shop prices and the battle never read it.
- **Twin Star travels in the co-op loadout,** like Potential, so your partner sees the same battle. It needs no second co-op bump beyond the duo's own.
- **Balance guard:** levels are never tuned on LR stats, and the "UR_LATE never beats the Eclipse Wyrm" rule (GEAR_AWAKEN R22) also covers LR.
- **Saves:** additive only. One `lr` flag per girl, mirrored in `missions.counters`, plus the step counters. No save-version bump. An older build cannot take LR away.
- **Profile card:** showing LR to other players needs one small change to the profile server's rule, the same kind as rainbow gear's (GA R19). You would paste one SQL change.

---

## 3. Questions for you (each has a default, so nothing waits)

| # | Question | Default |
|---|---|---|
| 1 | Is the duo the only form, or should Kohaku and Tsubaki also exist as solo units later? | **Duo only:** one unit, one slot. |
| 2 | Name and title: "Kohaku & Tsubaki · **Prism Battery**", with the ability **Prismfall**? | **Yes.** |
| 3 | How is LR reached: A (Legend Crest), **B (bond story)** or C (Legend Gate)? | **B: UR + "Starfall Promise", 5 steps.** |
| 4 | Does LR give a little power (the Twin Star finishing shell, ≤ about +4%) or only looks? | **A little power** (Twin Star), plus the look. |
| 5 | Will LR open for other girls later? | **Yes, one SSR at a time**, each with her own bond story. The duo is the only LR unit at launch. Heroes come later. |
| 6 | How is the duo obtained? | **SSR pool + spark + SSR Select Ticket.** No rate-up until banners ship. |
| 7 | Art: the existing pair art now, school-uniform redraw later? | **Yes.** Pair art and stand-in chibis now; the uniform redraw comes after you approve Tenka's art test. |
| 8 | Which material family? | **Ember** (the least crowded). |
| 9 | The LR look: Nightglass navy with a white-gold edge, a comet light, a twin-star crest and an "LR" sticker? | **Yes.** Rainbow stays UR's. |
| 10 | If Titan Trials is not live yet, can step 5 be "clear 8-5 on Nightmare"? | **Yes.** It switches to the titan once Titan Trials ships. |

---

## 4. For the builder (short)

- **Data:**
  - `units.js` gets one UnitDef (`kohaku_tsubaki`):
    - `kind: 'tower'`, `rarity: 'SSR'`, a new role key `battery`, `materialFamily: 'ember'`, a footprint radius of 0.5;
    - `duo: { members: ['kohaku', 'tsubaki'] }`;
    - a `partner` weapon spec (the beam, mystic, `canHitAir`);
    - the three paths from §1.3.
  - `abilities.js` gets the Prismfall row with an `lr` variant; the Fire Mission and Rainbow Lattice rows are dropped.
  - `potential.js` gets one SSR row.
  - The data tests update the roster count and the rarity totals. The price band needs no exception.
- **Sim (determinism):**
  - **P-18 "twin weapons":** a second behaviour with its own integer-tick timer, ticked after the main one. It shares its code with Tenka's extra attack (P-13).
  - Refraction uses an integer shell counter on the tower (`'snap'` in the battle save) and a **fixed shard-offset table**, like `MORTAR_SCATTER`: no rng, no trig.
  - Twin Star reads `lr` from `unitBattleStats()`, so it is in the co-op loadout.
  - Engines scenario `DUO_START` (refraction + Prismfall + an LR Twin Star): one digest in Node, Bun and Firefox.
  - Report the new sim id. Do not bump `COOP_PROTOCOL` (the coordinator does that once per ship).
- **UI:**
  - `rarity.js` gets the `'LR'` display rule: `def.lr` eligible + ★5 + `units[id].lr`, rank 4.
  - A new `lr.css`, using compositor-only motion like `ur.css`.
  - The towerBar, towerPanel duo tabs (reusing the `chikaPanel` pattern), unitSheet, profile parts and student page get the LR chip and the step list.
  - The fanfare reuses the honor-fanfare shell.
- **Art:**
  - Two GLBs on one base in `src/models`, and a `kohaku_tsubaki` attack-FX style (shells, beam, shards, Twin Star).
  - Portrait crops `kohaku_tsubaki-{full,card,bust,thumb,cut,cut-s}.webp` from the pair art with the slanted seam.
  - Run the GAPS §4.3 originality check on the duo's art.
- **Docs:**
  - A vault note **Kohaku & Tsubaki**.
  - An "LR" row in [[Unit System#Rarities]].
  - The decision in [[Owner Decisions Log]].

---

## 5. Owner decision (Oct 20) — supersedes §2.3

LR is reached by a **Limit Break special stage**, not the 5-step bond story and not a new medal system:
1. Pull the duo (SSR).
2. Max level + ★5 awakening = **UR** (today's system).
3. A **Limit Break** button on her page (only at UR + max level) costs coins + her ember family materials (+ a UR Crown once Titan Trials is live) and opens **"Starfall Trial"**: one special hard stage built for the duo (mixed ground and flying waves; the duo must be deployed; solo; free retries, no energy), with a short bond scene before and after.
4. First clear = **LR**: the Nightglass frame and sticker (§2.5) + the Twin Star finisher (§1.4, ≤ about +4%).
Later units get LR the same way, each with her own special stage. Steps 1–4 of the old bond story can become optional flavour missions; they no longer gate LR.

---

## 6. The long beam and a much stronger duo (owner, Oct 29)

Owner: "can Kohaku and Tsubaki's laser increase to cover a line from one side of the map to the other?" and "also please
make her wayyyy stronger!"

**Long beam** (`src/sim/duo.js`). At **Grand Spectrum** (Prism Corridor tier 5, `duo.edge: 1`) and in the **LR form**
(any build), each held beam still locks onto an enemy *within her reach*, and its line runs on through that enemy to
the edge of the map.
- Inside her reach the beam works as before: her own pierce cap (`nearPierce`), full damage.
- Past her reach, every enemy on the line is hit, up to `PRISM_EDGE_PIERCE` (64). Each of those hits deals the tick
  × `PRISM_EDGE_MUL` (0.03). This keeps the long line a sweep, not a second beam: her crowd DPS moves by a few
  percent, not ×2–3.
- Silence (Grand Spectrum) reaches everything on the line.
- Deterministic: the map-edge clip is `edgeReach` (division only) plus one `Math.sqrt`. There is no trig, no rng and
  no new state, and hits run in order along the line.
- Drawing: past her reach the beam is drawn thinner and dimmer, with a thin white core, out to the map edge.
- Perf: 4 map-long beams on a crowded 6-x map cost about 0.18 ms a step (`tests/sim/perf.test.js`).

**Buff** (`src/data/unitsDuo.js`).
- Base damage 12 → 15 and beam 5 → 6.25 (×1.25). Tiers 1–4 on every path end up about +20–30% stronger.
- Each tier 5 was refitted to beat Kage's best tier 5 by about a quarter or more on both rulers:
  - Thousand Star Bombardment: +30 damage, beam ×60, ×10 vs bosses (shells, shards and beam).
  - Grand Spectrum: damage ×6.4, ×11.5 vs bosses, beam ×11.7, long beam.
  - Constellation Lattice: damage ×36.8 (the shards' flat +20 is added after it), ×2.75 vs bosses, beam ×150.
- The LR form (Prismfall · Twin Star) adds the long beam to every build and ×1.1 damage (`DUO_LR_MUL`). That puts LR
  about 40%+ above Kage.

**Before → after**, as her DPS ÷ the best Kage tier 5. The light bench is the STRONG preset, mean of four configs. r5
is the fully maxed bench, seeds 9/1/2, without and with LR. Each cell is crowd / boss.

| build | light c/b | r5 no-LR c/b | r5 LR c/b |
|---|---|---|---|
| Starfall T5 | 1.36/0.14 → **1.62/2.20** | 1.14/0.06 → **1.74/1.40** | 1.30/0.07 → **2.23/1.88** |
| Grand Spectrum T5 | 0.11/0.01 → **1.28/1.75** | 0.14/0.01 → **1.73/1.28** | 0.18/0.01 → **2.38/1.74** |
| Constellation T5 | 0.03/0.01 → **1.11/1.27** | 0.10/0.01 → **3.32/1.32** | 0.12/0.02 → **4.39/1.77** |
| Starfall T3 | 0.043 → 0.053 crowd | 0.045 → 0.056 | 0.052 → 0.071 |
| Corridor T3 | 0.024 → 0.030 | 0.020 → 0.024 | 0.024 → 0.032 |
| Lattice T3 | 0.015 → 0.018 | 0.012 → 0.015 | 0.014 → 0.019 |

The two rulers disagree about Constellation Lattice, because of how Refraction's shards land: crowds in the light
bench are sparse and crowds in r5 are dense. The values chosen keep the light bench above Kage (1.11). On the dense r5
crowd she lands far higher (3.3). If the r5 figure reads as too much, the knob is the Lattice `beamMul`.

**Abilities.** Prismfall and the Twin Star finale scale with her current damage, as they always have, so they rise
with each path's tier 5. At Constellation Lattice that is about ×46 versus before: roughly 46k a cast, 127k against
a boss. The rulers above are her attack only, without casts. The coordinator asked for Prismfall to rise "in
proportion"; this is proportion to her own tier damage.

**Edge cases that differ from the old beam (all deterministic):**
- A beam skips an enemy that died earlier in the same tick before it counts toward her pierce.
- Far hits draw crits from the shared rng, so which near hits crit can differ from a beam without the edge.

## 7. A map-wide laser and stronger LR forms (owner, Oct 30)

Owner: "Duo unit laser drill doesn't hit the entire map, it's limited..", and "LR's should be more op!" (every LR form:
the duo's Prismfall · Twin Star and Tenka's Critical Mass · Event Horizon).

**What was limited** (§6): a beam only locked onto enemies in her short reach (nothing near her, no beam), its line ran
from her through that enemy to one edge, and every hit past her reach was ×0.03.

**The map-wide laser** (`src/sim/duo.js`, `src/sim/towers.js` linePierceInto `back`).
- From **Prism Corridor tier 3** (the tier that gives her a second beam; was Grand Spectrum only) and in the LR form (any
  build), her beams lock on within her reach as before, and every beam left free locks onto an enemy **anywhere on the
  map** (her target mode picks which). With an enemy anywhere on the map her light is on.
- Each line runs **edge to edge**: from the map edge behind her, through her prism and her enemy, to the far edge
  (`beamBack` + `beamLength`, `edgeReach` both ways). It reads as one laser across the board, and hits along all of it.
- Her enemy (wherever it is) and what her short beam would hit (her reach, her own pierce) take the **full tick**, so the
  long beam never hits softer than the short one. Every other enemy on the line takes the tick × `PRISM_EDGE_MUL` **0.08**
  (was 0.03), × `PRISM_EDGE_MUL_LR` **0.25** in her LR form, up to `PRISM_EDGE_PIERCE` 64 enemies (a perf guard).
- Why "free beams anywhere" and not "every beam anywhere": locking every beam by target mode across the map pointed her
  light at the lead enemy far down the road, and her dense-crowd DPS at Prism Corridor tier 3 fell 17–26% (r5 crowd
  49.5k → 36.8–40.9k). Filling only the free beams keeps every hit she had and adds the far ones (52.5k, +6%).
- Why the long beam from tier 3: the owner expects the laser to reach; at tier 3–4 it is a small gain everywhere and a
  fall nowhere (r5 crowd T3 49.5k → 52.5k, T4 57.5k → 61.4k; light T3 1.4k → 1.5k, T4 1.4k → 1.6k; bosses equal or
  up). Starfall and Constellation builds without LR keep the short beam (their beam is a side weapon until LR).
- Drawing (`src/render/attackFx/styles/kohaku_tsubaki.js`): a long beam is drawn at nearly full strength both ways (a
  glow and a white core to the far edge and back through her prism to the near edge), on any held enemy wherever it
  is; seven quads a long beam. 844x390 shots: the three-beam board shows three lasers crossing the map.
- Deterministic as before: division, compares and Math.sqrt only, no rng, no trig, no new state (scratch arrays
  inside one call). `tests/sim/duoLongBeam.test.js` (clip both ways, triggers, free beams anywhere, the short beam's
  full hits kept, LR, silence, plain vs withDetMath).

**LR rows** (`src/data/balance.js` `LR_POWER`, folded into her power row while her battle stats carry `lr: true`; never in
a titan battle). The duo ×1.05 damage and ×1.6 vs bosses (plus her LR line, `PRISM_EDGE_MUL_LR`); Tenka ×3.4 vs
bosses (her rail build's crowd is above the band already), and her `t5` rows below. The 2.5–3× target is a floor (the coordinator, Oct 30): an
axis above it stays where it is or higher. Her UR self and every other girl are untouched; no number falls.

**Before → after**, her DPS ÷ the best Kage tier 5 (`tools/balance/lrBench.mjs`; crowd / boss). Light = the STRONG preset
alone, mean of stages 4-5 and 6-3 × seeds 9 and 1 (benchHit's walking boss: with the map-wide laser she holds it all the
way across the map, so the light boss numbers rise most); r5 = fully maxed with Umeko + Midori, seeds 9/1/2, a held boss.

| build | light no-LR | light LR | r5 no-LR | r5 LR |
|---|---|---|---|---|
| Starfall T5 | 1.58/1.27 → 1.58/1.27 | 1.74/1.40 → **2.49/3.77** | 1.87/1.40 → 1.87/1.40 | 2.23/1.79 → **2.58/3.01** |
| Grand Spectrum T5 | 1.26/1.24 → **1.64/2.02** | 1.38/1.37 → **2.94/3.73** | 2.01/1.30 → **2.17/1.30** | 2.54/1.66 → **3.38/2.79** |
| Constellation T5 | 0.84/0.76 → 0.84/0.76 | 0.91/0.84 → **1.92/2.35** | 3.68/1.31 → 3.68/1.31 | 4.80/1.70 → **5.63/2.85** |
| Tenka Joint Research T5 | 0.10/0.12 | 0.10/0.12 → 0.52/2.45 | 0.44/0.12 | 0.52/0.14 → **2.73/2.76** |
| Tenka Rail Arms T5 | 0.85/0.70 | 0.85/0.70 → 0.85/**2.37** | 2.96/0.67 | 3.58/0.81 → 3.58/**2.75** |
| Tenka Singularity T5 | 0.01/0.01 | 0.01/0.01 → 0.10/2.43 | 0.22/0.01 | 0.27/0.01 → **2.69/2.63** |

- The owner's LR floor (r5, about 2.5–3× on both rulers, every build): the duo's three builds read 2.58–3.38 on a crowd
  (Constellation 5.63: 4.8 before) and 2.79–3.01 on a boss; Tenka 2.69–3.58 on a crowd and 2.63–2.76 on a boss in every
  build. **No unit is lowered**: every
  axis of every build, LR or not, is at or above its value before (the table).
- Grand Spectrum without LR (target 1.3–1.7): light 1.64 / 2.02, r5 2.17 / 1.30. The r5 crowd sits above the target
  because the far beams keep their full hits; `beamMul` 11.7 → 10 (with ×13.5 vs bosses) lands r5 1.86 / 1.33 and light
  1.42 / 2.06, but cuts today's r5 crowd 7%, so it is not taken (no nerfs). The owner can ask for it.
- **Tenka's Joint Research and Singularity builds** (a lab build and a control build) deal little of their own on these
  benches (the lab weapons need girls to join her after her purchase; Singularity's value is its wells and Last Line).
  Their LR form lifts them to the floor with LR-only `t5` rows (`LR_POWER.tenka.t5`, while that path is at tier 5):
  Joint Research ×5.2 damage and ×1.1 more vs bosses, Singularity ×10 damage and ×5.5 more vs bosses.
- **With a full lab team** (`tools/balance/labBench.mjs`: fully maxed Kage 5-0-2, Akane 5-0-2, Yuki 2-5-0, Miko 5-2-0
  and Momo 5-0-2 in her reach before she buys Joint Research to tier 5, both absorbs, then Umeko and Midori beside her;
  ÷ the best Kage T5): without LR 8.43× / 1.60× (crowd / boss); **with LR 52.85× / 37.55×**. Without the `t5.lab` row
  her LR would read 10.16× / 6.56× (already over the floor). Her lab weapons scale with her damage, so the ×5.2 lands on
  the whole lab. Not lowered (the owner's call); reported for the release audit.
- Abilities are not in these numbers (the rulers are her attack only).

**Perf** (`tests/sim/perf.test.js` "the long beam": 4 LR duos at Grand Spectrum, 16 held map-long beams, 200 walkers on
6-3). Outside vitest, median of five: 0.11–0.21 ms a step before, 0.13–0.21 ms after (best 0.083 → 0.128). In vitest:
0.289 ms a step against its 2 ms budget (one run under a full suite at load 15–25 read 2.38 ms, with the untouched
ground-shapes case at 2.60 ms beside it).
