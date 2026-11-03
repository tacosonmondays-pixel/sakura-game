// Hero widget (bottom-left once the hero is deployed): portrait with level + XP bar, the
// ultimate button with a conic cooldown ring, her Lv 7 skill button (a 40 px ring, no number:
// UI_DIRECTION §6.6; E fires it) and the Level up pill (buys the rest of her level at the price
// it shows; the price is re-read at most twice a second).
import { h, setVar } from './util.js';
import { fmtNum } from '../format.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { applyUrFrame } from '../rarity.js';
import { currencyIcon } from '../../art/icons.js';
import { PRICE_TICK } from './heroLevels.js';
import { abilityText } from '../../data/abilityText.js';
import { BOLT_SVG, wholeSeconds, refusalText } from './abilityBar.js';

/**
 * The skill button's look (pure): { hidden, state, p (the dark part of the ring, 0..1), label, title, aria }.
 * Locked shows "LV 7"; charging is a ring with no number (its seconds are in the title); ready glows.
 * @param {object|null} st sim.abilityStatus(hero uid) (null: she has no skill)
 */
export function skillButtonView(st) {
  if (!st) return { hidden: true, state: 'none', p: 1, label: '', title: '', aria: '' };
  const name = abilityText(st.id)?.name || 'Skill';
  // a skill this build does not run yet (Kanna's Heavy Beat): no button at all, so nothing promises one
  if (st.later) return { hidden: true, state: 'later', p: 1, label: '', title: `${name} comes in a later update`, aria: '' };
  if (!st.unlocked) {
    const lv = `LV ${st.unlockLevel ?? 7}`;
    return { hidden: false, state: 'locked', p: 1, label: lv, title: `${name} unlocks at hero ${lv}`, aria: `${name}, unlocks at ${lv}` };
  }
  const state = st.ready ? 'ready' : st.reason === 'cooldown' ? 'charging' : st.reason === 'active' ? 'active' : st.reason === 'notWave' ? 'between' : 'blocked';
  const p = state === 'ready' ? 0 : Math.max(0, Math.min(1, 1 - (st.charge ?? 0)));
  const why = state === 'ready' ? 'ready! (E)' : state === 'charging' ? `recharging · ${wholeSeconds(st.cooldownLeft)}` : state === 'between' ? 'charges during waves' : refusalText(st.reason, { secondsLeft: st.cooldownLeft, name }).toLowerCase();
  return { hidden: false, state, p, label: '', title: `${name} — ${why}`, aria: `${name}, ${why}` };
}

/**
 * What E / the skill button does (pure): { cast: true } fires her skill; otherwise `toast` (or null: nothing to say)
 * explains why not. A skill this build does not run yet (Kanna's Heavy Beat) never promises a level: it "comes in a
 * later update" at every level, as her panel row and the hidden button say.
 * @param {object|null} st sim.abilityStatus(hero uid) (null: she has no skill)
 * @returns {{ cast: boolean, toast: string|null }}
 */
export function skillKeyAction(st) {
  if (!st) return { cast: false, toast: null };
  const name = abilityText(st.id)?.name || 'Her skill';
  if (st.later) return { cast: false, toast: `${name} comes in a later update.` };
  if (!st.unlocked) return { cast: false, toast: `${name} unlocks at hero level ${st.unlockLevel ?? 7}.` };
  return { cast: true, toast: null };
}

/**
 * Paints an ult button: conic ring progress (--p 0..1), state classes and label.
 * @param {HTMLElement} btn
 * @param {object} status sim.heroUltStatus()
 */
export function paintUltButton(btn, status, { compact = true } = {}) {
  const st = status || { unlocked: false, ready: false, cooldownLeft: 0, cooldown: 0 };
  const frac = !st.unlocked ? 0 : st.ready ? 1 : st.cooldown > 0 ? 1 - st.cooldownLeft / st.cooldown : 0;
  const label = !st.unlocked ? fmtNum(st.unlockLevel ?? 3, 'level') : st.ready ? (compact ? 'ULT' : 'Activate!') : fmtNum(st.cooldownLeft, 'time', { whole: true });
  const key = `${st.unlocked}|${st.ready}|${label}|${frac.toFixed(2)}`;
  if (btn.dataset.key === key) return;
  btn.dataset.key = key;
  setVar(btn, '--p', frac.toFixed(3));
  btn.classList.toggle('ready', !!st.ready);
  btn.classList.toggle('locked', !st.unlocked);
  btn.disabled = !st.ready;
  btn.title = !st.unlocked ? `Ultimate unlocks at hero level ${st.unlockLevel ?? 3}` : st.ready ? `${st.name || 'Ultimate'} — ready!` : `${st.name || 'Ultimate'} recharging (charges during waves)`;
  btn.replaceChildren(h('span.bt-ult-ring'), h('span.bt-ult-label', label));
}

export function createHeroWidget(ctx) {
  const { sim } = ctx;
  // (co-op: my cash less the coins my orders in flight hold, ctx.spendable; solo: the cash)
  const spendable = () => (ctx.spendable ? ctx.spendable() : sim.cash);
  const heroId = sim.heroConfig?.unitId || null;
  const el = h('div.bt-herow', { 'data-testid': 'hero-widget' });
  el.hidden = true;
  if (!heroId) return { el, update() {}, destroy() {} };
  const def = sim.data.unit(heroId);
  const lv = h('span.bt-herow-lv');
  const xpFill = h('span.bt-herow-xpfill');
  const portrait = h(
    'button.bt-herow-portrait',
    { title: `${def.name} — tap for details`, onclick: () => sim.hero && ctx.select(sim.hero.uid) },
    svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-herow-art'),
    lv,
    h('span.bt-herow-xp', xpFill),
  );
  applyUrFrame(portrait, def, ctx.profile); // your hero, fully awakened SSR → rainbow ring (display only)
  const ult = h('button.bt-ult', { 'data-testid': 'ult', onclick: () => ctx.fireUlt() });
  const skillLabel = h('span.bt-skill-label');
  const skill = h('button.bt-skill', { type: 'button', 'data-testid': 'hero-skill', onclick: () => ctx.fireSkill?.() },
    h('span.bt-skill-ring', svgEl(BOLT_SVG, 'bt-skill-bolt')), skillLabel);
  skill.hidden = !def.hero?.skill;
  // what the pill shows right now: a tap buys exactly this (level + price), never a dearer one
  let shown = null;
  const lvupPrice = h('b.bt-herow-lvup-price');
  const lvup = h(
    'button.bt-herow-lvup',
    { 'data-testid': 'hero-levelup-quick', title: 'Buy the rest of her level (L)', onclick: () => ctx.levelUpHero?.(shown) },
    h('small', 'LV UP'),
    h('span.bt-herow-lvup-cost', svgEl(currencyIcon('coins'), 'bt-buy-coin'), lvupPrice),
  );
  el.append(portrait, ult, skill, lvup);
  let skillKey = '';
  function paintSkill(hero) {
    if (!def.hero?.skill) return;
    const v = skillButtonView(sim.abilityStatus(hero.uid));
    const key = `${v.state}|${v.label}|${v.title}|${Math.round(v.p * 200)}`;
    if (key === skillKey) return;
    skillKey = key;
    skill.hidden = v.hidden;
    skill.className = `bt-skill s-${v.state}`;
    setVar(skill, '--p', v.p.toFixed(3));
    skillLabel.textContent = v.label;
    skill.title = v.title;
    skill.setAttribute('aria-label', v.aria);
  }
  const offHold = ctx.tree?.bindHold(portrait, () => (sim.hero ? { uid: sim.hero.uid } : null)); // [unit-info] hold → her tree

  let lastLv = -1;
  let lastBadge = '';
  let priceAt = -1;
  function paintPill(hero) {
    const now = performance.now() / 1000;
    if (shown && now - priceAt < PRICE_TICK && shown.level === hero.level) {
      lvup.classList.toggle('poor', spendable() < shown.price);
      return;
    }
    priceAt = now;
    shown = sim.heroLevelStatus();
    const hide = !shown || shown.reason === 'max' || shown.reason === 'ended' || shown.reason === 'noHero' || ctx.ended;
    lvup.hidden = hide;
    if (hide) return;
    lvupPrice.textContent = fmtNum(shown.price, 'money', { round: 'up' });
    lvup.classList.toggle('poor', spendable() < shown.price);
    lvup.title = `Buy Lv ${shown.level + 1} for ${fmtNum(shown.price, 'money', { round: 'up' })} coins (L)`;
  }

  /**
   * A road's goal (or start) that the widget would lie over (a phone: Gate Arc 4-6's goal sat under Lv 3 and LV UP):
   * the widget, and the ability card that opens above it, rise until the gate's marker is clear (--herow-lift on the
   * battle root), never into the top bar. Checked every 400 ms, so a free camera's pan is followed too.
   */
  let liftAt = 0;
  let lift = 0;
  function keepGoalsClear() {
    const r = ctx.renderer;
    const root = ctx.shell || el.parentElement;
    if (!r?.worldToScreen || !root || !sim.paths?.length) return;
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    const R = 22; // (a gate marker's half size on screen, and the room around it)
    const top = box.top + lift;
    const bottom = box.bottom + lift;
    let want = 0;
    for (const pts of sim.paths) {
      for (const pt of [pts[0], pts[pts.length - 1]]) {
        if (!pt) continue;
        const s = r.worldToScreen(pt[0], pt[1], 0);
        if (!s || s.visible === false || !Number.isFinite(s.clientX)) continue;
        if (s.clientX + R < box.left || s.clientX - R > box.right || s.clientY + R < top || s.clientY - R > bottom) continue;
        want = Math.max(want, bottom - (s.clientY - R - 8));
      }
    }
    // (never into the top bar: its real bottom plus an 8 px margin; a phone's HUD with its NEXT row is about 100 px tall,
    // a wide one 56. Before the HUD is drawn, 64 px under the battle's top)
    const hudBottom = root.querySelector?.('.bt-hud')?.getBoundingClientRect?.().bottom;
    const ceiling = hudBottom > 0 ? hudBottom + 8 : (root.getBoundingClientRect?.().top ?? 0) + 64;
    const max = Math.max(0, top - ceiling);
    const next = Math.round(Math.min(want, max) / 4) * 4;
    if (next !== lift) {
      lift = next;
      root.style.setProperty('--herow-lift', `${lift}px`);
    }
  }

  function update() {
    const hero = sim.hero;
    el.hidden = !hero;
    if (!hero) return;
    const now = performance.now();
    if (now - liftAt > 400) {
      liftAt = now;
      keepGoalsClear();
    }
    paintPill(hero);
    const badge = hero.level >= (shown?.max ?? 25) ? (hero.mastery > 0 ? `MAX · ${fmtNum(hero.mastery, 'pct')}` : 'MAX') : fmtNum(hero.level, 'level');
    if (badge !== lastBadge) {
      lastBadge = badge;
      lv.textContent = badge;
    }
    if (hero.level !== lastLv) {
      if (lastLv > 0 && hero.level > lastLv) {
        el.classList.remove('bt-levelup');
        void el.offsetWidth;
        el.classList.add('bt-levelup');
      }
      lastLv = hero.level;
    }
    const st = sim.towerStats(hero.uid)?.xp;
    if (st) {
      const frac = st.next == null ? 1 : Math.min(1, (st.xp - st.current) / Math.max(1, st.next - st.current));
      xpFill.style.width = `${(frac * 100).toFixed(1)}%`;
    }
    paintUltButton(ult, sim.heroUltStatus());
    paintSkill(hero);
  }

  return {
    el,
    update,
    /** The price the pill shows now (the L key buys exactly this). */
    get shown() {
      return shown;
    },
    destroy() {
      offHold?.();
    },
  };
}
