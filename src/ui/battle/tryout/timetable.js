// Tryout Day's timetable strip (docs/specs/TRYOUT_DAY.md §13.4): the run map and its progress. Cells P1 … Final with
// the breaks between; a period cell shows its Subject (the chosen one, or the pair), ⟲ for History (the Back Gate), a
// Grade twist dot (Grade 8+, sim.tryout.affixes), after play its 3 assignment marks (stamp or strike), and a Double Dare
// flag. States: done, current (navy plate, yellow ring), upcoming (outline). In battle it shrinks to a thin band
// ("P3 · wave 2/4 · Science") over a row of tiny cells. The model is pure (it reads sim.tryout, never writes it).
import { h, enemyToken } from '../util.js';
import { TRYOUT } from '../../../data/tryout.js';
import { CHAPTERS, STAGE_MAP } from '../../../data/stages.js';
import { ENEMY_MAP, FAMILIES, enemyTraits } from '../../../data/enemies.js';
import { lengthOf, periodWaves, buildTryoutPlan, buildTryoutStage } from '../../../sim/tryout/plan.js';
import { powInt } from '../../../sim/waves.js';
import { onEscape, swallowNextClick } from '../../hold.js';
import {
  SUBJECT_TEXT, SUBJECT_ABBR, BREAK_SHORT, BREAK_NAMES, DARE_SHORT, DARE_TEXT, PREVIEW_TEXT as PV, TIMETABLE_TEXT as T,
} from '../../text/tryout.js';
import '../../styles/tryoutTimetable.css';

/** Our own drawing: a five-petal sakura stamp, filled with currentColor (a notch in each petal, a white heart). */
export const STAMP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor">${
  [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a} 12 12)" d="M12 11.4c-2.6-1.5-4-3.6-3.6-6 .3-1.7 1.6-2.7 2.6-2.4l1 1.4 1-1.4c1-.3 2.3.7 2.6 2.4.4 2.4-1 4.5-3.6 6z"/>`).join('')
}</g><circle cx="12" cy="12" r="1.9" fill="#fff"/></svg>`;

/** The period the run is in (playing) or heading to (between periods); 0 once the run is done. */
export function currentPeriod(ty, len) {
  if (ty.done) return 0;
  if (ty.base) return ty.period;
  const next = ty.started >= ty.period ? ty.period + 1 : ty.period;
  return next > len.periods ? 0 : next;
}

/**
 * The strip's cells, in order.
 * @param {object} ty sim.tryout
 * @param {object} len lengthOf(ty.length)
 * @param {{ mySlot?: number, win?: string|null }} [o] win: my window ('pick' | 'break' | null)
 * @returns {Array<{ kind: 'period', p: number, final: boolean, label: string, subjects: string[], chosen: string|null,
 *   backGate: boolean, affix: string|null, marks: number[]|null, resumed: boolean, dare: boolean, state: string }
 *   | { kind: 'break', after: number, id: string, label: string, state: string }>}
 */
export function timetableModel(ty, len, { mySlot = 0, win = null } = {}) {
  const cur = currentPeriod(ty, len);
  const me = ty.players?.[mySlot] || {};
  const log = new Map((ty.periods || []).map((x) => [x.period, x]));
  const out = [];
  for (let p = 1; p <= len.periods; p++) {
    const rec = log.get(p) || null;
    const state = rec || (cur === 0 || p < cur) ? 'done' : p === cur ? 'current' : 'upcoming';
    const pair = ty.subjects?.[p] || null;
    let chosen = null;
    if (rec) chosen = rec.subject || null;
    else if (p === cur && ty.base) chosen = ty.subject || null;
    else if (p === cur && pair?.includes(ty.nextSubject)) chosen = ty.nextSubject;
    const subjects = chosen ? [chosen] : pair ? pair.slice() : [];
    const dare = rec ? !!rec.dare : p === cur ? (ty.base ? !!ty.dare : !!me.dare) : false;
    const marks = rec ? [...(rec.team || []), ...(rec.own?.[mySlot] || [])].map(([, st]) => st) : null;
    out.push({
      kind: 'period', p, final: p === len.periods, label: p === len.periods ? T.final : T.cell(p), subjects, chosen,
      backGate: subjects.some((id) => TRYOUT.subjects?.[id]?.backGate), affix: ty.affixes?.[p] || null,
      marks, resumed: !!rec?.resumed, dare, state,
    });
    const b = len.breaks?.[p];
    if (b && p < len.periods) {
      // a break opens after period p's pick: current while it is open, done once period p+1 started or it closed
      let bs = 'upcoming';
      if (win === 'break' && ty.period === p && !ty.base) bs = 'current';
      else if (ty.started > p || cur === 0 || (ty.started === p && !ty.base && !win && log.has(p))) bs = 'done';
      out.push({ kind: 'break', after: p, id: b, label: BREAK_SHORT[b] || b, state: bs });
    }
  }
  return out;
}

/**
 * The thin band's words: "P3 · wave 2/4 · Science" while a period runs, "Next · P4" between periods.
 * @returns {{ label: string, wave: string|null, subject: string|null, subjectLine: string|null, next: boolean }}
 */
export function bandParts(ty, len, wave) {
  const cur = currentPeriod(ty, len);
  const p = cur || len.periods;
  const label = p >= len.periods ? T.final : T.cell(p);
  if (!ty.base) return { label, wave: null, subject: null, subjectLine: null, next: !!cur };
  const first = (p - 1) * len.wavesPerPeriod + 1;
  const done = Math.max(0, Math.min(len.wavesPerPeriod, wave - first + 1));
  const s = ty.subject ? SUBJECT_TEXT[ty.subject] : null;
  return { label, wave: `wave ${done}/${len.wavesPerPeriod}`, subject: s ? s.name : ty.subject || null, subjectLine: s?.line || null, next: false };
}

/** A cell's tooltip: what the cell says, in words. */
function cellTitle(c) {
  if (c.kind === 'break') return BREAK_NAMES[c.id] || c.label;
  const bits = [c.final ? 'Final Period' : `Period ${c.p}`];
  if (c.subjects.length) bits.push(c.subjects.map((id) => SUBJECT_TEXT[id]?.name || id).join(' or '));
  if (c.backGate) bits.push(T.backGate);
  if (c.affix) bits.push(T.affix(DARE_SHORT[c.affix] || c.affix));
  if (c.dare) bits.push(T.dare);
  if (c.marks) bits.push(`${c.marks.filter((m) => m === 1).length}/${c.marks.length} ${T.stamp}${c.resumed ? ` (${T.resumed})` : ''}`);
  return bits.join(' · ');
}

/** One assignment mark: a sakura stamp (locked in), a grey strike (missed; never red), an open ring (in play). */
export function markEl(st, cls = 'ty-mk') {
  const name = st === 1 ? T.stamp : st === -1 ? T.strike : T.open;
  return h(`i.${cls}.${st === 1 ? 'st' : st === -1 ? 'x' : 'o'}`, { 'aria-label': name, title: name, html: st === 1 ? STAMP_SVG : '' });
}

/**
 * The full strip (Before Class, the pick sheet): one row of cells. With `onCell` every cell is a button (tap, Enter or
 * Space) that calls onCell(cell, el): the preview (§13.4, attachPreview). `boss`: the Final boss's id, drawn as a
 * portrait cell at the end (Before Class, §13.3).
 * @param {ReturnType<typeof timetableModel>} cells
 * @param {{ testid?: string, cls?: string, onCell?: ((c: object, el: HTMLElement) => void)|null, boss?: string|null }} [o]
 */
export function timetableStrip(cells, { testid = 'ty-tt', cls = '', onCell = null, boss = null } = {}) {
  const live = typeof onCell === 'function';
  // (interactive: a group of buttons; read-only: a list)
  const tag = live ? 'button' : 'div';
  const attrs = (c, tid) => (live
    ? { type: 'button', title: cellTitle(c), 'data-testid': tid, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': cellTitle(c), onclick: (e) => onCell(c, e.currentTarget) }
    : { role: 'listitem', title: cellTitle(c), 'data-testid': tid });
  const items = cells.map((c) => {
    if (c.kind === 'break') {
      return h(`${tag}.ty-tt-brk.${c.state}`, attrs(c, `ty-tt-b${c.after}`), h('span', c.label));
    }
    const subj = c.subjects.map((id) => SUBJECT_ABBR[id] || SUBJECT_TEXT[id]?.name || id).join(' · ');
    return h(`${tag}.ty-tt-cell.${c.state}${c.final ? '.final' : ''}${c.foe ? `.foe-${c.foeTier}` : ''}`, attrs(c, `ty-tt-p${c.p}`),
      h('span.ty-tt-top',
        h('b.ty-tt-p', c.label),
        c.foe && c.foeTier === 'miniboss' ? h('span.ty-tt-crown', { 'aria-hidden': 'true', title: ENEMY_MAP[c.foe]?.name || c.foe }, '♛') : null,
        c.backGate ? h('span.ty-tt-gate', { 'aria-label': T.backGate }, '⟲') : null,
        c.affix ? h('i.ty-tt-affix', { 'aria-label': T.affix(DARE_SHORT[c.affix] || c.affix) }) : null,
        c.dare ? h('span.ty-tt-dare', { 'aria-label': T.dare }, '⚑') : null),
      subj ? h('span.ty-tt-subj', subj) : null,
      c.marks ? h('span.ty-tt-marks', ...c.marks.map((m) => markEl(m))) : null);
  });
  if (boss && ENEMY_MAP[boss]) {
    const fin = cells.find((c) => c.kind === 'period' && c.final);
    const name = ENEMY_MAP[boss].name;
    const label = `${PV.bossCell}: ${name}`;
    const cell = h(`${tag}.ty-tt-bosscell`, live && fin
      ? { type: 'button', title: label, 'aria-label': label, 'data-testid': 'ty-tt-boss', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: (e) => onCell(fin, e.currentTarget) }
      : { role: 'listitem', title: label, 'data-testid': 'ty-tt-boss' },
    bossArt(boss), h('span.ty-tt-bossname', name));
    items.push(cell);
  }
  return h(`div.ty-tt${live ? '.live' : ''}${cls ? `.${cls}` : ''}`, live
    ? { 'data-testid': testid, role: 'group', 'aria-label': `${T.label}. ${PV.hint}` }
    : { 'data-testid': testid, role: 'list', 'aria-label': T.label }, ...items);
}

/** After the page has settled: the browser's idle time (a short timer where there is none). */
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));

/**
 * The boss's portrait: the family token at once, the model still once the screen is idle (a lazy 3D still, cached: its
 * renderer never competes with the screen opening).
 */
function bossArt(id) {
  const box = h('span.ty-tt-bossart', { 'aria-hidden': 'true' }, enemyToken(id, { size: 34 }));
  if (typeof document !== 'undefined') {
    // (a memoised strip may be off the page for a moment, and back with the same box: the still lands either way)
    whenIdle(() => {
      import('../../online/bossArt.js').then((m) => m.bossPortrait(id, 128)).then((url) => {
        if (url) box.replaceChildren(h('img', { src: url, alt: '', loading: 'eager', decoding: 'async' }));
      }).catch(() => {});
    });
  }
  return box;
}

// ---- the plan's timetable (Before Class, and the previews in battle) --------------------------------------------

/** The traits a preview names (§13.4), in this order. */
export const PREVIEW_TRAITS = Object.freeze(['flyers', 'veiled', 'heavy', 'regen', 'spectral']);

/** One enemy's notable traits (read-only: its data and enemyTraits). */
function foeTraits(def) {
  const keys = enemyTraits(def);
  const out = new Set();
  if (keys.includes('airborne')) out.add('flyers');
  if (keys.includes('veiled')) out.add('veiled');
  if (def.armorClass === 'heavy') out.add('heavy');
  if (keys.includes('regen')) out.add('regen');
  if (def.armorClass === 'spectral') out.add('spectral');
  return out;
}

/** A family's enemies in a content window (normals and elites, as the plan's stage builds them; data only). */
export function familyFoes(windowId, family) {
  const win = TRYOUT.windows[windowId];
  const out = [];
  if (!win) return out;
  for (const ch of CHAPTERS) {
    if (!win.chapters.includes(ch.id)) continue;
    for (const id of ch.stages) {
      for (const p of STAGE_MAP[id]?.waveGen?.pool || []) {
        const def = ENEMY_MAP[p.enemy];
        if (!def || def.family !== family) continue;
        const tier = def.tier || 'normal';
        if ((tier === 'normal' || tier === 'elite') && !out.includes(def.id)) out.push(def.id);
      }
    }
  }
  return out;
}

/** The notable traits of some families' enemies in a window (and of any big foes), in PREVIEW_TRAITS order. */
export function familyTraits(windowId, families, extra = []) {
  const got = new Set();
  for (const f of families) for (const id of familyFoes(windowId, f)) for (const t of foeTraits(ENEMY_MAP[id])) got.add(t);
  for (const id of extra) if (ENEMY_MAP[id]) for (const t of foeTraits(ENEMY_MAP[id])) got.add(t);
  return PREVIEW_TRAITS.filter((t) => got.has(t));
}

/** The notable traits of some enemies, in PREVIEW_TRAITS order. */
export function foesTraits(ids) {
  const got = new Set();
  for (const id of ids) if (ENEMY_MAP[id]) for (const t of foeTraits(ENEMY_MAP[id])) got.add(t);
  return PREVIEW_TRAITS.filter((t) => got.has(t));
}

/** The plan's stage (buildTryoutStage is pure), once per plan. */
const STAGES = new WeakMap();
function stageOf(plan) {
  let st = STAGES.get(plan);
  if (!st) STAGES.set(plan, (st = buildTryoutStage(plan)));
  return st;
}

/**
 * Every enemy that can spawn in period p (read-only, as src/sim/waves.js draws a wave): the stage's pool entries open on
 * one of its waves (a block's elites only from its third period) that the wave's budget lets in, and its fixed foes
 * (the minibosses, the boss and a Grade 11+ escort). In first-seen order.
 * @param {object} plan buildTryoutPlan
 */
export function spawnableFoes(plan, p) {
  const len = lengthOf(plan.length);
  const [a, b] = periodWaves(len, p);
  const st = stageOf(plan);
  const gen = st.waveGen;
  const all = (gen.pool || []).filter((e) => e && ENEMY_MAP[e.enemy]);
  const out = [];
  const add = (id) => { if (!out.includes(id)) out.push(id); };
  for (let w = a; w <= b; w++) {
    const pw = Math.min(w, st.waves);
    const budget = (gen.budget?.start ?? 10) * powInt(gen.budget?.growth ?? 1.1, pw - 1);
    let pool = all.filter((e) => (e.from ?? 1) <= pw && pw <= (e.to ?? Infinity));
    const ok = pool.filter((e) => (ENEMY_MAP[e.enemy].threat ?? 1) <= budget * 0.6);
    if (ok.length) pool = ok;
    for (const e of pool) add(e.enemy);
    for (const f of gen.fixed || []) if (f.wave === w && ENEMY_MAP[f.enemy]) add(f.enemy);
  }
  return out;
}

/** The big foes (minibosses, the boss) of period p: [{ wave, id, tier }]. */
export function periodFoes(plan, p) {
  const len = lengthOf(plan.length);
  const [a, b] = periodWaves(len, p);
  const out = [];
  len.minibossWaves.forEach((w, i) => { if (w >= a && w <= b && plan.minibosses[i]) out.push({ wave: w, id: plan.minibosses[i], tier: 'miniboss' }); });
  if (len.bossWave >= a && len.bossWave <= b) out.push({ wave: len.bossWave, id: plan.boss, tier: 'boss' });
  return out;
}

/**
 * The run's timetable from its plan alone (Before Class, §13.3): the same cells as timetableModel, every one upcoming,
 * each period with its Subject pair, the Back Gate, the Grade 8+ affix and its big foe (`foe`, `foeTier`).
 * @param {object} plan buildTryoutPlan
 */
export function planTimetableModel(plan) {
  const len = lengthOf(plan.length);
  const out = [];
  for (let p = 1; p <= len.periods; p++) {
    const subjects = (plan.subjects?.[p] || []).slice();
    const big = periodFoes(plan, p);
    const top = big.find((f) => f.tier === 'boss') || big[0] || null;
    out.push({
      kind: 'period', p, final: p === len.periods, label: p === len.periods ? T.final : T.cell(p), subjects, chosen: null,
      backGate: subjects.some((id) => TRYOUT.subjects?.[id]?.backGate), affix: plan.affixes?.[p] || null,
      marks: null, resumed: false, dare: false, state: 'upcoming', foe: top?.id || null, foeTier: top?.tier || null,
    });
    const b = len.breaks?.[p];
    if (b && p < len.periods) out.push({ kind: 'break', after: p, id: b, label: BREAK_SHORT[b] || b, state: 'upcoming' });
  }
  return out;
}

/**
 * A period's preview (§13.4): its block's two families, their notable traits, the miniboss or the boss on its wave, the
 * Subject pair (or the chosen Subject), the Back Gate, a Grade 8+ affix, and what comes after it (the pick, a break).
 * Pure: the plan and the data only. `subjects` / `chosen`: the live cell's (in battle), else the plan's pair.
 * @param {object} plan buildTryoutPlan
 * @param {number} p
 * @param {{ subjects?: string[]|null, chosen?: string|null }} [o]
 */
export function periodPreview(plan, p, { subjects = null, chosen = null } = {}) {
  const len = lengthOf(plan.length);
  const block = plan.blocks.find((b) => p >= b.first && p <= b.last) || plan.blocks[plan.blocks.length - 1];
  const families = [...new Set(block?.families || [])];
  const foes = periodFoes(plan, p);
  const pair = (subjects || plan.subjects?.[p] || []).slice();
  const shown = chosen ? [chosen] : pair;
  const k = len.picks.indexOf(p);
  const pick = k >= 0 ? { n: k + 1, tryout: (len.tryoutPicks || []).includes(k + 1), exam: k + 1 === len.examPrep } : null;
  return {
    p, final: p === len.periods, waves: periodWaves(len, p), families,
    // (what the stage can spawn in these waves: a block's elites only from its third period, the big foes, an escort)
    traits: foesTraits(spawnableFoes(plan, p)), foes,
    subjects: pair, chosen: chosen || null, backGate: shown.some((id) => TRYOUT.subjects?.[id]?.backGate),
    affix: plan.affixes?.[p] || null, pick, breakAfter: p < len.periods ? len.breaks?.[p] || null : null,
  };
}

/** The preview card's words and parts (a DOM node). */
export function previewCard(pv, { onClose = null, id = null } = {}) {
  const fam = pv.families.map((f) => FAMILIES[f]?.name || f).join(' · ');
  const subj = (sid) => h('span.ty-ttp-subj', h('b', SUBJECT_TEXT[sid]?.name || sid), h('span', ` ${SUBJECT_TEXT[sid]?.short || SUBJECT_TEXT[sid]?.line || ''}`));
  const rows = [
    h('div.ty-ttp-row', { 'data-testid': 'ty-ttp-foes' }, h('span.ty-ttp-k', PV.foes), h('span.ty-ttp-v', h('b', fam),
      h('span.ty-ttp-traits', ` · ${pv.traits.length ? pv.traits.map((t) => PV.traits[t] || t).join(', ') : PV.noTraits}`))),
    ...pv.foes.map((f) => h(`div.ty-ttp-row.ty-ttp-big.${f.tier}`, { 'data-testid': `ty-ttp-${f.tier}` },
      h('span.ty-ttp-k', f.tier === 'boss' ? PV.boss(f.wave) : PV.miniboss(f.wave)),
      h('span.ty-ttp-v', enemyToken(f.id, { size: 20 }), h('b', ENEMY_MAP[f.id]?.name || f.id)))),
    pv.chosen ? h('div.ty-ttp-row', { 'data-testid': 'ty-ttp-subject' }, h('span.ty-ttp-k', PV.subject), h('span.ty-ttp-v', subj(pv.chosen)))
      : pv.subjects.length ? h('div.ty-ttp-row', { 'data-testid': 'ty-ttp-subject' }, h('span.ty-ttp-k', PV.subjectPair),
        h('span.ty-ttp-v.ty-ttp-pair', ...pv.subjects.map(subj)))
        : h('div.ty-ttp-row.ty-ttp-mute', { 'data-testid': 'ty-ttp-subject' }, PV.noSubject),
    pv.backGate ? h('div.ty-ttp-row.ty-ttp-gate', { 'data-testid': 'ty-ttp-gate' }, h('span.ty-ttp-k', '⟲'), h('span.ty-ttp-v', PV.backGate)) : null,
    pv.affix ? h('div.ty-ttp-row', { 'data-testid': 'ty-ttp-affix' }, h('span.ty-ttp-k', h('i.ty-tt-affix'), ` ${PV.affix}`),
      h('span.ty-ttp-v', h('b', DARE_SHORT[pv.affix] || pv.affix), ` (${DARE_TEXT[pv.affix] || ''})`)) : null,
    pv.pick || pv.breakAfter ? h('div.ty-ttp-row.ty-ttp-next', { 'data-testid': 'ty-ttp-next' },
      h('span.ty-ttp-k', PV.breakAfter),
      h('span.ty-ttp-v', ...[
        pv.pick ? `${PV.pick(pv.pick.n)}${pv.pick.tryout ? ` (${PV.tryoutPick})` : pv.pick.exam ? ` (${PV.examPrep})` : ''}` : null,
        pv.breakAfter ? h('b', `${pv.pick ? ' · ' : ''}${BREAK_NAMES[pv.breakAfter] || pv.breakAfter}`) : null,
        pv.breakAfter ? ` (${PV.breakLine})` : null,
      ].filter(Boolean))) : null,
  ].filter(Boolean);
  const title = pv.final ? PV.final : PV.period(pv.p);
  return h('div.ty-ttp', { role: 'dialog', 'aria-label': title, 'data-testid': 'ty-tt-preview', 'data-p': String(pv.p), id },
    h('div.ty-ttp-head', h('b.ty-ttp-title', title), h('span.ty-ttp-waves', PV.waves(pv.waves[0], pv.waves[1])),
      onClose ? h('button.ty-ttp-x', { type: 'button', 'aria-label': PV.close, title: PV.close, 'data-testid': 'ty-tt-preview-close', onclick: (e) => { e.stopPropagation(); onClose(); } }, '×') : null),
    ...rows);
}

/** A break cell's preview: its name and what happens in it. */
function breakCard(c, { onClose = null, id = null } = {}) {
  const name = BREAK_NAMES[c.id] || c.label;
  return h('div.ty-ttp.ty-ttp-brk', { role: 'dialog', 'aria-label': name, 'data-testid': 'ty-tt-preview', 'data-break': c.id, id },
    h('div.ty-ttp-head', h('b.ty-ttp-title', name),
      onClose ? h('button.ty-ttp-x', { type: 'button', 'aria-label': PV.close, title: PV.close, 'data-testid': 'ty-tt-preview-close', onclick: (e) => { e.stopPropagation(); onClose(); } }, '×') : null),
    h('div.ty-ttp-row', PV.breakLine));
}

let previewSeq = 0;

/**
 * A strip with tap previews (§13.4): a wrapper holding the strip and at most one small preview card under it. A tap
 * (or Enter / Space) on a cell opens its preview, a second tap on it, the ×, Escape or a tap anywhere else closes it;
 * it never stays over the buttons below (a tap outside closes it and does nothing else: its click is swallowed).
 * @param {object[]} cells timetableModel / planTimetableModel cells
 * @param {(p: number, cell: object) => object} previewOf periodPreview for a period cell
 * @param {{ testid?: string, cls?: string, boss?: string|null, wrapCls?: string, open?: string|null,
 *   onToggle?: ((key: string|null) => void)|null }} [o] open: the key ("p3" / "b3") to open at once (a repaint)
 * @returns {{ el: HTMLElement, close: () => void, get open(): string|null }}
 */
export function previewStrip(cells, previewOf, { testid = 'ty-tt', cls = '', boss = null, wrapCls = '', open = null, onToggle = null } = {}) {
  let cur = null; // { key, card, cellEl, off }
  const pid = `ty-ttp-${++previewSeq}`;
  const wrap = h(`div.ty-ttw${wrapCls ? `.${wrapCls}` : ''}`);
  const keyOf = (c) => (c.kind === 'break' ? `b${c.after}` : `p${c.p}`);
  function close({ focus = false } = {}) {
    if (!cur) return;
    const { card, cellEl, off } = cur;
    cur = null;
    off();
    card.remove();
    for (const x of wrap.querySelectorAll('[aria-expanded="true"]')) x.setAttribute('aria-expanded', 'false');
    if (focus) cellEl?.focus?.({ preventScroll: true });
    onToggle?.(null);
  }
  function show(c, cellEl) {
    const key = keyOf(c);
    if (cur?.key === key) return close();
    close();
    const card = c.kind === 'break' ? breakCard(c, { onClose: () => close({ focus: true }), id: pid }) : previewCard(previewOf(c.p, c), { onClose: () => close({ focus: true }), id: pid });
    wrap.append(card);
    for (const x of wrap.querySelectorAll(`[data-testid="ty-tt-${key}"]${c.final ? ', [data-testid="ty-tt-boss"]' : ''}`)) {
      x.setAttribute('aria-expanded', 'true');
      x.setAttribute('aria-controls', pid);
    }
    place(card, cellEl);
    // a tap anywhere outside the card and the strip only closes it: the click that follows is swallowed, so the tap
    // never also takes a card, spends an Eraser or toggles a girl (R2 review)
    const down = (e) => {
      if (wrap.isConnected && (card.contains(e.target) || strip.contains(e.target))) return;
      close();
      if (wrap.isConnected) swallowNextClick();
    };
    const offEsc = onEscape(() => close({ focus: true }));
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('resize', onResize);
    cur = { key, card, cellEl, off: () => { offEsc(); document.removeEventListener('pointerdown', down, true); window.removeEventListener('resize', onResize); } };
    onToggle?.(key);
  }
  // (a phone's toolbar showing or hiding is a resize too: the card moves with its cell, it does not close)
  const onResize = () => { if (cur) place(cur.card, cur.cellEl); };
  /** Under the cell, inside the wrapper (centred on the cell, clamped to the wrapper's edges). */
  function place(card, cellEl) {
    card.style.maxHeight = '';
    const ww = wrap.clientWidth;
    const cw = Math.min(card.offsetWidth || 280, ww);
    // (by the boxes on screen: the strip may scroll sideways on a Full Day)
    const wr = wrap.getBoundingClientRect();
    const cr = cellEl?.getBoundingClientRect?.();
    const mid = cr ? cr.left - wr.left + cr.width / 2 : ww / 2;
    card.style.left = `${Math.max(0, Math.min(ww - cw, Math.round(mid - cw / 2)))}px`;
    // a short screen: the card stops at the window's bottom edge and scrolls inside (it never runs off the page)
    const r = card.getBoundingClientRect();
    const room = Math.floor((window.innerHeight || 0) - r.top - 6);
    if (room > 0 && r.bottom > window.innerHeight - 6) card.style.maxHeight = `${Math.max(96, room)}px`;
  }
  const strip = timetableStrip(cells, { testid, cls, boss, onCell: (c, el) => show(c, el) });
  wrap.append(strip);
  if (open) {
    const c = cells.find((x) => keyOf(x) === open);
    if (c) {
      // (a repaint: reopen once the wrapper is in the page, so the card can measure itself)
      requestAnimationFrame(() => {
        const el = strip.querySelector(`[data-testid="ty-tt-${open}"]`);
        if (el && wrap.isConnected && !cur) show(c, el);
      });
    }
  }
  return { el: wrap, close, get open() { return cur?.key || null; } };
}

/**
 * Before Class's strip (§13.3): the plan of the pending seed, Grade, length and map; the Final boss portrait at the end;
 * tap a cell for its preview. Plan-only (buildTryoutPlan is pure). One slim row (it sits beside the Grade line, so the
 * six stay above the foot).
 * @param {object} plan buildTryoutPlan({ seed, grade, length, mapId })
 * @returns {{ el: HTMLElement, close: () => void }}
 */
export function beforeClassStrip(plan) {
  const cells = planTimetableModel(plan);
  const s = previewStrip(cells, (p) => periodPreview(plan, p), { testid: 'ty-tt', boss: plan.boss, wrapCls: 'ty-bct-in' });
  const el = h('div.ty-bct', { 'data-testid': 'ty-bct', 'data-length': plan.length }, s.el);
  return { el, close: s.close };
}

/**
 * Before Class's mount (src/ui/screens/tryoutSetup.js, "[timetable strip]"): the strip of the pending run's plan.
 * @param {{ seed: number, grade: number, length: string, mapId: string }} pending
 */
export function beforeClassTimetable(pending) {
  // (Before Class redraws on every tap: the same plan keeps the same strip, so an open preview and the boss still stay)
  const key = `${pending.seed}|${pending.grade}|${pending.length}|${pending.mapId}`;
  if (bcMemo?.key === key && bcMemo.el) return bcMemo.el;
  // (a new plan: the old strip's open preview lets go of its listeners first)
  bcMemo?.close();
  const s = beforeClassStrip(buildTryoutPlan({ seed: pending.seed, grade: pending.grade, length: pending.length, mapId: pending.mapId }));
  bcMemo = { key, el: s.el, close: s.close };
  return s.el;
}
let bcMemo = null;

/** Leaving Before Class: an open preview closes and lets go of its Escape, tap and resize listeners. */
export function closeBeforeClassTimetable() {
  bcMemo?.close();
}

/** The thin band's row of tiny cells (no words: the band's text says where the run is). */
export function timetableMini(cells) {
  return h('div.ty-tt-mini', { 'aria-hidden': 'true' },
    ...cells.map((c) => h(`i.${c.kind === 'break' ? 'b' : 'p'}.${c.state}${c.kind === 'period' && c.dare ? '.dare' : ''}${c.kind === 'period' && c.affix ? '.affix' : ''}`)));
}
