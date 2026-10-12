import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const begin=script.indexOf('const TITLE_SHOT_SECONDS=');
const end=script.indexOf('function titleFlyRender(',begin);
const helpers=script.slice(script.indexOf('function hashStr('),script.indexOf('/* gallery (i,j)'));
assert.ok(begin>0&&end>begin);
const art=script.slice(begin,end);

function director(){
 const rooms=new Map(),bridges=new Map();
 const zone=(map,axis,i,j,fl=0)=>{
   const key=axis+'|'+i+'|'+j+'|'+fl;
   if(!map.has(key))map.set(key,{type:'normal'});
   return map.get(key);
 };
 const context=vm.createContext({
   Math,P:16,FH:2.15,RAILH:.34,PS:1.35/60,VISIBLE_FLOORS:2,
   G:{phrase:'the lamp forgot'},FILM:{clock:0},CALM:false,
   galleryZone:(i,j,fl)=>zone(rooms,'g',i,j,fl),
   bridgeZone:(axis,i,j,fl)=>zone(bridges,axis,i,j,fl)
 });
 vm.runInContext(helpers+'\n'+art,context);
 const run=s=>vm.runInContext(s,context);
 run('titleFlyEnsure()');
 return {run,rooms,bridges};
}
test('twenty seeded scripted scenes use actual in-engine puppet roles',()=>{
 const d=director();
 const list=d.run('TITLE_FLY.scenes.map(s=>({id:s.id,action:s.action,camera:s.camera,duration:s.duration}))');
 assert.equal(list.length,20);
 assert.ok(list.every(s=>s.duration>=19&&s.duration<=30));
 for(const action of ['fight','arson','hanging','barricade','convert','worship','madness','jumpLine','fallRain','airSwim','stampede','chase','research'])
   assert.ok(list.some(s=>s.action===action),action+' deserves a scripted performance');
 for(const camera of ['walk','pan','orbit','bridge','shaft','crane','freefall','air'])
   assert.ok(list.some(s=>s.camera===camera),'missing '+camera+' camera path');
 const first=d.run('TITLE_FLY.scenes.map(s=>s.id)');
 assert.deepEqual(d.run('titleSceneGenerator(hashStr("game-asset-flythrough|the lamp forgot")).map(s=>s.id)'),first);
});
test('aerial camera crosses multiple actual library floors',()=>{
 const d=director();
 const views=d.run("TITLE_FLY.scenes.filter(s=>['freefall','air','crane'].includes(s.camera)).map(s=>({camera:s.camera,start:titleScenePose(s,0),mid:titleScenePose(s,.5),end:titleScenePose(s,1)}))");
 assert.ok(views.length>=4);
 assert.ok(views.filter(v=>v.start.floor!==v.end.floor).length>=3);
 assert.ok(views.filter(v=>v.camera==='freefall').every(v=>v.end.floor<=v.start.floor-5));
 for(const v of views)for(const q of [v.start,v.mid,v.end]){
   assert.ok(Number.isFinite(q.eye)&&q.eye>=0&&q.eye<2.15);
   assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.ang)&&Number.isInteger(q.floor));
 }
 assert.match(script,/renderScene\(\[\]\)/);
 assert.match(script,/G\.floor=position\.floor/);
 assert.match(script,/addFiveFloorDressing\(list\)/);
});
test('worship, hanging, arson, conversion, fight and barricades use real rig poses',()=>{
 const d=director();
 const states=d.run("['worship','hanging','arson','convert','fight','barricade'].map(action=>{const shot=TITLE_FLY.scenes.find(s=>s.action===action),cam=titleScenePose(shot,.75),cast=titleSceneAnimate(shot,cam,shot.duration*.75);return{action,count:cast.length,pose:cast.map(a=>a.pose),types:cast.map(a=>a.type),burning:cast.filter(a=>a.burning).length,raising:cast.some(a=>a.raise>0)};})");
 assert.ok(states.find(s=>s.action==='worship').pose.includes('kneel'));
 assert.ok(states.find(s=>s.action==='hanging').pose.includes('hang'));
 assert.ok(states.find(s=>s.action==='arson').burning>=2);
 assert.ok(states.find(s=>s.action==='arson').raising);
 assert.ok(states.find(s=>s.action==='convert').types.filter(t=>t==='pur').length>2);
 assert.ok(states.find(s=>s.action==='fight').pose.includes('beat'));
 assert.ok(states.find(s=>s.action==='barricade').pose.includes('carry'));
 assert.ok(states.every(s=>s.count>=6));
});
test('repeat jumpers and falling crowd remain populated across track',()=>{
 const d=director();
 const frames=d.run("['jumpLine','fallRain'].map(action=>{const s=TITLE_FLY.scenes.find(s=>s.action===action);return[.1,.42,.8].map(u=>{const cam=titleScenePose(s,u),actors=titleSceneAnimate(s,cam,s.duration*u);return{action,n:actors.length,falling:actors.filter(e=>e.pose==='fall').length,heights:new Set(actors.map(e=>Math.round(e.zw*3))).size};});})");
 assert.ok(frames[0].some(f=>f.falling>=2));
 assert.ok(frames[1].every(f=>f.falling>=10&&f.heights>=8));
});
test('scene generator builds real five-floor environments with local barricades',()=>{
 const d=director(),result=d.run("(()=>{const s=TITLE_FLY.scenes.find(s=>s.action==='barricade');titleStageScene(s);const b=galleryZone(s.i+1,s.j,s.floor),floors=Array.from({length:5},(_,i)=>galleryZone(s.i,s.j,s.floor+i-2).type),span=bridgeZone('v',s.i,s.j,s.floor);return{barricade:b.type,blocked:b.breached===false,floors,span:span.type,variant:s.variant};})()");
 assert.equal(result.barricade,'barricaded');
 assert.equal(result.blocked,true);
 assert.equal(result.floors.length,5);
 assert.equal(result.span,result.variant);
});
test('variable shot timing and manual skip land at new scene start',()=>{
 const d=director(),first=d.run('titleFlyTime(0)');
 assert.equal(first.local,0);
 assert.ok(first.shot.duration>=19);
 d.run('FILM.clock=titleFlyTime(0).shot.duration*.3;titleNextScene()');
 assert.equal(d.run('titleFlyTime(FILM.clock).index'),1);
 assert.equal(d.run('titleFlyTime(FILM.clock).local<.1'),true);
});
