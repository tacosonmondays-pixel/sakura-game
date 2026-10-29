// Top HUD: pause, lives, cash, wave counter, next-wave scout strip and speed toggle.
// Co-op freeplay past the goal: the wave counter overflows ("16/15") in the tier's colours with a
// slam on every new wave — the owner's "cool text effect going past like 16/15" (spec §10.3).
// Solo freeplay shows the same counter.
import { TITAN_MAP, tierLabel } from '../../data/titans.js';
import { h, icon } from './util.js';
import { fmtNum } from '../format.js';
import { createScout } from './scout.js';
import { svgEl } from '../components.js';
import { currencyIcon } from '../../art/icons.js';
import { DIFFICULTIES } from '../../data/types.js';
import { extendedPast } from './tryout/adapters.js';

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
  /** the freeplay tier's table when this battle goes past its goal, else null (read live: a solo
   *  run that won its last wave can Keep going into freeplay) */
  // (a Tryout Day Extended Day runs freeplay waves past its 48 but is not freeplay: no chip, no BEYOND counter, §20.8)
  const fpOf = () => (sim.freeplay && !sim.tryout ? sim.stage.freeplay : null);
  const fpChip = h('span.bt-fp-chip', { 'data-testid': 'hud-freeplay' });
  const stageLabel = h(
    'div.bt-stage-label',
    // a Titan Trials battle: the titan's name and her tier (it always plays on Normal rules); a side stage reads "Side"
    // (its whole name clipped at 844×390: the Step 6 visual review), the name in its tooltip
    h(
      'span.bt-stage-id',
      { title: stage.kind === 'side' ? stage.name : null },
      stage.kind === 'campaign' ? stage.id : stage.kind === 'side' ? 'Side' : stage.titan ? TITAN_MAP[stage.titan.id]?.name || stage.name : stage.name,
    ),
    stage.titan
      ? h(`span.bt-diff.bt-diff-${stage.titan.tier === 'mayhem' ? 'nightmare' : stage.titan.tier}`, tierLabel(stage.titan.tier, stage.titan.rank))
      : h(`span.bt-diff.bt-diff-${sim.difficulty}`, diff.name),
    ctx.modes?.chip || null,
    ctx.req.practice ? h('span.bt-practice', 'Practice') : null,
    fpChip,
    ctx.req.sandbox ? h('span.bt-practice.bt-sandbox-tag', 'Sandbox') : null,
  );
  let chipFor = undefined;
  function paintChip() {
    const fp = fpOf();
    if (chipFor === (fp?.id ?? null)) return;
    chipFor = fp?.id ?? null;
    fpChip.hidden = !fp;
    fpChip.className = `bt-fp-chip${fp ? ` bt-fp-${fp.id}` : ''}`;
    fpChip.textContent = fp ? `Freeplay · ${fp.name}` : '';
  }
  paintChip();
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

  let last = { lives: null, cash: null, wave: null, speed: null, state: null, inf: null };
  function update() {
    paintChip();
    // Sandbox with unlimited lives: the heart reads ∞
    const inf = !!ctx.sandbox?.unlimitedLives;
    if (inf !== last.inf) {
      last.inf = inf;
      last.lives = null;
    }
    if (sim.lives !== last.lives) {
      if (last.lives != null && sim.lives < last.lives) {
        livesBox.classList.remove('bt-hit');
        void livesBox.offsetWidth;
        livesBox.classList.add('bt-hit');
      }
      livesVal.textContent = inf ? '∞' : fmtNum(Math.max(0, sim.lives), 'count');
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
      // a balance: exact up to 999,999 so it compares honestly with the prices beside it (rounded down)
      cashVal.textContent = fmtNum(cash, 'money');
      last.cash = cash;
    }
    if (sim.wave !== last.wave) {
      const total = Number.isFinite(sim.totalWaves) ? sim.totalWaves : '∞';
      // recomputed from the state on every change, so a remount (resync) is always right
      const fp = fpOf();
      // Tryout Day's Extended Day past the Full Day's 48 waves: the wave number alone, never "53/48" (§20.8)
      const stayLate = extendedPast(sim);
      const over = !stayLate && !!fp && sim.wave > sim.totalWaves;
      if (stayLate) {
        waveVal.textContent = fmtNum(stayLate.wave, 'count');
        labelWide.textContent = 'WAVE';
        waveBox.classList.remove('bt-wave-over', 'bt-wave-overtime', 'bt-wave-bump');
        delete waveBox.dataset.tier;
      } else if (over) {
        waveVal.replaceChildren(h('b.bt-wave-n', fmtNum(sim.wave, 'count')), h('span.bt-wave-goal', `/${fmtNum(total, 'count')}`));
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
        waveVal.textContent = Number.isFinite(sim.totalWaves) ? fmtNum(Math.max(sim.wave, 0), 'progress', { of: total }) : `${fmtNum(Math.max(sim.wave, 0), 'count')}/∞`;
        labelWide.textContent = 'WAVE';
        waveBox.classList.remove('bt-wave-over', 'bt-wave-overtime', 'bt-wave-bump');
        delete waveBox.dataset.tier;
      }
      last.wave = sim.wave;
    }
    if (ctx.speed !== last.speed) {
      speedBtn.replaceChildren(icon(SPEED_ICONS[ctx.speed] || 'play'), h('span.bt-speed-x', `${fmtNum(ctx.speed, 'count')}×`));
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
