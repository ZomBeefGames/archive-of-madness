import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game JavaScript must exist');
function between(start,end){
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing production source range: '+start);
  return script.slice(a,b);
}
const production=[
  between('function recordCorpse(','Object.assign(ENCS,'),
  between('function keepDead(','function dropType('),
  between('const WNAME=','function doSwing('),
  between('function coatTailDepth(','/* a leg from the hip')
].join('\n');

function setup(){
  const G={x:0,y:0,ang:0,day:1,floor:1,gal:'g1',inRoom:true,corpses:{},wcorpse:{},
    corpseSeq:0,looted:new Set(),searchedBodies:0,ents:[],tr:{},torches:0,
    torchTime:0,weapon:'press',oil:0,incense:0,type:0,frags:0};
  const WD={key:'cached'},ME={type:'me'},notes=[],other=[],effects=[];
  let blocked=false;
  const ctx=vm.createContext({G,WD,ME,P:24,PS:1.35/60,
    placeOf(x){return x<10?{kind:'g',gid:'g1'}:{kind:'a'}},
    worldDead(){return other},
    cast(){return blocked?{t:0.25}:null},
    snd(){},rememberSentence(){},sfx(s){effects.push(s)},openNote:(title,content,reward)=>notes.push({title,content,reward}),
    hashStr(str){let h=2166136261;for(const ch of str)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0},
    prng(seed){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}},
    angDiff(a,b){let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d< -Math.PI)d+=2*Math.PI;return d}
  });
  vm.runInContext(production,ctx);
  return {G,WD,ME,notes,other,effects,run:code=>vm.runInContext(code,ctx),block:on=>blocked=on};
}

test('Purifier corpse yields an equipable torch once, including after room revisit',()=>{
  const s=setup(),e={type:'pur',x:1,y:0.2,f:0,dead:0.001};s.G.ents=[e];
  s.run('keepDead("pur",G.ents[0])');
  assert.equal(s.run('bodyTarget()'),e);
  assert.equal(s.run('searchBody(bodyTarget())'),true);
  assert.equal(s.G.torches,1);assert.equal(s.G.weapon,'torch');assert.equal(s.run('torchLit()'),true);
  assert.match(s.notes[0].reward,/PURIFIER TORCH/);assert.equal(s.G.searchedBodies,1);
  assert.equal(s.run('searchBody(G.ents[0])'),false);
  const saved=s.G.corpses['g1|1'][0];assert.equal(saved.lootId,e.lootId);
  s.G.ents=[{type:'pur',x:1,y:0.2,f:0,dead:9,lootId:saved.lootId}];
  assert.equal(s.run('bodyTarget()'),null);
});

test('Catwalk deaths persist as searchable bodies; other floors are not searchable',()=>{
  const s=setup(),e={type:'pur',x:21,y:0,f:0,dead:0.001};
  s.G.ents=[e];s.run('keepDead("pur",G.ents[0])');
  assert.equal(Object.values(s.G.wcorpse).length,1);assert.equal(s.WD.key,null);
  const saved=Object.values(s.G.wcorpse)[0][0];assert.equal(saved.lootId,e.lootId);
  s.G.x=20;s.G.inRoom=false;s.G.ents=[];s.other.push({...e,lvl:1});
  assert.equal(s.run('bodyTarget()'),null);
  s.other[0].lvl=0;assert.equal(s.run('bodyTarget().lootId'),e.lootId);
  assert.equal(s.run('searchBody(bodyTarget())'),true);
  assert.equal(s.run('bodyTarget()'),null);
});

test('Searching requires range, facing, and clear line of sight',()=>{
  const s=setup();s.G.ents=[{type:'fig',pose:'dead',x:1,y:0,lootId:'librarian'}];
  s.G.ang=Math.PI;assert.equal(s.run('bodyTarget()'),null);
  s.G.ang=0;s.block(true);assert.equal(s.run('bodyTarget()'),null);
  s.block(false);assert.ok(s.run('bodyTarget()'));
  s.G.ents[0].x=2;assert.equal(s.run('bodyTarget()'),null);
});

test('Coat tails sit above trousers from rear and front',()=>{
  const s=setup(),person={x:2,y:0,f:0};
  assert.ok(s.run('coatTailDepth(ME,true)')<-.03);
  assert.ok(s.run('coatTailDepth(ME,false)')<-.03);
  assert.ok(s.run('coatTailDepth({x:2,y:0,f:0},true)')<-.03);
  s.G.x=5;assert.ok(s.run('coatTailDepth({x:2,y:0,f:0},true)')>.012);
  assert.match(script,/e\._d=dx\*dx\+dy\*dy/,'parts use actual depth sorting');
});

test('Seekers yield extra supplies; burning bodies can be empty; neither can be farmed',()=>{
  const s=setup(),seek={type:'seek',x:1,y:0,f:0,dead:5,lootId:'seek-one'};
  s.G.ents=[seek];assert.equal(s.run('searchBody(G.ents[0])'),true);
  assert.ok(s.G.oil>0||s.G.type>0);
  assert.equal(s.run('searchBody(G.ents[0])'),false);
  const burnt={type:'fig',pose:'dead',x:1,y:0,f:0,burnt:true,lootId:'burnt-one'};
  s.G.ents=[burnt];assert.equal(s.run('searchBody(G.ents[0])'),true);
  assert.equal(s.run('searchBody(G.ents[0])'),false);
});

test('Torch weapon availability and timer are tied to recovered supply',()=>{
  const s=setup();assert.equal(s.run('hasWeapon("torch")'),false);
  s.G.ents=[{type:'pur',x:1,y:0,f:0,dead:9,lootId:'torch-one'}];s.run('searchBody(G.ents[0])');
  assert.equal(s.run('hasWeapon("torch")'),true);
  assert.equal(s.run('torchLit()'),true);
  s.G.weapon='oil';assert.equal(s.run('torchLit()'),false);
  s.G.weapon='torch';s.G.torchTime=0;assert.equal(s.run('torchLit()'),false);
});
