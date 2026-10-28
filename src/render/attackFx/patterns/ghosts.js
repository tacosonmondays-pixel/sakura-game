// Dash afterimages: fading, tinted copies of a girl's own figure, left behind along a lunge.
//
// Each girl gets a small set of ghost figures the first time she dashes: copies of her actor model
// (same geometry, shared with the live figure and never disposed here; her outlines, halo and any
// sprites hidden) wearing one flat additive material each. A ghost is a SNAPSHOT: when it spawns it
// copies the live figure's transform and every node's pose (bones included), then only fades.
// Nothing is allocated per dash: slots are reused oldest-first, the materials only change opacity.
//
// Display only. The live figure is read, never changed (her userData is swapped out for the instant
// of the copy so three's clone does not try to serialise her animator, then put back).
// Quality: no ghosts on low or Reduce motion (no lunge either); `ghostPlan` sets the count.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

/** Ghost counts per quality (2–4 copies, ≈ 200 ms), the field-wide cap and the dash throttle. */
export const GHOST_PLAN = {
  high: { count: 4, interval: 0.03, life: 0.2, cap: 12 },
  medium: { count: 2, interval: 0.05, life: 0.2, cap: 6 },
  low: { count: 0, interval: 0, life: 0, cap: 0 },
};
/** A new dash within this many game seconds of the last one leaves no new ghosts (fast swings). */
export const DASH_GAP = 0.3;

/** Plan for a quality / motion setting (pure). */
export function ghostPlan(quality, reduceMotion) {
  if (reduceMotion) return GHOST_PLAN.low;
  return GHOST_PLAN[quality] || GHOST_PLAN.medium;
}

/**
 * How far ahead of her figure ghost `idx` of `count` stands (pure): the copies step out toward her
 * target one after another (`reach` tiles for the last), so the dash reads as a flash forward even
 * though her model only lunges a quarter tile.
 */
export function dashOffset(idx, count, reach) {
  if (!(reach > 0) || count <= 0) return 0;
  return (reach * (idx + 1)) / count;
}

/** Opacity of ghost `idx` (0 = the first, oldest one of its dash) at life fraction k (pure). */
export function ghostAlpha(k, idx, count, peak = 0.55) {
  if (k >= 1) return 0;
  k = k < 0 ? 0 : k;
  // the later copies (closer to her) are brighter
  const rank = count > 1 ? 0.55 + 0.45 * (idx / (count - 1)) : 1;
  const f = 1 - k;
  return peak * rank * f * f;
}

const NOOP = THREE.Object3D.prototype.onBeforeRender;

export class GhostLayer {
  /**
   * @param {{ actors, quality, reduceMotion }} ctx attack-FX context (reads ctx.actors.towers)
   * @param {THREE.Object3D|null} parent where ghosts live (the actors root)
   */
  constructor(ctx, parent) {
    this.ctx = ctx;
    this.parent = parent;
    /** uid -> { src, first, n, slots[], next, dash } */
    this.sets = new Map();
    this.alive = 0;
    this.peak = 0;
    this.built = 0;
    this._stash = [];
    this._nodes = null;
  }

  /** Is a ghost dash possible for this girl right now (quality, motion, a real 3D figure)? */
  enabled(uid) {
    if (!(ghostPlan(this.ctx.quality, this.ctx.reduceMotion).count > 0) || !this.parent) return false;
    return uid == null || !!this.ctx.actors?.towers?.get(uid)?.model?.isObject3D;
  }

  /**
   * Starts a dash: `count` snapshots of her figure `interval` game seconds apart, each fading over
   * `life`. Colours: `cols[i]` for snapshot i (cycled). (dx, dz) = the way she lunges (normalised
   * here), `reach` = how far ahead of her the last copy stands (dashOffset). Returns false when
   * nothing will be drawn.
   */
  dash(uid, cols, dx = 0, dz = 0, reach = 0) {
    const plan = ghostPlan(this.ctx.quality, this.ctx.reduceMotion);
    if (!plan.count || !this.parent) return false;
    const set = this._set(uid, plan.count);
    if (!set) return false;
    const d = set.dash;
    if (d.on && d.t < DASH_GAP) return false;
    d.on = true;
    d.t = 0;
    d.done = 0;
    d.count = plan.count;
    d.interval = plan.interval;
    d.life = plan.life;
    d.cols = cols;
    const l = Math.hypot(dx, dz);
    d.ux = l > 1e-6 ? dx / l : 0;
    d.uz = l > 1e-6 ? dz / l : 0;
    d.reach = l > 1e-6 ? Math.max(0, reach) : 0;
    return true;
  }

  /**
   * Ghosts at given ground points instead of along her live lunge (a dash drawn across the field:
   * Flash Lunge). `pts` = [x0, z0, facing0, x1, z1, facing1, …] (read at once, not kept).
   */
  trail(uid, pts, cols) {
    const plan = ghostPlan(this.ctx.quality, this.ctx.reduceMotion);
    if (!plan.count || !this.parent) return 0;
    const set = this._set(uid, plan.count);
    if (!set) return 0;
    const n = Math.min(set.slots.length, Math.floor(pts.length / 3));
    let k = 0;
    for (let i = 0; i < n; i++) {
      const g = this._spawn(set, cols[i % cols.length], i, n, plan.life * 1.5);
      if (!g) break;
      g.root.position.x = pts[i * 3];
      g.root.position.z = pts[i * 3 + 1];
      g.root.rotation.y = pts[i * 3 + 2];
      g.root.updateMatrix();
      k++;
    }
    return k;
  }

  /** The ghost set of a girl, built on her first dash (null without a real 3D figure). */
  _set(uid, count) {
    const v = this.ctx.actors?.towers?.get(uid);
    const src = v?.model;
    if (!src || !src.isObject3D) return null;
    let set = this.sets.get(uid);
    // her figure was rebuilt (a GLB replaced the stand-in, a new view): start over
    if (set && (set.src !== src || set.first !== src.children[0] || set.n !== src.children.length || set.slots.length !== count)) {
      this.release(uid);
      set = null;
    }
    if (set) return set;
    set = { src, first: src.children[0], n: src.children.length, slots: [], next: 0, srcNodes: [], dash: { on: false, t: 0, done: 0, count: 0, interval: 0, life: 0, cols: null, ux: 0, uz: 0, reach: 0 } };
    src.traverse((o) => set.srcNodes.push(o));
    for (let i = 0; i < count; i++) {
      const g = this._build(src, set.srcNodes);
      if (!g) break;
      set.slots.push(g);
    }
    if (!set.slots.length) return null;
    this.sets.set(uid, set);
    return set;
  }

  /** One ghost figure: a pose-only copy of `src` in one additive material. */
  _build(src, srcNodes) {
    // three's clone deep-copies userData through JSON; her animator lives there, so hide it for the copy
    const stash = this._stash;
    stash.length = 0;
    src.traverse((o) => {
      stash.push(o, o.userData);
      o.userData = {};
    });
    let root;
    try {
      root = skeletonClone(src);
    } catch {
      root = null;
    } finally {
      for (let i = 0; i < stash.length; i += 2) stash[i].userData = stash[i + 1];
      stash.length = 0;
    }
    if (!root) return null;
    const nodes = [];
    root.traverse((o) => nodes.push(o));
    if (nodes.length !== srcNodes.length) return null;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    });
    const skeletons = new Set();
    for (let i = 0; i < nodes.length; i++) {
      const o = nodes[i];
      const live = srcNodes[i];
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.isMesh) {
        o.frustumCulled = false;
        o.onBeforeRender = NOOP;
        if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton);
        const hide = live.userData?.isOutline || live.userData?.fx || o.name === 'outline' || o.name === 'halo' || o.isInstancedMesh;
        if (hide) {
          o.visible = false;
          o.userData.ghostHidden = true;
        } else o.material = mat;
      } else if (o.isSprite || o.isLine || o.isPoints) {
        o.visible = false;
      }
    }
    root.visible = false;
    root.matrixAutoUpdate = false;
    root.name = 'ghost';
    root.renderOrder = 19;
    this.parent.add(root);
    this.built++;
    return { root, nodes, mat, skeletons: [...skeletons], t: 0, life: 0, idx: 0, count: 1, on: false };
  }

  /** Copies the live figure's pose into the next slot and shows it. */
  _spawn(set, c, idx, count, life) {
    const plan = ghostPlan(this.ctx.quality, this.ctx.reduceMotion);
    const g = set.slots[set.next];
    if (!g) return null;
    if (!g.on && this.alive >= plan.cap) return null;
    set.next = (set.next + 1) % set.slots.length;
    const src = set.srcNodes;
    const dst = g.nodes;
    for (let i = 0; i < dst.length; i++) {
      const a = src[i];
      const b = dst[i];
      b.position.copy(a.position);
      b.quaternion.copy(a.quaternion);
      b.scale.copy(a.scale);
      // outlines stay hidden; a prop hidden on the live figure stays hidden on her ghost
      if (i > 0 && !b.userData.ghostHidden && (b.isMesh || b.isGroup)) b.visible = a.visible;
    }
    const root = g.root;
    root.position.copy(src[0].position);
    root.quaternion.copy(src[0].quaternion);
    root.scale.copy(src[0].scale);
    root.updateMatrix();
    g.mat.color.copy(c);
    g.mat.opacity = ghostAlpha(0, idx, count);
    if (!g.on) this.alive++;
    g.on = true;
    g.t = 0;
    g.life = life;
    g.idx = idx;
    g.count = count;
    root.visible = true;
    if (this.alive > this.peak) this.peak = this.alive;
    return g;
  }

  /** @param {number} gdt game seconds */
  update(gdt) {
    if (!this.sets.size) return;
    if (!this.enabled()) {
      // low quality / Reduce motion switched on mid-battle: drop every ghost figure
      for (const uid of [...this.sets.keys()]) this.release(uid);
      return;
    }
    this._gdtNow = gdt;
    this.sets.forEach(this._tickSet, this);
  }

  _tickSet(set) {
    const gdt = this._gdtNow ?? 0;
    const d = set.dash;
    if (d.on) {
      d.t += gdt;
      while (d.done < d.count && d.t >= d.done * d.interval) {
        const g = this._spawn(set, d.cols[d.done % d.cols.length], d.done, d.count, d.life);
        if (g && d.reach > 0) {
          const o = dashOffset(d.done, d.count, d.reach);
          g.root.position.x += d.ux * o;
          g.root.position.z += d.uz * o;
          g.root.updateMatrix();
        }
        d.done++;
      }
      if (d.t >= DASH_GAP && d.done >= d.count) d.on = false;
    }
    for (let i = 0; i < set.slots.length; i++) {
      const g = set.slots[i];
      if (!g.on) continue;
      g.t += gdt;
      if (g.t >= g.life) {
        g.on = false;
        g.root.visible = false;
        this.alive--;
        continue;
      }
      g.mat.opacity = ghostAlpha(g.t / g.life, g.idx, g.count);
    }
  }

  /** Frees a girl's ghost figures (sold, figure rebuilt). Shared geometry is left alone. */
  release(uid) {
    const set = this.sets.get(uid);
    if (!set) return;
    for (const g of set.slots) {
      if (g.on) this.alive--;
      g.root.removeFromParent();
      g.mat.dispose();
      for (const s of g.skeletons) s.dispose();
    }
    this.sets.delete(uid);
  }

  dispose() {
    for (const uid of [...this.sets.keys()]) this.release(uid);
    this.alive = 0;
  }
}
