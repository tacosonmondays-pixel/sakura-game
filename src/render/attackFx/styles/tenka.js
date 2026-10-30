// Tenka (powerhouse · hitscan coil bolts). STAND-IN until her FX milestone (BUILD_PLAN 6.9 T4): the
// generic attack look in her own colour. T4 draws the coil bolts, Critical Mass and the wells.
// Her muzzle flash sits on her figure's coilgun (tenka.glb + tenka-coilgun.glb on hand_R): in
// attack_rifle the barrel tip is ~0.71 in front of her feet, ~0.69 up and ~0.21 to her right at the
// battle's tower scale (the coilgun drawn 1.25x about its grip, src/models/glbChibi.js PROP_LOOK; measured by
// e2e/display-polish-2.mjs), not at the generic chest-height spot 0.3 in front of her.
import { genericAttack, towerHex } from './generic.js';

const MUZZLE = { fwd: 0.71, up: 0.69, right: 0.21 };

export const tenka = {
  id: 'tenka',

  onAttack(ev, tw, t, ctx) {
    const muzzle = ev.kind !== 'slash' && ev.kind !== 'trap' && ev.kind !== 'build' && ev.kind !== 'pulse' && ev.kind !== 'beam' && ev.kind !== 'chain';
    if (!muzzle) {
      genericAttack(ev, tw, t, ctx);
      return;
    }
    const v = ctx.tower(ev.towerUid);
    if (!v || !ctx.cap('muzzle')) return;
    const m = v.model.position;
    const f = v.facing;
    // forward (sin f, cos f); her right hand is local -x: (-cos f, +sin f)
    const x = m.x + Math.sin(f) * MUZZLE.fwd - Math.cos(f) * MUZZLE.right;
    const z = m.z + Math.cos(f) * MUZZLE.fwd + Math.sin(f) * MUZZLE.right;
    ctx.fx.flash(x, m.y + MUZZLE.up, z, towerHex(t), 0.35, 0.09);
  },
};
