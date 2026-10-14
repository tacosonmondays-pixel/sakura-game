// START WAVE call-to-action (prep / between waves) with the auto-start toggle.
// Co-op freeplay: once the goal wave is cleared it becomes the clear card — "STAGE CLEAR ✓" over a
// violet → pink GO BEYOND ▶ Wave 16/15 (the normal 'wave' command, either player) with a countdown
// ring while Auto is on, and a small "Finish here" pill (this player's Finish vote).
import { h, icon } from './util.js';

export function createWaveControl(ctx) {
  const { sim } = ctx;
  const label = h('span.bt-start-label');
  const sub = h('span.bt-start-sub');
  const ring = h('span.bt-start-ring', { 'aria-hidden': 'true' });
  const start = h('button.bt-start', { 'data-testid': 'start-wave', onclick: () => ctx.startWave() }, ring, icon('play', 'bt-start-ico'), h('span.bt-start-text', label, sub));
  const autoBox = h('span.bt-auto-box');
  const auto = h('button.bt-auto', { 'data-testid': 'auto-start', title: 'Start the next wave automatically', onclick: () => ctx.setAutoStart(!sim.options.autoStart) }, autoBox, 'Auto');
  // freeplay: the clear card's head and the Finish pill (hidden outside the clear)
  const clearHead = h('div.bt-clear-head', { 'data-testid': 'clear-card' }, h('b', 'STAGE CLEAR ✓'), h('small', 'Rewards saved'));
  const finish = h('button.bt-finish-pill', { 'data-testid': 'finish-here', onclick: () => ctx.voteFinish?.(!ctx.myFinishVote?.()) });
  clearHead.hidden = true;
  finish.hidden = true;
  const el = h('div.bt-wavectl', clearHead, start, h('div.bt-wavectl-row', finish, auto));
  ctx.layer.append(el);
  const fp = sim.freeplay ? sim.stage.freeplay : null;
  if (fp) el.dataset.tier = fp.id;
  const lastWave = () => sim.lastWave ?? sim.totalWaves;

  let last = '';
  function update() {
    const canStart = (sim.state === 'prep' || sim.state === 'between') && (sim.endless || sim.wave < lastWave());
    // the goal wave just cleared (freeplay): the clear card
    const atClear = !!fp && sim.state === 'between' && sim.wave === sim.totalWaves;
    const voted = !!ctx.myFinishVote?.();
    const key = `${canStart}|${sim.wave}|${sim.options.autoStart}|${sim.state}|${atClear}|${voted}`;
    if (key !== last) {
      last = key;
      start.hidden = !canStart;
      el.classList.toggle('bt-wavectl-running', !canStart);
      el.classList.toggle('bt-wavectl-clear', atClear);
      start.classList.toggle('bt-beyond', atClear);
      clearHead.hidden = !atClear;
      finish.hidden = !atClear || !ctx.voteFinish;
      finish.classList.toggle('on', voted);
      finish.textContent = voted ? 'Finish ✓ — tap to keep going' : 'Finish here';
      const n = sim.wave + 1;
      const over = !!fp && n > sim.totalWaves;
      label.textContent = sim.state === 'prep' ? 'START' : atClear ? 'GO BEYOND' : 'NEXT WAVE';
      sub.textContent = Number.isFinite(sim.totalWaves) ? `Wave ${n}/${sim.totalWaves}` : `Wave ${n}`;
      sub.classList.toggle('bt-start-sub-over', over);
      auto.classList.toggle('on', !!sim.options.autoStart);
      auto.setAttribute('aria-pressed', sim.options.autoStart ? 'true' : 'false');
      el.hidden = sim.state === 'won' || sim.state === 'lost';
    }
    // Auto on at the clear: a ring counts the pause down (sim._autoTimer, the sim's own clock)
    const counting = atClear && !!sim.options.autoStart && sim._autoTimer > 0;
    ring.hidden = !counting;
    if (counting) ring.style.setProperty('--p', String(Math.max(0, Math.min(1, sim._autoTimer / (fp.clearPause || 8)))));
  }
  update();
  return { el, update, destroy() { el.remove(); } };
}
