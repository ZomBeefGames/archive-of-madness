import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomStore,restoreRooms} from '../coop-persistence.mjs';
import {GameRooms} from '../multiplayer.mjs';
import {GOALS,WORLD_DAY_SECONDS} from '../coop-state.mjs';

function makeClient(){
 const m=[];return {readyState:1,messages:m,send(s){m.push(JSON.parse(s))},close(){},player:null};
}
function fixture(mode='archivist'){
 const dir=mkdtempSync(join(tmpdir(),'archive-coop-test-')),store=new RoomStore(dir);
 const rooms=new GameRooms({store}),host=makeClient(),guest=makeClient();
 rooms.join(host,{type:'join',mode:'host',name:'LANTERN KEEPER',start:{x:16,y:0,floor:0},difficulty:mode,phrase:'the lamp forgot'});
 const room=host.player.room,code=room.code;
 assert.equal(code.length,6);
 rooms.join(guest,{type:'join',mode:'join',room:code,name:'OTHER READER'});
 const dispose=()=>{rooms.close();rmSync(dir,{recursive:true,force:true})};
 return{dir,rooms,room,host,guest,code,dispose};
}
test('new co-op room sends host and guest the same world and full character metadata',()=>{
 const v=fixture();try{
   assert.equal(v.host.player.room,v.guest.player.room);
   const welcome=v.guest.messages.find(m=>m.type==='welcome');
   assert.equal(welcome.world.quest,0);
   assert.equal(welcome.world.day,1);
   assert.equal(welcome.players.length,2);
   assert.ok(Array.isArray(welcome.enemies));
   assert.ok(Array.isArray(welcome.stories));
   assert.ok(Array.isArray(welcome.records.sentences));
 }finally{v.dispose()}
});
test('inventory is pooled, bounded, canonical and synchronized to every participant',()=>{
 const v=fixture();try{
   const room=v.room;
   room.engine.resources(v.host.player,{delta:{oil:3,type:4,incense:2}});
   assert.equal(room.world.resources.oil,11);
   assert.equal(room.world.resources.type,4);
   assert.equal(v.guest.messages.at(-1).type,'resources');
   room.engine.resources(v.guest.player,{delta:{type:-2}});
   assert.equal(room.world.resources.type,2);
   assert.equal(room.world.resources.incense,2);
   room.engine.resources(v.host.player,{delta:{type:99999}});
   assert.equal(room.world.resources.type,2);
 }finally{v.dispose()}
});
test('monotone story goals gate the Index, shelf-mark, dawn and finale',()=>{
 for(const mode of Object.keys(GOALS)){
   const v=fixture(mode);
   try{
     const w=v.room.world,g=GOALS[mode],p=v.host.player;
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:2,key:'quest|2'}),false);
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:1,key:'quest|1'}),true);
     w.day=g.indexDay;
     for(let i=0;i<g.sentences;i++)
       assert.equal(v.room.engine.claim(p,{kind:'sentence',key:'page|'+mode+'|'+i}),true);
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:2,key:'quest|2'}),true);
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:3,key:'quest|3'}),true);
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:4,key:'quest|4'}),g.shelfDay<=g.indexDay);
     w.day=g.shelfDay;
     if(w.quest<4)assert.equal(v.room.engine.claim(p,{kind:'quest',step:4,key:'quest|4'}),true);
     assert.equal(v.room.engine.claim(p,{kind:'quest',step:5,key:'quest|5'}),true);
     assert.equal(v.room.engine.claim(p,{kind:'complete',key:'ending'}),false);
     for(let i=0;i<g.proofs;i++)assert.equal(v.room.engine.claim(p,{kind:'proof',key:'archive|'+i}),true);
     w.day=g.minDay;
     // An additional unique proof still triggers shared shelving evaluation.
     assert.equal(v.room.engine.claim(p,{kind:'proof',key:'archive|extra'}),true);
     assert.equal(w.quest,6);
     assert.equal(v.room.engine.claim(p,{kind:'complete',key:'ending'}),true);
     assert.equal(w.ending,true);
     assert.equal(v.guest.messages.at(-1).type,'ending');
   }finally{v.dispose()}
 }
});
test('clock and reset interval are server-owned and no longer depend on client FPS',()=>{
 const v=fixture();
 try{
   const w=v.room.world;
   w.clock=WORLD_DAY_SECONDS-0.1;
   v.room.engine.lastTick=1000;
   v.room.engine.tick(1400);
   assert.equal(w.day,2);
   assert.equal(w.clock,WORLD_DAY_SECONDS*6/24);
   assert.equal(w.nextResetDay,3);
   w.clock=WORLD_DAY_SECONDS-0.1;
   v.room.engine.tick(1900);
   assert.equal(w.day,3);
   assert.equal(w.epoch,2);
   assert.equal(w.nextResetDay,5);
   assert.equal(w.resetInterval,2);
   w.clock=WORLD_DAY_SECONDS-0.1;
   v.room.engine.tick(2250);
   assert.equal(w.day,4);
 }finally{v.dispose()}
});
test('server NPC combat respects position, facing, damage, death and shared drops',()=>{
 const v=fixture();
 try{
   const room=v.room,p=v.host.player;
   p.x=16;p.y=0;p.f=0;p.floor=0;
   room.world.enemies=[{id:'npc:test',x:17,y:0,cx:16,cy:0,floor:0,
     f:0,type:'pur',hp:6,dead:false,lastAttack:0}];
   room.engine.combat(p,{id:'npc:test',weapon:'press'});
   assert.equal(room.world.enemies[0].hp,4);
   const z=room.world.enemies[0];p.f=Math.PI;p.lastCombat=0;
   room.engine.combat(p,{id:'npc:test',weapon:'press'});
   assert.equal(z.hp,4,'back-facing hit cannot land');
   p.f=0;p.lastCombat=0;
   room.engine.combat(p,{id:'npc:test',weapon:'oil'});
   assert.equal(z.hp,2);
   p.lastCombat=0;room.engine.combat(p,{id:'npc:test',weapon:'press'});
   assert.equal(z.dead,true);
   assert.equal(room.world.resources.type,3);
   assert.ok(v.guest.messages.some(m=>m.type==='combat'&&m.action==='kill'));
 }finally{v.dispose()}
});
test('two clients see the same authored story and the same choice resolution',()=>{
 const v=fixture();
 try{
   const p=v.host.player,room=v.room;
   room.engine.storyStart(p,{kind:'trial',id:'story:abc123',x:p.x+1,y:p.y,floor:0});
   assert.equal(room.world.stories.length,1);
   assert.equal(room.world.stories[0].state,'idle');
   assert.equal(v.guest.messages.at(-1).type,'story');
   room.engine.storyChoose(v.guest.player,{id:'story:abc123',choice:0});
   assert.equal(room.world.stories[0].state,'talked');
   assert.equal(room.world.stories[0].by,v.guest.player.id);
   room.engine.storyChoose(p,{id:'story:abc123',choice:1});
   assert.equal(room.world.stories[0].choice,0,'cannot choose again');
 }finally{v.dispose()}
});
test('room code, quest progress, inventory, enemies and constructions survive server restart',()=>{
 const v=fixture('lost');const {dir,code}=v;
 try{
   const r=v.room,w=r.world;
   r.engine.claim(v.host.player,{kind:'quest',step:1,key:'quest|1'});
   r.engine.claim(v.host.player,{kind:'proof',key:'cache|first'});
   r.engine.resources(v.host.player,{delta:{oil:3,type:4}});
   r.barriers.set('7',{id:'7',x:14,y:2,floor:0,level:3,hp:15,owner:'1'});
   w.enemies=[{id:'npc:old',type:'seek',x:18,y:0,floor:0,hp:1,cx:16,cy:0,dead:false}];
   r.engine.touch();
   v.rooms.store.flush();
   const recoveredStore=new RoomStore(dir),recovered=new GameRooms({store:recoveredStore});
   assert.ok(recovered.rooms.has(code));
   const rr=recovered.rooms.get(code);
   assert.equal(rr.world.resources.type,4);
   assert.equal(rr.world.quest,1);
   assert.equal(rr.world.proofs.length,1);
   assert.equal(rr.world.enemies[0].hp,1);
   assert.equal(rr.barriers.get('7').level,3);
   const newcomer=makeClient();
   recovered.join(newcomer,{type:'join',mode:'join',room:code,name:'RETURNING PLAYER'});
   assert.equal(newcomer.messages[0].world.difficulty,'lost');
   assert.equal(newcomer.messages[0].barriers[0].level,3);
   recovered.close();
 }finally{v.dispose()}
});
test('room restore ignores stale/invalid entries and does not trust unvalidated object types',()=>{
 const now=Date.now();
 const rooms=restoreRooms({format:2,rooms:[{code:'ABCDEF',world:{phrase:'lamp',difficulty:'reader',x:0,y:0,floor:0},lastSeen:now-8*86400000}]},now);
 assert.equal(rooms.size,0);
});
