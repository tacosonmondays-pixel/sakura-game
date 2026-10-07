// Settings (owner: meta-a). Graphics (quality, shadows, bloom, lighting sliders, reduced
// motion), audio, battle defaults (forbidden zones, auto start, default speed) and save data
// (export as text, import, reset with confirmation). Every change saves immediately.
import '../styles/meta-a.css';
import { h, clear, screen, button, toast, glyph, applyMotionPreference } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { BATTLE } from '../../data/types.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { DEFAULT_SETTINGS, SAVE_VERSION, deserializeProfile } from '../../systems/save.js';
import { ask } from './stage.js';

function settings() {
  const p = store.profile;
  p.settings ||= structuredClone(DEFAULT_SETTINGS);
  p.settings.lighting ||= { ...DEFAULT_SETTINGS.lighting };
  return p.settings;
}

function save(reason = 'settings') {
  store.commit(reason);
}

export function render(root, params = {}) {
  const { el, body } = screen('Settings', { cls: 'ma-settings-screen' });
  root.appendChild(el);
  const draw = () => {
    clear(body);
    body.appendChild(build(draw));
    if (params.section) {
      const target = body.querySelector(`[data-section="${params.section}"]`);
      if (target) {
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: store.profile.settings?.reduceMotion ? 'auto' : 'smooth' }));
        target.classList.add('ma-pop');
      }
    }
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => {
    off();
    stopFullscreenWatch?.();
    stopFullscreenWatch = null;
  };
}

function build(redraw) {
  const s = settings();
  const wrap = h('div.ma-wrap.ma-settings');

  wrap.appendChild(displaySection());

  wrap.appendChild(h('section.panel', { 'data-section': 'graphics' },
    h('h3.panel-title', 'Graphics'),
    row('Quality', 'High: shadows, bloom and outlines. Medium: lighter models. Low: best for older phones.',
      segmented(['high', 'medium', 'low'], s.quality, (v) => { s.quality = v; save(); redraw(); }, { high: 'High', medium: 'Medium', low: 'Low' }, 'quality')),
    row('Shadows', s.quality === 'high' ? 'Soft shadows under girls, enemies and props.' : 'Only on High quality.', toggle(s.shadows, (v) => { s.shadows = v; save(); }, 'shadows', s.quality !== 'high')),
    row('Bloom', s.quality === 'high' ? 'Glow on halos, spells and explosions.' : 'Only on High quality.', toggle(s.bloom, (v) => { s.bloom = v; save(); }, 'bloom', s.quality !== 'high')),
    row('Reduce motion', 'Tones down screen shake, flashes, transitions and reveal animations.', toggle(!!s.reduceMotion, (v) => { s.reduceMotion = v; save(); applyMotionPreference(); }, 'reduceMotion')),
  ));

  const preview = h('div.ma-light-preview', { html: themeBackdropSVG('sakura'), title: 'Preview' });
  const paintPreview = () => {
    const ex = s.lighting.exposure;
    const w = s.lighting.warmth;
    preview.style.filter = `brightness(${ex}) sepia(${Math.max(0, w) * 0.35}) hue-rotate(${w < 0 ? w * 25 : 0}deg) saturate(${1 + Math.abs(w) * 0.2})`;
  };
  paintPreview();
  wrap.appendChild(h('section.panel',
    h('h3.panel-title', 'Lighting'),
    h('div.ma-light-wrap',
      h('div.ma-light-controls',
        row('Exposure', 'Overall brightness of the battlefield.', slider(s.lighting.exposure, 0.6, 1.6, 0.05, (v) => { s.lighting.exposure = v; paintPreview(); }, () => save(), (v) => `${Math.round(v * 100)}%`, 'exposure')),
        row('Warmth', 'Cool moonlight ↔ warm sunset.', slider(s.lighting.warmth, -1, 1, 0.05, (v) => { s.lighting.warmth = v; paintPreview(); }, () => save(), (v) => (v === 0 ? 'Neutral' : v > 0 ? `Warm ${Math.round(v * 100)}` : `Cool ${Math.round(-v * 100)}`), 'warmth')),
        h('div.ma-row-actions', button('Reset lighting', { kind: 'ghost', small: true, icon: 'refresh', onClick: () => { s.lighting = { ...DEFAULT_SETTINGS.lighting }; save(); redraw(); } })),
      ),
      preview,
    ),
  ));

  wrap.appendChild(h('section.panel',
    h('h3.panel-title', 'Audio'),
    row('Music', 'Background music.', toggle(s.music, (v) => { s.music = v; save(); }, 'music')),
    row('Sound effects', 'Attacks, hits and UI sounds.', toggle(s.sfx, (v) => { s.sfx = v; save(); }, 'sfx')),
    row('Volume', 'Master volume.', slider(s.volume ?? 0.8, 0, 1, 0.05, (v) => { s.volume = v; }, () => save(), (v) => `${Math.round(v * 100)}%`, 'volume')),
  ));

  wrap.appendChild(h('section.panel',
    h('h3.panel-title', 'Battle'),
    row('Show forbidden zones', 'While you place a girl, the spots where she cannot stand (road, obstacles, wrong terrain, other girls) are shaded red.', toggle(s.showRanges, (v) => { s.showRanges = v; save(); }, 'showRanges')),
    row('Auto start waves', 'Next wave starts automatically after a short pause.', toggle(s.autoStart, (v) => { s.autoStart = v; save(); }, 'autoStart')),
    row('Default speed', 'Game speed when a battle starts.', segmented(BATTLE.speeds.map(String), String(s.defaultSpeed || 1), (v) => { s.defaultSpeed = Number(v); save(); redraw(); }, Object.fromEntries(BATTLE.speeds.map((x) => [String(x), `${x}×`])), 'speed')),
  ));

  wrap.appendChild(saveSection(redraw));
  wrap.appendChild(h('p.muted.ma-version', `Sakura Sentinels · save v${SAVE_VERSION} · ${formatNumber(store.profile.stats?.battles || 0)} battles fought`));
  return wrap;
}

function row(label, desc, control) {
  return h('div.ma-set-row', h('div.ma-set-text', h('div.ma-set-label', label), desc ? h('div.ma-set-desc', desc) : null), h('div.ma-set-control', control));
}

/** Removes the fullscreen listener of the Display section currently on screen. */
let stopFullscreenWatch = null;

/** Display: fullscreen toggle, landscape lock, rotate reminder, home-screen install hint. */
function displaySection() {
  const fsBtn = button('Fullscreen', { kind: 'primary', small: true, icon: 'fullscreen', testid: 'set-fullscreen' });
  const fsDesc = h('div.ma-set-desc', 'Hides the browser bars and locks landscape where the device allows it.');
  let orientation = null;
  const paint = () => {
    const on = orientation?.isFullscreen() || false;
    fsBtn.querySelector('.btn-label').textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    fsBtn.querySelector('.btn-icon').innerHTML = glyph(on ? 'exitFullscreen' : 'fullscreen');
  };
  // one listener per screen: a rebuilt section (or leaving Settings) drops the previous one
  stopFullscreenWatch?.();
  let live = true;
  stopFullscreenWatch = () => {
    live = false;
    document.removeEventListener('fullscreenchange', paint);
  };
  import('../orientation.js').then((o) => {
    if (!live) return;
    orientation = o;
    if (!o.canFullscreen()) {
      fsBtn.disabled = true;
      fsDesc.textContent = o.isStandalone() ? 'Installed as an app — already fullscreen.' : 'Not available in this browser. On iPhone use Share → Add to Home Screen.';
    }
    paint();
    document.addEventListener('fullscreenchange', paint);
  }).catch(() => {});
  fsBtn.addEventListener('click', async () => {
    if (!orientation) return;
    await orientation.toggleFullscreen();
    paint();
    toast(orientation.isFullscreen() ? 'Fullscreen on — landscape locked when supported' : 'Fullscreen off', 'info');
  });
  const rotate = button('Show again', {
    kind: 'ghost', small: true, icon: 'rotate', testid: 'set-rotate',
    onClick: async () => {
      try {
        const o = await import('../orientation.js');
        o.setDismissed(false);
        toast('The rotate reminder will show again in portrait', 'good');
      } catch {
        toast('Could not reset the reminder', 'bad');
      }
    },
  });
  return h('section.panel', { 'data-section': 'display' },
    h('h3.panel-title', 'Display'),
    h('div.ma-set-row', h('div.ma-set-text', h('div.ma-set-label', 'Fullscreen'), fsDesc), h('div.ma-set-control', fsBtn)),
    row('Landscape mode', 'Sakura Sentinels is designed for phones held sideways. On phones and tablets a reminder appears in portrait; dismiss it to keep playing in portrait.', rotate),
    row('Install', 'Add the game to your home screen for an app-like, full-screen launch (Android: browser menu → Install app; iPhone: Share → Add to Home Screen).', null),
  );
}

function toggle(value, onChange, id, disabled = false) {
  const b = h(`button.ma-toggle${value ? '.on' : ''}`, {
    role: 'switch',
    'aria-checked': value ? 'true' : 'false',
    disabled,
    'data-testid': `set-${id}`,
    onclick: () => {
      const next = !b.classList.contains('on');
      b.classList.toggle('on', next);
      b.setAttribute('aria-checked', next ? 'true' : 'false');
      onChange(next);
    },
  }, h('span.ma-toggle-knob'));
  return b;
}

function segmented(values, current, onChange, labels, id) {
  return h('div.ma-seg', { role: 'radiogroup', 'data-testid': `set-${id}` }, values.map((v) => h(`button.ma-seg-btn${v === current ? '.active' : ''}`, { role: 'radio', 'aria-checked': v === current ? 'true' : 'false', onclick: () => onChange(v) }, labels[v] || v)));
}

function slider(value, min, max, step, onInput, onCommit, fmt, id) {
  const out = h('span.ma-slider-val', fmt(value));
  const input = h('input.ma-slider', { type: 'range', min, max, step, value, 'data-testid': `set-${id}` });
  input.value = String(value);
  const paint = () => {
    const pct = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  };
  paint();
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    paint();
    onInput(v);
  });
  input.addEventListener('change', () => onCommit());
  return h('div.ma-slider-wrap', input, out);
}

function saveSection(redraw) {
  const exportBox = h('textarea.ma-textarea', { readonly: true, rows: 3, 'data-testid': 'export-text', placeholder: 'Tap “Export” to generate your save code.' });
  const importBox = h('textarea.ma-textarea', { rows: 3, 'data-testid': 'import-text', placeholder: 'Paste a save code here…', spellcheck: false });
  const status = h('div.ma-code-status');

  const doExport = async () => {
    store.saveNow();
    const text = store.exportSave();
    exportBox.value = text;
    exportBox.focus();
    exportBox.select();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
    }
    toast(copied ? 'Save code copied to the clipboard' : 'Save code ready — select and copy it', copied ? 'good' : 'info');
  };

  const doImport = async () => {
    const text = importBox.value.trim();
    status.className = 'ma-code-status';
    if (!text) {
      status.classList.add('bad');
      status.textContent = 'Paste a save code first.';
      return;
    }
    let preview;
    try {
      preview = deserializeProfile(text);
    } catch (e) {
      status.classList.add('bad');
      status.textContent = e?.message === 'Newer save'
        ? 'That save code comes from a newer version of Sakura Sentinels — update the game to import it.'
        : 'That is not a valid Sakura Sentinels save code.';
      return;
    }
    const units = Object.keys(preview.units || {}).length;
    const cleared = Object.values(preview.progress?.stages || {}).filter((e) => e && (e.easy || e.normal || e.hard || e.nightmare)).length;
    const ok = await ask(h('div',
      h('p', 'Replace your current progress with this save?'),
      h('ul.ma-import-summary',
        h('li', `${units} students`),
        h('li', `${cleared} stages cleared`),
        h('li', `${formatNumber(preview.currencies?.gems || 0)} gems · ${formatNumber(preview.currencies?.coins || 0)} coins`),
      ),
      h('p.muted', 'Tip: export your current save first if you might want it back.'),
    ), { title: 'Import save', ok: 'Import' });
    if (!ok) return;
    try {
      store.importSave(text);
      toast('Save imported', 'good');
      importBox.value = '';
      redraw();
    } catch {
      status.classList.add('bad');
      status.textContent = 'Import failed — the save code is damaged.';
    }
  };

  const doReset = async () => {
    const first = await ask('This erases every student, item, medal and setting on this device. It cannot be undone.', { title: 'Reset all progress?', ok: 'Continue', danger: true });
    if (!first) return;
    const input = h('input.ma-input', { placeholder: 'RESET', 'data-testid': 'reset-confirm-input' });
    const second = await ask(h('div', h('p', 'Type ', h('b', 'RESET'), ' to confirm.'), input), { title: 'Are you sure?', ok: 'Erase everything', danger: true });
    if (!second) return;
    if (input.value.trim().toUpperCase() !== 'RESET') {
      toast('Reset cancelled — the confirmation word did not match', 'bad');
      return;
    }
    store.reset();
    toast('Progress reset. Welcome to Sakura Academy!', 'good');
    navigate('lobby');
  };

  return h('section.panel', { 'data-section': 'save' },
    h('h3.panel-title', 'Save data'),
    h('p.muted', 'Your progress is saved on this device automatically. Export a save code to back it up or move it to another device.'),
    h('div.ma-save-block',
      h('div.ma-set-label', 'Export'),
      exportBox,
      h('div.ma-row-actions', button('Export & copy', { kind: 'primary', small: true, icon: 'upgrade', testid: 'export', onClick: doExport })),
    ),
    h('div.ma-save-block',
      h('div.ma-set-label', 'Import'),
      importBox,
      status,
      h('div.ma-row-actions', button('Import', { kind: 'yellow', small: true, icon: 'backpack', testid: 'import', onClick: doImport })),
    ),
    h('div.ma-save-block.danger',
      h('div', h('div.ma-set-label', 'Reset progress'), h('div.ma-set-desc', 'Start over from the very beginning.')),
      button('Reset…', { kind: 'danger', small: true, icon: 'close', testid: 'reset', onClick: doReset }),
    ),
    h('div.ma-save-block',
      h('div', h('div.ma-set-label', 'Help'), h('div.ma-set-desc', 'Controls, mechanics and tips live in the built-in wiki.')),
      button('Open wiki', { kind: 'ghost', small: true, icon: 'wiki', onClick: () => navigate('wiki') }),
    ),
  );
}
