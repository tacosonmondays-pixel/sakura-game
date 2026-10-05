// Pause menu: resume, restart, quit and in-battle settings (quality, tile hints, auto-start,
// default speed, reduce motion). Settings persist through store.commit().
import { h, icon } from './util.js';
import { modal } from '../components.js';
import { store } from '../../core/store.js';
import { DIFFICULTIES } from '../../data/types.js';

const QUALITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];

/**
 * Confirmation dialog. (components.confirmDialog resolves false on OK because its close()
 * fires onClose before the OK handler resolves — see docs/INTEGRATION_NOTES.md.)
 * @returns {Promise<boolean>}
 */
export function ask(text, { title = 'Confirm', ok = 'Confirm', cancel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    modal({
      title,
      body: text,
      actions: [
        { label: cancel, kind: 'ghost', testid: 'confirm-cancel', onClick: (c) => { finish(false); c(); } },
        { label: ok, kind: 'primary', testid: 'confirm-ok', onClick: (c) => { finish(true); c(); } },
      ],
      onClose: () => finish(false),
    });
  });
}

export function createPauseMenu(ctx) {
  const el = h('div.bt-overlay.bt-pause-overlay', { 'data-testid': 'pause-menu' });
  el.hidden = true;
  ctx.layer.append(el);

  function settings() {
    return store.profile.settings;
  }

  function save(patch) {
    Object.assign(settings(), patch);
    store.commit('settings');
    render();
  }

  function toggle(label, desc, value, onChange, testid) {
    return h(
      `button.bt-toggle${value ? '.on' : ''}`,
      { 'data-testid': testid, 'aria-pressed': value ? 'true' : 'false', onclick: () => onChange(!value) },
      h('span.bt-toggle-text', h('b', label), desc ? h('small', desc) : null),
      h('span.bt-switch', h('span.bt-knob')),
    );
  }

  function seg(options, value, onPick) {
    return h('div.bt-seg', options.map(([k, name]) => h(`button.bt-seg-btn${String(k) === String(value) ? '.on' : ''}`, { onclick: () => onPick(k) }, name)));
  }

  function render() {
    const s = settings();
    const stage = ctx.stage;
    const diff = DIFFICULTIES[ctx.sim.difficulty];
    el.replaceChildren(h(
      'div.bt-sheet.bt-pause',
      h('div.bt-sheet-title', 'PAUSED'),
      h('div.bt-pause-sub', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — ${diff.name}`),
      h(
        'div.bt-pause-actions',
        h('button.bt-cta', { 'data-testid': 'resume', onclick: () => ctx.closePause() }, icon('play', 'bt-ico-sm'), 'Resume'),
        h('button.bt-btn', { 'data-testid': 'restart', onclick: () => restart() }, icon('refresh', 'bt-ico-sm'), 'Restart'),
        h('button.bt-btn.bt-btn-danger', { 'data-testid': 'quit', onclick: () => quit() }, icon('back', 'bt-ico-sm'), 'Quit'),
      ),
      h('div.bt-sheet-section', 'Settings'),
      h('div.bt-set-row', h('span.bt-set-label', 'Graphics'), seg(QUALITIES, s.quality, (q) => {
        save({ quality: q });
        ctx.renderer.setQuality(q);
      })),
      h('div.bt-set-row', h('span.bt-set-label', 'Default speed'), seg([[1, '1×'], [2, '2×'], [3, '3×']], s.defaultSpeed || 1, (v) => save({ defaultSpeed: Number(v) }))),
      toggle('Placement hints', 'Glow valid tiles while deploying', s.showRanges !== false, (v) => save({ showRanges: v }), 'set-hints'),
      toggle('Auto-start waves', 'Next wave starts by itself', !!ctx.sim.options.autoStart, (v) => {
        ctx.setAutoStart(v);
        render();
      }, 'set-auto'),
      toggle('Reduce motion', 'Less shake and flashing (next battle)', !!s.reduceMotion, (v) => save({ reduceMotion: v }), 'set-motion'),
      h('div.bt-sheet-section', 'Controls'),
      h(
        'ul.bt-help',
        h('li', h('b', 'Deploy: '), 'drag a card onto the map, or tap a card and then a glowing tile.'),
        h('li', h('b', 'Upgrade: '), 'tap a girl. Two paths max; only one may pass tier 2.'),
        h('li', h('b', 'Camera: '), 'drag to pan, pinch or scroll to zoom, double-tap to reset.'),
        h('li', h('b', 'Scout: '), 'tap the NEXT strip at the top to see the coming wave and its traits.'),
      ),
    ));
  }

  async function restart() {
    if (!(await ask('Restart this stage from wave 1? Progress in this battle is lost.', { title: 'Restart', ok: 'Restart' }))) return;
    ctx.restart();
  }

  async function quit() {
    if (!(await ask('Leave the battle? You will not receive rewards for this run.', { title: 'Quit battle', ok: 'Quit' }))) return;
    ctx.quit();
  }

  return {
    el,
    get open() {
      return !el.hidden;
    },
    show() {
      render();
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    destroy() {
      el.remove();
    },
  };
}
