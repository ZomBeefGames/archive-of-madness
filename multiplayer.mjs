// Real-time, session-scoped cooperative lobbies for Archives of Madness.
// The server owns membership, placed barricades, salvage inventory and all
// construction/damage operations. Solo games remain entirely offline.
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {SharedWorld,initShared,worldPublic} from './coop-state.mjs';
import {RoomStore} from './coop-persistence.mjs';
import {SpecialModes,GAME_MODES} from './special-modes.mjs';
import {modeSpawn,modeInside} from './mode-maps.mjs';
import {hordeAccessible} from './horde-siege.mjs';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PARTY=8;
export const MAX_BARRICADES=240;
export const MAX_MSG=4096;
const EMPTY_TTL=7*24*60*60*1000;
export const validCode=c=>typeof c==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(c);
export const validPosition=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  Math.abs(p.x)<=2e6&&Math.abs(p.y)<=2e6&&Number.isInteger(p.floor)&&Math.abs(p.floor)<=10000;
const PROFILE_LIMITS={gender:3,outfit:4,coat:8,pants:6,skin:6,hair:7};
export function cleanAppearance(a){
  const obj=a&&typeof a==='object'&&!Array.isArray(a)?a:{};
  const p={gender:0,age:28,outfit:0,coat:0,pants:0,skin:2,hair:1};
  for(const [k,size] of Object.entries(PROFILE_LIMITS))
    if(Number.isInteger(obj[k])&&obj[k]>=0&&obj[k]<size)p[k]=obj[k];
  if(Number.isInteger(obj.age))p.age=Math.min(90,Math.max(18,obj.age));
  return p;
}
const copyPlayer=p=>({id:p.id,name:p.name,x:p.x,y:p.y,f:p.f,floor:p.floor,coat:p.coat,pose:p.pose,
  active:!!p.active,falling:!!p.falling,appearance:p.appearance});
const packBarrier=b=>({id:b.id,x:b.x,y:b.y,floor:b.floor,level:b.level,hp:b.hp,owner:b.owner});
/* The co-op server validates every hand-to-hand interaction against its last
   acknowledged player pose, not untrusted ranges or directions from clients. */
export function validPersonShove(source,target,mode){
  if(!source||!target||source.falling||target.falling||
     !source.active||!target.active||source.floor!==target.floor)return false;
  if(mode!=='push'&&mode!=='throw')return false;
  const dx=target.x-source.x,dy=target.y-source.y,
    dist=Math.hypot(dx,dy),reach=mode==='throw'?1.48:1.95;
  if(dist<.2||dist>reach+.15)return false;
  const cos=(dx*Math.cos(source.f)+dy*Math.sin(source.f))/dist;
  return cos>=(mode==='throw'?.77:.64);
}
/* A valid recovery stays on the closest community tier to the point of
   departure. It is NOT permission for arbitrary floor teleports. */
export function validFallRecovery(origin,next,world){
  if(!origin||!world||world.day<=origin.day||!validPosition(next))return false;
  const stride=3+(Array.isArray(world.sentences)?world.sentences.length:0);
  const expectedFloor=Math.round(origin.floor/stride)*stride;
  if(next.floor!==expectedFloor)return false;
  const homeI=Math.round((origin.x/16-.5)/stride)*stride,
    homeJ=Math.round((origin.y/16-.5)/stride)*stride;
  const ci=Math.round(next.x/16-.5),cj=Math.round(next.y/16-.5);
  if(ci%stride||cj%stride)return false;
  if(Math.max(Math.abs(ci-homeI),Math.abs(cj-homeJ))>stride*4)return false;
  const cx=(ci+.5)*16,cy=(cj+.5)*16,d=Math.hypot(next.x-cx,next.y-cy);
  return d>.88&&d<2.9;
}
function shortName(name){
  return String(name||'READER').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18)||'READER';
}
function send(ws,msg){
  if(ws.readyState!==WebSocket.OPEN)return;
  try{ws.send(JSON.stringify(msg))}catch{}
}
function vicinity(p,item,radius=2.65){
  return p.floor===item.floor&&Math.hypot(p.x-item.x,p.y-item.y)<=radius;
}
function makeCode(rooms){
  for(let t=0;t<50;t++){
    const b=randomBytes(6);
    const code=Array.from(b,v=>ALPHABET[v%ALPHABET.length]).join('');
    if(!rooms.has(code))return code;
  }
  throw Error('Unable to allocate coop code');
}
export class GameRooms {
  constructor(options={}){
    this.store=options.store||new RoomStore();this.rooms=this.store.read();this.nextId=1;
    for(const room of this.rooms.values())this.attachWorld(room);
  }
  changed(){this.store.schedule(this.rooms)}
  attachWorld(room){
    room.engine=new SharedWorld(room,(r,m)=>this.broadcast(r,m),()=>this.changed());
    room.modes=new SpecialModes(room,(r,m)=>this.broadcast(r,m),()=>this.changed());
    return room.engine;
  }
  tick(now=Date.now()){for(const r of this.rooms.values()){r.modes.tick(now);r.engine.tick(now)}}
  close(){this.store.close()}
  broadcast(room,msg,except=null){
    for(const member of room.members)if(member.ws!==except)send(member.ws,msg);
  }
  publicRoom(room){return {
    code:room.code,players:[...room.members].map(copyPlayer),
    barriers:[...room.barriers.values()].map(packBarrier),
    wrecks:[...room.wrecks.values()],broken:[...room.broken],salvaged:[...room.salvaged],
    world:worldPublic(room.world),enemies:room.world.enemies,stories:room.world.stories,
    records:{proofs:room.world.proofs,sentences:room.world.sentences},host:room.hostId||null,
    game:room.modes.public()
  }}
  join(ws,msg){
    if(ws.player)return send(ws,{type:'error',message:'Already joined a Library.'});
    const isHost=msg.mode==='host';
    let room;
    if(isHost){
      const code=makeCode(this.rooms);
      const start=msg.start;
      if(!validPosition(start)||typeof msg.phrase!=='string'||msg.phrase.length>120||
        !['reader','archivist','lost','condemned'].includes(msg.difficulty))
        return send(ws,{type:'error',message:'Invalid Library starting state.'});
      const modeType=GAME_MODES.includes(msg.gameMode)?msg.gameMode:'story';
      const startAt=modeSpawn(modeType)||start;
      room={code,members:new Set(),barriers:new Map(),wrecks:new Map(),broken:new Set(),
        salvaged:new Set(),nextBarrier:1,created:Date.now(),emptyAt:0,lastSeen:Date.now(),
        world:{gameMode:modeType,
          phrase:msg.phrase,difficulty:msg.difficulty,
          x:startAt.x,y:startAt.y,floor:startAt.floor,day:1,epoch:1,clock:480*7/24,quest:0}};
      this.rooms.set(code,room);this.attachWorld(room);this.changed();
    }else{
      const code=String(msg.room||'').toUpperCase();
      if(!validCode(code)||!(room=this.rooms.get(code)))
        return send(ws,{type:'error',message:'That Library code does not exist. Create a new one.'});
      if(room.members.size>=MAX_PARTY)return send(ws,{type:'error',message:'The Library room is full (8 readers).'});
    }
    // Hosts and joining readers must both start at the server-approved map,
    // not at an arbitrary client-supplied campaign coordinate.
    const start=room.world;
    const p={ws,id:String(this.nextId++),name:shortName(msg.name),
      x:start.x,y:start.y,f:0,floor:start.floor,coat:this.nextId%3,pose:'stand',
      appearance:cleanAppearance(msg.appearance),
      planks:room.world.resources.boards,lastPose:0,lastAction:0,health:100,sanity:100,room};
    room.members.add(p);ws.player=p;room.emptyAt=0;room.lastSeen=Date.now();
    if(!room.hostId)room.hostId=p.id;
    send(ws,{type:'welcome',id:p.id,inventory:room.world.resources.boards,...this.publicRoom(room)});
    this.changed();
    this.broadcast(room,{type:'peer-join',player:copyPlayer(p)},ws);
    room.modes.join(p);
  }
  pose(p,msg){
    const now=Date.now();
    if(now-p.lastPose<65||!validPosition(msg))return;
    if(p.room.world.gameMode!=='story'&&!modeInside(p.room.world.gameMode,msg))return;
    if(p.room.world.gameMode==='horde'&&
       !hordeAccessible(msg.x,msg.y,p.room.modes.siege.doors))return;
    const x=msg.x,y=msg.y,f=Number(msg.f);
    if(!Number.isFinite(f))return;
    const passed=p.lastPose?(now-p.lastPose)/1000:4;
    const maxD=12*passed+2,falling=msg.falling===true;
    const recovered=p.falling&&!falling&&msg.respawnHub===true&&
      validFallRecovery(p.fallStart,msg,p.room.world);
    if(p.falling&&!falling&&!recovered)return;
    if(!recovered){
      if(Math.hypot(p.x-x,p.y-y)>maxD)return; // suppress arbitrary teleports
      if(falling){
        if(!p.falling){
          if(msg.active!==false||Math.abs(msg.floor-p.floor)>1)return;
          let day=p.room.world.day;
          // If the server reached dawn just before the first fall packet,
          // the preceding day is still its documented starting day.
          if(Number.isInteger(msg.fallDay)&&msg.fallDay===day-1&&
            p.room.world.clock<=480*8/24)day=msg.fallDay;
          p.fallStart={x:p.x,y:p.y,floor:p.floor,day};
          p.falling=true;
        }else{
          const floorDrop=p.floor-msg.floor;
          const maxFloorDrop=Math.ceil(14*passed/2.15)+2;
          if(floorDrop>maxFloorDrop||floorDrop< -1)return;
        }
      }else if(Math.abs(msg.floor-p.floor)>1)return;
    }else{
      p.falling=false;p.fallStart=null;p.lastWakeDay=p.room.world.day;
    }
    p.x=x;p.y=y;p.f=f;p.floor=msg.floor;
    p.pose=['stand','run','carry','flail','fall'].includes(msg.pose)?msg.pose:'stand';
    p.active=msg.active===true;
    p.lastPose=now;
    this.broadcast(p.room,{type:'peer',player:copyPlayer(p)},p.ws);
  }
  rope(p,msg){
    if(p.room.world.gameMode==='impostor'||msg.kind!=='enemy')return;
    p.room.engine.ropeEnemy(p,msg);
  }
  shove(p,msg){
    if(p.room.world.gameMode==='impostor')return;
    const now=Date.now(),mode=msg.mode,kind=msg.kind;
    if(now-(p.lastShove||0)<(mode==='throw'?1050:550)||p.falling)return;
    if(kind==='enemy'){
      if(p.room.engine.shoveEnemy(p,msg))p.lastShove=now;
      return;
    }
    if(kind!=='peer')return;
    const other=[...p.room.members].find(q=>q.id===msg.targetId&&q!==p);
    if(!validPersonShove(p,other,mode))return;
    p.lastShove=now;
    const dx=Math.cos(p.f),dy=Math.sin(p.f);
    this.broadcast(p.room,{type:'shove',fromId:p.id,targetId:other.id,
      floor:p.floor,mode,dx,dy});
  }
  action(p,msg){
    const room=p.room,now=Date.now();
    if(now-p.lastAction<95)return;
    p.lastAction=now;
    const action=msg.action;
    if(room.world.gameMode==='impostor')
      return send(p.ws,{type:'error',message:'Barricades are disabled during hidden-traitor rounds.'});
    const inv=()=>{
      const w=room.world;room.engine.touch();
      this.broadcast(room,{type:'inventory',planks:w.resources.boards});
      this.broadcast(room,{type:'resources',resources:{...w.resources},tr:{...w.tr},version:w.version});
    };
    const error=reason=>send(p.ws,{type:'error',message:reason});
    if(action==='breach'||action==='salvage'){
      const key=String(msg.key||'');
      const m=/^(\d+)\|(g|hub|transit)\|(-?\d+),(-?\d+)\|(-?\d+)$/.exec(key);
      if(!m||key.length>95)return error('Invalid barricade location.');
      if(!validPosition(msg)||!vicinity(p,msg,3.0)||Number(m[5])!==msg.floor)
        return error('Get closer to those boards.');
      const [i,j]=[Number(m[3]),Number(m[4])];
      if(!Number.isInteger(i)||!Number.isInteger(j)||Math.abs(i)>125000||Math.abs(j)>125000)
        return error('Invalid barricade coordinates.');
      const x0=m[2]==='g'?i*16:(i+.5)*16+1.36;
      const y0=m[2]==='g'?j*16:(j+.5)*16-.36;
      const validSpot=m[2]==='g'?Math.abs(msg.y-y0)<.8&&
        Math.min(Math.abs(msg.x-(x0+5*Math.cos(Math.PI/6))),Math.abs(msg.x-(x0-5*Math.cos(Math.PI/6))))<.8:
        Math.hypot(msg.x-x0,msg.y-y0)<.9;
      if(!validSpot)return error('No salvageable barricade at that address.');
      if(action==='breach'){
        room.broken.add(key);
        this.broadcast(room,{type:'zone',key,breached:true});this.changed();
        return;
      }
      if(!room.broken.has(key)||room.salvaged.has(key))return error('No planks remain here.');
      room.salvaged.add(key);room.world.resources.boards=Math.min(40,room.world.resources.boards+1);
      this.broadcast(room,{type:'zone',key,salvaged:true});
      inv();return;
    }
    if(action==='place'){
      const at={x:msg.x,y:msg.y,floor:msg.floor};
      if(!validPosition(at)||!vicinity(p,at,2.75)||Math.hypot(p.x-at.x,p.y-at.y)<1.0)
        return error('Move a little farther from the placement spot.');
      if(room.world.resources.boards<1)return error('Collect boards from a destroyed barricade first.');
      if(room.barriers.size>=MAX_BARRICADES)return error('This Library cannot hold more barricades.');
      if([...room.barriers.values()].some(b=>vicinity(at,b,1.3)))
        return error('There is already a barricade in that space.');
      const b={id:String(room.nextBarrier++),x:Math.round(at.x*4)/4,
        y:Math.round(at.y*4)/4,floor:at.floor,level:0,hp:3,owner:p.id};
      room.barriers.set(b.id,b);room.world.resources.boards--;inv();
      this.broadcast(room,{type:'barrier',action:'upsert',barrier:packBarrier(b)});return;
    }
    const b=room.barriers.get(String(msg.id||''));
    const wreck=room.wrecks.get(String(msg.id||''));
    if(action==='pickup-wreck'){
      if(!wreck||!vicinity(p,wreck))return error('Those boards are out of reach.');
      room.wrecks.delete(wreck.id);room.world.resources.boards=Math.min(40,room.world.resources.boards+1);inv();
      this.broadcast(room,{type:'barrier',action:'remove-wreck',id:wreck.id});return;
    }
    if(!b||!vicinity(p,b))return error('There is no barricade within reach.');
    if(action==='reinforce'){
      if(room.world.resources.boards<1)return error('You need another recovered barricade.');
      if(b.level>=3)return error('Already indestructible: three reinforcements.');
      room.world.resources.boards--;b.level++;b.hp=3+b.level*4;inv();
      this.broadcast(room,{type:'barrier',action:'upsert',barrier:packBarrier(b)});return;
    }
    if(action==='take'){
      room.barriers.delete(b.id);room.world.resources.boards=Math.min(40,room.world.resources.boards+1+b.level);inv();
      this.broadcast(room,{type:'barrier',action:'remove',id:b.id});return;
    }
    if(action==='hit'){
      if(b.level>=3)return send(p.ws,{type:'error',message:'The triple-braced barricade cannot be destroyed.'});
      b.hp=Math.max(0,b.hp-1);
      if(b.hp===0){
        room.barriers.delete(b.id);
        room.wrecks.set('wreck-'+b.id,{id:'wreck-'+b.id,x:b.x,y:b.y,floor:b.floor});
        this.broadcast(room,{type:'barrier',action:'remove',id:b.id});
        this.broadcast(room,{type:'barrier',action:'wreck',wreck:room.wrecks.get('wreck-'+b.id)});
      }else this.broadcast(room,{type:'barrier',action:'upsert',barrier:packBarrier(b)});
      this.changed();return;
    }
    error('Unknown barricade action.');
  }
  message(ws,raw){
    if(raw.length>MAX_MSG)return ws.close(1009,'Message too large');
    let msg;try{msg=JSON.parse(raw.toString())}catch{return}
    if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
    if(msg.type==='join')return this.join(ws,msg);
    const p=ws.player;if(!p)return send(ws,{type:'error',message:'Join a Library first.'});
    if(msg.type==='pose')return this.pose(p,msg);
    if(msg.type==='shove')return this.shove(p,msg);
    if(msg.type==='rope')return this.rope(p,msg);
    if(msg.type==='barrier')return this.action(p,msg);
    if(msg.type==='mode-action')return p.room.modes.action(p,msg);
    if(msg.type==='resources')return p.room.engine.resources(p,msg);
    if(msg.type==='claim'){
      if(!p.room.engine.claim(p,msg))send(ws,{type:'world',world:worldPublic(p.room.world)});
      return;
    }
    if(msg.type==='combat')return p.room.engine.combat(p,msg);
    if(msg.type==='story-start'){if(p.room.hostId!==p.id)return;return p.room.engine.storyStart(p,msg)}
    if(msg.type==='story-choice')return p.room.engine.storyChoose(p,msg);
    if(msg.type==='chat'){
      if(Date.now()-(p.lastChat||0)<900)return;
      p.lastChat=Date.now();
      const text=String(msg.text||'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,120);
      if(text)this.broadcast(p.room,{type:'chat',id:p.id,name:p.name,text});
    }
  }
  leave(ws){
    const p=ws.player;if(!p)return;
    const r=p.room;r.members.delete(p);ws.player=null;
    r.modes.leave(p);
    this.broadcast(r,{type:'peer-leave',id:p.id});
    if(!r.members.size)r.emptyAt=Date.now();
    if(r.hostId===p.id){r.hostId=[...r.members][0]?.id||null;this.broadcast(r,{type:'host',id:r.hostId})}
    r.lastSeen=Date.now();this.changed();
  }
  sweep(now=Date.now()){
    let removed=false;for(const [key,room] of this.rooms)
      if(!room.members.size&&now-(room.lastSeen||room.emptyAt||now)>EMPTY_TTL){this.rooms.delete(key);removed=true}
    if(removed)this.changed();
  }
}
export function attachMultiplayer(server){
  const rooms=new GameRooms(),wss=new WebSocketServer({noServer:true,maxPayload:MAX_MSG,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      const origin=req.headers.origin;
      if(u.pathname!=='/coop'||(origin&&new URL(origin).host!==req.headers.host)){
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
      }
      wss.handleUpgrade(req,socket,head,ws=>{
        ws.on('message',data=>rooms.message(ws,data));
        ws.on('close',()=>rooms.leave(ws));
        ws.on('error',()=>rooms.leave(ws));
        ws.on('pong',()=>{ws.isAlive=true});
        ws.isAlive=true;
      });
    }catch{socket.destroy()}
  });
  const clock=setInterval(()=>rooms.tick(),250);clock.unref?.();
  const interval=setInterval(()=>{
    rooms.sweep();
    for(const ws of wss.clients){
      if(ws.isAlive===false){ws.terminate();continue}
      ws.isAlive=false;ws.ping();
    }
  },30000);
  interval.unref?.();
  return{rooms,wss,close:()=>{clearInterval(interval);clearInterval(clock);rooms.close();wss.close()}};
}
