// Top HUD: pause, lives, cash, wave counter, next-wave scout strip and speed toggle.
// Co-op freeplay past the goal: the wave counter overflows ("16/15") in the tier's colours with a
// slam on every new wave — the owner's "cool text effect going past like 16/15" (spec §10.3).
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
  /** the freeplay tier's table when this battle goes past its goal (co-op freeplay), else null */
  const fp = sim.freeplay ? sim.stage.freeplay : null;
  const stageLabel = h(
    'div.bt-stage-label',
    h('span.bt-stage-id', stage.kind === 'campaign' ? stage.id : stage.name),
    h(`span.bt-diff.bt-diff-${sim.difficulty}`, diff.name),
    ctx.modes?.chip || null,
    ctx.req.practice ? h('span.bt-practice', 'Practice') : null,
    fp ? h(`span.bt-fp-chip.bt-fp-${fp.id}`, { 'data-testid': 'hud-freeplay' }, `Freeplay · ${fp.name}`) : null,
  );
  // the label reads BEYOND past the goal (OVERTIME after the Matriarch's wave) on wide screens;
  // narrow phones keep WAVE (no room next to lives and coins), the colours carry the meaning
  const labelWide = h('span.bt-wave-label-wide', 'WAVE');
  const waveBox = h('div.bt-wave', { 'data-testid': 'hud-wave-box' }, h('span.bt-wave-label', labelWide, h('span.bt-wave-label-narrow', 'WAVE')), waveVal);
  const el = h(
    'header.bt-hud',
    { 'data-testid': 'battle-hud' },
    h('div.bt-hud-left', pauseBtn, h('div.bt-stats', livesBox, cashBox), waveBox),
    h('div.bt-hud-mid', scout.el),
    h('div.bt-hud-right', ctx.modes?.pill || null, stageLabel, speedBtn),
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
      // recomputed from the state on every change, so a remount (resync) is always right
      const over = !!fp && sim.wave > sim.totalWaves;
      if (over) {
        waveVal.replaceChildren(h('b.bt-wave-n', String(sim.wave)), h('span.bt-wave-goal', `/${total}`));
        const overtime = sim.wave > (fp.finale?.wave ?? Infinity);
        labelWide.textContent = overtime ? 'OVERTIME' : 'BEYOND';
        waveBox.classList.add('bt-wave-over');
        waveBox.classList.toggle('bt-wave-overtime', overtime);
        waveBox.dataset.tier = fp.id;
        if (last.wave != null) {
          // the slam: a fresh animation on every new wave
          waveBox.classList.remove('bt-wave-bump');
          void waveBox.offsetWidth;
          waveBox.classList.add('bt-wave-bump');
        }
      } else {
        waveVal.textContent = `${Math.max(sim.wave, 0)}/${total}`;
        labelWide.textContent = 'WAVE';
        waveBox.classList.remove('bt-wave-over', 'bt-wave-overtime', 'bt-wave-bump');
        delete waveBox.dataset.tier;
      }
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
