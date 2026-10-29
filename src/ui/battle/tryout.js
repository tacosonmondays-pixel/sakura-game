// Tryout Day in battle (docs/specs/TRYOUT_DAY.md §13, M3 Ink & Paper on the battle HUD): the assignment tracker under
// the HUD (its head is the timetable's thin band), the pick sheet at a period end (Pep Talks in their Stationery
// frames §13.1, girls in their own unit frames §13.7), the class bar, the break bar (Window Seats, Hall Pass moves with
// Undo, Snack or Brush Up, Back to class), the Make-up sheet and the Class Photo at the end (§13.9). Solo sends run
// commands straight to the Sim; co-op queues `tr` / `mv` (src/online/coop/commands.js). Reads the Sim, never writes it.
// The sheets carry `ui-day` so the kit's girl tile and rarity tag draw inside the battle (src/ui/styles/ink.css is
// scoped to that class); their own rules are src/ui/styles/tryoutBattle.css, all under .ty-layer.
import { h } from './util.js';
import { fmtNum } from '../format.js';
import { svgEl, girlTile, confirmDialog } from '../components.js';
import { rarityTag, moreSticker } from '../kit.js';
import { onEscape } from '../hold.js';
import { reduced } from '../motion.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { PEP_CARDS, RARITIES, TRYOUT } from '../../data/tryout.js';
import { assignProgress, dareOf, chooserOf } from '../../sim/tryout/index.js';
import { rarityWeights, pityFloor, hasVarsity } from '../../sim/tryout/offers.js';
import { buildTryoutPlan } from '../../sim/tryout/plan.js';
import { passMax } from '../../sim/tryout/breaks.js';
import { cardText, SLOT_NAMES, ASSIGN_TEXT, BREAK_NAMES, MOVE_REASONS, oddsLine, SUBJECT_TEXT, DARE_TEXT, DARE_SHORT, DARE_GAIN, rewardLines, SHARE_TEXT, PHOTO_TEXT, GIRL_CARD_TEXT, TIMETABLE_TEXT, CAP_TEXT, MORE_TEXT, RANDOM_TEXT, EXTENDED_TEXT, WAVE_RECORD_TEXT } from '../text/tryout.js';
import { timetableModel as baseModel, timetableStrip, timetableMini, bandParts, markEl, previewStrip, periodPreview, extendedCells } from './tryout/timetable.js';
import { capBar, barWho, oddsTable, capsTable } from './tryout/caps.js';
import { isRandomRun, isExtendedRun, viewLength, revealOf, revealStep, extendedPast, periodMarks, affixOf, FULL_PERIODS } from './tryout/adapters.js';
import { createHomeTime } from './tryout/homeTime.js';
import { encodeShareCode } from '../../systems/tryoutRuns.js';
import { selectedCosmetic } from '../../systems/tryoutJar.js';
import { store } from '../../core/store.js';
import '../styles/tryoutBattle.css';

const Q = 1024;
/** Stationery frame step by card rarity (§13.1): R flat, SR tinted, SSR glow, UR gold foil, LR Pressed Blossom. */
export const PEP_STEP = Object.freeze(['r', 'sr', 'ssr', 'ur', 'lr']);

/** A card's one-line effect with its numbers in bold (§13.6). */
export function boldNumbers(line) {
  const out = [];
  let at = 0;
  for (const m of String(line || '').matchAll(/[+\u2212-]?\d[\d.,]*\s?(?:%|s\b)?/g)) {
    if (m.index > at) out.push(line.slice(at, m.index));
    out.push(h('b', m[0].trim()));
    at = m.index + m[0].length;
    if (/\s$/.test(m[0])) out.push(' ');
  }
  if (at < String(line || '').length) out.push(line.slice(at));
  return out;
}

/**
 * The Class Photo's stamp grid as data (pure): one row per period of the drawn table (an Extended Day: P1-P12), each
 * with its label, its marks for player `slot` (periodMarks: a shrunk Extended Day row draws its count, §20.6), its
 * score and its pick's rarity; a period not reached is `absent`.
 * @param {{ periods: object[] }} res sim.result().tryout
 * @param {{ picks: object[] }} pl that result's player
 * @param {object} len the drawn length table (viewLength)
 * @returns {Array<{ p: number, label: string, absent: boolean, marks: Array<[string|null, number]>, score: number|null, rarity: number|null, resumed: boolean }>}
 */
export function stampRows(res, pl, len, slot = 0, { extended = false } = {}) {
  const byPeriod = new Map((res?.periods || []).filter((x) => x && typeof x === 'object').map((x) => [x.period, x]));
  const picks = Array.isArray(pl?.picks) ? pl.picks : [];
  const rows = [];
  for (let p = 1; p <= len.periods; p++) {
    const rec = byPeriod.get(p) || null;
    const pk = picks.find((x) => len.picks[x.pick - 1] === p) || null;
    const label = p === len.periods && !extended ? TIMETABLE_TEXT.final : TIMETABLE_TEXT.cell(p);
    rows.push({ p, label, absent: !rec, marks: rec ? periodMarks(rec, slot) : [], score: rec ? rec.score : null, rarity: pk ? pk.rarity : null, resumed: !!rec?.resumed });
  }
  return rows;
}

/** The kit's rarity tag for a rarity index (navy plate, rarity-coloured letters). */
const rTag = (r, o) => rarityTag(RARITIES[r] || 'R', o);

/**
 * @param {object} ctx battle context (controller.js)
 * @param {{ mySlot: number, send: (kind: 'tr'|'mv', args: any[]) => any }} o
 */
export function createTryoutBattle(ctx, { mySlot = 0, send }) {
  const { sim } = ctx;
  const ty = () => sim.tryout;
  const me = () => ty().players[mySlot];
  // Extended Day (§20.8, minimal): the UI draws the Full Day's twelve (finite loops), and past wave 48 counts waves;
  // Random Class (§20.4): the pick sheet is a reveal, no buttons (both read through ./tryout/adapters.js)
  const len = viewLength(ty());
  const random = isRandomRun(ty());
  const extended = isExtendedRun(ty());
  // Extended Day past wave 48: Home Time for the wave control's pill (solo: asks, then ends the run; co-op: my vote)
  const homeTime = extended ? createHomeTime(ctx, { mySlot, confirm: confirmDialog }) : null;
  if (homeTime) ctx.homeTime = homeTime;
  /** The strip's cells (an Extended Day: P12 is not the Final, the day goes on after it). */
  const timetableModel = (...a) => (extended ? extendedCells(baseModel(...a)) : baseModel(...a));
  let moving = null; // uid of the girl a Hall Pass is moving
  let shown = '';
  // the pick sheet's timetable preview (the key of the open cell, kept over a repaint) and its MORE sheet
  let pickStrip = null;
  let ttOpen = null;
  let moreOpen = false;
  let offMoreEsc = null;
  let offMoreTab = null;
  /** The run's plan (pure: its seed, Grade, length and map), for the timetable previews. */
  let planMemo = null;
  // (an Extended Day previews the Full Day's plan: §20.1, P1-12 are exactly the Full Day)
  const plan = () => planMemo || (planMemo = buildTryoutPlan({ seed: ty().seed, grade: ty().grade, length: isExtendedRun(ty()) ? 'full' : ty().length, mapId: ty().mapId }));
  // co-op Subject suggestions (§11): a room note outside lockstep (session.sendNote / 'note'), never a sim
  // command. mySuggest: what I suggested to the chooser; allySuggest: what my ally suggested to me
  let mySuggest = null; // { period, k }
  let allySuggest = null; // { period, k }
  const session = () => ctx.coop?.session || null;
  const offNote = session()?.on?.('note', (n) => {
    if (n?.kind !== 'subject') return;
    allySuggest = { period: n.period, k: n.k };
    last = ''; // repaint the class bar on the next frame
  }) || null;
  function suggest(period, k) {
    if (!session()?.sendNote?.({ kind: 'subject', period, k })) return;
    mySuggest = { period, k };
    last = '';
  }

  // ---- tracker -------------------------------------------------------------------------------------
  const head = h('div.ty-head', { 'data-testid': 'ty-head' });
  const mini = h('div.ty-head-mini', { 'data-testid': 'ty-band' });
  const chips = h('div.ty-chips');
  const odds = h('div.ty-odds', { 'data-testid': 'ty-odds' });
  const tracker = h('div.ty-tracker', { 'data-testid': 'ty-tracker' }, head, mini, chips, odds);

  // ---- pick sheet / break bar / result ------------------------------------------------------------
  const sheet = h('div.ty-sheet-wrap', { 'data-testid': 'ty-pick', hidden: true });
  const brk = h('div.ty-break', { 'data-testid': 'ty-break', hidden: true });
  const cls = h('div.ty-class', { 'data-testid': 'ty-class', hidden: true });
  const photo = h('div.ty-sheet-wrap', { 'data-testid': 'ty-photo', hidden: true });
  const el = h('div.ty-layer', tracker, cls, sheet, brk, photo);
  ctx.layer.append(el);
  /** A sheet (the pick, the Make-up Test, the Class Photo) covers the board: the tracker steps aside (phones: it covered the title). */
  const syncSheets = () => {
    tracker.hidden = !sheet.hidden || !photo.hidden;
  };

  /** Credits if every assignment still open clears (locked-in ones, open ones on track, a banked hand-in). */
  function liveCredits() {
    const list = assignProgress(sim, mySlot);
    return Math.min(TRYOUT.creditsMax, list.filter((a) => a.st !== -1 && !a.resumed).length + (me().bank || 0));
  }

  /** The pick after the period in play (between periods: after the coming one). */
  function nextPickNo() {
    const t = ty();
    const p = t.base ? t.period : t.assign?.period ?? t.period + 1;
    const i = len.picks.indexOf(p);
    return i >= 0 ? i + 1 : 0;
  }

  function paintTracker() {
    const t = ty();
    // between periods the chips are the coming period's: the head says so ("Next · P4")
    const p = t.base ? t.period : t.assign?.period ?? t.period + 1;
    // the head is the timetable's thin band (§13.4): "P3 · wave 2/4 · Science", the Grade twist, the score, and
    // under it the run's cells in miniature
    const band = bandParts(t, len, sim.wave);
    let label = t.base ? band.label : p >= len.periods ? TIMETABLE_TEXT.final : TIMETABLE_TEXT.cell(p);
    // Extended Day: P12 is not the Final; past the Full Day's 48 waves the head counts waves ("Wave 53 · Stay Late")
    const past = extendedPast(sim, t.base ? sim.wave : sim.wave + 1);
    if (extended && label === TIMETABLE_TEXT.final) label = TIMETABLE_TEXT.cell(Math.min(p, FULL_PERIODS));
    if (past) label = EXTENDED_TEXT.wave(past.wave);
    head.replaceChildren(...[
      h('span.ty-band', past ? { 'data-testid': 'ty-band-wave' } : null,
        t.base ? null : h('span.ty-band-next', `${TIMETABLE_TEXT.next} · `),
        h('b.ty-band-p', label),
        past ? h('span', ` · ${EXTENDED_TEXT.stayLate}`) : band.wave ? h('span', ` · ${band.wave}`) : null,
        // while a period runs, its Subject (the class rule in play) is named in the head
        band.subject ? h('span.ty-head-subj', { 'data-testid': 'ty-head-subject', title: band.subjectLine }, ` · ${band.subject}`) : null,
        // a Grade 8+ period affix (sim.tryout.affixes[period], a TRYOUT.dares id)
        // (an Extended Day past P12: the same per-period draw, affixOf)
        affixOf(t, p) ? h('span.ty-head-affix', { 'data-testid': 'ty-head-affix', title: DARE_TEXT[affixOf(t, p)] }, ` · ${DARE_SHORT[affixOf(t, p)] || affixOf(t, p)}`) : null,
        t.base && t.dare ? h('span.ty-head-dare', { title: TIMETABLE_TEXT.dare }, ' ⚑') : null),
      h('span.ty-score', `Score ${fmtNum(t.score + t.periodScore, 'count', { detail: true })}`),
    ].filter(Boolean));
    mini.replaceChildren(timetableMini(timetableModel(t, len, { mySlot, win: me().win })));
    const list = assignProgress(sim, mySlot);
    chips.replaceChildren(...list.map((x) => {
      const txt = ASSIGN_TEXT[x.id];
      // open ring (in play), sakura stamp (locked in), grey ink strike (missed; never red), a "resumed" tag (§13.5)
      return h(`div.ty-chip.ty-st${x.resumed ? 'r' : x.st}`, { 'data-testid': `ty-chip-${x.id}`, title: txt?.name },
        markEl(x.resumed ? 0 : x.st),
        h('span.ty-chip-name', txt?.name || x.id),
        x.resumed ? h('span.ty-chip-tag', TIMETABLE_TEXT.resumed)
          : h('span.ty-chip-live', x.st !== 0 ? (x.st > 0 ? 'done' : 'missed') : txt?.live?.(x) || ''));
    }));
    const pick = nextPickNo();
    if (pick > 0) {
      const p = me();
      const w = rarityWeights(len.bands[pick - 1], liveCredits(), pityFloor(p, pick, len), p.lr >= len.lrCap);
      odds.textContent = `Next pick, if the open ones clear: ${oddsLine(w)}`;
      odds.hidden = false;
    } else odds.hidden = true;
  }

  // ---- the pick ------------------------------------------------------------------------------------
  /** Is she in this player's own pool (Yours · plays in the band) or a Loaner? */
  const isOwned = (id) => !!sim._tryoutCfg?.pools?.[mySlot]?.[id];

  /** Her tile in her own unit frame (§13.1: girls keep theirs), inert inside the card that is the button. */
  function tile(id, cls = '') {
    const el = girlTile(id, { owned: true, potential: 0, cls });
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('title');
    // (a sheet shows her at once: the card art loads now, not when the browser gets round to a lazy image)
    el.querySelector('img')?.setAttribute('loading', 'eager');
    return el;
  }

  /** A girl card (§13.7): her tile, name, role and type, Yours or Loaner, her arrival package, the path buttons. */
  function girlCard(c, i, o) {
    const def = UNIT_MAP[c.girl];
    const owned = isOwned(c.girl);
    // her arrival tiers go on a path she picks (§5): a tap on the card takes the first one
    const pack = TRYOUT.arrival[Math.max(0, Math.min(4, o.rarity - (TRYOUT.grades[ty().grade]?.arrivalDown || 0)))];
    const tier = pack.tier;
    const paths = tier > 0 ? def?.paths || [] : [];
    const pathRow = paths.length > 1 && !random ? h('span.ty-paths', ...paths.map((pa, k) => h('button.bt-btn.ty-path', {
      'data-testid': `ty-path-${i}-${k}`, onclick: (e) => { e.stopPropagation(); take(i, k); },
    }, pa.name || `Path ${k + 1}`))) : null;
    const G = GIRL_CARD_TEXT;
    const arrival = [tier > 0 ? G.freeAt(tier) : G.free, pack.varsity ? G.varsity : null, pack.talent ? G.talent : null].filter(Boolean).join(' · ');
    return h('div.ty-gcard', { 'data-testid': `ty-card-${i}`, role: 'button', tabindex: 0, 'aria-label': `${def?.name || c.girl}, ${G.joins}`,
      onclick: () => take(i, 0), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(i, 0); } } },
      tile(c.girl),
      h('span.ty-gcard-body',
        h('span.ty-gcard-top', h('span.ty-slot', o.kind === 'girls' ? 'Tryout' : SLOT_NAMES[i] || 'Wild'),
          h(`span.ty-tag${owned ? '.own' : ''}`, owned ? G.yours : G.loaner(ty().level))),
        h('b.ty-card-nm', def?.name || c.girl),
        h('span.ty-card-ln', `${ROLES[def?.role]?.name || ''} · ${def?.attackType || ''}`),
        h('span.ty-card-ln.ty-mute', `${G.joins} · ${arrival}`),
        pathRow));
  }

  /** A squad girl trying out again: Varsity (§5), with a small pennant. */
  function varsityCard(c, i) {
    const def = UNIT_MAP[c.varsityGirl];
    const v = TRYOUT.varsity;
    const pc = (x) => Math.round(x * 100);
    return h('div.ty-gcard.ty-varsity', { 'data-testid': `ty-card-${i}`, role: 'button', tabindex: 0, 'aria-label': `${def?.name || c.varsityGirl}, ${GIRL_CARD_TEXT.varsity}`,
      onclick: () => take(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(i); } } },
      tile(c.varsityGirl),
      h('span.ty-pennant', GIRL_CARD_TEXT.varsity),
      h('span.ty-gcard-body',
        h('span.ty-gcard-top', h('span.ty-slot', SLOT_NAMES[i] || 'Wild')),
        h('b.ty-card-nm', def?.name || c.varsityGirl),
        h('span.ty-card-ln', GIRL_CARD_TEXT.againTitle),
        h('span.ty-card-ln', ...boldNumbers(GIRL_CARD_TEXT.againLine(pc(v.damageMul), pc(v.rateMul), pc(v.costCut))))));
  }

  /** A Pep Talk in its Stationery frame (§13.1): slot, rarity tag, name, the effect with its numbers in bold. */
  function pepCard(c, i) {
    const t = cardText(c);
    const card = PEP_CARDS[c.id];
    const step = PEP_STEP[c.r] || 'r';
    return h(`button.ty-stn.${step}${c.unit ? '.art' : ''}`, { 'data-testid': `ty-card-${i}`, 'data-rarity': RARITIES[c.r], onclick: () => take(i) },
      step === 'ur' ? h('span.ty-glint', { 'aria-hidden': 'true' }) : null,
      step === 'lr' ? h('span.ty-blossom', { 'aria-hidden': 'true' }) : null,
      h('span.ty-stn-top', h('span.ty-slot', SLOT_NAMES[i] || 'Wild'), rTag(c.r)),
      c.unit ? svgEl(portraitHTML(UNIT_MAP[c.unit], 'thumb', { eager: true }), 'ty-stn-art') : null,
      h('b.ty-card-nm', t.name),
      h('span.ty-card-ln', ...boldNumbers(t.line)),
      card?.group === 'board' && ty().coop && (c.id === 'B02' || c.id === 'B04') ? h('span.ty-card-ln.ty-mute', 'Team-wide') : null,
      capRow(c, i));
  }

  /**
   * The card's cap bar (§4.4, §13.6): its main family for the girl it reaches (a Team or Group card: the one the cap
   * cuts most), how full that cap is now (ink) and after taking it (cyan); "full value for 4 of 5" when the cap cuts some.
   */
  function capRow(c, i) {
    const bar = capBar(sim, mySlot, c);
    if (!bar) return null;
    const pc = (v) => `${Math.round(Math.max(0, Math.min(1, v / bar.cap)) * 1000) / 10}%`;
    // a Team or Group card that adds in full to everyone it reaches: only what it adds ("Damage +6% to all 5"; its bar
    // is that share of each girl's cap). Else the girl the cap cuts most, her now → after, and on how many it adds in full
    if (bar.all) {
      const spoken = CAP_TEXT.toAllBar(bar.famName, bar.addText, bar.of, bar.capText);
      return h('span.ty-cap.all', { 'data-testid': `ty-cap-${i}`, title: spoken },
        h('span.ty-cap-ln', bar.text),
        h('span.ty-cap-bar', { role: 'img', 'aria-label': spoken },
          h('i.ty-cap-add', { style: { left: '0%', width: pc(bar.value) } })));
    }
    const who = barWho(bar);
    const part = bar.of > 1 ? ` · ${CAP_TEXT.fully(bar.full, bar.of)}` : '';
    const label = `${who} · ${bar.text}${part}`;
    return h('span.ty-cap', { 'data-testid': `ty-cap-${i}`, title: label },
      h('span.ty-cap-ln', h('b.ty-cap-who', who), ` · ${bar.text}`, part ? h('span.ty-cap-part', part) : null),
      h('span.ty-cap-bar', { role: 'img', 'aria-label': label },
        h('i.ty-cap-now', { style: { width: pc(bar.now) } }),
        h('i.ty-cap-add', { style: { left: pc(bar.now), width: pc(bar.after - bar.now) } })));
  }

  // ---- MORE: the odds table for this pick and the per-girl caps (§3.4, §4.4, §13.6) -------------------------------
  function morePanel(o) {
    const p = me();
    const band = len.bands[o.pick - 1] || 'early';
    const lrOff = p.lr >= len.lrCap;
    const rows = oddsTable({ band, credits: o.credits, floor: o.floor || 0, lrOff });
    const M = MORE_TEXT;
    const closeBtn = h('button.ty-more-x', { type: 'button', 'data-testid': 'ty-more-close', 'aria-label': M.back, title: M.back, onclick: () => closeMore(true) }, '×');
    // (a follow-up offer, e.g. Show Her Around's girls, rolls no rarity: no odds table, the caps only)
    const odds = o.follow ? null : h('div.ty-more-col', { 'data-testid': 'ty-more-odds' },
      h('b.ty-more-h', M.odds),
      h('span.ty-more-sub', M.oddsLine(o.pick, M.bands[band] || band, o.credits)),
      h('table.ty-more-t',
        h('thead', h('tr', h('th', { scope: 'col' }, M.credits), ...RARITIES.map((r, k) => h('th', { scope: 'col' }, rTag(k))))),
        h('tbody', ...rows.map((row) => h(`tr${row.current ? '.cur' : ''}`, { 'data-testid': row.current ? 'ty-more-odds-cur' : null, 'aria-current': row.current ? 'true' : null },
          h('th', { scope: 'row' }, String(row.credits)), ...row.pct.map((x) => h(`td${x ? '' : '.z'}`, x ? `${x}` : M.none)))))),
      o.floor > 0 ? h('span.ty-more-note', M.floor(RARITIES[o.floor])) : null,
      lrOff ? h('span.ty-more-note', M.lrOff) : null);
    const caps = h('div.ty-more-col', { 'data-testid': 'ty-more-caps' },
      h('b.ty-more-h', M.caps),
      h('span.ty-more-sub', M.capsLine),
      h('table.ty-more-t.caps',
        h('thead', h('tr', h('th', { scope: 'col' }, M.family), h('th', { scope: 'col' }, M.cap), h('th', { scope: 'col' }, M.top))),
        h('tbody', ...capsTable(sim, mySlot).map((r) => h('tr', { 'data-testid': `ty-more-cap-${r.id}` },
          h('th', { scope: 'row' }, M.rows[r.id] || r.id), h('td.cap', r.cap),
          h('td.top', r.top ? `${r.top}${r.who ? ` · ${r.who}` : ''}` : M.none))))));
    const box = h('div.ty-sheet.ty-more.ui-day', { role: 'dialog', 'aria-modal': 'true', 'aria-label': M.title, 'data-testid': 'ty-more-sheet' },
      h('div.ty-shead', h('b.ty-stitle', M.title), closeBtn),
      h(`div.ty-more-body${odds ? '' : '.one'}`, odds, caps));
    return h('div.ty-more-wrap', { onclick: (e) => { if (e.target === e.currentTarget) closeMore(true); } }, box);
  }

  /** Keeps Tab inside a modal box: the last focusable wraps to the first and back (from outside it: into it). */
  function trapTab(e, box) {
    if (e.key !== 'Tab') return;
    const all = [...box.querySelectorAll('button, [href], select, input, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.getClientRects().length);
    if (!all.length) return;
    const first = all[0];
    const last = all[all.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !box.contains(at))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (at === last || !box.contains(at))) {
      e.preventDefault();
      first.focus();
    }
  }

  /** While MORE is open the pick sheet under it is inert (no focus, no taps): focus never leaves the modal. */
  function inertUnder(on) {
    for (const x of sheet.children) if (!x.classList.contains('ty-more-wrap')) x.inert = on;
  }

  function openMore() {
    moreOpen = true;
    ttOpen = null; // (a preview card does not come back under the MORE sheet)
    shown = ''; // (repaint the sheet with the panel over it)
    paintPick();
    sheet.querySelector('[data-testid="ty-more-close"]')?.focus({ preventScroll: true });
  }

  function closeMore(focus = false) {
    if (!moreOpen) return;
    moreOpen = false;
    offMoreEsc?.();
    offMoreEsc = null;
    sheet.querySelector('.ty-more-wrap')?.remove();
    offMoreTab?.();
    offMoreTab = null;
    inertUnder(false);
    if (focus) sheet.querySelector('[data-testid="ty-more"]')?.focus({ preventScroll: true });
  }

  function paintPick() {
    const p = me();
    const o = p.offer;
    const key = o ? `${o.seq}:${p.erasers}:${ty().players.map((x) => x.win).join()}` : '';
    if (key === shown) return;
    shown = key;
    // (the old sheet's preview card lets go of its listeners; its key comes back on the new strip)
    const keep = ttOpen;
    pickStrip?.close();
    pickStrip = null;
    ttOpen = o ? keep : null;
    // (Random Class: the card the last reveal landed on, said once in the feed when its sheet closes)
    if (random && rvLast && rvLast.seq !== o?.seq) {
      ctx.feed?.push(rvLast.name ? RANDOM_TEXT.landed(rvLast.name) : RANDOM_TEXT.handed, 'good', { key: 'ty-random', ms: 2200 });
      rvLast = null;
    }
    if (!o) {
      closeMore();
      sheet.hidden = true;
      syncSheets();
      return;
    }
    if (random) return paintReveal(o);
    const pay = Math.floor((TRYOUT.handIn.base + TRYOUT.handIn.perPeriod * ty().period) * sim.cashScale);
    const last = o.pick === len.picks.length;
    const why = ty().periods.length ? ty().periods[ty().periods.length - 1] : null;
    // the top band: the period's stamps, then "3 credits → SSR" and the Teacher's Note (§13.6)
    // (periodMarks: a full row's marks, or a shrunk Extended Day row's count, §20.6)
    const reasons = why ? periodMarks(why, mySlot).filter(([id]) => id).map(([id, st]) => h('span.ty-why', markEl(st), ASSIGN_TEXT[id]?.name || id)) : [];
    if (p.bank) reasons.push(h('span.ty-why', markEl(1), 'Handed in'));
    const partner = ty().coop ? ty().players.find((_, i) => i !== mySlot) : null;
    const cards = o.cards.map((c, i) => (c.girl ? girlCard(c, i, o) : c.varsityGirl ? varsityCard(c, i) : pepCard(c, i)));
    // (a repaint under an open MORE keeps its focus: the same control, else its close button; fix check, Oct 29)
    const moreFocus = moreOpen && sheet.querySelector('.ty-more-wrap')?.contains(document.activeElement) ? document.activeElement : null;
    const moreFocusId = moreFocus?.dataset?.testid || null;
    sheet.replaceChildren(h('div.ty-sheet.ty-pick-sheet.ui-day', { role: 'dialog', 'aria-label': `Pick ${o.pick}` },
      h('div.ty-shead',
        h('b.ty-stitle', o.kind === 'girls' ? `Pick ${o.pick} · Tryouts` : `Pick ${o.pick} · Pep Talk`),
        h('span.ty-credits', `${o.credits} credit${o.credits === 1 ? '' : 's'} → `, rTag(o.rarity, { testid: 'ty-pick-rarity' })),
        o.floor > 0 ? h('span.ty-note', `Teacher's Note: at least ${RARITIES[o.floor]}`) : null),
      reasons.length ? h('div.ty-reasons', ...reasons) : null,
      (pickStrip = previewStrip(timetableModel(ty(), len, { mySlot, win: p.win }),
        (n, cell) => periodPreview(plan(), n, { subjects: ty().subjects?.[n] || null, chosen: cell.chosen }),
        { cls: 'ty-tt-sheet', wrapCls: 'ty-ttw-sheet', open: ttOpen, onToggle: (k) => { ttOpen = k; } })).el,
      h(`div.ty-deck.n${cards.length}`, ...cards),
      h('div.ty-acts',
        h('button.bt-btn', { 'data-testid': 'ty-erase', disabled: p.erasers <= 0, onclick: () => send('tr', ['erase', o.seq]) }, `Eraser (${p.erasers})`),
        h('button.bt-btn', { 'data-testid': 'ty-hand', onclick: () => send('tr', ['hand', o.seq]) }, `Hand it in later (+${fmtNum(pay, 'money')}${last ? '' : ' · next pick +1'})`),
        partner ? h('span.ty-mute', { 'data-testid': 'ty-partner' }, partner.win === 'pick' ? 'Partner: choosing…' : 'Partner: ✓') : null,
        h('span.ty-acts-more', moreSticker(() => (moreOpen ? closeMore(true) : openMore()), { testid: 'ty-more', label: MORE_TEXT.label })))));
    if (moreOpen) {
      const wrap = morePanel(o);
      sheet.append(wrap);
      inertUnder(true);
      // (aria-modal: Tab and Shift+Tab stay inside the sheet while it is open, wherever the focus was)
      const box = wrap.querySelector('[data-testid="ty-more-sheet"]');
      const onTab = (e) => trapTab(e, box);
      offMoreTab?.();
      document.addEventListener('keydown', onTab, true);
      offMoreTab = () => document.removeEventListener('keydown', onTab, true);
      offMoreEsc?.();
      offMoreEsc = onEscape(() => closeMore(true));
      if (moreFocus) (box.querySelector(`[data-testid="${moreFocusId}"]`) || box.querySelector('[data-testid="ty-more-close"]'))?.focus({ preventScroll: true });
    }
    sheet.hidden = false;
    syncSheets();
  }

  // ---- Random Class: the pick reveal (§20.4, §20.8) --------------------------------------------------------------
  // The sheet deals the offer's cards with a "Random Class" ribbon and no buttons; a highlight steps across them and
  // lands on the card the Sim will take (revealOf / revealStep: the Sim's own ticks, never the clock). Reduce Motion:
  // no stepping, the drawn card marked at once. The Sim lands the pick at its tick; the sheet then closes.
  let rvKey = '';
  let rvLast = null; // { seq, name } of the open reveal's drawn card
  /** A drawn card's name for the feed. */
  function drawnName(c) {
    if (!c) return null;
    if (c.girl) return UNIT_MAP[c.girl]?.name || c.girl;
    if (c.varsityGirl) return `${UNIT_MAP[c.varsityGirl]?.name || c.varsityGirl} · ${GIRL_CARD_TEXT.varsity}`;
    return cardText(c).name;
  }
  function paintReveal(o) {
    const partner = ty().coop ? ty().players.find((_, i) => i !== mySlot) : null;
    const cards = o.cards.map((c, i) => {
      const el = c.girl ? girlCard(c, i, o) : c.varsityGirl ? varsityCard(c, i) : pepCard(c, i);
      // (taps do nothing: the Sim chooses; the cards stay readable, out of the tab order)
      el.tabIndex = -1;
      el.setAttribute('aria-disabled', 'true');
      el.removeAttribute('role');
      return el;
    });
    rvKey = '';
    sheet.replaceChildren(h('div.ty-sheet.ty-pick-sheet.ty-rv-sheet.ui-day', { role: 'dialog', 'aria-label': `Pick ${o.pick} · ${RANDOM_TEXT.ribbon}`, 'data-testid': 'ty-reveal' },
      h('span.ty-ribbon.ty-rv-ribbon', { 'data-testid': 'ty-reveal-ribbon' }, RANDOM_TEXT.ribbon),
      h('div.ty-shead',
        h('b.ty-stitle', o.kind === 'girls' ? `Pick ${o.pick} · Tryouts` : `Pick ${o.pick} · Pep Talk`),
        o.follow ? null : h('span.ty-credits', `${o.credits} credit${o.credits === 1 ? '' : 's'} → `, rTag(o.rarity, { testid: 'ty-pick-rarity' })),
        h('span.ty-rv-state', { 'data-testid': 'ty-reveal-state', 'aria-live': 'polite' }, RANDOM_TEXT.drawing)),
      h(`div.ty-deck.ty-rv-deck.n${cards.length}`, { 'data-testid': 'ty-reveal-deck' }, ...cards),
      partner ? h('span.ty-mute', { 'data-testid': 'ty-partner' }, partner.win === 'pick' ? 'Partner: drawing…' : 'Partner: ✓') : null));
    sheet.classList.add('ty-rv-wrap');
    sheet.hidden = false;
    syncSheets();
    stepReveal();
  }

  /** Every frame (update): moves the highlight as the Sim's ticks go by; cheap when nothing changed. */
  function stepReveal() {
    if (!random || sheet.hidden) return;
    const deck = sheet.querySelector('.ty-rv-deck');
    const r = revealOf(sim, mySlot);
    if (!deck || !r) return;
    if (Number.isInteger(r.index)) rvLast = { seq: r.seq, name: r.index >= 0 ? drawnName(r.card || me().offer?.cards?.[r.index]) : null };
    const st = revealStep(r, deck.children.length, { reduced: reduced() });
    const key = `${r.seq}:${st.at}:${st.landed}`;
    if (key === rvKey) return;
    rvKey = key;
    [...deck.children].forEach((c, i) => {
      c.classList.toggle('ty-rv-on', i === st.at && !st.landed);
      c.classList.toggle('ty-rv-got', i === st.at && st.landed);
    });
    deck.dataset.at = String(st.at);
    deck.dataset.landed = st.landed ? 'true' : 'false';
    const state = sheet.querySelector('[data-testid="ty-reveal-state"]');
    if (state) state.textContent = st.landed ? RANDOM_TEXT.landing : RANDOM_TEXT.drawing;
  }

  function take(i, path = 0) {
    // (Random Class: the Sim takes every pick; a tap on a card does nothing)
    if (random) return;
    const o = me().offer;
    if (!o) return;
    const r = send('tr', ['take', o.seq, i, path]);
    if (r && r.ok === false && r.reason === 'squadFull') ctx.feed?.push('Your squad is full.', 'warn', { key: 'ty-full', ms: 1600 });
  }

  // ---- between periods: the class choice and Double Dare (§2.4, §8.3) ------------------------------
  function paintClass() {
    const t = ty();
    const next = t.period + (t.started >= t.period ? 1 : 0);
    // (an Extended Day has no last period: the class choice comes before every one)
    // (Random Class: the class choice waits while my reveal is open, so the reveal sheet never covers it)
    if (t.base || t.done || sim.state === 'wave' || sim.state === 'won' || sim.state === 'lost' || (!extended && next > len.periods) || t.started < 1
      || (random && me().win === 'pick')) {
      cls.hidden = true;
      return;
    }
    const pair = t.subjects[next];
    const mine = chooserOf(t, next) === mySlot;
    const chosen = pair ? (pair.includes(t.nextSubject) ? t.nextSubject : pair[0]) : null;
    const dare = dareOf(t, next);
    const partner = t.coop ? t.players.find((_, i) => i !== mySlot) : null;
    // co-op: the chooser sees the ally's suggestion; the other player's taps suggest (a room note, §11)
    const sugg = mine && partner && allySuggest?.period === next && pair?.[allySuggest.k] ? pair[allySuggest.k] : null;
    const mySug = !mine && mySuggest?.period === next ? mySuggest.k : -1;
    const twist = (id) => [
      h('span.ty-long.ty-mute', ` ${SUBJECT_TEXT[id]?.line || ''}`),
      h('span.ty-short', SUBJECT_TEXT[id]?.short || SUBJECT_TEXT[id]?.line || ''),
    ];
    cls.replaceChildren(...[
      pair ? h('div.ty-class-row',
        h('b.ty-class-q', mine ? 'Next class:' : 'Next class (partner picks; tap to suggest):'),
        ...pair.map((id, k) => h(`button.bt-btn.ty-subject${id === chosen ? '.on' : ''}${k === mySug ? '.sug' : ''}`, {
          'data-testid': `ty-subject-${k}`, title: SUBJECT_TEXT[id]?.line,
          'aria-pressed': mine ? String(id === chosen) : String(k === mySug),
          onclick: () => (mine ? send('tr', ['subject', k]) : suggest(next, k)),
        }, h('b', SUBJECT_TEXT[id]?.name || id), ...twist(id)))) : null,
      sugg ? h('div.ty-suggest', { 'data-testid': 'ty-suggest' }, 'Your ally suggests: ', h('b', SUBJECT_TEXT[sugg]?.name || sugg)) : null,
      mySug >= 0 && pair ? h('div.ty-suggest', { 'data-testid': 'ty-suggested' }, 'You suggested: ', h('b', SUBJECT_TEXT[pair[mySug]]?.name || pair[mySug])) : null,
      affixOf(t, next) ? h('div.ty-class-row.ty-affix', { 'data-testid': 'ty-class-affix' }, h('b', 'Grade twist: '), DARE_SHORT[affixOf(t, next)] || affixOf(t, next),
        h('span.ty-long.ty-mute', ` (${DARE_TEXT[affixOf(t, next)] || ''})`)) : null,
      // (Random Class: no Double Dare, §20.4)
      random ? null : h('div.ty-class-row',
        h(`button.bt-btn.ty-dare${me().dare ? '.on' : ''}`, { 'data-testid': 'ty-dare', onclick: () => send('tr', ['dare', me().dare ? 0 : 1]) },
          `Double Dare: ${me().dare ? 'on' : 'off'} · ${DARE_SHORT[dare.id] || dare.id}`),
        h('span.ty-long.ty-mute', ` ${DARE_TEXT[dare.id] || dare.id} · ${DARE_GAIN}${t.coop ? ' · both must tap' : ''}`),
        h('span.ty-short', { 'data-testid': 'ty-dare-gain' }, `${DARE_GAIN}${t.coop ? ' · both tap' : ''}`),
        partner ? h('span.ty-partner-dare', ` Partner: ${partner.dare ? 'on' : 'off'}`) : null),
    ].filter(Boolean)); // (replaceChildren would print a null)
    cls.hidden = false;
  }

  // ---- the break -----------------------------------------------------------------------------------
  function paintBreak() {
    const p = me();
    if (p.win !== 'break') {
      brk.hidden = true;
      moving = null;
      return;
    }
    const kind = len.breaks[ty().period] || 'recess';
    const max = Math.max(p.passes, passMax(sim)); // (Extra Pocket: 6)
    const dots = h('span.ty-passes', { 'aria-label': `${p.passes} of ${max}` },
      ...Array.from({ length: max }, (_, k) => h(`i.ty-pass${k < p.passes ? '.on' : ''}`)));
    // (Brush Up raises a scaling card: one with numbers at every rarity, as breaks.js brushUp checks)
    const scaling = p.cards.map((c, i) => ({ c, i })).filter(({ c }) => (PEP_CARDS[c.id]?.mods || PEP_CARDS[c.id]?.steps) && PEP_CARDS[c.id].rar.length >= 4 && c.r < 3);
    const full = sim.lives >= sim.maxLives;
    const rise = Math.min(TRYOUT.snack.fullMax, Math.max(0, TRYOUT.heartsMaxRise - ty().heartsAdded));
    brk.replaceChildren(
      h('div.ty-break-title', h('b.ty-break-name', BREAK_NAMES[kind]), h('span', ' · Seat Change · Hall Passes '), dots),
      h('div.ty-break-hint', moving ? `Tap where ${sim.getTower(moving)?.def.name || 'she'} should sit.` : 'New Window Seats (dashed) count from the next period. Tap one of your girls to move her.'),
      h('div.ty-acts',
        h('button.bt-btn', { 'data-testid': 'ty-undo', disabled: !p.undo.length, onclick: () => send('tr', ['undo']) }, 'Undo'),
        h('button.bt-btn', { 'data-testid': 'ty-snack', disabled: p.snack, onclick: () => send('tr', ['snack']) }, !sim.canHeal() ? 'Snack (+1 pass)' : full ? (rise > 0 ? `Snack (+${rise} max ♥)` : 'Snack (hearts full)') : `Snack (+${ty().coop ? TRYOUT.snack.coopHeal : TRYOUT.snack.heal} ♥)`),
        scaling.length && !p.snack ? h('select.ty-brushup', { 'data-testid': 'ty-brush', onchange: (e) => { if (e.target.value !== '') send('tr', ['brush', Number(e.target.value)]); } },
          h('option', { value: '' }, 'Brush Up…'), ...scaling.map(({ c, i }) => h('option', { value: String(i) }, `${cardText(c).name} ${RARITIES[c.r]} → ${RARITIES[c.r + 1]}`))) : null,
        h('button.bt-cta', { 'data-testid': 'ty-ready', onclick: () => { moving = null; send('tr', ['ready']); } }, 'Back to class')));
    brk.hidden = false;
  }

  /** A board tap during my break: pick up one of my girls, then put her down. @returns {boolean} used */
  function handleTap(p) {
    if (ctx.ended || me().win !== 'break') return false;
    const t = p.towerUid != null ? sim.getTower(p.towerUid) : null;
    const mine = (x) => x && !x.isHero && (x.owner ?? 0) === mySlot;
    if (moving == null) {
      if (!mine(t)) return false;
      moving = t.uid;
      ctx.renderer?.setSelected?.(t.uid, null);
      paintBreak();
      return true;
    }
    if (t && t.uid === moving) {
      moving = null;
      ctx.renderer?.setSelected?.(null, null);
      paintBreak();
      return true;
    }
    if (!p.inBounds) return true;
    let qx = Math.round(p.x * Q);
    const qy = Math.round(p.y * Q);
    if (qx % Q === 0 && qy % Q === 0) qx += 1;
    const r = send('mv', [moving, qx, qy]);
    if (r && r.ok === false) ctx.feed?.push(MOVE_REASONS[r.reason] || 'She can\'t sit there.', 'warn', { key: 'ty-move', ms: 1600 });
    else {
      moving = null;
      ctx.renderer?.setSelected?.(null, null);
    }
    paintBreak();
    return true;
  }

  // ---- the Class Photo -----------------------------------------------------------------------------
  /**
   * The squad posed as a class photo (§13.9): two rows of girl tiles, the hero standing at the side as the teacher,
   * Loaners with a small tag, Varsity girls with a pennant. An Early Dismissal poses the same class (defeat is shown
   * by absence, never by injury).
   */
  function pose(squad, pl) {
    const heroId = sim.heroConfigs?.[mySlot]?.unitId || (mySlot === 0 ? sim.heroConfig?.unitId : null) || null;
    // (the Loaner tag sits under her tile, never over her face; a Varsity pennant takes the tile's top corner)
    const girl = (id) => {
      const t = tile(id, 'ty-pose-tile');
      if (hasVarsity({ varsity: me().varsity, cards: pl.cards || [] }, id)) t.append(h('span.ty-pennant', PHOTO_TEXT.varsity));
      return h('span.ty-pose-girl', t, isOwned(id) ? null : h('span.ty-tag.ty-pose-tag', PHOTO_TEXT.loaner));
    };
    const back = squad.slice(0, Math.ceil(squad.length / 2));
    const front = squad.slice(back.length);
    return h('div.ty-pose', { 'data-testid': 'ty-photo-pose' },
      h('div.ty-pose-rows',
        h('div.ty-pose-row.back', ...back.map(girl)),
        front.length ? h('div.ty-pose-row.front', ...front.map(girl)) : null),
      heroId && UNIT_MAP[heroId] ? h('div.ty-pose-teacher', tile(heroId, 'ty-pose-tile'), h('span.ty-tag.own.ty-pose-tag', PHOTO_TEXT.teacher)) : null);
  }

  /** The periods × 3 stamp grid, each row with its pick's rarity; periods not reached stay empty (absence). */
  function stampGrid(res, pl) {
    const rows = stampRows(res, pl, len, mySlot, { extended }).map((r) => (r.absent
      ? h('div.ty-grid-row.absent', h('b.ty-grid-p', r.label), h('span.ty-grid-marks', h('i.ty-mk.e'), h('i.ty-mk.e'), h('i.ty-mk.e')))
      : h(`div.ty-grid-row${r.resumed ? '.resumed' : ''}`,
        h('b.ty-grid-p', r.label),
        h('span.ty-grid-marks', ...r.marks.map(([id, st]) => {
          const m = markEl(st);
          if (id) m.title = `${ASSIGN_TEXT[id]?.name || id}: ${m.title}`;
          return m;
        })),
        h('span.num.ty-grid-score', fmtNum(r.score, 'count', { detail: true })),
        r.rarity != null ? rTag(r.rarity) : null)));
    return h('div.ty-grid', { 'data-testid': 'ty-photo-grid' }, ...rows);
  }

  function pickName(p) {
    if (p.hand) return PHOTO_TEXT.handed;
    if (p.girl) return UNIT_MAP[p.girl]?.name || p.girl;
    if (p.varsity) return `${UNIT_MAP[p.varsity]?.name || p.varsity} · ${PHOTO_TEXT.varsity}`;
    return cardText({ id: p.card, unit: p.unit, r: p.rarity }).name;
  }

  /**
   * Extended Day's records on the Class Photo (§20.8): the best wave for this Grade (a New best ribbon) and the milestone
   * row, 50 / 75 / 100: a stamp when this run reached it, a faded stamp when an earlier run did, an open ring when none.
   * @param {ReturnType<typeof import('../../systems/tryoutRewards.js').recordExtendedWaves>} w the paid run's run.waves
   */
  function waveRecord(w) {
    const T = WAVE_RECORD_TEXT;
    return h('div.ty-wrec', { 'data-testid': 'ty-photo-wave-record' },
      h('div.ty-wrec-best', { 'data-testid': 'ty-photo-wave-best' }, h('span', T.best(w.best)),
        w.isNew ? h('span.ty-wrec-new', { 'data-testid': 'ty-photo-wave-new' }, T.newBest) : null),
      h('div.ty-wrec-ms', { 'data-testid': 'ty-photo-milestones', role: 'list', 'aria-label': T.milestones },
        h('span.lbl', { 'aria-hidden': 'true' }, T.milestones),
        ...w.milestones.map((m) => {
          const state = m.reached ? 'on' : m.done ? 'done' : 'no';
          const why = m.reached ? T.reached : m.done ? T.before : T.notYet;
          const mk = markEl(m.reached || m.done ? 1 : 0);
          mk.removeAttribute('title');
          mk.setAttribute('aria-hidden', 'true');
          return h(`span.ty-wrec-m.${state}`, { role: 'listitem', 'data-wave': String(m.wave), 'data-state': state, title: `${T.milestone(m.wave)}: ${why}`, 'aria-label': `${T.milestone(m.wave)}: ${why}` },
            mk, h('b', String(m.wave)));
        })));
  }

  function showPhoto({ practice = false, outcome = null } = {}) {
    const res = sim.result().tryout;
    const run = outcome?.run || null;
    // what the run paid (§13.9); a practice run shows only what it banked before it turned practice
    const lines = rewardLines(run).filter((l) => !practice || l.key === 'marbles' || l.key === 'box' || l.key === 'coins');
    const paidNothing = practice && !(run?.marbles?.paid || run?.box?.fill || run?.coins?.coins);
    // (Extended Day: no share code in v1, the seed only, §20.6)
    const code = extended ? null : encodeShareCode(res);
    const won = sim.state === 'won';
    // Extended Day (§20.8, minimal): the title is Home Time and the headline the wave the day reached
    const waveN = Math.max(0, sim.wavesCleared ?? sim.wave ?? 0);
    const title = extended ? EXTENDED_TEXT.homeTime : won ? PHOTO_TEXT.title : PHOTO_TEXT.defeat;
    // (an Extended Day: the paid Run Score, which leaves out the hearts term, §20.5; the Sim's own runScore keeps it)
    const runScore = extended && Number.isFinite(run?.score) ? run.score : res.runScore[mySlot];
    const pl = res.players[mySlot];
    const picks = h('div.ty-picks', ...pl.picks.map((p) => h('span.ty-pickchip', rTag(p.rarity), h('span', pickName(p)))));
    const backdrop = selectedCosmetic(store.profile, 'backdrop');
    photo.replaceChildren(h(`div.ty-sheet.ty-photo.ui-day${won || extended ? '' : '.dismissed'}${backdrop ? `.ty-bd.ty-${backdrop.replace('_', '-')}` : ''}`, { 'data-testid': 'ty-photo-sheet', role: 'dialog', 'aria-label': title },
      practice ? h('span.ty-ribbon', { 'data-testid': 'ty-photo-practice' }, PHOTO_TEXT.practice)
        : random ? h('span.ty-ribbon.ty-rv-ribbon', { 'data-testid': 'ty-photo-random' }, RANDOM_TEXT.ribbon) : null,
      h('div.ty-shead', h('b.ty-stitle', title),
        h('span.ty-mute', extended ? EXTENDED_TEXT.reachedWave(waveN, res.periods.length) : won ? PHOTO_TEXT.allPeriods(res.periods.length, sim.lives) : PHOTO_TEXT.reached(res.periods.length + 1))),
      h('div.ty-photo-main',
        h('div.ty-photo-left',
          extended ? h('div.ty-wave-big', { 'data-testid': 'ty-photo-wave' }, EXTENDED_TEXT.wave(waveN)) : null,
          extended && run?.waves ? waveRecord(run.waves) : null,
          pose(pl.squad, pl),
          h('div.ty-score-big', h('span.lbl', PHOTO_TEXT.score), h('span.num', fmtNum(runScore, 'count', { detail: true }))),
          run?.best?.isNew ? h('div.ty-best', { 'data-testid': 'ty-photo-best' }, PHOTO_TEXT.best)
            : run?.best?.best > 0 ? h('div.ty-mute', PHOTO_TEXT.bestIs(fmtNum(run.best.best, 'count', { detail: true }))) : null),
        h('div.ty-photo-right',
          stampGrid(res, pl),
          pl.picks.length ? picks : null,
          run && !paidNothing && lines.length ? h('div.ty-rewards', { 'data-testid': 'ty-photo-rewards' },
            ...lines.map((l) => h(`div.ty-reward.ty-reward-${l.key}`, { 'data-testid': `ty-reward-${l.key}` }, l.text))) : null,
          code ? h('div.ty-mute.ty-code', { 'data-testid': 'ty-share-code' }, `${SHARE_TEXT.title}: `, h('b', code))
            : extended ? h('div.ty-mute.ty-code', { 'data-testid': 'ty-seed-only' }, EXTENDED_TEXT.seedOnly(res.seed ?? ty().seed)) : null)),
      h('div.ty-acts.ty-photo-acts',
        h('button.bt-cta', { 'data-testid': 'ty-again', onclick: () => ctx.tryoutAgain?.() }, PHOTO_TEXT.again),
        h('button.bt-btn', { 'data-testid': 'ty-hub', onclick: () => ctx.quit() }, PHOTO_TEXT.hub),
        code && ctx.tryoutReplay ? h('button.bt-btn', { 'data-testid': 'ty-replay', title: SHARE_TEXT.note, onclick: () => ctx.tryoutReplay(code) }, SHARE_TEXT.replay) : null)));
    photo.hidden = false;
    sheet.hidden = true;
    brk.hidden = true;
    cls.hidden = true;
    syncSheets();
  }

  /** Out of hearts with the Make-up Test unused (solo): replay the wave, or end the run. */
  function showMakeUp({ wave, retry, giveUp }) {
    const t = ty();
    const cells = timetableModel(t, len, { mySlot, win: me().win });
    photo.replaceChildren(h('div.ty-sheet.ty-photo.ty-makeup-sheet.ui-day', { 'data-testid': 'ty-makeup', role: 'dialog', 'aria-label': PHOTO_TEXT.makeupTitle },
      h('div.ty-shead', h('b.ty-stitle', PHOTO_TEXT.makeupTitle)),
      timetableStrip(cells, { cls: 'ty-tt-sheet' }),
      h('p.ty-makeup-line', PHOTO_TEXT.makeupLine(wave)),
      h('div.ty-acts.ty-photo-acts',
        h('button.bt-cta', { 'data-testid': 'ty-makeup-go', onclick: retry }, PHOTO_TEXT.makeupGo),
        h('button.bt-btn', { 'data-testid': 'ty-makeup-no', onclick: giveUp }, PHOTO_TEXT.makeupNo))));
    photo.hidden = false;
    sheet.hidden = true;
    brk.hidden = true;
    cls.hidden = true;
    syncSheets();
  }

  let last = '';
  let squadN = me().squad.length;
  function update() {
    if (ctx.ended) return;
    const t = ty();
    const p = me();
    if (p.squad.length !== squadN) {
      // a girl joined: her model loads now (a placeholder chibi stands in until it arrives)
      const fresh = p.squad.slice(squadN);
      squadN = p.squad.length;
      import('../../models/index.js').then((m) => m.preloadModels(fresh, { skins: ctx.skins || {} })).catch(() => {});
    }
    homeTime?.update();
    const sig = `${sim.wave}:${sim.state}:${t.period}:${t.score + t.periodScore}:${sim.stats.leaks}:${JSON.stringify(t.ctr[mySlot])}:${p.win}:${p.passes}:${p.undo.length}:${p.snack}:${p.erasers}:${p.bank}:${t.players.map((x) => `${x.win}${x.dare ? 1 : 0}`).join()}:${t.nextSubject}:${t.subject}:${p.offer?.seq ?? ''}`;
    stepReveal();
    if (sig === last) return;
    last = sig;
    paintTracker();
    paintPick();
    paintBreak();
    paintClass();
    el.classList.toggle('ty-open', !!p.win);
  }
  update();

  return {
    el,
    update,
    handleTap,
    showPhoto,
    showMakeUp,
    /** Is my pick sheet open (the Start button waits)? */
    get open() {
      return !!me().win;
    },
    destroy() {
      offNote?.();
      if (ctx.homeTime === homeTime) ctx.homeTime = null;
      pickStrip?.close();
      closeMore();
      el.remove();
    },
  };
}
