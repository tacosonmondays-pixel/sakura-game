// Model audit: every girl's GLB (full and LOD) and every one-enemy Tripo model, loaded through the game's own
// loaders (src/models/glbChibi.js, src/models/glbEnemy.js) in a browser, each clip played on a SkeletonUtils
// clone and the skinned vertices measured. Catches a T-pose (arm bones that carry almost no vertices, or arms
// that never leave the bind span), clips whose tracks do not bind, near-static clips and missing clip names.
//
//   node e2e/model-audit.mjs [--only luna,nami] [--json out.json] [--strict]
// Per file: the arm bones' share of the vertices, the bind width / height, and per clip the largest and mean vertex
// travel over the clip (share of the height), the width range and how far the pose sits from the bind pose.
// --strict exits 1 when a girl fails a check (default: report only). Starts its own Vite dev server.
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { writeFileSync } from 'node:fs';
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const only = opt('only', null)?.split(',') || null;
const jsonOut = opt('json', null);
const strict = args.includes('--strict');

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = "http://127.0.0.1:5199/";
const { browser } = await launchChromium();
const page = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?audit=1`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 }).catch(() => null);

const report = await page.evaluate(async (ids) => {
  const g = await import('/src/models/glbChibi.js');
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { clone } = await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
  const manifest = await g.loadManifest();
  const out = [];
  const list = Object.keys(manifest).filter((id) => !ids || ids.includes(id));
  const ARM = /^(upper_arm|forearm|hand)_[LR]$/;
  for (const id of list) {
    const entry = manifest[id];
    for (const detail of entry.lod ? ['full', 'lod'] : ['full']) {
      const asset = await g.loadCharacter(id, detail);
      if (!asset) { out.push({ id, detail, error: 'not loaded' }); continue; }
      const root = clone(asset.scene);
      root.updateMatrixWorld(true);
      let body = null;
      root.traverse((o) => { if (o.isSkinnedMesh && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o; });
      if (!body) { out.push({ id, detail, error: 'no skinned mesh' }); continue; }
      const names = new Set();
      root.traverse((o) => names.add(o.name));
      const geo = body.geometry;
      const pos = geo.attributes.position;
      const si = geo.attributes.skinIndex;
      const sw = geo.attributes.skinWeight;
      const n = pos.count;
      // vertices each arm bone dominates (weight > 0.5)
      const bones = body.skeleton.bones;
      const armCount = { L: 0, R: 0 };
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 4; k++) {
          if (sw.getComponent(i, k) <= 0.5) continue;
          const b = bones[si.getComponent(i, k)]?.name || '';
          if (ARM.test(b)) armCount[b.slice(-1)]++;
        }
      }
      const skinned = () => {
        root.updateMatrixWorld(true);
        body.skeleton.update();
        const a = new Float32Array(n * 3);
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pos, i);
          body.applyBoneTransform(i, v);
          a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z;
        }
        return a;
      };
      const ext = (a) => {
        const lo = [1e9, 1e9, 1e9]; const hi = [-1e9, -1e9, -1e9];
        for (let i = 0; i < a.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], a[i + c]); hi[c] = Math.max(hi[c], a[i + c]); }
        return { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] };
      };
      const bind = skinned();
      const be = ext(bind);
      const clips = {};
      const mixer = new THREE.AnimationMixer(root);
      for (const [name, clip] of Object.entries(asset.clips)) {
        if (name === 'attack' && clip.name !== 'attack') continue; // alias of attack_<kind>
        const unbound = clip.tracks.filter((t) => !names.has(t.name.split('.')[0])).length;
        mixer.stopAllAction();
        const act = mixer.clipAction(clip);
        act.reset().play();
        const S = 8;
        let first = null;
        const lo = new Float32Array(n * 3).fill(1e9);
        const hi = new Float32Array(n * 3).fill(-1e9);
        let spanMax = 0; let spanMin = 1e9;
        let bindDev = 0;
        for (let s = 0; s < S; s++) {
          mixer.setTime((clip.duration * s) / S);
          const a = skinned();
          if (!first) first = a;
          const e = ext(a);
          spanMax = Math.max(spanMax, e.x); spanMin = Math.min(spanMin, e.x);
          let dev = 0;
          for (let i = 0; i < a.length; i++) {
            if (a[i] < lo[i]) lo[i] = a[i];
            if (a[i] > hi[i]) hi[i] = a[i];
          }
          for (let i = 0; i < a.length; i += 3) dev += Math.hypot(a[i] - bind[i], a[i + 1] - bind[i + 1], a[i + 2] - bind[i + 2]);
          bindDev = Math.max(bindDev, dev / n);
        }
        let maxRange = 0; let meanRange = 0;
        for (let i = 0; i < n * 3; i += 3) {
          const r = Math.hypot(hi[i] - lo[i], hi[i + 1] - lo[i + 1], hi[i + 2] - lo[i + 2]);
          maxRange = Math.max(maxRange, r);
          meanRange += r;
        }
        meanRange /= n;
        act.stop();
        mixer.uncacheAction(clip);
        clips[name] = {
          dur: +clip.duration.toFixed(2), tracks: clip.tracks.length, unbound,
          maxMove: +(maxRange / be.y).toFixed(3), meanMove: +(meanRange / be.y).toFixed(4),
          span: [+(spanMin / be.x).toFixed(2), +(spanMax / be.x).toFixed(2)], poseOff: +(bindDev / be.y).toFixed(3),
        };
      }
      const want = ['idle', 'walk', 'cheer', 'hurt', `attack_${asset.extras.weaponKind || ''}`];
      out.push({
        id, detail, source: entry.source || 'blender', verts: n, bindSpanOverHeight: +(be.x / be.y).toFixed(2), armVerts: armCount,
        armFrac: +((armCount.L + armCount.R) / n).toFixed(3), clips,
        missing: want.filter((w) => !asset.clips[w] && !(w.startsWith('attack_') && asset.clips.attack)),
      });
    }
  }
  return out;
}, only);

const bad = [];
for (const r of report) {
  if (r.error) { console.log(`${r.id} ${r.detail}: ${r.error}`); bad.push(`${r.id} ${r.detail}: ${r.error}`); continue; }
  const c = r.clips;
  const flags = [];
  if (r.armFrac < 0.02) flags.push(`arms carry ${(r.armFrac * 100).toFixed(1)}% of the vertices`);
  if (c.idle && c.idle.span[1] > 0.95 && r.bindSpanOverHeight > 0.8) flags.push(`idle keeps the bind span (${c.idle.span[1]}, T-pose)`);
  if (c.idle && c.idle.maxMove < 0.03) flags.push(`idle near-static (max move ${c.idle.maxMove})`);
  for (const [name, cl] of Object.entries(c)) if (cl.unbound) flags.push(`${name}: ${cl.unbound}/${cl.tracks} tracks unbound`);
  // a clip that neither moves nor holds a pose away from the bind pose (a held 'hurt' / 'victory' pose is fine)
  for (const name of ['walk', 'cheer', 'hurt']) if (c[name] && c[name].maxMove < 0.03 && c[name].poseOff < 0.02) flags.push(`${name} near-static (${c[name].maxMove})`);
  const atk = Object.keys(c).find((k) => k.startsWith('attack_'));
  if (atk && c[atk].maxMove < 0.05) flags.push(`${atk} near-static (${c[atk].maxMove})`);
  if (r.missing.length) flags.push(`missing clips ${r.missing.join(',')}`);
  const clipStr = Object.entries(c).map(([k, v]) => `${k} ${v.maxMove}/${v.meanMove} span ${v.span.join('-')}`).join(' | ');
  console.log(`${r.id.padEnd(16)} ${r.detail.padEnd(4)} ${String(r.source).padEnd(7)} arms ${r.armVerts.L}/${r.armVerts.R} (${(r.armFrac * 100).toFixed(1)}%) bind w/h ${r.bindSpanOverHeight}  ${flags.length ? `FLAGS: ${flags.join('; ')}` : 'ok'}`);
  console.log(`    ${clipStr}`);
  if (flags.length) bad.push(`${r.id} ${r.detail}: ${flags.join('; ')}`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
console.log(`\n${report.length} files audited, ${bad.length} flagged${errors.length ? `, page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
for (const b of bad) console.log(`  - ${b}`);
await browser.close();
await server.close();
process.exit(strict && (bad.length || errors.length) ? 1 : 0);
