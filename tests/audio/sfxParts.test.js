// SFX part sprites (FX-1): a part file is laid into the one SFX buffer at its start (src/audio/sfx.js stitch),
// and the battle mapping plays the new attack sounds.
import { describe, test, expect } from 'vitest';
import { stitch } from '../../src/audio/sfx.js';
import { battleSfx } from '../../src/audio/battle.js';

/** A tiny stand-in for AudioBuffer / createBuffer. */
function buf(data, sampleRate = 32000) {
  const ch = [Float32Array.from(data)];
  return { sampleRate, length: ch[0].length, numberOfChannels: 1, getChannelData: (c) => ch[c] };
}
const ctx = { createBuffer: (n, len, sr) => buf(new Array(len).fill(0), sr) };

describe('stitch', () => {
  test('copies the main sprite at 0 and each part at its start', () => {
    const main = buf([1, 2, 3, 4]);
    const part = buf([7, 8]);
    const out = stitch(ctx, main, [[{ start: 6, length: 2 }, part]], 32000);
    expect([...out.getChannelData(0)]).toEqual([1, 2, 3, 4, 0, 0, 7, 8]);
  });

  test('converts the start to the decoded rate (a decoder at another rate)', () => {
    const main = buf([1, 1, 1, 1], 64000);
    const part = buf([5, 6], 64000);
    const out = stitch(ctx, main, [[{ start: 3, length: 1 }, part]], 32000);
    expect(out.length).toBe(8);
    expect(out.getChannelData(0)[6]).toBe(5);
  });

  test('without createBuffer the main sprite is kept', () => {
    const main = buf([1]);
    expect(stitch(null, main, [[{ start: 3 }, buf([2])]], 32000)).toBe(main);
  });
});

describe('attack sounds', () => {
  const ids = (evs) => battleSfx(evs, {}).map((s) => s.id);
  test("the silent kinds sound now: Marumi's roll and lob, Azami's strip, Suzu's toss", () => {
    expect(ids([{ type: 'attack', kind: 'roll', towerUid: 1 }])).toEqual(['fire.roll']);
    expect(ids([{ type: 'attack', kind: 'lob', towerUid: 1 }])).toEqual(['fire.lob']);
    expect(ids([{ type: 'attack', kind: 'strip', towerUid: 1 }])).toEqual(['fire.strip']);
    expect(ids([{ type: 'attack', kind: 'trap', towerUid: 1 }])).toEqual(['fire.trap']);
  });

  test('a strip bites with a snap; pins clatter; a sentry clunks open and whirrs shut', () => {
    expect(ids([{ type: 'trapTriggered', strip: true, x: 1 }])).toEqual(['strip.snap']);
    expect(ids([{ type: 'trapTriggered', x: 1 }])).toEqual(['trap.trigger']);
    expect(ids([{ type: 'pins', x: 2 }])).toEqual(['pins.clatter']);
    // the sim's sentry deploy event: its `type` is the sentry type
    expect(ids([{ type: 'heavy', kind: 'sentry', uid: 9, towerUid: 3, x: 1, y: 1 }])).toEqual(['sentry.deploy']);
    expect(ids([{ type: 'deployEnd', uid: 9, x: 1 }])).toEqual(['sentry.fold']);
    expect(ids([{ type: 'deployEnd', uid: 9, x: 1, burst: true }])).toEqual([]);
  });
});
