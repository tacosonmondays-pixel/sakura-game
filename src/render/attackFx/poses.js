// Procedural attack poses (FX-1) for girls whose built clip is the wrong motion, layered on her idle
// through BoneOverlay (src/render/boneOverlay.js): Marumi bowls underhand and lobs underhand instead
// of her overhand throw. Five beats, held where the eye keeps them (docs/ATTACK_FX.md "Placed objects
// and thrown props"):
//   0     ready, the ball at her chest
//   0.20  the pendulum back-swing (arm back, a step forward on her left, hips down)
//   0.35  release: arm forward and low, the ball at ankle height (the sim's roll lands here)
//   0.45-0.62 the bowler's finish held: arm up the lane, back leg crossed behind
//   0.80  she stands; a new ball pops into her hand
// The release lands on the sim's shot: the pose starts early from her own countdown (t.cooldown, read
// only) and plays faster when her interval is shorter than the pose (never cut off).
import { AXIS_X, AXIS_Y } from '../boneOverlay.js';
import { smooth01 } from '../placed/math.js';

/** Seconds of a bowl at 1× (the release at RELEASE of it). */
export const BOWL_T = 0.83;
export const RELEASE = 0.35;
/** When the ball leaves the hand (hand_R scale goes down) and the new one pops back. */
const HAND_OUT = 0.35;
const HAND_BACK = 0.74;

// [u, upperArmR, forearmR, spine, thighL, shinL, thighR, hips(y), twist]
const BOWL = [
  [0.0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0.2, 1.05, 0.25, 0.16, -0.38, 0.32, 0.12, -0.03, 0.18],
  [0.35, -0.55, 0.05, 0.36, -0.58, 0.52, 0.42, -0.06, -0.05],
  [0.45, -1.45, -0.18, 0.3, -0.52, 0.45, 0.62, -0.05, -0.12],
  [0.62, -1.45, -0.18, 0.28, -0.5, 0.42, 0.6, -0.05, -0.12],
  [0.8, -0.35, 0, 0.08, -0.15, 0.12, 0.15, -0.015, 0],
  [1.0, 0, 0, 0, 0, 0, 0, 0, 0],
];
// the underhand lob for flyers: less lean, the arm ends higher (a toss up and over)
const LOB = [
  [0.0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0.2, 0.9, 0.2, 0.1, -0.25, 0.22, 0.06, -0.025, 0.12],
  [0.35, -1.1, -0.1, 0.12, -0.3, 0.25, 0.12, -0.03, 0],
  [0.45, -2.0, -0.3, 0.02, -0.28, 0.22, 0.1, -0.02, -0.05],
  [0.62, -1.9, -0.3, 0.0, -0.25, 0.2, 0.1, -0.02, -0.05],
  [0.8, -0.4, 0, 0, -0.08, 0.06, 0.04, -0.01, 0],
  [1.0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const OUT = { upperArmR: 0, forearmR: 0, spine: 0, thighL: 0, shinL: 0, thighR: 0, hips: 0, twist: 0, hand: 1 };
const KEYS = ['upperArmR', 'forearmR', 'spine', 'thighL', 'shinL', 'thighR', 'hips', 'twist'];

/**
 * The pose at progress u (0..1) of a bowl (or a lob): smooth between keys, flat over the held finish.
 * Pure. @returns {object} a shared object (overwritten by the next call)
 */
export function bowlPose(u, lob = false) {
  const tab = lob ? LOB : BOWL;
  const k = u <= 0 ? 0 : u >= 1 ? 1 : u;
  let i = 0;
  while (i < tab.length - 2 && tab[i + 1][0] < k) i++;
  const a = tab[i];
  const b = tab[i + 1];
  const t = smooth01((k - a[0]) / Math.max(1e-6, b[0] - a[0]));
  for (let j = 0; j < KEYS.length; j++) OUT[KEYS[j]] = a[j + 1] + (b[j + 1] - a[j + 1]) * t;
  // the ball leaves her hand at the release; a new one pops in (0 → 1.15 → 1)
  if (k < HAND_OUT) OUT.hand = 1;
  else if (k < HAND_BACK) OUT.hand = 0.2;
  else {
    const p = Math.min(1, (k - HAND_BACK) / 0.12);
    if (p >= 1) OUT.hand = 1;
    else OUT.hand = p < 0.6 ? 0.2 + (1.15 - 0.2) * smooth01(p / 0.6) : 1.15 - 0.15 * smooth01((p - 0.6) / 0.4);
  }
  return OUT;
}

/**
 * The time scale that fits the pose into her interval (never below 1, at most 2.2): a girl who rolls
 * faster than the pose plays it faster instead of cutting it off.
 * @param {number} interval her seconds between shots (game time) @param {number} timeScale game speed
 */
export function fitScale(interval, timeScale = 1) {
  const real = interval / Math.max(0.25, timeScale);
  if (!(real > 0)) return 1;
  return Math.max(1, Math.min(2.2, BOWL_T / (0.9 * real)));
}

/** Applies a bowl pose to a figure through its overlay (bones it lacks are skipped). */
export function applyBowl(ov, p) {
  ov.turn('upper_arm_R', AXIS_X, p.upperArmR);
  ov.turn('forearm_R', AXIS_X, p.forearmR);
  ov.turn('spine', AXIS_X, p.spine * 0.55);
  ov.turn('chest', AXIS_X, p.spine * 0.45);
  ov.turn('spine', AXIS_Y, p.twist * 0.5);
  ov.turn('thigh_L', AXIS_X, p.thighL);
  ov.turn('shin_L', AXIS_X, p.shinL);
  ov.turn('thigh_R', AXIS_X, p.thighR);
  if (p.hand !== 1) ov.scale('hand_R', p.hand);
}
