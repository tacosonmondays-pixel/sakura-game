# Gear M2 (5-piece sets): re-review r3

- Branch: `origin/feature/gear-sets`, delta `d501c0b9..9d94b3c5` (it also merges M0's `8e8aeae1`)
- r2 review: `origin/review/gear-sets-r2` (`391afd13`, `docs/review/gear-m2/review-r2.md`)
- Reviewer: a fresh agent that built none of this

## Verdict: **OK**

N1 is fixed the way the spec says: each lab joiner brings her own interest cap. The save, the restore and the co-op
digest all carry the new state deterministically. The LOWs R1–R4 are done, and R5 is now written into CONTRACTS as a
shipping-order rule. I found no new blocking issue.

## r2 findings

| # | Status | Evidence |
|---|---|---|
| N1 the lab's lifted interest cap read Tenka's set | **Fixed** | At join, `absorbInto` pushes `interestCapOf(o)` for the joiner `o` (`src/sim/lab.js:159`, defined at `:267`). The cap sits beside her rate, in the same order. `labIncome` uses `caps?.[i] ?? INCOME_INTEREST_MAX` (`:256-258`). Tenka's own set is no longer read. Tested at `tests/sim/tenkaLab.test.js:488`: Momo in Treasurer 5 is paid at `INCOME_INTEREST_SET_MAX`, and Tenka in Treasurer 5 lifts nobody. This matches GEAR_UPDATE §3.2 / §10.2 ("5,000 a girl … her interest"). |
| R1 lifted interest had no `cash` event | **Fixed** | `src/sim/Sim.js:973-975` emits `cash` / `income` for the credited `more`, only when it is > 0. Only the render, the audio and the mode feed read `cash` events (Momo's `onCash` fountain, `audio/battle.js:162`). No sim state reads them. `stats.cashEarned` was already counted in `_gainCashFor`, so nothing is counted twice. |
| R2 Set Box picker ignored `setIdle` | **Fixed** | `src/ui/gearUr.js:572-574` shows "For <girl>: <reason>" (`data-testid="set-box-idle"`) for the girl the picker fills for (`:557`). |
| R3 pin `setIdle`'s behavior to the sim's | **Fixed** | `tests/systems/gearSets.test.js:312`: every tower girl, path and tier (more than 200 steps checked) gets the same `SET_ATTACK_BEHAVIORS` answer from `def.base.behavior` and from `t.eff.behavior`. |
| R4 stale `cheersOn` comment | **Fixed** | `src/sim/buffs.js:297` now points to `applyRallies` (`:340-360`), which really multiplies by the strongest cheer. |
| R5 the boxes paid by mail need M0 first | **Noted** | `CONTRACTS.md:812-814` says M0 ships with or before M2, in the same release. This branch already merges M0, so shipping M2 ships M0. |

## Determinism checks

- **New state.** `emptyLab()` has `interestCap: []`. The only writer is `absorbInto` (`||= []` also covers a lab from
  before this field). No code anywhere removes from `interest` or `interestCap`, so the two arrays stay aligned.
- **Battle save** (`src/ui/battle/snapshot.js:376-380`, `:405-412`). `lb[6]` is written only when some cap is lifted, so
  a default lab's row is byte-for-byte what it was. On unpack, each cap stays next to its rate, even when a bad rate is
  dropped. Anything other than exactly `INCOME_INTEREST_SET_MAX` reads as the default, so a hand-edited save cannot raise
  a cap. Tested at `tests/battle-ui/snapshot.test.js:1364`: the save round-trips `toEqual` and a `1e9` cap is rejected.
- **Co-op digest** (`src/online/coop/simHash.js:80-82`). Caps are hashed only when one is lifted, so a lab with no
  Treasurer joiner keeps its old digest.
- **Co-op checkpoint.** The full-state snapshot (`src/sim/snapshot.js`) serializes the lab object as it is. That is why
  `ckDigest` in `tests/online/engines.test.js:269` moved (`3929c173` → `b205dccd`): the new `interestCap: []` key appears
  in the JSON. The final digest, wallets, `labCash` and hashes are unchanged, and the restored checkpoint replays to the
  same final state in that test (`expect(r.ckSame).toBe(true)`, `engines.test.js:261`). An older checkpoint without the key falls back to the default cap.
- **No one without Treasurer changed.** `interestCapOf` returns `INCOME_INTEREST_MAX` unless the girl herself wears
  Treasurer at 5 pieces, which is the old cap in every case except "Tenka in Treasurer 5". Only that case changes, and
  it is the bug being fixed. The engines fixture's `wallets`, `labCash` and `final` did not move.
- **Sim id.** `tools/simId.mjs` gives `9c9284d51061`, which equals `PENDING_BUMP[13]` (`tests/art/itemArtRuntime.test.js:211`).
  `COOP_PROTOCOL` is still 13 (`src/online/coop/version.js:72`, untouched in this delta). That is correct while M2 is
  unshipped: the release assigns the bump and removes the pin.

## Tests on `9d94b3c5`

- Full `npm test`: **393 files passed, 2 skipped; 6,233 tests passed, 11 skipped; 0 failed** (548 s).
- `node e2e/smoke.mjs` (all 3 viewports): **677 ok, 1 FAIL**. The FAIL was the top-bar hit test on `student aoi info`
  at 1280×720 ("back/settings/home covered by body.ui-day"). I re-ran that viewport alone twice: run 1 gave **226 ok, 0
  FAIL**; run 2 gave 225 ok and the same check failed on a different screen (`wiki`). The failure moves between screens,
  the point hits `<body>` mid-transition, and this delta touches no top bar or router code, so I count it as a timing
  flake. It is not a regression.
- M0's save loader was also fuzzed with 25,057 mutated loads and gave 0 losses (see `docs/review/gear-m0/review-r3.md`).

## New findings (non-blocking)

- **S1 LOW, no test for the Set Box idle line.** No test or e2e looks for `set-box-idle` (`gearUr.js:574`). Fix: one
  e2e or DOM assertion that opens a Treasurer box for a girl with no income and expects the line.
- **S2 LOW, cosmetic.** The idle line reuses `.gk-set-idle` (`src/ui/styles/girl.css:364`, line-height 1). That class
  was made for a one-line chip, but in the Set Box modal the sentence can wrap at 844×390, and wrapped lines would sit
  tight. Fix: give `p.gk-set-idle` a normal line-height. I did not take a screenshot.
- **S3 LOW, display.** With a lifted interest, one wave clear now raises two `income` coin fountains on the same girl
  (`Sim.js:971` and `:974`). That is harmless, but a single event carrying `amount + more` would read cleaner. It is display only, but
  `Sim.js` is a hashed file, so make this change only together with another sim change.
