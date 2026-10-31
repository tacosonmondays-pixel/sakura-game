// Sandbox (owner: meta-a). Route: #/sandbox (pick a stage of any mode, or a titan, and the run: difficulty, freeplay
// tier, battle mode, start wave), #/sandbox/team (pick any girl, owned or not, and her build: by default the true
// maximum, L85 · P6 · ★5 · LR with her coach's LR set; a squad build and per-girl builds can set any lower values and
// any gear preset), then the battle (src/systems/sandbox.js sandboxBattleParams).
// Solo only. Opens after SANDBOX_UNLOCK_CLEARS campaign clears; nothing from a sandbox run is saved (the choice lives in
// sessionStorage for this tab, the virtual gear only in the battle's stats).
import '../styles/meta-a.css';
import '../styles/meta-b.css';
import '../styles/sandbox.css';
import { h, clear, screen, svgEl, button, unitCard, toast, modal } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { BATTLE, DIFFICULTIES } from '../../data/types.js';
import { MAP_TIER_VIEW } from '../../data/mapTierNames.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP } from '../../data/stages.js';
import { FREEPLAY_TIERS, freeplayTable } from '../../data/freeplay.js';
import { MODE_ORDER } from '../../data/modes.js';
import { modeText } from '../text/modes.js';
import { TITAN_TIERS, TIER_NAMES, MAX_RANK } from '../../data/titans.js';
import { SET_IDS, GEAR_SETS } from '../../data/gearSets.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { uiIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { isOwned } from '../../systems/unlocks.js';
import { isLegendUnit } from '../../data/banners.js';
import {
  isSandboxUnlocked, sandboxLockText, sandboxStages, sandboxTitans, sandboxFormation, sandboxRoster, sandboxBattleParams,
  sandboxFreeplayOk, sandboxModeOk, sandboxDifficulties, sandboxEventName, sandboxStageFor, sandboxIsLr,
  normalizeBuild, buildFor, gearPresetLabel, startWaveOf, potentialForLevel,
  campaignClears, SANDBOX_UNLOCK_CLEARS, SANDBOX_COINS, SANDBOX_GROUPS, SANDBOX_MAX_BUILD, SANDBOX_WAVE_PICKS, SANDBOX_MAX_START_WAVE,
  BEST_SET, SANDBOX_LEVEL_PICKS, bestSetFor,
} from '../../systems/sandbox.js';

const KEY = 'sakura.sandbox.v1';
const MODE_LABEL = { resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge', side: 'Side stage', event: 'Event' };

/** The last choice (per viewer, this tab): stage or titan, the run, the squad and its builds. */
function loadChoice(profile) {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    saved = null;
  }
  const stages = sandboxStages();
  // (an older choice named a map: its host stage)
  const wantStage = saved?.stageId || (saved?.mapId ? sandboxStageFor(saved.mapId) : null);
  const stageId = stages.some((s) => s.id === wantStage) ? wantStage : stages[0]?.id;
  const titans = sandboxTitans();
  const titan = saved?.titan && titans.some((t) => t.id === saved.titan.id)
    ? { id: saved.titan.id, tier: TITAN_TIERS.includes(saved.titan.tier) ? saved.titan.tier : 'normal', rank: Math.max(0, Math.min(MAX_RANK, Math.floor(Number(saved.titan.rank) || 0))) }
    : { id: titans[0]?.id, tier: 'normal', rank: 0 };
  const group = SANDBOX_GROUPS.some((g) => g.id === saved?.group) ? saved.group : stages.find((s) => s.id === stageId)?.group || 'act1';
  const difficulty = DIFFICULTIES[saved?.difficulty] ? saved.difficulty : 'normal';
  let f = saved ? sandboxFormation(saved.towers, saved.hero) : null;
  if (!f) {
    // first visit: the saved formation (owned girls), else the first four students
    const pf = profile.formation || {};
    f = sandboxFormation(pf.towers || [], pf.hero || null);
    if (!f.towers.length) f.towers = sandboxRoster('tower').slice(0, 4).map((u) => u.id);
  }
  const builds = {};
  for (const [id, b] of Object.entries(saved?.builds || {})) if (UNIT_MAP[id]) builds[id] = normalizeBuild(b);
  return {
    group, stageId, titan, difficulty,
    freeplay: FREEPLAY_TIERS.includes(saved?.freeplay) ? saved.freeplay : null,
    mode: MODE_ORDER.includes(saved?.mode) ? saved.mode : 'standard',
    startWave: startWaveOf(saved?.startWave),
    towers: f.towers, hero: f.hero,
    build: normalizeBuild(saved?.build || SANDBOX_MAX_BUILD),
    builds,
  };
}

function saveChoice(c) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private mode: the choice lasts this screen only */
  }
}

/** Whether the choice plays a titan (the Titan Trials tab). */
const isTitan = (c) => c.group === 'titan';

/** The battle params of the choice. */
function battleParams(c, f) {
  return sandboxBattleParams({
    stageId: c.stageId, difficulty: c.difficulty, towers: f.towers, hero: f.hero,
    titan: isTitan(c) ? c.titan : null,
    freeplay: c.freeplay, mode: c.mode, startWave: c.startWave, build: c.build, builds: c.builds,
  });
}

/** One line naming the run: "Freeplay · Blossom from wave 200", "Titan Trials · Mayhem +30". */
function runLine(c) {
  const bits = [];
  if (isTitan(c)) bits.push(`${TIER_NAMES[c.titan.tier]}${c.titan.tier === 'mayhem' ? ` +${c.titan.rank}` : ''}`);
  else {
    bits.push(DIFFICULTIES[c.difficulty]?.name || c.difficulty);
    if (c.freeplay && sandboxFreeplayOk(c.stageId)) bits.push(`Freeplay ${freeplayTable(c.freeplay)?.name || c.freeplay}`);
    else if (c.mode !== 'standard' && sandboxModeOk(c.stageId)) bits.push(modeText(c.mode).name);
  }
  if (c.startWave > 1) bits.push(`from wave ${c.startWave}`);
  return bits.join(' · ');
}

/** The run's title: the stage's or the titan's name. */
function runTitle(c) {
  if (isTitan(c)) return sandboxTitans().find((t) => t.id === c.titan.id)?.titan.name || 'Titan Trials';
  const s = STAGE_MAP[c.stageId];
  return s ? `${s.kind === 'campaign' ? `${s.id} ` : ''}${s.name}` : 'Pick a stage';
}

export function render(root, params = {}) {
  const step = params.id === 'team' ? 'team' : 'map';
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
    h('span.sbx-rule', svgEl(uiIcon('students'), 'ma-inline-icon'), 'Any girl, any build'),
    h('span.sbx-rule.sbx-rule-no', svgEl(uiIcon('gift'), 'ma-inline-icon'), 'No rewards'));
}

/** A segmented row. */
function seg(items, on, pick, testid) {
  return h('div.mb-seg.sbx-seg', items.map(([id, label]) => h(`button.mb-seg-btn${on === id ? '.on' : ''}`, { 'data-testid': `${testid}-${id}`, onclick: () => pick(id) }, label)));
}

/** A labelled `<select>`. */
function selectRow(label, value, options, onChange, testid) {
  return h('label.sbx-field',
    h('span.sbx-field-label', label),
    h('select.sbx-select', { 'data-testid': testid, 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      options.map((o) => (o.group
        ? h('optgroup', { label: o.group }, o.options.map((x) => h('option', { value: x.value, ...(String(x.value) === String(value) ? { selected: true } : {}) }, x.label)))
        : h('option', { value: o.value, ...(String(o.value) === String(value) ? { selected: true } : {}) }, o.label)))));
}

// ---------------------------------------------------------------------------------------------
// Step 1: stage + run
// ---------------------------------------------------------------------------------------------

function mapStep(choice, redraw) {
  const set = (patch) => { Object.assign(choice, patch); saveChoice(choice); redraw(); };
  const stages = sandboxStages();
  const titan = isTitan(choice);
  const next = button('Next: Squad', { kind: 'yellow', icon: 'formation', testid: 'sandbox-next', onClick: () => { saveChoice(choice); navigate('sandbox', { id: 'team' }); } });
  const diffs = sandboxDifficulties(choice.stageId);
  if (!titan && !diffs.includes(choice.difficulty)) choice.difficulty = diffs.includes('normal') ? 'normal' : diffs[0];
  const diffRow = titan
    ? seg(TITAN_TIERS.map((t) => [t, TIER_NAMES[t]]), choice.titan.tier, (t) => set({ titan: { ...choice.titan, tier: t } }), 'sandbox-ttier')
    : seg(diffs.map((d) => [d, DIFFICULTIES[d].name]), choice.difficulty, (d) => set({ difficulty: d }), 'sandbox-diff');
  const head = h('section.sbx-head',
    h('div.sbx-head-text',
      h('div.sbx-head-line', h('span.sbx-badge', 'SANDBOX'), h('h2.sbx-title', { 'data-testid': 'sandbox-title' }, runTitle(choice))),
      h('span.sbx-run-line', { 'data-testid': 'sandbox-run' }, runLine(choice)),
      rulesStrip()),
    h('div.sbx-head-actions', diffRow, next));

  // the run's options: freeplay tier or battle mode (campaign), Mayhem rank (titans), start wave (any)
  const opts = [];
  if (!titan && sandboxFreeplayOk(choice.stageId)) {
    opts.push(h('div.sbx-opt', h('span.sbx-field-label', 'Freeplay'),
      seg([['off', 'Off'], ...FREEPLAY_TIERS.map((t) => [t, freeplayTable(t)?.name || t])], choice.freeplay || 'off', (t) => set({ freeplay: t === 'off' ? null : t }), 'sandbox-fp')));
    if (!choice.freeplay && sandboxModeOk(choice.stageId)) {
      opts.push(selectRow('Battle mode', choice.mode, MODE_ORDER.map((m) => ({ value: m, label: modeText(m).name })), (m) => set({ mode: m }), 'sandbox-mode'));
    }
  }
  if (titan && choice.titan.tier === 'mayhem') {
    opts.push(h('label.sbx-field', h('span.sbx-field-label', `Mayhem rank (0–${MAX_RANK})`),
      h('input.sbx-num', { type: 'number', min: 0, max: MAX_RANK, value: choice.titan.rank, 'data-testid': 'sandbox-trank', onchange: (e) => set({ titan: { ...choice.titan, rank: Math.max(0, Math.min(MAX_RANK, Math.floor(Number(e.target.value) || 0))) } }) })));
  }
  opts.push(h('div.sbx-opt.sbx-wave',
    h('label.sbx-field', h('span.sbx-field-label', 'Start wave'),
      h('input.sbx-num', { type: 'number', min: 1, max: SANDBOX_MAX_START_WAVE, value: choice.startWave, 'data-testid': 'sandbox-wave', onchange: (e) => set({ startWave: startWaveOf(e.target.value) }) })),
    h('div.sbx-chips', SANDBOX_WAVE_PICKS.map((w) => h(`button.sbx-chip${choice.startWave === w ? '.on' : ''}`, { 'data-testid': `sandbox-wave-${w}`, onclick: () => set({ startWave: w }) }, w === 1 ? 'Wave 1' : `${w}`)))));
  const options = h('section.sbx-options', { 'data-testid': 'sandbox-options' }, opts);

  const tabs = h('div.sbx-tabs', { role: 'tablist' }, SANDBOX_GROUPS.map((g) => {
    const n = g.id === 'titan' ? sandboxTitans().length : stages.filter((s) => s.group === g.id).length;
    return h(`button.sbx-tab${choice.group === g.id ? '.on' : ''}`, {
      role: 'tab', 'aria-selected': choice.group === g.id ? 'true' : 'false', 'data-testid': `sandbox-group-${g.id}`, disabled: !n,
      onclick: () => {
        const first = stages.find((s) => s.group === g.id);
        set({ group: g.id, ...(g.id !== 'titan' && first && STAGE_MAP[choice.stageId] && stages.find((s) => s.id === choice.stageId)?.group !== g.id ? { stageId: first.id } : {}) });
      },
    }, g.name, h('span.sbx-tab-n', String(n)));
  }));

  const cards = titan
    ? sandboxTitans().map(({ id, titan: t, map }) => card({ id: `titan-${id}`, on: choice.titan.id === id, map, title: t.name, sub: `Titan Trials · ${t.arena || map.name}`, onClick: () => set({ titan: { ...choice.titan, id } }) }))
    : stages.filter((s) => s.group === choice.group).map(({ id, stage, map }) => {
      const tier = MAP_TIER_VIEW[stage.tier];
      const sub = stage.kind === 'campaign' ? `Stage ${stage.id}` : stage.kind === 'event' ? sandboxEventName(id) || 'Event' : MODE_LABEL[stage.kind] || stage.kind;
      return card({ id: `stage-${id}`, on: choice.stageId === id, map, title: stage.name, sub: `${sub}${tier ? ` · ${tier.name}` : ''}`, onClick: () => set({ stageId: id }) });
    });
  const grid = h('div.ma-endless-grid.sbx-map-grid', { 'data-testid': 'sandbox-maps' }, cards);
  return h('div.ma-wrap.sbx-wrap', head, options, tabs, grid);
}

function card({ id, on, map, title, sub, onClick }) {
  return h(`button.ma-endless-card.sbx-map${on ? '.on' : ''}`, { 'data-testid': `sandbox-${id}`, 'aria-pressed': on ? 'true' : 'false', onclick: onClick },
    h('div.ma-ec-thumb', { html: stageThumbSVG(map, { width: 240, height: 150 }) }),
    on ? h('span.sbx-map-check', svgEl(uiIcon('check'))) : null,
    h('div.ma-ec-info', h('b', title), h('span.muted', sub)));
}

// ---------------------------------------------------------------------------------------------
// Step 2: squad (any girl) and builds
// ---------------------------------------------------------------------------------------------

const pick = { kind: 'tower' };

/** The gear select's rarity words. */
const SHORT = { leg: 'Legendary', ur: 'UR', lr: 'LR' };
/** The options of the gear select (grouped). */
function gearOptions(unitId = null) {
  const setRow = (r) => [BEST_SET, ...SET_IDS].map((s) => ({ value: `${r}-${s}`, label: `${SHORT[r]} · ${s === BEST_SET ? `${unitId ? GEAR_SETS[bestSetFor(unitId)].name : 'her coach set'} (coach)` : GEAR_SETS[s].name}` }));
  return [
    { group: 'No set', options: [{ value: 'none', label: 'No gear' }, { value: 'leg', label: 'Best Legendary (no set)' }] },
    { group: 'Legendary set ×5', options: setRow('leg') },
    { group: 'UR set ×5', options: setRow('ur') },
    { group: 'LR set (Set LR ×5)', options: setRow('lr') },
    { group: 'Blank LR', options: [{ value: 'blank', label: 'Blank LR ×5' }] },
  ];
}
/** The build controls: level, Potential, awakening, LR, gear. `onChange(patch)`. */
function buildControls(b, onChange, { unitId = null, prefix = 'sandbox-build' } = {}) {
  const levels = [...new Set([...SANDBOX_LEVEL_PICKS, ...Array.from({ length: 85 }, (_, i) => 85 - i)])].sort((x, y) => y - x);
  const pMin = potentialForLevel(b.level);
  const lrUnit = unitId ? isLegendUnit(unitId) : true;
  return h('div.sbx-build',
    selectRow('Level', b.level, levels.map((l) => ({ value: l, label: `Lv ${l}${SANDBOX_LEVEL_PICKS.includes(l) && l >= 60 ? ` (P${potentialForLevel(l)}+)` : ''}` })), (v) => onChange({ level: Number(v), p: Math.max(b.p, potentialForLevel(Number(v))) }), `${prefix}-level`),
    selectRow('Potential', b.p, [1, 2, 3, 4, 5, 6].map((p) => ({ value: p, label: `P${p}${p < pMin ? ' (too low)' : ''}` })), (v) => onChange({ p: Math.max(pMin, Number(v)) }), `${prefix}-p`),
    selectRow('Awakening', b.stars, [5, 4, 3, 2, 1, 0].map((s) => ({ value: s, label: `★${s}` })), (v) => onChange({ stars: Number(v) }), `${prefix}-stars`),
    lrUnit ? selectRow('Limit Break', b.lr ? 1 : 0, [{ value: 1, label: 'LR' }, { value: 0, label: 'Off' }], (v) => onChange({ lr: v === '1' }), `${prefix}-lr`) : null,
    selectRow('Gear', b.gear, gearOptions(unitId), (v) => onChange({ gear: v }), `${prefix}-gear`));
}

/** "Lv85 · P6 · ★5 · LR set" */
function buildShort(unitId, b) {
  const lr = sandboxIsLr(unitId, b);
  const gear = b.gear === 'none' ? 'no gear' : b.gear === 'leg' ? 'Legendary' : b.gear === 'blank' ? 'Blank LR' : `${b.gear.startsWith('lr') ? 'LR' : b.gear.startsWith('ur') ? 'UR' : 'Leg'} set`;
  return `Lv${b.level} · P${b.p} · ★${b.stars}${lr ? ' · LR' : ''} · ${gear}`;
}

function openGirlBuild(unitId, choice, redraw) {
  const own = !!choice.builds[unitId];
  let b = buildFor(unitId, choice.build, choice.builds);
  const holder = h('div');
  const paint = () => holder.replaceChildren(
    h('p.muted.sbx-girl-note', own || choice.builds[unitId] ? 'Her own build (the squad build no longer applies to her).' : 'Following the squad build. Change anything to give her her own.'),
    buildControls(b, (patch) => { b = normalizeBuild({ ...b, ...patch }); choice.builds[unitId] = b; saveChoice(choice); paint(); redraw(); }, { unitId, prefix: 'sandbox-girl' }),
    h('p.muted.sbx-girl-gear', gearPresetLabel(b.gear, unitId)));
  paint();
  modal({
    title: `${UNIT_MAP[unitId].name} · build`,
    body: holder,
    cls: 'sbx-girl-modal',
    actions: [
      { label: 'Same as squad', kind: 'ghost', testid: 'sandbox-girl-reset', onClick: (close) => { delete choice.builds[unitId]; saveChoice(choice); redraw(); close(); } },
      { label: 'Done', kind: 'primary', testid: 'sandbox-girl-done' },
    ],
  });
}

function teamStep(choice, redraw) {
  const profile = store.profile;
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
  const slot = (id, kind) => {
    if (!id) return h('button.mb-fslot', { onclick: () => { pick.kind = kind; redraw(); } }, '+');
    const b = buildFor(id, choice.build, choice.builds);
    return h('div.sbx-slot',
      h('button.mb-fslot.filled', { title: `Remove ${UNIT_MAP[id].name}`, 'data-unit': id, onclick: () => toggle(id) },
        svgEl(portraitHTML(UNIT_MAP[id], 'card'), 'unit-card-art'),
        h('span.mb-fslot-x', '×'),
        isOwned(profile, id) ? null : h('span.sbx-trial', 'Trial'),
        sandboxIsLr(id, b) ? h('span.sbx-lr', 'LR') : null,
        h('div.mb-fslot-name', UNIT_MAP[id].name, h('span', { style: 'opacity:.8;font-weight:700' }, ` Lv${b.level}`))),
      h(`button.sbx-slot-build${choice.builds[id] ? '.own' : ''}`, { 'data-testid': `sandbox-build-${id}`, title: buildShort(id, b), onclick: () => openGirlBuild(id, choice, redraw) },
        svgEl(uiIcon('settings'), 'ma-inline-icon'), choice.builds[id] ? 'Own' : 'Build'));
  };
  const start = () => {
    const f = sandboxFormation(choice.towers, choice.hero);
    if (!f.towers.length && !f.hero) {
      toast('Pick at least one girl first.', 'bad');
      return;
    }
    saveChoice(choice);
    navigate('battle', battleParams(choice, f));
  };
  // sticky: Start stays in reach while the roster scrolls
  const bar = h('div.sbx-bar',
    h('div.sbx-bar-info',
      h('span.sbx-badge', 'SANDBOX'),
      h('b.sbx-bar-map', runTitle(choice)),
      h('span.sbx-bar-diff', runLine(choice))),
    h('div.sbx-bar-actions',
      button('Change stage', { kind: 'ghost', small: true, icon: 'map', onClick: () => navigate('sandbox') }),
      button('Start sandbox', { kind: 'yellow', icon: 'play', testid: 'sandbox-start', onClick: start })));
  const squadBuild = h('section.mb-card.sbx-squad-build', { 'data-testid': 'sandbox-squad-build' },
    h('div.sbx-squad-head',
      h('h3.mb-card-title', 'Squad build'),
      button('Max everything', { kind: 'ghost', small: true, testid: 'sandbox-build-max', onClick: () => { choice.build = normalizeBuild(SANDBOX_MAX_BUILD); saveChoice(choice); redraw(); } })),
    buildControls(choice.build, (patch) => { choice.build = normalizeBuild({ ...choice.build, ...patch }); saveChoice(choice); redraw(); }),
    h('p.muted.sbx-build-note', `${gearPresetLabel(choice.build.gear)}. Gear here is virtual: main stats from each girl's Build Coach, every line at its best roll, every ✦ and pin. Nothing is added to your bag.`));
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
      h('span.muted', 'Every girl in the game, owned or not. Each joins with the squad build unless she has her own.')),
    h('div.mb-pick-grid', { 'data-testid': 'sandbox-roster' }, list.map((u) => {
      const b = buildFor(u.id, choice.build, choice.builds);
      const card = unitCard(u.id, { variant: 'tall', level: b.level, awaken: b.stars, owned: true, onClick: () => toggle(u.id) });
      card.dataset.testid = `sandbox-unit-${u.id}`;
      return h(`div.mb-pick${team.includes(u.id) ? '.in' : ''}`,
        card,
        team.includes(u.id) ? h('span.mb-pick-check', svgEl(uiIcon('check'))) : null,
        isOwned(profile, u.id) ? null : h('span.sbx-trial', 'Trial'),
        sandboxIsLr(u.id, b) ? h('span.sbx-lr', 'LR') : null);
    })));
  return h('div.ma-wrap.sbx-wrap.sbx-team', bar, rulesStrip(), squad, squadBuild, picker);
}
