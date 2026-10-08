// Co-op battle overlay: room chip with both players (colour, name, coins), the
// "Waiting for ally…" / "Ally left" state, and a small pin in the owner's colour above every
// girl showing who placed her. Mounted by the battle controller only in co-op.
import '../styles/online.css';
import { h } from '../components.js';
import { fmtCoins } from '../battle/util.js';
import { COOP } from '../../data/coop.js';

/** World height of the owner pin (just above a chibi's halo). */
const PIN_HEIGHT = 1.55;

export function createCoopHud(ctx) {
  const { coop, sim } = ctx;
  const ls = coop.lockstep;
  const session = coop.session;
  const players = [0, 1].map((slot) => session.player(slot));
  const cash = [h('b'), h('b')];
  const chips = players.map((p, slot) => h(`div.ol-coop-p${slot === coop.mySlot ? '.me' : ''}`, { style: { '--pc': COOP.colors[slot] } },
    h('i.ol-coop-dot'), h('span.ol-coop-name', slot === coop.mySlot ? `${p?.name || 'You'} (you)` : p?.name || 'Ally'), cash[slot]));
  const state = h('div.ol-coop-state', { 'data-testid': 'coop-state' });
  const el = h('div.ol-coop-hud', { 'data-testid': 'coop-hud' },
    h('div.ol-coop-room', h('span', 'CO-OP'), h('b', session.code)), ...chips, state);
  const rings = h('div.ol-coop-rings');
  ctx.layer.append(el);
  ctx.layer.prepend(rings);
  const ringEls = new Map();
  let lastState = '';
  let frame = 0;

  function update() {
    const w = ls.coop.wallets;
    for (const slot of [0, 1]) cash[slot].textContent = fmtCoins(Math.floor(w[slot] ?? 0));
    const peer = [...ls.peers.values()][0];
    const text = ls.desynced ? 'Lost sync — playing solo' : peer?.gone ? 'Ally left — their girls keep fighting' : ls.resyncPending ? 'Resyncing with the host…' : ls.stalled ? 'Waiting for ally…' : '';
    if (text !== lastState) {
      lastState = text;
      state.textContent = text;
      state.hidden = !text;
      el.classList.toggle('ol-coop-wait', !!text && !peer?.gone);
    }
    // owner rings (every other frame is plenty)
    if (frame++ % 2 || !ctx.renderer?.worldToScreen) return;
    const seen = new Set();
    for (const t of sim.towers) {
      const owner = ls.coop.ownerOf(t.uid);
      if (owner == null) continue;
      seen.add(t.uid);
      let r = ringEls.get(t.uid);
      if (!r) {
        r = h('i.ol-ring', { style: { '--pc': COOP.colors[owner] } });
        if (owner !== coop.mySlot) r.classList.add('ally');
        rings.append(r);
        ringEls.set(t.uid, r);
      }
      const p = ctx.renderer.worldToScreen(t.x, t.y, PIN_HEIGHT);
      r.hidden = !p.visible;
      r.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(-45deg)`;
    }
    for (const [uid, r] of ringEls) {
      if (!seen.has(uid)) {
        r.remove();
        ringEls.delete(uid);
      }
    }
  }

  update();
  return {
    el,
    update,
    destroy() {
      el.remove();
      rings.remove();
    },
  };
}
