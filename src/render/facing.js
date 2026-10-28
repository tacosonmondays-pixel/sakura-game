// Drawn facing of a girl in battle (display only: the sim's `facing` is untouched).
//
// A girl turns toward her target (src/render/actors.js), so a target up-map turns her back to the battle camera,
// which looks down-map from above (src/render/camera.js: a figure at rotation.y = camera yaw faces it). Every
// girl keeps her face to the camera instead (the owner's call after the facing board, docs/review/banners/
// facing-all-girls.jpg). Within FREE_TURN of the camera she turns exactly toward the target; past it the turn is
// eased, so a target straight up-map ends at MAX_TURN (a three-quarter view toward that side), never her back. The muzzle flash, the weapon hand and Big Yellow follow this drawn
// facing (they read the view's facing), so they stay with her figure.

/** Turn (rad) from facing the camera that she follows exactly. */
export const FREE_TURN = 0.5;
/** The furthest she turns from facing the camera (rad, a target straight up-map). */
export const MAX_TURN = 0.9;

/** Does this unit's battle figure keep her face to the camera? Every girl's does. */
export function facesCamera(def) {
  return !!def;
}

/** a - b wrapped to (-π, π]. */
function wrap(a) {
  const t = Math.PI * 2;
  let d = a % t;
  if (d > Math.PI) d -= t;
  if (d <= -Math.PI) d += t;
  return d;
}

/**
 * Her drawn facing: the target direction `facing` (rad, the sim's convention = the figure's rotation.y), eased
 * so it stays within MAX_TURN of the camera yaw `camYaw`.
 */
export function cameraFacing(facing, camYaw = 0) {
  const k = wrap((facing || 0) - camYaw);
  const a = Math.abs(k);
  if (a <= FREE_TURN) return camYaw + k;
  const eased = FREE_TURN + (a - FREE_TURN) * ((MAX_TURN - FREE_TURN) / (Math.PI - FREE_TURN));
  return camYaw + Math.sign(k) * eased;
}
