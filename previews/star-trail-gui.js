// The star trail lab's panel (lil-gui, a dev dependency; previews only, never in src). previews/star-trail.js loads
// it with a dynamic import and runs on its keyboard keys when it cannot.
import GUI from 'lil-gui';

export function mountGui(lab, { presets, tiers, viewports }) {
  const s = lab.state;
  const gui = new GUI({ title: 'Star trail lab' });
  gui.domElement.style.zIndex = 30;
  gui.add(s, 'preset', presets).onChange(lab.apply);
  gui.add(s, 'tier', tiers).onChange(lab.apply);
  gui.add(s, 'rm').name('Reduce Motion').onChange(lab.apply);
  gui.add(s, 'viewport', viewports).onChange(lab.apply);
  gui.add(s, 'accent').name('her accent tint').onChange(lab.apply);
  gui.add(s, 'speed', 0.1, 2, 0.05);
  gui.add(s, 'loop');
  gui.add(s, 'cycle').name('cycle all combos');
  gui.add(s, 'pause');
  gui.add({ replay: lab.replay }, 'replay').name('Replay');
  gui.add({ land: lab.land }, 'land').name('Land now (a tap)');
  return gui;
}
