import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const start=script.indexOf('function railCol(x,t,a){');
const end=script.indexOf('function frameCol(',start);
assert.ok(start>0&&end>start);
const rail=script.slice(start,end);

function projection(depth=Infinity){
 const W=64,H=440,HZ=220,EYE=.5,PROJ=100,FH=2.15,
   RAILH=.76,VISIBLE_FLOORS=2,RAIL_OCCLUSION_SLOTS=24;
 const RT=new Float32Array(W*RAIL_OCCLUSION_SLOTS),
   RY0=new Float32Array(W*RAIL_OCCLUSION_SLOTS),
   RY1=new Float32Array(W*RAIL_OCCLUSION_SLOTS),
   NR=new Uint8Array(W),DEP=new Float32Array(W*H).fill(depth),
   painted=[];
 const ctx=vm.createContext({
  W,H,HZ,EYE,PROJ,FH,RAILH,VISIBLE_FLOORS,RAIL_OCCLUSION_SLOTS,
  RT,RY0,RY1,NR,DEP,FOG:[1,.85,.7],Math,
  LX:0,LY:0,PX_:7,PY_:0,
  pointAt(){},cellAt(){return{kind:'a'}},
  lightP(){return 1},put(i,r,g,b,L){painted.push({i,r,g,b,L})}
 });
 vm.runInContext(rail,ctx);
 return{ctx,RT,RY0,RY1,NR,painted,draw:()=>vm.runInContext('railCol(0,8,0)',ctx)};
}

test('catwalk rail is actually rasterized at all five floor elevations',()=>{
 const p=projection();
 p.draw();
 assert.equal(p.NR[0],5,'camera must encounter a guardrail at -2,-1,0,+1,+2');
 assert.ok(p.painted.length>20,'each level must write actual image colors');
 const bounds=Array.from({length:p.NR[0]},(_,i)=>({
   top:p.RY0[i],bottom:p.RY1[i]
 }));
 assert.ok(bounds.every(q=>q.bottom>q.top&&Number.isFinite(q.top)));
 assert.ok(bounds[0].top>bounds[4].top,'negative floors project below positive floors');
 const centers=bounds.map(x=>(x.top+x.bottom)*.5);
 for(let k=1;k<centers.length;k++)assert.ok(centers[k-1]-centers[k]>20);
});

test('guardrails obey scene-depth occlusion and do not paint through solid walls',()=>{
 const p=projection(.25);
 p.draw();
 assert.equal(p.NR[0],0);
 assert.equal(p.painted.length,0);
});
test('same real rail and lamp projection runs in gameplay, falling and title scenes',()=>{
 assert.match(script,/for\(let level=-VISIBLE_FLOORS;level<=VISIBLE_FLOORS;level\+\+\)/);
 assert.match(script,/if\(t>DEP\[y\*W\+x\]\+\.075\)continue/);
 assert.match(script,/function lampC\(c,px,py,fl=G.floor\)/);
 assert.match(script,/lampC\(TV.c\[r\],PX_,PY_,G.floor\+\(up\?k:-k\)\)/);
 assert.match(script,/for\(let k=-VISIBLE_FLOORS;k<=VISIBLE_FLOORS;k\+\+\)/);
 assert.match(script,/titleFlyRender\(shot,\{\.\.\.titleScenePose\(shot,u\),local\},elapsed\)/);
 assert.match(script,/renderScene\(\[\]\)/);
});
