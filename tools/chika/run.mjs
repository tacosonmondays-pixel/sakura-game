// Runs a Chika measurement script against the real sim: bundles `entry` with Vite (src/sim reads
// its data through import.meta.glob) and calls its exported main(argv).
//   node tools/chika/run.mjs tools/chika/measure.js <command> [options]
// docs/specs/CHIKA_REWORK.md §16 (flight modes) lists the commands and what each one measures.
import { build } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node tools/chika/run.mjs <entry.js> [args…]');
  process.exit(2);
}
const out = mkdtempSync(join(tmpdir(), 'ss-chika-'));
const name = basename(entry).replace(/\.js$/, '') + '.bundle.mjs';
await build({
  configFile: false,
  root: process.cwd(),
  logLevel: 'error',
  build: {
    outDir: out,
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    lib: { entry: resolve(entry), formats: ['es'], fileName: () => name },
  },
});
try {
  const mod = await import(pathToFileURL(join(out, name)).href);
  await mod.main(args);
} finally {
  rmSync(out, { recursive: true, force: true });
}
