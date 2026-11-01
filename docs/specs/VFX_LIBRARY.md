# VFX library: a styled look for every attack

**Owner asks (Nov 1):**
- Research stylized VFX like the tornado.
- Build our own VFX library, starting with a styled chain lightning.
- Make laser beams more impactful, solid and styled.
- Then style all attacks.

The bold look of popular action anime is welcome as inspiration, under two house rules:
- Show and game names are never written in code, docs, commits or patch notes.
- Effects stay our own, not copies of any show's signature techniques.

Everything here is **display only**. The sim id never changes for it (`tools/simId.mjs`), and it needs no `COOP_PROTOCOL` bump.

## 1. The house style

- **Flat toon bands, not soft glows.** Every line is solid, with a crisp anti-aliased edge and no soft sprite fringe.
- **A dark ink line around bright shapes**, so a pale bolt or beam reads on a bright day board. The ink is a deep shade of the effect's hue, or its complement (violet ink under gold).
- **White-hot cores.** On high with bloom the core goes over white so the bloom glows it. The body colour stays under the grade's knee (`src/render/vfx/grade.js`) so it stays saturated. Medium and low get no full-screen pass.
- **Four beats**:
  - Anticipation: a thin line racing out.
  - Punch: it slams in wider than it stays, then settles.
  - Hold: bright bands run along it.
  - Leave: it thins, its back end chases its front, and it breaks into dashes (erosion). It never just fades out.
- **Stepped motion.** Crackle re-strikes on a beat (on twos and threes, not a smooth wobble). This is the hand-drawn feel.
- **Impacts land.**
  - At the hit: a star (flash-guarded), a burst of inked impact lines, sparks, a ring on the ground and a brief scorch.
  - Big moments keep the existing hit-stop and impact frames (`docs/VFX.md` M1).
- **Elemental flourishes** in the style of woodblock prints: brush-stroke water curls with white foam, flame swirls with ink outlines, petals. A dark-energy variant has a near-black body with a coloured rim.
- **Readability first.** Enemies, the road and health bars stay readable. Covering effects stay thin or leave quickly.

## 2. What the library is (`src/render/vfx/`)

| Piece | What it does |
|---|---|
| `strokes.js` | **Toon strokes.** A capsule between two points: round caps, a crisp edge, layered ink, body and core. It also handles a leader head, a chasing tail, erosion into dashes, bright bands running along, and a soft glow kind. Every styled line of a battle shares **one instanced draw call** (begun and ended with the sprite batches each frame). |
| `lightning.js` + `lightningPresets.js` | Chain lightning. It covers zig-zag hops with long diagonals and short jogs, forks, a leader that races to each target, the stepped re-strike, erosion, and at every hit a star, sparks and a ground ring. Presets: storm, sakura, arcane, tesla. |
| `beams.js` + `beamPresets.js` | Beams, in the four beats above, with impact lines, a muzzle flare and a scorch. Presets: laser (any colour, tinted), moon, holy, storm (zig-zag). |
| `tornado.js` + `tornadoPresets.js` | The column of rings. Prototype on `feature/vfx-tornado`, in review. |

**Rules every piece follows:**
- Presets are plain data.
- Graphics tiers: low has no forks, impact lines, sparks or running bands.
- Reduce Motion: no punch, re-strike, flicker, chasing tail or turning sprites; half the sparks.
- The flash guard (`src/render/vfx/flashGuard.js`) applies to stars and flares.
- Randomness: seeded visual random (`createVisualRandom` forks), never `Math.random`. Timing comes from the visual clock.
- The impact-frame hold covers both frames.
- Dev-only lil-gui labs: `?tornadoLab`, `?lightningLab`.

## 3. Research notes (techniques)

The sources are listed in the owner chat of Nov 1.

- **Lightning.**
  - Midpoint displacement or a zig-zag of offset joints. Fully random offsets look too jagged, so limit neighbours and use a long-short step for drawn diagonals.
  - Forks: shorter, thinner paths from random joints.
  - Re-split the path every few frames instead of scrolling a texture. Lightning stays put once it anchors.
  - The glow comes from bloom on a bright core.
- **Alpha erosion.** Animate a threshold through a noise, so the shape breaks up instead of fading.
  - Subtract, don't multiply.
  - A hard step is the toon edge (anti-aliased through screen derivatives).
  - Erosion noise is data (linear, not sRGB).
- **Stepped ramps** (nearest filter) for flat toon bands.
- **Phases.** Anticipation, impact, dissipation.
  - Instant effects skip anticipation and open at full intensity.
  - Dissipation sits on its own layer so durations can change.
- **Shapes and timing.** Big, simple shapes with thick and thin lines; snappy timing.
- **Impact frames.** A high-contrast frame at the impact. Hit-stop runs a few frames. Motion lines appear a frame before the hit.
- **Slashes.** A flat crescent (a sliced cylinder) with a panning texture, or a ribbon trail. Ground cracks are decals scaled on spawn.
- **Shockwaves.** A flattened ring with panned noise. Distortion is high-tier only.
- **Trails.** A camera-facing strip from a short history of positions. u runs along its length for the taper and fade.
- **Magic circles.** Polar coordinates: length for the radius, atan for the angle. A pattern repeats round the angle, with distance-field rings.
- **Toon explosions.** Puffs with stepped lighting and erosion, a flash core and debris.
- **Assets and licences.**
  - Allowed: CC0 assets only (e.g. the CC0 particle and smoke packs) and MIT code (e.g. webgl-noise).
  - Excluded: GPL code (the GLSL function library LYGIA). Three.js dropped its old lightning-strike geometry from the addons at r153, so ours is hand-written.
  - Generators only ever receive the game's own art.

## 4. Every attack, and the batch that styles it

**Inventory (`src/data/units.js` behaviours):**

| Behaviour | Count |
|---|---|
| projectile | 13 |
| pulse | 5 |
| beam | 3 |
| duel | 2 |
| chain | 2 |
| wheel, trap, sweep, stream, spin, spikes | 1 each |

There are also 40 per-girl attack styles in `src/render/attackFx/styles/`, plus the hero's attacks and the abilities (`src/render/abilityFx.js`).

**Batches:**

| Batch | What gets styled | Status |
|---|---|---|
| B1 | Strokes; chain lightning (Raika, Chika's Tesla Tower, Storm Lance, every default chain); beams (Luna's moon lance, Miko's holy ray, Raika's Overcharge lance, every default beam) | On `feature/vfx-lightning` |
| B2 | The shared segment pool (`src/render/attackFx/patterns/segments.js`) drawn as toon strokes. Every style's tracers, thrust lines and zig-zags go solid at once. | On `feature/vfx-lightning` |
| B3 | Projectiles: a short toon ribbon behind every shot in flight (`src/render/vfx/trails.js`: ink, its element colour, a white core; tapered, dashed at the tail; pulled in after the shot lands; none on low). Next: inked toon heads and impacts with a star and impact lines. | Trails on `feature/vfx-lightning` |
| B4 | Slashes and sweeps: crescent strokes (an arc of tapered capsules) with ink and erosion (`src/render/vfx/shapes.js` `slash`: every default slash, and the six styles' own: Kage, Kinu, Luna, Ruri, Wakaba, Yoriko). Next: sweeps, ground cracks. | Default slashes and the six styles' slashes on `feature/vfx-shapes` |
| B5 | Pulses, shockwaves and spikes: ground rings as stroke circles that burst out, thin and break into dashes (`shapes.js` `shock`: every default pulse). Next: the six styles' own pulses, spikes. | Default pulses on `feature/vfx-shapes` |
| B6 | Blasts: the toon explosion (stepped puffs, erosion, star, impact lines, debris) | |
| B7 | Streams (held flame), wheels, spins, traps and duels, each to its own shape | |
| B8 | Signature abilities: one column-class effect per girl. Akane's fire tornado is built; Rei's sakura tornado is suggested next. | |

**Each batch:**
- Display only, with the sim id unchanged.
- Tiers, Reduce Motion and the flash guard.
- Tests, lab shots and a real-battle board (all tiers, 390x844 and 1280x720).
- An independent review, then the owner's go before `main`.

## 5. Budgets

- **Strokes.** One draw call for every styled line, none while nothing is up. Up to 8192 strokes a frame. Every layer checks the room left before it draws and drops whole lines (the newest first; lightning and the styles' segments whole segments), so a line is never cut to its ink. The layers take the room in frame order (the styles' segments, lightning, beams, slashes and rings, then the ribbons): under extreme load the decorative ribbons thin first. Lightning thins itself on a busy board long before that (fewer kinks, no forks), and every layer has its own cap: lightning 3072 / 2048 / 1024 by tier, 160 / 90 / 0 trails, 32 / 24 / 16 slashes and rings.
- **Sprites.** Stars, sparks and rings use the existing batches and their limits.
- **Full-screen passes.** Medium and low add none. High adds nothing beyond the existing bloom and grade.
