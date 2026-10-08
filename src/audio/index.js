// Audio boot (docs/AUDIO.md §3): main.js calls initAudio({ store }) once, lazily, after the first
// route is up. Everything else hooks in without touching other areas' files:
//   screenchange / hashchange → music per route     store 'change' → volumes + economy sounds
//   document clicks / modals / toasts → UI sounds   cue() → named cues (gacha, battle deny, settings)
// Debug + e2e: window.__sakura.audio.state()
import { createEngine, volumesFrom } from './engine.js';
import { createLoader } from './loader.js';
import { MusicDirector } from './music.js';
import { SfxPlayer } from './sfx.js';
import { musicForRoute, preloadFor } from './routes.js';
import { installEconomy } from './economy.js';
import { installDomSfx } from './domSfx.js';
import { setCueHandler } from './cue.js';
import { handleCue } from './cues.js';
import { resolveTrack } from './loopMath.js';

const UNLOCK_SETTLE_MS = 350;     // TAP TO START also navigates (260 ms): start the music for where we land

function routeName() {
  const h = String(location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/')[0];
  return h || 'lobby';
}

export function initAudio({ store, base } = {}) {
  if (typeof window === 'undefined') return null;
  window.__sakura ||= {};
  if (window.__sakura.audio) return window.__sakura.audio;
  const engine = createEngine({ base: base || `${import.meta.env?.BASE_URL ?? './'}audio/` });
  const loader = createLoader(engine);
  const music = new MusicDirector(engine, loader);
  const sfx = new SfxPlayer(engine, loader);
  let manifest = null;
  let route = routeName();
  let started = false;

  const api = {
    engine,
    loader,
    music,
    sfxPlayer: sfx,
    get ctx() {
      return engine.ctx;
    },
    sfx: (id, o = {}) => sfx.play(id, o),
    play: (id, o) => music.play(id, o),
    applySettings,
    battleAction,
    setBattleSpeed: (s) => {
      engine.setBattleSpeed(s);
      sfx.setSpeed(s);
    },
    setBattlePaused: (p) => engine.setBattlePaused(p),
    setVolumes: (v) => engine.setVolumes(v),
    preloadTracks,
    level: (which) => engine.level(which),
    state() {
      return {
        available: engine.available,
        ctx: engine.ctx?.state || 'none',
        rate: engine.ctx?.sampleRate || null,
        unlocked: engine.unlocked,
        format: engine.format?.id || null,
        delta: engine.delta,
        probe: engine.state.probe,
        error: engine.state.error,
        route,
        volumes: engine.volumes,
        ...music.state(),
        sfx: sfx.stats(),
        ...loader.stats(),
      };
    },
    log: () => music.log.slice(),
  };
  window.__sakura.audio = api;

  function applySettings() {
    const v = volumesFrom(store?.profile?.settings);
    engine.setVolumes(v);
    music.setEnabled(v.musicOn);
    sfx.setEnabled(v.sfxOn);
    if (v.sfxOn && engine.unlocked && engine.format) sfx.load();
  }

  function onRoute(name) {
    route = name;
    if (!manifest) return;
    const r = musicForRoute(name);
    if (r.battle) return;                              // attachBattleAudio starts the battle track
    if (r.keep) {
      if (!music.cur && !music.pending && r.fallback && !music.wanted) music.play(r.fallback.track, { stems: r.fallback.stems });
      return;
    }
    music.play(r.track, { stems: r.stems, transition: 'bar' });
    if (engine.unlocked && engine.format) {
      for (const p of preloadFor(name)) {
        const id = resolveTrack(p.track, manifest);
        if (id) loader.preload(manifest, id, { decode: p.decode });
      }
    }
  }

  /** Fetch (and decode where asked) design track ids ahead of time; → how many resolved (0 = not ready yet). */
  function preloadTracks(list) {
    if (!manifest || !engine.unlocked || !engine.format || !music.enabled) return 0;
    let n = 0;
    for (const p of list || []) {
      const id = resolveTrack(p.track, manifest);
      if (!id) continue;
      loader.preload(manifest, id, { decode: !!p.decode });
      n++;
    }
    return n;
  }

  function battleAction(act) {
    switch (act.do) {
      case 'play':
        return music.play(act.track, { stems: act.stems, transition: act.transition });
      case 'stems':
        return music.setStems(act.levels, { quantize: act.quantize, fadeBars: act.fadeBars });
      case 'stinger':
        return music.stinger(act.id, { duck: act.duck, quantize: act.quantize || 'accent', maxLate: act.maxLate ?? 0.75 });
      case 'boss':
        return music.bossTakeover(act.track);
      case 'jingle':
        engine.setBattleDuck(-6);
        setTimeout(() => engine.setBattleDuck(0), 6000);
        return music.jingle(act.id, { stopMusic: true, then: act.then });
      case 'duck':
        return music.duck(act.tag, act.db, { lpf: act.lpf });
      case 'unduck':
        return music.unduck(act.tag);
      default:
        return undefined;
    }
  }

  async function start() {
    if (started || !engine.unlocked) return;
    started = true;
    try {
      if (!manifest) manifest = await loadManifest();
      const fmt = await engine.probe(manifest.formats || []);
      if (!fmt) {
        console.warn(`[audio] ${engine.state.error}`);
        return;
      }
      applySettings();
      setTimeout(() => {
        // re-read the route: the unlocking tap may have navigated (title → lobby)
        if (routeName() !== route) onRoute(routeName());
        else if (music.wanted) music.playWanted('now');
        else onRoute(route);
      }, engine.state.gestureUnlock ? UNLOCK_SETTLE_MS : 0);
    } catch (e) {
      console.warn('[audio] start failed', e);
    }
  }

  async function loadManifest() {
    const res = await fetch(`${engine.base}music/manifest.json`);
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const m = await res.json();
    music.setManifest(m);
    return m;
  }

  // ---- wiring -------------------------------------------------------------------------------
  loadManifest()
    .then((m) => {
      manifest = m;
      onRoute(route);                                   // records the wanted track until unlock
    })
    .catch((e) => console.warn('[audio] no music manifest', e));
  window.addEventListener('screenchange', (e) => onRoute(e.detail?.name || routeName()));
  window.addEventListener('hashchange', () => {
    // start fetching the next screen's track before its module has even loaded
    if (!manifest || !engine.unlocked || !engine.format) return;
    const r = musicForRoute(routeName());
    const id = r.track && resolveTrack(r.track, manifest);
    if (id) loader.preload(manifest, id, { decode: true });
  });
  store?.on?.('change', (e) => {
    if (e?.reason === 'settings' || e?.reason === 'replace') applySettings();
  });
  installEconomy(store, (a) => {
    if (a.music) music.jingle(a.music, { stopMusic: false, duck: -10 });
    else api.sfx(a.sfx, { rate: a.rate });
  });
  installDomSfx({
    play: (id, o) => api.sfx(id, o),
    duck: (tag, db) => music.duck(tag, db),
    unduck: (tag) => music.unduck(tag),
  });
  setCueHandler((name, data) => handleCue(api, name, data));
  engine.onUnlock(() => start());
  engine.boot();
  applySettings();
  return api;
}
