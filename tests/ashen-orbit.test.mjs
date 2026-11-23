// Ashen Sphere: the space station and the space elevator. Once Lantern-2 is back, a crew of two flies up from the pad
// and boards Kestrel Station (a new station core on later worlds). Modules go up on supply rockets and fit onto its bays;
// people move up to live and work there; its spare power, food and research come down. The elevator: research Tether
// Weave, fit a spool, set the anchor near the equator, lower the tether, build the climber. Then lifts are free and
// quick, all the spare power comes down the tether, and expedition ships leave from the top.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.pop = Math.max(S.pop, 14); S.mats = { copper: 80, iron: 90, wire: 60, crystal: 60, powder: 10 }; b.dev.run(0.01); return { ...b, S, T: b.dev.home() }; }
const rich = S => { S.res = { scrap: 840, water: 400, food: 400 }; S.k.fuel = 200; };
function boarded() { const b = base(); rich(b.S); b.dev.orbit.board(); b.dev.run(21); assert.ok(b.S.orb, 'boarded'); return b; }
const fit = (dev, S, sl, k) => { rich(S); dev.orbit.pick(sl); dev.orbit.act('fit:' + k); dev.run(16); };
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('a crew of two flies up from the pad and boards Kestrel Station once Lantern-2 is back', () => {
  const b = boot(), dev = b.dev, S = dev.S(); assert.ok(!dev.orbit.checks()[0][1], 'not before Lantern-2'); assert.equal(dev.orbit.pad(), '', 'nothing on the pad yet');
  const { dev: d2, S: S2 } = base(); rich(S2);
  const pad = +Object.keys(S2.bld).find(k => S2.bld[k] === 'pad'); d2.setView('surface'); d2.orbit.tileSel(pad); assert.match(d2.panel(), /Fly a crew up to Kestrel/);
  assert.ok(d2.orbit.checks().every(c => c[1]), d2.orbit.checks().filter(c => !c[1]).map(c => c[0]).join('; '));
  const pop = S2.pop, sc = S2.res.scrap, fuel = S2.k.fuel; d2.orbit.board();
  assert.equal(S2.k.flight.ms, 'dock'); assert.equal(S2.k.flight.crew.length, 2); assert.equal(S2.pop, pop - 2, 'two leave the ground');
  assert.equal(S2.res.scrap, sc - 120); assert.equal(S2.k.fuel, fuel - 40);
  d2.run(21); const O = S2.orb; assert.ok(O, 'the station is yours'); assert.equal(O.name, 'Kestrel Station'); assert.equal(O.crew.length, 2); assert.equal(S2.k.flight, null);
  assert.match(S2.log.join(' '), /dock with Kestrel Station/);
  assert.match(text(d2.orbit.pad()), /Open the station/, 'the pad opens it now');
  d2.orbit.act('open'); assert.equal(d2.view(), 'station'); assert.doesNotThrow(() => d2.draw(), 'the station draws'); assert.match(d2.panel(), /Kestrel Station/);
  d2.orbit.act('back'); assert.equal(d2.view(), 'surface'); assert.doesNotThrow(() => d2.draw(), 'the globe draws with your station');
});

test('modules go up on supply rockets, fit onto the bays, and run on the station\'s own power and crew', () => {
  const { dev, S } = boarded(); dev.orbit.act('open');
  S.mats = {}; dev.orbit.pick(0); assert.match(dev.orbit.why('solar'), /Costs/, 'materials first'); S.mats = { copper: 80, iron: 90, wire: 60, crystal: 60 };
  rich(S); const f0 = S.k.fuel; dev.orbit.act('fit:solar'); assert.equal(S.orb.lift.by, 'rocket'); assert.equal(S.k.fuel, f0 - 15, 'a supply rocket burns fuel');
  assert.match(dev.orbit.why('hab'), /already on its way/, 'one at a time'); dev.run(15); assert.equal(S.orb.mods[0], 'solar'); assert.equal(S.orb.lift, null);
  assert.equal(dev.orbit.info().power.supply, 9, 'the hub\'s 3 and the wings\' 6');
  assert.ok(dev.E().obBeam > 0, 'spare power is beamed down'); assert.equal(dev.E().obBeam, 4.5, 'half of it, before the elevator');
  const rs0 = dev.E().rsRate; fit(dev, S, 1, 'scope'); assert.ok(dev.orbit.info().on.has(1), 'the observatory runs'); assert.ok(dev.E().rsRate > rs0 + 1, 'research from the sky');
  assert.ok(dev.orbit.info().who.get(1), 'a crew member works it');
  fit(dev, S, 2, 'hab'); assert.equal(dev.orbit.info().beds, 6);
  const pop = S.pop; rich(S); dev.orbit.act('send'); assert.equal(S.orb.crew.length, 3); assert.equal(S.pop, pop - 1);
  assert.match(dev.orbit.why('garden'), /Closed Ecology/, 'the garden needs its blueprint'); S.bp.push('ecology'); dev.run(0.01);
  const fo0 = dev.E().fo; fit(dev, S, 3, 'garden'); assert.ok(dev.orbit.info().on.has(3)); assert.ok(dev.E().fo > fo0, 'food comes down');
  assert.equal(dev.orbit.why('hab'), '', 'a second ring is allowed'); fit(dev, S, 4, 'hab'); assert.match(dev.orbit.why('hab'), /2 already/);
  dev.orbit.pick(4); const ir = S.mats.iron; dev.orbit.act('strip'); assert.ok(!S.orb.mods[4]); assert.equal(S.mats.iron, ir + 4, 'half its parts back');
  dev.orbit.act('recall'); assert.equal(S.orb.crew.length, 2); assert.doesNotThrow(() => dev.draw());
  dev.orbit.pick('hub'); assert.match(dev.panel(), /Kestrel's hub/);
});

test('the space elevator: an anchor near the equator, the station parks over it, the tether comes down, then the climber', () => {
  const { dev, S, T } = boarded(); dev.orbit.act('open'); fit(dev, S, 0, 'solar'); fit(dev, S, 7, 'solar');
  const eq = T.findIndex((t, j) => t.b !== 'sea' && !t.pent && !S.bld[j] && Math.abs(dev.orbit.lat(j)) <= 10), far = T.findIndex((t, j) => t.b !== 'sea' && !t.pent && !S.bld[j] && Math.abs(dev.orbit.lat(j)) > 30);
  S.owned.add(eq); S.owned.add(far); S.seen.add(eq); S.seen.add(far);
  assert.ok(!dev.orbit.anchorOk(eq), 'not before Tether Weave'); S.bp.push('ecology', 'yard', 'tether'); dev.run(0.01);
  assert.ok(dev.orbit.anchorOk(eq)); assert.ok(!dev.orbit.anchorOk(far), 'too far from the equator');
  dev.setView('surface'); dev.orbit.tileSel(far); assert.doesNotMatch(dev.panel(), /elevator anchor/); dev.orbit.tileSel(eq); assert.match(dev.panel(), /Build the elevator anchor/);
  rich(S); dev.orbit.anchor(eq); assert.equal(S.bld[eq], 'anchor'); assert.equal(S.orb.anchor, eq); assert.match(dev.orbit.spinWhy(), /moving into place/);
  dev.run(31); assert.ok(dev.orbit.parked(), 'parked'); const p = dev.orbit.pos(), c = T[eq].c; for (let q = 0; q < 3; q++) assert.ok(Math.abs(p[q] - c[q] * 1.3) < 1e-6, 'right above the anchor');
  assert.match(dev.orbit.spinWhy(), /Tether Spool/); dev.orbit.act('open'); fit(dev, S, 4, 'spool'); assert.equal(dev.orbit.spinWhy(), '');
  for (let n = 0; n < 6; n++) { rich(S); dev.orbit.act('spin'); assert.ok(S.orb.spin, 'lowering'); dev.run(25); }
  assert.equal(S.orb.tether, 6); assert.match(dev.orbit.spinWhy(), /all the way down/);
  dev.setView('surface'); dev.orbit.tileSel(eq); assert.doesNotMatch(dev.panel(), /Tear down/, 'the anchor stays once the tether hangs from it'); dev.act('raze'); assert.equal(S.bld[eq], 'anchor');
  rich(S); dev.orbit.act('climber'); assert.ok(dev.orbit.lift(), 'the elevator runs'); assert.match(S.log.join(' '), /space elevator runs/);
  assert.equal(dev.E().obBeam, dev.orbit.info().power.supply - dev.orbit.info().power.demand, 'all the spare power comes down the tether');
  // lifts and people ride the climber for free
  dev.orbit.act('open'); rich(S); const f0 = S.k.fuel; dev.orbit.pick(1); dev.orbit.act('fit:hab'); assert.equal(S.orb.lift.by, 'climber'); assert.equal(S.k.fuel, f0); dev.run(8); assert.equal(S.orb.mods[1], 'hab');
  dev.orbit.act('send'); assert.equal(S.k.fuel, f0, 'no fuel to go up');
  assert.equal(dev.orbit.dv(5000), 3000, 'ships leave from the top'); assert.doesNotThrow(() => dev.draw()); dev.setView('surface'); assert.doesNotThrow(() => dev.draw());
});

test('the shipyard makes the expedition ship\'s parts cheaper; Kestrel\'s stages and the goals include the station', () => {
  const { dev, S, els } = base(); dev.setView('surface'); dev.orbit.selStation(); const kp = text(dev.panel());
  assert.match(kp, /Board a space station/); assert.match(kp, /Raise a space elevator/); assert.match(kp, /Fly a crew up to Kestrel/, 'and you can board it from there');
  rich(S); dev.orbit.board(); dev.run(21); dev.orbit.act('open'); fit(dev, S, 0, 'solar'); S.bp.push('ecology', 'yard'); dev.run(0.01);
  assert.equal(dev.orbit.yard(), 1); fit(dev, S, 1, 'yard'); assert.ok(dev.orbit.info().on.has(1)); assert.ok(Math.abs(dev.orbit.yard() - 2 / 3) < 1e-9, 'a third off');
  dev.orbit.act('back'); assert.match(dev.panel(), /your space station/);
  S.goal = 20; const sc = S.res.scrap; dev.run(0.01); assert.equal(S.goal, 21, 'the station goal is met'); assert.match(els.get('goal').innerHTML, /Ride the space elevator/);
});

test('the station and the elevator survive a save, and older saves load without them', () => {
  const { dev, S, T } = boarded(); dev.orbit.act('open'); fit(dev, S, 0, 'solar'); S.bp.push('ecology', 'yard', 'tether'); fit(dev, S, 3, 'spool');
  const eq = T.findIndex((t, j) => t.b !== 'sea' && !t.pent && !S.bld[j] && Math.abs(dev.orbit.lat(j)) <= 10); S.owned.add(eq); dev.setView('surface'); rich(S); dev.orbit.anchor(eq); dev.run(31); rich(S); dev.orbit.act('spin'); dev.run(5);
  const save = JSON.parse(JSON.stringify(dev.ser())), b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]])), S2 = b2.dev.S();
  assert.equal(S2.orb.name, 'Kestrel Station'); assert.equal(S2.orb.crew.length, 2); assert.equal(JSON.stringify(S2.orb.mods), '{"0":"solar","3":"spool"}'); assert.equal(S2.orb.anchor, eq);
  assert.ok(S2.orb.spin, 'the segment on its way down'); assert.ok(b2.dev.orbit.parked()); assert.equal(b2.A.bugs.length, 0);
  delete save.orb; const b3 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]])); assert.ok(!b3.dev.S().orb, 'an older save has no station'); assert.doesNotThrow(() => b3.dev.draw());
  // a save made while the capsule was on its way up: the crew get there on load
  const { dev: d4, S: S4 } = base(); rich(S4); d4.orbit.board(); d4.run(5); const mid = JSON.parse(JSON.stringify(d4.ser()));
  const b5 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...mid, saved: Date.now() })]])); assert.ok(b5.dev.S().orb, 'docked on load'); assert.equal(b5.dev.S().orb.crew.length, 2);
});

test('on a later world there is no Kestrel: the crew take a station core up, and it is the only thing drawn in orbit', () => {
  const { dev, S } = base(); S.world = 1; rich(S); assert.match(dev.orbit.checks()[3][0], /station core/); dev.orbit.board(); dev.run(21);
  assert.match(S.orb.name, /^Waystation/); dev.setView('surface'); assert.doesNotThrow(() => dev.draw()); dev.orbit.act('open'); assert.doesNotThrow(() => dev.draw()); assert.match(dev.panel(), /station core|Waystation/);
});
