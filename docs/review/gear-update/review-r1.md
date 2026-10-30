# Gear update spec: independent review, round 1

Reviewer: an agent that did not write the spec (review gate, HANDOFF §6).
Reviewed: `spec/gear-update` at `7b93dfc3`, which holds `docs/specs/GEAR_UPDATE.md` and `docs/review/gear-update/OWNER_BOARD.md`.
Checked against `main` `60ce9cad` (v0.1.61, `COOP_PROTOCOL` 13, sim id `be940ecb2087`, which equals `KNOWN[13]` in
`tests/art/itemArtRuntime.test.js:200`) and against `feature/balance-r5` `83b72083`. Line numbers refer to those trees.
"Spec" means `GEAR_UPDATE.md`; "board" means `OWNER_BOARD.md`.

Where a file name appears without its folder, it lives here:

| Folder | Files |
|---|---|
| `src/systems/` | `gear.js`, `gearMarks.js`, `save.js`, `progression.js`, `titanRewards.js`, `friendSupport.js`, `craft.js`, `salvage.js`, `achievementMetrics.js` |
| `src/data/` | `gearStats.js`, `gearAwaken.js`, `items.js`, `missions.js`, `clubs.js` |
| `src/sim/` | `status.js`, `buffs.js`, `drinks.js`, `constants.js`, `Sim.js`, `towers.js`, `gearRules.js`, `vines.js`, `zones.js`, `barricades.js`, `lab.js` |
| `src/online/coop/` | `statLimits.js`, `loadout.js` |
| `src/online/` | `profileCard.js`, `profileRules.js`, `supportRules.js` |
| `src/core/` | `store.js` |
| `src/ui/online/` | `settingsOnline.js` |
| `src/ui/` | `gearUr.js`, `gearView.js` |

There are two `titans.js` files. Each mention below gives its folder.

**Verdict: NOT OK.** There are no BLOCKER or HIGH findings, but there are 7 MEDIUM and 13 LOW findings. The design meets
every owner request, and its headline numbers re-derive. The MEDIUM findings are gaps in mechanisms and in the plan
that a builder would run into. §3 gives the full verdict.

---

## 1. What checks out

**Owner requirements.** The spec covers every Oct 30 request and every decision in HANDOFF §4:
- five-piece sets (D1, §3.1);
- six sets with 30 original piece designs (§3.2–3.3);
- LR gear that is a clear step above UR (§4): numbers ×1.25, max +18, a third ✦, cap raises (aura most, crit least)
  and LR Set Forms;
- pre-loaded Set Boxes (§5);
- pins for a main stat and for a substat (§6). The board's Q10 also offers the reading "one pin that does both";
- teams and loadouts per girl (§7, Q7);
- clubs on any of the five pieces, counted across all five (§3.5);
- the four support main stats (§2.3–2.4);
- tuning on top of balance round 5, with no nerfs (§8.3).

**Code citations.** I spot-checked about 60 `file:line` references, and they point at what the spec says. The only
drift is small: the clamp rows sit at `statLimits.js:30-60`, and §4.3 lists `PIERCE_K_MAX` (`gearRules.js:18`) and
`SKILL_HASTE_CAP` (`:80`) the other way round. These all match:

| What | Where |
|---|---|
| `BATTLE_CAPS` | `gearStats.js:48` |
| Rarity scales | `gear.js:29`, `gearAwaken.js:5` |
| Main stat ×1.2, +6 % a level | `gear.js:32-34` |
| ▲ every 3 levels to the least-grown line | `gear.js:555-588` |
| Victory Chest box odds | `titanRewards.js:56-72` |
| First clears | `titanRewards.js:76-85` |
| The four titans | `src/data/titans.js:40-75` |
| `lock_pin` and `gearbox_rainbow` | `items.js:230`, `items.js:218` |
| 12 weekly keys | `src/systems/titans.js:30` |
| Weekly missions | `missions.js:25` |
| The UI files of §11 | all exist |
| r5's bench preset ("three UR +12 Taiko pieces at average rolls") | `tools/balance/r5Bench.mjs:7` |

**Numbers I re-derived.** I built my own scratch model from the live roll formulas:
- the rarity scale, main stat ×1.2 and +6 % a level;
- ▲ every 3 levels to the least-grown line, and half a mid roll per ▲ or ✦;
- ✦ placed greedily, with the caps and Every Line Counts (M = 0.12) applied;
- GA §7's proxy `(1 + ATK + fill) × (1 + Speed) × (1 + CR × (1.5 × (1 + CD) − 1))`.

The proxy gives exactly GA §7.1's ×3.1 and ×5.5. Each row below uses 1,200 samples.

| Claim | Spec | Mine |
|---|---:|---:|
| Five pieces over three, one average gold +10 piece per slot | ×1.93 | ×2.08 |
| … best of 10 gold +10 | ×2.34 | ×2.50 |
| … best of 10 UR +12 with ✦✦ | ×2.29 | ×2.31 |
| One LR piece over five UR (best of 10 / average rolls) | ×1.20 | ×1.22 / ×1.26 |
| Three LR pieces | ×1.64 | ×1.61 |
| Five LR pieces (scale 4.0, caps raised) | ×2.18 | ×2.14 (×1.76 without the cap raises) |
| Legendary +10 Aura Radius main, average / max | 16.1 / 21.5 % | 16.1 / 21.5 % |
| Buff Duration or Control Strength main, average / max | 26.9 / 37.6 % | 26.9 / 37.6 % |
| UR +12 / LR +18 main over Legendary +10 | ×1.23 / ×1.86 | ×1.229 / ×1.857 |
| The §4.2 line table (20 cells) | | every cell matches to 0.1 % |
| Prices from +13 to +18 | 39,200 … 53,200; 277,200 in all | the same (`gear.js:516`, tier 6 gives ×7) |
| Big Cheer partner values | ×1.03 / 1.05 / 1.09, and ×1.04 / 1.07 / 1.13 with 40 % Buff Duration | the same (uptime × bonus) |
| Coupon collector over five slots; Legendary pieces a week at Mayhem | 11.4 / p; 5.4 | the same |

My five-piece numbers run 1–7 % above the spec's. That is still inside the spec's "≈ ×2", so the headlines hold.

**Sim, co-op and milestones.** `tools/simId.mjs` hashes `src/sim`, the co-op files and everything they import:
- **Hashed:** `statLimits.js` and `stages.js`.
- **Not hashed:** `gearStats.js`, `gearAwaken.js`, `gear.js`, `progression.js`, `rewards.js` and `titanRewards.js`.

Gear reaches the battle only as numbers in the loadout (`loadout.js:16-23`). The owner's own client computes them, and
the partner never recomputes them. Both peers clamp the same start message (`statLimits.js:1-10`). So §10.1 is right
about each milestone:

| Milestone | Sim id | Why |
|---|---|---|
| M0, M1 and the pins | unchanged | pinned values stay under GA's best-roll honest maxima |
| M2 | changes, needs a `COOP_PROTOCOL` bump | new `DEFAULT_UNIT_STATS` keys, the set passives, wider clamp rows |
| M3 | changes, needs a `COOP_PROTOCOL` bump | guard caps, LR Set Forms, clamp rows |

The new determinism rules are sound, apart from L6: integer step counters, no new crit draw, and maps built in placement
order.

**Save plan.** The plan is sound in shape:
- It is additive and keeps `SAVE_VERSION` at 2. A bump would wipe the save in an older build (`save.js:720`).
- It leaves `types.js` untouched.
- The reader ships first, at least a week before M2.
- The whole-piece mirror encodings fit in safe integers.
- `missions.counters` has no key cap (`save.js:359`).

An older build drops a new-slot piece whole (`save.js:271`) but keeps the counters word for word, so a whole-piece
mirror is the right design. F5 lists the holes in it.

**Names and content.** I ran a case-insensitive grep over `src`, `docs`, `tests`, `tools`, `e2e` and `CONTRACTS.md`. No
new item, mode, passive or set name clashes with an existing one (details in L12). The spec, the board and the commit
message name no other game or anime. Every design is an everyday school accessory, and nothing sexualises a student.

---

## 2. Findings

### MEDIUM

**F1 MEDIUM: five pieces do not multiply every girl alike, so G1 is likely to fail, and the spec has no plan for that.**
Spec `:589-592` and `:598`; board `:43-46`.

§8.3 says "Gear multiplies every girl, so r5's band should hold in ratio". The code disagrees for three groups of
girls:
- **Burns and poisons.** They take gear ATK only through `dotMul = min(1.25, 1 + 0.5 × gear ATK)`
  (`progression.js:461`, `:502`). Three average gold pieces already bring gear ATK close to 50 % (my model: 44 % plus
  fill). So the DoT part of a girl's damage gains about ×1.00 from five pieces.
- **Kits that cannot crit.** Suzu (`gearStats.js:135`) and the support rows turn their crit lines into ATK, under the
  12 % soft limit (`gearStats.js:53`). In my model such a kit gains ×1.46 from five pieces, while a crit carry gains
  ×2.08.
- **Crit carries gain the most**, because crit rate × crit DMG is bilinear and both grow.

So a girl whose ruler leans on DoT, or who cannot crit, falls about 30 % against Kage. That is three times G1's ±10 %.

The only fix the spec allows is to "raise her (her set fit, or her r5 row up)". In practice that means a round of r5
row raises inside M2. r5's rows move the sim id, and M2's estimate of 2–3 weeks does not budget for that round. The next
bullet also contradicts the fix: "Knobs act only on new gear numbers … never on girls, r5's rows".

*Fix:*
1. Say up front which girls G1 is expected to move.
2. Pick the lever, starting on the gear side: for example, raise `GEAR_DOT_CAP` with the five-piece totals, raise the
   fill soft limit at five pieces, or give those kits a fitting set.
3. Then add an explicit raise-only pass over r5's rows to M2's scope and estimate.
4. Reword the knobs bullet.
5. Tell the owner on Q5 that some girls will be raised so that they stay close to Kage.

**F2 MEDIUM: You're It and Control Strength do not map onto `status.js` as written.** Spec `:160`, `:267`, `:681`.

*You're It.* An enemy holds one status per type (`status.js:67-71`). When a status refreshes, `sourceUid` moves only if
the new status has a stronger `amount`, `dps`, `bonus` or `pct` (`status.js:96-104`). Freeze, stun, shock, ground and
hold carry none of these, so:
- the first girl to freeze an enemy keeps the uid;
- every later freeze only extends `left` (`:105-106`).

The spec's test, "a control status whose `sourceUid` is a You're It girl", therefore means "whoever froze it first". It
does not mean "an enemy under her control". With two controllers on the board, which is the Freeze Tag use case, the
passive either rarely fires or fires on another girl's freezes.

*Control Strength.* The spec puts it at one site, `applyStatus`. For that, `applyStatus` needs her multiplier in `ctx`.
But `applyStatus` is a pure function, and 24 callers in 10 sim files each build their own `ctx`. They include:
- Chigusa's holds (`vines.js:56`);
- zone slows (`zones.js:279`);
- barricade slows (`barricades.js:415-417`);
- lab slows (`lab.js:176`).

None of these files is on §10.1's list of M2 files.

*Fix:*
- Record You're It on the enemy whenever her control status is applied or refreshed: a bonus and a timer, where the
  strongest wins. Add an enemy snapshot key and a split-run case for it.
- Pass `controlMul` and her uid through `ctx` at every call site that applies control.
- List those files in §10.1 and §12.

**F3 MEDIUM: Buff Duration does nothing for two of the girls it names, but the fit test would still call it real.**
Spec `:159` and `:162-166`.
- **Midori's brews are continuous.** She re-brews every 6 s and a brew lasts 6.5 s (`constants.js:179-181`,
  `buffs.js:98`, `:117`). A longer brew changes nothing once she is brewing.
- **Wakaba's drinks count shots, not seconds** (`drinks.js:45`, `:56`, `:76`). "× buffDurMul" on a shot count needs a
  rounding rule.
- **Chika's overclock is periodic** (`buffs.js:179-197`), so Buff Duration works for her.

As written, the data test "derives the Buff Duration row from her timed buffs". That marks the stat real for Midori and
Wakaba. Their Buff Duration lines would then neither work nor fill in. That breaks Every Line Counts and the owner's
"never promise what is not there". Control Strength needs the same check for aura and zone slows.

*Fix:*
- Define Buff Duration per kind of buff. It applies only to buffs that have gaps: rallies, hero skills, overclock and
  Big Cheer. For brews, decide whether it changes the cadence or does nothing.
- For drinks, use `floor(shots × buffDurMul)`.
- Derive the fit row from "a timed buff with gaps", so that Midori's Buff Duration fills in.

**F4 MEDIUM: the card's SQL change points at a superseded function, and the spec never mentions Friend Support.**
Spec `:747`.

§11 says "gear entries ≤ 5 (today ≤ 4, `supabase/migrations/20261020000000_profile_gear.sql:57`)". That function is no
longer the live rule. The live rule is `valid_card_unit` in `20261028000000_friend_support.sql:130-160`:
- it allows at most 4 gear entries (`:144`);
- it rejects unknown gear keys, such as `t`;
- both `valid_profile_card` (`:166`) and `set_support` (`:276-286`, "that Support Student is not valid") call it.

The lent Support Student is the same card entry (`friendSupport.js:69-72`). The borrower's own client rebuilds her
stats from that entry (`friendSupport.js:94-118` → `profileCard.js:244-262`, which knows three slots at `:246`).

Suppose the migration patches the old profile_gear-era function. Then `valid_card_unit` stays at 4 entries. Once
`CARD_FIVE_PIECES` flips, the server refuses the Support Student of every lender whose girl wears a Hair Clip or
Necklace.

The card also:
- has no LR marker: it writes only `r: 'ur'` (`profileCard.js:59`), and viewers cap values at UR ceilings;
- drops the third ✦ (`& 3`, `:61`).

*Fix:*
- Name `valid_card_unit` and `set_support` in §11 and §12, together with `profileRules.js`, `supportRules.js` and
  `tests/online/supportSchema.test.js`.
- Define an LR marker for the card (for example `r: 'lr'`) and the LR ceilings a viewer applies.
- Say whether a borrowed girl keeps her set passive (the card then needs `t`) and her LR Set Form.

**F5 MEDIUM: an older build that loads a post-M2 save pays refunds for pieces it cannot see, and loses refunds it does
not know about.** Spec `:632-644` and `:663-668`.

*How it happens.* A player redeems a transfer code in a tab that still runs a pre-M0 build. The code goes through
`settingsOnline.js:165`, `store.js:357-360` (`importSave`) and `deserializeProfile` (`save.js:798`) into that old
build's `migrateProfile`. With two devices
the player can repeat this as often as they like. So §9.4's claim "the mirrors make it safe either way" does not hold.

*Free Seeds and Needles.*
- `writeGearMarks` writes `gur:` and `gtn:` for every piece, whatever its slot (`gearMarks.js:87-93`). The Rainbow Gear
  Box also writes `gbx:` (`gear.js:357`).
- The old build drops a Hair Clip or Necklace whole (`save.js:271`). It then reads those marks as "salvaged by an older
  build" and pays out:
  - for `gbx:`: a Seed, and it zeroes the mark (`gearMarks.js:143-146`);
  - for `gur:`: a Seed, coins and Needles (`:150-164`);
  - for `gtn:`: Needles (`:180`).
- The new build then rebuilds the piece from `gph:` and `gps:`, so the player keeps the refunds and the piece.

*Free Needles from the Nightglass ✦.* The spec stores the Nightglass ✦ as bit 4 of `tuned`. In an old build `int`
clamps that to 3, which reads as gold + rainbow (`save.js:265`). The old step 6 then strips the "second" gold ✦ and the
"second" rainbow ✦, and pays a Needle for each (`gearMarks.js:224-226`). Afterwards `gtx:` restores the Nightglass ✦.

*Lost refunds.* §9.2 has no "piece gone" rows for `glr:`, `gtx:` or `gtp:`. GA solved the same case for `gur:` in step
2 (`gearMarks.js:148-164`). Without these rows, when an older build salvages an LR or pinned piece, the player loses:
- the Lens;
- half of the coins paid from +13 to +18;
- the Nightglass Needle;
- the pins.

*Fix:*
1. Never write `gur:`, `gtn:` or `gbx:` for a new-slot piece. Keep its UR, ✦ and box state in `gph:` and `gps:` only.
2. Keep the Nightglass ✦ out of `tuned`, in a field of its own mirrored by `gtx:`, so that no build ever reads `tuned`
   above 3.
3. Add the "piece gone" refund rows.
4. Make M0's salvage, reroll and enhance aware of LR and pins, as GA's R1 was (GA §8.4).

**F6 MEDIUM: the board leaves out the decision that invested players will feel most: today's gear never joins a set.**
Board Q0–Q14; spec `:41`, `:176-177`, `:189-190`.

Every piece a player owns today becomes No set, and membership is fixed: no item moves a piece into a set. A full set
therefore means replacing their UR Charm, Ribbon and Shoes with new set pieces; a 4 + 1 mix keeps only one of them.
This is the owner's call, and there are real alternatives:
- a one-time way to tag today's Legendary and UR pieces into a titan set;
- a set "Armband" item;
- or keep them as No set (the spec's default).

*Fix:* add this to the board as a question, with the default and these options.

**F7 MEDIUM: veteran players miss the new first-clear and welcome rewards.** Spec `:306`, `:439`, `:441`.

The new boxes come from one-time events:
- each titan's Nightmare first clear gives a Legendary Set Box;
- "the day Titan Trials open" gives a Mythic Set Box.

First clears pay once per titan per step (`titanRewards.js:76`; the `tfc:` marks, `src/systems/titans.js:9`, `:244`). So a player
who cleared Nightmare on all four titans before M2 gets none of the four Legendary sets that a newer player gets. That
player is in the most invested group. Nothing in the spec grants these boxes after the fact.

*Fix:* on M2's first load, grant once (recorded with a counters mark):
- one Legendary Set Box for each titan whose `tfc:<titan>:<Nightmare step>` mark is already set;
- the welcome Mythic Set Box to every save past 3-5.

Say so on Q9.

### LOW

**L1 LOW: §10.2 misses the `rainbow` row.** Spec `:694-711`.
`statLimits.js:50` has `rainbow: int(0, 3)`. But `progression.js:505` sends `rainbow: set.ur`, which counts every UR
piece worn (`gear.js:816`). Five UR pieces therefore send `rainbow: 5`, and G10's clamp-identity test fails. The value
is display-only.
*Fix:* widen the row to 0–5 in M2, or cap the value at its source. Also say what the renderer shows for 4–5 pieces.
Resonance itself stops at 3 (`gear.js:817`).

**L2 LOW: the new shape of `gearSetInfo` breaks two readers.** Spec `:285-288`.
- Today `gearSetInfo` returns `clubs` as an object (`gear.js:808-818`). `gearUr.js:165` and `gearView.js:157` run
  `Object.entries(set.clubs)` and sort by `[1]`. On an array of `{ id, n }` that sort goes silently wrong.
- `club` and `clubN` also change meaning, from "the largest club with 2+ pieces" to "the trick club, 3+ pieces". So the
  2-piece club disappears from anything that reads `club` for display.

*Fix:* name these readers in the spec, or give the new list a field of its own.

**L3 LOW: the list of slot readers misses two files and includes three that read no slots.** Spec `:123-126`.
- Missing: `src/ui/battle/results.js:53` and `src/ui/gearSummary.js:46` both read `GEAR_SLOTS`.
- Not slot readers: `craft.js`, `salvage.js` and `achievementMetrics.js` read none.

The planned grep test will catch this, but the list should be correct.

**L4 LOW: two sets' own 2-piece stats overflow their caps on the natural build.** Spec `:135-137` and `:200-201`.
- Aura Radius caps at 20 %, but a UR +12 Aura Radius main already averages 19.8 % (0.03 × 3.2 × 1.2 × 1.72). Most of
  Spirit Squad's +8 % therefore becomes fill-in.
- Control Strength caps at 40 %. A UR main averages 33.0 %, and Freeze Tag adds 10 %.

*Fix:* consider caps of 25–30 % (Aura Radius) and 45 % (Control Strength), or different 2-piece stats. The §8 tuning
should know about the overflow either way.

**L5 LOW: Right Angle's 5-piece and LR numbers can be read two ways.** Spec `:202`, `:268`, `:298`.
"Sure crits deal +20 % more" means two different things in the spec:
- §3.4 says "× the 5-piece bonus", which is ×1.2 on the hit. At 75 % crit and the 200 % crit DMG cap, that gives ×1.06
  over four pieces.
- §3.5 models ×1.03–1.04, which matches "+20 % crit DMG on sure crits".

*Fix:* pick one.

**L6 LOW: Confetti Burst should not crit.** Spec `:269`, `:717-720`.
Every hit with `critChance > 0` draws from `sim.rng` (`Sim.js:575`). A burst built from her spec would add draws, which
goes against §10.3.
*Fix:* give `burstSpec` `critChance: 0`, as Finale Pop has (`towers.js:2252`).

**L7 LOW: moving the Aura Power cap needs a fill threshold of its own.** Spec `:148-151`, `:759`.
"The part above 15 % keeps filling in" only works if `gearFillIn` takes Aura Power's over-cap part from 0.15 while
`BATTLE_CAPS.auraPct` is 0.25. Today `gear.js:886-888` uses `BATTLE_CAPS`. Without the separate threshold, Umeko and
Miko lose the aura radius they get from fill (`progression.js:501`), and G3 fails.
*Fix:* name the constant in §12.

**L8 LOW: salvaging an LR piece refunds too many coins.** Spec `:343`.
`enhanceInvested` prices every level from +10 up at the piece's current tier (`gear.js:537-542`). An LR piece paid UR
prices for +11 and +12, but salvage would refund them at the LR tier, about 5,000 coins too many.
*Fix:* keep the rule that a refund never exceeds what was spent.

**L9 LOW: which sets can a Set Box offer?** Spec `:427`, `:444-449`, `:245-247`.
The spec points both ways:
- "Farming stays the way to … the two other non-titan sets" implies the choose-boxes offer only the four titan sets.
- The `setbox_pick` art has "all six set colours".
- Six `setbox_<set>` icons are ordered, though only the titan sets have boxes of their own.

*Fix:* say which sets a choose-box offers.

**L10 LOW: two small data gaps.**
- Spec `:760` says "`MIRRORED_ITEMS` + 6". §5 and §9.2 add more new ids than that: 2 choose-boxes, up to 12 set boxes,
  and `tie_pin`, `collar_pin` and `lens_nightglass`.
- Spec `:306`: the Normal-tier chest also rolls a Super Rare box 30 % of the time (`titanRewards.js:60`). The spec does
  not say whether that box gives a set piece.

**L11 LOW: after an older build, teams and loadouts need a rule for which side wins.** Spec `:540-545`, `:529`.
- An older build can change `profile.formation` and `unit.gear` while it drops `teams` and `presets`. On the next load
  the `tm:` and `gp:` mirrors disagree with those fields. Say that the present fields win for the active team and the
  active loadout.
- A piece named only by an inactive loadout is not equipped. Salvage and multi-salvage therefore take it without a
  warning. Warn the player, or skip such pieces.

**L12 LOW: wording and names.**
- The spec says "bonuses do not scale with rarity … a free player's Mythic set plays the same game as a whale's LR set"
  (`:178-180`), but LR Set Forms do scale (`:391-395`).
- The name check (`:250-252`) says "Hair Clip" has no hits. It does appear in notes on looks: Fuu's leaf clip
  (`tools/blender/lib/accessory.py:96`) and a comet clip (`docs/specs/UNIT_GAPS.md:563`). Neither is a real clash.
- Three Necklaces are named "… Pendant" (spec `:234-239`), while older charms keep their "… Pendant" names
  (`gear.js:43`; spec `:107-109`). Also, the Necklace "Crosshair Lens" sits beside the "Nightglass Lens" item. Consider "… Locket" for the
  Necklaces and another word than "Lens" for one of the two.

**L13 LOW: two things missing from the board.**
- M2 needs the owner to paste one SQL file, for the card and the Support Student (F4). Say so on Q14 (`:94-97`).
- Q5 (`:43-46`) should say that some girls will be raised so that they stay close to Kage (F1).

---

## 3. Verdict

**NOT OK.** Findings F1–F7 are MEDIUM and must be fixed, then re-reviewed. F6 and F7 are board questions, so they can
instead be accepted explicitly by the owner. The LOW findings can ride along with those fixes.

| # | Severity | Finding |
|---|---|---|
| F1 | MEDIUM | Five pieces do not multiply every girl alike; G1 (±10 % of r5's ratio to Kage) will likely fail for DoT and no-crit kits, and the plan has no lever or budget for it |
| F2 | MEDIUM | You're It reads `sourceUid`, which follows the first applier, not "her" control; Control Strength's "one site" needs `ctx` at 24 call sites the file list omits |
| F3 | MEDIUM | Buff Duration does nothing for Midori's continuous brews and is undefined for Wakaba's shot-counted drinks, yet the fit test would mark it real |
| F4 | MEDIUM | The card SQL targets a superseded function; Friend Support's `valid_card_unit` / `set_support`, the borrower's rebuild and the LR card marker are missing |
| F5 | MEDIUM | An older build that loads a post-M2 save (transfer code) mints Seeds and Needles through the legacy marks and the `tuned` clamp, and loses LR and pin refunds on salvage |
| F6 | MEDIUM | The board omits "today's pieces are No set for good" |
| F7 | MEDIUM | No retroactive grant of the first-clear Legendary Set Boxes and the welcome box for veteran players |
| L1–L13 | LOW | See §2 |
