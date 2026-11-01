OK

Review round 3 of the VFX library on `feature/vfx-shapes`. The code under review is d92f9edd, one commit on top of fddd566c. The board is `docs/art/previews/vfx-library-board.jpg` as committed at fddd566c. I am a fresh reviewer: I did not build this and did not write rounds 1 or 2. I read both earlier reviews in full, verified every claim in the round-3 brief, and ran my own checks.

Main has not moved: `origin/main` is still 2dba8b4a (v0.1.71), the merge base. The branch merges cleanly (`git merge-tree --write-tree origin/main d92f9edd`, exit 0).

**Verdict.** Every round-2 item is fixed in the code, and I checked each one by running it, not only by reading:
- **MF-1:** Hana's and Marumi's shots no longer carry the ribbon. With each girl alone over 16 builds and both ribbon tiers, no shot draws two trails and no flagged shot lacks its own.
- **LOW-2:** I ran the renderer's own guard code (taken verbatim from `BattleRenderer.js`) over the real attack styles, the real library and a real gallery battle. I injected an error into `strike`, `fire`, `slash` and the segments' push. Each time the library switched off once and the attack styles stayed on. The attack drew its old look exactly once, and no stroke was drawn after the error, not even that frame's.
- **LOW-1:** under stress, the rings keep their room before the ribbons.
- **Frames:** the board is byte-identical to the committed one, and the lib6 frames match lib5 in every effect.

One LOW remains, and it is about the new test, not the game. The trail opt-out test (NIT-6) only reaches 8 of the 39 girls, because its 12-second gallery battle never brings enemies near two of the three booth rows. I proved by mutation that it cannot catch a missing flag on Aoi, Kage, Ruri, Yoriko or Hikari. Yet VFX.md and ATTACK_FX.md say it covers every girl. The fix is one line (one girl per run, about 16 s), which I validated by mutation, plus a coverage check. I recommend it before merge. Nothing blocks.

## Gates

1. **Sim id: pass.**
   - It prints `e4001588f40b`, and both lib6 `capture.json` files record the same id.
   - None of the 92 files `tools/simId.mjs` hashes is among the 57 files in `git diff origin/main d92f9edd`.
   - Nothing changes under `src/sim`, `src/core`, `src/data` or `src/online/coop`.
2. **`nice npx vitest run tests/render`: pass.**
   - 62 files, 690 tests, all green, in 88.8 s.
   - The load average was 4 to 9 (another agent's tornado capture ran throughout). There were no timeouts, so nothing was rerun.
   - **Full `npx vitest run`:** 455 files and 7,166 tests: 7,154 passed, 11 skipped, 1 failed.
     - The failure was `tests/sim/rules.test.js`, "calm point > 4-1: every wave end is canonical": a 5 s timeout, near the end of a 1,030 s run at load 8–9.
     - Rerun alone, the file passes (25/25 in 12 s). The branch changes nothing under `src/sim`.
3. **Prod build: pass.** `nice npx vite build --outDir /tmp/rvlib3-dist` built in 4.2 s.
   - No file contains `lil-gui`, `mountLightningPanel`, `Lightning lab`, `lightningLab`, `lightningPanel`, `tornadoLab` or `mountTornadoPanel`.
   - The library and its guard are in the battle chunk (`toonStrokes`, `[vfx] styled effects disabled after an error`).
   - The HANDOFF §7 secret scan finds only the known false positive in a bundled library chunk.
   - `/tmp/rvlib3-dist` is deleted and the worktree is clean.
4. **Board: pass.**
   - It is 285,932 bytes, a 1402x1030 JPEG, made only from the game's own Sandbox frames. There are no third-party images.
   - I rebuilt it from the lib6 frames with the author's script (`/tmp/libboard/make.py lib6`). The result is byte-identical to the committed file (`cmp`), so the committed board stands for d92f9edd.
5. **Content: pass.**
   - I scanned the 5,459 added lines of `git diff origin/main d92f9edd` and the 27 commit messages in `origin/main..d92f9edd`.
   - I also scanned the full text of VFX.md, VFX_LIBRARY.md, ATTACK_FX.md, CONTRACTS.md, review-r1.md, review-r2.md and patch-note.md.
   - The list held 243 show, game, studio, character and technique names.
   - The only hits were plain words, plus one quoted substring:
     - "bleach" as a verb;
     - "alchemist", Midori's role on main;
     - a quoted four-letter substring of "BattleRenderer" in review-r1.md:14 that is also a character's first name (NIT-C).
   - There are no depiction changes, no player names, no secrets and no Supabase keys.
6. **Display only: pass.**
   - No round-3 source line reads or writes the sim, or draws a random number.
   - The library modules mention the sim only in comments.
   - `Math.random` appears only in comments and test names.
   - Randomness still comes from the `vrand` forks and from deterministic hashes and sequence counters.

**Extra:**
- **Smoke:** `nice node e2e/smoke.mjs --viewport 1280x720` reports ALL SMOKE CHECKS PASSED (227 checks). That includes "battle: stage 1-1 easy won (state=won, wave 12, lives 150)" and "battle: no errors", with no page or console errors in the real renderer at d92f9edd.
- **lib6 captures:** they ran the real renderer at d92f9edd through 66 shots (3 tiers, 2 viewports) with no errors and `vfxOff` false.

## Round-2 items, one by one

**MF-1 (Hana and Marumi doubled): fixed.**
- **The code:**
  - `hana.js:50` sets `v.ownTrail = true` as the first line of `view()`. Her gold streak draws on every frame and every tier (CORE on high and medium, DECOR on low).
  - `marumi.js:115` sets `v.ownTrail = ctx.q.trails > 0` right after the shell check. Her warm trail draws under exactly that condition (`marumi.js:128`).
  - `applyQuality` switches `ctx.q` and the ribbon tier together (`BattleRenderer.js:608–614`).
  - VFX.md:405 names both girls.
- **The new test catches the old code.** I ran it on an extracted copy of fddd566c. It fails with exactly the cases the author named:
  - Hana: every build, high and medium, 45/45 to 1257/1257 shot-frames;
  - Marumi: P0, 13/15;
  - base Akane: flagged but bare.

  It passes at d92f9edd.
- **My own check covers every girl.** I ran the test's own detection with every girl alone at the booth beside the first lane, for 600 frames, over 16 builds and both tiers:
  - the builds were base, all six T5 + T2 pairs, and T1, T3 and T4 on each path;
  - 22 girls fired;
  - no unflagged shot drew a trail behind it, apart from one false positive of the test's heuristic (NIT-A);
  - every flagged shot drew its own trail on at least one frame of its flight, counted per shot.

**LOW-1 (shapes starve first): fixed.**
- **The order:** `BattleRenderer.js:1188–1193` runs lightning, beams, shapes, trails, after the styles' segments (in `attackFx.update`, 1167). VFX.md:351 and VFX_LIBRARY.md §5 say which layer thins first.
- **Stress at d92f9edd** (`/tmp/rvlib3/tools/stress3.mjs`: 24 six-hop bolts, 32 zig-zag beams, 32 rings of 2.5 tiles, 160 ribbons):
  - **8,192 strokes:** the rings keep all 3,840 of theirs, and the ribbons thin from 3,360 to 777.
  - **With 2,304 segment strokes pushed first:** the rings get 2,280 (19 of 32 rings) and the ribbons 42. This is the documented order.
  - **5,000 strokes:** lightning and beams keep all of theirs, the rings get 1,320 and the ribbons 105.
  - `refused` stays 0, and every drawn line keeps all its layers. Beam impact lines have two layers by design.

**LOW-2 (one library error turned off every signature look): fixed.**
- **The facades:**
  - `BattleRenderer.js:394–411`: `guarded(fn)` returns null once the library is off, or on an error (after `vfxOff`).
  - `attackFx.ctx.lightning = { strike }`, `beams = { fire }`, `shapes = { slash }`, all guarded, and `ctx.vfxError = vfxOff`.
  - `strike`, `fire` and `slash` are closures with no `this`, so binding them detached is safe.
  - They only return null for bad input or an unknown preset, which the styles never send: Raika and Chika check for 2 or more points, and storm, tesla, moon and holy all exist. So in normal play the styled path is exactly as before.
  - `strike`, `fire` and `slash` are the only library calls in `src/render/attackFx/` (grep), and no test or tool reads the facades.
- **The styles** key everything on what comes back:
  - Raika's chain and its node forks (`raika.js:28–38`), and her lance, stain and end flash (`raika.js:67–76`);
  - Chika's chain (`chika.js:116–124`);
  - Luna's lance, star dots, end star and moon flash (`luna.js:57–87`);
  - Miko's ray and mirror flash (`miko.js:80–83`);
  - `toonSlash` already returned false.
- **The segments:** `segments.js:189–198` wraps `_toon` in a try that calls `ctx.vfxError`, and rethrows without it.
- **Runtime proof.** `/tmp/rvlib3/vt/guard.test.js` runs the renderer's own guard code, the exact text from `let vfxBroken` to the roster line, evaluated in node. It uses the real attack styles, the real library layers, a real gallery battle and the renderer's frame order. Each fault fires once:

| Fault | Where it fired | Library off | Attack styles | The attack's own look | Strokes after |
|---|---|---|---|---|---|
| `strike` throws | Raika's chain (5 points), in `onEvent` | once, one warning | stay on (no `[attack fx]` warning) | handled by her style; old bolt drawn once: 8 segments = 4 hops + 4 node forks, exactly the old look on high | 0, mesh hidden |
| `fire` throws | Raika's Overcharge lance ([0,4,0]) | once | stay on | old lance drawn once (1 segment) | 0, hidden |
| `slash` throws | Yoriko's hit, in `attackFx.update` (`onImpact`) | once | stay on | sprite fallback (`toonSlash` false) | 0, hidden |
| a segment push throws after 5 pushes | Seiran's chain, in `_toon` | once | stay on | soft quads from the next frame | 0 that same frame (the 5 half-pushed lines are dropped), hidden |

  In all four runs, every hand-off is null afterwards: `fx.lightning`, `fx.beams`, `fx.shapes`, `actors.trails` and `attackFx.ctx.lightning` / `beams` / `shapes` / `strokes`. The live bolts and beams are cleared.

**NIT-1 (base Akane): fixed.**
- `akane.js:44` sets the flag when P2 is at T3 or more, or P1 at T1 or more. That is exactly when her smoke or embers draw (lines 56–68).
- In the probe, base, [5,0,2] and T1, T3 and T4 on P0 keep the ribbon. Every build with P1 at least T1, or P2 at least T3, is flagged and draws its own trail.

**NIT-2 (one frame of partial strokes): fixed.**
- `vfxOff` runs `strokes.begin(); strokes.end(0)` and hides the mesh (`BattleRenderer.js:361–368`). See the push row in the table above.
- An impact frame cannot show the mesh again:
  - Whenever `impact._apply` runs, the mesh is already hidden: held on impact frames, and hidden for good after a switch-off. So it is never on the impact's hidden list (`impact.js` `_apply` / `_restore`).
  - The instance count is 0 anyway.

**NIT-3 (strokes outside the guard): fixed.** `vfxSafe(() => strokes.begin())` is at line 1118, and `hold` / `setPixel` / `end` run in one `vfxSafe` at 1194–1198.

**NIT-4 (whole segments): fixed.** VFX.md:351 and VFX_LIBRARY.md:115 match the code (`segments.js:205–212`; lightning trims to the room).

**NIT-5 (ATTACK_FX.md): fixed, with an overclaim.**
- Line 47 lists `ownTrail` in the projectile view.
- Lines 143–144 tell style authors to set it.
- But the same sentence says the test "checks every girl". It does not (LOW-A).

**NIT-6 (a test that catches a missing flag): partly fixed (LOW-A).**
- **What works:**
  - The behaviour test is real: actual shots in a real battle, every build in its list, high and medium.
  - It catches a missing or wrong flag on the girls it reaches. Mutations that remove the flag from Iroha, Yuki, Nami or Chika's drone bullets fail it, and so does adding a flag to Sango.
  - The small-buffer capacity test is sound: nothing is refused, the rings keep their room, and the ribbons thin.
- **What does not:** it never reaches most of the girls (see "The new trail test" below).

**NIT-7 (impact lines cut short): fixed.**
- `vfx-beams.test.js:93–94` checks `lines.life + 1/30 ≤ punch + hold + fade` for every preset.
- That is the right bound:
  - the hit lands on the first frame at or after `charge` (`beams.js:370`);
  - the lines last `lines.life` from there (211);
  - the body is on while `t ≤ charge + punch + hold + fade` (111, 137).
- The test allows one 30 fps frame.

**Also:**
- `review-r2.md` is in the repo (295 lines, complete).
- The patch-note draft is `docs/review/vfx-library/patch-note.md`. Its absence from `src/data/patchNotes.js` is intended. It follows the header's rules; there is one wording NIT (NIT-B).

**The round-1 fixes still hold.**
- Round 3 changes no file under `src/render/vfx/`.
- **M1:** the guards are all still in place, and the styles' calls are now guarded too.
- **M2:** in lib3, Aoi's arrows carried a blue inked ribbon beside her white streak. In lib6 they carry only her streak (`1280x720-high-chain-storm-f192`, x 400–620, y 330–450; crop `crops/aoi-lib3-lib6.png`).
- **L1–L9 and N1–N8:** the library code is unchanged since round 2.
- **Allocations** are unchanged (see Perf).

## The new trail test (`tests/render/vfx-trail-optout.test.js`)

- **How it decides.** It wraps `ctx.line`, `quad`, `quadRGB`, `spr` and `part` while each shot's `view()` runs.
  - **What counts as a trail of its own:**
    - a line end or quad more than 0.12 tiles behind the drawn shot, along its sim velocity;
    - any sprite or particle.
  - **Doubled:** a shot that is neither skipped nor flagged, on any frame where it draws a trail.
  - **Bare:** a girl whose flagged shot-frames on a build never draw one.
- **Thresholds: sound for today's styles.**
  - The shortest real trail is Kinu's spark streak at 0.16 tiles, and her shots are skipped anyway. Next are Yoriko's needle at 0.2 and Chika's drone bullet at 0.32.
  - Head glows, ground shadows and landing reticles sit at or ahead of the shot.
  - No shot in the runs had zero velocity.
  - No style draws its trail outside `view()`:
    - no style reads `sim.projectiles`;
    - the only `onSpawn` (Yuzuha's) draws a muzzle flash;
    - no `view()` adds segments or pushes to a batch directly.
- **Coverage: no, it does not cover every girl.**
  - **Why:**
    - The gallery puts girls 1, 2, 4, 5 and 7 of each group of eight on rows y = 8.5 and 12.5 (`attackFxHarness.js:131–132`, `boothOf`).
    - The test runs 360 frames at 2× (12 s, line 18). In that time the enemies only walk the first lane (y = 2.5), so most of those girls never fire.
  - **Who it reaches.** In the test's own configuration, only 8 girls' shots reach the checks:
    - Akane on base, P0 and P2;
    - Chika, Hana and Nami on every build;
    - Iroha on base and P1;
    - Marumi on P0 only;
    - Sango on P2 only;
    - Yuki on base, P1 and P2.
  - **Flagged styles it never exercises:** 7 of the 14.
    - Aoi, Kage, Ruri and Yoriko never fire.
    - Hikari's T5 lances need hero levels the gallery cannot give.
    - Kinu's shots are always skipped.
    - Yuzuha's sentries are never deployed.
  - 13 of the 21 styles with a `view()` never reach the checks.
- **Mutation proof** (each on a scratch copy of d92f9edd):

| Mutation | Test result |
|---|---|
| Remove the flag from Aoi | passes (not caught) |
| Remove the flag from Kage | passes (not caught) |
| Remove the flag from Ruri | passes (not caught) |
| Remove the flag from Yoriko | passes (not caught) |
| Remove the flag from Hikari | passes (not caught) |
| Add a flag to Midori (no trail) | passes (not caught) |
| Remove the flag from Iroha, Yuki, Nami or Chika's drone bullets | fails (caught) |
| Add a flag to Sango (no trail) | fails (caught) |

- **Builds.** Base, [5,2,0], [0,5,2] and [2,0,5] cover every threshold the styles use today. A T5 build also meets every "T3 or more" condition, and a T2 secondary path meets every "accent at least 1" condition.
  - The other three T5 + T2 pairs are not run.
  - On [5,0,2], the test's sprite rule would count Akane's one-off P0 T5 firework burst as a trail (65 of 688 frames), a false positive (NIT-A).
  - Heroes' multi-looks are not reachable in the gallery. All three flagged heroes (Nami, Yoriko, Hikari) set the flag under exactly the condition that draws their trail, so they are safe.
- **The fix, validated:** one girl per run, with the same 360 frames, builds and tiers.
  - It takes about 16 s (instead of about 4 s).
  - It reaches 13 girls, including Aoi, Kage, Ruri, Yoriko, Midori and Sango on every build, and Marumi on P0 and P1.
  - It passes at d92f9edd.
  - **Mutation runs against the fix:** it catches every mutation in the table above except Hikari's (her T5 lances need hero levels). That is, Aoi, Kage, Ruri, Yoriko, Iroha, Yuki, Nami, Chika's drone bullets, Midori's wrong flag and Sango's wrong flag.
  - The unmutated variant passes on d92f9edd's style files in 16.4 s.

## Anything new or broken by these fixes

- **Layering:** the ribbons now push after the slashes and rings, so where a ribbon crosses one it draws on top. That is fine, and round 2 suggested it. The captures show no change in any effect (lib6 = lib5).
- **Room order:** as documented (LOW-1).
- **Reduce Motion, tiers, the flash guard, quality switching, dispose:** round 3's diff touches none of them.
  - Marumi's and Hikari's flags follow `ctx.q`, which switches with the ribbon tier.
  - Dispose is safe after a switch-off: each layer's `dispose` only frees its own mesh.
  - A style's fallback flash asks the flash guard as before. A `fire` that throws after the muzzle's gate only makes the budget more conservative.
- **Consistency with `tornadoSafe` and `fxSafe`:** all three act once, clear their layer, log one warning and let the battle carry on. `vfxOff` also hides the strokes mesh. It is idempotent, so the three error hooks (`fx`, `actors`, `attackFx.ctx`) can all point at it.
- **The facades carry only `strike`, `fire` and `slash`.** VFX_LIBRARY.md lists "the six styles' own pulses" as next. A style that calls `ctx.shapes.shock(...)` would throw a TypeError in `fxSafe` and turn every attack style off for that battle (NIT-D).

## Visuals

**What I looked at:**
- **Desktop 1280x720**, zoomed 1.4 to 2×, at every tier: storm chain f192, Tesla chain f152, moon lance f65, storm lance f105, and slash + ring f225.
- **Phone 1170x2532** (390x844 dpr 3), zoomed 2.6 to 3×, at every tier: the same five, with Tesla f145, plus the plain f40 frame.
- Aoi's arrows, lib3 against lib6.

**What I found:**
- Chains, beams, impact lines, slashes, rings, ribbons and segment lines read solid, inked and styled at both viewports.
- Enemies, the road and health bars stay readable, and health bars draw over the strokes.
- Medium reads the most inked. On high with bloom, chain and lance bodies still wash out toward pale yellow or lilac (owner call 4).
- The rings are round on every tier, and the crescent covers part of its enemy for about 0.2 s with the health bar on top.
- Pink ribbons on the phone are still bold and cross enemies (owner call 5).

**Is lib6 the same as lib5?** Of the 66 frames, 48 are identical within 8 levels. The other 18 differ in at most 0.27% of their pixels, all inside two HUD boxes:
- the hero portrait card's glow at 1280x720 (872–958, 525–626);
- the phone's bottom-bar card (516–719, 2262–2408).

  One correction to the brief: 3 of the 18 are medium frames (desktop medium chain f185 and f192, and shapes f232), not "high only". None of the differences is in an effect.

**Capture state (lib6, 66 shots):**
- 588 to 1,156 strokes, `strokesRefused` 0, `vfxOff` false.
- The only console messages are preload warnings.
- Both runs started two minutes after the d92f9edd commit.

## Perf

- **Draw calls:** the same as lib5 (high 271–285, medium 170–183, low 105–113). The library adds one call while anything is up.
- **CPU and allocations** (node, `--trace-gc`, the loaded box):
  - All layers together, 2,183 strokes a frame, take 0.29 ms a frame (round 2 measured 0.25 on a quieter box).
  - Minor GCs per 1,000 steady frames: 23 for everything together and 22 for 80 ribbons alone, the same as round 2.
  - Round 3 adds two small per-frame closures (the new `vfxSafe` calls) and one rest-argument array per guarded call (once per chain, beam or slash event). That is negligible.

## Docs

- VFX.md, VFX_LIBRARY.md and ATTACK_FX.md describe what ships, with two exceptions:
  - the claims about the trail test's reach (LOW-A);
  - the facades' scope (NIT-D).
- CONTRACTS.md needs no change. It does not describe the styles' context, and `r.vfx.vfxOff` and the demos' null return are already there.

## New findings

### LOW

**LOW-A. The trail opt-out test reaches only 8 of the 39 girls, but the docs say it checks every girl.**
- **Where:**
  - `tests/render/vfx-trail-optout.test.js:90`: groups of eight at the gallery booths (`attackFxHarness.js:131–132`).
  - `tests/render/vfx-trail-optout.test.js:18`: 360 frames at 2×.
  - `docs/VFX.md:405`: "runs every girl's real shots on every build and holds both".
  - `docs/ATTACK_FX.md:144`: "checks every girl".
- **Why it matters:**
  - It cannot catch a missing flag on Aoi, Kage, Ruri, Yoriko or Hikari. Aoi is the very case round 1 showed in the frames.
  - It cannot catch a wrong flag on most girls.
  - A new girl gets her booth from her place in `ORDER`, so two in three new girls land on a booth the test never reaches. The docs tell style authors to trust it.
  - The game itself is right today: I verified every girl separately.
- **Fix:**
  1. One girl per run: `for (let i = 0; i < ORDER.length; i++) groups.push([ORDER[i]]);`. `boothOf(0)` is next to the first lane. This takes about 16 s, the code passes it, and it catches every mutation above except Hikari's.
  2. Assert coverage, so it cannot shrink silently again. Every girl whose `view()` returns unskipped shots must reach the checks on at least one build: `akane, aoi, chika, hana, iroha, kage, marumi, midori, nami, ruri, sango, yoriko, yuki`. Name the known gaps in a comment:
     - Hikari's T5 lances need hero levels;
     - Yuzuha's sentry shots need sentries;
     - Kinu, Momo, Miko, Chigusa, Ena and Fuu are always skipped.
  3. Make VFX.md:405 and ATTACK_FX.md:144 say what the test covers.

### NIT

- **NIT-A. The test's heuristics** (optional; only needed if builds are added).
  - **The sprite rule:** any sprite drawn in `view()` counts as a trail, so a one-off flourish does too. On [5,0,2], Akane's P0 T5 firework would fail the test although nothing is doubled.
    - Fix: count sprites as a trail only when a shot leaves them on two or more frames.
  - **The bare check is per girl and build:** a girl with one flagged kind of shot that never draws a trail, beside another kind that does, passes it.
    - A per-shot check, as in my probe, finds no bare flagged shot on any of 16 builds, so it can be made stricter today.
- **NIT-B. Patch-note wording** (`docs/review/vfx-library/patch-note.md:10`): "Beams hit harder" reads as a damage buff, but the change is looks only.
  - Fix: "Beams look and feel heavier: …", or add "(looks only: damage is unchanged)", as v0.1.71 did with "shots land exactly where they did".
- **NIT-C. review-r1.md:14** quotes a four-letter substring of "BattleRenderer" that is also a character's first name, to explain a false positive. It was committed in round 2.
  - It is harmless in context. Under a strict reading of the names rule, write 'a substring of "BattleRenderer"' instead, or leave the verbatim record as it is.
- **NIT-D. The facades' scope is not written down** (`BattleRenderer.js:405–407`, `docs/VFX.md:352`). The styles' `ctx.lightning`, `beams` and `shapes` carry only `strike`, `fire` and `slash`. The next batch's style pulses (`shapes.shock`) would throw in `fxSafe` and turn off every attack style for that battle.
  - Fix: one VFX.md sentence: "a new library call for the styles is added here as another `guarded` entry (and in vfx-library-guard.test.js)".

## Owner calls (not code defects)

Rounds 1 and 2's list:
1. **Still stands.** With attack FX off (the "plain look"), the library and trails still apply. CONTRACTS says so.
2. **Still stands.** Raika's Forked-path cue (+1 fork) disappears on low and on a busy board.
3. **Still stands.** Medium and low get one more draw call.
4. **Still stands.** On high with bloom, chain and lance bodies wash out toward pale yellow or lilac and the ink fades. This also hides most of Luna's T5 tint.
5. **Partly stands.** Aoi's, Hana's and Marumi's shots have no ribbon now. Other ribbons (the pink ones) are still bold on phones and cross enemies.
6. **Still stands.** Solid beams hide the enemies on their line for about 0.28 s.
7. **Still stands.** Long chain hops read like a zig-zag wire.
8. **Still stands.** Scope:
   - Seiran's chain stays the old zig-zag in toon strokes;
   - Luna's held moonbeam and the ability lines stay soft;
   - the pulse has lost its soft ground disc.
9. **Resolved as round 2 recommended.** Under extreme load the ribbons thin first. Rings can still thin when the styles' segments are very heavy (19 of 32 in my stress run), which is the documented order.
10. **Partly resolved.** The patch-note draft exists. It must go to the top of `src/data/patchNotes.js` in the release that takes this branch (and see NIT-B).
11. **Review gate:** this is round 3, the last before "not approved". My verdict is OK.

New:

12. Plain fireball, shell and flask shots keep the actors' sparse default embers, smoke and bubbles under the ribbon. Round 2 treated "embers + ribbon" as the intended look for base Akane. Whether those default puffs should give way to the ribbon is a look choice.

## Must-fix list

None. LOW-A is cheap and I recommend it before merge, together with NIT-B.

## Scratch evidence (`/tmp/rvlib3`)

- **Logs** (`logs/`):
  - `vitest-render.log`, `vitest-full.log`, `build.log`;
  - `optout-r2.log` (the new test failing on fddd566c);
  - `mutations.txt` (the mutations against the shipped test);
  - `mutations-singles.txt` and `optout-singles.log` (the mutations against the one-girl-per-run variant, and that variant passing);
  - `rules-rerun.log` (the timed-out sim test passing alone);
  - `smoke-1280.log`;
  - `guard-int.log`.
- **Probes and tests:**
  - `vt/probe2.test.js`: the coverage probe; results in `probe-all.json`, `probe-single.json` and `probe-single360.json`;
  - `vt/guard.test.js`: the guard integration test; results in `guard-int.jsonl`.
- **Tools** (`tools/`):
  - `stress3.mjs` (the budget, in the new order);
  - `gc3.mjs` (allocations);
  - `diff56.py` (lib5 against lib6);
  - `zoom.py` (crops);
  - `scan.py` and `names.txt` (the content scan).
- **Crops** (`crops/`): `d-*.png` (desktop) and `p-*.png` (phone) for every effect and tier, `hud56.png`, `bar56.png` and `aoi-lib3-lib6.png`.
- **Board:** `board6-mine.jpg`.
- **Scratch trees:** `r2tree` and `r3tree`, the extracted fddd566c and d92f9edd copies used for the mutation runs. They are not the worktree. `r3tree`'s copy of the test holds the one-girl-per-run variant.

I changed no tracked files.
