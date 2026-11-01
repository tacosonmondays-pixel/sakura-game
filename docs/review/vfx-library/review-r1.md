NOT OK

Review of `git diff bf561a8e 19566b4f` on `feature/vfx-shapes`: 33 files, 13 commits. Two must-fix items. The new layers have no error isolation, and the new projectile ribbon doubles up with the trails that about ten attack styles already draw. Every gate passes. The visuals are good.

## Gates
1. **Sim id: pass.** It prints `e4001588f40b`. None of the 92 files `tools/simId.mjs` hashes is in the diff.
2. **`nice npx vitest run tests/render`: pass.** 60 files, 675 tests, all green. No timeouts, so nothing was rerun.
3. **Prod build: pass.** `nice npx vite build --outDir /tmp/rvlib-dist` built OK.
   - No file contains `lil-gui`, `mountLightningPanel`, `Lightning lab`, `lightningLab` or `lightningPanel`.
   - The library itself is in the bundle (`toonStrokes` is found).
   - `/tmp/rvlib-dist` is deleted and the worktree is clean.
4. **Board: pass.** `docs/art/previews/vfx-library-board.jpg` is 276,166 bytes (1402x1030 JPEG). It is built from the game's own lib3 Sandbox frames. No third-party images.
5. **Content: pass.**
   - I scanned the diff and all 13 commit messages against about 150 show, game and technique names. No hits; the only match was "eren" inside "BattleRenderer".
   - "arcane" was already game vocabulary before this branch ("Arcane Focus", "Arcane Caster").
   - No depiction changes. No player names.
6. **Display only: pass.**
   - No new module reads or writes sim state. Only the dev-only lightning panel and the capture tool read the sim's enemies and map size, for positions.
   - No `Math.random` anywhere in the diff.
   - Randomness comes from `vrand.fork('lightning')`, `vrand.fork('beams')`, `ctx.rand` (the attack-FX fork), and sequence counters or deterministic hashes. Timing comes from the visual clock.

**Extra: smoke e2e passes.** `nice node e2e/smoke.mjs --viewport 1280x720`: ALL SMOKE CHECKS PASSED (227 checks).

## Checked and fine
- **Begin/end window:** every producer pushes inside it.
  - Segments push in `attackFx.update` (`BattleRenderer.js` 1112); lightning, beams, trails and shapes push at 1130–1133.
  - The event-time entry points only record: `fx.chain`/`beam`/`slash`/`pulse`, the styles' `onChain`/`onBeam`/`onImpact`, and `trails.feed` inside `actors.sync`.
  - A push outside the window is silently dropped (wiped at the next `begin`, never drawn). It does not throw.
- **Impact frames: both are covered.**
  - `impact.start` runs in `handleEvents` (`feel.impact` from 825 and 1007), before `strokes.hold(impact.active)` at 1134.
  - Frames 1 and 2: `end()` keeps the mesh hidden before `impact.begin()`, so `_apply` never adds it to the hidden list.
  - Frame 3: `hold(false)` shows it again.
- **Flash guard:** gates the lightning star (once per hop), the beam star and the muzzle flare. Rings and impact lines scale with that result.
- **Reduce Motion:**
  - Lightning: no re-strike or core flicker, still star, half sparks, fade ×1.6.
  - Beams: no overshoot, still bands, no tail chase, no impact lines, no zig-zag re-strike, no sweep, still sprites.
  - Shapes: no slash sweep or tail chase; the ring grows linearly and lives ×1.3.
  - Segments: no flicker or re-jitter. The old soft path flickered even under Reduce Motion, so this is an improvement.
  - Trails: 30% shorter.
- **Tiers:** low has no forks, sparks, ground rings, bands, impact lines, scorch or trails.
- **Quality switch mid-battle:** `applyQuality` calls every `setQuality`, then `applyGlow`, which calls `setGlow` and sets `ctx.bloom`. Trails clear on low. Live items adapt.
- **Dispose:** complete; no leaks found.
- **Fallbacks:** every style edit keeps its old path when the layer is absent.
  - Raika, Chika, Luna and Miko keep their old branches; `toonSlash` returns false without shapes; segments without strokes keep the soft quads; `fx.*` fall back to the old drawing.
- **Start points:**
  - Raika's chain and lance start at `hand()`.
  - Chika's chain starts at `HALO_H`.
  - Luna's lance starts at her moon `M`, and her sweep still slides. Miko's ray starts at her mirror `MIR`.
  - The default `fx.chain`/`fx.beam` start at the girl's lifted height.
- **Forked path:** +1 fork, so 3 on high and 2 on medium (0 on low).
- **The six slash styles:** each falls back to its sprite, and the crescent bulges the same way as the sprite.
- **Skipped projectiles:** get no ribbon (`feed` runs after `if (v && v.skip) continue`).

## Findings

### MUST-FIX

**M1. No error isolation for the new layers.**
- **Where:**
  - `BattleRenderer.js` 1130–1133: the lightning, beams, trails and shapes updates are not wrapped.
  - `actors.js` 659: `trails.feed` runs inside `actors.sync`, which is not wrapped.
  - `fx.js` 339, 358, 370 and 400: the hand-offs to shock, beam, strike and slash run inside `handleEvents`' switch, which is not wrapped.
- **What happens:** an exception there throws out of `renderer.update` after `sim.drainEvents()`.
  - The controller (`controller.js` 1298–1302) logs "[battle] render failed" and uses `events = []`.
  - That frame is not drawn. Its events are lost: audio, HUD, damage numbers, the titan tracker. Only won/lost survive, through `settleFinished()`.
  - A persistent fault (for example a stuck record in a layer's live list or the trails map) freezes the board every frame. The battle is unplayable.
- **Precedent:** the tornado has `tornadoSafe` (`BattleRenderer.js` 313–327), documented under "Errors" in `VFX.md` and tested (`vfx-tornado.test.js:229`). Attack FX have `fxSafe`.
- **Fix:**
  - Add `vfxSafe`, modelled on `tornadoSafe`, around the four updates.
  - On the first error: clear the four layers; set `fx.lightning`, `fx.beams`, `fx.shapes` and `actors.trails` to null; set `attackFx.ctx.lightning`, `.beams`, `.shapes` and `.strokes` to null. Everything then falls back to the old look. Log once.
  - Wrap the four `fx.js` hand-offs and `trails.feed` in try/catch so they fall through to the old drawing.
  - Add a source test like the tornado's, and an "Errors" line in `VFX.md`.

**M2. The projectile ribbon doubles up with the styles' own trails.**
- **Where:** `actors.js` 659 feeds every non-skipped projectile. These styles draw their own streak in `view()` and are not skipped:
  - Aoi: her signature white fletch streak (`aoi.js:56`).
  - Kage: a deliberately dark shadow streak plus puffs (`kage.js:80`).
  - Kinu: needle shaft and red thread (`kinu.js` 96, 102, 111–112).
  - Iroha: plum trails (`iroha.js` 202–203).
  - Ruri (`ruri.js:43`) and Yoriko (`yoriko.js:54`).
  - Hikari at T5 (`hikari.js:85`).
  - Chika's drone bullets (`chika.js:97`) and Yuzuha's sentry shots (`yuzuha.js:82`).
  - Puff trails: Akane, Yuki, Nami.
- **What it looks like:** it shows in every lib3 frame.
  - Aoi's arrows carry an inked blue ribbon (her element colour) with the white streak 2–3 px beside it. The ribbon follows the drawn path; the streak follows the sim velocity. See `1280x720-high-chain-storm-f192` around (470–500, 380–400).
  - On phones the ribbon reads as a blue tube.
  - Several girls' signature trails are muddled.
- **Fix:**
  - Add `pv.ownTrail = false` next to `pv.skip = false` (`attackFx/index.js:383`), and set it to true in those styles' `view()`.
  - In actors: `if (this.trails && !(v && v.ownTrail))`.
  - Alternatively, let the style pass its colour and length to the ribbon and drop its soft streak while ribbons are on (keep it on low).
  - Add a test: a styled shot with its own streak gets no ribbon; a plain shot gets one.

### LOW

**L1. Beams are layered per beam, not per layer** (`beams.js` 144–178, called at 329).
- Luna fires three lances from one point each attack. The later lances' ink cuts across the earlier lances' bodies at the hub (lab render).
- Fix: push all inks, then all bodies, then all cores, as lightning, trails and shapes already do.

**L2. Strokes draw after the additive sprites** (strokes renderOrder 24, `bbA` 21), so sprites on a styled line are covered.
- Luna's "star dots racing out along the beam" (`luna.js` 71–80) are completely hidden under the moon lance. I confirmed this in a lab render with and without the beams.
- Her end star (`luna.js:81`) and Raika's end flash sit under the beam's end cap.
- Fix: skip them when `ctx.beams` draws (the running bands and impact star replace them), or draw them after the strokes.

**L3. Doubled flashes and scorch on styled beams.**
- Luna (end star, moon flash), Miko (mirror flash and star) and Raika's Overcharge (end flash, `stain`) keep their own flashes. The beam adds its own muzzle flare, star, impact lines and scorch.
- That is two flash-guard entries per end, and two scorches for Raika.
- Fix: drop the style's own versions when `ctx.beams` fires, or add `{ star: false, scorch: false }` options.

**L4. Luna's tier cues no longer reach her lance.**
- The P0 width growth (`w`, `luna.js:46`) and the T5 sheath colour (`luna.js:47`) are only used on the fallback path.
- Fix: pass a width scale and colour to `fire`.

**L5. At capacity, producers stop mid-layer.**
- When the 8192 strokes fill, producers stop partway through a layer (`lightning.js:291`, `beams.js:176`, `trails.js:182`, `shapes.js:175`, `segments.js` `_toon`).
- Late producers (trails, then shapes) then draw ink-only dark lines, not the "thin out" the docs promise.
- The per-layer caps add up to about 12k: trails 3360, lightning 3072, segments 2304, shapes 2304, beams about 1088.
- Fix: per-producer budgets, or a room check that pushes all three layers of a line or none. Expose `strokes.count` and `strokes.refused` in `renderer.vfx` so captures can see the load.

**L6. Per-frame allocations and hex parsing in hot paths.**
- `lightning.js`: `:218` arrays per hop; `:248` a `filter`; `lin()` = `new THREE.Color(hex)` per hop per frame at `:319`, `:343`, `:350`, `:359`.
- `beams.js`: 144–148, 190–191, 203, 237, 248, 256, 262, 270.
- `trails.js`: `:94` `splice`; `:196` entry destructuring; `path()` computed three times per ribbon per frame.
- `shapes.js`: 135–136, `joints()` and `beats()` three times, with `beats()` allocating each time.
- `strokes.js:184`: `Object.values` every frame.
- Minor GCs per 1000 steady frames (node): baseline 3; lightning (about 6 live bolts) 63; beams 50; shapes 67; trails (80 ribbons) 189.
- Fix: cache linear colours per record at fire time, compute each item once per frame, use a ring buffer instead of `splice`, iterate `live.values()`.

**L7. The low-tier shockwave is a visible 12-gon at real radii** (`shapes.js` 20–22, 99–106; `1280x720-low-shapes-f232`, lab low row).
- Fix: joints from the radius, e.g. `clamp(round(r×10), 12, 32)`.

**L8. The dev lab's colour edits never apply** (`lightningPanel.js` 47–50).
- `strike()` caches `bolt.col` from the original preset (`lightning.js:182`); the panel only swaps `rec.p` afterwards.
- `VFX.md` promises live tuning. Fix: recompute `bolt.col` when `rec.p` changes.

**L9. Docs drift.**
- `CONTRACTS.md:2148` says "`settings.attackFx === false` restores the plain look". The default path now uses the library and trails regardless.
- `VFX_LIBRARY.md` §4 B4 status says only "Default slashes", but the six styles' slashes are in too.
- `VFX.md` says the chain "arrives within `CHAIN_SPAN` (0.24 s)". The last hop starts within that and lands about 0.05 s later.
- Add the "Errors" line after M1.

### NIT
- **N1. Half the edge anti-aliasing is cut off** (`strokes.js` 59/61). The quad is exactly w wide, so the outer half of the AA ramp is clipped (coverage 0.5 at the edge). MSAA hides this in battle; it shows without MSAA. Fix: pad the quad by about 1.5 px.
- **N2. Edges come out slightly too light** (`strokes.js` 109–110). Colour is premultiplied before `colorspace_fragment`, so AA edges and partial alpha (core flicker 0.72, impact lines at 0.3) are too light on medium and low. Fix: convert first, then premultiply.
- **N3. Band phase can break in long sessions** (`strokes.js:105`). It uses `uTime × bandSpeed`; on mediump-only GPUs long sessions break the bands. Fix: wrap time on the CPU.
- **N4. Wide rings dip into the ground** (`shapes.js:67`, y = 0.06). Shock rings are camera-facing, so with the ≈55° camera the lower edge of the widest rings is clipped by a few %. Fix: lift by half-width × cos(pitch).
- **N5. The fallback path's random stream shifts** (`segments.js:73`). `Segments.add` draws an extra `ctx.rand()` even on the fallback path. Harmless.
- **N6. The capture's shapes event misses the enemies** (`capture.mjs` shapes event). It uses median x and median y separately, not the nearest enemy its comment promises. The slash and ring landed on the pond in every config, so the board never shows them over enemies or the road.
- **N7. Board placeholder text is clipped.** "not captured (timeout" is cut at the tile edge on both phone-high placeholders.
- **N8. Toon slashes are not counted by the flash guard.** The old additive slash sprites were (`fx.js` 184–189). That is fine since they cover rather than add light, but `VFX.md` should say so.

## Visuals
- Zoomed real-battle frames at both viewports and all three tiers, plus lab renders. Lab renders cover the evidence gap: high at phone pixel scale for shapes, and a three-lance hub with MSAA off.
- **Look:** chains, beams, impact lines, slashes, rings, ribbons and segment lines read solid, inked and styled.
- **Readability:** enemies, road and health bars stay readable. Health bars are in the overlay batch, which draws over the strokes.
- **Joints:** clean within each producer. At 6× zoom with the core at 0.72 alpha there are no joint dots.
- **Flash risk: none found.**
  - Stars and flares are gated.
  - The 20 Hz re-strike and the 10 Hz segment flicker are thin lines over small areas; the old `chainBolt` already re-jittered every frame.
  - Reduce Motion removes both.

## Perf
- **Draw calls:** +1 while anything is up. lib3 call counts (high 239–249, medium 152–165, low 87–95) are in line with the pre-library tornado board (about 245, 161, 95). Not a controlled A/B.
- **CPU (node microbench on this loaded box: stroke pushes plus upload bookkeeping, no GPU time):**

| Load | Strokes per frame | CPU per frame |
|---|---|---|
| Typical | 800–1,200 | 0.48–0.63 ms |
| Busy | about 3,200 | 0.45 ms |
| Trails only (160 ribbons) | about 3,300 | 0.46 ms |
| Worst (160 ribbons, 24 six-hop bolts, 32 zig-zag beams, 32 shapes) | about 6,800 | 1.45 ms |

- Phones are maybe 3–5× slower, so the worst case is roughly 4–7 ms.
- **Upload:** 96 bytes per stroke per frame, about 0.3 MB at 3,300 strokes and 0.65 MB at 6,800.
- **Memory:** about 768 KiB CPU plus the same on the GPU for the 8192-stroke buffers.

## Owner calls (not code defects)
1. With attack FX off (the "plain look"), the styled library and trails still apply.
2. Raika's Forked-path cue (+1 fork) disappears on low and on a busy board. The old code showed node forks on every tier.
3. Medium and low get +1 draw call. M1 promised phones no new draw call; the library spec allows one.
4. On high with bloom, chain and lance bodies bleach toward pale yellow and the ink fades. Medium reads more "inked".
5. The minimum width on phones makes ribbons bold; Aoi's volleys look like blue tubes.
6. Solid beams now hide the enemies on their line for about 0.28 s (the old beam was additive).
7. Long chain hops read like a zig-zag wire, because the kink size is capped on long hops.
8. Scope:
   - Seiran's chain stays the old zig-zag segments, now in toon strokes (no lightning-layer forks or stars).
   - Luna's held moonbeam and the ability layer's lines stay soft.
   - The pulse has lost its soft ground disc.

## Must-fix list
- **M1:** guard the four library updates (`BattleRenderer.js` 1130–1133), `trails.feed` (`actors.js:659`) and the `fx.js` hand-offs (339, 358, 370, 400). On the first error, switch the library off and fall back to the old look, logging once. Add a source test and the `VFX.md` "Errors" line.
- **M2:** no ribbon on shots whose style draws its own trail, via an opt-out flag on the projectile view (or route the style's colour and length into the ribbon). Add a test.

Scratch evidence (lab renders, crops, benchmarks, logs) is in `/tmp/rvlib`. I changed no tracked files.
