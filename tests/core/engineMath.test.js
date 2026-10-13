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
});
