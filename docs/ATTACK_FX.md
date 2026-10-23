# Attack FX — unique, readable attack animations

Owner request (Oct 13): *"make it so attack animations are more unique, like what if the drones flew
around in her radius and targeted enemies and followed them"*. Code: `src/render/attackFx/**`.
Preview: `previews/attacks.html`. Checks: `tests/render/attackFx-*.test.js`, `e2e/attack-fx.mjs`.
Owner reels: `e2e/attack-reel.mjs`.

## Ground rules

- **Purely visual.** The sim decides every hit and its timing; attack FX only reads sim state and
  events and draws. Nothing under `src/sim`, `src/online` or the hashed data changes, so the co-op
  sim id stays the live game's (`06763e510bb4` after the co-op rematch merge; `node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"`;
  `e2e/attack-fx.mjs` compares it with the live branch).
  `tests/render/attackFx-registry.test.js` asserts no `src/render/` file is in the hash graph; the
  integration test compares a sim digest with FX on and off.
- **No writes to sim objects.** Styles get towers / projectiles read-only (a strict test mode hands
  them deep-frozen clones). No `sim.rng`, no sim helpers with shared scratch.
- **Truth rules.**
  - T1 Anything drawn reaching an enemy reaches the enemy the sim targeted (the event's `targetUid`)
    or hit (an attributed `hit` uid), at the sim's time (+ ≤ 60 ms readability stagger: chain hops,
    firefly flights).
  - T2 Projectiles: every horizontal offset (origin blend, flutter) is 0 from progress f′ ≥ 0.6, so
    the drawn projectile lands where and when the sim resolves it. A lob ("arc bump") is vertical
    only and returns to 0 at contact.
  - T3 No impact flourish without a matching sim `hit` / `explode`; an expired projectile gets none.
  - T4 Drones stay inside the roam disc (`turretSpec.leash`, enforced by the sim: the attack FX
    draws the sim's drones, it never flies its own); decorative familiars never fire; only real
    projectiles are blended out of a familiar (drones, lances, clones, juggle).
  - T5 Area visuals stay inside the sim radius (`ev.radius`, splash); victim marks only on
    attributed victims.
  - T6 Aura familiars patrol exactly at the aura radius (`t.stats.aura.range`).
  - T7 Landing reticles sit at the sim's live aim point (`p.tx, p.ty`, follows a homing target);
    their diameter is 2·splash capped at 1.6 tiles (a five-shell volley of huge blasts stays
    legible; the explosion itself shows the full radius).
  - T8 Visual drones = sim turrets, 1:1 by uid. Drawn drone = sim drone ± 0.35 tiles of
    decoration (the LAUNCH hop excepted), exactly the sim position at each shot (Chika rework M5).
- **Wholesome.** Light, petals, paper, water and sparks; "cuts" are light/petal coloured; clones are
  plain silhouettes.
- **Neutral names.** No third-party game names or art anywhere (code, comments, commits).

## Hooks (≈ 30 lines in existing files)

| File | Hook |
|---|---|
| `textures.js` | `createAtlas(extra = [])` paints `ATTACK_SPRITES` into the shared atlas. |
| `BattleRenderer.js` | creates the layer (`settings.attackFx === false` = old look), `onEvent(ev, i, events)` first in `handleEvents` (true = handled), `attackFx.update(d)` after `actors.drawGround`, `setQuality`, `setSelected`, new `setTimeScale(s)`, `info.attackFx`, `attackFxProbe()` (dev), `dispose`. **Bug fix:** `batches.begin()` now runs before the events / `actors.sync`, so projectile glow quads pushed during sync are drawn (they were wiped before). |
| `actors.js` | `fxHook.projectile(p)` → view `{kind,x,y,z,scale,sz,tint,glow,yaw,roll,skip}`; the old drone mesh + shadows are skipped when the hook owns drones; `trapHidden(uid)` hides a rune until its tossed seal lands; `towerOffset(uid)` moves the model for lunges / recoil (never the sim position). Reuses a Set / counts object per frame instead of allocating. |
| `controller.js` | `renderer.setTimeScale?.(ctx.speed)` each frame (co-op: the shared speed). |

Frame order: `sim.update` → `setTimeScale` → `renderer.update(dt)`: drain events → begin batches →
events (attack FX first) → `actors.sync` (projectile views, tower offsets) → ground → **attack FX
update** (drones, styles, impact matching, pooled quads, segments) → ambient, overlays, fx → end.

Time: all attack-FX motion and lifetimes run in game time (`gdt = d × timeScale`), so drones keep
pace with enemies at 2× / 3× and everything freezes (but is drawn) when paused. Drones integrate in
fixed 1/60 s game-time steps (≤ 12 per frame) with render interpolation: identical paths at 30, 60
and 144 Hz. Real-time FxSystem particles keep their real-time behaviour. The attack-clip throttle
uses real time (clips play in real time): a girl's body clip restarts at most every 0.45 s (drone
builds 1 s, drone shots never), which removes the clip-restart jitter on fast girls.

## Chika's drones (`patterns/drones.js`)

One drone per sim turret uid, drawn where the **sim** flies it (Chika rework M5,
`docs/specs/CHIKA_REWORK.md` §6.1): the sim position between its last two steps
(`p + (x − p) × α`, α = `actors.alpha`, the renderer's step fraction), plus decoration of at most
0.35 tiles. States read from the sim drone each frame: `LAUNCH` (0.3 s Bézier hop from her
backpack when the sim builds it, the sim's first cooldown) → `ORBIT` (home, not moving: a 0.18-tile
orbit around its own home point, h 1.25, the outer layer (6+ drones) 1.5 and counter-rotating) ·
`HUNT` (the sim drone has a quarry: h 1.1 ± a lane by slot, a sway across the line to its quarry of
0.25 × clamp(cooldown / 0.15, 0, 1) with phase 0 at each shot, so it is exactly the sim drone when it
fires) · `RETURN` (flying home, no decoration) · `DOCK` (Tesla Tower, only while home: pulled in
toward her coil as far as the 0.35 allows, h 1.45, a quick spin) · `DIZZY` (she is sabotaged or this
drone is jammed: it sinks to 0.6, wobbles, a turning star over it, the odd spark). Drones of one wing
on (nearly) the same spot fan out (render only). Offsets and heights ease in fixed 1/60 s game-time
steps; yaw, bank and pitch follow the sim velocity (and snap to the target on a shot). The bullet
leaves the sim drone (`muzzleFor`) at its drawn height and blends onto the sim path by f′ 0.6.
Every frame the drawn positions go to `actors.droneDrawn` (uid → `{ x, h, y }`), which tap picking,
the selected drone's ring / tether and `renderer.droneScreen()` read; with attack FX off,
`actors._syncDrones` draws the same sim positions with the legacy mesh. Ground shadows on every
preset. Body: a light dome over a dark belly, an orange ring, a cyan nose glow, a spinning rotor
disc on top, banking into turns. Selected Chika shows her range ring and the roam ring (overlays).
> 128 drones: the rest are not drawn (`stats.dronesOverflow`, one warning).

Tier looks: P0 T3 formation (a tighter home orbit, trio heights), T4 plasma tint + engine trails +
cyan bullets, T5 two counter-rotating layers, gold, a command drone · P1 T3 the oldest drone carries
a green work light, T4 beacon ring every 2 s, T5 banner glint · P2 T3 micro-arcs at the nose, T4
docked drones + chain lightning from her coil, T5 faster spin, gold-white bolts. Her own shot (when
the drones are full) is a spinning wrench lobbed from her hand.

## Every girl's signature (`styles/<girl>.js`)

Every girl has one base cue of ≈ 12+ CSS px at phone scale (the 844×390 battle is ≈ 27 px per
tile), so even 0-0-0 reads in a crowd.
Upgrades: T1–T2 add an accent (tint, trail, size) — two paths may have accents; T3 on the committed
path switches on that path's look; T4 escalates; T5 adds a capstone flourish. Looks key on path
**index** + tier and on the sim's effective stats (behaviour transforms), never on path names.
Heroes (hero rework) have no paths: each track level remembers the old path tier it came from, so
`heroLookTiers(def, level)` (`src/sim/hero.js`) gives her per-path tiers and `tierLook(…, { multi: true })`
lets every path at T3+ show at once (a Lv 25 hero has all three capstones); hero intensity grows
+0.04 a level, capped at 1.6 like the girls'.

| Girl | Sim | Signature | Path looks (T3+) |
|---|---|---|---|
| Chika | roaming drones + own bolt | the sim's drones, decorated (orbit at home, sway while hunting) | see above |
| Hikari ★ | pulse cleave → lances (P2 T4) | Dawn Arc: rays sweep the victims' angular span, crescent, ground fan, a gold star lands on each victim | P0 more rays, T5 second arc + sun flare · P1 light motes on the aura edge, T4 banner · P2 lances fanned above her head, T5 trails + chorus ring |
| Luna ★ | beam ×3 | Star Lances from a moon familiar: core + sheath, star dots, end star; a repeating beam slides its end | P0 wider, T5 crescent shocks · P1 purple swirl at the ends · P2 star motes on the aura edge, T5 crescent halo |
| Nami ★ | orb, splash | Tide Trident: the orb swells, a ripple wake, a water crown on impact | P0 icy wake + shards · P1 whirl swirl · P2 gulls circle the aura edge |
| Aoi | arrow | fletch streak with a glowing tip + bow-release flash | P0 comet tail, T5 contrail · P1 paper crane figure-8 (1/2/3) · P2 hawk spotter over her target, dives on mark |
| Rei | pulse sweep → duel (P1 T4) | Crimson Crescent across the victims' span, light X cuts, petal flecks | P0 double crescent, T5 petal vortex · P1 iai lunge + white line through the target · P2 parry glint, clang star on stun/silence |
| Yuki | orb, splash → pulse (P0 T5) | snowball lob + sparkle trail; snow puff, frost ring, shards | P0 crystal burst, T5 Blizzard Ring (snow orbiting at the pulse radius, pulls in on each pulse) · P1 icicles · P2 frost trail |
| Momo | coin bullet + income | big spinning coin lob in a gold glow with a glint when it turns face-on, coin hop + tink on a hit, coin fountain on wave income | P0 petals, T5 golden ring · P1 coupons on the aura edge · P2 bigger glowing coins, T4+ jackpot on crits |
| Akane | fan shot, splash, burn | firework shell lob + landing reticle at the aim point, chrysanthemum on the explosion | P0 mini flashes, T5 apex pop · P1 ember trail · P2 rockets (no lob, smoke), T4 alternate shoulders, T5 red reticle |
| Sango | shell (sim arc), splash | recoil + smoke + water spout, navy/gold reticle, double ring + spray | P0 crack decal · P1 shrapnel sparks · P2 bigger shells |
| Kage | shuriken ×2 | violet flick at her hand, afterimage dash, a dark streak + spiral trail behind every star | P0 ring origins, T5 three shadow clones (volleys leave from them) · P1 purple flash on mark · P2 kunai, T4 chain to each kunai |
| Umeko | pulse + aura | rain ripples to the radius, a rain streak on each victim, lanterns on the aura edge | P0 3 → 5 lanterns · P1 petals drifting in the aura · P2 swirls on victims |
| Shiro | hitscan sniper | scope glint + sight line before the shot; a tracer that holds ≈ 0.1 s, muzzle flash + cone, a glint on the enemy the sim hit, casing; follow-up tracers to attributed hits | P0 wider / lingering tracer + ring · P1 red sight line + laser dot, T5 hawk · P2 T5 silver tracers |
| Midori | flask (sim arc), splash | green reticle, stain to the blast radius + droplets | P0 toxic stain + bubbles, T5 leaves · P1 hiss puffs on shred · P2 mist puff, T5 three juggled flasks (throws leave from them) |
| Suzu | traps | seal toss: the rune appears when the seal lands; bell rings + note on trigger | P0 firework sparks, T5 bell shockwave · P1 ropes, T4 net · P2 T4 swirling seals |
| Raika | chain → beam (P1 T4) | drum ring at her feet, hops light up one by one, forks at the nodes | P0 more forks, T5 thunder column · P1 zigzag beam + scorch · P2 double / triple drum |
| Miko | spark talisman + aura → beam (P1 T5) | fluttering ofuda talismans, confetti + holy flash | P0 bells on the aura edge, T5 ribbon ring · P1 bigger talismans + ring, T5 sun mirror (the beam shines from it) · P2 notes on the aura edge |
| Hotaru | pulse holy | firefly swarm; one firefly streaks to every victim and bursts | P0 more / gold fireflies · P1 hush ripple on silence · P2 a firefly over each ally in her aura |
| Kaede | duel ramp | maple lunge (step + rapier glint) + thrust line + ramp-sized slash, maple leaves orbit (1 per 2 hits), scatter on reset | P0 up to 8 / glowing leaves · P1 afterimage streak, T5 leaf burst · P2 pommel shock ring on stun |
| Kanna ★ | duel ramp + shred | the usual slash + a coral drum ring popping out of her target; 2 rings at ramp 3, 3 at ramp 6 | (hero: no path looks) · ult Festival Drumfall → rosterFx |
| Yoriko ★ | needles ×2, slow | each needle stays tied to her hand by a fine lilac thread while it flies; lilac ring on a real hit | (hero) · ult Dream Detour keeps the tide look |
| Seiran ★ | chain, air bonus | light-blue chain lightning from her lance tip, a gold star at every node | (hero) · ult Dragonflight → rosterFx sky dragon |
| Fuu | gusts ×3, knock-back | a mint swirl spins at her fan on each sweep; every gust flies as a spinning mint swirl + wind streak; small swirl on a hit | P1 T3 landing swirl = splash radius · P2 T3 downdraft streak on the hit |
| Hana | arrow, air ×2, grounding | gold arrow streak; on a flyer her falcon drone dives from above onto the same enemy (hawk + white streak); dust ring on `ground` | P0 T3 the falcon dives on every shot · P2 T3 longer streaks |
| Ruri | bolt from her familiar (relay) | every bolt leaves Kon (the holo fox at her origin): blue flash at the fox, blue holo bolt + trail, ring on a hit | P0 T3 bite slash · P1 T3 feather flick · P2 T3 water ripple |
| Noa | pulse holy + sanctuary | two soft sakura-pink rings to the radius, a chime note over her, a petal flick off every attributed victim | P0 T3 pink aura edge while selected · P1 T3 gold note |
| Iroha | bolts ×2 from mirror + herself | silver star glint with a plum trail; the mirror flashes on each volley (her hand too when both fire) | P1 T3 a second, wider plum trail |
| Ena | curse cards | a spinning crimson holo card with a red thread of light back toward her hand; crimson flash on a hit | P0 T3 petal flick |

The nine returning girls (roster wave) have their own styles too. Unknown girls (later waves) get
`generic` (today's look) or their behaviour's default (`turret` → drones). Add a style with one line: `registerStyle('newGirl', style)`; new sim events
that name a girl (`towerUid` / `ownerUid`) reach `style.onOther(ev, tw, t, ctx, i, events)`.

### Style hooks (all optional)

`init(tw, t, ctx)` → private data · `onUpgrade(tw, t, ctx)` · `onAttack(ev, tw, t, ctx, i, events)` ·
`onPulse / onBeam / onChain(ev, tw, t, ctx, i, events)` → true replaces the default effect ·
`onTrap(ev, …)` · `onStatus(ev, …)` · `onCash(ev, …)` · `onOther(ev, …)` · `origin(p, t, idx, n, rec, ctx)`
(visual muzzle M, lob `rec.bump`, flutter `rec.bend`) · `view(p, rec, null, view, ctx)` (remap kind,
tint, scale, `skip` to draw it as quads; draw trails / reticles) · `onSpawn(rec, p, t, ctx)` ·
`onImpact(rec, x, y, crit, radius, ctx)` · `update(gdt, tw, t, ctx)` · `onRemove(tw, ctx)`.

Shared patterns (`patterns/`): `drones`, `segments` (tracers, beams, chains, ropes), `markers`
(reticles, decals), `sweep` (ray / crescent sweeps over the victims' span), `rings` (staggered
ripples, drum beats, double rings), `motes` (swarms), `patrol` (aura-edge familiars, figure-8),
`spotter` (hawk), `lunge` (model offsets), `toss` (seal toss), `clones` (afterimages, shadow
clones), `bursts` (impact flourishes). Hit attribution for area girls: `math/victims.js` walks back
over the `hit` events just before a `pulse` / hitscan `attack` (the sim emits hits → pulse → attack).

## Roster mechanics on the board (`src/render/rosterFx.js`)

Not attack styles: one small renderer system for the roster B3 sim mechanics, fed every drained
event after the attack FX (`roster.handle(ev)`, true = drawn) and updated once per frame after the
attack FX. Read-only like everything here (sim events, `sim.towers`, `sim.runners`, `sim.time`).

| Sim | Drawn |
|---|---|
| `mortarWarn` / `shellLand` | a thin orange ring of the shell radius that fills (disc) over `delay` (sim time), a dot at the centre and a small shell lobbing from her firing point; `shellLand` removes it (the `explode` event draws the blast). A ring with no `shellLand` (wave clear, sold girl) times out 0.25 s after its delay. Max 48. |
| relay origin (`t.origin`, `t.ox/oy`, `stats.relay`; `relay` event) | familiar = Kon, a little low-poly holo fox (emissive pale blue, glow + ring under it, bobbing); mirror = an oval glass panel in a plum frame leaning back on a tripod easel, with a sheen and a sweeping glint. A dashed tether flows from the girl to the prop. Props glide to a moved origin (a puff + ring when it jumps), and go on `sell` / when the girl is gone. On her own spot the prop steps aside 0.34 tiles. One draw call each (merged, vertex coloured), max 24. |
| selected relay girl | the range ring is centred on her origin (`overlays.js`). |
| `aim` / `t.aim` + `aimMode(t)` | a reticle decal at the aim point: always for mortar girls (orange), only while selected for mirror (lilac) and aimed-ult heroes (light blue); a small shrinking ring when an aim is set. |
| `curseBurst` | a purple ring to the burst radius, a soft disc, a flash and a few petals + sparks; each deeper generation ~20% smaller and fainter. Max 10 per frame. |
| `ult` effect `strike` (Kanna) | a coral light pillar on the struck enemy, a flash and three concentric coral shockwaves (+ a faint white one), shards, a short beat line from her. The renderer keeps its screen flash (softer) but skips the map-wide ring and the flash on every enemy. |
| `ult` effect `runner` + `sim.runners` (Seiran) | entry ring + gold sparkle; then a sky dragon every frame: one head + body beads along the road from `runnerSegment(sim, r, k)`, light blue with gold horns / fins, a soft glow, bobbing in a wave, tapering to the tail, shedding gold sparkles. Two instanced meshes (max 6 heads / 48 beads). Gone when the runner leaves `sim.runners`; `runnerEnd` sparkles at the head. |
| statuses `curse`, `hex`, `ground` | enemy status icons (`actors.js`): a hex sigil (purple), a spiral (violet), an arrow onto a line (sand); `status` events flash in the same colours. Grounded flyers already drop to altitude 0 through `e.alt`. |


## Budgets

| Knob | High | Medium | Low |
|---|---|---|---|
| attack-FX quad budget | 900 | 500 | 250 |
| aura familiars per girl | 3 (5 lanterns) | 2 (3) | 0 — truth cues only |
| motes | 1.0 | 0.65 | 0.25 |
| trails | all | drones only | none |
| drone banking | ✓ | ✓ | ✗ |
| afterimages / clones | 3 | 1 | 0 |

Shed order past the budget: decor (≥ 60 %) → familiars (≥ 80 %) → motes (≥ 95 %). Never shed:
drones, drone shadows, projectile sprites, reticles, tracers, victim marks. Per-frame caps on
event decoration: 24 muzzles, 16 tracers, 16 impacts, 8 sweeps, 8 launches (state still updates).
+0 draw calls: drones use one instanced mesh (the old drone mesh draws nothing), everything else
is quads in the existing five batches. No steady-state allocation in the hot paths (pooled
records, scratch objects, colour cache; the frozen-clone strict mode is test-only).
`renderer.info.attackFx` = `{ drones, dronesOverflow, engaged (hunting drones), droneShots, projTracked,
blended, segments, quads, quadBudget, shed, ms (EMA), msFrame, maxDecor (largest drawn − sim distance,
tiles), maxBlendResidual, impacts, matched, defaultPulses, styled }`.

## Tools

- `previews/attacks.html?mode=gallery|focus&unit=chika&build=base|p0|p1|p2|max|5-2-0&quality=…&speed=…&fx=on|off`
  — all 19 girls on a purpose-built serpentine lane (water girls stand in little ponds), or one girl
  up close. `manual=1` exposes `__advance(n, dt)`, `__frame()`, `__fxProbe()`, `__setup(id, build)`
  (swap the focus girl in place), `__setSpeed(s)`. `clean=1` hides the HUD, `extra=6` adds up to 6 Chikas,
  `bloom=0`, `hp=600`, `preroll=40`.
- `node e2e/attack-fx.mjs [--viewport 844x390|1280x720] [--shots dir] [--quick]` — sim id gate,
  Chika truth at 1× / 3×, launch + sell, every girl × every build at high / low (errors, quads,
  draw calls, default pulse rings), stress CPU, screenshots.
- `node e2e/attack-reel.mjs [--units all|chika,aoi] [--builds base,max] [--before] [--out dir]` —
  MP4 / GIF / contact sheet per girl, `all-girls.jpg`, `chika-before-after.mp4`, `reel.json`. Every
  clip opens on an attack; `max` is each girl's showcase build (Kage 5-2-0 clones, Midori 2-0-5
  juggling, Momo 2-0-5 jackpot); Shiro and Kaede get 2.5 s clips.

## Notes / deviations from the spec

- Drone orbit heights are 1.25 / 1.5 (spec 1.05 / 1.30): at 1.05 they read at chibi head level, not
  above it. Engage height 1.1 (lower and they hide behind the enemy sprites).
- Drone decoration eases at a fixed 1/60 s with interpolation (spec: ≤ 1/45 s substeps) — exact
  frame-rate independence instead of "within 0.05 tiles".
- Chika rework M5 (train C): the first pass's own steering (APPROACH / PASS strafing loops, the
  leash at `range − 0.2`, the Repair-Bay drone patrolling the aura edge) is gone; drones are where
  the sim has them. The jammed drone's mark is a turning star (the atlas has no wrench).
- The lateral flutter envelope is compressed into f′ 0..0.6 (sin(π·f′/0.6)) so T2 holds exactly.
