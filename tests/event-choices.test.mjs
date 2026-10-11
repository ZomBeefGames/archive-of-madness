import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function part(from,to){
  const a=script.indexOf(from),b=script.indexOf(to,a);
  assert.ok(a>=0&&b>a,'Missing real source range '+from);
  return script.slice(a,b);
}
const production=[
  part('const HUI=','function drawJournal()'),
  part('function encChoose(','function encClosed()'),
  part('function action(a){','let last=performance.now()')
].join('\n');
function setup(portrait=false){
  const choices=[],G={state:'book',choice:'enc',encOn:{enc:'test',state:'idle'},
    note:{title:'CHOICE',text:'What will you do?'},type:0};
  const ENCS={test:{
    a:'HELP THE STRANGER',ad:'Step in and protect them',
    b:'LEAVE THEM',bd:'Let the people walk away',
    A(){choices.push('first');return'You helped.'},
    B(){choices.push('second');return'You left.'}
  }};
  const g=new Proxy({font:'20px Georgia',measureText:s=>({width:String(s).length*9})},
    {get:(obj,key)=>key in obj?obj[key]:()=>{},set:(obj,key,val)=>(obj[key]=val,true)});
  const ctx=vm.createContext({G,ENCS,FINE:true,PORT:portrait,g,CTLS:{},
    wrapG:()=>['sample'],blockG:(ctx,rows,x,y)=>y+70,
    closeBook(){},drawBook(){},snd(){},filmTitleAction(){},filmAdvance(){}
  });
  vm.runInContext(production,ctx);
  function render(){
    if(portrait)vm.runInContext('drawNote(g,22,22,760,420,22,440)',ctx);
    else vm.runInContext('drawNote(g,24,24,440,660,464,24)',ctx);
  }
  function useChoice(index){
    render();
    const hit=vm.runInContext('HUI.enc.map(r=>[(r[0]+r[2])/2,(r[1]+r[3])/2])',ctx)[index];
    const action=vm.runInContext('eventChoiceAt('+hit[0]+','+hit[1]+')',ctx);
    if(action===0)vm.runInContext("action('up')",ctx);
    else if(action===1)vm.runInContext("action('down')",ctx);
    else throw new Error('Tap did not land on choice row');
  }
  return{G,choices,render,useChoice,run:code=>vm.runInContext(code,ctx)};
}
test('production click handlers have explicit event-row dispatch and correct action mapping',()=>{
  assert.match(script,/else if\(G\.choice==='enc'\)\{const picked=eventChoiceAt\(fx\*TX\.book\.w,fy\*TX\.book\.h\)/);
  assert.match(script,/if\(picked===0\)action\('up'\);else if\(picked===1\)action\('down'\)/);
  assert.doesNotThrow(()=>new vm.Script(production));
});
for(const portrait of [false,true]){
  const mode=portrait?'portrait phone':'landscape desktop';
  test(mode+': first option is actually the first event outcome',()=>{
    const s=setup(portrait);s.useChoice(0);
    assert.deepEqual(s.choices,['first']);
    assert.equal(s.G.note.text,'You helped.');
  });
  test(mode+': second option is the second outcome',()=>{
    const s=setup(portrait);s.useChoice(1);
    assert.deepEqual(s.choices,['second']);
    assert.equal(s.G.note.text,'You left.');
  });
  test(mode+': events use two nonoverlapping hitboxes on the visible choice page',()=>{
    const s=setup(portrait);s.render();
    const rects=s.run('HUI.enc.map(r=>[...r])');
    assert.equal(rects.length,2);
    assert.ok(rects[0][3]<rects[1][1],'rows cannot overlap');
    assert.ok(rects[0][0]>=(portrait?22:464),'both choices are on their page');
    assert.equal(s.run('eventChoiceAt(35,45)'),-1,'unrelated page must not select a choice');
  });
}
test('keyboard W/S outcome routing remains unchanged',()=>{
  const a=setup();a.run("action('up')");
  const b=setup();b.run("action('down')");
  assert.deepEqual(a.choices,['first']);
  assert.deepEqual(b.choices,['second']);
});
