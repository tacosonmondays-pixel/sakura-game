# Iroha's mirror network: independent review, round 1

Reviewed: `docs/specs/IROHA_MIRRORS.md` and `docs/review/iroha-mirrors/OWNER_BOARD.md` at `f8d25577` (on top of
`feature/balance-r5` `d6f092b7`), checked against the code at that commit. File:line references are to that tree.

One light bench (`nice -n 19 node --import ./tools/simLoader.mjs tools/balance/r5Bench.mjs iroha kage --builds all
--targets boss,crowd --seed 9`):

| girl | boss 5-0-2 | boss 2-5-0 | boss 2-0-5 | crowd 5-0-2 | crowd 2-5-0 | crowd 2-0-5 |
|---|---:|---:|---:|---:|---:|---:|
| Iroha | **1.08M** | 548k | 506k | 838k | 271k | **5.78M** |
| Kage | **2.21M** | 746k | 439k | **1.83M** | 749k | 1.52M |

The spec's "before" numbers match the bench at seed 9. `docs/BALANCE.md:45` gives Iroha's crowd as 5.88M, which is the
mean of seeds 9/1/2. The floors should use that three-seed mean, and all six cells above are floors, not only the two
the spec names (§9).

Names: I found no other games' or anime names in either file. Content rules: nothing of concern.

## Findings

### HIGH 1: today's projectile step kills a routed bolt before it bounces (pierce, splash, maxTravel)

§2 relies on "hits on every leg" and "a bounce refills pierce". Three existing rules in `projectileStep` break this,
and the spec doesn't override any of them:

- **Pierce.** `src/sim/towers.js:2218-2222`: `p.pierce--; if (p.pierce <= 0) p.dead = true`. Her maxed pierce is 2
  (awaken), or 4 at Mirror Hall tier 3. The legs run along the road by design (§1 Auto), so a bolt spends its pierce on
  the first enemies of leg 0 or 1 and dies before reaching a mirror. The refill never happens. The spec must say that a
  routed bolt with its pierce spent stops hitting but flies on to its next mirror, and that only the final leg ends it.
- **Splash.** Shattered Glass gives her bolts `splash` (`src/data/unitsExpansion.js:492` on, and §4 keeps "bolts splash
  on impact"). A splash shot bursts and dies at its first contact (`towers.js:2205-2210`). A splash shot with no target
  explodes when it reaches `tx/ty` (`towers.js:2172-2181`), so a routed splash bolt aimed at a mirror explodes **on
  mirror 0**. A splash shot with no target also homes (`towers.js:2159`). The 2-0-5 build (today's 5.78M crowd) would
  therefore never bounce. Fix: the bolt carries `splash` 0 on its mirror legs and gets her splash only on the final leg.
  The bounce splash (`relay.bounceSplash`) stays a separate stat.
- **maxTravel.** `spawnProjectile` sets `maxTravel = range × 1.4 + 2` (`towers.js:740`). For Iroha that is 5.2–6.5
  tiles. `towers.js:2225` kills a bolt past it. Two mirrors can stand up to 2 × reach apart (7.4–10.2 tiles, more with
  Tryout's +1.2), and a 5-bounce route covers far more than that. Define it, for example as reset at each bounce to the
  next leg's length plus slack, and for the final leg as `range × 1.4 + 2`.

### HIGH 2: allies' copies routed to her next mirror die on the way (maxTravel, guided drones, splash)

§3 sends the copy to her next mirror. The copy is built like today's (`src/sim/mirrors.js:121-124`), and that breaks
three ways:

- The copy's `range: reach` gives `maxTravel = range × 1.4 + 2`. The leg from the crossed mirror to her next mirror can
  be longer than that, especially for short-range shooters, so the copy dies mid-leg.
- A drone copy keeps `guided: true`, and `guidedStep` (`towers.js:2091-2097`) fizzles any guided shot without a live
  target at once. A drone copy routed to a mirror point dies on its first step. §3 lists drones explicitly. The spec
  must say that a guided copy flies unguided on its mirror leg(s) and turns guided on the final target, or that guided
  copies are not routed.
- A splash copy flying at a mirror has no target, so it explodes on arriving at the mirror (`towers.js:2172-2181`), not
  "at its first contact". Say which one is intended.

### HIGH 3: the balance plan is not credible as written (bounces add nothing on a boss)

- §4 drops every projectile add on Mirror Hall. Today tier 2 adds +1, tier 4 adds +2 and tier 5 adds +2
  (`unitsExpansion.js:478-481`), giving 7 bolts a volley. She also fires a second volley from the panel
  (`towers.js:855-857`, `relay.both`). So 5-0-2 throws **14** bolts an attack today against the spec's **2**. Tier 5's
  pierce +2 is gone too.
- §2 hits each enemy "once per bolt (its `hits` list)". On a single boss, bounces therefore add **zero** hits. Her best
  boss build (5-0-2) falls to about 2/14 of 1.08M, roughly 155k, before any knob. Reaching ~2M needs about ×13–14 on her
  boss damage. The `iroha` row today is `boss: 3.9` (`src/data/balance.js:52`), so it would become about ×50.
- Polish (2-5-0) scales the hit on the leg where the boss is crossed. The legs run along the road where the bench holds
  the boss, so the boss is usually hit on leg 0 or 1 at the lowest scale and never again. "Every bounce hits harder"
  barely touches a boss. It is also unclear whether `bounceMul` adds across tiers (§4 says "tier mods add to them": 0.15
  + 0.25 + 0.40 + 0.60 = 1.40 a bounce) or whether each tier states the new total (0.60). Write the totals.
- A single per-girl knob can't raise 5-0-2's boss ×14 without pushing 2-5-0 and 2-0-5 (548k and 506k today, which keep
  bolts closer to today's count) far past Kage. The OWNER_BOARD Q8 promise ("close to Kage on a boss ... no build of hers
  gets weaker") is unsupported.
- **Needed before the build tunes:** a projected table per build (bolts a second × hits a bolt can land on a boss / on
  the crowd stream, today against new) for all six cells. Also a mechanic that gives the network single-target value.
  Options: a bolt's `hits` reset at each bounce (each leg can hit each enemy once, still bounded by `BOUNCE_CAP` and the
  pierce refill), or keeping Mirror Hall's projectile adds. Then choose the knob.

### MEDIUM 1: the co-op `aim` case drops the slot

- The wire is fine: `isValidCmd` allows `a.length <= 4` (`src/online/coop/commands.js:106`). The protocol bump refuses
  older clients (`sameVersion` compares `proto` and `data`, `src/online/coop/version.js`), and the kit change moves the
  data hash anyway.
- But the `aim` case destructures only `[uid, qx, qy]` (`commands.js:378-384`) and silently drops `a[3]`. A builder who
  only touches `Sim.setAim` ships a slot that never arrives in co-op.
- Define the validation. Absent means the nearest mirror. Otherwise the slot must satisfy `Number.isInteger(k) && 0 <= k
  < MIRROR_MAX`, else `invalid`. JSON turns `undefined` into `null`, so `aim[uid, qx, qy, null]` must also be defined,
  either as nearest or as invalid.
- None of the three senders forward a slot: `aimArgs` (`src/ui/battle/controller.js:1525`), `act.aim(uid, x, y)`
  (`controller.js:1565`, and solo `:586`), and `send()` (`src/ui/battle/aimControl.js:100`). None of them is in the
  spec's file list.
- Rejoin and resync carry the generic sim checkpoint (`src/sim/snapshot.js`, which stores every reachable field) plus
  the command log. New per-tower and per-projectile state rides along on its own. Any step budget or resume cursor (the
  web's "remaining beams wait for the next tick", the shard budget) must live on the sim or a tower, or be reset at the
  start of the step, never in module scope across steps. Say so.

### MEDIUM 2: the fate of `t.aim` for a mirror girl, and legacy saves

§1 introduces `t.mirrorAim[k]` but never says whether a mirror girl still has `t.aim`. Every reader of it needs a
decision:

- `src/ui/battle/snapshot.js:373` (`am`) and `:605` (restore);
- `KNOWN_TOWER_KEYS` `:225` (`mirror2`, which goes away) and `:233`. The new keys `mirrorAim`, `mirrors` and `webTick`
  must be classified, or `tests/battle-ui/snapshot.test.js` fails;
- `src/ui/battle/towerPanel.js:157` (the drawer redraw signature: placing mirror 2 wouldn't redraw the chips);
- `src/ui/battle/drawerView.js:187-188` (AUTO is lit by `!t.aim`);
- `src/render/rosterFx.js:701-709` (a reticle at `t.aim`);
- `src/sim/tryout/breaks.js:190` (a Hall Pass move re-clamps only `t.aim`, so placed mirrors past the new reach are
  never re-clamped; §1 covers upgrades only).

Saves from live v0.1.61 hold Iroha's panel as `am`. The spec must map a legacy `am` to **slot 0** (her panel was her
relay origin, now mirror 0), not to "nearest".

The `mr` design itself is sound. The tier replay (`snapshot.js:589-600`) runs before the aim replay (`:605`), so her
count is right when the slots are replayed.

### MEDIUM 3: phone UI at 844×390 is under-specified, and the board drag fights the camera

- The aim row is built in `towerPanel.js:301-313`, not only in `drawerView.js`. Her row becomes AUTO, PLACE, a count
  chip and up to 5 numbered chips: 8 targets in a drawer that is in phone layout at 390 px tall (`isPhone`: height ≤ 480,
  `src/ui/battle/util.js:13-14`). Give the layout:
  - one row or two;
  - whether the count chip folds into the numbered chips;
  - the minimum chip size;
  - what scrolls.
- There is no way to return **one** mirror to Auto (`clearAim` resets all). Add a way, such as a long press on a chip, or
  say why not.
- `src/render/boardInput.js` treats a one-finger drag as a camera pan in free camera mode and offers only
  `onTap`/`onLongPress` (`:71`). A mirror drag needs a new drag hook and a camera-policy exception
  (`src/render/cameraPolicy.js`). Neither file is listed.
- The 0.6-tile grab radius is about 30 px at this height, and it overlaps:
  - her own tile when an Auto mirror stands on her (no road in reach);
  - other mirrors (which one is grabbed? Say nearest, ties to the lower slot).
- PLACE must end, as Set aim does today, when a card is armed, an ability aim starts or a pick starts (the "board-tap
  modes never stack" rule in `aimControl.js:12-14`). State it so mirror placing never eats a placement tap.

### MEDIUM 4: files a builder will trip on are not listed

- `src/sim/mods.js:543`: the relay normalisation keeps only `kind`, `reach` and `both`.
- `src/sim/mods.js:813-815`: the relay merge only adds `reach`. Without changes here, `mirrors`, `bounces`, `bounceMul`,
  `bounceSplash`, `shards` and `allyBounces` never reach `t.stats`, and `mirrors`' "keep the max" rule needs its own
  case.
- `src/sim/constants.js` (the new caps).
- `src/sim/abilities.js:36, 274, 1059-1068` (the deploy `mirror` cast and end, its reach, the `t.mirror2` note).
- `src/data/abilityText.js:187-191` (the name and text of Laser Web).
- `src/ui/battle/controller.js` and `towerPanel.js`.
- `src/render/boardInput.js` and `src/render/cameraPolicy.js`.
- `src/sim/tryout/breaks.js`.
- `src/render/mirrorPanel.js`, `src/render/attackFx/index.js:173-182` (`mirrorSplit` copies) and
  `src/render/BattleRenderer.js`.
- `src/ui/upgradeTags.js:402` (a relay tier shows only "Reach +").
- `src/ui/screens/student.js:246` ("fires from both").
- Her tips and bio, `unitsExpansion.js:463-468` ("She fires from two places").
- `src/data/unitTips.js`.
- Tests: `tests/sim/mirrorShift.test.js` and `tests/render/irohaMirror.test.js`, which will break, and
  `perf.mirror.test.js`, which imports `collectMirrors`.

Other mirror users:

- Another Iroha in co-op: today a shot from where a girl stands splits at another owner's mirror (`mirrors.js:13-16`).
  The spec makes all her bolts born `split`, so two Irohas no longer feed each other. That is fine, but say it is a
  deliberate change.
- Drones: see HIGH 2.
- Sentries: fine.
- `MIRROR_GATHER` 24 is below 6 × 5 = 30 in the spec's own perf board. The 25th and later mirrors, in tower order, never
  reflect. That is deterministic, but in co-op the later-placed player's Iroha silently reflects nothing. Note it in the
  display or raise the cap.

### MEDIUM 5: Laser Web is unmeasured, and overlapping beams multiply on one enemy

- Auto mirrors spread along the road (§1), so on a straight stretch all `m(m−1)/2` beams lie on one line.
- An enemy between the middle mirrors sits inside every beam that spans it: 6 of 10 at five mirrors.
- At one hit a beam per `WEB_TICK` (5 ticks a second) × `dmgMul` 2.0, that is about 60 hits of her damage a second,
  against 2–3 bolt hits a second. The web reaches bosses too.
- `r5Bench` never casts, so the §9 plan never sees it.
- Add a per-enemy rule: for example one web hit per enemy per tick, or `dmgMul` split across the beams that hit it.
  Measure the web with `tools/abilityBench.mjs` like the other casts (`docs/BALANCE.md:198`).

### MEDIUM 6: the perf plan leaves out the two costliest features

- §6 measures 6 Irohas at 5-0-2. That board has neither Laser Web running nor the Kaleidoscope build (splash plus two
  shards on every bounce, up to `SHARD_BUDGET`).
- Add Laser Web active on all six at once (60 beams; `WEB_HITS_PER_STEP` caps hits, not the 60 grid queries a tick) and a
  2-0-5 board.
- Bound the worst step, not only the mean.

### LOW

1. **Where a leg ends.** State that a leg's end point is read when the leg starts and stored on the bolt. Otherwise a
   drag or relocation mid-flight leaves undefined where in-flight bolts go.
2. **Zero-length legs.** Placed mirrors can coincide, and every Auto slot can stand on her (no road). Say that a bolt
   bounces at most once a step and how a zero-length leg is normalised. Say whether a bounce splash re-hitting the same
   crowd on stacked mirrors is intended: splash has no `hits` list, so stacking multiplies it.
3. **The final-leg pick** must skip enemies in the bolt's `hits`. Otherwise `towers.js:2152` drops the target and the
   bolt flies straight until maxTravel.
4. **Shard order.** `SHARD_BUDGET` is described as "in tower order", but bounces resolve inside `updateProjectiles` in
   projectile-list order (`towers.js:2239-2251`). Say projectile order.
5. **Routing below tier 3.** The route hook must run outside the `sim._abilOn` gate (`towers.js:2241`). An Iroha below
   Mirror Hall tier 3 has no ability, but her bolts still bounce.
6. **Beam counts and reach.** "1 beam at 2 mirrors" can't happen: the web unlocks at Mirror Hall tier 3, and tier 2
   already gives 3 mirrors, so the counts are 3, 6 and 10 beams. Auto's reach for a mirror deploy is `relay.reach`
   around her (`abilities.js:274`), while the refusal uses "her range of a mirror". Align the two.
7. **Hash.** `src/online/coop/simHash.js` hashes no mirror spot or `webTick`. Add them, as other features did, so a
   desync shows at once.
8. **Range rings.** She fires when an enemy is within her range of any mirror. Say whether each mirror draws a range
   ring. Her tip says "The second range ring is centred on the panel".

## Verdict

**NOT OK.** To clear before the build counts as approved:

- HIGH 1: routed bolts die early (pierce, splash, maxTravel);
- HIGH 2: allies' routed copies die (maxTravel, guided drones, splash at the mirror);
- HIGH 3: the balance plan (bounces give no single-target value; Mirror Hall's projectiles are dropped; per-build
  projection missing);
- MEDIUM 1: the co-op `aim` slot validation and its senders;
- MEDIUM 2: what happens to `t.aim`, and legacy `am` saves;
- MEDIUM 3: the phone layout and the board drag against the camera;
- MEDIUM 4: unlisted files and other mirror users;
- MEDIUM 5: Laser Web overlap, and no measurement of it;
- MEDIUM 6: the perf plan.
