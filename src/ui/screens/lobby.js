// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('lobby');
  body.textContent = 'Coming soon: lobby';
  root.appendChild(el);
}
