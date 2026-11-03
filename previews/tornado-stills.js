// Tornado reference stills (dev only; docs/VFX.md "Toon core"): the real tornado layer (src/render/vfx/tornado.js) on
// the lab patch (previews/vfxLabStage.js) at fixed seeded times, stepped by hand at 1/60 s, so the same build gives the
// same picture. e2e/toon-core-tornado-diff.mjs shoots these before and after a change to the tornado and diffs them.
//
//   /previews/tornado-stills.html?preset=fire&quality=high&times=0.7,1.6&clean=1
//   window.__stills.ready → true once the board stands; window.__shot(i) steps to times[i] and draws it
//   (call in order: the column keeps running between shots, exactly as it would in a battle)
import { createLabStage } from './vfxLabStage.js';
import { createTornadoFx } from '../src/render/vfx/tornado.js';
import { createVisualRandom, visualSeed } from '../src/render/vfx/random.js';

const Q = new URLSearchParams(location.search);
const preset = Q.get('preset') || 'fire';
const quality = Q.get('quality') || 'high';
const times = (Q.get('times') || '0.7,1.6').split(',').map(Number).filter((t) => t > 0).sort((a, b) => a - b);
const reduceMotion = Q.get('rm') === '1';
if (Q.get('clean') === '1') document.body.classList.add('clean');

const W = innerWidth;
const H = innerHeight;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
window.__stills = { ready: false, preset, quality, times, t: 0 };

const DT = 1 / 60;

async function main() {
  const stage = await createLabStage({ canvas, width: W, height: H, quality, girl: Q.get('girl') ?? 'akane' });
  const rand = createVisualRandom(visualSeed('lab', 'tornado', preset)).fork('tornado');
  const tornado = createTornadoFx({ scene: stage.scene, batches: stage.batches, atlas: stage.atlas, quality, reduceMotion, rand });
  tornado.setGlow(quality, stage.glow);
  tornado.spawn(preset, 5.2, 3.6, { seconds: 2.4, size: 1.2 });
  let frame = 0;
  window.__shot = (i) => {
    const target = Math.round(times[i] / DT);
    while (frame < target) {
      stage.step(DT, (d) => tornado.update(d));
      frame++;
    }
    const info = stage.render();
    window.__stills.t = frame * DT;
    document.getElementById('tag').textContent = `tornado ${preset} · ${quality} · ${(frame * DT).toFixed(2)} s`;
    return { frame, t: frame * DT, rings: tornado.stats.rings, ...info };
  };
  window.__stills.ready = true;
}

main().catch((e) => {
  window.__stills.error = String(e?.stack || e);
  console.error(e);
});
