// Bestiary (owner: meta-b). Family tabs, grid of entries. Undiscovered enemies are BLACK 3D
// silhouettes and '???' until you win a battle containing them; discovered ones show an
// animated, rotatable 3D model, stats, traits with descriptions, counters, lore and the stage
// they first appear in (Teleport). Thumbnails are rendered once with a shared offscreen renderer.
// Route: #/bestiary[?family=<id>&id=<enemyId>]
import '../styles/meta-b.css';
import * as THREE from 'three';
import { h, clear, screen, svgEl, button } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { formatNumber } from '../../core/util.js';
import { ARMOR_CLASSES, TRAITS, CAPABILITIES, ELEMENTS } from '../../data/types.js';
import { FAMILIES, FAMILY_ORDER, ENEMIES, ENEMY_MAP, enemiesByFamily, enemyTraits } from '../../data/enemies.js';
import { STAGE_MAP } from '../../data/stages.js';
import { discoverableEnemies, bestiaryPercent } from '../../systems/missions.js';
import { traitIcon, armorClassIcon, uiIcon } from '../../art/icons.js';
import { buildEnemy, makeSilhouette, createModelViewer, disposeObject } from '../../models/index.js';
import { put, cssVars } from './backpack.js';

const view = { family: 'all', selected: null };
const TIER_LABEL = { normal: '', elite: 'Elite', miniboss: 'Miniboss', boss: 'Boss' };

// ---------------------------------------------------------------------------
// Thumbnails: one offscreen WebGL renderer, results cached as data URLs.
// ---------------------------------------------------------------------------

const thumbCache = new Map();
let thumbRig = null;

function getRig() {
  if (thumbRig) return thumbRig;
  const size = 192;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d3ea', 1.3));
  const key = new THREE.DirectionalLight('#fff4e6', 1.6);
  key.position.set(2.2, 3.5, 3.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe6ff', 0.8);
  rim.position.set(-2.5, 2, -3);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  thumbRig = { renderer, scene, camera };
  return thumbRig;
}

function disposeRig() {
  if (!thumbRig) return;
  thumbRig.renderer.dispose();
  thumbRig.renderer.forceContextLoss?.();
  thumbRig = null;
}

function renderThumb(def, silhouette) {
  const key = `${def.id}:${silhouette ? 1 : 0}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const { renderer, scene, camera } = getRig();
  const model = buildEnemy(def, { quality: 'medium' });
  model.userData.animate?.(0.4, 0, { moving: false, speed: 1 });
  if (silhouette) makeSilhouette(model);
  model.rotation.y = 0.55;
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = Math.max(sz.x, sz.y, sz.z) * 1.12;
  const dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(center.x, center.y + span * 0.18, center.z + dist);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(model);
  disposeObject(model);
  thumbCache.set(key, url);
  return url;
}

/** Fills `img` elements progressively (a few per frame) so the grid appears instantly. */
function createThumbQueue() {
  const queue = [];
  let raf = 0;
  let stopped = false;
  const pump = () => {
    raf = 0;
    if (stopped) return;
    const start = performance.now();
    while (queue.length && performance.now() - start < 24) {
      const job = queue.shift();
      if (!job.img.isConnected) continue;
      try {
        job.img.src = renderThumb(job.def, job.silhouette);
        job.img.classList.add('ready');
        job.holder.querySelector('.mb-spinner')?.remove();
      } catch (e) {
        console.error('[bestiary] thumbnail failed', job.def.id, e);
        job.holder.querySelector('.mb-spinner')?.remove();
      }
    }
    if (queue.length) raf = requestAnimationFrame(pump);
  };
  return {
    add(def, silhouette, img, holder) {
      const key = `${def.id}:${silhouette ? 1 : 0}`;
      if (thumbCache.has(key)) {
        img.src = thumbCache.get(key);
        holder.querySelector('.mb-spinner')?.remove();
        return;
      }
      queue.push({ def, silhouette, img, holder });
      if (!raf) raf = requestAnimationFrame(pump);
    },
    stop() { stopped = true; cancelAnimationFrame(raf); queue.length = 0; },
  };
}

// ---------------------------------------------------------------------------
// Trait text
// ---------------------------------------------------------------------------

const enemyName = (id) => ENEMY_MAP[id]?.name || id;
const pct = (f) => `${Math.round(f * 100)}%`;

/** Concrete one-liner for a trait instance, e.g. "Drains 3 HP/s from each ally within 1.5 tiles". */
export function traitDetail(key, e, t = e.traits?.[key]) {
  switch (key) {
    case 'armored': return `${e.armor} flat armor on every hit.`;
    case 'barrier': return `${formatNumber(t.hp)} HP barrier that must break first${t.regenDelay ? `; regrows after ${t.regenDelay}s` : ''}.`;
    case 'crystal': return `Each hit is capped at ${t.cap} damage until ${t.hits} hits shatter the shell.`;
    case 'regen': return `Heals ${pct(t.pct)} of max HP per second after ${t.delay}s without damage.`;
    case 'hasty': return `Sprints at ×${t.mul} speed for ${t.duration}s every ${t.every}s.`;
    case 'volatile': return `Explodes on death (radius ${t.radius}), stunning girls for ${t.stun}s.`;
    case 'ward': return `${ELEMENTS[t]?.name || t} ward: immune to its status, half damage from it.`;
    case 'brood': case 'splitter': return `Releases ${t.count}× ${enemyName(t.spawn)} when defeated.`;
    case 'siphon': return `Drains ${t.rate} HP/s from each ally within ${t.radius} tiles.`;
    case 'blink': return `Teleports ${t.distance} tiles forward every ${t.every}s.`;
    case 'field': return t.kinds ? `Rotates ${t.kinds.join(' / ')} fields (radius ${t.radius}) every ${t.every}s.` : `${t.kind[0].toUpperCase()}${t.kind.slice(1)} field on allies within ${t.radius} tiles.`;
    case 'phasing': return `Turns intangible for ${t.duration}s every ${t.every}s.`;
    case 'guardian': return `Allies within ${t.radius} tiles take ${pct(t.reduction)} less damage.`;
    case 'sabotage': return `Disables girls within ${t.radius} tiles for ${t.duration}s (every ${t.cooldown}s).`;
    case 'decoy': return `Creates ${t.count} ${enemyName(t.spawn)} every ${t.every}s.`;
    case 'enrage': return `Speeds up as packmates fall (up to ${t.max > 1 ? `×${t.max}` : `+${pct(t.max)}`}).`;
    case 'summoner': return `Calls ${t.count}× ${enemyName(t.spawn)} every ${t.every}s.`;
    case 'airborne': return 'Flies — only girls that can hit flyers reach it.';
    case 'veiled': return 'Hidden — needs Veil Sight or Reveal.';
    default: return TRAITS[key]?.desc || '';
  }
}

function traitRows(e) {
  const keys = enemyTraits(e);
  const base = new Set(Object.keys(e.traits || {}).filter((k) => e.traits[k]));
  if (e.armor > 0) base.add('armored');
  return keys.map((k) => {
    const def = TRAITS[k];
    const own = base.has(k);
    const phaseT = own ? null : (e.phases || []).map((p) => p.set?.traits?.[k]).find(Boolean);
    const detail = own ? traitDetail(k, e) : phaseT && typeof phaseT === 'object' ? `${traitDetail(k, e, phaseT)} (boss phase)` : `${def?.desc || ''} (boss phase)`;
    return h('div.mb-trait',
      svgEl(traitIcon(k)),
      h('div',
        h('b', def?.name || k), h('div', detail),
        def?.counters?.length ? h('div.mb-trait-counter', 'Counter: ', def.counters.map((c) => CAPABILITIES[c]?.name || c).join(', ')) : null));
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function render(root, params = {}) {
  if (params.family && (params.family === 'all' || FAMILIES[params.family])) view.family = params.family;
  if (params.id && ENEMY_MAP[params.id]) view.selected = params.id;
  const profile = store.profile;
  const { el, body } = screen('Bestiary');
  el.classList.add('mb-screen', 'mb-bestiary-screen');
  root.appendChild(el);

  const wide = window.matchMedia('(min-width: 900px)');
  const thumbs = createThumbQueue();
  const tabsEl = h('nav.mb-tabs');
  const progress = h('div.mb-completion');
  const famDesc = h('p.mb-family-desc');
  const grid = h('div.mb-best-grid');
  const detailHost = h('div.mb-best-detail-host');
  body.appendChild(h('div.mb-bestiary', h('div.mb-best-left', progress, tabsEl, famDesc, grid), detailHost));

  let viewer = null;
  let model = null;
  let sheet = null;
  const discoverable = new Set(discoverableEnemies());
  const entry = (id) => profile.bestiary?.[id] || {};

  const closeViewer = () => {
    viewer?.dispose();
    if (model) disposeObject(model);
    viewer = null;
    model = null;
  };
  const closeSheet = () => {
    if (!sheet) return;
    closeViewer();
    sheet.remove();
    sheet = null;
  };

  function renderProgress() {
    const all = [...discoverable];
    const found = all.filter((id) => entry(id).discovered).length;
    const seen = all.filter((id) => entry(id).seen && !entry(id).discovered).length;
    const p = bestiaryPercent(profile);
    clear(progress);
    put(progress,
      h('div.mb-completion-pct', `${p}%`),
      h('div.mb-completion-bar',
        h('div', { style: 'font-weight:900;color:var(--navy)' }, `${found} / ${all.length} discovered`),
        h('div.mb-exp', h('div.mb-exp-fill', { style: { width: `${p}%` } })),
        h('div.muted', seen ? `${seen} more seen in battle — win a stage with them to discover them.` : 'Win a battle containing an enemy to discover it.')));
  }

  function renderTabs() {
    clear(tabsEl);
    const famStats = (f) => {
      const list = f === 'all' ? ENEMIES : enemiesByFamily(f);
      return `${list.filter((e) => entry(e.id).discovered).length}/${list.length}`;
    };
    for (const f of ['all', ...FAMILY_ORDER.filter((x) => FAMILIES[x])]) {
      tabsEl.appendChild(h(`button.mb-tab${view.family === f ? '.active' : ''}`, {
        'data-testid': `fam-${f}`,
        onclick: () => { view.family = f; history.replaceState(null, '', `#/bestiary?family=${f}`); renderTabs(); renderGrid(); },
      }, f === 'all' ? 'All' : FAMILIES[f].name, h('span.mb-tab-count', famStats(f))));
    }
    const active = tabsEl.querySelector('.mb-tab.active');
    requestAnimationFrame(() => active?.scrollIntoView?.({ block: 'nearest', inline: 'center' }));
    famDesc.textContent = view.family === 'all' ? 'Twelve families, from garden slimes to the dragons of Ashwing Peaks.' : `${FAMILIES[view.family].desc} ${FAMILIES[view.family].behavior}`;
  }

  function renderGrid() {
    clear(grid);
    grid.classList.remove('mb-fade');
    void grid.offsetWidth;
    grid.classList.add('mb-fade');
    const list = view.family === 'all' ? FAMILY_ORDER.flatMap((f) => enemiesByFamily(f)) : enemiesByFamily(view.family);
    for (const e of list) {
      const known = !!entry(e.id).discovered;
      const holder = h('div.mb-beast-img', h('div.mb-spinner'));
      const img = h('img', { alt: known ? e.name : 'Unknown enemy', draggable: false });
      holder.appendChild(img);
      const keys = known ? enemyTraits(e).slice(0, 3) : [];
      const card = h(`button.mb-beast${known ? '' : '.locked'}${view.selected === e.id ? '.on' : ''}`, {
        style: cssVars({ '--fam': FAMILIES[e.family]?.color }), 'data-enemy': e.id,
        onclick: () => select(e.id),
      },
      holder,
      TIER_LABEL[e.tier] ? h(`span.mb-beast-tier.${e.tier}`, TIER_LABEL[e.tier]) : null,
      known ? h('div.mb-beast-traits', keys.map((k) => svgEl(traitIcon(k)))) : entry(e.id).seen ? h('span.mb-beast-seen', 'SEEN') : null,
      h('div.mb-beast-name', known ? e.name : '???'));
      grid.appendChild(card);
      thumbs.add(e, !known, img, holder);
    }
  }

  function detailPanel(e) {
    const known = !!entry(e.id).discovered;
    const seen = !!entry(e.id).seen;
    const fam = FAMILIES[e.family];
    const viewerBox = h(`div.mb-viewer${known ? '' : '.locked'}`, h('div.mb-viewer-canvas'), h('div.mb-show-hint', svgEl(uiIcon('refresh')), known ? 'Drag to rotate · tap to poke' : 'Undiscovered'));
    const stage = STAGE_MAP[e.introducedIn];
    const firstSeen = stage
      ? h('div.mb-first-seen', h('div', h('div.muted', known ? 'First seen' : 'Appears in'), h('b', stage.kind === 'campaign' ? `${stage.id} · ${stage.name}` : stage.name)),
        button('Teleport', { kind: 'yellow', small: true, icon: 'teleport', testid: 'bestiary-teleport', onClick: () => { closeSheet(); navigate('stage', { id: stage.id }); } }))
      : null;
    const bodyEl = known
      ? h('div.mb-detail-body',
        h('div.mb-detail-name', e.name),
        h('div.mb-detail-sub', h('span.mb-fam-pill', { style: cssVars({ '--fam': fam?.color }) }, fam?.name), TIER_LABEL[e.tier] ? h('span', `· ${TIER_LABEL[e.tier]}`) : null, h('span', `· defeated ${formatNumber(entry(e.id).kills || 0)}`)),
        h('div.mb-kv',
          h('div', h('span', 'HP'), h('b', formatNumber(e.hp))),
          h('div', h('span', 'Speed'), h('b', `${e.speed}`)),
          h('div', h('span', 'Armor class'), h('b', svgEl(armorClassIcon(e.armorClass)), ARMOR_CLASSES[e.armorClass]?.name || e.armorClass)),
          h('div', h('span', 'Flat armor'), h('b', String(e.armor || 0))),
          h('div', h('span', 'Lives on leak'), h('b', e.tier === 'boss' ? 'All' : String(e.leak))),
          h('div', h('span', 'Bounty'), h('b', formatNumber(e.bounty)))),
        enemyTraits(e).length ? h('div.mb-sub-title', 'Traits') : null,
        enemyTraits(e).length ? h('div.mb-trait-list', traitRows(e)) : h('p.muted', 'No special rule — plain fodder. Its armor class is its only quirk.'),
        e.phases?.length ? h('div.mb-sub-title', 'Phases') : null,
        e.phases?.length ? h('div', e.phases.map((p) => h('div.mb-phase', h('b', `${Math.round(p.atHp * 100)}% HP — `), p.announce))) : null,
        h('div.mb-sub-title', 'How to counter'),
        h('div.mb-counter-box', e.counters),
        h('p.mb-lore', e.lore),
        firstSeen)
      : h('div.mb-detail-body',
        h('div.mb-unknown', h('div.mb-unknown-q', '???'), h('div', seen ? 'Seen in battle, but not yet defeated in a victory.' : 'Not discovered yet.')),
        h('div.mb-detail-sub', h('span.mb-fam-pill', { style: cssVars({ '--fam': fam?.color }) }, fam?.name), TIER_LABEL[e.tier] ? h('span', `· ${TIER_LABEL[e.tier]}`) : null),
        h('p.muted', 'Win a battle on a stage that contains this enemy to reveal its model, stats, traits and counters.'),
        firstSeen);
    const panel = h('div.mb-detail-panel.mb-fade', viewerBox, bodyEl);
    return { panel, mount: () => mountViewer(viewerBox.firstChild, e, known) };
  }

  function mountViewer(container, e, known) {
    closeViewer();
    viewer = createModelViewer(container, { background: null, autoRotate: true });
    model = buildEnemy(e, { quality: 'high' });
    if (!known) makeSilhouette(model);
    viewer.setObject(model);
  }

  function select(id) {
    view.selected = id;
    history.replaceState(null, '', `#/bestiary?family=${view.family}&id=${id}`);
    grid.querySelectorAll('.mb-beast').forEach((b) => b.classList.toggle('on', b.dataset.enemy === id));
    const e = ENEMY_MAP[id];
    const { panel, mount } = detailPanel(e);
    if (wide.matches) {
      closeSheet();
      clear(detailHost);
      detailHost.appendChild(panel);
      mount();
    } else {
      closeSheet();
      closeViewer();
      sheet = h('div.mb-sheet-overlay', { onclick: (ev) => { if (ev.target === sheet) closeSheet(); } },
        h('div.mb-sheet', h('button.mb-sheet-close', { onclick: closeSheet, title: 'Close' }, svgEl(uiIcon('close'))), panel));
      document.body.appendChild(sheet);
      mount();
    }
  }

  function renderDetailPlaceholder() {
    clear(detailHost);
    if (!wide.matches) return;
    detailHost.appendChild(h('div.mb-empty', h('div.mb-empty-art', svgEl(uiIcon('bestiary'))), h('div.mb-empty-title', 'Select an enemy'), h('p.muted', 'Discovered enemies show their 3D model, traits and counters. Black silhouettes are still a mystery.')));
  }

  renderProgress();
  renderTabs();
  renderGrid();
  if (view.selected && wide.matches) select(view.selected);
  else renderDetailPlaceholder();

  const onWide = () => { closeSheet(); closeViewer(); if (view.selected && wide.matches) select(view.selected); else renderDetailPlaceholder(); };
  wide.addEventListener?.('change', onWide);
  return () => {
    wide.removeEventListener?.('change', onWide);
    thumbs.stop();
    closeSheet();
    closeViewer();
    disposeRig();
  };
}

