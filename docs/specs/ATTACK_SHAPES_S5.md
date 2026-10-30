# Attack shapes S5: six more unique attacks

| | |
|---|---|
| Status | Design spec, **nothing built**. Waits for the owner's yes on the board (`docs/review/attack-shapes-s5/`) and a reviewer's OK on this page |
| Owner request | Oct 30, 2026: six more "unique attack reworks", one path each, the shape arriving at tier 4–5, other paths unchanged, plain effects first. **No nerfs** (shapes may be stronger) |
| Written against | `origin/feature/balance-r5` b2f4345c (S1–S4 merged in, balance round 5, the no-nerf gate `tools/balance/noNerfGate.mjs`); sim id PENDING_BUMP {13: `3e9875ef40f9`}; `COOP_PROTOCOL` 13 live |
| Builds on | `docs/specs/ATTACK_SHAPES.md` §4 (shared blocks), §5 (catalogue), Addendum A2–A9 (S1–S4 as built, the parity method); `docs/BALANCE.md` round 5 (the Blade Cyclone rule, the no-nerf gate) |
| Rule | Every name on this page is our own. No other game, show or studio is named here, in code built from it, or in its patch notes |

---

## 0. On one screen

| # | Girl | Path, tiers | Shape (our name) | Built on | What the player sees |
|---|---|---|---|---|---|
| 1 | **Midori** | Field Kit: T4 Paralysis Spore, T5 Elixir Barrage | **Spore Mist** (Hearth Stream, poison kind) | `channel.js`, `held.js` stream, `inCone` | A wide, short cone of green mist pours from her flask and follows her target. Everything in it is poisoned and keeps its poison after leaving. Her flasks still fly. |
| 2 | **Raika** | Storm Rhythm: T4 Thunder Festival, T5 Endless Thunder | **Static Web** (Spirit Tether, static kind) | `links.js` group record and tie walk, `chainNext` | The enemies her bolt jumps between stay linked by crackling static for 2 s (3 s). A zap runs along the links 4 times a second and strikes every linked enemy. |
| 3 | **Rei** | Whirlwind: T4 Tempest Dance, T5 Thousand Petal Storm | **Crescent Return** (Homecoming Throw) | `links.js` leg flip, straight shots | Each sweep still cuts everything in her reach. It also sends a pink crescent of air past her reach. The crescent turns and comes back, cutting the walkers her sweep could not reach. |
| 4 | **Luna** (hero) | Lances: Lv 22 Lunatic Lance (lances.5), Lv 25 Lunar Sovereign | **Moonbeam Sweep** (Searchlight Sweep) | `held.js` sweep, `nearSegment` | Her moon beams still flash at her targets. A held moonbeam also swings across them with every volley. From Lv 25 a second moonbeam swings the other way. |
| 5 | **Miko** | Purification: T4 Divine Wind, T5 Amaterasu's Mirror | **Charm Wheel** (Blossom Wheel + a turning offset) | `wheels.js` spokes, `spawnStraight` | Each throw (or mirror flash at T5) is followed by a wheel of paper charms that flies out all round her. The wheel turns a little with every throw, so it reads as a spinning wheel of charms. |
| 6 | **Suzu** | Explosive Mines: T4 Chain Mines, T5 Grand Bell Detonation | **Bell Toll** (Ripple Quake from her traps) | `ground.js` `sendQuake`, `inBand` | Every bell rings as it arms and then on its own clock, sending a gold shock ring rolling across the road around it. The bells still go off when stepped on. |

The S5 design rules, from what S1–S4 and round 5 learned (§1):

1. **Her live attack stays; the shape goes on top.** This is the Blade Cyclone rule (`docs/BALANCE.md` "Blade Cyclone never below her aimed volley"). It is the only construction that keeps "no nerfs in any scenario" without one rescue round per girl.
2. **Shape hits are clean.** They carry damage only: no statuses, marks, pushes, splash or silence. Midori's mist carries her poison and nothing else. This is S1 A3 #7, S3 A8 #9 and S4 A9 #2 again.
3. **Shape hits draw no rng.** A shape hit takes her expected crit as a plain multiplier, `1 + chance × (mul − 1)`, and never rolls. The shared `sim.rng` therefore sees exactly live's draws. That removes the partner and seed noise of A7 / A9 and makes the gate's live-vs-branch cells exact.
4. **A lone enemy reads live.** Where a shape would hit the enemy her attack just struck, it rolls past it (Kanna's quake rule, A8 #9). The gain lands on crowds. Suzu's tolls are the exception: a bell rings for whoever stands by it.

With 1–3, every gate cell is live's number plus the shape's damage. The bench heals targets every step, so their paths, statuses and rng are identical. The tuning question is therefore **how much stronger**, never "is anything under". The proposal (Q9) is her ruler +10–30 % at the shape tiers, the Blade Cyclone's range.

---

## 1. Why these rules (what S1–S4 and round 5 taught)

- **Replacing an attack at parity fails somewhere.** Kage's Blade Cyclone met parity on two rulers and fell to 0.67× live on the ability bench's pinned column. Four fixed arms met a packed crowd that her aimed volley cut 10× better (`docs/BALANCE.md`, Oct 30). The fix that held was "her aimed volley every attack, the arms on top at `SPIN_ARMS_SHARE` 0.25". Before that fix, S2–S4 each needed per-stage rescues: Umeko's boss rows, Chigusa's partner, Yuki's maxed hit bench.
- **Crowd control laid by a shape on everything in reach reshapes the bench's never-dying pile.** Yuki's two full spikes read ×2 on round 5. Kanna's statused rings read ×1.3. Fuu's statused way home read 0.66 / 1.25. Clean hits fit every ruler.
- **New rng draws move other girls' numbers.** Akane's held ticks and Fuu's two-cut fans moved Aoi's crit rolls by up to ±14 % per stage (A7, A9). With rule 3 the partner's cells are bit-identical, so a gate miss can only be a real miss.
- **The attack loop must keep counting.** Potential rhythms, gear tricks and drinks count her attacks (A3 #2, A7 #2, A9 #4). With rule 1 her attack loop is untouched, so every Potential key, gear trick, drink, ability and mirror copy keeps working as live. The shape only reads her attack (its spec, its victims, its moment).

---

## 2. Shared pieces for S5 (small; everything else is reuse)

| Piece | Where | What |
|---|---|---|
| `shapeSpec(t, spec, mul)` | `src/sim/shapes.js` (new helper) | The clean copy (rule 2) of her attack spec for a shape hit: `status: []`, `procStatus: null`, `mark: null`, `silence: 0`, `reveal: 0`, `knockback: 0`, `gather: 0`, `splash: 0`. It also folds in `critChance: 0, critMul: 1` and multiplies `damage` by `mul × (1 + c × (m − 1))` from her spec's crit (rule 3). It sets `share: mul` so flat armour and the 1-damage floor scale with it (A8 #1). It generalises `sendQuake`'s `clean` (`ground.js:149`) and Kaede's `bladeSpec`. |
| The `S5` constants block | `src/sim/constants.js`, appended | Caps, clocks and widths below. One block, as S1–S4. |
| `endS5Wave(sim)` | beside `endHeldWave` / `endLinkWave` / `endGroundWave` | Every S5 object ends at the wave clear. Calm-point saves and co-op checkpoints carry none. |
| `hashSim` folds | `src/sim/Sim.js` | Each new list folds only while non-empty (old battles keep their hash). |
| Battle-save classes | the snapshot classifier | New lists `calm`; per-step scratch `scratch` (S4 pattern). |
| Shape DPS for the panel | `shapeDps` / `heldDps` / `linkDps` | Each new shape adds its on-one-target and crowd lines, so the honest readout and the drawer follow it (the S1 rule, A4 last paragraph). |

The existing shared blocks used as they are: the direction table (`src/sim/dirs.js`: `nearestDir`, `turnToward`, `COS2`, `dirAngle`), the shape tests (`inCone`, `nearSegment`, `inBand`, `inDisc`), the held channel (`channel.js`), the leg flip (`retFlip`), the tether group record and walk (`tieTether` / `nextLink`), `sendQuake`, `spawnStraight` / `straightRoom`, `chainNext` (`towers.js:1163`).

---

## 3. The six, girl by girl

Tier numbers below are **starting values for the bench fit**, not final. Every shape knob is a plain per-tier field on the tier's mods (A3 #9), so the data reads as the fit set it.

### 3.1 Midori: Spore Mist on Field Kit T4–T5

**Why this path.** Field Kit is "Mist, flyers and paralysis" (`src/data/units.js:906`). Its T3 Drifting Mist already makes her clouds rise high enough to reach flyers (`units.js:909`), so a held mist is the path's own promise. Two more reasons:

- The no-nerf gate's support build is **Midori 5-0-2** (Toxicology T5, Field Kit T2). A Field Kit T4–T5 rework never changes the support beside the 31 other girls, so the gate's 1,395 "supported" cells per profile do not move. A Toxicology rework would change every one of them (Q4).
- Her ⚡ Catalyst Burst lives on Toxicology T3 (`src/data/abilities.js:317`) and stays untouched.

| Tier | Live (`units.js:910-911`) | With the shape |
|---|---|---|
| T3 Drifting Mist | flasks hit flyers, slow 25 % | unchanged |
| T4 Paralysis Spore | 20 % stun 0.4 s, +0.4 splash, +20 % speed, pen 2, +20 % damage; brew 3 girls | all of that, **plus Spore Mist**: half-angle 45° (30 table steps), length 0.75 × her range (STREAM_KINDS.poison `lengthMul`), at most 24 victims a tick, `mist.mul` 0.12 |
| T5 Elixir Barrage | four flasks a throw, +50 % speed, poison 12/s, +6 damage; brew 4 girls | all of that, **plus Spore Mist**: half-angle 54° (36 steps), 32 victims, `mist.mul` 0.15 |

**Player sees.** She holds her round flask out and a soft green mist pours from it in a wide, short cone. The cone swings after her target at the stream's turn rate. Walkers inside take tiny ticks and show the poison look, which stays after they leave the cone. Her flasks still arc out and splash as today; at T5 four of them a throw. Tier text, T4: "…; a mist of spores pours from her flask in a wide cone, poisoning everything in it." T5: "…; the spore mist widens."

**Sim.** This is Akane's Hearth Stream (`held.js`, `behavior: 'stream'`) with `STREAM_KINDS.poison` (`held.js:46`, data until now). Here it runs as a **kit beside her attack**, not as her behaviour:

- Her behaviour stays `projectile` (rule 1). Her held channel `t.ch` is opened by her counted attack and ticks after the attack loop in `updateTower`, as S2 does (A7 #2). Lock, `turnToward`, grace and release come from `channel.js`.
- Every `CH_TICK` (6 steps) the cone (`inCone` over `sim.grid.query`, victims by (d², uid), capped) strikes each victim once with `shapeSpec(t, spec, mist.mul × rate × CH_TICK × STEP)` and the tip falloff (`streamFalloff`, × 0.85 at the tip). Its status list is **her poisons only**: every `poison`-type entry of her spec, Potential P4 Evergreen Venom's `statusAdd` poison included. No chance, so no rng.
- Her slow and her paralysis stay on the flask (rule 2). The paralysis keeps its live 20 % roll per flask hit, so her stun count and rng are live's.
- The mist reaches flyers from T3 on, because her spec has `canHitAir`.
- Gear Pierce adds victims (A7 #8's carry into `t.ch.px`).
- State is `t.ch` only (integers), ended by a sabotage, a Move, her sale or the wave clear.

**Must keep working.** Swift Draught brews (her kit timer, untouched). The P5 Cauldron Bomb rhythm, which is her flask harder with a splash, untouched because the flask is her attack. P6 Double Batch (+1 brew target). P2 / P4 `dotMul` scale the mist's poison as they scale the flask's. Drinks and gear scale her spec. The mist reads it. Catalyst Burst (another path) is unaffected.

**Parity.** Poison merges keeping the stronger values (`status.js:96-106`). The mist re-applies the same poison her flask does, so enemies she already poisons gain only refresh, and enemies outside her splash gain her poison. Boss cells: the held boss is in her splash already. Its gain is the mist's ticks plus refresh, small (the lone-enemy rule cannot apply to a held stream; the ticks are her ruler's +). Her ruler is "judged by boost" (`docs/BALANCE.md` round 5), and her brews are unchanged. Her own crowd number is expected to land at +15–30 %.

**Risk.** The credit of a merged poison. If a merge keeps the stronger poison's *source*, the supported cell's Toxicology Midori keeps credit on shared enemies, as live (no loss). If it keeps the last applier, the mist moves credit toward her (a gain on her cell, a loss on the support's own, which the gate does not measure). Read `status.js` and test both before the fit.

### 3.2 Raika: Static Web on Storm Rhythm T4–T5

**Why this path.** Storm Rhythm is "Tempo and interrupts" (`units.js:1038-1044`), and the original catalogue put "a lingering static link" there (ATTACK_SHAPES §5.10). Endless Thunder (T5) names the "keeps zapping" half. Forked Lightning is her pure-chain and boss path (Raijin's Wrath ×2.5 vs bosses) and Overcharge her lance, so both stay. Her ⚡ Drumstorm (`abilities.js:332`) is on this path. It adds +2 / +4 jumps for its duration, so Drumstorm webs grow with it.

| Tier | Live | With the shape |
|---|---|---|
| T3 Drum Roll | +30 % speed, silence 0.5 s | unchanged |
| T4 Thunder Festival | +40 % speed, +2 jumps, silence +0.5 s, pen 3, +25 % damage | all of that, **plus Static Web**: links last 2 s, a zap every 15 steps (0.25 s), `zap.share` 0.15 |
| T5 Endless Thunder | double speed, +8 damage, +3 jumps, Brittle + crack, +45 % damage | all of that, **plus**: links last 3 s, a zap every 12 steps (0.2 s), `zap.share` 0.2 |

**Player sees.** Her bolt jumps from enemy to enemy as today. The enemies it struck then stay joined by thin flickering yellow zig-zags. Four (five) times a second a zap runs along the zig-zags and every linked enemy jolts. When linked enemies drift too far apart the link snaps, and when fewer than two remain the web fades. Tier text, T4: "…; the enemies her bolt strikes stay linked by static for 2 s, zapped 4 times a second."

**Sim.** It reuses S4's group record and tie walk, but **not the `_hit` share hook** (Q5):

- A static web is `{ uid, owner, m: [enemy…], left, zapCd }` in a new list `sim.statics` (not `sim.tethers`). Ena's threads and Raika's webs then coexist on the same enemy without fighting over `e.tie`. Members are her first bolt's chain in hit order (`attackChain`'s `hitSet` order, `towers.js:1179`), capped at STATIC_MEMBERS 12. A chain of one (a lone enemy) makes no web, so a lone boss reads exactly live (rule 4).
- Her counted attack: if her lead target is already in one of her webs, that web's `left` is refreshed and nothing new is made (S4 A9 #10). Otherwise a new web is made, unless every member is already in a web, any owner's (a second Raika makes none: no double zaps). Caps: STATIC_PER_GIRL 4 (her oldest goes first), STATIC_PER_SIM 48 (no new web past it).
- Each step, for each web in creation order: `left−−`. When `zapCd` hits 0 it resets to `zap.every`. Members that died, entered a tunnel or stand further than STATIC_REACH (her `chainJump(spec)` × 1.5) from the previous member in the list drop out. Then every remaining member takes one hit of `shapeSpec(t, spec, zap.share × rate × zap.every × STEP)`, so a second of zaps is `zap.share` of one of her bolts on each member. Shock, silence, Brittle and crack stay on the bolt (rule 2). With fewer than 2 members, or `left` 0, the web ends.
- Zap budget: STATIC_ZAPS_PER_STEP 128. Past it, the remaining webs skip this zap (their `zapCd` stays 0 and they zap next step). That is a deferral, not a drop, because zaps are her own damage. The stress board's expected peak is about 30.
- Her eligibility for the zap is her spec's (`canHitAir`, veils by her detection). Members are walked with `chainNext`'s tie order, so the same enemies are picked as by her bolt.

**Must keep working.** P3 Branching Bolt (+1 jump) and P6 Monsoon Drum (+1 jump; soak every 4 attacks) make bigger webs. The P4 / P5 Thunderhead novas are on her bolt, untouched. Soak's +15 % lightning bonus applies to zaps because they are lightning hits. Drumstorm's jumps. Gear Pierce adds jumps (`shotPierce`) and so members. Drinks.

**Parity.** The boss and walking boss are exact (no web on a lone enemy, no rng). Crowd: + zaps on up to chain+1 members. She is a crowd girl (ruler 2.20M), so the expected crowd lands at +15–25 %.

### 3.3 Rei: Crescent Return on Whirlwind T4–T5

**Why this path.** Whirlwind's T3 is already called Crescent Gale (`units.js:366`). Its T4–T5 are her crowd tiers, and the catalogue listed "Rei (a thrown blade wave that returns)" under Homecoming Throw (§5.6). Duelist (single target) and Counter Form (stun / knockback) stay. Her ⚡ Hurricane Draw (`abilities.js:265`, rate ×2.5–3) throws more crescents for its duration, under the caps below.

| Tier | Live | With the shape |
|---|---|---|
| T3 Crescent Gale | 9 targets, +2 damage, +0.3 range | unchanged |
| T4 Tempest Dance | +50 % speed, +4 damage, +4 targets, ×1.25 elites, +30 % damage | all of that, **plus Crescent Return**: one crescent per sweep, out to her range + 2.0 tiles and back, half-width 0.45, 6 cuts a leg, `ret.mul` 0.3 a cut |
| T5 Thousand Petal Storm | hits everything in reach, +14 damage, +60 % speed, +0.6 range, crits, ×2.5 bosses | all of that, **plus**: out to her range + 2.5 tiles, 10 cuts a leg, `ret.mul` 0.35 |

**Player sees.** She draws and everything in her reach falls as today. A pale pink crescent of air also leaves her blade toward her target, flies on past the edge of her reach, slows, turns and comes back to her. It cuts walkers further down the road both ways. Tier text, T4: "…; every sweep sends a crescent wave out past her reach and back."

**Sim.** Fuu's fan (`attackReturn` / `retFlip`, `links.js:59`, `:134`) as a **straight** throw, since her Whirlwind has no push, so S4's homing fix (A9 #1) is not needed:

- After her pulse (`attackPulse`, `towers.js:899`, untouched), she spawns one straight record (`spawnStraight`) along `nearestDir(lead − her)`. `ret: { leg, k }` and `maxTravel` = her range + `ret.out`.
- At `maxTravel`, `retFlip` negates the velocity exactly (no trig) and resets the hit list. The way home ends at her. Swept collision uses `nearSegment` with the half-width.
- Both legs' hit lists are pre-seeded with **the victims of the sweep that threw it** (rule 4). A held boss in her reach is never cut by her crescent, so her boss rows are exact. A walking boss is cut on the way in, before it reaches her.
- Each cut is `shapeSpec(t, spec, ret.mul)`. Her crits, ×2.5 vs bosses and ×1.25 vs elites ride on the multiplier (her spec's tier multipliers stay; S4 A9 #8). She never waits for a crescent (A9 #4).
- Caps: CRESCENTS_PER_GIRL 8 (her oldest ends early), under the straight-shot cap (`straightRoom`, 400). Gear Pierce adds cuts a leg (her pulse's carry, A7 #8).

**Must keep working.** P3 Third Step and P5 Breaking Petal rhythms, which are her sweep harder with a stun / shred: one crescent per counted sweep, statuses on the sweep only. P6 Twin Crescent's echo (`echo: 0.3`): an echo is one more sweep, so one more crescent, at the echo's share (`mul × 0.3`). Hurricane Draw's `maxTargets: 99` means her sweep takes everything in reach and the crescent only what lies beyond.

**Parity.** The held boss is exact. The walking boss and crowd gain. Her ruler is crowd (1.82M), expected +15–30 %.

### 3.4 Luna (hero): Moonbeam Sweep at Lv 22 and Lv 25

**Why these levels.** A hero has no paths. Her Lances branch is her beam line (`src/data/heroTracks.js:108-135`). Lances.5 at **Lv 22 "Lunatic Lance"** is its last rank, the hero analogue of tier 5 (Kanna's quake took her Lv 24, A8). **Lv 25 "Lunar Sovereign"**, her capstone, adds the second moonbeam.

| Level | Live | With the shape |
|---|---|---|
| Lv 17 Full Moon Lance (lances.4) | +8 damage, +4 pierce, ×1.25 elites | unchanged |
| Lv 22 Lunatic Lance (lances.5) | one more beam, +8 damage, +20 % speed | all of that, **plus one Moonbeam**: swings ±45° (30 steps) round her lead target, one pass per volley, strikes up to her pierce a pass, `sweep.mul` 0.35 |
| Lv 25 Lunar Sovereign | +15 % damage, +2 pierce | all of that, **plus a second Moonbeam** swinging the other way (both at 0.3) |

**Player sees.** Her moon beams still flash at her targets with every volley. A long, soft, held moonbeam also stands from her staff and swings across them, one side to the other with each volley, back on the next. At Lv 25 two moonbeams cross like scissors. Level text, Lv 22: "…; a moonbeam swings across her targets with every volley."

**Sim.** Umeko's Searchlight Sweep (`held.js` sweep, `nearSegment`, half-width SWEEP_HALF_WIDTH 0.25) changes in one way: **a pass is her counted attack, not a fixed swing rate.**

- Each counted beam volley (`attackBeam`, `towers.js:1121`, untouched) starts a pass from the side where the last one ended to the other. The pass lasts P = min(her cooldown in steps, 36) steps and covers 2 × arc table steps, using an integer accumulator (Bresenham). No fractional angle, deterministic at any attack speed.
- The centre follows `nearestDir(lead − her)` at `turnToward` 1 step a step.
- Every SWEEP_TICK (2) steps the segment is tested. Each enemy is struck at most once a pass, up to her pierce a pass, in crossing order (step, then grid order, then uid).
- Pre-seeded skip: the victims of this volley's beams (rule 4), so a lone boss reads live. Each strike is `shapeSpec(t, spec, sweep.mul)`.
- Moonbeam two at Lv 25 is the same with the phase mirrored (`240 − k` about the centre, as reverse arms).
- State: `t.ch` (S2's record, its memory integer pairs) with a pass counter. The Moonfall ult and the Moonbrand skill are untouched. Her gravity statuses (slow, Brittle, stun and freeze chances) stay on her beams (rules 2 and 3), so her stun and freeze rolls are live's.

**Must keep working.** Her level multipliers (`balance.js:153` `luna`, HERO_POWER), the Potential P2 Long Moonbeam pierce (more strikes a pass), P4 / P6 rate (passes follow her volleys), the court aura, Moonfall's haste (faster volleys mean shorter passes; a pass lasts at most 36 steps, 0.6 s, and when the next volley comes first it starts the next pass from where the beam is).

**Parity.** Heroes are not on the no-nerf gate (`noNerfGate.mjs` header: every HERO_POWER ≥ 1). Use Kanna's method (A8): copies of the light bench's harness and round 5's maxed harness with her placed as the hero at Lv 22 and Lv 25 (XP and Mastery held), plus `tools/heroTrack.mjs` for the 25-level track (no level below live). The lone boss is exact. Crowd: expected +10–20 %.

### 3.5 Miko: Charm Wheel on Purification T4–T5

**Why this path.** Purification is her "Holy talismans" path (`units.js:1098-1103`). Divine Wind (T4) is "three talismans per throw", and a divine wind turning a wheel of paper charms is the path's picture. Blessing (her ⚡ Shrine Chorus, `abilities.js:338`) and Sacred Grounds are her aura paths and stay. Her aura is untouched on every path.

| Tier | Live | With the shape |
|---|---|---|
| T3 Exorcism Rite | silence 0.8 s, reveal 2 s | unchanged |
| T4 Divine Wind | three talismans a throw, +6 damage, +2 pierce, pen 2, +25 % damage | all of that, **plus a Charm Wheel of 9**: spokes evenly round from her lead target's direction, offset by `wheel.turn` 10 steps (15°) more each throw, each charm pierce 1, travel = her range, `wheel.mul` 0.25 |
| T5 Amaterasu's Mirror | a piercing holy beam (6), +20 damage, +1.5 range, silence +1 s, ×1.5 bosses | the beam as live, **plus a Charm Wheel of 12** with every flash, `wheel.mul` 0.3 |

**Player sees.** Her three talismans fly at her targets as today. A ring of small white-and-red paper charms also bursts out from her all round, flying straight to the edge of her range, and each throw's ring sits a little further round than the last, so over a few throws the wheel visibly turns. At T5 the mirror's beam flashes and the wheel of 12 goes out with it. Tier text, T4: "…; a wheel of 9 paper charms spins out with every throw." T5: "…; the charm wheel grows to 12 and goes out with every flash."

**Sim.** Momo's Blossom Wheel (`attackWheel`, `wheels.js:50`) **spokes only**. Her own attack (`attackProjectile`, or at T5 `attackBeam`) is untouched and is the "lead":

- After her counted attack, n straight charms leave at `wrapDir(k0 + spoke(i) + t.wheelK)` with i = 1…n. k0 = `nearestDir(lead − her)` and spoke(i) = `floor(i × 240 / (n + 1))`, so no charm flies straight down her own talismans' line.
- `t.wheelK` (an integer, new) advances by `wheel.turn` each counted attack, mod 240. That is the Pinwheel's lock-free turn from S1 A3 #4, read from her own attack count, so no clock and no rng.
- A charm cuts the first eligible enemy it meets, with swept hits, and skips the enemies her attack struck this throw (rule 4). Each cut is `shapeSpec(t, spec, wheel.mul)`.
- Holy's own on-hit rules still apply, as with Hotaru's holy cuts (A3 #7): a cut ends phasing and silences field casters. That is the attack type's rule, not her statuses.
- Caps: `straightRoom` (the 400 straight-shot cap) and CHARMS_PER_GIRL 48 (her oldest go first). `t.wheelK` ends at the wave clear. Gear Pierce adds to her talismans (live), not to charms (one cut each).

**Must keep working.** Her whole aura track (P2–P6 aura keys, Festival Bells), her ⚡ Shrine Chorus, gear on her own talismans, mirror copies (Iroha's mirrors copy her talismans with their share, as live; the charms are straight shots and mirror as Kage's arms do, keeping a shot's share, `src/sim/mirrors.js`).

**Parity.** The boss is exact (her talismans' victims are skipped, and a lone boss is always one of them). Crowd gains. Her ruler is boost (`docs/BALANCE.md`: Miko "judged by boost"). Her own crowd number is expected +20–40 %, since her own damage is small next to her aura.

### 3.6 Suzu: Bell Toll on Explosive Mines T4–T5

**Why this path.** Mines is her damage path (`units.js:959-964`), and its T5 is Grand Bell Detonation. Tolls are damage, so they belong on the damage path: Binding's are crowd control and would hit the pile-up lesson, Seals' are silence / reveal. Her ⚡ Bell Carpet (`abilities.js:325`, Mines T3) lays extra bells, and those toll too.

| Tier | Live | With the shape |
|---|---|---|
| T3 Blast Mines | +20 damage, bigger blasts, ×1.5 barriers | unchanged |
| T4 Chain Mines | up to 10 traps, +42 damage, sets 40 % faster | all of that, **plus Bell Toll**: each bell rings as it arms and then every 90 steps (1.5 s) on its own clock, sending one ring to 1.0 tile at 6 tiles/s, `toll.mul` 0.12 of her trap damage |
| T5 Grand Bell Detonation | +220 damage, +1 splash, 4 more traps, +30 % set speed, ×1.8 bosses | all of that, **plus**: every 72 steps (1.2 s), rings to 1.4 tiles, `toll.mul` 0.15 |

**Player sees.** Her bells sit on the road and go off when stepped on, as today. Each bell also rings once as it arms and then on its own beat: a small gold ring rolls out from it across the road, and walkers near it hop as it passes. On a full road of bells the rings ripple out of turn, like a peal. Tier text, T4: "…; each bell tolls as it arms and every 1.5 s after, sending a shock ring across the road."

**Sim.** Kanna's Ripple Quake (`sendQuake`, `ground.js:143`) from a trap instead of from her:

- Each trap record in `sim.traps` (`towers.js:1223`, `:2259`) gains `tollCd`, an integer set to 1 when it arms, so it rings on its first armed step. **The first toll comes as it arms because on a busy road a bell is stepped on within about a second** (the board's mock-up showed bells going off before a 1.5 s first toll, so they never rang). `updateTraps` counts it down while the trap is armed, and checks the toll **before** the trigger on each step, so a bell stepped on the moment it arms still rings once. At 0 it calls `sendQuake(sim, owner, tollSpec, tr.x, tr.y)` with `rings: 1`, `max: toll.r` and resets to `toll.every`.
- Bells arm at different steps, so tolls stagger on their own and the cost spreads over the beat.
- A ring is ground only (`!e.airborne`, as her traps), hits each walker it crosses once (`inBand`), and **never triggers a trap** (a ring is not a step).
- `tollSpec` = `shapeSpec` of her trap spec × `toll.mul`. Her traps never crit (`towers.js:347`), so tolls never do. Her trap statuses, set by other paths' T1–T2, stay on the blast (rule 2).
- Unarmed or tunnel-hidden bells do not ring.
- Caps: rings get their own TOLL_RINGS_PER_GIRL 32 and TOLL_RINGS_PER_SIM 128 (A8 #10: never evicting her or Kanna's quake rings). At the cap a bell defers its toll a step.
- Bosses: a ring strikes whoever stands by the bell (the exception to rule 4). That is a pure gain on her weak held-boss row.

**Must keep working.** P3 Spare Seals and P6 Evening Bell (+1 trap each) mean more bells. P4 Temple Bell (`of: 'trap'`) and P5 / P6 rhythms count **explosions**, and a toll is not one, so the counts stay live's. Bell Carpet's bells toll (they are traps). The trap limit and arm time are unchanged.

**Parity.** Every cell gains or is equal. She is a crowd girl (ruler 1.87M), expected +10–25 %. Held boss: her worst row today (13k), now gains wherever the boss stands by a bell.

---

## 4. Determinism and lockstep (each shape)

The rules of ATTACK_SHAPES §2.4 / §7.2 step 5, per shape:

| Shape | State (all integers but positions) | Order | rng |
|---|---|---|---|
| Spore Mist | `t.ch` (S2's) | cone victims by (d², uid), capped | none (rule 3; poison has no chance) |
| Static Web | `sim.statics`: members as enemy refs serialised by uid, `left`, `zapCd` | webs in creation order, members in chain order | none |
| Crescent Return | a straight projectile with `ret` (S4's) and a pre-seeded hit list of uids | `projectileStep` order | none |
| Moonbeam Sweep | `t.ch` + pass counter and Bresenham accumulator | crossing order (step, grid, uid) | none |
| Charm Wheel | `t.wheelK`, straight shots | spawn order | none |
| Bell Toll | `tr.tollCd` on traps, quake rings (S3's) | `sim.traps` order, then ring order | none |

- Directions come only from the table (`nearestDir`, `turnToward`, `dir`), distances are squared, and timers are integer steps. There is no `Math.random`, no runtime `sin` / `cos` / `atan2` / `hypot`, no `**` and no `Map` / `Set` in the new code. The grep test covers the new files and the new functions.
- `hashSim` folds `sim.statics`, the toll timers (only while some trap has one), `t.wheelK` and the pass counters only while present. An old battle's hash is unchanged.
- Everything ends at the wave clear, so the wave-end checkpoint carries none. A **mid-wave rejoin** replays from the checkpoint and the log, so every new field must be rebuilt by replay alone. No field may depend on render time.
- The renderer reads only sim state (`t.ch`, `sim.statics`, projectile records, `sim.traps[i].tollCd`, quake rings) and uses seeded visual randomness, never `sim.rng`.
- Sim id: one PENDING_BUMP for S5. **`COOP_PROTOCOL` +1 at S5's release** (after round 5's own bump; never two for one release).

---

## 5. Performance budget

The per-step cost at the stress board of §7 (6 copies of each girl at the shape tier, Luna once per player, 200 enemies):

| Shape | Per girl per step | Peak objects | Cap |
|---|---|---|---|
| Spore Mist | one grid query + ≤ 32 hits every 6 steps | 1 channel | — |
| Static Web | ≤ 4 webs × ≤ 12 members, a reach check each step, zaps every 12–15 steps | 4 webs / 48 hits a zap | 4 / girl, 48 / sim, 128 zaps / step |
| Crescent Return | ≤ 8 records, swept segment test | 8 | 8 / girl, 400 straight |
| Moonbeam Sweep | a segment test every 2 steps × 2 beams | 1 channel | — |
| Charm Wheel | ≤ 12 straight shots a throw, ~0.3 s life | ~24 | 48 / girl, 400 straight |
| Bell Toll | ≤ 18 bells (30 with Bell Carpet) tick a timer; ≤ 4 live rings each a query | ~10 rings | 32 / girl, 128 / sim |

Target: `tests/sim/perf.test.js` "S5 attack shapes" under the same 2 ms limit, aiming at ≤ 0.5 ms a step locally (S2–S4 read 0.30–0.44 ms). The existing perf cases must not move beyond noise (best of three, as A9). Renderer: plain effects only (§6), within the S1–S4 allowances.

---

## 6. Plain effects (render only, ship with the sim)

| Shape | Plain look | Reuse |
|---|---|---|
| Spore Mist | S2's cone drawer in her greens (STREAM_KINDS.poison colours), alpha only. Poisoned enemies get the shared poison status look | `attackFx/patterns/held.js` |
| Static Web | S4's thread lines in yellow (dark under-stroke 0.22, yellow line 0.13), a zig-zag sag table, a brighter 0.1 s line on each zap. **Flash guard**: alpha only, never additive, and a zap at 4–5 a second is a colour pulse, not a flash; Reduce Motion keeps the lines static | `linkShapes.js` |
| Crescent Return | a crescent sprite (her blade colour) with S4's projectile drawing, a tiny catch ring at her | her projectile drawer |
| Moonbeam Sweep | S2's held beam (core line + a soft ground light), lavender | S2 sweep drawer |
| Charm Wheel | small paper-charm sprites with a short trail; the pink "bloom" ring at her feet as S1 | S1 wheel drawer |
| Bell Toll | S3's earth ring in gold, thinner; a tiny bell wobble on her trap sprite | `groundShapes.js` |

The polished looks (flipbooks M2, mesh shapes M4) come later on the effects track, sim id unchanged.

---

## 7. Parity target and the gate

The owner's rule: **no nerfs, shapes may be stronger.** Every touched tier must be **≥ live** on:

1. **The no-nerf gate** (`tools/balance/noNerfGate.mjs`, the BALANCE.md round 5 recipe): her paths at tiers 1–5, crowd / boss / walking boss. Both `--support um` and `--support none`, all three profiles (maxed, L1, L40), seeds 9/1/2, tolerance ×0.995. Run in the live tree and on the branch, then `--compare`. Expected result with rules 1–3: **every untouched cell identical, every touched cell ≥ 1.000** (no seed noise to explain). Any under-cell is a bug, not noise.
2. **The ability bench** (`tools/abilityBench.mjs --tiers`, strong preset, 120 s, Auto off / on): the pinned column, which caught the Blade Cyclone. Rei (Hurricane Draw), Raika (Drumstorm), Suzu (Bell Carpet) with their ⚡ on.
3. **The light bench** (`tools/bench.mjs`, A4's four configurations + L25) and the maxed hit bench (`bench.mjs --hit`), for the A4-style table in the as-built addendum.
4. **Luna**: Kanna's hero harness copies at Lv 22 and Lv 25 and `tools/heroTrack.mjs` (no level below live).
5. **Partners**: with rule 3, Aoi (light bench) and Umeko + Midori (gate) must read **bit-identical** beside every S5 girl. Any move means a shape drew rng or laid a status.
6. **The ceiling gate** (`tools/bench.mjs --hit --ceiling --maxed geared`): report each S5 girl's row. Under "no cap", a row over the limit is a recorded exception (`CEILING_EXCEPTIONS`, as Kage), not a trim, if the coordinator agrees.
7. **Finales** (the round-5 set): no win becomes a loss (it cannot, everything is ≥, but the goldens re-pin).

The fit: each shape's knob (`mist.mul`, `zap.share`, `ret.mul`, `sweep.mul`, `wheel.mul`, `toll.mul`) is set so her ruler lands in the band Q9 picks (default +10–30 %). It is reported as live → new in DPS and as a ratio, per tier and profile.

---

## 8. Risks

| Risk | Why | Mitigation |
|---|---|---|
| The poison credit on merges (Midori) | `status.js` merge may move credit between the two Midoris on the gate's supported cells | Read and test the merge first; if credit moves, the mist applies her poison only to enemies with none or hers (a 1-line guard) |
| Too strong in real battles | Additive shapes are ≥ by construction, so the only failure is excess: tolls on a full Bell Carpet, webs on a dense stream | The fit band (Q9), the ceiling gate, finales; caps per girl and sim |
| The panel / drawer honest DPS lies | A new damage source not in `shapeDps` | Each shape adds its line; the drawer test pins one number per shape |
| Mid-wave rejoin drift | New per-trap and per-girl fields | The engines battle rejoins mid-wave with every shape live; hashSim folds every field |
| Crit numbers on screen | Shape hits never "crit" (rule 3), so no crit popups from them | Accepted (Q3); her own attack's crits show as live |
| Holy charms silence casters (Miko) | Holy's own rule on every cut | As Hotaru (A3 #7); caster silence is a gain, never a loss |
| Static zaps read as flashes | A 4–5 Hz line pulse | Alpha colour pulse within the flash guard; Reduce Motion static (§6); the guard report checks it |
| Bells that never ring their beat (Suzu) | On a dense road a bell goes off about a second after it arms, so most of its value is the arm toll; the beat matters on sparse roads and for Bell Carpet's spread bells | Fit `toll.mul` on both the dense crowd and the walking boss; the board shows the arm toll |
| Webs and Ena's threads on one enemy | Two systems on one enemy | Separate lists; Raika never touches `e.tie` or the share hook (Q5) |
| Expected-crit flag elsewhere | `shapeSpec` zeroes `critChance` | Only S5 shape hits use it; S1–S4 keep rolling (no S1–S4 hash moves) |
| Hero numbers off the gate | Luna is not on it | Kanna's harness method + heroTrack (§7.4) |

---

## 9. Test plan

Unit tests, `tests/sim/s5shapes.test.js` (the `held` / `ground` / `links` test pattern):

- **Geometry**: who is inside the mist cone (the tip falloff); which enemies join a web (chain order, ties by uid, the reach snap); the crescent's legs (exact negation, a fresh hit list, the skip list on both legs); the sweep's pass (Bresenham steps from one side to the other per volley, crossing order, once a pass, the pierce cap, the skip); the charm offsets (`k0 + spoke(i) + wheelK`, `wheelK` advance); the toll ring band from a bell.
- **Timing**: mist ticks every 6 steps; zaps every 15 / 12 steps; a toll on the first armed step, then every 90 / 72 steps; the crescent's turn step.
- **Rules 1–4**: her live attack's hits and rng draws are identical with and without the shape (count `sim.rng` calls); shape hits carry no statuses (Midori: poison only); expected crit equals `1 + c(m − 1)`; a lone enemy takes exactly live's damage (Midori's held boss and Suzu excepted, asserted separately).
- **Caps and eviction**: webs 4 / 48, zaps 128 deferred; crescents 8; charms 48 / 400; toll rings 32 / 128 with deferral; the oldest first.
- **Lifetimes**: the wave clear ends everything; sabotage / Move ends the mist and the sweep (channels), webs survive her sabotage (threads on enemies, A9 #11) and end with her sale; crescents and charms end with straight shots on her sale; bells toll on while she is sabotaged (traps are road objects, A8 #3) and her sale removes them as live.
- **Interactions**: each Potential key in §3 (P-rhythms count as live; Twin Crescent's echo throws a crescent at 0.3; Temple Bell's count ignores tolls); drinks and gear scale shape damage; Drumstorm / Hurricane Draw / Bell Carpet; Swift Draught brews unchanged; Moonfall; Iroha's mirrors with charms and crescents.
- **hashSim**: an old battle's hash unchanged; the new state folded only while present.

Determinism and co-op:

- (a) Each S5 girl alone and all six together on 4-5 at Potential 6, plain `Math` against `withDetMath`, `hashSim` every 60 ticks equal, each shape live; twice the same battle identical.
- (b) `e2e/engines/scriptedBattle.js` `runS5Battle` (S5_START, 2-4 Hard): the host fields Midori T5, Raika T5, Rei T5 and Luna at Lv 25. The guest fields Miko T5, Suzu T5 (with Bell Carpet cast) and T4 copies of the first three (one per path at the final tier). Two Lockstep clients run to the end. A third client rebuilds from the wave-3 checkpoint and the log to the first tick 5 s into a wave with a mist open, a web alive, a crescent on its way home, a pass mid-swing, a charm wheel in the air and a toll ring rolling (a **mid-wave rejoin**), and must land on the run's hash and snapshot. Counts asserted (mist ticks, zaps, cuts, strikes, charm cuts, toll hits > 0). Compared across engines by `e2e/engines.mjs` (V8, JavaScriptCore, SpiderMonkey; `--require-all` before ship), pinned in `tests/online/engines.test.js`.
- (c) The grep test over the new code.
- (d) The renderer reads only sim state; no rng.

Benches and gates: §7 in full, before / after tables in the as-built addendum. The 2,368-resolution stats hash with the six left out must be unchanged (A9's method).

Perf: §5's stress case in `tests/sim/perf.test.js`; the existing cases best of three before / after.

Render: `previews/attacks.html` for every touched tier at high / medium / low; 844×390 and 1280×720 captures; the flash-guard report (no S5 shape counts as a flash); Reduce Motion captures.

Review gate (HANDOFF §6): an independent reviewer per half, a fresh one per fix round, then go/no-go and a live check by another agent.

---

## 10. Estimate

Working time for one session, including tests, the fit, the engines battle, the gate runs and a review round:

| Part | Days |
|---|---|
| Shared: `shapeSpec` (clean + expected crit), constants, `endS5Wave`, hashSim / save classes, shape DPS lines | 0.5 |
| **S5a** (reuse of projectiles and rings): Charm Wheel 0.4, Crescent Return 0.5, Bell Toll 0.5 | 1.4 |
| **S5b** (held and links): Spore Mist 0.5, Moonbeam Sweep (pass per volley, hero harness) 0.75, Static Web (new list, zap clock, snap) 0.75 | 2.0 |
| Plain renderers (six, mostly reuse) | 0.5 |
| The fit and the gates (two full no-nerf gates per tree, about 9k cells each; ability bench; hero harness; ceiling; finales) | 1.0 |
| Engines battle with the mid-wave rejoin, perf case | 0.5 |
| Review rounds (two halves) | 0.5 |
| **Total** | **≈ 6.5 days** (S5a ≈ 2.5, S5b ≈ 3.5, sharing the gate runs) |

Recommended staging (Q10): one branch and one sim release with one `COOP_PROTOCOL` bump, built in two halves with a review checkpoint between: **S5a** (Miko, Rei, Suzu) then **S5b** (Midori, Luna, Raika).

---

## 11. Open questions (with the recommended defaults)

| # | Question | Default |
|---|---|---|
| 1 | Keep each girl's live attack under the shape (the Blade Cyclone rule)? | **Yes.** It is the only construction that is never below live in every scenario, as round 5 found. The shape is the new thing the player sees. |
| 2 | Should bosses gain from the shapes? | **No, a lone enemy reads live** (rule 4); the gain is on crowds. Suzu's tolls ring for a boss by a bell (the exception). |
| 3 | Shape hits use expected crit and draw no rng? | **Yes.** Partners and seeds stay bit-identical, so the gate is exact. Cost: shape hits never show a crit number. |
| 4 | Midori: Field Kit or Toxicology? | **Field Kit T4–T5** (its own "Mist" path; it leaves the gate's support build 5-0-2 and her ⚡ Catalyst Burst untouched). |
| 5 | Raika: do other girls' hits conduct along her links (Ena's share hook)? | **No.** Her links zap on their own clock. Sharing other girls' hits is Ena's identity, and the share hook was S4's costliest piece. |
| 6 | Raika: Storm Rhythm or Forked Lightning? | **Storm Rhythm T4–T5** (the catalogue's pick; Forked stays her boss path). |
| 7 | Miko T5: does the wheel go on with the mirror's beam? | **Yes**, 12 charms with every flash (the wheel does not vanish at her capstone). |
| 8 | Luna: which levels? | **Lv 22 (lances.5) and Lv 25** (a second moonbeam). |
| 9 | How much stronger? | **Her ruler +10–30 % at the shape tiers** (the Blade Cyclone's +22–33 %). Below that the shape is barely felt; above it, the band. |
| 10 | Staging? | **One release, one protocol bump, built in two halves** (S5a: Miko, Rei, Suzu; S5b: Midori, Luna, Raika). |
| 11 | Suzu: should a toll ring that reaches another bell ring it (a chain peal)? | **No, data for later.** Cascades need their own budget and read as a big flash on a full carpet. |
| 12 | Midori's mist: slow and paralysis too? | **No**, poison only (rule 2: crowd control on everything in a cone is the pile-up of A8 #9). Her flasks keep both. |
