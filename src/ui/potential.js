// Potential on screen (spec docs/specs/POTENTIAL.md, v3 §11 and v2 §7): the "P3" pill every screen
// shows (P6 wears the five-petal crown), the Info tab's six-node track with the stat line under each
// node and its five-step list, the reveal tags and ribbons, and the "Potential up!" cards after a
// recruit. Display only; the steps and their text come from src/data/potential.js and
// src/data/potentialText.js through the one describer in src/systems/potential.js, and the level
// cap beside each step from src/systems/progression.js (potentialLevelCap: her cap at P once all
// five breakthrough gates are open; levelCapAt for an owned girl's real cap). Styles:
// src/ui/styles/potential.css (tokens; our own pill, track, crown and ✦ glyph, never rainbow:
// rainbow is UR).
import './styles/potential.css';
import { h } from './dom.js';
import {
  MAX_POTENTIAL, potentialLevel, potentialView, dupesToMax, potentialNext, potentialPillTitle, moreDupes, potentialStepInfo,
  DUPE_PAST_MAX_TOMES, dupePastMaxPay,
} from '../systems/potential.js';
import { potentialLevelCap, levelCapAt, MAX_BREAKTHROUGH, BASE_GATES, gatePotential } from '../systems/progression.js';
import { UNIT_RARITIES } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { ITEMS } from '../data/items.js';
import { essenceBalance, essenceCap, canRaisePotential, raisePotential, KINDRED } from '../systems/essence.js';
import { store } from '../core/store.js';
import { button, toast, confirmDialog } from './components.js';
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

/**
 * The line under a node: her stat at that step and, where Potential raises it, her level cap at
 * that P ("+4% SPD" "Lv 67"), as two spans so the cap never hides behind an ellipsis (on a narrow
 * node it wraps under the stat). A stat step whose label already is that stat shows only the cap.
 * `gatesOpen` false (an owned girl below gate 5): the cap reads as what that P opens later.
 * @returns {HTMLElement|null}
 */
export function nodeLine(n, { gatesOpen = true } = {}) {
  const stat = n.short === n.stat ? '' : n.stat;
  if (!stat && n.cap == null) return null;
  const capTitle = n.cap == null ? null : gatesOpen ? `Level cap ${n.cap} at P${n.step}` : `Level cap ${n.cap} at P${n.step}, once gate ${n.step + 4} is broken`;
  return h('span.pot-node-line', { 'data-testid': `potential-line-${n.step}`, title: [stat, capTitle].filter(Boolean).join(' · ') },
    stat ? h('span.pot-node-stat', stat) : null,
    n.cap != null ? h(`span.pot-node-cap${gatesOpen ? '' : '.later'}`, { 'data-testid': `potential-cap-${n.step}` }, `Lv ${n.cap}`) : null);
}

/** Her breakthrough gates (0…10) from her unit state; a girl not owned previews every gate open. */
const gatesOf = (unitState) => (unitState ? Math.max(0, Math.floor(Number(unitState.breakthrough) || 0)) : MAX_BREAKTHROUGH);

/**
 * Raise Potential (docs/specs/ASCENSION.md §D.2): "Kage's Essence ×1" and the button "Raise to P5 ·
 * 1 Essence + 25,000 coins" (glows when affordable). With no Essence of her own and a fitting
 * Kindred: "Use Kindred Essence (SR) (2)". At P6: "Full Potential". `onDone` redraws the page.
 */
export function raiseRow(def, profile, onDone) {
  const st = profile?.units?.[def.id];
  if (!st) return null;
  const p = potentialLevel(st);
  if (p >= MAX_POTENTIAL) return h('div.pot-raise.full', { 'data-testid': 'potential-raise' }, h('b', 'Full Potential'), h('span.muted', ` · spare copies become ${dupePastMaxPay(def)}`));
  const held = essenceBalance(profile, def.id);
  const own = canRaisePotential(profile, def.id, held > 0 ? 'own' : null);
  const kin = held > 0 ? null : own.kindred?.[0] || null;
  const coins = own.coins || 0;
  const doRaise = async (use) => {
    if (use && use !== 'own' && KINDRED[use] === 'SSR' && def.rarity !== 'SSR') {
      const ok = await confirmDialog(`This is your rarest Essence. Use it on ${def.name}?`, { title: 'Kindred Essence (SSR)', ok: 'Use it', okKind: 'yellow' });
      if (!ok) return;
    }
    const r = raisePotential(profile, def.id, use);
    if (!r.ok) {
      toast(r.error === 'coins' ? `Not enough coins (${coins.toLocaleString('en-US')} needed).` : 'She needs 1 Essence first: a duplicate gives one.', 'bad');
      return;
    }
    store.commit('potential-raise');
    const info = potentialStepInfo(def, r.to);
    toast(`${def.name} reached P${r.to}!${info?.kit ? ` ${info.brief}` : ''}`, 'good', 3600);
    onDone?.();
  };
  const label = `Raise to P${p + 1} · 1 Essence + ${coins.toLocaleString('en-US')} coins`;
  return h('div.pot-raise', { 'data-testid': 'potential-raise' },
    h('span.pot-raise-have', h('b', `Essence ×${held}`), h('span.muted', ` / holds ${essenceCap(st)}`)),
    kin
      ? button(`Use ${ITEMS[kin.id].name} (${kin.have})`, { kind: own.ok ? 'yellow' : 'ghost', small: true, testid: 'potential-kindred', disabled: !own.ok, onClick: () => doRaise(kin.id) })
      : button(label, { kind: own.ok ? 'yellow' : 'ghost', small: true, testid: 'potential-raise-btn', disabled: !own.ok, onClick: () => doRaise('own'), title: own.ok ? '' : held < 1 ? 'A duplicate gives her 1 Essence' : 'Not enough coins' }),
    !own.ok && held < 1 && !kin ? h('span.muted.pot-raise-hint', 'A duplicate gives 1 Essence') : null);
}

const TAG_WORD = { allies: 'Allies', enemies: 'Enemies', coins: 'Coins' };
const tagChips = (tags) => tags.map((t) => h(`span.pot-chip.${t}`, TAG_WORD[t]));

/**
 * The Info tab's Potential section (v2 §7.2, v3 §11): title, rule, the six-node track with the
 * stat line under each node (`+4% SPD`, and `· 67` once Potential raises her level cap), the
 * five-step list (owned ✓, the next one marked, later ones muted; every step shown for a girl not
 * owned, since this is how a player previews her) and the footer. Never locked.
 */
export function potentialSection(def, unitState, { profile = null, onChange = null } = {}) {
  const owned = !!unitState;
  const p = owned ? potentialLevel(unitState) : 0;
  const nodes = potentialView(def, unitState, { capAt: potentialLevelCap });
  const dupes = Math.max(0, Math.floor(Number(unitState?.dupes) || 0));
  const frag = dupeFragments(def);
  const next = potentialNext(def, unitState);
  const sig = nodes[MAX_POTENTIAL - 1];
  let footer;
  if (!owned) footer = 'Recruit her to start at P1.';
  else if (p >= MAX_POTENTIAL) footer = `Potential maxed — a duplicate now gives ${dupePastMaxPay(def)}. Duplicates so far: ${dupes}.`;
  else footer = `Duplicates so far: ${dupes} · Next: ${stepPhrase(next)} with 1 Essence`;
  const firstKit = nodes.find((n) => n.kit)?.step ?? 3;
  // her own page knows her Essence: the next step reads "Essence ready" when she holds one
  const held = profile && owned ? essenceBalance(profile, def.id) : 0;
  // a step's cap is hers once the gate it opens is broken (P(k − 4) opens gate k)
  const gates = gatesOf(unitState);
  const capHers = (n) => gates >= n.step + 4;
  const track = h('ol.pot-track', nodes.map((n) => h(`li.pot-node${n.active ? '.on' : ''}${n.next ? '.next' : ''}${n.kit ? '.kit' : ''}${n.step === MAX_POTENTIAL ? '.sig' : ''}`,
    { 'data-testid': `potential-node-${n.step}`, title: n.step === 1 ? n.long : `P${n.step} ${n.name || ''}: ${n.long}` },
    h('span.pot-node-p', n.step === MAX_POTENTIAL ? crown('pot-node-crown') : null, `P${n.step}`, n.kit ? h('span.pot-node-kit', '✦') : null),
    h('span.pot-node-label', n.step === 1 ? 'Base' : n.short),
    // (a stat step's label already is her stat: its line only adds the cap, once there is one)
    nodeLine(n, { gatesOpen: capHers(n) }))));
  const steps = h('ol.pot-steps', { 'data-testid': 'potential-steps' }, nodes.slice(1).map((n) => h(
    `li.pot-step${n.active ? '.on' : ''}${n.next ? '.next' : ''}${!n.active && !n.next ? '.later' : ''}${n.kit ? '.kit' : ''}${n.step === MAX_POTENTIAL ? '.sig' : ''}`,
    { 'data-testid': `potential-step-${n.step}` },
    h('div.pot-step-head',
      h('span.pot-step-mark', n.active ? '✓' : n.next ? '▸' : ''),
      h('b.pot-step-p', `P${n.step}`),
      h('span.pot-step-name', n.kit ? h('span.pot-glyph', '✦ ') : null, n.name || ''),
      n.step === MAX_POTENTIAL ? crown('pot-step-crown') : null,
      tagChips(n.tags),
      n.next ? h('span.pot-step-next', { 'data-testid': 'potential-next' }, held > 0 ? 'NEXT · Essence ready' : `NEXT · ${moreDupes(next?.dupes ?? 1)}`) : null),
    h('div.pot-step-long', n.long),
    n.cap != null ? h(`div.pot-step-cap${capHers(n) ? '' : '.later'}`, capHers(n) ? `Level cap ${n.cap}` : `Opens gate ${n.step + 4} (level cap ${n.cap})`) : null)));
  // the student page's card look (section.mb-card + h3.mb-card-title, meta-b.css)
  let sec = null;
  const redraw = () => {
    if (onChange) return onChange();
    const fresh = potentialSection(def, profile?.units?.[def.id] || unitState, { profile, onChange });
    sec?.replaceWith(fresh);
  };
  sec = h('section.mb-card.pot-section', { 'data-testid': 'potential-section', id: 'potential' },
    h('h3.mb-card-title', owned ? `Potential · P${p} / ${MAX_POTENTIAL}` : 'Potential'),
    profile && owned ? raiseRow(def, profile, redraw) : null,
    h('p.pot-rule', 'Each duplicate gives her 1 Essence. 1 Essence and coins raise her Potential by 1.'),
    h('p.pot-rule.muted', `Every step makes her stronger; from P${firstKit} each one (✦) also teaches her a new trick, up to her P${MAX_POTENTIAL} capstone. Each step also opens her next level gate past ${potentialLevelCap(1)} (up to ${potentialLevelCap(MAX_POTENTIAL)} at P${MAX_POTENTIAL}).`),
    track,
    steps,
    h('p.pot-footer.muted', { 'data-testid': 'potential-footer' }, footer),
    owned && p < MAX_POTENTIAL && sig ? h('p.pot-footer.muted.pot-footer-sig', `Capstone: P${MAX_POTENTIAL} ✦ ${sig.name} (${moreDupes(dupesToMax(unitState))})`) : null);
  return sec;
}

/** Reveal corner tag: "+1 Essence" (P4 ready when she can raise now), "Spare" past her hold cap. */
export function revealTag(r) {
  if (!r || r.isNew) return null;
  if (r.spare) return h('span.ma-gc-pot.max', { title: `Spare copy: ${spareText(r.spare)}` }, 'Spare');
  if (r.essence) return h(`span.ma-gc-pot${r.readyStep ? '.ready' : ''}`, { title: r.readyStep ? `+1 Essence · P${r.readyStep} ready` : '+1 Essence' }, r.readyStep ? `P${r.readyStep} ready` : '+1 Ess.');
  return null;
}

/** "+6 Mementos · +1 Moonpearl · +1 point" (an R spare: "+2 Mementos · ⅕ point"). */
export function spareText(spare) {
  if (!spare) return '';
  return [
    spare.mementos ? `+${spare.mementos} Memento${spare.mementos === 1 ? '' : 's'}` : null,
    spare.moonpearls ? `+${spare.moonpearls} Moonpearl${spare.moonpearls === 1 ? '' : 's'}` : null,
    spare.points ? `+${spare.points} point${spare.points === 1 ? '' : 's'}` : spare.fifths ? '⅕ point' : null,
  ].filter(Boolean).join(' · ');
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
 * `gatesOf(unitId)` gives her breakthrough gates: the "Level cap 63 → 67" line shows only when her
 * own cap rises (all five gates open; below that her cap is her gates', whatever her P).
 * @param {HTMLElement} host
 * @param {ReturnType<typeof import('../systems/potential.js').potentialRises>} rises
 * @param {{ reduce?: boolean, onDone?: Function, gatesOf?: (unitId: string) => number }} [o]
 * @returns {HTMLElement|null} the layer (null: no card to show)
 */
export function showPotentialUp(host, rises, { reduce = false, onDone = null, gatesOf: gatesFor = null } = {}) {
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
    const gates = gatesFor ? Math.max(0, Math.floor(Number(gatesFor(g.unitId)) || 0)) : MAX_BREAKTHROUGH;
    const a = levelCapAt(gates, g.from);
    const b = levelCapAt(gates, g.to);
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
