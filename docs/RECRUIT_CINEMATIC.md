# The recruit cinematic

Owner request (Oct 30): a much better, cinematic summoning animation. It replaces the sealed letter at the
start of a recruit and the old SSR showcase; the card flips and the results screen stay as they were.
Display only: the pull is saved before any of it starts (`doPull` in `src/ui/screens/recruit.js`), and
nothing here changes what is pulled, the rates or the save. The sim id stays `be940ecb2087`.

## What plays

1. **The Gate** (the academy's Gate) powers on, glowing blue. It is drawn as a vast whirlpool on a dark
   sea, seen low and at an angle, with misty mountains on the horizon (owner reference, Oct 30). Spiral
   streaks of light pull into a black eye, turning faster near the eye. Twelve runes around its rim
   light one by one, sparks lift off the rim and sakura petals drift across.
   - an SR in the pull adds gold to the blue;
   - **an SSR**: the Gate surges from blue to a rainbow, with electric arcs crackling around the
     portal, rainbow light rays and a sideways screen shake;
   - **an LR**: blue → rainbow → the starlit Nightglass (navy, white-gold, starlight across the
     screen), longer and bigger, before it opens.
   - It opens: a column of light wells up out of the eye and fills the screen, with a burst of sparks
     and a shockwave ring.
2. The cards are dealt and flip with their rarity glow over the dimmed Gate (unchanged).
3. **Every SSR and LR** then gets a full-screen reveal: her glowing silhouette → her art sweeps in
   behind a light bar → her rarity stars (5; LR 6, gold), kicker, name, title and quote → her
   **mark** stamps in with a burst → hold. LR reveals are longer, on a Nightglass sky with starlight.
4. The results (unchanged).

Timings are in `src/ui/recruit/plan.js` (`GATE_TIMES`, `REVEAL_TIMES`): the blue Gate about 1.9 s, the
rainbow 3.3 s, the LR 5 s; an SSR reveal about 2.5 s to its hold, an LR one 3.9 s; a hold waits for a tap
or moves on by itself after 2.8 s (LR 3.6 s).

## Comfort

- **Tap** during the Gate: it runs 3× faster; a second tap opens it. A tap mid-reveal shows it all at
  once; a tap at the hold moves on. **Skip all** (top right, always above everything) goes straight to
  the results.
- **Reduce motion**: the calm version. The Gate only fades through its colours (no spin, no arcs, no
  shake, no flash, few slow petals), about 1.1–2.2 s; reveals fade in (no silhouette, sweep bar or
  stamp).
- **Flashes & shake** off: no shake and no flashes (a faint tint at most); the rest plays.
- Flashes otherwise go through the flash guard (`src/render/vfx/flashGuard.js`): the Gate opening and
  each mark stamp ask it, so never more than 3 a second, never a full-white frame (the flash is a radial
  tint capped at 0.55).
- The shake is a sideways shift only, never a rotation (docs/VFX.md).

## Phones first

- 844x390, 1280x720 and 390x844 (upright: her art on top, the mark at its corner, the words below).
- No new assets: the Gate, the effects and the marks are drawn (2D canvas and SVG). The only file a
  reveal loads is her own `-cut` portrait, which starts loading when the Gate starts.
- Two canvases at most 1.5× device pixels, fixed particle pools (220 sparks, 36 petals, 10 arcs), no
  canvas shadows or filters; the loop stops once the results are up and nothing is moving.
- Time comes from one `requestAnimationFrame` loop stepping its own clock by the frame delta (capped at
  1/10 s), never `Date.now` / `performance.now`; randomness only from the seeded visual stream
  (`src/render/vfx/random.js`, seeded from the pulled unit ids).

## Files

| File | What |
|---|---|
| `src/ui/recruit/plan.js` | the timeline (pure; `tests/ui/recruitCinematic.test.js`) |
| `src/ui/recruit/cinematic.js` | plays it: the loop, taps, flashes, shake, the reveal stages |
| `src/ui/recruit/gate.js` | the swappable Gate and the drawn default |
| `src/ui/recruit/fx.js` | sparks, arcs, petals, rays, starlight |
| `src/ui/recruit/emblem.js` | the girls' marks |
| `src/ui/styles/recruit-cinematic.css` | layers and the reveal |
| `e2e/recruit-cinematic.mjs` | the e2e (1×, SSR 10×, LR, Skip all, Reduce motion, Flashes & shake off) and the owner board recording (`--video <dir>`) |

## Swapping in a 3D Gate

The cinematic only talks to the interface at the top of `src/ui/recruit/gate.js`: `el`,
`resize(w, h, dpr)`, `update(state)` (the phase, its progress, the tier, energy 0..1, the rainbow's hue,
`reduce`, and `openPeak`, the brightest its opening may get), `center()` and `dispose()`. To use the
owner's model:

```js
import { setGateFactory } from './src/ui/recruit/gate.js';
setGateFactory(async ({ reduce }) => {
  const { ModelGate } = await import('./modelGate.js'); // lazy: three.js and the model load here
  return new ModelGate({ reduce });
});
```

If the factory fails, the drawn Gate plays. The effects layer gathers its sparks and arcs on
`center()`, so the model only has to report where its portal is.

## Marks

Each girl's mark is drawn from her id (same girl, same mark): a rosette of 5, 6 or 8 petals, points or
blades in her hair and eye colours, her role's glyph in the middle. LR units wear the Nightglass mark: a
navy disc with the white-gold line, the twin stars on their orbit and twelve starlight points. If the
owner wants a hand-drawn emblem per girl later, `markSVG` is the one place to swap it in.
