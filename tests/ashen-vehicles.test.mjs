// Ashen Sphere, slice 2 (the No Man's Sky layer): the garage and its three vehicles, caves under the tile maps,
// seabeds for the diving bell, rare artifacts and Builder glyphs. Played through the page's own code, like a player.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const MW = 11, MH = 9;

// A scripted player for one tile map: picks up what it can reach, otherwise walks into the nearest fog.
// Threats are paid off (or stepped back from), events are left alone, landmarks and finds are acknowledged.
function explore(dev, { onCave = 'back' } = {}) {
  for (let guard = 0; guard < 200; guard++) {
    const card = dev.card();
    if (card) {
      if (card.kind === 'threat') { dev.act('pay'); if (dev.card()) dev.act('fight'); if (dev.card()) dev.act('back'); continue; }
      if (card.kind === 'event') { dev.act('ev:close'); continue; }
      if (card.kind === 'cave') { dev.act(onCave); if (onCave === 'down') return 'down'; continue; }
      if (card.kind === 'out') return 'out';
      dev.act('ok'); continue;
    }
    if (!dev.S().exp) return 'left';
    const M = dev.map(), ms = dev.mapState(), skip = new Set(M.pois.filter(p => p.type === 'event' || p.type === 'cave').map(p => p.k));
    let moved = false;
    for (const [ix, p] of M.pois.entries()) {
      if (ms.got.includes(ix) || skip.has(p.k) || ms.rev[p.k] !== '1') continue;
      if (dev.path(p.k)) { dev.walk(); moved = true; break; }
    }
    if (moved) continue;
    for (let k = 0; k < MW * MH && !moved; k++) {
      if (ms.rev[k] === '1' || skip.has(k)) continue;
      const x = k % MW, y = (k / MW) | 0;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return false; const n = ny * MW + nx; return ms.rev[n] === '1' && M.g[n] !== 1; });
      if (edge && dev.path(k)) { dev.walk(); moved = true; }
    }
    if (!moved) return 'done';
  }
  return 'guard';
}

function withGarage(dev) {
  const S = dev.S(), T = dev.home();
  const spot = [...S.owned].find(i => !S.bld[i] && T[i].b !== 'sea') ??
    [...new Set([...S.owned].flatMap(i => T[i].n))].find(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  S.owned.add(spot);
  dev.setView('surface'); dev.sel(spot);
  assert.match(dev.panel(), /Garage/, 'the garage is offered once Lantern-2 is back');
  S.res.scrap = 840; S.res.water = 400;
  dev.act('build:garage');
  assert.equal(S.bld[spot], 'garage');
  return spot;
}

test('the garage builds three vehicles, each once', () => {
  const { dev } = boot();
  readyBase(dev);
  const S = dev.S();
  const g = withGarage(dev);
  dev.sel(g);
  assert.match(dev.panel(), /Build the Ash Crawler/);
  for (const k of ['crawler', 'skimmer', 'bell']) { S.res.scrap = 840; S.res.water = 400; dev.act('veh:' + k); }
  assert.equal(JSON.stringify(S.veh), JSON.stringify({ crawler: 1, skimmer: 1, bell: 1 }));
  assert.doesNotMatch(dev.panel(), /Build the /, 'nothing left to build');
  const scrap = S.res.scrap; dev.act('veh:crawler'); assert.equal(S.res.scrap, scrap, 'a vehicle is built once');
});

test('the crawler, the skimmer and artifacts change how a squad explores', () => {
  const { dev } = boot();
  readyBase(dev);
  const S = dev.S(), T = dev.home(), f = dev.fn;
  const p0 = f.squadP().P;
  S.veh.crawler = 1;
  assert.equal(f.squadP().P, p0 + 1, 'the crawler adds strength on the surface');
  // the skimmer lets a squad reach a tile two out from your land
  const two = T.findIndex((t, i) => t.b !== 'sea' && !S.owned.has(i) && !t.n.some(j => S.owned.has(j)) && t.n.some(j => T[j].n.some(k => S.owned.has(k))));
  assert.ok(two >= 0);
  assert.equal(f.reachHome(two), false);
  S.veh.skimmer = 1;
  assert.equal(f.reachHome(two), true);
  // rough ground costs 1 with the crawler, on the surface only
  dev.setView('surface'); dev.sel(two); dev.act('explore');
  assert.ok(S.exp, 'the squad set out to the far tile');
  const M = dev.map(), rough = M.g.findIndex(v => v === 2);
  assert.equal(f.stepCost(M, rough), 1);
  delete S.veh.crawler;
  assert.equal(f.stepCost(M, rough), 2);
  // the Builder Lens adds a cell of sight everywhere
  const s0 = f.sightR(two); S.arts.push('lens'); assert.equal(f.sightR(two), s0 + 1);
  dev.act('leave');
});

test('the diving bell opens seabeds at home, and clearing one charts the water', () => {
  const { dev } = boot();
  readyBase(dev);
  const S = dev.S(), T = dev.home();
  // give the base a stretch of coast, then pick the water next to it
  const shore = T.findIndex((t, i) => t.b !== 'sea' && t.coast && !t.pent);
  S.owned.add(shore);
  const sea = T[shore].n.find(j => T[j].b === 'sea');
  assert.ok(sea >= 0, 'a sea tile touches the base');
  for (const j of [shore, ...T[shore].n]) S.seen.add(j);
  dev.setView('surface'); dev.sel(sea);
  assert.match(dev.panel(), /diving bell from the garage/);
  S.veh.bell = 1; dev.sel(sea);
  assert.match(dev.panel(), /Send the bell down/);
  S.res.food = 400; S.res.water = 400;
  dev.act('explore');
  assert.ok(S.exp && S.exp.sea, 'the squad is under water');
  const M = dev.map();
  assert.ok(M.pois.some(p => p.label === 'a wreck'), 'seabeds have wrecks');
  assert.ok(M.pois.some(p => p.type === 'threat' && ['eels', 'jelly', 'crab'].includes(p.t)), 'and sea threats');
  // pay or fight past every threat with plenty of supplies
  for (let n = 0; n < 6 && S.exp; n++) { S.res.scrap = 400; S.res.food = 400; S.res.water = 400; S.exp.sup = 99; dev.mapState().rev = '1'.repeat(MW * MH); explore(dev); }
  assert.equal(S.wet[sea], 1, 'the water is charted once its threats are gone');
  assert.ok(!S.owned.has(sea), 'charting water does not claim it');
  if (S.exp) dev.act('leave');
  dev.sel(sea);
  assert.match(dev.panel(), /Charted water/);
});

test('caves: climb down, find an artifact or a glyph, climb back up', () => {
  const { dev } = boot();
  readyBase(dev);
  const S = dev.S(), T = dev.home();
  // a tile whose map has a cave mouth, with something worth finding below
  let tile = -1;
  for (let i = 0; i < T.length && tile < 0; i++) {
    if (T[i].b === 'sea') continue;
    const M = dev.genMap(i);
    if (!M.pois.some(p => p.type === 'cave')) continue;
    const C = dev.caveMap(i, null);
    if (C.pois.some(p => p.type === 'artifact') && C.pois.some(p => p.type === 'ruin')) tile = i;
  }
  assert.ok(tile >= 0, 'some cave on the Ashen World holds both an artifact and a ruin');
  S.owned.add(tile);   // walk it as your own land: no supplies needed
  dev.setView('surface'); dev.sel(tile); dev.act('walk');
  assert.ok(S.exp && !S.exp.cave);
  const M = dev.map(), mouth = M.pois.findIndex(p => p.type === 'cave');
  dev.mapState().rev = '1'.repeat(MW * MH);
  assert.ok(dev.path(M.pois[mouth].k), 'a path to the cave mouth');
  dev.walk();
  assert.equal(dev.card().kind, 'cave');
  assert.match(dev.panel(), /Climb down/);
  dev.act('down');
  assert.ok(S.exp.cave, 'the squad is in the cave');
  assert.notEqual(dev.map(), M, 'the map is the cave now');
  assert.match(dev.panel(), /The cave under the/);
  const arts0 = S.arts.length, glyphs0 = S.glyphs;
  for (let n = 0; n < 4; n++) { S.res.food = 400; S.res.water = 400; S.res.scrap = 400; dev.mapState().rev = '1'.repeat(MW * MH); explore(dev); }
  assert.equal(S.arts.length, arts0 + 1, 'the artifact is yours');
  assert.equal(S.glyphs, glyphs0 + 1, 'the glyph is copied');
  dev.act('upcave');
  assert.ok(!S.exp.cave, 'back on the surface');
  assert.equal(S.exp.pos, M.pois[mouth].k, 'standing at the cave mouth');
  dev.act('leave');
  // the artifact does what it says
  const k = S.arts.at(-1);
  assert.ok(['lens', 'ember', 'lamp'].includes(k), 'a home cave artifact: ' + k);
});

test('artifacts change the base: Ember Heart, Root Seed, Wyrm Pearl, Kestrel Black Box', () => {
  const { dev } = boot();
  const pad = readyBase(dev);
  const S = dev.S();
  S.ug['1,1'] = { d: 1, room: 'gen' }; S.order.push('u:1,1'); dev.run(0.01);
  const e0 = dev.E();
  const power0 = e0.power.supply, store0 = e0.store, food0 = e0.fo;
  S.arts.push('ember', 'pearl', 'seed'); dev.run(0.01);
  const e1 = dev.E();
  assert.equal(e1.power.supply, power0 + 1, 'Ember Heart: +1 power per generator');
  assert.equal(e1.store, store0 + 300, 'Wyrm Pearl: +100 per storage room (3 rooms)');
  assert.ok(e1.fo > food0, 'Root Seed: food rooms grow more');
  dev.setView('surface'); dev.sel(pad);
  const dv0 = +dev.panel().match(/Delta-v (\d+) of/)[1];
  S.arts.push('box'); dev.sel(pad);
  const dv1 = +dev.panel().match(/Delta-v (\d+) of/)[1];
  assert.ok(dv1 > dv0 * 1.04, 'Kestrel Black Box: engines 5% better');
});

test('an expedition can carry one vehicle: the diving bell dives Mirewater', () => {
  const { dev } = boot();
  const pad = readyBase(dev);
  const S = dev.S();
  S.veh = { bell: 1, skimmer: 1 };
  dev.setView('surface'); dev.sel(pad);
  const cap0 = dev.fn.holdCap(S.k.ship, '');
  for (let n = 0; n < 3 && S.k.veh !== 'bell'; n++) dev.act('xd:veh');   // none, skimmer, bell
  assert.equal(S.k.veh, 'bell');
  assert.match(dev.panel(), /Vehicle: Diving Bell/);
  assert.equal(dev.fn.holdCap(S.k.ship, 'bell'), cap0 - 40, 'the bell takes 2 hold slots');
  dev.act('xlaunch');
  assert.ok(S.x, 'launched');
  assert.equal(S.x.veh, 'bell');
  assert.equal(S.x.cap, cap0 - 40);
  dev.run(21); dev.run(31);
  dev.setView('away');
  const A = dev.away('mire');
  const site = A.findIndex((t, i) => t.b !== 'msea' && !t.pent && t.n.some(j => A[j].b === 'msea'));
  dev.sel(site); dev.act('land');
  const water = A[site].n.find(j => A[j].b === 'msea');
  dev.sel(water);
  assert.match(dev.panel(), /Take the bell down/);
  dev.act('xexplore');
  assert.ok(S.exp && S.exp.sea && S.exp.away, 'the crew is under the black water');
  const M = dev.map();
  assert.ok(M.pois.some(p => p.type === 'threat' && ['eels', 'jelly', 'wyrm'].includes(p.t)), 'Mirewater sea threats');
  explore(dev);
  if (S.exp) dev.act(dev.card() && dev.card().kind === 'out' ? 'out' : 'leave');
  // anything found below comes home with the crew: artifacts and glyphs too
  S.x.arts.push('pearl'); S.x.glyphs += 2;
  dev.sel(site); dev.act('flyhome'); dev.run(31);
  assert.equal(S.x, null);
  assert.ok(S.arts.includes('pearl'), 'the artifact came home');
  assert.ok(S.glyphs >= 2, 'the glyphs came home');
  assert.ok(S.log.some(l => /Rare artifacts: Wyrm Pearl/.test(l)));
});

test('saves: version 9 keeps vehicles, artifacts, glyphs and a squad in a cave; version 8 loads', () => {
  const { dev } = boot();
  readyBase(dev);
  const S = dev.S();
  S.veh = { crawler: 1 }; S.arts = ['lens']; S.glyphs = 3; S.wet = { 5: 1 };
  const snap = JSON.parse(JSON.stringify(dev.ser()));
  assert.equal(snap.v, 9);
  const back = dev.deser(snap);
  assert.equal(JSON.stringify(back.veh), '{"crawler":1}');
  assert.equal(back.arts.join(), 'lens');
  assert.equal(back.glyphs, 3);
  assert.equal(back.wet[5], 1);
  const v8 = JSON.parse(JSON.stringify(snap));
  v8.v = 8; for (const k of ['veh', 'arts', 'glyphs', 'wet', 'caves']) delete v8[k];
  const m = dev.deser(v8);
  assert.ok(m, 'a version 8 save loads');
  assert.equal(JSON.stringify(m.veh), '{}');
  assert.equal(m.arts.length, 0);
  assert.equal(m.glyphs, 0);
});
