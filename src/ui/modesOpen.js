// Which modes that can wear "Open!" (src/ui/badges.js OPEN_MODES) are open for this save: the Missions hub asks it
// for its stickers, and main.js asks it when the player visits a mode's screen by another door (a visit to an open
// mode is remembered; a visit to its locked screen is not). Pure: the save comes in.
import { isStageUnlocked } from '../systems/unlocks.js';
import { titansUnlocked } from '../systems/titans.js';
import { isSandboxUnlocked } from '../systems/sandbox.js';

const OPEN = {
  titans: (p) => titansUnlocked(p), // after 3-5
  assault: (p) => isStageUnlocked(p, 'boss-lych'),
  challenge: (p) => isStageUnlocked(p, 'challenge'),
  sandbox: (p) => isSandboxUnlocked(p), // after SANDBOX_UNLOCK_CLEARS campaign clears
};

/** True when `modeId` is open for `profile`. */
export function modeOpen(profile, modeId) {
  return !!profile && !!OPEN[modeId]?.(profile);
}

/** The modes open now, in OPEN_MODES order. */
export function modesOpenNow(profile) {
  return Object.keys(OPEN).filter((id) => modeOpen(profile, id));
}
