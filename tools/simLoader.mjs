// Lets plain Node run the sim (tools only): src/sim/data.js resolves its data with Vite's
// import.meta.glob, which Node does not have. This load hook rewrites that one eager glob into
// static imports.   node --import ./tools/simLoader.mjs tools/freeplayBot.mjs …
import { register } from 'node:module';

if (!globalThis.__simLoaderHooks) {
  globalThis.__simLoaderHooks = true;
  const hooks = `
export async function load(url, context, next) {
  const r = await next(url, context);
  if (!url.endsWith('/src/sim/data.js')) return r;
  let src = String(r.source);
  src = src.replace(/const MODULES = import\\.meta\\.glob\\(\\s*\\[([^\\]]*)\\][^;]*;/, (_, list) => {
    const paths = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const imps = paths.map((p, i) => 'import * as __m' + i + ' from ' + JSON.stringify(p) + ';').join('\\n');
    return imps + '\\nconst MODULES = {' + paths.map((p, i) => JSON.stringify(p) + ': __m' + i).join(', ') + '};';
  });
  return { ...r, source: src, shortCircuit: true };
}`;
  register('data:text/javascript,' + encodeURIComponent(hooks), import.meta.url);
}
