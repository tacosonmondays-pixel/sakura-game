// Boss / miniboss HP bar under the HUD with barrier overlay and phase tick marks.
import { h, enemyToken, setVar, fmtCoins } from './util.js';

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
      }
      currentUid = null;
      return;
    }
    if (e.uid !== currentUid) {
      currentUid = e.uid;
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
    const frac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
    lagFrac = Math.max(frac, lagFrac - dt * 0.35);
    fill.style.width = `${(frac * 100).toFixed(2)}%`;
    lag.style.width = `${(lagFrac * 100).toFixed(2)}%`;
    const bfrac = e.maxBarrier > 0 ? Math.max(0, Math.min(1, e.barrier / e.maxBarrier)) : 0;
    barrier.style.width = `${(bfrac * 100).toFixed(2)}%`;
    setVar(el, '--boss-color', e.def?.color || '#ff4d6d');
    const txt = `${fmtCoins(Math.ceil(e.hp))} / ${fmtCoins(e.maxHp)}${bfrac > 0 ? ` · Barrier ${fmtCoins(Math.ceil(e.barrier))}` : ''}`;
    if (hpText.textContent !== txt) hpText.textContent = txt;
  }

  return { el, update, destroy() { el.remove(); } };
}
