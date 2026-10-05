// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('challenge');
  body.textContent = 'Coming soon: challenge';
  root.appendChild(el);
}
