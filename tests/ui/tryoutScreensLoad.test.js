// Every named import of the Tryout Day screens and the co-op room exists in the module it names (M4 fix check: a
// missing export broke both screens; Vite's test transform turns a missing import into `undefined` instead of an
// error, so only the build and the browser caught it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const FILES = [
  'src/ui/screens/tryout.js', 'src/ui/screens/tryoutSetup.js', 'src/ui/screens/tryoutJar.js', 'src/ui/screens/tryoutYearbook.js', 'src/ui/screens/coop.js',
  'src/ui/battle/tryout.js', 'src/ui/battle/controller.js', 'src/ui/battle/setup.js', 'src/ui/battle/hud.js',
  'src/ui/battle/tryout/adapters.js', 'src/ui/battle/tryout/timetable.js', 'src/online/coop/rewards.js',
  'src/systems/tryoutRuns.js', 'src/systems/tryoutRewards.js', 'src/systems/tryoutJar.js', 'src/systems/tryoutYearbook.js',
];

describe('Tryout Day modules import only what exists', () => {
  for (const file of FILES) {
    it(file, async () => {
      const src = readFileSync(resolve(file), 'utf8');
      const missing = [];
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
        const path = resolve(dirname(resolve(file)), m[2]);
        if (!path.endsWith('.js')) continue;
        const mod = await import(path);
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (name && !(name in mod)) missing.push(`${name} from ${m[2]}`);
        }
      }
      expect(missing).toEqual([]);
    }, 30000); // (cold module loads under a busy machine: M3 review)
  }
});
