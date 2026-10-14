// Hero widget (bottom-left once the hero is deployed): portrait with level + XP bar, the
// ultimate button with a conic cooldown ring, and the Level up pill (buys the rest of her level
// at the price it shows; the price is re-read at most twice a second).
import { h, setVar, fmtTime, fmtCoins } from './util.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { applyUrFrame } from '../rarity.js';
import { currencyIcon } from '../../art/icons.js';
import { PRICE_TICK } from './heroLevels.js';

/**
 * Paints an ult button: conic ring progress (--p 0..1), state classes and label.
 * @param {HTMLElement} btn
 * @param {object} status sim.heroUltStatus()
 */
export function paintUltButton(btn, status, { compact = true } = {}) {
  const st = status || { unlocked: false, ready: false, cooldownLeft: 0, cooldown: 0 };
  const frac = !st.unlocked ? 0 : st.ready ? 1 : st.cooldown > 0 ? 1 - st.cooldownLeft / st.cooldown : 0;
  const label = !st.unlocked ? `Lv ${st.unlockLevel ?? 3}` : st.ready ? (compact ? 'ULT' : 'Activate!') : fmtTime(st.cooldownLeft);
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
  // what the pill shows right now: a tap buys exactly this (level + price), never a dearer one
  let shown = null;
  const lvupPrice = h('b.bt-herow-lvup-price');
  const lvup = h(
    'button.bt-herow-lvup',
    { 'data-testid': 'hero-levelup-quick', title: 'Buy the rest of her level (L)', onclick: () => ctx.levelUpHero?.(shown) },
    h('small', 'LV UP'),
    h('span.bt-herow-lvup-cost', svgEl(currencyIcon('coins'), 'bt-buy-coin'), lvupPrice),
  );
  el.append(portrait, ult, lvup);

  let lastLv = -1;
  let lastBadge = '';
  let priceAt = -1;
  function paintPill(hero) {
    const now = performance.now() / 1000;
    if (shown && now - priceAt < PRICE_TICK && shown.level === hero.level) {
      lvup.classList.toggle('poor', sim.cash < shown.price);
      return;
    }
    priceAt = now;
    shown = sim.heroLevelStatus();
    const hide = !shown || shown.reason === 'max' || shown.reason === 'ended' || shown.reason === 'noHero' || ctx.ended;
    lvup.hidden = hide;
    if (hide) return;
    lvupPrice.textContent = fmtCoins(shown.price);
    lvup.classList.toggle('poor', sim.cash < shown.price);
    lvup.title = `Buy Lv ${shown.level + 1} for ${fmtCoins(shown.price)} coins (L)`;
  }

  function update() {
    const hero = sim.hero;
    el.hidden = !hero;
    if (!hero) return;
    paintPill(hero);
    const badge = hero.level >= (shown?.max ?? 25) ? (hero.mastery > 0 ? `MAX · +${Math.round(hero.mastery * 100)}%` : 'MAX') : `Lv${hero.level}`;
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
  }

  return {
    el,
    update,
    /** The price the pill shows now (the L key buys exactly this). */
    get shown() {
      return shown;
    },
    destroy() {},
  };
}
