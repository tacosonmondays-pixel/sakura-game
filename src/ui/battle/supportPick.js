// The Support Student picked in stage prep (BANNERS §E.1), handed to the battle it starts. In memory only: a
// reloaded battle page starts without her (Continue keeps her through the battle record instead).
let pick = null;

/** @param {{ owner: string, unitId: string, unit: object, name?: string }|null} p */
export function setSupportPick(p) {
  pick = p && typeof p.owner === 'string' && typeof p.unitId === 'string' && p.unit ? { ...p } : null;
}

/** The current pick (stage prep shows it). */
export const supportPick = () => pick;

/** The pick for a battle link's `sup=<owner>` (null when it does not match). */
export function pickFor(owner) {
  return pick && pick.owner === owner ? pick : null;
}
