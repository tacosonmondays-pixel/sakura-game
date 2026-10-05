// Battle screen (CONTRACTS.md §10). Route: #/battle?stage=1-1&difficulty=normal[&endless=1]
// The heavy lifting lives in src/ui/battle/** (controller + HUD modules).
import '../styles/battle.css';
import { mountBattle } from '../battle/controller.js';

/**
 * @param {HTMLElement} root
 * @param {{ stage?: string, difficulty?: string, endless?: string }} params
 * @returns {() => void} cleanup
 */
export function render(root, params = {}) {
  let current = null;
  const mount = () => {
    current = mountBattle(root, params, {
      restart: () => {
        current?.destroy();
        mount();
      },
    });
  };
  mount();
  return () => current?.destroy();
}
