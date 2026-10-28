// Battle modes and map rules in battle (docs/specs/CODEX_MODES.md §8.3, §8.4): the mode chip, the
// rule pill and its popover, rule warnings, toasts and banners, the scout's ⇄ and affinity chip,
// the cycle tint on the battle root and the board's gate arrows. Display only: everything is read
// from sim.ruleInfo(), sim.routeFlippedFor(n) and the sim's events; nothing here writes to the sim.
import '../styles/battle-modes.css';
import { h, icon } from './util.js';
import { svgEl } from '../components.js';
import { MODE_TEXT, modeText, ironcladArmor } from '../text/modes.js';
import { ruleTextFor, AFFINITY_NAMES, PAST_GOAL_LINE, laneClosedText } from '../text/rules.js';
import { ruleIcon, ruleColor, elementIcon, attackTypeIcon } from '../../art/icons.js';
import { ATTACK_TYPES, ELEMENTS } from '../../data/types.js';
import { capabilitySources } from '../../sim/report.js';

/** How many ACTIVE flips toast per battle (after that only the pill pulses). */
const FLIP_TOASTS = 2;

/** "Fire" icon for Shifting Stars' affinity (an element or an attack type). */
function affinityIcon(id, cls) {
  if (ELEMENTS[id]) return svgEl(elementIcon(id), cls);
  if (ATTACK_TYPES[id]) return svgEl(attackTypeIcon(id), cls);
  return null;
}

/**
 * Rule and mode warnings for wave n, appended after sim.waveWarnings(n) (controller warnFor and the
 * scout popover). Same shape as the sim's warnings.
 */
export function ruleWarnings(sim, n) {
  const out = [];
  if (!sim.mode) return out;
  if (sim.routeFlippedFor?.(n)) {
    out.push({ kind: 'route', severity: 'warn', text: `Wave ${n} comes in through the goal gate. Cover the far end too.` });
  }
  const aff = sim.ruleAffinityFor?.(n);
  if (aff) out.push({ kind: 'affinity', severity: 'info', text: `Shifting Stars: ${AFFINITY_NAMES[aff] || aff} hits +50% this wave.` });
  if (n === 1) {
    if (sim.mode.id === 'ironclad') {
      const { a, b } = ironcladArmor(sim.stage, sim.difficulty);
      let who = [];
      try {
        who = capabilitySources(sim, ['armorPen', 'armorShred']) || [];
      } catch {
        who = [];
      }
      const names = [...new Set((Array.isArray(who) ? who : []).map((w) => sim.data.unit(w?.unitId ?? w)?.name).filter(Boolean))].slice(0, 3);
      out.push({ kind: 'mode', severity: 'warn', text: `Ironclad: every enemy has +${a} armor (bosses +${b}). Armor Pierce and Armor Break pay off.${names.length ? ` In your formation: ${names.join(', ')}.` : ''}` });
    } else if (sim.mode.id === 'laststand') {
      out.push({ kind: 'mode', severity: 'danger', text: 'Last Petal: one heart. Any leak ends the battle.' });
    }
  }
  return out;
}

/**
 * Results: the ribbon row that replaces the medal row on a mode win (and the Nightmare medal's
 * merged Last Petal ribbon), with "Win in Standard for the Hard medal." while that medal is missing.
 * Null for Standard wins without a new ribbon, co-op and practice runs.
 */
export function resultRibbonRow(out, sim, profile) {
  if (!out || out.coop || out.practice) return null;
  const diff = sim.diff?.name || sim.difficulty;
  if (out.mode && out.mode !== 'standard') {
    const name = MODE_TEXT[out.mode]?.name || out.mode;
    const medal = !!profile?.progress?.stages?.[sim.stageId]?.[sim.difficulty];
    return h('div.bt-ribbon-row', { 'data-testid': 'result-ribbon' },
      h(`div.bt-ribbon${out.newRibbon ? '.new' : ''}`, out.newRibbon ? `${name} ribbon earned!` : `${name} · ${diff} cleared`),
      medal ? null : h('p.muted.bt-ribbon-note', `Win in Standard for the ${diff} medal.`));
  }
  if (out.newRibbon && sim.difficulty === 'nightmare') return h('div.bt-ribbon-row', { 'data-testid': 'result-ribbon' }, h('div.bt-ribbon.new', 'Last Petal ribbon earned!'));
  return null;
}

/** "Drops (Normal)" when a mode win paid below the difficulty played. */
export function dropsTitle(out, sim, base) {
  const r = out?.rewardDifficulty;
  if (!r || r === sim.difficulty) return base;
  const name = { easy: 'Easy', normal: 'Normal', hard: 'Hard', nightmare: 'Nightmare' }[r] || r;
  return `${base} (${name})`;
}

/** The pill's state line: "ACTIVE · 4 s" / "Resting · 9 s" / "Always on". */
function stateLine(info) {
  if (!info.cycle) return 'Always on';
  const s = Math.max(1, Math.ceil(info.secondsToFlip - 1e-6));
  return info.active && info.inWave ? `ACTIVE · ${s} s` : `Resting · ${s} s`;
}

/** The popover's state sentence. */
function stateSentence(info, t) {
  if (!info.cycle) return 'Always on.';
  const s = Math.max(1, Math.ceil(info.secondsToFlip - 1e-6));
  if (!info.inWave) return `Starts ${info.cycle[0] - info.cycle[1]} s into each wave.`;
  if (info.active) return `Active for ${s} more second${s === 1 ? '' : 's'}.`;
  return `Next ${t.activeWord || 'phase'} in ${s} s.`;
}

/**
 * @param {object} ctx battle context (controller.js)
 * @returns {{ chip: HTMLElement|null, pill: HTMLElement|null, update(): void, handle(ev): void,
 *   waveSub(ev): string|null, warnings(n): object[], flipped(n): boolean, scoutChip(n): HTMLElement|null,
 *   pauseRow(): HTMLElement|null, destroy(): void }}
 */
export function createModesBattle(ctx) {
  const { sim } = ctx;
  const mode = sim.mode?.id || 'standard';
  const mt = MODE_TEXT[mode];
  const ruleId = sim.rule?.id || null;
  // the rule's text, in the stage's own words when it has a skin (src/ui/text/rules.js)
  const rt = ruleId ? ruleTextFor(sim.stage, ruleId) : null;

  const chip = mode !== 'standard'
    ? h(`span.bt-mode.bt-mode-${mode}`, { 'data-testid': 'hud-mode', title: mt.name }, mt.short)
    : null;
  if (chip) chip.style.setProperty('--mode', mt.color);

  let pop = null;
  const pillIcon = rt ? svgEl(ruleIcon(ruleId), 'bt-rule-ico') : null;
  const pillName = h('span.bt-rule-name', rt?.name || '');
  const pillState = h('span.bt-rule-state');
  const pill = rt
    ? h('button.bt-rule', { type: 'button', 'data-testid': 'rule-pill', title: `Map rule: ${rt.name}`, onclick: () => togglePop() }, h('span.bt-rule-ring', pillIcon), pillName, pillState)
    : null;
  if (pill) pill.style.setProperty('--rule', ruleColor(ruleId));

  let flips = 0;
  let last = { active: null, s: null, inWave: null, wave: null };

  function togglePop(force) {
    const open = force ?? !pop;
    if (!open) {
      pop?.remove();
      pop = null;
      return;
    }
    pop = h('div.bt-rule-pop', { 'data-testid': 'rule-pop' });
    ctx.layer.append(pop);
    renderPop();
  }

  function renderPop() {
    if (!pop || !rt) return;
    const info = sim.ruleInfo();
    const n = sim.state === 'wave' ? sim.wave : sim.wave + 1;
    const lines = [];
    const aff = info.affinity || sim.ruleAffinityFor?.(n);
    if (aff) lines.push(h('div.bt-rule-line', affinityIcon(aff, 'bt-rule-line-ico'), 'This wave: ', h('b', AFFINITY_NAMES[aff] || aff), ' +50%'));
    for (const k of [n, n + 1]) {
      if (sim.routeFlippedFor?.(k)) {
        lines.push(h('div.bt-rule-line.warn', `Wave ${k} comes in through the `, h('b', 'goal gate')));
        break;
      }
    }
    if (info.pads.length) lines.push(h('div.bt-rule-line', 'Pads: ', h('b', `${info.pads.filter((p) => p.ownerUid != null).length} of ${info.pads.length}`), ' taken'));
    if (info.pastGoal) lines.push(h('div.bt-rule-line.muted', PAST_GOAL_LINE));
    pop.replaceChildren(
      h('div.bt-pop-head', h('span.bt-pop-title', svgEl(ruleIcon(ruleId), 'bt-rule-pop-ico'), rt.name), h('button.bt-x', { onclick: () => togglePop(false), title: 'Close' }, '×')),
      h('p.bt-rule-desc', rt.desc),
      h(`div.bt-rule-now${info.active && info.inWave && info.cycle ? '.on' : ''}`, stateSentence(info, rt)),
      ...lines,
      mode !== 'standard' ? h('div.bt-rule-line.bt-rule-mode', h('b', `${mt.name}: `), modeDescFor()) : null,
    );
  }

  function modeDescFor() {
    if (mode !== 'ironclad') return mt.desc;
    const { a, b } = ironcladArmor(sim.stage, sim.difficulty);
    return mt.desc.replace('{a}', a).replace('{b}', b);
  }

  function update() {
    // board: gate arrows for the running wave, or the coming one between waves. Reverse Route turns
    // the junction chevrons on any stage, so this runs with or without a map rule (pill)
    if (sim._pathsRev) {
      const next = sim.state === 'wave' ? sim.wave : sim.wave + 1;
      ctx.renderer?.setRouteFlipped?.(!!sim.routeFlippedFor?.(next), !!sim.routeReversedFor?.(next));
    }
    if (!pill) return;
    const info = sim.ruleInfo();
    const s = info.cycle ? Math.ceil(info.secondsToFlip - 1e-6) : 0;
    const on = !!(info.active && info.inWave && info.cycle);
    if (on !== last.active || s !== last.s || info.inWave !== last.inWave || sim.wave !== last.wave) {
      pillState.textContent = stateLine(info);
      pill.classList.toggle('on', on);
      pill.classList.toggle('always', !info.cycle);
      // conic ring: the share of the current phase already gone
      if (info.cycle) {
        const phase = on ? info.cycle[1] : info.cycle[0] - info.cycle[1];
        pill.style.setProperty('--p', String(Math.max(0, Math.min(1, 1 - info.secondsToFlip / phase))));
      }
      if (ctx.shell) {
        if (on) ctx.shell.dataset.ruleOn = ruleId;
        else delete ctx.shell.dataset.ruleOn;
      }
      last = { active: on, s, inWave: info.inWave, wave: sim.wave };
      renderPop();
    }
  }

  /** Toasts and banners for the sim's rule events. */
  function handle(ev) {
    const feed = ctx.feed;
    if (!feed || !rt) return;
    switch (ev.type) {
      case 'ruleState':
        if (ev.active && rt.toast) {
          flips++;
          if (flips <= FLIP_TOASTS) feed.push(rt.toast, 'info', { key: 'rule', ms: 2600 });
          else if (pill) {
            pill.classList.remove('bt-rule-pulse');
            void pill.offsetWidth;
            pill.classList.add('bt-rule-pulse');
          }
        }
        break;
      case 'ruleBonus':
        if (ev.kind === 'lives') feed.push(`${rt.name}: +${ev.amount} hearts`, 'good', { key: 'rule-lives', ms: 2400 });
        // co-op: each hero's recharge is its own event; the toast is for the viewing player's hero
        else if (ev.kind === 'ult' && (ev.towerUid == null || ev.towerUid === sim.hero?.uid)) feed.push(`${rt.name}: ultimate recharged!`, 'good', { key: 'rule-ult', ms: 2400 });
        break;
      case 'cash':
        if (ev.reason === 'rule') feed.push(`${rt.name}: +${ev.amount} coins`, 'good', { key: 'rule-cash', ms: 2400 });
        break;
      case 'waveStart':
        if (ev.wave === 1) feed.push(['Map rule: ', h('b', rt.name), `: ${rt.desc}`], 'info', { key: 'rule-intro', ms: 5200, icon: svgEl(ruleIcon(ruleId), 'bt-toast-ico') });
        break;
      default:
        break;
    }
  }

  /** The wave banner's sub line, when a mode or rule changes it (null = the usual one). */
  function waveSub(ev) {
    if (ev.flipped) return 'REAR AMBUSH: in through the goal gate!';
    // a lane schedule closed a lane this wave (Gate Arc: the crossing's barrier is down)
    if (Array.isArray(ev.lanes) && ev.lanes.length < (sim.pathData?.length ?? 0)) return laneClosedText(sim.stage);
    if (mode === 'reverse' && ev.wave === 1 && Number.isFinite(sim.totalWaves)) return `of ${sim.totalWaves} · Reverse Route`;
    return null;
  }

  function scoutChip(n) {
    const aff = sim.ruleAffinityFor?.(n);
    if (!aff) return null;
    return h('span.bt-chip.bt-affinity', { 'data-testid': 'scout-affinity', title: `Shifting Stars: ${AFFINITY_NAMES[aff] || aff} hits +50% this wave` }, affinityIcon(aff, 'bt-aff-ico'), '+50%');
  }

  /** The pause sheet's line: "Hard · Goblin Rush" and the rule row. */
  function pauseRow() {
    const diff = sim.diff?.name || sim.difficulty;
    return h('div.bt-pause-modes', { 'data-testid': 'pause-modes' },
      h('div.bt-pause-mode-line', `${diff}${mode !== 'standard' ? ` · ${mt.name}` : ''}`),
      rt ? h('div.bt-pause-rule', svgEl(ruleIcon(ruleId), 'bt-pause-rule-ico'), h('div', h('b', rt.name), h('div.muted', rt.desc))) : null);
  }

  /** The placement ghost's pad line at world (x, y), or null off the pads. */
  /** selfUid: the girl being moved (a hero's Move), whose own pad reads as free. */
  function padHint(x, y, selfUid = null) {
    if (!sim.rule?.pads?.length) return null;
    const info = sim.ruleInfo();
    const p = info.pads.find((q) => (q.x - x) ** 2 + (q.y - y) ** 2 <= q.r * q.r);
    if (!p) return null;
    if (p.ownerUid == null || (selfUid != null && p.ownerUid === selfUid)) return '+25% damage · +0.7 range';
    const owner = sim.getTower(p.ownerUid);
    return `Pad taken by ${owner?.def?.name || 'a girl'}`;
  }

  return {
    chip,
    pill,
    padHint,
    update,
    handle,
    waveSub,
    warnings: (n) => ruleWarnings(sim, n),
    flipped: (n) => !!sim.routeFlippedFor?.(n),
    scoutChip,
    pauseRow,
    modeName: () => modeText(mode).name,
    destroy() {
      togglePop(false);
      if (ctx.shell) delete ctx.shell.dataset.ruleOn;
    },
  };
}
