# VFX: the visual clock, seeded randomness, captures (M0) and glow + hits that land (M1)

The battle effects upgrade (glow, hits that land, flipbooks, slashes, ult cut-ins) is built in
milestones. M0 is the groundwork every later milestone stands on: nothing in it changes what a
player sees; it makes hit-stop possible and every before/after comparison honest. M1 (at the end of
this page) adds glow, the colour grade, hit-stop, impact frames, hit squash and the new camera shake.

Ground rules for all VFX work (they hold for every milestone):

- **Render only.** Nothing under `src/sim`, `src/data/units.js`, `src/online/coop` or anything
  `tools/simId.mjs` hashes changes for an effect. The co-op sim id must stay the same
  (`node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"`).
- **Effects never use `sim.rng`**, and never `Math.random` (see below).
- **Hit-stop, impact frames and slow motion only change what is drawn.** The battle keeps running;
  a freeze lasts at most 60 ms.
- **Phones first.** Medium and low get no new full-screen passes; their glow comes from halo sprites
  inside the existing sprite limits (900 / 500 / 250 quads, `src/render/attackFx/context.js`).
- **Reduce Motion** (Settings → Reduce motion, `settings.reduceMotion`): no shake, hit-stop, local
  holds, impact frames or big flashes, or soft versions. Flashing screen area is counted a second
  (many small flashes add up); never more than 3 full-screen flashes a second, never a full-white frame.
- **Shake only for big hits**, and only as a sideways shift, never a rotation.
- **Readability.** Enemies, the road and health bars stay readable.

## For later: new attack shapes (owner request, Oct 28)

The owner wants attacks that are not only straight shots or blasts: true 360° bursts, turning spirals,
held flame streams, real vines along the road, and more. The plan is `docs/specs/ATTACK_SHAPES.md` (on
`claude/sakura-sentinels`, and on `main` from the next deploy): ten shapes, the shared sim pieces they need
and how the work is staged, starting with an owner board of animated mock-ups.
- A shape decides who is hit and when, so the shapes are **sim work**: one `COOP_PROTOCOL` bump per batch.
  They are not VFX, and the ground rules above keep them out of this track.
- This track draws them. Their polished look is built from the flipbooks (M2) and the mesh shapes and
  ribbon trails (M4); see §7.3 there.
- A few render-only quick wins can land on this track at any time (§7.4 there): Chigusa's grab drawn as a
  real vine, Kinu's pins and heat ring.

## The visual clock (`src/render/vfx/clock.js`)

Each battle renderer owns one `VisualClock`, ticked once per frame at the top of
`renderer.update(dt)`. Every animation and effect the renderer draws takes its time from it, never
from `performance.now()` or a clock of its own. It keeps three timelines (seconds):

| Timeline | What it is | Who runs on it |
|---|---|---|
| `dt` / `t` (visual) | the frame's time minus any hit-stop, times any slow motion | particles (`fx.js`), attack FX, girls' and monsters' bodies (`actors.js` → model `animate`, hit squash), ambient life, rule decals, terrain shaders (`uTime`), screen flash and boss vignette |
| `frameDt` / `frameT` | the time the battle handed the renderer (0 while paused) | board feedback that must not wait out a freeze: placement ghost, range and selection rings (`overlays.js`), buff icons; the camera shake and zoom punch (M1: they jolt through a hit-stop); the hit-stop director's rate limits |
| `realDt` / `realT` | wall time; runs while paused too | the info-panel slide (`rig.apply` focus) |

Without a hit-stop or slow motion the visual and frame timelines are identical, so M0 draws
exactly what the game drew before.

- `clock.hitStop(seconds)` (or `renderer.hitStop(seconds)`): holds the visual timeline for up to
  `MAX_FREEZE` (60 ms) of frame time. A running freeze can grow but never past 60 ms from its start,
  however many hits ask; the next one waits `FREEZE_GAP` (0.25 s). With Reduce Motion it does
  nothing. A paused game keeps its freeze for when it resumes. Visual time then lags frame time by
  the freeze; nothing catches up (effects are not tied to the sim clock).
- `clock.slowMo(scale, seconds)`: the visuals run at `scale` (0.1–1) for up to 1.2 s of frame time.
- `renderer.visualClock`: a read-only snapshot for e2e, captures and debugging.
- The sim never reads the clock and the clock never reads the sim (the clock test checks that
  `tools/simId.mjs` hashes no `src/render/` file).

Attack FX: `attackFx.update(visualDt, frameDt)` — the game-speed estimate (previews without an
explicit `setTimeScale`) uses the frame time, everything drawn uses the visual time.

## Seeded visual randomness (`src/render/vfx/random.js`)

`createVisualRandom(seed)` is a small seeded generator (mulberry32) with `range`, `int`, `signed`,
`pick`, `chance`, `fork(label)`, `reseed(seed)` and `state`. The renderer makes one battle stream
seeded from the map and stage (`visualSeed('battle', map.id, stage.id)`, or `opts.visualSeed`) and
hands each layer its own fork, so more effects in one layer never shift another layer's numbers:

| Layer | Stream |
|---|---|
| particles (`FxSystem.rand`) | `fork('fx')` |
| attack FX (`ctx.rand`) | `fork('attackFx')` |
| actors (`Actors.rand`: water bob phase, projectile trails, tier-5 sparkles, soot) | `fork('actors')` |
| renderer event effects (slash angle, victory petals) | `fork('events')` |
| ambient life (`AmbientSystem.rand`) | its own stream, seeded from the map id |
| geometry jitter (`GeoBuilder`, when a caller passes no `rand`) | a fixed seed per call |

When writing effect code: use the stream you are handed (`ctx.rand()`, `this.rand()`,
`fx.rand()`), never `Math.random()` and never `sim.rng`, and animate with the `dt` you are given.
`tests/render/vfx-random.test.js` fails on any `Math.random` or sim-rng use under `src/render` or
`src/models`, and checks that the same seed draws the same quads.

## Baseline captures (`tools/vfx/capture.mjs`)

```
node tools/vfx/capture.mjs --label baseline --out <dir>     # 844x390 + 1280x720 × high/medium/low
node tools/vfx/capture.mjs --repeat                         # also re-stages the first config and checks the pictures match
node tools/vfx/capture.mjs --repeat --repeat-config 1280x720:high   # … or that config
node tools/vfx/capture.mjs --out <dir> --resume             # keep what a stopped / crashed run into <dir> finished
node tools/vfx/capture.mjs --viewports 844x390 --qualities high --seconds 5 --reduce-motion
```

It stages the same busy Sandbox battle every time (Sakura Court; eight girls at tier 3–5 and a
level-20 Hikari; ~40 enemies spread along the road with 40× HP, an elite and the Ashwing Matriarch),
then saves, per viewport and quality, the page and the 3D canvas at frames 120 and 180 (2 s and
3 s of play), a device-resolution copy on the phone (DPR 3), the renderer's draw calls / triangles /
attack-FX quads at each moment, and ~10 s of real-time frame times (median and p95 frame interval
and frame-callback CPU time) with a fresh crowd on the board. Output: `capture.json` plus PNGs
(default `e2e/out/vfx/<label>/`, git-ignored).

Why the pictures repeat: the page's `requestAnimationFrame` and `performance.now` are replaced by a
stepped clock before the battle mounts (every frame is exactly 1/60 s), the sim's random stream is
reset to a fixed seed before anything happens, enemy models are loaded before the first frame, the
renderer's randomness is seeded and all its animation runs on the visual clock. Toasts (real-time
UI) are hidden in the shots. `--repeat` proves it: the canvas pixels of the two runs must match
(on high, SwiftShader's float bloom / multisample resolve can leave a handful of pixels ±1 of 255
apart between runs; that counts as the same, anything more does not). A page that crashes (it
happens to headless SwiftShader under load) is staged again once, in a fresh browser if needed.

Besides the real-time numbers, each config reports its stepped frames: the same 180 frames every
run, each finished on the GPU (`gl.finish`) before the next, minus the first few (shader
compiles) — steadier for comparing builds than real-time play. Both are slowed by whatever else
the machine is doing, so `capture.json` records the load average next to them.

The frame times are headless Chromium drawing WebGL on the CPU (SwiftShader): good for comparing two
builds on the same machine, not a stand-in for a real phone (the plan's FPS check on a real
mid-range phone still applies).

## M1: glow, colour grade, and hits that land

Everything in M1 is render only (the sim id does not change, co-op with older versions plays the
same) and costs phones nothing new: medium and low get no full-screen pass and no new draw call; high
swaps three's output pass for one that also tone maps and grades, so its chain has the same three
passes as before (scene, bloom, output).

### By graphics tier

Phones first: low gets almost nothing new, medium a light version, high the full set
(`src/render/vfx/feel.js` `FEEL`, `src/render/vfx/halo.js` `HALO`).

| | High | Medium | Low |
|---|---|---|---|
| Glow | bloom on hot cores (halos if Bloom is off) | light halos (only the hottest, larger sprites; ≤ 24 a frame per layer) | none |
| Tone curve + grade | yes | no | no |
| Global hit-stop (the whole board) | boss kill, ult impact | boss kill | none |
| Local hold (only the struck enemy) | strong hits, crits | strong hits, crits | none |
| Impact frames (tinted) | yes (Impact frames setting) | a soft tint instead | a soft tint instead |
| Camera shake | full (trauma × 1) | lighter (trauma × 0.8 ≈ ⅔ the size) | small (trauma × 0.6 ≈ ⅓ the size) |
| Zoom punch | yes | yes | no |
| Hit flash on the body | yes, with squash | yes, with squash | yes, no squash |
| Screen flashes | through the flash guard | same | same |

### Glow

| Tier | How effects glow |
|---|---|
| high (Bloom on) | Additive sprites push their hot core above white (`QuadBatch.setHdr`: `colour × (1 + hdr × coverage²)`, `hdr` 1.7 for billboards, 0.9 for ground rings; coverage = texture alpha × the sprite's own fade, so soft edges and fading sprites stay below the threshold). The bloom threshold sits just above the lit scene with a soft knee (`BLOOM` in `BattleRenderer.js`: day 0.96 → 1.36, night 0.84 → 1.2) so light fades into the glow instead of popping, and the white of a dress or the road never blooms. |
| medium (and high with Bloom off) | No bloom pass: bright additive sprites (glow, soft, spark, star, beam, slash, ray) get a soft halo sprite under them in the same additive batch (`src/render/vfx/halo.js`). Halos count inside the limits: particles + halos ≤ the particle limit, attack-FX halos are decoration in the quad budget (dropped first, never past 60 % of the budget), at most 24 (medium, smaller and only on the hottest, larger sprites) / 160 (high, Bloom off) a frame per layer. With `hdr` 0 the batch shader is the old one (the boost is compiled in only while it is on). |
| low | Nothing new: no bloom, no halos. |

`renderer.hdrProbe({ effects })` (dev tooling) draws the frame into a small float target and returns
the share of pixels above each luminance level: with the effects left out it shows how much of the
lit scene a threshold would catch, which is how the threshold was chosen (build notes).

### Tone mapping and grade (high)

`src/render/vfx/grade.js` `GradePass` replaces the OutputPass at the end of the high chain:

- **Tone curve**: exact below 0.82 (the scene looks as before), then a hue-keeping soft shoulder to 1;
  very hot values (the over-white effect cores) bleach towards white like film.
- **Grade** (display space): split toning (a tint in the shadows and one in the highlights), contrast,
  saturation, lift / gain — one gentle grade per map theme (`GRADES`), night stages lean blue in the
  shadows, fog lowers the contrast. `tests/render/vfx-m1.test.js` checks every theme keeps the road /
  ground and health bar / road contrast at ≥ 90 % of the ungraded picture.

### Hits that land

| What | When | Rules |
|---|---|---|
| Global hit-stop (`src/render/vfx/hitStop.js`; the kinds each tier allows: above) | a boss kill, an ult's impact frame: 60 ms | the visual clock holds, the battle never does; ≤ 60 ms per freeze. Only these two moments freeze the whole board ("freeze the struck, not the world") |
| Local hold (`src/render/vfx/localHold.js`, `actors.holdEnemy`) | a strong hit or a crit (the hitting girl's impact preset, below); a miniboss kill holds its death for 4 frames | only the struck enemy's look holds — pose, place, facing, squash and flash — for 2-4 **rendered** frames (counted in drawn frames, not seconds: a 2-frame hold is 2 frames on a 30 fps phone too; a frame drawn while the visual clock is stopped does not use it up) with a ±0.025-tile sideways jitter that alternates each held frame, then it catches up within a frame or two; the board, the sim and every other enemy carry on. **The first held frame already shows the hit**: the flash at full (the model is animated with dt 0, so it does not fade) and the squash at its deepest; that struck look stays frozen until the hold ends, then the flash fades and the wobble plays (never the look from before the hit). A killed enemy's death clip holds its flash the same way. At most 3 new holds a second (1 in a busy fight: > 25 hits a second), ≤ 2 a frame, the same enemy again only 0.6 s later; a few a wave, never a stutter |
| Impact frames (`src/render/vfx/impact.js`; high only; Settings → Graphics → Impact frames) | hero ults over the whole map, boss kills (a one-enemy strike or the sky dragon gets its small flash instead) | 2 rendered frames: the board, still drawn and readable (no ink blackout), is multiplied by a navy-blue (`#7f8fd6`, full on the first frame, half on the second), and every girl, monster, companion, drone and shot turns into a flat sakura-pink silhouette at about 60 % value (a touch of the moment's colour mixed in) drawn over the tint, through one shared toon impact material (`src/models/toon.js` `impactMaterial`). A monster body that is see-through only for its look (a slime's jelly, a ghost; opacity ≥ 0.75, marked `userData.body` by the models) is a silhouette too; a fainter (veiled, phasing) body sits the frames out, and an outline hull whose part is hidden goes with it, so no dark disc is ever left. Outlines keep their ink, the additive effects keep burning on top, the normal-blend effect batches sit the two frames out; then everything is put back. **The board comes back to its own brightness**: the afterglow (`feel.js` `AFTERGLOW`) is a faint tint of the moment's colour (peak 0.1, 0.06 for red) that swells in from nothing over 150 ms and then fades, so the dimmed frames are never followed by a jump above the board's normal brightness. Never brighter than the board it covers. |
| Hit flash + squash (`actors.hitFlash(uid, color, strength, squash)`) | every hit | the body flashes white, gold on a crit, the attack's colour where the enemy is weak; it squashes (24 % down, 16 % out; × 0.45 for a weak hit, up to × 1 for a crit) and springs back over 0.32 s of visual time — a hold keeps it at its most squashed; big monsters squash less; a new hit restarts it only after 0.09 s; plain numbers on the view, nothing allocated |
| Camera shake (`CameraRig.kick(trauma)`, scaled by tier) | big hits only: a big blast no girl owns (a volatile monster's, radius ≥ 1.6), big shares of heavy enemies, heavy kills, boss spawns / phases, big leaks, ults, tier 5, and one jolt for the big girl moments (≥ 0.8 s apart): Kaede's maple storm / shockwave, Marumi's Glow Bowl finale and her Giant Strike as it starts (`feel.js` `momentTrauma`), and a girl's big ability blast (radius ≥ 1.6, `abilityBlastTrauma`, a tiny 0.24). **A girl's basic splash never shakes**, however big (a basic hit is tier 1): Akane's fireball, Sango's shell, a charged strip, every ball of Marumi's (`feel.js` `explodeSource`: every non-volatile blast the sim emits is a girl's, so this holds on every tier with no bookkeeping). **Marumi's ordinary blasts never shake** (her balls' explosions are left to her finale) | trauma 0..1, the shake is trauma² × 3.4 % of the short side of the view (9–24 CSS px), two detuned sines per axis, a sideways shift only (`SHAKE_ROLL` is 0: never a rotation), gone in ≈ 0.65 s; it runs on frame time, so it keeps jolting through a hit-stop |
| Zoom punch (`CameraRig.punch(amount, s)`; not on low) | ults 7 %, boss kills 5 % | a quick swell and an eased return to exactly the framing; the locked camera's zoom is never touched |

### Impact presets (`src/render/vfx/impactPresets.js`)

Every hit is **weak**, **strong** or **crit** for the girl who dealt it, and each girl has a preset
for the three, set by her weight class. The hit event names only the enemy, so the renderer works out
who hit (`src/render/vfx/hitSource.js`, read-only): a shot of hers that landed on it since the last
frame (aimed at it, or piercing through it), else the attack event that follows its hits in the same
step (pulses, beams, chains, slashes, towel snaps, her own blasts, strip bites, shells), else the shot
nearest a splash. Unknown hits get the normal preset. Only hits that could land hard are looked up,
and nothing is worked out while no hit can hold its enemy (Low, Reduce Motion, Flashes & shake off:
the class then only picks the squash, from the normal preset). Its bookkeeping allocates nothing per
projectile per frame (pooled records stamped with the frame they were last seen, walked with one
bound callback), and starts afresh when holds become possible again.

| Class | Girls | Strong on an ordinary enemy | Strong on a heavy enemy (elite, miniboss, boss) | Hold: strong / crit |
|---|---|---|---|---|
| heavy | Marumi, Sango, Shiro, Akane, Kaede, Kanna, Suzu, Ena | ≥ 35 % of its max HP | ≥ 6 % | 3 / 4 frames |
| normal | everyone else who deals damage | ≥ 70 % | ≥ 10 % | 2 / 3 frames |
| light | Kage, Umeko, Chika, Momo, Noa, Azami, Kinu (streams of small hits, rings, auras, strips) | never | ≥ 15 % | 2 / 2 frames |
| none | Wakaba, Ouka | — | — | — |

A crit is a crit on a heavy enemy, or on an ordinary one when it deals ≥ 30 % of its max HP (a small
crit is a small hit). Weak hits never hold. Small enemies die in a few hits in a tower defense, so the
thresholds aim at a few holds a wave rather than half the hits (a headless battle on 2-1 gets about 4
a wave, most of them Marumi's: `tests/render/vfx-hits.test.js`). Later FX milestones add each girl's
motif spark and kill pop to the same presets.

### Blasts (`src/render/fx.js` `explosion`, `BLAST`)

A blast's body is an alpha-blended **cel puff** in the blast's colour — the atlas `celPuff` sprite,
painted in exactly three grey values with hard edges (1.0 lit, 0.75 shadow, 0.45 rim), so the tint
gives the girl's base, shadow and a tinted outline — that swells 1 → 1.25 (0.96 → 1.2 × the radius),
holds its shape at 0.8 opacity for 35 % of its life and then fades; a lighter cel puff sits on its upper
part, the fire puffs are small cel puffs (0.85 opacity, at most 10) flung out from round the hit, and
the shock ring is a hard alpha ring on the ground. **Only a small white-hot core is additive** (sized
by the radius up to 1.2, gone in 0.1 s), so the colour grade and the bloom cannot wash the blast out (Marumi's blasts read softer than live before
this). Marumi's ball pops use hard alpha rings too, with a small additive flash.

**A shape around the hit, not over it.** The body and the lit puff are **seated on the ground**: each
billboard is anchored at the blast's spot just above the road and drawn upward from it (a view-space
lift of half its height), so no part of it ever dips under the ground (no straight cut along its
bottom), and its depth is that spot's: the struck walker standing there, and anyone in front, is drawn
over the cloud — her flash and hold stay visible — while the cloud billows up behind her. It is
see-through and fades early, so the road and the girls never vanish under a blast. **A Spin Shot
bounce draws a smaller cloud** (× 0.6, `BOUNCE_BODY`; the ring still shows the real reach), so the
Glow Bowl finale is the one big cloud of the chain.

All of it is decided in one place, `src/render/vfx/feel.js`:

- **Reduce Motion**: no shake, no zoom punch, no hit-stop, no local holds, no impact frames (they
  become a soft tint); every flash ≤ 0.2 opacity and slower; half the squash; half the flashing-area
  budget.
- **Settings → Graphics → Flashes & shake** (`settings.hitEffects`, default on; also in the battle's
  pause menu; read live): off = no screen flash of any kind (ult, leak, boss phase, victory), no
  impact frames, no shake, no zoom punch, no hit-stop, no local holds. The struck body's own flash
  stays (it is not a screen flash). An older tab that does not know the key drops it and the default
  (on) comes back.
- **Settings → Graphics → Impact frames** (`settings.impactFrames`, default on; also in the pause
  menu; read live): off = an ult or a boss kill gets the soft tint instead of the tinted frame. Reduce
  motion and Flashes & shake off turn them off too (the Settings row then shows why).
- **Placing a girl**: the camera holds still (no shake, no punch), as before.
- **Flash safety** (`src/render/vfx/flashGuard.js`): it counts **flashing screen area a second**, not
  single flashes, so many small hits add up. A full-screen flash counts one screen; every bright,
  short additive sprite on the board (a world flash: additive, ≤ 0.35 s, ≥ 0.3 tiles across — blast
  cores, hit sparks, muzzle and impact flashes, from `fx.js` and the attack-FX layer alike) counts its
  share of the screen × its strength (`screenShare`: its size in CSS px at the current zoom; a soft
  glow counts only its bright middle). In any second the counted area stays within 3 screens, world
  flashes within 2 of them (so an ult or a boss kill keeps its room); past that a world flash is drawn
  at 30 % (still there as a shape, too faint to count) and a screen flash becomes a faint tint
  (≤ 0.08) that does not count. On top, at most 3 full-screen flashes in any second, an impact frame
  counts as 2 (and two screens) and waits 1.2 s after the last one, and the screen-flash layer never
  passes 0.55 opacity (it is a radial tint: no frame is ever full white). The window is kept in 50 ms
  bins (one more than a second's worth, so it never undercounts; O(1) per flash). No large saturated
  red: a reddish colour (red ≥ 60 % of R + G + B in linear light; WCAG's saturated red is 80 %) is
  mixed towards its own grey into a dusty rose and peaks at 0.25 opacity — the big-leak and
  boss-phase flashes, a red ult's afterglow.
- **Boss vignette** (the red edge while a boss is on the board): a boss spawn or phase makes it
  swell in (≤ 1.5 opacity a second, peak 0.6; `flashGuard.js` `vignetteStep`), never flash; with
  Flashes & shake off only its slow pulse stays.

`renderer.vfx` reports what the layer did (freezes granted / refused, local holds granted / refused,
impacts, flashes the guard turned down, the flashing area counted this second, world flashes counted /
dimmed, halos last frame, shake px, zoom punch, bloom and grade in use); the capture tool
records it with every shot. `node tools/vfx/capture.mjs --events ult@150,bosskill@210` also shoots
those moments as they land (the frame they land on and 2, 6 and 16 frames later).

## Tornado (prototype, `src/render/vfx/tornado.js`)

A stylized tornado, hand-written (no particle library): a column of flat rings that rise from the ground, grow wider,
twist round a helix and sway on X/Z. Display only: the sim id does not change.

- **One draw call.** Every ring of every live tornado is one instance of one `RingGeometry` annulus in an
  `InstancedBufferGeometry` with a `ShaderMaterial` (premultiplied: One, OneMinusSrcAlpha; `depthWrite` off). The mesh is
  hidden while nothing is up (0 calls). The glowing ground ring goes into `groundA`, the embers into `bbA` (petals into
  `bbN`): a few quads.
- **Two blends, by tier.**
  - **Medium and low:** the cooler bands cover the board a little (`body`), so the colour reads on a bright day. The
    band at k ≥ 0.8 (the top of the yellow, the white) is pure added light. They draw on the canvas, where the colour is
    sRGB-encoded before it blends, so stacked bands overshoot: the yellow to lemon, the cream to white. For readability
    the low rings (walker height) and the arc nearest the camera cover the least.
  - **High ("cover", `TORNADO_TIERS.high.cover`):** every band covers the board in its own colour (premultiplied over),
    so no red-over-green murk. The far arc erodes harder (`COVER_FAR_ERODE`) and is a little fainter (`COVER_FRONT`), so
    what stands behind the column stays visible; the young rings at the base are faint (`COVER_YOUNG`).
  - **High with bloom** renders into the linear composer, where covering rings settle exactly on the ramp's colours (no
    overshoot). So it reads its own ramp row: every band × `COVER_GAIN` in display bytes (the overshoot medium gets on the
    canvas, baked in), which brings back the lemon and white. The very back of the funnel (the far arc, `vFront` < 0.2)
    takes the preset's own colours instead, blending into the cover row towards the sides: the back stays amber where a
    thin lemon over grass would read lime, and the rest burns lemon and white. The back's sides can still read
    yellow-green over grass greener than Sakura Court's (the lake and shrine maps by day; figures below). The k ≥ 0.8 band also goes `hdr` over white so the bloom
    catches it; the hot bands sit above the grade's knee, so its tone curve rolls them off as it does every bright core.
  - **High with bloom off** draws on the canvas like medium and keeps the bands as given.
- **Vertex shader:** age = fract(t / life + phase); radius r0 → r1 along age^0.7; the ring spins and twists with its
  height, its centre wanders on a helix and sways. A ring is drawn only if it was born inside the cast, so the column
  builds from the ground up and leaves by rising away. The arc facing the camera burns brighter (it reads as a funnel).
  That front is the world's +z (the landscape camera's), for every tier's front and far arc outside Reduce Motion: on the
  portrait camera, which looks from the side, they fall on the column's walls (high's right wall keeps 0.62 of its left's
  pixels; what stands behind keeps about medium's share). Making them follow the camera changes the phones' look on
  every tier, so it is left for its own round.
- **Fragment shader:** noise in the ring's polar coordinates (the angle is taken per pixel: no seam), scrolled over time; an erosion threshold that rises with
  age; `step()` for a hard toon edge (it multiplies the colour: no `discard`); a stepped ramp (`NearestFilter`) per
  preset. On high with bloom the k ≥ 0.8 band gets a small HDR boost (`hdr`) for the bloom; never on medium / low.
- **Textures** are painted in code (`paintTornadoNoise`: tileable value-noise fbm; `paintTornadoRamp`: two rows per preset,
  the bands as given and high's cover row; sRGB bytes, decoded once on the GPU): no image files. The presets' ramp
  colours are exactly what is drawn.
- **Randomness:** `vrand.fork('tornado')`; time from the visual clock (`update(d)`).
- **Presets** (`src/render/vfx/tornadoPresets.js`, plain data): `fire` (Akane), `sakura` (pink petal whirl), `vortex`
  (cyan wind / water). Every preset value is per tornado (two presets can be up at once). `TORNADO_CASTS` maps a cast
  to its preset: `akane.starmine` → `fire`: its `abilityWarn` event starts the column on the barrage's spot (1.25× the
  shells' radius), and every `abilityShell` of that cast feeds it for 0.45 s more, so it ends with the barrage at any
  game speed (the shells run on sim time).
- **Tiers** (`TORNADO_TIERS`):
  - High: 22 rings, 4 faint core rings and 12 embers, the cover blend.
  - Medium: 13 rings and 6 embers.
  - Low: 8 rings, no embers.
  - At most 3 tornadoes at once.
  - High has more rings than medium, so each one is sparser: its erosion threshold starts higher by
    `SPARSE_ERODE × (1 − 13 ÷ 22)`. That is the same for every ring of the tier (one uniform), core rings included.
    It shapes the mask only. The colour index still comes from the preset's own erosion, so high's colours are never
    darker for it.
  - Measured in the lab (bloom and grade on, fire at t = 1.2, column masked, high vs medium; colours split by hue):
    - on the lab's green: lemon (hue 48–70°) 0.13 vs 0.12, white 0.05 vs 0.05, yellow-green (hue 66–95°) 0.05 vs 0.00,
      murky 0 vs 0, brightness 0.73 vs 0.73;
    - on the game's grass colour (`#9dba5f`): lemon 0.20 vs 0.20, white 0.05 vs 0.05, yellow-green 0.03 vs 0.00;
    - in the game on a dark ground (the shrine map, Torii Corridor, which the Sandbox shows as its campaign night
      stage; Akane's cast and the fire preset, 1280x720): no yellow-green on high, with or without Reduce Motion (at
      most 0.002 of a box round the column; medium at most 0.003);
    - on a greener ground (`#8fbf62`, the lake and shrine maps by day, as in Tryouts and on Market Canal), high's thin
      lemon reads yellow-green: 0.15 at t = 1.2 and 0.19 fully up, against medium's 0.01 (LOW 2's residual, an owner
      call). In the game, Market Canal by day (`--map arena_market`; the board's canal rows): high's thin top tongues read
      yellow-green over its grass in normal play; under Reduce Motion its short column reads orange with a little lemon at
      the top; medium reads red and orange (that grass falls in the yellow-green hue class itself, so the board shows it
      rather than a share);
    - what stands behind the column (27 spots: three stand-ins at a time 0.9–2.4 tiles behind the centre, at t = 0.9,
      1.2 and 2.0) keeps a median 0.30 of its contrast on high and 0.35 on medium (Reduce Motion: 0.99 and 0.70, see
      Reduce motion); right at the base every tier hides most of it.
- **Errors:** a tornado error switches the tornadoes off for the battle (`tornadoSafe` in `BattleRenderer`, logged once). The
  battle and every other effect carry on.
- **Reduce motion:** no spin, twist, sway, helix or noise scroll; the ground rings and petals do not turn; slower rise.
  Medium and low are dimmer (the colour they add × 0.7). High is not thinned but eroded (`RM_COVER`): with bloom its
  cover adds no light in the linear composer and a thinner lemon over grass reads lime; with bloom off it draws on the
  canvas like medium, and erosion takes tongues away and cools the rest (it never adds light). Every ring erodes 0.22
  harder and the far arc 0.3 harder still, with the colour index following the extra erosion (the tongues that are left
  keep the whole ramp).
  - **The funnel faces the camera** under Reduce Motion: its front and far arc (the erosion, `COVER_FAR_ERODE`'s too, the
    colour index, the far arc's faintness and the back's given row) are the camera's that draws the column (`uView`, set
    as it is drawn). On the landscape camera they are the world's, as without Reduce Motion (the same pixels). On the
    portrait camera, which looks from the side, it is the same funnel and keeps both walls (its right/left pixels 1.23;
    medium 0.87, high without the erosion 0.57); with the world's far arc it was cut to one wall.
  - **What stands behind** a column that is fully up keeps (lab, as above, Reduce Motion; t = 2.4, 2.8 and 3.2, the same
    27 spots), on the landscape camera, a median 0.13 of its contrast at 0.9 tiles, 0.64 at 1.2–1.6 and 0.99 at 2.0–2.4
    (medium 0.11, 0.27 and 0.56; high without the erosion 0.01, 0.19 and 0.37), and a stand-in in the middle of the
    column (t = 2.8) 0.27 (medium 0.15, without 0.06); on the portrait camera 0.95, 0.97 and 0.98 (medium 0.27, 0.21
    and 0.44), and the centre 0.34 (medium 0.37, 0.32–0.40 by seed: medium's own front is the world's, its side there).
  - **The cost:** high's column is smaller and calmer under Reduce Motion. Fully up on the lab's landscape camera it is
    93 px tall and 4,300 px in area, against medium's 164 px and 14,200 px (high without Reduce Motion: 155 px and
    10,800 px), with less lemon and white than medium's (on Sakura Court's grass at t = 1.2: lemon 0.13 vs 0.27, white
    0.01 vs 0.04). Yellow-green stays low on Sakura Court's grass (0.04 at t = 1.2 and 0.03 fully up, medium 0.005 and
    0.003) and the lab's green (0.03; without the erosion 0.07 and 0.11), but on greener grass (`#8fbf62`) it is 0.26
    at t = 1.2 (the rising column's upper half 0.44; without the erosion 0.29) and 0.20 fully up, against medium's
    0.02 and 0.01.
- **Impact frames** hide the column for both their frames (`tornado.hold(impact.active)` before its update), like the
  other normal-blend layers.
- **Dev lab:** `?tornadoLab` in the dev server (`npm run dev`, e.g. `/?tornadoLab#/lobby`, then a battle) mounts a
  lil-gui panel (`tornadoPanel.js`): pick a preset, tune it live, loop it, copy the result as preset data. The import
  sits behind `import.meta.env.DEV`, so the production build has neither the panel nor lil-gui.
- **Captures:** `node tools/vfx/capture.mjs --events starmine@80,tornado-sakura@400 --hp 100000` (a tornado event
  spawns one on the crowd; `--hp` keeps the crowd alive against the max-build Sandbox girls).
