// Battle modes and map rules on stage prep and the campaign map (docs/specs/CODEX_MODES.md §8.1,
// §8.2): the Map rule panel, the Battle mode grid, the reward line, ribbon corners, thumb marks.
// Kept apart from stage.js / campaign.js so the feature stays one separable piece.
import '../styles/modes.css';
import { h, svgEl, panel } from '../components.js';
import { MODE_ORDER, modeId } from '../../data/modes.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { MODE_TEXT, modeText, modeDesc } from '../text/modes.js';
import { RULE_TEXT, ruleCycleLabel, ruleHasMarks } from '../text/rules.js';
import { modeIcon, ruleIcon, ruleColor, uiIcon } from '../../art/icons.js';
import { stageMedals, modeRibbons, modesUnlocked, ribbonCount, bestDifficulty } from '../../systems/unlocks.js';

/** The mode prep opens on: the route's mode when it is playable here, else Standard. */
export function initialMode(profile, stage, params, endless) {
  if (endless || stage.kind !== 'campaign' || !modesUnlocked(profile, stage.id)) return 'standard';
  return modeId(params.mode);
}

/** Nightmare already has one heart: Last Petal there is Nightmare itself. */
export function modeMerged(difficulty, mode) {
  return difficulty === 'nightmare' && mode === 'laststand';
}

/** The mode a battle starts in (Nightmare × Last Petal plays Standard). */
export function playMode(difficulty, mode) {
  return modeMerged(difficulty, mode) ? 'standard' : mode;
}

/** "Start · Hard" / "Start · Hard · Goblin Rush". */
export function startLabel(difficulty, mode) {
  const d = DIFFICULTIES[difficulty].name;
  return mode && mode !== 'standard' && !modeMerged(difficulty, mode) ? `Start · ${d} · ${MODE_TEXT[mode].name}` : `Start · ${d}`;
}

/** Lives shown in the facts row. */
export function livesFor(difficulty, mode) {
  return mode === 'laststand' ? 1 : DIFFICULTIES[difficulty].lives;
}

/** The difficulty button's sub line under Last Petal. */
export function modeSubLine(base, difficulty, mode) {
  if (mode !== 'laststand' || difficulty === 'nightmare') return base;
  return base.replace(/,?\s*\d+ lives$/, '') + ', 1 heart (Last Petal)';
}

/** The difficulty button's corner while a mode is selected: the ribbon state for that difficulty. */
export function ribbonCorner(profile, stageId, difficulty, mode) {
  if (!mode || mode === 'standard') return null;
  const got = modeRibbons(profile, stageId)[`${difficulty}:${mode}`];
  return h(`span.ma-ribbon-corner${got ? '.on' : ''}`, { title: got ? 'Ribbon earned' : 'No ribbon yet' }, svgEl(uiIcon(got ? 'check' : 'star'), 'ma-ribbon-ico'), got ? '' : 'Ribbon');
}

/** Muted note under the medal gems while a mode is selected. */
export function firstClearNote(mode) {
  return mode && mode !== 'standard' ? h('p.muted.ma-mode-fc-note', 'Battle modes earn ribbons, not medals or medal gems.') : null;
}

/** Reward line: shown when a mode is selected above your best Standard medal here. */
export function rewardLine(profile, stage, difficulty, mode) {
  if (!mode || mode === 'standard' || modeMerged(difficulty, mode)) return null;
  const best = bestDifficulty(profile, stage.id) ?? 'easy';
  if (DIFFICULTY_ORDER.indexOf(difficulty) <= DIFFICULTY_ORDER.indexOf(best)) return null;
  return h('p.ma-mode-reward', { 'data-testid': 'mode-reward-line' }, svgEl(uiIcon('info'), 'ma-inline-icon'),
    `Drops as ${DIFFICULTIES[best].name}: beat ${DIFFICULTIES[difficulty].name} in Standard here for ${DIFFICULTIES[difficulty].name} drops.`);
}

/** The Map rule panel (null on stages without a rule). */
export function rulePanel(stage) {
  const rule = stage.rule;
  const t = rule && RULE_TEXT[rule.id];
  if (!t) return null;
  const body = h('div.ma-rule',
    h('div.ma-rule-head',
      svgEl(ruleIcon(rule.id), 'ma-rule-icon'),
      h('div.ma-rule-text',
        h('div.ma-rule-name-row', h('b.ma-rule-name', t.name), h(`span.ma-rule-chip${rule.cycle ? '' : '.always'}`, ruleCycleLabel(rule))),
        h('p.ma-rule-desc', t.desc),
        ruleHasMarks(rule) ? h('p.muted.ma-rule-hint', 'Glowing marks on the map show where.') : null,
      ),
    ),
  );
  const more = h('button.ma-rule-more', { type: 'button', onclick: () => { body.classList.toggle('open'); more.textContent = body.classList.contains('open') ? 'Less' : 'More'; } }, 'More');
  body.appendChild(more);
  const p = panel('Map rule', body);
  p.classList.add('ma-rule-panel');
  p.dataset.testid = 'rule-panel';
  return p;
}

/** Vents and pads drawn over the stage thumb (same fit as stageThumbSVG). */
export function ruleMarksSVG(map, rule, width, height) {
  if (!map || !ruleHasMarks(rule)) return '';
  const W = map.width || 20;
  const H = map.height || 12;
  const t = Math.min(width / W, height / H);
  const ox = (width - W * t) / 2;
  const oy = (height - H * t) / 2;
  const n = (v) => Math.round(v * 10) / 10;
  let s = '<g class="ma-rule-marks">';
  for (const z of rule.zones || []) s += `<circle cx="${n(ox + z.x * t)}" cy="${n(oy + z.y * t)}" r="${n(z.r * t)}" fill="rgba(255,120,40,0.18)" stroke="#ff7a1f" stroke-width="2.5" stroke-dasharray="5 3"/>`;
  for (const p of rule.pads || []) s += `<circle cx="${n(ox + p.x * t)}" cy="${n(oy + p.y * t)}" r="${n(p.r * t)}" fill="rgba(60,220,255,0.35)" stroke="#16c6e8" stroke-width="2.5"/><circle cx="${n(ox + p.x * t)}" cy="${n(oy + p.y * t)}" r="${n(p.r * t * 0.35)}" fill="#e9fdff"/>`;
  return `${s}</g>`;
}

/** Adds the rule marks to a stage thumb's markup. */
export function withRuleMarks(svg, map, rule, width, height) {
  const marks = ruleMarksSVG(map, rule, width, height);
  return marks ? svg.replace(/<\/svg>\s*$/, `${marks}</svg>`) : svg;
}

/** The Battle mode panel: 3 × 2 cards, ribbon state, the selected card's text and the reward line. */
export function modePanel(profile, stage, state, onPick) {
  const unlocked = modesUnlocked(profile, stage.id);
  const count = ribbonCount(profile, stage.id);
  const head = h('div.ma-mode-head', h('span.ma-mode-count', { 'data-testid': 'ribbon-count' }, `Ribbons ${count.have}/${count.total}`));
  if (!unlocked) {
    const p = panel('Battle mode', head, h('div.ma-mode-locked', { 'data-testid': 'modes-locked' }, svgEl(uiIcon('lock'), 'ma-inline-icon'), 'Clear this stage once to unlock battle modes.'));
    p.classList.add('ma-mode-panel');
    return p;
  }
  const medals = stageMedals(profile, stage.id);
  const ribbons = modeRibbons(profile, stage.id);
  const d = state.difficulty;
  const grid = h('div.ma-modes', { role: 'radiogroup', 'aria-label': 'Battle mode' });
  for (const id of MODE_ORDER) {
    const t = MODE_TEXT[id];
    const merged = modeMerged(d, id);
    const earned = id === 'standard' ? medals[d] : ribbons[`${d}:${id}`];
    const status = merged ? 'Same as Nightmare: earned with its medal'
      : id === 'standard' ? (earned ? `${DIFFICULTIES[d].name} medal ✓` : `${DIFFICULTIES[d].name} medal: not yet`)
        : earned ? 'Ribbon ✓' : 'No ribbon yet';
    const sel = state.mode === id;
    const card = h(`button.ma-mode${sel ? '.active' : ''}${merged ? '.merged' : ''}${earned ? '.earned' : ''}`, {
      type: 'button',
      role: 'radio',
      'aria-checked': sel ? 'true' : 'false',
      'data-testid': `mode-${id}`,
      disabled: merged,
      title: merged ? status : t.name,
      onclick: () => onPick(id),
    },
    svgEl(modeIcon(id), 'ma-mode-icon'),
    h('span.ma-mode-name', h('span.ma-mode-full', t.name), h('span.ma-mode-short', t.short)),
    h('span.ma-mode-desc', modeDesc(id, stage, d)),
    h('span.ma-mode-status', status),
    h('span.ma-mode-dot', { title: earned ? 'Earned' : 'Not yet' }),
    sel ? h('span.ma-mode-check', svgEl(uiIcon('check'))) : null);
    card.style.setProperty('--mode', t.color);
    grid.appendChild(card);
  }
  const selText = modeText(state.mode);
  const p = panel(
    'Battle mode',
    head,
    grid,
    h('p.ma-mode-sel', { 'data-testid': 'mode-selected-text' }, h('b', `${selText.name}: `), modeDesc(state.mode, stage, d)),
    rewardLine(profile, stage, d, state.mode),
  );
  p.classList.add('ma-mode-panel');
  return p;
}

/** Campaign stage card chips: the rule chip (icon + name; icon only on phones) and "Ribbons n/20". */
export function stageCardRuleChip(stage) {
  const t = stage.rule && RULE_TEXT[stage.rule.id];
  if (!t) return null;
  const chip = h('span.ma-sc-rule', { title: `Map rule: ${t.name}`, 'data-testid': `rule-chip-${stage.id}` }, svgEl(ruleIcon(stage.rule.id), 'ma-sc-rule-icon'), h('span.ma-sc-rule-name', t.name));
  chip.style.setProperty('--rule', ruleColor(stage.rule.id));
  return chip;
}

export function stageCardRibbons(profile, stage) {
  if (stage.kind !== 'campaign' || !modesUnlocked(profile, stage.id)) return null;
  const c = ribbonCount(profile, stage.id);
  return h('span.ma-sc-ribbons', { 'data-testid': `ribbons-${stage.id}` }, `Ribbons ${c.have}/${c.total}`);
}
