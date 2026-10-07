// Lobby V3 secretary stage (owner: ui lobby). The secretary is the hero of the home screen:
// a large full-detail 3D chibi on a transparent WebGL canvas, standing on the room's floor
// and filling ~80–85% of the screen height, lit like the room (soft key from the front,
// bright cool rim from the windows behind her, warm sun kicker), with a blob contact shadow.
//
//   const stage = createSecretaryStage(hostEl, { reduceMotion, quality, onTap })
//   await stage.show(unitDef, { direction: 1 | -1 | 0, awaken })
//   stage.react('head' | 'body')   tap reactions (expression, animation, squash, hearts)
//   stage.say(text)                speech bubble next to her head
//   stage.look(nx, ny)             pointer follow (-1..1), she turns head/body a little
//   stage.dispose()
//
// Cheap on phones: DPR capped, render paused while the page is hidden, a single canvas sized
// to the stage box. If WebGL or the GLB fails, her full card art stands in, same size.
import { h, clear } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';

const FILL = 0.79; // fraction of the stage height her full figure (halo included) occupies
const TOP_MARGIN = 0.072; // fraction of the visible height above her halo
const FOV = 22;

export function createSecretaryStage(host, { reduceMotion = false, quality = 'medium', onTap = null } = {}) {
  const root = h('div.lb-sec', { 'data-testid': 'secretary-stage' });
  const canvasBox = h('div.lb-sec-canvas');
  const artBox = h('div.lb-sec-art', { 'aria-hidden': 'true' });
  const fxBox = h('div.lb-sec-fx', { 'aria-hidden': 'true' });
  const bubble = h('div.lb-bubble', { 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.lb-bubble-text'));
  root.append(canvasBox, artBox, fxBox, bubble);
  host.appendChild(root);

  let THREE = null;
  let models = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let shadow = null;
  let pivot = null;
  let model = null;
  let modelUnit = null;
  let headBone = null;
  let headBase = null;
  let headApplied = null;
  let mode = 'none'; // 'gl' | 'art' | 'none'
  let disposed = false;
  let raf = 0;
  let running = false;
  let last = 0;
  let time = 0;
  let animState = 'idle';
  let stateUntil = 0;
  let exprUntil = 0;
  let bounceT = -1;
  let hopT = -1;
  let lookX = 0;
  let lookY = 0;
  let lookTX = 0;
  let lookTY = 0;
  let token = 0;
  let bubbleTimer = 0;
  let height = 0.9;
  let box = null; // model-space bounds { minX, maxX, minY, maxY }

  // ---------------------------------------------------------------- WebGL setup (lazy)
  async function ensureGL() {
    if (renderer) return true;
    try {
      THREE = await import('three');
      models ||= await import('../../models/index.js');
      if (disposed) return false;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
    } catch (e) {
      console.warn('[lobby] WebGL unavailable for the secretary, using card art', e);
      renderer = null;
      return false;
    }
    const dprCap = quality === 'high' ? 2 : quality === 'low' ? 1.25 : 1.6;
    renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = 'lb-sec-gl';
    canvasBox.appendChild(canvas);

    scene = new THREE.Scene();
    // Room light: bright sky fill, soft warm key from the front-right (room lights + sun bounce),
    // cool rim from the windows behind her, warm kicker from the sunny right side.
    scene.add(new THREE.HemisphereLight('#ffffff', '#aebddb', 1.0));
    const key = new THREE.DirectionalLight('#fff2e0', 1.35);
    key.position.set(1.4, 2.4, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#e3f2ff', 1.3);
    rim.position.set(-1.6, 1.6, -2.6);
    scene.add(rim);
    const kick = new THREE.DirectionalLight('#fff0cf', 0.7);
    kick.position.set(2.6, 1.2, -1.4);
    scene.add(kick);

    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTexture(THREE), transparent: true, depthWrite: false, opacity: 0.5 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    shadow.renderOrder = -1;
    scene.add(shadow);

    camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
    pivot = new THREE.Group();
    scene.add(pivot);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(root);
    }
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    return true;
  }
  let ro = null;

  function resize() {
    if (!renderer) return;
    const w = Math.max(1, root.clientWidth);
    const hh = Math.max(1, root.clientHeight);
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
    frameCamera();
    if (!running) renderOnce();
  }

  function frameCamera() {
    if (!camera) return;
    const fov = THREE.MathUtils.degToRad(FOV);
    // the whole figure fills FILL of the canvas height; narrow canvases (portrait) shrink her
    const fill = FILL * Math.min(1, camera.aspect / 0.62);
    const visible = height / fill;
    const dist = visible / 2 / Math.tan(fov / 2);
    const centerY = height + TOP_MARGIN * visible - visible / 2;
    camera.position.set(0, centerY + height * 0.05, dist);
    camera.lookAt(0, centerY, 0);
  }

  function measure(obj) {
    const b = new THREE.Box3().setFromObject(obj);
    const size = b.getSize(new THREE.Vector3());
    // Box3 over skinned meshes is unreliable (bind pose / outline shells), so frame by the
    // model's authored height (feet at 0 → top of the hair) plus room for the halo above it.
    const authored = obj.userData.height || Math.min(size.y, 1.2);
    height = Math.max(0.3, authored * 1.12);
    box = { minX: Math.max(b.min.x, -height * 0.4), maxX: Math.min(b.max.x, height * 0.4), minY: 0, maxY: height };
    shadow.scale.set(Math.max(size.x, 0.45) * 1.25, Math.max(size.z, 0.3) * 1.25 + 0.12, 1);
  }

  function findHeadBone(obj) {
    let bone = null;
    obj.traverse((o) => {
      if (!bone && o.isBone && /^head$/i.test(o.name)) bone = o;
    });
    return bone;
  }

  // ---------------------------------------------------------------- render loop
  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  function start() {
    if (running || disposed || mode !== 'gl' || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Idle she renders at ~30 fps on medium/low quality (battery); reactions get every frame.
  const idleFrameMs = quality === 'high' ? 0 : 31;
  function loop(now) {
    if (!running || disposed) return;
    raf = requestAnimationFrame(loop);
    const busy = bounceT >= 0 || hopT >= 0 || animState !== 'idle' || Math.abs(lookTX - lookX) + Math.abs(lookTY - lookY) > 0.01;
    if (!busy && idleFrameMs && now - last < idleFrameMs) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    renderer.render(scene, camera);
  }

  function renderOnce() {
    if (renderer && scene && camera) {
      step(0);
      renderer.render(scene, camera);
    }
  }

  function step(dt) {
    time += dt;
    if (!model) return;
    if (stateUntil && time > stateUntil) {
      animState = 'idle';
      stateUntil = 0;
    }
    if (exprUntil && time > exprUntil) {
      model.userData.setExpression?.(null);
      exprUntil = 0;
    }
    // restore the head pose if the mixer left it alone, so the look offset never accumulates
    if (headBone && headApplied && headBone.quaternion.equals(headApplied)) headBone.quaternion.copy(headBase);
    model.userData.animate?.(time, dt, animState);
    // pointer follow: ease toward the target, body a little, head more
    const k = 1 - Math.exp(-dt * 4);
    lookX += (lookTX - lookX) * k;
    lookY += (lookTY - lookY) * k;
    pivot.rotation.y = 0.12 + lookX * 0.16;
    if (headBone) {
      headBase.copy(headBone.quaternion);
      tmpEuler.set(-lookY * 0.18, lookX * 0.32, 0);
      tmpQuat.setFromEuler(tmpEuler);
      headBone.quaternion.multiply(tmpQuat);
      headApplied.copy(headBone.quaternion);
    }
    // breathing + tap squash / hop
    let sy = 1 + (reduceMotion ? 0 : Math.sin(time * 2.1) * 0.006);
    let sx = 1 - (sy - 1) * 0.5;
    let y = 0;
    if (bounceT >= 0) {
      bounceT += dt;
      const t = bounceT / 0.42;
      if (t >= 1) bounceT = -1;
      else {
        const s = Math.sin(t * Math.PI * 2) * (1 - t) * 0.07;
        sy *= 1 - s;
        sx *= 1 + s * 0.6;
      }
    }
    if (hopT >= 0) {
      hopT += dt;
      const t = hopT / 0.5;
      if (t >= 1) hopT = -1;
      else y = Math.sin(t * Math.PI) * height * 0.07;
    }
    pivot.scale.set(sx, sy, sx);
    pivot.position.y = y;
  }
  let tmpEuler = null;
  let tmpQuat = null;

  // ---------------------------------------------------------------- input
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  function onDown(e) {
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
  }
  function onUp(e) {
    if (performance.now() - downAt > 600 || Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return;
    const part = hitTest(e.clientX, e.clientY);
    if (part) onTap?.(part, { x: e.clientX, y: e.clientY });
  }

  /** Screen rectangle of her figure (client px) or null. */
  function screenRect() {
    if (mode === 'art') {
      const img = artBox.firstElementChild;
      return img ? img.getBoundingClientRect() : null;
    }
    if (!model || !box || !camera) return null;
    const r = root.getBoundingClientRect();
    const pts = [[box.minX, box.minY], [box.maxX, box.minY], [box.minX, box.maxY], [box.maxX, box.maxY]];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const [x, y] of pts) {
      v.set(x, y, 0).project(camera);
      const sx = r.left + ((v.x + 1) / 2) * r.width;
      const sy = r.top + ((1 - v.y) / 2) * r.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    return { left: minX, right: maxX, top: minY, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }

  function hitTest(x, y) {
    const r = screenRect();
    if (!r) return null;
    const padX = r.width * 0.08;
    if (x < r.left - padX || x > r.right + padX || y < r.top || y > r.bottom) return null;
    return y < r.top + r.height * 0.45 ? 'head' : 'body';
  }

  artBox.addEventListener('click', (e) => {
    if (mode === 'art') onTap?.(hitTest(e.clientX, e.clientY) || 'body', { x: e.clientX, y: e.clientY });
  });

  // ---------------------------------------------------------------- showing a girl
  function showArt(u, awaken) {
    mode = 'art';
    stop();
    canvasBox.hidden = true;
    clear(artBox);
    artBox.hidden = false;
    artBox.appendChild(h('div.lb-sec-card', { html: cardArtSVG(u, { variant: 'full', awaken }) }));
  }

  async function show(u, { direction = 0, awaken = 0 } = {}) {
    const my = ++token;
    modelUnit = u;
    if (direction) {
      root.classList.remove('swap-in-l', 'swap-in-r');
      root.classList.add(direction > 0 ? 'swap-out-l' : 'swap-out-r');
    }
    const outDone = direction && !reduceMotion ? wait(170) : Promise.resolve();
    let next = null;
    let ok = await ensureGL();
    if (ok) {
      try {
        await models.preloadModels([u.id], { detail: 'full' });
        if (disposed || my !== token) return;
        next = models.buildChibi(u, { quality: quality === 'low' ? 'low' : 'high', detail: 'full' });
      } catch (e) {
        console.warn('[lobby] 3D secretary unavailable, showing card art', e);
        ok = false;
      }
    }
    await outDone;
    if (disposed || my !== token) {
      if (next) models.disposeObject(next);
      return;
    }
    if (ok && next) {
      mode = 'gl';
      artBox.hidden = true;
      canvasBox.hidden = false;
      const old = model;
      if (old) {
        pivot.remove(old);
        models.disposeObject(old);
      }
      model = next;
      pivot.add(model);
      measure(model);
      headBone = findHeadBone(model);
      headBase = headBone ? headBone.quaternion.clone() : null;
      headApplied = headBone ? headBone.quaternion.clone() : null;
      tmpEuler ||= new THREE.Euler();
      tmpQuat ||= new THREE.Quaternion();
      animState = 'idle';
      stateUntil = 0;
      exprUntil = 0;
      frameCamera();
      renderOnce();
      start();
    } else {
      showArt(u, awaken);
    }
    root.classList.remove('swap-out-l', 'swap-out-r');
    if (direction) root.classList.add(direction > 0 ? 'swap-in-r' : 'swap-in-l');
    root.classList.add('ready');
  }

  // ---------------------------------------------------------------- reactions + bubble
  const BODY_REACTIONS = [
    { state: null, attack: true, expr: 'attack', after: 'happy', dur: 1.1 },
    { state: 'cheer', expr: 'happy', dur: 1.6 },
    { state: 'pickup', expr: 'surprised', dur: 1.1, hop: true },
    { state: 'victory', expr: 'happy', dur: 1.9 },
    { state: null, expr: 'wink', dur: 1.4, hop: true },
  ];
  let bodyIdx = 0;

  function react(part, at = null) {
    if (part === 'head') {
      setExpr(Math.random() < 0.5 ? 'shy' : 'happy', 1.6);
      bounceT = reduceMotion ? -1 : 0;
      hearts(at, 4);
      return;
    }
    const r = BODY_REACTIONS[bodyIdx++ % BODY_REACTIONS.length];
    if (mode !== 'gl' || !model) {
      bounceT = 0;
      hearts(at, 2);
      return;
    }
    if (r.attack) model.userData.playAttack?.();
    if (r.state) {
      animState = r.state;
      stateUntil = time + r.dur;
    }
    setExpr(r.expr, r.after ? 0.5 : r.dur);
    if (r.after) setTimeout(() => setExpr(r.after, 1), 520);
    if (r.hop && !reduceMotion) hopT = 0;
    else if (!reduceMotion) bounceT = 0;
    sparkles(at);
  }

  function setExpr(name, dur) {
    if (!model) return;
    model.userData.setExpression?.(name);
    exprUntil = time + dur;
  }

  function hearts(at, count) {
    if (reduceMotion) return;
    burst(at, count, 'heart');
  }
  function sparkles(at) {
    if (reduceMotion) return;
    burst(at, 3, 'spark');
  }
  function burst(at, count, kind) {
    const r = root.getBoundingClientRect();
    const sr = screenRect();
    const x = at ? at.x - r.left : sr ? (sr.left + sr.right) / 2 - r.left : r.width / 2;
    const y = at ? at.y - r.top : sr ? sr.top - r.top + sr.height * 0.2 : r.height * 0.3;
    for (let i = 0; i < count; i++) {
      const el = h(`i.lb-fx-${kind}`, { style: { left: `${x}px`, top: `${y}px`, '--dx': `${Math.round((i - (count - 1) / 2) * 26 + (Math.random() * 12 - 6))}px`, '--d': `${i * 70}ms` } });
      fxBox.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
  }

  function say(text, ms = 6500) {
    if (!text) return;
    const span = bubble.firstElementChild;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    span.textContent = text;
    placeBubble();
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function placeBubble() {
    const r = root.getBoundingClientRect();
    const sr = screenRect();
    if (!sr || !r.width) return;
    // right of her face, a bit below the top of her head (BA places it beside the cheek)
    const left = Math.min(r.width - 40, sr.right - r.left - sr.width * 0.12);
    const top = Math.max(8, sr.top - r.top + sr.height * 0.16);
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
  }

  function look(nx, ny) {
    if (reduceMotion) return;
    lookTX = Math.max(-1, Math.min(1, nx));
    lookTY = Math.max(-1, Math.min(1, ny));
  }

  function dispose() {
    disposed = true;
    stop();
    clearTimeout(bubbleTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    ro?.disconnect();
    try {
      if (model) {
        pivot?.remove(model);
        models?.disposeObject(model);
      }
      if (shadow) {
        shadow.geometry.dispose();
        shadow.material.map?.dispose();
        shadow.material.dispose();
      }
      renderer?.dispose();
      renderer?.forceContextLoss?.();
    } catch (e) {
      console.warn('[lobby] secretary dispose failed', e);
    }
    root.remove();
  }

  return {
    el: root,
    show,
    react,
    say,
    look,
    hideBubble: () => bubble.classList.remove('show'),
    screenRect,
    get mode() { return mode; },
    get unit() { return modelUnit; },
    pause: stop,
    resume: start,
    dispose,
  };
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function radialTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(36,52,96,0.75)');
  grad.addColorStop(0.45, 'rgba(36,52,96,0.35)');
  grad.addColorStop(1, 'rgba(36,52,96,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
