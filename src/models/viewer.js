// Small self-contained 3D viewer for character/bestiary screens: studio lighting, soft
// gradient or transparent background, drag/touch to rotate, wheel/pinch to zoom.
import * as THREE from 'three';

/** The viewer's studio lights (also read by the figurine brightness test). */
export const VIEWER_LIGHTS = {
  hemi: { sky: '#ffffff', ground: '#c9d3ea', intensity: 1.25 },
  key: { color: '#fff4e6', intensity: 1.6, position: [2.2, 3.5, 3.2] },
  rim: { color: '#cfe6ff', intensity: 0.9, position: [-2.5, 2, -3] },
};

/**
 * @param {HTMLElement} container element to fill (its size drives the canvas)
 * @param {{background?: null|string|[string,string], autoRotate?: boolean, state?: string}} [opts]
 *   background: null = transparent, '#hex' = flat colour, ['#top', '#bottom'] = soft gradient.
 * @returns {{ setObject(group), setAutoRotate(b), setState(s), dispose(), resize(), renderer, scene, camera }}
 */
export function createModelViewer(container, { background = null, autoRotate = true, state = 'idle' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  let bgTexture = null;
  if (Array.isArray(background)) {
    bgTexture = gradientTexture(background[0], background[1]);
    scene.background = bgTexture;
  } else if (typeof background === 'string') {
    scene.background = new THREE.Color(background);
  }

  // Studio lighting: soft sky fill, warm key, cool rim.
  const L = VIEWER_LIGHTS;
  scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
  for (const d of [L.key, L.rim]) {
    const light = new THREE.DirectionalLight(d.color, d.intensity);
    light.position.set(...d.position);
    scene.add(light);
  }

  // Soft contact shadow disc.
  const shadowTex = radialTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.45 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  let object = null;
  let height = 1;
  let yaw = 0.35;
  let pitch = 0.12;
  let dist = 3;
  let minDist = 1;
  let maxDist = 6;
  let auto = autoRotate;
  let animState = state;
  let lastInteract = -10;
  const pointers = new Map();
  let pinchStart = 0;
  let pinchDist = 0;

  function frame() {
    const target = new THREE.Vector3(0, height * 0.5, 0);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  function fit() {
    if (!object) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    height = Math.max(0.2, object.userData.height || size.y);
    const span = Math.max(height * 1.25, size.x, size.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    dist = (span / 2) / Math.tan(fov / 2) * 1.15 / Math.min(1, camera.aspect);
    minDist = dist * 0.45;
    maxDist = dist * 1.8;
    shadow.scale.setScalar(Math.max(size.x, size.z) * 1.3 + 0.2);
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
  }

  // --- input ---
  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract = clock.getElapsed();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      pinchDist = dist;
    }
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    lastInteract = clock.getElapsed();
    if (pointers.size === 1) {
      yaw -= dx * 0.012;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.006, -0.25, 0.9);
    } else if (pointers.size === 2 && pinchStart > 0) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      dist = THREE.MathUtils.clamp(pinchDist * (pinchStart / Math.max(1, d)), minDist, maxDist);
    }
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
  };
  const onWheel = (e) => {
    e.preventDefault();
    dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.1), minDist, maxDist);
    lastInteract = clock.getElapsed();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  // A tap on the model plays its attack (characters) or hit flash (enemies).
  let downAt = 0;
  canvas.addEventListener('pointerdown', () => { downAt = performance.now(); });
  canvas.addEventListener('pointerup', () => {
    if (performance.now() - downAt < 200 && object) {
      object.userData.playAttack?.();
      object.userData.hitFlash?.();
    }
  });

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(container);

  const clock = new THREE.Timer();
  let raf = 0;
  let disposed = false;
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    clock.update();
    const dt = clock.getDelta();
    const t = clock.getElapsed();
    if (auto && t - lastInteract > 2.5 && pointers.size === 0) yaw += dt * 0.45;
    if (object) {
      if (object.userData.kind === 'enemy') object.userData.animate?.(t, dt, { moving: false, speed: 1 });
      else object.userData.animate?.(t, dt, animState);
    }
    frame();
    renderer.render(scene, camera);
  }

  resize();
  loop();

  return {
    renderer, scene, camera,
    /** Shows a model (replaces the previous one; the caller owns disposal of the old one). */
    setObject(group) {
      if (object) pivot.remove(object);
      object = group || null;
      if (object) {
        pivot.add(object);
        object.position.set(0, 0, 0);
        fit();
      }
    },
    setAutoRotate(b) { auto = !!b; },
    /** Animation state for chibis: 'idle' | 'attack' | 'cheer' | 'victory' | 'disabled' | 'walk'. */
    setState(s) { animState = s || 'idle'; },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      if (object) pivot.remove(object);
      shadow.geometry.dispose();
      shadow.material.dispose();
      shadowTex.dispose();
      bgTexture?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,24,48,0.7)');
  grad.addColorStop(1, 'rgba(20,24,48,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
