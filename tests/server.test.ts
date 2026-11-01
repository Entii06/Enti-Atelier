import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApp } from '../server.ts';
import artworkHandler from '../api/default-artworks.ts';
import dictionaryHandler from '../api/dictionary/cambridge.ts';

test('production API serves valid manifest, rejects writes and validates queries', async () => {
  const app = await createApp({ production: true, serveFrontend: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${base}/api/default-artworks`);
    const manifest = await response.json();
    assert.equal(response.status, 200);
    assert.equal(manifest.writable, false);
    assert.equal(manifest.artworks.length, 12);
    assert.deepEqual(manifest.missingFileIds, []);
    assert.equal((await fetch(`${base}/api/default-artworks/sync`, { method: 'POST', body: 'invalid JSON', headers: { 'content-type': 'application/json' } })).status, 403);
    assert.equal((await fetch(`${base}/api/dictionary/cambridge`)).status, 400);
    assert.equal((await fetch(`${base}/api/dictionary/audio?word=${'a'.repeat(161)}`)).status, 400);
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('Vercel entries preserve query parameters without opening a listening socket on import', async () => {
  const server = createServer((req, res) => {
    const handler = req.url?.startsWith('/dictionary') ? dictionaryHandler : artworkHandler;
    void handler(req as never, res as never);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal((await (await fetch(`${base}/platform-normalized-path`)).json()).writable, false);
    const response = await fetch(`${base}/dictionary?word=${'a'.repeat(161)}`);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /160/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
