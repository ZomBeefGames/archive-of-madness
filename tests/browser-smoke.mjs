// Rendered end-to-end smoke checks. Kept separate from "npm run check" because
// the normal regression suite intentionally has no external dependencies.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const PORT=31987;
const originalHTML=await readFile('index.html','utf8');
// The original game has private top-level lexical state. The temporary test
// checkout receives a read-only inspection bridge, never the deployed game.
const bridge=`
window.__AOM_TEST={
  get G(){return G},get FILM(){return FILM},get view(){return view},
  get HUI(){return HUI},get TX(){return TX},get bookCard(){return bookCard},
  get DW(){return DW},get DH(){return DH},get ENCS(){return ENCS},
  filmStage,openBookUI
};
`;
assert.ok(originalHTML.includes('</script>'));
await writeFile('index.html',originalHTML.replace('</script>',bridge+'</script>'));
const server=spawn(process.execPath,['server.mjs'],{
  env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']
});
let serverStderr='';
server.stderr.on('data',chunk=>{serverStderr+=chunk.toString()});
let browser;
async function ready(){
  for(let attempt=0;attempt<60;attempt++){
    if(server.exitCode!==null)throw new Error('Static server exited: '+serverStderr);
    try{const response=await fetch('http://127.0.0.1:'+PORT+'/');if(response.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Static server did not become ready: '+serverStderr);
}
async function positionFor(page,buttonIndex){
  return await page.evaluate(index=>{
    const app=window.__AOM_TEST,r=app.view.getBoundingClientRect(),tex=app.HUI.enc[index],pageRect=app.bookCard.rect;
    assertVisible(pageRect&&tex);
    function assertVisible(value){if(!value)throw new Error('No visible choice page')}
    const tx=(tex[0]+tex[2])/2,ty=(tex[1]+tex[3])/2;
    return{
      x:r.left+(pageRect.x0+tx/app.TX.book.w*(pageRect.x1-pageRect.x0))/app.DW*r.width,
      y:r.top+(pageRect.y0+ty/app.TX.book.h*(pageRect.y1-pageRect.y0))/app.DH*r.height
    };
  },buttonIndex);
}
async function openEvent(page){
  await page.evaluate(()=>{
    // Invoke the real book UI and encChoose code, with an isolated no-harm
    // synthetic choice so the test does not modify the game's narrative.
    window.__chosen=null;
    const {G,ENCS}=window.__AOM_TEST;
    ENCS.visualSmoke={
      title:'THE CHOICE OF THE LIBRARY',
      text:()=> 'A reader waits for your decision.',
      a:'HELP THE READER',ad:'Offer your hand and keep the door open.',
      b:'LEAVE THE READER',bd:'Close the door and walk away.',
      A:()=>{window.__chosen='first';return'FIRST OPTION WAS CHOSEN'},
      B:()=>{window.__chosen='second';return'SECOND OPTION WAS CHOSEN'}
    };
    G.state='play';
    G.encOn={enc:'visualSmoke',state:'idle',t:0};
    G.choice='enc';G.note={title:ENCS.visualSmoke.title,text:ENCS.visualSmoke.text()};
    G.lastHit={t:1};window.__AOM_TEST.openBookUI(null,'');
  });
  await page.waitForFunction(()=>{const a=window.__AOM_TEST;return a&&a.G.state==='book'&&a.G.bookAnim>.45&&a.bookCard.rect&&a.bookCard.rect.x1>a.bookCard.rect.x0&&a.HUI.enc.length===2},null,{timeout:30000});
}
async function caseRun(label,contextOptions){
  const context=await browser.newContext({...contextOptions,ignoreHTTPSErrors:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});
  try{
    await page.waitForFunction(()=>{const a=window.__AOM_TEST;return !!a&&a.G.state==='title'&&a.FILM.buttons.length===4&&a.view.width>0},null,{timeout:12000});
  }catch(e){
    const probe=await page.evaluate(()=>({
      ready:document.readyState,bridge:!!window.__AOM_TEST,
      canvases:document.querySelectorAll('canvas').length,
      scripts:document.scripts.length,view:!!document.getElementById('view'),
      title:document.title
    }));
    console.error('STARTUP DIAGNOSTICS',JSON.stringify({label,errors,probe}));
    throw e;
  }
  const render=await page.evaluate(()=>{
    const app=window.__AOM_TEST,view=app.view;const ctx=view.getContext('2d'),data=ctx.getImageData(0,0,view.width,view.height).data;
    let bright=0;for(let i=0;i<data.length;i+=257*4)if(data[i]+data[i+1]+data[i+2]>110)bright++;
    return {pixels:bright,screen:[view.width,view.height],buttons:app.FILM.buttons.length}
  });
  assert.ok(render.pixels>10,label+' title should paint visible artwork');
  assert.equal(render.buttons,4);
  await mkdir('browser-artifacts',{recursive:true});
  await page.screenshot({path:'browser-artifacts/title-'+label+'.png'});
  // Tap the real illustrated difficulty button in each responsive layout.
  // Its selection must survive the fresh run created by BEGIN YOUR STORY.
  const difficultyButton=await page.evaluate(()=>{
    const a=window.__AOM_TEST,b=a.FILM.buttons.find(q=>q.id==='difficulty'),st=a.filmStage(),r=a.view.getBoundingClientRect();
    return{x:r.left+(st.x+(b.x+b.w/2)*st.s)/a.DW*r.width,
      y:r.top+(st.y+(b.y+b.h/2)*st.s)/a.DH*r.height}
  });
  if(contextOptions.hasTouch)await page.touchscreen.tap(difficultyButton.x,difficultyButton.y);
  else await page.mouse.click(difficultyButton.x,difficultyButton.y);
  await page.waitForFunction(()=>window.__AOM_TEST?.FILM.difficulty==='lost',null,{timeout:10000});
  // Actual canvas click through the title screen.
  const begin=await page.evaluate(()=>{
    const a=window.__AOM_TEST,b=a.FILM.buttons[0],st=a.filmStage(),r=a.view.getBoundingClientRect();
    return{x:r.left+(st.x+(b.x+b.w/2)*st.s)/a.DW*r.width,
      y:r.top+(st.y+(b.y+b.h/2)*st.s)/a.DH*r.height}
  });
  if(contextOptions.hasTouch)await page.touchscreen.tap(begin.x,begin.y);
  else await page.mouse.click(begin.x,begin.y);
  await page.waitForFunction(()=>window.__AOM_TEST?.G.state==='cinematic',null,{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__AOM_TEST.G.difficulty),'lost',
    'new run should inherit selected harder difficulty');
  // Skip the opening using the existing keyboard flow, then use real book UI.
  await page.keyboard.press('Escape');
  await openEvent(page);
  const first=await positionFor(page,0);
  if(contextOptions.hasTouch)await page.touchscreen.tap(first.x,first.y);
  else await page.mouse.click(first.x,first.y);
  await page.waitForFunction(()=>window.__chosen==='first',{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__AOM_TEST.G.note.text),'FIRST OPTION WAS CHOSEN');
  await openEvent(page);
  const second=await positionFor(page,1);
  if(contextOptions.hasTouch)await page.touchscreen.tap(second.x,second.y);
  else await page.mouse.click(second.x,second.y);
  await page.waitForFunction(()=>window.__chosen==='second',{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__AOM_TEST.G.note.text),'SECOND OPTION WAS CHOSEN');
  await page.screenshot({path:'browser-artifacts/choice-'+label+'.png'});
  assert.deepEqual(errors,[],label+' should not throw in browser rendering');
  console.log('BROWSER PASS',label,'difficulty selected, title, opening, both event choices');
  await context.close();
}

try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  await caseRun('desktop',{viewport:{width:1280,height:800},deviceScaleFactor:1});
  await caseRun('phone',{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
  await writeFile('index.html',originalHTML);
}
