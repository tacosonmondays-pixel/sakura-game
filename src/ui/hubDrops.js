// UI M5b review: stage prep's drop grid (screens/stage.js dropGrid, M4's) as it reads on the Bounty and Total Assault
// hubs. A drop that needs a harder tier said its tier's name under its tile ("Nightmare+"); at the 12 / 13 px floor
// three of them ran into each other under 48 px tiles. On the hubs it is a lock and the short tier ("NM+", "Hard+"),
// with the whole rule in its title and aria label ("Drops from Nightmare up"). Display only; stage prep keeps its own.
import { h } from './dom.js';
import { ico } from './kit.js';

/** The short tier a gated drop names under its tile. */
export const SHORT_TIER = Object.freeze({ Easy: 'Easy+', Normal: 'Normal+', Hard: 'Hard+', Nightmare: 'NM+' });

/**
 * Rewrites a dropGrid()'s gated labels in place ("Nightmare+" → lock + "NM+").
 * @param {HTMLElement} grid a dropGrid() result
 * @returns {HTMLElement} the same grid
 */
export function shortGatedDrops(grid) {
  for (const label of grid.querySelectorAll('.ma-drop.gated > .ma-drop-chance')) {
    const tier = label.textContent.trim().replace(/\+$/, '');
    const rule = `Drops from ${tier} up`;
    label.replaceChildren(ico('lock', 'ui-ico.ma-drop-gate-ico'), h('span', SHORT_TIER[tier] || `${tier}+`));
    label.title = rule;
    label.setAttribute('aria-label', rule);
    label.dataset.tier = tier;
  }
  return grid;
}
