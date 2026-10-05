// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('mall');
  body.textContent = 'Coming soon: mall';
  root.appendChild(el);
}
