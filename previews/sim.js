// Dev-only top-down debug view of the battle simulation (not part of the game build).
// URL params: ?stage=1-1 (real data when available) &difficulty=normal &seed=1 &speed=3 &t=60 (fast-forward s)
import { Sim } from '../src/sim/Sim.js';
import { autoPlan } from '../src/sim/headless.js';
import { defaultData, hasRealData } from '../src/sim/data.js';
import { ATTACK_TYPES, ELEMENTS } from '../src/data/types.js';

const params = new URLSearchParams(location.search);
const difficulty = params.get('difficulty') || 'normal';
const seed = Number(params.get('seed') || 1);
const speed = Number(params.get('speed') || 3);
const fastForward = Number(params.get('t') || 0);

// ---------------------------------------------------------------------------
// Demo content (used until the world data files exist): one enemy per family rule.
// ---------------------------------------------------------------------------
const E = (id, name, o) => ({
  id, name, family: 'slime', tier: 'normal', hp: 14, speed: 1, armorClass: 'light', armor: 0, bounty: 1, leak: 1,
  threat: 1, size: 1, color: '#7bd389', accent: '#fff', traits: {}, ...o,
});
const DEMO_ENEMIES = {
  slime: E('slime', 'Green Slime', {}),
  runner: E('runner', 'Goblin Runner', { family: 'goblin', hp: 10, speed: 1.7, color: '#9bc53d', traits: { hasty: { mul: 1.8, every: 4, duration: 1 } } }),
  orc: E('orc', 'Ironhide Orc', { family: 'orc', hp: 60, armor: 3, armorClass: 'heavy', speed: 0.7, threat: 5, bounty: 4, color: '#7f8c8d' }),
  wraith: E('wraith', 'Veil Wraith', { family: 'ghost', hp: 30, armorClass: 'spectral', speed: 0.9, threat: 3, bounty: 3, color: '#c77dff', traits: { veiled: true } }),
  oni: E('oni', 'Shield Oni', { family: 'oni', tier: 'elite', hp: 220, armorClass: 'warded', speed: 0.6, threat: 14, bounty: 15, color: '#ff6b6b', traits: { field: { kind: 'shield', radius: 1.8, amount: 0.3 } } }),
  ghoul: E('ghoul', 'Gloom Ghoul', { family: 'ghoul', hp: 70, armorClass: 'spectral', speed: 0.8, threat: 5, bounty: 5, color: '#6c757d', traits: { siphon: { radius: 1.5, rate: 3 } } }),
  wyvern: E('wyvern', 'Wyvern', { family: 'dragon', hp: 45, armorClass: 'scaled', speed: 1.2, threat: 5, bounty: 5, color: '#e0a458', traits: { airborne: true } }),
  pod: E('pod', 'Seed Pod', { family: 'plant', hp: 40, speed: 0.8, threat: 4, bounty: 2, color: '#52b788', traits: { brood: { spawn: 'slime', count: 3 } } }),
  prince: E('prince', 'Slime Prince', { tier: 'miniboss', hp: 2600, speed: 0.45, threat: 80, bounty: 120, leak: 25, size: 2.2, color: '#4cc9f0', counters: 'Focus fire with Priority targeting.', phases: [{ atHp: 0.5, announce: 'The Slime Prince splits his crown jewels!', set: { speed: 0.7 } }] }),
};
const DEMO_MAP = {
  id: 'demo', name: 'Petal Crossing', theme: 'sakura', tier: 'intermediate', width: 20, height: 12,
  rows: [
    '....................',
    '..T.......,,........',
    '....................',
    '.....~~~~~......R...',
    '.....~~~~~..........',
    '.....~~~~~....T.....',
    '....................',
    '..R.........,,......',
    '....................',
    '.......T............',
    '....................',
    'XXXXXXXXXXXXXXXXXXXX',
  ],
  paths: [[[-1, 2], [15, 2], [15, 8], [3, 8], [3, 5], [1, 5], [1, 10], [20, 10]]],
};
const DEMO_STAGE = {
  id: 'demo', kind: 'campaign', name: 'Demo', mapId: 'demo', waves: 14, hpScale: 1.2, startCash: 900, lives: 100,
  waveGen: {
    pool: [
      { enemy: 'slime', weight: 3, from: 1 }, { enemy: 'runner', weight: 2, from: 2 }, { enemy: 'orc', weight: 2, from: 4 },
      { enemy: 'wraith', weight: 2, from: 5 }, { enemy: 'pod', weight: 1, from: 6 }, { enemy: 'ghoul', weight: 1, from: 7 },
      { enemy: 'wyvern', weight: 1, from: 8 }, { enemy: 'oni', weight: 1, from: 9 },
    ],
    budget: { start: 9, growth: 1.2 }, spacing: 0.7, groups: 3, fixed: [{ wave: 14, enemy: 'prince', count: 1, delay: 4 }],
  },
  introduces: ['wraith', 'veiled', 'oni'], recommended: [], unlocks: {}, requires: null, drops: [], firstClear: [], scenery: { props: [] }, tier: 'intermediate',
};
const DEMO_TEAM = ['aoi', 'rei', 'akane', 'kage', 'yuki', 'sango', 'hotaru', 'suzu', 'hikari'];

// ---------------------------------------------------------------------------
// Build the battle
// ---------------------------------------------------------------------------
const real = hasRealData();
const dd = defaultData();
const stageId = params.get('stage') || (real ? '1-1' : 'demo');
const data = real && dd.stages[stageId] ? undefined : { stage: DEMO_STAGE, map: DEMO_MAP, enemies: DEMO_ENEMIES };
const team = (params.get('team') || DEMO_TEAM.join(',')).split(',').filter((id) => dd.units[id]);
const heroId = team.find((id) => dd.units[id].kind === 'hero') || null;
const sim = new Sim({
  stageId, difficulty, seed,
  loadout: team.filter((id) => id !== heroId).map((unitId) => ({ unitId })),
  hero: heroId ? { unitId: heroId } : null,
  options: { autoStart: true },
  data,
});
const plan = autoPlan(stageId, team, { data });

function runPlan() {
  while (plan.length) {
    const a = plan[0];
    if (a.action === 'place') {
      const chk = sim.canPlace(a.unitId, a.tx, a.ty);
      if (chk.reason === 'cash') return;
      if (chk.ok) sim.placeTower(a.unitId, a.tx, a.ty);
    } else {
      const t = sim.towerAt(a.tx, a.ty);
      if (t) {
        const st = sim.upgradeStatus(t.uid, a.path);
        if (st.reason === 'cash') return;
        if (!st.locked) sim.upgradeTower(t.uid, a.path);
      }
    }
    plan.shift();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const TILE_COLORS = { '.': '#a8db8f', ',': '#b9e3a0', '~': '#7cc8f0', T: '#5c9e5a', R: '#a0a6ad', H: '#c9a27e', B: '#c9a27e', X: '#3b4252' };
const FIELD_COLORS = { haste: '#ffd84d', shield: '#4cc9f0', regen: '#80ed99' };
const fx = [];
const logLines = [];
let px = 32;

function resize() {
  const w = canvas.clientWidth || 800;
  px = Math.floor(w / sim.map.width);
  canvas.width = px * sim.map.width;
  canvas.height = px * sim.map.height;
}

function colorOf(spec) {
  return (spec.element && ELEMENTS[spec.element]?.color) || ATTACK_TYPES[spec.attackType]?.color || '#fff';
}

function circle(x, y, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.arc(x * px, y * px, r * px, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function drawMap() {
  const { map } = sim;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.rows[y][x];
      ctx.fillStyle = sim.pathTiles.has(`${x},${y}`) ? '#ecd9b0' : TILE_COLORS[ch] || '#a8db8f';
      ctx.fillRect(x * px, y * px, px, px);
      if (ch === 'T') circle(x + 0.5, y + 0.5, 0.38, '#3f7d3c');
      if (ch === 'R') circle(x + 0.5, y + 0.55, 0.3, '#7d848c');
    }
  }
  ctx.strokeStyle = '#0001';
  for (let x = 0; x <= map.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px, 0);
    ctx.lineTo(x * px, map.height * px);
    ctx.stroke();
  }
  for (let y = 0; y <= map.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * px);
    ctx.lineTo(map.width * px, y * px);
    ctx.stroke();
  }
  ctx.setLineDash([px * 0.2, px * 0.2]);
  ctx.strokeStyle = '#b08a5a';
  ctx.lineWidth = 2;
  for (const poly of sim.paths) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * px, y * px) : ctx.moveTo(x * px, y * px)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawTowers() {
  for (const t of sim.towers) {
    circle(t.x, t.y, t.eff.range, 'rgba(255,255,255,0.06)', 'rgba(29,43,79,0.12)');
  }
  for (const t of sim.towers) {
    const pal = t.def.palette || {};
    circle(t.x, t.y, t.isHero ? 0.42 : 0.36, pal.outfit || '#ffffff', t.buffed ? '#ffd84d' : '#1d2b4f', t.buffed ? 3 : 1.5);
    circle(t.x, t.y, 0.18, pal.hair || '#1d2b4f');
    ctx.strokeStyle = '#1d2b4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x * px, t.y * px);
    ctx.lineTo((t.x + Math.sin(t.facing) * 0.45) * px, (t.y + Math.cos(t.facing) * 0.45) * px);
    ctx.stroke();
    ctx.fillStyle = '#1d2b4f';
    ctx.font = `bold ${Math.max(9, px * 0.28)}px system-ui`;
    ctx.textAlign = 'center';
    const label = t.isHero ? `${t.def.name} L${t.level}` : `${t.def.name} ${t.tiers.join('')}`;
    ctx.fillText(label, t.x * px, (t.y + 0.75) * px);
    if (t.disabled > 0) circle(t.x, t.y, 0.45, 'rgba(60,60,60,0.45)');
    for (const tu of t.turrets) {
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect((tu.x - 0.1) * px, (tu.y - 0.1) * px, 0.2 * px, 0.2 * px);
    }
  }
}

function drawEnemies() {
  for (const f of sim.fields) {
    ctx.setLineDash(f.silenced ? [4, 4] : []);
    circle(f.x, f.y, f.radius, f.silenced ? null : `${FIELD_COLORS[f.kind]}22`, f.silenced ? '#888' : FIELD_COLORS[f.kind], 2);
    ctx.setLineDash([]);
  }
  for (const tr of sim.traps) {
    ctx.save();
    ctx.translate(tr.x * px, tr.y * px);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = tr.armed ? '#ff9f1c' : '#666';
    ctx.fillRect(-0.12 * px, -0.12 * px, 0.24 * px, 0.24 * px);
    ctx.restore();
  }
  for (const e of sim.enemies) {
    const r = 0.18 + 0.07 * (e.def.size ?? 1);
    const lift = e.alt * 0.35;
    if (e.airborne) circle(e.x, e.y, r * 0.8, 'rgba(0,0,0,0.18)');
    ctx.globalAlpha = e.veiled && !e.revealed ? 0.35 : 1;
    ctx.setLineDash(e.phasing ? [3, 3] : []);
    const ring = e.statuses.slow || e.statuses.freeze ? '#7fdbff' : e.statuses.burn ? '#ff6b35' : e.statuses.poison ? '#7bd389' : '#1d2b4f';
    circle(e.x, e.y - lift, r, e.flash > 0.5 ? '#ffffff' : e.def.color || '#7bd389', ring, e.tier === 'normal' ? 1.5 : 3);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const w = 0.6;
    const bx = (e.x - w / 2) * px;
    const by = (e.y - lift - r - 0.14) * px;
    ctx.fillStyle = '#0006';
    ctx.fillRect(bx, by, w * px, 4);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#80ed99' : e.hp / e.maxHp > 0.25 ? '#ffd166' : '#ff4d6d';
    ctx.fillRect(bx, by, w * px * Math.max(0, e.hp / e.maxHp), 4);
    if (e.maxBarrier > 0) {
      ctx.fillStyle = '#9ad0ff';
      ctx.fillRect(bx, by - 4, w * px * (e.barrier / e.maxBarrier), 3);
    }
  }
}

function drawProjectiles() {
  for (const p of sim.projectiles) circle(p.x, p.y - p.z * 0.2, 0.07 + p.z * 0.02, colorOf(p), '#1d2b4f', 1);
}

function drawFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) {
      fx.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.min(1, f.life / 0.25);
    if (f.type === 'ring') circle(f.x, f.y, f.r, null, f.color, 3);
    if (f.type === 'line') {
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.w;
      ctx.beginPath();
      f.points.forEach(([x, y], k) => (k ? ctx.lineTo(x * px, y * px) : ctx.moveTo(x * px, y * px)));
      ctx.stroke();
    }
    if (f.type === 'text') {
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.max(10, px * 0.3)}px system-ui`;
      ctx.fillText(f.text, f.x * px, (f.y - (0.6 - f.life)) * px);
    }
    ctx.globalAlpha = 1;
  }
}

function consumeEvents() {
  for (const ev of sim.drainEvents()) {
    switch (ev.type) {
      case 'explode': fx.push({ type: 'ring', x: ev.x, y: ev.y, r: ev.radius, color: ev.volatile ? '#ff4d6d' : '#ff9f1c', life: 0.3 }); break;
      case 'pulse': fx.push({ type: 'ring', x: ev.x, y: ev.y, r: ev.radius, color: colorOf(ev), life: 0.25 }); break;
      case 'beam': fx.push({ type: 'line', points: [ev.from, ev.to], color: ev.color, w: ev.width * px, life: 0.15 }); break;
      case 'chain': fx.push({ type: 'line', points: ev.points, color: '#ffe066', w: 2, life: 0.2 }); break;
      case 'teleportWarn': fx.push({ type: 'ring', x: ev.x, y: ev.y, r: 0.4, color: '#c77dff', life: 0.8 }); break;
      case 'death': if (ev.bounty) fx.push({ type: 'text', x: ev.x, y: ev.y, text: `+${ev.bounty}`, color: '#b8860b', life: 0.6 }); break;
      case 'waveStart': case 'waveEnd': case 'bossPhase': case 'leak': case 'heroLevel': case 'ult': case 'sabotage': case 'won': case 'lost':
        logLines.unshift(`[${sim.time.toFixed(1)}s] ${ev.type} ${JSON.stringify(Object.fromEntries(Object.entries(ev).filter(([k]) => k !== 'type')))}`);
        break;
      default: break;
    }
  }
  if (logLines.length > 60) logLines.length = 60;
}

function renderPanels() {
  document.getElementById('hud').textContent = `${sim.stage.name} · ${difficulty} · wave ${sim.wave}/${sim.totalWaves} · lives ${sim.lives}/${sim.maxLives} · cash ${sim.cash} · ${sim.state} · ${sim.enemies.length} enemies · ${speed}×`;
  const warn = sim.waveWarnings();
  const scout = sim.nextWavePreview().map((w) => `${dd.enemies[w.enemyId]?.name || DEMO_ENEMIES[w.enemyId]?.name || w.enemyId} ×${w.count}`).join(', ');
  document.getElementById('warnings').innerHTML = `<div class="warn">${scout || '—'}</div>`
    + warn.map((w) => `<div class="warn warn-${w.severity}">${w.text}</div>`).join('');
  document.getElementById('debrief').innerHTML = sim.debrief().lines.map((l) => `<div>${l}</div>`).join('');
  document.getElementById('log').textContent = logLines.join('\n');
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
resize();
window.addEventListener('resize', resize);
runPlan();
sim.startNextWave();
for (let t = 0; t < fastForward; t += 0.25) {
  runPlan();
  sim.update(0.25);
  if (t < fastForward - 1) sim.drainEvents();
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  runPlan();
  sim.update(dt * speed);
  consumeEvents();
  drawMap();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawFx(dt);
  renderPanels();
  requestAnimationFrame(frame);
}
consumeEvents();
renderPanels();
requestAnimationFrame(frame);
window.__sim = sim;
