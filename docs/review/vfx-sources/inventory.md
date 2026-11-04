# VFX inventory: the tornado's house look, every effect family today, and the gaps

Read only from `/home/user/wt-ship` (live build, v0.1.73). Nothing in the repo was changed.
Sources read: `src/render/vfx/*` (tornado, tornadoPresets, lightning, lightningPresets, beams, beamPresets, strokes,
shapes, trails, impact, impactPresets, halo, grade, flashGuard, feel), `src/render/fx.js`, `src/render/abilityFx.js`,
`src/render/BattleRenderer.js` (event switch), `src/render/attackFx/` (index, registry, every style and pattern),
`rosterFx.js`, `staffFx.js`, `mirrorFx.js`, `deployFx.js`, `groundShapes.js`, `linkShapes.js`, `fallStyles.js`,
`ambient.js`, `actors.js`, `textures.js` (atlas), `docs/VFX.md`, `docs/specs/VFX_LIBRARY.md`, `docs/specs/ATTACK_SHAPES.md`,
`src/data/units*.js`, `abilities.js`, `abilityText.js`, `enemies.js`.

---

## 1. The house look: what makes the tornado look the way it does

The tornado is Akane's Starmine Barrage column (`TORNADO_CASTS['akane.starmine'] = 'fire'`), one hand-written
`ShaderMaterial`. These are the concrete techniques. A new family is "tornado grade" when it uses most of them.

### 1.1 Geometry: many simple instanced primitives, the shape built in the vertex shader
- One `RingGeometry(0.3, 1, 40, 1)` annulus, flat on the ground plane, drawn as an `InstancedBufferGeometry`.
  Every ring of every live tornado is one instance, so the whole thing is **one draw call**. The mesh is hidden while
  nothing is up, so it costs 0 calls when idle.
- Per-instance data is seven `vec4` attributes (iA–iG): position, the cast's time and how long it is fed, phase,
  seed, core flag, ramp row, r0/r1, height, twist, sway, spin, life, helix, the hole's size, alpha, hdr, noise scale,
  scroll, core heat, erosion young/old, body, core radius. The CPU only writes these numbers each frame and allocates nothing.
- **Analytic lifecycle, no particle state.** `age = fract(t / life + phase)`. A ring is born at the ground, rises to
  `height`, and widens r0 → r1 along `age^0.7`. It spins (`spin`), twists more the higher it is (`twist`), its centre
  wanders round a helix (`helix × g`) and sways on X/Z (`sway`, two detuned sines).
- **Born inside the cast only.** `vOn = step(0, born) * step(born, fedSeconds)`. The column builds from the ground up
  and leaves by rising away; it never pops in or out. `feed(rec, s)` extends it while shells keep landing.
- The hole (`inner`) is cut per pixel, not in the mesh, so one mesh serves every preset.

### 1.2 Shading: a polar noise band, eroded by a threshold that rises with age
- Per-pixel polar UV: `u = atan(y, x) / 2π + seed` (taken in the fragment, so there is no seam where atan wraps;
  whole-number u scales make the noise wrap cleanly), `v = radial share × noise.y − age × 0.9 − time × scroll`.
- A **band profile** across the ring: `band = 1 − x²` (0 at both edges, 1 in the middle).
- Noise: a tileable two-octave value-noise fBm **painted in code** into a 128² RGBA DataTexture (R: base 4 × 3 octaves,
  G: base 8 × 2). It is sampled twice (0.85 R + 0.15 G at a second scale and scroll) and pushed through
  `smoothstep(0.25, 0.75, n)` for fewer, bolder tongues. No image files.
- `heat = band × (0.3 + n) + core × coreHeat`.
- **Erosion**: `cut = mix(erodeYoung, erodeOld, age)` (fire: 0.06 → 0.58). A young ring is a full flame band; an old
  one breaks into tongues, then wisps. The effect leaves by erosion and never by a plain fade.
- **Hard toon edge**: `m = step(cut + sparse + far, heat)`. The mask is 0 or 1, with no soft fringe, no smoothstep on
  the alpha and no `discard`; the mask multiplies the colour.

### 1.3 Colour: a stepped ramp indexed by heat above the cut
- `k = clamp((heat − cut) × 1.6, 0, 0.999) × mix(0.7, 1, front)` indexes an 8-texel ramp with `NearestFilter`, so the
  result is a few flat bands with no gradients. Fire's five bands: `#7a040b` maroon, `#de0f06` red, `#ff4106` orange,
  `#ff9f11` amber, `#ffe793` cream.
- **Ramp as ink.** There is no separate ink pass. The darkest band sits wherever `heat − cut` is small, which is the
  edge of every eroded tongue, so **every shape gets a self-coloured dark rim** and the hottest bands sit in the middle.
  This is the tornado's version of the library's "dark ink line around bright shapes".
- Ramp colours are sRGB hex exactly as drawn. They are painted as sRGB bytes into a texture with `colorSpace = SRGB`
  (decoded once on the GPU), and the shader ends with `#include <colorspace_fragment>`.
- **The camera-facing arc burns brighter** (`front = 0.5 + 0.5 × p.y/r`, so k is × 0.7 on the far arc), which makes
  the stack read as a funnel instead of a pile of plates.

### 1.4 Alpha shaping and blending: one pass for both body and glow
- Premultiplied blending (`One, OneMinusSrcAlpha`), `depthWrite` off, `depthTest` on, `DoubleSide`, `toneMapped: false`,
  `renderOrder` 22.
- **Medium and low:** `rgb = col × a × alpha` and `alpha = a × body`. The cooler bands cover the board a little
  (`body` 0.55), so the colour reads on a bright day board. The band at k ≥ 0.8 has alpha 0: it is pure added light.
  So one draw call gives a toon body and a glow. On the canvas, sRGB-encoded overlaps overshoot, so the stacked yellow
  goes lemon and the cream goes white.
- **High ("cover"):** every band covers in its own colour, so there is no red-over-green murk. The far arc erodes
  harder (`COVER_FAR_ERODE` 0.4) and is fainter (`COVER_FRONT` 0.45 / 0.85), so what stands behind stays visible.
  With bloom on, the linear composer would lose medium's overshoot, so high reads a second ramp row where each band is
  × `COVER_GAIN` [1, 1.1, 1.25, 1.65, 1.9] in display bytes (the overshoot is baked in).
- **HDR only where it belongs:** the k ≥ 0.8 band × (1 + hdr 0.3), and only on high with bloom, so the bloom catches
  the hot core while the body stays under the grade's knee (`grade.js` KNEE 0.82) and stays saturated.
- **Readability rules in the alpha:** a fade in over the first 10 % of a ring's age and out over the last 18 %. Young
  rings, which sit at walker height, cover little (`smoothstep(0.12, 0.45, age)`, `COVER_YOUNG` 0.35), and the near arc
  covers less (`mix(1, 0.45, front)`), so the crowd and their HP bars stay readable through the column.

### 1.5 Layering: a column, a ground ring and embers, all cheap
- The main rings, plus **4 faint core rings** on high (a narrower bright inner column: radius 0.45, heat +0.12, alpha × 0.18).
- **Ground glow**: a `ringSoft` and a `ring` sprite in `groundA`, pulsing (`base.pulse` Hz) and turning in opposite
  directions. These are a few quads in the existing batch.
- **Embers**: an analytic spiral with no state (born inside the cast; rising, widening and fading near the top) in
  `bbA` (additive sparks) or `bbN` (petals: `additive: false`). Each preset names its own sprite and three colours.
- The strength envelope `strength(rec)` (0 → 1 over half a life, back to 0 after the feed ends) drives the ground quads.

### 1.6 Motion
- Fast, whole-column spin (3.2 rad/s on fire), extra twist with height, helix wander, sway at 1.3 Hz, noise scrolling
  along the rise. Rising, widening and eroding together make the classic "flame licking upward".
- Time comes from the visual clock (`update(dt)`), so hit-stop holds it. Randomness comes from `vrand.fork('tornado')`
  (never `Math.random`, never the sim). Impact frames hide the mesh for both frames (`hold()`).

### 1.7 How the tiers degrade (`TORNADO_TIERS`)
| | rings | core rings | embers | blend | hdr |
|---|---|---|---|---|---|
| high | 22 | 4 | 12 | cover (own colours, far arc thinner) | k ≥ 0.8 band, bloom only |
| medium | 13 | 0 | 6 | add + light body | none |
| low | 8 | 0 | 0 | add + light body | none |

- High has more rings, so each is **sparser**: `uSparse = SPARSE_ERODE × (1 − 13/22)`. It applies to the mask only,
  never to the colour index, so high is never darker and never denser than medium (lab measured: lemon share 0.13 vs 0.12).
- At most 3 tornadoes at once (the oldest slot is reused).
- **Reduce Motion**: no spin, twist, sway, helix or noise scroll; life × 2.2 (a slower rise); alpha × 0.7; the ground
  rings and petals do not turn.
- **Errors**: `tornadoSafe` switches the tornadoes off for the battle and everything else carries on.
- **Setting**: `settings.attackFx === false` means no column at all.
- **Tooling**: presets are plain frozen data, with a `?tornadoLab` lil-gui panel (dev only) that copies presets back.

### 1.8 The shared library rules the tornado sits in (VFX_LIBRARY §1, strokes / lightning / beams)
- Flat toon bands, no soft glows. A crisp edge anti-aliased with `fwidth` (strokes) or a hard `step` (tornado).
- A dark ink line around bright shapes (strokes: an explicit ink layer pushed first; tornado: the ramp's darkest band).
- White-hot cores, over white only on high with bloom (`hdr`), with the body under the grade's knee.
- Four beats: anticipation (a leader racing out), punch (overshoot), hold (bands running along), leave (thin, tail
  chases head, erode into dashes).
- Stepped motion: re-strikes on a beat (0.05 s, "on twos"), not a smooth wobble.
- Impacts land: a flash-guarded star, inked impact lines, sparks, a ground ring and a brief scorch.
- Budgets: one instanced call per layer kind, drop whole lines when full (never an ink-only line), per-tier caps,
  nothing new full-screen on medium or low.

**In short, the house recipe:** instanced simple primitives shaped in the vertex shader from an analytic age; polar or
along-the-shape noise painted in code; an erosion threshold rising with age and cut with a hard step; colour from a
3–5 band stepped ramp indexed by "heat above the cut", so the darkest band becomes the ink rim; a premultiplied blend
where cool bands cover and the hottest band adds; a camera-facing bias; HDR only on the hottest band with bloom;
readability shaping at walker height; tier = instance count + sparser erosion; Reduce Motion = no rotation or scroll and
a slower life.

---

## 2. Inventory: every effect family the game draws today

Ratings:
- **tornado-grade**: hand-written shader or library piece that follows all of §1/§1.8 (noise or erosion, stepped
  bands, ink, tiers, Reduce Motion, lab or presets).
- **styled**: on-model toon look (toon strokes, cel puffs, painted sprites with deliberate shapes and timing) but no
  noise-eroded ramp volume, often without per-family presets or a lab.
- **generic/old**: soft atlas sprites (`glow`, `smoke`, `ringSoft`, `spark`, `disc`) that swell and fade; the default
  `fx.js` look or "ship plain, polish later".

| # | Family | Where it lives | Rating | Who uses it |
|---|---|---|---|---|
| 1 | Fire tornado column | `vfx/tornado.js`, `tornadoPresets.js` `fire` | **tornado-grade** | Akane ⚡ Starmine Barrage only |
| 1b | Sakura and cyan-vortex tornado presets | `tornadoPresets.js` `sakura`, `vortex` | tornado-grade, **unused** | nobody yet (sakura suggested for Rei's Hurricane Draw) |
| 2 | Chain lightning | `vfx/lightning.js`, `lightningPresets.js` (storm, tesla, arcane, sakura) | **tornado-grade** (line family: ink, body, core, zig-zag with skew, forks, leader, stepped re-strike, erosion, star, sparks, ground ring, tiers, `?lightningLab`) | Raika (chain), Chika T4+ Tesla Tower, Seiran hero chain and Storm Lance, every default `fx.chain` |
| 3 | Beams | `vfx/beams.js`, `beamPresets.js` (laser, moon, holy, storm) | **tornado-grade** (four beats, bands, impact lines, muzzle flare, scorch) | Luna moon lance, Miko T5 holy ray, Raika T4 Overcharge lance, every default `fx.beam` |
| 4 | Held beams (Searchlight Sweep, Moonbeam Sweep) | `attackFx/patterns/held.js`, `s5held.js` | generic/old ("ship plain": an alpha band + a thin additive core) | Umeko Moonlit Beacon (sweep), Luna Moonbeam Sweep |
| 5 | Kohaku's constant prism beam | `attackFx/styles/kohaku_tsubaki.js` | generic/old (soft outer glow + white core + tail, 1.1 Hz swell; not on strokes) | Kohaku & Tsubaki duo |
| 6 | Toon segments (tracers, thrust lines, zig-zags, mini-arcs) | `attackFx/patterns/segments.js` on `vfx/strokes.js` | styled | Shiro tracers, Kaede thrust, Yuzuha taser tails, Chika micro-arcs, Ouka gold lines, every style's lines |
| 7 | Projectile trails | `vfx/trails.js` | styled (ink, colour, white core, tapered, dashed tail, pulled in) | every shot without its own trail |
| 8 | Slashes | `vfx/shapes.js` `slash`, `toonSlash` in `patterns/bursts.js`, `patterns/streaks.js` (blade streaks, one instanced mesh) | styled | Kage, Kinu, Luna, Ruri, Wakaba (towel), Yoriko, Rei (crescent, `patterns/sweep.js`), Kaede (maple cleave streaks), Kanna, default `fx.slash` (duelists) |
| 9 | Shockwave rings | `vfx/shapes.js` `shock` (default `fx.pulse`); `patterns/rings.js` | styled (stroke ring bursting out, dashes) | Hikari, Rei, Hotaru, Noa, Umeko pulses; Raika taiko ring; Kanna drum rings; Suzu bell rings |
| 10 | Ground shapes (Bramble Road, Rising Spikes, Ripple Quake, Bell Toll) | `render/groundShapes.js` | generic/old ("ship plain": ground discs, ice star, earth ring) | Chigusa vines, Yuki T4 Shatter Point spikes, Kanna quake, Suzu toll |
| 11 | Spirit Tether | `render/linkShapes.js` | generic/old (plain quads, sag curve) | Ena, Yoriko |
| 12 | Blasts / explosions | `fx.js` `explosion` + `BLAST` (cel puff 3 grey values, seated, additive core, hard ring, cel fire puffs) | styled (M1 cel puff; no erosion, no noise, no ramp) | Akane fireball, Sango shell, Midori flask splash, Marumi balls and Glow Bowl, Kohaku/Tsubaki shards, Starmine shells, Tidebreaker, volatile enemies |
| 13 | Firework flourishes | `attackFx/styles/akane.js` (reticle, chrysanthemum star sparks, rockets + smoke) | styled sprites | Akane |
| 14 | Held flame stream (Hearth Stream) | `attackFx/patterns/held.js` | generic/old (4 alpha puffs + 1 additive core line) | Akane P1 T5 Phoenix Feather |
| 15 | Spore Mist (held poison cone) | `attackFx/patterns/s5held.js` | generic/old (cone puffs in greens) | Midori |
| 16 | Hit sparks | `fx.js` `hit` (spark + glow dots) | generic/old | every hit |
| 17 | Hit flash star | `attackFx/patterns/hitFlash.js` | styled (crisp star, anti-strobe merge) | the styled girls |
| 18 | Impact feel (hit-stop, local hold, impact frames, shake, punch, squash) | `vfx/hitStop.js`, `localHold.js`, `impact.js`, `feel.js`, `impactPresets.js` | styled (M1; frames are a navy multiply + pink silhouettes) | heavy / normal / light classes, ults, boss kills |
| 19 | Glow, grade, halos | `vfx/grade.js`, `halo.js`, `batch.js` hdr | system, not a family | everything |
| 20 | Water: orb wake, water crown splash | `attackFx/styles/nami.js` | styled sprites (ripples, crown sprites) | Nami (hero) |
| 21 | Water: muzzle spout, double shell ring, spray | `styles/sango.js` | styled sprites | Sango |
| 22 | Water: rain ripples, rain streak, splash ring | `styles/umeko.js`, `patterns/rings.js` | styled sprites | Umeko |
| 23 | Water: bottle burst (crown of drops, spokes, splash glow) | `styles/wakaba.js` | styled sprites | Wakaba |
| 24 | Water ult: Tidal Wave, Dream Detour ("tide") | `BattleRenderer` `case 'ult'` | **generic/old** (navy impact frame, map ring, sparkle, 3 `bff0ff` smoke puffs per enemy) | Nami ult, Yoriko ult |
| 25 | Water ⚡: Frost Net, Tidebreaker Shell, River Rush | `abilityFx.js` `burst` / `runner` | generic/old (cue ring + glow, a ring) | Nami skill, Sango ⚡, Ruri ⚡ |
| 26 | Ice: snowball / icicles, frost ring, shards, crystal burst, blizzard ring | `styles/yuki.js` | styled sprites | Yuki |
| 27 | Ice: freeze status | `BattleRenderer` `status` → `fx.shards`; model tint (`glbEnemy.js` STATUS_TINT) | generic/old | Yuki, Nami, every freeze |
| 28 | Ice ⚡: Whiteout | `abilityFx.js` burst | generic/old | Yuki |
| 29 | Electricity: taser darts and crackle, net catch | `styles/yuzuha.js` (segments) | styled | Yuzuha |
| 30 | Electricity: drone micro-arcs, docked coil | `styles/chika.js`, `patterns/drones.js` | styled | Chika |
| 31 | Electricity: shock status on enemies | `status` → `fx.flash` + icon + tint | **generic/old** (no crackle aura) | Raika, Chika, Seiran, every shock |
| 32 | Electricity ⚡: Drumstorm, Drone Surge | `abilityFx.js` boost / deploy | generic/old | Raika, Chika |
| 33 | Sky dragon (Dragonflight) | `rosterFx.js` (runner) | styled (mesh) | Seiran ult |
| 34 | Wind gusts and swirls | `styles/fuu.js` | styled sprites | Fuu |
| 35 | Wind ⚡: Backdraft Fan | `abilityFx.js` `fan` (5 glow sprites + white puffs) | generic/old | Fuu |
| 36 | Wind ⚡: Hurricane Draw | `abilityFx.js` boost (puff) | generic/old | Rei |
| 37 | Fletch and falcon streaks, paper crane, hawk | `styles/aoi.js`, `hana.js`, `patterns/spotter.js`, `companions.js` | styled | Aoi, Hana (+ Kaze), Shiro T5 |
| 38 | Kaze's Swoop feather strike | `abilityFx.js` `featherStrike` | styled sprites | Hana ⚡ |
| 39 | Poison: brew lob, reticle, stain, droplets, hiss | `styles/midori.js`, `patterns/markers.js` | styled sprites | Midori |
| 40 | Poison and curse: omen cards, red thread, curse bursts, hex marks | `styles/ena.js`, `rosterFx.js`, `actors.js` | styled sprites | Ena, Yoriko (hex) |
| 41 | Poison status on enemies | icon + tint + flash | generic/old | Midori, Chigusa, Ena |
| 42 | Poison ⚡: Catalyst Burst, Omen Card, Overgrowth, Puppet Hex | `abilityFx.js` strike / debuff | generic/old | Midori, Ena, Chigusa, Yoriko |
| 43 | Plants: seed-leaves, tendrils, thorn snaps, coil | `styles/chigusa.js`, `patterns/academy.js` | styled sprites and strokes | Chigusa |
| 44 | Petals | atlas `petal`; Rei flecks, Noa flick, Umeko plum rain, sakura lightning, victory rain, weather | styled sprites | Rei, Noa, Umeko, Kaede (maple leaves), Momo, Ena |
| 45 | Holy and light: Dawn Arc rays, crescent, motes, banner | `styles/hikari.js`, `patterns/sweep.js`, `motes.js` | styled | Hikari |
| 46 | Ofuda talismans, paper confetti, bells | `styles/miko.js`, `patterns/patrol.js` | styled | Miko |
| 47 | Fireflies | `styles/hotaru.js`, `patterns/motes.js` | styled | Hotaru |
| 48 | Moon and mystic: star lances, gravity swirls, motes | `styles/luna.js` | styled (lance is tornado-grade, see #3) | Luna |
| 49 | Event Horizon (pull + second blast) | `abilityFx.js` `horizon`, `horizonBlast` | generic/old (thin rings, glow) | Tenka LR Critical Mass |
| 50 | Mirror bolts, glints, afterimages, Laser Web | `styles/iroha.js`, `rosterFx.js`, `mirrorFx.js`, `mirrorPanel.js` | styled | Iroha |
| 51 | Pins, thread, heat ring with ember crown | `styles/kinu.js`, `actors.js` | styled | Kinu |
| 52 | Coins, jackpot, coin wheel | `styles/momo.js`, `fx.coin` | styled sprites | Momo, Ouka, every bounty |
| 53 | Seals, traps, bell rings | `styles/suzu.js`, `patterns/toss.js` | styled | Suzu |
| 54 | Spike strips, Spike Rain | `styles/azami.js`, `patterns/lobs.js`, `actors.js` strips | styled | Azami |
| 55 | Rolling bomb balls, ricochet, Giant Strike | `styles/marumi.js` | styled | Marumi |
| 56 | Drum shock rings, Festival Drumfall | `styles/kanna.js`, `rosterFx.js` | styled | Kanna |
| 57 | Lunges, ghosts, clones, recoil | `patterns/lunge.js`, `ghosts.js`, `clones.js` | styled | Kaede, Rei, Kage, Sango |
| 58 | Mortar warnings and shell arcs | `rosterFx.js` | styled | Kohaku & Tsubaki, Starmine |
| 59 | Generic look (muzzle flash, default hit) | `styles/generic.js`, `tenka.js`, `kogane.js`, `norika.js` | generic/old (stand-ins) | Tenka, Kogane, Norika |
| 60 | Staff props (barricades, plow, Big Yellow) | `staffFx.js` | styled (meshes) | Norika, Kogane |
| 61 | Auras: T5 aura, hand glows, pips | `render/pathLooks/` | styled (meshes) | every girl at T5 |
| 62 | Aura edges and familiars | `patterns/patrol.js` (lanterns, bells, gulls, coupons, motes) | styled | Umeko, Miko, Nami, Momo, Hikari, Luna |
| 63 | Buffs: rally sparkle, buff icons, links, Ouka stamp | `abilityFx.js` `rally`, `buffIcons.js`, `styles/ouka.js` | generic/old (sparkle) / styled (Ouka) | Hikari Morning Rally, Miko Shrine Chorus, Wakaba Time Out!, Ouka Assembly Bell, Noa |
| 64 | Debuffs: status icons, model tint, status pops | `actors.js` STATUS_ICONS, `BattleRenderer` `status` | generic/old | everyone who applies a status |
| 65 | Heals: heart pop | `abilityFx.js` `heart` | generic/old | Noa First Aid Call, Chigusa harvest, Wakaba Recovery Plan |
| 66 | Shields: enemy barrier, barrier break, shell break | model `setBarrier`; `fx.shards` + flash | generic/old | ward / barrier / crystal enemies |
| 67 | Summons and deploys: sentries, doubles, drones, nets, place puff | `deployFx.js`, `shadowDoubles.js`, `drones.js`, `fx.puff` + ring | generic/old pop (the summons themselves styled) | Yuzuha, Kage, Chika, Suzu, Azami, Iroha, any placement |
| 68 | ⚡ ability casts (generic) | `abilityFx.js` `cast` (cue ring + glow on her, then by kind) | **generic/old** | 34 of 41 abilities: Skyfall Volley, Hurricane Draw, Whiteout, Market Day, Tidebreaker Shell, Lantern Flare, Verdict Round, Catalyst Burst, Bell Carpet, Drumstorm, Shrine Chorus, Firefly Hush, Drone Surge, Critical Mass, Blade Spiral, Time Out!, Emergency Deploy, Assembly Bell, Overgrowth, Prismfall, Backdraft Fan, Star Snatch, River Rush, First Aid Call, Omen Card, Morning Rally, Moonbrand, Frost Net, Heavy Beat, Puppet Hex, Pod Salvo, Whistle Stop … |
| 69 | ⚡ casts with their own look | tornado (Starmine), lightning (Storm Lance), Kaze (Swoop), Kon (Moon Pounce), mirrorFx (Laser Web), kaede.js (Flash Lunge blade arts), azami.js (Spike Rain), marumi.js (Giant Strike), shadowDoubles (Shadow Doubles) | styled to tornado-grade | Akane, Seiran, Hana, Ruri, Iroha, Kaede, Azami, Marumi, Kage |
| 70 | Hero ultimates (map-wide) | `BattleRenderer` `case 'ult'`: impact frames + map ring + white ring + 30 sparkles + flashes or puffs per enemy | **generic/old** effect (styled feel) | Hikari Celestial Bloom, Luna Moonfall, Nami Tidal Wave, Yoriko Dream Detour |
| 71 | Local ultimates | rosterFx (Drumfall, Dragonflight), staffFx (plow, Hold the Line) | styled | Kanna, Seiran, Kogane, Norika |
| 72 | Enemy deaths | `fx.js` `death` (smoke puff, glow, dots, homeward stars), `sparkFall`, `breakdown`, `fallStyles.js` | generic/old | every kill |
| 73 | Boss kill | hit-stop + impact frame + shake + punch + ring + flash | styled feel, generic effect | 7 bosses |
| 74 | Boss and enemy attacks | `bossPhase` (ring, flash, screen flash, vignette), `sabotage` (shards + puff), `blink` (puff + flash + ring), `spawn` (red ring + purple puff), fields (`actors.js` disc + ring + pulse), boss aura (ringSoft + disc) | **generic/old** | bosses, minibosses, field casters, saboteurs, blinkers, summoners (no FX), siphon, enrage (no FX) |
| 75 | Leaks | ring + flash + screen flash | generic/old | every leak |
| 76 | Upgrades, level-ups, placement, sell, hero move | `fx.sparkle`, `fx.puff`, rings | generic/old | everyone |
| 77 | Ambient weather: petals, snow, rain, ash, embers, fog, fireflies, smoke columns | `ambient.js` | styled sprites | stage looks |
| 78 | Terrain water and lava surfaces | `terrain.js` `createWaterMaterial`, `createLavaMaterial` (hand-written shaders) | styled (environment) | water and lava maps |
| 79 | Map rules: crystal pads, forge vents, steam, star rifts, transit pads, tear, blackout | `ruleDecals.js`, `tear.js`, `blackout.js` | styled sprites / generic | Codex rules, Gate Arc stages |
| 80 | Spawn and goal gates | `ambient.js` (bouncing arrows, glowing discs) | generic/old | every map |

Counts: **tornado-grade 3 families** (tornado, chain lightning, beams), plus two unused tornado presets. Most girls'
signatures are **styled sprites**. Every "ship plain" attack shape, all hero map ults, 34 of 41 ⚡ casts, enemy
deaths, statuses and boss attacks are **generic/old**.

---

## 3. Gaps: what players see that is not yet at tornado grade

Priority:
- **high**: seen every wave or at the biggest moments, or by many girls
- **medium**: one or two girls, or a signature moment
- **low**: ambient, or rare

| Gap | What is there now | Who needs it | Priority | The tornado technique that fits |
|---|---|---|---|---|
| **Explosions / blasts** (toon puff volume, eroding) | cel puff sprite, swell + fade (#12) | Akane, Sango, Midori, Marumi, Kohaku & Tsubaki, Starmine shells, Tidebreaker, volatile enemies: dozens a wave | **high** | billboard or hemisphere puffs with painted noise, erosion rising with age, a 4–5 band ramp (ramp darkest band = ink), additive white core only; instanced, one call |
| **Water splash crown + droplets + foam** | crown, ripple and spray sprites (#20–23) | Nami (hero), Sango, Umeko, Wakaba, Ruri otter, Tidebreaker | **high** | the tornado's ring stack turned upward and short-lived: a crown of instanced rings or a cylinder band, polar noise for the lip, erosion into droplets, a blue-to-foam-white ramp (`vortex` ramp is a start), white foam band on top |
| **Tidal Wave / Dream Detour ult** | impact frame + map ring + smoke puffs (#24, #70) | Nami ult, Yoriko ult | **high** | a moving wave wall: an instanced ribbon along each path, noise-eroded crest, foam band, travels the road; tiers = segments |
| **Hero map ults: Celestial Bloom, Moonfall** | generic ring + sparkle + flashes (#70) | Hikari, Luna | **high** | Bloom: a sun disc of polar-noise petals with a stepped gold ramp; Moonfall: a descending moon disc and a violet ring stack |
| **⚡ cast looks (34 generic)** | cue ring + glow, then a ring / line / puff by kind (#68) | almost every girl; heaviest: Yuki Whiteout, Sango Tidebreaker, Raika Drumstorm, Rei Hurricane Draw, Midori Catalyst Burst, Kohaku Prismfall, Tenka Critical Mass | **high** | reuse the column (`sakura` for Hurricane Draw, `vortex` for wind/water casts), plus a cast circle (a polar-coordinate magic circle with a stepped ramp, VFX_LIBRARY §3) |
| **Held flame stream (Hearth Stream)** | 4 alpha puffs + a core line (#14) | Akane T5 (and Kinu steam stream, Yuki frost stream later) | **high** | a cone ribbon of instanced segments with along-the-cone noise scrolling outward, erosion rising with distance, the fire ramp; the closest cousin of the tornado |
| **Enemy deaths** | smoke puff + glow + stars (#72) | every kill on the board | **high** | a small toon poof: 3–5 eroding noise puffs on the ramp of the enemy's family, a star, a short ink ring; cheap per instance |
| **Electricity crackle and auras** (shocked enemies, charged girls, sentry and drone arcs) | icon + flash + tint (#31); segments for Yuzuha and Chika (#29–30) | Raika, Chika, Seiran, Yuzuha, Tenka coil bolts, shocked enemies | **high** (owner named it) | short re-struck micro-bolts from `lightning.js` round a body (stepped beat, erosion), plus an electric ring decal with polar noise; Drumstorm and Drone Surge cast looks |
| **Ice** (freeze shell, frost burst, Rising Spikes, Whiteout) | shards, frost ring, plain spikes (#26–28, #10) | Yuki, Nami Frost Net, every freeze | **high** | faceted crystal geometry with a stepped ice ramp and ink edges; frost ground decal with polar noise and erosion; spikes as instanced cones that rise, hold and erode |
| **Held beams** (Searchlight, Moonbeam, Kohaku's prism beam) | alpha band + core; soft glow (#4–5) | Umeko, Luna, Kohaku & Tsubaki | **medium-high** | move them onto `beams.js` (ink, body, core, bands) with a continuous hold beat; prism: a band per colour |
| **Smoke** (muzzle, rockets, chimney, death, blasts) | `smoke` sprite puffs | Sango, Akane rockets, Kogane, deaths, ambient | **medium** | cel smoke: grey 3-band ramp, noise erosion, normal blend (no add) |
| **Poison and curses** (mist, stains, bubbles, curse bursts) | cone puffs, stain sprite (#15, #39–42) | Midori, Ena, Chigusa, Yoriko | **medium** | ground stain disc with polar noise + erosion and a green 4-band ramp; rising bubble rings; curse: near-black body with a coloured rim (the library's dark-energy variant) |
| **Wind** (gusts, Backdraft Fan, Hurricane Draw) | swirl and glow sprites (#34–36) | Fuu, Rei, Aoi, Hana | **medium** | the `vortex` / `sakura` presets for casts; gust ribbons (strokes with bands) for shots |
| **Fire beyond the tornado** (burn status, embers on walkers, rockets, ember trail) | flash + tint, sprites (#13, #41) | Akane, Kinu, burned enemies | **medium** | small tornado rings at a walker's feet (a 3–4 ring mini column) for burning; flame-tongue billboards on the fire ramp |
| **Heals** | heart pop (#65) | Noa, Wakaba, Chigusa | **medium** | a rising green-gold ring column (tornado rings, slow, sparse) + cross sparks |
| **Buffs and debuffs on girls** (rally, haste, ward) | sparkle + icons (#63) | Hikari, Miko, Wakaba, Ouka, Noa, Luna | **medium** | ground aura disc with polar noise bands in the buffer's colour; a short ring column on apply |
| **Shields / barriers** (enemy barrier, girls' ward, barricades) | model bubble, shards (#66) | barrier / ward enemies, Hikari ward, Norika | **medium** | a fresnel-rim bubble with hex or noise bands and a stepped ramp; it breaks by erosion into shards |
| **Boss attacks and phases** | ring, flash, screen flash (#74) | 7 bosses, minibosses, field casters, saboteurs, summoners | **medium** | phase: a dark-energy ring column (near-black body, red rim) + shockwave; fields: polar-noise ground decals; summons: a portal |
| **Portals / spawns / blinks / rifts** | puff + ring, discs (#74, #79–80) | blinkers, summoners, star rifts, transit pads, spawn gates, Event Horizon | **medium** | polar-coordinate swirl disc (atan + noise scroll, erosion at the rim) on a stepped ramp; Event Horizon as an inward-flowing version |
| **Summon pops** (sentries, doubles, nets) | orange ring + puff (#67) | Yuzuha, Kage, Suzu, Azami, Chika | **medium-low** | a short ring column + ground ring in the girl's colour |
| **Ground cracks and scorches** | `cracks` / `scorch` sprites (#21 Sango P0, beam scorch) | Sango, beams, Marumi Giant Strike, Kanna quake | **low-medium** | decal with a noise-thresholded crack mask, erosion to fade |
| **Ripple Quake, Bramble Road, Spirit Tether** (plain shapes) | ground discs, quads (#10–11) | Kanna, Chigusa, Ena, Yoriko | **medium-low** | quake: stroke rings + an earth ramp decal; vines: strokes along the road with leaf bands; tether: strokes with a sag |
| **Rain / storms / weather** | sprites (#77) | stage looks | **low** | stays sprites; a storm stage could reuse `lightning.js` for sky strikes |
| **Petals** | atlas sprites (#44) | Rei, Noa, Umeko, sakura lightning | **low** | already readable; the `sakura` tornado covers the big moment |
| **Hit sparks** | spark + glow dots (#16) | every hit | **low** (hitFlash covers the styled girls) | inked star + 3 impact lines like `beams.js` impacts |

### Notes for the source search that follows
- The three tornado-grade pieces are all **hand-written in this repo**, built on two shared ideas: **toon strokes**
  (`strokes.js`, lines) and the **eroded polar-noise ring stack with a stepped ramp** (`tornado.js`, volumes). Most gaps
  above are new volume shapes (puff, crown, cone, disc, bubble, wave ribbon) that would take the tornado's fragment
  model as is. A shared "toon flame material" (noise + erosion + ramp + cover/add premultiplied blend + tier sparsity)
  with per-shape vertex shaders would cover explosions, splashes, streams, mist, portals, heals and auras.
- Already in the repo and not used: the `sakura` and `vortex` tornado presets, and the `arcane` lightning preset.
- Existing budget hooks to respect: the flash guard counts additive sprites ≥ 0.3 tiles for ≤ 0.35 s (keep big bodies
  covering, not adding); medium and low get no new full-screen passes; 900 / 500 / 250 quads; strokes ≤ 8192;
  halos ≤ 24 on medium.
- Licence rules for any outside source (owner, Nov 1): MIT, BSD, Apache, zlib or CC0 with attribution; no GPL, LGPL or
  AGPL; no LYGIA; no non-commercial (Shadertoy's default licence is CC BY-NC-SA, so do not copy from it); Kenney and
  Screaming Brain CC0 textures are fine; no particle library dependency.
