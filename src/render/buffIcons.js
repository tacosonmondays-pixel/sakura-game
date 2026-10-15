// Buff icons over the girls and buff links on the ground (spec §4.2–4.5). Pure view: everything
// comes from the Sim's read-only buff API (sim.buffSources / buffTargets) through the shared UI
// model (src/ui/battle/buffs.js: which icon, which rim tint, which badge).
//
// Icons: a row of at most 4 (more collapse into "+N") above the girl's head, a constant 13–16 px on
// screen, drawn in the overlay batch; dark plate + white glyph + a rim in the source girl's tint
// (thicker and 1.15× for a limited buff, two half rims when an aura and a limited buff share a key,
// a badge at the top right, overclock pulses). They fade to 0.3 while an enemy stands next to the
// girl so they never hide an HP bar for long. Links (selected girl only): ground lines from every
// source to her and from her to every target, dashed for auras, moving dashes for brews / links.
// Pick mode (choosing Midori's / Chika's target): pulsing rings on every girl she can reach.
import * as THREE from 'three';
import { iconRow, iconPx, MAX_ICONS, PLATE, tintOf, LIMITED_KINDS, BUFF_ICON_MODES } from '../ui/battle/buffs.js';

/** Seconds between two reads of the Sim's buff sources (the Sim recomputes buffs at 5 Hz). */
const REFRESH = 0.2;
/** Enemies this close to a girl dim her icons (tiles). */
const NEAR_ENEMY = 0.6;
const TAU = Math.PI * 2;

export class BuffIcons {
  /** @param {{ sim, actors, batches, atlas }} o */
  constructor({ sim, actors, batches, atlas }) {
    this.sim = sim;
    this.actors = actors;
    this.b = batches;
    this.R = atlas.regions;
    this.atlas = atlas;
    this.mode = 'all';
    this.selectedUid = null;
    this.pick = null; // { src, cands: Set<uid>, tint }
    this.rows = new Map(); // uid → { row, sources }
    this.targets = [];
    this.timer = 0;
    this.time = 0;
    this._colors = new Map();
    this._box = new THREE.Box3();
    this._plate = new THREE.Color(PLATE);
    /** What the last frame drew (e2e / debugging): icon quads' rows, icons, link dashes' lines, pick rings. */
    this.stats = { rows: 0, icons: 0, links: 0, pick: 0 };
  }

  /** 'all' | 'selected' | 'off' (settings.buffIcons). */
  setMode(mode) {
    this.mode = BUFF_ICON_MODES.includes(mode) ? mode : 'all';
  }

  setSelected(uid) {
    this.selectedUid = uid ?? null;
    this.timer = 0;
  }

  /** Pick mode: rings on `candidates` (uids) in the tint of the girl who picks; null ends it. */
  setPick(srcUid, candidates = []) {
    if (srcUid == null) {
      this.pick = null;
      return;
    }
    const src = this.sim.getTower(srcUid);
    this.pick = { src: srcUid, cands: new Set(candidates), tint: tintOf(src?.unitId, src?.def) };
  }

  _color(hex) {
    let c = this._colors.get(hex);
    if (!c) this._colors.set(hex, (c = new THREE.Color(hex)));
    return c;
  }

  _refresh() {
    const sim = this.sim;
    this.rows.clear();
    if (typeof sim.buffSources !== 'function') return;
    const defOf = (id) => sim.data?.unit?.(id) || null;
    for (const t of sim.towers) {
      if (t.removed) continue;
      const sources = sim.buffSources(t.uid);
      if (sources.length) this.rows.set(t.uid, { row: iconRow(sources, defOf), sources });
    }
    this.targets = this.selectedUid != null ? sim.buffTargets(this.selectedUid) : [];
  }

  /** World height of a girl's head (her model's bounding box, measured once she has popped in). */
  _headY(t) {
    const v = this.actors.towerView(t.uid);
    if (!v) return 1.1;
    if (v.headY == null && v.pop >= 1) {
      this._box.setFromObject(v.model);
      v.headY = Number.isFinite(this._box.max.y) ? Math.max(0.6, this._box.max.y) : 1.1;
    }
    return v.headY ?? 1.1;
  }

  /** The girls whose icons show in 'selected' mode: the selected one and everyone linked to her. */
  _linked() {
    const out = new Set();
    const sel = this.selectedUid;
    if (sel == null) return out;
    out.add(sel);
    for (const s of this.rows.get(sel)?.sources || []) if (s.src >= 0) out.add(s.src);
    for (const tg of this.targets) out.add(tg.uid);
    return out;
  }

  /**
   * Draws one frame. `worldPerPx`: world units per CSS px (the camera rig's scale); `shortSide`: the
   * viewport's short side in CSS px (icon size 13 px at ≤ 400, 16 px at ≥ 700).
   */
  update(dt, { worldPerPx, shortSide }) {
    this.stats = { rows: 0, icons: 0, links: 0, pick: 0 };
    this.time += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this._refresh();
      this.timer = REFRESH;
    }
    if (this.pick) this._drawPick();
    if (this.mode === 'off') return;
    const sel = this.selectedUid != null ? this.sim.getTower(this.selectedUid) : null;
    if (sel) this._drawLinks(sel);
    const only = this.mode === 'selected' ? this._linked() : null;
    const px = iconPx(shortSide);
    for (const [uid, { row }] of this.rows) {
      if (!row.length || (only && !only.has(uid))) continue;
      const t = this.sim.getTower(uid);
      if (!t || t.removed) continue;
      this._drawRow(t, row, px * worldPerPx, worldPerPx, uid === this.selectedUid);
    }
  }

  _drawRow(t, row, size0, wpp, selected) {
    this.stats.rows++;
    const ov = this.b.overlay;
    const R = this.R;
    let near = false;
    this.sim.grid?.each?.(t.x, t.y, NEAR_ENEMY, () => (near = true));
    const alpha = near ? 0.3 : 0.85;
    const size = size0 * (selected ? 1.2 : 1);
    const gap = 2 * wpp;
    const extra = row.length > MAX_ICONS ? row.length - (MAX_ICONS - 1) : 0;
    const shown = extra ? row.slice(0, MAX_ICONS - 1) : row;
    const n = shown.length + (extra ? 1 : 0);
    const x = t.x;
    const z = t.y;
    const y = this._headY(t) + 0.12;
    // above the selection chevron when she is selected
    const oy = size * 0.6 + (selected ? 0.32 : 0);
    const plate = this._plate;
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * (size + gap);
      if (extra && i === n - 1) {
        // "+N"
        ov.push(x, y, z, size, size, R.dot, plate.r, plate.g, plate.b, alpha, 0, ox, oy);
        const label = `+${Math.min(9, extra)}`;
        const gh = size * 0.62;
        const gw = gh * this.atlas.glyphAspect * 0.8;
        for (let k = 0; k < label.length; k++) {
          const uv = this.atlas.glyph(label[k]);
          if (uv) ov.push(x, y, z, gw, gh, uv, 1, 1, 1, alpha, 0, ox + (k - (label.length - 1) / 2) * gw * 0.85, oy);
        }
        continue;
      }
      const ic = shown[i];
      this.stats.icons++;
      let s = ic.limited ? size * 1.15 : size;
      if (ic.pulse) s *= 1 + 0.075 * (1 + Math.sin(this.time * TAU * 3));
      const c = this._color(ic.tint);
      ov.push(x, y, z, s, s, R.dot, plate.r, plate.g, plate.b, alpha, 0, ox, oy);
      ov.push(x, y, z, s * 0.66, s * 0.66, R[ic.icon], 1, 1, 1, alpha, 0, ox, oy);
      if (ic.tint2) {
        const c2 = this._color(ic.tint2);
        ov.push(x, y, z, s * 1.12, s * 1.12, R.bfRimHalf, c.r, c.g, c.b, alpha, 0, ox, oy);
        ov.push(x, y, z, s * 1.12, s * 1.12, R.bfRimHalf, c2.r, c2.g, c2.b, alpha, Math.PI, ox, oy);
      } else {
        ov.push(x, y, z, s * 1.08, s * 1.08, ic.limited ? R.bfRimThick : R.bfRim, c.r, c.g, c.b, alpha, 0, ox, oy);
      }
      if (ic.badge && R[ic.badge]) ov.push(x, y, z, s * 0.6, s * 0.6, R[ic.badge], c.r, c.g, c.b, Math.min(1, alpha + 0.1), 0, ox + s * 0.42, oy + s * 0.42);
    }
  }

  /** One ground line from a to b: dashes (aura) or dashes moving toward b (brew / link), in the
   *  links batch (ground plane, drawn over the models: girls standing close would hide it). */
  _line(a, b, hex, kind) {
    const gN = this.b.links || this.b.groundN;
    const R = this.R;
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    this.stats.links++;
    const ux = dx / len;
    const uz = dz / len;
    const rot = Math.atan2(-dz, dx);
    const limited = LIMITED_KINDS.has(kind);
    // a few px wide at any zoom (the spec's 0.04 / 0.07 tiles were under 2 px on a phone)
    const w = limited ? 0.12 : 0.08;
    const dash = limited ? 0.26 : 0.3;
    const step = limited ? 0.4 : 0.44;
    const c = this._color(hex);
    const a0 = kind === 'overclock' ? 1 : limited ? 0.95 : 0.8;
    const phase = limited ? (this.time * 1.4) % step : 0;
    const start = 0.28; // leave the girls' feet clear
    for (let d = start + phase; d < len - start; d += step) {
      const m = Math.min(dash, len - start - d);
      if (m <= 0.02) break;
      const cx = a.x + ux * (d + m / 2);
      const cz = a.y + uz * (d + m / 2);
      gN.push(cx, 0.09, cz, m + w * 0.8, w * 1.8, R.white, 0.08, 0.1, 0.18, a0 * 0.3, rot);
      if (!gN.push(cx, 0.092, cz, m, w, R.white, c.r, c.g, c.b, a0, rot)) this.stats.dropped = (this.stats.dropped || 0) + 1;
      else this.stats.dashes = (this.stats.dashes || 0) + 1;
    }
  }

  _drawLinks(sel) {
    const sim = this.sim;
    const seen = new Set();
    // incoming: every source to her (auras: the winner of each key, one line per girl)
    for (const s of this.rows.get(sel.uid)?.sources || []) {
      if (s.src < 0 || s.kind === 'ult' || s.kind === 'map') continue;
      const key = `${s.src}:${LIMITED_KINDS.has(s.kind) ? s.kind : 'aura'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const src = sim.getTower(s.src);
      if (src) this._line(src, sel, tintOf(src.unitId, src.def), s.kind);
    }
    // outgoing: her to every girl she buffs
    const tint = tintOf(sel.unitId, sel.def);
    const oc = sel.stats?.link?.overclock && sel.lim?.ocLeft > 0;
    for (const tg of this.targets) {
      const o = sim.getTower(tg.uid);
      if (!o) continue;
      const kind = tg.kinds.includes('brew') ? 'brew' : tg.kinds.includes('link') ? (oc ? 'overclock' : 'link') : 'aura';
      this._line(sel, o, tint, kind);
    }
  }

  _drawPick() {
    const gA = this.b.groundA;
    const c = this._color(this.pick.tint);
    const k = 0.6 + 0.4 * Math.sin(this.time * TAU * 1.5);
    for (const uid of this.pick.cands) {
      const t = this.sim.getTower(uid);
      if (!t) continue;
      this.stats.pick++;
      const d = (t.radius || 0.42) * 2.6;
      this.b.groundN.push(t.x, 0.085, t.y, d, d, this.R.ringThick, c.r, c.g, c.b, 0.55 + 0.4 * k, this.time);
      gA.push(t.x, 0.086, t.y, d * (1 + 0.15 * k), d * (1 + 0.15 * k), this.R.ring, c.r, c.g, c.b, 0.6 * k, 0);
    }
  }
}
