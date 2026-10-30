# Gear update specs: independent review, round 2

Reviewer: a fresh agent that wrote none of these specs and did not do round 1 (review gate, HANDOFF §6).

Reviewed: `spec/gear-update` at `cfe3f57c`, which holds:
- `docs/specs/GEAR_UPDATE.md` r2 ("GU");
- `docs/specs/ACCESSORIES.md` ("ACC");
- `docs/specs/BUILD_COACH.md` ("BC");
- `docs/review/gear-update/OWNER_BOARD.md` ("board").

I checked them against round 1 (`review-r1.md`), against `main` at `60ce9cad` and against `feature/balance-r5` at `83b72083` ("r5"). `main` is v0.1.61, with `COOP_PROTOCOL` 13 and sim id `be940ecb2087`, which equals `KNOWN[13]` (`tests/art/itemArtRuntime.test.js:200`). Line numbers refer to those trees.

No tests were run (the machine is overloaded). Every code claim below comes from reading the code. Every number comes from the live formulas or from the specs' own tables, and is labelled as such.

New findings continue round 1's numbering: **F8–F9** (MEDIUM) and **L14–L26** (LOW).

**Verdict: NOT OK.** There is no BLOCKER or HIGH finding. There are 2 MEDIUM and 13 LOW findings.

Checked against the code, every round-1 finding is fixed:
- F5's versioned export is sound. Every build a player can still run refuses a `version: 3` code.
- The stored save at version 2 is safe in an old tab, and I found no refund or duplication path.

The two MEDIUM findings are new, and both touch the owner's Oct 30 decisions:
- **F8:** the LR-unit target ("about 2.5–3× the best Kage tier 5") has no owner in the plan, and G4 is calibrated on LR units far below it.
- **F9:** G4, the Q6 gate, cannot be run as written.

§4 gives the full verdict.

---

## 1. Round-1 findings, checked against the code

| # | Where r2 fixes it | What I checked in the code | Status |
|---|---|---|---|
| F1 | GU §8.3 levers 1–4 (`:630-653`), G1 (`:671`), knobs reworded (`:664-665`), M2 / M3 budget (`:930-931`), board Q5 note (`:37-40`) | `dotMul` is still `min(1.25, 1 + 0.5 × gear ATK)` (`progression.js:461`, `:502`). Suzu's crit lines fill in (`gearStats.js:135`) but still feed `critChance` ("Fill lines still feed their own stat too", `gear.js:862`), so lever 1 needs no new key and adds no draw. r5's rows exist (`src/data/balance.js` on r5) | Fixed (nit in L26) |
| F2 | You're It as an enemy record (`GU:324`); Control Strength through `statusCtxFor` at every control site (`:185-204`); the files are on M2's list (`:777`) | I listed every `applyStatus`, `_applyStatusEvent` and `applyStatuses` call in the sim (detail below). The table matches. `applyStatus` scales by `CC_RESIST` and then spends `ccLeft` (`status.js:39-41`), so multiplying first is a one-line change | Fixed (L18: DoT ticks) |
| F3 | Buff Duration per kind of buff (`GU:174-183`); fit rule (`:208-211`) | Brews are continuous: re-brewed every 6 s, each lasts 6.5 s (`constants.js:179-181`, `buffs.js:98`, `:117`) | Fixed |
| F4 | GU §11.2 (`:851-874`) | `valid_card_unit` is `friend_support.sql:130-160`, with at most 4 entries (`:144`) and the key lists as quoted. `valid_profile_card` (`:166`) and `set_support` (`:276-286`, 2,048 bytes at `:284`) both call it. `profile_stat_ok` is last defined in `profile_gear.sql:17-26` (✦ 0–3). The rarity regex accepts `'lr'`, levels 0–99, ▲ 0–9, and stat ids up to 16 letters (`auraRangePct` fits). Old viewers skip unknown slots and rarities (`profileCard.js:124`), so a pre-M2 tab shows three pieces and does not crash | Fixed (L21: the budget number and the `ac` shape) |
| F5 | GU §9.2–§9.5 (`:704-761`) | See §2.1 | Fixed (L19: two small losses) |
| F6 | Board Q15 (`:77-82`); `GU:232-234` | — | Fixed (open, with a sensible default) |
| F7 | GU §5.3 (`:517-522`); board Q16 (`:84-87`) | The mark is `tfc:<titan>:<step>`, solo only (`src/systems/titans.js:9`, `:243-250`). Nightmare is step 2 (`src/data/titans.js:17`, `:88`). The first-clear table matches §3.6 (`titanRewards.js:76-85`) | Fixed (L20: the welcome box) |
| L1 | `GU:808` | Today `rainbow: set.ur` (`progression.js:505`), against the row `int(0, 3)` (`statLimits.js:50`) | Fixed |
| L2 | `GU:344-349` | `gearSetInfo` shape (`gear.js:808-818`); its readers `gearUr.js:165` and `gearView.js:157` | Fixed |
| L3 | `GU:135-140` | Sixteen files read `GEAR_SLOTS`. Each is on §2.2's list or in §11's screens (`wiki.js`, `gearTile.js`, `girlGear.js`, `backpack.js`, `unitBuild.js`, `unitSheet.js`, `gearUr.js`) | Fixed |
| L4 | Caps of 30 % and 50 % (`GU:149`, `:151`) | — | Fixed |
| L5 | ×1.2 on the hit (`GU:245`, `:357`) | — | Fixed |
| L6 | `critChance: 0` (`GU:280`, `:326`) | Finale Pop strips more than crit (`towers.js:2251-2253`) | Partly fixed (L17) |
| L7 | `AURA_FILL_FROM` (`GU:159-163`) | Today `gearFillIn` reads `BATTLE_CAPS` (`gear.js:885-888`) | Fixed |
| L8 | Refunds by tier paid (`GU:723-725`) | `enhanceInvested` (`gear.js:537-544`). I re-derived +13 … +18 at 277,200 | Fixed |
| L9 | All six sets (`GU:494`, board `:57`) | — | Fixed |
| L10 | `MIRRORED_ITEMS` + 17 (`GU:714`, `:885`); the Normal-tier SR box (`:365`) | The chest odds match `titanRewards.js:60-69` | Fixed |
| L11 | `GU:596-602` | — | Fixed |
| L12 | Wording (`GU:222-224`); lockets (`:289-297`) | — | Fixed (one slip, L26) |
| L13 | Board notes on Q5 and Q14 (`:37-40`, `:69-71`) | — | Fixed |

**F2's call sites, in full.** The control sites, all on GU's table:
- `Sim.js`: `:609` (the wrapper), `:623-633` (`_onHitEffects`) and `:640` (push-back);
- `abilities.js`: `applyStatuses` (`:420-436`) and its callers `:448`, `:556`, `:607`, `:961`, `:962`, `:1140`;
- `hero.js`: `:430`, `:436`, `:438`, `:449`;
- `barricades.js`: `:364`, `:415`, `:417`;
- `vines.js`: `:56`;
- `zones.js`: `:279`, `:283` (the shared context is set at `:296-299`);
- `lab.js`: `:176` (set at `:213-216`);
- `potential.js`: `:107`, `:163`;
- `duo.js`: `:273`.

The only call the table leaves out is `Sim.js:813`, a curse spread, which applies no control.

---

## 2. The new design: what checks out

### 2.1 F5: the save versions (checked most closely)

**Every build a player can still run refuses a `version: 3` code.**
- Both export paths go through `store.exportSave()`, which calls `serializeProfile` (`store.js:353-355`): Settings' "Export & copy" (`settings.js:287`) and the transfer code (`settingsOnline.js:132`).
- Both import paths run `deserializeProfile` (`settings.js:365`, `store.js:358`). It throws "Newer save" on `version > SAVE_VERSION` (`save.js:797`), and the screen says why (`settings.js:368-370`).
- That check has existed since at least Oct 16 (`d8139ccc`). The game has no service worker, so an older bundle lives on only in a tab left open since then.

**Keeping the stored save at version 2 is required, not just safe.**
- The stored save is `JSON.stringify(profile)` (`store.js:68`, never `serializeProfile`), at `version` 2 (`save.js:662`).
- An old tab that finds `version > 2` starts a fresh profile (`save.js:720`) and would then save over the real one.

**An old tab that loads a post-M2 save can mint nothing.**
- Its `restoreGearMarks` pays for a missing piece only through three keys: `gbx:` (step 1b, `gearMarks.js:127-147`), `gur:` (step 2, `:148-163`) and `gtn:` (step 3, `:165-181`). GU writes none of the three for a new-slot piece (`GU:731-734`).
- The other legacy keys do nothing for a missing piece. Steps 4 and 5 skip it, and `gbl:` is read only through a `gbx:` key.
- An old `writeGearMarks` deletes and rewrites `gcl:`, `gnx:` and `gnf:` on every save (`:86`). That is why `gpc:` has to be a key of its own.
- `own:<id>:hair`, `own:<id>:necklace` and `own:<id>:acc` do nothing in an old build either: it looks up `own:` keys by exact name, for its three slots only (`rosterSave.js:75-84`).
- `cleanNumberMap` keeps any finite number (`save.js:213-221`), so the large `gph:` and `gps:` codes survive.
- I re-derived both encodings. Every field fits its decimal range; a substat's `base` stays under 10 (Armor Pierce tops out at 5.6 in Legendary form).

**Classic-slot LR pieces round-trip through an old tab without loss.**
- An old build reads a Charm, Ribbon or Shoes LR piece as UR +12 (`save.js:291`).
- Its step 6 trims the extra ▲ (`gearMarks.js:215`, `:239-243`), and GU gives them back.
- If the player salvages the piece in the old tab, that build pays the UR part, and GU's "piece gone" rows pay the LR part. Together that is exactly what an M3 salvage pays.
- Only `salvageGear` removes pieces (`gear.js:623-640`), and clan donations never move gear. Once M0's salvage drops `glr:`, `gtx:` and `gtp:`, the new rows cannot fire for any other reason.

I found no duplication path. Two small losses remain (L19).

### 2.2 Caps, hashing and the co-op id

**Where the caps live, and what moves the sim id.**
- The gear caps are `BATTLE_CAPS` (`gearStats.js:48`), applied in `unitBattleStats` (`progression.js:474-513`).
- Neither file is hashed: `tools/simId.mjs` hashes `src/sim`, the co-op entry files and what they import. So a gear cap change on its own keeps the sim id.
- Every honest value a raised cap unlocks must also pass a hashed limit:
  - the co-op clamp rows (`statLimits.js:30-60`; unknown keys are dropped, `:81-90`);
  - the sim's guards: `PIERCE_K_MAX` (`gearRules.js:18`), `SKILL_HASTE_CAP` (`:80`), the ult cap (`hero.js:113`) and `INCOME_INTEREST_MAX` (`constants.js:170`);
  - two crit clamps at 1 (`mods.js:803`, `buffs.js:35-36`; L15).
- So every cap a player can reach in this update moves the sim id, and GU puts each one in M2's or M3's bump (`GU:777-778`, `:792-810`). The exception is the two crit clamps (L15), whose files are already on M2's list.
- M0, M1, the pins and C1 keep the sim id. Standard accessories (A1) stay inside today's rows; for example, today's honest `damageMul` of about 9.6 plus 15 % ATK stays under 15.

**No int or NaN risk from the multipliers.**
- The sim does no 32-bit maths on damage, HP or cash. The only `| 0` is the desync hash (`simHash.js:13`), which is defined for any number.
- `ultHaste` up to 1.0 is read only through caps (`gearRules.js:90`, `hero.js:113`), so `round(100 / (1 − h))` stays finite.
- Prices multiply `costMul` with aura cost cuts (`Sim.js:1059`, `:1273`), so a cost of 0.5 never goes negative.
- A sale refunds a share of what was actually spent (`Sim.js:1346`), so there is no buy-and-sell loop.

The one unbounded number is compound interest (L16).

**Super crits add no draw.**
- `Sim._hit` draws once whenever `critChance > 0`, also at 1 or above (`Sim.js:575`), and `computeHit` crits on `roll < critChance` (`combat.js:91-92`). So `r < c − 1` reuses that same number.
- Right Angle and the average crit draw nothing.
- Two unplanned draws remain elsewhere (L17).

### 2.3 The Q6 gate

It is not measurable as written: see F9.

### 2.4 ACCESSORIES.md

**The slot id.**
- No save key, counter prefix, item id, unit-stat key, card key or SQL key uses `acc`, `ac`, `acc_` or `apity:` today. I searched `src`, `tests`, `tools`, `e2e` and `supabase`.
- `acc` does already name the sim's step accumulator, and `.acc-*` is a style on achievement rows: a naming note (L22).

**The R1 mechanics are deterministic.**
- The co-op layer runs every Sim call inside `withDetMath()` (`src/core/detMath.js`). The duo's code keeps to + − × ÷, `Math.sqrt` and `Math.round` (`duo.js:32`). Step timers, uid tie-breaks and integer rail lives fit those rules.
- Target Call maps onto `attackMortar`. A shell is aimed at a lead point and queued with `left: MORTAR_DELAY` (`towers.js:1306-1340`). "Land at once" means skipping that queue for a called target, and "always split" means forcing `refract`.
- Both are deterministic. The number of draws and the number of live rails still need wording (L17, L23).

**The banner terms match the gacha code.**
- 120 / 1,200 gems is the Recruit price (`types.js:293-294`).
- The rates add up to 100 %, which is 1,000,000 in the code's ppm (`banners.js` `RATES`).
- There is no spark for LR units (`banners.js:8`).
- A per-LR count that carries over matches the Legend Promise (`LEGEND_PROMISE = 300`, `banners.js:113-114`).

One sentence about the expected cost is wrong (L24).

**The balance stacking.** The arithmetic holds: 2.5–3× × 1.4–1.5 = 3.5–4.5×. A-G1 measures each R step against her own output. But nothing sets the 2.5–3× base (F8), and A-G2 leaves G4 no headroom (F9).

### 2.5 BUILD_COACH.md

**Every data source it names is real:**
- `levelCapAt` and `levelCap` (`progression.js:94`, `:100`), `breakthroughCost` (`:368`), `AWAKEN_COSTS` (`:413`; module-private, L25) and `canAwaken` (`:433`);
- `essenceBalance` (`essence.js:75`) and `raiseCost` (`:88`), `enhanceCost` (`gear.js:519`);
- `itemSources` (`inventory.js:236`: best sources first, with a `stageId`) and `isStageUnlocked` (`unlocks.js:163`);
- the stage `drops` tables (`stages.js:161`), `POTENTIAL_BOARDS` (`potentialBoards.js:70`) and `hasLrStep` (`:142`);
- the `book_<rarity>` items, and the "should coach" line (`aimControl.js:33`);
- the bench harness: r5's `r5Bench.mjs` exports `measure` and `maxedProfile`.

**The names are free.**
- None of the new files exists yet: `src/ui/buildCoach.js`, `src/ui/styles/buildCoach.css`, `src/systems/buildCoach.js`, `src/data/buildCoachData.js`, `tools/balance/buildCoachBench.mjs`, and the new tests and e2e.
- They are kept apart from the tutorial's `src/ui/story/coach.js`, `coachSteps.js`, `coach.css` and `tests/story/coach.test.js`.
- No counter uses `cm:`.

**It is a no-sim-change milestone.** Nothing under `src/sim` or the co-op entry files imports the coach's files, so C1 keeps the sim id.

### 2.6 The owner board

- Q15–Q18 are the real open decisions, and their defaults are sensible. Q15 and Q16 close F6 and F7.
- Nothing commits a gem price or generator spend without the owner:
  - The only gem price is the Accessory Banner's, and Q17 leaves it open (L24: A2 should say that it waits for the answer).
  - Set Boxes, pins, the Lens and standard accessories are never sold for gems.
  - Every new icon comes from the Blender items pipeline on `feature/gear-icons`. That branch's own review r2 said OK, its set ids match `SET_IDS`, and it spends no generator credits.
- Missing from the board: the LR-unit target (F8), and the accessories' power and R5 cost on Q17 (L24).

### 2.7 Names and content

- I searched the three specs, the board and the r2 commit message, ignoring case, for other games' and anime names: there are none.
- The new names have no hits in `src`, `tests`, `tools`, `e2e` or `CONTRACTS.md`: the six accessories, the Walkie-Talkie Pair, the Lab Goggles, Target Call, Charged Rail, the new achievements, Build Coach and Set as Main.
- Every design is an everyday school or tech object. Nothing sexualises a student; there is no swimwear and no gore.

---

## 3. Findings

### MEDIUM

**F8 MEDIUM: the owner's LR-unit target (about 2.5–3× the best Kage tier 5) has no milestone, no gate and no line on the board, and G4 is calibrated on LR units far below it.**
ACC `:36-38`, `:139`, `:154`; GU `:16`, `:664-665`, `:674`; board (no question).

*Nobody owns the target.*
- Only ACC states it, as something "the balance work" sets (`ACC:139`).
- GU carries "LR's should be more op!" into LR gear only (`GU:16`).
- r5 does not do it, and no milestone, gate or board question does either.

*Today the LR units are nowhere near it, and the measure is undefined.* On r5's bench:
- Kage's ruler is 2.22M (`docs/BALANCE.md:33` on r5).
- Tenka's ruler is 1.80M, about 0.81× (`:40`). The bench puts only the duo at LR (`:23`).
- The duo reads 3.94M on a boss, about 1.77×, and 8.71M on her own crowd ruler, about 4.8× Kage's crowd number of 1.83M (`:42`).

So the target needs a measure as well as an owner.

*G4 depends on it.*
- G4 tunes the Wyrm band with "the LR duo and Tenka at their r5 rows" (`GU:674`).
- If the LR units are raised to 2.5–3× after M3 ships, the best full blank-LR board, which includes them, beats the Wyrm every run.
- The knobs can then no longer go down, because "Nothing a player owns is ever lowered" (`GU:664-665`).
- ACC's A-G1 (`:154`) measures each R step against her own output, so it cannot catch a missing base either.

*Fix:*
1. Give the LR raise a home before G4 runs: either its own sim release after r5, or a named part of M2's or M3's raise-only pass. Budget it.
2. Add a gate on r5's bench: each LR unit's ruler ÷ the best Kage tier 5's ruler lies between 2.5 and 3.0. Name the ruler, for example her own job's ruler against Kage's number on the same target.
3. Run G4 and A-G2 with the LR units at their raised rows.
4. Put the target and its measure on the board as a question, or record it as the owner's decision.

**F9 MEDIUM: G4, the gate for the owner's changed Q6, cannot be run as written.** GU `:674`, `:687-688`, `:897`, `:931`; ACC `:155`.

*The tool cannot run the boards G4 names.*
- `tools/gearGuard.mjs:57` calls `runBot` with no `build`. Every run therefore plays the bot's `team` board: Kage, Shiro, Aoi, Akane, Miko, Momo, Sango, Yuki and Hikari (`tools/freeplayBot.mjs:24-29`).
- The bot knows only two builds, `team` and `kage` (`:24-35`).
- Build W is a modelled board with assumed shares (`docs/specs/GEAR_STATS.md:581`).
- No board holds the duo or Tenka.
- r5 has no Freeplay or Wyrm bench at all: its `tools/balance/` holds only `bench.js`, `headroom.js`, `r5Bench.mjs`, `r5Finales.mjs`, `r5Titans.mjs` and `rosterWave.js`.
- §12 does not list `tools/freeplayBot.mjs` (`GU:897`), and M3's estimate does not include this work (`:931`).

*The count is ambiguous.*
- "1–3 of 4 runs" sits beside two stages and four seeds, which make 8 runs. Is the band per stage, or over all 8?
- "Any board one tier weaker" is not defined.

*The band is fragile.*
- The sim is deterministic, so the knobs (`GU:687-688`) are turned until these particular seeds give 1–3 wins.
- One knob step can flip several seeds at once.
- Nothing records how close a loss was, so the tuner has no number to steer by.
- "Sometimes" then describes four seeds, not a player's odds.

*The accessories have no room left.* A-G2 allows the best board at most 3 wins in 4 with R5 accessories (`ACC:155`). If G4 lands on 3 wins without accessories, the accessories' "super strong" R5 has nowhere to go.

*Fix:*
1. Add `buildW` and an LR board (the duo and Tenka with their best supports) to the bot's `BUILDS`, and a `--build` option to `gearGuard.mjs`. Put both in §12 and in M3's effort.
2. State the count. For example: 4-5 and 1-5 on Blossom × seeds 7, 11, 13, 17 = 8 runs, passing at 2–6 wins with at least one win on each stage.
3. Record a margin on every run: the Wyrm's HP left when the board falls, or the seconds the kill took.
4. Define "one tier weaker", for example every preset below `lrBlank5'`.
5. Say that G4 is measured without accessories and aims at the low end of its band, and that A-G2 is measured with R5 accessories.

### LOW

**L14 LOW: the battle ceilings bind on honest builds, so the stat above them is wasted.** GU `:250-253`, `:329`, `:794`, `:798`.

§3.2 says the ceilings sit "far above any honest build". Worked from §4.2's own formulas, that does not hold for two of them:
- **Crit on a Geometry Set LR girl.** Two Crit Rate mains at +18 give about 50 % each, and three best Crit Rate lines (a Collar Pin, 2 ▲, ✦✦✦) give about 55 % each. That is about 265 % before her kit and auras, against the 200 % ceiling.
- **Ability haste on a Power Bank Set LR girl.** A Skill Haste main gives about 70 % and four best lines about 78 % each. Half of her Skill Haste is then about 1.9, against the 0.75 ceiling.

§10.2's own honest maxima already sit at these two ceilings (2.0 and 0.75).

*Fix:* treat each battle ceiling as the cap in `unitBattleStats` and `gearFillIn`. The part above it then fills in (Every Line Counts) and shows MAX, and G10's clamp identity holds. Reword "far above any honest build".

**L15 LOW: super crits: the two clamps at 1 are not named, nor is who may pass them; and the borrowed-girl rule contradicts itself.** GU `:453-456`, `:777`, `:870-873`.
- *The clamps.* The unit's crit is merged into her kit's crit at `min(1, …)` (`mods.js:803`), and every crit buff again at `min(1, …)` (`buffs.js:35-36`, the turret line included). Super crits need both lifted. §4.5 says only Geometry's set cap or five Blank LR pieces may pass 100 %. A global lift would hand super crits to any crit girl whose kit and aura crit pass 1.
- *The borrowed girl.* §11.2 lets a borrowed girl keep "her set's 2 / 4 / 5 bonuses and set cap" (`:871`), but also lists "no super crits" among the LR-only extras that stay home (`:873`). Geometry's set cap reaches super crits at M2, with no LR piece.

*Fix:* name both sites in §4.5 and §10.1 with the rule `min(ceiling, …)`: the ceiling is 2.0 for a girl with five Geometry pieces or five Blank LR pieces, and 1 for everyone else. Decide the borrowed Geometry girl's case; keeping the set cap and saying so seems simplest.

**L16 LOW: uncapped compound interest is the one unbounded number in the sim.** GU `:247`, `:253`, `:679`.

*Why it grows without bound:*
- At a wave clear, every tower with an `income` block pays `min(150, interest × cash)` (`Sim.js:927`).
- Unit stats belong to the girl, so every copy of a Treasurer Momo skips the cap, and copies are unlimited.
- Piggy Bank's 2 % interest costs 120 coins (`units.js:503`), so a board heavy on money grows cash geometrically.
- Freeplay has no last wave (`src/data/freeplay.js:110`).

*What happens:*
- At ×2.2 a wave, cash passes 2^53 after about 40 waves and overflows after about 900.
- One Infinity gain then leaves `_cashCarry` at `Infinity − Infinity = NaN` (`Sim.js:472-479`), and the next gain turns cash into NaN.
- From then on nothing can be bought, and a battle save writes the cash as null.
- The run is deterministic, so co-op never desyncs, but it is broken.

Freeplay already guards HP the same way (`hpMax: 1e7`, "an overflow guard only", `freeplay.js:39`).

*Fix:* make a maths ceiling part of the design, whatever G9 decides on balance: a per-girl ceiling on interest a wave (the knob's 5,000 is fine), or a cash ceiling beside `hpMax`. Add a unit test that a Treasurer board's cash stays finite.

**L17 LOW: two sources of rng draws that the plans call drawless.** GU `:280-281`, `:326`, `:818`; ACC `:181-183`.
- *Confetti Burst.* It copies Finale Pop only for `critChance: 0`. Finale Pop also clears `status`, `mark`, `silence`, `reveal`, `knockback` and `hpPct` (`towers.js:2251-2253`). A burst that keeps her statuses runs her on-hit effects on each target it hits, and any status with `chance < 1` draws from `ctx.rng` (`status.js:29-31`). That breaks §3.4's "Random draws: none".
- *Target Call.* Its forced splits add shard hits. `shardSpec` copies `...snap`, crit chance included (`duo.js:284-295`), so each forced shard draws its usual crit roll. ACC §7 says the accessories add no draw.

*Fix:* give `burstSpec` Finale Pop's whole stripped spec. Say in ACC §7 that forced shards draw like any shard, as a planned change.

**L18 LOW: You're It skips burns and poisons.** GU `:324`.

§3.4 applies the bonus in `computeHit` only. Burn and poison ticks go through `computeDot`, which applies the marks too (`combat.js:173-178`, through `damageTakenBonus` at `:47-50`). So "+6 % damage from every girl" would not reach DoT damage.

*Fix:* apply `1 + e.it.bonus` as a factor beside `damageTakenBonus`, so both paths take it.

**L19 LOW: two refunds still go missing after an older build.** GU `:711-712`, `:731-734`, `:753`.
- *A box-born UR Hair Clip or Necklace has nowhere to keep its paid levels.*
  - The Rainbow Gear Box now reaches all five slots (`GU:371`).
  - `enhanceGear` writes `gbl:` bits for every UR piece below +10 (`gear.js:574-577`), and salvage reads them back from counters (`boxPaidBits`, `:526-530`).
  - GU forbids `gbl:` on the new slots, and `gph:` keeps only a single "box-born" flag. Salvage would then pay those levels at Legendary prices, up to 13,000 coins short.
  - `gbl:` is harmless in an old build: it is read only through a `gbx:` key (`gearMarks.js:127-147`).
- *A pin or the Nightglass ✦ can vanish with its line.*
  - An old build's Fortune Dice can reroll a pinned or Nightglass-stitched line to another stat, since that build knows neither.
  - `gtp:` and `gtx:` are kept by stat, so the mark then names a stat that is gone.
  - GU neither re-applies it nor refunds it. GA's step 3 refunds the same case for ✦ (`gearMarks.js:165-181`).

*Fix:* allow `gbl:` for new-slot pieces, or keep their 10 paid bits in `gph:`. Add a row: a `gtp:` or `gtx:` bit whose stat is gone pays back its pin or Needle, once.

**L20 LOW: the welcome Mythic Set Box has two triggers and no shared mark.** GU `:506`, `:519-522`.

A new player gets the box "when Titan Trials open (after 3-5)"; a veteran gets it on M2's first load (`su:vet`). Titan Trials has no welcome gift to reuse today. If the builder makes the welcome trigger "the first load past 3-5" with a mark of its own, a veteran is paid twice.

*Fix:* use one mark for the welcome box, set by whichever trigger pays it first.

**L21 LOW: the card's byte budget, and the shape of the `ac` key.** GU `:859-860`, `:869`; ACC `:191`.
- *The budget.* The client budget is measured with `JSON.stringify`, but the server's 8,192-byte cap applies to jsonb text, which "runs ~13% longer" (`profileRules.js:18-21`). A 7,600-byte budget therefore allows about 8,600 bytes on the server, and the heaviest cards would be refused.
- *The `ac` key.* GU says `ac` is `[id, R]`, for the personal accessory only. ACC says `[accessory index, R]`, or `[index, grade]` for a standard accessory. The one SQL paste must accept the final shape, or a second paste will be needed.

*Fix:* keep the budget at or under about 7,200 bytes, or measure the jsonb-style length. Define `ac` once, as two numbers (for example `[index in one append-only ACC_IDS list, level 1–5]`), and write that rule into the SQL.

**L22 LOW: the accessory slot clashes with loadouts.** ACC `:23`, `:51-54`, `:166`; GU `:591-592`.
- ACC stores the accessory as `unit.gear.acc`, an item id.
- GU says `unit.gear` always equals `presets[preset]`, which has five slots, so a loadout switch would drop the accessory.
- Every other `unit.gear` value is a piece uid, and some code reads them all (`student.js:1106`; harmless today because `awakenReady` checks for a missing piece).
- ACC already avoids a bare `accessory` identifier, but `acc` has the same problem: it already names the sim's step accumulator (`Sim.js:193`), and `.acc-*` is a style on achievement rows (`achievements.css:70-74`).

*Fix:* keep the accessory in a field of its own (for example `unit.acc`), or add it to the loadouts, and say whether a loadout switch changes it. Use `accId` and `accR` for the unit-stat keys, and a distinct CSS prefix.

**L23 LOW: ACC: the number of live rails has no bound, and the duo's kit is described wrongly.** ACC `:89`, `:109`, `:182`.
- *Rails.* At base, Tenka fires 8 hitscan bolts a second (`units.js`, her `base` stats). Rapid Cycle, Zero Point, gear speed and Twin Rails' second target add more. One rail per bolt for 2–3 s means dozens to hundreds of live rails per Tenka. Every enemy tests every rail each step, and copies of Tenka are unlimited. The battle-wide budget caps rail hits, not rails or crossing tests, and it has no numbers yet.
- *The duo.* "A shell that passes through the prism splits" is not what the code does: every Nth shell splits, counted by `prismN` (`duo.js:21-24`).

*Fix:* cap the live rails per Tenka, with the newest replacing the oldest, and give the rail budget its numbers (the cost per hit, the refill, the most banked). Describe the split the way the code does it.

**L24 LOW: the Accessory Banner's numbers and its owner question.** ACC `:134-135`, `:149-158`, `:217`; board `:89-95`.
- *The cost sentence.* At a 1 % rate, about 55 % of players get the personal accessory before the 80th pull, and the average is about 55 pulls. "Most players reach R1 at the pity" is wrong.
- *Q17.* It does not show what the owner is buying: R1 at +15–20 %, R5 at +40–50 % (about 3.5–4.5× Kage), and R5 at up to 400 pulls (48,000 gems). The owner asked for "super strong", so they should see these numbers.
- *A2's gate.* A2 sets the game's first new gem price, but its milestone row (`:217`) does not wait for the answer to Q17.
- *A1's gate.* A1 adds stats to any girl but has no clamp-identity gate; A-G3 sits under A2 only.

*Fix:* correct the sentence; add the power and the cost to Q17; make A2 wait for the answer to Q17; add A-G3 to A1's gates.

**L25 LOW: BUILD_COACH details.** BC `:29`, `:55`, `:114-116`, `:123`.
- *Costs.* `AWAKEN_COSTS` is module-private (`progression.js:413`), and `canAwaken` returns only the next star's cost. Export the table, or a per-star cost function.
- *Tab names.* The girl page's tabs are Info, Level, Awaken, Gear and Tree, one word each (`student.js:70-75`), not "Level Up, Awakening, Equipment".
- *Main and the Secretary.* The home already features one girl, the Secretary (`profile.secretary`, `save.js:159`, `:611`), and the owner has said the home is busy (HANDOFF §1). Say how "Main" and its chip sit beside her.
- *Bench runs.* Say how `buildCoachBench.mjs` samples candidate builds (for example one stat step at a time, plus each set once) and how many runs that is. A full grid of girl × path × set × club split × main stats would be hundreds of thousands of bench runs.

**L26 LOW: wording and small citations.**
- "'Nightglass Lens' is the only 'Lens'" (`GU:296-297`) holds for items only. "Focus Lens" (`units.js:1370`), "Polished Lens" (`unitsDuo.js:71`) and "Steady Lens" (`potential.js:405`) are path and Potential tiers. They are not a clash.
- §3.4 cites `towers.js:340-345` for the crit draw (`GU:325`). That is the comment on `deployCrits`; the draw itself is at `Sim.js:575`.
- Lever 1's "the better of the old fill-in and the average crit" (`GU:646-647`) needs a home. Decide it in `progression.js` and send the sim a flag, so the two never stack.

---

## 4. Verdict

**NOT OK.** There is no BLOCKER or HIGH finding.
- F8 and F9 are MEDIUM. They must be fixed, then re-reviewed by a fresh reviewer.
- F8's target, and the measure behind it, can instead be set by the owner on the board.
- The LOW findings can ride along with those fixes.

| # | Severity | Finding |
|---|---|---|
| F8 | MEDIUM | The owner's LR-unit target (about 2.5–3× the best Kage tier 5) has no milestone, gate, measure or board line, and G4 is tuned with the LR units at r5's rows (Tenka 0.81×, the duo 1.77× on a boss) |
| F9 | MEDIUM | G4 (Q6) cannot be run: gearGuard plays only the bot's `team` board, so Build W and the LR boards are missing; the run count is ambiguous; four fixed seeds with no margin; no headroom left for A-G2 |
| L14 | LOW | The battle ceilings (crit 200 %, ability haste 0.75) bind on honest Set LR builds; the part above them must fill in, and G10's identity needs them capped at source |
| L15 | LOW | Super crits need the crit clamps at 1 lifted (`mods.js:803`, `buffs.js:35-36`) for Geometry 5 and Blank LR 5 only; the borrowed Geometry girl's rule contradicts itself |
| L16 | LOW | Uncapped compound interest is unbounded in endless Freeplay (exact integers lost after about 40 waves, then Infinity and NaN through `_cashCarry`); it needs a maths ceiling |
| L17 | LOW | Confetti Burst must strip statuses like Finale Pop, or chance statuses draw; Target Call's forced shards draw crits that ACC calls drawless |
| L18 | LOW | You're It sits in `computeHit` only; `computeDot` applies the marks, so burns and poisons miss it |
| L19 | LOW | A box-born UR new-slot piece loses its paid-level bits (up to 13,000 coins); `gtp:` and `gtx:` on a stat an old reroll removed are neither restored nor refunded |
| L20 | LOW | The welcome Mythic Set Box (new players) and the veteran grant share no mark |
| L21 | LOW | A client card budget of 7,600 bytes exceeds the server's jsonb cap (about 7,200 is the real limit); `ac` is `[id, R]` in GU and `[index, R or grade]` in ACC |
| L22 | LOW | `unit.gear.acc` breaks GU's rule that `unit.gear` equals the active loadout; `acc` already names `Sim._acc` and `.acc-*` styles |
| L23 | LOW | Charged Rail leaves one rail per bolt at 8+ bolts a second, with no cap on live rails and no budget numbers; the duo's split is a counter, not the prism |
| L24 | LOW | "Most players reach R1 at the pity" is wrong (about 55 % hit earlier); Q17 lacks the power and the R5 cost (48,000 gems); A2 is not gated on Q17; A1 has no clamp gate |
| L25 | LOW | BC: `AWAKEN_COSTS` is private; tab names; Main beside the Secretary; bench sampling and run count |
| L26 | LOW | Wording: "the only Lens"; the crit-draw citation; where lever 1's "the better of" is decided |
