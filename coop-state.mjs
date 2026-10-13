// Authoritative cooperative Library world. The browser renders the paper
// puppets, but the server decides enemy health, shared supplies, quest gates,
// story outcomes, clock/dawns, and victory. Serializable across restarts.
export const WORLD_DAY_SECONDS=480;
export const RESOURCE_KEYS=['oil','type','incense','torches','frags','boards'];
export const LIMITS={oil:500,type:1000,incense:300,torches:50,frags:500,boards:60};
export const GOALS={
  reader:{minDay:3,indexDay:1,shelfDay:2,indexCost:1,sentences:2,proofs:1},
  archivist:{minDay:5,indexDay:2,shelfDay:3,indexCost:2,sentences:3,proofs:2},
  lost:{minDay:8,indexDay:3,shelfDay:5,indexCost:3,sentences:5,proofs:4},
  condemned:{minDay:12,indexDay:4,shelfDay:7,indexCost:4,sentences:7,proofs:6}
};
export const STORY_TYPES=new Set([
 'laugh','count','weep','peddler','sleep','rose','cartographer','surgeon','warden',
 'binder','bellkeeper','orphan','exile','glassmaker','mob','funeral','sermon',
 'auction','trial','choir','watch','firebrigade','quarantine','council',
 'pilgrims','shelter','ledgerfire','ritual'
]);
const MAX_ENEMIES=160,MAX_STORIES=40;
const VALID_KEY=/^[a-zA-Z0-9 _|.,:@+/=-]{1,155}$/;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const cleanResources=a=>Object.fromEntries(RESOURCE_KEYS.map(k=>[k,bound(Number.isFinite(a?.[k])?Math.round(a[k]):k==='oil'?8:0,0,LIMITS[k])]));
const validPosition=v=>v&&finite(v.x)&&finite(v.y)&&Number.isInteger(v.floor)&&Math.abs(v.x)<2e6&&Math.abs(v.y)<2e6&&Math.abs(v.floor)<10000;
const coordKey=(x,y,floor)=>Math.round(x/16)+','+Math.round(y/16)+'|'+floor;
const hash=s=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0};
const seeded=(s,i)=>((hash(s+'|'+i)%10000)/10000);
export function initShared(room){
 const w=room.world;
 w.gameMode=['story','impostor','horde'].includes(w.gameMode)?w.gameMode:'story';
 w.day=Number.isInteger(w.day)?Math.max(1,w.day):1;
 w.clock=finite(w.clock)?bound(w.clock,0,WORLD_DAY_SECONDS):WORLD_DAY_SECONDS*7/24;
 w.epoch=Number.isInteger(w.epoch)?Math.max(1,w.epoch):1;
 w.resetCount=Number.isInteger(w.resetCount)?Math.max(0,w.resetCount):0;
 w.resetInterval=2+Math.floor(w.resetCount/2);
 w.nextResetDay=Number.isInteger(w.nextResetDay)?w.nextResetDay:3;
 w.quest=Number.isInteger(w.quest)?bound(w.quest,0,6):0;
 w.proofs=Array.isArray(w.proofs)?w.proofs.filter(k=>typeof k==='string'&&VALID_KEY.test(k)).slice(0,4096):[];
 w.sentences=Array.isArray(w.sentences)?w.sentences.filter(k=>typeof k==='string'&&VALID_KEY.test(k)).slice(0,4096):[];
 w.resources=cleanResources(w.resources);
 w.tr=(w.tr&&typeof w.tr==='object'&&!Array.isArray(w.tr))?w.tr:{};
 w.ending=!!w.ending;
 w.enemies=Array.isArray(w.enemies)?w.enemies.filter(e=>e&&typeof e.id==='string'&&validPosition(e)&&
   ['pur','seek','zombie'].includes(e.type)).slice(0,MAX_ENEMIES):[];
 w.spawned=Array.isArray(w.spawned)?w.spawned.filter(x=>typeof x==='string').slice(-2500):[];
 w.stories=Array.isArray(w.stories)?w.stories.filter(e=>e&&typeof e.id==='string'&&STORY_TYPES.has(e.kind)&&validPosition(e)).slice(-MAX_STORIES):[];
 w.eventsNext=Number.isInteger(w.eventsNext)?Math.max(1,w.eventsNext):1;
 w.version=Number.isInteger(w.version)?w.version:0;
 return w;
}
export function worldPublic(w){
 return{gameMode:w.gameMode,day:w.day,clock:w.clock,epoch:w.epoch,resetCount:w.resetCount,resetInterval:w.resetInterval,
 nextResetDay:w.nextResetDay,quest:w.quest,proofs:w.proofs.length,sentences:w.sentences.length,
 resources:{...w.resources},tr:{...w.tr},ending:w.ending,version:w.version,
 phrase:w.phrase,difficulty:w.difficulty,x:w.x,y:w.y,floor:w.floor};
}
function advanceQuest(room){
 const w=room.world,g=GOALS[w.difficulty]||GOALS.archivist;
 if(w.quest===5&&w.day>=g.minDay&&w.proofs.length>=g.proofs&&w.sentences.length>=g.sentences){
   w.quest=6;w.version++;return true;
 }
 return false;
}
function plausibleQuest(w,n){
 const goals=GOALS[w.difficulty]||GOALS.archivist;
 if(n!==w.quest+1||n>5)return false;
 if(n===2&&(w.day<goals.indexDay||w.sentences.length<goals.sentences))return false;
 if(n===4&&w.day<goals.shelfDay)return false;
 return true;
}
export class SharedWorld {
 constructor(room,broadcast,changed){
  this.room=room;this.broadcast=broadcast;this.changed=changed;
  this.lastTick=Date.now();this.lastReport=0;
  initShared(room);
 }
 touch(){this.room.world.version++;this.changed?.()}
 emit(msg){this.broadcast(this.room,msg)}
 report(){const w=this.room.world;this.emit({type:'world',world:worldPublic(w)})}
 initial(){return {world:worldPublic(this.room.world),enemies:this.room.world.enemies,stories:this.room.world.stories}}
 claim(player,msg){
  const w=this.room.world,id=String(msg.key||''),kind=msg.kind;
  if(w.gameMode!=='story'||!VALID_KEY.test(id)||w.ending)return false;
  if(kind==='sentence'||kind==='proof'){
    const arr=kind==='sentence'?w.sentences:w.proofs;
    if(arr.includes(id)||arr.length>=4096)return false;
    arr.push(id);this.touch();advanceQuest(this.room);this.report();
    return true;
  }
  if(kind==='quest'){
    const n=Number(msg.step);
    if(!Number.isInteger(n)||!plausibleQuest(w,n))return false;
    w.quest=n;this.touch();advanceQuest(this.room);this.report();return true;
  }
  if(kind==='complete'){
    if(w.quest!==6||w.ending)return false;
    w.ending=true;this.touch();this.report();
    this.emit({type:'ending',by:player.id,day:w.day,difficulty:w.difficulty});return true;
  }
  return false;
 }
 resources(player,msg){
  const w=this.room.world,delta=msg.delta;
  if(!delta||typeof delta!=='object'||Array.isArray(delta))return;
  if(Date.now()-(player.lastResources||0)<100)return;
  player.lastResources=Date.now();let valid=false;
  for(const k of RESOURCE_KEYS){
    const n=delta[k];if(!Number.isInteger(n)||!n)continue;
    if(Math.abs(n)>20)continue;
    const old=w.resources[k],next=bound(old+n,0,LIMITS[k]);
    if(next!==old){w.resources[k]=next;valid=true}
  }
  if(msg.tr&&typeof msg.tr==='object'&&!Array.isArray(msg.tr)){
    for(const[k,v]of Object.entries(msg.tr).slice(0,12)){
      if(/^[a-z]{1,32}$/.test(k)&&v===true&&!w.tr[k]){w.tr[k]=true;valid=true}
    }
  }
  if(valid){this.touch();this.emit({type:'resources',resources:{...w.resources},tr:{...w.tr},version:w.version})}
 }
 addRoomEnemy(player){
  const w=this.room.world;if(w.gameMode!=='story'||!validPosition(player)||w.enemies.length>=MAX_ENEMIES)return;
  const key=coordKey(player.x,player.y,player.floor)+'|'+w.epoch;
  if(w.spawned.includes(key))return;
  if(w.spawned.length>=2500)return;
  w.spawned.push(key);
  const baseX=Math.round(player.x/16)*16,baseY=Math.round(player.y/16)*16;
  // A modest shared enemy population: persistent deaths, seeded appearance,
  // same cast for every visitor and every rejoin to the room.
  for(let i=0;i<2;i++){
    if(seeded(key,i)<(i===0?.40:.32))continue;
    const a=seeded(key,i+4)*Math.PI*2,rad=1.4+seeded(key,i+7)*.7;
    const type=i===0?'pur':'seek';
    w.enemies.push({id:'npc:'+key+':'+i,x:baseX+Math.cos(a)*rad,
      y:baseY+Math.sin(a)*rad,f:a,floor:player.floor,type,hp:type==='pur'?6:3,
      dead:false,region:key,cx:baseX,cy:baseY,lastAttack:0});
  }
  this.touch();this.emit({type:'enemies',enemies:w.enemies});
 }
 shoveEnemy(p,msg){
  const w=this.room.world,mode=msg.mode;
  if(w.ending||!p.active||p.falling||!['push','throw'].includes(mode))return false;
  const e=w.enemies.find(q=>q.id===msg.targetId&&!q.dead);
  if(!e||e.floor!==p.floor||e.knock)return false;
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
  if(d<.2||d>(mode==='throw'?1.63:2.1))return false;
  if((dx*Math.cos(p.f)+dy*Math.sin(p.f))/d<(mode==='throw'?.77:.64))return false;
  const faceX=Math.cos(p.f),faceY=Math.sin(p.f);
  e.knock={dx:faceX,dy:faceY,remaining:mode==='throw'?3.2:1.3,mode};
  e.hit=1;this.touch();this.emit({type:'enemies',enemies:w.enemies});
  this.emit({type:'shove',fromId:p.id,targetId:e.id,kind:'enemy',
    mode,floor:e.floor,dx:faceX,dy:faceY});
  return true;
 }
 /* Server-owned rope: only gallery guardrails, never arbitrary coordinates
    supplied by the client. This keeps tied enemies consistent in co-op. */
 ropeEnemy(p,msg){
  const w=this.room.world,mode=msg.mode,now=Date.now();
  if(w.ending||!p.active||p.falling||!['tie','untie'].includes(mode)||
    now-(p.lastRope||0)<600)return false;
  const e=w.enemies.find(q=>q.id===msg.targetId);
  if(!e||e.floor!==p.floor)return false;
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
  if(d<.20||d>2.15||(dx*Math.cos(p.f)+dy*Math.sin(p.f))/d<.50)return false;
  if(mode==='tie'){
    if(e.hanging||(p.rope??2)<1||e.knock)return false;
    const rx=e.x-e.cx,ry=e.y-e.cy,r=Math.hypot(rx,ry);
    // Server-owned enemies inhabit galleries. An existing shaft guard is the
    // only approved anchor; never let clients hang them in midair or walls.
    if(r<1.38||r>3.1)return false;
    e.x=e.cx+rx/r*1.73;e.y=e.cy+ry/r*1.73;
    e.hanging=true;e.hangT=0;e.knock=null;e.hangFloor=e.floor;
    p.rope=(p.rope??2)-1;
  }else{
    if(!e.hanging)return false;
    e.hanging=false;e.dead=true;e.hp=0;e.hangT=0;
    p.rope=Math.min(9,(p.rope??2)+1);
  }
  p.lastRope=now;
  this.touch();
  this.emit({type:'enemies',enemies:w.enemies});
  this.emit({type:'rope',by:p.id,targetId:e.id,mode,
    floor:e.floor,remaining:p.rope});
  return true;
 }
 combat(p,msg){
  const w=this.room.world;if(w.ending||w.gameMode==='impostor')return;
  const now=Date.now();
  if(now-(p.lastCombat||0)<300)return;
  const e=w.enemies.find(q=>q.id===msg.id&&!q.dead);
  if(!e||e.floor!==p.floor)return;
  if(w.gameMode==='horde'&&e.type!=='zombie')return;
  const tool=String(msg.weapon||'press');
  if(!['press','rod','torch','oil'].includes(tool))return;
  if(tool==='oil'&&w.resources.oil<1)return;
  const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);
  const reach=tool==='rod'?2.1:tool==='torch'?1.65:tool==='oil'?4.0:1.35;
  if(d>reach+.25)return;
  const angle=Math.atan2(dy,dx),aim=Math.atan2(Math.sin(angle-p.f),Math.cos(angle-p.f));
  if(Math.abs(aim)>(tool==='rod'?.40:tool==='oil'?.55:.80))return;
  p.lastCombat=now;e.hp-=tool==='rod'?1:tool==='oil'?2:2;
  if(e.hp<=0){
    e.hp=0;e.dead=true;
    if(e.type==='pur')w.resources.type=bound(w.resources.type+3,0,LIMITS.type);
    else if(e.type==='zombie')w.resources.type=bound(w.resources.type+1,0,LIMITS.type);
    else w.resources.oil=bound(w.resources.oil+2,0,LIMITS.oil);
    this.emit({type:'resources',resources:{...w.resources},tr:{...w.tr}});
  }
  this.touch();this.emit({type:'enemies',enemies:w.enemies});
  this.emit({type:'combat',action:e.dead?'kill':'hit',id:e.id,by:p.id,kind:e.type});
 }
 storyStart(p,msg){
  const w=this.room.world,kind=String(msg.kind||''),id=String(msg.id||'');
  if(!STORY_TYPES.has(kind)||!/^story:[a-z0-9-]{3,42}$/.test(id)||!validPosition(msg)||w.stories.length>=MAX_STORIES)return;
  if(p.floor!==msg.floor||Math.hypot(p.x-msg.x,p.y-msg.y)>9)return;
  if(w.stories.some(x=>x.id===id))return;
  const obj={id,kind,x:msg.x,y:msg.y,floor:msg.floor,state:'idle',choice:null,by:null,epoch:w.epoch};
  w.stories.push(obj);this.touch();this.emit({type:'story',action:'start',story:obj});
 }
 storyChoose(p,msg){
  const w=this.room.world,e=w.stories.find(x=>x.id===msg.id);
  if(!e||e.state!=='idle'||e.floor!==p.floor||Math.hypot(e.x-p.x,e.y-p.y)>3.6)return;
  const choice=msg.choice===0?0:msg.choice===1?1:-1;
  if(choice<0)return;
  e.state='talked';e.choice=choice;e.by=p.id;
  this.touch();this.emit({type:'story',action:'choose',story:e});
 }
 tick(now=Date.now()){
  const room=this.room,w=room.world;
  if(!room.members?.size){this.lastTick=now;return}
  const dt=bound((now-this.lastTick)/1000,0,1);this.lastTick=now;
  if(!w.ending&&dt>0){
    w.clock+=dt;
    // Alternate modes keep their rounds across midnight. Only the shared
    // wall clock advances, so fall recoveries still have a real dawn.
    if(w.gameMode!=='story'&&w.clock>=WORLD_DAY_SECONDS){
      w.day++;w.clock=WORLD_DAY_SECONDS*6/24;
      this.touch();this.emit({type:'dawn',world:worldPublic(w)});
    }
    if(w.gameMode==='story'&&w.clock>=WORLD_DAY_SECONDS){
      w.day++;w.clock=WORLD_DAY_SECONDS*6/24;
      if(w.day>=w.nextResetDay){
        w.resetCount++;w.epoch++;w.resetInterval=2+Math.floor(w.resetCount/2);
        w.nextResetDay=w.day+w.resetInterval;
        w.spawned=[];w.enemies=[];w.stories=[];
        room.broken.clear();room.salvaged.clear();
        this.emit({type:'zone-reset',epoch:w.epoch});
        this.emit({type:'enemies',enemies:[]});
      }
      this.touch();advanceQuest(room);this.emit({type:'dawn',world:worldPublic(w)});
    }
    if(w.gameMode==='story')for(const p of room.members)if(p.active)this.addRoomEnemy(p);
    let moving=false;
    for(const e of w.enemies){
      if(e.hanging){
        e.hangT=(e.hangT||0)+dt;
        if(e.hangT>=16&&!e.dead){e.dead=true;e.hp=0;moving=true;this.touch()}
        continue;
      }
      if(e.dead)continue;
      if(e.knock){
        const k=e.knock,d=Math.min(k.remaining,dt*(k.mode==='throw'?8.0:5.0)),
          nx=e.x+k.dx*d,ny=e.y+k.dy*d,
          before=Math.hypot(e.x-e.cx,e.y-e.cy),
          after=Math.hypot(nx-e.cx,ny-e.cy);
        // Keep opponents within their server-owned gallery. Its existing
        // central shaft has a real hole; going inward across that guard means
        // a visible falling defeat, never a wall-clipping teleport.
        if(after<1.7&&before>=1.7){
          e.x=nx;e.y=ny;e.dead=true;e.hp=0;e.knock=null;
          this.emit({type:'enemy-fall',id:e.id,x:e.x,y:e.y,
            floor:e.floor,kind:e.type,dx:k.dx,dy:k.dy});
          this.emit({type:'enemies',enemies:w.enemies});
          this.touch();moving=true;continue;
        }
        if(after>3.8){e.knock=null}
        else{e.x=nx;e.y=ny;k.remaining-=d;if(k.remaining<=.001)e.knock=null}
        moving=true;continue;
      }
      let nearest=null,best=Infinity;
      for(const p of room.members)if(p.active&&p.floor===e.floor&&
        (w.gameMode!=='horde'||room.modes?.alive.get(p.id)!==false)){
        const dist=Math.hypot(e.x-p.x,e.y-p.y);
        if(dist<best){nearest=p;best=dist}
      }
      if(!nearest)continue;
      if(e.type==='zombie'&&best>11){
        // Pursuit follows a survivor between depot galleries: when the
        // horde is offscreen, the next bookshelves disgorge new zombies.
        e.lostTime=(e.lostTime||0)+dt;
        if(e.lostTime>3.3+(e.wave%4)*.6){
          const cx=Math.round(nearest.x/16)*16,cy=Math.round(nearest.y/16)*16,
            a=Math.atan2(nearest.y-cy,nearest.x-cx)+Math.PI+
              (e.wave+e.x*.1)*.22,r=3.3;
          e.cx=cx;e.cy=cy;e.x=cx+Math.cos(a)*r;
          e.y=cy+Math.sin(a)*r;e.f=a+Math.PI;
          e.lostTime=0;moving=true;
        }
        continue;
      }
      e.lostTime=0;
      if(best>8)continue;
      if(best>1.15&&dt){
        const a=Math.atan2(nearest.y-e.y,nearest.x-e.x);
        const speed=e.type==='zombie'?(.58+Math.min(.85,(e.wave||1)*.085))*(e.mutant==='runner'?1.47:e.mutant==='brute'?.71:1):e.type==='seek'?.88:.63;
        const nx=e.x+Math.cos(a)*dt*speed,
              ny=e.y+Math.sin(a)*dt*speed;
        const r=Math.hypot(nx-e.cx,ny-e.cy);
        if(r<3.85&&(e.type!=='zombie'||r>1.82)){
          e.x=nx;e.y=ny;e.f=a;moving=true;
        }
      }
      if(best<1.2&&now-(e.lastAttack||0)>(e.type==='zombie'?1200:2000)){
        e.lastAttack=now;
        if(e.type==='zombie'){
          const remaining=room.modes?.hordeDamage(nearest,6+Math.floor((e.wave||1)/2));
          if(remaining!==null)this.emit({type:'mode-damage',id:nearest.id,
            by:e.id,health:remaining});
        }else this.emit({type:'damage',id:nearest.id,by:e.id,
          health:e.type==='pur'?5:2,sanity:e.type==='seek'?5:1});
        moving=true;
      }
    }
    if(moving&&now-this.lastReport>=250)this.emit({type:'enemies',enemies:w.enemies});
    if(now-this.lastReport>=1000){this.lastReport=now;this.report();this.changed?.()}
  }
 }
}
