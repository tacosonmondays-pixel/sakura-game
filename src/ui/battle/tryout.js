// Tryout Day in battle (docs/specs/TRYOUT_DAY.md §13; the plain M1 version on today's HUD, before the Ink & Paper
// screens): the assignment tracker under the HUD, the pick sheet at a period end, the break bar (Window Seats,
// Hall Pass moves with Undo, Snack or Brush Up, Back to class) and the Class Photo at the end. Solo sends run
// commands straight to the Sim; co-op queues `tr` / `mv` (src/online/coop/commands.js). Reads the Sim, never writes it.
import { h } from './util.js';
import { fmtNum } from '../format.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { PEP_CARDS, RARITIES, TRYOUT } from '../../data/tryout.js';
import { assignProgress, dareOf, chooserOf } from '../../sim/tryout/index.js';
import { rarityWeights, pityFloor } from '../../sim/tryout/offers.js';
import { lengthOf, periodWaves } from '../../sim/tryout/plan.js';
import { cardText, SLOT_NAMES, ASSIGN_TEXT, BREAK_NAMES, MOVE_REASONS, oddsLine, SUBJECT_TEXT, DARE_TEXT } from '../text/tryout.js';
import '../styles/tryout.css';

const Q = 1024;
const STATE_MARK = { 0: '○', 1: '✿', [-1]: '✕' };

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

  // ---- tracker -------------------------------------------------------------------------------------
  const head = h('div.ty-head', { 'data-testid': 'ty-head' });
  const chips = h('div.ty-chips');
  const odds = h('div.ty-odds', { 'data-testid': 'ty-odds' });
  const tracker = h('div.ty-tracker', { 'data-testid': 'ty-tracker' }, head, chips, odds);

  // ---- pick sheet / break bar / result ------------------------------------------------------------
  const sheet = h('div.ty-sheet-wrap', { 'data-testid': 'ty-pick', hidden: true });
  const brk = h('div.ty-break', { 'data-testid': 'ty-break', hidden: true });
  const cls = h('div.ty-class', { 'data-testid': 'ty-class', hidden: true });
  const photo = h('div.ty-sheet-wrap', { 'data-testid': 'ty-photo', hidden: true });
  const el = h('div.ty-layer', tracker, cls, sheet, brk, photo);
  ctx.layer.append(el);

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
    // between periods the chips are the coming period's: the header says so
    const p = t.base ? t.period : t.assign?.period ?? t.period + 1;
    const [a] = periodWaves(len, p);
    const done = t.base ? Math.max(0, Math.min(len.wavesPerPeriod, sim.wave - a + (sim.state === 'wave' ? 1 : 1))) : 0;
    const name = p >= len.periods ? 'Final Period' : `Period ${p}`;
    head.replaceChildren(...[
      h('b', t.base ? name : `Next: ${name}`), t.base ? h('span', ` · wave ${done}/${len.wavesPerPeriod}`) : null,
      h('span.ty-score', ` · Score ${fmtNum(t.score + t.periodScore, 'count', { detail: true })}`),
    ].filter(Boolean));
    const list = assignProgress(sim, mySlot);
    chips.replaceChildren(...list.map((x) => {
      const txt = ASSIGN_TEXT[x.id];
      return h(`div.ty-chip.ty-st${x.st}`, { 'data-testid': `ty-chip-${x.id}`, title: txt?.name },
        h('span.ty-mark', x.resumed ? '·' : STATE_MARK[x.st]),
        h('span.ty-chip-name', txt?.name || x.id),
        h('span.ty-chip-live', x.resumed ? 'resumed' : x.st !== 0 ? (x.st > 0 ? 'done' : 'missed') : txt?.live?.(x) || ''));
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
  function girlCard(c, i, o) {
    const def = UNIT_MAP[c.girl];
    const owned = !!sim._tryoutCfg?.pools?.[mySlot]?.[c.girl];
    // her arrival tiers go on a path she picks (§5): a tap on the card takes the first one
    const tier = TRYOUT.arrival[Math.max(0, Math.min(4, o.rarity - (TRYOUT.grades[ty().grade]?.arrivalDown || 0)))].tier;
    const paths = tier > 0 ? def?.paths || [] : [];
    const pathRow = paths.length > 1 ? h('span.ty-paths', ...paths.map((pa, k) => h('button.bt-btn.ty-path', {
      'data-testid': `ty-path-${i}-${k}`, onclick: (e) => { e.stopPropagation(); take(i, k); },
    }, pa.name || `Path ${k + 1}`))) : null;
    return h(`div.ty-card.ty-girl.ty-r${o.rarity}`, { 'data-testid': `ty-card-${i}`, role: 'button', tabindex: 0, onclick: () => take(i, 0) },
      h('span.ty-slot', o.kind === 'girls' ? 'Tryout' : SLOT_NAMES[i] || 'Wild'),
      svgEl(portraitHTML(def, 'thumb', { eager: true }), 'ty-card-art'),
      h('b.ty-card-name', def?.name || c.girl),
      h('span.ty-card-line', `${ROLES[def?.role]?.name || ''} · ${def?.attackType || ''}`),
      h('span.ty-card-line', owned ? 'Yours · plays in the band' : `Loaner · Run Level ${ty().level}`),
      h('span.ty-card-line.ty-dim', tier > 0 ? `Joins the squad · first copy free at tier ${tier}` : 'Joins the squad · first copy free'),
      pathRow);
  }

  function pepCard(c, i, o) {
    const t = cardText(c);
    const card = PEP_CARDS[c.id];
    return h(`button.ty-card.ty-r${c.r}`, { 'data-testid': `ty-card-${i}`, onclick: () => take(i) },
      h('span.ty-slot', SLOT_NAMES[i] || 'Wild'),
      h('span.ty-rar', RARITIES[c.r]),
      c.unit ? svgEl(portraitHTML(UNIT_MAP[c.unit], 'thumb', { eager: true }), 'ty-card-art') : null,
      h('b.ty-card-name', t.name),
      h('span.ty-card-line', t.line),
      card?.group === 'board' && ty().coop && (c.id === 'B02' || c.id === 'B04') ? h('span.ty-card-line.ty-dim', 'Team-wide') : null);
  }

  function paintPick() {
    const p = me();
    const o = p.offer;
    const key = o ? `${o.seq}:${p.erasers}:${ty().players.map((x) => x.win).join()}` : '';
    if (key === shown) return;
    shown = key;
    if (!o) {
      sheet.hidden = true;
      return;
    }
    const pay = Math.floor((TRYOUT.handIn.base + TRYOUT.handIn.perPeriod * ty().period) * sim.cashScale);
    const last = o.pick === len.picks.length;
    const why = ty().periods.length ? ty().periods[ty().periods.length - 1] : null;
    const reasons = why ? [...why.team, ...(why.own[mySlot] || [])].map(([id, st]) => `${ASSIGN_TEXT[id]?.name || id} ${st === 1 ? '✓' : '✗'}`) : [];
    if (p.bank) reasons.push('Handed in ✓');
    const partner = ty().coop ? ty().players.find((_, i) => i !== mySlot) : null;
    sheet.replaceChildren(h('div.ty-sheet', { role: 'dialog', 'aria-label': `Pick ${o.pick}` },
      h('div.ty-sheet-title', o.kind === 'girls' ? `Pick ${o.pick} · Tryouts` : `Pick ${o.pick} · Pep Talk`,
        h('span.ty-rar.ty-rar-big', RARITIES[o.rarity]), h('span.ty-dim', ` ${o.credits} credit${o.credits === 1 ? '' : 's'}`)),
      reasons.length ? h('div.ty-reasons', reasons.join(' · ')) : null,
      o.floor > 0 ? h('div.ty-reasons', `Teacher's Note: at least ${RARITIES[o.floor]}`) : null,
      h('div.ty-cards', ...o.cards.map((c, i) => (c.girl ? girlCard(c, i, o) : pepCard(c, i, o)))),
      h('div.ty-actions',
        h('button.bt-btn', { 'data-testid': 'ty-erase', disabled: p.erasers <= 0, onclick: () => send('tr', ['erase', o.seq]) }, `Eraser (${p.erasers})`),
        h('button.bt-btn', { 'data-testid': 'ty-hand', onclick: () => send('tr', ['hand', o.seq]) }, `Hand it in later (+${fmtNum(pay, 'money')}${last ? '' : ' · next pick +1'})`),
        partner ? h('span.ty-dim', { 'data-testid': 'ty-partner' }, partner.win === 'pick' ? 'Partner: choosing…' : 'Partner: ✓') : null)));
    sheet.hidden = false;
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
    cls.replaceChildren(
      pair ? h('div.ty-class-row',
        h('b', mine ? 'Next class:' : 'Next class (partner picks):'),
        ...pair.map((id, k) => h(`button.bt-btn.ty-subject${id === chosen ? '.on' : ''}`, {
          'data-testid': `ty-subject-${k}`, disabled: !mine, title: SUBJECT_TEXT[id]?.line, onclick: () => send('tr', ['subject', k]),
        }, h('b', SUBJECT_TEXT[id]?.name || id), h('span.ty-dim', ` ${SUBJECT_TEXT[id]?.line || ''}`)))) : null,
      h('div.ty-class-row',
        h(`button.bt-btn.ty-dare${me().dare ? '.on' : ''}`, { 'data-testid': 'ty-dare', onclick: () => send('tr', ['dare', me().dare ? 0 : 1]) },
          `Double Dare: ${me().dare ? 'on' : 'off'}`),
        h('span.ty-dim', ` ${DARE_TEXT[dare.id] || dare.id} · +1 credit, Period Score ×1.1${t.coop ? ' · both must tap' : ''}`),
        partner ? h('span.ty-dim', ` · Partner: ${partner.dare ? 'on' : 'off'}`) : null));
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
    const dots = '●'.repeat(p.passes) + '○'.repeat(Math.max(0, TRYOUT.passes.max - p.passes));
    // (Brush Up raises a scaling card: one with numbers at every rarity, as breaks.js brushUp checks)
    const scaling = p.cards.map((c, i) => ({ c, i })).filter(({ c }) => (PEP_CARDS[c.id]?.mods || PEP_CARDS[c.id]?.steps) && PEP_CARDS[c.id].rar.length >= 4 && c.r < 3);
    const full = sim.lives >= sim.maxLives;
    const rise = Math.min(TRYOUT.snack.fullMax, Math.max(0, TRYOUT.heartsMaxRise - ty().heartsAdded));
    brk.replaceChildren(
      h('div.ty-break-title', h('b', `${BREAK_NAMES[kind]} · Seat Change`), h('span', ` · Hall Passes ${dots}`)),
      h('div.ty-break-hint', moving ? `Tap where ${sim.getTower(moving)?.def.name || 'she'} should sit.` : 'New Window Seats (dashed) count from the next period. Tap one of your girls to move her.'),
      h('div.ty-actions',
        h('button.bt-btn', { 'data-testid': 'ty-undo', disabled: !p.undo.length, onclick: () => send('tr', ['undo']) }, 'Undo'),
        h('button.bt-btn', { 'data-testid': 'ty-snack', disabled: p.snack, onclick: () => send('tr', ['snack']) }, !sim.canHeal() ? 'Snack (+1 pass)' : full ? (rise > 0 ? `Snack (+${rise} max ♥)` : 'Snack (hearts full)') : `Snack (+${ty().coop ? TRYOUT.snack.coopHeal : TRYOUT.snack.heal} ♥)`),
        scaling.length && !p.snack ? h('select.ty-brush', { 'data-testid': 'ty-brush', onchange: (e) => { if (e.target.value !== '') send('tr', ['brush', Number(e.target.value)]); } },
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
  function showPhoto({ practice = false } = {}) {
    const res = sim.result().tryout;
    const won = sim.state === 'won';
    const runScore = res.runScore[mySlot];
    const pl = res.players[mySlot];
    const grid = h('div.ty-grid', ...res.periods.map((p) => h('div.ty-grid-row',
      h('span.ty-grid-p', `P${p.period}`),
      ...[...p.team, ...(p.own[mySlot] || [])].map(([id, st]) => h(`span.ty-mark.ty-st${st}`, { title: ASSIGN_TEXT[id]?.name }, STATE_MARK[st])),
      h('span.ty-dim', ` ${fmtNum(p.score, 'count', { detail: true })}`))));
    const picks = h('div.ty-picks', ...pl.picks.map((p) => h(`span.ty-pickchip.ty-r${p.rarity}`, `${RARITIES[p.rarity]} ${p.hand ? 'handed in' : p.girl ? UNIT_MAP[p.girl]?.name : cardText({ id: p.card, unit: p.unit, r: p.rarity }).name}`)));
    photo.replaceChildren(h('div.ty-sheet.ty-photo', { 'data-testid': 'ty-photo-sheet' },
      h('div.ty-sheet-title', won ? 'Class Photo' : 'Early Dismissal', practice ? h('span.ty-practice', 'Practice') : null),
      h('div.ty-squad', ...pl.squad.map((id) => svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { eager: true }), 'ty-squad-art'))),
      h('div.ty-score-big', `Run Score ${fmtNum(runScore, 'count', { detail: true })}`),
      h('div.ty-dim', won ? `All ${res.periods.length} periods · ${sim.lives} ♥ left` : `Reached period ${res.periods.length + 1}`),
      grid, picks,
      h('div.ty-actions',
        h('button.bt-cta', { 'data-testid': 'ty-again', onclick: () => ctx.tryoutAgain?.() }, 'Again'),
        h('button.bt-btn', { 'data-testid': 'ty-hub', onclick: () => ctx.quit() }, 'Tryout Day'))));
    photo.hidden = false;
    sheet.hidden = true;
    brk.hidden = true;
    cls.hidden = true;
  }

  /** Out of hearts with the Make-up Test unused (solo): replay the wave, or end the run. */
  function showMakeUp({ wave, retry, giveUp }) {
    photo.replaceChildren(h('div.ty-sheet.ty-photo', { 'data-testid': 'ty-makeup' },
      h('div.ty-sheet-title', 'Out of hearts'),
      h('p', `The Make-up Test replays wave ${wave} from its start, with the hearts and coins you had then. Once a run; that period's assignments won't count.`),
      h('div.ty-actions',
        h('button.bt-cta', { 'data-testid': 'ty-makeup-go', onclick: retry }, 'Make-up Test'),
        h('button.bt-btn', { 'data-testid': 'ty-makeup-no', onclick: giveUp }, 'Early Dismissal'))));
    photo.hidden = false;
    sheet.hidden = true;
    brk.hidden = true;
    cls.hidden = true;
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
    const sig = `${sim.wave}:${sim.state}:${t.period}:${t.score + t.periodScore}:${sim.stats.leaks}:${JSON.stringify(t.ctr[mySlot])}:${p.win}:${p.passes}:${p.undo.length}:${p.snack}:${p.erasers}:${p.bank}:${t.players.map((x) => `${x.win}${x.dare ? 1 : 0}`).join()}:${t.nextSubject}`;
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
      el.remove();
    },
  };
}
