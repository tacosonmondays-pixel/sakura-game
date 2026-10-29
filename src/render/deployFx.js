// The pop of something a girl sets on the field (the sim's 'deploy' events, src/sim/sentries.js): Yuzuha's sentry
// unfolding or her Capture Net laid on the road. A safety-orange ring and a small puff on its spot; an Emergency
// Deploy sentry (outside her cap) pops a little bigger. Display only.
export const DEPLOY_COLOR = '#ff8a2a';

/**
 * Draws one 'deploy' event. @param {{ x: number, y: number, kind?: string, extra?: boolean }} ev
 * @param {{ ring: Function, puff: Function }} fx the battle's effect layer (src/render/fx.js)
 * @returns {boolean} whether it drew
 */
export function deployFx(ev, fx) {
  if (!ev || !Number.isFinite(ev.x) || !Number.isFinite(ev.y)) return false;
  const big = ev.extra ? 1.25 : 1;
  const r1 = (ev.kind === 'net' ? 0.6 : 0.5) * big;
  fx.ring(ev.x, ev.y, 0.08, r1, 0.35, DEPLOY_COLOR);
  fx.puff(ev.x, 0.15, ev.y, '#ffffff', 4, 0.25, 0.25);
  return true;
}
