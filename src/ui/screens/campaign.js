// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('campaign');
  body.textContent = 'Coming soon: campaign';
  root.appendChild(el);
}
