// Bottom tower bar: hero card + loadout cards (card art thumb, cost, water badge,
// affordability). Tap a card to start tap-to-place; drag a card onto the map to place.
import { h, setVar } from './util.js';
import { fmtNum } from '../format.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, uiIcon, currencyIcon } from '../../art/icons.js';
import { isUR, rarityColor, urBadge, rankBadge, displayRarity, applyUrFrame } from '../rarity.js';

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
  // the strip's edges (an open drawer ends it early): a card cut by an edge fades and hides its price until it is in
  // view, and a ‹ / › cue says more cards sit there (a tap scrolls to them). A cut price read as a lower one ("60" for
  // 600: the M4 review, round r1)
  const page = (dir) => scroller.scrollBy({ left: dir * Math.max(60, scroller.clientWidth * 0.7), behavior: 'smooth' });
  const cueL = h('button.bt-bar-cue.bt-bar-cue-l', { type: 'button', tabindex: '-1', 'aria-label': 'Earlier cards', 'data-testid': 'bar-cue-l', onclick: () => page(-1) }, '‹');
  const cueR = h('button.bt-bar-cue.bt-bar-cue-r', { type: 'button', tabindex: '-1', 'aria-label': 'More cards', 'data-testid': 'bar-cue-r', onclick: () => page(1) }, '›');
  const el = h('nav.bt-bar', { 'data-testid': 'tower-bar' }, scroller, cueL, cueR);

  /** One card (a Tryout Day girl who joins mid-run gets hers through sync()). */
  function addCard(unitId) {
    const def = sim.data.unit(unitId);
    if (!def || cards.has(unitId)) return;
    const isHero = def.kind === 'hero';
    // the bar only holds YOUR girls (co-op: your own loadout), so your save decides UR (display only); a Friend
    // Support girl looks as her (clamped) card says
    const own = ctx.profileFor ? ctx.profileFor(unitId) : ctx.profile;
    const ur = isUR(def, own);
    const friend = !!ctx.support && ctx.support.unitId === unitId;
    const cost = h('span.bt-card-cost-val');
    const card = h(
      `button.bt-card${isHero ? '.bt-card-hero' : ''}`,
      { 'data-unit': unitId, 'data-testid': `card-${unitId}`, title: `${def.name} — ${def.title || ''}` },
      svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-card-art'),
      h('span.bt-card-role', svgEl(roleIcon(def.role), 'bt-card-role-ico')),
      def.placement === 'water' ? h('span.bt-card-water', { title: 'Water deploy: place on water tiles' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      def.placement === 'amphibious' ? h('span.bt-card-water.bt-amphi', { title: 'Amphibious: land or water' }, svgEl(uiIcon('water'), 'bt-card-water-ico')) : null,
      isHero ? h('span.bt-card-herotag', 'HERO') : null,
      friend ? h('span.bt-card-herotag.bt-card-friendtag', { 'data-testid': 'card-support' }, 'FRIEND') : null,
      ur ? h('span.bt-card-ur', rankBadge(displayRarity(def, own))) : null,
      h('span.bt-card-name', def.name),
      h('span.bt-card-cost', svgEl(currencyIcon('coins'), 'bt-card-coin'), cost),
      isHero ? h('span.bt-card-deployed', { 'data-testid': 'hero-card-deployed' }, 'Deployed') : null,
    );
    if (friend) card.classList.add('bt-card-friend');
    setVar(card, '--rarity', rarityColor(def, own));
    if (ur) applyUrFrame(card, def, own);
    bindCard(card, unitId);
    cards.set(unitId, { card, cost, def, isHero, lastCost: -1, lastAfford: null, lastLv: -1 });
    scroller.append(card);
  }
  for (const unitId of ids) addCard(unitId);

  function bindCard(card, unitId) {
    let down = null;
    const hold = ctx.tree?.barHold(card, unitId) ?? null; // [unit-info] hold a card → her upgrade tree
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType, dragging: false };
      hold?.down(e);
      try {
        card.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
    };
    const onMove = (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (hold?.move(e)) return; // her tree is open from this press: no drag until the finger moves up
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
      if (hold?.up(e)) return; // the hold opened her tree: not a tap
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
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!hold?.pending && !hold?.fired && !ctx.ended && !ctx.paused) ctx.tree?.open({ unitId }); // right-click → tree
    });
    // keyboard access: Enter/Space acts like a tap
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ctx.onCardTap(unitId);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        ctx.tree?.open({ unitId });
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
        c.cost.textContent = price > 0 ? fmtNum(price, 'money', { round: 'up' }) : 'FREE';
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

  /** Marks each card the strip's edges cut (bt-card-part: faded, its price hidden) and shows the cue on that side. */
  function paintEdges() {
    const port = scroller.getBoundingClientRect();
    if (!port.width) return;
    let left = false;
    let right = false;
    for (const { card } of cards.values()) {
      const r = card.getBoundingClientRect();
      const cutL = r.left < port.left - 0.5;
      const cutR = r.right > port.right + 0.5;
      card.classList.toggle('bt-card-part', cutL || cutR);
      left ||= cutL;
      right ||= cutR;
    }
    el.classList.toggle('bt-bar-less', left);
    el.classList.toggle('bt-bar-more', right);
  }
  scroller.addEventListener('scroll', paintEdges, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => paintEdges()) : null;
  ro?.observe(scroller);

  update();
  return {
    el,
    update,
    paintEdges,
    cardFor: (unitId) => cards.get(unitId)?.card || null,
    /** A girl who joined the loadout (a Tryout Day pick) gets her card. */
    sync() {
      let added = false;
      for (const unitId of sim.loadout.keys()) {
        if (cards.has(unitId)) continue;
        addCard(unitId);
        added = true;
      }
      if (added) {
        update();
        paintEdges();
      }
    },
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
    destroy() {
      ro?.disconnect();
    },
  };
}
