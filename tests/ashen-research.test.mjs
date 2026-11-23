// Ashen Sphere: research. Smart people make research points (more of them, or smarter ones, make more); you start with
// one ordinary smart person who can research simple blueprints. Every Spire you claim teaches one of your people: they
// come back smarter, with a bigger head, research faster and can take on harder blueprints. Labs add half again each.
// Blueprints are upgrades in five branches; the Steam Turbine lets furnaces add to the bunker's grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const addRoom = (S, k, room) => { S.ug[k] = { d: 1, room }; S.order.push('u:' + k); };
const smart = S => S.people.filter(p => (p.iq | 0) > 0);

test('you start with one smart person, who researches a simple blueprint from start to finish', () => {
  const { dev, els } = boot();
  dev.run(1);
  const S = dev.S();
  assert.equal(smart(S).length, 1, 'one smart person to start');
  assert.equal(smart(S)[0].iq, 1);
  assert.ok(Math.abs(dev.E().rsRate - 0.4) < 1e-9, 'they make 0.4 research a second');
  els.get('people-chip').onclick(); dev.act('noop');
  assert.match(dev.panel(), /Research: <b>0\.4 a second<\/b>/);
  dev.act('rs');
  const panel = dev.panel();
  assert.match(panel, /data-act="bp:turbine"(?![^>]*disabled)/, 'simple blueprints can be started');
  assert.match(panel, /data-act="bp:growlamp"[^>]*disabled/, 'advanced ones need someone a Spire has taught');
  assert.match(panel, /needs someone spire-taught/);
  S.res.scrap = 500;
  dev.act('bp:turbine');
  assert.equal(S.rs.id, 'turbine'); assert.equal(S.res.scrap, 380, 'the cost is paid up front');
  dev.run(60); assert.ok(S.rs && S.rs.left > 0, 'still working on it');
  dev.run(70);
  assert.equal(S.rs, null); assert.ok(S.bp.includes('turbine'), 'done after about 125 seconds');
  assert.match(S.log.join(' '), /Blueprint done: Steam Turbine/);
});

test('the Steam Turbine lets each furnace add 3 power to the bunker\'s grid, burning flat out', () => {
  const { dev } = boot(); readyBase(dev); const S = dev.S();
  addRoom(S, '1,5', 'furnace'); addRoom(S, '1,6', 'furnace'); dev.run(0.01);
  const before = dev.E().power.supply, burn0 = dev.E().burnUse;
  S.bp.push('turbine'); dev.run(0.01);
  assert.equal(dev.E().power.supply, before + 6, 'two furnaces, six more power');
  assert.equal(dev.E().burnUse, 1, 'they burn flat out to drive the turbines');
  assert.ok(burn0 <= 1);
});

test('a Spire teaches someone: a bigger head, faster research, and harder blueprints open up', () => {
  const { dev } = boot(); readyBase(dev); const S = dev.S();
  dev.run(0.01);
  const rate0 = dev.E().rsRate, plain = S.people.find(p => !(p.iq > 0));
  S.k.lessons = 1;   // (as if a Spire was just claimed)
  dev.setView('surface');
  dev.act('teach:' + plain.id);
  assert.equal(plain.iq, 2, 'an ordinary person comes back spire-taught');
  assert.equal(S.k.taught, 1);
  dev.act('teach:' + plain.id); assert.equal(plain.iq, 2, 'one lesson per Spire');
  dev.run(0.01);
  assert.ok(Math.abs(dev.E().rsRate - (rate0 + 1)) < 1e-9, 'a spire-taught mind adds a research point a second');
  assert.equal(dev.fight.lookOf(plain).brain, 2, 'and has a bigger head');
  S.res.scrap = 500; S.res.water = 100; dev.act('bp:growlamp');
  assert.equal(S.rs && S.rs.id, 'growlamp', 'advanced blueprints can be started now');
});

test('claiming a Spire gives a lesson, labs speed research, and research is saved', () => {
  const first = boot(); readyBase(first.dev); const S0 = first.dev.S(), T = first.dev.home();
  const spire = T.findIndex(t => t.pent && t.n.some(n => T[n].b !== 'sea'));
  S0.owned.add(T[spire].n.find(n => T[n].b !== 'sea'));   // land next to a Spire, then claim it the way a player would
  for (const j of [spire, ...T[spire].n]) S0.seen.add(j);
  S0.res.scrap = 5000; first.dev.setView('surface'); first.dev.sel(spire); first.dev.act('claim');
  assert.ok(S0.owned.has(spire), 'the Spire is claimed');
  assert.equal(S0.k.lessons, 1, 'a claimed Spire can teach someone');
  first.dev.setView('surface'); first.els.get('people-chip').onclick(); first.dev.act('noop');
  assert.match(first.dev.panel(), /A Spire can teach someone/);
  const p = S0.people.find(q => !(q.iq > 0)); first.dev.act('teach:' + p.id);
  first.dev.run(0.01); const r0 = first.dev.E().rsRate;
  addRoom(S0, '1,6', 'gen'); first.dev.run(0.01); const r1 = first.dev.E().rsRate;
  addRoom(S0, '1,5', 'lab'); first.dev.run(0.01);
  assert.ok(first.dev.E().labBoost > 0 && first.dev.E().rsRate > r1 * 1.4 && r1 === r0, 'a working lab adds about half again');
  S0.res.scrap = 500; first.dev.act('bp:capbank'); first.dev.run(5);
  const storage = new Map([['ashen-sphere-v9', JSON.stringify(first.dev.ser())]]);
  const { dev } = boot(storage); const S = dev.S();
  assert.equal(S.rs && S.rs.id, 'capbank', 'the blueprint in progress comes back');
  assert.ok(S.rs.left < 40 && S.rs.left > 0);
  assert.equal(S.people.find(q => q.id === p.id).iq, 2, 'and so does what people learned');
  assert.equal(S.k.taught, 1);
});

test('every blueprint changes what it says it does', () => {
  const { dev } = boot(); readyBase(dev); const S = dev.S();
  addRoom(S, '1,3', 'hydro'); addRoom(S, '1,5', 'gen'); addRoom(S, '1,6', 'freezer'); addRoom(S, '1,2', 'shop'); addRoom(S, '1,7', 'pump'); addRoom(S, '2,3', 'algae'); addRoom(S, '2,5', 'furnace'); addRoom(S, '2,6', 'gen'); addRoom(S, '2,7', 'gen');
  S.unl.algae = true; S.pop = 24; S.res.food = 900;
  dev.run(0.01);
  const night = (() => { let t0 = S.t, lo = null; for (let k = 0; k < 90; k += 3) { S.t = t0 + k; dev.run(0.001); if (!lo || dev.E().tOut < lo.v) lo = { v: dev.E().tOut, t: S.t }; } return lo.t; })();
  const E = () => { S.t = night; dev.run(0.001); return { ...dev.E() }; };
  const checks = {
    capbank: (a, b) => b.power.supply === a.power.supply + 2,
    coil: (a, b) => b.power.supply === a.power.supply + 6,
    gen2: (a, b) => b.power.supply > a.power.supply,
    insul: (a, b) => b.temp > a.temp || b.heatUse < a.heatUse,
    heatx: (a, b) => b.temp > a.temp || b.heatUse < a.heatUse,
    climate: (a, b) => b.temp >= 20,
    seals: (a, b) => b.frozen === 350,
    preserve: (a, b) => Math.abs(b.spoil - a.spoil / 2) < 1e-3,
    growlamp: (a, b) => b.fo > a.fo,
    vats: (a, b) => b.fo > a.fo,
    recycler: (a, b) => b.wa > a.wa,
    deeppump: (a, b) => b.wa > a.wa,
    tools: (a, b) => b.sc > a.sc,
    smelter: (a, b) => b.sc > a.sc,
  };
  for (const [id, ok] of Object.entries(checks)) {
    const a = E(); S.bp.push(id); const b = E(); S.bp.pop();
    assert.ok(ok(a, b), id + ' changes what it says it does');
  }
  // the exploring ones
  const { dev: d2 } = boot(); readyBase(d2); const S2 = d2.S(), T = d2.home();
  const near = [...new Set([...S2.owned].flatMap(i => T[i].n))].filter(j => !S2.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  for (const j of near) S2.seen.add(j);
  const trip = () => { S2.res = { scrap: 400, water: 400, food: 400 }; d2.setView('surface'); d2.sel(near[0]); const w = S2.res.water; d2.act('explore'); const r = { sup: S2.exp && S2.exp.sup, paid: w - S2.res.water }; S2.exp = null; d2.setView('surface'); return r; };
  const t0 = trip(); S2.bp.push('packs', 'rations'); const t1 = trip();
  assert.equal(t1.sup, t0.sup + 6, 'Light Packs: six more steps');
  assert.equal(t1.paid, t0.paid - 2, 'Field Rations: two less water');
});
