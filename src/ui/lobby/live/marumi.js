// [ui-ink] Marumi's living scene on the home (UI v2 "Ink & Paper" V2; the build plan's step 5, C4 and C5): her rig
// numbers, her files and where she stands. Her layers are her own art (the living-scene prototype's layers and masks,
// notes/live2d/proto), copied into public/art/live/marumi/: her bowling-club plate in its own colours (plate.webp, owner
// Oct 28: the home is never dimmed; rebuilt from the full-colour scene by tools/art/unbakeMarumiPlate.py, the old
// night-graded plate, tools/art/src/marumi-plate-home.webp, is its input), her figure (1688 x 828, the frame's 780
// plus 48 px of skirt below it), the flame emblem,
// the closed-eye patch and its wipe map, and seven masks that say which part of her moves how.
//
// Where she stands (C5): her figure is moved and scaled inside the plate so her face lands on the home's face spot and
// all of her art (the ball and both hands too) ends 8 px before every control, at the largest scale that passes and
// never below 0.8 of the plate's cover fit (src/ui/lobby/hostPlace.js placeHost). Her plate stays cover-fit behind her.
import { placeHost, homeTarget } from '../hostPlace.js';

/** The art frame (px): every rig number below is in these px, y down. Her figure's texture is FRAME.w x FRAME.h + EXT. */
export const FRAME = Object.freeze({ w: 1688, h: 780, ext: 48 });

/** The rig (the prototype's RIG): pivot = her neck base, crown = her hair roots, the boxes of her eyes and her flame. */
export const RIG = Object.freeze({
  pivot: [1142, 262],
  crown: [1105, 50],
  face: [1099, 170],
  eyeBox: Object.freeze({ x: 1036, y: 131, w: 125, h: 69 }),
  haloBox: Object.freeze({ x: 941, y: 12, w: 82, h: 113 }),
  fuseTip: [934, 410],
  lamps: Object.freeze([[330, 5], [250, 110], [195, 187], [648, 190], [770, 122], [915, 28]]),
});

/** Her face in her figure's texture (fractions of 1688 x 828; read off a 3x crop as the -cut anchors were). */
export const ANCHOR = Object.freeze({ cx: 0.651, brow: 0.178, eye: 0.202, chin: 0.281 });

/** Where her figure has paint: [x0, x1] per 1/40 of the texture's height (tools/art/faceSheet.mjs --extents --bands 40). */
export const EXTENTS = Object.freeze([null, [0.615, 0.679], [0.602, 0.693], [0.596, 0.706], [0.592, 0.731], [0.589, 0.743], [0.587, 0.745],
  [0.429, 0.741], [0.43, 0.736], [0.435, 0.735], [0.444, 0.795], [0.392, 0.804], [0.39, 0.804], [0.424, 0.793], [0.41, 0.794], [0.396, 0.726],
  [0.396, 0.726], [0.433, 0.725], [0.43, 0.724], [0.53, 0.726], [0.396, 0.727], [0.367, 0.727], [0.35, 0.726], [0.339, 0.722], [0.33, 0.728],
  [0.323, 0.733], [0.318, 0.737], [0.315, 0.741], [0.313, 0.745], [0.313, 0.749], [0.313, 0.757], [0.314, 0.765], [0.316, 0.774], [0.32, 0.782],
  [0.325, 0.79], [0.332, 0.797], [0.342, 0.796], [0.355, 0.794], [0.376, 0.788], [0.533, 0.788]]);

/** The part of her texture the mesh covers (her paint runs from x 523 to 1357: the rest is empty). */
export const MESH_X = Object.freeze([500, 1380]);

/** Her files, in public/art/live/marumi/ (about 436 KB, fetched only when she hosts on High or Medium). */
export const FILES = Object.freeze({
  plate: 'plate.webp', girl: 'girl.webp', halo: 'halo.png', eyes: 'eyes-closed.png', wipe: 'eyes-wipe.png',
  masks: Object.freeze({ breath: 'mask-breath.png', head: 'mask-head.png', hair: 'mask-hair.png', ribbon: 'mask-ribbon.png', skirt: 'mask-skirt.png', ball: 'mask-ball.png', lock: 'mask-lock.png' }),
});

/** The plate's cover fit (px per art px) for a screen. */
export function coverScale(W, H) {
  return Math.max(W / FRAME.w, H / FRAME.h);
}

/**
 * Where her figure stands for a screen and its controls (C5).
 * @param {number} W
 * @param {number} H
 * @param {{ x: number, y: number, w: number, h: number }[]} boxes the controls' boxes
 * @returns {ReturnType<typeof placeHost> & { cover: number, rel: number }} rel: her scale against the cover fit
 */
export function placeMarumi(W, H, boxes = []) {
  const cover = coverScale(W, H);
  const target = { ...homeTarget(W, H), base: cover * (FRAME.h + FRAME.ext) };
  // (10 px, not 8: her ball floats by up to 0.7 px and her edges carry a soft warm rim the extents' alpha cut leaves out)
  const p = placeHost({ W, H, aspect: FRAME.w / (FRAME.h + FRAME.ext), anchor: ANCHOR, extents: EXTENTS, boxes, target, normalise: false, minScale: 0.8, margin: 10 });
  return { ...p, cover, rel: p.height / (FRAME.h + FRAME.ext) / cover };
}

export default Object.freeze({ id: 'marumi', dir: 'art/live/marumi/', FRAME, RIG, ANCHOR, EXTENTS, MESH_X, FILES, place: placeMarumi });
