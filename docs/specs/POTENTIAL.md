# Potential: duplicate recruits raise a girl to P6 (build spec, revision 2; v3 on top)

> **v3 is what ships in train C** (the section right below). Revision 2 and its M0–M3 notes further down
> describe v1, the "small passives" ladder that went live in v0.1.34; everything they say about counting
> duplicates, the backfill and the shadow still holds, while v1's step table (§3.3), its signature box (§7.3)
> and its letter (§7.8) are replaced. The full v3 design (sizes, every ladder, mechanics N1–N17, the level cap
> and the DPS ladder) is the v3 spec in the design folder (`scratchpad/potential3/SPEC.md`), a delta on v2.

## v3 build notes (branch `feature/potential-v3`, from `origin/release/next` `c4f2220`, v0.1.35)

**What changes for players.** Every duplicate still adds 1 to a girl's Potential (P1 → P6, `potentialLevel`, the
one place that says where Potential comes from). Each step is now bigger than the one before: a stat boost on her
rarity's climbing track (R +4/+4/+4/+4/+5 %, SR +4/+5/+5/+6/+7 %, SSR and heroes +5/+7/+7/+8/+9 %; the two supports
spend an aura track, Momo a coins track, Nami her own), spent on her own axis, and from P3 (from P2 for SSR girls
and the three heroes) a kit step (✦) that amplifies what she is good at, up to a capstone at P6. Kage: all five
stat steps are attack speed, 8 % more shuriken per throw and 1 more armor ignored (P3, Shadow Edge), Shadow Tempo
(P4), +1 pierce (P5, Moonpiercer) and the Shuriken Storm every 8th throw (P6). P1 is bit-identical to before (the P1 `resolveStats` hash `456:30217027`,
`START`, every campaign golden).

**Stages (each committed on the branch).**

| Stage | What | Notes |
|---|---|---|
| V0 | Sim mechanics N1–N17 (`src/sim/potential.js`, hooks in `mods.js`, `towers.js`, `Sim.js`, `hero.js`, `combat.js`) | every key absent at P1; brews ≤ 4 girls |
| V1 | Data v3: the 19 rows (`src/data/potential.js`), the text table (`src/data/potentialText.js`: node label, long text, paper size, FX cue), Power | data, text and sim tests (§13.2) |
| V2 | Battle saves format 3 (`SNAP_V` 3: `pc`, `tp`, `pj`, `rk`, `rt`, `ab`, `oc`), `POTENTIAL_START` on the v3 line-up and `POTENTIAL_BOSS_START` (Grave Lych), co-op test | `COOP_PROTOCOL` 5, sim id `ff25094d81d8`; Node, Bun, Chromium and Firefox agree |
| V3–V5 | UI, migration from v1, the letter, docs | below |
| L0–L2 | Level cap 85 with Akashic Tomes, the Tome sources, the level-cap screens, the co-op plausibility clamp with its `potential` rule | below ("Level cap"); co-op sim id `132be3774582`, `COOP_PROTOCOL` still 5, `SNAP_V` still 3 |

**UI (v3 §11, v2 §7).**
- **Pills** (`src/ui/potential.js potPill`): P6 wears the five-petal Full-Potential crown (our own SVG); the title
  names her newest step ("Potential 5 of 6 — Moonpiercer") on cards, the unit sheet and the student page, whose
  showcase pill adds the next step ("Next: P5 unlocks ✦ Moonpiercer (1 more duplicate)").
- **Info tab** (`potentialSection`): the six-node track with ✦ on kit nodes, the crown on P6 and the stat line under
  each node (`+4% SPD`); the step list replaces v1's signature box (owned ✓, the next one with "NEXT · 1 more
  duplicate", later ones muted, Allies / Enemies / Coins chips, the capstone with the crown); the footer names the
  next step ("Next: P5 ✦ Moonpiercer with 1 more duplicate") and the capstone. The cap part of each line (`· 67`)
  and each row's "Level cap 72" come from `progression.potentialLevelCap(p)` (= `levelCapAt(5, p)`, every gate open)
  and show only where Potential raises the cap above P1's, so today (cap 60 at every P) they are hidden and L0
  turns them on without touching the UI.
- **Previews**: spark grid ("Owned · P4 → P5 ✦ Moonpiercer"), SSR Select Ticket confirm ("P1 → P2: ✦ Firefly
  Lamps") and its result card (the unlocked step and what it does), Mall Recruit Exchange ("Owned → P5 ✦ Maple
  Gale & fragments"), the reveal's duplicate card (a ribbon under her name: "✦ Moonpiercer", title "P5 unlocked: …").
- **"Potential up!" cards** (`showPotentialUp`, from `potentialRises`): after a reveal plays out, one card per
  girl who reached a kit step (highest rarity first, at most 3, then "And N more"): her art, "Kage · P5", the
  trick and its text, other tricks reached in the same recruit, "Level cap 72 → 78" once caps rise, "Next: P6 ✦
  Shuriken Storm — 1 more duplicate" or the crown and "Full Potential!", and stat-only rises as one "Also:" line.
  Next / Done, Skip all. **Skip** on the reveal goes straight to the results (no cards); the summary's "▲ N
  Potential (✦ N new tricks)" chip opens them again. The first-gain tip and the recruit rules / wiki rule
  (`potentialDupesRule`, one place) drop "small passives".
- **Battle panel** (`src/ui/battle/potentialRows.js`, drawn by `towerPanel.js`, refreshed every frame): the rhythm
  pips ("Shuriken Storm ●●●○○○○○ every 8th"; a trap rhythm "every 4th trap"), Kage's tempo pips (6, "+4%"), her
  shuriken per throw ("2 → 2.16 / throw"; Thousand Shadows "13 → 14.04") and Chika's drone overclock ("Throttle
  Up in 14 s", "+75% · 4 s left"). An ally's girl shows her owner's counts; a P1 girl has no rows.

**Gates B1 / B5 (measured, `tools/potentialBench.mjs`, seeds 9 / 21).** One girl on 4-5's best-covered spot,
strong stats, P1…P6 on the seven reference builds (0-0-0; x-0-2, 2-x-0, 2-0-x at 4 and at 5), against a crowd (an
immortal Orc Grunt every 0.1 s) and a held elite; E = √(crowd × held), the median over her builds. Six ladders sat
above their band or had a spike, mostly pierce and splash that multiplied every shot in a crowd. They are re-priced
with spec §9.4's knobs, and every step's `power` (`potentialText`) is now the bench's median step:

| Girl | E P6/P1 before → after (band) | What changed |
|---|---|---|
| Shiro | ×3.29 → ×1.84 (1.72–1.95) | Silver Line (P5): 2 more armor ignored on every shot, +2 pierce only on every 5th (a Silver Line round); White Heron (P6): every 4th shot, 50 % harder, no extra pierce |
| Kaede | ×4.63 → ×2.25 (2.1–2.45) | Maple Gale (P5) cuts within 0.1 tiles (was 0.6), at her plain damage: One Foe's +50 % lands on her target only (`towers.js` `procBase`) |
| Kage | ×2.45 → ×1.93 (1.72–1.95) | P3 8 % more shuriken + 1 armor (was +1 pierce), P5 +1 pierce (was pierce + 12 % shuriken), the Storm every 8th throw (was 6th, with +2 pierce) |
| Raika | ×2.29 → ×1.90 (1.72–1.95) | P3 1 armor instead of the lance's pierce; the column 25 % (was 35 %), Thunderhead 40 % within 0.8 tiles (was 70 % within 1) |
| Hotaru | ×2.11 → ×2.02 (1.85–2.15) | Firefly Parade +1 target (was +4, the P3 spike); Midnight Lanterns 80 % harder (was 60 %) |
| Aoi | ×1.57 → ×1.52 (1.5–1.68) | Through-Shot (P3): +3 % crit instead of the pierce (the P3 spike) |

B5 for the six: Power against the bench Shiro 0 %, Aoi −1 %, Kaede +8 %, Kage −1 %, Raika −4 %, Hotaru +2 % (±10 %).
Left as measured (bench limits, not ladder faults): Kaede's and Hotaru's P2 (a kept focus and an aura for others,
which one girl against immortal targets cannot show), Shiro's P4 on the Execution builds (their crit is already
high), Akane P3, Sango P3 / P5 and Chika P3 / P6 just outside ±30 % of the slot while in band, Rei's spread 1.36,
Yuki (frost is control), Suzu (trap placement) and Midori (%-HP poison on immortal targets). B6 re-measured for the
six: v3 ≥ v1 on every row (lowest ×1.016); the campaign is unchanged (P1 Easy 40/40, Normal 39/40; F2P and P6 win
every stage P1 wins). Kage's battle panel at P6 L85 inside Miko 5 + Umeko 5, full tempo: MAXED 53.0k, best gold
69.3k, UR 83.9k (spec §8.1's 57.0 / 74.6 / 90.3k were the old ladder). Co-op sim id `bfd51a8d8cc4`,
`COOP_PROTOCOL` still 5; `POTENTIAL_START` and `POTENTIAL_BOSS_START` re-pinned (the scripted player now waits for
a placement in flight before it queues an upgrade). Bench: `node --import ./tools/simLoader.mjs
tools/potentialBench.mjs --girls kage,shiro --out b1.jsonl`, then `node tools/potentialBench.mjs --report b1.jsonl`.

**Migration from v1 (v3 §12, v2 §8).** No `SAVE_VERSION` bump; `dupes`, the shadow and the backfill are untouched,
so every girl keeps her P and fights with the v3 steps of it at once.
- **Nothing got weaker (gate B6, measured).** `BALANCE=potential` (`tests/integration/potential.balance.test.js`)
  runs every girl with her v3 steps and with her v1 steps (`tests/fixtures/potentialV1.js`, the v0.1.35 table) at
  P2…P6, strong build, 4-5: crowd 40 s and held target 60 s, seeds 9 / 21. v3 ≥ v1 everywhere; the lowest is Suzu's
  held-target row at P5 (×0.975 over 8 seeds and 120 s: traps against one held enemy are placement luck, and v1's
  +3 % range only moves where they land; its tolerance is 5 %, every other row's 1 %). Most rows climb from about
  ×1.02 at P2 to ×1.4–3.8 at P6 (Midori's %-HP poison makes her rows huge against the bench's immortal targets).
  Aoi inside Miko's / Umeko's aura ×1.01–1.32, Momo's wave income ×1.03–1.14 at every tier. Campaign (balance bot,
  seed 1): P1 Easy 40/40, Normal 39/40; F2P Potential and P6 win every stage P1 wins (40 / 40 on both). v1's
  "every step stays small" bands are gone from that file with v1.
- **The letter.** v1's `potential-arrived-1` already reached v0.1.34 players, so v3 writes its own letter,
  `potential-v3-1` "Potential grew!", once (`ensurePotentialLetter`, app start and lobby): every save without the
  seenIntro mark `potential-v3` is an older build's; it is marked, and if some girl is at P2+ the letter lists every
  such girl highest first with her newest step ("Kage P5 ✦ Moonpiercer, Kaede P3 ✦ Breeze Step, Aoi P2 (+4%
  damage)", 12 names then "and N more", " · level cap 78" for a girl whose five gates are open), says the cap rises
  with Potential once all five gates are open (up to 85 at P6) and that each level above 60 uses one Akashic Tome
  (the four sources), says nothing got weaker and points to the Info tab. A save that was backfilled and never got
  v1's letter also reads how its duplicates were counted. New saves are born with the mark (`createProfile`), so
  they never get it. v1's letter is not sent any more: a backfilled save gets `potential-arrived-1` in
  `mail.delivered` (marked, never sent), so an older build's tab does not mail its outdated text either.
- **NEW badge.** Each girl at P2+ when the letter came gets `pot3-new:<id>` in seenIntro: a NEW badge on her card
  until her Info tab (student page or unit sheet) is opened.
- **Battle saves** from before v3 (format 1–2) restore with the v3 steps of the saved P (their counters at 0);
  when a girl in one is at P2+, Continue says "This run continues with Potential's new effects."

**Level cap (L0–L2, v3 §4).**
- **The rule** (`src/systems/progression.js`): `LEVEL_PAST_GATES` is the one table for the levels past gate 5 — her
  cap at P1…P6 (60 · 63 · 67 · 72 · 78 · 85) and the price of each level above 60 (30,000 EXP, i.e. one Akashic
  Tome, and 12,000 coins). `levelCap` = 10 + 10 × gates below gate 5, else her Potential's cap (a P6 girl at gate 3
  stays at 40; there is no gate 6: the duplicate is the gate). `expForLevel` is 30,000 from 60 to 84; `MAX_LEVEL`
  85. Her growth continues (L85 ★5 gate 5: damage ×2.862, rate ×1.336; ×1.283 her L60 DPS). Coins are charged per
  band (0.4 per EXP up to 60, 12,000 per 30,000 EXP above). A later ascension (level gates paid with family
  materials and a crown) replaces or extends this table and `levelCapAt` (the rule, with her P passed in;
  `levelCap(state)` = `levelCapAt(gates, potentialLevel(state))`); the duplicate → Potential source stays
  `potentialLevel`, with its inverse `potentialState(p)` and the duplicate-past-P6 payout `DUPE_PAST_MAX_TOMES` next
  to it, so no other code says P = 1 + duplicates. Not co-op hashed.
- **Saves** (no `SAVE_VERSION` bump): `cleanUnit` lets a girl past gate 5 keep any level up to 85 (her duplicates
  may not be known yet); `migrateProfile` runs `settleLevels` after `creditPotential`: it lifts a girl an older
  build clamped to 60 back to `min(lv:<id>, levelCap)` (the level shadow in `missions.counters`, written by
  `levelUp` above 60) and clamps every girl to `levelCap` (EXP 0 when clamped). A hostile shadow never lifts above
  the cap, and only a girl at 60+ is lifted. The profile card viewer and the co-op ally mini profile clamp to
  `levelCapAt(breakthrough, p)`. Sandbox girls fight at their P1 cap (60).
- **Akashic Tome sources** (none sold for gems): Library Courtyard III on Nightmare 5 % → 20 % (`STAGES`: the co-op
  data id changes); a freeplay cache adds one Tome, at most 2 a week per account, solo and co-op sharing
  `fpTome:<weekKey>` (added after the cache rolls, so every other drop is unchanged; a new week's key deletes the
  old); the Bounty Exchange row `bty_book_tome` (40 Bounty Tokens, 2 a week); duplicates past P6 pay SR 1 / SSR 5
  Tomes (R none) besides their fragments. Item info lists all four.
- **Screens**: the Level Up tab's "Cap 72 · P4 · max 85", at the cap "P5 raises it to 78 (1 more duplicate)", above 60
  "Lv 72 → 73 · 30,000 EXP (1 Akashic Tome) · 12,000 coins"; at gate 5 the breakthrough card is the Potential cap
  card ("Level cap 72 · Next: 78 at P5 (1 more duplicate)", "Level cap 85 · Full Potential", the six caps); gate 5's
  text names the cap her Potential opens. The Info tab's `stat · cap` lines, each step's "Level cap 72", the "Level
  cap 72 → 78" line on a "Potential up!" card and the letter's " · level cap 78" light up from the rule. Recruit
  summary "+5 Akashic Tomes", spark / select-ticket / P6 footer copy ("Star Fragments (+40 each) and 5 Akashic
  Tomes"), the wiki (Leveling: the table to 85 and "Above 60: one Akashic Tome per level"; Potential: the level-cap
  row and the four sources).
- **Co-op** (`src/online/coop/statLimits.js`, hashed): the plausibility clamp with gear's ceilings (`damageMul` ≤ 10,
  `rateMul` ≤ 5, `level` 1–99, …) and the `potential` rule (integer 1–6), one rule per unit-stat key, at most
  towersPerPlayer + 1 girls a player; `session.js` `begin()` clamps the start message on both clients, and the
  lockstep (`clampStarts`) clamps the host's start again in a resync or rejoin and rebuilds any girl whose
  checkpointed stats are not what her clamped entry gives (`rederiveStats`). Honest L85 P6 loadouts and honest
  checkpoints pass through unchanged.
- **Tests**: `tests/systems/progression.test.js` (the table, `levelCap` gates 0–4 × P1–P6 and gate 5 × P1–P6,
  `expForLevel(59)` 50,300 / 60…84 30,000 / 85 ∞, `totalExpToLevel(85)` 1,856,630, 12,000 coins a level, the band
  split across 60, overflow at the cap, Auto Select to 85, L85 stats, the shadow, `settleLevels`, `levelCapInfo`),
  `tests/systems/save.test.js` (L60 P1 unchanged, L72 P4 round trip, `dupes: null` kept then re-clamped, an older
  build's clamp restored, hostile shadows), `tests/systems/levelTomes.test.js` (the four sources, the weekly cap
  shared by solo and co-op, the rng stream), `tests/online/coopStatLimits.test.js` and the lobby case in
  `tests/online/coopSession.test.js`, `tests/online/profileCard.test.js`, `tests/integration/missionCounters.test.js`
  (the `lv:` / `fpTome:` prefixes), `e2e/potential.mjs` (the cap line, both cap cards, a level-up past 60 with a Tome,
  the "Level cap 63 → 67" card line).

**Patch note draft (train C; the shipping stage adds it to `src/data/patchNotes.js` under the deploy's number):**
"Potential got much bigger! Every duplicate still raises a girl from P1 up to P6, and now every step makes her clearly
stronger: a stat boost at every step and, from P3 (P2 for SSR girls and heroes), a new trick built on what she does
best, up to a capstone at P6 with a Full Potential crown. Your girls keep their Potential and get every step they
have earned right away. Every step also raises her level cap, up to level 85 at P6. Levels above 60 use Akashic
Tomes, now found more often in Library Courtyard III on Nightmare, in Freeplay caches (up to 2 a week), in the Bounty
Exchange, and from duplicates past P6. Nothing got weaker: P1 is exactly the girl you know."

**Tests.** `tests/integration/potential.balance.test.js` (B6 and the campaign, opt-in), `tests/systems/potential.test.js` (step info, next step, pill title, chips, the `stat · cap` line with a
rising cap rule, `potentialLevelCap`, recruit rises, the duplicates rule), `tests/systems/mail.test.js` (a v1 save,
a pre-M0 save, a v3-born save, an all-P1 save, the 12-name list, the cap phrase, the NEW badge round trip),
`tests/battle-ui/potentialPanel.test.js` (Kage's storm and tempo pips and shuriken line, Chika's overclock, ordinals,
a P1 girl without rows, in a real battle), `tests/battle-ui/snapshot.test.js` (`potentialNew` on a format-2 save),
`e2e/potential.mjs` at 844×390 touch and 1280×720 (every screen above, the letter, the badges, no sideways scroll).

**Not built here (next stages):** the clan-boss constant (gate CB: needs P6 L85 UR rows, UR gear is the next
build); attack FX for v3's events (`proc`, `nova`, `tempo`, `dotSpread`, echo
volleys) and the crown ring on the field (render, v2 §7.8); the Sandbox P1–P6 picker (v2 §7.7); the §13.1
measurement gates not run above (B2–B4, B7, B8, T1, H1, C1, F2–F6, P1, CB, E1) on the integrated train C tree.

---

## Revision 2 (v1, live in v0.1.34)

Sakura Sentinels. Live branch read-only at `ffc4d23` (v0.1.25 + the UR awakening merge; the sim is unchanged since
`9bede1e`). Written 2026-10-14; revision 2 answers every issue in `CRITIC.md` (§15). Roadmap task #165.
Co-op compatibility id: live `06763e510bb4` (34 graph files); the freeplay branch makes it `1c2f9ecd5d81` (37 files);
Potential changes it once more (38 files).

**The owner's words (verbatim):**
> "Can you add potential levels when you get dupes, perhaps they get small passives, and increase level by 1-5 per dupe max 6! do this after coop stuff and freeplay"

Then the owner chose: **"+1 Potential per dupe, max 6"** (P1 base → P6 after 5 dupes; each step a small passive) and
**"Both: a dupe gives Potential and its usual Star Fragments; once at P6, dupes give fragments only"**.

**Inputs:** the live code (quoted as `file:line` at `ffc4d23`); the freeplay worktree `wt-freeplay` (`aa8613a`, its
sim is what freeplay will ship) and its spec; the battle-save worktree (`ca51e48`) and spec; the roster B3 WIP
(`wt-roster` `3c47a32`, `ROSTER_SPEC.md`); the story WIP (`wt-story` `165030f`, `STORY_SPEC.md`); the unit-info WIP
(`wt-unit-info` `831162d`); `specs/KIT_STYLE_SPEC.md`; the attack-fx worktree. Every number below was measured with
the scripts in `exp/r2/` (Appendix) on the real sim with the revision-2 overlay; nothing in any repo was written.

**Rules for anything built from this:** our own names and words only; the academy girls are students and nothing
about Potential is framed around anyone's body (it is "she trains harder", never looks); rewards and costs stay
data-driven, and nothing here adds a currency, a price or a reward.

**What changed since revision 1** (details in §15): every step is now *relative* (a percentage of her own damage,
speed, range or coins, applied like her level and gear, so it reaches traps and drones and is the same size at level 1
and level 60); flat range, trap, armor-ignore and income bonuses are gone; aura steps are smaller and budgeted
team-wide; Kage's signature no longer adds crowd damage; the Potential section lives on the never-locked **Info** tab;
the invisible counter (M0) must ship no later than the roster; the backfill is reported per rarity and is cautious for
SSRs; a shadow copy keeps Potential from going down; determinism is measured in all three engines.

## M0 build notes (branch `feature/potential-m0`, from `claude/sakura-sentinels` `ffc4d23`)

M0 is built: counting starts, nothing on screen or in the battle changes.

- **Code:** `src/systems/potential.js` (new, M0 part of §4.1: `MAX_POTENTIAL`, `potentialLevel`, `POOL_SIZE_V0125`,
  `RARITY_SHARE`, `poissonQuantile`, `shadowPotential`, `backfillDupes`, `restoreFromShadow`);
  `unlocks.js grantUnit` (§4.2: +1 `dupes`, shadow, returns `potential` / `potentialUp`; fragments unchanged);
  `save.js` (`newUnitState.dupes = 0`; `cleanUnit` → `null` when missing; `createProfile` writes the starters' shadow;
  `migrateProfile` → `creditPotential`: `restoreFromShadow`, then `backfillDupes`, then the `'potential-backfilled'`
  marker; the shadows are rewritten with `pot:at = now` only when a count was set or a shadow is missing or differs,
  so loading the same save twice gives the same profile).
- **One timestamp for spark and Select Ticket.** `spark()` and `redeemSelectTicket()` now stamp the grant and the history
  entry with the same `Date.now()` (§6.1 noted a 1–2 ms skew). The stale-tab restore counts history entries strictly
  after `pot:at`, so a skewed entry would have counted twice. Old entries with the skew are still handled by the 2 s
  first-copy window.
- **Shadow from the start.** `createProfile` writes `pot:<starter> = 0` and `pot:at`, so a brand-new save opened by an
  out-of-date tab is restored from the shadow, not re-estimated.
- **Defaults used (§14):** Q1 (a) cautious Poisson 25th percentile for SSR, floor λ (average luck) for R and SR;
  Q2 yes: sparks, the Mall Recruit Exchange (a spark) and SSR Select Tickets on an owned girl count as duplicates.
- **Not in M0** (unchanged from §13): `pull()` result fields, `unitBattleStats`, `unitPower`, the data file, the sim,
  `version.js`, every screen, the letter. `pull()` results are unchanged; `spark()` / `redeemSelectTicket()` already
  spread `grantUnit`, so they carry `potential` / `potentialUp` (no screen reads them yet).
- **Checks:** co-op compatibility id `06763e510bb4` before and after (`tools/simId.mjs`); `SAVE_VERSION` stays 2;
  `migrationDropsData` unchanged. Tests: `tests/systems/potential.test.js` (every source: 10-pull, single, spark,
  Select Ticket, Mall exchange; backfill per rarity and every §6.2 edge case; the stale tab; old saves; the property
  test over 200 seeded profiles), `tests/systems/rewards.test.js` (grant). e2e: `e2e/potential-m0.mjs` (a real 10-pull
  of owned girls adds 10 and survives a reload; a pre-M0 save is backfilled; nothing about Potential on screen) at
  844×390 and 1280×720.
- **Sample backfill** (600 real recruits, one 10-pull a minute, Yuki and Kage from stage clears; saved as a pre-M0
  build would, last 100 entries kept): R girls 110–120 credited vs 113–130 true (all P6 either way); SR girls 6–15 vs
  5–18 (all P6 either way); SSRs Chika P2 vs P5, Hotaru P2 vs P3, Kaede P2 vs P3, Luna P1 vs P3, Hikari P2 vs P2. The
  cautious SSR rule under-credits here, as §6.3 predicts. At 200 recruits SR girls land within ±1 step.


## M1–M3 build notes (branch `feature/potential`, from `claude/sakura-sentinels` `fddf01c` + M0)

M1 (data + sim), M2 (UI) and M3 (letter, docs) are built. Co-op compatibility id **`ff514386004d` (37 graph files) →
`da374934b0c3` (38 files: + `src/data/potential.js`)**; `COOP_PROTOCOL` unchanged (hero's 4 covers train C).

**Seams (LANDING_PLAN §4):** S7 `resolveStats` order is paths → hero levels → awaken passive → Potential ModSets →
`applyUnitStats` with the whole-girl multipliers folded into the unit stats; hero growth/Mastery (hero branch) slots in
before the awaken passive unchanged. S9 the data hash list ends `…, COOP, FREEPLAY, POTENTIAL_LADDERS,
POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS` (codex appends `BATTLE_MODES` after). S12 a named `POTENTIAL_START`;
`START` untouched (still `411300916` / `5b904cb9`, so P1 = the train head before the merge). S14: one stylesheet
(`src/ui/styles/potential.css`), one UI helper (`src/ui/potential.js`), and `towerPanel.js` gets one pill in the header.
Cross-spec fix 3: Luna **Moonwake**, Nami **Neap Tide**, and Hikari **First Light** (the plan's "consider renaming
Dawn's Resolve"); all three checked unused in `units.js`, the hero, Chika and codex branches.

**Gates run:** vitest (full), `vite build`, `e2e/engines.mjs` (Node V8, Bun JSC, Chromium V8 agree on START,
POTENTIAL_START and both freeplay battles; Firefox and WebKit are not installed in this container, so
`--require-all` could not run here), `e2e/potential.mjs` at 844×390 and 1280×720, `smoke`, `coop-freeplay`,
`ur-awaken`, `stat-display`, `potential-m0`, `BALANCE=potential`, the freeplay rows below.

**`POTENTIAL_START`** (v1; superseded by the v3 line-up, see the v3 build notes) (1-3 **Hard**, seed 616161): host Aoi P1, Chika P6, Suzu P6, Miko P6, Kaede P5, hero Luna P6; guest
Aoi P6 (×1.1 gear), Momo P6, Hotaru P6, Shiro P4, **Yuki P6** (Umeko needs water, 1-3 has none; her aura-speed step is
covered by `tests/sim/mods.test.js`). Each player places her girls as her own coins allow and upgrades a few. Won,
28,390 ticks, final `471369358`, 64 checkpoints → `7d947497` (pinned in `tests/online/engines.test.js`); the guest's Aoi
resolves to damage 4.62264 / rate 1.428 / range 3.296 / crit 0.08, the host's to 4 / 1.4 / 3.2 / 0.05.

**`BALANCE=potential`** (`tests/integration/potential.balance.test.js`, self-contained: the `exp/r2` scripts are not in
the repo). Paper DPS (sim `towerStats`) P1 → P6: +7.2 % for every damage dealer with a conditional signature, +10.4 % with
an unconditional one, +6.1 % Momo, +4.0 % Miko / Umeko (own shots; their value is the aura) — the §3.3 column exactly.
Crowd (40 s) and held single target (120 s), one girl on 4-5, seeds 9 / 21, t0:

| | Crowd L1 | Crowd strong | Held target L1 | Held target strong |
|---|---|---|---|---|
| median (16 damage dealers) | +7.3 % | +7.8 % | +10.1 % | +9.5 % |
| largest (girl) | +14.9 % (Nami) | +17.2 % (Nami) | +16.2 % (Kage, vs-elite signature) | Suzu +112 % † |

† Suzu's traps against one held enemy: how many traps land inside its trigger radius is luck of placement, so the
row swings (the spec saw −7.7 % at L14 the same way); it is not gated. Auras (Aoi standing in the aura, the aura girl
P1 → P6, strong): Miko −2.4 % / −2.0 %, Umeko −0.4 % / −0.3 % (noise level, ≤ +3 % as required). Campaign (the balance
bot, expected level per chapter, seed 1): **Easy 40 / 40 / 40, Normal 39 / 39 / 39 at P1 / F2P (R P6, SR P4, SSR and
heroes P2) / P6**; lives on the stages P1 won 5,752 → 5,767 → 5,779 (Easy) and 3,437 → 3,507 → 3,551 (Normal) — the
spec's §8.4 numbers. Clan boss: a P6 row in `tests/online/clanBoss.test.js` (under every cap, ≥ 50 s at 3×).

**Freeplay P6 rows** (`tools/freeplayBot.mjs --potential 6`: the solo freeplay calibration bot, "maxed" builds = ★5 legendary
+10 gear, every girl at P1 vs P6; the spec's `fp/bot.mjs` co-op presets are not in the repo). Wave the run falls on:

| Stage · tier · build | P1 falls on (seeds 3 / 5 / 7) | P6 falls on (seeds 3 / 5 / 7) | Mean Δ |
|---|---|---|---|
| 1-5 · blossom · max Kage | 120 / 119 / 121 | 123 / 121 / 123 | +2.3 |
| 1-5 · blossom · strong team | 204 / 204 / 200 | 207 / 207 / 207 | +4.3 |
| 1-5 · crimson · strong team | 114 / 114 / 114 | 140 / 120 / 140 | +19.3 |
| 1-5 · tempest · strong team | 171 / 171 / 171 | 173 / 173 / 173 | +2.0 |
| 4-5 · blossom · max Kage | 99 / 99 / 99 | 110 / 112 / 112 | +12.3 |
| 4-5 · blossom · strong team | 150 / 150 / 150 | 150 / 150 / 150 | +0.0 |
| 4-5 · blossom · strong team · co-op HP | 130 / 130 / 130 | 130 / 140 / 130 | +3.3 |
| 4-5 · crimson · strong team | 90 / 90 / 90 | 90 / 90 / 90 | +0.0 |
| 4-5 · tempest · strong team | 120 / 120 / 120 | 120 / 120 / 120 | +0.0 |
| 8-5 · blossom · strong team | 160 / 160 / 160 | 160 / 160 / 160 | +0.0 |
| 8-5 · crimson · strong team | 90 / 90 / 90 | 130 / 130 / 130 | +40.0 |

- Most rows move 0 to +4 waves; the max-Kage rows move +2 (1-5) and about one boss wall (4-5: 99 → 110–112).
- **Crimson Moon is a life-buffer knife edge for a maxed team**: only its boss walls cost lives, and on 8-5 the P1 team
  reaches the wave-90 boss with 61 lives and loses them all there, while the P6 team arrives with 96 (it lost fewer at
  the earlier walls), keeps 59, survives 100 and 110 and falls at 130. 1-5 Crimson moves 114 → 120–140 the same way.
  The spec's guards hold (Crimson ends before 160; the god Kage army at most about one wall past P1), but this is more
  than "0 to +4 waves" for a maxed team on Crimson. Left as data for the train-C combined pass (LANDING_PLAN §9.2 step 7
  re-checks freeplay with everything on and retunes `hpBands`); see owner question 5 below.

**Deviations from this spec:**
- Signature names (above). Every other step is the §3.3 table (the wiki article and `docs/ROSTER.md` are generated from
  the data and match it).
- Formation slots: the formation screen's squad slots (`.mb-fslot`) get a compact pill under the ×; on the ~40 px
  phone stage-prep slots the pill takes the top-left corner (the rarity text is hidden there) and the level drops its
  "Lv." prefix, because pill + level + name do not fit three rows in 40 px.
- Reveal card: the fragment chip already owns the top-right corner, so "P4 ▲" / "MAX" sits under it.
- The mailbox clamps letters to two lines on phones; a tap now shows the whole letter (so the girl list is readable).
- `unitPower` adds 20 per step and multiplies `potentialPowerFactor` into the DPS term, as §4.4 says.
- Hero ults: `hero.js` scales ult damage by `unitStats.damageMul` (level and gear), which Potential does not touch, so
  a hero's ult is not raised by her Potential (only her attacks). The spec did not say; the hero rework can decide.
- Not in this branch (not merged yet): the unit-info sheet hook (§7.7), story lesson 3 (§7.9), battle save's neutral-key
  test (§5). Their branches add the hook when they land second (`describePotentialStep`, `potentialView`, `potPill` are
  the shared pieces).
- Firefox's engine: not available here; the cross-engine run covered V8 (Node, Chromium) and JavaScriptCore (Bun).
- `BALANCE=full` did not gain F2P / P6 columns; the same comparison (Easy and Normal) is in `BALANCE=potential`.

**Owner questions still open (defaults shipped):** Q1 (a) cautious SSR backfill; Q2 yes (sparks and Select Tickets on
an owned girl count); Q3 yes (M0 counted early). New: **5. Freeplay on Crimson Moon** — a maxed team at P6 can last 1–4
boss walls longer on Crimson (8-5: 90 → 130) because it reaches the boss walls with more lives; keep it, or ask the
train-C pass to tighten Crimson's boss walls? Default: keep, re-check in the combined pass. **6. Hikari's signature
renamed "First Light"** (from "Dawn's Resolve", to keep "Resolve" for freeplay's mechanic) — fine?


---

## 0. Decisions in one page

1. **Potential = 1 + duplicates, capped at 6.** A girl's first copy is P1. Every duplicate (a recruit, a spark, or an
   SSR Select Ticket for a girl she already owns) adds +1 Potential up to P6 **and still pays its normal Star
   Fragments** (R 2, SR 10, SSR 40, `types.js:198-202`). From P6 on a duplicate pays fragments only. Rates, pity,
   sparks, fragments and prices do not change.
2. **One stored number** `profile.units[id].dupes` (whole, ≥ 0, never capped, never spent), mirrored in
   `profile.missions.counters['pot:<id>']` so an older build that drops `dupes` cannot lower it (§6.5).
3. **Each step P2…P6 adds one small passive** from `src/data/potential.js` (new). Steps are **relative**: +2–3 %
   damage, attack speed, range or coins, applied exactly like her level and gear, so they reach her shots, her traps
   (Suzu) and her drones (Chika) and are the same size at level 1 and level 60. The signature (P6) may instead use one
   of seven special keys (crit chance, vs elites, vs bosses, aura damage, aura speed, silence, focus cap). **Every girl has her own row**
   (a test fails otherwise); kit variants can have their own (`id@kitStyle`).
4. **Size (measured, §8):** P6 = ×1.072 to ×1.104 paper DPS; real damage **+9.2 % on crowds (median; +8.5 to +9.6 % at every level from 1 to 60)**, **+10–11 % on a single held
   target**, about +15 % on a boss walking past (range keeps her on it longer). An aura girl's P6 is worth what a damage
   girl's is to the team (+0.2–2 % team damage); all eight at P6 = +8–12 % team damage. The whole awakening (★1–★5 +
   ★3 passive) is ≈ +20–25 %, so Potential stays clearly below it, as "small passives" asks. In co-op freeplay P6
   moves the death wave by 0 to +4 waves for strong mixed teams and by one boss wall (+10) for the owner's max-Kage army
   (§8.5).
5. **The sim applies it in `resolveStats`** (`src/sim/mods.js:228`): the special ModSets after the awaken passive, and
   the whole-girl multipliers folded into the unit-stat multipliers before `applyUnitStats`. 5 lines in `mods.js`,
   1 in `constants.js`, the data file, and the tables added to the co-op data hash. `unitBattleStats().potential`
   travels in the co-op loadout like `awakenPassive`, so **an ally's girl fights at the ally's Potential**.
6. **Co-op id changes once; P1 is bit-identical to today.** Measured: the live scripted co-op battle hashes
   `411300916` with the overlay at P1, and a new `POTENTIAL_START` battle (every kind of step, plus host Aoi P1 and
   guest Aoi P6) hashes `860886411` — identical in **V8 (Node 22), JavaScriptCore (Bun 1.3.14) and Firefox's engine
   (Firefox 142)** (§5).
7. **Existing players are credited once from their recruit history** (§6). The history keeps 100 recruits; older ones
   are estimated: **R and SR at average luck** (≥ 98 % of girls exact from 600 recruits), **SSRs cautiously**
   (default; Q1). Pool sizes are pinned to v0.1.25, and the counter (M0) **must ship no later than the roster
   release**, so every later recruit is counted exactly.
8. **No `SAVE_VERSION` bump.** The field is additive and self-marking (battle-save and kit-toggle do the same).
9. **UI:** "P3" pill on cards, showcase, battle panel and unit-info sheet; a **Potential section on the Info tab**
   (the Awakening tab is story-locked until 3-2 for new saves); "P4 ▲" / "MAX" on every reveal (recruit, spark,
   Select Ticket); corrected duplicate wording everywhere it appears; a one-time letter for existing players.
10. **Order:** M0 (invisible counting, no UI, no co-op change) ships now-ish and no later than the roster; M1–M3 start
    after the co-op freeplay branch merges, as the owner asked.

---

## 1. Owner's words → behaviour

| Owner said | Behaviour | Where |
|---|---|---|
| "add potential levels when you get dupes" | Every duplicate of an owned girl adds 1 to `units[id].dupes`; Potential = `min(6, 1 + dupes)`. | `unlocks.js grantUnit` (§4.2) |
| "perhaps they get small passives" | Each step P2–P6 activates one passive from `src/data/potential.js`; all five ≈ +7–10 % of her own output (§8). | `src/data/potential.js`, `mods.js resolveStats` |
| "increase level by 1-5 per dupe max 6!" → chose "+1 Potential per dupe, max 6" | +1 per duplicate, P1 → P6 after 5 duplicates; a 6th+ duplicate still counts in `dupes`, Potential stays 6. | `potentialLevel()` |
| chose "Both: a dupe gives Potential and its usual Star Fragments" | `grantUnit` still adds `fragmentsOnDupe` exactly as today, then raises Potential. | `unlocks.js:34-36` + 4 lines |
| "once at P6, dupes give fragments only" | At P6 every reveal shows "+40" and a muted **MAX** tag, no ▲. | `recruit.js`, `selectTicket.js` |
| "do this after coop stuff and freeplay" | M1–M3 start after the freeplay branch merges. M0 (invisible counting) goes earlier so no duplicate is lost; the owner sees no change until M1–M3. | §13, Q3 |

---

## 2. How it plays (player-facing rules)

- **P1** is a girl's base (her first copy). Starters (Hikari, Aoi, Rei) and free girls (Yuki, Nami, Sango, Kage,
  Umeko, Shiro, Midori, Suzu) start at P1 however they joined.
- **A duplicate** is any copy of a girl you already own: a recruit result, a spark of an owned SSR (200 Recruit Points,
  `gacha.js:116`) or an SSR Select Ticket used on an owned SSR (`gacha.js:134`). Each gives **+1 Potential (to P6)**
  **and** her usual Star Fragments. A stage clear never produces a duplicate (`rewards.js:139-144`).
- **At P6** a duplicate gives Star Fragments only. Her duplicate count keeps going up (shown on her Info tab).
- **Potential never goes down and is never spent.** (The one exception: more than 100 recruits made on an
  out-of-date open tab, §6.5.) It is per account, not per battle.
- **What a step does** is fixed per girl and listed on her Info tab. Potential applies in every battle mode — solo,
  co-op, endless, freeplay, Total Assault, clan boss — exactly where her level and awakening apply.
- Damage and speed steps work like her level: they raise her hits, her traps and her drones. Burn and poison strength
  comes from her upgrades (`status.js:39`), so a speed step means more burn and poison applications.

---

## 3. Data model

### 3.1 Profile

| Field | Type | Default | Meaning |
|---|---|---|---|
| `units[id].dupes` | integer ≥ 0 | `0` (`newUnitState`) | Duplicates received since she joined. Never capped, never spent. Missing on a save from before M0 → filled once (§6). |
| `missions.counters['pot:<id>']` | number | absent | Shadow of `dupes`, written with it. Old builds keep this map word for word (`cleanMissions` → `cleanNumberMap`, `save.js:238`). |
| `missions.counters['pot:at']` | number (ms) | absent | When Potential last counted (backfill or a duplicate); recruits after it are recovered from history if `dupes` was dropped. |
| `seenIntro` gains `'potential-backfilled'` | string | — | Set by the one-time backfill when it ran on an existing save; gates the letter (§7.8). `seenIntro` already survives old builds (`save.js:398`). |

Derived, not stored: `potentialLevel(unitState) = clamp(1 + floor(dupes), 1, 6)`. No item, currency, reward or setting
is added. `pot:*` keys never collide with mission events (`track()` uses plain event names, `missions.js:71`), and
nothing enumerates `counters`.

### 3.2 `src/data/potential.js` (new; co-op graph and data hash)

The prototype `exp/r2/potential.data.js` is the proposed file verbatim. A **step** is `{ girl?, mods? }`:

- `girl` — whole-girl multipliers, keys `damageMul`, `rateMul`, `rangeMul`, `incomeMul`. They multiply into her unit
  stats exactly like level and gear (`mods.js applyUnitStats:206`), so `damageMul` reaches `trap.damage` and
  `turret.damage`, `rateMul` reaches `turret.rate`, `rangeMul` reaches `turret.range`; `incomeMul` multiplies
  `income.perWave` after every upgrade.
- `mods` — a ModSet applied after the awaken passive, restricted to `POTENTIAL_MOD_KEYS`: `crit.chance`, `eliteMul`,
  `bossMul`, `aura.dmgMul`, `aura.rateMul`, `silence`, `ramp.max`.

```js
export const MAX_POTENTIAL = 6;
export const POTENTIAL_GIRL_KEYS = ['damageMul', 'rateMul', 'rangeMul', 'incomeMul'];
export const POTENTIAL_MOD_KEYS = ['crit.chance', 'eliteMul', 'bossMul', 'aura.dmgMul', 'aura.rateMul', 'silence', 'ramp.max'];
export const POTENTIAL_LADDERS = {        // P2, P3, P4, P5 by role category; P6 = signature
  dps:     [{ girl: { damageMul: 1.02 } }, { girl: { rateMul: 1.02 } }, { girl: { rangeMul: 1.03 } }, { girl: { damageMul: 1.03 } }],
  frag:    /* same as dps */, hero: /* same as dps */,
  control: [{ girl: { rangeMul: 1.03 } }, { girl: { rateMul: 1.02 } }, { girl: { damageMul: 1.03 } }, { girl: { rateMul: 1.02 } }],
  support: /* same as control */,
  economy: [{ girl: { rateMul: 1.03 } }, { girl: { incomeMul: 1.02 } }, { girl: { rangeMul: 1.03 } }, { girl: { damageMul: 1.03 } }],
};
export const POTENTIAL_SIGNATURE_DEFAULT = { /* 'Full Bloom' per category — fixtures and dev only */ };
export const POTENTIAL_GIRLS = { aoi: { p6: { name: "Fletcher's Focus", mods: { crit: { chance: 0.03 } } } }, /* all 19 */ };
export function potentialSteps(def)   // → [{ step: 2…6, name|null, girl|null, mods|null }]; def.potential (fixtures) wins
export function potentialFold(def, p) // → { level, damageMul, rateMul, rangeMul, incomeMul, sets: ModSet[] }; p < 2 / non-number → neutral
```

- Category = `ROLES[def.role].category` (`types.js:81-110`), or `hero` for `kind: 'hero'`.
- Row lookup: `POTENTIAL_GIRLS[`${def.id}@${def.kitStyle}`]` when the def is a kit variant (`kitUnit()` sets
  `kitStyle`, KIT_STYLE_SPEC §3.2), else `POTENTIAL_GIRLS[def.id]`.
- `potentialFold` is memoised per def object in a `WeakMap` of 7 slots (kit variants are distinct frozen objects).
- Every exported table is deep-frozen (`Object.freeze` on each level) in the shipped file.
- **Banned on purpose** (a test enforces the allowlist):
  - flat `range`, `trap.damage`, `income.perWave`, `armorPen`: a flat bonus is huge where the base is small (+0.1
    range is 5.6 % for Rei's 1.8; +1 armor ignore doubles Luna's level-1 beam against armor 3, `combat.js:105`);
  - `splash`: blast radius scales the hits per shell (+0.1 measured +29 % for Sango on dense waves, `exp/sango-probe.mjs`);
  - status lists, `aura.range`, `crit.mul`: they keep the stronger value (`mods.js:52-70,134,137`), so a small bonus vanishes;
  - `projectiles`, `pierce`, `chain`, `maxTargets`, `trap.max`, `turret.max`: +1 is never small;
  - `reveal`, `airMul`, `gather`, `relay.reach`: allowed only after a measurement (roster, §3.4).

### 3.3 The table (19 girls)

Generated from the data by `exp/r2/table-r2.mjs`. Short labels (≤ 9 characters) are what the six-node track and the
chips show; the long text is the tooltip, the wiki and the letter.

| Girl | Rarity | Category | P2 | P3 | P4 | P5 | P6 signature | Paper DPS at P6 |
|---|---|---|---|---|---|---|---|---|
| Hikari | SSR | hero | +2% damage | +2% attack speed | +3% range | +3% damage | **First Light**: +3% crit chance | ×1.072 |
| Luna | SSR | hero | +2% damage | +2% attack speed | +3% range | +3% damage | **Moonwake**: +5% damage to elites | ×1.072 |
| Nami | SR | hero | +2% damage | +2% attack speed | +3% range | +3% damage | **Neap Tide**: +5% damage to bosses | ×1.072 |
| Aoi | R | dps | +2% damage | +2% attack speed | +3% range | +3% damage | **Fletcher's Focus**: +3% crit chance | ×1.072 |
| Rei | R | dps | +2% damage | +2% attack speed | +2% crit chance | +3% damage | **Iron Edge**: +5% damage to elites | ×1.072 |
| Yuki | R | control | +3% range | +2% attack speed | +3% damage | +2% attack speed | **Powder Snow**: +4% range | ×1.072 |
| Momo | R | economy | +3% attack speed | +2% coins per wave | +3% range | +3% damage | **Lucky Coin**: +3% coins per wave | ×1.061 (coins ×1.051) |
| Akane | SR | frag | +2% damage | +2% attack speed | +3% range | +3% damage | **Bonfire Night**: +3% attack speed | ×1.104 |
| Sango | SR | frag | +2% damage | +2% attack speed | +3% range | +3% damage | **Coral Drill**: +5% damage to elites | ×1.072 |
| Kage | SR | dps | +2% damage | +2% attack speed | +3% range | +3% damage | **Moonless Strike**: +5% damage to elites | ×1.072 |
| Umeko | SR | support | +3% range | +2% attack speed | aura +1% attack speed | +2% attack speed | **Spring Breeze**: aura +1% attack speed | ×1.040 (+ aura) |
| Shiro | SR | dps | +2% damage | +2% attack speed | +2% crit chance | +3% damage | **Big Game**: +5% damage to bosses | ×1.072 |
| Midori | SR | dps | +2% damage | +2% attack speed | +3% range | +3% damage | **Quick Brew**: +3% attack speed | ×1.104 |
| Suzu | SR | control | +3% range | +2% attack speed | +3% damage (traps) | +2% attack speed | **Silver Bells**: +3% damage (traps) | ×1.104 |
| Raika | SR | dps | +2% damage | +2% attack speed | +3% range | +3% damage | **Static Charge**: +3% damage | ×1.104 |
| Miko | SR | support | +3% range | +2% attack speed | aura +1% damage | +2% attack speed | **Festival Blessing**: aura +1% damage | ×1.040 (+ aura) |
| Hotaru | SSR | control | +3% range | +2% attack speed | +3% damage | +2% attack speed | **Quiet Lantern**: silence +0.1 s | ×1.072 |
| Kaede | SSR | dps | +2% damage | +2% attack speed | +3% range | +3% damage | **Maple Focus**: focus cap +5% | ×1.072 |
| Chika | SSR | support | +3% range (drones too) | +2% attack speed (drones) | +3% damage (drones) | +2% attack speed (drones) | **Overclocked Drones**: +3% attack speed (drones) | ×1.104 |

Short labels: `+2% DMG` `+3% DMG` `+2% SPD` `+3% SPD` `+3% RNG` `+4% RNG` `+2% COIN` `+3% COIN` `+3% CRIT`
`+2% CRIT` `+5% ELITE` `+5% BOSS` `+1% AURA` `+0.1s SIL` `+5% FOCUS` (longest 9).

Notes on choices the measurements forced (§8):
- **No flat steps.** Revision 1's `+0.1 range`, `traps +0.5/+1`, `ignores 1 more armor` and `+2/+3 coins` were far
  bigger on a young girl than on an endgame one (critic issue 5): Momo's +5 coins was +16.7 % un-upgraded and +0.4 %
  on 5-0-2; at level 1 Luna's armor-ignore signature measured +24 % on a single elite (+1 % without it) and Suzu's
  flat trap damage +20 % on crowds (+14 % now) (`v1cmp.md`). Their relative replacements (`+3 % range`, damage that
  reaches traps, `+5 % vs elites/bosses`, `+2/+3 % coins`) keep the same share at every level (§8.2).
- **Auras** (Miko, Umeko) are budgeted **team-wide**: +1 % at P4 and +1 % at P6 for every girl in her aura, the
  partner's girls included (§8.3). Auras do not stack (`towers.js:174-186`: strongest source per key). Umeko's base
  aura has no speed bonus (`units.js` base `aura: { range, detection }`), so at ★0 tier 0 her P4 adds a +1 % speed
  aura of her own; the text says so ("aura +1% attack speed").
- **Rei** (1.8-tile melee) gets `+2 % crit chance` at P4 instead of range, like Shiro (10-tile sniper): range on a
  melee girl is worth 3–4× its paper value against a walking boss (180 s bench, t0 single boss: +24.4 % with the
  range step, +13.5 % with it removed, +17.2 % with the crit step; §8.1).
- **Sango**'s signature is `+5 % vs elites` only: with "elites and bosses" her 5-0-2 single-boss gain was the
  largest (+28 % in 120 s probes; signature removed +16 %, `exp/r2/probe/`); elites-only measures +18.4 % (180 s).
- **Kage** (the owner's max-Kage freeplay build) now has a non-crowd signature, `+5 % vs elites` (was +3 % attack
  speed): her P6 paper gain drops from +10.4 % to +7.2 %, the same as Aoi (§8.5).
- **Chika and Suzu** need no special steps any more: the whole-girl multipliers reach drones and traps. The Chika
  rework (#166, "a real weak own shot") gets her Potential on that shot automatically.
- **Momo** is the only economy girl: +5.1 % coins per wave from her at P6, at every upgrade level (30 → 31.5 coins
  un-upgraded, 1,415 → 1,487 on 5-0-2). Conservative while the economy is under review.

### 3.4 New girls, kit variants (roster merge, kit toggle)

- **No silent fallback for shipped girls.** A data test requires a `POTENTIAL_GIRLS` row (or `def.potential`) for every
  `UNITS` id and every `kitUnit(id, style)` variant whose kit changes a key a step uses. The roster builder writes
  the 11 rows in the roster PR; `POTENTIAL_SIGNATURE_DEFAULT` stays only for fixtures.
- **The effectiveness test (§11.1) decides each row**: every step must change at least one stat her behaviour reads.
  The whole-girl multipliers already reach anything `applyUnitStats` scales; for the roster vocabulary
  (`wt-roster/src/sim/mods.js`):
  - **summoner / mirror** (`relay.reach`): recommend to the roster that `applyUnitStats` scale `relay.reach` by
    `rangeMul` like `turret.range` (gear range would then reach familiars too). If it does not, their row replaces the
    range step with a speed step. `relay.reach` itself joins the allowlist only after a bench.
  - **purifier** ("almost no damage"): her row is speed/range plus a utility signature, chosen after her kit settles;
    the test rejects a damage-only row.
  - **puppeteer, displacement**: same rule — each step must move a stat she uses.
  - `airMul` (e.g. Hana "+5 % vs flyers") and `gather` join the allowlist only with a bench row in the roster PR.
- **Kit variants** (`kitUnit()` keeps the same `id`, KIT_STYLE_SPEC §3.2): a Fantasy kit falls back to the School row
  unless `POTENTIAL_GIRLS['miko@fantasy']` exists; the effectiveness test runs over every variant, so a Fantasy Miko
  without an aura fails until her row exists.

---

## 4. Code changes, file by file

### 4.1 `src/systems/potential.js` (new; pure; not in the co-op graph)

```js
export { MAX_POTENTIAL, potentialSteps, potentialFold } from '../data/potential.js';
export function potentialLevel(unitState)            // P1…P6 (no state / no dupes → 1)
export function dupesToNext(unitState)               // 1 below P6, 0 at P6
export function describePotentialStep(step)          // → [{ short, long, who: 'self'|'allies'|'enemies' }] (§3.3 labels)
export function potentialView(def, unitState)        // → [{ step, name, parts, active, next }] for the UI
export function potentialPowerFactor(def, p)         // Π damageMul × Π rateMul × √Π rangeMul of active steps
export const POOL_SIZE_V0125 = Object.freeze({ R: 4, SR: 10, SSR: 5 });
export function backfillDupes(units, history, opts)  // §6.2; pure; returns { [id]: dupes }
export function restoreFromShadow(units, counters, history) // §6.5
```

`describePotentialStep` is the one describer: the student page, unit-info sheet, battle panel tooltip, wiki and letter
all use it; for `mods` it also returns unit-info's tag (`modsTags`, `wt-unit-info/src/ui/upgradeTags.js:112`) so chips
show Self / Allies / Enemies the same way the upgrade tree does.

### 4.2 `src/systems/unlocks.js` — `grantUnit` (`:24-37`)

```js
  const st = profile.units[unitId];
  const before = potentialLevel(st);
  st.dupes = Math.max(0, Math.floor(st.dupes || 0)) + 1;
  shadowPotential(profile, unitId, now);        // counters['pot:<id>'] = dupes; counters['pot:at'] = now
  const fragments = UNIT_RARITIES[def.rarity].fragmentsOnDupe;
  addItems(profile, [{ id: 'star_fragment', count: fragments }]);
  const potential = potentialLevel(st);
  return { isNew: false, fragments, potential, potentialUp: potential > before };
```
New girls return `{ isNew: true, fragments: 0, potential: 1, potentialUp: false }` and get `dupes: 0` from
`newUnitState`.

### 4.3 `src/systems/gacha.js`

- `pull()` `:98`: `results.push({ …, potential: grant.potential, potentialUp: grant.potentialUp })`.
- `spark()` `:123` and `redeemSelectTicket()` `:141` already spread `...grant`.
- History entries unchanged (`{ unitId, rarity, at }`); the roster's banner field rides along when it lands.

### 4.4 `src/systems/progression.js`

- `unitBattleStats` (`:265-286`): add `potential: potentialLevel(unit)` (unowned → 1); JSDoc at `:263`.
- `unitPower` (`:292-303`): multiply the DPS term by `potentialPowerFactor(def, s.potential)` and add `20 × (P − 1)`
  (a level is 5, a star 50), so every girl's Power moves with Potential, including Miko, Umeko, Momo and Hotaru whose
  steps are not all damage (critic issue 20).

### 4.5 `src/systems/save.js`

- `newUnitState` (`:49-51`): add `dupes: 0`. (Roster v3 adds `skin: null`, kit toggle adds `kitStyle: null` on the same
  line; whichever lands later keeps all.)
- `cleanUnit` (`:147-163`): `dupes: 'dupes' in raw ? int(raw.dupes, 0, 0, 1e6) : null` — `null` = "needs credit".
- `migrateProfile` (`:302`), after units (`:316-319`), gacha (`:345-355`) and missions are cleaned:
  1. `restoreFromShadow(p.units, p.missions.counters, p.gacha.history)` fills `dupes` for units that have a shadow (§6.5), and sets `dupes = max(dupes, shadow)` where both exist.
  2. `backfillDupes(...)` fills the rest that are still `null` (§6.2); if it ran, add `'potential-backfilled'` to `seenIntro`.
  3. Units forced in at `:319` (starters) get `dupes: 0`; write every `pot:<id>` shadow and `pot:at = now`.
- `migrationDropsData` (`:409`): unchanged. **No `SAVE_VERSION` bump** (§6.5).

### 4.6 `src/systems/mail.js`, `src/main.js`, `src/ui/screens/lobby.js`

`ensurePotentialLetter(profile)` next to `ensureBetaGift` (`mail.js:169`), called where that one is (`main.js:41`,
`lobby.js:263`). Delivers letter `potential-arrived-1` once (guarded by `mail.delivered`), only when `seenIntro` has
`'potential-backfilled'` and some girl is at P2+. No date constant. Ships in M3, so profiles backfilled by M0 get it
when Potential becomes visible.

### 4.7 Sim (co-op graph)

| File | Change |
|---|---|
| `src/data/potential.js` | New (§3.2). Imports `ROLES` from `types.js` (already in the graph). |
| `src/sim/mods.js` | `import { potentialFold } from '../data/potential.js'`; in `resolveStats` (`:228-241`): `const pot = potentialFold(def, us.potential);` after the existing ModSets `for (const m of pot.sets) applyModSet(s, m, acc);` then `applyUnitStats(s, pot.level > 1 ? { ...us, damageMul: us.damageMul * pot.damageMul, rateMul: us.rateMul * pot.rateMul, rangeMul: us.rangeMul * pot.rangeMul } : us);` and `if (s.income && pot.incomeMul !== 1) s.income.perWave *= pot.incomeMul;` (exact patch: `exp/r2/make-overlay.mjs`). `collectModSets` is unchanged. |
| `src/sim/constants.js` | `DEFAULT_UNIT_STATS` (`:82-94`) gains `potential: 1`. |
| `src/online/coop/version.js` | `coopVersion().data` also hashes `[POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS]` (freeplay adds `FREEPLAY` the same way), so a dev build (`sim: 'dev'`) with different tables cannot pair. |

No new Tower or Sim field, event or random draw; no transcendental math (`potentialFold` multiplies and floors).
Towers keep resolving stats on placement, upgrade and hero level-up (`towers.js:98`), so Potential is inside `t.stats`.

### 4.8 UI (not in the co-op graph)

| File | Change (§7 has labels and layout) |
|---|---|
| `src/ui/components.js` `unitCard` (`:430-448`) | Option `potential`; `div.unit-card-pot` "P3" for P ≥ 2 at the top-right (UR/rarity tag stays top-left). |
| `src/ui/screens/students.js` `studentCard` (`:63-82`), sort list (`:39-47`) | Pass `potential`; sort **Potential**. |
| `src/ui/screens/formation.js`, `stage.js` | Pass `potential` (formation slots use the small pill, §7.1). |
| `src/ui/screens/student.js` | Showcase pill in `renderInfo` (`:259-276`); **Potential section in `infoTab`** after "Awakening passive" (`:348-352`); "Yours" column from `resolveStats` in `statsTable` (`:166-204`); `?tab=info&focus=potential` scrolls to it. |
| `src/ui/screens/recruit.js` | `revealCard` tag (`:410-437`); results summary (`:366-376`); showcase kicker (`:346`); rules (`:248`); spark text (`:73`), spark grid meta (`:83`), **spark reveal passes `potential`/`potentialUp` (`:97`)**; first-gain tip. |
| `src/ui/selectTicket.js` | Picker text (`:38`), confirm (`:47`), **`showJoined` text (`~:73`)**. |
| `src/ui/screens/mall.js` | Stock text (`:82`). |
| `src/ui/battle/towerPanel.js` | Pill after the tiers (`:93`) from `t.unitStats?.potential`; UR badge for an ally's girl from `t.unitStats.awaken` too (§7.6). |
| `wt-unit-info src/ui/unitSheet.js` (when merged) | Meta row pill (`:69-71`) and a Potential block after the ★3 passive (`:183`). |
| `src/data/wiki.js` | Article "Potential" generated from `src/data/potential.js`; the `gacha` article's duplicate sentence. |
| `wt-story src/data/story/lessons.js` (when merged) | Lesson 3 (`recruit`) text (§7.9). |
| `src/ui/styles/meta-b.css`, `meta-a.css`, `battle.css` | Pill, track and tag styles (tokens only). |

---

## 5. Sim, determinism and the co-op id

- **Co-op id changes once** (from whatever freeplay leaves it at). Graph files touched: `src/sim/mods.js`,
  `src/sim/constants.js`, `src/online/coop/version.js`, new `src/data/potential.js` (found through the static import
  from `mods.js`). Not touched: `COOP_PROTOCOL`, `commands.js`, `session.js`, `loadout.js`. Old and new builds refuse
  to pair; the "both players update" banner appears once. Ship Potential as its own release, not with freeplay.
- **Loadouts already carry it.** `pickLoadout` sends `{ unitId, stats: unitBattleStats(...) }` (`loadout.js:16-22`,
  `coop.js:321`); `createCoopSim` spreads `{ ...DEFAULT_UNIT_STATS, ...e.stats }` per player (`commands.js:78`). The
  same girl on both sides keeps per-owner stats (measured below). A modified client can claim at most P6 (steps above 6
  do not exist; non-numbers count as P1); it can already claim any `damageMul`.
- **Determinism (measured, `exp/r2/det/`, `result.txt`):**

| Bundle | Battle | V8 (Node 22) | JSC (Bun 1.3.14) | Firefox's engine (Firefox 142) | Ticks |
|---|---|---|---|---|---|
| live repo, no overlay | `START` | 411300916 / 5b904cb9 | 411300916 / 5b904cb9 | 411300916 / 5b904cb9 | 28,347 |
| r2 overlay, everyone P1 | `START` | 411300916 / 5b904cb9 | 411300916 / 5b904cb9 | 411300916 / 5b904cb9 | 28,347 |
| r2 overlay | `POTENTIAL_START` | 860886411 / be315485 | 860886411 / be315485 | 860886411 / be315485 | 26,477 |

  (final hash / FNV of the 64 checkpoint hashes; every checkpoint agreed between the two lockstep clients.)
  `POTENTIAL_START` (1-3, co-op): host Aoi **P1**, Chika P6 (drones), Suzu P6 (traps), Miko P6 (aura), Kaede P5
  (focus cap), hero Luna P6 (vs elites); guest Aoi **P6**, Momo P6 (coins), Hotaru P6 (silence), Shiro P4 (crit),
  Umeko P6 (she needs water; 1-3 has none on the scripted spots, so the builder moves her to a water stage or the
  unit test covers `aura.rateMul`). The two Aois resolve to damage 5.000 / range 3.700 (host, P1, upgraded) and
  5.253 / 3.296 / crit 0.08 (guest, P6): per-owner stats differ, hashes agree.
- **Battle save** (`wt-battlesave src/ui/battle/snapshot.js`): `unitStats` is a `'config'` tower key and frozen team
  entries are restored as `{ ...unitBattleStats(null, id), ...frozen.stats }` (`:120`), so a save from before
  Potential restores at P1. Potential adds no Tower or Sim key, so `KNOWN_TOWER_KEYS` / `KNOWN_SIM_KEYS` need no entry;
  its "missing key → neutral" test should list `potential`. A save made at P3 continues at P3 (frozen team, their
  decision 6).

---

## 6. Save, migration and the history backfill

### 6.1 What the history can and cannot tell us

- `pull()` writes `{ unitId, rarity, at: now }` per result (`gacha.js:99`) after `grantUnit` stamped a new girl's
  `obtainedAt = now`; a 10-pull shares one `now`. `spark()` / `redeemSelectTicket()` stamp twice with `Date.now()`
  (`gacha.js:120-121,137-139`), so the two stamps can differ by a millisecond or two.
- Starters get `obtainedAt = createdAt`; free girls get the stage-clear time (`rewards.js:141`), no history entry.
- The history keeps **only the last 100 entries** (`gacha.js:14,101`, `save.js:24,354`); `totalPulls` counts every
  roll. Nothing counts recruits per rarity or per girl.

### 6.2 The rule

For every owned girl `u` whose `dupes` is still `null` after §6.5:

1. `H` = history entries with `unitId === u` and `at ≥ obtainedAt(u)`.
2. `first` = `u` is not a starter **and** some entry in `H` has `at − obtainedAt(u) ≤ 2000 ms`.
3. `fromHistory = |H| − (first ? 1 : 0)`.
4. **Older recruits.** `T = max(0, totalPulls − history.length)` fell out of the history. If she joined before the oldest
   kept entry, `λ = T × share(rarity) / POOL_SIZE_V0125[rarity] × f`, with
   `f = clamp((oldestAt − max(obtainedAt, createdAt)) / max(1, oldestAt − createdAt), 0, 1)`,
   `share = { R: 0.785, SR: 0.194, SSR: 0.0203 }` (`exp/rates.txt`), `POOL_SIZE_V0125 = { R: 4, SR: 10, SSR: 5 }`.
   - **R and SR: `estimated = floor(λ)`** (average luck).
   - **SSR (default, Q1): `estimated` = the Poisson(λ) 25th percentile** (cautious).
5. `dupes(u) = fromHistory + estimated`.

Pinning the pool and shipping M0 no later than the roster (§13) means the estimate only ever covers recruits made on
v0.1.25-pool builds: the first load of any build with M0 runs this once, and every later recruit is counted by
`grantUnit`. A save first opened after the roster release still only has pre-roster recruits in its uncounted past, so
the pinned sizes stay right; banner chasing cannot be in it (banners arrive with the roster).

| Save state | Result |
|---|---|
| No `gacha`, or empty history and `totalPulls` 0 | Every girl P1. |
| Empty history but `totalPulls > 0` | `fromHistory = 0`; the estimate runs with `oldestAt = now`. |
| `obtainedAt` missing (set to now on migrate, `save.js:160`) | No entry is ≥ now, `f = 0` → P1. |
| `createdAt` missing (set to now) | `f = 0` → history only. |

The Poisson percentile is computed by a fixed product series (`e^-λ` once, then ×λ/k); it runs once per save, outside
the sim, and its result is stored, so engine differences cannot matter.

### 6.3 How well it works (measured per rarity, `exp/r2/backfill-r2.mjs` → `backfill-r2.md`)

Real `pull()` and real `migrateProfile`, 200 players per row, free girls joining at their stage-clear times.
**Uniform** = one 10-pull a minute (the estimate's own assumption); **bursty** = 40 % of recruits in the first session,
the rest in random bursts over 60 days. "Exact" = backfilled P equals the true P.

| Recruits | Rarity | History only: exact / mean P lost | Average luck (C): exact | C: over / over by 2+ / under | Cautious (Q25): exact | Q25: over / under |
|---|---|---|---|---|---|---|
| 150 | R | 100 % / 0 | 100 % | 0 / 0 / 0 % | 100 % | 0 / 0 % |
| 150 | SR | 66–75 % / 0.3–0.5 | 66–75 % | 0 / 0 / 25–34 % | 66–75 % | 0 / 25–34 % |
| 150 | SSR | 94 % / 0.07 | 94 % | 0 / 0 / 6 % | 94 % | 0 / 6 % |
| 300 | R | 100 % / 0 | 100 % | 0 | 100 % | 0 |
| 300 | SR | 11–12 % / 2.1–2.2 | 53–55 % | 23–32 / 8–15 / 15–22 % | 42 % | 12–19 / 40–46 % |
| 300 | SSR | 68 % / 0.42 | 68 % | 0 / 0 / 32 % | 68 % | 0 / 32 % |
| 600 | R | 100 % / 0 | 100 % | 0 | 100 % | 0 |
| 600 | SR | 5 % / 3.0 | 98 % | 2 / 0–1 / 0 % | 98 % | 2 / 0 % |
| 600 | SSR | 32 % / 1.31 | 36–44 % | 20–44 / 3–13 / 21–36 % | 41–42 % | 9–16 / 42–50 % |
| 1,200 | R | 100 % / 0 | 100 % | 0 | 100 % | 0 |
| 1,200 | SR | 5 % / 3.1 | 100 % | 0 | 100 % | 0 |
| 1,200 | SSR | 5 % / 3.16 | 32 % | 33–47 / 14–25 / 21–35 % | 23–26 % | 16–26 / 48–61 % |

(Ranges are uniform–bursty. SR "Q25" is shown for comparison only; the default uses C for SR.)

- **R** girls are exact under every rule; **SR** girls are exact 98–100 % from 600 recruits with C. The estimate only
  really matters for SR girls around 300 recruits and for **SSRs, where any estimate is close to a coin flip**: a
  long-time player's SSR is exact 23–44 % of the time whatever we do, because the history kept no names.
- **Default:** C for R and SR, cautious Q25 for SSR — SSR steps are the scarcest thing Potential gives (≈ a year of
  free play per SSR, ≈ 8 months per step after the roster), so the default over-credits an SSR at most 9–26 % of the
  time instead of 20–47 %, at the price of under-crediting more often (42–61 %). Q1 gives the owner the choice.
- History only never over-credits but costs heavy players ~3 steps on every SR and SSR.

### 6.4 Exports, imports, rollbacks

Export / import (`serializeProfile`, transfer codes) carry `dupes` and the shadow as plain profile data; an export
from before M0 is backfilled on import like any old save.

### 6.5 No version bump; Potential never goes down

- No `SAVE_VERSION` bump: battle-save (decision 9) and kit toggle (A12) chose the same rule to avoid colliding with the
  roster's v3. The marker is per unit (`dupes` present or not).
- **A stale tab on an older build** (same version) drops `dupes` through its `cleanUnit` allowlist and may save; an
  import into an older client does the same. Both keep `missions.counters` and `seenIntro` word for word. On the next
  load, `restoreFromShadow` sets `dupes = counters['pot:<id>'] +` the duplicates of her in the history after
  `counters['pot:at']` (the same first-copy rule as §6.2, so a girl first recruited on the old tab is not counted
  twice). Only a unit without a shadow is backfilled.
- So Potential never goes down unless **more than 100 recruits** are made on an out-of-date tab (they fall out of the
  history). The update banner (`core/updates.js`) makes that window minutes long. Tested (§11.1).

---

## 7. UI: phone 844×390 and PC 1280×720

**Pill style** everywhere: rounded, dark plum `#3b2350` background, white bold "P3" (13.6:1). **P6** uses the sakura
gradient `#ff7aa8 → #ffb6cf` with **dark plum text** `#3b2350` (5.6:1 and 8.3:1) and a 1 px white inner line. Never
rainbow (rainbow is UR). Sizes: 16 px tall on phone, 18 px on PC; text 11 / 12 px. No pill at P1 on cards; the student
page shows P1 explicitly. Our own art: the pill, the six-node track and the ✦ signature glyph are drawn in CSS/SVG.

### 7.1 Cards (Students grid, formation, stage prep)

- `div.unit-card-pot` at the **top-right** (rarity/UR tag stays top-left); on tall cards it sits under "Lv.30" and the
  `mb-card-badges` column moves down by the pill height.
- **Formation slots** (`.ma-fslot`, ~70 px on phone, labels 0.62rem, `meta-a.css:169-176`): a compact pill 12 px tall,
  0.62rem text, `top: 3px; right: 3px`; the level label stays bottom-right. e2e checks it stays inside the slot and
  does not touch the rarity tag.
- Students sort gains **Potential** (P6 first, then Power). `title`: "Potential 3 of 6".

### 7.2 Student page — showcase (left column, both sizes)

Meta row: `Lv. 30 / 30 · ★★★☆☆ · [P3] · ⚔ 588`. The pill (`data-testid="show-potential"`) is a button → Info tab,
scrolled to the Potential section (`#/student/<id>?tab=info&focus=potential`).

### 7.3 Student page — Info tab, new section "Potential" (never locked)

Placed after "Awakening passive" (`student.js:348-352`), so the two passive sections sit together. The Info tab is the
default tab and is never locked; the Awakening tab is story-locked until 3-2 on new saves (`STORY_SPEC` D8), which is
why the section is not there.

```
Potential · P3 / 6                                                   (section title)
Each duplicate recruit raises her Potential by 1 and still gives Star Fragments.
At P6, duplicates give Star Fragments only.                          (muted)
[ P1 ][ P2 ][ P3 ][ P4 ][ P5 ][ P6 ]                                 (six-node track)
  Base +2% DMG +2% SPD +3% RNG +3% DMG +3% CRIT✦
┌ ✦ Fletcher's Focus — +3% crit chance                              (signature box)
│   Unlocks at P6 (3 more duplicates)   |   Active in every battle
└
Duplicates so far: 2 · Next: P4 with 1 more duplicate              (muted)
```

- At P6 the footer reads "Potential maxed — duplicates now give Star Fragments only (+40 each)." (fragments of her
  rarity).
- Not owned: the section still shows (nodes all locked, footer "Recruit her to start at P1.") — the Info tab is how a
  player previews a girl.
- Nodes: phone right column ~500 px → 6 × 76 px nodes with the ≤ 9-character labels; PC 96 × 72 px. States reuse
  `.on` / `.next`. Each node `title` = the long text. Aura steps show an "Allies" chip like unit-info's tags.
- `data-testid`: `potential-section`, `potential-node-<n>`, `potential-signature`, `potential-footer`.
- No horizontal scroll at 844×390 (e2e).

**"Yours" stats column** (`statsTable`, `:166-204`) is computed from `resolveStats(unit, { unitStats: battle })` at
tier 0 instead of base × multipliers, so it includes Potential **and the ★3 passive, which today's column leaves out**
— a visible change to an existing screen, listed for the owner (§10). Footnote: "Yours = level, gear, awakening and
Potential, before upgrades."

### 7.4 Recruit reveal, spark and the summary (`recruit.js`)

- **Duplicate card** (`revealCard`): bottom keeps "+10 ✦". Corner tag top-right: **"P4 ▲"** (`span.ma-gc-pot`, sakura;
  P6 in the P6 style) when Potential rose; **"MAX"** (`span.ma-gc-pot.max`, muted) at P6; new girl "NEW" as today.
- **Results summary** (`:366-376`): `2 new · ▲ 3 Potential · +46 ✦ Star Fragments · Pity 12/90`. On phone
  (`max-height: 500px`) the word "Star Fragments" is hidden (icon + number stay: `+46 ✦`), so the line stays on one row
  at 844×390; the Potential chip appears only when at least one rose. e2e asserts one line.
- **SSR showcase kicker** (`:346`): `SSR` · `SSR · pity` · `SSR · Potential 4 ▲` · `SSR · pity · Potential 4 ▲` ·
  `SSR · P6 · MAX` · `SSR · pity · P6 · MAX`.
- **Rules list** (`:248`): "**Duplicates:** +1 Potential (P1 → P6; each step adds a small passive) and Star Fragments
  for awakening (R ×2, SR ×10, SSR ×40). At P6, duplicates give Star Fragments only."
- **Spark panel** (`:73`): "Every recruit earns 1 Recruit Point. Exchange 200 points for the SSR of your choice. If
  she is already in your academy, she gains +1 Potential (up to P6) and 40 Star Fragments."
- **Spark grid** (`:83`): owned below P6 → "Owned · P3 → P4"; at P6 → "P6 → fragments"; not owned → her title.
- **Spark reveal** (`:97`): `playReveal([{ unitId: id, rarity: 'SSR', isNew: r.isNew, fragments: r.fragments,
  potential: r.potential, potentialUp: r.potentialUp }], …)`, so the card and kicker show the tag.
- **First Potential gain ever:** one toast after the reveal closes: "Duplicates raise Potential — small passives up to
  P6. See her Info tab." Shown once (`seenIntro` `'potential-tip'`).

### 7.5 SSR Select Ticket and Mall

- Picker (`selectTicket.js:38`): "Choose any SSR student (tickets: N). Already in your academy? She gains +1 Potential
  (up to P6) and 40 Star Fragments."
- Confirm (`:47`), owned below P6: "**Kaede** is already in your academy: she gains +1 Potential (P3 → P4) and 40 Star
  Fragments. Use it?" — OK **Use ticket**. At P6: "Kaede is at P6: the ticket becomes 40 Star Fragments. Use it?" —
  OK **Convert**.
- `showJoined` (`~:73`): new → "Kaede joined the academy!" (as today); owned below P6 → "Kaede was already here —
  Potential 4 ▲ and +40 Star Fragments."; at P6 → "Kaede is at P6 — +40 Star Fragments."
- Mall Recruit Exchange stock (`mall.js:82`): owned below P6 → "Owned → P+1 & fragments"; at P6 → "P6 → fragments";
  not owned → "Spark".

### 7.6 Battle

- Panel header (`towerPanel.js:93`): after the tiers a pill `span.bt-panel-pot` "P4", only for P ≥ 2, from
  `t.unitStats.potential`. `title`: "Potential 4: +2% damage, +2% attack speed, +3% range". The panel numbers already
  include Potential (`sim.towerStats`).
- **One rule for an ally's girl:** both the P pill and the UR badge come from **her owner's battle stats**
  (`t.unitStats`), because that is what she fights at. UR today reads your own profile for an ally's girl
  (`towerPanel.js:75-78`) although `unitStats.awaken` travels in the loadout; M2 changes that one line
  (`isUR(def, { units: { [def.id]: { awaken: t.unitStats.awaken } } })` for the ally's towers). Display only.
- Width: phone panel is 340 px (`battle.css:560`); "Hotaru [UR] 5-0-2 [P6]" needs ~190 px of the ~230 px name line.
  `.bt-panel-name` gets `min-width: 0` and the name `text-overflow: ellipsis`; e2e asserts no overflow with the
  longest name in `UNITS` (re-run when the roster lands).
- Battle bar cards: no change.

### 7.7 Unit-info sheet (`wt-unit-info`, when merged)

Meta row (`unitSheet.js:69-71`) gains the P pill after the stars; after the ★3 passive block (`:183`) a "Potential ·
P3 / 6" block lists the active steps as chips (short label + Self/Allies tag from `describePotentialStep`). Power in the
sheet uses the new `unitPower` (§4.4).

### 7.8 One-time letter for existing players

Delivered once by `ensurePotentialLetter` (§4.6), id `potential-arrived-1`, **no rewards**:
- From "Sakura Academy Staff". Title "New: Potential!"
- Body: "From today, every duplicate recruit raises a girl's Potential by 1, from P1 up to P6, and each step gives her
  a small passive. Duplicates still give their Star Fragments. We counted the duplicates in your recruit history; for
  recruits older than your last 100 we estimated (average luck for R and SR girls, a cautious guess for SSR girls):
  {Aoi P6, Rei P6, Kage P5, Shiro P3, …}. You can see each girl's passives on her Info tab."
- Lists every girl at P2+, highest first, max 12 names then "and N more". Existing mailbox layout on both sizes.

### 7.9 Story and wiki text

- Story lesson 3 (`recruit`, `wt-story src/data/story/lessons.js:63`, today "Duplicates turn into Star Fragments for
  awakening. Nothing goes to waste!"): "A duplicate raises that girl's Potential (up to P6) and still gives Star
  Fragments for awakening. Nothing goes to waste!" (`STORY_SPEC` §3.2 carries the same sentence; update both.)
- Wiki article "Potential" (category Students): §2 rules, the six ladders, the 19-row table generated from the data.
  The `gacha` article's duplicate sentence uses the recruit rules wording.

---

## 8. Balance

All runs: `exp/r2/`, the real sim with the r2 overlay (`out-live`: live repo; `out-fp`: the freeplay worktree's own
sim, `wt-freeplay` `aa8613a`). The machine was shared with other jobs (load 20–30), so seed counts were chosen per
question; every cell says how many.

### 8.1 Per girl at endgame stats (`bench-r2.mjs`, `PRESET=strong`)

One girl at the best-coverage spot on 4-5, "strong" profile stats (L60, 5 gates, ★3, mythic gear: the freeplay
calibration preset), seeds 9 / 21 / 33. **Crowd** = an immortal orc grunt every 0.1 s; **single boss** = one immortal
Ashwing Matriarch walking past her (a new one when it leaks). 15 s warm-up, then 40 s; rows marked † were re-run at
180 s because 40 s was too short for them (slow shooters, melee, crit-heavy snipers). Miko and Umeko are measured by an
Aoi in their aura (single beneficiary; §8.3 has the team measure). Momo's coins are her panel income per wave.

| Girl | Build | Panel DPS P1 → P6 | Crowd DPS P1 → P6 | Δ crowd (seed range) | Single boss DPS P1 → P6 | Δ boss (seed range) | Seeds |
|---|---|---|---|---|---|---|---|
| akane † | t0 | 20.9 → 23.1 (+10.4%) | 1,531 → 1,672 | +9.2% (+8.9% … +9.7%) | 1.77 → 2.11 | +19.5% (+16.2% … +22.4%) | 3 |
| akane † | 5-0-2 | 1,032 → 1,139 (+10.4%) | 214,609 → 242,155 | +12.8% (+12.6% … +13.2%) | 132 → 151 | +14.9% (+14.4% … +15.6%) | 3 |
| aoi † | t0 | 30.6 → 32.8 (+7.2%) | 29.7 → 32.4 | +9.3% (+7.8% … +11.5%) | 12.0 → 13.3 | +10.9% (+8.5% … +13.8%) | 3 |
| aoi † | 5-0-2 | 237 → 254 (+7.2%) | 6,022 → 6,621 | +10.0% (+9.8% … +10.2%) | 383 → 450 | +17.5% (+15.8% … +19.3%) | 3 |
| chika | t0 | 3.73 → 4.12 (+10.4%) | 106 → 117 | +10.5% (+8.5% … +13.5%) | 41.4 → 48.0 | +16.0% (+15.3% … +16.6%) | 3 |
| chika | 5-0-2 | 3.73 → 4.12 (+10.4%) | 3,821 → 4,258 | +11.5% (+10.8% … +12.3%) | 3,931 → 4,531 | +15.3% (+14.5% … +15.8%) | 3 |
| hikari † | t0 | 32.2 → 34.5 (+7.2%) | 500 → 553 | +10.6% (+10.4% … +10.8%) | 3.01 → 3.47 | +15.1% (+12.7% … +19.7%) | 3 |
| hotaru | t0 | 25.8 → 27.6 (+7.2%) | 247 → 262 | +6.0% (+5.1% … +7.2%) | 4.30 → 4.80 | +11.6% (+11.4% … +12.1%) | 3 |
| hotaru | 5-0-2 | 494 → 529 (+7.2%) | 41,902 → 44,706 | +6.7% (+6.0% … +7.5%) | 279 → 311 | +11.6% (+11.3% … +12.3%) | 3 |
| kaede | t0 | 54.7 → 58.6 (+7.2%) | 42.7 → 46.1 | +7.8% (+2.2% … +16.4%) | 24.9 → 28.7 | +15.6% (+12.8% … +20.1%) | 3 |
| kaede | 5-0-2 | 478 → 513 (+7.2%) | 429 → 453 | +5.7% (+3.4% … +9.1%) | 584 → 677 | +15.9% (+13.1% … +21.0%) | 3 |
| kage † | t0 | 64.4 → 69.1 (+7.2%) | 119 → 128 | +7.5% (+7.0% … +8.2%) | 19.3 → 22.7 | +17.5% (+15.8% … +19.5%) | 3 |
| kage † | 5-0-2 | 5,087 → 5,451 (+7.2%) | 23,566 → 25,267 | +7.2% (+7.2% … +7.3%) | 1,754 → 2,052 | +16.9% (+16.9% … +17.0%) | 3 |
| luna | t0 | 47.7 → 51.2 (+7.2%) | 1,451 → 1,572 | +8.3% (+8.3% … +8.4%) | 9.41 → 11.3 | +19.7% (+19.2% … +20.9%) | 3 |
| midori | t0 | 8.75 → 9.66 (+10.4%) | 459 → 494 | +7.8% (+7.5% … +8.2%) | 3.74 → 4.49 | +20.2% (+16.1% … +22.3%) | 3 |
| midori | 5-0-2 | 71.0 → 78.4 (+10.4%) | 11,758 → 12,442 | +5.8% (+5.7% … +5.9%) | 55.4 → 60.8 | +9.7% (+9.1% … +11.0%) | 3 |
| miko (Aoi in aura) | t0 | 7.96 → 8.28 (+4.0%) | 33.2 → 35.0 | +5.4% (+2.9% … +9.5%) | 18.7 → 18.7 | +0.0% (-6.8% … +13.5%) | 3 |
| miko (Aoi in aura) | 5-0-2 | 7.96 → 8.28 (+4.0%) | 62.4 → 61.2 | -1.9% (-4.7% … +1.3%) | 43.3 → 45.4 | +4.8% (+2.2% … +8.2%) | 3 |
| momo (coins 55.0 → 57.8) | t0 | 7.96 → 8.44 (+6.1%) | 7.42 → 7.65 | +3.1% (-9.1% … +17.4%) | 2.77 → 3.07 | +10.7% (+10.7% … +10.7%) | 3 |
| momo (coins 1,415 → 1,487) | 5-0-2 | 38.2 → 40.5 (+6.1%) | 36.4 → 36.8 | +1.1% (-0.8% … +4.5%) | 16.6 → 18.3 | +10.8% (+8.6% … +14.7%) | 3 |
| nami † | t0 | 26.1 → 28.0 (+7.2%) | 4,718 → 5,185 | +9.9% (+8.9% … +10.5%) | 8.15 → 9.74 | +19.5% (+16.7% … +21.1%) | 3 |
| raika | t0 | 22.4 → 24.7 (+10.4%) | 173 → 194 | +12.0% (+9.2% … +14.2%) | 10.1 → 11.5 | +14.2% (+13.9% … +14.9%) | 3 |
| raika | 5-0-2 | 375 → 414 (+10.4%) | 13,323 → 14,688 | +10.2% (+9.8% … +10.6%) | 109 → 125 | +14.5% (+12.7% … +16.8%) | 3 |
| rei † | t0 | 19.3 → 20.7 (+7.2%) | 54.7 → 59.7 | +9.2% (+8.4% … +9.6%) | 1.10 → 1.29 | +17.2% (+13.3% … +19.6%) | 3 |
| rei † | 5-0-2 | 383 → 410 (+7.2%) | 11,730 → 12,811 | +9.2% (+9.0% … +9.5%) | 72.4 → 83.3 | +15.1% (+14.4% … +15.6%) | 3 |
| sango † | t0 | 31.3 → 33.6 (+7.2%) | 1,191 → 1,286 | +8.0% (+7.2% … +9.1%) | 11.2 → 12.3 | +10.5% (+10.5% … +10.5%) | 3 |
| sango † | 5-0-2 | 244 → 262 (+7.2%) | 10,145 → 11,000 | +8.4% (+8.3% … +8.6%) | 117 → 139 | +18.4% (+17.1% … +20.7%) | 3 |
| shiro † | t0 | 35.8 → 38.4 (+7.2%) | 52.2 → 58.6 | +12.4% (-0.9% … +23.6%) | 92.1 → 105 | +14.1% (+10.1% … +17.7%) | 3 |
| shiro † | 5-0-2 | 1,057 → 1,133 (+7.2%) | 2,124 → 2,232 | +5.1% (-2.9% … +9.4%) | 13,613 → 15,753 | +15.7% (+14.0% … +17.9%) | 3 |
| suzu | t0 | 0.00 → 0.00 (n/a) | 1,076 → 1,172 | +8.9% (+2.4% … +15.2%) | 11.5 → 13.2 | +15.3% (+6.4% … +19.7%) | 3 |
| suzu | 5-0-2 | 0.00 → 0.00 (n/a) | 60,711 → 67,753 | +11.6% (+11.4% … +11.7%) | 301 → 357 | +18.7% (+13.2% … +22.4%) | 3 |
| umeko (Aoi in aura) | t0 | 2.98 → 3.10 (+4.1%) | 30.7 → 32.3 | +5.2% (-2.4% … +12.9%) | 16.8 → 16.4 | -2.1% (-3.2% … +0.0%) | 3 |
| umeko (Aoi in aura) | 5-0-2 | 11.9 → 12.4 (+4.0%) | 34.5 → 34.4 | -0.3% (-1.6% … +0.8%) | 27.1 → 28.0 | +3.4% (+2.0% … +4.1%) | 3 |
| yuki | t0 | 9.95 → 10.7 (+7.2%) | 391 → 429 | +9.6% (+9.3% … +10.2%) | 4.02 → 4.69 | +16.5% (+14.1% … +21.4%) | 3 |
| yuki | 5-0-2 | 47.7 → 51.2 (+7.2%) | 6,619 → 7,178 | +8.5% (+8.4% … +8.6%) | 47.9 → 54.0 | +12.7% (+9.5% … +15.4%) | 3 |


**Damage dealers (Miko, Umeko and Momo excluded): crowd median +9.2 % (max +12.8 %, Akane 5-0-2); single boss on 5-0-2
median +15.3 % (max +18.7 %, Suzu); single boss at t0 median +15.8 % (max +20.2 %, Midori, 40 s).**

Reading it:
- Panel (paper) DPS rises **+7.2 %** (×1.02 × 1.02 × 1.03 plus a conditional signature) or **+10.4 %** (Akane, Midori,
  Raika, Suzu, Chika: an unconditional signature) for every damage dealer, at every build.
- Real crowd damage follows paper (+6 to +13 %). Shiro's crowd rows swing with crit luck (≈ 24 shots per 40 s at a
  ×3.25 crit); her 180 s rows are +12.4 % / +5.1 %.
- A single walking boss gains about twice the paper value: +3 % range keeps her on a moving target longer, and Nami's
  and Shiro's boss signatures add their 5 % (the four elite signatures — Luna, Rei, Sango, Kage — do not apply to a
  boss). This was the same in revision 1 (median +14.5 %). The two rows that stood out were fixed in the data: **Rei** t0 was +24.4 % with the range step and is +17.2 % with crit (†, 180 s);
  **Sango** 5-0-2 was +28 % with "elites and bosses" and is +18.4 % with elites only (†).
- Supports in their aura move one partner by 0–5 % (noise level for a single beneficiary). Momo: coins +5.1 % at every
  build (55 → 57.8 un-upgraded with ★3, 1,415 → 1,487 on 5-0-2) instead of revision 1's flat +5.

### 8.2 Early progression: expected level per chapter, no gear, ★0 (`PRESET=L1…L25`)

The balance test's `EXPECTED_LEVEL` (chapters 1/2/3/4/5 → L1/L8/L14/L20/L25) with its gates, ★0, no gear; builds t0
and 3-0-1; 40 s, seeds 9 / 21 / 33 (L8 and L20: seed 9 only). This is what a new player's girls look like, and R
girls are already P6 there (§8.7).

| Level (no gear, ★0) | Build | Seeds | Crowd Δ median | Crowd Δ max (girl) | Girls |
|---|---|---|---|---|---|
| L1 | t0 | 3 | +9.3% | +15.6% (suzu) | 16 |
| L1 | 3-0-1 | 3 | +8.8% | +11.1% (chika) | 13 |
| L8 | t0 | 1 | +8.7% | +13.6% (hikari) | 16 |
| L8 | 3-0-1 | 1 | +9.0% | +12.2% (yuki) | 13 |
| L14 | t0 | 3 | +8.9% | +13.4% (nami) | 16 |
| L14 | 3-0-1 | 3 | +9.0% | +21.5% (shiro) | 13 |
| L20 | t0 | 1 | +9.3% | +15.5% (nami) | 16 |
| L20 | 3-0-1 | 1 | +9.6% | +15.2% (yuki) | 13 |
| L25 | t0 | 3 | +9.1% | +15.9% (nami) | 16 |
| L25 | 3-0-1 | 3 | +8.5% | +14.6% (shiro) | 13 |

- **The crowd gain is +8.5 to +9.6 % (median) at every level** — the same as at endgame (+9.2 %). That is what the
  relative steps were for. The largest crowd rows (+15–16 %: Nami, Suzu, Hikari) are girls whose pulse or trap
  coverage grows with range; Shiro's +21 % at L14 3-0-1 is crit luck (her 40 s rows swing with a handful of ×3 crits, §8.1).
- **Single target at low level:** a target walking past her mixes in time-in-range and hits-per-pass luck (even at 180 s, Momo — whose steps add +6 %
  paper and nothing special against one target — reads +5 % at L1 and +26 % at L25; `bench-elite/`), so the guard
  uses a **held** target (`TARGETS=still`: the same immortal enemy kept at the path point nearest her; the chapter-1
  elite Slime Courtier, armor 1, for L1–L25; the Ashwing Matriarch for strong; 40 s, seeds 9 / 21):

  | Preset | Build | Seeds | Single-target Δ median | Max (girl) | Min (girl) | Girls |
  |---|---|---|---|---|---|---|
  | L1 (no gear, ★0) | t0 | 2 | +10.9% | +17.4% (luna) | +3.6% (midori) | 16 |
  | L1 (no gear, ★0) | 3-0-1 | 2 | +11.3% | +16.4% (sango) | +1.5% (midori) | 13 |
  | L14 (no gear, ★0) | t0 | 2 | +10.2% | +19.2% (luna) | -7.7% (suzu) | 16 |
  | L14 (no gear, ★0) | 3-0-1 | 2 | +10.0% | +16.4% (sango) | -0.0% (suzu) | 13 |
  | L25 (no gear, ★0) | t0 | 2 | +9.4% | +19.7% (luna) | +5.0% (midori) | 16 |
  | L25 (no gear, ★0) | 3-0-1 | 2 | +8.5% | +16.0% (rei) | +2.4% (midori) | 13 |
  | strong (L60 ★3 gear) | 5-0-2 | 2 | +10.3% | +16.3% (rei) | +5.5% (hotaru) | 13 |
  | strong (L60 ★3 gear) | t0 | 2 | +11.3% | +20.7% (hikari) | +6.3% (suzu) | 16 |

  **Median +8.5 to +11.3 % at every level and build** — flat from level 1 to 60. The top rows are the four
  elite-signature girls against an elite (Luna +17–20 %, Sango, Rei, Kage: their +5 % is the signature) and Hikari's
  crit at strong stats (+20.7 %, crits ×1.95). Low-damage hits against armor gain a little more than paper at level 1
  (a 4-damage hit vs armor 1 turns +5 % damage into +6.7 %), exactly as levels and gear do.
- **Revision 1 vs 2 at L1** (same bench, same seeds; `v1cmp.md`): Suzu crowd +20.4 → +13.7 % (traps were flat +1.5);
  Luna single elite +24.4 → +1.2 % (flat armor ignore gone); Kage crowd +10.3 → +6.4 % (crowd signature gone); Momo
  coins +16.7 → +5.1 % at 30 coins a wave.

### 8.3 Team value of one girl's Potential (`team-bench.mjs`, critic issue 8)

Eight girls (Miko, Umeko, Aoi, Kage, Akane, Raika, Midori, Shiro) on a crowd stream; **team damage** with every girl
at P1 vs one girl (or all) at P6. **Greedy** = each girl on her own best-coverage spot (4-5; the aura covers whoever
lands near her — 2 girls each); **clustered** = everyone placed inside Miko's aura where possible (7-2; Miko covers 7,
Umeko 6) — the best case for an aura. Mean ± 95 % interval over seeds.

| Preset / build | Layout | Miko P6 | Umeko P6 | Aoi P6 | Kage P6 | Raika P6 | All eight P6 | Seeds |
|---|---|---|---|---|---|---|---|---|
| strong, t0 | greedy | +0.3 ± 0.3 % | +0.4 ± 0.5 % | +0.4 ± 0.5 % | +0.4 ± 0.6 % | +1.6 ± 0.5 % | +8.3 ± 0.4 % | 12 |
| strong, 3-0-2 | greedy | +0.4 ± 0.7 % | +0.2 ± 0.4 % | +0.0 ± 0.5 % | +0.8 ± 0.5 % | +1.3 ± 0.5 % | +10.3 ± 0.4 % | 6 |
| L14 no gear, t0 | greedy | +0.2 ± 0.0 % | +0.4 ± 0.4 % | +0.4 ± 0.4 % | +0.4 ± 0.0 % | +1.2 ± 0.5 % | +8.7 ± 0.8 % | 6 |
| strong, t0 | **clustered** | +2.4 ± 2.5 % | +1.6 ± 2.8 % | +1.2 ± 2.2 % | +1.4 ± 2.2 % | +1.7 ± 1.7 % | +12.0 ± 2.7 % | 4 |
| strong, t0, revision 1 auras (+1/+2 %) | clustered | +3.2 ± 2.5 % | +3.5 ± 1.8 % | | | | | 4 |

- With the revision-2 aura (+1 % at P4, +1 % at P6) **an aura girl's P6 is worth about what a damage girl's P6 is
  worth to the team**: +0.2–0.4 % when two girls stand in her aura, up to ~+2 % when the whole team does (the
  95 % intervals overlap the damage girls'). Revision 1's +3 % aura was about twice that in the clustered case.
- The partner's girls in co-op count the same way; auras still do not stack (strongest per key).
- **All eight at P6 = +8 to +12 % team damage**, the same as one girl's own gain — Potential scales a whole team by
  about one level band, never more.

### 8.4 Campaign (`campaign-r2.mjs`, the balance test's bot)

The `balance.test.js` bot (autoPlan, free girls only, expected level per chapter) on all 40 stages, Easy and Normal;
the eight x-5 boss stages on Hard and Nightmare. P1 = today; **F2P Potential** = R P6, SR P4, SSR/heroes P2 (a free
player after the one-time sources, §8.7); P6 = every girl P6.

| Difficulty | Stages | P1 wins (seeds 1 / 2 / 3) | F2P Potential wins | P6 wins | Lives left on won stages, P1 → F2P → P6 |
|---|---|---|---|---|---|
| Easy | 40 | 40 / 40 / 40 | 40 | 40 | 5,752 → 5,770 → 5,779 |
| Normal | 40 | 39 / 39 / 39 | 39 | 39 | 3,437 → 3,521 → 3,551 |
| Hard (boss stages) | 8 | 5 | 5 | 5 | 125 → 136 → 135 |
| Nightmare (boss stages) | 8 | 0 | 0 | 0 | — |

- **Potential wins no stage that P1 loses and loses none that P1 wins** (the Normal loss is 8-5, the campaign Matriarch,
  at wave 30/30 in all three). It adds lives: Normal 4-5 61 → 86, 3-4 53 → 73, 7-5 88 → 97; Hard 2-5 32 → 40;
  Nightmare 2-5 lasts to wave 8 instead of 1. P1 seeds differ by ≤ 3 lives in total, so seed 1 is representative.
- The Easy gate (P1) stays the lower bound and does not change; `BALANCE=full` gains F2P and P6 columns (§11.1).
- Note for #75 (playtest rebalance): chapters 1–3 are played with R girls at about P6 (≈ +9 % on Aoi, Rei, Yuki, Momo).

### 8.5 Co-op freeplay (`fp/bot.mjs` on the freeplay worktree's own sim)

The freeplay spec's calibration bot, unchanged, on `wt-freeplay` `aa8613a` with the r2 overlay (`out-fp`). Its P1 runs
are the baselines (the shipped freeplay differs slightly from its prototype: Blossom 8-5 god Kage army dies at 160
here, 170 in the prototype). Cells: death wave (first leaking wave), one per seed.

| Tier, stage | Team (freeplay §7 presets) | P1: death (first leak), seeds 3 / 5 / 7 | P6: death (first leak), seeds 3 / 5 / 7 | Mean Δ death | Mean Δ first leak |
|---|---|---|---|---|---|
| Blossom 1-3 | strong ("4k DPS"), mixed | 158 (150), 158 (150), 150 (140) | 160 (150), 160 (150), 158 (150) | **+4.0** | +3.3 |
| Blossom 8-5 | strong, mixed | 140 (134), 141 (136), 141 (136) | 143 (137), 143 (137), 143 (137) | **+2.3** | +1.7 |
| Blossom 8-5 | **god, Kage army (the owner's max-Kage build)** | 160 (150), 160 (150), 160 (150) | 170 (150), 170 (150), 170 (150) | **+10** | 0 |
| Crimson Moon 1-3 | god, mixed | 146 (140) (seed 3) | 145 (140), 145 (140), 145 (140) | −1 | 0 |
| Tempest 1-3 | strong, mixed | 130 (80) (seed 3) | 130 (80) (seed 3) | 0 | 0 |

- **The friend's "4k DPS" team lasts 2–4 waves longer at P6 on every girl**, still inside freeplay's own guard band
  (135–170) — and a realistic team has R/SR girls at P6 but SSRs at P2–P3.
- **The max-Kage army moves by exactly one boss wall.** Both runs leak at the twin bosses of wave 150; P1 loses 72 lives
  there (28 left) and falls to the wave-160 Iron Colossus pair, P6 loses 36 (64 left), clears 160 and falls to the
  wave-170 pair. 170 is the bottom of the freeplay spec's own max-Kage band (Blossom 170–200; its prototype measured
  P1 170 on the same stage, the shipped sim 160). Kage's panel DPS rises +11.5 % (14,183 → 15,816), not the +17 % of
  revision 1's speed signature. The first leak does not move. (These three P6 runs used the interim table; seed 3
  re-run on the final table: 170 (150) again.)
- **Crimson Moon's guard holds** (god team ends at 145 < 160); Tempest does not move.
- These rows join `BALANCE=freeplay` (§8.6): strong mixed at P6 must end in 135–175; the god Kage army at P6 at most one
  boss wall past P1; Crimson Moon god at P6 before 160. If a later Potential retune breaks them, retune Potential, not
  freeplay.

### 8.6 Measurement plan and the `BALANCE=potential` guard (for the builder)

Every script lives in `exp/r2/` and runs against an overlay bundle (`make-overlay.mjs` → `build.mjs`; `REPO=` picks the
live checkout or the freeplay worktree). Re-run the bench and freeplay rows after any change to `src/data/potential.js`,
after the Chika rework and when the roster lands (11 new rows).

| Script | Question | Pass (also the opt-in `BALANCE=potential` / `BALANCE=freeplay` guard) |
|---|---|---|
| `bench-r2.mjs` (`PRESET=strong`, t0 / 5-0-2, 3 seeds; 180 s for slow shooters, melee and snipers) | Per-girl P1 → P6, endgame | Panel +6–11 % for every damage dealer; crowd median ≤ +12 %, no girl above +16 % crowd at 180 s; walking-boss median (5-0-2) ≤ +18 % (information: range-sensitive) |
| `bench-r2.mjs` (`PRESET=L1…L25`, t0 / t2 / t3, no gear, ★0, 3 seeds) and `TARGETS=still` | Early progression and single target | Crowd median ≤ +12 % at every level; held single target median ≤ +13 %, no girl above +22 %; the medians at L1 and at strong within 3 points of each other (no level dependence) |
| `team-bench.mjs` (8 girls, greedy + clustered, ≥ 6 seeds) | Team value of one girl's P6 | Aura girl's P6 ≤ +3 % team damage (95 % upper bound ≤ +5 %); all-P6 team ≤ +13 % |
| `campaign-r2.mjs p1 / f2p / p6` | Campaign wins and lives | P1 rows = `balance.test.js`; P6 and F2P win every stage P1 wins |
| `fp/bot.mjs` on `out-fp` (3 seeds) | Freeplay death wave | Blossom strong mixed 1-3 and 8-5 at P6 end in 135–175; Blossom 8-5 and 1-3 god Kage army at P6 at most one boss wall (+10) past P1; Crimson Moon 1-3 god at P6 ends before 160 |
| `clanboss.mjs` | Clan boss caps at P6 | dealt ≤ hitCap; fastest clear ≥ 50 s at 3× |
| `det/run.mjs` (Node, Bun) + `det/ff.mjs` (Firefox) | Cross-engine determinism | `START` = live hash; `POTENTIAL_START` identical in all three |
| `backfill-r2.mjs` | Backfill accuracy per rarity | History-only never over-credits; R exact 100 %, SR ≥ 95 % from 600 recruits |

### 8.7 How fast players get there (unchanged from revision 1, `exp/gacha-mc.mjs`, real `rollOnce`, 3,000 players)

The duplicate rules did not change, so revision 1's numbers stand. Recruits in 10-pulls; free-to-play income per
`docs/ECONOMY.md` §3 (one-time sources ≈ 261 recruits, then 76.7 per 28 days).

| Girl | Pulls to P2 (median) | Pulls to P4 | Pulls to P6 (median, 25–75 %) | P6 for a typical free player |
|---|---|---|---|---|
| Aoi (R, starter) | 4 | 13 | 24 (17–31) | inside the starter gift |
| Momo (R, gacha) | 9 | 19 | 29 (22–37) | inside the starter gift |
| Kage (SR, free after 2-5) | 37 | 135 | 236 (173–318) | inside the one-time sources |
| Raika (SR, gacha) | 86 | 190 | 294 (217–384) | ≈ 12 days after them |
| Hikari (SSR, starter) | 176 | 668 | 1,164 (857–>1,185) | ≈ 11 months after them |
| Kaede (SSR, gacha) | 411 | 896 | > 1,185 | over a year |
| Kaede with every spark (200 pts) on her | 200 | 411 | 654 (600–800) | ≈ 5 months after them |

After the roster (30 girls: R 6 · SR 13 · SSR 11) everything slows: Aoi P6 at 36, Kage 313, Raika 375, a
standard-banner SSR P2 at ~910 pulls; on a banner featuring her (2/3 of SSR results) Kaede reaches P6 at ~425 pulls.
**R girls are P6 for everyone on day one and SR girls within the one-time sources**, which is why the early-level bench
(§8.2) matters: a new player plays chapters 1–3 with R girls at P6.


---

## 9. Fit with the in-flight work

| Work | How Potential fits | What to watch |
|---|---|---|
| **Co-op freeplay** (`wt-freeplay`) | Ships after it. Measured on its real sim (§8.5). Both change the co-op id; separate releases. | `BALANCE=freeplay` gains the P6 rows (§8.5). Data hash: both add tables to `coopVersion().data`. |
| **Battle save** (`wt-battlesave`) | Frozen `unitStats` carry `potential`; neutral merge restores old saves at P1 (§5). No new tower/Sim key. | Add `potential` to its neutral-key test. Both edit `save.js migrateProfile` (different blocks). |
| **Story** (`wt-story`) | Potential section on the Info tab (never gated); tip says "Info tab"; lesson 3 text (§7.9). The welcome 10-pull moves to 1-3 (D6), so `e2e/potential.mjs` grants its ticket through `window.__sakura`. | First duplicates of a new save arrive at 1-3 — the tip must not point at a locked tab (tested). |
| **UR awakening** (merged, `ffc4d23`) | UR tag top-left, P pill top-right; overlapping files: `components.js unitCard`, `students.js`, `formation.js`, `stage.js`, `student.js` (showcase), `towerPanel.js` (name line), `selectTicket.js`, `mall.js`, `ur.css`. | Ally's girl: UR and P both from `t.unitStats` (§7.6). Width e2e on the name line. |
| **Unit info** (`wt-unit-info`) | Sheet meta pill + Potential block (§7.7); one describer shared with `upgradeTags`. | Whichever lands second adds the hook. |
| **Roster B3** (`wt-roster`) | 11 new rows required (§3.4); `relay.reach` × `rangeMul` recommended; new keys only after a bench. Pool grows to 30 — the backfill is already pinned and M0 must ship first. | `newUnitState` line (skin + dupes), `gacha.js pull` (banner + potential), `revealCard` (banner tabs + tag; coordinate the audio hooks). |
| **Kit toggle** (#126, `KIT_STYLE_SPEC`) | Rows keyed `id@kitStyle`, fallback `id`; whole-girl steps fit any kit; effectiveness test over variants. | Add Potential to the kit spec's "what a kit variant changes" table. |
| **Chika rework** (#166) | Whole-girl steps reach her drones and her new own shot; only her signature name may change. | Re-run her bench row; data-only, one co-op id bump. |
| **Hero rework** (#168) | Heroes use the hero ladder on top of their 25-level track; `resolveStats` order (paths → hero levels → awaken → Potential sets → unit multipliers) stays. If heroes leave the gacha pool, their Potential stops growing; the hero spec decides. | — |
| **Codex modes / map rules** (#169) | A "fair" rule that equalises stats must also set `potential: 1`. | Note in that spec. |
| **Attack FX** (`wt-attack-fx`) | Render only; Potential adds no visual or event. Drone speed steps change how often drones fire, which attack-fx reads from sim events. | None. |

---

## 10. Economy: what needs the owner's approval

Potential adds **no currency, item, price, reward or drop** and leaves the fragment economy alone ("Both"). Things that
change value, for a yes:

1. **Sparks and SSR Select Tickets count as duplicates** (Q2). Sparking an owned SSR gives +1 Potential besides the 40
   fragments. After the roster (11 SSRs) a free player's SSR step takes ≈ 8 months, so sparking an owned SSR also
   competes with getting a new one.
2. **The backfill estimate** (Q1) gives some long-time players steps they cannot prove (SSRs: 9–26 % of girls over by
   one with the cautious default).
3. **Freeplay**: a P6 team lasts 0–4 waves longer (one boss wall, +10, for a god-gear Kage army; §8.5), so it earns 40 coins × those waves × tier and may reach
   a one-time milestone sooner (wave 100: 50 gems, wave 150: 100 gems, per tier, `wt-freeplay rewards.js:33-36`).
4. **Endless / Tactical Challenge** pay 40 coins per wave cleared (`rewards.js:153-154`): a few more waves, a few
   hundred coins.
5. **Clan boss** (measured, `exp/r2/clanboss.txt`): a maxed P6 team deals the same damage (the clear is the boss's HP:
   149k/196k/164k vs caps 175k/230k/195k) and clears 1–3 % faster; the fastest clear stays 59.8 s at 3× ≥
   `BOSS_FULL_RUN_SECONDS` 50. No change needed; a P6 row joins `tests/online/clanBoss.test.js`.
6. **Featured banners** (roster) become more attractive for owned girls. Noted for the economy review.
7. **Visible change to an existing screen:** the student page "Yours" column will include the ★3 passive (§7.3).
8. **Later, not in v1:** a "Full Bloom" achievement or a Potential item would be rewards → separate request.

---

## 11. Tests

### 11.1 Unit (vitest)

- `tests/data/potential.test.js` (new):
  - **every `UNITS` id has a row** (and every `kitUnit` variant whose kit differs in a used key); every girl resolves
    five steps P2…P6 and the P6 step has a name;
  - only `POTENTIAL_GIRL_KEYS` / `POTENTIAL_MOD_KEYS` appear; each banned key fails;
  - tables are deep-frozen;
  - **effectiveness:** for every girl (and kit variant) and every step k, `resolveStats` at P(k) differs from P(k−1) in
    a field her behaviour reads: `projectile/beam/pulse/chain/duel` → damage, rate, range, crit, eliteMul, bossMul,
    silence, ramp; `trap` → trap.*; `turret` → turret.*; aura girls → aura.* or own attack; economy → income;
    roster `relay` girls → relay.* (the test lists the behaviour → fields map);
  - **budget:** whole-girl Π damageMul × Π rateMul ≤ 1.105, Π rangeMul ≤ 1.075, Π incomeMul ≤ 1.06; each step ≤ 1.03
    (damage/speed/coins) or ≤ 1.04 (range); crit.chance Σ ≤ 0.05; eliteMul, bossMul ≤ 1.05; aura product ≤ 1.0201; silence
    ≤ 0.1; ramp.max ≤ 0.05;
  - `potentialFold(def, x)` for undefined, NaN, '6', 0, 1 → neutral; 6 and 99 → five steps.
- `tests/sim/mods.test.js` (add): `resolveStats` with `potential` 1 / absent is **deep-equal to today** for every unit ×
  tiers {[0,0,0],[5,0,2],[2,5,0],[0,2,5]} × heroLevel {0,1,10} (snapshot before the change); Aoi P6 = damage
  ×1.02×1.03, rate ×1.02, range ×1.03, crit +0.03; Chika P6 changes `turret.rate/range/damage`; Suzu P6 changes
  `trap.damage`; Momo P6 income 30 → 31.518; Miko aura `dmgMul` ×1.0201; Umeko ★0 tier 0 aura `rateMul` 1 → 1.0201.
- `tests/systems/potential.test.js` (new): `potentialLevel`; `grantUnit` (new girl, dupes 1…5 → P2…P6 with the same
  fragments as today, 6+ → fragments only, `dupes` keeps counting, shadow written); `pull()` / `spark()` /
  `redeemSelectTicket()` fields; `backfillDupes` cases (starter, gacha-first, two copies in one 10-pull, spark 1 ms
  skew, free girl then recruited, `obtainedAt` missing, empty history with `totalPulls`, time share, SSR cautious,
  `POOL_SIZE_V0125` used even when `POOL` is bigger); **property test**: real `pull()` over 200 seeded profiles ≤ 100
  recruits → backfill = truth; > 100 with the estimate off → never above truth; idempotent migrate.
- `tests/systems/save.test.js` (add): `newUnitState().dupes === 0`; migrate keeps `dupes`; v0.1.25 fixture without
  `dupes` backfills and sets `'potential-backfilled'`; **stale-tab case**: save → strip `dupes` through the old
  `cleanUnit` (fixture copy of v0.1.25's) → 3 more recruits in history → migrate → `dupes` = old + 3, never lower;
  `migrationDropsData` stays false.
- `tests/systems/mail.test.js` (add): letter once, only with the marker and a P2+ girl, never for a new profile, no
  rewards.
- `tests/systems/progression.test.js` (add): `unitBattleStats().potential`; `unitPower` grows with P for **every**
  girl (Miko, Umeko, Momo, Hotaru included).
- `tests/systems/gacha.test.js` (`:102`, extend): fragments unchanged and Potential rises.
- `tests/online/clanBoss.test.js` (add a P6 row): cap holds, fastest clear ≥ 50 s at 3×.
- `tests/integration/balance.test.js`: Easy gate unchanged (P1). `BALANCE=full` gets **F2P-Potential** (R P6, SR P4,
  SSR P2) and **P6** columns (information; Normal ≥ 60 % and Nightmare ≤ 35 % also checked on those columns).
- **`BALANCE=potential`** (new, opt-in, `tests/integration/potential.balance.test.js`): the §8.6 guard.

### 11.2 Determinism

- New `POTENTIAL_START` battle in `e2e/engines/scriptedBattle.js` (a second exported start + script; **`START` is left
  unchanged** so its `411300916` anchor stays): the `exp/r2/det` line-up, Umeko on a water spot or swapped for a land
  aura girl. `node e2e/engines.mjs --require-all` must agree in V8, JSC and Firefox's engine on both battles.
- `tests/online/engines.test.js` / coop session tests: `createCoopSim` with **the same `unitId` at different
  Potential** for host and guest: per-owner `t.stats` differ, `hashSim` equal on both clients, each panel pill reads
  its owner's P.

### 11.3 e2e — new `e2e/potential.mjs` (844×390 touch and 1280×720)

1. Fresh profile; via `window.__sakura`: `grantUnit` Aoi ×3 (P4), Kaede ×5 (P6); add one `ticket_recruit10` (the story
   moves the welcome ticket to 1-3).
2. **Students**: Aoi `card-pot` "P4", Kaede "P6" (dark text); sort Potential puts Kaede first; formation slot pill inside
   the slot.
3. **Student (Aoi)**: showcase pill "P4" → Info tab, `potential-section` in view, nodes P1–P4 `.on`, P5 `.next`,
   signature "Unlocks at P6 (2 more duplicates)"; "Yours" damage = base × level/gear × 1.02; no horizontal scroll.
4. **Recruit**: grant Yuki and Momo so all four R girls are owned below P6; 10-pull; ≥ 1 `ma-gc-pot`; summary has
   "▲ N Potential" on one line at 844×390; Potential matches `dupes` afterwards.
5. **Spark** an owned Kaede (P6 → "MAX", kicker "SSR · P6 · MAX") and a fresh girl; **Select Ticket** on owned Hotaru
   (confirm text "P1 → P2", `showJoined` "Potential 2 ▲").
6. **First-gain tip** text says "Info tab"; with the story's lock on, the Info tab opens (not a locked tab).
7. **Battle 1-1**: Aoi panel `bt-panel-pot` "P4"; panel DPS = `sim.towerStats(uid).dps`; name line does not overflow.
8. **Migration**: v0.1.25 fixture (no `dupes`, 40 history entries, old `createdAt`) → expected P on cards; one letter;
   reload → still one letter, same Potential.
9. Screenshots of each step at both sizes to `$SCR/potential/`; no page errors.

Keep green: `smoke.mjs`, `stat-display.mjs`, `ur-awaken.mjs`, `nav-back.mjs`, `engines.mjs --require-all`, the
battle-save and story e2e once merged.

---

## 12. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Long-time players feel short-changed on SSRs | Medium (SSR backfill is a coin flip) | Q1; the letter says it is an estimate; M0 stops further loss. |
| Roster ships before M0 | Would break the estimate | M0 is a hard gate on the roster release (§13). |
| Stale tab / old-client import | Low | Shadow + history catch-up (§6.5), tested. |
| Potential pushes freeplay out of its calibration | Low (§8.5) | P6 rows in `BALANCE=freeplay`; retune Potential, not freeplay. |
| A "small" step is big somewhere | Low now (all relative) | `BALANCE=potential` guard at L1/L14/L25/strong; effectiveness + budget tests. |
| Roster / kit girls get dead steps | Medium | Row-per-girl and effectiveness tests fail the build. |
| Merge conflicts (roster, story, unit-info, battle-save, kit toggle) | Medium | Small, named edits (§4); land after freeplay. |
| Co-op players on different builds | Certain once | One deliberate bump; own release. |
| Name "Potential" | Low | The owner's own common word; our own pill, track, icon and signature names. |

---

## 13. Milestones

| Milestone | Contents | Gate |
|---|---|---|
| **M0 — counting starts (invisible)**: next normal update, **no later than the roster release** | `newUnitState.dupes`; `cleanUnit`; `grantUnit` increments + shadow; `POOL_SIZE_V0125`; `backfillDupes` + `restoreFromShadow` + migrate call + `'potential-backfilled'` marker. No UI, no letter, no sim, **co-op id unchanged**. | §11.1 backfill / grant / save / stale-tab tests; full vitest. Owner note: "starts counting duplicates now so none are lost; nothing visible changes yet". |
| **M1 — data + sim** (after the freeplay branch merges) | `src/data/potential.js`; `mods.js` fold; `constants.js`; `version.js` data hash; `unitBattleStats` / `unitPower`; `pull()` fields; `systems/potential.js` describer. | §11.1 data/mods/progression tests; `POTENTIAL_START` V8 = JSC = Firefox; `BALANCE=potential`; freeplay P6 rows; `BALANCE=full` P6/F2P columns. |
| **M2 — UI** | Cards + sort, formation/stage, showcase pill, Info-tab section, "Yours" column, recruit/spark/Select Ticket/Mall wording and tags, battle pill + UR ally rule, unit-info hook (if merged), story lesson 3 (if merged), wiki, CSS. | `e2e/potential.mjs` both sizes; screenshots reviewed; `stat-display`, `ur-awaken`, `smoke` green. |
| **M3 — letter, docs, ship** | `ensurePotentialLetter`; CONTRACTS §3 (Potential steps), §5 (`units[id].dupes`, shadow, `unitBattleStats.potential`); `docs/ECONOMY.md` (duplicates line, §8 table); `docs/ROSTER.md`; `docs/OWNER_REQUESTS.md` row; note for #75 that early stages are played with R girls at ≈ P6. | Full verify (vitest, build, smoke, nav-back, engines --require-all, potential e2e). Ship as its own version (co-op update for both players). |

---

## 14. Owner questions (each has a default; the build proceeds on the default)

1. **Q1 — SSR recruits older than your last 100.** The game only remembered your last 100 recruits. For R and SR girls
   an average-luck estimate is right 98–100 % of the time for long-time players. For SSRs any guess is a coin flip.
   Choose: **(a) cautious guess** — rarely a step too high (9–26 %), often a step too low (42–61 %); (b) average luck —
   more often too high (20–47 %) than too low (21–36 %); (c) no guess for SSRs — never too high, ~3 steps lost per SSR
   for the longest players. **Default: (a).**
2. **Q2 — Sparks and SSR Select Tickets.** Using them on a girl you already own also gives +1 Potential (besides the 40
   fragments)? **Default: yes.**
3. **Q3 — "after coop stuff and freeplay".** Potential (M1–M3) starts once co-op freeplay is merged; the in-flight
   co-op invites (social) are not a gate. The invisible counter (M0) goes out with the next update so no duplicate is
   lost — nothing changes on screen. **Default: yes to both.**

---

## 15. Critic resolution

Every issue was checked against the code and the experiments before deciding. **Fixed** = changed in this revision
(where it lives); **Partly** = fixed with a stated limit; **Rejected** = not changed, with the reason. None of the 23 was
rejected outright.

| # | Sev | Issue | Resolution | Where |
|---|---|---|---|---|
| 1 | H | Backfill accuracy measured under its own assumption; SSRs hidden in the 82–84 % headline | **Fixed.** Re-measured per rarity with uniform and bursty time and free girls joining at stage-clear times (the critic's script, pool pinned, 150 → 1,200 recruits). The headline is gone; §6.3 reports R / SR / SSR separately. The SSR rule is now cautious by default (Poisson 25th percentile) and Q1 gives the owner the three SSR options with their numbers. | §6.2, §6.3, Q1, `exp/r2/backfill-r2.md` |
| 2 | H | The estimate breaks once the roster lands | **Fixed.** `POOL_SIZE_V0125 = { R: 4, SR: 10, SSR: 5 }` is pinned; M0 is a hard gate on the roster release (no longer an owner question). Because the first load of any M0 build runs the backfill once and every later recruit is counted, the estimate only ever covers v0.1.25-pool recruits; banners arrive with the roster, after counting starts. | §6.2, §13 |
| 3 | H | The story locks the Awakening tab until 3-2, so the pill and tip lead to a locked tab | **Fixed.** The Potential section moved to the **Info tab** (default tab, never locked; the story gates only Equipment and Awakening). Showcase pill → `?tab=info&focus=potential`; tip says "See her Info tab"; story lesson 3 text updated; the e2e grants its 10-pull through `window.__sakura` and checks the tip target with the story lock on. | §7.2, §7.3, §7.4, §7.9, §11.3 |
| 4 | M | Spark and Select Ticket reveals drop Potential | **Fixed.** `recruit.js:97` passes `potential`/`potentialUp`; spark grid (`:83`) and `showJoined` (`selectTicket.js ~:73`) texts; all six kicker strings (pity × Potential × MAX); e2e steps for a spark and a ticket on owned SSRs. | §4.8, §7.4, §7.5, §11.3 |
| 5 | M | Balance only measured at endgame stats; flat bonuses are big early | **Fixed by redesign + measured.** Every step is now relative (whole-girl multipliers like level and gear; `+3 % range`; damage reaches traps; `+5 % vs elites/bosses`; `+2/3 % coins`); flat range / trap / armor-ignore / income are banned. Benched at `EXPECTED_LEVEL` 1/8/14/20/25, no gear, ★0, t0 and 3-0-1: crowd median +8.5 to +9.6 % at every level (endgame +9.2 %); a new held single-target measure gives +8.5 to +11.3 % at every level (the walking-target measure was too noisy at low level, §8.2). Two rows that still stood out were fixed in the data: Rei's P4 is crit instead of range (her t0 single boss +24.4 → +17.2 %), Sango's signature is elites only (5-0-2 single boss +28 → +18.4 %). Gated in `BALANCE=potential`. **Partly:** t2 was not run on this shared machine (load 20–35); with relative steps t2 sits between t0 and 3-0-1, and the guard runs t0/t2/t3. | §3.2, §3.3, §8.2, §8.6 |
| 6 | M | "Upper bound" claim false (campaign/freeplay ran on the draft table; campaign stopped at 36/40, no Normal) | **Fixed.** The claim is removed. Campaign re-run: all 40 stages, Easy + Normal, P1 with 3 seeds (they differ by ≤ 3 lives in total), F2P and P6 with seed 1 on the final table (P6 seeds 1–3 on an interim table that differed only in Sango's signature and Rei's P4 won the same 79/80); the eight boss stages on Hard + Nightmare. Freeplay re-run on the **real freeplay worktree's sim** with the final r2 overlay. | §8.4, §8.5 |
| 7 | M | Freeplay never measured the owner's max-Kage build, Tempest / Crimson, or its own guards; one seed | **Fixed, partly in scope.** Kage's signature is now `+5 % vs elites` (not crowd speed). Measured: Blossom 8-5 god Kage army P1/P6 × 3 seeds, Blossom 1-3 and 8-5 strong mixed P1/P6 × 3 seeds, Crimson Moon 1-3 god P1 × 1 and P6 × 3 seeds (guard "< 160"), Tempest 1-3 strong P1/P6 × 1 seed. The `BALANCE=freeplay` P6 rows now include the Kage army and Crimson Moon. **Limit:** Tempest has one seed, and the Blossom 1-3 god Kage army (a run to wave 200 with ~50 Kages) was not run on this shared machine (load 30); the guard runs both with 3 seeds. The three god Kage-army P6 runs used the interim table (Sango's boss bonus, Rei's range step); seed 3 re-run on the final table gives the same 170 (150) (`fp/out-final-godP6-kage-s3.txt`). | §3.3, §8.5, §8.6 |
| 8 | M | Aura girls measured with one beneficiary; aura steps are team-wide | **Fixed.** New 8-girl team bench by team damage (greedy and clustered layouts, 6–12 seeds, 95 % intervals). Aura steps cut from +1/+2 % to +1/+1 % and budgeted team-wide; the budget test caps the aura at +2 %. Umeko's tier-0 speed aura is named in the text. | §3.3, §8.3, §11.1 |
| 9 | M | Tests cannot see range / trap / turret / aura / income / silence / ramp steps; the five-step test is empty | **Fixed.** Effectiveness test (each step must change a field her behaviour reads, by behaviour, incl. kit variants and roster `relay`); a budget for every key; the row-per-girl test replaces the empty five-step test; tables deep-frozen; `BALANCE=potential` sim guard. | §11.1, §8.6 |
| 10 | M | Roster B3 girls fall back to near-dead ladders | **Fixed.** No silent fallback: a row is required for every `UNITS` id; the roster PR writes 11 rows that must pass the effectiveness test; `relay.reach × rangeMul` recommended to the roster; `airMul` / `gather` / `relay.reach` allowlisted only with a bench. Whole-girl steps already reach anything unit stats scale. | §3.4, §9 |
| 11 | M | Kit toggle keeps the same `id`, so School rows apply to the Fantasy kit | **Fixed.** Rows keyed `id@kitStyle` with fallback to `id`; memo per def object; effectiveness test over every `kitUnit` variant; §9 row. | §3.2, §3.4, §9 |
| 12 | M | "Potential never goes down" broken by a stale tab / old-client import | **Fixed.** Shadow `missions.counters['pot:<id>']` + `'pot:at'` (old builds keep that map verbatim, `save.js:238`); on load a dropped `dupes` is restored from the shadow plus the history after `pot:at`. The one remaining exception (> 100 recruits on an old tab) is stated in the rule and tested. | §2, §3.1, §6.5, §11.1 |
| 13 | M | Editing `START` conflicts with Chika rework / freeplay and loses the P1 anchor; determinism covered few step kinds; no Firefox engine | **Fixed.** A separate `POTENTIAL_START` (Chika, Suzu, Miko, Momo, Luna, Hotaru, Kaede, Shiro, same girl at P1 and P6) leaves `START` and its `411300916` anchor alone. Measured in V8, JSC **and Firefox's engine (Firefox 142)**: `860886411` / `be315485` everywhere; P1 = live everywhere. `--require-all` is the gate. | §5, §11.2 |
| 14 | L-M | Co-op "same girl, different Potential" untested | **Fixed.** Measured in `POTENTIAL_START` (host Aoi P1, guest Aoi P6: per-owner stats differ, hashes equal in three engines) and specified as a co-op test with panel pills. | §5, §11.2 |
| 15 | L-M | Potential tables not in `coopVersion().data` | **Fixed.** `version.js` hashes the three tables (freeplay's precedent). | §4.7 |
| 16 | L-M | UR overlap wider than stated; width; inconsistent ally rule | **Fixed.** UR is now merged (`ffc4d23`); every overlapping file is listed; one rule — P and UR for an ally's girl both come from `t.unitStats` (one-line UR change, display only); width budget for the 340 px phone panel plus an e2e overflow assertion. | §7.6, §9 |
| 17 | L-M | §10 missing value changes (freeplay milestones and coins, clan boss, endless, post-roster SSR) | **Fixed.** Listed for the owner. Clan boss **measured**: same damage, 1–3 % faster, fastest clear 59.8 s ≥ 50 s, so no change; a P6 row joins `clanBoss.test.js`. | §10, §11.1 |
| 18 | L | Balance gates only at P1 | **Fixed.** `BALANCE=full` gets F2P-Potential and P6 columns with the Normal/Nightmare checks; note for #75. | §11.1, §13 |
| 19 | L | Short labels, P6 contrast, formation slots, summary wrap | **Fixed.** ≤ 9-character labels from one describer (§3.3); P6 pill uses dark plum text (5.6:1 / 8.3:1); compact formation-slot pill; phone summary drops the words "Star Fragments" (icon + number stay) and e2e asserts one line. | §3.3, §7 |
| 20 | L | Unit-info sheet and Power; "Yours" change | **Fixed.** Sheet pill + Potential block; `unitPower` uses whole-girl multipliers **plus 20 per step**, so every girl's Power moves; the "Yours" change (adds the ★3 passive) is listed for the owner. | §4.4, §7.3, §7.7, §10 |
| 21 | L | Letter gate is a hand-set date; wrong `main.js` line | **Fixed.** Gate = `seenIntro` marker `'potential-backfilled'` written by the backfill + a P2+ girl; call site `main.js:41`. | §4.6, §7.8 |
| 22 | L | Sequencing vs "do this after coop stuff and freeplay" | **Fixed.** M0 is explained as invisible counting; Q3 confirms the gate is the freeplay merge (social invites are not a gate). | §13, Q3 |
| 23 | L | Naming | **Accepted as is.** "Potential" is the owner's word and plain English; the pill, track, icon and signature names are ours (Kage's new "Moonless Strike" too). | §12 |

---

## Appendix: experiment files

Revision 2 (`exp/r2/`):

| File | What |
|---|---|
| `potential.data.js` | Proposed `src/data/potential.js` (verbatim, minus the deep freeze and the `WeakMap` memo) |
| `make-overlay.mjs` | Asserted exact-once patches of `mods.js` / `constants.js` against `REPO` (live or `wt-freeplay`) + the data file |
| `build.mjs`, `entry.js` | Vite bundle of a repo's real sim with the overlay (`out-live`, `out-fp`) |
| `sanity.mjs` | P1 vs P6 resolved stats for 13 girls |
| `table-r2.mjs`, `table-r2.md` | §3.3 table and short labels from the data |
| `det/` (`entry.js`, `run.mjs`, `ff.mjs`, `result.txt`; overlay `e2e/engines/potBattle.js`) | `START` and `POTENTIAL_START` in Node, Bun and Firefox |
| `backfill-r2.mjs`, `backfill-r2.md`, `backfill-r2-qall-sr.md` | §6.3 per rarity, uniform and bursty |
| `bench-r2.mjs` (`PRESET`, `BUILDS`, `RUN`, `TARGETS=crowd,boss,still`, `POT_PATCH` probes) | Per-girl P1 vs P6 bench |
| `bench/`, `bench-long/` (180 s), `summ-r2.mjs`, `merge-strong.mjs` → `strong-final.md`, `early-final.md` | §8.1 and §8.2 crowd / walking-boss rows |
| `bench-still/`, `still-summ.mjs` → `still-final.md` | §8.2 held single target, L1 / L14 / L25 / strong |
| `bench-elite/`, `elite-summ.mjs` | 180 s walking elite at L1 / L25 (why it is not the guard measure) |
| `bench-v1/`, `v1cmp.mjs` → `v1cmp.md` | Revision 1's table vs revision 2's at L1 |
| `probe/` | Sango (signature / range removed) and Rei (range removed) probes |
| `team-bench.mjs`, `team/`, `team-summ.mjs` | §8.3 team value of one girl's P6 (8 girls, greedy and clustered layouts) |
| `campaign-r2.mjs`, `camp/` (P1 × 3 seeds, interim P6/F2P), `camp-final/` (final P6, F2P, boss stages), `camp-final-summ.mjs` | §8.4 |
| `fp/bot.mjs`, `fp/builds.mjs`, `fp/out/`, `fp/runs/`, `fp-summ.mjs` → `fp-final.md` | §8.5 freeplay bot (the freeplay spec's, unchanged) on `wt-freeplay`'s sim |
| `clanboss.mjs`, `clanboss.txt` | `clanBoss.test.js` replayed at P1 and P6 |
| `out-live.r2a`, `out-fp.r2a`, `out-live.r2b`, `out-fp.r2b` | Interim bundles (r2a: Sango "elites and bosses" + Rei range; r2b: Rei range), kept for the runs that used them |
| `jobs2.txt` … `jobs10.txt`, `queue*.sh` | The exact job lists behind every number |

Revision 1 files (`exp/`) are kept for the history; `exp/sango-probe.mjs` and `exp/gacha-mc.*` are still cited.
