// START WAVE call-to-action (prep / between waves) with the auto-start toggle.
import { h, icon } from './util.js';

export function createWaveControl(ctx) {
  const { sim } = ctx;
  const label = h('span.bt-start-label');
  const sub = h('span.bt-start-sub');
  const start = h('button.bt-start', { 'data-testid': 'start-wave', onclick: () => ctx.startWave() }, icon('play', 'bt-start-ico'), h('span.bt-start-text', label, sub));
  const autoBox = h('span.bt-auto-box');
  const auto = h('button.bt-auto', { 'data-testid': 'auto-start', title: 'Start the next wave automatically', onclick: () => ctx.setAutoStart(!sim.options.autoStart) }, autoBox, 'Auto');
  const el = h('div.bt-wavectl', start, auto);
  ctx.layer.append(el);

  let last = '';
  function update() {
    const canStart = (sim.state === 'prep' || sim.state === 'between') && (sim.endless || sim.wave < sim.totalWaves);
    const key = `${canStart}|${sim.wave}|${sim.options.autoStart}|${sim.state}`;
    if (key === last) return;
    last = key;
    start.hidden = !canStart;
    el.classList.toggle('bt-wavectl-running', !canStart);
    const n = sim.wave + 1;
    label.textContent = sim.state === 'prep' ? 'START' : 'NEXT WAVE';
    sub.textContent = Number.isFinite(sim.totalWaves) ? `Wave ${n}/${sim.totalWaves}` : `Wave ${n}`;
    auto.classList.toggle('on', !!sim.options.autoStart);
    auto.setAttribute('aria-pressed', sim.options.autoStart ? 'true' : 'false');
    el.hidden = sim.state === 'won' || sim.state === 'lost';
  }
  update();
  return { el, update, destroy() { el.remove(); } };
}
