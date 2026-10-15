// Battle controller: builds the Sim from the profile, creates the renderer, runs the RAF
// loop (paused while the tab is hidden), wires HUD / tower bar / panels / results, and
// cleans everything up on leave. Exposes window.__battle = { sim, renderer, ui } for e2e.
import { h } from '../dom.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { preloadModels, preloadEnemies, detailFor } from '../../models/index.js';
import { createBattleRenderer } from '../../render/BattleRenderer.js';
import { cameraModeOf } from '../../render/cameraPolicy.js';
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
import { finalRaceText } from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { quantize } from '../../online/coop/commands.js';
import { battleLockstep, normalizeCode } from '../../online/coop/session.js';
import { roomByCode, roomRoute } from '../../online/coop/lastRoom.js';
import { applyCoopResult, freeplayLedger, payFreeplayEnd } from '../../online/coop/rewards.js';
import { normalizeList } from '../../systems/inventory.js';
import { createCoopHud } from '../online/coopHud.js';
import { createFreeplayBattle } from './freeplay.js';
import { COOP } from '../../data/coop.js';
import { applyBattleResult } from '../../systems/rewards.js';
import { soloFreeplayLedger, bankSoloClear, paySoloFreeplay, soloWaveCoins } from '../../systems/freeplayRewards.js';
import { continueIntoFreeplay, rememberSoloTier } from './soloFreeplay.js';
import { createRng, hashString } from '../../core/rng.js';
import { attachBattleAudio } from '../../audio/battle.js'; // [audio]

const RESULT_DELAY_MS = 1700;
const MODEL_TIMEOUT_MS = 5000;

/** Resolves after `promise` or `ms`, whichever comes first (never rejects). */
function settle(promise, ms) {
  return Promise.race([Promise.resolve(promise).catch(() => false), new Promise((r) => setTimeout(() => r(false), ms))]);
}

/**
 * Mounts a battle into `root`.
 * @param {HTMLElement} root
 * @param {object} params route params ({ stage, difficulty, endless?, coop?, clanBoss? })
 * @param {{ restart(): void, coop?: object|null }} hooks  coop = the co-op session (online/coop/session.js)
 * @returns {{ destroy(): void, ready: Promise<void> }}
 */
export function mountBattle(root, params, hooks) {
  const profile = store.profile;
  // Co-op: the Sim comes from the session's Lockstep (same start message on both clients)
  const session = params.coop ? hooks.coop || null : null;
  const ls = battleLockstep(params, session);
  // a co-op battle page without its battle (reloaded, or reached again later): the room itself
  // is still there, so lead back into it (no code to retype, no new room)
  const coopRoom = params.coop && !ls ? roomByCode(normalizeCode(params.coop)) : null;
  const req = ls
    ? { stageId: ls.start.stageId, difficulty: ls.start.difficulty, endless: false, freeplay: null, keepGoing: false, practice: false, error: null }
    : params.coop
      ? { error: coopRoom ? `This battle is over (or the page was reloaded). Room ${coopRoom.code} is still open: go back in and play again.` : 'This co-op battle has ended (or this page was reloaded). Open a new room to play again.' }
      : parseBattleParams(params, profile);
  const shell = h('div.bt-root', { 'data-testid': 'battle' });
  root.append(shell);

  if (req.error) {
    const back = coopRoom ? () => navigate('coop', roomRoute(coopRoom)) : params.coop ? () => navigate('coop') : () => navigate('campaign');
    const label = coopRoom ? 'Back to the room' : params.coop ? 'Back to co-op' : 'Back to the map';
    shell.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Battle unavailable'), h('p', req.error), h('button.bt-cta', { 'data-testid': coopRoom ? 'coop-room-again' : 'battle-unavailable-back', onclick: back }, label))));
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

  const { sim, towers, hero } = ls
    ? {
      sim: ls.sim,
      towers: [...new Set(ls.start.players.flatMap((p) => (p.loadout || []).map((e) => e.unitId)))],
      hero: ls.start.players.find((p) => p.slot === 0)?.hero?.unitId || null,
    }
    : createBattleSim(profile, req);
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
    if (ls) {
      coopHud = createCoopHud(ctx);
      modules.push(coopHud);
    }
    if (ls && sim.freeplay) {
      // co-op freeplay: banners, the bank at the goal, the Finish vote (src/ui/battle/freeplay.js)
      fpBattle = createFreeplayBattle(ctx, { session, lockstep: ls, homeFamilies: stageFamilies() });
      modules.push(fpBattle);
      ctx.freeplay = fpBattle;
    } else if (soloLedger && sim.freeplay) {
      // solo freeplay from stage prep: the same banners; the bank is a normal solo win
      startSoloFreeplay(modules);
    }

    let renderer;
    try {
      // isPlacing: a bar drag or a tapped card waiting for the board tap holds the camera still
      renderer = createBattleRenderer(stageEl, sim, { quality: settings.quality, settings, insets: insets(), isPlacing: () => !!ctx.placement?.unitId });
    } catch (e) {
      console.error('[battle] renderer failed', e);
      layer.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Graphics unavailable'), h('p', 'WebGL could not start on this device. Try lowering the quality in Settings.'), h('button.bt-cta', { onclick: () => navigate('settings') }, 'Settings'))));
      return;
    }
    ctx.renderer = renderer;
    // Settings → Battle → Camera (or the pause menu) applies to the open battle at once
    cleanups.push(store.on('change', () => renderer.setCameraMode(cameraModeOf(store.profile.settings))));
    // keep the toast feed off the spawn gates and the first tiles of road behind them (and,
    // as a tie-break, off the exit gates and the last tiles of road before them)
    const tracks = sim.map?.tracks || [];
    const spawnRuns = tracks.filter((t) => !t.fork).map((t) => t.points.filter((_, i) => i % 5 === 0 && t.cum[i] <= 5.5));
    const exitRuns = tracks.filter((t) => !t.join).map((t) => t.points.filter((_, i) => i % 5 === 0 && t.cum[i] >= t.length - 3.5));
    feed.setAvoid(() => {
      const L = layer.getBoundingClientRect();
      const out = [];
      for (const [runs, w] of [[spawnRuns, 1], [exitRuns, 0.2]]) {
        for (const run of runs) {
          for (const [x, y] of run) {
            const p = renderer.worldToScreen(x, y, 0);
            out.push({ x: p.clientX - L.left, y: p.clientY - L.top, w });
          }
        }
      }
      return out;
    });

    // ---- context actions -------------------------------------------------------------
    // ---- actions: direct Sim calls in solo, lockstep commands in co-op ----------------------
    ctx.act = ls ? coopActions() : {
      place: (id, x, y) => sim.placeTower(id, x, y),
      upgrade: (uid, path) => sim.upgradeTower(uid, path),
      sell: (uid) => sim.sellTower(uid),
      target: (uid, mode) => sim.setTargetMode(uid, mode),
    };

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
      // connect the drawn card to her chibi: the card glows and a name tag with her drawn bust
      // pops over the spot where she landed
      bar.flash?.(t.def?.id);
      deployTag(t);
    };
    const deployTag = (t) => {
      try {
        const p = ctx.renderer?.worldToScreen?.(t.x, t.y, 1.25);
        if (!p?.visible || !t.def) return;
        const lr = layer.getBoundingClientRect();
        const tag = h('div.bt-deploy-tag', { 'aria-hidden': 'true', style: { left: `${Math.round(p.clientX - lr.left)}px`, top: `${Math.round(p.clientY - lr.top)}px` } },
          svgEl(portraitHTML(t.def, 'thumb', { eager: true }), 'bt-deploy-art'), h('b', t.def.name));
        layer.append(tag);
        setTimeout(() => tag.remove(), 1800);
      } catch (e) {
        console.warn('[battle] deploy tag failed', e);
      }
    };
    ctx.onUpgraded = (t, path) => {
      const tier = t.tiers[path];
      const name = t.def.paths[path]?.tiers[tier - 1]?.name;
      feed.push(`${t.def.name} · ${name}`, 'good', { ms: 1600, key: `upg-${t.uid}-${path}-${tier}` });
      navigator.vibrate?.(8);
    };
    ctx.cycleSpeed = () => {
      const speeds = BATTLE.speeds || [1, 2, 3];
      const next = speeds[(speeds.indexOf(ctx.speed) + 1) % speeds.length];
      if (ls) ls.queue('speed', [next]); // shared: both players switch at the same tick
      else ctx.speed = next;
    };
    ctx.setAutoStart = (v) => {
      store.profile.settings.autoStart = !!v;
      store.commit('settings');
      if (ls) {
        ls.queue('auto', [!!v]);
        return;
      }
      sim.options.autoStart = !!v;
      if (v && sim.state === 'between') ctx.startWave();
      wave.update();
    };
    ctx.startWave = () => {
      if (ctx.ended) return;
      if (ls) {
        // one 'wave' order in flight at a time (a double tap must not send two waves); once its
        // tick has run it is spent, so a wave that started and ended between two frames (a hidden
        // tab, a slow page) never leaves NEXT WAVE / GO BEYOND dead
        const inFlight = pendingWave && ls.tick <= pendingWave.t;
        if ((sim.state === 'prep' || sim.state === 'between') && !inFlight) pendingWave = ls.queue('wave', []);
        if (ctx.paused) ctx.closePause();
        return;
      }
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
      if (ls) {
        if (!sim.heroConfig) {
          feed.push(`Only ${session.player(0)?.name || 'the host'} commands the hero.`, 'warn', { key: 'ult-ally', ms: 1600 });
          return;
        }
        ls.queue('ult', []);
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
    // every way out of a battle goes through navigate(), which never leaves the battle's history
    // entry behind (src/ui/router.js): neither the back arrow nor the back gesture returns here
    // an endless run on a campaign map: its prep and its map are the endless ones (Tactical Challenge)
    // (a campaign map opened from Tactical Challenge with endless=1 is a freeplay run now: it still
    // belongs to Tactical Challenge)
    const endlessMap = !ls && !params.clanBoss && (params.endless === '1' || params.endless === 1 || params.endless === 'true') && stage.kind !== 'challenge';
    // a solo freeplay run's prep comes back with its tier picked
    const fpParam = req.freeplay ? { freeplay: req.freeplay } : {};
    ctx.quit = () => (ls ? leaveCoop() : params.clanBoss ? navigate('clan', { tab: 'boss' }) : navigate('stage', endlessMap ? { id: stage.id, endless: 1, ...fpParam } : { id: stage.id, ...fpParam }));
    ctx.goNext = (id) => navigate('stage', { id });
    ctx.goMap = () => {
      const r = mapRouteFor(stage, { endless: endlessMap });
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
        if (sim.state === 'wave' && !ctx.ended && !ctx.paused && !ls) ctx.openPause();
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
        fpBattle?.handle(ev);
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
            // freeplay: the big ribbon only on a boss's first appearance (then "… returns!")
            if ((def.tier === 'boss' || def.tier === 'miniboss') && !fpBattle?.onBossSpawn(def)) {
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
            // freeplay waves past the goal: their own banners (freeplay.js)
            if (fpBattle && ev.wave > sim.totalWaves) break;
            feed.announce(`WAVE ${ev.wave}`, Number.isFinite(sim.totalWaves) ? (ev.wave === sim.totalWaves ? (fpBattle ? 'The last stage wave — clear it to go beyond!' : 'Final wave!') : `of ${sim.totalWaves}`) : 'Endless', 'wave', 1300);
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
      // co-op freeplay past the goal: its own sheet (finishing right at the goal is a plain victory)
      const fpEnd = isFreeplayRun();
      if (fpEnd) fpBattle?.onEnd();
      if (fpEnd) feed.announce(won ? 'FREEPLAY COMPLETE' : 'FREEPLAY OVER', `${sim.wavesCleared}/${sim.totalWaves} · ${sim.stage.freeplay.name}`, won ? 'good' : 'free', RESULT_DELAY_MS - 200);
      else feed.announce(won ? 'STAGE CLEAR!' : 'DEFEAT', won ? `${sim.lives}/${sim.maxLives} lives left` : `Fell on wave ${sim.wave}`, won ? 'good' : 'bad', RESULT_DELAY_MS - 200);
      results.apply();
      if (params.clanBoss) submitClanBoss();
      later(() => (fpEnd ? results.showFreeplay() : won ? results.showVictory() : results.showDefeat()), RESULT_DELAY_MS);
    }

    // ---- solo: Keep going (a won normal run goes on as freeplay on `tier`) --------------------
    ctx.canKeepGoing = () => !!soloLedger && req.keepGoing && !sim.freeplay && sim.state === 'won' && sim.wavesCleared === sim.totalWaves;
    ctx.keepGoing = (tier) => {
      if (!ctx.canKeepGoing()) return false;
      const out = results.outcome || results.apply();
      if (out?.practice || out?.error) return false;
      if (!continueIntoFreeplay(sim, tier)) return false;
      rememberSoloTier(tier);
      // the win just paid is the freeplay bank: the run's end pays only the freeplay part
      soloLedger.bank = { ...out, clear: true, banked: { goal: sim.totalWaves, kills: { ...sim.kills }, encountered: [...sim.encountered] } };
      soloLedger.fx.add('goal');
      results.reset();
      ctx.ended = false;
      shell.classList.remove('bt-ended');
      startSoloFreeplay(ctx.modules);
      // the victory ended the music: start it again for the run
      try {
        ctx.audio?.destroy();
        ctx.audio = attachBattleAudio(ctx);
      } catch (e) {
        console.warn('[battle] audio restart failed', e);
      }
      lastT = performance.now();
      feed.announce('KEEP GOING', `Freeplay · ${sim.stage.freeplay.name} — ${sim.totalWaves + 1}/${sim.totalWaves} next`, 'free', 2200);
      wave.update();
      hud.update();
      return true;
    };

    // ---- main loop ----------------------------------------------------------------------
    let lastT = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const frameT = lastT;
      const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      // co-op never pauses: both clients advance the shared Lockstep (its own speed + horizons)
      const running = ls ? !ctx.ended : !ctx.paused && !ctx.ended;
      if (ls) {
        // real elapsed time (up to 0.25 s): a slow device keeps pace with its ally instead of
        // running the shared battle in slow motion (Lockstep caps its own catch-up per frame)
        if (!ctx.ended) ls.advance(Math.min(0.25, Math.max(0, (now - frameT) / 1000)));
        ctx.speed = ls.coop.speed;
        coopHud?.update();
      } else if (running) sim.update(dt * ctx.speed);
      let events = [];
      // while a full-screen sheet (results / pause) covers the map, skip the 3D frame (battery)
      if (results.open || (pause.open && !ls)) return;
      try {
        events = renderer.update(running ? dt : ctx.ended ? dt : 0);
      } catch (e) {
        console.error('[battle] render failed', e);
      }
      ctx.audio?.events(events); // [audio]
      handle(events);
      fpBattle?.update();
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
    ctx.audio = attachBattleAudio(ctx); cleanups.push(() => ctx.audio.destroy()); // [audio]
    window.__battle = { sim, renderer, ui: ctx, coop: ctx.coop || null };
  }

  // ---- co-op -----------------------------------------------------------------------------
  /** co-op: my last 'wave' order (its cmd; in flight until the lockstep has run its tick) */
  let pendingWave = null;
  let coopHud = null;
  /** co-op freeplay presentation + vote (src/ui/battle/freeplay.js), null otherwise */
  let fpBattle = null;
  /** a resync rebuilds this battle screen: its destroy() must not count as leaving the run */
  let remounting = false;
  /** A freeplay run past its goal (not a plain victory at exactly the goal). */
  function isFreeplayRun() {
    if (!sim.freeplay || sim.wavesCleared < sim.totalWaves) return false;
    return !(sim.state === 'won' && sim.wavesCleared === sim.totalWaves);
  }
  // ---- solo freeplay (src/systems/freeplayRewards.js) ---------------------------------------
  /** the battle's payout ledger: a solo campaign run that is (or may become) a freeplay run */
  const soloLedger = !ls && !params.clanBoss && !req.practice && (req.freeplay || req.keepGoing) ? soloFreeplayLedger(sim.seed) : null;
  if (soloLedger) {
    ctx.applyResult = (p, result, rng) => (result.freeplay && result.goalReached
      ? paySoloFreeplay(soloLedger, p, result, rng)
      : applyBattleResult(p, result, rng, { now: new Date() }));
    // Finish: solo ends the run at once (the pause menu and the clear card's pill)
    ctx.voteFinish = (v) => fpBattle?.vote(v);
    ctx.myFinishVote = () => false;
    ctx.freeplayAfterGoal = () => !!fpBattle?.afterGoal();
  }
  /** Solo: banners, the clear card and the bank for a freeplay battle (built or continued). */
  function startSoloFreeplay(modules) {
    if (fpBattle || !soloLedger || !sim.freeplay) return;
    // what a run cut off by a reload is paid at the next app start (the solo coin cap of this tier)
    soloLedger.payout.waveCoins = soloWaveCoins(sim.stageId, sim.difficulty, sim.stage.freeplay.id);
    fpBattle = createFreeplayBattle(ctx, {
      ledger: soloLedger,
      homeFamilies: stageFamilies(),
      bank: () => {
        try {
          const rng = createRng(hashString(`${sim.stage.id}:${sim.difficulty}:${sim.seed}:fp-bank:${Date.now()}`));
          const out = bankSoloClear(soloLedger, store.profile, sim.result(), rng);
          store.commit('battle-result');
          store.saveNow?.();
          return out;
        } catch (e) {
          console.error('[battle] solo freeplay bank failed', e);
          return null;
        }
      },
    });
    modules?.push(fpBattle);
    ctx.freeplay = fpBattle;
  }

  const pendingUpg = new Set();
  if (ls) {
    ls.note('mount');
    const mySlot = ls.mySlot;
    ctx.coop = {
      session,
      lockstep: ls,
      mySlot,
      ownerOf: (uid) => ls.coop.ownerOf(uid),
      isMine: (uid) => ls.coop.ownerOf(uid) === mySlot,
      ownerName: (uid) => session.player(ls.coop.ownerOf(uid))?.name || 'Your ally',
      colorOf: (uid) => COOP.colors[ls.coop.ownerOf(uid)] || '#fff',
      get hashes() {
        return ls.hashPairs();
      },
      get tick() {
        return ls.tick;
      },
    };
    ctx.applyResult = (p, result, rng) => {
      let out;
      if (result.freeplay && result.goalReached) {
        // freeplay: the clear was banked at the goal; this pays the run (once per battle, see
        // rewards.js payFreeplayEnd), and the sheet shows both parts
        const ledger = freeplayLedger(session, ls.start.seed);
        const end = payFreeplayEnd(ledger, p, result, rng);
        out = { ...end, bank: ledger.bank, freeplayRewards: end.rewards, rewards: normalizeList([...(ledger.bank?.rewards || []), ...end.rewards]) };
      } else out = applyCoopResult(p, result, rng);
      out.note = `Co-op with ${session.player(1 - mySlot)?.name || 'your ally'} — drops for both, medals stay solo.`;
      return out;
    };
    // freeplay: my Finish vote (an 'end' lockstep command; the run ends when everyone left agrees)
    ctx.voteFinish = (v) => fpBattle?.vote(v);
    ctx.myFinishVote = () => !!fpBattle?.myVote();
    ctx.freeplayAfterGoal = () => !!fpBattle?.afterGoal();
    ctx.leaveToRoom = () => backToRoom();
    // the room stays after the battle: both land back in its lobby with the same code. One tap
    // only: the screen changes a moment later (a second tap must not leave the room it kept)
    let acted = false;
    const once = (fn) => () => {
      if (acted) return;
      acted = true;
      fn();
    };
    ctx.extraActions = () => [
      { label: 'Back to the room', testid: 'coop-back', cta: true, icon: 'play', onClick: once(() => backToRoom()) },
      { label: 'Leave room', testid: 'coop-leave-room', icon: 'back', onClick: once(() => leaveCoop()) },
      { label: 'Home', testid: 'home', icon: 'home', onClick: once(() => { leaveCoop(false); navigate('lobby'); }) },
    ];
    // where my ally is once the battle is over: a line on the results sheet (the feed sits under it)
    const allyLine = h('p.bt-coop-ally', { 'data-testid': 'coop-ally-status' });
    allyLine.hidden = true;
    ctx.resultLine = () => allyLine;
    const allyName = () => session.player(1 - mySlot)?.name || 'Your ally';
    const offs = [
      session.on('applied', ({ cmd, res }) => onApplied(cmd, res)),
      session.on('peerGone', (reason) => {
        const ally = allyName();
        const text = reason === 'desync' ? 'Lost sync with your ally — you continue solo.'
          : reason === 'lobby' ? (ctx.ended ? `${ally} is back in the room.` : `${ally} went back to the room. Their girls stay and keep fighting.`)
            : reason === 'left' ? (ctx.ended ? `${ally} left the room.` : `${ally} left. Their girls stay and keep fighting; their income is yours now.`)
            : `Lost contact with ${ally}. Play on — their girls keep fighting, and they rejoin as soon as they are back.`;
        ctx.feed?.push(text, 'warn', { ms: 5200 });
      }),
      session.on('ally', (where) => {
        allyLine.textContent = where === 'room' ? `${allyName()} is back in the room — tap "Back to the room" to play again.` : `${allyName()} left the room.`;
        allyLine.hidden = false;
      }),
      session.on('peerBack', () => ctx.feed?.push(`${session.player(1 - mySlot)?.name || 'Your ally'} is back — defending together again.`, 'good', { ms: 3600 })),
      session.on('resync', () => {
        remounting = true;
        hooks.restart();
      }),
    ];
    cleanups.push(() => offs.forEach((off) => off()));
  }
  if (params.clanBoss) {
    ctx.extraActions = () => [
      { label: 'Back to the clan', testid: 'clan-back', cta: true, icon: 'play', onClick: () => navigate('clan', { tab: 'boss' }) },
      { label: 'Home', testid: 'home', icon: 'home', onClick: () => navigate('lobby') },
    ];
  }

  /**
   * Leaving a freeplay run after the goal pays its freeplay part with the waves cleared so far (the
   * clear is already banked); the ally plays on with my girls.
   */
  function payIfLeavingRun() {
    if (!ctx.ended && ctx.results && !ctx.results.outcome && (ls || soloLedger) && sim.freeplay && sim.wavesCleared >= sim.totalWaves) ctx.results.apply();
  }

  function leaveCoop(go = true) {
    payIfLeavingRun();
    session?.close();
    if (go) navigate('coop');
  }

  /** Results → the same room's lobby (same code, same ally); a dead session falls back to the co-op menu. */
  function backToRoom() {
    payIfLeavingRun();
    // (already back in the lobby: the back gesture got there first)
    if (session?.phase !== 'lobby' && !session?.backToLobby()) {
      leaveCoop();
      return;
    }
    navigate('coop', session.isHost ? { id: session.code, host: '1' } : { id: session.code });
  }

  function coopActions() {
    const mine = (uid) => {
      if (ls.coop.ownerOf(uid) === ls.mySlot) return true;
      ctx.feed?.push(`That is ${ctx.coop.ownerName(uid)}'s girl.`, 'warn', { key: 'not-mine', ms: 1400 });
      return false;
    };
    return {
      place(id, x, y) {
        if (ls.job) return null; // rebuilding (a resync / rejoin): orders wait until it is done
        const chk = sim.canPlace(id, x, y);
        if (!chk.ok) return null;
        ls.queue('place', [id, ...quantize(chk.x ?? x, chk.y ?? y)]);
        return 'queued';
      },
      upgrade(uid, path) {
        if (ls.job || !mine(uid) || sim.upgradeStatus(uid, path).locked) return false;
        const key = `${uid}:${path}`;
        if (pendingUpg.has(key)) return 'queued';
        pendingUpg.add(key);
        ls.queue('upg', [uid, path]);
        return 'queued';
      },
      sell(uid) {
        if (ls.job || !mine(uid)) return false;
        const v = sim.sellValue(uid);
        ls.queue('sell', [uid]);
        return v;
      },
      target(uid, mode) {
        if (ls.job || !mine(uid)) return false;
        ls.queue('tgt', [uid, mode]);
        return true;
      },
    };
  }

  /** A lockstep command just ran on this client (mine or my ally's). */
  function onApplied(cmd, res) {
    if (destroyed || !ctx.feed) return;
    fpBattle?.onApplied(cmd, res);
    const minePlayer = cmd.p === ls.mySlot;
    if (cmd.k === 'upg') pendingUpg.delete(`${cmd.a[0]}:${cmd.a[1]}`);
    if (cmd.k === 'place') {
      if (res.ok && minePlayer) ctx.onPlaced(res.tower);
      else if (res.ok) ctx.feed.push(`${session.player(cmd.p)?.name || 'Ally'} deployed ${res.tower.def.name}`, 'info', { key: `ally-${res.tower.uid}`, ms: 1400 });
      else if (minePlayer) ctx.feed.push(res.reason === 'occupied' ? 'Your ally got to that spot first.' : 'She could not deploy there any more.', 'warn', { key: 'place-late', ms: 1600 });
    } else if (cmd.k === 'upg' && res.ok && minePlayer) {
      const t = sim.getTower(cmd.a[0]);
      if (t) ctx.onUpgraded(t, cmd.a[1]);
    } else if (cmd.k === 'upg' && !res.ok && minePlayer && res.reason === 'onePerPath') {
      // two copies ordered the same final tier: the first order won on every client
      const t = sim.getTower(cmd.a[0]);
      if (t) ctx.feed.push(finalRaceText(t.def.name, t.def.paths[cmd.a[1]]?.name || ''), 'warn', { key: 'final-race', ms: 1800 });
    } else if (cmd.k === 'speed' && res.ok && !minePlayer) {
      ctx.feed.push(`${session.player(cmd.p)?.name || 'Ally'} set the speed to ${cmd.a[0]}×`, 'info', { key: 'ally-speed', ms: 1400 });
    }
  }

  /**
   * Clan boss: everything this battle dealt counts against the clan's shared HP pool. The
   * attempt id comes from start_boss_attempt (the clan screen starts it before opening this
   * battle); the server caps what one battle of this length can count.
   */
  function submitClanBoss() {
    const dmg = Math.round(Object.values(sim.stats.damageByTower || {}).reduce((a, b) => a + b, 0));
    ctx.clanBossDamage = dmg;
    import('../../online/backend.js').then(({ getBackend }) => {
      const backend = getBackend();
      const before = backend.lastBoss?.myDamage || 0;
      return backend.submitBossDamage(params.clanBoss, dmg).then((state) => ({ state, counted: Math.max(0, (state.myDamage || 0) - before) }));
    })
      .then(({ state, counted }) => {
        ctx.clanBossResult = state;
        const text = counted >= dmg || !dmg ? `${fmtCoins(dmg)} damage counted` : `${fmtCoins(counted)} of ${fmtCoins(dmg)} damage counted`;
        ctx.feed?.push(`Clan boss: ${text} · ${fmtCoins(state.hp)} HP left`, 'good', { ms: 4200 });
      })
      .catch((e) => {
        ctx.clanBossResult = { error: e };
        ctx.feed?.push(`Clan boss damage was not saved: ${e.message || e}`, 'bad', { ms: 4200 });
      });
  }

  return {
    ready,
    destroy() {
      if (destroyed) return;
      // a finished battle always pays out, even if the player leaves before the modal (and so does
      // a freeplay run left after its goal; a resync rebuild is not leaving)
      if (ctx.ended && ctx.results && !ctx.results.outcome) ctx.results.apply();
      else if (!remounting) payIfLeavingRun();
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
