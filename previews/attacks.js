// Attack FX preview (dev only): every girl's attack side by side, or one girl up close.
// Query params:
//   mode=gallery|focus  unit=chika  build=base|p0|p1|p2|max|5-2-0  level=1..10 (heroes, focus)
//   quality=high|medium|low  speed=1|2|3  seed=3  fx=on|off  manual=1  extra=6 (gallery: up to 6
//   extra Chikas asking 5-2-0; the path cap holds them at 4-2-0)  stream=0 (no enemy stream)
//   zoom=2.2 (focus)  select=1  clean=1 (no HUD)  tiny=1 (96×54 canvas for fast checks)  bloom=0
//   hp=600 (enemy HP ×)  preroll=40 (s)
// manual=1: no rAF loop; drive it with window.__advance(n, dt) and capture with __frame() /
// __fxProbe() (e2e/attack-fx.mjs, e2e/attack-reel.mjs).
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { STAGE_MAP } from '../src/data/stages.js';
import { UNIT_MAP } from '../src/data/units.js';
import { NEW_GIRL_IDS } from '../src/data/unitsNewGirls.js';
import { buildMapTracks } from '../src/core/track.js';
import { gainHeroXp } from '../src/sim/hero.js';

export const ORDER = ['chika', 'hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede'];
const BUILDS = { base: [0, 0, 0], p0: [5, 2, 0], p1: [0, 5, 2], p2: [2, 0, 5] };
// gallery extra=N Chikas: four below the last run, then two above the first. One final tier per path
// holds every copy after the roster Chika to 4-2-0 (5 drones), so the stress scene (e2e/attack-fx.mjs,
// extra=6) needs all six for its ≈ 40 drones: 9 + 6 × 5 = 39.
const EXTRA_SPOTS = [[4, 15.9], [11.5, 15.9], [19, 15.9], [26.5, 15.9], [7.75, 1.1], [22.75, 1.1]];

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'focus' ? 'focus' : 'gallery';
const unit = UNIT_MAP[params.get('unit')] ? params.get('unit') : 'chika';
const buildParam = params.get('build') || 'base';
const quality = ['high', 'medium', 'low'].includes(params.get('quality')) ? params.get('quality') : 'high';
let speed = [1, 2, 3].includes(Number(params.get('speed'))) ? Number(params.get('speed')) : 1;
const seed = Number(params.get('seed') || 3);
const fxOn = params.get('fx') !== 'off';
const manual = params.get('manual') === '1';
const extra = Math.max(0, Math.min(EXTRA_SPOTS.length, Number(params.get('extra') || 0)));
const streamOn = params.get('stream') !== '0';
const phone = innerWidth < 700 || innerHeight < 480;
const clean = params.get('clean') === '1'; // no HUD (reels / owner shots)
if (clean) document.body.classList.add('clean');

// ---------------------------------------------------------------------------------------------
// the gallery map: one serpentine lane in four runs, booths between the runs
// ---------------------------------------------------------------------------------------------
const L = '-';
function galleryMap(ponds = []) {
  const W = 30;
  const H = 17;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const edge = (y === 0 || y === H - 1) && (x * 7 + y * 3) % 5 === 0;
      const pond = ponds.some(([px, py]) => Math.abs(x + 0.5 - px) <= 1.1 && Math.abs(y + 0.5 - py) <= 0.6);
      r += pond ? '~' : edge ? 'T' : (x * 13 + y * 7) % 23 === 0 ? ',' : '.';
    }
    rows.push(r);
  }
  const paths = [[
    [-1, 2.5], L, [26.6, 2.5], [28.4, 3.3], [28.7, 4.5], [28.4, 5.7], [26.6, 6.5], L, [3.4, 6.5], [1.6, 7.3], [1.3, 8.5], [1.6, 9.7], [3.4, 10.5],
    L, [26.6, 10.5], [28.4, 11.3], [28.7, 12.5], [28.4, 13.7], [26.6, 14.5], L, [-1, 14.5],
  ]];
  const { tracks, crossings, tiles } = buildMapTracks(paths, 'bridge');
  const grid = rows.map((r) => r.split(''));
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (grid[y][x] === 'T' || grid[y][x] === ',') grid[y][x] = '.';
  }
  return {
    id: 'fx_gallery', name: 'Attack Gallery', theme: 'sakura', tier: 'beginner', width: W, height: H,
    rows: grid.map((r) => r.join('')), tracks, crossings,
    paths: tracks.map((t) => t.points.map(([x, y]) => [x - 0.5, y - 0.5])), decor: [], desc: 'Attack FX gallery', concept: 'serpentine',
  };
}

function boothsFor(n) {
  // 3 rows between the runs (7 · 6 · 6 booths for the 19 girls), 3.7 tiles apart
  const rows = [4.5, 8.5, 12.5];
  const counts = n <= 1 ? [0, 1, 0] : [Math.ceil(n / 3), Math.ceil((n - Math.ceil(n / 3)) / 2), 0];
  counts[2] = n - counts[0] - counts[1];
  const out = [];
  for (let r = 0; r < 3; r++) {
    const c = counts[r];
    const span = (c - 1) * 3.7;
    for (let i = 0; i < c; i++) out.push([c === 1 ? 15 : 15 - span / 2 + i * 3.7, rows[r]]);
  }
  return out;
}

function parseBuild(b, index) {
  if (BUILDS[b]) return BUILDS[b];
  if (b === 'max') {
    const t = [0, 0, 0];
    t[index % 3] = 5;
    t[(index + 1) % 3] = 2;
    return t;
  }
  const m = /^(\d)-(\d)-(\d)$/.exec(b || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function applyBuild(sim, t, tiers) {
  const order = [0, 1, 2].sort((a, b) => tiers[b] - tiers[a]);
  for (const p of order) for (let k = t.tiers[p]; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
}

function snapPlace(sim, id, x, y) {
  for (let r = 0; r <= 1.6; r += 0.2) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const px = x + Math.sin(a) * r;
      const py = y + Math.cos(a) * r;
      const t = sim.placeTower(id, px + 1e-4, py + 1e-4);
      if (t) return t;
      if (r === 0) break;
    }
  }
  return null;
}

async function main() {
  await preloadModels();
  const ids0 = mode === 'focus' ? [unit] : ORDER.slice();
  // focus: a land booth and a pond booth side by side (water girls stand in the pond)
  const LAND = [15.6, 8.5];
  const POND = [12.6, 8.5];
  const boothOf = (id) => (UNIT_MAP[id].placement === 'water' ? POND : LAND);
  const booths = mode === 'focus' ? [boothOf(unit)] : boothsFor(ids0.length);
  const ponds = mode === 'focus' ? [POND] : ids0.map((id, i) => (UNIT_MAP[id].placement === 'water' ? booths[i] : null)).filter(Boolean);
  const map = galleryMap(ponds);
  const stage = { ...STAGE_MAP['1-1'], id: 'fx-gallery', mapId: 'fx_gallery', name: 'Attack Gallery', waves: 999, lives: 1e6, startCash: 1e9 };
  const ids = ids0;
  const units = {};
  // heroes play as ordinary girls here (all three fit in one sim) unless &level= asks for the real hero
  const heroFocus = mode === 'focus' && UNIT_MAP[unit].kind === 'hero' && params.has('level');
  for (const id of ORDER) if (UNIT_MAP[id].kind === 'hero' && !heroFocus) units[id] = { ...UNIT_MAP[id], kind: 'tower' };
  const loadout = ORDER.filter((id) => !(heroFocus && id === unit)).map((unitId) => ({ unitId }));
  // focus: the girls outside the gallery roster (the academy girls) join the loadout, so __setup can swap to them
  if (mode === 'focus') for (const id of [unit, ...NEW_GIRL_IDS]) if (!ORDER.includes(id) && !loadout.some((l) => l.unitId === id)) loadout.push({ unitId: id });
  const sim = new Sim({
    stageId: 'fx-gallery', difficulty: 'normal', seed, loadout, hero: heroFocus ? { unitId: unit } : null,
    options: { autoStart: true }, data: { stage, map, units },
  });
  sim.cash = 1e9;
  sim.lives = 1e9;
  sim.maxLives = 1e9;
  const placed = [];
  ids.forEach((id, i) => {
    const [x, y] = booths[i];
    const t = snapPlace(sim, id, x, y);
    if (!t) return;
    applyBuild(sim, t, parseBuild(buildParam, i));
    placed.push({ t, id, build: t.tiers.join('-') });
  });
  for (let k = 0; k < extra && mode === 'gallery'; k++) {
    const [x, y] = EXTRA_SPOTS[k];
    const t = snapPlace(sim, 'chika', x, y);
    if (t) {
      applyBuild(sim, t, [5, 2, 0]);
      placed.push({ t, id: 'chika', build: t.tiers.join('-') });
    }
  }
  if (heroFocus && sim.hero) {
    const lv = Math.max(1, Math.min(10, Number(params.get('level') || 1)));
    for (let k = 0; k < 20 && sim.hero.level < lv; k++) gainHeroXp(sim, sim.hero, 400 * k + 200);
  }
  sim.startNextWave();
  sim.drainEvents();

  // enemy stream: 3 ground : 1 airborne, every 0.45 s of game time
  const hpMul = Number(params.get('hp') || (mode === 'focus' ? 60 : 600));
  const GROUND = ['slime_green', 'goblin_runner', 'slime_pearl'];
  const AIR = ['goblin_glider', 'slime_bubble'];
  let streamT = 0;
  let streamN = 0;
  function streamTick(gdt) {
    if (sim.state === 'between' || sim.state === 'prep') sim.startNextWave();
    if (!streamOn) return;
    streamT -= gdt;
    while (streamT <= 0) {
      streamT += 0.45;
      const id = streamN % 4 === 3 ? AIR[(streamN >> 2) % AIR.length] : GROUND[streamN % 3];
      streamN++;
      if (sim.enemies.length < 60) sim.spawnEnemy(id, { dist: 0, pathIndex: 0, hpMul });
    }
  }
  // fill the whole lane so every booth has enemies from the first frame, then pre-roll a bit
  if (streamOn) {
    const len = sim.pathData[0].length;
    for (let d = 0.5, k = 0; d < len - 1; d += 1.3, k++) {
      const id = k % 4 === 3 ? AIR[k % AIR.length] : GROUND[k % 3];
      sim.spawnEnemy(id, { dist: d, pathIndex: 0, hpMul });
    }
  }
  // pre-roll: drone owners finish building their drones (one per attack cycle)
  const preroll = Number(params.get('preroll') ?? 40);
  for (let i = 0; i < preroll * 10; i++) {
    streamTick(0.1);
    sim.update(0.1);
    if (i % 50 === 0) sim.drainEvents();
  }
  sim.drainEvents();

  const el = document.getElementById('stage');
  // tiny=1: a 96×54 canvas — checks run the full renderer + attack FX without paying for pixels
  if (params.get('tiny') === '1') el.style.cssText = 'width:96px;height:54px;inset:auto;left:0;top:0';
  const top = phone ? 40 : 44;
  const insets = clean ? { top: 0, right: 0, bottom: 0, left: 0 } : phone ? { top, right: 0, bottom: 56, left: 0 } : { top, right: 300, bottom: 0, left: 0 };
  const r = createBattleRenderer(el, sim, { quality, settings: { quality, camera: 'free', attackFx: fxOn ? undefined : false, lighting: { exposure: 1, warmth: 0 }, ...(params.get('bloom') === '0' ? { bloom: false } : {}) }, insets });
  window.__sim = sim;
  window.__r = r;
  window.__placed = placed;
  r.update(0.016);

  if (mode === 'focus' || params.get('zoom')) {
    const z = Number(params.get('zoom') || (phone ? 2.2 : 2.4));
    const s = mode === 'focus' ? r.worldToScreen((LAND[0] + POND[0]) / 2, LAND[1], 0.5) : null;
    const rect = r.canvas.getBoundingClientRect();
    const cx = s ? s.clientX : rect.left + rect.width / 2;
    const cy = s ? s.clientY : rect.top + rect.height / 2;
    const steps = Math.round(Math.log(z) / 0.15);
    for (let i = 0; i < steps; i++) r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
  }
  let selected = null;
  if (params.get('select') && placed[0]) {
    selected = placed[0].t.uid;
    r.setSelected(selected);
  }
  r.onTap((p) => {
    selected = p.towerUid;
    r.setSelected(selected);
  });

  // ---- labels (gallery) -------------------------------------------------------------------
  const labels = document.getElementById('labels');
  const tags = placed.map(({ t, id, build }) => {
    const d = document.createElement('div');
    d.className = 'tag';
    d.innerHTML = `<b>${UNIT_MAP[id].name}</b><span>${build}</span>`;
    labels.appendChild(d);
    return { d, t };
  });
  function placeLabels() {
    for (const { d, t } of tags) {
      const s = r.worldToScreen(t.x, t.y + 0.45, 0);
      d.style.transform = `translate(${s.x}px, ${s.y + 6}px) translate(-50%, 0)`;
      d.style.display = s.visible ? '' : 'none';
    }
  }
  labels.style.display = mode === 'gallery' && params.get('labels') !== '0' ? '' : 'none';

  // ---- HUD ---------------------------------------------------------------------------------
  const go = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    location.search = params.toString();
  };
  document.getElementById('modeG').classList.toggle('on', mode === 'gallery');
  document.getElementById('modeF').classList.toggle('on', mode === 'focus');
  document.getElementById('modeG').onclick = () => go({ mode: 'gallery' });
  document.getElementById('modeF').onclick = () => go({ mode: 'focus' });
  for (const q of ['high', 'medium', 'low']) {
    const b = document.getElementById(`q_${q}`);
    b.classList.toggle('on', q === quality);
    b.onclick = () => go({ quality: q });
  }
  const sb = document.getElementById('speed');
  sb.textContent = `${speed}×`;
  sb.onclick = () => {
    speed = speed >= 3 ? 1 : speed + 1;
    sb.textContent = `${speed}×`;
  };
  const fb = document.getElementById('fxBtn');
  fb.textContent = fxOn ? 'FX on' : 'FX off';
  fb.classList.toggle('on', fxOn);
  fb.onclick = () => go({ fx: fxOn ? 'off' : 'on' });
  let paused = false;
  document.getElementById('pause').onclick = (e) => {
    paused = !paused;
    e.currentTarget.textContent = paused ? '▶' : '⏸';
  };
  document.getElementById('title').textContent = mode === 'focus' ? `${UNIT_MAP[unit].name} · ${placed[0]?.build || ''}` : 'Attack FX';
  const list = document.getElementById('girls');
  for (const id of ORDER) {
    const row = document.createElement('div');
    row.className = 'girl';
    const name = document.createElement('button');
    name.className = 'name';
    name.textContent = UNIT_MAP[id].name;
    name.onclick = () => go({ mode: 'focus', unit: id, build: buildParam === 'max' ? 'base' : buildParam });
    row.appendChild(name);
    for (const b of ['base', 'p0', 'p1', 'p2']) {
      const btn = document.createElement('button');
      btn.textContent = b === 'base' ? '0-0-0' : BUILDS[b].join('-');
      if (mode === 'focus' && id === unit && b === buildParam) btn.className = 'on';
      btn.onclick = () => go({ mode: 'focus', unit: id, build: b });
      row.appendChild(btn);
    }
    if (id === unit && mode === 'focus') row.classList.add('sel');
    list.appendChild(row);
  }
  const statsEl = document.getElementById('stats');

  // ---- loop -------------------------------------------------------------------------------
  function step(dt) {
    const g = dt * speed;
    streamTick(g);
    sim.update(g);
    r.setTimeScale?.(speed);
    const ev = r.update(dt);
    if (ev && ev.length) {
      for (const e of ev) if (e.type === 'attack' || e.type === 'pulse' || e.type === 'beam' || e.type === 'chain' || e.type === 'trapTriggered') attacks++;
    }
  }
  let attacks = 0;
  /** Advances frame by frame until `n` more attack events happened (max `limit` frames); returns frames used. */
  window.__untilAttack = (n = 1, limit = 600, dt = 1 / 60) => {
    const goal = attacks + n;
    let k = 0;
    while (attacks < goal && k < limit) {
      step(dt);
      k++;
    }
    placeLabels();
    return k;
  };
  let frames = 0;
  let fpsT = 0;
  let fps = 0;
  function hud(dt) {
    frames++;
    fpsT += dt;
    if (fpsT < 0.5) return;
    fps = Math.round(frames / fpsT);
    frames = 0;
    fpsT = 0;
    const i = r.info;
    const a = i.attackFx;
    statsEl.textContent = a
      ? `${fps} fps · ${i.calls} calls · quads ${a.quads}/${a.quadBudget} · fx ${a.ms.toFixed(2)} ms · drones ${a.drones} (${a.engaged} out) · ${sim.enemies.length} enemies`
      : `${fps} fps · ${i.calls} calls · attack FX off · ${sim.enemies.length} enemies`;
  }
  window.__advance = (n = 1, dt = 1 / 60) => {
    for (let k = 0; k < n; k++) step(dt);
    placeLabels();
    return sim.time;
  };
  window.__frame = () => {
    r.update(0);
    return r.canvas.toDataURL('image/png');
  };
  window.__fxProbe = () => {
    const p = r.attackFxProbe ? r.attackFxProbe() : null;
    let turrets = 0;
    for (const t of sim.towers) turrets += t.turrets?.length || 0;
    return { ...(p || {}), turrets, time: sim.time, calls: r.info.calls, quality: r.info.quality, stats: r.info.attackFx };
  };
  window.__setSpeed = (s) => {
    speed = s;
  };
  /** Focus: swap the girl in place (sell everyone, place `id` with `build`, pre-roll `secs`). */
  window.__setup = (id, build = 'base', secs = 30, at = null) => {
    for (const t of [...sim.towers]) sim.sellTower(t.uid);
    const [bx, by] = at || boothOf(id);
    const t = snapPlace(sim, id, bx, by);
    if (!t) return null;
    applyBuild(sim, t, parseBuild(build, ORDER.indexOf(id)));
    placed.length = 0;
    placed.push({ t, id, build: t.tiers.join('-') });
    if (selected != null) {
      selected = t.uid;
      r.setSelected(selected);
    }
    for (let i = 0; i < secs * 10; i++) {
      streamTick(0.1);
      sim.update(0.1);
      if (i % 50 === 0) sim.drainEvents();
    }
    sim.drainEvents();
    r.update(0);
    document.getElementById('title').textContent = `${UNIT_MAP[id].name} · ${t.tiers.join('-')}`;
    return { uid: t.uid, tiers: t.tiers.slice() };
  };
  if (!manual) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused) step(dt);
      else r.update(0);
      placeLabels();
      hud(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    placeLabels();
  }
  document.body.dataset.ready = '1';
}

main().catch((e) => {
  document.getElementById('title').textContent = `Error: ${e.message}`;
  console.error(e);
});
