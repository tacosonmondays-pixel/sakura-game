// Buff icons sit above a girl's head with 'Lively figures' on (the default). The icons measure her head once
// her figure stands at full size (buffIcons._headY waits for v.pop >= 1); the lively drop-in never advanced
// v.pop, so every girl fell back to a fixed 1.1 and the icons sank into the taller girls' heads.
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { Actors } from '../../src/render/actors.js';
import { BuffIcons } from '../../src/render/buffIcons.js';
import { LivelyPose } from '../../src/render/livelyPose.js';
import { setFigureOptions } from '../../src/models/figureOptions.js';

afterEach(() => setFigureOptions({ lively: true, reduceMotion: false, quality: 'high' }));

/** A placed girl's view as actors._createTower makes it with Lively figures on (a 1.2-tall stand-in figure). */
function view() {
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4).translate(0, 0.6, 0), new THREE.MeshBasicMaterial()));
  model.scale.setScalar(0.01);
  const v = { uid: 1, model, facing: 0, pop: 0, water: false, hero: false, state: 'idle', scale: 1.22, ripple: 0, lastAttackT: -10, pose: new LivelyPose(1), drive: { turn: 0, engaged: false, windup: 0, fire: 0 } };
  model.userData.drive = v.drive;
  return v;
}

function headYAfter(v, secs) {
  const actors = { victory: false, fxHook: null, time: 0, _livelyTower: Actors.prototype._livelyTower };
  const t = { uid: 1, x: 0, y: 0, facing: 0, cooldown: 0, disabled: 0, eff: { rate: 1 } };
  const icons = new BuffIcons({ sim: { towers: [] }, actors: { towerView: () => v }, batches: {}, atlas: { regions: {} } });
  const dt = 1 / 60;
  let first = null;
  for (let k = 0; k < Math.round(secs * 60); k++) {
    actors.time += dt;
    Actors.prototype._updateTower.call(actors, v, t, dt);
    const y = icons._headY(t);
    if (first == null) first = y;
  }
  return { first, last: icons._headY(t) };
}

describe('buff icons over a lively girl', () => {
  for (const reduceMotion of [false, true]) {
    it(`measure her real head once she has landed${reduceMotion ? ' (Reduce motion: scaled in)' : ''}, not the 1.1 fallback`, () => {
      setFigureOptions({ lively: true, reduceMotion });
      const v = view();
      const { first, last } = headYAfter(v, 1.5);
      expect(first).toBe(1.1); // not measured mid-drop
      expect(v.pop).toBe(1);
      // her feet at 0.05 + 1.2 tall × the tower scale 1.22, at her standing size (within the breathing squash)
      expect(last).toBeGreaterThan(0.05 + 1.2 * 1.22 * 0.985);
      expect(last).toBeLessThan(0.05 + 1.2 * 1.22 * 1.015);
    });
  }
});
