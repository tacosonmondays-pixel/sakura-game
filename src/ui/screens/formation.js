// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('formation');
  body.textContent = 'Coming soon: formation';
  root.appendChild(el);
}
