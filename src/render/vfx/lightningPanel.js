// Dev-only lightning tuning panel (lil-gui). Loaded only in the dev server, and only with `?lightningLab` in the URL
// (BattleRenderer: `import.meta.env.DEV && …`, so the production build drops the import and this file with it).
// Edits a working copy of the presets live: the next strike uses it; "Copy preset" puts it on the clipboard as the
// plain data src/render/vfx/lightningPresets.js holds.
import GUI from 'lil-gui';
import { LIGHTNING_PRESETS } from './lightningPresets.js';

/** @param {{ lightningDemo: Function, lightning: object }} renderer @param {object} sim */
export function mountLightningPanel(renderer, sim) {
  const work = JSON.parse(JSON.stringify(LIGHTNING_PRESETS));
  const w = sim?.map?.width || 16;
  const h = sim?.map?.height || 10;
  const state = { preset: 'storm', hops: 5, spacing: 1.6, forks: 0, every: 0.6, loop: true, x: w * 0.25, z: h * 0.5, live: true };
  const gui = new GUI({ title: 'Lightning lab' });
  gui.domElement.style.zIndex = 9999;
  /** The chain's points: the live enemies nearest to each other, else a zig-zag line from the start spot. */
  const points = () => {
    const pts = [[state.x, 0.9, state.z]];
    const foes = state.live ? (sim?.enemies || []).filter((e) => !e.dead && !e.hidden) : [];
    let cx = state.x;
    let cz = state.z;
    const used = new Set();
    for (let i = 0; i < state.hops; i++) {
      let best = null;
      let bd = Infinity;
      for (const e of foes) {
        if (used.has(e.uid)) continue;
        const d = Math.hypot(e.x - cx, e.y - cz);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best && bd < state.spacing * 3) {
        used.add(best.uid);
        cx = best.x;
        cz = best.y;
      } else {
        cx += state.spacing;
        cz += (i % 2 ? -1 : 1) * state.spacing * 0.4;
      }
      pts.push([cx, 0.35, cz]);
    }
    return pts;
  };
  const strike = () => {
    const rec = renderer.lightningDemo(state.preset, points(), { forks: state.forks });
    // the layer reads the preset it is handed: point it at the working copy
    if (rec) rec.p = work[state.preset];
  };
  gui.add(state, 'preset', Object.keys(work)).onChange(() => rebuild());
  gui.add(state, 'hops', 1, 12, 1);
  gui.add(state, 'spacing', 0.5, 3, 0.05);
  gui.add(state, 'forks', 0, 2, 1);
  gui.add(state, 'every', 0.15, 2, 0.05).name('loop every (s)');
  gui.add(state, 'x', 0, w, 0.25);
  gui.add(state, 'z', 0, h, 0.25);
  gui.add(state, 'live').name('chain the enemies');
  gui.add(state, 'loop');
  gui.add({ strike }, 'strike').name('Strike now');
  gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(work[state.preset], null, 2)) }, 'copy').name('Copy preset');
  let folder = null;
  function rebuild() {
    folder?.destroy();
    const p = work[state.preset];
    folder = gui.addFolder(p.label);
    folder.addColor(p, 'ink');
    folder.addColor(p, 'body');
    folder.addColor(p, 'core');
    folder.addColor(p, 'glow');
    folder.add(p, 'width', 0.01, 0.15, 0.005);
    folder.add(p, 'inkWidth', 0, 0.06, 0.002);
    folder.add(p, 'coreShare', 0.1, 0.9, 0.01);
    folder.add(p, 'glowWidth', 1, 8, 0.1);
    folder.add(p, 'glowAlpha', 0, 1, 0.01);
    folder.add(p, 'taper', 0.1, 1, 0.01);
    folder.add(p, 'jag', 0, 0.5, 0.01);
    folder.add(p, 'jagMax', 0.05, 1, 0.01);
    folder.add(p, 'zigzag', 0, 1, 0.01);
    folder.add(p, 'lift', 0, 1, 0.01);
    folder.add(p, 'grow', 0, 0.2, 0.005);
    folder.add(p, 'hopDelay', 0, 0.1, 0.002);
    folder.add(p, 'hold', 0, 0.4, 0.005);
    folder.add(p, 'fade', 0.02, 0.5, 0.005);
    folder.add(p, 'restrike', 0, 0.2, 0.005);
    folder.add(p, 'flicker', 0, 1, 0.01);
    folder.add(p, 'hdr', 0, 3, 0.05);
  }
  rebuild();
  let last = 0;
  const tick = () => {
    const now = performance.now() / 1000;
    if (state.loop && now - last >= state.every) {
      last = now;
      strike();
    }
    timer = setTimeout(tick, 50);
  };
  let timer = setTimeout(tick, 400);
  return { gui, dispose: () => { clearTimeout(timer); gui.destroy(); } };
}
