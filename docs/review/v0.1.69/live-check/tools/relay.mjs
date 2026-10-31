// Localhost relay: live build for everything, local checkout (Vite) only for /src, /@vite, /@fs, /@id, /node_modules.
import http from 'node:http';
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { appendFileSync } from 'node:fs';
const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 5199);
const LOG = process.argv[4] || '/tmp/live/logs/relay.log';
const LIVE = 'https://tacosonmondays-pixel.github.io/sakura-game';
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const LOCAL = /^\/(src\/|@vite\/|@fs\/|@id\/|node_modules\/|@react-refresh)/;
http.createServer(async (req, res) => {
  let path = req.url;
  if (LOCAL.test(path)) { appendFileSync(LOG, `LOCAL ${path}\n`); return vite.middlewares(req, res, () => { res.statusCode = 404; res.end(); }); }
  if (path.startsWith('/sakura-game/')) path = path.slice('/sakura-game'.length);
  try {
    const r = await fetch(LIVE + path, { headers: { 'user-agent': 'live-check-relay' } });
    const buf = Buffer.from(await r.arrayBuffer());
    appendFileSync(LOG, `LIVE ${r.status} ${path}\n`);
    const h = {};
    for (const k of ['content-type', 'cache-control', 'etag', 'last-modified']) if (r.headers.get(k)) h[k] = r.headers.get(k);
    res.writeHead(r.status, h); res.end(buf);
  } catch (e) { appendFileSync(LOG, `LIVE ERR ${path} ${e.message}\n`); res.statusCode = 502; res.end(); }
}).listen(PORT, '127.0.0.1', () => console.log(`relay on ${PORT}`));
