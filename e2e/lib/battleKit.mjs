// Shared battle staging for the ability-bar e2e (e2e/abilities.mjs) and the M1 screenshot scenes (e2e/ui-shots.mjs
// --scenes): a fresh save with chosen girls and settings, a solo battle with plenty of coins, and in-page helpers on
// window.__ab (place a girl near the road or near another girl, buy tiers, unlock her ⚡ path, level the hero, make an
// ability ready, find enemies in reach) plus a recorder of the sim's ability events (window.__abilEv).

/** Opens the app on a clean save (no onboarding, the beta gift put off). */
export async function openApp(page, base) {
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) await later.click({ force: true }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
}

/**
 * Every listed girl owned, the formation (hero + towers), settings merged in (auto-start off unless given), and the
 * stages in `cleared` cleared on Normal (so the next one is a real run that saves, not practice).
 * @param {{ girls: string[], hero?: string|null, towers: string[], settings?: object, aoi?: object, cleared?: string[] }} o
 */
export async function seedSave(page, { girls, hero = 'hikari', towers, settings = {}, aoi = null, cleared = ['1-1'] }) {
  await page.evaluate(async ([girls, hero, towers, settings, aoi, cleared]) => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const p = store.profile;
    for (const id of girls) if (!p.units[id]) unlocks.grantUnit(p, id, 1760000000000);
    if (aoi && p.units.aoi) Object.assign(p.units.aoi, aoi);
    p.formation = { hero, towers: [...towers] };
    Object.assign(p.settings, { autoStart: false, ...settings });
    for (const id of cleared) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1, ...(p.progress.stages[id] || {}) };
    store.commit('e2e');
    store.saveNow?.();
  }, [girls, hero, towers, settings, aoi, cleared]);
}

/** Opens a solo battle, puts the armed hero card away, sets the coins and installs window.__ab / __abilEv. */
export async function openBattle(page, { stage = '1-2', difficulty = 'normal', cash = 1e6 } = {}) {
  await page.evaluate(([s, d]) => { location.hash = `#/battle?stage=${s}&difficulty=${d}`; }, [stage, difficulty]);
  await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select && window.__battle.ui.abilityBar, null, { timeout: 90000 });
  // the free hero card arms itself at wave 0 (~0.7 s in): let it, then put it back
  await page.waitForFunction(() => window.__battle.ui.placement?.unitId, null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  await installHelpers(page, cash);
}

/** window.__ab: battle helpers that drive the sim directly (staging), and window.__abilEv: every ability event. */
export async function installHelpers(page, cash = 1e6) {
  await page.evaluate((cash) => {
    const { sim, ui } = window.__battle;
    sim.cash = cash;
    window.__abilEv = [];
    // record the ability events as the sim emits them (with the targets' stun at that moment: "pinned")
    const emit = sim._emit.bind(sim);
    sim._emit = (type, payload) => {
      if (typeof type === 'string' && type.startsWith('ability')) {
        // a strike's targets at the moment of the cast: pinned (stunned) or already defeated by it
        const targets = type === 'ability' && Array.isArray(payload?.targets) ? payload.targets : [];
        const foe = (u) => sim.enemies.find((e) => e.uid === u);
        const pinned = targets.filter((u) => foe(u)?.statuses?.stun).length;
        const defeated = targets.filter((u) => !foe(u) || foe(u).dead).length;
        window.__abilEv.push({ type, ...payload, pinned, defeated, at: sim.time });
      }
      return emit(type, payload);
    };
    const pathOf = (t) => (t.def.paths || []).findIndex((p) => p.ability);
    const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
    window.__ab = {
      /** Places a girl: next to the road (or as near girl `near` as she can stand, at least `min` tiles off). */
      place(unitId, { near = null, min = 0, skip = 0 } = {}) {
        const ref = near != null ? sim.getTower(near) : null;
        const spots = [];
        for (let y = 0.5; y < sim.map.height; y += 0.3) {
          for (let x = 0.5; x < sim.map.width; x += 0.3) {
            if (!sim.canPlace(unitId, x, y).ok) continue;
            const p = { x, y };
            const d = ref ? Math.sqrt(dist2(p, ref)) : sim.placement.pathDistance(x, y);
            if (ref && d < min) continue;
            spots.push([d, x, y]);
          }
        }
        spots.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
        for (let i = skip; i < spots.length; i++) {
          const t = sim.placeTower(unitId, spots[i][1], spots[i][2]);
          if (t) return t.uid;
        }
        return null;
      },
      up(uid, path, n = 1) {
        let ok = 0;
        for (let i = 0; i < n; i++) if (sim.upgradeTower(uid, path)) ok++;
        return ok;
      },
      abilPath: (uid) => pathOf(sim.getTower(uid)),
      unlock(uid, tiers = 3) {
        return window.__ab.up(uid, pathOf(sim.getTower(uid)), tiers);
      },
      heroTo(level) {
        for (let i = 0; i < 60 && sim.hero && sim.hero.level < level; i++) {
          const st = sim.heroLevelStatus();
          if (!sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price }).ok) break;
        }
        return sim.hero?.level || 0;
      },
      /** Her ability charged (and, with `auto`, her Auto switch set). */
      ready(uid, { cd = 0, auto = null, endActive = false } = {}) {
        const t = sim.getTower(uid);
        if (!t?.abil) return false;
        t.abil.cd = cd;
        if (endActive) t.abil.active = 0; // (staging: a running rally / boost ends its "active" state at once)
        if (auto != null) t.abil.auto = !!auto;
        for (const [k] of sim.abilGroups) if (k.endsWith(`|${t.abil.id}`)) sim.abilGroups.delete(k);
        ui.abilityBar.refresh();
        return true;
      },
      /** Enemies her ability would find now. */
      inReach(uid) {
        const t = sim.getTower(uid);
        if (!t) return 0;
        const r = t.eff.range * 1.5;
        return sim.enemies.filter((e) => !e.dead && !e.hidden && dist2(e, t) <= r * r).length;
      },
      abil: (uid) => (sim.getTower(uid)?.abil ? { ...sim.getTower(uid).abil } : null),
      /** Freezes the battle where it is (the frame still draws): staging stills. */
      hold(on = true) {
        ui.paused = !!on;
      },
      /** A wave is running, with every enemy (and every one that spawns later) sturdy enough to keep it going. */
      keepWave(mul = 40) {
        clearInterval(window.__keepWave);
        window.__keepWave = setInterval(() => {
          for (const e of sim.enemies) {
            if (e.__sturdy) continue;
            e.__sturdy = 1;
            e.hp *= mul;
            e.maxHp *= mul;
          }
        }, 30);
        if (sim.state !== 'wave') ui.startWave();
        ui.speed = 1;
        return sim.state;
      },
      toasts: () => [...document.querySelectorAll('[data-testid="battle-feed"] .bt-toast-text')].map((e) => e.textContent),
      /**
       * Is the toast whose words match `re` really seen: on top at its centre (the feed takes no taps, so it is
       * hit-tested with pointer events on for a moment) and on one line (nothing cut off, one line tall)?
       */
      toastSeen(re) {
        const rx = new RegExp(re);
        const text = [...document.querySelectorAll('[data-testid="battle-feed"] .bt-toast-text')].find((e) => rx.test(e.textContent));
        if (!text) return { found: false };
        const toast = text.closest('.bt-toast');
        const feed = toast.parentElement;
        const r = toast.getBoundingClientRect();
        const pe = feed.style.pointerEvents;
        feed.style.pointerEvents = 'auto';
        toast.style.pointerEvents = 'auto';
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        feed.style.pointerEvents = pe;
        toast.style.pointerEvents = '';
        const cs = getComputedStyle(text);
        const fs = parseFloat(cs.fontSize) || 12;
        const lh = parseFloat(cs.lineHeight) || fs * 1.3;
        // cut: an ellipsis, or a line fragment past the text's box (to the subpixel)
        const box = text.getBoundingClientRect();
        const rg = document.createRange();
        rg.selectNodeContents(text);
        const frags = [...rg.getClientRects()];
        const cut = cs.textOverflow === 'ellipsis' && text.scrollWidth > text.clientWidth
          || frags.some((f) => f.right > box.right + 0.05 || f.left < box.left - 0.05)
          || text.scrollWidth > text.clientWidth + 1;
        const lines = Math.max(1, Math.round(text.offsetHeight / lh));
        return {
          found: true, text: text.textContent, onTop: !!hit && toast.contains(hit), hit: hit ? `${hit.tagName}.${hit.className?.baseVal ?? hit.className}` : null,
          oneLine: lines === 1 && !cut, lines, cut, px: fs, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        };
      },
      /** A board spot on screen where `unitId` can stand and a tap there lands on it (CSS px), or null. */
      spotOnScreen(unitId) {
        const r = window.__battle.renderer;
        const barTop = ui.bar.el.getBoundingClientRect().top;
        const panel = document.querySelector('[data-testid="tower-panel"]:not([hidden])')?.getBoundingClientRect();
        const ok = (x, y) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok);
        let best = null;
        for (let y = 0.4; y < sim.map.height; y += 0.4) {
          for (let x = 0.4; x < sim.map.width; x += 0.4) {
            if (!ok(x, y)) continue;
            const s = r.worldToScreen(x, y, 0);
            if (!s.visible || s.clientX < 20 || s.clientX > innerWidth - 20 || s.clientY < 70 || s.clientY > barTop - 70) continue;
            if (panel && s.clientX > panel.left - 10) continue;
            if (document.elementFromPoint(s.clientX, s.clientY) !== r.canvas) continue;
            const p = r.pick(s.clientX, s.clientY);
            if (!p.inBounds || p.towerUid != null || !sim.canPlace(unitId, p.x, p.y).ok) continue;
            const d = Math.abs(s.clientX - innerWidth / 2) + Math.abs(s.clientY - innerHeight / 2);
            if (!best || d < best.d) best = { x: s.clientX, y: s.clientY, d };
          }
        }
        return best;
      },
      /** The girls' screen points (her middle) that fall inside element `sel`'s rect. */
      girlsUnder(sel) {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const r = window.__battle.renderer;
        return sim.towers.filter((t) => !t.removed).map((t) => ({ t, p: r.worldToScreen(t.x, t.y, 0.5) }))
          .filter(({ p }) => p.clientX >= b.left && p.clientX <= b.right && p.clientY >= b.top && p.clientY <= b.bottom)
          .map(({ t, p }) => `${t.unitId}@${Math.round(p.clientX)},${Math.round(p.clientY)}`);
      },
      /**
       * A girl's spot on screen (CSS px) for a tap on the board: her feet first, else a point of her body the HUD
       * does not cover (the canvas is on top there) that the board's pick resolves to her.
       */
      screenOf(uid, h = 0) {
        const t = sim.getTower(uid);
        const r = window.__battle.renderer;
        for (const hh of [h, 0.25, 0.5, 0.75]) {
          for (const [dx, dy] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]]) {
            const p = r.worldToScreen(t.x + dx, t.y + dy, hh);
            if (document.elementFromPoint(p.clientX, p.clientY) !== r.canvas) continue;
            if (r.pick(p.clientX, p.clientY).towerUid !== uid) continue;
            return { x: p.clientX, y: p.clientY };
          }
        }
        const p = r.worldToScreen(t.x, t.y, h);
        return { x: p.clientX, y: p.clientY, covered: true };
      },
    };
  }, cash);
}

/** Two animation frames and a little more: the UI has caught up with a staged change. */
export const settle = (page, ms = 200) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))))));

/** Waits for `fn` (a page function) to be truthy, polling every 100 ms; false on timeout. */
export async function until(page, fn, arg = null, ms = 20000) {
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
}

/** A press-and-hold on an element with touch pointer events (the bar's 450 ms hold gesture). */
export async function touchHold(page, selector, ms = 900) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    window.__holdEl = { el, o };
  }, selector);
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const { el, o } = window.__holdEl;
    el.dispatchEvent(new PointerEvent('pointerup', o));
  });
}
