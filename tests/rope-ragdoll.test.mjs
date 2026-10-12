import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const start=script.indexOf('/* PHYSICAL PEOPLE INTERACTIONS.');
const finish=script.indexOf('function startle(){',start);
const physics=script.slice(start,finish);
assert.ok(start>=0&&finish>start);

function world(){
 const G={state:'play',journal:false,x:0,y:0,ang:0,floor:0,time:0,personCd:0,
   ents:[{type:'fig',x:2,y:0,f:0,coat:0,pose:'stand',dead:0,hit:0}],
   swing:0,rope:2,hangings:[],hungIds:new Set(),corpseSeq:0};
 const calls=[],data={hole:true,solid:true};
 const ctx=vm.createContext({Math, G, PS:1.35/60,RAILH:.75,RS:1.7,
   P:16,FH:2.15,VISIBLE_FLOORS:2, ENC:{list:[]},
   NET:{ready:false,enemies:new Map(),peers:new Map(),send(v){calls.push(v)}},
   placeOf(x,y){return{kind:'g',cx:0,cy:0}},
   inHoleC(c,x,y){return data.hole&&Math.hypot(x,y)<1.7},
   airFloor(){return data.solid},inWell(){return false},
   galleryBarricadeAt(){return false},placedBlockAt(){return false},
   cast(){return{t:50}},walkable(){return true},worldDead(){return[]},
   recordCorpse(kind,e){e.lootId='impact-1';return{kind,x:e.x,y:e.y,lootId:e.lootId}},
   snd(){},sfx(){},sound(){},console
 });
 vm.runInContext(physics,ctx);
 return{G,ctx,run:v=>vm.runInContext(v,ctx),data,calls};
}
test('14 joint ragdoll preserves bone lengths and takes independent limb impulses',()=>{
 const w=world(),e=w.G.ents[0];
 w.run("activateRagdoll(G.ents[0],'air',4,1)");
 assert.equal(e.rag.points.length,14);
 const start=e.rag.points.map(q=>[q.x,q.z]);
 w.run("stepRagdoll(G.ents[0],.033)");
 assert.ok(e.rag.points.some((p,i)=>Math.abs(p.x-start[i][0])+Math.abs(p.z-start[i][1])>.05));
 for(const b of e.rag.bones){
   const a=e.rag.points[b.a],c=e.rag.points[b.b];
   assert.ok(Math.abs(Math.hypot(a.x-c.x,a.z-c.z)-b.len)<1.3);
 }
});
test('ragdoll neck remains pinned to a valid fixture while rope swings',()=>{
 const w=world(),e=w.G.ents[0];
 assert.ok(w.run('ropeTarget()'),'must detect eligible person near real shaft railing');
 assert.equal(w.run('ropeAction()'),true);
 assert.equal(w.G.rope,1);assert.equal(e.suspended,true);
 assert.equal(e.rag.mode,'hang');assert.equal(w.G.hangings.length,1);
 w.run('tickHangings(.04)');
 assert.equal(e.rag.points[2].x,e.rag.pin.x);
 assert.equal(e.rag.points[2].z,e.rag.pin.z);
 assert.equal(w.run('ropeAction()'),true);
 assert.equal(e.suspended,false);assert.equal(w.G.rope,2);
 assert.ok(e.fallState);assert.equal(w.G.hangings.length,0);
});
test('released person dies only on collision with a real floor, not in open shaft',()=>{
 const w=world(),e=w.G.ents[0];
 w.run('beginPersonFall(G.ents[0],0,0)');
 e.x=0;e.y=0;
 w.run('tickPersonShove(G.ents[0],.24)');
 assert.ok(e.fallState,'the open central shaft must not catch a falling person');
 e.x=2.4;e.y=0;
 for(let i=0;i<15&&e.fallState;i++)w.run('tickPersonShove(G.ents[0],.07)');
 assert.equal(e.fallState,null);
 assert.equal(e.pose,'dead');assert.equal(e.lootId,'impact-1');
 assert.equal(e.rag.mode,'corpse');
 assert.ok(e.rag.ground,'joint solver settles the body on the floor');
});
test('a thrown person does not die when there is no deck beneath them',()=>{
 const w=world(),e=w.G.ents[0];e.x=0;e.y=0;
 w.run('beginPersonFall(G.ents[0],0,0)');
 for(let i=0;i<25;i++)w.run('tickPersonShove(G.ents[0],.06)');
 assert.ok(e.fallState||e.gone);
 assert.ok(!e.lootId,'no invisible floor exists inside the shaft');
});
test('PC keys and title shortcuts cover visible gameplay buttons and modal actions',()=>{
 assert.match(script,/KeyH:'rope'/);
 assert.match(script,/KeyK:'keyguide'/);
 for(const key of ['KeyG','KeyP','KeyO','KeyB','KeyJ','Tab','Space','KeyE','Enter'])
   assert.match(script,new RegExp('\\b'+key+":'"));
 assert.match(script,/Digit1:'begin',Digit2:'character',Digit3:'party'/);
 assert.match(script,/Digit4:'difficulty',Digit5:'help',Digit6:'sound'/);
 assert.match(script,/function drawDesktopKeyGuide\(\)/);
 assert.match(script,/if\(G.keyGuide&&FINE&&G.state==='play'\)drawDesktopKeyGuide\(\)/);
});
