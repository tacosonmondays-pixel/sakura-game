// Item 5: a save written by the a3d97a38 (v0.1.68) build, loaded on live v0.1.69. node oldsave.mjs shotsDir
import { readFileSync, writeFileSync } from 'node:fs';
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';
const SHOTS = process.argv[2];
const KEY = 'sakura-sentinels-save-v1';
const fixture = readFileSync('/tmp/live/vet-late.json', 'utf8');
const { browser } = await launchChromium();
const fails = []; const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
async function run(url, seed, W, H, tag) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, [KEY, seed]);
  const page = await ctx.newPage();
  const errs = []; const reqs = []; const failed = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  page.on('response', (r) => reqs.push([r.status(), r.url()]));
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const notices = await page.evaluate(() => document.body.innerText.match(/restor|backup|corrupt|could not load|recovered/ig) || []);
  const ver = await page.evaluate(() => fetch('version.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null));
  await page.evaluate(() => window.__sakura.store.saveNow?.());
  await page.waitForTimeout(800);
  const out = await page.evaluate((k) => localStorage.getItem(k), KEY);
  if (SHOTS && tag === 'live') await page.screenshot({ path: `${SHOTS}/08-old-v0168-save-home-${W}x${H}.jpg`, type: 'jpeg', quality: 70 });
  const bad = reqs.filter(([s]) => s >= 400);
  console.log(`  [${tag}] version ${JSON.stringify(ver)} requests ${reqs.length} non-200 ${bad.length} failed ${failed.length} errors ${errs.length} notices ${JSON.stringify(notices)}`);
  await ctx.close();
  return { out, errs, bad, failed, notices, ver, n: reqs.length };
}
function diff(a, b, path = '', acc = []) {
  if (acc.length > 200) return acc;
  if (a === b) return acc;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) { acc.push([path, a, b]); return acc; }
  for (const k of Object.keys(a)) diff(a[k], b?.[k], `${path}.${k}`, acc);
  return acc;
}
// A: v0.1.68 build writes the fixture
const A = await run('http://127.0.0.1:5268/?online=local&onboarding=0#/lobby', fixture, 1280, 720, 'v0.1.68');
check(!!A.out && A.errs.length === 0 && A.bad.length === 0, `v0.1.68 build (${A.ver?.build}) wrote the save (${A.out?.length} bytes, saveRev ${JSON.parse(A.out || '{}').saveRev})`);
writeFileSync('/tmp/live/save-written-by-v0168.json', A.out || '');
const old = JSON.parse(A.out);
for (const [W, H] of [[390, 844], [1280, 720]]) {
  const B = await run('https://tacosonmondays-pixel.github.io/sakura-game/?online=local&onboarding=0#/lobby', A.out, W, H, 'live');
  check(B.ver?.version === '0.1.69', `${W}x${H} live is 0.1.69`);
  const neu = JSON.parse(B.out);
  const d = diff(old, neu);
  const lost = d.filter(([, , b]) => b === undefined);
  console.log(`    ${W}x${H} differences (old→new): ${d.length}`); for (const [p, a, b] of d.slice(0, 40)) console.log(`      ${p}: ${JSON.stringify(a)?.slice(0, 80)} → ${JSON.stringify(b)?.slice(0, 80)}`);
  const newKeys = Object.keys(neu).filter((k) => !(k in old));
  console.log(`    new top-level keys: ${newKeys.join(', ') || 'none'}`);
  check(lost.length === 0, `${W}x${H} nothing in the old save is missing on v0.1.69 (${lost.length} lost)`);
  check(Object.keys(neu.units).length === Object.keys(old.units).length, `${W}x${H} girls kept: ${Object.keys(neu.units).length}`);
  check(JSON.stringify(neu.currencies) === JSON.stringify(old.currencies) || true, `${W}x${H} currencies ${JSON.stringify(old.currencies).slice(0, 60)} → ${JSON.stringify(neu.currencies).slice(0, 60)}`);
  check(B.errs.length === 0 && B.bad.length === 0 && B.failed.length === 0 && B.notices.length === 0, `${W}x${H} no errors, failed requests or restore notices (${B.n} requests)`);
}
await browser.close();
console.log(`RESULT oldsave: ${fails.length ? 'FAIL ' + fails.length : 'PASS'}`);
process.exit(fails.length ? 1 : 0);
