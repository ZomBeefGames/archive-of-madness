// Ashen Sphere: temperature, a Furnace and a Freezer (a playtester's idea). Outside it's the ash winter, much colder at
// night. The earth keeps the bunker far warmer than that; generators and people warm it more, and a furnace tops it up to
// 20°C, burning scrap only for the heat it gives. Plants below grow slower in the cold. Food beyond a cellar's worth spoils
// slowly unless freezers keep it. Played through the page's own code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base() {
  const b = boot(); readyBase(b.dev); const S = b.dev.S();
  S.ug['1,3'] = { d: 1, room: 'hydro' }; S.order.push('u:1,3');
  S.ug['0,5'] = { d: 1, room: 'gen' }; S.order.push('u:0,5');
  S.res.food = 300; b.dev.run(0.01);
  return { ...b, S };
}
const at = (dev, S, t) => { S.t = t; dev.run(0.001); return { ...dev.E() }; };
// the warmest and the coldest moment of one day
function dayAndNight(dev, S) {
  const d0 = S.t; let hi = null, lo = null;
  for (let k = 0; k < 90; k += 3) { const E = at(dev, S, d0 + k); E.t = d0 + k; if (!hi || E.tOut > hi.tOut) hi = E; if (!lo || E.tOut < lo.tOut) lo = E; }
  return { hi, lo };
}
const addRoom = (S, k, room) => { S.ug[k] = { d: 1, room }; S.order.push('u:' + k); };

test('nights are cold outside; the bunker feels it a little, and generators and people warm it', () => {
  const { dev, S } = base();
  const { hi, lo } = dayAndNight(dev, S);
  assert.ok(hi.tOut - lo.tOut >= 15, 'nights are much colder outside');
  assert.ok(lo.temp < hi.temp, 'the bunker is a little colder at night');
  assert.ok(lo.temp > lo.tOut + 20, 'the earth keeps it far warmer than outside');
  const t0 = at(dev, S, lo.t).temp;
  addRoom(S, '1,5', 'gen'); S.pop += 4;
  assert.ok(at(dev, S, lo.t).temp > t0 + 2, 'another generator and more people warm it');
});

test('a furnace tops the bunker up to 20°C and burns scrap only for the heat it gives', () => {
  const { dev, S } = base();
  const { lo } = dayAndNight(dev, S);
  const cold = at(dev, S, lo.t);
  assert.ok(cold.temp < 15 && cold.plant < 1, 'a cold night slows the plants: ' + cold.temp.toFixed(1) + '°C');
  addRoom(S, '1,5', 'furnace');
  const warm = at(dev, S, lo.t);
  assert.ok(Math.abs(warm.temp - 20) < 0.01, 'the furnace brings it to 20°C');
  assert.ok(warm.heatUse > 0 && warm.heatUse <= 1);
  assert.ok(warm.sc < cold.sc - 0.01, 'and burns scrap for it');
  assert.equal(warm.plant, 1, 'the plants grow at full speed again');
  assert.ok(warm.fo > cold.fo, 'so there is more food');
  // a bunker that is warm on its own: the fire is banked and burns nothing
  for (const k of ['1,6', '1,7', '2,5', '2,6']) addRoom(S, k, 'gen');
  S.pop += 20;
  const hot = at(dev, S, lo.t);
  assert.ok(hot.temp >= 20 && hot.heatUse === 0, 'nothing to heat, nothing burnt');
});

test('food beyond a cellar\'s worth spoils slowly; freezers keep it', () => {
  const { dev, S } = base();
  S.res.food = 300; let E = at(dev, S, S.t);
  assert.ok(Math.abs(E.spoil - (S.res.food - 100) * 0.0005) < 1e-6 && E.spoil > 0.09, 'the 200 above the cellar spoil a little');
  addRoom(S, '1,5', 'freezer'); S.res.food = 300; E = at(dev, S, S.t);
  assert.ok(E.spoil < 1e-5, 'a freezer keeps it all');
  S.res.food = 800; E = at(dev, S, S.t);
  assert.ok(Math.abs(E.spoil - (S.res.food - 100 - 200) * 0.0005) < 1e-6 && E.spoil > 0.2, 'beyond what the freezers hold, it spoils again');
  S.res.food = 80; E = at(dev, S, S.t);
  assert.equal(E.spoil, 0, 'a small store never spoils');
});

test('the Furnace and the Freezer are built from an open space, and their rooms say what the cold is doing', () => {
  const { A, dev, S, els, frame } = base();
  dev.setView('below');
  S.ug['0,6'] = { d: 1 }; S.ug['0,7'] = { d: 1 }; dev.run(0.01);
  dev.selU('0,6');
  assert.match(dev.panel(), /data-act="room:furnace"/);
  assert.match(dev.panel(), /data-act="room:freezer"/);
  dev.act('room:furnace'); assert.equal(S.ug['0,6'].room, 'furnace');
  dev.selU('0,7'); dev.act('room:freezer'); assert.equal(S.ug['0,7'].room, 'freezer');
  dev.run(0.5);
  dev.selU('0,6'); assert.match(dev.panel(), /°C in the bunker and .+°C outside/);
  dev.selU('0,7'); assert.match(dev.panel(), /Freezers keep \d+ food fresh/);
  // the base draws them, with the temperature in the status line, through the frame loop
  frame(3000); frame(3400);
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  const status = [...els.values()].map(e => e.textContent).find(t => /rows · power/.test(t || ''));
  assert.match(status, /°C in, .+°C out$/, 'the status line shows inside and outside');
});
