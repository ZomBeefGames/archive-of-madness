// Crash-safe snapshots for multiplayer rooms. Write temp JSON, fsync optional,
// atomically rename; never store live WebSocket objects or private identifiers.
// COOP_DATA_DIR must point at a Railway persistent volume (e.g. /data).
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const MAX_SNAPSHOT=12*1024*1024;
const CODE=/^[A-HJ-NP-Z2-9]{6}$/;
const KEEP_MS=7*24*60*60*1000;
function simple(value,depth=0){
 if(depth>6)return null;
 if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number')return value;
 if(Array.isArray(value))return value.slice(0,3000).map(v=>simple(v,depth+1));
 if(value&&typeof value==='object'){
   const obj={};
   for(const [k,v] of Object.entries(value).slice(0,100)){
     if(k==='__proto__'||k==='constructor'||k==='prototype')continue;
     obj[k]=simple(v,depth+1);
   }
   return obj;
 }
 return null;
}
export function serializeRooms(rooms){
 const saved=[];
 for(const r of rooms.values()){
   if(!CODE.test(r.code))continue;
   saved.push({
     code:r.code,world:simple(r.world),
     barriers:[...r.barriers.values()].slice(0,240).map(b=>simple(b)),
     wrecks:[...r.wrecks.values()].slice(0,300).map(b=>simple(b)),
     broken:[...r.broken].slice(0,3000),salvaged:[...r.salvaged].slice(0,3000),
     nextBarrier:r.nextBarrier,created:r.created,
     lastSeen:r.members.size?Date.now():r.lastSeen||r.emptyAt||Date.now()
   });
 }
 return{format:2,at:Date.now(),rooms:saved.slice(-300)};
}
export function restoreRooms(raw,now=Date.now()){
 const out=new Map();
 if(!raw||raw.format!==2||!Array.isArray(raw.rooms))return out;
 for(const item of raw.rooms.slice(-300)){
   if(!item||!CODE.test(item.code)||!item.world||typeof item.world!=='object')continue;
   const lastSeen=Number(item.lastSeen)||now;
   if(now-lastSeen>KEEP_MS)continue;
   const r={code:item.code,world:simple(item.world),members:new Set(),
     barriers:new Map(),wrecks:new Map(),broken:new Set(),salvaged:new Set(),
     nextBarrier:Number.isInteger(item.nextBarrier)?Math.max(1,item.nextBarrier):1,
     created:Number(item.created)||now,emptyAt:now,lastSeen};
   for(const b of (Array.isArray(item.barriers)?item.barriers:[]).slice(0,240)){
     if(typeof b?.id==='string'&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isInteger(b.floor))
       r.barriers.set(b.id,b);
   }
   for(const b of (Array.isArray(item.wrecks)?item.wrecks:[]).slice(0,300)){
     if(typeof b?.id==='string'&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isInteger(b.floor))
       r.wrecks.set(b.id,b);
   }
   for(const x of (Array.isArray(item.broken)?item.broken:[]).slice(0,3000))
     if(typeof x==='string'&&x.length<150)r.broken.add(x);
   for(const x of (Array.isArray(item.salvaged)?item.salvaged:[]).slice(0,3000))
     if(typeof x==='string'&&x.length<150)r.salvaged.add(x);
   out.set(item.code,r);
 }
 return out;
}
export class RoomStore {
 constructor(dir=process.env.COOP_DATA_DIR||''){
   this.dir=dir;this.filename=dir?join(dir,'archive-coop-rooms.json'):null;
   this.dirty=false;this.timer=null;
   if(this.filename)mkdirSync(dir,{recursive:true});
 }
 read(){
   if(!this.filename||!existsSync(this.filename))return new Map();
   try{
     const data=readFileSync(this.filename);
     if(data.byteLength>MAX_SNAPSHOT)throw Error('snapshot too large');
     return restoreRooms(JSON.parse(data.toString('utf8')));
   }catch(e){console.error('Co-op snapshot could not be restored:',e.message);return new Map()}
 }
 schedule(rooms){
   if(!this.filename)return;
   this.dirty=true;this.rooms=rooms;
   if(this.timer)return;
   this.timer=setTimeout(()=>this.flush(),1400);this.timer.unref?.();
 }
 flush(){
   if(this.timer)clearTimeout(this.timer);this.timer=null;
   if(!this.dirty||!this.filename||!this.rooms)return;
   const content=JSON.stringify(serializeRooms(this.rooms));
   if(Buffer.byteLength(content)>MAX_SNAPSHOT){console.error('Co-op snapshot over size limit');return}
   try{
     const temp=this.filename+'.pending-'+process.pid;
     writeFileSync(temp,content,{mode:0o600});
     renameSync(temp,this.filename);
     this.dirty=false;
   }catch(e){console.error('Co-op persistence failed:',e.message)}
 }
 close(){this.flush()}
}
