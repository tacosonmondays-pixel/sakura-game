import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// desktop/launcher.cjs is CommonJS (it becomes the exe's SEA main); load it the native way.
// Requiring it does not start the game: main() only runs inside the exe or as the entry script.
const require = createRequire(import.meta.url);
const { createAssetReader, createHandler, listen, MARKER } = require('../../desktop/launcher.cjs');

/** Raw GET: node's http keeps the path as written ('/../x' is not normalised like fetch does). */
function get(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

const INDEX = '<!doctype html><title>tiny dist</title>';
const SECRET = 'outside the dist folder';
// requests a web page could make to crash or escape the server
const HOSTILE = ['/%', '/%E0%A4%A', '/constructor', '/__proto__', '/toString', '/hasOwnProperty', '/constructor/x.js', '/__proto__.js', '/../x', '/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/..%2fdist-secret%2fsecret.txt', '/..\\secret.txt', '/C:/Windows/win.ini', '/%00'];

describe('desktop launcher on disk (non-SEA)', () => {
  let tmp;
  let server;
  let port;

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-launcher-'));
    const dist = path.join(tmp, 'dist');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), INDEX);
    fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1);');
    // a sibling whose name starts with 'dist' (the old prefix check let '../dist-secret/x' through)
    fs.mkdirSync(path.join(tmp, 'dist-secret'));
    fs.writeFileSync(path.join(tmp, 'dist-secret', 'secret.txt'), SECRET);
    fs.writeFileSync(path.join(tmp, 'secret.txt'), SECRET);
    server = await listen(0, createHandler(createAssetReader({ dir: dist })));
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('serves the build, the SPA fallback and the single-instance marker', async () => {
    const root = await get(port, '/');
    expect(root.status).toBe(200);
    expect(root.type).toMatch(/text\/html/);
    expect(root.body).toBe(INDEX);
    const js = await get(port, '/assets/app.js?v=1');
    expect(js.status).toBe(200);
    expect(js.type).toMatch(/javascript/);
    const spa = await get(port, '/lobby');
    expect(spa.body).toBe(INDEX);
    expect(spa.type).toMatch(/text\/html/); // used to be application/octet-stream (a download)
    expect((await get(port, '/missing.js')).status).toBe(404);
    expect((await get(port, '/__sakura')).body).toBe(MARKER);
  });

  test('malformed percent-encoding is a 400, not a crash', async () => {
    expect((await get(port, '/%')).status).toBe(400);
    expect((await get(port, '/%E0%A4%A')).status).toBe(400);
  });

  test('hostile paths never leave the folder and never take the server down', async () => {
    for (const p of HOSTILE) {
      const res = await get(port, p);
      expect([200, 400, 404], p).toContain(res.status);
      expect(res.body, p).not.toContain(SECRET);
      // extension-less names fall back to index.html; anything else is missing
      if (res.status === 200) expect(res.body, p).toBe(INDEX);
    }
    expect((await get(port, '/..%2fdist-secret%2fsecret.txt')).status).toBe(404);
    expect((await get(port, '/')).status).toBe(200); // still alive
  });
});

describe('desktop launcher on SEA assets (fake node:sea)', () => {
  let server;
  let port;
  let failing;

  beforeAll(async () => {
    const assets = new Map([
      ['index.html', INDEX],
      ['assets/app.js', 'console.log(1);'],
    ]);
    // like node:sea, getAsset() throws for a key it does not hold and returns an ArrayBuffer
    const fakeSea = {
      getAsset(key) {
        if (!assets.has(key)) throw Object.assign(new Error(`asset ${key} not found`), { code: 'ERR_SINGLE_EXECUTABLE_APPLICATION_ASSET_NOT_FOUND' });
        return new TextEncoder().encode(assets.get(key)).buffer;
      },
    };
    // 'listed.js' is in the manifest but not in the blob: still a 404, not a crash
    const manifest = JSON.parse(JSON.stringify({ files: { 'index.html': INDEX.length, 'assets/app.js': 15, 'listed.js': 3 } }));
    server = await listen(0, createHandler(createAssetReader({ sea: fakeSea, manifest })));
    port = server.address().port;
    failing = await listen(0, createHandler(() => {
      throw new Error('disk on fire');
    }));
  });

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await new Promise((r) => failing?.close(r));
  });

  test('inherited manifest keys are not assets (they used to reach sea.getAsset and crash)', async () => {
    for (const p of ['/constructor', '/__proto__', '/toString', '/hasOwnProperty', '/valueOf']) {
      const res = await get(port, p);
      expect(res.status, p).toBe(200);
      expect(res.body, p).toBe(INDEX);
      expect(res.type, p).toMatch(/text\/html/);
    }
    expect((await get(port, '/constructor.js')).status).toBe(404);
    expect((await get(port, '/listed.js')).status).toBe(404);
    expect((await get(port, '/%')).status).toBe(400);
    expect((await get(port, '/assets/app.js')).body).toBe('console.log(1);');
  });

  test('every hostile path gets an error status or the index, and the server keeps answering', async () => {
    for (const p of HOSTILE) expect([200, 400, 404], p).toContain((await get(port, p)).status);
    expect((await get(port, '/')).body).toBe(INDEX);
  });

  test('an unexpected error inside the handler is a 500, not a crash', async () => {
    const errSpy = console.error;
    console.error = () => {};
    try {
      expect((await get(failing.address().port, '/')).status).toBe(500);
      expect((await get(failing.address().port, '/x.js')).status).toBe(500);
    } finally {
      console.error = errSpy;
    }
  });
});
