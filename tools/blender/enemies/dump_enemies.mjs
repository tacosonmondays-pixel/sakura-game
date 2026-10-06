// Writes the bestiary (id, family, tier, size, colours, model hints, trait keys) as JSON for
// the Blender enemy pipeline. Usage: node tools/blender/enemies/dump_enemies.mjs <out.json>
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const { ENEMIES, FAMILY_ORDER } = await import(path.join(here, '..', '..', '..', 'src', 'data', 'enemies.js'));
const out = {
  families: FAMILY_ORDER,
  enemies: ENEMIES.map((e) => ({
    id: e.id, name: e.name, family: e.family, tier: e.tier, size: e.size, armor: e.armor,
    color: e.color, accent: e.accent, model: e.model, traits: Object.keys(e.traits || {}),
    phaseTraits: (e.phases || []).flatMap((p) => Object.keys(p.set?.traits || {})),
  })),
};
const target = process.argv[2] || path.join(here, 'enemies.json');
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`wrote ${out.enemies.length} enemies to ${target}`);
