# Attack shapes S5: spec review, round 1

Reviewer: an independent agent (did not write the spec). Target: `origin/spec/attack-shapes-s5` d2ca7e6a,
`docs/specs/ATTACK_SHAPES_S5.md`, the board in this folder. I checked the code at that commit (base b2f4345c).

**Verdict: NOT OK.** The four rules are the right ones and most citations hold. Three reuse claims don't match
the code, and each one breaks either "no nerfs" or the "nothing survives the wave clear" claim.

## Checked and correct

Tier names and numbers for all six (`src/data/units.js:363-368, 906-911, 959-964, 1039-1044, 1098-1103`); Luna
lances.5 at Lv 22 and Lunar Sovereign at Lv 25 (`src/data/heroTracks.js:130,133`); the ability paths
(`src/data/abilities.js:266,320,327,333,339`); `STREAM_KINDS.poison` (`src/sim/held.js:46`); `chainNext`/`attackChain`
hit order (`src/sim/towers.js:1163,1178`); traps never crit (`towers.js:345-347`); heroes are off the gate
(`tools/balance/noNerfGate.mjs:14`); Midori's gate support stays 5-0-2. Text: no other games' or shows' names. The
board shows abstract dots and bells only. Nothing is sexualised.

## HIGH

**H1. Straight-shot caps evict other girls' live shots.** `straightRoom` (`src/sim/rings.js:47-58`) evicts the girl's
own shots first, then her **player's** other girls', then **anyone's**, to fit `STRAIGHT_PER_PLAYER` 200 and
`STRAIGHT_PER_SIM` 400 (`constants.js:279-280`). Miko's charms and Rei's crescents placed "under straightRoom" would
kill partners' live straight shots (Kinu, Momo, Kage's arms) on a busy co-op field. That is a nerf. Fix: a shape shot
only evicts shape shots (a `shape: true` flag, passes 1-2 skip non-shape shots). When there is no room, the shape skips
the spoke or crescent. Test: 6 Kinus at cap plus Miko and Rei, and the partners' damage is bit-identical.

**H2. Bell Toll cannot call `sendQuake` as written.** `sendQuake(sim, t, spec, x, y, skip)` takes no `rings`, `max` or
`mul` options. It reads `t.stats.quake` and sets `max: spec.range` (Suzu's 2.6, not 1.0/1.4) (`src/sim/ground.js:143-157`).
`room()` counts **every tower's** `t.quakes` against `QUAKES_PER_SIM` 64 (`ground.js:43-53`, `constants.js:399-400`),
so tolls would refuse Kanna's live rings. On top of that, `groundTick` clears `t.quakes` on a girl without `stats.quake`
(`ground.js:194-197`). The spec's own TOLL caps (32/128) contradict the call. Fix: a `sendToll` that keeps its own list
(`t.tolls`), caps, speed, mul and step, and shares only `inBand` and the clean spec.

**H3. Traps survive the wave clear, so `tollCd` does too.** `Sim.js:981` ("Suzu's traps stay"), and traps are
`'snap'` (`src/ui/battle/snapshot.js:135`). §2 and §4 say every S5 object ends at the wave clear and checkpoints carry
none, but `tr.tollCd` would be in every calm save and co-op checkpoint. Fix: say what `endS5Wave` does to a surviving
bell (reset it to `toll.every`, or ring on the next wave's first step). Treat an armed trap with no `tollCd` (an old
save) as 1. Fold it into the hash and test save/restore across a wave clear.

## MEDIUM

**M1. Rei's crescent: `retFlip` doesn't do what §3.3 says.** It doesn't negate the velocity. It sets `p.target` to
`r.aim` (chasing it) or `r.home`, and clears `p.hits` (`src/sim/links.js:134-150`), which wipes the pre-seeded skip on
the way home. A live lead boss would be homed onto. Fix: a straight flip (negate vx/vy, `maxTravel = travel`), a
separate `skip` uid list read in `projectileStep`, and `aim: null`. State that crescents are ground-only
(`canHitAir: false`) and how a mirror copy treats `ret`.

**M2. Miko T4's victims are unknown when the charms spawn.** Her talismans are projectiles, so "skips the enemies her
attack struck this throw" can't be evaluated. Fix: use the throw's selected targets as the skip list (T5's beam is
instant). The claim "no charm flies down her line" (§3.5) is also false once `wheelK` turns: `spoke(i)+wheelK ≡ 0 (mod 240)`
happens. The skip list is what keeps the boss row exact.

**M3. Midori's mist poison is untunable and isn't clean.** `mist.mul` scales only the ticks. Her full poison dps (12/s
at T5, ×dotMul) lands on up to 32 enemies. That is the dominant gain, and Q9's band may be unreachable. Poison also
blocks siphon healing (`src/sim/enemies.js:369`) across the cone. The refresh `left = max(...)` (`src/sim/status.js:105`)
extends the support Midori's poison, so §7.5's "partners bit-identical" fails beside her. Fix: add a `mist.dot` knob
(or apply only to enemies with no poison or her own), and except Midori in §7.5. On the §8 risk: the merge is per-key
`>=` (`status.js:97-101`), so the stronger Toxicology poison keeps the credit. Record that answer.

**M4. The LR bar is missing.** The owner rule says LRs beat every non-LR. The LR `t5` rows are fit at "a quarter past
the best SSR crowd (Hotaru 8.67M)" (`src/data/balance.js:100-113`). The S5 rulers (1.8–2.2M, +30%) stay under 3M, so
there's no real risk, but the spec must say so. Add a §7 line: run `tools/balance/lrBench.mjs` and compare each S5 row
to the bar. If one ever crosses, **raise the LR rows, never trim the S5 girl.**

**M5. Ena's share hook fires anyway.** Every shape hit goes through `Sim._hit`, which shares along Ena's ties
(`src/sim/Sim.js:593-600`). That contradicts "Raika never touches the share hook" (Q5, §8). Fix: either flag shape hits
as unshared or state that it's accepted, and test Ena beside each shape.

## LOW

- Expected crit must copy `computeHit`: `critMul || 1.5` and a chance clamped to [0,1] (`src/sim/combat.js:91-92`).
- `attackPulse`/`attackBeam`/`attackChain` return no victims (`towers.js:899,1121,1178`). "Untouched" needs a small
  refactor that exposes them; call it out.
- §3.2 wording: per second the zaps are `zap.share × rate` bolts, not "zap.share of one bolt".
- Bells are never "tunnel-hidden" (`trapSpots` skips hidden samples, `towers.js:1213`). Drop that line.
- The board's "walkers it crosses hop" must stay a render effect only (rule 2: no pushes).
- "Never below live" holds on the healed bench. In real battles, earlier kills shift splitters and enrage. Say the
  gate is the measure.

## Test plan gaps

Add: H1's cap test, Kanna + Suzu at quake cap (H2), save/restore across a wave clear with live bells and an old-save
restore (H3), a crescent with its lead boss alive on the way home (M1), a T4 Miko lone boss bit-exact (M2), LR bench
rows (M4), and Ena with each shape (M5).

## Open questions

Q1–Q8 and Q10–Q12: I agree with the defaults. Q9 (+10–30%): agree, but it is only reachable for Midori with M3's
knob. Q3: agree, with the LOW crit fix.
