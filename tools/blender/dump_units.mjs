// Writes the unit roster (id, name, kind, adult, rarity, palette, look) as JSON for the
// Blender pipeline. Usage: node tools/blender/dump_units.mjs <out.json>
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const { UNITS } = await import(path.join(here, '..', '..', 'src', 'data', 'units.js'));
const out = UNITS.map((u) => ({
  id: u.id, name: u.name, title: u.title, kind: u.kind, adult: !!u.adult, rarity: u.rarity, role: u.role,
  palette: u.palette, look: u.look,
}));
const target = process.argv[2] || path.join(here, 'units.json');
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} units to ${target}`);
