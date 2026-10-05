// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('stage');
  body.textContent = 'Coming soon: stage';
  root.appendChild(el);
}
