// The game shows the baked 3D-flat item art (src/art/icons.js over the manifest src/art/itemArt.js): every item id,
// gear piece and currency the game draws maps to its own baked image, the drawn SVG stays under it as the error
// fallback only (a slow load shows a neutral placeholder), small boxes get the small cut, tiles wear their tier's
// plate, and the change is display only (the battle sim id does not move).
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

describe('item art at runtime: every item has baked art', () => {
  it('every item id has a manifest entry, so no item falls back to the drawing', () => {
    const missing = ITEM_IDS.filter((id) => !hasItemArt(id));
    expect(missing).toEqual([]);
    expect(ITEM_IDS.length).toBe(Object.keys(ITEMS).length);
  });

  it('every gear piece (5 rarities + UR per slot) and every currency icon has baked art', () => {
    expect(GEAR_KEYS.filter((k) => !ITEM_ART[k])).toEqual([]);
    expect(CURRENCIES.filter((k) => !ITEM_ART[k])).toEqual([]);
  });

  it('itemIcon(id) is that item\'s own image over its drawn SVG', () => {
    for (const id of ITEM_IDS) {
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
    const srcs = ITEM_IDS.map((id) => img(itemIcon(id)).src);
    expect(new Set(srcs).size).toBe(ITEM_IDS.length);
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
    // buff with the long beam, the sentry deploy event and Tryout Day's Extended Day + Random Class)
    const KNOWN = { 8: '92e2e22527cf', 9: '4d7b235077a8', 10: '2c3c74708a2c', 11: '35748b1b58db', 12: 'd35092f141d3' };
    // feature/attack-links only: the attack shapes S1 "Wheels" (src/sim/wheels.js, dirs.js, shapes.js), Kohaku's long
    // beam (src/sim/duo.js), S2 "Held" (src/sim/channel.js, held.js; Akane's Hearth Stream, Umeko's Searchlight Sweep),
    // S3 "Ground" (src/sim/ground.js, vines.js; Chigusa's Bramble Road, Yuki's Rising Spikes, Kanna's Ripple Quake) and
    // S4 "Links" (src/sim/links.js; Fuu's Homecoming Throw, Ena's Spirit Tether) change the sim. The release that ships
    // them sets COOP_PROTOCOL once, adds its `N: '<id>'` line above and removes this one. Only this exact in-progress id
    // passes.
    const PENDING_BUMP = { 12: '0b5c98798ae8' };
    if (!KNOWN[COOP_PROTOCOL]) return;
    if (PENDING_BUMP[COOP_PROTOCOL] === simId().id) return;
    expect(simId().id).toBe(KNOWN[COOP_PROTOCOL]);
  });
});
