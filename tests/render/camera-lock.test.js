// Battle camera lock (owner: "make it so the screen is locked, I sometimes drag it when I try
// to place a unit"): the gesture policy, the board's pointer input driven with synthetic touch /
// mouse / wheel events in every mode, the locked CameraRig, the focus slide beside the info
// panel, the saved setting and the locked fit of every map at the phone and desktop viewports.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { cameraGestures, cameraModeOf, CAMERA_MODES, DEFAULT_CAMERA_MODE, TAP_SLOP_PX, STILL_TAP_SLOP_PX } from '../../src/render/cameraPolicy.js';
import { CameraRig, clearSlide } from '../../src/render/camera.js';
import { attachBoardInput, LONG_PRESS_MS, DOUBLE_TAP_MS } from '../../src/render/boardInput.js';
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

// The renderer's real pointer handlers (src/render/boardInput.js) on a fake canvas. The rig is
// left UNlocked unless a test says otherwise, so these prove the input layer itself asks the
// policy before every camera move (the locked rig is a second, independent guard, tested below).
describe('board input honours the camera policy', () => {
  const W = 844;
  const H = 390;

  class FakeBoard extends EventTarget {
    getBoundingClientRect() {
      return { left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0 };
    }

    setPointerCapture() {}
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A board wired like BattleRenderer: policy state, rig, pick, tap / long-press logs. */
  function board({ mode = 'locked', placing = false, lockRig = false, girlAt = null } = {}) {
    vi.useFakeTimers();
    const state = { mode, placing };
    let clock = 1000;
    const rig = new CameraRig({ width: 20, height: 11 });
    rig.setViewport(W, H, { top: 52, bottom: 83 });
    if (lockRig) rig.setLocked(true, false);
    const el = new FakeBoard();
    const taps = [];
    const longs = [];
    const input = attachBoardInput(el, {
      rig,
      pick: (x, y) => ({ x: x / 40, y: y / 40, inBounds: true, towerUid: girlAt && Math.hypot(x - girlAt[0], y - girlAt[1]) < 20 ? 7 : null }),
      gestures: () => cameraGestures(state),
      onTap: (p) => taps.push(p),
      onLongPress: (p) => longs.push(p),
      now: () => clock,
    });
    const wait = (ms) => {
      clock += ms;
      vi.advanceTimersByTime(ms);
    };
    const fire = (type, id, x, y, extra = {}) => {
      const e = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, ...extra });
      el.dispatchEvent(e);
      return e;
    };
    /** One finger (or the mouse) from a to b in n moves, 16 ms apart. */
    const drag = ([x0, y0], [x1, y1], { n = 10, pointerType = 'touch', id = 1 } = {}) => {
      fire('pointerdown', id, x0, y0, { pointerType });
      for (let i = 1; i <= n; i++) {
        wait(16);
        fire('pointermove', id, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, { pointerType });
      }
      fire('pointerup', id, x1, y1, { pointerType });
    };
    /** A tap whose finger slides `slide` px before it lifts. */
    const tap = (x, y, slide = 0) => {
      fire('pointerdown', 1, x, y);
      if (slide) {
        wait(30);
        fire('pointermove', 1, x + slide * 0.6, y + slide * 0.8);
      }
      wait(60);
      fire('pointerup', 1, x + slide * 0.6, y + slide * 0.8);
    };
    /** Two fingers spread from `from` to `to` px apart around (cx, cy) while their middle moves by (mx, my). */
    const pinch = (cx, cy, from, to, [mx, my] = [0, 0], n = 8) => {
      fire('pointerdown', 1, cx - from / 2, cy);
      fire('pointerdown', 2, cx + from / 2, cy);
      for (let i = 1; i <= n; i++) {
        wait(16);
        const d = from + ((to - from) * i) / n;
        const ox = (mx * i) / n;
        const oy = (my * i) / n;
        fire('pointermove', 1, cx - d / 2 + ox, cy + oy);
        fire('pointermove', 2, cx + d / 2 + ox, cy + oy);
      }
      fire('pointerup', 1, cx - to / 2 + mx, cy + my);
      fire('pointerup', 2, cx + to / 2 + mx, cy + my);
    };
    const wheel = (x, y, deltaY) => fire('wheel', 0, x, y, { deltaY, pointerType: undefined });
    const pose = () => {
      rig.apply(0);
      return { zoom: +rig.zoom.toFixed(6), pan: [+rig.pan.x.toFixed(6), +rig.pan.y.toFixed(6)] };
    };
    return { state, rig, el, taps, longs, input, wait, fire, drag, tap, pinch, wheel, pose };
  }

  const FIT = { zoom: 1, pan: [0, 0] };

  it('locked: a one-finger touch drag, a mouse drag and a two-finger pinch / move never move the camera', () => {
    const b = board({ mode: 'locked' });
    b.drag([200, 200], [640, 260]);
    b.drag([640, 150], [180, 300], { pointerType: 'mouse' });
    b.pinch(422, 200, 60, 260, [80, -40]);
    b.pinch(422, 200, 260, 60);
    expect(b.pose()).toEqual(FIT);
    expect(b.taps).toEqual([]); // drags and pinches are not taps…
    expect(b.longs).toEqual([]); // …nor long presses
  });

  it('locked: the wheel never zooms, but still keeps the page from scrolling', () => {
    const b = board({ mode: 'locked' });
    const e = b.wheel(422, 200, -600);
    expect(e.defaultPrevented).toBe(true);
    expect(b.pose()).toEqual(FIT);
  });

  it('locked: a double-tap does not reset (there is nothing to reset), both taps still land', () => {
    const b = board({ mode: 'free' });
    b.drag([200, 200], [500, 260]);
    const moved = b.pose();
    expect(moved).not.toEqual(FIT);
    b.state.mode = 'locked';
    b.tap(400, 200);
    b.wait(100);
    b.tap(402, 201);
    for (let i = 0; i < 30; i++) b.rig.apply(1 / 60);
    expect(b.pose()).toEqual(moved);
    expect(b.taps.length).toBe(2);
  });

  it('locked: a wobbly tap (up to 20 px) still lands; a longer slide is a drag and not a tap', () => {
    const b = board({ mode: 'locked' });
    b.tap(300, 200, 18);
    expect(b.taps.length).toBe(1);
    expect(b.taps[0]).toMatchObject({ clientX: 300 + 18 * 0.6, clientY: 200 + 18 * 0.8 });
    b.tap(300, 200, STILL_TAP_SLOP_PX + 6);
    expect(b.taps.length).toBe(1);
    expect(b.pose()).toEqual(FIT);
  });

  it('locked: tapping a girl reports her, a still long press fires once and is not also a tap', () => {
    const b = board({ mode: 'locked', girlAt: [500, 180] });
    b.tap(503, 184, 12);
    expect(b.taps.map((p) => p.towerUid)).toEqual([7]);
    b.fire('pointerdown', 1, 500, 180);
    b.wait(LONG_PRESS_MS + 20);
    b.fire('pointerup', 1, 500, 180);
    expect(b.longs.map((p) => p.towerUid)).toEqual([7]);
    expect(b.taps.length).toBe(1);
  });

  it('locked rig + locked policy (the real battle): nothing moves whatever arrives', () => {
    const b = board({ mode: 'locked', lockRig: true });
    b.drag([100, 100], [700, 300]);
    b.pinch(422, 200, 40, 300, [100, 50]);
    b.wheel(300, 200, -900);
    b.tap(300, 200);
    b.wait(80);
    b.tap(300, 200);
    for (let i = 0; i < 30; i++) b.rig.apply(1 / 60);
    expect(b.pose()).toEqual(FIT);
    expect(b.rig.isDefault).toBe(true);
  });

  it('free: touch and mouse drags pan, a pinch zooms, two fingers move the view, the wheel zooms, a double-tap resets', () => {
    const b = board({ mode: 'free' });
    b.drag([300, 200], [500, 240]);
    const p1 = b.pose();
    expect(p1.zoom).toBe(1);
    expect(p1.pan).not.toEqual([0, 0]);
    b.drag([500, 240], [300, 160], { pointerType: 'mouse' });
    expect(b.pose().pan).not.toEqual(p1.pan);
    b.pinch(422, 200, 60, 130); // ×2.17, below the 3.2 cap so the move below cannot clip it
    const p2 = b.pose();
    expect(p2.zoom).toBeGreaterThan(2);
    b.pinch(422, 200, 120, 120, [-60, 30]);
    const p3 = b.pose();
    expect(p3.zoom).toBeCloseTo(p2.zoom, 4);
    expect(p3.pan).not.toEqual(p2.pan);
    b.wheel(422, 200, 400);
    expect(b.pose().zoom).toBeLessThan(p3.zoom);
    expect(b.taps).toEqual([]);
    b.tap(400, 200);
    b.wait(DOUBLE_TAP_MS - 150);
    b.tap(404, 203);
    for (let i = 0; i < 30; i++) b.rig.apply(1 / 60);
    expect(b.pose()).toEqual(FIT);
    expect(b.taps.length).toBe(2);
  });

  it('free: the old 9 px slop — a 12 px slide is a small pan, not a tap', () => {
    const b = board({ mode: 'free' });
    b.tap(300, 200, TAP_SLOP_PX + 3);
    expect(b.taps).toEqual([]);
    expect(b.pose().pan).not.toEqual([0, 0]);
  });

  it('free while placing a girl: drags, pinch, wheel and double-tap hold the camera; a wobbly tap lands', () => {
    const b = board({ mode: 'free' });
    b.pinch(422, 200, 60, 200); // zoomed in a little before she picks a card
    const before = b.pose();
    expect(before.zoom).toBeGreaterThan(1.5);
    b.state.placing = true;
    b.drag([200, 200], [640, 260]);
    b.drag([640, 150], [180, 300], { pointerType: 'mouse' });
    b.pinch(422, 200, 200, 40, [60, 20]);
    b.wheel(422, 200, 600);
    b.tap(380, 190);
    b.wait(90);
    b.tap(381, 190);
    for (let i = 0; i < 30; i++) b.rig.apply(1 / 60);
    expect(b.pose()).toEqual(before);
    b.tap(300, 200, 18); // a wobbly board tap after tapping a card still places her
    expect(b.taps.length).toBe(3);
  });

  it('free: a drag or pinch that starts while placing never moves the camera, even after she is placed mid-gesture', () => {
    const b = board({ mode: 'free', placing: true });
    b.fire('pointerdown', 1, 200, 200);
    for (let i = 1; i <= 5; i++) b.fire('pointermove', 1, 200 + i * 20, 200);
    b.state.placing = false; // the placement ended while the finger is still down (a bar drop)
    b.fire('pointermove', 1, 360, 210);
    b.fire('pointermove', 1, 420, 230);
    b.fire('pointerup', 1, 420, 230);
    expect(b.taps).toEqual([]); // the drag was never a tap
    b.state.placing = true;
    b.fire('pointerdown', 1, 380, 200);
    b.fire('pointerdown', 2, 460, 200);
    b.state.placing = false;
    b.fire('pointermove', 1, 300, 230);
    b.fire('pointermove', 2, 560, 230);
    b.fire('pointerup', 1, 300, 230);
    b.fire('pointerup', 2, 560, 230);
    expect(b.pose()).toEqual(FIT);
    // the next press, started after placing, pans as usual in Free
    b.drag([300, 200], [500, 240]);
    expect(b.pose().pan).not.toEqual([0, 0]);
  });

  it('free: the tap that places a girl is never the first half of a double-tap reset', () => {
    const b = board({ mode: 'free' });
    b.drag([300, 200], [500, 240]);
    const moved = b.pose();
    expect(moved).not.toEqual(FIT);
    b.state.placing = true;
    b.tap(400, 200); // places her (the UI ends placing on this tap)…
    b.state.placing = false;
    b.wait(90);
    b.tap(402, 201); // …and a quick second tap on the same spot right after
    for (let i = 0; i < 30; i++) b.rig.apply(1 / 60);
    expect(b.pose()).toEqual(moved);
    expect(b.taps.length).toBe(2);
  });

  it('free: a pan in progress stops the moment placing starts (a second finger drags a card)', () => {
    const b = board({ mode: 'free' });
    b.fire('pointerdown', 1, 200, 200);
    for (let i = 1; i <= 4; i++) b.fire('pointermove', 1, 200 + i * 20, 200);
    const panned = b.pose();
    expect(panned.pan).not.toEqual([0, 0]);
    b.state.placing = true;
    for (let i = 5; i <= 12; i++) b.fire('pointermove', 1, 200 + i * 20, 200 + i * 4);
    b.fire('pointerup', 1, 440, 248);
    expect(b.pose()).toEqual(panned);
  });

  it('ignores right / middle mouse buttons, a cancelled press is no tap, dispose unhooks everything', () => {
    const b = board({ mode: 'free' });
    b.fire('pointerdown', 9, 300, 200, { pointerType: 'mouse', button: 2 });
    b.fire('pointermove', 9, 500, 260, { pointerType: 'mouse', button: 2 });
    b.fire('pointerup', 9, 500, 260, { pointerType: 'mouse', button: 2 });
    expect(b.pose()).toEqual(FIT);
    b.fire('pointerdown', 1, 300, 200);
    b.fire('pointercancel', 1, 300, 200);
    expect(b.taps).toEqual([]);
    const ctx = b.fire('contextmenu', 0, 300, 200);
    expect(ctx.defaultPrevented).toBe(true);
    b.input.dispose();
    b.drag([200, 200], [640, 260]);
    b.tap(300, 200);
    b.wait(LONG_PRESS_MS + 10);
    expect(b.pose()).toEqual(FIT);
    expect(b.taps).toEqual([]);
    expect(b.longs).toEqual([]);
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

  it('holdStill (placing a girl): stops a shake and a free reset glide where they are; locked still lands on the fit', () => {
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setViewport(1280, 720, { top: 62, bottom: 106 });
    const fit = pose(rig);
    rig.zoomAt(2, 640, 360);
    rig.panBy(80, 30);
    rig.reset(true); // a double-tap reset starts gliding home…
    rig.apply(0.05);
    rig.shake(0.2);
    rig.holdStill(); // …and she picks a card: the view stays exactly here
    const held = pose(rig);
    for (let i = 0; i < 30; i++) rig.apply(1 / 60);
    expect(pose(rig)).toEqual(held);
    expect(rig.isDefault).toBe(false);
    rig.setLocked(true, true); // locked: the glide back to the fit is not held
    rig.holdStill();
    for (let i = 0; i < 30; i++) {
      rig.holdStill();
      rig.apply(1 / 60);
    }
    expect(pose(rig)).toEqual(fit);
  });
});

// The info panel covers the right part of the board on a phone: the view slides so the
// selected girl's range ring stays visible beside it (also when locked), and back on close.
describe('focus slide (selected girl beside the info panel)', () => {
  const pose = (rig) => {
    rig.apply(0);
    return [...rig.camera.position.toArray(), ...rig.target.toArray(), rig.camera.left, rig.camera.top].map((v) => +v.toFixed(6));
  };
  const screenX = (rig, x, z) => {
    const v = new THREE.Vector3(x, 0, z).project(rig.camera);
    return ((v.x + 1) / 2) * rig.viewW;
  };

  it('clearSlide: just far enough when the ring fits, centred when it does not, capped', () => {
    expect(clearSlide(8, 500, 100, 300, 340)).toBe(0); // already clear
    expect(clearSlide(8, 500, 400, 600, 340)).toBe(100); // slides by the overlap
    expect(clearSlide(8, 500, 100, 800, 340)).toBe(196); // bigger than the gap: centred
    expect(clearSlide(8, 500, 700, 1200, 340)).toBe(340); // never more than the panel
  });

  it('glides there and back on a locked camera, moves the board left by the slide in px', () => {
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setLocked(true, false);
    rig.setViewport(844, 390, { top: 52, bottom: 83 });
    rig.apply(0);
    const fit = pose(rig);
    const x0 = screenX(rig, 15, 6);
    rig.setFocusShift(120, 0);
    rig.apply(1 / 60);
    expect(rig.focus.x).toBeGreaterThan(0);
    expect(rig.focus.x).toBeLessThan(120); // a glide, not a jump
    for (let i = 0; i < 60; i++) rig.apply(1 / 60);
    expect(rig.focus.x).toBe(120);
    expect(rig.isDefault).toBe(true); // still the locked fit, only slid
    expect(x0 - screenX(rig, 15, 6)).toBeCloseTo(120, 3);
    rig.panBy(200, 0); // a drag still does nothing
    rig.apply(1 / 60);
    expect(x0 - screenX(rig, 15, 6)).toBeCloseTo(120, 3);
    rig.setFocusShift(0, 0); // panel closed
    for (let i = 0; i < 60; i++) rig.apply(1 / 60);
    expect(rig.focus.x).toBe(0);
    expect(pose(rig)).toEqual(fit);
  });

  it('holds still while a girl is being placed, then finishes the glide', () => {
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setLocked(true, false);
    rig.setViewport(844, 390, { top: 52, bottom: 83 });
    rig.setFocusShift(150, 0);
    for (let i = 0; i < 60; i++) rig.apply(1 / 60);
    rig.setFocusShift(0, 0); // placing starts: the selection clears…
    for (let i = 0; i < 30; i++) {
      rig.holdStill(); // …but the view holds where it is while she is placed
      rig.apply(1 / 60);
    }
    expect(rig.focus.x).toBe(150);
    for (let i = 0; i < 60; i++) rig.apply(1 / 60);
    expect(rig.focus.x).toBe(0);
    rig.setFocusShift(-40, -10); // never slides the other way
    rig.apply(1);
    expect([rig.focus.x, rig.focus.y]).toEqual([0, 0]);
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
