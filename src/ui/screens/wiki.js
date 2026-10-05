// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('wiki');
  body.textContent = 'Coming soon: wiki';
  root.appendChild(el);
}
