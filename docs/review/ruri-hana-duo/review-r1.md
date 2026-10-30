# Ruri's rework and the Ruri & Hana duo: independent review, round 1

Reviewer: an agent that did not write the spec (review gate, HANDOFF §6).
Reviewed: `spec/ruri-hana-duo` at `20f5747f`, which holds `docs/specs/RURI_HANA_DUO.md` ("spec") and
`docs/review/ruri-hana-duo/OWNER_BOARD.md` ("board"). The commit is docs only, on top of `main` `60ce9cad` (v0.1.61,
`COOP_PROTOCOL` 13, sim id `be940ecb2087`, which equals `KNOWN[13]` in `tests/art/itemArtRuntime.test.js:200`). Round 5
numbers are checked against `feature/balance-r5` `83b72083`. Line numbers refer to those trees. "r5" is round 5's maxed
bench (`tools/balance/r5Bench.mjs`); "light bench" is `tools/bench.mjs`. Two files share a name, so I always give
`src/data/abilities.js` / `src/sim/abilities.js`, `src/data/banners.js` / `src/systems/banners.js` and
`src/sim/snapshot.js` (the co-op serializer) / `src/ui/battle/snapshot.js` (battle saves) in full.

**Verdict: NOT OK.** 1 HIGH, 6 MEDIUM, 8 LOW.

The "today" analysis is right, and my one bench run reproduces every light-bench ratio it quotes. The rework and the
duo can be built inside the determinism rules, the duo is clearly not a copy of Kohaku & Tsubaki, and the LR route,
banner rows and protocol plan follow the existing rules. Nothing commits generator spend without the owner's yes.

It is not OK because:
- The LR band contradicts the crowd numbers the two existing LR units already have, and the no-nerf rule. Q8 shows the
  owner only the boss side (H1).
- A builder would hit six gaps: files missing from the impact table (M1), no home rule for the hunting Kon (M2), lure
  rules that do not back Q3's promise (M3), Kon's run left undefined (M4), two battle-save gaps (M5), and a reserved
  banner name (M6).

---

## 1. What checks out (by the brief's seven items)

### 1.1 Today's Ruri and Hana (item 1)

**Code citations.** I checked every `file:line` in §1 of the spec, and each points at what it says:

| Claim | Where |
|---|---|
| Ruri's kit, three paths, awakening | `src/data/unitsExpansion.js:318-375` |
| Kon's lane spot: reach 3.5, 0.7 short of the road | `unitsExpansion.js:350`; `relayOrigin` `src/sim/towers.js:1416-1437`; `FAMILIAR_STANDOFF` `src/sim/constants.js:229` |
| Her three abilities, two still teasers | `src/data/abilities.js:468-491`; `ABILITY_RUNNERS_RUN` and `ABILITY_MOVES_RUN` (`:123`, `:125`) run neither `river` nor `carry` |
| v0.1.61 told players the two paths still wait | `src/data/patchNotes.js:25` |
| Potential rows | `src/data/potential.js:289-302` |
| Hana's kit, Air targeting by default | `unitsExpansion.js:259-316`; `ROLE_TARGET_MODE` `constants.js:247` (falconer → air) |
| Kaze's Swoop | `src/data/abilities.js:459-465` |
| Round 5 rows `ruri: { boss: 9 }`, `hana: { dmg: 5.45 }` | `src/data/balance.js:54`, `:38` on `feature/balance-r5` |
| Eclipse Wyrm: pierce ×1.5, mystic ×1.25, drops feather | `src/data/types.js:27`, `:29`; `docs/specs/ASCENSION.md:508` |

**The light bench.** I ran one bench, niced, on this tree. It took about 11 s:
`nice -n 19 node --import ./tools/simLoader.mjs tools/bench.mjs ruri hana kage --builds p0t5,p1t5,p2t5 --json`
(STRONG preset, 4-5, seed 9, partner Aoi). Every ratio the spec quotes comes out the same:

| Build | Coins | Crowd DPS | ÷ Kage (spec) | Boss DPS | ÷ Kage (spec) |
|---|---:|---:|---:|---:|---:|
| Kage 5-0-2 | 31,270 | 44,086 | 1 (44.1k) | 8,403 | 1 (8.4k) |
| Ruri 5-0-2, Moonhound | 25,040 | 39,031 | 0.885 (0.89) | 282 | 0.034 (0.03) |
| Ruri 2-5-0, Star Falcon | 22,830 | 1,226 | 0.028 (0.03) | 409 | 0.049 (0.05) |
| Ruri 2-0-5, Tide Otter | 26,290 | 86,147 | 1.954 (1.95) | 203 | 0.024 (0.02) |
| Hana 5-0-2, Falconry | 17,820 | 1,481 | 0.034 (0.03) | 2,075 | 0.247 (0.25) |
| Hana 2-5-0, Hunter's Mark | 16,560 | 209 | 0.005 (0.005) | 577 | 0.069 (0.07) |
| Hana 2-0-5, Rapid Feathers | 18,920 | 2,751 | 0.062 (0.06) | 1,788 | 0.213 (0.21) |

So the core claim holds: Star Falcon is weaker than Hana's Falconry on both rulers and costs 5,010 coins more. I did not
re-run the tier-3 column, Kohaku & Tsubaki, or Tenka.

**r5 figures.** The r5 figures (Kage 1.97M → 2.22M on a boss and 1.82M → 1.83M on a crowd; Ruri, Hana, and the first
duo at LR) match `docs/BALANCE.md:33`, `:35`, `:42` and `:49` on `feature/balance-r5`. Each ratio re-derives.

The analysis of what feels plain about Ruri (§1.4) and where Star Falcon overlaps Hana (§1.5) matches the data. L8 has
two small wording nits.

### 1.2 Determinism and the lured walk back (item 2)

- **Moving a walker back by path distance is safe in the path code:**
  - `segmentAt` walks backwards (`src/sim/path.js:69-86`);
  - `pointAt` clamps to the road (`:94-105`);
  - `placeOnPath` recomputes `remaining`, the tunnel state and the deck state (`src/sim/enemies.js:203-213`);
  - a leak needs `dist ≥ length` (`enemies.js:535`), so a walker going backwards never leaks.
- **Nothing in the sim assumes a walker only moves forward:**
  - Every one-way check is a once-only flag: Last Line's `nearExit` (`enemies.js:530-533`), the rift rule
    (`src/sim/rules.js:318`), the detour (`src/sim/barricades.js:432`), One-Way Street and Bounce Back
    (`barricades.js:344`, `:353`).
  - A barricade stop only catches forward motion (`barricades.js:375-384`). A Lured walker leaves a barricade
    backwards and is caught again when it walks back.
- **No new rng draws:**
  - Trail's End with no crit draws no rng, because `_hit` rolls only when `critChance > 0` (`src/sim/Sim.js:575`).
  - The pounce origin needs one `Math.sqrt`, which `relayOrigin` already uses (`towers.js:1432`).
- **Co-op state is covered:**
  - The co-op checkpoint serializer stores any new field without a list (`src/sim/snapshot.js:6-10`).
  - `hashSim` already hashes every enemy's position (`src/online/coop/simHash.js:46`), so a lured walker shows up in
    the hash.
- **Bosses:** they already take no knockback (`KNOCKBACK_RESIST.boss = 0`, `constants.js:16`), and the spec keeps them
  out of lures.

M1 to M4 list what the spec still has to state.

### 1.3 The duo (item 3)

**It is distinct from Kohaku & Tsubaki.** Her two weapons are a single-target guided stoop that picks flyers first and a
bite that runs along the road. The trick is two statuses that hand prey back and forth. She has no aim point, no
artillery, no shard counter and no beam. The §3.7 table is fair.

**It is buildable on the twin-weapon frame:**
- The partner weapon's own tick (`src/sim/duo.js:114-128`, called at `towers.js:1993`) and its spec build
  (`towers.js:332`) are the hooks. The spec rightly turns them into a dispatch.
- A guided shot hits only its target, with sqrt only (`towers.js:2001-2040`).
- `chainNext` takes uid ties (`towers.js:1114-1129`).
- Runners move by path distance (`src/sim/runners.js:146-187`).
- `sim._abilQueue` already exists for the stoop queue.

M1 and M4 cover the gaps.

**The LR route matches `src/systems/limitBreak.js`:**
- the fee in her family (`:37-45`);
- the 8-5 Nightmare stand-in (`:27-31`);
- 300 gems and a Recruit Ticket (`:20`);
- `LR_BOOST` (`:127`).

The `legend` class keeps her out of spark, the Select Ticket and Chosen Essence (`src/systems/banners.js:446-450`,
`:471-478`; `src/systems/gacha.js:27`). The Legend Promise key is `gl:<unit>` (`src/systems/banners.js:485`). The rates
are 0.7% in her debut week and 0.5% after (`src/data/banners.js:107-108`).

**Prices.** Her prices copy the first duo's ladder tier for tier (`src/data/unitsDuo.js` paths), inside the windows.

**Targets:** see H1.

### 1.4 Fairness and saves (item 4)

- **Profile changes are additive**, with no `SAVE_VERSION` bump.
- **Path ids are not stored in any save.** No path id appears in `src/systems` or `src/ui`. Battle saves keep tiers by
  index and `spent` (`src/ui/battle/snapshot.js:335`, `:557-562`), as §5.4 says.
- **The duo is her own unit id.** She has her own path caps and her own ability cooldown group, and the bandana tells
  two Kons apart. Solo Ruri and Hana keep everything.

Gaps: M5 and L7.

### 1.5 Protocol, art, banner, tests, order (item 5)

**Protocol, per milestone:**
- **R1 and D1** change files in the co-op graph. `tools/simId.mjs` hashes 81 files, among them `src/data/abilities.js`,
  `unitsExpansion.js`, `unitsDuo.js` and `potential.js`. So both need a bump.
- **R2 and D2** are display only.
- **D3 is not hashed:** `src/data/banners.js:1-3` and the `src/systems/limitBreak.js` header both say so.
- **D4** is a bump.
- "Never bump twice for one release" matches `src/online/coop/version.js`.
- Round 5 takes 14: it carries `PENDING_BUMP {13: 174f17a76dd5}` on `83b72083`.

**Banner rows.** They match today's shapes: `UNIT_CLASS` `src/data/banners.js:19`, `HELD` `:37`, `LISTS.legend` `:69`,
`PINS` `:79`, `LEGEND_SR` `:91` and `LEGEND_NAMES` `:97`. They also follow the `since` rule (`:51-56`). Ruri, Chigusa
and Marumi are gacha-only SRs that neither of the other LR banners uses.

**Tests.** Every test file §5.5 names exists. **Order.** Rework first, then the duo held, then art, then the premiere:
the order is sound.

Gaps: L5 and L6.

### 1.6 Names and content (item 6)

- **No other game or anime names.** I grepped the spec, the board and the commit message. A word-list scan matched
  only "Personality".
- **No clashes, with one exception.** None of the new path, tier, ability, status, trial or gift names exists in
  `src/`, `docs/`, `tests/`, `tools/` or `e2e/`. The exception is "Field Trip" (M6).
- **Content is wholesome.** The art rules are restated: uniforms, framing at eye level or above, the game's own art as
  the only reference. Sensei does not appear.

Smaller name notes: L2.

### 1.7 The owner board (item 7)

**Coverage.** The board covers the real decisions, each with a sensible default:
- rework, duo or both;
- retiring two paths;
- the lure;
- no loss;
- the duo, her ability and her LR form;
- power and the other LR units;
- how players get her;
- Limit Break;
- the gift;
- team sharing;
- the picture, the figures and the names.

**Spend.** Nothing commits generator spend. Q13 asks the owner's yes before the roughly 60 Anlas (board `:95-99`; spec
`:466`), as HANDOFF.md:137 requires. The Tripo figures are the owner's own work, and no Meshy run is planned.

Gaps: H1 (Q8), M6 (Q15), L3 and L4.

---

## 2. Findings

### HIGH

**H1 HIGH: the LR band caps every LR unit at 3.0×, but both existing LR units are already above it on crowds. Holding
them to it means a nerf, and Q8 shows the owner only the boss side.** Spec `:341-344`, `:355-359`; board `:63-72`.

**What the spec and board say:**
- §3.6 says "Nothing goes above 3.0× in LR form" (`:344`).
- It also says "The balance session lifts both into the same band (owner board Q8). The fox-and-falcon duo is fitted
  after that, so no LR unit ships above another's band" (`:359`).
- Q8 asks the owner to "Lift Kohaku & Tsubaki and Tenka into the same LR band", and gives as the only number that the
  first duo "reads under 2× on a boss".

**What r5 measures** (`docs/BALANCE.md:33`, `:40`, `:42` on `feature/balance-r5`). Kage's best reads 1.83M on a crowd.
- The first duo at LR reads 8.71M on a crowd: **4.76×**. Before the round it was 4.39×, which is in the spec's own
  table at `:118` and in `docs/specs/DUO_LR.md:291`.
- Tenka reads 6.55M on a crowd: **3.58×**, without LR.

**What follows:**
- Holding them to the band on crowds means cutting the first duo's best crowd build by about 37% and Tenka's by about
  16%.
- That is a nerf. It goes against the owner's balance direction, "nobody nerfed" (`docs/BALANCE.md:7`). It also goes
  against round 5's own record that the duo is "exempt from the band, never tuned down" (`docs/BALANCE.md:67-69`;
  `src/data/balance.js:55-58` on that branch).
- The reverse follows too. The new duo's LR crowd target is Fox Run at 2.7–3.0×, about 4.9–5.5M (`:337`, `:343`). That
  sits below both existing LR units' crowd numbers. At the same price and under the same pull rules, she would be the
  weakest LR unit on crowds. The board does not say so.

*Fix:*
1. Decide whether 2.5–3.0× is a floor for each LR unit's rulers (raise only, with no ceiling, so existing crowd numbers
   stay) or a ceiling (a nerf, which the owner must approve explicitly).
2. Rewrite `:344` and `:359` to match the decision.
3. Show Q8 the crowd numbers (the first duo at 4.4–4.8×, Tenka at 3.6× before LR).
4. Set the new duo's crowd target knowingly against them, and tell the owner where she lands.

### MEDIUM

**M1 MEDIUM: §5.1's file lists miss co-op-graph files the build cannot avoid.** Spec `:451-456`, with `:233-242` and
`:540-558`.

*Ruri's rework (R1):*
- **`src/sim/mods.js`.** Every new tier number has to be a ModSet key that the resolver merges:
  - the lure fox's interval, budget and lure time;
  - ×1.3 / ×1.5 against Lured walkers;
  - print counts and Trail's End factors;
  - `relay.hunt`;
  - Spirit Fox's print and splash riders inside a boost ModSet.

  Today the only relay key is `relay: { reach }` (CONTRACTS.md:396).
- **`src/sim/Sim.js`.** If lure foxes are their own list (`lures.js`, §2.6), they need:
  - a step call in `_step1` (`Sim.js:351-384`);
  - a wave-end call in `_checkWaveEnd`, where every other road object ends (`:917-975`);
  - removal when she is sold (`_removeTower`, `:1383-1391`).

  If instead they are trap records like Azami's strips, say so; then `src/sim/strips.js`'s wave end changes instead.
  Either way, Trail's End fires from the on-hit step, which is `_onHitEffects` in `Sim.js:615`, not in `towers.js`.
- **`src/sim/combat.js`.** A bonus against Lured walkers is a per-victim multiplier. `computeHit` is where `airMul` and
  soak already live (`combat.js:78-89`).
- **`src/data/unitKit.js`.** It changes if `lure`, `prints` and `startled` get `S.*` builders, which Ruri's data imports.

*The duo (D1):*
- **`src/sim/mods.js` again.** Everything the duo block has is a beam field:
  - `normDuo` (`mods.js:270-298`);
  - the `duo` ModSet keys (`:643-651`);
  - the level, gear and Potential scaling (`:814`);
  - the rounding (`:926-934`).

  Without a `pair` counterpart in all four places, Kon's bites would not grow with level, gear or Potential, though
  Kohaku's beam does (`:814`).
- **`src/sim/combat.js`.** It needs the prey bonus against Startled enemies and Kon's ×1.5 against grounded flyers.
- **`src/sim/enemies.js`.** Strong Scent makes Startled walkers 15% slower, unless that is applied as a `slow` status.
- **`src/sim/Sim.js`.** Silver Trail is a road object, so it needs a step, a wave end and removal on sale.
- **`src/data/potential.js`.** Her Potential row is in the co-op graph and in the battle-data hash (`POTENTIAL_LADDERS`,
  `src/online/coop/version.js:90`). §7 names it, but §5.1's D1 row does not.

*Outside the graph but required:*
- `CONTRACTS.md`: the StatusSpec union (`:168-174`), the ModSet table (`:221-240`) and the ability vocabulary
  (`:187-212`).
- The `effect` vocabulary in the header of `src/data/abilities.js`, which `tests/data/abilities.test.js` checks effect
  keys against.
- `src/ui/battle/snapshot.js` (M5).

*Fix:* list these per milestone. No design changes.

**M2 MEDIUM: Bounding Fox's moving firing point has no rule for where Kon looks for targets or when he comes back.**
Spec `:172`, `:237`, `:525`.

**Kon can strand:**
- Her targets come from her firing point: `attackProjectile` calls `volleyFrom(sim, t, t.ox, t.oy)` with her range of
  2.4 (`towers.js:809`).
- Today that point changes only on placement, an upgrade or an aim (`updateRelayOrigin`, `towers.js:1438-1456`).
- With `relay.hunt`, the point is wherever Kon last landed, and it comes back only "at the wave clear" (`:237`).
- So he can chase a walker to the far edge of his leash, or onto another lane. Walkers on the lane he left can then
  stay more than 2.4 tiles from him for the rest of the wave. A lane schedule that closes the lane he is on makes this
  certain. Nothing in the spec brings him home.

**Her reach changes, and two readings disagree:**
- Today she covers a 2.4-tile disc around a fixed spot.
- If the hunting disc can sit anywhere inside the leash, she covers up to about 3.5 + 2.4 = 5.9 tiles from where she
  stands. With Tryout Day's T_ruri it is 6.9 (`src/data/tryout.js:324`).
- §2.2's "(within 3.5 tiles of Ruri)" reads as a filter on targets. §2.6's "or to the leash edge toward it" reads as a
  clamp on Kon. The two give different kits, different bench numbers and different range rings.
- The placement ghost draws her ring from `relayOrigin` (`towers.js:1406-1437`).

**Moon Pounce moves with him.** Its reach ("her range + 2", `fromOrigin`, `src/data/abilities.js:472-473`) inherits the
same moving centre.

*Fix:*
- State where targets are picked from: Kon's lane spot, his current point, or "within the leash of Ruri".
- Add a home rule. For example, if he has no target within his range for N ticks, he trots back to his lane spot.
- Say what coverage is intended, so that the bench fit, the ring and the tier text agree.

**M3 MEDIUM: the Lured rules do not back what Q3 promises, and four details conflict or are missing.** Spec `:176-189`,
`:201`, `:238`, `:524`; board `:33-39`.

**1. The push lock does not stop a stall.** A lure "also starts the per-enemy push lock" (`:184`):
- That lock is 1.5 s for a walker (`constants.js:237`).
- A lure lasts 1.5–2.5 s on the path and 2.5–3 s from Follow the Fox (`:173`, `:201`).
- Only Fuu's gusts (`PUSH_LOCK_KITS`, `constants.js:239`; `Sim.js:642`) and ability moves (`movePush`,
  `src/sim/abilities.js:1102-1115`) read the lock at all.

The numbers:
- At Heaven's Gate Wind, Fuu pushes 1.2 tiles a gust: 0.45 + 0.1 + 0.15 + 0.2 + 0.3
  (`src/data/unitsExpansion.js:232-239`). The lock lets her move a walker at most once every 1.5 s.
- A walker at speed 1 covers 1.5 tiles in that time. So Fuu alone already holds it to a crawl in her reach, about
  0.1–0.2 tiles a second.
- Add one 2.5 s lure per 8 s lure lock, with the lock as written. Over the cycle the walker walks 5.5 tiles forward, is
  lured back 2.5 and is pushed back up to 5 × 1.2 = 6.0. It ends about 3 tiles further back than it started.
- Locking pushes for the whole lure still leaves it about 1.8 tiles back (5.5 − 2.5 − 4 × 1.2).
- So Ruri and Fuu together can hold a walker near the edge of Fuu's reach indefinitely in the campaign. Only Freeplay
  caps how far an enemy can be moved back (Resolve, `kbLeft`, `src/sim/enemies.js:185-190`).

Q3's "Ruri and Fuu together can never stall a wave" and §5.7's "One push lock covers both" are therefore not backed.

*Fix:*
- Either count lured tiles and pushes against one per-walker budget per wave in every mode (Resolve's rule), or drop
  the promise from Q3.
- Say whether a walker that is already push-locked can be lured.
- Add a campaign wave-length check with Ruri T5 and Fuu T5 to the tests.

**2. The caps conflict with Follow the Fox.** The caps are 2 per Ruri (4 at T5), 8 per player and 16 per sim (`:188`),
but Follow the Fox lays 5 foxes, and 8 at T5 (`:201`). Spike Rain's rule for strips is a model: an ability's objects
ignore her own cap, and the oldest object goes first at the per-player and per-sim caps (`src/sim/strips.js:9-10`,
`:16-18`). Say which rule applies, so the cap tests know which fox goes.

**3. Shared stretches are not covered.** A lure fox is `{ pathIndex, dist }` and lures "within ±0.3 tiles of path
distance" (`:238`). A walker on another path over the same road walks straight through it. Strips and barricades
register on every path through a shared stretch (`docs/specs/UNIT_GAPS.md:419`, `:688`, rule P-17). Say which rule
lure foxes follow.

**4. Blinks and placement are not covered.**
- *Blinks.* A blinker lured during its warning still jumps to the spot it picked before the lure
  (`e.dist = Math.max(e.dist, e.blinkDest)`, `enemies.js:310`), and `lure` is not in `BLINK_INTERRUPTS`
  (`constants.js:40`). Say whether a lure interrupts a blink.
- *Placement.* "In front of the fastest walker" (`:173`) needs a distance, a rule for road points inside a tunnel
  (where nothing can be lured) and a tie rule. Speed is a float, so ties should go by uid.

**M4 MEDIUM: Kon's run, the duo's partner weapon and half her kit, is not defined well enough to build.** Spec `:264`,
`:273-274`, `:297`, `:554`.

**Kon's spot must not be a relay.** "Kon waits at his lane spot (her relay rule, leash 3.5)". In the sim a `relay`
moves the firing point of every behaviour and the range ring with it. All of these read `t.ox` / `t.oy`:
- projectiles (`towers.js:809`);
- pulses (`:855`);
- duels (`:874`);
- beams (`:1074`);
- chains (`:1132`);
- mortars (`:1306`).

If the duo carries `stats.relay`, Kaze's stoops, which should leave "from above the base" (`:273`), leave from Kon
instead, and her ring is drawn around Kon. Say that Kon's spot is computed with `relayOrigin` but stored apart, and that
the duo has no `relay`.

**"His stretch" is undefined.** The spec needs to say:
- which road it is on: the nearest visible sample of which path;
- where it starts and how long it is;
- whether "when a walker is on his stretch" means the 2 tiles he runs;
- whether he runs back or reappears at his spot;
- what happens on a stretch that several paths share.

Runners hit only their own path today (`src/sim/runners.js:5-6`, `:168`: "shared stretches, P-17, come later"). So
§7's "with the shared-stretch rule" (`:554`) points at a rule the runner code does not have.

**Wind Chase has the same gap.** It "runs on Kon's lane (if he has several within his leash, the busiest one)" (`:297`),
which needs the same definition. `runnerEntry`'s shared-point rule (`runners.js:20-66`) is a model.

*Fix:* one paragraph in §3.2 that gives the geometry, with a small picture.

**M5 MEDIUM: battle saves have two gaps.** Spec `:484-492`; board `:41-44`.

**1. Restoring by path index changes a saved Ruri's job in the middle of a run.**
- A battle save replays her tiers by index and keeps `spent` (`src/ui/battle/snapshot.js:557-562`).
- So a crowd-carrying Tide Otter 2-0-5 Ruri comes back as Paw Prints 2-0-5. That is her boss path, whose crowd target
  is only ≥ 0.5× (`:228`). A Star Falcon Ruri comes back on Fox Tricks.
- Endless runs and the Colosseum are saved too (`isSavableRun`, `src/systems/battleSave.js:71`), and they can run for
  hours. A run that leaned on her crowd damage can be lost after the update.
- So "Solo Ruri and Hana stay, with every bit of progress" (`:45`) and Q4's "Players lose nothing" (board `:41-44`) do
  not hold for these saves.

*Fix:*
- The restore already drops any girl who cannot come back and refunds everything spent on her, with a notice (`drop`,
  `src/ui/battle/snapshot.js:538-542`; documented at `:492-493`). Use it for a Ruri saved before the rework whose
  retired paths are above tier 0. The save's own format or version marks such a save.
- Or put the choice on the board.

**2. "Calm points hold none of the new state" (`:491`) lists only objects on the field.**
- The per-girl timers are tower fields:
  - the lure-fox interval (`:173`);
  - Kon's run timer, every 2.5 s. The first duo's beam timer is saved as `du`
    (`src/ui/battle/snapshot.js:48-49`).
  - any new counter.
- Each one either resets at the wave clear (say so) or needs a save row like `du`.
- Every new Sim or tower field must also be classified in `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS`
  (`src/ui/battle/snapshot.js:128`, `:190`), or `tests/battle-ui/snapshot.test.js` fails.
- Neither that file nor that test is in §5.4 or §5.5.

**M6 MEDIUM: "Field Trip" is a reserved name.** Spec `:396`, `:479-480`; board `:76`, `:114`.

- Tryout Day's spec says "The names Night Watch, Glowsticks and Field Trip are reserved for other modes"
  (`docs/specs/TRYOUT_DAY.md:1451`, `:1498`). The mode idea is C07 in `docs/specs/SCREEN_IDEAS.md:227`.
- The achievement catalogue also has "Field Trip Circuit" (`docs/specs/achievements/design-catalogue.md:177`).
- The duo's banner "Field Trip Premiere" and her everyday LR tab name "Field Trip" (`LEGEND_NAMES`) would take that name.
- Q15 asks the owner to keep the names without saying this.

*Fix:* rename the banner and tell the owner on Q15. The trial's name, "The Field Survey", is not taken.

### LOW

**L1 LOW: small ambiguities a builder will ask about.**
- **Timers.** Statuses tick in float seconds (`src/sim/status.js:124`), not in the "integer step timers" of `:244`.
  That is fine for determinism, but say that `lure`, `startled` and `prints` use the standard status timer.
- **Wind Chase's Auto.** "≥ 6 enemies on Kon's stretch, or a boss on the road" (`:301`). No `AUTO_WHEN` rule counts "on
  Kon's stretch", and `orBoss` exists only with `cluster` (the header of `src/data/abilities.js`, `:91-92`;
  CONTRACTS.md:204-206, which does not list `cluster` either).
- **P2 "Sure Grip: stoops +1"** (`:402`). Is that +1 stoop damage, like the first duo's P2 `duo: { beamDmg: 1 }`
  (`src/data/potential.js:405`), or +1 prey?
- **Hundred-Fox Trick's pop** (`:173`). Does it come at the end of the fox's 3 s life or of each walker's lure? Can it
  crit? A crit draws `sim.rng` (`Sim.js:575`).
- **Kaze's stoop**, "about 0.35 s in flight" (`:273`). Is that a fixed flight time (speed from distance) or a fixed
  speed, as the guided shots have (`towers.js:2012-2016`)?

**L2 LOW: two names sit on other girls' words.**
- **"Kindred Companions"** (`:290`) shares "Kindred" with the Kindred Essence items (`src/systems/essence.js:19`). The
  spec itself mentions "Kindred SSR Essence" at `:399`.
- **"Daybreak"** (`:42`, `:300`, `:310`) is on Hikari's dawn motif: Dawnblade (`src/data/legacy.js:20`); Searing Dawn,
  Dawn Sanctuary and Dawnblade Ascendant (`src/data/heroTracks.js:88`, `:98`, `:100`); "Rampart at Dawn"
  (`src/data/lobbyIllustrations.js:34`). That is the same kind of overlap the spec avoided for Luna's moon and foxfire
  (`:29`).

Consider another word for "Kindred", and put "Daybreak" to the owner on Q15.

**L3 LOW: the board and the spec disagree in three places.**
- **Lure time.** Q3 says lures last "1.5–2.5 s" (board `:34`), but Follow the Fox at T5 lures for 3 s (`:201`). The
  miniboss lock of 12 s is not mentioned.
- **Before LR.** Q7 (board `:66`) and the summary (`:43`) say "about 1.3–1.7×" before LR. §3.6 (`:336-338`) sets
  several off-job cells at "≥ 1.0", and one at "≥ 0.5".
- **Q4.** It says players lose nothing, without saying that her 2-0-5 build turns from a crowd build (1.95×) into a boss
  build (crowd ≥ 0.5×, `:228`). Round 5's bar was "no build falls, not only the best one" (`docs/BALANCE.md:73` on
  `feature/balance-r5`). The rework uses "no job falls" (`:162-165`). That may be right for a rework, but the owner
  should see it. This ties to M5.

**L4 LOW: art and keys.**
- **Q13 and "default all".** Q13 asks for a yes before spending, which is right. The board should also say that
  answering "default all" is not that yes.
- **Q14 and Meshy.** Q14 asks the owner to make Tripo figures (board `:101-105`; spec `:467`). The standing decision is
  "3D: Meshy is the main tool" (HANDOFF.md:123), and Meshy spending is pre-approved (HANDOFF.md:137). Offer Meshy as
  the alternative.
- **Keys.** "Waits for the owner's key" (`:529`) should add "as an environment secret, never pasted into chat"
  (HANDOFF.md:40).

**L5 LOW: process on two milestones.**
- R2's gate, "the fast lane if it is looks only" (`:516`), stretches the fast lane, which is for small tweaks with no
  new feature (HANDOFF.md:143). A new Kon figure, Tree tab stickers and new effects take the full gate.
- Every milestone that ships pushes to `main`, and every push needs a patch note (CLAUDE.md). The table names one only
  for R1 and D3 (`:514`, `:519`). D2 ships the held duo's art on its own (`:518`). Its patch note must not announce
  her, or D2 should ride D3.

**L6 LOW: tests and display numbers to add.**
- Ruri and Hana are Tryout Day students (`src/data/tryout.js:36-40`). T_ruri's +1.0 relay reach (`:324`) becomes
  Bounding Fox's leash. Add `tests/sim/tryoutGolden.test.js` to the goldens re-pinned at `:503`, and run the Tryout
  ceiling gate with T_ruri.
- Round 5's Power factors (`src/data/powerKit.js:17` on `feature/balance-r5`: `ruri: 2.08`, from her round-5 DPS) need
  a refit after the rework, and the duo needs a factor or none (`tests/systems/powerKit.test.js`: "Power never
  drops").
- Add a mid-wave co-op checkpoint to `tests/sim/snapshot.test.js` with lure foxes, Lured walkers, prints and a hunting
  Kon. The serializer stores them, but nothing exercises them.

**L7 LOW: the gift.**
- Say that the "Kon Meets Kaze" and "Old Friends" unlock is worked out from owning both girls (or checked at load), so
  players who already own both get it at once.
- The title "Old Friends" sits oddly with the bio. The bio says they "met because their companions did" and "have said
  about ten words to each other" (`:387`, `:389`).

**L8 LOW: two wording nits in "today".**
- `:57`, "In the sim the spot never changes during a wave": it moves when a mid-wave upgrade changes her relay reach
  (River Paws and Tide Otter T3, `unitsExpansion.js:367`, `:369`). `updateRelayOrigin` runs on upgrades
  (`towers.js:1438-1456`).
- `:352`, "×60–×150 on its partner weapon": Grand Spectrum's beam is ×11.7 (`unitsDuo.js:75`; `DUO_LR.md:279`), so the
  range is ×11.7–×150.

---

## 3. Verdict

**NOT OK.**

Must be fixed and re-reviewed before anyone builds from this spec:
- **H1** The LR band against the existing LR units' crowd numbers and the no-nerf rule, and Q8's missing crowd side.
- **M1** Files missing from §5.1: `src/sim/mods.js`, `Sim.js`, `combat.js` and `enemies.js`, `src/data/unitKit.js`, the
  duo's row in `src/data/potential.js`, CONTRACTS.md and the ability vocabulary.
- **M2** Bounding Fox's hunting Kon: where he looks, a home rule, the intended coverage.
- **M3** Lured: the stall promise, the lock length, the caps against Follow the Fox, shared stretches, blinks and
  placement.
- **M4** Kon's run: his spot apart from `relay`, the stretch geometry, shared stretches, Wind Chase's lane.
- **M5** Battle saves: a pre-rework Ruri restored onto new paths, and the per-girl timers with their snapshot
  classification.
- **M6** "Field Trip" is reserved: rename the banner.

The LOW findings (L1 to L8) can be fixed in the same pass. None of them blocks on its own.
