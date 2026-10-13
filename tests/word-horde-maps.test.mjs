import assert from 'node:assert/strict';
import test from 'node:test';
import {WebSocket} from 'ws';
import {GameRooms} from '../multiplayer.mjs';
import {MODE_MAPS,modeInside,modeSite,modeSpawn,modeTheme} from '../mode-maps.mjs';
import {WORD_BOOKS,WORD_BOOK_BY_ID,WORD_UPGRADE_PRICE,newBookInventory,
  allowedWordHit} from '../word-books.mjs';
import {hordeBookStations,modeStations} from '../special-modes.mjs';

const mock=()=>({readyState:WebSocket.OPEN,messages:[],send(s){this.messages.push(JSON.parse(s))},close(){}});
const post=(rooms,ws,data)=>rooms.message(ws,Buffer.from(JSON.stringify(data)));
function lobby(gameMode='horde'){
 const rooms=new GameRooms(),host=mock();
 post(rooms,host,{type:'join',mode:'host',name:'READER',phrase:'a book of last words',
  difficulty:'reader',gameMode,start:{x:5,y:0,floor:0}});
 const code=host.messages[0].code,room=rooms.rooms.get(code);
 return{rooms,room,host,p:host.player};
}
test('original Story, separate traitor annex and zombie depot never share starts',()=>{
 const h=modeSpawn('horde'),i=modeSpawn('impostor');
 assert.ok(h.x<0&&i.x>0);
 assert.ok(Math.abs(h.x-i.x)>2000);
 assert.equal(modeSpawn('story'),null);
 for(const type of ['horde','impostor']){
   const m=MODE_MAPS[type],p=modeSpawn(type);
   assert.equal(p.floor,m.floor);
   assert.equal(modeInside(type,p),true);
   assert.equal(modeInside(type,{x:0,y:0,floor:0}),false);
   assert.equal(modeInside(type,{...p,floor:10}),false);
   const themes=new Set();
   for(let x=m.i-m.radius;x<=m.i+m.radius;x++)
     for(let y=m.j-m.radius;y<=m.j+m.radius;y++)themes.add(modeTheme(type,x,y));
   assert.ok(themes.size>=4,'dedicated map offers varied playable rooms');
   const {room,host}=lobby(type);
   assert.deepEqual({x:room.world.x,y:room.world.y,floor:room.world.floor},p);
   assert.equal(room.world.gameMode,type);
   assert.equal(host.messages[0].world.x,p.x);
 }
});
test('task and book shops occupy distinct rooms and do not reveal hidden player roles',()=>{
 const {room}=lobby('impostor');
 const stations=modeStations(room.world),books=hordeBookStations();
 assert.equal(stations.length,6);assert.equal(books.length,6);
 assert.equal(new Set(stations.map(s=>s.i+','+s.j)).size,6);
 assert.equal(new Set(books.map(s=>s.i+','+s.j)).size,6);
 assert.ok(stations.every(s=>s.floor===MODE_MAPS.impostor.floor));
 assert.ok(books.every(b=>b.floor===MODE_MAPS.horde.floor));
 assert.ok(books.every(b=>b.price===WORD_BOOK_BY_ID[b.book].price));
 assert.ok(!JSON.stringify(room.modes.public()).includes('traitor'));
});
test('six real authored manuscripts have progressively stronger and distinctive ballistics',()=>{
 assert.equal(WORD_BOOKS.length,6);
 assert.equal(new Set(WORD_BOOKS.map(b=>b.id)).size,6);
 assert.ok(WORD_BOOK_BY_ID.last.damage>WORD_BOOK_BY_ID.primer.damage*6);
 assert.ok(WORD_BOOK_BY_ID.choir.cadence<WORD_BOOK_BY_ID.primer.cadence);
 assert.ok(WORD_BOOK_BY_ID.atlas.pierce>WORD_BOOK_BY_ID.primer.pierce);
 for(const b of WORD_BOOKS){
   assert.ok(b.mag>0&&b.reserve>0&&b.range>=12);
   assert.ok(b.words.length>=4);
   assert.ok(b.words.every(w=>/^[A-Z ]+$/.test(w)));
 }
 const inv=newBookInventory();
 assert.deepEqual(inv.owned,['primer']);
 assert.equal(inv.clips.primer,WORD_BOOK_BY_ID.primer.mag);
});
test('server-authoritative word shot spends pages, awards points and ignores client hit claims',()=>{
 const {rooms,room,host,p}=lobby('horde');
 post(rooms,host,{type:'mode-action',action:'start'});
 room.modes.tick(room.modes.prepUntil+1);
 assert.equal(room.modes.phase,'wave');
 const z=room.world.enemies[0];
 p.x=z.x-1.15;p.y=z.y;p.f=0;p.floor=0;p.active=true;
 const inv=room.modes.bookInventory(p),clip=inv.clips.primer;
 assert.equal(allowedWordHit(p,z,WORD_BOOK_BY_ID.primer),true);
 const t=Date.now();
 room.modes.hordeAction(p,{action:'shoot',targetId:'made-up-target',damage:999999},t);
 assert.equal(inv.clips.primer,clip-1);
 assert.equal(inv.shots,1);
 assert.ok(z.hp<3+Math.floor((room.modes.wave-1)/2)+4);
 assert.ok(inv.hits>=1);
 const shot=host.messages.filter(m=>m.type==='word-shot').at(-1);
 assert.ok(shot);
 assert.equal(shot.book,'primer');assert.equal(shot.word,'NO');
 assert.ok(shot.targets.includes(z.id));
 room.modes.hordeAction(p,{action:'shoot'},t+30);
 assert.equal(inv.shots,1,'cadence blocks implausibly rapid bursts');
 room.modes.hordeAction(p,{action:'shoot'},t+350);
 assert.equal(inv.shots,2);
 assert.equal(inv.clips.primer,clip-2);
});
test('server validates physical shops, ammo purchases and the rewrite station',()=>{
 const {rooms,room,host,p}=lobby('horde');
 post(rooms,host,{type:'mode-action',action:'start'});
 const inv=room.modes.bookInventory(p),index=WORD_BOOK_BY_ID.index;
 inv.points=3000;
 room.modes.hordeAction(p,{action:'buy-book',book:'last'});
 assert.ok(!inv.owned.includes('last'),'remote purchasing is impossible');
 const s=modeSite('horde',1);p.x=s.x;p.y=s.y;p.active=true;p.floor=s.floor;
 room.modes.hordeAction(p,{action:'buy-book',book:'index'});
 assert.ok(inv.owned.includes('index'));
 assert.equal(inv.equipped,'index');
 assert.equal(inv.clips.index,index.mag);
 const points=inv.points;
 room.modes.hordeAction(p,{action:'buy-book',book:'index'});
 assert.equal(inv.points,points-Math.max(120,Math.round(index.price*.20)));
 assert.ok(inv.reserves.index>index.reserve);
 inv.clips.index=0;inv.reloadUntil=0;
 room.modes.hordeAction(p,{action:'reload-book'},10000);
 assert.equal(inv.reloadUntil,10000+index.reload);
 room.modes.bookReloadComplete(p,10000+index.reload+1);
 assert.equal(inv.clips.index,index.mag);
 const before=inv.points;
 room.modes.hordeAction(p,{action:'upgrade-book'});
 assert.equal(inv.upgrade,0,'upgrade is possible only at the central rewrite press');
 const center=modeSite('horde',0);p.x=center.x;p.y=center.y;
 inv.points=Math.max(before,WORD_UPGRADE_PRICE+1);
 room.modes.hordeAction(p,{action:'upgrade-book'});
 assert.equal(inv.upgrade,1);
 assert.ok(host.messages.some(m=>m.type==='mode-private'&&m.books?.upgrade===1));
});
test('separate arena boundaries reject teleporting clients, not ordinary local motion',()=>{
 const {rooms,host,p}=lobby('horde'),start={x:p.x,y:p.y,floor:p.floor};
 post(rooms,host,{type:'pose',x:0,y:0,floor:0,f:0,pose:'run',active:true});
 assert.deepEqual({x:p.x,y:p.y,floor:p.floor},start);
 post(rooms,host,{type:'pose',x:p.x+.25,y:p.y,floor:0,f:0,pose:'run',active:true});
 assert.ok(p.x>start.x);
});
