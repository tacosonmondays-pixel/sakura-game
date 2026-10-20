// Limited events: the data and how it joins the tables (EVENT_SPEC §7 EV-1…EV-7).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_EVENTS, EVENT_STAGES, EVENT_ENEMIES, EVENT_CURRENCIES, eventOfStage, eventOfItem } from '../../src/data/events/index.js';
import { validateEvent, EVENT_MISSION_ON } from '../../src/data/events/build.js';
import { resolveEventStage } from '../../src/data/events/wire.js';
import { STAGES, STAGE_MAP, CAMPAIGN_IDS, stageEnemies } from '../../src/data/stages.js';
import { ENEMIES, ENEMY_MAP } from '../../src/data/enemies.js';
import { MAPS } from '../../src/data/maps.js';
import { ITEMS } from '../../src/data/items.js';
import { CAPABILITIES, DIFFICULTY_ORDER } from '../../src/data/types.js';
import { SCENERY } from '../../src/render/terrain.js';
import { hasItemIcon } from '../../src/art/icons.js';
import { itemSources } from '../../src/systems/inventory.js';
import { HALLOWEEN_SCENES } from '../../src/data/events/scenes/halloween.js';
import { LIMITS, FACE_IDS, TOKEN_RE } from '../../src/data/story/format.js';
import { resolveText, tokenProblems } from '../../src/data/story/tokens.js';
import { UNIT_MAP } from '../../src/data/units.js';

const MAP_IDS = new Set(MAPS.map((m) => m.id));
const EVENT_MAP_INTRO = () => ALL_EVENTS.find((e) => e.id === 'halloween-2026').intro.body;
const manifest = JSON.parse(readFileSync(new URL('../../public/models/enemies/manifest.json', import.meta.url), 'utf8'));

describe('event data (EV-1…EV-7)', () => {
  it('EV-1 every event validates and no id collides with the game tables', () => {
    for (const ev of ALL_EVENTS) expect(validateEvent(ev)).toEqual([]);
    for (const s of EVENT_STAGES) expect(STAGES.some((x) => x.id === s.id)).toBe(false);
    for (const e of EVENT_ENEMIES) expect(ENEMIES.some((x) => x.id === e.id)).toBe(false);
  });

  it('EV-2 every event stage uses real maps, enemies, items, capabilities and scenery', () => {
    for (const s of EVENT_STAGES) {
      expect(MAP_IDS.has(s.mapId), s.id).toBe(true);
      for (const p of [...s.waveGen.pool, ...s.waveGen.fixed]) expect(ENEMY_MAP[p.enemy], `${s.id} ${p.enemy}`).toBeTruthy();
      for (const d of s.drops) expect(ITEMS[d.item], `${s.id} drop ${d.item}`).toBeTruthy();
      for (const r of s.firstClear) expect(ITEMS[r.id], `${s.id} first clear ${r.id}`).toBeTruthy();
      for (const c of s.recommended) expect(CAPABILITIES[c], `${s.id} ${c}`).toBeTruthy();
      expect(!s.requires || !!STAGE_MAP[s.requires], s.id).toBe(true);
      expect(CAMPAIGN_IDS).toContain(s.tuneLike);
      for (const d of s.difficulties) expect(DIFFICULTY_ORDER).toContain(d);
      for (const k of s.scenery.props) expect(SCENERY[k], `${s.id} scenery ${k}`).toBeTruthy();
      expect(s.look).toEqual({ night: 'lantern', costumes: true });
    }
  });

  it('EV-3 registered stages copy hpScale / cashScale / startCash from tuneLike, keeping overrides', () => {
    for (const s of EVENT_STAGES) {
      const like = STAGE_MAP[s.tuneLike];
      expect(STAGE_MAP[s.id].hpScale).toBe(like.hpScale);
      expect(STAGE_MAP[s.id].cashScale).toBe(like.cashScale);
      expect(STAGE_MAP[s.id].startCash).toBe(like.startCash);
    }
    expect(resolveEventStage({ ...EVENT_STAGES[0], hpScale: 9 }).hpScale).toBe(9);
  });

  it('EV-4 STAGES / ENEMIES unchanged; the lookup maps include the event; the boss is in its stage', () => {
    expect(STAGES.length).toBe(59);
    expect(STAGES.some((s) => s.kind === 'event')).toBe(false);
    expect(STAGE_MAP['ev-halloween-1'].kind).toBe('event');
    expect(ENEMY_MAP.construct_gourdlight.tier).toBe('boss');
    expect(stageEnemies('ev-halloween-boss')).toContain('construct_gourdlight');
    expect(ENEMY_MAP.construct_gourdlight.introducedIn).toBe('ev-halloween-boss');
    expect(eventOfStage('ev-halloween-boss').id).toBe('halloween-2026');
  });

  it('EV-5 event enemies have exactly the EnemyDef key set and a real model variant / props', () => {
    const keys = (o) => Object.keys(o).filter((k) => k !== 'phases').sort();
    for (const e of EVENT_ENEMIES) {
      expect(keys(e)).toEqual(keys(ENEMIES.find((x) => x.tier === 'boss')));
      const fam = manifest[e.model.base];
      expect(fam.variants).toContain(e.model.variant);
      for (const p of e.model.props) expect(fam.props).toContain(p);
      // a simple two-phase fight: one phase change, existing traits only
      expect(e.phases.length).toBe(1);
    }
  });

  it('EV-6 every currency is an item with its own icon and an event source row', () => {
    for (const c of EVENT_CURRENCIES) {
      expect(ITEMS[c.id].category).toBe('event');
      expect(hasItemIcon(c.id)).toBe(true);
      expect(eventOfItem(c.id).id).toBe(c.event);
      expect(itemSources(c.id).some((s) => s.route === 'event' && s.params.id === c.event)).toBe(true);
    }
  });

  it('EV-7 every offer / mission / login gift item exists; mission triggers are from the closed list', () => {
    for (const ev of ALL_EVENTS) {
      for (const o of ev.shop) if (!o.cosmetic) expect(ITEMS[o.item], o.id).toBeTruthy();
      for (const m of [...ev.missions.daily, ...ev.missions.total]) {
        expect(EVENT_MISSION_ON).toContain(m.on);
        for (const r of m.rewards) expect(ITEMS[r.id], `${m.id} ${r.id}`).toBeTruthy();
      }
      for (const day of ev.login) for (const r of day) expect(ITEMS[r.id], `login ${r.id}`).toBeTruthy();
      for (const e of ev.episodes) for (const r of e.rewards) expect(ITEMS[r.id]).toBeTruthy();
    }
  });
});

describe('Halloween episodes (story limits)', () => {
  const ev = ALL_EVENTS.find((e) => e.id === 'halloween-2026');
  const spoken = (sc) => sc.lines.filter((l) => l.t === 'say' || l.t === 'narrate').length;

  it('every episode meta has a scene and vice versa', () => {
    expect(HALLOWEEN_SCENES.map((s) => s.id).sort()).toEqual(ev.episodes.map((e) => e.id).sort());
  });

  it('scenes fit the story limits: lines, spoken count, one choice, ≤ 4 portraits, titles', () => {
    for (const sc of HALLOWEEN_SCENES) {
      expect(sc.kind).toBe('event');
      expect(sc.title.length).toBeLessThanOrEqual(LIMITS.titleChars);
      expect(spoken(sc)).toBeGreaterThanOrEqual(LIMITS.spokenMin);
      expect(spoken(sc)).toBeLessThanOrEqual(LIMITS.spokenMax);
      expect(sc.lines.filter((l) => l.t === 'choice').length).toBeLessThanOrEqual(1);
      expect(sc.cast.length).toBeLessThanOrEqual(LIMITS.portraitsMax);
      for (const c of sc.cast) expect(UNIT_MAP[c], `${sc.id} cast ${c}`).toBeTruthy();
      const lines = sc.lines.flatMap((l) => (l.t === 'choice' ? [...l.options.map((o) => ({ text: o.text, choice: true })), ...l.options.flatMap((o) => o.lines)] : [l]));
      for (const l of lines) {
        if (!l.text) continue;
        expect(l.text.length, l.text).toBeLessThanOrEqual(l.choice ? LIMITS.choiceChars : LIMITS.lineChars);
        expect(l.text).not.toMatch(/\b(kill|killed|die|dead|death|blood|kiss|date|romantic)\b/i);
        if (l.face) expect(FACE_IDS).toContain(l.face);
        if (l.t === 'say' && !['narrator', 'sensei'].includes(l.who)) expect(UNIT_MAP[l.who] || ENEMY_MAP[l.who], l.who).toBeTruthy();
      }
    }
  });

  it('HW-5 copy shown outside the scene player: story tokens resolve, and the event page resolves the intro', () => {
    for (const ev of ALL_EVENTS) {
      const intro = ev.intro?.body || '';
      expect(tokenProblems(intro), ev.id).toEqual([]);
      expect(resolveText(intro)).not.toMatch(/[{}]/);
      // plain-text copy the UI shows as is: no story tokens at all ({n} / {coins} are mail fill-ins)
      const plain = [ev.name, ev.subtitle, ...(ev.notice?.body || []), ...Object.values(ev.mail || {}).flatMap((m) => (typeof m === 'object' ? [m.title, m.body, m.lateBody] : [])),
        ...[...(ev.missions?.daily || []), ...(ev.missions?.total || [])].flatMap((m) => [m.name, m.desc])].filter(Boolean);
      for (const t of plain) expect(t.match(TOKEN_RE), t).toBe(null);
    }
    expect(resolveText(EVENT_MAP_INTRO())).toContain(UNIT_MAP.hikari.name);
    const screen = readFileSync(new URL('../../src/ui/screens/event.js', import.meta.url), 'utf8');
    expect(screen).toMatch(/resolveText\(ev\.intro\?\.body/);
  });
});

