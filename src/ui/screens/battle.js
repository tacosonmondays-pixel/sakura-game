// Battle screen (CONTRACTS.md §10). Route: #/battle?stage=1-1&difficulty=normal[&endless=1]
// Co-op: #/battle?coop=<ROOM> (the Sim comes from the room's Lockstep). Clan boss: &clanBoss=<attempt id>
// (from start_boss_attempt; the battle submits its damage against that attempt).
// The heavy lifting lives in src/ui/battle/** (controller + HUD modules).
import '../styles/battle.css';
import { mountBattle } from '../battle/controller.js';
import { getSession } from '../../online/coop/session.js';

/**
 * @param {HTMLElement} root
 * @param {{ stage?: string, difficulty?: string, endless?: string }} params
 * @returns {() => void} cleanup
 */
export function render(root, params = {}) {
  let current = null;
  const mount = () => {
    current = mountBattle(root, params, {
      coop: params.coop ? getSession() : null,
      restart: () => {
        current?.destroy();
        mount();
      },
    });
  };
  mount();
  return () => {
    current?.destroy();
    // leaving a co-op battle screen leaves the room (the ally keeps playing on their own) —
    // unless "Back to the room" already took the session back to its lobby
    const s = params.coop ? getSession() : null;
    if (s && s.phase !== 'lobby') s.close();
  };
}
