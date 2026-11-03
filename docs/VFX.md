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

## Weapon muzzles (`src/models/weaponTip.js`, docs/specs/weapon-muzzles.md)

An armed girl's figure carries `userData.anchors.muzzle` / `anchorDir('muzzle')` / `weaponKind` (her staff's
head, her barrel's mouth, her bow's grip; measured once per GLB from the prop's mesh bounds and following her
clips). attackFx reads it through `ctx.muzzle(t, out)`, and `ctx.hand(t, out)` returns it when present
(`out.tip`): every style's `origin()`, hand flash, chain and held beam then leaves the weapon, and the origin blend
(`math/blend.js`) still puts the drawn shot on the sim's path by f′ = 0.6. Height nudges above the hand go through
`tipUp(h, dz)` (0 at a tip); `tipFlare` adds a cone along a gun or bow, a longer glow on a staff. No anchor
(procedural / stand-in chibis, unlisted girls, a prop still loading): the old hand point.

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
    canvas, baked in), which brings back the lemon and white. The k ≥ 0.8 band also goes `hdr` over white so the bloom
    catches it; the hot bands sit above the grade's knee, so its tone curve rolls them off as it does every bright core.
  - **High with bloom off** draws on the canvas like medium and keeps the bands as given.
- **Vertex shader:** age = fract(t / life + phase); radius r0 → r1 along age^0.7; the ring spins and twists with its
  height, its centre wanders on a helix and sways. A ring is drawn only if it was born inside the cast, so the column
  builds from the ground up and leaves by rising away. The arc facing the camera burns brighter (it reads as a funnel).
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
  With the attack effects option off (`settings.attackFx === false`) no column starts (see the library's Setting line).
- **Tiers** (`TORNADO_TIERS`):
  - High: 22 rings, 4 faint core rings and 12 embers, the cover blend.
  - Medium: 13 rings and 6 embers.
  - Low: 8 rings, no embers.
  - At most 3 tornadoes at once.
  - High has more rings than medium, so each one is sparser: its erosion threshold starts higher by
    `SPARSE_ERODE × (1 − 13 ÷ 22)`. That is the same for every ring of the tier (one uniform), core rings included.
    It shapes the mask only. The colour index still comes from the preset's own erosion, so high's colours are never
    darker for it.
  - Measured in the lab (bloom and grade on, fire, column masked, high vs medium; colours split by hue):
    - lemon (hue 48–70°) 0.13 vs 0.12, white 0.05 vs 0.05, murky 0 vs 0, brightness 0.73 vs 0.73;
    - what stands 0.9–2.4 tiles behind the column keeps a median 0.52 of its contrast (medium 0.33); right at the base
      every tier hides most of it.
- **Errors:** a tornado error switches the tornadoes off for the battle (`tornadoSafe` in `BattleRenderer`, logged once). The
  battle and every other effect carry on.
- **Reduce motion:** no spin, twist, sway, helix or noise scroll; the ground rings and petals do not turn; slower rise; dimmer.
- **Impact frames** hide the column for both their frames (`tornado.hold(impact.active)` before its update), like the
  other normal-blend layers.
- **Dev lab:** `?tornadoLab` in the dev server (`npm run dev`, e.g. `/?tornadoLab#/lobby`, then a battle) mounts a
  lil-gui panel (`tornadoPanel.js`): pick a preset, tune it live, loop it, copy the result as preset data. The import
  sits behind `import.meta.env.DEV`, so the production build has neither the panel nor lil-gui.
- **Captures:** `node tools/vfx/capture.mjs --events starmine@80,tornado-sakura@400 --hp 100000` (a tornado event
  spawns one on the crowd; `--hp` keeps the crowd alive against the max-build Sandbox girls).

## Toon core (`src/render/vfx/toonCore.js`, batch B0)

The tornado's fragment ideas, lifted into one shared module so every eroding-shape family (the water splash first, then
electricity, beams, deaths, blasts and casts) draws in the same house look. Display only: the sim id does not change.

- **What it holds.** Import-free GLSL chunks (plain strings) and the small painters and helpers that feed them:
  - `TOON_NOISE`: the house noise (R 85 % + G 15 % at a second scale and drift, through `smoothstep(0.25, 0.75)`),
    `toonCells` (the Worley F2 − F1 channel), `toonSwirl` (the uv pushed along the painted swirl field) and
    `toonTwirl` (a polar twirl round a centre);
  - `TOON_ERODE`: `toonHeat` (band × (0.3 + n)), `toonCut` (young → old), `toonMask` (the hard step: no fringe, no discard);
  - `TOON_RAMP`: `toonIndex` (heat above the cut × 1.6, so the darkest band is every shape's ink rim), `toonIndexS` (a
    family's own slope), `toonRamp`, `toonHot` (the k ≥ 0.8 band);
  - `TOON_ALPHA`: `toonFade` (in over the first 10 % of an age, out over the last 18 %), `toonYoung`, the two blends
    `toonCover` (high) and `toonAdd` (add + light body);
  - `TOON_TIER` (`uSparse`, `uCover`) and `TOON_MOTION` (`uStill`, `toonMove`) uniforms; in JS `toonSparse` (high's
    sparser mask), `toonHold` / `toonMotion` / `TOON_REDUCE` (Reduce Motion: nothing turns or scrolls, lives × 2.2,
    alpha × 0.7);
  - `paintToonNoise(n, seed, { cells, swirl })`: R and G as the tornado's, plus Worley F2 − F1 in B (a periodic port
    of webgl-noise's cellular2D, MIT) and a domain-warped swirl in A (a domain-warping article's MIT snippets);
    `paintToonRamp(rows)`: flat-band ramp rows with optional per-band gains. Painted once at load: no image files.
- **The tornado draws with it** and looks identical. `e2e/toon-core-tornado-diff.mjs` shoots the real tornado layer on the
  lab patch (`previews/tornado-stills.html`, built on `previews/vfxLabStage.js`: the real terrain painter on a
  fixture board, the battle's lights, camera, batches and high's bloom + grade, every frame stepped at 1/60 s) for
  fire, sakura and vortex × high and medium × 844×390 and 390×844 × 0.7 s and 1.6 s, and diffs the sets in the page.
  Limits: max channel delta ≤ 2, mean < 0.1. Recorded on this change: two captures of the old build 24 / 24 stills
  max 0, mean 0 (the noise floor); old vs new 24 / 24 max 0, mean 0 (bit-identical); a deliberate one-step change in the
  noise chunk fails at max 153, so the check is live. The painters are byte-identical too (hashes pinned in
  `tests/render/vfx-toon-core.test.js`).
- **Pinned text.** The test hashes every chunk: changing one changes the tornado and every family built on it, so it is
  a deliberate act (re-run the diff, re-pin).
- **Licences:** `public/licenses/webgl-noise-MIT.txt`, `public/licenses/domain-warp-MIT.txt` (both listed in Settings →
  Licences).

## Water splash (`src/render/vfx/water.js`, `waterPresets.js`, batch B1; lab only, not wired)

The tornado's house look turned into a short burst, built on the toon core. Not in the battle yet: the lab is
`previews/water-splash.html`, and `WATER_SPLASH_GIRLS` names who will use which preset once it is wired. Display only.

- **Three layer kinds, one instanced draw call each** (3 calls while a splash is up, 0 when idle; every buffer allocated
  once for `MAX_SPLASHES` = 8 at the high tier, numbers written into it each frame and uploaded whole, with no update
  ranges, so nothing is allocated a frame):
  - **crown** (`CylinderGeometry` wall, 40 segments): rises from the impact (all of it in the first 38 % of its life),
    spreads and slumps. Its lip has whole-number spikes wobbled by the house noise and erodes first, so its tongues
    part; then the wall goes down from the top (a shallow noise and a threshold climbing faster up the wall: no cracks
    across its body). A translucent, glowing body in wide flowing bands: the far wall's inside a shade deeper (seen
    through the near wall), a light glow band up the middle of the near wall, a white crest under the lip. Ink only on
    the silhouette (a thin rim inside the eroded edge, at least ~1.3 px on screen, and where the wall turns edge-on to
    the camera); it leaves as the wall goes down (the receding edge turns crest white), sooner on the narrow jet. A
    centre jet follows on high and medium (same call). The crown and the jet are written only during their own lives.
    One draw call holds the far wall's inside and the near wall's outside, so the triangles are sorted back to front,
    once per camera turn.
  - **drops**: pairs leave the spike tips as the crown breaks (the JS mirrors `crownSpread` / `crownRise` / `crownSink`
    put them where the lip is drawn). Each pair is one camera-facing quad whose shader sums two feathered fields and cuts
    them with one hard threshold: one blob while the drops are close, two as the faster one pulls away. Each drop
    stretches along its flight, keeps an aqua body with a lighter middle (never an ink-only speck) and a white shine at
    least a pixel wide; its ink rim only while it is over `DROP_INK_PX` (3.2) on screen. Its threshold climbs faster over
    the last of its flight, and it is gone under `DROP_MIN_PX` (1.3 px).
  - **ground**: the foam ring, a translucent band of water carrying round white bubbles. The bubbles are painted once
    into the noise texture's B channel (`paintFoamBubbles`: one cone a cell of a 6 × 6 periodic lattice, jittered and
    sized by the house hash; no Worley cells, so no flower shapes), laid round the ring so they stay round whatever its
    radius (two lattice tiles round it: about 12 bubbles). Along the ring's middle they merge into a scalloped band of
    foam; as the threshold climbs they part, shrink and pop, after the water under them has gone, and a bubble under
    `FOAM_MIN_PX` (2 px) is not drawn (no 1 px stipple). Ink only on the ring's outer edge, and it leaves at
    `FOAM_INK_AGE` (0.66 of the ring's age, a hard step wobbled by the noise, so in patches) before the eroding band breaks
    into slivers thinner than its rim, which would be drawn all ink (dark dashes); its inner half is a light glow band; a faint wet glow fills the middle (one flat step that dries out in blobs). The impact disc sits at its
    middle for the first moments. The ripples run out past it, drawn only outside the foam's outer edge (the foam is
    translucent): light lines inked on their outer edge only, whole while young, breaking into dashes as they run out
    (the decay drives the threshold instead of a fade). Each ground quad hugs its ring as it is now and is empty
    outside its life (no fragments for ground it has not reached).
- **Blend: the glow cover** (premultiplied One / OneMinusSrcAlpha). The colour is encoded for the target first and
  premultiplied after it (so a fade on the sRGB canvas darkens, never lightens; the tornado's path is unchanged). Then
  the whole colour is added and each band hides its own share of the board (`CROWN_COVER`, `FOAM_COVER`, `DROP_COVER`:
  the bodies about half, the whites ~0.9, the ink all of it): translucent, luminous water with solid ink and whites.
  Adding in display values on the canvas (medium, low, high without bloom) lands far brighter than in high's linear
  target, so there the translucent bands add `WATER_CANVAS_ADD` (0.4) of their colour (`uAdd`), and every tier reads
  alike. The broad whites sit just under the bloom's threshold; on high with bloom the crest, the drops' shine and the
  impact's core go `hdr` over white, the glow the bloom catches.
- **Presets** (plain data): `fresh` (Nami, Sango: teal and white), `river` (Umeko, Wakaba: a lighter blue), `frost`
  (a hook for Frost Net and Yuki: icy bands, a stiffer crown; not tuned, not on the board). Eight-texel ramps (one band a
  texel) for the crown and drops, and eight for the ground.
- **Tiers** (`WATER_TIERS`): high 5 drop pairs, 2 ripples, the jet, 9 lip points, the sparkle; medium 3, 2, the jet, 7;
  low 2, 1, no jet, 6. High and medium draw the splash 1.25 × its size (`scale`: it reads beside a chibi at 844×390);
  low keeps 1 × (its fill rate). High's drops are clipped a little smaller (`DROP_SPARSE`, the mask only).
- **Reduce Motion:** no crown, drops, jet or ripples; one still foam ring (held in the shader: no spread, swirl or scroll,
  no impact disc; its round bubbles held where they are) that leaves by eroding, over `TOON_REDUCE.life` × its life, at
  `WATER_REDUCE_ALPHA` (0.92: the ring is already translucent, so the core's 0.7 would wash it out).
- **Flash guard, Flashes & shake:** the impact sparkle asks `flashGate` once a splash and is scaled by its answer;
  with Flashes & shake off (`setFlashes(false)`) there is none, on the splashes already up too. `setQuality` gives the
  splashes up the new tier's ripple tail (`splashSeconds`), as `setReduceMotion` does. Nothing else in the splash adds light, so nothing else
  counts as a flash. Impact frames: `hold(true)` hides all three layers.
- **Randomness:** the stream it is handed (`vrand.fork('water')` when wired); time from the visual clock.
- **Cost:** CPU 11 µs a frame on high with four splashes up (node, this machine; the tornado's three columns 12.5 µs).
  Headless SwiftShader frame time with eight splashes on the lab board: high 199 → 229 ms, medium 82 → 95, low 66 → 80
  (CPU raster: compare runs, nothing absolute about a phone), +3 draw calls.
- **Lab and boards:** `/previews/water-splash.html` (live loop, preset / tier / Reduce Motion buttons; `?manual=1` and
  `window.__lab.shot(t)` for stepped stills, `window.__lab.bench()` for the frame time). `node e2e/water-splash-board.mjs
  --board 1 | 2 | vs | quick --out <jpg>` writes the owner boards (six moments: impact, crown rise, crown break, droplets,
  foam, ripples fading; `vs`: the splash and the vortex tornado side by side at battle scale, 844×390, high).
- **Credits** (licence texts, with their authors, in `public/licenses/`): the drops' clip of feathered fields follows the
  idea of the "Procedural Metaballic Splash" shader (MIT, `metaballic-splash-MIT.txt`; our own code); the foam ring's
  outlined band follows a waterfall shader breakdown's foam (CC0, `waterfall-foam-CC0-1.0.txt`); the round bubbles are
  our own lattice; the ripples follow the
  stylized-components water ripples (MIT, `stylized-components-MIT.txt`). No texture mask is used (the procedural lip
  and the clip gave crisper shapes than a sprite mask), so no mask file ships. When the splash is wired, add the three
  files to Settings → Licences (`LICENCE_FILES`).

## Electricity (`src/render/vfx/electric.js`, `electricPresets.js`, batch B2; lab only, not wired)

Crackle round bodies, the shocked-enemy crackle, an electric ground decal and two cast hooks, in the house look: the
bolts are the chain lightning's inked toon strokes (ink, body, white-hot core; crisp edges; erosion into dashes) and the
ground pieces are hand-written on the toon core. Not in the battle yet: the lab is `previews/electric.html`, and
`ELECTRIC_GIRLS` names who will use which preset once it is wired. Display only: the sim id does not change.

- **Pieces:**
  - **aura** (`aura(preset, x, z, { radius, height, y0, size, life, follow })`): short micro-bolts round a body,
    hugging a capsule (its radius, height and feet; hemispheres at both ends). They start on the body's silhouette as
    the camera sees it (its left and right edges, running mostly up and down it; `TOP_SHARE` over its top, starting on
    the back half and running only up, to the crown), and no joint of a bolt or its fork comes within `FACE_CONE`
    (1 rad, about 60°) of the side facing the camera: a side bolt ends at least `FACE_MARGIN` further out, and any kink
    that still strays in is set on the cone's edge on its own side (about 0.6 % of joints), so the crackle outlines the
    body and never crosses its face or chest (tests hold it). Joints never pass the crown or the feet, nor through the
    axis. The side away from the camera is hidden by the body itself.
    Each bolt is re-struck on its own beat (`restrike` 0.06–0.11 s: every few frames, never every frame) and shows for
    `duty` of its strikes, so the crackle thins and thickens bolt by bolt instead of the whole aura blinking. A strike's
    leader races along it (`grow`), holds (its ink leaving, segment by segment, over the hold), then erodes in its
    colour. A charge ring glows on the ground at the feet, broken into a few dashes that turn in steps (`RING_TURN`
    every `RING_STEP`); it inks only where its band is at least `RING_INK_PX` (1.5) px wide on screen, so a dash's thin
    tip draws no ink, and when the crackle ends its ink leaves over `RING_INK_S` (0.08 s) before it erodes out over
    `RING_END` (0.3 s). `follow` (an object with x and z) moves it with the body.
  - **shock** (`shock(preset, x, z, { radius, height })`): the same crackle, smaller and short-lived (`shock.life`
    0.5 s), on an enemy's body after a chain hit: a first burst of bolts at once, then sparser, then gone. No ground ring
    (it would read as a selection ring under every shocked enemy).
  - **scorch** (`scorch(preset, x, z, { size })`): the electric ground decal. Worley F2 − F1 cracks (the toon core's B
    channel, painted once) laid out in polar coordinates, so the cells narrow towards the middle and the cracks radiate;
    a hard step on the crack edges; a white-hot core in the young cracks that cools in patches to the body colour, then
    the deep band; a hard-stepped glow round the young cracks (high and medium); over a dark translucent burn. It holds
    whole for its first `SCORCH_HOLD` (0.2) of its age (the erosion threshold at its young value, so its only edges are
    its ragged outer silhouette), then erodes from its rim inward. While young, ink rims every crack and the burn's
    outer silhouette (outside `SCORCH_RIM_X` of its radius, where every edge of the held burn lies); a crack narrower on
    screen than `SCORCH_INK_PX` (6) of its rim's pixels draws no rim (it would be all ink: dark specks). All of the ink
    leaves at `SCORCH_INK_AGE` (0.09 of its age, ± 0.01 by the noise: a hard step that goes in patches over about two
    frames, so no patch of the silhouette lingers as a loose dark dash on the burn), before the hold ends, so the holes
    the erosion opens and the fragments of eroding cracks are never outlined: the burn goes in quiet tongues and the
    cracks end in the body and deep bands, never a scribble of dark specks (tests hold the timing). From
    `SCORCH_END.from` (0.82) of its age the cut climbs `SCORCH_END.add` (0.5) more, past its hottest heat, so its last
    flecks shrink away instead of popping off when it ends. The cracks race out over the first 0.12 s.
  - **burst** (`burst(preset, x, z)`): one drum beat's ring of bolts bursting out (`r0` → `r1` tiles over `life`, an
    ease-out), every other bolt with a spoke shooting out of the ring, re-struck on the beat while it bursts, eroding
    over its second half; a thin ring of light on the ground under it (never over white: a wide ring over white blooms
    into a soft halo). The ground ring holds whole (its young threshold, under the heat's floor in its middle: no hole)
    until `BURST_HOLD` (half its life); the bolts' and the ring's ink leave over `BURST_INK` (0.26 to 0.44 of its life),
    then both erode in their colour.
  - **link** (`link(preset, points, { life, closed })`): bolts arcing from point to point (in a loop when closed),
    each held and re-struck in place on its own beat (`arc.restrike` 0.1–0.16 s; its leader grows only on its first
    strike, so no half-grown arc ends in mid-air) with a small bow up or down, and little crackles where they join. An
    arc is on for `arc.duty` (0.95) of its strikes and never while another arc of the web is off: at least n − 1 of its
    n arcs are whole in every frame after the launch (tests hold it), so it reads as a web drone to drone. The points
    are the caller's objects, read every frame, so the arcs follow what they join. At its end, or after `stop()`, the
    web holds still while its ink leaves over `LINK_INK` (0.1 s), then erodes out over `LINK_END` (0.3 s), with no new
    strike.
- **The house rule: ink leaves before erosion opens holes** (as B1's foam): every eroding piece's ink leaves over a
  window of its life that ends before its erosion starts, so it ends in its colour bands, never as loose dark dashes.
  Its ink phase k runs 0 → 1 over that window, and a bit of ink (a bolt's segment, a ring's pixel) stays while
  k + `INK_WOBBLE` (0.8) × (w − ½) < ½, with w its own 0..1 (a hash of the bolt's seed and the segment's place, a ring's
  noise): a hard step in patches, all on below k 0.1, all gone from k 0.9. The windows: a strike's hold (crackles,
  shocks, the little crackles where arcs join), `BURST_INK` of a beat ring's life (its bolts and its ground ring),
  `LINK_INK` before a web's last `LINK_END`, `RING_INK_S` after a crackle ends (its charge ring), the first
  `SHOCK_RING_INK` (0.3) of a shock's ring under Reduce Motion, and the scorch's own `SCORCH_INK_AGE`. The strokes'
  ink is simply not pushed once it has left (strokes.js is unchanged). Tests hold every window (wobble included), that no
  ink stroke is ever drawn with an erosion cut on any piece, tier or look, and that no ring is drawn eroding with any
  ink left. Measured with `e2e/electric-ink.mjs` (below; every scene, 0 to 2.5 s at 1/60 s, 844×390 and 390×844, high
  and medium: 24 runs of 150 frames): 2,218 loose dark-ink fragments before (da4e8102; most of them the charge rings'
  inked dash tips, then the beat ring's eroding bolts and its ink ellipse), 18 after in look A and 10 in look B. Every
  one left is 1 or 2 px except one of 18 px in A, and none is an eroding piece: a whole piece's ink cut short by a chibi
  standing in front of it (a charge ring's rim peeking past Tenka's hair, the scorch's silhouette behind Raika's), or a
  single aliased pixel of a whole ring's rim.
- **Two looks** (`ELECTRIC_LOOKS`; a preset's `look`, the lab's `?look=a|b`, `createElectricFx({ look })` for every
  preset):
  - **A, inked line-work:** ink, body, white-hot core (the chain lightning's layers) on every bolt.
  - **B, a luminous sheath** (the presets' default): every bolt wears stepped solid bands of its own colour round its
    body (`ELECTRIC_LAYERS_B`, back to front: the ground ramp's deep band at `bands[0]` (2.15) × the body's half width,
    the bolt's body colour at `bands[1]` (1.5) ×, the glow band as the body (× `width` 0.8), the white-hot core):
    hard toon steps, solid (premultiplied over, so the joints stay clean; translucent bands would bead where the
    capsules overlap), no soft blur. Ink only outside the sheath of the main bolts (the beat rings' and the arcs'); the
    micro-bolts round bodies (crackles, shocks, the little crackles) have none. A crackle shows `bolts` (0.75) × the
    tier's bolts, each held `hold` (1.5) × longer and re-struck `restrike` (1.3) × less often; a beat ring's bolts span
    `burstSpan` (0.7) × the ring and re-strike `burstRestrike` (2) × less often (its wider bands bursting out would
    otherwise light more of the screen in a frame than the flash rule allows). A glow pool lies on the ground under each
    crackle (`pool.aura` 2.1 × its radius) and each beat ring (`pool.burst` 0.6 × the ring's radius): the toon core's
    heat and hard step over the ground ramp's deep and body bands, added light that covers little (`pool.cover`), no
    ink, turning in slow steps (none under Reduce Motion), eroding in and out (`pool.erode` past the hottest heat, so
    no tongue pops off). Same calls as A (the strokes, the ground).
  - Flash rules for B (the review's per-frame method, `e2e/electric-ink.mjs`, the same 24 runs): at most 1.45 % of the
    pixels change by 0.1 or more in linear luminance in any frame (the Drumstorm and all scenes, as its beat ring
    bursts out; the mean a frame at most 0.53 %), near-white at most 0.23 % (small cores), reddish effect pixels at most 0.04 %
    (A: 1.44 %, 0.21 %, 0.05 %). Its first try (the beat ring's bolts as long as A's, re-struck as often) reached 1.65 %;
    the shorter, slower beat-ring bolts brought it under.
  - Which reads closer to the tornado: B, a step closer, not the same. Its bands give each bolt the mass and the
    luminous stepped colour of the tornado's rings and the pools put light on the ground under it, so at 1:1 it reads as
    light rather than pen line-work; but it is still opaque line-work, not a translucent layered volume (the strokes
    cannot stack translucent bands without beading at the joints), and its micro-bolts, without ink, read softer on the
    sand. Board: `board-electric-3.jpg` (A against B, and B beside the tornado).
- **Cast hooks** (`ELECTRIC_CASTS`, lab presets; the battle's ⚡ casts are not wired to them yet):
  `cast('raika.drumstorm', x, z)`: her crackle for the boost, a burst ring on every drum beat (`beat` 0.5 s) and a
  scorch on the first (then every `scorchEvery`). `cast('chika.droneSurge', x, z, { points })`: bolts arcing drone to
  drone round her ring for the surge and a short crackle on Chika as they launch.
- **Branching:** our own rules, with ideas from three-stdlib's LightningStrike (MIT, re-implemented: no code taken).
  `fractalPath` halves a path's segments and pushes each new joint sideways by a share of the segment that shrinks
  each halving (`ROUGHNESS` 0.58); the last halving alternates sides and slides each joint along its segment (`skew`:
  long diagonals and short sharp jogs, a drawn zig-zag, never a random walk). A fork leaves from an inner joint, turned
  0.55–1.1 rad off the parent, shorter and thinner, reaching out off the body (it breaks the silhouette); one
  generation only. Each bolt's duty (shown for part of its strikes) and a leader that grows and then erodes are the
  library's subray period and propagation ideas, on our stepped beat.
- **Presets** (plain data), each in her chain's colours as they are live: `raika` (lightning `storm`: gold, violet
  ink), `chika` (`tesla`: ice blue, navy ink, a cyan glow band), `tenka` (`arcane`: violet-white, indigo ink), `seiran`
  (her style's sky chain `#9fd8ff` on a storm-blue glow, indigo ink), `yuzuha` (`sakura`: pink electric, plum ink). The
  bolts take the chain's ink, body and core exactly; the ground ramp (8 bands: ink, burn, deep, body, glow, core,
  white) is built on the same hues. No bright colour reaches the flash guard's red share (tests hold it).
- **Tiers** (`ELECTRIC_TIERS`): high 8 bolts a body, 4 a shock, 2 halvings, 1 fork, 10 bolts a beat ring, 3 halvings
  an arc, 2 node bolts, the scorch's glow, the cores over white with bloom; medium 6, 3, 2, 1, 8, 3, 1, glow; low 4,
  2, 1 halving, no forks, 6, 2, none, no glow. The stroke list is capped by the tier (`cap`) and the strokes' room, a
  whole bolt or none (never an ink-only line). High with bloom: the body × `BODY_UNDER_BLOOM` (under the grade's knee,
  as the chain's).
- **Reduce Motion:** no bolts round bodies or in the beat rings: a still glow ring at the feet (`ELECTRIC_REDUCE_ALPHA`,
  nearly whole, no turning) stands for the crackle, and a still ring for each beat, faded in and out over
  `REDUCE_FADE` (0.12 s: no hard on-cut each beat); a scorch fades in over the same; the arcs are struck once and held
  (they still follow their points); no flicker; scorches and casts live `TOON_REDUCE.life` × longer; no swirl in the
  cracks.
- **Flash safety:** every strike (each bolt's, each beat ring's, each arc's, each scorch) asks `flashGate` once with
  its size and flicker (`flicker` 0.3: the core dims on alternate strikes). Past the budget the core is drawn at the
  guard's answer and nothing goes over white. Every piece is small (a beat ring is under 3 tiles across): nothing is
  full screen. Flashes & shake off (`setFlashes(false)`, on pieces already up too): the guard is not asked, no flicker,
  nothing over white. Impact frames: `hold(true)` hides both layers. The real `FlashGuard` is tested through the
  battle's gate (screen share at phone size, 844×390 and 390×844 on the lab patch's close framing): eight crackling
  bodies, a Drumstorm, a Drone Surge and a shock every 0.2 s for 3 s use at most about 0.28 screens a second of the world
  budget's 2 and are never dimmed; the lab asks the same real guard (its load is in `__lab.stats()` and the boards' log).
- **Draw cost:** two instanced calls at most (the bolts' strokes: its own call standalone, the battle's shared strokes
  when wired; the ground pieces: one call), 0 when idle. Every record, path and buffer is allocated once at the high
  tier's sizes (`MAX_AURAS` 12, `MAX_BURSTS` 6, `MAX_LINKS` 2 of up to 8 points, `MAX_SCORCHES` 8, `MAX_CASTS` 4);
  `update()` writes numbers into them; paths are re-struck on the beat, never per frame. A full pool reuses its oldest
  record, except crackles and shocks (one pool): first a record already ending, then the oldest shock, then (for a
  crackle only) the crackle with the least time left; a shock never takes a girl's crackle (it is dropped instead). A
  reused record's `gen` goes up, and a cast that pointed at it lets go of it, so stopping that cast never ends someone
  else's piece.
- **Randomness:** the stream it is handed (`vrand.fork('electric')` when wired; without one, a fixed fork of its own, so
  the bolts still differ); time from the visual clock.
- **Cost:** CPU about 70–90 µs a frame on high and medium, 33 µs on low (node, this machine) with seven crackling
  bodies, a Drumstorm and a Drone Surge up (about 900 strokes on high): mostly the stroke writes. Round 2 (the same busy scene,
  node, this machine): look A high 99 µs, medium 91, low 28 (618, 615 and 180 strokes); look B high 115 µs, medium 87, low
  26 (888, 688 and 216 strokes: its five layers, fewer bolts), the same two calls; B's glow pools add one ground instance
  per crackle and per beat ring (`MAX_GROUND` holds them). The hot path keeps
  its numbers in typed scratch arrays (never boxed into helper arguments or closure variables) and walks its pools
  with index loops (no iterators), so an idle layer does no work and allocates nothing (sampling heap profiler: about
  360 B a frame of for-of iterators before, 0 now). A busy frame (seven crackles, a Drumstorm, a Drone Surge; node,
  the inspector's sampling heap profiler with scavenged objects) allocates about 6.5 KB: about 3.6 KB is the visual
  random stream's draws (`random.js`: each of the ~220 draws a frame comes back as a heap number), about 1.3 KB the
  strokes' upload (`strokes.js` `end()`: three's update ranges), about 1.5 KB the strikes' paths (`fractalFill`,
  `strikeCapsule`, on the beat), and nothing from the ground pieces or the per-frame collect and write.
  Headless SwiftShader frame time on the lab board with eleven crackling bodies, a Drumstorm and four scorches up:
  high 313 → 349 ms, medium 133 → 163, low 101 → 118 (CPU raster: compare runs, nothing absolute about a phone), +2
  draw calls.
- **Lab and boards:** `/previews/electric.html` (live loop; scene, preset, tier and Reduce Motion buttons; `?scene=aura|
  shock|scorch|drumstorm|surge|all`, `?manual=1` and `window.__lab.shot(t)` for stepped stills, `window.__lab.bench()`
  for the frame time). The shock scene strikes Raika's live chain (lightning.js, `storm`) through three goblins and
  starts the shock on each as its hop lands. Real chibis (and goblins) for scale; the drones are lab stand-ins.
  `node e2e/electric-board.mjs --board 1 | 2 | 3 | quick --out <jpg> [--look a|b] [--url http://127.0.0.1:<port>]`
  writes the owner boards (3: look A against look B, and B beside the tornado). `node e2e/electric-ink.mjs --url …
  --look a|b --out ink.json` steps every scene at 1/60 s from 0 to 2.5 s at 844×390 and 390×844, high and medium, draws
  each frame again with the layer hidden (`__lab.bare()`), and counts loose dark-ink fragments (8-connected groups of
  pixels the layer made dark, luma under 0.2, smaller than 40 px, with no colour pixel of the layer within 2 px, or
  fewer colour pixels within 2 px than ink pixels) and the flash numbers (pixels whose linear luminance changes by 0.1
  or more in a frame, near-white, reddish). `node e2e/electric-chain-diff.mjs --capture | --ref … --out …` diffs stills
  of the live chain lightning in the shock scene with the electric layer hidden.
- **Credits** (licence texts, with their authors, in `public/licenses/`): the branching ideas from three-stdlib's
  LightningStrike (MIT, `three-stdlib-MIT.txt`); the Worley cells are the toon core's (`webgl-noise-MIT.txt`). When the
  electricity is wired, add `three-stdlib-MIT.txt` to Settings → Licences (`LICENCE_FILES`).

## Toon beams (`src/render/vfx/toonBeams.js`, `toonBeamPresets.js`, batch B3; lab only, not wired)

Held beams, a charge-up and an impact crown on the toon core, in the tornado's house look: luminous, layered strokes,
hard toon steps, noise erosion, an inked outer silhouette only, premultiplied (never a soft glow tube). Not in the battle
yet: the lab is `previews/beams.html`, and `TOON_BEAM_GIRLS` names who will use which preset once it is wired. Display
only: the sim id does not change.

- **Pieces** (`fire(preset, a, b, { half | width, held, hold, hit, windup, face, faceR | faceBox })`,
  `aim(rec, a, b, { hit, face })`, `release(rec)`):
  - **body**: a band from the muzzle to the target, drawn as a ribbon along its path in view space (mitred joints, so a
    zig-zag has no gap and no overlap at a kink), in layers:
    - its **outer silhouette**: one clean curve an edge, each a function of the distance along it only: swept tongues
      streaming out along it with the flow (`BEAM_TONGUE`: 2.6 half widths apart, their valleys at 0.6 of the half
      width, their size and spacing from the house noise);
    - a **sheath** inside it: its deep band at the outer edge, the body colour in (the band edge broken by the noise);
    - **strands** twisting round its middle (`TOON_BEAM_TIERS.*.strands`: 3 on high and medium, 2 on low; `twist` turns a
      tile) and running out along it with the flow, broken into swept strokes (`BEAM_STRAND`: tapered at both ends,
      their tails towards the muzzle), each with its own deep rim, then light and core, white on the front strands'
      hottest; the front-most stroke wins the pixel, so they cross over and under each other like the tornado's rings.
    The **ink rim** (at least `BEAM_INK_PX` 1.3 px, or `BEAM_INK_X` of the half width, its weight varying along it like
    a brush line, never more than `BEAM_INK_CAP` 0.42 of it) is worked out from the silhouette's own curves: the
    distance in from the nearer edge. It is never worked out from heat minus the cut, so no noise valley, near-hole or
    seam inside the colour is ever inked. There is no ink within `BEAM_FACE_CLEAR` (0.6 tiles) of the muzzle, none
    within `CROWN_INK_CLEAR` (1.3) crown radii of a crown that is up (its own silhouette is there), and none while a Reduce Motion fade-in is under
    full strength. **Her face:** none of the body is drawn over her head on screen: inside the box round her head in
    the view plane (`faceBox`, the lab's box round her figure's top 42 %; or a circle of `faceR`) nothing is drawn, and
    the beam grows out of its edge over `FACE_GROW` (1.4) half widths. So a beam from Miko's mirror behind her shoulder
    leaves from beside her head, never over it.
    Hard-stepped beats: the head races out in `HEAD_STEPS` (3) steps as a spear tip at `LEADER_WIDTH`, then the band
    punches in at `BEAM_PUNCH` (1.42, 1.16 × its width, a step each 1/30 s) and settles; it holds (a fired lance for
    `hold`, a held beam until `release()`); while it holds it is whole inside its silhouette (no holes); its end thins
    in steps (`BEAM_END_WIDTH`), its ink leaves at `BEAM_INK.end` (0.12 of the end, ± 0.04 along it: one clean front from
    the muzzle on) and only then, from `BEAM_ERODE_AT` (0.2), the erosion rises from the muzzle on to the target
    (`BEAM_LAG`), so it erodes out along itself into its colour bands and never pops off. A zig-zag lance (Raika) is the
    same band on a kinked path (long diagonals, short jogs), struck again every `restrike` (0.05 s, on twos).
  - **prism** (Kohaku & Tsubaki): the same body with a strand per colour of the duo's Grand Spectrum braided round it
    (`TOON_BEAM_TIERS.*.prism`: 5 on high and medium, 3 on low), each in its own colour, its light row over the core
    heat, white on its peaks; twisting along it (`twist`) and turning (`spin`) over a lilac sheath; one ink rim round
    the whole beam.
  - **charge-up**: where the beam is first seen (the muzzle, or past her head on screen by `CHARGE_FACE_GAP` of its
    size, with a camera to see it by; `CHARGE_AHEAD` 0.16 tiles out towards the target), over her wind-up (`WINDUPS`,
    read from today's patterns: a staff girl's cast clip 0.6 s × 0.3 = 0.18 s, Miko's gohei 0.15 s, the duo's beam lock
    0.08 s): a ring (0.58 to 0.62 tiles × the beam's width share) gathering in from `CHARGE_R[0]` to `[1]` in
    `CHARGE_STEPS` (4) hard steps and streaks converging on it, both eroding in. No ink, and nothing of it inside her
    face's box. Its release bursts out to `CHARGE_BURST` and erodes over `CHARGE_RELEASE` (0.18 s) with a short white
    flash (flash-guarded).
  - **crown**: at the hit point, a burst of uneven, curling tongues in two layers (`TOON_BEAM_TIERS.*.tongues`; the
    outer layer in the body colour with its own deep rim, the inner one light and curled further, a core round its
    middle; their lengths, where each one peaks and the curl re-rolled every `crown.beat` 0.08 s), drawn in front of the
    enemy. No dark ink: it stands over the glow pool and the enemy, so its silhouette is its deep band (as the tornado's
    rings have no outline), and that deep rim leaves at `CROWN_INK.end` before it erodes from `CROWN_ERODE_AT`. It
    punches in at `CROWN_PUNCH` with a white flash in its middle (flash-guarded), then its hole opens (`CROWN_HOLE` 0.34:
    the enemy stays visible through it). Its angle is seam-free: the record's seed is a whole number and every tongue
    index is taken mod its count, so where atan wraps falls between two tongues (`crownOuter` is its JS mirror; the
    tests hold it continuous). A held beam's crown bursts again on a new hit (`aim(…, { hit })`), at most once each
    `CROWN_REBURST` (0.34 s, 3 a second at most); a hit back sooner brings the crown back in its punch steps with no
    white flash and no new ask of the flash guard. It ends with the beam, or over `CROWN_END` when the hit stops.
  - **ground**: a stepped ring running out from the hit point (`RING_STEPS` radius shares over `ring.life`, starting
    outside the glow pool, again every `ring.every` while a held beam hits), inked on its outer edge only (worked out
    from its actual eroded edge, as the body's) and on its front arc only (`RING_INK_FRONT`: its far arc runs behind
    the crown and the beam on screen), its ink
    leaving at `RING_INK.end` (0.42) before it breaks into dashes at `RING_ERODE_AT` (0.54); and a glow pool under the
    hit (no ink) that cools in two steps into a small scorch as the beam ends and erodes from its rim inward over
    `pool.linger`.
- **Blend: the glow cover** (as the water's and the electricity's): the colour is encoded for the target, then added, and
  each band hides `BEAM_COVER` of the board (deep 0.85, body 0.74, light 0.6, core 0.86, white and ink 1); on the canvas
  tiers the translucent bands add `BEAM_CANVAS_ADD` (0.45). On high with bloom the white band goes `hdr` over white,
  scaled by the flash guard's answer.
- **Presets** (plain data, today's colours and widths, every preset the same shape: `SHAPE` fills the fields a preset
  has none of, so the hot path reads one object shape): `umeko` (Searchlight Sweep: held.js `SWEEP_BODY` #fff3c4 and a
  white core; the sim's `SWEEP_HALF_WIDTH` × `HELD_VISIBLE` 0.62, the share of today's soft band that reads), `luna`
  (moonbeams: s5held.js `MOON_BODY` #d9ceff and `MOON_CORE` #f6f2ff on the moon lance's ink and body; `MOON_HALF_WIDTH` ×
  0.62 × `PAIR_SWEEP` 0.78: her two beams always sweep in mirror, so each is drawn a little narrower and the pair's
  per-frame change on a phone stays near one beam's; from her staff tip, as s5held.js draws them today), `kohaku` (the
  prism: `LILAC` #c9a8ff and the Grand Spectrum; its width from Kohaku's beam × `PRISM_HALF_SHARE`), `miko`
  (beamPresets.js `holy`: ink, body, core; × 1.1) and `raika` (`storm`, 6 kinks, 2 on low). A fired lance's half width
  is today's `BEAM_HALF` from the sim's beam width (`LANCE_HALF`). No band above the ink and no stripe reaches the flash
  guard's red share (tests hold it).
- **Tiers** (`TOON_BEAM_TIERS`): high 9 crown tongues, 8 charge streaks, the ground ring and pool, 5 prism strands, 3
  strands, 6 kinks, over white with bloom; medium 7, 6, ring and pool, 5, 3, 6; low 5 tongues, no streaks, ring or pool,
  3 prism strands, 2 strands, 2 kinks.
- **Reduce Motion:** a still beam (no flow, spin, re-strike, racing head or punch: its strands and tongues hold still)
  whose colour fades in over `REDUCE_FADE` (0.12 s) while its ink comes in only at full strength (no muddy half-strength
  rim); a still glow at the muzzle (no streaks, no gathering, no release burst); no crown and no ring at the hit, a held
  glow pool instead; the end's ink leaves, then it erodes in place (no travelling front), over `TOON_REDUCE.life` ×
  longer. The flash guard is not asked (nothing flashes).
- **Flash safety:** every charge release and every impact (a held beam: a new hit, at most once each `CROWN_REBURST`)
  asks `flashGate` once with its size (under 1.6 tiles: nothing near full screen); the answer scales the burst's white
  flash and the over-white boost, so past the budget the burst is drawn at `WORLD_DIM` and nothing goes over white.
  Flashes & shake off (`setFlashes(false)`, on beams already up too): the guard is not asked, no burst flash, nothing
  over white. Nothing in a beam flickers: the crown's tongues change shape on the beat, not brightness, and a hit that
  chatters (on and off every frame or two) bursts at most 3 times a second (tests hold it). The real `FlashGuard` at
  phone size (844×390 and 390×844 on the lab patch's close framing): five held beams with hits toggling and three
  lances every 1/3 s for 3 s stay under a quarter of the world budget and are never dimmed (tests hold it); the lab
  asks the same guard (`__lab.stats()`).
- **Draw cost:** three instanced draw calls at most (the bodies; the charge-ups and crowns, camera-facing; the ground
  pieces), 0 when idle. Every record and buffer is allocated once for `MAX_TOON_BEAMS` (16) at the high tier's sizes
  (`MAX_BEAM_JOINTS` 8 a path); `update()` writes numbers into them and uploads the small buffers whole (no update
  ranges). An idle layer does no work.
- **Cost:** per-frame allocation, node `--expose-gc`, heap delta over 20,000 frames after warm-up, against a harness that
  itself allocates 0 to 0.2 B a frame: one aimed held beam, six aimed held beams, a held prism or a held zig-zag (struck
  again every 3 frames) 0.01 B a frame; six held beams aimed every frame with faces plus two lances fired every 40 frames
  about 3 B a frame on medium and low. Each `fire()` costs about 0.6 KB once (its cold path's numbers), not per frame.
  The hot path reads plain number fields (each record's beats are worked out once at its fire), takes no double through
  a call, uses no variadic `Math.hypot`/`Math.min`, and the zig-zag's jitter is hashed from the record's seeded value
  (`toonHash`), not drawn a joint. Fragment cost: the body samples the noise texture 4 times plus once a strand (7 on high
  and medium, 6 on low, 9 for the prism's five) over a thin strip of the screen.
- **Dark-ink check** (`node e2e/beams-ink.mjs --port <dev server>`): every preset's whole loop stepped at 1/60 s, at
  844×390 and 390×844, on high and medium, the whole view; a pixel the beams darkened under 0.2 luma is ink; a component
  of such pixels under 40 px touching no colour pixel of the beams is a loose dark-ink fragment; a component that
  touches the beams' colour but no untouched background pixel (the screen's edge counts as background) is **interior
  ink** (ink inside the colour, not on its true outer silhouette); the beams' ink pixels inside each girl's face (the
  top 42 % of her figure on screen) are counted apart. All three must be 0 (exit 1 otherwise). **Known open case:**
  where two beams overlap (the moonbeams' pair converging on one enemy, the duo's second beam starting beside the
  first), each keeps its own ink rim, so one's rim runs across the other's colour; on high the bloom lifts the board
  between them, so the check counts those rims as interior (Luna and the duo fail it on high: up to 6 frames of a
  loop, 24 px). A two-pass body (every beam's ink, then every beam's colour) was tried: it removes the long crossing
  rims but leaves short seams where the two edges interleave and counted worse on medium, so it is not in. The fix is a
  union outline (ink outside the silhouette, drawn under every beam's colour), still to do.
- **Randomness:** the stream it is handed (`vrand.fork('beams')` when wired; without one, a fixed fork of its own) for
  each record's seed and flow; everything after that is hashed from the seed (never Math.random); time from the visual
  clock.
- **Lab and boards:** `/previews/beams.html` (live loop; scene, tier, Reduce Motion and today's-look buttons;
  `?scene=umeko|luna|kohaku|miko|raika|all`, `&old=1` draws today's live beam through the current code, `?manual=1` and
  `window.__lab.shot(t)` for stepped stills, `__lab.moments()` for each preset's beats, `__lab.inkScan(t)` (loose,
  interior and face ink), `__lab.bench()`). Real chibis and goblins for scale; the beams are aimed at the goblins, with
  their muzzles where today's code starts them (the staff tip through the attack context, Miko's mirror, the duo's lens),
  and each girl's head box passed as `faceBox`. The lab fires each beam with its preset's wind-up (`WINDUPS`), which is
  the wiring's target (see the wiring note).
  `node e2e/beams-board.mjs --port <dev server> --board 1 | 2 | quick --out <jpg>` writes the owner boards.
- **Credits** (licence texts, with their authors, in `public/licenses/`): the beam's core with an outline round it and
  its progress wipe follow the idea of the "Energy Beams" shader (CC0, `energy-beams-CC0-1.0.txt`; per-record seeds use a
  common one-line sine hash of the same form as the one there); the gathering effect at the muzzle and a separate one
  where it collides follow the idea of a laser beam demo's code (MIT, `laser-beam-MIT.txt`; none of its art). Our own
  GLSL on the toon core, no code taken. When the beams are wired, add the two files to Settings → Licences
  (`LICENCE_FILES`).

### Wiring note (for the batch that wires it; nothing here is wired)

- **What it replaces:**
  - `src/render/attackFx/patterns/held.js` `drawHeld`, the `sweep` branch (Umeko's Searchlight Sweep: one alpha band and
    one additive core quad a frame): a held `umeko` beam, fired when her channel opens (`t.ch` appears), `aim()`ed every
    frame from `t.ch.k` and her range (the same `Lb` end), `release()`d when the channel closes or she is disabled. The
    `stream` branch (Hearth Stream) stays: it is the flame stream of B7.
  - `src/render/attackFx/patterns/s5held.js` `moon()` (Luna's Moonbeam Sweep: an alpha band and a core per beam, fading
    over `MOON_LINGER`): one held `luna` beam per `m.hits` entry, fired on the `moon` event, aimed every frame from
    `moonDir(m, b)`, released when the pass ends (its end erosion replaces the linger fade). `mist()` stays.
  - `src/render/attackFx/styles/kohaku_tsubaki.js` `update()` (four soft quads a beam): a held `kohaku` beam per hold,
    fired on a new lock (her `r.uid` changes: `windup` = today's `FADE_IN`), aimed every frame at the lens anchor and the
    enemy (`r.bx/bh/by`; a long beam's edge-to-edge line as `b`), released on the fade-out branch; Resonant Light's ramp
    `r.k` → `half` × (1 + 0.25 k); Grand Spectrum keeps the prism's strands (one beam, five colours) instead of one colour
    a beam. Her prism's soft glow quad goes (the charge-up and the beam's own muzzle replace it).
  - `src/render/vfx/beams.js` `fire()` for the presets `holy` (Miko's ray) and `storm` (Raika's lance): `miko.onBeam` and
    `raika.onBeam` call the toon layer's `fire('miko' | 'raika', a, b, { width: ev.width })` instead. **The charge-up
    needs the call moved to the attack's wind-up:** the sim's `beam` event is the hit, so fired there the lance has no
    wind-up left. Fire it when her attack animation starts (the attack context's cast/swing start, `WINDUPS.gohei` 0.15
    s and `WINDUPS.staff` 0.18 s before the hit, as the lab does), and give it `windup` = the time left to the hit. If the
    call stays on the `beam` event, pass `windup` = today's `charge` (0.04 / 0.035 s): the beam still lands on time, but
    its charge-up is 2 or 3 frames and its 4 `CHARGE_STEPS` cannot play (the boards do not show that case). `beams.js`
    stays for Luna's moon lances and every default `fx.beam` (its strokes, its impact lines, its sprites in the shared
    batches).
- **Hooks:** `BattleRenderer` makes one layer (`createToonBeamFx({ scene, camera, quality, reduceMotion, rand:
  vrand.fork('beams') })`; the camera is needed for the charge-up to gather past her head), hands it `flashGate` (as the
  beams' and the electricity's), `setPixel(rig.scale)`, `setGlow(quality, bloom)`, `setQuality`, `setReduceMotion`,
  `setFlashes`, `hold(impact.active)` and `update(visualDt)` between the batches' begin and end, `clear()` on a new
  battle and `dispose()` with the renderer; the attack context carries it as `ctx.toonBeams` through a `guarded` entry
  (`tests/render/vfx-library-guard.test.js`), so a library error sends the girl back to her old look. Each girl's `face`
  is her head (her view's figure box, the top 42 %) and `faceBox` the half width and height of that box in the view
  plane (as `previews/beams.js` works it out). `settings.attackFx === false`: nothing is fired.
- **Handles:** `fire()` returns a pooled record. Keep `{ rec, gen: rec.gen }` and ignore the handle (no `aim()` and no
  `release()`) once `rec.gen` differs from the kept `gen` or `rec.on` is false: past `MAX_TOON_BEAMS` a new beam takes a
  record that is still ending (or the oldest), and a stale handle would steer another girl's beam.
- **Deriving `hit`:** `hit` is true while the sim's hit list for that beam this step is not empty (a sweep: an enemy
  under its end; the prism: its locked enemy alive). Keep it true for a few steps after the last hit (about 0.1 s) so a
  sweep crossing a crowd does not chatter; the layer also never bursts a crown more than once each `CROWN_REBURST`.
- **Draw calls:** +3 while any toon beam is up (+2 on low), 0 when none is; the old held quads (2 a sweep, 2 a moonbeam,
  3–7 a prism beam (two lines, a glow quad and 0–4 extension lines) and 1 on her prism, in the shared batches: no calls
  of their own) go, and `beams.js` keeps its share of the shared strokes' one call.

## VFX library: toon strokes, chain lightning and beams (`docs/specs/VFX_LIBRARY.md`)

The owner's plan for a styled look on every attack is `docs/specs/VFX_LIBRARY.md`: the house style, the research notes,
every attack and the batch that styles it. Display only: the sim id does not change.

### Toon strokes (`src/render/vfx/strokes.js`)

- **What:** a capsule between two world points: round caps (clean joints), a crisp anti-aliased edge (no soft fringe).
  An effect draws a line as layers pushed back to front: a dark ink line, the body colour, a white-hot core. It pushes
  all of one layer, then the next, so a later layer covers an earlier one at every joint.
- **Per stroke:**
  - u along it and the leader's head and tail (nothing past the head, nothing before the tail).
  - Erosion (`cut`): a hard cut through a 1D noise along the stroke, so the line breaks into dashes.
  - Running bands (`BANDS`) and a soft added glow (`GLOW`).
  - `hdr`, the colour × (1 + hdr): over white for the bloom (high only).
  - `minPx`, the thinnest it is drawn: a line never thins into shimmering hairs on a phone.
- **Draw cost:**
  - One instanced draw call for every styled line of the battle; hidden while nothing is pushed.
  - Premultiplied blend: the solid layers cover, the glow adds.
  - Begun and ended with the sprite batches each frame (`BattleRenderer`), held through both impact frames, at most 8192 strokes in a battle.
  - Full: every layer checks the room left (`strokes.room()`) before it draws and drops whole lines, the newest first, so a line keeps its ink, body and core or is not drawn at all (never an ink-only dark line). Lightning and the styles' segments drop whole segments (the newest bolt can stop short of its last target; a zig-zag can keep only its first parts). The layers take the room in frame order: the styles' segments, lightning, beams, slashes and rings, then the ribbons, so under extreme load the decorative ribbons thin before the hit feedback. `renderer.vfx.strokes` and `strokesRefused` show the load to captures.
- **Setting:** the attack effects option covers the library too: off (`settings.attackFx === false`), nothing is handed to it and no tornado starts (no chains, beams, slashes, rings, ribbons, toon segments or Starmine column: every effect keeps the plain look), and its layers stay idle (nothing pushed, no draw call). Only the previews set it today (`previews/renderer.js` `&fx=off`, the attack A/B in `previews/attacks.js`): no Settings toggle sets it, and the save does not keep the key (`cleanSettings` in `src/systems/save.js`).
- **Errors:** an error anywhere in the library (an update, the projectile feed, a hand-off from `fx.js`, an attack style's call or the styles' segments) switches the whole library off for the battle (`vfxSafe` / `vfxOff` in `BattleRenderer`, logged once): its layers are cleared, nothing of that frame's strokes is drawn, and every effect goes back to its old drawing. The attack styles reach the library through guarded calls (`attackFx.ctx.lightning` / `beams` / `shapes` and `ctx.vfxError`), so the signature looks stay on and the attack that met the error draws its old look (it gets nothing back). They carry only `strike`, `fire` and `slash`: a new library call for the styles is added there as another `guarded` entry (and to `tests/render/vfx-library-guard.test.js`).

### Chain lightning (`src/render/vfx/lightning.js`, `lightningPresets.js`)

- **Who:**
  - Raika's chains and Chika's Tesla Tower chains (their attack styles: `attackFx/styles/raika.js`, `chika.js`).
  - Storm Lance and every other chain the default layer draws (`fx.chain` hands it the points).
- **Look:**
  - Each hop is a zig-zag: long diagonals and short sharp jogs (`skew`), with a fork or two.
  - Layers: a dark ink line (violet under gold, navy under ice blue), the body, a white-hot core.
  - Each hop's leader races from the girl to its target in `grow` (0.05 s). The hops start one after another: the last one starts within `CHAIN_SPAN` (0.24 s) however long the chain is, and lands about 0.05 s later.
  - The path is struck again on a stepped beat (hand-drawn crackle). The core dims on every other strike.
  - It leaves by erosion: it breaks into dashes and is gone.
  - At each target: a star (flash-guarded), sparks (petals for sakura) and a ring on the ground.
- **Presets:** `storm` (Raika: gold, violet ink), `tesla` (Chika: ice blue, navy ink; gold at the top of her path),
  `arcane` (mystic violet), `sakura` (pink, plum ink, petals). Another chain colour gets storm's shape in that colour,
  with a dark ink of its hue.
- **Tiers:** high 6 kinks a hop, 2 forks, 5 sparks; medium 5, 1, 3; low 4 kinks and no forks, sparks or ground rings.
  A busy board thins new bolts (fewer kinks, no forks) long before any cap. High with bloom: the core goes over white
  and the body stays under the grade's knee (`BODY_UNDER_BLOOM`).
- **Reduce Motion:** one still path a hop (no re-strike, no flicker), slower erosion, no turning sprites, half the sparks.
- **Dev lab:** `?lightningLab` (dev server only, like the tornado's): presets, hops, forks, live tuning (colours included: the lab strikes with its edited preset), "Copy preset".

### Beams (`src/render/vfx/beams.js`, `beamPresets.js`)

- **Who:**
  - Luna's moon lance (it still sweeps: its end slides in from the last one), Miko's holy ray, Raika's Overcharge lance (a zig-zag struck again on the beat). (B3's toon beams, lab only, will take Miko's ray and Raika's lance: see "Toon beams".)
  - Every beam the default layer draws (`fx.beam` hands it over, in the beam's own colour).
- **Four beats:**
  - Charge: a thin line races out, with a muzzle flare.
  - Punch: it slams in wider (`overshoot`) and settles.
  - Hold: bright bands run out to the target.
  - Leave: it thins, its back end chases its front into the target, and it breaks into dashes.
- **Impact:** a star (flash-guarded), a burst of inked impact lines flat to the camera, sparks spraying back, a ring on the ground, a brief scorch.
  - The styles' own end stars, flashes and scorch marks (Luna's, Miko's, Raika's) are left out while the beam draws, so each end has one flash and one scorch; they come back on the fallback.
  - Luna's tier cues ride on her lance: wider with each P0 step, and her T5 sheath colour.
- **Tiers:** high 8 impact lines, 5 sparks, running bands; medium 6 and 3; low a plain solid beam (no lines, sparks, ring, scorch or bands).
- **Reduce Motion:** no punch, running bands, chasing tail, impact lines or re-strike; still sprites; half the sparks.

### Attack styles' segments as toon strokes (batch B2, `src/render/attackFx/patterns/segments.js`)

- **What changes:** with the battle's strokes (`ctx.strokes`), every additive segment of every attack style is a solid toon line: tracers, thrust lines, zig-zags, mini-arcs.
  - Layers: ink, body, and a white-hot core for `SEG_CORE`, pushed layer by layer so the joints stay clean.
  - Leaving: it thins and breaks into dashes instead of fading.
  - `SEG_FLICKER` and `SEG_ZIGZAG` move on a stepped beat (`TOON_SEG.beat`, 0.05 s); still under Reduce Motion.
- **Unchanged:** ropes and sight lines (`SEG_NORMAL`) keep the soft quads, and so does every segment when there are no strokes.

### Projectile trails (batch B3, `src/render/vfx/trails.js`)

- **What:** every projectile in flight draws a short toon ribbon behind it: ink, its element colour and a white core.
  - It tapers to a point and breaks into dashes at the tail.
  - When the shot lands or vanishes, the ribbon is pulled in after it (`TRAIL_TAIL`, 0.12 s).
  - `TRAIL_KINDS` sets each kind's length and width (arrow, bolt, spark, bullet, fireball, shuriken, shell, flask).
  - A shot whose attack style already draws its own trail (the style sets `view.ownTrail`: every shot of Aoi, Hana, Iroha, Kage, Kinu, Nami, Ruri, Yoriko, Yuki and Yuzuha, Akane's shots when her look has smoke or embers, Hikari's T5 shots, Chika's drone bullets and Marumi's lobbed shells where her own trail draws) gets no ribbon, so it never draws two; a shot without a trail of its own keeps the ribbon. `tests/render/vfx-trail-optout.test.js` holds both: each girl alone in a real gallery battle (base and three builds, high and medium), and every girl whose style draws her shots in `view()` must reach its checks, except a view that skips every shot (a skipped shot gets no ribbon) and Hikari, whose view draws only for a projectile attack while her attack is a pulse at every hero level (her T5 lance branch cannot run today). Yuzuha's battle runs 40 s so her sentries meet the enemies.
- **How:** `actors._syncProjectiles` feeds it where each shot is drawn (read only).
- **Tiers:** high 160 ribbons of up to 7 joints, medium 90 of 5, low none.
- **Reduce Motion:** ribbons 30% shorter.

### Slashes and shockwaves (batches B4, B5, `src/render/vfx/shapes.js`)

- **Slash:** a crescent of toon strokes flat to the camera (ink, body, white core), thickest in its middle and pointed at both ends. It sweeps across in `SLASH.grow`, holds, then its tail chases its front off and it breaks into dashes. Every default slash (`fx.slash`) draws one, and so do the attack styles' own slashes (Kage, Kinu, Luna, Ruri, Wakaba, Yoriko) through `toonSlash` (`src/render/attackFx/patterns/bursts.js`); without the shapes layer they keep their slash sprites.
- **Shockwave:** a ring of toon strokes on the ground. It bursts out with an ease-out, thins as it goes and breaks into dashes over its second half. Every default pulse (`fx.pulse`) draws one; the sparks stay.
- **Tiers:** joints per arc (high 12, medium 9, low 6); a ring's joints grow with its radius (`RING_JOINTS`: 20 a tile, at least 16) up to 40, 32 and 24, so no ring shows as a polygon (up to 2.5 tiles it stays within 0.025 of a tile of a true circle on every tier); and the most shapes up at once (32, 24, 16).
- **Ground:** a ring's band faces the camera, so it is lifted by its half width with the ink and never dips into the ground.
- **Flash guard:** toon slashes and rings cover the board rather than add light, so the flash guard does not count them (the old additive slash sprites were counted).
- **Reduce Motion:** no sweep or chasing tail; the ring grows linearly and lasts a little longer.
