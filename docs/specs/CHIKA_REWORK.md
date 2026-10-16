# Chika rework: roaming drones, her own weak shot, Overall / Chika / Drones stats, tap a drone (build spec, revision 2)

Sakura Sentinels, live branch v0.1.25 at `ffc4d23` (the UR-awakening merge after `9bede1e`; no sim file changed, so the co-op sim id is still `06763e510bb4`, 34 graph files). Written 2026-10-14. Roadmap task #166.

This is a design spec; the live checkout was read only. **Revision 2 resolves `CRITIC.md`** (§15 lists every issue, fixed or rejected, with reasons). Every number here comes from headless runs of the **real sim** with this spec's changes applied as an overlay (`exp2/make-overlay2.mjs`: asserted exact-once replacements against the live files, plus an overlay copy of the battle-save module from `wt-battlesave`). The shipping configuration is `exp2/var/H2.json`; raw results are in `exp2/res/`. Revision 1 is kept as `SPEC.v1.md` and its prototype as `exp/`.

---

## 0. Verdict in one screen

- **Drones fly in the sim, visibly past her ring.** Each drone hunts its own target anywhere within **4.0 tiles** of Chika (her range ring is 3.0; Sentry Grid 4.25, Mecha-Fortress 4.75, Storm Battery +0.25), follows it at 3.5 tiles/s and shoots it from **1 tile** away with **guided** shots that only hit their own target. A **dashed cyan ring** shows how far they may fly. A 12-second old-vs-new clip from the real sim: `exp2/clip/chika-roam-old-vs-new.webm`.
- **Her own wrench bolt is always on and weak**: 2 damage, 0.8/s, range 3.0 (about 15% of her damage at tier 0, under 1% on a Sentry 5 build). Tesla Tower turns it into today's coil (9 damage × 1.0/s, unchanged).
- **Per-drone stats live in the sim** (4 counters per drone, 4 per girl, no new events) and survive battle save and co-op rebuilds. Her panel gets a tab row **Upgrades · Overall · Chika · Drones** directly under Target (on screen on a phone), a list of every drone, and a **drone card** you also reach by tapping a drone on the field.
- **Balance, honestly** (§8; owner sign-off Q2):
  - against a crowd or a boss at her spot: **unchanged** (−1…+5%);
  - Chika alone in real waves: **+0…+46% kills at tiers 0–3** (median about +17%; the figure depends on the map and her spot), unchanged once she kills everything;
  - a boss walking her whole lane: **+25…+63% at tier 5**, two to five times today's (small) damage at tiers 0–3;
  - Strong mode against a boss inside a dense escort: **+120…+199%**, because her shots no longer hit the escort in the way;
  - whole-team campaign (60 runs): **one stage changes outcome** — 5-5 Normal, lost at wave 24 of 25 today, is won in all 3 seeds — and no win becomes a loss;
  - co-op freeplay with Chika lines: the bot dies 1–2 waves later.
- **Standing back** (about 4 tiles from the lane) now works — 53–100% of her best-spot kills — but **sappers jam her drones** when no girl is in their reach, so it no longer escapes every counter.
- **Engineering**: deterministic in V8, JavaScriptCore **and SpiderMonkey** (`6ada3d77` over 107,409 steps); no slower than today at 2,345 live enemies with 60 drones; battles without drones keep their co-op hashes; battle save covers the new state (11 of 11 save-and-continue runs identical to uninterrupted ones). The co-op id changes on purpose (8 graph files). **Profile save: no change.**

---

## 1. The owner's words mapped to behaviour

| Owner (verbatim) | What the game does |
|---|---|
| "what if the drones flew around in her radius and targetted enemies and followed them" (earlier, attack FX) | Drones really fly in the sim. Each one picks a target, keeps it (a re-think once a second), follows it at 3.5 tiles/s (4.5 at Sentry 5) and shoots it from 1 tile away. What you see is the sim's own position; the FX only adds a little sway (≤ 0.35 tiles, 0 at each shot). |
| "can the drones detatch from her radius" | Drones fly up to **4.0 tiles** from her: **1 tile past her 3.0 range ring** (about 40 px on a phone, 60 px on PC). Sentry Grid takes it to 4.25, Mecha-Fortress to 4.75, Storm Battery adds 0.25. When she is selected, a **dashed cyan ring** marks how far her drones may fly, outside her own solid range ring. A 12-second old-vs-new clip from the real sim is in `exp2/clip/chika-roam-old-vs-new.webm` (still: `chika-roam-still.png`). How far is owner question Q3. |
| "and maybe she can have a weak projectile" | Her wrench bolt fires all the time, from the moment she is placed: **2 damage, 0.8/s, 3.0 range** (1.6 DPS), at her target mode. That is about 15% of her damage at tier 0 and under 1% on a Sentry 5 build. Tesla Tower turns that bolt into the chain coil, which keeps today's 9 damage × 1.0/s. |
| "so you can split her stat between base and dron with like a little tab just for her" | A girl with drones (Chika today) gets a tab row at the top of her panel: **Upgrades · Overall · Chika · Drones**. Overall = both added up; Chika = her bolt only; Drones = the wing. Only drone owners get the row. Whether "split" should also mean a player-set slider is Q1; the default is display only. |
| "can you make it so you can track each individual drone stats" | Every drone has a name, a number, the wave it was built in, damage dealt, kills and shots, plus DPS over the last 5 s. The Drones tab lists them all, live. |
| "and then when you click chika its overall dmg with both chika tab and drone tab?" | Tapping Chika opens her panel. Its header always shows the total ("Kills 85 · Damage 12,340") and a split bar under it ("Chika 4% ▕██▏ Drones 96%"). The first time you open her in a battle the **Overall** tab is selected; Chika and Drones are one tap away. Overall's DPS is exactly Chika's DPS plus the Drones tab's DPS (same basis). |
| "like you can click on the drones!" | Tapping a flying drone selects it: her panel switches to the **drone card** (name, state such as "Hunting · Orc Grunt", its numbers, ◀ ▶ to step through the wing, ‹ back to where you came from). A ring follows the drone, with a faint tether to Chika. Tapping a row in the Drones tab does the same. |

---

## 2. What the code does today (evidence, live `ffc4d23`)

| Fact | Where |
|---|---|
| Chika's base behaviour is `'turret'`: damage 3, rate 0.25, range 3.0. Drones: max 2, damage 3, rate 1.5, range 2.6, pierce, shock 15%. | `src/data/units.js:1356-1360` |
| `attackTurret` builds a drone on each attack until max, and only then fires her own shot. So her own shot (3 dmg every 4 s) appears only once the wing is full. | `src/sim/towers.js:560-565` |
| Drones are placed at the golden angle at `TURRET_RING` = 0.62 from her, using `Math.sin/cos`, and **never move**. | `towers.js:551-558`, `constants.js:48-50` |
| Each drone runs `bestTarget` from its fixed spot over `turretSpec.range` and fires a 20 t/s homing bullet carrying `turretUid`. Bullets collide with any enemy on their path. | `towers.js:577-595`, `projectileStep` `:640-690` |
| Girls with a turret but another behaviour (Tesla Tower) keep building drones every `1/base.rate` s (anchored, like all live drones). **The Tesla Tower text says "Stops building drones", but the code keeps building them**: 3–4 drones on 2-0-4 / 2-0-5 builds (`exp/bench-old-full-s9.jsonl`). Only the attack-FX WIP draws them flying. | `towers.js:601-608`, `units.js:1380` |
| All damage is credited to the girl (`_credit(tower, dealt)`); a kill increments `tower.kills`. Nothing records which drone did it. | `src/sim/Sim.js:295-319, 374-390` |
| The panel shows DPS = her own + each drone × max, "New drone every 4.0s" and one "Drones n/max · X dmg × Y/s each" line, **after** Target and all three upgrade paths. | `src/ui/battle/towerPanel.js:136-161, 218-228` |
| `pick()` returns a girl (footprint, then the projected body). Drones cannot be picked. | `src/render/BattleRenderer.js:560-598` |
| A sapper disables the nearest girl within 1.6 tiles of it (cooldown 6 s, 3 s); a volatile death stuns girls within 1.4–1.6 tiles. Sappers appear on 6-3 (42), 6-4 (84) and 6-5 (62); volatile enemies on 6-4 (471), 6-5 (138) and 8-3 (196) (`exp2/sappers.mjs`). | `src/sim/enemies.js:372-391, 463-470`, `src/data/enemies.js:280-289` |
| The co-op hash covers enemies and towers, not drones. | `src/online/coop/simHash.js:39-48` |
| The renderer does not interpolate between sim steps (no `_acc` reader). Co-op steps the sim once per lockstep tick (`commands.js:195`); the tick fraction is `lockstep.acc` (`lockstep.js:541-555`). | `src/render/*`, `src/online/coop/*` |
| Determinism: co-op runs every Sim call inside `withDetMath`, which swaps `sin/cos/atan2/hypot`. `pow/exp/log/**` are not swapped. | `src/core/detMath.js:1-17, 86-109` |

---

## 3. Sim design

### 3.1 The drone record (`makeDrone`, `src/sim/towers.js`)

```js
/** One factory for drones: building, battle-save restore and tests use it. */
export function makeDrone(t, uid, n, slot, born = 0) {
  const s = DRONE_SLOTS[slot % DRONE_SLOTS.length];               // literal unit vectors
  const ring = TURRET_RING * (1 + 0.5 * Math.floor(slot / DRONE_SLOTS.length));
  const hx = s[0] * ring, hy = s[1] * ring, x = t.x + hx, y = t.y + hy;
  return {
    uid, n, slot, x, y, px: x, py: y, hx, hy, facing: 0, cooldown: 0.3,
    jam: 0,                                                       // seconds left jammed by a sapper (§3.2)
    tgt: null, targetUid: null, moving: false,                    // calm-point state
    dmg: 0, kills: 0, shots: 0, born,                             // per-drone stats (born = wave)
  };
}
```

- `DRONE_SLOTS` (`constants.js`) is a literal table of 16 `[sin, cos]` pairs for the angle `n·2.39996 + 0.6` (today's `spawnTurret` angles) printed to 17 digits. No trig runs at runtime.
- `px, py` hold the position at the start of the current step (render interpolation, §6.1). They are rewritten every step, never read by the sim, and not hashed or saved.
- There are **no per-drone timers**: the re-think and opportunity schedules come from the step number (§3.2), so nothing that is left over at a calm point can change what happens next (battle save, §5).
- New girl fields (`createTower`, `towers.js:49-94`): `droneDmg: 0, droneKills: 0, droneShots: 0, droneSerial: 0`, plus the target pool cache `_pool, _poolS, _poolLeft, _poolMode` (§3.2).

### 3.2 One step of a roaming drone (`updateRoamingDrones`)

`updateTurrets(sim, t, dt)` (`towers.js:577`) keeps today's code for **anchored** turrets (`turretSpec.leash === 0`: the test fixture and any future anchored engineer) and calls `updateRoamingDrones` when `leash > 0`. With `L` = roam radius, `R` = gun range, `reach = L + R` and `tick = Math.round(sim.time / STEP)`:

**Once per girl per step**
- `_poolLeft` counts down. The **target pool** is computed lazily, at most once per step: `topTargets(sim, t.x, t.y, reach, spec, t.targetMode, n + 2, t._pool, t._poolS)` (new export, next to `selectTargets`). It keeps the best `n + 2` candidates by insertion (O(N·k), no sort, no allocation) and gives exactly what a stable sort + truncate gives. It is **reused for up to 4 steps** (`DRONE_POOL_STEPS`) while it is in the same target mode and still holds at least one valid entry (alive, eligible, within reach); otherwise it is recomputed.

**For each drone, in build order**
1. `px, py ← x, y`; `cooldown -= dt` while positive. A **jammed** drone (`jam > 0`) counts its jam down and does nothing else this step: no target, no move, no shot.
2. **Drop the quarry** if it is dead, no longer eligible (veiled, tunnel, air rules via `isEligible`) or beyond `reach` from Chika. With no enemies alive the quarry is null.
3. **Look for a quarry** on the drone's own schedule:
   - with no quarry: every 3 steps (`DRONE_IDLE_STEPS`), staggered by `(tick + slot)`;
   - with a quarry: a re-think every 60 steps (`DRONE_RETHINK_STEPS`, 1 s), staggered by `(tick + 7·slot)`.
   A drone that just lost its quarry also waits for its next look (≤ 0.05 s).
   - **Strong / Elite: the wing focuses.** A quarry is kept only while it is the pool's #1 valid entry; otherwise the drone takes #1.
   - **First / Last / Close (and roster B3's Air): the wing spreads.** A quarry is kept while it is among the pool's first `max(2, n)` valid entries; otherwise the drone takes the valid entry with the fewest sibling drones on it (ties: nearest to the drone for First and Close, better rank otherwise).
4. **Where to be.**
   - Outside the roam disc (it shrank: a Blizzard, an aura girl sold, Heat Mirage): **straight back to the disc's edge** first.
   - With a quarry: close to `R × 0.5` (`DRONE_STANDOFF`) along its own line of approach, clamped to the roam disc. Already closer: hold.
   - Otherwise: home, at `Chika + (hx, hy)`.
5. **Move** toward that point at `speed × dt` (exact arrival when closer). `moving = distance > 1e-9`.
6. **Fire** when `cooldown ≤ 0`:
   - at the quarry if it is within `R`;
   - else, every 6 steps (`DRONE_OPP_STEPS`, staggered by slot), at the closest eligible enemy within `R` (a target of opportunity on the way). **Not on Strong / Elite** while the wing is flying to its focus target;
   - else `cooldown = 0`.
   A shot faces the target (`Math.atan2`, swapped in co-op), spawns a **guided** bullet (`kind 'bullet'`, 20 t/s, pierce 1, `turretUid`, `drone: tu`), runs `shots++`, `t.droneShots++`, `cooldown += 1/rate`, and emits today's `attack{kind:'bullet', turretUid}`.

**Guided shots** (`projectileStep`, `towers.js:640`): a drone bullet can only hit its own target (a segment-to-circle test against that one enemy, no grid query), and **fizzles** the moment its target is dead, hit or no longer eligible. So a drone's numbers are its own target's, Strong mode really focuses, and no drone bullet is ever in flight at a calm point. Other girls' projectiles are unchanged.

Rules that fall out of this:
- **Sabotaged Chika** (`disabled > 0`): `updateTower` returns early (`towers.js:612-615`), so the drones hover where they are and do not fire. Today's rule; the FX shows them dizzy.
- **Sappers jam drones** (`enemies.js:372-391`): a sapper looks for a girl exactly as today and disables the nearest one in its 1.6 tiles. **Only when no girl is in reach** does it jam the nearest roaming drone of a girl who is not disabled or cleansed: `jam = 3 s` (the sapper's `duration`), the same cooldown, and today's `sabotage` event with `turretUid` added for the FX. Girls always come first, so team sabotage is today's. Volatile blasts are unchanged: her body only (§8.6 has the numbers for the stricter rules that were rejected).
- **Sell**: the drones disappear (`Sim.js:685`) and their bullets die (`towers.js:720`). Unchanged.
- **Upgrades** change `turretSpec` (`leash/range/speed/rate/damage`); the drones adapt on the next step.
- **Between waves** the drones fly home. Nothing is random: no rng is used for movement, picking or schedules.
- **Bounds**: drones fly and never collide. Targets are on lanes inside the map; home is next to her.

### 3.3 Building and her own shot

- Chika's base `behavior` becomes `'projectile'` (her bolt). `attackProjectile` already handles it, including roster B3's `t.ox/t.oy` origin (she has no relay, so the origin is her own spot).
- `turret.build` (new stat, seconds per drone; Chika 4) drives `buildDrones` (`towers.js:601-608`): its timer restarts from `turretSpec.build`; the old `1/def.base.rate` stays as the fallback.
- `turretSpec.build = turret.build / max(0.05, buff.rateMul × globalRateMul)`, and profile `rateMul` divides `turret.build` in `applyUnitStats`, so build speed follows the same buffs as today (it rode on her attack rate).
- The first drone still appears the instant wave 1 starts. Drones are built only during waves, as today.
- `attackTurret` (`'turret'` behaviour) stays for anchored engineers and the test fixture. Chika no longer uses it.

### 3.4 Per-drone credit: sim fields, not UI-side event aggregation

UI-side aggregation from events was rejected: every `hit` would need `towerUid` and `turretUid` and `death` a killer (two more fields on the hottest event), the aggregator would have to run from tick 0 for every girl, and its totals would vanish on a battle-save Continue or a co-op rebuild. Sim counters cost 4 numbers per drone, are deterministic and need no events.

Changes in `Sim.js`, all through default parameters, so every other caller (traps, `explode`, DoTs, roster B3 curses) is unchanged:

```js
_hit(e, tower, spec, scale = 1, drone = null)            // :295   → _credit(tower, dealt, drone); _killEnemy(e, tower, drone)
_credit(tower, dealt, drone = null)                      // :374   + if (drone) { drone.dmg += dealt; tower.droneDmg += dealt; }
_killEnemy(e, tower, drone = null)                       // :381   + inside the tower branch: if (drone) { drone.kills++; tower.droneKills++; }
```

`projectileStep` passes `p.drone`; `spawnProjectile` stores `drone: opts.drone ?? null` next to `owner`.

- Chika's own numbers are derived: dealt = `damageDealt − droneDmg`, kills = `kills − droneKills`.
- Drone bullets have no splash, so drones never `explode`. A drone's shock deals no damage. If a drone ever applies a DoT, its ticks credit Chika (the DoT source is the girl): documented, not built.
- Checked on a full 26-wave battle (`exp2/invariants2.mjs` → `res/inv-H2.json`): Σ drone damage = `droneDmg` (relative error 8e-15), Σ kills = `droneKills` = 356 ≤ `kills` 357, Σ shots = `droneShots` = 3,604; 750 between-wave checks with every drone exactly home; 0 drone bullets in flight at 25 wave ends.

### 3.5 Sim API for the UI (`Sim.js`)

- `towerStats(uid)` (`:703-755`):
  - `turret` gains `range` (gun), `leash` (roam), `speed`, `build` (all effective, after buffs), `active`, `dealt: droneDmg`, `kills: droneKills`, `shots: droneShots` and `nextIn` (build timer while building, else 0). `damage`/`rate` come from `turretSpec`, as today.
  - New `own: { dps, dealt, kills }`: `dps` is today's `st.dps` formula on her bolt.
- `droneStats(towerUid)` (new): `[{ uid, n, x, y, px, py, state, jam, targetUid, dmg, kills, shots, born }]` in build order, `state` ∈ `'hunting'` (has a quarry), `'returning'` (moving, no quarry), `'home'`, `'jammed'` (`jam > 0`), `'stalled'` (Chika disabled). It allocates; UI only.
- `findDrone(uid)` (new): `{ tower, drone } | null` by scanning towers. Used by selection and the e2e.

### 3.6 Data model (`src/data/units.js` Chika, `src/sim/mods.js`, `src/sim/constants.js`)

New `turret` sub-keys:
- **`leash`** (roam radius, tiles; additive). `leash: 0` = anchored (today's behaviour).
- **`speed`** (tiles/s, additive; default 3).
- **`build`** (seconds per drone; default 0 → falls back to `1/base.rate`).

| Function | Change |
|---|---|
| `normTurret` (`mods.js:35-44`) | `leash: t.leash ?? 0, speed: t.speed ?? 3, build: t.build ?? 0` |
| `applyModSet` turret branch (`:154-161`) | `s.turret.leash += v.leash ?? 0; s.turret.speed += v.speed ?? 0` |
| `applyUnitStats` (`:215-219`) | `s.turret.leash *= u.rangeMul; if (s.turret.build > 0) s.turret.build /= u.rateMul` |
| `refreshEffective` (`towers.js:152-163`) | `turretSpec` gains `leash: s.turret.leash × b.rangeMul, speed, build` (§3.3) |

**Range changes and the roam disc** (critic 11): multiplicative changes (gear `rangeMul`, aura `rangeMul`, Blizzard ×0.85) scale **both** roam and gun. Additive ones (Heat Mirage −0.5, Prism +0.7) are applied **once, to the roam radius** (`leash = max(1, (leash + envRangeAdd) × envRangeMul) × buff.rangeMul`, gun = `range × envRangeMul × buff.rangeMul`), so her reach moves by exactly the same amount as any girl's range. A disc that shrinks mid-flight sends drones outside it straight back to its edge (§3.2 step 4).

Constants (`constants.js`, after `:50`): `DRONE_SLOTS` (16 literal pairs), `DRONE_STANDOFF = 0.5`, `DRONE_RETHINK_STEPS = 60`, `DRONE_IDLE_STEPS = 3`, `DRONE_OPP_STEPS = 6`, `DRONE_POOL_STEPS = 4`.

**Chika, before → after** (`units.js:1351-1388`). Costs, bio and awaken passive unchanged.

| Field | Today | New |
|---|---|---|
| tips[0] | "She builds drones over time — place her early beside a long straight." | "Her drones fly out to hunt up to 4 tiles away — tap one to see its stats." |
| tips[2] | "Tesla Tower (tier 4) trades drone building for a chain-lightning coil." | "Tesla Tower (tier 4) turns her wrench bolt into a chain-lightning coil; her drones keep flying." |
| base | `behavior: 'turret', damage: 3, rate: 0.25, range: 3.0` | `behavior: 'projectile', damage: 2, rate: 0.8, range: 3.0` |
| base.turret | `{ max: 2, damage: 3, rate: 1.5, range: 2.6, … }` | `{ max: 2, damage: 3, rate: 1.5, range: 1.0, leash: 4.0, speed: 3.5, build: 4, … }` |
| Sentry T3 Sentry Grid 1200 | "+2 drones, +0.5 drone range, drones fire 20% faster." `{ max: 2, range: 0.5, rate: 1.2 }` | "+2 drones; drones fire 20% faster and fly 0.25 tiles farther." `{ max: 2, leash: 0.25, rate: 1.2 }` |
| Sentry T5 Mecha-Fortress 13000 | "…+30% fire rate, +1 drone range." `{ max: 4, damage: 12, rate: 1.3, range: 1 }` | "+4 drones (9 at once), +12 drone damage, +30% fire rate; drones fly 0.5 tiles farther and faster." `{ max: 4, damage: 12, rate: 1.3, leash: 0.5, speed: 1 }` |
| Tesla T3 Storm Battery 1000 | "Drones +3 damage and +0.5 range; …" `{ turret: { damage: 3, range: 0.5 }, … }` | "Drones +3 damage and fly 0.25 tiles farther; Chika's own shots shock (25%)." `{ turret: { damage: 3, leash: 0.25 }, … }` |
| Tesla T4 Tesla Tower 3300 | "Stops building drones and becomes a tesla coil: …" `rateMul: 4, damage: 6` | "Her wrench bolt becomes a tesla coil: mystic lightning chains through 5 enemies, ignoring 2 armor. Her drones keep flying." `rateMul: 1.25, damage: 7` — the coil keeps today's 9 damage × 1.0/s (3+6 → 2+7; 0.25×4 → 0.8×1.25). |

**How far drones fly** (neutral stats): tier 0 **4.0** · Sentry 3–4 **4.25** · Sentry 5 **4.75** · +0.25 with Storm Battery. Reach (roam + 1.0 gun): 5.0 / 5.25 / 5.75 (today 3.22 / 3.72 / 4.72). Unit `rangeMul` (gear) scales both parts.

### 3.7 Other sim touch-points

- `headless.js:293-294` (`autoPlan` spot score, critic 17): for girls with `stats.turret.leash > 0`, coverage is scored at `max(range, leash + turret.range)`. `pathScore` (`:137-160`) is **not** changed: it never counted `turret.range`, so removing `turret.range` from three tiers and adding `leash` leaves every path choice where it is. The campaign evidence (§8) now uses this patched `autoPlan`.
- `report.js`: nothing changes (`summon` / `multiHit` key on `turret.max`).

---

## 4. Co-op

- **Compatibility id**: changes deliberately; both players must update. Graph files changed (8): `src/sim/constants.js`, `mods.js`, `towers.js`, `Sim.js`, `enemies.js`, `headless.js`, `src/data/units.js` (and with it the battle-data hash in `version.js`), `src/online/coop/simHash.js`. No new graph files. The prototype's id is `1114661dad3b` (live `06763e510bb4`), computed with `tools/simId.mjs` on a copy of the graph with the overlay files in.
- **`COOP_PROTOCOL` is unchanged**: no new message or command. Drone selection is local UI; an ally's Chika and drones can be inspected, never controlled (today's ally note, `towerPanel.js:212-216`).
- **Desync detection** (critic 5): `hashSim` (`simHash.js:46`) folds a girl's drones **only when she has some**: inside the tower loop, `if (t.turrets.length) { h.int(t.turrets.length); for (d of t.turrets) h.int(d.uid).int(d.x*256).int(d.y*256) }`. Battles without drones keep their hashes: three full battles without Chika (1-3 Normal, 4-5 Hard, 6-5 Normal, `exp2/hashpin.mjs`) give the same digests on the live bundle and the prototype (`5870e6b2`, `e8e6471a`, `7f6a288d`). So the freeplay pins (`3689325c`, `3f135b46`: teams Kage, Shiro, Aoi, Akane, Miko + Momo, Sango, Yuki, Umeko, Midori) and the engines fixture (Aoi, Rei, Yuki, Hikari) stay valid; the codex-modes pin (`2542428d`, each stage's free units through `autoPlan`) stays valid unless a team there includes Chika — re-check when rebasing. Any pinned battle **with** Chika is re-pinned in the branch that lands second (§10).
- **Determinism**: only `+ − × ÷`, `Math.sqrt` and `Math.atan2` (facing only, swapped by `withDetMath`); no `**`, `pow`, `exp`, `log`, trig per step, rng or timers. `exp2/det2.mjs` runs two battles under `withDetMath` — (A) 4-5 Hard with Chika 5-0-2 cycling all five target modes every 20 s, Chika 2-0-5 (Tesla) on Strong, and a Pit Crew Chika whose aura widens the first one's roam and is **sold mid-wave** (the disc shrinks); (B) 6-5 Normal with **34 sabotage events** (girls disabled and drones jammed) — 107,409 steps in all, hashing every drone's x/y/damage, every girl's damage and `hashSim` every 30 steps: **V8 (Node 22), JavaScriptCore (Bun 1.3.14) and SpiderMonkey (Firefox 142) all give `6ada3d77`** (`det2-ff.mjs` runs it in Firefox through Playwright).
- **Lockstep cost** (critic 4): §8.8.

---

## 5. Save and migration

- **Profile (`src/systems/save.js`, `SAVE_VERSION = 2`)**: no change, no migration. Nothing about the tabs is stored in the profile (the remembered tab lives only for the battle, §7.1).
- **Battle save** (wt-battlesave, built: `src/ui/battle/snapshot.js`; its contract: "new Sim or tower keys must be classified"). The second branch to land makes this edit; the prototype applies it to an overlay copy of the real `snapshot.js` (`exp2/make-overlay2.mjs`, battle-save section):
  - `KNOWN_TOWER_KEYS` (`snapshot.js:56-65`): `droneDmg, droneKills, droneShots, droneSerial: 'snap'`; `_pool, _poolS: 'scratch'`; `_poolLeft, _poolMode: 'calm'` (a stale pool holds only dead enemies at a calm point, so it is never reused after one).
  - New `KNOWN_DRONE_KEYS` + a guard test like the tower one: `uid, n, slot, x, y, facing, cooldown, dmg, kills, shots, born, jam` → snap (a jam can still be running at a calm point); `hx, hy` → derived (from `slot`); `tgt, targetUid, moving, px, py` → calm.
  - Drone rows (`snapshot.js:106`): `[uid, x, y, facing, cooldown]` → `[uid, x, y, facing, cooldown, n, slot, dmg, kills, shots, born, jam]`, plus `ds: [droneDmg, droneKills, droneShots, droneSerial]` on the tower.
  - Restore (`snapshot.js:196`): `t.turrets.push(restoreDrone(t, row, i))` — a new `towers.js` export that calls `makeDrone(t, uid, n ?? i+1, slot ?? i, born ?? 0)` and assigns the rest (`px, py = x, y`). Then **`droneSerial = max(saved serial, highest n)`** (critic 16), so an old save never hands out "#1 Sprocket" twice.
  - Old 5-field rows still restore (counters 0, numbered 1…k). Their past drone damage then shows as Chika's own until the battle ends: said in the release notes. `SNAP_V` stays 1: the change is additive.
  - **Split-run equality** (critic 16): `exp2/splitrun.mjs` plays four battles with roaming drones (4-5 Normal 5-0-2, 8-5 Hard 2-0-5, 6-5 Normal 3-2-0 on Strong, and 6-3 Normal with Chika alone so that sappers jam her drones), saves at the start of waves 3/8/14, 6/15, 4/11 and 3/6/9/12 through the real `snapshotSim` → JSON → `restoreSim`, and plays on with per-wave streams. **11 of 11 end identical** (`hashSim`, every girl's damage and kills, every drone's position, counters and serial), including saves with **8–10 drones still flying home** and **2 drones jammed**. This test found two real bugs in the first prototype, both fixed in §3.2: a drone re-thinking at once because of a dead quarry left at the calm point, and a drone bullet still in flight at the calm point hitting the next wave's first enemy (hence guided, fizzling shots). The same test goes into `tests/battle-ui/snapshot.test.js` (§9).

---

## 6. Rendering: one source of truth, picking, selection

### 6.1 Drones drawn where the sim has them

- **Interpolation** (critic 12): the sim stores `px, py` at the start of every drone step. The controller exposes `ctx.renderAlpha()`: solo `sim._acc / STEP`; co-op `Math.min(1, lockstep.acc)` (the tick fraction left after `lockstep.advance`). The drawn position is `p + (x − p) × α`. At 30 fps solo, two steps run per frame and `px, py` is the position before the last one, which is what fixed-step interpolation needs.
- **Attack-FX** (`wt-attack-fx/src/render/attackFx/patterns/drones.js`): stops steering its own drones. The `APPROACH / PASS / RETURN` states and caps go; it keeps height (orbit 1.25 / outer 1.5, engaged 1.1), yaw/bank/pitch from the sim velocity, trails, tier looks, shadows. **Decoration ≤ 0.35 tiles**: home drones orbit their sim home point; hunting drones may sway with amplitude `0.25 × clamp(cooldown / 0.15, 0, 1)` (0 at each shot); drones sharing a spot fan out by slot (render only). `muzzleFor` returns the sim position, so the bullet leaves the drawn nose. States kept: `LAUNCH` (0.3 s hop from her backpack = the sim's first cooldown), `DOCK` (Tesla, only while home), `DIZZY` (Chika disabled, or this drone jammed: sparks and a wrench icon, from `droneStats().state`).
- **Rings**: selected Chika shows her solid range ring and a **dashed cyan ring at `turretSpec.leash`** (how far the drones may fly), replacing `t.eff.range − 0.2` (`drones.js:382`). Codex-modes' 0.3 s ease of range rings applies to it too.
- **Truth rules** in `docs/ATTACK_FX.md`: T4 → "Drones stay inside the roam disc (`turretSpec.leash`, enforced by the sim)"; T8 → "Drawn drone = sim drone ± 0.35 tiles of decoration, exactly the sim position at each shot". The registry test's "no `src/render` file in the hash graph" still holds.
- **Legacy look** (`settings.attackFx === false`): `actors._syncDrones` (`actors.js:468-485`) draws `tu.x, tu.y` with the same α.
- **Fizzled shots**: the FX sees a drone bullet vanish without a `hit` and draws a small puff there (render only).

### 6.2 Picking a drone (`BattleRenderer.pick`, `:560-598`; critic 13)

The result gains `droneUid` (null when none). Priority:
1. **A flying drone** (hunting or returning) whose **drawn** position (attack-FX `drawnDrone(uid) → {x, h, y}`, fallback `(tu.x, 0.62, tu.y)`) projects within **22 CSS px** (or 0.3 tiles, whichever is larger) of the tap, nearest first. Drones are drawn 1.1–1.5 tiles up, so this test runs **before** the footprint test.
2. **Footprint under the tap** (`sim.towerAt`): the girl, as today.
3. **A girl's body** (`:584-596`), as today.
4. **A drone at home**: home drones hover over her head, so a tap there selects her unless it misses her body.

At phone zoom a tile is about 40 px; a 44 px disc covers a drone moving 3.5–4.5 t/s for ~100 ms of tap latency (14–18 px).

### 6.3 Selection

- `ctx.select(uid, { drone } = {})` (`controller.js:207-215`): `ctx.selectedUid` stays the **girl's** uid (upgrades, sell and the co-op owner check untouched); new `ctx.selectedDrone`.
- The tap handler (`controller.js:338-343`): `ctx.select(p.droneUid != null ? owner : p.towerUid, { drone: p.droneUid })`, owner from `sim.findDrone`.
- `renderer.setSelected(uid, droneUid)` → `overlays.setSelected` (`overlays.js:101-115`) draws, for a drone: a cyan ground ring (r 0.28) under it, a faint dashed tether to Chika, a small reticle on its target, and her roam ring without her range ring.
- Selling her clears the selection (existing `sell` handler, `controller.js:465`).

---

## 7. UI

Labels use the girl's name, so a future drone owner needs no new copy. The tab row appears only when `towerStats(uid).turret?.leash > 0` (Chika today).

### 7.1 Panel layout (critic 6, 7, 8, 15)

| Size | Panel | Scroll area | Before the tab content |
|---|---|---|---|
| **Phone 844×390** | right card, 340 px wide, 332 px tall (`battle.css:560`, HUD 46 px) | ~290 px (footer 42) | header 58 + split bar 16 + Target 32 + tab row 30 = **136 px** → 154 px of tab content visible |
| **PC 1280×720** | right card, 352 px wide (`battle.css:293-297`) | ~490 px | same 136 px → everything visible |
| **≤ 700 px wide** | bottom sheet (`:514-518`) | sheet | same order |

```
┌ Chika  5-0-2 ─────────────────────────── ✕ ┐  header (unchanged)
│ [portrait] Engineer · Pierce                │
│ Kills 385   Damage 48,120                   │  overall totals (today's line, live)
│ Chika 4% ▕█░░░░░░░░░░░░░░░░░▏ Drones 96%     │  NEW split bar (data-testid="split-bar")
│ Target [First|Last|Strong|Close|Elite]      │  unchanged
│ [Upgrades•] [Overall] [Chika] [Drones 9]    │  NEW tab row, role=tablist, sticky at the top of the scroll area
├─────────────────────────────────────────────┤
│ (tab content)                               │
├─────────────────────────────────────────────┤
│ Invested 4,890               [Sell · 3,423] │  footer (unchanged)
└─────────────────────────────────────────────┘
```

- **Tab row**: four segments, `data-testid="tab-upgrades|tab-overall|tab-chika|tab-drones"`, 30 px tall (phone labels 0.72rem). "Drones 9" carries the live count. A small coin dot on **Upgrades** when any of her upgrades is affordable (the panel's `signature()` already computes affordability). For girls without roaming drones the panel is exactly today's.
- **Which tab opens**: the first time you open her in a battle, **Overall** (the owner's "when you click chika its overall dmg"). After that she reopens on the last tab you used for her, for the rest of the battle (a `Map<uid, tab>` in the panel closure; nothing saved).
- **State that survives re-renders** (critic 7): `tab` and `droneUid` live in the panel closure, are set only by `open()`, tab taps and drone selection, and are part of `signature()`. `render(t)` rebuilds the DOM from them, so buying an upgrade, the wave state changing, a drone being built or Sell being armed never snaps the view back.
- **Split bar**: 6 px, gold (her) and cyan (drones), labelled left and right; "—" until 1 damage is dealt; labels 0.68rem on phone.

**Overall tab** (`data-testid="stats-overall"`) — **today's full grid** (critic 8), plus two lines:

| Cell | Value |
|---|---|
| **DPS** (main) | `own.dps + each × max` — her bolt plus the **full wing** (the owner-approved v0.1.24 basis). When `active < max`: "(full wing of 9)" after it. |
| **Dealing** (new) | damage per second over the last 5 s of game time (live); "—" for the first second |
| **Range** · **Drones fly** (new) | `3.0` · `4.25 tiles (+1.0 gun)` |
| **Drones** | today's line, unchanged: `5/9 · 3 dmg × 4.33/s each` |
| Crit, vs Elite/Boss/Barrier, Aura, Income, Ramp, Mark, **Upgrades x% cheaper (gear …)** | exactly today's rows (`towerPanel.js:150-183`) |
| chips | today's chips |

**Chika tab** (`stats-chika`): her wrench bolt.

| Cell | Value |
|---|---|
| **DPS** (main) | `own.dps` |
| **Damage** · **Attacks/s** · **Range** | her bolt (Tesla T4+: plus **Jumps**, **Armor pen**) |
| **Dealt** · **Kills** · **Share** | `own.dealt`, `own.kills`, `own.dealt / damageDealt` |
| **Dealing** | her live 5 s rate |
| **Aura** | the Repair Bay aura (it is hers), same text as Overall |
| chips | her `status` (Storm Battery shock), Hits air |
| footnote | "Her wrench bolt fires on its own. Tesla Engineering turns it into a lightning coil." (0.7rem, muted) |

**Drones tab** (`stats-drones`): the wing, then one row per drone.

| Cell | Value |
|---|---|
| **Wing DPS** (main) | `each × max`, "(full wing of N)" when `active < max` — the same basis as Overall, so **Overall DPS = Chika DPS + Wing DPS** exactly; and Overall "Dealing" = Chika "Dealing" + the wing's |
| **Flying** | `5/9 · next in 2.1 s` / `9/9` / `5/9 · builds during waves` |
| **Damage each** · **Fire rate** | `turretSpec.damage`, `turretSpec.rate /s` |
| **Gun** · **Fly up to** · **Speed** | `1.0` · `4.25 tiles` · `3.5 tiles/s` |
| **Dealt** · **Kills** · **Shots** | `droneDmg`, `droneKills`, `droneShots` |
| hint | "Target First: drones spread out" / "Target Strong: the wing focuses one target" (0.7rem) |

The list (`data-testid="drone-list"`): one 28 px row per drone in build order — state dot (cyan hunting, grey home, amber jammed or stalled), "#1 Sprocket", damage, kills, a "Top" chip on the highest damage. Tapping a row (`drone-row-<n>`) opens the drone card and selects the drone on the field. Numbers update through `updateLive`; the list re-renders only when the drone count changes. On phone the first row starts ~66 px into the tab content, inside the visible 154 px (e2e asserts it).

**Drone card** (`data-testid="drone-card"`), replacing the tab content while a drone is selected (the header and tab row stay; "Drones" is highlighted):

```
│ ‹ Drones          #1 Sprocket          ◀  ▶ │  back = data-testid="drone-back"; ◀ ▶ = drone-prev / drone-next
│ Chika's drone · built wave 1                │  2+ Chikas: "Chika (2nd)'s drone"; co-op ally: "Mika's Chika · drone"
│ ● Hunting · Orc Grunt                       │  Flying home / Home / Jammed (2.1 s) / Stalled (Chika is sabotaged)
│ Damage dealt 6,905   Kills 47   Shots 515   │
│ DPS (last 5 s) 41.2   18% of the wing       │
│ Damage/shot 22   Fire 2.3/s                 │
│ Gun 1.0   Flies up to 4.25 tiles   3.5 t/s  │
│ Drones belong to Chika — upgrade her in the │
│ Upgrades tab.                               │
```

- **‹** returns to the tab you came from (the Drones tab when opened from a row; her remembered tab when opened from the field). **◀ ▶** step through the wing in build order (wrapping), moving the field selection with it (critic 14).
- The footer keeps Invested/Sell for her; the card itself has no Sell.

**Drone names** (`src/data/droneNames.js`, new, UI only, outside the co-op graph): Sprocket, Rivet, Pip, Dynamo, Gimbal, Piston, Bobbin, Spindle, Thimble, Sparkplug, Flywheel, Doohickey. Drone `n` is `NAMES[(n−1) % 12]`, plus " II" after a wrap. Our own common-word names; the owner may rename freely. (Her bio already says she "names every drone".)

**Live numbers**: `createRateMeter(5)` (new, `src/ui/battle/util.js`), owned by the controller, samples `damageDealt`, `droneDmg` and every drone's `dmg` for every girl with roaming drones every 0.25 s of game time, so rates are ready when a panel opens. Cleared on Continue / co-op rebuild; the counters themselves persist.

### 7.2 Other screens

- **Student page** (`src/ui/screens/student.js`): `describeMods` (turret lines `:118-122`) learns `leash` ("drones fly +0.25 tiles farther") and `speed` ("+1 drone speed"); "sentry" wording becomes "drone". The base row `Sentries` (`:196`) becomes **Drones**: "up to 2 · 3 dmg × 1.5/s · fly up to 4.0 tiles". The behaviour name (`BEHAVIOR_NAMES`, `:42`) shows **"Projectile + Drones"** when `base.turret` exists.
- **Unit-info WIP** (`wt-unit-info/src/ui/upgradeTags.js`): `SUB_KEYS.turret` (`:55`) adds `leash, speed, build` (or its test trips); `turretShort` (`:268-284`) adds "Drones fly +0.25"; the Tesla rows are tagged `self` (her bolt); and the note for `chika.2.3` at `:72` ("…the coil fires alongside them. Attack speed ×4.") is **removed** (critic 18): the tier text now says it.

---

## 8. Balance

### 8.1 Numbers that ship

`exp2/var/H2.json` (the data in §3.6 plus the mechanics in §3.2):
- her bolt: 2 damage × 0.8/s, range 3.0 (1.6 DPS on paper);
- drones: 2 at tier 0, 3 damage × 1.5/s each, gun 1.0, fly up to 4.0, speed 3.5, one built every 4 s;
- growth: fly +0.25 (Sentry Grid), +0.5 and +1 speed (Mecha-Fortress), +0.25 (Storm Battery); Tesla Tower `rateMul 1.25, damage 7` (coil unchanged at 9 × 1.0/s);
- guided drone shots; strict focus on Strong/Elite; sappers jam drones only when no girl is in reach; volatile blasts unchanged.

**No coin cost, reward or drop changes.**

### 8.2 Method (all under `exp2/`)

| Script | What it measures |
|---|---|
| `bench.mjs` | One Chika on 4-5, real upgrades, 15 s warm-up + 60 s against **immortal** targets: a crowd (an orc every 0.1 s), sparse fast goblins, a boss walking past from 1.5 tiles before her, a boss parked at her nearest lane point. Spots **best** (most lane within 3.0, today's optimum) and **far** (nearest lane 3.6–4.2 away). |
| `measure.mjs waves` | Chika **alone on real stages, enemies that die**, lives 10⁹: kills and lives lost, 3 seeds (9, 21, 33), 10 stage/build cases, spots **best**, **reach** (most lane within her drone reach: the new kit's optimum and what `autoPlan` now picks) and **far** (critic 1). |
| `measure.mjs fullpass` | An immortal Ashwing walks the **whole lane from the spawn, once per path**, after a 45 s warm-up (critic 2). |
| `measure.mjs focus` | Strong mode: an Ashwing parked at her nearest lane point while an orc walks in every 0.1 s (a boss inside a dense escort; critic 2). |
| `measure.mjs sabo` | Chika alone on the sapper/volatile stages 6-3, 6-4, 6-5 at best/reach/far: kills, lives lost, seconds she is disabled, jams (critic 9). |
| `campaign2.mjs` | An `autoPlan` team (Hikari, Chika, Aoi, Yuki, ≤ 2 copies) on 10 stages × Normal/Hard × 3 seeds, with the patched `autoPlan` (critic 17). |
| `fp/bot.mjs` | The co-op freeplay team bot (stacked on the freeplay prototype) with **Chika in the copy cycle**, Blossom 1-3 and 8-5, "strong" build (critic 9). |
| `perf3.mjs` | 6 Chikas at 5-0-2 (60 drones) in an immortal crowd of ~2,345 (and ~940) live enemies, µs per step, Node and Bun, old and new interleaved (critic 4). |

Profiles: **base** (neutral stats) and **strong** (L60, 5 gates, ★3, mythic gear: the freeplay/Potential preset). Old kit = the live code (`out-old`); new = `out-H2` (`out-F` for tests without sappers, where the two are the same code path).

### 8.3 Against a crowd and a lone boss (`res/fin-*.jsonl`, strong; base in Appendix A.1)

| Build | Spot | Crowd | Sparse | Boss walking past | Boss parked | Her share (crowd) | Drones |
|---|---|---|---|---|---|---|---|
| t0 | best | 109 → 114 (+5%) | 161 → 179 (+11%) | 30 → 58 (+95%) | 197 → 199 (+1%) | 7% | 3 |
| 3-0-0 | best | 357 → 354 (−1%) | 581 → 558 (−4%) | 122 → 234 (+92%) | 656 → 661 (+1%) | 2% | 6 |
| 5-2-0 | best | 3,130 → 3,119 (0%) | 5,108 → 4,683 (−8%) | 1,773 → 2,515 (+42%) | 6,027 → 6,064 (+1%) | 0% | 10 |
| 5-0-2 | best | 3,898 → 3,880 (0%) | 6,484 → 5,914 (−9%) | 2,253 → 3,272 (+45%) | 7,612 → 7,655 (+1%) | 0% | 10 |
| 2-5-0 | best | 292 → 299 (+2%) | 474 → 473 (0%) | 82 → 175 (+114%) | 543 → 556 (+3%) | 2% | 6 |
| 2-0-4 | best | 703 → 709 (+1%) | 752 → 718 (−4%) | 148 → 262 (+76%) | 790 → 793 (0%) | 49% | 4 |
| 2-0-5 | best | 4,513 → 4,503 (0%) | 2,101 → 2,246 (+7%) | 335 → 462 (+38%) | 1,117 → 1,142 (+2%) | 92% | 4 |
| t0 | far | 0 → 103 | 0 → 110 | 0 → 22 | 0 → 183 | 0% | 3 |
| 5-0-2 | far | 3,366 → 3,514 (+4%) | 4,798 → 4,775 (0%) | 356 → 1,503 | 5,322 → 7,641 (+44%) | 0% | 10 |

Throughput at her spot is today's: the crowd and parked-boss columns stay within −1…+5% at every build (+5% at t0 is her always-on bolt). Sparse waves lose up to 9% to flight time at tier 5.

### 8.4 Real waves, Chika alone (`res/fin-*.jsonl`, `res/sabo-H2.jsonl`; mean of 3 seeds; critic 1)

"Best of each" compares today's better spot with the new kit's better spot (`reach` is what `autoPlan` and most players will find).

| Stage, profile, build | Kills today | Kills new: today's spot / reach spot | Change (best of each) | Lives lost today → new | Far spot: new kills (% of her best) |
|---|---|---|---|---|---|
| 1-3 base t0 | 227 | 277 / 279 | **+23%** | 270 → 218 | 169 (60%) |
| 1-3 base 0-0-2 | 397 | 418 / 412 | **+5%** | 100 → 79 | 381 (91%) |
| 1-3 base 2-0-0 | 497 | 497 / 497 | 0% | 0 → 0 | 489 (98%) |
| 2-5 base 3-0-0 | 494 | 578 / 723 | **+46%** (+17% at today's spot) | 274 → 130 | no far spot on 2-5 |
| 2-5 base 0-0-3 | 288 | 340 / 389 | **+35%** (+18%) | 445 → 370 | — |
| 3-5 base 3-0-0 | 99 | 95 / 111 | **+12%** | 312 → 300 | 59 (53%) |
| 4-5 base 5-0-2 | 389 | 385 / 388 | 0% | 25 → **2** (the final Ashwing now dies) | 389 (100%) |
| 4-5 base 2-0-5 | 389 | 388 / 320 | 0% | 25 → 28 | 227 (59%) |
| 4-5 strong 3-0-0 | 389 | 387 / 389 | 0% | 25 → 25 | 386 (99%) |
| 6-5 strong 5-0-2 (sappers) | 796 | 782 / 778 | −2% | 0 → 0 | 845 (108%) |

Early and mid game she is **clearly stronger** (+0…+46% kills; median about +17%) because her drones now cover much more lane: reach 5.0 at tier 0 against today's 3.22. Where she already kills everything, nothing changes, except that a 4-5 base 5-0-2 Chika now finishes the Ashwing.

### 8.5 Bosses: the whole lane, and inside an escort (critic 2)

**Full pass** (`fullpass`; the better of the two spots for each path, so an upper bound):

| Build | strong, path 0 | strong, path 1 | base, path 0 / path 1 |
|---|---|---|---|
| t0 | 1,696 → 8,498 (+401%) | 3,894 → 7,368 (+89%) | 0 → 0 (armor) |
| 3-0-0 | 7,906 → 29,102 (+268%) | 17,734 → 26,774 (+51%) | +240% / +54% |
| 5-2-0 | 171,490 → 279,340 (+63%) | 226,186 → 282,404 (+25%) | +54% / +24% |
| 5-0-2 | 216,466 → 351,644 (+62%) | 286,858 → 364,056 (+27%) | +53% / +24% |
| 2-0-5 | 21,862 → 61,858 (+183%) | 44,470 → 59,132 (+33%) | +153% / +31% |

**Boss inside a dense escort, Strong mode** (`focus`): boss DPS t0 90 → 198 (+120%), 3-0-0 209 → 624 (+199%), 5-0-2 2,698 → 6,685 (+148%). Today about half of her drones' shots at the boss hit an orc in the way (boss share of her fire 0.47–0.61); guided shots put 0.97–0.99 on the boss. Against the same boss **alone** nothing changes (parked column, §8.3).

For scale (Potential spec §8.1, same preset): Chika 5-0-2 against a boss walking past goes from 2.25k to 3.27k/s; Shiro does 13.6k, Kage 1.75k. She stays second.

### 8.6 Standing back, sappers, volatile blasts, Chika lines (critic 9)

**Sapper and volatile stages, Chika alone** (`res/sabo-old|Fns|H2.jsonl`, mean of 3 seeds; "no rule" = drones that sappers ignore, measured to show what the rule costs):

| Stage | Build | Spot | Kills: today / no rule / ships | Lives lost: today / no rule / ships | Seconds she is disabled: today / no rule / ships | Drone jams (ships) |
|---|---|---|---|---|---|---|
| 6-3 | 3-0-0 | best | 325 / 315 / 322 | 39 / 49 / 42 | 0 / 14 / 1 | 49 |
| 6-3 | 3-0-0 | far | 0 / 325 / 325 | 364 / 39 / 39 | 0 / 0 / 0 | 42 |
| 6-4 | 3-0-0 | best | 750 / 797 / 735 | 218 / 168 / 233 | 0 / 0 / 0 | 108 |
| 6-4 | 3-0-0 | reach | 678 / 819 / 773 | 290 / 141 / 187 | 66 / 46 / 50 | 114 |
| 6-4 | 5-0-2 | best | 949 / 949 / 949 | 0 / 0 / 0 | 0 / 0 / 0 | 84 |
| 6-5 | 3-0-0 | best | 807 / 824 / 781 | 81 / 63 / 107 | 70 / 60 / 46 | 123 |
| 6-5 | 3-0-0 | far | 0 / 748 / 706 | 939 / 164 / 202 | 0 / 0 / 0 | 89 |
| 6-5 | 5-0-2 | far | 874 / 845 / 845 | 17 / 0 / 0 | 0 / 0 / 0 | 62 |

- **Sappers**: they still go for girls first, exactly as today; with no girl in their 1.6 tiles they jam the nearest roaming drone for 3 s (same cooldown). On these stages that costs her up to 8% of her kills against "no rule" and leaves her within −3…+14% of today, spot by spot. Standing back no longer escapes sappers: at the far spot 42–89 jams land on her drones.
- **Two stricter rules were measured and rejected**: "a sapper near any of her drones disables her" (`res/sabo-F1.jsonl`: 150–320 s disabled, 6-5 5-0-2 from 0 to 69 lives lost), and "a volatile blast near a drone stuns her / jams it" (`res/sabo-Fvd.jsonl`, `res/sabo-H.jsonl`: 6-4 3-0-0 kills 750 → 391 / 510). Drones fight 0.5 tiles from their targets, so either rule turns every sapper or bomber into a hard counter, and today's Chika is not stunned by blasts at her best spot either (0 s on 6-4).
- **Chika lines in co-op freeplay** (`fp/res-*.txt`; Blossom, "strong", every other copy a Chika at Sentry 5 / Tesla 2 placed by drone reach; the old kit placed by her range): 1-3 — today 5 Chikas, 11% of the damage, first leak 146, dies at 150; new 6 Chikas, 21%, first leak 150, dies at 152. 8-5 — today 16 Chikas, 20%, first leak 120, dies at 134; new 17, 36%, first leak 130, dies at 135. Her share doubles (her drones take kills from teammates); the run lasts 1–2 waves longer, inside the freeplay spec's calibration band (strong: 140–160 on 1-3).

### 8.7 The whole team: campaign (`res/camp-*.jsonl`; critic 17)

`autoPlan` team (Hikari, Chika, Aoi, Yuki), 10 stages × Normal/Hard × seeds 7/8/9 = 60 runs, `autoPlan` placing Chika by drone reach:
- **One outcome changes: 5-5 Normal**, lost at wave 24 (of 25) in all 3 seeds today, is **won in all 3**. With today's placement rule it is won in 2 of 3 (`res/camp-H2np.jsonl`), so it is the kit, not the placement. **No win becomes a loss.**
- Other losses last longer: 2-3 Hard wave 12 → 18 (12–14 with today's placement), 4-3 Hard 14–15 → 16–17, 4-5 Normal 21 → 25, 6-5 Hard 15 → 16. Wins end with 2.7 more lives on average.
- Chika's share of team damage: 24% → 29%.

### 8.8 Lockstep cost at freeplay densities (`res/perf.jsonl`; critic 4)

6 Chikas at 5-0-2 (60 drones), an immortal orc every 2 steps on every path (~2,345 live enemies), µs per step after 30 s; old and new interleaved, 3 rounds, on a shared 4-core machine at load 23–33 (noisy):

| Engine | Kit | Mean per round | Median step |
|---|---|---|---|
| V8 (Node 22) | today | 5,755 / 5,127 / 4,783 | 3,621 / 2,976 / 1,843 |
| V8 (Node 22) | new | 5,025 / 4,587 / 4,992 | 1,732 / 1,554 / 1,337 |
| JSC (Bun 1.3.14) | today | 2,235 / 3,146 / 2,887 | 670 / 868 / 756 |
| JSC (Bun 1.3.14) | new | 3,016 / 2,875 / 2,742 | 586 / 726 / 472 |

At ~940 enemies: Node 1,693 → 1,639 µs, Bun 1,390 → 911 µs. **No slower than today** (revision 1 was 1.3–2× slower here). What fixed it: the stable top-k pool reused for 4 steps, step-keyed staggered schedules (no per-drone queries every step), opportunity checks every 6 steps, and guided shots (no grid query per drone bullet). 99th percentiles are dominated by GC and machine noise in both kits.

### 8.9 What it means, and the knobs

- Her role is unchanged: the same damage where she stands, the same panel DPS.
- Following is the buff, and it is real: more lane covered early and mid game, bosses chased along the lane, Strong mode that actually lands on the boss. One campaign stage (5-5 Normal) flips to a win.
- Standing back works for damage but meets sappers through her drones; Tesla builds still need to stand close (the coil is her bolt).

| Knob (data or one constant; each is one co-op id bump) | Effect (measured) |
|---|---|
| `turret.rate` (1.5) | ×0.9 (option G, `res/camp-G.jsonl`, `res/sw-T2.jsonl`): crowd −6…−10%, parked −9…−12%, walking boss tier 5 +11…+46%, escort focus +96…+173%; **5-5 Normal still flips** (3 of 3). Not recommended: it costs her crowd role without removing the flip. |
| `turret.leash` (4.0 / +0.25 / +0.5) | 4.5 from the start (`res/sw-S4.jsonl`) measured within ±5 points of 4.0 in real waves: mostly a looks choice (Q3). |
| `turret.range` (gun 1.0) | 0.8 (`res/sw-T3.jsonl`) trims mid-game reach (2-5 3-0-0 +45% → +14%) at no cost at her spot. The first knob to turn if early/mid game proves too strong. |
| `DRONE_GUIDED` | Off: escort focus −45…−70% instead of +120…+199% (drones hover inside the escort and its orcs eat the shots); worse than today. |
| `base.rate` (bolt 0.8) | Her tier-0 share (15%). |

### 8.10 Gates before merge (re-run on the real branch with `NO_OVERLAY=1`)

1. `bench.mjs`: crowd and parked boss within ±6% of `res/fin-old.jsonl` at every build from tier 2 up, both profiles (best spot); at tier 0 within −5…+16% (her always-on bolt on tiny numbers: base 7.2 → 7.9 and 3.3 → 3.8).
2. `measure.mjs waves`: no case below −5% kills against today; no case above **+50%** kills (best of each).
3. `measure.mjs fullpass`: tier 5 (5-x-x) ≤ **+70%** on every path.
4. `campaign2.mjs`: no win becomes a loss; flips limited to the 5-5 Normal flip listed above (re-approve anything else).
5. `measure.mjs sabo`: ships ≥ −5% kills against today at best/reach spots.
6. `perf3.mjs`: new mean ≤ today × 1.10 (median of 3 interleaved rounds) at ~2,345 enemies in Node **and** Bun.
7. `det2.mjs` / `det2-ff.mjs`: V8, JSC and SpiderMonkey equal; `hashpin.mjs`: battles without drones equal to today.
8. `splitrun.mjs` (as a vitest in battle-save): all equal.
9. The Potential spec's Chika bench row re-run (their §8 asks for it after #166).

### 8.11 Variants measured and not shipped (`res/sw-*.jsonl`, compact set, seed 9)

| Variant | What | Why not |
|---|---|---|
| Rev. 1 (V5) | roam 3.25 + gun 1.5, bolt 3 × 0.8 | Detachment barely visible (0.25 tiles past her ring); critic 3. |
| R1 | roam 4.5, gun 1.0, bolt 3 × 0.8 | Early game +40% kills (1-3 t0), +48% (2-5); escort focus −50…−70% (unguided shots). |
| R3/R4/R6 | **magazine sorties** (8 or 6 shots, fly home to reload) | Collapses at tier 5: crowd −47…−57%, parked −30…−40%. |
| S1/S2/S5 | **signal falloff** (60% / 50% damage at the roam edge) | First-mode drones chase the leaders at the edge: crowd −30…−38%. |
| F | sapper near any drone disables her | 150–320 s disabled on 6-x; 6-5 5-0-2 0 → 69 lives lost. |
| H | + volatile blasts jam drones | 6-4 3-0-0 kills 750 → 510. |
| G | drone fire rate ×0.9 | §8.9. |

---

## 9. Tests

**Unit (vitest)**
- `tests/sim/towers.test.js`:
  - the existing "turrets" test stays: the fixture `engineer` has no `leash`, so it is anchored at 0.62.
  - New `describe('roaming drones')`, fixture `roamer` (`turret: { max: 2, damage: 6, rate: 3, range: 1, leash: 3, speed: 4, build: 1 }`, base projectile):
    1. drones reach a parked enemy 3.5 tiles away (beyond her own range) and never leave the disc while it does not change;
    2. **disc shrink** (critic 11): cut `leash` by 0.4 mid-flight → a drone outside never moves outward and is inside within `ceil(excess / (speed·STEP)) + 1` steps;
    3. they are exactly home within `leash / speed + 0.1` s after the last enemy dies;
    4. Σ `drone.dmg` = `t.droneDmg`, Σ kills = `t.droneKills`, `damageDealt − droneDmg` = her bolt's hits;
    5. First → two drones on two enemies; Strong → both on one; on Strong a stronger enemy entering reach takes the whole wing within 1 s (kept only while #1);
    6. First: a target of opportunity is shot while the quarry is out of gun range; Strong: none while flying to the focus target;
    7. **guided**: a drone bullet passes through an enemy standing between it and its target without hitting it, and fizzles (no hit, gone next step) when its target dies first;
    8. disabled → no movement or shots, then they resume;
    9. a sapper with a girl in reach disables the girl, as today; with no girl in reach it jams the nearest drone for 3 s (that drone hovers, no shots) and spends its cooldown; a disabled or cleansed Chika's drones are skipped; a volatile death next to a drone does nothing to it or to her;
    10. sell → drones gone, in-flight drone bullets die;
    11. the build timer uses `turret.build`; an aura `rateMul` shortens it; a `chain` transform keeps building;
    12. her bolt fires before the wing is full;
    13. `topTargets` equals `selectTargets` (stable sort + truncate) on 200 random crowds in every mode, ties included;
    14. no drone timers: two sims that differ only in a dead quarry left on a drone at a calm point play on identically.
- `tests/sim/mods.test.js`: `leash`/`speed` add; unit `rangeMul` scales `leash`; `build /= rateMul`; `normTurret` defaults.
- `tests/data/units.test.js` (`:140, :174-179`): turret mod keys gain `leash, speed`; base turret keys gain `leash, speed, build`. Chika: `base.behavior === 'projectile'`, `turret.leash > base.range`, Tesla T4 coil = 9 damage × 1.0/s, and its text does not contain "Stops building".
- `tests/sim/battle.test.js` determinism (`:72`): add a Chika; compare drone positions and `droneDmg` across two runs.
- `tests/online/simHash.test.js` (new case): the hash changes when only a drone moves; a battle without drones keeps a pinned digest.
- `tests/battle-ui/towerPanelTabs.test.js` (new): the tab row only for roaming-drone owners; first open = Overall, reopen = last tab; **buying an upgrade while on the Drones tab stays on the Drones tab** (critic 7); Overall DPS = Chika DPS + Wing DPS, also while the wing is building (critic 15); Overall keeps "Upgrades x% cheaper (gear …)" and the Aura row; the Chika tab shows the Aura; split-bar percentages; a drone row → `ctx.select(owner, { drone })`; drone-card labels per state; ◀ ▶ wrap; ‹ returns to the tab it came from; the ally card is read-only; `createRateMeter` window math.
- `tests/render/pick.test.js`: priority flying drone > footprint > body > home drone, with a stubbed projector.
- battle-save (`tests/battle-ui/snapshot.test.js` in wt-battlesave): `KNOWN_DRONE_KEYS` guard; 12-field rows round trip; old 5-field rows restore with zero counters; `droneSerial = max(saved, highest n)`; and **split-run equality with roaming drones**, including saves with drones still flying home and drones jammed (port of `exp2/splitrun.mjs`; its existing scenarios already field Chika; add the 6-3 Chika-alone one).

**Engines determinism**
- `e2e/engines/scriptedBattle.js`: a **separate `DRONES_START` scenario** (so `START` and its anchor stay): Chika 5-0-2 cycling target modes, Chika 2-0-5 on Strong, a sapper stage. `node e2e/engines.mjs --require-all` (Chromium/V8, Firefox/SpiderMonkey, WebKit/JSC) must agree; `tests/online/engines.test.js` adds `drones ≥ 3`.
- The prototype equivalent already agrees in Node, Bun and Firefox (`exp2/det2.mjs`, `det2-ff.mjs`). When roster B3 lands, re-run with Chika on its `air` mode.

**e2e (new `e2e/chika-drones.mjs`, at 844×390 and 1280×720)**
1. Grant Chika, place her about 3.8 tiles from a lane, start wave 1. Via `window.__battle.sim`: a drone's distance from her exceeds her range while her damage rises.
2. Tap Chika: the tab row is visible and **Overall** selected; header "Damage" = `damageDealt` (rounded); the split bar is present; Overall DPS = Chika DPS + Wing DPS as read from the tabs.
3. Tap **Upgrades**, buy one: still on Upgrades after the re-render. Tap **Drones**: rows = `droneStats` length; names start with "Sprocket"; at 844×390 `drone-row-1` lies wholly inside the scroll area without scrolling.
4. Project a flying drone through a new debug hook `__battle.renderer.droneScreen(uid)` and tap it: `drone-card` shows its name, a state line and Damage dealt; **▶** shows #2; **‹** returns to the Drones tab.
5. Close and reopen her: the Drones tab is still selected.
6. Screenshots `chika-overall`, `chika-tab`, `drones-tab`, `drone-card` at both sizes; nothing clipped horizontally.

`e2e/stat-display.mjs`: taps `tab-upgrades` before `buy-0`; its DPS, "Drones n/9 · … dmg × …/s each" and "Upgrades 20% cheaper (gear 20%)" checks stay on Overall (today's lines, kept); "New drone every …s" becomes the Drones tab's "Flying 0/9 · builds during waves (every 4.0 s)".

---

## 10. In-flight work: how this fits

| Work | Interaction | Who edits what |
|---|---|---|
| **Co-op freeplay** (`wt-freeplay`) | Both touch `towers.js`, `Sim.js`, `enemies.js`. This spec's patches **applied cleanly on top of freeplay's final prototype files** (`exp2/fp/`, `SRC_ROOTS=…/coop-freeplay/exp/final/overlay`): no textual overlap. Freeplay only clamps `targetScore('strong')` (`:240`), which the drone pool uses unchanged. Both bump the co-op id; ship them in one release if possible. Their pinned digests (`3689325c`, `3f135b46`) are battles without Chika, so they hold (§4). Chika lines in their bot: §8.6. | No change to their spec. |
| **Battle save** (`wt-battlesave`, built) | New tower and drone keys classified and snapshotted (§5); split-run equality proven on their real restore code. | The second branch to land edits `snapshot.js:56-65, 106, 196` and its test; `restoreDrone` comes from `towers.js`. |
| **Attack FX** (`wt-attack-fx`, render only) | Its own drone flight is replaced by drawing the sim's drones (§6.1); the roam ring replaces its range leash. Its sim id pin follows live. | If attack-FX merges first, this spec's M5 edits `patterns/drones.js` and `ATTACK_FX.md`; otherwise attack-FX rebases and does M5. Until M5 ships, attack-FX's Chika style falls back to the legacy mesh when `turretSpec.leash > 0`. |
| **Roster B3** (`wt-roster`, `3c47a32`) | `refreshEffective(t, globalRateMul, globalDmgMul)` → put `leash/speed/build` into their version (they already add `gather: 0` to `turretSpec`). Their relay/familiar is a fixed origin near the lane (`t.ox/oy`, `relay.reach`); drones are separate mobile shooters, so the words do not overlap. Their `air` target mode works for drones through `targetScore` (it spreads). `_hit(q, src, spec, 1)` for curses keeps working (`drone` defaults to null). | Whoever lands second merges `refreshEffective`. |
| **Codex modes** (spec) | Blizzard ×0.85 scales roam and gun; Heat Mirage −0.5 and Prism +0.7 go to the roam radius once (§3.6); Firefly ×1.25 reaches drones through the hit scale. Their 0.3 s ring ease applies to the roam ring. | One extra branch in their `refreshEffective` change. |
| **Potential** (spec) | Whole-girl steps (`+3% range, drones too`) scale roam and gun through unit `rangeMul`; her bolt gets the damage/rate steps. Their spec already asks to re-run her row after #166. | Re-run their Chika bench row on the branch (gate 9, §8.10). |
| **Unit info** (`wt-unit-info`) | `SUB_KEYS.turret`, `turretShort`, the `chika.2.3` note (§7.2). | Whoever lands second. |
| **Hero rework** (spec) | No overlap: Chika is never a hero; drone kills credit Chika like any girl's. | — |

---

## 11. Risks

1. **A real power gain for an SSR gacha girl while the economy is under review** (§8): stronger in early/mid real waves, against walking bosses, and much stronger in Strong mode against a boss inside its escort; one campaign stage (5-5 Normal) flips to a win. Mitigation: owner sign-off (Q2) with the numbers, the measured knobs in §8.9 (the gun range is the first one to turn), and every number in data.
2. **Strong-mode boss focus** (+120…+199% in the escort test) comes from guided shots no longer being blocked by escorts. If playtests find bosses melting, `DRONE_GUIDED` (one constant) is the wrong fix: off, escorts block the drones' shots and Strong mode ends up worse than today (drones hover inside the escort). The gun range and fire rate (§8.9) are the knobs to turn. Watch boss waves in playtests.
3. **Standing back** still works for damage (§8.4); sappers jam her drones there, volatile blasts do not reach her. Players stacking Chika lines behind the front could out-perform the bench; the freeplay bot with Chika lines (§8.6) lasted 1–2 waves longer, inside the calibration band.
4. **Merge conflicts in `towers.js`** with roster B3 and codex modes: keep this change in contiguous blocks (`createTower` fields, `refreshEffective` lines, the drone section, the projectile branch).
5. **Attack-FX timing**: until M5 lands, its old steering would fly decorative drones around sim drones that really move. Mitigation: ship M5 in the same release, or the legacy-mesh fallback (§10).
6. **Tap ambiguity**: a flying drone over another girl wins the tap (§6.2). A wrong pick costs one more tap; the drone card's ‹ goes straight back.
7. **Phone panel height** (332 px): the tab row puts the owner's feature on screen; the upgrade paths move one tap away on the first open per battle (coin dot on Upgrades when affordable).
8. **Copy debt**: the Tesla Tower text was already wrong ("Stops building drones"); fixed here. "Sentries" becomes "Drones" on the student page.
9. **The co-op id bump** forces both players to update: accepted and expected.

---

## 12. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Sim core: `constants` (slots, schedules), `mods` (leash/speed/build), `towers` (`makeDrone`, `restoreDrone`, `topTargets`, pool, `updateRoamingDrones`, guided/fizzling drone bullets, build timer), `Sim` (`_hit/_credit/_killEnemy` drone param, `towerStats` additions, `droneStats`, `findDrone`), `enemies` (sappers jam drones when no girl is in reach) | All §9 sim unit tests pass; the anchored fixture is unchanged; non-drone battles keep their `hashSim` digests. |
| M1 | Chika data and copy (§3.6), `headless` reach, student-page copy | The §8.10 gates pass on the branch; raw result files saved; the Potential Chika row re-run. |
| M2 | Co-op: `simHash` drones, `DRONES_START` in the engines script | `e2e/engines.mjs --require-all` passes in all three engines; the new sim id is in the release notes. |
| M3 | Panel: tab row, split bar, Overall/Chika/Drones tabs, drone list, drone card (◀ ▶ ‹), `createRateMeter`, `droneNames.js`, CSS for both sizes | Battle-ui unit tests pass; manual pass at 844×390 and 1280×720. |
| M4 | Picking and selection: `pick().droneUid`, `ctx.select(uid, {drone})`, overlays (ring, tether, reticle, roam ring), `renderAlpha` + legacy `actors` interpolation | Render unit tests pass. |
| M5 | Attack-FX draws the sim's drones (§6.1); `ATTACK_FX.md` truth rules | Attack-FX tests pass; its digest test still shows no sim writes; reel `chika-before-after.mp4` regenerated. |
| M6 | Battle-save fields (§5) | Classification, round-trip and split-run tests pass; Continue shows the same per-drone totals. |
| M7 | `e2e/chika-drones.mjs`, `stat-display.mjs` update, screenshots, docs (CONTRACTS §6 drones and §10 selection, `docs/ROSTER.md` Chika, `docs/ATTACK_FX.md`), unit-info note removed | Full suite, build and smoke pass. |

The owner answers Q1–Q3 before M1 (data) and M3 (UI); M0 does not depend on them.

---

## 13. Owner questions (each has a default that ships if you say nothing)

**Q1. "split her stat between base and drone": show it, or let players set it?** Default: **show it** — the Overall / Chika / Drones tabs. The alternative is a Focus switch on her panel (Wrench ⇄ Balanced ⇄ Drones) that moves power between her bolt and the wing; that adds a co-op command, a balance axis and more phone screen. Your second message ("chika tab and drone tab") reads as display, so display ships unless you meant the switch.

**Q2. Is this much extra power OK?** (all numbers in §8; nothing about coins, costs or rewards changes)
- Against a crowd, or a boss standing at her spot: **the same as today** (−1…+5%).
- Chika alone in real waves, early and mid game: **clearly stronger**, because her drones now cover much more of the lane — +0…+46% kills (median about +17%). Once she kills everything (tier 5) nothing changes.
- A boss walking her whole lane: **+25…+63%** at tier 5, two to five times today's (small) damage at tiers 0–3.
- Strong mode against a boss inside its escort: **+120…+199%** — her drones' shots now always reach the boss instead of hitting the escort in the way. Against the same boss alone: unchanged.
- Whole-team campaign (60 runs): **5-5 Normal**, which this team loses at wave 24 of 25 today, is **won in all 3 seeds**; no win becomes a loss; other losses last 1–6 waves longer.
- Co-op freeplay with Chika lines: 1–2 waves longer.
- She can now fight from about 4 tiles back, but sappers jam her drones there.

Default: **ship it as specified.** If you want her gentler, the first knob is her drones' gun range (1.0 → 0.8 cuts the mid-game gain from +45% to +14% in the 2-5 test and changes nothing at her spot). A 10% slower fire rate was measured too and is not recommended: it weakens her against crowds and still flips 5-5 Normal.

**Q3. How far should the drones fly from her?** Default: **4.0 tiles at the start (1 tile past her range ring), 4.25 at Sentry Grid, 4.75 at Mecha-Fortress**, shown by its own dashed ring — see `exp2/clip/chika-roam-old-vs-new.webm`. Options: **4.5 tiles from the start** (more visible; measured within ±5 points of the default in real waves, so mostly a looks choice), or **patrol her whole nearest lane** (not built; much stronger, it would need its own balance pass).

---

## 14. Appendix: prototype and evidence (`four-features/chika-rework/exp2/`)

| File | What |
|---|---|
| `make-overlay2.mjs` | Writes an overlay (constants, mods, towers, Sim, enemies, headless, simHash, units, plus battle-save's `snapshot.js`/`battleSave.js` copied from `wt-battlesave` with §5's edits) as asserted exact-once replacements. `node make-overlay2.mjs <dir> <cfg.json>`; `SRC_ROOTS=<other prototype overlay>` stacks it on another prototype (used for freeplay). Flags cover every variant in §8.11. |
| `build.mjs`, `entry.js`, `entry-bs.js`, `runvar2.sh` | Bundle the real sim with one or more overlays (`OVERLAY=a:b`), or the live code (`NO_OVERLAY=1`). |
| `var/H2.json` | **The shipping configuration.** `var/*.json`: every other variant. |
| `measure.mjs` | `waves`, `fullpass`, `focus`, `sabo` (§8.2). |
| `bench.mjs`, `benchtab.mjs` | The per-girl bench and its table (§8.3). |
| `campaign2.mjs`, `cmpcamp.mjs` | Team campaign and its comparison (§8.7). |
| `fp/bot.mjs` (+ `fp/res-*.txt`, `fp/runs/`) | The freeplay bot with Chika lines (§8.6). |
| `perf3.mjs`, `perf.sh` | Lockstep cost, interleaved, Node and Bun (§8.8). |
| `det2.mjs`, `det2core.js`, `det2-ff.mjs` | Cross-engine determinism in V8, JSC and SpiderMonkey (§4). |
| `hashpin.mjs` | Battles without drones keep their `hashSim` digests (§4). |
| `invariants2.mjs` | Bookkeeping, the shrinking-disc rule, calm points, home after a wave (§3.4, §9). |
| `splitrun.mjs`, `dbgsplit.mjs` | Battle-save split-run equality on the real restore code, and the step-by-step debugger that found the two calm-point bugs (§5). |
| `sappers.mjs` | Which stages field sappers and volatile enemies. |
| `clip/` | `chika-roam-old-vs-new.webm` (12 s, 30 fps) and `chika-roam-still.png`, recorded from real sim positions of the live kit and the shipping variant (`out-old`, `out-H2`; 2-5 wave 9, Chika at Sentry 3 on today's best spot; `rec.mjs`) and drawn by `clip.html` / `record.mjs`. Drones sharing a spot are fanned out by ≤ 0.3 tiles, as the FX will. |
| `res/` | Every raw result: `fin-*` (bench, waves, fullpass, focus), `sabo-*`, `camp-*`, `perf.jsonl`, `sw-*` (the variant sweep), `inv-*.json`, `splitrun-*.txt`. |

### A.1 Base profile (neutral stats), best spot

| Build | Crowd | Sparse | Boss walking past | Boss parked | Her share (crowd) |
|---|---|---|---|---|---|
| t0 | 7.2 → 7.9 (+10%) | 11.8 → 13.1 (+11%) | 0.5 → 1.1 | 3.3 → 3.8 (+15%) | 15% |
| 3-0-0 | 34.0 → 34.7 (+2%) | 56.9 → 56.4 (−1%) | 6.3 → 10.7 (+70%) | 31.6 → 32.2 (+2%) | 4% |
| 5-2-0 | 398 → 397 (0%) | 662 → 605 (−9%) | 200 → 280 (+40%) | 699 → 699 (0%) | 0% |
| 5-0-2 | 498 → 498 (0%) | 831 → 762 (−8%) | 256 → 359 (+40%) | 880 → 881 (0%) | 0% |
| 2-0-5 | 717 → 717 (0%) | 265 → 247 (−7%) | 30 → 45 (+49%) | 121 → 121 (0%) | 95% |

At tier 0 her always-on bolt is 15–21% of tiny numbers, hence the +10…+15%.

---

## 15. Critic resolution

Every issue in `CRITIC.md`, in its order. "Fixed" means the spec text, the prototype and the evidence changed.

| # | Sev | Issue | Resolution |
|---|---|---|---|
| 1 | HIGH | "Throughput unchanged" is false in real waves; the sign-off understates the buff | **Fixed.** §0, §8.4, §8.7 and Q2 now say it plainly: clearly stronger early and mid game (+0…+46% kills alone, +17% median), unchanged once she kills everything. New gates with enemies that die: `measure.mjs waves` (10 cases × 3 seeds × 3 spots) and the team campaign (60 runs, Normal and Hard). The critic's tier-0 parity idea (a smaller tier-0 roam) was measured against issue 3: it is not needed once the gun shrinks to 1.0 and her bolt to 2 × 0.8; option G (−10% fire rate) is also measured and not recommended (§8.9). |
| 2 | HIGH | The walking-boss buff was measured too narrowly; the gate would fail | **Fixed.** The boss bench is now a full lane pass on every path from the spawn (§8.5), plus a boss inside a dense escort. Numbers restated in §0/Q2: +25…+63% at tier 5, 2–5× at tiers 0–3, +120…+199% in Strong mode inside an escort. The gate is set where the shipped data sits (tier 5 ≤ +70%). The Potential row re-run is gate 9 (it needs their prototype stacked; listed for M1). |
| 3 | HIGH | "Detach from her radius" barely delivered | **Fixed.** The visible flying distance is the design axis: **4.0 tiles at tier 0 (1 tile past her ring), 4.25 / 4.75 by tier**, paid for with a 1.0 gun and a weaker bolt. A dashed ring shows it. A 12-second old-vs-new clip from the real sim is in `exp2/clip/`. **Q3** added with the default and options. Differs from the critic's 4.5 default: 4.5 measured within ±5 points of 4.0 (§8.9), so 4.0 → 4.75 by tier keeps an upgrade reward; 4.5 flat is Q3's option. |
| 4 | MED | 1.3–2× slower at freeplay densities | **Fixed.** Stable top-k pool (O(N·k)) reused for 4 steps, step-keyed staggered re-thinks, opportunity checks every 6 steps, guided shots with no grid query (§3.2). Measured at ~2,345 and ~940 live enemies, Node and Bun, interleaved: no slower than today (§8.8). Perf gate 6 added. |
| 5 | MED | The `hashSim` change rewrites every pinned digest | **Fixed.** Drones are folded only for girls that have some; three full battles without Chika give identical digests on live and prototype (§4). Re-pins of battles that include Chika are listed in §4/§10. |
| 6 | MED | On the phone the Stats tabs are never on screen | **Fixed.** A top-level tab row **Upgrades · Overall · Chika · Drones** sits right under Target, sticky in the scroll area; heights worked out for 844×390 (first drone row ~202 px into a 290 px scroll area). The e2e assertion stays (§7.1, §9). |
| 7 | MED | Tab and drone-card state must survive re-renders | **Fixed.** Held in the panel closure, part of `signature()`, set only by `open()`, tab taps and drone selection; unit test "buying an upgrade on the Drones tab stays on the Drones tab" (§7.1, §9). |
| 8 | MED | Overall drops today's rows (Aura, "Upgrades x% cheaper") | **Fixed.** Overall is today's full grid plus two lines; the Chika tab also shows the Aura (her Repair Bay). `stat-display.mjs`'s strings stay on Overall (§7.1, §9). |
| 9 | MED | Standing back escapes saboteurs; no Chika line in the freeplay calibration | **Fixed, with a different rule than suggested.** "A sapper near any drone disables her" was measured and **rejected** (150–320 s disabled on 6-x, 6-5 5-0-2 from 0 to 69 lives lost). Shipped: sappers still go for girls first; with no girl in reach they **jam the nearest drone** (3 s). Standing back now meets 42–89 jams per stage; at her best spot she stays within −3…+14% of today on 6-3/6-4/6-5. Volatile blasts stay body-only (a "blasts jam drones" rule cost 6-4 a third of her kills; today's Chika is not stunned at her best spot either). The freeplay bot was run with Chika lines on Blossom 1-3 and 8-5: 1–2 waves longer, inside the calibration band (§8.6). |
| 10 | LOW | Strong/Elite "focus" did not match the code | **Fixed in the code.** On focus modes a quarry is kept only while it is #1, and no opportunity shots are taken while flying to it; guided shots make the focus land (§3.2; tests 5–7). |
| 11 | LOW | The roam invariant test is wrong when the radius shrinks | **Fixed.** Rule: outside a shrunken disc a drone flies straight back to its edge. New test: never outward while outside, back within `ceil(excess / (speed·STEP)) + 1` steps; measured on an aura sold mid-wave (max excess 0.30 tiles, 16 steps outside, 0 violations). Range rule stated: multiplicative changes scale roam and gun; additive ones (Heat Mirage, Prism) go once to the roam radius (§3.6). |
| 12 | LOW | Interpolation plan does not work | **Fixed.** `px, py` stored in the sim at each step (calm for battle save, not hashed); α = `sim._acc / STEP` solo, `min(1, lockstep.acc)` in co-op, exposed as `ctx.renderAlpha()` (§6.1). |
| 13 | LOW | Tap order puts the footprint ahead of drones drawn in front | **Fixed.** A flying drone's 22 px disc is tested first; home drones still lose to her body (§6.2). |
| 14 | LOW | Browsing drones is a dead end | **Fixed.** ‹ returns to the tab you came from; ◀ ▶ step through the wing (§7.1). |
| 15 | LOW | Overall DPS ≠ Chika DPS + Wing DPS | **Fixed.** Both use the full wing, with "(full wing of N)" while building; live "Dealing" adds up too (§7.1). |
| 16 | LOW | Battle-save details: duplicate drone names; no split-run test | **Fixed.** `droneSerial = max(saved, highest n)` on restore. Split-run equality run on the real `snapshot.js`: **11 of 11** identical, including saves with drones flying home and drones jammed. It found two real bugs (a dead quarry left at the calm point; a drone bullet in flight hitting the next wave), both fixed by design (§5). |
| 17 | LOW | Campaign evidence did not use the shipped `autoPlan` | **Fixed** (overlay patches `headless.js`; campaign re-run, 3 seeds, Normal and Hard, §8.7). **Rejected in part**: `pathScore` needs no `leash` term, because it never counted `turret.range`, so path choices are unchanged (§3.7). |
| 18 | LOW | Stale tier note in unit-info | **Fixed.** Removed in the same change (§7.2). |
| 19 | LOW | Wording | **Fixed.** The drone card no longer says "4.5"; §2 says live drones are anchored and only the attack-FX WIP flies them; drone totals add up to `droneDmg`, not her whole total; two Chikas are told apart ("Chika (2nd)'s drone", co-op "Mika's Chika"). |
| 20 | LOW | The engines check is narrow | **Fixed.** `det2` covers all five target modes cycling, a Tesla build on Strong, sapper stops and an aura sold mid-wave; V8, JSC **and SpiderMonkey (Firefox 142)** agree. The engines fixture gets a separate `DRONES_START` scenario (so `START`'s anchor stays). Roster B3's `air` mode is a re-run gate when it lands (§9). |

Owner questions after these fixes: **Q1** kept as written (display by default); **Q2** restated with the numbers of issues 1, 2 and 9; **Q3** added (issue 3).

---

## 16. Flight modes addendum (revision 3, Oct 14: "operate like the helicopter")

Owner, Oct 14: *"chika should be strong, I want her to be like the helicopter or operate in a similar manner to the helicopter in [the big tower-defense game]. I know she is quite strong but that is the case with many units."* `OWNER_DECISIONS_OCT14.md` §1 and `LANDING_PLAN.md` Q-B / §10 row 6 turn that into: **player-chosen flight modes for her drone wing; Chika herself stays where she is placed; modes are deterministic lockstep commands (`fly`) and are saved in battle save.** This section supersedes Q3 (how far drones fly) and adds to Q2 (power, approved).

Everything below was **prototyped in the real sim on this branch** (`feature/chika-rework`; not an overlay) and measured with `tools/chika/measure.js` (run through `tools/chika/run.mjs`, which bundles the real `src/sim` with Vite). Raw outputs are in `docs/specs/chika-res/` (§16.10).

### 16.0 Verdict in one screen

- **Four modes, all from tier 0, picked on her panel:** **Hover** (default: today's 4-tile roam around her), **Hold** (the wing guards a point you tap), **Patrol** (it flies back and forth between two points you tap), **Pursuit** (map-wide: it chases her target mode's best enemies anywhere, at **85% fire rate**). "Follow the touch" is **tap a rally point**: tapping Hold again moves the point. One `fly` command per choice, so co-op stays command-based.
- **Hold and Patrol points** must lie inside her **signal range** = 2 × her roam radius (8 tiles at tier 0, 8.5 at Sentry Grid, 9.5 at Mecha-Fortress); a tap farther out is pulled in. Around the point the wing roams her full roam radius (Hold is Hover, moved).
- **Travel is real**: drones fly in straight lines at their speed (3.5 tiles/s, 4.5 at Mecha-Fortress). The Patrol position travels at 0.6 × that. Pursuit drones start from her side and fly to the target; nothing teleports.
- **Balance** (measured, §16.9): Pursuit hits a boss walking the whole lane **+43…+124%** harder than Hover (it can never beat her own parked-boss DPS × 0.85), kills **−8…+79%** in real waves (much better from a bad spot, about even with Hover at her best spot), and changes **no win or loss in 60 campaign runs** versus Hover; Hold/Patrol are situational (−9…+74% kills; their gain is placement freedom). Co-op freeplay with Chika lines: Pursuit ×0.85 **+1…+6 waves** over Hover (×1.0: +2…+6), never more than 9 waves past the same team without Chika. **Pursuit does not trivialize bosses.**
- **Determinism**: only `+ − × ÷` and `Math.sqrt` in the flight maths; the `DRONES_START` engines scenario (two Chikas through every mode on the sapper stage 6-5, 62 jams, a wave-8 checkpoint replayed) agrees in V8 and JavaScriptCore (§16.6). Battles without drones keep their hashes.

### 16.1 The owner's words mapped to behaviour

| Owner / decision | What the game does |
|---|---|
| "like the helicopter … operate in a similar manner" | Her wing has flight modes you pick on her panel, like the attack helicopter's: stay near (**Hover**), lock a spot (**Hold**), fly a route (**Patrol**), hunt anywhere (**Pursuit**). Chika herself never moves (Q-B default). |
| "Hover near her" | Today's roaming disc (§3): drones hunt within `leash` (4.0 / 4.25 / 4.75) of her. The default; a newly placed Chika hovers. |
| "Hold (lock in place)" | One tap on the map: the wing's centre moves to that point; drones hunt within `leash` of it and rest around it between waves. |
| "Patrol (fly between two points the player sets)" | Two taps: the wing's centre travels A → B → A … at 0.6 × drone speed, all the time (also between waves); drones hunt within `leash` of wherever it is. |
| "Pursuit (map-wide, chases the target-priority enemy anywhere)" | No disc: drones pick quarries from **every enemy on the map** by her Target mode (First = closest to the exit, Strong = toughest …), fly there at their speed and shoot at 0.85 × their fire rate. Between waves they fly home to her. |
| "Follow-the-touch becomes tap a rally point" | Hold's point is the rally point: tap **Hold** again, then the map, to move it. Never a live cursor stream. |
| "modes are deterministic lockstep commands (`fly`), saved in battle save" | `fly[uid, mode, qx1?, qy1?, qx2?, qy2?]` (1/1024 tiles, owner-only like `tgt`); `t.flight` is battle state, saved as row field `fl` (§16.7). |

### 16.2 The modes

| Mode | Wing centre | Roam radius `L` | Quarry pool | Home (no quarry, between waves) | Fire rate |
|---|---|---|---|---|---|
| **Hover** | Chika | `leash` | within `L + gun` of her | her side (slot offsets) | 1.0 |
| **Hold** | point A (pulled into her signal range) | `leash × FLIGHT_POINT_ROAM_MUL` (1.0) | within `L + gun` of A | around A | 1.0 |
| **Patrol** | position travelling A ↔ B | `leash × 1.0` | within `L + gun` of the position | around the position | 1.0 |
| **Pursuit** | Chika (for Close ordering) | ∞ | every eligible enemy on the map | her side | `FLIGHT_PURSUIT_RATE_MUL` (0.85) |

The quarry rules inside a mode are §3.2's: Strong / Elite focus the wing on the pool's #1; First / Last / Close spread it. Opportunity shots, guided bullets, standoff (gun × 0.5), the shrinking-disc rule, sabotage stalls and sapper jams all work the same in every mode.

**Signal range** = `leash × FLIGHT_SIGNAL_MUL` (2). It caps how far Hold / Patrol points may be from her: an attack-helicopter-like reach without making placement irrelevant. Points are pulled in when set **and re-pulled every step** (an aura that widened her leash may be sold), and kept inside the map.

**Tiers: every mode from tier 0** (Q-B's default). Why the numbers allow it (§16.9): at tier 0–3 Pursuit's gain is in kills from bad spots and in boss damage that is small in absolute terms (4-5 t0 full lane: 13k → 21k damage against a 10k-HP-class boss that a team kills anyway); Hold/Patrol never beat a well-placed Hover by more than the spot difference; and the 60-run team campaign shows **no outcome change** from any mode. A tier gate would hide the headline feature until 1,200+ coins for no measured benefit.

### 16.3 Sim design (`src/sim/towers.js`, `constants.js`, `Sim.js`)

- **State** (the landing plan's seam, filled in): `t.flight = null` (Hover) or `{ mode, ax, ay, bx, by, cx, cy, leg }` — the points as set (pulled into range), the wing centre `cx, cy` (Hold: A; Patrol: the travelling position) and `leg` (Patrol heading to B = 1, to A = 0). Created on the first `setFlight`; Hover and Pursuit keep the last points so switching back to Hold returns to the same spot.
- **`setFlight(sim, t, mode, ax, ay, bx, by)`** (export) / **`sim.setFlight(uid, …)`**: refuses girls without roaming drones, unknown modes and missing or non-finite points (Hold needs A, Patrol A and B). Hold / Patrol put the centre at A and set `leg = 1`. Every drone's quarry is cleared and the pool invalidated (`_poolLeft = 0`), so the wing re-thinks at once on the new frame.
- **`wingFrame(sim, t, spec, dt)`** runs once per girl per step at the top of `updateRoamingDrones` and returns `{ cx, cy, L, reach }` for the mode (table above). Patrol advances its position there: straight at `speed × FLIGHT_PATROL_SPEED_MUL × dt`, exact arrival, then `leg` flips. Nothing else in §3.2 changes: drones fly to "home = centre + (hx, hy)", to their quarry's standoff point clamped to the disc, or straight back to the disc's edge when outside it — **which is also how they travel when the mode or the point changes** (the centre jumps, the drones fly).
- **Pursuit**: `reach = L = ∞`, the pool is `topTargets(…, Infinity, …)` over every enemy (the grid query with an infinite radius visits every cell), and each shot's cooldown is `1 / (rate × 0.85)`.
- **Constants** (`constants.js`): `FLIGHT_MODES = ['hover', 'hold', 'patrol', 'pursuit']`, `FLIGHT_SIGNAL_MUL = 2`, `FLIGHT_POINT_ROAM_MUL = 1`, `FLIGHT_PATROL_SPEED_MUL = 0.6`, `FLIGHT_PURSUIT_RATE_MUL = 0.85` (owner, Oct 15: Q-F1 → 85%).
- **UI API**: `sim.flightInfo(uid)` → `{ mode, a, b, at, signal, roam }`; `towerStats().turret.flight`; `droneStats()` and `findDrone()` (§3.5) unchanged.
- **How drones travel**: straight lines at constant speed (`speed` tiles/s, exact arrival), the same mover as Hover; turns are instant in the sim. Smooth paths (banking, easing) are the renderer's job (§6.1 decoration ≤ 0.35 tiles); a curved sim path was not needed for the numbers and would add state.
- **Sappers**: the §3.2 rule in every mode — a sapper with no girl in its reach jams the nearest roaming drone. Wings far from the team (Hold, Patrol, Pursuit) meet sappers alone more often: on 6-4 / 6-5 Pursuit takes 67–260 jams per stage against Hover's 67–167 (§16.9.4). That is the mode's natural counter; no extra rule.
- **Selling, sabotage, building**: unchanged. A sabotaged Chika's drones stall wherever they are (the wing's centre, including the Patrol position, also stops).

### 16.4 Co-op (`src/online/coop/commands.js`, `simHash.js`, `version.js`)

- **Command** `fly[uid, mode, qx1?, qy1?, qx2?, qy2?]`, points in 1/1024 tiles (`flyArgs()` builds it). Owner-only (`notYours` otherwise, like `tgt`); `invalid` for an unknown mode (own keys only), or missing / non-integer points. `isValidCmd` allows **6** arguments for `fly` (4 for everything else).
- **`COOP_PROTOCOL` 3 → 4** with a comment naming train C (S9: the hero rework sets the same 4; nobody bumps it twice). The co-op id changes anyway (sim files).
- **Hash** (S8): inside the existing "only girls with drones" block, `flight.mode`, `cx·256`, `cy·256` are folded when `t.flight` exists. Battles without drones keep their digests (`tests/online/coopFly.test.js` compares against the old formula).
- **UI**: the panel's Flight row sends `ctx.act.fly(uid, mode, a, b)`; solo calls `sim.setFlight`, co-op queues `fly`. An ally's Chika shows the row disabled ("only her owner changes it").

### 16.5 Panel and board UI (both sizes; `src/ui/battle/chikaPanel.js`, `chikaFlight.js`)

```
┌ Chika  5-0-2 ───────────────────────────── ✕ ┐  header (one line of role on a short screen)
│ Kills 385   Damage 48,120                     │
│ Chika 4% ▕█░░░░░░░░░░░░░░░░░░▏ Drones 96%      │  split bar
│ ⌖ [First|Last|Strong|Close|Priority]          │  Target
│ ✈ [Hover|Hold|Patrol|Pursuit]                 │  NEW Flight row (data-testid flight-<mode>)
│ Drones guard your point · tap Hold to move it │  hint (PC; on a short screen only while picking)
│ [Upgrades•] [Overall] [Chika] [Drones 9]      │  tab row (sticky)
```

- **Phone 844×390** (panel 340 × 332): header 76 + split 16 + Target 30 + Flight 30 + tabs 32 ≈ 184 px → the Drones tab's first row, Wing DPS and Flying are on screen without scrolling (e2e asserts row 1). The labels "Target"/"Flight" become their icons, the role line stays on one line and the mode hint shows only while picking.
- **PC 1280×720** (352 wide): everything visible, hint line under the Flight row.
- **Picking points** (`createFlightControl`): Hold / Patrol arm the board — a banner at the top ("Tap where Chika's drones should hold" / "Patrol: tap the first point … the second point", Cancel), her **signal ring** (dashed amber) and the first Patrol point are drawn; the next board tap sends the command. Tapping the armed mode again, Cancel, Esc, deselecting her or a placement card cancels. Hover and Pursuit apply on tap.
- **Board**: a selected Chika shows her range ring, the **roam ring** (dashed cyan) at the wing's centre (her, the Hold point or the moving Patrol position; none in Pursuit), the Hold point marker, both Patrol markers joined by a dotted line. A selected drone adds its ring, a tether to her and a reticle on its quarry (§6.3).
- Overall shows the mode (`Flight · Pursuit`) and `Drones fly · Whole map` in Pursuit; Drones / drone card show the Pursuit fire rate.

### 16.6 Determinism and checks

- `tests/sim/drones.test.js` (22 tests): the §9 list plus flight: refusals, Hold pulled into signal range and roaming inside `leash` of it, Patrol travelling A ↔ B at 0.6 × speed, Pursuit reaching an enemy far beyond her reach at drone speed (not instantly) and coming home, points kept across mode switches.
- `tests/sim/snapshot.test.js`: the generic snapshot's split-run scenarios now switch Chika through Patrol / Pursuit / Hold / Hover every 10 s (≈ 180 mode changes across the three moments) and stay identical for 20,000 ticks after restore.
- `tests/online/coopFly.test.js`: the command's shape and owner rule; two clients flying one wing through all four modes with equal hashes and equal `droneStats`; the drone-less digest.
- `e2e/engines/scriptedBattle.js` **`DRONES_START`** (`runDronesBattle`): 6-5 Easy, the host's Chika 5-0-2 cycling all five target modes and all four flight modes, the guest's 2-0-5 on Strong in Pursuit; won at wave 28 with 12 drones, 62 sapper jams, 8 `fly` commands, 269 hash checkpoints, and the wave-8 checkpoint restored and replayed to the identical final state. `e2e/engines.mjs` compares it across engines (§16.11 has the run).

### 16.7 Battle save (field list; `src/ui/battle/snapshot.js` is not on this branch)

Battle save (`wt-battlesave`) is not merged into this base, so the edit is written down for the branch that lands second (the generic `src/sim/snapshot.js` used by co-op checkpoints already carries everything, proven by the tests above):
- `KNOWN_TOWER_KEYS`: **`flight: 'snap'`** (row field **`fl: [mode, ax, ay, bx, by, cx, cy, leg]`**, absent when `t.flight` is null = Hover); plus §5's `droneDmg, droneKills, droneShots, droneSerial: 'snap'`, `_pool, _poolS: 'scratch'`, `_poolLeft, _poolMode: 'calm'`.
- `KNOWN_DRONE_KEYS`: §5's list unchanged (`uid, n, slot, x, y, facing, cooldown, dmg, kills, shots, born, jam` snap; `hx, hy` derived; `tgt, targetUid, moving, px, py` calm).
- Restore: `t.flight = fl ? { mode, ax, ay, bx, by, cx, cy, leg } : null` **before** the first step (the wing frame reads it); old saves restore as Hover. Mid-flight Patrol positions and Pursuit sorties need nothing else: drones fly from their saved positions.
- Projectile rows: drone bullets are guided and never in flight at a wave-end calm point (§5); the new projectile fields `drone`, `guided` are therefore `calm` for battle save (the generic snapshot stores them).
- `SNAP_V` 1 → 2 is the train's single bump (LANDING_PLAN S11 / §8).

### 16.8 Attack FX (M5)

`src/render/attackFx/` is not on this branch. The hook is in place: the renderer exposes `renderer.drawnDrones` (uid → drawn `{x, h, y}`), `renderer.droneScreen(uid)` and `renderer.setFlightPreview()`, and the legacy drone mesh (`actors._syncDrones`) already draws the **sim's** drones between steps (`renderAlpha`: solo `sim._acc / STEP`, co-op `min(1, lockstep.acc)`), wobbling while jammed or stalled. When attack FX lands, its `patterns/drones.js` reads the sim position as §6.1 says and adds the roam / signal rings' styling; nothing in the sim changes.

### 16.9 Balance (real sim, this branch)

Method: `tools/chika/measure.js`. Profiles **base** (neutral) and **strong** (L60 ★5 mythic preset). Spots **best** (most lane within her 3.0 range) and **far** (3.6–4.2 tiles from the lane). Hold / Patrol points are what a sensible player picks: Hold = the lane point inside her signal range with the most lane within `L + gun`; Patrol = that and the best other lane point ≥ 3 tiles away. Pursuit as shipped (×0.85, the owner's choice) unless noted; ×0.8 (the first proposal) and ×1.0 are kept as knob rows. Seeds 9 / 21 / 33 (campaign 7 / 8 / 9).

#### 16.9.1 Per-mode summary

| Mode | Boss walking the whole lane (vs Hover) | Crowd kills, Chika alone (vs Hover) | Campaign team, 60 runs | Co-op freeplay (Blossom, team bot with Chika lines) |
|---|---|---|---|---|
| **Hover** | — (4-5 strong 5-0-2: 652k) | — | 7 / 10 Normal won (same as below) | 1-3: dies at **120** · 8-5: **110** |
| **Hold** | **+4…+42%** | **−7…+72%** (+35…+72% from a far spot) | **no flip**; 5-5 Normal lost once in 3 (auto-picked point) | 1-3: 120 · 8-5: 110 |
| **Patrol** | **−6…+18%** | **−9…+74%** | **no flip**; 5-5 Normal lost once in 3 (auto-picked points) | 1-3: 120 · 8-5: 110 |
| **Pursuit ×0.85** (ships) | **+43…+124%** | **−8…+79%** (−2…+3% at her best spot outside mid-game bends; +29…+79% from a far spot) | **no flip** (wins end with +0…+16 more lives) | 1-3: **121** · 8-5: **116** |
| Pursuit ×0.8 (first proposal) | +34…+108% | −8…+75% | no flip | 1-3: 121 · 8-5: 110 |
| Pursuit ×1.0 (knob) | +74…+168% | +0…+100% | no flip | 1-3: 122 · 8-5: 116 |

No-Chika team for scale: 1-3 dies at 112, 8-5 at 116.

#### 16.9.2 Boss walking the whole lane (`boss`; damage over one pass per path after a 45 s warm-up; target Strong)

| Stage | Profile | Build | Hover | Hold | Patrol | Pursuit ×0.85 | Pursuit ×1.0 |
|---|---|---|---|---|---|---|---|
| 4-5 | strong | t0 | 13,051 | 17,615 (+35%) | 13,466 (+3%) | 22,650 (+74%) | 27,100 (+108%) |
| 4-5 | strong | 3-0-0 | 45,776 | 65,217 (+42%) | 53,398 (+17%) | 78,530 (+72%) | 92,148 (+101%) |
| 4-5 | strong | 5-2-0 | 513,585 | 720,310 (+40%) | 602,163 (+17%) | 801,061 (+56%) | 958,383 (+87%) |
| 4-5 | strong | 5-0-2 | 652,474 | 917,646 (+41%) | 767,057 (+18%) | 1,022,122 (+57%) | 1,216,778 (+86%) |
| 4-5 | strong | 2-0-5 | 102,902 | 134,717 (+31%) | 100,750 (−2%) | 147,504 (+43%) | 178,636 (+74%) |
| 4-5 | base | 3-0-0 | 2,033 | 2,859 (+41%) | 2,373 (+17%) | 3,478 (+71%) | 4,091 (+101%) |
| 4-5 | base | 5-0-2 | 72,165 | 100,255 (+39%) | 84,244 (+17%) | 111,876 (+55%) | 132,951 (+84%) |
| 8-5 | strong | 5-0-2 | 828,287 | 863,985 (+4%) | 776,342 (−6%) | 1,387,370 (+67%) | 1,659,587 (+100%) |
| 2-5 | strong | 5-0-2 | 525,168 | 729,243 (+39%) | 557,231 (+6%) | 1,174,078 (+124%) | 1,409,839 (+168%) |

**Why Pursuit does not trivialize bosses**: Pursuit only removes the *walking* part of the problem — the wing stays on the boss for the whole lane instead of the part near her. Its ceiling is her **parked-boss** throughput × 0.85 (a boss standing in her disc the whole time), which §8.3 puts at 7.6k/s for a strong 5-0-2 (×0.85 ≈ 6.5k/s) — below Shiro's 13.6k walking-past figure. Every boss that a team kills today still needs the team; the campaign outcome table does not move.

#### 16.9.3 Real waves, Chika alone (`waves`; kills, mean of 3 seeds; lives lost in brackets)

| Stage | Profile | Build | Spot | Hover | Hold | Patrol | Pursuit ×0.85 |
|---|---|---|---|---|---|---|---|
| 1-3 | base | t0 | best | 275 (222) | 271 −1% | 272 −1% | 284 +3% |
| 1-3 | base | t0 | far | 169 (328) | 228 +35% | 234 +38% | 254 +50% |
| 1-3 | base | 0-0-2 | best | 415 (82) | 423 +2% | 421 +1% | 408 −2% |
| 1-3 | base | 0-0-2 | far | 374 (123) | 396 +6% | 411 +10% | 388 +4% |
| 2-5 | base | 3-0-0 | best | 579 (222) | 716 +24% | 531 −8% | 736 +27% |
| 2-5 | base | 0-0-3 | best | 342 (408) | 389 +14% | 347 +1% | 455 +33% |
| 3-5 | base | 3-0-0 | best | 96 (315) | 111 +16% | 109 +14% | 111 +16% |
| 3-5 | base | 3-0-0 | far | 61 (350) | 105 +72% | 106 +74% | 109 +79% |
| 4-5 | base | 5-0-2 | best | 383 (31) | 390 +2% (0) | 384 0% | 390 +2% (0) |
| 4-5 | base | 5-0-2 | far | 389 (25) | 389 0% | 386 −1% | 390 +0% (0) |
| 4-5 | base | 2-0-5 | best | 388 (30) | 389 0% | 389 0% | 389 +0% |
| 4-5 | base | 2-0-5 | far | 188 (234) | 174 −7% | 171 −9% | 242 +29% |
| 4-5 | strong | 3-0-0 | best | 386 (28) | 389 +1% | 388 +1% | 389 +1% |
| 4-5 | strong | 3-0-0 | far | 387 (27) | 375 −3% | 378 −2% | 389 +1% |
| 6-5 | strong | 5-0-2 | best | 782 (0) | 790 +1% | 784 0% | 777 −1% (0) |
| 6-5 | strong | 5-0-2 | far | 844 (0) | 790 −6% | 790 −6% | 776 −8% (0) |

Reading: at her best spot, Hover is already near the best a mode can do and Pursuit ×0.85 is about even (−2…+3%); the modes pay off when she stands where Hover cannot reach (far spots: +35…+79%) or when the lane bends inside her signal range (2-5: Hold +24%, Pursuit +27…+33%). That is the intended choice: **Hover to defend her area, Hold/Patrol to move her coverage, Pursuit for bosses and leakers anywhere.**

#### 16.9.4 Sapper stages (`sabo`; base; kills (lives lost, drone jams))

| Stage | Build | Spot | Hover | Hold | Patrol | Pursuit ×0.85 |
|---|---|---|---|---|---|---|
| 6-3 | 3-0-0 | best | 61 (303, 53) | 76 (288, 61) | 75 (289, 54) | 63 (301, 70) |
| 6-3 | 3-0-0 | far | 105 (259, 78) | 79 (285, 79) | 85 (279, 79) | 68 (296, 87) |
| 6-4 | 3-0-0 | best | 98 (879, 120) | 124 (853, 151) | 110 (867, 126) | 154 (823, 180) |
| 6-4 | 5-0-2 | best | 944 (13, 87) | 947 (10, 85) | 946 (11, 85) | 948 (5, 90) |
| 6-5 | 3-0-0 | best | 152 (787, 167) | 165 (774, 175) | 151 (788, 168) | 238 (701, 238) |
| 6-5 | 3-0-0 | far | 107 (832, 108) | 172 (767, 211) | 165 (774, 209) | 240 (700, 260) |
| 6-5 | 5-0-2 | best | 842 (40, 67) | 819 (63, 101) | 844 (39, 87) | 830 (11, 91) |
| 6-5 | 5-0-2 | far | 814 (83, 78) | 835 (44, 63) | 843 (40, 70) | 831 (11, 67) |

Wings away from the team take more jams (Pursuit up to 260 a stage); on 6-3 (sappers early, few other enemies) Pursuit's far wing loses 35% of the far-spot kills to jams — the counter works.

#### 16.9.5 Team campaign and co-op freeplay

- **Campaign** (`campaign`; `autoPlan` team Hikari, Chika, Aoi, Yuki, ≤ 2 copies; 10 stages × Normal/Hard × 3 seeds = 60 runs per mode): every mode wins and loses the **same stages** as Hover — 1-5, 2-3, 2-5, 3-5, 4-3, 5-5, 7-5 Normal and 1-5 Hard won; the rest lost. Pursuit ×0.85 wins with more lives (2-5 Normal 80 → 85–90, 4-3 Normal 78–82 → 89–91, 5-5 Normal 1–19 → 20–30, 7-5 Normal 12–17 → 14–24) and loses 0–3 waves later; Chika's share of team damage moves from 11–63% (Hover) to 15–64%, higher on most stages. Hold / Patrol lose 5-5 Normal in one seed each with the automatic point picker (a player would pick better). Table: `docs/specs/chika-res/camp-*.txt`.
- **Co-op freeplay** (`freeplay`; Blossom, strong profile, every other copy a Chika, placed by drone reach): 1-3 — no Chika 112, Hover 120, Hold 120, Patrol 120, Pursuit ×0.85 121 (×0.8: 121, ×1.0: 122); 8-5 — no Chika 116, Hover 110, Hold 110, Patrol 110, Pursuit ×0.85 116 (×0.8: 110, ×1.0: 116). Pursuit raises Chika's share (50% → 59–61%) but the run ends within a few waves of Hover. (This bot is weaker than freeplay's own calibration bot — its no-Chika team dies at 112–116 — so read the differences, not the absolutes; the train-C step 7 re-run uses freeplay's `fp/bot.mjs`.)

#### 16.9.6 Lockstep cost (`perf`; Node 22, idle 4-core machine)

6 Chikas at 5-0-2 (60 drones) on 4-5, an immortal orc every 2 steps on each path (~2,400 alive), µs per step over 600 steps after 30 s, three rounds per mode, modes interleaved:

| Mode | Mean per round | Median step per round |
|---|---|---|
| Hover | 742 / 627 / 797 | 709 / 594 / 704 |
| Hold | 831 / 650 / 674 | 655 / 583 / 604 |
| Patrol | 806 / 600 / 805 | 798 / 550 / 749 |
| Pursuit | 766 / 597 / 785 | 629 / 517 / 677 |

Pursuit's map-wide pool costs nothing measurable: the pool is still built at most once per girl per step and reused up to 4 steps, and a drone re-thinks once a second.

#### 16.9.7 Knobs (each is data or one constant, one co-op id bump)

| Knob | Ships | Measured alternative |
|---|---|---|
| `FLIGHT_PURSUIT_RATE_MUL` | **0.85** (owner) | 0.8 (first proposal): boss +34…+108%, kills −8…+75%, freeplay 121 / 110. 1.0: Pursuit ≥ Hover almost everywhere (boss +74…+168%, kills +0…+100%), so the modes stop being a choice; campaign still no flip; freeplay +2…+6 waves. |
| `FLIGHT_POINT_ROAM_MUL` | **1.0** | 0.5 (a tight Hold disc): Hold −49% / Patrol −58% boss damage against Hover (4-5 strong 5-0-2) and −16% / −48% kills (2-5 base 3-0-0, seed 9) — Hold became strictly worse than Hover. |
| `FLIGHT_SIGNAL_MUL` | **2** | Not swept: the whole map would make placement meaningless for Hold/Patrol; 2 × leash (8 tiles) reaches the next bend on every measured map. |
| `FLIGHT_PATROL_SPEED_MUL` | **0.6** | Faster patrols leave the drones behind (they spend the time flying back to the disc). |

#### 16.9.8 Gates (re-run on the train)

1. §8.10 gates for Hover (the r2 numbers), unchanged.
2. Pursuit `boss`: ≤ +130% over Hover at every build (here +43…+124%; raised from +110% with the owner's 85%), and never above her parked-boss DPS × `FLIGHT_PURSUIT_RATE_MUL` over the pass.
3. `waves`: no mode below −10% of Hover at her best spot; none above +80% anywhere.
4. `campaign`: no mode flips an outcome against Hover (re-approve any flip).
5. Freeplay step 7 (LANDING_PLAN §9.2) with Chika lines in Pursuit: inside its band.
6. Perf: 6 Chikas in Pursuit ≤ Hover × 1.25 per step at ~2,000 live enemies (§16.11).
7. `e2e/engines.mjs`: `DRONES_START` equal in every engine; `e2e/chika-drones.mjs` at both sizes.

### 16.10 Evidence (`docs/specs/chika-res/`)

`boss-v1.txt`, `waves-v1.txt`, `sabo-v1.txt`, `camp-v1.txt`, `fp-v1.txt` (all modes, Pursuit ×1.0), `boss-k08.txt`, `waves-k08.txt`, `sabo-k08.txt`, `camp-k08.txt`, `fp-k08.txt` (Pursuit ×0.8), `*-k085.txt` (Pursuit ×0.85, the shipping value), `perf.txt`. Re-run: `node tools/chika/run.mjs tools/chika/measure.js <boss|waves|sabo|campaign|freeplay|perf> [--modes …]`.

### 16.11 Runs on this branch

- `BUN=/root/.bun/bin/bun node e2e/engines.mjs`: **OK, 3 runs on 2 engines** (Node 22 V8, Bun 1.4.2 JavaScriptCore, Chromium 141 V8). `DRONES_START` (Pursuit ×0.85): ticks 32,287, won at wave 28, Chikas 5-0-2 and 2-0-5, 12 drones, 281,633 drone damage, 8 `fly`, 62 jams, final `3098440430`, 269 hash checkpoints → `912192f9`, the wave-8 checkpoint replays to the run in all three. `START` is unchanged (`411300916`). Firefox and WebKit are not installed in this container (`--require-all` not run). Output: `docs/specs/chika-res/engines.txt`.
- Perf: §16.9.6.

### 16.12 Owner questions (defaults ship)

- **Q-F1. Pursuit's price. Answered (owner, Oct 15): 85%.** (Proposed 80%; no price ×1.0 makes Pursuit beat Hover nearly everywhere.)
- **Q-F2. How far Hold / Patrol may reach. Answered: keep the default.** **2 × her drone range** (8 tiles at tier 0). Option: anywhere on the map (more helicopter-like, makes where you place her matter much less).
- **Q-F3. Unlocks. Answered: keep the default.** **all four modes from tier 0**. Option: Pursuit from Sentry Grid (tier 3 of Sentry Works), if you want it to feel earned.

---

## 17. Build notes (branch `feature/chika-rework`, off `feature/train-c-base`)

What was built, milestone by milestone, and where it differs from the text above.

| # | Built | Files |
|---|---|---|
| M0 | Sim core as §3 plus the flight modes of §16: `makeDrone` / `restoreDrone` / `hasRoamingDrones`, `topTargets` (stable top-k), the per-girl pool, `updateRoamingDrones` with `wingFrame`, guided drone bullets (+ `fizzle` event), `buildDrones` on `turret.build`, `setFlight` / `flightMode` / `signalRange`; `Sim` `_hit/_credit/_killEnemy` drone credit, `setFlight`, `flightInfo`, `droneStats`, `findDrone`, `towerStats().own` and the roaming `turret` fields; sappers jam drones when no girl is in reach. | `src/sim/constants.js`, `mods.js`, `towers.js`, `Sim.js`, `enemies.js`, `headless.js` |
| M1 | Chika data and copy (§3.6), the flight-mode tip, `autoPlan` placing her by drone reach, student-page copy (drone lines, "Projectile + Drones", the Drones row with the modes), `docs/ROSTER.md`. | `src/data/units.js`, `src/ui/screens/student.js` |
| M2 | `fly` command, `isValidCmd` 6 args for `fly`, `COOP_PROTOCOL` 4, `hashSim` drone + flight folds, `DRONES_START` / `runDronesBattle` in the engines fixture and `e2e/engines.mjs`. | `src/online/coop/commands.js`, `simHash.js`, `version.js`, `e2e/engines/*` |
| M3 | Panel: split bar, Flight row, tab row (coin dot), Overall / Chika / Drones tabs, drone list, drone card (◀ ▶ ‹), tab memory per battle, scroll to top on a tab change, `createRateMeter`, `droneNames.js`, CSS for both sizes (`.bt-dr-*`). | `src/ui/battle/chikaPanel.js`, `chikaFlight.js`, `towerPanel.js`, `util.js`, `src/data/droneNames.js`, `src/ui/styles/battle.css` |
| M4 | Picking: `pick().droneUid` (flying drone > footprint > body > home drone, 22 px or 0.3 tiles), `ctx.select(uid, { drone })`, `ctx.selectDrone`, overlays (roam ring, signal ring while picking, Hold / Patrol markers, drone ring + tether + reticle), `renderAlpha` interpolation in the legacy drone mesh, `droneScreen` / `drawnDrones` / `setFlightPreview`. | `src/render/BattleRenderer.js`, `overlays.js`, `actors.js`, `src/ui/battle/controller.js` |
| M5 | **Hook only**: `src/render/attackFx/` is not on this base (§16.8). The legacy mesh draws the sim's drones between steps; attack FX reads `renderer.drawnDrones` when it lands. | — |
| M6 | **Field list only**: battle save (`src/ui/battle/snapshot.js`) is not on this base (§16.7). The generic `src/sim/snapshot.js` (co-op checkpoints) stores everything; split-run tests switch flight modes every 10 s. | `tests/sim/snapshot.test.js` |
| M7 | `e2e/chika-drones.mjs` (both sizes), tests, docs (`CONTRACTS.md` §3 / §6 / §10 / §13, `docs/OWNER_REQUESTS.md`, this spec), measurement tools `tools/chika/`. `e2e/stat-display.mjs` does not exist on this base (it belongs to the unit-info branch), so its update (§9) is left to the branch that lands second. | `e2e/chika-drones.mjs`, `tools/chika/*`, docs |

**Owner answers (Oct 15)**: Q-F1 → Pursuit fires at **85%** (`FLIGHT_PURSUIT_RATE_MUL` 0.8 → 0.85; Pursuit rows re-measured, §16.9, `docs/specs/chika-res/*-k085.txt`); Q-F2 and Q-F3 → the defaults stay (signal range 2 × leash; every mode from tier 0).

**Deviations from the spec text**
- **Credit seam**: `_credit(tower, dealt, e = null, drone = null)` (LANDING_PLAN S1, problem #1), not §3.4's `_credit(tower, dealt, drone)`; `_dot` passes the enemy too. The hero rework's damage XP reads `e`.
- **Drone range under map rules** (problem #2): this base has no codex env inputs, so `refreshEffective` uses `leash = max(1, leash) × buff.rangeMul`, `gun = range × buff.rangeMul`; the codex merge adds `envAdd` / `envMul` to the roam radius only, as S4 says.
- **Flight seam**: `t.flight` carries `cx, cy, leg` besides the landing plan's `mode, ax, ay, bx, by` (the Patrol position and direction are state). `null` means Hover, so drone-less girls carry nothing.
- **`fly` arguments**: `fly[uid, mode, qx1, qy1, qx2, qy2]` — the landing plan's row left out the girl's uid; `isValidCmd` allows 6 arguments for `fly` only.
- **Hold / Patrol roam = the full leash** (`FLIGHT_POINT_ROAM_MUL` 1; 0.5 measured and rejected, §16.9.7) and **Pursuit fires at 85%** (Q-F1, the owner's answer; 80% was proposed).
- **Panel**: the Overall grid is today's grid (this base has no "Upgrades x% cheaper" or "New drone every …" rows; the spec described the unit-info WIP panel). The base panel called drones "Sentries"; drone owners now see "Drones".
- **Tests**: `tests/battle-ui/towerPanelTabs.test.js` and `tests/render/pick.test.js` need a DOM / a projector stub that this repo's vitest setup does not have (no jsdom); their checks run in `e2e/chika-drones.mjs` instead, and `tests/battle-ui/chikaPanel.test.js` covers the pure parts (names, rate meter, DPS basis).
- **Measurements** are from `tools/chika/measure.js` on this branch (relative to Hover); the r2 tables (§8, old kit vs new) were not re-run against the old kit. Its gates (§8.10) remain for the train's re-run.

**Gates run here** (Oct 14, final head of this branch): `npm ci` ✓; `npx vitest run` 1126 passed, 1 skipped, **1 failed — pre-existing** (`tests/core/updates.test.js` "the net settings both players must share…": `COOP_NET.supabase` has idle keys the test does not list; the same on `feature/train-c-base`, `src/data/coop.js` untouched here); `npx vite build` ✓; `node e2e/smoke.mjs --viewport 844x390` ✓ and `--viewport 1280x720` ✓ (ALL SMOKE CHECKS PASSED); `BUN=/root/.bun/bin/bun node e2e/engines.mjs` ✓ (V8 Node, JSC Bun 1.4.2, V8 Chromium; Firefox / WebKit not installed); `node e2e/chika-drones.mjs` ✓ at 844×390 and 1280×720 (screenshots looked at: the phone layout was tightened twice — one-line header, icon-only Target / Flight labels, hint only while picking — so the first drone row, Wing DPS and Flying are on screen). Co-op id **`5ced3a409b98`** after the owner's 85% (37 graph files; `5be1f155a2d0` at ×0.8; base `6447e0fe5bd6`).
