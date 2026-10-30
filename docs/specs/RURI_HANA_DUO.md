---
type: design
category: Design Proposals
tags:
  - design-proposal
  - units
  - rarity
  - abilities
  - duo
status: proposal
source: "main 60ce9cad (v0.1.61, sim be940ecb2087, COOP_PROTOCOL 13): src/data/unitsExpansion.js (Hana, Ruri), src/data/abilities.js, src/data/abilityText.js, src/data/potential.js, src/data/banners.js, src/data/unitsDuo.js, src/sim/towers.js (relay origins, guided shots, chainNext), src/sim/duo.js, src/sim/runners.js, src/sim/status.js, src/systems/limitBreak.js, src/render/companionLogic.js, src/models/companions.js, src/models/duo.js; docs/specs/DUO_LR.md, ABILITIES.md, ATTACK_SHAPES.md, BANNERS.md, UNIT_GAPS.md; feature/balance-r5 (83b72083) docs/BALANCE.md and src/data/balance.js; tools/bench.mjs run on main for this note"
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

**Who is who.**
- Luna, the Moonfox Oracle, has fox ears and a tail. The *other* girl with a fox is **Ruri** (SR tower, gacha), whose holo fox is **Kon**.
- The girl with a hawk is **Hana** (R tower, free after 7-5), whose falcon drone is **Kaze**. Game text calls him a falcon, and so does this note.
- Because Luna owns the moon and foxfire motifs (her quote is "Foxfire, rise."), Ruri's new names below avoid both.

This is a design note. Nothing in the game changes on this branch. Every number is a first pass; the bench sets the final ones. The decisions only the owner can make are on `docs/review/ruri-hana-duo/OWNER_BOARD.md`.

> [!summary] On one screen
> - **Today:** Ruri is a plain shooter whose bolts leave a fox who never moves. Two of her three ⚡ are still teasers (the last two in the game). Her Star Falcon path is a weaker copy of Hana: 0.03× the best Kage tier 5 on a crowd and 0.05× on a boss. Hana is a flyer archer whose falcon is mostly decoration.
> - **Ruri's rework (free for everyone who owns her):** Kon becomes the point of her kit.
>   - **Bounding Fox:** Kon pounces from enemy to enemy along the road.
>   - **Fox Tricks:** holo lure foxes lead walkers back up the road.
>   - **Paw Prints:** prints count up on one enemy until Kon leaps out of cover (her boss path).
>
>   Moon Pounce stays; **Follow the Fox** and **Spirit Fox** replace the two waiting ⚡. Nothing in her kit touches flyers, grounding, Veil Sight or birds.
> - **The duo:** **"Ruri & Hana · Fox and Falcon"**, a new LR unit (SSR → UR at ★5 → LR through Limit Break). **Kon runs the road and flushes walkers out of cover; Kaze stoops from the sky on whatever Kon startles, and every flyer Kaze knocks down lands in front of Kon.**
> - **Duo paths:** High Stoop (Kaze leads), Fox Run (Kon leads), and **Flush and Stoop ⚡** (both), which unlocks **Wind Chase**. The LR form is **Daybreak**.
> - **Power:** before LR, about 1.3–1.7× the best Kage tier 5 on both rulers; **in LR form, 2.5–3.0×**, the owner's band.
> - **Getting the duo:** her own LR Banner (7 days at 0.7%, Legend Promise at 300, never sparked), with SR rate-ups Ruri, Chigusa and Marumi. Price 850, family feather.
> - **Recommendation:** do both. **Ruri's rework first** (one co-op update after balance round 5), **then the duo** (sim held, then art, then her premiere). Solo Ruri and Hana stay, with every bit of progress.

---

## 1. Today

### 1.1 Ruri: Library Club Holo-Summoner (SR, gacha only)

**Base kit** (`src/data/unitsExpansion.js:318-375`):
- Cost 400, 7 mystic damage, 0.9 attacks a second, range 2.4; hits flyers.
- Kon, a holographic white fox, sits at the edge of the nearest lane: on the line from Ruri to the nearest visible road point, 0.7 tiles short of it and at most 3.5 tiles from her. This is her relay origin (`relayOrigin`, `src/sim/towers.js:1416`; `FAMILIAR_STANDOFF`, `src/sim/constants.js:229`).
- Every bolt leaves Kon, and her range ring is centred on him.
- The display has him bound out to that spot and sit there (`src/render/companionLogic.js`). In the sim the spot never changes during a wave.

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
- **Light bench.** `tools/bench.mjs` with the STRONG preset (L60, ★3, gear ×1.45, 25% crits), stage 4-5, seed 9, partner Aoi, run on `main` 60ce9cad for this note. This is one configuration, not the mean of four.
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
| Kohaku & Tsubaki at LR | 7.99M (4.39×) → 8.71M | 3.70M (1.88×) → 3.94M |

**Reading.**
- Ruri is a crowd girl (Tide Otter's splash, Moonhound's bites) with almost no boss damage on any path.
- Hana is a boss and flyer girl with no crowd.
- Round 5 lifts both into its band. Ruri's boss factor (×9) is the largest of any splash girl's. The round does not change what either girl does.

### 1.4 What feels plain about Ruri

1. **Kon is a moved muzzle.** He runs to a spot on placement, then only marks where her bolts start. He touches an enemy only when Moon Pounce is cast, and only on one path.
2. **Her "three familiar forms" are names.** Kon looks the same on every path. Only a small hit flourish differs at tier 3: a bite slash, a feather flick or a ripple (`src/render/attackFx/styles/ruri.js`).
3. **Two of her ⚡ are teasers.** v0.1.61 told players "only Ruri's Star Falcon and Tide Otter paths still wait for theirs", and her Tree tab shows the same ⚡ sticker on both waiting paths (a v0.1.61 low).
4. **Star Falcon is a dead path:** 0.03× Kage on a crowd and 0.05× on a boss. That is weaker than R Hana's Falconry tier 5, which costs 5,000 coins less.
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
- **Nothing of Luna's.** No moon or foxfire in her new names; the live ability Moon Pounce keeps its name.
- **Every ⚡ runs.** She keeps one ⚡ per path: ABILITIES §3.1 lets her data hold three, and the crosspath rule unlocks one per battle.
- **No job falls.**
  - Her best crowd build is at least today's (Great Otter Spirit).
  - Her best boss build lands in round 5's single-target band.
  - No tier 3–4 reads below today's same-tier best for its job, on either ruler.
- **Kept as they are:** Moon Pounce, Kon's lane spot (reach 3.5, standoff 0.7), her Pounce procs (P4, P6), and Tryout Day's `T_ruri` talent (it adds relay reach).

### 2.2 Three paths

| Path (what Kon does) | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Bounding Fox** (was Moonhound): *Kon hunts* · ⚡ Moon Pounce | Sharp Fangs 130: +1 damage | Twin Bite 300: +1 bite | **Bounding Fox** 950: Kon leaves his spot and hunts. Each attack, he pounces onto his target (within 3.5 tiles of Ruri) and bites from where he lands. Bites splash 0.5 and shred 1 armour 3 s | Silver Fangs 2,800: +1 bite, +8 damage, +0.3 splash | **Lapis Fox** 20,000: +26 damage, +0.4 splash, 20% of bites stun 0.4 s, and a crowd factor fitted on the bench (§2.5) |
| **Fox Tricks** (was Star Falcon): *Kon fools them* · ⚡ Follow the Fox | Far Wander 140: Kon may stand 0.6 tiles further from her | Flicker Step 300: +15% speed | **Lure Fox** 950: every 5 s, Kon leaves a holo lure fox on the road in front of the fastest walker in his reach. The first 4 walkers to reach it are **Lured** for 1.5 s | Two-Tailed Trick 2,700: a lure fox every 4 s; lure 2 s; her bolts deal ×1.3 to Lured walkers (they turned their backs); +6 damage | **Hundred-Fox Trick** 18,000: a lure fox every 3 s in front of each of the two fastest walkers, up to 6 walkers each; lure 2.5 s; a lure fox pops when its lure ends (4× her hit within 1 tile); +24 damage; ×1.5 to Lured walkers |
| **Paw Prints** (was Tide Otter): *Kon stalks one enemy* · ⚡ Spirit Fox | Fresh Tracks 140: +1 damage | Sniff Out 320: +15% speed | **Paw Prints** 1,000: each bolt leaves a glowing paw print on its target (up to 5; each lasts 4 s, and a new one refreshes them). At the 5th, Kon leaps out of cover: **Trail's End**, 6× her hit that ignores 2 armour; the prints reset | Double Prints 3,000: her bolts leave 2 prints on elites and bosses; Trail's End 8×; +6 damage | **Silent Stalk** 21,000: Trail's End at 4 prints, for 12× her hit; half of it leaps to the nearest enemy within 1 tile and leaves 2 prints there; +22 damage; a boss factor fitted on the bench (§2.5) |

**Lured** (Fox Tricks):
- **Who:** walkers only. Never flyers or bosses, and never anything in a tunnel. Minibosses are lured half as long.
- **How it moves:**
  - A Lured walker trots back toward the road's START, by path distance, at its own current speed (slows apply), and stops at the start.
  - It can still be hit, stunned and pushed.
  - Fast walkers go back furthest, so Fox Tricks answers the runners that leak.
- **Locks:**
  - An enemy can be Lured at most once every 8 s (minibosses 12 s).
  - A lure also starts the per-enemy push lock (`PUSH_LOCK`, `src/sim/constants.js:237`), so Ruri and Fuu together cannot keep one walker going backwards.
  - In Freeplay, Resolve clips lures as it clips pushes.
- **Lure foxes** are road objects, like Azami's strips:
  - Each is one road point with a budget of walkers and a 3 s life, and it lures walkers that reach it, in uid order.
  - Caps: 2 per Ruri (4 at T5), 8 per player and 16 per sim.
  - They end at the wave clear.

**Paw Prints:**
- The prints are an integer stack on the enemy (a `prints` status with `stacks`). Every Ruri adds to the same stack, and the bolt that fills it gets the credit.
- Trail's End is one hit through `_hit`, mystic. It never crits (so it draws no rng) and carries no statuses.
- On screen, Kon vanishes from his spot and leaps at the enemy (the existing pounce clip, `pounceStep`), then trots back.

### 2.3 Her three ⚡

| ⚡ | Kind, scope | Tier 3 | Tier 5 | Auto-cast |
|---|---|---|---|---|
| **Moon Pounce** (Bounding Fox; live, unchanged) | strike, local | Kon leaps at the strongest enemy within her range + 2: 3 bites of 8× her hit, then holds it 1.5 s (never a boss). 30 s. With Bounding Fox T3 he leaps from wherever he is | 5 bites, hold 2 s, 25 s | ≥ 4 enemies, or an elite |
| **Follow the Fox** (Fox Tricks; new, replaces Star Snatch) | deploy `lure`, local, lasts 6 s | Kon lays 5 lure foxes along her lane, one every tile up the road from his spot. Each lures up to 4 walkers for 2.5 s. 40 s | 8 lure foxes, lure 3 s, 34 s | ≥ 5 walkers in reach, or a walker past 70% of the road |
| **Spirit Fox** (Paw Prints; new, replaces River Rush) | boost, local, 8 s | Kon grows into a great spirit fox: her bolts ×1.6, each leaves 2 prints, and Trail's End splashes 1 tile. 35 s | ×2, 10 s, 30 s | an elite or a boss in reach |

**Ability coins** (placement plus tiers 1–3): Moon Pounce 1,780 (as today), Follow the Fox 1,790, Spirit Fox 1,860.

**What the sim already runs:**
- Boosts already run today (`ABILITY_KINDS_RUN`).
- `lure` joins `ABILITY_DEPLOYS_RUN`.
- The `carry` move and the `river` runner lose their only user and leave the vocabulary.

### 2.4 Why none of it overlaps

| Path | Closest girls | The difference |
|---|---|---|
| Bounding Fox | Kaede (dash and blade arts), Marumi (ricochet ball) | Kon's pounce moves *her firing point* along the road. Splash bites and shred; no ramp, no ball |
| Fox Tricks | Fuu (push-back), Chigusa (vine hold) | The fastest walkers walk back on their own, at their own speed, for a moment; nobody is pinned. It shares Fuu's push lock, so Fuu keeps her crowd niche and Ruri takes the runners |
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

Her round-5 row (`ruri: { boss: 9 }` in `src/data/balance.js` on `feature/balance-r5`) is re-fitted with the rework. Her boss damage now comes from Paw Prints, so a ×9 on the whole girl would overshoot that build. The kit sets the builds against each other, and the row sets the level.

### 2.6 What the sim needs (Ruri)

| Piece | How | Reuses |
|---|---|---|
| Pounce origin (Bounding Fox T3+) | `relay.hunt`: at each attack, her relay origin moves onto her first target (or to the leash edge toward it), and the volley leaves from there. At the wave clear it returns to Kon's lane spot | `relayOrigin` / `updateRelayOrigin` and the `relay` event; + − × ÷ and one sqrt |
| Lure foxes | `src/sim/lures.js` (new): road objects `{ uid, owner, pathIndex, dist, budget, ttl }` that lure walkers within ±0.3 tiles of path distance | the strip record (`src/sim/strips.js`) and the road-object caps |
| Lured | a `lure` status (`src/sim/status.js`); `src/sim/enemies.js` moves a Lured walker back by path distance; the lure lock and the push lock | the push lock, `KNOCKBACK_RESIST`, Freeplay Resolve |
| Paw Prints | a `prints` status with integer `stacks`; Trail's End in the on-hit step | `_hit` |
| ⚡ | `lure` in `ABILITY_DEPLOYS_RUN`; Spirit Fox is a boost | `src/sim/deploys.js`, the boost kind |
| Hash and saves | `hashSim` folds lure foxes only while there are any. Everything ends at the wave clear, so calm points hold nothing new | the zones pattern |

**Determinism:** integer step timers, no rng, no trig, and road movement by path distance. Victims are taken in uid order, or by (distance², uid) when a cap cuts the list.

### 2.7 How she looks

- **Kon:** the holo tint for each path from tier 3 (`applyHolo`, `src/models/companions.js`).
- **Bounding Fox:** a pounce arc from target to target.
- **Lure foxes:** Kon's own figure at half opacity with a soft outline. A Lured walker turns round and gets a small swirl over its head.
- **Paw prints:** small glowing prints on the ground under the enemy, one per stack, then Kon's leap and a flash that goes through the flash guard.
- **Spirit Fox:** Kon at 1.8× size with a gold rim for as long as it lasts.
- **Follow the Fox:** the lure foxes pop up along the lane in a quick ripple.
- **Reduce motion:** no flicker, no size pop, and Trail's End shows as a fade on the enemy instead of a leap.

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
| **Kaze's stoop** (main weapon, Hana's) | Hana raises her glove and Kaze stoops on his prey. He picks flyers still in the sky first (Priority order), then Startled enemies, then by her target mode. Each stoop is a guided strike from above the base that hits only its own target (the drones' guided shot, `src/sim/towers.js:2001`), about 0.35 s in flight. A flyer he hits is grounded | 16 damage, 0.6 stoops a second, reach 4.0, pierce, ×2 vs flyers, grounds 1.5 s |
| **Kon's run** (partner weapon, Ruri's) | Kon waits at his lane spot (her relay rule, leash 3.5). Every 2.5 s, when a walker is on his stretch, he dashes 2 tiles up the road through the oncoming walkers. He bites each one he passes once, and each is **Startled**. Grounded flyers count as walkers | 10 damage a bite; a run every 2.5 s (rate 0.4); 2 tiles at 8 tiles a second; mystic; Startled 2.5 s |
| **Flush and Stoop** (the trick) | Kaze picks Startled enemies before other walkers and deals ×1.5 to them. Kon deals ×1.5 to grounded flyers | prey bonus ×1.5 both ways |

Two damage types, pierce and mystic, suit the Eclipse Wyrm: it is weak to both (×1.5 and ×1.25) and drops feather. Kon's mystic bites also reach phasing ghosts.

### 3.3 Three paths

Prices sit inside today's windows (T2 ≤ 450, T3 ≤ 1,400, T4 ≤ 4,500, T5 12k–36k) and match the first duo's ladder. Only one path can go above tier 2.

| Path | Who leads | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| **High Stoop** (flyers, elites, bosses) | Kaze | Light Rotors 180: stoops +3 damage | Glove Whistle 400: Kaze stoops 15% faster | **Double Stoop** 1,300: each stoop takes 2 prey (with fewer, the extra stoops strike the first again); stoops ignore 2 armour | Wind Shear 4,200: stoops +14 damage, ×1.4 vs elites, ×1.25 vs flyers; grounded flyers stay down 1 s longer | **Cloudbreak Stoop** 26,000: 4 prey a stoop, +40 damage, damage and boss factors fitted on the bench (§3.6); the first stoop on each boss stuns it 0.3 s |
| **Fox Run** (ground crowds) | Kon | Quick Paws 170: Kon runs 15% more often | Long Run 380: runs +1 tile | **Scatter Run** 1,250: bites splash 0.5 (walkers beside his line are bitten too); Startled lasts 1 s longer | Strong Scent 4,000: bites +10 damage and shred 2 armour 3 s; Startled walkers move 15% slower | **Silver Trail** 24,000: runs 6 tiles, +30 bite damage; his run leaves a silver trail on the road for 2 s that Startles walkers who step on it; factors fitted on the bench |
| **Flush and Stoop ⚡** (the two together) | Both | Hand Signals 160: Startled lasts 1 s longer | Prey Drive 400: the prey bonus ×1.5 → ×1.75, both ways | **⚡ Flush and Stoop** 1,350: a stoop that hits a Startled enemy chains to the next Startled enemy within 1.5 tiles (1 chain, ×0.75 the stoop); **unlocks Wind Chase** | Startle Bark 4,300: Kon's runs knock down flyers over his stretch (grounded 1.5 s), and grounded flyers count as Startled; 2 chains | **⚡+ Shared Instinct** 28,000: every bite Startles for 5 s; 3 chains at the full stoop; factors fitted on the bench; **upgrades Wind Chase** |

- **Chains** pick by (distance², uid) among Startled enemies that stoop has not hit yet (`chainNext`, `src/sim/towers.js:1114`, limited to Startled enemies).
- **Awakening (★3): Kindred Companions.** +6% damage on stoops and bites, and Startled lasts 0.5 s longer.

### 3.4 Her ⚡ ability: Wind Chase

| | Value |
|---|---|
| Unlock and upgrade | Flush and Stoop tier 3 unlocks it and tier 5 upgrades it. Ability coins: 850 + 160 + 400 + 1,350 = **2,760** |
| Kind and scope | A runner (a new type, `chase`) with a stoop queue. **Map** scope: one cooldown per player, like Prismfall, because the LR finale reaches the whole map. No aim: it runs on Kon's lane (if he has several within his leash, the busiest one) |
| Tier 3 | Kon sprints 6 tiles up his lane from his spot. He bites every walker once (2× a bite) and Startles it for 5 s, and flyers within 0.6 tiles of his line are knocked down for 3 s. Kaze follows and stoops on each enemy Kon reached, in the order Kon reached them, one every 0.1 s (up to 10). Each stoop is 3× his stoop, with the prey bonus. Cooldown **40 s**; it starts ⅓ charged |
| Tier 5 (Shared Instinct) | 10 tiles, up to 16 stoops at 4× each. Cooldown **34 s** |
| LR form (§3.5) | After the last stoop, Kaze climbs out of sight and makes one **Daybreak Stoop** on the strongest enemy on the map: 10× his stoop, splash 1.2, white-gold |
| Auto-cast (default Off) | ≥ 6 enemies on Kon's stretch, or a boss on the road |

Like every ability, its hits never crit and scale with the duo's current hit, so it grows with each path's tier 5. Its shape differs from the other road and lane ⚡:
- Seiran's Dragonflight is a whole-road hero ultimate.
- Marumi's Giant Strike is a ball rolled to the spawn.
- Hana's Kaze's Swoop strikes only flyers, anywhere on the map.
- Prismfall is an aimed barrage.
- Ruri's Follow the Fox lures and deals no damage.

### 3.5 LR: Limit Break and the Daybreak form

**Route**, as for every LR unit (BANNERS §C.2, `src/systems/limitBreak.js`):
1. Level 60 with all 5 gates, and ★5 (UR).
2. Pay the Limit Break fee: 450,000 coins, 6 legendary and 3 Zenith feather materials, 1 Rainbow Crown.
3. Win her trial, **"The Field Survey"**: the wildlife club's survey of the monsters on the academy hill, with fast walkers and flyer swarms. Solo, from the player's own copy, with no Support Student. Until its map exists, the stand-in is 8-5 on Nightmare, as for the other two LR units.
4. The first clear makes her LR and pays 300 gems + 1 Recruit Ticket, once.

**The LR form, "Wind Chase · Daybreak".** A real kit change, because the owner wants LR "much more powerful":
- **Every build:** Kaze's stoops chain once more on Startled prey, and Kon's runs are 50% longer.
- **Every build:** the duo's damage × `RH_LR_MUL`, a knob fitted last (first guess 1.3).
- **Wind Chase** ends with the Daybreak Stoop (§3.4).
- **On top,** like every LR unit: LR_BOOST (×1.15 damage, ×1.05 speed; `src/systems/limitBreak.js:127`) and UR Resonance from ★5.

**Look:**
- the Nightglass frame and the LR sticker (DUO_LR §2.5);
- her crest: a paw print crossed by a feather;
- in battle, Kon glows white-gold and Kaze's wing edges turn white-gold;
- the unlock fanfare reads "LR: The Field Survey".

### 3.6 Target numbers against Kage

Each number is the duo's DPS ÷ the best Kage tier 5 on the same bench, on whatever is live when the duo is built (balance round 5 ships first). The light bench has no LR; round 5's bench runs her fully maxed, with LR where marked.

| Build (tier-2 crosspath) | Job | Light bench, crowd / boss | Round 5's bench, UR form, crowd / boss | Round 5's bench, **LR form**, crowd / boss |
|---|---|---|---|---|
| High Stoop 5 | bosses, flyers | ≥ 1.0 / ≥ 1.25 | ≥ 1.0 / 1.5–1.7 | ≥ 2.0 / **2.7–3.0** |
| Fox Run 5 | crowds | ≥ 1.25 / ≥ 0.5 | 1.5–1.7 / ≥ 1.0 | **2.7–3.0** / ≥ 2.0 |
| Flush and Stoop 5 | both | ≥ 1.0 / ≥ 1.0 | 1.3–1.5 / 1.3–1.5 | **2.5–2.8 / 2.5–2.8** |
| every tier 3 | | within ±20% of the SSR tier-3 median | | |

**What the band means.**
- The duo's best build reaches 2.7–3.0× on each ruler, and every tier-5 build stays at or above 2.0× on both.
- Kage's best tier 5 on round 5's bench reads about 2.2M on a boss and 1.8M on a crowd. So LR means roughly 5.6–6.7M on a boss and 4.6–5.5M on a crowd.
- Nothing goes above 3.0× in LR form: the band is a target, not a floor to run away from.

**Knobs, in the order to turn them:**
1. Each tier 5's own factors, with these first guesses:
   - High Stoop: stoop damage ×8, boss ×10, Kon's bites ×20.
   - Fox Run: bites ×30, stoops ×4, boss ×3.
   - Shared Instinct: both weapons ×20, boss ×2.5.

   The first duo needed ×6–×37 on damage and ×60–×150 on its partner weapon at tier 5 to clear Kage on these rulers (DUO_LR §6), so the factors look large by design.
2. The prey bonus.
3. `RH_LR_MUL`, last, so that only the LR form moves.

**The other LR units.**
- The owner's band is for LR units in general.
- In LR form today the first duo reads 1.74–1.88× on a boss and 2.2–4.4× on a crowd. Tenka has not been measured in LR form.
- The balance session lifts both into the same band (owner board Q8). The fox-and-falcon duo is fitted after that, so no LR unit ships above another's band.

### 3.7 How it differs from Kohaku & Tsubaki

| | Kohaku & Tsubaki · Prism Battery | Ruri & Hana · Fox and Falcon |
|---|---|---|
| Weapons | Tsubaki's aimed star shells (whole map, ground only, blast) + Kohaku's constant beam (3.6 tiles, pierces a line, hits flyers, mystic) | Kaze's stoops (4 tiles, one big guided hit, flyers first, pierce) + Kon's runs (up his lane, a bite on every walker he passes, mystic) |
| Shape | artillery on a spot anywhere on the map | a hunting pair on her lane: one runs the road, one falls from the sky |
| The trick | Refraction: a shell counter (every Nth shell splits into shards) | Flush and Stoop: two statuses hand prey back and forth (Startled walkers to Kaze, grounded flyers to Kon) |
| Aim | an aim point for shells and Prismfall | none: Kon and Kaze pick their own prey |
| Movement | both stand on the base | Kon runs the road, Kaze flies |
| ⚡ | Prismfall: a barrage of split shells on one spot | Wind Chase: a run up her lane and a chain of stoops on everything Kon startled |
| LR form | Twin Star finale, beams to the map edge, ×1.1 | Daybreak Stoop finale, one more chain, 50% longer runs, `RH_LR_MUL` |
| Best at | crowds anywhere | bosses and flyers, with her own lane's crowd |
| Solo versions | none | Ruri and Hana stay as their own units |
| Damage types | blast + mystic (the Foundry Titan's weak spots) | pierce + mystic (the Eclipse Wyrm's) |
| Family, trial | ember, Starfall Trial | feather, The Field Survey |

### 3.8 How both girls appear

| Where | Look |
|---|---|
| **Battle model** | Two chibis on one round base, each at 85% and turned 12° outward (`DUO_LAYOUT` rows for `ruri` and `hana` in `src/models/duo.js`): Ruri on the left with her tablet, Hana on the right with her glove up, both facing the camera. Kon sits at his lane spot and runs his stretch on each run, following the sim's runner. Kaze circles above the base (a 0.8-tile loop) and stoops onto each target. Ruri plays `attack` (a tablet swipe) on each run, Hana plays `attack` (glove up) on each stoop, and both `cheer` on Wind Chase. One selection ring goes round the base, with Kon's leash ring while the duo is selected. The duo's Kon wears Hana's olive wildlife-club bandana, so players can tell him from solo Ruri's Kon on the same board |
| **Portrait** | A **new pair picture**: no pair art of these two exists (the pair pictures are chika-ruri, ena-kanna, fuu-hana, kaede-suzu, noa-iroha, yoriko-seiran and kohaku-tsubaki). Both girls in their academy uniforms, Kon at Ruri's feet and Kaze on Hana's glove. The card is a slanted split card with the −8° seam (Ruri on the left, Hana on the right). The bust and thumb show both faces on the seam; the stand is two half-body cut-outs side by side. Files: `ruri_hana-{full,card,bust,thumb,cut,cut-s}.webp`, plus `PORTRAIT_DATA` face points |
| **Tower bar** | One card, one cost, the split thumb |
| **Battle panel** | **Overall / Kaze / Kon** tabs, the pattern the first duo uses. Glance view: STOOP · RUN · REACH and a MORE sticker |
| **Name and wiki** | "Ruri & Hana", "Fox and Falcon": one student page with two short bios and two quotes. The Info tab says "Duo"; the role label is "Duo Rangers" (role key `rangers`) |

**Bio (first draft):** "Two quiet students who met because their companions did: Kon kept chasing Kaze's shadow across the library courtyard until Ruri and Hana had to start talking. Now they patrol the academy grounds as a pair. Ruri reads the trail on her tablet and sends Kon running through the grass; Hana raises her glove and lets Kaze drop on whatever Kon startles out."

**Personality:** "Ruri whispers plans to Kon; Hana answers in bird calls. They have said about ten words to each other, and they are best friends."

**Quotes:** Ruri, "Kon, find them!"; Hana, "Kaze, take them!"

### 3.9 Rarity, banner, price, family, Potential

- **Rarity and class:** SSR form in data, gacha class `legend` (`UNIT_CLASS` in `src/data/banners.js`). ★5 shows her as UR, and Limit Break makes her LR.
- **Getting her:** only on her own LR Banner, **"Ruri & Hana · Field Trip Premiere"**.
  - 0.7% in her debut week (7 game days, carved out of the 1.5% SSR rate), then 0.5% in the daily LR tab.
  - Legend Promise at 300 pulls (`gl:ruri_hana`).
  - Never sparked, never a Select Ticket or Chosen Essence. Kindred SSR Essence works once she is owned.
- **SR rate-ups:** Ruri, Chigusa and Marumi. They are gacha-only SRs not yet featured on an LR banner, and Ruri is one so that pulls for the duo also bring solo Ruri copies.
- **Duplicates** give Essence. She gets one Potential row (SSR track, kit steps from P2):
  - P2 Sure Grip: +5% damage, stoops +1;
  - P3 Quick Trot: +7% speed, runs +0.5 tile;
  - P4 Keen Pair: +7% damage, prey bonus +0.1;
  - P5 Extra Chain: +8% speed, +1 chain;
  - P6 Paw and Wing: +9% damage, and every 6th stoop lands with a bite from Kon (×3, splash 0.6).
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
3. **The duo's sim and data, held:** in the game but not pullable, the Kogane and Norika pattern (`HELD`, `src/data/banners.js:37`). It rides the rework's update or the next one.
4. **The duo's art:** the pair picture and the figures. Display only.
5. **The duo's premiere:** banner, Limit Break and patch note. Not a sim change.

**Why this order:**
- The owner's first ask is the rework ("rework the other girl with the fox to be more unique and interesting"); the duo is the "maybe".
- The rework fixes a girl players already paid for. It also closes the last two waiting ⚡, which v0.1.61 promised.
- It is cheaper: one girl's kit, her own art and Kon's own figure.
- It decides what solo Ruri *is*, so the duo can be built not to copy her.
- Shipping the duo first would read as "the fix for Ruri is behind a paywall".
- The duo's art does not exist yet and takes the longest, so her sim can wait, held, while it is made.

**Fairness for players who own Ruri and Hana:**
- **Nobody loses a girl.** Solo Ruri and Hana stay, with level, gates, stars, Potential, gear and bond. Nothing is merged, retired or consumed, and no duplicate is needed for anything.
- **Ruri gets better first, for free.** No job falls: her best crowd build and her best boss build both land at or above today.
- **The duo is not a strict upgrade of either girl:**
  - solo Ruri keeps her lures and paw prints;
  - solo Hana keeps her team mark (Hunter's Mark), her volleys and her map-wide Swoop;
  - the duo has none of these.
- **Pulls for the duo help Ruri:** she is an SR rate-up on the duo's banner.
- **A gift for owners of both:** owning solo Ruri and solo Hana unlocks a free bond scene, "Kon Meets Kaze", and the profile title "Old Friends". It needs no duo and gives no power.
- **New figures for the solo girls too:** the figures and effects made for the duo (§5.2) also go to solo Ruri and Hana, display only.
- **The LR rules hold:** harder to pull, a rate-up banner, no spark, the Legend Promise at 300, and a clearly bigger boost.

---

## 5. Impact

### 5.1 Sim and co-op

| Step | Files in the co-op graph (`tools/simId.mjs`) | Sim id / `COOP_PROTOCOL` |
|---|---|---|
| Ruri's rework | `src/data/unitsExpansion.js` (her kit and names); `src/data/abilities.js` (her three ⚡); `src/data/balance.js` (her round-5 row); `src/sim/status.js` (`lure`, `prints`); `src/sim/enemies.js` (Lured movement); `src/sim/towers.js` (pounce origin, Trail's End); `src/sim/lures.js` (new); `src/sim/abilities.js` (the `lure` deploy); `src/sim/constants.js` (`LURE_*`, `PRINT_*`, lure caps); `src/online/coop/simHash.js` (lure foxes) | A new sim id behind `PENDING_BUMP` on its branch. The release takes the next free protocol: **15** if nothing else ships first |
| The duo, held | `src/data/unitsDuo.js` (`RURI_HANA` in `DUO_UNITS`); `src/data/abilities.js` (Wind Chase with its `lr` form); `src/sim/duo.js` (the partner weapon becomes a dispatch: `beam` for the first duo, `run` for this one); `src/sim/runners.js` (Kon's run and the `chase` type); `src/sim/towers.js` (prey order, guided stoop, chains); `src/sim/status.js` (`startled`); `src/sim/constants.js` (`RH_LR_MUL`, `STARTLE_*`, chain caps); `simHash.js` (runs and chains) | Her own protocol, or the rework's if both ship in one release. Never bump twice for one release |
| The duo's art, banner, Limit Break and scene | renderer, `src/data/banners.js`, `src/systems/limitBreak.js` (`LR_TRIALS`), portraits, figures: none of them is hashed | **No change** |
| The Field Survey's own map (later) | `src/data/stages.js` and `src/data/maps.js` are in the graph | A bump |

- Stats travel in the loadout, so `lr: true` reaches a co-op partner as it does for the first duo.
- Each sim step gets a scripted engines battle (V8, JavaScriptCore and SpiderMonkey bit-identical) that includes a mid-wave rejoin: `RURI_START` and `FOXFALCON_START`.

### 5.2 Art

| Item | Who and how | Used by |
|---|---|---|
| Kon's three looks, lure foxes, paw prints, Spirit Fox, Follow the Fox | us: holo tints on Kon's figure and effect sprites; display only | solo Ruri |
| **The duo's pair picture** and its crops (full, card, bust, thumb; the stand is two half-body cut-outs) | The art v3 tool in Look B, with Ruri's and Hana's own portraits as the only references: about 12 images at about 5 Anlas each, so about 60 Anlas. The owner says yes first. Or the owner draws it | the duo |
| **3D figures, made by the owner in Tripo:** Ruri, Hana, Kon and Kaze | The four models: Ruri and Hana in their academy uniforms; Kon, a small white fox with big ears and a fluffy tail; Kaze, a falcon-shaped drone with a camera eye and tech panels. We conform them:<br>• the girls: the 25-joint game skeleton and five clips;<br>• the companions: idle, move, attack and appear, plus Kon's run and Kaze's circle and stoop;<br>• LODs, painted eyes, and FX anchors (Ruri's tablet, Hana's glove, Kon's mouth, Kaze's talons) | the duo, and solo Ruri and Hana too. Until then the duo uses today's GLBs (`ruri.glb`, `hana.glb`, `kon.glb`, `kaze.glb`) |
| Companion manifest | `owner` becomes a list (`kon` → `ruri`, `ruri_hana`; `kaze` → `hana`, `ruri_hana`); the duo's Kon gets the bandana | both |
| Duo effects (`src/render/attackFx/styles/ruri_hana.js`) | Kon's run (a dust and holo streak); a small burst of grass and feathers on each Startled enemy; Kaze's stoop streak (from Hana's style); chain arcs; Wind Chase; the Daybreak Stoop; the paw-and-feather LR crest and fanfare | the duo |

**Rules for the art:**
- Students are never sexualised: both girls are fully in uniform and framed at eye level or above.
- Generators only get the game's own art, and prompts name no girl, game, studio or artist.
- No third-party image is ever committed.

### 5.3 The banner

- `UNIT_CLASS.ruri_hana = 'legend'`. While she is in `HELD`, she is in no pool, list, rate-up, spark or Select Ticket.
- A `PINS` row: "Field Trip Premiere", 7 days at 7,000 ppm, SR rate-ups Ruri, Chigusa and Marumi, `debut: true`, `hold: true`.
- `LEGEND_SR` and `LEGEND_NAMES` ("Field Trip") rows.
- A new `LISTS.legend` version that adds her. Its `since` is at least 3 game days after the patch note that adds it, on a day the old cycle ends; `tests/systems/banners.test.js` checks both.
- `spark()`, `redeemSelectTicket()` and Chosen Essence already refuse every `legend` unit.

### 5.4 Saves

- **Profile:** additive only, so no `SAVE_VERSION` bump.
  - `units.ruri_hana`;
  - the counters `lbt:ruri_hana`, `lr:ruri_hana` and `gl:ruri_hana`;
  - the "Kon Meets Kaze" flag and the "Old Friends" title.
- **Battle saves:**
  - Calm points hold none of the new state: runs, chains, lure foxes, lures and prints all end at the wave clear, and Kon's pounce origin returns to his spot.
  - A battle saved before the rework keeps Ruri's tier counts by path index. So a Star Falcon Ruri comes back on Fox Tricks at the same tier, paid with the same coins. Her patch note says so.

### 5.5 Tests

| Area | Tests |
|---|---|
| Data | `tests/data/units.test.js`: the roster count +1; rarity totals; the look guard on the duo; footprint 0.5; the price band; path and tier names unique across girls, with the renames. A new "Ruri is not Hana" check: no `airMul`, `ground` status or `detection` anywhere in Ruri's paths |
| Data | `tests/data/abilities.test.js`:<br>• `RURI_PATHS` becomes Moon Pounce 1,780, Follow the Fox 1,790 and Spirit Fox 1,860, and all three run;<br>• the duo has exactly one ⚡ path;<br>• `carry` and `river` leave the vocabulary;<br>• ability names are unique and absent from every path, tier, title and enemy name |
| Data | `tests/data/potential.test.js` (the duo's row); `tests/systems/banners.test.js` (class, no spark, pin, the `since` rule, `hold`); `tests/systems/limitBreak.test.js` (her trial row, a feather fee) |
| Sim | **New `tests/sim/ruriFox.test.js`:**<br>• the pounce origin: onto the target, inside the leash, home at the wave clear;<br>• lure foxes: placement, budget, caps, wave clear;<br>• the lure: backwards by path distance, clamped at START, bosses immune, minibosses half, the 8 s lock, the push lock with Fuu, Freeplay Resolve;<br>• paw prints: stacks, expiry, Trail's End, two Ruris;<br>• Follow the Fox and Spirit Fox |
| Sim | **New `tests/sim/foxFalcon.test.js`:**<br>• Kaze's prey order; the guided stoop hits only its target; grounding;<br>• Kon's run: integer tick timer, one bite per enemy per run, shared stretches, waits with no prey;<br>• Startled, and the prey bonus both ways;<br>• chains (order and caps) and Startle Bark;<br>• Wind Chase: runner and stoop queue, map-scope cooldown;<br>• the LR form from `lr: true` in battle stats;<br>• save and restore at a calm point |
| Sim | • Determinism: the same battle plain and inside `withDetMath`, with `hashSim` equal every 60 ticks.<br>• Goldens (`abilitiesGolden`, `campaignGolden`, `modesGolden`) re-pinned with no win becoming a loss.<br>• `tests/sim/perf.test.js`: 6 copies of each new build at tier 5 with 200 enemies, under 2 ms a step.<br>• `tests/art/itemArtRuntime.test.js`: `PENDING_BUMP`, then `KNOWN[n]` |
| Co-op | `tests/online/engines.test.js` and `e2e/engines.mjs`: the two scenarios, with `--require-all` before ship |
| Render and UI | `tests/render/companions*.test.js`: Kon's looks, lure foxes, Kaze circling and stooping for the duo, Reduce motion. `tests/models/duo.test.js`: the layout rows and model ids. The girl page: the duo, her LR chip and Ruri's Tree tab stickers |
| e2e | `e2e/abilities.mjs`: Ruri's three casts and Wind Chase. A new `e2e/fox-falcon.mjs`: the duo on 1-1 with a run, a stoop chain, Wind Chase and LR. `e2e/recruit-banners.mjs` and the smoke run |
| Balance | • The light bench (mean of four configurations) and round 5's bench (3 seeds): Ruri's "no job falls" and the duo's bands in §3.6.<br>• Finales: no win becomes a loss.<br>• Titans: `r5Titans` with the duo, so UR_LATE never beats the Eclipse Wyrm.<br>• The Tryout ceiling gate |

### 5.6 Milestones (each ships on its own)

| # | What | Ships as | Gate |
|---|---|---|---|
| **M0** | This note and the owner board | — | the owner's answers ("default all" works) |
| **R1** | Ruri's rework: her kit, the renames, three ⚡, the new statuses and objects, her round-5 row re-fitted, plain looks (Kon's tints, lure foxes as copies of Kon, print sprites) | a co-op update after round 5 | independent review OK; both benches; "no job falls"; engines; perf; go/no-go; patch note |
| R1a / R1b | Only if time runs short:<br>• **R1a:** Fox Tricks and Follow the Fox replace Star Falcon; Tide Otter stays.<br>• **R1b:** Paw Prints and Spirit Fox replace Tide Otter, together with Bounding Fox's crowd fit, so her crowd job never falls in between | two co-op updates | the same |
| **R2** | Ruri's look: polished effects, her Tree tab stickers, and the owner's Tripo Kon if it is ready | display only | the fast lane if it is looks only |
| **D1** | The duo's sim and data, held: the unit, partner dispatch, Startled, stoops, runs, chains, Wind Chase, the LR form, her Potential row, text, and plain looks (today's GLBs on one base) | a co-op update (it can share R1's) | the full gate; the duo's bands measured |
| **D2** | The duo's art: the pair picture and crops, the four Tripo figures (for the solo girls too), the duo's effects, her LR crest | display only | an owner board with screenshots; a visual review |
| **D3** | The premiere: un-hold, the pin, rate-ups, `LR_TRIALS` (The Field Survey, with the 8-5 Nightmare stand-in), "Kon Meets Kaze" and "Old Friends", the patch note | no sim change | go/no-go; live check |
| D4 | Later: The Field Survey's own map | a co-op update | the full gate |

### 5.7 Risks

- **Lures and pushes could lock a wave.** One push lock covers both, the lure has its own 8 s lock, and Freeplay Resolve clips lures. Tests run Ruri and Fuu together.
- **Bounding Fox's moving origin can surprise players.** Her range ring moves with Kon, and the tier text says "Kon leaves his spot and hunts".
- **Power creep against the first duo.** The band is fitted on all LR units together (§3.6), and nothing goes above 3.0× in LR form.
- **The Eclipse Wyrm is weak to both of the duo's damage types.** Titan battles read no round-5 row (`TITAN_POWER` false), and the gear rule "UR_LATE never beats the Eclipse Wyrm" is re-checked with the duo at LR.
- **Two Kons can be on one board** (solo Ruri's and the duo's). The bandana tells them apart.
- **Art keys.** The NovelAI and Meshy keys are not in this environment yet (both answer 401). The pair picture waits for the owner's key or the owner's own drawing, and the Tripo figures are the owner's to make.
- **Tide Otter players lose the otter.** Bounding Fox takes over its crowd job at the same level or higher, and the patch note says where her old paths went.

---

## 6. Questions for the owner

The questions are on `docs/review/ruri-hana-duo/OWNER_BOARD.md`, each with a recommended default. "Default all" takes every one.

---

## 7. For the builder (short)

- **Data:**
  - Ruri's path ids: `hound` stays; `falcon` → `tricks`; `otter` → `prints`. Path ids live only in unit and ability data, never in saves.
  - Her names and her three ability rows; the `abilityText.js` rows, with the `lr` text for Wind Chase.
  - `RURI_HANA` in `src/data/unitsDuo.js`:
    - `kind: 'tower'`, `rarity: 'SSR'`, role key `rangers`, `materialFamily: 'feather'`, `footprint: 0.5`;
    - `duo: { members: ['ruri', 'hana'] }`;
    - the main stoop spec and a `pair` (run) partner spec;
    - three paths and Kindred Companions.
  - Rows in `potential.js`, `potentialText.js`, `potentialBoards.js`, `gearStats.js` (`GEAR_FIT`), `unitTips.js` and the wiki (with the "Duo Rangers" role label).
- **Sim:**
  - the partner dispatch in `duo.js` (`beam` | `run`);
  - a `stoop` target rule on the guided shot (sky flyers → Startled → her mode);
  - Kon's run on the runner record, with the shared-stretch rule;
  - `startled` and `lure` as plain timed statuses, and `prints` as an integer stack;
  - lure foxes as road objects;
  - the `chase` runner, with a stoop queue on `sim._abilQueue`;
  - `RH_LR_MUL`, read from `unitStats.lr` like `DUO_LR_MUL`.

  Report each sim id; the coordinator bumps `COOP_PROTOCOL` once per ship.
- **UI:**
  - the panel's Overall / Kaze / Kon tabs (the first duo's pattern);
  - Ruri's tier text, which now explains Lured and Paw Prints;
  - the LR crest row in `lr.css`;
  - the girl page's "Duo" line;
  - the "Kon Meets Kaze" scene and the "Old Friends" title.
- **Art:**
  - `DUO_LAYOUT` rows for `ruri` and `hana`, and `modelIds` for the duo;
  - companion owners as lists;
  - the `ruri_hana` attack-FX style;
  - the portrait crops with the seam;
  - an originality check on the duo's art (UNIT_GAPS §4.3).
- **Docs:**
  - this note's decision log;
  - UNIT_GAPS §4.1's Ruri row ("beast tamer") points here;
  - ABILITIES §5.2's Ruri and Hana rows point here.
