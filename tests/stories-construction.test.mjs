import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function part(a,b){
  const i=script.indexOf(a),j=script.indexOf(b,i);
  assert.ok(i>=0&&j>i,'Missing production source '+a);
  return script.slice(i,j);
}
const construction=part('/* Portable boards share','function standingZone(){');
const stories=part('const TALES=[','const ECHO_MAX=');
const solo=part('const ENCS={','const ENC=');
const scenes=part('Object.assign(ENCS,{','function sceneUpd(');
const art=part('const ZSPR={','function zoneSprite(');
function constructionGame(){
  const G={state:'play',floor:0,x:2,y:0,ang:0,zoneState:new Map(),resetEpoch:1,type:0,incense:0};
  const zones=new Map(),sounds=[],notes=[];
  const zone=(key)=>{if(!zones.has(key))zones.set(key,{key,type:'barricaded',side:1,
    breached:false,salvaged:false});const z=zones.get(key);G.zoneState.set(key,z);return z};
  const context=vm.createContext({G,NET:{ready:false},P:16,A:5*Math.cos(Math.PI/6),
    BUILD:undefined,
    galleryZone:(i,j)=>zone('1|g|'+i+','+j+'|0'),
    crossingAt:()=>({stairs:false}),
    crossingZone:()=>null,
    inWell:()=>false,walkable:()=>true,
    angDiff:(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;return d},
    sfx:s=>sounds.push(s),openNote:(...s)=>notes.push(s)});
  // BUILD is the real const in the VM; do not shadow it with the global fixture.
  delete context.BUILD;
  vm.runInContext(construction,context,{timeout:10000});
  return {G,zones,sounds,notes,run:code=>vm.runInContext(code,context,{timeout:10000})};
}
function storyGame(){
  const G={frags:0,type:16,oil:10,sanity:100,incense:1,echo:0,health:100,
    tr:{},resetEpoch:1,x:1,y:1,gal:'0,0',floor:0,phrase:'the truth remained',
    proofs:0,sins:[],fires:[],inRoom:true,room:{i:0,j:0}};
  const rigs=Object.fromEntries(['cartographer','surgeon','warden','binder','bellkeeper',
    'orphan','exile','glassmaker','peddler','weep','count','sleep'].map(name=>[name,{name}]));
  const context=vm.createContext({G,ECHO_MAX:6,ENCRIG:rigs,FIGRIG:[{name:'one'},{name:'two'},{name:'three'}],
    sceneCast:(c,poses,models)=>poses.map((pose,i)=>({type:'fig',x:c.x+i,y:c.y,pose,rig:models[i%models.length]})),
    voice:()=>{},sfx:()=>{},placeWords:()=> 'on this floor ',
    eventProof:()=>{G.proofs++;return true},
    rememberSentence:()=>{G.sentences=(G.sentences||0)+1;return true},
    galleryZone:()=>({type:'burning'})});
  vm.runInContext(stories+'\n'+solo+'\n'+scenes,context);
  return {G,run:code=>vm.runInContext(code,context,{timeout:10000})};
}
test('complete game and new pure mechanics parse as JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(construction));
});
test('destroyed original Library boards can be salvaged only once and placed elsewhere',()=>{
  const t=constructionGame();
  const key='1|g|0,0|0';t.run("galleryZone(0,0)");
  assert.equal(t.run("buildOperate('breach',{key:'"+key+"'})"),true);
  assert.equal(t.run("buildOperate('salvage',{key:'"+key+"'})"),true);
  assert.equal(t.run('BUILD.planks'),1);
  t.run("buildOperate('salvage',{key:'"+key+"'})");
  assert.equal(t.run('BUILD.planks'),1);
  assert.equal(t.run('buildPlaceOrReinforce()'),true);
  assert.equal(t.run('BUILD.barriers.size'),1);
  assert.equal(t.run('BUILD.planks'),0);
  const b=t.run('[...BUILD.barriers.values()][0]');
  assert.ok(t.run('placedBlockAt('+b.x+','+b.y+',.05)'),'placed boards are solid');
  assert.equal(t.run('buildRead()'),true,'the same Read command retrieves the moved barricade');
  assert.equal(t.run('BUILD.barriers.size'),0);
  assert.equal(t.run('BUILD.planks'),1);
  assert.equal(t.G.zoneState.get(key).salvaged,true);
});
test('three extra reclaimed barricades become indestructible; manual retrieval returns all wood',()=>{
  const t=constructionGame();
  for(let i=0;i<4;i++){
    const key='1|g|'+i+',0|0';
    t.run('galleryZone('+i+',0)');
    t.run("buildOperate('breach',{key:'"+key+"'})");
    t.run("buildOperate('salvage',{key:'"+key+"'})");
  }
  assert.equal(t.run('BUILD.planks'),4);
  t.run('buildPlaceOrReinforce()');
  for(let i=1;i<=3;i++){
    t.run('buildPlaceOrReinforce()');
    assert.equal(t.run('[...BUILD.barriers.values()][0].level'),i);
  }
  const id=t.run('[...BUILD.barriers.values()][0].id');
  for(let i=0;i<10;i++)t.run("buildOperate('hit',{id:'"+id+"'})");
  assert.equal(t.run('BUILD.barriers.size'),1);
  assert.equal(t.run('BUILD.planks'),0);
  t.run('buildRead()');
  assert.equal(t.run('BUILD.planks'),4);
  assert.equal(t.run('BUILD.barriers.size'),0);
});
test('unreinforced barricade breaks from attacks and leaves collectible wreckage',()=>{
  const t=constructionGame();t.run('BUILD.planks=1;buildPlaceOrReinforce()');
  const id=t.run('[...BUILD.barriers.values()][0].id');
  for(let i=0;i<3;i++)t.run("buildOperate('hit',{id:'"+id+"'})");
  assert.equal(t.run('BUILD.barriers.size'),0);
  assert.equal(t.run('BUILD.wrecks.size'),1);
  t.run('buildRead()');
  assert.equal(t.run('BUILD.wrecks.size'),0);
  assert.equal(t.run('BUILD.planks'),1);
});
test('four new complete five-page biographies exist without erasing the earlier stories',()=>{
  const t=storyGame(),tales=t.run('TALES.map(q=>({name:q.name,frags:q.frags}))');
  assert.equal(tales.length,10);
  for(const tale of tales){assert.equal(tale.frags.length,5,tale.name);for(const f of tale.frags)assert.ok(f.length>55)}
  for(const name of ['Milo','Ada','Jun','Salma'])assert.ok(tales.some(t=>t.name.startsWith(name)));
});
test('five new people and five group scenes carry real choices and readable narratives',()=>{
  const t=storyGame();
  const solos=['binder','bellkeeper','orphan','exile','glassmaker'];
  const groups=['quarantine','council','pilgrims','shelter','ledgerfire'];
  for(const id of solos){
    assert.equal(t.run("typeof ENCS."+id+".A"),'function');
    assert.equal(t.run("typeof ENCS."+id+".B"),'function');
    assert.ok(t.run("ENCS."+id+".text()").length>65);
  }
  for(const id of groups){
    assert.equal(t.run("ENCS."+id+".scene"),true);
    assert.ok(t.run("ENCS."+id+".text()").length>65);
    const members=t.run("ENCS."+id+".build({x:5,y:6})");
    assert.ok(members.length>=3);
    assert.ok(members.every(p=>p.type==='fig'&&p.rig));
  }
});
test('two choices have different lasting effects in the new stories',()=>{
  const a=storyGame(),b=storyGame();
  a.run("ENCS.binder.A({enc:'binder',x:1,y:1})");
  b.run("ENCS.binder.B({enc:'binder',x:1,y:1})");
  assert.equal(a.G.proofs,1);
  assert.equal(b.G.proofs,0);
  assert.equal(b.G.type,22);
  assert.equal(b.G.sins.length,1);
  const c=storyGame();c.run("ENCS.pilgrims.A({enc:'pilgrims',x:1,y:1})");
  assert.equal(c.G.sentences,1);
  assert.equal(c.G.proofs,1);
});
test('new salvage sprite artwork varies visibly over all four reinforcement tiers',()=>{
  const ctx=vm.createContext({
    buildCard(rows){
      assert.ok(rows.every(row=>/^[.ktycYGgnorRwfS]+$/.test(row)),'invalid ink/paper palette symbol');
      return {w:Math.max(...rows.map(row=>row.length)),h:rows.length,rows};
    }
  });
  vm.runInContext(art,ctx);
  const cards=vm.runInContext('BARRICADE_CARDS',ctx);
  assert.equal(cards.length,4);
  assert.ok(cards.every(c=>c.w>=25&&c.h>=24));
  assert.equal(new Set(cards.map(c=>c.rows.join('|'))).size,4);
  assert.ok(vm.runInContext('SPLINTER_CARD.rows.length',ctx)>5);
});
