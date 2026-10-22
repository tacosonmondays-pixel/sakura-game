// Procedural bone layers on top of a figure's clips (FX-1): turn a bone about an axis given in the
// figure's own frame (+z forward, +y up, +x across), whatever the bone's own axes are, and scale a bone,
// after the mixer has posed it — then put it back before the mixer runs again. The mixer only writes
// the channels its clips animate, so without the put-back an un-keyed bone would keep last frame's turn
// and wind up. Display only; nothing is allocated per call.
//
//   const ov = new BoneOverlay(group);   // the figure group (its local frame = her facing)
//   ov.restore();                        // every frame, BEFORE group.userData.animate(...)
//   group.userData.animate(...);
//   ov.turn('upper_arm_R', AXIS_X, 0.8); // after it
import * as THREE from 'three';

export const AXIS_X = new THREE.Vector3(1, 0, 0);
export const AXIS_Y = new THREE.Vector3(0, 1, 0);
export const AXIS_Z = new THREE.Vector3(0, 0, 1);

const _p = new THREE.Quaternion();
const _pi = new THREE.Quaternion();
const _r = new THREE.Quaternion();

export class BoneOverlay {
  /** @param {THREE.Object3D} group the figure's group (the frame the axes are given in) */
  constructor(group) {
    this.group = group;
    this.cache = new Map(); // name → bone or null
    this.touched = []; // [bone, saved quaternion, saved scale]
    this.n = 0;
  }

  /** The named bone (null when the figure has none: a procedural stand-in, another rig). */
  bone(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    let found = null;
    this.group.traverse((o) => {
      if (!found && (o.isBone || o.type === 'Bone') && o.name === name) found = o;
    });
    if (!found) found = this.group.getObjectByName(name) || null;
    this.cache.set(name, found);
    return found;
  }

  _save(b) {
    for (let i = 0; i < this.n; i++) if (this.touched[i][0] === b) return;
    let slot = this.touched[this.n];
    if (!slot) {
      slot = [null, new THREE.Quaternion(), new THREE.Vector3()];
      this.touched[this.n] = slot;
    }
    slot[0] = b;
    slot[1].copy(b.quaternion);
    slot[2].copy(b.scale);
    this.n++;
  }

  /**
   * Turns bone `name` by `angle` about `axis` (a unit vector in the group's frame) through its own
   * pivot. @returns {boolean} the bone exists
   */
  turn(name, axis, angle) {
    if (!angle) return !!this.bone(name);
    const b = this.bone(name);
    if (!b) return false;
    this._save(b);
    // the parent's orientation in the group's frame
    _p.identity();
    for (let n = b.parent; n && n !== this.group; n = n.parent) _p.premultiply(n.quaternion);
    _pi.copy(_p).invert();
    _r.setFromAxisAngle(axis, angle);
    // local' = P⁻¹ · R · P · local
    b.quaternion.premultiply(_pi.multiply(_r).multiply(_p));
    return true;
  }

  /** Scales bone `name` uniformly by `s` (a prop held in that hand shrinks with it). */
  scale(name, s) {
    const b = this.bone(name);
    if (!b || s === 1) return !!b;
    this._save(b);
    b.scale.multiplyScalar(Math.max(1e-3, s));
    return true;
  }

  /** Puts every bone touched since the last restore back as the mixer left it. */
  restore() {
    for (let i = 0; i < this.n; i++) {
      const [b, q, s] = this.touched[i];
      b.quaternion.copy(q);
      b.scale.copy(s);
      this.touched[i][0] = null;
    }
    this.n = 0;
  }
}
