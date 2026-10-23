// Writes every key the item art covers as JSON for the Blender item pipeline: the item ids
// (src/data/items.js), the gear pieces drawn by gearIcon and Recruit Points (currencyIcon).
// Usage: node tools/blender/items/dump_items.mjs <out.json>
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => pathToFileURL(path.join(here, '..', '..', '..', 'src', p)).href;
const { ITEMS, ITEM_IDS } = await import(src('data/items.js'));
const { GEAR_SLOTS, ITEM_RARITY_ORDER } = await import(src('data/types.js'));

const out = ITEM_IDS.map((id) => {
  const it = ITEMS[id];
  return {
    key: id, kind: 'item', name: it.name, category: it.category, rarity: it.rarity, family: it.family || '',
    tier: it.tier || '', display: it.display || '', rainbow: !!it.rainbow,
  };
});
for (const slot of Object.keys(GEAR_SLOTS)) {
  for (const r of ITEM_RARITY_ORDER) {
    out.push({ key: `gear_${slot}_${r}`, kind: 'gear', name: `${GEAR_SLOTS[slot].name} (${r})`, category: 'gear', rarity: r, family: slot, tier: '', display: '', rainbow: false });
  }
  out.push({ key: `gear_${slot}_ur`, kind: 'gear', name: `${GEAR_SLOTS[slot].name} (UR)`, category: 'gear', rarity: 'legendary', family: slot, tier: '', display: 'ur', rainbow: true });
}
out.push({ key: 'recruitPoints', kind: 'currency', name: 'Recruit Points', category: 'currency', rarity: 'superRare', family: '', tier: '', display: '', rainbow: false });

const target = process.argv[2] || path.join(here, 'items.json');
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} item art keys to ${target}`);
