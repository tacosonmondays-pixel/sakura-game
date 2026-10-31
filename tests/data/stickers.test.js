// Stickers (docs/specs/STICKERS.md): the table, who owns what, the chat line token, and the art on disk.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { STICKERS, STICKER_MAP, STICKER_ID_RE, STICKER_LIMITS, stickerHint, stickerAlt } from '../../src/data/stickers.js';
import { ownedStickers, ownsSticker, showsStickers } from '../../src/systems/stickers.js';
import { stickerLine, lineSticker, cleanStickerMsg, createStickerLimiter } from '../../src/online/stickerWire.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { dmToastText } from '../../src/ui/online/socialHub.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { createProfile as newProfile, migrateProfile, DEFAULT_SETTINGS } from '../../src/systems/save.js';

// the settings as a save load cleans them
const cleanSettings = (settings) => migrateProfile({ ...newProfile(), settings }).settings;

describe('the sticker table', () => {
  it('has 16 stickers with unique, wire-safe ids and short words', () => {
    expect(STICKERS).toHaveLength(16);
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(16);
    for (const s of STICKERS) {
      expect(STICKER_ID_RE.test(s.id), s.id).toBe(true);
      expect(s.label.length, s.id).toBeLessThanOrEqual(12);
      expect(stickerHint(s), s.id).not.toBe('');
      expect(stickerAlt(s)).toBe(`${s.who} sticker: ${s.label}`);
    }
  });

  it('a free starter set of 4, one per girl for 10 girls, two earned', () => {
    const by = (how) => STICKERS.filter((s) => s.how === how);
    expect(by('starter')).toHaveLength(4);
    expect(by('girl')).toHaveLength(10);
    expect(by('coop').length + by('event').length).toBe(2);
    for (const s of by('girl')) expect(UNIT_MAP[s.girl]?.name, s.id).toBe(s.who);
    for (const s of by('event')) expect(STAGE_MAP[s.stage], s.id).toBeTruthy();
  });

  it('kid-safe words: nothing mocks a player', () => {
    const BANNED = /noob|loser|slow|stupid|dumb|ugly|bad|lol|ez\b|easy|cute|sexy|kill/i;
    for (const s of STICKERS) expect(BANNED.test(s.label), s.label).toBe(false);
  });

  it('every sticker has its 256 and 128 px art', () => {
    for (const s of STICKERS) {
      for (const px of [256, 128]) {
        const f = `public/art/stickers/${s.id}-${px}.webp`;
        expect(existsSync(f), f).toBe(true);
        const b = readFileSync(f);
        expect(b.subarray(0, 4).toString('latin1') + b.subarray(8, 12).toString('latin1'), f).toBe('RIFFWEBP');
      }
    }
  });

  it('a rate limit of one per 2 s, five per 20 s, shown 3 s', () => {
    expect(STICKER_LIMITS).toEqual({ gapMs: 2000, burst: 5, windowMs: 20000, showMs: 3000 });
  });
});

describe('who owns which sticker', () => {
  it('a new save has the starter set and its starter girls\' stickers', () => {
    const p = newProfile();
    expect(ownedStickers(p)).toEqual(['slime_hi', 'slime_thanks', 'slime_oops', 'slime_gg', 'hikari_go', 'aoi_nice']);
  });

  it('owning a girl, a co-op win and the Halloween boss each unlock theirs (from what the save already keeps)', () => {
    const p = newProfile();
    p.units.tenka = { level: 1 };
    expect(ownsSticker(p, 'tenka_charge')).toBe(true);
    expect(ownsSticker(p, 'chigusa_bravo')).toBe(false);
    p.missions.counters.coopWin = 1;
    expect(ownsSticker(p, 'chigusa_bravo')).toBe(true);
    expect(ownsSticker(p, 'hotaru_boo')).toBe(false);
    p.progress.stages['ev-halloween-boss'] = { easy: true };
    expect(ownsSticker(p, 'hotaru_boo')).toBe(true);
  });

  it('unknown ids and broken saves own nothing but the starters', () => {
    expect(ownsSticker(newProfile(), 'not_a_sticker')).toBe(false);
    expect(ownedStickers(null)).toEqual(['slime_hi', 'slime_thanks', 'slime_oops', 'slime_gg']);
    expect(ownedStickers({ units: [], missions: { counters: { coopWin: 'x' } }, progress: { stages: { 'ev-halloween-boss': 'yes' } } }))
      .toEqual(['slime_hi', 'slime_thanks', 'slime_oops', 'slime_gg']);
  });

  it('the "show stickers from other players" setting: on by default, kept by the save cleaner', () => {
    expect(DEFAULT_SETTINGS.showStickers).toBe(true);
    expect(showsStickers(newProfile())).toBe(true);
    expect(cleanSettings({}).showStickers).toBe(true); // an older save
    expect(cleanSettings({ showStickers: false }).showStickers).toBe(false);
    expect(cleanSettings({ showStickers: 'no' }).showStickers).toBe(true);
    expect(showsStickers({ settings: { showStickers: false } })).toBe(false);
  });
});

describe('stickers on the wire', () => {
  it('a chat line carries only an id; a build that does not know the id shows the line as text', () => {
    expect(stickerLine('aoi_nice')).toBe('[sticker:aoi_nice] Nice!');
    expect(stickerLine('nope')).toBe(null);
    for (const s of STICKERS) expect(lineSticker(stickerLine(s.id))).toBe(STICKER_MAP[s.id]);
    expect(lineSticker('[sticker:aoi_nice] other words')).toBe(null); // other words stay text, as an older build shows them
    expect(dmToastText('[sticker:slime_hi] Hi!')).toBe('Sticker: Hi!'); // the DM pop-up never shows the token
    expect(dmToastText('hello')).toBe('hello');
    expect(lineSticker('[sticker:future_one] Hi!')).toBe(null);
    expect(lineSticker('hello [sticker:aoi_nice] Nice!')).toBe(null);
    expect(lineSticker('[sticker:aoi_nice]')).toBe(null);
    expect(lineSticker(null)).toBe(null);
    expect(lineSticker('[sticker:__proto__] x')).toBe(null);
    expect(lineSticker('[sticker:constructor] x')).toBe(null);
  });

  it('a co-op message is cleaned to a known id and a sender, nothing else', () => {
    expect(cleanStickerMsg({ type: 'stk', uid: 'u1', id: 'aoi_nice', n: 3, text: 'hi' })).toEqual({ uid: 'u1', id: 'aoi_nice', n: 3 });
    expect(cleanStickerMsg({ type: 'stk', uid: 'u1', id: 'aoi_nice', n: -1 })).toEqual({ uid: 'u1', id: 'aoi_nice', n: 0 });
    expect(cleanStickerMsg({ type: 'stk', uid: 'u1', id: 'toString' })).toBe(null);
    expect(cleanStickerMsg({ type: 'stk', uid: 'u1', id: 'unknown_id' })).toBe(null);
    expect(cleanStickerMsg({ type: 'stk', uid: '', id: 'aoi_nice' })).toBe(null);
    expect(cleanStickerMsg({ type: 'stk', uid: 7, id: 'aoi_nice' })).toBe(null);
    expect(cleanStickerMsg({ type: 'hello', uid: 'u1', id: 'aoi_nice' })).toBe(null);
    expect(cleanStickerMsg(null)).toBe(null);
  });

  it('the limiter: one per 2 s, five per 20 s', () => {
    const l = createStickerLimiter();
    expect(l.take(0)).toBe(true);
    expect(l.take(1999)).toBe(false);
    expect(l.wait(1000)).toBe(1000);
    for (const t of [2000, 4000, 6000, 8000]) expect(l.take(t)).toBe(true);
    expect(l.take(10000)).toBe(false);
    expect(l.wait(10000)).toBe(10000);
    expect(l.take(20000)).toBe(true);
  });
});
