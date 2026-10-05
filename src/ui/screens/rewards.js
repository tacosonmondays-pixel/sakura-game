// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('rewards');
  body.textContent = 'Coming soon: rewards';
  root.appendChild(el);
}
