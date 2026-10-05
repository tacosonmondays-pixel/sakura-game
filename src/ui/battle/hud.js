// Top HUD: pause, lives, cash, wave counter, next-wave scout strip and speed toggle.
import { h, icon, fmtCoins } from './util.js';
import { createScout } from './scout.js';
import { svgEl } from '../components.js';
import { currencyIcon } from '../../art/icons.js';
import { DIFFICULTIES } from '../../data/types.js';

const SPEED_ICONS = { 1: 'play', 2: 'ff2', 3: 'ff3' };

/**
 * @param {object} ctx battle context (see controller.js)
 * @returns {{ el: HTMLElement, update(): void, destroy(): void }}
 */
export function createHud(ctx) {
  const { sim, stage } = ctx;
  const livesVal = h('span.bt-stat-val', { 'data-testid': 'hud-lives' });
  const cashVal = h('span.bt-stat-val', { 'data-testid': 'hud-cash' });
  const waveVal = h('span.bt-wave-val', { 'data-testid': 'hud-wave' });
  const livesBox = h('div.bt-stat.bt-lives', { title: 'Lives' }, icon('heart', 'bt-stat-ico'), livesVal);
  const cashBox = h('div.bt-stat.bt-cash', { title: 'Battle coins' }, svgEl(currencyIcon('coins'), 'bt-stat-ico'), cashVal);
  const speedBtn = h('button.bt-round.bt-speed', { 'data-testid': 'speed', title: 'Game speed', onclick: () => ctx.cycleSpeed() });
  const pauseBtn = h('button.bt-round.bt-pause', { 'data-testid': 'pause', title: 'Pause', onclick: () => ctx.openPause() }, icon('pause'));
  const scout = createScout(ctx);
  const diff = DIFFICULTIES[sim.difficulty];
  const stageLabel = h(
    'div.bt-stage-label',
    h('span.bt-stage-id', stage.kind === 'campaign' ? stage.id : stage.name),
    h(`span.bt-diff.bt-diff-${sim.difficulty}`, diff.name),
    ctx.req.practice ? h('span.bt-practice', 'Practice') : null,
  );
  const waveBox = h('div.bt-wave', h('span.bt-wave-label', 'WAVE'), waveVal);
  const el = h(
    'header.bt-hud',
    { 'data-testid': 'battle-hud' },
    h('div.bt-hud-left', pauseBtn, h('div.bt-stats', livesBox, cashBox), waveBox),
    h('div.bt-hud-mid', scout.el),
    h('div.bt-hud-right', stageLabel, speedBtn),
  );

  let last = { lives: null, cash: null, wave: null, speed: null, state: null };
  function update() {
    if (sim.lives !== last.lives) {
      if (last.lives != null && sim.lives < last.lives) {
        livesBox.classList.remove('bt-hit');
        void livesBox.offsetWidth;
        livesBox.classList.add('bt-hit');
      }
      livesVal.textContent = String(Math.max(0, sim.lives));
      livesBox.classList.toggle('bt-low', sim.lives <= sim.maxLives * 0.25);
      last.lives = sim.lives;
    }
    const cash = Math.floor(sim.cash);
    if (cash !== last.cash) {
      if (last.cash != null && cash > last.cash) {
        cashBox.classList.remove('bt-gain');
        void cashBox.offsetWidth;
        cashBox.classList.add('bt-gain');
      }
      cashVal.textContent = fmtCoins(cash);
      last.cash = cash;
    }
    if (sim.wave !== last.wave) {
      const total = Number.isFinite(sim.totalWaves) ? sim.totalWaves : '∞';
      waveVal.textContent = `${Math.max(sim.wave, 0)}/${total}`;
      last.wave = sim.wave;
    }
    if (ctx.speed !== last.speed) {
      speedBtn.replaceChildren(icon(SPEED_ICONS[ctx.speed] || 'play'), h('span.bt-speed-x', `${ctx.speed}×`));
      speedBtn.dataset.speed = String(ctx.speed);
      last.speed = ctx.speed;
    }
    if (sim.state !== last.state || sim.wave !== scout.shownFor) scout.refresh();
    last.state = sim.state;
  }

  return {
    el,
    update,
    scout,
    destroy() {
      scout.destroy();
    },
  };
}
