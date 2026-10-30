# Gear update specs: independent review, round 3

Reviewer: a fresh agent. I wrote none of these specs and did not do round 1 or round 2 (the review gate, HANDOFF §6).

**What I reviewed.** `spec/gear-update` at `44ba55dc`, which holds:
- `docs/specs/GEAR_UPDATE.md` r3 ("GU");
- `docs/specs/ACCESSORIES.md` r2 ("ACC");
- `docs/specs/BUILD_COACH.md` r2 ("BC");
- `docs/review/gear-update/OWNER_BOARD.md` ("board").

**What I checked it against.**
- `review-r1.md` and `review-r2.md`.
- `origin/main` at `60ce9cad` ("main").
- `origin/feature/balance-r5` at `d6f092b7` ("r5").
- `origin/feature/gear-m0` at `d15fba99` ("M0", built from spec r2).

A `file:line` refers to the tree named beside it. A bare `GU:`, `ACC:`, `BC:` or `board:` line is in this branch.

**Method.** I ran no tests or benches (the machine is overloaded). Every code claim comes from reading the code. The
numbers are arithmetic on the code's own constants or on the specs' own tables, and each one is labelled as such. The one
script I ran was a colour-distance check of eleven hex values.

New findings continue the earlier numbering: **F10** (MEDIUM) and **L27–L30** (LOW).

**Verdict: NOT OK.** There is no BLOCKER or HIGH finding. There is 1 MEDIUM (F10) and there are 4 LOW findings (L27–L30).

What holds:
- F8, F9 and L14–L26 are fixed as written (§1).
- Nothing fixed in round 1 or round 2 has come undone.
- The names are clean and the content is wholesome (§4).

F10 is new. G4, the gate for the owner's Q6, can now be run. Its pass rule probably cannot be met on Blossom Normal,
though, and no step is allowed to fix that. The board also promises the owner an outcome that the measurements may not
give.

---

## 1. Round-2 findings, checked against the code

| # | Where r3 fixes it | What I checked | Status |
|---|---|---|---|
| F8 | GU §1 D16 (`:126`), §8.4 order (`:721-732`), G0 (`:747`), §14 (`:1071-1079`); board Q19 (`:77-81`); ACC §5 (`:176-186`) | `LR_POWER` exists on r5 (`src/data/balance.js:91-100`): the duo `{ dmg: 1.05, boss: 1.6 }` and Tenka `{ boss: 3.4 }`, folded in by `powerFor` while `lr` (`:143-156`). GU's figures at `6954c757` and `d6f092b7` match both commit messages. The order (round 5's LR rows, then G0, then the gear gates) is stated in three places and is consistent | Fixed (L27 on the measure) |
| F9 | GU G4 (`:751`), "G4 in detail" (`:762-790`), §12 (`:1039-1041`), §14 M3 effort (`:1079`) | Every tool exists on r5. `capBot.mjs` builds A, A2, B and C with real coins (`:299-303`). `bossCap.mjs` takes `--bosses`, `--waves` and capBot's flags (`:7-27`); it bisects HP between 1e4 and 1e13 (`:113-120`) and reports `ratio` = killed ÷ the most scheduled HP in `[wave, wave + 24]` (`:36-45`, `:122-126`). The Wyrm is the calamity at 250, every 50 waves (`src/data/freeplay.js:111` on r5), so at `--waves 250` the window holds only wave 250 and K is exactly what GU defines. `gearGuard.mjs` still plays freeplayBot's flat-stat `team` board (`:12`, `:53-55`), and GU gives it `--build`. 24 runs, the 6–18 band, ≥ 2 wins a stage, the margin, "weaker" and the room left for A-G2 are all stated | Runnable. The pass rule is F10 |
| L14 | GU §3.2 ceilings (`:276-292`), §3.4 (`:378`), §10.2 (`:906-936`) | Each ceiling sits inside its new clamp row: `critChance` 2 / row 0–2; `critMul` 12 / 1–12; `abilHaste` 0.75 / 0–0.75; `auraPct` 5 / 0–5; `controlMul` 4 / 1–4. `auraRangeMul` is ≤ 1.6 × (1 + `AURA_FILL_M` 0.05) = 1.68 (`src/data/gearStats.js:54` on main), under the new row of 2 | Fixed |
| L15 | GU §4.5 (`:505-509`), §10.1, §10.2 (`:916-917`), §11.2 (`:1010-1014`) | The sim clamps crit chance in exactly two places, `mods.js:803` and `buffs.js:35-36` on main (a grep of `src/sim` for crit clamps finds no third). `Sim._hit` draws once whenever `critChance > 0` (`Sim.js:575`). The rules for a borrowed Geometry girl and a borrowed Blank LR girl now agree | Fixed |
| L16 | GU §3.2 (`:291-299`), §10.3 (`:946-948`), §13 (`:1062`) | At a wave clear, interest is `min(INCOME_INTEREST_MAX, rate × cash)` (`Sim.js:927`); the lab joiners pay the same (`lab.js:247`). With a per-girl ceiling of 5,000, cash grows at most linearly, so it never reaches Infinity or NaN. `_gainCash` (`Sim.js:472-479`) is the right place for `CASH_MAX`. Two notes are in L30 | Fixed |
| L17 | GU §3.2 (`:325-328`), §3.4 (`:375`); ACC §3.1 (`:108`), §7 (`:227-230`) | Finale Pop's spec (`towers.js:2251-2252`) strips `critChance`, `status`, `mark`, `silence`, `reveal`, `knockback` and `hpPct`. `explode` (`towers.js:687-691`) only calls `_hit`, and `_hit` draws nothing at `critChance: 0`. A status draws only when `chance < 1` (`status.js:29-31`). Forced shards that use the average crit add no draw. One nit is in L30 | Fixed |
| L18 | GU §3.4 (`:373`) | `damageTakenBonus` (`combat.js:47-50`) has exactly two callers: `computeHit` (`:90`) and `computeDot` (`:178`). The same holds on r5. Putting You're It inside it therefore reaches hits and burn and poison ticks once each, and **nothing applies it twice**. Hexes (`Sim.js:692-705`) skip marks by design, so they skip You're It too. That is consistent, but "+6 % from every girl" does not reach hex damage | Fixed |
| L19 | GU §9.3 (`:837-842`), §9.4 (`:850-854`) | On M0, `enhanceGear` writes `gbl:` bits for any UR piece below +10 with no slot check (`src/systems/gear.js:635-639`), salvage prices them (`:677`), and `gph:` carries the box-born flag 32 (`gearMarks.js:111`). The "stat gone" refunds for `gtp:` and `gtx:` are built (`gearMarks.js:262-287`). The code matches r3; one comment does not (L29) | Fixed (and built) |
| L20 | GU §5.2, §5.3 (`:571-584`) | There is one mark per box, set by whichever trigger pays it first. `tfc:<titan>:2` is the Nightmare first clear | Fixed in the spec. M0 still has `su:vet` (L29) |
| L21 | GU §11.2 (`:988-1008`) | The server checks `octet_length(p::text) > 8192` (`friend_support.sql:177`, `profile_gear.sql:41`). The card carries only ids and numbers (keys `v, fav, ban, frm, ttl, units, med, fp, st`, `friend_support.sql:178`), so "one byte per `:` and `,` outside strings" is the exact jsonb-text rule. `x` is optional on the server (`g ? 'x'`, `:153`), so dropping substats gives a valid card. `ac` is now defined once, in GU and in ACC §8 (`:241-243`) | Fixed (wording nit in L30) |
| L22 | ACC §0, §1, §6, §7 (`:24-26`, `:58-67`, `:209-216`, `:223-226`) | `accItem`, `accId`, `accR`, `acs-`, `acw:`, `apity`, `ACC_IDS`, `acc_token`, `acc_tenka`, `railBudget`, `callT` and `railT` have no hits on main, r5 or M0. `rails` is Tenka's path id (`units.js:1376`) but never a tower field, so the tower key does not clash | Fixed |
| L23 | ACC §3.1 (`:101-108`), §3.2 bounds (`:129-140`), §7 (`:231-233`) | The rail caps (3 per Tenka, 24 in the battle) and `railBudget` (+1 a step, ≤ 30 banked, 1 a hit) are numbers now. The sim steps at 1/60 s (`constants.js:4`), so "at most 60 rail hits a second" holds, plus a burst of up to 30. Tenka's 8 bolts a second matches `units.js:1365-1366`. The split counter matches `duo.js:21-24` | Fixed |
| L24 | ACC §0 (`:38-41`), §4 (`:161-172`); board Q17 (`:99-119`) | Arithmetic: 1 − 0.99^79 = 54.8 %; E[pulls] = (1 − 0.99^80) / 0.01 = 55.25, so 6,630 gems; R5 is 5 × 55.25 = 276 pulls = 33,150 gems, at most 400 pulls = 48,000 gems; pity 60 gives 45.3 pulls. The rates sum to 100 %. A2 waits for Q17, and A-G3 is on A1 | Fixed (one rounding nit, L30) |
| L25 | BC `:3`, §0, §1, §2, §7, §8 | `awakenCost(unitId, star)` is exported at `progression.js:425` on main. The tabs are Info, Level, Awaken, Gear and Tree (`student.js:70-75`). `homeChipPages` is at `lobbyTray.js:130`. The sampling arithmetic holds: 19 builds × 2 targets × 3 seeds = 114 runs; 93 girl-paths × 114 = 10,602 runs | Fixed |
| L26 | GU §3.3 (`:343-346`), §3.4 (`:374`), §8.3 lever 1 (`:705-711`) | — | Fixed |

---

## 2. Do the specs disagree with what M0 built?

M0 (`0de56c76` and `d15fba99`) was built from spec r2. Most of it already matches r3:
- the five slots, `SLOT_IDS`, `ROLL_SLOTS` and `SET_ONLY_SLOTS`;
- the three support stats as main stats only, `NEW_STAT_SLOT` as lists and `TUNE_BITS` at 13;
- the `lr` 1 / 2 kinds, the `night` and `top` line fields, and `cleanGear`'s Set LR and Blank LR rules;
- the `gst:`, `glr:`, `gtx:` and `gtp:` marks, with "piece gone" and "stat gone" refunds;
- `gph:`, `gpm:`, `gps:` and `gpc:` with the flag layout of GU §9.5;
- the `tm:` and `gp:` mirrors, with present fields winning;
- `EXPORT_VERSION` 3, with the stored save kept at version 2;
- `MIRRORED_ITEMS` + 17;
- `CARD_FIVE_PIECES` false.

The `gp:` and `gph:` / `gpm:` / `gps:` / `gpc:` prefixes do not shadow each other, because the third character differs.

The builders must reconcile the following. Each is detailed in L28 and L29.

| Item | M0 | r3 | Fix |
|---|---|---|---|
| `gps:` substat base | capped at `999999`, which is 6 digits (`gearMarks.js:115`) | `round(base × 1e6)` in a 7-digit field (GU `:876`) | **L28**: every Armor Pierce line on a mirrored Hair Clip or Necklace comes back at 0.999999 |
| Welcome and titan box marks | `MARK.veteran = 'su:vet'` (`gearAwaken.js:85`) | `su:welcome` and `su:titanbox:<titan>`; "There is no separate `su:vet` mark" (GU `:560-584`, `:1026`) | L29 |
| `gbl:` on new-slot pieces | the code writes it (r3's rule), but the header says "NO legacy mark (… gbl …) ever names one" (`gearMarks.js:22-24`) | allowed (GU `:850-854`) | L29: fix the comment |
| A0, the accessory reader | not built; `cleanUnit` returns a fixed field list, so `accItem` is dropped; no `acw:` and no `acc_*` mirrors | "A0 … rides GU M0" (ACC `:48`, `:266`) | L29 |
| Set colours | Treasurer `#3fbf9f` (`gearSets.js`) | a test wants ΔE ≥ 15 against the club colours (GU `:347-349`); Bell is `#2bb8ad` (`clubs.js:26` on main): ΔE76 = **11.9** | L29 |

---

## 3. Findings

### MEDIUM

**F10 MEDIUM: G4's pass rule probably cannot be met on Blossom Normal, and nothing is allowed to fix it.**
- The spec rests "the band is within reach" on Nightmare figures, though G4 runs on Normal.
- The "weaker presets win 0" rule has no step it is allowed to take when it fails.
- The board already promises the owner that outcome.

Where: GU `:751`, `:780`, `:784-787`, `:792-797`, `:1078`; board `:45-48`; ACC `:194`.

*The figures are on the wrong difficulty.*
- GU `:784-787` takes its starting point from r5's bossCap reading: a fully maxed 33-girl board in three UR pieces
  kills about 1/8–1/14 of the Wyrm's HP "on the Nightmare runs it checked". The `d6f092b7` message says those were the
  Tempest and Crimson Moon Nightmare runs.
- G4 runs on **Blossom at Normal** (`:751`, `:775`). Normal has ×1.0 HP against Nightmare's ×1.75. Normal pays wave
  income, while Nightmare has `noIncome` and ×1.2 prices (`src/data/types.js:212-214` on r5). Blossom is the easiest tier
  at every boss wave (`src/data/freeplay.js:131` on r5).
- Arithmetic from those figures: the same three-UR board's K on Blossom Normal is **at least about 0.13–0.22**, before
  the richer economy and the lower tier, which raise it further.

*What this means for each rung of the ladder* (§8.2 and §4.7 ratios; estimates, not measurements):
- **`urLate5'`** (≈ ×2.9–3.1 over three UR pieces) sits at K ≈ 0.4–0.7 before the LR units and the economy.
- **The LR board** has two carries at ≥ 2.5× Kage, where Build A's carries are about 1×. That should lift K well past
  that range, toward or above the 0.8 line. So the LR board in `urLate5'`, and certainly in `lrSet5'` (≈ ×2.2 over
  `urLate5'`), may pass **K ≤ 0.8** or even win.
- **`lrBlank5'`** (≈ ×2.5 over `urLate5'`) may then win every run, far above the 6–18 band.

*Nothing on the knob list is allowed to fix a failing weaker preset.*
- Knob 2 changes only Blank LR and the super-crit multiplier (`:794`). Geometry's set cap uses the super-crit multiplier
  too, so it reaches `urLate5'` and `lrSet5'` only partly.
- Knob 1 (set numbers) is a pre-ship knob. M2's numbers are owned by M3, and G4's tool is an M3 tool (`:1040`).
- The LR rows and the five-piece base numbers are floors (no nerfs).
- The only escape in the spec is "after M3 ships … more than 18 of 24 → the owner decides" (`:796-797`). That covers
  neither a weaker preset that wins nor a failure found before M3.

*The rule is also checked in M2, where it is undefined.*
- M2's gates are "G1–G13" (`:1078`), so they include G4. But `wyrmGate.mjs` is an M3 tool, and in M2 only
  `gearGuard --build` exists ("UR gear never beats the Wyrm", `:1041`).
- So M2 can fail on the LR board in `urLate5'` with no step allowed to fix it.
- The board tells the owner "Full UR and set-LR teams should win none" (`board:47`). The owner never asked for that,
  and the code may not deliver it.

*The best board's three conditions can conflict.*
- They are 6–10 wins, a median K of 0.9–1.15, and losses' median HP left ≤ 30 %.
- K is measured with the Wyrm alone on the longest lane. A real wave 250 also brings the Ashwing finale (every 25 waves
  from 200, `freeplay.js:109`) and the wave itself. A 25–42 % win rate may therefore need a median K above 1.15.
- The spec does not say which condition wins.

*Fix (all short):*
1. **Measure before tuning.** At the start of M2, before the knobs move, record K on Blossom Normal and on Crimson Moon
   Normal / Nightmare: the best board in `urLate5'` and the LR board in `urLate5'`, a few seeds each (bossCap already
   does this). Correct `:784-787` to the matching difficulty.
2. **Fix the tier and difficulty from those readings, with the owner.** If `urLate5'` already sits near K 0.8 on
   Blossom Normal, G4 belongs on a harder tier or difficulty (the owner's words name only "the wave-250 Freeplay boss").
3. **Add an escape.** If a weaker preset wins, or passes K 0.8, and only a knob that lowers something players own (or
   will own by then) could fix it, the gate stops and the owner decides: move G4's tier or difficulty, raise the
   Wyrm's HP, or accept. Reword `board:47` as the target, with that fallback.
4. **Define G4 in M2.** Only the weaker-preset half applies, on `urLate5'` with the W and LR boards (through
   `gearGuard --build` or `wyrmGate.mjs`). Move the W and LR boards and that check into M2 (`:1039-1041`).
5. **State the precedence.** The win band is the gate. K and HP left are steering numbers, recorded and reported but
   never on their own a reason to fail. Make A-G2 inherit the same rule.

### LOW

**L27 LOW: G0's measure needs its tool named and its scope stated, and Tenka's two low builds are not on the board.**
Where: GU `:747`, `:722-727`; board `:77-81`; ACC `:176-178`.
- *The tool.* r5 already has `tools/balance/lrBench.mjs` (`d81df73a`). It runs `r5Bench`'s `measure` with `lr` on,
  over Umeko and Midori and seeds 9/1/2, and prints each LR build ÷ the best Kage T5 on `crowd` and `boss`. That is G0
  exactly. GU names only `r5Bench.mjs`, and `balance.js:89` on r5 cites `lrBench.mjs`. Name it, with
  `--bench r5`, and give it the gear-preset switch.
- *The scope.*
  - GU's G0 checks "her best tier-5 build on each ruler".
  - r5's own floor reading was "every build" (`docs/specs/DUO_LR.md` §7 on r5, the line under the table).
  - That reading excludes Tenka's **Joint Research (0.52 / 0.48) and Singularity (0.27 / 0.05)**, which DUO_LR leaves
    as "a question for the owner".
  - Board Q19 tells the owner "every LR unit … on both a boss and a crowd" with no such caveat.
  - Say which measure G0 uses: her best build, or every build. Then put Tenka's two builds on Q19, so that the owner's
    "LR floors" decision covers them.

**L28 LOW (M0 code): `gps:` truncates every substat base above 0.999999, so Armor Pierce lines come back wrong.**
Where: `src/systems/gearMarks.js:115` on M0, against GU `:876`.
- `wholePieceMarks` writes `Math.min(999999, Math.round(base × 1e6))`. The decoder reads `(n % 1e7) / 1e6`
  (`:137-138`), which is GU's 7-digit field.
- An Armor Pierce substat's base is `[1, 2] × (1 + (scale − 1) × 0.5)`, which is 1.9–3.8 at Legendary (`gear.js:70-73`,
  `:122-126` on M0). Every rarity is above 1.
- So a Hair Clip or Necklace that an older build dropped is rebuilt with its Armor Pierce line at about 1.0, silently.
- No player can own such a piece before M2, so nothing is lost yet.
- *Fix:* change the cap to `9999999`. Add a round-trip case with an Armor Pierce line to
  `tests/systems/gearUpdateSave.test.js`, before M0 merges.

**L29 LOW: other places where M0 and r3 disagree** (§2's table).
1. **`su:vet`.**
   - The problem: `gearAwaken.js:85` on M0 defines `MARK.veteran = 'su:vet'`, while GU §5.3 and §12 want `su:welcome`
     and `su:titanbox:<titan>`, and no `su:vet`. Nothing reads it yet.
   - The fix: replace it in M0, or have M2 replace it before anything writes it.
2. **The `gbl:` comment.**
   - The problem: `gearMarks.js:22-24` on M0 lists `gbl` among the marks that never name a new-slot piece, but the code
     writes it (`gear.js:635-639`), which r3 requires.
   - The fix: correct the comment, so that M2 does not "fix" the code to match it.
3. **A0.**
   - The problem: ACC says A0 "rides GU M0" (`:48`, `:266`), but M0 has no `accItem`, no `acw:` and no `acc_*` mirrors,
     and its `cleanUnit` drops unknown unit fields. An A1 export at `version: 3` is accepted by M0, which drops the
     accessory until the mirrors bring it back. The counters survive, so nothing is lost for good, but GU §9.4's
     promise does not cover the accessories.
   - The fix: add A0 to M0 before M0 ships, or give A0 its own reader-first release a week before A1, and say so in ACC
     §11.
4. **The Treasurer colour.**
   - The problem: `#3fbf9f` is ΔE76 11.9 from Bell's `#2bb8ad`, so GU's planned colour test (`:347-349`) would fail.
     Every other pair among the six set colours, the six club colours and the Nightglass navy `#0e1930` is ≥ 15.
   - The fix: pick a mint or silver nearer the "silver, mint" brief and further from teal, in M0's `gearSets.js`.

**L30 LOW: small items.**
- *`CASH_MAX` coverage.*
  - The problem: GU says "any cash, any board" (`:292`), but `_gainCashFor` (`Sim.js:488-496`: lab income and econ
    abilities) and the co-op wallets (`commands.js:225-234`) bypass `_gainCash`. Growth is linear once interest has its
    ceiling, so this is harmless. Still, the 2,000-wave test (`:1062`) never reaches `CASH_MAX`.
  - The fix: name `_gainCashFor` too, and add a case that starts within one wave of `CASH_MAX`.
- *The stripped specs.*
  - The problem: Finale Pop's spread of `tower.eff` (`towers.js:2251`) does not set `procStatus`. That is safe today,
    because `eff` does not carry it. But a builder who builds `burstSpec` from the attack's own spec would bring
    `procStatus` along (`Sim.js:626`). Tenka's rail hits (ACC §3.2) likewise have no stated spec. Her Weighted Bolts
    slow has no chance, so nothing draws today, but the rule should not depend on that.
  - The fix: say `procStatus: null` for the burst. Say the rail hit uses the same stripped spec, plus the R4 slow.
- *capBot's hero.*
  - The problem: `HERO = 'hikari'` is fixed (`capBot.mjs:71`), but board W's hero is Luna (GU `:766`).
  - The fix: put the hero option in §12's capBot row.
- *Wording.*
  - The problem: in GU `:1006`, "A card that would pass it drops the substats" means "exceed". Also, `validCard` is the
    validator, so the dropping belongs in the card builder (`cardGear` / `buildCard`).
  - The fix: reword it, and move the dropping to the builder.
- *Rounding.*
  - The problem: R5 "at most 28" weeks (ACC `:166`, board `:114`) is 48,000 ÷ 1,700 = 28.2.
  - The fix: write "29".

---

## 4. Names and content

- I searched the three specs and the board, ignoring case, for other games' and anime names, and for swimwear, gore and
  suggestive words. There are no hits.
- The r3 commit message names no other game.
- "Total Assault" and "Limit Break" are existing game terms (`stages.js`, `limitBreak.js`). These specs do not
  introduce them.
- Every new design is an everyday school or tech object: lockets, clips, radios, goggles, a notebook, a visor.
- Bond and Sensei content is untouched. Nothing frames a student or an adult hero around her body.
- No player name appears, and players are "they".

---

## 5. Verdict

**NOT OK.** There is no BLOCKER or HIGH finding.
- F10 is MEDIUM. It must be fixed, then re-reviewed by a fresh reviewer.
- F10's tier and difficulty choice, and the escape it needs, can instead be decided by the owner on the board.
- M0, M1 and the Build Coach do not depend on F10, and building them can go on. L28 should be fixed before M0 merges.
- The LOW findings can ride along with the F10 fix.

| # | Severity | Finding |
|---|---|---|
| F10 | MEDIUM | G4's "within reach" rests on Nightmare figures, but the gate runs on Blossom Normal, where `urLate5'` and the LR boards probably pass K 0.8 or win. The "weaker presets win 0" rule has no step it is allowed to take and no escape to the owner, and it is also checked in M2 with only `gearGuard`. The best board's K and win conditions can conflict. The board promises the owner "UR and set-LR win none" |
| L27 | LOW | G0: name r5's `lrBench.mjs` (it is G0 exactly); say whether the floor covers her best build or every build; Tenka's Joint Research and Singularity builds (0.05–0.52×) are not on Q19 |
| L28 | LOW | M0 `gps:` clamps a substat base at 0.999999 (`gearMarks.js:115`), so every Armor Pierce line on a mirrored new-slot piece comes back at about 1.0 |
| L29 | LOW | M0 against r3: `su:vet` against `su:welcome` / `su:titanbox:`; the `gbl:` comment contradicts the code and r3; A0 is not in M0; Treasurer's colour is ΔE 11.9 from Bell's |
| L30 | LOW | `CASH_MAX` misses `_gainCashFor` and the wallets, and the cash test never reaches it; burst and rail specs should null `procStatus` and strip statuses; capBot's hero is fixed to Hikari; "would pass it" wording; "28" weeks is 28.2 |
