// Hero widget (bottom-left once the hero is deployed): portrait with level + XP bar, and
// the ultimate button with a conic cooldown ring.
import { h, setVar, fmtTime } from './util.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';

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
  const ult = h('button.bt-ult', { 'data-testid': 'ult', onclick: () => ctx.fireUlt() });
  el.append(portrait, ult);

  let lastLv = -1;
  function update() {
    const hero = sim.hero;
    el.hidden = !hero;
    if (!hero) return;
    if (hero.level !== lastLv) {
      lv.textContent = `Lv${hero.level}`;
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

  return { el, update, destroy() {} };
}
