// Every per-milestone shot list (e2e/shots/m*.mjs): each builder owns one file, so two never edit the same list.
// e2e/ui-shots.mjs merges their shots into its own (`--screens m1` picks a list); e2e/menus.mjs judges them.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => /^m\d.*\.mjs$/.test(f)).sort();
/** @type {Record<string, object>} every shot of every list file */
export const SHOT_DEFS = {};
/** @type {Record<string, string[]>} milestone id -> its shot names, in order */
export const MILESTONES = {};
/** @type {Record<string, { limit?: number, dense?: string[], rebuilt?: boolean }>} gate options per shot, ui-shots' own shots included */
export const GATE = {};
for (const f of files) {
  const m = await import(join(here, f));
  for (const [name, s] of Object.entries(m.shots || {})) {
    if (SHOT_DEFS[name]) throw new Error(`e2e/shots: shot "${name}" is defined twice (${f})`);
    SHOT_DEFS[name] = { ...s, milestone: m.milestone };
  }
  MILESTONES[m.milestone] = m.list || Object.keys(m.shots || {});
  for (const [name, s] of Object.entries(m.shots || {})) if (s.limit || s.dense || s.rebuilt) GATE[name] = { limit: s.limit, dense: s.dense, rebuilt: s.rebuilt };
  for (const [name, g] of Object.entries(m.gate || {})) GATE[name] = { ...GATE[name], ...g };
}
