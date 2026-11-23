// Ashen Sphere, slice 3: first contact and the first route. The Tidefolk live on a reed shore of Mirewater; a gift
// by their tracks marks the village; there you trade from the hold, they come to trust you, teach you tide
// gardening, and a grower comes home (drinks double, stops work when water runs low, grows food faster). An outpost
// on Mirewater gathers on its own, and a hauler flies it home by itself, trading scrap to the Tidefolk for food.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

// a crew of two down on Mirewater, with scrap in the hold
function landed() {
  const b = boot(), { dev } = b; const pad = readyBase(dev); const S = dev.S();
  const crew = S.people.splice(0, 2); S.pop = S.people.length;
  const A = dev.away('mire'), v = dev.tide.tile();
  const site = A.findIndex((t, i) => t.b !== 'msea' && !t.pent && i !== v && !t.n.includes(v));
  S.x = { w: 'mire', phase: 'orbit', t: 0, total: 30, crew, steps: 60, hold: { scrap: 150, water: 0, food: 0 }, cap: 400, notes: [], site: -1, hurt: 0, boost: -1,
    paid: { parts: 0, rations: {}, fuel: 0 }, veh: '', arts: [], glyphs: 0, enc: null, encLeg: '' };
  dev.run(0.01); dev.setView('away'); dev.sel(site); dev.act('land');
  assert.equal(S.x.phase, 'landed'); assert.equal(S.x.site, site);
  return { ...b, S, AT: A, v, site, crew, pad };
}
// walk the crew onto the village (its tile charted first, so the walk is free and the threats are gone)
function walkIn(dev, S, v) {
  S.xw.mire.charted[v] = 1; dev.sel(v); dev.act('xwalk');
  assert.ok(S.exp && S.exp.i === v && S.exp.away, 'the crew walks the village tile');
  dev.mapState().rev = '1'.repeat(dev.mapState().rev.length);   // seen it all
  const M = dev.map(), k = M.pois.find(p => p.type === 'village').k;
  assert.ok(dev.path(k), 'a path to the village'); return dev.walk();
}

test('the Tidefolk live on a Mirewater shore, the same place every time, and only that tile map has their village', () => {
  const { dev } = boot(); const A = dev.away('mire'), v = dev.tide.tile();
  assert.ok(A[v].b !== 'msea' && !A[v].pent && A[v].coast, 'on land by the black water');
  assert.equal(dev.awayMap('mire', v).pois.filter(p => p.type === 'village').length, 1, 'the village is on its map');
  let others = 0;
  for (let i = 0; i < A.length && others < 40; i++) if (i !== v && A[i].b !== 'msea') { others++; assert.ok(!dev.awayMap('mire', i).pois.some(p => p.type === 'village'), 'no village on tile ' + i); }
  assert.equal(boot().dev.tide.tile(), v, 'the same shore on every boot');
});

test('a gift by the tracks marks the village; there you trade, they trust you, teach you, and a grower comes home', () => {
  const { dev, S, v, site } = landed();
  // leave a gift by the tracks while walking the landing site
  dev.sel(site); dev.act('xwalk'); assert.ok(S.exp);
  assert.ok(dev.tide.ev('tracks_gift'), 'the gift is left');
  assert.ok(dev.tide.state().t.seen, 'the village is now marked');
  assert.match(S.log[0], /village is marked on your map/);
  assert.equal(dev.tide.blds()[v], 'village', 'the village stands on the Mirewater globe');
  dev.act('leave');
  // first contact
  const card = walkIn(dev, S, v);
  assert.ok(card && card.kind === 'village', 'stepping in opens the village');
  let t = dev.tide.state().t;
  assert.ok(t.met, 'first contact');
  assert.equal(t.trust, 0.75, 'one gift: wary, but not for long');
  assert.match(dev.panel(), /The Tidefolk · wary/);
  dev.act('tf:gift');
  assert.ok(dev.tide.state().t.trust >= 1, 'a gift in person: curious');
  // trade scrap from the hold for food and water
  const h0 = { ...S.x.hold };
  dev.act('tf:food'); dev.act('tf:water'); dev.act('tf:food');
  assert.equal(S.x.hold.scrap, h0.scrap - 45, 'three deals of 15 scrap');
  assert.ok(S.x.hold.food > h0.food + 50 && S.x.hold.water > h0.water + 25, 'food and water in the hold');
  t = dev.tide.state().t;
  assert.ok(t.trust >= 2, 'three deals make them friendly (' + t.trust + ')');
  assert.match(dev.panel(), /Learn tide gardening/);
  dev.act('tf:recipe'); assert.ok(S.x.notes.includes('tidegarden'), 'tide gardening goes in the codex notes');
  const n = S.x.crew.length, cap = S.x.cap; dev.act('tf:join');
  assert.equal(S.x.crew.length, n + 1, 'a grower joins the crew');
  assert.equal(S.x.cap, cap - 20, 'riding home in the hold, one slot');
  const g = S.x.crew.at(-1); assert.equal(g.kin, 'tide'); assert.equal(g.sk, 'grow');
  dev.act('tf:join'); assert.equal(S.x.crew.length, n + 1, 'only one at a time');
  dev.act('ok'); dev.act('leave');
  // home: the Tidefolk lives at the base and tide gardening is learned
  S.x.phase = 'back'; S.x.t = S.x.total; dev.run(1);
  assert.equal(S.x, null, 'the ship is home');
  assert.ok(S.people.some(p => p.kin === 'tide' && p.name === g.name), g.name + ' lives at the base');
  assert.ok(S.unl.tidegarden && S.codex.found.includes('tidegarden'), 'tide gardening is in the codex');
});

test('a Tidefolk at the base grows food half again as fast, drinks double, and stops work when water runs low', () => {
  const b = boot(), { dev } = b; readyBase(dev); const S = dev.S(), T = dev.home();
  const j = [...new Set([...S.owned].flatMap(i => T[i].n))].find(i => !S.owned.has(i) && T[i].b !== 'sea' && !T[i].pent);
  S.owned.add(j); S.bld[j] = 'green'; S.order.unshift(j);
  S.res.water = 300; dev.run(0.01);
  const wa0 = dev.E().wa;
  S.people.push({ id: 777, name: 'Oru', sk: 'grow', lv: 3, tr: 'cautious', kin: 'tide' }); S.pop = S.people.length;
  dev.run(0.01); let E = dev.E();
  assert.equal(E.who.get(j) && E.who.get(j).id, 777, 'the Tidefolk takes the greenhouse');
  assert.ok(E.bonus.get(j) >= 1.8, 'grower 3 and Tidefolk: +80% (' + E.bonus.get(j) + ')');
  assert.ok(E.wa < wa0 - 0.0001, 'they drink more than the base made before');
  S.res.water = 5; dev.run(0.01); E = dev.E();
  assert.ok(![...E.who.values()].some(p => p.id === 777), 'dry: they stop work');
  assert.match(S.log.join(' '), /drying out/);
  S.res.water = 300; dev.run(0.01);
  assert.ok([...dev.E().who.values()].some(p => p.id === 777), 'with water to spare they work again');
  assert.match(dev.panel() + '', /./);
});

test('an outpost on Mirewater gathers, and a hauler flies its stock home by itself, trading scrap for food', () => {
  const { A, dev, S, v, site, frame } = landed();
  dev.sel(site); assert.match(dev.panel(), /Build an outpost/);
  const sc = S.x.hold.scrap; dev.act('tf:outpost');
  const out = dev.tide.state().out; assert.ok(out && out.i === site, 'the outpost stands where the ship landed');
  assert.equal(S.x.hold.scrap, sc - 40);
  assert.equal(dev.tide.blds()[site], 'ship', 'the ship still shows on its tile');
  // the Tidefolk are friends already, so they bring food to the outpost too
  Object.assign(S.xw.mire.tide, { met: true, seen: true, trust: 2 });
  dev.tide.tick(100, true);
  const st = dev.tide.state().out.stock, tot = st.scrap + st.water + st.food;
  assert.ok(tot > 10 && st.food > 0, 'it gathers while nobody is there (' + JSON.stringify(st) + ')');
  // the crew goes home; a hauler is built at the pad
  S.x.phase = 'back'; S.x.t = S.x.total; dev.run(1); assert.equal(S.x, null);
  assert.match(dev.tide.route(), /Build a hauler/);
  S.res.scrap = 600; S.k.fuel = 200; dev.act('tf:haul');
  assert.ok(dev.tide.state().haul, 'the hauler is built'); assert.equal(S.res.scrap, 350);
  const r0 = { ...S.res }, f0 = S.k.fuel;
  for (let k = 0; k < 200 && dev.tide.state().haul.trips < 1; k++) dev.tide.tick(1, false);
  const h = dev.tide.state().haul;
  assert.equal(h.trips, 1, 'one round trip'); assert.equal(h.phase, 'home');
  assert.equal(f0 - S.k.fuel, 30, 'a trip burns 30 fuel');
  assert.ok(S.res.food > r0.food + 20, 'food from the outpost and the Tidefolk comes home');
  assert.ok(S.res.scrap <= r0.scrap - 20 + st.scrap + 1, 'scrap went out to trade');
  assert.match(S.log[0], /hauler is home from Mirewater/);
  // no fuel: it waits on the pad
  S.k.fuel = 0; for (let k = 0; k < 20; k++) dev.tide.tick(1, true);
  assert.equal(dev.tide.state().haul.phase, 'home'); assert.match(dev.tide.route(), /waiting for 30 fuel/);
  // it draws on the system map, and the saves keep all of it
  dev.setView('stars'); assert.doesNotThrow(() => dev.draw()); frame(5000);
  const S2 = dev.deser(JSON.parse(JSON.stringify(dev.ser())));
  assert.equal(S2.xw.mire.out.i, site); assert.equal(S2.xs.haul.trips, 1); assert.equal(S2.xw.mire.tide.trust >= 2, true);
});

test('Mirewater shows the village, the outpost and people about their day, and old saves without any of it load', () => {
  const { A, dev, S, v, site, frame } = landed();
  Object.assign(S.xw.mire.tide = {}, { met: true, seen: true, trust: 1 });
  S.xw.mire.out = { i: site, at: 0, stock: { scrap: 5, water: 5, food: 5 } };
  const away = dev.tide.away();
  assert.equal(away.filter(m => m.job === 'tide').length, 3, 'three villagers');
  assert.equal(away.filter(m => m.job === 'crew').length, S.x.crew.length, 'the crew waits by the ship');
  dev.setView('away'); assert.doesNotThrow(() => dev.draw()); frame(6000); frame(6400);
  // the village tile map draws with the village on it
  walkIn(dev, S, v); dev.act('ok'); dev.setView('map'); assert.doesNotThrow(() => dev.draw()); frame(6800);
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  // an old save with no Tidefolk, outpost or hauler fields
  const old = JSON.parse(JSON.stringify(dev.ser())); delete old.xw.mire.tide; delete old.xw.mire.out; delete old.xs.haul;
  const S3 = dev.deser(old); assert.ok(S3, 'loads');
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...old, saved: Date.now() })]]));
  assert.doesNotThrow(() => b2.dev.draw());
});
