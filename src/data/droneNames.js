// Chika names every drone she builds (her bio). UI only: never read by the sim, so renaming them
// changes no co-op hash. Drone n (1, 2, …) is NAMES[(n − 1) % 12], with " II", " III" … after a wrap.
export const DRONE_NAMES = Object.freeze([
  'Sprocket', 'Rivet', 'Pip', 'Dynamo', 'Gimbal', 'Piston', 'Bobbin', 'Spindle', 'Thimble', 'Sparkplug', 'Flywheel', 'Doohickey',
]);

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** "#3 Pip", "#13 Sprocket II". */
export function droneName(n) {
  const i = Math.max(0, (n | 0) - 1);
  const lap = Math.floor(i / DRONE_NAMES.length);
  return `#${n} ${DRONE_NAMES[i % DRONE_NAMES.length]}${ROMAN[lap] ?? ` ${lap + 1}`}`;
}
