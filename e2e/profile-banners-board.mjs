// Owner board of the 20 'pb:' profile banners (docs/specs/PROFILE_BANNERS.md): each drawn by the game's own
// bannerArt(), with its name, group and unlock line. Display-only tooling; not in the game build.
//
//   node e2e/profile-banners-board.mjs [out.png]      # default docs/specs/profile-banners/board.png
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { launchChromium } from './browser.mjs';

const out = process.argv[2] || 'docs/specs/profile-banners/board.png';
mkdirSync(dirname(out), { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser } = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura, null, { timeout: 60000 });
  await page.evaluate(async () => {
    const [{ PB_BANNERS }, { bannerArt }, { pbHowText }] = await Promise.all([
      import('/src/data/profileBanners.js'), import('/src/ui/profile/parts.js'), import('/src/systems/profileBanners.js'),
    ]);
    const GROUP = { school: 'School life', sakura: 'Sakura', chapters: 'Chapters', freeplay: 'Freeplay', lr: 'LR', together: 'Co-op', secret: 'Secret', event: 'Event', season: 'Season' };
    document.body.innerHTML = '';
    const css = document.createElement('style');
    css.textContent = `
      html, body { height: auto !important; overflow: visible !important; position: static !important; }
      body { margin: 0; background: #fbf7f0; font: 14px/1.35 system-ui, sans-serif; color: #22202a; overflow: auto; }
      .bd { padding: 22px 26px; width: 1548px; }
      h1 { margin: 0 0 4px; font-size: 26px; } p.sub { margin: 0 0 16px; color: #6b6474; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .c { background: #fff; border: 1px solid #e4dccd; border-radius: 12px; overflow: hidden; }
      .art { position: relative; height: 128px; overflow: hidden; }
      .art .pf-bn-art { position: absolute; inset: 0; }
      .art img, .art .pf-bn-svg, .art .pf-bn-svg svg { width: 100%; height: 100%; object-fit: cover; display: block; }
      .g { position: absolute; left: 8px; top: 8px; background: rgba(20,24,40,.78); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; letter-spacing: .4px; text-transform: uppercase; }
      .slot { position: absolute; right: 8px; top: 8px; background: #ffd27a; color: #3a2a00; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
      .t { padding: 8px 11px 10px; } .t b { font-size: 15px; } .t code { color: #8a7f95; font-size: 11px; margin-left: 6px; }
      .t div { font-size: 12px; color: #4a4552; margin-top: 3px; }`;
    document.head.append(css);
    const bd = document.createElement('div');
    bd.className = 'bd';
    bd.innerHTML = '<h1>Sensei Profile banners · 20 new</h1><p class="sub">Shown on your profile and on the card other players see. Cosmetic only: each one unlocks from what you have already done (nothing to buy). Painted places are the game\'s own story art; patterns are drawn in code. Gold tag = room for an owner-made illustration later.</p>';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const b of PB_BANNERS) {
      const c = document.createElement('div');
      c.className = 'c';
      const art = document.createElement('div');
      art.className = 'art';
      art.append(bannerArt(b.id));
      art.insertAdjacentHTML('beforeend', `<span class="g">${GROUP[b.group] || b.group}</span>${b.slot ? '<span class="slot">illustration slot</span>' : ''}`);
      const t = document.createElement('div');
      t.className = 't';
      t.innerHTML = `<b></b><code></code><div></div>`;
      t.querySelector('b').textContent = b.name;
      t.querySelector('code').textContent = b.id;
      t.querySelector('div').textContent = pbHowText(b.id);
      c.append(art, t);
      grid.append(c);
    }
    bd.append(grid);
    document.body.append(bd);
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(500);
  const el = await page.$('.bd');
  await el.screenshot({ path: out });
  console.log(`board: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
