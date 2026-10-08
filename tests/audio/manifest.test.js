// Shipped audio assets: schema, both formats for every stem, budgets, probe files, and every SFX id the
// engine can ask for exists in the sprite (docs/AUDIO.md §2.10, §6.3).
import { describe, test, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { CLICK_TABLE } from '../../src/audio/domSfx.js';
import { CUE_TABLE } from '../../src/audio/cues.js';
import { economyCues } from '../../src/audio/economy.js';
import { battleSfx } from '../../src/audio/battle.js';

const root = new URL('../../public/audio/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const man = read('music/manifest.json');
const sprite = read('sfx/sprite.json');

describe('music manifest', () => {
  test('schema basics', () => {
    expect(man.version).toBe(1);
    expect(man.rate).toBe(32000);
    expect(man.formats.map((f) => f.id)).toEqual(['opus', 'aac']);
    expect(man.probe.clickSample).toBe(3200);
    expect(Object.keys(man.tracks).length).toBeGreaterThan(0);
  });
  test('every stem exists in both formats with the listed size', () => {
    for (const [id, t] of Object.entries(man.tracks)) {
      expect(['loop', 'oneshot']).toContain(t.kind);
      expect(Object.keys(t.stems).length, id).toBeGreaterThan(0);
      for (const st of Object.values(t.stems)) {
        for (const f of man.formats) {
          const p = new URL(`music/${st.file}.${f.ext}`, root);
          expect(existsSync(p), p.pathname).toBe(true);
          expect(statSync(p).size).toBe(st.bytes[f.id]);
        }
      }
    }
  });
  test('loudness and gates recorded by the toolkit', () => {
    for (const [id, t] of Object.entries(man.tracks)) {
      expect(t.truePeak, id).toBeLessThanOrEqual(-0.95);
      if (t.kind === 'loop') {
        expect(Math.abs(t.lufs + 16), id).toBeLessThanOrEqual(0.5);
        expect(t.checks.wavSeamDb, id).toBeLessThan(-60);
        for (const f of ['opus', 'aac']) {
          expect(t.checks[f].lag, `${id} ${f}`).toBe(0);
          expect(t.checks[f].click, `${id} ${f}`).toBeLessThan(3);
        }
      }
    }
  });
  test('budget: Opus ≤ 11 MB, AAC ≤ 13 MB, both ≤ 25 MB', () => {
    expect(man.bytes.opus).toBeLessThanOrEqual(11_000_000);
    expect(man.bytes.aac).toBeLessThanOrEqual(13_000_000);
    expect(man.bytes.opus + man.bytes.aac).toBeLessThanOrEqual(25_000_000);
  });
  test('stand-ins point at shipped tracks', () => {
    for (const [k, v] of Object.entries(man.standIns || {})) expect(man.tracks[v], k).toBeTruthy();
  });
  test('probe files exist and are tiny', () => {
    for (const ext of ['webm', 'm4a']) {
      const s = statSync(new URL(`probe.${ext}`, root)).size;
      expect(s).toBeGreaterThan(200);
      expect(s).toBeLessThan(4096);
    }
  });
});

describe('sfx sprite', () => {
  test('schema, sizes and non-overlapping sounds', () => {
    expect(sprite.rate).toBe(32000);
    const list = Object.entries(sprite.sounds).sort((a, b) => a[1].start - b[1].start);
    expect(list.length).toBeGreaterThanOrEqual(84);
    for (let i = 1; i < list.length; i++) expect(list[i][1].start).toBeGreaterThanOrEqual(list[i - 1][1].start + list[i - 1][1].length + 2048);
    for (const [, s] of list) {
      expect(['ui', 'battle']).toContain(s.bus);
      expect(s.voices).toBeGreaterThanOrEqual(1);
      expect(s.start + s.length).toBeLessThanOrEqual(sprite.length);
    }
    for (const f of Object.values(sprite.files)) expect(statSync(new URL(`sfx/${f}`, root)).size).toBeLessThanOrEqual(300_000);
  });

  test('every SFX id the engine can request exists', () => {
    const ids = new Set();
    for (const [, id] of CLICK_TABLE) ids.add(id);
    ['ui.deny', 'ui.tick', 'ui.toast', 'ui.modalOpen', 'ui.modalClose', 'ui.toggle', 'ui.select', 'bt.deny', 'en.new', 'bt.lowLives',
      'gacha.envelope', 'gacha.open', 'gacha.flipR', 'gacha.flipSR', 'gacha.flipSSR', 'gacha.results', 'ui.confirm'].forEach((x) => ids.add(x));
    const snap = { coins: 1, gems: 1, items: 1, gearCount: 1, gearLevels: 1 };
    const more = { coins: 9, gems: 9, items: 9, gearCount: 2, gearLevels: 3 };
    for (const r of ['breakthrough', 'gear-enhance', 'gear-reroll', 'gear-equip', 'gear-unequip', 'gear-lock', 'shop', 'sweep', 'gearbox-open',
      'gear-salvage', 'formation', 'secretary', 'missions', 'achievements', 'login', 'redeem']) {
      for (const a of economyCues(snap, more, r)) if (a.sfx) ids.add(a.sfx);
    }
    const kinds = ['arrow', 'needle', 'bullet', 'shell', 'fireball', 'shuriken', 'orb', 'flask', 'spark', 'bolt', 'slash', 'pulse', 'beam', 'chain', 'build'];
    const evts = [
      ...kinds.map((kind, i) => ({ type: 'attack', kind, towerUid: i })),
      ...['pierce', 'slash', 'mystic', 'holy'].map((attackType) => ({ type: 'hit', attackType, amount: 5 })),
      { type: 'hit', attackType: 'pierce', crit: true }, { type: 'hit', attackType: 'slash', effective: 0.5 },
      { type: 'explode', radius: 1 }, { type: 'explode', radius: 2 }, { type: 'explode', radius: 1.5, volatile: true },
      ...['freeze', 'burn', 'poison', 'shock', 'stun', 'slow', 'reveal', 'silence', 'mark', 'shred', 'soak'].map((status) => ({ type: 'status', status })),
      { type: 'barrierBreak' }, { type: 'shellBreak' }, { type: 'death', id: 'a' }, { type: 'death', id: 'elite' }, { type: 'death', id: 'boss' },
      { type: 'split' }, { type: 'blink' }, { type: 'teleportWarn' }, { type: 'phase', on: true }, { type: 'sabotage' },
      { type: 'leak', id: 'a' }, { type: 'leak', id: 'elite' }, { type: 'place', towerUid: 1 }, { type: 'place', towerUid: 99 },
      { type: 'upgrade', tier: 1 }, { type: 'upgrade', tier: 3 }, { type: 'upgrade', tier: 5 }, { type: 'sell' }, { type: 'trapPlaced' },
      { type: 'trapTriggered' }, { type: 'heroLevel' }, { type: 'ult' }, { type: 'waveEnd' }, { type: 'bossPhase' }, { type: 'cash', reason: 'income' },
    ];
    const defs = { a: { tier: 'normal' }, elite: { tier: 'elite' }, boss: { tier: 'boss' } };
    // one event per frame so the per-frame caps do not hide any id
    for (const ev of evts) for (const s of battleSfx([ev], { enemyDef: (id) => defs[id], isHero: (u) => u === 99 })) ids.add(s.id);
    expect(ids.size).toBeGreaterThan(70);
    const missing = [...ids].filter((id) => !sprite.sounds[id]);
    expect(missing).toEqual([]);
    // cue table entries are callable
    for (const fn of Object.values(CUE_TABLE)) expect(typeof fn).toBe('function');
  });
});
