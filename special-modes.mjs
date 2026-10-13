// Server-owned alternative game modes. Roles and votes never live in the
// public world snapshot. Sessions restart in a waiting state after a server
// reboot; persisted rooms remain joinable without leaking past secret roles.
import {randomBytes} from 'node:crypto';

export const GAME_MODES=['story','impostor','horde'];
export const HORDE_FINAL_WAVE=10;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const nowMs=()=>Date.now();
const TASK_NAMES=['RESTORE THE CATALOGUE','REPLACE THE LAMP WICK',
  'SEAL THE FORBIDDEN FOLIO','REPAIR THE PNEUMATIC INDEX',
  'BALANCE THE ARCHIVE SCALES','RECONNECT THE OBSERVATORY'];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function modeStations(world){
 const cx=Math.round(world.x/16)*16,cy=Math.round(world.y/16)*16,
   fl=world.floor;
 return TASK_NAMES.map((label,i)=>{
   const a=(i/6)*Math.PI*2+.21;
   return{id:'station-'+i,label,x:cx+Math.cos(a)*2.9,
     y:cy+Math.sin(a)*2.9,floor:fl};
 });
}
export function validModeVictim(p,v,maxDistance=1.5){
 if(!p||!v||p===v||!p.active||!v.active||p.falling||v.falling||
    p.floor!==v.floor||dist(p,v)>maxDistance||dist(p,v)<.17)return false;
 const dx=v.x-p.x,dy=v.y-p.y,d=Math.hypot(dx,dy);
 return(dx*Math.cos(p.f)+dy*Math.sin(p.f))/d>.38;
}
export class SpecialModes{
 constructor(room,broadcast,changed){
  this.room=room;this.broadcast=broadcast;this.changed=changed;
  this.phase='lobby';this.winner=null;this.started=0;
  this.roles=new Map();this.alive=new Map();this.tasks=new Map();
  this.completed=new Map();this.bodies=[];this.votes=new Map();
  this.station=modeStations(room.world);this.meetingUntil=0;
  this.meetingResult=null;this.meetingSeq=0;this.lastMeeting=0;
  this.lastSabotage=0;this.sabotage=null;this.sabotageUntil=0;
  this.wave=0;this.prepUntil=0;this.lastWave=0;this.health=new Map();
  this.lastReport=0;this.lastClock=nowMs();
 }
 get type(){return this.room.world.gameMode||'story'}
 members(){return[...this.room.members]}
 participants(){return this.members().map(p=>({
   id:p.id,name:p.name,alive:this.alive.get(p.id)!==false,
   floor:p.floor,health:this.type==='horde'?this.health.get(p.id)??100:undefined
 }))}
 public(){
  if(this.type==='story')return{type:'story',phase:'story'};
  const phase=this.phase;
  const result={type:this.type,phase,winner:this.winner,players:this.participants(),
    canStart:this.type==='impostor'?this.members().length>=3:this.members().length>=1};
  if(this.type==='impostor'){
   const required=[...this.tasks.values()].reduce((n,t)=>n+t.length,0);
   const done=[...this.completed.values()].reduce((n,t)=>n+t.size,0);
   Object.assign(result,{stations:this.station,done,required,
     bodies:this.bodies.map(b=>({...b})),
     sabotage:this.sabotage?{kind:this.sabotage,
       remaining:Math.max(0,Math.ceil((this.sabotageUntil-nowMs())/1000))}:null,
     meeting:this.phase==='meeting'?{seconds:Math.max(0,Math.ceil((this.meetingUntil-nowMs())/1000)),
       votes:this.votes.size,eligible:this.participants().filter(p=>p.alive).length}:null,
     meetingResult:this.meetingResult});
  }else{
   Object.assign(result,{wave:this.wave,maxWaves:HORDE_FINAL_WAVE,
     zombies:this.room.world.enemies.filter(e=>e.type==='zombie'&&!e.dead).length,
     prep:this.phase==='preparing'?Math.max(0,Math.ceil((this.prepUntil-nowMs())/1000)):0});
  }
  return result;
 }
 emit(){
  this.broadcast(this.room,{type:'mode-state',mode:this.public()});
 }
 private(player){
  if(this.type==='story')return;
  const msg={type:'mode-private',gameMode:this.type,
    role:this.roles.get(player.id)||'spectator',
    alive:this.alive.get(player.id)!==false,
    tasks:this.tasks.get(player.id)||[],
    done:[...(this.completed.get(player.id)||[])],
    health:this.health.get(player.id)??100};
  if(player.ws?.readyState===1)player.ws.send(JSON.stringify(msg));
 }
 privateAll(){for(const p of this.members())this.private(p)}
 error(player,message){
  if(player.ws?.readyState===1)player.ws.send(JSON.stringify({type:'error',message}));
 }
 resetForLobby(){
  this.phase='lobby';this.winner=null;this.started=0;
  this.roles.clear();this.alive.clear();this.tasks.clear();
  this.completed.clear();this.bodies=[];this.votes.clear();
  this.sabotage=null;this.meetingResult=null;this.lastSabotage=0;
  this.meetingUntil=0;this.wave=0;this.prepUntil=0;
  this.health.clear();this.room.world.enemies=[];
 }
 start(player,now=nowMs()){
  if(this.type==='story'||this.room.hostId!==player.id)return false;
  if(this.phase!=='lobby'&&this.phase!=='over')return false;
  if(this.type==='impostor'&&this.members().length<3)
   return this.error(player,'A hidden-traitor round needs at least 3 readers.'),false;
  this.resetForLobby();this.started=now;this.lastClock=now;
  const participants=this.members();
  if(this.type==='impostor'){
   this.phase='playing';
   const impostor=participants[randomBytes(1)[0]%participants.length];
   participants.forEach((p,index)=>{
     const role=p===impostor?'traitor':'crew';
     this.roles.set(p.id,role);this.alive.set(p.id,true);
     if(role==='crew'){
       // Three tasks per librarian; each real shelf/lamp anchor is reused.
       const tasks=[0,1,2].map(k=>this.station[(index*2+k)%this.station.length].id);
       this.tasks.set(p.id,tasks);this.completed.set(p.id,new Set());
     }
   });
  }else{
   this.phase='preparing';this.prepUntil=now+7000;
   participants.forEach(p=>{
     this.roles.set(p.id,'survivor');this.alive.set(p.id,true);
     this.health.set(p.id,100);p.modeHealth=100;
   });
   this.room.world.resources.boards=Math.max(8,this.room.world.resources.boards);
   this.room.world.resources.oil=Math.max(12,this.room.world.resources.oil);
  }
  this.privateAll();this.emit();this.changed?.();
  return true;
 }
 join(player){
  if(this.type==='story')return;
  if(this.phase==='lobby')this.alive.set(player.id,true);
  else if(this.type==='horde'&&this.phase!=='over'){
   this.roles.set(player.id,'survivor');this.alive.set(player.id,true);
   this.health.set(player.id,100);player.modeHealth=100;
  }else{this.roles.set(player.id,'spectator');this.alive.set(player.id,false)}
  this.private(player);this.emit();
 }
 leave(player){
  this.roles.delete(player.id);this.alive.delete(player.id);
  this.tasks.delete(player.id);this.completed.delete(player.id);
  this.votes.delete(player.id);this.health.delete(player.id);
  if(this.type==='impostor'&&this.phase==='playing')this.checkWin();
  if(this.type==='horde'&&this.phase!=='lobby')this.checkSurvivors();
  this.emit();
 }
 finish(winner){
  if(this.phase==='over')return;
  this.phase='over';this.winner=winner;this.sabotage=null;
  this.room.world.enemies=this.room.world.enemies.filter(e=>e.type!=='zombie');
  this.changed?.();this.emit();this.privateAll();
 }
 checkWin(){
  if(this.type!=='impostor'||this.phase==='over'||this.phase==='lobby')return;
  let crew=0,traitors=0;
  for(const p of this.members())if(this.alive.get(p.id)!==false){
   if(this.roles.get(p.id)==='traitor')traitors++;
   else if(this.roles.get(p.id)==='crew')crew++;
  }
  if(traitors===0){this.finish('crew');return}
  if(traitors>=crew){this.finish('traitor');return}
  const total=[...this.tasks.values()].reduce((n,v)=>n+v.length,0);
  const done=[...this.completed.values()].reduce((n,v)=>n+v.size,0);
  if(total>0&&done>=total)this.finish('crew');
 }
 checkSurvivors(){
  if(this.type==='horde'&&this.phase!=='lobby'&&this.phase!=='over'&&
     !this.members().some(p=>this.alive.get(p.id)!==false))this.finish('horde');
 }
 social(player,msg,now=nowMs()){
  if(this.type!=='impostor')return;
  const role=this.roles.get(player.id),alive=this.alive.get(player.id)!==false,
    kind=msg.action;
  if(this.phase==='meeting'){
   if(kind!=='vote'||!alive||this.votes.has(player.id))return;
   const vote=msg.targetId===null?null:String(msg.targetId||'');
   if(vote!==null&&!this.members().some(p=>p.id===vote&&this.alive.get(p.id)!==false))return;
   this.votes.set(player.id,vote);
   if(this.votes.size>=this.members().filter(p=>this.alive.get(p.id)!==false).length)this.resolveMeeting(now);
   else this.emit();
   return;
  }
  if(this.phase!=='playing'||!alive||role==='spectator')return;
  if(kind==='task'&&role==='crew'){
   if(this.sabotage)return;
   const id=String(msg.stationId||''),station=this.station.find(s=>s.id===id),
     mine=this.tasks.get(player.id),done=this.completed.get(player.id);
   if(!station||!mine?.includes(id)||done?.has(id)||player.floor!==station.floor||
      dist(player,station)>1.75||now-(player.lastTask||0)<1300)return;
   player.lastTask=now;done.add(id);this.private(player);this.emit();this.checkWin();
  }else if(kind==='kill'&&role==='traitor'){
   if(now-(player.lastModeKill||0)<18000)return;
   const target=this.members().find(p=>p.id===String(msg.targetId)&&p!==player);
   if(!target||this.roles.get(target.id)==='traitor'||this.alive.get(target.id)===false||
     !validModeVictim(player,target,1.55))return;
   player.lastModeKill=now;this.alive.set(target.id,false);
   this.bodies.push({id:'body-'+target.id+'-'+this.meetingSeq,owner:target.id,
     name:target.name,x:target.x,y:target.y,floor:target.floor});
   this.broadcast(this.room,{type:'mode-impact',kind:'elimination',id:target.id,
     x:target.x,y:target.y,floor:target.floor});
   this.private(target);this.emit();this.checkWin();
  }else if(kind==='sabotage'&&role==='traitor'){
   if(this.sabotage||now-this.lastSabotage<35000)return;
   const sabotage=String(msg.kind);
   if(!['lights','catalogue'].includes(sabotage))return;
   this.lastSabotage=now;this.sabotage=sabotage;this.sabotageUntil=now+22000;
   this.emit();
  }else if(kind==='repair'&&role==='crew'&&this.sabotage){
   const station=this.station.find(s=>s.id==='station-1'||s.id==='station-3');
   if(!station||player.floor!==station.floor||dist(player,station)>1.8)return;
   this.sabotage=null;this.sabotageUntil=0;this.emit();
  }else if(kind==='report'||kind==='meeting'){
   if(now-this.lastMeeting<16000)return;
   const nearby=this.bodies.find(b=>b.floor===player.floor&&dist(player,b)<2.2);
   const center=this.station[0];
   if(kind==='report'&&!nearby)return;
   if(kind==='meeting'&&(dist(player,center)>2.2||player.floor!==center.floor))return;
   this.lastMeeting=now;this.phase='meeting';this.votes.clear();this.meetingResult=null;
   this.meetingUntil=now+27000;this.meetingSeq++;
   this.sabotage=null;this.bodies=[];
   this.emit();
  }
 }
 resolveMeeting(now=nowMs()){
  if(this.phase!=='meeting')return;
  const counts=new Map();
  for(const vote of this.votes.values())if(vote!==null)counts.set(vote,(counts.get(vote)||0)+1);
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
  let exiled=null;
  if(sorted.length&&sorted[0][1]>(sorted[1]?.[1]||0)&&
     sorted[0][1]>=Math.ceil(this.members().filter(p=>this.alive.get(p.id)!==false).length/2)){
   exiled=sorted[0][0];
   this.alive.set(exiled,false);
  }
  this.phase='playing';this.meetingUntil=0;this.votes.clear();
  this.meetingResult={exiled,name:this.members().find(p=>p.id===exiled)?.name||null,
    seconds:6};
  this.broadcast(this.room,{type:'mode-impact',kind:'meeting-result',exiled});
  this.privateAll();this.emit();this.checkWin();
 }
 hordeDamage(player,amount){
  if(this.type!=='horde'||this.phase!=='wave'||this.alive.get(player.id)===false)return null;
  const current=this.health.get(player.id)??100,next=clamp(current-amount,0,100);
  this.health.set(player.id,next);player.modeHealth=next;
  if(next===0)this.alive.set(player.id,false);
  this.private(player);this.emit();this.checkSurvivors();return next;
 }
 hordeAction(player,msg){
  if(this.type!=='horde'||this.phase==='over'||this.phase==='lobby')return;
  const kind=msg.action;
  if(kind==='revive'){
   if(this.alive.get(player.id)===false)return;
   const target=this.members().find(p=>p.id===String(msg.targetId));
   if(!target||this.alive.get(target.id)!==false||
      target.floor!==player.floor||dist(player,target)>2.2)return;
   if(this.room.world.resources.boards<2)return;
   this.room.world.resources.boards-=2;
   this.alive.set(target.id,true);this.health.set(target.id,45);target.modeHealth=45;
   this.private(target);this.broadcast(this.room,{type:'resources',resources:{...this.room.world.resources},
     tr:{...this.room.world.tr}});this.emit();
  }
 }
 spawnWave(now=nowMs()){
  const world=this.room.world;
  this.wave++;this.phase='wave';this.lastWave=now;
  const fighters=this.members().filter(p=>this.alive.get(p.id)!==false);
  const limit=Math.min(90,5+this.wave*3+Math.max(0,fighters.length-1)*3);
  world.enemies=world.enemies.filter(e=>e.type!=='zombie');
  for(let n=0;n<limit;n++){
   const p=fighters[n%fighters.length];
   if(!p)break;
   const cx=Math.round(p.x/16)*16,cy=Math.round(p.y/16)*16,
     a=((n/limit)*Math.PI*2+n*.61)%(Math.PI*2),r=3.15+(n%3)*.15,
     x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
   // Different spawn angles place the swarm all around the gallery.
   world.enemies.push({id:'zombie:'+this.wave+':'+n,x,y,f:a+Math.PI,
     floor:p.floor,type:'zombie',hp:3+Math.floor((this.wave-1)/2),
     dead:false,region:'horde',cx,cy,lastAttack:0,wave:this.wave});
  }
  this.broadcast(this.room,{type:'enemies',enemies:world.enemies});
  this.emit();this.changed?.();
 }
 tick(now=nowMs()){
  if(this.type==='story'||this.phase==='lobby'||this.phase==='over')return;
  if(this.type==='impostor'){
   if(this.phase==='playing'&&this.sabotage&&now>=this.sabotageUntil){
    this.sabotage=null;this.emit();
   }
   if(this.phase==='meeting'&&now>=this.meetingUntil)this.resolveMeeting(now);
   if(this.phase==='playing'&&now-this.started>12*60*1000)this.finish('crew');
   if(now-this.lastReport>1500){this.lastReport=now;this.emit()}
   return;
  }
  if(this.phase==='preparing'&&now>=this.prepUntil)this.spawnWave(now);
  if(this.phase==='wave'&&this.room.world.enemies.every(e=>e.type!=='zombie'||e.dead)){
   if(this.wave>=HORDE_FINAL_WAVE){this.finish('survivors');return}
   this.phase='preparing';this.prepUntil=now+Math.max(5,12-this.wave)*1000;
   const res=this.room.world.resources;
   res.boards=Math.min(60,res.boards+2+Math.floor(this.wave/2));
   res.oil=Math.min(500,res.oil+3);
   for(const p of this.members())if(this.alive.get(p.id)!==false){
    this.health.set(p.id,Math.min(100,(this.health.get(p.id)||50)+20));
    this.private(p);
   }
   this.broadcast(this.room,{type:'resources',resources:{...res},tr:{...this.room.world.tr}});
   this.emit();this.changed?.();
  }
  if(now-this.lastReport>1000){this.lastReport=now;this.emit()}
 }
 action(player,msg){
  if(this.type==='story')return;
  if(msg.action==='start'){this.start(player);return}
  if(this.type==='impostor')this.social(player,msg);
  else this.hordeAction(player,msg);
 }
}
