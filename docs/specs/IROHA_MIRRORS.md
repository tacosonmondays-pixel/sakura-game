# Iroha's mirror network (rework spec)

Owner, Oct 30: "she's supposed to be able to place multiple mirrors, iroha and have the attacks reflect off of them,
that's what I mean by unique attack reworks".

Today (v0.1.61 + balance round 5) Iroha has ONE mirror panel (`t.ox`, `t.oy`, her relay origin) and fires two plain
volleys: one from where she stands, one from the panel. Her ⚡ Mirror Shift (Mirror Hall tier 3) moves the panel and
makes it split allies' shots once for 8 s; tier 5 (Infinite Reflection) makes that permanent and adds a temporary
second mirror. Nothing of hers actually bounces.

This rework makes her a mirror-network girl: she owns several mirrors, places each one, and her bolts travel mirror
to mirror, hitting enemies on every leg. Builds on `feature/balance-r5` (sim id `daca12604a84` there, COOP_PROTOCOL 13 pending; this branch's sim id is pinned
in `tests/art/itemArtRuntime.test.js` PENDING_BUMP).

Code: `src/sim/mirrors.js` (all the rules below), `src/sim/towers.js` (her attack and the projectile step hook),
`src/sim/Sim.js` (`setAim` with a mirror slot), `src/data/unitsExpansion.js` (her kit), `src/data/abilities.js` (her ⚡),
`src/ui/battle/snapshot.js` (the saved field), `src/online/coop/commands.js` (the `aim` command's slot),
`src/ui/battle/aimControl.js` + `drawerView.js` (placing), `src/render/mirrorFx.js`, `rosterFx.js`,
`attackFx/styles/iroha.js` (display).

## 1. Mirrors

- **Count.** `relay.mirrors`: 2 at base. Mirror Hall (the network path) tier 2 → 3, tier 4 → 4, tier 5 → 5. The other
  two paths reach 3 at their tier 4 (a crosspath Mirror Hall tier 2 also gives 3; the count is the max, never a sum).
  Hard cap `MIRROR_MAX` = 5.
- **Where.** Each mirror stands within her mirror reach (`relay.reach`, 3.7 at base; Silver Reflection still lengthens
  it) of where she stands, inside the map, quantised to the co-op grid (1/1024 tile) exactly as today's mirror aim.
- **Placed by the player.** Mirror `k` (0-based) has a player spot or none (`t.mirrorAim[k]`, `{x, y}` or `null`).
  `Sim.setAim(uid, x, y, k)` places or moves mirror `k`; without `k` the mirror nearest the point moves there (ties:
  the lower slot). `Sim.clearAim(uid)` returns every mirror to Auto. A slot above her count is refused. When her count
  grows the new slots start on Auto; a spot never moves because of an upgrade, except a reach that shrank (none does).
- **Auto.** A slot with no player spot takes an auto spot: the visible road samples (`sim._relaySamples`, every 0.25
  tiles, tunnels skipped) within her reach, in path-then-distance order; with `m` mirrors, auto slot `k` takes the
  sample at index `floor((k + 0.5) × n / m)` of the `n` in reach (evenly spread along the road she covers), so the
  legs between mirrors run along the road. With no road in reach every auto slot stands where she stands.
- **Derived positions.** `t.mirrors` (`[{x, y}]`, length = her count) is rebuilt from `t.mirrorAim` and the auto rule
  on placement, every upgrade, `setAim`, `clearAim` and a hero Move-style relocation; it emits `'mirrors'`
  `{ towerUid, list: [[x, y], …], placed: [0|1, …] }` when it changes. Mirror 0 stays her relay origin (`t.ox`,
  `t.oy`, the old `'relay'` event), so every old reader of "her panel" still points at a real mirror.

## 2. Her bolts bounce (Reflected Bolt)

- **The volley.** Her attack (`relay.kind 'mirror'`) fires `projectiles` bolts from where she stands when any eligible
  enemy is within her range of her or of any of her mirrors. She no longer fires a second plain volley from the panel:
  the bounce IS her second firing point (this replaces UNIT_GAPS §4.1's "two origins").
- **The route.** Bolt `i` enters her chain at mirror `i mod m` and visits mirrors in chain order (`k, k+1, …`, wrapping),
  `bounces` mirrors in all (`relay.bounces`: 2 base, see §4), never the same mirror twice in a row (with two mirrors it
  ping-pongs). Hard cap `BOUNCE_CAP` = 6. After its last mirror it picks the best enemy by her target mode within her
  range of that mirror (else within her range of her; else it ends at the mirror) and homes on it like any bolt.
- **Hits on every leg.** A routed bolt flies straight (no homing) mirror to mirror at its speed; the step's swept
  segment hits enemies exactly like any bolt (the hit radius, eligibility, line order). Each enemy is hit **once a leg**
  (its `hits` list starts over at every bounce), so a bolt bouncing around a boss strikes it on every pass. **A bounce
  refills the bolt's pierce**, so every leg can hit up to her pierce enemies; a leg that empties it stops hitting and the
  bolt flies on to its mirror. (Measured: once per bolt cost her Mirror Hall build 85% of its boss damage.)
- **The step at a mirror.** A bolt that would pass its mirror this step stops on it (the rest of the step's distance is
  dropped, so it is the same on every client), then bounces: `bounce += 1`, pierce refilled, damage scale
  `1 + bounceMul × bounce` (§4 Polish), a bounce splash and shards (§4 Kaleidoscope), event `'mirrorBounce'`
  `{ uid, towerUid, mirror: k, n: bounce, x, y, fx, fy }` (from → to, the display's reflected beam).
- **Crosses another girl's mirror?** Her own bolts never split at mirrors (they are born `split`), so two Irohas'
  networks never multiply each other. This is a deliberate change: today a shot from where an Iroha stands splits at
  another Iroha's panel.
- **The plain projectile rules don't apply on a route** (review r1 HIGH 1): a routed bolt is stepped by
  `mirrors.js routeStep`, never `projectileStep`, until its last bounce. So: an emptied pierce stops a leg's hits but
  never kills the bolt; its splash is held in `fsplash` (0 on the legs, never bursting at a mirror) and given back for the
  final leg; `maxTravel` is not checked on a route and is set to `range × 1.4 + 2` for the final leg. Each leg's end point
  is the mirror's spot when the bolt was fired (stored in `route`), so moving a mirror never moves a bolt in flight. A
  bolt bounces at most once a step; a zero-length leg (two mirrors on one spot, or every Auto slot on her) is a bounce on
  the next step. A bounce splash has no `hits` list, so mirrors stacked on one spot splash the same crowd once a bounce
  each: intended (it is what stacking them buys). The route runs for every Iroha, ability or not (outside the
  `sim._abilOn` gate). The final-leg pick skips the enemies the bolt hit on its last leg.

## 3. Allies' shots reflect too

Kept from today: while her ⚡ runs, and for good from Mirror Hall tier 5, her mirrors reflect allies' shots (every
girl's, both players' in co-op, drones' and sentries'; never hers): a shot whose step segment passes within
`MIRROR_RADIUS` (0.5) of one splits once — the original flies on, a copy leaves the crossing point.

New: the copy flies on to **her next mirror** (chain order after the crossed one) and from there to the best enemy by
the shooter's target mode within the shot's range (else today's fallback: the original's target, fanned). Each mirror
it reaches is one bounce, `ALLY_BOUNCES` = 1 (2 from Mirror Hall tier 5), hard-capped at 2. The copy is `split`, so it
never splits again — no loops, two networks included. It keeps the shooter's spec, kind, speed, pierce, splash, credit
and the original's hits (today's rules). On its legs it is stepped like her bolts (`routeStep`: no `maxTravel`, no
homing, never bursting at a mirror), except that its pierce is not refilled (an emptied pierce ends it, as any shot)
and a splash copy bursts at its first contact on a leg. **Guided and returning shots are not routed** (review r1
HIGH 2): a drone's guided copy or a returning fan splits the old way (the copy straight at the next target, else fanned).

## 4. Paths

Tier names kept where they fit. Coins unchanged.

**Mirror Hall — "More mirrors, more bounces"** (⚡ path)
| T | name | effect |
|---|---|---|
| 1 | Bright Glass | +1 damage |
| 2 | Second Pane | a third mirror |
| 3 | Mirror Hall | +1 bounce; bolts pierce 1 more on every leg, reveal veils 1.5 s; ⚡ Laser Web |
| 4 | Hall of Reflections | a fourth mirror, +1 bounce, two more bolts, +4 damage |
| 5 | Infinite Reflection | a fifth mirror, +1 bounce, two more bolts, +12 damage, +30% attack speed; allies' shots reflect for good, and twice; ⚡ Infinite Reflection |

**Silver Reflection — "Polish: every bounce hits harder"**
| T | name | effect |
|---|---|---|
| 1 | Long Frame | mirrors stand 0.6 tiles further |
| 2 | Clear Silver | +0.3 range; each bounce +15% damage |
| 3 | Silver Reflection | Veil Sight; mirrors 0.8 further; each bounce +25% |
| 4 | Moonlit Looking-Glass | a third mirror, +5 damage, ignores 3 armour, each bounce +40% |
| 5 | Mirror of Truth | +1 bounce, +14 damage, +50% vs elites, silences 0.8 s, ignores 3 more armour, each bounce +60% |

**Shattered Glass — "Kaleidoscope: every bounce shatters"**
| T | name | effect |
|---|---|---|
| 1 | Quick Polish | +12% attack speed |
| 2 | Splintered Glass | each bounce splashes 0.8 tiles; bolts splash 0.4 tiles on impact |
| 3 | Glass Shards | wider splashes (+0.4 bounce, +0.3 impact); 20% slows 1 s |
| 4 | Glass Storm | a third mirror, +5 damage, wider splashes, 15% stun 0.3 s; each bounce throws a shard at another enemy |
| 5 | Kaleidoscope Burst | one more bounce, +13 damage, splashes +0.6, +30% attack speed, two shards per bounce |

Base kit: 4 damage, 0.7/s, range 2.3, **3 bolts** (today: 2 bolts from each of two points), pierce 1, bolt speed 18,
2 mirrors, 2 bounces, mirror reach 3.7. The `iroha` row of `src/data/balance.js` is `{ boss: 6 }` (was 3.9).

Stats: `relay: { kind, reach, mirrors, bounces, bounceMul, bounceSplash, shards, allyBounces }`; tier mods add to them
(`mirrors` and `allyBounces` keep the max; `src/sim/mods.js normRelay` and the relay merge). The tier texts give each
tier's own step; the running totals at tier 5: Polish `bounceMul` 0.15 + 0.25 + 0.40 + 0.60 = **1.40 a bounce** (×2.4
on the first bounce, ×5.2 on the third); Kaleidoscope `bounceSplash` 0.8 + 0.4 + 0.4 + 0.6 = **2.2 tiles**, 2 shards. A **bounce splash** hits every eligible enemy within the radius of the mirror at the bolt's
scaled damage. A **shard** is a plain (unrouted, `split`) bolt from the mirror at the best enemy in her range of it that
the bolt has not hit, at her damage × its scale; `SHARD_BUDGET` = 64 shards a step for the whole board, in tower order.

## 5. ⚡ Laser Web (tier 5: Infinite Reflection)

Replaces Mirror Shift at Mirror Hall tier 3. The ability keeps its id `iroha.mirrorShift` (saved Auto settings, the
ability bar, co-op casts and tests address it by id); its name becomes **Laser Web**, and tier 5's upgrade keeps the name
**Infinite Reflection**. It needs no aim (an aimed cast ignores the point); her mirrors stay where they are. For `duration` (6 s; tier 5: 9 s) every pair of her mirrors is joined by a beam
(`m × (m − 1) / 2` beams: the web unlocks at Mirror Hall tier 3, where she has 3 mirrors, so 3, 6 or 10 beams; a
crosspath copy with 2 mirrors can't hold tier 3 of Mirror Hall). Every `WEB_TICK` steps (12 steps, 0.2 s) each beam hits every
eligible enemy within `WEB_HALF` (0.35) of it (plus its hit radius), at her damage × `dmgMul` (1.2; tier 5: 2.0). **One
web hit an enemy a tick**, however many of her beams cross it (review r1 MEDIUM 5: on a straight road all ten beams lie
on one line). Two Irohas' webs each hit it once. The window is her `t.abil.active` (integer steps): a tick is a step where
it is a multiple of `WEB_TICK`, so nothing new is stored. While the web runs her mirrors reflect allies' shots (§3).
Refused (`noTarget`) with no enemy within her range of her or of a mirror (the reach ring the ability bar draws is her
mirror reach around her, where her mirrors can stand). Cooldown 30 s (tier 5: 25 s); Auto when 5 enemies are within her
mirror reach.

Budget: `WEB_HITS_PER_STEP` = 600 beam hits a step for the whole board (towers in order, beams in pair order, enemies
in the grid's order); past it the rest of that tick's beams hit nothing, so a huge wave costs a bounded step.

## 6. Determinism and performance

- Every rule above uses + − × ÷, `Math.sqrt`, `Math.floor` and squared distances; no rng, no trig (the copy's fan is
  spawnProjectile's existing turn, as today). Integer step counters (the web reads `t.abil.active`), integer bounce
  counts. Leg starts are kept on the bolt (`lx`, `ly`) for the display's beam.
- Order: towers in placement order; mirrors by slot; bolts in volley order; beams by pair (i < j).
- Caps: `MIRROR_MAX` 5, `BOUNCE_CAP` 6, `ALLY_BOUNCES` ≤ 2, `SHARD_BUDGET` 64/step, `WEB_HITS_PER_STEP` 600/step, at most
  `MIRROR_GATHER` 32 reflecting mirrors tested per projectile (the first in tower order; six Irohas at five mirrors fit),
  each behind a box test. The shard and web budgets are module scratch **reset at the top of every step**
  (`mirrors.js stepStart`, first thing in `updateProjectiles`), never carried across steps, so a checkpoint needs nothing
  of them. Shards are spent in projectile-list order (bounces resolve inside `updateProjectiles`).
- `tests/sim/perf.test.js` and `perf.mirror.test.js` (rewritten: 6 Irohas at 5-0-2 with 5 mirrors each, 24 Aois, 300
  enemies) stay inside their bounds.
- **Co-op.** The mirror spots travel in the existing `aim` command: `aim[uid, qx, qy, k]` (a 4th argument, the slot;
  the wire already allows 4). `aim[uid, qx, qy]` keeps working (nearest mirror). A 4th argument must be a whole number
  ≥ 0, else `invalid` (`null` included); a slot she does not have is refused by `setAim` (`ok: false`). The senders pass it:
  `aimControl.send` → `act.aim(uid, x, y, k)` → `aimArgs` (co-op) or `setAim` (solo). The co-op hash
  (`src/online/coop/simHash.js`) carries every mirror's spot and placed flag, so a desync shows at once. The laser web is the normal `abil`
  command. Sim change → new sim id; the coordinator assigns the COOP_PROTOCOL bump (this branch pins `PENDING_BUMP`).
- **`t.aim` for a mirror girl** is never set any more (her spots are `t.mirrorAim`); every reader was checked: the
  save writes `mr` (and no `am` for her), the drawer's AUTO / PLACE read `mirrorAim`, the redraw signature carries her
  mirror count and placed flags, the renderer's aim reticle skips her (she has her own mirror marks), and a Tryout Hall
  Pass move re-places each placed mirror through `setAim` (re-clamped to her reach from the new spot).
- **Battle save.** `snapshot.js` stores `mr: [[x, y] | 0, …]` (her player spots by slot); the restore replays them
  through `setAim(uid, x, y, k)` after her tiers. `t.mirrors` is derived; the web has no state of its own (her ability
  window, which ends at the wave clear); routed bolts in flight are `projectiles` (calm). An older save's `am` (her one
  panel, her relay origin) becomes her **mirror 0**.

## 7. Display

- **Mirrors.** One panel mesh per mirror (the existing oval panel on its easel; the others 0.85× of the first); mirror 0
  keeps the flip / glint / afterimage motion (it flips toward every bolt reflected off it); a thin tether to her for
  each. With her selected (or a mirror being placed) each mirror gets a reticle, `k + 1` dots under mirror `k`, and a
  filled centre when her player placed it.
- **Reflected beams.** Each `'mirrorBounce'` draws a bright lilac-silver line from the leg's start to the mirror that
  fades in 0.18 s (the leg the bolt just flew), a glint on that mirror, and (Kaleidoscope) the shard burst. Capped per
  frame (`BEAMS_PER_FRAME` 48); low graphics halves it; Reduce motion keeps the lines (fades only).
- **Laser web.** While it runs, a pulsing beam joins every pair of her mirrors (two ground quads per beam: a lilac glow
  and a white core; steady on Reduce motion).

## 8. UI (Ink & Paper kit; phones first, 844×390)

- **Drawer.** Her MIRRORS row: `AUTO` · `PLACE`; below it the count (`3 · 2 placed`, or `3 · auto`) and one chip per
  mirror (`1` … `5`, an ink dot under the number when placed). Tapping a numbered chip arms that mirror ("Tap where
  Iroha's mirror 2 should stand"); `PLACE` arms them in order: each board tap places the next, then it ends (the banner:
  "Mirror 1 of 3: tap where it should stand", with Cancel). Every tap is one `aim` command.
- **Board.** While placing, her mirror reach ring (dashed yellow) and the mirror being placed (pulsing yellow) are
  drawn; a tap outside her reach is clamped onto its edge (as today).
- **Drag** (in the first draft) is **not in this build**: tap-to-place covers every mirror in one or two taps on a
  phone, and a drag on the board competes with the camera pan and the placement drag. Owner board Q9 asks.
- **Layout at 844×390** (the phone drawer): two rows. Row 1 `MIRRORS` · `AUTO` · `PLACE`; row 2 the count as the row's
  label (`3 · 2 placed`) and the numbered chips, square at the dense tap size (`--tap-dense`, the 30 px chip with the
  full tap area above and below it). Five chips and the label fit 340 px; the drawer's body scrolls as it does today.
- **One mirror back to Auto:** not offered. AUTO resets all of them; re-placing one is a chip tap and a board tap. A
  per-mirror Auto needs a "clear slot" command form; left for the owner (board Q9).
- **Modes never stack:** PLACE and a numbered chip are the drawer's Set aim (`aimControl.start`), so arming a card, an
  ability aim or a pick ends them exactly as it ends Set aim today, and they end those; a placement tap is never eaten.
- **Range rings:** her range ring stays centred on mirror 0 (her relay origin, `overlays.js`); the other mirrors draw
  their reticles and numbers only when she is selected. Her tip no longer speaks of a second ring.
- **Tactical drawer** (`drawerView.js` aimView): the row and chips above; testids `aim-auto`, `aim-set`, `mirror-chip-k`,
  `mirror-count`.

## 9. Balance

Target (task brief): close to the best Kage tier 5 on boss and crowd (`tools/balance/r5Bench.mjs`; Kage 2.21M boss,
1.83M crowd today), never a nerf: every Iroha build's boss and crowd numbers at or above today's (1.08M boss 5-0-2,
5.78M crowd 2-0-5). Her base damage and the `iroha` row of `src/data/balance.js` are the knobs. Checked with
`tools/capBot.mjs` real-coin runs (her Freeplay wave reached, not lower than today's). Numbers go in §10 when measured.

## 10. Measured

Fully maxed, `tools/balance/r5Bench.mjs iroha --builds all --seeds 9,1,2` (Umeko 2-5-0 + Midori 5-0-2 beside her; the
bench never casts, so the Laser Web is not in these numbers). Kage on the same bench: 2.21M boss, 1.83M crowd.

| build | boss before → after | walking boss before → after | late crowd before → after |
|---|---:|---:|---:|
| Mirror Hall 5-0-2 | 1.09M → **2.26M** | 108k → 815k | 836k → 5.79M |
| Silver Reflection 2-5-0 | 549k → 2.17M | 120k → 869k | 270k → 1.57M |
| Shattered Glass 2-0-5 | 509k → 1.18M | 171k → 2.22M | 5.88M → **6.81M** |

Alone (`--support none`, seed 9): boss 109k / 54k / 51k → 224k / 201k / 116k; crowd 83k / 26k / 299k → 561k / 154k /
675k (Kage alone: 220k boss, 354k crowd).

Every lower tier at or above today (`tools/bench.mjs iroha`, seed 9, crowd ×1.00–3.00, boss ×1.56–4.84; the closest:
2-0-1 crowd ×1.00, 2-1-0 crowd ×1.32). Real coins (`tools/freeplayBot.mjs` runBot on 4-5 Blossom Freeplay, maxed
profile, seeds 7 and 8): an Iroha army fell on wave 108 / 108 before → 121 / 121; a team of Iroha, Kage, Aoi, Miko and
Momo 134 / 137 → 148 / 148.

Laser Web (`tools/abilityBench.mjs iroha`, Auto off → on, 120 s, seed 9): crowd ×1.10 at 3-0-2 and ×1.21 at 5-0-2 (Mirror
Shift: ×0.85 and ×1.00); a lone boss never triggers its Auto rule (5 enemies), so ×1. Kage's doubles on the same bench:
×1.21 / ×2.13.

Cost (`tests/sim/perf.mirror.test.js`, 6 Irohas 5-0-2 with 5 mirrors each and their webs, 24 Aois 5-0-0, 300 enemies):
about 0.7–1.3 ms a step, ×1.6–1.8 of the same board at tier 4, p99 2–3 ms; six Kaleidoscope Irohas (2-0-5) about 0.8–1.4
ms a step, p99 3 ms.

## 11. Tests

- `tests/sim/irohaMirrors.test.js`: count by tier; setAim by slot (quantised, clamped, refused past her count); auto
  spots evenly spread on the road; a bolt's route (chain order, wrap, ping-pong, the cap); hits on every leg, once per
  enemy, pierce refilled; bounce scale; splash and shards (and their budget); ally copy to her next mirror, never twice;
  the laser web (beams, ticks, budget, end); refusals.
- Golden / determinism: the same seed and commands twice → the same battle hash; no rng draws in a cast or a bounce.
- Co-op checkpoint: two clients with `aim[uid, qx, qy, k]` commands stay in lockstep (checkpoint hashes equal).
- Save/restore: a battle with three mirrors placed restores the same spots and runs on identically.
- e2e `e2e/iroha-mirrors.mjs`: place three mirrors at 844×390, 1280×720 and 390×844; screenshots.
