import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Game script required');
const source=(start,end)=>{
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing production code '+start);
  return script.slice(a,b);
};
const line=start=>source(start,'\n');
const geometry=[
  source('const R=5,','const MAXLV='),
  line('const NRM='),
  line('function inHexL('),
  source('function hubStride()','/* the segments of one square'),
  source('const SQIN=[],SQV=[];','/* is there catwalk'),
  source('function inWell(','function placeOf('),
  line('function crossingAt(')
].join('\n');
const scheduling=[
  source('const DAYLEN=480','function clockText('),
  source('function newDay()','function blackout()')
].join('\n');

function harness(){
  const G={floor:0,sentencesFound:0,seenSentences:new Set(),
    day:1,lastResetDay:1,nextResetDay:3,resetInterval:2,resetCount:0,
    resetEpoch:1,justReset:false,clock:480*7/24,tr:{},q:0,room:{},
    zoneState:new Map(),zoneVisited:new Set(),
    corpses:{old:[1]},wcorpse:{old:[1]},looted:new Set(['body']),
    corpseSeq:2,fires:[{t:8}],over:{ink:1},meal:{kind:'soup'},fedAt:5,sleepCd:4,
    echo:3,phantoms:[{}],journal:true};
  const WD={key:'old'},LAMPS={key:'old'},BG={acts:[1],t:2},
    ENC={list:[{id:'speaker'}],t:14},burned=new Set(['shelf']),texCache=new Map(),events=[];
  let roomSpawns=0;
  const ctx=vm.createContext({G,WD,LAMPS,BG,ENC,burned,texCache,
    galleryBarricadeAt(){return null}, sfx:(message)=>events.push(message),
    spawnRoom:()=>{roomSpawns++},
    setTimeout:()=>{}
  });
  vm.runInContext(geometry+'\n'+scheduling,ctx);
  return{G,WD,LAMPS,BG,ENC,burned,events,run:code=>vm.runInContext(code,ctx),
    spawns:()=>roomSpawns};
}
test('all production JavaScript and extracted mechanics parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(geometry+'\n'+scheduling));
});
test('horizontal hub spacing exactly equals floor spacing in positive and negative directions',()=>{
  const s=harness();
  for(let discoveries=0;discoveries<5;discoveries++){
    s.G.sentencesFound=discoveries;
    const gap=3+discoveries;
    assert.equal(s.run('hubStride()'),gap);
    for(const k of [-2,-1,0,1,2]){
      assert.equal(s.run('isStair('+gap*k+','+gap*k+')'),true);
      assert.equal(s.run('isComm('+gap*k+','+gap*k+','+gap*k+')'),true);
      assert.equal(s.run('isComm('+gap*k+','+gap*k+','+gap*k+'+1)'),false);
    }
    assert.equal(s.run('isComm('+gap+',0,0)'),true);
    assert.equal(s.run('isComm('+gap+',0,'+gap+')'),true);
    assert.equal(s.run('isComm('+gap+',0,1)'),false);
    assert.equal(s.run('isStair('+(gap-1)+',0)'),false);
  }
});
test('transit floors keep spiral stairs but omit all communal pillar amenities',()=>{
  const s=harness();
  assert.equal(s.run('SQV.length'),32,'16 hub variants + 16 transit variants');
  s.G.floor=0;
  const hub=s.run('SQV[sqLayout(0,0)]');
  assert.ok(s.run('SQV[sqLayout(1,0)]').solid.some(q=>q.type==='food'),'adjacent community square has food hatch');
  assert.ok(hub.solid.some(q=>q.type==='sleep'),'community floor has sleep closet');
  assert.ok(hub.wells.length>0);
  s.G.floor=1;
  const transit=s.run('SQV[sqLayout(0,0)]');
  assert.ok(!transit.solid.some(q=>['food','sleep','privy','mirror','pillar'].includes(q.type)));
  assert.equal(transit.wells.length,hub.wells.length,'shaft never disappears');
  assert.equal(s.run('crossingAt(8,8).stairs'),true);
  assert.equal(s.run('crossingAt(8,8).comm'),false);
  assert.equal(s.run('inWell(8,8)'),true);
  assert.equal(s.run('walkable(8,8,0.2)'),false,'cannot walk through stairwell');
  assert.equal(s.run('walkable(6.75,6.75,0.2)'),true,'empty transit floor has a landing');
  assert.equal(s.run('airFloor(6.75,6.75)'),true,'transit landing actually renders a solid floor');
  assert.equal(s.run('airFloor(8,8)'),false,'the stairwell itself remains an opening');
  s.G.floor=0;
  assert.equal(s.run('walkable(6.75,6.75,0.2)'),false,'same position blocked by hub pillar');
});
test('each newly found real sentence adds one room AND one floor to the regular hub interval',()=>{
  const s=harness();
  assert.equal(s.run('hubStride()'),3);
  assert.equal(s.run("rememberSentence('book:one')"),true);
  assert.equal(s.run('hubStride()'),4);
  assert.equal(s.run("rememberSentence('book:one')"),false);
  assert.equal(s.run('hubStride()'),4);
  assert.equal(s.run("rememberSentence('book:two')"),true);
  assert.equal(s.run('hubStride()'),5);
  assert.equal(s.run('isComm(5,5,5)'),true);
  assert.equal(s.run('isComm(5,5,4)'),false);
  assert.equal(s.WD.key,null);
  assert.equal(s.LAMPS.key,null);
  s.G.frags=0;
  assert.equal(s.run('hubStride()'),5,'spending Index fragments cannot shrink the library');
});
test('ordinary dawn advances the day but does not restore shelves, loot, corpses or fires',()=>{
  const s=harness();
  s.run('newDay()');
  assert.equal(s.G.day,2);
  assert.equal(s.G.justReset,false);
  assert.equal(s.G.nextResetDay,3);
  assert.ok(s.G.corpses.old);
  assert.ok(s.G.looted.has('body'));
  assert.ok(s.burned.has('shelf'));
  assert.equal(s.G.fires.length,1);
  assert.equal(s.G.meal.kind,'soup');
  assert.equal(s.spawns(),0);
  assert.equal(s.run('hoursSinceReset()'),24+6);
});
test('Library resets follow 2, 2, 3, 3, 4, 4 day intervals',()=>{
  const s=harness();
  const days=[],gaps=[];
  for(let i=0;i<30;i++){
    s.run('newDay()');
    if(s.G.justReset){days.push(s.G.day);gaps.push(s.G.resetInterval)}
  }
  assert.deepEqual(days,[3,5,8,11,15,19,24,29]);
  assert.deepEqual(gaps,[2,3,3,4,4,5,5,6]);
  assert.equal(s.G.resetCount,8);
  assert.equal(s.G.resetEpoch,9);
  assert.equal(s.spawns(),8);
  assert.equal(s.G.seenSentences.size,0);
});
test('real reset clears ashes and corpse loot, but discovered sentences and hub spacing persist',()=>{
  const s=harness();
  s.run("rememberSentence('page:x')");
  s.run('newDay()');s.run('newDay()');
  assert.equal(s.G.day,3);
  assert.equal(s.G.justReset,true);
  assert.equal(s.G.resetEpoch,2);
  assert.equal(s.G.lastResetDay,3);
  assert.deepEqual(Object.keys(s.G.corpses),[]);
  assert.equal(s.G.looted.size,0);
  assert.equal(s.burned.size,0);
  assert.equal(s.G.fires.length,0);
  assert.equal(s.G.meal,null);
  assert.equal(s.spawns(),1);
  assert.equal(s.G.sentencesFound,1);
  assert.equal(s.run('hubStride()'),4);
});
test('combat, book, encounter, corpse and quest flow integrate with expanding world',()=>{
  assert.match(script,/SQV\[sqLayout\(si,sj\)\]/);
  assert.match(script,/if\(c\.stairs&&Math\.hypot\(dx,dy\)/);
  assert.match(script,/G\.floor\+=G\.climbDir;LAMPS\.key=null/);
  assert.match(script,/rememberSentence\('page\|'\+p\.key\)/);
  assert.match(script,/rememberSentence\('tale\|'\+p\.key\)/);
  assert.match(script,/rememberSentence\('body\|'\+body\.lootId\)/);
  assert.match(script,/rememberSentence\('enc\|sermon\|'/);
  assert.match(script,/G\.resetEpoch\)\,rnd=prng\(h\)/);
  assert.match(script,/G\.resetEpoch\+'\|'\+fl/);
});


test('former pillar footprints remain solid floors on transit levels, including deep negatives',()=>{
  const h=harness();
  const corners=[[6.55,6.55],[6.55,9.45],[9.45,6.55],[9.45,9.45]];
  for(const floor of [-587,-586,-584,-583,-1,1,2,4,5]){
    h.G.floor=floor;
    assert.equal(h.run('hubFloor()'),false,'expected stair-only floor '+floor);
    const layout=h.run('SQV[sqLayout(0,0)]');
    assert.ok(!layout.solid.some(s=>['pillar','sleep','privy','mirror','food'].includes(s.type)),'phantom pillars on '+floor);
    for(const [x,y] of corners){
      assert.equal(h.run('airFloor('+x+','+y+')'),true,'landing floor missing '+floor+' '+x+','+y);
      assert.equal(h.run('walkable('+x+','+y+',0.1)'),true,'phantom pillar collision on '+floor+' '+x+','+y);
      assert.equal(h.run('inWell('+x+','+y+')'),false,'former pillar turned into shaft');
    }
    assert.equal(h.run('isStair(0,0)'),true,'stair must remain on transit floor '+floor);
  }
  for(const floor of [-588,-585,-3,0,3,6]){
    h.G.floor=floor;
    assert.equal(h.run('hubFloor()'),true,'expected real community floor '+floor);
    for(const [x,y] of corners){
      assert.equal(h.run('airFloor('+x+','+y+')'),true,'solid ground under legitimate hub pillar');
      assert.equal(h.run('walkable('+x+','+y+',0.1)'),false,'real hub pillar should still block movement');
    }
  }
});
test('vertical pillar projection is permitted only on actual 3D communal hub floors',()=>{
  const h=harness();
  for(let sentences=0;sentences<5;sentences++){
    h.G.sentencesFound=sentences;const gap=h.run('hubStride()');
    for(const floor of [-2*gap,-gap,0,gap,2*gap]){
      assert.equal(h.run("levelHasWall('pillar',"+floor+")"),true);
      assert.equal(h.run("levelHasWall('sleep',"+floor+")"),true);
      assert.equal(h.run("levelHasWall('frame',"+floor+")"),true);
      assert.equal(h.run("levelHasWall('ext',"+floor+")"),true);
      for(const offset of [1,2]){
        assert.equal(h.run("levelHasWall('pillar',"+(floor+offset)+")"),false);
        assert.equal(h.run("levelHasWall('frame',"+(floor+offset)+")"),false);
        assert.equal(h.run("levelHasWall('ext',"+(floor+offset)+")"),true);
      }
    }
  }
});
test('raycaster excludes an old pillar surface when projecting onto a transit floor',()=>{
  const source=script.slice(script.indexOf('function surfPx('),script.indexOf('let PDv=0,DEP=',script.indexOf('function surfPx(')));
  assert.ok(source.startsWith('function surfPx('),'actual surfPx implementation');
  const calls=[];
  const context=vm.createContext({
    G:{floor:-585,sentencesFound:0},
    HIT:{type:'pillar',seg:{},u:0.2},
    EYE:0.7,FH:2.15,AIRLV:3,WALLH:1.9,AMB:0.14,CW_LAMP:0.1,CW_D2:4,
    FOG:[1,0.8,0.6,0.4],
    lanL:()=>0.1,
    pointAt(){},
    wallPx(){calls.push('wall')},ceilPx(){calls.push('ceiling')},
    catPx(){calls.push('landing')},put(){calls.push('fallback')}
  });
  vm.runInContext(geometry+'\nlet PX_=6.55,PY_=6.55;\n'+source,context);
  vm.runInContext('surfPx(0,FH+0.8,1)',context);
  assert.deepEqual(calls,['landing'],'upper transit floor must not inherit lower hub pillar');
  calls.length=0;
  vm.runInContext('surfPx(0,0.8,1)',context);
  assert.deepEqual(calls,['wall'],'true hub floor retains its physical pillars');
  calls.length=0;context.G.floor=-587;
  vm.runInContext('surfPx(0,2*FH+0.8,1)',context);
  assert.deepEqual(calls,['wall'],'two floors above a transit level is a real hub');
});
