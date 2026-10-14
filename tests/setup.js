// Vitest setup: the co-op view trap is on for every test (docs/specs/HERO_REWORK.md §8.3). Any read
// of sim.hero or sim.heroConfig inside Sim._step throws, so code that would make co-op clients
// disagree (each sees its own player's hero there) fails a test instead of desyncing a room.
globalThis.__SIM_VIEW_TRAP__ = true;
