// Co-op battle overlay: room chip with both players (colour, name, coins), the
// "Waiting for ally…" / "Ally left" state, and a small pin in the owner's colour above every
// girl showing who placed her. Mounted by the battle controller only in co-op.
// Co-op freeplay: a small flag on the chip of whoever has voted Finish (a Tryout Day Extended Day: voted Home Time).
// Long runs: while this client rebuilds its battle (a resync or rejoin replaying from the host's
// checkpoint, src/online/coop/lockstep.js) a card says so with a progress bar and keeps taps off
// the battlefield; the ally's chip says "Rin is re-syncing… 45%" meanwhile.
import '../styles/online.css';
import { h } from '../components.js';
import { fmtNum } from '../format.js';
import { COOP } from '../../data/coop.js';
import { HOME_TEXT } from '../text/tryout.js';

/** World height of the owner pin (just above a chibi's halo). */
const PIN_HEIGHT = 1.55;

export function createCoopHud(ctx) {
  const { coop, sim } = ctx;
  const ls = coop.lockstep;
  const session = coop.session;
  const players = [0, 1].map((slot) => session.player(slot));
  const cash = [h('b'), h('b')];
  const flags = [0, 1].map((slot) => h('i.ol-coop-flag', { title: sim.tryout ? HOME_TEXT.hudFlag : 'Voted to finish', 'data-testid': `coop-vote-${slot}` }, '⚑'));
  for (const f of flags) f.hidden = true;
  const chips = players.map((p, slot) => h(`div.ol-coop-p${slot === coop.mySlot ? '.me' : ''}`, { style: { '--pc': COOP.colors[slot] } },
    h('i.ol-coop-dot'), h('span.ol-coop-name', slot === coop.mySlot ? `${p?.name || 'You'} (you)` : p?.name || 'Ally'), cash[slot], flags[slot]));
  const state = h('div.ol-coop-state', { 'data-testid': 'coop-state' });
  const el = h('div.ol-coop-hud', { 'data-testid': 'coop-hud' },
    h('div.ol-coop-room', h('span', 'CO-OP'), h('b', session.code)), ...chips, state);
  const rings = h('div.ol-coop-rings');
  const syncTitle = h('b.ol-coop-sync-title');
  const syncLine = h('span.ol-coop-sync-line', { 'data-testid': 'coop-sync-line' });
  const syncFill = h('i.ol-coop-sync-fill');
  const sync = h('div.ol-coop-sync', { 'data-testid': 'coop-sync', role: 'status', 'aria-live': 'polite' },
    h('div.ol-coop-sync-card', syncTitle, syncLine, h('i.ol-coop-sync-bar', syncFill), h('small', 'Your battle is catching up with your ally\'s — one moment.')));
  sync.hidden = true;
  ctx.layer.append(el, sync);
  ctx.layer.prepend(rings);
  const allyName = () => players[1 - coop.mySlot]?.name || 'your ally';
  let lastSync = '';
  const ringEls = new Map();
  let lastState = '';
  let stateAt = 0;
  let frame = 0;
  /** A final state (the ally left / went back to the room / lost) shows this long, then only the dimmed chip says so. */
  const GONE_LINE_MS = 4000;

  function update() {
    const w = ls.coop.wallets;
    for (const slot of [0, 1]) cash[slot].textContent = fmtNum(Math.floor(w[slot] ?? 0), 'money');
    if (sim.freeplay) {
      const votes = ls.coop.endVotes?.() || [];
      for (const slot of [0, 1]) flags[slot].hidden = !votes[slot];
    }
    status();
    placeRings();
  }

  /** The connection line and the re-sync card (also on a timer: a page busy rebuilding gets few frames). */
  function status() {
    const peer = [...ls.peers.values()][0];
    const rb = ls.rebuilding;
    const syncKey = rb ? `${rb.kind}:${rb.wave}:${Math.floor((100 * rb.done) / rb.total)}` : '';
    if (syncKey !== lastSync) {
      lastSync = syncKey;
      sync.hidden = !rb;
      if (rb) {
        syncTitle.textContent = rb.kind === 'resync' ? `Re-syncing with ${allyName()}…` : `Rejoining ${allyName()}'s battle…`;
        const pct = Math.min(99, Math.floor((100 * rb.done) / rb.total));
        syncLine.textContent = rb.target != null && rb.target > 0 ? `Wave ${rb.wave} of ${rb.target} · ${pct}%` : `${pct}%`;
        syncFill.style.width = `${pct}%`;
      }
    }
    const busy = peer && !peer.gone ? peer.busy : null;
    const text = ls.desynced ? 'Lost sync — playing solo'
      : peer?.gone ? (peer.why === 'left' ? 'Ally left — their girls keep fighting'
        : peer.why === 'lobby' ? 'Ally is back in the room'
          : peer.why === 'desync' ? 'Lost sync — playing solo'
            : 'Ally disconnected — their girls keep fighting')
        : rb ? 'Re-syncing…'
          : ls.resyncPending ? 'Resyncing with the host…'
            : busy ? `${players[1 - coop.mySlot]?.name || 'Ally'} is re-syncing… ${Math.min(99, Math.floor((100 * busy.at) / busy.of))}%`
              : ls.stalled ? 'Waiting for ally…' : '';
    if (text !== lastState) {
      lastState = text;
      stateAt = performance.now();
      state.textContent = text;
      state.hidden = !text;
      el.classList.toggle('ol-coop-wait', !!text && !peer?.gone);
      chips[1 - coop.mySlot]?.classList.toggle('gone', !!peer?.gone || !!ls.desynced);
    } else if (text && (peer?.gone || ls.desynced) && !state.hidden && performance.now() - stateAt > GONE_LINE_MS) {
      // (the feed said it too; the line would only cover the field from now on)
      state.hidden = true;
    }
  }

  function placeRings() {
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
  const statusTimer = setInterval(status, 150);
  const offRebuild = session.on?.('rebuild', status); // the card at once, not at the next frame
  return {
    el,
    update,
    destroy() {
      clearInterval(statusTimer);
      offRebuild?.();
      el.remove();
      sync.remove();
      rings.remove();
    },
  };
}
