// The co-op lobby only pairs two players whose battle data hashes the same (src/online/coop/
// version.js). The maps' road samples are computed when the game loads, so they must not depend
// on the engine's own Math.sin / cos / hypot …, which differ in the last bit between Chrome (V8)
// and iPhone Safari (JavaScriptCore) — that split once kept a Chrome and a Safari player apart.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FNS = ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'hypot', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'];
const saved = Object.fromEntries(FNS.map((k) => [k, Math[k]]));

/** Every transcendental result moved by one ulp: "another engine". */
function otherEngine() {
  for (const k of FNS) {
    const f = saved[k];
    Math[k] = (...a) => {
      const r = f(...a);
      if (!Number.isFinite(r) || r === 0) return r;
      const b = new Float64Array([r]);
      const u = new BigUint64Array(b.buffer);
      u[0] += 1n;
      return b[0];
    };
  }
}

afterEach(() => {
  Object.assign(Math, saved);
  vi.resetModules();
});

const lobbyData = async () => (await import('../../src/online/coop/version.js')).coopVersion().data;

describe('battle data is the same on every JS engine', () => {
  it('the co-op lobby hash does not change when the engine\'s Math does', async () => {
    vi.resetModules();
    const here = await lobbyData();
    vi.resetModules();
    otherEngine();
    const there = await lobbyData();
    expect(there).toBe(here);
  });

  it('the map builder and the data files call no engine-dependent Math (use core/detMath.js)', () => {
    const files = ['src/core/track.js', ...readdirSync('src/data').filter((f) => f.endsWith('.js')).map((f) => join('src/data', f))];
    const bad = [];
    const re = new RegExp(`Math\\.(${FNS.join('|')})\\(`);
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        // `**` (engine pow) is fine where the result is rounded to a few decimals at once
        // (stages.js HP / cash / growth scales); geometry keeps full precision, so not there
        const geometry = f.endsWith('track.js') || f.endsWith('maps.js');
        if (re.test(code) || (geometry && /[\w)\]]\s*\*\*\s*[\w(]/.test(code))) bad.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('the sim raises to a power only as squares (x ** 2 === x * x everywhere) or through powInt', () => {
    const bad = [];
    for (const f of readdirSync('src/sim').filter((x) => x.endsWith('.js')).map((x) => join('src/sim', x))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\*|\/\*)/.test(line)) return; // JSDoc / block comments
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        for (const m of code.matchAll(/[\w)\]]\s*\*\*\s*([\w(.]+)/g)) if (m[1] !== '2') bad.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('powInt: whole powers by square-and-multiply (what JavaScriptCore and SpiderMonkey do for **)', async () => {
    const { powInt, waveHpRamp } = await import('../../src/sim/waves.js');
    expect(powInt(1.3, 0)).toBe(1);
    expect(powInt(2, 10)).toBe(1024);
    expect(powInt(1.07, 1)).toBe(1.07);
    const b2 = 1.201 * 1.201;
    expect(powInt(1.201, 3)).toBe(1.201 * b2); // r = b, then r *= b²
    const c2 = 1.07 * 1.07;
    const c4 = c2 * c2;
    expect(powInt(1.07, 5)).toBe(1.07 * c4);
    expect(powInt(1.07, 13)).toBe(1.07 * c4 * (c4 * c4)); // 13 = 1101b
    // the endless HP ramp and the wave budgets go through it (not the engine's **)
    const { WAVE_HP_RAMP, ENDLESS_HP_GROWTH } = await import('../../src/sim/constants.js');
    expect(waveHpRamp({ waves: 20 }, 33)).toBe((1 + WAVE_HP_RAMP * 32) * powInt(ENDLESS_HP_GROWTH, 13));
  });
});
