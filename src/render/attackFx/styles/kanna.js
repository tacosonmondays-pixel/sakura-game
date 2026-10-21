// Kanna ★ (hero · duel strikes with a focus ramp). Signature "Drum shock": every drumstick strike
// lands the usual slash on her target plus a coral drum ring popping out of it; as her focus ramp
// builds a second (and third) ring follows. Her Festival Drumfall ultimate (concentric coral
// shockwaves on the struck enemy) is drawn by src/render/rosterFx.js.
import { genericAttack } from './generic.js';
import { drumBeat } from '../patterns/rings.js';
import { handFlash } from './util.js';

const CORAL = '#f589a0';

export const kanna = {
  id: 'kanna',

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
    handFlash(ctx, t, ctx.col('#ffd0da'), 0.3);
    const e = ctx.enemy(ev.targetUid);
    if (!e || !ctx.cap('sweep')) return;
    const beats = (ev.ramp || 0) >= 6 ? 3 : (ev.ramp || 0) >= 3 ? 2 : 1;
    for (let b = 0; b < beats; b++) drumBeat(ctx, e.x, e.z, ctx.col(CORAL), b * 0.07, 0.8 + b * 0.15);
  },
};
