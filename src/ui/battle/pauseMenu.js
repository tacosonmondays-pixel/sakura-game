// Pause menu: resume, restart, quit and in-battle settings (quality, placement range,
// auto-start, default speed, camera locked / free, reduce motion). Settings persist through
// store.commit().
import { h, icon } from './util.js';
import { confirmDialog } from '../components.js';
import { store } from '../../core/store.js';
import { DIFFICULTIES } from '../../data/types.js';

const QUALITIES = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];

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
      h('div.bt-sheet-title', ctx.coop ? 'MENU' : 'PAUSED'),
      ctx.coop ? h('p.bt-pause-sub', 'Co-op battles keep running while this menu is open.') : null,
      h('div.bt-pause-sub', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — ${diff.name}`),
      h(
        'div.bt-pause-actions',
        h('button.bt-cta', { 'data-testid': 'resume', onclick: () => ctx.closePause() }, icon('play', 'bt-ico-sm'), 'Resume'),
        ctx.coop ? null : h('button.bt-btn', { 'data-testid': 'restart', onclick: () => restart() }, icon('refresh', 'bt-ico-sm'), 'Restart'),
        h('button.bt-btn.bt-btn-danger', { 'data-testid': 'quit', onclick: () => quit() }, icon('back', 'bt-ico-sm'), ctx.coop ? 'Leave co-op' : 'Quit'),
      ),
      h('div.bt-sheet-section', 'Settings'),
      h('div.bt-set-row', h('span.bt-set-label', 'Graphics'), seg(QUALITIES, s.quality, (q) => {
        save({ quality: q });
        ctx.renderer.setQuality(q);
      })),
      h('div.bt-set-row', h('span.bt-set-label', 'Default speed'), seg([[1, '1×'], [2, '2×'], [3, '3×']], s.defaultSpeed || 1, (v) => save({ defaultSpeed: Number(v) }))),
      // applies at once: the controller hands every settings change to the renderer
      h('div.bt-set-row', { 'data-testid': 'set-camera' }, h('span.bt-set-label', 'Camera'), seg([['locked', 'Locked'], ['free', 'Free']], s.camera === 'free' ? 'free' : 'locked', (v) => save({ camera: v }))),
      toggle('Placement range', 'Show her attack range while you drag a girl onto the field', s.showRanges !== false, (v) => save({ showRanges: v }), 'set-hints'),
      toggle('Auto-start waves', 'Next wave starts by itself', !!ctx.sim.options.autoStart, (v) => {
        ctx.setAutoStart(v);
        render();
      }, 'set-auto'),
      toggle('Reduce motion', 'Less shake and flashing (next battle)', !!s.reduceMotion, (v) => save({ reduceMotion: v }), 'set-motion'),
      h('div.bt-sheet-section', 'Controls'),
      h(
        'ul.bt-help',
        h('li', h('b', 'Deploy: '), 'drag a card onto the map and let go, or tap a card and then the ground. Red shading marks where she cannot stand.'),
        h('li', h('b', 'Upgrade: '), 'tap a girl. Two paths max; only one may pass tier 2.'),
        h('li', h('b', 'Camera: '), s.camera === 'free'
          ? 'drag to pan, pinch or scroll to zoom, double-tap to reset. It holds still while you place a girl.'
          : 'locked — the whole map stays framed and never moves when you drag. Pick Free above to pan and zoom.'),
        h('li', h('b', 'Scout: '), 'tap the NEXT strip at the top to see the coming wave and its traits.'),
      ),
    ));
  }

  async function restart() {
    if (!(await confirmDialog('Restart this stage from wave 1? Progress in this battle is lost.', { title: 'Restart', ok: 'Restart' }))) return;
    ctx.restart();
  }

  async function quit() {
    const text = ctx.coop ? 'Leave the co-op battle? Your girls stay to help your ally, but you will not receive rewards.' : 'Leave the battle? You will not receive rewards for this run.';
    if (!(await confirmDialog(text, { title: ctx.coop ? 'Leave co-op' : 'Quit battle', ok: ctx.coop ? 'Leave' : 'Quit' }))) return;
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
