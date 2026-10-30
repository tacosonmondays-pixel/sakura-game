# Ruri's rework and the Ruri & Hana duo: independent review, round 2

Reviewer: an agent that wrote neither the spec nor review r1 (review gate, HANDOFF §6).
Reviewed: `spec/ruri-hana-duo` at `70c5969b`. It changes two files on top of review r1 (`6d905212`):
`docs/specs/RURI_HANA_DUO.md` ("spec", r2, which opens with "Changes since r1") and
`docs/review/ruri-hana-duo/OWNER_BOARD.md` ("board").

**Code references.**
- A bare `file:line` points at the spec's base, `main` `60ce9cad` (v0.1.61, COOP 13).
- Round 5 is cited at two commits on `feature/balance-r5`: `83b72083`, the one the spec names, and the branch tip
  `d6f092b7` (Oct 30, 07:13 UTC). Tip references are written `d6f092b7:path:line`.
- As in r1, `src/sim/snapshot.js` is the co-op serializer and `src/ui/battle/snapshot.js` is the battle save.

**Bench.** I ran none. r2 changes none of the light-bench "today" figures that r1 reproduced, and the machine is
loaded.

**Verdict: NOT OK.** 0 BLOCKER, 0 HIGH, 3 MEDIUM, 8 LOW.

Every r1 finding got a real answer, and most are fully fixed:
- the LR band is a floor, never a cap;
- Kon's firing point never moves;
- a walker can be lured at most twice a wave, and never while it is push-locked;
- the duo has no relay, and Kon's run is written out;
- a pre-rework Ruri on a retired path is refunded through the existing drop;
- the banner name is free.

The new names are original and clean, and "default all" spends nothing.

It is not OK because of three MEDIUM findings:
- **R2-M1.** Q7 and Q8 show the owner wrong LR numbers. Tenka's are double-counted, and round 5 has already lifted
  both LR units' boss numbers.
- **R2-M2.** The lure rules bound the delay, but Q3's "at most 10 s later than with Fuu alone" does not follow from
  them, and the planned wave-length test cannot see a stall.
- **R2-M3.** Kon's stretch is stored as a path distance, but in four modes the road turns round between waves.

---

## 1. The round-1 findings, one by one

| r1 | What r2 does (checked in the code) | Status |
|---|---|---|
| **H1** the LR cap | **Floors.** Every LR number is a floor; the knobs stop at the first value that clears it, and later passes may only raise her (spec `:426-428`; board `:73-80`).<br>**No unit lowered.** The first duo and Tenka keep their crowd numbers (`:454`), Hana is untouched, and Ruri's changes go to the owner on Q4.<br>**The duo's floors.** On both rulers for every tier-5 build, 3× for her best boss build, and her best crowd build at least the weakest other LR unit's (`:430-442`). The raw figures re-derive: 2.5 × 2.22M = 5.55M, 3 × 2.22M = 6.66M, 2.5 × 1.83M = 4.58M (`:443`). | **Fixed in substance.** The LR figures shown to the owner are wrong: R2-M1. |
| **M1** the file lists | §5.1 now lists `mods.js`, `Sim.js`, `combat.js`, `enemies.js`, `strips.js`, the duo's `potential.js` row, `unitKit.js`, CONTRACTS.md, the effect vocabulary and the battle save (`:561-620`).<br>Its claims hold:<br>• lure foxes are traps, so they end on sale (`src/sim/Sim.js:1390`) and at the wave clear (`src/sim/strips.js:281-302`; Ruri has no `stats.strip.carry`, `:292`);<br>• runners already fizzle on sale (`src/sim/runners.js:153`) and end at the clear (`src/sim/Sim.js:947`). | **Fixed**, with small omissions: R2-L2 (the display) and R2-L7 (`src/sim/headless.js`, which is hashed with the rest of `src/sim`). |
| **M2** the hunting Kon | Her targets come from Kon's spot (`t.ox` / `t.oy`, `src/sim/towers.js:809`), which moves only through `updateRelayOrigin` (`:1439-1456`). Tier 3 is a plain +1.0 range, and the hunt and the trot home are drawn only. Her reach is stated: 3.4 tiles from the spot, 6.9 from Ruri (`:205-212`). | **Fixed.** Design note: R2-L6. |
| **M3** the lures | • Two lures a walker a wave (minibosses one), at least 8 s apart.<br>• A lure holds the push lock for its length + 1.5 s, and a push-locked walker is refused.<br>• Freeplay takes lure tiles from Resolve.<br>• `lure` joins `BLINK_INTERRUPTS` (read at `src/sim/enemies.js:300`, `:321`).<br>• Lure foxes are strip records, with Spike Rain's cap rule and the positional trigger.<br>• The placement rule is written out (`:214-238`). | **Partly fixed.** The bound holds; the 10 s promise and its test do not: R2-M2. Details: R2-L1, R2-L2. |
| **M4** Kon's run | • The duo has no `relay`, so `ox = t.x` (`src/sim/towers.js:1448`) and Kaze's stoops leave the base.<br>• Kon's spot is stored apart, as `t.kon`.<br>• His stretch, when he runs, the run, his return, the `shared` runner option and Wind Chase's lane are defined, with a picture (`:335-369`, `:392`). | **Partly fixed.** The road can turn round: R2-M3. More edges: R2-L3. |
| **M5** the battle saves | • A kit mark, `kv: 2`. A row without it whose Star Falcon or Tide Otter is above tier 2 takes the existing drop (`src/ui/battle/snapshot.js:538-542`, before `placeTower` at `:547`).<br>• New timers reset at the wave clear or ride `du`.<br>• Every new field is classified (`:659-671`).<br>No coin is lost on the rows that come back. Moonhound and Bounding Fox cost the same, and so do Tide Otter and Paw Prints. Star Falcon's tiers 1–2 (400 coins) come back as Fox Tricks' (440), with `spent` kept (`:596`). | **Fixed**, with one restore gap (R2-L4) and wording (R2-L5). |
| **M6** "Field Trip" | The banner is now "Fox and Falcon Premiere", and Q15 explains all four renames (board `:142`). | **Fixed.** One naming nit: R2-L8. |
| **L1** | • Statuses use the standard status timer (`:245-247`).<br>• Wind Chase's Auto is Prismfall's `cluster` rule (`:397`; `src/data/abilities.js:90-91`, `:445`).<br>• Sure Grip is +1 stoop damage (`:508`).<br>• The pop's timing is defined, and it never crits (`:224`).<br>• Kaze flies at a fixed 12 tiles a second (`:331`). | **Fixed.** |
| **L2** | Paw and Feather, Great Stoop and Trusty Pair (`:66`, `:384`, `:395`). | **Fixed.** |
| **L3** | The board and the spec agree on lure times, gaps, locks and floors (board `:33-48`, `:73-80`). Q4 states the 2-0-5 change (board `:53`). | **Fixed.** Q3's "nobody can push it": R2-L1. Q4's scope: R2-L5. |
| **L4** | • "Default all" leaves out the Anlas spend (board `:4`, `:120`).<br>• Meshy is offered (board `:129`).<br>• Keys go in as environment secrets (spec `:643`, `:713`). | **Fixed.** |
| **L5** | R2 takes the full gate, every milestone has a patch note, and D2 rides D3 by default (`:690-704`). | **Fixed.** D2-alone wording: R2-L8. |
| **L6** | The Tryout golden, the ceiling gate with `T_ruri`, the Power refit, a factor for the duo or none, and a mid-wave checkpoint (`:679`, `:683`, `:688`). | **Fixed.** The capBot check it names: R2-L7. |
| **L7** | The gift is worked out at load and on every grant, and the title is "Fast Friends" (`:546-549`, `:658`; board `:107-112`). | **Fixed.** |
| **L8** | Reach tiers move Kon's spot (`:84`); the partner factors were ×11.7–×150 (`:463`). | **Fixed.** |

---

## 2. Focus checks

### 2.1 H1: floors, and no unit lowered

**No unit lowered.** The spec lowers no unit. Round 5's "no build falls" changes to "no job falls" for Ruri only,
and the spec puts that to the owner on Q4 (R2-L5 asks for one more line there).

**The duo's floors.** They are complete on both rulers:
- before LR, at least 1.3× on her main job and at least 1.0× on the other;
- in LR form, at least 2.5× on crowds and bosses for every build;
- her best boss build at least 3×;
- her best crowd build at least max(3×, the weakest other LR unit's best crowd).

**What is wrong.** The figures she is set against are out of date: R2-M1.

### 2.2 M3: is the bounded delay provable, and is the test meaningful?

**Bounded: yes.**
- A walker is lured at most twice a wave, and each lure lasts at most 3 s (Follow the Fox at tier 5).
- So Ruri's own walk-back per walker is finite, and "never hold it forever" follows from the count.
- In Freeplay it is bounded outright: lure tiles come out of `kbLeft` (`src/sim/enemies.js:189`), the same budget
  Fuu's pushes draw from (`src/sim/Sim.js:646`).

**"At most 10 s later": no.** The lock ends 1.5 s after the lure, and Fuu can then push the walker across ground it
had already crossed.

**The test: no.** Wave length is set by kills, and the "Fuu alone" baseline already holds slow walkers.

Both points are in R2-M2.

### 2.3 M4: Kon's spot, the firing point, and the shared roads

**Kon's spot and the firing point.** These are separated correctly. With no `stats.relay`, `updateRelayOrigin` puts
`ox` / `oy` on the base (`src/sim/towers.js:1440-1453`), so every behaviour (and Kaze's stoop) fires from there, and
`t.kon` is never a firing point.

**The `runners.js` addition.** The `shared` option is opt-in, so Seiran's dragon and Marumi's Giant Strike are
unchanged. But it mis-cites Marumi's rule and uses two different radii (R2-L3).

**What is missing.** Kon's road point ignores the road turning round: R2-M3.

### 2.4 M5: the drop and the snapshot fields

**The drop.** It is sound: the existing `drop` refunds `spent` with a notice, and the kit mark tells pre-rework rows
apart.

**The fields.**
- `lureCd` is `calm` (reset at every wave clear), `t.kon` is `derived`, and `runners` is already `calm`.
- Only Sim, tower and drone fields need classifying (`tests/battle-ui/snapshot.test.js:1545-1655`). Lured, Startled,
  `e.lureN` and the prints live on enemies, which a calm point never has.

**The gap.** The `du` row is written but not read back for the new duo: R2-L4.

### 2.5 New problems from the fixes

**Determinism: no new problem.**
- *No new rng.* The pop, Trail's End and every Wind Chase hit never crit (`:224`, `:242`, `:399`), and `_hit` draws
  only when `critChance > 0` (`src/sim/Sim.js:575`). Kon's ordinary bites may crit like any attack, which draws from
  the same seeded stream.
- *No trig.* Everything is path distance, `pointAt`, squared distance, and `Math.sqrt` in the guided stoop
  (`src/sim/towers.js:2012`). The shared test can read the precomputed `path.dirs` (R2-L3).
- *Whole steps.* `lureCd`, the run timer, the stoop queue (0.1 s = 6 steps) and the second run's 0.4 s (24 steps) all
  count whole steps. Statuses keep the float status timer (`src/sim/status.js:124`), like every status.

**Co-op checkpoints: no new problem.**
- The serializer stores every field, shared reference and Set (`src/sim/snapshot.js:6-15`). So strip records with a
  `lure` block, `e.lureN`, prints stacks and runner records all travel, and the mid-wave checkpoint test (`:683`)
  exercises them.
- `AFTER_RESTORE` puts the live road direction back after a restore (`src/sim/snapshot.js:53-55`), which R2-M3's fix
  can build on.

**Freeplay Resolve: no new problem.** See 2.2.

**Strip records for the lure foxes.**
- *What works.*
  - A fox ends at the wave clear and on sale (M1 row).
  - Strip records skip the trap procs and club tricks (`src/sim/towers.js:2166-2173`), so a lure never advances her
    Potential count or Big Beat.
- *What is missing:* R2-L2.

**Moon Pounce at 5.4 tiles: no balance concern.**
- It is "her range + 2", as today (`src/data/abilities.js:473`), which is 1.6× her new range. The other local strikes
  use 1.3–2.5× their range (`:242`, `:261`, `:292`, `:355`).
- Measured from Ruri it reaches up to 8.9 tiles (5.4 + 3.5), one tile more than today.
- The +1.0 range tier behind it is a separate matter: R2-L6.

### 2.6 Names and content

**No clashes.** I searched `src/`, `docs/`, `tests/`, `tools/` and `e2e/` (leaving out this spec and its board) for
50 new names. Among them were Paw and Feather, Great Stoop, Trusty Pair, Fast Friends, Fox and Falcon (Premiere),
every path, tier, ability, status and Potential name, Kon Meets Kaze, The Field Survey and Duo Rangers.
- None is used anywhere else.
- Four searches hit ordinary prose: "spirit fox" (`docs/ROSTER.md:198`), "Firefox runs" (`docs/ONLINE.md:1222`),
  "long run(s)" in co-op comments, and "position the wing" (`src/sim/constants.js:91`).
- "… Premiere" is the house pattern for banners ("Physics Club Premiere", "Starfall Premiere",
  `src/data/banners.js:82`, `:86`).
- The words r1 flagged now appear only in the list of renamed names: Field Trip, Daybreak, Kindred Companions and
  Old Friends (spec `:38-45`, `:502`; board `:142`).
- "Kindred SSR Essence" (`:505`) is the existing item's name.

**No other games' or anime names.** I listed every capitalised word in the spec and the board. The only outside
names are tools (Tripo, Meshy, NovelAI) and JS engines (JavaScriptCore, SpiderMonkey). The commit message is clean
too.

**Wholesome.**
- Both girls stay in uniform and are framed at eye level or above (`:640`).
- The bio and personality are about two shy club members (`:493-495`).
- No Sensei, no romance, no gore.

### 2.7 The owner board

**Real decisions, sensible defaults.** The board asks the real decisions, each with a sensible default, except:
- Q3's "10 s" (R2-M2);
- Q7 and Q8's figures (R2-M1);
- Q4's scope (R2-L5);
- Q2's wording (R2-L6).

**No spend in "default all".**
- It leaves out Q13's roughly 60 Anlas (board `:4`, `:120`).
- Q14's default is the owner's own Tripo work.
- Q14's Meshy option is spending the owner already approved, with the usual test run and cost reports
  (HANDOFF.md:137).

---

## 3. Findings

### MEDIUM

**R2-M1 MEDIUM: the LR figures in §3.6, the summary and Q7/Q8 are wrong for Tenka and out of date for both LR units,
and round 5 has already done what Q8 asks.** Spec `:70`, `:146`, `:443-455`; board `:79`, `:83-92`.

1. **Tenka's "before LR" row is her LR form.**
   - The round-5 bench gives every girl her Limit Break counter `lr:<id>` (`tools/balance/r5Bench.mjs:56` at
     `83b72083`).
   - Tenka is a legend-class SSR (`src/data/banners.js:22`, `src/data/units.js:1337`), so `isLR` and `rankBoost`
     make her LR on that bench, LR_BOOST included (`src/systems/limitBreak.js:48-50`, `:138`).
   - So her 6.55M / 1.80M (3.58× / 0.81×) are LR numbers. Round 5's own LR table reads her Rail Arms build at
     2.96× / 0.67× without LR and 3.58× / 0.81× with it (`d6f092b7:docs/specs/DUO_LR.md:354`).
   - Adding ×1.21 on top (spec `:452`, board `:89`) counts LR_BOOST twice. "About 4.3×" (spec `:70`, `:444`;
     board `:79`) should be 3.58×, and "about 7.9M" should be about 6.55M.
2. **Round 5 has already lifted both LR units.**
   - Commit `6954c757` added `LR_POWER` on Oct 30 at 06:19 UTC, 45 minutes before this revision. `d6f092b7` tuned
     it: the first duo gets ×1.05 damage and ×1.6 on bosses, and Tenka ×3.4 on bosses. It applies in the LR form
     only and never in titan battles (`d6f092b7:src/data/balance.js:92-97`, folded in by `powerFor(…, { lr })`,
     `:143`).
   - The measured result: the first duo's three builds read 2.58–3.38× on a crowd (Constellation 5.63×) and
     2.79–3.01× on a boss; Tenka's Rail Arms reads 3.58× / 2.75× (`d6f092b7:docs/specs/DUO_LR.md:348-359`).
   - The same section records "The 2.5–3× target is a floor (the coordinator, Oct 30)" (`:341`).
   - Q8 asks the owner to approve that lift on the old figures (4.76× / 1.77× and 3.58× / 0.81×).
3. **"So no LR unit is left below the floor" (spec `:455`) is not true.**
   - In LR form, Tenka's Joint Research build reads 0.52× / 0.48× and her Singularity build 0.27× / 0.05×. Both
     stay far below 2.5×, and round 5 leaves them as "A question for the owner"
     (`d6f092b7:docs/specs/DUO_LR.md:363-366`).
   - The new duo must clear 2.5× on both rulers with every build (`:440`). The board should say the rule differs by
     unit, or point to that open question.
4. **`RH_LR_MUL` duplicates `LR_POWER`.**
   - The spec adds a new constant read from `unitStats.lr` (spec `:416`, `:465`, `:600`, `:745`).
   - Round 5's data row now does the same job, "only the LR form moves", and also keeps the knob out of titan battles.
   - A `ruri_hana` row in `LR_POWER` would keep every LR knob in one table.

**Impact.** Nothing here lowers a unit, and the floors are measured again when she is built (`:428`, `:444`), so the
build itself would still land right. But the owner would decide Q7 and Q8 on wrong figures.

*Fix:*
- Re-base §1.3, §3.6 and the summary on round 5's tip, and name the sha: the branch moved again 9 minutes after
  this revision.
- Show Tenka's row as her LR form: 3.58× / 2.75× with LR_POWER.
- State the new duo's crowd floor as max(3×, the weakest other LR unit's best crowd), which is 3.58× today.
- Turn Q8 into "round 5 already lifts both (the figures); keep it?", or drop it.
- Fix `:455`, and name Tenka's two low builds.
- Use an `LR_POWER` row instead of `RH_LR_MUL`, or say why not.

**R2-M2 MEDIUM: the lure rules bound the delay, but Q3's "at most 10 s" does not follow from them, and the
wave-length test cannot see a stall.** Spec `:234-238`, `:681`; board `:45-46`.

**What holds.**
- A walker is lured at most twice a wave, and a lure lasts at most 3 s.
- The lure holds the push lock while the walker walks back (`:231-235`).
- So Ruri's own walk-back per walker is bounded, and "never hold it forever" can be proved from the count.

**What does not follow.**

1. **The lock ends 1.5 s after the lure, while the walker is still on ground it had already crossed.**
   - If it was lured from beyond Fuu's reach back into it, her gusts push it across that ground again.
   - Round 5's Fuu: Returning Gale tier 5 pushes 1.6 tiles, 1.7 awakened
     (`d6f092b7:src/data/unitsExpansion.js:232-239`, `:256`). She pushes a walker at most once per 1.5 s
     (`src/sim/constants.js:237`), and her gusts keep it 25% slowed.
   - So in her reach a walker gains only the tiles it walks between two of her pushes, minus 1.7. For a runner near
     that rate the gain is close to zero, so winning back the tiles a lure took has no fixed ceiling. One lure can
     cost far more than 10 s.
   - Example: a 1.6 tiles/s runner kept slowed walks about 1.8 tiles per 1.5 s, a net of about 0.07 tiles/s. A 2.5 s
     lure sends it 3 tiles back, and the 1.5 s lock wins back about 1.8 tiles. The last 1.2 tiles take about 18 s.
2. **The test measures kills, not stalls.**
   - A wave ends only when its last enemy dies or leaks (`src/sim/Sim.js:917-919`).
   - Ruri adds damage (×1.5 on Lured walkers, and the pops), and round 5's Fuu deals ×2.45
     (`d6f092b7:src/data/balance.js:62`). So waves can get shorter while a stall goes unseen.
   - The baseline is not clean either. Fuu alone already holds, at the edge of her reach, any walker that walks less
     than 1.7 tiles between two of her pushes. So kills set the wave length in both runs.
   - The test names no team, profile or tool, and two girls alone may lose 7-5 Hard before it ends.

*Fix:*
- **Make the bound provable.** For example, hold the push lock until the walker is back at the path distance it was
  lured from (one number on the enemy, like `e.lureN`). Then a lure costs at most its own length plus the walk back,
  never exposes the walker to Fuu again, and the delay per walker is at most two of those a wave. Or count lure tiles
  and locked pushes against one per-walker budget a wave in every mode, as Resolve already does in Freeplay.
- **Test it on walkers that never die.**
  - Heal the walkers every step, as the benches do, on one lane.
  - Run Fuu tier 5 with and without Ruri tier 5 (Follow the Fox on Auto).
  - Assert that every walker leaks, and that each walker's leak time grows by at most the bound.
- **Fix Q3.** Put the bound the rules actually give on the board, not "10 s".

**R2-M3 MEDIUM: Kon's stretch is stored as a path distance, but the road can turn round between waves.** Spec
`:254`, `:353-364`, `:392`.

- **How the spot is built.** `t.kon = { x, y, pathIndex, d0 }` is worked out "on placement and on any upgrade that
  changes the leash" (`:356`). It comes from `relaySamples`, which the sim builds from the forward paths
  (`src/sim/towers.js:1445`).
- **What a run reads.** A run is a runner, and runners move on the live `sim.pathData` (`pointAt` in
  `runnerSegment`, `src/sim/runners.js:125-131`).
- **When the road turns.** The live paths turn round between waves in four places: Rear Ambush's even waves, the
  Reverse Route mode, Tryout's Back Gate and Freeplay (`src/sim/Sim.js:116-118`, `:263-265`, `:874`;
  `setRouteOrientation`, `:1701-1714`; `routeReversedFor`, `src/sim/rules.js:46-48`). `reversePath` mirrors every
  distance, `d → L − d` (`src/sim/rules.js:56`).
- **The result.** On a turned wave, a run "from `d0` towards START" starts at the mirror point of Kon's stretch,
  possibly far outside Kaze's reach, and the stretch check looks at the wrong span.
  - Wind Chase's lane ("between `d0` and START", `:392`) turns the same way.
  - Follow the Fox's "one every tile up the road from his spot" (`:254`) also needs the live direction.
- **A model already exists.** Marumi handles this: her lanes are cached per `sim.pathData` object (`lanesOf`,
  `src/sim/balls.js:79-85`), so they follow the turn.
- **No test covers it.** No planned test turns the road (`:680-682`).

*Fix:*
- Store Kon's road point on the forward path and use `L − d` while `sim.routeReversed`, or work it out again
  whenever `sim.pathData` changes, as `lanesOf` does.
- Say that START means the live start.
- Add a Rear Ambush even wave to `foxFalcon.test.js`, and Follow the Fox's laying on a turned wave to
  `ruriFox.test.js`.

### LOW

**R2-L1 LOW: the lure's push lock must say whose lock it is, and the push rules are wider than §2.2 says.** Spec
`:228`, `:234`; board `:45`.
- **Backdraft Fan.** `movePush` lets a caster through a lock she set herself (`v.pushLockBy !== ownUid`,
  `src/sim/abilities.js:1103`), and Fuu's gusts leave `pushLockBy` set to her uid (`src/sim/Sim.js:652-653`). If a
  lure sets only `e.pushLock`, a walker that an earlier gust of hers locked still carries her uid, and her Backdraft
  Fan moves it mid-lure. Say the lure writes `pushLockBy = -1`, as an ability's push does
  (`src/sim/abilities.js:1112-1113`).
- **Which pushes the lock covers.** "These are the two pushes the lock covers" (`:234`) is incomplete.
  - The lock also covers gather (`src/sim/Sim.js:679`) and hit specs with `pushLock: true`: Marumi's blasts
    (`src/sim/towers.js:291`) and Giant Strike (`src/sim/abilities.js:1161`).
  - It does not cover Kogane's plow (`src/sim/runners.js:134-144`), nor other girls' and heroes' knockback
    (`src/sim/Sim.js:641-643`).
  - Board Q3's "nobody can push it" (`:45`) overstates this. Say "Fuu and the other locked pushes".
- **Grounded flyers.** On "never flyers" (`:228`): a grounded flyer passes a ground-only check
  (`src/sim/combat.js:27-28`), so a fox that uses the strip trigger would lure it. Say which you mean.

**R2-L2 LOW: what reusing strip records brings with it.** Spec `:219-223`, `:582`, `:607`.
- **The strip code needs a lure branch first.** `addStrip` and `stripStep` read `t.stats.strip`, `t.stats.trap`
  and `owner.trapSpec` (`src/sim/strips.js:106-110`, `:235`, `:245`, `:273`), and Ruri has none of them. Without it,
  an expiring fox would throw on `owner.stats.strip.boom`.
- **No trigger radius.** The spec gives none. r1's text had ±0.3 tiles, and a strip uses its trap spec's
  `triggerRadius` (`:252`).
- **Display files missing from §5.1.**
  - The display draws every `strip` record as Azami's steel bar (`src/render/actors.js:728-736`) or as her 3D strip
    prop (`src/render/placedProps.js:510-518`). Neither file is in §5.1's R1 rendering row (`:582`).
  - The duo's Kon is placed by `src/render/companionLogic.js:86-93` from `t.origin`, which the duo will not have.
    D1's rendering row (`:607`) leaves that file out too.
- **Effects on other girls.**
  - A live fox counts as taken road for Azami's strips (`spotFree`, `src/sim/strips.js:58-67`) and for Suzu's traps
    (`src/sim/towers.js:1179-1191`: a 0.45-tile check before her rng pick).
  - `makeRoom` evicts the oldest *strip* of that player, then of anyone (`src/sim/strips.js:78-99`). That can be an
    Azami strip, not only "the oldest fox" (`:222`).
  - All of this is deterministic. Say so in the spec, and test one case.

**R2-L3 LOW: Kon's run, four more edges.** Spec `:332`, `:354`, `:363-367`, `:380`.
- **A far road.** `relayOrigin` stops Kon's spot at the leash (`src/sim/towers.js:1434`), but `(pathIndex, d0)` is
  the nearest road sample at any distance (`:354`). A duo placed more than 4.2 tiles (leash plus standoff) from every
  road would run Kon on a road outside Kaze's 4.0 reach. Say she has no stretch then (no runs, and Wind Chase
  refused), or limit `d0`.
- **Long runs and the timer.**
  - The running adds up to about 2.8 s a cycle:
    - Silver Trail runs 6 tiles twice a cycle, 0.4 s apart (`:380`);
    - the LR form adds 50% (`:415`);
    - P3 adds half a tile (`:509`).
  - That is longer than the 2.5 s timer, which Quick Paws and every speed factor shorten further (`:594`).
  - Say the timer starts when Kon is home (one run in flight at a time), or how two runs share one figure.
- **Bosses.** Runners drop statuses on bosses (`src/sim/runners.js:115`, `:172`), so a boss is bitten but never
  Startled, and the prey bonus never reaches a boss through Kon. Say whether that is intended: it bears on High
  Stoop's 3× boss floor and on Shared Instinct.
- **The shared rule is mis-cited.** Marumi's walker test is `sameRoad` (`src/sim/balls.js:50-57`: the precomputed
  `path.dirs`, dot > 0.95), at the ball's own reach (`:289-293`). The 0.3 tiles (`SAME_SPOT2`, `:47`; `sameSpot`,
  `:87-91`) compares two lanes' starting points. As written (`:367`), Kon bites the other road within 0.3 tiles and
  his own road within 0.6 (`:363`). Use `sameRoad` at `RUNNER_HIT_RADIUS` for both.
- **Closed lanes.** A lane schedule that closes Kon's lane leaves him idle for that wave. The tier text should say
  so.

**R2-L4 LOW: the `du` row does not restore a run timer yet.** Spec `:369`, `:597`, `:605`, `:667`, `:684`.
- **The gate and the clamp.** The restore reads `du` only on a girl whose stats carry `duo`, and clamps the timer to
  `PRISM_BEAM_TICK`, which is 6 steps (`src/ui/battle/snapshot.js:585-591`; `src/sim/constants.js:344`). The fox
  duo's partner block is `pair` (`:594`, `:734`), and her run timer is about 150 steps.
- **So "already saved in `du`" (`:667`) is half true.** It holds for the write (`:375`), not for the read.
  - D1's battle-save row (`:605`) should add a `pair` branch with its own clamp. The planned test (`:684`) would
    catch the gap.
  - The same `if (s.duo)` gate stands at `src/sim/towers.js:332`, `:1958` and `:1993`, and D1's `towers.js` row
    (`:597`) should name it.

**R2-L5 LOW: Q4 and the refund line.** Board `:53-54`; spec `:280`, `:284-286`, `:540`, `:714`.
- **The 2-5-0 build.** Q4 names the 2-0-5 change but not the 2-5-0 one.
  - On the light bench, Star Falcon is her best boss build (409 against 282 and 203; review r1 §1.1). So under round
    5's uniform `ruri: { boss: 9 }`, it is likely the build behind her 0.46×.
  - The spec re-fits that row down (`:284-286`) while Fox Tricks has no boss target (`:280`), so that build falls on
    bosses.
  - Under the owner's "no nerfs", Q4 should name both builds and roughly how far each falls, or set per-build floors
    against round 5.
- **The refund.** "A saved battle with her on a retired path gives back every coin" (board `:54`; spec `:540`,
  `:714`) is true only when a retired path is above tier 2 (`:662`). At tiers 1–2 she comes back on the new tiers.

**R2-L6 LOW: Bounding Fox is now a reach upgrade with a drawn hunt.** Spec `:201`, `:205-212`; board `:23`.
- **The mechanic.** After the M2 fix, Bounding Fox is Moonhound plus +1.0 range at tier 3; the hunt is only drawn.
  - That is safe. But on this path it leaves §1.4's first point ("Kon is a moved muzzle", `:155`) as it was, against
    the owner's standing rule that "a fox girl actually deploys her fox" (HANDOFF.md:123).
  - Q2 (board `:23`) describes the drawing as if it were the mechanic. Add "(a look: her bites still count from his
    spot; the change is a tile more reach)".
- **The range.** +1.0 range is her largest range step by far (her only other one, Sky Perch, was +0.3, `:89`). It
  doubles the area she covers ((3.4 / 2.4)² ≈ 2), and the light bench values range little (HANDOFF.md:172). Add a
  real-coin check for Bounding Fox, as §2.5 has for Fox Tricks.
- **Moon Pounce.** Its 5.4 tiles is fine (2.5).

**R2-L7 LOW: the balance tools, and a possible chain.** Spec `:203`, `:280`, `:681`.
- **capBot.** §2.5 checks Fox Tricks with `tools/capBot.mjs` and "the free team plus her" (`:280`). But capBot plays
  fixed builds A, A2, B and C in Freeplay, and none of them has Ruri (`tools/capBot.mjs:1-24`).
- **The finale bot.** It scores each kit block in `src/sim/headless.js` (`pathScore`, `:156-196`), so it would score
  `lure`, `prints` and `pair` at 0. `headless.js` is hashed (`tools/simId.mjs` hashes all of `src/sim`), and §5.1
  does not list it. Add it to §5.1, and add a capBot build.
- **The wave-length test.** It names no tool (R2-M2).
- **A chain.** Silent Stalk's leap "leaves 2 prints there" (`:203`). If those can fill that enemy's stack, Trail's
  End fires again inside the same on-hit step (`src/sim/Sim.js:615`), and it can chain across a crowd in one step.
  Say that the leap's prints never trigger in the step they land, or queue them with a budget, as curse bursts are
  (`CURSE_BURSTS_PER_TICK`, `src/sim/Sim.js:358`).

**R2-L8 LOW: text.**
- **The banner name.** §3.9 calls the banner "Ruri & Hana · Fox and Falcon Premiere" (`:502`), while §5.3 and the
  board say "Fox and Falcon Premiere" (`:648`; board `:96`). Pick one; the live pins use the short form
  (`src/data/banners.js:82`, `:86`).
- **The D2-alone patch note.** It would read "Behind-the-scenes stability fixes." (`:704`). That line is meant for
  deploys with only internal changes (`src/data/patchNotes.js:12-13`). A D2 that ships the solo girls' new figures
  (`:635`, `:701`) changes what players see, so it needs a line about them (without naming the duo).

---

## 4. Verdict

**NOT OK.**

These must be fixed, and the fixes re-reviewed, before anyone builds from this spec:
- **R2-M1.** Re-base the LR figures on round 5's tip:
  - Tenka's row is her LR form (3.58× on a crowd; 2.75× on a boss with LR_POWER);
  - the new duo's crowd floor is 3.58× today;
  - Q8's lift is already done;
  - two of Tenka's builds stay below the floor, as an open owner question.
- **R2-M2.** Make the lure delay provably bounded (or take "10 s" off Q3), and replace the wave-length test with one
  on walkers that never die.
- **R2-M3.** Make Kon's stretch, Wind Chase's lane and Follow the Fox's laying follow the live road direction, and
  test them on a turned wave.

The LOW findings (R2-L1 to R2-L8) can be fixed in the same pass; none of them blocks on its own. This is round 2 of
the review gate's three (HANDOFF §6).
