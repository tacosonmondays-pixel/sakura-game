// Item 2a: every changed GLB (and LOD) on live returns 200, is byte-identical to 2dba8b4a, parses, and lists its clips.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const LIVE = 'https://tacosonmondays-pixel.github.io/sakura-game';
const R = '/home/user/sakura-game/public';
const girls = ['luna', 'nami', 'kanna', 'yoriko', 'kogane', 'norika'];
const foes = ['slime_green', 'goblin_runner', 'orc_grunt', 'oni_brute', 'fp_hyakki_daimyo', 'ghoul_bonewalker', 'lizard_skink', 'iron_colossus', 'fp_foundry_titan'];
const paths = [];
for (const g of girls) paths.push(`/models/characters/${g}.glb`, `/models/characters/${g}.lod.glb`);
for (const e of foes) { paths.push(`/models/enemies/tripo/${e}.glb`); if (existsSync(`${R}/models/enemies/tripo/${e}.lod.glb`)) paths.push(`/models/enemies/tripo/${e}.lod.glb`); }
paths.push('/models/characters/manifest.json', '/models/enemies/tripo/manifest.json');
let fails = 0;
for (const p of paths) {
  const r = await fetch(LIVE + p, { cache: 'no-store' });
  const buf = Buffer.from(await r.arrayBuffer());
  const local = readFileSync(R + p);
  const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
  const same = sha(buf) === sha(local);
  let info = '';
  if (p.endsWith('.glb')) {
    const ok = buf.readUInt32LE(0) === 0x46546c67;
    const jl = buf.readUInt32LE(12); const j = JSON.parse(buf.subarray(20, 20 + jl).toString());
    info = `glTF ${ok ? 'ok' : 'BAD'} skins ${j.skins?.length || 0} clips [${(j.animations || []).map((a) => a.name).join(',')}]`;
    if (!ok || !j.animations?.length) fails++;
  }
  if (r.status !== 200 || !same) fails++;
  console.log(`${r.status} ${same ? 'same' : 'DIFF'} ${sha(buf)} ${String(buf.length).padStart(7)} ${p} ${info}`);
}
console.log(`RESULT glbs: ${paths.length} files, ${fails ? 'FAIL ' + fails : 'PASS'}`);
