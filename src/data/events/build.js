// Limited events: builders and validation for EventDefs (EVENT_SPEC §3.3). Plain data, no DOM.
// Nothing here imports stages.js, enemies.js, items.js or units.js, so those files (and the
// event wiring in ./wire.js) can import the registry without an import cycle.

/** Wave pool entry (copy of the helper in src/data/stages.js). */
export const P = (enemy, weight, from = 1, to = undefined) => (to == null ? { enemy, weight, from } : { enemy, weight, from, to });
/** Scripted wave addition (copy of the helper in src/data/stages.js). */
export const F = (wave, enemy, count = 1, spacing = undefined, delay = undefined) => {
  const f = { wave, enemy, count };
  if (spacing != null) f.spacing = spacing;
  if (delay != null) f.delay = delay;
  return f;
};
/** Drop table entry (copy of the helper in src/data/stages.js). */
export const D = (item, chance, min = 1, max = min, difficulty = undefined) => (difficulty
  ? { item, chance, min, max, difficulty }
  : { item, chance, min, max });

/** Currency icon shapes src/art/icons/items.js draws. */
export const EVENT_ICON_SHAPES = ['candy', 'shell', 'lantern', 'leaf', 'snow', 'star'];
/** What an event mission can count (only src/systems/events.js emits these). */
export const EVENT_MISSION_ON = ['eventLogin', 'eventClear', 'eventBoss', 'eventKill', 'eventRead', 'eventStage'];
/** Exchange cosmetics (owned in profile.events; see src/systems/events.js eventCosmetics). */
export const EVENT_COSMETIC_KINDS = ['title', 'frame', 'avatar'];

const growthFor = (start, final, waves) => Math.round((final / start) ** (1 / Math.max(1, waves - 1)) * 10000) / 10000;

/**
 * An event operation or boss as a StageDef (the shape campaign()/bossStage() return), plus the
 * event fields. hpScale, cashScale and startCash are copied from `tuneLike` when the stage is
 * registered (src/data/events/wire.js resolveEventStage), unless set here.
 * @param {{ id: string, key: string }} ev the event (id + key)
 * @param {object} o
 */
export function eventStage(ev, o) {
  return {
    id: o.id,
    kind: 'event',
    event: ev.id,
    chapter: o.chapter ?? null,
    name: o.name,
    mapId: o.mapId,
    desc: o.desc,
    waves: o.waves,
    waveGen: {
      pool: o.pool,
      budget: { start: o.budget[0], growth: growthFor(o.budget[0], o.budget[1], o.waves) },
      spacing: o.spacing ?? 0.8,
      groups: o.groups ?? 3,
      fixed: o.fixed || [],
    },
    ...(o.hpScale != null ? { hpScale: o.hpScale } : {}),
    ...(o.cashScale != null ? { cashScale: o.cashScale } : {}),
    ...(o.startCash != null ? { startCash: o.startCash } : {}),
    hpPass: 1,
    lives: 100,
    introduces: o.introduces || [],
    recommended: o.recommended || [],
    unlocks: {},
    requires: o.requires ?? null,
    drops: o.drops || [],
    firstClear: o.firstClear || [],
    scenery: o.scenery,
    tier: o.tier || 'intermediate',
    rule: null,
    difficulties: o.difficulties || ['normal'],
    tuneLike: o.tuneLike,
    boss: !!o.boss,
    gate: o.gate || null,
    look: o.look || null,
  };
}

/** An event enemy: exactly the EnemyDef shape of enemy() in src/data/enemies.js. */
export function eventEnemy(o) {
  const tier = o.tier || 'normal';
  const leak = { normal: 1, elite: 5, miniboss: 20, boss: 50 };
  return {
    id: o.id,
    name: o.name,
    family: o.family,
    tier,
    hp: o.hp,
    speed: o.speed ?? 1,
    armorClass: o.armorClass,
    armor: o.armor ?? 0,
    bounty: o.bounty ?? 1,
    leak: o.leak ?? leak[tier],
    threat: o.threat ?? 1,
    size: o.size ?? 0.8,
    color: o.color,
    accent: o.accent,
    model: { base: o.family, variant: o.variant || 'basic', props: o.props || [] },
    traits: o.traits || {},
    ...(o.phases ? { phases: o.phases } : {}),
    lore: o.lore,
    counters: o.counters,
    introducedIn: o.introducedIn,
  };
}

/** Exchange offer. limit null = unlimited. `cosmetic` offers grant a title / frame / avatar instead of items. */
export function offer(o) {
  return {
    id: o.id,
    item: o.item ?? null,
    count: o.count ?? 1,
    price: o.price,
    limit: o.limit === undefined ? 1 : o.limit,
    ...(o.cosmetic ? { cosmetic: { ...o.cosmetic } } : {}),
    ...(o.requires ? { requires: { ...o.requires } } : {}),
  };
}

/** Event mission: kind 'daily' (resets at 7 PM Central) or 'total' (once per event). */
export function mission(o) {
  return {
    id: o.id,
    kind: o.kind,
    name: o.name,
    desc: o.desc,
    on: o.on,
    goal: o.goal,
    ...(o.difficulty ? { difficulty: o.difficulty } : {}),
    ...(o.stage ? { stage: o.stage } : {}),
    rewards: o.rewards,
  };
}

/** Episode meta (the scene itself lives in ./scenes/<key>.js). */
export function episode(o) {
  return { id: o.id, n: o.n, title: o.title, gate: o.gate || {}, rewards: o.rewards || [] };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural checks (ids, references inside the event, windows ordered). Cross-table checks
 * (maps, enemies, items) live in tests/data/events.test.js.
 * @returns {string[]} problems (empty = valid)
 */
export function validateEvent(ev) {
  const out = [];
  const err = (m) => out.push(`${ev?.id}: ${m}`);
  if (!ev || typeof ev.id !== 'string' || !/^[a-z0-9-]+$/.test(ev.id)) return [`bad event id ${ev?.id}`];
  if (!/^[a-z]+$/.test(ev.key || '')) err('bad key');
  const w = ev.window || {};
  if (!ISO_DAY.test(w.opens) || !ISO_DAY.test(w.lastDay) || !ISO_DAY.test(w.exchangeLastDay)) err('window days must be YYYY-MM-DD');
  else if (!(w.opens <= w.lastDay && w.lastDay <= w.exchangeLastDay)) err('window out of order');
  const c = ev.currency || {};
  if (c.id !== `evt_${ev.key}_${String(c.id).split('_').pop()}` || !/^evt_[a-z]+_[a-z]+$/.test(c.id || '')) err(`currency id ${c.id}`);
  if (!EVENT_ICON_SHAPES.includes(c.icon?.shape)) err(`icon shape ${c.icon?.shape}`);
  const stageIds = new Set();
  for (const s of ev.stages || []) {
    if (!(new RegExp(`^ev-${ev.key}-(\\d+|boss)$`).test(s.id))) err(`stage id ${s.id}`);
    if (stageIds.has(s.id)) err(`duplicate stage ${s.id}`);
    stageIds.add(s.id);
    if (s.event !== ev.id) err(`${s.id} event field`);
    if (!s.tuneLike) err(`${s.id} needs tuneLike`);
  }
  const epIds = new Set((ev.episodes || []).map((e) => e.id));
  for (const e of ev.episodes || []) {
    if (!(new RegExp(`^ev\\.${ev.key}\\.\\d{2}$`).test(e.id))) err(`episode id ${e.id}`);
    if (e.gate.stage && !stageIds.has(e.gate.stage)) err(`${e.id} gate stage ${e.gate.stage}`);
    if (e.gate.episode && !epIds.has(e.gate.episode)) err(`${e.id} gate episode ${e.gate.episode}`);
  }
  for (const s of ev.stages || []) {
    if (s.gate?.episode && !epIds.has(s.gate.episode)) err(`${s.id} gate episode ${s.gate.episode}`);
  }
  const ids = new Set();
  for (const m of [...(ev.missions?.daily || []), ...(ev.missions?.total || [])]) {
    if (ids.has(m.id)) err(`duplicate mission ${m.id}`);
    ids.add(m.id);
    if (!EVENT_MISSION_ON.includes(m.on)) err(`${m.id} on ${m.on}`);
    if (!(m.goal > 0)) err(`${m.id} goal`);
    if (m.on === 'eventStage' && !stageIds.has(m.stage)) err(`${m.id} stage ${m.stage}`);
  }
  for (const m of ev.missions?.daily || []) if (m.kind !== 'daily') err(`${m.id} kind`);
  for (const m of ev.missions?.total || []) if (m.kind !== 'total') err(`${m.id} kind`);
  for (const o of ev.shop || []) {
    if (ids.has(o.id)) err(`duplicate id ${o.id}`);
    ids.add(o.id);
    if (!(o.price > 0)) err(`${o.id} price`);
    if (o.cosmetic && !EVENT_COSMETIC_KINDS.includes(o.cosmetic.kind)) err(`${o.id} cosmetic kind`);
    if (!o.cosmetic && !o.item) err(`${o.id} needs an item`);
  }
  if (!Array.isArray(ev.login) || !ev.login.length) err('login gifts');
  return out;
}
