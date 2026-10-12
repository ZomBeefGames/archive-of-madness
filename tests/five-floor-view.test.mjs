import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const script=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const start=script.indexOf('function floorSpriteVisible('),end=script.indexOf('function renderScene(',start);
assert.ok(start>0&&end>start);
function stage({x=6,y=0,ang=0,floor=10}={}){
 const G={x:0,y:0,ang,floor},calls=[];
 const ctx=vm.createContext({G,Math,W:320,H:200,HZ:100,EYE:.5,PROJ:100,PLANE:.577,
   FH:2.15,VISIBLE_FLOORS:2,
   addZoneDressing(out){calls.push(G.floor);out.push({x,y,z0:.1,hgt:.8,floor:G.floor})}
 });
 vm.runInContext(script.slice(start,end),ctx);
 return{G,calls,run:s=>vm.runInContext(s,ctx)};
}
test('five level renderer stages floor -2,-1,0,+1,+2 and restores world floor',()=>{
 const s=stage();
 const detail=s.run('(()=>{const result=[];addFiveFloorDressing(result);return result.map(p=>({floor:p.floor,z:p.z0}))})()');
 assert.equal(detail.length,5);
 assert.deepEqual(s.calls,[8,9,10,11,12]);
 assert.equal(s.G.floor,10);
 assert.deepEqual(detail.map(e=>e.floor),[8,9,10,11,12]);
 for(let i=0;i<detail.length;i++)assert.ok(Math.abs(detail[i].z-(.1+(i-2)*2.15))<1e-8);
});
test('camera culling does not draw other floors behind you or outside field of view',()=>{
 const a=stage({x:6,y:0});
 assert.equal(a.run('floorSpriteVisible({x:6,y:0,z0:4.4,hgt:1})'),true);
 assert.equal(a.run('floorSpriteVisible({x:6,y:0,z0:-4.2,hgt:1})'),true);
 const b=stage({x:-6,y:0});
 assert.equal(b.run('floorSpriteVisible({x:-6,y:0,z0:0,hgt:1})'),false);
 const c=stage({x:6,y:40});
 assert.equal(c.run('floorSpriteVisible({x:6,y:40,z0:0,hgt:1})'),false);
});
test('raycaster samples real per-floor materials while moving or freefalling',()=>{
 assert.match(script,/const MAXLV=7, VISIBLE_FLOORS=2/);
 assert.match(script,/function floorPx\(i,px,py,L,fl=G\.floor\)/);
 assert.match(script,/function catPx\(i,px,py,L,fl=G\.floor\)/);
 assert.match(script,/function gothicFloorZone\(px,py,fl=G\.floor\)/);
 assert.match(script,/G\.floor-k\)/);
 assert.match(script,/G\.floor=position\.floor/);
 assert.match(script,/addFiveFloorDressing\(list\)/);
 assert.match(script,/Math\.abs\(e\.floor-G\.floor\)>VISIBLE_FLOORS/);
 assert.match(script,/Math\.abs\(p\.floor-G\.floor\)<=VISIBLE_FLOORS/);
});
