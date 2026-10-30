---
type: design
category: Design Proposals
tags:
  - design-proposal
  - units
  - rarity
  - abilities
  - duo
status: proposal (r2)
source: "main 60ce9cad (v0.1.61, sim be940ecb2087, COOP_PROTOCOL 13): src/data/unitsExpansion.js (Hana, Ruri), src/data/abilities.js, src/data/abilityText.js, src/data/potential.js, src/data/banners.js, src/data/unitsDuo.js, src/sim/towers.js (relay origins, guided shots, chainNext), src/sim/duo.js, src/sim/runners.js, src/sim/strips.js, src/sim/balls.js, src/sim/status.js, src/sim/mods.js, src/sim/Sim.js, src/sim/combat.js, src/sim/enemies.js, src/systems/limitBreak.js, src/ui/battle/snapshot.js, src/render/companionLogic.js, src/models/companions.js, src/models/duo.js; docs/specs/DUO_LR.md, ABILITIES.md, ATTACK_SHAPES.md, BANNERS.md, UNIT_GAPS.md, TRYOUT_DAY.md; feature/balance-r5 (83b72083) docs/BALANCE.md, src/data/balance.js, src/data/powerKit.js; tools/bench.mjs run on main for this note; review r1 (docs/review/ruri-hana-duo/review-r1.md)"
date: 2026-10-30
game_version: v0.1.61
aliases:
  - Ruri rework
  - Ruri & Hana
  - Fox and Falcon
---

# Ruri & Hana: Ruri's fox rework and the fox-and-falcon LR duo

> **Owner, Oct 30:** "can you rework the other girl with the fox to be more unique and interesting maybe combine her with the girl that has a hawk? Another duo unit?? Lr??"
>
> **Owner, Oct 30:** "LR's should be more op!" The current target for LR units is about **2.5–3× the best Kage tier 5, on crowds and on bosses**.

## Changes since r1

Review r1 (`docs/review/ruri-hana-duo/review-r1.md`) was NOT OK: 1 HIGH, 6 MEDIUM, 8 LOW. Every finding is fixed in this revision.

| Finding | What changed | Where |
|---|---|---|
| **H1** The band capped the LR units | The 2.5–3× band is a **floor, never a cap**. The two LR units keep their crowd numbers (the first duo 4.76×, Tenka 3.58× before LR), and the balance work lifts their boss numbers. The new duo clears 2.5–3× on both rulers, and her best crowd build is at least the weakest LR unit's. Q8 now shows crowd and boss numbers for both | summary, §3.6, §3.7, §4; board Q7, Q8 |
| **M1** Files missing from the impact table | Every file each milestone touches, in and out of the co-op graph: `mods.js` (Ruri's `lure` and `prints` blocks, and a duo `pair` block so Kon's bites grow with level, gear and Potential), `Sim.js`, `combat.js`, `enemies.js`, `strips.js`, the duo's row in `potential.js`, `unitKit.js`, CONTRACTS.md, the ability vocabulary and `src/ui/battle/snapshot.js` | §5.1 |
| **M2** The hunting Kon had no rules | Kon's firing point in the sim never leaves his lane spot. Bounding Fox T3 adds +1.0 range, so her bites reach 3.4 tiles from his spot (her real reach is stated). The pounce and the trot home are drawn only, so he can never be stranded | §2.2, §2.3, §2.6, §2.7 |
| **M3** Lures did not back the stall promise | At most 2 lures per walker a wave (minibosses 1). A lure holds the push lock for its whole length plus 1.5 s, and a push-locked walker cannot be lured. Freeplay counts lure tiles against Resolve. A lure interrupts a blink. Lure foxes are strip records, so they inherit the caps, Spike Rain's rule for ability foxes, the positional trigger (shared roads) and the wave-end cleanup. The placement rule is written out. Q3's promise is reworded and backed by a test | §2.2, §2.6, §5.5; board Q3 |
| **M4** Kon's run was undefined | The duo has no `relay`, so Kaze fires from her base and Kon's spot is stored apart. The section gives his stretch, when he runs, the run, his return, shared roads (Marumi's rule, built into `runners.js`) and Wind Chase's lane, with a picture | §3.2, §3.4 |
| **M5** Two battle-save gaps | A pre-rework Ruri whose Star Falcon or Tide Otter is above tier 2 takes the existing full-refund drop (a kit mark on her row). Every new timer resets at the wave clear or rides the duo's `du` row, and every new field is classified in `src/ui/battle/snapshot.js` | §5.4, §5.5 |
| **M6** "Field Trip" is reserved | The banner is renamed "Fox and Falcon Premiere" ("Field Trip" is kept for a future mode, `docs/specs/TRYOUT_DAY.md:1451`) | §3.9, §5.3; board Q9, Q15 |
| **L1** Ambiguities | Statuses use the standard status timer. Wind Chase's Auto is Prismfall's `cluster` rule, and a cast is refused with no walker on Kon's stretch. Sure Grip is +1 stoop damage. The pop's timing is defined. Kaze's stoop flies at a fixed speed | §2.2, §3.2, §3.4, §3.9 |
| **L2** Names on other girls' words | "Daybreak" (Hikari's dawn) → **Paw and Feather**, with the finale **Great Stoop**. "Kindred Companions" (Kindred Essence) → **Trusty Pair** | §3.3, §3.5; board Q6, Q15 |
| **L3** Board and spec disagreed | The same lure times (1.5–3 s), locks and before-LR floors in both. Q4 says "no job falls" and that the Tide Otter build becomes a boss build | board Q3, Q4, Q7; §2.1 |
| **L4** Art and keys | "Default all" is not a yes for spending Anlas. Meshy is offered beside Tripo. Keys go in as environment secrets, never in chat | §5.2, §5.7; board Q13, Q14 |
| **L5** Process | R2 takes the full gate. Every milestone has its patch note. The held duo is never announced early (D2 rides D3) | §5.6 |
| **L6** Tests and display numbers | The Tryout golden and the Tryout ceiling gate with `T_ruri`, round 5's Power refit (`ruri: 2.08`) and a factor for the duo or none, and a mid-wave checkpoint test | §5.5 |
| **L7** The gift | Worked out from what players own, at load and on every new girl, so players who already have both get it at once. The title is **Fast Friends**, which fits the bio | §4, §5.4; board Q11 |
| **L8** Wording | Kon's spot moves when a reach tier is bought; the first duo's partner factors were ×11.7–×150 | §1.1, §3.6 |

---

**Who is who.**
- Luna, the Moonfox Oracle, has fox ears and a tail. The *other* girl with a fox is **Ruri** (SR tower, gacha), whose holo fox is **Kon**.
- The girl with a hawk is **Hana** (R tower, free after 7-5), whose falcon drone is **Kaze**. Game text calls him a falcon, and so does this note.
- Luna owns the moon and foxfire motifs (her quote is "Foxfire, rise."), and Hikari owns the dawn, so the new names below avoid all three.

This is a design note. Nothing in the game changes on this branch. Every number is a first pass; the bench sets the final ones. The decisions only the owner can make are on `docs/review/ruri-hana-duo/OWNER_BOARD.md`.

> [!summary] On one screen
> - **Today:** Ruri is a plain shooter whose bolts leave a fox who never moves. Two of her three ⚡ are still teasers (the last two in the game). Her Star Falcon path is a weaker copy of Hana: 0.03× the best Kage tier 5 on a crowd and 0.05× on a boss. Hana is a flyer archer whose falcon is mostly decoration.
> - **Ruri's rework (free for everyone who owns her):** Kon becomes the point of her kit.
>   - **Bounding Fox:** Kon leaves his spot to bite, a tile further than before.
>   - **Fox Tricks:** holo lure foxes lead the fastest walkers back up the road.
>   - **Paw Prints:** prints count up on one enemy until Kon leaps out of cover (her boss path).
>
>   Moon Pounce stays; **Follow the Fox** and **Spirit Fox** replace the two waiting ⚡. Nothing in her kit touches flyers, grounding, Veil Sight or birds.
> - **The duo:** **"Ruri & Hana · Fox and Falcon"**, a new LR unit (SSR → UR at ★5 → LR through Limit Break). **Kon runs the road and flushes walkers out of cover; Kaze stoops from the sky on whatever Kon startles, and every flyer Kaze knocks down lands in front of Kon.**
> - **Duo paths:** High Stoop (Kaze leads), Fox Run (Kon leads), and **Flush and Stoop ⚡** (both), which unlocks **Wind Chase**. The LR form is **Paw and Feather**.
> - **Power, a floor and never a cap:**
>   - before LR, at least 1.3× the best Kage tier 5 on her main job and 1.0× on the other;
>   - in LR form, at least 2.5× on crowds and on bosses for every tier-5 build, with her best boss build at least 3×;
>   - her best crowd build is never the weakest LR unit's (the other two read about 4.3× and 4.8× on crowds today).
> - **Getting the duo:** her own LR Banner, "Fox and Falcon Premiere" (7 days at 0.7%, Legend Promise at 300, never sparked), with SR rate-ups Ruri, Chigusa and Marumi. Price 850, family feather.
> - **Recommendation:** do both. **Ruri's rework first** (one co-op update after balance round 5), **then the duo** (her sim held first, then her art and her premiere together). Solo Ruri and Hana stay, with every bit of progress.

---

## 1. Today

### 1.1 Ruri: Library Club Holo-Summoner (SR, gacha only)

**Base kit** (`src/data/unitsExpansion.js:318-375`):
- Cost 400, 7 mystic damage, 0.9 attacks a second, range 2.4; hits flyers.
- Kon, a holographic white fox, sits at the edge of the nearest lane: on the line from Ruri to the nearest visible road point, 0.7 tiles short of it and at most 3.5 tiles from her. This is her relay origin (`relayOrigin`, `src/sim/towers.js:1416`; `FAMILIAR_STANDOFF`, `src/sim/constants.js:229`).
- Every bolt leaves Kon, and her range ring is centred on him.
- The display has him bound out to that spot and sit there (`src/render/companionLogic.js`). In the sim his spot moves only when she is placed or upgraded: the reach tiers, River Paws and Tide Otter T3, move it (`updateRelayOrigin`, `towers.js:1439`). It never moves to follow a fight.

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Moonhound** (ground familiar) ⚡ Moon Pounce | Sharp Fangs 130: +1 damage | Twin Bite 300: +1 bite | Moonhound 950: splash 0.5, shred 1 armour 3 s | Silver Pack 2,800: +1 bite, +8 damage, +0.3 splash | Moon Wolf Alpha 20,000: +26 damage, +0.4 splash, 20% of bites stun 0.4 s |
| **Star Falcon** (air familiar) ⚡ Star Snatch, *waits* | Sky Perch 120: +0.3 range | Swift Wings 280: +15% speed | Star Falcon 900: ×1.5 vs flyers, Veil Sight | Starlit Talons 2,700: grounds flyers 2 s, ×1.3 vs flyers, +4 damage | Constellation Raptor 18,000: +24 damage, +40% speed, ×1.2 vs flyers, +1 bolt |
| **Tide Otter** (reach and water) ⚡ River Rush, *waits* | River Paws 140: Kon +0.6 reach | Splash Play 320: soak 2 s | Tide Otter 1,000: Kon +0.8 reach, slow 20%, push 0.1 | Riverkeeper 3,000: water, +4 damage, slow 30% 1.5 s | Great Otter Spirit 21,000: +22 damage, splash 0.8, +30% speed |

- **⚡** (`src/data/abilities.js:468-491`), one per path; the crosspath rule lets only one unlock:
  - **Moon Pounce** (live): Kon leaps from his spot at the strongest enemy within her range + 2. He bites 3 times for 8× her hit each, then holds it 1.5 s (never a boss). Cooldown 30 s. Tier 5: 5 bites, hold 2 s, 25 s.
  - **Star Snatch** (waits: a `carry` move the sim does not run): Kon swoops on the leading non-boss enemy and carries it 3 tiles back.
  - **River Rush** (waits: a `river` runner): a wave rolls 4 tiles back along her lane, pushes 1 tile and soaks.
- **Awakening (★3): Bonded Familiar.** +8% damage, and Kon reaches 0.3 tiles further.
- **Potential** (`src/data/potential.js:296-302`): P4 Kon's Pounce, every 6th bolt ×1.6 with 0.3 splash; P6 every 4th bolt ×2.

### 1.2 Hana: Wildlife Club Drone Falconer (R, free after 7-5)

**Base kit** (`src/data/unitsExpansion.js:259-316`):
- Cost 240, 4 pierce damage, 1.1 attacks a second, range 3.8, Air targeting by default.
- Her arrows deal ×2 to flyers and ground a flyer for 1.2 s.
- Kaze rides her shoulder and swoops at every enemy she shoots, flyers first. That swoop is display only: the damage is her arrow's.
- In the sim, Kaze exists only in her Potential procs (P4 Kaze Dive, every 8th arrow ×2; P6, every 6th arrow ×2.5) and in her ⚡.

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Falconry** ⚡ Kaze's Swoop | Sharp Talons 100: +1 damage | Updraft Sense 240: +0.4 range, ×1.1 vs flyers | Talon Dive 700: grounds 2.2 s, ignores 1 armour | Raptor Strike 2,200: +10 damage, ×1.25 vs flyers, ×1.3 vs elites | Sky Sovereign 14,000: +30 damage, ×1.3 vs flyers, +1 arrow, +30% speed |
| **Hunter's Mark** | Recurve Bow 80: +0.4 range | Keen Eye 200: 5% crits ×1.5 | Hunter's Mark 700: hits mark, +12% from everyone 3 s | Hunting Call 2,000: mark +18%, Veil Sight, +4 damage | Apex Falconry 13,000: mark +25% 4 s, +26 damage, ×1.5 vs elites, ×1.3 vs bosses |
| **Rapid Feathers** | Quick Nock 90: +15% speed | Twin Feathers 250: +1 arrow | Feather Storm 600: +1 arrow, +1 pierce | Featherfall Volley 2,400: +2 arrows, +40% speed | Thousand Wings 15,000: +2 arrows, +50% speed, +10 damage, 15% of arrows stun 0.3 s |

- **⚡ Kaze's Swoop** (strike, map scope, 30 s): Kaze strikes up to 4 flyers still in the sky anywhere on the map, for 6× her hit each, and grounds them 4 s. With no flyer up, he takes the 2 strongest walkers instead. Tier 5: 8 flyers, 8×, 25 s.
- **Awakening (★3): Keen Eyes.** +0.3 range and +8% damage.

### 1.3 Where they sit against Kage

Two rulers, the same two DUO_LR §6 used:
- **Light bench.** `tools/bench.mjs` with the STRONG preset (L60, ★3, gear ×1.45, 25% crits), stage 4-5, seed 9, partner Aoi, run on `main` 60ce9cad for this note. This is one configuration, not the mean of four. Review r1 re-ran it and got the same ratios.
  - Crowd: an Orc Grunt every 0.1 s that never dies.
  - Boss: the Ashwing Matriarch walking the road. She is healed every step, so she never reaches her flying phases.
- **Round 5's maxed bench.** `tools/balance/r5Bench.mjs` on `feature/balance-r5` (its `docs/BALANCE.md`).
  - Every girl at L85, ★5 and P6 in UR gear, with UR Resonance on and Umeko and Midori beside her.
  - The boss is held in her reach; the late crowd is an Orc Grunt every 0.5 s.

**The best Kage tier 5** (Thousand Shadows, 5-0-2):
- light bench: 44.1k on a crowd, 8.4k on a boss;
- round 5's bench: 1.82M on a crowd and 1.97M on a boss today; 1.83M and 2.22M with round 5.

| Build (coins) | Light: crowd ÷ Kage | Light: boss ÷ Kage | Tier 3, crowd / boss DPS |
|---|---:|---:|---|
| Ruri, Moonhound 5-0-2 (25,040) | 0.89 | 0.03 | 1,558 / 32 |
| Ruri, Star Falcon 2-5-0 (22,830) | **0.03** | **0.05** | 134 / 38 |
| Ruri, Tide Otter 2-0-5 (26,290) | **1.95** | 0.02 | 108 / 33 |
| Hana, Falconry 5-0-2 (17,820) | 0.03 | 0.25 | 62 / 65 |
| Hana, Hunter's Mark 2-5-0 (16,560) | 0.005 | 0.07 | 29 / 35 |
| Hana, Rapid Feathers 2-0-5 (18,920) | 0.06 | 0.21 | 191 / 93 |
| *Kohaku & Tsubaki, best tier 5, no LR* | *1.65* | *2.17* | |
| *Tenka, best tier 5* | *0.84* | *0.73* | |

| Round 5's bench, best build | Crowd: today → with round 5 | Boss: today → with round 5 |
|---|---|---|
| Ruri | 2.69M (1.48×) → 3.16M (1.73×) | 104k (0.05×) → 1.02M (0.46×), with her row `boss ×9` |
| Hana | 231k (0.13×) → 1.37M (0.75×) | 322k (0.16×) → 1.91M (0.86×), with her row `dmg ×5.45` |
| Kohaku & Tsubaki at LR | 7.99M (4.39×) → 8.71M (4.76×) | 3.70M (1.88×) → 3.94M (1.77×) |
| Tenka (not LR on this bench) | 6.05M (3.32×) → 6.55M (3.58×) | 1.67M (0.85×) → 1.80M (0.81×) |

**Reading.**
- Ruri is a crowd girl (Tide Otter's splash, Moonhound's bites) with almost no boss damage on any path.
- Hana is a boss and flyer girl with no crowd.
- Round 5 lifts both into its band. Ruri's boss factor (×9) is the largest of any splash girl's. The round does not change what either girl does.

### 1.4 What feels plain about Ruri

1. **Kon is a moved muzzle.** He runs to a spot on placement, then only marks where her bolts start. He touches an enemy only when Moon Pounce is cast, and only on one path.
2. **Her "three familiar forms" are names.** Kon looks the same on every path. Only a small hit flourish differs at tier 3: a bite slash, a feather flick or a ripple (`src/render/attackFx/styles/ruri.js`).
3. **Two of her ⚡ are teasers.** v0.1.61 told players "only Ruri's Star Falcon and Tide Otter paths still wait for theirs", and her Tree tab shows the same ⚡ sticker on both waiting paths (a v0.1.61 low).
4. **Star Falcon is a dead path:** 0.03× Kage on a crowd and 0.05× on a boss. That is weaker than R Hana's Falconry tier 5, which costs 5,010 coins less.
5. **No answer to bosses** on any path: 0.02–0.05× on both rulers.
6. **The beast-tamer plan never shipped.** UNIT_GAPS §4.1 planned her as the game's beast tamer, with a pet that moves, pounces, grabs and carries. Only the relay origin exists.

### 1.5 Where Star Falcon overlaps Hana

| | Ruri, Star Falcon | Hana |
|---|---|---|
| Job | "Air familiar" | falconer |
| Flyer damage | ×1.5 · ×1.3 · ×1.2 (= ×2.34 at T5) | ×2 from placement; Falconry ×1.1 · ×1.25 · ×1.3 (= ×3.58) |
| Grounds flyers | T4, 2 s | every arrow 1.2 s; Talon Dive 2.2 s; her ⚡ 4 s |
| Veil Sight | T3 ("Kon gains Veil Sight") | Hunting Call (T4, "Kaze's camera") |
| Targeting | her tips tell players to switch her to Air | Air by default |
| A bird | Kon "becomes" a falcon, in name only | Kaze, her falcon drone |
| ⚡ | Star Snatch: Kon swoops on the leader and carries it | Kaze's Swoop: Kaze dives on flyers anywhere |
| Wiki | both are listed as flyer grounders | |

So on a flyer stage, a player who owns both gets nothing from Star Falcon that Hana does not do better and cheaper. Tide Otter does not overlap Hana, but it is an otter, not a fox, and its ⚡ waits too.

---

## 2. Ruri's solo rework: "Kon, the holo fox"

### 2.1 Rules

- **Same girl.** She keeps her id (`ruri`), rarity (SR), role, mystic type, price (400), art, Kon's figure, Potential row, awakening and every save field. Players keep level, gates, stars, Potential, gear and bond.
- **Kon is the point.** Every path changes what Kon *does*.
  - From tier 3 he looks different on each path: lapis blue for Bounding Fox (her name means lapis), a pale-violet flicker for Fox Tricks, soft gold for Paw Prints.
  - Only the holo shader's tint changes; the figure stays the same.
- **Nothing of Hana's.** Her kit has no flyer multiplier, grounding, Veil Sight, bird or map-wide anti-air. Her ordinary bolts still hit flyers, as most girls' do.
- **Nothing of Luna's or Hikari's.** No moon, foxfire or dawn in her new names; the live ability Moon Pounce keeps its name.
- **Every ⚡ runs.** She keeps one ⚡ per path: ABILITIES §3.1 lets her data hold three, and the crosspath rule unlocks one per battle.
- **No job falls.**
  - Her best crowd build is at least today's (Great Otter Spirit).
  - Her best boss build lands in round 5's single-target band.
  - No tier 3–4 reads below today's same-tier best for its job, on either ruler.
  - This is **"no job falls", not round 5's "no build falls"** (`docs/BALANCE.md` on `feature/balance-r5`). Her Tide Otter 2-0-5, a crowd build today, becomes Paw Prints 2-0-5, a boss build. Her crowd job moves to Bounding Fox 5-0-2. Board Q4 puts this to the owner.
- **Kept as they are:** Moon Pounce, Kon's lane spot (reach 3.5, standoff 0.7), her Pounce procs (P4, P6), and Tryout Day's `T_ruri` talent (+1.0 relay reach, which moves Kon's spot further out, `src/data/tryout.js:324`).

### 2.2 Three paths

| Path (what Kon does) | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Bounding Fox** (was Moonhound): *Kon hunts* · ⚡ Moon Pounce | Sharp Fangs 130: +1 damage | Twin Bite 300: +1 bite | **Bounding Fox** 950: +1.0 range (Kon leaves his spot to bite, up to 3.4 tiles from it); bites splash 0.5 and shred 1 armour 3 s | Silver Fangs 2,800: +1 bite, +8 damage, +0.3 splash | **Lapis Fox** 20,000: +26 damage, +0.4 splash, 20% of bites stun 0.4 s, and a crowd factor fitted on the bench (§2.5) |
| **Fox Tricks** (was Star Falcon): *Kon fools them* · ⚡ Follow the Fox | Far Wander 140: Kon may stand 0.6 tiles further from her | Flicker Step 300: +15% speed | **Lure Fox** 950: every 5 s, Kon sets a holo lure fox in front of the fastest walker in his reach. The first 4 walkers to reach it are **Lured** for 1.5 s | Two-Tailed Trick 2,700: a lure fox every 4 s; lure 2 s; her bolts deal ×1.3 to Lured walkers (they turned their backs); +6 damage | **Hundred-Fox Trick** 18,000: a lure fox every 3 s in front of each of the two fastest walkers, up to 6 walkers each; lure 2.5 s; ×1.5 to Lured walkers; each fox pops when it ends (4× her hit within 1 tile); +24 damage |
| **Paw Prints** (was Tide Otter): *Kon stalks one enemy* · ⚡ Spirit Fox | Fresh Tracks 140: +1 damage | Sniff Out 320: +15% speed | **Paw Prints** 1,000: each bolt leaves a glowing paw print on its target (up to 5; each lasts 4 s, and a new one refreshes them). At the 5th, Kon leaps out of cover: **Trail's End**, 6× her hit that ignores 2 armour; the prints reset | Double Prints 3,000: her bolts leave 2 prints on elites and bosses; Trail's End 8×; +6 damage | **Silent Stalk** 21,000: Trail's End at 4 prints, for 12× her hit; half of it leaps to the nearest enemy within 1 tile and leaves 2 prints there; +22 damage; a boss factor fitted on the bench (§2.5) |

**Bounding Fox: where she looks and how far she reaches.**
- **One targeting rule, the one she has today:** every attack picks her target by her target mode within her range of Kon's lane spot. The spot is `t.ox` / `t.oy` (`volleyFrom`, `towers.js:809`), and her bites start there in the sim.
- **Her reach:**
  - Bounding Fox T3 is a plain +1.0 range, so her bites reach 3.4 tiles from his spot (2.4 today).
  - The spot itself is at most 3.5 tiles from her (3.8 awakened, +1.0 with Tryout's `T_ruri`), so she hits up to about 6.9 tiles from where she stands (7.2 awakened), against 5.9 today.
  - Her ring and the placement ghost keep their centre on the spot (`relayOrigin`), at radius 3.4.
- **The hunt is drawn, not simulated.** On screen, Kon leaps with the first bite of each attack (her bolt style already draws bites from wherever Kon is drawn, `src/render/attackFx/styles/ruri.js` `origin`). He trots back to his spot when he has not bitten for 0.5 s. His point in the sim never moves, so he can never be stranded on another lane or a closed road.
- **Moon Pounce** reads her range ("her range + 2", `fromOrigin`), so with Bounding Fox T3 it reaches 5.4 tiles from his spot (4.4 today). It still leaps from his spot.

**Lure foxes** (Fox Tricks):
- **Where:** on the walker's own road, 0.6 tiles ahead of it.
  - "His reach" is her range around Kon's spot.
  - "Fastest" means current speed, after slows; ties go to the lower uid.
  - If that point is in a tunnel, the fox goes to the first visible point up to 1 tile further ahead. If there is none, or the point is past the road's end, no fox is set this time and the timer stays ready.
- **What they are:** strip records, `sim.traps` entries with `strip: true` and a `lure` block (`src/sim/strips.js`). A lure fox deals no damage. It Lures each eligible walker that reaches it, once, until its budget (4, then 6 at T5) or its 3 s life runs out.
- **What they inherit from strips:**
  - **The positional trigger** (`sim.grid.each` around the fox, `strips.js:252`): a walker on any road over that spot is lured, shared stretches included. A walker in a tunnel never is.
  - **The caps:** her own cap is 2 lure foxes (4 at T5). Follow the Fox's foxes ignore it, by Spike Rain's rule (`strips.js:9-10`). Then `ROAD_OBJECTS_PER_PLAYER` and `ROAD_OBJECTS_PER_SIM` apply, the oldest fox (lowest uid) going first.
  - **Cleanup:** they end at the wave clear and when she is sold.
- **Hundred-Fox Trick's pop:** when a fox's life ends or its budget is used up, whichever comes first, it pops for 4× her hit within 1 tile. The pop never crits (no rng draw) and carries no statuses.
- **The interval timer** (`lureCd`) counts whole steps and resets to its first wait at every wave clear.

**Lured:**
- **Who:** walkers only. Never flyers or bosses, and never anything in a tunnel. Minibosses are Lured half as long.
- **How it moves:** a Lured walker trots back toward the road's START, by path distance, at its own current speed (slows apply), and stops at the start. It can still be hit and stunned. Fast walkers go back furthest, so Fox Tricks answers the runners that leak.
- **How often:**
  - At most **twice a wave** per walker (minibosses once). The count lives on the enemy (`e.lureN`) and goes when it does.
  - At least 8 s between two lures of one walker (minibosses 12 s).
- **No stacking with pushes:**
  - A lure holds the walker's push lock (`PUSH_LOCK`, `src/sim/constants.js:237`) for its whole length plus 1.5 s, so neither Fuu's gusts nor an ability's push moves it while it walks back. These are the two pushes the lock covers today (`PUSH_LOCK_KITS`, `movePush`); ordinary knockback from hits still applies, as it does today.
  - A walker that is already push-locked cannot be Lured.
- **Freeplay:** the tiles a lure walks a walker back count against Resolve's knockback budget (`kbLeft`, `src/sim/enemies.js:185-190`), and the lure ends when the budget runs out.
- **Blinks:** a lure interrupts a blink. `lure` joins `BLINK_INTERRUPTS` (`src/sim/constants.js:40`), so a blinker Lured during its warning does not jump (`enemies.js:300-315`).
- **What this backs:** Ruri can only add a bounded delay to a walker (at most two lures a wave), and a lure never stacks with Fuu's pushes. A wave that ends without her also ends with her. A wave-length test with Ruri T5 and Fuu T5 checks it (§5.5).

**Paw Prints:**
- The prints are an integer stack on the enemy (a `prints` status with `stacks`). Every Ruri adds to the same stack, and the bolt that fills it gets the credit.
- Trail's End is one hit through `_hit`, mystic, fired from the on-hit step (`_onHitEffects`, `src/sim/Sim.js:615`). It never crits (no rng draw) and carries no statuses.
- On screen, Kon vanishes from his spot and leaps at the enemy (the existing pounce clip, `pounceStep`), then trots back.

**Timers.**
- Lured, Startled (§3) and the prints use the standard status timer (float seconds, `src/sim/status.js:124`), like every status.
- Lure foxes, runs and the new tower timers count whole steps.

### 2.3 Her three ⚡

| ⚡ | Kind, scope | Tier 3 | Tier 5 | Auto-cast |
|---|---|---|---|---|
| **Moon Pounce** (Bounding Fox; live) | strike, local | Kon leaps at the strongest enemy within her range + 2: 3 bites of 8× her hit, then holds it 1.5 s (never a boss). 30 s. With Bounding Fox T3 her range is 1 tile longer, so it reaches 5.4 tiles from his spot | 5 bites, hold 2 s, 25 s | ≥ 4 enemies, or an elite |
| **Follow the Fox** (Fox Tricks; new, replaces Star Snatch) | deploy `lure`, local, lasts 6 s | Kon lays 5 lure foxes along her lane, one every tile up the road from his spot. Each Lures up to 4 walkers for 2.5 s, and they ignore her own lure-fox cap. 40 s | 8 lure foxes, lure 3 s, 34 s | ≥ 5 walkers in reach, or a walker past 70% of the road (`orLeak`) |
| **Spirit Fox** (Paw Prints; new, replaces River Rush) | boost, local, 8 s | Kon grows into a great spirit fox: her bolts ×1.6, each leaves 2 prints, and Trail's End splashes 1 tile (a boost ModSet with `prints` riders). 35 s | ×2, 10 s, 30 s | an elite or a boss in reach |

**Ability coins** (placement plus tiers 1–3): Moon Pounce 1,780 (as today), Follow the Fox 1,790, Spirit Fox 1,860.

**What the sim already runs:**
- Boosts already run today (`ABILITY_KINDS_RUN`).
- `lure` joins `ABILITY_DEPLOYS_RUN`.
- The `carry` move and the `river` runner lose their only user and leave the vocabulary.

### 2.4 Why none of it overlaps

| Path | Closest girls | The difference |
|---|---|---|
| Bounding Fox | Kaede (dash and blade arts), Marumi (ricochet ball) | Kon is drawn leaving his spot to bite anything up to a tile beyond her old reach. Splash bites and shred; no ramp, no ball, no moving firing point |
| Fox Tricks | Fuu (push-back), Chigusa (vine hold) | The fastest walkers walk back on their own, at their own speed, twice a wave at most; nobody is pinned. A lure and a push never act on the same walker together, so Fuu keeps her crowd niche and Ruri takes the runners |
| Paw Prints | Midori (poison detonation), Ena (curse bursts), Kanna (focus ramp) | Prints count up on the enemy she keeps hitting, then one big leap. No damage over time, nothing spreads on death, no ramp |
| (all three) | Hana | Nothing in the new kit is about flyers |

The attack-shapes plan suggested a turning star stream or a circling holo pack for Ruri (ATTACK_SHAPES §5.2, §5.5). Those shapes now belong to Kage's Blade Cyclone and Hotaru's Firefly Halo (S1), so this rework uses the road instead.

### 2.5 Targets (on top of balance round 5)

| Build | Job | Today (light bench / round 5's bench) | Target |
|---|---|---|---|
| Bounding Fox 5-0-2 | crowd | light 0.89 on a crowd; her round-5 crowd of 1.73× belongs to Tide Otter | crowd ≥ Great Otter Spirit's today on both rulers (light ≥ 1.95×, round 5 ≥ 1.73×); boss ≈ 0.46× (round 5) |
| Fox Tricks 2-5-0 | control | 0.03 / 0.05 | crowd ≥ 1M on round 5's bench, the band floor (≈ 0.55×). In real-coin runs (`tools/capBot.mjs`, 4-5 and 7-5 Hard, the free team plus her, 2 seeds) she keeps at least as many lives as with Bounding Fox |
| Paw Prints 2-0-5 | boss | light 1.95 on a crowd, 0.02 on a boss | boss 0.86–0.90× Kage on round 5's bench (the single-target band, about 1.9M); crowd ≥ 0.5× |
| every tier 3 | its job | | within ±20% of the SR tier-3 median for its job (light bench) |

**Her round-5 rows are re-fitted with the rework:**
- **The damage row** (`ruri: { boss: 9 }` in `src/data/balance.js` on `feature/balance-r5`). Her boss damage now comes from Paw Prints, so a ×9 on the whole girl would overshoot that build. The kit sets the builds against each other, and the row sets the level.
- **The Power factor** (`ruri: 2.08` in `src/data/powerKit.js` on that branch) is re-fitted from the new measures. Power never drops (`tests/systems/powerKit.test.js`).

### 2.6 What the sim needs (Ruri)

| Piece | How | Files |
|---|---|---|
| Bounding Fox | a plain `range +1.0` at T3; her firing point stays Kon's lane spot; the pounce and the trot home are drawn | data only (`unitsExpansion.js`) |
| Lure foxes | strip records with a `lure` block; the interval timer `lureCd` ticked in her kit tick; the placement rule above; Follow the Fox lays its foxes like Spike Rain | `src/sim/strips.js`, `src/sim/towers.js` (kit tick), `src/sim/Sim.js` (`lureCd` reset in `_checkWaveEnd`) |
| Lured | a `lure` status: the walk back, the per-wave count, the lure gap, the push lock, Resolve and the blink interrupt | `src/sim/status.js`, `src/sim/enemies.js`, `src/sim/constants.js` |
| ×1.3 / ×1.5 vs Lured | a per-victim factor (`luredMul`) in `computeHit`, beside `airMul` and soak (`combat.js:78-89`) | `src/sim/combat.js` |
| Paw Prints | a `prints` status with integer `stacks`; Trail's End in `_onHitEffects` | `src/sim/status.js`, `src/sim/Sim.js` |
| Tier keys | the `lure` and `prints` blocks: defaults, ModSet merge rules (adds, maxes) and integer rounding, as for the duo block (`mods.js:270-298`, `:643-651`, `:926-934`) | `src/sim/mods.js` |
| ⚡ | deploy `lure` (Follow the Fox); Spirit Fox is a boost whose ModSet carries `prints` riders | `src/sim/abilities.js`, `src/data/abilities.js` |
| Builders | `S.lure` in the data kit, and the same in the abilities file's `S` | `src/data/unitKit.js`, `src/data/abilities.js` |
| Hash | enemies' positions and HP are already hashed (`simHash.js:46`), so lures show there; `lureCd` is folded only on girls who have it, like Tenka's well timers | `src/online/coop/simHash.js` |

**Determinism:** no rng and no trig, and road movement by path distance. Victims are taken in uid order, or by (distance², uid) when a cap cuts the list.

### 2.7 How she looks

- **Kon:** the holo tint for each path from tier 3 (`applyHolo`, `src/models/companions.js`).
- **Bounding Fox:** Kon leaps with the first bite of each attack and trots home 0.5 s after his last bite.
- **Lure foxes:** Kon's own figure at half opacity with a soft outline. A Lured walker turns round and gets a small swirl over its head.
- **Paw prints:** small glowing prints on the ground under the enemy, one per stack, then Kon's leap and a flash that goes through the flash guard.
- **Spirit Fox:** Kon at 1.8× size with a gold rim for as long as it lasts.
- **Follow the Fox:** the lure foxes pop up along the lane in a quick ripple.
- **Reduce motion:** no flicker, no size pop, no leaps; Trail's End shows as a fade on the enemy.

---

## 3. The LR duo: "Ruri & Hana · Fox and Falcon"

### 3.1 Identity

> **Kon runs the road and flushes walkers out of cover; Kaze stoops from the sky on whatever Kon startles, and every flyer Kaze knocks down lands in front of Kon.**

- **One unit, one slot.** One footprint, the size of a hero's (0.5 tiles), one price and one upgrade panel. Ruri and Hana stand on one round base, Kon works the road and Kaze flies above.
- **Two weapons, each on its own timer.** Kaze's stoop is the main weapon and Kon's run the partner weapon: the twin-weapons rule from the first duo (DUO_LR §4, P-18).
- **Each covers the other.** Kaze owns the sky, the bosses and the elites; Kon owns the ground crowd on his lane. The trick works from the moment they are placed.
- **In four words:** "Kon flushes, Kaze stoops."

### 3.2 Base kit (first-pass numbers)

| Part | What it does | Numbers |
|---|---|---|
| **Kaze's stoop** (main weapon, Hana's) | Hana raises her glove and Kaze stoops on his prey. He picks flyers still in the sky first (Priority order), then Startled enemies, then by her target mode, within his reach of the base. Each stoop is a guided strike that leaves the base and hits only its own target (the drones' guided shot, `src/sim/towers.js:2001`). It flies at a fixed speed, so it lands within 0.35 s at his full reach. A flyer he hits is grounded | 16 damage, 0.6 stoops a second, reach 4.0, flight speed 12 tiles a second, pierce, ×2 vs flyers, grounds 1.5 s |
| **Kon's run** (partner weapon, Ruri's) | Kon waits at his spot by the lane. When his timer is ready and a walker is on his stretch, he dashes up the road through the oncoming walkers. He bites each one he passes once, and each is **Startled** | 10 damage a bite; a run every 2.5 s (rate 0.4); 2 tiles at 8 tiles a second; mystic; Startled 2.5 s |
| **Flush and Stoop** (the trick) | Kaze picks Startled enemies before other walkers and deals ×1.5 to them. Kon deals ×1.5 to grounded flyers | prey bonus ×1.5 both ways |

**Kon's run, exactly.**

```
 START  <────────────── walkers come down the road this way ──────────────>  EXIT
          d0 − runLen ◄═══ Kon runs this way, up the road ═══ d0     d0 + 0.5
              │                                                │         │
              └───────────────── his stretch ─────────────────────────────┘
                                                               │ (Kon's road point:
                                                               │  the nearest visible
                                                               │  road sample)
                                                              [K]  Kon's spot, 0.7 short of it
                                                               :
                                                         [R][H]  the base; Kaze circles above it
```

- **The duo has no `relay`.**
  - In the sim a `relay` moves the firing point of every behaviour, and her ring with it (projectiles, pulses, beams, chains, mortars all read `t.ox` / `t.oy`).
  - So the duo carries none. Kaze's stoops leave the base, and her ring (reach 4.0) is drawn round the base.
- **Kon's spot** uses the relay rule (`relayOrigin` over `relaySamples`, leash 3.5), but is stored apart, as `t.kon = { x, y, pathIndex, d0 }`:
  - `(pathIndex, d0)` is the nearest visible road sample to the base. Ties go by path order, then distance (the `relaySamples` order).
  - `x, y` is the point 0.7 tiles short of that sample.
  - It is recomputed on placement and on any upgrade that changes the leash, and it is never a firing point.
- **His stretch:**
  - It lies on path `pathIndex`, from `d0 − runLen` (towards START) to `d0 + 0.5`, clipped to the visible road: a run stops at a tunnel's mouth.
  - "A walker on his stretch" means an eligible ground enemy, or a grounded flyer, inside that span. It also counts one on another road through the same stretch, by the shared rule below.
- **When he runs:** when his partner timer is ready (whole steps, `1 / runRate` s) and at least one walker is on his stretch. Otherwise the timer waits at ready.
- **The run:**
  - It is a runner record from `d0` towards START at 8 tiles a second (2 tiles take 15 steps).
  - It bites every eligible enemy within `RUNNER_HIT_RADIUS` (0.6, `src/sim/constants.js:261`) of his point, once per run, in uid order within a step.
  - At its end he is back on his spot in the sim at once. The display trots him back along the road in 0.4 s, and nothing is hit on the way back. The next run starts again from `d0`.
- **Shared roads.**
  - Runners hit only their own path today (`src/sim/runners.js:5-6`, `:168`).
  - Kon's run adds a `shared` option to the runner record: Marumi's rule (`src/sim/balls.js:29`, `sameSpot` `:87-90`). An enemy on another road counts when its road point is within 0.3 tiles of the run's point and the two roads run the same way there (unit direction dot > 0.95).
  - A crossing road or an overpass never counts. Future runners can take the same option, which gives them UNIT_GAPS rule P-17.
- **A run in flight ends** at the wave clear or when the duo is sold. The timer is the partner timer `duoCd`, which the battle save already stores in `du` (§5.4).

Two damage types, pierce and mystic, suit the Eclipse Wyrm: it is weak to both (×1.5 and ×1.25) and drops feather. Kon's mystic bites also reach phasing ghosts.

### 3.3 Three paths

Prices sit inside today's windows (T2 ≤ 450, T3 ≤ 1,400, T4 ≤ 4,500, T5 12k–36k) and match the first duo's ladder. Only one path can go above tier 2.

| Path | Who leads | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| **High Stoop** (flyers, elites, bosses) | Kaze | Light Rotors 180: stoops +3 damage | Glove Whistle 400: Kaze stoops 15% faster | **Double Stoop** 1,300: each stoop takes 2 prey (with fewer, the extra stoops strike the first again); stoops ignore 2 armour | Wind Shear 4,200: stoops +14 damage, ×1.4 vs elites, ×1.25 vs flyers; grounded flyers stay down 1 s longer | **Cloudbreak Stoop** 26,000: 4 prey a stoop, +40 damage, damage and boss factors fitted on the bench (§3.6); the first stoop on each boss stuns it 0.3 s |
| **Fox Run** (ground crowds) | Kon | Quick Paws 170: Kon runs 15% more often | Long Run 380: runs +1 tile | **Scatter Run** 1,250: bites splash 0.5 (walkers beside his line are bitten too); Startled lasts 1 s longer | Strong Scent 4,000: bites +10 damage, shred 2 armour 3 s, and slow 15% for as long as Startled lasts (a plain `slow` status) | **Silver Trail** 24,000: runs 6 tiles, +30 bite damage, and two runs a cycle (the second starts 0.4 s after the first ends, when he is back on his spot); factors fitted on the bench |
| **Flush and Stoop ⚡** (the two together) | Both | Hand Signals 160: Startled lasts 1 s longer | Prey Drive 400: the prey bonus ×1.5 → ×1.75, both ways | **⚡ Flush and Stoop** 1,350: a stoop that hits a Startled enemy chains to the next Startled enemy within 1.5 tiles (1 chain, ×0.75 the stoop); **unlocks Wind Chase** | Startle Bark 4,300: Kon's runs knock down flyers within 0.6 tiles of his point (grounded 1.5 s), and grounded flyers count as Startled; 2 chains | **⚡+ Shared Instinct** 28,000: every bite Startles for 5 s; 3 chains at the full stoop; factors fitted on the bench; **upgrades Wind Chase** |

- **Chains** pick by (distance², uid) among Startled enemies that stoop has not hit yet (`chainNext`, `src/sim/towers.js:1114`, limited to Startled enemies).
- **Awakening (★3): Trusty Pair.** +6% damage on stoops and bites, and Startled lasts 0.5 s longer.

### 3.4 Her ⚡ ability: Wind Chase

| | Value |
|---|---|
| Unlock and upgrade | Flush and Stoop tier 3 unlocks it and tier 5 upgrades it. Ability coins: 850 + 160 + 400 + 1,350 = **2,760** |
| Kind and scope | A runner (a new type, `chase`) with a stoop queue on `sim._abilQueue`. **Map** scope: one cooldown per player, like Prismfall, because the LR finale reaches the whole map. No aim |
| Its lane | Kon's stretch rule (§3.2) with the run's length. If Kon's road point sits on a stretch several roads share, it takes the road with the most living, visible enemies between `d0` and START (`runnerEntry`'s shared-point rule, `src/sim/runners.js:20-66`). Ties go to the lower path index. It bites enemies on the other roads of that shared stretch by the `shared` rule |
| Tier 3 | Kon sprints 6 tiles up his lane from his spot. He bites every walker once (2× a bite) and Startles it for 5 s, and flyers within 0.6 tiles of his point are knocked down for 3 s. Kaze follows and stoops on each enemy Kon reached, in the order Kon reached them, one every 0.1 s (up to 10). Each stoop is 3× his stoop, with the prey bonus. Cooldown **40 s**; it starts ⅓ charged |
| Tier 5 (Shared Instinct) | 10 tiles, up to 16 stoops at 4× each. Cooldown **34 s** |
| LR form (§3.5) | After the last stoop, Kaze climbs out of sight and makes one **Great Stoop** on the strongest enemy on the map: 10× his stoop, splash 1.2, white-gold |
| No walker on Kon's stretch | The cast is refused with `noTarget`, and its charge is kept (ABILITIES §3.2) |
| Auto-cast (default Off) | Prismfall's rule: `{ when: 'cluster', min: 6, radius: 1.5, orBoss: true }`. A cast that would be refused is not tried |

Like every ability, its hits never crit and scale with the duo's current hit, so it grows with each path's tier 5. Its shape differs from the other road and lane ⚡:
- Seiran's Dragonflight is a whole-road hero ultimate.
- Marumi's Giant Strike is a ball rolled to the spawn.
- Hana's Kaze's Swoop strikes only flyers, anywhere on the map.
- Prismfall is an aimed barrage.
- Ruri's Follow the Fox lures and deals no damage.

### 3.5 LR: Limit Break and the Paw and Feather form

**Route**, as for every LR unit (BANNERS §C.2, `src/systems/limitBreak.js`):
1. Level 60 with all 5 gates, and ★5 (UR).
2. Pay the Limit Break fee: 450,000 coins, 6 legendary and 3 Zenith feather materials, 1 Rainbow Crown.
3. Win her trial, **"The Field Survey"**: the wildlife club's survey of the monsters on the academy hill, with fast walkers and flyer swarms. Solo, from the player's own copy, with no Support Student. Until its map exists, the stand-in is 8-5 on Nightmare, as for the other two LR units.
4. The first clear makes her LR and pays 300 gems + 1 Recruit Ticket, once.

**The LR form, "Wind Chase · Paw and Feather".** A real kit change, because the owner wants LR "much more powerful":
- **Every build:** Kaze's stoops chain once more on Startled prey, and Kon's runs are 50% longer.
- **Every build:** the duo's damage × `RH_LR_MUL`, a knob fitted last (first guess 1.3), read from `unitStats.lr` like the first duo's `DUO_LR_MUL`.
- **Wind Chase** ends with the Great Stoop (§3.4).
- **On top,** like every LR unit: LR_BOOST (×1.15 damage, ×1.05 speed; `src/systems/limitBreak.js:127`) and UR Resonance from ★5.

**Look:**
- the Nightglass frame and the LR sticker (DUO_LR §2.5);
- her crest: a paw print crossed by a feather (the form's name);
- in battle, Kon glows white-gold and Kaze's wing edges turn white-gold;
- the unlock fanfare reads "LR: The Field Survey".

### 3.6 Target numbers against Kage: floors, never caps

Each number is the duo's DPS ÷ the best Kage tier 5 on the same bench, on whatever is live when the duo is built (balance round 5 ships first). The light bench has no LR; round 5's bench runs her fully maxed, with LR where marked. **Every number is a floor:** the knobs stop at the first value that clears it, and later balance passes may only raise her.

| Build (tier-2 crosspath) | Job | Light bench, crowd / boss | Round 5's bench, UR form, crowd / boss | Round 5's bench, **LR form**, crowd / boss |
|---|---|---|---|---|
| High Stoop 5 | bosses, flyers | ≥ 1.0 / ≥ 1.25 | ≥ 1.0 / ≥ 1.5 | ≥ 2.5 / **≥ 3.0** |
| Fox Run 5 | crowds | ≥ 1.25 / ≥ 1.0 | ≥ 1.5 / ≥ 1.0 | **≥ 3.0, and at least the weakest other LR unit's best crowd** / ≥ 2.5 |
| Flush and Stoop 5 | both | ≥ 1.0 / ≥ 1.0 | ≥ 1.3 / ≥ 1.3 | ≥ 2.5 / ≥ 2.5 |
| every tier 3 | | within ±20% of the SSR tier-3 median | | |

**What the band means.**
- **Before LR:** at least 1.3× on her main job and at least 1.0× on the other, on round 5's bench.
- **In LR form:**
  - every tier-5 build is at least 2.5× on both rulers;
  - her best boss build is at least 3.0×;
  - her best crowd build is at least 3.0× and at least the weakest other LR unit's best crowd, so she is never the weakest LR unit on crowds.
- **In raw numbers:** Kage's best tier 5 on round 5's bench reads about 2.2M on a boss and 1.8M on a crowd. So her LR floors are about 5.5M on a boss (6.7M for her best boss build) and 4.6M on a crowd.
- **She is not the weakest LR unit on crowds.** The other two LR units already read more than 3× on crowds (below). Fox Run's crowd floor is set from them when she is built: today about 4.3× (Tenka with her LR boost, an estimate), about 7.9M.

**The other LR units (round 5's bench, ÷ the best Kage tier 5):**

| LR unit | Crowd | Boss |
|---|---|---|
| Kohaku & Tsubaki, in LR form | 8.71M, **4.76×** | 3.94M, **1.77×** |
| Tenka, without LR (the bench does not make her LR) | 6.55M, **3.58×** | 1.80M, **0.81×** |
| Tenka with her LR boost (an estimate: ×1.21 from LR_BOOST; her LR form changes only her ⚡) | about 4.3× | about 1.0× |

- **The band is a floor for them too.** Their crowd numbers stay where they are: round 5 keeps the first duo out of the band and never tunes her down, and no unit is nerfed.
- The balance work lifts their boss numbers to at least 2.5× (board Q8) before the fox-and-falcon duo ships. So no LR unit is left below the floor, and none is cut.

**Knobs, in the order to turn them:**
1. Each tier 5's own factors, with these first guesses:
   - High Stoop: stoop damage ×8, boss ×10, Kon's bites ×20.
   - Fox Run: bites ×30, stoops ×4, boss ×3.
   - Shared Instinct: both weapons ×20, boss ×2.5.

   The first duo needed ×6.4–×36.8 on damage and ×11.7–×150 on its partner weapon at tier 5 to clear Kage on these rulers (DUO_LR §6), so the factors look large by design. Fox Run's crowd floor may need more than its first guess.
2. The prey bonus.
3. `RH_LR_MUL`, last, so that only the LR form moves.

### 3.7 How it differs from Kohaku & Tsubaki

| | Kohaku & Tsubaki · Prism Battery | Ruri & Hana · Fox and Falcon |
|---|---|---|
| Weapons | Tsubaki's aimed star shells (whole map, ground only, blast) + Kohaku's constant beam (3.6 tiles, pierces a line, hits flyers, mystic) | Kaze's stoops (4 tiles, one big guided hit, flyers first, pierce) + Kon's runs (up his lane, a bite on every walker he passes, mystic) |
| Shape | artillery on a spot anywhere on the map | a hunting pair on her lane: one runs the road, one falls from the sky |
| The trick | Refraction: a shell counter (every Nth shell splits into shards) | Flush and Stoop: two statuses hand prey back and forth (Startled walkers to Kaze, grounded flyers to Kon) |
| Aim | an aim point for shells and Prismfall | none: Kon and Kaze pick their own prey |
| Movement | both stand on the base | Kon runs the road, Kaze flies |
| ⚡ | Prismfall: a barrage of split shells on one spot | Wind Chase: a run up her lane and a chain of stoops on everything Kon startled |
| LR form | Twin Star finale, beams to the map edge, ×1.1 | Great Stoop finale, one more chain, 50% longer runs, `RH_LR_MUL` |
| Best at | crowds anywhere (4.76× in LR form) | bosses and flyers with Kaze, and her own lane's crowd with Kon (in LR form at least 2.5× on both) |
| Solo versions | none | Ruri and Hana stay as their own units |
| Damage types | blast + mystic (the Foundry Titan's weak spots) | pierce + mystic (the Eclipse Wyrm's) |
| Family, trial | ember, Starfall Trial | feather, The Field Survey |

### 3.8 How both girls appear

| Where | Look |
|---|---|
| **Battle model** | Two chibis on one round base, each at 85% and turned 12° outward (`DUO_LAYOUT` rows for `ruri` and `hana` in `src/models/duo.js`): Ruri on the left with her tablet, Hana on the right with her glove up, both facing the camera. Kon sits at his spot and runs his stretch on each run, following the sim's runner. Kaze circles above the base (a 0.8-tile loop) and stoops onto each target. Ruri plays `attack` (a tablet swipe) on each run, Hana plays `attack` (glove up) on each stoop, and both `cheer` on Wind Chase. One selection ring goes round the base, with Kon's stretch marked on the road while the duo is selected. The duo's Kon wears Hana's olive wildlife-club bandana, so players can tell him from solo Ruri's Kon on the same board |
| **Portrait** | A **new pair picture**: no pair art of these two exists (the pair pictures are chika-ruri, ena-kanna, fuu-hana, kaede-suzu, noa-iroha, yoriko-seiran and kohaku-tsubaki). Both girls in their academy uniforms, Kon at Ruri's feet and Kaze on Hana's glove. The card is a slanted split card with the −8° seam (Ruri on the left, Hana on the right). The bust and thumb show both faces on the seam; the stand is two half-body cut-outs side by side. Files: `ruri_hana-{full,card,bust,thumb,cut,cut-s}.webp`, plus `PORTRAIT_DATA` face points |
| **Tower bar** | One card, one cost, the split thumb |
| **Battle panel** | **Overall / Kaze / Kon** tabs, the pattern the first duo uses. Glance view: STOOP · RUN · REACH and a MORE sticker |
| **Name and wiki** | "Ruri & Hana", "Fox and Falcon": one student page with two short bios and two quotes. The Info tab says "Duo"; the role label is "Duo Rangers" (role key `rangers`) |

**Bio (first draft):** "Two quiet students who met because their companions did: Kon kept chasing Kaze's shadow across the library courtyard until Ruri and Hana had to start talking. Now they patrol the academy grounds as a pair. Ruri reads the trail on her tablet and sends Kon running through the grass; Hana raises her glove and lets Kaze drop on whatever Kon startles out."

**Personality:** "Ruri whispers plans to Kon; Hana answers in bird calls. They have said about ten words to each other, and they are already fast friends."

**Quotes:** Ruri, "Kon, find them!"; Hana, "Kaze, take them!"

### 3.9 Rarity, banner, price, family, Potential

- **Rarity and class:** SSR form in data, gacha class `legend` (`UNIT_CLASS` in `src/data/banners.js`). ★5 shows her as UR, and Limit Break makes her LR.
- **Getting her:** only on her own LR Banner, **"Ruri & Hana · Fox and Falcon Premiere"**. "Field Trip" was the first idea, but it is kept for a future mode (`docs/specs/TRYOUT_DAY.md:1451`, `:1498`).
  - 0.7% in her debut week (7 game days, carved out of the 1.5% SSR rate), then 0.5% in the daily LR tab.
  - Legend Promise at 300 pulls (`gl:ruri_hana`).
  - Never sparked, never a Select Ticket or Chosen Essence. Kindred SSR Essence works once she is owned.
- **SR rate-ups:** Ruri, Chigusa and Marumi. They are gacha-only SRs not yet featured on an LR banner, and Ruri is one so that pulls for the duo also bring solo Ruri copies.
- **Duplicates** give Essence. She gets one Potential row (SSR track, kit steps from P2; in the co-op graph and the battle-data hash, `POTENTIAL_LADDERS`, `src/online/coop/version.js:90`):
  - P2 Sure Grip: +5% damage, +1 stoop damage (like the first duo's P2 `duo: { beamDmg: 1 }`);
  - P3 Quick Trot: +7% speed, runs +0.5 tile;
  - P4 Keen Pair: +7% damage, prey bonus +0.1;
  - P5 Extra Chain: +8% speed, +1 chain;
  - P6 On the Wing: +9% damage, and every 6th stoop lands with a bite from Kon (×3, splash 0.6).
- **Price:** base **850**, the first duo's band: above a single SSR (600–650), below Tenka (1,800).
- **Material family:** **feather** (Hana's). The Eclipse Wyrm drops it.
- **When:**
  - Not before the current premieres end (Tenka's on Nov 5), so two LR premieres never split players' gems in one week.
  - Only after her art is approved.
  - Her pin waits behind `hold: true`, as the first duo's did.

---

## 4. Recommendation: both, the rework first

**Order:**
1. **The owner board** (this note). No code.
2. **Ruri's rework**, one co-op update after balance round 5. Round 5 ships after the Halloween event closes on Nov 1, with `COOP_PROTOCOL` 14.
3. **The duo's sim and data, held:** in the game but not pullable, the Kogane and Norika pattern (`HELD`, `src/data/banners.js:37`). It rides the rework's update or the next one, and its patch note does not name her.
4. **The duo's art and her premiere together:** the pair picture, the figures, the banner, Limit Break and the patch note. The art is display only and the banner is not a sim change.

**Why this order:**
- The owner's first ask is the rework ("rework the other girl with the fox to be more unique and interesting"); the duo is the "maybe".
- The rework fixes a girl players already paid for. It also closes the last two waiting ⚡, which v0.1.61 promised.
- It is cheaper: one girl's kit, her own art and Kon's own figure.
- It decides what solo Ruri *is*, so the duo can be built not to copy her.
- Shipping the duo first would read as "the fix for Ruri is behind a paywall".
- The duo's art does not exist yet and takes the longest, so her sim can wait, held, while it is made.

**Fairness for players who own Ruri and Hana:**
- **Nobody loses a girl.** Solo Ruri and Hana stay, with level, gates, stars, Potential, gear and bond. Nothing is merged, retired or consumed, and no duplicate is needed for anything.
- **Ruri gets better first, for free.** No job falls: her best crowd build and her best boss build both land at or above today. A battle saved with her on a retired path refunds her in full (§5.4).
- **The duo is not a strict upgrade of either girl:**
  - solo Ruri keeps her lures and paw prints;
  - solo Hana keeps her team mark (Hunter's Mark), her volleys and her map-wide Swoop;
  - the duo has none of these.
- **Pulls for the duo help Ruri:** she is an SR rate-up on the duo's banner.
- **A gift for owners of both:**
  - Owning solo Ruri and solo Hana unlocks a free bond scene, "Kon Meets Kaze", and the profile title "Fast Friends".
  - It is worked out from what the save owns, at load and whenever a girl is granted, so players who already own both get it on their first load after the update.
  - It needs no duo and gives no power.
- **New figures for the solo girls too:** the figures and effects made for the duo (§5.2) also go to solo Ruri and Hana, display only.
- **The LR rules hold:** harder to pull, a rate-up banner, no spark, the Legend Promise at 300, and a clearly bigger boost.

---

## 5. Impact

### 5.1 Every file, by milestone

Hashed means the file is in the co-op graph (`tools/simId.mjs`), which hashes 81 files on `main`. A hashed change moves the sim id, so it needs a `COOP_PROTOCOL` bump at its release.

**R1, Ruri's rework (a co-op update).**

| | Files | What changes |
|---|---|---|
| Hashed: data | `src/data/unitsExpansion.js` | her paths, names and tier keys |
| | `src/data/abilities.js` | her three rows; the `effect` vocabulary in its header (deploy `lure`; `carry` and `river` leave), which `tests/data/abilities.test.js` checks keys against; `ABILITY_DEPLOYS_RUN` gains `lure`; `S.lure` |
| | `src/data/unitKit.js` | `S.lure` |
| | `src/data/balance.js` | her round-5 row, on top of round 5 |
| Hashed: sim | `src/sim/mods.js` | the `lure` and `prints` blocks: defaults, ModSet merge, rounding |
| | `src/sim/strips.js` | the lure-fox record, placement, Follow the Fox's laying, the pop |
| | `src/sim/towers.js` | her kit tick (`lureCd`) |
| | `src/sim/Sim.js` | Trail's End in `_onHitEffects` (`:615`); `lureCd` reset in `_checkWaveEnd` (`:917`). Lure foxes are traps, so `_removeTower` (`:1383`) and the wave clear already end them |
| | `src/sim/status.js` | `lure`, `prints` |
| | `src/sim/enemies.js` | the walk back, `lureN`, Resolve |
| | `src/sim/combat.js` | `luredMul` in `computeHit` |
| | `src/sim/constants.js` | `BLINK_INTERRUPTS` gains `lure`; `LURE_*` and `PRINT_*` |
| | `src/sim/abilities.js` | deploy `lure` |
| | `src/online/coop/simHash.js` | `lureCd` |
| Not hashed | `CONTRACTS.md` | the StatusSpec union (`:168-174`), the ability vocabulary (`:187-212`), the ModSet table (`:221-240`) |
| | `src/ui/battle/snapshot.js` | the kit mark and drop rule, `lureCd` classified (§5.4) |
| | text and rows | `src/data/abilityText.js`, `src/data/unitTips.js`, `src/data/wiki.js` |
| | rendering | `src/render/attackFx/styles/ruri.js`, `src/render/companionLogic.js`, `src/models/companions.js` |
| | Power | `src/data/powerKit.js` (her round-5 Power factor) |
| | patch note | `src/data/patchNotes.js` |

**D1, the duo held (a co-op update; it may share R1's).**

| | Files | What changes |
|---|---|---|
| Hashed: data | `src/data/unitsDuo.js` | `RURI_HANA` in `DUO_UNITS` |
| | `src/data/abilities.js` | Wind Chase with its `lr` form; runner `chase`, `ABILITY_RUNNERS_RUN`, the `cluster` Auto |
| | `src/data/potential.js` | her row (also in `POTENTIAL_LADDERS`) |
| | `src/data/unitKit.js` | `S.startled` |
| Hashed: sim | `src/sim/mods.js` | a **`pair` block**, so Kon's bites grow with level, gear and Potential as Kohaku's beam does: `normPair`, the `pair` ModSet keys, the scaling beside `:814` (run damage × her damage factor, run rate × her rate factor), and the rounding beside `:926-934` |
| | `src/sim/duo.js` | the partner dispatch: `beam` for the first duo, `run` for this one; `buildPartnerSpec` builds the run spec from `stats.pair`; `t.kon` |
| | `src/sim/runners.js` | Kon's run, the `shared` option, the `chase` type |
| | `src/sim/towers.js` | Kaze's prey order on the guided shot, chains, the `noTarget` check for Kon's stretch |
| | `src/sim/combat.js` | the prey bonus against Startled enemies and against grounded flyers |
| | `src/sim/status.js` | `startled` |
| | `src/sim/constants.js` | `RH_LR_MUL`, `KAZE_STOOP_SPEED`, `KON_RUN_SPEED`, `STARTLE_*`, chain caps |
| | `src/sim/abilities.js` | the `chase` runner, its stoop queue and the Great Stoop |
| | `src/sim/Sim.js` | a run ends when the duo is sold (`_removeTower`); runners already end at the wave clear |
| | `src/online/coop/simHash.js` | the run timer, only on a girl who has it |
| Not hashed | `CONTRACTS.md` | `startled`, the `pair` block, runner `chase`, and `cluster` (missing there today) |
| | `src/ui/battle/snapshot.js` | `t.kon` and run state classified (§5.4) |
| | text and rows | `src/data/abilityText.js`, `potentialText.js`, `potentialBoards.js`, `src/data/gearStats.js` (`GEAR_FIT`), `unitTips.js`, `wiki.js` (role `rangers`) |
| | rendering | `src/models/duo.js`, `src/render/attackFx/styles/ruri_hana.js`, `public/models/companions/manifest.json` |
| | Power | `src/data/powerKit.js` (a factor for her, or none) |
| | held | `src/data/banners.js`: `HELD` |
| | patch note | one that does not name her |

**D2 and D3, her art and her premiere (no sim change).**
- `src/data/banners.js`: un-hold her; `UNIT_CLASS`, `PINS`, `LEGEND_SR`, `LEGEND_NAMES` and a `LISTS.legend` version.
- `src/systems/limitBreak.js`: `LR_TRIALS`.
- The scene and the title.
- The portraits and `PORTRAIT_DATA`.
- The figures.
- The patch note.

**D4, The Field Survey's own map (a co-op update).** `src/data/stages.js` and `src/data/maps.js`, which are hashed.

**Protocol numbers:**
- Round 5 takes 14.
- R1 takes the next free number: 15 if nothing else ships first.
- D1 takes its own number, or R1's if both ship in one release. Never bump twice for one release.
- Stats travel in the loadout, so `lr: true` reaches a co-op partner as it does for the first duo.
- Each sim milestone gets a scripted engines battle (V8, JavaScriptCore and SpiderMonkey bit-identical) that includes a mid-wave rejoin: `RURI_START` and `FOXFALCON_START`.

### 5.2 Art

| Item | Who and how | Used by |
|---|---|---|
| Kon's three looks, lure foxes, paw prints, Spirit Fox, Follow the Fox | us: holo tints on Kon's figure and effect sprites; display only | solo Ruri |
| **The duo's pair picture** and its crops (full, card, bust, thumb; the stand is two half-body cut-outs) | The art v3 tool in Look B, with Ruri's and Hana's own portraits as the only references: about 12 images at about 5 Anlas each, so about 60 Anlas. **The owner says yes to that spend on its own; "default all" is not that yes.** Or the owner draws it | the duo |
| **3D figures:** Ruri, Hana, Kon and Kaze | **Either the owner makes them in Tripo, or we make them with Meshy**, the main 3D tool, whose spending is already approved (HANDOFF §6: one test run first, every run's cost reported, stop below 60 credits). The four models: Ruri and Hana in their academy uniforms; Kon, a small white fox with big ears and a fluffy tail; Kaze, a falcon-shaped drone with a camera eye and tech panels. We conform them:<br>• the girls: the 25-joint game skeleton and five clips;<br>• the companions: idle, move, attack and appear, plus Kon's run and Kaze's circle and stoop;<br>• LODs, painted eyes, and FX anchors (Ruri's tablet, Hana's glove, Kon's mouth, Kaze's talons) | the duo, and solo Ruri and Hana too. Until then the duo uses today's GLBs (`ruri.glb`, `hana.glb`, `kon.glb`, `kaze.glb`) |
| Companion manifest | `owner` becomes a list (`kon` → `ruri`, `ruri_hana`; `kaze` → `hana`, `ruri_hana`); the duo's Kon gets the bandana | both |
| Duo effects (`src/render/attackFx/styles/ruri_hana.js`) | Kon's run (a dust and holo streak); a small burst of grass and feathers on each Startled enemy; Kaze's stoop streak (from Hana's style); chain arcs; Wind Chase; the Great Stoop; the paw-and-feather LR crest and fanfare | the duo |

**Rules for the art:**
- Students are never sexualised: both girls are fully in uniform and framed at eye level or above.
- Generators only get the game's own art, and prompts name no girl, game, studio or artist.
- No third-party image is ever committed.
- Generator keys (NovelAI, Meshy) go in as environment secrets, never into chat. Today both answer 401 here.

### 5.3 The banner

- `UNIT_CLASS.ruri_hana = 'legend'`. While she is in `HELD`, she is in no pool, list, rate-up, spark or Select Ticket.
- A `PINS` row: "Fox and Falcon Premiere", 7 days at 7,000 ppm, SR rate-ups Ruri, Chigusa and Marumi, `debut: true`, `hold: true`.
- `LEGEND_SR` and `LEGEND_NAMES` ("Fox and Falcon") rows.
- A new `LISTS.legend` version that adds her. Its `since` is at least 3 game days after the patch note that adds it, on a day the old cycle ends; `tests/systems/banners.test.js` checks both.
- `spark()`, `redeemSelectTicket()` and Chosen Essence already refuse every `legend` unit.

### 5.4 Saves

- **Profile:** additive only, so no `SAVE_VERSION` bump.
  - `units.ruri_hana`;
  - the counters `lbt:ruri_hana`, `lr:ruri_hana` and `gl:ruri_hana`;
  - the "Kon Meets Kaze" flag and the "Fast Friends" title, worked out from the girls the save owns at every load and on every grant.
- **Battle saves** (`src/ui/battle/snapshot.js`):
  - **A pre-rework Ruri takes the full-refund drop.**
    - After the rework, her row carries a kit mark (`kv: 2`).
    - A row without it whose Star Falcon or Tide Otter is above tier 2 (her main path is a retired one) takes the existing drop (`drop`, `:538-542`). She is not placed, every coin spent on her comes back, and the notice names her: the rule BATTLE_SAVE.md already documents ("A girl who can't return after an update is refunded").
    - A pre-rework Ruri whose main path is Moonhound comes back on Bounding Fox, the same job. Her tier 1–2 crosspath tiers come back by index on the new paths, and the coins she had spent are kept as saved (`spent`).
    - Endless runs and the Colosseum are saved too (`isSavableRun`, `src/systems/battleSave.js:71`), so this matters for long runs.
  - **New timers:**
    - Ruri's `lureCd` resets at every wave clear (classed `calm`).
    - The duo's run timer is the partner timer `duoCd`, already saved in `du` (`:48-49`, `:375`).
    - Kon's spot `t.kon` is `derived` (rebuilt from her spot).
    - Runs and lure foxes end at the wave clear, so a calm point holds none (`runners` is already `calm`; lure foxes are traps that end at the wave clear).
    - Lured, Startled and prints are statuses on enemies, and a calm point has no enemies.
  - **Every new Sim or tower field is classified** in `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS` (`:128`, `:190`), or `tests/battle-ui/snapshot.test.js` fails.

### 5.5 Tests

| Area | Tests |
|---|---|
| Data | `tests/data/units.test.js`: the roster count +1; rarity totals; the look guard on the duo; footprint 0.5; the price band; transformations only at tiers 4–5 and "every tier 3+ changes behaviour"; path and tier names unique across girls, with the renames. A new "Ruri is not Hana" check: no `airMul`, `ground` status or `detection` anywhere in Ruri's paths |
| Data | `tests/data/abilities.test.js`:<br>• `RURI_PATHS` becomes Moon Pounce 1,780, Follow the Fox 1,790 and Spirit Fox 1,860, and all three run;<br>• the duo has exactly one ⚡ path;<br>• `carry` and `river` leave the vocabulary, and `lure` and `chase` join it;<br>• ability names are unique and absent from every path, tier, title and enemy name |
| Data | `tests/data/potential.test.js` (the duo's row); `tests/systems/banners.test.js` (class, no spark, pin, the `since` rule, `hold`); `tests/systems/limitBreak.test.js` (her trial row, a feather fee); `tests/systems/powerKit.test.js` (Ruri's refit, the duo's factor or none: Power never drops) |
| Sim | **New `tests/sim/ruriFox.test.js`:**<br>• Bounding Fox: her targets within 3.4 of Kon's spot, her firing point never moves;<br>• lure foxes: placement (tunnel, road's end, ties), budget, her cap, Follow the Fox ignoring it, the oldest going first at the player and sim caps, a walker on a shared stretch lured, wave clear, removal on sale;<br>• the lure: backwards by path distance, clamped at START, bosses and flyers never, minibosses half, twice a wave (minibosses once), the 8 s gap, the push lock held through the lure, a push-locked walker refused, Freeplay Resolve, a blink interrupted;<br>• paw prints: stacks, expiry, Trail's End, two Ruris;<br>• Follow the Fox and Spirit Fox |
| Sim | **Wave length:** on 4-5 and 7-5 Hard, with Ruri at Fox Tricks T5 and Fuu at Returning Gale T5, every wave ends, and no wave lasts more than 10 s longer than with Fuu alone |
| Sim | **New `tests/sim/foxFalcon.test.js`:**<br>• the duo has no relay, and Kaze fires from the base;<br>• Kaze's prey order, the guided stoop hitting only its target, his fixed speed, grounding;<br>• Kon's spot and stretch: nearest sample, ties, clipping at a tunnel;<br>• the run: integer tick timer, one bite per enemy per run, waiting with no walker, the `shared` rule (an enemy on a shared stretch is bitten, one on a crossing road is not);<br>• Startled, and the prey bonus both ways;<br>• chains (order and caps) and Startle Bark;<br>• Wind Chase: its lane on a shared stretch, the stoop queue, the map-scope cooldown, `noTarget` keeping the charge;<br>• the `pair` block growing with level, gear and Potential;<br>• the LR form from `lr: true` |
| Sim | • **Mid-wave co-op checkpoint:** `tests/sim/snapshot.test.js` gains a checkpoint taken mid-wave with lure foxes on the road, Lured walkers, prints, a run in flight, Startled enemies and a chain, rebuilt and stepped to the same hash.<br>• Determinism: the same battle plain and inside `withDetMath`, `hashSim` equal every 60 ticks.<br>• Goldens re-pinned with no win becoming a loss: `abilitiesGolden`, `campaignGolden`, `modesGolden` and `tests/sim/tryoutGolden.test.js` (Ruri and Hana are Tryout Day students).<br>• `tests/sim/perf.test.js`: 6 copies of each new build at tier 5 with 200 enemies, under 2 ms a step.<br>• `tests/art/itemArtRuntime.test.js`: `PENDING_BUMP`, then `KNOWN[n]` |
| Battle save | `tests/battle-ui/snapshot.test.js`:<br>• every new field classified;<br>• a pre-rework Ruri on a retired path is dropped and refunded, and one on Moonhound comes back on Bounding Fox;<br>• the duo's `du` row restores her run timer;<br>• Save & quit in the middle of a wave, with lure foxes out, Lured walkers and a run in flight, restores at that wave's start with none of them and fresh lure timers |
| Co-op | `tests/online/engines.test.js` and `e2e/engines.mjs`: the two scenarios, with `--require-all` before ship |
| Render and UI | `tests/render/companions*.test.js`: Kon's looks, lure foxes, his leap and trot home, Kaze circling and stooping for the duo, Reduce motion. `tests/models/duo.test.js`: the layout rows and model ids. The girl page: the duo, her LR chip and Ruri's Tree tab stickers |
| e2e | `e2e/abilities.mjs`: Ruri's three casts and Wind Chase. A new `e2e/fox-falcon.mjs`: the duo on 1-1 with a run, a stoop chain, Wind Chase and LR. `e2e/recruit-banners.mjs` and the smoke run |
| Balance | • The light bench (mean of four configurations) and round 5's bench (3 seeds): Ruri's "no job falls" and the duo's floors in §3.6.<br>• Finales: no win becomes a loss.<br>• Titans: `r5Titans` with the duo, so UR_LATE never beats the Eclipse Wyrm.<br>• **The Tryout ceiling gate** (`tools/bench.mjs --hit --ceiling`, `tests/tools/tryoutCeiling.test.js`), run with `T_ruri` on each of her new builds |

### 5.6 Milestones (each ships on its own)

Every push to `main` carries a patch note at the top of `src/data/patchNotes.js` (CLAUDE.md). The held duo is never named before her premiere.

| # | What | Ships as | Gate | Patch note |
|---|---|---|---|---|
| **M0** | This note and the owner board | — | the owner's answers ("default all" works, except for spending) | — |
| **R1** | Ruri's rework: her kit, the renames, three ⚡, the new statuses and objects, her round-5 rows re-fitted, plain looks (Kon's tints, lure foxes as copies of Kon, print sprites) | a co-op update after round 5 | independent review OK; both benches; "no job falls"; the wave-length test; engines; perf; go/no-go; live check | "Ruri's fox Kon learns three new tricks…" (her new paths, the two new ⚡, where her old paths went, saved battles refunding her, the co-op line) |
| R1a / R1b | Only if time runs short:<br>• **R1a:** Fox Tricks and Follow the Fox replace Star Falcon; Tide Otter stays.<br>• **R1b:** Paw Prints and Spirit Fox replace Tide Otter, together with Bounding Fox's crowd fit, so her crowd job never falls in between | two co-op updates | the same | one each |
| **R2** | Ruri's look: polished effects, her Tree tab stickers, a new Kon figure if one is ready | display only, **full gate** (new effects and a figure are not a small tweak) | two independent reviewers (look and logic), go/no-go, live check | "Kon's new look" |
| **D1** | The duo's sim and data, held: the unit, partner dispatch, Startled, stoops, runs, chains, Wind Chase, the LR form, her Potential row, text, and plain looks (today's GLBs on one base) | a co-op update (it can share R1's) | the full gate; the duo's floors measured | the co-op line only ("co-op partners need this update too"); she is not named |
| **D2 + D3** | Her art and her premiere, shipped together: the pair picture and crops, the four figures (for the solo girls too), the duo's effects, her LR crest; then un-hold, the pin, rate-ups, `LR_TRIALS` (The Field Survey, with the 8-5 Nightmare stand-in), "Kon Meets Kaze" and "Fast Friends" | no sim change | an owner board with screenshots; visual review; go/no-go; live check | announces her, her banner, her Limit Break and the gift |
| D4 | Later: The Field Survey's own map | a co-op update | the full gate | "The Field Survey has its own stage" |

D2 can ship before D3 only with a patch note that does not name her ("Behind-the-scenes stability fixes."). The default is that D2 rides D3.

### 5.7 Risks

- **Lures and pushes.** Each walker is lured at most twice a wave, a lure holds the push lock, and a push-locked walker cannot be lured. Freeplay counts lure tiles against Resolve. The wave-length test runs Ruri and Fuu together.
- **Bounding Fox's longer reach.** Her ring grows from 2.4 to 3.4 around Kon's spot; the tier text says so, and the bench fits her crowd factor with it.
- **Power creep and nerfs among LR units.** The band is a floor for every LR unit: no crowd number is cut, and the boss numbers are lifted. The new duo is never the weakest LR unit on crowds.
- **The Eclipse Wyrm is weak to both of the duo's damage types.** Titan battles read no round-5 row (`TITAN_POWER` false), and the gear rule "UR_LATE never beats the Eclipse Wyrm" is re-checked with the duo at LR.
- **Two Kons can be on one board** (solo Ruri's and the duo's). The bandana tells them apart.
- **Art keys.** The NovelAI and Meshy keys are not in this environment yet (both answer 401). They go in as environment secrets, never into chat. Until then the pair picture waits, or the owner draws it, and the figures wait for Tripo models from the owner or a Meshy run.
- **Tide Otter players lose the otter.** Bounding Fox takes over its crowd job at the same level or higher. The patch note says where her old paths went, and a saved battle refunds her.

---

## 6. Questions for the owner

The questions are on `docs/review/ruri-hana-duo/OWNER_BOARD.md`, each with a recommended default.
- "Default all" takes every one, except the Anlas spend in Q13, which needs its own yes.

---

## 7. For the builder (short)

- **Data:**
  - Ruri's path ids: `hound` stays; `falcon` → `tricks`; `otter` → `prints`. Path ids live only in unit and ability data, never in saves.
  - Her names, tier keys (`range`, `lure`, `prints`) and three ability rows; the `abilityText.js` rows, with the `lr` text for Wind Chase.
  - `RURI_HANA` in `src/data/unitsDuo.js`:
    - `kind: 'tower'`, `rarity: 'SSR'`, role key `rangers`, `materialFamily: 'feather'`, `footprint: 0.5`;
    - `duo: { members: ['ruri', 'hana'] }`;
    - **no `relay`**;
    - the main stoop spec and a `pair` partner spec (run damage, rate, length, speed, leash, Startled time, prey bonus, chains);
    - three paths and Trusty Pair.
  - Rows in `potential.js` (hashed), `potentialText.js`, `potentialBoards.js`, `gearStats.js` (`GEAR_FIT`), `unitTips.js`, the wiki (the "Duo Rangers" role label) and `powerKit.js`.
- **Sim:**
  - the partner dispatch in `duo.js` (`beam` | `run`), with `t.kon` stored apart from any firing point;
  - the `pair` block in `mods.js`;
  - a `stoop` target rule on the guided shot (sky flyers → Startled → her mode), at a fixed speed;
  - Kon's run on the runner record, with the new `shared` option;
  - `startled` and `lure` as plain timed statuses, and `prints` as an integer stack;
  - lure foxes as strip records;
  - the `chase` runner, with a stoop queue on `sim._abilQueue`;
  - `RH_LR_MUL`, read from `unitStats.lr` like `DUO_LR_MUL`.

  Report each sim id; the coordinator bumps `COOP_PROTOCOL` once per ship.
- **UI:**
  - the panel's Overall / Kaze / Kon tabs (the first duo's pattern), with Kon's stretch marked on the road while she is selected;
  - Ruri's tier text, which now explains Lured, its limits and Paw Prints;
  - the LR crest row in `lr.css`;
  - the girl page's "Duo" line;
  - the "Kon Meets Kaze" scene and the "Fast Friends" title.
- **Battle save:** the `kv` mark, the drop rule and the field classes (§5.4).
- **Art:**
  - `DUO_LAYOUT` rows for `ruri` and `hana`, and `modelIds` for the duo;
  - companion owners as lists;
  - the `ruri_hana` attack-FX style;
  - the portrait crops with the seam;
  - an originality check on the duo's art (UNIT_GAPS §4.3).
- **Docs:**
  - CONTRACTS.md (§5.1);
  - this note's decision log;
  - UNIT_GAPS §4.1's Ruri row ("beast tamer") points here;
  - ABILITIES §5.2's Ruri and Hana rows point here.
