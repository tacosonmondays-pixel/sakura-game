// Dev-only tornado tuning panel (lil-gui). Loaded only in the dev server, and only with `?tornadoLab` in the URL
// (BattleRenderer: `import.meta.env.DEV && …`, so the production build drops the import and this file with it).
// Edits a working copy of the presets live: the next spawn uses it; "Copy preset" puts it on the clipboard as the
// plain data src/render/vfx/tornadoPresets.js holds.
import GUI from 'lil-gui';
import { TORNADO_PRESETS } from './tornadoPresets.js';

/** @param {{ tornadoDemo: Function, tornado: object, setQuality?: Function }} renderer @param {object} sim */
export function mountTornadoPanel(renderer, sim) {
  const work = JSON.parse(JSON.stringify(TORNADO_PRESETS));
  const state = { preset: 'fire', seconds: 2.4, size: 1.2, loop: true, x: (sim?.map?.width || 16) / 2, z: (sim?.map?.height || 10) / 2 };
  const gui = new GUI({ title: 'Tornado lab' });
  gui.domElement.style.zIndex = 9999;
  const spawn = () => {
    // the layer reads the preset it is handed: point it at the working copy
    const layer = renderer.tornado;
    const rec = layer.spawn(state.preset, state.x, state.z, { seconds: state.seconds, size: state.size });
    if (rec) rec.p = work[state.preset];
  };
  gui.add(state, 'preset', Object.keys(work)).onChange(() => rebuild());
  gui.add(state, 'seconds', 0.5, 6, 0.1);
  gui.add(state, 'size', 0.5, 2.5, 0.05);
  gui.add(state, 'x', 0, sim?.map?.width || 32, 0.25);
  gui.add(state, 'z', 0, sim?.map?.height || 20, 0.25);
  gui.add(state, 'loop');
  gui.add({ spawn }, 'spawn').name('Spawn now');
  gui.add({ copy: () => navigator.clipboard?.writeText(JSON.stringify(work[state.preset], null, 2)) }, 'copy').name('Copy preset');
  let folder = null;
  function rebuild() {
    folder?.destroy();
    const p = work[state.preset];
    folder = gui.addFolder(p.label);
    folder.add(p, 'life', 0.3, 3, 0.05);
    folder.add(p, 'height', 0.5, 5, 0.05);
    folder.add(p, 'r0', 0.05, 1.5, 0.01);
    folder.add(p, 'r1', 0.1, 2.5, 0.01);
    folder.add(p, 'inner', 0.1, 0.9, 0.01);
    folder.add(p, 'spin', 0, 10, 0.1);
    folder.add(p, 'twist', 0, 10, 0.1);
    folder.add(p, 'helix', 0, 0.6, 0.01);
    folder.add(p, 'sway', 0, 0.8, 0.01);
    folder.add(p, 'swayHz', 0, 4, 0.05);
    folder.add(p.noise, '0', 0.5, 8, 0.1).name('noise around');
    folder.add(p.noise, '1', 0.2, 4, 0.05).name('noise along');
    folder.add(p, 'scroll', 0, 4, 0.05);
    folder.add(p.erode, '0', 0, 1, 0.01).name('erode young');
    folder.add(p.erode, '1', 0, 1.2, 0.01).name('erode old');
    folder.add(p, 'hdr', 0, 4, 0.05);
    folder.add(p, 'alpha', 0, 1.5, 0.01);
    folder.add(p.core, 'heat', 0, 1, 0.01).name('core heat');
    folder.add(p.embers, 'size', 0.02, 0.4, 0.01).name('ember size');
    folder.addColor(p.base, 'color').name('base ring');
  }
  rebuild();
  // loop: a new one as the last one leaves
  const tick = () => {
    if (state.loop && renderer.tornado.live.length === 0) spawn();
    timer = setTimeout(tick, 250);
  };
  let timer = setTimeout(tick, 500);
  return { gui, dispose: () => { clearTimeout(timer); gui.destroy(); } };
}
