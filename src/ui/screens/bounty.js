// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('bounty');
  body.textContent = 'Coming soon: bounty';
  root.appendChild(el);
}
