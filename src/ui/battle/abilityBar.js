// The ability bar (ABILITIES_SPEC §8.1–§8.3, §8.5; UI_DIRECTION §4.5, §6.6, §5.10 E8): one button per ability of the
// local player's tower girls, bottom right, in tower-bar order (copies share one button). Display only: a tap goes
// through ctx.castAbility (solo: sim.castAbility; co-op: the `abil` command), so the sim validates every cast.
//
//   Pure halves (tests/battle-ui/abilityBar.test.js):
//     abilityBarView(sim, owner, { pending, refused, now })  the slots as plain data (≤ 1 number each)
//     abilityCommandArgs(uid, { group, aim })               the co-op `abil` arguments (aim quantised × 1024; −1, −1 none)
//     battleKeyAction(e, { paused, typing })                what a key does in battle (1–9 slots, Shift+1–9 cards, E skill)
//     refusalText(reason, o)                                the quiet toast for every refusal reason
//     createAbilityNotes({ now })                           first unlock once per id, the ally chip at most every 3 s
//     abilityCardView(sim, slot)                            the hold card's words
//   DOM half: createAbilityBar(ctx) → { el, update(), handle(events), fireSlot(i), … }
//
// Slot states: charging (dimmed portrait under a navy sweep, whole seconds), ready (full colour, yellow ring, ×N
// when 2+ copies are ready), pending (co-op: sent, waiting for its tick), active (a pink drain bar), between waves
// (grey, frozen sweep, WAVE), blocked (sabotaged / econ cap / no income / nothing in reach). Badges: A (Auto on),
// a globe (map-wide: one cooldown per player), the key hint 1–9 (hover devices only, E8).
// The slot list is rebuilt on ability / upgrade / sell / wave events and at most 4× a second; the rings are
// painted every frame straight from t.abil (no allocation).
import { h } from './util.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { fmtNum } from '../format.js';
import { KIT_SVG } from '../kit.js';
import { abilityText, abilityAim, abilityValues, fillAbilityText, ABILITY_COPY } from '../../data/abilityText.js';
import { abilityDef, abilityReach } from '../../sim/abilities.js';
import { ABILITY_RULES } from '../../data/abilities.js';
import { abilArgs } from '../../online/coop/commands.js';
import { createHoldGesture, showHoldRing, hideHoldRing, swallowNextClick, onEscape, HOLD_MS } from '../hold.js';

/** Slots that get a 1–9 key. */
export const SLOT_KEYS = 9;
/** The slot list is rebuilt at most this often (ms) between the events that rebuild it at once. */
export const REBUILD_MS = 250;
/** A refused tap with nothing in reach dims its slot this long (ms). */
export const REFUSED_MS = 1500;
/** A co-op cast waits this long (ms) for its command to come back before the slot stops spinning. */
export const PENDING_MS = 8000;
/** At most one ally chip this often (ms). */
export const ALLY_CHIP_MS = 3000;
/** Events that change which slots exist or what they show (the list is rebuilt the same frame). */
export const REBUILD_EVENTS = new Set(['abilityUnlock', 'abilityUpgrade', 'abilityReady', 'abilityEnd', 'ability', 'sell', 'place', 'upgrade', 'waveStart', 'waveEnd', 'sabotage', 'won', 'lost']);

const KIND_WORD = { strike: 'Strike', burst: 'Blast', boost: 'Boost', rally: 'Team rally', debuff: 'Debuff', econ: 'Coins', deploy: 'Deploy', runner: 'Runner', move: 'Move', zone: 'Zone' };

// ---------------------------------------------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------------------------------------------

/** Whole seconds, rounded up (never "0s" while it still runs): "12s", "1:05". */
export const wholeSeconds = (s) => fmtNum(Math.max(0.001, s || 0), 'time', { whole: true });

/**
 * The quiet toast a refused cast shows (one entry per reason the sim can give, plus the co-op layer's).
 * @param {string} reason
 * @param {{ secondsLeft?: number, name?: string, unlock?: string }} [o]
 */
export function refusalText(reason, o = {}) {
  switch (reason) {
    case 'cooldown': return `Recharging · ${wholeSeconds(o.secondsLeft)}`;
    case 'active': return 'Already active';
    case 'notWave': return 'Abilities work during waves.';
    case 'noTarget': return 'Nothing in reach yet';
    case 'cap': return `${o.name || 'Market Day'}: twice per wave`;
    case 'noIncome': return 'No coins on Nightmare';
    case 'disabled': return 'She\'s sabotaged';
    case 'moving': return 'She\'s moving';
    case 'notYours': return 'Not yours';
    case 'locked': return o.unlock ? `Unlocks at ${o.unlock}` : 'Not learned yet';
    case 'ended': return 'The battle is over.';
    case 'busy': return 'One moment — the battle is catching up.';
    case 'invalid': return 'That didn\'t go through.';
    default: return 'She can\'t use it right now.';
  }
}

/** Every reason refusalText knows (the sim's refusal() order, then the cast-time and co-op ones). */
export const REFUSAL_REASONS = Object.freeze(['ended', 'locked', 'notYours', 'notWave', 'disabled', 'moving', 'active', 'cooldown', 'cap', 'noIncome', 'noTarget', 'busy', 'invalid']);

/** The co-op `abil` command's arguments: [uid, group 0|1, qx, qy] (aim × 1024, or −1, −1 for none). */
export function abilityCommandArgs(uid, { group = false, aim = null } = {}) {
  const ok = Array.isArray(aim) && aim.length >= 2 && Number.isFinite(aim[0]) && Number.isFinite(aim[1]);
  return abilArgs(uid, { group: !!group, aim: ok ? aim : null });
}

/** A slot's state from its best copy's status (sim.abilityStatus) and how many copies are ready. */
export function slotState(best, ready, { pending = false, refused = null } = {}) {
  if (pending) return 'pending';
  if (ready > 0) return refused === 'noTarget' ? 'blocked' : 'ready';
  switch (best?.reason) {
    case 'notWave': return 'between';
    case 'ended': return 'between';
    case 'active': return 'active';
    case 'cooldown': return 'charging';
    default: return 'blocked';
  }
}

const STATE_WORD = { ready: 'ready', charging: 'recharging', pending: 'sent', active: 'active', between: 'charges during waves', blocked: 'not now' };

/**
 * The ability bar of player `owner`, as plain data: one slot per ability id (copies grouped), her tower girls only
 * (never an ally's girl, never a hero: a hero's skill is in the hero widget), in tower-bar order then placement order.
 * Each slot shows at most ONE number: the whole seconds while it charges, or ×N when 2+ copies are ready.
 * @param {import('../../sim/Sim.js').Sim} sim
 * @param {number} owner the player slot (solo: 0)
 * @param {{ pending?: Set<string>|Map<string,*>|null, refused?: Map<string,{reason:string,until:number}>|null, now?: number }} [o]
 * @returns {object[]}
 */
export function abilityBarView(sim, owner = 0, { pending = null, refused = null, now = 0 } = {}) {
  const raw = sim.abilitySlots(owner);
  return raw.map((s, i) => {
    const best = s.best || {};
    const text = abilityText(s.id);
    const name = text?.name || s.id;
    const r = refused?.get?.(s.id);
    const refusedReason = r && r.until > now ? r.reason : null;
    const state = slotState(best, s.ready, { pending: !!pending?.has?.(s.id), refused: refusedReason });
    const autoOn = s.casters.some((u) => !!sim.getTower(u)?.abil?.auto);
    const secondsLeft = best.cooldownLeft || 0;
    const label = state === 'charging' ? wholeSeconds(secondsLeft) : state === 'between' ? 'WAVE' : null;
    const badge = state === 'ready' && s.ready >= 2 ? `×${s.ready}` : null;
    const reason = state === 'blocked' ? refusedReason || best.reason || null : state === 'charging' ? 'cooldown' : best.reason || null;
    const key = i < SLOT_KEYS ? String(i + 1) : null;
    const words = state === 'charging' ? `recharging, ${Math.ceil(secondsLeft)} seconds` : state === 'blocked' ? refusalText(reason, { secondsLeft, name }).toLowerCase() : STATE_WORD[state];
    return {
      id: s.id,
      unitId: s.unitId,
      name,
      icon: text?.icon || null,
      kind: s.kind,
      scope: s.scope,
      map: s.scope === 'map',
      aim: abilityAim(s.id),
      casters: s.casters,
      casterUid: best.towerUid ?? s.casters[0],
      ready: s.ready,
      state,
      reason,
      charge: Math.max(0, Math.min(1, best.charge ?? 0)),
      secondsLeft,
      activeLeft: best.activeLeft || 0,
      duration: best.duration || 0,
      auto: autoOn,
      label,
      badge,
      key,
      aria: `${name}, ${words}${autoOn ? ', Auto on' : ''}`,
      title: `${name} — ${state === 'charging' ? `recharging · ${label}` : words}${key ? ` (key ${key})` : ''}. Hold or right-click: info and Auto.`,
    };
  });
}

/** How many visible numbers a slot shows (its label when it holds a digit, its ×N badge): the bar budget. */
export function slotNumbers(slot) {
  return (slot.label && /\d/.test(slot.label) ? 1 : 0) + (slot.badge ? 1 : 0);
}

/**
 * What a key does in battle (UI_DIRECTION §5.10 E8, ABILITIES_SPEC §8.3). 1–9 (the digit row or the numpad, read from
 * `e.code`, so every keyboard layout works) fire ability slots 1–9; Shift+1–9 arm tower-bar cards 1–9; E fires the
 * hero skill; Q / L / Space / F / Esc keep their jobs. Nothing while typing; only Esc while paused.
 * @param {{ key?: string, code?: string, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, repeat?: boolean }} e
 * @param {{ paused?: boolean, typing?: boolean }} [s]
 * @returns {{ do: 'escape'|'wave'|'speed'|'ult'|'level'|'skill'|'ability'|'card', slot?: number, index?: number }|null}
 */
export function battleKeyAction(e, { paused = false, typing = false } = {}) {
  if (!e || typing) return null;
  if (e.key === 'Escape') return { do: 'escape' };
  if (paused || e.ctrlKey || e.metaKey || e.altKey) return null;
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || '');
  if (digit) {
    if (e.repeat) return null;
    const n = Number(digit[1]) - 1;
    return e.shiftKey ? { do: 'card', index: n } : { do: 'ability', slot: n };
  }
  // no e.code (an old browser): the plain digit keys still fire slots
  if (!e.code && /^[1-9]$/.test(e.key || '') && !e.shiftKey) return e.repeat ? null : { do: 'ability', slot: Number(e.key) - 1 };
  const k = e.key;
  if (k === ' ') return { do: 'wave' };
  if (k === 'f' || k === 'F') return { do: 'speed' };
  if (k === 'q' || k === 'Q') return { do: 'ult' };
  if ((k === 'l' || k === 'L') && !e.repeat) return { do: 'level' };
  if ((k === 'e' || k === 'E') && !e.repeat) return { do: 'skill' };
  return null;
}

/** "Aoi learned Skyfall Volley! Tap ⚡ to fire it." (PC: "… Tap ⚡ or press 1 to fire it."; a hero's skill: E). */
export function unlockText(girl, ability, { hover = false, key = null, hero = false } = {}) {
  const k = hero ? 'E' : key;
  if (hero) return `${girl} learned ${ability}! Tap ⚡ by her portrait${hover ? ' or press E' : ''} to use it.`;
  return `${girl} learned ${ability}! Tap ⚡${hover && k ? ` or press ${k}` : ''} to fire it.`;
}

/**
 * The results line (ABILITIES_SPEC §10): "Abilities used: 14 · Aoi 6 · Akane 5 · Momo 3" — the total and the three
 * girls who cast the most (copies of a girl summed). Null when none was used (an empty state is hidden: P7).
 * @param {{ abilitiesUsed?: number, abilityByTower?: Record<string, number> }} stats sim.result().stats
 * @param {(uid: number) => string|undefined} nameOf a girl's name from her uid
 */
export function abilityResultLine(stats, nameOf) {
  const used = stats?.abilitiesUsed || 0;
  if (!used) return null;
  const by = new Map();
  for (const [uid, n] of Object.entries(stats.abilityByTower || {})) {
    const name = nameOf(Number(uid)) || 'Girl';
    by.set(name, (by.get(name) || 0) + n);
  }
  const top = [...by].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return `Abilities used: ${used}${top.length ? ` · ${top.map(([n, c]) => `${n} ${c}`).join(' · ')}` : ''}`;
}

/** The ally's cast chip: "Rin's Miko: Shrine Chorus!". */
export const allyChipText = (owner, girl, ability) => `${owner}'s ${girl}: ${ability}!`;

/**
 * Feed bookkeeping for one battle: the first-unlock toast once per ability id (seed it with the abilities a
 * Continue already has), and the ally chip at most once per ALLY_CHIP_MS.
 * @param {{ now?: () => number, allyEvery?: number }} [o]
 */
export function createAbilityNotes({ now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), allyEvery = ALLY_CHIP_MS } = {}) {
  const seen = new Set();
  let allyAt = -Infinity;
  return {
    seed(ids) {
      for (const id of ids || []) if (id) seen.add(id);
    },
    /** True the first time `id` unlocks in this battle. */
    firstUnlock(id) {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    /** True when an ally chip may show now (and starts the wait). */
    allyChip() {
      const t = now();
      if (t - allyAt < allyEvery) return false;
      allyAt = t;
      return true;
    },
  };
}

/**
 * The hold card (§8.2 Input), as plain data: the name, a kind word, its live description (her current stats), the
 * cooldown, the girls sharing the button, the Auto switch and the reach ring to draw (null for a map-wide one).
 * @param {import('../../sim/Sim.js').Sim} sim
 * @param {{ id: string, casters: number[], casterUid: number, state?: string, secondsLeft?: number }} slot
 */
export function abilityCardView(sim, slot) {
  const t = sim.getTower(slot.casterUid) || sim.getTower(slot.casters?.[0]);
  if (!t) return null;
  const def = abilityDef(t);
  const text = abilityText(slot.id);
  if (!def || !text) return null;
  let desc = text.desc;
  try {
    desc = fillAbilityText(text.desc, abilityValues(def, t.eff));
  } catch {
    /* a template the values cannot fill keeps its words */
  }
  const st = sim.abilityStatus(t.uid);
  const casters = (slot.casters || [t.uid]).map((u) => sim.getTower(u)).filter(Boolean);
  const reach = abilityReach(t, def);
  const map = def.scope === 'map';
  return {
    id: slot.id,
    name: text.name,
    girl: t.def.name,
    kind: KIND_WORD[def.kind] || def.kind,
    scope: map ? 'Map-wide · one cooldown per player' : def.scope === 'player' ? 'Per player' : 'Around her',
    desc,
    cooldown: `Recharges in ${wholeSeconds(st?.cooldown || def.cooldown)} of wave time`,
    state: st?.ready ? 'Ready' : st?.reason === 'cooldown' ? `Recharging · ${wholeSeconds(st.cooldownLeft)}` : st?.reason === 'notWave' ? 'Charges during waves' : st?.reason === 'active' ? 'Active' : refusalText(st?.reason, { name: text.name }),
    sharing: casters.length > 1 ? `${casters.length} copies of ${t.def.name} share this button` : null,
    auto: casters.length ? casters.every((o) => !!o.abil?.auto) : false,
    reach: !map && Number.isFinite(reach) && reach > 0 ? { x: t.x, y: t.y, r: reach } : null,
    help: ABILITY_COPY.autoHelp,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------------------------------------------

const GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.6 2.6 3.6 5.6 3.6 8.6s-1 6-3.6 8.6M12 3.4C9.4 6 8.4 9 8.4 12s1 6 3.6 8.6"/></svg>';
const WRENCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.6 4.2a4.8 4.8 0 0 0-5.8 6.3L3.8 15.5a1.9 1.9 0 0 0 2.7 2.7l5-5a4.8 4.8 0 0 0 6.3-5.8l-2.9 2.9-2.4-.3-.3-2.4z"/></svg>';
export const BOLT_SVG = KIT_SVG.bolt;

/** Whether this device hovers (key hints show only there: E8). */
const canHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * @param {object} ctx battle context (sim, layer, shell, coop?, placement, renderer, feed, castAbility, setAbilityAuto)
 */
export function createAbilityBar(ctx) {
  const { sim } = ctx;
  const owner = () => (ctx.coop ? ctx.coop.mySlot : 0);
  const list = h('div.bt-abar-list', { role: 'group', 'aria-label': 'Abilities' });
  const moreNum = h('span.num');
  const more = h('button.bt-ab.bt-ab-more', { type: 'button', 'data-testid': 'ability-more', 'aria-label': 'More abilities', hidden: true, onclick: () => toggleFly() }, moreNum);
  const fly = h('div.bt-abar-fly', { 'data-testid': 'ability-flyout', role: 'group', 'aria-label': 'More abilities', hidden: true });
  const el = h('nav.bt-abar', { 'data-testid': 'ability-bar', 'aria-label': 'Ability bar', hidden: true }, fly, list, more);
  ctx.layer.append(el);

  let slots = [];
  let order = '';
  let builtAt = -Infinity;
  let dirty = true;
  let flyOpen = false;
  let capacity = 99;
  let lastCapKey = '';
  /** id → { btn, parts, slot, p, a, uid, groupKey, cdMax } */
  const nodes = new Map();
  const hover = canHover();

  // ---- the hold card (info, Auto, reach ring) ----------------------------------------------------------------
  let card = null; // { id, el, offEsc }
  function closeCard() {
    if (!card) return;
    card.offEsc?.();
    card.el.remove();
    card = null;
    ctx.shell?.classList.remove('bt-ab-card');
    ctx.renderer?.setAbilityReach?.(null);
  }
  function openCard(id) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    closeCard();
    const v = abilityCardView(sim, slot);
    if (!v) return;
    const mineAll = !ctx.coop || slot.casters.every((u) => ctx.coop.isMine(u));
    const sw = h(`button.bt-ab-switch${v.auto ? '.on' : ''}`, {
      type: 'button', role: 'switch', 'aria-checked': v.auto ? 'true' : 'false', 'data-testid': 'ability-auto',
      disabled: !mineAll,
      onclick: () => {
        const on = sw.getAttribute('aria-checked') !== 'true';
        ctx.setAbilityAuto?.(slot.casters, on);
        sw.classList.toggle('on', on);
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        dirty = true;
      },
    }, h('span.bt-ab-switch-label', ABILITY_COPY.auto), h('span.bt-ab-knob', { 'aria-hidden': 'true' }));
    const def = sim.data.unit(slot.unitId);
    // (compact on a phone: the Auto switch sits in the head, so the whole card fits between the HUD and the bar)
    const elCard = h('div.bt-abcard', { 'data-testid': 'ability-card', role: 'dialog', 'aria-label': `${v.name}` },
      h('div.bt-abcard-head',
        def ? svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-abcard-face') : null,
        h('div.bt-abcard-id', h('b.bt-abcard-name', v.name), h('span.bt-abcard-kind', `${v.kind} · ${v.girl}`)),
        sw,
        h('button.bt-abcard-x', { type: 'button', 'aria-label': 'Close', 'data-testid': 'ability-card-close', onclick: () => closeCard() }, '×')),
      h('p.bt-abcard-desc', h('b.bt-abcard-state', { 'data-testid': 'ability-card-state' }, v.state), ' ', v.desc),
      h('div.bt-abcard-facts', h('span', v.cooldown), h('span', v.scope), v.sharing ? h('span', v.sharing) : null),
      h('small.bt-abcard-help', v.help));
    el.append(elCard);
    card = { id, el: elCard, offEsc: onEscape(() => closeCard()) };
    // (the wave control above the bar steps back while the card is up: one Auto switch on screen, not two)
    ctx.shell?.classList.add('bt-ab-card');
    ctx.renderer?.setAbilityReach?.(v.reach);
  }
  /** A tap outside the card closes it (the bar's own buttons decide for themselves). */
  const onDocDown = (e) => {
    if (card && !card.el.contains(e.target) && !el.contains(e.target)) closeCard();
  };
  document.addEventListener('pointerdown', onDocDown, true);

  // ---- slot buttons ---------------------------------------------------------------------------------------------
  function makeNode(slot) {
    const def = sim.data.unit(slot.unitId);
    const parts = {
      face: h('span.bt-ab-face', def ? svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-ab-art') : null),
      sweep: h('span.bt-ab-sweep', { 'aria-hidden': 'true' }),
      ring: h('span.bt-ab-ring', { 'aria-hidden': 'true' }),
      num: h('span.bt-ab-num'),
      drain: h('span.bt-ab-drain', { 'aria-hidden': 'true' }),
      key: h('span.bt-ab-key', { 'aria-hidden': 'true' }),
      badge: h('span.bt-ab-x'),
      auto: h('span.bt-ab-auto', { title: 'Auto on' }, 'A'),
      globe: svgEl(GLOBE, 'bt-ab-globe'),
      block: svgEl(WRENCH, 'bt-ab-block'),
      spin: h('span.bt-ab-spin', { 'aria-hidden': 'true' }),
    };
    parts.globe.title = 'Map-wide: one cooldown per player';
    const btn = h('button.bt-ab', { type: 'button', 'data-id': slot.id, 'data-unit': slot.unitId },
      parts.face, parts.sweep, parts.ring, parts.drain, parts.spin, parts.block, parts.num, parts.key, parts.badge, parts.auto, parts.globe);
    const node = { btn, parts, slot, p: -1, a: -1, uid: -1, groupKey: null, cdMax: 0, durTicks: 0, sig: '' };
    const hold = createHoldGesture({
      ms: HOLD_MS,
      onStart: () => showHoldRing(btn),
      onFire: () => {
        hideHoldRing({ pop: true });
        openCard(node.slot.id);
      },
      onCancel: () => hideHoldRing(),
    });
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (ctx.placement?.unitId) return;
      hold.down(e);
    });
    btn.addEventListener('pointermove', (e) => hold.move(e));
    btn.addEventListener('pointerup', (e) => {
      if (hold.up(e)) swallowNextClick();
    });
    btn.addEventListener('pointercancel', () => hold.cancel());
    btn.addEventListener('click', () => tap(node.slot.id));
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!hold.pending && !hold.fired) openCard(node.slot.id);
    });
    return node;
  }

  /** Paints a node's state, words and badges (on a rebuild; the rings follow every frame in paint()). */
  function dress(node, slot, i) {
    node.slot = slot;
    const { btn, parts } = node;
    const t = sim.getTower(slot.casterUid);
    node.uid = slot.casterUid;
    node.groupKey = slot.map ? `${owner()}|${slot.id}` : null;
    node.cdMax = t?.abil?.cdMax || 0;
    node.durTicks = Math.max(1, Math.round((slot.duration || 0) * ABILITY_RULES.ticksPerSecond));
    const sig = `${slot.state}|${slot.label}|${slot.badge}|${slot.auto}|${slot.reason}|${slot.key}|${i}|${slot.map}`;
    if (sig === node.sig) return;
    node.sig = sig;
    btn.className = `bt-ab s-${slot.state}${slot.reason === 'disabled' ? ' jammed' : ''}`;
    btn.setAttribute('data-testid', `ability-slot-${i}`);
    btn.dataset.state = slot.state;
    btn.setAttribute('aria-label', slot.aria);
    btn.title = slot.title;
    parts.num.textContent = slot.label || '';
    parts.num.hidden = !slot.label;
    parts.num.classList.toggle('lbl', slot.label === 'WAVE');
    parts.badge.textContent = slot.badge || '';
    parts.badge.hidden = !slot.badge;
    parts.auto.hidden = !slot.auto;
    parts.globe.hidden = !slot.map;
    parts.key.textContent = slot.key || '';
    parts.key.hidden = !(hover && slot.key);
    parts.block.hidden = !(slot.state === 'blocked' && slot.reason === 'disabled');
    parts.spin.hidden = slot.state !== 'pending';
  }

  /** The rings, every frame, from t.abil (no allocation). */
  function paint() {
    for (const node of nodes.values()) {
      const t = sim.getTower(node.uid);
      const a = t?.abil;
      if (!a) continue;
      let cd = a.cd;
      if (node.groupKey) {
        const g = sim.abilGroups.get(node.groupKey);
        if (g && g.cd > cd) cd = g.cd;
      }
      const left = a.cdMax > 0 ? Math.min(1, cd / a.cdMax) : 0;
      const p = Math.round(left * 400) / 400;
      if (p !== node.p) {
        node.p = p;
        node.btn.style.setProperty('--p', String(p));
      }
      const act = a.active > 0 ? Math.round((a.active / node.durTicks) * 200) / 200 : 0;
      if (act !== node.a) {
        node.a = act;
        node.btn.style.setProperty('--a', String(Math.min(1, act)));
      }
    }
  }

  /**
   * How many buttons fit between the hero widget and the bar's right edge (on a rebuild, at most 4× a second). The
   * right edge comes from the CSS tokens (where the bar is going), not its rect: beside an opening panel it is still
   * sliding.
   */
  function measureCapacity(hasPanel) {
    const L = ctx.layer.getBoundingClientRect?.();
    if (!L || !L.width) return 99;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.getPropertyValue('--ab-s')) || 44;
    const gap = parseFloat(cs.getPropertyValue('--ab-gap')) || 6;
    const right = parseFloat(cs.getPropertyValue(hasPanel ? '--bt-abar-panel-r' : '--ab-right')) || 12;
    const hero = document.querySelector('[data-testid="hero-widget"]');
    const hr = hero && !hero.hidden && hero.offsetParent ? hero.getBoundingClientRect() : null;
    const leftLimit = hr && hr.width ? hr.right - L.left + 8 : 12;
    const avail = L.width - right - leftLimit;
    return Math.max(1, Math.floor((avail + gap) / (size + gap)));
  }

  function rebuild(now) {
    builtAt = now;
    dirty = false;
    const pending = ctx.abilityPending || null;
    if (pending) for (const [id, p] of pending) if (now - p.at > PENDING_MS) pending.delete(id);
    slots = abilityBarView(sim, owner(), { pending, refused: ctx.abilityRefused || null, now });
    const has = slots.length > 0 && !ctx.ended;
    el.hidden = !has;
    ctx.shell?.style?.setProperty('--hud-ability-h', has ? 'var(--bt-abar-h)' : '0px');
    if (!has) {
      if (nodes.size) {
        for (const n of nodes.values()) n.btn.remove();
        nodes.clear();
      }
      order = '';
      closeCard();
      return;
    }
    const hasPanel = !!ctx.shell?.classList.contains('bt-has-panel');
    const heroEl = document.querySelector('[data-testid="hero-widget"]');
    const capKey = `${ctx.layer.clientWidth}|${ctx.layer.clientHeight}|${hasPanel ? 1 : 0}|${slots.length}|${heroEl && !heroEl.hidden ? heroEl.offsetWidth : 0}`;
    if (capKey !== lastCapKey) {
      lastCapKey = capKey;
      capacity = measureCapacity(hasPanel);
    }
    const shown = slots.length > capacity ? Math.max(0, capacity - 1) : slots.length;
    const ids = slots.map((s) => s.id).join(',');
    const layoutKey = `${ids}|${shown}|${flyOpen ? 1 : 0}`;
    // the nodes: one per slot, kept across rebuilds (no flicker, holds survive)
    for (const id of [...nodes.keys()]) {
      if (!slots.some((s) => s.id === id)) {
        nodes.get(id).btn.remove();
        nodes.delete(id);
      }
    }
    slots.forEach((s, i) => {
      let node = nodes.get(s.id);
      if (!node) nodes.set(s.id, (node = makeNode(s)));
      dress(node, s, i);
    });
    if (layoutKey !== order) {
      order = layoutKey;
      list.replaceChildren(...slots.slice(0, shown).map((s) => nodes.get(s.id).btn));
      fly.replaceChildren(...slots.slice(shown).map((s) => nodes.get(s.id).btn));
    }
    const rest = slots.length - shown;
    more.hidden = rest <= 0;
    moreNum.textContent = rest > 0 ? `+${rest}` : '';
    more.setAttribute('aria-expanded', flyOpen ? 'true' : 'false');
    fly.hidden = !(flyOpen && rest > 0);
    if (rest <= 0) flyOpen = false;
    if (card && !slots.some((s) => s.id === card.id)) closeCard();
  }

  function toggleFly() {
    flyOpen = !flyOpen;
    dirty = true;
    update();
  }

  /**
   * A tap on a slot (or its key): aim first when it aims and is ready, else fire the group cast. A tap while a card
   * is armed never casts (the bar fades and ignores it); a key is deliberate and does.
   */
  function tap(id, { key = false } = {}) {
    if (ctx.ended || (!key && ctx.placement?.unitId)) return;
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    if (flyOpen && fly.contains(nodes.get(id)?.btn)) {
      flyOpen = false;
      dirty = true;
    }
    // the tapped (selected) copy when she is one of them, else the slot's best copy
    const sel = ctx.selectedUid != null && slot.casters.includes(ctx.selectedUid) ? ctx.selectedUid : slot.casterUid;
    // aim mode: the same slot again casts with no aim (her own pick)
    if (ctx.aim?.abilityId === id) {
      ctx.aim.cancel();
      ctx.castAbility?.(sel, { group: true, aim: null, id });
      dirty = true;
      return;
    }
    if (slot.aim && slot.state === 'ready' && ctx.aim?.startAbility) {
      ctx.aim.startAbility({ uid: sel, id, kind: slot.aim, name: slot.name });
      return;
    }
    ctx.castAbility?.(sel, { group: true, aim: null, id });
    dirty = true;
  }

  function update() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (dirty || now - builtAt >= REBUILD_MS) rebuild(now);
    if (!el.hidden) paint();
  }

  return {
    el,
    update,
    /** This frame's sim events: the ones that change the slots rebuild them in this frame. */
    handle(events) {
      for (const ev of events) {
        if (REBUILD_EVENTS.has(ev.type)) {
          dirty = true;
          break;
        }
      }
    },
    /** Keys 1–9 (0-based index into the bar's order, the flyout included). */
    fireSlot(i, { key = true } = {}) {
      if (dirty) rebuild(typeof performance !== 'undefined' ? performance.now() : Date.now());
      const s = slots[i];
      if (s) tap(s.id, { key });
      return !!s;
    },
    fireId: (id) => tap(id),
    openCard,
    closeCard,
    get cardOpen() {
      return !!card;
    },
    refresh() {
      dirty = true;
    },
    /** The slots as last built (e2e and the coach read them). */
    get slots() {
      return slots;
    },
    destroy() {
      closeCard();
      document.removeEventListener('pointerdown', onDocDown, true);
      el.remove();
    },
  };
}
