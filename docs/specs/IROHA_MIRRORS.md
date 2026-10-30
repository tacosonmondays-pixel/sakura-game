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
  the lower slot). A point closer than `MIN_LEG` (1 tile) to another mirror her player placed is pushed out to 1 tile
  from it (along the line from that mirror; from her if they coincide), then quantised and clamped again, at most three
  passes (review r2 HIGH 2: no stacking). `Sim.clearAim(uid)` returns every mirror to Auto. A slot above her count is refused. When her count
  grows the new slots start on Auto; a spot never moves because of an upgrade, except a reach that shrank (none does).
- **Auto.** A slot with no player spot takes an auto spot: the visible road samples (`sim._relaySamples`, every 0.25
  tiles, tunnels skipped) within her reach, in path-then-distance order; auto slot `k` takes the sample at index
  `floor(AUTO_FRACS[k] × n)` of the `n` in reach, `AUTO_FRACS` = [¼, ¾, ½, ⅛, ⅞]: slot k's spot is the same whatever her
  count, so an upgrade that adds a mirror never moves the others (review r2 M2), and the legs between mirrors run along
  the road. With no road in reach every auto slot stands where she stands (their legs are short: §2).
- **Derived positions.** `t.mirrors` (`[{x, y}]`, length = her count) is rebuilt from `t.mirrorAim` and the auto rule
  on placement, every upgrade, `setAim`, `clearAim` and a hero Move-style relocation; it emits `'mirrors'`
  `{ towerUid, list: [[x, y], …], placed: [0|1, …] }` when it changes. Mirror 0 stays her relay origin (`t.ox`,
  `t.oy`, the old `'relay'` event), so every old reader of "her panel" still points at a real mirror.

## 2. Her bolts bounce (Reflected Bolt)

- **The volley.** Her attack (`relay.kind 'mirror'`) fires `projectiles` bolts (at `MIRROR_BOLT_SPEED` 18 when her spec
  has no flight speed) from where she stands when any eligible
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
  dropped, so it is the same on every client), then bounces: `bounce += 1` and event `'mirrorBounce'`
  `{ uid, towerUid, mirror: k, n: bounce, x, y, fx, fy }` (from → to, the display's reflected beam). If the leg it just
  flew is at least `MIN_LEG` (1 tile) long it is a **real reflection**: a new leg for its hits, pierce refilled,
  `steps += 1` and the damage scale `1 + bounceMul × steps` (§4 Polish), a bounce splash and shards (§4 Kaleidoscope). A
  shorter leg (mirrors stacked on one spot, every Auto slot on her) only passes the bolt on: no new leg, no Polish step,
  no splash or shards (review r2 HIGH 2: stacking five mirrors on a boss multiplied her ×4).
- **Bounces never fall below mirrors.** Every tier that adds a mirror adds a bounce too (§4), so each bolt visits every
  one of her mirrors and an upgrade that adds a mirror only lengthens each route (review r2 M2: Second Pane lowered her
  boss damage when the new mirror took a bolt's entry away from the mirror by the boss). Tested over every build.
- **Crosses another girl's mirror?** Her own bolts never split at mirrors (they are born `split`), so two Irohas'
  networks never multiply each other. This is a deliberate change: today a shot from where an Iroha stands splits at
  another Iroha's panel.
- **The plain projectile rules don't apply on a route** (review r1 HIGH 1): a routed bolt is stepped by
  `mirrors.js routeStep`, never `projectileStep`, until its last bounce. So: an emptied pierce stops a leg's hits but
  never kills the bolt; its splash is held in `fsplash` (0 on the legs, never bursting at a mirror) and given back for the
  final leg; `maxTravel` is not checked on a route and is set to `range × 1.4 + 2` for the final leg. Each leg's end point
  is the mirror's spot when the bolt was fired (stored in `route`), so moving a mirror never moves a bolt in flight. A
  bolt bounces at most once a step; a zero-length leg (two mirrors on one spot, or every Auto slot on her) is a bounce on
  the next step and, being shorter than `MIN_LEG`, adds nothing (above). The route runs for every Iroha, ability or not
  (outside the `sim._abilOn` gate). The final-leg pick skips the enemies the bolt hit on its last leg.

## 3. Allies' shots reflect too

Kept from today: while her ⚡ runs, and for good from Mirror Hall tier 5, her mirrors reflect allies' shots (every
girl's, both players' in co-op, drones' and sentries'; never hers): a shot whose step segment passes within
`MIRROR_RADIUS` (**0.8**; was 0.5 for the one panel: five mirrors spread on the road met fewer of the allies' lines,
review r2 H1) of one splits once — the original flies on, a copy leaves the crossing point.

New: the copy flies on to **her next mirror** (chain order after the crossed one) and from there to the best enemy by
the shooter's target mode within the shot's range (else today's fallback: the original's target, fanned). Each mirror
it reaches is one bounce, `ALLY_BOUNCES` = 1 (2 from Mirror Hall tier 5), hard-capped at 2. The copy is `split`, so it
never splits again — no loops, two networks included. It keeps the shooter's spec, kind, speed, pierce, splash, credit
and the original's hits (today's rules). On its legs it is stepped like her bolts (`routeStep`: no `maxTravel`, no
homing, never bursting at a mirror; **a real reflection starts a new leg for its hits too**), except that its pierce is
not refilled (an emptied pierce ends it, as any shot) and a splash copy bursts at its first contact on a leg. At the end
of its route it takes, in order (review r2 H1: a copy whose original had already struck a lone boss found nothing): the
best enemy within the shot's range of the last mirror not struck on its last leg; else the best enemy within range of
the point where it crossed her mirror, struck or not; else the original's target, struck or not; else it ends. Its
final `maxTravel` covers the distance to that enemy. **Guided and returning shots are not routed** (review r1
HIGH 2): a drone's guided copy or a returning fan splits the old way (the copy straight at the next target, else fanned).

## 4. Paths

Tier names kept where they fit. Coins unchanged.

**Mirror Hall — "More mirrors, more bounces"** (⚡ path)
| T | name | effect |
|---|---|---|
| 1 | Bright Glass | +1 damage |
| 2 | Second Pane | a third mirror, +1 bounce, +1 damage |
| 3 | Mirror Hall | +2 damage; bolts pierce 1 more on every leg, reveal veils 1.5 s; ⚡ Laser Web |
| 4 | Hall of Reflections | a fourth mirror, +1 bounce, two more bolts, +4 damage |
| 5 | Infinite Reflection | a fifth mirror, +1 bounce, two more bolts, +12 damage, +30% attack speed; allies' shots reflect for good, and twice; ⚡ Infinite Reflection |

**Silver Reflection — "Polish: every bounce hits harder"**
| T | name | effect |
|---|---|---|
| 1 | Long Frame | mirrors stand 0.6 tiles further |
| 2 | Clear Silver | +0.3 range; each bounce +15% damage |
| 3 | Silver Reflection | Veil Sight; mirrors 0.8 further; each bounce +15% more |
| 4 | Moonlit Looking-Glass | a third mirror, +1 bounce, +5 damage, ignores 3 armour, each bounce +10% more |
| 5 | Mirror of Truth | +1 bounce, +9 damage, +50% vs elites, silences 0.8 s, ignores 3 more armour, each bounce +10% more |

**Shattered Glass — "Kaleidoscope: every bounce shatters"**
| T | name | effect |
|---|---|---|
| 1 | Quick Polish | +12% attack speed |
| 2 | Splintered Glass | each bounce splashes 0.8 tiles; bolts splash 0.4 tiles on impact |
| 3 | Glass Shards | wider splashes (+0.4 bounce, +0.3 impact); 20% slows 1 s |
| 4 | Glass Storm | a third mirror, +1 bounce, +8 damage, wider splashes (+0.3 bounce, +0.4 impact), 15% stun 0.3 s; each bounce throws a shard at another enemy |
| 5 | Kaleidoscope Burst | +1 bounce, +4 damage, a wider landing splash (+0.6), +30% attack speed |

Base kit: 4 damage, 0.7/s, range 2.3, **3 bolts** (today: 2 bolts from each of two points), pierce 1, bolt speed 18,
2 mirrors, 2 bounces, mirror reach 3.7. The `iroha` row of `src/data/balance.js` is `{ boss: 3.6 }` (r5: 3.9).
Mirrors / bounces at tier 5: Mirror Hall 5 / 5, Silver Reflection 3 / 4, Shattered Glass 3 / 4 (a crosspath Mirror Hall
tier 2 adds a mirror and a bounce).

Stats: `relay: { kind, reach, mirrors, bounces, bounceMul, bounceSplash, shards, allyBounces }`; tier mods add to them
(`mirrors` and `allyBounces` keep the max; `src/sim/mods.js normRelay` and the relay merge). The tier texts give each
tier's own step; the running totals at tier 5: Polish `bounceMul` 0.15 + 0.15 + 0.10 + 0.10 = **0.50 a real bounce**
(×1.5 on the first, ×3 on the fourth); Kaleidoscope `bounceSplash` 0.8 + 0.4 + 0.3 = **1.5 tiles**, 1 shard. A **bounce splash** hits every eligible enemy within the radius of the mirror at the bolt's
scaled damage. A **shard** is a plain (unrouted, `split`) bolt from the mirror at the best enemy in her range of it that
the bolt has not hit, at her damage × its scale; `SHARD_BUDGET` = 64 shards a step for the whole board, in tower order.

## 5. ⚡ Laser Web (tier 5: Infinite Reflection)

Replaces Mirror Shift at Mirror Hall tier 3. The ability keeps its id `iroha.mirrorShift` (saved Auto settings, the
ability bar, co-op casts and tests address it by id); its name becomes **Laser Web**, and tier 5's upgrade keeps the name
**Infinite Reflection**. It needs no aim (an aimed cast ignores the point); her mirrors stay where they are. For `duration` (6 s; tier 5: 9 s) every pair of her mirrors is joined by a beam
(`m × (m − 1) / 2` beams: the web unlocks at Mirror Hall tier 3, where she has 3 mirrors, so 3, 6 or 10 beams; a
crosspath copy with 2 mirrors can't hold tier 3 of Mirror Hall). Every `WEB_TICK` steps (12 steps, 0.2 s; a tick is a step
where `active + her uid` is a multiple of `WEB_TICK`, so Irohas that cast together tick on different steps: review r2
M4) each beam hits every
eligible enemy within `WEB_HALF` (0.35) of it (plus its hit radius), at her damage × `dmgMul` (0.9; tier 5: 2.0). **One
web hit an enemy a tick**, however many of her beams cross it (review r1 MEDIUM 5: on a straight road all ten beams lie
on one line). Two Irohas' webs each hit it once. The window is her `t.abil.active` (integer steps) and the tick
is read from it and her uid (above), so nothing new is stored. While the web runs her mirrors reflect allies' shots (§3).
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

Fully maxed, the round-5 bench's measure (`tools/balance/r5Bench.mjs`: L85, ★5, P6, UR gear, Umeko 2-5-0 + Midori 5-0-2
beside her, stage 4-5, a boss held at her nearest road point or a late crowd stream), the mean of seeds 9, 1 and 2, on
three trees: live `main` (a741aef7), `feature/balance-r5` (09aab59b) and this branch. The bench never casts, so the
Laser Web is not in these numbers. Kage on the same bench: 2.21M boss, 1.83M crowd. Every build is at or above both
`main` and r5 (lowest ×1.15 vs r5), and along every path no tier is below the one before it (Auto).

**Boss** (Auto mirrors; best = the best of six star placements around her road point, spaced 1 tile)

| build | live main | r5 | this branch, Auto | × r5 | best placement |
|---|---:|---:|---:|---:|---:|
| 1-0-2 | 13.3k | 56.7k | 144.4k | ×2.54 | 144.4k |
| 2-0-2 | 19.9k | 85.1k | 172.1k | ×2.02 | 172.1k |
| 3-0-2 | 19.9k | 85.1k | 229.4k | ×2.70 | 229.4k |
| 4-0-2 | 60.0k | 254.4k | 594.5k | ×2.34 | 594.5k |
| 5-0-2 | 255.3k | 1.09M | 2.12M | ×1.95 | 3.01M |
| 2-1-0 | 17.9k | 76.1k | 111.9k | ×1.47 | 139.9k |
| 2-2-0 | 18.0k | 76.2k | 142.9k | ×1.87 | 177.4k |
| 2-3-0 | 18.0k | 76.2k | 174.7k | ×2.29 | 215.1k |
| 2-4-0 | 35.9k | 152.5k | 503.0k | ×3.30 | 640.0k |
| 2-5-0 | 129.3k | 548.9k | 2.06M | ×3.76 | 2.69M |
| 2-0-1 | 19.9k | 85.1k | 125.4k | ×1.47 | 157.3k |
| 2-0-2 | 19.9k | 85.1k | 172.1k | ×2.02 | 172.1k |
| 2-0-3 | 19.9k | 85.1k | 172.1k | ×2.02 | 297.6k |
| 2-0-4 | 39.9k | 169.7k | 658.6k | ×3.88 | 1.35M |
| 2-0-5 | 120.2k | 508.7k | 1.35M | ×2.65 | 2.82M |

**Crowd** (Auto mirrors; best = the best of six star placements around her road point, spaced 1 tile)

| build | live main | r5 | this branch, Auto | × r5 | best placement |
|---|---:|---:|---:|---:|---:|
| 1-0-2 | 40.0k | 42.9k | 137.5k | ×3.21 | 137.5k |
| 2-0-2 | 60.5k | 65.1k | 253.7k | ×3.90 | 253.7k |
| 3-0-2 | 60.5k | 65.1k | 359.7k | ×5.52 | 359.7k |
| 4-0-2 | 181.1k | 195.7k | 1.26M | ×6.44 | 1.26M |
| 5-0-2 | 772.1k | 835.9k | 5.83M | ×6.97 | 5.83M |
| 2-1-0 | 46.3k | 50.5k | 122.3k | ×2.42 | 122.3k |
| 2-2-0 | 47.3k | 51.4k | 151.7k | ×2.95 | 151.7k |
| 2-3-0 | 47.3k | 51.4k | 186.5k | ×3.63 | 186.5k |
| 2-4-0 | 103.2k | 112.6k | 540.0k | ×4.80 | 540.0k |
| 2-5-0 | 247.7k | 270.2k | 1.49M | ×5.50 | 1.49M |
| 2-0-1 | 52.3k | 55.8k | 134.6k | ×2.41 | 134.6k |
| 2-0-2 | 60.5k | 65.1k | 253.7k | ×3.90 | 253.7k |
| 2-0-3 | 116.5k | 125.4k | 416.5k | ×3.32 | 465.1k |
| 2-0-4 | 1.36M | 1.77M | 3.09M | ×1.75 | 5.46M |
| 2-0-5 | 5.45M | 5.88M | 6.78M | ×1.15 | 7.77M |

**Allies beside a tier-5 Iroha** (5-0-2, Infinite Reflection; each girl at her build, Iroha within 1.6 tiles)

| ally | target | live main | r5 | this branch | × main | × r5 |
|---|---|---:|---:|---:|---:|---:|
| kage 5-0-2 | boss | 209.5k | 219.7k | 235.4k | ×1.12 | ×1.07 |
| kage 2-5-0 | boss | 73.6k | 73.6k | 147.8k | ×2.01 | ×2.01 |
| kage 2-0-5 | boss | 43.2k | 43.2k | 86.3k | ×2.00 | ×2.00 |
| kage 5-0-2 | crowd | 188.7k | 355.7k | 388.1k | ×2.06 | ×1.09 |
| kage 2-5-0 | crowd | 71.7k | 71.7k | 78.6k | ×1.10 | ×1.10 |
| kage 2-0-5 | crowd | 167.5k | 167.5k | 223.4k | ×1.33 | ×1.33 |
| aoi 5-0-2 | boss | 33.4k | 94.1k | 93.8k | ×2.81 | ×1.00 |
| aoi 2-5-0 | boss | 86.8k | 244.8k | 245.3k | ×2.83 | ×1.00 |
| aoi 2-0-5 | boss | 138.5k | 390.7k | 393.4k | ×2.84 | ×1.01 |
| aoi 5-0-2 | crowd | 29.9k | 84.4k | 110.4k | ×3.69 | ×1.31 |
| aoi 2-5-0 | crowd | 59.4k | 167.5k | 221.9k | ×3.74 | ×1.33 |
| aoi 2-0-5 | crowd | 34.0k | 95.9k | 105.2k | ×3.09 | ×1.10 |
| akane 5-0-2 | boss | 29.5k | 103.1k | 203.6k | ×6.91 | ×1.97 |
| akane 2-5-0 | boss | 1.0k | 3.7k | 3.7k | ×3.79 | ×1.01 |
| akane 2-0-5 | boss | 9.5k | 33.1k | 66.4k | ×7.02 | ×2.01 |
| akane 5-0-2 | crowd | 1.38M | 1.38M | 1.87M | ×1.36 | ×1.36 |
| akane 2-5-0 | crowd | 336.8k | 345.1k | 345.1k | ×1.02 | ×1.00 |
| akane 2-0-5 | crowd | 176.8k | 176.8k | 191.2k | ×1.08 | ×1.08 |

Laser Web (`tools/abilityBench.mjs iroha`, Auto off → on, 120 s, seed 9): crowd ×1.31 at 3-0-2 and ×1.16 at 5-0-2 (the
gate is ≤ 1.35×); a lone boss never triggers its Auto rule (5 enemies), so ×1. Kage's doubles on the same bench:
×1.21 / ×2.13.

Real coins (`tools/freeplayBot.mjs` runBot on 4-5 Blossom Freeplay, maxed profile, seeds 7 and 8): an Iroha army fell on
wave 108 / 108 on r5 → 126 / 123; a team of Iroha, Kage, Aoi, Miko and Momo 137 / 138 → 150 / 150.

Cost (`tests/sim/perf.mirror.test.js`, run alone, 6 Irohas 5-0-2 with 5 mirrors each and their webs, 24 Aois 5-0-0, 300
enemies): about 0.9–1.5 ms a step, ×2.0–2.4 of the same board at tier 4 (the wider catch radius splits more allied
shots), p99 2.4 ms, worst 3.6–5.9 ms; six Kaleidoscope Irohas (2-0-5) 0.8 ms a step, p99 2.8 ms.

## 11. Tests

- `tests/sim/irohaMirrors.test.js`: count by tier; bounces ≥ mirrors on every build; setAim by slot (quantised, clamped,
  refused past her count, pushed 1 tile from another placed mirror); Auto spots fixed per slot (an upgrade never moves
  them); stacked mirrors adding nothing; a copy finding the lone boss its original already struck; a bolt's route (chain order, wrap, ping-pong, the cap); hits on every leg, once per
  enemy, pierce refilled; bounce scale; splash and shards (and their budget); ally copy to her next mirror, never twice;
  the laser web (beams, ticks, budget, end); refusals.
- Golden / determinism: the same seed and commands twice → the same battle hash; no rng draws in a cast or a bounce.
- Co-op checkpoint: two clients with `aim[uid, qx, qy, k]` commands stay in lockstep (checkpoint hashes equal).
- Save/restore: a battle with three mirrors placed restores the same spots and runs on identically.
- e2e `e2e/iroha-mirrors.mjs`: place three mirrors at 844×390, 1280×720 and 390×844; screenshots.
