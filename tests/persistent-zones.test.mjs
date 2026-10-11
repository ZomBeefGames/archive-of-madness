import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'The game script must exist');
function part(a,b){
  const i=script.indexOf(a),j=script.indexOf(b,i);
  assert.ok(i>=0&&j>i,'Missing production range '+a);
  return script.slice(i,j);
}
// Use the real geometry, deterministic zone generator, interactions, sprite
// placement, hazard and reset logic. Stub only canvas cards, audio and unrelated UI.
const production=[
  part('const R=5,','const view='),
  part('function hashStr(','/* cast one ray'),
  part('const ZSPR=','const ALPHA='),
  part('function zoneHazards(dt){','function update(dt){'),
  part('const DAYLEN=480','function clockText('),
  part('function newDay(){','function blackout(){')
].join('\n');
function setup(){
  const G={
    resetEpoch:1,resetCount:0,day:1,lastResetDay:1,
    nextResetDay:3,resetInterval:2,zoneState:new Map(),zoneVisited:new Set(),
    startGallery:'-99,-99:0',sentencesFound:0,seenSentences:new Set(),floor:0,
    x:0,y:0,ang:0,inRoom:true,room:{i:0,j:0,cx:0,cy:0},tr:{},
    type:0,incense:0,oil:0,health:100,sanity:100,time:0,frags:0,clock:0,
    q:0,echo:0,corpses:{old:[{}]},wcorpse:{old:[{}]},
    looted:new Set(['one']),corpseSeq:1,fires:[{t:5}],over:{old:1},
    meal:{kind:'bread'},fedAt:1,phantoms:[{}],journal:false,sleepCd:2
  };
  const LAMPS={key:'old'},WD={key:'old'},BG={acts:[1],t:3},
    ENC={list:[{}],t:1},texCache=new Map([['old',1]]),
    burned=new Set(['shelf']),notes=[],sounds=[],fireLights=[],fireCards=[{w:9,h:10},{w:9,h:10},{w:9,h:10}];
  let spawns=0;
  const context=vm.createContext({
    G,LAMPS,WD,BG,ENC,texCache,burned,FIREC:fireCards,FIREL:fireLights,LX:0,LY:0,
    buildCard(rows){return{w:Math.max(...rows.map(r=>r.length)),h:rows.length}},
    snd(k){sounds.push(k)},sfx(s){sounds.push(s)},
    openNote:(...args)=>notes.push(args),
    angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;return d},
    spawnRoom(){spawns++},setTimeout(){}
  });
  vm.runInContext(production,context);
  return{G,LAMPS,WD,BG,ENC,texCache,burned,notes,sounds,fireLights,
    spawns:()=>spawns,run:js=>vm.runInContext(js,context)};
}

test('entire game script and extracted environmental mechanics parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(production));
});
test('library/gallery variants are deterministic with stable identities during the reset epoch',()=>{
  const s=setup();
  const z=s.run('galleryZone(0,0)');
  assert.strictEqual(s.run('galleryZone(0,0)'),z);
  const examples=new Set();
  for(let i=-35;i<35;i++)for(let j=-5;j<5;j++)
    examples.add(s.run('galleryZone('+i+','+j+').type'));
  assert.ok(['barricaded','burned','burning','normal','refuge','study','confession','obliterated','vault'].every(type=>examples.has(type)), 'expanded deterministic gallery catalogue');
   assert.ok(examples.size>=15,'at least fifteen genuinely varied gallery architectures');
  s.G.startGallery='100,200:0';
  assert.equal(s.run('galleryZone(100,200).type'),'normal','first gallery is guaranteed safe');
});
test('blocked library entrance is solid but the opposite door stays open; Read pries it apart',()=>{
  const s=setup();
  const zone=s.run('galleryZone(0,0)');zone.type='barricaded';zone.side=1;
  s.G.x=3.2;s.G.ang=0;
  assert.equal(s.run('walkable(4.33,0,0.2)'),false);
  assert.equal(s.run('walkable(-4.33,0,0.2)'),true);
  assert.equal(s.run('zoneRead()'),true);
  assert.equal(zone.breached,true);
  assert.equal(s.run('walkable(4.33,0,0.2)'),true);
  assert.match(s.notes[0][0],/BARRICADED DOOR/);
});
test('library caches are one-time and remain opened after returning to the same room',()=>{
  const s=setup();const z=s.run('galleryZone(0,0)');z.type='refuge';
  s.G.x=2.2;s.G.y=2.4;s.G.ang=0;
  assert.equal(s.run('zoneRead()'),true);
  assert.equal(s.G.oil,2);assert.equal(s.G.incense,1);
  assert.equal(z.opened,true);assert.equal(s.run('zoneRead()'),false);
  assert.strictEqual(s.run('galleryZone(0,0)'),z);
  assert.equal(s.G.oil,2);
});
test('community-hub barricades block services but never eliminate the spiral stair',()=>{
  const s=setup();
  const z=s.run('crossingZone(0,0)');z.type='barricaded';
  assert.equal(s.run('isStair(0,0)'),true);
  assert.equal(s.run('isComm(0,0)'),true);
  s.G.inRoom=false;s.G.x=10.5;s.G.y=7.64;s.G.ang=Math.PI;
  assert.equal(s.run('zoneRead()'),true);
  assert.equal(z.breached,true);
  assert.equal(s.run('zoneRead()'),false,'following Read must fall through to stair interaction');
  assert.equal(s.run('isStair(0,0)'),true);
});
test('transit floors retain distinct variants without full hubs, caches cannot be farmed',()=>{
  const s=setup();s.G.floor=1;s.G.inRoom=false;s.G.x=10.5;s.G.y=7.64;s.G.ang=Math.PI;
  assert.equal(s.run('isStair(0,0)'),true);
  assert.equal(s.run('isComm(0,0)'),false);
  const z=s.run('crossingZone(0,0)');assert.equal(z.hub,false);z.type='shrine';
  assert.equal(s.run('zoneRead()'),true);
  assert.equal(s.G.incense,1);
  assert.equal(s.run('zoneRead()'),false,'stairs become available immediately after looting');
  assert.equal(s.G.incense,1);
  s.G.floor=0;assert.notStrictEqual(s.run('crossingZone(0,0)'),z);
});
test('sentence-driven lattice growth does not reroll surviving hub or gallery conditions',()=>{
  const s=setup(),a=s.run('galleryZone(0,0)'),h=s.run('crossingZone(0,0)');
  h.type='vigil';h.opened=true;
  s.G.sentencesFound=3;
  assert.equal(s.run('hubStride()'),6);
  assert.strictEqual(s.run('galleryZone(0,0)'),a);
  assert.strictEqual(s.run('crossingZone(0,0)'),h);
  assert.equal(h.opened,true);
});
test('burning galleries draw persistent animated fire, smoke and light sources',()=>{
  const s=setup();const z=s.run('galleryZone(0,0)');z.type='burning';
  s.G.x=0;s.G.y=0;
  const art=s.run('(()=>{let items=[];galleryDressing(items,0,0);return items})()');
  assert.ok(art.length>=7);
  assert.ok(art.some(p=>p.glow));
  assert.ok(art.some(p=>p.z0>0));
  s.run('addZoneFireLights()');
  assert.ok(s.fireLights.length>=6&&s.fireLights.length<=12,'nearest two burning galleries only');
  assert.match(script,/addZoneDressing\(list\)/);
  assert.match(script,/addZoneFireLights\(\)/);
  assert.match(script,/zone.type==='burned'\|\|zone.type==='burning'/);
});
test('fire hurts near burning shelves, while the doorway and ordinary galleries stay safe',()=>{
  const s=setup();s.run('galleryZone(0,0)').type='burning';
  s.G.x=2;s.G.y=2.6;s.run('zoneHazards(1)');
  assert.ok(s.G.health<100);
  const damaged=s.G.health;
  s.G.x=3.2;s.G.y=0;s.run('zoneHazards(1)');
  assert.equal(s.G.health,damaged,'clear door corridor');
  s.run("galleryZone(0,0).type='normal'");
  s.G.x=2.4;s.G.y=2.6;s.run('zoneHazards(1)');
  assert.equal(s.G.health,damaged);
});
test('ordinary dawn keeps the same conditions; the scheduled reset clears environmental state',()=>{
  const s=setup(),z=s.run('galleryZone(0,0)');
  z.type='barricaded';z.breached=true;z.opened=true;
  s.G.zoneVisited.add(z.key);
  s.run('newDay()');
  assert.equal(s.G.day,2);assert.equal(s.G.justReset,false);
  assert.strictEqual(s.run('galleryZone(0,0)'),z);
  assert.equal(s.G.zoneVisited.size,1);
  assert.equal(s.burned.size,1);
  s.run('newDay()');
  assert.equal(s.G.day,3);assert.equal(s.G.justReset,true);
  assert.equal(s.G.resetEpoch,2);
  assert.equal(s.G.zoneVisited.size,0);assert.equal(s.G.zoneState.size,0);
  assert.equal(s.texCache.size,0);
  assert.equal(s.burned.size,0);
  assert.notStrictEqual(s.run('galleryZone(0,0)'),z);
  assert.equal(s.spawns(),1);
});
test('feature art covers ruined and barricaded hubs, and every non-hub landing class',()=>{
  const s=setup();
  const z=s.run('crossingZone(0,0)');
  const hub=['barricaded','scorched','vigil'];
  for(const type of hub){z.type=type;
    const n=s.run('(()=>{let out=[];crossingDressing(out,0,0);return out.length})()');
    assert.ok(n>0,type)}
  s.G.floor=1;const landing=s.run('crossingZone(0,0)');
  for(const type of ['ash','barricaded','watch','collapsed','shrine']){
    landing.type=type;
    const n=s.run('(()=>{let out=[];crossingDressing(out,0,0);return out.length})()');
    assert.ok(n>0,type)}
});

test('looted crates and cleared warning boards visibly change until reset',()=>{
  const s=setup(),z=s.run('galleryZone(0,0)');z.type='refuge';
  assert.equal(s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.some(q=>q.cards[0]===ZSPR.crate)})()"),true);
  z.opened=true;
  assert.equal(s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.some(q=>q.cards[0]===ZSPR.emptyCrate)})()"),true);
  assert.equal(s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.some(q=>q.cards[0]===ZSPR.crate)})()"),false);
  z.type='barricaded';z.breached=true;
  assert.equal(s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.some(q=>q.cards[0]===ZSPR.warning)})()"),false);
  const h=s.run('crossingZone(0,0)');h.type='barricaded';h.breached=true;
  assert.equal(s.run("(()=>{const p=[];crossingDressing(p,0,0);return p.some(q=>q.cards[0]===ZSPR.warning)})()"),false);
});
test('burning gallery embers rise over time without changing the persistent zone',()=>{
  const s=setup(),z=s.run('galleryZone(0,0)');z.type='burning';
  const a=s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.filter(q=>q.cards[0]===ZSPR.ember).map(q=>q.z0)})()");
  s.G.time+=.9;
  const b=s.run("(()=>{const p=[];galleryDressing(p,0,0);return p.filter(q=>q.cards[0]===ZSPR.ember).map(q=>q.z0)})()");
  assert.equal(a.length,6);assert.equal(b.length,6);
  assert.notDeepEqual([...a],[...b],'fire should look animated');
  assert.strictEqual(s.run('galleryZone(0,0)'),z);
});
test('raycaster firelights cap at two adjacent burning galleries',()=>{
  const s=setup();for(const [i,j] of [[0,0],[1,0],[0,1]])s.run('galleryZone('+i+','+j+').type="burning"');
  s.run('addZoneFireLights()');
  assert.equal(s.fireLights.length,12,'two room sets of three x/y light positions');
});
test('gallery and community barricade labels preserve distinct names and cleared status',()=>{
  const s=setup(),g=s.run('galleryZone(0,0)'),h=s.run('crossingZone(0,0)');
  g.type='barricaded';g.breached=true;
  h.type='barricaded';h.breached=true;
  assert.match(s.run('zoneStatus(galleryZone(0,0))'),/SEALED LIBRARY · BREACHED/);
  assert.match(s.run('zoneStatus(crossingZone(0,0))'),/BARRICADED HUB · BREACHED/);
});


test('all rendered special-room sprites use defined palette symbols',()=>{
  // Run the actual buildCard (rather than our geometry test stub). An unknown
  // symbol used to make the entire game crash during startup on mobile/desktop.
  const paint=part('const PAL=','const purBody=')+'\n'+part('const ZSPR=','const ALPHA=');
  const c=vm.createContext({});
  assert.doesNotThrow(()=>vm.runInContext(paint,c));
  assert.equal(vm.runInContext('Object.keys(ZSPR).length',c)>=12,true);
  assert.equal(vm.runInContext('ZSPR.ember.front.some(n=>n>0)',c),true);
  assert.throws(()=>vm.runInContext("buildCard(['..?.'])",c),/UNKNOWN PAPER PIXEL/);
});
