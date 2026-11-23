// Ashen Sphere: buildings you can go into, like caves. A doorway on a tile map opens a map of its own inside, with its
// own plan, look, threats and finds, and one prize: a trauma ward, an armoury, a fire engine pump, fuel drums, a backup
// drive, route maps, a dead colony's notebook. What you take stays taken, and old saves load as they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const KINDS = ['hospital', 'police', 'fire', 'market', 'garage', 'datacenter', 'subway', 'station', 'sewer', 'homes', 'colony'];
const PRIZE = { hospital: 'meds', police: 'arms', fire: 'hose', garage: 'fuel', datacenter: 'data', subway: 'survey', station: 'survey', colony: 'log' };
function reachable(M) {
  const MW = M.w || 11, MH = M.h || 9, seen = new Set([M.entry]), q = [M.entry];
  while (q.length) { const k = q.shift(), x = k % MW, y = (k / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const n = ny * MW + nx; if (!seen.has(n) && M.g[n] !== 1) { seen.add(n); q.push(n); } } }
  return seen;
}
// a squad out on one of your own tiles (walking your land is free)
function outOn(dev, S, T) {
  const i = [...S.owned].find(j => !S.bld[j] || S.bld[j] === 'bunker') ?? [...S.owned][0];
  dev.setView('surface'); dev.sel(i); dev.act('walk'); assert.ok(S.exp && S.exp.i === i, 'the squad is out'); return i;
}
// walk to the first find of a type, paying off any threat on the way
function reach(dev, type) {
  dev.mapState().rev = '1'.repeat(dev.mapState().rev.length);
  for (let n = 0; n < 12; n++) {
    const M = dev.map(), ms = dev.mapState(), ix = M.pois.findIndex((p, j) => p.type === type && !ms.got.includes(j));
    if (ix < 0) return null;
    if (!dev.path(M.pois[ix].k)) {   // a threat stands in the way: go and deal with it first
      const ti = M.pois.findIndex((p, j) => p.type === 'threat' && !ms.got.includes(j) && dev.path(p.k));
      assert.ok(ti >= 0, 'a way to the ' + type); dev.path(M.pois[ti].k); const c = dev.walk();
      if (c && c.kind === 'threat') { dev.act('pay'); if (dev.card()) dev.act('back'); }
      continue;
    }
    const card = dev.walk();
    if (card && card.kind === 'threat') { dev.act('pay'); if (dev.card()) dev.act('back'); continue; }
    return card;
  }
  return null;
}

test('buildings stand on the tile maps: every kind somewhere on the world, most ruins have one, and nothing on the sea', () => {
  const { dev } = boot(); const T = dev.home(), seen = {};
  let ruins = 0, ruinsWith = 0;
  T.forEach((t, i) => { if (t.b === 'sea') { assert.ok(!dev.genMap(i).pois.some(p => p.type === 'place')); return; }
    const p = dev.genMap(i).pois.filter(p => p.type === 'place');
    assert.ok(p.length <= 1, 'one building at most on tile ' + i);
    if (t.b === 'ruins') { ruins++; if (p.length) ruinsWith++; }
    for (const q of p) seen[q.kind] = (seen[q.kind] || 0) + 1; });
  for (const k of KINDS) assert.ok(seen[k] > 0, 'there is a ' + k + ' somewhere');
  assert.ok(ruinsWith / ruins > .5, 'most ruins have a building (' + ruinsWith + ' of ' + ruins + ')');
  const r0 = T.findIndex(t => t.b === 'ruins'), doors = d => JSON.stringify(d.genMap(r0).pois.filter(p => p.type === 'place'));
  assert.equal(doors(boot().dev), doors(dev), 'the same door on every boot');
});

test('every kind of building has a sound inside: floors joined by stairs, every find reachable, threats, its prize and often a hidden room', () => {
  const { dev } = boot(); let hidden = 0, all = 0;
  for (const kind of KINDS) for (const i of [5, 77, 301]) {
    const fls = dev.floors.list(kind); let prizes = 0, secrets = 0; all++;
    for (const fl of fls) {
      const M = dev.place.map(i, null, kind, fl), R = reachable(M);
      assert.equal(M.kind, kind); assert.equal(M.fl, fl); assert.notEqual(M.g[M.entry], 1, 'the way in is open');
      assert.ok(M.pois.some(p => p.type === 'threat'), kind + ' ' + fl + ' has a threat');
      const W0 = M.w || 11, next = k => [k - 1, k + 1, k - W0, k + W0].some(n => R.has(n));
      for (const p of M.pois) if (!p.stash) assert.ok(p.type === 'crack' ? next(p.k) : R.has(p.k), kind + ' ' + fl + ': the ' + p.type + ' can be reached');
      for (const d of [1, -1]) assert.equal(M.pois.some(p => p.type === 'stairs' && p.dir === d), fls.includes(fl + d), kind + ' ' + fl + ': stairs ' + (d > 0 ? 'up' : 'down') + ' only where there is a floor');
      if (PRIZE[kind]) prizes += M.pois.filter(p => p.type === PRIZE[kind]).length;
      if (M.secret) { secrets++; assert.ok(M.pois.some(p => p.type === 'crack' && p.k === M.secret.wall) && M.g[M.secret.wall] === 1 && M.pois.some(p => p.stash), 'a crack in the wall, and a stash behind it');
        assert.ok(M.pois.filter(p => p.stash).every(p => !R.has(p.k)), 'the stash is walled up'); }
      assert.equal(new Set(M.pois.map(p => p.k)).size, M.pois.length, 'no two finds on one cell');
    }
    if (PRIZE[kind]) assert.equal(prizes, 1, kind + ' has its prize on one floor');
    hidden += secrets ? 1 : 0;
  }
  assert.ok(hidden / all > .6, 'most buildings have a hidden room (' + hidden + ' of ' + all + ')');
  assert.ok(dev.floors.list('colony').some(fl => dev.place.map(9, 'mire', 'colony', fl).pois.some(p => p.type === 'log')), "Kestrel's colony on Mirewater has its log");
});

test('go into a hospital and back out: its own map, the trauma ward, and the doorway out', () => {
  const { dev, frame, A } = boot(); readyBase(dev); const S = dev.S(), T = dev.home();
  // a hospital on one of your tiles
  const i = T.findIndex((t, j) => t.b !== 'sea' && dev.genMap(j).pois.some(p => p.type === 'place' && p.kind === 'hospital'));
  assert.ok(i >= 0); S.owned.add(i); S.res = { scrap: 900, water: 400, food: 400 }; dev.run(0.01);
  dev.setView('surface'); dev.sel(i); dev.act('walk'); assert.ok(S.exp && S.exp.i === i);
  const door = reach(dev, 'place'); assert.ok(door && door.kind === 'place', 'the doorway opens a card');
  assert.match(dev.panel(), /A hospital/); const at = S.exp.pos;
  dev.act('enter'); assert.equal(S.exp.cave.kind, 'hospital'); assert.equal(dev.map().kind, 'hospital', 'inside the hospital');
  assert.match(dev.panel(), /Inside the hospital/);
  dev.setView('map'); assert.doesNotThrow(() => dev.draw()); frame(3000);
  const up = reach(dev, 'stairs'); assert.ok(up && up.kind === 'stairs', 'stairs up'); assert.match(dev.panel(), /The wards upstairs/);
  dev.act('pl:go'); assert.equal(S.exp.cave.fl, 1, 'upstairs'); assert.equal(dev.map().fl, 1); assert.match(dev.panel(), /The wards upstairs/);
  dev.setView('map'); assert.doesNotThrow(() => dev.draw());
  const was = !!S.unl.ambulance; const card = reach(dev, 'meds');
  assert.ok(card && card.kind === 'find', 'the prize opens a card'); assert.match(dev.panel(), /trauma ward|Medical gear/);
  assert.ok(S.unl.ambulance, 'hurt people heal faster'); if (!was) assert.match(S.log[0], /trauma ward/);
  dev.act('ok'); dev.act('pl:go'); assert.equal(S.exp.cave.fl, 0, 'back down'); assert.equal(S.exp.pos, dev.map().stairs.up, 'at the foot of the stairs');
  dev.act('upcave'); assert.equal(S.exp.cave, null, 'back outside'); assert.equal(S.exp.pos, at, 'at the door');
  // the ward stays taken; save and load keep it
  dev.act('enter'); dev.floors.go(1); assert.ok(dev.mapState().got.length >= 1);
  const S2 = dev.deser(JSON.parse(JSON.stringify(dev.ser()))); assert.ok(S2.inside[i + ':hospital:1'] && S2.inside[i + ':hospital:1'].got.length >= 1, 'what was taken upstairs is saved');
  assert.deepEqual([...A.bugs], []);
});

test('each prize does its job: armour then a gun, the pump, fuel, research, route maps, a blueprint', () => {
  const { dev } = boot(); readyBase(dev); const S = dev.S(), T = dev.home();
  S.res = { scrap: 900, water: 400, food: 400 }; outOn(dev, S, T);
  const prize = (kind, type) => { if (S.exp.cave) dev.act('upcave'); dev.place.enter(kind); assert.equal(dev.map().kind, kind);
    const fl = dev.floors.list(kind).find(f => dev.place.map(S.exp.i, null, kind, f).pois.some(p => p.type === type)); for (let n = 0; n < Math.abs(fl); n++) dev.floors.go(Math.sign(fl));
    const c = reach(dev, type); assert.ok(c && c.kind === 'find', kind + ': the ' + type + ' is found'); dev.act('ok'); };
  S.gear.armor = 0; S.gear.tackgun = 0; prize('police', 'arms'); assert.ok(S.gear.armor, 'riot armour');
  // the fire engine pump makes stills give more water
  const still = [...new Set([...S.owned].flatMap(i => T[i].n))].find(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  S.owned.add(still); S.bld[still] = 'still'; S.order.unshift(still); dev.run(0.01); const wa0 = dev.E().wa;
  prize('fire', 'hose'); dev.run(0.01); assert.ok(S.unl.firepump && dev.E().wa > wa0 + 1e-6, 'stills make more water');
  S.k.fuel = 0; prize('garage', 'fuel'); assert.ok(S.k.fuel > 0, 'fuel in the tanks');
  S.rs = { id: 'turbine', left: 100 }; prize('datacenter', 'data'); assert.ok(S.rs.left <= 40, 'research points off the drive');
  const seen0 = S.seen.size; prize('station', 'survey'); assert.ok(S.seen.size > seen0, 'the timetable shows far tiles');
  const n = S.bp.length; S.rs = null; prize('colony', 'log'); assert.equal(S.bp.length, n + 1, 'a dead colony teaches a blueprint');
  assert.match(dev.panel() + S.log.join(' '), /notebook|stores/);
});

test('every inside draws by day and night, old saves with a plain cave still load, and Mirewater has its lost colony', () => {
  const { dev, frame, A } = boot(); readyBase(dev); const S = dev.S(), T = dev.home();
  S.res = { scrap: 900, water: 400, food: 400 }; outOn(dev, S, T); let t = 4000;
  for (const kind of KINDS) { if (S.exp.cave) dev.act('upcave'); dev.place.enter(kind); dev.mapState().rev = '1'.repeat(dev.mapState().rev.length); dev.setView('map');
    assert.doesNotThrow(() => dev.draw(), kind + ' draws'); frame(t += 300); }
  S.t += 45; dev.run(0.01); assert.doesNotThrow(() => dev.draw()); frame(t += 300);
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  // an old save with the squad down a plain cave (no kind) loads and draws as a cave
  dev.act('upcave'); S.exp.cave = { pos: S.exp.pos };
  const old = JSON.parse(JSON.stringify(dev.ser())); delete old.inside;
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...old, saved: Date.now() })]]));
  assert.ok(b2.dev.S().exp && b2.dev.S().exp.cave && !b2.dev.S().exp.cave.kind, 'still down the cave');
  assert.ok(!b2.dev.map().kind, 'a cave map, not a building'); b2.dev.setView('map'); assert.doesNotThrow(() => b2.dev.draw());
  // Kestrel's lost colony: some Mirewater tiles have one
  const AT = dev.away('mire'); const k = AT.findIndex((t, i) => t.b !== 'msea' && dev.awayMap('mire', i).pois.some(p => p.type === 'place' && p.kind === 'colony'));
  assert.ok(k >= 0, 'a lost colony somewhere on Mirewater');
});
