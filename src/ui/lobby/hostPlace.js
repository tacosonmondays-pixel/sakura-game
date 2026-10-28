// [ui-ink] Where the home puts its host (UI v2 "Ink & Paper", notes/ui-v2/UI_V2_DIRECTION.md 5.5 and 12.1; the build
// plan's V2 steps 1, 3 and 5, C5). Pure: no DOM. src/ui/lobby/artStage.js (her still cut-out), the living scene
// (src/ui/lobby/live/marumi.js) and the tests (tests/ui/hostPlace.test.js) share it.
//
// The rule, in order:
//   1. her eye line on the home's eye line and her face centre on its face spot (the anchors: src/ui/faceAnchors.js);
//   2. her size from the screen height (12.1: 424 px at 844x390, 800 at 1280x720), evened out so every girl's face is
//      about Ruri's (a girl drawn small is drawn up to 25 % bigger, one drawn big down to 90 %);
//   3. her art (every band of it that is on the screen, her companion and props too) ends `margin` px (8) before every
//      control: she may slide sideways by up to 4 % of the width to make it so (5.5), the smallest slide first;
//   4. only if no slide does it, she is drawn smaller, 2 % at a time, down to `minScale` (0.8): the largest scale that
//      passes wins. If even that fails, the placement says `fits: false` (the caller keeps the least clash and the
//      tests fail: the owner is asked, C5).
// A painted scene with her inside it (the three scene backgrounds) cannot slide her alone: placeScene() zooms and pans
// the whole painting so her face lands on the spot, never leaving a gap at an edge.

/**
 * The home's face spot and her size, per screen shape (12.1; desktop at 1280x720, phones at 844x390). Home layout B
 * "Quiet Home" (the Oct 27 layout study): her face in the middle of the screen (x 0.50 W: 422 at 844, 640 at 1280), the
 * controls in the corners around her; her eye line and her size as V2's. A screen narrower than those (a small phone
 * at 667x375, a 4:3 tablet) draws her a little smaller, as its corners leave her legs less room between them: by the
 * width-to-height ratio, from 2.0 down on a phone (to 85 % at most) and from 1.7 down on a bigger screen (to 78 %).
 */
export function homeTarget(W, H) {
  if (W < H) {
    // a phone held upright (no mock-up: the rotate prompt covers it; the fallback after "Continue in portrait")
    return { x: W * 0.5, y: H * 0.235, base: H * 0.62, shiftMax: W * 0.06 };
  }
  const a = W / H;
  if (H <= 480) return { x: W * 0.5, y: H * 0.29, base: H * 1.087 * Math.min(1, Math.max(0.85, a / 2)), shiftMax: W * 0.04 };
  return { x: W * 0.5, y: H * 0.29, base: H * 1.111 * Math.min(1, Math.max(0.78, a / 1.7)), shiftMax: W * 0.04 };
}

/** Ruri's face height (brow to chin) in her -cut: the size every girl's face is evened out to. */
export const REF_FACE = 0.08;
/** The face may be drawn up to this much bigger or smaller than her plain size to match REF_FACE. */
export const FACE_K = Object.freeze({ min: 0.62, max: 1.25 });

/**
 * The slide (px) closest to 0 within [-max, max] that keeps every band of her art `margin` px clear of every box, or
 * null when there is none. Each band beside a box forbids an open interval of slides; what is left is allowed.
 */
export function freeShift(bands, boxes, margin, max) {
  const forbidden = [];
  for (const b of bands) {
    for (const u of boxes) {
      if (b.y1 <= u.y - margin || b.y0 >= u.y + u.h + margin) continue;
      // slides that would put the band within `margin` of the box (open interval)
      forbidden.push([u.x - margin - b.x1, u.x + u.w + margin - b.x0]);
    }
  }
  const ok = (d) => forbidden.every(([lo, hi]) => d <= lo || d >= hi);
  if (ok(0)) return 0;
  // the candidates: the ends of every forbidden interval inside the range, nearest to 0 first
  const cands = forbidden.flat().filter((d) => Math.abs(d) <= max).sort((p, q) => Math.abs(p) - Math.abs(q));
  for (const d of cands) if (ok(d)) return d;
  return null;
}

/**
 * Her bands on the screen for a placement (the ones above or below the screen are left out; with clipY, so is what
 * lies under it: her picture fades out there).
 */
export function bandsOf(extents, { left, top, width, height }, H, clipY = null) {
  const n = extents.length;
  const out = [];
  const bottom = clipY == null ? H : Math.min(H, clipY);
  extents.forEach((e, i) => {
    if (!e) return;
    const y0 = top + (i / n) * height;
    const y1 = Math.min(bottom, top + ((i + 1) / n) * height);
    if (y1 <= 0 || y0 >= bottom) return;
    out.push({ x0: left + e[0] * width, x1: left + e[1] * width, y0, y1 });
  });
  return out;
}

/**
 * The face box: no control over a host's face and hair (5.5): her face centre ± 8 % of the width across (at least
 * 1.1 face heights each side, for a big face on a narrow screen), from one face height above her brows (the hair) down
 * to just under her chin.
 */
export function faceBox(anchor, { left, top, width, height }, W) {
  const fh = (anchor.chin - anchor.brow) * height;
  const x = left + anchor.cx * width;
  const half = Math.max(0.08 * W, 1.1 * fh);
  const y0 = top + anchor.brow * height - 0.9 * fh;
  const y1 = top + anchor.chin * height + 0.15 * fh;
  return { x: x - half, y: y0, w: 2 * half, h: y1 - y0 };
}

/**
 * @param {{ W: number, H: number, aspect: number, anchor: { cx: number, brow: number, eye: number, chin: number },
 *   extents: ([number, number]|null)[], boxes?: { x: number, y: number, w: number, h: number }[],
 *   target?: { x: number, y: number, base: number, shiftMax: number }, margin?: number, minScale?: number,
 *   normalise?: boolean, dropSoft?: number, dropMax?: number, toBottom?: boolean, clipY?: number|null }} o
 *   aspect: the art's width / height; dropSoft / dropMax: how far (px) her eye line may come down; toBottom: she should
 *   reach the bottom edge; clipY: her picture fades out above that line (a phone held upright: nothing under it counts)
 * @returns {{ left: number, top: number, width: number, height: number, scale: number, shift: number, drop: number,
 *   fits: boolean, floats: boolean, faceX: number, eyeY: number, face: { x: number, y: number, w: number, h: number } }}
 *   scale: of her plain size (1 = 12.1's height, evened out); shift: the slide used (px); drop: how far her eye line came
 *   down (px); floats: her picture ends above the bottom edge (the home fades its foot out)
 */
export function placeHost({ W, H, aspect, anchor, extents, boxes = [], target = homeTarget(W, H), margin = 8, minScale = 0.8, normalise = true, dropSoft = H * 0.05, dropMax = H * 0.12, toBottom = true, clipY = null }) {
  const reachBottom = toBottom && clipY == null;
  const fh = Math.max(0.01, anchor.chin - anchor.brow);
  const k = normalise ? Math.min(FACE_K.max, Math.max(FACE_K.min, REF_FACE / fh)) : 1;
  const hFace = target.base * k;
  const hMin = hFace * minScale;
  const below = Math.max(0.05, 1 - anchor.eye);
  // her picture runs past the bottom edge where it can (the lobby's stand rule since v0.1.47: she never floats; the
  // bottom scrim hides where it ends), so a girl drawn as a bust or from above starts bigger than her face asks
  const hStart = reachBottom ? Math.max(hFace, (H - target.y) / below) : hFace;
  const at = (height, dx = 0, dy = 0) => {
    const width = height * aspect;
    return { left: target.x + dx - anchor.cx * width, top: target.y + dy - anchor.eye * height, width, height };
  };
  const reaches = (height, dy) => target.y + dy + below * height >= H - 0.5;
  // her eye line may come down a little: first up to dropSoft (5 %), then up to dropMax (12 %): a girl drawn with tall
  // ears, a halo or a hat clears the top bar that way before she is drawn smaller
  const soft = [];
  const hard = [];
  for (let d = 0; d <= dropMax + 1e-9; d += 4) (d <= dropSoft + 1e-9 ? soft : hard).push(d);
  // the sizes, largest first: 2 % steps down to hMin, and for each drop the smallest size that still reaches the edge
  const sizes = new Set();
  for (let s = 1; hStart * s >= hMin - 1e-6; s = Math.round((s - 0.02) * 1000) / 1000) sizes.add(hStart * s);
  sizes.add(hMin);
  if (reachBottom) for (const dy of [...soft, ...hard]) { const hr = (H - target.y - dy) / below; if (hr >= hMin && hr <= hStart) sizes.add(hr + 0.01); }
  const heights = [...sizes].sort((a, b) => b - a);
  const tryAll = (drops, wantReach) => {
    for (const height of heights) {
      for (const dy of drops) {
        if (wantReach && !reaches(height, dy)) continue;
        const p0 = at(height, 0, dy);
        const dx = freeShift(bandsOf(extents, p0, H, clipY), boxes, margin, target.shiftMax);
        if (dx == null) continue;
        const p = at(height, dx, dy);
        return { ...p, scale: height / hFace, shift: dx, drop: dy, fits: true, floats: p.top + p.height < H - 0.5, faceX: target.x + dx, eyeY: target.y + dy, face: faceBox(anchor, p, W) };
      }
    }
    return null;
  };
  // she reaches the bottom edge as long as any size and drop lets her; she floats only when nothing else fits
  const found = (reachBottom && (tryAll(soft, true) || tryAll(hard, true))) || tryAll(soft, false) || tryAll(hard, false);
  if (found) return found;
  const p = at(hStart);
  return { ...p, scale: hStart / hFace, shift: 0, drop: 0, fits: false, floats: false, faceX: target.x, eyeY: target.y, face: faceBox(anchor, p, W) };
}

/**
 * A painted scene with her inside it: zoom (from the cover fit up to `maxZoom` times it) and pan the painting so the
 * face point lands on the spot, the painting always covering the whole screen.
 * @param {{ W: number, H: number, aspect: number, face: [number, number], target?: { x: number, y: number },
 *   maxZoom?: number }} o face: [x, y] fractions of the painting (src/data/lobbyArt.js)
 * @returns {{ left: number, top: number, width: number, height: number, zoom: number, faceX: number, faceY: number }}
 */
export function placeScene({ W, H, aspect, face, target = null, maxZoom = 1.5 }) {
  const t = target || { x: homeTarget(W, H).x, y: H * 0.31 };
  const [fx, fy] = face;
  const coverW = Math.max(W, H * aspect);
  const need = Math.max(coverW, t.x / fx, (W - t.x) / (1 - fx), (t.y / fy) * aspect, ((H - t.y) / (1 - fy)) * aspect);
  const width = Math.min(need, coverW * maxZoom);
  const height = width / aspect;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const left = clamp(t.x - fx * width, W - width, 0);
  const top = clamp(t.y - fy * height, H - height, 0);
  return { left, top, width, height, zoom: width / coverW, faceX: left + fx * width, faceY: top + fy * height };
}
