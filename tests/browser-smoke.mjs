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
  get VIEW(){return VIEW},get RAIL_JUMP_BUTTON(){return RAIL_JUMP_BUTTON},
  railJumpTarget,startRailFreefall,nearestFallCommunity,walkable,
  get TITLE_FLY(){return TITLE_FLY},titleNextScene,titleScenePose,
  get PERSON_BUTTONS(){return PERSON_BUTTONS},personTarget,
  get MODE(){return MODE},get GAME_TYPES(){return GAME_TYPES},
  modeLabel,cycleGameMode
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
    await page.waitForFunction(()=>{const a=window.__AOM_TEST;return !!a&&a.G.state==='title'&&a.FILM.buttons.length===7&&a.view.width>0},null,{timeout:12000});
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
  assert.equal(render.buttons,7);
  await page.waitForFunction(()=>{
    const a=window.__AOM_TEST;return a?.TITLE_FLY?.frames>0||a?.TITLE_FLY?.failed
  },null,{timeout:20000});
  const cinema=await page.evaluate(()=>{
    const a=window.__AOM_TEST,t=a.TITLE_FLY,g=a.G;
    return{scenes:t.scenes.length,performers:t.actorsDrawn,failed:t.failed,
      error:t.error,index:t.index,cameras:[...new Set(t.scenes.map(s=>s.camera))],
      durations:t.scenes.map(s=>s.duration),player:{x:g.x,y:g.y,floor:g.floor}};
  });
  assert.equal(cinema.failed,false,label+' live world flythrough failed: '+cinema.error);
  assert.equal(cinema.scenes,20);
  assert.ok(cinema.performers>=6);
  assert.ok(cinema.cameras.includes('freefall')&&cinema.cameras.includes('air'));
  assert.ok(cinema.durations.some(d=>d>=28));
  await page.evaluate(()=>window.__AOM_TEST.titleNextScene());
  await page.waitForFunction(previous=>window.__AOM_TEST?.TITLE_FLY?.index!==-1&&
    window.__AOM_TEST.TITLE_FLY.index!==previous,cinema.index,{timeout:20000});
  assert.deepEqual(await page.evaluate(()=>{
    const g=window.__AOM_TEST.G;return{x:g.x,y:g.y,floor:g.floor}
  }),cinema.player,'cinematic scenes never change the playable location');
  await mkdir('browser-artifacts',{recursive:true});
  await page.screenshot({path:'browser-artifacts/title-'+label+'.png'});
  // Cycle the real game-mode menu with both mouse and touch. Competitive mode
  // automatically requests an invite-code lobby, never a fake solo traitor.
  await clickTitle(page,'gameMode',!!contextOptions.hasTouch);
  await page.waitForFunction(()=>window.__AOM_TEST?.FILM.gameMode==='impostor');
  assert.equal(await page.evaluate(()=>window.__AOM_TEST.FILM.partyMode),'host');
  await clickTitle(page,'gameMode',!!contextOptions.hasTouch);
  await page.waitForFunction(()=>window.__AOM_TEST?.FILM.gameMode==='horde');
  await clickTitle(page,'gameMode',!!contextOptions.hasTouch);
  await page.waitForFunction(()=>window.__AOM_TEST?.FILM.gameMode==='story');
  // Auto-hosting is only for social deduction. Returning to Story mode
  // restores solo unless the player explicitly selected another party mode.
  assert.equal(await page.evaluate(()=>window.__AOM_TEST.FILM.partyMode),'solo');
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
  await page.waitForFunction(()=>!window.__AOM_TEST?.FILM.customizing&&window.__AOM_TEST.FILM.buttons.length===7);
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
  // The actual in-engine railing, mobile canvas target, descending camera,
  // midnight blackout and nearest real community wake must work end to end.
  const jumpStart=await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,c=g.room;
    g.state='play';g.journal=false;g.floor=3;
    let catwalk=false;
    for(const [x,y,ang] of [[c.cx+5.7,c.cy,-Math.PI/2],[c.cx+6.2,c.cy,Math.PI/2],
      [c.cx-5.7,c.cy,Math.PI/2],[c.cx-6.2,c.cy,-Math.PI/2]]){
      g.x=x;g.y=y;g.cell=a.placeOf(x,y);g.inRoom=false;g.ang=ang;
      const target=a.railJumpTarget();
      if(target?.kind==='catwalk')catwalk=true;
    }
    g.x=c.cx;g.y=c.cy+2.4;
    g.cell=c;g.inRoom=true;g.ang=-Math.PI/2;g.pitch=0;
    return{available:!!a.railJumpTarget(),catwalk,floor:g.floor};
  });
  assert.equal(jumpStart.available,true,label+' needs a real jumpable shaft railing');
  assert.equal(jumpStart.catwalk,true,label+' must also allow vaulting actual catwalk rails');
  await page.waitForFunction(()=>!!window.__AOM_TEST?.RAIL_JUMP_BUTTON,null,{timeout:12000});
  const railButton=await page.evaluate(()=>{
    const a=window.__AOM_TEST,r=a.view.getBoundingClientRect(),b=a.RAIL_JUMP_BUTTON;
    return{x:r.left+(b.x0+b.x1)/2/a.DW*r.width,
      y:r.top+(b.y0+b.y1)/2/a.DH*r.height};
  });
  if(contextOptions.hasTouch)await page.touchscreen.tap(railButton.x,railButton.y);
  else await page.mouse.click(railButton.x,railButton.y);
  await page.waitForFunction(()=>window.__AOM_TEST?.G.state==='freefall'&&window.__AOM_TEST.G.fall.depth>0,null,{timeout:12000});
  await page.waitForTimeout(350);
  const falling=await page.evaluate(()=>{
    const g=window.__AOM_TEST.G;
    return{state:g.state,depth:g.fall?.depth||0,from:g.fall?.fromFloor,floor:g.floor,kind:g.fall?.kind};
  });
  assert.equal(falling.state,'freefall');
  assert.ok(falling.depth>0&&falling.kind==='shaft');
  await page.screenshot({path:'browser-artifacts/freefall-'+label+'.png'});
  await page.evaluate(()=>{window.__AOM_TEST.G.clock=479.6});
  await page.waitForFunction(()=>window.__AOM_TEST?.G.state==='blackout',null,{timeout:12000});
  await page.waitForFunction(()=>window.__AOM_TEST?.G.state==='wake',null,{timeout:14000});
  const wake=await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,step=3+g.sentencesFound,
      ci=Math.round(g.x/16-.5),cj=Math.round(g.y/16-.5);
    return{floor:g.floor,step,fall:g.fall,atHub:ci%step===0&&cj%step===0,
      floorHub:g.floor%step===0,clear:a.walkable(g.x,g.y,.28),
      recovered:g.fallWakeDay===g.day};
  });
  assert.ok(wake.atHub&&wake.floorHub&&wake.clear&&wake.recovered,
    label+' freefall must wake at a navigable community hub');
  assert.equal(wake.fall,null);
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
  // Hand-to-hand interactions must work via the actual context buttons on
  // both pointer and touch, with real actor impulse rather than fake HUD art.
  const prior=await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,c=a.getRoom(0,0);
    g.state='play';g.journal=false;g.floor=0;g.room=c;g.gal=c.gid;
    g.x=c.cx+3.15;g.y=c.cy-.3;g.ang=Math.PI/2;
    g.cell=a.placeOf(g.x,g.y);g.inRoom=true;g.personCd=0;
    g.ents=[{type:'fig',x:g.x,y:g.y+1.10,pose:'stand',coat:0,
      f:0,hit:0,walk:0,dead:0}];
    return{x:g.ents[0].x,y:g.ents[0].y};
  });
  await page.waitForFunction(()=>!!window.__AOM_TEST?.PERSON_BUTTONS?.push,null,{timeout:12000});
  const shovePoint=await page.evaluate(()=>{
    const a=window.__AOM_TEST,b=a.PERSON_BUTTONS.push,r=a.view.getBoundingClientRect();
    return{x:r.left+(b.x0+b.x1)/2/a.DW*r.width,
      y:r.top+(b.y0+b.y1)/2/a.DH*r.height};
  });
  if(contextOptions.hasTouch)await page.touchscreen.tap(shovePoint.x,shovePoint.y);
  else await page.mouse.click(shovePoint.x,shovePoint.y);
  await page.waitForFunction(y=>window.__AOM_TEST?.G.ents[0]?.y>y+.1,prior.y,{timeout:12000});
  await page.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G;
    g.personCd=0;g.ents[0].x=g.x;g.ents[0].y=g.y+1.08;g.ents[0].shove=null;
  });
  await page.waitForFunction(()=>!!window.__AOM_TEST?.PERSON_BUTTONS?.throw,null,{timeout:12000});
  await page.keyboard.press('o');
  await page.waitForFunction(()=>window.__AOM_TEST?.G.ents[0]?.shove?.mode==='throw'||
    !!window.__AOM_TEST?.G.ents[0]?.fallState,null,{timeout:12000});
  console.log('BROWSER PASS',label,'event choices, character rig and negative-floor hub/transit screenshots');
  // A second fresh page verifies the new game really launches into the
  // zombie renderer and starts an actual countdown/wave on the same engine.
  const modePage=await context.newPage(),modeErrors=[];
  modePage.on('pageerror',e=>modeErrors.push(e.stack||e.message));
  await modePage.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'domcontentloaded'});
  await modePage.waitForFunction(()=>window.__AOM_TEST?.FILM.buttons.length===7);
  await clickTitle(modePage,'gameMode',!!contextOptions.hasTouch);
  await clickTitle(modePage,'gameMode',!!contextOptions.hasTouch);
  assert.equal(await modePage.evaluate(()=>window.__AOM_TEST.FILM.gameMode),'horde');
  await clickTitle(modePage,'begin',!!contextOptions.hasTouch);
  try{
    await modePage.waitForFunction(()=>window.__AOM_TEST?.G.state==='play'&&
      window.__AOM_TEST.MODE.type==='horde',null,{timeout:12000});
  }catch(error){
    const diag=await modePage.evaluate(()=>{
      const a=window.__AOM_TEST;
      return{state:a?.G?.state,mode:a?.MODE?.type,phase:a?.MODE?.state?.phase,
        gameMode:a?.FILM?.gameMode,party:a?.FILM?.partyMode,
        selection:a?.FILM?.selection,cut:a?.FILM?.id,buttons:a?.FILM?.buttons?.map(x=>x.id)};
    }).catch(e=>({error:String(e)}));
    console.error('HORDE START DIAGNOSTICS',JSON.stringify({label,diag,modeErrors}));
    throw error;
  }
  if(contextOptions.hasTouch){
    await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.buttons.some(b=>b.id==='start'),null,{timeout:10000});
    const target=await modePage.evaluate(()=>{
      const a=window.__AOM_TEST,b=a.MODE.buttons.find(x=>x.id==='start'),
        r=a.view.getBoundingClientRect();
      return{x:r.left+(b.x0+b.x1)/(2*a.DW)*r.width,
        y:r.top+(b.y0+b.y1)/(2*a.DH)*r.height};
    });
    await modePage.touchscreen.tap(target.x,target.y);
  }else await modePage.keyboard.press('y');
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.local.phase==='preparing',null,{timeout:12000});
  await modePage.evaluate(()=>{window.__AOM_TEST.MODE.local.prep=.07});
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.local.phase==='wave',null,{timeout:12000});
  const wave=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,z=a.G.ents.filter(e=>e.type==='zombie'&&!e.dead);
    const parts=[];if(z[0])a.figLayers(z[0],parts);
    return{wave:a.MODE.state.wave,zombies:z.length,parts:parts.length,mode:a.MODE.type};
  });
  assert.ok(wave.zombies>=7&&wave.parts>=15,label+' solo zombie wave must render real game models');
  assert.equal(wave.wave,1);
  const bookMap=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,m=a.MODE;
    return{map:{x:g.x,y:g.y,floor:g.floor},weapon:m.book.equipped,
      owned:m.book.owned,rarity:m.book.points,fire:m.buttons.some(x=>x.id==='fire'),
      reload:m.buttons.some(x=>x.id==='reload')};
  });
  assert.ok(bookMap.map.x< -1100&&bookMap.map.y>1100,
    label+' zombie mode must use the separate Dead Letter Depot map');
  assert.equal(bookMap.weapon,'primer');
  assert.deepEqual(bookMap.owned,['primer']);
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.buttons.some(x=>x.id==='fire'),null,{timeout:12000});
  const roundsBefore=await modePage.evaluate(()=>window.__AOM_TEST.MODE.book.clips.primer);
  if(contextOptions.hasTouch){
    const fire=await modePage.evaluate(()=>{
      const a=window.__AOM_TEST,b=a.MODE.buttons.find(q=>q.id==='fire'),
        r=a.view.getBoundingClientRect();
      return{x:r.left+(b.x0+b.x1)/(2*a.DW)*r.width,
        y:r.top+(b.y0+b.y1)/(2*a.DH)*r.height};
    });
    await modePage.touchscreen.tap(fire.x,fire.y);
  }else await modePage.keyboard.press('Space');
  await modePage.waitForFunction(n=>window.__AOM_TEST?.MODE.book.clips.primer<n,
    roundsBefore,{timeout:12000});
  const shot=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,m=a.MODE,g=a.G,b=m.book;
    const z=g.ents.find(e=>e.type==='zombie'&&!e.dead);
    if(!z)throw Error('No zombie to receive a real word');
    const center=a.getRoom(Math.round(g.x/16),Math.round(g.y/16));
    g.x=center.cx-3.1;g.y=center.cy;g.ang=Math.PI/2;
    g.cell=a.placeOf(g.x,g.y);g.room=center;g.inRoom=true;
    z.x=g.x;z.y=g.y+1.13;z.hp=2;
    m.lastWordAt=0;m.bookShoot();
    return{word:m.shots.at(-1)?.word,hits:b.hits,kills:b.kills,
      fired:b.shots,earned:b.points,dead:!!z.dead};
  });
  assert.ok(shot.word&&shot.hits>=1&&shot.earned>250&&shot.dead,
    label+' a fired word must actually damage a zombie and award verse points');
  const shop=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,m=a.MODE,g=a.G;
    g.x=(-72+1)*16+2.65;g.y=72*16+.5;g.floor=0;
    g.cell=a.placeOf(g.x,g.y);g.room=a.getRoom(-71,72);g.inRoom=true;
    m.book.points=4000;m.bookBuy();
    return{owned:[...m.book.owned],equipped:m.book.equipped,
      nearest:m.nearestBook()?.book.id,points:m.book.points};
  });
  assert.equal(shop.nearest,'index');
  assert.ok(shop.owned.includes('index'));
  assert.equal(shop.equipped,'index');
  // The finite depot must actually support a purchase, repair reward and
  // outside siege encounter through its real desktop/touch HUD.
  const locked=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,m=a.MODE;
    g.x=-72*16+5.45;g.y=72*16;g.floor=0;
    g.cell=a.placeOf(g.x,g.y);g.room=a.getRoom(-72,72);g.inRoom=false;
    m.book.points=4000;
    return{closed:m.siege.doors.east===false,near:m.nearestHordeDoor()?.id,
      blocked:!a.walkable(-72*16+8,72*16,.22)};
  });
  assert.ok(locked.closed&&locked.blocked&&locked.near==='east',
    label+' closed depot must have an accessible locked wing');
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.buttons.some(b=>b.id==='unlock'),null,{timeout:12000});
  if(contextOptions.hasTouch){
    const pos=await modePage.evaluate(()=>{
      const a=window.__AOM_TEST,b=a.MODE.buttons.find(x=>x.id==='unlock'),
        r=a.view.getBoundingClientRect();
      return{x:r.left+(b.x0+b.x1)/(2*a.DW)*r.width,
        y:r.top+(b.y0+b.y1)/(2*a.DH)*r.height};
    });
    await modePage.touchscreen.tap(pos.x,pos.y);
  }else await modePage.keyboard.press('l');
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.siege.doors.east===true,null,{timeout:12000});
  const unlocked=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST;
    return{open:a.MODE.siege.doors.east,
      walk:a.walkable(-72*16+8,72*16,.22),
      points:a.MODE.book.points};
  });
  assert.ok(unlocked.open&&unlocked.walk&&unlocked.points<=3550,
    label+' verse points should open a real new wing');
  await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,g=a.G,m=a.MODE,
      x=-72*16-5*Math.cos(Math.PI/6)+.68,y=72*16;
    g.x=x;g.y=y;g.ang=Math.PI;g.room=a.getRoom(-72,72);
    g.cell=a.placeOf(x,y);g.inRoom=true;g.floor=0;
    m.siege.windows['central-west'].hp=3;
    m.siege.windows['central-west'].repairs=0;
    m.lastHordeRepair=-1e5;
  });
  await modePage.waitForFunction(()=>window.__AOM_TEST?.MODE.buttons.some(b=>b.id==='repair'),null,{timeout:12000});
  const pointsBefore=await modePage.evaluate(()=>window.__AOM_TEST.MODE.book.points);
  if(contextOptions.hasTouch){
    const pos=await modePage.evaluate(()=>{
      const a=window.__AOM_TEST,b=a.MODE.buttons.find(x=>x.id==='repair'),
        r=a.view.getBoundingClientRect();
      return{x:r.left+(b.x0+b.x1)/(2*a.DW)*r.width,
        y:r.top+(b.y0+b.y1)/(2*a.DH)*r.height};
    });
    await modePage.touchscreen.tap(pos.x,pos.y);
  }else await modePage.keyboard.press('b');
  await modePage.waitForFunction(n=>window.__AOM_TEST.MODE.book.points>=n+25,
    pointsBefore,{timeout:12000});
  const repaired=await modePage.evaluate(()=>{
    const a=window.__AOM_TEST,m=a.MODE;
    return{hp:m.siege.windows['central-west'].hp,
      earned:m.book.points,repairs:m.siege.windows['central-west'].repairs};
  });
  assert.ok(repaired.hp===4&&repaired.repairs===1&&repaired.earned>=pointsBefore+25,
    label+' repairing the window must restore HP and earn verse points');
    await modePage.screenshot({path:'browser-artifacts/horde-'+label+'.png'});
  assert.deepEqual(modeErrors,[],label+' horde game should have no JS exceptions');
  await modePage.close();
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
    await host.waitForFunction(()=>window.__AOM_TEST?.G.state==='title'&&window.__AOM_TEST?.FILM.buttons.length===7);
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
    await guest.waitForFunction(()=>window.__AOM_TEST?.G.state==='title'&&window.__AOM_TEST?.FILM.buttons.length===7);
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
    // Real network assertions, not two copies of an unsynchronized game.
    await host.evaluate(()=>{const a=window.__AOM_TEST;a.G.type+=3;a.NET.sendResourceDeltas()});
    await guest.waitForFunction(()=>window.__AOM_TEST?.G.type===3,null,{timeout:10000});
    await host.evaluate(()=>window.__AOM_TEST.NET.send({type:'claim',kind:'proof',key:'smoke|proof|archive'}));
    await guest.waitForFunction(()=>window.__AOM_TEST?.G.proofs===1,null,{timeout:10000});
    await host.evaluate(()=>window.__AOM_TEST.NET.send({type:'claim',kind:'quest',step:1,key:'quest|1'}));
    await guest.waitForFunction(()=>window.__AOM_TEST?.G.q===1,null,{timeout:10000});
    const times=await Promise.all([host,guest].map(page=>page.evaluate(()=>window.__AOM_TEST.G.clock)));
    assert.ok(Math.abs(times[0]-times[1])<3,'participants share the same Library clock');
    await host.evaluate(()=>{
      const a=window.__AOM_TEST;
      a.NET.publishStory({enc:'cartographer',x:a.G.x+1,y:a.G.y,pose:'count'});
    });
    await guest.waitForFunction(()=>window.__AOM_TEST?.NET.stories.size>=1,null,{timeout:10000});
    const storyId=await guest.evaluate(()=>[...window.__AOM_TEST.NET.stories.keys()][0]);
    await guest.evaluate(id=>window.__AOM_TEST.NET.send({type:'story-choice',id,choice:0}),storyId);
    await host.waitForFunction(id=>window.__AOM_TEST?.NET.stories.get(id)?.netChoice===0,storyId,{timeout:10000});
    await guest.evaluate(()=>window.__AOM_TEST.NET.send({type:'chat',text:'Hello from the shared Library'}));
    await host.waitForFunction(()=>window.__AOM_TEST?.NET.chat.some(x=>x.text.includes('Hello from')),null,{timeout:8000});
    console.log('BROWSER PASS co-op',code,'real sockets, pooled type, shared proof and quest, shared clock, resolved scene, custom puppets and chat');
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
