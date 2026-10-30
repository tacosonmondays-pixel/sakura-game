# Attack shapes S5: spec review, round 3

Reviewer: a fresh independent agent (did not write the spec or review r1 / r2). Target: `origin/spec/attack-shapes-s5`
0fc42013, `docs/specs/ATTACK_SHAPES_S5.md`. I checked every claim against the code at b2f4345c.

**Verdict: OK, with one sentence to add (M-A).** The round 2 fixes hold. M-A is a gap in rule 6's list and needs one
sentence in the spec. It needs no new review round. Nothing is HIGH.

## Round-2 fixes verified

- **H1' closed.** `straightRoom` skips nothing today: `if (!p.straight || p.dead) continue;` at `src/sim/rings.js:42`
  (count) and `:52` (evict). Adding `|| p.shape` to both makes live caps see exactly live's shots. With no shape shot on
  the field it changes nothing. `shapeRoom` counts live and shape shots and evicts only shape shots, so the 380 + 20
  Kinu case evicts what it evicts in live.
- **M-1 closed.** The `p.ret` branch is at `towers.js:2213`, the pierce death at `:2219-2222` and the flip at
  `:2226-2228`, as the spec cites. The crescent has `splash` 0, so it passes the splash branch at `:2206`. With no
  target, `homing` (`:2160`) stays false, and `retSteer` (`:2149`) only runs for `p.ret`. If it turns early, the flip
  sets `maxTravel = travel`, so the way home ends where it was thrown. Leg 1 running out ends it. That is sound.
- **M-2 mostly closed.** `recentDps` (`buffs.js:219-220`), the pick sort (`:83`), `topDamageGirl` (`abilities.js:717`)
  and the drink target (`drinks.js:33`) are the only readers of `damageDealt` that pick a girl. Every other reader
  only displays it (`Sim.js:1675`, `:1691`, `chikaPanel.js`). Tryout kills (`tryout/assign.js:238`) count kills,
  which falls under the accepted kill-credit item. **But see M-A.**
- **M-3 closed.** I checked every reader of statuses. They read `poison` by name: siphon `enemies.js:369`, regen
  `:501`, the tick `:493`, `spreadDot` from `Sim.js:805` (`potential.js:133` loops over burn and poison only), Catalyst
  `abilities.js:595-601`, its Auto `:1390`, `pick: 'poisoned'` `:797` (one more reader the spec doesn't list; it doesn't
  see `spore` either). No enemy cleanse removes statuses; "cleanse" means a girl's sabotage guard. Ena's curse only
  reads `curse`. Neither `hashSim` nor the snapshot reads enemy statuses (enemies are `calm`). No achievement or bestiary
  entry reads statuses. Running the spore through `_dot(e, 'poison', …)` gives it poison's ward, armour and
  `ruleDotScale` (`Sim.js:745`, `combat.js:173-179`). `STATUS_ELEMENT.spore = 'poison'` makes a poison-warded enemy
  immune, consistent with her flask. `spore` merges only with `spore`. Nothing counts it twice.
- **Stat keys.** `cres`, `charms`, `moon`, `web`, `mist` and `toll`, and the fields `tolls`, `statics`, `wheelK`,
  `shapeDealt`, `tollCd`, `_struck` and `p.skip`, collide with nothing in `src/sim`. (`ring.skip` at `ground.js:181`
  is on a quake ring, not on a projectile. `pv.skip` is a render view.)
- **Also-found items.** I accept the kill-credit item. The tryout's "Show Her Around" kill count fits it too. Luna's
  damage XP (`Sim.js:778`) can only level her up, so I accept it.

## MEDIUM

**M-A `projectedDps` is a fifth damage ranker.** `pickTargets` breaks ties on `recentDps` with `projectedDps`
(`buffs.js:83`). `projectedDps` (`:56-65`) already adds `shapeDps` and `heldDps` for S1 and S2 girls. A brewer's
`lim.cd` starts at 0 (`buffs.js:98-102`), so her first brew is picked when every `recentDps` is 0. At that moment
`projectedDps` decides alone, and that happens in every "supported" gate cell. §2's last row says "each new shape adds
its line to `shapeDps` / `heldDps` / `linkDps`". If a builder also adds the S5 keys to `projectedDps`'s guards, as S1
and S2 did, a partner loses her first brew and the §7.5 bit-identical check fails.
*Fix:* rule 6 and §2 should say that `projectedDps` never includes S5 shape lines. Those lines feed only the panel
(`Sim.js:1616`) and the drawer. Add `projectedDps` to the M-2 test.

## LOW

- **The `shape` flag on `spore` gets lost.** `applyStatus` copies only `type`, `duration`, `dps`, `pct`, `attackType`
  and `sourceUid` (`status.js:44-54`), so `shape: true` on the spec never reaches `e.statuses.spore`. Key rule 6 on
  `status.type === 'spore'` in `_dot` instead (the tick passes `st.spore`).
- **The spore icon.** `STATUS_ICONS` and `STATUS_ORDER` (`render/actors.js:40-49`, used at `:935` and `:973`) have no
  `spore`. As written, a mist-only enemy gets no icon. Map `spore` to the poison icon, and draw one icon when an enemy
  has both.
- **Mods registration.** The six keys need `SHAPE_NORM`, `SHAPE_ADDS` and `SHAPE_SETS` entries (`mods.js:170-176`,
  read at `:699`). Otherwise the tier mods are silently dropped. Name this in §2.
- **The straight-shot ceiling.** With the guard, live shots refill to 400 while shape shots are in the air. So the
  real ceiling is 400 + the sum of the per-girl shape caps (6 Mikos × 48 + 6 Reis × 8 = 336). §5's perf case should
  assert that number, not 400.
- **Order of `tollTick`.** `groundTick` runs only under `if (t.spikeRows || t.quakes)` (`towers.js:2037`). Give
  `tollTick` its own `if (t.tolls)` guard in the same place.

## Estimate

7.7 days adds up: 1.0 + 1.8 + 2.1 + 0.5 + 1.0 + 0.5 + 0.5 + 0.3. The halves also add up: 4.3 + 3.4, with 2.8 shared,
split 1.5 / 1.3. The fixes above are text, plus about 0.05 days of tests.

## Text rules

The spec names no other games or shows, nothing is sexualised, and no player names appear.
