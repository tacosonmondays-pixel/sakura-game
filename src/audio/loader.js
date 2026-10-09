// Fetch + decode with two LRU caches: compressed bytes (16 MB) and decoded buffers (96 MB on phones,
// 256 MB on desktop). Playing / pending buffers are pinned and never evicted (docs/AUDIO.md §2.10, §3.4).
import { decodeAudio } from './engine.js';

/** Tiny LRU keyed by url with a byte budget. */
export function createLru(budget, sizeOf) {
  const map = new Map();
  let bytes = 0;
  return {
    get(k) {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);
      return v;
    },
    has: (k) => map.has(k),
    set(k, v, pinned = new Set()) {
      if (map.has(k)) bytes -= sizeOf(map.get(k));
      map.delete(k);
      map.set(k, v);
      bytes += sizeOf(v);
      for (const [key, val] of map) {
        if (bytes <= budget) break;
        if (key === k || pinned.has(key)) continue;
        map.delete(key);
        bytes -= sizeOf(val);
      }
    },
    get bytes() {
      return bytes;
    },
    get size() {
      return map.size;
    },
    keys: () => [...map.keys()],
  };
}

export function createLoader(engine) {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const raw = createLru(16 * 1024 * 1024, (b) => b.byteLength);
  const decoded = createLru((coarse ? 96 : 256) * 1024 * 1024, (b) => b.length * b.numberOfChannels * 4);
  const inflightBytes = new Map();
  const inflightDecode = new Map();
  const pinned = new Set();
  const saveData = typeof navigator !== 'undefined' && navigator.connection?.saveData;

  async function bytes(url) {
    const hit = raw.get(url);
    if (hit) return hit;
    if (inflightBytes.has(url)) return inflightBytes.get(url);
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        raw.set(url, b);
        return b;
      })
      .finally(() => inflightBytes.delete(url));
    inflightBytes.set(url, p);
    return p;
  }

  async function decode(url) {
    const hit = decoded.get(url);
    if (hit) return hit;
    if (inflightDecode.has(url)) return inflightDecode.get(url);
    const p = (async () => {
      const b = await bytes(url);
      const buf = await decodeAudio(engine.ctx, b.slice(0));
      decoded.set(url, buf, pinned);
      return buf;
    })().finally(() => inflightDecode.delete(url));
    inflightDecode.set(url, p);
    return p;
  }

  function stemUrls(manifest, id, f = engine.format) {
    const t = manifest?.tracks?.[id];
    if (!t || !f) return {};
    const out = {};
    for (const [name, st] of Object.entries(t.stems || {})) out[name] = `${engine.base}music/${st.file}.${f.ext}`;
    return out;
  }

  /**
   * Decode a track's stems in order → { stem: Promise<AudioBuffer> }: all bytes are fetched at once, the first
   * stem (base / full) is decoded first and the others after it, so a track can start on its first stem while
   * the rest are still decoding (MusicDirector joins them sample-locked). Throws when nothing can load.
   */
  function loadStems(manifest, id, { pin = true } = {}) {
    const urls = stemUrls(manifest, id);
    const names = Object.keys(urls);
    if (!names.length) throw new Error(`track ${id}: nothing to load (format ${engine.format?.id || 'none'})`);
    if (pin) names.forEach((n) => pinned.add(urls[n]));
    for (const n of names) bytes(urls[n]).catch(() => {});
    const first = decode(urls[names[0]]);
    const after = first.catch(() => null);
    const out = { [names[0]]: first };
    for (const n of names.slice(1)) out[n] = after.then(() => decode(urls[n]));
    return out;
  }

  return {
    bytes,
    decode,
    stemUrls,
    loadStems,
    /** Decode every stem of a track → { stem: AudioBuffer } (pins them while `pin` is true). */
    async loadTrack(manifest, id, { pin = true } = {}) {
      const proms = loadStems(manifest, id, { pin });
      const names = Object.keys(proms);
      const bufs = await Promise.all(names.map((n) => proms[n]));
      return Object.fromEntries(names.map((n, i) => [n, bufs[i]]));
    },
    /** Fetch (and optionally decode, first stem first) a track in the background; failures are silent. */
    preload(manifest, id, { decode: dec = false } = {}) {
      if (saveData) return;
      if (dec) {
        try {
          for (const p of Object.values(loadStems(manifest, id, { pin: false }))) p.catch(() => {});
        } catch {
          /* nothing to load */
        }
        return;
      }
      for (const u of Object.values(stemUrls(manifest, id))) bytes(u).catch(() => {});
    },
    /** Fetch a track's bytes in a given format before the probe has run (no decode; failures are silent). */
    prefetch(manifest, id, fmt) {
      if (saveData || !fmt) return 0;
      const urls = Object.values(stemUrls(manifest, id, fmt));
      for (const u of urls) bytes(u).catch(() => {});
      return urls.length;
    },
    setPinned(urls) {
      pinned.clear();
      for (const u of urls) pinned.add(u);
    },
    stats: () => ({ decodedBytes: decoded.bytes, decodedCount: decoded.size, rawBytes: raw.bytes, pinned: pinned.size }),
  };
}
