// Potential on screen (spec docs/specs/POTENTIAL.md, v3 §11 and v2 §7): the "P3" pill every screen
// shows (P6 wears the five-petal crown), the Info tab's six-node track with the stat line under each
// node and its five-step list, the reveal tags and ribbons, and the "Potential up!" cards after a
// recruit. Display only; the steps and their text come from src/data/potential.js and
// src/data/potentialText.js through the one describer in src/systems/potential.js, and the level
// cap beside each step from src/systems/progression.js potentialLevelCap. Styles:
// src/ui/styles/potential.css (tokens; our own pill, track, crown and ✦ glyph, never rainbow:
// rainbow is UR).
import './styles/potential.css';
import { h } from './dom.js';
import {
  MAX_POTENTIAL, potentialLevel, potentialView, dupesToMax, potentialNext, potentialPillTitle, moreDupes, potentialStepInfo,
  DUPE_PAST_MAX_TOMES, dupePastMaxPay,
} from '../systems/potential.js';
import { potentialLevelCap } from '../systems/progression.js';
import { UNIT_RARITIES } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { portraitHTML } from '../art/portraits.js';

/** Potential of a girl in a profile (unowned → 0). */
export function potentialOf(profile, unitId) {
  const st = profile?.units?.[unitId];
  return st ? potentialLevel(st) : 0;
}

/** The five-petal Full-Potential crown (our own art; currentColor). */
export const CROWN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">${[0, 72, 144, 216, 288]
  .map((a) => `<path d="M12 11.2c-2.4-1.7-3.3-4.6-2-6.9.6-1 1.3-1.5 2-1.6.7.1 1.4.6 2 1.6 1.3 2.3.4 5.2-2 6.9z" fill="currentColor" transform="rotate(${a} 12 12)"/>`).join('')}<circle cx="12" cy="12" r="1.9" fill="#fff"/></svg>`;

/** The crown as an element. */
export const crown = (cls = 'pot-crown') => h(`span.${cls}`, { html: CROWN_SVG, 'aria-hidden': 'true' });

/**
 * The pill. Hidden below `min` (cards show nothing at P1; the student page shows P1). At P6 the
 * five-petal crown sits in front of "P6". `def` names her newest step in the tooltip
 * ("Potential 5 of 6 — Moonpiercer").
 * @param {number} p 1…6
 * @param {{ tag?: string, min?: number, compact?: boolean, title?: string, testid?: string, onClick?: Function, cls?: string, def?: object }} [o]
 */
export function potPill(p, { tag = 'span', min = 2, compact = false, title = null, testid = null, onClick = null, cls: extra = '', def = null } = {}) {
  if (!(p >= min)) return null;
  const max = p >= MAX_POTENTIAL;
  const cls = `${tag}.pot-pill${max ? '.p6' : ''}${compact ? '.compact' : ''}${extra ? `.${extra}` : ''}`;
  const props = { title: title || (def ? potentialPillTitle(def, p) : `Potential ${p} of ${MAX_POTENTIAL}`), 'aria-label': `Potential ${p} of ${MAX_POTENTIAL}` };
  if (testid) props['data-testid'] = testid;
  if (onClick) props.onclick = onClick;
  if (tag === 'button') props.type = 'button';
  return h(cls, props, max ? crown('pot-pill-crown') : null, `P${p}`);
}

/** Star Fragments a duplicate of this girl gives. */
export const dupeFragments = (def) => UNIT_RARITIES[def?.rarity]?.fragmentsOnDupe ?? 0;

/** "P5 ✦ Moonpiercer" for a kit step, "P2 (+4% damage)" for a stat step. */
export const stepPhrase = (info) => (info ? (info.kit ? `P${info.step} ${info.brief}` : `P${info.step} (${info.brief})`) : '');

/** The showcase pill's tooltip and the footer's next step: "Next: P5 unlocks ✦ Moonpiercer (1 more duplicate)". */
export function nextLine(def, unitState) {
  const n = potentialNext(def, unitState);
  if (!n) return unitState ? 'Full Potential' : '';
  return `Next: P${n.step} unlocks ${n.brief} (${moreDupes(n.dupes)})`;
}

/** The line under a node: `stat · cap`; a stat step whose label is that stat shows it only with a cap. */
export const nodeLine = (n) => (n.short === n.stat && n.cap == null ? '' : n.line);

const TAG_WORD = { allies: 'Allies', enemies: 'Enemies', coins: 'Coins' };
const tagChips = (tags) => tags.map((t) => h(`span.pot-chip.${t}`, TAG_WORD[t]));

/**
 * The Info tab's Potential section (v2 §7.2, v3 §11): title, rule, the six-node track with the
 * stat line under each node (`+4% SPD`, and `· 67` once Potential raises her level cap), the
 * five-step list (owned ✓, the next one marked, later ones muted; every step shown for a girl not
 * owned, since this is how a player previews her) and the footer. Never locked.
 */
export function potentialSection(def, unitState) {
  const owned = !!unitState;
  const p = owned ? potentialLevel(unitState) : 0;
  const nodes = potentialView(def, unitState, { capAt: potentialLevelCap });
  const dupes = Math.max(0, Math.floor(Number(unitState?.dupes) || 0));
  const frag = dupeFragments(def);
  const next = potentialNext(def, unitState);
  const sig = nodes[MAX_POTENTIAL - 1];
  let footer;
  if (!owned) footer = 'Recruit her to start at P1.';
  else if (p >= MAX_POTENTIAL) {
    const tomes = DUPE_PAST_MAX_TOMES[def.rarity] || 0;
    const pay = tomes ? `Star Fragments (+${frag} each) and ${tomes} Akashic Tome${tomes === 1 ? '' : 's'}` : `Star Fragments only (+${frag} each)`;
    footer = `Potential maxed — duplicates now give ${pay}. Duplicates so far: ${dupes}.`;
  }
  else footer = `Duplicates so far: ${dupes} · Next: ${stepPhrase(next)} with ${moreDupes(next.dupes)}`;
  const firstKit = nodes.find((n) => n.kit)?.step ?? 3;
  const track = h('ol.pot-track', nodes.map((n) => h(`li.pot-node${n.active ? '.on' : ''}${n.next ? '.next' : ''}${n.kit ? '.kit' : ''}${n.step === MAX_POTENTIAL ? '.sig' : ''}`,
    { 'data-testid': `potential-node-${n.step}`, title: n.step === 1 ? n.long : `P${n.step} ${n.name || ''}: ${n.long}` },
    h('span.pot-node-p', n.step === MAX_POTENTIAL ? crown('pot-node-crown') : null, `P${n.step}`, n.kit ? h('span.pot-node-kit', '✦') : null),
    h('span.pot-node-label', n.step === 1 ? 'Base' : n.short),
    // (a stat step's label already is her stat: its line only adds the cap, once there is one)
    nodeLine(n) ? h('span.pot-node-line', { 'data-testid': `potential-line-${n.step}` }, nodeLine(n)) : null)));
  const steps = h('ol.pot-steps', { 'data-testid': 'potential-steps' }, nodes.slice(1).map((n) => h(
    `li.pot-step${n.active ? '.on' : ''}${n.next ? '.next' : ''}${!n.active && !n.next ? '.later' : ''}${n.kit ? '.kit' : ''}${n.step === MAX_POTENTIAL ? '.sig' : ''}`,
    { 'data-testid': `potential-step-${n.step}` },
    h('div.pot-step-head',
      h('span.pot-step-mark', n.active ? '✓' : n.next ? '▸' : ''),
      h('b.pot-step-p', `P${n.step}`),
      h('span.pot-step-name', n.kit ? h('span.pot-glyph', '✦ ') : null, n.name || ''),
      n.step === MAX_POTENTIAL ? crown('pot-step-crown') : null,
      tagChips(n.tags),
      n.next ? h('span.pot-step-next', { 'data-testid': 'potential-next' }, `NEXT · ${moreDupes(next?.dupes ?? 1)}`) : null),
    h('div.pot-step-long', n.long),
    n.cap != null ? h('div.pot-step-cap', `Level cap ${n.cap}`) : null)));
  // the student page's card look (section.mb-card + h3.mb-card-title, meta-b.css)
  return h('section.mb-card.pot-section', { 'data-testid': 'potential-section', id: 'potential' },
    h('h3.mb-card-title', owned ? `Potential · P${p} / ${MAX_POTENTIAL}` : 'Potential'),
    h('p.pot-rule', 'Each duplicate recruit raises her Potential by 1 and still gives Star Fragments.'),
    h('p.pot-rule.muted', `Every step makes her stronger; from P${firstKit} each one (✦) also teaches her a new trick, up to her P${MAX_POTENTIAL} capstone, and every step raises her level cap. At P${MAX_POTENTIAL}, duplicates give ${dupePastMaxPay(def)}.`),
    track,
    steps,
    h('p.pot-footer.muted', { 'data-testid': 'potential-footer' }, footer),
    owned && p < MAX_POTENTIAL && sig ? h('p.pot-footer.muted.pot-footer-sig', `Capstone: P${MAX_POTENTIAL} ✦ ${sig.name} (${moreDupes(dupesToMax(unitState))})`) : null);
}

/** Reveal corner tag (§7.4): "P4 ▲" when it rose, "MAX" at P6, nothing otherwise. */
export function revealTag(r) {
  if (!r || r.isNew || !(r.potential >= 1)) return null;
  if (r.potentialUp) return h(`span.ma-gc-pot${r.potential >= MAX_POTENTIAL ? '.p6' : ''}`, { title: `Potential ${r.potential} of ${MAX_POTENTIAL}` }, `P${r.potential} ▲`);
  if (r.potential >= MAX_POTENTIAL) return h('span.ma-gc-pot.max', { title: `Potential maxed: ${dupePastMaxPay(UNIT_MAP[r.unitId])}` }, 'MAX');
  return null;
}

/**
 * The duplicate card's ribbon under her name (v2 §7.3): what the step she just reached is
 * ("✦ Moonpiercer"; a stat step: "+4% damage"), the full line in its tooltip.
 * @param {{ isNew?: boolean, potentialUp?: boolean, potential?: number }} r
 * @param {object} def
 */
export function revealRibbon(r, def) {
  if (!r || r.isNew || !r.potentialUp || !(r.potential >= 2)) return null;
  const info = potentialStepInfo(def, r.potential);
  if (!info) return null;
  return h('span.ma-gc-potstep', { 'data-testid': 'reveal-potstep', title: `P${info.step} unlocked: ${info.brief}` }, info.brief);
}

/** The cards most a recruit shows one by one (the rest share one "and N more" card). */
export const POT_UP_CARDS = 3;

/**
 * "Potential up!" cards (v2 §7.4, v3 §11): one per girl who reached a kit step, highest rarity first,
 * at most POT_UP_CARDS, then one "and N more" card; stat-step rises are one "Also:" line on the last
 * card. Tap (or Next) for the next card, Skip all to close. Mounted in `host` (the reveal overlay).
 * @param {HTMLElement} host
 * @param {ReturnType<typeof import('../systems/potential.js').potentialRises>} rises
 * @param {{ reduce?: boolean, onDone?: Function }} [o]
 * @returns {HTMLElement|null} the layer (null: no card to show)
 */
export function showPotentialUp(host, rises, { reduce = false, onDone = null } = {}) {
  if (!rises?.cards?.length) return null;
  const shown = rises.cards.slice(0, POT_UP_CARDS);
  const rest = rises.cards.slice(POT_UP_CARDS);
  const pages = [...shown.map((g) => ({ g })), ...(rest.length ? [{ rest }] : [])];
  const also = rises.statOnly.length ? `Also: ${rises.statOnly.map((g) => `${g.def.name} ${stepPhrase(g.newest)}`).join(', ')}` : '';
  let i = 0;
  const layer = h(`div.pot-up-layer${reduce ? '.still' : ''}`, { 'data-testid': 'pot-up', role: 'dialog', 'aria-label': 'Potential up!' });
  const close = () => {
    layer.remove();
    onDone?.();
  };
  const go = () => {
    i += 1;
    if (i >= pages.length) close();
    else draw();
  };
  const capLine = (g) => {
    const a = potentialLevelCap(g.from);
    const b = potentialLevelCap(g.to);
    return b > a ? h('div.pot-up-cap', { 'data-testid': 'pot-up-cap' }, `Level cap ${a} → ${b}`) : null;
  };
  const card = (g, last) => {
    const t = g.shown;
    const others = g.kit.filter((s) => s !== t);
    return h(`div.pot-up-card${g.full ? '.full' : ''}`, { 'data-testid': 'pot-up-card', 'data-unit': g.unitId },
      h('div.pot-up-art', { html: portraitHTML(g.def, 'card', { eager: true }) }),
      h('div.pot-up-body',
        h('div.pot-up-kicker', 'Potential up!'),
        h('div.pot-up-who', h('b', g.def.name), ' · ', potPill(g.to, { min: 2, def: g.def })),
        h('div.pot-up-trick', { 'data-testid': 'pot-up-trick' }, h('span.pot-up-glyph', '✦'), ` ${t.name}`),
        h('p.pot-up-long', t.long),
        others.length ? h('div.pot-up-more', `Also unlocked: ${others.map((s) => `P${s.step} ✦ ${s.name}`).join(', ')}`) : null,
        capLine(g),
        g.full
          ? h('div.pot-up-full', { 'data-testid': 'pot-up-full' }, crown('pot-up-crown'), 'Full Potential!')
          : h('div.pot-up-next', { 'data-testid': 'pot-up-next' }, `Next: ${stepPhrase(g.next)} — ${moreDupes(1)}`),
        last && also ? h('div.pot-up-also', { 'data-testid': 'pot-up-also' }, also) : null));
  };
  const listCard = (list, last) => h('div.pot-up-card.list', { 'data-testid': 'pot-up-card' },
    h('div.pot-up-body',
      h('div.pot-up-kicker', `And ${list.length} more`),
      h('ul.pot-up-list', list.map((g) => h('li', h('b', g.def.name), ` ${stepPhrase(g.shown)}`, g.full ? crown('pot-up-crown') : null))),
      last && also ? h('div.pot-up-also', { 'data-testid': 'pot-up-also' }, also) : null));
  const draw = () => {
    const pg = pages[i];
    const last = i === pages.length - 1;
    layer.replaceChildren(
      h('div.pot-up-stage', { onclick: go }, pg.g ? card(pg.g, last) : listCard(pg.rest, last)),
      h('div.pot-up-foot',
        h('span.pot-up-count', pages.length > 1 ? `${i + 1} / ${pages.length}` : ''),
        h('button.pot-up-btn.ghost', { type: 'button', 'data-testid': 'pot-up-skip', onclick: close }, 'Skip all'),
        h('button.pot-up-btn', { type: 'button', 'data-testid': 'pot-up-go', onclick: go }, last ? 'Done' : 'Next')));
  };
  draw();
  host.appendChild(layer);
  return layer;
}
