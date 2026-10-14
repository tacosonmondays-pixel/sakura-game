// Spotter familiar (a hawk) that hovers just above and ahead of the girl's current target —
// the pursuit pattern of a helicopter-style unit — and dives when that target gets marked.
// It never attacks; it only points at the enemy the sim is shooting.
import { FAMILIAR } from '../context.js';

export class Spotter {
  constructor() {
    this.x = NaN;
    this.y = 0;
    this.h = 1.4;
    this.uid = null;
    this.dive = 0;
    this.flap = 0;
  }

  /** Dives onto the target for 0.25 s (status 'mark' landed on it). */
  diveAt() {
    this.dive = 0.25;
  }

  update(ctx, gdt, t, targetUid, leash, color) {
    let gx = t.x;
    let gy = t.y;
    let gh = 1.5;
    const e = ctx.enemy(targetUid);
    if (e) {
      // just ahead of the target along its facing, but never outside the girl's reach
      gx = e.x + Math.sin(e.facing || 0) * 0.3;
      gy = e.z + Math.cos(e.facing || 0) * 0.3;
      gh = ctx.enemyH(e) + 0.5;
      const dx = gx - t.x;
      const dy = gy - t.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > leash) {
        gx = t.x + (dx / d) * leash;
        gy = t.y + (dy / d) * leash;
      }
    }
    if (this.x !== this.x) {
      this.x = t.x;
      this.y = t.y;
    }
    const k = 1 - Math.exp(-4 * gdt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.dive = Math.max(0, this.dive - gdt);
    const diveH = this.dive > 0 ? -0.35 * Math.sin((this.dive / 0.25) * Math.PI) : 0;
    this.h += (gh - this.h) * k;
    this.flap += gdt;
    const h = this.h + diveH + 0.05 * Math.sin(ctx.time * 3);
    const s = 0.34 * ctx.readScale;
    const wing = 0.75 + 0.25 * Math.abs(Math.sin(this.flap * 7));
    if (!ctx.quad(ctx.b.bbN, FAMILIAR, this.x, h, this.y, s, s * 0.66 * wing, ctx.R.hawk, color, 1)) return;
    ctx.quadRGB(ctx.b.groundN, FAMILIAR, this.x, 0.065, this.y, 0.22, 0.16, ctx.R.shadow, 0.05, 0.05, 0.1, 0.25);
  }
}
