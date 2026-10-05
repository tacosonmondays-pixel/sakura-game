// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('recruit');
  body.textContent = 'Coming soon: recruit';
  root.appendChild(el);
}
