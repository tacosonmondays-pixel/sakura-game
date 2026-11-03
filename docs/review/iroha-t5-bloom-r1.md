# Review r1: Iroha T5 bloom fix (fix/iroha-t5-bloom @ 4e7a51cd vs main f341de67)

Independent reviewer, look and logic. Review only: nothing on the reviewed branch was changed.

## Verdict: NOT OK

The bloom fix works, and the logic is sound. One visual defect needs fixing first (F1): her new lilac landing draws
its 4 impact lines all on one side, as a half fan. The fix is one line. Everything else is OK or Low.

## What I checked

### Logic

- **Other girls' beams are unchanged.**
  - Callers of `fx.beam`:
    - rosterFx mirrorGlint and mirrorBounce (changed, Iroha).
    - rosterFx drum (`COL.drum`, no preset).
    - BattleRenderer generic `beam` events (no preset).
  - With no preset and no `impact`, `fx.beam` builds `{ width, color }`, as on main. The fallback path still spawns
    both end glows.
  - Callers of `beams.fire`:
    - luna.js (`moon`), miko.js (`holy`) and raika.js (`storm`).
    - `fx.beam`, and `beamDemo`.
    - None of these pass `impact`, so it defaults to true.
  - `IMPACT.lines.count` was already 8 on main. laser, moon, holy and storm spread `IMPACT.lines`, so they keep 8.
  - `raysOf` = `min(tier.lines, count ?? 8, 8)`, the same as main for every old preset.
- **`impact: false`.**
  - `rec.land = false`. `raysOf` then returns 0, so there are no impact lines.
  - `quads` returns right after the muzzle, so there is no star, ring, scorch or sparks. The muzzle still draws, which
    is right.
  - The hit step skips `api.flashGate`, so `hitK` stays 1. Nothing bright draws, so asking the guard nothing is
    correct: a quiet beam does not use up flash budget.
  - The new test checks that the gate is not called and that there are no ground quads.
- **`landFree`.**
  - It writes into a fixed ring of typed arrays (8 slots) and allocates nothing per call.
  - It handles a clock reset: an entry is only blocking when `time >= g.t[i]`, so an earlier time never blocks. This
    is tested.
  - It uses `RosterFx.time`, which only advances in `update(dt)` (the visual clock), not the sim clock.
- **Sim untouched.**
  - There is no diff under `src/sim` or `src/online`.
  - `simId()` = **e4001588f40b**, equal to main and `KNOWN_SIM_IDS[17]`. No `COOP_PROTOCOL` bump is needed.
- **VFX rules.**
  - There is no `Math.random` under `src/render`; vfx-random.test passes.
  - The bright additive star still goes through `flashGate` when it lands.
  - The mirror preset has `hdr: 0`, and none of its colours are near-white.
  - Reduce motion: the beam layer's existing handling applies, with no impact lines and still sprites. `landFree` is
    independent of it.
- **Ally copy.** `preset: own ? 'mirror' : null`, so an ally's copy is fired with `COL.mirrorAlly` (#bfe6ff) through
  the tinted laser. That is main's look. It is tested, and I confirmed it on screen (see below).

### Tests

`npx vitest run --maxWorkers=2 tests/render tests/models`: **80 files, 1078 tests, all pass.**

### Look (reproduced)

**Bloom probe:** `node e2e/iroha-t5-bloom.mjs --frames 8 --debug` on 4e7a51cd, at 844x390, high quality, with
swiftshader.

| frame | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| near-white | 334 | 328 | 640 | 172 | 208 | 232 | 438 | 420 |

- **Summary:** min 172, median 334, max 640, mean 347, with **0 frames ≥ 1000**.
- **Compared with the builder's numbers:** the old disc frames counted 1889–2224, and the builder's before run had a
  median of 1094 and 11/20 frames ≥ 1000.
- My median (334) is a little above the builder's after-run median (252), but it is well inside the same range: their
  after frames ran 157–914.
- `t5-clump-8-impact-frames-2x.jpg`: there is no white starburst or white disc over the clump in any frame.
- `t5-brightest-frames-4x.jpg` zooms into the brightest two frames (3 and 8):
  - What stays bright is the slime's own mint body under the purple shatter cloud, her white mirror panels, and the
    glow of the explosion.
  - There is no stacked white star or white lines, and the edges of the cloud are lilac.
- **Bloom gone over the clump:** yes.
- **The hit reads as glass:** yes, in lilac and purple, with the shard cloud carrying the hit.
- **Her mirror legs at 844x390:** clearly visible as lilac beams with a dark ink edge, and attractive. Her beam no
  longer reads as a white bar.

**Side-by-side beam landings:** I fired them through `renderer.beamDemo` / `renderer.beams.fire`, froze at the
landing, and captured at 844x390 and 1280x720. The beams are, from left to right:

1. mirror
2. moon (Luna)
3. holy (Miko)
4. the ally copy in #bfe6ff
5. main's old near-white #efe4ff laser

The files are `beam-row-844x390.jpg`, `beam-row-1280x720.jpg`, and `beam-landings-mirror-moon-holy-ally-old-3x.jpg`
(3x crops, three captures).

- **Moon, holy and the ally blue are unchanged:** each has a full, even 8-line burst in its own colours. There is no
  regression, and the ally copy keeps its blue.
- **The mirror landing is lilac and small, but lopsided:** see F1.

## Findings

### F1: Medium (look). Her 4 impact lines all fan out on one side.

- **What happens:**
  - `beams.js fire` lays out 8 rays at `i/8 · TAU` (with jitter).
  - `raysOf` now caps the count at `L.count` (4 for `mirror`), and `impactLines` draws `rec.rays[0..n-1]`.
  - So the mirror landing draws only the rays at about 0°, 45°, 90° and 135°: a half fan pointing to one side of the
    landing, never the other.
- **Where it shows:** it is plain in `beam-row-1280x720.jpg` (leftmost beam) and in the 3x sheet. It looks like a claw
  or a half star, not a glass burst.
- **Why it matters:** this fires on every one of her glints and legs, so it is her signature landing now.
- **Fix:** in `impactLines`, take the rays at an even stride:

  ```js
  const [ang, sz] = rec.rays[Math.floor((i * rec.rays.length) / n)];
  ```

  For n = 4 that gives 0°, 90°, 180° and 270° (with jitter), a balanced cross.
- **Side effect on other presets:**
  - This also evens out the medium tier (6 of 8 rays, currently 0°–225°, an older lopsided case already on main) for
    every preset. That is a small display improvement for the other girls on medium.
  - If you want to keep their exact look, apply the stride only when `n < rec.rays.length` and `L.count` is set. Either
    way, note it in the patch note.
- **Test to add:** the drawn ray angles cover both halves. For example, the ray directions sum to under 0.5 in length
  for n = 4.

### F2: Low (logic). The land ring holds 8 spots.

- More than 8 distinct landing spots inside 0.1 s evicts the oldest, so a repeat on an evicted spot lands a second
  burst.
- At T5, with three mirrors and chain ends, this is rare. The cost is one extra small lilac burst, not a white bloom.
- **Fix:** optional. Raise `LAND_RING` to 16, which still allocates nothing.

### F3: Low (behaviour, by design). The gate is shared between her legs and an ally's copy.

- An ally's blue copy that lands on a spot her own leg landed on in the same 0.1 s draws without its burst.
- This matches the spec text ("bolts arriving together on one mirror … land as one"), so no change is needed.
- **Fix:** add one clause to IROHA_MIRRORS.md saying that ally copies share the gate.

### F4: Low (evidence). The builder's Akane image is not a beam check.

- `docs/review/iroha-t5-bloom/akane-single-blast-after.jpg` shows Akane's blast, which does not use the beam layer.
- The regression check for other beam users is the moon, holy and ally capture above.
- **Fix:** none needed. Point to this review's `beam-landings-*.jpg` as the beam regression evidence.

## For the fixer

1. Apply F1: the one-line stride in `src/render/vfx/beams.js impactLines`, plus a test.
2. Optionally apply F2 and F3.
3. No sim change is involved, so the sim id stays e4001588f40b.
4. A re-review only needs the beam-landing capture and a short probe run.

## Evidence (docs/review/iroha-t5-bloom-r1/)

- `t5-clump-8-impact-frames-2x.jpg`: 8 T5 impact frames from the probe, 230x160 at 2x.
- `t5-brightest-frames-4x.jpg`: the brightest frames, 3 and 8, at 4x on the clump.
- `beam-landings-mirror-moon-holy-ally-old-3x.jpg`: landings at 3x for mirror, moon, holy, the ally blue and the old
  white, in three captures (aimed at t = 35, 60 and 100 ms; the freeze landed near the same moment each time).
- `beam-row-844x390.jpg` and `beam-row-1280x720.jpg`: the same five beams in the full frame.
