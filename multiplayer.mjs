// Real-time, session-scoped cooperative lobbies for Archives of Madness.
// The server owns membership, placed barricades, salvage inventory and all
// construction/damage operations. Solo games remain entirely offline.
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PARTY=8;
export const MAX_BARRICADES=240;
export const MAX_MSG=4096;
const EMPTY_TTL=30*60*1000;
export const validCode=c=>typeof c==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(c);
export const validPosition=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  Math.abs(p.x)<=2e6&&Math.abs(p.y)<=2e6&&Number.isInteger(p.floor)&&Math.abs(p.floor)<=10000;
const copyPlayer=p=>({id:p.id,name:p.name,x:p.x,y:p.y,f:p.f,floor:p.floor,coat:p.coat,pose:p.pose});
const packBarrier=b=>({id:b.id,x:b.x,y:b.y,floor:b.floor,level:b.level,hp:b.hp,owner:b.owner});
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
  constructor(){this.rooms=new Map();this.nextId=1}
  broadcast(room,msg,except=null){
    for(const member of room.members)if(member.ws!==except)send(member.ws,msg);
  }
  publicRoom(room){return {
    code:room.code,players:[...room.members].map(copyPlayer),
    barriers:[...room.barriers.values()].map(packBarrier),
    wrecks:[...room.wrecks.values()],broken:[...room.broken],salvaged:[...room.salvaged],
    world:room.world
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
      room={code,members:new Set(),barriers:new Map(),wrecks:new Map(),broken:new Set(),
        salvaged:new Set(),nextBarrier:1,created:Date.now(),emptyAt:0,
        world:{phrase:msg.phrase,difficulty:msg.difficulty,
          x:start.x,y:start.y,floor:start.floor,day:1,epoch:1}};
      this.rooms.set(code,room);
    }else{
      const code=String(msg.room||'').toUpperCase();
      if(!validCode(code)||!(room=this.rooms.get(code)))
        return send(ws,{type:'error',message:'That Library code does not exist. Create a new one.'});
      if(room.members.size>=MAX_PARTY)return send(ws,{type:'error',message:'The Library room is full (8 readers).'});
    }
    const start=isHost?msg.start:room.world;
    const p={ws,id:String(this.nextId++),name:shortName(msg.name),
      x:start.x,y:start.y,f:0,floor:start.floor,coat:this.nextId%3,pose:'stand',
      planks:0,lastPose:0,lastAction:0,room};
    room.members.add(p);ws.player=p;room.emptyAt=0;
    send(ws,{type:'welcome',id:p.id,inventory:p.planks,...this.publicRoom(room)});
    this.broadcast(room,{type:'peer-join',player:copyPlayer(p)},ws);
  }
  pose(p,msg){
    const now=Date.now();
    if(now-p.lastPose<65||!validPosition(msg))return;
    const x=msg.x,y=msg.y,f=Number(msg.f);
    if(!Number.isFinite(f))return;
    const passed=p.lastPose?(now-p.lastPose)/1000:4;
    const maxD=12*passed+2;
    if(Math.hypot(p.x-x,p.y-y)>maxD)return; // suppress obvious teleports
    if(Math.abs(msg.floor-p.floor)>1&&p.lastPose)return;
    p.x=x;p.y=y;p.f=f;p.floor=msg.floor;
    p.pose=['stand','run','carry'].includes(msg.pose)?msg.pose:'stand';
    p.lastPose=now;
    this.broadcast(p.room,{type:'peer',player:copyPlayer(p)},p.ws);
  }
  action(p,msg){
    const room=p.room,now=Date.now();
    if(now-p.lastAction<95)return;
    p.lastAction=now;
    const action=msg.action;
    const inv=()=>send(p.ws,{type:'inventory',planks:p.planks});
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
        this.broadcast(room,{type:'zone',key,breached:true});
        return;
      }
      if(!room.broken.has(key)||room.salvaged.has(key))return error('No planks remain here.');
      room.salvaged.add(key);p.planks=Math.min(40,p.planks+1);
      this.broadcast(room,{type:'zone',key,salvaged:true});
      inv();return;
    }
    if(action==='place'){
      const at={x:msg.x,y:msg.y,floor:msg.floor};
      if(!validPosition(at)||!vicinity(p,at,2.75)||Math.hypot(p.x-at.x,p.y-at.y)<1.0)
        return error('Move a little farther from the placement spot.');
      if(p.planks<1)return error('Collect boards from a destroyed barricade first.');
      if(room.barriers.size>=MAX_BARRICADES)return error('This Library cannot hold more barricades.');
      if([...room.barriers.values()].some(b=>vicinity(at,b,1.3)))
        return error('There is already a barricade in that space.');
      const b={id:String(room.nextBarrier++),x:Math.round(at.x*4)/4,
        y:Math.round(at.y*4)/4,floor:at.floor,level:0,hp:3,owner:p.id};
      room.barriers.set(b.id,b);p.planks--;inv();
      this.broadcast(room,{type:'barrier',action:'upsert',barrier:packBarrier(b)});return;
    }
    const b=room.barriers.get(String(msg.id||''));
    const wreck=room.wrecks.get(String(msg.id||''));
    if(action==='pickup-wreck'){
      if(!wreck||!vicinity(p,wreck))return error('Those boards are out of reach.');
      room.wrecks.delete(wreck.id);p.planks=Math.min(40,p.planks+1);inv();
      this.broadcast(room,{type:'barrier',action:'remove-wreck',id:wreck.id});return;
    }
    if(!b||!vicinity(p,b))return error('There is no barricade within reach.');
    if(action==='reinforce'){
      if(p.planks<1)return error('You need another recovered barricade.');
      if(b.level>=3)return error('Already indestructible: three reinforcements.');
      p.planks--;b.level++;b.hp=3+b.level*4;inv();
      this.broadcast(room,{type:'barrier',action:'upsert',barrier:packBarrier(b)});return;
    }
    if(action==='take'){
      room.barriers.delete(b.id);p.planks=Math.min(40,p.planks+1+b.level);inv();
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
      return;
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
    if(msg.type==='barrier')return this.action(p,msg);
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
    this.broadcast(r,{type:'peer-leave',id:p.id});
    if(!r.members.size)r.emptyAt=Date.now();
  }
  sweep(now=Date.now()){
    for(const [key,room] of this.rooms)if(room.emptyAt&&now-room.emptyAt>EMPTY_TTL)this.rooms.delete(key);
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
  const interval=setInterval(()=>{
    rooms.sweep();
    for(const ws of wss.clients){
      if(ws.isAlive===false){ws.terminate();continue}
      ws.isAlive=false;ws.ping();
    }
  },30000);
  interval.unref?.();
  return{rooms,wss,close:()=>{clearInterval(interval);wss.close()}};
}
