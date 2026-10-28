// Settings (owner: meta-a). Graphics (quality, shadows, bloom, lighting sliders, reduced
// motion, the loading screen's look), audio, battle defaults (placement range, auto start, default
// speed, camera locked / free) and save data
// (export as text, import, reset with confirmation). Every change saves immediately.
// [ui-m5] UI M5c: a left rail of five sections (Display · Audio · Battle · Account · About) over the same panels, and
// each row's description behind "i" (settingsView / wrapSettings at the end; ../settingsSections.js maps the panels).
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, screen, button, toast, glyph, applyMotionPreference } from '../components.js';
import { listScreen } from '../listScreen.js';
import { plateHead, iconBtn } from '../kit.js';
import { openSheet } from '../sheet.js';
import { SETTINGS_SECTIONS, SECTION_IDS, panelKey, assignSections, sectionForParam } from '../settingsSections.js';
import { rememberParams } from '../router.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { BATTLE } from '../../data/types.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { DEFAULT_SETTINGS, SAVE_VERSION, deserializeProfile } from '../../systems/save.js';
import { ask } from './stage.js';
import { onlineSection } from '../online/settingsOnline.js';
import { cue } from '../../audio/cue.js'; // [audio]
import { buildLine } from '../../core/buildInfo.js';
import { checkForUpdate, reloadFresh, updateCheckFailed } from '../../core/updates.js';
import { applyLoadingLook, loadingLookOf } from '../loading/mochi.js';
import { miniMochi } from '../loading/loader.js';

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
  // [ui-m5] the five-section rail (../settingsSections.js) wraps the panels build() makes; build() and every section
  // builder below are unchanged (wrapSettings, at the end of this file)
  const view = settingsView(params);
  const { body } = view;
  root.appendChild(view.el);
  let first = true;
  const draw = () => {
    clear(body);
    body.appendChild(build(draw));
    view.wrap(); // [ui-m5]
    if (params.section && first) {
      const target = body.querySelector(`[data-section="${params.section}"]`) || body.querySelector(`[data-rail="${view.sectionFor(params.section)}"]`);
      if (target) {
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: store.profile.settings?.reduceMotion ? 'auto' : 'smooth' }));
        target.classList.add('ma-pop');
      }
    }
    first = false;
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => {
    off();
    view.cleanup();
    stopFullscreenWatch?.();
    stopFullscreenWatch = null;
  };
}

function build(redraw) {
  const s = settings();
  const wrap = h('div.ma-wrap.ma-settings');

  wrap.appendChild(displaySection(s, redraw));

  wrap.appendChild(h('section.panel', { 'data-section': 'graphics' },
    h('h3.panel-title', 'Graphics'),
    row('Quality', 'High: shadows, bloom and outlines. Medium: lighter models. Low: best for older phones.',
      segmented(['high', 'medium', 'low'], s.quality, (v) => { s.quality = v; save(); redraw(); }, { high: 'High', medium: 'Medium', low: 'Low' }, 'quality')),
    row('Shadows', s.quality === 'high' ? 'Soft shadows under girls, enemies and props.' : 'Only on High quality.', toggle(s.shadows, (v) => { s.shadows = v; save(); }, 'shadows', s.quality !== 'high')),
    row('Bloom', s.quality === 'high' ? 'Glow on halos, spells and explosions.' : 'Only on High quality.', toggle(s.bloom, (v) => { s.bloom = v; save(); }, 'bloom', s.quality !== 'high')),
    row('Reduce motion', 'Tones down screen shake, flashes, transitions and reveal animations.', toggle(!!s.reduceMotion, (v) => { s.reduceMotion = v; save(); applyMotionPreference(); }, 'reduceMotion')),
    loadingLookRow(s, redraw),
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
    row('Music volume', null, slider(s.musicVolume ?? 0.7, 0, 1, 0.05, (v) => { s.musicVolume = v; cue('settings.audio'); }, () => save(), (v) => `${Math.round(v * 100)}%`, 'musicVolume')), // [audio]
    row('Sound effects', 'Attacks, hits and UI sounds.', toggle(s.sfx, (v) => { s.sfx = v; save(); }, 'sfx')),
    row('Sound effects volume', null, slider(s.sfxVolume ?? 0.8, 0, 1, 0.05, (v) => { s.sfxVolume = v; cue('settings.audio'); }, () => { save(); cue('sfx.preview'); }, (v) => `${Math.round(v * 100)}%`, 'sfxVolume')), // [audio]
    row('Master volume', 'Everything at once.', slider(s.volume ?? 0.8, 0, 1, 0.05, (v) => { s.volume = v; cue('settings.audio'); }, () => save(), (v) => `${Math.round(v * 100)}%`, 'volume')),
    row('Sound test', 'Every track and sound effect.', button('Open', { kind: 'ghost', small: true, icon: 'play', onClick: () => navigate('soundtest'), testid: 'set-soundtest' })), // [audio]
  ));

  wrap.appendChild(h('section.panel',
    h('h3.panel-title', 'Battle'),
    row('Show range while placing', 'While you drag a girl onto the field, her attack range is shown around her. The small circle under her stays white where she can stand and turns red where she can’t.', toggle(s.showRanges, (v) => { s.showRanges = v; save(); }, 'showRanges')),
    row('Auto start waves', 'Next wave starts automatically after a short pause.', toggle(s.autoStart, (v) => { s.autoStart = v; save(); }, 'autoStart')),
    row('Default speed', 'Game speed when a battle starts.', segmented(BATTLE.speeds.map(String), String(s.defaultSpeed || 1), (v) => { s.defaultSpeed = Number(v); save(); redraw(); }, Object.fromEntries(BATTLE.speeds.map((x) => [String(x), `${x}×`])), 'speed')),
    row('Camera', s.camera === 'free'
      ? 'Free: drag empty ground to pan, pinch or scroll to zoom, double-tap to reset. The map still holds still while you place a girl.'
      : 'Locked: the whole map stays framed and never moves when you drag, so placing a girl can’t nudge it. Choose Free to pan and zoom.',
    segmented(['locked', 'free'], s.camera === 'free' ? 'free' : 'locked', (v) => { s.camera = v; save(); redraw(); }, { locked: 'Locked', free: 'Free' }, 'camera')),
    row('Buff icons', 'Small icons over buffed girls; their rim colour shows who gives the buff.',
      segmented(['all', 'selected', 'off'], ['selected', 'off'].includes(s.buffIcons) ? s.buffIcons : 'all', (v) => { s.buffIcons = v; save(); redraw(); }, { all: 'All', selected: 'Selected', off: 'Off' }, 'buffIcons')),
  ));

  wrap.appendChild(onlineSection({ redraw, importText: importSaveText })); // [online] name, status, transfer codes
  wrap.appendChild(saveSection(redraw));
  wrap.appendChild(versionSection());
  wrap.appendChild(h('p.muted.ma-version', `Sakura Sentinels · save v${SAVE_VERSION} · ${formatNumber(store.profile.stats?.battles || 0)} battles fought`));
  return wrap;
}

/**
 * The loading screen's look (owner: "try both!! We'll pick the loading screen after"): the slime
 * Mint / Pink and the background Black / Colour, with a small live preview. The look sits on <html>
 * (src/ui/loading/mochi.js applyLoadingLook), so every loader follows at once; index.html reads the
 * saved choice before the first paint.
 */
function loadingLookRow(s, redraw) {
  const look = loadingLookOf(s);
  const pick = (key) => (v) => {
    s[key] = v;
    save();
    applyLoadingLook(s);
    redraw();
  };
  const preview = h('div.ma-ld-preview', { 'aria-hidden': 'true', 'data-testid': 'set-loading-preview' }, miniMochi({ dark: true, size: 24 }));
  return row('Loading screen', 'The little slime in the corner and the screen behind it.',
    h('div.ma-ld-look',
      preview,
      named(segmented(['mint', 'sakura'], look.mochi, pick('loadingMochi'), { mint: 'Mint', sakura: 'Pink' }, 'loadingMochi'), 'Slime colour'),
      named(segmented(['black', 'colour'], look.bg, pick('loadingBg'), { black: 'Black', colour: 'Colour' }, 'loadingBg'), 'Background')));
}

function named(el, label) {
  el.setAttribute('aria-label', label);
  return el;
}

function row(label, desc, control) {
  return h('div.ma-set-row', h('div.ma-set-text', h('div.ma-set-label', label), desc ? h('div.ma-set-desc', desc) : null), h('div.ma-set-control', control));
}

/** Removes the fullscreen listener of the Display section currently on screen. */
let stopFullscreenWatch = null;

/** Display: fullscreen toggle, landscape lock, rotate reminder, home-screen install hint, the girl page's look. */
function displaySection(s, redraw) {
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
    // the girl page's look (src/ui/girlDetail.js); an open girl page re-renders on the change
    row('Girl page', s.girlPage === 'detailed' ? 'Detailed: every stat, gear value, substat and bonus on her page.' : 'Compact: three headline stats; the rest one tap away under MORE.',
      segmented(['compact', 'detailed'], s.girlPage === 'detailed' ? 'detailed' : 'compact', (v) => { s.girlPage = v; save(); redraw(); }, { compact: 'Compact', detailed: 'Detailed' }, 'girlPage')),
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
    if (await importSaveText(importBox.value.trim(), status, redraw)) importBox.value = '';
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

/**
 * Previews a save code, asks for confirmation and replaces the local save (Settings → Import,
 * and Settings → Online → Redeem transfer code). Resolves true when the save was imported.
 * @param {string} text
 * @param {HTMLElement} status error line
 * @param {() => void} redraw
 */
export async function importSaveText(text, status, redraw) {
  status.className = 'ma-code-status';
  if (!text) {
    status.classList.add('bad');
    status.textContent = 'Paste a save code first.';
    return false;
  }
  let preview;
  try {
    preview = deserializeProfile(text);
  } catch (e) {
    status.classList.add('bad');
    status.textContent = e?.message === 'Newer save'
      ? 'That save code comes from a newer version of Sakura Sentinels — update the game to import it.'
      : 'That is not a valid Sakura Sentinels save code.';
    return false;
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
  if (!ok) return false;
  try {
    store.importSave(text);
    toast('Save imported', 'good');
    redraw();
    return true;
  } catch {
    status.classList.add('bad');
    status.textContent = 'Import failed — the save code is damaged.';
    return false;
  }
}

/** Which version is running + "Check for updates" (co-op needs both players on compatible ones). */
function versionSection() {
  const status = h('div.ma-set-desc', { 'data-testid': 'update-status' }, 'Co-op partners need the same version. The game also checks for new versions by itself.');
  const control = h('div.ma-set-control');
  const checkBtn = button('Check for updates', {
    kind: 'ghost', small: true, icon: 'refresh', testid: 'check-updates',
    onClick: async () => {
      status.textContent = 'Checking…';
      const info = await checkForUpdate({ force: true });
      if (info) {
        status.textContent = `A new version${info.version ? ` (v${info.version})` : ''} is ready.`;
        control.replaceChildren(button('Update now', { kind: 'yellow', small: true, icon: 'refresh', testid: 'update-now-settings', onClick: () => reloadFresh(info.build) }));
      } else if (updateCheckFailed()) {
        status.textContent = 'Couldn\'t check for updates — are you online? Try again in a moment.';
      } else {
        status.textContent = 'You have the newest version.';
      }
    },
  });
  control.append(checkBtn);
  return h('section.panel', { 'data-section': 'about' },
    h('h3.panel-title', 'About'),
    h('div.ma-set-row',
      h('div.ma-set-text', h('div.ma-set-label', { 'data-testid': 'settings-version' }, buildLine()), status),
      control),
    licencesRow());
}

/** [ui-ink] The menus' line icons are adapted from two open icon sets: their licence texts (public/licenses/), on a tap. */
export const LICENCE_FILES = Object.freeze([
  { file: 'lucide-ISC.txt', title: 'Lucide (ISC)' },
  { file: 'feather-MIT.txt', title: 'Feather (MIT)' },
]);
function licencesRow() {
  const open = async () => {
    const base = `${import.meta.env?.BASE_URL ?? './'}licenses/`;
    const body = h('div.st-licences', { 'data-testid': 'licences-text' }, h('p.muted', 'Loading…'));
    openSheet({ title: 'Licences', body, full: true, testid: 'licences-sheet' });
    const parts = await Promise.all(LICENCE_FILES.map(async (l) => {
      try {
        const r = await fetch(`${base}${l.file}`, { cache: 'force-cache' });
        return { ...l, text: r.ok ? await r.text() : `(${l.file} could not be loaded)` };
      } catch {
        return { ...l, text: `(${l.file} could not be loaded: are you online?)` };
      }
    }));
    body.replaceChildren(...parts.flatMap((p) => [h('h4', p.title), h('pre.st-licence', p.text)]));
  };
  return h('div.ma-set-row',
    h('div.ma-set-text', h('div.ma-set-label', { 'data-testid': 'settings-icons-credit' }, 'Line icons adapted from Lucide (ISC) and Feather (MIT)')),
    h('div.ma-set-control', button('Licences', { kind: 'ghost', small: true, testid: 'settings-licences', onClick: open })));
}

// ---------------------------------------------------------------------------
// [ui-m5] UI M5c: the section rail and the "i" descriptions (docs/specs/UI_DIRECTION.md P1, §5.10 E3; notes Q8)
// ---------------------------------------------------------------------------

/**
 * The Settings screen's frame: the left rail of five sections (no host: Settings is not on the E1 list) beside one
 * scrolling column. A tab scrolls its section to the top; scrolling moves the lit tab. Every panel stays on the page,
 * so a deep link (?section=graphics), a test that waits for a row, or a row another branch adds all work as before.
 */
function settingsView(params) {
  let active = sectionForParam(params.section);
  const ls = listScreen({
    title: 'Settings', cls: 'ma-settings-screen st-screen', location: null, host: null, panel: false, railLabel: 'Settings sections',
    sections: SETTINGS_SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon === 'account' ? glyph('account') : s.icon })),
    active,
    onPick: (id) => jump(id),
  });
  const scroller = ls.list;
  const reduce = () => !!store.profile.settings?.reduceMotion;
  let locked = false;
  let unlock = null;
  const groups = () => [...scroller.querySelectorAll('.st-group')];
  const light = (id) => {
    if (id === active) return;
    active = id;
    ls.rail.setActive(id);
  };
  function jump(id) {
    const g = scroller.querySelector(`.st-group[data-rail="${id}"]`);
    light(id);
    rememberParams('settings', { section: id });
    if (!g) return;
    // (a smooth scroll passes other sections: they never light up on the way)
    locked = true;
    clearTimeout(unlock);
    unlock = setTimeout(() => { locked = false; }, reduce() ? 80 : 700);
    scroller.scrollTo({ top: g.offsetTop, behavior: reduce() ? 'auto' : 'smooth' });
  }
  // the lit tab follows the scroll: the last section whose top has passed the top of the column (the end: the last)
  const spy = () => {
    if (locked) return;
    const gs = groups();
    if (!gs.length) return;
    const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    let cur = gs[0];
    for (const g of gs) if (g.offsetTop <= scroller.scrollTop + 48) cur = g;
    light((atEnd ? gs[gs.length - 1] : cur).dataset.rail);
  };
  scroller.addEventListener('scroll', spy, { passive: true });
  // the last section is at least one column tall, so its tab can bring it to the top
  const fitLast = () => {
    const gs = groups();
    gs.forEach((g, i) => { g.style.minHeight = i === gs.length - 1 ? `${scroller.clientHeight}px` : ''; });
  };
  const onResize = () => fitLast();
  globalThis.addEventListener?.('resize', onResize);
  return {
    el: ls.el,
    body: scroller,
    sectionFor: sectionForParam,
    /** Wraps the freshly built panels into their sections (after every build). */
    wrap() {
      const wrapEl = scroller.querySelector('.ma-settings');
      if (wrapEl) wrapSettings(wrapEl);
      requestAnimationFrame(() => {
        fitLast();
        spy();
      });
    },
    cleanup() {
      clearTimeout(unlock);
      scroller.removeEventListener('scroll', spy);
      globalThis.removeEventListener?.('resize', onResize);
      ls.cleanup();
    },
  };
}

/**
 * Groups the panels of build() under the five sections (each opens on its ink plate header, E2) and puts each row's
 * description behind an "i" (P1: rule text is never printed in full on a Glance surface). A description stays in view
 * where it is the reason a control is off ("Only on High quality.") or a live status line (it has a test id); rows a
 * panel fills later (the social rows, once online) keep theirs. A row without a control (Install; "Who can message
 * me" while offline) keeps its description in view as well: there it is the whole row. A panel title that only
 * repeats its section's word goes (Display, Audio, Battle, About).
 */
function wrapSettings(wrapEl) {
  const kids = [...wrapEl.children];
  const panels = kids.filter((c) => c.matches('section.panel'));
  const keys = panels.map((p) => panelKey({ section: p.dataset.section || null, title: p.querySelector(':scope > .panel-title')?.textContent || '' }));
  const ids = assignSections(keys);
  const sectionOf = new Map(panels.map((p, i) => [p, ids[i]]));
  const groups = new Map(SETTINGS_SECTIONS.map((s) => [s.id, h('section.st-group', { 'data-rail': s.id, 'data-testid': `settings-${s.id}`, 'aria-label': s.label }, plateHead(s.label))]));
  let cur = SECTION_IDS[0];
  for (const c of kids) {
    if (sectionOf.has(c)) cur = sectionOf.get(c);
    const g = groups.get(cur);
    const title = c.matches('section.panel') ? c.querySelector(':scope > .panel-title') : null;
    if (title && title.textContent.trim().toLowerCase() === g.getAttribute('aria-label').toLowerCase()) title.classList.add('st-same');
    g.append(c);
  }
  wrapEl.replaceChildren(...[...groups.values()].filter((g) => g.childElementCount > 1));
  for (const desc of wrapEl.querySelectorAll('.ma-set-desc')) infoRow(desc);
  // rows a panel fills later (Account's social rows, once online) get their "i" as they arrive
  for (const box of wrapEl.querySelectorAll('.sc-settings')) {
    new MutationObserver(() => { for (const desc of box.querySelectorAll('.ma-set-desc')) infoRow(desc); }).observe(box, { childList: true, subtree: true });
  }
}

/**
 * One description behind "i" (see wrapSettings): a row's (.ma-set-row) or a save block's (.ma-save-block) line under
 * its label. The "i" sits after the label and opens the line in place.
 */
function infoRow(desc) {
  if (desc.dataset.stI) return;
  desc.dataset.stI = '1';
  const label = desc.parentElement?.querySelector(':scope > .ma-set-label');
  const row = desc.closest('.ma-set-row, .ma-save-block');
  if (!label || !row || !desc.textContent.trim()) return;
  // always in view: a live status (a test id), the reason a control is off, or a settings row with no control at all
  // (its description is the row). A save block's button sits straight in the block, so the last test is rows only.
  const noControl = row.matches('.ma-set-row') && !row.querySelector(':scope > .ma-set-control > *');
  if (desc.dataset.testid || row.querySelector(':disabled') || noControl) {
    desc.classList.add('st-why');
    return;
  }
  row.classList.add('st-has-i');
  desc.classList.add('st-desc');
  const i = iconBtn('info', {
    label: `About ${label.textContent.trim()}`, cls: 'st-i',
    onClick: () => {
      const open = row.classList.toggle('st-open');
      i.setAttribute('aria-expanded', open ? 'true' : 'false');
    },
  });
  i.setAttribute('aria-expanded', 'false');
  label.append(i);
}
