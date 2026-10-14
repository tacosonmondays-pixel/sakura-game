import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createUpdateChecker, isChunkLoadError, MIN_GAP_MS } from '../../src/core/updates.js';
import { compareVersions, versionLabel, buildLine } from '../../src/core/buildInfo.js';
import { sameVersion, coopVersion } from '../../src/online/coop/version.js';
import { simId } from '../../tools/simId.mjs';

const reply = (body, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

describe('update checker (version.json)', () => {
  it('reports a different deployed build once, and only that build', async () => {
    let t = 0;
    let body = { version: '0.1.17', build: 'aaa', sim: 's1' };
    const calls = [];
    const c = createUpdateChecker({ build: 'aaa', now: () => t, url: () => 'version.json', fetchImpl: (u, o) => { calls.push(o); return reply(body); } });
    const seen = [];
    c.onUpdate((i) => seen.push(i.build));
    expect(await c.check()).toBe(null); // same build
    expect(calls[0]).toEqual({ cache: 'no-store' });
    body = { version: '0.1.18', build: 'bbb', sim: 's1' };
    expect(await c.check()).toBe(null); // throttled: nothing new fetched yet
    expect((await c.check({ force: true })).build).toBe('bbb');
    t += MIN_GAP_MS + 1;
    expect((await c.check()).version).toBe('0.1.18'); // seen again: not announced twice
    expect(c.available().build).toBe('bbb');
    expect(seen).toEqual(['bbb']); // announced once
  });

  it('keeps quiet when offline, on bad JSON, or when disabled', async () => {
    const off = createUpdateChecker({ build: 'a', url: () => 'v', fetchImpl: () => Promise.reject(new Error('offline')) });
    expect(await off.check({ force: true })).toBe(null);
    const bad = createUpdateChecker({ build: 'a', url: () => 'v', fetchImpl: () => reply({ nope: 1 }) });
    expect(await bad.check({ force: true })).toBe(null);
    const notOk = createUpdateChecker({ build: 'a', url: () => 'v', fetchImpl: () => reply({ build: 'b' }, false) });
    expect(await notOk.check({ force: true })).toBe(null);
    let fetched = false;
    const disabled = createUpdateChecker({ enabled: false, build: 'a', url: () => 'v', fetchImpl: () => { fetched = true; return reply({ build: 'b' }); } });
    expect(await disabled.check({ force: true })).toBe(null);
    expect(fetched).toBe(false);
  });

  it('recognises the browsers\' "screen file is gone" errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/clan-abc.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('player-facing version', () => {
  it('compares deploy numbers numerically', () => {
    expect(compareVersions('0.1.9', '0.1.17')).toBe(-1);
    expect(compareVersions('0.1.17', '0.1.9')).toBe(1);
    expect(compareVersions('0.1.17', '0.1.17')).toBe(0);
    expect(compareVersions('0.2.1', '0.1.99')).toBe(1);
    expect(compareVersions('0.1.dev', '0.1.17')).toBe(null);
    expect(compareVersions(null, '0.1.17')).toBe(null);
  });
  it('labels', () => {
    expect(versionLabel('0.1.17')).toBe('v0.1.17');
    expect(buildLine()).toMatch(/^Version \S+ · build \S+/);
  });
});

describe('co-op compatibility', () => {
  const base = { proto: 2, build: 'aaa', sim: 'sim1', data: 'd1', label: '0.1.17' };
  it('pairs builds that only differ outside the sim (art, audio, menus)', () => {
    expect(sameVersion(base, { ...base, build: 'bbb', label: '0.1.18' })).toBe(true);
  });
  it('refuses a different sim, data or protocol', () => {
    expect(sameVersion(base, { ...base, build: 'bbb', sim: 'sim2' })).toBe(false);
    expect(sameVersion(base, { ...base, data: 'd2' })).toBe(false);
    expect(sameVersion(base, { ...base, proto: 3 })).toBe(false);
    expect(sameVersion(base, null)).toBe(false);
  });
  it('falls back to the exact build with clients from before sim ids', () => {
    const old = { proto: 2, build: 'aaa', data: 'd1' };
    expect(sameVersion(base, old)).toBe(true);
    expect(sameVersion(base, { ...old, build: 'zzz' })).toBe(false);
    expect(sameVersion({ ...base, sim: 'dev' }, { ...base, sim: 'dev', build: 'x' })).toBe(false);
  });
  it('this build sends a sim id and its version label', () => {
    const v = coopVersion();
    expect(v.sim).toMatch(/^[0-9a-f]{12}$|^dev$/);
    expect(typeof v.label).toBe('string');
    expect(sameVersion(v, { ...v })).toBe(true);
  });
});

describe('tools/simId.mjs', () => {
  it('hashes the import graph from the entry folders, ignoring files outside it', () => {
    const root = mkdtempSync(join(tmpdir(), 'simid-'));
    mkdirSync(join(root, 'src/sim'), { recursive: true });
    mkdirSync(join(root, 'src/data'), { recursive: true });
    mkdirSync(join(root, 'src/ui'), { recursive: true });
    writeFileSync(join(root, 'src/sim/Sim.js'), "import { A } from '../data/a.js';\nconst M = import.meta.glob(['../data/b.js'], { eager: true });\n");
    writeFileSync(join(root, 'src/data/a.js'), 'export const A = 1;\n');
    writeFileSync(join(root, 'src/data/b.js'), 'export const B = 1;\n');
    writeFileSync(join(root, 'src/ui/menu.js'), 'export const MENU = 1;\n');
    const one = simId(root, ['src/sim']);
    expect(one.files).toEqual(['src/data/a.js', 'src/data/b.js', 'src/sim/Sim.js']);
    writeFileSync(join(root, 'src/ui/menu.js'), 'export const MENU = 2;\n'); // a menu change
    expect(simId(root, ['src/sim']).id).toBe(one.id);
    writeFileSync(join(root, 'src/data/b.js'), 'export const B = 2;\n'); // a sim-data change
    expect(simId(root, ['src/sim']).id).not.toBe(one.id);
  });

  it('covers the real sim, co-op and adapter code but not menus, art, audio or the renderer', () => {
    const { files } = simId();
    for (const f of ['src/sim/Sim.js', 'src/online/coop/lockstep.js', 'src/online/coop/commands.js', 'src/data/units.js', 'src/data/maps.js', 'src/online/adapters/supabase.js']) expect(files).toContain(f);
    expect(files.some((f) => f.startsWith('src/render/') || f.startsWith('src/audio/') || f.startsWith('src/art/') || f.startsWith('src/ui/screens/'))).toBe(false);
  });
});

describe('stale-chunk reload decision', async () => {
  const { shouldReloadForStaleChunk } = await import('../../src/core/updates.js');
  const base = { deployed: true, chunkError: true, recently: false, online: true, currentV: null, build: 'aaa' };
  it('reloads only into a confirmed newer build', () => {
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' } })).toBe(true);
  });
  it('never reloads offline, on the same build, without a version answer, twice, or right after a reload', () => {
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' }, online: false })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'aaa' } })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: null })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' }, currentV: 'bbb' })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' }, recently: true })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' }, chunkError: false })).toBe(false);
    expect(shouldReloadForStaleChunk({ ...base, info: { build: 'bbb' }, deployed: false })).toBe(false);
  });
});
