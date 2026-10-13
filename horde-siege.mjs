// The Dead Letter Depot's finite, enclosed siege geometry.  These world
// coordinates are shared by the authoritative server and regression tests.
// The client mirrors them in its inline offline-ready renderer.
export const DEPOT_X=-72*16, DEPOT_Y=72*16;
export const HORDE_DOORS=Object.freeze([
  {id:'east',name:'EAST RESERVE',x:DEPOT_X+6.92,y:DEPOT_Y,cost:450,requires:null},
  {id:'west',name:'WESTERN INKWORKS',x:DEPOT_X-6.92,y:DEPOT_Y,cost:650,requires:null},
  {id:'north',name:'NORTHERN SANCTUM',x:DEPOT_X+8,y:DEPOT_Y-6.92,cost:950,requires:'east'},
  {id:'south',name:'SOUTHERN FURNACE',x:DEPOT_X+8,y:DEPOT_Y+6.92,cost:1150,requires:'east'}
]);
const window=(id,name,i,j,side,requires=null)=>Object.freeze({
  id,name,x:(-72+i)*16+side*5*Math.cos(Math.PI/6),
  y:(72+j)*16,side,i:-72+i,j:72+j,requires,maxHp:6
});
export const HORDE_WINDOWS=Object.freeze([
  window('central-east','EASTERN WINDOW',0,0,1),
  window('central-west','WESTERN WINDOW',0,0,-1),
  window('east','EAST RESERVE WINDOW',1,0,1,'east'),
  window('west','INKWORKS WINDOW',-1,0,-1,'west'),
  window('north','SANCTUM WINDOW',0,-1,1,'north'),
  window('south','FURNACE WINDOW',0,1,1,'south'),
  window('northeast','UPPER STUDY WINDOW',1,-1,1,'north'),
  window('southeast','LOWER STUDY WINDOW',1,1,1,'south')
]);
export const HORDE_REPAIR_REWARD=25;
export const HORDE_REPAIR_LIMIT=5;
export const HORDE_REPAIR_COOLDOWN_MS=650;
export const HORDE_WAVE_WINDOW_HP=6;
export const HORDE_SIEGE_ATTACK_INTERVAL_MS=840;

export const newHordeSiege=()=>({
 doors:Object.fromEntries(HORDE_DOORS.map(d=>[d.id,false])),
 windows:Object.fromEntries(HORDE_WINDOWS.map(w=>[w.id,{
   id:w.id,hp:w.maxHp,maxHp:w.maxHp,repairs:0
 }]))
});
export const availableHordeWindows=siege=>
 HORDE_WINDOWS.filter(w=>!w.requires||siege.doors[w.requires]===true);
export function hordeAccessible(x,y,doors,rad=0){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!doors)return false;
 return !(
  x>DEPOT_X+6.92-rad&&!doors.east||
  x<DEPOT_X-6.92+rad&&!doors.west||
  y<DEPOT_Y-6.92+rad&&!doors.north||
  y>DEPOT_Y+6.92-rad&&!doors.south
 );
}
export function validHordeInteraction(player,at,range=2.85){
 if(!player||!at||!player.active||player.falling||player.floor!==0)return false;
 const d=Math.hypot(player.x-at.x,player.y-at.y);
 return Number.isFinite(d)&&d<=range;
}
export function hordeBuyDoor(siege,player,inventory,id){
 const door=HORDE_DOORS.find(d=>d.id===id);
 if(!door||siege.doors[id]||door.requires&&!siege.doors[door.requires]||
   !validHordeInteraction(player,door,3.2)||inventory.points<door.cost)return false;
 inventory.points-=door.cost;siege.doors[id]=true;
 return true;
}
export function hordeRepairWindow(siege,player,inventory,id,now=Date.now()){
 const window=HORDE_WINDOWS.find(w=>w.id===id),state=siege.windows[id];
 if(!window||!state||window.requires&&!siege.doors[window.requires]||
   !validHordeInteraction(player,window,2.75)||state.hp>=state.maxHp||
   state.repairs>=HORDE_REPAIR_LIMIT||now-(player.lastHordeRepair||0)<HORDE_REPAIR_COOLDOWN_MS)return false;
 state.hp=Math.min(state.maxHp,state.hp+1);
 state.repairs++;inventory.points+=HORDE_REPAIR_REWARD;
 player.lastHordeRepair=now;
 return true;
}
export function hordeDamageWindow(siege,id,amount=1){
 const state=siege.windows[id];
 if(!state||state.hp<=0)return false;
 state.hp=Math.max(0,state.hp-Math.max(1,Math.min(2,Math.floor(amount))));
 return true;
}
export function hordeResetWindowRepairs(siege){
 for(const state of Object.values(siege.windows))state.repairs=0;
}
