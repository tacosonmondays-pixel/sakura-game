// Teams and gear loadouts on screen (docs/specs/GEAR_UPDATE.md §7, §11.1; milestone M1): the team chips 1–5
// (Formation, Stage Prep, the co-op room), the Loadout A · B · C chips (the girl page's Equipment tab), the
// "Takes Keen Charm from Aoi" list before a switch that moves pieces between girls, and Undo after it.
// The rules live in src/systems/teams.js; this file only draws them. Styles: src/ui/styles/teams.css (.tb-*).
import './styles/teams.css';
import { h, modal, toast } from './components.js';
import { store } from '../core/store.js';
import { UNIT_MAP } from '../data/units.js';
import {
  TEAM_COUNT, PRESET_COUNT, TEAM_NAME_MAX, getTeams, getPresets, teamName, teamMembers, presetLetter, planTeam, lentPieces,
  planPreset, selectTeam, usePreset, copyPreset, copyTeam, renameTeam, restoreLoadouts, takeLines, teamClashes,
} from '../systems/teams.js';
import { ico, secondaryBtn } from './kit.js';

/** "Team 2" (or its name on this device) for the active team. */
export function activeTeamName(profile = store.profile) {
  const t = getTeams(profile);
  return teamName(t.list[t.active], t.active);
}

/**
 * A switch that moves pieces between girls lists them first, with any piece two members name (the first in team
 * order gets it): Switch / Cancel. Resolves true to go ahead. `to`: "to this team" or "to her Loadout B".
 */
function confirmTakes(takes, { title, ok, to = 'to this team', clashes = [] }) {
  if (!takes.length && !clashes.length) return Promise.resolve(true);
  const lines = takeLines(store.profile, takes);
  return new Promise((resolve) => {
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title,
      cls: 'tb-takes-modal',
      body: h('div.tb-takes',
        lines.length ? [h('p', `These pieces move ${to}:`), h('ul.tb-take-list', { 'data-testid': 'takes-list' }, lines.map((l) => h('li', l)))] : null,
        clashes.length ? h('ul.tb-take-list.tb-clash-list', { 'data-testid': 'clash-list' }, clashes.map((c) => h('li', clashLine([c])))) : null),
      actions: [
        { label: 'Cancel', kind: 'ghost', testid: 'takes-cancel', onClick: (c) => { settle(false); c(); } },
        { label: ok, kind: 'primary', testid: 'takes-ok', onClick: (c) => { settle(true); c(); } },
      ],
      onClose: () => settle(false),
    });
  });
}

/** The live Undo notice: a newer one retires it (its snapshot would undo the newer change too; review r1 L2). */
let liveUndo = null;

/** A notice with Undo (it stays a little longer, so there is time to tap it). */
function undoToast(text, snap, onUndo) {
  if (liveUndo?.isConnected) liveUndo.remove();
  let used = false;
  const btn = h('button.tb-undo', {
    type: 'button', 'data-testid': 'team-undo',
    onclick: () => {
      if (used) return;
      used = true;
      restoreLoadouts(store.profile, snap);
      store.commit('teams');
      t.classList.add('out');
      toast('Switched back', 'info');
      onUndo?.();
    },
  }, ico('refresh'), 'Undo');
  const t = toast(h('span.tb-toast', h('span', text), btn), 'good', 4200);
  t.classList.add('tb-toast-host');
  liveUndo = t;
  return t;
}

/**
 * Make team t active (the formation and each member's loadout), after the list of pieces it takes.
 * @returns {Promise<boolean>} true when it switched
 */
export async function switchTeam(t, onDone) {
  const profile = store.profile;
  const teams = getTeams(profile);
  if (t === teams.active) return false;
  const plan = planTeam(profile, t);
  const name = teamName(teams.list[t], t);
  if (!(await confirmTakes(plan.takes, { title: `Switch to ${name}?`, ok: 'Switch', clashes: plan.clashes }))) return false;
  const res = selectTeam(profile, t);
  if (!res.ok) return false;
  store.commit('teams');
  const home = res.returns?.length ? ` ${res.returns.length === 1 ? `${profile.gear[res.returns[0].uid]?.name || 'A piece'} went back to ${UNIT_MAP[res.returns[0].to]?.name}.` : `${res.returns.length} lent pieces went back to their girls.`}` : '';
  undoToast(`${name} is on.${res.clashes.length ? ` ${clashLine(res.clashes)}` : ''}${home}`, res.undo, onDone);
  onDone?.();
  return true;
}

function clashLine(clashes) {
  const c = clashes[0];
  return `${UNIT_MAP[c.kept]?.name} gets ${store.profile.gear[c.uid]?.name || 'a piece'} (${UNIT_MAP[c.lost]?.name}'s loadout names it too).`;
}

/**
 * The team chips 1–5. The active team is the selected chip; an empty team is dashed. A tap switches.
 * @param {{ onSwitched?: Function, names?: boolean, testid?: string, label?: string|null }} o
 *   names: chips say "Team 2" (else just "2", with the name in the label)
 */
export function teamChips({ onSwitched = null, names = false, testid = 'team-chips', label = 'Team', beforeSwitch = null } = {}) {
  const profile = store.profile;
  const teams = getTeams(profile);
  return h('div.tb-chips', { role: 'group', 'aria-label': 'Saved teams', 'data-testid': testid },
    label ? h('span.lbl.tb-chips-lbl', label) : null,
    teams.list.map((team, i) => {
      const on = i === teams.active;
      const n = teamMembers(team).length;
      const nm = teamName(team, i);
      return h(`button.ui-opt.tb-chip${on ? '.on' : ''}${n ? '' : '.empty'}`, {
        type: 'button', 'data-testid': `team-${i + 1}`, 'aria-pressed': on ? 'true' : 'false',
        title: n ? `${nm}: ${n} girl${n === 1 ? '' : 's'}` : `${nm}: empty`,
        'aria-label': `${nm}${n ? `, ${n} girl${n === 1 ? '' : 's'}` : ', empty'}${on ? ', in use' : ''}`,
        onclick: () => { if (i !== teams.active) beforeSwitch?.(); switchTeam(i, onSwitched); },
      }, names ? nm : String(i + 1));
    }));
}

/** The Formation bar: the chips, then Rename and Copy (Clear is the squad's own button). */
export function teamBar({ onChange = null } = {}) {
  const profile = store.profile;
  const teams = getTeams(profile);
  const t = teams.active;
  const clashes = teamClashes(profile, t);
  return h('div.tb-bar', { 'data-testid': 'team-bar' },
    teamChips({ onSwitched: onChange }),
    h('span.tb-name', { 'data-testid': 'team-name' }, teamName(teams.list[t], t)),
    clashes.size ? h('span.tb-clash', { 'data-testid': 'team-clash', title: 'Two girls in this team name the same piece: the first in team order gets it' }, ico('info'), `${clashes.size} shared piece${clashes.size === 1 ? '' : 's'}`) : null,
    h('span.tb-gap'),
    secondaryBtn('Rename', { icon: 'idcard', testid: 'team-rename', cls: 'tb-btn', onClick: () => openRename(t, onChange) }),
    secondaryBtn('Copy', {
      icon: 'clipboard', testid: 'team-copy', cls: 'tb-btn',
      disabled: !teamMembers(teams.list[t]).length,
      reason: 'This team is empty',
      onClick: () => {
        const to = copyTeam(profile, t);
        if (to < 0) { toast('Every team has girls. Clear one first.', 'bad'); return; }
        store.commit('teams');
        toast(`Copied to ${teamName(getTeams(profile).list[to], to)}`, 'good');
        onChange?.();
      },
    }));
}

function openRename(t, onChange) {
  const profile = store.profile;
  const team = getTeams(profile).list[t];
  const input = h('input', { type: 'text', 'data-testid': 'team-rename-in', maxlength: TEAM_NAME_MAX, value: team.name || '', placeholder: `Team ${t + 1}`, 'aria-label': 'Team name', autocomplete: 'off', spellcheck: false });
  const done = (close) => {
    renameTeam(profile, t, input.value);
    store.commit('teams');
    close();
    onChange?.();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(m.close); });
  const m = modal({
    title: 'Rename team',
    cls: 'tb-rename-modal',
    body: h('div.tb-rename', h('label.ui-input.tb-rename-in', input), h('p.tb-note', 'The name stays on this device.')),
    actions: [
      { label: 'Cancel', kind: 'ghost', testid: 'team-rename-cancel' },
      { label: 'Save', kind: 'primary', testid: 'team-rename-ok', onClick: done },
    ],
  });
  setTimeout(() => input.focus(), 0);
}

/** A small "Team 2" chip that opens the chips (Stage Prep beside Start, the co-op hub): "Team: Bosses" when renamed. */
export function teamChip({ onSwitched = null, testid = 'team-chip', locked = false } = {}) {
  const t = getTeams(store.profile);
  const custom = teamName(t.list[t.active], t.active);
  const name = custom === `Team ${t.active + 1}` ? custom : `Team: ${custom}`;
  return h(`button.ui-chip.tb-team-chip${locked ? '.locked' : ''}`, {
    type: 'button', 'data-testid': testid, disabled: locked,
    title: locked ? `${name} (you are Ready)` : `${name}: tap to switch team`,
    'aria-label': locked ? `${name}, locked while Ready` : `${name}. Switch team`,
    onclick: () => openTeamPicker(onSwitched),
  }, ico('students'), h('span', name));
}

/** The team chips in a small sheet. */
export function openTeamPicker(onSwitched) {
  const m = modal({
    title: 'Switch team',
    cls: 'tb-pick-modal',
    // (review r2 L4: the picker closes before the switch's confirm opens over it)
    body: h('div.tb-pick', teamChips({ names: true, label: null, testid: 'team-pick', beforeSwitch: () => m.close(), onSwitched: () => onSwitched?.() }),
      h('p.tb-note', 'Each team remembers its girls and which loadout each one uses.')),
    actions: [{ label: 'Close', kind: 'ghost', testid: 'team-pick-close' }],
  });
  return m;
}

// ---------------------------------------------------------------------------
// Loadouts (the girl page's Equipment tab)
// ---------------------------------------------------------------------------

/**
 * Loadout A · B · C for one girl. The one she wears is selected; a loadout whose piece was salvaged has a red dot;
 * the next free letter adds a loadout (a copy of the one she wears). "Copy A → B" is one tap.
 */
export function loadoutChips(unitId, { onChange = null } = {}) {
  const profile = store.profile;
  const { presets, preset } = getPresets(profile, unitId);
  const name = UNIT_MAP[unitId]?.name || unitId;
  const go = async (n) => {
    const plan = planPreset(profile, unitId, n);
    // the worn loadout again: only to take back a piece a team switch lent to another girl
    if (n === preset && !plan.takes.length) return;
    if (!(await confirmTakes(plan.takes, { title: n === preset ? `Take back Loadout ${presetLetter(n)}'s pieces?` : `Put on Loadout ${presetLetter(n)}?`, ok: 'Switch', to: `to her Loadout ${presetLetter(n)}` }))) return;
    const res = usePreset(profile, unitId, n);
    if (!res.ok) return;
    store.commit('teams');
    const home = res.returns?.length ? ` ${res.returns.map((r) => `${profile.gear[r.uid]?.name || 'A piece'} went back to ${UNIT_MAP[r.to]?.name}`).join('; ')}.` : '';
    undoToast(`${res.created ? `Loadout ${presetLetter(n)} added: a copy of ${presetLetter(preset)}` : n === preset ? `${name} took her pieces back` : `${name} wears Loadout ${presetLetter(n)}`}.${home}`, res.undo, onChange);
    onChange?.();
  };
  // "Copy A → B": into her next loadout (adding one is the + chip's job)
  const next = (preset + 1) % presets.length;
  const lent = lentPieces(profile, unitId);
  const row = h('div.tb-loadouts', { role: 'group', 'aria-label': 'Gear loadouts', 'data-testid': 'loadouts' },
    h('span.lbl.tb-chips-lbl', 'Loadout'),
    presets.map((pr, n) => h(`button.ui-opt.tb-chip.tb-lo${n === preset ? '.on' : ''}`, {
      type: 'button', 'data-testid': `loadout-${presetLetter(n)}`, 'aria-pressed': n === preset ? 'true' : 'false',
      'aria-label': `Loadout ${presetLetter(n)}${n === preset ? ', worn' : ''}${pr.gone ? ', a piece was salvaged' : ''}`,
      onclick: () => go(n),
    }, presetLetter(n), pr.gone ? h('span.tb-dot', { 'aria-hidden': 'true', 'data-testid': `loadout-${presetLetter(n)}-gone` }) : null)),
    presets.length < PRESET_COUNT ? h('button.ui-opt.tb-chip.tb-lo.tb-add', {
      type: 'button', 'data-testid': `loadout-${presetLetter(presets.length)}`,
      'aria-label': `Add Loadout ${presetLetter(presets.length)}`, title: `Add Loadout ${presetLetter(presets.length)} (a copy of ${presetLetter(preset)})`,
      onclick: () => go(presets.length),
    }, ico('plus'), presetLetter(presets.length)) : null,
    presets.length > 1 ? h('button.ui-ghost.tb-copy', {
      type: 'button', 'data-testid': 'loadout-copy', title: `Copy Loadout ${presetLetter(preset)} into ${presetLetter(next)}`,
      onclick: async () => {
        const res = copyPreset(profile, unitId, preset, next);
        if (!res.ok) return;
        store.commit('teams');
        undoToast(`Loadout ${presetLetter(preset)} copied to ${presetLetter(next)}`, res.undo, onChange);
        onChange?.();
      },
    }, `Copy ${presetLetter(preset)} → ${presetLetter(next)}`) : null);
  if (!lent.length) return row;
  // pieces a team switch lent to another girl: they come back when her loadout or team goes on, or when the next team
  // does not use them
  // (review r2 L3: the note is the way to take them back, not the already-selected chip)
  return h('div.tb-loadouts-wrap', row, h('div.tb-lent', { 'data-testid': 'loadout-lent' }, ico('info'),
    h('span', lent.map((l) => `${profile.gear[l.uid]?.name || 'A piece'} lent to ${UNIT_MAP[l.to]?.name || l.to}`).join(' · ')),
    h('button.ui-ghost.tb-takeback', { type: 'button', 'data-testid': 'loadout-take-back', onclick: () => go(preset) }, 'Take back')));
}

/** The members of the active team who name a piece another member names too (Formation marks their tiles). */
export function clashMembers() {
  const p = store.profile;
  const out = new Set();
  for (const ids of teamClashes(p, getTeams(p).active).values()) for (const id of ids) out.add(id);
  return out;
}

/** A squad tile's mark: she names a piece another girl in this team names too. */
export function clashBadge() {
  return h('span.tb-clash-badge', { 'data-testid': 'squad-clash', title: 'Another girl in this team names the same piece: the first in team order gets it', 'aria-label': 'Shares a piece' }, ico('info'));
}

/** The loadout letter on a squad tile when it is not A (null for A). */
export function loadoutBadge(n) {
  return n > 0 ? h('span.tb-lo-badge', { 'data-testid': 'squad-loadout', title: `Loadout ${presetLetter(n)}`, 'aria-label': `Loadout ${presetLetter(n)}` }, presetLetter(n)) : null;
}

export { TEAM_COUNT };
