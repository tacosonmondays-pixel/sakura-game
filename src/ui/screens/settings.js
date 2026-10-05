// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('settings');
  body.textContent = 'Coming soon: settings';
  root.appendChild(el);
}
