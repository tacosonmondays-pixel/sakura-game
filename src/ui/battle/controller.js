// Battle controller: builds the Sim from the profile, creates the renderer, runs the RAF
// loop (paused while the tab is hidden), wires HUD / tower bar / panels / results, and
// cleans everything up on leave. Exposes window.__battle = { sim, renderer, ui } for e2e.
import { h } from '../dom.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { preloadModels, preloadEnemies, detailFor } from '../../models/index.js';
import { createBattleRenderer } from '../../render/BattleRenderer.js';
import { STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { TRAITS, BATTLE } from '../../data/types.js';
import { createBattleSim, parseBattleParams, mapRouteFor } from './setup.js';
import { createHud } from './hud.js';
import { createTowerBar } from './towerBar.js';
import { createPlacement } from './placement.js';
import { createTowerPanel } from './towerPanel.js';
import { createHeroWidget, paintUltButton } from './heroWidget.js';
import { createBossBar } from './bossBar.js';
import { createFeed } from './feed.js';
import { createWaveControl } from './waveControl.js';
import { createPauseMenu } from './pauseMenu.js';
import { createResults } from './results.js';
import { enemyDef, traitBadge, fmtCoins } from './util.js';

const RESULT_DELAY_MS = 1700;
const MODEL_TIMEOUT_MS = 5000;

/** Resolves after `promise` or `ms`, whichever comes first (never rejects). */
function settle(promise, ms) {
  return Promise.race([Promise.resolve(promise).catch(() => false), new Promise((r) => setTimeout(() => r(false), ms))]);
}

/**
 * Mounts a battle into `root`.
 * @param {HTMLElement} root
 * @param {object} params route params ({ stage, difficulty, endless? })
 * @param {{ restart(): void }} hooks
 * @returns {{ destroy(): void, ready: Promise<void> }}
 */
export function mountBattle(root, params, hooks) {
  const profile = store.profile;
  const req = parseBattleParams(params, profile);
  const shell = h('div.bt-root', { 'data-testid': 'battle' });
  root.append(shell);

  if (req.error) {
    shell.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Battle unavailable'), h('p', req.error), h('button.bt-cta', { onclick: () => navigate('campaign') }, 'Back to the map'))));
    return { destroy: () => shell.remove(), ready: Promise.resolve() };
  }

  const stage = STAGE_MAP[req.stageId];
  const stageEl = h('div.bt-canvas');
  const layer = h('div.bt-layer');
  const loading = h('div.bt-loading', h('div.bt-loading-card', h('div.bt-loading-petal'), h('b', 'Deploying sentinels…'), h('span', stage.name)));
  shell.append(stageEl, layer, loading);

  let destroyed = false;
  let raf = 0;
  const cleanups = [];
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const { sim, towers, hero } = createBattleSim(profile, req);
  const settings = profile.settings || {};

  /** Enemy model families this stage can spawn (pool + fixed + split/brood/summon children). */
  function stageFamilies() {
    const fams = new Set();
    try {
      for (const x of stageEnemies(stage) || []) {
        const def = typeof x === 'string' ? ENEMY_MAP[x] : x;
        if (def) fams.add(def.model?.base || def.family);
      }
    } catch (e) {
      console.warn('[battle] stage enemy list failed', e);
    }
    return [...fams].filter(Boolean);
  }
  const knownEnemies = new Set(Object.entries(profile.bestiary || {}).filter(([, b]) => b?.seen || b?.discovered).map(([id]) => id));

  const ctx = {
    sim,
    stage,
    req,
    profile,
    settings,
    layer,
    shell,
    renderer: null,
    knownEnemies,
    speed: [1, 2, 3].includes(Number(settings.defaultSpeed)) ? Number(settings.defaultSpeed) : 1,
    paused: false,
    ended: false,
    selectedUid: null,
  };

  const ready = (async () => {
    // chibis-v2: only the formation (+ hero) at the detail this quality needs (phones get the
    // LODs); enemies-v2: the stage's enemy families (procedural fallback when a GLB is missing).
    const ids = [...towers, ...(hero ? [hero] : [])];
    const detail = detailFor(settings.quality || 'high');
    await settle(Promise.all([preloadModels(ids, { detail }), preloadEnemies(stageFamilies())]), MODEL_TIMEOUT_MS);
    if (destroyed) return;
    build();
    loading.classList.add('out');
    later(() => loading.remove(), 400);
  })();

  function build() {
    const feed = createFeed(layer);
    ctx.feed = feed;
    const hud = createHud(ctx);
    const bar = createTowerBar(ctx);
    ctx.bar = bar;
    layer.prepend(hud.el);
    layer.append(bar.el);
    const placement = createPlacement(ctx);
    ctx.placement = placement;
    const heroW = createHeroWidget(ctx);
    layer.append(heroW.el);
    const boss = createBossBar(ctx);
    const wave = createWaveControl(ctx);
    const panel = createTowerPanel(ctx);
    const pause = createPauseMenu(ctx);
    const results = createResults(ctx);
    const modules = [hud, bar, placement, heroW, boss, wave, panel, pause, results, feed];

    let renderer;
    try {
      renderer = createBattleRenderer(stageEl, sim, { quality: settings.quality, settings, insets: insets() });
    } catch (e) {
      console.error('[battle] renderer failed', e);
      layer.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Graphics unavailable'), h('p', 'WebGL could not start on this device. Try lowering the quality in Settings.'), h('button.bt-cta', { onclick: () => navigate('settings') }, 'Settings'))));
      return;
    }
    ctx.renderer = renderer;

    // ---- context actions -------------------------------------------------------------
    ctx.select = (uid) => {
      if (ctx.ended && uid != null) return;
      if (uid != null && placement.unitId) placement.cancel();
      ctx.selectedUid = uid ?? null;
      renderer.setSelected(ctx.selectedUid);
      if (ctx.selectedUid == null) panel.close();
      else panel.open(ctx.selectedUid);
      shell.classList.toggle('bt-has-panel', ctx.selectedUid != null);
    };
    ctx.onCardTap = (unitId) => {
      if (ctx.ended || ctx.paused) return;
      if (placement.unitId === unitId) placement.cancel();
      else placement.start(unitId);
      bar.update();
    };
    ctx.onPlaced = (t) => {
      navigator.vibrate?.(12);
      if (t.isHero) feed.push(`${t.def.name} takes the field! She levels up as she fights.`, 'good', { ms: 2400 });
      bar.update();
    };
    ctx.onUpgraded = (t, path) => {
      const tier = t.tiers[path];
      const name = t.def.paths[path]?.tiers[tier - 1]?.name;
      feed.push(`${t.def.name} · ${name}`, 'good', { ms: 1600, key: `upg-${t.uid}-${path}-${tier}` });
      navigator.vibrate?.(8);
    };
    ctx.cycleSpeed = () => {
      const speeds = BATTLE.speeds || [1, 2, 3];
      ctx.speed = speeds[(speeds.indexOf(ctx.speed) + 1) % speeds.length];
    };
    ctx.setAutoStart = (v) => {
      sim.options.autoStart = !!v;
      store.profile.settings.autoStart = !!v;
      store.commit('settings');
      if (v && sim.state === 'between') ctx.startWave();
      wave.update();
    };
    ctx.startWave = () => {
      if (ctx.ended) return;
      if (sim.startNextWave()) {
        if (ctx.paused) ctx.closePause();
      }
      wave.update();
    };
    ctx.fireUlt = () => {
      const st = sim.heroUltStatus();
      if (!sim.hero) return;
      if (!st.unlocked) {
        feed.push(`Ultimate unlocks at hero level ${st.unlockLevel ?? 3}.`, 'warn', { key: 'ult-locked', ms: 1600 });
        return;
      }
      if (!st.ready) {
        feed.push(sim.state === 'wave' ? `Recharging — ${Math.ceil(st.cooldownLeft)}s` : 'The ultimate only charges during waves.', 'warn', { key: 'ult-cd', ms: 1400 });
        return;
      }
      sim.activateUlt();
    };
    ctx.paintUltButton = (btn, opts) => paintUltButton(btn, sim.heroUltStatus(), opts);
    ctx.bump = () => {
      const c = hud.el.querySelector('.bt-cash');
      if (!c) return;
      c.classList.remove('bt-poor-flash');
      void c.offsetWidth;
      c.classList.add('bt-poor-flash');
    };
    ctx.openPause = () => {
      if (ctx.ended) return;
      placement.cancel();
      ctx.paused = true;
      pause.show();
      shell.classList.add('bt-paused');
    };
    ctx.closePause = () => {
      ctx.paused = false;
      pause.hide();
      shell.classList.remove('bt-paused');
      lastT = performance.now();
    };
    ctx.restart = () => hooks.restart();
    ctx.quit = () => navigate('stage', { id: stage.id });
    ctx.goNext = (id) => navigate('stage', { id });
    ctx.goMap = () => {
      const r = mapRouteFor(stage);
      navigate(r.name, r.params);
    };
    ctx.goHome = () => navigate('lobby');

    // ---- input ------------------------------------------------------------------------
    cleanups.push(renderer.onTap((p) => {
      if (ctx.paused || ctx.ended) return;
      hud.scout.destroy();
      if (placement.handleTap(p)) return;
      ctx.select(p.towerUid != null ? p.towerUid : null);
    }));
    const onCanvasMove = (e) => {
      if (e.pointerType === 'mouse' && !e.buttons) placement.hover(e.clientX, e.clientY);
    };
    renderer.canvas.addEventListener('pointermove', onCanvasMove);
    cleanups.push(() => renderer.canvas.removeEventListener('pointermove', onCanvasMove));
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || document.querySelector('.modal-overlay')) return;
      if (e.key === 'Escape') {
        if (placement.unitId) placement.cancel();
        else if (ctx.selectedUid != null) ctx.select(null);
        else if (ctx.paused) ctx.closePause();
        else ctx.openPause();
      } else if (e.key === ' ' && !ctx.paused) {
        e.preventDefault();
        ctx.startWave();
      } else if ((e.key === 'f' || e.key === 'F') && !ctx.paused) ctx.cycleSpeed();
      else if (/^[1-9]$/.test(e.key) && !ctx.paused) {
        const ids = [...bar.el.querySelectorAll('.bt-card')].map((c) => c.dataset.unit);
        const id = ids[Number(e.key) - 1];
        if (id) ctx.onCardTap(id);
      }
    };
    window.addEventListener('keydown', onKey);
    cleanups.push(() => window.removeEventListener('keydown', onKey));

    // ---- layout: keep the map framed between HUD and tower bar --------------------------
    function insets() {
      const r = shell.getBoundingClientRect();
      const top = (hud.el.getBoundingClientRect().bottom - r.top) || 56;
      const bottom = (r.bottom - bar.el.getBoundingClientRect().top) || 90;
      return { top: Math.max(0, top + 4), bottom: Math.max(0, bottom + 2), left: 0, right: 0 };
    }
    const ro = new ResizeObserver(() => renderer.setInsets(insets()));
    ro.observe(hud.el);
    ro.observe(bar.el);
    ro.observe(shell);
    cleanups.push(() => ro.disconnect());

    // ---- tab visibility: stop the loop while hidden ---------------------------------------
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (sim.state === 'wave' && !ctx.ended && !ctx.paused) ctx.openPause();
      } else if (!raf && !destroyed) {
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

    // ---- events from the sim (via renderer.update) ------------------------------------------
    const announcedNew = new Set();
    function warnFor(n) {
      let list = [];
      try {
        list = sim.waveWarnings(n);
      } catch {
        return;
      }
      for (const w of list) if (w.kind === 'new') for (const id of [w.enemyId, ...(w.enemyIds || [])]) if (id) announcedNew.add(id);
      for (const w of list.slice(0, 3)) {
        const kind = w.severity === 'danger' ? 'bad' : w.severity === 'warn' ? 'warn' : 'info';
        feed.push(w.text, kind, { key: `warn-${n}-${w.kind}-${w.enemyId || w.trait || ''}`, ms: 5200, icon: w.trait && TRAITS[w.trait] ? traitBadge(w.trait, 'bt-toast-ico') : null });
      }
    }

    function handle(events) {
      for (const ev of events) {
        switch (ev.type) {
          case 'leak': {
            const name = enemyDef(ev.id)?.name || ev.id;
            feed.push(`${name} slipped through`, 'bad', { key: `leak-${ev.id}`, merge: true, ms: 2600 });
            if (ev.lives > 0) navigator.vibrate?.(20);
            break;
          }
          case 'spawn': {
            const def = enemyDef(ev.id);
            if (!def) break;
            if (def.tier === 'boss' || def.tier === 'miniboss') {
              feed.announce(def.tier === 'boss' ? 'BOSS INCOMING' : 'MINIBOSS', def.name, 'boss', 2600);
            }
            if (!knownEnemies.has(ev.id) && !announcedNew.has(ev.id) && def.leak !== 0) {
              announcedNew.add(ev.id);
              const traits = Object.keys(def.traits || {}).filter((k) => def.traits[k]);
              // the enemy's defining rule: its first trait, else visible armour
              const trait = traits.find((k) => TRAITS[k]) || (def.armor > 0 && TRAITS.armored ? 'armored' : null);
              feed.push([`New enemy: `, h('b', def.name), trait && TRAITS[trait] ? ` — ${TRAITS[trait].name}` : ''], 'new', { ms: 4200, icon: trait && TRAITS[trait] ? traitBadge(trait, 'bt-toast-ico') : null });
            }
            break;
          }
          case 'waveStart':
            feed.announce(`WAVE ${ev.wave}`, Number.isFinite(sim.totalWaves) ? (ev.wave === sim.totalWaves ? 'Final wave!' : `of ${sim.totalWaves}`) : 'Endless', 'wave', 1300);
            break;
          case 'waveEnd':
            feed.push(`Wave ${ev.wave} cleared · +${fmtCoins(ev.bonus || 0)} coins`, 'good', { ms: 2200 });
            if (sim.state !== 'won') later(() => warnFor(sim.wave + 1), 400);
            break;
          case 'bossPhase':
            feed.announce('PHASE SHIFT', ev.announce || '', 'phase', 3200);
            break;
          case 'heroLevel': {
            const name = sim.hero?.def.name || 'Hero';
            const ult = sim.hero?.def.hero?.ult;
            const unlock = ult && ev.level === (ult.unlockLevel ?? 3);
            feed.push(unlock ? `${name} reached Lv ${ev.level} — ${ult.name} unlocked!` : `${name} reached Lv ${ev.level}`, 'good', { ms: 2400 });
            break;
          }
          case 'ult':
            feed.announce(ev.name || 'Ultimate', sim.hero?.def.name || '', 'good', 1500);
            break;
          case 'teleportWarn':
            feed.push('A ghoul is about to blink forward — slow or stun it!', 'warn', { key: 'blink', ms: 2000 });
            break;
          case 'sabotage': {
            const t = sim.getTower(ev.towerUid);
            feed.push(`${t?.def.name || 'A girl'} was sabotaged! Cleanse auras protect.`, 'warn', { key: 'sabotage', ms: 2200 });
            break;
          }
          case 'sell':
            if (ctx.selectedUid === ev.towerUid) ctx.select(null);
            break;
          case 'won':
            endBattle(true);
            break;
          case 'lost':
            endBattle(false);
            break;
          default:
            break;
        }
      }
    }

    function endBattle(won) {
      if (ctx.ended) return;
      ctx.ended = true;
      placement.cancel();
      ctx.select(null);
      pause.hide();
      ctx.paused = false;
      shell.classList.add('bt-ended');
      feed.announce(won ? 'STAGE CLEAR!' : 'DEFEAT', won ? `${sim.lives}/${sim.maxLives} lives left` : `Fell on wave ${sim.wave}`, won ? 'good' : 'bad', RESULT_DELAY_MS - 200);
      results.apply();
      later(() => (won ? results.showVictory() : results.showDefeat()), RESULT_DELAY_MS);
    }

    // ---- main loop ----------------------------------------------------------------------
    let lastT = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      const running = !ctx.paused && !ctx.ended;
      if (running) sim.update(dt * ctx.speed);
      let events = [];
      // while a full-screen sheet (results / pause) covers the map, skip the 3D frame (battery)
      if (results.open || pause.open) return;
      try {
        events = renderer.update(running ? dt : ctx.ended ? dt : 0);
      } catch (e) {
        console.error('[battle] render failed', e);
      }
      handle(events);
      hud.update();
      bar.update();
      panel.update();
      heroW.update();
      boss.update(dt);
      wave.update();
    }
    raf = requestAnimationFrame(frame);

    // first-wave scouting + practice notice
    later(() => warnFor(1), 600);
    if (req.practice) feed.push('Practice run: this stage is still locked on your map, so nothing from this battle is saved.', 'info', { ms: 4200 });

    ctx.modules = modules;
    ctx.results = results;
    window.__battle = { sim, renderer, ui: ctx };
  }

  return {
    ready,
    destroy() {
      if (destroyed) return;
      // a finished battle always pays out, even if the player leaves before the modal
      if (ctx.ended && ctx.results && !ctx.results.outcome) ctx.results.apply();
      destroyed = true;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const fn of cleanups.splice(0)) {
        try {
          fn();
        } catch (e) {
          console.warn('[battle] cleanup failed', e);
        }
      }
      for (const m of ctx.modules || []) {
        try {
          m.destroy?.();
        } catch (e) {
          console.warn('[battle] module cleanup failed', e);
        }
      }
      try {
        ctx.renderer?.dispose();
      } catch (e) {
        console.warn('[battle] renderer dispose failed', e);
      }
      shell.remove();
      if (window.__battle?.sim === sim) delete window.__battle;
    },
  };
}
