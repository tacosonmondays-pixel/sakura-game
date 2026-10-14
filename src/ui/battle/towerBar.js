// Bottom tower bar: hero card + loadout cards (card art thumb, cost, water badge,
// affordability). Tap a card to start tap-to-place; drag a card onto the map to place.
import { h, setVar, fmtCoins } from './util.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, uiIcon, currencyIcon } from '../../art/icons.js';
import { isUR, rarityColor, urBadge, applyUrFrame } from '../rarity.js';

const DRAG_START_PX = 12;

/**
 * @param {object} ctx battle context
 * @returns {{ el: HTMLElement, update(): void, destroy(): void, cardFor(unitId): HTMLElement|null }}
 */
export function createTowerBar(ctx) {
  const { sim } = ctx;
  const ids = [];
  if (sim.heroConfig) ids.push(sim.heroConfig.unitId);
  ids.push(...sim.loadout.keys());
  const cards = new Map();
  const scroller = h('div.bt-bar-scroll');
  const el = h('nav.bt-bar', { 'data-testid': 'tower-bar' }, scroller);

  for (const unitId of ids) {
    const def = sim.data.unit(unitId);
    if (!def) continue;
    const isHero = def.kind === 'hero';
    // the bar only holds YOUR girls (co-op: your own loadout), so your save decides UR (display only)
    const ur = isUR(def, ctx.profile);
    const cost = h('span.bt-card-cost-val');
    const card = h(
      `button.bt-card${isHero ? '.bt-card-hero' : ''}`,
      { 'data-unit': unitId, 'data-testid': `card-${unitId}`, title: `${def.name} — ${def.title || ''}` },
      svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-card-art'),
      h('span.bt-card-role', svgEl(roleIcon(def.role), 'bt-card-role-ico')),
      def.placement === 'water' ? h('span.bt-card-water', { title: 'Water deploy: place on water tiles' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      def.placement === 'amphibious' ? h('span.bt-card-water.bt-amphi', { title: 'Amphibious: land or water' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      isHero ? h('span.bt-card-herotag', 'HERO') : null,
      ur ? h('span.bt-card-ur', urBadge()) : null,
      h('span.bt-card-name', def.name),
      h('span.bt-card-cost', svgEl(currencyIcon('coins'), 'bt-card-coin'), cost),
      isHero ? h('span.bt-card-deployed', { 'data-testid': 'hero-card-deployed' }, 'Deployed') : null,
    );
    setVar(card, '--rarity', rarityColor(def, ctx.profile));
    if (ur) applyUrFrame(card, def, ctx.profile);
    bindCard(card, unitId);
    cards.set(unitId, { card, cost, def, isHero, lastCost: -1, lastAfford: null, lastLv: -1 });
    scroller.append(card);
  }

  function bindCard(card, unitId) {
    let down = null;
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, dragging: false };
      try {
        card.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
    };
    const onMove = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!down.dragging) {
        const upward = -dy > DRAG_START_PX && Math.abs(dy) > Math.abs(dx) * 0.8;
        const mouseDrag = down.type === 'mouse' && Math.hypot(dx, dy) > DRAG_START_PX;
        if (!(upward || mouseDrag)) return;
        if (!ctx.placement.beginDrag(unitId)) {
          down = null;
          return;
        }
        down.dragging = true;
      }
      e.preventDefault();
      ctx.placement.dragMove(e.clientX, e.clientY, down.type);
    };
    const onUp = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      if (e.type === 'pointercancel') {
        if (d.dragging) ctx.placement.cancel();
        return;
      }
      if (d.dragging) ctx.placement.dragEnd(e.clientX, e.clientY, d.type);
      else ctx.onCardTap(unitId);
    };
    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard access: Enter/Space acts like a tap
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ctx.onCardTap(unitId);
      }
    });
  }

  function update() {
    const placingId = ctx.placement?.unitId ?? null;
    for (const [unitId, c] of cards) {
      const deployed = c.isHero && !!sim.hero;
      const price = sim.placeCost(unitId);
      if (price !== c.lastCost) {
        // heroes deploy for free: the price slot says FREE (no coin)
        c.cost.textContent = price > 0 ? fmtCoins(price) : 'FREE';
        c.cost.parentElement.classList.toggle('bt-free', !(price > 0));
        c.lastCost = price;
      }
      if (c.isHero) {
        const lv = deployed ? sim.hero.level : 0;
        if (lv !== c.lastLv) {
          c.lastLv = lv;
          const tag = c.card.querySelector('.bt-card-deployed');
          if (tag) tag.textContent = lv ? `Deployed · Lv ${lv}` : 'Deployed';
        }
        // wave 0, not deployed yet: the card pulses (it is armed on load, see controller.js)
        c.card.classList.toggle('bt-card-hero-arm', !deployed && sim.wave === 0 && sim.state === 'prep');
      }
      const afford = sim.cash >= price;
      if (afford !== c.lastAfford) {
        c.card.classList.toggle('bt-poor', !afford);
        c.lastAfford = afford;
      }
      c.card.classList.toggle('bt-deployed', deployed);
      c.card.classList.toggle('bt-active', placingId === unitId);
    }
  }

  update();
  return {
    el,
    update,
    cardFor: (unitId) => cards.get(unitId)?.card || null,
    /** Brief glow on a girl's card (just deployed), so the card connects to her chibi on the map. */
    flash(unitId) {
      const card = cards.get(unitId)?.card;
      if (!card) return;
      card.classList.remove('bt-card-flash');
      void card.offsetWidth;
      card.classList.add('bt-card-flash');
      clearTimeout(card._flashT);
      card._flashT = setTimeout(() => card.classList.remove('bt-card-flash'), 1300);
    },
    destroy() {},
  };
}
