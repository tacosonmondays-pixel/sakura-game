import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS } from '../../src/data/units.js';
import { ENEMIES, FAMILY_ORDER } from '../../src/data/enemies.js';

// The Blender generators read the roster through these scripts with plain `node`. They must
// work from any absolute path, including Windows drive paths (D:\...), which import() rejects
// unless they are turned into file:// URLs.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function dump(script) {
  const out = path.join(tmp, `${path.basename(script, '.mjs')}.json`);
  execFileSync(process.execPath, [path.join(root, script), out], { cwd: os.tmpdir(), stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

let tmp;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-dump-'));
});
afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe('Blender roster dumps', () => {
  test('dump_units.mjs writes every unit with palette and look', () => {
    const units = dump('tools/blender/dump_units.mjs');
    expect(units.map((u) => u.id)).toEqual(UNITS.map((u) => u.id));
    for (const u of units) {
      expect(u.palette, u.id).toBeTruthy();
      expect(u.look, u.id).toBeTruthy();
    }
  });

  test('enemies/dump_enemies.mjs writes every enemy and the family order', () => {
    const data = dump('tools/blender/enemies/dump_enemies.mjs');
    expect(data.families).toEqual(FAMILY_ORDER);
    expect(data.enemies.map((e) => e.id)).toEqual(ENEMIES.map((e) => e.id));
    expect(data.enemies.every((e) => e.model && Array.isArray(e.traits))).toBe(true);
  });
});
