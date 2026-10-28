// Battle board pointer input: taps, long presses and the camera gestures — one-finger drag
// (touch or mouse) to pan, two fingers to pinch-zoom and move, the mouse wheel to zoom and a
// double-tap to reset. Every camera move first asks the gesture policy
// (src/render/cameraPolicy.js via `gestures()`): with the camera locked, or while a girl is
// being placed, nothing here moves the camera, and a press may wander further (tapSlop) and
// still count as a tap. DOM-light (an EventTarget with getBoundingClientRect) so node tests
// can drive it with synthetic pointer events.
//
//   const input = attachBoardInput(canvas, { rig, pick, gestures, onTap, onLongPress });
//   input.dispose();

/**
 * The board point under a pointer ray, rooftops included (Gate Arc 'U' tiles). A roof's top stands
 * `roofY` above the ground, so a ray that meets that height over a rooftop tile lands on the roof
 * (at the 48° battle camera a 0.56 roof moves the ground hit about half a tile); one that crosses
 * it beside a roof and then enters a block through its wall lands at that wall (a spot on the
 * roof's edge, which placement refuses); anything else lands on the ground. Pure, for node tests.
 * @param {{ origin: { x: number, y: number, z: number }, direction: { x: number, y: number, z: number } }} ray
 * @param {((x: number, z: number) => number)|null} roofAt rooftop height at a board point (0 off the roofs)
 * @param {number} roofY the roofs' height
 * @returns {{ x: number, y: number, roof: boolean, wall: boolean }|null} board coords (y = world z), null when the ray misses the board's plane
 */
export function boardPoint(ray, roofAt, roofY) {
  const o = ray.origin;
  const d = ray.direction;
  if (!(Math.abs(d.y) > 1e-9)) return null;
  const tg = -o.y / d.y;
  if (tg < 0) return null;
  if (roofAt && roofY > 0 && o.y > roofY) {
    const tr = (roofY - o.y) / d.y;
    const rx = o.x + d.x * tr;
    const rz = o.z + d.z * tr;
    if (roofAt(rx, rz) > 0) return { x: rx, y: rz, roof: true, wall: false };
    // below the roofs' height and above the ground: the first point inside a block is its wall
    const N = 16;
    for (let k = 1; k < N; k++) {
      const t = tr + ((tg - tr) * k) / N;
      const x = o.x + d.x * t;
      const z = o.z + d.z * t;
      if (roofAt(x, z) > 0) return { x, y: z, roof: false, wall: true };
    }
  }
  return { x: o.x + d.x * tg, y: o.z + d.z * tg, roof: false, wall: false };
}

/** A still press this long (ms) is a long press. */
export const LONG_PRESS_MS = 520;
/** A long-press timer this late (ms past its deadline) waits one more task for a queued release. */
export const LATE_FIRE_MS = 100;
/** A press held longer than this (ms) is no tap any more. */
export const TAP_MAX_MS = 600;
/** Two taps within this time (ms) and distance (px) are a double-tap. */
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_PX = 30;
/** Wheel delta → zoom factor exponent. */
const WHEEL_ZOOM = 0.0015;

/**
 * Wires the board's pointer input.
 * @param {EventTarget & { getBoundingClientRect(): DOMRect, setPointerCapture?(id: number): void }} el
 * @param {{
 *   rig: { panBy(dx: number, dy: number): void, zoomAt(f: number, px: number, py: number): void, reset(animated?: boolean): void, isDefault: boolean },
 *   pick: (clientX: number, clientY: number) => { towerUid: number|null },
 *   gestures: () => { pan: boolean, zoom: boolean, reset: boolean, tapSlop: number },
 *   onTap?: (p: object) => void,
 *   onLongPress?: (p: object) => void,
 *   now?: () => number,
 * }} opts
 * @returns {{ dispose(): void }}
 */
export function attachBoardInput(el, { rig, pick, gestures, onTap = () => {}, onLongPress = () => {}, now = () => performance.now() }) {
  const pointers = new Map(); // pointerId -> { x, y } (last client position)
  let gesture = null; // the one-finger press: { moved, longFired, timer, t0, x0, y0, pan, reset, slop }
  let pinch = null; // two fingers: { dist, mx, my } at the last move, { pan, zoom } allowed at the start
  let lastTap = null; // { t, x, y } for the double-tap

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best effort (a pointer already lifted under jank, a synthetic test pointer) */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // what the policy allows as the press begins: a press (or pinch) that starts while the
    // camera holds still — locked, or a girl being placed — never moves it, even if placing
    // ends before the finger lifts
    const allow = gestures();
    if (pointers.size === 1) {
      const g = { moved: false, longFired: false, t0: now(), x0: e.clientX, y0: e.clientY, timer: 0, pan: allow.pan, reset: allow.reset, slop: allow.tapSlop };
      // a timer that runs late (a long frame held the page) looks again one task later, after a
      // pointerup that queued up behind it: a slow tap stays a tap (src/ui/hold.js holdTimer)
      const fire = () => {
        if (gesture !== g || g.moved || pointers.size !== 1) return;
        g.longFired = true;
        onLongPress({ ...pick(g.x0, g.y0), clientX: g.x0, clientY: g.y0 });
      };
      g.timer = setTimeout(() => {
        if (gesture !== g) return;
        if (now() - g.t0 > LONG_PRESS_MS + LATE_FIRE_MS) g.timer = setTimeout(fire, 0);
        else fire();
      }, LONG_PRESS_MS);
      gesture = g;
    } else if (pointers.size === 2) {
      // a second finger turns the press into a pinch: never a tap or a long press
      if (gesture) {
        clearTimeout(gesture.timer);
        gesture.moved = true;
      }
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, pan: allow.pan, zoom: allow.zoom };
    }
  }

  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const allow = gestures();
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const rect = el.getBoundingClientRect();
      if (allow.zoom && pinch.zoom && pinch.dist > 0) rig.zoomAt(dist / pinch.dist, mx - rect.left, my - rect.top);
      if (allow.pan && pinch.pan) rig.panBy(mx - pinch.mx, my - pinch.my);
      pinch.dist = dist;
      pinch.mx = mx;
      pinch.my = my;
      return;
    }
    const g = gesture;
    if (!g) return;
    // a press that wanders less than the slop is still a tap (wider while a drag cannot pan)
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > Math.max(allow.tapSlop, g.slop)) {
      g.moved = true;
      clearTimeout(g.timer);
    }
    if (g.moved && !g.longFired && allow.pan && g.pan) rig.panBy(dx, dy);
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const g = gesture;
    if (pointers.size > 0 || !g) return;
    gesture = null;
    clearTimeout(g.timer);
    if (e.type === 'pointercancel' || g.moved || g.longFired) return;
    const t = now();
    if (t - g.t0 > TAP_MAX_MS) return;
    const p = pick(e.clientX, e.clientY);
    if (g.reset && gestures().reset && lastTap && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX && p.towerUid == null) {
      lastTap = null;
      if (!rig.isDefault) rig.reset(true);
    } else {
      // a tap made while the camera holds still (the tap that places a girl) is never the first
      // half of a double-tap reset
      lastTap = g.reset ? { t, x: e.clientX, y: e.clientY } : null;
    }
    onTap({ ...p, clientX: e.clientX, clientY: e.clientY });
  }

  function onWheel(e) {
    e.preventDefault(); // never scroll / zoom the page, locked or not
    if (!gestures().zoom) return;
    const rect = el.getBoundingClientRect();
    rig.zoomAt(Math.exp(-e.deltaY * WHEEL_ZOOM), e.clientX - rect.left, e.clientY - rect.top);
  }

  function onContext(e) {
    e.preventDefault();
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', onContext);

  return {
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
      if (gesture) clearTimeout(gesture.timer);
      gesture = null;
      pinch = null;
      pointers.clear();
    },
  };
}
