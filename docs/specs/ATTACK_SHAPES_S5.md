# Attack shapes S5: six more unique attacks

| | |
|---|---|
| Status | Design spec, **nothing built**. Revised after review round 1 (`docs/review/attack-shapes-s5/review-r1.md` on `review/attack-shapes-s5-r1`: 3 HIGH, 5 MEDIUM, all addressed, §12). The owner accepted the defaults on Oct 30. It waits for a fresh reviewer's OK |
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
| 3 | **Rei** | Whirlwind: T4 Tempest Dance, T5 Thousand Petal Storm | **Crescent Return** (Homecoming Throw) | a straight flip (`crescentFlip`, new), straight shots in `shapeRoom` | Each sweep still cuts everything in her reach. It also sends a pink crescent of air past her reach. The crescent turns and comes back, cutting the walkers her sweep could not reach. |
| 4 | **Luna** (hero) | Lances: Lv 22 Lunatic Lance (lances.5), Lv 25 Lunar Sovereign | **Moonbeam Sweep** (Searchlight Sweep) | `held.js` sweep, `nearSegment` | Her moon beams still flash at her targets. A held moonbeam also swings across them with every volley. From Lv 25 a second moonbeam swings the other way. |
| 5 | **Miko** | Purification: T4 Divine Wind, T5 Amaterasu's Mirror | **Charm Wheel** (Blossom Wheel + a turning offset) | a world-fixed turning wheel, `spawnStraight` in `shapeRoom` | Each throw (or mirror flash at T5) is followed by a wheel of paper charms that flies out all round her. The wheel turns a little with every throw, so it reads as a spinning wheel of charms. |
| 6 | **Suzu** | Explosive Mines: T4 Chain Mines, T5 Grand Bell Detonation | **Bell Toll** (Ripple Quake from her traps) | its own `sendToll` and `t.tolls` (S3's ring rule), `inBand` | Every bell rings as it arms and then on its own clock, sending a gold shock ring rolling across the road around it. The bells still go off when stepped on. |

The S5 design rules, from what S1–S4 and round 5 learned (§1):

1. **Her live attack stays; the shape goes on top.** This is the Blade Cyclone rule (`docs/BALANCE.md` "Blade Cyclone never below her aimed volley"). It is the only construction that keeps "no nerfs in any scenario" without one rescue round per girl.
2. **Shape hits are clean and unshared.** They carry damage only: no statuses, marks, pushes, splash or silence. Midori's mist carries her poison and nothing else, under its own knob and guard (§3.1). This is S1 A3 #7, S3 A8 #9 and S4 A9 #2 again. They also carry `noShare: true`, so Ena's share hook in `Sim._hit` (`Sim.js:593-600`) neither shares them nor splits them (Q5).
3. **Shape hits draw no rng.** A shape hit takes her expected crit as a plain multiplier, `1 + c × (m − 1)` with `c` = her `critChance` clamped to [0, 1] and `m` = `critMul || 1.5` (as `computeHit` reads them, `combat.js:91-92`), and never rolls. The shared `sim.rng` therefore sees exactly live's draws. That removes the partner and seed noise of A7 / A9 and makes the gate's live-vs-branch cells exact.
4. **A lone enemy reads live.** Where a shape would hit the enemy her attack just struck (or, for a projectile attack, just aimed at), it rolls past it (Kanna's quake rule, A8 #9). The gain lands on crowds. Suzu's tolls are the exception: a bell rings for whoever stands by it. The owner accepted "no gain on a lone boss" (Oct 30, pending any override).
5. **A shape never takes room from a live object.** Shape shots and shape rings have their own caps and evict only shape objects. When a cap is full the shape skips; the live object is never cut (H1, H2).

With 1–3 and 5, every gate cell is live's number plus the shape's damage. The bench heals targets every step, so their paths, statuses and rng are identical. The tuning question is therefore **how much stronger**, never "is anything under". This "never below live" is a claim about **the healed bench and the gate**, and the gate is the measure. In a real battle the extra damage kills sooner, which moves splitters, enrage timers and the crowd behind them. That is a different battle, not a nerf, and the finales (§7.7) check it. The proposal (Q9) is her ruler +10–30 % at the shape tiers, the Blade Cyclone's range.

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
| `shapeSpec(t, spec, mul)` | `src/sim/shapes.js` (new helper) | The clean copy (rule 2) of her attack spec for a shape hit: `status: []`, `procStatus: null`, `mark: null`, `silence: 0`, `reveal: 0`, `knockback: 0`, `gather: 0`, `splash: 0`, `noShare: true`. It also folds in `critChance: 0, critMul: 1` and multiplies `damage` by `mul × (1 + c × (m − 1))` from her spec's crit, with `c` clamped to [0, 1] and `m = critMul \|\| 1.5` (rule 3). It sets `share: mul` so flat armour and the 1-damage floor scale with it (A8 #1). It generalises `sendQuake`'s `clean` (`ground.js:149`) and Kaede's `bladeSpec`. |
| `noShare` in `Sim._hit` | `src/sim/Sim.js:597` | The tether condition gains `&& !spec.noShare`. A shape hit is neither split by `ownShare` nor sent down Ena's threads (rule 2, Q5). Live hits are unchanged. |
| `shapeRoom(sim, t, n, perGirl)` | `src/sim/rings.js`, beside `straightRoom` | Rule 5 for straight shots. Shape shots carry `p.shape = true`. It counts the straight list as `straightRoom` does (`rings.js:40-47`), but it **evicts only shape shots**: hers first, then her player's, then anyone's. It returns how many of the `n` fit. The caller spawns that many and skips the rest. `straightRoom` itself is unchanged, so a live shot can still evict a shape shot, never the other way round. Mirrors (`src/sim/mirrors.js`) never copy a shape shot. |
| Her attack's victims | `attackPulse`, `attackBeam`, `attackChain`, `attackProjectile` (`towers.js:899`, `:1121`, `:1179`, `:852`) | A small refactor: each fills `t._struck` (a scratch uid array, cleared at her next attack) with the enemies it hit, or for a projectile attack the targets it aimed at. They keep returning `true` / `false` and nothing else changes. Rule 4's skip lists read it. |
| The `S5` constants block | `src/sim/constants.js`, appended | Caps, clocks and widths below. One block, as S1–S4. |
| `endS5Wave(sim)` | beside `endHeldWave` / `endLinkWave` / `endGroundWave` | Every S5 object ends at the wave clear: `sim.statics`, `t.tolls`, `t.wheelK`, pass counters, shape shots. **One exception: Suzu's bells survive the wave clear** (`Sim.js:981`, traps are `'snap'`, `src/ui/battle/snapshot.js:135`). `endS5Wave` sets each surviving bell's `tollCd` to 1, so a calm save holds a constant on every bell (§3.6). |
| `hashSim` folds | `src/sim/Sim.js` | Each new list folds only while non-empty (old battles keep their hash). |
| Battle-save classes | the snapshot classifier | New lists `calm`; per-step scratch (`t._struck`) `scratch` (S4 pattern). `tr.tollCd` rides in the trap record (`snap`); a restored armed trap without it reads 1. |
| Shape DPS for the panel | `shapeDps` / `heldDps` / `linkDps` | Each new shape adds its on-one-target and crowd lines, so the honest readout and the drawer follow it (the S1 rule, A4 last paragraph). |

The existing shared blocks used as they are: the direction table (`src/sim/dirs.js`: `nearestDir`, `turnToward`, `COS2`, `dirAngle`), the shape tests (`inCone`, `nearSegment`, `inBand`, `inDisc`), the held channel (`channel.js`), the tether group record and walk (`tieTether` / `nextLink`), `spawnStraight`, `chainNext` (`towers.js:1163`). **Not reused as-is** (review r1): `retFlip` retargets and clears the hit list (`links.js:134-150`), so Rei gets a straight `crescentFlip`. `sendQuake` reads `t.stats.quake`, sizes rings by her range and counts against Kanna's caps (`ground.js:43-53`, `:143-157`, `:194-197`), so Suzu gets her own `sendToll`. `straightRoom` evicts other girls' live shots (`rings.js:47-58`), so shape shots use `shapeRoom`.

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
| T4 Paralysis Spore | 20 % stun 0.4 s, +0.4 splash, +20 % speed, pen 2, +20 % damage; brew 3 girls | all of that, **plus Spore Mist**: half-angle 45° (30 table steps), length 0.75 × her range (STREAM_KINDS.poison `lengthMul`), at most 24 victims a tick, `mist.mul` 0.12, `mist.dot` 0.25 |
| T5 Elixir Barrage | four flasks a throw, +50 % speed, poison 12/s, +6 damage; brew 4 girls | all of that, **plus Spore Mist**: half-angle 54° (36 steps), 32 victims, `mist.mul` 0.15, `mist.dot` 0.3 |

**Player sees.** She holds her round flask out and a soft green mist pours from it in a wide, short cone. The cone swings after her target at the stream's turn rate. Walkers inside take tiny ticks and show the poison look, which stays after they leave the cone. Her flasks still arc out and splash as today; at T5 four of them a throw. Tier text, T4: "…; a mist of spores pours from her flask in a wide cone, poisoning everything in it." T5: "…; the spore mist widens."

**Sim.** This is Akane's Hearth Stream (`held.js`, `behavior: 'stream'`) with `STREAM_KINDS.poison` (`held.js:46`, data until now). Here it runs as a **kit beside her attack**, not as her behaviour:

- Her behaviour stays `projectile` (rule 1). Her held channel `t.ch` is opened by her counted attack and ticks after the attack loop in `updateTower`, as S2 does (A7 #2). Lock, `turnToward`, grace and release come from `channel.js`.
- Every `CH_TICK` (6 steps) the cone (`inCone` over `sim.grid.query`, victims by (d², uid), capped) strikes each victim once with `shapeSpec(t, spec, mist.mul × rate × CH_TICK × STEP)` and the tip falloff (`streamFalloff`, × 0.85 at the tip). Its status list is **her poisons only, scaled by `mist.dot`**: every `poison`-type entry of her spec, Potential P4 Evergreen Venom's `statusAdd` poison included, with `dps` and `pct` × `mist.dot` and her duration. `mist.mul` tunes the ticks and `mist.dot` the poison, which is the larger gain (review r1 M3), so both are fit. No chance, so no rng.
- **The poison guard.** The mist poisons an enemy only if it has no poison or its poison is hers (`sourceUid` = her uid). The merge is per key `>=` with `left = max` (`status.js:97-101`, `:105`), so without the guard the mist would refresh another girl's poison: a Toxicology support's 56/s would last longer, and her numbers would move. With the guard, nobody else's poison is touched. An enemy already carrying hers gains a refresh, and her stronger flask values win the per-key merge.
- **Not fully clean, by design:** a poisoned enemy cannot siphon-heal (`enemies.js:369`), so the mist's poison stops siphoners in the cone. That is a gain and never a nerf. It is the one way the mist can move other girls' numbers (a siphoner heals less), so §7.5 excepts Midori beside siphoning enemies.
- Her slow and her paralysis stay on the flask (rule 2). The paralysis keeps its live 20 % roll per flask hit, so her stun count and rng are live's.
- The mist reaches flyers from T3 on, because her spec has `canHitAir`.
- Gear Pierce adds victims (A7 #8's carry into `t.ch.px`).
- State is `t.ch` only (integers), ended by a sabotage, a Move, her sale or the wave clear.

**Must keep working.** Swift Draught brews (her kit timer, untouched). The P5 Cauldron Bomb rhythm, which is her flask harder with a splash, untouched because the flask is her attack. P6 Double Batch (+1 brew target). P2 / P4 `dotMul` scale the mist's poison as they scale the flask's. Drinks and gear scale her spec. The mist reads it. Catalyst Burst (another path) is unaffected.

**Parity.** Enemies she already poisons gain only refresh. Enemies with no poison outside her splash gain her poison × `mist.dot`, and enemies under another girl's poison gain only the ticks. Boss cells: the held boss is in her splash already. Its gain is the mist's ticks plus refresh, small (the lone-enemy rule cannot apply to a held stream; the ticks are her ruler's +). Her ruler is "judged by boost" (`docs/BALANCE.md` round 5), and her brews are unchanged. Her own crowd number is expected to land at +15–30 %.

**The credit question, answered (review r1).** The merge is per key `>=` (`status.js:97-101`): the stronger poison keeps its values and its `sourceUid`, so the supported cell's Toxicology Midori keeps the credit on shared enemies. The guard above means the mist never offers a poison to her anyway.

### 3.2 Raika: Static Web on Storm Rhythm T4–T5

**Why this path.** Storm Rhythm is "Tempo and interrupts" (`units.js:1038-1044`), and the original catalogue put "a lingering static link" there (ATTACK_SHAPES §5.10). Endless Thunder (T5) names the "keeps zapping" half. Forked Lightning is her pure-chain and boss path (Raijin's Wrath ×2.5 vs bosses) and Overcharge her lance, so both stay. Her ⚡ Drumstorm (`abilities.js:332`) is on this path. It adds +2 / +4 jumps for its duration, so Drumstorm webs grow with it.

| Tier | Live | With the shape |
|---|---|---|
| T3 Drum Roll | +30 % speed, silence 0.5 s | unchanged |
| T4 Thunder Festival | +40 % speed, +2 jumps, silence +0.5 s, pen 3, +25 % damage | all of that, **plus Static Web**: links last 2 s, a zap every 15 steps (0.25 s), `zap.share` 0.15 |
| T5 Endless Thunder | double speed, +8 damage, +3 jumps, Brittle + crack, +45 % damage | all of that, **plus**: links last 3 s, a zap every 12 steps (0.2 s), `zap.share` 0.2 |

**Player sees.** Her bolt jumps from enemy to enemy as today. The enemies it struck then stay joined by thin flickering yellow zig-zags. Four (five) times a second a zap runs along the zig-zags and every linked enemy jolts. When linked enemies drift too far apart the link snaps, and when fewer than two remain the web fades. Tier text, T4: "…; the enemies her bolt strikes stay linked by static for 2 s, zapped 4 times a second."

**Sim.** It reuses S4's group record and tie walk, but **not the share hook** (Q5). Its zaps carry `noShare`, so the hook skips them too (review r1 M5):

- A static web is `{ uid, owner, m: [enemy…], left, zapCd }` in a new list `sim.statics` (not `sim.tethers`). Ena's threads and Raika's webs then coexist on the same enemy without fighting over `e.tie`. Members are her first bolt's chain in hit order (`attackChain`'s `hitSet` order, `towers.js:1179`), capped at STATIC_MEMBERS 12. A chain of one (a lone enemy) makes no web, so a lone boss reads exactly live (rule 4).
- Her counted attack: if her lead target is already in one of her webs, that web's `left` is refreshed and nothing new is made (S4 A9 #10). Otherwise a new web is made, unless every member is already in a web, any owner's (a second Raika makes none: no double zaps). Caps: STATIC_PER_GIRL 4 (her oldest goes first), STATIC_PER_SIM 48 (no new web past it).
- Each step, for each web in creation order: `left−−`. When `zapCd` hits 0 it resets to `zap.every`. Members that died, entered a tunnel or stand further than STATIC_REACH (her `chainJump(spec)` × 1.5) from the previous member in the list drop out. Then every remaining member takes one hit of `shapeSpec(t, spec, zap.share × rate × zap.every × STEP)`. Per second each member takes `zap.share × rate` of her bolts, which is `zap.share` of her bolt DPS on it. The zaps are unshared (rule 2), so a member also tied by Ena's threads does not echo them. Shock, silence, Brittle and crack stay on the bolt (rule 2). With fewer than 2 members, or `left` 0, the web ends.
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

**Sim.** Fuu's fan idea as a **straight** throw with its own flip. Her Whirlwind has no push, so S4's homing fix (A9 #1) is not needed, and S4's `retFlip` is not used: it retargets the fan at its aim and clears the hit list (`links.js:134-150`), which would home a crescent onto a live lead boss and drop rule 4's skip (review r1 M1):

- After her pulse (`attackPulse`, `towers.js:899`; its victims in `t._struck`), she spawns one straight record (`spawnStraight`, `p.shape`, no `target`, `aim: null`) along `nearestDir(lead − her)`, with `cres: { leg: 0, out }` and `maxTravel` = her range + `ret.out`.
- `crescentFlip` (new, in `links.js` beside `retFlip`): at `maxTravel` on leg 0 it negates `vx` / `vy` exactly (no trig), sets `leg` 1, `travel` 0 and `maxTravel` to the same length, and clears `p.hits`. On leg 1 at `maxTravel` (back at her) it ends. It never sets a target, so nothing is chased.
- **The skip list is its own field**, `p.skip` (uids), set at spawn from `t._struck` and read in `projectileStep` before a hit. It is never cleared by the flip, so both legs roll past the sweep's victims (rule 4). A held boss in her reach is never cut by her crescent, so her boss rows are exact. A walking boss is cut on the way in, before it reaches her.
- **Ground only:** her spec has `canHitAir: false` (`units.js` Rei base), and the crescent uses it. Mirrors never copy a crescent (`p.shape`).
- Each cut is `shapeSpec(t, spec, ret.mul)`. Her crits, ×2.5 vs bosses and ×1.25 vs elites ride on the multiplier (her spec's tier multipliers stay; S4 A9 #8). She never waits for a crescent (A9 #4).
- Caps: `shapeRoom` with CRESCENTS_PER_GIRL 8 (her oldest crescent ends early; rule 5). A full field skips the crescent and never evicts a live shot. Gear Pierce adds cuts a leg (her pulse's carry, A7 #8).

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
- Pre-seeded skip: the victims of this volley's beams (`t._struck` from `attackBeam`, rule 4), so a lone boss reads live. Strikes are unshared (rule 2). Each strike is `shapeSpec(t, spec, sweep.mul)`.
- Moonbeam two at Lv 25 is the same with the phase mirrored (`240 − k` about the centre, as reverse arms).
- State: `t.ch` (S2's record, its memory integer pairs) with a pass counter. The Moonfall ult and the Moonbrand skill are untouched. Her gravity statuses (slow, Brittle, stun and freeze chances) stay on her beams (rules 2 and 3), so her stun and freeze rolls are live's.

**Must keep working.** Her level multipliers (`balance.js:153` `luna`, HERO_POWER), the Potential P2 Long Moonbeam pierce (more strikes a pass), P4 / P6 rate (passes follow her volleys), the court aura, Moonfall's haste (faster volleys mean shorter passes; a pass lasts at most 36 steps, 0.6 s, and when the next volley comes first it starts the next pass from where the beam is).

**Parity.** Heroes are not on the no-nerf gate (`noNerfGate.mjs` header: every HERO_POWER ≥ 1). Use Kanna's method (A8): copies of the light bench's harness and round 5's maxed harness with her placed as the hero at Lv 22 and Lv 25 (XP and Mastery held), plus `tools/heroTrack.mjs` for the 25-level track (no level below live). The lone boss is exact. Crowd: expected +10–20 %.

### 3.5 Miko: Charm Wheel on Purification T4–T5

**Why this path.** Purification is her "Holy talismans" path (`units.js:1098-1103`). Divine Wind (T4) is "three talismans per throw", and a divine wind turning a wheel of paper charms is the path's picture. Blessing (her ⚡ Shrine Chorus, `abilities.js:338`) and Sacred Grounds are her aura paths and stay. Her aura is untouched on every path.

| Tier | Live | With the shape |
|---|---|---|
| T3 Exorcism Rite | silence 0.8 s, reveal 2 s | unchanged |
| T4 Divine Wind | three talismans a throw, +6 damage, +2 pierce, pen 2, +25 % damage | all of that, **plus a Charm Wheel of 9**: a wheel of 10 evenly spaced spokes that turns `wheel.turn` 10 steps (15°) each throw, minus the spoke nearest her target's line; each charm pierce 1, travel = her range, `wheel.mul` 0.25 |
| T5 Amaterasu's Mirror | a piercing holy beam (6), +20 damage, +1.5 range, silence +1 s, ×1.5 bosses | the beam as live, **plus a Charm Wheel of 12** (13 spokes minus the one nearest her line) with every flash, `wheel.mul` 0.3 |

**Player sees.** Her three talismans fly at her targets as today. A ring of small white-and-red paper charms also bursts out from her all round, flying straight to the edge of her range, and each throw's ring sits a little further round than the last, so over a few throws the wheel visibly turns. At T5 the mirror's beam flashes and the wheel of 12 goes out with it. Tier text, T4: "…; a wheel of 9 paper charms spins out with every throw." T5: "…; the charm wheel grows to 12 and goes out with every flash."

**Sim.** Momo's Blossom Wheel (`attackWheel`, `wheels.js:50`) **spokes only**. Her own attack (`attackProjectile`, or at T5 `attackBeam`) is untouched and is the "lead":

- **The wheel is fixed to the world and turns.** After her counted attack the wheel has m = n + 1 spokes at `wrapDir(t.wheelK + floor(j × 240 / m))`, j = 0…m − 1. The spoke nearest her target's line k0 = `nearestDir(lead − her)` is dropped (the smallest circular distance to k0, ties to the lower j), and the other n leave as straight charms. **No charm ever flies down her line:** every remaining spoke is at least half a gap (12 steps, 18°, at T4) from k0, whatever `wheelK` is. The first version, `k0 + spoke(i) + wheelK`, put a charm on her line whenever `spoke(i) + wheelK ≡ 0 (mod 240)` (review r1 M2).
- `t.wheelK` (an integer, new) advances by `wheel.turn` each counted attack, mod 240. That is the Pinwheel's lock-free turn from S1 A3 #4, read from her own attack count, so no clock and no rng.
- **The skip list is the throw's selected targets.** At T4 her talismans are projectiles, so who they will hit is unknown when the charms spawn. `t._struck` holds the targets `attackProjectile` aimed at. At T5 the beam is instant, and `t._struck` holds its `linePierce` victims. Each charm carries it as `p.skip` (rule 4). A lone boss is always a selected target, so her boss row is exact. A charm cuts the first eligible enemy it meets that is not in its skip list, with swept hits. Each cut is `shapeSpec(t, spec, wheel.mul)`, unshared.
- Holy's own on-hit rules still apply, as with Hotaru's holy cuts (A3 #7): a cut ends phasing and silences field casters. That is the attack type's rule, not her statuses.
- Caps: `shapeRoom` with CHARMS_PER_GIRL 48 (rule 5: her oldest charms go first, a full field skips spokes, live shots are never evicted). `t.wheelK` ends at the wave clear. Gear Pierce adds to her talismans (live), not to charms (one cut each).

**Must keep working.** Her whole aura track (P2–P6 aura keys, Festival Bells), her ⚡ Shrine Chorus, gear on her own talismans, mirror copies (Iroha's mirrors copy her talismans with their share, as live, and never copy a charm, `p.shape`, `src/sim/mirrors.js`).

**Parity.** The boss is exact (the throw's selected targets are skipped, and a lone boss is always one of them). Crowd gains. Her ruler is boost (`docs/BALANCE.md`: Miko "judged by boost"). Her own crowd number is expected +20–40 %, since her own damage is small next to her aura.

### 3.6 Suzu: Bell Toll on Explosive Mines T4–T5

**Why this path.** Mines is her damage path (`units.js:959-964`), and its T5 is Grand Bell Detonation. Tolls are damage, so they belong on the damage path: Binding's are crowd control and would hit the pile-up lesson, Seals' are silence / reveal. Her ⚡ Bell Carpet (`abilities.js:325`, Mines T3) lays extra bells, and those toll too.

| Tier | Live | With the shape |
|---|---|---|
| T3 Blast Mines | +20 damage, bigger blasts, ×1.5 barriers | unchanged |
| T4 Chain Mines | up to 10 traps, +42 damage, sets 40 % faster | all of that, **plus Bell Toll**: each bell rings as it arms and then every 90 steps (1.5 s) on its own clock, sending one ring to 1.0 tile at 6 tiles/s, `toll.mul` 0.12 of her trap damage |
| T5 Grand Bell Detonation | +220 damage, +1 splash, 4 more traps, +30 % set speed, ×1.8 bosses | all of that, **plus**: every 72 steps (1.2 s), rings to 1.4 tiles, `toll.mul` 0.15 |

**Player sees.** Her bells sit on the road and go off when stepped on, as today. Each bell also rings once as it arms and then on its own beat: a small gold ring rolls out from it across the road, and walkers near it hop as it passes. On a full road of bells the rings ripple out of turn, like a peal. Tier text, T4: "…; each bell tolls as it arms and every 1.5 s after, sending a shock ring across the road."

**Sim.** Kanna's Ripple Quake rule (a growing ring, `inBand`, each walker once) from a trap, through **its own `sendToll` and list**. Calling `sendQuake` as the first draft said would break Kanna (review r1 H2): it reads `t.stats.quake` and `max: spec.range`, `room()` counts every girl's `t.quakes` against QUAKES_PER_SIM 64 (`ground.js:43-53`, `:143-157`), and `groundTick` clears `t.quakes` for a girl without `stats.quake` (`:194-197`). So tolls would refuse Kanna's live rings.

- Each trap record in `sim.traps` (`towers.js:1223`, `:2259`) gains `tollCd`, an integer set to 1 when it arms, so it rings on its first armed step. **The first toll comes as it arms because on a busy road a bell is stepped on within about a second** (the board's mock-up showed bells going off before a 1.5 s first toll, so they never rang). `updateTraps` counts it down while the trap is armed, and checks the toll **before** the trigger on each step, so a bell stepped on the moment it arms still rings once. At 0 it calls `sendToll(sim, owner, tr)` and resets to `toll.every`.
- `sendToll` pushes `{ uid, x, y, r: 0, max: toll.r, hit: [] }` onto **`t.tolls`** (her own list, never `t.quakes`). `tollTick(sim, t)` (beside `groundTick`, which is untouched) grows each ring at TOLL_SPEED 6 tiles/s and strikes what `inBand(prevR, r)` finds. It shares only `inBand` and `shapeSpec` with S3. Caps count `t.tolls` only: TOLLS_PER_GIRL 32 and TOLLS_PER_SIM 128 (the sum over girls' `t.tolls`). At a cap the bell defers its toll a step, and nothing is evicted (rule 5). Kanna's QUAKES caps never see a toll.
- **Across the wave clear** (review r1 H3): her traps survive it (`Sim.js:981`, "Suzu's traps stay"), and traps are `'snap'` in battle saves (`src/ui/battle/snapshot.js:135`), so `tr.tollCd` lives in calm saves and co-op checkpoints. Rule: `tollCd` counts down only while a wave runs. `endS5Wave` clears `t.tolls` and sets every surviving armed bell's `tollCd` to 1, so each bell rings on the next wave's first armed step, and every calm save holds the constant 1. A restored armed trap without `tollCd` (an old save, or a trap armed before the update) reads 1, the same. `hashSim` folds `tollCd` for traps whose owner has `stats.toll` (old battles: no such trap, hash unchanged).
- Bells arm at different steps, so tolls stagger on their own and the cost spreads over the beat.
- A ring is ground only (`!e.airborne`, as her traps), hits each walker it crosses once (`inBand`), and **never triggers a trap** (a ring is not a step). The walkers' "hop" on the board is a render effect only: a toll pushes nobody (rule 2).
- `tollSpec` = `shapeSpec` of her trap spec × `toll.mul`. Her traps never crit (`towers.js:347`), so tolls never do. Her trap statuses, set by other paths' T1–T2, stay on the blast (rule 2).
- Unarmed bells do not ring. (Bells are never in a tunnel: `trapSpots` skips hidden road samples, `towers.js:1213`.)
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
| Crescent Return | a straight projectile with `cres` (leg, out) and its own `skip` uid list | `projectileStep` order | none |
| Moonbeam Sweep | `t.ch` + pass counter and Bresenham accumulator | crossing order (step, grid, uid) | none |
| Charm Wheel | `t.wheelK`, straight shots with `skip` | spawn order (j order, the dropped spoke by circular distance, ties lower j) | none |
| Bell Toll | `tr.tollCd` on traps (survives the wave clear as the constant 1), `t.tolls` rings | `sim.traps` order, then ring order | none |

- Directions come only from the table (`nearestDir`, `turnToward`, `dir`), distances are squared, and timers are integer steps. There is no `Math.random`, no runtime `sin` / `cos` / `atan2` / `hypot`, no `**` and no `Map` / `Set` in the new code. The grep test covers the new files and the new functions.
- `hashSim` folds `sim.statics`, the toll timers (only while some trap has one), `t.wheelK` and the pass counters only while present. An old battle's hash is unchanged.
- Everything ends at the wave clear, so the wave-end checkpoint carries none of it. The one exception is the bells' `tollCd`, which is 1 on every surviving bell, a constant. A **mid-wave rejoin** replays from the checkpoint and the log, so every new field must be rebuilt by replay alone. No field may depend on render time.
- The renderer reads only sim state (`t.ch`, `sim.statics`, projectile records, `sim.traps[i].tollCd`, quake rings) and uses seeded visual randomness, never `sim.rng`.
- Sim id: one PENDING_BUMP for S5. **`COOP_PROTOCOL` +1 at S5's release** (after round 5's own bump; never two for one release).

---

## 5. Performance budget

The per-step cost at the stress board of §7 (6 copies of each girl at the shape tier, Luna once per player, 200 enemies):

| Shape | Per girl per step | Peak objects | Cap |
|---|---|---|---|
| Spore Mist | one grid query + ≤ 32 hits every 6 steps | 1 channel | — |
| Static Web | ≤ 4 webs × ≤ 12 members, a reach check each step, zaps every 12–15 steps | 4 webs / 48 hits a zap | 4 / girl, 48 / sim, 128 zaps / step |
| Crescent Return | ≤ 8 records, swept segment test | 8 | 8 / girl via `shapeRoom` (never evicts a live shot) |
| Moonbeam Sweep | a segment test every 2 steps × 2 beams | 1 channel | — |
| Charm Wheel | ≤ 12 straight shots a throw, ~0.3 s life | ~24 | 48 / girl via `shapeRoom` (never evicts a live shot) |
| Bell Toll | ≤ 18 bells (30 with Bell Carpet) tick a timer; ≤ 4 live rings each a query | ~10 rings | `t.tolls` 32 / girl, 128 / sim (own caps, not Kanna's) |

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
5. **Partners**: with rules 2, 3 and 5, Aoi (light bench) and Umeko + Midori (gate) must read **bit-identical** beside every S5 girl. Any move means a shape drew rng, laid a status, shared through a tie or took a live object's room. **One exception, Midori**: her mist's poison stops siphon healing (`enemies.js:369`). Beside a siphoning enemy the other girls' numbers may move, always up. The guard (§3.1) keeps every other girl's poison untouched.
   **Ena beside each shape** (review r1 M5): Ena at Shared Fate T4 / T5 with each S5 girl. Ena's own cells must be bit-identical to Ena beside that girl's live build, and the S5 girl's must be live plus her shape (shape hits unshared).
6. **The ceiling gate** (`tools/bench.mjs --hit --ceiling --maxed geared`): report each S5 girl's row. Under "no cap", a row over the limit is a recorded exception (`CEILING_EXCEPTIONS`, as Kage), not a trim, if the coordinator agrees.
7. **Finales** (the round-5 set): no win becomes a loss. It should not, since everything is ≥ on the bench, but kill timing moves real battles (rule note above), so they run. The goldens re-pin.
8. **The LR bar** (owner: an LR beats every non-LR; review r1 M4). After S5, `tools/balance/lrBench.mjs` runs, and each S5 girl's maxed tier-5 row is compared with the LR rows' bar. The LR `t5` rows sit a quarter past the best SSR crowd, Hotaru's 8.67M (`src/data/balance.js:100-113`). The S5 rulers (Rei 1.82M, Raika 2.20M, Suzu 1.87M, +30 % at most) stay under 3M, so no crossing is expected. **If one ever crosses, the LR rows are raised. The S5 girl is never trimmed.**

The fit: each shape's knob (`mist.mul` and `mist.dot`, `zap.share`, `ret.mul`, `sweep.mul`, `wheel.mul`, `toll.mul`) is set so her ruler lands in the band Q9 picks (default +10–30 %). It is reported as live → new in DPS and as a ratio, per tier and profile.

---

## 8. Risks

| Risk | Why | Mitigation |
|---|---|---|
| The poison credit and refresh (Midori) | The merge is per key `>=` with `left = max` (`status.js:97-105`): the credit stays with the stronger poison, but a refresh would lengthen another girl's poison | The guard: the mist poisons only enemies with no poison or hers (§3.1); its own poison is scaled by `mist.dot` |
| Shape objects take live objects' room | `straightRoom` evicts other girls' straight shots, and `room()` counts every girl's quake rings (review r1 H1, H2) | Rule 5: `shapeRoom` evicts only shape shots and skips at the cap; tolls have their own `t.tolls` and caps |
| Bell state in calm saves | Traps survive the wave clear (review r1 H3) | `tollCd` paused between waves and set to 1 at the clear; old saves read 1; save/restore test |
| Too strong in real battles | Additive shapes are ≥ by construction, so the only failure is excess: tolls on a full Bell Carpet, webs on a dense stream | The fit band (Q9), the ceiling gate, finales; caps per girl and sim |
| The panel / drawer honest DPS lies | A new damage source not in `shapeDps` | Each shape adds its line; the drawer test pins one number per shape |
| Mid-wave rejoin drift | New per-trap and per-girl fields | The engines battle rejoins mid-wave with every shape live; hashSim folds every field |
| Crit numbers on screen | Shape hits never "crit" (rule 3), so no crit popups from them | Accepted (Q3); her own attack's crits show as live |
| Holy charms silence casters (Miko) | Holy's own rule on every cut | As Hotaru (A3 #7); caster silence is a gain, never a loss |
| Static zaps read as flashes | A 4–5 Hz line pulse | Alpha colour pulse within the flash guard; Reduce Motion static (§6); the guard report checks it |
| Bells that never ring their beat (Suzu) | On a dense road a bell goes off about a second after it arms, so most of its value is the arm toll; the beat matters on sparse roads and for Bell Carpet's spread bells | Fit `toll.mul` on both the dense crowd and the walking boss; the board shows the arm toll |
| Webs and Ena's threads on one enemy | Two systems on one enemy | Separate lists. Raika never touches `e.tie`, and every shape hit carries `noShare`, so the hook skips it (Q5, review r1 M5) |
| Expected-crit flag elsewhere | `shapeSpec` zeroes `critChance` | Only S5 shape hits use it; S1–S4 keep rolling (no S1–S4 hash moves). It reads `critMul \|\| 1.5` and clamps the chance, as `computeHit` does |
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
- **Review r1 cases**:
  - **H1**: 6 Kinus with their straight shots at the per-player and per-sim caps, plus Miko T5 and Rei T5. The Kinus' damage and shot counts are bit-identical with and without Miko's and Rei's shapes. Shape shots are skipped, not the Kinus'.
  - **H2**: Kanna at Lv 24 and Suzu T5 with Bell Carpet, with Kanna's quake rings at QUAKES_PER_SIM. Kanna's ring count and damage are bit-identical with and without the tolls.
  - **H3**: save and restore across a wave clear with armed bells (`tollCd` 1 on each, the next wave's first armed step rings). Restore an old save whose armed traps have no `tollCd` (reads 1). Hash equal across the round trip.
  - **M1**: a crescent whose lead boss is alive when it turns. The way home neither chases the boss nor cuts it (skip list intact), and it ends at her.
  - **M2**: T4 Miko against a lone boss is bit-exact to live. For every `wheelK` 0…239, no charm's direction is closer than 12 steps to k0 (T4).
  - **M3**: the mist never changes a poison whose `sourceUid` is not hers, and `mist.dot` scales its `dps` / `pct`.
  - **M5**: Ena beside each S5 girl. The shape hits are not shared or split.

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
| Shared: `shapeSpec` (clean + expected crit + `noShare`), `noShare` in `_hit`, `shapeRoom`, the `t._struck` refactor, constants, `endS5Wave`, hashSim / save classes, shape DPS lines | 0.9 |
| **S5a** (projectiles and rings): Charm Wheel 0.4, Crescent Return (own flip and skip) 0.6, Bell Toll (own `sendToll`, trap save across the clear) 0.7 | 1.7 |
| **S5b** (held and links): Spore Mist 0.5, Moonbeam Sweep (pass per volley, hero harness) 0.75, Static Web (new list, zap clock, snap) 0.75 | 2.0 |
| Plain renderers (six, mostly reuse) | 0.5 |
| The fit and the gates (two full no-nerf gates per tree, about 9k cells each; ability bench; hero harness; ceiling; finales) | 1.0 |
| Engines battle with the mid-wave rejoin, perf case | 0.5 |
| Review rounds (two halves) | 0.5 |
| The LR bench check (§7.8) and Ena-beside runs (§7.5) | 0.2 |
| **Total** | **≈ 7.3 days** (S5a ≈ 3, S5b ≈ 3.7, sharing the gate runs) |

Recommended staging (Q10): one branch and one sim release with one `COOP_PROTOCOL` bump, built in two halves with a review checkpoint between: **S5a** (Miko, Rei, Suzu) then **S5b** (Midori, Luna, Raika).

---

## 11. Open questions (with the recommended defaults)

| # | Question | Default |
|---|---|---|
| 1 | Keep each girl's live attack under the shape (the Blade Cyclone rule)? | **Yes.** It is the only construction that is never below live in every scenario, as round 5 found. The shape is the new thing the player sees. |
| 2 | Should bosses gain from the shapes? | **No, a lone enemy reads live** (rule 4); the gain is on crowds. Suzu's tolls ring for a boss by a bell (the exception). |
| 3 | Shape hits use expected crit and draw no rng? | **Yes.** Partners and seeds stay bit-identical, so the gate is exact. Cost: shape hits never show a crit number. |
| 4 | Midori: Field Kit or Toxicology? | **Field Kit T4–T5** (its own "Mist" path; it leaves the gate's support build 5-0-2 and her ⚡ Catalyst Burst untouched). |
| 5 | Raika: do other girls' hits conduct along her links (Ena's share hook)? | **No.** Her links zap on their own clock. Sharing other girls' hits is Ena's identity, and the share hook was S4's costliest piece. Shape hits also do not travel Ena's threads (`noShare`). |
| 6 | Raika: Storm Rhythm or Forked Lightning? | **Storm Rhythm T4–T5** (the catalogue's pick; Forked stays her boss path). |
| 7 | Miko T5: does the wheel go on with the mirror's beam? | **Yes**, 12 charms with every flash (the wheel does not vanish at her capstone). |
| 8 | Luna: which levels? | **Lv 22 (lances.5) and Lv 25** (a second moonbeam). |
| 9 | How much stronger? | **Her ruler +10–30 % at the shape tiers** (the Blade Cyclone's +22–33 %). Below that the shape is barely felt; above it, the band. |
| 10 | Staging? | **One release, one protocol bump, built in two halves** (S5a: Miko, Rei, Suzu; S5b: Midori, Luna, Raika). |
| 11 | Suzu: should a toll ring that reaches another bell ring it (a chain peal)? | **No, data for later.** Cascades need their own budget and read as a big flash on a full carpet. |
| 12 | Midori's mist: slow and paralysis too? | **No**, poison only (rule 2: crowd control on everything in a cone is the pile-up of A8 #9). Her flasks keep both. |

---

## 12. Review round 1: what changed

Review round 1 (`docs/review/attack-shapes-s5/review-r1.md` on `review/attack-shapes-s5-r1` 190bc42) found 3 HIGH, 5 MEDIUM and 6 LOW issues, and the body above now carries every fix:

| Finding | Fix | Where |
|---|---|---|
| H1 `straightRoom` evicts partners' live shots | Rule 5; `shapeRoom` evicts only shape shots and skips at the cap; mirrors never copy shape shots; the 6-Kinu cap test | §0 rule 5, §2, §3.3, §3.5, §5, §9 |
| H2 `sendQuake` would refuse Kanna's rings | Suzu's own `sendToll`, `t.tolls`, `tollTick`, caps, speed and mul; `groundTick` untouched; the Kanna + Suzu cap test | §3.6, §5, §8, §9 |
| H3 traps survive the wave clear | `tollCd` paused between waves and set to 1 by `endS5Wave`; old saves read 1; hashed for toll owners; the save/restore test | §2, §3.6, §4, §9 |
| M1 `retFlip` retargets and clears hits | A straight `crescentFlip`, a separate `p.skip`, `aim: null`, ground only, never mirrored | §3.3, §4, §9 |
| M2 Miko's T4 victims unknown at spawn; a charm on her line | Skip the throw's selected targets (T5: the beam's victims); a world-fixed wheel of n + 1 spokes minus the one nearest her line | §3.5, §9 |
| M3 Midori's poison untunable and not clean | `mist.dot`; the poison guard (no poison or hers); the siphon block stated; the merge answer recorded; Midori excepted in §7.5 for siphoners | §3.1, §7.5, §8 |
| M4 the LR bar | §7.8: `lrBench` after S5; raise the LR rows, never trim the S5 girl | §7 |
| M5 shape hits share along Ena's ties | `noShare` on every shape hit; Ena-beside runs | §0 rule 2, §2, §3.2, §7.5, §9 |
| LOW expected crit | `critMul \|\| 1.5`, chance clamped to [0, 1] | §0 rule 3, §2 |
| LOW victims not returned | The `t._struck` refactor, called out | §2 |
| LOW zap wording | Per second: `zap.share × rate` bolts | §3.2 |
| LOW tunnel-hidden bells | Dropped (bells are never in a tunnel) | §3.6 |
| LOW the board's hop | Render only, stated | §3.6 |
| LOW "never below live" | Stated as a claim about the healed bench and the gate | §0 |
