# Review r2: feature/sandbox-catchup @ 9fea5a42

Independent reviewer, fresh clone. Covers the delta since r1 (e30311ca): merge 43032347 of `main` eb0b1ab9 (v0.1.67), 03070e82 (Typical roll, UR Resonance switch, late-start hero, spec note on Tryout Day) and 9fea5a42 (r1 lows L1–L6, and the `sandbox.mjs` "Back" race).

**Verdict: OK.** Nothing blocks. I found four Low findings and a few notes (below). The two Lows on numbers (R1, R2) are about 0.0001 and about 1 % of one stat's range.

## 1. Nothing leaks: verified

**Code.**
- The `placeTower` hook (`sandboxPanel.js:173` `guardHeroLevel`) goes through `override()`. That sets an *own* property on that one Sim instance, and `destroy()` deletes it (`sandboxPanel.js:135-143`, `:245-247`). It is only created by `createSandboxPanel`, and only for `req.sandbox` (`controller.js:471-480`).
- The Resonance override exists only in `sandboxUnitStats(..., { resonance })`. Its only caller is `createSandboxSim` (`setup.js:229`). The `now` it forces is passed into `rankBoost` as an argument. No module state or clock is changed.
- Co-op builds its `req` from the lockstep (`controller.js:121-130`) and never calls `parseBattleParams`, so `res`, `hmax` and `sb` can't reach a co-op battle.
- Typical roll only changes the virtual `sbx:` pieces that `sandboxGear` returns. Those still never reach `store.profile` (r1 §2 holds).
- The screen's new `resonance` and `heroMax` choices live in `sessionStorage['sakura.sandbox.v1']`, not the save.

**Runtime.** My probe is `r2-tools/rv2-probe.mjs.txt`, 34/34 ok. It does the following in one page session:
1. Starts a sandbox run on 4-5 from wave 60 with `res=on` and `sb=85-6-5-1-t-lr-best` (Typical). The team is a starter, Tenka and Hotaru; the hero is Hikari.
   - The Sim has its own `placeTower` hook.
   - Hikari is placed at **Lv 25, Mastery 0.25, XP 74,280** (the cap).
   - Hotaru's damage is the forced-Resonance value.
2. Quits mid-wave. The hook is **gone** from that Sim object. Across the whole run there were 0 `store.commit` / `saveNow` calls. localStorage (every key) is byte-identical, and the in-memory profile is identical.
3. Then starts a **normal campaign battle** (1-2):
   - There is no sandbox panel and no own `placeTower`; the prototype method is the class one.
   - Every loadout entry equals `unitBattleStats(real profile)` on the real clock.
   - Hikari is placed at **Lv 1, Mastery 0, XP 0**.
4. Makes no Supabase requests (only Google Fonts) and has no page errors.

In vitest (`r2-tools/r2-checks.test.js.txt`), a sandbox Sim with `res=on`, Typical and the hook, then a normal Sim from `parseBattleParams`, leaves both profiles' JSON unchanged. The normal hero starts at Lv 1.

## 2. Correctness

**Typical roll.**
- Typical is below Max on **every line**. I checked all 22,035 lines: every unit × every gear preset × every piece × main and subs, compared by `gearLines` effective value (UR/LR reads included). None is equal or higher.
- Typical is the midpoint of each line's range. I checked that against a Monte Carlo of the real `rollGear` (Legendary, all 5 slots, 300k pieces):
  - Every percent stat matches the midpoint within sampling noise (for example atkPct main 0.1513 vs 0.1512, critDmg 0.2861 vs 0.2856).
  - **Armor Pierce does not** (main 3.411 vs 3.45, sub 2.848 vs 2.85). See R2.

**UR Resonance.**
- For every unit and four builds (max, L60 ★4 Legendary, ★5 no gear, Typical), I compared `sandboxUnitStats(.., {resonance:'on'})` with `sandboxUnitStats(..)` (auto) under a faked clock inside the first Resonance week, and `'off'` with auto before it. That is 312 cases.
- **272 are identical on every key. 40 differ by ±0.0001** on `damageMul` or `rateMul` (for example "on, Kogane: clock 13.6176, forced 13.6177"). See R1.
- The ratios are right: ×1.10 dmg / ×1.04 rate for a ★5 SSR, ×1.10×1.15 for LR, and none for an R girl.
- Today, 2026-10-31, Auto means Off. The first Resonance week starts 2026-11-02.

**Late-start hero.**
- Hikari placed with the hook was compared with Hikari placed at Lv 1 and fed `gainHeroXp(…, 137, 'damage')` 543 times up to the cap. **Every numeric or boolean field is identical** (level 25, Mastery 0.25, XP 74,280, damage, rate, range and so on), except `ultCooldown`: 6.32 vs 8.75.
- That is because her ult unlocks at Lv 25 with Lv 25 haste, not at Lv 3. A real hero at wave 60 would long since have had her ult ready, so this is harmless (note N1).
- The XP is booked as `stats.heroXp.bought`. `levelsBought` stays 0, so the result line says "reached Lv 25" without "levels bought". Sandbox results are never applied.

## 3. Determinism: verified

- `import { simId } from tools/simId.mjs` gives **0fe7c5c04aec**.
- `git diff origin/main 9fea5a42 -- src/sim` is empty. `COOP_PROTOCOL` is 15 on both.
- `progression.js`, `limitBreak.js`, `sandbox.js` and `sandboxPanel.js` are not in the sim-id file set. The hook calls the Sim's own `gainHeroXp` from outside `src/sim`, on a solo Sim only.
- Co-op cannot reach the sandbox path (§1).
- `e2e/engines.mjs` is **green**: V8 and JavaScriptCore give identical battles.

## 4. L1 test strength: verified

Each mutation was made in a scratch worktree, never committed, and run with `node e2e/sandbox-catchup.mjs --viewport 390x844`. Script: `r2-tools/l1-mutations.sh.txt`.

| Mutation | Result |
|---|---|
| A. A stage of a new kind (`raid-1`, kind `raid`) appended to `STAGES` | **FAIL**: "every stage kind has a tab (… raid …)" |
| B. The screen's roster drops one student (`sandboxRoster` filters out `kage`) | **FAIL**: "roster: every student and hero in the game (30/8 vs 31/8)" |
| C. A fake unit pushed to `UNITS` | passes (32/32). The roster *is* `UNITS`, so the new girl shows up, which is the wanted behaviour. |
| D. The screen drops a stage (`4-4` skipped in `sandboxStages`) | **FAIL**: "every stage by mode … act1 39 vs 40" |

So the new e2e bites wherever the screen could fall behind the data: a new stage kind, or a filtered roster or stage list. A new unit or stage of a known kind needs no change and passes.

## 5. UI at 390x844 and 844x390 (touch)

Screenshots are in `r2-shots/`, all JPEG, 35–88 KB.

| | 390x844 | 844x390 |
|---|---|---|
| Selects, number input, chips, tabs (min height) | **40** px | **36** px |
| Hero checkbox row | 40 px | 40 px |
| Per-girl Build buttons | 36 px | 36 px |
| Squad bar run pill ("Normal · Freeplay Blossom · from wave 200 · Resonance on") | wraps to 2 lines, nothing cut, `title` set | wraps to 2 lines, nothing cut |
| Squad tiles | name only (6/6 tiles) | name + "Lv 85" |
| Horizontal overflow | none (map, squad) | none (map, squad) |
| Hero "Lv 25 + Mastery" checkbox at wave 200 | shown, on | shown, on |

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| R1 | Low | `src/systems/sandbox.js:342-355` | The Resonance on/off override divides an already-rounded `damageMul`/`rateMul`/`auraPct` by today's boost and multiplies by the forced one. In 40 of 312 cases this lands 0.0001 away from what the real clock gives in (or outside) a Resonance week. It is tiny, solo only, and not in the sim id, but the stats are not exactly "what the clock would give". | Give `unitBattleStats(profile, unitId, { now } = {})` an optional `now` and pass it to `rankBoost` (`progression.js:551`). Then `sandboxUnitStats` calls `unitBattleStats(profile, unitId, { now: RESONANCE_AT[res]() })`. `progression.js` is not in the sim-id set, so there is no COOP bump. Add a test that compares with a faked clock (like `r2-checks` "r2 resonance"). |
| R2 | Low | `src/systems/sandbox.js:300,303` (`mid(...Range)`) | Typical uses the midpoint of the **rounded** range ends. For Armor Pierce (rounded to 0.1, with a scale that rounds the top end up), the real average roll is about 0.04 lower than that midpoint: main 3.41 vs 3.45, sub 2.835–2.848 vs 2.85, about 1 % of the range. Percent stats are exact. | Take the mean from the unrounded scaled range. For example, export `meanRoll(stat, rarity, main)` from `gear.js` as `((a + b) / 2) * statScale(stat, rarity) * (main ? MAIN_MUL : 1)`, and use it in `sandboxGear`. |
| R3 | Low | `src/ui/styles/sandbox.css:83` (`@media (max-height: 480px) .sbx-build { repeat(5, …) }`) | At 844x390 the build grid has 6 controls now (Gear rolls is new), so "Gear rolls" sits alone on a second row (shot `844x390-squad-build.jpg`). | Use `repeat(6, minmax(0, 1fr))` (the five selects already fit at about 150 px), or `repeat(3, …)` for two even rows. |
| R4 | Low | `src/ui/styles/sandbox.css:18-19` (`.sbx-bar-map` / `.sbx-bar-diff`) | Now that the run pill wraps, at 844x390 it takes the room and the stage name is cut to "4-5 The Iron …" (shot `844x390-squad.jpg`). | Give the title a floor, for example `.sbx-bar-map { flex: 0 1 auto; min-width: 9em }` and `.sbx-bar-diff { flex: 1 1 0; }`, or drop the difficulty from the pill when the title is visible. |

Notes (no action needed):
- **N1.** The late-start hero's first ult charge comes from her Lv 25 cooldown (6.3 s left vs 8.75 s for a Lv 3 unlock). This is harmless, and arguably closer to a real late run.
- **N2.** In `e2e/sandbox-catchup.mjs:231`, "the Matriarch reaches the board" is timing-sensitive. My first run, made while the full vitest suite ran beside it, failed this one check at both viewports (85 ok, 2 FAIL). Run alone, it passed 87/87. Consider a longer timeout, or fast-forwarding the sim, before relying on it in CI.
- **N3.** The e2e touch-target check uses 36 px at every size, so the 40 px portrait target isn't asserted. My probe measured it (above).

## Test counts

| Gate | Result |
|---|---|
| `npm test` (vitest) @ 9fea5a42 | **429 files passed, 2 skipped; 6755 tests passed, 11 skipped; 0 failed** |
| `e2e/sandbox-catchup.mjs` (390x844 + 844x390, touch), machine idle | **87/87 ok** |
| `e2e/sandbox-catchup.mjs` while vitest ran beside it | 85 ok, 2 FAIL (Matriarch timing, N2) |
| `e2e/sandbox.mjs` | **79/79 ok**. The two "Back leads to the Sandbox squad" failures from r1 are gone. |
| `e2e/engines.mjs` | **OK**: V8 (Node and Chrome) and JavaScriptCore (Bun) compute identical battles, including freeplay and the wave-40 checkpoint restore. Firefox and WebKit are skipped (not installed). |
| `e2e/smoke.mjs` | 676 ok, 2 FAIL: the 2 known "drag (touch)" failures, the same as in r1 and on main. Nothing new. |
| Reviewer probe `r2-tools/rv2-probe.mjs.txt` | **34/34 ok** |
| Reviewer vitest checks `r2-tools/r2-checks.test.js.txt` | Typical 22,035 lines all lower; Monte Carlo ok except armorPen (R2); hero parity ok; resonance 272/312 exact, 40 off by 0.0001 (R1; this test fails until R1 is fixed) |
| L1 mutations | A, B, D fail as they should; C passes by design |
| Sim id | **0fe7c5c04aec**; no `src/sim` diff vs main; COOP 15 |
