// Attack FX: unique, readable, purely visual attack animations (docs/ATTACK_FX.md).
//
// The sim decides every hit and its timing; this layer only reads sim state + events and draws:
// Chika's drones drawn where the sim flies them, origin-blended projectiles, landing reticles, sweeps,
// ripples, familiars… It never writes to a sim object (co-op lockstep stays deterministic).
//
// Hooks (BattleRenderer / actors):
//   onEvent(ev, i, events) → true = handled (skip the renderer's default effect)
//   projectile(p, dt)      → reused view {kind,x,y,z,scale,sz,tint,glow,yaw,skip} or null
//   towerOffset(uid)       → shared {x, z} model offset (lunge / recoil)
//   trapHidden(uid)        → true while a tossed seal is still in the air
//   update(dt)             → once per frame after actors.drawGround
import { createContext, CORE } from './context.js';
import { resolveStyle } from './registry.js';
import { tierLook, intensity, tierKey } from './flair.js';
import { progress, drawnPosition, BLEND_END } from './math/blend.js';
import { EventRing, matchImpact } from './math/victims.js';
import { Segments } from './patterns/segments.js';
import { Drones } from './patterns/drones.js';
import { Lunges } from './patterns/lunge.js';
import { Tosses } from './patterns/toss.js';
import { hitRadius } from '../../sim/towers.js';
import { heroLookTiers } from '../../sim/hero.js';
import { PROJECTILE_Z } from '../../sim/constants.js';

const DEFAULT_HR = 0.36;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param {{ sim, scene, actors, fx, batches, atlas, camera, rig, quality?, reduceMotion?, strict? }} o
 */
export function createAttackFx(o) {
  const { sim, actors } = o;
  const ctx = createContext(o);
  ctx.segs = new Segments(ctx, 96);
  ctx.drones = new Drones(ctx, actors.root || o.scene);
  ctx.lunge = new Lunges(ctx);
  ctx.toss = new Tosses(ctx);
  // extra per-frame layers a style adds once for the whole field (Kaede's blade streaks, ghosts,
  // hit flashes): { update(gdt, rdt), dispose() }, updated after the pooled quads, disposed with us
  ctx.layers = [];
  const strict = !!o.strict;

  // ---- per-tower state ------------------------------------------------------------------
  const tws = new Map();
  const twList = [];
  const twFree = [];
  function ensureTw(t) {
    let tw = tws.get(t.uid);
    if (tw) return tw;
    tw = twFree.pop() || { look: { accent: [0, 0, 0], look: -1, lookTier: 0, capstone: false, multi: false, tiers: [0, 0, 0] } };
    tw.uid = t.uid;
    tw.unitId = t.unitId;
    tw.style = resolveStyle(t);
    tw.key = -1;
    tw.behavior = '';
    tw.intensity = 1;
    tw.lastAttackT = -1e9;
    tw.clipT = -1e9;
    tw.lastTargetUid = null;
    tw.ramp = 0;
    tw.volleyIdx = 0;
    tw.volleyN = 1;
    tw.seen = frame;
    tw.statusTypes = 0;
    tw.data = null;
    tw.droneLook = null;
    tws.set(t.uid, tw);
    twList.push(tw);
    tw.data = tw.style.init ? tw.style.init(tw, t, ctx) : null;
    refreshLook(tw, t);
    return tw;
  }
  function refreshLook(tw, t) {
    const key = tierKey(t);
    const beh = t.eff?.behavior || '';
    if (key === tw.key && beh === tw.behavior) return;
    tw.key = key;
    tw.behavior = beh;
    // a hero's tiers stay [0,0,0]: her track level says which old path tiers she has reached
    if (t.isHero) tierLook(heroLookTiers(t.def, t.level), tw.look, { multi: true });
    else tierLook(t.tiers, tw.look);
    tw.intensity = intensity(t);
    tw.style.onUpgrade?.(tw, view(t), ctx);
  }

  // ---- projectiles ------------------------------------------------------------------------
  const recs = new Map();
  const recList = [];
  const recFree = [];
  const hits = new EventRing(64);
  const explodes = new EventRing(64);
  const pv = { kind: 'arrow', x: 0, y: 0, z: 0, scale: 1, sz: 1, tint: 0, glow: -1, yaw: NaN, roll: NaN, skip: false, k: 0 };
  const simPos = { x: 0, y: 0, z: 0 };

  // ---- stats ---------------------------------------------------------------------------------
  const stats = {
    drones: 0, dronesOverflow: 0, engaged: 0, droneShots: 0, projTracked: 0, blended: 0, familiars: 0, segments: 0, quads: 0,
    quadBudget: 0, shed: 0, ms: 0, msFrame: 0, maxDecor: 0, maxBlendResidual: 0, impacts: 0, matched: 0, defaultPulses: 0, styled: 0,
  };
  let frame = 1;
  let msAcc = 0;
  let timeScale = 1;
  let explicitScale = false;
  let lastSimTime = sim.time;
  let disposed = false;

  // strict test mode: style hooks get frozen deep clones (any write throws)
  function view(x) {
    return strict && x ? freezeClone(x) : x;
  }

  function onAttack(ev, i, events) {
    const t = sim.getTower ? sim.getTower(ev.towerUid) : null;
    if (!t) return false;
    const tw = ensureTw(t);
    tw.lastAttackT = ctx.time;
    if (ev.targetUid != null) tw.lastTargetUid = ev.targetUid;
    if (ev.ramp != null) tw.ramp = ev.ramp;
    const drone = ev.turretUid != null && (ev.kind === 'bullet' || ev.kind === 'build');
    if (!drone) {
      tw.volleyIdx = 0;
      tw.volleyN = Math.max(1, t.eff?.projectiles || 1);
      // body clip throttle (real time): stops the attack clip restarting every few frames
      if (ctx.rtime - tw.clipT >= 0.45) {
        ctx.actors.playAttack(ev.towerUid);
        tw.clipT = ctx.rtime;
      }
      const tv = view(t);
      if (tw.style.onAttack) tw.style.onAttack(ev, tw, tv, ctx, i, events);
      return true;
    }
    if (ev.kind === 'build') {
      if (ctx.rtime - tw.clipT >= 1.0) {
        ctx.actors.playAttack(ev.towerUid);
        tw.clipT = ctx.rtime;
      }
      ctx.drones.onBuild(ev, t);
      tw.style.onBuild?.(ev, tw, view(t), ctx);
      return true;
    }
    ctx.drones.onShot(ev, t);
    return true;
  }

  function ownerOfStatus(events, i) {
    for (let j = i + 1; j < events.length; j++) {
      const e = events[j];
      const ty = e.type;
      if (ty === 'hit' || ty === 'status' || ty === 'death' || ty === 'barrierBreak' || ty === 'shellBreak') continue;
      if ((ty === 'attack' || ty === 'pulse' || ty === 'beam' || ty === 'chain') && e.towerUid != null) return e.towerUid;
      return null;
    }
    return null;
  }

  function onEvent(ev, i, events) {
    if (disposed) return false;
    const t0 = now();
    let handled = false;
    switch (ev.type) {
      case 'hit':
        hits.push(ev.uid, ev.x, ev.y, 0, ev.crit);
        break;
      case 'explode':
        explodes.push(-1, ev.x, ev.y, ev.radius, false);
        break;
      case 'attack':
        handled = onAttack(ev, i, events);
        break;
      case 'pulse':
      case 'beam':
      case 'chain': {
        const t = ev.towerUid != null ? sim.getTower(ev.towerUid) : null;
        if (!t) break;
        const tw = ensureTw(t);
        const st = tw.style;
        const fn = ev.type === 'pulse' ? st.onPulse : ev.type === 'beam' ? st.onBeam : st.onChain;
        handled = fn ? !!fn(ev, tw, view(t), ctx, i, events) : false;
        if (ev.type === 'pulse' && !handled) stats.defaultPulses++;
        break;
      }
      case 'trapPlaced':
      case 'trapTriggered': {
        const t = sim.getTower(ev.ownerUid);
        if (!t) break;
        const tw = ensureTw(t);
        handled = tw.style.onTrap ? !!tw.style.onTrap(ev, tw, view(t), ctx) : false;
        break;
      }
      case 'cash': {
        if (ev.towerUid == null) break;
        const t = sim.getTower(ev.towerUid);
        if (!t) break;
        const tw = ensureTw(t);
        tw.style.onCash?.(ev, tw, view(t), ctx);
        break;
      }
      case 'status': {
        const owner = ownerOfStatus(events, i);
        for (let k = 0; k < twList.length; k++) {
          const tw = twList[k];
          if (!tw.style.onStatus) continue;
          if (owner != null ? owner !== tw.uid : tw.lastTargetUid !== ev.uid) continue;
          const t = sim.getTower(tw.uid);
          if (t) tw.style.onStatus(ev, tw, view(t), ctx);
        }
        break;
      }
      case 'upgrade':
      case 'place':
      case 'sell':
        break;
      default: {
        // B3 / future events that name a girl
        const uid = ev.towerUid ?? ev.ownerUid;
        if (uid == null) break;
        const tw = tws.get(uid);
        if (tw?.style.onOther) {
          const t = sim.getTower(uid);
          if (t) handled = !!tw.style.onOther(ev, tw, view(t), ctx, i, events);
        }
        break;
      }
    }
    msAcc += now() - t0;
    return handled;
  }

  // ---- projectile view ----------------------------------------------------------------------
  function newRec() {
    return recFree.pop() || {};
  }

  function projectile(p) {
    if (disposed) return null;
    const t0 = now();
    let rec = recs.get(p.uid);
    if (!rec) {
      const t = sim.getTower ? sim.getTower(p.ownerUid) : null;
      rec = newRec();
      rec.uid = p.uid;
      rec.ownerUid = p.ownerUid;
      rec.turretUid = p.turretUid ?? null;
      rec.kind = p.kind;
      rec.splash = p.splash || 0;
      rec.speed = p.speed || 10;
      rec.targetUid = p.target ? p.target.uid : null;
      rec.bend = 0;
      rec.bump = 0;
      rec.bendSign = (p.uid & 1) ? 1 : -1;
      rec.trailT = 0;
      rec.a = 0;
      rec.b = 0;
      rec.est = p.est || 1;
      rec.tw = null;
      rec.blended = false;
      rec.idx = 0;
      rec.n = 1;
      // sim spawn point S (a drone bullet starts at its drone)
      rec.sx = p.x;
      rec.sy = p.y;
      rec.sz = PROJECTILE_Z;
      if (t) {
        rec.sx = t.ox ?? t.x;
        rec.sy = t.oy ?? t.y;
        if (rec.turretUid != null && t.turrets) {
          for (let k = 0; k < t.turrets.length; k++) {
            const tu = t.turrets[k];
            if (tu.uid === rec.turretUid) {
              rec.sx = tu.x;
              rec.sy = tu.y;
            }
          }
          // Yuzuha's lane sentries (src/sim/sentries.js) fire from their own spot too
          for (const s of t.sentries || []) {
            if (s.uid === rec.turretUid) {
              rec.sx = s.x;
              rec.sy = s.y;
            }
          }
        }
      }
      rec.mx = rec.sx;
      rec.my = rec.sy;
      rec.mz = rec.sz;
      if (t) {
        const tw = ensureTw(t);
        rec.tw = tw;
        if (rec.turretUid != null) {
          rec.blended = ctx.drones.muzzleFor(rec.turretUid, rec);
        } else {
          rec.idx = tw.volleyIdx % tw.volleyN;
          rec.n = tw.volleyN;
          tw.volleyIdx++;
          if (tw.style.origin) {
            ctx.inOrigin = true;
            try {
              rec.blended = !!tw.style.origin(p, view(t), rec.idx, rec.n, rec, ctx);
            } finally {
              ctx.inOrigin = false;
            }
          }
          // a girl on a rooftop (Gate Arc 'U'): the shot leaves from her lifted height and blends
          // down to the sim's own height by f' = 0.6 (display only; the sim's z is untouched)
          const lift = ctx.lift(t);
          if (lift) {
            rec.mz += lift;
            rec.blended = true;
          }
        }
        tw.style.onSpawn?.(rec, view(p), view(t), ctx);
      }
      recs.set(p.uid, rec);
      recList.push(rec);
    }
    rec.seen = frame;
    rec.lastX = p.x;
    rec.lastY = p.y;
    // progress f′ and the drawn position
    const tgt = p.target;
    const hr = tgt && tgt.def ? hitRadius(tgt) : DEFAULT_HR;
    const dx = (p.tx ?? p.x) - p.x;
    const dy = (p.ty ?? p.y) - p.y;
    const f = progress(p.travel || 0, Math.sqrt(dx * dx + dy * dy), hr);
    rec.f = f;
    const tw = rec.tw;
    const st = tw ? tw.style : null;
    simPos.x = p.x;
    simPos.y = p.y;
    simPos.z = p.z ?? PROJECTILE_Z;
    pv.kind = p.kind;
    pv.scale = 1;
    pv.sz = 1;
    pv.tint = 0;
    pv.glow = -1;
    pv.yaw = NaN;
    pv.roll = NaN;
    pv.skip = false;
    let nx = 0;
    let ny = 0;
    if (rec.bend) {
      const vl = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      nx = (-p.vy / vl) * rec.bendSign;
      ny = (p.vx / vl) * rec.bendSign;
    }
    drawnPosition(simPos, rec, f, rec.bump, rec.bend, nx, ny, pv);
    if (st && st.view) st.view(view(p), rec, null, pv, ctx);
    if (rec.turretUid != null && tw && tw.droneLook) {
      if (tw.droneLook.bulletTint) pv.tint = tw.droneLook.bulletTint;
      if (tw.droneLook.bulletGlow >= 0) pv.glow = tw.droneLook.bulletGlow;
    }
    if (f >= BLEND_END) {
      const res = Math.hypot(pv.x - p.x, pv.y - p.y);
      if (res > stats.maxBlendResidual) stats.maxBlendResidual = res;
    }
    msAcc += now() - t0;
    const touched = rec.blended || rec.bump || rec.bend || (st && st.view) || pv.tint || pv.glow >= 0 || pv.skip;
    return touched ? pv : null;
  }

  // ---- frame ---------------------------------------------------------------------------------
  function update(d) {
    if (disposed) return;
    const t0 = now();
    ctx.rdt = d;
    ctx.rtime += d;
    if (!explicitScale && d > 0) {
      const est = Math.max(0, Math.min(3, (sim.time - lastSimTime) / d));
      timeScale += (est - timeScale) * 0.2;
    }
    lastSimTime = sim.time;
    const gdt = d * timeScale;
    ctx.timeScale = timeScale;
    ctx.gdt = gdt;
    ctx.time += gdt;
    ctx.frame = frame;
    const pxPerTile = 1 / Math.max(1e-6, ctx.rig?.scale || 1 / 42);
    ctx.readScale = Math.max(1, Math.min(1.3, 42 / pxPerTile));

    // girls: looks + per-style frame work
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      const tw = ensureTw(t);
      tw.seen = frame;
      refreshLook(tw, t);
      if (tw.style.update) tw.style.update(gdt, tw, view(t), ctx);
    }
    for (let i = twList.length - 1; i >= 0; i--) {
      const tw = twList[i];
      if (tw.seen === frame) continue;
      tw.style.onRemove?.(tw, ctx);
      tws.delete(tw.uid);
      twList[i] = twList[twList.length - 1];
      twList.length--;
      tw.data = null;
      twFree.push(tw);
    }

    // drones (style looks are applied to their groups first)
    for (let i = 0; i < twList.length; i++) {
      const tw = twList[i];
      if (!tw.droneLook) continue;
      const g = ctx.drones.groups.get(tw.uid);
      if (g) g.look = tw.droneLook;
    }
    ctx.drones.update(gdt);
    ctx.lunge.update(gdt);
    ctx.toss.update(gdt);

    // vanished projectiles: flourish only on a matched sim hit / explode (never on expiry)
    let blended = 0;
    for (let i = recList.length - 1; i >= 0; i--) {
      const rec = recList[i];
      if (rec.seen === frame) {
        if (rec.blended) blended++;
        continue;
      }
      const st = rec.tw?.style;
      if (st && st.onImpact) {
        const ring = rec.splash > 0 ? explodes : hits;
        const tol = rec.speed * Math.max(gdt, 1 / 60) + 0.6;
        const slot = matchImpact(ring, rec.lastX, rec.lastY, rec.splash > 0 ? null : rec.targetUid, tol);
        if (slot >= 0) {
          ring.used[slot] = 1;
          stats.matched++;
          if (ctx.cap('impact')) {
            stats.impacts++;
            st.onImpact(rec, ring.x[slot], ring.y[slot], ring.crit[slot] === 1, ring.r[slot], ctx);
          }
        }
      }
      recs.delete(rec.uid);
      recList[i] = recList[recList.length - 1];
      recList.length--;
      rec.tw = null;
      recFree.push(rec);
    }
    hits.clear();
    explodes.clear();

    ctx.pool.update(gdt);
    ctx.segs.update(gdt);
    for (let i = 0; i < ctx.layers.length; i++) ctx.layers[i].update(gdt, d);

    // stats
    msAcc += now() - t0;
    stats.msFrame = msAcc;
    stats.ms += (msAcc - stats.ms) * 0.1;
    msAcc = 0;
    stats.drones = ctx.drones.count;
    stats.dronesOverflow = ctx.drones.overflow;
    stats.droneShots = ctx.drones.shots;
    let engaged = 0;
    for (let i = 0; i < ctx.drones.list.length; i++) if (ctx.drones.list[i].state === 'HUNT') engaged++;
    stats.engaged = engaged;
    stats.maxDecor = ctx.drones.maxDecor;
    stats.projTracked = recList.length;
    stats.blended = blended;
    stats.segments = ctx.segs.count;
    stats.quads = ctx.quads;
    stats.quadBudget = ctx.q.quadBudget;
    stats.shed = ctx.shed;
    stats.styled = twList.length;
    frame++;
    ctx.beginFrame();
  }

  ctx.beginFrame();

  return {
    /** actors skips its own drone mesh + shadows when this is truthy */
    drones: true,
    ctx,
    onEvent,
    projectile,
    towerOffset(uid) {
      return ctx.lunge.offset(uid);
    },
    trapHidden(uid) {
      return ctx.toss.hidden(uid);
    },
    update,
    setQuality(q) {
      ctx.setQuality(q);
    },
    setSelected(uid) {
      ctx.selectedUid = uid ?? null;
    },
    setTimeScale(s) {
      if (!(s >= 0)) return;
      explicitScale = true;
      timeScale = Math.min(8, s);
    },
    stats() {
      return stats;
    },
    /** Snapshot for e2e probes (allocates — dev tooling only). */
    probe() {
      const blends = [];
      for (const rec of recList) blends.push({ uid: rec.uid, f: rec.f, turret: rec.turretUid, blended: rec.blended });
      return { drones: ctx.drones.probe(), blends, stats: { ...stats }, time: ctx.time, timeScale };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ctx.drones.dispose();
      ctx.pool.clear();
      ctx.segs.clear();
      ctx.toss.clear();
      for (const L of ctx.layers) L.dispose();
      ctx.layers.length = 0;
      tws.clear();
      recs.clear();
    },
  };
}

/** Deep clone + deep freeze (strict test mode only). */
function freezeClone(x) {
  const seen = new Map();
  const clone = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return seen.get(v);
    const out = Array.isArray(v) ? [] : {};
    seen.set(v, out);
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out;
  };
  const deepFreeze = (v, done = new Set()) => {
    if (v === null || typeof v !== 'object' || done.has(v)) return v;
    done.add(v);
    for (const k of Object.keys(v)) deepFreeze(v[k], done);
    return Object.freeze(v);
  };
  return deepFreeze(clone(x));
}

export { CORE };
