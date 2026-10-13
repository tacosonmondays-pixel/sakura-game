// Battle camera lock (owner: "make it so the screen is locked, I sometimes drag it when I try
// to place a unit"): the gesture policy, the locked CameraRig, the saved setting and the
// locked fit of every map at the phone and desktop viewports.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cameraGestures, cameraModeOf, CAMERA_MODES, DEFAULT_CAMERA_MODE, TAP_SLOP_PX, STILL_TAP_SLOP_PX } from '../../src/render/cameraPolicy.js';
import { CameraRig } from '../../src/render/camera.js';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, DEFAULT_SETTINGS } from '../../src/systems/save.js';
import { MAPS } from '../../src/data/maps.js';

describe('camera gesture policy', () => {
  it('reads the mode from settings: locked unless it says free', () => {
    expect(DEFAULT_CAMERA_MODE).toBe('locked');
    expect(CAMERA_MODES).toEqual(['locked', 'free']);
    expect(cameraModeOf(undefined)).toBe('locked');
    expect(cameraModeOf({})).toBe('locked');
    expect(cameraModeOf({ camera: 'locked' })).toBe('locked');
    expect(cameraModeOf({ camera: 'free' })).toBe('free');
    expect(cameraModeOf({ camera: 'FREE' })).toBe('locked');
    expect(cameraModeOf({ camera: true })).toBe('locked');
  });

  it('locked: no pan, no zoom, no double-tap reset, and a wobbly tap is still a tap', () => {
    for (const placing of [false, true]) {
      expect(cameraGestures({ mode: 'locked', placing })).toEqual({ pan: false, zoom: false, reset: false, tapSlop: STILL_TAP_SLOP_PX });
    }
    expect(cameraGestures()).toEqual(cameraGestures({ mode: 'locked' }));
  });

  it('free: drag pans, pinch / wheel zoom, double-tap resets (today\'s controls)', () => {
    expect(cameraGestures({ mode: 'free', placing: false })).toEqual({ pan: true, zoom: true, reset: true, tapSlop: TAP_SLOP_PX });
  });

  it('free while placing a girl: the camera holds still', () => {
    expect(cameraGestures({ mode: 'free', placing: true })).toEqual({ pan: false, zoom: false, reset: false, tapSlop: STILL_TAP_SLOP_PX });
  });

  it('an unknown mode is treated as locked', () => {
    expect(cameraGestures({ mode: 'weird' }).pan).toBe(false);
    expect(STILL_TAP_SLOP_PX).toBeGreaterThan(TAP_SLOP_PX);
  });
});

describe('locked camera rig', () => {
  const pose = (rig) => {
    rig.apply(0);
    return [...rig.camera.position.toArray(), ...rig.target.toArray(), rig.camera.left, rig.camera.top].map((v) => +v.toFixed(6));
  };

  it('ignores pan and zoom and stays on the fitted view', () => {
    const rig = new CameraRig({ width: 20, height: 12 });
    rig.setLocked(true, false);
    rig.setViewport(844, 390, { top: 62, bottom: 106 });
    const fit = pose(rig);
    rig.panBy(300, -200);
    rig.zoomAt(2.5, 100, 100);
    rig.zoom = 3; // even a direct write snaps back on the next frame
    rig.pan.set(5, 5);
    expect(pose(rig)).toEqual(fit);
    expect(rig.isDefault).toBe(true);
  });

  it('free pans and zooms; locking again glides back to the fit', () => {
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setViewport(1280, 720, { top: 62, bottom: 106 });
    const fit = pose(rig);
    rig.panBy(120, 40);
    rig.zoomAt(2, 640, 360);
    rig.apply(0);
    expect(rig.isDefault).toBe(false);
    expect(pose(rig)).not.toEqual(fit);
    rig.setLocked(true, true);
    for (let i = 0; i < 30; i++) rig.apply(1 / 60);
    expect(rig.isDefault).toBe(true);
    expect(pose(rig)).toEqual(fit);
    rig.setLocked(false);
    rig.panBy(50, 0);
    rig.apply(0);
    expect(rig.isDefault).toBe(false);
  });
});

describe('camera setting in the save', () => {
  it('new profiles start locked', () => {
    expect(DEFAULT_SETTINGS.camera).toBe('locked');
    expect(createProfile().settings.camera).toBe('locked');
  });

  it('existing saves without the setting get the locked camera', () => {
    const old = createProfile();
    delete old.settings.camera;
    expect(migrateProfile(old).settings.camera).toBe('locked');
    const text = serializeProfile(old);
    expect(deserializeProfile(text).settings.camera).toBe('locked');
  });

  it('keeps Free across save / load and repairs junk', () => {
    const p = createProfile();
    p.settings.camera = 'free';
    expect(deserializeProfile(serializeProfile(p)).settings.camera).toBe('free');
    for (const junk of [null, 1, 'zoom', { a: 1 }]) {
      p.settings.camera = junk;
      expect(migrateProfile(p).settings.camera).toBe('locked');
    }
  });
});

// The locked view is the fit at zoom 1: it must show every map whole, between the HUD and the
// tower bar, because nothing can pan to a hidden edge any more. Insets are the real battle HUD
// (top) and tower bar (bottom) heights measured in Chromium (e2e/camera-lock.mjs prints them:
// 844×390 HUD 46–48 px, bar 81 px; 1280×720 HUD 58 px, bar 113 px), plus the controller's
// +4 / +2 px margins (src/ui/battle/controller.js insets()).
describe('locked fit shows every whole map', () => {
  const VIEWS = [
    { w: 844, h: 390, insets: { top: 52, bottom: 83 } },
    { w: 1280, h: 720, insets: { top: 62, bottom: 115 } },
  ];
  for (const { w, h, insets } of VIEWS) {
    it(`${w}×${h}`, () => {
      const v = new THREE.Vector3();
      for (const map of MAPS) {
        const rig = new CameraRig(map);
        rig.setLocked(true, false);
        rig.setViewport(w, h, insets);
        rig.apply(0);
        expect(rig.zoom, map.id).toBe(1);
        // every ground corner and a girl's head height above it lands inside the free band
        for (const [x, z] of [[0, 0], [map.width, 0], [0, map.height], [map.width, map.height]]) {
          for (const y of [0, 1]) {
            v.set(x, y, z).project(rig.camera);
            const sx = ((v.x + 1) / 2) * w;
            const sy = ((1 - v.y) / 2) * h;
            expect(sx, `${map.id} x`).toBeGreaterThanOrEqual(-0.5);
            expect(sx, `${map.id} x`).toBeLessThanOrEqual(w + 0.5);
            expect(sy, `${map.id} y`).toBeGreaterThanOrEqual(insets.top - 0.5);
            expect(sy, `${map.id} y`).toBeLessThanOrEqual(h - insets.bottom + 0.5);
          }
        }
      }
    });
  }
});
