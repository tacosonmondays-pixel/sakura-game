NOT OK

Review round 2 of the VFX library on `feature/vfx-shapes`. The code reviewed is 6b8ef1fe: 68d8c23c (the round-1 fixes), edcbbe0c (rounder rings) and the merge of main v0.1.71. The board is at fddd566c.

- I checked every round-1 item against the code and ran every gate.
- I rendered my own lab scenes through the worktree's modules and zoomed into the lib5 captures at both viewports and all three tiers.
- I stress-tested the stroke budget and measured allocations against the round-1 code.

Almost everything is fixed, and the merge is right. One must-fix remains: M2 is only partly done. Hana's and Marumi's shots still draw their own trail and get the styled ribbon on top, which is the same doubling round 1 flagged. The code fix is two lines, plus the VFX.md list.

## Gates
1. **Sim id: pass.**
   - It prints `e4001588f40b`.
   - None of the 92 files `tools/simId.mjs` hashes is in `git diff origin/main fddd566c` (51 files).
   - Nothing changes under src/sim, src/core or src/data.
   - Both lib5 capture.json files record the same id.
2. **`nice npx vitest run tests/render`: pass.**
   - 61 files, 685 tests, all green, in 69 s.
   - The load average was about 1, there were no timeouts, and nothing was rerun.
3. **Prod build: pass.** `nice npx vite build --outDir /tmp/rvlib2-dist` built in 3.4 s.
   - No file contains `lil-gui`, `mountLightningPanel`, `Lightning lab`, `lightningLab`, `lightningPanel`, `tornadoLab` or `mountTornadoPanel`.
   - The library and its guard are in the battle chunk (`toonStrokes`, `[vfx] styled effects disabled after an error`).
   - `/tmp/rvlib2-dist` is deleted and the worktree is clean.
4. **Board: pass.**
   - `docs/art/previews/vfx-library-board.jpg` is 285,932 bytes, a 1402x1030 JPEG.
   - It is built from the game's own lib5 Sandbox frames, with no third-party images.
   - Every tile is captured, so there are no placeholders.
5. **Content: pass.**
   - I scanned the 4,877 added lines of the branch diff, all 16 commit messages, and the full text of VFX.md, VFX_LIBRARY.md, CONTRACTS.md and review-r1.md. The list held about 280 show, game, studio, character and technique names.
   - The only hits were generic words in their plain sense: a colour verb, the word "anime" with no title, and "arcane" (game vocabulary on main before this branch).
   - No depiction changes, no player names, no patch-note change.
6. **Display only: pass.**
   - `Math.random` appears only in comments that say "never Math.random".
   - The library modules never read or write the sim.
   - Randomness comes from the `vrand` forks (lightning, beams) and from deterministic hashes and sequence counters (segments, shapes, trails).

**Extra: smoke e2e passes.** `nice node e2e/smoke.mjs --viewport 1280x720`: ALL SMOKE CHECKS PASSED (227 checks, no screenshots written).

## Round-1 items, one by one

**M1 (error isolation): fixed.** Two LOW and two NIT follow-ups are below.
- **The guard (`BattleRenderer.js`):**
  - `vfxOff` / `vfxSafe` at 353–383, modelled on `tornadoSafe`. It acts once and clears the four layers, each inside a try.
  - It sets `fx.lightning`, `fx.beams`, `fx.shapes`, `actors.trails` and `attackFx.ctx.lightning` / `beams` / `shapes` / `strokes` to null, and logs one `console.warn`.
  - The four updates run in one `vfxSafe` (1166–1171). `fx.vfxError` and `actors.vfxError` point at `vfxOff` (384–385).
  - The demos are guarded (1491, 1498), and `r.vfx` exposes `strokes`, `strokesRefused` and `vfxOff`.
- **The hand-offs (`fx.js`):** `_styled` (144) wraps all four, pulse 351, beam 369, chain 381 and slash 411, and falls through to the old drawing.
  - `shapes.shock` and `shapes.slash` always return their record, so a working layer never double-draws the old ring or sprite.
- **The feed (`actors.js` 668–674):** `trails.feed` is wrapped. The projectile loop carries on, and later shots skip the feed once `actors.trails` is null.
- **Nothing re-wires the layers after `vfxOff`:**
  - `applyQuality` and `setupComposer` only call `setQuality` / `setGlow` on them, which is harmless.
  - attackFx never re-assigns its `ctx` layers.
  - `segments.js:83` re-reads `ctx.strokes` every frame, so live toon segments become soft quads on the next update.
- **Docs and tests:**
  - `VFX.md:352` has the "Errors" line.
  - `tests/render/vfx-library-guard.test.js` checks the feed and the four hand-offs by behaviour, and the renderer by source, like the tornado's test.
- **The styles' own library calls still go through `fxSafe`.** This covers Raika's and Chika's `strike`, Luna's, Miko's and Raika's `fire`, `toonSlash` and the segments' toon pushes. I judge this acceptable for safety:
  - The battle carries on, and no events are lost.
  - `fxSafe` returns false, so that event's default effect is still drawn.
  - If the library itself is broken, the next default draw trips `vfxOff` through `_styled`.
  - It is documented in `VFX.md:352`. The cost is a wider blast radius: see LOW-2.

**M2 (doubled trails): partly fixed. A MUST-FIX remains (MF-1).**
- **The mechanism works:**
  - `pv.ownTrail` is reset per shot before the style's `view()` (`attackFx/index.js:398`) and counted in `touched` (417).
  - actors feed the ribbon only `if (this.trails && !(v && v.ownTrail))` (`actors.js:668`).
- **Where it is set:** Akane, Aoi, Iroha, Kage, Kinu, Nami, Ruri, Yoriko, Yuki and Yuzuha, Hikari's T5 branch, and Chika's drone bullets.
  - Kinu already sets `skip`, so her flag is redundant but harmless.
  - Each flagged shot keeps a trail of its own on high and medium, the tiers where ribbons draw. No shot lost its only trail; there is one consistency NIT for base Akane (NIT-1).
- **Visual check:** in lib5, Aoi's arrows carry only her white fletch streak. lib3 had the blue ribbon beside it; compare `1280x720-high-chain-storm-f192` at x 400–620, y 330–450.
- **Still doubled:** Hana and Marumi. Round 1's list missed them, so the fix did too; see MF-1.

**L1 (beams layered per beam): fixed.**
- `beams.js`: `state()` runs once per beam per frame (129–166). `layerOf()` then pushes every ink, then every body, then every core (169–206, 337). Impact lines push every ink, then every core (216–258).
- In a lab render of Luna's volley (three moon lances from one point, MSAA off, high, medium and low), the hub is clean: no ink crosses a body.

**L2 (sprites hidden under strokes): fixed.**
- Luna (`luna.js`): no star dots when `ctx.beams` draws (75). Her end star and moon flash draw only on the fallback (85–88).
- Raika: her end flash draws only on the fallback (`raika.js:71–74`).

**L3 (doubled flashes and scorch): fixed.**
- Luna: as in L2.
- Miko: the mirror flash draws only on the fallback (`miko.js:80–84`). Her turning star stays as her cue.
- Raika: no stain or end flash with the beam (71–74). `drumBeat` is kept (75).
- Each beam end now has one flash and one scorch.

**L4 (Luna's tier cues): fixed.**
- `luna.js:58–61` passes `widthScale: 1 + 0.1 × (p0 || accent[0])`, and `#c9a8ff` at P0 T5.
- `beams.fire` applies `widthScale` (`beams.js:87`) and tints the preset.
- In the lab, the T5 lance is visibly wider and paler. On high with bloom the colour difference shrinks, but the width still reads.

**L5 (stopping mid-layer at capacity): fixed as specified, with a new LOW (LOW-1).**
- **The room check:**
  - `strokes.room()` (172). Lightning uses `cap = min(tier.cap, room)` (261).
  - Beams drop impact lines first, then the newest beams (333–338).
  - Trails (147–151), shapes (151–152) and segments (196–203) drop the newest.
- **Node stress at 100000, 8192 and 5000 strokes** (24 six-hop bolts, 32 beams, 160 ribbons, 32 large rings):
  - Every drawn line kept all its layers: bolt segments 3, beam segments 3, impact lines 2, ribbons 3, rings 3.
  - `strokes.refused` stayed 0. A line is never cut to its ink.

**L6 (allocations): fixed.** I ran the same scenarios on 19566b4f and on 6b8ef1fe with `node --trace-gc`, counting minor GCs per 1,000 steady frames (baseline 4).

| Layer | 19566b4f | 6b8ef1fe |
|---|---|---|
| Lightning | 14 | 8 |
| Beams | 11 | 11 |
| Shapes | 25 | 13 |
| Trails (80 ribbons) | 70 | 22 |
| All together | 48 | 23 |

- All layers together, 2,183 strokes a frame, take 0.25 ms a frame (node, no GPU).
- Small allocations remain: a new path array at each zig-zag re-strike beat (lightning, beams), and `Map` entry destructuring in `trails.update`.

**L7 (12-gon rings): fixed.**
- `shapes.js:28` and 106 set the joints to `clamp(round(r × 20), 16, 40 / 32 / 24)`.
- A test pins the sagitta under 0.025 of a tile, up to 2.5 tiles, on every tier.
- In the lab (about 82 px a tile, MSAA off), rings read round on every tier. The smallest ring (16 joints) shows facets only at 3× zoom; at 1× the sagitta is under a pixel.
- In the real frames (shapes f225, desktop and phone) the rings are round on every tier.

**L8 (lab colours): fixed.** `lightningPanel.js:47` passes `custom: work[preset]`. `strike()` takes it whole (`lightning.js:171–174`) and caches its colours when it strikes.

**L9 (docs drift): fixed.**
- CONTRACTS.md: the attackFx-off sentence, the new `r.vfx` keys, `lightningDemo`'s `custom` and null, and `beamDemo`'s `widthScale` and null.
- VFX_LIBRARY.md: B4 status and budgets.
- VFX.md: chain timing, the Errors line, ring tiers and the flash-guard line.
- Two small drifts remain (NIT-4, NIT-5).

**NITs from round 1:**
- **N1 (AA padding): fixed.** `strokes.js:61` pads the quad by 1.5 CSS px. That always covers the 0.75 device-px AA ramp at any dpr. MSAA-off lab renders show a full, smooth edge.
- **N2 (colour before premultiply): fixed** (`strokes.js:114–116`).
- **N3 (band time wrap): fixed.** `strokes.js:196` uses `time % BAND_WRAP`, and `vfx-beams` pins `bandSpeed × 10` to whole turns.
- **N4 (rings dipping into the ground): fixed.** `shapes.js:109` lifts the band by 0.7 × (half width + ink).
- **N5 (fallback random stream): unchanged.** Harmless, as round 1 said.
- **N6 (shapes event missing enemies): fixed.** capture.mjs uses the enemy nearest the crowd's median. In lib5 the slash and ring land on an enemy on the road in every config.
- **N7 (clipped placeholder text): moot.** The round-2 board has no placeholder tiles. The board script is not in the repo, so I could not check the two-line text.
- **N8 (flash guard and toon slashes): fixed.** VFX.md has the flash-guard line under Slashes and shockwaves.

## The merge (main v0.1.71)
- **The `raika.js` resolution is right.**
  - The styled chain (31) and storm lance (65) start at `h.h + tipUp(h, 0.1)`, exactly like main's own `chainBolt` and lance, and like the branch's fallbacks (34, 67).
  - At a weapon tip, `hand()` returns the tip and `tipUp` adds 0. Without an anchor, it is the old hand point plus 0.1.
  - `git diff origin/main fddd566c -- src/render/attackFx/styles/raika.js` shows only the library branches.
- **Every other style file both sides touched** differs from main only by the branch's own lines. Those are the `ownTrail` line in Akane, Aoi, Nami, Yuki and Yuzuha, and the library branches in Miko, Chika, Kage, Kinu, Ruri, Yoriko and Luna. `hana.js` is byte-identical to main.
- **Start points:**
  - Luna (moon `M`), Miko (mirror `MIR`) and Chika (`HALO_H`) do not use `hand()`, so they are unchanged.
  - Default `fx.chain` and `fx.beam` still start at the girl's lifted height, the same as main's own drawing; main did not change `fx.js`.
- **Generic shots now blend from the weapon tip** (`attackFx/index.js:349–360`, `rec.blended`).
  - The ribbon is fed the drawn position, so it starts at the tip; I saw this at Rei's sword in lib5 f40.
  - `ownTrail` is reset after main's origin code and before the style's `view()`, so the two do not interact.
- **Draw calls:** lib5 has +36 calls on high and +18 on medium and low over lib4, in every shot. The only library change between them is `raika.js`, so this comes from main v0.1.71: probably the face geometry on the 18 slimes and goblins in the scene, doubled on high by shadows. The library itself still adds one draw call.

## Guard, room, layering, opt-out, Reduce Motion, tiers, flashes, quality switching, dispose
- **Guard:** correct, and consistent with `tornadoSafe` (once, clear, log) and with `fxSafe`. Nothing is left half-wired. Two gaps remain: one frame of partial strokes (NIT-2), and `strokes.*` outside the guard (NIT-3).
- **Room:** lines keep all their layers. Shapes starve first (LOW-1). Lightning and segments trim per segment (NIT-4).
- **Layering:** clean joints within every producer, and the three-lance hub is clean.
- **Opt-out:** no style lost its only trail. Two styles are still doubled (MF-1). Base Akane is inconsistent (NIT-1).
- **Reduce Motion:** unchanged by the fixes and still correct. The ring lift and `widthScale` do not depend on it, and trails are still 30% shorter.
- **Tiers:**
  - Ring joints are capped per tier, and the joint buffer grows when the tier's ring grows (`shapes.js:143`).
  - Trails trim every extra joint at once on a tier switch (tested), and clear on low.
- **Flashes:** no new flash. Luna, Miko and Raika lost their doubled flashes. Every beam flare and star and every lightning star still asks the flash guard.
- **Quality switching and dispose:** unchanged. Both are harmless after `vfxOff`, and the layers are still disposed with the battle.

## Visuals
**What I looked at:**
- **Desktop 1280x720,** zoomed 1.6–4×:
  - moon lance f65, storm lance f105, storm chain f185 and f192, and slash + ring f225 at every tier;
  - the plain f40 frame on high, medium and low;
  - Aoi's arrows, lib3 against lib5.
- **Phone 390x844 dpr 3** (1170x2532 canvas): moon lance f65, storm lance f105, Tesla chain f145 and slash + ring f225 at every tier, plus the full Tesla frame.
- **Lab** (my own scenes through the worktree's modules):
  - Luna's three-lance hub on high with bloom, and on high, medium and low with MSAA off;
  - Luna's T5 lance;
  - rings of 0.6, 1.2, 2.0 and 2.5 tiles on every tier.

**What I found:**
- Chains, beams, impact lines, slashes, rings, ribbons and segment lines read solid, inked and styled at both viewports.
- Enemies, the road and health bars stay readable. Health bars draw over the strokes.
- On high with bloom, chain and lance bodies still wash out to pale yellow or lilac and the ink fades (owner call 4). Medium reads the most inked.
- The slash and ring now land on a real enemy. The crescent covers part of it for about 0.2 s, and its health bar stays on top.
- The phone ribbons are bold; the pink ribbons cross enemies (owner call 5).

**Capture state (66 shots):**
- Strokes per frame run 588–1,156 of 8,192.
- `strokesRefused` is 0 and `vfxOff` is false in every shot.
- No console errors apart from preload warnings.

## Perf
- **Draw calls:** +1 while anything is up, unchanged. The lib4 → lib5 rise is main's (see the merge section).
- **CPU and allocations:** see L6. Upload is 96 bytes a stroke, about 111 KB a frame at the busiest captured frame (1,156 strokes).

## New findings

### MUST-FIX
**MF-1. M2 is incomplete: Hana's and Marumi's shots are still doubled.**
- **Hana** (`src/render/attackFx/styles/hana.js:49–53`):
  - Every shot draws her gold streak, 0.4–0.55 long, on every tier. It is her signature cue (ATTACK_FX.md:127).
  - The shot is not skipped and has no `ownTrail`.
  - Her shots are `pierce` (`#5ab8ff`), so on high and medium every arrow also gets a blue inked ribbon, 0.78 long, beside the gold streak. That is exactly the Aoi case round 1 showed.
- **Marumi** (`src/render/attackFx/styles/marumi.js:113–140`):
  - Her lob is a real `shell` sim projectile (`src/sim/balls.js:150`).
  - When `ctx.q.trails > 0` (high and medium) it draws "a short warm trail of the last drawn points" (127–137).
  - It is not skipped and has no `ownTrail`, so an orange (`blast`) ribbon draws on top on exactly those tiers.
- **Proof:** I ran the real `view()` of each style through the real `Actors._syncProjectiles` (`/tmp/rvlib2/tools/hana.mjs`):

| Style | Own trail lines drawn | `skip` | `ownTrail` | Ribbon fed |
|---|---|---|---|---|
| Hana | 1 | false | false | yes |
| Marumi | 3 | false | false | yes |
| Aoi | 1 | false | true | no |

- Neither girl is in the capture squad, so the board cannot show it.
- **Fix:**
  - In `hana.view`, set `v.ownTrail = true;` as the first line; her streak draws on every tier.
  - In `marumi.view`, after `if (p.kind !== 'shell') return;`, set `v.ownTrail = true;` (or `ctx.q.trails > 0`; there are no ribbons on low anyway).
  - Add Hana and Marumi's shells to the list at `docs/VFX.md:405`.

### LOW
**LOW-1. At capacity, shapes (every slash and pulse ring) starve first, while decorative ribbons keep their room.**
- **Why:** producers take the room in frame order (`BattleRenderer.js:1146`, then 1166–1171): style segments, lightning, beams, trails, and shapes last.
- **The caps add up to about 13.7k against 8,192 on high:** segments 2,304, lightning 3,072, beams about 1,088, trails 3,360, shapes 32 × 40 × 3 = 3,840.
- Shapes grew from 2,304 at round 1 because of the 40-joint rings.
- **Node stress results:**
  - At 8,192, shapes got 1,200 of the 3,840 strokes they needed (10 of 32 rings), while trails kept all 3,360.
  - With the style segments' share taken first, shapes got nothing at all.
  - Because "the newest go", the most recent hits are the ones that lose their slash or ring.
- It only bites at extreme load: the captures peak at 1,156.
- **Fix:**
  - Run `shapes.update(d)` before `trails.update(d)` in the `vfxSafe` block, so ribbons, the most numerous and purely decorative layer, thin first. Ribbons then draw over rings and slashes, which is fine.
  - Or cap trails at `room − shapes' need`.
  - Either way, say in VFX_LIBRARY.md §5 which layer thins first.

**LOW-2. An error inside the library during a style's call turns off all 40 signature looks, not just the library.**
- **Where:**
  - `ctx.lightning.strike` (`raika.js:33`, `chika.js:120`);
  - `ctx.beams.fire` (`luna.js:58`, `miko.js:80`, `raika.js:65`);
  - `toonSlash` (`bursts.js:90–91`);
  - the toon pushes in `segments.js:193–246`.
- **What happens:**
  - All of these run under `fxSafe`, so a library bug there disposes attackFx for the battle while the library stays on.
  - The same bug then usually trips `vfxOff` through `_styled`, so one library bug costs both layers.
- It is safe (no frozen board, no lost events) and documented, so it is not a must-fix.
- **Fix:**
  - Give the styles guarded facades, for example `attackFx.ctx.lightning = { strike: (p, o) => vfxSafe(() => lightning.strike(p, o)) }`, and the same for `beams.fire` and `shapes.slash`.
  - Wrap the push loop in `Segments._toon` in a try that calls the renderer's `vfxOff` (through a `ctx.vfxError`) and falls back.
  - Then update the Errors line.

### NIT
- **NIT-1. Base Akane loses the ribbon.** `akane.js:41` sets `ownTrail` for every shot, but her own puffs exist only from P2 T3 or with P1 progress or accent (56–67). Her base fireballs now have only the actors' default embers, while other fireball shots get embers and a ribbon. Fix: move the flag below `p2` and set `v.ownTrail = p2 >= 3 || lookAt(lk, 1) >= 1 || lk.accent[1] >= 1`.
- **NIT-2. One frame of partial strokes on an error.** If a layer throws mid-update, the strokes already pushed that frame are still uploaded, so a line can show ink-only for one frame (`BattleRenderer.js:1166–1174`). Fix: note `strokes.count` before the block, and on error truncate back to it (a `strokes.truncate(n)`).
- **NIT-3. `strokes` is outside the guard.** `strokes.begin`, `hold`, `setPixel` and `end` (`BattleRenderer.js:1097`, 1172–1174) run outside any guard. A throw there would still escape `renderer.update` every frame, the M1 failure mode. They are trivial today. Fix: run them inside a `vfxSafe` too, and hide `strokes.mesh` in `vfxOff`.
- **NIT-4. Lightning and segments trim per segment, not per line.**
  - At the room limit, the newest bolt can stop short of its target (`lightning.js:261–264`), and a zig-zag segment can keep only its first parts (`segments.js:200–203`). Layers are always kept, so this is cosmetic.
  - The docs ("drops whole lines", `VFX.md:351`, `VFX_LIBRARY.md:115`) should say "whole segments" for these two, or trim at bolt and segment boundaries.
- **NIT-5. ATTACK_FX.md does not mention `ownTrail`.**
  - `docs/ATTACK_FX.md:47` lists the projectile view without `ownTrail`.
  - Line 143 tells style authors to "draw trails" in `view()` but not to set `ownTrail` when they do. A new style will double up again.
  - Fix: add `ownTrail` to the view list, plus one sentence in the hooks paragraph.
- **NIT-6. The M2 test cannot catch a missing flag.** `vfx-library-guard.test.js:51–57` only checks index.js and actors.js by regex, which is why Hana and Marumi slipped through. No test pins L5 either. Fix:
  - Add a behaviour test that runs every style's `view()` with a recording stub `ctx`: a non-skipped shot that draws a line or puff behind itself must set `ownTrail`.
  - Add a test that fills a small strokes buffer and checks that every drawn line has all its layers.
- **NIT-7. Impact lines draw only for beams still in `DRAW`** (body on; `beams.js:327–338`).
  - With today's presets the lines (0.15 s) end before the body (at least 0.22 s after the hit), so nothing is lost.
  - A preset with longer lines would be cut. Fix: keep finished beams in a second list for their lines, or add a test that `lines.life ≤ punch + hold + fade` for every preset.

## Owner calls (not code defects)
Round 1's list:
1. **Still stands.** With attack FX off (the "plain look"), the library and trails still apply. CONTRACTS now says so.
2. **Still stands.** Raika's Forked-path cue (+1 fork) disappears on low and on a busy board.
3. **Still stands.** Medium and low get +1 draw call.
4. **Still stands.** On high with bloom, chain and lance bodies wash out toward pale yellow or lilac and the ink fades. This also makes Luna's T5 tint hard to see on high.
5. **Partly stands.** Aoi's blue tubes are gone (her shots have no ribbon now). Other ribbons, for example the pink ones, are still bold on phones and cross enemies.
6. **Still stands.** Solid beams hide the enemies on their line for about 0.28 s.
7. **Still stands.** Long chain hops read like a zig-zag wire.
8. **Still stands.** Scope: Seiran's chain stays the old zig-zag in toon strokes; Luna's held moonbeam and the ability lines stay soft; the pulse has lost its soft ground disc.

New:
9. Which effects thin first under extreme load (LOW-1) is a priority choice: hit feedback (rings, slashes) or decoration (ribbons).
10. Shipping: this branch has no patch note for the library. The tornado has a draft at `docs/review/vfx-tornado/patch-note.md`. One is needed at the top of `src/data/patchNotes.js` when it goes to main.
11. Review gate: this is round 2. Under HANDOFF §6, round 3 is the last before "not approved".

## Must-fix list
- **MF-1 (finishing M2):**
  - Set `v.ownTrail = true` in `hana.view` (`src/render/attackFx/styles/hana.js:49`).
  - Set it in `marumi.view` for her shell after the kind check (`src/render/attackFx/styles/marumi.js:113–114`).
  - Add both to the list at `docs/VFX.md:405`.
  - Strongly recommended in the same change: NIT-5 (ATTACK_FX.md) and NIT-6's per-style behaviour test, so this cannot recur.

Scratch evidence is in `/tmp/rvlib2`:
- lab renders: `lab/hub-high.png`, `lab/rings.png`, `lab/luna-t5.png`;
- crops: `crops/`;
- scripts: `tools/stress.mjs` (budget), `tools/gc.mjs` and `tools/gc-old.mjs` (allocations), `tools/hana.mjs` (MF-1 proof);
- logs: `vitest-render.log`, `build.log`, `smoke-1280.log`.

I changed no tracked files.
