// Uniform spatial hash for fast radius queries over enemies. Rebuilt every step;
// cell arrays are reused so steady-state rebuilding allocates nothing.

export class SpatialGrid {
  /**
   * @param {number} minX @param {number} minY @param {number} maxX @param {number} maxY
   * @param {number} cell cell size in tiles
   */
  constructor(minX, minY, maxX, maxY, cell = 2) {
    this.minX = minX;
    this.minY = minY;
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.rows = Math.max(1, Math.ceil((maxY - minY) / cell));
    this.cells = [];
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
  }

  clear() {
    for (const c of this.cells) c.length = 0;
  }

  _cx(x) {
    const c = Math.floor((x - this.minX) / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  _cy(y) {
    const c = Math.floor((y - this.minY) / this.cell);
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c;
  }

  /** @param {{ x: number, y: number }} item */
  insert(item) {
    this.cells[this._cy(item.y) * this.cols + this._cx(item.x)].push(item);
  }

  /** Rebuilds from a list, skipping items flagged `dead`. */
  rebuild(items) {
    this.clear();
    for (let i = 0; i < items.length; i++) if (!items[i].dead) this.insert(items[i]);
  }

  /**
   * Pushes every live item whose centre lies within `r` of (x, y) into `out`.
   * Positions are read live, so items that moved slightly since insertion are still
   * tested exactly (cells are padded by `pad`).
   * @returns {any[]} out
   */
  query(x, y, r, out = [], pad = 0.5) {
    const rr = r + pad;
    const x0 = this._cx(x - rr);
    const x1 = this._cx(x + rr);
    const y0 = this._cy(y - rr);
    const y1 = this._cy(y + rr);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[row + cx];
        for (let i = 0; i < cell.length; i++) {
          const it = cell[i];
          if (it.dead) continue;
          const dx = it.x - x;
          const dy = it.y - y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    }
    return out;
  }

  /** Calls fn(item) for every live item within r; stops early when fn returns true. */
  each(x, y, r, fn, pad = 0.5) {
    const rr = r + pad;
    const x0 = this._cx(x - rr);
    const x1 = this._cx(x + rr);
    const y0 = this._cy(y - rr);
    const y1 = this._cy(y + rr);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[row + cx];
        for (let i = 0; i < cell.length; i++) {
          const it = cell[i];
          if (it.dead) continue;
          const dx = it.x - x;
          const dy = it.y - y;
          if (dx * dx + dy * dy <= r2 && fn(it)) return;
        }
      }
    }
  }
}
