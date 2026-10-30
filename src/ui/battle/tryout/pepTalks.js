// Tryout Day: the Pep Talks taken so far, as a list the player can open any time in a run (the tracker's Pep Talks
// button, the pick sheet, the break bar) and on the Class Photo. Display only: it reads a player's run state (or the
// run's result) and never writes the Sim. The model (pepLedger, drawbacksOf, varsityOf, deskOf) is pure; pepBody draws
// it in the Ink & Paper kit (src/ui/styles/tryoutBattle.css, .ty-peps).
import { h } from '../util.js';
import { svgEl } from '../../components.js';
import { rarityTag } from '../../kit.js';
import { portraitHTML } from '../../../art/portraits.js';
import { UNIT_MAP } from '../../../data/units.js';
import { PEP_CARDS, RARITIES, TRYOUT } from '../../../data/tryout.js';
import { cardText, DRAWBACK_TEXT, PEP_LIST_TEXT, GIRL_CARD_TEXT, JAR_TEXT, DARE_SHORT } from '../../text/tryout.js';
import { affixOf } from './adapters.js';

const T = PEP_LIST_TEXT;
const isObj = (x) => !!x && typeof x === 'object';
/** A drawback that hits every player, whoever holds the card: foes' HP (Hundred Points, any holder: sim hasCards) and
 *  the shared max hearts (Extra Desk lowers sim.maxLives). The others (passes) are the holder's own. */
export const teamDrawback = (id) => { const d = PEP_CARDS[id]?.draw; return !!d && ('foeHp' in d || 'maxHearts' in d); };

/**
 * The Pep Talks a player took, one row per card (a One girl card: per girl), in the order first taken. A card taken
 * again stacks: `n` counts every copy and `tiers` holds one line per rarity (highest first), with its own count, so a
 * stack of an SR and an R reads as both effects. A Brush Up shows as the raised rarity (the instance's own `r`).
 * @param {Array<{ id: string, r: number, unit?: string }>} cards the player's `cards` (sim.tryout.players[i] or the result's)
 * @param {{ refills?: Record<string, number>|null }} [o] Free Refills still unspent by girl (the player's `refills`); null:
 *   not known (the run's result does not keep them), so no count is shown
 * @returns {Array<{ key: string, id: string, unit: string|null, group: string, name: string, n: number, top: number,
 *   tiers: Array<{ r: number, n: number, line: string }>, drawback: string|null, team: boolean, refills: number|null }>}
 */
export function pepLedger(cards, { refills = {} } = {}) {
  const rows = new Map();
  for (const inst of Array.isArray(cards) ? cards : []) {
    if (!isObj(inst) || !PEP_CARDS[inst.id]) continue;
    const unit = inst.unit || null;
    const key = `${inst.id}|${unit || ''}`;
    let row = rows.get(key);
    if (!row) {
      const c = PEP_CARDS[inst.id];
      row = {
        key, id: inst.id, unit, group: c.group, name: cardText(inst).name, n: 0, top: 0, tiers: [],
        drawback: DRAWBACK_TEXT[inst.id] ? DRAWBACK_TEXT[inst.id]() : null, team: !!c.team || inst.id === 'B02',
        refills: inst.id === 'P06' && unit && isObj(refills) ? Math.max(0, refills[unit] || 0) : null,
      };
      rows.set(key, row);
    }
    const r = Math.max(0, Math.min(RARITIES.length - 1, inst.r | 0));
    row.n++;
    row.top = Math.max(row.top, r);
    const tier = row.tiers.find((x) => x.r === r);
    if (tier) tier.n++;
    else row.tiers.push({ r, n: 1, line: cardText({ ...inst, r }).line });
  }
  for (const row of rows.values()) row.tiers.sort((a, b) => b.r - a.r);
  return [...rows.values()];
}

/** The drawbacks the player's cards carry (once per card), in the order taken: [{ id, name, text, team }]. */
export function drawbacksOf(cards) {
  const seen = new Set();
  const out = [];
  for (const inst of Array.isArray(cards) ? cards : []) {
    if (!isObj(inst) || seen.has(inst.id) || !DRAWBACK_TEXT[inst.id]) continue;
    seen.add(inst.id);
    out.push({ id: inst.id, name: cardText(inst).name, text: DRAWBACK_TEXT[inst.id](), team: teamDrawback(inst.id) });
  }
  return out;
}

/** Her Varsity (§5) line, once per girl with it: [{ unit, name, line }]. */
export function varsityOf(varsity) {
  const v = TRYOUT.varsity;
  const pc = (x) => Math.round(x * 100);
  const line = GIRL_CARD_TEXT.againLine(pc(v.damageMul), pc(v.rateMul), pc(v.costCut)).replace(/^Varsity:\s*/, '');
  return Object.keys(isObj(varsity) ? varsity : {}).filter((id) => varsity[id] && UNIT_MAP[id]).map((id) => ({ unit: id, name: UNIT_MAP[id].name, line }));
}

/** The run's Desk Supplies (§10.3, solo only) that are switched on: [{ id, name, line }]. */
export function deskOf(perks) {
  if (!isObj(perks)) return [];
  return ['eraser', 'draft7', 'coins', 'pocket'].filter((k) => perks[k] === true && JAR_TEXT[k]).map((k) => ({ id: k, ...JAR_TEXT[k] }));
}

/**
 * The twists on the period in play (none between periods): its Double Dare curse and its Grade twist (§8.3, Grade 8+).
 * @param {object} t sim.tryout. Its `dare` is the curse itself (a TRYOUT.dares entry, sim dareOf); the affix is an id.
 * @returns {string[]} the lines, in the curse's short name
 */
export function twistsNow(t) {
  if (!isObj(t) || !t.base) return [];
  const out = [];
  const dare = isObj(t.dare) ? t.dare.id : t.dare;
  if (dare) out.push(T.dareNow(DARE_SHORT[dare] || dare));
  const affix = affixOf(t, t.period);
  if (affix) out.push(T.affixNow(DARE_SHORT[affix] || affix));
  return out;
}

/** The kit's rarity tag for a rarity index. */
const rTag = (r) => rarityTag(RARITIES[r] || 'R');

/** Bold the numbers in an effect line (the pick sheet's rule, §13.6). */
function bold(line) {
  const out = [];
  let at = 0;
  const s = String(line || '');
  for (const m of s.matchAll(/[+−-]?\d[\d.,]*\s?(?:%|s\b)?/g)) {
    if (m.index > at) out.push(s.slice(at, m.index));
    out.push(h('b', m[0].trim()));
    at = m.index + m[0].length;
    if (/\s$/.test(m[0])) out.push(' ');
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}

/** One Pep Talk row: the card's top rarity, its name (a girl's face for a One girl card), the stack, each tier's line. */
function pepRow(row, i, coop) {
  const face = row.unit && UNIT_MAP[row.unit] ? svgEl(portraitHTML(UNIT_MAP[row.unit], 'thumb'), 'ty-pep-face') : null;
  return h(`li.ty-pep.r${row.top}`, { 'data-testid': `ty-pep-${i}`, 'data-card': row.id },
    h('div.ty-pep-top',
      rTag(row.top),
      face,
      h('b.ty-pep-nm', row.name),
      row.n > 1 ? h('span.ty-pep-n', { 'data-testid': `ty-pep-n-${i}`, title: T.stackLabel(row.n), 'aria-label': T.stackLabel(row.n) }, T.stacks(row.n)) : null,
      h('span.ty-pep-grp', T.groups[row.group] || row.group),
      coop && row.team ? h('span.ty-pep-team', T.teamWide) : null),
    ...row.tiers.map((t) => h('p.ty-pep-ln',
      row.tiers.length > 1 || t.n > 1 ? h('span.ty-pep-tier', RARITIES[t.r], t.n > 1 ? ` ${T.stacks(t.n)}` : '', ' · ') : null,
      ...bold(t.line),
      t.n > 1 ? h('span.ty-pep-each', ` (${T.each})`) : null)),
    row.refills != null ? h('p.ty-pep-ln.ty-pep-note', T.refills(row.refills)) : null);
}

/** Co-op: a drawback line's Team-wide tag (it hits both players). */
const teamTag = () => h('span.ty-pep-team', T.teamWide);

/** A titled block of plain lines (Drawbacks, Seat Change, Desk Supplies). */
const block = (title, testid, lines) => h('section.ty-peps-sec', { 'data-testid': testid },
  h('h4.ty-peps-h', title),
  h('ul.ty-peps-lines', ...lines.map((l) => h('li', l))));

/**
 * The panel's body: the list, then Varsity, the drawbacks (the cards' and the period's Double Dare and Grade twist),
 * the Seat Change and the Desk Supplies.
 * @param {{ cards: object[], others?: object[], refills?: object|null, varsity?: object, perks?: object|null, now?: string[],
 *   seats?: string[]|null, end?: boolean, partner?: boolean, coop?: boolean }} o
 *   others: co-op, the other player's cards (their Team-wide drawbacks are listed too); refills: null hides the Free
 *   Refills count; now: lines for the twists in play this period; seats: the Seat Change lines (null: none to show)
 */
export function pepBody({ cards, others = [], refills = {}, varsity = {}, perks = null, now = [], seats = null, end = false, partner = false, coop = false }) {
  const ledger = pepLedger(cards, { refills });
  const draws = drawbacksOf(cards);
  // (co-op: the other player's drawbacks that hit this player too, named as theirs)
  const theirs = coop ? drawbacksOf(others).filter((d) => d.team) : [];
  const vars = varsityOf(varsity);
  const desk = deskOf(perks);
  const drawLines = [
    ...draws.map((d) => [h('b', d.name), `: ${d.text}`, coop && d.team ? [' ', teamTag()] : null]),
    ...theirs.map((d) => h('span', { 'data-testid': `ty-peps-their-${d.id}` }, h('b', `${d.name} (${partner ? T.fromYou : T.fromPartner})`), `: ${d.text} `, teamTag())),
    ...now,
  ];
  return h('div.ty-peps-body',
    partner ? h('p.ty-peps-sub', T.partnerOf) : null,
    ledger.length
      ? h('ol.ty-pep-list', { 'data-testid': 'ty-peps-list' }, ...ledger.map((row, i) => pepRow(row, i, coop)))
      : h('p.ty-peps-none', { 'data-testid': 'ty-peps-none' }, end ? T.noneEnd : T.none),
    vars.length ? block(T.varsity, 'ty-peps-varsity', vars.map((v) => [h('b', v.name), `: ${v.line}`])) : null,
    block(T.drawbacks, 'ty-peps-drawbacks', drawLines.length ? drawLines : [T.noDrawbacks]),
    seats && seats.length ? block(T.seats, 'ty-peps-seats', seats) : null,
    desk.length ? block(T.desk, 'ty-peps-desk', desk.map((d) => [h('b', d.name), `: ${d.line}`])) : null);
}
