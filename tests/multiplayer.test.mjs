import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {GameRooms,attachMultiplayer,MAX_PARTY,validCode} from '../multiplayer.mjs';

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
  assert.equal(host.player.planks,4);
  post(rooms,host,{type:'barrier',action:'place',x:host.player.x+1.4,y:0,floor:0});
  const barrier=[...room.barriers.values()][0];
  assert.ok(barrier);
  assert.equal(host.player.planks,3);
  assert.ok(other.messages.some(m=>m.type==='barrier'&&m.action==='upsert'));
  for(let n=1;n<=3;n++){
    post(rooms,host,{type:'barrier',action:'reinforce',id:barrier.id});
    assert.equal(barrier.level,n);
    assert.equal(host.player.planks,3-n);
    assert.equal(barrier.hp,3+n*4);
  }
  const hp=barrier.hp;
  post(rooms,host,{type:'barrier',action:'hit',id:barrier.id});
  assert.equal(barrier.hp,hp,'three reinforcements resist every weapon hit');
  assert.ok(room.barriers.has(barrier.id));
  post(rooms,host,{type:'barrier',action:'take',id:barrier.id});
  assert.equal(host.player.planks,4,'manual retrieval recovers all four invested boards');
  assert.equal(room.barriers.size,0);
  assert.ok(other.messages.some(m=>m.type==='barrier'&&m.action==='remove'));
});
test('ordinary placed barricades can be destroyed; wreckage can be recovered by a different player',()=>{
  const {rooms,host,code,room}=lobby();
  const peer=mock();post(rooms,peer,{type:'join',room:code});
  host.player.planks=1;
  post(rooms,host,{type:'barrier',action:'place',x:5.5,y:0,floor:0});
  const b=[...room.barriers.values()][0];assert.ok(b);
  for(let i=0;i<3;i++)post(rooms,host,{type:'barrier',action:'hit',id:b.id});
  assert.equal(room.barriers.size,0);assert.equal(room.wrecks.size,1);
  const w=[...room.wrecks.values()][0];
  peer.player.x=5.0;peer.player.y=0;
  post(rooms,peer,{type:'barrier',action:'pickup-wreck',id:w.id});
  assert.equal(peer.player.planks,1);
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
  host.player.planks=1;
  post(rooms,host,{type:'barrier',action:'place',x:100,y:0,floor:0,hp:99999,level:3});
  assert.equal(room.barriers.size,0);
  post(rooms,host,{type:'barrier',action:'place',x:5.5,y:0,floor:0,hp:99999,level:3});
  const barrier=[...room.barriers.values()][0];
  assert.equal(barrier.level,0);assert.equal(barrier.hp,3);
});
test('rooms retain barriers while temporarily empty, then expire after idle TTL',()=>{
  const {rooms,room,host,code}=lobby();
  room.broken.add('1|g|0,0|0');
  rooms.leave(host);
  assert.ok(rooms.rooms.has(code));assert.equal(room.members.size,0);
  const joined=mock();post(rooms,joined,{type:'join',room:code});
  assert.ok(joined.messages[0].broken.includes('1|g|0,0|0'));
  rooms.leave(joined);
  rooms.sweep(room.emptyAt+31*60*1000);
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
