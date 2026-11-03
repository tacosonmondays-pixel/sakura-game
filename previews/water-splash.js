// Water splash lab (dev only; docs/VFX.md "Water splash"): the toon splash layer (src/render/vfx/water.js) on the lab
// patch (previews/vfxLabStage.js: a battle-like board on our own lake look, the battle's lights, camera and high's
// bloom + grade) with a real chibi beside it for scale. Not wired into the battle yet.
//
//   /previews/water-splash.html                       live: a splash every 2.2 s, preset / tier / Reduce Motion buttons
//   ?preset=fresh|river|frost  &quality=high|medium|low  &rm=1  &size=1  &girl=nami  &clean=1 (no buttons)
//   &zoom=2.5 (a close-up round the splash)  &manual=1: no loop; window.__lab.shot(t) steps one splash to t s and draws
//   it (call in rising order); window.__lab.screen() → the splash's screen px; window.__lab.stats() → draw calls etc.
import { createLabStage } from './vfxLabStage.js';
import { createWaterFx } from '../src/render/vfx/water.js';
import { WATER_PRESETS } from '../src/render/vfx/waterPresets.js';
import { createVisualRandom, visualSeed } from '../src/render/vfx/random.js';

const Q = new URLSearchParams(location.search);
const presetId = WATER_PRESETS[Q.get('preset')] ? Q.get('preset') : 'fresh';
const quality = ['high', 'medium', 'low'].includes(Q.get('quality')) ? Q.get('quality') : 'high';
const rm = Q.get('rm') === '1';
const size = Number(Q.get('size') || 1);
const manual = Q.get('manual') === '1';
const zoom = Number(Q.get('zoom') || 1);
if (Q.get('clean') === '1') document.body.classList.add('clean');
/** Where the splash lands: on the road, a tile and a half left of the chibi. */
const AT = [5.3, 3.5];

const W = innerWidth;
const H = innerHeight;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const DT = 1 / 60;
window.__lab = { ready: false };

async function main() {
  const stage = await createLabStage({ canvas, width: W, height: H, quality, girl: Q.get('girl') ?? 'nami', zoom, focus: AT });
  const rand = createVisualRandom(visualSeed('lab', 'water', presetId)).fork('water');
  const water = createWaterFx({ scene: stage.scene, camera: stage.camera, quality, reduceMotion: rm, rand });
  water.setGlow(quality, stage.glow);
  let frame = 0;
  let rec = water.splash(presetId, AT[0], AT[1], { size });
  const info = document.getElementById('info');
  const show = () => {
    const s = water.stats;
    info.textContent = `${presetId} · ${quality}${rm ? ' · Reduce Motion' : ''} · ${(frame * DT).toFixed(2)} s · water calls ${s.calls} (crown ${s.crown}, drops ${s.drops}, ground ${s.ground})`;
  };

  window.__lab = {
    ready: true,
    preset: presetId,
    quality,
    rm,
    /** Steps the splash to t seconds (rising order) and draws that frame. */
    shot(t) {
      const target = Math.round(t / DT);
      while (frame < target) {
        stage.step(DT, (d) => water.update(d));
        frame++;
      }
      const r = stage.render();
      show();
      return { t: frame * DT, ...water.stats, frameCalls: r.calls };
    },
    /** The splash's screen px (the board crops round it). */
    screen: () => stage.toScreen(AT[0], 0.25, AT[1]),
    stats: () => ({ ...water.stats, sceneCalls: stage.calls() }),
    /**
     * Frame time on this machine (headless SwiftShader: compare runs, nothing absolute about a phone): `n` drawn frames
     * of the board alone, then `n` with `count` splashes kept going; median ms and the extra draw calls.
     */
    bench(n = 60, count = 4) {
      const px = new Uint8Array(4);
      const time = (fn) => {
        const ms = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          stage.step(DT, (d) => {
            fn(i);
            water.update(d);
          });
          stage.render();
          // (a one-pixel read waits for the frame: headless WebGL is otherwise asynchronous)
          const gl = stage.renderer.getContext();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return ms[Math.floor(n / 2)];
      };
      water.clear();
      const idle = time(() => {});
      const idleCalls = stage.calls();
      const busy = time((i) => {
        if (i % 15 === 0) for (let k = 0; k < count; k++) water.splash(presetId, AT[0] + (k - count / 2) * 0.9, AT[1] + (k % 2) * 0.6, { size });
      });
      return { idleMs: idle, busyMs: busy, idleCalls, busyCalls: stage.calls(), live: water.stats.live, quality };
    },
  };

  if (manual) return;
  // live: a new splash every 2.2 s; the buttons switch preset, tier and Reduce Motion
  const sel = document.getElementById('preset');
  for (const id of Object.keys(WATER_PRESETS)) sel.add(new Option(WATER_PRESETS[id].label, id, id === presetId, id === presetId));
  const qs = document.getElementById('quality');
  qs.value = quality;
  const reload = (k, v) => {
    Q.set(k, v);
    location.search = Q.toString();
  };
  sel.onchange = () => reload('preset', sel.value);
  qs.onchange = () => reload('quality', qs.value);
  const rmb = document.getElementById('rm');
  rmb.classList.toggle('on', rm);
  rmb.onclick = () => reload('rm', rm ? '0' : '1');
  document.getElementById('go').onclick = () => {
    rec = water.splash(presetId, AT[0], AT[1], { size });
  };
  let last = performance.now();
  let since = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    since += dt;
    if (since > 2.2) {
      since = 0;
      rec = water.splash(presetId, AT[0], AT[1], { size });
    }
    stage.step(dt, (d) => water.update(d));
    frame++;
    stage.render();
    show();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  void rec;
}

main().catch((e) => {
  window.__lab = { ready: false, error: String(e?.stack || e) };
  console.error(e);
});
