// Battle modes and map rules on stage prep and the campaign map (docs/specs/CODEX_MODES.md §8.1,
// §8.2): the Map rule panel, the Battle mode grid, the reward line, ribbon corners, thumb marks.
// Kept apart from stage.js / campaign.js so the feature stays one separable piece.
import '../styles/modes.css';
import { h, svgEl } from '../components.js';
import { MODE_ORDER, modeId } from '../../data/modes.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { MODE_TEXT, modeText, modeDesc } from '../text/modes.js';
import { ruleTextFor, ruleCycleLabel, ruleHasMarks } from '../text/rules.js';
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
  return h(`span.ma-ribbon-corner.stp-d-ribbon${got ? '.on' : ''}`, { title: got ? 'Ribbon earned' : 'No ribbon yet' }, svgEl(uiIcon(got ? 'check' : 'star'), 'stp-d-ribbon-ico'), got ? '' : 'Ribbon');
}

/** Muted note under the medal gems while a mode is selected. */
export function firstClearNote(mode) {
  return mode && mode !== 'standard' ? h('p.stp-p.desc.ma-mode-fc-note', 'Battle modes earn ribbons, not medals or medal gems.') : null;
}

/** Reward line: shown when a mode is selected above your best Standard medal here. */
export function rewardLine(profile, stage, difficulty, mode) {
  if (!mode || mode === 'standard' || modeMerged(difficulty, mode)) return null;
  const best = bestDifficulty(profile, stage.id) ?? 'easy';
  if (DIFFICULTY_ORDER.indexOf(difficulty) <= DIFFICULTY_ORDER.indexOf(best)) return null;
  return h('p.stp-p.stp-mode-reward.ma-mode-reward', { 'data-testid': 'mode-reward-line' }, svgEl(uiIcon('info'), 'stp-lock-ico'),
    `Drops as ${DIFFICULTIES[best].name}: beat ${DIFFICULTIES[difficulty].name} in Standard here for ${DIFFICULTIES[difficulty].name} drops.`);
}

/** The map rule as a section of the "i" sheet (null on stages without a rule): icon, name, when it runs, what it does. */
export function rulePanel(stage) {
  const rule = stage.rule;
  const t = rule && ruleTextFor(stage);
  if (!t) return null;
  const icon = svgEl(ruleIcon(rule.id), 'stp-rule-icon');
  icon.style.setProperty('--rule', ruleColor(rule.id));
  return h('section.stp-sec.ma-rule-panel', { 'data-testid': 'rule-panel' },
    h('h3.stp-sec-k', 'Map rule'),
    h('div.stp-rulebox',
      icon,
      h('div.stp-rule-text',
        h('div.stp-rule-name-row', h('b.stp-rule-name.ma-rule-name', t.name), h(`span.ui-chip.stp-rule-when${rule.cycle ? '.cycle' : ''}`, ruleCycleLabel(rule))),
        h('p.stp-p', t.desc),
        // a stage skin renamed the rule: say which shipped rule it is
        t.baseName ? h('p.stp-p.desc', { 'data-testid': 'rule-base-name' }, `The ${t.baseName} rule.`) : null,
        ruleHasMarks(rule) ? h('p.stp-p.desc', 'Glowing marks on the map show where.') : null)));
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

/**
 * The battle modes in the Mode sheet: the ribbon count, six cards (icon, name, what it does, its ribbon or medal
 * state), the selected mode's sentence and the reward line. Before the first clear: one lock line.
 */
export function modePanel(profile, stage, state, onPick) {
  const unlocked = modesUnlocked(profile, stage.id);
  const count = ribbonCount(profile, stage.id);
  const head = h('div.stp-sec-head', h('h3.stp-sec-k', 'Battle modes'),
    count.have || unlocked ? h('span.ui-chip.stp-ribbons', { 'data-testid': 'ribbon-count' }, `Ribbons ${count.have}/${count.total}`) : null);
  if (!unlocked) {
    return h('section.stp-sec.ma-mode-panel', head, h('p.stp-p.stp-lockline', { 'data-testid': 'modes-locked' }, svgEl(uiIcon('lock'), 'stp-lock-ico'), 'Clear this stage once to unlock battle modes.'));
  }
  const medals = stageMedals(profile, stage.id);
  const ribbons = modeRibbons(profile, stage.id);
  const d = state.difficulty;
  const grid = h('div.stp-mcards', { role: 'radiogroup', 'aria-label': 'Battle mode' });
  for (const id of MODE_ORDER) {
    const t = MODE_TEXT[id];
    const merged = modeMerged(d, id);
    const earned = id === 'standard' ? medals[d] : ribbons[`${d}:${id}`];
    const status = merged ? 'Same as Nightmare: earned with its medal'
      : id === 'standard' ? (earned ? `${DIFFICULTIES[d].name} medal ✓` : `${DIFFICULTIES[d].name} medal: not yet`)
        : earned ? 'Ribbon ✓' : 'No ribbon yet';
    const sel = state.mode === id;
    const icon = svgEl(modeIcon(id), 'stp-mcard-icon');
    icon.style.setProperty('--mode', t.color);
    grid.appendChild(h(`button.stp-mcard.ma-mode${sel ? '.on' : ''}${merged ? '.merged' : ''}${earned ? '.earned' : ''}`, {
      type: 'button',
      role: 'radio',
      'aria-checked': sel ? 'true' : 'false',
      'data-testid': `mode-${id}`,
      disabled: merged,
      title: merged ? status : t.name,
      onclick: () => onPick(id),
    },
    h('span.stp-mcard-head', icon, h('b.stp-mcard-name', t.name)),
    h('span.stp-mcard-desc', modeDesc(id, stage, d)),
    h(`span.stp-mcard-status${earned ? '.ok' : ''}`, status)));
  }
  const selText = modeText(state.mode);
  return h('section.stp-sec.ma-mode-panel',
    head,
    grid,
    h('p.stp-p.stp-mode-sel', { 'data-testid': 'mode-selected-text' }, h('b', `${selText.name}: `), modeDesc(state.mode, stage, d)),
    rewardLine(profile, stage, d, state.mode),
    firstClearNote(state.mode));
}

/** Campaign stage card chips: the rule chip (icon + name; icon only on phones) and "Ribbons n/20". */
export function stageCardRuleChip(stage) {
  const t = stage.rule && ruleTextFor(stage);
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
