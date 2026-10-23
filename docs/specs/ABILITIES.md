# Activated abilities: one cooldown ability per girl (design spec, r2)

Sakura Sentinels, core-units workflow, written 2026-10-14. Live checkout `/home/user/sakura-game` on `claude/sakura-sentinels` at `ffc4d23` (v0.1.26). The checkout was only read, never edited. Every code claim below gives the file and line it was read from.

**Status.** This is a design spec. Nothing has been prototyped or run in the sim yet. Every number is a first-pass target, and milestone A7 (§14) measures them against the gates in §11. The sim, co-op and UI shapes follow the two in-flight specs this one must not contradict:
- **Hero rework (#168):** `docs/specs/HERO_REWORK.md` r2.
- **Chika rework (#166):** `docs/specs/CHIKA_REWORK.md` r2.

**Revision 2** resolves the critic's findings (§18 lists each one, fixed or rejected). The main changes: §5 is now the **single source of truth** for every girl's ability (live, planned and new), and UNIT_GAPS.md points here; §5.3 names the 11 new girls; owner-credited coins for co-op (§7.1); one `abil` shape that can name a target girl (§7.2); and the **Chika flight-mode addendum** (§17).

**Naming rule.** This file may be copied into the public repo. It uses our own words only. Reference games are never named here.

---

## 0. One screen

- **Single source of truth.** §5 defines the ability of every girl: the 19 live girls (§5.1), the 11 planned girls (§5.2) and the 11 new girls from UNIT_GAPS.md (§5.3). UNIT_GAPS.md names each ability and its ⚡ path but takes its numbers from here.
- **One ability per girl, on one marked path.** Every tower girl learns an **activated ability** at **tier 3 of one of her paths**. That path's header carries a ⚡ mark, and **tier 5 of the same path upgrades the ability**. The crosspath rule lets only one path go above tier 2 (`src/sim/mods.js:249-256`), so a girl can never hold two abilities, even when her data defines one on several paths (Ruri's three familiar forms use this, §5.2).
- **Short cooldowns: 20–60 s of game time.** Cooldowns tick only while a wave runs, exactly like today's hero ultimate (`src/sim/hero.js:82-86`). Waves average 23–30 s of play: on 1-1, 12 waves hold about 356 s of wave time; on 8-5, 30 waves hold about 699 s (from the hero-rework XP split, its §4.3). So a 40 s ability fires about once every 1½ waves. A fresh ability starts with **⅓ of its cooldown** left to charge. Economy abilities start empty, so they need the full cooldown first.
- **Effects that last end when the wave is cleared.** This covers boosts, rallies, shadow doubles, extra traps and extra drones. A calm point between waves therefore never holds a running ability, which keeps the battle save (#170) simple.
- **Seven effect kinds ship first:** boost, rally, strike, burst, debuff, deploy, econ (§4). **Three more come later:** move, zone, runner. They are the "unique mechanic" kinds the owner asked for (walls, pulls, path runners), and the planned and new girls need them.
- **Copies of the same girl share one button.** A tap fires the best ready copy.
- **Cooldown scope:**
  - **Local abilities** (around the girl) have **one cooldown per girl**.
  - **Map-wide abilities** have **one cooldown per player** for that ability, so three Hotarus cannot chain-silence the map.
- **Bosses and minibosses** ignore ability stuns and freezes for **4 s** after one lands.
- **Heroes have no paths after the hero rework.** They keep their ultimate (Lv 3, ranks at Lv 10 and Lv 20, as that spec says). They also gain a **quick skill at Lv 7**, which ranks up at Lv 17. Both buttons live in the hero widget; the girls' abilities live in a new **ability bar** at the bottom right.
- **Co-op:**
  - Each player fires only her own girls' abilities (and her own hero's) with a new lockstep command **`abil[uid, group, qx, qy]`**.
  - The auto-cast switch is a second command, **`acast[uid, on]`**.
  - Validation happens inside the sim at the command's tick, so a late command is refused and never double-fires.
  - `COOP_PROTOCOL` +1 (`src/online/coop/version.js:20`).
- **Determinism:**
  - Cooldowns and durations are **integer ticks**.
  - No rng is used: abilities never crit or roll chances.
  - Targets come from the existing stable selectors.
  - There are no transcendental functions apart from `Math.atan2` for facing. Co-op already swaps that through `withDetMath` (`src/core/detMath.js:205`, `:216`).
- **Auto-cast:**
  - A per-girl **Auto** switch, plus a setting **Battle → Auto-cast abilities**, default Off.
  - Auto-cast runs inside the sim, so it is lockstep-safe.
  - Phones can play with no extra taps.
- **Saves:**
  - The profile gains one settings field. There is no `SAVE_VERSION` bump (live `src/systems/save.js:13` = 2).
  - The battle save carries one small record per girl.

---

## 1. The owner's words → behaviour

> "every [unit] has a path that gives them an ability thats on a short cooldown, do you know what I mean?" (owner, Oct 14; one word replaced to keep this file free of other games' names)

| Owner's words | What the game does |
|---|---|
| "every [girl] has a path that gives them an ability" | All 16 tower girls get one ability on one ⚡ path, at tier 3, and tier 5 upgrades it. The 3 heroes keep their ult and gain a Lv 7 skill. The 11 planned girls and every new archetype girl are designed with one from the start (§5). |
| "on a short cooldown" | 20–60 s of wave time. The median is 40 s for tower abilities and 30 s for hero skills. The list is in §5. |
| (the owner wants units that are "not a big aura radius or shooting") | 7 of the 16 tower abilities are **not** "shoot harder" or "aura": Kage's shadow doubles, Suzu's trap carpet and Chika's drone surge all **deploy** things; Momo's is **econ**; Midori's **detonates** poison; Akane's and Sango's are **blast** bursts with knockback. The later move, zone and runner kinds carry the unique girls: Norika's barricade (Hold the Line), Marumi's and Kogane's road runners (Giant Strike, Clear the Road), Ruri's familiar moves and Seiran's sky dragon (§5.2, §5.3). |
| "obviously lets start pushing a lot of this other stuff first" | The plan is milestones A0–A7 (§14). The sim core and the first seven kinds come first; the kinds that need roster B3 or new girls come later. |

---

## 2. What the code has today (evidence)

| Fact | Where |
|---|---|
| **The only activated thing in battle is the hero ultimate.** It unlocks at hero level 3 (`maybeUnlockUlt`), starts half charged (`ULT_INITIAL_CHARGE` 0.5), and its cooldown ticks only in `'wave'`. | `src/sim/hero.js:36-43`, `:82-86`; `src/sim/constants.js:74` |
| The ult's damage scales with her current damage ÷ base damage. Its hit spec has no crit and `detection: true`. Tunnel enemies are immune. | `hero.js:105-130`, `:151` |
| Every tower has 3 paths × 5 tiers, built by `path(id, name, focus, tiers)` / `tier(name, cost, desc, mods)`. | `src/data/units.js:66-67` |
| **Crosspath rule:** at most 2 paths have tiers, and only 1 path goes above tier 2. | `src/sim/mods.js:249-256` |
| Stat resolution order: path tiers → hero levels → awaken passive. | `mods.js:184-200`, `:228-242` |
| **Aura buffs:** for each key (dmg, rate, range, Veil Sight, cost cut, cleanse) the strongest source wins, and a girl never buffs herself. | `src/sim/towers.js:178-211` |
| **Global rate buff:** strongest wins; it is today's only timed team buff (Luna's ult). | `src/sim/Sim.js:182-208` |
| **Step order:** spawns → grid → enemy auras → enemies → `_updateBuffs` → towers → projectiles → traps → remove dead → `tickHero` → `_checkWaveEnd` → auto-start. | `Sim.js:149-174` |
| Wave end pays income only when the difficulty has income (Nightmare has `noIncome`). | `Sim.js:447-471`, `:452`; `src/data/types.js:182` |
| Status rules: freeze, stun and shock are scaled by tier (`CC_RESIST` normal 1 / elite 1 / miniboss 0.5 / boss 0.25); frost wards block frost statuses. | `src/sim/status.js:22-64`; `constants.js:12` |
| Knockback goes along the path, scaled by `KNOCKBACK_RESIST`. | `Sim.js:342-348`; `constants.js:16` |
| `explode` hits everything in a radius through `_hit`, so a spec's knockback and statuses apply. | `towers.js:305-309` |
| **Traps:** spots inside range, nearest the exit first, never in tunnels. Placement is random from the first 4 free spots. A trap fires once and has **no expiry**. | `towers.js:506-549`, `:729-762` |
| Live drones are anchored ring turrets. The Chika rework makes them roaming sim objects (`makeDrone`). | `towers.js:551-608`; chika-rework §3.1 |
| **Co-op commands:** `place, upg, sell, tgt, ult, wave, auto, speed`. Each runs under the commanding player's view, and a command takes at most 4 arguments. | `src/online/coop/commands.js:20-21`, `:48-51`, `:110-184` |
| **Co-op coins:** a command runs with `sim.cash` set to the commanding player's wallet and writes it back after (`wallets[slot] = sim.cash`). A **step** pools both wallets, runs `sim.update`, and splits everything earned in it evenly between the connected players. So coins earned inside the step (kills, wave income, and anything auto-cast) are shared, while coins earned inside a command go to that player. | `commands.js:179-182`, `:190-202` |
| **Ownership in co-op** lives only in the command layer (`owners`, set at placement, deleted only by `sell`). | `commands.js:84`, `:98`, `:135`, `:149` |
| The co-op hash folds enemies and towers only. | `src/online/coop/simHash.js:39-48` |
| **PC keys today:** Esc, Space (start wave), F (speed), and **1–9 arm tower-bar cards**. The 1–9 card keys are not in the wiki's controls table. | `src/ui/battle/controller.js:349-367`; `src/data/wiki.js:147-156` |
| **Battle HUD layout:** hero widget bottom-left, wave control bottom-right, both at `bottom: bar-h + 12px`. The panel is a right card, or a bottom sheet at ≤ 700 px wide. Phone landscape uses `--bt-hud-h 46px`, `--bt-bar-h 76px`, a 340 px panel, a 54 px portrait and a 48 px ult. | `src/ui/styles/battle.css:5-7`, `:195`, `:215-238`, `:293-297`, `:498-520`, `:547-581` |
| Settings fields are added without a version bump: older saves get the default (the `camera` precedent). | `src/systems/save.js:28-44`, `:200-218` |
| Co-op results reach the UI through `onApplied(cmd, res)`. | `controller.js:660-675` |
| The hold gesture already exists: `HOLD_MS` 450 for cards, `BAR_HOLD_MS` 550 for the tower bar. | `wt-unit-info/src/ui/hold.js:13-14` |

---

## 3. Rules (decided here; owner questions in §16)

### 3.1 Which tier, which path

- **Unlock at tier 3, upgrade at tier 5.**
  - **Why tier 3:**
    - Tier 4 costs 2,000–4,000 coins, and 1-1 pays about 2.3k coins in the whole battle (hero-rework §4.2). With a tier-4 unlock, chapter 1 would never see an ability.
    - The cheapest abilities cost **1,140–1,400 coins in all** (placement plus tiers 1–3: Aoi 1,140, Yuki 1,250, Rei 1,400), so a chapter-1 player meets one mid-stage.
  - **What tier 4 does for the ability:** nothing beyond its own stats. Strikes scale with her current hit damage, so tier 4 makes them hit harder anyway.
  - **What tier 5 does:** it upgrades the ability with a bigger effect and a shorter cooldown. The remaining cooldown becomes `min(remaining, new full cooldown)`.
- **One ⚡ path per girl, chosen for theme, not by position.** A volley archer gets the volley path, a trapper the mine path, an income girl the income path. The ⚡ mark on the path header (panel, upgrade tree, student page) makes the rule learnable.
- **Data can declare an ability on several paths.** The crosspath rule still allows only one to unlock. Ruri uses this for her three familiar forms.

### 3.2 Charging and casting

| Rule | Value |
|---|---|
| Time base | **Integer sim ticks**: 60 per second (`STEP = 1/60`, `constants.js:4`). Co-op runs one step per lockstep tick (`commands.js:191-207`), so a tick is the same everywhere. |
| Cooldown storage | **Charge points:** 100 per tick at normal speed, so a 40 s cooldown is 240,000 points. Integer points let a later recharge-rate source (the campus-hub archetype, §5.3) subtract 115 per tick exactly, with no float drift. |
| When it charges | Only while `sim.state === 'wave'`, the same as the ult. |
| When it can be cast | Only in a wave. The refusal reason is `notWave`. |
| First charge | **⅓ of the cooldown** left when it unlocks. Econ abilities start empty. |
| Lasting effects | Each has a duration in ticks. Every lasting effect ends at the wave clear. |
| Recast while active | Refused with `active`, so a boost never stacks with itself. |
| Sabotaged girl (`disabled > 0`) | She cannot cast (`disabled`), and auto-cast skips her. Her running effects continue. |
| Sold girl | All her effects end at once: rallies, doubles, extra traps, queued shells and extra drones. |
| No valid target | Refused with `noTarget`. **The cooldown is not spent.** |
| Crits and chances | None. An ability hit has `critChance 0`, and every status it applies is certain. Outcomes are readable, and no rng is drawn. |
| Speed 2×/3× | Cooldowns are game time, so they recharge faster too. |

### 3.3 Copies, stacking and caps

| Situation | Rule |
|---|---|
| Several copies of the same girl | **One button per ability**, with a count of ready copies (×2). A tap fires one copy, chosen like this: the tapped or selected copy if she is ready; otherwise the ready copy with the most eligible enemies in her ability reach; on a tie, the lowest uid. |
| Local abilities (`scope: 'local'`) | **Each copy has its own cooldown.** Three Aois means three volleys. |
| Map-wide abilities (`scope: 'map'`) | **One cooldown per player for that ability**, stored in `sim.abilGroups` under the key `"<owner>|<abilityId>"`. Extra copies add nothing to the ability. |
| Boosts | They apply to the caster only. One running boost per girl. |
| Rallies (team buffs) | For each key the **strongest active rally wins**, counting both players' rallies, the same rule as auras. Rallies **multiply with** auras and with the global rate buff; they do not replace them. Lives from kills (Noa's First Aid Call) never add up either: a kill counts toward **one** call only, the oldest running one whose lives circle holds it (even once it has given its max), and Auto does not cast a copy standing inside a running call's lives circle (a tap still does). |
| Debuff statuses | They merge through `applyStatus`: the stronger amount and the longer time win (`status.js:45-63`). Frost wards still block frost. |
| Strikes and bursts | They stack. Two volleys are two volleys. |
| Ability stun or freeze on a miniboss or boss | `CC_RESIST` applies. After one lands, that enemy ignores **ability** stuns and freezes for `ABILITY_CC_GUARD` = 4 s; normal attacks are unaffected. In freeplay, Resolve still clips every stun and knockback, because abilities go through `applyStatus` and `_onHitEffects` like every other hit. |
| Econ cap | `econCapPerWave` = 2 casts **per player per wave**, across all copies. Not on Nightmare (`noIncome`). Codex modes' Half Income halves it as it halves income girls. |

---

## 4. Effect kinds (the sim vocabulary)

The kinds are listed in the order they ship. "Needs" names the new sim code.

| Kind | What it does | How it is built | Needs | Ships in |
|---|---|---|---|---|
| **boost** | A temporary change to the caster for N s: speed, reach, targets, jumps, statuses, even behaviour. | A ModSet in `t.abilMods`, appended **last** in `collectModSets` and re-resolved with `sim._refreshTower(t)`; it is cleared and refreshed at the end. Any contract ModSet key works (`mods.js:117-174`). | an `extra` option in `resolveStats` | A1 |
| **rally** | Team buff in a radius, or the whole map, for N s: dmg, rate, range, Veil Sight, cleanse, no sabotage. | `sim._rallies[]` `{ ownerUid, x, y, r, dmgMul, rateMul, rangeMul, detection, cleanse, ward, left }`. `recomputeBuffs` folds them into `t.rally`, strongest per key, and `refreshEffective` multiplies `buff × rally` (and the trap and turret specs). | `towers.js:126-211` edits | A1 |
| **strike** | Instant hits on N chosen enemies, possibly after a telegraph delay. | The targets come from `selectTargets` in her target mode (`towers.js:279-289`), or from a map-wide gather. The spec comes from `abilitySpec` (modelled on `ultSpec`, `hero.js:111-130`), with `damage = dmgMul × t.eff.damage` (or the trap or drone damage for trap and drone girls). Delayed hits wait in `sim._abilQueue`. | the queue | A1 |
| **burst** | Area hit at a point: the girl's own spot or the densest crowd in reach. Optional knockback and stun. | `explode()` (`towers.js:305-309`) with the ability spec. `densestPoint` is a deterministic O(k²) scan with k ≤ 60. A fixed scatter table gives multi-shell offsets (no trig). | — | A1 |
| **debuff** | Statuses on the enemies in a radius or on the whole map (reveal, silence, mark, slow, soak). | `sim._applyStatusEvent` (`Sim.js:321-326`). Map-wide debuffs ignore veils, like the ult. Tunnel enemies are immune. | — | A1 |
| **econ** | Coins now. | `sim._gainCashFor(t.owner, coins × diff.cashMul × incomeMul)` (owner-credited, §7.1), plus a `cash` event with the reason `'ability'`. Capped per player per wave. | `ownerCash` | A1 |
| **deploy** | Temporary objects: extra traps with a lifetime, extra drones, anchored "doubles" or sentries that fire from a lane spot. | **Traps:** `{ extra: true, ttl }` in `sim.traps`; `updateTraps` ages and fizzles them; they never count toward `trapCount`. **Drones:** `makeDrone(...)` + `temp: true, ttl` (Chika rework); before #166 lands, `spawnTurret` + ttl. **Doubles and sentries:** `sim.deployables[]` `{ uid, ownerUid, x, y, ttl, spec, rate, range, projectiles, cooldown }`, which fire through `spawnProjectile` (`towers.js:311`). | ttl on traps and drones; the deployables list | A4 |
| **move** | Moves enemies along the path: push back, gather or pull, grab-and-carry. | The ult's `pushBack` (`hero.js:132-137`, exported), plus roster B3's push lock and `_gather` (`wt-roster` `Sim.js:369-399`). | B3 merged | A5 |
| **zone** | A lingering area on the road: snowfield, gas cloud, barricade, gravity well. | `sim.zones[]` `{ uid, ownerUid, x, y, r, left, every, next, spec, block }`, ticked in `tickAbilities`. A `block` zone holds non-boss enemies at a path distance. | the new list | A5 |
| **runner** | Something that travels **along the road**, usually backwards from the exit: Seiran's sky dragon, Marumi's giant ball, Kogane's plow, Ruri's river wave. | `sim.runners[]` `{ uid, ownerUid, pathIndex, dist, speed, length, segments, hit: Set, left, spec, carry }`. It moves by path distance with `pointAt` (`src/sim/path.js:94-105`; the facing it reads was computed once with `atan2` when the path was built, `:42`), like enemies, so it uses no free-flight trig. Each enemy is hit once per runner. It hits only enemies on the same physical stretch: its own path, or a path that shares the stretch at a fork or join (GAPS P-17); a crossing road or overpass is ignored. A `carry` runner clamps the `dist` of the enemies in front of it. | the new list; shared-stretch table | A6 |

**Aimed abilities.** An ability may carry an aim point in the same `abil` command (`qx, qy`, quantised to 1/1024 tile as `quantize()` does, `commands.js:27-32`). In A1–A5 every ability picks its own point. A6 adds manual aim for the abilities that want it (a mortar fire mission, a barricade, a gravity well).

---

## 5. Every girl's ability

### 5.1 The 19 live girls

Notes on the tables:
- **Coins** = placement + tiers 1–3 of the ⚡ path at Normal (`units.js` costs).
- **"Hit"** = her current per-hit damage after tiers, gear and buffs (`t.eff.damage`, `towers.js:126-136`). The example value is for the girl on the ⚡ path only.
- **Reach** = the girl's range × the given factor.
- Every cooldown is in seconds of wave time.

**Towers (16)**

| Girl | ⚡ path · unlock tier (coins) | Ability | Kind · scope | Effect at tier 3 | Cooldown · lasts | Auto-cast when | Tier-5 upgrade (path tier 5) |
|---|---|---|---|---|---|---|---|
| Aoi | Rapid Volley · T3 Hawk Eye (1,140) | **Skyfall Volley** | strike · local | Up to 6 enemies within 1.5× her range (5.4 tiles at 0-3-0), picked by her target mode. Each takes 6× hit (24 at 0-3-0) and is pinned (stun 0.5 s). | 35 · instant | ≥ 4 enemies in reach, or an elite | Thousand Feathers: 12 arrows, 8× hit, 28 s |
| Rei | Whirlwind · T3 Crescent Gale (1,400) | **Hurricane Draw** | boost · self | 4 s: attack speed ×2.5, +0.6 reach, every enemy in reach is hit (`maxTargets` 99). | 30 · 4 s | ≥ 4 enemies in reach | Thousand Petal Storm: 6 s, ×3, +1.0 reach, 25 s |
| Yuki | Deep Freeze · T3 Flash Freeze (1,250) | **Whiteout** | burst · local | Every enemy within 1.5× range (4.5 tiles) is frozen 2 s (`CC_RESIST`: bosses 0.5 s; frost wards immune) and slowed 40% for 5 s. | 40 · instant | ≥ 6 enemies in reach, or one past 70% of its path | Eternal Winter: 2× range, freeze 3 s, slow 50% for 6 s, 30 s |
| Momo | Peach Orchard · T3 Peach Emporium (1,900) | **Market Day** | econ · player | +100 coins now (× difficulty coin multiplier; like her income, no stage scale). Max 2 per player per wave; none on Nightmare. | 45, starts empty · instant | As soon as ready | Golden Peach Bank: +400 coins, 40 s |
| Akane | Big Bang · T3 Cluster Bloom (1,940) | **Starmine Barrage** | burst · local | Warning rings, then 6 shells on the densest crowd within 1.5× range, one every 0.25 s from 0.5 s after the cast. Each shell: 3× hit in radius 1.2, knockback 0.3. | 40 · 2 s | ≥ 6 enemies in reach | Hanabi Sky Festival: 12 shells, 4×, also hit flyers, 32 s |
| Sango | Wide Fragmentation · T3 Fragmentation Rounds (2,000) | **Tidebreaker Shell** | burst · local | One shell on the densest crowd within 2× range: 4× hit (80 at 0-3-0) in radius 1.5, knockback 1.2 (`KNOCKBACK_RESIST`: minibosses 0.6, bosses 0), stun 0.6 s. | 40 · instant | ≥ 5 enemies in reach | Carpet Bombardment: 3 shells 0.5 s apart, each re-aimed, 35 s |
| Kage | Storm of Steel · T3 Shuriken Cyclone (1,860) | **Shadow Doubles** | deploy · local | Two shadow doubles appear at the 2 road spots nearest the exit within her range (≥ 1.5 tiles apart). For 8 s they throw her current volley at 60% damage. | 40 · 8 s | ≥ 4 enemies in reach | Thousand Shadows: 3 doubles, 75%, 10 s, 35 s |
| Umeko | Lighthouse · T3 Revealing Tide (1,750) | **Lantern Flare** | debuff + rally · map | Every veiled enemy on the map is revealed for 8 s. Girls inside her aura gain Veil Sight and +15% range for 8 s. | 40 (shared per player) · 8 s | A veiled enemy is on the map | Sea of Lanterns: reveal 12 s; aura girls +25% range and +10% damage; 32 s |
| Shiro | Execution · T3 Elite Hunter (2,290) | **Verdict Round** | strike · map | A reticle marks up to 2 enemies anywhere, in Priority order (casters, bosses, elites, then the strongest). 1.0 s later each takes 5× hit, ignoring armor (295 at 3-0-0; ×1.5 vs elites). | 45 (shared per player) · 1 s delay | An elite, miniboss, boss or caster is on the map | Cross-Map Execution: 4 targets, 6×, 35 s |
| Midori | Toxicology · T3 Wither Bloom (1,800) | **Catalyst Burst** | strike · local | Every poisoned enemy within 1.5× range takes all its remaining poison at once, ×2 (dps × time left × 2, through `_dot` so poison type and ward rules hold), and the poison ends. Enemies within 0.8 of each burst take half. | 30 · instant | ≥ 4 poisoned enemies in reach | Verdant Apocalypse: ×2.5, and each burst poisons its neighbours with her poison for 3 s; 25 s |
| Suzu | Explosive Mines · T3 Blast Mines (1,800) | **Bell Carpet** | deploy · local | 6 extra traps, armed after 0.3 s, spread evenly along the road in her range (no rng; beyond her trap limit). Each fires once; the ones still standing fizzle after 15 s. | 45 · 15 s | ≥ 6 enemies in reach | Grand Bell Detonation: 12 traps, 20 s, 35 s |
| Raika | Storm Rhythm · T3 Drum Roll (1,780) | **Drumstorm** | boost · self | 5 s: attack speed ×1.6, +2 jumps, every jolt shocks for 0.25 s. | 35 · 5 s | ≥ 4 enemies in reach | Endless Thunder: 7 s, ×2, +4 jumps, 30 s |
| Miko | Blessing · T3 Divine Favour (2,010) | **Shrine Chorus** | rally · local | Every girl within 4 tiles of her (both players' girls): +25% damage and +15% attack speed for 8 s, on top of auras. | 45 · 8 s | ≥ 6 enemies within 4 tiles of her | Goddess's Festival: 5 tiles, +35% / +25%, 10 s, 40 s |
| Hotaru | Silent Prayer · T3 Sealing Chant (2,240) | **Firefly Hush** | debuff · map | Every enemy on the map (not in tunnels) is silenced 3 s and revealed 6 s. Casters are also stunned 1 s. | 45 (shared per player) · 3 s | A caster or a veiled enemy is on the map | Absolute Stillness: silence 5 s, plus a 40% slow for 3 s; 40 s |
| Kaede | Flowing Blade · T3 Wind Severing (1,100) | **Flash Lunge** | strike · local | Her crowd path since the v0.1.41 AoE rework: she flashes through the 3 enemies her target mode picks within 2.5× her range and strikes each 2 times at full ramp: hit × (1 + ramp max) a strike, 25 at 0-3-0 (150 in all). Her ramp stays on the first. **The dash is drawn only:** the renderer shows her dashing out and back, but her sim position never changes, so she is not a moving tower (GAPS P-12). | 25 · instant | An elite or stronger in reach, or ≥ 3 enemies | Thousand Leaves Draw: 5 enemies, 3 strikes each, 20 s |
| Chika | Sentry Works · T3 Sentry Grid (2,390) | **Drone Surge** | deploy · local | 4 extra drones launch for 12 s, beyond her limit. They roam and fight like her others, follow her current flight mode (§17), then dock and vanish. **In the Drones tab** (chika-rework §7.1) they appear under a "Surge" heading as "Surge 1…4" with a live timer; they do not take a serial number (`droneSerial` is unchanged), the header shows "4 + 4 surge", and their damage counts toward Chika's drone totals (`droneDmg`, `droneKills`) but not toward any permanent drone's row. | 45 · 12 s | ≥ 5 enemies in her drone reach | Mecha-Fortress Protocol: 8 drones, 15 s, 40 s |

**Mix of kinds across the 16:**
- strike 4: Aoi, Shiro, Midori, Kaede
- burst 3: Yuki, Akane, Sango
- deploy 3: Kage, Suzu, Chika
- boost 2: Rei, Raika
- debuff 2: Umeko, Hotaru
- rally 1: Miko
- econ 1: Momo

**Heroes (3).** The hero rework removes hero paths, so a hero's ability rides her **level track**:
- **Ult:** unchanged. It unlocks at Lv 3, ranks up at Lv 10 and Lv 20, and Q fires it.
- **New skill:** it unlocks at **Lv 7** and ranks up at **Lv 17**, and E fires it.
  - The level text gains "… and unlocks {skill}". The skill adds no ModSet, so the hero rework's frozen Lv 25 `resolveStats` snapshot is unchanged.
  - Gear `ultHaste` stays ult-only.

| Hero | Skill (Lv 7) | Kind · scope | Effect | Cooldown | Rank 2 (Lv 17) | Ult (unchanged; hero rework) |
|---|---|---|---|---|---|---|
| Hikari | **Morning Rally** | rally · local | Girls within 3 tiles: +20% attack speed for 6 s. It clears sabotage now and blocks new sabotage for 6 s. | 35 | 4 tiles, +30%, 8 s, 30 s | Celestial Bloom |
| Luna | **Moonbrand** | debuff · map | The 5 strongest enemies on the map are marked for 8 s: +20% damage from everyone. | 30 | 8 enemies, +25%, 25 s | Moonfall |
| Nami | **Frost Net** | burst · local | The densest crowd in her range, radius 1.6: frozen 1.2 s and soaked 5 s. | 25 | radius 2.0, freeze 1.6 s, 21 s | Tidal Wave |

### 5.2 The 11 planned girls (roster Builder 4; first-pass numbers)

Each planned girl is designed with her ability from the start. "Coins" = placement + tiers 1–3 of the ⚡ path (ROSTER_SPEC §5.2 costs). "Needs" names the sim code that must exist first. UNIT_GAPS.md §4.1 describes the base-kit upgrades (Ruri's pet, Iroha's two origins, Hana's flier); the abilities below assume them.

| Girl | ⚡ path · T3 (coins) | Ability | Kind · scope | Effect at tier 3 | Cooldown | Tier-5 upgrade | Needs |
|---|---|---|---|---|---|---|---|
| Fuu | Returning Gale · T3 Gale Wall (1,290) | **Backdraft Fan** | move · local | Every non-boss enemy within 1.5× range is blown back 2 tiles (minibosses 1) and grounded 2 s. Push lock applies. | 40 | 3 tiles, grounded 3 s, 32 s | B3 push lock + ground; move kind (A5) |
| Hana | **Falconry** · T3 Talon Dive (1,280) | **Kaze's Swoop** | strike · map | Kaze dives on up to 4 flyers anywhere: 6× hit each, grounded 4 s. With no flyers, he takes the 2 strongest ground enemies instead. | 30 | 8 flyers, 8× hit, 25 s | B3 ground + air bonus. **Rename (Builder 4):** her roster-spec path "Sky Hunter" and tiers "Wind Reading", "Long Bow" and "Falcon Mark" repeat Aoi's live names (`units.js:395-403`); they become Falconry (Sharp Talons · Updraft Sense · Talon Dive · Raptor Strike · Sky Sovereign) and Hunter's Mark (Recurve Bow · Keen Eye · Hunter's Mark · Hunting Call · Apex Falconry). §13's name test catches any repeat |
| Ruri | **The familiar path she raises to T3** (only one can pass tier 2): Moonhound (1,780) · Star Falcon (1,700) · Tide Otter (1,860) | Moonhound → **Moon Pounce** | strike · local | Kon leaps at the strongest enemy within reach + 2: 3 bites × 8× hit, and holds it 1.5 s (`hold`, bosses immune). | 30 | 5 bites, 2 s hold, 25 s | B3 relay origin; roaming pet (P-6); `hold` (A5) |
| | | Star Falcon → **Star Snatch** | move · local | Kon carries the leading non-boss enemy 3 tiles back up the road (minibosses 1.5). | 35 | 2 enemies, 5 tiles, 30 s | move kind (A5) |
| | | Tide Otter → **River Rush** | runner · local | A wave rolls 4 tiles back along her lane: push 1 tile, soak 4 s. | 40 | 8 tiles, push 1.5, 32 s | runner kind (A6) |
| Noa | Pure Sanctuary · T3 Pure Sanctuary (1,730) | **First Aid Call** | rally · local | Girls within 4 tiles are cleansed, and immune to sabotage and stun, for 10 s. During those 10 s, every 10 kills within 3 tiles restores 1 life (max 3; never when the battle forbids healing, codex modes' `sim.canHeal()`, and never on Nightmare's one life). | 50 | 14 s, max 5 lives, 42 s | rally |
| Tsubaki | Meteor Shower · T3 Meteor Shower (1,980) | **Fire Mission** | burst (aimed) · map | 10 shells over 2.5 s on her aim point, or the densest point on the map: 3× hit each, splash 1.15, warning rings. | 45 | 18 shells, 4× hit, 38 s | B3 shells; aimed cast (A6) |
| Kohaku | Prism Corridor · T3 Prism Corridor (2,360) | **Rainbow Lattice** | boost · self | 6 s: +3 beams; her ramp is kept. | 35 | 8 s, +5 beams, 30 s | B3 beam ramp |
| Iroha | Mirror Hall · T3 Mirror Hall (2,320) | **Mirror Shift** | deploy (aimed) · local | Her mirror jumps at once to her aim point (or the road spot nearest the leader within her reach) and, for 8 s, **reflects allies' shots**: any ally projectile that crosses it splits in two, once per projectile. She keeps firing from both origins (her base kit, GAPS §4.1). | 30 | **Infinite Reflection:** the reflection is permanent; Mirror Shift adds a second mirror for 10 s; 25 s | B3 relay + aim; mirror redirect (A6) |
| Ena | Cursed Bloom · T3 Cursed Bloom (2,170) | **Omen Card** | debuff · local | Curses every enemy within 1.5× range with a burst base of 3× hit. A dense wave chain-reacts through her spread rule. Bursts go through B3's curse queue with the per-tick budget (`CURSE_BURSTS_PER_TICK` 32, FIFO spill, GAPS §4.1). | 40 | 2× range, burst 4× hit, 32 s | B3 curse spread + burst budget |
| Kanna (hero) | Lv 7 skill | **Heavy Beat** | boost · self | For 6 s her strikes crack armor −2 on everything within 1.5 of her target and stagger it 0.3 s. | 30 | Lv 17: 8 s, −3 armor, 25 s | — |
| Yoriko (hero) | Lv 7 skill | **Puppet Hex** | debuff · local | The strongest enemy within her range + 1 is **hexed** for 8 s: it loses 3% of its max HP per second (minibosses 2%, bosses 1%), cannot regenerate, and is slowed 30%. One application never takes more than 10% of a miniboss's or boss's max HP. This answers the owner's "hex hero" comparison without copying Ena's spreading curse. | 30 | Lv 17: 2 targets, 10 s, 25 s | the one `hex` status (GAPS P-15): plain arithmetic on `maxHp` in `_dot` (A5) |
| Seiran (hero) | Lv 7 skill | **Storm Lance** | strike · local | A thrown spear chains through 8 enemies, 3× hit each. Flyers it hits are grounded 3 s. | 30 | Lv 17: 12 enemies, 4× hit, 25 s | B3 ground |

**Hero ults that change shape** (they stay on the ult button; the hero rework's ult ranks at Lv 10 and Lv 20 carry these values; roster B3 writes them into its `HERO_TRACKS` entries, hero-rework §11):

| Hero | Ult | Rank 1 (Lv 3) | Rank 2 (Lv 10) | Rank 3 (Lv 20) | Needs |
|---|---|---|---|---|---|
| Seiran | **Dragonflight**, now a **sky dragon that runs the road** (runner kind) | Enters at her aim point if one is set, otherwise at the exit end, and flies **back along the road 10 tiles in 3 s**. Body of **6 segments 0.6 tiles apart**. Each enemy is hit once: **140** lightning, **grounded 5 s**, **marked +18%** for 5 s; bosses take the damage only. Cooldown 66 s (roster spec). | 14 tiles in 3.5 s, 8 segments, 200 damage, mark +22% | 18 tiles in 4 s, 10 segments, 280 damage, mark +25%; on a map with forks it follows the branch with more enemies on it (ties: the lower path index) | runner kind (A6); B3 ground and mark |
| Yoriko | **Dream Detour** (roster spec: every enemy pushed back 5 tiles, 70 damage, 50% slow 3 s; bosses resist) | + every enemy it moves is **hexed** 1%/s for 5 s | push 6 tiles, hex 5 s | push 7 tiles, hex 8 s | `tide` (live) + `hex` |

### 5.3 The 11 new girls (UNIT_GAPS.md §5)

These are the "unique tower" girls the owner asked for. Each ability is the girl's signature verb. "Coins" = placement + tiers 1–3 of the ⚡ path (UNIT_GAPS.md §5 costs). The tier names in UNIT_GAPS.md never repeat these ability names.

| Girl | ⚡ path · T3 (coins) | Ability | Kind · scope | Effect at tier 3 | Cooldown · lasts | Auto-cast when | Tier-5 upgrade | Needs |
|---|---|---|---|---|---|---|---|---|
| Yuzuha | Field Ops · T3 Tune-Up Kit (1,790) | **Emergency Deploy** | deploy (aimed) · local | 3 extra sentries with her current sentry stats drop at the road-edge spots nearest her aim point inside her range, or nearest the lead enemy. They last 20 s and ignore her sentry cap. | 40 · 20 s | ≥ 5 enemies in her range | Rapid Response: 6 sentries, 25 s, cd 30 | deploy kind (A4); lane spots |
| Azami | Checkpoint Duty · T3 Checkpoint (1,430) | **Spike Rain** | deploy · local | 12 extra strips spread evenly (by path distance) along every road stretch in her range, 8 hits each, armed after 0.3 s; they last 10 s and ignore her strip cap. | 45 · 10 s | ≥ 6 ground enemies in her range | Total Lockdown: 24 strips within 2× her range, 15 s, cd 35 | deploy kind (A4); strip record (GAPS P-3) |
| Kinu | Spinning Bobbin · T3 Thread Cutter (1,520) | **Blade Spiral** | boost · self | 4 s: on top of her rings she fires 2 blades every 0.1 s along a turning spiral (a fixed 16-step direction table), out to 2× her range: 1× hit each, pierce 3. | 25 · 4 s | ≥ 4 enemies in her range | Grand Spiral: two spirals turning opposite ways, 6 s, pierce 8, cd 20 | `spawnStraight` (GAPS P-7) |
| Ouka | Assembly · T3 Club Mentors (2,090) | **Assembly Bell** | rally · map | Every girl on the map, both players': +30% attack speed and +1 pierce for 10 s. (Her T3 passive, separate from the button: abilities of girls in her radius recharge 15% faster, 115 points per tick.) | 45 (shared per player) · 10 s | ≥ 10 enemies on the map | Festival of Clubs: +50% and +2 pierce for 15 s, cd 40; passive 25% | rally (A1); charge rate |
| Wakaba | Game Plan · T3 Coach's Eye (1,550) | **Time Out!** | rally · on one girl | The chosen girl gets ×1.8 attack speed and +20% range for 12 s. Target: the girl nearest the aim point, within 0.6 tiles, at the cast's tick (ties: lower uid); with no aim, the girl in Wakaba's range with the highest `damageDealt` (ties: lower uid). A partner's girl may be chosen. | 45 · 12 s | ≥ 6 enemies in the target's range | Star Player: also +40% damage, 15 s, cd 35 | rally centred on the girl with radius 0.5 (A1); aim (A6) for a manual pick |
| Chigusa | Greenhouse · T3 Strangler Vine (1,970) | **Overgrowth** | debuff · local | Vines **hold** up to 8 non-boss ground enemies in her range for 3 s (minibosses `CC_RESIST` 0.5 → 1.5 s; bosses immune) and deal 5× hit to each. | 35 · 3 s | ≥ 6 ground enemies in her range | Forest Corridor: 16 enemies within 2× her range, 4 s, 8× hit, cd 30 | `hold` status (A5) |
| Sorano | Firebird · T3 Fire Wings (2,160) | **Starfire Hunt** | boost · on her firebird | For 15 s her firebird's leash becomes the whole map; it hunts in her target mode at ×3 damage and ×1.5 rate, splash 0.6, then flies home. | 45 · 15 s | an elite or stronger on the map, or ≥ 8 enemies | Eternal Firebird: the firebird hunts map-wide at all times; Starfire Hunt lasts 20 s at ×4 damage and her bolts become meteors (splash 0.8) meanwhile; cd 40 | roaming body (chika-rework); boost on the turret spec |
| Marumi | Lane Master · T3 Split Pins (1,910) | **Giant Strike** | runner · local | A giant ball rolls from the road point nearest the exit inside her range, 12 tiles back toward the spawn on her nearest path, hitting every ground enemy once: 8× hit, knockback 0.6 (`KNOCKBACK_RESIST`: minibosses 0.3, bosses 0; push lock). | 40 · ~2 s | ≥ 6 ground enemies in her range | Turkey Strike: on every path in her range, all the way to the spawn, 12× hit, 6 pins at each hit, cd 30 | runner kind (A6); shared stretches (GAPS P-17) |
| Tenka | Rail Arms · T3 Plasma Rails (5,150) | **Critical Mass** | strike · local | A plasma blast on the strongest enemy in her range: 40× hit, splash 2.0, ignores armor. | 45 · instant | an elite or stronger in her range | Zero Point: 120× hit, splash 3.0, cd 30; her bolts fire ×2 faster for 6 s after each cast | strike (A1) |
| Norika | Crossing Guard · T3 Speed Bumps (1,790) | **Hold the Line** | zone (block, aimed) · local | A temporary barricade across the road at her aim point inside her range (no aim: 1.5 tiles ahead of the lead ground enemy in range) for 6 s. Non-boss ground enemies stop at it; minibosses are slowed 70%; bosses walk through and break it. On a shared stretch it blocks every path through it (GAPS P-17). | 40 · 6 s | a ground enemy past 70% of its path in her range | Road Closed: 10 s, 2 barricades 1.5 tiles apart, minibosses stop too, cd 30 | zone kind with `block` (A5) |
| Kogane | Bulldozer · T3 Site Survey (2,080) | **Clear the Road** | runner (carry) · local | The mech drives onto the road at the point nearest her and plows 5 tiles toward the spawn at 6 tiles/s, **carrying** every non-boss ground enemy in front of the blade (their `dist` is clamped behind it; minibosses are slowed 50% instead) and dealing 6× hit to each; then it walks back. Her sim position does not change; she does not fire during the plow. | 45 · ~1.5 s | ≥ 5 ground enemies in her range | Demolition Day: 12 tiles, 15× hit, carries minibosses, cd 35 | runner kind with carry (A6) |

**Removed in r2.** r1 listed abilities for families that no girl owns, and two for Momo. They are dropped: *Parade March* (constructs walking backwards; Sorano's star shades and Kogane's plow cover it), *Lock-on* (a spotter; aimed casts in A6 cover manual aim), *Collapse* (a gravity well; Tenka's wells stay a passive on her Singularity path), *Withdrawal* and *Clearance Sale* (Momo has one ability, Market Day, §5.1), *Fetch!*, *Breaching Charge* and *Mech Dash* (replaced by Ruri's three familiar abilities, Marumi's Giant Strike and Kogane's Clear the Road).

---

## 6. Sim design

### 6.1 Data (`src/data/abilities.js`, new, data only)

The file is attached in `units.js`, so it joins the co-op graph and the data hash through `UNITS`.

```js
export const ABILITY_RULES = Object.freeze({
  ticksPerSecond: 60, chargePerTick: 100, initialCharge: 1 / 3, ccGuard: 4,
  autoEvery: 6, econCapPerWave: 2, densestCap: 60,
});
export const ABILITY_KINDS = ['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'deploy', 'move', 'zone', 'runner'];
export const ABILITIES = {
  aoi: [{
    path: 'volley', unlockTier: 3,
    id: 'aoi.skyfall', name: 'Skyfall Volley', icon: 'arrows', kind: 'strike', scope: 'local',
    cooldown: 35, duration: 0,
    effect: { pick: 'mode', count: 6, reachMul: 1.5, dmgMul: 6, status: [{ type: 'stun', duration: 0.5 }] },
    auto: { when: 'enemies', min: 4, orElite: true },
    desc: 'Looses {count} arrows at enemies within {reach} tiles: {dmg} damage each and a {stun}s pin.',
    t5: { cooldown: 28, effect: { count: 12, dmgMul: 8 }, desc: 'Thousand Feathers: 12 arrows, 8× damage, recharges in 28s.' },
  }],
  // … one entry per girl (§5). Heroes: { skill: { unlockLevel: 7, …, ranks: [{ level: 17, effect, cooldownMul }] } }
};
```

- **Attaching.** `units.js` ends with `for (const u of UNITS) attachAbilities(u, ABILITIES[u.id])`. That sets a frozen `paths[k].ability` on the matching path id, and `hero.skill` for heroes. The path id is the first argument of `path()` (`units.js:67`). Inline fixtures in tests may set `paths[k].ability` themselves.
- **One edit site.** Ability data lives in its own file, so roster, balance and Potential edits to `units.js` do not conflict with ability edits.
- **Desc templates.** `{count}`, `{reach}`, `{dmg}`, `{stun}`, `{dur}` and `{cd}` are filled from the merged definition and her **current** stats. The battle panel shows live numbers; the student page shows numbers at base stats.

### 6.2 Runtime state

| Where | Field | Meaning |
|---|---|---|
| TowerRT (`createTower`, `towers.js:49-94`) | `abil: null \| { id, kind, scope, cdMax, cd, active, auto, t5 }` | `cdMax` and `cd` are in charge points; `active` is in ticks. |
| | `abilMods: null \| ModSet` | The running boost. |
| | `owner: 0` | The player slot. Co-op sets it at placement (§7). |
| Sim | `tick` | An integer step counter, incremented in `_step`. |
| | `abilGroups: Map<string, number>` | Map-scope cooldowns per player. |
| | `abilUses: [n, n]` | Econ casts per player this wave. |
| | `_rallies`, `_abilQueue`, `deployables`, `zones` (A5), `runners` (A6) | Lasting effects; all empty at a calm point. |
| | `abilityAutoDefault: [bool, bool]` | Each player's Auto setting, copied onto every ability that unlocks. |
| | `ownerCash: [n, n]` | Owner-credited coins (§7.1): econ abilities and other owner coins (GAPS P-16) add here through `sim._gainCashFor(owner, n)`. Solo has no `ownerCash` and adds straight to `sim.cash`. The co-op layer empties it into the wallets after every command and step, so it is always `[0, 0]` at a calm point and is not saved or hashed. |

### 6.3 Code changes (all in the co-op graph)

| File | Function / line | Change |
|---|---|---|
| `src/sim/abilities.js` (**new**) | — | `abilityDefAt(def, tiers, heroLevel)` merges the tier-5 or rank override by object spread, like the hero rework's `ultEffect`. `syncAbility(sim, t)` handles unlock, the tier-5 merge, the first charge and the `abilityUnlock` event. Also `tickAbilities(sim)`, `abilityStatus(sim, t)`, `castAbility(sim, t, opts)`, `setAbilityAuto(sim, t, on)`, `endAbilityWave(sim)` and `clearAbilityEffects(sim, t)`. The kind table `KINDS[kind] = { precheck, cast, end }`. Helpers: `abilitySpec(t, eff)`, `densestPoint(sim, x, y, reach, spec, r)` and `laneSpots(sim, t, n)`. |
| `src/sim/mods.js` | `collectModSets` (`:184-200`), `resolveStats` (`:228`) | A new option `extra` (a ModSet) appended **after** every other set. The hero rework's growth set and Potential come before it. |
| `src/sim/towers.js` | `createTower` (`:49-94`) | `abil: null, abilMods: null, owner: 0, rally: { dmgMul: 1, rateMul: 1, rangeMul: 1 }` |
| | `refreshTowerStats` (`:97-101`) | Passes `extra: t.abilMods`. |
| | `refreshEffective` (`:126-164`) | Multiplies in `t.rally`, also for the trap and turret specs. |
| | `recomputeBuffs` (`:178-211`) | After the aura loop: fold `sim._rallies` (strongest per key; OR for detection, cleanse and ward). Include the rally in `differs` and in `buffed`. |
| | `updateTraps` (`:729-762`) | Extra traps age by `ttl` and fizzle with a `trapExpired` event. They never touch `trapCount`. |
| | `updateTurrets` / Chika's `updateRoamingDrones` | Temporary drones age by `ttl` and are removed. |
| `src/sim/Sim.js` | constructor (`:47-128`) | `tick = 0`, `abilGroups = new Map()`, `abilUses = [0, 0]`, `_rallies = []`, `_abilQueue = []`, `deployables = []`, `abilityAutoDefault = [!!options.autoAbilities, false]` |
| | `_step` (`:149-174`) | `this.tick++` first. **`tickAbilities(this)` right after `_updateBuffs(dt)` (`:159`)**, before the tower loop, so a boost cast this tick applies this tick. |
| | `placeTower` (`:575-596`) | `syncAbility(this, t)` after `refreshTowerStats` (for fixtures that unlock at tier 0). |
| | `_refreshTower` (`:604-607`) | `syncAbility(this, t)`. This covers `upgradeTower` (`:654-666`) and hero level-ups (`hero.js:69`). |
| | `startNextWave` (`:431-445`) | `abilUses = [0, 0]`. |
| | `_checkWaveEnd` (`:447-471`) | `endAbilityWave(this)` before `state = 'between'` or `'won'`. |
| | `sellTower` (`:676-691`) | `clearAbilityEffects(this, t)` before removal. |
| | **new** `abilityStatus(uid)`, `castAbility(uid, { group, aim, owner })`, `setAbilityAuto(uid, on)`, `abilitySlots(owner)` | `abilitySlots` is for the UI only and allocates: `[{ id, name, icon, scope, casters: [uid…], ready: n, best: status }]`, in tower-bar order. |
| | `towerStats` (`:703-756`) | Adds `ability: abilityStatus`. |
| | `result()` (`:793-818`) | Adds `stats.abilitiesUsed` and `stats.abilityByTower`. |
| `src/sim/headless.js` | `runHeadless` options | `options.autoAbilities` (bots); plan action `{ action: 'ability', uid }`. |

### 6.4 One tick of `tickAbilities(sim)`

1. **Charge.** If `state === 'wave'`:
   - subtract `chargePerTick` (×1.15 inside a campus-hub radius, A5) from every positive `t.abil.cd` and every `abilGroups` value, clamping at 0. A girl's own cooldown charges `round(rate × (1 + t.rules.cdCut))`; a shared `abilGroups` entry charges `round(g.rate × (1 + cut))`, where `cut` is the largest `cdCut` among that player's living copies of the ability (a max: placement order never matters; `t.rules` is derived, so saves and checkpoints carry nothing new). The UI's seconds (`abilityStatus` `cooldown` / `cooldownLeft`) divide by the same rates;
   - emit `abilityReady` on the step a cooldown reaches 0.
2. **Expire.** Count down `active`. At 0, the kind's `end` runs: a boost clears `abilMods` and refreshes; the girl gets an `abilityEnd` event. Count down and drop expired `_rallies` (setting `_buffsDirty`), `deployables`, extra traps and extra drones.
3. **Queue.** Run `_abilQueue` entries whose `at ≤ tick`, in insertion order: delayed shells and Shiro's verdict hits. If the target died, the entry is skipped.
4. **Deployables fire.** In list order, through `bestTarget`/`selectTargets` from their own spot and `spawnProjectile`. The damage is credited to the owner girl.
5. **Auto-cast.** For girls in `sim.towers` order (placement order) whose `(tick + uid) % autoEvery === 0`: if `auto`, ready, not disabled, and the ability's `auto.when` holds (`enemies ≥ min` in reach / `elite` / `leak` past a fraction of the path / `veiled` / `caster` / `poisoned ≥ min` / `ready`), cast with `{ auto: true }`.

### 6.5 Casting

```js
castAbility(sim, t, { group = false, aim = null, owner = t.owner, auto = false }) {
  if (sim.state === 'won' || sim.state === 'lost') return no('ended');
  if (group) t = pickCaster(sim, t, owner);          // §3.3 rule; candidates sorted by uid
  const st = abilityStatus(sim, t);                    // locked / cooldown (own or group) / active / disabled / notWave / cap / noIncome
  if (!st.ready) return no(st.reason);
  const def = abilityDefAt(t.def, t.tiers, t.level);
  const fx = KINDS[def.kind].cast(sim, t, def, aim);   // null → nothing to hit
  if (!fx) return no('noTarget');                      // cooldown not spent
  t.abil.cd = t.abil.cdMax;
  if (def.scope === 'map') sim.abilGroups.set(`${owner}|${def.id}`, t.abil.cdMax);
  if (def.kind === 'econ') sim.abilUses[owner]++;
  sim.stats.abilitiesUsed = (sim.stats.abilitiesUsed || 0) + 1;
  sim._emit('ability', { towerUid: t.uid, id: def.id, kind: def.kind, auto, ...fx }); // fx: x, y, radius, targets (≤ 12 uids)
  return { ok: true, casterUid: t.uid };
}
```

**`abilitySpec(t, eff)`.** It mirrors `ultSpec` (`hero.js:111-130`) with these fields:
- `damage = eff.dmgMul × base`, where `base` is `t.eff.damage`, `t.trapSpec.damage` (Suzu) or `t.turretSpec.damage` (drone girls);
- `critChance 0`;
- `armorPen = t.eff.armorPen + (eff.armorPen ?? 0)`, or 99 for "ignores armor";
- her `eliteMul`, `bossMul` and `barrierMul`;
- `canHitAir = eff.hitsAir ?? t.eff.canHitAir`;
- `detection = scope === 'map' || t.eff.detection`;
- `status = eff.status`, `knockback = eff.knockback ?? 0`, and no mark unless the ability names one.

Hits go through `sim._hit(e, t, spec, 1)` (`Sim.js:295-319`), so the girl gets the credit, the kill, and hero XP for heroes. The CC guard check sits in the strike, burst and debuff casts: they skip stun and freeze on a guarded miniboss or boss and set `e.abilCcUntil = tick + 4 × 60`.

### 6.6 Events (renderer, audio, feed)

| Event | Payload | Used for |
|---|---|---|
| `abilityUnlock` | `towerUid, id, name` | First-time toast and coach step |
| `abilityReady` | `towerUid, id` | Slot glow; a soft chime, at most one per 1.5 s |
| `ability` | `towerUid, id, kind, auto, x, y, radius, targets[]` | Generic FX per kind, cast audio, ally chip in co-op |
| `abilityWarn` | `towerUid, id, x, y, radius, delay` | Ground warning ring before delayed shells and the verdict |
| `abilityEnd` | `towerUid, id` | Panel and bar refresh |
| `trapExpired`, `deployEnd` | `uid` | Fizzle puff |

### 6.7 Determinism

- **Integers.** Cooldowns are integer charge points and durations are integer ticks.
- **No randomness.** No `sim.rng` draw: ability hits do not crit, and their statuses are certain. Extra traps sit on evenly spaced lane spots, never at random.
- **Stable target order.** Targets come from `gatherTargets` → `selectTargets` (`towers.js:254-289`): the grid's cell order, then a stable `Array.prototype.sort`. `densestPoint` scans at most 60 candidates in that order and breaks ties by the smaller `remaining`.
- **Fixed scatter.** Multi-shell offsets come from a fixed table of literals, like roster B3's `MORTAR_SCATTER`.
- **Math.** Only `+ − × ÷`, `Math.floor`, `Math.round`, `Math.min`, `Math.max`, `Math.sqrt` and `Math.atan2` (facing only; swapped in co-op). No `**`, `pow`, `exp` or `log`: `withDetMath` covers only sin, cos, tan, atan, atan2, asin, acos and hypot (`src/core/detMath.js:205`). (The live sim already writes `** 2` for squared distances, `towers.js:490`, `:530`; new ability code writes `d * d`, and any whole-number power uses `powInt`, `src/sim/waves.js:34-48`.) Distance tests compare squared distances.
- **No view reads in the step.** Nothing inside the step reads the commanding view (`sim.heroConfig`, `sim.cash` as a wallet). Owners are read from `t.owner`, and coins for an owner go through `ownerCash` (§7.1). The hero rework's view trap and its source test (its §8.3) add `syncAbility` and its read of `sim.abilityAutoDefault[t.owner]` to their allow-list. (r2 correction: `syncAbility` does **not** run only inside commands. §6.3 hooks it into `_refreshTower`, and a hero level-up calls `_refreshTower` inside the step: `gainHeroXp` (`src/sim/hero.js:58-70`), called from `_credit`. That is still deterministic, because `abilityAutoDefault` is per-player sim state set at the start and by `acast` commands, never a view field.)
- **Hash** (`simHash.js:39-48`): it folds `t.abil.cd`, `active` and `auto` **only for girls that have an ability**, and `sim.abilGroups` entries sorted by key only when non-empty. Battles where no girl reaches a ⚡ tier 3 keep their hashes. Pinned battles with ⚡ tier-3 girls are re-pinned in A2.

---

## 7. Co-op

### 7.1 Behaviour

- **Your girls, your buttons.** You fire your own girls' abilities and your own hero's. Your ally's girls never appear in your ability bar. Tapping an ally's girl shows her ability in her panel, read-only, under today's ally note (`towerPanel.js:212-216`).
- **Team effects are shared.** Rallies and auras reach both players' girls, and the strongest rally per key wins.
- **Ally feedback.** Your ally's cast shows one small chip, at most one per 3 s ("Rin's Miko: Shrine Chorus!"), and the full FX.
- **Coins (r2).** Coins from an econ ability go to **the caster's owner**, whether the cast was manual or automatic.
  - *Why r1 was wrong:* a manual cast runs inside a command under the caster's view, so its coins land in her wallet (`commands.js:91-95`, `:179-182`). An **auto-cast** runs in `tickAbilities` inside the step, and `stepSim` splits everything earned in a step evenly between the connected players (`commands.js:190-202`). So the same ability would pay one player or both depending on how it fired.
  - *The fix:* econ casts (and every other owner coin, GAPS P-16: bounties, harvests, Tenka's economy weapon) call `sim._gainCashFor(t.owner, n)`. In co-op that adds to `sim.ownerCash[owner]`, outside the pooled `sim.cash`. `stepSim` and `apply` then do `wallets[i] += sim.ownerCash[i]; sim.ownerCash[i] = 0` for both slots, after the existing split. In solo it adds to `sim.cash` at once.
  - Today's coins are unchanged: kill rewards and wave-end income (Momo's passive income included) are still pooled and split evenly.

### 7.2 Commands (`src/online/coop/commands.js`)

| Change | Detail |
|---|---|
| `KINDS` (`:21`) | `+= 'abil', 'acast'`. Both fit the 4-argument limit (`:50`). |
| `place` (`:123-139`) | `t.owner = slot` next to `owners.set(t.uid, slot)`. This also covers heroes, whose placement is a `place` command. |
| **`abil[uid, group, qx, qy]`** (the **only** ability command) | `uid` is an integer the slot owns (otherwise `notYours`); `group` is 0 or 1; `qx, qy` are integers ≥ 0 (an aim at `qx/1024, qy/1024`) or −1 for no aim. It calls `sim.castAbility(uid, { group: group === 1, aim, owner: slot })`. The result is `{ ok, casterUid }` or `{ ok: false, reason }`, with the real reason (`cooldown`, `notWave`, `active`, `disabled`, `noTarget`, `cap`, `noIncome`, `locked`, `ended`). **Abilities that act on one girl** (Wakaba's Time Out!) take no extra argument: the sim resolves the target as **the girl nearest the aim point, within 0.6 tiles, at the command's tick; ties go to the lower uid**. No aim, or no girl there, falls back to the ability's own pick rule (§5.3). The UI aims the cast by the tapped girl's position, so a tap on a girl always selects her. |
| `stepSim` / `apply` (`:179-202`) | After the existing wallet write and step split, both move `sim.ownerCash[i]` into `wallets[i]` and zero it (§7.1). |
| `fly`, `flyB` | Chika's flight modes. Not abilities; specified in §17. |
| **`acast[uid, on]`** | `on` is 0 or 1. `uid === 0` sets every girl the slot owns (uids sorted ascending) and the slot's `abilityAutoDefault`. Any other uid must be owned. |
| `createCoopSim` (`:58-96`) | `sim.abilityAutoDefault[i] = !!players[i].autoAbil` from the start message. |
| `simHash.js` | §6.7 fold. |
| `version.js` (`:20`) | `COOP_PROTOCOL` +1 for the new commands and the new start field. Bundle it with the next forced bump (hero rework, Chika rework, freeplay). |

### 7.3 Late commands are safe

A command lands about 0.1–0.5 s after the tap, and up to 4.5 s in the hero rework's worst case. The sim re-checks readiness at the command's tick, so the late outcomes are:
- **Spent in the meantime:** an ability already fired by auto-cast is refused with `cooldown`, and nothing is spent twice.
- **Wave already over:** refused with `notWave`.
- **Group tap:** it falls back to another ready copy of the same player's.

The UI marks the slot as *pending* from the tap until `onApplied` (`controller.js:660-675`) delivers the result. A refusal toasts quietly ("Already recharging"). The client never queues a second `abil` for the same slot while one is pending.

### 7.4 Determinism gate

`e2e/engines.mjs` gets an `ABILITIES_START` scenario in `e2e/engines/scriptedBattle.js`:
- **Player 1:** Aoi 0-3-0, Akane 3-0-0, Momo 3-0-0, Hotaru 0-3-0 and Midori 3-0-0, firing a scripted `abil` every 7 s in a round robin, with some taps late enough to hit `cooldown`.
- **Player 2:** Yuki 3-0-0, Kage 3-0-0, Miko 3-0-0, Sango 0-3-0 and Suzu 3-0-0, with `acast[0, 1]` on.
- **Run:** to wave 12.
- **Pass:** one digest in V8, JavaScriptCore and SpiderMonkey.

**Owner-coins test** (`tests/online/lockstep.test.js`, r2): player 2 places Momo at Peach Orchard tier 3 with `acast[uid, 1]`; player 1 has no econ girl. Over 3 waves, every Market Day (all auto-cast, inside the step) adds exactly its coins to **player 2's** wallet and nothing to player 1's; a manual `abil` from player 2 does the same; both views give equal hashes and equal wallets.

---

## 8. UI

### 8.1 Where the ability bar sits

```
 phone 844×390 (landscape)                                  PC 1280×720
 ┌───────────────────────── HUD 46 ─────────────────────────┐  same, larger
 │                                         [feed, top-right]│
 │                                                          │
 │                                          ┌ NEXT WAVE ┐   │  wave control moves up by
 │                                          └── Auto ───┘   │  one bar row when the bar has slots
 │ (Lv7)[ULT][E][LV UP]        [⚡1][⚡2 12s][⚡3 ×2][⚡4 A] │  ← ability bar, right-aligned
 └────────────── tower bar 76 (cards: Shift+1–9) ───────────┘
   hero widget = left thumb             ability bar = right thumb
```

**Ability bar position and sizes:**

| | Phone landscape (`max-height:500px`, `min-width:701px`) | PC 1280×720 | Narrow (≤ 700 px wide) |
|---|---|---|---|
| Position | `right: 10px; bottom: calc(var(--bt-bar-h) + var(--safe-bottom) + 8px)` | `right: 14px; bottom: … + 12px` | the same |
| Slot | **44 × 44** (≥ 44 px tap target), gap 6 | 56 × 56, gap 8 | 44 × 44 |
| Slots before "+N" | 11 (844 − 10 right margin − 258 hero-row right edge − 8 gap = 568 px; 11 slots × 50 px) | 14 | 3 |
| Panel open | Slides left of the 340 px card (`right: 358px`): 4 slots + "+N" (844 − 358 − 258 − 8 = 220 px) | `right: 376px`: 9 slots | Hidden (like `.bt-herow`, `battle.css:520`); cast from the panel's ability block |
| Wave control | `bottom` + 52 px (`--bt-abar-h`). Its top lands about 178 px from the top, clear of the docked feed (`battle.css:562`) | `bottom` + 66 px | — |

The hero row is **246 px wide** with the skill button (54 + 48 + 40 + 80 + 3 × 8 gaps) and starts 12 px from the left edge (`.bt-herow { left: 12px }`, `battle.css:215`), so its **right edge is at 258 px**. The slot arithmetic above uses that right edge (r2: r1 used both numbers without saying which was which).

- **Order and slots.**
  - Slots follow **tower-bar card order** (formation order), then placement order. One slot per ability id; copies are grouped.
  - A slot appears when the first copy unlocks, and stays while any copy is on the field.
  - Overflow goes into a "+N" chip that opens a small vertical flyout.
- **Thumb reach.** In landscape the right thumb rests on the bottom-right corner, and most battles hold 2–5 abilities, so every slot is within one short reach.
- **Placing a girl.** While a card is armed, the bar fades to 35% and ignores taps (`.bt-placing .bt-abar`), so a placement tap never fires an ability.
- **Styling.** Dark glass with the tower bar's chamfered corner (`battle.css:146-153`), so it reads as part of the HUD. When the Sentinel Tactical kit lands, the bar uses `.tx-panel` / `.tx-num`; its mock already shows a 40–48 px ability bar.

### 8.2 One slot

| State | Look | Tap |
|---|---|---|
| Charging | Portrait thumb dimmed under a navy **cooldown sweep** (conic `--p`, like `.bt-ult`, `battle.css:227-238`) and mono seconds | Toast "Recharging · 12s" |
| Ready | Full colour, **yellow ready glow** (the `bt-ult` keyframes) | Fires |
| Pending (co-op) | Ring spinner | — |
| Active | A pink bar along the bottom edge drains with the remaining duration | Toast "Already active" |
| Between waves | Grey, sweep frozen, small "WAVE" label | Toast "Abilities work during waves." |
| No target / sabotaged / capped | Dim with a small "—"; a wrench icon when sabotaged | Toast with the reason |

**Badges:** the key hint (top-left), a ready count ×N (top-right), **A** when Auto is on, and a 🌐 globe for map-wide abilities.

**Input:**
- **Hold** (450 ms, the unit-info hold gesture) or **right-click** opens the **info card**: name, live description, cooldown, which girls share the slot, the **Auto** switch, and a ring on the map showing the ability's reach (`overlays.js` range circle).
- **Hover** on PC shows a title tooltip.

**Accessibility and feel:** `aria-label` "Skyfall Volley, ready" / "recharging, 12 seconds". The glow is off under reduced motion (`battle.css:596-598`). `navigator.vibrate?.(10)` on cast, like placement (`controller.js:223`).

### 8.3 Keys (PC)

| Key | Action | Change |
|---|---|---|
| **1–9** | Fire ability slot 1–9 (the group cast) | **new**; they used to arm cards |
| **Shift+1–9** | Arm tower-bar card 1–9 | **moved** from 1–9 (`controller.js:360-364`). Read from `e.code` (`Digit1`…`Digit9`, `Numpad1`…`Numpad9`), so it works on every keyboard layout. |
| Q / E | Hero ult / hero skill | Q comes from the hero rework; E is new |
| L | Buy a hero level | hero rework |
| Space, F, Esc | unchanged | — |

Keys do nothing while paused (`!ctx.paused`, like today's handlers). The wiki controls table (`wiki.js:147-156`) gains these rows; the old card keys were never listed.

### 8.4 The selected girl's panel (`towerPanel.js`)

- **Ability block.** It sits under the header, **before Target**. On a phone (332 px tall) it stays on screen without scrolling, at about 44 px collapsed.

  ```
  ⚡ Skyfall Volley                     [ FIRE ]   (or [ 12s ] / [ ACTIVE 3s ])
  6 arrows · 24 dmg · pins 0.5s · 5.4 tiles · 35s           Auto [■]
  ```

  - FIRE calls `ctx.act.ability(uid)`: `sim.castAbility` in solo, `abil[uid, 0, -1, -1]` in co-op.
  - Auto calls `ctx.act.abilityAuto(uid, on)`.
  - The panel's `signature()` (`towerPanel.js:44-50`) gains the ability state, bucketed to whole seconds.
- **Locked ability.** The ⚡ path's header gets a lightning chip. Its tier-3 row reads "⚡ T3 Hawk Eye — unlocks **Skyfall Volley**: …", and its tier-5 row reads "⚡+ …". Players see the ability before they buy it.
- **Ally's girl.** The block is shown without buttons.
- **Heroes.** The hero block (the hero rework's §10.3) gains a skill row like the ult row, and the widget gains a 40 px skill button between the ult and the Level-up pill.

### 8.5 Feed, banners, audio, FX

- **First unlock** of each ability in a battle: toast "**Aoi learned Skyfall Volley!** Tap ⚡ (bottom right) to fire it." In the tutorial battle the story WIP may add a coach step on the first unlock.
- **Your cast:** no toast (the FX speaks). **Ally cast:** a chip (§7.1).
- **Audio:** a cue per kind (`ability.strike`, `ability.burst`, …) and a soft `ability.ready` chime, throttled.
- **Renderer, generic FX per kind:**
  - burst: ring + shake;
  - strike: lines from the girl;
  - rally: a rising glow ring on the buffed girls;
  - debuff: a status pulse over the targets;
  - deploy: a spawn-in puff;
  - econ: a coin fountain.
  - Warning rings for `abilityWarn`.
  - Bespoke looks can come later from the attack-FX branch.

### 8.6 Settings and auto-cast

- **Setting:** Battle → **Auto-cast abilities** (Off / On), default **Off**. Helper text: "Girls fire their abilities by themselves when it's a good moment. You can still tap them, and switch Auto per girl by holding her button."
- **Solo:** `setup.js` passes `options.autoAbilities`.
- **Co-op:** the start message carries each player's value (`autoAbil`).
- **Per girl:** the switch overrides the default.
- **Auto rules:** each ability's `auto.when` (§6.4) is tuned to be decent, not perfect. Manual timing is still better: casting before a bunched crowd, or saving a freeze for the leak.

---

## 9. Saves

| Store | Change |
|---|---|
| **Profile** (`src/systems/save.js`) | `DEFAULT_SETTINGS.autoCastAbilities: false`, normalised with `bool()` in the settings cleaner (`:200-218`). No `SAVE_VERSION` bump: an old save gets the default, as `camera` did (`:43`, `:217`). Nothing else is stored. |
| **Battle save** (#170, `wt-battlesave/src/ui/battle/snapshot.js:72-100`) | Calm points have no running effects (§3.2), so the snapshot only needs per-girl `abil: [cd, auto, t5]` and the sim's `abilGroups` entries. `KNOWN_TOWER_KEYS` (classification used by the save's key-guard test): `abil: 'snap'`, `abilMods: 'calm'`, `rally: 'derived'`, `owner: 'config'` (solo is always 0). `KNOWN_SIM_KEYS`: `tick: 'snap'`, `abilGroups: 'snap'`, `abilUses: 'calm'`, `_rallies / _abilQueue / deployables / zones / runners: 'calm'`, `ownerCash: 'calm'` (always `[0, 0]` after the co-op flush), `abilityAutoDefault: 'config'`. Chika's flight-mode field `fly` is `'snap'` (§17). Restore puts `cd` and `auto` back after the tier loop has unlocked the ability. Whichever branch lands second makes the edit, and the key guard test forces it. |
| **Co-op** | Nothing is saved. Rejoin and resync replay the command log. |

---

## 10. Copy: wiki, student page, tips

**Wiki: new article "Abilities"** (basics group, linked from Controls):
- At tier 3 of one path, marked ⚡, every girl learns an **ability**: a button with a short recharge. Tier 5 of that path makes it stronger and recharge faster.
- Abilities recharge only while a wave is running, and can be used only during a wave. Effects that last end when the wave is cleared.
- Tap the girl's button in the ability bar (bottom right), or press 1–9. Hold the button to read what it does and to switch on **Auto**.
- Several copies of the same girl share one button; each tap fires the next one that is ready. Map-wide abilities (globe badge) recharge once per player.
- Heroes unlock their ultimate at Lv 3 and a quick skill at Lv 7.
- Bosses and minibosses shrug off ability stuns and freezes for 4 seconds after one lands.
- Co-op: you fire your own girls' abilities; your rallies also help your ally's girls.

**Controls table** (`wiki.js:147-156`), new rows:
- Fire an ability · Ability bar button · 1–9
- Ability info / Auto · Hold the button · Right-click
- Arm a card · Tap the card · Shift+1–9
- Hero skill · Skill button · E

**Student page / unit sheet:**
- A ⚡ block on the Info tab: name, base-stat description, cooldown, unlock tier, tier-5 upgrade.
- The ⚡ mark on the path in the Tree tab.
- Unit-info WIP: `treeModel` adds `ability` to the tier-3 node and the tier-5 node. Its Self / Allies / Enemies tag comes from the kind: boost → Self; rally → Allies; econ → Coins; everything else → Enemies.

**Tips.** Each girl gains a 4th tip, which the data test allows (2–4 tips, `tests/data/units.test.js:278-280`). For example, Aoi: "⚡ Rapid Volley tier 3 teaches Skyfall Volley: an arrow rain that pins the front of a wave."

**Results.** A line "Abilities used: 14" and a per-girl count in the damage list (`stats.abilityByTower`).

---

## 11. Balance method and gates

**Power budget.**
- **Local abilities:** used by auto-cast over 120 s of a wave, the ability adds **≤ +35%** to the girl's own output at her ⚡ tier-3 build and at tier 5 (with her best 2-tier crosspath).
- **Specialists against their specialty:** up to **+60%**. Shiro and Kaede against elites and bosses; Midori against poisoned crowds.
- **Control abilities** (freeze, silence, knockback) are bounded by enemy-seconds held. They must not keep a boss wave held for longer than today's best control build does.

**Benches** (A7; new `tools/abilityBench.mjs`; the hero rework's in-sim crowd and single-target bench, its §5.3):
- **Scenario:** stage 4-5, a column of 10 ground enemies along 2 tiles of road (1e9 HP), and one lone boss; 120 s each; auto-cast On vs Off.
- **Gates:**
  - crowd gain ≤ 1.35×;
  - single-target gain ≤ 1.35× (specialists ≤ 1.6×);
  - control share ≤ today's best (Nami Undertow / Yuki Permafrost).

**Campaign:**
- `BALANCE=abilities npx vitest run tests/integration/balance.test.js` runs the F2P bot with `autoAbilities` on and off. It records the headroom per stage.
- The Easy gate stays at all wins. Normal's win set must include today's.
- The economy line records Market Day coins per stage.
- Owner sign-off comes with the table.

**Knobs (all data):** each ability's `dmgMul`, `count`, `duration` and `cooldown`; `ABILITY_RULES.ccGuard`; `econCapPerWave`; the tier-5 overrides.

---

## 12. Interplay with in-flight work

| Work | Interaction | What to do |
|---|---|---|
| **Hero rework (#168)** | Heroes have no paths, so their abilities are the ult (Lv 3, ranks 10/20) plus the Lv 7 skill (§5.1). `sim.heroes[]` and the view trap apply. Hero XP comes from ability damage through `_credit`. | The skill is data on `hero.skill`; the Lv 7 level text gets "unlocks {skill}"; the Lv 25 snapshot is unchanged. The hero widget adds the skill button and the E key. The hero rework lands first. |
| **Chika rework (#166)** + owner decision 1 (flight modes) | Drone Surge's extra drones come from `makeDrone` plus `ttl`. **Flight modes are not abilities.** They are a lasting per-girl setting like the target mode, in her panel and not in the ability bar. Temporary drones follow her current mode. | **The flight-mode addendum is §17** (commands `fly` + `flyB`, follow-your-taps, map-wide hunt, deterministic patrol, benchmark and balance re-run). It is merged into chika-rework SPEC as its §3.8 when that spec is next revised. This spec also needs `ttl` and `temp` on the drone record (battle save: never at calm). Before #166 lands, Drone Surge uses anchored `spawnTurret` plus `ttl`. |
| **Roster B3 / Builder 4** | The planned girls' abilities need relay, ground, curse, shells, push lock and gather (§5.2). Knockback from abilities goes through `_onHitEffects`, so B3's push lock covers it. The B3 `aim` command (mortar, mirror) is separate from `abil`'s aim. | Builder 4 writes each girl's `ABILITIES` entry. Move kind waits for B3's push lock and gather (A5). |
| **Codex modes (#169)** | Half Income halves Market Day. Festival Encore keeps recharging only the hero **ult** (its text). Last Petal: Noa's First Aid Call respects `sim.canHeal()`. Blizzard and Heat Mirage range changes scale ability reach through her range. | No change to their spec. Recharging every ability on Festival Encore would be a one-line option, left for the owner. |
| **Co-op freeplay** | Resolve clips ability stuns and knockback like any other (`applyStatus`, `_onHitEffects`, `pushBack`). Market Day follows Momo's income rules past the goal. | Re-run the freeplay bot with `autoAbilities` in A7. |
| **Battle save (#170)** | §9 keys. | The second branch to land makes the edit. |
| **Unit info (#152)** | Tree nodes, ⚡ marks, tags; the hold gesture is reused for the slot info card. | §8.2, §10. |
| **Potential (#165)** | A P-step could read "abilities recharge 5% faster" through `chargePerTick` (integer 105). | Optional; the owner decides later. |
| **Fantasy ⇄ School kit toggle (#126)** | A kit that swaps paths must declare its own ⚡ path and ability. | A data test (§13) checks that every kit variant has exactly one ⚡ path. |
| **Sentinel Tactical UI kit** | The ability bar is in its mock. | Restyle with `.tx-*` when the kit lands; the layout here does not change. |
| **Sandbox (#175)** | Abilities work as usual. | A "Reset cooldowns" button is a sandbox feature, not this spec's. |

---

## 13. Tests

| Level | File | What it checks |
|---|---|---|
| **Data** | `tests/data/abilities.test.js` (new) | Every tower has exactly one ⚡ path (Ruri up to three, one per familiar path). `unlockTier` is 3. Each ability's `kind` is in `ABILITY_KINDS` and its `scope` is `local`, `map` or `player`. Cooldown is in [20, 60]; hero skills are in [20, 45]. The tier-5 cooldown is ≤ the tier-3 one. Every `auto.when` is valid. Every desc template fills with no `{…}` left over. Names are unique and absent from every path, tier, title and enemy name. **Path and tier names are unique across girls too** (r2: this catches the planned Hana's roster-spec names, which repeated Aoi's "Sky Hunter", "Wind Reading", "Long Bow" and "Falcon Mark"). No words from other games appear (a grep list kept in the test). Heroes have `skill.unlockLevel` 7 and ranks in (7, 25]. Kit variants have one ⚡ path each. |
| **Sim** | `tests/sim/abilities.test.js` (new) | **Unlock:** at tier 3 → an `abilityUnlock` event and `cd = ⅓ cdMax` (econ: full); tier 5 → merged effect and `cd = min`. **Charging:** only in waves (frozen in `between`). Every refusal reason. A `noTarget` refusal keeps the cooldown. **Each kind:** a boost raises then restores stats **exactly** (deep-equal `t.eff` before and after); a rally is strongest-wins and multiplies with an aura; a strike's count, target mode and damage scale; a burst's radius, knockback and `KNOCKBACK_RESIST`; a debuff respects wards and the CC guard (4 s); econ cap and `noIncome`; deploy ttl (extra traps never touch `trapCount`; doubles fire and credit the owner). **Wave end** clears everything. **Selling** mid-effect clears her effects. **Group cast** picks a deterministic copy. **Map scope** shares a cooldown per owner. **Auto-cast:** each `when` fires and the `autoEvery` stagger holds. |
| **Sim, golden** | the same file | With every ability unused and auto off, a battle is **bit-identical in damage, kills, lives and cash** to today's on 1-3, 4-5 and 8-5, ⚡ tier-3 girls included. `hashSim` is unchanged on battles without a ⚡ tier 3. |
| **Mods** | `tests/sim/mods.test.js` | `resolveStats(..., { extra })` applies the set last. |
| **Co-op** | `tests/online/lockstep.test.js` | The owner-coins test (§7.4): auto-cast and manual Market Day credit only the owner's wallet. A girl-targeted `abil` resolves the girl nearest the aim point (≤ 0.6 tiles, ties to the lower uid) identically on both views, and falls back to the pick rule with no girl there. `abil` from the owner and from a non-owner (`notYours`). A delayed `abil` after an auto-cast is refused with `cooldown`, and nothing is spent. Group fallback. `abil` landing after the wave clear is refused with `notWave`. `acast[0, 1]` sets every owned girl. Start `autoAbil` defaults. **Two views give equal hashes through 10 waves.** `COOP_PROTOCOL` is bumped. |
| **Engines** | `e2e/engines.mjs` + `e2e/engines/scriptedBattle.js` `ABILITIES_START` | `BUN=/root/.bun/bin/bun node e2e/engines.mjs`: V8 = JSC. `--require-all` adds Firefox and WebKit, giving one digest in all three. `tests/online/engines.test.js` asserts that the scenario casts ≥ 30 abilities of ≥ 6 kinds. |
| **UI** | `tests/battle-ui/abilityBar.test.js` (new) | Slots appear on unlock, in card order, grouped with counts. Sweep and seconds labels. Ready, pending, active and between-wave states. 1–9 fire slots and Shift+1–9 arm cards. Hold opens the info card and the Auto switch. The panel's ability block, and the locked ⚡ teaser. Ally girls are never in the bar. The bar fades while placing. |
| **Battle save** | `tests/battle-ui/snapshot.test.js` (after #170) | Round trip with a charging ability and Auto on. Key-guard tables updated. |
| **Balance** | `tests/integration/balance.test.js` | `BALANCE=abilities` (§11). The Easy gate holds with auto on. |
| **e2e** | `e2e/abilities.mjs` (new; Playwright, 844×390 and 1280×720) | Stage 1-2. `window.__battle.sim.cash = 1e6` (the `e2e/stat-display.mjs:49-52` hook). Place Aoi and buy Rapid Volley to tier 3 → the slot appears with an unlock toast. Start a wave → the slot charges → tap → `ability` event, the cooldown restarts and enemies are pinned. Key 1 fires on PC; Shift+1 arms the first card. Hold → info card → Auto on → it fires by itself. Screenshots: the bar with the panel closed and open, the info card, the ⚡ teaser in the panel, the hero widget with the skill. In co-op (`e2e/online.mjs`, two tabs) the guest fires an ability, the host sees the chip, and hashes stay equal. |

---

## 14. Milestones

Each milestone ends with vitest and the build green, and one logical commit. A1 and A2 change the co-op sim id: ship them with the next forced bump.

| # | Scope | Done when |
|---|---|---|
| **A0** | `src/data/abilities.js` (16 towers + 3 hero skills), the `attachAbilities` hook in `units.js`, tips, and the data tests | The data tests are green. No behaviour change: the golden hashes are unchanged. |
| **A1** | Sim core: state, tick counter, `syncAbility`, charging, casting, refusal reasons, group and map-scope rules, the CC guard, wave end and selling; the kinds **boost, rally, strike, burst, debuff, econ**; owner-credited coins (`ownerCash`, `_gainCashFor`); auto-cast; `headless` `autoAbilities`; events; `towerStats` / `result` fields | The sim and mods tests and the golden test pass. The bench in §11 runs (numbers recorded; gates may still be red). |
| **A2** | Co-op: `abil` (with the girl-target rule), `acast`, `t.owner`, the `ownerCash` flush in `apply` and `stepSim`, start `autoAbil`, hash fold, protocol bump; the engines scenario | Lockstep tests pass, the owner-coins test included. One engine digest in V8, JSC and SpiderMonkey. |
| **A3** | UI: ability bar (both viewports, panel shift, "+N"), slot states, keys (1–9 and Shift+1–9), hold info card, panel block and ⚡ teaser, the settings toggle, feed and audio, generic FX, wiki article and controls rows, student page ⚡ block. The hero skill button lands after hero-rework M3. | UI tests pass. `e2e/abilities.mjs` passes and its screenshots are reviewed at both sizes. |
| **A4** | **deploy** kind: Suzu's extra traps with a lifetime, Kage's doubles (`deployables`), Chika's Drone Surge (anchored, then roaming after #166); battle-save keys (after #170) | Deploy tests pass. Split-run save equality holds with doubles and extra traps expired at the wave end. |
| **A5** | **move** and **zone** kinds plus the `hex` and `hold` statuses: Fuu's Backdraft Fan, Ruri's Moon Pounce and Star Snatch, Yoriko's Puppet Hex, and, as each new girl lands, Chigusa's Overgrowth and Norika's Hold the Line. Ena's curse-burst budget (`CURSE_BURSTS_PER_TICK`). Lands with roster B3 (push lock, gather, curse) and Builder 4's data. | Their tests pass. Freeplay Resolve still clips ability stuns and knockback (test). 300 cursed enemies dying in one tick resolve over several ticks in FIFO order, identically in V8 and JSC. |
| **A6** | **Aimed casts** (the `qx, qy` path plus a UI aim mode: Tsubaki, Iroha, Yuzuha, Norika, Wakaba's target pick); the **runner** kind with segments, carry and shared stretches (Seiran's sky-dragon ult ranks 1–3, Ruri's River Rush, and, as they land, Marumi's Giant Strike and Kogane's Clear the Road); **mirror redirect** (Iroha's Mirror Shift and Infinite Reflection) | Runner tests pass: path-distance motion, one hit per enemy, shared stretches hit and crossings ignored, carry clamps `dist`, deterministic. The engines digest is re-run. |
| **A7** | Balance pass (§11); owner sign-off with the tables | The gates are green. The numbers go into `docs/BALANCE.md`. |
| A8 | Docs: CONTRACTS §3 (abilities in UnitDef / HeroDef), §6 (Sim API, events), §10 (ability bar), §13 (co-op `abil` / `acast`); `docs/ROSTER.md`; `OWNER_REQUESTS.md` row | — |
| per girl | Each planned or new girl ships her `ABILITIES` entry (§5.2, §5.3) **with her own build**, in the milestone that adds her kind (A1, A4, A5 or A6). Builder 4 writes the planned 11. | The data test (§13) passes for her. |

**Order with other work:** hero rework M1–M2 → A0–A2 → A3 (hero skill button after hero-rework M3) → Chika rework + flight modes (§17, F0–F3) → A4 → roster B3 + Builder 4 → A5 → A6. A0–A3 do not depend on the roster. UNITS_BACKLOG.md places all of this after the work already in flight.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Power creep: the campaign gets easier on top of the hero rework | Auto off is today's game. The bench gates (§11). A7 measures with auto on. Every number is data. |
| Phone clutter | Copies are grouped. The bar stays to the right of the hero row and fades while placing. The panel holds a cast button. Auto-cast covers players who do not want to manage the bar. |
| Moving the card keys to Shift+1–9 surprises PC players | The card keys were never documented (`wiki.js:147-156`). The wiki row and the first-unlock toast say it. Owner question 2 offers the reverse mapping. |
| Chain control (perma-freeze, perma-silence) | Map scope shares a cooldown. The CC guard (4 s) on minibosses and bosses. `CC_RESIST`. Resolve in freeplay. |
| Co-op command lag makes taps feel slow | A pending state on the slot. Late casts are refused safely and never double-fire. Rallies help both players. |
| Desync from a view-dependent read | `t.owner` instead of the view. The hero rework's view trap and allow-list. A hash fold on ability state. A two-view test and the engines digest. |
| Merge conflicts in `towers.js`, `Sim.js`, `units.js` | Ability data lives in its own file. The code is in contiguous blocks (`createTower` fields, the `recomputeBuffs` fold, one line in `_step`). The hero rework, Chika rework and B3 collision lines are listed in §12. |
| Content cost (19 + 11 + new girls × FX and audio) | Generic FX and audio per kind ship in A3. Bespoke looks are optional later work for the attack-FX branch. |

---

## 16. Owner questions (each has a default; none blocks A0–A2)

1. **Unlock at tier 3 or tier 4?** Default **tier 3**: chapter-1 players meet abilities, since 1-1 pays about 2.3k coins and the cheapest ability costs 1,140 in all. Tier 4 would match a slower, late-game feel but hides the feature until chapter 2–3.
2. **PC keys: abilities on 1–9, cards on Shift+1–9?** Default **yes**. The alternative keeps cards on 1–9 and puts abilities on Shift+1–9.
3. **Auto-cast default:** Default **Off**, with the setting and a per-girl switch. On would suit phones but hides the new buttons' timing skill.
4. **Hero skill at Lv 7** (plus the ult, as now)? Default **yes**. It gives heroes a short-cooldown button like the girls'.
5. **Copies share one button** (tap = next ready copy)? Default **yes**. The alternative is one button per placed girl, which is more control but a cluttered phone bar.
6. **Momo's ability** (r2: she has exactly **one**; r1's other ideas, the vault, Withdrawal and Clearance Sale, are dropped): **coins now** (Market Day, default) or **"Flash Sale"** (girls in her aura upgrade 20% cheaper for 10 s)? Coins is simpler and answers the owner's "money" request. Flash Sale fits her discount path and avoids a new cash source.
7. **Chika's flight modes (§17): all five from placement?** Default **yes**: she works like the attack-helicopter unit from the start, and upgrades keep adding leash, drones and support. The alternative unlocks Hunt at Sentry Works tier 3.

---

## 17. Addendum: Chika's flight modes (owner decision 1)

The owner approved the Chika rework's boss buff ("strong is fine") and asked that she operate like the big tower-defense games' **attack helicopter**: a unit that moves around the map, with movement modes the player picks. chika-rework SPEC r2 makes her drones roam, but only within 4.0 tiles of her (its §0), and lists "patrol her whole nearest lane" only as an unbuilt option (its Q3). This addendum specifies the modes. It is merged into chika-rework SPEC as its §3.8 when that spec is next revised.

**Flight modes are not abilities.** They are a lasting per-girl setting, like the target mode, in her panel and not in the ability bar.

### 17.1 The five modes

| Mode | Chip | Anchor (centre of the drones' roam disc) | Leash | How the player sets it |
|---|---|---|---|---|
| **Guard** (default) | GUARD | Chika | r2's leash: 4.0 tiles (Sentry Grid 4.25, Mecha-Fortress 4.75, Storm Battery +0.25) | tap the chip |
| **Hold** | HOLD | a point the player picks, anywhere in the map's bounds | the same leash | tap the chip, then tap the map once |
| **Follow** | FOLLOW | the last point the player tapped while Follow is on (§17.2) | the same leash | tap the chip; while she is selected, each tap on open ground moves the anchor |
| **Hunt** | HUNT | none | **the whole map** | tap the chip |
| **Patrol** | PATROL | moves back and forth between A and B (§17.3) | the same leash | tap the chip, then tap A, then B |

- **No new movement code.** Drones already fly at r2's speed (3.5 tiles/s, 4.5 at Sentry 5), and a drone outside its roam disc flies "straight back to the disc's edge" (chika-rework §3.2, step 4). Changing the anchor only moves the disc; the drones follow at their own speed.
- **Targeting** inside the disc is r2's (focus on Strong and Elite, spread on First, Last and Close).
- **Home** is still next to Chika in every mode. Between waves the drones fly home, as in r2, so battle save's calm point is unchanged.
- Drone Surge's temporary drones (§5.1) follow the current mode.

### 17.2 Follow, defined for lockstep

Streaming the cursor into lockstep is not viable: every command is a network message and lands 0.1–0.5 s later. So **Follow means "fly to the last point you tapped"**:
- While Chika is selected and FOLLOW is lit, a tap on open ground (not a girl, a drone, an enemy or a card; tap priority is in WHAT_ELSE §1.4) sends one `fly[uid, 2, qx, qy]`.
- Dragging on open ground sends at most **4 commands per second**, and only after the finger has moved at least 0.5 tiles from the last point sent. On PC, right-click on the map does the same.
- The limiter lives in `coopActions` (`controller.js`), which keeps the room's message budget (`src/data/coop.js:41-46`). Solo calls the sim directly and uses the same limiter, so both feel the same.

### 17.3 Patrol, deterministic

- State: `t.fly = { mode: 4, ax, ay, bx, by, since }`, where `since` is `sim.tick` when the command applied.
- Length `D = sqrt((bx − ax)² + (by − ay)²)`, written with multiplication. Period in steps: `P = 2 × max(1, Math.round(D / PATROL_SPEED / STEP))`, with `PATROL_SPEED` = 2.5 tiles/s.
- Phase: `k = (tick − since) % P`; `f = k ≤ P/2 ? 2k/P : 2 − 2k/P`; anchor = A + (B − A) × f.
- Only `+ − × ÷`, `Math.round` and `Math.sqrt`: no trig, no rng, no timers.

### 17.4 Hunt

- The leash is infinite: r2's step 2 never drops a quarry for distance, and step 4 never pulls a drone back to a disc.
- The **target pool** is built from every live enemy instead of a grid query: the same `topTargets` insertion (O(N·k), no sort, no allocation) and the same 4-step reuse. In her target mode **First** means the enemy nearest its exit, as live First does, so the wing chases the leaders anywhere on the map.
- Sappers keep r2's rule (girls first; a drone is jammed only when no girl is in a sapper's reach). A drone hunting deep inside a wave is more exposed; that is the counterplay.

### 17.5 Commands (`src/online/coop/commands.js`)

| Command | Detail |
|---|---|
| **`fly[uid, mode, qx, qy]`** | `mode`: 0 Guard, 1 Hold, 2 Follow, 3 Hunt, 4 Patrol. `qx, qy`: the anchor for Hold and Follow, point A for Patrol; −1 for Guard and Hunt. Quantised like `place`. Checks: `ownsTower` (else `notYours`); the girl has roaming drones, `turretSpec.leash > 0` (else `noDrones`); `mode` in range (else `invalid`); the point inside `sim.placement.inBounds` (else `bounds`). Calls `sim.setFlight(uid, mode, x, y)`. |
| **`flyB[uid, qx, qy]`** | Stores patrol point B without changing the mode. The UI always sends `flyB` **before** `fly[uid, 4, …]` in the same frame; a player's commands apply in order, so B is set first. A patrol that starts with no B patrols between A and Chika. |

- **Why two commands:** a patrol needs the uid, the mode and two points, which is six arguments, and `isValidCmd` allows at most 4 (`commands.js:50`).
- Both kinds join `KINDS` (`:21`). `COOP_PROTOCOL` +1, bundled with A2's bump.
- Solo calls `sim.setFlight` and `sim.setPatrolB` directly.

### 17.6 State, hash and save

- `t.fly: null | { mode, ax, ay, bx, by, since }`; `null` is Guard. Quantised coordinates are exact multiples of 1/1024, so they round-trip exactly through JSON.
- `hashSim` folds `t.fly` only when it is not null, so Guard battles and battles without drones keep their r2 hashes.
- Battle save: `fly: 'snap'`. The patrol phase depends on `sim.tick`, which §9 already snapshots.
- Selling Chika removes her mode with her.

### 17.7 UI

- Five chips, **GUARD · HOLD · FOLLOW · HUNT · PATROL**, in a row under Target in her panel (chika-rework §7.1 layout; one more 28 px row). The tactical kit draws them as `.tx-chip` (WHAT_ELSE §3.10).
- Hold and Patrol enter a pick mode with a toast: "Tap where the drones should hold" / "Tap patrol point A, then B". Esc or a second tap on the chip cancels.
- On the map: r2's dashed cyan roam ring is centred on the anchor; Patrol shows bracket pins at A and B joined by a dotted line; Follow shows a small chevron at the last point.
- An ally's Chika shows her chips read-only.

### 17.8 Balance and performance

- **Balance:** re-run chika-rework §8.3–§8.7 with the approved boss buff, once per mode. Record the numbers; strength is approved. One guard rail: Chika alone at tiers 0–2 must not clear a chapter 1–2 Normal stage that today needs three or more girls; if Hunt does, the knob is `HUNT_DMG_MUL` (drone damage in Hunt, default 1.0).
- **Performance:** chika-rework §8.8's method with **6 Chikas at 5-0-2 in Hunt** (60 drones, map-wide pools) and about 2,345 live enemies. Gate: mean µs per step no more than 10% above r2's kit in V8 and JavaScriptCore.
- **Determinism:** extend chika-rework's `exp2/det2.mjs`: on 4-5 Hard and 6-5 Normal, change mode every 10 s through all five, patrol between points with odd coordinates, and send Follow commands at 4 per second. Gate: one digest in V8, JavaScriptCore and SpiderMonkey. The engines script gets a `FLIGHT_START` scenario.

### 17.9 Milestones (after chika-rework M0–M2)

| # | Scope | Done when | Effort |
|---|---|---|---|
| F0 | Sim: `t.fly`, the anchor function, the Hunt pool, the patrol phase, `setFlight` / `setPatrolB`, hash fold, save key | Sim tests: each mode's anchor; the patrol phase is exact over 10 periods; Hunt never drops a quarry for distance; Guard battles keep r2's hashes | S |
| F1 | Co-op `fly` / `flyB`, the rate limiter, the engines scenario | Two-view lockstep test; one digest in three engines | S |
| F2 | UI: chips, pick modes, overlays, Follow taps and right-click, tap priority | Battle-UI tests; e2e at 844×390 and 1280×720 | M |
| F3 | Balance and performance re-run; owner sign-off | Numbers recorded; the performance gate is green | S |

---

## 18. Critic resolution (r2)

| # | Finding | Status | What changed |
|---|---|---|---|
| H1 | GAPS and this spec used incompatible ability rules and names | **Fixed** | §5 is the single source of truth (§0). §5.2 and §5.3 now cover every planned and new girl by name, with the ⚡ path and its tier-3 coins, and GAPS points here. Orphan rows (Parade March, Lock-on, Collapse, Withdrawal, Fetch!, Breaching Charge, Mech Dash) are removed (§5.3) |
| H2 | No spec for Chika's flight modes; `fly` could not carry a patrol | **Fixed** | §17: `fly` + `flyB`, follow-your-taps at most 4 per second, map-wide Hunt, a deterministic patrol, the benchmark at freeplay density and the §8 balance re-run |
| M1 | Auto-cast coins went to both wallets | **Fixed** | Owner-credited coins (`ownerCash`, §6.2, §7.1, §7.2) and the owner-coins lockstep test (§7.4, §13) |
| M2 | `abil` could not name a target girl | **Fixed** | One shape; the girl nearest the aim point within 0.6 tiles, ties to the lower uid (§7.2) |
| M6 | Yoriko's hex and Seiran's dragon differed from GAPS; the dragon was "in the roster spec" but was not | **Fixed** | One hex (§5.2, matching GAPS P-15); Puppet Hex kept, the stage dropped; the dragon's rank 1–3 values are in §5.2 and B3 writes them into its hero tracks |
| M7 | Momo had four abilities | **Fixed** | One: Market Day (§5.1); §16 Q6 now only chooses which one |
| M8 | Iroha's second origin was both base kit and ability | **Fixed** | Mirror Shift moves the mirror and opens a reflect window; both origins are base kit (§5.2) |
| M9 | Ena's curse could stall a tick | **Fixed** | Burst budget in Omen Card's row (§5.2) and A5's test |
| L1 | Wrong claim about where `abilityAutoDefault` is read | **Fixed** | §6.7 corrected: `syncAbility` also runs in the step through `_refreshTower` on a hero level-up (`hero.js:58-70`); still deterministic |
| L16 | Hero row 258 px vs 246 px | **Fixed** | §8.1: 246 px wide, right edge at 258 px (`battle.css:215`) |
| L18 | Hana's path names repeated Aoi's | **Fixed** | Her ⚡ path is Falconry; Builder 4 renames (§5.2); the name test covers path and tier names (§13) |
| L19 | Kaede's "dash" | **Fixed** | Drawn only; her sim position never changes (§5.1) |
| L20 | Drone Surge's temporary drones underspecified in the Drones tab | **Fixed** | §5.1 Chika row: "Surge 1…4", no serial, counted in Chika's drone totals |
| Others | GAPS and WHAT_ELSE findings | — | Resolved in those files' own sections |
| Rejected | — | — | None in this file |
