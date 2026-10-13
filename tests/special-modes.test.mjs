import assert from 'node:assert/strict';
import test from 'node:test';
import {WebSocket} from 'ws';
import {GameRooms} from '../multiplayer.mjs';
import {GAME_MODES,modeStations,HORDE_FINAL_WAVE,validModeVictim} from '../special-modes.mjs';

const mock=()=>({readyState:WebSocket.OPEN,messages:[],send(text){this.messages.push(JSON.parse(text))},close(){}});
const post=(rooms,ws,msg)=>rooms.message(ws,Buffer.from(JSON.stringify(msg)));
function lobby(gameMode='story',count=1){
 const rooms=new GameRooms(),ws=[mock()];
 post(rooms,ws[0],{type:'join',mode:'host',name:'HOST',phrase:'the page that lies',
   difficulty:'reader',gameMode,start:{x:0,y:2.6,floor:0}});
 const code=ws[0].messages[0].code;
 for(let i=1;i<count;i++){
   ws.push(mock());post(rooms,ws[i],{type:'join',room:code,name:'Reader '+i});
 }
 return{rooms,ws,room:rooms.rooms.get(code),code,players:ws.map(w=>w.player)};
}
const messages=(ws,type)=>ws.messages.filter(m=>m.type===type);
const play=(rooms,ws,action,extra={})=>post(rooms,ws,{type:'mode-action',action,...extra});
function forceAt(p,point,f=0){
 p.x=point.x;p.y=point.y;p.floor=point.floor;p.f=f;p.active=true;
}

test('three game modes are explicit; older saved lobbies remain Story by default',()=>{
 assert.deepEqual(GAME_MODES,['story','impostor','horde']);
 const {room,ws,rooms}=lobby();
 assert.equal(room.world.gameMode,'story');
 assert.equal(ws[0].messages[0].world.gameMode,'story');
 play(rooms,ws[0],'start'); // no effect on Story
 assert.equal(room.modes.type,'story');
});
test('the impostor lobby requires 3 readers and sends exactly one private traitor assignment',()=>{
 const {rooms,room,ws,players}=lobby('impostor',3);
 assert.equal(room.modes.phase,'lobby');
 assert.equal(ws[0].messages[0].game.type,'impostor');
 play(rooms,ws[1],'start');
 assert.equal(room.modes.phase,'lobby','guest cannot start');
 play(rooms,ws[0],'start');
 assert.equal(room.modes.phase,'playing');
 const assignments=players.map(p=>room.modes.roles.get(p.id));
 assert.equal(assignments.filter(r=>r==='traitor').length,1);
 assert.equal(assignments.filter(r=>r==='crew').length,2);
 for(const client of ws){
   const mine=messages(client,'mode-private').at(-1);
   assert.equal(mine.role,room.modes.roles.get(client.player.id));
   const publicJson=JSON.stringify(messages(client,'mode-state').at(-1));
   assert.doesNotMatch(publicJson,/"role":"traitor"/);
   assert.doesNotMatch(JSON.stringify(client.messages[0]),/"role":"traitor"/);
 }
 const publicState=room.modes.public();
 assert.equal(publicState.required,6);
 assert.equal(publicState.done,0);
 assert.equal(publicState.stations.length,6);
});
test('server rejects unassigned tasks; crew tasks complete only near physical stations',()=>{
 const {rooms,room,ws}=lobby('impostor',4);
 play(rooms,ws[0],'start');
 const crew=ws.find(w=>room.modes.roles.get(w.player.id)==='crew');
 const traitor=ws.find(w=>room.modes.roles.get(w.player.id)==='traitor');
 const task=room.modes.tasks.get(crew.player.id)[0],
   station=room.modes.station.find(s=>s.id===task);
 play(rooms,crew,'task',{stationId:task});
 assert.equal(room.modes.public().done,0,'remote tasks rejected');
 forceAt(crew.player,station);
 play(rooms,crew,'task',{stationId:task});
 assert.equal(room.modes.public().done,1);
 play(rooms,crew,'task',{stationId:task});
 assert.equal(room.modes.public().done,1,'duplicates ignored');
 forceAt(traitor.player,station);
 play(rooms,traitor,'task',{stationId:task});
 assert.equal(room.modes.public().done,1,'the traitor cannot impersonate a crew task');
});
test('sabotage, reports, voting and exile are validated and finish the round',()=>{
 const {rooms,room,ws}=lobby('impostor',4);
 play(rooms,ws[0],'start');
 const impostor=ws.find(w=>room.modes.roles.get(w.player.id)==='traitor');
 const crew=ws.filter(w=>room.modes.roles.get(w.player.id)==='crew');
 play(rooms,impostor,'sabotage',{kind:'lights'});
 assert.equal(room.modes.sabotage,'lights');
 const repair=room.modes.station[1];
 forceAt(crew[0].player,repair);
 play(rooms,crew[0],'repair');
 assert.equal(room.modes.sabotage,null);
 const victim=crew[1].player;
 forceAt(impostor.player,{x:0,y:2.6,floor:0},0);
 forceAt(victim,{x:1,y:2.6,floor:0},0);
 assert.equal(validModeVictim(impostor.player,victim),true);
 play(rooms,impostor,'kill',{targetId:victim.id});
 assert.equal(room.modes.alive.get(victim.id),false);
 assert.equal(room.modes.bodies.length,1);
 assert.equal(room.modes.phase,'playing','four-player round survives one kill');
 const reporter=crew[0].player;
 forceAt(reporter,room.modes.bodies[0]);
 play(rooms,crew[0],'report');
 assert.equal(room.modes.phase,'meeting');
 assert.equal(room.modes.bodies.length,0);
 const voters=ws.filter(w=>room.modes.alive.get(w.player.id)!==false);
 for(const w of voters)play(rooms,w,'vote',{targetId:impostor.player.id});
 assert.equal(room.modes.phase,'over');
 assert.equal(room.modes.winner,'crew');
 assert.ok(messages(impostor,'mode-impact').some(m=>m.kind==='meeting-result'));
});
test('horde spawns increasing waves, server damage can down survivors, and revives cost boards',()=>{
 const {rooms,room,ws,players}=lobby('horde',2);
 play(rooms,ws[0],'start');
 assert.equal(room.modes.phase,'preparing');
 assert.ok(room.world.resources.boards>=8);
 room.modes.tick(room.modes.prepUntil+1);
 assert.equal(room.modes.phase,'wave');
 assert.equal(room.modes.wave,1);
 assert.equal(room.world.enemies.filter(e=>e.type==='zombie').length,11);
 const hp=room.modes.hordeDamage(players[1],1000);
 assert.equal(hp,0);
 assert.equal(room.modes.alive.get(players[1].id),false);
 forceAt(players[0],{x:4,y:0,floor:0});
 forceAt(players[1],{x:4.5,y:0,floor:0});
 const boards=room.world.resources.boards;
 play(rooms,ws[0],'revive',{targetId:players[1].id});
 assert.equal(room.modes.alive.get(players[1].id),true);
 assert.equal(room.modes.health.get(players[1].id),45);
 assert.equal(room.world.resources.boards,boards-2);
 for(const z of room.world.enemies)z.dead=true;
 room.modes.tick(room.modes.lastWave+10);
 assert.equal(room.modes.phase,'preparing');
 assert.equal(room.modes.wave,1);
 const next=room.modes.prepUntil+1;
 room.modes.tick(next);
 assert.equal(room.modes.wave,2);
 assert.ok(room.world.enemies.filter(e=>e.type==='zombie'&&!e.dead).length>11);
});
test('horde completes on wave 10 with survivors win, not an infinite phantom wave',()=>{
 const {rooms,room,ws}=lobby('horde',1);
 play(rooms,ws[0],'start');
 let now=room.modes.prepUntil+1;
 for(let wave=1;wave<=HORDE_FINAL_WAVE;wave++){
   room.modes.tick(now);
   assert.equal(room.modes.wave,wave);
   assert.equal(room.modes.phase,'wave');
   for(const e of room.world.enemies)if(e.type==='zombie')e.dead=true;
   room.modes.tick(now+1);
   if(wave<HORDE_FINAL_WAVE){
     assert.equal(room.modes.phase,'preparing');
     now=room.modes.prepUntil+1;
   }
 }
 assert.equal(room.modes.phase,'over');
 assert.equal(room.modes.winner,'survivors');
 assert.equal(room.world.enemies.some(e=>e.type==='zombie'&&!e.dead),false);
});
test('untrusted client game mode selection cannot override an existing lobby',()=>{
 const {rooms,room,code}=lobby('horde',1);
 const guest=mock();
 post(rooms,guest,{type:'join',mode:'join',room:code,gameMode:'impostor'});
 assert.equal(room.world.gameMode,'horde');
 assert.equal(guest.messages[0].world.gameMode,'horde');
});
