// Ashen Sphere: the hand-drawn detail (furnished rooms, the rock layers, the skyline and dead trees over the bunker,
// little models of every building on the globe, trees and ruins and rock on the ground, the art on the tile maps).
// The harness has no real canvas, so nothing is looked at here; what this guards is that every piece of the art runs:
// each room kind, each building kind, a spire, each kind of ground, by day and by night, through the page's own frame loop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const ROOMS = ['bunks', 'pump', 'hydro', 'shop', 'gen', 'store', 'med', 'radio', 'fuel', 'algae', 'furnace', 'freezer', 'lab'];
const SPOTS = [0, 1, 2, 3, 5, 6, 7, 8];   // the columns either side of the shaft
const BUILDINGS = ['camp', 'still', 'green', 'shelter', 'tower', 'wind', 'tank', 'garage'];

test('every room, building, spire and kind of ground draws, by day and by night, with no part of a frame failing', () => {
  const { A, dev, frame } = boot();
  readyBase(dev);
  const S = dev.S(), T = dev.home();
  // one of every room in the first rows (some powered, some not), and a dig going
  ROOMS.forEach((room, n) => { const k = (1 + (n / 8 | 0)) + ',' + SPOTS[n % 8]; S.ug[k] = { d: 1, room }; S.order.push('u:' + k); });
  assert.equal(new Set(Object.values(S.ug).map(c => c.room).filter(r => ROOMS.includes(r))).size, ROOMS.length, 'every kind of room is in the base');
  S.ug['1,4'] = { d: 1 }; S.ug['2,4'] = { d: 1 }; S.dig = { k: '3,4', left: 5, total: 9 };
  // one of every building on land next to the base, every kind of ground in sight, and a spire
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  BUILDINGS.forEach((b, n) => { const j = near[n]; S.owned.add(j); S.bld[j] = b; S.order.push(j); });
  for (const i of T.keys()) S.seen.add(i);
  const kinds = new Set(T.map(t => t.b));
  for (const b of ['sea', 'ash', 'woods', 'ruins', 'crags', 'frost', 'spire']) assert.ok(kinds.has(b), 'the world has ' + b);
  S.pop = 30; dev.run(1);
  let t = 2000;
  for (const night of [false, true]) {
    if (night) { S.t += 45; dev.run(0.01); }
    for (const v of ['surface', 'below', 'stars']) { dev.setView(v); assert.doesNotThrow(() => dev.draw(), v + (night ? ' at night' : ' by day')); frame(t += 400); }
  }
  // a tile map of each home kind of ground, all revealed
  for (const b of ['woods', 'ruins', 'crags', 'ash', 'frost']) {
    const j = T.findIndex(tt => tt.b === b && !tt.pent && tt.n.some(n => S.owned.has(n)));
    if (j < 0) continue;
    if (S.exp) { S.exp = null; dev.setView('surface'); }
    S.res = { scrap: 400, water: 400, food: 400 }; S.wounded = 0;
    dev.setView('surface'); dev.sel(j); dev.act('explore');
    if (!dev.map()) continue;
    dev.mapState().rev = '1'.repeat(99);
    assert.doesNotThrow(() => dev.draw(), 'the ' + b + ' map draws'); frame(t += 400);
  }
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
});
