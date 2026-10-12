import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline game is available');
const start=script.indexOf('function railJumpTarget(){');
const end=script.indexOf('/* fades:',start);
assert.ok(start>0&&end>start,'real rail-vault helpers are implemented in the game');
const code=script.slice(start,end);
const DAYLEN=480,P=16,FH=2.15,RS=1.7;

function harness({room=false}={}){
 const flags={screams:0,rooms:0,release:0,blackouts:0};
 const G={state:'play',x:room?0:8,y:room?2.4:0,ang:-Math.PI/2,
   inRoom:room,journal:false,floor:3,day:2,clock:150,
   room:{i:0,j:0,gid:'0,0'},cell:room?{kind:'g',cx:0,cy:0}:{kind:'a'},
   gal:'0,0',rooms:new Set(),ents:[{type:'pur'}],phantoms:[],
   time:0,playClock:0,pitch:0,oil:8,sanity:87,zoneState:new Map(),startGallery:null};
 const RH={n:1,t:[.70],kind:[1]};
 const NET={ready:false},LAMPS={key:'cached'},WD={key:'cached'};
 const bounds={air:true,block:false};
 const context=vm.createContext({G,RH,NET,LAMPS,WD,P,FH,RS,DAYLEN,
   EYE:.5,Math,
   isComm(ci,cj,fl){return ci%3===0&&cj%3===0&&fl%3===0},
   hubStride(){return 3},
   airFloor(){return bounds.air},
   walkable(x,y,r){return !bounds.block&&
     Math.hypot(x-(Math.floor(x/16)+.5)*16,y-(Math.floor(y/16)+.5)*16)>r},
   getRoom(i,j){return{i,j,gid:i+','+j,cx:i*16,cy:j*16,kind:'g'}},
   placeOf(x,y){return room?{kind:'g',cx:0,cy:0}:{kind:'a',i:0,j:0}},
   cast(){return{t:12}},
   spawnRoom(){flags.rooms++},
   releaseAll(){flags.release++},
   snd(){flags.screams++},sfx(){},
   blackout(){flags.blackouts++;G.state='blackout'}
 });
 vm.runInContext(code,context);
 const run=c=>vm.runInContext(c,context);
 return{G,RH,NET,LAMPS,WD,flags,bounds,run};
}

test('jump works only in play state, near a real railing and facing the edge',()=>{
 const a=harness();
 assert.ok(a.run('railJumpTarget()'));
 a.G.state='book';assert.equal(a.run('railJumpTarget()'),null);
 a.G.state='play';a.RH.n=0;assert.equal(a.run('railJumpTarget()'),null);
 a.RH.n=1;a.RH.kind[0]=2;assert.equal(a.run('railJumpTarget()'),null);
 a.RH.kind[0]=1;a.G.journal=true;assert.equal(a.run('railJumpTarget()'),null);
 a.G.journal=false;
 assert.equal(a.run('startRailFreefall()'),true);
 assert.equal(a.G.state,'freefall');
 assert.equal(a.flags.release,1);
 assert.equal(a.G.fall.fromFloor,3);
 assert.equal(a.G.fall.kind,'catwalk');
});
test('round central-shaft railing can be vaulted only toward the hole',()=>{
 const a=harness({room:true});
 assert.equal(a.run('railJumpTarget().kind'),'shaft');
 a.G.ang=Math.PI/2;
 assert.equal(a.run('railJumpTarget()'),null);
 a.G.ang=-Math.PI/2;
 assert.equal(a.run('startRailFreefall()'),true);
 assert.ok(Math.hypot(a.G.x,a.G.y)<RS);
});
test('fall keeps descending across levels without landings or inventory losses',()=>{
 const a=harness();a.G.clock=200;
 assert.equal(a.run('startRailFreefall()'),true);
 const source=a.G.fall.fromFloor,health=a.G.sanity,oil=a.G.oil;
 a.run('tickRailFreefall(5)');
 assert.ok(a.G.floor<source,'real floor number keeps dropping');
 assert.ok(a.G.fall.depth>0&&a.G.fall.speed>0);
 assert.equal(a.G.state,'freefall');
 assert.equal(a.G.clock,205);
 assert.equal(a.G.sanity,health);assert.equal(a.G.oil,oil);
 a.run('tickRailFreefall(25)');
 assert.ok(a.G.floor<source-100,'no floor ever catches the player');
 assert.equal(a.G.state,'freefall');
});
test('midnight triggers normal blackout; wake goes to nearest community hub',()=>{
 const a=harness();const original={x:a.G.x,y:a.G.y,floor:a.G.floor};
 a.G.clock=DAYLEN-.05;
 assert.equal(a.run('startRailFreefall()'),true);
 a.run('tickRailFreefall(.15)');
 assert.equal(a.G.state,'blackout');assert.equal(a.flags.blackouts,1);
 a.G.day++;
 assert.equal(a.run('recoverRailFreefall()'),true);
 assert.equal(a.G.fall,null);assert.equal(a.G.fallWakeDay,a.G.day);
 assert.equal(a.G.floor%3,0,'the wake floor must have real community facilities');
 assert.equal(a.G.floor,3,'recovery is near jump floor, not visual fall floor');
 assert.ok(a.run('isComm(Math.round(G.x/P-.5),Math.round(G.y/P-.5),G.floor)'));
 assert.ok(a.run('walkable(G.x,G.y,.28)'),'recovery location is clear of barriers');
 assert.equal(a.flags.rooms,1,'populate the waking area once');
 assert.notDeepEqual({x:a.G.x,y:a.G.y},original);
 assert.equal(a.G.sanity,87);assert.equal(a.G.oil,8);
});
test('co-op falling obeys server midnight, and blocked hub prevents unsafe wake',()=>{
 const a=harness();a.NET.ready=true;a.G.clock=479.9;
 assert.equal(a.run('startRailFreefall()'),true);
 a.run('tickRailFreefall(30)');
 assert.equal(a.G.clock,479.9);
 assert.equal(a.G.state,'freefall');
 assert.equal(a.flags.blackouts,0);
 a.G.day=3;
 assert.equal(a.run('recoverRailFreefall()'),true);
 assert.equal(a.G.fallWakeDay,3);
 const b=harness();b.bounds.block=true;
 assert.equal(b.run('nearestFallCommunity(8,0,3)'),null);
 assert.equal(b.run('startRailFreefall()'),false);
 assert.equal(b.G.state,'play','invalid landing cannot strand a player in freefall');
});
test('integrated controls and wake paths include keyboard, touch and multiplayer',()=>{
 assert.match(script,/KeyG'&&G\.state==='play'/);
 assert.match(script,/RAIL_JUMP_BUTTON&&pt\.x/);
 assert.match(script,/if\(G\.state==='freefall'\)\{drawRailFreefallHUD\(\);return\}/);
 assert.match(script,/if\(G\.fall\)recoverRailFreefall\(\)/);
 assert.match(script,/if\(fell\)\{recoverRailFreefall\(\);G\.state='wake'/);
 assert.doesNotThrow(()=>new vm.Script(script));
});
