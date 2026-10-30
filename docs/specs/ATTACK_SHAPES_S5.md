# Attack shapes S5: six more unique attacks

| | |
|---|---|
| Status | Design spec, **approved** by review round 3 (`docs/review/attack-shapes-s5/review-r3.md` on `review/attack-shapes-s5-r3`; its one sentence and LOWs are folded in, §14) after round 1 (§12) and round 2 (§13). The owner accepted the defaults on Oct 30. Build: S5a then S5b on `feature/attack-shapes-s5` |
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
2. **Shape hits are clean and unshared.** They carry damage only: no statuses, marks, pushes, splash or silence. Midori's mist carries nothing but its own damage-over-time status, `spore`, which no other girl's system reads (§3.1). This is S1 A3 #7, S3 A8 #9 and S4 A9 #2 again. They also carry `noShare: true`, so Ena's share hook in `Sim._hit` (`Sim.js:593-600`) neither shares them nor splits them (Q5).
3. **Shape hits draw no rng.** A shape hit takes her expected crit as a plain multiplier, `1 + c × (m − 1)` with `c` = her `critChance` clamped to [0, 1] and `m` = `critMul || 1.5` (as `computeHit` reads them, `combat.js:91-92`), and never rolls. The shared `sim.rng` therefore sees exactly live's draws. That removes the partner and seed noise of A7 / A9 and makes the gate's live-vs-branch cells exact.
4. **A lone enemy reads live.** Where a shape would hit the enemy her attack just struck (or, for a projectile attack, just aimed at), it rolls past it (Kanna's quake rule, A8 #9). The gain lands on crowds. Suzu's tolls are the exception: a bell rings for whoever stands by it. The owner accepted "no gain on a lone boss" (Oct 30, pending any override).
5. **A shape never takes room from a live object.** Shape shots and shape rings have their own caps and evict only shape objects. When a cap is full the shape skips; the live object is never cut, and **live caps never count shape objects** (review r1 H1, H2; r2 H1').
6. **Shape damage never moves who gets a buff.** Every allocation that ranks girls by their damage reads her damage *without* her shape damage. Today those are brews and links (`recentDps`, `buffs.js:219`, `:83`), a rally's own pick (`topDamageGirl`, `abilities.js:717`) and a drink's target (`drinks.js:33`). The fifth ranker is `projectedDps` (`buffs.js:56-65`), the tie-break of the brew / link sort, which alone picks a brewer's first brew while every `recentDps` is still 0. **S5 shape lines never enter `projectedDps`**: they feed only the panel (`Sim.js:1616`) and the drawer (review r3 M-A). So a partner never loses a brew, link, rally or drink to an S5 girl. Shape damage still counts everywhere it is shown: the results screen, the honest DPS readout, achievements and stats (review r2 M-2).

With 1–3, 5 and 6, every gate cell is live's number plus the shape's damage. The bench heals targets every step, so their paths, statuses and rng are identical. The tuning question is therefore **how much stronger**, never "is anything under". This "never below live" is a claim about **the healed bench and the gate**, and the gate is the measure. In a real battle the extra damage kills sooner, which moves splitters, enrage timers and the crowd behind them. That is a different battle, not a nerf, and the finales (§7.7) check it. The proposal (Q9) is her ruler +10–30 % at the shape tiers, the Blade Cyclone's range.

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
| The shape-damage tally | `Sim._hit` / `Sim._dot` → `_credit` (`Sim.js:622`, `:735`, `:759`, `:772`) | Rule 6. A hit spec with `shape: true` (set by `shapeSpec`) or a DoT tick of a status whose type is `spore` (keyed on the type in `_dot`, because `applyStatus` copies only `type`, `duration`, `dps`, `pct`, `attackType` and `sourceUid`, `status.js:44-54`) also adds its dealt damage to `t.shapeDealt`. The four allocators read `damageDealt − shapeDealt`: `recentDps` (`buffs.js:219-220`, both the delta and `_dmgMark`), `topDamageGirl` (`abilities.js:717`) and the drink target (`drinks.js:33`). `damageDealt` itself still includes shape damage, so the results screen, the honest DPS readout (`src/ui/battle/dpsView.js`) and stats show it. `shapeDealt` is a running total saved with the tower like `damageDealt` (neither is in `hashSim`; their effects reach it through enemy HP). A hero's damage XP (`Sim.js:778`, Luna) still counts shape damage, which can only level her faster. |
| `noShare` in `Sim._hit` | `src/sim/Sim.js:597` | The tether condition gains `&& !spec.noShare`. A shape hit is neither split by `ownShare` nor sent down Ena's threads (rule 2, Q5). Live hits are unchanged. |
| `shapeRoom(sim, t, n, perGirl)` | `src/sim/rings.js`, beside `straightRoom` | Rule 5 for straight shots. Shape shots carry `p.shape = true`. It counts **live and shape** straight shots against the live caps (STRAIGHT_PER_PLAYER 200, STRAIGHT_PER_SIM 400) and its own per-girl cap, but it **evicts only shape shots**: hers first, then her player's, then anyone's. It returns how many of the `n` fit. The caller spawns that many and skips the rest. Shape shots spawn with `split: true`, so `updateProjectiles` never tests them against Iroha's mirrors (`towers.js:2247`), and `mirrors.js` needs no new branch. |
| The `straightRoom` guard | `src/sim/rings.js:42`, `:52` | **`straightRoom` skips shape shots** both when counting (`if (!p.straight \|\| p.dead \|\| p.shape) continue;` at `:42`) and when evicting (the same at `:52`). Live caps therefore see only live shots, exactly as today, and a live volley never evicts a live shot because shape shots are on the field (review r2 H1': 380 live pins + 20 charms would otherwise make a 16-pin Kinu volley evict 16 live pins). With no shape shot on the field the guard changes nothing, so live hashes do not move. Fuu's fans (`links.js:70`, `:80`) are live straights and are counted as before. |
| Her attack's victims | `attackPulse`, `attackBeam`, `attackChain`, `volleyFrom` (`towers.js:899`, `:1121`, `:1179`, `:869-896`) | A small refactor, **only for a girl with an S5 shape stat** (`t.stats.cres`, `charms`, `moon`, `web`; other girls never get the field, so their perf and snapshot keys stay the same). Each fills `t._struck`, a scratch uid array reused across attacks with no allocation, with what it hit: the pulse's `victims` (already a fresh array, `:903`), the beam's `linePierce` hits, the chain's victims **in the `cur` walk order** (not the `Set`'s), and `volleyFrom` pushes **all** its `targets` (today it returns only `targets[0]`; its return value is unchanged). Return values and live behaviour are unchanged. A shape that keeps a skip list stores **a copy** (`p.skip`, one copy per throw, shared read-only by that throw's shots), because `t._struck` is overwritten by her next attack or an echo. |
| The `S5` constants block | `src/sim/constants.js`, appended | Caps, clocks and widths below. One block, as S1–S4. |
| `endS5Wave(sim)` | beside `endHeldWave` / `endLinkWave` / `endGroundWave` | Every S5 object ends at the wave clear: `sim.statics`, `t.tolls`, `t.wheelK`, pass counters, shape shots (as `endRingWave` ends straights). **One exception: Suzu's bells survive the wave clear** (`Sim.js:981`, traps are `'snap'`, `src/ui/battle/snapshot.js:135`). `endS5Wave` sets each surviving bell's `tollCd` to 1, so a calm save holds a constant on every bell (§3.6). |
| `hashSim` folds | `src/sim/Sim.js` | Each new list folds only while non-empty (old battles keep their hash). |
| Battle-save classes | the snapshot classifier | New lists `calm`; per-step scratch (`t._struck`) `scratch` (S4 pattern). `tr.tollCd` rides in the trap record (`snap`); a restored armed trap without it reads 1. |
| ~~Shape DPS for the panel~~ (superseded by §15 deviation 2: no panel line) | a new `s5Dps` beside `shapeDps` / `heldDps` / `linkDps` | Each new shape adds its on-one-target and crowd lines for the panel (`Sim.js:1616`) and the drawer only. **`projectedDps` (`buffs.js:56-65`) is never given the S5 keys** (rule 6, review r3 M-A). |
| Mods registration | `src/sim/mods.js:170-176`, read at `:699` | `SHAPE_NORM`, `SHAPE_ADDS` and `SHAPE_SETS` entries for the six keys `mist`, `web`, `cres`, `moon`, `charms` and `toll`. Without them the tier mods are silently dropped. |
| The spore icon | `src/render/actors.js:40-49` (used at `:935`, `:973`) | `STATUS_ICONS.spore` = the poison icon, placed in `STATUS_ORDER` beside `poison`. An enemy with both shows one poison icon. |

The existing shared blocks used as they are: the direction table (`src/sim/dirs.js`: `nearestDir`, `turnToward`, `COS2`, `dirAngle`), the shape tests (`inCone`, `nearSegment`, `inBand`, `inDisc`), the held channel (`channel.js`), the tether group record and walk (`tieTether` / `nextLink`), `spawnStraight`, `chainNext` (`towers.js:1163`). **Not reused as-is** (review r1): `retFlip` retargets and clears the hit list (`links.js:134-150`), so Rei gets a straight `crescentFlip`. `sendQuake` reads `t.stats.quake`, sizes rings by her range and counts against Kanna's caps (`ground.js:43-53`, `:143-157`, `:194-197`), so Suzu gets her own `sendToll`. `straightRoom` evicts other girls' live shots (`rings.js:47-58`) and counts every straight shot, so shape shots use `shapeRoom`, and `straightRoom` gains a guard that skips shape shots (review r2 H1').

---

## 3. The six, girl by girl

Tier numbers below are **starting values for the bench fit**, not final.
Every shape knob is a plain per-tier field on the tier's mods (A3 #9), so the data reads as the fit set it. **The S5 stat keys are new names**: `mist`, `web`, `cres`, `moon`, `charms` and `toll`. They never reuse S1–S4's `ret`, `wheel` or `sweep`, which Fuu's, Momo's and Umeko's code reads (`t.stats.ret`, `t.stats.wheel`, `t.stats.sweep`); a shared key would run their branches for an S5 girl.

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
- Every `CH_TICK` (6 steps) the cone (`inCone` over `sim.grid.query`, victims by (d², uid), capped) strikes each victim once with `shapeSpec(t, spec, mist.mul × rate × CH_TICK × STEP)` and the tip falloff (`streamFalloff`, × 0.85 at the tip). Its only status is **`spore`**, a damage-over-time of its own: `dps` and `pct` = the sum of her `eff` poison entries × `mist.dot`, for her poison's duration. Her `eff` already carries her balance row, Potential `dotMul` (P2, P4, P6) and Evergreen Venom's `statusAdd`, so `spore` follows them. `mist.mul` tunes the ticks and `mist.dot` the spore, which is the larger gain (review r1 M3), so both are fit. No chance, so no rng.
- **Why `spore` and not `poison`** (review r2 M-3; it replaces round 1's guard). Every system that reads poison reads `e.statuses.poison` by that key:
  - Catalyst Burst detonates it (`abilities.js:582-601`), and its Auto counts it (`:1390`, `:1402`).
  - A poisoned death spreads it (`spreadDot`, `potential.js:133-134`, from `Sim.js:805`).
  - Poison blocks siphon healing (`enemies.js:369`) and regeneration (`:501`).
  - The merge takes `left = max` with whoever lands next (`status.js:97-105`).

  A mist that wrote `poison` would show up in all of these and move other girls: a support Midori's Catalyst could fire earlier on a smaller pile, and another girl's weaker poison could be absorbed into the mist's. A separate key `spore` is seen by none of them, so the mist is invisible to every other girl. Midori's own flask poison is a different key, so the two stack on her enemies, which is a gain for her only.
  - **`spore` in `status.js`**: `applyStatus` takes it in the burn / poison branch (`:47`: `dps`, `pct`). It merges only with another `spore`, per key `>=` as poison does. `STATUS_ELEMENT.spore = 'poison'`, so a poison-warded enemy is immune, as to her flask.
  - **`spore` in `enemies.js`**: it ticks in `updateEnemy` beside poison (`:493`) through `sim._dot(e, 'poison', …)`, so it takes poison's damage rules (ignores armour, poison's type rules, `DOT_PCT_BOSS_MUL` on bosses) and credits her, with `shape: true` for rule 6. It is left out of the siphon block (`:369`), the regen block (`:501`), `spreadDot`, Catalyst and its Auto count.
  - With no `spore` on the field, every live path is unchanged.
  - Renderer: the poison look.
- Her slow and her paralysis stay on the flask (rule 2). The paralysis keeps its live 20 % roll per flask hit, so her stun count and rng are live's.
- The mist reaches flyers from T3 on, because her spec has `canHitAir`.
- Gear Pierce adds victims (A7 #8's carry into `t.ch.px`).
- State is `t.ch` only (integers), ended by a sabotage, a Move, her sale or the wave clear.

**Must keep working.** Swift Draught brews (her kit timer, untouched). The P5 Cauldron Bomb rhythm, which is her flask harder with a splash, untouched because the flask is her attack. P6 Double Batch (+1 brew target). P2 / P4 / P6 `dotMul` scale the mist's `spore` as they scale the flask's poison (the spore is derived from her `eff` poison). Drinks and gear scale her spec. The mist reads it. Catalyst Burst (another path) is unaffected.

**Parity.** Every enemy in the cone gains the ticks and her `spore`; her flask poison and everyone else's statuses are exactly live's. Boss cells: the held boss is in her splash already. Its gain is the mist's ticks plus her `spore`, small (the lone-enemy rule cannot apply to a held stream; the ticks are her ruler's +). Her ruler is "judged by boost" (`docs/BALANCE.md` round 5), and her brews are unchanged. Her own crowd number is expected to land at +15–30 %.

**The credit question, answered (review r1).** The poison merge is per key `>=` (`status.js:97-101`), and the stronger poison keeps its values and `sourceUid`. With `spore` as its own key the question no longer arises: no poison of anyone's is ever merged with the mist.

### 3.2 Raika: Static Web on Storm Rhythm T4–T5

**Why this path.** Storm Rhythm is "Tempo and interrupts" (`units.js:1038-1044`), and the original catalogue put "a lingering static link" there (ATTACK_SHAPES §5.10). Endless Thunder (T5) names the "keeps zapping" half. Forked Lightning is her pure-chain and boss path (Raijin's Wrath ×2.5 vs bosses) and Overcharge her lance, so both stay. Her ⚡ Drumstorm (`abilities.js:332`) is on this path. It adds +2 / +4 jumps for its duration, so Drumstorm webs grow with it.

| Tier | Live | With the shape |
|---|---|---|
| T3 Drum Roll | +30 % speed, silence 0.5 s | unchanged |
| T4 Thunder Festival | +40 % speed, +2 jumps, silence +0.5 s, pen 3, +25 % damage | all of that, **plus Static Web**: links last 2 s, a zap every 15 steps (0.25 s), `web.share` 0.15 |
| T5 Endless Thunder | double speed, +8 damage, +3 jumps, Brittle + crack, +45 % damage | all of that, **plus**: links last 3 s, a zap every 12 steps (0.2 s), `web.share` 0.2 |

**Player sees.** Her bolt jumps from enemy to enemy as today. The enemies it struck then stay joined by thin flickering yellow zig-zags. Four (five) times a second a zap runs along the zig-zags and every linked enemy jolts. When linked enemies drift too far apart the link snaps, and when fewer than two remain the web fades. Tier text, T4: "…; the enemies her bolt strikes stay linked by static for 2 s, zapped 4 times a second."

**Sim.** It reuses S4's group record and tie walk, but **not the share hook** (Q5). Its zaps carry `noShare`, so the hook skips them too (review r1 M5):

- A static web is `{ uid, owner, m: [enemy…], left, zapCd }` in a new list `sim.statics` (not `sim.tethers`). Ena's threads and Raika's webs then coexist on the same enemy without fighting over `e.tie`. Members are her first bolt's chain in hit order: the `cur` walk of `attackChain` from her first `start` (`towers.js:1189-1198`), recorded into `t._struck`. That is not the `hitSet` `Set`'s order. Capped at STATIC_MEMBERS 12. A chain of one (a lone enemy) makes no web, so a lone boss reads exactly live (rule 4).
- Her counted attack: if her lead target is already in one of her webs, that web's `left` is refreshed and nothing new is made (S4 A9 #10). Otherwise a new web is made, unless every member is already in a web, any owner's (a second Raika makes none: no double zaps). Caps: STATIC_PER_GIRL 4 (her oldest goes first), STATIC_PER_SIM 48 (no new web past it).
- Each step, for each web in creation order: `left−−`. When `zapCd` hits 0 it resets to `web.every`. Members that died, entered a tunnel or stand further than STATIC_REACH (her `chainJump(spec)` × 1.5) from the previous member in the list drop out. Then every remaining member takes one hit of `shapeSpec(t, spec, web.share × rate × web.every × STEP)`. Per second each member takes `web.share × rate` of her bolts, which is `web.share` of her bolt DPS on it. The zaps are unshared (rule 2), so a member also tied by Ena's threads does not echo them. Shock, silence, Brittle and crack stay on the bolt (rule 2). With fewer than 2 members, or `left` 0, the web ends.
- Zap budget: STATIC_ZAPS_PER_STEP 128. Past it, the remaining webs skip this zap (their `zapCd` stays 0 and they zap next step). That is a deferral, not a drop, because zaps are her own damage. The stress board's expected peak is about 30.
- Her eligibility for the zap is her spec's (`canHitAir`, veils by her detection). Members are walked with `chainNext`'s tie order, so the same enemies are picked as by her bolt.

**Must keep working.** P3 Branching Bolt (+1 jump) and P6 Monsoon Drum (+1 jump; soak every 4 attacks) make bigger webs. The P4 / P5 Thunderhead novas are on her bolt, untouched. Soak's +15 % lightning bonus applies to zaps because they are lightning hits. Drumstorm's jumps. Gear Pierce adds jumps (`shotPierce`) and so members. Drinks.

**Parity.** The boss and walking boss are exact (no web on a lone enemy, no rng). Crowd: + zaps on up to chain+1 members. She is a crowd girl (ruler 2.20M), so the expected crowd lands at +15–25 %.

### 3.3 Rei: Crescent Return on Whirlwind T4–T5

**Why this path.** Whirlwind's T3 is already called Crescent Gale (`units.js:366`). Its T4–T5 are her crowd tiers, and the catalogue listed "Rei (a thrown blade wave that returns)" under Homecoming Throw (§5.6). Duelist (single target) and Counter Form (stun / knockback) stay. Her ⚡ Hurricane Draw (`abilities.js:265`, rate ×2.5–3) throws more crescents for its duration, under the caps below.

| Tier | Live | With the shape |
|---|---|---|
| T3 Crescent Gale | 9 targets, +2 damage, +0.3 range | unchanged |
| T4 Tempest Dance | +50 % speed, +4 damage, +4 targets, ×1.25 elites, +30 % damage | all of that, **plus Crescent Return**: one crescent per sweep, out to her range + 2.0 tiles and back, half-width 0.45, 6 cuts a leg, `cres.mul` 0.3 a cut |
| T5 Thousand Petal Storm | hits everything in reach, +14 damage, +60 % speed, +0.6 range, crits, ×2.5 bosses | all of that, **plus**: out to her range + 2.5 tiles, 10 cuts a leg, `cres.mul` 0.35 |

**Player sees.** She draws and everything in her reach falls as today. A pale pink crescent of air also leaves her blade toward her target, flies on past the edge of her reach, slows, turns and comes back to her. It cuts walkers further down the road both ways. Tier text, T4: "…; every sweep sends a crescent wave out past her reach and back."

**Sim.** Fuu's fan idea as a **straight** throw with its own flip. Her Whirlwind has no push, so S4's homing fix (A9 #1) is not needed, and S4's `retFlip` is not used: it retargets the fan at its aim and clears the hit list (`links.js:134-150`), which would home a crescent onto a live lead boss and drop rule 4's skip (review r1 M1):

- After her pulse (`attackPulse`, `towers.js:899`; its victims in `t._struck`), she spawns one straight record (`spawnStraight` in `shapeRoom`, `p.shape`, `split: true`, no `target`, `aim: null`, `splash` 0) along `nearestDir(lead − her)`, with `cres: { leg: 0, n: 0, cuts }` and `maxTravel` = her range + `cres.out`.
- **Cuts go through their own branch** (review r2 M-1). `projectileStep` kills a shot when `p.pierce` reaches 0 (`towers.js:2219-2222`), before the `maxTravel` check (`:2226-2228`), so a crescent counting down `p.pierce` would die on its way out in a crowd. A `p.cres` branch beside the `p.ret` one (`:2213`) calls `crescentCut(sim, p, e)`: it hits, pushes `p.hits` and counts `cres.n`, and never touches `p.pierce`. When `cres.n` reaches `cres.cuts` (+ her gear Pierce carry), on leg 0 the crescent **turns at once** (`crescentFlip` from where it is, and the rest of that step's contacts are left), and on leg 1 it ends. At `maxTravel`, a `p.cres` branch at `:2228` calls `crescentFlip` in place of `retFlip`.
- `crescentFlip` (new, in `links.js` beside `retFlip`), on leg 0 (at `maxTravel`, or early when its cuts run out): it negates `vx` / `vy` exactly (no trig) and sets `leg` 1. `maxTravel` becomes the distance it flew out (`p.travel`), and `travel` 0. It clears `p.hits` and resets `cres.n` to 0. On leg 1 it returns false and the crescent ends where it was thrown from. It never sets a target, so nothing is chased.
- **The skip list is its own field**, `p.skip` (uids), **a copy** of `t._struck` taken at spawn (an echo or her next sweep overwrites `t._struck`). It is read in `projectileStep`'s contact scan beside `p.hits` (`towers.js:2193`). It is never cleared by the flip, so both legs roll past the sweep's victims (rule 4). A held boss in her reach is never cut by her crescent, so her boss rows are exact. A walking boss is cut on the way in, before it reaches her.
- **Ground only:** her spec has `canHitAir: false` (`units.js` Rei base), and the crescent uses it. It is born `split: true`, so mirrors never reflect it.
- Each cut is `shapeSpec(t, spec, cres.mul)`. Her crits, ×2.5 vs bosses and ×1.25 vs elites ride on the multiplier (her spec's tier multipliers stay; S4 A9 #8). She never waits for a crescent (A9 #4).
- Caps: `shapeRoom` with CRESCENTS_PER_GIRL 8 (her oldest crescent ends early; rule 5). A full field skips the crescent and never evicts a live shot. Gear Pierce adds cuts a leg (her pulse's carry, A7 #8).

**Must keep working.** P3 Third Step and P5 Breaking Petal rhythms, which are her sweep harder with a stun / shred: one crescent per counted sweep, statuses on the sweep only. P6 Twin Crescent's echo (`echo: 0.3`): an echo is one more sweep, so one more crescent, at the echo's share (`mul × 0.3`). Hurricane Draw's `maxTargets: 99` means her sweep takes everything in reach and the crescent only what lies beyond.

**Parity.** The held boss is exact. The walking boss and crowd gain. Her ruler is crowd (1.82M), expected +15–30 %.

### 3.4 Luna (hero): Moonbeam Sweep at Lv 22 and Lv 25

**Why these levels.** A hero has no paths. Her Lances branch is her beam line (`src/data/heroTracks.js:108-135`). Lances.5 at **Lv 22 "Lunatic Lance"** is its last rank, the hero analogue of tier 5 (Kanna's quake took her Lv 24, A8). **Lv 25 "Lunar Sovereign"**, her capstone, adds the second moonbeam.

| Level | Live | With the shape |
|---|---|---|
| Lv 17 Full Moon Lance (lances.4) | +8 damage, +4 pierce, ×1.25 elites | unchanged |
| Lv 22 Lunatic Lance (lances.5) | one more beam, +8 damage, +20 % speed | all of that, **plus one Moonbeam**: swings ±45° (30 steps) round her lead target, one pass per volley, strikes up to her pierce a pass, `moon.mul` 0.35 |
| Lv 25 Lunar Sovereign | +15 % damage, +2 pierce | all of that, **plus a second Moonbeam** swinging the other way (both at 0.3) |

**Player sees.** Her moon beams still flash at her targets with every volley. A long, soft, held moonbeam also stands from her staff and swings across them, one side to the other with each volley, back on the next. At Lv 25 two moonbeams cross like scissors. Level text, Lv 22: "…; a moonbeam swings across her targets with every volley."

**Sim.** Umeko's Searchlight Sweep (`held.js` sweep, `nearSegment`, half-width SWEEP_HALF_WIDTH 0.25) changes in one way: **a pass is her counted attack, not a fixed swing rate.**

- Each counted beam volley (`attackBeam`, `towers.js:1121`, untouched) starts a pass from the side where the last one ended to the other. The pass lasts P = min(her cooldown in steps, 36) steps and covers 2 × arc table steps, using an integer accumulator (Bresenham). No fractional angle, deterministic at any attack speed.
- The centre follows `nearestDir(lead − her)` at `turnToward` 1 step a step.
- Every SWEEP_TICK (2) steps the segment is tested. Each enemy is struck at most once a pass, up to her pierce a pass, in crossing order (step, then grid order, then uid).
- Pre-seeded skip: the victims of this volley's beams (`t._struck` from `attackBeam`, rule 4), so a lone boss reads live. Strikes are unshared (rule 2). Each strike is `shapeSpec(t, spec, moon.mul)`.
- Moonbeam two at Lv 25 is the same with the phase mirrored (`240 − k` about the centre, as reverse arms).
- State: `t.ch` (S2's record, its memory integer pairs) with a pass counter. The Moonfall ult and the Moonbrand skill are untouched. Her gravity statuses (slow, Brittle, stun and freeze chances) stay on her beams (rules 2 and 3), so her stun and freeze rolls are live's.

**Must keep working.** Her level multipliers (`balance.js:153` `luna`, HERO_POWER), the Potential P2 Long Moonbeam pierce (more strikes a pass), P4 / P6 rate (passes follow her volleys), the court aura, Moonfall's haste (faster volleys mean shorter passes; a pass lasts at most 36 steps, 0.6 s, and when the next volley comes first it starts the next pass from where the beam is).

**Parity.** Heroes are not on the no-nerf gate (`noNerfGate.mjs` header: every HERO_POWER ≥ 1). Use Kanna's method (A8): copies of the light bench's harness and round 5's maxed harness with her placed as the hero at Lv 22 and Lv 25 (XP and Mastery held), plus `tools/heroTrack.mjs` for the 25-level track (no level below live). The lone boss is exact. Crowd: expected +10–20 %.

### 3.5 Miko: Charm Wheel on Purification T4–T5

**Why this path.** Purification is her "Holy talismans" path (`units.js:1098-1103`). Divine Wind (T4) is "three talismans per throw", and a divine wind turning a wheel of paper charms is the path's picture. Blessing (her ⚡ Shrine Chorus, `abilities.js:338`) and Sacred Grounds are her aura paths and stay. Her aura is untouched on every path.

| Tier | Live | With the shape |
|---|---|---|
| T3 Exorcism Rite | silence 0.8 s, reveal 2 s | unchanged |
| T4 Divine Wind | three talismans a throw, +6 damage, +2 pierce, pen 2, +25 % damage | all of that, **plus a Charm Wheel of 9**: a wheel of 10 evenly spaced spokes that turns `charms.turn` 10 steps (15°) each throw, minus the spoke nearest her target's line; each charm pierce 1, travel = her range, `charms.mul` 0.25 |
| T5 Amaterasu's Mirror | a piercing holy beam (6), +20 damage, +1.5 range, silence +1 s, ×1.5 bosses | the beam as live, **plus a Charm Wheel of 12** (13 spokes minus the one nearest her line) with every flash, `charms.mul` 0.3 |

**Player sees.** Her three talismans fly at her targets as today. A ring of small white-and-red paper charms also bursts out from her all round, flying straight to the edge of her range, and each throw's ring sits a little further round than the last, so over a few throws the wheel visibly turns. At T5 the mirror's beam flashes and the wheel of 12 goes out with it. Tier text, T4: "…; a wheel of 9 paper charms spins out with every throw." T5: "…; the charm wheel grows to 12 and goes out with every flash."

**Sim.** Momo's Blossom Wheel (`attackWheel`, `wheels.js:50`) **spokes only**. Her own attack (`attackProjectile`, or at T5 `attackBeam`) is untouched and is the "lead":

- **The wheel is fixed to the world and turns.** After her counted attack the wheel has m = n + 1 spokes at `wrapDir(t.wheelK + floor(j × 240 / m))`, j = 0…m − 1. The spoke nearest her target's line k0 = `nearestDir(lead − her)` is dropped (the smallest circular distance to k0, ties to the lower j), and the other n leave as straight charms. **No charm ever flies down her line:** every remaining spoke is at least half a gap (12 steps, 18°, at T4) from k0, whatever `wheelK` is. The first version, `k0 + spoke(i) + wheelK`, put a charm on her line whenever `spoke(i) + wheelK ≡ 0 (mod 240)` (review r1 M2).
- `t.wheelK` (an integer, new) advances by `charms.turn` each counted attack, mod 240. That is the Pinwheel's lock-free turn from S1 A3 #4, read from her own attack count, so no clock and no rng.
- **The skip list is the throw's selected targets.** At T4 her talismans are projectiles, so who they will hit is unknown when the charms spawn. `t._struck` holds the targets `volleyFrom` aimed at (all of them, from the refactor in §2). At T5 the beam is instant, and `t._struck` holds its `linePierce` victims. Each charm carries **a copy** of it as `p.skip` (one copy per throw, shared read-only by that throw's charms; rule 4). A lone boss is always a selected target, so her boss row is exact. A charm cuts the first eligible enemy it meets that is not in its skip list, with swept hits. Each cut is `shapeSpec(t, spec, charms.mul)`, unshared. Charms spawn in `shapeRoom` with `split: true`.
- Holy's own on-hit rules still apply, as with Hotaru's holy cuts (A3 #7): a cut ends phasing and silences field casters. That is the attack type's rule, not her statuses.
- Caps: `shapeRoom` with CHARMS_PER_GIRL 48 (rule 5: her oldest charms go first, a full field skips spokes, live shots are never evicted). `t.wheelK` ends at the wave clear. Gear Pierce adds to her talismans (live), not to charms (one cut each).

**Must keep working.** Her whole aura track (P2–P6 aura keys, Festival Bells), her ⚡ Shrine Chorus, gear on her own talismans, mirror copies (Iroha's mirrors copy her talismans with their share, as live, and never reflect a charm, which is born `split: true`; `towers.js:2247`).

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
- `sendToll` pushes `{ uid, x, y, r: 0, max: toll.r, hit: [] }` onto **`t.tolls`** (her own list, never `t.quakes`). `tollTick(sim, t)` runs beside `groundTick`, which is untouched, under its own `if (t.tolls)` guard (`groundTick` runs only under `t.spikeRows || t.quakes`), **before the sabotage check** (`groundTick` at `towers.js:2037`, the check at `:2038`), so a sabotaged Suzu's rings still grow as her bells still stand. It grows each ring at TOLL_SPEED 6 tiles/s and strikes what `inBand(prevR, r)` finds. It shares only `inBand` and `shapeSpec` with S3. Caps count `t.tolls` only: TOLLS_PER_GIRL 32 and TOLLS_PER_SIM 128 (the sum over girls' `t.tolls`). At a cap the bell defers its toll a step, and nothing is evicted (rule 5). Kanna's QUAKES caps never see a toll.
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
| Spore Mist | `t.ch` (S2's), the `spore` status on enemies | cone victims by (d², uid), capped | none (rule 3; `spore` has no chance) |
| Static Web | `sim.statics`: members as enemy refs serialised by uid, `left`, `zapCd` | webs in creation order, members in chain order | none |
| Crescent Return | a straight projectile with `cres` (leg, out) and its own `skip` uid list | `projectileStep` order | none |
| Moonbeam Sweep | `t.ch` + pass counter and Bresenham accumulator | crossing order (step, grid, uid) | none |
| Charm Wheel | `t.wheelK`, straight shots with `skip` | spawn order (j order, the dropped spoke by circular distance, ties lower j) | none |
| Bell Toll | `tr.tollCd` on traps (survives the wave clear as the constant 1), `t.tolls` rings | `sim.traps` order, then ring order | none |

- Directions come only from the table (`nearestDir`, `turnToward`, `dir`), distances are squared, and timers are integer steps. There is no `Math.random`, no runtime `sin` / `cos` / `atan2` / `hypot`, no `**` and no `Map` / `Set` in the new code. The grep test covers the new files and the new functions.
- `hashSim` folds `sim.statics`, the toll timers (only while some trap has one), `t.wheelK` and the pass counters only while present. It also folds **shape shots in flight** (uid, kind, `cres.leg`, `cres.n`, x, y, travel in 1/256 tiles, `hits.length`, `skip.length`), only while one flies, as S4 folds fans (`src/online/coop/simHash.js:146-152`; projectiles are not hashed anywhere else). Enemy statuses and girls' `damageDealt` are not in `hashSim` today (`src/online/coop/simHash.js`), so neither `spore` nor `t.shapeDealt` is folded. Their effects reach the hash through enemy HP, as poison's do. An old battle's hash is unchanged.
- Every S5 object ends at the wave clear, so the wave-end checkpoint carries none of them. The one exception is the bells' `tollCd`, which is 1 on every surviving bell, a constant. (`t.shapeDealt` is a running total like `damageDealt`, not an object.) A **mid-wave rejoin** replays from the checkpoint and the log, so every new field must be rebuilt by replay alone. No field may depend on render time.
- The renderer reads only sim state (`t.ch`, `sim.statics`, projectile records, `sim.traps[i].tollCd`, `t.tolls` rings, enemies' `spore`) and uses seeded visual randomness, never `sim.rng`.
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

Target: `tests/sim/perf.test.js` "S5 attack shapes" under the same 2 ms limit. It asserts the real straight-shot ceiling with the guard, 400 live + the per-girl shape caps (6 Mikos × 48 + 6 Reis × 8 = 336, so ≤ 736), and aiming at ≤ 0.5 ms a step locally (S2–S4 read 0.30–0.44 ms). The existing perf cases must not move beyond noise (best of three, as A9). Renderer: plain effects only (§6), within the S1–S4 allowances.

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

1. **The no-nerf gate** (`tools/balance/noNerfGate.mjs`, the BALANCE.md round 5 recipe): her paths at tiers 1–5, crowd / boss / walking boss. Both `--support um` and `--support none`, all three profiles (maxed, L1, L40), seeds 9/1/2, tolerance ×0.995. Run in the live tree and on the branch, then `--compare`. Expected result with rules 1–3, 5 and 6: **every untouched cell identical, every touched cell ≥ 1.000** (no seed noise to explain). Any under-cell is a bug, not noise.
2. **The ability bench** (`tools/abilityBench.mjs --tiers`, strong preset, 120 s, Auto off / on): the pinned column, which caught the Blade Cyclone. Rei (Hurricane Draw), Raika (Drumstorm), Suzu (Bell Carpet) with their ⚡ on.
3. **The light bench** (`tools/bench.mjs`, A4's four configurations + L25) and the maxed hit bench (`bench.mjs --hit`), for the A4-style table in the as-built addendum.
4. **Luna**: Kanna's hero harness copies at Lv 22 and Lv 25 and `tools/heroTrack.mjs` (no level below live).
5. **Partners**: with rules 2, 3 and 5, Aoi (light bench) and Umeko + Midori (gate) must read **bit-identical** beside every S5 girl. Any move means a shape drew rng, laid a status, shared through a tie or took a live object's room. Midori is no exception any more: `spore` is invisible to every other girl's system (§3.1). Rule 6 keeps brews, links, rallies and drinks where they were.
   **A brewing support beside each S5 girl** (review r2 M-2): Midori 5-0-2's brews and links, and a rally / drink girl's picks, beside each S5 girl. The picks and the partner's cells are bit-identical to live.
   **Catalyst on Auto beside Midori** (review r2 M-3): an ability-bench row (`tools/abilityBench.mjs --tiers`, Auto on) with the support Midori 5-0-2 casting Catalyst Burst beside Field Kit Midori T4 / T5. The support's casts (count and steps) and burst damage are bit-identical to live.
   **Ena beside each shape** (review r1 M5): Ena at Shared Fate T4 / T5 with each S5 girl. Ena's own cells must be bit-identical to Ena beside that girl's live build, and the S5 girl's must be live plus her shape (shape hits unshared).
6. **The ceiling gate** (`tools/bench.mjs --hit --ceiling --maxed geared`): report each S5 girl's row. Under "no cap", a row over the limit is a recorded exception (`CEILING_EXCEPTIONS`, as Kage), not a trim, if the coordinator agrees.
7. **Finales** (the round-5 set): no win becomes a loss. It should not, since everything is ≥ on the bench, but kill timing moves real battles (rule note above), so they run. The goldens re-pin.
8. **The LR bar** (owner: an LR beats every non-LR; review r1 M4). After S5, `tools/balance/lrBench.mjs` runs, and each S5 girl's maxed tier-5 row is compared with the LR rows' bar. The LR `t5` rows sit a quarter past the best SSR crowd, Hotaru's 8.67M (`src/data/balance.js:100-113`). The S5 rulers (Rei 1.82M, Raika 2.20M, Suzu 1.87M, +30 % at most) stay under 3M, so no crossing is expected. **If one ever crosses, the LR rows are raised. The S5 girl is never trimmed.**

The fit: each shape's knob (`mist.mul` and `mist.dot`, `web.share`, `cres.mul`, `moon.mul`, `charms.mul`, `toll.mul`) is set so her ruler lands in the band Q9 picks (default +10–30 %). It is reported as live → new in DPS and as a ratio, per tier and profile.

---

## 8. Risks

| Risk | Why | Mitigation |
|---|---|---|
| Mist poison seen by other girls (Midori) | Catalyst, its Auto, spreadDot, the siphon and regen blocks and the poison merge all read `poison` (review r2 M-3) | The mist writes its own key `spore`, read by none of them (§3.1) |
| Shape damage moves buff picks | `recentDps`, `topDamageGirl` and the drink target rank girls by damage (review r2 M-2) | Rule 6: they read `damageDealt − shapeDealt` |
| Kill credit in real battles | A shape kill takes the last hit from a partner whose kill effects need it (Chigusa's thorn beds `Sim.js:795`, Finale Pop `:803`) | Accepted: as with any stronger girl, kills move in a real battle. It never happens on the healed bench, which is the measure, and the finales check real battles |
| A crescent dies on its way out | `p.pierce` death before the `maxTravel` flip (review r2 M-1) | Its own `crescentCut` branch; it turns early when its cuts run out |
| Shape objects take live objects' room | `straightRoom` evicts other girls' straight shots, and `room()` counts every girl's quake rings (review r1 H1, H2) | Rule 5: `shapeRoom` evicts only shape shots and skips at the cap; tolls have their own `t.tolls` and caps |
| Bell state in calm saves | Traps survive the wave clear (review r1 H3) | `tollCd` paused between waves and set to 1 at the clear; old saves read 1; save/restore test |
| Too strong in real battles | Additive shapes are ≥ by construction, so the only failure is excess: tolls on a full Bell Carpet, webs on a dense stream | The fit band (Q9), the ceiling gate, finales; caps per girl and sim |
| The panel / drawer honest DPS lies | A new damage source not in `shapeDps` | ~~Each shape adds its line; the drawer test pins one number per shape~~ Superseded by §15 deviation 2: the panel is her one-target figure, which the S5 shapes leave exactly live, so there is no line and no drawer test |
| Mid-wave rejoin drift | New per-trap and per-girl fields, shape shots in flight | The engines battle rejoins mid-wave with every shape live; hashSim folds every new state field and the shape shots in flight (§4) |
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

- **Geometry**: who is inside the mist cone (the tip falloff); which enemies join a web (chain order, ties by uid, the reach snap); the crescent's legs (exact negation, a fresh hit list, the skip list on both legs); the sweep's pass (Bresenham steps from one side to the other per volley, crossing order, once a pass, the pierce cap, the skip); the charm wheel (m spokes at `wheelK + floor(j × 240 / m)`, the one nearest k0 dropped, ties to the lower j; `wheelK` advance); the toll ring band from a bell.
- **Timing**: mist ticks every 6 steps; zaps every 15 / 12 steps; a toll on the first armed step, then every 90 / 72 steps; the crescent's turn step.
- **Rules 1–6**: her live attack's hits and rng draws are identical with and without the shape (count `sim.rng` calls); shape hits carry no statuses (Midori's mist: `spore` only) and `noShare`; expected crit equals `1 + c(m − 1)`; a lone enemy takes exactly live's damage (Midori's held boss and Suzu excepted, asserted separately).
- **Caps and eviction**: webs 4 / 48 (her oldest first; no new web past the sim cap), zaps 128 a step deferred; crescents 8 and charms 48 a girl, via `shapeRoom` (oldest shape shot first, skip when nothing but live shots is left); toll rings 32 / 128, deferred, never evicted.
- **Lifetimes**: the wave clear ends every S5 object (surviving bells keep `tollCd` 1); sabotage / Move ends the mist and the sweep (channels), webs survive her sabotage (threads on enemies, A9 #11) and end with her sale; crescents and charms end with straight shots on her sale; bells toll on while she is sabotaged (traps are road objects, A8 #3) and her sale removes them as live.
- **Interactions**: each Potential key in §3 (P-rhythms count as live; Twin Crescent's echo throws a crescent at 0.3; Temple Bell's count ignores tolls); drinks and gear scale shape damage; Drumstorm / Hurricane Draw / Bell Carpet; Swift Draught brews unchanged; Moonfall; Iroha's mirrors never reflect charms or crescents (`split: true`) and copy her talismans as live.
- **hashSim**: an old battle's hash unchanged; the new state folded only while present.
- **Review r1 cases**:
  - **H1**: 6 Kinus with their straight shots at the per-player and per-sim caps, plus Miko T5 and Rei T5. The Kinus' damage and shot counts are bit-identical with and without Miko's and Rei's shapes. Shape shots are skipped, not the Kinus'.
  - **H2**: Kanna at Lv 24 and Suzu T5 with Bell Carpet, with Kanna's quake rings at QUAKES_PER_SIM. Kanna's ring count and damage are bit-identical with and without the tolls.
  - **H3**: save and restore across a wave clear with armed bells (`tollCd` 1 on each, the next wave's first armed step rings). Restore an old save whose armed traps have no `tollCd` (reads 1). Hash equal across the round trip.
  - **M1**: a crescent whose lead boss is alive when it turns. The way home neither chases the boss nor cuts it (skip list intact), and it ends where it was thrown from.
  - **M2**: T4 Miko against a lone boss is bit-exact to live. For every `wheelK` 0…239, no charm's direction is closer than 12 steps to k0 (T4).
  - **M3** (r1, superseded by r2 M-3): `mist.dot` scales `spore`'s `dps` / `pct`.
- **Review r2 cases**:
  - **H1'**: Kinu at the straight caps (380 live pins) with 20 charms and a crescent in flight. Her next 16-pin volley evicts exactly what it evicts in live (none at 380 + 16 ≤ 400), and charms are skipped instead. The same with Fuu's fans in place of Kinu.
  - **M-1**: a crescent whose leg-0 cuts run out at a crowd turns there, comes home and ends where it was thrown. A crescent that never cuts turns at `maxTravel`.
  - **M-2**: beside each S5 girl, Midori 5-0-2's brew and link targets (her first brew too, picked by `projectedDps` alone), a rally's own pick and a drink target are bit-identical to live. `projectedDps` of each S5 girl equals live's. `damageDealt` includes shape damage, and `damageDealt − shapeDealt` equals live's `damageDealt`.
  - **M-3**: with Field Kit Midori's mist on the field, no enemy's `poison` differs from live. The support's Catalyst count, Auto steps and bursts are bit-identical. `spreadDot` and the siphon / regen blocks are unchanged.
  - **The skip copy**: `p.skip` keeps its uids after an echo (Rei's Twin Crescent) and after her next attack overwrite `t._struck`.
  - **`_struck` scope**: a girl without an S5 stat never gets `t._struck` (snapshot keys unchanged).
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
| **Shared base** (built first, in S5a): `shapeSpec` and `noShare` 0.2; `shapeRoom` + the `straightRoom` guard 0.15; the `t._struck` refactor 0.15; the shape-damage tally in four allocators 0.15; constants, `endS5Wave`, hashSim (shape shots in flight too), save classes 0.25; shape DPS lines 0.1 | 1.0 |
| **S5a** (projectiles and rings): Charm Wheel 0.4, Crescent Return (own cut branch, flip and skip) 0.7, Bell Toll (own `sendToll`, trap save across the clear) 0.7 | 1.8 |
| **S5b** (held and links): Spore Mist with the `spore` status 0.6, Moonbeam Sweep (pass per volley, hero harness) 0.75, Static Web (new list, zap clock, snap) 0.75 | 2.1 |
| Plain renderers (six, mostly reuse) | 0.5 |
| The fit and the gates (two full no-nerf gates per tree, about 9k cells each; ability bench; hero harness; ceiling; finales) | 1.0 |
| Engines battle with the mid-wave rejoin, perf case | 0.5 |
| Review rounds (two halves) | 0.5 |
| The LR bench check (§7.8); Ena-, brew- and Catalyst-beside runs (§7.5) | 0.3 |
| **Total** | **≈ 7.7 days** |

By half: **S5a ≈ 4.3** (the shared base 1.0, its shapes 1.8, and half of the renderers, gates, engines, review and beside runs, 1.5). **S5b ≈ 3.4** (its shapes 2.1, and the other half, 1.3; Luna's hero harness sits in her 0.75). S5a carries all the straight-shot risk, so it goes first.

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
| 12 | Midori's mist: slow and paralysis too? | **No**, its own `spore` damage-over-time only (rule 2: crowd control on everything in a cone is the pile-up of A8 #9). Her flasks keep both. |

---

## 12. Review round 1: what changed

Review round 1 (`docs/review/attack-shapes-s5/review-r1.md` on `review/attack-shapes-s5-r1` 190bc42) found 3 HIGH, 5 MEDIUM and 6 LOW issues, and the body above now carries every fix:

| Finding | Fix | Where |
|---|---|---|
| H1 `straightRoom` evicts partners' live shots | Rule 5; `shapeRoom` evicts only shape shots and skips at the cap; mirrors never copy shape shots; the 6-Kinu cap test | §0 rule 5, §2, §3.3, §3.5, §5, §9 |
| H2 `sendQuake` would refuse Kanna's rings | Suzu's own `sendToll`, `t.tolls`, `tollTick`, caps, speed and mul; `groundTick` untouched; the Kanna + Suzu cap test | §3.6, §5, §8, §9 |
| H3 traps survive the wave clear | `tollCd` paused between waves and set to 1 by `endS5Wave`; old saves read 1; hashed for toll owners; `tollTick` before the sabotage check (round 2); the save/restore test | §2, §3.6, §4, §9 |
| M1 `retFlip` retargets and clears hits | A straight `crescentFlip`, a separate `p.skip`, `aim: null`, ground only, never mirrored | §3.3, §4, §9 |
| M2 Miko's T4 victims unknown at spawn; a charm on her line | Skip the throw's selected targets (T5: the beam's victims); a world-fixed wheel of n + 1 spokes minus the one nearest her line | §3.5, §9 |
| M3 Midori's poison untunable and not clean | `mist.dot`; the poison guard (no poison or hers); the siphon block stated; the merge answer recorded; Midori excepted in §7.5 for siphoners (**superseded in round 2** by the `spore` status, §13) | §3.1, §7.5, §8 |
| M4 the LR bar | §7.8: `lrBench` after S5; raise the LR rows, never trim the S5 girl | §7 |
| M5 shape hits share along Ena's ties | `noShare` on every shape hit; Ena-beside runs | §0 rule 2, §2, §3.2, §7.5, §9 |
| LOW expected crit | `critMul \|\| 1.5`, chance clamped to [0, 1] | §0 rule 3, §2 |
| LOW victims not returned | The `t._struck` refactor, called out | §2 |
| LOW zap wording | Per second: `web.share × rate` bolts | §3.2 |
| LOW tunnel-hidden bells | Dropped (bells are never in a tunnel) | §3.6 |
| LOW the board's hop | Render only, stated | §3.6 |
| LOW "never below live" | Stated as a claim about the healed bench and the gate | §0 |

---

## 13. Review round 2: what changed

Review round 2 (`docs/review/attack-shapes-s5/review-r2.md` on `review/attack-shapes-s5-r2` 6708b91) found 1 HIGH, 3 MEDIUM and 7 LOW issues. Each one was checked against the code before the fix:

| Finding | Fix | Where |
|---|---|---|
| H1' live `straightRoom` counts and evicts around shape shots (`rings.js:40-56`) | `straightRoom` skips `p.shape` in both loops (a no-op with no shape shot); `shapeRoom` counts live + shape, evicts only shape; the "unchanged" sentence is gone; Fuu's fans in the test | §0 rule 5, §2, §9 |
| M-1 a crescent dies on `p.pierce` before the flip (`towers.js:2219-2228`) | A `p.cres` cut branch that never touches `p.pierce`; it turns early when leg 0's cuts run out, ends on leg 1; a `p.cres` flip branch at `maxTravel` | §3.3, §8, §9 |
| M-2 shape damage feeds `recentDps` and brew / link picks | Rule 6: `t.shapeDealt`. **Beyond the review:** `topDamageGirl` (`abilities.js:717`) and the drink target (`drinks.js:33`) also rank by `damageDealt`, so all four allocators read `damageDealt − shapeDealt`. Shown totals keep shape damage | §0 rule 6, §2, §7.5, §8, §9 |
| M-3 the mist's poison is seen by Catalyst, its Auto, spreadDot and the merge | The mist writes its own `spore` status, which none of them read (nor the siphon or regen blocks); it ticks with poison's damage rules. That replaces round 1's guard and removes the Midori exception. Catalyst-on-Auto bench row | §3.1, §4, §7.5, §8, §9 |
| LOW `p.skip` must be a copy | A copy at spawn (one per throw) | §2, §3.3, §3.5, §9 |
| LOW `_struck` scope and `volleyFrom` | Only for S5-stat girls; reused array; `volleyFrom` records all its targets; Raika's order from the `cur` walk | §2, §3.2, §9 |
| LOW mirrors | Shape shots born `split: true` (`towers.js:2247`), no `mirrors.js` branch | §2, §3.3, §3.5 |
| LOW shape shots in the hash | Folded while in flight, as S4 fans | §4 |
| LOW `tollTick` order | Before the sabotage check | §3.6 |
| LOW stale §9 text | The charm wheel, the shape-shot caps and "tolls defer, never evict" corrected | §9 |
| LOW the estimate | The shared base named (1.0) and split by half; +0.4 for round 2's fixes: 7.7 days | §10 |
| Also found | S5 stat keys renamed (`cres`, `charms`, `moon`, `web`): the first draft's `ret`, `wheel` and `sweep` are live S1–S4 keys. Kill credit in real battles (thorn beds, Finale Pop) is accepted and stated; hero damage XP from shape damage only levels Luna faster | §2, §8 |

---

## 14. Review round 3: approved, with these folded in

Review round 3 (`docs/review/attack-shapes-s5/review-r3.md` on `review/attack-shapes-s5-r3` f065472) approved the spec. One sentence was to be added, plus five LOWs. All are folded in above:

| Finding | Fix | Where |
|---|---|---|
| M-A `projectedDps` is a fifth damage ranker (the first brew) | S5 shape lines never enter `projectedDps`; the panel and drawer only; added to the M-2 test | §0 rule 6, §2, §9 |
| LOW the `shape` flag on `spore` is not copied by `applyStatus` | Rule 6 keyed on `status.type === 'spore'` in `_dot` | §2 |
| LOW no `spore` icon | Mapped to the poison icon; one icon when both | §2 |
| LOW mods registration | `SHAPE_NORM` / `SHAPE_ADDS` / `SHAPE_SETS` for the six keys | §2 |
| LOW the straight ceiling | The perf case asserts 400 + 336 | §5 |
| LOW `tollTick` guard | Its own `if (t.tolls)` | §3.6 |

---

## 15. S5a as built (feature/attack-shapes-s5)

Miko's Charm Wheel, Rei's Crescent Return and Suzu's Bell Toll, with the shared S5 base. They are built on balance round 5 (`origin/feature/balance-r5` 04bcc258, the LR bar gate in). Code is in `src/sim/s5shapes.js`, `shapeSpec` / `allocDealt` in `shapes.js` and `shapeRoom` in `rings.js`; the contract is `CONTRACTS.md` "Attack shapes S5a".

| Girl, path | Tiers | Data (`src/data/units.js`) |
|---|---|---|
| Rei, Whirlwind | T4 Tempest Dance, T5 Thousand Petal Storm | `cres { out: 2, cuts: 6, mul: 0.3 }`, `{ out: 2.5, cuts: 10, mul: 0.35 }` |
| Miko, Purification | T4 Divine Wind, T5 Amaterasu's Mirror | `charms { n: 9, turn: 10, mul: 0.25 }`, `{ n: 12, mul: 0.3 }` |
| Suzu, Explosive Mines | T4 Chain Mines, T5 Grand Bell Detonation | `toll { every: 90, r: 1, mul: 0.18 }`, `{ every: 72, r: 1.4, mul: 0.2 }` |

**Changes from the spec, and why:**

1. **Suzu's tolls are stronger than the starting values:** ×0.18 / ×0.2, not ×0.12 / ×0.15. At the starting values her maxed crowd read +8 % / +9 %, under Q9's +10 % floor. Her gain scales with the knob, so the knob was raised.
2. **No panel line for S5a.** The panel's DPS (`towerStats`) is her figure on one target. The S5a shapes add nothing there (rule 4), so it is exactly live. `projectedDps` takes no S5 line (rule 6).
3. **Gear Pierce does not add crescent cuts.** Her pulse's Pierce carry (`pierceCarry`) is a running counter, and asking it again for the crescent would change her live pulse's carry. The crescent's cuts are its own (`cres.cuts`).
4. **An echo adds to the same throw.** `t._struck` is cleared at the start of each counted attack, so a Potential echo (Rei's Twin Crescent) adds its victims to that attack's skip list. It does not throw a second crescent; one crescent or wheel goes out per counted attack.

**The no-nerf gate** (`tools/balance/noNerfGate.mjs`, live = `origin/feature/balance-r5` 04bcc258 with the three tools in it). Every girl, every path, tiers 1–5, boss / walking boss / crowd, seeds 9 / 1 / 2, three profiles and the LR-off pass, both support settings:

| Pass | cells | missing | under live ×0.995 | cells off the shape tiers identical to live |
|---|---:|---:|---:|---:|
| Umeko + Midori | 4,455 | 0 | **0** | 4,401 of 4,401 |
| alone | 4,455 | 0 | **0** | 4,401 of 4,401 |

The shape tiers, live → S5a in DPS (maxed / L1 / L40 crowd; boss and walking boss beside):

| Girl, tier | Supported: boss / walking / crowd | Alone: boss / walking / crowd | L1 crowd (supp.) | L40 crowd (supp.) |
|---|---|---|---|---|
| Rei T4 | ×1.00 / ×1.00 / 122,978 → 146,887 ×1.19 | ×1.00 / – / 11,851 → 14,137 ×1.19 | ×1.27 | ×1.25 |
| Rei T5 | ×1.00 / ×1.00 / 1.82M → 2.07M ×1.14 | ×1.00 / ×1.00 / 171,136 → 199,090 ×1.16 | ×1.24 | ×1.24 |
| Miko T4 | ×1.00 / ×1.00 / 45,842 → 54,813 ×1.20 | ×1.00 / ×1.00 / ×1.20 | ×1.20 | ×1.20 |
| Miko T5 | ×1.00 / ×1.00 / 385,250 → 445,445 ×1.16 | ×1.00 / ×1.00 / ×1.17 | ×1.16 | ×1.16 |
| Suzu T4 | 0 → 0 / ×1.18 / 231,820 → 258,116 ×1.11 | 0 → 87 / ×1.20 / ×1.13 | ×1.16 | ×1.15 |
| Suzu T5 | 0 → 6,462 / ×1.44 / 1.87M → 2.08M ×1.12 | 2,886 → 6,842 / ×1.38 / ×1.10 | ×1.15 | ×1.16 |

Bosses are exact for Rei and Miko (rule 4). Suzu's bells ring for a boss that stands by them (the rule 4 exception).

**Rei's crescent aims at the densest line** (the coordinator's call, Oct 30; `crescentAim`). Aimed at his lead, he read only +2–4 % alone and ×1.00–1.04 at L1 / L40, though +13 % on the maxed crowd beside Umeko + Midori. Without the slowing supports the crowd streams through, and the line through his lead found about 2 walkers a throw (575 cuts from 300 throws alone). The aim weighs his lead's line and the lines toward the 24 nearest eligible walkers his sweep did not strike (CRESCENT_AIMS), scores each by the walkers a leg would cross, and takes the best. Ties go to the line nearest his lead, then the lower table index; with nobody out there it takes his lead's line, so a lone held boss still reads live. Now 5,687 cuts from 300 throws alone, and ×1.14–1.27 on every crowd row (the table above). The numbers here are after the aim: the full gate was re-run on the branch, 0 under live both ways, every non-shape cell bit-identical. The ability bench reads as before (the pinned column stands inside his reach).

**The ability bench** (`tools/abilityBench.mjs --tiers`, strong preset, 120 s, Auto off → on, both trees): Rei 4-0-2 / 5-0-2 is bit-identical to live, crowd and boss. The pinned column stands inside his reach, so the crescent rolls past it. His T5 Hurricane Draw RED (×1.5) is live's own. Suzu: crowd off 567k → 679k (T4) and 3.55M → 4.40M (T5); boss 5.9k → 28.4k and 36.6k → 237.5k. Miko 2-4-0 / 2-5-0: crowd 83.4k → 87.0k and 594k → 609k; boss identical. Nothing under live.

**The LR bar** (`tools/balance/lrBar.mjs`): all six LR builds pass (×1.39–1.40 crowd, ×2.36–4.74 boss). `--bar` re-measured with S5a reads the same bar (crowd Akane 16.47M, boss Iroha 5.96M); no S5a girl is near either top list.

**Determinism and co-op:**

- `tests/sim/s5shapes.test.js` (28 cases). The data at T3–T5. `shapeSpec` (expected crit, cleared effects). The charm directions for every `wheelK` (≥ 12 steps from her line at T4, ≥ 9 at T5). Each girl's lone boss bit-identical to a live copy of the data (HP, damage, rng draws). On a crowd: identical rng draws, her live damage identical, the shape on top. The crescent's legs, its early turn and its skip copy. Tolls: first armed step, never between waves, never triggering a bell. `straightRoom`'s guard (a live volley evicts what it evicts in live) and `shapeRoom` (evicts shape shots only). Tolls never in `t.quakes`. `noShare` against Ena's threads. `projectedDps` equal to live, and a brewer's picks bit-identical beside the S5 girls. A mid-wave co-op checkpoint continuing bit-identically for each girl. The wave clear. Twice the same battle, and plain `Math` against `withDetMath`. The grep test.
- `e2e/engines/scriptedBattle.js` `runS5aBattle` (S5A_START, 2-4 Hard): the host's Rei, Miko and Suzu at tier 5, the guest's at tier 4. Won at wave 22, 1,045 crescent cuts, 159 charm cuts, 66 toll hits, 3,121 tolls rung. The wave-3 checkpoint rejoined at tick 7,560 lands on the run. Pinned in `tests/online/engines.test.js` and checked in `e2e/engines.mjs`. SpiderMonkey and WebKit are not installed here: run `--require-all` before ship.
- Perf (`tests/sim/perf.test.js` "S5a attack shapes", 18 shape girls at tier 5, 200 enemies): 0.279 ms a step (limit 2 ms). Straight shots stay within the ceiling 400 + 336.
- **`tollCd` is not packed in the trap record** of a battle save (§2 "Battle-save classes"). It is 1 at every calm point (`endS5Wave`), and `tollBell` and `hashSim` read a missing one as `?? 1`, so a restored bell rings on the next wave's first armed step as it would have (build review r1 LOW 2).
- Pins: PENDING_BUMP {13: `722edb51def8`}. The 456-resolution stats hash is re-pinned to `2f6a4fcb`; with the three girls left out the 384 others hash `70150afc` before and after. The battle-save tower keys gain `shapeDealt` (snap), `_struck` / `_lead` (scratch) and `wheelK` / `tolls` (calm). **No `COOP_PROTOCOL` bump on the branch.**
- `npm test`: 401 files, 6,304 tests passed.

## 16. S5b as built (feature/attack-shapes-s5)

Midori's Spore Mist, Raika's Static Web and Luna's Moonbeam Sweep, on the S5a base. The branch merges `origin/feature/balance-r5` 96c3547b (Akane's Inferno Queen cone 45° → 55°, LR_BAR re-pinned at crowd 17.40M / boss 6.13M); all the gates below were run on the merged tree, against live = 96c3547b. Code is in `src/sim/s5shapes.js` (`mistTick` / `mistTarget`, `moonPass` / `moonTick`, `tieWeb` / `webStep`), the `spore` status in `status.js` and `enemies.js`; the contract is `CONTRACTS.md` "Attack shapes S5b".

| Girl, path | Tiers / levels | Data |
|---|---|---|
| Midori, Field Kit | T4 Paralysis Spore, T5 Elixir Barrage | `mist { half: 30, len: 1, cap: 32, mul: 0.15, dot: 0.3 }`, `{ half: 36, cap: 96, mul: 0.65, dot: 0.6 }` (`src/data/units.js`) |
| Raika, Storm Rhythm | T4 Thunder Festival, T5 Endless Thunder | `web { dur: 2, every: 15, share: 0.15 }`, `{ dur: 3, every: 12, share: 0.3 }` |
| Luna (hero), Moonbeam | Lv 22 Lunatic Lance, Lv 25 Lunar Sovereign | `moon { beams: 1, arc: 30, mul: 0.55 }`, `{ beams: 2, mul: 0.35 }` (`src/data/heroTracks.js`) |

**Changes from the spec, and why:**

1. **The mist follows the densest cone, not her lead** (the coordinator's crescent rule, Oct 30, applied to the mist). Her lead often stands past the mist's reach, so a cone along her lead's line found few walkers. `mistTarget` scores her lead and the CRESCENT_AIMS nearest eligible enemies within the mist's reach by how many of them that direction's cone holds. Ties go to the direction nearest her lead's, then the lower table index. With nobody in reach, it follows her lead.
2. **Midori's mist is longer, wider-capped and stronger than the starting values:** `len` 1 × her range (not 0.75), cap 32 / 96 (not 24 / 32), `mul` 0.15 / 0.65 and `dot` 0.3 / 0.6 (not 0.12 / 0.15 and 0.25 / 0.3). At the starting values her crowd rows fell under Q9's +10 % floor. Her T5's flasks already hold a crowd, so the mist's share had to be large to show. Every row is now ×1.10–1.31.
3. **Raika's T5 share is 0.3, not 0.2.** At 0.2 her T5 crowd fell under the +10 % floor.
4. **Luna's beams are stronger:** ×0.55 at Lv 22 (not 0.35) and two at ×0.35 at Lv 25 (not 0.3). At the starting values her crowd fell under the +10 % floor.
5. **No panel line** (as S5a, §15 deviation 2). The panel is her one-target figure. The mist's held-boss ticks are the only S5b damage on one target, and they stay out of `projectedDps` (rule 6).
6. **Luna's fixture cases** (`tests/sim/s5shapes.test.js`): on the straight fixture road, her 5–6 lances pierce every walker, so the moonbeams find nobody unstruck, and the crowd case allows `shapeDealt` 0 there. Her gain is measured on the bench below and in the engines battle.

**The no-nerf gate** (`tools/balance/noNerfGate.mjs`, live = 96c3547b with the tools byte-identical, the merged tree as the branch; every girl, every path, tiers 1–5, boss / walking boss / crowd, seeds 9 / 1 / 2, three profiles and the LR-off pass):

| Pass | cells | missing | under live ×0.995 | cells off the shape tiers identical to live |
|---|---:|---:|---:|---:|
| Umeko + Midori | 4,455 | 0 | **0** | 4,365 of 4,365 |
| alone | 4,455 | 0 | **0** | 4,365 of 4,365 |

The S5b shape tiers, live → S5b (maxed boss / walking boss / crowd; crowd at L1 and L40):

| Girl, tier | Supported: boss / walking / crowd | Alone: boss / walking / crowd | L1 crowd (supp. / alone) | L40 crowd (supp. / alone) |
|---|---|---|---|---|
| Midori T4 | ×1.18 / ×1.18 / 97,429 → 115,677 ×1.19 | ×1.19 / ×1.20 / 60,078 → 72,951 ×1.21 | ×1.22 / ×1.31 | ×1.19 / ×1.24 |
| Midori T5 | ×1.17 / ×1.17 / 1.08M → 1.19M ×1.10 | ×1.23 / ×1.24 / 329,001 → 406,035 ×1.23 | ×1.21 / ×1.27 | ×1.18 / ×1.23 |
| Raika T4 | ×1.00 / ×1.00 / 148,464 → 168,457 ×1.13 | ×1.00 / ×1.00 / 11,133 → 12,643 ×1.14 | ×1.19 / ×1.18 | ×1.19 / ×1.17 |
| Raika T5 | ×1.00 / ×1.00 / 1.30M → 1.45M ×1.12 | ×1.00 / ×1.00 / 139,387 → 181,502 ×1.30 | ×1.42 / ×1.37 | ×1.39 / ×1.37 |

Midori's boss rows rise by her mist's ticks on the held boss (§3.1 "Parity": the lone-enemy rule cannot apply to a held stream). Raika's bosses are exact (a lone enemy makes no web). The S5a rows read as §15, the same on the merged tree.

**Luna** (the gate has no hero rows; `tools/balance/r5Bench.mjs measure` with her levels bought to 22 / 25, a temporary copy, seeds 9 / 1 / 2, both trees):

| Level | Crowd, supported | Crowd, alone | Boss / walking boss |
|---|---|---|---|
| Lv 22 | 3.16M → 3.49M ×1.11 | 313,677 → 345,271 ×1.10 | exact |
| Lv 25 | 5.91M → 6.61M ×1.12 | 676,193 → 752,828 ×1.11 | exact |

**The ability bench** (`tools/abilityBench.mjs --tiers`, strong preset, 120 s, Auto off → on, both trees). Midori 2-0-4 / 2-0-5 / 0-2-4 / 0-2-5 (Catalyst): crowd 29.3k → 34.8k, 671k → 784k, 41.3k → 50.5k and 731k → 870k, bosses up by her mist, Auto's own gain ×1 as live. Raika (Drumstorm): crowd 121k → 140k, 1.18M → 1.53M, 169k → 195k and 1.54M → 2.01M, with Auto on as live (×1.11–1.23); bosses identical. Luna Lv 22 / 25 (Moonbrand): crowd 2.19M → 2.24M and 4.25M → 4.27M, with Auto's own gain as live (×1.07); bosses identical. Nothing under live.

**The LR bar** (`tools/balance/lrBar.mjs` on the merged tree): all six LR builds pass (×1.31–1.33 crowd, ×2.29–4.61 boss). `--bar` reads the pinned bar (crowd Akane 17.40M beside Umeko + Chika, boss Iroha 6.13M), worst LR ÷ same-pair best ×1.149. No S5 girl is in either top-10 list.

**Determinism and co-op:**

- `tests/sim/s5shapes.test.js` (49 cases with S5a's). The S5b data. Each girl's lone boss against a live copy (Midori's mist excepted, asserted alone). `spore` is its own status: Catalyst, its Auto count and `spreadDot` read poison only. The web: the chain stays linked and zapped on its clock, a lone enemy makes no web, webs end at the wave clear. The moonbeam's pass. A mid-wave co-op checkpoint with a mist, a web and a pass continuing bit-identically.
- `e2e/engines/scriptedBattle.js` `runS5bBattle` (S5B_START, 2-4 Hard): the host's Midori and Raika at tier 5 with Luna bought past Lv 22, the guest's at tier 4. Won at wave 22: 9,767 mist hits, 893 zaps, 14 moonbeam strikes, 64 webs tied. The wave-3 checkpoint rejoined at tick 6,054 lands on the run. Pinned in `tests/online/engines.test.js`, unchanged by the merge.
- Perf (`tests/sim/perf.test.js` "S5b attack shapes": 6 mists, 6 webs, Luna at Lv 25, 200 enemies): 0.53–0.62 ms a step (limit 2 ms). Zaps stay within STATIC_ZAPS_PER_STEP, webs within their caps.
- Pins: PENDING_BUMP {13: `53662b519844`} (S5a, S5b and balance round 5 together). The stats hash is `456:f6e6e8c7`. With the six S5 girls left out, the 312 others hash `a49bafea` on 96c3547b and on the merge. Battle saves gain `mist` / `moon` (tower, calm), `_chain` (scratch) and `statics` (sim, calm). **No `COOP_PROTOCOL` bump on the branch.**

**The S5a build review r1 LOWs, folded in here:** `shapeRoom` keeps her player's and the sim's overflow apart, so another player's shape shots free no room under her player's cap (shape-only). A test checks the drink and rally picks beside each S5 girl, with a direct 400 + 600 shape vs 500 probe, and Suzu joins the brewer test. A perf case reaches the toll caps (18 Suzus, a stress copy ringing every 6 steps: 128 rings, 0.08 ms a step). The engines OK line names S5a and S5b. In the plain looks, the crescent is an open arc and a bell wobbles after it rings. `tollCd` is not packed in the trap record (§15). The superseded panel and drawer rows are marked in §2 and §8. The gate's S5 cells were re-run after the `shapeRoom` change: all 1,350 are identical.
