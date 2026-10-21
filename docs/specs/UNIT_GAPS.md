# GAPS: the core unit archetypes we still need

Sakura Sentinels · core-units workflow · Oct 14 · **revision 2** (every critic finding is resolved; §10 lists each one, fixed or rejected, with the reason)

This file answers the owner's question "can you list what we need?". Its focus is his follow-up: units whose **mechanic** is different, rather than one more girl with a big aura radius or one more girl who shoots.

This file may later be copied into the public repo, so it uses only our own names and generic archetype words.

**One source of truth for abilities.** Every girl's activated ability (live, planned and new) is defined in **ABILITIES §5**: it unlocks at **tier 3 of one ⚡-marked path chosen for her theme**, and tier 5 of that path upgrades it. This file names the ability and its ⚡ path for each girl, but its numbers live only in ABILITIES. If the two files ever disagree, ABILITIES wins.

**Where the evidence comes from**
- **Live code:** `/home/user/sakura-game`, branch `claude/sakura-sentinels`, v0.1.26, HEAD `ffc4d23`. It was read only, never edited.
  - A `units.js:N` reference points at the girl's `id:` line in `src/data/units.js`.
  - Other paths are under `src/`.
- **Roster B3 work in progress:** `/home/user/wt-roster`, branch `feature/roster`, HEAD `3c47a32`. It is not merged into live and has no tests yet (task #138).
- **Codex (our old build):** cited from the formatted copies of the old modules in the merge scratch (`combat-expansion.js`, `expansion-roster.js`).
- **Other sources:** the planned kits are in `docs/merge/ROSTER_SPEC.md (on feature/roster)` §5.2, and the in-flight specs are chika-rework (#166, r2) and hero-rework (#168, r2).

All new numbers below are a **first pass**. Every kit still goes through the balance harness before it ships.

---

## 0. The answer in one screen

### Where we are today
19 live units: 3 heroes and 16 towers. Here is what each one *does*:

| Class | Count | Girls |
|---|---|---|
| **AURA**: a radius pulse or a stat-buff field | 5 | Hikari, Rei, Umeko, Miko, Hotaru |
| **SHOOTER**: picks a target and hits it from where she stands | 12 | Luna, Nami, Aoi, Yuki, Momo, Akane, Sango, Kage, Shiro, Midori, Raika, Kaede |
| **UNIQUE MECHANIC** | 2 | Suzu (road traps), Chika (deployed drones) |

Only **2 of the 16 towers (13%)** play differently from "stand here and hit things in a radius". The owner's read is correct.

Four other facts frame the gap:
- **Only the hero has a button.** Her single ult (`sim/hero.js:143-181`) is the only activated ability, and the co-op command list is `place upg sell tgt ult wave auto speed` (`online/coop/commands.js:21`).
- **Nothing the player owns moves**, except projectiles.
- **Nothing sits on the road** except Suzu's single-shot traps.
- **Nothing blocks the road.** The road band cannot be placed on (`sim/placement.js:1-13`), and the enemy movement step is never blocked (`sim/enemies.js:449`).

### What we need, ranked
"New" means a new girl from §5. "Planned" means one of the 11 Codex girls already specced in ROSTER_SPEC. "Path" means a change to an existing girl, from §6. The "⚡ ability" of every girl is in ABILITIES §5.

| # | Need (generic archetype) | Answer | Kind | Priority |
|---|---|---|---|---|
| 0 | **Activated ability per unit** (one ⚡ path unlocks a button at tier 3, on a short cooldown) + co-op `abil` and `acast` commands | ABILITIES (single source of truth) | system | **P1 (prerequisite)** |
| 1 | **Sentry builder**: timed turrets placed beside the road, of several types | **Yuzuha** | New | P1 |
| 2 | **Spike layer**: strips on the road with a hit budget, a lifetime, a cap and placement modes | **Azami** | New | P1 |
| 3 | **Ring shooter**: N shots in a 360° ring, a heat ring, a blade spiral | **Kinu** | New | P1 |
| 4 | **Campus hub**: a building that changes the rules in her radius (prices, free tiers, sell value, ability recharge, coins per kill) + **placeable banners** | **Ouka** | New | P1 |
| 5 | **Bomb with blast physics**: knockback, stun, fragments | **Marumi** (bombs that roll up the road), plus an Akane path | New + Path | P1 |
| 6 | **Beast tamer**: a pet that moves, pounces, grabs and carries | **Ruri**: her familiar becomes a roaming pet | Planned, upgraded | P1 |
| 7 | **Buff thrower** ("splash that buffs"): drinks thrown *at allies* | **Wakaba** | New | P1 |
| 8 | **Nature caster**: vines that hold, thorn beds, a harvest of lives and coins, a growth ramp | **Chigusa** | New | P1 |
| 9 | **Tracking summoned flier** (map-wide during her ability, map-wide for good at the top tier) + fire line + walk-backs | **Sorano** | New | P1 |
| 10 | **Late-game powerhouse with an offering** (absorbs your own girls for power) | **Tenka** | New | P1 |
| 11 | **Cash now + coins per kill** | **Momo**: one ability, Market Day; per-kill coins on Coin Toss (+ Ouka and Chigusa) | Path | P1 |
| 12 | **Attack helicopter archetype**: steerable flier with flight modes | **Chika** rework (#166) + the flight-mode addendum (ABILITIES §17) | Path (in flight) | P1 |
| 13 | **The owner's Codex five**: hex caster, mirror caster, summoner, long sky dragon, hex-doll hero | **Ena, Iroha, Ruri, Seiran, Yoriko** (§4) | Planned (+upgrades) | P1 |
| 14 | **Barricades**: hold enemies on the road, plus a detour at forks | **Norika** | New | P2 |
| 15 | **Lingering road zones** (frost field, acid pool, fire line, thorns) | zone primitive; Yuki and Midori paths; Sorano, Chigusa | Path + New | P2 |
| 16 | **Gravity well / pull** | Fuu gather (planned); **Tenka** path 3 | Planned + New | P2 |
| 17 | **Circling aircraft** (flight pattern, drops on road crossings) | **Hana**: Kaze becomes a real flier | Planned, upgraded | P2 |
| 18 | **Placeable banner** (the player plants a flag that carries a girl's effect to a spot) | **Ouka** Rally Banner (Safety Code T3) | New | P2 |
| 19 | **Mech or vehicle she drives** | **Kogane** | New | P3 |
| 20 | Aimed fire line, execute, lives restore, family-booster heroes, returning blades | Kohaku / Shiro / Chigusa / future hero slots / Kinu | Paths | P3 |

**Outcome (recounted in r2, §2.4).** After the planned 11 (with the upgrades in §4) and the 11 new girls, towers whose **base kit** is a unique mechanic go from **2 of 16 (13%)** to **18 of 35 (51%)**. Only girls that are unique from the moment they are placed count. Tenka is counted as a shooter: her offering and gravity well arrive at tier 3. Noa is an aura, and Kohaku is a shooter. 3 of 6 heroes get an ult with its own shape.

### Two readings of the owner's late-game request
One owner request most likely names one reference unit: a **late-game powerhouse** whose top tier absorbs nearby units (an **offering**). It may also mean "a much stronger money unit". (His exact words are on the owner page.) We cover both:
- **Tenka** is the late-game powerhouse with an offering.
- **Momo** gets one cash-now ability (Market Day) and per-kill coins.

The owner should confirm which he meant (§9).

---

## 1. Keys

| Key | Meaning |
|---|---|
| **COVERED** | A live girl does this today. Evidence is given as file:line. |
| **PARTIAL** | Something close exists, but a defining rule is missing. The "Gap" column says which. |
| **PLANNED** | One of the 11 Codex girls is specced for it (ROSTER_SPEC §5.2). Her sim code is in roster B3 work in progress (`wt-roster`), unless the row says otherwise. |
| **MISSING** | Nothing in live code, in B3, or in the planned kits. |
| **P1** | A gap the owner named on Oct 14:<br>• sentries<br>• buff-splash<br>• nature caster<br>• tracking flier<br>• late-game powerhouse with an offering<br>• beast tamer<br>• spike layer<br>• bomb<br>• ring shooter<br>• rule-changing hub<br>• attack helicopter<br>• the Codex five<br>• the per-path ability |
| **P2** | The owner's "in the same spirit" list: walls, gravity wells, mirrors, path runners, pull, placeable banners. |
| **P3** | Other gaps. |
| **Effort S / M / L** | Sim + data + battle UI hooks for one girl, assuming the shared primitives in §7 exist. Art (portrait, chibi model, attack FX) is extra for every new girl. |
| **Unique at base** | The unique mechanic works from placement, with no upgrade bought. This is what §2.4 counts. |

---

## 2. Every girl: aura, shooter or unique mechanic

### 2.1 Live (v0.1.26)

| Girl | Kind · rarity | Base behaviour (`units.js` base line) | Class | What makes her play differently, if anything |
|---|---|---|---|---|
| Hikari | hero SSR | `pulse` 6×1.0/s r2.1, 3 targets (`:112`) | **AURA** | Ult `nova` around her (`hero.js:153-161`) |
| Luna | hero SSR | `beam` 4×0.8/s r3.6, 3 beams (`:199`) | **SHOOTER** | Ult `timeWarp`, global (`hero.js:162-167`) |
| Nami | hero SR | `projectile` splash 0.5, slow (`:286`) | **SHOOTER** | Ult `tide` pushes the whole wave back (`hero.js:168-175`) |
| Aoi | tower R | `projectile` 4×1.4/s r3.2 (`:377`) | **SHOOTER** | — |
| Rei | tower R | `pulse` 4×0.9/s r1.8 (`:443`) | **AURA** | T4 Duelist switches to `duel` |
| Yuki | tower R | `projectile` splash, slow 30% (`:508`) | **SHOOTER** | T5 becomes a `pulse` blizzard |
| Momo | tower R | `projectile` 2×0.8/s + income 30 coins per wave (`:574-575`) | **SHOOTER** + passive income | Income per wave and interest (`Sim.js:453-461`) |
| Akane | tower SR | `projectile` splash 1.0, burn (`:639`) | **SHOOTER** (splash) | — |
| Sango | tower SR | `projectile` 14×0.45/s splash 0.8 (`:705`) | **SHOOTER** (splash) | — |
| Kage | tower SR | `projectile` 3×2.0/s, 2 targets, innate Veil Sight (`:770-771`) | **SHOOTER** | — |
| Umeko | tower SR | `pulse` 1×0.6/s r2.4 + Veil Sight aura (`:835`) | **AURA** | — |
| Shiro | tower SR | hitscan 18×0.4/s r10 (`:901`), targets elites first (`towers.js:63`) | **SHOOTER** | — |
| Midori | tower SR | `projectile` poison splash (`:966`) | **SHOOTER** (splash DoT) | — |
| Suzu | tower SR | `trap`, max 4 traps, 12 damage (`:1031-1033`) | **UNIQUE** (road traps) | Partial: spots are chosen for her, each trap fires once and never expires (`towers.js:506-549`, `:729-762`) |
| Raika | tower SR | `chain` 5×0.9/s, 3 jumps (`:1097`) | **SHOOTER** (chain) | — |
| Miko | tower SR | `projectile` 2×0.8/s + ×1.1 damage aura (`:1162`) | **AURA** (buffer) | — |
| Hotaru | tower SSR | `pulse` 6×0.8/s, 8 targets (`:1227`) | **AURA** | — |
| Kaede | tower SSR | `duel` 10×1.1/s, ramp (`:1292`) | **SHOOTER** (single-target melee) | — |
| Chika | tower SSR | `turret`, ≤2 drones on a fixed ring (`:1357`) | **UNIQUE** (deployables) | Partial: the drones sit 0.62 tiles from her (`constants.js:50`, `towers.js:551-566`). The roaming rework is #166; flight modes are ABILITIES §17 |

### 2.2 Planned: the 11 Codex girls

| Girl | Kind | Base kit per the current spec | Class per the spec | Class with the §4 upgrades (unique at base?) |
|---|---|---|---|---|
| Fuu | tower R | 3 gusts, knockback 0.45 | UNIQUE (push-back at base; gather at T3) | UNIQUE · yes |
| Hana | tower R | falcon shot, ×2 against air, grounds | SHOOTER (her falcon is only a projectile) | **UNIQUE** (circling flier from placement) · yes |
| Ruri | tower SR | every shot comes from a fixed familiar | UNIQUE (fixed relay point) | **UNIQUE** (roaming pet from placement) · yes |
| Noa | tower SR | `pulse` + cleanse and damage aura | AURA | AURA · no |
| Tsubaki | tower SR | aimed delayed mortar | UNIQUE (aimed mortar) | UNIQUE · yes |
| Kohaku | tower SSR | beam that ramps | SHOOTER | SHOOTER (+ an aimed line option at T4) · no |
| Iroha | tower SSR | shots come from a placed mirror | UNIQUE (mirror relay) | UNIQUE (fires from **both** her and the mirror at base) · yes |
| Ena | tower SSR | hits curse; curses burst on death | UNIQUE (curse spreads on death) | UNIQUE · yes |
| Kanna | hero SSR | taiko strikes | SHOOTER, unique ult (strike the strongest) | same |
| Yoriko | hero SSR | two slowing threads; ult reuses Nami's `tide` | SHOOTER | SHOOTER + **hex** skill (Lv 7) and a hexing push-back ult |
| Seiran | hero SSR | chain lightning; ult is an aimed radius blast | SHOOTER | SHOOTER + **sky-dragon path runner** ult |

### 2.3 New (§5)

Ten of the 11 new girls are unique from the moment they are placed. Tenka is honestly a shooter at base: she is the late-game carry, and her unique mechanics (offering, gravity well) arrive at tier 3.

| Girl | Archetype | Base kit | Class | Unique at base? |
|---|---|---|---|---|
| Yuzuha | sentries | taser darts + deploys a timed sentry every 6 s | UNIQUE | yes |
| Azami | spike strips | lays strips on the road | UNIQUE | yes |
| Kinu | 360° ring | 8 pins in a fixed ring, no targeting | UNIQUE | yes |
| Ouka | rules hub | no attack; cheaper upgrades and higher sell value in her radius | UNIQUE (rules, not stats) | yes |
| Wakaba | ally-targeted buffs | no attack; throws drinks at girls | UNIQUE | yes |
| Chigusa | vines and harvest | seed fan + a vine that **holds** an enemy every 6 s | UNIQUE | yes (r2: the vine moved into her base) |
| Sorano | firebird and walk-backs | star bolts + a **small firebird** that roams on a leash | UNIQUE | yes (r2: the firebird moved into her base) |
| Marumi | rolling bombs | rolls bombs up the road | UNIQUE | yes |
| Tenka | late carry, offering and gravity | hitscan 8 shots per second | **SHOOTER** (late carry) | no: offering and wells at T3 |
| Norika | barricades | barricades on the road | UNIQUE | yes |
| Kogane | mech | a mech the player moves | UNIQUE | yes |

### 2.4 Totals (towers only)

| Group | Towers | Unique at base |
|---|---|---|
| Live | 16 | 2 (Suzu, Chika) |
| Planned, with the §4 upgrades | 8 | 6 (Fuu, Hana, Ruri, Tsubaki, Iroha, Ena) |
| New | 11 | 10 (all but Tenka) |
| **All** | **35** | **18 (51%)** |

---

## 3. Coverage matrix

### 3.A Damage dealers

| # | Archetype (generic) | Defining rules | Status | Who / evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|---|
| A1 | Basic single-target shooter | cheap, reliable early damage | COVERED | Aoi `units.js:346` (4×1.4/s r3.2, `:377`) | — | — | — |
| A2 | Fast multi-target | many small hits on several targets | COVERED | Kage `units.js:739` (2 targets × 2.0/s); Aoi Rapid Volley | — | — | — |
| A3 | Line pierce / beam | hits a whole column | COVERED | Luna `beam` `units.js:168`, `towers.js:571`; Aoi pierce | — | Kohaku (planned) adds a ramping beam | — |
| A4 | Returning or orbiting blades | a projectile that curves back or circles the unit | MISSING | every projectile flies out and expires (`towers.js:311-357`) | no orbit or return | Kinu path 3 T4 (orbiting scissors) | P3 |
| A5 | Chain lightning | jumps between enemies | COVERED | Raika `units.js:1066`, `towers.js:572` | — | — | — |
| A6 | Melee sweep / duel ramp | short reach; damage builds on one target | COVERED | Rei `units.js:411` (`pulse`), Kaede `units.js:1261` (`duel`); Kanna planned | — | — | — |
| A7 | **Area bomb with blast physics** | splash, knockback along the path, stun, fragments | PARTIAL | Akane `units.js:608` (splash 1.0 + burn; stun only at T4, 20%); Sango `units.js:673` (knockback only at T5); knockback is per hit only (`Sim.js:342-348`) | no blast knockback in the base kit, no fragments, no "bomb identity" | **Marumi** (new) + Akane path (§6) | P1 |
| A8 | **360° ring shooter** | N straight shots in a fixed ring; heat ring; blade spiral | MISSING | `projectiles: N` goes to N *different* targets and fans only ±0.12 rad (`towers.js:379-402`) | no ring | **Kinu** (new) | P1 |
| A9 | Map-wide sniper | huge range, single target, elites first | COVERED | Shiro `units.js:870` (hitscan r10, `:901`; elite default `towers.js:63`) | no execute (Codex had it) | Shiro path (§6) | P3 |
| A10 | Aimed artillery | the player picks a point; the shell lands after a delay | PLANNED | Tsubaki: B3 `attackMortar` `towers.js:616`, `updateShells` `:668`, `MORTAR_DELAY` `constants.js:104` (wt-roster) | co-op `aim` command (live `commands.js:21` has none) | Tsubaki | P1 |
| A11 | Player-aimed fire line | the player sets the direction or line of fire | MISSING | nothing fires along a player-set line | — | Kohaku path option (§4) | P3 |
| A12 | **Late-game carry** | very fast fire, very expensive top tiers, a transform | PARTIAL | high-rate T5s exist (Aoi, Kage, Shiro) but no unit is built as the late-game anchor | — | **Tenka** (new; a shooter at base, offering at T3) | P1 |
| A13 | Anti-air specialist + grounding | hunts flyers first; knocks them down for ground-only girls | PARTIAL | `canHitAir` per girl; ground-only is absolute (`combat.js:24`) | grounding, air priority | Hana, Seiran (planned); B3 ground `status.js:26`, `ROLE_TARGET_MODE` `constants.js:122` | P1 |
| A14 | Boss-killer burst | one huge hit on the strongest enemy | PARTIAL | Shiro elite/boss multipliers; no tower burst | — | Kanna `strike` ult (B3 `hero.js:212`); Tenka's Critical Mass; Marumi Sticky Ball | P2 |

### 3.B Control

| # | Archetype | Defining rules | Status | Who / evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|---|
| B1 | Slow / freeze | movement control | COVERED | Yuki `units.js:477`, Nami `:255`, Umeko `:804` | — | — | — |
| B2 | **Lingering road zone** | a patch on the road that slows, burns or corrodes for N seconds | MISSING | live has traps, projectiles and turrets, but no zone objects. Codex had them (`combat-expansion.js` L415-420, Yuki's frost field) | zone primitive (§7 P-4) | Yuki and Midori paths (§6); used by Sorano, Chigusa, Norika | P2 |
| B3 | Poison / anti-heal | DoT that ignores armour; stops regen | COVERED | Midori `units.js:935` | — | — | — |
| B4 | Push-back along the path | moves enemies back toward the spawn | PARTIAL | per-hit knockback `Sim.js:342-348` (resist `constants.js:16`); Nami's ult `hero.js:168-175`; no push lock, so stacked pushers can stall a lane | push lock | Fuu (planned); B3 push lock `Sim.js:369-375`, `PUSH_LOCK` `constants.js:114` | P1 |
| B5 | Pull / gather / **gravity well** | pulls enemies to a point and holds them | MISSING (live) | — | — | Fuu gather (B3 `Sim.js:386-399`); gravity well: **Tenka** path 3 | P2 |
| B6 | **Grab, hold, carry back** | one enemy is held in place, or picked up and dropped further back | MISSING | only stun, freeze and shock stop movement (`status.js:89-92`) | `hold` status, carry | **Ruri** upgrade (§4); **Chigusa** vines | P1 |
| B7 | **Walls / blockades / reroute** | something on the road stops enemies until it breaks; switches them to a longer branch | MISSING | road band not placeable (`placement.js:1-13`); the movement step `e.dist += e.speed * dt` is never blocked (`enemies.js:449`) | blocker objects; shared stretches at forks (P-17) | **Norika** (new) | P2 |
| B8 | Screen-wide stop / slow | everything slowed or stopped for a moment | COVERED (hero only) | Luna `timeWarp` `hero.js:162-167` | no tower can do it | Hotaru's Firefly Hush (ABILITIES §5.1) | P2 |
| B9 | Hex / curse | DoT or debuff that spreads, or scales with max HP | PLANNED | Ena: B3 `curse` `status.js:47-60`, FIFO spread `Sim.js:444-480` | % max-HP hex does not exist; no per-tick burst budget | Ena; **Yoriko** hex (§4, one `hex` definition in P-15) | P1 |

### 3.C Things on the road

| # | Archetype | Defining rules | Status | Who / evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|---|
| C1 | Single-shot road mines | a few big traps near the exit | COVERED | Suzu `units.js:1000` (`trap` max 4, `:1033`; spots `towers.js:506-520`; placement `:522-549`; trigger `:729-762`) | no aim point, no expiry, no flyers | Suzu path option (§6) | — |
| C2 | **Spike strips** | many cheap strips, each with a hit budget, a lifetime and a cap; modes near-exit / spread / set point; a burst ability that covers the road | MISSING | each trap fires once and is removed (`towers.js:750-754`) | hit budget, lifetime, modes | **Azami** (new) | P1 |
| C3 | **Path runners** | something that moves along the road, usually backwards, and hits what it meets | MISSING | only enemies move by path distance (`enemies.js:449`, `placeOnPath` `:158`) | path-runner primitive (§7 P-5) | **Seiran** sky dragon (§4), **Marumi**, **Sorano** star shades, **Kogane** plow | P1 |
| C4 | Fire line / thorn bed | a damaging stretch of road | MISSING | — | zone primitive | Sorano path 1, Chigusa path 2 | P2 |

### 3.D Summons, deployables, movers

| # | Archetype | Defining rules | Status | Who / evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|---|
| D1 | **Sentry builder** | turrets placed beside the road inside her range, with a lifetime, a cap and types chosen by need | PARTIAL | Chika `units.js:1326` builds ≤2 drones on a fixed 0.62-tile ring (`constants.js:50`, `towers.js:551-566`) | lifetime, lane placement, types | **Yuzuha** (new) | P1 |
| D2 | **Attack helicopter archetype** | a flier the player steers: guard, hold, follow, hunt, patrol | PARTIAL, in progress | Chika rework #166 makes the drones roam within 4.0 tiles of her (chika-rework SPEC r2 §0, §3.1-3.2) | flight modes: specified in the r2 addendum, ABILITIES §17 | Chika rework + the addendum | P1 |
| D3 | Circling aircraft | follows a fixed flight pattern; drops a line of hits each time it crosses the road | MISSING | — | — | **Hana** upgrade (§4) | P2 |
| D4 | **Beast tamer** | a pet she places that moves, pounces, grabs or carries; land, air or water forms | PLANNED (partial) | Ruri's familiar is a fixed firing point: B3 `relayOrigin` `towers.js:731-760`, standoff 0.7 (`constants.js:110`) | pet movement, grab, carry | **Ruri** upgrade (§4) | P1 |
| D5 | **Tracking summoned flier** | a summon with map-wide reach for N seconds; map-wide for good at the top tier | MISSING | — | — | **Sorano** (new) | P1 |
| D6 | Vehicle / mech she drives | the unit moves after placement, to a point the player picks | MISSING | towers never move after `placeTower` (`Sim.js:575`); the hero rework designs `moveHero` + `hmv` (its §1 decision 7, §8.2) | a `moveTower` that reuses it | **Kogane** (new) | P3 |
| D7 | Mirror / second origin / redirect | fires from a placed point; bends allies' shots | PLANNED (partial) | Iroha: B3 relay *replaces* her origin (`towers.js:731-760`); aim `Sim.js:794-823` | two origins at once; reflecting allies' shots | **Iroha** upgrade (§4) | P1 |

### 3.E Support and economy

| # | Archetype | Defining rules | Status | Who / evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|---|
| E1 | Stat aura | damage / rate / range around her | COVERED | Miko `units.js:1131`, Umeko `:804`; aura keys `towers.js:189-194` | — | Noa (planned) | — |
| E2 | **Buff thrower** ("splash that buffs") | throws a buff *at a girl*; it splashes onto girls next to her; lasts N attacks; a single-girl power-up ability | MISSING | buffs exist only as auras (`towers.js:178-201`) and a global rate buff from Luna's ult (`Sim.js:204`) | ally-targeted buffs with charges | **Wakaba** (new) | P1 |
| E3 | **Rule-changing hub** | changes rules in her radius: prices, free first tiers, Veil Sight, anti-air, ability recharge, coins per kill, sell value | PARTIAL | the aura changes only dmg / rate / range / detection / costCut / cleanse (`towers.js:189-194`); cost cut capped at 50% (`towers.js:214-222`) | 7 new rule keys (P-9) | **Ouka** (new) | P1 |
| E4 | Reveal / Veil Sight | lets the team hit veiled enemies | COVERED | Hotaru `units.js:1196`; Kage innate (`:771`); Umeko, Shiro, Miko, Chika paths | — | — | — |
| E5 | Cleanse sabotage | clears disables | COVERED | cleanse aura `towers.js:196`: Miko T4, Chika Repair Bay, Hikari T4, Hotaru T4 | — | Noa (planned) | — |
| E6 | Income per wave + interest | coins every wave | COVERED | Momo `units.js:542` (`income` `:575`; payout `Sim.js:453-461`, interest cap 150) | — | — | — |
| E7 | **Cash now + coins per kill** | a cash-now button capped per wave; coins for kills nearby | MISSING | per-wave income only; Codex had coins per kill (`combat-expansion.js` L264-270) | econ ability, bounty, owner-credited coins (P-16) | **Momo** Market Day + Coin Toss bounty (§6); Ouka and Chigusa | P1 |
| E8 | **Offering** | absorbs your own girls in range; their role and coins become her new attacks | MISSING | the only way a girl leaves is selling at 70% (`types.js:275`, `Sim.js:676`) | absorb + derived weapons | **Tenka** (new) path 1 | P1 |
| E9 | Lives restore | heals lives a little, capped | MISSING | lives only go down (`Sim.js:392-404`); Codex had a capped mend (`combat-expansion.js` L271-279) | — | Chigusa path 3, Wakaba path 3 | P3 |
| E10 | **Placeable banner** | the player plants a flag; girls near it get a girl's effect | MISSING | auras are centred on the girl only (`towers.js:178-211`) | a second aura centre per girl, set by `aim` | **Ouka** Rally Banner (§5.5) | P2 |

### 3.F Systems

| # | Archetype | Status | Evidence | Gap | Answer | Pri |
|---|---|---|---|---|---|---|
| F1 | **Activated ability per unit**, on a short cooldown | MISSING | hero ult only (`hero.js:143-181`); co-op `ult[]` (`commands.js:21`, `:159-160`) | tower abilities, a co-op `abil` kind, an ability bar | ABILITIES: tier 3 of one ⚡ path per girl | P1 |
| F2 | Player aim points | PARTIAL (B3 only) | B3 `setAim` / `clearAim` `Sim.js:794-823`, `AIM_QUANT` 1024 `constants.js:102` | co-op `aim` kind | add `aim[uid,qx,qy]` beside `place` (`commands.js:123-138`) | P1 |
| F3 | Hero commanders that boost one family | PARTIAL | 3 heroes, one ult each; hero-rework #168 pending | family passives | future hero slots Mizuha / Sayo (§6.2) | P3 |
| F4 | Water placement | COVERED | Nami, Sango and Umeko are water girls; roster B2 makes them amphibious | — | — | — |

---

## 4. The planned Codex girls are first-class answers

The owner named five of them on Oct 14: Ena, Iroha, Ruri, Seiran and Yoriko. All 11 are **PLANNED** and none is playable yet.

What exists and what is missing:
- **Missing:** `src/data/unitsExpansion.js` and `unitKit.js` do not exist yet (Builder 4).
- **Exists:** the sim mechanics they need are in roster B3 at `wt-roster` `3c47a32`, verified line by line below.
- **Still to build:** tests (#138), renderer and UI hooks (#139), and a co-op `aim` command.

### 4.1 Mechanic, B3 status, and the upgrade that matches the owner's picture

The **⚡ ability** column names the ability only. Its numbers, its ⚡ path and its tier-5 upgrade are in **ABILITIES §5.2**.

| Girl | Unique mechanic (spec) | B3 code (wt-roster, verified) | Missing | Upgrade to match the owner's words | ⚡ ability (ABILITIES §5.2) |
|---|---|---|---|---|---|
| **Ena** (SSR tower), "hex caster" | Her hits curse. A cursed enemy bursts on death for 0.8× the cursing hit and passes a 60% curse to its neighbours, at most 2 generations | `curse` status `status.js:47-60`; FIFO queue `Sim.js:444-447`, `_flushCurses` `:456`; `CURSE_DECAY` 0.6 and `CURSE_MAX_DEPTH` 2 (`constants.js:119-120`) | tests; `curseBurst` FX; a **per-tick burst budget** (`_flushCurses` resolves every burst in the same tick, so a dense wave costs O(deaths × victims) in one step) | **Already a match.** Add a visible hex mark and a "chain ×N" counter. Add `CURSE_BURSTS_PER_TICK` = 32: the queue resolves at most 32 bursts per tick and leaves the rest, in FIFO order, for the next tick. Benchmark 300 cursed enemies dying together | **Omen Card** (Cursed Bloom ⚡) |
| **Iroha** (SSR tower), "mirror caster" | A mirror she places (aim, reach 3.7) becomes her firing origin | relay `towers.js:731-760`; `aimMode` `:698`; `setAim` `Sim.js:794` | co-op `aim`; mirror prop | (1) **Base kit:** she fires from **both** origins, herself and the mirror, as the owner said ("a second firing point", OWNER_DECISIONS #8). (2) T5 *Infinite Reflection*: allied projectiles that pass within 0.5 tiles of the mirror split in two, once per projectile. This is a swept segment test in `projectileStep` (`towers.js:635+`), deterministic | **Mirror Shift** (Mirror Hall ⚡): moves the mirror and opens a short reflect window |
| **Ruri** (SR tower), "summoner" | Fox familiar Kon stands at the lane edge; every shot comes from Kon; the path decides hound / falcon / otter | relay `towers.js:731-760`; `FAMILIAR_STANDOFF` 0.7, `RELAY_SAMPLE_STEP` (`constants.js:110-112`) | Kon never moves or touches enemies | **She becomes the beast tamer.** Kon is a real roaming pet using the drone record from chika-rework SPEC §3.1-3.2, with a leash equal to her relay reach (3.5), from placement. At T3 of a familiar path the form changes and gains a passive move on its own timer:<br>• **Moonhound** (land): every 8 s pounces on the lead ground enemy and **holds** it 1 s (`hold` status)<br>• **Star Falcon** (air): every 10 s **grabs** a non-boss enemy and drops it 1.5 tiles back up the road (push lock)<br>• **Tide Otter** (water): every 8 s drags an ordinary enemy under 15% HP out of the wave (execute)<br><br>The B3 relay stays as the "sit" fallback | **Moon Pounce / Star Snatch / River Rush**, one per familiar path (all three paths carry ⚡; the crosspath rule lets only one reach tier 3) |
| **Seiran** (SSR hero), "summons a long dragon" | Ult *Dragonflight* is an aimed radius blast (r3) | `nova` with center `'aim'` at `hero.js:179`; `dmgBuff` `:233`; ground status | everything the owner pictures | **New ult shape: a sky dragon that runs the path.** It enters at her aim point if one is set, otherwise at the exit end, and flies back along the road. Rank 1: 10 tiles in 3 s, 6 segments 0.6 tiles apart, 140 lightning to each enemy once, grounded 5 s, marked +18%; bosses take damage only. Ranks 2 and 3 (hero Lv 10 / Lv 20) are in ABILITIES §5.2. It moves by path distance (§7 P-5), so there is no free-flight trig. The Codex text already said it "sweeps a selected lane segment" (`expansion-roster.js` L268). Roster B3 writes these numbers into her `HERO_TRACKS` entry (hero-rework §11 asks B3 to write tracks directly) | Lv 7 skill **Storm Lance** |
| **Yoriko** (SSR hero), "like the hex hero" | Two slowing threads; ult *Dream Detour* reuses `tide` (push 5 tiles) | live `tide` `hero.js:168-175` | no puppet, no hex | (1) The single **`hex` status** (§7 P-15): a % of max HP per second, smaller against minibosses and bosses, capped at 10% of a miniboss's or boss's max HP per application, and it blocks regen. Plain arithmetic on `maxHp`, deterministic.<br>(2) Her Lv 7 skill **Puppet Hex** applies it.<br>(3) *Dream Detour* keeps the push-back and hexes everything it moves (1%/s for 5 s).<br><br>r1's placed "Marionette Stage" is **dropped**: a hero gets two buttons (ult + skill), not three. She stays distinct from Ena: Ena's curse *spreads*; Yoriko's hex is single-target and good against bosses | Lv 7 skill **Puppet Hex** |
| Tsubaki (SR tower) | Aimed delayed shells, warning ring, scatter table | `attackMortar` `towers.js:616-663`, `updateShells` `:668`; `MORTAR_SCATTER` `constants.js:108` | co-op `aim`; ring + whistle | — | **Fire Mission** (Meteor Shower ⚡) |
| Fuu (R tower) | Push-back + gather, with a per-enemy push lock | push lock `Sim.js:369-375`; `_gather` `:386-399` | tests; balance re-run (Nami Undertow) | — | **Backdraft Fan** (Returning Gale ⚡) |
| Hana (R tower) | Grounds flyers; ×2 against air; Air target mode | `airMul` `combat.js:79`; ground `status.js:26`; `ROLE_TARGET_MODE` `constants.js:122` | Air button; her planned path and tier names (Sky Hunter, Wind Reading, Long Bow, Falcon Mark) repeat Aoi's live ones (`units.js:395-403`) | **She becomes the circling aircraft.** Kaze is a real flier on a flight pattern, from placement:<br>• a circle around Hana<br>• an ∞-shaped double loop at T3<br>• a circle centred on an aim point at T4<br><br>He dives on flyers to ground them, and on her third path drops a feather bundle each time he crosses the road. This reuses the roaming-drone record. **Builder 4 renames** her paths: Falconry (Sharp Talons · Updraft Sense · Talon Dive · Raptor Strike · Sky Sovereign) and Hunter's Mark (Recurve Bow · Keen Eye · Hunter's Mark · Hunting Call · Apex Falconry) | **Kaze's Swoop** (Falconry ⚡) |
| Kohaku (SSR tower) | Beam that ramps on its target | beam ramp `towers.js:475-505` | tests | Optional P3 *Prism Corridor* T4: lock the beam along a player-aimed line (the aimed fire line archetype) | **Rainbow Lattice** (Prism Corridor ⚡) |
| Kanna (SSR hero) | Ult strikes the strongest enemy anywhere on the map | `strike` `hero.js:212` | drum shockwave FX | — | Lv 7 skill **Heavy Beat** |
| Noa (SR tower) | Cleanse aura (exists live, `towers.js:196`) | not needed | — | — | **First Aid Call** (Pure Sanctuary ⚡) |

### 4.2 School-uniform re-dress (OWNER_DECISIONS #3)

The roster spec still dresses **seven** of these girls in fantasy or East-Asian outfits (ROSTER_SPEC §5.2; research-codex §0.7). Every look below is an original academy school uniform.

Rules for the re-dress:
- Each girl keeps her signature prop and her halo.
- Students are wholesome: high necklines, tights or knee socks, no swimwear.
- Heroes are adults (`adult: true`), so they wear **staff or officer** uniforms.
- **Data guard.** The look list in `wt-roster/tests/data/units.test.js:42-51` still allows `miko`, `kimono`, `robe`, `armor` and `witchHat`. Builder 4 adds a test that the 11 planned girls and every new girl use none of them (live girls and skins keep theirs).

Look enums come from `wt-roster/tests/data/units.test.js:42-51`. New enums are marked *new*.

| Girl | New look | Props kept | First-pass look enums |
|---|---|---|---|
| Ruri | Library-committee first-year: navy blazer with the academy crest, sweater vest, sky-blue ribbon tie, plaid pleated skirt, knee socks, library armband; side braid with a star clip | **Grimoire**; **Kon** the white fox riding on her school bag | braid · split · hairpin · blazer · tome · star |
| Iroha | Art-club second-year: charcoal sailor uniform with a plum scarf, long plum cardigan, black tights; buns with a round silver ornament | **Hand mirror** on a lanyard; her placed mirror is an oval art-room mirror on an easel stand | buns · straight · hairpin · sailor · mirror · ring |
| Ena | Occult-club fortune-teller: black blazer with a crimson tie, long black cardigan, rose ornament on her braid | **Curse cards** in a belt holster; **red threads** wound around her wrists, trailing through her attacks | braid · split · flower · blazer · cards · moon |
| Fuu | Dance-club member: mint PE track jacket over a white sailor top, pleated skirt over sport leggings, sneakers; leaf-and-star pins | **Large folding fan** with the club crest | twintails · swept · hairpin · *track* (or hoodie) · fan · leaf |
| Hana | Wildlife-club member: olive hooded field jacket over a sailor uniform, falconry glove, skirt over tights, trail boots | **Kaze** the falcon; bow and quiver in a club archery case | braid · swept · none · coat · bow · star |
| Noa | Health-committee member: light-grey blazer over a mint cardigan, white blouse with a mint ribbon, armband with a **sakura emblem** (not a red cross); **honey-brown** hair in low buns (r2: palette and hair changed for originality, §4.3) | **Ward shield** with a sakura crest, styled like a riot shield | buns · hime · flower · blazer · shield · petal |
| Tsubaki | Security-corps cadet commander: navy uniform jacket with gold buttons, a light tactical school vest, peaked cap with a gold star, pleated skirt, boots | **Rangefinder binoculars**; mortar tube as a backpack launcher | long · straight · cap · blazer · cannon · star |
| Kohaku | Student-council secretary and science-club member: lavender blazer with gold piping, open white lab coat; crystal hairband | **Monocle**; prism pointer with floating rings | hime · split · crown · blazer (or *labcoat*) · staff · eye |
| Kanna (adult) | Drum-club advisor: fitted red-and-black staff track jacket with a drum crest, slacks, sneakers | **Horns**; **drum and mallet** | twintails · messy · horns · coat · mallet · flame |
| Yoriko (adult) | Drama-club director: long navy faculty coat cut like a stage coat, lilac vest, gloves, stage headset | **Cat-ear headpiece**; **marionette and control bar** (the puppet wears a tiny school uniform) | ponytail · hime · catEars · coat · puppet · moon |
| Seiran (adult) | Aerial-patrol flight instructor: light-blue flight jacket with gold shoulder boards, teal tie, pleated skirt, flight boots, headset | **Horns**; **storm spear**; the **long sky dragon** as her summon (the creature may look like a dragon; the outfit is not dragon-themed) | wavy · swept · horns · coat · spear · bolt |

### 4.3 Originality check (before any art is made)

- Under the academy direction, four planned girls share a given name with students of a well-known academy game: **Noa, Iroha, Kanna and Tsubaki**. The names are common Japanese given names and were chosen in the Codex build, so they stay unless the owner wants new ones (§9 Q7).
- Their **looks must not echo** those characters. Noa's palette and hair were changed in r2 (no silver hair, no white uniform). Iroha keeps buns and an art-club sailor uniform. Kanna keeps horns and a drum-club jacket. Tsubaki keeps a cadet cap with binoculars. The art brief for each girl adds: "check the name against well-known characters and avoid their hair colour, outfit cut and signature prop".
- No new girl's title may evoke a well-known franchise. r2 renames Tenka from "Railgun Physicist" to **Coilgun Physicist**.

---

## 5. New girls

### 5.1 Summary

New girls start after roster Builder 4. Every one of them is a student, so `adult: false`.

All the names below are free: none matches a live, planned, future or reserved name, a companion, or the player's name "Sensei" (research-roster §8). Run the §4.3 check before the art is made.

| Girl | Title | Club | Role key → display | Rarity · acquisition | Archetype | ⚡ path → ability (ABILITIES §5.3) | Effort | Pri |
|---|---|---|---|---|---|---|---|---|
| **Yuzuha** | Security Bureau Technician | Campus Security Bureau, equipment section | `builder` → Field Builder | SR · **free after 4-2** | sentry builder | Field Ops → **Emergency Deploy** | M | P1 |
| **Azami** | Checkpoint Prefect | Disciplinary Committee | `spiker` → Spike Layer | R · **free after 2-2** | spike strips | Checkpoint Duty → **Spike Rain** | M | P1 |
| **Kinu** | Pin-Burst Seamstress | Handicraft Club | `ring` → Burst Emitter | R · gacha | 360° ring | Spinning Bobbin → **Blade Spiral** | S / M | P1 |
| **Ouka** | Student Council President | Student Council | `hub` → Campus Hub | SR · gacha | rules hub + banners | Assembly → **Assembly Bell** | M | P1 |
| **Wakaba** | Track Team Manager | Athletics Club (manager) | `manager` → Team Manager | R · **free after 6-5** | buff thrower | Game Plan → **Time Out!** | M | P1 |
| **Chigusa** | Greenhouse Gardener | Botany Club | `botanist` → Botanist | SR · gacha | nature caster | Greenhouse → **Overgrowth** | M | P1 |
| **Sorano** | Firebird Astronomer | Astronomy Club | `caller` → Firebird Caller | SSR · gacha | tracking flier + fire line + walk-backs | Firebird → **Starfire Hunt** | L | P1 |
| **Marumi** | Strike Bowler | Bowling Club | `bowler` → Demolition Bowler | SR · gacha | bomb with blast physics (rolling) | Lane Master → **Giant Strike** | M | P1 |
| **Tenka** | Coilgun Physicist | Physics Club | `powerhouse` → Powerhouse | SSR · gacha | late carry + offering + gravity well | Rail Arms → **Critical Mass** | L | P1 |
| **Norika** | Safety Patrol Leader | Traffic Safety Patrol | `blocker` → Blockade | SR · gacha | barricades + detour | Crossing Guard → **Hold the Line** | L | P2 |
| **Kogane** | Heavy Machinery Pilot | Heavy Machinery Club | `pilot` → Mech Pilot | SSR · gacha | mech she drives | Bulldozer → **Clear the Road** | L | P3 |

**Free stage slots.** Live free girls arrive after stages 1-2, 1-5, 2-5, 3-2, 3-5, 4-5 and 5-5 (`free(...)` in `units.js`). Noa (6-2) and Hana (7-5) are planned. The open stages proposed above are 2-2, 4-2 and 6-5. The campaign has 40 stages (8 chapters × 5, `data/stages.js`).

**Role keys.** None of the new keys is an existing role (`types.js:90-110`), a planned role, or an enemy trait. Note that the *planned* key `summoner` already clashes with the enemy trait of that name (`enemies.js:20`).

**Ability convention (r2: one rule, ABILITIES §3.1).**
- Each girl's ⚡ path is the one that fits her theme. In the path tables below, the ⚡ path's **tier 3 unlocks** the ability ("⚡ Unlocks …"), tier 4 is an ordinary stat tier, and **tier 5 upgrades** the ability ("⚡+ …").
- Ability names never repeat a path, tier, title or enemy name (ABILITIES §13 tests this).
- Cooldowns are 20–60 s of wave time. The exact effect, cooldown and auto-cast rule of every ability are in ABILITIES §5.3; the tables below only summarise them.

**Costs.** Tier costs follow live bands:

| Rarity | Base cost |
|---|---|
| R | 200-300 |
| SR | 380-560 |
| SSR | 600-650 |

Tiers cost about 100-160 at T1, 220-380 at T2, 650-1300 at T3, 2000-4000 at T4 and 7500-14000 at T5. Tenka is a deliberate exception (§5.10). r2 lowers Ouka from 700 to **550**, inside the SR band.

---

### 5.2 Yuzuha: Security Bureau Technician (sentry builder)

| | |
|---|---|
| Look | Navy security-bureau blazer with a reflective armband; school tactical vest with tool pouches; pleated skirt over black tights; work gloves; safety-orange headset. Ash-brown bob with a pencil tucked behind her ear. A tablet controller in her hand and a fold-out turret case on her back |
| Look enums | bob · straight · headband · blazer · wrench (*new* `tablet`) · gear |
| Personality | Methodical and a little sleepy. She says "deploying" the way other girls say "good morning" |
| Answers | D1 sentry builder; plus a capture trap |
| How she differs from Chika | Chika is the **attack helicopter** archetype: drones that fly with her and, after the rework, flight modes. Yuzuha plants **ground turrets beside the road**. They have a lifetime, a type chosen for the threat, and they burst when they expire |
| Codex inspiration | Codex Chika's two independent sentries (`combat-expansion.js` L497-500). Yuzuha moves them out to the lane and gives them a timer |
| Base | Cost 420. Taser darts: `projectile` 2×1.0/s, r2.6.<br>While a wave runs she deploys a **sentry** every 6 s at a free road-edge spot inside her range, up to 2 at once. A sentry lives 20 s and fires 3×1.2/s with range 2.0 from its own spot.<br>Spots are path samples offset 0.7 tiles from the centreline, sorted nearest-exit first, like Suzu's spot list (`towers.js:506-520`) |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Sentry Lab** | Spare Tripods 140: +1 sentry | Longer Batteries 320: sentries last 30 s; +1 damage | Specialist Kits 1100: each new sentry gets the type the threat needs (rule below) | Burst Cells 3400: sentries +6 damage; each one bursts for 30 (r1.0) when it expires | Full Perimeter 12000: 6 sentries, 45 s life, +20 damage; bursts deal 150 |
| **Field Ops** ⚡ | Quick Deploy 120: deploys 25% faster | Wide Survey 300: +0.6 range | Tune-Up Kit 950: girls within 2.4 tiles attack 8% faster. **⚡ Unlocks Emergency Deploy** (extra sentries at a point she aims at or around the lead enemy) | Field Workshop 3000: sentries +4 damage and fire 20% faster; Tune-Up reaches 3.0 tiles | Rapid Response 11000: **⚡+** Emergency Deploy is bigger and recharges faster; Tune-Up +15% |
| **Capture Net** | Net Launcher 110: darts slow 20% for 1 s | Stun Baton 260: darts have a 15% chance to stun 0.2 s | Capture Net 900: one net on the road catches non-elite ground enemies outright, up to 300 HP in total per wave. Caught enemies count as defeated and pay +50% coins | Big Net 2800: budget 1500; also catches elites | Containment Grid 10000: 2 nets, budget 5000; also catches minibosses |

**Specialist Kits types:**
- **Net:** slows 35%.
- **Flash:** reveals veiled enemies and silences for 0.5 s.
- **Heavy:** ×3 damage, half the fire rate, ×1.3 against elites.
- **Flak:** hits flyers.

The type is chosen from the enemy counts in her range: veiled first, then airborne, then elite, then everything else. Ties go in that fixed order, so no random roll is needed.

**New sim**
- The anchored turret record gains `ttl`, `type`, `onExpire` and `spot: 'lane'`. The existing anchored code path stays (chika-rework keeps `leash: 0` turrets on today's code).
- A capture net is a road object with an HP budget (§7 P-3).
- Emergency Deploy uses the `abil` aim point (ABILITIES §7.2) and the deployables list (ABILITIES §4, A4).

**Determinism and performance**
- The offset normal is `(-dy, dx)/len`, using `sqrt` only.
- Spots are sorted by `remaining` with an index tie-break.
- There is no `rng` except for placement jitter, which goes through `sim.rng` as `placeTrap` does (`towers.js:539-541`).
- At most 6 sentries per Yuzuha, plus her Emergency Deploy sentries; per-player and per-sim caps in §7.2.
- **Wave end:** every sentry ends at the wave clear (§7.3). The capture net stays at its spot.

---

### 5.3 Azami: Checkpoint Prefect (spike layer)

| | |
|---|---|
| Look | Crisp black blazer with a red disciplinary armband; white shirt and red tie; pleated skirt, black knee socks, loafers. High ponytail with a thistle-purple ribbon. Clipboard, whistle, and a reel of folded spike strips on her hip |
| Look enums | ponytail · swept · ribbon · blazer · (*new* `strip`) · ring |
| Personality | Strict about the rules and secretly soft on first-years: "No running in the halls — or on my road." |
| Answers | C2 spike strips |
| How she differs from Suzu | Suzu lays a **few big single-shot bell mines** with holy seals. Azami lays **many cheap strips**, each with a hit budget and a lifetime |
| Codex inspiration | Codex Suzu's traps went to a player-set aim point or the nearest lane (`combat-expansion.js` L466-470). That became Azami's Checkpoint mode |
| Base | Cost 300. Lays a **spike strip** every 2.5 s on the road inside r2.8, up to 8 on the field.<br>A strip has **6 hits** (2 pierce damage each; an enemy can be hit once per strip) and lives 30 s. It hits ground enemies only.<br>Placement modes (her panel chips, like target modes): **Near exit** (default), **Spread** and **Checkpoint**. Checkpoint unlocks at Checkpoint Duty T3 |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Sharper Strips** | Steel Points 100: +1 damage | Double Rows 260: +4 hits per strip | Shredder Strips 850: +3 damage; hits crack armour (−1, stacks ×3) | Charged Strips 2600: a strip that runs out or expires explodes for 40 (r1.0) | Detonation Line 9500: +10 damage; explosions deal 300 and stun 0.5 s; ×1.5 against barriers |
| **Checkpoint Duty** ⚡ | Fast Hands 90: lays 25% faster | Patrol Route 240: +0.6 range; Spread mode covers every lane in range | Checkpoint 800: strips can land within 0.5 tiles of an aimed point; lays ×4 faster in the first 3 s of each wave. **⚡ Unlocks Spike Rain** (a burst of extra strips spread evenly along her road) | Double Shift 2400: +4 strip cap (12); Spread mode lays 2 strips at a time | Total Lockdown 9000: **⚡+** Spike Rain reaches twice her range, lays more strips and recharges faster; every 20 s a small Spike Rain of 6 strips lays itself |
| **Long Watch** | Treated Steel 110: strips last 45 s | Wide Strips 280: trigger radius +0.15 | Sticky Tar 900: struck enemies are slowed 25% for 1.5 s; strips **carry into the next wave** | Tall Barbs 2800: Veil Sight; strips also catch flyers for half damage | Iron Discipline 10000: strips last until they are used up; +20 hits; up to 20 strips |

**New sim**
- The trap record gains:
  - `hits` (budget) and a per-strip `hitUids` list;
  - `ttl` and `carryWave`;
  - `onSpent: 'explode'`;
  - placement modes `exit | spread | aim`;
  - an opening burst at the start of each wave.
- All of this sits in the existing `updateTraps` loop (`towers.js:729-762`) and `trapSpots` (`:506-520`). This is §7 P-3.
- **Forks and joins:** a strip on a stretch that several paths share registers on every one of them (§7 P-17), so it catches enemies on any path that runs over it.

**Determinism and performance**
- "Evenly along the road" steps by path distance through `samplePath` (`path.js:137`), with no `rng`.
- Per Azami: at most 12 strips of her own (20 with Iron Discipline) plus her Spike Rain strips. Per-player and per-sim caps with oldest-first eviction bound the total when a player places several Azamis (§7.2).
- Each strip runs one `grid.each` per step, the same cost as a live trap.
- An unarmed or expired strip is skipped.
- **Wave end:** strips end at the wave clear, except Sticky Tar strips, which carry into the next wave and are snapshotted (§7.3).

---

### 5.4 Kinu: Pin-Burst Seamstress (360° ring shooter)

| | |
|---|---|
| Look | Cream sweater vest over a white short-sleeved shirt; navy pleated skirt; a strawberry pincushion on her wrist; a tape-measure scarf; glasses on a beaded chain. Braided buns held with sewing pins. An oversized needle she uses like a wand |
| Look enums | buns · split · hairpin · *vest* (or blazer) · *new* `needle` · star |
| Personality | A cheerful perfectionist who counts every stitch out loud |
| Answers | A8 ring shooter; A4 orbiting blades |
| Codex inspiration | None. Codex never had a 360° emitter, so this is a new design |
| Base | Cost 260. `ring`: while any enemy is in range (r1.8), she fires **8 pins** outward in a fixed ring every 1.25 s. Each pin flies straight (no homing), deals 2 pierce damage, pierces 1, and travels up to 1.8 tiles |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Hot Iron** | Warm Pins 120: +1 damage; burn 2/s for 1.5 s | Steam Press 300: +0.2 range; +15% rate | Iron Ring 1000: the pins become an **expanding heat ring**. It travels from her to the edge of her range and hits each enemy it crosses once: 8 fire damage, hits flyers | Scorch Seam 3000: +16 damage; burn 8/s; a ring every 0.6 s | Molten Hem 11000: two rings per attack; +40 damage; ×1.3 against barriers; burning enemies that die throw 4 sparks in a ring |
| **Spinning Bobbin** ⚡ | Quick Stitch 100: +20% rate | Twin Spools 260: each ring turns 22.5° from the last, filling the gaps | Thread Cutter 900: pins become tiny blades: pierce 3, +2 damage. **⚡ Unlocks Blade Spiral** (a few seconds of a turning spiral of blades) | Spool Storm 2400: +4 damage; a ring every 0.9 s | Grand Spiral 9500: **⚡+** two spirals turning opposite ways, longer, blades pierce 8, faster recharge |
| **Pin Cushion** | Extra Pins 110: 10 pins | Long Pins 280: +0.5 travel | Sixteen Pins 950: 16 pins per ring | Orbit Scissors 2800: 3 pairs of scissors circle her at 1.2 tiles; 8 damage on contact, each enemy hit at most once every 0.25 s | Needle Storm 10000: 24 pins; ×2 rate; scissors deal ×2; Veil Sight |

**New sim**
- Untargeted shots already fly in live code: a projectile with no target and no splash flies straight, uses swept collision, pierces and expires at `maxTravel` (`towers.js:635-700`).
- **`spawnProjectile` cannot be reused as is** (r2): it needs a target object to aim at (`towers.js:311-316`) and fixes `maxTravel` at `range × 1.4 + 2` (`:349`). So the ring needs a new spawn helper, `spawnStraight(sim, t, spec, dirIndex, travel)`, that builds the same projectile record from a direction-table entry, with `target: null` and `maxTravel = travel` (1.8 tiles for pins, 2× her range for spiral blades).
- A fixed **direction table** per ring size (8, 10, 16, 24) and a 16-step spiral table. The tables are precomputed constants, so there is no trig at runtime.
- The ring's rotation is an integer step.
- The heat ring is a new short-lived ring object: its radius grows by `speed·dt`, and it hits enemies whose distance falls between the previous and the current radius, comparing squared distances.
- The scissors use a 64-step orbit table indexed by integer tick.

**Performance**
- At most 60 live pins and blades per Kinu; straight shots also have per-player and per-sim caps (§7.2).
- Pins use the existing projectile list and its compaction. Each live pin does one swept grid query per step, like any live projectile; pins live about 9 steps.
- **Wave end:** pins, blades and heat rings are cleared at the wave clear (§7.3).

---

### 5.5 Ouka: Student Council President (rule-changing campus hub)

| | |
|---|---|
| Look | White double-breasted student-council blazer with gold piping and a sakura-crest armband; navy pleated skirt; white gloves; black tights; loafers. Long cherry-pink hair with a black bow. A council gavel, and a folding "COUNCIL HQ" banner stand that marks her radius |
| Look enums | long · hime · ribbon · blazer · (*new* `banner`) · crown |
| Personality | Calm, organised and kind: "Every club does better when it has a good room." |
| Answers | E3 rule-changing hub; E10 placeable banner; part of E7 (coins per kill) |
| Codex inspiration | Codex Miko had **no attack**, only a team aura that did not stack (research-codex §2.1). Codex Momo paid coins per kill in range (`combat-expansion.js` L264-270) |
| Base | Cost **550** (r2: inside the SR band). **No attack.** Office radius r2.6. **Base rules** for girls inside it: upgrades cost 5% less, and they sell for 80% instead of 70%. (r1's +10% range was a stat aura, which is exactly what the owner did not want more of; r2 makes her base a rule change) |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Club Budget** | Budget Review 150: upgrades in her radius cost 10% less | Joint Purchase 350: 14% | Club Grants 1200: a girl placed inside her radius gets her **first tier free** | Sponsorship 3600: +2 coins for each kill inside the radius; first **two** tiers free | Golden Charter 12000: +5 coins per kill; 20% off upgrades; girls in her radius sell for 90% |
| **Assembly** ⚡ | Morning Bell 140: +10% attack speed in her radius | Bigger Office 300: radius 3.2 | Club Mentors 1100: abilities of girls in her radius recharge 15% faster. **⚡ Unlocks Assembly Bell** (a short map-wide team rally) | Student Body 3400: radius 3.6; +10% range in her radius | Festival of Clubs 12000: **⚡+** a stronger, longer Assembly Bell with a faster recharge; abilities in her radius recharge 25% faster |
| **Safety Code** | Hall Monitors 120: Veil Sight for girls in her radius | Rooftop Watch 280: girls in her radius can hit flyers | **Rally Banner** 950: she plants a council banner at her aim point, up to 5 tiles away. Girls within 1.6 tiles of the banner get her office rules as if they stood in her radius. A new aim moves the banner | Emergency Protocol 2900: cleanse; girls in her radius or a banner's cannot be disabled | Academy Charter 10000: 2 banners (a new aim moves the older one); radius 4.0; girls she covers never deal less than ×1.0 on the type chart; +15% damage |

**New sim.** **Seven** rule keys are added to the aura merge (`towers.js:189-194`); "strongest wins" per key stays. A banner is a second aura centre on her record (`t.banners[]`), set by the co-op `aim` command (§7 P-2) and folded by the same merge.

| Key | What it hooks (r2: corrected hook points) |
|---|---|
| `freeTiers` | `_upgradeCost` / `upgradeStatus` (`Sim.js:628-651`): a free tier costs 0, and the existing `costCut` cap (50%) still applies to paid tiers |
| `cdCut` | the ability charge rate (ABILITIES §6.4: 115 points per tick instead of 100) |
| `pierceAdd` | `refreshEffective` (`towers.js:126`) |
| `airGrant` | the `canHitAir` check (`combat.js:24`) |
| `typeFloor` | the hit spec: `refreshEffective` copies it into `t.eff`, and `computeHit` uses `max(typeMul, hit.typeFloor ?? 0)` (`combat.js:73-75`). `typeMultiplier` (`types.js:33`) knows nothing about the tower, so it stays unchanged |
| `killBounty` | `_killEnemy` (`Sim.js:381-390`): it credits the owner of the hub whose radius covers the enemy's position (owner-credited coins, §7 P-16) |
| `sellMul` | `sellValue` (`Sim.js:670-673`), which `sellTower` uses |

The base discount reuses today's `costCut` key (`towers.js:212-222`), so it does not stack with Momo's Coupon Book: the stronger one wins.

**Determinism and performance**
- Rule-key effects are plain multiply and add; coins are rounded the way they are today.
- `recomputeBuffs` is already O(towers²) (`towers.js:178-210`); two banners per Ouka add two more centres per girl, the same scaling.
- **Wave end:** banners stay where they are and are snapshotted (§7.3).

---

### 5.6 Wakaba: Track Team Manager (buff thrower)

| | |
|---|---|
| Look | Sky-blue academy PE track jacket with white stripes over a sailor top; navy skirt over sport leggings; sneakers; a stopwatch on a lanyard and a clipboard. Short green hair with a sweatband. A crate of sports-drink bottles and a towel over her shoulder |
| Look enums | short · messy · headband · *track* (or hoodie) · flask (*new* `bottle`) · wave |
| Personality | Loud, warm, always running: "Water break! Everyone, hydrate!" |
| Answers | E2 buff thrower ("splash that buffs"): she targets **girls**, not enemies |
| Codex inspiration | Codex Noa's pulsed ally effects: every few seconds a cleanse and a short ward on nearby girls (research-codex §2.2; `expansion-roster.js` L171-188) |
| Base | Cost 280. **No attack on enemies.**<br>Every 4 s she throws a sports drink at the girl in range (r2.6) with the **highest total damage dealt** (`damageDealt`, the running total `_credit` keeps). Ties go to the lower uid. (r2: r1 said "in the last 10 s", which the sim does not track)<br>The drink splashes onto every girl within 0.8 tiles. *Hydrated*: +15% attack speed and +10% range for that girl's next 8 attacks |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Energy Formula** | Electrolytes 130: Hydrated also gives +5% damage | Big Bottles 300: lasts 12 attacks; splash 1.2 | Special Recipe 1000: +20% damage, +15% rate, +10% range | Secret Formula 3200: the buff stays on permanently while Wakaba is on the field | Championship Blend 11000: +35% damage, +25% rate, +1 pierce |
| **Game Plan** ⚡ | Quick Pass 110: throws 25% faster | Sideline Toss 260: +0.8 range | Coach's Eye 900: girls she buffs gain Veil Sight while buffed. **⚡ Unlocks Time Out!** (a big, short power-up on one girl you pick) | Huddle 2600: drink splash 1.4; Hydrated +10% damage | Star Player 9500: **⚡+** Time Out also adds damage, lasts longer and recharges faster |
| **First Aid** | Ice Pack 100: a drink also cleanses a disabled girl | Team Spirit 240: +5% attack speed for girls within 1.6 tiles | Towel Snap 850: she also flicks towels at enemies: 1 target, 30% slow for 1.5 s | Recovery Plan 2700: +1 life for each wave cleared without a leak; **at most 10 per battle, never above the starting lives**, and never when the battle forbids healing (Nightmare's one life, `types.js:182`; codex modes' `sim.canHeal()`) | Championship Season 9000: every girl within 3 tiles carries her drink buff at all times |

**New sim**
- A tower **boost list** `t.boosts[{src, dmgMul, rateMul, rangeMul, pierce, shots | ttl}]`. It is merged in `refreshEffective` (`towers.js:126`), and one charge is used up after each successful attack in `updateTower` (`towers.js:618`).
- Boosts **stack with** auras.
- Note the collision: chika-rework also edits `refreshEffective` (chika-rework SPEC §10).

**Co-op (r2: one command shape)**
- *Time Out!* is fired with the one ability command, `abil[uid, group, qx, qy]` (ABILITIES §7.2). The target is **the girl nearest the aim point, within 0.6 tiles, at the command's tick; ties go to the lower uid**. With no aim (`qx = −1`) or no girl there, she picks the base-kit target. There is no `targetUid` argument.
- The caster must be yours (`ownsTower`, `commands.js:98`). Buffing a partner's girl is allowed.

**Determinism.** The target choice depends only on `damageDealt`, positions and `uid`, so there is no `rng`.

**Wave end:** Hydrated charges and Time Out end at the wave clear (§7.3).

---

### 5.7 Chigusa: Greenhouse Gardener (nature caster)

| | |
|---|---|
| Look | Olive sweater vest over a white blouse; brown plaid skirt; a gardening apron with pockets; rubber boots; cotton gloves; a school straw sun hat. Wavy moss-green hair with a leaf tie. A watering can and a seed pouch, with a potted sprout riding on her shoulder |
| Look enums | wavy · swept · flower (*new* `sunhat`) · apron · staff (*new* `wateringCan`) · leaf |
| Personality | Gentle and patient. She talks to plants and slimes in exactly the same voice |
| Answers | B6 grab and hold; C4 thorn beds; E9 lives restore; a harvest of coins; a growth ramp |
| Codex inspiration | Codex Noa's capped mend: lives from nearby kills, no more than 2 per tier per wave, never in one-life modes (`combat-expansion.js` L271-279). Codex Yuki's frost field (L415-420) became the thorn beds |
| Base | Cost 420. Throws 3 thorn seeds in a fan: 2 damage each, pierce 2, r3.0, 0.8 throws/s.<br>**Creeping Vine** (r2: moved into her base so she is unique from placement): every 6 s a vine **holds** the lead non-boss ground enemy in range for 1 s (minibosses 0.5 s; bosses immune) |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Wild Growth** | Fresh Seeds 120: +1 damage | Sunlight 300: +15% rate | Bloom Rush 1000: attack speed rises 5% per second of continuous attacking, up to +60%; resets after 2 s idle | Full Bloom 3000: ramp up to +120%; +4 damage; 5 seeds | Season of Plenty 11000: ramp up to +200%; 7 seeds; +10 damage; seeds hit flyers |
| **Greenhouse** ⚡ | Creepers 130: seeds slow 15% for 1 s | Thorn Beds 320: her kills leave a thorn bed on the road (4 hits × 2 damage, 8 s) | Strangler Vine 1100: the vine comes every 4 s, holds 2 s and deals 10/s. **⚡ Unlocks Overgrowth** (vines hold a whole group in her range) | Thorn Hedge 3400: a vine every 3 s; thorn beds have 8 hits | Forest Corridor 12000: **⚡+** Overgrowth holds more enemies in twice her range, for longer; a vine every 2.5 s |
| **Harvest** | Compost 100: +0.4 range | Vegetable Patch 260: +25 coins per wave | Herb Garden 900: +1 life per wave cleared; seeds stop healing (poison 1/s) | Bumper Crop 2800: +120 coins and +2 lives per wave, at most 30 lives per battle | Golden Harvest 10000: +400 coins and +3 lives per wave; girls within 2 tiles +10% damage |

**New sim**
- A **`hold` status**: the enemy cannot move. It is listed with the crowd-control statuses, so boss resistance applies (B3 `CC_TYPES`, `status.js:8`). Bosses are immune.
- Thorn beds are road objects with a hit budget (P-3).
- The time-based rate ramp is like the duel ramp, but keyed to time spent attacking.
- Lives are paid at wave end, beside income (`Sim.js:453-461`). They respect `diff.noIncome` and the one-life rule of the Nightmare difficulty (`types.js:182`, lives 1), and never exceed the starting lives.
- **Co-op coins:** her harvest coins go to her owner's wallet through owner-credited coins (§7 P-16).
- **Wave end:** thorn beds end at the wave clear (§7.3).

---

### 5.8 Sorano: Firebird Astronomer (tracking firebird, fire line, walk-backs)

| | |
|---|---|
| Look | Navy sailor uniform with a deep-blue star-chart scarf; long white cardigan with star buttons; black tights; Mary Janes. Long silver-white hair with a comet hair clip. A brass star-pointer wand and a star atlas; her **firebird** is a creature made of starlight and flame |
| Look enums | long · straight · hairpin · sailor · staff · star |
| Personality | A dreamy night owl who names every enemy after a constellation |
| Answers | D5 tracking summoned flier; C4 fire line; C3 walk-backs (defeated enemies return as allies that walk back up the road) |
| Codex inspiration | Codex Yuki's lingering zones (`combat-expansion.js` L415-420) for the Meteor Line. Codex had no summoned flier |
| Base | Cost 600. Star bolts: 5 mystic damage × 0.9/s, r3.2, element fire (burn).<br>**Little Firebird** (r2: moved into her base so she is unique from placement): a small firebird roams on a 1.5-tile leash and flames the nearest enemy, 2×1.5/s, hits flyers |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Meteor Line** | Hot Stars 150: +1 damage; burn 2/s | Shooting Star 340: +0.4 range | Meteor Line 1100: every 6 s a 2-tile line of starfire lands on the road in range: 6/s to ground enemies for 4 s | Comet Trail 3300: line 3 tiles, 15/s; also hits flyers | Meteor Avenue 12000: two lines, 40/s; burning enemies take +15% damage |
| **Firebird** ⚡ | Ember Wings 140: +15% attack speed (her and the firebird) | Bird Watching 320: Veil Sight | Fire Wings 1100: the firebird grows: 2.5-tile leash, 4×2/s, splash 0.4. **⚡ Unlocks Starfire Hunt** (the firebird hunts across the whole map for a while) | Blazing Plumage 3300: firebird +6 damage; enemies it burns take +10% damage | Eternal Firebird 12000: **⚡+** the firebird hunts across the **whole map at all times**; Starfire Hunt now makes it much stronger and turns her bolts into meteors while it lasts |
| **Constellation** | Star Map 120: +0.4 range | Clear Night 280: +1 damage; pierce 2 | Star Shades 950: enemies she defeats rise as star shades that walk **back along the road toward the spawn** for 6 s, dealing 6 to enemies they touch (max 4) | Great Bear 3000: shades last 10 s, deal 20, max 8; the strongest kill rises as a big shade with 3× stats | Star Parade 10500: max 16 shades; touch stuns 0.3 s; a shade explodes for 60 when it ends |

**New sim**
- **Firebird:** the roaming drone record from chika-rework (SPEC §3.1-3.2). Its leash is 1.5 at base, 2.5 at Fire Wings, and the whole map during Starfire Hunt and at Eternal Firebird. This is the same machinery as Chika's *hunt* flight mode (ABILITIES §17).
- **Meteor Line:** a zone (P-4).
- **Star shades:** path runners (P-5). Each spawns at the dead enemy's `dist` on its `pathIndex` (from `_killEnemy`, `Sim.js:381-390`), moves with `dist -= speed·dt`, and finds contacts with `grid.query` around `pointAt` (`path.js:94-105`), keeping only enemies on the same stretch (P-17).

**Performance.** At most 16 shades, 1 firebird and 2 lines per Sorano; per-player and per-sim runner caps in §7.2.

**Wave end:** the firebird flies home and docks like a drone, and its position is snapshotted like a drone row. Lines and shades end at the wave clear (§7.3).

---

### 5.9 Marumi: Strike Bowler (bomb with blast physics, rolling up the road)

| | |
|---|---|
| Look | Two-tone retro bowling-club jacket with a pin emblem, worn over a school blouse with the sleeves pushed up; pleated skirt; knee socks; two-tone bowling shoes. Orange bob with a headband. A polished bowling-ball bomb with a cartoon fuse, and a wrist guard |
| Look enums | bob · messy · headband · hoodie (club jacket) · cannon (*new* `ball`) · flame |
| Personality | Competitive and loud. She yells "STRIKE!" at every explosion |
| Answers | A7 bomb with blast physics; C3 path runner; part of A14 (a sticky ball for bosses) |
| How she differs | Akane lobs firework fireballs, Sango fires siege shells, and Tsubaki drops aimed mortar shells. Marumi **rolls her bombs up the road against the flow** of enemies, so the lane itself is her weapon |
| Codex inspiration | Seiran's Codex text "sweeps a selected lane segment" (`expansion-roster.js` L268) for the lane sweep |
| Base | Cost 480. `roll`: every 2 s she rolls a bomb from the road point nearest her. It travels toward the spawn at 4 tiles/s for up to 4 tiles and explodes on the first ground enemy it touches: 10 blast damage, splash 0.9, **knockback 0.3** along the path, with the push lock applied. It cannot hit flyers |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Heavy Ball** | Heavier Core 140: +3 damage | Big Blast 320: +0.3 splash; knockback +0.2 | Concussion 1100: blasts stun 0.5 s (bosses at 25%) | Wrecking Ball 3400: +30 damage; the ball rolls through the first 3 enemies before it explodes; ×1.5 against barriers | Bowling Thunder 12000: +120 damage; stun 1 s; knockback 0.8; minibosses are pushed too |
| **Lane Master** ⚡ | Quick Release 130: +20% rate | Long Lane 300: +0.6 range; balls roll 6 tiles | Split Pins 1000: each blast throws 6 pin fragments along the road in both directions (4 damage each, pierce 2). **⚡ Unlocks Giant Strike** (a giant ball rolls back up her road) | Perfect Game 3200: +20 damage; balls roll 8 tiles; pins +4 damage | Turkey Strike 11500: **⚡+** Giant Strike rolls on every path in her range all the way to the spawn, hits harder and sprays pins |
| **Spin Shot** | Hook Spin 120: if her lane is empty, the ball hops to the nearest other lane in range | Lob 280: when only flyers are in range, she lobs an arcing bomb that can hit them | Sticky Ball 950: a ball that hits an elite or boss sticks for 2 s, then explodes ×3 | Split Lane 2800: rolls 2 balls per throw, on different lanes | Spare Maker 10000: sticky balls ×6, stacking 3 per target; +60 damage |

*Reworked Oct 21 (owner: a bowling-ball ricochet; docs/BALANCE.md "Marumi rework"): Spin Shot is now the
ricochet path (Hook Spin, Bumper Bounce 1 bounce, Spare Chaser 3, Pinball Party 5, Glow Bowl 8 + a ×3
finale), the lob at flyers is her base kit on every path (half her blast), and her damage sits in the
regular band; src/data/unitsNewGirls.js holds the live numbers.*

**New sim**
- Path-runner object (P-5).
- The blast reuses `explode` (`towers.js:305`), and knockback reuses the per-hit spec (`Sim.js:342-348`) with B3's push lock.
- Fragments are tiny path runners with pierce.
- **Forks, joins and crossings (r2):** a ball rolls on one `pathIndex`. Where that stretch is shared with other paths (a fork's prefix or a join's suffix, `core/track.js:16-19`), it hits enemies on all of them; on a crossing or an overpass it ignores enemies on the other road (§7 P-17).

**Determinism.** Everything is measured in path distance. `pointAt` (`path.js:94-105`) is plain arithmetic at runtime: it reads a facing that was computed once with `Math.atan2` when the path was built (`path.js:42`). No `rng` is used.

**Wave end:** balls, pins and the giant ball end at the wave clear (§7.3).

---

### 5.10 Tenka: Coilgun Physicist (late carry, offering, gravity well)

| | |
|---|---|
| Look | Grey academy blazer with an atom club patch; short lab coat over it; plaid skirt; black tights; sneakers; safety goggles pushed up on her head. Platinum hair in a high ponytail with a coil-shaped tie. A hand-held **coilgun** with glowing coils |
| Look enums | ponytail · swept · goggles · *labcoat* (or coat) · rifle · bolt |
| Personality | A confident genius who explains everything with equations, and is usually right |
| Answers | A12 late carry; E8 offering; B5 gravity well; a trigger that fires before a leak |
| Class (r2, honest) | **SHOOTER at base** (the late-game carry). Her unique mechanics, the offering and the gravity well, arrive at tier 3 of their paths. §2.4 counts her as a shooter |
| Wholesome framing | Girls absorbed by *Joint Research* "join her lab team". They leave the field for the rest of the battle and lend her their skills. Nothing happens to them, and they are back in the roster after the battle |
| Codex inspiration | None. This is a new design |
| Base | Cost **1800**. She is a deliberate late-game anchor; the live maximum base cost is 650 (Hotaru, Chika). Coil bolts: hitscan, 3 mystic damage × **8/s**, r3.4 |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Joint Research** (offering) | Focus Lens 300: +1 pierce | Long Rails 700: +0.6 range | **Joint Research** 3000: on purchase, every one of **your own** girls in range (not heroes) joins her lab. Each absorbed girl's role category adds a weapon (rules below). Each weapon's strength scales with √(coins invested) | Grand Lab 9000: weapons ×1.5; bolts +30 damage | Unified Theory 30000: she can absorb a second time; weapons ×3 |
| **Rail Arms** ⚡ | Rapid Cycle 250: +20% rate | Twin Rails 600: 2 targets | Plasma Rails 2500: +5 damage; ignores 3 armour; Veil Sight. **⚡ Unlocks Critical Mass** (a huge plasma blast on the strongest enemy in range) | Capacitor Bank 8000: +15 damage; bolts jump to 1 extra enemy | Zero Point 28000: **⚡+** a much bigger Critical Mass with a faster recharge; her bolts fire ×2 faster for a few seconds after each cast |
| **Singularity** | Weighted Bolts 280: bolts slow 10% for 0.5 s | Field Coils 650: +0.4 range | Gravity Well 2800: every 8 s a well opens on the road in range for 4 s. It pulls enemies within 1.5 tiles toward its centre by path distance (push lock applies) and slows them 30% | Deep Well 8500: wells last 6 s with pull radius 2.0; enemies inside take +20% damage | Last Line 26000: *triggered*. When an enemy comes within 1 tile of the exit, a well opens there and swallows up to 30 non-boss enemies over 8 s (internal cooldown 120 s) |

**Joint Research: weapons by role category** (category from `types.js:81-88`):

| Category | Weapon added |
|---|---|
| dps | +2 coil bolts |
| frag | a plasma grenade every 2 s |
| control | a 20% slow field, r2 |
| support | +15% damage aura, r3 |
| economy | coins each wave equal to 30% of the absorbed girls' income (owner-credited, P-16) |

**New sim**
- Offering: the towers are removed with no refund. Their category and invested coins are recorded, and they are saved in the snapshot.
- A tower with **extra attacks** (`extraAttacks[]`) beside her main behaviour.
- The gravity well is a zone that pulls, using the same path-distance arithmetic as B3 `_gather` (`Sim.js:386-399`).
- **Last Line hook (r2):** `_leak` runs only once an enemy has already reached the exit (`enemies.js:450-453`), which is too late. The trigger is a check in the enemy step instead: right after `e.dist += e.speed * dt` (`enemies.js:449`), an enemy whose `dist` first passes `path.length − 1.0` fires `sim._nearExit(e)`, which Last Line listens to. An enemy fires it once (`e.nearExit = true`).

**Co-op (r2: ownership rule)**
- Ownership lives in the sim as **`t.owner`**, set at placement (ABILITIES §7.2). Joint Research absorbs only girls with `t.owner === tenka.owner`, so she **never absorbs a partner's girl**.
- The co-op layer forgets an absorbed girl: today only `sell` deletes an entry from `owners` (`commands.js:149`). `upgradeTower` reports the absorbed uids (`sim.lastAbsorbed`), and the `upg` handler deletes each of them from `owners`.

**Determinism.** `Math.sqrt` is exact. Do not use `Math.pow`, `exp` or `log` (none appear under `src/sim` today); see §7 for `**` and `powInt`.

**Wave end:** wells end at the wave clear; the absorbed-girl record stays and is snapshotted (§7.3).

---

### 5.11 Norika: Safety Patrol Leader (barricades and detours)

| | |
|---|---|
| Look | Navy blazer under a reflective high-visibility safety sash; white gloves; a yellow safety-patrol cap; pleated skirt; knee socks; rain boots. Low twin pigtails. A round STOP paddle and folding A-frame traffic barriers |
| Look enums | twintails · straight · cap · blazer (*new* `sash`) · shield (*new* `sign`) · ring |
| Personality | Takes patrol duty extremely seriously. She blows her whistle at everything, pigeons included |
| Answers | B7 walls, blockades and reroute |
| Codex inspiration | None. Codex never had walls (research-codex §5) |
| Base | Cost 450. Places up to **2 barricades** on the road in range (r2.2). Each barricade has a **hold budget of 120**.<br>A ground enemy that reaches a barricade stops and pushes on it, draining the budget per second: normal 10, elite 25, miniboss 60, boss 200.<br>Flyers pass over. **Blinkers hop it**, which is their counterplay. A broken barricade is rebuilt after 3 s.<br>STOP-paddle bonk: 3×0.8/s, r1.6 |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Heavy Barriers** | Sandbags 130: +80 budget | Double Barrier 320: +1 barricade | Steel Barriers 1100: +300 budget; held enemies take +15% damage | Water-filled Barriers 3300: +1000 budget; a barricade that breaks splashes a 50% slow for 2 s | Fortress Gate 12000: +5000 budget; minibosses push at half rate; rebuilt in 1 s |
| **Crossing Guard** ⚡ | Whistle 110: +0.4 range | Bright Sash 280: Veil Sight; held enemies are revealed | Speed Bumps 950: a road zone in range slows ground enemies 30%. **⚡ Unlocks Hold the Line** (a temporary extra barricade where you aim) | School Zone 3000: speed bumps slow 40%; +1 barricade | Road Closed 10500: **⚡+** Hold the Line lasts longer, places 2 barricades and stops minibosses too |
| **Detour** | Reflective Paint 120: +1 paddle damage | Bounce Back 300: an enemy that hits a full barricade is knocked back 0.4 tiles once (push lock) | Detour Sign 1000: on maps with forks, enemies in range that have not reached a fork take the **longer** branch; on maps without forks, barricades get +50% budget | Long Way Round 3000: detoured enemies are slowed 20% for 3 s; knockback 0.8 | One-Way Street 10000: once per wave, the first 20 enemies that hit her barricades are sent back 6 tiles (bosses 0) |

**New sim**
- **Blockers in the enemy step** (§7 P-11). After `e.dist += e.speed * dt` (`enemies.js:449`), clamp `dist` at the first barricade ahead on that `pathIndex`, and drain the barricade's budget.
- **Shared stretches (r2):** paths fork from and join earlier paths and share their segments (`core/track.js:16-19`). A barricade placed on a shared stretch is registered on **every** path that runs through it, at the matching distance on each (§7 P-17), so an enemy on any of them stops at the same physical spot. Barricades are never placed on a crossing point or overpass.
- Blink jumps (`enemies.js:265`) pass over it. No barricades inside tunnels, the same rule as traps (`towers.js:512`).
- **Detour:** switch `pathIndex` to a sibling path that shares the prefix. Forks are built in `core/track.js:16-19` and `:337` (`forkD`, `fork.d`).
  - Allow the switch only when the shared prefix length is equal on both paths; verify this per map in a test.

**Determinism and performance**
- Enemies drain budgets in array order, so the result is deterministic.
- The cost is O(enemies × barricades on that path), with at most 3-4 barricades per girl plus her Hold the Line barricades; per-player caps in §7.2.
- **Wave end:** her own barricades stay at their spots, refill at the next wave start, and are snapshotted. Hold the Line barricades end at the wave clear (§7.3).

---

### 5.12 Kogane: Heavy Machinery Pilot (a mech she drives)

| | |
|---|---|
| Look | Safety-yellow club work jacket with reflective tape over a sailor top; cargo-pocket pleated skirt over leggings; steel-toe boots; a hard hat with a sakura sticker; goggles. Short messy brown hair. She rides **Big Yellow**, a small two-legged construction walker with an open cockpit |
| Look enums | short · messy · cap (*new* `hardhat`) · jumpsuit · wrench · gear |
| Personality | Easygoing and in love with big machines: "Leave it to Big Yellow!" |
| Answers | D6 mech or vehicle; C3 path runner (the plow) |
| How she differs from Chika | Chika flies. Kogane walks on the ground to a point the player sets, and her ability drives the mech onto the road itself |
| Codex inspiration | None. This is a new design |
| Base | Cost 650. Rivet gun from the mech: 4×1.2/s, r2.6.<br>**Move (r2: reuses the hero rework's move):** the player picks a new spot within 4 tiles of where she was placed. It works exactly like the hero rework's `moveHero` (its §1 decision 7 and §8.2): free and instant between waves; during a wave she stops attacking for 3 s and cannot move again for 15 s. The sim relocates her at once through the rework's `_relocate`; the renderer shows Big Yellow walking there during the 3 s |

| Path | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| **Drill Arm** | Hardened Bit 140: +2 damage | Long Drill 320: +0.3 range | Core Drill 1100: switches to a drill that ramps on one target (`duel`); ignores 4 armour | Rock Breaker 3400: +20 damage; cracks armour for everyone (−2, stacks ×3) | Mountain Mover 12000: +80 damage; ×1.5 against bosses; the drill stuns 0.4 s |
| **Bulldozer** ⚡ | Treads 130: move recharge 15 → 10 s | Big Blade 300: enemies within 0.6 tiles of the mech are pushed back 0.2 tiles (push lock) | Site Survey 1000: +1 move leash; Veil Sight. **⚡ Unlocks Clear the Road** (the mech plows a stretch of road, carrying enemies back) | Reinforced Frame 3200: +20 damage on the rivet gun; cannot be disabled | Demolition Day 11500: **⚡+** a longer, harder plow that also carries minibosses |
| **Missile Pods** | Pod Mount 120: +1 damage | Twin Pods 300: every 3 s, 4 mini-missiles at 4 targets (splash 0.4) | Swarm Pods 950: 8 missiles; they hit flyers | Heavy Ordnance 3000: missiles +20 damage; splash 0.8 | Full Payload 11000: 16 missiles; stun 0.3 s |

**New sim**
- **A mobile body** (§7 P-12): a generic `Sim.moveTower(uid, x, y)` that reuses the hero rework's `canMoveHero` / `moveHero` checks, downtime and cooldown and its single `_relocate` (which already clears trap spots and targets, shifts drones, and is where B3 adds `updateRelayOrigin` and codex modes adds `assignPads`). Only towers with `mobile: { leash }` may call it.
- A new co-op kind **`tmv[uid, qx, qy]`**, quantised like `place` (`commands.js:123-127`) and checked with `ownsTower`; the hero keeps `hmv[qx, qy]`.
- The plow is a path runner (P-5) that carries enemies: it clamps their `dist` behind its blade. Her own position does not change during the plow; the renderer draws the mech on the runner and walks it back.

**Priority.** P3. Cut her first if scope is tight; the Chika rework already delivers "a unit that moves".

---

## 6. Paths instead of new girls

### 6.1 Existing live girls

| Girl | Missing archetype | Path change (sketch) | New mechanic needed | Pri |
|---|---|---|---|---|
| **Momo** | E7: cash now, coins per kill | **One ability (r2 decision):** **Market Day** on her ⚡ Peach Orchard path, exactly as ABILITIES §5.1 defines it (coins now, at most 2 per player per wave, none on Nightmare; Golden Peach Bank T5 enlarges it). **Coin Toss T3** Gold Rush also pays +1 coin per kill in her range (`killBounty`, shared with Ouka; Codex bounty, `combat-expansion.js` L264-270). r1's vault, its Withdraw button, Clearance Sale and Withdrawal are **dropped**: one button per girl. Savings Pact stays as live (interest and discounts). In co-op her coins go to her owner (P-16) | econ ability (ABILITIES A1); `killBounty` (P-9); P-16 | P1 |
| **Chika** | D2 attack helicopter | Chika rework (#166) + flight modes **Guard / Hold / Follow / Hunt / Patrol**, chosen in her panel and sent as lockstep commands. **Specified in the r2 addendum, ABILITIES §17** (commands `fly` and `flyB`, follow-your-taps, map-wide hunt, a deterministic patrol, the benchmark and balance re-run) | `fly`, `flyB`; patrol anchor | P1 |
| **Akane** | A7 blast physics | **Big Bang**: T2 blasts knock back 0.2 tiles; *Cluster Bloom* T3 also scatters 4 bomblets around the impact | fragments (P-5 / small projectiles) | P2 |
| **Suzu** | C1 aim + expiry | **Spirit Seals** T3: traps can go to a set point (Codex aim, `combat-expansion.js` L466-470). Binding T5: traps survive into the next wave. Codex Binding bells also **grounded** flyers (research-codex §2.2) | `aim` command; B3 ground | P2 |
| **Yuki** | B2 zone | **Permafrost** T3 *Hoarfrost Field*: a real lingering frost patch on the road, 3 s (Codex Snowfield, `combat-expansion.js` L415-420) | zone (P-4) | P2 |
| **Midori** | B2 zone, sticky | **Field Kit** T3: a puddle of acid on the road; enemies standing in it take +10% damage ("sticky") | zone (P-4) | P2 |
| **Shiro** | A9 execute | **Execution** T3: non-boss enemies below 5% HP per tier are finished off (Codex execute, `combat-expansion.js` L358-361) | `execute` mod | P3 |
| **Kohaku** (planned) | A11 aimed fire line | see §4.1 | `aim` command | P3 |

### 6.2 The four future slots

Tomoe, Mizuha, Sayo and Hiiro already have names, bios and V2 3D models (`wt-roster/src/data/future.js:31-110`), but **no kit**. Each of their planned roles copies an existing girl's. That makes them the cheapest homes for new archetypes:

| Slot | Today (`plannedRole`, V2 look) | Option |
|---|---|---|
| **Tomoe** (student) | cleaver, a copy of Rei; blazer, red headband, long sword | **Line holder.** She stands at a spot on the road edge and *holds* up to 3 enemies in melee. This is the melee version of Norika's barricades. If the owner prefers a swordswoman blocker, Tomoe takes the Blockade kit and Norika becomes a later girl |
| **Hiiro** (student) | duelist, a copy of Kaede; fencing-club coat, rapier | **Lunge duelist**: her ability shows her dashing to any enemy within 6 tiles to strike and return. The dash is drawn by the renderer only; her sim position never changes (the rule ABILITIES §5.1 also sets for Kaede). P3 |
| **Mizuha** (adult) | tideguard, a copy of Nami; harbour staff officer | **Naval hero** who boosts every water girl: sea mines in water lanes; ult harpoons the strongest non-boss enemy and drags it back to the start. Needs a staff-officer re-dress. P3 |
| **Sayo** (adult) | mystic, a copy of Luna; night-course teacher | **Magic-family hero**: abilities of mystic girls recharge faster; ult opens a star gate that sends the front of the wave back. Needs a faculty re-dress. P3 |

---

## 7. Shared sim primitives (build once, many girls use them)

**Maths rules (r2: completed).**
- The live `src/sim` code has **no** `Math.exp`, `Math.pow` or `Math.log` (grep, Oct 14).
- It **does** use `**` for squared distances (`towers.js:490`, `:530`). `**` is not required to be correctly rounded across engines, so **new code writes `d * d`**, and any whole-number power uses the existing `powInt` (`waves.js:34-48`), which gives the same bits on every engine.
- Co-op makes only trig and `hypot` deterministic: `DET_MATH` (`core/detMath.js:205`) through `withDetMath` (`:216`).
- **Path facing** is computed once with `Math.atan2` when a path is built (`path.js:42`) and cached; `pointAt` (`path.js:94-105`) only reads it. So moving anything by path distance is plain arithmetic at runtime.

Rules for every primitive below:
- Use add, subtract, multiply, divide and `sqrt`.
- Use fixed tables for directions and orbits.
- Use path distance for anything on the road.
- Draw random numbers only from `sim.rng`.
- Use FIFO queues for chain reactions, as B3's curse queue does, with a per-tick budget.
- Quantise player points to 1/1024 (B3 `AIM_QUANT`, `constants.js:102`; co-op `Q`, `commands.js:22`).

### 7.1 Primitives

| ID | Primitive | Users | Hook points (live unless marked B3) | Status | Effort |
|---|---|---|---|---|---|
| P-1 | **Activated ability** per tower: cooldown, starting charge, per-wave caps. **One co-op shape: `abil[uid, group, qx, qy]`** (ABILITIES §7.2). A girl-targeted ability (Time Out!) resolves its target as the girl nearest the aim point within 0.6 tiles at the command's tick, ties to the lower uid | every girl | new `Sim.castAbility`; validated like `tgt` with `ownsTower` (`commands.js:98`, `:153-158`); hero `ult` stays (`:159-160`) | MISSING | M (system) |
| P-2 | **Aim command** `aim[uid,qx,qy]` | Tsubaki, Iroha, Seiran, Azami, Suzu, Kohaku, Ouka's banners | B3 `setAim` / `clearAim` `Sim.js:794-823`; `aimMode` `towers.js:698` | B3 sim only; co-op MISSING | S |
| P-3 | **Road objects with a budget**: hit or HP budget, `ttl`, carry to the next wave, explode when spent, placement modes | Azami, Yuzuha net, Chigusa thorns, Suzu | `trapSpots` `towers.js:506-520`; `placeTrap` `:522-549`; `updateTraps` `:729-762` | PARTIAL | M |
| P-4 | **Zones**: road patches with a radius or length, a per-second effect and a lifetime | Yuki, Midori, Sorano, Chigusa, Norika (speed bumps), Tenka (gravity well) | new `sim.zones` list, updated beside `updateTraps`; Codex model `combat-expansion.js` L415-420 | MISSING | M |
| P-5 | **Path runners**: objects that move by path distance (usually backwards), have segments, hit each enemy once, and can carry enemies | Seiran dragon, Marumi balls and pins, Sorano shades, Kogane plow | `pointAt` `path.js:94-105`; `samplePath` `:137`; `placeOnPath` `enemies.js:158`; `grid.query` `grid.js:50` | MISSING | M |
| P-6 | **Roaming bodies**: a leashed flier or walker that hunts | Chika, Ruri pet, Hana's falcon, Sorano's firebird | chika-rework SPEC §3.1-3.2 (`makeDrone`, `updateRoamingDrones`; + − × ÷ and `sqrt` only) | SPEC (#166) | reuse |
| P-7 | **Straight shots** from a direction table | Kinu, Marumi pins | `projectileStep` already flies untargeted shots (`towers.js:635-700`); new `spawnStraight` with its own `maxTravel`, because `spawnProjectile` needs a target and fixes `maxTravel` (`:311-316`, `:349`) | PARTIAL | S |
| P-8 | **Ally-targeted boosts** with charges or a timer | Wakaba, ability buffs | `refreshEffective` `towers.js:126` (collides with chika-rework §10); charges used up at `towers.js:618` | MISSING | M |
| P-9 | **Rule-aura keys** (seven): free tiers, ability recharge, +pierce, anti-air grant, type floor, coins per kill, sell multiplier; plus banners as extra aura centres | Ouka, Momo | aura merge `towers.js:189-194`; `_upgradeCost` / `upgradeStatus` `Sim.js:628-651`; `computeHit` `combat.js:73-75`; `_killEnemy` `Sim.js:381-390`; `sellValue` `Sim.js:670-673` | PARTIAL | M |
| P-10 | **Hold, grab and carry** statuses | Ruri, Chigusa, Hana | `isImmobile` `status.js:89-92`; B3 `CC_TYPES` `status.js:8`; `pushBack` (`hero.js` tide) + B3 push lock `Sim.js:369-375` | MISSING | S |
| P-11 | **Blockers** in the enemy step | Norika, Tomoe (option) | `enemies.js:449`; blink `:265`; forks `core/track.js:16-19`, `:337` | MISSING | M |
| P-12 | **Mobile tower body** + `tmv` command | Kogane | the hero rework's `canMoveHero` / `moveHero` / `_relocate` and `hmv` (hero-rework §1 decision 7, §7, §8.2), generalised to towers with `mobile`; `placeTower` `Sim.js:575` | MISSING (designed for heroes) | M |
| P-13 | **Offering** (absorb your own towers) + **extra attacks** on one tower | Tenka | removal path in `sellTower` `Sim.js:676`; `t.owner`; `owners` cleanup in the `upg` handler (`commands.js:84`, `:149`); snapshot | MISSING | L |
| P-14 | **Kill, near-exit and leak hooks** (bounty, mend, walk-backs, last-line traps) | Ouka, Momo, Chigusa, Sorano, Tenka | `_killEnemy` `Sim.js:381-390`; a near-exit check after `enemies.js:449` (because `_leak` fires only at the exit, `enemies.js:450-453`); `_leak` `Sim.js:392-404`; wave-end payout `:453-461` | PARTIAL | S |
| P-15 | **`hex` status** (one definition): each second the enemy loses `pct × maxHp × tierMul` (normal and elite 1, miniboss ⅔, boss ⅓), cannot regenerate, and one application never takes more than 10% of a miniboss's or boss's max HP | Yoriko (Puppet Hex, Dream Detour) | status table `types.js:62-75`; DoT handling beside poison | MISSING | S |
| P-16 | **Owner-credited coins** (new in r2) | Momo's Market Day, every `killBounty`, Chigusa's harvest, Tenka's economy weapon | `sim.ownerCash = [0, 0]`, credited with `sim._gainCashFor(owner, n)`. Solo adds straight to `sim.cash`. The co-op layer moves `ownerCash[i]` into `wallets[i]` and zeroes it after every command and every step. Today a step's income is split evenly between connected players (`commands.js:190-202`), so without this an **auto-cast** Market Day would be shared while a manual one went to the caster. Today's wave-end income stays split as now | MISSING | S |
| P-17 | **Shared stretches** (new in r2): which paths run over the same physical road, and at what distance on each | Norika, Azami, Marumi, Sorano, Seiran, Kogane | a table `sharedStretch[i][j] = [{ fromI, toI, fromJ }]` built once per map from the fork and join specs (`core/track.js:16-19`). Road objects on a shared stretch register on every path in it. Runners hit only enemies on the same stretch, so a crossing road or an overpass is ignored | MISSING | S |

### 7.2 Performance caps (r2: per player and per sim)

The sim has **no limit on copies of one girl**: `canPlace` only checks that she is in the formation (`Sim.js:556`), so a player can place as many Azamis as coins allow. Per-girl caps therefore do not bound the totals. Every new object kind gets three caps. When a cap is full, the **oldest object is removed first** (lowest uid), which is deterministic.

| Thing | Per girl | Per player | Per sim |
|---|---|---|---|
| Road objects (strips, nets, thorn beds, extra traps, ability barricades) | Azami 12 (20 with Iron Discipline) + her Spike Rain; Norika 4 | 80 | 160 |
| Straight shots (pins, blades, fragments) | Kinu 60 | 200 | 400 |
| Path runners (balls, shades, plow, dragon) | Sorano 16 shades; Marumi 6 balls | 24 | 48 (a hero ult runner is never evicted) |
| Sentries and other deployables | Yuzuha 6 + her Emergency Deploy | 24 | 40 |
| Zones | 2-3 | 12 | 24 |
| Roaming bodies (drones, pets, firebird) | per kit | — | 80 |

**Benchmark before merge** with the chika-rework §8.8 method: 6 copies of each new girl at her strongest tier-5 build, an immortal enemy every 2 steps on every path (about 2,345 live enemies), µs per step in V8 and JavaScriptCore. Gate: no slower than today's kit at that density.

### 7.3 What survives the end of a wave (r2)

Battle save (#170) snapshots only between waves. The rule: **anything with a lifetime ends at the wave clear; anything placed as part of a girl's build stays and is snapshotted.** ABILITIES §0 already ends every ability effect at the wave clear.

| Object | At the wave clear | Battle save |
|---|---|---|
| Yuzuha's sentries (base and Emergency Deploy) | end | nothing to save |
| Yuzuha's capture net | stays; budget refills at the next wave start | snap: spot, budget |
| Azami's strips | end, **except** Sticky Tar strips, which carry | snap: carried strips (spot, hits left, ttl) |
| Spike Rain strips, extra traps | end | nothing to save |
| Kinu's pins, blades and heat rings | end | nothing to save |
| Kinu's orbit scissors | derived from the tick | derived |
| Ouka's banners | stay | snap: positions |
| Wakaba's Hydrated charges, Time Out | end | nothing to save |
| Chigusa's thorn beds; vine holds (statuses on enemies) | end | nothing to save |
| Sorano's firebird; Ruri's pet; Hana's falcon | fly home and dock, like Chika's drones | snap: a drone-style row (position, cooldown, counters) |
| Sorano's meteor lines and star shades | end | nothing to save |
| Marumi's balls, pins and giant ball | end | nothing to save |
| Tenka's gravity wells | end | nothing to save |
| Tenka's absorbed-girl record | stays | snap |
| Norika's own barricades | stay; budgets refill at the next wave start | snap: spot, budget |
| Hold the Line barricades | end | nothing to save |
| Iroha's mirror (aim point) | stays | snap (B3 aim keys) |
| Kogane's position, move cooldown | stays | snap (`x, y` already; `moveCd`) |
| Seiran's dragon, Kogane's plow | end | nothing to save |

Every new key is classified in the battle-save key tables (`KNOWN_TOWER_KEYS`, `KNOWN_SIM_KEYS`, and a drone-style table for pets) by whichever branch lands second.

---

## 8. Suggested build order

The engineering backlog with efforts, dependencies, parallel lanes and approvals is **UNITS_BACKLOG.md**. In short:

| Wave | Contents | Why |
|---|---|---|
| **0: systems** | ABILITIES A0–A3 (abilities + bar UI); P-2 co-op `aim`; P-16 owner coins; B3 tests (#138); the Chika flight-mode addendum (ABILITIES §17) | Every ability and every aimed girl depends on these |
| **1: cheap new girls** | **Azami** (P-3), **Yuzuha** (P-3 + anchored turrets), **Kinu** (P-7); **Ouka** (P-9) as the fourth if capacity allows; Momo bounty (P-9, P-14); Builder 4 data for the planned 11 | Each reuses code that is already there, and together they answer most of the owner's "heart" list (sentries, spikes, ring, rules hub) |
| **2: road, allies and the Codex five** | **Marumi** + **Seiran** dragon ult (P-5, P-17); **Chigusa** (P-10, P-4); **Wakaba** (P-8); **Yoriko** hex (P-15); **Ruri** pet (P-6 after #166 merges, plus P-10); **Iroha** reflect; **Hana** flier; Yuki and Midori zones | Once the path runner and the zone exist, each later user costs S |
| **3: heavy** | **Sorano** (P-6, P-4, P-5); **Tenka** (P-13, P-4); **Norika** (P-11, P-17) | New engine surface, so each one needs its own determinism and performance tests |
| **4: optional** | **Kogane** (P-12); future-slot kits (Tomoe, Hiiro, Mizuha, Sayo) | P3 |

---

## 9. Questions for the owner

Decided in r2 (no longer questions): abilities unlock at **tier 3 of one themed ⚡ path** (ABILITIES §3.1; the tier 3 / tier 4 choice stays open in ABILITIES §16 Q1 with tier 3 as the default); Yoriko gets the **Puppet Hex skill**, not a placed stage; Momo has **one** ability, Market Day.

1. **The late-game request.** Did you mean the late-game powerhouse that absorbs nearby units (Tenka), a bigger money unit (Momo's Market Day and per-kill coins), or both? We propose both.
2. **Ruri as the beast tamer.** Should Ruri's fox become a pet that runs, pounces, grabs and carries, so she *is* our beast tamer? Or should she keep a fixed familiar while we add a separate animal girl? Default: Ruri becomes the beast tamer.
3. **Seiran's dragon.** Should the long sky dragon fly back along the road from the exit, or from a point you pick? Default: from your aim point if you set one, otherwise from the exit.
4. **Free core girls.** Should the spike, sentry and buff-thrower girls be free stage rewards (after 2-2, 4-2 and 6-5) so every player gets the core mechanics? Default: yes.
5. **Barricades.** A new girl (Norika, crossing guard), or give the job to the future swordswoman Tomoe as a melee "line holder"? Default: Norika.
6. **Pace.** How many new girls per release? Default: three at a time, starting with Azami, Yuzuha and Kinu, after the ability system.
7. **Shared names.** Noa, Iroha, Kanna and Tsubaki share given names with students of a well-known academy game. Keep the names with clearly different looks (default), or rename them?

---

## 10. Critic resolution (r2)

| # | Finding | Status | What changed |
|---|---|---|---|
| H1 | GAPS and ABILITIES used incompatible ability rules | **Fixed** | ABILITIES §5 is the single source of truth (header note). Every ability unlocks at tier 3 of a themed ⚡ path and is upgraded at tier 5. §4.1's column and §5.1's convention point to it; every §5.2–5.12 path table marks the ⚡ path, unlocks the ability at T3, makes T4 a stat tier and upgrades at T5; every ability name differs from every tier name. The GAPS-only girls are in ABILITIES §5.3; its orphans (Parade March, Lock-on, Collapse, Withdrawal) are removed there |
| H2 | No spec for Chika's flight modes; the command could not carry a patrol | **Fixed** | ABILITIES §17 is the addendum: `fly[uid, mode, qx, qy]` + `flyB[uid, qx, qy]`, follow = fly to the last tapped point (one command per tap, at most 4 per second), hunt = map-wide leash with path-order targeting, a deterministic patrol anchor, the freeplay benchmark and the §8 balance re-run with the approved boss buff. §3.D2 and §6.1 point to it |
| M1 | Auto-cast coins split between players | **Fixed** | P-16 owner-credited coins (§7.1); used by Momo, bounty, harvest and Tenka; ABILITIES §7.1 and its lockstep test |
| M2 | No target-girl slot in `abil` | **Fixed** | One shape: `abil[uid, group, qx, qy]`; the target is the girl nearest the aim point (≤ 0.6 tiles, ties to the lower uid) at the command's tick (§5.6, P-1) |
| M3 | "All 11 new girls are unique" was overstated | **Fixed** | Chigusa's vine and Sorano's firebird moved into their base kits; Ouka's base is now a price and sell rule, not a range aura; Tenka is labelled a shooter at base. Recounted: 18 of 35 (51%) unique at base (§2.4) |
| M4 | No rule for what survives a wave | **Fixed** | §7.3 table, plus a wave-end line on every girl |
| M5 | Per-girl caps do not bound totals | **Fixed** | §7.2 per-player and per-sim caps, oldest-first eviction, freeplay-density benchmark |
| M6 | Yoriko and Seiran numbers differed | **Fixed** | One `hex` (P-15, matching ABILITIES); Puppet Hex skill kept, Marionette Stage dropped; the dragon's rank 1–3 numbers live in ABILITIES §5.2 and go into B3's hero tracks |
| M7 | Momo had four abilities | **Fixed** | One ability, Market Day; the vault, Withdraw, Clearance Sale and Withdrawal are dropped (§6.1) |
| M8 | Iroha's second origin was both base kit and ability | **Fixed** | Both origins are base kit; the ability (Mirror Shift) moves the mirror and opens a reflect window |
| M9 | Ena's curse could stall a tick | **Fixed** | `CURSE_BURSTS_PER_TICK` = 32 with FIFO spill, plus a benchmark (§4.1) |
| L4 | Ouka's hook points slightly off; "six" keys | **Fixed** | §5.5 hook table, P-9; seven keys |
| L5 | Maths notes incomplete | **Fixed in part** | §7 now covers `**` (`towers.js:490`, `:530`) and `powInt` (`waves.js:34-48`). **Rejected part:** `pointAt` does not call `Math.atan2`. The facing is computed once when the path is built (`path.js:42`) and `pointAt` reads the cached value (`path.js:102`), so it is plain arithmetic at runtime |
| L6 | Kinu's straight shots need overrides | **Fixed** | §5.4 and P-7: `spawnStraight` with its own `maxTravel` |
| L7 | Tenka's open points | **Fixed** | Near-exit hook before the exit; `owners` cleanup on absorb; `t.owner` is the ownership rule (§5.10) |
| L8 | Wakaba's targeting contradicted itself; Recovery Plan uncapped | **Fixed** | Highest total `damageDealt`; Recovery Plan at most 10 lives per battle, never above the start, never when healing is forbidden |
| L9 | Forks, joins and crossings | **Fixed** | P-17 shared stretches; Norika, Azami, Marumi and Sorano say how they use it |
| L10 | Kogane ignored the hero rework's move | **Fixed** | Kogane reuses `moveHero` / `_relocate` with downtime and cooldown; co-op `tmv` (§5.12, P-12) |
| L11 | Placeable banners missing | **Fixed** | Ouka's Rally Banner (Safety Code T3; two at T5); §3.E10; §0 row 18 |
| L12 | Originality checks | **Fixed** | Tenka is now a Coilgun Physicist; Noa's palette and hair changed; §4.3 check and owner question 7 |
| L13 | The owner's phrase in a public file | **Fixed** | Rephrased as "late-game powerhouse with an offering"; the quote stays on the owner page |
| L14 | Small factual slips | **Fixed in part** | Kage's Veil Sight is base kit (§2.1, §3.E4); Ouka's cost is now 550, inside the SR band; "seven" planned girls need a re-dress (§4.2). **Rejected part:** `CC_TYPES` is defined at `status.js:8` in wt-roster `3c47a32`; line 7 is the comment above it, so the reference stays |
| L18 | Hana's path names repeat Aoi's | **Fixed** | Builder 4 renames Hana's paths and tiers (§4.1); ABILITIES uses the new ⚡ path name |
| L19 | Kaede's dash | **Fixed** (ABILITIES) | The dash is drawn only; §6.2 applies the same rule to Hiiro |
| L21 | Look list still allows fantasy outfits | **Fixed** | A data guard for new girls (§4.2) |
| Others | L1–L3, L15–L17, L20, L22 | — | In ABILITIES and WHAT_ELSE, which list their own resolutions |

---

## Appendix: evidence index

**Live** (`/home/user/sakura-game` @ `ffc4d23`)

| Area | File:line |
|---|---|
| Behaviour dispatch | `src/sim/towers.js:567-575` |
| Default target mode | `src/sim/towers.js:63` |
| Multi-projectile | `src/sim/towers.js:379-402` |
| Projectile spawn (needs a target; fixed `maxTravel`) | `src/sim/towers.js:311-316`, `:349` |
| Straight-flying projectiles | `src/sim/towers.js:311-357`, `:635-700` |
| Squared distances with `**` | `src/sim/towers.js:490`, `:530` |
| Aura merge, cleanse, cost cut | `src/sim/towers.js:178-210`, `:189-194`, `:196`, `:214-222` |
| Traps | `src/sim/towers.js:506-520`, `:522-549`, `:729-762` |
| Turrets | `src/sim/towers.js:551-566` |
| Tower update | `src/sim/towers.js:611-618` |
| Effective stats | `src/sim/towers.js:126` |
| Hit and type chart | `src/sim/combat.js:73-75`; `src/data/types.js:33` |
| Knockback | `src/sim/Sim.js:342-348` |
| Kill, leak | `src/sim/Sim.js:381-390`, `:392-404` |
| Income | `src/sim/Sim.js:453-461` |
| Place (formation check only), upgrade cost, sell value | `src/sim/Sim.js:556`, `:575`, `:628-651`, `:654`, `:670-673`, `:676` |
| Global rate buff | `src/sim/Sim.js:204` |
| Hero ult | `src/sim/hero.js:143-181` |
| Enemy movement, exit and leak | `src/sim/enemies.js:449`, `:450-453`, `:158`, `:265`; traits `:20` |
| Path facing (built once) and `pointAt` | `src/sim/path.js:42`, `:94-105` |
| Whole powers | `src/sim/waves.js:34-48` (`powInt`) |
| Immobile check | `src/sim/status.js:89-92` |
| Air check | `src/sim/combat.js:24` |
| Placement | `src/sim/placement.js:1-13` |
| Crosspath rule | `src/sim/mods.js:245-256` |
| Constants | `src/sim/constants.js:16`, `:50` |
| Vocabulary | `src/data/types.js:62-75`, `:81-88`, `:90-110`, `:137-158`, `:170-176`, `:182`, `:275` |
| Co-op commands (4-argument limit, owners, sell, cash split) | `src/online/coop/commands.js:21`, `:50`, `:84`, `:98`, `:123-138`, `:149`, `:153-160`, `:190-202` |
| Determinism | `src/core/detMath.js:205`, `:216` |
| Track forks and joins | `src/core/track.js:16-19`, `:337` |
| Kage innate Veil Sight | `src/data/units.js:770-771` |

**Roster B3** (`/home/user/wt-roster` @ `3c47a32`)

| Area | File:line |
|---|---|
| Mortar, aim, relay | `src/sim/towers.js:616`, `:668`, `:698`, `:731`, `:754`, `:779` |
| Damage buff, push lock, gather, curse, aim | `src/sim/Sim.js:228`, `:369-375`, `:378`, `:386-399`, `:444-447`, `:456`, `:794`, `:821` |
| Constants | `src/sim/constants.js:102-122` |
| Hero ults | `src/sim/hero.js:179`, `:212`, `:233` |
| Statuses | `src/sim/status.js:8`, `:26`, `:47-60` |
| Look enums | `tests/data/units.test.js:42-51` |
| Future slots | `src/data/future.js:31-110` |
| Planned kits and path names | `docs/merge/ROSTER_SPEC.md` §5.2 (Hana `sky`/`mark` paths; Seiran ult `Dragonflight`) |

**In-flight specs** (scratch `four-features/`)

| Spec | Sections used |
|---|---|
| chika-rework SPEC r2 | §0 (4.0-tile leash), §3.1-3.2 (drone record and step), §5 (battle save), §8.8 (lockstep cost), §13 Q3 |
| hero-rework SPEC r2 | §1 decision 7 (move), §7 (`_relocate`), §8.2 (`hmv`), §11 (B3 writes hero tracks) |

**Codex** (formatted copies of the old build's modules)

| File | Lines |
|---|---|
| `combat-expansion.js` | L264-270 (bounty), L271-279 (mend), L358-361 (execute), L415-420 (zones), L466-470 (trap aim point), L497-500 (sentries) |
| `expansion-roster.js` | L268 (Seiran "sweeps a selected lane segment") |
