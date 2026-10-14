# Codex Modes and Map Rules: build spec (revision 2)

Sakura Sentinels, live checkout `/home/user/sakura-game` (v0.1.25, `9bede1e`, read-only), written 2026-10-14. Roadmap task #169.
Revision 2 resolves every valid issue in `CRITIC.md` (see **Critic resolution** at the end). Revision 1 is kept as `SPEC.v1.md`.

**Owner (verbatim):** "Can you bring back the codex modifiers, it seems like they didnt come through unless its coming with the merge?"

**What "the codex modifiers" are:** the old Codex build's **6 battle modes** (Standard, Reverse Route, Goblin Rush, Ironclad, Half Income, Last Petal), with a medal for every difficulty × mode, and its **15 map rules** that pulse ACTIVE/resting on a timer (old source: `scratchpad/merge/pretty/battle-modes.js` L1-19, `campaign.js` `MAP_RULES` + `phaseFor`, `engine.js` L55-79, L117-133, L292-332, L360-402).

**Short answer for the owner:** they are not coming with the merge. The merge plan listed both as missing (`docs/merge/combat.md:103` "4 difficulties only", §3.4 rows marked ❌), and no branch builds them. This spec brings them back on the new engine: the same six modes and all fifteen rules on 37 campaign stages, in solo and in co-op battles. §1.1 lists the few places where it deliberately differs from the old build, and why.

**Evidence.** Everything is prototyped on the real sim. A Vite bundle of the live code, with the patched files swapped in from an overlay, is built by `make-overlay.mjs` (every sim patch an asserted exact-once replacement against `9bede1e`).
- `scratchpad/four-features/codex-modes/exp/` is the revision-1 prototype.
- `scratchpad/four-features/codex-modes/exp2/` is the **revision-2 prototype**, with every critic fix applied: one girl per crystal pad, the canonical calm point at wave end, vents after the grid rebuild and never on decks, drones following both range changes, rule economy and healing stopping past the goal, Ironclad armor by difficulty, the 6-3 vent moved off the overpass, Rear Ambush moved from 7-3 to 7-2. **Every number in this revision comes from `exp2` unless it says otherwise.**
- The balance bot is the one in `tests/integration/balance.test.js`: F2P roster, `autoPlan`, the expected account level per chapter, seed 1.
- Determinism: V8 (Node 22) against JavaScriptCore (Bun 1.3.14). Golden: Standard without a rule is bit-identical to the live sim.

**Rule for this document and the build:** our own names only. The mode and rule names are the owner's own, from their old Codex build. No other game's names, text or art go in. The academy girls are students: nothing in this feature is about their looks.

---

## 0. Decisions on one page

1. **Six modes, picked next to the difficulty, on campaign stages, in solo battles and co-op battles.**
   - Standard, Reverse Route, Goblin Rush, Ironclad, Half Income and Last Petal.
   - A mode is one battle option (`options.mode`) that the sim reads from one numeric data table (`src/data/modes.js`). All display text lives in UI files (§5.1), so a typo fix never forces a co-op update.
   - **Modes unlock on a stage after its first clear** (any difficulty). The old build had no gate; Q3 offers it, with its cost.
   - **Co-op freeplay runs in Standard in v1** (Q4). Rules still run there (point 6).
2. **Medals: 4 difficulty medals plus 20 mode ribbons per stage (24 = 4 difficulties × 6 modes).**
   - The existing difficulty medals *are* the Standard medals. Existing saves keep them.
   - A win in another mode earns that mode's **ribbon** for that difficulty: `progress.stages[id].modes['hard:rush'] = true`.
   - **Only Standard wins earn the difficulty medal and its gems.** In the old build any mode win also earned the medal (Q2).
   - **Nightmare × Last Petal is the same battle as Nightmare Standard** (1 heart either way), so it is earned with the Nightmare medal.
3. **What a mode win pays.** Drops, drop coins and the `battleWinHard` mission are rolled at the **reward difficulty** = the lower of the selected difficulty and your **best Standard medal on that stage**. A mode never pays more than the stage already pays you in Standard. This closes the measured Reverse Route shortcut to Hard drops (§9.6). Ribbons pay **0 gems** in v1 (Q1).
4. **Fifteen map rules, one per campaign stage from 1-4 to 8-5 (37 stages), placed by chapter theme.**
   - Never on 1-1 to 1-3, Bounty, Total Assault, the Colosseum or the clan boss.
   - A rule is numeric data on the StageDef (`stage.rule`, from `src/data/rules.js`) in a fixed effect vocabulary (§5.2).
   - Always on for its stage, in every mode and difficulty, in co-op and past the goal (point 6).
   - **Rear Ambush moves from 7-3 to 7-2** (it made 7-3 Hard unwinnable for the bot; on 7-2 the bot's ordinary plan already holds both gates, Hard W92 → W92). 7-3 gets **Moonlit Blessing**, which measured neutral there on every difficulty (§9.5).
   - **Crystal pads: one girl per pad**, the girl placed there first (§3.1). In revision 1 about ten girls fit on three pads.
5. **The rule clock restarts at every wave start; every wave end is a canonical calm point.**
   - A cycled rule rests for the first `period − active` seconds of each wave, then is ACTIVE for `active` seconds, and repeats.
   - At wave end the sim resets the clock to 0, puts the rule back to resting (always-on rules stay on), zeroes the vent strength and rebuilds the tables. A snapshot taken between waves (battle-save, freeplay checkpoints) therefore needs no rule state beyond one boolean for the route orientation (§4, §6.5).
6. **Past the goal** (`wave > stage.waves`: co-op freeplay and the solo endless run on a campaign map), a rule keeps its **combat** effects (damage, speed, range, vents, pads, rifts, ambush) and **stops its economy and healing** effects: Petal Sanctuary's hearts, Supply Ship's and Festival Encore's bonus (coins and ult), and Heat Mirage's coin per kill. Endless runs and freeplay pay per wave, so these effects would have paid out for ever (§9.8).
7. **The HUD gets three things:**
   - a mode chip next to the difficulty chip ("NORMAL · RUSH");
   - a **rule pill** with the rule icon, its name and **ACTIVE · 4 s / Resting · 9 s**, which opens a popover when tapped;
   - board decals for crystal pads, forge vents and star rifts.
   - Every "this wave comes from the other end" signal is keyed on `routeFlippedFor(n)`, *relative to this battle's usual direction*, so Reverse Route × Rear Ambush shows the right waves (§8.3).
8. **Determinism and co-op.**
   - All new sim state uses only + − × ÷, integer clocks and no rng. V8 = JSC on 15 battles, 1,352 checkpoints (§6.5).
   - **`SIM_ID` changes and `COOP_PROTOCOL` goes up by one** (`room`, `hello`, `ready` and `start` gain `mode`). The data hash adds `BATTLE_MODES`; `STAGES` carries the rules.
9. **Ship gate: one branch, one release.** M0–M6 live on `feature/codex-modes` and reach the live branch together, in the same co-op-id bump as freeplay (or roster B3 if freeplay already shipped). No rule ever goes live without its UI, and players force-update once (§12).
10. **Balance, measured as shipped (mode + the stage's rule), at the expected level (§9).** Wins out of 40, with mean hearts kept on wins:

| | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|
| Easy | **40/40** (96 %) | 39/40 (96 %) | 39/40 (93 %) | 39/40 (91 %) | 39/40 (91 %) | 16/40 |
| Normal | 39/40 (89 %) | 38/40 (91 %) | 38/40 (79 %) | 39/40 (73 %) | 37/40 (79 %) | 12/40 |
| Hard | 31/40 (69 %) | 30/40 (67 %) | 20/40 (58 %) | 21/40 (54 %) | 13/40 (60 %) | 3/40 |
| Nightmare | 0/40 | 0/40 | 0/40 | 0/40 | 0/40 | = Standard |

   - Rules alone (Standard, the 37 ruled stages, off → on): Easy 37 → 37 wins (96 → 96 % hearts), Normal 36 → 36 (87 → 88 %), Hard 27 → 28 (65 → 66 %). **The only win/loss flip on any difficulty is 2-2 Hard, L18 → W20 (Firefly Chorus helps).** Biggest moves: Normal 3-5 −8 and 5-4 +9 hearts points; Hard 4-1 +36, 7-1 +22, 4-2 −14, 8-2 −8 (§9.4).
   - The Easy gate (all 40 stages won on Easy) holds with rules on.
   - Nightmare is end-game for every mode: the bot wins no Nightmare stage at the expected level; in Standard it needs level 45 (1-2) to 69 (6-5), and more than 80 on 8-1 (§9.2).
   - On Hard, Rush, Ironclad and Half Income cost 10–18 of Standard's 31 stage wins and Reverse costs 1; Ironclad's Hard table was set so it costs what Goblin Rush costs (21 vs 20 wins, §9.3).

---

## 1. The owner's words → behaviour

| Owner said / meant | Behaviour in this spec | Where |
|---|---|---|
| "bring back the codex modifiers" | The six old modes, with the old effects scaled to the new numbers (Rush ×1.3 speed and ×0.7 spacing, as old; Ironclad armor by chapter and difficulty, because old +4 armor erased a chapter-1 girl in the new damage scale, §9.3) | §2, §5.1 |
| (old build) "a medal per difficulty × mode" | 4 difficulty medals (existing; these are the Standard medals) + 20 ribbons per campaign stage; the prep grid shows the state of each one | §7 |
| (old build) the map rules with ACTIVE/resting | 15 rules with the old cycles and effects, converted to the new attack types and elements; HUD pill **ACTIVE · n s / Resting · n s** | §3, §8.3 |
| "didnt come through" | Shown where players look: the mode picker on stage prep and in the co-op room, the rule card on stage prep and on the campaign stage card, the HUD chips | §8 |
| "unless its coming with the merge?" | No. This is new work, scheduled in §12 | §0 |

### 1.1 Differences from your old build (deliberate; each one can be reverted in data or with a small change)

| Old Codex build | This spec | Why | Owner choice |
|---|---|---|---|
| Modes open on every campaign stage from the first visit (`app.js:1150`) | Modes unlock after the stage's first clear | In the new game a stage counts as cleared only through its medals (`unlocks.js:46` `isStageCleared`). A mode clear would need a new saved "cleared" flag that drives unlocks, endless, the chapter count and the next-stage pointer, plus a `SAVE_VERSION` bump: an old cached tab would otherwise drop that flag and lock the player out of the next stage. The first visit also teaches the stage. | Q3 |
| Any mode win earned the difficulty medal (`intel-ui.js medalsHtml`) and counted as the first clear (`gacha.js:298`); medals had 1–3 stars | Only Standard wins earn medals and medal gems; modes earn ribbons; no stars | Medals now pay 20 / 40 / 60 / 100 gems. Reverse Route is easier than Standard on some Hard stages (§9.6), so counting it would be a shortcut to medal gems. | Q2 |
| The rule clock ran on global battle time and opened ACTIVE (`campaign.js phaseFor: time % period < active`) | The clock restarts every wave and each wave opens resting | Every wave has the same rhythm, so it can be learned; between waves is a clean calm point for saves and co-op checkpoints; a phase never runs out during the build pause. | — |
| Ironclad: +4 armor, bosses +8, everywhere | +1…+6 by chapter on Easy and Normal, +1…+4 on Hard and Nightmare (§9.3) | New hits deal about 0.3× the old damage (`combat.md:113-119`); a flat +4 erased chapter-1 girls. | — |
| Prism pads: any number of defenders within 1.25 (`engine.js:55`) | One girl per pad | With the new continuous placement about ten girls fit on three pads, which turned Hard 6-5 from "needs level 13" into "level 1" (critic). | — |
| Changing Tides: "water cannot hold defenders" | Dropped | Girls standing on water would be thrown off; the placement model has no answer for that. | — |
| Rain and sun weather as separate effects (`combat.md:222`) | Folded into Supply Ship (Lightning +20 %) and Heat Mirage | As the merge plan suggested. | — |

---

## 2. The six battle modes

Effects apply to every enemy that enters the battle: wave spawns, escorts, summons, broods, splits and decoys. "Battle coins" are the in-battle cash (`sim.cash`), never account coins.

| Mode (id, icon) | Card text (exact) | Sim effect | Old Codex value → new |
|---|---|---|---|
| **Standard** (`standard`, flag) | "The stage as it was built." | none | same |
| **Reverse Route** (`reverse`, two arrows) | "Enemies walk the stage backwards: they come in where they usually leave." | Every path is walked backwards: points, overpass elevation, tunnels and decks mirrored (`reversePath`, §6.1). With the Rear Ambush rule the two flags XOR, as in the old build ("Whisperleaf's alternating waves also flip"): even waves then walk the stage forwards. | `reverse: true` → same |
| **Goblin Rush** (`rush`, wind) | "Enemies move 30% faster and arrive 30% closer together." | `speedMul 1.3` on every spawn (× difficulty speed); `spacingMul 0.7` on every wave group's spacing (pool and scripted groups) | speed 1.3 / spacing 0.7 → same |
| **Ironclad** (`ironclad`, shield) | "Every enemy gains +{a} armor (bosses +{b}). Bring Armor Pierce and Armor Break." ({a}, {b} filled in for the stage and difficulty) | Flat armor +a for normal and elite enemies, +2a for minibosses and bosses. a comes from the difficulty and chapter (§9.3). Kept through boss phases that set armor (`armorBonus`, the same field freeplay uses). | +4 / bosses +8 → by chapter and difficulty |
| **Half Income** (`frugal`, coins) | "Bounties, wave bonuses and girl income are halved. Starting coins stay the same." | `incomeMul 0.5` on kill bounties, the wave-clear bonus, rule coin bonuses (Supply Ship, Festival Encore, Heat Mirage) and income girls (per-wave pay and interest). Start cash and the 70 % sell refund are unchanged. | income 0.5 → same |
| **Last Petal** (`laststand`, cracked heart) | "One heart, and no hearts come back. Let nothing reach the goal." | `maxLives = 1`; `noHeal`: Petal Sanctuary and any later life gain are switched off through `sim.canHeal()` | oneLife → same |

**Availability**

| Where | Modes |
|---|---|
| Campaign stage, solo | All six, once the stage has been cleared once (any difficulty). Before that the panel says "Clear this stage once to unlock battle modes." |
| Campaign stage, co-op battle | All six, if the **host** has cleared the stage once. The guest's Ready is consent, as for difficulty. |
| Co-op freeplay (the room's Freeplay is on) | Standard only in v1 (Q4). The Mode segment is disabled with "Freeplay runs in Standard". |
| Endless runs on campaign maps, Colosseum, Bounty, Total Assault, clan boss, tutorial, practice (locked deep link) | Standard only. `parseBattleParams` forces `standard`. |

**Nightmare × Last Petal.** Nightmare already has `lives: 1` (`src/data/types.js:182`), so the two battles are identical. The card is shown disabled with "Same as Nightmare: earned with the Nightmare medal". A Nightmare Standard win also sets `modes['nightmare:laststand']`, and `modeRibbons()` derives it for Nightmare medals earned before this feature (§7.1).

---

## 3. The fifteen map rules

### 3.1 Rules (old → new)

Conversions follow `combat.md` §2.3-2.4:
- "physical" → Pierce + Slash + Blast;
- "arcane" → Mystic;
- "ooze" → the slime family;
- "brute" → heavy armor class;
- old range ×0.72;
- coin amounts are multiplied by the stage `cashScale` and the difficulty cash multiplier, like the wave bonus.

Rules apply to every girl (drones included) and every enemy. A cycle is `[period s, active s]`. **The clock restarts at each wave start, and a wave opens resting.** "Economy" effects (marked €) stop past the goal (§0.6).

| Rule (id) | Icon | Cycle | Effect while ACTIVE (always on when there is no cycle) | Text shown (exact; lives in `src/ui/text/rules.js`) |
|---|---|---|---|---|
| **Petal Sanctuary** (`petal_sanctuary`) | petal | — | € +3 hearts after every cleared wave, up to max (never in Last Petal) | "Falling petals restore 3 hearts after every cleared wave." |
| **Firefly Chorus** (`firefly_chorus`) | firefly | 16 / 6 | every girl's damage ×1.25 (hits, traps, drones, burns, poison) | "For 6 s in every 16, fireflies boost every girl's damage by 25%." |
| **Moonlit Blessing** (`moonlit_blessing`) | moon | 18 / 9 | Holy ×1.3 | "During the bright half of each 18 s moon cycle, Holy attacks deal 30% more damage." |
| **Changing Tides** (`changing_tides`) | wave | 18 / 7 | slimes walk ×0.65; Lightning ×1.35 | "High tide (7 s in every 18) slows slimes by 35% and boosts Lightning by 35%." |
| **Snowbell Blizzard** (`snowbell_blizzard`) | snowflake | 20 / 7 | every enemy walks ×0.7; girls' range ×0.85 (drones too) | "Blizzards (7 s in every 20) slow every enemy by 30% but cut girls' range by 15%." |
| **Heat Mirage** (`heat_mirage`) | sun | 18 / 6 | girls' range −0.5 (min 1; drones too) while ACTIVE; € **always** +1 coin per kill (× cash scale; only enemies that pay a bounty) | "Heat haze (6 s in every 18) cuts girls' range by 0.5. Every defeated enemy drops 1 extra coin." |
| **Forge Vents** (`forge_vents`) | vent | 15 / 5 | the stage's vents (r 1.6) burn ground enemies inside: **6** dps × the wave's enemy-HP scale (`hpScale × difficulty hpMul × wave ramp`), Blast-typed burn, no tower credit. Never flyers (unless grounded by roster B3), tunnel walkers, enemies on a deck or under one. | "Every 15 s the glowing vents erupt for 5 s, burning ground enemies that cross them." |
| **Alchemist's Mist** (`alchemists_mist`) | flask | — | Poison ×1.4 (poison hits and poison DoT); heavy enemies walk ×0.85 | "Poison deals 40% more damage, and heavy enemies wade 15% slower through the mist." |
| **Tailwind** (`tailwind`) | wind | 16 / 6 | every enemy walks ×1.25; Pierce, Slash, Blast ×1.25 | "Gusts (6 s in every 16) speed enemies up by 25%; Pierce, Slash and Blast hit 25% harder in them." |
| **Supply Ship** (`supply_ship`) | ship | — | € every 4th cleared wave +150 battle coins; Lightning ×1.2 | "A supply boat brings 150 battle coins after every 4th wave. Rain boosts Lightning by 20%." |
| **Prism Conduits** (`prism_conduits`) | prism | — | **one girl per pad**: the earliest-placed girl whose footprint centre is inside one of the stage's 3 pads (r 0.9) gets ×1.25 damage and +0.7 range (drones too). If she is sold, the next girl standing on that pad takes it over. | "A girl standing on a glowing crystal pad gets +0.7 range and +25% damage. One girl per pad." |
| **Rear Ambush** (`rear_ambush`) | ambush | — | every even wave walks the route the other way (XOR with Reverse Route) | "Every even wave comes in through the goal gate. Cover both ends." |
| **Lunar Eclipse** (`lunar_eclipse`) | eclipse | 20 / 6 | Holy ×1.5; spectral enemies walk ×1.2 | "During each 6 s eclipse (every 20 s) Holy deals 50% more damage and spectral enemies move 20% faster." |
| **Festival Encore** (`festival_encore`) | lantern | — | € every 3rd cleared wave: the hero's ult recharges (if unlocked) and +120 battle coins | "Every 3rd cleared wave recharges your hero's ultimate and pays 120 battle coins." |
| **Shifting Stars** (`shifting_stars`) | stars | per wave | wave n favours one power (+50 %): Fire, Frost, Lightning, Holy, Mystic in turn; every normal or elite wave spawn slips through a star rift once (at 40 % of its path it jumps 12 % ahead) | "Each wave one power shines (+50%): Fire, Frost, Lightning, Holy, Mystic in turn. Ordinary enemies slip through a star rift once." |

Past the goal the popover adds one line: "Past the goal: no hearts or coin bonuses from the map rule."

### 3.2 Placement: one rule per stage, by chapter

Each chapter introduces its theme rules and reuses earlier ones. The first rule (1-4) is the gentlest: hearts, with no timer. The cycle is introduced on 1-5 with a pure buff. No finale gets a punishing rule on its first appearance.

| Ch | Theme | Stage → rule |
|---|---|---|
| 1 Sakura Gardens | gentle intro | 1-1, 1-2, 1-3 **none** · 1-4 Petal Sanctuary · 1-5 Firefly Chorus |
| 2 Moonlit Lakeshore | water, slimes | 2-1 Changing Tides · 2-2 Firefly Chorus · 2-3 Changing Tides · 2-4 Supply Ship (the ferry) · 2-5 Changing Tides |
| 3 Moonveil Shrine | spirits, holy | 3-1 Moonlit Blessing · 3-2 Moonlit Blessing · 3-3 Lunar Eclipse · 3-4 Moonlit Blessing · 3-5 Lunar Eclipse |
| 4 Ironhold Pass | weather, ambush | 4-1 Snowbell Blizzard · 4-2 Rear Ambush (the bridge) · 4-3 Supply Ship · 4-4 Tailwind · 4-5 Snowbell Blizzard |
| 5 Gloomfen Marsh | poison, water | 5-1 Alchemist's Mist · 5-2 Changing Tides · 5-3 Firefly Chorus · 5-4 Alchemist's Mist · 5-5 Lunar Eclipse |
| 6 Clockwork Foundry | machines | 6-1 Prism Conduits ("Crystal Vats") · 6-2 Heat Mirage · 6-3 Forge Vents (the junction) · 6-4 Forge Vents ("Powder Kegs") · 6-5 Prism Conduits |
| 7 Oni Festival | festival | 7-1 Festival Encore · **7-2 Rear Ambush ("Mirror Parade")** · **7-3 Moonlit Blessing** (the night procession) · 7-4 Lunar Eclipse · 7-5 Festival Encore |
| 8 Ashwing Peaks | storms, heat | 8-1 Tailwind · 8-2 Snowbell Blizzard ("Frozen Falls") · 8-3 Heat Mirage ("Caldera Rim") · 8-4 Shifting Stars · 8-5 Tailwind |

All 15 rules are used, 37 placements in total:
- 4 stages: Changing Tides, Lunar Eclipse, Moonlit Blessing;
- 3 stages: Firefly Chorus, Snowbell Blizzard, Tailwind;
- 2 stages: Festival Encore, Heat Mirage, Forge Vents, Alchemist's Mist, Supply Ship, Prism Conduits, Rear Ambush;
- 1 stage each, by design: Petal Sanctuary (1-4) and Shifting Stars (8-4).

Revision 1 moved three first-draft placements (Petal Sanctuary off 3-2, Supply Ship off 4-5, Shifting Stars off 5-2: they swung those stages by +37, +28 and −38 hearts points on Normal). Revision 2 moves Rear Ambush from 7-3 to 7-2 and puts Moonlit Blessing on 7-3 (§9.5).

### 3.3 Geometry (vents and pads), in data

Written into `STAGE_RULES` and checked by `tests/data/rules.test.js` (§10):
- **vents** sit on flat road where two passes of the route run within r 1.6, away from the board edge, with **no path sample inside the circle that is elevated, under a deck or in a tunnel** (`exp2/ventscan.mjs`);
- **pads** sit on 3 placeable land points that see the most road within 3.2, at least 5 tiles apart.

| Stage | Map | Geometry | Notes |
|---|---|---|---|
| 6-1 | foundry_vats | pads (12, 7.5), (8.5, 3.5), (5.5, 7.5) | all on land a girl can stand on; (8.5, 3.5) sits by the vat water |
| 6-3 | foundry_crossing | vent **(5.5, 4.25)** | flat junction where the west road meets the loop (6.5 tiles of road from both paths inside). Revision 1's (10, 5.5) sat on the overpass, with path 1 under its deck. |
| 6-4 | foundry_core | vent (9.5, 6.25) | one straight pass through the core (3.1 tiles of road inside), flat, between the two tunnels |
| 6-5 | foundry_hangar | pads (10, 8), (2.5, 8), (16.5, 8.5) | spread along the long hangar loop |

Shifting Stars rifts need no data: the decal sits at 40 % and 52 % of each path, from `sim.ruleInfo()`.

---

## 4. How modes and rules meet everything else

| System | Interaction (decided) |
|---|---|
| **Difficulty** (`DIFFICULTIES`, `src/data/types.js:178-183`) | Everything stacks multiplicatively on the difficulty. Goblin Rush speed = `diff.speedMul × 1.3` (Hard 1.43, Nightmare 1.495). Half Income coins = `diff.cashMul × cashScale × 0.5`. Ironclad armor comes from a per-difficulty table and is added after the difficulty's HP. Last Petal on Easy, Normal or Hard is a real challenge (150 / 100 / 50 hearts → 1); on Nightmare it is merged (§2). |
| **Nightmare** (`lives: 1, noIncome`) | All modes are allowed. Half Income still halves bounties and wave bonuses (girl income is already 0). The rule still applies. Petal Sanctuary does nothing (1 heart is already the max). |
| **Co-op freeplay** (`scratchpad/coop-freeplay/SPEC.md`; `wt-freeplay`) | **Modes: Standard only in v1** (Q4). The room's Mode segment is disabled while Freeplay is on, `session.setStage` coerces `mode` to `standard` when `freeplay` is set, and `createCoopSim` ignores `start.mode` when `start.freeplay` is set (defence in depth). **Rules:** the stage's rule keeps its combat effects past the goal; its economy and healing effects stop at the goal (§0.6). Rule slows are not statuses and do not spend Resolve: Resolve exists to stop a wave being pinned for ever, and a rule slow is at most −35 % (high tide, slimes only) and at most −15 % averaged over its cycle (Alchemist's Mist on heavy enemies; Snowbell Blizzard −10.5 % on everyone), so it cannot pin anything. Whether rules shift freeplay's calibration is measured in M6 (§9.11 step 4), with a data switch per rule if they do. Records stay `coopBestWave[tier]`. If the owner later opens modes for freeplay, Ironclad past the goal follows freeplay's `bossMul` (normal and elite +a, bosses +0), Rush's spacing is applied before freeplay's 50 s `maxWindow` compression (deep waves then keep only the speed), and records become per mode. |
| **Solo endless on a campaign map** (Tactical Challenge) | Standard only. The rule applies, with the same goal cut-off as freeplay: past `stage.waves`, no hearts and no coin bonuses (§9.8). `bestWave` stays per stage. |
| **Co-op (normal battle)** | The host picks the mode; the rule comes with the stage (`coopStage` copies the StageDef, so `rule` rides along: `src/data/coop.js:58-63`). Still no medals or ribbons in co-op (`src/online/coop/rewards.js:3`). **Drops follow the same reward-difficulty rule per player** (§7.1): a co-op mode win pays each player at most their own best Standard difficulty on that stage. `result.mode` is shown on the co-op results. |
| **Battle save** (`scratchpad/battle-save/SPEC.md`; `wt-battlesave`) | The record gets `mode` (`cleanBattleSaves`: `modeId(r.mode)`), and `restoreSim` passes `options.mode`. Continue always uses the saved mode, as it uses the saved difficulty. The prep line reads "Saved battle · Hard · Goblin Rush · wave 12 of 25". **Snapshot:** one new field, `snap.rr` (the current route orientation, only when the battle has a reversible route); `restoreSim` applies it with `sim.setRouteOrientation(rr)` after the constructor. Everything else is canonical at the calm point (§6.5). **Classify the new keys** in `KNOWN_SIM_KEYS`: `mode`, `incomeMul`, `_modeArmor`, `_ruleGoal`, `_bountyAdd`, `_pathsFwd`, `_pathsRev`, `rule` → `config`; `routeReversed` → carried (`snap.rr`); `_ruleMul`, `_ruleMove`, `_ruleRange`, `_rulePortal` → `derived`; `_waveTick` → `calm`; `_ruleScratch` → `scratch`. In `KNOWN_TOWER_KEYS`: `padIndex`, `onPad`, `padMul`, `padRangeAdd`, `envRangeMul`, `envRangeAdd` → `derived` (pad owners are recomputed by `assignPads` as towers are re-placed in uid order, which gives the same owners as the live run). Its key-guard test fails until this is done (intended). Rules draw no random numbers, so the per-wave rng streams are unaffected. |
| **Roster B3** (`wt-roster` `3c47a32`: aim, mortar, relay, grounding, gather, push lock, curse, `globalDmgMul`) | No vocabulary clash: B3 adds statuses `ground` and `curse`, target mode `air` and `addGlobalDamageBuff`; rules add none of these. Mortar shells, curse bursts and relay shots all go through `Sim._hit`, so rule damage multipliers reach them. Pads use the girl's own position, not her relay origin. Vents skip airborne enemies unless `e.grounded` (B3's flag). Firefly Chorus and Luna's team damage buff stack multiplicatively. **Shared rule (§6.3): geometry caches come from `_pathsFwd`.** B3's `relaySamples(sim.pathData)` (`towers.js:758`) becomes `relaySamples(sim._pathsFwd ?? sim.pathData)`, so a familiar's spot never depends on which orientation was live when the first relay girl was placed; the route swap also clears `sim._relaySamples` as a backstop. Whichever branch lands second makes this one-line change. **Text conflicts:** `towers.js recomputeBuffs` and `refreshEffective` (B3 adds a `globalDmgMul` argument; we add `envRange*`), the `Sim.js` constructor and `_onHitEffects`. |
| **Attack FX** (`wt-attack-fx`, render-only) | No sim contact. The FX reads `t.eff.range` every frame for the drone leash (`patterns/drones.js:381`), Hotaru's swarm (`styles/hotaru.js:59`), Yuki's snow ring (`styles/yuki.js:83`), Aoi's lobe (`styles/aoi.js:62`) and Shiro's spotter. Blizzard and heat haze flip range every 18–20 s, so these radii would jump in one frame. **Change in M4 (after attack FX lands):** attackFx keeps a per-tower display radius that eases toward `t.eff.range` over 0.3 s (render only). |
| **Hero rework #168** (heroes free, levels 1-25) | Festival Encore sets `hero.ultCooldown = 0` only when `ultUnlocked`. If #168 renames these fields, update one line in `_checkWaveEnd`. |
| **Energy / 7 PM reset (spec #134)** | Same energy cost and same charge-on-win as Standard. Modes and rules are not energy items. |
| **Sweep** | Unchanged: sweeps roll Standard drops and need the Hard or Nightmare *medal* (`rewards.js canSweep`), which only Standard wins give. |
| **Missions** | A mode win counts as `battleWin`, and as `battleWinHard` only when its reward difficulty is Hard or Nightmare (§7.1). No new mission types in v1. |
| **Bestiary, kills, stats** | Unchanged. `result.mode` and `result.rule` are added for the UI. |

---

## 5. Data model

### 5.1 `src/data/modes.js` (new; numbers only; in the sim graph)

```js
export const BATTLE_MODES = Object.freeze({
  standard:  { id: 'standard',  order: 0 },
  reverse:   { id: 'reverse',   order: 1, reverse: true },
  rush:      { id: 'rush',      order: 2, speedMul: 1.3, spacingMul: 0.7 },
  ironclad:  { id: 'ironclad',  order: 3, bossArmorMul: 2,
               armorByChapter: [0, 3, 3, 1, 3, 3, 6, 6, 6],                  // Easy, Normal (index = chapter)
               armorByDifficulty: { hard:      [0, 2, 2, 1, 2, 2, 4, 4, 4],         // §9.3
                                    nightmare: [0, 2, 2, 1, 2, 2, 4, 4, 4] } },
  frugal:    { id: 'frugal',    order: 4, incomeMul: 0.5 },
  laststand: { id: 'laststand', order: 5, oneLife: true, noHeal: true },
});
export const MODE_ORDER = ['standard', 'reverse', 'rush', 'ironclad', 'frugal', 'laststand'];
export const RIBBON_MODES = MODE_ORDER.slice(1);           // the 5 that earn ribbons
export function modeId(id) { return Object.hasOwn(BATTLE_MODES, id) ? id : 'standard'; }
```

`modeArmor(mode, stage, difficulty)` lives in `src/sim/rules.js`: `(mode.armorByDifficulty?.[difficulty] ?? mode.armorByChapter)[clamp(stage.chapter ?? 4, 1, 8)]`.

**Display text (outside the sim graph and the co-op id):** `src/ui/text/modes.js`:

```js
export const MODE_TEXT = {
  standard:  { name: 'Standard',      short: 'Standard',    icon: 'modeStandard',  color: '#24305e', desc: 'The stage as it was built.' },
  reverse:   { name: 'Reverse Route', short: 'Reverse',     icon: 'modeReverse',   color: '#2bb6a8', desc: 'Enemies walk the stage backwards: they come in where they usually leave.' },
  rush:      { name: 'Goblin Rush',   short: 'Rush',        icon: 'modeRush',      color: '#ff9f1c', desc: 'Enemies move 30% faster and arrive 30% closer together.' },
  ironclad:  { name: 'Ironclad',      short: 'Ironclad',    icon: 'modeIronclad',  color: '#6c7a96', desc: 'Every enemy gains +{a} armor (bosses +{b}). Bring Armor Pierce and Armor Break.' },
  frugal:    { name: 'Half Income',   short: 'Half Income', icon: 'modeFrugal',    color: '#e0a800', desc: 'Bounties, wave bonuses and girl income are halved. Starting coins stay the same.' },
  laststand: { name: 'Last Petal',    short: 'Last Petal',  icon: 'modeLastPetal', color: '#ff4d8d', desc: 'One heart, and no hearts come back. Let nothing reach the goal.' },
};
export const MODE_RIBBON_GEMS = { easy: 0, normal: 0, hard: 0, nightmare: 0 };   // rewards, outside the co-op id; Q1
```

### 5.2 `src/data/rules.js` (new; numbers only; in the sim graph through `stages.js`)

`MAP_RULES[id] = { id, cycle: [period, active] | null, active: {…}, always: {…} }`. The exact entries are `exp2/overlay/src/data/rules.js` minus the `name`, `icon` and `desc` strings, which move to `src/ui/text/rules.js` as `RULE_TEXT[id] = { name, icon, desc, toast, short }` (§8.3 lists every string).

**Effect vocabulary (fixed; the sim reads only these keys).** The € keys are economy: they stop past the goal.

| Key | Meaning |
|---|---|
| `dmgMul` | × every girl's damage |
| `typeMul {type: ×}` | × hits of an attack type |
| `elementMul {el: ×}` | × hits carrying an element, and that element's DoT (fire = burn) |
| `enemySpeed ×` | walk speed of every enemy |
| `familySpeed {fam: ×}` | walk speed by enemy family |
| `classSpeed {cls: ×}` | walk speed by armor class |
| `rangeMul ×`, `rangeAdd +` | girls' range, drones included; never below 1 |
| € `bountyAdd n` | + coins per kill |
| € `livesPerWave n` | + hearts after every cleared wave |
| € `bonusEvery {n, coins, ult}` | every n-th cleared wave: coins and/or the hero's ult recharged |
| `zoneDps` + `zones [{x, y, r}]` | vents |
| `padDmgMul`, `padRangeAdd` + `pads [{x, y, r}]` | crystal pads (one girl per pad) |
| `reverseEvenWaves` | even waves walk the route the other way |
| `affinity [..]`, `affinityMul` | the wave's favoured element or attack type |
| `portals {at, jump}` | star rifts |

One rule-level key sits next to `cycle`: `pastGoal: 'combat' | 'off'` (default `'combat'`). Past the goal, `'combat'` keeps every non-€ effect and `'off'` makes the whole rule neutral. All 15 rules ship with the default; `'off'` is the data switch for the freeplay guard (§9.11).

`STAGE_RULES[stageId] = { id, zones?, pads? }` holds the §3.2 placement and the §3.3 geometry. `stageRule(stageId)` merges the two.

### 5.3 `src/data/stages.js`

`campaign(o)` (`stages.js:108-142`) gains `rule: stageRule(o.id)`, after `tier: o.tier` (`:140`). This is the only change. Bounty, boss and challenge builders get no rule. `STAGES` is already in the co-op data hash (`version.js:38`), so the rules are covered, and they hold no display text.

### 5.4 Profile (`src/systems/save.js`)

```js
progress.stages['4-4'] = { clears: 3, easy: true, normal: true, hard: false, nightmare: false,   // unchanged
                           modes: { 'normal:rush': true, 'easy:laststand': true } }           // NEW, optional
```

- **No `SAVE_VERSION` bump in v1.** The field is additive, absent means `{}`, and ribbons carry no currency and no progression (modes unlock from medals, which old tabs keep). Same pattern as `camera` and battle-save's `battleSaves`; it avoids `feature/roster`'s v3 bump.
- **If Q1 turns ribbon gems on, that release bumps `SAVE_VERSION`.** An old cached tab drops `modes` silently (allowlist migrate, `save.js:358-366`); with gems on, a dropped ribbon earned again would pay twice. The bump makes old tabs refuse the newer save.
- **`migrateProfile` must copy it**: `if (isObj(s.modes)) { const m = cleanModeRibbons(s.modes); if (Object.keys(m).length) entry.modes = m; }`.
- `cleanModeRibbons` keeps only keys `${d}:${m}` with `d ∈ DIFFICULTY_ORDER`, `m ∈ RIBBON_MODES` and value `true`.
- `migrationDropsData` ignores unknown ribbon keys. They are not "lossy" and must not trigger the backup prompt.
- **Battle save record** (`scratchpad/battle-save/SPEC.md` §4.2): adds `mode: 'rush'`, `view.mode` for the prep line, and `snap.rr` (§4).
- **Route params:** `#/stage/<id>?difficulty=hard&mode=rush` (remembered with `rememberParams`, `stage.js:73`) and `#/battle?stage=4-4&difficulty=hard&mode=rush`. `parseBattleParams` validates the mode: an unknown, locked or non-campaign mode → `standard`.
- **Co-op:** the `lastRoom` record (rematch, "Your last room") stores `mode` next to `freeplay`.

---

## 6. Sim changes (all in the co-op id)

Prototype: `exp2/make-overlay.mjs` (asserted exact-once replacements against `9bede1e`) plus `exp2/overlay/src/sim/rules.js`. Line numbers are the live checkout's.

### 6.1 New `src/sim/rules.js` (~260 lines, pure helpers)

| Function | Does |
|---|---|
| `modeArmor(mode, stage, difficulty)` | Ironclad armor for the stage's chapter and difficulty |
| `createRuleRuntime(def)` | `{ id, def, period, activeSteps, active, always, act, zones, pads, reverseEvenWaves, zoneDps }`; cycle seconds → integer steps (×60) |
| `routeReversedFor(sim, n)` | absolute orientation of wave n: `!!mode.reverse !== (rule.reverseEvenWaves && n % 2 === 0)` |
| `routeFlippedFor(sim, n)` | **relative** to this battle's usual direction: `routeReversedFor(sim, n) !== !!mode.reverse` (true only for Rear Ambush's even waves, in any mode). Every UI signal uses this one (§8.3). |
| `reversePath(p)` | `pathFromTrack({ points: reversed, elev: reversed, tunnels/under: [L−b, L−a] reversed }, p.index)` |
| `rebuildRuleTables(sim)` | Folds `always` (+ `act` if ACTIVE) + this wave's affinity into `sim._ruleMul {all, type, el}`, `_ruleMove {all, family, cls}`, `_ruleRange {mul, add}` and `_rulePortal`. Neutral tables are `null`, so the hot paths skip them. Past the goal (`wave > _ruleGoal`) a rule with `pastGoal: 'off'` builds only neutral tables and its vents stay cold. |
| `ruleStep(sim, dt)` | Per step, **after `grid.rebuild`**: `_waveTick++` during waves; `active = tick % period >= period − activeSteps`; on a flip it rebuilds the tables, sets `_buffsDirty` and emits `ruleState {id, active}`; while ACTIVE it burns vents (`grid.query` + squared distances; skips dead, hidden, airborne-not-grounded, `e.elev > 0` and `e.underDeck`; `sim._dot(e, 'burn', zoneDps·dt, {attackType:'blast', sourceUid:null})`) |
| `ruleWaveStart(sim)` | At wave start: resting, affinity, `zoneDps = base × hpScale × diff.hpMul × _waveHpMul` |
| `ruleWaveEnd(sim)` | **Calm point** (end of `_checkWaveEnd`): `_waveTick = 0`, `active = !period`, `zoneDps = 0`, `rebuildRuleTables`, `_buffsDirty = true`; emits `ruleState` if `active` changed |
| `ruleHitScale(m, tower, type, el)`, `ruleDotScale(m, tower, kind)`, `ruleMoveMul(m, e)` | Table lookups; the pad bonus is `tower.padMul` |
| `assignPads(sim, extra?)` | Pad owners: for each pad, the lowest-uid girl whose centre is inside (each girl owns at most one pad). Sets `padIndex`, `onPad`, `padMul`, `padRangeAdd`; a change sets `_buffsDirty`. Called on placement and on sale. |
| `ruleInfo(sim)` | HUD data, numbers and ids only: `{ id, cycle, period, active, secondsToFlip, affinity, zones, pads: [{x, y, r, ownerUid}], pastGoal }` |

### 6.2 Patches to existing sim files

| File:line (live) | Function | Change |
|---|---|---|
| `Sim.js:31` | imports | `BATTLE_MODES` (`../data/modes.js`); the rules helpers |
| `Sim.js:59-63` | constructor (paths) | `mode = BATTLE_MODES[options.mode] ?? standard`; `incomeMul`; `_modeArmor = modeArmor(mode, stage, difficulty)`; `_ruleGoal = isFinite(stage.waves) ? stage.waves : Infinity`; `_pathsFwd = buildPaths(map)`; `rule = createRuleRuntime(options.rule !== undefined ? options.rule : stage.rule)` (`options.rule` exists for tests and headless only); `_pathsRev` (only if Reverse Route or Rear Ambush); `routeReversed = routeReversedFor(1)`; `pathData` = that orientation; **placement rules from `_pathsFwd`** |
| `Sim.js:79` | constructor | `maxLives = mode.oneLife ? 1 : …` |
| `Sim.js:125` | constructor end | `_bountyAdd = bountyAdd × diff.cashMul × cashScale × incomeMul`; `rebuildRuleTables` |
| `Sim.js:152` | `_step` | `if (this.rule) ruleStep(this, dt)` **right after `this.grid.rebuild(this.enemies)`**, so vents see this step's spawns |
| `Sim.js:268-269` | `spawnEnemy` | `speedMul × mode.speedMul`; `cashMul × incomeMul` (merge with freeplay's `× (o.speedMul ?? 1)`) |
| `Sim.js:274` | `spawnEnemy` | Ironclad: `add = boss/miniboss ? a × bossArmorMul : a`; `e.armor += add; e.armorBonus += add`. Heat Mirage: `if (e.bounty > 0 && wave <= _ruleGoal) e.bounty += _bountyAdd` |
| `Sim.js:297` | `_hit` | `if (this._ruleMul) scale *= ruleHitScale(…)` |
| `Sim.js:354` | `_dot` | `if (this._ruleMul) amount *= ruleDotScale(…)` (element only: burn = fire, poison = poison) |
| `Sim.js:424` | `_getWave` | lengths from `_pathsFwd`; `spacingMul: mode.spacingMul ?? 1` |
| `Sim.js:434` | `startNextWave` | after `wave++`: `setRouteOrientation(routeReversedFor(wave))`; `_waveTick = 0`; after `state='wave'`: `ruleWaveStart`; `waveStart` event gains `reversed` (absolute) and `flipped` (relative) |
| `Sim.js:450-461` | `_checkWaveEnd` | `cashMul × incomeMul` for the bonus, income and interest; when `wave <= _ruleGoal`: `bonusEvery` coins and ult reset (emits `cash {reason:'rule'}`, `ruleBonus {kind:'ult'}`) and `livesPerWave` if `canHeal()` (emits `ruleBonus {kind:'lives', amount}`); then `ruleWaveEnd` |
| `Sim.js:585` | `placeTower` | `if (this.rule) assignPads(this, t)` before `refreshTowerStats` |
| `Sim.js:682` | `sellTower` | after the filter: `if (this.rule) assignPads(this)` |
| `Sim.js:792` | new methods | `ruleInfo()`, `routeReversedFor(n)`, `routeFlippedFor(n)`, `canHeal()` (`!mode.noHeal`), `setRouteOrientation(rev)` (swap `pathData`/`paths`, clear every tower's `trapSpots` and `_relaySamples`; no-op without `_pathsRev`) |
| `Sim.js:796` | `result()` | `mode: mode.id, rule: rule?.id ?? null` |
| `enemies.js:176` | `checkPhases` | `e.armor = set.armor + (e.armorBonus || 0)` (the same line as freeplay; whichever lands first adds it) |
| `enemies.js:438-446` | `updateEnemy` | `if (sim._ruleMove) mul *= ruleMoveMul(…)`; star rift: once per wave spawn (`parentUid == null`, normal or elite) at `dist ≥ at × length` → `dist += jump × length`, `placeOnPath`, emit `rift {uid, x, y, x2, y2}` |
| `waves.js:68,80,157` | `generateWave` | option `spacingMul = 1`; `baseSpacing × spacingMul`; scripted groups `f.spacing × spacingMul`. With 1 these give identical bits, so Standard waves are unchanged. |
| `towers.js:127-140` | `refreshEffective` | `range = max(1, (s.range + envRangeAdd) × envRangeMul) × buff.rangeMul` when an env value is set; **turret range the same way** (`max(1, (turret.range + envRangeAdd) × envRangeMul) × buff.rangeMul`), so drones follow blizzard, heat haze and pads like their girl |
| `towers.js:197` | `recomputeBuffs` | `envRangeMul/Add` from `sim._ruleRange` + the pad; a change refreshes the tower like an aura change |

**Not changed:** `report.js` (the mode and rule warnings are built in the UI, §8.3), `combat.js`, `path.js`, `placement.js`, `status.js`, `hero.js`, `mods.js`, `headless.js`, `constants.js`.

### 6.3 Geometry caches come from the forward paths

Anything that depends only on where the road *is* is built from `_pathsFwd`, never from the live `pathData`: placement rules, pads, vents, `_getWave` lengths, and roster B3's relay samples. Only orderings that depend on the goal direction use the live `pathData`: trap spots (cleared on every swap) and `remaining` distance. This keeps a battle-save restore (which builds wave 1's orientation first) and the placement ghost identical to the live run.

### 6.4 Co-op layer

| File | Change |
|---|---|
| `online/coop/commands.js:58,71` | `createCoopSim`: `options: { …, mode: modeId(start.freeplay ? 'standard' : start.mode) }`. **Only `mode` is read from the message**: never `rule`, `modeDef`, `ruleGoal` or `autoGeometry` (a test sends them and checks they are ignored). |
| `online/coop/session.js:11-16,182,586,614` | `mode` in `room`, `hello.room` and `start`; the guest's `ready` carries the `mode` it agrees to; `canStart` requires `peer.mode === s.mode`, as freeplay does in `wt-freeplay` `session.js:802`; `setStage(stage, diff, freeplay, mode)` **resets `mode` to `standard` when the host has not cleared the new stage or when `freeplay` is set**; `backToLobby` keeps it |
| `online/coop/version.js:20,38` | `COOP_PROTOCOL` +1 (shared with freeplay's bump if both ship together, §12); the data hash adds `BATTLE_MODES` |
| `online/coop/lastRoom.js` | remember `mode` |

### 6.5 Determinism, calm point and co-op id

- **No transcendental math.** Cycles are integer step counts (`period = round(s × 60)`); multipliers are products of data constants; distances are squared; `reversePath` reuses `pathFromTrack` (`Math.hypot`, which `withDetMath` swaps in co-op); no `sim.rng` draws (a grep test enforces this, §10).
- **Calm point.** After `ruleWaveEnd`, the rule runtime between waves is the same whether the sim got there by playing or was just built: clock 0, resting (or on, for always-on rules), vent strength 0, tables rebuilt, `_buffsDirty` set. The one exception is the route orientation (a Rear Ambush battle that just played an even wave), which snapshots carry as one boolean (`rr`) and restore with `setRouteOrientation`. **Freeplay's M6 checkpoint list gets the same `rr`.**
- **Golden check:** Standard mode with no rule is bit-identical to the live sim (`exp2/golden.mjs`): **20/20 identical** (`hashSim`, battle time and hearts on 10 stages × Easy and Hard, including 4-2, 6-1 and 7-3, whose rules are switched off for the check).
- **Cross-engine:** `exp2/det.mjs` runs 15 battles covering every mode and every effect key (vents, pads with a sale of the pad owner, rifts, affinity, ambush in both modes, range, speed, `bonusEvery`, the Petal Sanctuary heal path, and a 31-wave endless run past the goal), inside `withDetMath`, with `hashSim` every 600 steps (1,352 checkpoints): **Node 22 (V8) = Bun 1.3.14 (JSC), digest `cccb8a5c`** (`det-node.txt`, `det-bun.txt`).
- **`SIM_ID` changes.** Changed and new files: `src/sim/rules.js`, `Sim.js`, `enemies.js`, `towers.js`, `waves.js`; `src/data/modes.js` and `src/data/rules.js` enter the graph through `Sim.js` and `stages.js`. Display text is in `src/ui/text/*`, outside the graph. Both players must update once (§12).

---

## 7. Medals, ribbons, rewards (outside the co-op id)

### 7.1 Rules

**Reward difficulty** (`src/systems/rewards.js`, new export):

```js
/** The difficulty a win pays at: Standard pays the selected one; a mode pays at most your best Standard medal here. */
export function rewardDifficulty(profile, stageId, difficulty, mode) {
  if (modeId(mode) === 'standard') return difficulty;
  const best = bestDifficulty(profile, stageId) ?? 'easy';        // unlocks.js:51
  return diffIndex(best) < diffIndex(difficulty) ? best : difficulty;
}
```

| Event | Effect |
|---|---|
| Win, Standard, difficulty D | As today (`rewards.js:130-153`): first clear, D medal + its first-time gems, unlocks, drops at D, missions, bestiary. **New:** if D is Nightmare, also `modes['nightmare:laststand'] = true`. |
| Win, mode M ≠ Standard, difficulty D | `entry.clears += 1`; **drops and drop coins rolled at R = `rewardDifficulty(…)`** (same table, same event multiplier); missions `battleWin`, and `battleWinHard` only if R is Hard or Nightmare; bestiary discovery; **ribbon** `modes['D:M'] = true` (`out.newRibbon`) — the ribbon is for D, the difficulty actually played; ribbon gems from `MODE_RIBBON_GEMS[D]` (0 in v1). **No** difficulty medal, **no** medal gems, **no** first clear (modes are locked until the first clear). `out.rewardDifficulty = R` for the results screen. |
| Loss, any mode | As today: 40 coins × waves cleared. |
| Co-op, any mode | As today (`applyCoopResult`), except a mode win rolls each player's drops at that player's own R. No medals, no ribbons. |
| Sweep | Unchanged (Standard drops; needs the Hard or Nightmare medal). |

**Helpers** (`src/systems/unlocks.js`):
- `modeRibbons(profile, stageId)` → `{ 'easy:reverse': bool, … }`, 20 keys, with the derived `nightmare:laststand = entry.nightmare || modes['nightmare:laststand']`.
- `modesUnlocked(profile, stageId)` → `isStageCleared(profile, stageId)` and the stage is a campaign stage.
- `ribbonCount(profile, stageId)` → `{ have, total: 20 }`; `chapterRibbons(profile, chapter)` → `{ have, total: 100 }`.

`applyBattleResult` (`rewards.js:84`) reads `result.mode` (from `sim.result()`), validated by `modeId`.

### 7.2 Economy (conservative; owner approval items)

- **Ribbons pay 0 gems in v1.** They are collection and bragging rights: a stage card counter, chapter totals, the results ribbon. `MODE_RIBBON_GEMS` is ready. Sizing for Q1 is in §9.7.
- **No mode pays more than Standard already pays you on that stage.** Measured: Reverse Route beats Standard on some Hard stages (§9.6), so without the reward-difficulty rule it would be the cheap road to Hard drops and `battleWinHard`. With it, a mode win at Hard pays Hard drops only once you hold that stage's Hard medal, which only a Standard win gives.
- **Battle coins from rules** (Supply Ship, Festival Encore, Heat Mirage) exist only inside the battle, stop past the goal, and never touch the account economy.
- **Energy:** same cost and same charge-on-win rule as Standard (spec #134).

---

## 8. UI (phone 844×390 and PC 1280×720)

Icons: 6 new mode glyphs (`modeStandard`, `modeReverse`, `modeRush`, `modeIronclad`, `modeFrugal`, `modeLastPetal`) and 15 rule glyphs (`rulePetal`, `ruleFirefly`, `ruleMoon`, `ruleTide`, `ruleSnow`, `ruleSun`, `ruleVent`, `ruleMist`, `ruleWind`, `ruleShip`, `rulePrism`, `ruleAmbush`, `ruleEclipse`, `ruleEncore`, `ruleStars`) in `src/art/icons/glyphs.js`, in the existing glyph style, with `modeIcon(id)` and `ruleIcon(id)` in `src/art/icons.js`. Colours are in `MODE_TEXT` (§5.1). All strings below live in `src/ui/text/modes.js`, `src/ui/text/rules.js` or the screen files.

### 8.1 Stage prep (`src/ui/screens/stage.js`)

**PC 1280×720** (two columns, as today):

- **Left column:** a new **"Map rule"** panel right after the stage info panel (`stage.js:419`):
  - the rule icon (28 px), `<b>Lunar Eclipse</b>` and the desc line;
  - a chip, either **"6 s ACTIVE every 20 s"** or **"Always on"**;
  - for vents and pads, the hint **"Glowing marks on the map show where."**;
  - the map thumb (`stageThumbSVG`) draws pads (cyan dots) and vents (orange rings);
  - on a stage without a rule (1-1…1-3) the panel is not rendered.
- **Facts row** (`stage.js:424`): **Lives** shows **1** when Last Petal is selected (as the old build did: `rules.oneLife ? 1 : d.lives`).
- **Right column:** a new **"Battle mode"** panel right below **"Difficulty"** (`stage.js:451`):
  - header **"Battle mode"**, with **"Ribbons 3/20"** on the right;
  - a 3 × 2 grid of cards (`button.ma-mode`, `role=radio`, `data-testid=mode-<id>`): icon (24 px), name (`Goblin Rush`), the card text (Ironclad shows this stage's numbers for the selected difficulty, e.g. "+3 armor (bosses +6)");
  - each card's status line for the selected difficulty: Standard "{Difficulty} medal ✓" / "{Difficulty} medal: not yet"; other modes "Ribbon ✓" / "No ribbon yet"; Nightmare × Last Petal disabled, "Same as Nightmare: earned with its medal";
  - the selected card has the yellow outline and a check (same look as `ma-diff.active`);
  - **locked** (stage never cleared): the body is a lock icon and **"Clear this stage once to unlock battle modes."**; Standard stays selected;
  - **reward line** under the grid, only when a mode is selected and the selected difficulty is above your best Standard medal here: **"Drops as Normal: beat Hard in Standard here for Hard drops."**
- **Difficulty buttons while a mode is selected** (`difficultyPicker`, `stage.js:523`): the corner shows the **ribbon state** for that difficulty instead of the medal gems: a small ribbon icon with "✓" if earned, otherwise "Ribbon". The sub line (`DIFF_SUMMARY`, `stage.js:334`) gets the mode's short effect after it under Last Petal: "+35% HP, faster, **1 heart (Last Petal)**" instead of "50 lives".
- **First clear panel** (`firstClearPanel`, `stage.js:605-616`): while a mode is selected, a muted line under the medal gems: **"Battle modes earn ribbons, not medals or medal gems."**
- **Start button** (`stage.js:475`): **"Start · Hard"** (Standard) or **"Start · Hard · Goblin Rush"**.
- The `mode` route param is remembered like the difficulty. Prep redraws on `formation`, `sweep`, `replace` and `battle-save`.
- **With a battle save** (battle-save spec §2.2): **"Saved battle · Hard · Goblin Rush · wave 12 of 25 · ♥ 63 · 12 min ago"**. The picker starts on the save's mode and only affects "New game".

**Phone 844×390** (`max-height:500px`, the right column scrolls):

- The Battle mode grid becomes 3 × 2 compact tiles, 60 px tall: icon, the **short** name (Standard · Reverse · Rush · Ironclad · Half Income · Last Petal) and a ribbon dot in the top-right corner (filled = earned).
- The selected mode's card text is one line under the grid: **"Goblin Rush: Enemies move 30% faster and arrive 30% closer together."** The reward line follows it when it applies.
- The difficulty buttons keep their phone layout; the ribbon state replaces the "+60" badge as on PC.
- The Map rule panel is one line plus a 2-line clamp, with **"More"** to expand.
- The Start button stays pinned in `.ma-prep-actions`.

### 8.2 Campaign map and chapter banner (`src/ui/screens/campaign.js`)

- **Stage card** (`stageCard`, `campaign.js:141-181`): after the first clear, a chip **"Ribbons 3/20"** in `ma-sc-meta`; a rule chip in `ma-sc-badges`: icon + **"Lunar Eclipse"**, **icon only under the phone rule `@media (max-height: 500px)` and in portrait ≤ 700 px**, so an 844 × 390 phone shows icons only; stages without a rule show nothing.
- **Chapter banner:** next to the medal counts, **"Ribbons 12/100"**.

### 8.3 Battle HUD (`src/ui/battle/hud.js`, new `src/ui/battle/rulePill.js`, new `src/ui/battle/ruleWarnings.js`, `battle.css`)

- **Mode chip:** the stage label (`hud.js:25-30`) gets `span.bt-mode.bt-mode-<id>` after the difficulty chip, with the short name in caps ("RUSH", "IRONCLAD", "HALF INCOME", "LAST PETAL", "REVERSE") and the mode colour. Hidden for Standard. Like the stage label, hidden in portrait ≤ 700 px (`battle.css:504`); those players see the mode in the pause sheet.
- **Rule pill** `button.bt-rule[data-testid=rule-pill]`, in `.bt-hud-right` before the stage label:
  - PC: rule icon + **"Lunar Eclipse"** + **"ACTIVE · 4 s"** (gold background, soft glow) or **"Resting · 9 s"** (white). Always-on rules show icon + name.
  - Phone (`max-height:500px`): a 36 px round button like `bt-round`, with the rule icon and a conic progress ring (`--p` = share of the current phase elapsed); gold and pulsing when ACTIVE, blue-grey when resting.
  - Tap or click opens **`.bt-rule-pop`** (same component and placement as the scout popover, `battle.css:120`): name, desc, a state line ("Active for 4 more seconds" / "Next eclipse in 9 s" / "Always on" / between waves "Starts 14 s into each wave"), and the lines that apply:
    - "This wave: **Frost** +50%" (Shifting Stars);
    - "Wave 4 comes in through the **goal gate**" when `routeFlippedFor(4)` (Rear Ambush, in any mode);
    - "Pads: **2 of 3** taken" (Prism Conduits);
    - "Past the goal: no hearts or coin bonuses from the map rule." (freeplay and endless, `pastGoal`).
  - Updates from `sim.ruleInfo()` in `hud.update()`, only when `active` or `secondsToFlip` changes (at most once a second).
- **Which end a wave comes from.** "Goal gate" always means *the gate this battle's ordinary waves walk to* (in Reverse Route that is the map's spawn arch, which the terrain draws as the goal). A wave is **flipped** when `sim.routeFlippedFor(n)`: it enters at the goal gate and leaves at the start gate. Only Rear Ambush's even waves are flipped, in Standard and in Reverse Route alike, so the banner, scout, warning, popover and gate arrows are all correct on 4-2 Reverse Route (waves 2, 4, 6 …), where revision 1 got every one of them wrong.
- **Toasts and banners** (`controller.js` `handle`, `:413-476`; text from `RULE_TEXT`):

| Event | Shows |
|---|---|
| `ruleState {active: true}` | toast `info`, key `rule`: the rule's toast (table below). Only the first 2 times per battle; after that the pill pulses. |
| `ruleBonus {kind:'lives'}` | toast `good`: "Petal Sanctuary: +3 hearts" |
| `cash {reason:'rule'}` | toast `good`: "Supply Ship: +150 coins" / "Festival Encore: +120 coins" |
| `ruleBonus {kind:'ult'}` | toast `good`: "Festival Encore: ultimate recharged!" |
| `waveStart {flipped: true}` | banner sub **"REAR AMBUSH: in through the goal gate!"** (instead of "of 25"), kind `warn` |
| `waveStart` in Reverse Route | sub "of 25 · Reverse Route" on wave 1 only |
| `rift` | no toast; the renderer draws a star puff at both points |

| Rule | Toast on the ACTIVE flip |
|---|---|
| Firefly Chorus | "Firefly Chorus! Every girl +25% damage (6 s)" |
| Moonlit Blessing | "Moonlight! Holy +30% (9 s)" |
| Changing Tides | "High tide! Slimes slowed, Lightning +35% (7 s)" |
| Snowbell Blizzard | "Blizzard! Enemies 30% slower, range −15% (7 s)" |
| Heat Mirage | "Heat haze! Range −0.5 (6 s)" |
| Forge Vents | "The vents erupt! (5 s)" |
| Tailwind | "Tailwind! Enemies faster; Pierce, Slash, Blast +25% (6 s)" |
| Lunar Eclipse | "Lunar Eclipse! Holy +50%, spirits faster (6 s)" |

  Every rule also gets one `info` toast at the start of wave 1: "Map rule: **{name}**: {desc}" (5.2 s).
- **Warnings** (new `src/ui/battle/ruleWarnings.js` `ruleWarnings(sim, n)`, appended after `sim.waveWarnings(n)` in `controller.js warnFor` (`:398-410`) and `scout.js renderPopover` (`:92`); nothing in `report.js`):
  - `route` (warn), when `sim.routeFlippedFor(n)`: "Wave {n} comes in through the goal gate. Cover the far end too.";
  - `affinity` (info): "Shifting Stars: {Frost} hits +50% this wave.";
  - `mode` on wave 1: Ironclad "Ironclad: every enemy has +{a} armor (bosses +{b}). Armor Pierce and Armor Break pay off." with `capabilitySources(sim, ['armorPen','armorShred'])` (imported from `src/sim/report.js`, unchanged); Last Petal "Last Petal: one heart. Any leak ends the battle."
- **Scout strip** (`scout.js:56`): the label becomes **"NEXT 4 ⇄"** when `sim.routeFlippedFor(n)`, tooltip "Comes in through the goal gate". Shifting Stars adds an affinity chip at the end (element icon + "+50%").
- **Pause sheet** (`pauseMenu.js:45`): under the title, "Hard · Goblin Rush" plus the rule row (icon, name, desc). This is the only place portrait phones see the mode.
- **Results** (`results.js:186-188, 260`):
  - mode wins show the ribbon row **"Goblin Rush ribbon earned!"** or **"Goblin Rush · Hard cleared"** instead of the medal row;
  - when the Hard medal is still missing: a muted line **"Win in Standard for the Hard medal."**;
  - when `out.rewardDifficulty` is below the played difficulty, the drops header reads **"Drops (Normal)"**;
  - Standard wins are unchanged; Nightmare also shows "Last Petal ribbon earned!" when it is new;
  - **Retry** keeps the mode (route param).

### 8.4 Board decals and effects (render only; `src/render/ruleDecals.js` new, `terrain.js`, `ambient.js`, `BattleRenderer.js`, `attackFx`)

| What | Look |
|---|---|
| Crystal pads | Cyan disc r 0.9 with a slow rune ring and a small floating gem (instanced ground sprites in the ambient batch). **Free:** the ring pulses softly. **Taken:** the ring glows steadily and the gem orbits its girl. **Placement ghost** with its centre on a pad: free → the ring brightens and the hint reads **"+25% damage · +0.7 range"**; taken → **"Pad taken by Aoi"**. |
| Forge vents | An orange cracked ring r 1.6 on flat road. Resting: dim embers. ACTIVE: a bright glow plus an ember burst from `fx.js` at the flip and every 0.5 s. |
| Star rifts | Two purple swirl decals per path, at 40 % and 52 % of its length (`samplePath`), and a puff on each `rift` event. |
| Route direction | The terrain is built once with `buildTerrain(…, { reverse: mode.reverse })` (`terrain.js:579-591` swaps `entrances` and `exits`), so the arches always show this battle's usual start and goal. The ambient gate arrows and the flat-junction chevrons (`groundFeatures.js:103-123`) then follow **`ambient.setGatesReversed(sim.routeFlippedFor(next))`**, relative to that build: they only turn for flipped waves and never flip twice. "Next" is the running wave, or the coming one between waves, so players can prepare. The feed docking `avoid()` (`feed.js:22-33`) uses the current spawn gates. |
| Cycle pulse | `.bt-root[data-rule-on="<id>"]` adds a soft full-screen tint while ACTIVE (eclipse violet vignette, blizzard white haze, tide blue, firefly warm sparkle, tailwind streaks, moon silver, heat shimmer; CSS only, `pointer-events:none`, off with reduced motion). `ambient.setRulePulse(id, on)` doubles snow, petal or ember emitters while ACTIVE. |
| Range rings and attack FX | The selected girl's range ring and the attack-FX radii (drone leash, Hotaru, Yuki, Aoi, Shiro) ease to the new range over 0.3 s instead of jumping on a blizzard or heat-haze flip. |

None of this is in the co-op id.

### 8.5 Co-op room (`src/ui/screens/coop.js`)

- **Host picker** (`pickStage`, `coop.js:76-104`): below the difficulty segment and freeplay's segment, a **"Mode"** segment of 6 chips (icon + short name).
  - Chips are disabled until the host has cleared the selected stage, tooltip "Clear {stage id} once to unlock modes". Picking an uncleared stage resets the mode to Standard.
  - While Freeplay is on, the segment is disabled with the note **"Freeplay runs in Standard"**.
  - The modal's description line adds: "Modes change the battle for both of you. Ribbons are solo only."
- **Room card** (`coop.js:205, 420, 553`): `ol-chip-diff` + `ol-chip-mode` (for example "Normal" "Rush"). The mode chip is hidden for Standard. The guest sees the same chips, not editable; their Ready is consent, and a changed mode clears it.
- **Battlefield panel:** for 4-5, "Map rule: **Snowbell Blizzard**: blizzards (7 s in every 20) slow every enemy by 30% but cut girls' range by 15%."
- **Invite / clan message:** "Co-op room ABCD: 4-5 The Iron General (Normal · Goblin Rush). Join me!"

---

## 9. Balance: numbers and how they were measured

### 9.1 Method

- **The bot:** the measurement bot of `tests/integration/balance.test.js`: the free-to-play roster available before each stage, account level `EXPECTED_LEVEL` (ch1 1, ch2 8, ch3 14, ch4 20, ch5 25, ch6 30, ch7 35, ch8 40), the `autoPlan` placement and upgrade plan, seed 1, on the revision-2 bundle (`exp2/lib.mjs`, `exp2/bench2.mjs`).
- **How to read a cell:** `W88` = won with 88 % of hearts left; `L22` = lost on wave 22.
- **What the bot cannot show:** it places for coverage only. It does not adapt to a rear ambush, it does not seek pads, and it never retargets. Humans will feel Reverse Route and Rear Ambush more than the bot, and pads more.
- **Standard without a rule is today's game** (golden, §6.5).
- **What ships is mode + rule.** Every headline below is the combination; the rules-off mode matrix of revision 1 (`exp/res-modes-normal.jsonl`) is kept only as a diagnostic.

### 9.2 Modes as shipped (with the stage's rule), all difficulties, 40 campaign stages

`exp2/bench2.mjs combo`, 960 runs (`res-combo-{easy,normal,hard,nightmare}.jsonl`). Wins out of 40, mean hearts kept on wins:

| | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|
| Easy | **40/40** (96 %) | 39/40 (96 %) | 39/40 (93 %) | 39/40 (91 %) | 39/40 (91 %) | 16/40 |
| Normal | 39/40 (89 %) | 38/40 (91 %) | 38/40 (79 %) | 39/40 (73 %) | 37/40 (79 %) | 12/40 |
| Hard | 31/40 (69 %) | 30/40 (67 %) | 20/40 (58 %) | 21/40 (54 %) | 13/40 (60 %) | 3/40 |
| Nightmare | 0/40 | 0/40 | 0/40 | 0/40 | 0/40 | = Standard |
| *Normal, rules off (rev. 1, diagnostic)* | *39 (88 %)* | *38 (90 %)* | *37 (81 %)* | *39 (66 %)* | *36 (79 %)* | *10* |

**Normal, per stage (mode + rule):**

| Stage | Rule | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|---|
| 1-1 | — | W100 | W100 | W100 | W97 | W100 | W100 |
| 1-2 | — | W100 | W100 | W100 | W96 | W100 | W100 |
| 1-3 | — | W100 | W100 | W98 | W92 | W100 | W100 |
| 1-4 | petal_sanctuary | W100 | W100 | W100 | W100 | W100 | L1 |
| 1-5 | firefly_chorus | W75 | W75 | W72 | W70 | W75 | L18 |
| 2-1 | changing_tides | W100 | W100 | W97 | W92 | W92 | W100 |
| 2-2 | firefly_chorus | W100 | W99 | W72 | W83 | W90 | W100 |
| 2-3 | changing_tides | W100 | W99 | W88 | W76 | W100 | W100 |
| 2-4 | supply_ship | W96 | W97 | W79 | W62 | W90 | L1 |
| 2-5 | changing_tides | W100 | W100 | W85 | W85 | W95 | W100 |
| 3-1 | moonlit_blessing | W52 | W53 | W46 | W45 | W51 | L3 |
| 3-2 | moonlit_blessing | W50 | W66 | W22 | W29 | W30 | L2 |
| 3-3 | lunar_eclipse | W98 | W97 | W91 | W93 | W87 | L1 |
| 3-4 | moonlit_blessing | W53 | W57 | W16 | W44 | W10 | L1 |
| 3-5 | lunar_eclipse | W20 | L25 | W7 | W9 | L25 | L2 |
| 4-1 | snowbell_blizzard | W98 | W98 | W96 | W94 | W98 | L2 |
| 4-2 | rear_ambush | W99 | W96 | W76 | W87 | W91 | L2 |
| 4-3 | supply_ship | W100 | W100 | W98 | W96 | W98 | W100 |
| 4-4 | tailwind | W88 | W83 | L25 | W17 | L26 | L1 |
| 4-5 | snowbell_blizzard | W63 | W85 | W45 | W41 | W57 | L13 |
| 5-1 | alchemists_mist | W100 | W100 | W100 | W98 | W100 | W100 |
| 5-2 | changing_tides | W87 | W92 | W46 | W51 | W50 | L3 |
| 5-3 | firefly_chorus | W64 | W60 | W16 | W45 | W25 | L2 |
| 5-4 | alchemists_mist | W100 | W90 | W93 | W89 | W85 | W100 |
| 5-5 | lunar_eclipse | W89 | W89 | W80 | W76 | W67 | L14 |
| 6-1 | prism_conduits | W100 | W100 | W100 | W90 | W100 | W100 |
| 6-2 | heat_mirage | W96 | W96 | W93 | W84 | W70 | L3 |
| 6-3 | forge_vents | W95 | W96 | W92 | W82 | W90 | L1 |
| 6-4 | forge_vents | W98 | W100 | W93 | W82 | W93 | L1 |
| 6-5 | prism_conduits | W100 | W100 | W100 | W98 | W91 | W100 |
| 7-1 | festival_encore | W95 | W95 | W94 | W85 | W94 | L2 |
| 7-2 | rear_ambush | W97 | W97 | W95 | W86 | W97 | L3 |
| 7-3 | moonlit_blessing | W89 | W91 | W84 | W6 | W65 | L1 |
| 7-4 | lunar_eclipse | W83 | W78 | W73 | W58 | W65 | L3 |
| 7-5 | festival_encore | W94 | W96 | W94 | W82 | W52 | L1 |
| 8-1 | tailwind | W98 | W99 | W98 | W92 | W98 | L3 |
| 8-2 | snowbell_blizzard | W98 | W97 | W95 | W74 | W68 | L2 |
| 8-3 | heat_mirage | W97 | W96 | W94 | W83 | W77 | L2 |
| 8-4 | shifting_stars | W94 | W92 | W89 | W68 | W77 | L3 |
| 8-5 | tailwind | L30 | L30 | L30 | L30 | L30 | L1 |
| **wins** | | **39/40 (89 %)** | **38/40 (91 %)** | **38/40 (79 %)** | **39/40 (73 %)** | **37/40 (79 %)** | **12/40 (100 %)** |

**Hard, per stage (mode + rule):**

| Stage | Rule | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|---|
| 1-1 | — | W98 | W98 | W90 | W84 | W94 | L2 |
| 1-2 | — | W100 | W100 | W96 | W94 | W94 | W100 |
| 1-3 | — | W96 | W96 | W92 | W84 | W88 | L1 |
| 1-4 | petal_sanctuary | W100 | W100 | W68 | W80 | W100 | L1 |
| 1-5 | firefly_chorus | W32 | W36 | W30 | W22 | W26 | L1 |
| 2-1 | changing_tides | W68 | W92 | L13 | L12 | L13 | L3 |
| 2-2 | firefly_chorus | W20 | W2 | L17 | L11 | L13 | L2 |
| 2-3 | changing_tides | W68 | W6 | L15 | L15 | L19 | L2 |
| 2-4 | supply_ship | W16 | W26 | L18 | L17 | L18 | L1 |
| 2-5 | changing_tides | W70 | W88 | L22 | W50 | W18 | L8 |
| 3-1 | moonlit_blessing | L19 | L19 | L19 | L18 | L19 | L1 |
| 3-2 | moonlit_blessing | L17 | L20 | L15 | L15 | L13 | L1 |
| 3-3 | lunar_eclipse | W60 | W62 | L21 | L21 | L19 | L1 |
| 3-4 | moonlit_blessing | L19 | L19 | L16 | L13 | L11 | L1 |
| 3-5 | lunar_eclipse | L21 | L19 | L18 | L18 | L13 | L1 |
| 4-1 | snowbell_blizzard | W84 | W70 | L24 | L24 | W24 | L2 |
| 4-2 | rear_ambush | W30 | W16 | L20 | L21 | L15 | L2 |
| 4-3 | supply_ship | W94 | W94 | W58 | W82 | W70 | L3 |
| 4-4 | tailwind | L22 | L18 | L16 | L16 | L14 | L1 |
| 4-5 | snowbell_blizzard | L26 | L26 | L26 | L26 | L26 | L2 |
| 5-1 | alchemists_mist | W96 | W90 | W64 | W76 | W96 | L3 |
| 5-2 | changing_tides | L26 | L26 | L18 | L17 | L15 | L3 |
| 5-3 | firefly_chorus | L20 | L23 | L16 | L13 | L14 | L2 |
| 5-4 | alchemists_mist | W84 | W76 | W76 | W58 | W20 | L1 |
| 5-5 | lunar_eclipse | W56 | W56 | W36 | W28 | L22 | L14 |
| 6-1 | prism_conduits | W100 | W94 | W94 | W74 | L25 | W100 |
| 6-2 | heat_mirage | W76 | W74 | L23 | W18 | L23 | L1 |
| 6-3 | forge_vents | W80 | W82 | W60 | W58 | W44 | L1 |
| 6-4 | forge_vents | W76 | W90 | W52 | W42 | W28 | L1 |
| 6-5 | prism_conduits | W100 | W100 | W80 | W56 | L28 | W100 |
| 7-1 | festival_encore | W82 | W72 | W18 | W34 | L25 | L1 |
| 7-2 | rear_ambush | W92 | W92 | W90 | W68 | W84 | L3 |
| 7-3 | moonlit_blessing | W18 | L20 | L15 | L13 | L13 | L1 |
| 7-4 | lunar_eclipse | W38 | W38 | W32 | W6 | L29 | L1 |
| 7-5 | festival_encore | W6 | W6 | W2 | W34 | L30 | L1 |
| 8-1 | tailwind | W96 | W94 | W88 | W72 | L23 | L3 |
| 8-2 | snowbell_blizzard | W56 | W26 | L20 | L17 | L16 | L1 |
| 8-3 | heat_mirage | W68 | W72 | W20 | W10 | L19 | L1 |
| 8-4 | shifting_stars | W76 | W72 | W20 | L19 | L20 | L1 |
| 8-5 | tailwind | L30 | L30 | L21 | L21 | L19 | L1 |
| **wins** | | **31/40 (69 %)** | **30/40 (67 %)** | **20/40 (58 %)** | **21/40 (54 %)** | **13/40 (60 %)** | **3/40 (100 %)** |

**Easy:** every mode wins every stage except 8-5 (only Standard wins it, W99) and Last Petal (16/40). Lowest cells: 3-5 Reverse W43 / Half Income W41, 4-4 Half Income W56, 3-4 Half Income W66.

**Nightmare reachability:** the bot wins nothing at the expected level in any mode (1 heart, and it never adapts). Lowest winning level in Standard (`exp2/needx.mjs`): 1-2 **45**, 2-1 **66**, 4-3 **61**, 5-1 **61**, 6-5 **69**, 8-1 **> 80**. Nightmare medals and ribbons are end-game.

Reading it:
- **Normal** barely moves from revision 1: modes cost 0–2 stage wins; Ironclad costs 16 points of hearts with no lost stage; Last Petal is the "perfect run" mode (12 stages).
- **Hard** is where modes bite: Rush and Ironclad lose about a third of the stages Standard wins, Half Income almost 60 %. These are optional challenges for ribbons; they pay no more than Standard (§7.1), so being harder is the point.
- **Reverse Route is the exception:** a different puzzle rather than a harder one. It is easier than Standard on some stages (§9.6), which is why it earns no medals and pays at most your Standard reward difficulty.

### 9.3 Ironclad armor: by chapter and by difficulty

New damage per hit is about 0.3× the old game's (`combat.md:113-119`). Flat armor is subtracted from every hit (min 1), so the same +3 costs a chapter-1 girl far more than a chapter-6 one. The table is chosen per chapter as **the largest armor that adds no loss** over Standard in that chapter, at that difficulty, with the stage rule on.

**Easy and Normal: `armorByChapter = [–, 3, 3, 1, 3, 3, 6, 6, 6]`, bosses ×2.** Revision 1's sweep (`exp/res-armor-normal.jsonl`, Normal, rules off):

| Ch | Standard | +1 | +2 | +3 | +4 | +6 | +8 | +10 | +12 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5/5 (95 %) | 5/5 (94 %) | 5/5 (92 %) | **5/5 (87 %)** | 5/5 (64 %) | 1/5 (25 %) | | | |
| 2 | 5/5 (99 %) | 5/5 (96 %) | 5/5 (87 %) | **5/5 (69 %)** | 4/5 (41 %) | 0/5 | | | |
| 3 | 5/5 (56 %) | 5/5 (46 %) | 5/5 (23 %) | 3/5 (24 %) | 2/5 (31 %) | 1/5 (6 %) | | | |
| 4 | 5/5 (88 %) | 5/5 (87 %) | 5/5 (83 %) | **5/5 (68 %)** | 4/5 (65 %) | 2/5 (46 %) | | | |
| 5 | 5/5 (84 %) | 5/5 (83 %) | 5/5 (75 %) | **5/5 (61 %)** | 4/5 (67 %) | 3/5 (77 %) | | | |
| 6 | 5/5 (98 %) | 5/5 (97 %) | 5/5 (97 %) | 5/5 (95 %) | 5/5 (91 %) | **5/5 (85 %)** | 5/5 (77 %) | 5/5 (55 %) | 4/5 (41 %) |
| 7 | 5/5 (90 %) | 5/5 (89 %) | 5/5 (80 %) | 5/5 (76 %) | 5/5 (74 %) | **5/5 (56 %)** | 4/5 (61 %) | 4/5 (48 %) | 3/5 (65 %) |
| 8 | 4/5 (97 %) | 4/5 (96 %) | 4/5 (94 %) | 4/5 (91 %) | 4/5 (87 %) | **4/5 (81 %)** | 4/5 (54 %) | 3/5 (63 %) | 3/5 (57 %) |

- Revision 1 chose +2 for chapter 3. **With the rules on, +2 loses 3-5** (Lunar Eclipse already takes 3-5 Standard from W28 to W20), so chapter 3 drops to **+1** (`exp2`, Normal, rules on: 3-1 W45, 3-2 W29, 3-3 W93, 3-4 W44, 3-5 W9; +2 gives 3-5 L25). Chapter 3's spirits already halve Pierce and Slash.
- Checked as shipped (§9.2): Normal Ironclad **39/40 = Standard**, hearts 73 % against 89 %; per chapter it costs 4–29 points of hearts and no stage.
- Card text: "+3 armor (bosses +6)" in chapters 1, 2, 4, 5; "+1 (bosses +2)" in chapter 3; "+6 (bosses +12)" in chapters 6-8.

**Hard and Nightmare: `armorByDifficulty.hard = .nightmare = [–, 2, 2, 1, 2, 2, 4, 4, 4]`.** The Normal rule ("largest armor that adds no loss") does not work on Hard: Standard Hard already sits on a knife-edge in chapters 2–4, so even +1 loses stages there and the rule would give +0 (Ironclad = Standard). The Hard sweep (`exp2/res-armor-hard.jsonl`, rules on; − lists the stages Standard wins and that armor loses; chapter 7 was swept with revision 1's 7-2/7-3 placement):

| Ch | Standard | +1 | +2 | +3 | +4 | +6 |
|---|---|---|---|---|---|---|
| 1 | 5/5 (85 %) | 5/5 (81 %) | 5/5 (73 %) | 3/5 (64 %) −1-4,1-5 | 2/5 (26 %) −1-2,1-4,1-5 | 0/5 (- %) −1-2,1-1,1-3,1-4,1-5 |
| 2 | 5/5 (48 %) | 2/5 (43 %) −2-1,2-2,2-4 | 1/5 (50 %) −2-1,2-2,2-3,2-4 | 0/5 (- %) −2-1,2-2,2-3,2-5,2-4 | 0/5 (- %) −2-1,2-2,2-3,2-5,2-4 | 0/5 (- %) −2-1,2-2,2-3,2-5,2-4 |
| 3 | 1/5 (60 %) | 0/5 (- %) −3-3 | 0/5 (- %) −3-3 | 0/5 (- %) −3-3 | 0/5 (- %) −3-3 | 0/5 (- %) −3-3 |
| 4 | 3/5 (69 %) | 2/5 (62 %) −4-2 | 1/5 (82 %) −4-1,4-2 | 1/5 (54 %) −4-1,4-2 | 1/5 (10 %) −4-1,4-2 | 0/5 (- %) −4-1,4-3,4-2 |
| 5 | 3/5 (79 %) | 3/5 (77 %) | 3/5 (54 %) | 3/5 (44 %) | 3/5 (25 %) | 1/5 (8 %) −5-1,5-5 |
| 6 | 5/5 (86 %) | 5/5 (79 %) | 5/5 (75 %) | 5/5 (65 %) | 5/5 (50 %) | 3/5 (27 %) −6-2,6-1 |
| 7 | 5/5 (47 %) | 4/5 (64 %) −7-3 | 3/5 (61 %) −7-5,7-3 | 4/5 (48 %) −7-3 | 4/5 (38 %) −7-3 | 1/5 (70 %) −7-1,7-5,7-3,7-4 |
| 8 | 4/5 (74 %) | 4/5 (69 %) | 4/5 (49 %) | 3/5 (41 %) −8-2 | 2/5 (41 %) −8-4,8-2 | 1/5 (44 %) −8-4,8-2,8-3 |

The chosen Hard table is two-thirds of the Normal table (rounded, at least 1). That makes Ironclad cost what Goblin Rush costs at the same difficulty, chapter by chapter (§9.2, Hard, wins per chapter):

| Ch | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Total |
|---|---|---|---|---|---|---|---|---|---|
| Standard | 5 | 5 | 1 | 3 | 3 | 5 | 5 | 4 | 31 |
| Goblin Rush | 5 | 0 | 0 | 1 | 3 | 4 | 4 | 3 | 20 |
| **Ironclad (chosen)** | 5 | 1 | 0 | 1 | 3 | 5 | 4 | 2 | **21** |
| Ironclad with the Normal table (critic's run, revision 1) | | | | | | | | | 13 |

Card text on Hard and Nightmare: "+2 armor (bosses +4)" in chapters 1, 2, 4, 5; "+1 (bosses +2)" in chapter 3; "+4 (bosses +8)" in chapters 6-8.

### 9.4 Rules: off vs on (Standard), all three difficulties, every flip listed

`res-combo-*.jsonl` (Standard column) against revision 1's rules-off runs (`exp/res-rules-*.jsonl`, `rule: null`, bit-identical to live). **flip** marks a win/loss change.

| Stage | Rule | Easy off → on | Normal off → on | Hard off → on |
|---|---|---|---|---|
| 1-4 | petal_sanctuary | W100 → W100 | W99 → W100 | W92 → W100 |
| 1-5 | firefly_chorus | W83 → W83 | W75 → W75 | W32 → W32 |
| 2-1 | changing_tides | W100 → W100 | W100 → W100 | W58 → W68 |
| 2-2 | firefly_chorus | W100 → W100 | W100 → W100 | L18 → W20 **flip** |
| 2-3 | changing_tides | W100 → W100 | W98 → W100 | W74 → W68 |
| 2-4 | supply_ship | W99 → W99 | W96 → W96 | W20 → W16 |
| 2-5 | changing_tides | W100 → W100 | W100 → W100 | W64 → W70 |
| 3-1 | moonlit_blessing | W78 → W78 | W52 → W52 | L19 → L19 |
| 3-2 | moonlit_blessing | W79 → W79 | W50 → W50 | L17 → L17 |
| 3-3 | lunar_eclipse | W99 → W99 | W98 → W98 | W64 → W60 |
| 3-4 | moonlit_blessing | W91 → W91 | W53 → W53 | L19 → L19 |
| 3-5 | lunar_eclipse | W59 → W59 | W28 → W20 | L21 → L21 |
| 4-1 | snowbell_blizzard | W99 → W99 | W98 → W98 | W48 → W84 |
| 4-2 | rear_ambush | W97 → W100 | W95 → W99 | W44 → W30 |
| 4-3 | supply_ship | W100 → W100 | W100 → W100 | W88 → W94 |
| 4-4 | tailwind | W99 → W99 | W84 → W88 | L22 → L22 |
| 4-5 | snowbell_blizzard | W97 → W97 | W61 → W63 | L26 → L26 |
| 5-1 | alchemists_mist | W100 → W100 | W100 → W100 | W98 → W96 |
| 5-2 | changing_tides | W97 → W97 | W85 → W87 | L24 → L26 |
| 5-3 | firefly_chorus | W81 → W83 | W59 → W64 | L17 → L20 |
| 5-4 | alchemists_mist | W100 → W100 | W91 → W100 | W84 → W84 |
| 5-5 | lunar_eclipse | W100 → W100 | W87 → W89 | W56 → W56 |
| 6-1 | prism_conduits | W100 → W100 | W100 → W100 | W94 → W100 |
| 6-2 | heat_mirage | W98 → W97 | W97 → W96 | W78 → W76 |
| 6-3 | forge_vents | W98 → W98 | W95 → W95 | W78 → W80 |
| 6-4 | forge_vents | W100 → W100 | W98 → W98 | W74 → W76 |
| 6-5 | prism_conduits | W100 → W100 | W100 → W100 | W96 → W100 |
| 7-1 | festival_encore | W97 → W97 | W95 → W95 | W60 → W82 |
| 7-2 | rear_ambush | W98 → W98 | W97 → W97 | W92 → W92 |
| 7-3 | moonlit_blessing | W97 → W97 | W89 → W89 | W18 → W18 |
| 7-4 | lunar_eclipse | W92 → W92 | W83 → W83 | W38 → W38 |
| 7-5 | festival_encore | W99 → W99 | W88 → W94 | W2 → W6 |
| 8-1 | tailwind | W100 → W99 | W98 → W98 | W96 → W96 |
| 8-2 | snowbell_blizzard | W99 → W99 | W97 → W98 | W64 → W56 |
| 8-3 | heat_mirage | W100 → W99 | W98 → W97 | W68 → W68 |
| 8-4 | shifting_stars | W99 → W99 | W93 → W94 | W68 → W76 |
| 8-5 | tailwind | W99 → W99 | L30 → L30 | L30 → L30 |
easy ruled stages off 37/37 (96 %) on 37/37 (96 %)

- **Flips:** one, in the player's favour: 2-2 Hard L18 → W20. Revision 1's 7-3 Hard W18 → L20 is gone (§9.5).
- **Biggest moves:** Normal 3-5 Lunar Eclipse −8, 5-4 Alchemist's Mist +9; Hard 4-1 Snowbell Blizzard +36, 7-1 Festival Encore +22, 2-1 Changing Tides +10, 4-2 Rear Ambush −14, 8-2 Snowbell Blizzard −8.
- **Totals (37 ruled stages):** Easy 37 → 37 (96 → 96 %), Normal 36 → 36 (87 → 88 %), Hard 27 → 28 (65 → 66 %).
- **Tuning knobs (data only, each a co-op id bump):** the cycle lengths, every multiplier, `zoneDps`, `livesPerWave`, `bonusEvery.coins`, `portals.jump`, the placement table, and `pastGoal`.

### 9.5 7-3: why Rear Ambush moved

Revision 1 put Rear Ambush on 7-3. Its Hard total hid two flips that cancel out (2-2 L18 → W20, 7-3 W18 → L20): Rear Ambush made 7-3 Hard unwinnable for the bot at the expected level, and with it 7-3's Hard medal (60 gems) and its sweep unlock (`canSweep` needs the Hard medal). Reverse Route then won 7-3 Hard where Standard could not (the XOR brings half the waves in from each gate).

`exp2/bench2.mjs swap`, Standard, expected level (L35/L40), with Easy / Normal / Hard off (no rule) for reference:

| Placement | Easy | Normal | Hard |
|---|---|---|---|
| 7-3, no rule | W97 | W89 | W18 |
| 7-3 Rear Ambush (revision 1) | W97 | W93 | **L20** |
| 7-3 Firefly Chorus | W97 | W93 | W34 |
| 7-3 Lunar Eclipse | W97 | W89 | W18 |
| **7-3 Moonlit Blessing (chosen)** | **W97** | **W89** | **W18** |
| 7-3 Festival Encore | W97 | W92 | W56 (too generous) |
| 7-3 Snowbell Blizzard | W97 | W92 | W16 |
| 7-3 Tailwind | W97 | W92 | W2 |
| 7-3 Heat Mirage | W97 | W92 | L20 |
| **Rear Ambush on 7-2 (chosen)**; 7-2 off | W98 → **W98** | W97 → **W97** | W92 → **W92** |
| Rear Ambush on 7-1 / 7-4 / 7-5 | W97 / W92 / W99 | W96 / W88 / W89 | W56 / W38 / W2 |
| Rear Ambush on 8-1 / 8-3 | W100 / W99 | W99 / W96 | W96 / W74 |

- **7-3 → Moonlit Blessing:** exactly neutral on all three difficulties, and it fits a night procession. Lunar Eclipse was equally neutral but already sits on 7-4.
- **Rear Ambush → 7-2:** the bot's ordinary plan on 7-2 already covers both gates, so the rule costs it nothing on any difficulty. Humans who build only at the spawn will feel it more (§9.1), which is the point of the rule. Festival Encore keeps 7-1 and 7-5.
- 4-2 keeps Rear Ambush (Hard W44 → W30 in revision 1, still a win).

### 9.6 Reverse Route against Standard: the farm that the reward difficulty closes

Reverse Route is a different puzzle rather than a harder one: on two-road maps the roads meet differently when walked backwards. Measured as shipped:

| | Where Reverse is easier than Standard | Where it is harder |
|---|---|---|
| Hard, hearts (§9.2) | 2-1 W68 → **W92**, 2-5 W70 → **W88**, 6-4 W76 → **W90**, 2-4 W16 → W26 | 7-3 W18 → **L20**, 2-3 W68 → W6, 2-2 W20 → W2, 8-2 W56 → W26, 4-2 W30 → W16 |
| Normal, hearts | 4-5 W63 → **W85**, 3-2 W50 → W66, 5-2 W87 → W92 | 3-5 W20 → L25, 5-4 W100 → W90 |
| Hard, lowest winning level (`exp2/needrev.mjs`; critic's runs for 4-4, 4-5, 2-1) | **3-2: 40 → 27**; 4-4: 36 → 34; 2-1: 2 → 1 | 4-5: 33 → 37 |

**Why it matters without a cap.** 3-2's Hard drops add a 17 % chance of a super-rare book and a 12 % chance of a super-rare feather (entries gated `difficulty: 'hard'`) and ×1.25 drop coins (`DIFFICULTY_COIN_MUL`), and Hard wins count for `battleWinHard`. An account at level 27–39 cannot win 3-2 Hard in Standard but can in Reverse Route, so revision 1 (which paid mode wins like Standard wins) made Reverse the cheap road to Hard drops and missions there. Refusing the medal alone did not close it (critic).

**With the reward difficulty (§7.1)** that account's Hard Reverse win pays Normal drops and counts `battleWin` only; it still earns the Hard · Reverse **ribbon**. Once the account beats 3-2 Hard in Standard (level 40 for the bot), Hard Reverse pays Hard drops, which Hard Standard already does. No mode ever pays more than Standard already pays that player on that stage, in solo or co-op.

### 9.7 Ribbons a player can actually reach (sizing for Q1)

Ribbons the bot earns at the expected level (mode wins as shipped, `summ2.mjs ribbons`). In every case the bot also held that difficulty's Standard medal.

| Difficulty | Ribbons possible | Won at the expected level |
|---|---|---|
| Easy | 200 (5 modes × 40) | 172 |
| Normal | 200 | 164 |
| Hard | 200 | 87 |
| Nightmare | 160 (Last Petal is merged) | 0 (Nightmare needs level 45–80+) |

**Q1 proposal, if the owner wants gems:** 5 gems per ribbon on Normal, Hard and Nightmare, 0 on Easy, **paid only when you already hold that difficulty's Standard medal on that stage** (so a ribbon is always extra challenge, never a shortcut), with the `SAVE_VERSION` bump of §5.4.
- At the expected level that is (164 + 87) × 5 ≈ **1,255 gems** over the whole campaign, about 10 single pulls.
- The ceiling, for a player who earns every Normal, Hard and Nightmare ribbon, is 560 × 5 = **2,800 gems** (revision 1 said 3,000; the merged Nightmare Last Petal ribbon pays nothing extra).
- For scale: campaign medals pay 220 gems per stage, 8,800 in total (`missions.js:344`).

### 9.8 Past the goal: rule economy in endless runs

The solo endless run on a campaign map (Tactical Challenge) already exists in the live code (`options.endless`), so it is the closest measurable stand-in for "past the goal" until freeplay merges. `exp2/endless.mjs`, Normal, expected level, waves cleared before the run ended:

| Stage (rule) | Rule off | Rule on, economy stops at the goal (shipped) | Rule on, economy never stops (revision 1) |
|---|---|---|---|
| 1-4 (Petal Sanctuary) | 40 | 40 | 40 |
| 2-4 (Supply Ship) | 46 | 47 | 46 |
| 4-1 (Snowbell Blizzard) | 46 | 46 | 46 |
| 6-5 (Prism Conduits) | 76 | 76 | 76 |
| 7-1 (Festival Encore) | 61 | 64 | 63 |

- For the bot, rules move an endless run by 0 to +3 waves, and the economy parts by ±1. Its runs end in a sudden collapse, so +3 hearts a wave never gets time to matter.
- The cut-off still ships, because the case it protects is not the bot's: freeplay's boss leaks cost 35 hearts and were tuned so that "runs wind down over a few boss waves" (freeplay §8); +3 hearts after every wave would repay a boss leak in 12 waves, and endless and freeplay both pay per wave. The freeplay guard in §9.11 measures the real thing.

### 9.9 Crystal pads (one girl per pad) and Forge Vents

**Crystal pads, one girl per pad** (`exp2/pads2.mjs`, Hard). "Stack" is the critic's pad-seeking plan: the first placements are moved onto every free point inside the pads (11 girls fit on 6-1 and on 6-5; **3 of them get the bonus**, one per pad, where revision 1 gave it to all 10).

| Stage | L15: rule off, bot plan | L15: rule on, bot plan | L15: rule on, stacked | Lowest winning level: off / on (bot plan) | off / on (stacked) | Revision 1 (critic), on (stacked) |
|---|---|---|---|---|---|---|
| 6-1 | W88 | W92 (2 on pads) | W90 (3 on pads) | 2 / 1 | 8 / 2 | 1 |
| 6-5 | W66 | W72 (2 on pads) | W70 (3 on pads) | 6 / 6 | 13 / 11 | **1** |

- With the bot's own plan, the pads are worth about one level (6-1: 2 → 1; 6-5: 6 → 6) and a few hearts. That is the intended size: a reason to place a carry on a pad, not a way to skip the stage.
- Crowding girls onto pads is a bad plan without the rule (the stacked plan needs level 8 and 13); the rule repays part of that (2 and 11), never all of it. Revision 1 turned 6-5 into a level-1 stage.

**Forge Vents at the new 6-3 position** (`exp2/ventprobe.mjs`, expected level L30). Share = vent damage ÷ (vent + girls' damage):

| dps | 6-3 Normal | 6-3 Hard | 6-4 Normal (rev. 1) | 6-4 Hard (rev. 1) |
|---|---|---|---|---|
| off | W95 | W78 | W98 | W74 |
| 4 | W95 · 10.0 % | W78 · 9.8 % | 12.7 % | 11.9 % |
| **6 (kept)** | **W95 · 14.4 %** | **W80 · 13.8 %** | **17.9 %** | **17.5 %** |
| 8 | W95 · 17.7 % | W80 · 16.8 % | 22.2 % | 22.8 % |
| 10 | W95 · 20.1 % | W80 · 20.5 % | — | — |

- At 6 dps the vents do a seventh of the damage on 6-3 and a sixth on 6-4, without changing who wins. The dps scales with the wave's enemy HP, so the share holds on every difficulty.
- 6-4 is unchanged (flat road, one pass, between its two tunnels); only its wording was wrong ("double pass").

### 9.10 Cost

`exp/perf.mjs` (revision 1) measured CPU per fixed step, rule on against off, same stage, plan and seed (Hard, L40), best of 3: 6-3 vents 14.2 → 14.0 µs, 6-1 pads 16.7 → 15.8 µs, 3-3 eclipse 19.3 → 19.2 µs, 4-2 ambush 16.4 → 16.2 µs. **No measurable overhead.** Revision 2 adds `assignPads` (placement and sale only, 3 pads × towers) and `ruleWaveEnd` (once per wave).

### 9.11 Measurement plan for the build

1. **M1:** port `exp2/bench2.mjs` to `BALANCE=modes` and `BALANCE=rules` in `tests/integration/balance.test.js`, **with rules on** (the shipped combination). Assert the §10 thresholds at Normal and Hard. Write the tables with `BALANCE_OUT`.
2. **M1:** run the Easy gate with rules on (must stay 40/40). Run `BALANCE=full` before and after; paste both tables into the PR.
3. **M1:** `padneed` on 6-1 and 6-5 at Hard (one girl per pad): the best lowest winning level **with** the rule (bot plan or pad-seeking plan, whichever is lower) must be at most 3 levels below the bot plan **without** it (measured: 6-1 2 → 1, 6-5 6 → 6, §9.9).
4. **M6 (after the freeplay merge), the freeplay guard with rules on:** run freeplay's `bot.mjs` (strong team, mixed line-up; Blossom and Crimson Moon) on 1-4, 4-1, 6-5 (with a pad-seeking plan), 7-1 and 8-5, rule on vs `rule: null`. **Pass: every death wave within ±5 waves of the same stage with the rule off** (the freeplay calibration itself was measured on 1-3, 4-5, 6-5 and 8-5 without rules). If a rule moves a stage by more than 5 waves, set `pastGoal: 'off'` on that rule in `MAP_RULES` (a data switch the sim reads in `rebuildRuleTables`: past the goal the rule's tables become neutral) and re-run. Freeplay's own guard (`BALANCE=freeplay`, Blossom strong on 8-5 in 135–170) runs with 8-5's Tailwind on.
5. **After launch:** read ribbon counts per mode from shared co-op results or player reports (there is no telemetry). If a mode has almost no ribbons after two weeks, revisit its numbers in data.

---

## 10. Tests

| Level | File | What it asserts |
|---|---|---|
| **Data** | `tests/data/modes.test.js` (new) | `MODE_ORDER` lists exactly the 6 ids; `MODE_TEXT` has name, short, icon, colour, desc for each; `armorByChapter` and every `armorByDifficulty` table cover chapters 1-8 with whole numbers 0-8, and Hard/Nightmare ≤ Normal per chapter; `modeId('x') === 'standard'`; `RIBBON_MODES` has 5 entries; **no string values in `BATTLE_MODES` except `id`** (no display text). |
| **Data** | `tests/data/rules.test.js` (new) | Every `STAGE_RULES` key is a campaign stage; no rule on 1-1, 1-2, 1-3, bounty, boss or challenge stages; every campaign stage from 1-4 on has exactly one rule; all 15 `MAP_RULES` are used; every rule has a `RULE_TEXT` entry. Effect keys come only from the §5.2 vocabulary. Cycles satisfy `0 < active < period`, both whole multiples of 1/60 s. **No display text in `MAP_RULES`:** the only strings allowed are `id`, `pastGoal` and game ids inside the effect vocabulary (elements, attack types, families, armor classes, each checked against the game's id lists). **Geometry:** each vent centre lies within 0.6 of a road centreline and away from the board edge, and **no path sample inside a vent circle is elevated, under a deck or in a tunnel** (h); each pad passes `placement.check(aoi, x, y, [])`; pads are ≥ 5 tiles apart. |
| **Source check** | `tests/sim/rules.test.js` | No `Math.sin/cos/tan/pow/exp/log`, `**` or `rng` in `src/sim/rules.js`, `src/data/modes.js` or `src/data/rules.js`. |
| **Unit (sim)** | `tests/sim/rules.test.js` (new) | **Clock:** a 16/6 rule is resting for steps 0…599 of a wave and ACTIVE for 600…959, emits `ruleState` twice per cycle, restarts at the next wave start. **Calm point (d):** at every `waveEnd` on 4-1, 6-3 and 4-2: `_waveTick === 0`, `rule.active === !period`, `zoneDps === 0`, the tables deep-equal a freshly built sim's at the same wave; a fresh sim brought to the same wave by `restore`-style re-placement plus `setRouteOrientation(rr)` gives the same `hashSim` after one more wave. **Hit scale:** Holy ×1.5 only while the eclipse is ACTIVE; burn ×Fire, poison ×Poison; pads ×1.25 only for the pad's owner. **Pads (c):** at most one tower with `onPad` per pad, for any placement order; the owner is the lowest uid inside; selling the owner hands the pad to the next girl inside; a second girl on a taken pad gets nothing. **Range:** blizzard ×0.85, heat −0.5 with a floor of 1; **turret range follows both**; a trap's cached spots are recomputed. **Speed:** family, class and all multipliers. **Vents:** damage only inside r while ACTIVE, after this step's spawns; none to flyers, tunnel walkers, deck or under-deck walkers; no tower credit; scaled by `_waveHpMul`. **Portals:** once per wave spawn, never bosses or children. **Bonuses:** Supply Ship on waves 4, 8, 12, Festival Encore ult reset only when unlocked, Petal Sanctuary capped at max and off in Last Petal; **in endless past `stage.waves`: no hearts, no bonus coins, no ult reset, no Heat Mirage coin, while damage and speed effects continue; a rule with `pastGoal: 'off'` is fully neutral past the goal and unchanged before it**. **Affinity:** wave n → `[fire, frost, lightning, holy, mystic][(n-1) % 5]`. |
| **Unit (modes)** | `tests/sim/modes.test.js` (new) | **Rush:** `e.speed` ×1.3; `generateWave(…, {spacingMul: 0.7})` gives exactly 0.7× the gaps and the same composition. **Ironclad:** +a / +2a by tier from the difficulty's table; survives a boss phase `set.armor`; summons and splits get it. **Half Income:** bounty, wave bonus, income and interest ×0.5, start cash unchanged. **Last Petal:** `maxLives === 1`, one leak → `lost`. **Reverse Route:** spawns at the old exit, tunnels and decks mirrored, boss path index unchanged. **Rear Ambush:** waves 2, 4, … reversed; XOR with Reverse Route; **`routeFlippedFor(n)` is true for even waves in both Standard and Reverse Route (f)**; `waveInfo` before and after the swap gives identical spawns. `result().mode`. |
| **Golden** | `tests/sim/campaignGolden.test.js` (freeplay adds it: `wt-freeplay 1236555`) | Standard with `options.rule = null` keeps every campaign digest; digests with rules on are recorded once and guarded. |
| **Balance (opt-in)** | `tests/integration/balance.test.js` | **Easy gate with rules on** (40/40). **`BALANCE=modes` (a), rules on** (the shipped combination), wins out of 40: Normal Standard ≥ 38, Reverse ≥ 36, Rush ≥ 36, Ironclad ≥ 37, Half Income ≥ 35, Last Petal ≥ 10 (measured 39 / 38 / 38 / 39 / 37 / 12); Hard Standard ≥ 29, Reverse ≥ 28, Rush ≥ 17, Ironclad ≥ 18, Half Income ≥ 11, Last Petal ≥ 2 (measured 31 / 30 / 20 / 21 / 13 / 3); and at each difficulty **no mode wins more stages than Standard** (a mode that becomes easier than Standard fails the guard). `BALANCE=rules`: the per-stage table of §9.4, failing on any new win/loss flip on Easy or Normal. |
| **Systems** | `tests/systems/rewards.test.js` + `save.test.js` | A Rush win on Hard sets `modes['hard:rush']`, not `hard`; a Standard Nightmare win sets `nightmare` and `nightmare:laststand`; **a Reverse win on Hard with only the Normal medal rolls Normal drops, pays Normal drop coins, counts `battleWin` but not `battleWinHard`, and sets the Hard ribbon**; with the Hard medal it rolls Hard drops; mode wins give `clears+1` but no medal gems; co-op mode wins use each player's own reward difficulty; ribbon gems use the table (0); `migrateProfile` keeps valid ribbon keys and drops junk; `migrationDropsData` stays false; `parseBattleParams` forces Standard for endless, practice, bounty, locked stages and unknown ids. |
| **Co-op** | `tests/online/lockstep.test.js`, `coopSession.test.js` | Two clients with `start.mode = 'ironclad'` on 6-3 (vents) and `'reverse'` on 4-2 (ambush) give equal hashes for 10 waves. `room`, `hello`, `ready` and `start` carry `mode`; a changed mode clears the guest's Ready; a start without `mode` → Standard; the protocol bump refuses an older peer. **(i)** `setStage` to a stage the host has not cleared resets `mode` to Standard; `setStage` with `freeplay` set forces Standard. **(j)** a `start` carrying `rule`, `modeDef`, `ruleGoal` or `autoGeometry` builds the same sim as one without them; `start.freeplay` + `start.mode = 'rush'` builds a Standard sim. |
| **Engines** | `e2e/engines/scriptedBattle.js` + `e2e/engines.mjs` | The 15 `exp2/det.mjs` cases (every mode and every effect key, a pad sale, the heal path, endless past the goal; prototype digest `cccb8a5c`) in the scripted battles: V8 (Node, Chromium) = JSC (Bun, WebKit) = SpiderMonkey (Firefox). **(e)** once B3 lands: a relay girl on 4-2 Rear Ambush. |
| **Battle save** | `tests/battle-ui/snapshot.test.js` (battle-save M0) | Keys classified (§4); runs on 6-3 Ironclad + vents, 4-2 Rear Ambush (split after an even wave, so `rr` matters) and 6-1 with a pad sale, split at a wave start and continued, play to the same end digest; `rec.mode` round-trips. **(e)** after B3: the same on 4-2 with a relay girl placed before an even wave. |
| **Perf** | `tests/sim/perf.test.js` | A ruled stage costs no more than 1.1× the same stage with `rule: null`. |
| **e2e** | `e2e/modes.mjs` (new; Playwright at 844×390 and 1280×720) | **(1)** Fresh profile, 1-4 prep: "Clear this stage once…", Map rule "Petal Sanctuary". **(2) (g)** Grant the 1-4 Normal clear through `__sakura.store`, reload: six cards; pick Goblin Rush → Start reads "Start · Normal · Goblin Rush", the URL has `mode=rush`, the Hard button shows "Ribbon" (no "+60"), the First clear panel shows "Battle modes earn ribbons, not medals or medal gems.", the reward line reads "Drops as Normal: beat Hard in Standard here for Hard drops." with Hard selected; pick Last Petal → Lives shows 1. **(3)** In battle: `.bt-mode-rush` and a rule pill; on 3-3 the pill flips to ACTIVE once the page fast-forwards to 14 s; a tap opens `.bt-rule-pop`. **(4) (f)** 4-2 Standard: wave 2 banner has "REAR AMBUSH", the scout shows "⇄"; **4-2 Reverse Route: wave 1 banner has no "REAR AMBUSH", wave 2 has it, and the scout shows "⇄" only before even waves**. **(5)** Win with `window.__battle` fast-forward → "Goblin Rush ribbon earned!", "Win in Standard for the Hard medal." when applicable, then prep "Ribbon ✓" and the stage card "Ribbons 1/20". **(6)** Nightmare: the Last Petal card is disabled with the merge text. **(7)** Co-op two tabs: host picks Rush; guest chip "Rush"; a changed mode clears Ready; both HUDs `.bt-mode-rush`; turning Freeplay on disables the Mode segment and resets it to Standard. **(8)** Screenshots of prep (both sizes), the HUD with the pill ACTIVE and resting, the popover, the results ribbon, the co-op room, and **an attack-FX pair across a 4-1 blizzard flip with Chika and Hotaru on the field**, reviewed by eye. |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Rules change the campaign's balance (they are always on) | Measured as shipped (§9.2, §9.4) with every per-stage flip listed; the Easy gate holds; every number is data and a balance guard runs rules on. A placement can be swapped in `STAGE_RULES` alone. |
| Rules reach live before their UI | One branch, one release (§12): M0–M6 merge together. |
| Two forced co-op updates | The only co-op-id change ships in the same release as freeplay's protocol bump (or roster B3's). |
| A sim refactor breaks reversed paths | Mirror unit tests (§10); 4-2 / 3-5 (2 tunnels) / 6-4 (2 tunnels) in the engines check. |
| Restore or checkpoint diverges after a Rear Ambush wave | Canonical calm point + `rr` (§6.5); calm-point test (d) and battle-save split after an even wave. |
| Old cached tabs drop `modes` | Cosmetic in v1 (no currency, no progression). If Q1 turns gems on, `SAVE_VERSION` bumps in that release. |
| A mode becomes a cheaper road to drops | Reward difficulty (§7.1), tested in systems tests. |
| Players read "Ironclad +3" and expect it to matter late | Ironclad scales by chapter and difficulty (§9.3); the warning names counters from the formation. |
| HUD crowding on 844×390 | 36 px round pill; text only in the popover; 2-word mode chip; screenshots at both sizes gate M4. |
| Toast noise from cycle flips | Only the first 2 ACTIVE flips toast; the pill carries the rest. |
| Conflicts with in-flight branches | Freeplay: `Sim.spawnEnemy` / `_getWave` / `checkPhases` / `session.js`. Battle save: key tables, `rec.mode`, `snap.rr`. Roster B3: `towers.js recomputeBuffs/refreshEffective`, `Sim.js` constructor, the relay-sample line (§6.3). Merge order in §12. |
| Rift jumps hit a tunnel or deck boundary | `placeOnPath` handles any distance (knockback and blink use it). Tests on 8-4 and on a fixture map with a tunnel at 45-55 % of the path. |
| Typo fixes split co-op | Display text is outside the sim graph (§5); the data tests fail on any display text in `BATTLE_MODES` / `MAP_RULES` (only ids are allowed). |

---

## 12. Milestones

All work happens on **one branch, `feature/codex-modes`**. Each milestone is one logical commit (or a few) with vitest and build green and the `tools/simId.mjs` id printed in the commit message. **Ship gate: nothing from M0–M6 reaches the live branch until all of M0–M6 are done**; then it merges as one release. There is no partial landing and no feature flag (a flag in the sim graph would itself change `SIM_ID` when flipped, forcing a second update).

| # | Scope | Done when |
|---|---|---|
| **M0 Data** | `src/data/modes.js`, `src/data/rules.js` (numbers only, final tables), `src/ui/text/modes.js`, `src/ui/text/rules.js`, `stages.js` `rule:` line, 21 glyphs | `tests/data/modes|rules.test.js` green, geometry validated (decks, tunnels) |
| **M1 Sim** | `src/sim/rules.js` + the §6.2 patches | §10 sim unit tests green (calm point, pads, past-goal); golden unchanged; engines V8 = JSC = SpiderMonkey; Easy gate with rules on; `BALANCE=modes` with rules on |
| **M2 Systems** | `rewards.js` ribbons + `rewardDifficulty`, `coop/rewards.js` reward difficulty, `unlocks.js` helpers, `save.js` migrate line, `setup.js` `parseBattleParams`, router param | systems tests green |
| **M3 Prep + campaign UI** | Map rule panel, Battle mode panel, reward line, mode-aware difficulty buttons / facts / first clear panel, Start label, stage card chips, chapter banner, thumb markers | e2e steps 1-2, 6; screenshots at 844×390 and 1280×720 reviewed |
| **M4 Battle UI + render** | Mode chip, rule pill + popover, `ruleWarnings.js`, toasts, banners, scout ⇄ and affinity chip, pause sheet, results, decals (pad owner states), gate arrows from `routeFlippedFor`, cycle tint, eased range rings; attack-FX radius easing once attack FX has landed | e2e steps 3-5 (incl. 4-2 Reverse Route); screenshots reviewed (pill ACTIVE and resting, both sizes, reduced motion, the attack-FX blizzard pair) |
| **M5 Co-op** | `commands/session/version/lastRoom`, room picker and chips (Freeplay disables modes), invite text | lockstep and session tests incl. (i), (j); e2e step 7 |
| **M6 Merge with in-flight work** | Rebase onto freeplay (protocol number, speed merge, `generateFreeplayWave` untouched since freeplay is Standard-only, the §9.11 step-4 freeplay guard with rules on, `rr` in the M6 checkpoint list), battle-save key tables + `rec.mode` + `snap.rr`, roster B3 `towers.js` conflict + the relay-sample line | full suite, `BALANCE=modes`, the freeplay guard, `e2e/online.mjs`, `e2e/battle-save.mjs` |
| **M7 Docs + ship** | CONTRACTS §4 (StageDef `rule`), §5 (`progress.stages[].modes`, `rewardDifficulty`), §6 (Sim options `mode`, `ruleInfo`, `routeFlippedFor`, `setRouteOrientation`, events `ruleState`/`ruleBonus`/`rift`, `waveStart.reversed/flipped`, the calm-point contract), §10 (route `mode`), §13 (co-op `mode`); `docs/CAMPAIGN.md` rule table; `docs/OWNER_REQUESTS.md` row; `docs/merge/combat.md` §3.4 rows → ✅ | release notes say "both players update" |

**Landing order with the other branches:** coop-rematch (merged) → **freeplay** (its own branch, M1–M4) → **codex-modes rebased onto freeplay**; battle-save M0 classifies the new keys on the codex branch → **one release** carrying freeplay's and codex-modes' co-op-id change together → roster B3 rebases onto it (small `towers.js` conflict, the relay-sample line). If freeplay ships on its own first, codex-modes waits for the next forced bump (roster B3) rather than adding one, unless the owner prefers it sooner.

---

## 13. Owner questions (each has a default; none blocks the build)

1. **Should mode ribbons pay gems?** Default: **no** (cosmetic, counted on stage cards and chapter banners). Ready to switch on: **5 gems per ribbon on Normal and above**, paid only if you already hold that difficulty's Standard medal on the stage; about 1,255 gems over the campaign at the expected level, 2,800 at most (§9.7). Needs a save-version bump in that release.
2. **In your old build any mode win also gave the difficulty medal. Medals now pay 20–100 gems, and Reverse Route is easier than Standard on some Hard stages (3-2: level 27 instead of 40; 2-1, 2-5, 6-4 keep far more hearts), so we propose: medals and medal gems from Standard wins only; modes earn ribbons; and a mode win's drops never exceed your best Standard difficulty on that stage. OK?** Default: yes. Say "count any win" to get the old behaviour back (medals only; the drop rule stays).
3. **Should modes be open from the first visit, as in your old build, or only after one clear?** Default: **after one clear (any difficulty).** "First visit" also works, but then a mode win must count as the stage's clear (to unlock the next stage), which needs a new saved flag and a save-version bump (about one extra day).
4. **Co-op freeplay: modes off in v1, and past the goal the map rule keeps only its combat effects (no hearts or coin bonuses). OK?** Default: yes. Opening modes in freeplay later is a data and UI change, measured with freeplay's bot first.

---

## Appendix: prototype and evidence (scratch only; the repo was never written)

Revision 2: `/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/four-features/codex-modes/exp2/`. Revision 1: `…/exp/`. Critic runs: `…/critic-exp/`.

| File (exp2) | What |
|---|---|
| `overlay/src/data/modes.js`, `overlay/src/data/rules.js`, `overlay/src/sim/rules.js` | The proposed modules (the prototype still carries names in data and the experiment-only `options.modeDef`, `options.ruleGoal`, `autoGeometry()`; the build moves text to `src/ui/text/*` and drops the experiment options) |
| `make-overlay.mjs` | Every patch to `Sim.js`, `enemies.js`, `waves.js`, `towers.js` as asserted exact-once replacements against `9bede1e` |
| `build.mjs`, `entry.js`, `out/` | Vite bundle of the prototype |
| `lib.mjs`, `bench2.mjs` | The `balance.test.js` bot; jobs `combo`, `armor`, `swap`, `ruleoff` |
| `res-combo-{easy,normal,hard,nightmare}.jsonl` | §9.2, §9.4 (Standard column), §9.6, §9.7 |
| `res-armor-hard.jsonl` | §9.3 Hard sweep |
| `res-swap-*.jsonl` | §9.5 |
| `ventscan.mjs`, `ventprobe.mjs`, `log-vent63.txt` | §3.3, §9.9 |
| `pads2.mjs`, `log-pads2-hard.txt` | §9.9 |
| `endless.mjs`, `log-endless.txt` | §9.8 |
| `golden.mjs`, `det.mjs`, `det-node.txt`, `det-bun.txt` | §6.5 |
| `summ2.mjs`, `armsumm.mjs`, `tbl-*.md` | Build the §9 tables from the jsonl files |
| `needrev.mjs`, `log-needrev-hard.txt`; `needx.mjs`, `log-needx.txt` | §9.6 lowest winning level, Standard vs Reverse; §9.2 Nightmare reachability |
| `fixch3.sh`, `log-fixch3-*.txt` | Chapter-3 Ironclad re-runs after the table change (§9.3) |

---

## Critic resolution

Every issue in `CRITIC.md`, what changed and where. "Fixed" means the spec and the revision-2 prototype (`exp2/`) both changed; numbers were re-measured on `exp2`.

| # | Issue (severity) | Outcome | What changed / why |
|---|---|---|---|
| 1 | Milestone order ships invisible rules and two forced co-op updates (High) | **Fixed** | §12: one branch, ship gate "nothing from M0–M6 reaches live until all of it is done", one release, one co-op-id bump shared with freeplay (or roster B3). No feature flag: a flag inside the sim graph changes `SIM_ID` again when flipped. Landing order rewritten. |
| 2 | Freeplay inherits rules and Reverse Route that lengthen runs; long runs pay gems (High) | **Fixed**, one sub-point rejected | (a) Economy and healing rule effects (`livesPerWave`, `bonusEvery`, `bountyAdd`) stop past the goal, in freeplay and in solo endless (§0.6, §6.2 `_ruleGoal`; measured §9.8). (b) Co-op freeplay runs in Standard in v1 (Q4): no Reverse Route, Rush or Ironclad past the goal, so records and milestones can't be farmed by a mode. (c) §9.11 step 4 adds the freeplay guard with rules on: 1-4, 4-1, 6-5 with a pad-seeking plan, 7-1, 8-5; pass = within ±5 waves of rule off; a per-rule `pastGoal: 'off'` data switch if not. **Rejected:** counting rule slows against Resolve. Resolve stops a wave being pinned for ever; a rule slow is at most −35 % in a phase and −15 % averaged over its cycle, so it cannot pin anything, and the guard in (c) catches any calibration shift with a data switch instead of new sim coupling. |
| 3 | Crystal pads hold about 10 girls (Medium-High) | **Fixed** | One girl per pad: the lowest-uid girl standing on it (derived, so battle-save re-placement gives the same owners; a sale hands the pad on). Copy and ghost hint changed (§3.1, §8.4). Re-measured with the critic's stacking plan (§9.9): 3 girls get the bonus; 6-5 Hard needs level 11 stacked (revision 1: 1). Data/unit test (c) added. Chose ownership over shrinking r to 0.45: two girls' centres (footprint r 0.42, so at least 0.84 apart) still fit inside a 0.9-wide pad, and a smaller decal is hard to see on a phone. |
| 4 | Mode + rule never measured together; Hard never measured for modes (Medium-High) | **Fixed** | §9.2 is now the shipped combination on Easy, Normal, Hard and Nightmare; rules-off is a diagnostic only. §10 thresholds come from it and the guard runs rules on. Ironclad got a Hard/Nightmare table (§9.3). Q1 is sized from reachable ribbons (§9.7). |
| 5 | Reverse Route is a cheaper road to Hard drops and missions (Medium) | **Fixed** (stricter than proposed) | §7.1 reward difficulty = min(selected, best Standard medal on the stage), also per player in co-op; `battleWinHard` only at a Hard+ reward difficulty; numbers in §9.6. The critic's "best medal + 1" would still leave the farm one tier up (an account holding only 3-2's Normal medal would get Hard drops from Reverse at level 27–39), so the cap is the medal itself. |
| 6 | The "calm point" claim was false (Medium) | **Fixed** | `ruleWaveEnd` canonicalizes at wave end (clock 0, resting, vent dps 0, tables rebuilt, `_buffsDirty`); the route orientation is carried as `rr` in battle-save snapshots and freeplay's M6 checkpoints (§6.5); test (d). |
| 7 | Roster B3 relay samples cache one route orientation (Medium) | **Fixed** | §6.3: geometry caches come from `_pathsFwd` (B3's `relaySamples` line changes; `setRouteOrientation` also clears `_relaySamples`); battle-save and engines tests (e) with a relay girl on 4-2. |
| 8 | Route signals wrong under Reverse Route × Rear Ambush (Medium) | **Fixed** | `routeFlippedFor(n)` drives the banner, scout ⇄, warning, popover and gate arrows (arrows relative to the terrain build, never double-flipped); `waveStart.flipped`; e2e step 4 on 4-2 Reverse Route. One copy suffices because "goal gate" is defined as the gate this battle's ordinary waves walk to (§8.3), which is correct in both modes. |
| 9 | Prep still promises medal gems and shows wrong lives under a mode (Medium) | **Fixed** | §8.1: ribbon state on the difficulty buttons, the First clear note, Lives 1 and the summary line under Last Petal, the reward line; results "Win in Standard for the Hard medal."; e2e step 2 (g). |
| 10 | Departures from the old build not flagged (Medium) | **Fixed**; proposed default rejected | §1.1 "Differences from your old build" (seven rows); Q2 reworded as proposed; the unlock gate is Q3. **Default kept at "after one clear"** rather than the critic's "open from the first visit, ribbons after a Standard clear": in this game a clear *is* a medal (`isStageCleared`), so a mode win on an uncleared stage would either pay nothing (a win with no progress, no ribbon and no drops under the reward-difficulty rule) or need a new saved clear flag plus a `SAVE_VERSION` bump to protect it from old tabs. Q3 offers the old behaviour with that cost. |
| 11 | Ironclad boss armor in freeplay recreates the wall (Medium) | **Fixed by Q4's default**; measurement not applicable | Modes are off in freeplay in v1. If the owner opens them, Ironclad past the goal follows freeplay's `bossMul` (bosses +0), written into §4 now. The Iron Colossus appears on no campaign stage (only Total Assault `boss-colossus` and the Colosseum, both Standard-only), so there is no campaign Ironclad case to measure; Hard Ironclad on every campaign boss is in §9.2. |
| 12 | 6-3 vent on an overpass; 6-4 not a double pass (Medium) | **Fixed** | 6-3 vent moved to flat ground at (5.5, 4.25) (`ventscan.mjs`), dps re-measured (§9.9, kept 6); data test (h): no elevated, deck, under-deck or tunnel sample inside any vent; `ruleStep` also skips `e.elev > 0` and `e.underDeck`; 6-4 wording corrected. |
| 13 | Hard flips hidden by totals; Rear Ambush blocks 7-3's Hard medal and sweep (Medium) | **Fixed** | Rear Ambush moved to 7-2 (neutral for the bot on every difficulty), Moonlit Blessing on 7-3 (neutral); every per-stage flip is listed in §0 and §9.4. |
| 14 | Attack-FX radii jump on blizzard and heat-haze flips (Low) | **Fixed** | §4 and §8.4: eased display radius (0.3 s) in attackFx and range rings, in M4 once attack FX lands; screenshot pair across a 4-1 blizzard flip (e2e step 8). |
| 15 | Display text inside the co-op id (Low) | **Fixed** | `src/data/modes.js` and `rules.js` hold numbers and ids only; text in `src/ui/text/modes.js` / `rules.js`; warnings built in `src/ui/battle/ruleWarnings.js` (`report.js` no longer changes); data tests fail on any display text (only ids are allowed). |
| 16 | Smaller correctness notes (Low) | **Fixed** (all seven) | Drones follow both `rangeMul` and `rangeAdd` (prototype patched); `ruleStep` runs after `grid.rebuild`; co-op `setStage` resets a locked mode (and forces Standard with Freeplay); Rush in deep freeplay is moot in v1 and noted in §4 for later; rule chip icon-only under `max-height: 500px`; ribbon gems (Q1) tied to a `SAVE_VERSION` bump; `createCoopSim` reads only `modeId(start.mode)` (test j). |
| 17 | Missing tests (a)–(j) (Low) | **Fixed** | All ten are in §10, labelled (a)–(j). |
| — | Owner questions to add or reword | **Done** | Q1 sized from reachable ribbons; Q2 reworded; Q3 (unlock gate) added; Q4 (freeplay) merges the critic's "rules in freeplay" question with modes in freeplay. Revision 1's Q3 ("rules always on") is dropped: the old build had them always on, so it is a port, not a question. |

**What did not change** (the critic checked these and found them sound): the golden check (re-run on `exp2`: 20/20), the rule math and determinism approach, the data geometry for pads, the Normal aggregates, freeplay's additive `armorBonus`, B3's `e.grounded` flag, the co-op hero and wallets, and the additive `modes` save field.

---

## Build notes (feature/codex-modes, 2026-10-14)

Built M0–M5 on `feature/codex-modes` (base `feature/train-c-base` = co-op freeplay + specs); M6: nothing new had
landed on `feature/coop-freeplay` since that base, so the merge is a no-op. The prototype (`exp2/`) was not available
in the build container, so everything was written from this spec and re-measured.

**Measured on the build** (balance bot, expected level, seed 1; `BALANCE=modes`, `BALANCE=rules`, `BALANCE=fpguard`):

| Wins / 40 (hearts) | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|
| Easy | 40 (96 %) | 39 (95 %) | 39 (93 %) | 39 (91 %) | 39 (91 %) | 16 |
| Normal | 39 (89 %) | 38 (91 %) | 38 (80 %) | 39 (73 %) | 37 (79 %) | 12 |
| Hard | 31 (69 %) | 29 (70 %) | 21 (54 %) | 22 (53 %) | 13 (60 %) | 3 |

- Normal is exactly the spec's table; Hard differs by one stage in Reverse (29 vs 30), Rush (21 vs 20) and Ironclad
  (22 vs 21). Every §10 threshold holds and no mode beats Standard.
- Rules off → on (Standard): one flip, 2-2 Hard L18 → W20 (as §9.4). Easy gate 40/40 with rules on.
- Golden: Standard with `rule: null` is bit-identical to the pre-modes sim on 20 battles (`tests/sim/modesGolden.test.js`).
- Engines: 15 `MODES_*` battles (1,532 hash checkpoints), V8 (Node 22, Chromium 141) = JSC (Bun 1.4.2). Firefox
  and WebKit are not installed in the build container.
- Freeplay guard (§9.11 step 4, Blossom, level-60 eight-girl team + Hikari, `autoPlan` then upgrades): death waves
  rule off / on — 1-4 60/60, 4-1 100/100, 6-5 89/89, 7-1 70/70, 8-5 30/30 (all Δ 0). This bot is weaker than
  freeplay's calibration team (it falls at 8-5's goal), so the guard should be re-run with freeplay's own bot in the
  train C combined pass.

**Deviations from the spec**
- `modeArmor` lives in `src/data/modes.js` (re-exported by `src/sim/rules.js`) so the UI can print Ironclad's numbers
  without importing the sim; `MODE_RIBBON_GEMS` lives in `src/systems/rewards.js` (a reward number, not display text).
- Vents burn through `sim._dot` with no source: rule multipliers scale girls' hits and DoTs only (a DoT counts as a
  girl's when it has a `sourceUid`), never the vents' own burn. Vents scan `sim.enemies` with squared distances
  (same result as a grid query, deterministic order).
- `assignPads` runs after the new girl is pushed (and after a sale); the owner rule is the spec's.
- Rule-only tower fields (`envRangeMul`, `envRangeAdd`, `padIndex`, `onPad`, `padMul`, `padRangeAdd`) and enemy
  `rifted` are created only in ruled battles, so Standard-without-a-rule state and digests are untouched.
- Drone range: this branch has no Chika leash yet, so anchored-turret range follows the codex formula
  (`max(1, (range + add) × mul) × buff`); the LANDING_PLAN S4 rule for roaming drones applies when rebasing onto Chika.
- `COOP_PROTOCOL` is 4 here (train C's single bump); whichever train C merge lands first sets it, nobody bumps twice.
- e2e is `e2e/codex-modes.mjs` (+ `e2e/codex-modes-coop.mjs` for step 7) rather than `e2e/modes.mjs`.
- The cycle "pulse" is the CSS tint on the battle root (`data-rule-on`); `ambient.setRulePulse` (doubling the
  weather emitters while ACTIVE) is not built.
- Attack-FX radius easing waits for attack FX to land (not on this branch); the selected girl's range ring eases.

**Battle save (not on this branch) — classification it needs when it lands** (§4): record `mode` (`modeId(r.mode)`),
`view.mode`, `snap.rr` (= `sim.routeReversed`, restored with `sim.setRouteOrientation(rr)` after the constructor);
`KNOWN_SIM_KEYS`: `mode`, `incomeMul`, `_modeArmor`, `_ruleGoal`, `_bountyAdd`, `_pathsFwd`, `_pathsRev`, `rule` →
config; `routeReversed` → carried (`rr`); `_ruleMul`, `_ruleMove`, `_ruleRange`, `_rulePortal` → derived; `_waveTick`
→ calm; `KNOWN_TOWER_KEYS`: `padIndex`, `onPad`, `padMul`, `padRangeAdd`, `envRangeMul`, `envRangeAdd` → derived;
enemy `rifted` → calm (enemies are not carried). There is no `_ruleScratch` in the build. Freeplay checkpoints:
`REBUILT` += `mode`, `_pathsFwd`, `_pathsRev`, and `AFTER_RESTORE` re-applies the live orientation (built; tested on
4-2 freeplay after an even wave, 6-1 after a pad-owner sale, 6-3 Ironclad mid-vent).
