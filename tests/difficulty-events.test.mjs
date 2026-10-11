import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'real game script');
function part(start,end){
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,'missing source: '+start+' ... '+end);
  return script.slice(a,b);
}
const logic=[
  part('const DIFFICULTIES=','/* ---- the way to your page:'),
  part('const QSTEPS=','function makePage('),
  part('function collectProof(','function zoneRead('),
  part('function newDay(){','function blackout(){'),
  part('const ENCS=','const ENC='),
  part('Object.assign(ENCS,{','function sceneUpd('),
  part('function encChoose(','function encClosed()'),
  part('function useIndex(){','const MEALS='),
  part('function hatchStock(){','function hatchBuy(){')
].join('\n');
function game(mode='archivist'){
  const G={
    difficulty:mode,day:1,state:'play',cutSeen:{index:true},clock:90,resetEpoch:1,
    resetInterval:2,resetCount:0,nextResetDay:1000,lastResetDay:1,
    x:2,y:0,ang:0,inRoom:false,room:{i:0,j:0},floor:0,gal:'0,0',phrase:'the lamp forgot',
    q:5,frags:30,sentencesFound:0,seenSentences:new Set(),
    proofs:0,proofKeys:new Set(),xp:0,met:{},tr:{},echo:1,
    sanity:100,health:100,oil:10,incense:0,type:30,
    time:1,fedAt:-1e9,opened:new Set(),sins:[],fires:[],taleDone:[false],
    journal:false,phantoms:[],sleepCd:0
  };
  const notes=[],FX=[],voices=[];
  const context=vm.createContext({
    G,HUI:{encHover:-1},ECHO_MAX:6,DAYLEN:480,TRINKETS:{},MEALS:{bread:{name:'BREAD',cost:0,desc:'food'}},FULLT:45,
    FIGRIG:[{name:'figure0'},{name:'figure1'},{name:'figure2'}],
    ENCRIG:Object.fromEntries(['peddler','cartographer','surgeon','warden','weep','count','sleep'].map(k=>[k,{name:k}])),
    snd:()=>{},sfx:(...v)=>FX.push(v),voice:(...v)=>voices.push(v),
    setTimeout:()=>{},drawBook:()=>{},closeBook:()=>{},openNote:(...v)=>notes.push(v),
    bioPlan:()=>({g:'0,0',f:0,wall:1,shelf:2,book:8}),placeWords:()=> 'ON THE STAIR ',
    hashStr:()=>13,prng:()=>()=>.39,
    sceneCast:(c,poses,rigs)=>poses.map((pose,i)=>({type:'fig',x:c.x+i,y:c.y,pose,rig:rigs[i%rigs.length]})),
    galleryZone:()=>({type:'burning'}),
    rememberSentence:id=>{if(G.seenSentences.has(id))return false;G.seenSentences.add(id);G.sentencesFound++;return true}
  });
  vm.runInContext(logic,context);
  return {G,FX,notes,voices,run:code=>vm.runInContext(code,context,{timeout:10000})};
}
const MODE_NAMES=['reader','archivist','lost','condemned'];

test('real game script and difficulty/encounter logic parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(logic));
});
test('four difficulty levels have strictly increasing days, proof, and sentence requirements',()=>{
  const t=game();const stages=MODE_NAMES.map(k=>t.run('difficultyRules('+JSON.stringify(k)+')'));
  assert.deepEqual(stages.map(q=>q.minDay),[3,5,8,12]);
  assert.deepEqual(stages.map(q=>q.proofs),[1,2,4,6]);
  assert.deepEqual(stages.map(q=>q.sentences),[2,3,5,7]);
  assert.deepEqual(stages.map(q=>q.indexCost),[1,2,3,4]);
});
for(const mode of MODE_NAMES){
  test(mode+': final page cannot appear before both story days and evidence requirements',()=>{
    const t=game(mode),r=t.run('difficultyRules(G.difficulty)');
    t.G.day=r.minDay-2;t.G.sentencesFound=r.sentences;t.G.proofs=r.proofs;
    t.run('newDay()');assert.equal(t.G.q,5);
    t.run('newDay()');assert.equal(t.G.q,6);
    assert.equal(t.G.day,r.minDay);
    assert.equal(t.G.xp,5);
  });
  test(mode+': missing evidence holds shelving back even when the day is reached',()=>{
    const t=game(mode),r=t.run('difficultyRules(G.difficulty)');
    t.G.day=r.minDay-1;t.G.sentencesFound=r.sentences;
    t.G.proofs=r.proofs-1;
    t.run('newDay()');
    assert.equal(t.G.q,5);
    t.run("collectProof('new|evidence')");
    assert.equal(t.G.proofs,r.proofs);
    t.run('newDay()');assert.equal(t.G.q,6);
  });
  test(mode+': unfinished sentences hold shelving back regardless of elapsed time',()=>{
    const t=game(mode),r=t.run('difficultyRules(G.difficulty)');
    t.G.day=r.minDay-1;t.G.sentencesFound=r.sentences-1;t.G.proofs=r.proofs;
    t.run('newDay()');assert.equal(t.G.q,5);
    t.G.sentencesFound=r.sentences;t.run('newDay()');assert.equal(t.G.q,6);
  });
  test(mode+': Index and shelf-mark price use the chosen difficulty',()=>{
    const t=game(mode),r=t.run('difficultyRules(G.difficulty)');
    t.G.q=1;t.G.day=Math.max(1,r.indexDay-1);t.G.sentencesFound=r.sentences;
    t.G.frags=20;
    if(t.G.day<r.indexDay){t.run('useIndex()');assert.equal(t.G.q,1)}
    t.G.day=r.indexDay;t.G.sentencesFound=r.sentences-1;
    t.run('useIndex()');assert.equal(t.G.q,1,'Index must require independent discoveries');
    t.G.sentencesFound=r.sentences;
    t.run('useIndex()');assert.equal(t.G.q,2,'Index advances after all requirements');
    assert.equal(t.G.frags,20-r.indexCost);
    t.G.q=3;t.G.day=r.shelfDay-1;
    const locked=t.run("hatchItems().find(x=>x.kind==='mark')");
    assert.ok(locked.no);
    assert.equal(locked.cost,12+Math.max(0,r.shelfDay-3)*2);
    t.G.day=r.shelfDay;
    assert.equal(t.run("hatchItems().find(x=>x.kind==='mark').no"),null);
  });
}
test('archive proofs count unique discoveries, persist across dawn and do not duplicate',()=>{
  const t=game();t.run("collectProof('ruin|1')");
  assert.equal(t.G.proofs,1);
  assert.equal(t.run("collectProof('ruin|1')"),false);
  t.run('newDay()');assert.equal(t.G.proofs,1);
  t.run("collectProof('enc|trial|1')");
  assert.equal(t.G.proofs,2);
});
test('eight new encounters offer two choices and correct recognizable models',()=>{
  const t=game(),solos=['cartographer','surgeon','warden'];
  const groups=['auction','trial','choir','watch','firebrigade'];
  for(const kind of solos){
    assert.equal(t.run('typeof ENCS.'+kind+'.A'),'function');
    assert.equal(t.run('typeof ENCS.'+kind+'.B'),'function');
    assert.ok(t.run('ENCS.'+kind+'.text()').length>45);
  }
  for(const kind of groups){
    assert.equal(t.run('ENCS.'+kind+'.scene'),true);
    const members=t.run('ENCS.'+kind+'.build({x:5,y:7})');
    assert.ok(members.length>=3);
    assert.ok(members.every(q=>q.type==='fig'&&q.rig&&q.pose));
    assert.ok(t.run('ENCS.'+kind+'.text()').length>45);
  }
  assert.match(script,/['"]cartographer['"],['"]surgeon['"],['"]warden['"]/);
  assert.match(script,/['"]auction['"],['"]trial['"],['"]choir['"],['"]watch['"],['"]firebrigade['"]/);
});
test('actual encounter choice handler pays for proof or accepts the darker outcome',()=>{
  const a=game();
  a.run("G.encOn={enc:'auction',x:2,y:4,state:'idle',t:0};G.choice='enc';encChoose(true)");
  assert.equal(a.G.type,25);
  assert.equal(a.G.proofs,1);
  assert.equal(a.G.encOn.state,'talked');
  const b=game();
  b.run("G.encOn={enc:'auction',x:2,y:4,state:'idle',t:0};G.choice='enc';encChoose(false)");
  assert.equal(b.G.type,35);
  assert.equal(b.G.proofs,0);
  assert.equal(b.G.sins.length,1);
});
test('insufficient payment never silently consumes a choice',()=>{
  const t=game();t.G.type=0;
  t.run("G.encOn={enc:'cartographer',x:2,y:4,state:'idle',t:0};G.choice='enc';encChoose(true)");
  assert.equal(t.G.type,0);
  assert.equal(t.G.proofs,0);
  assert.equal(t.G.encOn.state,'idle');
  assert.equal(t.G.encOn.keep,true);
});
test('the reading choir yields a distinct sentence and no repeatable same-epoch proof',()=>{
  const t=game();t.G.sentencesFound=0;t.G.frags=0;
  t.run("G.encOn={enc:'choir',x:2,y:4,state:'idle',t:0};G.choice='enc';encChoose(true)");
  assert.equal(t.G.proofs,1);
  assert.equal(t.G.sentencesFound,1);
  assert.equal(t.G.frags,1);
  t.run("G.encOn={enc:'choir',x:20,y:4,state:'idle',t:0};G.choice='enc';encChoose(true)");
  assert.equal(t.G.proofs,1,'same event category offers proof once per true reset');
  assert.equal(t.G.sentencesFound,2,'each distinct reading is still a sentence');
});
