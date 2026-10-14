// Battle camera input policy (owner: "make it so the screen is locked, I sometimes drag it when
// I try to place a unit"). Pure — no three.js, no DOM — so tests can pin it down. The renderer
// asks it on every pointer event which camera gestures the current moment allows.
//
//   Settings → Battle → Camera:
//     'locked' (default, also for older saves): the map stays framed exactly as the initial fit.
//              A one-finger drag never pans; pinch and the mouse wheel never zoom.
//     'free':  drag to pan, pinch / wheel to zoom, double-tap to reset (the original controls).
//   Placing a girl (dragging a card from the bar, a placement ghost on the board, or a card
//   tapped and waiting for the board tap) holds the camera still in BOTH modes.

export const CAMERA_MODES = Object.freeze(['locked', 'free']);
export const DEFAULT_CAMERA_MODE = 'locked';

/** How far (CSS px) a finger may wander and still count as a tap when a drag would pan. */
export const TAP_SLOP_PX = 9;
/** ...and when the camera holds still: a drag does nothing, so a wobbly tap still lands. */
export const STILL_TAP_SLOP_PX = 20;

/** The camera mode a settings object asks for ('locked' unless it says 'free'). */
export function cameraModeOf(settings) {
  return settings?.camera === 'free' ? 'free' : DEFAULT_CAMERA_MODE;
}

/**
 * Which camera gestures are allowed right now.
 * @param {{ mode?: string, placing?: boolean }} state  mode = 'locked' | 'free'; placing = the
 *   player is placing a girl (bar drag, ghost on the board, or tap-then-tap pending)
 * @returns {{ pan: boolean, zoom: boolean, reset: boolean, tapSlop: number }}
 *   pan: one-finger drag / two-finger move pans; zoom: pinch and wheel zoom; reset: double-tap
 *   returns to the fitted view; tapSlop: px a press may move and still be a tap (and long-press)
 */
export function cameraGestures({ mode = DEFAULT_CAMERA_MODE, placing = false } = {}) {
  const moves = mode === 'free' && !placing;
  return { pan: moves, zoom: moves, reset: moves, tapSlop: moves ? TAP_SLOP_PX : STILL_TAP_SLOP_PX };
}
