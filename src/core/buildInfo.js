// What build is running (vite.config.js defines these at build time; tests and odd setups fall
// back to 'dev'). APP_VERSION is the number players see and compare ("0.1.17": one more per
// deploy); BUILD_ID is the git commit; SIM_ID says which co-op builds can play together.
/* global __APP_VERSION__, __BUILD_ID__, __SIM_ID__, __BUILD_TIME__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '0.1.dev';
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : 'dev';
export const SIM_ID = typeof __SIM_ID__ !== 'undefined' ? String(__SIM_ID__) : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? String(__BUILD_TIME__) : '';

/** "v0.1.17" */
export function versionLabel(version = APP_VERSION) {
  return `v${version}`;
}

/** "Version 0.1.17 · build 76e7b20 · Oct 13, 2026" (Settings → About). */
export function buildLine() {
  const parts = [`Version ${APP_VERSION}`, `build ${BUILD_ID.replace(/\+$/, '').slice(0, 7)}`];
  const t = BUILD_TIME ? new Date(BUILD_TIME) : null;
  if (t && !Number.isNaN(t.getTime())) parts.push(t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  return parts.join(' · ');
}

/**
 * Compares two player-facing versions ("0.1.17" vs "0.1.9"): -1 when a is older, 1 when newer,
 * 0 when equal, null when either is missing or not numeric ("0.1.dev").
 */
export function compareVersions(a, b) {
  const pa = String(a ?? '').split('.');
  const pb = String(b ?? '').split('.');
  if (!a || !b || pa.length !== 3 || pb.length !== 3 || ![...pa, ...pb].every((x) => /^\d+$/.test(x))) return null;
  for (let i = 0; i < 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
