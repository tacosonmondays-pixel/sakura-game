// Geometry-only eyes used when no canvas is available (node tests / headless builds).
import { BONES, LM } from './body.js';
import { part, ellipsoid } from './geom.js';
import { col } from './toon.js';

export function fallbackEyes(ctx) {
  const parts = [];
  const iris = col(ctx.pal.eyes || '#4a7fd0');
  for (const side of [-1, 1]) {
    const x = side * 0.43;
    parts.push(part(ellipsoid(0.15, 0.21, 0.06, 10, 8), { pos: [x, LM.eyeY, LM.faceZ + 0.02], color: col('#2a1d2e'), bone: BONES.head }));
    parts.push(part(ellipsoid(0.11, 0.16, 0.05, 10, 8), { pos: [x, LM.eyeY - 0.02, LM.faceZ + 0.05], color: iris, bone: BONES.head }));
    parts.push(part(ellipsoid(0.045, 0.05, 0.03, 6, 4), { pos: [x - 0.04, LM.eyeY + 0.07, LM.faceZ + 0.08], color: col('#ffffff'), bone: BONES.head }));
  }
  return parts;
}
