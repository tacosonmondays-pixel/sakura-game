// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('battle');
  body.textContent = 'Coming soon: battle';
  root.appendChild(el);
}
