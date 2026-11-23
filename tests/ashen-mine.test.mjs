// Ashen Sphere: the Mine, wear and repairs, and more to make. A Mine goes where you dug out a vein and keeps digging
// that material out (twice as fast with drill bits) until the vein is worked out. What the materials bench makes wears
// out with use (fights, trips, dives, launches, hauls, mining), stops working when it is worn through, and is repaired
// at the bench for part of its cost. Stim shots give +1 strength for one fight; copper charms win the Tidefolk's trust.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, readyBase } from './ashen-harness.mjs';

const MW = 11, MH = 9;
function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.res = { scrap: 900, water: 400, food: 400 }; return { ...b, S, T: b.dev.home() }; }
const addRoom = (S, k, room) => { S.ug[k] = { d: 1, room }; S.order.push('u:' + k); };
// power and hands for the rooms below
function powered(dev, S) { addRoom(S, '1,5', 'gen'); addRoom(S, '1,6', 'gen'); S.pop = Math.max(S.pop, 40); dev.run(0.01); }
function workshop(dev, S) { addRoom(S, '1,3', 'shop'); dev.run(0.01); assert.ok(dev.E().on.has('u:1,3'), 'the workshop runs'); }
// dig into the first vein of a kind (as the diggers would)
function dugVein(dev, S, kind) {
  let at = null; for (let r = 0; r < 12 && !at; r++) for (let c = 0; c < 9 && !at; c++) if (dev.mats.vein(r, c) === kind) at = [r, c];
  assert.ok(at, 'a ' + kind + ' vein'); const [r, c] = at, k = r + ',' + c; delete S.ug[k];
  S.dig = { k, left: 0.5, total: 5 }; dev.run(1); assert.equal(S.ug[k].vein, kind, 'dug into the vein'); return { r, c, k };
}
function mine(dev, S, kind = 'copper') {
  powered(dev, S); const v = dugVein(dev, S, kind); dev.setView('below'); dev.selU(v.k); dev.act('room:mine');
  assert.equal(S.ug[v.k].room, 'mine', 'a mine on the vein'); dev.run(0.01); assert.ok(dev.E().on.has('u:' + v.k), 'the mine runs'); return v;
}
// a squad out on your own land, face to face with a threat
function atThreat(dev, S, T, key) {
  const i = [...S.owned].find(j => T[j].b !== 'sea'); dev.setView('surface'); dev.sel(i); dev.act('walk'); if (key) dev.place.enter(key);
  const M = dev.map(), ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length);
  const ix = M.pois.findIndex((p, j) => p.type === 'threat' && !ms.got.includes(j)); assert.ok(ix >= 0, 'a threat to face');
  dev.path(M.pois[ix].k); const c = dev.walk(); assert.ok(c && c.kind === 'threat', 'face to face'); return M.pois[ix];
}

test('a Mine built where a vein was dug out keeps digging it out, about one every 20 s, until it is worked out', () => {
  const { dev, S } = base(); powered(dev, S); const { r, k } = dugVein(dev, S, 'copper');
  assert.equal(S.ug[k].left, dev.mine.size(r), 'a fresh vein'); dev.setView('below'); dev.selU(k);
  const open = dev.panel(); assert.match(open, /A vein of copper runs through this wall \(\d+ left\)/); assert.match(open, /data-act="room:mine"/);
  dev.act('room:mine'); assert.equal(S.ug[k].room, 'mine'); dev.run(0.01); const id = 'u:' + k;
  assert.ok(dev.E().on.has(id) && dev.E().who.get(id), 'powered and worked');
  const rate = dev.mine.rate(id), c0 = S.mats.copper, l0 = S.ug[k].left; assert.ok(rate >= 0.05 && rate < 0.08, 'about one every 20 s');
  dev.run(60); const got = S.mats.copper - c0;
  assert.ok(Math.abs(got - rate * 60) <= 1, 'mined ' + got + ' in a minute'); assert.equal(l0 - S.ug[k].left, got, 'taken out of the vein');
  assert.match(dev.panel(), /A vein of copper: \d+ left in it\. Mining about 1 every \d+ s/);
  // worked out: it stands idle, with no power or worker, until it is stripped
  S.ug[k].left = 1; S.ug[k].mp = 0.99; dev.run(1); assert.equal(S.ug[k].left, 0); assert.match(S.log.join(' '), /copper vein in row \d+ is worked out/);
  dev.run(0.01); assert.ok(!dev.E().on.has(id), 'idle'); assert.equal(dev.E().paused.get(id), 'worked out'); assert.ok(!dev.E().who.get(id), 'its worker is free');
  assert.match(dev.panel(), /The vein is worked out/); const c1 = S.mats.copper; dev.run(30); assert.equal(S.mats.copper, c1, 'nothing more');
  dev.act('uraze'); assert.ok(!S.ug[k].room, 'stripped'); assert.match(dev.panel(), /The copper vein here is worked out/); assert.doesNotMatch(dev.panel(), /room:mine/);
  // no vein, no mine
  S.ug['2,7'] = { d: 1 }; dev.selU('2,7'); dev.act('room:mine'); assert.ok(!S.ug['2,7'].room, 'a mine needs a vein');
  assert.doesNotThrow(() => dev.draw(), 'the bunker draws with a mine in it');
});

test('drill bits make mines dig twice as fast and wear down with every load', () => {
  const { dev, S } = base(); const { k } = mine(dev, S, 'iron'); const id = 'u:' + k; workshop(dev, S);
  S.mats = { ...S.mats, iron: (S.mats.iron | 0) + 20, copper: 10 }; const r0 = dev.mine.rate(id);
  dev.mats.craft('drillbits'); assert.equal(S.gear.drillbits, 1, 'made'); assert.equal(dev.mine.cond('drillbits'), 100);
  assert.equal(dev.mine.rate(id), r0 * 2, 'twice as fast');
  const i0 = S.mats.iron; dev.run(40); const got = S.mats.iron - i0; assert.ok(got >= 3, 'mined ' + got);
  assert.equal(dev.mine.cond('drillbits'), 100 - got, 'one point a load');
  S.wear.drillbits = 0.5; S.ug[k].mp = 0.99; dev.run(1); assert.equal(S.gear.drillbits, 0, 'worn through'); assert.match(S.log.join(' '), /Worn through: drill bits/);
  assert.equal(dev.mine.rate(id), r0, 'back to the normal pace');
});

test('fights wear armour and weapons, a lost fight twice as much; worn through, they stop working until repaired at the bench', () => {
  const { dev, S, T } = base(); powered(dev, S); workshop(dev, S);
  S.mats = { hide: 30, bone: 20, chitin: 20, iron: 40, copper: 20, powder: 20, wire: 20, gel: 10, crystal: 10 };
  dev.mats.craft('hidecoat'); dev.mats.craft('boneblades'); const p0 = dev.mats.squadP().P;
  atThreat(dev, S, T, 'garage'); dev.mats.win(); assert.equal(dev.mine.cond('hidecoat'), 92, 'a won fight'); assert.equal(dev.mine.cond('boneblades'), 92);
  dev.mine.fight(false); assert.equal(dev.mine.cond('hidecoat'), 76, 'a lost fight wears twice as much');
  S.wear.hidecoat = 5; dev.mine.fight(true);
  assert.equal(S.gear.hidecoat, 0, 'worn through'); assert.ok(dev.mine.made('hidecoat'), 'but still yours to repair');
  assert.equal(dev.mats.squadP().P, p0 - 1, 'it stops giving strength'); assert.match(S.log[0], /Worn through: hide coat/);
  assert.match(dev.mats.hud(), /Worn through<b[^>]*>1<\/b>/);
  // better pieces last longer
  dev.mats.craft('chitinarm'); dev.mats.craft('steelarm'); const s0 = dev.mine.cond('steelarm'); dev.mine.fight(true);
  assert.equal(dev.mine.cond('steelarm'), s0 - 3.2, 'steel plate wears slowly'); assert.ok(dev.mine.cond('chitinarm') > dev.mine.cond('boneblades'));
  // the repair: part of what it cost, more the more worn it is
  dev.setView('below'); dev.selU('1,3'); const bench = dev.panel(); assert.match(bench, /Hide Coat <b>worn through<\/b>/); assert.match(bench, /Repair the hide coat/);
  assert.deepEqual(JSON.parse(JSON.stringify(dev.mine.cost('hidecoat'))), { hide: 4, bone: 1 });
  const h0 = S.mats.hide; dev.mine.act('fix:hidecoat'); assert.equal(S.gear.hidecoat, 1); assert.equal(dev.mine.cond('hidecoat'), 100); assert.equal(S.mats.hide, h0 - 4);
  assert.equal(dev.mats.squadP().P, p0 + 2, 'working again, with the chitin and steel');
  dev.mine.fight(true); dev.mine.fight(true); assert.match(dev.panel(), /Repair everything you can/); dev.mine.act('fixall');
  for (const g of ['hidecoat', 'boneblades', 'chitinarm', 'steelarm']) assert.equal(dev.mine.cond(g), 100, g + ' repaired');
  // the bench repairs only while a workshop runs
  dev.mine.fight(false); delete S.ug['1,3']; S.order = S.order.filter(x => x !== 'u:1,3'); dev.run(0.01); dev.mine.act('fixall');
  assert.ok(dev.mine.cond('hidecoat') < 100, 'no running workshop, no repairs');
});

test('vehicle parts wear with their own use: skimmer trips, dives, launches and hauls', () => {
  const { dev, S, T } = base(); S.veh = { ...S.veh, skimmer: 1 }; S.wear = S.wear || {};
  for (const g of ['fans', 'lamps', 'frame', 'haulx', 'crawlplate']) { S.gear[g] = 1; S.wear[g] = 100; }
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].find(j => !S.owned.has(j) && T[j].b !== 'sea');
  dev.setView('surface'); dev.sel(near); dev.act('walk'); assert.ok(S.exp && S.exp.i === near, 'a trip out');
  assert.equal(dev.mine.cond('fans'), 95, 'the skimmer fans wear on a trip'); assert.equal(dev.mine.cond('lamps'), 100);
  dev.mine.trip(false, true); assert.equal(dev.mine.cond('lamps'), 95, 'the floodlamps wear on a dive'); assert.equal(dev.mine.cond('fans'), 95);
  dev.mine.wear('ship'); assert.equal(dev.mine.cond('frame'), 90, 'a launch'); dev.mine.wear('haul'); assert.equal(dev.mine.cond('haulx'), 97, 'a haul');
  dev.mine.wear('crawl', 2); assert.equal(dev.mine.cond('crawlplate'), 92, 'a lost fight in the crawler');
  const html = readFileSync(new URL('../ashen-sphere.html', import.meta.url), 'utf8');
  assert.ok(html.includes('S.k.fuel-=haulFuel();matWear("haul");'), 'every haul wears the engines');
  assert.ok(html.includes('veh,arts:[],glyphs:0};matWear("ship");'), 'every launch wears the cargo frame');
  S.wear.frame = 4; const d = { pods: 1 }, h0 = dev.mats.hold(d, ''); dev.mine.wear('ship'); assert.equal(S.gear.frame, 0);
  assert.equal(dev.mats.hold(d, ''), h0 - 20, 'a worn-through frame gives no extra slot');
});

test('more to make: crystal mail over steel, an arc rifle over the powder rifle, and stim shots for one fight', () => {
  const { dev, S, T } = base(); powered(dev, S); workshop(dev, S);
  S.mats = { hide: 30, bone: 20, chitin: 20, iron: 40, copper: 20, powder: 20, wire: 20, gel: 10, crystal: 10 };
  dev.mats.craft('crystalmail'); assert.ok(!dev.mine.made('crystalmail'), 'needs the steel plate first');
  for (const g of ['hidecoat', 'chitinarm', 'steelarm']) dev.mats.craft(g); S.wear.steelarm = 0; S.gear.steelarm = 0;
  dev.mats.craft('crystalmail'); assert.ok(dev.mine.made('crystalmail'), 'a worn-through steel plate still counts as made');
  S.gear.tackgun = 1; dev.mats.craft('arcrifle'); assert.ok(!dev.mine.made('arcrifle'), 'the arc rifle needs the powder rifle'); dev.mats.craft('rifle'); dev.mats.craft('arcrifle'); assert.ok(dev.mine.made('arcrifle'));
  dev.setView('below'); dev.selU('1,3'); assert.match(dev.panel(), /lasts about \d+ fights/);
  dev.mats.craft('stims'); dev.mats.craft('stims'); assert.equal(S.k.stims, 2);
  atThreat(dev, S, T, 'subway'); assert.match(dev.panel(), /Take a stim shot/); const p0 = dev.mats.squadP().P;
  dev.act('mx:stim'); assert.equal(S.k.stims, 1); assert.equal(dev.mats.squadP().P, p0 + 1, '+1 for this fight'); assert.doesNotMatch(dev.panel(), /Take a stim shot/, 'one at a time');
  dev.mats.win(); assert.equal(S.k.stimOn, 0, 'it wears off after the fight'); assert.equal(dev.mats.squadP().P, p0, 'back to normal');
  assert.match(dev.mats.hud(), /Stim Shots<b>1<\/b>/);
});

test('copper charms raise the Tidefolk\'s trust a whole step, and show at the bench once you have seen them', () => {
  const b = boot(), { dev } = b; readyBase(dev); const S = dev.S(); S.res = { scrap: 900, water: 400, food: 400 }; powered(dev, S); workshop(dev, S);
  S.mats = { copper: 10, bone: 5 }; dev.setView('below'); dev.selU('1,3'); assert.doesNotMatch(dev.panel(), /copper charm/, 'not before you meet them');
  const crew = S.people.splice(0, 2); S.pop = S.people.length; const A = dev.away('mire'), v = dev.tide.tile();
  const site = A.findIndex((t, i) => t.b !== 'msea' && !t.pent && i !== v && !t.n.includes(v));
  S.x = { w: 'mire', phase: 'orbit', t: 0, total: 30, crew, steps: 60, hold: { scrap: 150, water: 0, food: 0 }, cap: 400, notes: [], site: -1, hurt: 0, boost: -1,
    paid: { parts: 0, rations: {}, fuel: 0 }, veh: '', arts: [], glyphs: 0, enc: null, encLeg: '' };
  S.xw = S.xw || {}; S.xw.mire = S.xw.mire || {}; S.xw.mire.tide = { seen: true };
  dev.setView('below'); dev.selU('1,3'); assert.match(dev.panel(), /Make a copper charm/); dev.mats.craft('charms'); assert.equal(S.k.charms, 1);
  dev.run(0.01); dev.setView('away'); dev.sel(site); dev.act('land'); S.xw.mire.charted[v] = 1; dev.sel(v); dev.act('xwalk');
  dev.mapState().rev = '1'.repeat(dev.mapState().rev.length); const M = dev.map(), k = M.pois.find(p => p.type === 'village').k; dev.path(k); const c = dev.walk();
  assert.equal(c && c.kind, 'village'); assert.match(dev.panel(), /Give a copper charm/);
  const t0 = S.xw.mire.tide.trust; dev.act('tf:charm'); assert.equal(S.k.charms, 0);
  assert.equal(S.xw.mire.tide.trust, Math.min(3, Math.max(1, t0 + 1)), 'a whole step'); assert.doesNotMatch(dev.panel(), /Give a copper charm/, 'none left');
});

test('saves keep wear and mined veins; old saves load with made gear in good shape', () => {
  const { dev, S } = base(); const { k } = mine(dev, S, 'copper'); dev.run(13); S.wear = S.wear || {}; S.gear.hidecoat = 1; S.wear.hidecoat = 37.5; S.gear.boneblades = 0; S.wear.boneblades = 0;
  const o = JSON.parse(JSON.stringify(dev.ser())), S2 = dev.deser(o);
  assert.equal(S2.wear.hidecoat, 37.5); assert.equal(S2.wear.boneblades, 0); assert.equal(S2.gear.boneblades, 0);
  assert.equal(S2.ug[k].left, S.ug[k].left); assert.equal(S2.ug[k].mp, S.ug[k].mp); assert.equal(S2.ug[k].room, 'mine');
  delete o.wear; const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...o, saved: Date.now() })]]));
  assert.equal(b2.dev.mine.cond('hidecoat'), 100, 'made before wear: in good shape'); assert.equal(b2.dev.S().gear.hidecoat, 1);
  assert.doesNotThrow(() => b2.dev.draw());
});
