// FNV-1a hash over the quantized, gameplay-relevant state of a co-op battle. Both clients
// compare it every COOP.hashEvery ticks to detect a desync.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Streaming 32-bit FNV-1a over integers. */
export function createHasher() {
  let h = FNV_OFFSET;
  return {
    int(v) {
      let x = Math.round(Number(v) || 0) | 0;
      for (let i = 0; i < 4; i++) {
        h ^= x & 0xff;
        h = Math.imul(h, FNV_PRIME) >>> 0;
        x >>>= 8;
      }
      return this;
    },
    str(s) {
      const t = String(s ?? '');
      for (let i = 0; i < t.length; i++) {
        h ^= t.charCodeAt(i) & 0xff;
        h = Math.imul(h, FNV_PRIME) >>> 0;
      }
      return this;
    },
    get value() {
      return h >>> 0;
    },
  };
}

/**
 * @param {import('../../sim/Sim.js').Sim} sim
 * @param {{ tick: number, wallets: number[] }} extra
 * @returns {number} unsigned 32-bit hash
 */
export function hashSim(sim, { tick = 0, wallets = [] } = {}) {
  const h = createHasher();
  h.int(tick).int(sim.wave).int(sim.lives).str(sim.state).int(sim._uid);
  for (const w of wallets) h.int(w);
  h.int(sim.enemies.length);
  for (const e of sim.enemies) {
    h.int(e.uid).int(e.x * 256).int(e.y * 256).int(e.hp * 16);
    // freeplay HP passes 2^27 (where hp × 16 wraps in 32 bits): hash the high part too (an exact
    // division by 2^28; never taken below it, so campaign hashes are unchanged)
    if (e.hp >= 134217728) h.int(Math.floor(e.hp / 268435456));
  }
  h.int(sim.towers.length);
  for (const t of sim.towers) h.int(t.uid).int(t.tiers[0]).int(t.tiers[1]).int(t.tiers[2]).int(t.x * 1024).int(t.y * 1024).str(t.targetMode);
  return h.value;
}
