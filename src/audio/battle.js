// Battle audio (docs/AUDIO.md §1.3, §3.7, §3.8). Light at import (no WebAudio, Node-safe).
//
//   controller.js:  ctx.audio = attachBattleAudio(ctx); cleanups.push(() => ctx.audio.destroy());
//                   ctx.audio?.events(events);       // the array renderer.update() already returns
//
// The deterministic sim is never touched: SFX come from the drained event array, music from a pure
// state machine (battleMusicStep) fed with the same events plus the wrapped pause/speed actions.
import { getAudio } from './cue.js';
import { battleTrack, bossTrackFor, battlePreloads } from './routes.js';
import { capFrame } from './limiter.js';

/** Time of the last hero level-up chime (throttle). */
let lastHeroLevel = 0;

// ------------------------------------------------------------------------------------- SFX mapping
const FIRE = {
  arrow: 'fire.arrow', needle: 'fire.arrow', bullet: 'fire.bullet', shell: 'fire.shell', fireball: 'fire.shell',
  shuriken: 'fire.shuriken', orb: 'fire.magic', flask: 'fire.magic', spark: 'fire.holy', bolt: 'fire.zap',
  slash: 'atk.slash', pulse: 'atk.pulse', beam: 'atk.beam', chain: 'atk.chain', build: 'turret.build',
};
const HIT = { pierce: 'hit.pierce', slash: 'hit.slash', mystic: 'hit.mystic', holy: 'hit.holy' };
const STATUS = {
  freeze: ['st.freeze', 1], burn: ['st.burn', 1], poison: ['st.poison', 1], shock: ['st.shock', 1], stun: ['st.shock', 0.9],
  slow: ['st.debuff', 0.9], reveal: ['st.debuff', 1.2], silence: ['st.debuff', 0.8], mark: ['st.debuff', 1.1],
  vulnerable: ['st.debuff', 1.15], shred: ['st.debuff', 1.0], soak: ['st.debuff', 0.85],
};

/**
 * Pure: one frame of sim events → SFX to play (after per-frame caps).
 * @param {object[]} events
 * @param {{ mapWidth?: number, towerX?: (uid) => number|undefined, enemyDef?: (id) => object|undefined,
 *           isHero?: (towerUid) => boolean, turret?: boolean }} info
 * @returns {{ id: string, pan?: number, rate?: number, gain?: number }[]}
 */
export function battleSfx(events, info = {}) {
  const w = info.mapWidth || 20;
  const pan = (x) => (Number.isFinite(x) ? Math.max(-1, Math.min(1, (x / w) * 2 - 1)) * 0.5 : 0);
  const items = [];
  const push = (it) => items.push(it);
  for (const ev of events || []) {
    switch (ev.type) {
      case 'attack': {
        const id = FIRE[ev.kind];
        if (!id) break;
        const it = { id, cat: 'fire', key: id, score: 1, pan: pan(info.towerX?.(ev.towerUid)) };
        if (ev.turretUid != null && ev.kind === 'bullet') it.gain = -4;
        if (ev.kind === 'slash' && ev.ramp) it.rate = 1 + 0.03 * Math.min(10, ev.ramp);
        push(it);
        break;
      }
      case 'hit': {
        if (ev.crit) push({ id: 'hit.crit', cat: 'hit', key: 'crit', score: 3, pan: pan(ev.x) });
        if (ev.effective != null && ev.effective < 1) {
          push({ id: 'hit.resist', cat: 'hit', key: 'resist', score: 0.5, pan: pan(ev.x) });
          break;
        }
        const id = HIT[ev.attackType];
        if (id) push({ id, cat: 'hit', key: id, score: (ev.effective > 1 ? 2 : 1) + Math.min(0.9, (ev.amount || 0) / 2000), pan: pan(ev.x) });
        break;
      }
      case 'explode':
        push({ id: ev.volatile ? 'boom.volatile' : ev.radius >= 1.4 ? 'boom.big' : 'boom.small', cat: 'explode', key: 'boom', score: ev.radius || 1, pan: pan(ev.x) });
        break;
      case 'status': {
        const s = STATUS[ev.status];
        if (s) push({ id: s[0], cat: 'status', key: ev.status, rate: s[1] });
        break;
      }
      case 'barrierBreak':
        push({ id: 'break.barrier' });
        break;
      case 'shellBreak':
        push({ id: 'break.crystal' });
        break;
      case 'death': {
        const def = info.enemyDef?.(ev.id);
        const tier = def?.tier;
        if (tier === 'boss' || tier === 'miniboss') push({ id: 'en.bossDeath', pan: pan(ev.x) });
        else if (tier === 'elite' || (def?.size || 0) >= 1.4) push({ id: 'en.deathBig', cat: 'death', key: 'big', score: 2, pan: pan(ev.x) });
        else push({ id: 'en.death', cat: 'death', key: 'small', score: 1, pan: pan(ev.x) });
        break;
      }
      case 'split':
        push({ id: 'en.split', cat: 'status', key: 'split' });
        break;
      case 'blink':
        push({ id: 'en.blink', pan: pan(ev.x) });
        break;
      case 'teleportWarn':
        push({ id: 'en.blinkWarn', pan: pan(ev.x) });
        break;
      case 'phase':
        if (ev.on) push({ id: 'en.phase', cat: 'status', key: 'phase' });
        break;
      case 'sabotage':
        push({ id: 'en.sabotage' });
        break;
      case 'leak': {
        const tier = info.enemyDef?.(ev.id)?.tier;
        push({ id: tier && tier !== 'normal' ? 'bt.leakBig' : 'bt.leak' });
        break;
      }
      case 'place':
        push({ id: info.isHero?.(ev.towerUid) ? 'bt.placeHero' : 'bt.place', pan: pan(ev.x) });
        break;
      case 'upgrade':
        push({ id: ev.tier >= 5 ? 'bt.upgradeMax' : ev.tier >= 3 ? 'bt.upgradeBig' : 'bt.upgrade' });
        break;
      case 'sell':
        push({ id: 'bt.sell' });
        break;
      case 'trapPlaced':
        push({ id: 'trap.set', pan: pan(ev.x) });
        break;
      case 'trapTriggered':
        push({ id: 'trap.trigger', pan: pan(ev.x) });
        break;
      case 'heroLevel': {
        // 24 levels and bought levels: at most one chime per 400 ms
        const now = Date.now();
        if (now - (lastHeroLevel || 0) >= 400) {
          lastHeroLevel = now;
          push({ id: 'hero.level' });
        }
        break;
      }
      case 'heroBuy':
        push({ id: 'bt.upgrade' });
        break;
      case 'heroMove':
        push({ id: 'bt.place', pan: pan(ev.x) });
        break;
      case 'ult':
        push({ id: 'hero.ult' });
        break;
      case 'waveEnd':
        push({ id: 'bt.waveClear' });
        break;
      case 'bossPhase':
        push({ id: 'en.bossPhase' });
        break;
      case 'cash':
        if (ev.reason === 'income') push({ id: 'eco.coins', cat: 'income', key: 'income', gain: -10 });
        break;
      default:
        break;
    }
  }
  return capFrame(items, { fire: 3, hit: 2, death: 2, explode: 2, income: 1 }).map(({ cat, key, score, ...rest }) => rest);
}

// ------------------------------------------------------------------------------------- music state machine
/** @returns battle music state */
export function initialBattleMusic({ theme = 'sakura' } = {}) {
  return { phase: 'build', intensity: 0, theme, track: battleTrack(theme), minis: [], boss: null, ended: false, paused: false };
}

/**
 * Pure: (state, event) → { state, actions }. Events are sim events plus
 * { type: 'mount' | 'pause' | 'resume' }. Actions:
 *   { do: 'play', track, stems, transition }        { do: 'stems', levels, quantize, fadeBars, delay?, tag? }
 *   { do: 'stinger', id, duck }                      { do: 'boss', track }
 *   { do: 'jingle', id, then }                       { do: 'duck', tag, db, lpf? } / { do: 'unduck', tag }
 *   { do: 'cancel', tag }
 * @param {object} s state
 * @param {object} ev
 * Co-op freeplay: 'goal' (the stage's last wave cleared, the battle goes on) plays the victory
 * sting over the music without ending it; info.crossing (the first wave past the goal) plays the
 * final-wave sting as a riser.
 * @param {{ tierOf?: (id) => string|undefined, final?: boolean, crossing?: boolean }} [info]
 */
export function battleMusicStep(s, ev, info = {}) {
  const st = { ...s, minis: [...s.minis] };
  const a = [];
  const toIntensity = (v, quantize, fadeBars, extra = {}) => {
    a.push({ do: 'stems', levels: { intensity: v }, quantize, fadeBars, ...extra });
    if (!extra.delay) st.intensity = v;
  };
  if (st.ended && ev.type !== 'pause' && ev.type !== 'resume') return { state: st, actions: a };
  switch (ev.type) {
    case 'mount':
      a.push({ do: 'play', track: st.track, stems: { base: 1, intensity: 0 }, transition: 'bar' });
      break;
    case 'waveStart':
      st.phase = 'wave';
      a.push({ do: 'cancel', tag: 'calm' });
      // no wave-start sting (owner, Oct 13: the next wave starts silently; only the music lifts)
      if (!st.boss && st.intensity !== 1) toIntensity(1, 'beat', 1);
      // …except the step past a freeplay goal ("16/15"): one riser
      if (info.crossing) a.push({ do: 'stinger', id: 'final_wave', duck: -6 });
      break;
    case 'goal':
      // freeplay: the clear without the end (no st.ended — only 'won' / 'lost' end the music)
      a.push({ do: 'stinger', id: 'victory', duck: -10 });
      break;
    case 'waveEnd':
      st.phase = 'between';
      if (!st.boss && !st.minis.length) {
        a.push({ do: 'stems', levels: { intensity: 0 }, quantize: 'bar', fadeBars: 2, delay: 2, tag: 'calm' });
        st.intensity = 0;
      }
      break;
    case 'spawn': {
      const tier = ev.tier || info.tierOf?.(ev.id);
      if (tier === 'miniboss') {
        st.minis.push(ev.uid);
        a.push({ do: 'cancel', tag: 'calm' });
        a.push({ do: 'stinger', id: 'miniboss', duck: -10 });
        if (!st.boss && st.intensity !== 1) toIntensity(1, 'beat', 1);
      } else if (tier === 'boss' && !st.boss) {
        st.boss = { uid: ev.uid, track: bossTrackFor(ev.id) };
        st.intensity = 0;
        a.push({ do: 'cancel', tag: 'calm' });
        a.push({ do: 'boss', track: st.boss.track });
      }
      break;
    }
    // a boss or miniboss gone off the board, defeated or leaked (a Sandbox run with unlimited lives
    // survives a boss leak), stops holding the music
    case 'death':
    case 'leak':
      if (st.minis.includes(ev.uid)) {
        st.minis = st.minis.filter((u) => u !== ev.uid);
        if (!st.minis.length && st.phase !== 'wave' && !st.boss) toIntensity(0, 'bar', 2);
      } else if (st.boss && st.boss.uid === ev.uid) {
        st.boss = null;
        st.intensity = st.phase === 'wave' ? 1 : 0;
        a.push({ do: 'play', track: st.track, stems: { base: 1, intensity: st.intensity }, transition: 'bar' });
      }
      break;
    case 'bossPhase':
      if (st.boss) {
        st.intensity = 1;
        a.push({ do: 'stems', levels: { intensity: 1 }, quantize: 'bar', fadeBars: 1 });
      }
      break;
    case 'won':
      st.ended = true;
      a.push({ do: 'cancel', tag: 'calm' }, { do: 'jingle', id: 'victory', then: 'results_win' });
      break;
    case 'lost':
      st.ended = true;
      a.push({ do: 'cancel', tag: 'calm' }, { do: 'jingle', id: 'defeat', then: 'results_lose' });
      break;
    case 'pause':
      if (!st.paused) {
        st.paused = true;
        a.push({ do: 'duck', tag: 'pause', db: -8, lpf: 1200 });
      }
      break;
    case 'resume':
      if (st.paused) {
        st.paused = false;
        a.push({ do: 'unduck', tag: 'pause' });
      }
      break;
    default:
      break;
  }
  return { state: st, actions: a };
}

const MUSIC_EVENTS = new Set(['waveStart', 'waveEnd', 'spawn', 'death', 'leak', 'bossPhase', 'won', 'lost', 'goal']);

// ------------------------------------------------------------------------------------- adapter
/**
 * Hooks a mounted battle (controller ctx) up to the audio engine. Works even when audio boots later:
 * every call looks the engine up again. Returns { events(evts), destroy(), state() }.
 */
export function attachBattleAudio(ctx) {
  const sim = ctx.sim;
  const theme = sim?.map?.theme || 'sakura';
  let ms = initialBattleMusic({ theme });
  const timers = new Map();
  const restore = [];
  let lowLivesPlayed = false;
  let lastIncome = 0;
  let destroyed = false;
  const A = () => (destroyed ? null : getAudio());
  // the sim resolves enemy ids through its data source (sim.data.enemy(id)), alive or not
  const enemyDef = (id) => {
    try {
      return sim?.data?.enemy?.(id) || null;
    } catch {
      return null;
    }
  };

  function run(actions) {
    const audio = A();
    for (const act of actions) {
      if (act.do === 'cancel') {
        clearTimeout(timers.get(act.tag));
        timers.delete(act.tag);
        continue;
      }
      if (act.delay) {
        clearTimeout(timers.get(act.tag));
        timers.set(act.tag, setTimeout(() => {
          timers.delete(act.tag);
          run([{ ...act, delay: 0 }]);
        }, act.delay * 1000));
        continue;
      }
      if (!audio) continue;
      try {
        audio.battleAction(act);
      } catch (e) {
        console.warn('[audio] battle action failed', act, e);
      }
    }
  }
  function step(ev, info = {}) {
    const r = battleMusicStep(ms, ev, { tierOf: (id) => enemyDef(id)?.tier, ...info });
    ms = r.state;
    run(r.actions);
  }

  // wrap controller actions (no edits to other battle files)
  const wrap = (obj, name, fn) => {
    if (!obj || typeof obj[name] !== 'function') return;
    const orig = obj[name];
    obj[name] = function wrapped(...args) {
      const res = orig.apply(this, args);
      try {
        fn(...args);
      } catch (e) {
        console.warn(`[audio] ${name} hook failed`, e);
      }
      return res;
    };
    restore.push(() => {
      obj[name] = orig;
    });
  };
  wrap(ctx, 'openPause', () => {
    if (ctx.paused) step({ type: 'pause' });
    A()?.setBattlePaused?.(true);
  });
  wrap(ctx, 'closePause', () => {
    step({ type: 'resume' });
    A()?.setBattlePaused?.(false);
  });
  wrap(ctx, 'cycleSpeed', () => {
    A()?.setBattleSpeed?.(ctx.speed);
    A()?.sfx('ui.tick', { rate: 0.9 + 0.1 * ctx.speed });
  });
  wrap(ctx, 'setSpeed', () => A()?.setBattleSpeed?.(ctx.speed));
  wrap(ctx, 'bump', () => A()?.sfx('bt.deny'));
  wrap(ctx, 'select', (uid) => {
    if (uid != null) A()?.sfx('ui.select');
  });
  wrap(ctx.feed, 'push', (content, kind, o = {}) => {
    if (kind === 'new') A()?.sfx('en.new');
    else if (typeof o?.key === 'string' && (o.key.startsWith('upg-cash') || o.key.startsWith('poor-'))) A()?.sfx('bt.deny');
  });

  A()?.setBattleSpeed?.(ctx.speed || 1);
  A()?.setBattlePaused?.(false);
  step({ type: 'mount' });

  // Preloads (docs/AUDIO.md §3.4): this battle's stings and jingles now, a boss track two waves ahead.
  // Audio may unlock after the mount, so the poll retries until the engine can take them.
  let mountPreloaded = false;
  let lookedAhead = -1;
  const waveInfo = (n) => {
    try {
      return sim?.waveInfo?.(n) || [];
    } catch {
      return [];
    }
  };
  function preloads() {
    const audio = A();
    if (!audio?.preloadTracks || !sim) return;
    if (!mountPreloaded) mountPreloaded = audio.preloadTracks(battlePreloads(theme)) > 0;
    if (!mountPreloaded || sim.wave === lookedAhead) return;
    lookedAhead = sim.wave;
    const ahead = [];
    for (let n = sim.wave + 1; n <= sim.wave + 2; n++) {
      for (const e of waveInfo(n)) {
        if (e.tier === 'boss') ahead.push({ track: bossTrackFor(e.enemyId), decode: true }, { track: 'boss_warning', decode: true });
        else if (e.tier === 'miniboss') ahead.push({ track: 'miniboss', decode: true });
      }
    }
    if (ahead.length) audio.preloadTracks(ahead);
  }
  preloads();

  // 4 Hz poll: preloads, low lives warning
  const poll = setInterval(() => {
    if (!sim || ms.ended) return;
    preloads();
    if (!lowLivesPlayed && sim.maxLives > 0 && sim.lives > 0 && sim.lives <= sim.maxLives * 0.25) {
      lowLivesPlayed = true;
      A()?.sfx('bt.lowLives');
    }
  }, 250);

  return {
    events(evts) {
      if (destroyed || !evts || !evts.length) return;
      for (const ev of evts) {
        if (!MUSIC_EVENTS.has(ev.type)) continue;
        // a leak that ended the battle: the defeat jingle follows, the music must not switch first
        if (ev.type === 'leak' && sim?.state === 'lost') continue;
        const info = ev.type === 'waveStart'
          ? { final: Number.isFinite(sim?.totalWaves) && ev.wave === sim.totalWaves && !sim?.freeplay, crossing: !!sim?.freeplay && ev.wave === sim.totalWaves + 1 }
          : {};
        step(ev, info);
      }
      const audio = A();
      if (!audio) return;
      const list = battleSfx(evts, {
        mapWidth: sim?.map?.width,
        towerX: (uid) => sim?.getTower?.(uid)?.x,
        enemyDef,
        isHero: (uid) => !!sim?.getTower?.(uid)?.isHero,
      });
      const t = performance.now();
      for (const s of list) {
        if (s.id === 'eco.coins') {
          if (t - lastIncome < 300) continue;
          lastIncome = t;
        }
        audio.sfx(s.id, s);
      }
    },
    state: () => ms,
    destroy() {
      if (destroyed) return;
      const audio = A();
      audio?.setBattlePaused?.(false);
      audio?.setBattleSpeed?.(1);
      audio?.music?.unduck?.('pause');
      destroyed = true;
      clearInterval(poll);
      for (const id of timers.values()) clearTimeout(id);
      timers.clear();
      for (const r of restore.splice(0)) r();
    },
  };
}
