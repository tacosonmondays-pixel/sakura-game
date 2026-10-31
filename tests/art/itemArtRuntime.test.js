// The game shows the baked 3D-flat item art (src/art/icons.js over the manifest src/art/itemArt.js): every item id,
// gear piece and currency the game draws maps to its own baked image, the drawn SVG stays under it as the error
// fallback only (a slow load shows a neutral placeholder), small boxes get the small cut, tiles wear their tier's
// plate, and the change is display only (the battle sim id does not move).
import { GEAR_UPDATE_ITEM_IDS } from '../../src/data/gearAwaken.js';
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, ITEM_IDS } from '../../src/data/items.js';
import { GEAR_SLOTS, ITEM_RARITY_ORDER } from '../../src/data/types.js';
import { ITEM_ART, ITEM_ART_SMALL } from '../../src/art/itemArt.js';
import {
  itemIcon, gearIcon, currencyIcon, itemIconSVG, itemArtSVG, itemArtUrl, hasItemArt, gearArtKey, hasItemIcon, preloadSmallItemArt,
} from '../../src/art/icons.js';
import { tileTier } from '../../src/ui/components.js';
import { COOP_PROTOCOL } from '../../src/online/coop/version.js';
import { simId } from '../../tools/simId.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GEAR_KEYS = Object.keys(GEAR_SLOTS).flatMap((s) => [...ITEM_RARITY_ORDER.map((r) => `gear_${s}_${r}`), `gear_${s}_ur`]);
const CURRENCIES = ['coins', 'gems', 'recruitPoints', 'token_boss', 'token_bounty'];

/** The <img> inside an icon string: { src, srcset, sizes, art } or null. */
function img(markup) {
  const m = /<img ([^>]*)>/.exec(markup);
  if (!m) return null;
  const attr = (name) => (new RegExp(`\\b${name}="([^"]*)"`).exec(m[1]) || [])[1] ?? null;
  return { src: attr('src'), srcset: attr('srcset'), sizes: attr('sizes'), art: attr('data-art'), cls: attr('class'), onerror: attr('onerror') };
}

// The gear update's items (Set Boxes, pins, the Nightglass Lens: docs/specs/GEAR_UPDATE.md §3.3) are baked on
// feature/gear-icons; until it lands they have no source and draw their SVG. Nothing else may fall back.
const ART_PENDING = new Set(GEAR_UPDATE_ITEM_IDS);
const BAKED_IDS = ITEM_IDS.filter((id) => !ART_PENDING.has(id));

describe('item art at runtime: every item has baked art', () => {
  it('every item id has a manifest entry, so no item falls back to the drawing', () => {
    const missing = BAKED_IDS.filter((id) => !hasItemArt(id));
    expect(missing).toEqual([]);
    expect(ITEM_IDS.length).toBe(Object.keys(ITEMS).length);
  });

  it('every gear piece (5 rarities + UR per slot) and every currency icon has baked art', () => {
    expect(GEAR_KEYS.filter((k) => !ITEM_ART[k])).toEqual([]);
    expect(CURRENCIES.filter((k) => !ITEM_ART[k])).toEqual([]);
  });

  it('itemIcon(id) is that item\'s own image over its drawn SVG', () => {
    for (const id of BAKED_IDS) {
      const html = itemIcon(id);
      const i = img(html);
      expect(i, id).not.toBeNull();
      expect(i.art, id).toBe(id);
      expect(i.cls).toBe('item-art');
      expect(i.src, id).toBe(itemArtUrl(id, 128));
      expect(i.src, id).toMatch(new RegExp(`art/items/${id}-128\\.webp\\?v=${ITEM_ART[id]}$`));
      expect(i.srcset, id).toBe(`${itemArtUrl(id, 128)} 128w, ${itemArtUrl(id, 256)} 256w`);
      expect(i.sizes).toBe('64px');
      // the drawing stays inside, under the image: the error fallback
      expect(html.startsWith(`<span class="ia" data-art="${id}">`), id).toBe(true);
      expect(html).toContain(itemIconSVG(id));
      expect(i.onerror).toMatch(/classList\.add\('bad'\);this\.remove\(\)/);
    }
  });

  it('two different items never share an image', () => {
    const srcs = BAKED_IDS.map((id) => img(itemIcon(id)).src);
    expect(new Set(srcs).size).toBe(BAKED_IDS.length);
  });

  it('gearIcon maps slot + rarity (and UR) to the gear keys', () => {
    for (const slot of Object.keys(GEAR_SLOTS)) {
      for (const r of ITEM_RARITY_ORDER) {
        expect(img(gearIcon(slot, r)).art).toBe(`gear_${slot}_${r}`);
        expect(gearArtKey(slot, r)).toBe(`gear_${slot}_${r}`);
      }
      expect(img(gearIcon(slot, 'legendary', { ur: true })).art).toBe(`gear_${slot}_ur`);
      // only a Legendary piece can be the awakened UR piece (the drawn art follows the same rule)
      expect(img(gearIcon(slot, 'rare', { ur: true })).art).toBe(`gear_${slot}_rare`);
    }
    expect(gearArtKey('nope', 'nope')).toBe('gear_charm_common');
  });

  it('currencyIcon maps each currency to its own image, small cut by default (pills, prices, the HUD)', () => {
    for (const k of CURRENCIES) {
      const i = img(currencyIcon(k));
      expect(i.art).toBe(k);
      expect(i.src).toBe(ITEM_ART_SMALL[k] ? itemArtUrl(k, 'small') : itemArtUrl(k, 128));
    }
    expect(img(currencyIcon('nope')).art).toBe('coins');
    expect(img(currencyIcon('gems', { px: 36 })).src).toBe(itemArtUrl('gems', 128));
  });

  it('a box of 24 px or less gets the 96 px small cut when the key has one, the 128/256 pair otherwise', () => {
    for (const k of Object.keys(ITEM_ART_SMALL)) {
      const i = img(itemIcon(k, { px: 22 }));
      expect(i.src, k).toMatch(new RegExp(`art/items/${k}-small\\.webp\\?v=${ITEM_ART_SMALL[k]}$`));
      expect(i.srcset, k).toBeNull();
      expect(img(itemIcon(k, { px: 25 })).src, k).toBe(itemArtUrl(k, 128));
    }
    const noSmall = ITEM_IDS.find((id) => !ITEM_ART_SMALL[id]);
    expect(img(itemIcon(noSmall, { px: 16 })).src).toBe(itemArtUrl(noSmall, 128));
    expect(img(itemIcon(noSmall, { px: 104 })).sizes).toBe('104px');
  });

  it('the error fallback: itemArtSVG gives the drawing for every art key, and unknown ids stay drawn', () => {
    for (const id of ITEM_IDS) expect(itemArtSVG(id)).toBe(itemIconSVG(id));
    for (const k of GEAR_KEYS) {
      expect(itemArtSVG(k)).toMatch(/^<svg /);
      const [, slot, r] = /^gear_([a-z]+)_([a-zA-Z]+)$/.exec(k);
      expect(gearIcon(slot, r === 'ur' ? 'legendary' : r, { ur: r === 'ur' })).toContain(itemArtSVG(k));
    }
    expect(itemArtSVG('recruitPoints')).toMatch(/^<svg /);
    expect(itemIcon('not_an_item')).toMatch(/^<svg /);
    expect(itemArtUrl('not_an_item')).toBeNull();
    expect(itemArtUrl('gems', 'small')).toMatch(/gems-small\.webp/);
    expect(itemArtUrl('book_rare', 'small')).toBeNull();
    // the drawn set still covers every id (tests/integration/consistency.test.js relies on it)
    expect(ITEM_IDS.filter((id) => !hasItemIcon(id))).toEqual([]);
  });

  it('URLs are relative to the deploy base, never absolute to a host', () => {
    expect(itemArtUrl('coins')).toMatch(/^(\.\/|\/)art\/items\/coins-128\.webp\?v=[0-9a-f]{8}$/);
  });
});

describe('gear art: the 3D-flat gear icons (tools/blender/items models/gear.py, catalog GEAR_*)', () => {
  const catalog = readFileSync(join(ROOT, 'tools/blender/items/catalog.py'), 'utf8');
  const block = (name) => {
    const at = catalog.indexOf(`${name} = dict(`);
    expect(at, name).toBeGreaterThan(-1);
    return catalog.slice(at, catalog.indexOf('\n)\n', at));
  };

  it('every gear slot of the game has a design row and every tier a ladder row in the catalog', () => {
    const slots = block('GEAR_SLOT_ART');
    for (const slot of Object.keys(GEAR_SLOTS)) expect(slots, slot).toMatch(new RegExp(`\\n    ${slot}=dict\\(base='(pendant|bow|sneaker|hairclip|necklace)'`));
    const tiers = block('GEAR_TIERS');
    for (const t of [...ITEM_RARITY_ORDER, 'ur']) expect(tiers, t).toMatch(new RegExp(`\\n    ${t}=dict\\(trim='`));
  });

  it('each slot shows its own baked image per rarity and UR, small through big', () => {
    for (const slot of Object.keys(GEAR_SLOTS)) {
      const hashes = new Set();
      for (const r of [...ITEM_RARITY_ORDER, 'ur']) {
        const key = `gear_${slot}_${r}`;
        hashes.add(ITEM_ART[key]);
        const rarity = r === 'ur' ? 'legendary' : r;
        for (const px of [22, 32, 48, 104]) {
          const im = img(gearIcon(slot, rarity, { ur: r === 'ur', px }));
          expect(im.art, `${key} at ${px}px`).toBe(key);
          expect(im.src).toBe(itemArtUrl(key, 128));
          expect(im.srcset).toContain(itemArtUrl(key, 256));
        }
      }
      expect(hashes.size, `${slot}: every tier has its own art`).toBe(6);
    }
  });

  it('a set look (keyed by the gear set id, never the club) shows only when baked; otherwise the default look', () => {
    for (const slot of Object.keys(GEAR_SLOTS)) {
      const baked = ITEM_ART[`gear_spirit_${slot}`];
      expect(gearArtKey(slot, 'mythic', { set: 'spirit' })).toBe(baked ? `gear_spirit_${slot}` : `gear_${slot}_mythic`);
      expect(gearArtKey(slot, 'legendary', { ur: true, set: 'no_such_set' })).toBe(`gear_${slot}_ur`);
      expect(gearArtKey(slot, 'rare', { set: null })).toBe(`gear_${slot}_rare`);
      expect(gearArtKey(slot, 'mythic', { set: 'tea' })).toBe(`gear_${slot}_mythic`); // a club id is not a set
      expect(img(gearIcon(slot, 'rare', { set: 'no_such_set' })).art).toBe(`gear_${slot}_rare`);
    }
    // every baked set look resolves through gearIcon for every rarity and keeps the piece's own drawing as fallback
    for (const k of Object.keys(ITEM_ART).filter((x) => /^gear_[a-z0-9]+_[a-z]+$/.test(x) && !GEAR_KEYS.includes(x))) {
      const [, set, slot] = /^gear_([a-z0-9]+)_([a-z]+)$/.exec(k);
      for (const r of ['superRare', 'mythic', 'legendary']) {
        const markup = gearIcon(slot, r, { set });
        expect(img(markup).art).toBe(k);
        expect(markup).toContain(itemArtSVG(`gear_${slot}_${r}`));
      }
      expect(img(gearIcon(slot, 'legendary', { ur: true, set })).art).toBe(k);
      expect(itemArtSVG(k)).toMatch(/^<svg /);
    }
  });

  it('every gearIcon / gearArtKey call in src passes the piece\'s gear set (set: <piece>.set), never its club', () => {
    // Calls with no piece to take a set from, each with its reason. Anything else must pass `set: <piece>.set`.
    const ALLOWED = [
      ['src/ui/unitBuild.js', "gearIcon(g.slot, 'common')", 'the empty-slot placeholder: no piece is equipped'],
      ['src/ui/screens/backpack.js', "gearIcon(id, 'rare')", 'the slot filter chips: a generic icon per slot, no piece'],
      ['src/art/icons.js', 'gearArtKey(slot, rarity, { ur })', "gearIcon's own drawn fallback: always the default slot and rarity"],
    ];
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.(js|mjs)$/.test(e.name)) files.push(rel);
      }
    };
    walk('src');
    /** Every call `name(...)` in a source (balanced parentheses), without definitions or doc comments. */
    const callsOf = (src, name) => {
      const out = [];
      const re = new RegExp(`(?<![\\w.])${name}\\(`, 'g');
      let m;
      while ((m = re.exec(src))) {
        const line = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index);
        if (/function\s*$/.test(line) || /^\s*(\*|\/\/)/.test(line)) continue;
        let depth = 0;
        let k = m.index + name.length;
        for (; k < src.length; k++) {
          if (src[k] === '(') depth++;
          else if (src[k] === ')' && --depth === 0) break;
        }
        out.push(src.slice(m.index, k + 1));
      }
      return out;
    };
    let seen = 0;
    const used = new Set();
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      for (const name of ['gearIcon', 'gearArtKey']) {
        for (const call of callsOf(src, name)) {
          seen++;
          const allow = ALLOWED.find(([af, ac]) => af === f && ac === call);
          if (allow) {
            used.add(allow);
            continue;
          }
          expect(call, `${f}: ${call}`).toMatch(/\bset: [\w.]*\.set\b|\bset\b(?!:)/);
          expect(call, `${f}: ${call}`).not.toMatch(/\.club\b/);
        }
      }
    }
    expect(seen).toBeGreaterThan(8);
    expect(ALLOWED.filter((a) => !used.has(a)), 'stale allow-list rows').toEqual([]);
  });
});

describe('item art while loading and on error', () => {
  const css = readFileSync(join(ROOT, 'src/ui/styles/base.css'), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.replace(/\/\*[\s\S]*?\*\//g, '').trim(), body }));

  it('the old drawing shows only on a failed image (.ia.bad), never while the image loads', () => {
    const showing = rules.filter((r) => /\.ia\b[^,]*>\s*svg/.test(r.sel) && /visibility:\s*visible|animation/.test(r.body));
    expect(showing.length).toBeGreaterThan(0);
    for (const r of showing) expect(r.sel, r.sel).toMatch(/^\.ia\.bad\s*>\s*svg$/);
    expect(css).not.toMatch(/ia-late/);
  });

  it('a box still loading shows the neutral placeholder after a short delay, gone once the image is in or failed', () => {
    const wait = rules.find((r) => r.sel === '.ia:not(.ok):not(.bad)::before');
    expect(wait?.body).toMatch(/animation:\s*ia-wait\b[^;]*\b\d+ms\b[^;]*\b[1-9]\d{2}ms\b[^;]*forwards/);
    expect(rules.find((r) => r.sel === '.ia::before')?.body).toMatch(/opacity:\s*0\b/);
    expect(rules.find((r) => r.sel === '.ia.ok::before, .ia.bad::before')?.body).toMatch(/display:\s*none/);
  });

  it('no screen pulls the drawing out of an item icon (the achievements ladder uses itemIcon itself)', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.js') && /querySelector\(['"]svg['"]\)\??\.outerHTML/.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(join(ROOT, 'src/ui'));
    expect(offenders).toEqual([]);
    // (the achievements ladder: since UI M5b a sheet of whole item tiles, M3's tile itself, with no small icon taken
    // out of a tile at all)
    expect(readFileSync(join(ROOT, 'src/ui/screens/achievements/list.js'), 'utf8')).not.toMatch(/querySelector\(['"]svg['"]\)/);
  });

  it('preloadSmallItemArt starts each small cut once (the HUD and pills on every screen)', () => {
    const made = [];
    const prev = globalThis.Image;
    globalThis.Image = class { constructor() { made.push(this); } };
    try {
      expect(preloadSmallItemArt()).toBe(Object.keys(ITEM_ART_SMALL).length);
      expect(made.map((im) => im.src).sort()).toEqual(Object.keys(ITEM_ART_SMALL).map((k) => itemArtUrl(k, 'small')).sort());
      expect(preloadSmallItemArt()).toBe(0);
      expect(made.length).toBe(Object.keys(ITEM_ART_SMALL).length);
    } finally {
      if (prev === undefined) delete globalThis.Image;
      else globalThis.Image = prev;
    }
  });
});

describe('item tile plate', () => {
  it('a tile wears its rarity, or the rainbow plate for rainbow, UR-display and Zenith items', () => {
    for (const id of ITEM_IDS) {
      const it = ITEMS[id];
      const want = it.rainbow || it.display === 'ur' || it.tier === 'zenith' ? 'ur' : it.rarity;
      expect(tileTier(it), id).toBe(want);
    }
    expect(tileTier(ITEMS.mat_rime_zenith)).toBe('ur');
    expect(tileTier(ITEMS.crown_rainbow_shard)).toBe('ur');
    expect(tileTier(ITEMS.seed_rainbow)).toBe('ur');
    expect(tileTier(ITEMS.book_mythic)).toBe('mythic');
    expect(tileTier(null)).toBe('common');
  });
});

describe('display only: the battle sim is untouched', () => {
  it('no item art module is part of the lockstep battle', () => {
    const { files } = simId();
    expect(files.filter((f) => /^src\/(art|ui)\//.test(f) || f === 'src/data/items.js')).toEqual([]);
  });

  it('the sim id for this co-op protocol is unchanged (a sim change must bump COOP_PROTOCOL)', () => {
    // Known ids per protocol. A protocol bump (a real sim change) adds its own line here.
    // (9: Gate Arc Acts 1–2; 10: the ultimates release: abilities cast in battle, Tenka, Seiran's Dragonflight to START;
    // 11: the banners release with the duo Kohaku & Tsubaki (and Kohaku's constant beam), LR Limit Break, UR Resonance
    // and the staff heroes, and Tryout Day in co-op, in one release; 12: Gate Arc Acts 3–6, Tenka's LR form, the duo's
    // buff with the long beam, the sentry deploy event and Tryout Day's Extended Day + Random Class; 13: the last five
    // tower ultimates: Kage's Shadow Doubles, Suzu's Bell Carpet, Chika's Drone Surge, Fuu's Backdraft Fan, Iroha's Mirror Shift;
    // 14: the battle + gear release v0.1.66: the attack shapes S1–S5 (wheels, held streams and sweeps, ground shapes,
    // links, S5's six), balance round 5 (the LR rows, the duo's map-wide laser, Freeplay's boss bands), Ena's spreading
    // curse, Iroha's mirror network, and the gear update's five-piece sets and LR gear, with the shapes carrying the
    // set passives; 15: co-op feel — the waited-on side raises its input delay, orders after the sent horizon, nudge — on
    // the release tip 26dd6ab6, whose later Sim / enemy / set-rule changes the same bump covers)
    const KNOWN = { 8: '92e2e22527cf', 9: '4d7b235077a8', 10: '2c3c74708a2c', 11: '35748b1b58db', 12: 'd35092f141d3', 13: 'be940ecb2087', 14: '36cba1c215b0', 15: '92f3c17bbd2c' };
    if (!KNOWN[COOP_PROTOCOL]) return;
    expect(simId().id).toBe(KNOWN[COOP_PROTOCOL]);
  });
});
