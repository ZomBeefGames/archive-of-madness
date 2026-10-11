import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline game script must exist');
const begin=script.indexOf('const FILM='),end=script.indexOf('const ARWPAL=',begin);
assert.ok(begin>0&&end>begin,'cinematic engine must be embedded in the game');
const theatre=script.slice(begin,end);
const d0=script.indexOf('const DIFFICULTIES='),d1=script.indexOf('/* ---- the way to your page:',d0);
assert.ok(d0>=0&&d1>d0,'Difficulty profiles must be declared');
const modes=script.slice(d0,d1);
function fakeCanvasContext(){
  const base={
    font:'15px serif',
    measureText(text){return{width:String(text).length*11}},
    createLinearGradient(){return{addColorStop(){}}},
    createRadialGradient(){return{addColorStop(){}}}
  };
  return new Proxy(base,{get(obj,key){return key in obj?obj[key]:()=>{}},set(obj,key,value){obj[key]=value;return true}});
}
function studio(w=1280,h=720){
  const events={audio:0,intro:0,index:0,release:0,reset:0};
  const G={state:'title',cutSeen:{},journal:false,phrase:'the lamp forgot',wakeT:1.5,winT:1.2,day:2};
  const SND={on:true};
  const CHAR={name:'THE READER',gender:0,age:28,outfit:0,coat:0,pants:0,skin:2,hair:1};
  const APPEARANCE={gender:['MALE','FEMALE','NONBINARY'],outfit:['LONG COAT','HOODED COAT','WAISTCOAT','ARCHIVE ROBE'],
    coat:[['BURGUNDY','#743844']],pants:[['ONYX','#303038']],skin:[['TAN','#b78361']],hair:[['BLACK','#242027']]};
  const context=vm.createContext({DW:w,DH:h,G,SND,CHAR,APPEARANCE,FINE:true,CALM:false,
    characterLabel(field){return field==='age'?CHAR.age+' YEARS':field==='name'?CHAR.name:
      ['gender','outfit'].includes(field)?APPEARANCE[field][CHAR[field]]:
        (APPEARANCE[field][CHAR[field]]||['BURGUNDY'])[0]},
    characterRig(){return Object.fromEntries(['boot','shin','thigh','upper','fore','skirt','chest','waist','collar','shoulder','head','lantern'].map(k=>[k,{scale:2}]))},
    partAt(){return{cx:1,cy:1,card:{w:3,h:3,front:new Uint8ClampedArray(36)}}},
    ImageData:class{constructor(data,width,height){this.data=data;this.width=width;this.height=height}},
    applyCharacter(p){Object.assign(CHAR,p);return CHAR},
    changeCharacter(field,step){if(field==='name'){CHAR.name='ECHO READER';return}
      if(field==='age'){CHAR.age=Math.max(18,Math.min(90,CHAR.age+step));return}
      if(field==='gender')CHAR.gender=(CHAR.gender+step+3)%3;
      if(field==='outfit')CHAR.outfit=(CHAR.outfit+step+4)%4},
    BUILD:{barriers:new Map(),wrecks:new Map(),planks:0},
    vctx:fakeCanvasContext(),
    document:{createElement(){return{width:0,height:0,getContext:()=>fakeCanvasContext()}}},
    smooth(p){p=Math.max(0,Math.min(1,p));return p*p*(3-2*p)},
    snd(){events.audio++},drawIntro(){events.intro++},
    reset(){events.reset++;G.cutSeen={};G.state='intro'},
    useIndex(){events.index++},releaseAll(){events.release++},
    soundToggle(){SND.on=!SND.on}
  });
  vm.runInContext(modes+'\n'+theatre,context);
  return {G,SND,events,context,run:code=>vm.runInContext(code,context)};
}

test('game and cinematic engine JavaScript parse',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotThrow(()=>new vm.Script(theatre));
});
test('title renders six readable choices on desktop and phone',()=>{
  for(const [w,h] of [[1280,720],[750,1450]]){
    const t=studio(w,h);
    assert.doesNotThrow(()=>t.run('filmDrawTitle()'));
    assert.equal(t.run('FILM.buttons.length'),6);
    assert.equal(t.run('filmStage().portrait'),h>w*1.2);
    const values=t.run('({s:filmStage(),buttons:FILM.buttons.map(b=>({...b}))})');
    for(const b of values.buttons){
      assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=values.s.w&&b.y+b.h<=values.s.h,'visible menu button');
      const hit=t.run('filmHit('+[values.s.x+(b.x+b.w/2)*values.s.s,values.s.y+(b.y+b.h/2)*values.s.s].join(',')+')');
      assert.equal(hit,b.id,'touch hit-testing tracks scaled canvas menu');
    }
  }
});
test('title navigation, help and sound toggles are reversible',()=>{
  const t=studio();
  t.run("filmTitleAction('down')");
  assert.equal(t.run('FILM.selection'),1);
  t.run("filmTitleAction('read')");assert.equal(t.run('FILM.customizing'),true);
  t.run("filmTitleAction('back')");assert.equal(t.run('FILM.customizing'),false);
  t.run("filmTitleAction('down');filmTitleAction('read')");assert.equal(t.run('FILM.partyMode'),'host');
  t.run("filmTitleAction('down');filmTitleAction('read')");assert.equal(t.run('FILM.difficulty'),'lost');
  t.run("filmTitleAction('down');filmTitleAction('read')");assert.equal(t.run('FILM.help'),true);
  assert.doesNotThrow(()=>t.run('filmDrawTitle()'));
  t.run("filmTitleAction('back')");assert.equal(t.run('FILM.help'),false);
  t.run("filmTitleAction('down');filmTitleAction('read')");
  assert.equal(t.SND.on,false);
  assert.equal(t.G.state,'title');
});
test('new game plays four skippable shots and returns to the original intro book',()=>{
  const t=studio();
  t.run("filmTitleAction('begin')");
  assert.equal(t.G.state,'cinematic');assert.equal(t.G.cutSeen.opening,true);
  assert.equal(t.events.reset,1,'starting the selected challenge resets a clean new run');
  assert.equal(t.run('FILMS.opening.length'),4);
  for(let i=0;i<4;i++){
    assert.doesNotThrow(()=>t.run('filmDrawCut()'));
    t.run('filmAdvance()');
  }
  assert.equal(t.G.state,'intro');assert.equal(t.events.intro,1);
  assert.equal(t.run("filmBegin('opening','intro')"),false,'opening cannot replay in same run');
});
test('Purifier warning returns to gameplay; Index scene resumes the real interaction',()=>{
  const t=studio();t.G.state='play';
  assert.equal(t.run("filmBegin('purifier','play')"),true);
  t.run('filmDrawCut();filmAdvance(true)');
  assert.equal(t.G.state,'play');
  assert.equal(t.run("filmBegin('purifier','play')"),false);
  assert.equal(t.run("filmBegin('index','index')"),true);
  t.run('filmDrawCut();filmAdvance(true)');
  assert.equal(t.G.state,'play');
  assert.equal(t.events.index,1,'first Index interaction must resume');
});
test('cutscenes advance automatically and display a touch skip region',()=>{
  const t=studio();t.run("filmBegin('index','index');filmDrawCut()");
  const skip=t.run('({...FILM.skipRect})');
  assert.equal(skip.id,'skip');
  const st=t.run('filmStage()');
  assert.equal(t.run('filmHit('+[st.x+(skip.x+skip.w/2)*st.s,st.y+(skip.y+skip.h/2)*st.s].join(',')+",'skip')"),'skip');
  t.run('filmTick(3.4)');
  assert.equal(t.run('FILM.shot'),1);
  t.run('filmAdvance(true)');
  assert.equal(t.events.index,1);
});
test('dawn and finale cinematic layers paint without throwing',()=>{
  const t=studio(750,1450);
  assert.doesNotThrow(()=>t.run('filmDrawDawn();filmDrawFinale()'));
});
test('keyboard, touch, quest and encounter hooks do not silently bypass cinematics',()=>{
  assert.match(script,/if\(G\.state==='title'\)\{filmTitleAction\(a\);return\}/);
  assert.match(script,/if\(G\.state==='cinematic'\)\{/);
  assert.match(script,/filmHit\(pt\.x,pt\.y,'skip'\)/);
  assert.match(script,/filmBegin\('index','index'\)/);
  assert.match(script,/filmBegin\('purifier','play'\)/);
  assert.match(script,/if\(!\['title','cinematic','wake','waking'\]\.includes\(G\.state\)\)render\(\)/);
});

test('difficulty mode cycles through four challenge durations and back',()=>{
  const t=studio();
  const keys=['reader','archivist','lost','condemned'];
  for(const k of keys){
    assert.equal(t.run('Boolean(DIFFICULTIES['+JSON.stringify(k)+'])'),true);
  }
  t.run("filmTitleAction('difficulty')");
  assert.equal(t.run('FILM.difficulty'),'lost');
  t.run("filmTitleAction('next')");
  assert.equal(t.run('FILM.difficulty'),'condemned');
  t.run("filmTitleAction('next')");
  assert.equal(t.run('FILM.difficulty'),'reader');
  t.run("filmTitleAction('prev')");
  assert.equal(t.run('FILM.difficulty'),'condemned');
});


test('character creator is keyboard/touch navigable in portrait and landscape',()=>{
  for(const [w,h] of [[1280,720],[750,1450]]){
    const t=studio(w,h);
    t.run("filmTitleAction('character');filmDrawTitle()");
    assert.equal(t.run('FILM.customizing'),true);
    assert.equal(t.run('FILM.buttons.length'),9);
    assert.equal(t.run("FILM.buttons.filter(b=>b.id.startsWith('char:')).length"),9);
    const values=t.run('({s:filmStage(),buttons:FILM.buttons.map(b=>({...b}))})');
    for(const b of values.buttons){
      assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=values.s.w&&b.y+b.h<=values.s.h,'creator row within canvas');
      const x=values.s.x+(b.x+b.w*.8)*values.s.s,y=values.s.y+(b.y+b.h/2)*values.s.s;
      const choice=t.run('filmHit('+x+','+y+')');
      assert.equal(choice,b.id==='char:done'?'char:done':b.id+':next');
    }
    t.run("filmTitleAction('char:gender:next')");
    assert.equal(t.run('CHAR.gender'),1);
    t.run("filmTitleAction('char:age:next')");
    assert.equal(t.run('CHAR.age'),29);
    t.run("filmTitleAction('char:name:next')");
    assert.equal(t.run('CHAR.name'),'ECHO READER');
    t.run("filmTitleAction('char:done')");
    assert.equal(t.run('FILM.customizing'),false);
  }
});
