import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'The real inline game script is required');
const begin=script.indexOf('function gridRows('),end=script.indexOf('/* ---- the Library goes on without you.',begin);
assert.ok(begin>=0&&end>begin,'The production puppet system must be available');
const production=script.slice(begin,end);
function setup(){
  const G={x:0,y:0,ang:0,time:12,pitch:0,oil:8,state:'play',weapon:'press',
    swing:0,hurtCd:0,flash:0,climbT:0,incense:0};
  const palette={k:'#161211',c:'#70502f',y:'#debb4b',Y:'#fceabb',o:'#ff7a29',
    n:'#aaaaaa',t:'#603d23',T:'#ad8155',f:'#eebb21',p:'#160f0c',w:'#ffffff',
    m:'#502122',S:'#a77649',G:'#656560',g:'#444440',r:'#a52516',R:'#792214'};
  const context=vm.createContext({G,PAL:palette,LX:0,LY:0,FOG:[1,1,1,1],AIRLV:3,FH:2.15,
    rgb:x=>Array.isArray(x)?x:[parseInt(x.slice(1,3),16),parseInt(x.slice(3,5),16),parseInt(x.slice(5,7),16)],
    placeOf:()=>({kind:'g'}),
    smooth(p){p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)},
    angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;return d}
  });
  vm.runInContext(production,context,{timeout:10000});
  return{G,run:code=>vm.runInContext(code,context,{timeout:10000})};
}
test('full script and painted puppet source parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(production));
});
test('NPC cards face camera from twelve view bearings while keeping front/rear art',()=>{
  const t=setup();
  const a=t.run("(()=>{const e={type:'pur',x:2,y:0,f:Math.PI};const out=[];for(let k=0;k<12;k++){const av=k*Math.PI/6;G.x=e.x+8*Math.cos(av);G.y=e.y+8*Math.sin(av);const f=faceToward(e.f,e.x,e.y,e);out.push({angle:Math.abs(Math.cos(f-av)),rear:e._rigBack})}return out})()");
  assert.equal(a.length,12);
  for(const q of a)assert.ok(q.angle>.99999,'visible NPC card must not be edge-on');
  assert.ok(a.some(q=>q.rear));
  assert.ok(a.some(q=>!q.rear));
});
test('side-on turning uses hysteresis instead of flickering front/back',()=>{
  const t=setup();
  assert.equal(t.run("(()=>{const e={x:0,y:0,f:0,_rigBack:false};for(const a of[1.56,1.58,1.63]){G.x=Math.cos(a)*10;G.y=Math.sin(a)*10;faceToward(e.f,0,0,e);if(e._rigBack)return false}G.x=Math.cos(2.1)*10;G.y=Math.sin(2.1)*10;faceToward(e.f,0,0,e);return e._rigBack})()"),true);
});
test('Purifier, Seeker and player rigs have finite body parts and joined shoulders',()=>{
  const t=setup();
  const n=t.run("(()=>{const out=[];for(const[e,fn]of[[{type:'pur',x:2,y:0,f:Math.PI,seed:1,hit:0,dead:0,raise:0},purLayers],[{type:'seek',x:2,y:1,f:Math.PI,seed:2,hit:0,dead:0,scared:0,flee:0},seekLayers]]){const v=[];fn(e,v);if(!v.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z0)&&q.hgt>0))throw Error('invalid NPC part');out.push(v.length)}const v=[];meLayers(v);if(!v.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z0)&&q.hgt>0))throw Error('invalid player part');out.push(v.length);return out})()");
  for(const count of n)assert.ok(count>=18);
  for(const rig of ['PURIG','SEEKRIG','MERIG']){
    assert.equal(t.run(rig+'.collar.g.w>0'),true);
    assert.equal(t.run(rig+'.shoulder.g.h>0'),true);
    assert.equal(t.run(rig+'.waist.g.h>0'),true);
  }
});
test('shoe soles stay grounded over wide strides and rotated feet',()=>{
  const t=setup();
  const d=t.run("(()=>{const out=[];for(const[R,a,b,h]of[[PURIG,13,12,28.6],[SEEKRIG,9.5,9,22.5],[MERIG,11.5,11,27.5]])for(const angle of[-15,0,12,36]){const drawn=[],foot=[7,0,angle],hip=settleHip(h,R,a,b,[foot]);legOut((p,t,x,z)=>drawn.push({p,t,x,z}),R,0,hip,foot,.01,a,b,0);const sole=drawn.find(q=>q.p===(R.boot||R.foot));out.push(sole.z-shoeSole(R,angle))}return out})()");
  assert.equal(d.length,12);
  d.forEach((offset,i)=>assert.ok(Math.abs(offset)<.075,'foot '+i+' floats by '+offset));
});
test('weapon grips are aligned with the painted hands beyond the IK wrists',()=>{
  const t=setup();
  const value=t.run("(()=>{const parts=[],R=MERIG;const[gx,gz]=armOut((p,a,x,z)=>parts.push({p,x,z}),R,0,15,7,3,.05,8.5,10.5);const wrist=ik2(0,15,7,3,8.5,10.5,-1);if(parts.length!==2)throw Error('arm missing a segment');return{offset:Math.hypot(gx-wrist[2],gz-wrist[3]),expected:R.fore.gripOffset}})()");
  assert.ok(Math.abs(value.offset-value.expected)<.02);
  assert.match(script,/torsoJoins\(e,put,R,hx,hz,lean,shx,shz,nkx,nkz\)/);
  assert.match(script,/R\.book,-8\+2\*Math\.sin/);
  assert.match(script,/e\._rigFacing\)\*X\*PS/);
});
