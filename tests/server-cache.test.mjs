// The live server: pages and game code are always checked for a newer copy, so a new deploy reaches players at once
// (a browser that kept Ashen Sphere for an hour went on showing the old game after an update). Unchanged pages come back
// as a quick "not changed". The title screen opens Ashen Sphere at an address with a version, past any old saved copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('game pages are always checked for a newer copy, and unchanged ones come back as "not changed"', async () => {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('the server did not start')), 10000);
      srv.stdout.on('data', d => { if (String(d).includes(':' + port)) { clearTimeout(t); res(); } });
      srv.on('exit', c => { clearTimeout(t); rej(new Error('the server stopped: ' + c)); });
    });
    const base = 'http://127.0.0.1:' + port;
    for (const p of ['/', '/ashen-sphere.html?from=archives&v=7']) {
      const r = await fetch(base + p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers.get('cache-control'), 'no-cache', p + ' is always checked for a newer copy');
      const tag = r.headers.get('etag'); assert.ok(tag, p + ' has a version tag');
      await r.arrayBuffer();
      const again = await fetch(base + p, { headers: { 'if-none-match': tag } });
      assert.equal(again.status, 304, p + ' unchanged: not sent again');
    }
    const hidden = await fetch(base + '/server.mjs'); assert.equal(hidden.status, 404, 'server files stay hidden');
  } finally { srv.kill(); }
});

test('the title screen opens Ashen Sphere at an address with a version', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /\{id:'ashen',label:'ASHEN SPHERE',[^}]*v:'\d+',external:'ashen-sphere\.html'\}/);
  assert.match(index, /location\.href=game\.external\+'\?from=archives'\+\(game\.v\?'&v='\+game\.v:''\)/);
});
