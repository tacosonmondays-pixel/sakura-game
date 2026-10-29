// Tryout Day's timetable strip (docs/specs/TRYOUT_DAY.md §13.4): the run map and its progress. Cells P1 … Final with
// the breaks between; a period cell shows its Subject (the chosen one, or the pair), ⟲ for History (the Back Gate), a
// Grade twist dot (Grade 8+, sim.tryout.affixes), after play its 3 assignment marks (stamp or strike), and a Double Dare
// flag. States: done, current (navy plate, yellow ring), upcoming (outline). In battle it shrinks to a thin band
// ("P3 · wave 2/4 · Science") over a row of tiny cells. The model is pure (it reads sim.tryout, never writes it).
import { h } from '../util.js';
import { TRYOUT } from '../../../data/tryout.js';
import { SUBJECT_TEXT, SUBJECT_ABBR, BREAK_SHORT, BREAK_NAMES, DARE_SHORT, TIMETABLE_TEXT as T } from '../../text/tryout.js';

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
 * The full strip (Before Class, the pick sheet): one row of cells.
 * @param {ReturnType<typeof timetableModel>} cells
 * @param {{ testid?: string, cls?: string }} [o]
 */
export function timetableStrip(cells, { testid = 'ty-tt', cls = '' } = {}) {
  return h(`div.ty-tt${cls ? `.${cls}` : ''}`, { 'data-testid': testid, role: 'list', 'aria-label': T.label },
    ...cells.map((c) => {
      if (c.kind === 'break') {
        return h(`div.ty-tt-brk.${c.state}`, { role: 'listitem', title: cellTitle(c), 'data-testid': `ty-tt-b${c.after}` }, h('span', c.label));
      }
      const subj = c.subjects.map((id) => SUBJECT_ABBR[id] || SUBJECT_TEXT[id]?.name || id).join(' · ');
      return h(`div.ty-tt-cell.${c.state}${c.final ? '.final' : ''}`, { role: 'listitem', title: cellTitle(c), 'data-testid': `ty-tt-p${c.p}` },
        h('span.ty-tt-top',
          h('b.ty-tt-p', c.label),
          c.backGate ? h('span.ty-tt-gate', { 'aria-label': T.backGate }, '⟲') : null,
          c.affix ? h('i.ty-tt-affix', { 'aria-label': T.affix(DARE_SHORT[c.affix] || c.affix) }) : null,
          c.dare ? h('span.ty-tt-dare', { 'aria-label': T.dare }, '⚑') : null),
        subj ? h('span.ty-tt-subj', subj) : null,
        c.marks ? h('span.ty-tt-marks', ...c.marks.map((m) => markEl(m))) : null);
    }));
}

/** The thin band's row of tiny cells (no words: the band's text says where the run is). */
export function timetableMini(cells) {
  return h('div.ty-tt-mini', { 'aria-hidden': 'true' },
    ...cells.map((c) => h(`i.${c.kind === 'break' ? 'b' : 'p'}.${c.state}${c.kind === 'period' && c.dare ? '.dare' : ''}${c.kind === 'period' && c.affix ? '.affix' : ''}`)));
}
