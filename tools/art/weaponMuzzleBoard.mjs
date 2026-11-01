// Weapon-muzzle board (docs/specs/weapon-muzzles.md): before | after per armed girl, at 1280x720 and 390x844, from
// the crops e2e/weapon-muzzles.mjs saves (<girl>-<W>x<H>-<before|after>.jpg), frozen on the frame after her shot.
// Needs ImageMagick (montage, convert). Writes a JPEG at or under --max KB (quality stepped down until it fits).
//
//   node tools/art/weaponMuzzleBoard.mjs --shots /tmp/wm [--out docs/art/previews/weapon-muzzles-board.jpg] [--max 300]
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shots = opt('shots', '/tmp/wm');
const out = opt('out', 'docs/art/previews/weapon-muzzles-board.jpg');
const maxKb = Number(opt('max', '300'));
const GIRLS = String(opt('girls', 'aoi,hana,yuki,akane,raika,miko,momo,sango,shiro,tenka,chigusa,iroha,yuzuha,umeko,luna,nami,seiran,norika')).split(',');
const SIZES = ['1280x720', '390x844'];
const TILE_H = 150;

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'wm-board-'));
try {
  const rows = [];
  for (const g of GIRLS) {
    const tiles = [];
    for (const s of SIZES) {
      for (const tag of ['before', 'after']) {
        const f = join(shots, `${g}-${s}-${tag}.jpg`);
        const t = join(tmp, `${g}-${s}-${tag}.png`);
        if (existsSync(f)) run('convert', [f, '-resize', `x${TILE_H}`, '-gravity', 'South', '-background', '#00000099', '-fill', 'white', '-pointsize', '12', '-splice', '0x0', '-annotate', '+0+2', `${tag} · ${s}`, t]);
        else run('convert', ['-size', `${s === SIZES[0] ? 205 : 136}x${TILE_H}`, 'xc:#333', '-fill', '#aaa', '-gravity', 'center', '-annotate', '+0+0', 'n/a', t]);
        tiles.push(t);
      }
    }
    const row = join(tmp, `row-${g}.png`);
    run('convert', ['-background', '#1e1b24', '-fill', '#ffd9e6', '-font', 'DejaVu-Sans-Bold', '-pointsize', '16', '-size', `70x${TILE_H}`, '-gravity', 'center', `label:${g[0].toUpperCase()}${g.slice(1)}`, join(tmp, `lab-${g}.png`)]);
    run('convert', ['-background', '#1e1b24', join(tmp, `lab-${g}.png`), ...tiles, '-splice', '0x0', '+append', '-bordercolor', '#1e1b24', '-border', '3', row]);
    rows.push(row);
  }
  const full = join(tmp, 'board.png');
  run('montage', [...rows, '-tile', '2x', '-geometry', '+4+4', '-background', '#1e1b24', full]);
  const titled = join(tmp, 'titled.png');
  run('convert', [full, '-background', '#1e1b24', '-fill', 'white', '-font', 'DejaVu-Sans-Bold', '-pointsize', '20', '-gravity', 'North', '-splice', '0x34', '-annotate', '+0+6',
    'Weapon muzzles: before | after (frame after the first shot; 1280x720 and 390x844)', titled]);
  for (let q = 82; q >= 30; q -= 4) {
    run('convert', [titled, '-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', String(q), out]);
    const kb = statSync(out).size / 1024;
    if (kb <= maxKb) {
      console.log(`${out}: ${kb.toFixed(0)} KB at quality ${q}`);
      break;
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
