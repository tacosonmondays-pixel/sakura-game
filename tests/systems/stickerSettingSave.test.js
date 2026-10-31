// "Show stickers from other players" off survives an older build (v0.1.67 go/no-go, LOW): a build from before
// stickers drops the setting it does not know, so the 'stk:off' mark in missions.counters (which every build keeps word
// for word) puts it back off (src/systems/stickers.js writeStickerMark / restoredShowStickers).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { STICKERS_OFF_MARK } from '../../src/systems/stickers.js';
// The real older build: origin/main 60ce9cad's save.js and its data, vendored under tests/fixtures (it has no
// sticker setting). (static imports: a path built at runtime is beyond vite's import analysis)
import * as oldSave from '../fixtures/main-60ce9cad/src/systems/save.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
/** This build's stored save (saveText: the marks ride every write), as the JSON object an older tab reads. */
const stored = (p) => {
  const t = saveText(p, 1);
  return JSON.parse(t);
};
/** An older build's tab loads the stored save and writes it back (its own cleaner, no sticker marks). */
const oldBuild = (raw) => clone(oldSave.migrateProfile(clone(raw)));

describe('the sticker setting survives an older build', () => {
  it('off: the older build drops the key, the mark brings it back off', () => {
    const p = createProfile();
    p.settings.showStickers = false;
    const raw = stored(p);
    expect(raw.missions.counters[STICKERS_OFF_MARK]).toBe(1);
    const old = oldBuild(raw);
    expect('showStickers' in old.settings).toBe(false); // the older build does not know the setting
    expect(old.missions.counters[STICKERS_OFF_MARK]).toBe(1); // but keeps the counter
    const back = migrateProfile(old);
    expect(back.settings.showStickers).toBe(false);
    expect(back.missions.counters[STICKERS_OFF_MARK]).toBe(1);
  });

  it('on (the default): no mark, and an older build changes nothing', () => {
    const p = createProfile();
    const raw = stored(p);
    expect(STICKERS_OFF_MARK in raw.missions.counters).toBe(false);
    expect(migrateProfile(oldBuild(raw)).settings.showStickers).toBe(true);
  });

  it('turned back on in this build: the mark goes on the next save, and the setting stays on', () => {
    const p = createProfile();
    p.settings.showStickers = false;
    const once = migrateProfile(stored(p));
    once.settings.showStickers = true;
    const raw = stored(once);
    expect(STICKERS_OFF_MARK in raw.missions.counters).toBe(false);
    expect(migrateProfile(oldBuild(raw)).settings.showStickers).toBe(true);
  });

  it('a save that has the setting keeps it, whatever the mark says', () => {
    const p = createProfile();
    const raw = clone(p);
    raw.missions.counters[STICKERS_OFF_MARK] = 1; // a stale mark
    raw.settings.showStickers = true;
    const back = migrateProfile(raw);
    expect(back.settings.showStickers).toBe(true);
    expect(STICKERS_OFF_MARK in back.missions.counters).toBe(false); // the mark follows the setting
  });

  it('a junk mark does not turn stickers off', () => {
    const raw = clone(createProfile());
    delete raw.settings.showStickers;
    raw.missions.counters[STICKERS_OFF_MARK] = 0;
    expect(migrateProfile(raw).settings.showStickers).toBe(true);
  });
});
