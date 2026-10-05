// Bottom tower bar: hero card + loadout cards (card art thumb, cost, water badge,
// affordability). Tap a card to start tap-to-place; drag a card onto the map to place.
import { h, setVar, fmtCoins } from './util.js';
import { svgEl } from '../components.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { roleIcon, uiIcon, currencyIcon } from '../../art/icons.js';
import { UNIT_RARITIES } from '../../data/types.js';

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
    const cost = h('span.bt-card-cost-val');
    const card = h(
      `button.bt-card${isHero ? '.bt-card-hero' : ''}`,
      { 'data-unit': unitId, 'data-testid': `card-${unitId}`, title: `${def.name} — ${def.title || ''}` },
      svgEl(cardArtSVG(def, { variant: 'thumb', awaken: ctx.profile.units?.[unitId]?.awaken || 0 }), 'bt-card-art'),
      h('span.bt-card-role', svgEl(roleIcon(def.role), 'bt-card-role-ico')),
      def.placement === 'water' ? h('span.bt-card-water', { title: 'Water deploy: place on water tiles' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      def.placement === 'amphibious' ? h('span.bt-card-water.bt-amphi', { title: 'Amphibious: land or water' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      isHero ? h('span.bt-card-herotag', 'HERO') : null,
      h('span.bt-card-name', def.name),
      h('span.bt-card-cost', svgEl(currencyIcon('coins'), 'bt-card-coin'), cost),
      isHero ? h('span.bt-card-deployed', 'Deployed') : null,
    );
    setVar(card, '--rarity', UNIT_RARITIES[def.rarity]?.color);
    bindCard(card, unitId);
    cards.set(unitId, { card, cost, def, isHero, lastCost: -1, lastAfford: null });
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
        c.cost.textContent = fmtCoins(price);
        c.lastCost = price;
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
    destroy() {},
  };
}
