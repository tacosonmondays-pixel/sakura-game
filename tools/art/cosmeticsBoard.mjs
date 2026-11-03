// The Cosmetics 2 owner board (docs/review/cosmetics-2/board.png): every Honor Ribbon as baked (the four new secret
// ribbons marked), beside its old SVG at the Case's grid size, and the twelve new picture frames on girls' pictures
// with their unlock rules. Uses only the game's own art.   node tools/art/cosmeticsBoard.mjs [out.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HONOR_RIBBONS, HONOR_CLASSES } from '../../src/data/honors.js';
import { honorSVG } from '../../src/art/honors.js';
import { HONOR_BAKED, HONOR_ART_PAD } from '../../src/art/honorArt.js';
import { FRAMES } from '../../src/data/profileArt.js';
import { ornateFrameSVG, ORNATE_FRAMES } from '../../src/art/profileArt.js';
import { launchChromium } from '../../e2e/browser.mjs';

const out = resolve(process.argv[2] || 'docs/review/cosmetics-2/board.png');
const NEW = new Set(['a_close_call', 'a_gold_rush', 'a_not_fooled', 'a_mirror_mirror']);
const data = (p) => `data:image/webp;base64,${readFileSync(p).toString('base64')}`;
const girls = ['hikari', 'aoi', 'akane', 'chika', 'hana', 'kaede', 'hotaru', 'iroha', 'ena', 'fuu', 'azami', 'chigusa'];
const pad = HONOR_ART_PAD;
const ribbon = (h) => `<div class="rb ${NEW.has(h.id) ? 'new' : ''}"><div class="pair"><div class="old">${honorSVG(h.id)}</div>`
  + `<div class="bake"><img src="${data(`public/art/honors/${h.id}-256.webp`)}"></div></div>`
  + `<b>${h.no}. ${h.name.replace(/ Ribbon$/, '')}</b><small>${HONOR_CLASSES[h.class]}${h.effectName ? ` · ${h.effectName}` : ''}${NEW.has(h.id) ? ' · NEW secret' : ''}</small></div>`;
const frame = (id, i) => `<div class="fr"><div class="ava"><img src="${data(`public/art/portraits/${girls[i % girls.length]}-thumb.webp`)}">${ornateFrameSVG(id)}</div>`
  + `<b>${FRAMES[id].name}${FRAMES[id].secret ? ' (secret)' : ''}</b><small>${FRAMES[id].how}</small></div>`;
const html = `<!doctype html><html><head><style>
body{margin:0;background:#f6f4fb;font:13px/1.25 Nunito,system-ui,sans-serif;color:#2a2550;width:1600px}
h1{font-size:26px;margin:18px 24px 2px}h2{font-size:18px;margin:18px 24px 6px}p{margin:0 24px 8px;color:#5a5680}
.grid{display:grid;grid-template-columns:repeat(9,1fr);gap:8px;padding:0 20px}
.rb{background:#fff;border-radius:12px;padding:6px 4px 8px;text-align:center;box-shadow:0 1px 3px #0001}
.rb.new{outline:3px solid #ff5c8a}
.pair{display:flex;justify-content:center;gap:4px;align-items:center}
.old svg{width:44px;height:44px;opacity:.9}.bake{width:96px;height:96px;position:relative}
.bake img{position:absolute;left:${-96 * pad / 64}px;top:${-96 * pad / 64}px;width:${96 * (64 + 2 * pad) / 64}px}
b{display:block;font-size:12px;margin-top:2px}small{display:block;color:#6d6896;font-size:11px}
.frames{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:0 20px 24px}
.fr{background:#fff;border-radius:14px;padding:12px 8px;text-align:center;box-shadow:0 1px 3px #0001}
.ava{position:relative;width:150px;height:150px;margin:0 auto 6px}
.ava img{position:absolute;inset:9%;width:82%;height:82%;border-radius:50%;object-fit:cover;background:#eaf4ff}
.ava svg{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 4px 8px rgba(30,20,70,.35))}
</style></head><body>
<h1>Cosmetics 2 — flat 3D ribbons, secret rewards, new frames</h1>
<p>Each ribbon: the old SVG (small, left) and the new Blender bake (right, shown at the Case grid's 2x size). Pink outline = the four new secret ribbons. Locked and secret ribbons keep the grey SVG.</p>
<div class="grid">${HONOR_RIBBONS.map(ribbon).join('')}</div>
<h2>New picture frames (12) and how each is earned</h2>
<p>Secret frames show "???" and the hint until earned. Lantern Night is listed while the Halloween event runs, then only for its owners.</p>
<div class="frames">${ORNATE_FRAMES.map(frame).join('')}</div>
</body></html>`;
const { browser } = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
writeFileSync(out.replace(/\.png$/, '.html'), html.replace(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g, ''));
console.log(`[board] ${out}`);
