// Ashen Sphere: cave bunkers. Once your squad has seen the cave mouth on a tile you own, you can settle the cave as a
// second bunker: natural caverns already open (some with pools), rock rich in veins, rooms fitted out like at home,
// people who move down to live and work there on their own power, and what they make going into the shared stores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.res = { scrap: 3000, water: 900, food: 900 }; S.pop = Math.max(S.pop, 14); b.dev.run(0.01); return { ...b, S, T: b.dev.home() }; }
// own a tile with a cave mouth and walk it so the squad sees the mouth
function caveTile(dev, S, T, skip = []) {
  const i = T.findIndex((t, j) => t.b !== 'sea' && !t.pent && !S.owned.has(j) && !skip.includes(j) && S.bld[j] !== 'bunker' && dev.genMap(j).pois.some(p => p.type === 'cave'));
  assert.ok(i >= 0, 'land with a cave'); S.owned.add(i); S.seen.add(i);
  assert.ok(!dev.cave.can(i), 'not before the squad has seen the cave');
  dev.setView('surface'); dev.sel(i); dev.act('walk'); const ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length); dev.act('leave');
  dev.setView('surface'); dev.sel(i); return i;
}
const open = (cb, but = []) => Object.keys(cb.ug).filter(k => cb.ug[k].d && !cb.ug[k].room && k !== '0,3' && !but.includes(k));

test('a cave on your land can be settled once your squad has seen its mouth: two people move down', () => {
  const { dev, S, T } = base(); const i = caveTile(dev, S, T);
  assert.ok(dev.cave.can(i)); assert.match(dev.panel(), /Start a cave bunker/);
  const pop = S.pop, sc = S.res.scrap; dev.cave.found(i);
  const cb = S.cbs[i]; assert.ok(cb, 'a cave bunker'); assert.equal(cb.people.length, 2); assert.equal(S.pop, pop - 2, 'they left the home bunker');
  assert.equal(S.res.scrap, sc - 150); assert.equal(dev.view(), 'cave'); assert.match(dev.panel(), /The cave bunker under tile/);
  assert.ok(Object.keys(cb.ug).filter(k => cb.ug[k].d).length >= 6, 'caverns already open'); assert.ok(cb.ug['0,3'].d, 'the cave mouth');
  assert.doesNotThrow(() => dev.draw(), 'the cave draws'); assert.match(S.log[0], /move down into the caves/);
  dev.cave.act('up'); assert.equal(dev.view(), 'surface'); dev.sel(i); assert.match(dev.panel(), /Cave bunker below/); assert.match(dev.panel(), /Go down to the cave bunker/);
});

test('down there you fit out rooms that run on their own power and staff, and what they make goes to the stores', () => {
  const { dev, S, T } = base(); const i = caveTile(dev, S, T); dev.cave.found(i); const cb = S.cbs[i];
  const [g, sh, bk] = open(cb); assert.ok(bk, 'three open chambers');
  dev.cave.pick(bk); dev.cave.act('room:bunks'); dev.cave.act('send'); dev.cave.act('send');
  dev.run(0.01); assert.equal(dev.cave.info(i).cap, 6, 'bunks: room for six'); assert.equal(cb.people.length, 4);
  dev.cave.pick(sh); dev.cave.act('room:shop'); dev.run(0.01); assert.equal(dev.cave.info(i).paused.get(sh), 'no power', 'no power yet');
  const sc0 = dev.E().sc; dev.cave.pick(g); dev.cave.act('room:gen'); dev.run(0.01); const info = dev.cave.info(i);
  assert.ok(info.on.has(g) && info.on.has(sh), 'the generator powers the workshop'); assert.ok(info.power.supply >= info.power.demand);
  assert.ok(info.who.get(g) && info.who.get(sh), 'cave people work them');
  assert.ok(dev.E().sc > sc0, 'the workshop adds scrap to the stores');
  const f0 = dev.E().fo; dev.cave.act('recall'); dev.run(0.01); assert.equal(cb.people.length, 3); assert.ok(dev.E().fo !== f0, 'one less mouth down there');
  dev.cave.pick(sh); dev.cave.act('raze'); assert.ok(!cb.ug[sh].room, 'stripped');
  dev.setView('cave'); assert.doesNotThrow(() => dev.draw());
});

test('digging opens new chambers, the rock is rich in veins, mines work down there, and a pool doubles a pump', () => {
  const { dev, S, T } = base(); const i = caveTile(dev, S, T); dev.cave.found(i); const cb = S.cbs[i];
  let veins = 0, rock = 0; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (!cb.ug[r + ',' + c]) { rock++; if (dev.cave.vein(i, r, c)) veins++; }
  assert.ok(veins / rock > .15, 'veins in the cave rock (' + veins + ' of ' + rock + ')');
  // dig the next cell along
  let at = null; for (let r = 0; r < 6 && !at; r++) for (let c = 0; c < 7 && !at; c++) { const k = r + ',' + c; if (!cb.ug[k] && [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => cb.ug[a + ',' + b] && cb.ug[a + ',' + b].d)) at = k; }
  dev.cave.pick(at); const sc = S.res.scrap; dev.cave.act('dig'); assert.ok(cb.dig && cb.dig.k === at); assert.ok(S.res.scrap < sc);
  dev.run(30); assert.equal(cb.dig, null); assert.ok(cb.ug[at].d, 'a new chamber');
  // a mine on a vein, a pump on a pool
  const [g, m, pm] = open(cb, [at]); cb.ug[m].vein = 'iron'; cb.ug[m].left = 40; cb.ug[pm].pool = 1;
  for (const [k, room] of [[at, 'bunks'], [g, 'gen'], [m, 'mine'], [pm, 'pump']]) { dev.cave.pick(k); dev.cave.act('room:' + room); }
  dev.run(0.01); dev.cave.act('send'); dev.run(0.01); const info = dev.cave.info(i); assert.ok(info.on.has(m) && info.on.has(pm), 'the mine and pump run');
  const fe = (S.mats || {}).iron | 0; dev.run(60); assert.ok((S.mats.iron | 0) > fe, 'the mine digs iron'); assert.ok(cb.ug[m].left < 40);
  assert.match(dev.panel(), /./); dev.cave.pick(pm); assert.match(dev.panel(), /twice as much/);
});

test('saves keep cave bunkers and their people; old saves load with none; three at most', () => {
  const { dev, S, T } = base(); const used = [];
  for (let n = 0; n < 3; n++) { const i = caveTile(dev, S, T, used); used.push(i); dev.cave.found(i); dev.cave.act('up'); }
  assert.equal(Object.keys(S.cbs).length, 3); const i4 = caveTile(dev, S, T, used);
  assert.match(dev.panel(), /You have 3 already/); dev.cave.found(i4); assert.equal(Object.keys(S.cbs).length, 3, 'no fourth');
  const save = JSON.parse(JSON.stringify(dev.ser())), b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]]));
  const S2 = b2.dev.S(); assert.equal(Object.keys(S2.cbs).length, 3); assert.ok(S2.cbs[used[0]].people[0].name, 'their people, by name');
  b2.dev.run(0.01); assert.ok(b2.dev.cave.info(used[0]), 'running again'); b2.dev.setView('surface'); b2.dev.sel(used[0]); b2.dev.act('cb:open'); assert.equal(b2.dev.view(), 'cave');
  assert.doesNotThrow(() => b2.dev.draw());
  delete save.cbs; const b3 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]]));
  assert.deepEqual(JSON.parse(JSON.stringify(b3.dev.S().cbs)), {}, 'an old save has no cave bunkers'); b3.dev.run(0.01); assert.doesNotThrow(() => b3.dev.draw());
});
