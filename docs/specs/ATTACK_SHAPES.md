# Attack shapes: beyond straight shots and blasts

| | |
|---|---|
| Status | Design spec. **S1 "Wheels" is built on `feature/attack-shapes`** (not shipped: it waits for the owner's yes on the board); defaults, parity and the S2-S4 plan in the Addendum at the end. Folded into the VFX update plan as its own track |
| Owner request | Oct 28, 2026 |
| Written against | `main` 793dfcfa (v0.1.57 "Ultimates"), sim id `2c3c74708a2c`, `COOP_PROTOCOL` 10; `origin/feature/banners` ead2a378 (`COOP_PROTOCOL` 11, the duo); `origin/feature/vfx` 09c057a4 (`docs/VFX.md`, `docs/ATTACK_FX.md`) |
| Reader | A future session that knows the codebase basics (sim / renderer split, co-op lockstep, attack FX layer) |
| VFX milestones | M2 (flipbooks), M4 (mesh shapes, ribbon trails, beams) and M5 (ground marks) are the milestones of the VFX upgrade plan (its §5; only M0 and M1 are written up in the repo so far, in `docs/VFX.md` on `feature/vfx`) |
| Rule | Every name in this page is our own. No other game, show or studio is named anywhere in this spec, in code built from it, or in its patch notes |

---

## 0. On one screen

- The owner wants girls whose attacks have **different shapes**, not only "a shot flies at one enemy" or "something explodes". Their ideas: true wide 360° shots, spinning 360° shots, constant flame attacks and real vines, "and such".
- **Some of this already exists in the sim, but only on one girl each, and it does not look like much yet.** Kinu already fires a true 360° ring, an expanding heat ring, a turning blade spiral and orbiting scissors (`src/sim/rings.js:1-15`). Chigusa already "vines" one enemy at a time, but on screen that is a status icon and a green ring, not a vine (`src/render/attackFx/styles/chigusa.js:1-4`). There is **no continuous attack at all** on `main`: every beam is a 0.16 s flash per shot (`src/render/fx.js:156-158`). The first held attack is Kohaku's constant beam, being built now for the duo on `feature/banners`.
- This spec turns those one-offs into **ten reusable attack shapes** with shared sim building blocks: Blossom Wheel (radial 360°), Pinwheel Stream (turning spiral), Hearth Stream (held flame cone), Bramble Road (vines along the road), Petal Halo (orbiters), Homecoming Throw (returning shot), Ripple Quake (ground shock rings), Rising Spikes (a line of spikes), Searchlight Sweep (a swinging beam) and Spirit Tether (links between enemies).
- **These are sim changes, not effects.** A shape decides who is hit and when, so each batch changes the sim id, needs a `COOP_PROTOCOL` bump and a balance pass. The VFX rules (`origin/feature/vfx:docs/VFX.md:8-22`) forbid touching the sim for an effect, so this cannot ride along in a VFX milestone.
- **Order:** an owner design board with an animated mock-up of every shape first → sim milestones in batches (one protocol bump per batch) → VFX polish on the VFX track's flipbooks (M2) and mesh shapes (M4).
- Which girl gets which shape is the owner's call (§8). §6 lists suggestions only.

---

## 1. Purpose and the owner's request

On Oct 28 the owner asked, in plain words, for **more unique attack types**: attacks that are not just straight-line projectiles or explosions. They gave examples:

1. **True wide 360° shots**: a girl fires in every direction at once.
2. **Spinning 360° shots**: a stream that turns around the girl and sweeps the whole circle over time.
3. **Constant flame attacks**: a held stream of fire, not separate fireballs.
4. **Actual vines**: vines you can see growing, not a coloured ring.
5. "**And such**": more shapes in the same spirit.

They said it is **for later** and asked for it to go into the VFX update instructions. They shared a reference video; its link stays in the private owner-decisions log and is not named or linked here, and nothing here copies a signature attack from anything in it. The shapes below are generic geometry (rings, cones, spirals, lines along a road) dressed in this game's own themes: school clubs, sakura, lanterns, sewing, gardening, weather.

This page is the plan a future session builds from: what each shape looks like, how it plays, how to build it deterministically for co-op, how to draw it within the phone budget, and how to stage the work.

---

## 2. What the game has today (survey)

### 2.1 Attack behaviours in the sim

Every tower runs one behaviour from the `BEHAVIORS` table (`src/sim/towers.js:1387-1400`), called from `updateTower` while her float cooldown allows (`src/sim/towers.js:1899-1919`). Kit modules add a per-step tick on top (`src/sim/towers.js:1890-1898`: strips, rings, drinks, sentries, vines, balls, drones / turrets).

| Behaviour | Code | What the sim does | Shape | Who uses it |
|---|---|---|---|---|
| `projectile` | `towers.js:751-790` (`attackProjectile`, `volleyFrom`), `spawnProjectile` `:666-715`, flight `projectileStep` `:1978` | N targeted shots per volley; extra shots fan out ±0.12 rad (`:781`); hitscan when speed 0 (`:772-779`), line pierce (`linePierce` `:717-741`), splash via `explode` (`:660-664`) | straight line or blast | Aoi, Yuki, Momo, Akane, Sango, Kage, Shiro, Midori, Miko, Chika (own shot), Tenka, Nami, Yoriko, Fuu, Hana, Ruri, Iroha, Ena, Yuzuha, Chigusa |
| `pulse` | `towers.js:792-808` | every enemy in range (up to `maxTargets`) is hit at once; emits `pulse` | disc around her | Hikari, Rei, Umeko, Hotaru, Noa |
| `duel` | `towers.js:810-849`, Kaede's blade arts `:915-995` | one focused target with a ramp; Kaede adds a cleave circle, wind crescents in a fan (literal angles, `:864`), a blade storm around her and a ground shockwave | point + small circles / lines | Kaede, Kanna |
| `beam` | `towers.js:1011-1040` | instant line pierce from her to the target and beyond (`BEAM_HALF_WIDTH`), optional ramp while the lead target stays the same | line, **one flash per attack** | Luna; Kohaku (duo partner weapon, banners) |
| `chain` | `towers.js:1069-1095`, `chainNext` `:1053-1067` | jumps to the nearest unhit enemy within `CHAIN_JUMP_RANGE + splash` | zig-zag | Raika, Seiran |
| `trap` | `towers.js:1113-1140`, triggers in `updateTraps` `:2076` | lays a trap on a random free road spot in range (rng: `:1130-1132`) | road object | Suzu |
| `turret` | `towers.js:1195-1215`, roaming drones `:1644-1758` | builds turrets / drones that fire their own shots; Chika's drones fire **guided** bullets that only hit their own target (`:1747`, `guidedStep` `:1927`) | many small shooters | Chika |
| `mortar` | `towers.js:1226-1276`, `updateShells` `:1278-1302` | delayed shells at a led aim point, offsets from the fixed `MORTAR_SCATTER` table (`constants.js:224-225`) | warned circles | Tsubaki (duo, banners) and returning mortar girls |
| `strip` | `src/sim/strips.js:157` (`layStrip`), `stripStep` `:229` | spike strips on road samples with a hit budget and lifetime | road object | Azami |
| `ring` | `src/sim/rings.js:116-136` (`attackRing`), `ringTick` `:219-224` | **true 360°**: N straight pins from a 240-direction table; Twin Spools turns the ring 1/16 per attack (`:129`, `:132`); Iron Ring = expanding heat ring (`:152-180`); Orbit Scissors (`:183-205`); ⚡ Blade Spiral (`:207-217`) | ring, annulus, orbit, spiral | Kinu |
| `drink` | `src/sim/drinks.js:83` | buffs an ally | — | Wakaba |
| `roll` | `src/sim/balls.js:114` (`rollBall`), `ballTick` `:258` | a ball rolls **up the road by path distance** and blasts on the first walker; ricochets | road runner + blast | Marumi |
| (kit) vines | `src/sim/vines.js:31-117` | every `vine.every` s a vine **holds** the lead non-boss walker (`hold` status) and ticks `vine.dps` once a second (`VINE_TICK`, `constants.js:309`); kills leave thorn beds (`:67-82`, `:119-148`) | single-target grab + small patches | Chigusa |
| (kit) sentries | `src/sim/sentries.js:206` | road-edge sentries that shoot | small shooters | Yuzuha |
| (ability) runners | `src/sim/runners.js:1-12`, `updateRunners` `:131` | something travels **along the road backwards** by path distance with `pointAt`, hitting each enemy once | road runner | Seiran's Dragonflight, Marumi's Giant Strike |
| (ability) zones | `src/sim/zones.js:1-35` | road patches with radius and lifetime; pull by path distance | area over time | Tenka's Gravity Well, Last Line |

Ability kinds in `src/data/abilities.js` today: boost, burst, debuff, deploy, econ, move, rally, runner, strike (counted from its `kind:` fields). None is a held stream or a sweep.

### 2.2 What each looks like on screen

| Sim event | Default drawing | Notes |
|---|---|---|
| `attack` (projectile kinds) | muzzle flash toward her facing (`src/render/BattleRenderer.js:388-408`) | projectile meshes by `projKind` (`towers.js:36-52`: arrow, bullet, shell, shuriken, orb, spark, needle, bolt, fireball) |
| `explode` | cel puff + core + shock ring (`fx.js:102`; reworked on the VFX branch, `VFX.md` "Blasts") | big blasts no girl owns may shake |
| `pulse` | ground ring + disc + 8 rising sparks (`fx.js:142-154`) | no direction, no motion over time |
| `beam` | a segment that lives **0.16 s** plus two glows (`fx.js:156-162`) | a flash, never a held beam |
| `chain` | jagged segments (`fx.js:164`) | |
| `ring` / `heatRing` | Kinu style: a starburst at her feet, silver needles with a red thread tail (`attackFx/styles/kinu.js:1-30`); heat rings and scissors drawn from sim state each frame (`src/render/actors.js:614-630`) | the only true 360° shape on screen today |
| `vine` | the shared hold status icon and a green pop on the held enemy (`attackFx/styles/chigusa.js:1-4`); thorn beds as dark green patches (`actors.js:671-680`) | **no vine geometry at all** |

The attack FX layer (`src/render/attackFx/index.js:1-12`) gives every girl a style (`attackFx/styles/*.js`) and shared patterns (`attackFx/patterns/`: bursts, rings, sweep, segments, drones, lunge, toss, motes, markers, patrol, spotter, clones). `patterns/sweep.js:1-2` already draws "light rays / a crescent sweeping across the angular span of the enemies the attack really hit", and `patterns/rings.js:1-2` staggered ground rings; both are drawings of instant sim hits, not held shapes.

### 2.3 The first continuous attack: Kohaku's constant beam (in progress)

On `feature/banners` Kohaku's prism beam is the duo's **partner weapon**: its own whole-tick timer (`origin/feature/banners:src/sim/duo.js:3-7`, `beamTicks` `:19-22`, `partnerTick` `:71-89`) that fires the ordinary `beam` behaviour with a partner spec (`buildPartnerSpec` `:29-67`). Today that is still a discrete flash per shot (5 damage, rate 0.7, range 3.6, pierce 4, hits flyers: `origin/feature/banners:docs/specs/DUO_LR.md:51`; Resonant Light "+8% per hit on the same enemy": `:63`).

The owner asked on Oct 28 for it to become a **constant beam**: locked on, small damage ticks, **the same DPS per tier** as the discrete version, Resonant Light ramping with **time on target**, each extra beam also constant, and the silence applied on lock and every 2 s. That work is not committed at ead2a378. It is the first held attack and the **template for every held shape here** (Hearth Stream, Searchlight Sweep): when it lands, its channel state and DPS-parity rule should be extracted into the shared held-channel primitive (§4.3) instead of building a second one.

### 2.4 Determinism rules (co-op lockstep)

The battle sim is deterministic lockstep co-op: both clients step the same sim from the same commands and must stay bit-identical (`CLAUDE.md` rules; `src/online/coop/version.js:1-20`).

| Rule | Where it is written | What new shape code must do |
|---|---|---|
| A sim change changes the sim id and needs a `COOP_PROTOCOL` bump | `CLAUDE.md`; `tools/simId.mjs:1-9` hashes every file under `src/sim` plus the co-op entry files (`:19-27`) and their import graph; `version.js:57` `COOP_PROTOCOL = 10` (11 on banners) | One bump per shipped batch (§7.2). "Nobody bumps it twice" (`version.js` comment for 4) |
| Transcendental Math is not bit-identical across engines | `src/core/detMath.js:1-17`; `CONTRACTS.md:2196-2197` | **No `Math.sin/cos/atan2/hypot` at runtime in new code.** Existing calls (`towers.js:646` `atan2` in `face`, `:670` `hypot`, `:674-675` `cos/sin` for spread) are only safe because co-op runs every Sim call inside `withDetMath` (`detMath.js:216`). New code uses tables and squared distances |
| Fixed tables for directions and orbits | `docs/specs/UNIT_GAPS.md:752-765`; `constants.js:56-77` (`DRONE_SLOTS` "printed to 17 digits so no trig runs at runtime"), `:120-127` (`ABILITY_SCATTER`), `:224-225` (`MORTAR_SCATTER`), `:276` (`RING_DIRS = 240`) | Build any table once at load with `DET_MATH.sin/cos` (`detMath.js:205`), as `rings.js:25-31` does, or print literals |
| Integer counters and tick timers | `origin/feature/banners:src/sim/duo.js:15` ("integer counters and tick timers, fixed tables, + − × ÷ and Math.round only"); `src/sim/zones.js:29-30`; `src/sim/lab.js:48-49` | Durations, tick periods, re-hit gaps and turn steps are integers of sim steps (`STEP = 1/60`, `constants.js:4`); the step number is `Math.round(sim.time / STEP)` (`rings.js:39`) |
| Squares by multiplication, whole powers by `powInt` | `UNIT_GAPS.md:754-756` | `d * d`, never `d ** 2` in new code |
| Road movement by path distance | `UNIT_GAPS.md:757`; `path.js:42` (facing computed once with `atan2` at build), `pointAt` `path.js:94-105` (plain arithmetic) | Anything on the road (vines, spike rows, quakes along a lane) moves and tests by `pathIndex` + `dist`, never by free-flight angles |
| Randomness only from `sim.rng`; ties by uid | `UNIT_GAPS.md:762`; every kit module header (`strips.js:15`, `rings.js:7-13`, `vines.js:18-19`) | Shapes add **no rng draws of their own** (no random spots, spreads or picks). The existing draws still happen inside what they call: `sim._hit` rolls a crit from `sim.rng` when the spec has crit chance (`Sim.js:497`) and a status with `chance < 1` rolls `ctx.rng` (`status.js:29-31`). So every shape must hit its victims in a fixed order, the same on both clients: the grid's own order, or (distance², uid) whenever a cap cuts the list, objects in uid order, groups' members in uid order. Never iterate a `Map`/`Set` keyed by object or anything view-dependent |
| Wave-end cleanup, calm-point saves | `rings.js:227-242`, `vines.js:150`, `zones.js:24-25`; co-op checkpoints are taken at every wave end (`src/online/coop/lockstep.js:40`) | Every shape object, and every per-girl shape integer (`t.ch`, `t.spinK`, a swing phase), ends or resets at the wave clear, so battle saves and co-op checkpoints carry none |
| Hash only what is there | `CONTRACTS.md:2167-2169`, `:2185-2188` (`hashSim` folds new state only once used) | `hashSim` (`src/online/coop/simHash.js:40`) folds a shape's state only while non-empty, so battles without the new girls keep their hash |
| Cross-engine proof | `e2e/engines.mjs:1-27` (V8, JavaScriptCore, SpiderMonkey) | Each batch adds a scripted co-op battle that uses its shapes |
| Known sim ids per protocol | `tests/art/itemArtRuntime.test.js:196` (`KNOWN = { 8: …, 9: …, 10: '2c3c74708a2c' }`) | Each batch adds its protocol's id |

### 2.5 Performance limits for effects

| Limit | High | Medium | Low | Source |
|---|---|---|---|---|
| Attack-FX quad budget per frame | 900 | 500 | 250 | `src/render/attackFx/context.js:15-19` (`KNOBS`); `ATTACK_FX.md:171-187` |
| Shed order past the budget | decor at 60 %, familiars at 80 %, motes at 95 %; core never | | | `context.js:7-12` (`SHED_AT`) |
| Per-frame event decoration caps | muzzle 24, tracer 16, impact 16, sweep 8, launch 8 | | | `context.js:22` (`CAPS`) |
| Particle pool (`FxSystem`) | 1,600 | 900 | 380 | `src/render/fx.js:43-48` (`setQuality`), density 1 / 0.65 / 0.32 |
| Floating texts | 70 | 40 | 40 | `fx.js:47` |
| Pooled game-time quads | 768 shared | | | `context.js:226` (`QuadPool`) |
| Halos (medium, VFX M1) | ≤ 24 a frame per layer | | none on low | `VFX.md` "Glow" |
| Sim straight shots (Kinu) | 60 per girl, 200 per player, 400 per sim | | | `constants.js:271-274` |
| Road objects (Azami) | 80 per player, 160 per sim | | | `constants.js:262-263` |
| Sim step cost | < 2 ms a step locally (CI 6) with 30 girls and 200 enemies | | | `tests/sim/perf.test.js:79-80` |

VFX ground rules that every shape's drawing must keep (`origin/feature/vfx:docs/VFX.md:8-22`, `:213-245`; `ATTACK_FX.md` truth rules T1-T5):

- **Render only** for effects; effects never use `sim.rng` or `Math.random` (seeded visual streams, `VFX.md` "Seeded visual randomness").
- **Phones first**: medium and low get no new full-screen passes.
- **Reduce Motion** (`settings.reduceMotion`, passed into attack FX at `BattleRenderer.js:183`): no shake, holds, impact frames or big flashes; soft versions only.
- **Flash guard** counts flashing screen area a second; an additive sprite ≤ 0.35 s and ≥ 0.3 tiles counts as a world flash (`VFX.md:227-240`). **A held stream drawn from short additive puffs would be counted as a stream of flashes**, so held shapes draw their body alpha-blended (cel style, like the blasts) with only a thin additive core.
- **Truth**: anything drawn reaching an enemy reaches the enemy the sim hit, at the sim's time (T1); area visuals stay inside the sim radius (T5).
- **Flashes & shake off** (`settings.hitEffects`, `VFX.md:218-222`): no screen flash of any kind and no shake; a shape's own body still draws.
- **No large saturated red** in flashes (`VFX.md:238-241`): flame shapes keep their body orange-gold and any flash on them goes through the flash guard.
- **Projectile sprites are never shed** (`ATTACK_FX.md` Budgets: decor, familiars and motes shed; projectile sprites, reticles, tracers and victim marks never), so a shape's real shots and pieces are always drawn; only trails and sparkle are decor.
- **Readability**: enemies, the road and health bars stay readable.

---

## 3. Why these are not render-only

Each shape changes **who is hit, when, and how often**: a cone hits everything in a wedge every 0.1 s, a ring hits each enemy once as it passes, a vine holds walkers on a stretch of road. Those are sim decisions. So every shape is:

1. **A sim behaviour or kit** under `src/sim` (or a data field that one reads). The sim id changes (`tools/simId.mjs`), the batch needs a `COOP_PROTOCOL` bump (`src/online/coop/version.js`), `hashSim` must fold the new state, the battle save and co-op checkpoints must stay calm-point safe, and the cross-engine run must pass.
2. **A balance change.** A girl who moves from 3 shots a second to a 10-tick stream with a burn must land on her old DPS per tier unless the owner wants her stronger. Bench it (`tools/bench.mjs:1-20`, crowd and boss rows, `--compare` against a baseline).
3. **Plus VFX.** The look is built on the VFX track's later milestones (flipbooks M2, mesh shapes and ribbon trails M4), which are render only.

What *can* be render only, and could go into a VFX milestone today without this spec: making **existing** shapes look better. Kinu's pins and heat ring, Chigusa's grab drawn as a real vine reaching up out of the road to the held enemy (the sim already emits `vine` with the target, `vines.js:61`), Hikari's pulse as a petal ring. These do not add new attack types; they are listed in §7.4 as optional quick wins.

---

## 4. Shared sim building blocks (build once)

Every shape below is assembled from these. Build them in the first sim batch that needs them; later batches reuse them.

### 4.1 Direction table (`src/sim/dirs.js`, new)

- Move the 240-entry unit-vector table out of `rings.js:25-36` into a shared module (built once at load with `DET_MATH.sin/cos`, `k = 0` pointing +y, clockwise, as today). `ringDir(k)` stays as an alias so Kinu's code reads the same.
- 240 divides by 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 40, 48, 60, so every "N shots evenly round" and every 1/16 turn is exact (`constants.js:275-276`).
- `nearestDir(dx, dy)`: the table index with the largest dot product with (dx, dy). Coarse scan of every 10th entry (24 dots), then the 19 entries around the best; ties to the lower index. Only + − × and compares, so it replaces runtime `atan2` for aiming.
- `COS2[h]`: cos² of `h` table steps (h = 0…60, 1.5° each), built at load with `DET_MATH.cos`, for cone tests without square roots.
- `turnToward(k, kTarget, maxSteps)`: moves an index at most `maxSteps` table steps the short way round (integer arithmetic mod 240).

### 4.2 Shape tests (`src/sim/shapes.js`, new)

All take a bounding-circle candidate list from `sim.grid.query` / `sim.grid.each` (`src/sim/grid.js:50`, `:74`) and test with squared distances. Victims are sorted by (distance², uid) when a cap applies.

| Test | Inputs | Rule |
|---|---|---|
| `inCone` | origin, dir index `k`, half-angle steps `h`, length `L`, enemy offset (ex, ey), d² | `d² ≤ (L + hr)²` and either `d² ≤ hr²` (touching her) or `dot > 0` and `dot² ≥ COS2[h] · d²` where `dot = ex·dirX[k] + ey·dirY[k]`; `hr` is `hitRadius(e)` (`towers.js:55-57`) |
| `inBand` | centre, inner r0, outer r1 | `r0² < d² ≤ r1²`, the heat ring's rule (`rings.js:163-172`) |
| `nearSegment` | segment A→B, half-width | `segDistSq` (`path.js:148`) ≤ (hw + hr)², as `linePierce` (`towers.js:717-741`) |
| `onRoad` | `pathIndex`, distance span [d0, d1] | `e.pathIndex === pathIndex && d0 ≤ e.dist ≤ d1` (enemy fields: `enemies.js:56-71`); shared stretches follow Marumi's rule (`balls.js:27-32`: same road point and direction dot > 0.95) |
| `inDisc` | centre, r | `d² ≤ (r + hr)²` |

Eligibility always goes through `isEligible(e, spec)` (`src/sim/combat.js`): tunnels, flyers without `canHitAir`, veiled enemies without detection.

### 4.3 Held channel (`src/sim/channel.js`, new; extracted from Kohaku's constant beam)

A girl with a held attack keeps a small integer record instead of a cooldown:

```
t.ch = { uid, k, lockTicks, tick, grace, extra: [] }   // every field an integer (extra: one record per extra beam)
```

- **Lock**: `uid` is her target by her target mode (`bestTarget`, `towers.js:514`); `k` her aim index, turned toward `nearestDir(target − her)` by at most `turn` steps a sim step (`turnToward`), so a stream visibly swings rather than snapping.
- **Ticks**: every `CH_TICK` sim steps (proposal: 6 = 0.1 s) the shape's test runs and each victim takes one hit through `sim._hit` (`src/sim/Sim.js:495`).
- **DPS parity** (the owner's rule for Kohaku, applied to all): tick damage = `spec.damage × spec.rate × CH_TICK × STEP`. A girl's damage and attack speed stats, her buffs, gear and Potential therefore keep meaning what they meant; tier tables need no rewrite.
- **Ramp with time on target**: `lockTicks` (sim steps, an integer) counts while the same `uid` stays locked; the scale is `1 + min(per × rate × lockTicks × STEP, max)`, where `per` is the old per-hit step and `rate` her attacks a second, so after any whole number of seconds she has the same ramp the discrete version had after the same number of hits (Resonant Light style, `towers.js:1021-1030`).
- **Grace and release**: losing the target keeps the channel `grace` steps (proposal: 12) aimed where it was; then it releases and `t.ch` is cleared. A new target restarts `lockTicks` at 0.
- **On-lock effects**: anything "on lock and every N s" (Kohaku's silence) runs when `lockTicks === 0` and when `lockTicks % (N × 60) === 0`.
- **Not while sabotaged or moving**: `updateTower` already returns early (`towers.js:1885-1889`); the channel releases.
- **Events**: one `channel` event on lock / switch / release `{ towerUid, targetUid, k, shape }`; the renderer reads `t.ch` every frame for the rest (as it reads Kinu's rings, `actors.js:614-630`). No per-tick event spam.

### 4.4 Re-hit gaps, caps and lifetimes

- **Re-hit gaps** in integer steps per object: a small `[uid, step]` list on the object (cap 32, oldest dropped), the pattern of `ring.hit` (`rings.js:167-172`) and `e.scissorAt` (`rings.js:197-201`). Avoid a field on the enemy shared by every copy of a girl (Kinu's scissors share `e.scissorAt` across all Kinus today; new shapes keep the gap per object).
- **Caps** per girl, per player and per sim, oldest uid evicted first, exactly as `straightRoom` (`rings.js:46-72`) and the road-object caps (`constants.js:258-292`). New constants go in one appended block in `constants.js`.
- **Lifetimes** in integer steps; every shape object ends at the wave clear (an `endShapeWave(sim)` beside `endRingWave` / `endVineWave`).

### 4.5 Hooks

- A new attack behaviour goes into `BEHAVIORS` (`towers.js:1387-1400`).
- A persistent shape (vines, orbiters, quake rings, spike rows) gets a kit tick in `updateTower` beside `ringTick` / `vineTick` (`towers.js:1890-1898`).
- Unit data names the shape with plain fields on `base` / tier mods (`src/data/unitKit.js` helpers), so tiers can widen a cone, add shots, lengthen a vine.
- `hashSim` folds each new state list only while non-empty; the battle-save writer needs nothing new because everything ends at the wave clear (calm points hold none).

---

## 5. The catalogue

Each shape: what the player sees, how it plays, the sim mechanics, the VFX (with a per-girl quad allowance on high / medium / low and the Reduce Motion version), and which girls it could suit. Quad allowances are per visible copy and must fit inside the 900 / 500 / 250 budget with a full board; anything past the allowance is decoration and sheds first.

### 5.1 Blossom Wheel: radial 360° burst (`radial`)

| | |
|---|---|
| **Player sees** | She plants her feet, a flower-shaped flash opens at her feet and N shots leave at once in a perfect wheel, evenly spaced, flying straight outward to the edge of her range |
| **Plays** | Fires while any eligible enemy is in range (no aim). Shots do not home. Each shot pierces `pierce` enemies and dies at `travel` tiles. Strong when enemies surround her (road bends, crossings), weak on a straight road beside her, which is the trade-off. Tiers add shots (8 → 12 → 16 → 24), travel, pierce, and a second wheel offset by half a gap |
| **Sim** | This is Kinu's `attackRing` (`rings.js:116-136`) made generic: `spawnStraight` (`rings.js:78-112`) per direction `floor(i × 240 / n) + offset`, swept collision and pierce in `projectileStep` (`towers.js:1978`), caps via `straightRoom`. A girl with a different weapon only needs her own `kind` (petal, ofuda, coin, ember). **Damage**: per-shot damage is set by bench so her crowd DPS lands on the target (most of a wheel misses on a straight road; do not use DPS parity per shot) |
| **VFX** | Muzzle: one flipbook "bloom" (M2 sheet) at her feet. Shots: her `kind` sprite with a short ribbon trail (M4). Impact: small pop per hit, capped by `CAPS.impact`. Allowance **48 / 28 / 24** quads (low: every shot's sprite and no trails; a shot's sprite is never shed, so a 24-shot wheel needs 24 on low) |
| **Reduce Motion** | No screen-space flash on the burst; the bloom is a soft ground ring at ≤ 0.2 opacity |
| **Suits** | Kinu (already has it; make it look "true wide"), Miko (an ofuda wheel), Momo (Encore Toss as a coin wheel), Hotaru (spirit lights in a wheel), Noa (a petal ward that also cuts) |

### 5.2 Pinwheel Stream: turning spiral (`spiral`)

| | |
|---|---|
| **Player sees** | A steady stream of small shots leaves her like water from a garden sprinkler, the nozzle turning so the stream sweeps the whole circle every few seconds; with upgrades two or four arms turn together, or two streams turn opposite ways and cross |
| **Plays** | Runs while any eligible enemy is in range. Every `every` steps (proposal 6 = 0.1 s) each arm fires one straight shot along its current direction; the direction advances `turn` table steps per shot (240 / turn shots per full circle). Damage per shot × shots a second ≈ her DPS spread round the circle, so enemies in her reach take a share each pass. Tiers: arms (1 → 2 → 4), turn speed, pierce, a "lock" tier where the turn slows while the stream points at an enemy (the sweep lingers on a crowd) |
| **Sim** | Kinu's ⚡ Blade Spiral (`rings.js:207-217`) generalised: arm angle = `(step / every × turn + arm × 240 / arms) mod 240` read from the step number, so there is no state to save; reverse arms use `240 − k`. The "lock" tier needs one integer on the girl (`t.spinK`) advanced by 1 or `turn` per shot. Shots via `spawnStraight`, the same caps. Cost: one projectile per arm per 0.1 s, each lives `travel / speed` s; 4 arms × 10 a second × 0.25 s ≈ 10 live shots per girl |
| **VFX** | Each shot a small sprite; the stream reads as a curve because the shots are dense. On high, a faint ribbon joins the newest shots of an arm (M4 trail). A tiny turning nozzle glyph at her hand. Allowance **40 / 24 / 10** |
| **Reduce Motion** | Same shots (they are the game), no nozzle spin glyph, trails off |
| **Suits** | Fuu (Turbine Dancer: wind in a turning spiral), Kage (her Shuriken Cyclone tier name already promises it), Kinu (her ⚡ spiral as a base attack on one path), Ruri (a turning star stream) |

### 5.3 Hearth Stream: held flame cone (`stream`)

| | |
|---|---|
| **Player sees** | She holds out her weapon and a continuous stream of fire pours from it in a widening cone, curling and flickering, swinging smoothly to follow her target. Enemies in the cone catch fire and keep burning after they leave it |
| **Plays** | A held channel (§4.3). Locks onto her target by target mode, turns toward it at `turn` steps a sim step (a slow turn means fast enemies can outrun the mouth of the cone). Every 0.1 s every eligible enemy in the cone (half-angle `h`, length = range) takes one tick, capped at `maxTargets` nearest first. Ticks apply **burn** (status `burn`, `status.js:6`, merges keeping the stronger values, `status.js:96-106`; give it no `chance`, so no extra rng draw). Damage falls off toward the tip (× 1.0 at her, × 0.7 at the end, linear in d² so no sqrt) so close-in enemies take more. Does not hit flyers unless a tier says so. Variants by element: **frost** (applies slow, then freeze on a long lock), **poison mist** (poison instead of burn, wider and shorter), **water jet** (narrow, knockback by path distance with the push lock, `PUSH_LOCK`, `constants.js:231`) |
| **Sim** | `t.ch` + `inCone` each tick over `sim.grid.query(origin, L + 0.5)`. DPS parity per §4.3 (tick = damage × rate × 0.1 s), then burn on top, so balance the burn's share (bench). State: the channel only. Event: `channel` on lock / release; no per-tick events. Cost: one grid query and ≤ maxTargets hits per 6 steps per girl |
| **VFX** | Body: an alpha-blended **looping flame flipbook** (M2 sheet, 8×8 at 128 px; 4×4 on low) on 3-5 quads laid along the cone, scaled by the sim's real half-angle and length (T5). Thin additive core line from her hand (`ctx.line`, `context.js:122-131`). Embers: a few real-time particles drifting up (density-scaled). Ground scorch decal under the cone on high (M5 ground marks). Burning enemies get the shared burn status look. Allowance **24 / 14 / 6**. **Flash guard**: the body is alpha-blended and its puffs live > 0.35 s, so it is not a world flash; only the core is additive and thin (< 0.3 tiles) |
| **Reduce Motion** | No flicker scale wobble, flame loop at half speed, embers off |
| **Suits** | Akane (Flame Witch; her Wildfire path is already "lingering burns", `units.js:566-569`), Kinu's Hot Iron path as a steam stream, Midori (poison mist variant; her Drifting Mist tier), Yuki (frost breath variant; Frost Trail / Permafrost), Umeko or Sango (water jet variant) |

### 5.4 Bramble Road: vines that grow along the road (`bramble`)

| | |
|---|---|
| **Player sees** | A vine bursts up through the road at a spot in her range and **grows along the road** toward the enemies, thick stems with leaves and thorns. Walkers on it slow down, the lead one is wrapped and held; at intervals the vine lashes, a whip of the stem cracking across everything on it. After a few seconds it withers back into the ground |
| **Plays** | Every `every` s she roots a vine at the road spot in her range nearest the exit that has a walker within `len` tiles upstream (ties: lane, distance), like Azami's spot choice (`strips.js:27-44`). The vine grows upstream at `grow` tiles a second up to `len`. While it lives: every walker on the grown stretch is slowed (`slow`, refreshed each tick); the first walker it reaches is **held** (`hold` status, `status.js:9`, `:28`; bosses and flyers immune, minibosses resist, `CC_RESIST`); every `lash` s it hits every walker on it once. Tiers: longer vines, two at once, thorns that shred armour, a capstone "Forest Road" that leaves the vine for the whole wave. Never touches flyers or enemies in tunnels |
| **Sim** | A road object like a strip or a runner: `{ uid, pathIndex, root, len, grown, ttl, lashCd, held }` with integer step timers. Membership is the 1-D `onRoad` test on `e.dist` (no geometry at all: the road's shape is already in the path), so cost is O(enemies on that path) per tick, and it is fully deterministic. Growth uses `pointAt` only for the event's endpoints. Caps under the existing road-object caps (`constants.js:262-263`). Upgrades Chigusa's kit (`vines.js`): `castVine` becomes "root a vine", the hold remains, thorn beds stay as they are |
| **VFX** | The real vine: a **ribbon mesh along the road centreline** from `root` to `root + grown` (sampled with `pointAt` on the render side, which only reads the sim), extruded as a twisted stem with leaf and thorn cards (one instanced mesh per vine type, M4 budget: one draw call per shape type, < 500 triangles per vine). Growth front: a burst of soil and leaves (M2 flipbook). The held enemy: two tendrils coiling around it (two curved ribbons). Lash: the ribbon's vertex wave travels along it once (shader time uniform, no extra quads). Wither: the ribbon shrinks back from the tip. Allowance **18 / 10 / 4** quads (leaves) + the ribbon draw |
| **Reduce Motion** | No lash wave (a brief colour pulse instead), growth shown as a fade-in along the stem |
| **Suits** | Chigusa (Greenhouse Gardener: her Creepers, Strangler Vine, Thorn Hedge and Forest Corridor tiers, `unitsNewGirls.js:389-390`, already describe this), Ena (cursed roots for Cursed Bloom / Red Spider Lily), a future gardening or forestry club girl |

### 5.5 Petal Halo: orbiting petals or blades (`orbit`)

| | |
|---|---|
| **Player sees** | Petals, blades, paper charms or glass shards circle her in a ring, steadily turning; enemies that walk into the ring are cut as each piece passes. Upgrades add pieces, widen the ring, or add a second ring turning the other way |
| **Plays** | Passive while a wave runs. Each piece hits any eligible enemy within its contact radius, each enemy at most once per piece every `gap` steps. Good against crowds that pass close, useless far away; pairs with a long-range main attack on the same girl (a second weapon, the duo's partner pattern) |
| **Sim** | Kinu's Orbit Scissors (`rings.js:183-205`) generalised: piece j's position = `her + dir((step × speed + j × 240 / n) mod 240) × reach`, read from the step number (no state). Contact via `inDisc`. Per-piece re-hit list (§4.4) instead of the shared `e.scissorAt`. Cost: n small grid queries a step; cap n ≤ 8 per ring, 2 rings |
| **VFX** | Each piece one sprite (petal / blade / charm / shard), spinning on its own axis, with a 3-quad fading trail on high. Contact: a tiny slash spark (impact cap). Allowance **64 / 24 / 16** (up to 16 pieces are always drawn; high adds 3-quad trails, medium one spark per piece; low pieces only) |
| **Reduce Motion** | Pieces keep their real positions (they are the truth) but no self-spin and no trails |
| **Suits** | Kinu (already has scissors), Noa (petal ward; Thousand Petal Ward tier), Iroha (glass shards; Shattered Glass path), Hotaru (fireflies; Firefly Swarm / Firefly Grove), Ruri (a small holo pack circling) |

### 5.6 Homecoming Throw: returning shot (`return`)

| | |
|---|---|
| **Player sees** | She throws a fan, ring blade or kunai on a cord; it flies out through the enemies, slows, turns and flies back to her hand, cutting through them again on the way home |
| **Plays** | Aimed at her target's direction. Out leg: straight to `travel` tiles, piercing everything (each enemy once per leg). Back leg: straight back to her. An enemy can be hit twice per throw (once each way), so lined-up crowds take double. She cannot throw again until it returns (the return time is her cooldown, which makes range a trade-off: a longer throw is a slower attack). Tiers: two throws in a V, a curve tier (the return arc is offset by a fixed table, still deterministic), an "ensnare" tier (enemies hit on both legs are slowed) |
| **Sim** | A straight projectile record (`spawnStraight` shape) with `ret: { leg, k }`: at `maxTravel` it does not die but flips `vx, vy` (exact negation, no trig), resets its hit list, sets `maxTravel` to the way home, and on arrival dies and sets `t.cooldown` to 0. The curve tier adds a per-step lateral offset from a 16-entry literal table. Aim by `nearestDir` |
| **VFX** | The weapon sprite spinning (rotation from visual time), a ribbon trail (M4), a tiny catch flash at her hand. Allowance **10 / 6 / 3** |
| **Reduce Motion** | No spin, the trail shortened |
| **Suits** | Fuu (fans; her Returning Gale path), Kage (kunai on a cord; Kusarigama tier), Hana (her falcon flies out and back), Rei (a thrown blade wave that returns) |

### 5.7 Ripple Quake: ground shock rings (`quake`)

| | |
|---|---|
| **Player sees** | She stamps, strikes a drum or slams a mallet and rings of force roll out across the ground from her, one after another, cracking the road as they pass; enemies hop as the ring passes under them |
| **Plays** | Each attack sends `rings` rings `gap` steps apart; each grows at `speed` to her range and hits each ground enemy it crosses once. Ground only (flyers are never hit) unless a tier adds an air shock. Ring 1 full damage, later rings × 0.6 and a short stun / slow on the last (a "stagger" combo). Tiers: more rings, a stun, a knockback by path distance with the push lock |
| **Sim** | Kinu's heat ring (`rings.js:152-180`) made generic: `{ x, y, r, max, hit[] }` grown by `speed × STEP` per step, victims in `inBand(prevR, r)`. Ground filter: `!e.airborne`. Several rings per attack are queued with integer start delays. Cost: one query per ring per step for ≤ `max / speed` s |
| **VFX** | A hard alpha ground ring per sim ring at the sim's radius (T5), a crack decal flipbook following it on high (M2), small dust puffs where it crosses an enemy. Shake: never for a basic attack (`VFX.md` "A girl's basic splash never shakes"). Allowance **16 / 10 / 4** |
| **Reduce Motion** | No enemy hop squash, rings at reduced opacity |
| **Suits** | Kanna (Drum Club Advisor: drum beats), Kaede's Guard Breaker shockwave (already a sim shape, `towers.js:915-998`), Rei (Counter Form stamp), Suzu (bell toll rings), Hikari (a sword plunge on her pulse) |

### 5.8 Rising Spikes: a line of spikes from the ground (`spikeline`)

| | |
|---|---|
| **Player sees** | She strikes the ground and a row of spikes (ice, stone, thorns, light) erupts one after another in a line, racing away from her toward the enemies; each spike stabs up, holds a moment, then sinks |
| **Plays** | Two forms, chosen per girl: **toward** (a straight line from her toward her target, `count` spikes `spacing` apart) or **along the road** (a row that runs upstream along the lane from the road point nearest her target, like a runner). Spike i rises `i × delay` steps after the attack and hits every eligible ground enemy within its radius once. A short **pin** (hold) on the first spike's victims on some tiers. Bosses take damage but are never pinned |
| **Sim** | A `{ uid, pts: [[x, y]…], born, delay, r, hit[] }` record; points from `her + dir(k) × (i × spacing)` (table, no trig) or from `pointAt` along the lane. Each step, spikes whose rise step equals now run `inDisc`. Cost: ≤ count small queries over the row's life. Caps: rows per girl / sim (road-object pattern) |
| **VFX** | Each spike a small instanced mesh (one draw call per spike type, M4) that pops up with a squash, holds, and sinks; a dust ring at its base. Allowance **20 / 12 / 6** (low: no dust) |
| **Reduce Motion** | Spikes rise without the squash overshoot |
| **Suits** | Azami (her Detonation Line / Checkpoint tiers as a spike row), Yuki (ice spikes; Icicle Lance, Glacial Prison), Chigusa (a thorn row on one path), Sango (a coral row along the waterline) |

### 5.9 Searchlight Sweep: a swinging beam (`sweep`)

| | |
|---|---|
| **Player sees** | A long beam of light stays on and **swings back and forth** across the road like a searchlight, centred on where the enemies are; everything the beam passes over is struck and briefly revealed |
| **Plays** | A held channel (§4.3) whose aim index oscillates between `centre − arc` and `centre + arc` at `swing` steps a sim step; the centre follows `nearestDir` to her target (slowly). Each tick, enemies within the beam segment (`nearSegment`, length = range) take a hit, each at most once per `gap` steps (so a slow swing does not melt one enemy). **Reveals** veiled enemies it crosses for a moment. Tiers: wider arc, two beams sweeping opposite ways, a "hold" tier where the swing pauses briefly on the densest point |
| **Sim** | `t.ch` + an integer swing phase; tests via `segDistSq` with the beam end `her + dir(k) × L`. Reveal applies the existing reveal status. Damage per tick by DPS parity, split by the re-hit gap (bench the result: a sweep hits more enemies less often) |
| **VFX** | A held beam: core line (`ctx.line`) + a soft wide cone of light on the ground (one alpha ground quad, scrolling texture) + dust motes in the light on high. Allowance **12 / 8 / 4**. Not a flash (held, alpha body) |
| **Reduce Motion** | The beam swings (it is the game) but the ground glow is fainter and motes are off |
| **Suits** | Umeko (her Lighthouse path, `units.js:758-762`, is a beacon in name; the sweep makes it one), Luna (beam hero), Kohaku (a Prism Corridor variant on her constant beam), Tenka (a sweeping rail on Rail Arms) |

### 5.10 Spirit Tether: links between enemies (`tether`)

| | |
|---|---|
| **Player sees** | Glowing threads snap from her target to the enemies near it, tying them together; when one is hit, the others flinch and take a share; at the end the threads pull tight and drag the group together |
| **Plays** | Every attack ties her target to up to `links` enemies within `reach` (the chain walk, `chainNext`, `towers.js:1053-1067`, ties by uid). For `dur` s, damage **from any girl** to a tied enemy is shared: each other tied enemy takes `share` of it (shared damage does not share again). On expiry (tier 3+), tied walkers are pulled toward the group's lead by path distance, a little, with the push lock. Bosses can be tied but are never pulled |
| **Sim** | A tether group `{ uid, owner, members: [uid…], left, share }` (integer steps). The share hook sits in `Sim._hit` (`Sim.js:495`) behind a `sim._tetherOn` counter, so battles without a tether girl run exactly as before and keep their hash (the zones pattern, `zones.js:26-28`). A re-entrancy flag stops a shared hit from sharing again. Per-step budget for shared hits (the curse queue pattern, `CURSE_BURSTS_PER_TICK`, `constants.js:246`). Pull by path distance with `PUSH_LOCK` (`constants.js:231`) |
| **VFX** | Threads as thin catenary lines between enemies (`ctx.line` segments with a sag table), a pulse running along them when a share lands, a snap-tight on the pull. Allowance **16 / 8 / 4** |
| **Reduce Motion** | No pulse travel, threads static |
| **Suits** | Ena (Fortune Hacker: Shared Fate, Red Threads, Threads of Destiny), Yoriko (Drama Club Director: puppet strings), Raika (a lingering static link on Storm Rhythm) |

### 5.11 Also considered (not specced yet)

- **Homing swarm** (fireflies, paper birds): the sim already has guided shots for Chika's drones (`towers.js:697`, `guidedStep` `:1927-1966`). A swarm is a burst of guided shots with short lifetimes; mostly a VFX question. Good for Hotaru later.
- **Falling rain zone** (petals or needles over an area for a few seconds): close to a zone (`zones.js`) with a hit cadence; overlaps mortar and Spike Rain.
- **Bouncing light** between walls of the map: needs map geometry the sim does not have; skip.

### 5.12 Summary table

| # | Shape | Kind | Reuses | New sim pieces | Sim cost per girl | Quads H / M / L |
|---|---|---|---|---|---|---|
| 1 | Blossom Wheel | instant, 360° | `rings.js` pins | none beyond `dirs.js` | ≤ 24 straight shots per attack | 48 / 28 / 24 |
| 2 | Pinwheel Stream | over time, 360° | `rings.js` spiral | `t.spinK` (lock tier) | ~10 live shots | 40 / 24 / 10 |
| 3 | Hearth Stream | held cone | Kohaku's channel | `channel.js`, `inCone`, `COS2` | 1 query / 0.1 s | 24 / 14 / 6 |
| 4 | Bramble Road | road object | strips, runners, vines | vine road record, `onRoad` | O(walkers on that lane) / tick | 18 / 10 / 4 + ribbon |
| 5 | Petal Halo | orbit | Kinu scissors | per-piece re-hit list | n small queries / step | 64 / 24 / 16 |
| 6 | Homecoming Throw | out-and-back | straight shots | leg flip | 1-2 live shots | 10 / 6 / 3 |
| 7 | Ripple Quake | expanding rings | heat ring | queued ring starts, ground filter | 1 query / ring / step | 16 / 10 / 4 |
| 8 | Rising Spikes | timed line | strips / runners | spike row record | ≤ count queries | 20 / 12 / 6 |
| 9 | Searchlight Sweep | held, swinging | channel | swing phase | 1 segment test / tick | 12 / 8 / 4 |
| 10 | Spirit Tether | link | `chainNext`, curse queue | `_hit` share hook | budgeted shares | 16 / 8 / 4 |

A board with one girl of each of the ten shapes uses about 270 quads of the 900 budget on high, about 145 of the 500 on medium and about 80 of the 250 on low (the sums of the column), leaving room for everyone else's shots and impacts. Several copies of the same shape multiply their row; the shapes stress case (§7.2 step 7) and the attack preview at every tier (§7.3) must show a full board of the batch's girls within budget.

---

## 6. Which girls could use which shape (suggestions only)

The owner decides. These are fits by theme, element and current role. Elements and roles from `src/data/units.js`, `unitsExpansion.js`, `unitsNewGirls.js` (dumped with `node` from `UNITS`).

| Girl | Role · element · weapon | Behaviour today | Best fit | Why |
|---|---|---|---|---|
| Akane | bombardment · fire · staff | projectile (fireball) | **Hearth Stream** (fire) | Flame Witch; Wildfire path already "lingering burns" |
| Chigusa | botanist · — · watering can | projectile + vine kit | **Bramble Road**, Rising Spikes (thorns) | her vine tiers already describe growing vines |
| Kinu | ring · — · needle | ring (360°) | Blossom Wheel, Pinwheel, Petal Halo (polish), Hearth Stream (steam) | she is the existing 360° girl; Hot Iron as a steam stream |
| Fuu | displacement · — · fan | projectile | **Pinwheel Stream**, Homecoming Throw | Turbine Dancer; Returning Gale path |
| Kage | skirmisher · — · shuriken | projectile | Pinwheel (Shuriken Cyclone), Homecoming Throw (Kusarigama) | tier names already promise both |
| Umeko | support · water · staff | pulse | **Searchlight Sweep**, water jet stream | her Lighthouse path |
| Ena | hexer · — · cards | projectile | **Spirit Tether**, Bramble Road (cursed roots) | Shared Fate / Red Threads |
| Yoriko (hero) | puppeteer · — · puppet | projectile | Spirit Tether (strings) | puppeteer |
| Kanna (hero) | champion · — · mallet | duel | **Ripple Quake** | drum club |
| Yuki | controller · frost · staff | projectile | Rising Spikes (ice), frost stream | Icicle Lance, Glacial Prison |
| Midori | alchemist · poison · flask | projectile | poison-mist stream | Drifting Mist |
| Azami | spiker · — · strip | strip | Rising Spikes along the road | Detonation Line |
| Noa | purifier · — · shield | pulse | Petal Halo, Blossom Wheel | Thousand Petal Ward |
| Hotaru | exorcist · — · lantern | pulse | Petal Halo (fireflies), homing swarm (later) | Firefly Swarm / Firefly Grove |
| Iroha | mirror · — · mirror | projectile (relay) | Petal Halo (glass shards) | Shattered Glass |
| Miko | enchanter · — · gohei | projectile | Blossom Wheel (ofuda wheel) | talismans |
| Momo | economy · — · mic | projectile | Blossom Wheel (coin wheel) | Encore Toss |
| Luna (hero) | mystic · — · staff | beam | Searchlight Sweep | beam hero |
| Kohaku (duo) | — · — · staff | beam (partner) | constant beam (in progress), Searchlight variant | Prism Corridor |
| Hana | falconer · — · bow | projectile | Homecoming Throw (falcon out and back) | Falconry |
| Rei | cleaver · — · katana | pulse | Ripple Quake, Homecoming Throw (blade wave) | Whirlwind / Counter Form |
| Suzu | trapper · — · bell | trap | Ripple Quake (bell toll) | bells |
| Raika | chain · lightning · staff | chain | Spirit Tether (static link) | Storm Rhythm |
| Tenka | powerhouse · — · rifle | projectile | Searchlight Sweep (rail) | Rail Arms |

Girls without a strong fit (Aoi, Shiro, Sango, Chika, Wakaba, Yuzuha, Ouka, Marumi, Kaede, Seiran, Nami, Hikari, Ruri) can stay as they are; their identities are already clear (sniper, artillery, drones, bowler, blade arts).

---

## 7. How to stage it

### 7.1 Step 1: a design board with the owner (no code in the game)

- One owner page (an artifact board, like the earlier boards) with an **animated mock-up of every shape**: a small canvas loop per shape on a sample road with walking dots, drawn in the game's palette, showing the shape, its reach and its timing. Each with two lines: what it does, which girls could get it.
- Mock-ups use the same direction table and tick rules as the spec, so what the owner approves is what the sim can do.
- The owner picks: which shapes, which girls, new girls or reworks, how many per update (§8). Nothing is built before this.

### 7.2 Step 2: sim milestones, one batch per release, one protocol bump each

| Batch | Shapes | Shared pieces built | Depends on |
|---|---|---|---|
| **S1 "Wheels"** | Blossom Wheel, Pinwheel Stream, Petal Halo | `dirs.js` (moved out of `rings.js`), `shapes.js` (`inDisc`), per-object re-hit lists | nothing (pure reuse of `rings.js`) |
| **S2 "Held"** | Hearth Stream (+ element variants), Searchlight Sweep | `channel.js` extracted from Kohaku's constant beam, `inCone`, `COS2`, `nearestDir`, `turnToward` | Kohaku's constant beam merged |
| **S3 "Ground"** | Bramble Road, Rising Spikes, Ripple Quake | road-object record, `onRoad`, queued ring starts | S1 |
| **S4 "Links"** | Homecoming Throw, Spirit Tether | leg flip, `_hit` share hook | S1 |

Each batch, on its own feature branch:

1. Sim code + unit data + `CONTRACTS.md` lines + a spec addendum here.
2. `COOP_PROTOCOL` +1 with its comment line in `version.js` (or share the number with whatever release ships with it; never bump twice for one release). Add the new sim id to `KNOWN` (`tests/art/itemArtRuntime.test.js:196`).
3. `hashSim` folds the new state only while non-empty; check an old battle's hash is unchanged.
4. Unit tests per shape (the `tests/sim/rings.test.js` / `vines.test.js` pattern): geometry (who is inside the cone / ring / road span), timing (which step each hit lands), caps and eviction, wave-end cleanup, sell mid-shape.
5. **Determinism**: (a) a unit test that runs the same seed and commands twice, once plain and once inside `withDetMath`, and compares `hashSim` every 60 ticks; (b) a scripted co-op battle using every shape of the batch, added to `e2e/engines.mjs` (V8, JavaScriptCore, SpiderMonkey bit-identical, `--require-all` before ship), including a rejoin from the wave-end checkpoint replayed to a mid-wave tick with the shapes live; (c) `grep` the new sim files for `Math.random`, `Math.sin/cos/atan2/hypot` and `**` (none allowed); (d) the renderer side of the batch reads only sim state and events and uses seeded visual randomness, never `sim.rng`.
6. **DPS parity bench**: `tools/bench.mjs` crowd and boss rows for every touched girl at p0-p2 tiers 3-5, `--compare` against today's baseline; a reworked girl lands within ±5 % per tier unless the owner asks otherwise. Held shapes: confirm tick damage × ticks a second equals the old damage × rate.
7. **Perf**: `tests/sim/perf.test.js` stays under its limits with a board of the batch's girls (add a shapes stress case: 6 copies of each shape, 200 enemies).
8. A plain-shape renderer fallback so the batch can ship before the VFX polish: the sim events drawn with existing pieces (`fx.beam` held for the channel, `fx.ring`, simple sprites). Owner board with screenshots and a reel (`e2e/attack-reel.mjs`), fast-lane review, ship.

### 7.3 Step 3: VFX polish (render only, after VFX M2 and M4)

- Flipbooks from VFX M2: flame loop, vine growth burst, soil crack, petal bloom, spark pop.
- Mesh shapes and ribbon trails from VFX M4: cone, ring, spiral, vine ribbon, spike, thread.
- Per-girl styles in `src/render/attackFx/styles/`, shared drawing in `attackFx/patterns/` (a `stream.js`, `vine.js`, `orbit.js`, `tether.js`).
- Checks per the VFX plan: sim id unchanged (`e2e/attack-fx.mjs` gate), every tier of every touched girl on `previews/attacks.html` at high / medium / low, `tools/vfx/capture.mjs` frame times and quads (on `feature/vfx`), Reduce Motion captures, flash-guard report (`renderer.vfx`) showing no held shape counts as flashes, and the real mid-range phone FPS check.

### 7.4 Optional quick wins (render only, any time)

- Chigusa's existing grab drawn as a vine rising out of the road to the held enemy (sim `vine` event already carries the target and hold time).
- Kinu's pins with petal trails and a bloom at her feet; her heat ring as a real heat shimmer ring.
- Kohaku's constant beam, once it ships, drawn as a held beam with a scrolling core (it needs a held drawing anyway).

These go on the VFX branch and keep the sim id.

---

## 8. Open questions for the owner

1. **Which shapes do you want first?** All ten, or a short list? (Suggested first batch: Blossom Wheel, Pinwheel Stream, Petal Halo: cheapest, mostly reuse.)
2. **Reworks or new girls?** Should these change existing girls (for example Akane gets the flame stream, Chigusa gets real road vines), or go to new girls, or both? A rework changes how a girl players already own feels.
3. **If reworks: whole kit or one path?** For example, Akane's Wildfire path becomes the flame stream while her other paths keep fireballs.
4. **Which girl gets which shape?** §6 is a suggestion list; please mark yes / no / someone else.
5. **How many per update?** One batch (3 shapes) per release, or one shape at a time with a girl each?
6. **Same power or a buff?** Held and 360° shapes can match a girl's current DPS per tier (the rule set for Kohaku), or be a chance to make her stronger.
7. **Kinu:** she already fires true 360° rings and a spinning spiral. Have you seen her in battle? Is the ask partly "make hers look much better"?
8. **Vines:** should vines hold enemies (stop them) or only slow them? Holding is strong on narrow roads.
9. **Before the art lands:** OK to ship a batch with plain effects and polish the look in a later display update, or wait for the full look?
10. **The reference video:** anything specific in it you want matched in feel (speed, size, colour) that this page has not covered?

---

## Addendum (Oct 28-29, 2026): the owner board, proposed defaults, S1 "Wheels" as built, the plan for S2-S4

Written on `feature/attack-shapes`. The owner answered "defaults!" to §8, so A2 states the defaults this branch builds on; each one is still the owner's to change on the board.

### A1. The owner board (§7.1)

- Page: `previews/attack-shapes.html` (`npm run dev`, then `/previews/attack-shapes.html`; `?speed=0.5` for slow motion). Ten loops on one sample road (a U round the girl), stepped at 60 Hz with the sim's own direction table (`src/sim/dirs.js`: the 240 directions, `nearestDir`, `turnToward`), integer step timers and the tick rules of §5. Display-only tooling, not in the game build.
- Phone files: `docs/review/attack-shapes/attack-shapes-board-1.png` (shapes 1-5) and `-2.png` (6-10), one column, each card caught mid-action with its two lines (what it does, which girls could get it); `docs/review/attack-shapes/attack-shapes-reel.mp4` (12 s, all ten loops at real speed). Rebuild them with `node e2e/attack-shapes-board.mjs <dir>`.
- The board's S1 cards show the spec's first ideas (Noa for the halo, a sprinkler on a 0.1 s clock). What S1 became is A3; the board's S2-S4 cards are unchanged.

### A2. Proposed defaults for §8

| # | Question | Default |
|---|---|---|
| 1 | Which shapes first? | **S1 "Wheels"**: Blossom Wheel, Pinwheel Stream, Petal Halo (the cheapest: mostly reuse of Kinu's ring code). Then S2, S3, S4 in that order (A6). |
| 2 | Reworks or new girls? | **Reworks** of girls players already own. New girls can take shapes later, from their own design. |
| 3 | Whole kit or one path? | **One path each**; her other two paths keep today's attack. The shape arrives at **tier 4 or 5** for a behaviour change (the roster's standing rule: transformations only at tiers 4-5, `tests/data/units.test.js`; Kage's at 5, A3) and at tier 3 for an added kit (Hotaru's halo beside her pulse). |
| 4 | Which girl gets which shape? | S1: **Momo** (Encore Toss → Coin Wheel), **Kage** (Storm of Steel → Blade Cyclone), **Hotaru** (Lantern Light → Firefly Halo). S2-S4 as in A6. |
| 5 | How many per update? | **One batch (2-3 shapes) per release**, one `COOP_PROTOCOL` bump each, sharing the number with whatever else ships in that release. |
| 6 | Same power or a buff? | **Same power**: each touched tier lands within about ±5 % of today's DPS on both rulers, the light bench and balance round 5's fully maxed bench (crowd and boss rows; method and numbers in A4), the rule set for Kohaku's beam. |
| 7 | Kinu? | **Leave her kit as it is.** She already has true 360° rings, a spiral and scissors; her look improves with the effects update (§7.4, render only). |
| 8 | Vines: hold or slow? | **Slow.** Bramble Road slows every walker on the vine; only the first walker it reaches is held, briefly, never bosses or flyers, minibosses resist (the hold Chigusa has today). A long hold on narrow roads is too strong. |
| 9 | Ship plain, polish later? | **Yes.** Each batch ships with plain effects (straight shots drawn as the girl's own shots, simple glows and rings) and gets its polished look in a later display update (§7.3). |
| 10 | The owner's reference video | Nothing beyond the spec's shapes is copied. If the owner wants a speed, size or colour matched, they say so on the board. |

### A3. S1 "Wheels" as built

| Girl, path | Tiers | Shape | What the player sees |
|---|---|---|---|
| Momo, Encore Toss | T4 Jackpot, T5 Fortune's Favourite | Blossom Wheel (`behavior: 'wheel'`) | Each toss still throws her coins at her targets, one per projectile (2; 4 at T5), with her pierce (×0.98), and the rest of a 12-coin wheel (16 at T5) flies out with them evenly round, each wheel coin cutting the first enemy it meets (×0.15; ×0.2). T3 keeps her toss. |
| Kage, Storm of Steel | T5 Thousand Shadows | Pinwheel Stream (`behavior: 'spin'`) | Her shuriken pour out of four turning arms, one per arm per throw (×2.02 of her volley, split over the arms); an arm that finds an enemy stays on it until it walks off; against a lone enemy the arms fold into one stream that turns to follow it. T3 "Shuriken Cyclone" and T4 "Blade Rain" keep her throws. |
| Hotaru, Lantern Light | T3 Spirit Bane, T4, T5 | Petal Halo (kit `halo`) | Four fireflies (six, eight) circle her and cut what they touch, beside her pulses (5 % lighter); T4 keeps ×1.25 vs elites, T5 is ×2.4 vs bosses (was 2.5). |

Changes from the spec, and why:

1. **Hotaru, not Noa, has the halo.** Noa's chimes hit for about 1 after armor, and every hit deals at least 1 (`computeHit`). Her halo's cuts alone reached her whole tier-3 DPS, so no halo strength could keep her at parity. Hotaru's hits are big enough for the floor not to matter.
2. **Pinwheel Stream is an attack, not a 0.1 s kit clock.** Kage's Potential (more shuriken, Shadow Tempo, the Shuriken Storm echo), gear tricks and drinks all count attacks. A clock that bypassed her attack loop would quietly drop all of them. One shot per arm per throw keeps them, and her throws are fast enough to read as a stream.
3. **The lone-enemy fold** replaces the spec's "lock tier". A sprinkler gives a lone boss about half her damage (−45 % measured). Folding into one stream keeps single-target parity without a hidden boss multiplier.
4. **The arms stay on an enemy** (`SPIN_LOCK` 0, not 1). With slow-turning arms, a sparse crowd needed a ×2.9 multiplier, which then exploded in a dense one: balance round 5's maxed crowd read ×1.88. Arms that stay on what they find hit about as well in both, so one multiplier fits both rulers.
5. **The Blade Cyclone starts at T5, not T4.** At T4, with 7 throws a volley, no arm count or multiplier fit both rulers: 0.75 on the light bench against 1.33 on round 5. T4 keeps her throw at exact parity.
6. **The wheel keeps her toss coins** (one per projectile at her targets, her pierce), and **the wheel's other coins pierce only one enemy**. Two failures led here. A single aimed lead spoke left her early-game single target at 0.74, because the L25 elite splits and her old toss hit two of the pieces. Wheel coins with her pierce multiplied in dense crowds: ×1.76 on round 5.
7. **Halo cuts carry no statuses, marks, pushes or crits** (`t.haloSpec`, built after her buff extras so aura armor pen counts). Her attack type's own on-hit rules still apply: Hotaru's holy cuts end phasing and silence field casters, like any holy hit. With Noa, status-carrying cuts sent her chime DPS ×10 while the crowd stood stun-locked.
8. **The halo is a small share.** On round 5's dense crowd her pulse (40 targets at T5) does nearly everything, so cutting it ×0.7 for a larger halo read 0.70-0.75 there. Her pulse is now ×0.95 and the halo light.
9. **The shape's own knobs are stated per tier, not multiplied** (`wheel.lead/mul`, `spin.mul/fold`, `halo.mul`), so the data reads as the bench fitted it.

### A4. DPS parity (§7.2 step 6)

Two rulers, both against `origin/main` aa0281de (ratio new / main, crowd and boss rows; untouched paths and girls are bit-identical: the 456-resolution stats hash with the three girls left out reads `8cb286a4` before and after):

- **The light bench** (`tools/bench.mjs`, STRONG preset, partner Aoi): the mean over four configurations (4-5 seed 9, 4-5 seed 3, 2-4, 6-3), plus 4-5 at the early L25 preset.
- **Balance round 5's bench** (`tools/balance/r5Bench.mjs` on `feature/balance-r5`): fully maxed (L85, ★5, 10 gates, P6, UR gear, UR Resonance on), Umeko and Midori beside her, 4-5, seeds 9/1/2. Its crowd is far denser.

| Girl, tier | Light: mean crowd / boss | Light: one stage, crowd range | Light: L25 crowd / boss | Round 5: crowd / boss / walking boss |
|---|---|---|---|---|
| Momo T4 | 1.06 / 0.98 | 1.03-1.11 | 1.04 / 0.98 | 0.97 / 0.98 / 0.98 |
| Momo T5 | 1.05 / 0.99 | 1.03-1.08 | 1.04 / 0.98 | 0.97 / 0.98 / 0.98 |
| Kage T5 | 0.96 / 1.00 | 0.92-1.00 | 0.80 / 0.95 | 1.04 / 1.04 / 1.06 |
| Hotaru T3 | 1.05 / 0.97 | 0.99-1.11 | 1.10 / 0.98 | 0.95 / 0.96 / 0.95 |
| Hotaru T4 | 1.04 / 0.97 | 1.00-1.09 | 1.03 / 0.98 | 0.97 / 0.97 / 0.97 |
| Hotaru T5 | 1.05 / 0.98 | 1.01-1.08 | 1.02 / 1.01 | 0.99 / 0.97 / 0.95 |

(Momo T3, Kage T3 and T4 are unchanged: 1.00 everywhere.) Every touched tier is within about ±5-6 % on both rulers' means. One stage alone swings about ±10 % on the crowd (the shape's geometry: strong where the road wraps round her). The one larger miss is Kage T5's early-preset crowd (0.80). The coordinator gave the early crowd spread to balance round 5 (Oct 29), which re-measures and re-sizes on top of S1. Momo's early single target, 0.74 before the toss coins came back, is 0.98.

The panel DPS (`towerStats`, `projectedDps`) follows the shapes (`wheels.js` `shapeDps`): on one target, her toss coins and the folded stream; the halo's cuts are added as one enemy on its ring sees them.

### A5. Determinism (§7.2 step 5)

- (a) `tests/sim/wheels.test.js`: each S1 girl alone and all three together on 4-5, plain `Math` against `withDetMath`, `hashSim` every 60 ticks equal; twice the same battle identical.
- (b) `e2e/engines/scriptedBattle.js` `runShapesBattle` (SHAPES_START, 2-4 Hard): Momo's wheel and Kage's stream (host), Hotaru's halo and a second Kage (guest), all at tier 5, two Lockstep clients to the end. A third client rebuilds the battle from the wave-3 checkpoint and the log to the first tick 5 s into a wave with a spin index and a halo memory live (a mid-wave rejoin), and must land on the run's hash and snapshot. It is compared across engines by `e2e/engines.mjs` and pinned in `tests/online/engines.test.js`.
- (c) The new sim files (`wheels.js`, `dirs.js`, `shapes.js`) are checked by a test: no `Math.random`, no runtime `sin`/`cos`/`atan2`/`hypot`/…, no `**`. The table is built once with `DET_MATH`. Aiming is `nearestDir` and `turnToward`. Facing is k × 2π / 240.
- (d) The renderer reads only sim state: straight shots as projectiles, halo pieces from `haloPos` at the sim's step. It uses no rng.
- State: `t.spinK` (integer) and `t.haloHits` (integer pairs) end at the wave clear; `hashSim` folds them only while present.
- Sim id: `PENDING_BUMP` in `tests/art/itemArtRuntime.test.js`. **No `COOP_PROTOCOL` bump on the branch**; the release that ships S1 takes the next free number.
- Perf: `tests/sim/perf.test.js` "attack shapes": 6 copies of each S1 girl at tier 5 and 200 enemies under the same step limit (2 ms locally), straight shots within their cap (400).

### A6. Plan for S2-S4

The estimates are working time for one session, including tests, the bench fit, the engines battle, an independent review and an owner board with screenshots.

| Batch | Shapes, girls (default) | Builds | Depends on | Estimate |
|---|---|---|---|---|
| **S2 "Held"** | Hearth Stream on **Akane's Wildfire** T4-5 (fire; frost / poison / water variants left as data for later), Searchlight Sweep on **Umeko's Lighthouse** T4-5 | `channel.js` extracted from Kohaku's constant beam (v0.1.59) with Kohaku moved onto it, unchanged in hash (her beam is the template: lock, integer ticks, ramp by time on target, grace, on-lock effects); `inCone` + `COS2`; `nearSegment`; a held-beam / cone plain drawing | Kohaku's constant beam on `main` (v0.1.59) | 1.5 days: 0.5 for the extraction with Kohaku's hash pinned, 0.5 per shape, 0.5 for parity, engines and review |
| **S3 "Ground"** | Bramble Road as **Chigusa's** vine kit rework (slow, not hold: A2 #8), Rising Spikes on **Yuki's** Icicle Lance path T4-5, Ripple Quake on **Kanna** (hero: one rank of her level track) | the road-object record + `onRoad` (Marumi's shared-stretch rule), queued ring starts, a ribbon-free plain vine (a green road band) | S1 (dirs, shapes) | 2 days: Chigusa's kit rework is the largest single change (her vines, beds and Potential stay compatible) |
| **S4 "Links"** | Homecoming Throw on **Fuu's** Returning Gale T4-5, Spirit Tether on **Ena's** Red Threads T4-5 | leg flip on straight shots; the `_hit` share hook behind `sim._tetherOn` with a re-entrancy flag and a per-step budget | S1 | 1.5-2 days: the share hook touches every hit, so it gets its own perf and determinism pass |

Each batch: a sim id change behind `PENDING_BUMP`, one `COOP_PROTOCOL` bump at its release, the parity method of A4, a scripted engines battle with a mid-wave rejoin, and the VFX polish afterwards on the effects track (flipbooks M2, mesh shapes M4).

### A7. S2 "Held" as built

Written on `feature/attack-held` (S1 merged with Kohaku & Tsubaki's long beam).

| Girl, path | Tiers | Shape | What the player sees |
|---|---|---|---|
| Akane, Wildfire | T4 Phoenix Feather, T5 Inferno Queen | Hearth Stream (`behavior: 'stream'`) | A held cone of fire (half-angle 54°, 67.5° at T5; her range) that swings toward her target and burns the nearest 35 (56) enemies in it every 0.1 s. Her burn rides on every tick; it reaches flyers. T3 keeps her fireballs. |
| Umeko, Lighthouse | T4 Moonlit Beacon, T5 Sea of Lanterns | Searchlight Sweep (`behavior: 'sweep'`) | Her pulse becomes a beam of light of her range that swings ±45° (±60° at T5) round her target; what it crosses is struck once a pass and revealed (her reveal, and at T5 her silence, ride on the hits). Her aura is unchanged. T3 keeps her pulse. |

Built as the shared pieces: `src/sim/channel.js` (the held channel), `src/sim/held.js` (both shapes), `inCone` and
`nearSegment` in `shapes.js`, `COS2` in `dirs.js`, a plain renderer (`src/render/attackFx/patterns/held.js`). Contracts:
`CONTRACTS.md` "Attack shapes S2".

Changes from the spec, and why:

1. **Kohaku stays in `duo.js`.** `channel.js` is modelled on her beam (lock, integer ticks, a share of one hit per tick,
   ramp by time on target, grace, on-lock cadence), but she does not run on it. Her beams are several holds re-picked
   from her targets every tick, with no turn and no grace, and her tick share rounds to whole flash intervals
   (`beamTicks`), where the channel's share is exact (`rate × CH_TICK × STEP`). Moving her would change who she hits and
   when, so her tests and the duo engines pin would move. `duo.js` is untouched (no duo number changed); the duo pins pass.
2. **The channel keeps her attack loop.** Her counted attacks still run at her rate (S1's lesson, A3 #2): each one re-picks
   her enemy by target mode and sets what the channel carries until her next one (a rhythm attack's spec, a gear trick's
   harder copy), so Potential rhythms, gear tricks and drinks keep counting attacks. A rhythm's echo is one flare of the
   shape. Between attacks the channel ticks on its own clock, after her attack loop in `updateTower`.
3. **The cone is wide and its cap high.** A fireball's blast (radius 1.5, 2.0 at T5) on the light bench's dense crowd (a
   walker every 0.1 s) burns 30-40 enemies at once; a narrow cone of 6 read 0.45. A 54° / 67.5° half-angle and 35 / 56
   victims a tick fit both rulers (perf: 0.44 ms a step with 12 held girls and 200 enemies).
4. **The tip falloff is × 0.85, not × 0.7.** At × 0.7 the walking boss read 0.82 (it meets her at the edge of her range).
5. **The sweep's re-hit gap is one pass**, not a step count: each enemy inside the arc is crossed once a pass, so a hit
   carries a pass's share (`rate × pass × STEP`), and a big body under the beam for several tests is struck once. A pass
   strikes at most her maxTargets (her pulse's 6), so a dense crowd takes what her pulse gave it. With a step gap the light
   crowd read × 5 and a large held boss × 2.
6. **The sweep swings fast** (2 table steps a step: a pass in 0.5 s, 0.67 s at T5), so each hit is a small share and a boss
   walking through her range is struck about as often as her pulse struck it.
7. **Variants are data only**: `STREAM_KINDS` (`held.js`) lists fire (in use), frost, poison and water; nothing reads the
   latter three's mechanics yet.
8. **Gear Pierce adds victims**, as it added pulse hits: each counted attack takes the pulse's carry (2 more per 100 %, at
   most PULSE_MAX_EXTRA) into `t.ch.px`, added to a stream's tick cap and a sweep's pass cap. Follow-Through's +100 % rides
   on that carry. Inferno Queen's `splash: 0.5` is gone (the stream has no blast); the drawer hides a held girl's Splash row
   and shows her target-mode chips (`wheel` gets them too; `spin` takes the first enemy its arms find, so it has none).
9. **The sweep reveals only inside its arc** (±45°, ±60° at T5, round her enemy), where her pulse revealed up to 6 veiled
   enemies anywhere in her range.

**DPS parity** (method of A4; ratio new / today, Akane and Umeko are untouched by S1 and the long beam, so the baseline is
this branch before S2; T3 and the other paths are 1.00 everywhere; the 456-resolution stats hash with the two girls left
out reads `4158a051` before and after):

| Girl, tier | Light: mean crowd / boss | Light: one stage, crowd range | Light: L25 crowd / boss | Round 5: crowd / boss / walking boss |
|---|---|---|---|---|
| Akane T4 | 0.97 / 1.02 | 0.93-1.03 | 1.12 / 0.99 | 1.05 / 1.01 / 0.96 |
| Akane T5 | 0.95 / 1.03 | 0.93-0.99 | 1.04 / 1.02 | 1.03 / 1.04 / 0.94 |
| Umeko T4 | 1.02 / 0.91 | 0.99-1.04 | 1.04 / 0.90 | 1.02 / 1.05 / 1.13 |
| Umeko T5 | 0.98 / 0.91 | 0.94-1.02 | 1.01 / 0.84 | 0.98 / 1.07 / 1.04 |

Round 5 in DPS, today → now: Akane T4 crowd 219k → 231k, boss 3201 → 3220, walking 1261 → 1214; T5 660k → 681k, 9654 →
10064, 3994 → 3753. Umeko T4 crowd 1402 → 1433, boss 219 → 229, walking 47 → 53; T5 1359 → 1330, 219 → 234, 47 → 49.
The misses: Akane T4's early crowd (1.12: the stream reaches more of a sparse early crowd than a fireball), and Umeko's
boss rows, which disagree by ruler (the light bench's 0.91 is about 4 DPS of 1-damage floors, the L25 row half a DPS:
a few hits; round 5 reads 1.05-1.13). Umeko's own DPS is a support's; her aura and reveal carry her, and they are unchanged.

The coordinator's call (Oct 29): Umeko's boss rows are judged on round 5 (the light bench's boss row is 1-damage floors,
not a signal). Akane T4's early crowd at 1.12 and the wide cone are accepted (direction: no caps, no nerfs). The review's
maxed hit bench (`bench.mjs --hit`, maxed preset) reads Akane crowd 1.14 (T4) / 1.17 (T5), boss 0.97 / 0.97: the late-game
crowd gain is accepted under the same direction.

The partner's DPS moved on the light bench (Akane T5 boss: Aoi 19.55 → 16.92; Umeko T4 crowd 33.82 → 31.89) because the
held ticks roll crits ten times a second from the shared `sim.rng`, so Aoi's crit rolls fall on other draws: with the
ticks' crit rolls switched off for a test Aoi reads 19.55 and 33.27 again. Noise of the shared stream, not a buff change.

**Determinism** (§7.2 step 5):

- (a) `tests/sim/held.test.js`: each girl alone and both on 4-5 at Potential 6, plain `Math` against `withDetMath`,
  `hashSim` every 60 ticks equal; twice the same battle identical.
- (b) `e2e/engines/scriptedBattle.js` `runHeldBattle` (HELD_START, 2-4 Hard): two Akanes and two Umekos to their held
  tiers, two Lockstep clients to the end; a third client rebuilds from the wave-3 checkpoint and the log to the first tick
  5 s into a wave with a stream and a sweep open (a mid-wave rejoin) and must land on the run's hash and snapshot. Compared
  across engines by `e2e/engines.mjs`, pinned in `tests/online/engines.test.js`.
- (c) The new sim files (`channel.js`, `held.js`, `shapes.js`, `dirs.js`) are checked by a test: no `Math.random`, no
  runtime trig or `hypot`, no `**`. COS2 is built once with `DET_MATH`; aiming is `nearestDir` and `turnToward`. No rng of
  their own: Akane's burn has no chance; crits still roll in `sim._hit`; capped victims go by (d², uid).
- (d) The renderer reads only `t.ch` and her stats, and uses no rng.
- State: `t.ch` (integers, its memory integer pairs) ends at the wave clear, on a sabotage or a Move, and with her sale;
  `hashSim` folds it only while open; battle saves classify it `calm`.
- Sim id: `PENDING_BUMP` in `tests/art/itemArtRuntime.test.js`. **No `COOP_PROTOCOL` bump on the branch.**
- Perf: `tests/sim/perf.test.js` "held attack shapes": 6 of each girl at tier 5 and 200 enemies, 0.44 ms a step locally
  (limit 2 ms).

### A8. S3 "Ground" as built

Written on `feature/attack-ground` (on S2 `feature/attack-held` 338211c8).

| Girl, path | Tiers | Shape | What the player sees |
|---|---|---|---|
| Chigusa, her whole vine kit | base, Greenhouse T3-5 | Bramble Road (`vine`, kit) | Every 6 s (4, 3, 2.5 s on Greenhouse) a vine bursts up on the road in her range and grows along it toward the walkers (2 tiles, 3 from Strangler Vine, 4 at Forest Corridor; 4 tiles a second). Walkers on it are slowed 20 % (35 % at T5); the first it reaches is held (1 s, 2 s from T3). From Strangler Vine it lashes once a second; the lash is shared by the walkers on it. Thorn Hedge keeps two vines standing. It stands 3 s (4 s from T3), then withers. |
| Yuki, Frostbite (her Icicle Lance path) | T4 Shatter Point, T5 Diamond Dust | Rising Spikes (`behavior: 'spikes'`) | Each attack a row of six ice spikes (eight at T5) bursts up along the road one after another, the first under her enemy and the others half a tile apart up the road into the walkers behind it. Her enemy takes her whole hit, every other walker on the row × 0.46 (× 0.36), each once; her Brittle and armour crack ride on every strike. A flyer still gets her icicle. T3 keeps her icicle. |
| Kanna (hero) | Lv 24 Hundred Demons' Parade (and Lv 25) | Ripple Quake (`quake`, on her strike) | Every strike also sends two rings of force rolling out from her across the ground to her reach, 0.2 s apart; each ring strikes every walker it crosses once, rolling past the enemy she struck. |

Built as the shared pieces: the road-object record (`t.vines`, `t.spikeRows`, `t.quakes`: integer step timers, a per-object
re-hit list, per-girl and per-sim caps, oldest first), `onRoad` (the 1-D path-distance test with Marumi's shared-stretch rule:
another path counts within `ROAD_SHARED` of the stretch, running the same way) and `inBand` in `shapes.js`, `dirAngle` in
`dirs.js` (her facing without `atan2`), queued ring starts (`wait`), and a ribbon-free plain renderer
(`src/render/groundShapes.js`: a green road band of ground discs, ice stars on pale discs, an earth ring). Contracts:
`CONTRACTS.md` "Attack shapes S3".

Changes from the spec, and why:

1. **A lash is shared.** The spec's "hits every walker on it" with her old vine damage read ×8 to ×53 on the light bench's
   crowd: a 3-tile vine on a dense road holds 20-30 walkers, where her old vine damaged the one it held. One lash of
   `dps × lash` is now split evenly over the walkers it strikes (a share of one hit each, so flat armour and the floor scale
   with it, as the held shapes do): a lone walker takes it all, a crowd what one walker took. That keeps both rows.
2. **Vines never touch bosses.** No slow, no hold, no lash. Her vine never damaged a boss (it only damaged what it held, and
   bosses were never held), so a lash on a boss would add a damage source the boss rows never had (at Strangler Vine her
   old 10 a second is about as much as her seeds do to the light bench's boss). Minibosses are lashed and resist the hold.
3. **Vines stand on while she is sabotaged** (road objects, like Azami's strips); she roots no new one. Her thorn beds and
   Bloom Rush keep their old pause. A sold girl's vines go with her.
4. **The vine numbers are stated per tier**: Strangler Vine 6 a second (was 10 while holding), Forest Corridor 16 (was 30), a
   vine standing 4 s instead of a 2 s hold. Potential keeps every key it had (`vine.hold`, `vine.every`, `vine.bedDmg`): Deep
   Roots and Evergreen still lengthen the hold, Quick Sprouts and Evergreen still bring the vine sooner. Only the hold's own
   damage is gone (the lash replaces it), so Deep Roots no longer adds a damage tick.
5. **The vine timer is an integer of steps** (`t.vineCd`, was seconds); `t.vineHold` is gone (a vine holds once, by status).
6. **Rising Spikes run along the road**, the spec's second form (from the road point under her enemy, up the road), not the
   straight line toward her enemy. The line crossed the road at an angle and hit fewer walkers than her blast in a dense crowd
   and more in a sparse one (light 1.06 against round 5's 1.88 at the same size); along the road its reach scales with the road
   like her blast's. A row strikes each enemy once (one hit list a row), so a lone enemy takes one hit an attack, as from her
   icicle.
7. **A long, light row with a full hit on her enemy.** Her enemy takes her whole hit (a boss's rows stay exact), the other
   walkers on the row × `spike.mul`. Two full spikes fit the light bench (1.00) but read ×1.98 / ×2.32 on round 5's crowd, which
   piles up never-dying, slowed, frozen, Brittle walkers at the head of the road in her reach: her icicle burst where it met the
   pile (about 10 walkers within its splash), a spike rises under her enemy at the pile's head (about 46). They also left
   fewer walkers Brittle on the light crowd than her blast did, and her partner's DPS fell 11-18 % there. Six spikes at × 0.46
   (eight at × 0.36) put a lighter strike on more walkers: both rulers read 1.0, and the partner gains a little (her Brittle
   reaches more of the crowd).
8. **A flyer gets her icicle** (her projectile volley, with her splash): spikes never reach flyers, and she keeps her
   anti-air. Gear Pierce adds spikes (her shot's carry); Follow-Through's +100 % Pierce rides on that carry; its wider blast
   reaches only her icicle at a flyer (the volley's splash still widens, as before), never the row, which has no blast.
   The drawer's Pierce row counts the spikes (drawerView gearPierce: `spikes`, and S1's `wheel` and `spin`, whose shots
   take the same carry).
9. **Ripple Quake is Kanna's level 24 entry on top of her splash**, and its rings are **clean hits** (her statuses, marks and
   pushes stay on her strike and splash). Replacing her +0.3 splash with rings, or rings that carried her slow and shred to
   every walker in her reach, read ×1.2-1.3 on round 5's crowd while the light bench sat at 1.0-1.1: crowd control laid on
   everyone in reach piles a never-dying crowd up in her reach. Clean rings at × 0.03 / × 0.015 of her hit fit both rulers.
   They roll past the enemy she struck (her focused strike is its own hit), so her boss rows are exact. No last-ring stagger
   (`quake.status` is empty): a stun on every walker in reach is the same pile-up.
10. **Own caps, not the shared road-object caps.** Vines (`vine.max`, VINES_PER_GIRL 4, VINES_PER_SIM 48) and spike rows
   (SPIKE_ROWS_PER_GIRL 8, SPIKE_ROWS_PER_SIM 96) and quake rings (8 / 64) cap themselves, her oldest first, instead of
   ROAD_OBJECTS_PER_PLAYER / _SIM (Azami's strips): a vine or a row lives a few seconds and is no trap, so it must never
   evict a strip, nor a strip a vine.
11. **Spike i rises at age 1 + i × delay** (the first one step after the attack: road objects tick before her attack loop),
   and a row lives SPIKE_UP steps past its last spike.
12. **A vine never roots on a spot already under one of hers** (its full length), so Thorn Hedge's second vine covers a new
   stretch. A vine's hold goes to the lead walker on it that is not held already (an Overgrowth hold is never spent on), and
   never to a flyer, grounded or not (vines skip every flyer, as her old vine did).
13. **No Forest Road capstone that leaves the vine for the wave** and no armour-shredding thorns; Forest Corridor is a longer,
   slower vine. Both are data for later.

**DPS parity** (method of A4; ratio new / today; baseline `feature/attack-held` 338211c8; untouched paths and girls are
bit-identical: the 456-resolution stats hash with Yuki left out reads `05819da7` before and after; Chigusa and Kanna are not in
it). Kanna is a hero, which neither bench places: a copy of the light bench's harness and of round 5's maxed harness with her
placed as the hero at a fixed level (her XP and Mastery held there; partner Aoi, or Umeko and Midori fully maxed), the same
stages, seeds, streams and targets.

| Girl, tier | Light: mean crowd / boss | Light: one stage, crowd range | Light: L25 crowd / boss | Round 5: crowd / boss / walking boss |
|---|---|---|---|---|
| Chigusa Growth T3 / T4 / T5 | 0.98 / 1.00, 0.99 / 1.00, 0.99 / 1.00 | 0.96-1.02 | 0.98-0.97 / 1.00 | 0.99-1.01 / 1.00 / 1.00 |
| Chigusa Greenhouse T3 | 0.98 / 1.00 | 0.95-1.00 | 1.01 / 1.21 | 1.00 / 1.00 / 1.00 |
| Chigusa Greenhouse T4 | 1.02 / 1.00 | 0.98-1.05 | 1.02 / 1.52 | 1.00 / 1.00 / 1.00 |
| Chigusa Greenhouse T5 | 1.00 / 1.00 | 0.98-1.03 | 1.00 / 0.82 | 0.97 / 1.00 / 1.00 |
| Chigusa Harvest T3-5 | 1.00 / 1.00 | 0.99-1.02 | 0.98 / 1.00 | 1.00 / 1.00 / 1.00 |
| Yuki Frostbite T4 | 1.00 / 1.00 | 0.99-1.01 | 1.03 / 1.00 | 1.06 / 0.99 / 0.99 |
| Yuki Frostbite T5 | 0.99 / 1.04 | 0.96-1.01 | 1.01 / 1.06 | 1.03 / 1.00 / 1.01 |
| Kanna Lv 24 | 1.03 / 1.00 | 0.99-1.07 | 1.06 / 1.00 | 1.01 / 1.00 / 1.00 |
| Kanna Lv 25 | 1.04 / 1.00 | 0.94-1.11 | 1.17 / 1.00 | 1.01 / 1.00 / 1.00 |

(Yuki T3 and her other paths are 1.00 everywhere.) The misses, reported and not cut (the coordinator's direction for this round:
no nerfs):

- **Yuki's maxed hit bench** (`bench.mjs --hit`, maxed preset, a third ruler the S2 review used): 0.87 at T4, 0.82 at T5 (her
  partner-less crowd there; both rulers above read 1.0). Two full spikes read 1.23 there and ×2 on round 5.
- **Chigusa Greenhouse's early boss row (L25 preset, a lone miniboss): 1.21 / 1.52 / 0.82.** Her old vine damaged a miniboss only
  while it held it, and minibosses halve the hold; a lash does not care. One shared-lash knob cannot fit a lone miniboss and the
  crowd; the crowd and both round-5 rows are on target.
- **Kanna's early crowd (L25 preset): 1.06 / 1.17**, her rings on a sparse early crowd; the light and round-5 crowds are on target.

The partner's DPS moves where a slow or a spike row changes the crowd: Aoi beside Yuki's spike rows gains on the crowd (mean
1.06 at T4, 1.03 at T5; 1.14 / 1.20 at L25: her Brittle reaches more walkers); beside Chigusa's vines, 0.85-1.07 by stage on the
crowd (the slow moves the stream), 1.00 on the boss. **Chigusa Greenhouse's partner on the crowd reads 0.85-0.88** on the
light bench's 4-5 seed 9 (the review measured 0.875 at T4 and 0.851 at T5): her vines slow the stream where it enters her
reach, so fewer walkers stand in the partner's. Her own rows are on target; reported, not tuned.

**Determinism** (§7.2 step 5):

- (a) `tests/sim/ground.test.js`: Yuki, Chigusa and Kanna each alone and all three on 4-5 at Potential 6, plain `Math` against
  `withDetMath`, `hashSim` every 60 ticks equal, each shape live; twice the same battle identical.
- (b) `e2e/engines/scriptedBattle.js` `runGroundBattle` (GROUND_START, 2-4 Hard): two Chigusas to Forest Corridor and two Yukis
  to Diamond Dust, and the host's Kanna bought past Lv 24 and moved beside the road near the spawn (60 lashes, 943 spike and
  110 ring hits), two Lockstep clients to the end; a third client rebuilds from the
  wave-3 checkpoint and the log to the first tick 5 s into a wave with a vine, a spike row and a quake ring live (a mid-wave
  rejoin) and must land on the run's hash and snapshot. Compared across engines by `e2e/engines.mjs`, pinned in
  `tests/online/engines.test.js`.
- (c) The new sim files (`ground.js`, `vines.js`, `shapes.js`, `dirs.js`) are checked by a test: no `Math.random`, no runtime trig
  or `hypot`, no `**`. Road points come from `pointAt`, her facing from `nearestDir` and `dirAngle`. No rng of their own (crits
  still roll in `sim._hit`; the slow and hold have no chance); victims in the grid's order, a capped lash lead first by
  (remaining, uid).
- (d) The renderer reads only `t.vines`, `t.spikeRows`, `t.quakes` and her stats, and uses no rng.
- State: `t.vines`, `t.spikeRows`, `t.quakes` (integers but a vine's root / length and a ring's radius, which `hashSim` folds in
  1/256 tiles or by their integer step counts) end at the wave clear; `hashSim` folds each only while non-empty (and her vine
  timer with her vines); battle saves classify them `calm`.
- Sim id: `PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` reads `b4f7f3f80255` (S1, the long beam, S2 and S3). **No
  `COOP_PROTOCOL` bump on the branch.**
- Perf: `tests/sim/perf.test.js` "ground attack shapes": 6 Chigusas at Forest Corridor, 6 Yukis at Diamond Dust and Kanna at
  Lv 24 with 200 enemies, 0.30-0.40 ms a step locally (limit 2 ms).

### A9. S4 "Links" as built

Written on `feature/attack-links` (on S3 `feature/attack-ground` 8997a16e).

| Girl, path | Tiers | Shape | What the player sees |
|---|---|---|---|
| Fuu, Returning Gale | T4 Typhoon Fans, T5 Heaven's Gate Wind | Homecoming Throw (`behavior: 'return'`) | Her gusts become fans, one per gust (6; 8 at T5), flung at her targets. Each flies at its target and on to the edge of her range, turns, comes back through its target and lands in her hand. Half her hit on the way out (with her push and slow), half again on the way home. T3 keeps her gusts. |
| Ena, Shared Fate | T4 Red Threads, T5 Threads of Destiny | Spirit Tether (kit `tether`, beside her cards) | Every deal ties her target to the 2 enemies nearest it, one after another (3 at T5), for 3 s (4 s). A hit from any girl on a tied enemy is shared: each other tied enemy takes 20 % of it (25 %). Her own hits are split among them, not added. At T5 the threads pull tight as they fade, and the enemies ahead of her target are dragged back toward it. |

Built as the shared pieces: the leg flip on a projectile record (`retFlip`, `retSteer`, `retCut` in projectileStep) and the `_hit`
share hook (`Sim._hit` behind `sim._tetherOn`, the re-entrancy flag `sim._sharing`, the per-step budget TETHER_SHARES_PER_STEP), in
`src/sim/links.js`. The plain renderer is `src/render/linkShapes.js`: threads of alpha beads with a fixed sag, and thin additive
knots of 0.14 tiles. Fans are drawn as her own projectiles. Contracts: `CONTRACTS.md` "Attack shapes S4".

Changes from the spec, and why:

1. **A fan homes like her gust.** The spec's fan is a straight line out and an exact reversal back. Her pushes move the enemies
   it cuts off that line, so the way home misses them. Measured with straight fans, the variants read 0.61-1.85 on round 5's crowd
   and 0.72-1.04 on the early lone-walker row. The final variants differed only in which cuts pushed. Now the out leg flies at its
   target as her gust did, and turns at her range (later only while its target is still uncut, up to her shot's own reach). The way
   home passes through its target again while that enemy stands, then flies to her hand. The leg flip is still a flip on the same
   projectile record: a fresh hit list and a fresh count.
2. **One fan per gust, half her hit each way** (`ret.per` 1, `ret.mul` 0.5). The spec had half as many fans at a whole hit. The out
   leg is her gust in full (her push, slow and statuses, at the same moment her gust landed them). The way home is a clean cut:
   damage and crits only, the rule of Kanna's quake rings (A8 #9). With her statuses on both legs, round 5's crowd read 0.66 / 1.25:
   her extra slows reshaped its never-dying pile. A cut carries `share: 0.5`, so flat armour and the damage floor halve with it. Two
   half cuts paying full armour read 0.93 on the dragon.
3. **No "piercing everything".** Each leg cuts as many enemies as her shot pierces (her pierce and gear Pierce, as her gusts did).
   The light tail knobs (`ret.pierce` more cuts at `ret.cut`) exist but are 0. Even a 0.04 tail read 1.08 on the light crowd, and any
   extra crowd cut is a buff on both rulers.
4. **She keeps her attack rate.** A throw never waits for the fans in the air, and the catch does not reset her cooldown. That
   follows A3 #2: her Potential, gear tricks and drinks count attacks. Resetting at the catch would roughly triple her throws, since
   a round trip takes about 0.5 s against her 1.4 s cooldown.
5. **Her Turbine Kick stays her gust volley.** This is her Potential rhythm with a blast (P4 / P6). Fans carry no blast. Without
   the volley, round 5's crowd read 0.15-0.20, because her kick blasts are most of her fully maxed crowd damage.
6. **No V, curve or ensnare tier.** The out leg carries her T3 slow. The other tiers are data for later.
7. **Her own hits are split, not added.** Her enemy keeps 1 − n × share of her hit, where n counts the other tied enemies the share
   reaches. Each of those takes the share. Other girls' hits are added to. With added shares of her own cards, her crowd would gain
   n × share (+40 % at T4, +75 % at T5) while her boss row stayed the same. The split keeps both rows exact. The tether's value is
   echoing the other girls' hits (see the partner note below).
8. **A share is a clean copy of the hit.** It keeps the hitter's type chart and her tier and air multipliers, scales flat armour and
   the floor by the share, and has no statuses, marks or pushes. It is critical when the hit was, and rolls nothing itself. It is
   credited to the girl who hit (and to her drone, if one hit). Burns, poison and hexes are not `_hit` and never share. Shares ignore
   veils and air but not tunnels or phasing. Before the crit carry (and before her split counted only the members a share reaches), her round 5 crowd read 0.82 / 0.74.
9. **The budget drops; it does not queue.** Past 256 shares in a step the rest are dropped. A share is a slice of a hit that
   already landed, and a queue would have to keep specs. The stress board peaks at 72 shares a step.
10. **One group per counted attack**, tied to her lead target, not one per card. A target already tied in her own group is held
   again for the full time. A lone enemy (nothing within reach) gets no group.
11. **The pull is T5 only**, and only for walkers ahead of her target on its road (the gather rule: push lock, never minibosses or
   bosses). Groups stay through her sabotage or a Move, since they are threads on enemies. Her sale ends them, and the wave clear
   ends them without a pull.

**DPS parity** (method of A4; ratio new / today; baseline `feature/attack-ground` 8997a16e). Untouched girls are bit-identical: a
2,368-resolution stats hash over every other unit (8 tier sets, 4 hero levels, 2 account profiles) reads `89d230a5` before and
after. T3 and the other paths are 1.00 everywhere.

| Girl, tier | Light: mean crowd / boss | Light: one stage, crowd range | Light: L25 crowd / boss | Round 5: crowd / boss / walking boss | Maxed hit bench: crowd / boss |
|---|---|---|---|---|---|
| Fuu Returning Gale T4 | 1.00 / 1.00 | 0.99-1.03 | 1.00 / 1.00 | 1.00 / 1.00 / 1.01 | 1.00 / 1.00 |
| Fuu Returning Gale T5 | 1.00 / 0.99 | 0.99-1.00 | 1.00 / 1.00 | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 |
| Ena Shared Fate T4 | 1.00 / 1.00 | 0.99-1.00 | 0.99 / 1.00 | 1.00 / 1.00 / 1.00 | 0.99 / 1.00 |
| Ena Shared Fate T5 | 1.00 / 1.00 | 0.99-1.00 | 0.98 / 1.00 | 1.00 / 1.00 / 1.00 | 0.99 / 1.00 |

Round 5 in DPS, today → now: Fuu T4 crowd 155,798 → 155,871, boss 20,583 → 20,611, walking 10,768 → 10,843; T5 261,463 → 261,715,
97,488 → 97,874, 55,879 → 55,614. Ena T4 crowd 52,029 → 51,845, boss 52,589 → 52,589, walking 19,165 → 19,165; T5 291,063 →
292,387, 296,100 → 296,100, 226,699 → 226,699.

**The partner.** Aoi beside Ena gains on the light crowd, because the threads echo her hits: T4 1.00-1.20 by stage (mean 1.06),
T5 1.00-1.43 (mean 1.12; 6-3 is the high one). The boss row is 1.00 (a lone boss is never tied). This is new team power beside
Ena's own parity, like her Brittle, and it is reported here, not tuned. Aoi beside Fuu moves by stage on the light bench: crowd
0.93-1.07, boss 0.91-1.14. That is the shared `sim.rng`: a fan rolls a crit on each of two cuts, where a gust rolled once, so Aoi's
rolls fall on other draws. With Fuu's rolls moved to a private stream for a test, Aoi reads 1.00 on every boss row (A7 saw the same
with the held ticks).

**Determinism** (§7.2 step 5):

- (a) `tests/sim/links.test.js`: Fuu alone, Ena with Aoi, and all three on 4-5 at Potential 6, with a crowd added. Plain `Math`
  against `withDetMath`, `hashSim` every 60 ticks equal, fans, groups and shares all live; twice the same battle is identical.
  The unit cases cover the leg flip, cuts per leg, the clean way home, the Turbine Kick volley, caps, the wave clear, sabotage and
  sale for fans. For the tether they cover the tie walk (d², ties by uid), shares (20 %, credited to the hitter, no share of a
  share), her split, the budget, expiry and the T5 pull, a stale tie with the hook off, caps, the wave clear, her sale and hashSim.
- (b) `e2e/engines/scriptedBattle.js` `runLinksBattle` (LINKS_START, 2-4 Hard): two Fuus and two Enas, the host's at tier 5 and the
  guest's at tier 4 (one girl per path at the final tier). The run had 1,964 fan cuts, 1,112 catches, 55 groups and 1,548 shares,
  with two Lockstep clients to the end. A third client rebuilds from the wave-3 checkpoint and the log to the first tick 5 s into a
  wave with a fan in the air and a group alive (a mid-wave rejoin), and must land on the run's hash and snapshot. Compared across
  engines by `e2e/engines.mjs`, pinned in `tests/online/engines.test.js`.
- (c) `links.js` is checked by a test: no `Math.random`, no runtime trig or `hypot`, no `**`, no `Map` / `Set`. Groups live in an
  array in creation order, and members in tie order. A fan flies with the projectile's own homing step, the same code as every
  targeted shot, which co-op runs inside `withDetMath`. Her facing comes from `nearestDir` / `dirAngle`. Shares roll no rng; crits
  still roll in `sim._hit` for the hit itself.
- (d) The renderer reads only `sim.tethers` and uses no rng. Fans are her projectile records.
- The hook: a shared hit never shares again (`sim._sharing`, also up for a curse burst set off by a share's kill). The order is the
  group's member array. With no group alive, the hit path adds one compare (`this._tetherOn !== 0`). A `_hit` microbench (2 million
  plain hits, best of 7, six interleaved runs per tree) reads a median of 114.8 ns before and 116 ns after, within the run-to-run
  spread of 108-122 ns. The existing perf cases read the same before and after, within this shared machine's noise (single runs
  spread 0.24-0.48 ms): best of three, before → after, 0.249 → 0.240 (base board), 0.265 → 0.312 (S1), 0.355 → 0.345 (S2),
  0.292 → 0.282 (S3), 0.200 → 0.198 ms a step (long beam).
- State: `sim.tethers` and `e.tie` end at the wave clear, and fans end with the straight shots. `hashSim` folds the groups (and the
  share budget) and the fans only while there are some. Battle saves classify `tethers`, `_tetherOn` and `_shareBudget` as
  `calm` and `_sharing` as `scratch`.
- The checkpoint digests of the returning girls' abilities battle and the Tenka battle moved (`tests/online/engines.test.js`),
  and nothing else in those battles did: same ticks, hashes and final. Every Sim now carries the tether fields and every enemy
  its `tie`, and the generic serializer stores them. `node e2e/engines.mjs`: V8 (Node, Chromium) and JavaScriptCore (Bun) agree
  on every battle and on the LINKS rejoin. SpiderMonkey and WebKit were not installed on this machine, so run `--require-all`
  before ship.
- Sim id: `PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` reads `9abe3d4c3a14` (S1, the long beam, S2, S3 and S4). **No `COOP_PROTOCOL` bump on
  the branch.**
- Perf: `tests/sim/perf.test.js` "link attack shapes": 6 Fuus at T5, 6 Enas at T5 and 2 Akanes' Hearth Streams (the hook's busiest
  caller) with 200 enemies. Up to 48 fans, 15 groups and 72 shares a step, at 0.35-0.43 ms a step locally (limit 2 ms).
