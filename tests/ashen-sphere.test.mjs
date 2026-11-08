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

test('the Kestrel programme and named people are wired in',()=>{
  assert.match(page,/space:\{scoutDv:2800,rescueDv:3200/);
  assert.match(page,/function rocket\(d,ms\)/);
  assert.match(page,/function reconcile\(\)/);
  assert.match(page,/o\.v!==5&&o\.v!==6/);   // v5 saves still load
});

test('rocket maths: the default scout fails, Thud with two large tanks reaches orbit',()=>{
  const cfg=page.match(/parts:\{core:[\s\S]*?thud:\{[^}]*\}\}/)[0];
  const P=new Function('return {'+cfg+'}')().parts,g=9.81;
  const fly=(engine,tanks,extra=[])=>{const list=['core','frame','antenna',...extra,...tanks,engine];let dry=0,fuel=0;
    for(const p of list){dry+=P[p].mass;fuel+=P[p].fuel||0}const m0=dry+fuel;
    return{twr:P[engine].thrust/(m0*g),dv:P[engine].isp*g*Math.log(m0/dry)}};
  const a=fly('thud',['large','large']);assert.ok(a.twr>1.2&&a.dv>=2800);
  const b=fly('thud',['large']);assert.ok(b.dv<2800);
  const c=fly('thud',['large','large','large'],['arm']);assert.ok(c.twr>1.2&&c.dv>=3200);
});
