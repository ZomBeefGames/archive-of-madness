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
  get ENCRIG(){return ENCRIG},get FIGRIG(){return FIGRIG},
  get CHAR(){return CHAR},get ME(){return ME},
  filmStage,openBookUI,figLayers,get NET(){return NET},get BUILD(){return BUILD},
  placeOf,getRoom,walkable,airFloor,levelHasWall,characterRig,
  get ENC(){return ENC},get BG(){return BG},
  get VIEW(){return VIEW}
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
    await page.waitForFunction(()=>{const a=window.__AOM_TEST;return !!a&&a.G.state==='title'&&a.FILM.buttons.length===6&&a.view.width>0},null,{timeout:12000});
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
  assert.equal(render.buttons,6);
  await mkdir('browser-artifacts',{recursive:true});
  await page.screenshot({path:'browser-artifacts/title-'+label+'.png'});
  // Real desktop and mobile canvas interactions with the character creator.
  await clickTitle(page,'character',!!contextOptions.hasTouch);
  await page.waitForFunction(()=>window.__AOM_TEST?.FILM.customizing&&window.__AOM_TEST.FILM.buttons.length===9);
  await page.screenshot({path:'browser-artifacts/character-'+label+'.png'});
  await clickTitle(page,'char:gender',!!contextOptions.hasTouch,.82);
  await clickTitle(page,'char:outfit',!!contextOptions.hasTouch,.82);
  await clickTitle(page,'char:coat',!!contextOptions.hasTouch,.82);
  await clickTitle(page,'char:skin',!!contextOptions.hasTouch,.82);
  await clickTitle(page,'char:hair',!!contextOptions.hasTouch,.82);
  page.once('dialog',async dialog=>{assert.equal(dialog.type(),'prompt');await dialog.accept('MORGAN '+label.toUpperCase())});
  await clickTitle(page,'char:name',!!contextOptions.hasTouch,.82);
  assert.deepEqual(await page.evaluate(()=>{
    const a=window.__AOM_TEST,c=a.CHAR;
    return{name:c.name,gender:c.gender,outfit:c.outfit,coat:c.coat,skin:c.skin,hair:c.hair,
      liveRig:a.ME.rig?.head?.g?.w>0,stored:!!localStorage.getItem('aom.character.v1')}
  }),{name:'MORGAN '+label.toUpperCase(),gender:1,outfit:1,coat:1,skin:3,hair:2,liveRig:true,stored:true});
  await clickTitle(page,'char:done',!!contextOptions.hasTouch);
  await page.waitForFunction(()=>!window.__AOM_TEST?.FILM.customizing&&window.__AOM_TEST.FILM.buttons.length===6);
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
  // Load each new costume and group cast through the actual game paper-puppet
  // renderer, not a fake sprite. This catches missing rigs and pose errors.
  const actors=await page.evaluate(()=>{
    const a=window.__AOM_TEST,G=a.G,groups=['auction','trial','choir','watch','firebrigade',
      'quarantine','council','pilgrims','shelter','ledgerfire'];
    const solos=['cartographer','surgeon','warden','binder','bellkeeper','orphan','exile','glassmaker'];let groupParts=0,soloParts=0;
    for(const id of groups){
      let cast=null;
      for(const [x,y] of [[2.9,0],[-2.9,0],[0,2.9],[0,-2.9]])
        if((cast=a.ENCS[id].build({x:G.room.cx+x,y:G.room.cy+y})))break;
      if(!cast||cast.length<3)throw Error('Cannot place group '+id);
      const out=[];a.figLayers(cast[0],out);
      if(out.length<18)throw Error('Group '+id+' has no visible puppet');
      groupParts+=out.length;
    }
    for(const id of solos){
      const actor={type:'fig',x:G.x+1,y:G.y+1,f:Math.PI/2,seed:1,pose:a.ENCS[id].pose,
        rig:a.ENCRIG[id],hit:0,walk:0};
      const out=[];a.figLayers(actor,out);
      if(out.length<18)throw Error('Solo '+id+' has no puppet parts');
      soloParts+=out.length;
    }
    return{groups:groups.length,solo:solos.length,groupParts,soloParts};
  });
  assert.equal(actors.groups,10);assert.equal(actors.solo,8);
  assert.ok(actors.groupParts>=actors.groups*18&&actors.soloParts>=actors.solo*18);
  assert.deepEqual(errors,[],label+' should not throw in browser rendering');
  // Regression location: transit hub at (8,8), floor -587 (not a hub),
  // with the four old pillar footprints around the open spiral stair.
  const geometry=await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G;
    g.state='play';g.floor=-587;g.x=10.4;g.y=8.7;g.ang=Math.PI*0.98;
    g.cell=a.placeOf(g.x,g.y);g.room=a.getRoom(0,0);g.inRoom=false;
    g.journal=false;g.ents=[];g.phantoms=[];g.day=1;g.clock=0;
    a.BG.acts=[];a.ENC.list=[];a.VIEW.third=true;
    // Expose the head rather than hiding it inside the hood selected earlier
    // by the title-screen customization test. Make skin/hair high contrast.
    a.CHAR.outfit=0;a.CHAR.gender=0;a.CHAR.skin=0;a.CHAR.hair=0;
    a.ME.rig=a.characterRig(a.CHAR);
    const footprints=[[6.55,6.55],[6.55,9.45],[9.45,6.55],[9.45,9.45]];
    const transit=footprints.every(([x,y])=>a.airFloor(x,y)&&a.walkable(x,y,.1));
    const ghost=!a.levelHasWall('pillar',-587)&&a.levelHasWall('pillar',-585);
    return{floor:g.floor,transit,ghost};
  });
  assert.deepEqual(geometry,{floor:-587,transit:true,ghost:true},
    label+' transit landings must have a solid floor and no pillar collision');
  await page.waitForTimeout(350);
  await page.screenshot({path:'browser-artifacts/transit-negative-'+label+'.png'});
  await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G;g.floor=-585;g.cell=a.placeOf(g.x,g.y);
  });
  await page.waitForTimeout(250);
  await page.screenshot({path:'browser-artifacts/communal-negative-'+label+'.png'});
  assert.deepEqual(errors,[],label+' should render both upper and lower community floors without JS errors');
  console.log('BROWSER PASS',label,'event choices, character rig and negative-floor hub/transit screenshots');
  await context.close();
}


async function clickTitle(page,id,touch=false,fraction=.5){
  const p=await page.evaluate(({which,fraction})=>{
    const a=window.__AOM_TEST,b=a.FILM.buttons.find(x=>x.id===which);
    if(!b)throw Error('Missing menu button '+which);
    const st=a.filmStage(),r=a.view.getBoundingClientRect();
    return{x:r.left+(st.x+(b.x+b.w*fraction)*st.s)/a.DW*r.width,
      y:r.top+(st.y+(b.y+b.h/2)*st.s)/a.DH*r.height};
  },{which:id,fraction});
  if(touch)await page.touchscreen.tap(p.x,p.y);
  else await page.mouse.click(p.x,p.y);
}
async function coopSmoke(){
  const hostContext=await browser.newContext({viewport:{width:1100,height:750}});
  const joinContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const host=await hostContext.newPage(),guest=await joinContext.newPage(),errors=[];
  host.on('pageerror',e=>errors.push('host: '+e.message));
  guest.on('pageerror',e=>errors.push('guest: '+e.message));
  try{
    await host.goto('http://127.0.0.1:'+PORT+'/');
    await host.waitForFunction(()=>window.__AOM_TEST?.G.state==='title'&&window.__AOM_TEST?.FILM.buttons.length===6);
    await clickTitle(host,'character');
    // Rendering the workshop can take several frames on low-powered runners.
    // Do not tap an unrendered button while the title animation is changing.
    await host.waitForFunction(()=>window.__AOM_TEST?.FILM.customizing&&
      window.__AOM_TEST.FILM.buttons.some(b=>b.id==='char:name'),null,{timeout:12000});
    host.once('dialog',async d=>{await d.accept('WARDEN HOST')});
    await clickTitle(host,'char:name',false,.82);
    await clickTitle(host,'char:gender',false,.82);
    await clickTitle(host,'char:outfit',false,.82);
    await clickTitle(host,'char:coat',false,.82);
    await clickTitle(host,'char:done');
    await host.waitForFunction(()=>!window.__AOM_TEST?.FILM.customizing&&window.__AOM_TEST?.FILM.buttons.some(b=>b.id==='party'));
    await clickTitle(host,'party');
    assert.equal(await host.evaluate(()=>window.__AOM_TEST.FILM.partyMode),'host');
    await clickTitle(host,'begin');
    await host.waitForFunction(()=>window.__AOM_TEST?.NET.ready,null,{timeout:12000});
    const code=await host.evaluate(()=>window.__AOM_TEST.NET.code);
    assert.match(code,/^[A-HJ-NP-Z2-9]{6}$/);
    assert.match(host.url(),new RegExp('room='+code));
    await guest.goto('http://127.0.0.1:'+PORT+'/?room='+code);
    await guest.waitForFunction(()=>window.__AOM_TEST?.G.state==='title'&&window.__AOM_TEST?.FILM.buttons.length===6);
    assert.equal(await guest.evaluate(()=>window.__AOM_TEST.FILM.partyMode),'join');
    await clickTitle(guest,'begin',true);
    await guest.waitForFunction(()=>window.__AOM_TEST?.NET.ready,null,{timeout:12000});
    await host.waitForFunction(()=>window.__AOM_TEST?.NET.peers.size===1,null,{timeout:8000});
    await guest.waitForFunction(()=>window.__AOM_TEST?.NET.peers.size===1,null,{timeout:8000});
    assert.equal(await guest.evaluate(()=>window.__AOM_TEST.NET.code),code);
    const shared=await guest.evaluate(()=>{
      const a=window.__AOM_TEST,p=[...a.NET.peers.values()][0],parts=[];
      a.figLayers(p,parts);return{phrase:a.G.phrase,parts:parts.length,
        floor:a.G.floor,peerFloor:p.floor,name:p.name,rig:p.rig?.head?.g?.w>0,
        gender:JSON.parse(p.profileKey).gender,outfit:JSON.parse(p.profileKey).outfit,
        coat:JSON.parse(p.profileKey).coat};
    });
    assert.ok(shared.parts>=18,'joined companion must have all paper-puppet parts');
    assert.equal(shared.name,'WARDEN HOST','custom name transmitted to the guest');
    assert.equal(shared.rig,true,'guest draws host with a real custom paper puppet');
    assert.deepEqual({gender:shared.gender,outfit:shared.outfit,coat:shared.coat},
      {gender:1,outfit:1,coat:1},'guest sees the host wardrobe');
    assert.equal(shared.floor,shared.peerFloor);
    assert.equal(shared.phrase,await host.evaluate(()=>window.__AOM_TEST.G.phrase));
    await guest.evaluate(()=>window.__AOM_TEST.NET.send({type:'chat',text:'Hello from the shared Library'}));
    await host.waitForFunction(()=>window.__AOM_TEST?.NET.chat.some(x=>x.text.includes('Hello from')),null,{timeout:8000});
    console.log('BROWSER PASS co-op',code,'two real sockets, custom named outfits, world seed, paper puppets and chat');
    assert.deepEqual(errors,[],'No browser errors in connected readers');
  }finally{
    await hostContext.close();await joinContext.close();
  }
}

try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  await caseRun('desktop',{viewport:{width:1280,height:800},deviceScaleFactor:1});
  await caseRun('phone',{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await coopSmoke();
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
  await writeFile('index.html',originalHTML);
}
