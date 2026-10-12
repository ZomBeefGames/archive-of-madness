import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const start=script.indexOf('/* PHYSICAL PEOPLE INTERACTIONS.');
const end=script.indexOf('function startle(){',start);
assert.ok(start>0&&end>start);
const source=script.slice(start,end);
function sandbox(){
 const actor={type:'fig',x:1.0,y:0,f:0,pose:'stand',hit:0,dead:0};
 const G={state:'play',journal:false,x:0,y:0,floor:0,ang:0,personCd:0,
   ents:[actor],knockback:null,inRoom:false,cell:{kind:'a'},swing:0};
 const sent=[],events=[],NET={ready:false,enemies:new Map(),peers:new Map(),
   send:x=>sent.push(x)},ENC={list:[]},flags={limit:20,hasDrop:true,drop:false};
 const context=vm.createContext({G,NET,ENC,Math,FH:2.15,RAILH:.34,PS:1.35/60,
   VISIBLE_FLOORS:2,
   cast(){return{t:100}},walkable(x){return x<flags.limit},
   airFloor(x){return !flags.hasDrop||x<flags.limit},
   galleryBarricadeAt(){return false},placedBlockAt(){return false},
   placeOf(){return{kind:'a'}},inHoleC(){return false},
   snd(x){events.push(x)},sfx(x){events.push(x)},
   startRailFreefall(x){flags.drop=x;G.state='freefall'}
 });
 vm.runInContext(source,context);
 return {actor,G,NET,ENC,sent,flags,events,run:code=>vm.runInContext(code,context)};
}
test('push only selects a real nearby person in view and plays a shove',()=>{
 const a=sandbox();
 assert.equal(a.run('personTarget("push").actor.x'),1);
 assert.equal(a.run('initiatePersonShove("push")'),true);
 assert.equal(a.actor.shove.mode,'push');
 a.run('tickPersonShove(G.ents[0],.36)');
 assert.ok(a.actor.x>1);
 assert.equal(a.actor.shove,null);
 assert.ok(a.events.includes('SHOVED!'));
 const b=sandbox();b.G.ang=Math.PI;
 assert.equal(b.run('personTarget("push")'),null);
 b.G.ang=0;b.actor.x=5;
 assert.equal(b.run('initiatePersonShove("throw")'),false);
});
test('throw is stronger and only an actual hole permits the victim to fall',()=>{
 const a=sandbox();
 a.actor.x=1.2;a.flags.limit=2.1;
 assert.equal(a.run('initiatePersonShove("throw")'),true);
 a.run('tickPersonShove(G.ents[0],.28)');
 assert.ok(a.actor.fallState,'throw crossed the open catwalk edge');
 assert.equal(a.actor.pose,'fall');
 a.run('tickPersonShove(G.ents[0],1.5)');
 assert.ok(a.actor.zw<0,'the model falls through levels');
 const b=sandbox();b.flags.limit=2.1;b.flags.hasDrop=false;b.actor.x=1.2;
 b.run('initiatePersonShove("throw")');
 b.run('tickPersonShove(G.ents[0],.28)');
 assert.equal(b.actor.fallState,undefined,'solid walls cannot become a gap');
 assert.equal(b.actor.shove,null);
});
test('multiplayer sends a targeted request instead of moving another player locally',()=>{
 const a=sandbox();a.G.ents=[];
 a.NET.ready=true;
 a.NET.peers.set('2',{id:'2',type:'fig',x:1.2,y:0,floor:0,active:true});
 assert.equal(a.run('initiatePersonShove("push")'),true);
 assert.equal(a.sent.length,1);
 assert.equal(a.sent[0].type,'shove');
 assert.equal(a.sent[0].kind,'peer');
 assert.equal(a.sent[0].targetId,'2');
});
test('knocked player enters authentic endless fall only at a floor edge',()=>{
 const a=sandbox();a.flags.limit=2.1;a.G.x=1.72;
 a.G.knockback={dx:1,dy:0,distance:3.2,duration:.46,t:0};
 a.run('tickPlayerKnockback(.30)');
 assert.equal(a.G.state,'freefall');
 assert.equal(a.flags.drop.kind,'thrown');
 const b=sandbox();b.flags.limit=2.1;b.flags.hasDrop=false;b.G.x=1.72;
 b.G.knockback={dx:1,dy:0,distance:3.2,duration:.46,t:0};
 b.run('tickPlayerKnockback(.30)');
 assert.equal(b.G.state,'play');
 assert.equal(b.flags.drop,false);
});
test('production rendering and inputs include five floors and player push/throw',()=>{
 assert.match(script,/const MAXLV=7, VISIBLE_FLOORS=2/);
 assert.match(script,/for\(let k=-VISIBLE_FLOORS;k<=VISIBLE_FLOORS;k\+\+\)/);
 assert.match(script,/addFiveFloorDressing\(list\)/);
 assert.match(script,/Math\.abs\(p\.floor-G\.floor\)<=VISIBLE_FLOORS/);
 assert.match(script,/if\(\(c==='KeyP'\|\|c==='KeyO'\)/);
 assert.match(script,/PERSON_BUTTONS\[kind\]/);
 assert.doesNotThrow(()=>new vm.Script(script));
});
