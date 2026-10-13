import assert from 'node:assert/strict';
import test from 'node:test';
import {WebSocket} from 'ws';
import {readFileSync} from 'node:fs';
import {GameRooms} from '../multiplayer.mjs';
import {MODE_MAPS,modeSpawn} from '../mode-maps.mjs';
import {
 DEPOT_X,DEPOT_Y,HORDE_DOORS,HORDE_WINDOWS,HORDE_REPAIR_REWARD,
 HORDE_REPAIR_LIMIT,newHordeSiege,availableHordeWindows,
 hordeAccessible,hordeBuyDoor,hordeRepairWindow,hordeDamageWindow,
 hordeResetWindowRepairs
} from '../horde-siege.mjs';
const mock=()=>({readyState:WebSocket.OPEN,messages:[],send(x){this.messages.push(JSON.parse(x))},close(){}});
const post=(rooms,ws,msg)=>rooms.message(ws,Buffer.from(JSON.stringify(msg)));
function lobby(){
 const rooms=new GameRooms(),host=mock();
 post(rooms,host,{type:'join',mode:'host',name:'DEFENDER',
   phrase:'remember the dead',difficulty:'reader',gameMode:'horde',
   start:{x:0,y:0,floor:0}});
 const r=rooms.rooms.get(host.messages[0].code);
 return {rooms,host,room:r,player:host.player};
}
const move=(p,to)=>{p.x=to.x;p.y=to.y;p.floor=0;p.active=true;p.f=0};
test('the special maps are separated and every zombie area has a real enclosing boundary',()=>{
 assert.notEqual(MODE_MAPS.impostor.i,MODE_MAPS.horde.i);
 assert.ok(Math.abs(modeSpawn('impostor').x-modeSpawn('horde').x)>1500);
 assert.equal(HORDE_DOORS.length,4);
 assert.equal(HORDE_WINDOWS.length,8);
 assert.equal(HORDE_WINDOWS.filter(w=>!w.requires).length,2);
 const s=newHordeSiege();
 assert.equal(hordeAccessible(DEPOT_X,DEPOT_Y,s.doors),true);
 assert.equal(hordeAccessible(DEPOT_X+7,DEPOT_Y,s.doors),false);
 assert.equal(hordeAccessible(DEPOT_X-7,DEPOT_Y,s.doors),false);
 assert.equal(hordeAccessible(DEPOT_X+6,DEPOT_Y-7,s.doors),false);
 assert.equal(hordeAccessible(DEPOT_X+6,DEPOT_Y+7,s.doors),false);
 assert.equal(availableHordeWindows(s).length,2);
 assert.ok(HORDE_DOORS.every(d=>d.cost>0));
});
test('purchasing new wings spends verse points only when physically at a gate',()=>{
 const s=newHordeSiege(),player={x:DEPOT_X,y:DEPOT_Y,active:true,
   floor:0,falling:false},inv={points:3000};
 assert.equal(hordeBuyDoor(s,player,inv,'north'),false,'north needs east opened first');
 assert.equal(hordeBuyDoor(s,player,inv,'east'),false,'remote purchases rejected');
 move(player,{x:DEPOT_X+5.45,y:DEPOT_Y});
 const before=inv.points;
 assert.equal(hordeBuyDoor(s,player,inv,'east'),true);
 assert.equal(inv.points,before-450);
 assert.equal(s.doors.east,true);
 assert.equal(hordeAccessible(DEPOT_X+7,DEPOT_Y,s.doors),true);
 assert.equal(availableHordeWindows(s).length,3);
 assert.equal(hordeBuyDoor(s,player,inv,'east'),false,'already unlocked');
 assert.equal(inv.points,before-450,'repeat attempts must not charge again');
 move(player,{x:DEPOT_X+8,y:DEPOT_Y-5.5});
 assert.equal(hordeBuyDoor(s,player,inv,'north'),true);
 assert.equal(s.doors.north,true);
 assert.equal(hordeAccessible(DEPOT_X+8,DEPOT_Y-8,s.doors),true);
 assert.equal(availableHordeWindows(s).length,5);
});
test('windows resist outside attacks, repair for capped points and reset quotas next wave',()=>{
 const s=newHordeSiege(),window=HORDE_WINDOWS[0],
   player={x:window.x-.75,y:window.y,floor:0,active:true,lastHordeRepair:0},
   inv={points:100};
 assert.equal(hordeDamageWindow(s,window.id,2),true);
 assert.equal(s.windows[window.id].hp,4);
 assert.equal(hordeRepairWindow(s,player,inv,window.id,800),true);
 assert.equal(s.windows[window.id].hp,5);
 assert.equal(inv.points,100+HORDE_REPAIR_REWARD);
 assert.equal(hordeRepairWindow(s,player,inv,window.id,900),false,'repair cooldown');
 for(let i=0;i<6;i++){
   hordeDamageWindow(s,window.id,2);
   hordeRepairWindow(s,player,inv,window.id,1800+i*1200);
 }
 assert.equal(s.windows[window.id].repairs,HORDE_REPAIR_LIMIT);
 const points=inv.points;
 hordeDamageWindow(s,window.id,2);
 assert.equal(hordeRepairWindow(s,player,inv,window.id,15000),false);
 assert.equal(inv.points,points,'no infinite points from rebuilding one window');
 hordeResetWindowRepairs(s);
 assert.equal(s.windows[window.id].repairs,0);
 assert.equal(hordeRepairWindow(s,player,inv,window.id,16000),true);
 assert.equal(hordeDamageWindow(s,'fabricated',1),false);
});
test('server rejects walking into locked sectors, then accepts the sector after purchasing',()=>{
 const {rooms,room,host,player:p}=lobby(),start={x:p.x,y:p.y};
 const blocked={type:'pose',x:DEPOT_X+7.3,y:DEPOT_Y,
  floor:0,f:0,pose:'stand',active:true};
 p.lastPose=0;post(rooms,host,blocked);
 assert.deepEqual([p.x,p.y],[start.x,start.y]);
 const inv=room.modes.bookInventory(p);inv.points=800;
 move(p,{x:DEPOT_X+5.6,y:DEPOT_Y});
 post(rooms,host,{type:'mode-action',action:'start'});
 // Start reinitializes weapon inventory; refill only within this test.
 room.modes.bookInventory(p).points=800;
 post(rooms,host,{type:'mode-action',action:'buy-door',door:'east'});
 assert.equal(room.modes.siege.doors.east,true);
 p.lastPose=0;post(rooms,host,blocked);
 assert.equal(p.x,blocked.x);
 assert.equal(room.modes.bookInventory(p).points,350);
 const last=host.messages.filter(m=>m.type==='mode-state').at(-1);
 assert.equal(last.mode.siege.doors.east,true);
});
test('server spawns zombies outside boarded entrances, damages boards then admits them',()=>{
 const {room,rooms,host,player}=lobby();
 post(rooms,host,{type:'mode-action',action:'start'});
 room.modes.tick(room.modes.prepUntil+1);
 const z=room.world.enemies.find(e=>e.type==='zombie'),
   window=HORDE_WINDOWS.find(w=>w.id===z.windowId),
   boards=room.modes.siege.windows[window.id];
 assert.ok(z.outside);
 assert.equal(boards.hp,6);
 assert.ok((z.x-window.x)*window.side>0,'outside really means the exterior side');
 z.x=window.x+window.side*.73;z.y=window.y;z.lastAttack=0;
 room.engine.lastTick=Date.now()-300;
 room.engine.tick(Date.now());
 assert.ok(boards.hp<6,'zombies must chew through real shared window health');
 assert.equal(z.outside,true);
 boards.hp=0;
 room.engine.lastTick=Date.now()-300;
 room.engine.tick(Date.now());
 assert.equal(z.outside,false,'the opening admits the zombie after breach');
 assert.ok((z.x-window.x)*window.side<0,'zombie crossed to the interior');
 assert.ok(host.messages.some(m=>m.type==='mode-state'&&m.mode.siege.windows[window.id].hp<6));
});
test('repairs and door purchases are server-authoritative and synchronized',()=>{
 const {rooms,room,host,player}=lobby();
 post(rooms,host,{type:'mode-action',action:'start'});
 room.modes.siege.windows['central-east'].hp=2;
 const win=HORDE_WINDOWS[0];
 move(player,{x:win.x-.6,y:win.y});
 const inv=room.modes.bookInventory(player),prior=inv.points;
 post(rooms,host,{type:'mode-action',action:'repair-window',window:win.id});
 assert.equal(room.modes.siege.windows[win.id].hp,3);
 assert.equal(inv.points,prior+HORDE_REPAIR_REWARD);
 const recent=host.messages.filter(m=>m.type==='mode-private').at(-1);
 assert.equal(recent.books.points,inv.points);
 assert.ok(host.messages.some(m=>m.type==='mode-state'&&
   m.mode.siege.windows[win.id].hp===3));
 const current=inv.points;
 move(player,{x:DEPOT_X,y:DEPOT_Y});
 post(rooms,host,{type:'mode-action',action:'buy-door',door:'east'});
 assert.equal(inv.points,current,'purchase cannot happen at a distance');
});
test('client renders map-closing walls, windows and gates with dedicated shooter controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/modeSiegeDoorArt/);
 assert.match(html,/HIT\.type='ext';HIT\.u=/);
 assert.match(html,/hordeWingAccess\(x,y,MODE\.siege\?\.doors,rad\)/);
 assert.match(html,/HORDE_WINDOWS[\s\S]*HORDE_REPAIR_REWARD/);
 assert.match(html,/const window=this\.nearestHordeWindow\(true\)/);
 assert.match(html,/this\.send\('repair-window'/);
 assert.match(html,/this\.send\('buy-door'/);
 assert.match(html,/if\(!ev\.repeat&&c==='KeyB'\)\{MODE\.siegeRepair/);
 assert.match(html,/if\(!ev\.repeat&&c==='KeyL'\)\{MODE\.siegeBuyDoor/);
});
