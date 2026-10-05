// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('backpack');
  body.textContent = 'Coming soon: backpack';
  root.appendChild(el);
}
