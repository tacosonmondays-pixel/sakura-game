// Node-side fingerprint of a whole battle terrain (src/render/terrain.js buildTerrain), for the
// golden test in terrainGolden.test.js. Node has no canvas, so `document.createElement('canvas')`
// is replaced by a recording stand-in: every 2D call and state change folds into that canvas's
// FNV-1a hash (drawImage folds in the source canvas's hash, putImageData the pixel bytes). Same
// commands → same pixels, so the hash stands in for the painted ground, masks and tile textures.
// The geometry (every attribute, index and world matrix), the materials' sorting fields, the glow
// sprites, emitters, ground marks and gates fold in on top.

const FNV0 = 2166136261;

function fnvBytes(h, bytes) {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function fnvStr(h, s) {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
const fnvArr = (h, a) => fnvBytes(h, new Uint8Array(a.buffer, a.byteOffset, a.byteLength));

/** Rounds numbers (1e-6) so the fingerprint ignores last-bit noise. */
function token(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
  if (v && typeof v === 'object' && '__rec' in v) return `#${v.__rec()}`;
  if (v && typeof v === 'object' && v.data instanceof Uint8ClampedArray) return `img${v.width}x${v.height}:${fnvArr(FNV0, v.data)}`;
  if (Array.isArray(v)) return `[${v.map(token).join(',')}]`;
  return String(v);
}

class RecGradient {
  constructor(kind, args) {
    this.h = fnvStr(FNV0, `${kind}(${args.map(token).join(',')})`);
  }

  addColorStop(o, c) {
    this.h = fnvStr(this.h, `stop(${token(o)},${c})`);
  }

  __rec() {
    return this.h;
  }
}

/** A canvas whose "pixels" are the hash of everything drawn on it. */
class RecCanvas {
  constructor(recorder) {
    this._w = 300;
    this._h = 150;
    this.h = FNV0;
    this.style = {};
    this.recorder = recorder;
    recorder.canvases.push(this);
    const state = { filter: 'none', globalAlpha: 1 };
    const self = this;
    const fold = (s) => {
      self.h = fnvStr(self.h, s);
    };
    const special = {
      canvas: self,
      createLinearGradient: (...a) => new RecGradient('lin', a),
      createRadialGradient: (...a) => new RecGradient('rad', a),
      createPattern: (src, rep) => ({ __rec: () => fnvStr(src.__rec ? src.__rec() : FNV0, String(rep)) }),
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => {
        fold(`get(${x},${y},${w},${h})`);
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
      measureText: (t) => ({ width: String(t).length * 8 }),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    };
    this.ctx = new Proxy({}, {
      get(_, prop) {
        if (prop in special) return special[prop];
        if (prop in state) return state[prop];
        return (...args) => fold(`${String(prop)}(${args.map(token).join(',')})`);
      },
      set(_, prop, value) {
        state[prop] = value;
        fold(`${String(prop)}=${token(value)}`);
        return true;
      },
    });
  }

  get width() {
    return this._w;
  }

  set width(v) {
    this._w = v;
    this.h = fnvStr(this.h, `w=${v}`);
  }

  get height() {
    return this._h;
  }

  set height(v) {
    this._h = v;
    this.h = fnvStr(this.h, `h=${v}`);
  }

  getContext() {
    return this.ctx;
  }

  addEventListener() {}

  removeEventListener() {}

  __rec() {
    return this.h;
  }
}

/** A `document` stand-in whose canvases record; `canvases` lists them in creation order. */
export function recordingDocument() {
  const rec = { canvases: [] };
  rec.document = {
    createElement(tag) {
      if (tag === 'canvas') return new RecCanvas(rec);
      return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} };
    },
  };
  return rec;
}

/**
 * Fingerprint of a built terrain: geometry, materials' sort fields, every canvas painted while it
 * was built (`canvases`, in creation order), glows, emitters, marks and gates.
 * @param {object} t buildTerrain() result
 * @param {object[]} canvases the recorder's canvases created during the build
 * @returns {string} 8 hex digits
 */
export function terrainFingerprint(t, canvases) {
  let h = FNV0;
  t.group.updateMatrixWorld(true);
  t.group.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material || {};
    h = fnvStr(h, `${o.name}|${m.type}|${!!m.transparent}|${m.opacity ?? ''}|${o.renderOrder}|${o.isInstancedMesh ? o.count : ''}`);
    const g = o.geometry;
    for (const n of Object.keys(g.attributes).sort()) h = fnvArr(h, g.attributes[n].array);
    if (g.index) h = fnvArr(h, g.index.array);
    h = fnvArr(h, new Float32Array(o.matrixWorld.elements));
  });
  for (const c of canvases) h = fnvStr(h, `${c.width}x${c.height}:${c.__rec()}`);
  const json = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x && x.isColor ? x.getHex() : x));
  h = fnvStr(h, json(t.glows.map((g) => [g.x, g.y, g.z, g.size, g.flicker, g.phase, g.color])));
  h = fnvStr(h, json(t.emitters.map((e) => [e.kind, e.x, e.y, e.z, e.color])));
  h = fnvStr(h, json(t.marks || []));
  h = fnvStr(h, json(t.gates || []));
  return h.toString(16).padStart(8, '0');
}
