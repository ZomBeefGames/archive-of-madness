import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'actual game code');
const start=script.indexOf('function gridRows('),end=script.indexOf('/* ---- the far-off events.',start);
assert.ok(start>=0&&end>start,'real puppet painter and avatar creator');
const production=script.slice(start,end);
function setup(){
  const G={x:0,y:0,ang:0,time:2,pitch:0,oil:8,state:'play',weapon:'press',
    swing:0,hurtCd:0,flash:0,climbT:0,incense:0};
  const palette={k:'#161211',c:'#70502f',y:'#debb4b',Y:'#fceabb',o:'#ff7a29',
    n:'#aaaaaa',t:'#603d23',T:'#ad8155',f:'#eebb21',p:'#160f0c',w:'#ffffff',
    m:'#502122',S:'#a77649',G:'#656560',g:'#444440',r:'#a52516',R:'#792214'};
  const storage=new Map();
  const context=vm.createContext({G,PAL:palette,LX:0,LY:0,FOG:[1,1,1,1],AIRLV:3,FH:2.15,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},
    window:{prompt:()=> 'MORGAN THE THIRD'},
    rgb:x=>Array.isArray(x)?x:[parseInt(x.slice(1,3),16),parseInt(x.slice(3,5),16),parseInt(x.slice(5,7),16)],
    placeOf:()=>({kind:'g'}),
    smooth:p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)},
    angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;return d}
  });
  vm.runInContext(production,context,{timeout:12000});
  return{G,storage,run:code=>vm.runInContext(code,context,{timeout:12000})};
}
test('full game script and real custom paper rig painter parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(production));
});
test('all requested character attributes are present, with safe canonical values',()=>{
  const t=setup();
  assert.deepEqual(Array.from(t.run('CHARACTER_FIELDS')),
    ['name','gender','age','outfit','coat','pants','skin','hair']);
  assert.deepEqual(Array.from(t.run('APPEARANCE.gender')),['MALE','FEMALE','NONBINARY']);
  assert.equal(t.run('APPEARANCE.outfit.length'),4);
  assert.ok(t.run('APPEARANCE.coat.length')>=8);
  assert.ok(t.run('APPEARANCE.skin.length')>=6);
  const bad=t.run('normalCharacter({name:"?NAME<>",age:350,gender:9,outfit:-5,coat:999,skin:-1})');
  assert.equal(bad.name,'NAME');assert.equal(bad.age,90);assert.equal(bad.gender,0);
  assert.equal(bad.outfit,0);assert.equal(bad.coat,0);assert.equal(bad.skin,2);
});
test('real paper rig changes with every presentation and clothing silhouette',()=>{
  const t=setup();
  for(let gender=0;gender<3;gender++)for(let outfit=0;outfit<4;outfit++){
    const r=t.run('characterRig({...CHAR,gender:'+gender+',outfit:'+outfit+'})');
    assert.ok(r.head?.g?.col.some(Boolean),'drawn face '+gender+'/'+outfit);
    assert.ok(r.skirt?.g?.col.some(Boolean),'drawn fabric '+gender+'/'+outfit);
    assert.ok(r.chest?.g?.col.some(Boolean),'drawn torso '+gender+'/'+outfit);
    if(outfit===1)assert.ok(r.hood?.g?.col.some(Boolean),'painted hood must exist');
    else assert.equal(r.hood,undefined);
  }
  const outfits=t.run('[0,2,3].map(outfit=>characterRig({...CHAR,outfit}).skirt.g.h)');
  assert.equal(new Set(outfits).size,3,'long coat, waistcoat and robe have distinct silhouettes');
});
test('every complexion, coat, trouser and hair palette visibly changes actual pixel colors',()=>{
  const t=setup();
  for(const k of ['coat','pants','skin','hair']){
    const colors=t.run('APPEARANCE.'+k+'.map((_,i)=>{const r=characterRig({...CHAR,['+JSON.stringify(k)+']:i});return ('
      +(k==='coat'?'r.chest.g':k==='pants'?'r.thigh.g':'r.head.g')
      +').col.filter(Boolean).map(c=>c.join(",")).join("|")})');
    assert.equal(new Set(colors).size,colors.length,k+' palette should visibly alter the figure');
  }
});
test('age paints older eyes and greying hair while not changing health or game balance',()=>{
  const t=setup();
  const younger=t.run('characterRig({...CHAR,age:21}).head.g.col.filter(Boolean).map(c=>c.join(",")).join("|")');
  const older=t.run('characterRig({...CHAR,age:78}).head.g.col.filter(Boolean).map(c=>c.join(",")).join("|")');
  assert.notEqual(younger,older,'older and younger portraits should differ');
  assert.equal(t.G.health,undefined,'appearance must not add health/damage attributes');
});
test('changing name, age, gender and outfit updates the player model and saves locally',()=>{
  const t=setup(),first=t.run('ME.rig');
  t.run("changeCharacter('name',1)");
  assert.equal(t.run('CHAR.name'),'MORGAN THE THIRD');
  t.run("changeCharacter('gender',1)");
  assert.equal(t.run('CHAR.gender'),1);
  t.run("changeCharacter('age',1)");
  assert.equal(t.run('CHAR.age'),29);
  t.run("changeCharacter('outfit',1)");
  assert.equal(t.run('CHAR.outfit'),1);
  assert.notStrictEqual(t.run('ME.rig'),first);
  const state=JSON.parse(t.storage.get('aom.character.v1'));
  assert.equal(state.name,'MORGAN THE THIRD');assert.equal(state.gender,1);
  assert.equal(t.run('ME.rig.hood.g.w')>0,true);
  const parts=t.run("(()=>{const p=[];meLayers(p);return p})()");
  assert.ok(parts.length>20);
  assert.ok(parts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z0)));
});


test('rear hair covers the crown across genders, ages and outfits',()=>{
  const t=setup();
  for(const gender of [0,1,2])for(const age of [22,73])for(const outfit of [0,1,2,3]){
    const v=t.run("(()=>{"+
      "const p={...CHAR,gender:"+gender+",age:"+age+",outfit:"+outfit+",skin:0,hair:0};"+
      "const r=characterRig(p),g=r.head.bk,sc=g.scale||1;"+
      "let dark=0,skin=0,seen=0;"+
      "for(let y=5;y<=11;y++)for(let x=4;x<=11;x++){"+
      "const c=g.col[(Math.round((y+.5)*sc))*g.w+Math.round((x+.5)*sc)];"+
      "if(!c)continue;seen++;if(c[0]<145&&c[1]<145)dark++;else skin++}"+
      "const layers=[],q=ME.rig;ME.rig=r;meLayers(layers);ME.rig=q;"+
      "return {seen,dark,skin,rearHeads:layers.filter(p=>p.rearHead).length,"+
      "valid:layers.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z0))};})()");
    assert.ok(v.seen>=35,'crown has visible pixels '+gender+'/'+age+'/'+outfit);
    assert.ok(v.dark/v.seen>0.72,'rear hair must not show bald scalp '+JSON.stringify({gender,age,outfit,...v}));
    assert.equal(v.rearHeads,1,'exactly one marked rear-head layer');
    assert.equal(v.valid,true);
  }
});
test('rear head remains detailed and correctly inked after rotation',()=>{
  const t=setup();
  const rotated=t.run("(()=>{const h=characterRig({...CHAR,skin:0,hair:0}).head;"+
    "return [-24,-9,0,9,24].map(a=>{const card=partAt(h,a).card;"+
    "const pixels=Array.from({length:card.w*card.h},(_,i)=>i*4).filter(i=>card.back[i+3]>0);"+
    "const dark=pixels.filter(i=>card.back[i]<145&&card.back[i+1]<145).length;"+
    "return {total:pixels.length,dark,frontVisible:pixels.filter(i=>card.front[i+3]>0).length};});})()");
  for(const a of rotated){
    assert.ok(a.total>100,'back head should have an opaque cut-out');
    assert.ok(a.dark/a.total>.45,'back-of-head should have substantial hair, not bare skin');
    assert.equal(a.total,a.frontVisible,'front/back should share the outline');
  }
  assert.match(script,/rearHead:e===ME&&p===\(e\.rig\|\|MERIG\)\.head/);
  assert.match(script,/THIRD&&j===0&&e\.rearHead/);
});
