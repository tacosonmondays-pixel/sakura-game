// Dev preview for free (Bloons-style) placement: real renderer + real sim on a real stage.
//   ?stage=1-1 &quality=high|medium|low &seed=1
//   &hold=aoi          pick a girl → ghost follows the mouse (white circle = ok, red = no), tap/click places
//   &ghost=rei,7.3,4.1 put a ghost at a continuous point (red when invalid)
//   &place=aoi:6.3:1.7,rei:9.4:5.2   place girls at continuous points (x:y)
//   &auto=1            run autoPlan (continuous lattice) for the default team
//   &rules=0           hide the 2D rules map in the corner
// The 2D "rules map" in the corner rasterises sim.placementReason for the held girl, so the
// geometry can be judged independently of the 3D overlay.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { autoPlan } from '../src/sim/headless.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { STAGES } from '../src/data/stages.js';
import { UNIT_MAP } from '../src/data/units.js';

const params = new URLSearchParams(location.search);
const stageId = params.get('stage') || '1-1';
const quality = params.get('quality') || 'high';
const seed = Number(params.get('seed') || 1);
const TEAM = ['aoi', 'rei', 'akane', 'kage', 'yuki', 'sango', 'umeko', 'hotaru', 'hikari'];
const REASON_COLORS = { path: '#ff2a4f', blocked: '#5a6070', needsLand: '#4cc9f0', needsWater: '#4cc9f0', occupied: '#ff9f1c', outOfBounds: '#000000' };

async function main() {
  await preloadModels();
  const heroId = 'hikari';
  const towers = TEAM.filter((id) => id !== heroId);
  const sim = new Sim({ stageId, difficulty: 'normal', seed, loadout: towers.map((unitId) => ({ unitId })), hero: { unitId: heroId } });
  sim.cash = 1e6;

  for (const part of (params.get('place') || '').split(',').filter(Boolean)) {
    const [id, x, y] = part.split(':');
    const t = sim.placeTower(id, Number(x), Number(y));
    if (!t) console.warn('could not place', id, x, y, sim.canPlace(id, Number(x), Number(y)));
  }
  const runAuto = () => {
    for (const a of autoPlan(stageId, TEAM)) {
      if (a.action === 'place') sim.placeTower(a.unitId, a.x, a.y);
      else if (a.action === 'upgrade') {
        const t = sim.towerAt(a.x, a.y);
        if (t) sim.upgradeTower(t.uid, a.path);
      }
    }
  };
  if (params.get('auto')) runAuto();

  const el = document.getElementById('stage');
  const r = createBattleRenderer(el, sim, { quality, settings: { quality }, insets: { top: 56, right: 0, bottom: 0, left: 0 } });
  window.__sim = sim;
  window.__r = r;

  let hold = params.get('hold') || null;
  let ghost = null;
  const setHold = (id) => {
    hold = id && UNIT_MAP[id] ? id : null;
    r.showTileHints(hold);
    if (!hold) r.setGhost(null);
    drawRules();
    document.getElementById('modeBtn').classList.toggle('on', !!hold);
  };
  if (params.get('ghost')) {
    const [u, gx, gy] = params.get('ghost').split(',');
    ghost = { u, x: Number(gx), y: Number(gy) };
    const chk = sim.canPlace(u, ghost.x, ghost.y);
    r.setGhost(u, ghost.x, ghost.y, chk.ok);
    if (!chk.ok) r.shakeGhost();
  }

  // ---- 2D rules map ------------------------------------------------------------------
  const rc = document.getElementById('rules');
  const PX = 6;
  rc.width = sim.map.width * PX;
  rc.height = sim.map.height * PX;
  rc.style.width = `${Math.min(300, sim.map.width * PX)}px`;
  if (params.get('rules') === '0') rc.style.display = 'none';
  function drawRules() {
    const g = rc.getContext('2d');
    g.fillStyle = '#cfe9a9';
    g.fillRect(0, 0, rc.width, rc.height);
    const id = hold || 'aoi';
    for (let j = 0; j < rc.height; j++) {
      for (let i = 0; i < rc.width; i++) {
        const reason = sim.placementReason(id, (i + 0.5) / PX, (j + 0.5) / PX);
        if (!reason) continue;
        g.fillStyle = REASON_COLORS[reason] || '#000';
        g.fillRect(i, j, 1, 1);
      }
    }
    g.strokeStyle = '#fff';
    for (const t of sim.towers) {
      g.beginPath();
      g.arc(t.x * PX, t.y * PX, t.radius * PX, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // ---- interaction: hover ghost + tap to place --------------------------------------
  const info = document.getElementById('info');
  r.canvas.addEventListener('pointermove', (e) => {
    if (!hold) return;
    const p = r.pick(e.clientX, e.clientY);
    if (!p.inBounds) return r.setGhost(null);
    const chk = sim.canPlace(hold, p.x, p.y);
    r.setGhost(hold, p.x, p.y, chk.ok);
    info.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)} → ${chk.ok ? 'ok' : chk.reason}`;
  });
  r.onTap((p) => {
    if (hold) {
      const chk = sim.canPlace(hold, p.x, p.y);
      if (chk.ok) sim.placeTower(hold, p.x, p.y);
      else {
        r.setGhost(hold, p.x, p.y, false);
        r.shakeGhost();
      }
      info.textContent = `tap ${p.x.toFixed(2)}, ${p.y.toFixed(2)} → ${chk.ok ? 'placed' : chk.reason}`;
      drawRules();
      return;
    }
    r.setSelected(p.towerUid);
    info.textContent = `tap ${p.x?.toFixed(2)}, ${p.y?.toFixed(2)} tower=${p.towerUid}`;
  });

  // ---- HUD ---------------------------------------------------------------------------
  const sel = document.getElementById('stageSel');
  for (const s of STAGES.filter((x) => x.kind !== 'challenge')) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.id} · ${s.name}`;
    if (s.id === stageId) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    params.set('stage', sel.value);
    location.search = params.toString();
  };
  const us = document.getElementById('unitSel');
  for (const id of TEAM) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = `${UNIT_MAP[id].name}${UNIT_MAP[id].placement === 'water' ? ' (water)' : UNIT_MAP[id].kind === 'hero' ? ' (hero)' : ''}`;
    if (id === hold) o.selected = true;
    us.appendChild(o);
  }
  us.onchange = () => setHold(us.value);
  document.getElementById('modeBtn').onclick = () => setHold(hold ? null : us.value);
  document.getElementById('autoBtn').onclick = () => {
    runAuto();
    drawRules();
  };
  document.getElementById('clearBtn').onclick = () => {
    for (const t of [...sim.towers]) sim.sellTower(t.uid);
    drawRules();
  };
  document.getElementById('title').textContent = `${sim.stage.name} — ${sim.map.name} · free placement`;
  setHold(hold);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    sim.update(dt);
    r.update(dt);
    document.getElementById('status').textContent = `${sim.towers.length} girls · ${sim.cash}c · ${sim.state}`;
    requestAnimationFrame(frame);
  }
  r.update(0.016);
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
}

main().catch((e) => {
  document.getElementById('title').textContent = `Error: ${e.message}`;
  console.error(e);
});
