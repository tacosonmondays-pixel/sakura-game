// Tryout Day in battle (docs/specs/TRYOUT_DAY.md §13, M3 Ink & Paper on the battle HUD): the assignment tracker under
// the HUD (its head is the timetable's thin band), the pick sheet at a period end (Pep Talks in their Stationery
// frames §13.1, girls in their own unit frames §13.7), the class bar, the break bar (Window Seats, Hall Pass moves with
// Undo, Snack or Brush Up, Back to class), the Make-up sheet and the Class Photo at the end (§13.9). Solo sends run
// commands straight to the Sim; co-op queues `tr` / `mv` (src/online/coop/commands.js). Reads the Sim, never writes it.
// The sheets carry `ui-day` so the kit's girl tile and rarity tag draw inside the battle (src/ui/styles/ink.css is
// scoped to that class); their own rules are src/ui/styles/tryoutBattle.css, all under .ty-layer.
import { h } from './util.js';
import { fmtNum } from '../format.js';
import { svgEl, girlTile } from '../components.js';
import { rarityTag } from '../kit.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { PEP_CARDS, RARITIES, TRYOUT } from '../../data/tryout.js';
import { assignProgress, dareOf, chooserOf } from '../../sim/tryout/index.js';
import { rarityWeights, pityFloor, hasVarsity } from '../../sim/tryout/offers.js';
import { lengthOf } from '../../sim/tryout/plan.js';
import { passMax } from '../../sim/tryout/breaks.js';
import { cardText, SLOT_NAMES, ASSIGN_TEXT, BREAK_NAMES, MOVE_REASONS, oddsLine, SUBJECT_TEXT, DARE_TEXT, DARE_SHORT, DARE_GAIN, rewardLines, SHARE_TEXT, PHOTO_TEXT, GIRL_CARD_TEXT, TIMETABLE_TEXT } from '../text/tryout.js';
import { timetableModel, timetableStrip, timetableMini, bandParts, markEl } from './tryout/timetable.js';
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
  const len = lengthOf(ty().length);
  let moving = null; // uid of the girl a Hall Pass is moving
  let shown = '';
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
    const label = t.base ? band.label : p >= len.periods ? TIMETABLE_TEXT.final : TIMETABLE_TEXT.cell(p);
    head.replaceChildren(...[
      h('span.ty-band',
        t.base ? null : h('span.ty-band-next', `${TIMETABLE_TEXT.next} · `),
        h('b.ty-band-p', label),
        band.wave ? h('span', ` · ${band.wave}`) : null,
        // while a period runs, its Subject (the class rule in play) is named in the head
        band.subject ? h('span.ty-head-subj', { 'data-testid': 'ty-head-subject', title: band.subjectLine }, ` · ${band.subject}`) : null,
        // a Grade 8+ period affix (sim.tryout.affixes[period], a TRYOUT.dares id)
        t.affixes?.[p] ? h('span.ty-head-affix', { 'data-testid': 'ty-head-affix', title: DARE_TEXT[t.affixes[p]] }, ` · ${DARE_SHORT[t.affixes[p]] || t.affixes[p]}`) : null,
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
    const pathRow = paths.length > 1 ? h('span.ty-paths', ...paths.map((pa, k) => h('button.bt-btn.ty-path', {
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
      card?.group === 'board' && ty().coop && (c.id === 'B02' || c.id === 'B04') ? h('span.ty-card-ln.ty-mute', 'Team-wide') : null);
  }

  function paintPick() {
    const p = me();
    const o = p.offer;
    const key = o ? `${o.seq}:${p.erasers}:${ty().players.map((x) => x.win).join()}` : '';
    if (key === shown) return;
    shown = key;
    if (!o) {
      sheet.hidden = true;
      syncSheets();
      return;
    }
    const pay = Math.floor((TRYOUT.handIn.base + TRYOUT.handIn.perPeriod * ty().period) * sim.cashScale);
    const last = o.pick === len.picks.length;
    const why = ty().periods.length ? ty().periods[ty().periods.length - 1] : null;
    // the top band: the period's stamps, then "3 credits → SSR" and the Teacher's Note (§13.6)
    const reasons = why ? [...why.team, ...(why.own[mySlot] || [])].map(([id, st]) => h('span.ty-why', markEl(st), ASSIGN_TEXT[id]?.name || id)) : [];
    if (p.bank) reasons.push(h('span.ty-why', markEl(1), 'Handed in'));
    const partner = ty().coop ? ty().players.find((_, i) => i !== mySlot) : null;
    const cards = o.cards.map((c, i) => (c.girl ? girlCard(c, i, o) : c.varsityGirl ? varsityCard(c, i) : pepCard(c, i)));
    sheet.replaceChildren(h('div.ty-sheet.ty-pick-sheet.ui-day', { role: 'dialog', 'aria-label': `Pick ${o.pick}` },
      h('div.ty-shead',
        h('b.ty-stitle', o.kind === 'girls' ? `Pick ${o.pick} · Tryouts` : `Pick ${o.pick} · Pep Talk`),
        h('span.ty-credits', `${o.credits} credit${o.credits === 1 ? '' : 's'} → `, rTag(o.rarity, { testid: 'ty-pick-rarity' })),
        o.floor > 0 ? h('span.ty-note', `Teacher's Note: at least ${RARITIES[o.floor]}`) : null),
      reasons.length ? h('div.ty-reasons', ...reasons) : null,
      timetableStrip(timetableModel(ty(), len, { mySlot, win: p.win }), { cls: 'ty-tt-sheet' }),
      h(`div.ty-deck.n${cards.length}`, ...cards),
      h('div.ty-acts',
        h('button.bt-btn', { 'data-testid': 'ty-erase', disabled: p.erasers <= 0, onclick: () => send('tr', ['erase', o.seq]) }, `Eraser (${p.erasers})`),
        h('button.bt-btn', { 'data-testid': 'ty-hand', onclick: () => send('tr', ['hand', o.seq]) }, `Hand it in later (+${fmtNum(pay, 'money')}${last ? '' : ' · next pick +1'})`),
        partner ? h('span.ty-mute', { 'data-testid': 'ty-partner' }, partner.win === 'pick' ? 'Partner: choosing…' : 'Partner: ✓') : null)));
    sheet.hidden = false;
    syncSheets();
  }

  function take(i, path = 0) {
    const o = me().offer;
    if (!o) return;
    const r = send('tr', ['take', o.seq, i, path]);
    if (r && r.ok === false && r.reason === 'squadFull') ctx.feed?.push('Your squad is full.', 'warn', { key: 'ty-full', ms: 1600 });
  }

  // ---- between periods: the class choice and Double Dare (§2.4, §8.3) ------------------------------
  function paintClass() {
    const t = ty();
    const next = t.period + (t.started >= t.period ? 1 : 0);
    if (t.base || t.done || sim.state === 'wave' || sim.state === 'won' || sim.state === 'lost' || next > len.periods || t.started < 1) {
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
      t.affixes?.[next] ? h('div.ty-class-row.ty-affix', { 'data-testid': 'ty-class-affix' }, h('b', 'Grade twist: '), DARE_SHORT[t.affixes[next]] || t.affixes[next],
        h('span.ty-long.ty-mute', ` (${DARE_TEXT[t.affixes[next]] || ''})`)) : null,
      h('div.ty-class-row',
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
    const byPeriod = new Map(res.periods.map((x) => [x.period, x]));
    const pickAt = (p) => pl.picks.find((x) => len.picks[x.pick - 1] === p) || null;
    const rows = [];
    for (let p = 1; p <= len.periods; p++) {
      const rec = byPeriod.get(p);
      const pk = pickAt(p);
      const label = p === len.periods ? TIMETABLE_TEXT.final : TIMETABLE_TEXT.cell(p);
      if (!rec) {
        rows.push(h('div.ty-grid-row.absent', h('b.ty-grid-p', label), h('span.ty-grid-marks', h('i.ty-mk.e'), h('i.ty-mk.e'), h('i.ty-mk.e'))));
        continue;
      }
      rows.push(h(`div.ty-grid-row${rec.resumed ? '.resumed' : ''}`,
        h('b.ty-grid-p', label),
        h('span.ty-grid-marks', ...[...rec.team, ...(rec.own[mySlot] || [])].map(([id, st]) => {
          const m = markEl(st);
          m.title = `${ASSIGN_TEXT[id]?.name || id}: ${m.title}`;
          return m;
        })),
        h('span.num.ty-grid-score', fmtNum(rec.score, 'count', { detail: true })),
        pk ? rTag(pk.rarity) : null));
    }
    return h('div.ty-grid', { 'data-testid': 'ty-photo-grid' }, ...rows);
  }

  function pickName(p) {
    if (p.hand) return PHOTO_TEXT.handed;
    if (p.girl) return UNIT_MAP[p.girl]?.name || p.girl;
    if (p.varsity) return `${UNIT_MAP[p.varsity]?.name || p.varsity} · ${PHOTO_TEXT.varsity}`;
    return cardText({ id: p.card, unit: p.unit, r: p.rarity }).name;
  }

  function showPhoto({ practice = false, outcome = null } = {}) {
    const res = sim.result().tryout;
    const run = outcome?.run || null;
    // what the run paid (§13.9); a practice run shows only what it banked before it turned practice
    const lines = rewardLines(run).filter((l) => !practice || l.key === 'marbles' || l.key === 'box' || l.key === 'coins');
    const paidNothing = practice && !(run?.marbles?.paid || run?.box?.fill || run?.coins?.coins);
    const code = encodeShareCode(res);
    const won = sim.state === 'won';
    const runScore = res.runScore[mySlot];
    const pl = res.players[mySlot];
    const picks = h('div.ty-picks', ...pl.picks.map((p) => h('span.ty-pickchip', rTag(p.rarity), h('span', pickName(p)))));
    const backdrop = selectedCosmetic(store.profile, 'backdrop');
    photo.replaceChildren(h(`div.ty-sheet.ty-photo.ui-day${won ? '' : '.dismissed'}${backdrop ? `.ty-bd.ty-${backdrop.replace('_', '-')}` : ''}`, { 'data-testid': 'ty-photo-sheet', role: 'dialog', 'aria-label': won ? PHOTO_TEXT.title : PHOTO_TEXT.defeat },
      practice ? h('span.ty-ribbon', { 'data-testid': 'ty-photo-practice' }, PHOTO_TEXT.practice) : null,
      h('div.ty-shead', h('b.ty-stitle', won ? PHOTO_TEXT.title : PHOTO_TEXT.defeat),
        h('span.ty-mute', won ? PHOTO_TEXT.allPeriods(res.periods.length, sim.lives) : PHOTO_TEXT.reached(res.periods.length + 1))),
      h('div.ty-photo-main',
        h('div.ty-photo-left', pose(pl.squad, pl),
          h('div.ty-score-big', h('span.lbl', PHOTO_TEXT.score), h('span.num', fmtNum(runScore, 'count', { detail: true }))),
          run?.best?.isNew ? h('div.ty-best', { 'data-testid': 'ty-photo-best' }, PHOTO_TEXT.best)
            : run?.best?.best > 0 ? h('div.ty-mute', PHOTO_TEXT.bestIs(fmtNum(run.best.best, 'count', { detail: true }))) : null),
        h('div.ty-photo-right',
          stampGrid(res, pl),
          pl.picks.length ? picks : null,
          run && !paidNothing && lines.length ? h('div.ty-rewards', { 'data-testid': 'ty-photo-rewards' },
            ...lines.map((l) => h(`div.ty-reward.ty-reward-${l.key}`, { 'data-testid': `ty-reward-${l.key}` }, l.text))) : null,
          code ? h('div.ty-mute.ty-code', { 'data-testid': 'ty-share-code' }, `${SHARE_TEXT.title}: `, h('b', code)) : null)),
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
    const sig = `${sim.wave}:${sim.state}:${t.period}:${t.score + t.periodScore}:${sim.stats.leaks}:${JSON.stringify(t.ctr[mySlot])}:${p.win}:${p.passes}:${p.undo.length}:${p.snack}:${p.erasers}:${p.bank}:${t.players.map((x) => `${x.win}${x.dare ? 1 : 0}`).join()}:${t.nextSubject}:${t.subject}`;
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
      el.remove();
    },
  };
}
