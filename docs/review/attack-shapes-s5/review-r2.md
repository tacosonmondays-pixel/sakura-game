# Attack shapes S5: spec review, round 2

Reviewer: a fresh independent agent (did not write the spec or review r1). Target: `origin/spec/attack-shapes-s5`
4d3ef904, `docs/specs/ATTACK_SHAPES_S5.md`. I checked every claim against the code at that commit (base b2f4345c).

**Verdict: NOT OK.** One HIGH: the H1 fix only covers half the problem. Fixing it needs a one-line guard in
`straightRoom`, and with that guard nothing changes while no shape shots exist. There are also three MEDIUM findings.

## Round-1 fixes verified

- **H2 closed.** `room()` counts only `t[key]` (`src/sim/ground.js:43-53`), so a separate `t.tolls` never meets
  QUAKES_PER_SIM, and `groundTick` (`:194-197`) stays untouched.
- **H3 closed.** `updateTraps` runs every step, calm included (`src/sim/Sim.js:392`), so "count down only in a wave"
  is needed, and the spec says it. Traps aren't in `hashSim` today (`src/online/coop/simHash.js`), so folding `tollCd`
  for toll owners leaves old hashes alone.
- **M1 closed**, apart from the pierce bug in MEDIUM-1 below. `retFlip` (`src/sim/links.js:134-150`) is no longer used,
  and Rei's base has `canHitAir: false` (`src/data/units.js:360`).
- **M2 closed.** With m = 10 the gap is 24 steps, so every remaining spoke is ≥ 12 from k0. At T5, m = 13 gives gaps
  of 18/19, so ≥ 9. Miko T5 is `behavior: 'beam'` (`units.js:1103`).
- **M3, M4 closed.**
- **M5 closed.** `&& !spec.noShare` on `Sim.js:597` leaves `tie` null, and `shareTether` only runs when it's non-null
  (`:626`, `:631`). Live specs have no `noShare`, so live hits and the hash are unchanged.
- **The LOWs are closed.** The crit formula matches `combat.js:91-92`.

## HIGH

**H1' Live `straightRoom` still evicts live shots because of shape shots.** Shape shots are `straight` records. The
unchanged `straightRoom` counts them in `player` and `all` (`src/sim/rings.js:41-46`) and evicts the oldest straight
shot in uid order, whatever its kind (`:49-56`). Example: 380 live pins plus 20 charms, then a 16-pin Kinu volley. That
volley now evicts 16 live pins; in live it evicts none. Fuu's fans are straight too (`links.js:70,80`). This breaks
rule 5, and the 6-Kinu test in §9 would fail.
*Fix:* `straightRoom` skips `p.shape` both when it counts and when it evicts (`|| p.shape` on `rings.js:43` and
`:52`). With no shape shots this does nothing. `shapeRoom` counts live and shape shots against the 200/400 caps and
evicts only shape shots. Drop the §2 sentence "`straightRoom` itself is unchanged, so a live shot can still evict a
shape shot".

## MEDIUM

**M-1 A crescent dies on its way out.** `projectileStep` kills a shot when `p.pierce` reaches 0 (`towers.js:2210-2215`).
That happens before the `maxTravel` check, and the check only flips `p.ret` (`:2226-2228`). A crescent that makes 6
cuts in a crowd never turns. *Fix:* add a `p.cres` branch at `:2228`. `crescentFlip` resets `p.pierce` to the leg's
cuts. Say what an exhausted leg 0 does (turn early, or end). Add a test.

**M-2 Shape damage moves brews and links.** Shape hits are credited through `_credit` (`Sim.js:622`), which feeds
`recentDps` (`src/sim/buffs.js:219`). `pickTargets` uses `recentDps` to choose who gets a brew or link
(`buffs.js:83`). A partner can lose a brew to the S5 girl, so §7.5's "bit-identical" check fails beside a brewing
support. That is a real-battle nerf to another girl. *Fix:* count shape damage in a separate tally that `recentDps`
leaves out (the panel already uses `shapeDps`), or list it as an accepted exception and get the owner's OK.

**M-3 Midori's mist poison is visible beyond siphons.** The guard only covers the mist landing on an existing poison.
Other effects still see it:
- The support Midori's Catalyst Burst detonates *any* poison (`src/sim/abilities.js:582-601`).
- Its Auto counts poisoned enemies (`:1390`, `:1402`, min 4).
- An enemy that dies poisoned spreads its dot (`Sim.js:805`).
- Another girl's poison landing on a mist-poisoned enemy takes `left = max` (`src/sim/status.js:104-105`).

*Fix:* widen the Midori exception in §7.5/§3.1 to cover these (all of them move numbers up). Add an ability-bench
row with the support Midori on Auto.

## LOW

- Set `p.skip` to a **copy** of `t._struck`. It is scratch that her next attack, or an echo, overwrites.
- Fill `t._struck` only for girls with an S5 stat, so other girls' perf and snapshot keys stay the same. `volleyFrom`
  returns only `targets[0]` (`towers.js:869-896`) and needs to hand back `targets`. Raika's order comes from the `cur`
  walk, not the `Set`. No allocation: reuse the array, except where `victims` is already fresh (`:903`).
- Mirrors: spawn shape shots with `split: true`. `updateProjectiles` then never reflects them (`towers.js:2247`), and
  `mirrors.js` needs no new branch.
- `hashSim` should also fold shape shots in flight (uid, leg, x, y, travel, hits, skip), as S4 folds fans
  (`simHash.js:146-152`). §4 leaves them out, and projectiles aren't hashed anywhere else.
- `tollTick` must run before the sabotage check (`towers.js:2035-2037` pattern), so a sabotaged Suzu's rings still grow.
- Stale §9 text: "charm offsets `k0 + spoke(i) + wheelK`", "charms 48 / 400", and "toll rings … the oldest first"
  (§3.6 says defer, never evict).
- Estimate: 7.3 days adds up, but "S5a ≈ 3, S5b ≈ 3.7" totals 6.7. Name the 0.6 that is shared. The fixes above add
  about 0.2 days. The S5a/S5b split makes sense, since S5a carries all the straight-shot risk.

## Test plan additions

- H1': Kinu volleys at the cap while charms are present.
- A crescent that runs out of cuts on its way out.
- A brewing support beside each S5 girl (M-2).
- Catalyst Burst on Auto beside Midori (M-3).
- `p.skip` survives an echo and the next attack.
- Every other §9/§7 item (partners, Ena-beside, Kanna-beside, mid-wave rejoin, engines, perf, noNerfGate, lrBench)
  is present and adequate.

The text rules hold: no names from other games or shows, and nothing is sexualised.
