// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('students');
  body.textContent = 'Coming soon: students';
  root.appendChild(el);
}
