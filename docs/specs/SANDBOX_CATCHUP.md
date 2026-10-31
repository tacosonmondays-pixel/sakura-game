# Sandbox catch-up (v0.1.66 audit)

Owner request: "update sandbox so it catches up with the new levels and stuff."

The Sandbox (`#/sandbox`, `#/sandbox/team`; `src/systems/sandbox.js`, `src/ui/screens/sandbox.js`,
`src/ui/battle/sandboxPanel.js`, `createSandboxSim` in `src/ui/battle/setup.js`) was last changed around Gate Arc S6c.
This file lists what a real player can have or face on `main` v0.1.66 (`fc978aba`, sim id `b2ff5e0e884b`,
`COOP_PROTOCOL` 14) that the Sandbox could not reproduce, and what `feature/sandbox-catchup` does about each gap.

## 1. Gap list (before this branch)

### 1.1 Levels and progression caps

| Axis | A real player's max (v0.1.66) | Sandbox before | Gap |
|---|---|---|---|
| Level | 85 (`MAX_LEVEL`, needs P6) | 60 (`BREAKTHROUGH_LEVEL_CAP`) | **yes** |
| Breakthrough gates | 10 (`MAX_BREAKTHROUGH`; gates 6–10 need P2–P6) | 5 (`gatesAllowed(1)`) | **yes** |
| Potential | P6 (`pl: 6`; the sim reads every step) | P1 | **yes** |
| Awakening | ★5 (`MAX_AWAKEN`) | ★5 | no |
| UR Resonance (★5 SSR) | ×1.10 damage, ×1.04 speed from the Nov 2 game week (`resonanceOn`) | follows the clock (★5) | no (clock-gated for everyone) |
| Limit Break / LR (Tenka, Kohaku & Tsubaki) | LR form + LR boost (`lr:<id>` counter) | never LR | **yes** |
| Bond | 0…`BOND_MAX` | — | no battle effect (menus and scenes only) |
| Attack-shape tiers, paths, final tier, abilities and ultimates | bought in battle with coins; ability ranks from tier 5 / hero level | 999,999 coins | no |
| Hero level and Mastery | earned in battle (Lv 25 + Mastery) | earned in battle | partly: a run started at a late wave starts the hero at Lv 1 (open question 3) |
| Lower builds | any level / P / ★ | only the one fixed build | **yes** (testers could not compare a fresh girl with a maxed one) |

### 1.2 Units

All 39 units in `UNITS` were already offered (the roster list is `UNITS` itself), including the duo LR
`kohaku_tsubaki`, Tenka, and the held heroes Kogane and Norika (`HELD` in `src/data/banners.js`: nobody can recruit
them yet, but their kits exist and the Sandbox may field them). The gaps were their *builds*: no LR form for the two
LR units, P1 caps for everyone. Nothing kept a future unit from being forgotten except that the list is `UNITS`.

### 1.3 Gear (v0.1.66 gear update)

Sandbox girls fought with **no gear at all** (`gear: {}`). Missing:

- the five slots (charm, ribbon, shoes, hair clip, necklace; the hair clip and necklace are set-only slots);
- rarities, UR (+12, gold and rainbow ✦), Set LR and Blank LR (+18, the Nightglass ✦, raised caps; five Blank LR
  pieces double every cap);
- pins (Tie Pin on the main stat, Collar Pins on substats: one, two on LR);
- the six sets (Spirit Squad, Freeze Tag, Geometry Set, Party Popper, Treasurer, Power Bank) with their 2-piece stat,
  4-piece passive, 5-piece set cap and the LR Set Form (five Set LR pieces of one set);
- clubs (3 + 2 splits) and Every Line Counts fill-in;
- loadouts (saved gear per team): nothing to reproduce beyond "what she wears".

### 1.4 Maps, stages and modes

The map step offered one card per map, playing the **first** stage drawn on it, always endless (`options.endless`).

| Content | Before | Gap |
|---|---|---|
| Campaign Act I (1-1…8-5) and Act II (1-6…6-10, Gate Arc incl. lane schedules, rooftops, blackout) | every map, its own stage | no |
| Side stage `side-6-starfall` | yes | no |
| Bounties (15 stages on 5 arenas, three tiers each) | only tier 1 of each arena (tiers 2–3 share the map) | **yes** |
| Total Assault (3), Tactical Challenge / colosseum (1) | yes | no |
| Events: Halloween 2026 (`ev-halloween-1…4`, `ev-halloween-boss` and its Nightmare variant) | not in `STAGES`, never offered | **yes** |
| Titan Trials (4 titans × Normal / Hard / Nightmare / Mayhem, Mayhem ranks 0–30) | not offered | **yes** |
| Solo freeplay (Blossom / Tempest / Crimson Moon) and its high waves: affixes, elite mods, titans, the Ashwing Matriarch at wave 200, the Eclipse Wyrm from 250 | not reachable: `endless: true` switches freeplay off in the Sim | **yes** |
| A start wave (e.g. wave 200) | always wave 1 | **yes** |
| Codex battle modes (Reverse, Rush, Ironclad, Frugal, Last Stand) | always Standard | **yes** |
| Difficulties | Easy…Nightmare | no (no new tier; Mayhem is Titan Trials only) |
| Co-op freeplay (enemy HP ×1.6 for two players) | solo only | by design (Sandbox is solo) |
| Tryout Day (roguelike runs, Pep Talks, Desk Supplies) | not offered | by design for now (open question 4) |
| Clan boss | not offered | by design (server-scored) |

### 1.5 Enemies

Every family in `FAMILIES` (13, including the Brigade) was in the spawn picker, and every enemy in `ENEMIES` (96).
Missing: the event-only **Gourdlight** (`construct_gourdlight`, `EVENT_ENEMIES`), which lives outside `ENEMIES`.
Titan-strength bosses (Titan Trials HP pools) were not reachable; freeplay titans, the Matriarch and the Eclipse Wyrm
could be spawned but only at their base HP.

The panel's "Send next wave" during a wave also dropped a freeplay spawn's own HP factor, speed, leak and affix mods
(it only mattered once freeplay was reachable).

### 1.6 Guards (checked, unchanged)

- `isSavableRun` refuses `req.sandbox`: no battle save.
- The controller sets `ctx.applyResult = sandboxOutcome` and `results.apply` never commits or saves for a sandbox run;
  `applyBattleResult` also returns early on `result.sandbox`.
- `creditLimitBreak`, friend support (`supportOk`), the solo freeplay ledger (only for `req.freeplay` / `req.keepGoing`,
  which a Sandbox request never sets) and the titan tracker (`req.titan`, never set by the Sandbox) all stay out.

## 2. What this branch builds

- **Builds.** Every girl joins at the true maximum by default: L85, 10 gates, P6, ★5, and LR for an LR unit. A squad
  build row (Level, Potential, Awakening, LR, Gear) sets everyone; tapping a girl in the squad opens her own row, which
  overrides the squad's ("Same as squad" goes back). Lower values are allowed (any level from 1; Potential is raised
  to what the level needs; gates follow the level).
- **Gear presets** (virtual, sandbox-only, never in the save): None · Best Legendary (no set: charm, ribbon, shoes;
  the other two slots are set-only) · Legendary set × any of the six · UR set × any of the six · LR set (five Set LR of
  a set: the LR Set Form) · Blank LR ×5. Main stats come from the Build Coach row for that girl
  (`src/data/buildCoachData.js` via `coachPaths`), substats from her coach substat order; the club split is her
  coach's 3 + 2. The max-roll profile: every line at its best +0 roll, the piece at its top level (+10 / +12 / +18),
  its ▲ growths split over her two best substats, every ✦ slot it has stitched (gold, rainbow, Nightglass), the Tie Pin
  and its Collar Pins marked. The pieces are built by `sandboxGear` in `src/systems/sandbox.js` and read through the
  game's own `unitBattleStats`, so every cap, set rule and fill-in is the real one. (`tools/balance/maxedProfile.mjs`
  is a three-piece Taiko profile from before the gear update and lives outside `src/`; it is not reused.)
- **Stages by mode**: Campaign Act I, Campaign Act II, Side stages, Events, Bounties (every tier), Total Assault,
  Tactical Challenge, Titan Trials (titan, tier and Mayhem rank), and a Freeplay switch (tier) on any campaign stage.
  A **start wave** (1–999; quick picks 50, 100, 150, 200, 250) for any run; wave 200 on freeplay meets the Matriarch.
  Codex battle modes on campaign stages. Difficulty as before (event stages keep their own list).
- **Enemies**: the spawn picker lists event enemies too.
- **Coverage test** (`tests/systems/sandboxCoverage.test.js`): fails when a unit, stage, event stage, titan, freeplay
  tier, battle mode, gear slot, gear set, LR kind or enemy family is not reachable from the Sandbox's own lists.

## 3. Open questions

1. Max-roll profile: every line at its top roll is the ceiling; a "typical" (average roll) profile could be added as a
   second choice if testers want a realistic number.
2. UR Resonance follows the real clock (from the Nov 2 game week), as for players; a "Resonance on" switch would let
   testers see next week's numbers today.
3. A late start wave starts the hero at Lv 1 and the board empty with 999,999 coins; should a late start also level
   the hero to 25 + Mastery?
4. Tryout Day in the Sandbox (any Pep Talk, any Subject) would be its own small project.
