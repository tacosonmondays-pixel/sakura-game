// Sandbox panel (battle-ui): spawn controls for a Sandbox run — any enemy (minibosses and bosses
// too), a count, the path it starts on, its traits / armour switched on or off — plus coins,
// unlimited lives, send next wave, clear enemies, speed, and a damage-per-girl readout.
// Solo only: it drives the Sim directly (a Sandbox battle is never a lockstep battle) through
// createSandboxDriver, which overrides a few Sim methods on this one instance and puts them back on
// destroy; src/sim itself is untouched. The pure helpers below are exported for tests.
import { h, icon, enemyToken, traitBadge } from './util.js';
import { fmtNum } from '../format.js';
import { ENEMIES, FAMILIES, ENEMY_MAP } from '../../data/enemies.js';
import { TRAITS } from '../../data/types.js';
import { initTraitState } from '../../sim/enemies.js';
import { SANDBOX_COIN_STEP, SANDBOX_COIN_CAP } from '../../systems/sandbox.js';

/** Count presets of the spawn stepper. */
export const SPAWN_COUNTS = [1, 5, 10, 20, 50];
/** Sim seconds between two enemies of one spawn group. */
export const SPAWN_SPACING = 0.35;
/** Speed choices of the panel (the HUD speed button keeps cycling 1-3×). */
export const SANDBOX_SPEEDS = [0.5, 1, 2, 3, 5];
/** Armour a plain enemy gains with the armour switch. */
export const EXTRA_ARMOR = 8;
/** Traits an enemy can be given that it does not have (with their standard settings). */
export const EXTRA_TRAITS = {
  veiled: true,
  airborne: true,
  regen: { pct: 0.04, delay: 2 },
  hasty: { mul: 2, every: 4, duration: 1.2 },
};

/** Every enemy grouped by family (bestiary order), bosses included. */
export function enemyGroups() {
  return Object.values(FAMILIES).map((f) => ({ family: f, enemies: ENEMIES.filter((e) => e.family === f.id) })).filter((g) => g.enemies.length);
}

/**
 * The switches an enemy offers: its own traits (on by default) and the extra traits it lacks (off),
 * plus armour (its own plate on, or +EXTRA_ARMOR off).
 * @returns {{ traits: { key: string, own: boolean }[], armor: { own: number, label: string } }}
 */
export function spawnSwitches(enemyId) {
  const def = ENEMY_MAP[enemyId];
  if (!def) return { traits: [], armor: { own: 0, label: `Armor +${EXTRA_ARMOR}` } };
  const own = Object.keys(def.traits || {}).filter((k) => def.traits[k] && TRAITS[k]);
  const extra = Object.keys(EXTRA_TRAITS).filter((k) => !own.includes(k));
  return {
    traits: [...own.map((key) => ({ key, own: true })), ...extra.map((key) => ({ key, own: false }))],
    armor: { own: def.armor || 0, label: def.armor > 0 ? `Armor ${def.armor}` : `Armor +${EXTRA_ARMOR}` },
  };
}

/** Default switch state for an enemy: its own traits / armour on, the extras off. */
export function defaultMods(enemyId) {
  const sw = spawnSwitches(enemyId);
  return { traits: Object.fromEntries(sw.traits.map((t) => [t.key, t.own])), armor: sw.armor.own > 0 };
}

/** Applies trait / armour switches to a freshly spawned enemy. */
export function applyMods(e, mods) {
  if (!e || !mods) return e;
  const def = e.def || ENEMY_MAP[e.id];
  for (const [key, on] of Object.entries(mods.traits || {})) {
    if (on && !e.traits[key] && EXTRA_TRAITS[key]) e.traits[key] = EXTRA_TRAITS[key];
    else if (!on && e.traits[key]) delete e.traits[key];
  }
  if (mods.armor != null) {
    const own = def?.armor || 0;
    e.armor = mods.armor ? (own > 0 ? own : EXTRA_ARMOR) : 0;
  }
  initTraitState(e);
  return e;
}

/**
 * Spawns one enemy at the start of a path with the given switches (and HP scale, when the entry
 * belongs to a wave sent early). @returns {object|null}
 */
export function spawnOne(sim, enemyId, { pathIndex = 0, mods = null, hpMul = undefined } = {}) {
  ensureWave(sim);
  const e = sim.spawnEnemy(enemyId, hpMul != null ? { pathIndex, dist: 0, hpMul } : { pathIndex, dist: 0 });
  if (e && mods) applyMods(e, mods);
  return e;
}

/**
 * Enemies only act on the board during a wave (girls' traps and drones too), so spawning in prep
 * or between waves opens an empty wave around them; it ends like any wave once they are gone.
 * @returns {boolean} true when it opened one
 */
export function ensureWave(sim) {
  if (sim.state !== 'prep' && sim.state !== 'between') return false;
  sim.state = 'wave';
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  sim._waveTime = 0;
  sim._autoTimer = -1;
  return true;
}

/**
 * Removes every enemy on the board (no coins, no kills, no broods) and drops the rest of the wave.
 * Each one still sends a 'death' event (bounty 0), so the renderer plays its poof and the battle
 * music lets go of a boss or miniboss.
 */
export function clearEnemies(sim) {
  const n = sim.enemies.length;
  for (const e of sim.enemies) {
    if (e.dead) continue;
    e.dead = true;
    sim._emit('death', { uid: e.uid, id: e.id, x: e.x, y: e.y, bounty: 0 });
  }
  sim.enemies.length = 0;
  if (sim.state === 'wave') sim._spawnIndex = sim._spawnQueue.length;
  return n;
}

/** Damage dealt per girl (summed over every copy of her on the board, sold ones included). */
export function damageByGirl(sim) {
  const per = new Map();
  for (const [uid, dmg] of Object.entries(sim.stats.damageByTower || {})) {
    const unitId = sim.stats.towerUnits?.[uid];
    if (!unitId) continue;
    per.set(unitId, (per.get(unitId) || 0) + dmg);
  }
  const total = [...per.values()].reduce((a, b) => a + b, 0);
  return [...per.entries()].map(([unitId, damage]) => ({ unitId, damage, share: total > 0 ? damage / total : 0 })).sort((a, b) => b.damage - a.damage);
}

/** Replaces a Sim method on this instance only. @returns {() => void} undo (restores the class method) */
function override(sim, name, make) {
  const own = Object.prototype.hasOwnProperty.call(sim, name);
  const base = sim[name];
  sim[name] = make(base);
  return () => {
    if (own) sim[name] = base;
    else delete sim[name];
  };
}

/**
 * Unlimited lives: a leak still counts (and shows) but takes no lives while `isOn()` is true.
 * @returns {() => void} undo
 */
export function guardLives(sim, isOn) {
  return override(sim, '_leak', (leak) => function sandboxLeak(e) {
    if (!isOn() || e.dead) return leak.call(this, e);
    const amount = e.leak;
    e.leak = 0;
    try {
      return leak.call(this, e);
    } finally {
      e.leak = amount;
    }
  });
}

/** Adds the "+ coins" step (capped). @returns {number} coins now */
export function addCoins(sim, amount = SANDBOX_COIN_STEP) {
  sim.cash = Math.min(SANDBOX_COIN_CAP, Math.floor(sim.cash) + amount);
  return sim.cash;
}

/**
 * Sandbox control of one solo Sim, from outside src/sim (the lockstep sim stays untouched). Spawn
 * groups and early waves wait in a queue that is emptied at the start of each fixed sim step, so a
 * group keeps its exact spacing in game time (it pauses and speeds up with the battle) and stays
 * deterministic. While the queue holds anything, the wave stays open: a group is one wave, however
 * fast the girls clear each enemy. destroy() puts the Sim's own methods back.
 * @param {object} sim
 * @param {{ unlimitedLives?: () => boolean }} [opts]
 */
export function createSandboxDriver(sim, { unlimitedLives = () => true } = {}) {
  const queue = []; // { at: sim time, enemyId, pathIndex, mods, hpMul }
  const drain = () => {
    while (queue.length && queue[0].at <= sim.time + 1e-9) {
      const q = queue.shift();
      spawnOne(sim, q.enemyId, q);
    }
  };
  const push = (entries) => {
    queue.push(...entries);
    queue.sort((a, b) => a.at - b.at);
  };
  const undo = [
    override(sim, '_step', (step) => function sandboxStep(dt) {
      drain();
      return step.call(this, dt);
    }),
    override(sim, '_checkWaveEnd', (check) => function sandboxWaveEnd() {
      if (queue.length && this.state === 'wave') return undefined;
      return check.call(this);
    }),
    guardLives(sim, unlimitedLives),
  ];
  return {
    queue,
    /** Queues `count` of an enemy at the start of a path, SPAWN_SPACING apart, after any group still waiting. */
    spawnGroup(enemyId, count, { pathIndex = 0, mods = null } = {}) {
      if (!sim.data.enemy(enemyId) || !(count > 0)) return 0;
      const tail = queue.length ? queue[queue.length - 1].at + SPAWN_SPACING : sim.time;
      const start = Math.max(sim.time, tail);
      push(Array.from({ length: count }, (_, i) => ({ at: start + i * SPAWN_SPACING, enemyId, pathIndex, mods: mods && { traits: { ...mods.traits }, armor: mods.armor } })));
      return count;
    },
    /**
     * Sends the next wave now. Between waves it simply starts. During a wave the counter moves on
     * and the next wave's enemies queue up with that wave's own HP scale (the enemies of the
     * current wave still to come keep theirs).
     * @returns {boolean}
     */
    sendNextWave() {
      if (sim.state === 'prep' || sim.state === 'between') return sim.startNextWave();
      if (sim.state !== 'wave') return false;
      sim.wave++;
      const w = sim._getWave(sim.wave);
      const hpMul = (sim.stage.hpScale ?? 1) * sim.diff.hpMul * w.hpMul;
      push(w.spawns.map((s) => ({ at: sim.time + s.t, enemyId: s.enemyId, pathIndex: s.pathIndex, mods: null, hpMul })));
      sim._emit('waveStart', { wave: sim.wave });
      return true;
    },
    /** Empties the queue and the board. @returns {number} enemies removed from the board */
    clear() {
      queue.length = 0;
      return clearEnemies(sim);
    },
    destroy() {
      queue.length = 0;
      for (const fn of undo.reverse()) fn();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------------------------

const PHONE_MQ = '(max-height: 500px), (max-width: 700px)';

/**
 * @param {object} ctx battle context (controller.js); uses ctx.sim, ctx.layer, ctx.shell, ctx.feed,
 *   ctx.speed / ctx.setSpeed(s), ctx.preloadEnemies(families) and ctx.endSandbox()
 * @returns {{ el: HTMLElement, update(): void, destroy(): void }}
 */
export function createSandboxPanel(ctx) {
  const { sim } = ctx;
  const state = {
    enemyId: ENEMY_MAP.slime_green ? 'slime_green' : ENEMIES[0].id,
    count: 10,
    pathIndex: 0,
    mods: null,
    unlimitedLives: true,
    open: !window.matchMedia?.(PHONE_MQ).matches,
  };
  state.mods = defaultMods(state.enemyId);
  ctx.sandbox = state;
  const driver = createSandboxDriver(sim, { unlimitedLives: () => state.unlimitedLives });

  // ---- header (always visible; the toggle collapses the body on phones) -------------------
  const toggleBtn = h('button.bt-sbx-toggle', { 'data-testid': 'sandbox-toggle', 'aria-expanded': 'true', onclick: () => setOpen(!state.open) }, icon('settings', 'bt-ico-sm'), h('span', 'Sandbox'), h('span.bt-sbx-chev'));

  // ---- economy -------------------------------------------------------------------------------
  const livesBtn = h('button.bt-sbx-chip', { 'data-testid': 'sandbox-lives', onclick: () => { state.unlimitedLives = !state.unlimitedLives; paintLives(); } });
  const paintLives = () => {
    livesBtn.replaceChildren(icon('heart', 'bt-ico-sm'), state.unlimitedLives ? 'Lives: unlimited' : 'Lives: on');
    livesBtn.classList.toggle('on', state.unlimitedLives);
    livesBtn.setAttribute('aria-pressed', state.unlimitedLives ? 'true' : 'false');
  };
  paintLives();
  const coinsBtn = h('button.bt-sbx-chip.bt-sbx-coins', { 'data-testid': 'sandbox-coins', onclick: () => { addCoins(sim); ctx.feed?.push(`+${fmtNum(SANDBOX_COIN_STEP, 'money')} coins`, 'good', { key: 'sbx-coins', ms: 1000 }); } }, icon('plus', 'bt-ico-sm'), `${fmtNum(SANDBOX_COIN_STEP, 'money')} coins`);

  // ---- spawn ---------------------------------------------------------------------------------
  const enemySel = h('select.bt-sbx-select', { 'data-testid': 'sandbox-enemy', 'aria-label': 'Enemy', onchange: (e) => pickEnemy(e.target.value) },
    enemyGroups().map((g) => h('optgroup', { label: g.family.name }, g.enemies.map((e) => h('option', { value: e.id }, `${e.name}${e.tier === 'boss' ? ' · Boss' : e.tier === 'miniboss' ? ' · Miniboss' : e.tier === 'elite' ? ' · Elite' : ''}`)))));
  enemySel.value = state.enemyId;
  const token = h('span.bt-sbx-token');
  const countRow = h('div.bt-sbx-seg', { role: 'group', 'aria-label': 'Count' });
  const paintCounts = () => countRow.replaceChildren(...SPAWN_COUNTS.map((n) => h(`button.bt-sbx-seg-btn${state.count === n ? '.on' : ''}`, { 'data-testid': `sandbox-count-${n}`, onclick: () => { state.count = n; paintCounts(); } }, `×${n}`)));
  paintCounts();
  const pathCount = sim.pathData.length;
  const pathRow = pathCount > 1 ? h('div.bt-sbx-seg', { role: 'group', 'aria-label': 'Path' }) : null;
  const paintPaths = () => pathRow?.replaceChildren(...Array.from({ length: pathCount }, (_, i) => h(`button.bt-sbx-seg-btn${state.pathIndex === i ? '.on' : ''}`, { 'data-testid': `sandbox-path-${i}`, onclick: () => { state.pathIndex = i; paintPaths(); } }, `Path ${i + 1}`)));
  paintPaths();
  const modsRow = h('div.bt-sbx-mods');
  const paintMods = () => {
    const sw = spawnSwitches(state.enemyId);
    modsRow.replaceChildren(
      ...sw.traits.map((t) => h(`button.bt-sbx-mod${state.mods.traits[t.key] ? '.on' : ''}`, { 'data-testid': `sandbox-trait-${t.key}`, title: TRAITS[t.key]?.desc || t.key, onclick: () => { state.mods.traits[t.key] = !state.mods.traits[t.key]; paintMods(); } }, traitBadge(t.key, 'bt-sbx-mod-ico'), TRAITS[t.key]?.name || t.key)),
      h(`button.bt-sbx-mod${state.mods.armor ? '.on' : ''}`, { 'data-testid': 'sandbox-armor', title: 'Flat damage reduction on every hit', onclick: () => { state.mods.armor = !state.mods.armor; paintMods(); } }, icon('shield', 'bt-sbx-mod-ico'), sw.armor.label),
    );
  };
  const pickEnemy = (id) => {
    if (!ENEMY_MAP[id]) return;
    state.enemyId = id;
    state.mods = defaultMods(id);
    token.replaceChildren(enemyToken(id, { size: 26 }));
    paintMods();
    // load her family's model now, so the spawn shows it (the procedural body otherwise)
    const def = ENEMY_MAP[id];
    Promise.resolve(ctx.preloadEnemies?.([def.model?.base || def.family])).catch(() => {});
  };
  pickEnemy(state.enemyId);
  const spawnBtn = h('button.bt-sbx-go', { 'data-testid': 'sandbox-spawn', onclick: () => spawn() }, icon('plus', 'bt-ico-sm'), 'Spawn');

  // ---- waves + speed ----------------------------------------------------------------------
  const sendBtn = h('button.bt-sbx-btn', { 'data-testid': 'sandbox-send-wave', onclick: () => { if (!ctx.ended && driver.sendNextWave()) ctx.wave?.update?.(); } }, icon('ff2', 'bt-ico-sm'), 'Send next wave');
  const clearBtn = h('button.bt-sbx-btn', { 'data-testid': 'sandbox-clear', onclick: () => { const n = driver.clear(); ctx.feed?.push(n ? `Cleared ${n} enemies` : 'The board is already clear', 'info', { key: 'sbx-clear', ms: 1200 }); } }, icon('close', 'bt-ico-sm'), 'Clear enemies');
  const speedRow = h('div.bt-sbx-seg', { role: 'group', 'aria-label': 'Speed' });
  let shownSpeed = null;
  const paintSpeed = () => {
    shownSpeed = ctx.speed;
    speedRow.replaceChildren(...SANDBOX_SPEEDS.map((s) => h(`button.bt-sbx-seg-btn${ctx.speed === s ? '.on' : ''}`, { 'data-testid': `sandbox-speed-${s}`, onclick: () => { if (ctx.setSpeed) ctx.setSpeed(s); else ctx.speed = s; paintSpeed(); } }, `${s}×`)));
  };
  paintSpeed();

  // ---- damage per girl ----------------------------------------------------------------------
  const dmgList = h('ol.bt-sbx-dmg', { 'data-testid': 'sandbox-damage' });
  let dmgKey = '';
  const paintDamage = () => {
    const rows = damageByGirl(sim);
    const key = rows.map((r) => `${r.unitId}:${Math.floor(r.damage)}`).join('|');
    if (key === dmgKey) return;
    dmgKey = key;
    if (!rows.length) {
      dmgList.replaceChildren(h('li.bt-sbx-dmg-empty', 'Place girls and spawn enemies to see who deals what.'));
      return;
    }
    dmgList.replaceChildren(...rows.slice(0, 9).map((r) => {
      const name = sim.data.unit(r.unitId)?.name || r.unitId;
      return h('li.bt-sbx-dmg-row', h('span.bt-sbx-dmg-name', name), h('span.bt-sbx-dmg-bar', h('span', { style: { width: `${Math.max(2, Math.round(r.share * 100))}%` } })), h('b', fmtNum(r.damage)));
    }));
  };
  paintDamage();

  const endBtn = h('button.bt-sbx-btn.bt-sbx-end', { 'data-testid': 'sandbox-end', onclick: () => ctx.endSandbox?.() }, icon('back', 'bt-ico-sm'), 'End sandbox');

  const body = h('div.bt-sbx-body',
    h('div.bt-sbx-row', coinsBtn, livesBtn),
    h('div.bt-sbx-sec', 'Spawn'),
    h('div.bt-sbx-row', token, enemySel),
    countRow,
    pathRow,
    modsRow,
    spawnBtn,
    h('div.bt-sbx-sec', 'Waves'),
    h('div.bt-sbx-row', sendBtn, clearBtn),
    h('div.bt-sbx-sec', 'Speed'),
    speedRow,
    h('div.bt-sbx-sec', 'Damage per girl'),
    dmgList,
    endBtn,
  );
  const el = h('aside.bt-sbx', { 'data-testid': 'sandbox-panel' }, toggleBtn, body);
  ctx.layer.append(el);

  function setOpen(v) {
    state.open = !!v;
    el.classList.toggle('open', state.open);
    toggleBtn.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    body.hidden = !state.open;
    // the toast feed steps aside (battle.css) instead of hiding under the open panel
    ctx.shell?.classList.toggle('bt-sbx-open', state.open);
  }
  setOpen(state.open);

  function spawn() {
    if (ctx.ended) return;
    const def = ENEMY_MAP[state.enemyId];
    if (!def) return;
    driver.spawnGroup(def.id, state.count, { pathIndex: state.pathIndex, mods: state.mods });
    ctx.feed?.push(`Spawning ${state.count}× ${def.name}${pathCount > 1 ? ` on path ${state.pathIndex + 1}` : ''}`, 'info', { key: 'sbx-spawn', ms: 1400 });
  }

  return {
    el,
    state,
    driver,
    get queued() {
      return driver.queue.length;
    },
    update() {
      if (ctx.ended) return;
      if (ctx.speed !== shownSpeed) paintSpeed();
      paintDamage();
    },
    destroy() {
      driver.destroy();
      ctx.shell?.classList.remove('bt-sbx-open');
      el.remove();
    },
  };
}
