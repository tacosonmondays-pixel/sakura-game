# Combat, battle UX and enemies — old Alpha 1.3.1 vs the new sim (merge report)

Area: combat mechanics, battle UX, enemies. Read-only analysis of
`scratchpad/oldgame` (old, minified ES modules) and `/home/user/sakura-game` (new). Old code was
pretty-printed into `scratchpad/merge/pretty/*.js` for reading; **"pretty L…" line refs point
there**, "orig L…" to the minified original. New-game refs are real `file:line` in the repo (as of
2026-10-07; note another session is editing `src/sim/path.js`, `Sim.js`, `headless.js`,
`maps.js` for *tracks-v3* right now, so line numbers in those files may drift).

---

## 0. TL;DR for the lead

1. **Keep the new sim as the engine.** It is deterministic (seeded, fixed 1/60 step), data-driven
   (ModSets, StatusSpecs, traits, boss phases), has a richer damage pipeline, BTD6 3×5 crosspath
   upgrades, free placement, HP/barrier bars, scouting warnings and defeat debriefs. The old engine
   is a 600-line mutable `Game` class with per-map `if (mapId === …)` rules; port **ideas and
   numbers**, never code.
2. **Keep the new Blender enemies (74 defs, 12 GLB families) as the visual base.** The old enemies
   are primitive sphere/box builds that reuse one humanoid body for orc/goblin/ghoul/oni (see
   `shots/old-lineup-a.png`, `shots/old-lineup-b.png` vs `shots/new/new-enemy-sheet.png`). Port
   ~9 old enemy *ideas* as new defs on existing GLB variants (5 slime mimics, Violet Goblin,
   Gearpatch Goblin, Elder Rootkeeper miniboss, Boneguard), plus 3 small trait features (repair,
   charge wind-up, summon/decoy limits).
3. **The roster swap is the real combat work.** 19 of the 32 old girls already have a matching new
   behaviour, but the 13 old-only girls include 7 whose identity needs sim features the new engine
   lacks: **aim points + delayed mortar shells (Tsubaki, Seiran ult, Suzu, Iroha)**, **attack from a
   relay point (Ruri familiar, Iroha mirror)**, **grounding of flyers (Hana, Fuu, Seiran)**,
   **gather/pull (Fuu)**, **curse spread on death (Ena)**, and **3 new ult shapes (Kanna strike,
   Seiran aimed nova, Luna/Amane team damage buff)**. All are small, additive sim changes (section 4).
4. **Biggest old features missing from the new game (all asked for by the owner):**
   battle modes ×6 per difficulty (req 13 "difficulty modifiers"), per-map rules/gimmicks with an
   ACTIVE/resting rhythm (req 6, 14), a Sandbox (req 7, roadmap "tactical lab"), the hero ult
   cut-in (req 6 "cool cutscene animation attack"), tap-an-enemy inspect, ENTRY/EXIT labels (req 37).
5. **Do not adopt** the old right-hand squad panel (eats ~25 % of a phone screen), the blocking scout
   modal, kill-count hero levelling, the 3×3 branch system, or old raw numbers (different scale —
   conversion in §2.3).

---

## 1. What I did (evidence)

* Read every file listed in the brief (old: engine, combat-expansion, battle-modes, battle-session,
  battle-props, combat-ui, deployment-input, enemies, expansion-enemies, enemy-ecology,
  enemy-skills, enemy-expansion-models, enemy-viewer, campaign-intel, route-markers, items, data,
  campaign, expansion-roster, battle parts of app.js; new: all of `src/sim/**`, `src/data/{types,
  enemies,stages,units}.js`, `src/ui/battle/{controller,scout,feed,rules,setup}.js`, renderer
  event handling in `src/render/BattleRenderer.js` and `actors.js`, CONTRACTS §2–§12,
  docs/BESTIARY.md, docs/PLACEMENT.md, docs/OWNER_REQUESTS.md).
* Data dumps via node: old roster (32 units), old enemies (80), old maps (37); new units (19),
  enemies (74), stages (40 campaign + 15 bounty + 3 assault + challenge). Scripts in
  `scratchpad/merge/tools/dump-*.mjs`.
* **Old battle actually played**: the static mirror has no backend, so
  `tools/oldbattle.mjs` / `oldsandbox.mjs` / `oldstage.mjs` mock `/api/collection` and `/api/run`
  with the old game's *own* shared server logic (`gacha.js newCollection/publicCollection`) via
  Playwright `page.route`, and deploy girls through the old app's WebMCP tool
  (`document.modelContext.registerTool('deploy_defenders')`, old app.js orig L309) by polyfilling
  `document.modelContext`. Nothing was written to the server copy.
* **New battle played** with `tools/newbattle.mjs`/`newbattle2.mjs` (Vite dev server with
  `cacheDir` in scratch, grants the formation in `window.__sakura.store`, `autoPlan` placements,
  fast-forwards waves inside the sim, then screenshots live).
* Screenshots (all looked at), under `scratchpad/merge/shots/`:

| file | shows |
|---|---|
| `oldgrave/old-battle-placed.png`, `old-battle-midwave1/3.png` | old battle HUD on Velvetmoon Cemetery (figure-8), map-rule pill "Lunar eclipse · ACTIVE", ENTRY/EXIT labels, right squad panel, ult button + Q, enemies-left counter |
| `oldgrave/old-wave-scout.png` | old scout = blocking modal |
| `oldgrave/old-stage-grave-0/1/2.png` | old stage detail: rule card, layout card, field briefing w/ named counters, 3 difficulties, **6 battle modes** with medals |
| `oldgrave/old-mapselect.png` | old map gallery w/ per-difficulty medals |
| `oldsb/sb-hero-detail.png`, `sb-sandbox-modal.png`, `sb-mixed-far/zoom.png`, `sb-ult.png` | old sandbox (999,999 coins, ∞ waves), spawn controls, hero detail panel, **HERO SIGNATURE ult cut-in** |
| `phone/sb-mixed-far.png` vs `phone/ph34-midwave.png` | 844×390: old board ≈ 45 % of the screen; new board ≈ 80 % |
| `old-lineup-a.png`, `old-lineup-b.png`, `old-enemy-thumbs.png` | 56 old enemies rendered with the old `makeEnemy` (harness page served through `page.route`) |
| `new/new-enemy-sheet.png`, `new/new-enemy-lineup2.png` | all 74 new GLB enemies; ghosts/ghouls/oni close-up |
| `new/nb64-*.png` (6-4), `new/nb73-*.png` (7-3), `phone/ph34-*.png` (3-4) | new HUD, scout strip + popover, tower panel (3×5 paths), hero widget, damage numbers, oni field ring |
| `new/new-stageprep-5-4.png` | new stage prep: 4 difficulties, recommended counters, no modes |

Readability verdict from the screenshots: the new battle is far more readable (HP/barrier bars,
tier stars, status icons, field rings, damage numbers coloured by effectiveness, toasts for new
enemies). Its weak spots: enemies are small at 1280×720 on 20×12 maps, damage numbers get noisy
when 6+ girls fire (nb73-midwave), the type chart (armor class) is invisible in battle, and there
is no way to inspect an enemy you see on the field. The old battle's strengths are *rules and
rhythm*: the map-rule pill with ACTIVE/resting, modes, the cut-in, sandbox.

---

## 2. The two combat models side by side

### 2.1 Pipeline

| | OLD (`engine.js`, `combat-expansion.js`) | NEW (`src/sim/*`) |
|---|---|---|
| Loop | `Game.update(dt)` variable dt ≤ 0.1 × speed (pretty L431); `VerifiedGame` re-steps at fixed 0.05 s and logs commands for server proof (`battle-session.js` orig L8) | `Sim.update(dt)` fixed 1/60 steps (`Sim.js:133-147`), seeded `rng`, deterministic waves per stage+wave (`waves.js:234`) |
| Damage model | 7 elements (physical/fire/frost/lightning/poison/holy/arcane) × 6 enemy traits (`TRAITS`, data.js pretty L403) + per-enemy `resists`; flat armor per hit; "ignore" flag skips armor (sniper/moonhero) | 5 attack types × 5 armor classes (`types.js:25-31`) + 5 elements carried as statuses + elemental ward ×0.5 (`combat.js:72-116`) |
| Hit order | detect → shield-raid → weakness × environment × fieldShield → `modifyHit` (phase, holy seal, ward ×0.4, mark, crystal chip, barrier w/ multipliers, armor − pierce×2) (pretty L404, L141) | eligibility → type → ward → soak → mark/vulnerable → crit → guardian → shield field → barrier (blast ×1.5) → crystal cap → armor − pen − shred (min 1) (`combat.js:1-5`) |
| Upgrades | 3 branches × 3 tiers, "master one to 3 + one tier in a second" (`branchLock`, pretty L132); cost = unitCost × (0.75 + 0.6·tier) | 3 paths × 5 tiers, BTD6 crosspath (`mods.js:249-257`), costs 80 → 16 000 |
| Branch effects | ~35 effect keys read via `branchPower(t,key)` sprinkled through the code (`applyBranchStats` pretty L6, `applyEffects` L199, `shoot` L241) | ModSet keys only (`CONTRACTS.md:164-186`, `mods.js:117-174`) |
| Hero | free (cost 0), auto-selected for placement at battle start; level = ⌊kills/40⌋ max 9: dmg ×1.10ⁿ, range +0.1n, rate ×0.97ⁿ (`unitStats` pretty L85); ult usable immediately, CD 58-72 s | cost 450-650; XP from damage + wave clears, Lv1-10 with milestone ModSets; ult unlocks at Lv3 with 50 % charge (`hero.js:36-43`, `constants.js:74`) |
| Ults | 7 bespoke (`HERO_SKILLS` data.js pretty L737, `EXPANSION_SKILLS` expansion-roster pretty L253, `Game.useAbility` L375, `expansionAbility` combat-expansion L485) | 3 data types: `nova`, `timeWarp`, `tide` (`hero.js:143-181`) |
| Targeting | first/priority/strong/last/close; falcon & stormhero sort airborne first (`sorted` pretty L272) | first/last/strong/close/elite (`towers.js:235-251`; elite = casters → bosses → elites) |
| Placement | continuous x,z in ±12.5×±8; 1.35 from path, 1.5 between girls, max 35 girls; `water` units are land **+** water | continuous, footprints r 0.42/0.5, 0.55 path band (`docs/PLACEMENT.md`); `land`/`water`/`amphibious`; Sango/Umeko/Nami are **water-only** today |
| Waves | 20 waves; 9+3w enemies from a 5-slot list by wave thresholds, crossover on 9, miniboss on 10, boss on last, reinforcement every 7th (`makeWave` pretty L140) | budget × growth^w with weighted pools, `from/to`, fixed scripted groups, bosses on the longest path (`waves.js:234-342`), 12-30 waves |
| Analysis | wave hint text + encounter toasts | `waveWarnings` (counter-aware) + `debrief` (leaks by enemy/wave/trait) (`report.js:131,184`) |
| Modifiers | 6 battle modes (`BATTLE_MODES`, battle-modes orig L1), 15 map rules (`MAP_RULES` campaign orig L17, `phaseFor` L34), raid mechanics | 4 difficulties only (`types.js:178-183`; nightmare = 1 life + no income) |

### 2.2 Scaling formulas (for balance work)

* OLD enemy HP = base × DIFF.hp (cozy .95 / normal 1.2 / hard 1.6) × (1 + min(.45, .03·(chapter−1)))
  × (1 + .2·(w−1) + .065·max(0, w−10)); boss ×(1.6 + .075·w). Spawn gap max(.28, .85 − .022·w) s ×
  mode.spacing. Lives 150/100/60, cash 1000/850/750. Wave bonus 65 + 8·w.
* NEW enemy HP = base × stage.hpScale (1 → 6.5) × diff.hpMul (.85/1/1.35/1.75) × (1 + .015·(w−1));
  count from budget. Lives 150/100/50/1. Wave bonus (80 + 6·w) × cashMul × cashScale.

### 2.3 Unit number conversion (old girl → new UnitDef `base`)

Measured on the 11 girls that exist in both games (old → new): range ×0.68-0.77 (sniper excepted),
**old `rate` is seconds between attacks, new `rate` is attacks per second** (new ≈ 0.85-1.0 / old),
damage ×0.18-0.59 (median ≈ 0.3; pulse/cleave girls lower because they hit everyone).
Rule of thumb for the 13 old-only girls: `range ≈ old × 0.72`, `rate ≈ 0.9 / old.rate`,
`damage ≈ old × 0.3`, then tune with the existing headless balance run (`BALANCE=full`).

| girl | old dmg / interval s / range | new dmg / per-s / range |
|---|---|---|
| aoi | 9 / 0.6 / 4.3 | 4 / 1.4 / 3.2 |
| rei | 22 / 0.9 / 2.65 | 4 / 0.9 / 1.8 |
| yuki | 7 / 1.2 / 4.2 | 2 / 1.0 / 3.0 |
| akane | 23 / 1.4 / 4.5 | 6 / 0.7 / 3.1 |
| shiro | 58 / 1.9 / 8 | 18 / 0.4 / 10 |
| kage | 8 / 0.55 / 3.9 | 3 / 2.0 / 3.0 |
| raika | 19 / 1.2 / 4.7 | 5 / 0.9 / 3.2 |
| midori | 11 / 1.15 / 4.2 | 2 / 0.8 / 3.0 |
| hotaru | 14 / 1.6 / 3.8 | 6 / 0.8 / 2.6 |
| kaede | 17 / 0.7 / 2.7 | 10 / 1.1 / 2.0 |

### 2.4 Old damage-type → new attack type/element (for porting old kits)

| old kind (element) | new `attackType` + `element` |
|---|---|
| arrow, sniper, ninja, falcon, engineer (physical) | `pierce` |
| slash, duelist, onihero (physical) | `slash` |
| cannon, mortar (physical) | `blast` (+ `water` for Sango) |
| fire | `blast` + `fire` |
| ice, tidehero (frost) | `mystic` + `frost` |
| lightning, stormhero | `mystic` + `lightning` |
| poison | `mystic` + `poison` |
| hero, lantern, trapper, cleanse (holy) | `holy` |
| moonhero, summoner, wind, beam, mirror, curse, puppethero (arcane) | `mystic` |

Old enemy traits → new armor classes: wild/ooze → `light`, armored → `heavy`, spectral → `spectral`,
hexed → `warded`, brute → `heavy` (orcs) / `spectral` (ghouls) / `light` (beasts, plants), lizards and
dragons → `scaled`. Old per-enemy `resists` (e.g. Ember Slime fire ×0.35) become a single `ward`
element in the new model.

---

## 3. (a) Mechanics gap table

Legend — **Exists?** ✅ yes / ◐ partly / ❌ no. **Effort** XS < ½ day, S ≈ 1 day, M ≈ 2-4 days (sim +
tests + UI). **Worth** H/M/L.

### 3.1 Tower / girl mechanics

| Old mechanic (where) | Exists in new? | How to add to the new sim (files + approach) | Effort | Worth |
|---|---|---|---|---|
| **Traps** — Suzu stockpiles ≤5 bell traps on nearest lane or **aim point**, trigger r 0.8, blast 1.1+splash, freeze branch grounds (attackTowers pretty L344-363) | ✅ `trap` behaviour (`towers.js:506-548`, `updateTraps` 728-760), traps prefer spots nearest the exit; ◐ no aim point | Aim support: if `t.aim` set, sort `trapSpots()` by distance to the aim instead of `remaining` (towers.js:506-519). | XS (with aim) | M |
| **Sentries** — Chika: 2 sentries spawn at once at ±0.85, 64 % dmg each (pretty L364-379) | ✅ `turret` behaviour builds drones one per attack up to `max` (`towers.js:550-607`) | Nothing; tune Chika's `turret.max/damage`. | – | – |
| **Focus stacking** — duelist/onihero/`focus` branch: +7.5 %/stack (+2.5 % per focus tier), 8 stacks, resets on target switch (`shoot` pretty L241-253) | ✅ for `duel` behaviour (`ramp {per,max}`, `towers.js:420-448`); ❌ for projectile/beam | Generalise: in `attackProjectile`/`attackBeam` (towers.js:379, 450) when `spec.ramp` is set, reuse `t.rampTarget/rampStacks` and pass `scale` to `_hit`. Needed for Kanna (onihero) passive, Aoi "Focused volley", Kohaku "Resonant light". | XS | M |
| **Water placement** — `water: true` = land **and** water (Nami, Sango, Umeko, Seiran, Marina, Amane) (`canPlace` pretty L257-281) | ✅ `placement: 'amphibious'` already supported (`placement.js:129-130`) | Data only: set old water girls to `amphibious` (keeps the old feel; avoids an unplaceable hero on dry maps). Optionally a small "+10 % range while standing in water" bonus via a pseudo-aura in `recomputeBuffs` to keep water decisions meaningful. | XS | H |
| **Hidden/veiled + detect/reveal** — veiled needs `detect`, `reveal` aura in range, sight≥2/ground branch, or `revealed` timer; holy hits seal (pretty L79-84, combat-expansion L211) | ✅ `veiled` + `detection` + aura `detection` + `reveal` status (`combat.js:21-27`, `towers.js:126-164`) | Nothing. Map old detect girls → `detection: true` (Hikari, Luna, Kage, Shiro, Nami, Kanna, Yoriko, Seiran, Amane), reveal aura → `aura.detection` (Hotaru, Umeko, Marina). | – | – |
| **Armor / shred** — flat armor; shred = max(shred, 2·tier) for 5 s (cannon innate 1, onihero 2); pierce ignores 2/tier (pretty L199-206, L169) | ✅ `armor`, `armorPen`, `shred` status stacking ×3 (`combat.js:30-39`, `status.js`) | Nothing. | – | – |
| **Barrier multipliers** — breaker +0.4/tier, shred +0.3, siege +0.5, cannon +0.3 vs barrier (modifyHit pretty L158-168) | ✅ blast ×1.5 + `barrierMul` | Nothing. | – | – |
| **Mark / vulnerability / beacon** (+8 %/tier taken), **execute** (normals < 5 %·tier HP die; +20 %·tier vs elites) | ✅ mark/vulnerable; ◐ elite bonus via `eliteMul`; ❌ execute threshold | Add ModSet key `execute` (add): in `Sim._hit` after `computeHit`, if `e.tier==='normal' && e.hp - res.toHp < e.maxHp*0.05*execute` deal the rest (Sim.js:295-319). | XS | L |
| **Interrupt** — slow 0.65 for 0.5+0.2·tier s and cancel blink wind-up (pretty L212-216) | ✅ any slow/stun/silence cancels blink (`BLINK_INTERRUPTS`, `constants.js:36`) | Nothing. | – | – |
| **Lingering ground zones** — Yuki "Snowfield": zone 1.5+tier s, r 1.1+0.2·tier, slow 0.65 (pretty L481, L304-308) | ❌ (Yuki's "Hoarfrost Field" is only splash+status, `units.js:527`) | New `zone` ModSet `{radius, duration, slow?, dps?, element?}`; on hit/explode push `sim.zones.push({x,y,r,left,spec})`; tick in a new `updateZones(sim, dt)` (call after `updateTraps`, Sim.js:162) applying `applyStatus` slow / `_dot`. Expose `sim.zones` for a renderer decal (old `battle-props.js` used a translucent ring). Also reused by the Forge Vents map rule. | S | M |
| **Wind push + gather + per-enemy push lock** — push back 0.65+0.3·tier (boss 0.12), `pushLock` 1.5 s (boss 3 s); gather pulls others 12 % toward the lead; ground+reveal branch (pretty L432-448) | ◐ `knockback` exists (Sim.js:342-348) but **no per-enemy cooldown** (a fast knockback girl can stall a lane forever) and no gather | Add `e.pushLock` timer in `_onHitEffects` (skip knockback while > 0; 1.5 s normal, 3 s miniboss); new ModSet `gather` (add): `q.dist += (lead.dist − q.dist)·0.12·gather` for non-boss targets on the same path. | XS | M (pushLock is a fix: H) |
| **Grounding flyers** — falcon hits set `grounded` 2.2 s; ground-only girls (`groundOnly`) can then hit; Fuu ground branch; Seiran ult grounds 5 s; Suzu freeze traps ground (canEngage pretty L32-38) | ❌ (airborne + `canHitAir:false` is absolute, `combat.js:23`) | New status `ground {duration}` in `types.js STATUSES`; `isEligible`: `if (enemy.airborne && !enemy.statuses.ground && src.canHitAir === false) return false`; in `updateEnemy` set `e.alt = statuses.ground ? 0 : AIR_ALT` (enemies.js:410-450) so the renderer drops it. Bosses take 25 % duration like other CC (`CC_RESIST`). Add capability `ground` ("Grounding") so warnings/recommendations know it counters `airborne`. | S | H |
| **Air priority + ×2 vs air** — falcon/stormhero sort airborne first; falcon dmg ×(2+0.25·tier) vs air (pretty L254, L276) | ❌ | ModSet `airMul` (mul) applied in `computeHit` (`if enemy.airborne dmg *= hit.airMul`), and target mode `air` (or a `preferAir` flag) in `targetScore` (towers.js:235). | XS | M |
| **Aim points** — `setAim(id,x,z)` for mortar, mirror, stormhero (ult), trapper; mirror/trapper aim must be within range (pretty L239-253); "SET AIM POINT" button + tap (app.js pretty L669) | ❌ | `TowerRT.aim = {x,y}`; `sim.setAim(uid,x,y)` validated per behaviour; `sim.towerStats()` returns it; UI: button in `towerPanel.js` → next board tap in `placement.js` sets aim (renderer `pick()` already returns world x,y); renderer shows an aim reticle. | S | H (enabler) |
| **Mortar** — Tsubaki shells land at aim (or target's position) after **1 s** with a visible warning ring, r 1.6+splash; mobile enemies can escape (pretty L425-431, L309-317) | ❌ (arcing `shell` projectiles still home in) | New behaviour `mortar` in `BEHAVIORS` (towers.js:566): push `sim.shells.push({x,y,r,t:delay,spec,owner})`, emit `mortarWarn {x,y,radius,delay}`; `updateShells(sim,dt)` → `explode()` (towers.js:305). Renderer: warning ring (old used a thin orange torus). | S | H (Tsubaki, BTD6 mortar feel) |
| **Relay origin** — Ruri's familiar attacks from the midpoint between her and the nearest lane, range 3.3 (+0.65/otter tier); Iroha's mirror fires from the aim point, range 3.2+0.65·reach (pretty L380-415) | ❌ | `t.origin` (point) used by every behaviour instead of `t.x/t.y` for target gathering and projectile spawn (`attackProjectile`, `attackBeam`, `attackChain`, towers.js:379-503). Familiar origin = nearest path sample to the girl, mid-way; mirror origin = aim. Render a prop at the origin (old `battle-props.js` had hound/falcon/otter/mirror meshes — remodel as small GLB props). Familiar type (hound/falcon/otter) = which path Ruri upgrades (hound: +1 target/tier; falcon: air priority; otter: +reach over water). | S | M (Ruri, Iroha identity) |
| **Curse spread** — Ena marks; on death the cursed enemy bursts r 1.5 (+0.35·splash) for 80 % dmg and passes a 60 % curse, max 2 generations; antiheal branch (pretty L178-185, L232-235) | ❌ | Status `curse {damage, depth, sourceUid}`; in `onEnemyDeath` (enemies.js:456) explode neighbours with a mystic hit spec from the source tower and re-apply `curse` with damage×0.6, depth+1 ≤ 2; emit `curseBurst`. Antiheal = poison-like flag `antiHeal` on the status (regen/siphon already skip on `statuses.poison`, enemies.js:317, 419 — generalise to `statuses.poison || statuses.antiheal`). | S | M (Ena; satisfying chain reactions) |
| **Cleanse** — Noa pulses every 3 s (1.2 s at T3): clears tower stun and grants a 2 s ward vs volatile/stun (pretty L124-139) | ✅ passive `aura.cleanse` (towers inside are immune to sabotage/volatile and get un-disabled, `towers.js:196`, `Sim.js:413-415`) | Nothing — the passive version is clearer. | – | – |
| **Support blessing** — strongest aura wins, no stacking (+25 % dmg, rate) (pretty L323-335) | ✅ `aura` strongest-per-key (towers.js:178-210) | Nothing. | – | – |
| **Mend / bounty** — Noa "Protective hymn": kills in range +1 life, ≤ 2·tier per wave; Momo "Opening act": +tier coins per kill in range (onDefeat pretty L186-197) | ❌ | ModSets `mend` and `bounty` checked in `Sim._killEnemy` (Sim.js:381) for towers whose range covers the kill. | XS | L |
| **Income** — Momo 65+45·level per wave | ✅ `income {perWave, interest}` | Nothing. | – | – |
| **Global damage buff after ult** — `moonBlessing` +15 % for 4 s (Luna) / 6 s (Amane) (pretty L91, L400) | ❌ (only `addGlobalRateBuff`, Sim.js:204-208) | `addGlobalDamageBuff(mul, dur)` mirroring the rate buff; `refreshEffective` multiplies damage by `sim.globalDmgMul` (towers.js:126-138). | XS | H (ults) |

### 3.2 Hero levelling and ultimates

| Old | New | Recommendation |
|---|---|---|
| Hero free, auto-armed for placement at battle start (app.js pretty L557 `setPlacement(game.heroId)`) | Hero costs 450-650 | Keep new cost (owner: "nerf the heroes") but **auto-arm the hero card on wave 0** like old — fewer taps. XS, battle-ui. |
| Level = ⌊team kills / 40⌋ (max 9) | XP from own damage + wave clears, Lv 1-10, milestones | Keep new (rewards hero placement). |
| Ult ready immediately, CD 58-72 s, hotkey **Q**, button text "Ready · tap to cast" | Unlocks at Lv3, 50 % charge, no hotkey | Keep unlock; add **Q** hotkey (`controller.js:247-262`). XS. |
| `nova`-like: Hikari (100+18·lvl holy all, slow 50 % 2 s), Nami (90+16·lvl frost all + 60 % slow 3 s) | `nova`/`tide` | Fits existing types. |
| Luna Ninefold Moonfall: 85+20·lvl arcane all + 80 % slow 2 s + **team +15 % dmg 4 s** | `timeWarp` has rate buff only | Add `dmgBuff`/`dmgBuffDuration` to `nova`/`timeWarp` (hero.js:153-176) using `addGlobalDamageBuff`. XS |
| Amane Seaglass Finale: 70+14·lvl frost + slow 3 s + team +15 % 6 s | – | Same as Luna. |
| Kanna Festival Drumfall: strongest target 230+24·lvl, ignores armor, shred 8 for 8 s, 30 % splash r 2, stagger 1 s (boss .35) (expansionAbility pretty L488-500) | ❌ | New `UltEffect {type:'strike', target:'strongest'|'first', damage, splash, splashMul, status:[shred, stun], armorPen: 99}` in `activateUlt`. S |
| Yoriko Dream Detour: push back 5 (boss 0.5), 65+12·lvl arcane, slow 3 s | `tide` (pushback, damage, slow) ✅ | Data only. |
| Seiran Dragonflight: **at aim point**, r 4: 125+18·lvl lightning, ground 5 s, mark +18 % 5 s | ❌ | `nova` with `center: 'aim'` (needs aim points) + `ground` + `mark` statuses. S |
| Cut-in: "HERO SIGNATURE" full-screen card with name/subtitle/quote + SKIP (`cinematics.js`, `sb-ult.png`), plus screen flash + camera shake | banner `feed.announce(ult name)` + flash | See UX §6 item 3. |

### 3.3 Enemy mechanics (old `enemy-skills.js`, `combat-expansion.js updateTraits/modifyHit/onDefeat`)

| Old mechanic | Exists in new? | How / notes | Effort | Worth |
|---|---|---|---|---|
| Siphon (periodic %, capped, donors never die, poison/antiheal block) | ✅ continuous `siphon` (enemies.js:317-333) | – | – | – |
| Blink with 1.2 s tell; any slow cancels | ✅ `blink` + `teleportWarn` 0.8 s + interrupts | – | – | – |
| Fields haste/shield/regen/**alternating**, pulse **4 s of every 8 s**, `below` HP threshold, holy suppresses 2 s, never stack | ✅ always-on fields + rotating `kinds`, holy silence 2 s (Sim.js:338-341), strongest wins | Optional `field.period/duration` in `activeField()` (enemies.js:185) for an on/off rhythm the player can see and exploit. | XS | L-M |
| onHalf: enrage / call slimes / scouts / hatchlings | ✅ boss `phases[]` with announce (enemies.js:165-182) | New is better. | – | – |
| Regen pulse every N s (visible "heal-pulse" ring), blocked by poison/antiheal | ✅ delay-based regen (enemies.js:419-424) | Renderer: show a soft green pulse when regen ticks after the delay (readability). | XS | M |
| **Repair** (Gearpatch Goblin: every 4 s heal allies in r 3 by 6 % HP + 10 % barrier; priority target) | ❌ | Trait `repair {radius, pct, barrierPct, every}` in `updateAbilities` (enemies.js:282-389), blocked by silence/poison; emit `healPulse`; add to `isCaster()` (enemies.js:39) so Priority targeting picks it. TRAITS entry counters `['priority','antiHeal','silence']`. | XS | M |
| **Charge** (boar: stops for 1.2 s wind-up with a tell, then ×2.4 speed for 1.8 s; slow/stagger cancels) | ◐ `hasty` bursts with no tell (enemies.js:286-296) | Add optional `hasty.windup`: stop (`mul = 0`) for windup s, emit `chargeWarn`, then burst; any `BLINK_INTERRUPTS` status during windup resets. Gives the readable "telegraph → counter" the owner asked for. | XS | M |
| Summon with **limit** (2-3 per caster) / illusion limit 3 | ◐ `summoner`/`decoy` spawn **forever** (enemies.js:343-364) | Add `limit` (count spawned per parent) — prevents runaway spawns on long-lived elites at high hpScale. | XS | H (bug class) |
| Pack (on death, packmates within 3 get +35 % speed 6 s) | ✅ `enrage` stacks per fallen packmate | – | – | – |
| Volatile (stun towers in r unless warded) | ✅ `volatile` (cleanse aura protects) | – | – | – |
| Crystal (hits chip 2 from a shell pool; DoT can't) | ✅ `crystal {cap, hits}` | – | – | – |
| Barrier (pool ∝ √hpScale) | ✅ pool × hpMul, optional regen | – | – | – |
| Ward (element ×0.4 unless holy-sealed) | ✅ ward ×0.5 + status immunity | – | – | – |
| Phase (only holy/arcane hit; holy seals 4 s) | ✅ `phasing` (holy/mystic; holy/silence end it) | – | – | – |
| Airborne (+ grounded) | ◐ airborne ✅, grounded ❌ | see 3.1 | | |
| Split / brood | ✅ `splitter`/`brood` | – | – | – |
| Weather (rain +12 % speed on coast/harbor/marsh; sun +1 armor on dunes/forge) | ❌ | Fold into map rules (§3.4), not enemy traits. | – | L |
| Raid mechanics: shield (first 12 hits at 20 %), enrage at 50 %, summon at 50 % | ✅ via phases | – | – | – |
| Guardian, sabotage, decoy, enrage, summoner | (new-only) ✅ | New is richer. | | |

### 3.4 Battle modes, map rules, intel, sandbox, speed

| Old | Exists? | How to add | Effort | Worth |
|---|---|---|---|---|
| **6 battle modes** per difficulty, medals per (difficulty, mode) = 18 per map (`BATTLE_MODES` battle-modes orig L1; `old-stage-grave-2.png`): Standard; Reverse Route (enemies enter from the exit); Goblin Rush (speed ×1.3, spawn gap ×0.7); Ironclad (+4 armor, bosses +8); Half Income (bounties, wave bonus, income ×0.5); Last Petal (1 heart, no healing) | ❌ (`nightmare` difficulty ≈ Last Petal + no income) | New `src/data/modes.js` `{id, name, icon, desc, speedMul, spacingMul, armorAdd, bossArmorAdd, incomeMul, oneLife, reverse}`. Sim: `options.mode` → `spawnEnemy` multiplies `speedMul` and adds armor (Sim.js:255-280); `_getWave` passes `spacingMul` to `generateWave` (waves.js:246 `baseSpacing *= spacingMul`; include in the wave cache key); `_killEnemy`/`_checkWaveEnd` multiply cash by `incomeMul` (Sim.js:385, 451-459); `oneLife` → `maxLives = 1`; `reverse` → reverse every path's waypoints before `buildPaths` (Sim.js:59). `result()` adds `mode`. Systems: medals keyed `${difficulty}:${mode}`, first-clear gems only for Standard. UI: mode grid on `src/ui/screens/stage.js` (copy the old card layout), `&mode=` route param, HUD tag. | M | **H** (owner req 13, roadmap "contracts") |
| **15 map rules** with an 16-20 s cycle and an ACTIVE/resting HUD pill (`MAP_RULES`, `phaseFor`, `environmentDamage`, movement block in `update`, pretty L105-128, L512-526): see table §3.5 | ❌ (maps only carry themes/scenery) | `StageDef.rule` (or `MapDef.rule`) = `{id, name, icon, desc, cycle:[period, active]|null, effects}` with a fixed vocabulary the sim understands: `towerDmgMul`, `elementMul{el}`, `attackTypeMul{type}`, `enemySpeedMul`, `traitSpeedMul{trait|armorClass}`, `towerRangeMul`, `bountyAdd`, `bonusEvery{n, coins}`, `livesPerWave`, `ultResetEvery`, `zones[{x,y,r,dps,element}]`, `pads[{x,y,r,dmgMul,rangeAdd}]`, `reverseEvenWaves`, `waveElementCycle`. New `src/sim/rules.js` (`ruleActive(sim)`, helpers); hooks: `Sim._hit` `scale` (Sim.js:295), `_dot` (353), `updateEnemy` speed mul (enemies.js:434-442), `recomputeBuffs` for pads/range (towers.js:178; mark `_buffsDirty` when the phase flips), `_checkWaveEnd` economy (Sim.js:447). `sim.ruleInfo()` → `{name, icon, active, secondsToFlip}` for a HUD pill; renderer decals for pads/zones. One rule per map, shown on the stage card. | M | **H** (owner req 6 "maps with gimmicks", req 14, roadmap "interactive battlefields") |
| Alternating routes per wave (`routeMode:'wave'`, Clockwork Rooftops) and reverse every even wave (Whisperleaf/bamboo) | ❌ | `waveGen.pathPlan: 'alternate'` → in `generateWave` all spawns of wave n use path `(n−1) % pathCount` (waves.js:327); `reverseEvenWaves` rule keeps a reversed copy of `pathData` and `spawnEnemy` picks it by parity. ENTRY/EXIT markers must follow (old `routePreviewState`, route-markers pretty L1-14). | S | M |
| Rift portals (non-boss enemies jump +12 % of the path once at 40 %) | ❌ | Rule effect `portals:[{at, jump}]` in `updateEnemy`, emit `blink`. | XS | L |
| **Intel**: field briefing (title, text, named counters, free recruit), enemy chips with NEW, bestiary unlock after victory (`campaign-intel.js`, `intel-ui.js`) | ✅ recommended counters + "New!" + bestiary silhouettes; `waveWarnings` | Keep new. Port the hand-written lesson tone into `stage.desc` where it is generic. | – | L |
| **Scout** (blocking modal with counts + mechanic tags) | ✅ better (strip + popover + counter-aware warnings) | Keep new. | – | – |
| **Sandbox**: all units, coins refill to 999 999, hearts refill, ∞ waves, spawn any enemy × 1-50 × HP 0.5-20, clear enemies, reset ult, reset field (`Game.sandboxSpawn` pretty L563; app.js `showSandbox` orig L210) | ❌ | Sim `options.sandbox` (refill cash/lives each step, no auto waves, `state` stays `'wave'` while enemies live); `sim.spawnEnemy(id,{hpMul})` already public (Sim.js:255). StageDef `lab` (kind `sandbox`, `waves: Infinity`, empty pool) on any `mapId`. UI `src/ui/battle/lab.js`: family tabs with enemy tokens, count, HP×, Spawn / Clear / Reset ult / Reset field, **live DPS per girl** from `sim.stats.damageByTower` (roadmap "tactical lab with damage breakdowns"). Practice: never applies rewards. | M | **H** (owner req 7, roadmap) |
| Speed 1/2/3×, Auto | ✅ same | – | – | – |
| Verified command log (`VerifiedGame.commands [tick, method, args]`) | ❌ | Wrap public Sim actions to append `[stepIndex, method, args]`; deterministic replay = new Sim + same seed + log. Enables anti-tamper verification (owner req 29), replays in the defeat debrief, bug repro. | S | M |

### 3.5 Old map rules (data to port; cycle = `[period s, active s]`)

| map | rule | effect (old numbers) | cycle |
|---|---|---|---|
| garden | Petal sanctuary | +3 hearts after every cleared wave | – |
| glade | Firefly chorus | all girls +25 % dmg | 16 / 6 |
| shrine | Moonlit blessing | holy +30 % | 18 / 9 |
| coast | Changing tides | ooze enemies −35 % speed, lightning +35 % | 18 / 7 |
| frost | Snowbell blizzard | enemies −30 % speed **and** girls −15 % range | 20 / 7 |
| dunes | Heat mirages | girls −0.7 range; +2 coins per kill always | 18 / 6 |
| forge | Forge vents | central crossing (r 2.1) burns 20 dps | 15 / 5 |
| marsh | Alchemist's mist | poison +40 %; brutes −15 % speed | – |
| sky | Tailwind | enemies +25 % speed; physical +25 % | 16 / 6 |
| harbor | Supply ship | +150 coins every 4th wave; lightning +20 % | – |
| crystal | Prism conduits | 3 pads: girls on them +1 range, +25 % dmg | – |
| bamboo | Rear ambush | every even wave enters from the exit | – |
| grave | Lunar eclipse | holy +50 %; spectral +20 % speed | 20 / 6 |
| festival | Festival encore | every 3rd clear: ult recharged + 120 coins | – |
| rift | Shifting stars | element of the wave (fire→frost→lightning→holy→arcane) +50 %; non-bosses blink once through rifts | per wave |

Suggested placement on the new chapters (one rule per stage, introduced gently, never on 1-1 to 1-3):
ch1 sakura → Petal sanctuary; ch2 lake → Changing tides (soaked/slime slow + lightning); ch3 shrine →
Moonlit blessing / Lunar eclipse; ch4 mountain → Snowbell blizzard; ch5 marsh → Alchemist's mist;
ch6 foundry → Forge vents + Prism conduits (pads); ch7 festival → Festival encore; ch8 peaks →
Tailwind; Tactical Challenge → Shifting stars. Map to new attack types: "physical" → pierce+slash+blast,
"arcane" → mystic.

---

## 4. Old roster on the new sim (what the roster swap needs)

| old girl | old kind | new behaviour to use | sim features needed |
|---|---|---|---|
| Hikari ★hero | hero holy cleave (r 1.35 around target) | `pulse` holy (as new Hikari) | – |
| Luna ★hero | moonhero 3 arcane beams, pierce armor, slow | `beam` ×3 mystic + slow + armorPen | ult `dmgBuff` |
| Nami ★hero | tidehero frost ×2 targets, slow, water | `projectile` ×2 mystic/frost | `amphibious` |
| Aoi | arrow | `projectile` pierce | (projectile ramp for "focus") |
| Rei | slash 4 targets, ground-only | `pulse` slash, `canHitAir:false` | – |
| Yuki | ice slow 50 % 2 s | `projectile` frost slow | `zone` for Snowfield |
| Akane | fire splash + burn | `projectile` blast fire | – |
| Shiro | sniper, ignores armor, priority | `projectile` pierce armorPen, target `elite` | (`execute`) |
| Kage | ninja 3 targets, detect | `projectile` ×3, detection | – |
| Raika | chain lightning 3 | `chain` | – |
| Miko | support aura | `aura` (+ tiny attack) | – |
| Midori | poison splash | `projectile` poison | – |
| Momo | income | `income` | – |
| Hotaru | lantern holy pulse all + 20 % slow, reveal | `pulse` holy + reveal | – |
| Sango | cannon splash shred, water | `projectile` blast + shred | `amphibious` |
| Umeko | support reveal aura, water | `pulse` + `aura.detection` | `amphibious` |
| Kaede | duelist focus | `duel` ramp | – |
| Suzu | trapper holy bells (≤5), aim | `trap` | aim (opt.) |
| Chika | engineer 2 sentries | `turret` | – |
| Kohaku | beam pierce 4 | `beam` | – |
| Noa | cleanse pulse + small blessing | `aura {cleanse, dmgMul}` | – |
| Marina | lantern holy pulse + reveal, water (**summer swim outfit — needs a non-swimwear base outfit on the chibi**) | `pulse` holy | `amphibious` |
| Yoriko ★hero | puppet threads ×2 slow; ult Dream Detour | `projectile` ×2 slow; ult `tide` | – |
| **Tsubaki** | mortar at aim, 1 s delay, range 30 | **new `mortar`** | aim + shells |
| **Iroha** | mirror relay at aim | `projectile` from origin | aim + origin |
| **Ruri** | familiar hound/falcon/otter from a lane-side origin | `projectile` from origin; paths = familiar type | origin (+ air priority for falcon) |
| **Hana** | falcon: air first, ×2 vs air, grounds | `projectile` pierce | `ground` status, `airMul`, air-first targeting |
| **Fuu** | wind push 3+ targets, gather, ground/reveal | `projectile`/`pulse` + knockback | `pushLock`, `gather`, `ground` |
| **Ena** | curse burst on death, antiheal | `projectile` mystic | `curse` status |
| **Kanna** ★hero | focus + shred + stagger, ground-only; ult Drumfall | `duel` ramp + shred + stun chance | ult `strike` |
| **Seiran** ★hero | chain, air priority, water; ult Dragonflight at aim | `chain` + air-first | aim for ults, `ground`, `amphibious` |
| Amane ★hero (**summer outfit — non-swimwear base needed**) | tidehero frost ×2; ult +15 % team dmg | `projectile` ×2 frost | ult `dmgBuff`, `amphibious` |

So: 24 girls run on existing behaviours today; 7 need the additions in §3.1/§3.2. Rough sim cost for
all of them: aim + mortar (S), origin (S), ground + airMul + air targeting (S), gather + pushLock (XS),
curse (S), ult strike/aim/dmgBuff (S) ≈ 5-6 days including `tests/sim/*` cases.
The old 3-tier branch names/effects (`BATTLE_BRANCHES`, expansion-roster orig L26) are good flavour
for the 13 new 5-tier paths (e.g. Ruri: Moonhound / Star falcon / Tide otter; Fuu: Returning gale /
Gathering dance / Grounding breeze; Tsubaki: Siege star / Meteor shower / Signal shell; Ena: Cursed
bloom / Withering script / Shared fate).

---

## 5. (b) Enemy roster comparison

### 5.1 Overview

| | OLD | NEW |
|---|---|---|
| Count | 80 defs (13 base + 7 recolours + 7 extra in data.js, 17 in enemy-ecology.js, 36 in expansion-enemies.js), 12 families (Slime, Goblin, Orc, Ghost, Ghoul, Oni, Lizardfolk, Construct, Beast, Fae, Plant, Dragon; Skeleton/Golem folded into Ghoul/Construct) | 74 defs in 12 families; 13 elites, 4 minibosses, 3 bosses (docs/BESTIARY.md) |
| Art | procedural primitives (`enemies.js makeEnemy`, `enemy-expansion-models.js`), merged per material; one humanoid body reused by orc/goblin/ghoul/oni/lizard; bosses = scaled + crown; 2 prerendered webp thumbs in the mirror | 12 rigged Blender GLBs (2.27 MB total) with variants, props, move/idle/hit/death/special clips, toon + outline; runtime hooks `setVeiled/setBarrier/setPhasing/setStatus` |
| Readability rules | up to 4 mechanics on one enemy (e.g. Ashwing: airborne + armor + speed field + half-health phase; Stormscale Drake: airborne + barrier + armor) | one rule per normal enemy, ≤ 2 per elite, telegraphed boss phases (CONTRACTS §12) |
| Trait tells on the model | **yes**: generic accessories added by trait — barrier arcs, crystal shards, veil wisps + ring, ward gem coloured by element, fuse, wings, regen sprout, brood eggs, armour plates (`decorateEnemyTraits`, enemy-expansion-models pretty L514-660), plus a coloured trait halo ring under every enemy | variant props per def (helmets, crystals, lantern…), status icons over the HP bar; no generic per-trait tells |
| Mechanics count | see §3.3 | superset except repair / charge-telegraph / grounded / summon limits |

**Verdict:** the new set wins on art, rigging, readability and boss design. Keep it as the base.
Port old ideas only where they add gameplay or fulfil an owner request.

### 5.2 Old → new mapping (every old id)

`=` existing new def covers it · `NEW` add a def (spec in 5.3) · `drop` (recolour/duplicate or
breaks the one-rule design) · `rule` becomes a map rule.

| old id (name) · old rule | → new |
|---|---|
| slime (Mochi Slime) | = `slime_green` |
| swarm (Tiny Slime) | = `slime_droplet` |
| tideslime, frostslime, pearlslime, redslime (resist-only recolours) | drop (resists are invisible; use `slime_spellglass` for the ward lesson) |
| greenslime (Lime Runner, fast) | = `slime_gold` (hasty) |
| ironslime (armor 3) | = `slime_iron` |
| purpleslime (veiled) | = `slime_violet` |
| roseslime (siphon) | = `slime_rose` |
| **blueslime (blink)** | **NEW `slime_blink`** |
| **tealslime (haste field)** | **NEW `slime_tempo`** |
| **goldslime (shield field)** | **NEW `slime_honey`** (name avoids clashing with new Gold Slime) |
| splitslime (brood → 2 swarm) | = `slime_prism` (splitter) |
| crystalslime (crystal) | = `slime_crystal` |
| **barrierslime (Bubbleguard, barrier)** | **NEW `slime_bubbleguard`** |
| regenslime (Sprout, regen) | = `slime_pearl` (regen) |
| volatileslime (Firecracker) | = `slime_ember` |
| **wardslime (Spellglass, arcane ward)** | **NEW `slime_spellglass`** (frost ward) |
| wingslime (Cloud, airborne) | = `slime_bubble` |
| slimePrince (miniboss, calls 4 mimics at ½) | = `slime_prince` |
| swift (Goblin Scout), goblin (Sneak), sandgoblin | = `goblin_runner` / `goblin_dasher` |
| **purple (Violet Goblin, hexed, crossover)** | **NEW `goblin_violet`** — owner req 5 asked for exactly this |
| boggoblin (brute goblin) | drop |
| shadowrogue (Shadow Goblin, veiled fast), goblinSmoke | = `goblin_smoke` |
| goblinSapper (volatile) | = `goblin_bomber` (new `goblin_sapper` is sabotage) |
| **goblinMedic (Gearpatch, repair, priority)** | **NEW `goblin_medic`** (+ trait `repair`) |
| goblinMachine (miniboss) | = `goblin_machine` |
| goblinBoss (Violet Goblin King, boss) | later: Total Assault boss `boss-goblinking` (5.4) |
| orc (Raider, brute) | = `orc_grunt` |
| armored (Ironhide), coralorc | = `orc_ironhide` |
| shieldOrc (Bulwark, barrier+armor) | = `orc_shieldbearer` (guardian) / `construct_aegis` |
| bannerOrc (haste field orc) | drop (fields are the oni family's rule) |
| orcGeneral (miniboss, enrage at ½) | = `orc_general` |
| boss (Orc Warlord / Ironwood King raid) | = `orc_warlord` (elite) + `orc_general` |
| ghost (Lantern Ghost), crystalghost | = `ghost_wisp` |
| veilwraith | = `ghost_veilwraith` |
| phaseGhost (Moonphase Spirit) | = `ghost_phantom` |
| mirrorGhost (veiled + illusions) | = `fae_queen` |
| ghoul (Moss Ghoul, siphon) | = `ghoul_leech` |
| blinkghoul, graveStalker | = `ghoul_skulker` |
| **boneguard (Boneguard Knight, armor 5 skeleton)** | **NEW `ghoul_boneguard`** (optional; armored spirit) |
| necromancer (summons boneguards, limit 2) | = `ghoul_gravepriest` |
| ghoulBoss (Grave Choir Regent, summons + siphon) | = `grave_lych` (boss) |
| oni (Ember, haste field), cinderoni | = `oni_haste` |
| frostoni (shield field) | = `oni_shield` |
| regenOni (Bloomward, regen field) | = `oni_bloom` |
| stormOni (lightning ward + haste) | drop (2 rules on a normal) |
| duskoni (veiled + shield field) | optional elite `oni_dusk` (2 rules = elite) |
| oniChampion (alternating fields) | = `oni_champion` |
| oniBoss (Moonveil Oni, eclipse raid) | later: Total Assault boss `boss-moonveil` (5.4) |
| lizard (Reedscale), rainLizard | = `lizard_skink` / `lizard_hunter`; rain → `rule` |
| lizardguard (Sunshell), sunLizard | = `lizard_sunscale` (fire ward); sun → `rule` |
| stonegolem (Runestone, armor 8) | = `construct_sentry` |
| crystalGolem | = `construct_shellback` |
| clockworkGolem (barrier + armor) | = `construct_aegis` |
| constructBoss (Prismatic Colossus, crystal + barrier) | = `iron_colossus` |
| wolf (pack) | = `beast_wolf` (enrage) |
| boar (charge with wind-up) | = `beast_boar` **+ `hasty.windup`** |
| direwolf (pack + frost ward) | drop / = `beast_alpha` |
| fae (illusions), faeDecoy | = `fae_illusionist`, `fae_mirage` |
| mothfae (airborne fae) | = `fae_sylph` |
| sapling (regen) | = `plant_mossling` |
| seedpod (splits into saplings) | = `plant_seedpod` |
| thornbeast (armor + regen) | = `plant_thornroot` / `plant_treant` |
| **plantBoss (Elder Rootkeeper, miniboss: brood + regen)** | **NEW `plant_rootkeeper`** — gives 5-5 a miniboss (today it has none) |
| wyvern | = `dragon_wyvern` |
| iceWyvern (airborne + frost ward) | drop (= `dragon_cinder` with fire ward) |
| stormDragon (airborne + barrier + armor) | drop (3 rules) |
| dragonBoss (Ashwing Matriarch; summer reskin "Seaglass Leviathan") | = `dragon_ashwing` |

### 5.3 New defs worth adding (all on existing GLB families/variants)

Stats follow CONTRACTS §5b anchors (before hpScale). `model.variant`/`props` are existing slime,
goblin, ghoul and plant variants; only colour/accent change unless noted.

| id | name | family / variant + props | tier | hp | speed | class | armor | traits (one rule) | threat / bounty | debut | why |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `slime_blink` | Blue Blink Slime | slime `drop` + sparkle, #639def | normal | 18 | 1.0 | light | 0 | `blink {every 6, distance 2}` | 2.5 / 6 | 5-2 (with Fog Skulkers) | previews blink gently (old Riftstep/ blueslime) |
| `slime_tempo` | Teal Tempo Slime | slime `drop` + sparkle, #50d6c4 | normal | 20 | 1.0 | light | 0 | `field {haste, r 1.6, 0.2}` | 3 / 8 | 7-1 | fields preview |
| `slime_honey` | Honey Shield Slime | slime `drop` + shell, #ffcf65 | normal | 22 | 0.95 | light | 0 | `field {shield, r 1.6, 0.2}` | 3 / 8 | 7-2 | fields preview |
| `slime_bubbleguard` | Bubbleguard Slime | slime `bubble` (grounded) + bubble, #70cfed | normal | 18 | 0.9 | light | 0 | `barrier {hp 24}` | 2.5 / 8 | 6-2 | barrier preview |
| `slime_spellglass` | Spellglass Slime | slime `drop` + crystals, #c192e4 | normal | 20 | 1.0 | light | 0 | `ward: 'frost'` | 2.5 / 6 | 2-4 (ward intro) | ward preview; teaches "bring a second element" |
| `goblin_violet` | Violet Goblin | goblin `scout` + hood, #b389d5 | normal | 30 | 1.35 | **warded** | 0 | none — its rule is its armor class (holy ×1.25, mystic ×0.5) | 3 / 6 | 3-1 as the shrine "crossover" | owner req 5 ("purple goblin … battle-cat typing") |
| `goblin_medic` | Gearpatch Goblin | goblin `tinker` + wrench+backpack, #95ad75 | normal | 40 | 1.1 | light | 0 | **`repair {radius 2.2, pct .06, barrierPct .1, every 4}`** | 5 / 14 | 6-2 | readable Support role; rewards Priority targeting/silence |
| `ghoul_boneguard` | Boneguard Knight | ghoul `skeleton` + helmet (+shield), #e2d9be | normal | 40 | 0.85 | spectral | 3 | armored | 4.5 / 14 | 5-3 | optional: armor + spectral = holy & pierce lesson |
| `plant_rootkeeper` | Elder Rootkeeper | plant `treant` ×2.2 + flower+crown | **miniboss** | 3000 | 0.45 | light | 2 | `regen {pct .01, delay 3}`, `brood {plant_seedpod ×2}`; phases 0.66 "Seed pods burst from its bark!" (+summoner seedpods), 0.33 "Thorns harden!" (armor 5) | 140 / 900 | 5-5 finale | every chapter finale should have a named boss (2-5/3-5/5-5 currently end on elites) |

Also: `oni_dusk` elite (veiled + shield field, 320 hp) for chapter 7 if more elites are wanted.
Every new def needs: TRAITS/BESTIARY text (`docs/BESTIARY.md` is generated from `enemies.js`),
`counters` tip, `introducedIn`, and a pool entry in `src/data/stages.js`.

### 5.4 Old raids → Total Assault candidates (later)

Old had 3 raids (Ironwood King · enrage, Violet Throne · goblin king + shield, Eclipse Gate · Moonveil
Oni); new has 3 (Grave Lych, Iron Colossus, Ashwing). Two easy additions on existing GLBs:
`boss-goblinking` (goblin `chief` ×2.6 + crown; phases: runners, haste burst, bomber rain) and
`boss-moonveil` (oni `champion` violet + veil; phases: veiled, rotating fields, shield). Low priority.

### 5.5 Trait additions summary (sim, `src/sim/enemies.js` + `src/data/types.js TRAITS`)

* `repair` (new trait) · `hasty.windup` (charge tell) · `summoner.limit`, `decoy.limit` · optional
  `field.period/duration`. All XS. Add counters in TRAITS so `waveWarnings` recommend them.

---

## 6. (c) Battle UX ideas from the old game worth adopting

Ordered by value. Files are the new owners (battle-ui `src/ui/battle/**`, renderer `src/render/**`).

1. **Battle modes on stage prep** (old `old-stage-grave-2.png`): 6 mode cards under the difficulty
   cards, medal per (difficulty, mode), `&mode=` param, HUD tag "Normal · Goblin Rush". (§3.4)
2. **Map-rule pill** (old bottom-left "Lunar eclipse · ACTIVE/resting", `gimmickLabel` pretty L117):
   rule icon + name + state + a thin countdown ring; tap → one-line explanation. Mirror the rule on the
   stage card. Needs map rules (§3.4).
3. **Ult cut-in** (old "HERO SIGNATURE" overlay, `sb-ult.png`; owner req 6 "cool cutscene animation
   attack"): Blue Archive EX-skill style, ≤ 1.2 s — diagonal panel slides in with the girl's
   illustration (the old `assets/*.webp` art), skill name in navy italic, the sim slowed to 0.3× for
   ~0.6 s then resumes; skippable by tap; settings toggle (old had `settings.cinematics`). New file
   `src/ui/battle/cutin.js`, hook in `controller.js` `case 'ult'` (controller.js:349). Add the **Q**
   hotkey (controller.js:247-262).
4. **Tap an enemy to inspect** (old `inspectEnemy` → enemy info with 3D model, mechanics, matchups):
   `renderer.pick()` also returns the nearest enemy uid within ~0.5; show a small card (name, tier,
   trait icon + one line, armor class with ▲/▼ chips for each attack type in your formation, counters
   tip). Biggest readability win for "enemies must be readable". S.
5. **Sandbox / Tactical Lab drawer** (flask button in battle; old `sb-sandbox-modal.png`) with spawn
   controls + per-girl DPS meter (§3.4).
6. **ENTRY › / EXIT ♡ labels** on the route markers (old mint/pink pills, `route-markers.js`), following
   reversed/alternating routes. New has arrows only (`nb64-prep.png`). Owner req 37 asked for
   identifiers. XS in `src/render/overlays.js`.
7. **Type chart visible in battle**: old drew a coloured trait halo under every enemy. New: tint the
   enemy ground ring by armor class (light green / heavy grey / spectral cyan / warded violet /
   scaled amber) in `actors.js` (tier rings exist), and give tower-bar cards a small ▲ when the girl is
   effective against most of the next wave (owner req 7 "effective unit icon"). armorClass is
   currently not referenced anywhere in `src/render` or `src/ui/battle`. XS-S.
8. **Generic trait tells on enemy models** (old `decorateEnemyTraits`): attachable props for ward
   gem (element colour), regen sprout, brood eggs, barrier arcs, so the 5 new slime mimics read at a
   glance. Hook through the existing `model.props` list. S (models).
9. **Enemies-left counter** on the wave control while a wave runs (old "12 ENEMIES LEFT"); new hides
   the button mid-wave. XS (`waveControl.js`).
10. **Auto-arm the hero** for placement at battle start (old `setPlacement(game.heroId)`), and tapping
    the deployed hero card selects her (old). XS.
11. **In-battle "Traits" cheat sheet** (old squad-panel link → role guide + mechanic list,
    `combat-ui.js counterGuide`): pause menu button reusing `TRAITS`/`ROLES` text. XS.
12. **Telegraph visuals** the old game drew that new should check: mortar warning ring (with mortar),
    heal pulse (regen/repair), siphon tether line, curse burst ring, charge wind-up. New already has
    `teleportWarn`, `blinkInterrupted`, field rings, barrier/shell break.

**Keep new, don't adopt from old:** right-side squad panel (phone: `phone/sb-mixed-far.png` board ≈ 45 %
of the screen vs new ≈ 80 %), blocking scout modal, no HP bars, 1.5-unit spacing, camera rotate
buttons (pan/zoom is enough), kill-count hero levels, 3×3 branches.

**New-game UX issues seen while comparing:** damage numbers get noisy with many towers
(`nb73-midwave.png` — consider only effective/crit numbers at 2-3× speed); toasts cover the top-left
of the board on phones (`phone/ph34-midwave.png`); enemies are small at 1280×720 on 20-22-wide maps.

---

## 7. Suggested order

**Phase A — make the old roster playable (sim, ~1 week incl. tests)**
1. `amphibious` for old water girls (data).
2. Aim points + `mortar` behaviour + `ground` status + `airMul`/air-first targeting.
3. Relay `origin` (familiar, mirror), `pushLock` + `gather`, `curse` status.
4. Ult `strike`, `center:'aim'`, `dmgBuff` (+ `addGlobalDamageBuff`).
5. Bug-class fixes: `summoner.limit`, `decoy.limit`, knockback lock.
Tests: one `tests/sim/*.test.js` case per feature (eligibility, timing, determinism), then the
`BALANCE=full` headless table with the ported numbers (§2.3).

**Phase B — the "super game" layer (sim + UI, ~1.5 weeks)**
6. Battle modes + medals (data/modes.js, Sim options, stage prep grid, save keys).
7. Map rules (8 rules first: one per chapter) + HUD pill + pads/zones decals.
8. Sandbox / Tactical Lab.
9. UX: ult cut-in + Q, enemy inspect, ENTRY/EXIT labels, armor-class rings, enemies-left, hero auto-arm.

**Phase C — enemy content (~3 days)**
10. 5 slime mimics, `goblin_violet`, `goblin_medic` (+`repair`), `beast_boar` wind-up,
    `plant_rootkeeper` for 5-5, optional `ghoul_boneguard`; regenerate BESTIARY; place them in stage pools.
11. Later: command log/replay, alternating/reversed routes, extra Total Assault bosses, field pulsing.

---

## 8. Risks and coordination

* **tracks-v3 is editing the sim now** (`src/sim/path.js`, `Sim.js`, `placement.js`, `headless.js`,
  `src/data/maps.js`). Land Phase A after it, or coordinate: reverse routes, alternating routes, map
  rules and origins all touch path data.
* Every new mechanic must stay inside the "one readable rule" design (CONTRACTS §12): grounded,
  curse, repair, charge all need a TRAITS/STATUSES entry, an icon (`src/art/icons.js statusIcon/
  traitIcon`) and a warning line in `report.js`.
* Balance: old numbers are on a different scale (§2.3) — never paste old damage/HP; re-run the
  headless balance after modes and rules (modes multiply difficulty; Ironclad on Hard can make
  armor-only answers mandatory — check that free girls still cover it).
* Content rule: Amane's and Marina's old base outfits (and the amane-beach / marina-beach /
  nami-beach models) are swimwear — their combat kits port fine, but they need non-swimwear outfits
  before shipping on chibi bodies.
* Old water girls were land+water; switching them to `amphibious` changes what water maps teach;
  keep a few water-only placements (e.g. a water bonus) if lakes should still matter.

## Appendix — tools written (scratch only)

`scratchpad/merge/tools/`: `oldmock.mjs` (mock old backend from old shared logic + placement spot
finder), `oldbattle.mjs`, `oldsandbox.mjs`, `oldstage.mjs`, `oldlineup.mjs` (old enemy contact sheet via
a routed harness page), `newbattle.mjs`/`newbattle2.mjs` (new battle tour; `NOUP=1` for a light
defense), `newshot.mjs` (Vite with scratch cacheDir), `dump-old-enemies.mjs`, `dump-old-units.mjs`,
`dump-new-enemies.mjs`, `dump-new-units.mjs`, `dump-stages.mjs`. Pretty-printed old sources:
`scratchpad/merge/pretty/`.
