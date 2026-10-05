// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('bestiary');
  body.textContent = 'Coming soon: bestiary';
  root.appendChild(el);
}
