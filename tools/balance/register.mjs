// Registers the import.meta.glob shim (glob-loader.mjs) so the sim loads under plain Node.
// Import this BEFORE any dynamic import of src/sim/** (static imports are hoisted and would
// load the sim first). Also usable as `node --import ./tools/balance/register.mjs ...`.
import { register } from 'node:module';

register('./glob-loader.mjs', import.meta.url);
