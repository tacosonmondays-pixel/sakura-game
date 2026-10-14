// Projectile progress + visual offsets (pure, no THREE). See docs/ATTACK_FX.md "Truth rules".
//
// The sim moves every projectile; the renderer may draw it starting somewhere else (a drone's
// nose, a lance slot above a girl's head) and with a little flourish (a lob, a flutter), but
// every horizontal offset fades out by progress f′ = 0.6 and the drawn projectile then sits
// exactly on the sim's position, so it lands where and when the sim resolves the hit.
//
//   f′ = travel / (travel + d)      d = distance left to the target's hit circle (≥ 0)
//   k  = 1 − smoothstep(0, 0.6, f′) origin-blend weight (1 at spawn, 0 from f′ = 0.6)
//   drawn.xy = sim.xy + (M − S)·k   M = visual muzzle, S = sim spawn point
//   drawn.z  = sim.z + (M.z − S.z)·k + bump(h, f′)  (vertical lob, 0 at both ends)
//   drawn.xy += n̂ · bend(A, f′)    (lateral flutter, 0 at spawn and from f′ = 0.6)

/** Progress where every horizontal offset has faded out. */
export const BLEND_END = 0.6;

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Flight progress in [0, 1]: 1 exactly at contact (the remaining distance reaches the hit
 * circle), even when the target walked toward the projectile.
 * @param {number} travel distance flown so far (sim `p.travel`)
 * @param {number} dist centre distance to the aim point (sim `p.tx, p.ty`)
 * @param {number} hr hit radius of the target (sim `hitRadius`)
 */
export function progress(travel, dist, hr) {
  const d = Math.max(0, dist - hr);
  const t = Math.max(0, travel);
  if (d <= 0) return 1;
  return t / (t + d);
}

/** Origin-blend weight: 1 at f′ = 0, monotonic, exactly 0 for f′ ≥ 0.6. */
export function blendWeight(f) {
  if (f >= BLEND_END) return 0;
  return 1 - smoothstep(0, BLEND_END, f);
}

/** Vertical lob of height h: 0 at both ends, h at f′ = 0.5. */
export function bump(h, f) {
  const c = clamp(f, 0, 1);
  return h * 4 * c * (1 - c);
}

/** Lateral flutter of amplitude A: 0 at f′ = 0, peak at 0.3, exactly 0 for f′ ≥ 0.6. */
export function bend(A, f) {
  if (f <= 0 || f >= BLEND_END) return 0;
  return A * Math.sin(Math.PI * (f / BLEND_END));
}

/**
 * Drawn position of a projectile (writes `out.x, out.y, out.z`; y = ground depth axis).
 * @param {{x:number,y:number,z:number}} sim current sim position (z = height)
 * @param {{sx,sy,sz,mx,my,mz}} o sim spawn S and visual muzzle M
 * @param {number} f progress f′
 * @param {number} h lob height (0 = none)
 * @param {number} A lateral bend amplitude (0 = none)
 * @param {number} nx @param {number} ny unit normal for the bend (⟂ velocity)
 */
export function drawnPosition(sim, o, f, h, A, nx, ny, out) {
  const k = blendWeight(f);
  out.x = sim.x + (o.mx - o.sx) * k;
  out.y = sim.y + (o.my - o.sy) * k;
  out.z = sim.z + (o.mz - o.sz) * k + (h ? bump(h, f) : 0);
  if (A) {
    const b = bend(A, f);
    out.x += nx * b;
    out.y += ny * b;
  }
  out.k = k;
  return out;
}
