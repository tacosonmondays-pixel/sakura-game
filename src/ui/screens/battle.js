// Battle screen (CONTRACTS.md §10). Route: #/battle?stage=1-1&difficulty=normal[&endless=1][&resume=<run id>]
// Co-op: #/battle?coop=<ROOM> (the Sim comes from the room's Lockstep). Clan boss: &clanBoss=<attempt id>
// (from start_boss_attempt; the battle submits its damage against that attempt).
// The heavy lifting lives in src/ui/battle/** (controller + HUD modules).
import '../styles/battle.css';
import { mountBattle } from '../battle/controller.js';
import { getSession, normalizeCode } from '../../online/coop/session.js';
import { parseHash, rememberParams } from '../router.js';

/**
 * @param {HTMLElement} root
 * @param {{ stage?: string, difficulty?: string, endless?: string, resume?: string }} params
 *   resume: a battle save's run id (Continue: src/systems/battleSave.js)
 * @returns {() => void} cleanup
 */
export function render(root, params = {}) {
  let current = null;
  const mount = () => {
    current = mountBattle(root, params, {
      coop: params.coop ? getSession() : null,
      // fresh (Restart, Retry): a new battle, so the URL stops naming the saved run
      restart: ({ fresh = false } = {}) => {
        if (fresh && params.resume) {
          rememberParams('battle', { resume: null });
          delete params.resume;
        }
        current?.destroy();
        mount();
      },
    });
  };
  mount();
  return () => {
    current?.destroy();
    const s = params.coop ? getSession() : null;
    // "Back to the room" took the session back to its lobby already (or it is closed)
    if (!s || s.phase !== 'battle') return;
    // the battle is over and the screen goes to this room's lobby another way (the phone's back
    // gesture, the browser's Back): the same as "Back to the room" — the room and its code stay.
    // (The router has the next screen's address in place before this screen is cleaned up.)
    const next = parseHash();
    if (s.lockstep?.finished && next.name === 'coop' && normalizeCode(next.params.id) === s.code) s.backToLobby();
    // otherwise leaving a co-op battle screen leaves the room (the ally keeps playing on their own)
    else s.close();
  };
}
