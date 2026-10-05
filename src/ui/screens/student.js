// STUB screen — see CONTRACTS.md for the owner.
import { screen } from '../components.js';
export function render(root) {
  const { el, body } = screen('student');
  body.textContent = 'Coming soon: student';
  root.appendChild(el);
}
