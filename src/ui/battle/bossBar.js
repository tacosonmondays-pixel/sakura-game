// Boss / miniboss HP bar under the HUD with barrier overlay and phase tick marks.
// The bar never hides its own boss: while the boss walks under it (a spawn gate near the top edge on a landscape
// phone, e.g. 3-10's Ashen Warden coming out of the tear), the bar turns see-through ('bt-boss-peek').
import { h, enemyToken, setVar, fmtBig } from './util.js';

/** How often (s) the bar checks whether its boss is under it (a projection and two rect reads). */
export const PEEK_EVERY = 0.2;

/**
 * Is a screen point under (or just beside) the bar's rectangle? The margin covers a big body around its feet.
 * @param {{ left: number, right: number, top: number, bottom: number }} r the bar (client px)
 * @param {{ clientX: number, clientY: number, visible?: boolean }|null} p the boss's feet (client px)
 * @param {number} [pad]
 */
export function underRect(r, p, pad = 28) {
  if (!r || !p || p.visible === false) return false;
  return p.clientX > r.left - pad && p.clientX < r.right + pad && p.clientY > r.top - pad && p.clientY < r.bottom + pad * 2;
}

export function createBossBar(ctx) {
  const { sim } = ctx;
  const el = h('div.bt-boss', { 'data-testid': 'boss-bar' });
  el.hidden = true;
  const name = h('span.bt-boss-name');
  const tag = h('span.bt-boss-tag');
  const hpText = h('span.bt-boss-hp');
  const fill = h('span.bt-boss-fill');
  const lag = h('span.bt-boss-lag');
  const barrier = h('span.bt-boss-barrier');
  const ticks = h('span.bt-boss-ticks');
  const tokenSlot = h('span.bt-boss-token');
  el.append(tokenSlot, h('div.bt-boss-main', h('div.bt-boss-top', tag, name, hpText), h('div.bt-boss-track', lag, fill, barrier, ticks)));
  ctx.layer.append(el);

  let currentUid = null;
  let lagFrac = 1;
  let peekIn = 0;
  let peeking = false;
  /** Back to solid with a fresh check on the next frame (a new boss, or the bar hidden). */
  function resetPeek() {
    peekIn = 0;
    peeking = false;
    el.classList.remove('bt-boss-peek');
  }
  /** See-through while the boss is under the bar (checked every PEEK_EVERY s, not every frame). */
  function peek(e, dt) {
    peekIn -= dt;
    if (peekIn > 0) return;
    peekIn = PEEK_EVERY;
    let under = false;
    try {
      under = underRect(el.getBoundingClientRect(), ctx.renderer?.worldToScreen?.(e.x, e.y, 0) || null);
    } catch {
      under = false;
    }
    if (under !== peeking) {
      peeking = under;
      el.classList.toggle('bt-boss-peek', under);
    }
  }

  function pickBoss() {
    let best = null;
    for (const e of sim.enemies) {
      if (e.dead || (e.tier !== 'boss' && e.tier !== 'miniboss')) continue;
      if (!best || (e.tier === 'boss' && best.tier !== 'boss') || (e.tier === best.tier && e.maxHp > best.maxHp)) best = e;
    }
    return best;
  }

  function update(dt = 0.016) {
    const e = pickBoss();
    if (!e) {
      if (!el.hidden) {
        el.hidden = true;
        ctx.shell?.classList.remove('bt-has-boss');
        resetPeek();
      }
      currentUid = null;
      return;
    }
    if (e.uid !== currentUid) {
      currentUid = e.uid;
      resetPeek();
      lagFrac = 1;
      el.hidden = false;
      ctx.shell?.classList.add('bt-has-boss');
      el.classList.toggle('bt-boss-mini', e.tier === 'miniboss');
      name.textContent = e.def?.name || e.id;
      tag.textContent = e.tier === 'boss' ? 'BOSS' : 'MINIBOSS';
      tokenSlot.replaceChildren(enemyToken(e.id, { size: 40 }));
      ticks.replaceChildren(...(e.def?.phases || []).map((p) => {
        const t = h('span.bt-boss-tick', { title: p.announce });
        t.style.left = `${(p.atHp * 100).toFixed(1)}%`;
        return t;
      }));
    }
    peek(e, dt);
    const frac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
    lagFrac = Math.max(frac, lagFrac - dt * 0.35);
    fill.style.width = `${(frac * 100).toFixed(2)}%`;
    lag.style.width = `${(lagFrac * 100).toFixed(2)}%`;
    const bfrac = e.maxBarrier > 0 ? Math.max(0, Math.min(1, e.barrier / e.maxBarrier)) : 0;
    barrier.style.width = `${(bfrac * 100).toFixed(2)}%`;
    setVar(el, '--boss-color', e.def?.color || '#ff4d6d');
    // fmtBig: freeplay bosses reach billions ("132.3M / 132.3M", not "132300k")
    const txt = `${fmtBig(Math.ceil(e.hp))} / ${fmtBig(Math.ceil(e.maxHp))}${bfrac > 0 ? ` · Barrier ${fmtBig(Math.ceil(e.barrier))}` : ''}`;
    if (hpText.textContent !== txt) hpText.textContent = txt;
  }

  return { el, update, destroy() { el.remove(); } };
}
