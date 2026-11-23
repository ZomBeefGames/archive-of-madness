// Ashen Sphere: people out on your tiles. Every surface worker walks about the tile they work on doing the job,
// the pad has two, people with no job wander by the hatch, a worker now and then carries the take home across your
// land, and the squad marches on the tile it is exploring. Where someone is comes from the clock, so nothing is saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base() {
  const b = boot(), { dev } = b; readyBase(dev);
  const S = dev.S(), T = dev.home();
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  const jobs = {};
  for (const [n, k] of ['camp', 'still', 'green', 'tower'].entries()) { const j = near[n]; S.owned.add(j); S.bld[j] = k; S.order.push(j); jobs[k] = j; }
  S.pop = 14; dev.run(1);
  return { ...b, S, T, jobs };
}

test('every surface worker is out on the tile they work, the pad has two, and idle people wait by the hatch', () => {
  const { dev, S } = base();
  const crew = dev.wk.crew(), E = dev.E();
  let surface = 0;
  for (const [id, p] of E.who) {
    if (typeof id === 'number') { surface++; assert.ok(crew.some(m => m.id === p.id && m.i === id && m.job === S.bld[id]), p.name + ' works on tile ' + id); }
    else if (String(id).startsWith('pad2:')) { surface++; assert.ok(crew.some(m => m.id === p.id && m.job === 'pad' && m.slot === 1), p.name + ' is the second pad hand'); }
    else assert.ok(!crew.some(m => m.id === p.id), p.name + ' works below, so is not out on the land');
  }
  assert.ok(surface >= 5, 'several people work on the surface');
  const idle = crew.filter(m => m.job === 'idle');
  assert.ok(idle.length >= 1 && idle.length <= 6, 'a few idle people are shown');
  const bunker = Object.keys(S.bld).find(k => S.bld[k] === 'bunker');
  for (const m of idle) assert.equal(m.i, +bunker, 'idle people wait by the hatch');
  assert.equal(new Set(crew.map(m => m.id)).size, crew.length, 'nobody is in two places');
});

test('they move about and do their jobs: dig, fetch water, tend the beds, hammer, carry the take', () => {
  const { dev, jobs } = base();
  const crew = dev.wk.crew();
  const seen = {};
  crew.forEach((m, k) => {
    const pts = [], J = seen[m.job] = seen[m.job] || { acts: new Set(), items: new Set() }, acts = J.acts, items = J.items;
    for (let t = 0; t < 120; t += 0.5) { const P = dev.wk.where(k, 1000 + t); acts.add(P.act); if (P.item) items.add(P.item); if (!P.w) pts.push(P.u.toFixed(3) + ',' + P.v.toFixed(3));
      if (!P.w) { assert.ok(Math.hypot(P.u, P.v) < 1.25, m.job + ' stays on the tile'); } }
    assert.ok(new Set(pts).size > 4, m.name + ' (' + m.job + ') moves about');
  });
  assert.ok(seen.camp.acts.has('dig') && seen.camp.items.has('scrap'), 'the scavenger digs and carries scrap');
  assert.ok(seen.still.acts.has('fill') && seen.still.acts.has('bucket'), 'the still hand fetches water');
  assert.ok(seen.green.acts.has('tend'), 'the grower tends the beds');
  assert.ok(seen.tower.acts.has('hammer') && seen.tower.acts.has('radio'), 'the tower hand hammers and listens');
  assert.ok(seen.pad.acts.has('haul'), 'the pad crew haul rocket parts');
  assert.ok(Object.keys(jobs).length === 4);
});

test('a worker two tiles out carries the take home across your land and walks back empty-handed', () => {
  const { dev, S, T } = base();
  const bunker = +Object.keys(S.bld).find(k => S.bld[k] === 'bunker');
  // a camp two steps from the bunker, over land you hold
  const ring1 = new Set(T[bunker].n.filter(j => S.owned.has(j)));
  let far = -1, via = -1;
  for (const a of ring1) { for (const b of T[a].n) if (b !== bunker && !ring1.has(b) && !T[bunker].n.includes(b) && T[b].b !== 'sea' && !T[b].pent && !S.bld[b]) { far = b; via = a; break; } if (far >= 0) break; }
  assert.ok(far >= 0, 'found land two steps out');
  S.owned.add(far); S.bld[far] = 'camp'; S.order.unshift(far); dev.run(0.01);
  assert.deepEqual(dev.wk.path(far).length, 3, 'the way home is two steps');
  const k = dev.wk.crew().findIndex(m => m.i === far && m.job === 'camp');
  assert.ok(k >= 0, 'someone works the far camp');
  let out = 0, back = 0;
  for (let t = 0; t < 200; t += 0.25) { const P = dev.wk.where(k, 1000 + t); if (!P.w) continue;
    assert.ok(Math.abs(Math.hypot(...P.w) - 1) < 1e-6, 'on the ground');
    if (P.item === 'sack') out++; else back++; }
  assert.ok(out > 10 && back > 10, 'out with a sack and back empty (' + out + ' / ' + back + ')');
});

test('the squad marches on the tile it is exploring, and the globe draws everyone by day and night', () => {
  const { A, dev, S, T, frame } = base();
  const j = [...new Set([...S.owned].flatMap(i => T[i].n))].find(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  S.res = { scrap: 400, water: 400, food: 400 }; dev.setView('surface'); dev.sel(j); dev.act('explore');
  assert.ok(S.exp && S.exp.i === j, 'an expedition is out');
  dev.run(0.01);
  const squad = dev.wk.crew().filter(m => m.job === 'squad');
  assert.ok(squad.length >= 1 && squad.every(m => m.i === j), 'the squad is on the tile it explores');
  dev.setView('surface'); let t = 3000;
  for (const night of [false, true]) {
    if (night) { S.t += 45; dev.run(0.01); }
    assert.doesNotThrow(() => dev.draw()); frame(t += 400); frame(t += 400);
    const shown = dev.wk.shown();
    assert.ok(shown.length >= 5, 'people are drawn on the globe' + (night ? ' at night' : ''));
    for (const o of shown) assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && o.s > 0, 'a real place on screen');
  }
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  assert.ok(!('wk' in dev.ser()), 'nothing about who walks where is saved');
});
