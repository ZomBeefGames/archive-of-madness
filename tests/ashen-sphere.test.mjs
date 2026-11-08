import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const index=await readFile(new URL('index.html',root),'utf8');
const page=await readFile(new URL('ashen-sphere.html',root),'utf8');

test('Ashen Sphere is a selectable game on the title screen',()=>{
  assert.match(index,/\{id:'ashen',label:'ASHEN SPHERE',[^}]*external:'ashen-sphere\.html'\}/);
  assert.match(index,/if\(FILM\.gameMode==='ashen'\)\{ashenLaunch\(\);return\}/);
});

test('Ashen Sphere never becomes a Library MODE type',()=>{
  assert.match(index,/GAME_TYPES\.some\(t=>t\.id===type&&!t\.external\)\?type:'story'/);
});

test('Ashen Sphere is solo only',()=>{
  assert.match(index,/FILM\.gameMode==='ashen'\)\{\s*FILM\.partyMode='solo'/);
});

test('the page has its own splash screen and a way back to the Archives',()=>{
  assert.match(page,/<title>Ashen Sphere<\/title>/);
  assert.match(page,/id="splash"/);
  assert.match(page,/id="begin"/);
  assert.match(page,/id="to-archives" href="index\.html" hidden/);
  assert.match(page,/get\("from"\)==="archives"/);
});

test('the page script parses',()=>{
  const m=page.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m,'inline script present');
  assert.doesNotThrow(()=>new Function(m[1]));
});

test('the planet is a Goldberg hex sphere: 642 tiles, 12 pentagons',()=>{
  // Pull the geometry builder out of the page and run it on its own.
  const src=page.match(/const norm=[\s\S]*?const P=buildPlanet\(FREQ\)/)[0];
  const P=new Function(src.replace(/const reduced=matchMedia[^;]*;/,'')+';return P')();
  assert.equal(P.tiles.length,642);
  assert.equal(P.tiles.filter(t=>t.pent).length,12);
  for(const t of P.tiles)assert.equal(t.n.length,t.pent?5:6);
});
