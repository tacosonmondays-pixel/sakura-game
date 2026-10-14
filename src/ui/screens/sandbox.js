// Sandbox (owner: meta-a). Route: #/sandbox (pick a map + difficulty), #/sandbox?step=team (pick any
// girl, owned or not — she joins at max level and awakening), then the battle:
// #/battle?stage=<host stage>&difficulty=…&sandbox=1&team=a.b.c&hero=x
// Solo only. Opens after SANDBOX_UNLOCK_CLEARS campaign clears; nothing from a sandbox run is saved.
import '../styles/meta-a.css';
import '../styles/meta-b.css';
import '../styles/sandbox.css';
import { h, clear, screen, svgEl, button, unitCard, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { BATTLE, DIFFICULTIES, DIFFICULTY_ORDER, MAP_TIERS } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { uiIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { isOwned } from '../../systems/unlocks.js';
import { MAX_LEVEL, MAX_AWAKEN } from '../../systems/progression.js';
import {
  isSandboxUnlocked, sandboxLockText, sandboxMaps, sandboxFormation, sandboxRoster, sandboxBattleParams,
  campaignClears, SANDBOX_UNLOCK_CLEARS, SANDBOX_COINS,
} from '../../systems/sandbox.js';

const KEY = 'sakura.sandbox.v1';
/** Where a non-campaign map comes from. */
const MODE_LABEL = { resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge' };

/** The last choice (per viewer, this tab): map, difficulty, squad. */
function loadChoice(profile) {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    saved = null;
  }
  const maps = sandboxMaps();
  const mapId = maps.some((m) => m.map.id === saved?.mapId) ? saved.mapId : maps[0]?.map.id;
  const difficulty = DIFFICULTIES[saved?.difficulty] ? saved.difficulty : 'normal';
  let f = saved ? sandboxFormation(saved.towers, saved.hero) : null;
  if (!f || (!f.towers.length && !f.hero)) {
    // first visit: the saved formation (owned girls), else the first four students
    const pf = profile.formation || {};
    f = sandboxFormation(pf.towers || [], pf.hero || null);
    if (!f.towers.length) f.towers = sandboxRoster('tower').slice(0, 4).map((u) => u.id);
  }
  return { mapId, difficulty, towers: f.towers, hero: f.hero };
}

function saveChoice(c) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private mode: the choice lasts this screen only */
  }
}

export function render(root, params = {}) {
  const step = params.step === 'team' ? 'team' : 'map';
  const { el, body } = screen(step === 'team' ? 'Sandbox · Squad' : 'Sandbox', { cls: 'ma-sandbox-screen' });
  root.appendChild(el);
  const choice = loadChoice(store.profile);
  const draw = () => {
    clear(body);
    if (!isSandboxUnlocked(store.profile)) body.appendChild(locked());
    else body.appendChild(step === 'team' ? teamStep(choice, draw) : mapStep(choice, draw));
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => off();
}

function locked() {
  const profile = store.profile;
  return h('div.ma-wrap.sbx-locked', { 'data-testid': 'sandbox-locked' },
    h('div.ma-empty-state',
      svgEl(uiIcon('lock')),
      h('h3', 'Sandbox is locked'),
      h('p', `${sandboxLockText(profile)}. You have cleared ${campaignClears(profile)}/${SANDBOX_UNLOCK_CLEARS} campaign stages.`),
      button('Open the campaign', { kind: 'yellow', icon: 'map', onClick: () => navigate('campaign') })));
}

/** The rules strip both steps show. */
function rulesStrip() {
  return h('div.sbx-rules',
    h('span.sbx-rule', svgEl(uiIcon('coin'), 'ma-inline-icon'), `${SANDBOX_COINS.toLocaleString('en-US')} coins`),
    h('span.sbx-rule', svgEl(uiIcon('heart'), 'ma-inline-icon'), 'Unlimited lives'),
    h('span.sbx-rule', svgEl(uiIcon('students'), 'ma-inline-icon'), 'Any girl, max level'),
    h('span.sbx-rule.sbx-rule-no', svgEl(uiIcon('gift'), 'ma-inline-icon'), 'No rewards'));
}

// ---------------------------------------------------------------------------------------------
// Step 1: map + difficulty
// ---------------------------------------------------------------------------------------------

function mapStep(choice, redraw) {
  const maps = sandboxMaps();
  const current = maps.find((m) => m.map.id === choice.mapId) || maps[0];
  const diffRow = h('div.mb-seg.sbx-diff', DIFFICULTY_ORDER.map((d) => h(`button.mb-seg-btn${choice.difficulty === d ? '.on' : ''}`, {
    'data-testid': `sandbox-diff-${d}`,
    onclick: () => { choice.difficulty = d; saveChoice(choice); redraw(); },
  }, DIFFICULTIES[d].name)));
  const next = button('Next: Squad', { kind: 'yellow', icon: 'formation', testid: 'sandbox-next', onClick: () => { saveChoice(choice); navigate('sandbox', { step: 'team' }); } });
  const head = h('section.sbx-head',
    h('div.sbx-head-text',
      h('div.sbx-head-line', h('span.sbx-badge', 'SANDBOX'), h('h2.sbx-title', current?.map.name || 'Pick a map')),
      rulesStrip()),
    h('div.sbx-head-actions', diffRow, next));
  const grid = h('div.ma-endless-grid.sbx-map-grid', { 'data-testid': 'sandbox-maps' }, maps.map(({ map, stage }) => {
    const on = map.id === choice.mapId;
    const tier = MAP_TIERS[stage.tier];
    return h(`button.ma-endless-card.sbx-map${on ? '.on' : ''}`, {
      'data-testid': `sandbox-map-${map.id}`,
      'aria-pressed': on ? 'true' : 'false',
      onclick: () => { choice.mapId = map.id; saveChoice(choice); redraw(); },
    },
    h('div.ma-ec-thumb', { html: stageThumbSVG(map, { width: 240, height: 150 }) }),
    on ? h('span.sbx-map-check', svgEl(uiIcon('check'))) : null,
    h('div.ma-ec-info', h('b', map.name), h('span.muted', `${stage.kind === 'campaign' ? `Stage ${stage.id}` : MODE_LABEL[stage.kind] || stage.name}${tier ? ` · ${tier.name}` : ''}`)));
  }));
  return h('div.ma-wrap.sbx-wrap', head, grid);
}

// ---------------------------------------------------------------------------------------------
// Step 2: squad (any girl)
// ---------------------------------------------------------------------------------------------

const pick = { kind: 'tower' };

function teamStep(choice, redraw) {
  const profile = store.profile;
  const map = sandboxMaps().find((m) => m.map.id === choice.mapId)?.map;
  const toggle = (id) => {
    const u = UNIT_MAP[id];
    if (u.kind === 'hero') choice.hero = choice.hero === id ? null : id;
    else if (choice.towers.includes(id)) choice.towers = choice.towers.filter((t) => t !== id);
    else if (choice.towers.length >= BATTLE.maxTowers) {
      toast(`The squad is full (${BATTLE.maxTowers} girls). Tap a girl in the squad to remove her first.`, 'bad');
      return;
    } else choice.towers = [...choice.towers, id];
    saveChoice(choice);
    redraw();
  };
  const slot = (id, kind) => (id
    ? h('button.mb-fslot.filled', { title: `Remove ${UNIT_MAP[id].name}`, 'data-unit': id, onclick: () => toggle(id) },
      svgEl(portraitHTML(UNIT_MAP[id], 'card'), 'unit-card-art'),
      h('span.mb-fslot-x', '×'),
      isOwned(profile, id) ? null : h('span.sbx-trial', 'Trial'),
      h('div.mb-fslot-name', UNIT_MAP[id].name, h('span', { style: 'opacity:.8;font-weight:700' }, ` Lv${MAX_LEVEL}`)))
    : h('button.mb-fslot', { onclick: () => { pick.kind = kind; redraw(); } }, '+'));
  const start = () => {
    const f = sandboxFormation(choice.towers, choice.hero);
    if (!f.towers.length && !f.hero) {
      toast('Pick at least one girl first.', 'bad');
      return;
    }
    saveChoice(choice);
    navigate('battle', sandboxBattleParams({ mapId: choice.mapId, difficulty: choice.difficulty, towers: f.towers, hero: f.hero }));
  };
  // sticky: Start stays in reach while the roster scrolls
  const bar = h('div.sbx-bar',
    h('div.sbx-bar-info',
      h('span.sbx-badge', 'SANDBOX'),
      h('b.sbx-bar-map', map ? map.name : ''),
      h('span.sbx-bar-diff', DIFFICULTIES[choice.difficulty].name)),
    h('div.sbx-bar-actions',
      button('Change map', { kind: 'ghost', small: true, icon: 'map', onClick: () => navigate('sandbox') }),
      button('Start sandbox', { kind: 'yellow', icon: 'play', testid: 'sandbox-start', onClick: start })));
  const squad = h('section.mb-card.sbx-squad',
    h('div.sbx-squad-head',
      h('h3.mb-card-title', 'Squad'),
      button('Clear', { kind: 'ghost', small: true, disabled: !choice.towers.length && !choice.hero, onClick: () => { choice.towers = []; choice.hero = null; saveChoice(choice); redraw(); } })),
    h('div.mb-squad',
      h('div.mb-hero-slot', h('div.mb-slot-label', 'Hero'), slot(choice.hero, 'hero')),
      h('div', h('div.mb-slot-label', `Students ${choice.towers.length} / ${BATTLE.maxTowers}`),
        h('div.mb-tower-slots', Array.from({ length: BATTLE.maxTowers }, (_, i) => slot(choice.towers[i], 'tower'))))));
  const team = [choice.hero, ...choice.towers];
  const list = sandboxRoster(pick.kind);
  const picker = h('section.mb-card.sbx-pick',
    h('div.mb-section-head',
      h('div.mb-seg', [['tower', 'Students'], ['hero', 'Heroes']].map(([k, label]) => h(`button.mb-seg-btn${pick.kind === k ? '.on' : ''}`, { 'data-testid': `sandbox-kind-${k}`, onclick: () => { pick.kind = k; redraw(); } }, label))),
      h('span.muted', `Every girl joins at Lv ${MAX_LEVEL} with ${MAX_AWAKEN}★ awakening — owned or not.`)),
    h('div.mb-pick-grid', { 'data-testid': 'sandbox-roster' }, list.map((u) => {
      const card = unitCard(u.id, { variant: 'tall', level: MAX_LEVEL, awaken: MAX_AWAKEN, owned: true, onClick: () => toggle(u.id) });
      card.dataset.testid = `sandbox-unit-${u.id}`;
      return h(`div.mb-pick${team.includes(u.id) ? '.in' : ''}`,
        card,
        team.includes(u.id) ? h('span.mb-pick-check', svgEl(uiIcon('check'))) : null,
        isOwned(profile, u.id) ? null : h('span.sbx-trial', 'Trial'));
    })));
  return h('div.ma-wrap.sbx-wrap.sbx-team', bar, rulesStrip(), squad, picker);
}
