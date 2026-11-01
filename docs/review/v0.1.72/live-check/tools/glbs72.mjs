// Item 2: norika/kogane (full + LOD) and the manifest on live return 200, are byte-identical to b207fe9a, parse, list clips.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const LIVE = 'https://tacosonmondays-pixel.github.io/sakura-game';
const R = '/home/user/sakura-game/public';
const paths = [];
for (const g of ['norika', 'kogane']) paths.push(`/models/characters/${g}.glb`, `/models/characters/${g}.lod.glb`);
paths.push('/models/characters/manifest.json');
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
    info = `glTF ${ok ? 'ok' : 'BAD'} build ${j.asset?.extras?.build} skins ${j.skins?.length || 0} clips [${(j.animations || []).map((a) => a.name).join(',')}]`;
    if (!ok || !j.animations?.length || j.asset?.extras?.build !== 'staff') fails++;
  }
  if (r.status !== 200 || !same) fails++;
  console.log(`${r.status} ${same ? 'same' : 'DIFF'} ${sha(buf)} ${String(buf.length).padStart(7)} ${p} ${info}`);
}
console.log(`RESULT glbs: ${paths.length} files, ${fails ? 'FAIL ' + fails : 'PASS'}`);
