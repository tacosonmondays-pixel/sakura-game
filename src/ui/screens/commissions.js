// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('commissions');
  body.textContent = 'Coming soon: commissions';
  root.appendChild(el);
}
