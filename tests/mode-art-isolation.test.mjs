import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MODE_MAPS as SERVER_MAPS} from '../mode-maps.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const part=(start,end)=>{
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,'missing real game code '+start);
  return script.slice(a,b);
};
function environment(){
  const ctx=vm.createContext({
    G:{resetEpoch:1,floor:0,startGallery:null,zoneState:new Map()},
    NET:{zones:new Map()},
    FILM:{gameMode:'story'},
    TITLE_FLY:{previewing:false},
    MODE:{type:'story'}
  });
  vm.runInContext([
    part('function hashStr(','/* cast one ray'),
  ].join('\n'),ctx);
  return {ctx,run:source=>vm.runInContext(source,ctx)};
}
test('story never generates the expanded art-update galleries or bridges',()=>{
  const s=environment(),legacy=new Set(['normal','burned','burning','barricaded','refuge']);
  for(let i=-45;i<=45;i++)for(let j=-8;j<=8;j++){
    assert.ok(legacy.has(s.run(`galleryZone(${i},${j}).type`)),`story gallery ${i},${j}`);
    assert.equal(s.run(`bridgeZone('h',${i},${j}).type`),'plain');
  }
});
test('older saved expanded zones cannot leak into original story',()=>{
  const s=environment();
  s.run("galleryZone(4,2).type='confession';bridgeZone('h',4,2).type='cage'");
  assert.ok(s.run("STORY_GALLERY_TYPES.has(galleryZone(4,2).type)"));
  assert.equal(s.run("bridgeZone('h',4,2).type"),'plain');
});
test('both alternative modes retain special rooms, bridges and their dedicated props',()=>{
  const s=environment();
  for(const mode of ['impostor','horde']){
    s.ctx.MODE.type=mode;s.ctx.G.zoneState.clear();
    const galleries=new Set(),bridges=new Set();
    for(let i=-25;i<=25;i++)for(let j=-5;j<=5;j++){
      galleries.add(s.run(`galleryZone(${i},${j}).type`));
      bridges.add(s.run(`bridgeZone('h',${i},${j}).type`));
    }
    assert.ok(galleries.has('study')&&galleries.has('confession')&&galleries.has('obliterated'),mode);
    assert.ok(bridges.has('cage')&&bridges.has('research'),mode);
  }
  const local=script.slice(script.indexOf('const MODE_MAPS='),script.indexOf('const DEPOT_X='));
  for(const mode of ['impostor','horde']){
    for(const zone of SERVER_MAPS[mode].zones)assert.ok(local.includes("'"+zone+"'"),mode+' zone '+zone);
    for(const bridge of SERVER_MAPS[mode].bridges)assert.ok(local.includes("'"+bridge+"'"),mode+' bridge '+bridge);
  }
});
test('title preview is gated by selected game type rather than the prior playable mode',()=>{
  const s=environment();s.ctx.TITLE_FLY.previewing=true;
  s.ctx.MODE.type='story';s.ctx.FILM.gameMode='horde';
  assert.equal(s.run('expandedEnvironment()'),true);
  s.ctx.FILM.gameMode='impostor';
  assert.equal(s.run('expandedEnvironment()'),true);
  s.ctx.FILM.gameMode='story';s.ctx.MODE.type='horde';
  assert.equal(s.run('expandedEnvironment()'),false);
  assert.match(script,/const variant=expanded\?shot\.variant/);
  assert.match(script,/bridgeZone\('v',shot\.i,j,fl\)\.type=expanded\?shot\.variant:'plain'/);
});
