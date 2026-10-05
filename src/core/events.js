// Tiny event emitter used by the store and battle controller.
export function createEmitter() {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt)?.delete(fn);
    },
    off(evt, fn) {
      map.get(evt)?.delete(fn);
    },
    emit(evt, payload) {
      for (const fn of [...(map.get(evt) || [])]) {
        try {
          fn(payload);
        } catch (e) {
          console.error(`[events] handler for "${evt}" failed`, e);
        }
      }
    },
  };
}
