import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {GameRooms,attachMultiplayer,MAX_PARTY,validCode,cleanAppearance,validFallRecovery,validPersonShove} from '../multiplayer.mjs';

function mock(){
  return {readyState:WebSocket.OPEN,messages:[],
    send(s){this.messages.push(JSON.parse(s))},
    close(code,reason){this.closed={code,reason}}};
}
function post(rooms,ws,data){
  if(ws.player)ws.player.lastAction=0;
  rooms.message(ws,Buffer.from(JSON.stringify(data)));
  return ws.messages.at(-1);
}
function lobby(){
  const rooms=new GameRooms(),host=mock();
  post(rooms,host,{type:'join',mode:'host',name:'FIRST READER',phrase:'ink remembers everything',
    difficulty:'lost',start:{x:4.0,y:0,floor:0}});
  const room=rooms.rooms.get(host.messages[0].code);
  return {rooms,room,host,code:room.code};
}
test('room codes are safe to paste into invitations and hidden IPs are never exposed',()=>{
  const x=lobby();assert.equal(validCode(x.code),true);assert.equal(x.code.length,6);
  assert.equal(x.host.messages[0].world.difficulty,'lost');
  assert.equal(x.host.messages[0].world.phrase,'ink remembers everything');
  assert.equal(x.host.messages[0].players.length,1);
  assert.ok(!JSON.stringify(x.host.messages[0]).includes('127.0.0.1'));
});
test('up to eight real clients join same room, receive peer updates, and full rooms refuse new joins',()=>{
  const {rooms,room,host,code}=lobby();
  const clients=[host];
  for(let i=1;i<MAX_PARTY;i++){
    const ws=mock();post(rooms,ws,{type:'join',room:code,name:'Reader '+i});
    assert.equal(ws.messages[0].type,'welcome');
    clients.push(ws);
  }
  assert.equal(room.members.size,MAX_PARTY);
  const ninth=mock();post(rooms,ninth,{type:'join',room:code});
  assert.equal(ninth.messages[0].type,'error');
  post(rooms,host,{type:'pose',x:4.6,y:.1,f:1,floor:0,pose:'run'});
  assert.ok(clients[1].messages.some(m=>m.type==='peer'&&m.player.id===host.player.id));
  assert.equal(clients[1].messages.at(-1).player.pose,'run');
  const nobody=mock();post(rooms,nobody,{type:'join',room:'AAAAAA'});
  assert.equal(nobody.messages[0].type,'error');
});
test('four physical salvage sites provide enough boards for 3 server-verified reinforcements',()=>{
  const {rooms,room,host,code}=lobby();
  const other=mock();post(rooms,other,{type:'join',room:code});
  const A=5*Math.cos(Math.PI/6);
  for(let i=0;i<4;i++){
    const x=i*16+A,y=0,key='1|g|'+i+',0|0';
    host.player.x=x-.5;host.player.y=y;
    const info={key,x,y,floor:0};
    post(rooms,host,{type:'barrier',action:'breach',...info});
    post(rooms,host,{type:'barrier',action:'salvage',...info});
    assert.ok(other.messages.some(m=>m.type==='zone'&&m.key===key&&m.salvaged));
    // It cannot be looted repeatedly, even after other players join.
    post(rooms,host,{type:'barrier',action:'salvage',...info});
    assert.equal(host.messages.at(-1).type,'error');
  }
  assert.equal(room.world.resources.boards,4);
  post(rooms,host,{type:'barrier',action:'place',x:host.player.x+1.4,y:0,floor:0});
  const barrier=[...room.barriers.values()][0];
  assert.ok(barrier);
  assert.equal(room.world.resources.boards,3);
  assert.ok(other.messages.some(m=>m.type==='barrier'&&m.action==='upsert'));
  for(let n=1;n<=3;n++){
    post(rooms,host,{type:'barrier',action:'reinforce',id:barrier.id});
    assert.equal(barrier.level,n);
    assert.equal(room.world.resources.boards,3-n);
    assert.equal(barrier.hp,3+n*4);
  }
  const hp=barrier.hp;
  post(rooms,host,{type:'barrier',action:'hit',id:barrier.id});
  assert.equal(barrier.hp,hp,'three reinforcements resist every weapon hit');
  assert.ok(room.barriers.has(barrier.id));
  post(rooms,host,{type:'barrier',action:'take',id:barrier.id});
  assert.equal(room.world.resources.boards,4,'manual retrieval recovers all four invested boards');
  assert.equal(room.barriers.size,0);
  assert.ok(other.messages.some(m=>m.type==='barrier'&&m.action==='remove'));
});
test('ordinary placed barricades can be destroyed; wreckage can be recovered by a different player',()=>{
  const {rooms,host,code,room}=lobby();
  const peer=mock();post(rooms,peer,{type:'join',room:code});
  room.world.resources.boards=1;
  post(rooms,host,{type:'barrier',action:'place',x:5.5,y:0,floor:0});
  const b=[...room.barriers.values()][0];assert.ok(b);
  for(let i=0;i<3;i++)post(rooms,host,{type:'barrier',action:'hit',id:b.id});
  assert.equal(room.barriers.size,0);assert.equal(room.wrecks.size,1);
  const w=[...room.wrecks.values()][0];
  peer.player.x=5.0;peer.player.y=0;
  post(rooms,peer,{type:'barrier',action:'pickup-wreck',id:w.id});
  assert.equal(room.world.resources.boards,1);
  assert.equal(room.wrecks.size,0);
  assert.ok(host.messages.some(m=>m.type==='barrier'&&m.action==='remove-wreck'));
});
test('fake salvage addresses, distant builds, tampered hitpoints and overflow are rejected',()=>{
  const {rooms,room,host}=lobby();
  const before=room.broken.size;
  post(rooms,host,{type:'barrier',action:'breach',key:'1|g|7,0|0',x:4.33,y:0,floor:0});
  assert.equal(room.broken.size,before);
  post(rooms,host,{type:'barrier',action:'breach',key:'1|g|0,0|0',x:4.33,y:10,floor:0});
  assert.equal(room.broken.size,before);
  room.world.resources.boards=1;
  post(rooms,host,{type:'barrier',action:'place',x:100,y:0,floor:0,hp:99999,level:3});
  assert.equal(room.barriers.size,0);
  post(rooms,host,{type:'barrier',action:'place',x:5.5,y:0,floor:0,hp:99999,level:3});
  const barrier=[...room.barriers.values()][0];
  assert.equal(barrier.level,0);assert.equal(barrier.hp,3);
});
test('rooms retain barriers across long disconnects, then expire after a seven-day idle TTL',()=>{
  const {rooms,room,host,code}=lobby();
  room.broken.add('1|g|0,0|0');
  rooms.leave(host);
  assert.ok(rooms.rooms.has(code));assert.equal(room.members.size,0);
  const joined=mock();post(rooms,joined,{type:'join',room:code});
  assert.ok(joined.messages[0].broken.includes('1|g|0,0|0'));
  rooms.leave(joined);
  rooms.sweep(room.lastSeen+8*24*60*60*1000);
  assert.equal(rooms.rooms.has(code),false);
});
test('live WebSocket handshake serves two real clients and one real six-character invite',async()=>{
  const server=createServer((req,res)=>res.end('ok'));
  const attached=attachMultiplayer(server);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='ws://127.0.0.1:'+server.address().port+'/coop';
  const a=new WebSocket(address),b=new WebSocket(address);
  try{
    await Promise.all([once(a,'open'),once(b,'open')]);
    const welcome=once(a,'message');
    a.send(JSON.stringify({type:'join',mode:'host',phrase:'bound by thread',difficulty:'reader',
      start:{x:5,y:3,floor:2}}));
    const [raw]=await welcome,first=JSON.parse(raw.toString());
    assert.equal(first.type,'welcome');
    assert.ok(validCode(first.code));
    const joined=once(b,'message');
    b.send(JSON.stringify({type:'join',mode:'join',room:first.code}));
    const [j]=await joined,second=JSON.parse(j.toString());
    assert.equal(second.type,'welcome');
    assert.equal(second.code,first.code);
    assert.equal(second.world.phrase,'bound by thread');
    assert.equal(second.players.length,2);
  }finally{
    a.close();b.close();
    await Promise.all([once(a,'close'),once(b,'close')]);
    attached.close();await new Promise(resolve=>server.close(resolve));
  }
});

test('shared appearances are bounded to safe palette, presentation and age choices',()=>{
  assert.deepEqual(cleanAppearance({gender:1,age:73,outfit:3,coat:6,pants:5,skin:5,hair:6}),
    {gender:1,age:73,outfit:3,coat:6,pants:5,skin:5,hair:6});
  assert.deepEqual(cleanAppearance({gender:-1,age:350,outfit:999,coat:Infinity,
    pants:2.2,skin:'<script>',hair:29}),{
    gender:0,age:90,outfit:0,coat:0,pants:0,skin:2,hair:1
  });
  assert.deepEqual(cleanAppearance(null),{
    gender:0,age:28,outfit:0,coat:0,pants:0,skin:2,hair:1
  });
});
test('co-op members see each other’s chosen name and appearance in join and pose packets',()=>{
  const {rooms,host,code}=lobby(),guest=mock();
  const appearance={gender:1,age:65,outfit:1,coat:7,pants:2,skin:3,hair:4};
  post(rooms,guest,{type:'join',room:code,name:'MORGAN THE LATE',appearance});
  assert.equal(guest.messages[0].type,'welcome');
  assert.equal(guest.messages[0].players.at(-1).name,'MORGAN THE LATE');
  assert.deepEqual(guest.messages[0].players.at(-1).appearance,appearance);
  const joined=host.messages.find(m=>m.type==='peer-join');
  assert.ok(joined);
  assert.deepEqual(joined.player.appearance,appearance);
  const hostView=post(rooms,guest,{type:'pose',x:4.5,y:.1,f:1,floor:0,pose:'run'});
  const seen=host.messages.find(m=>m.type==='peer'&&m.player.id===guest.player.id);
  assert.ok(seen);
  assert.deepEqual(seen.player.appearance,appearance);
  assert.equal(seen.player.name,'MORGAN THE LATE');
});


test('co-op accepts a legitimate multi-floor fall and nearest-hub dawn recovery, but rejects teleporting',()=>{
 const {rooms,room,host,code}=lobby();
 const other=mock();post(rooms,other,{type:'join',room:code,name:'Witness'});
 const p=host.player;
 const pose=(x,y,floor,extra={})=>{
   p.lastPose=0; // deterministic elapsed-time window for the isolated server test
   return post(rooms,host,{type:'pose',x,y,f:0,floor,pose:'stand',active:false,...extra});
 };
 // Ordinary clients cannot invent remote floors, even with correct coordinates.
 pose(4.2,0,-8,{active:true});
 assert.equal(p.floor,0);
 pose(4.3,0,0,{falling:true,fallDay:1});
 assert.equal(p.falling,true);
 assert.equal(p.fallStart.floor,0);
 for(const floor of [-2,-7,-18])pose(4.3,0,floor,{falling:true,fallDay:1});
 assert.equal(p.floor,-18,'the server follows downward floor crossings');
 assert.ok(other.messages.some(m=>m.type==='peer'&&m.player.floor===-18));
 // Only a verified community position, and only on the next day, may recover.
 pose(8.71,8.71,0,{active:true,respawnHub:true});
 assert.equal(p.floor,-18,'same-day recovery is blocked');
 room.world.day=2;room.world.clock=120;
 pose(230,270,0,{active:true,respawnHub:true});
 assert.equal(p.floor,-18,'unrelated landing cannot be used as a teleport');
 const start={x:4,y:0,floor:0,day:1};
 assert.equal(validFallRecovery(start,{x:8.71,y:8.71,floor:0},room.world),true);
 pose(8.71,8.71,0,{active:true,respawnHub:true});
 assert.equal(p.floor,0);
 assert.equal(p.falling,false);
 assert.equal(p.active,true);
 assert.ok(other.messages.some(m=>m.type==='peer'&&m.player.x===8.71));
 pose(8.71,8.71,180,{active:true});
 assert.equal(p.floor,0,'ordinary teleport protection remains active');
});


test('server checks range, view direction, floor and cooldown for pushing real co-op peers',()=>{
 const {rooms,host,code}=lobby(),guest=mock();
 post(rooms,guest,{type:'join',room:code,name:'ANOTHER READER'});
 const a=host.player,b=guest.player;
 a.x=4;a.y=0;a.f=0;a.floor=0;a.active=true;
 b.x=5.05;b.y=0;b.f=Math.PI;b.floor=0;b.active=true;
 assert.equal(validPersonShove(a,b,'push'),true);
 assert.equal(validPersonShove(a,b,'throw'),true);
 post(rooms,host,{type:'shove',kind:'peer',targetId:b.id,mode:'push'});
 const first=guest.messages.filter(m=>m.type==='shove');
 assert.equal(first.length,1);
 assert.deepEqual({mode:first[0].mode,targetId:first[0].targetId,fromId:first[0].fromId},
   {mode:'push',targetId:b.id,fromId:a.id});
 post(rooms,host,{type:'shove',kind:'peer',targetId:b.id,mode:'push'});
 assert.equal(guest.messages.filter(m=>m.type==='shove').length,1,'cooldown blocks repeated rapid shoves');
 a.lastShove=0;a.f=Math.PI;
 post(rooms,host,{type:'shove',kind:'peer',targetId:b.id,mode:'throw'});
 assert.equal(guest.messages.filter(m=>m.type==='shove').length,1,'turning away invalidates throw');
 a.lastShove=0;a.f=0;b.floor=-1;
 assert.equal(validPersonShove(a,b,'push'),false,'players on different floors are not targets');
 post(rooms,host,{type:'shove',kind:'peer',targetId:b.id,mode:'push'});
 assert.equal(guest.messages.filter(m=>m.type==='shove').length,1);
 b.floor=0;b.active=false;
 assert.equal(validPersonShove(a,b,'push'),false,'inactive readers cannot be shoved');
});
test('server owns enemy shove impulse and advances shared position for all viewers',()=>{
 const {rooms,room,host,code}=lobby(),guest=mock();
 post(rooms,guest,{type:'join',room:code,name:'WITNESS'});
 const p=host.player;
 p.active=true;p.floor=0;p.x=4;p.y=0;p.f=0;
 const e={id:'npc:test:shove',x:5.15,y:0,f:0,floor:0,type:'pur',hp:6,dead:false,
   cx:4,cy:0,lastAttack:Date.now()};
 room.world.enemies.push(e);
 post(rooms,host,{type:'shove',kind:'enemy',targetId:e.id,mode:'throw'});
 assert.equal(e.knock.mode,'throw');
 assert.ok(guest.messages.some(m=>m.type==='shove'&&m.targetId===e.id&&m.kind==='enemy'));
 const x=e.x,now=Date.now();
 room.engine.lastTick=now-95;
 room.engine.tick(now);
 assert.ok(e.x>x,'server advances enemy rather than trusting a client-only animation');
 assert.ok(guest.messages.some(m=>m.type==='enemies'&&m.enemies.some(q=>q.id===e.id&&q.x>x)));
});


test('co-op ropes are server-validated and shared: tie, suspend, cut and refund',()=>{
 const {rooms,room,host,code}=lobby(),guest=mock();
 post(rooms,guest,{type:'join',room:code,name:'SPECTATOR'});
 const p=host.player;p.active=true;p.floor=0;p.x=4;p.y=0;p.f=0;
 const e={id:'npc:test:rope',x:5.75,y:0,f:0,floor:0,type:'pur',hp:6,
   dead:false,cx:4,cy:0,lastAttack:0};
 room.world.enemies.push(e);
 post(rooms,host,{type:'rope',kind:'enemy',targetId:e.id,mode:'tie'});
 assert.equal(e.hanging,true);
 assert.equal(e.hangFloor,0);
 assert.equal(p.rope,1,'one real rope was spent');
 assert.ok(guest.messages.some(m=>m.type==='rope'&&m.targetId===e.id&&m.mode==='tie'));
 assert.ok(guest.messages.some(m=>m.type==='enemies'&&m.enemies.some(q=>q.id===e.id&&q.hanging)));
 // A second rope cannot be attached to the same suspended target.
 p.lastRope=0;
 post(rooms,host,{type:'rope',kind:'enemy',targetId:e.id,mode:'tie'});
 assert.equal(p.rope,1);
 p.lastRope=0;p.f=Math.PI;
 post(rooms,host,{type:'rope',kind:'enemy',targetId:e.id,mode:'untie'});
 assert.equal(e.hanging,true,'turning away prevents untie from afar');
 p.lastRope=0;p.f=0;
 post(rooms,host,{type:'rope',kind:'enemy',targetId:e.id,mode:'untie'});
 assert.equal(e.hanging,false);
 assert.equal(e.dead,true,'released hanging enemy impacts the gallery floor');
 assert.equal(p.rope,2);
 assert.ok(guest.messages.some(m=>m.type==='rope'&&m.targetId===e.id&&m.mode==='untie'));
});
