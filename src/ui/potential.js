// Potential on screen (spec docs/specs/POTENTIAL.md §7): the "P3" pill every screen shows, the
// six-node track and signature box of the Info tab, and the reveal tags. Display only; the steps
// and their text come from src/data/potential.js through the one describer in
// src/systems/potential.js. Styles: src/ui/styles/potential.css (tokens; our own pill, track and
// ✦ glyph, never rainbow: rainbow is UR).
import './styles/potential.css';
import { h } from './dom.js';
import { MAX_POTENTIAL, potentialLevel, potentialView, dupesToMax } from '../systems/potential.js';
import { UNIT_RARITIES } from '../data/types.js';

/** Potential of a girl in a profile (unowned → 0). */
export function potentialOf(profile, unitId) {
  const st = profile?.units?.[unitId];
  return st ? potentialLevel(st) : 0;
}

/**
 * The pill. Hidden below `min` (cards show nothing at P1; the student page shows P1).
 * @param {number} p 1…6
 * @param {{ tag?: string, min?: number, compact?: boolean, title?: string, testid?: string, onClick?: Function, cls?: string }} [o]
 */
export function potPill(p, { tag = 'span', min = 2, compact = false, title = null, testid = null, onClick = null, cls: extra = '' } = {}) {
  if (!(p >= min)) return null;
  const cls = `${tag}.pot-pill${p >= MAX_POTENTIAL ? '.p6' : ''}${compact ? '.compact' : ''}${extra ? `.${extra}` : ''}`;
  const props = { title: title || `Potential ${p} of ${MAX_POTENTIAL}`, 'aria-label': `Potential ${p} of ${MAX_POTENTIAL}` };
  if (testid) props['data-testid'] = testid;
  if (onClick) props.onclick = onClick;
  if (tag === 'button') props.type = 'button';
  return h(cls, props, `P${p}`);
}

/** Star Fragments a duplicate of this girl gives. */
export const dupeFragments = (def) => UNIT_RARITIES[def?.rarity]?.fragmentsOnDupe ?? 0;

/**
 * The Info tab's Potential section (§7.3): title, rule, six-node track, signature box, footer.
 * Never locked; shown for unowned girls too (all nodes locked).
 */
export function potentialSection(def, unitState) {
  const owned = !!unitState;
  const p = owned ? potentialLevel(unitState) : 0;
  const nodes = potentialView(def, unitState);
  const sig = nodes[MAX_POTENTIAL - 1];
  const dupes = Math.max(0, Math.floor(Number(unitState?.dupes) || 0));
  const frag = dupeFragments(def);
  const left = owned ? dupesToMax(unitState) : MAX_POTENTIAL - 1;
  let footer;
  if (!owned) footer = 'Recruit her to start at P1.';
  else if (p >= MAX_POTENTIAL) footer = `Potential maxed — duplicates now give Star Fragments only (+${frag} each). Duplicates so far: ${dupes}.`;
  else footer = `Duplicates so far: ${dupes} · Next: P${p + 1} with 1 more duplicate`;
  // the student page's card look (section.mb-card + h3.mb-card-title, meta-b.css)
  return h('section.mb-card.pot-section', { 'data-testid': 'potential-section', id: 'potential' },
    h('h3.mb-card-title', owned ? `Potential · P${p} / ${MAX_POTENTIAL}` : 'Potential'),
    h('p.pot-rule', 'Each duplicate recruit raises her Potential by 1 and still gives Star Fragments.'),
    h('p.pot-rule.muted', `At P${MAX_POTENTIAL}, duplicates give Star Fragments only.`),
    h('ol.pot-track', nodes.map((n) => h(`li.pot-node${n.active ? '.on' : ''}${n.next ? '.next' : ''}${n.step === MAX_POTENTIAL ? '.sig' : ''}`,
      { 'data-testid': `potential-node-${n.step}`, title: n.step === 1 ? n.long : `P${n.step}: ${n.long}` },
      h('span.pot-node-p', `P${n.step}`),
      h('span.pot-node-label', n.step === 1 ? 'Base' : n.parts.map((x) => x.short).join(' ') + (n.step === MAX_POTENTIAL ? '✦' : '')),
      n.parts.some((x) => x.who === 'allies') ? h('span.pot-chip', 'Allies') : null))),
    h(`div.pot-sig${p >= MAX_POTENTIAL ? '.on' : ''}`, { 'data-testid': 'potential-signature' },
      h('div.pot-sig-name', h('span.pot-glyph', '✦'), ` ${sig.name} — ${sig.long}`),
      h('div.pot-sig-meta',
        p >= MAX_POTENTIAL ? 'Unlocked' : `Unlocks at P${MAX_POTENTIAL} (${left} more duplicate${left === 1 ? '' : 's'})`,
        h('span.pot-sig-sep', ' | '),
        'Active in every battle')),
    h('p.pot-footer.muted', { 'data-testid': 'potential-footer' }, footer));
}

/** Reveal corner tag (§7.4): "P4 ▲" when it rose, "MAX" at P6, nothing otherwise. */
export function revealTag(r) {
  if (!r || r.isNew || !(r.potential >= 1)) return null;
  if (r.potentialUp) return h(`span.ma-gc-pot${r.potential >= MAX_POTENTIAL ? '.p6' : ''}`, { title: `Potential ${r.potential} of ${MAX_POTENTIAL}` }, `P${r.potential} ▲`);
  if (r.potential >= MAX_POTENTIAL) return h('span.ma-gc-pot.max', { title: `Potential maxed: Star Fragments only` }, 'MAX');
  return null;
}
