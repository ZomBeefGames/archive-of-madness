// Ashen Sphere: materials. Beaten beasts, mutants and raiders drop what they are made of; veins in the rock under the
// bunker give materials when you dig into them; buildings' caches hold some; a running Workshop turns them into gear,
// vehicle parts, medkits and pipe bombs. Old saves load with none, and the stores show under the supplies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const MW = 11, MH = 9;
function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.res = { scrap: 900, water: 400, food: 400 }; return { ...b, S, T: b.dev.home() }; }
// a running workshop below
function workshop(dev, S) { for (const [k, room] of [['1,3', 'shop'], ['1,5', 'gen'], ['1,6', 'gen']]) { S.ug[k] = { d: 1, room }; S.order.push('u:' + k); }
  S.pop = Math.max(S.pop, 16); dev.run(0.01); assert.ok([...dev.E().on].some(id => id === 'u:1,3'), 'the workshop runs'); }
// a squad out on your own land, in front of a threat
function atThreat(dev, S, T, key) {
  const i = [...S.owned].find(j => T[j].b !== 'sea'); dev.setView('surface'); dev.sel(i); dev.act('walk');
  if (key) dev.place.enter(key);
  const M = dev.map(), ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length);
  const ix = M.pois.findIndex((p, j) => p.type === 'threat' && !ms.got.includes(j)); assert.ok(ix >= 0, 'a threat to face');
  ms.got = ms.got.filter(j => j !== ix); let c = null;
  for (let n = 0; n < 12; n++) { dev.path(M.pois[ix].k); c = dev.walk(); if (c && c.kind === 'threat') break; if (c) { dev.act(c.kind === 'event' ? 'ev:close' : c.kind === 'tp' ? 'tp:back' : 'ok'); if (dev.card()) dev.act('back'); } }
  assert.ok(c && c.kind === 'threat', 'face to face');
  return M.pois[ix];
}

test('beaten foes drop what they are made of: dogs hide and bone, raiders powder, mutants mutagel, crawlers chitin', () => {
  const { dev, S, T } = base();
  for (const [t, kinds] of [['dogs', ['hide', 'bone']], ['raiders', ['powder', 'wire', 'iron']], ['nest', ['gel', 'bone']], ['crawlers', ['chitin']], ['warden', ['iron', 'wire', 'crystal']], ['stalker', ['hide', 'bone']]]) {
    const before = { ...(S.mats || {}) }; dev.mats.drop(t, t);
    for (const k of kinds) assert.ok((S.mats[k] | 0) > (before[k] | 0), t + ' drop ' + k);
  }
  assert.match(S.log[0], /Taken from the/);
  // through a real win on a tile map
  const th = atThreat(dev, S, T, 'police'); const m0 = JSON.stringify(S.mats);
  dev.mats.win(); assert.equal(dev.card(), null, 'the threat is gone');
  assert.notEqual(JSON.stringify(S.mats), m0, 'a win in the police station drops materials (' + th.t + ')');
});

test('veins show in the rock and digging into one gives its material: copper in the clay, iron in the bedrock', () => {
  const { dev, S } = base(); const kinds = {};
  for (let r = 0; r < 12; r++) for (let c = 0; c < 9; c++) { const v = dev.mats.vein(r, c); if (v) (kinds[v] = kinds[v] || []).push([r, c]); }
  assert.ok(kinds.copper && kinds.copper.every(([r]) => r >= 3 && r < 6), 'copper in the clay');
  assert.ok(kinds.iron && kinds.iron.every(([r]) => r >= 6 && r < 9), 'iron in the bedrock');
  assert.ok((kinds.crystal || []).concat(kinds.wire || []).every(([r]) => r >= 9), 'crystal and circuits in the old-world layer');
  const [r, c] = kinds.copper[0], k = r + ',' + c; delete S.ug[k]; S.pop = 40;
  S.dig = { k, left: 0.5, total: 5 }; const before = S.mats && S.mats.copper | 0; dev.run(1);
  assert.equal(S.dig, null, 'dug'); assert.equal(S.ug[k].vein, 'copper');
  assert.equal((S.mats.copper | 0) - before, 4 + r, 'a deeper vein gives more'); assert.match(S.log[0], /vein of copper/);
  dev.setView('below'); assert.doesNotThrow(() => dev.draw(), 'the bunker draws with the veins');
});

test('the workshop bench makes gear, vehicle parts, medkits and pipe bombs, in order and only with what it costs', () => {
  const { dev, S } = base(); workshop(dev, S);
  S.mats = {}; dev.mats.craft('hidecoat'); assert.ok(!S.gear.hidecoat, 'nothing without the hide');
  S.mats = { hide: 30, bone: 20, chitin: 20, iron: 40, copper: 20, powder: 20, wire: 20, gel: 10, crystal: 5 };
  assert.match(dev.panel() + '', /./);
  const p0 = dev.mats.squadP().P;
  dev.mats.craft('chitinarm'); assert.ok(!S.gear.chitinarm, 'chitin plates need the hide coat first');
  dev.mats.craft('hidecoat'); dev.mats.craft('chitinarm'); dev.mats.craft('steelarm');
  assert.ok(S.gear.hidecoat && S.gear.chitinarm && S.gear.steelarm, 'armour in steps');
  assert.equal(S.mats.hide, 30 - 6 - 2, 'paid in hide');
  assert.equal(dev.mats.squadP().P, p0 + 3, 'each step +1 strength');
  dev.mats.craft('fans'); assert.ok(!S.gear.fans, 'skimmer fans need a skimmer'); S.veh = { ...S.veh, skimmer: 1 }; dev.mats.craft('fans');
  assert.ok(S.gear.fans); assert.equal(dev.mats.reach(true), dev.mats.reach(false) + 2 + (S.arts.includes('compass') ? 1 : 0), 'the skimmer reaches one further');
  const d = { pods: 1 }, h0 = dev.mats.hold(d, ''); dev.mats.craft('frame'); assert.equal(dev.mats.hold(d, ''), h0 + 20, 'one more hold slot');
  dev.mats.craft('medkits'); dev.mats.craft('medkits'); dev.mats.craft('bombs');
  assert.equal(S.k.medkits, 2); assert.equal(S.k.bombs, 1);
  assert.match(dev.mats.hud(), /Hide<b>\d+<\/b>/); assert.match(dev.mats.hud(), /Medkits<b>2<\/b>/);
  // no workshop running, no bench
  delete S.ug['1,3']; S.order = S.order.filter(x => x !== 'u:1,3'); dev.run(0.01); const n = S.k.medkits; dev.mats.craft('medkits'); assert.equal(S.k.medkits, n, 'the bench needs a running workshop');
});

test('a pipe bomb clears a threat without a fight, and a medkit patches up a squad that comes home hurt', () => {
  const { dev, S, T } = base(); S.k.bombs = 1; S.k.medkits = 1;
  atThreat(dev, S, T, 'garage'); assert.match(dev.panel(), /Throw a pipe bomb/);
  dev.act('bomb'); assert.equal(dev.card(), null, 'cleared'); assert.equal(S.k.bombs, 0); assert.match(S.log[0], /pipe bomb/);
  dev.act('upcave'); atThreat(dev, S, T, 'subway'); assert.doesNotMatch(dev.panel(), /Throw a pipe bomb/, 'no bombs left, no button');
  dev.mats.lose(); assert.equal(S.wounded, 0, 'the medkit patched them up'); assert.equal(S.k.medkits, 0); assert.match(S.log[0], /medkit/);
});

test("buildings' caches hold materials, and saves keep them while old saves load with none", () => {
  const { dev, S, T } = base(); const i = [...S.owned].find(j => T[j].b !== 'sea'); dev.setView('surface'); dev.sel(i); dev.act('walk');
  dev.place.enter('datacenter'); const M = dev.map(), ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length);
  const ix = M.pois.findIndex(p => p.type === 'cache' && p.mat === 'copper'); assert.ok(ix >= 0, 'copper cable in the data center');
  for (const [j, p] of M.pois.entries()) if (p.type === 'threat') ms.got.push(j);
  const c0 = S.mats && S.mats.copper | 0; dev.path(M.pois[ix].k); dev.walk(); assert.ok((S.mats.copper | 0) > c0, 'copper from the cable');
  const S2 = dev.deser(JSON.parse(JSON.stringify(dev.ser()))); assert.equal(S2.mats.copper, S.mats.copper, 'saved');
  const old = JSON.parse(JSON.stringify(dev.ser())); delete old.mats;
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...old, saved: Date.now() })]]));
  assert.deepEqual(JSON.parse(JSON.stringify(b2.dev.S().mats)), {}, 'an old save loads with no materials');
  assert.doesNotThrow(() => b2.dev.draw());
});
