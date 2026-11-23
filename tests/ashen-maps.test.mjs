// Ashen Sphere: bigger, more varied tile maps. Land you have not set foot on comes out bigger and laid out by its
// kind (streets, a stream with bridges, ridges and a chasm, a highway and craters, a frozen lake, standing stones),
// while an old save keeps the 11 x 9 maps it already has. The view follows the squad and can be dragged. New things to
// do: traders, wrecks, campfires, lookout masts, dens and fishing holes, and vaults whose code is on a note nearby.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const blocked = v => v === 1 || v === 3;
function reachable(M) {
  const w = M.w || 11, h = M.h || 9, seen = new Set([M.entry]), q = [M.entry];
  while (q.length) { const k = q.shift(), x = k % w, y = (k / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const n = ny * w + nx;
      if (seen.has(n) || blocked(M.g[n])) continue; seen.add(n); q.push(n); } }
  return seen;
}
function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.res = { scrap: 400, water: 400, food: 400 }; return { ...b, S, T: b.dev.home() }; }
// own a tile whose map has a thing of this type, walk in, see it all, and walk up to it
function goTo(dev, S, T, type, pick = () => true) {
  const i = T.findIndex((t, j) => t.b !== 'sea' && !S.owned.has(j) && dev.genMap(j).w && dev.genMap(j).pois.some(p => p.type === type && pick(p)));
  assert.ok(i >= 0, 'some land has a ' + type);
  S.owned.add(i); S.seen.add(i); dev.setView('surface'); dev.sel(i); dev.act('walk'); assert.ok(S.exp && S.exp.i === i, 'walking tile ' + i);
  const ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length); const M = dev.map(), pi = M.pois.findIndex(p => p.type === type && pick(p));
  for (let n = 0; n < 20; n++) {
    assert.ok(dev.path(M.pois[pi].k), 'a way to the ' + type); const c = dev.walk();
    if (c && c.kind === 'tp' && c.pi === pi) return { i, M, ms, pi, p: M.pois[pi] };
    if (c && c.kind === 'event') dev.act('ev:close'); else if (c && c.kind === 'tp') dev.act('tp:back'); else if (c) { dev.act('ok'); if (dev.card()) dev.act('back'); }
  }
  assert.fail('never reached the ' + type);
}

test('new land comes out bigger and laid out by its kind, and everything on it can be reached from the way in', () => {
  const { dev } = boot(), T = dev.home(), by = {};
  for (let i = 0; i < T.length; i++) { const b = T[i].b; if (b === 'sea' || by[b]) continue; const M = dev.genMap(i); if (M.w) by[b] = M; }
  for (const [b, [w, h]] of Object.entries({ ash: [15, 11], woods: [15, 12], ruins: [17, 13], crags: [15, 12], frost: [15, 11], spire: [15, 13] })) {
    const M = by[b]; assert.ok(M, b + ' land'); assert.equal(M.w, w, b + ' width'); assert.equal(M.h, h, b + ' height');
    assert.equal(M.g.length, w * h); assert.equal(M.entry, (h - 1) * w + (w >> 1), 'the way in is at the bottom middle');
    const R = reachable(M); for (const p of M.pois) assert.ok(R.has(p.k), b + ': the ' + p.type + ' can be reached');
  }
  assert.ok(by.ruins.road.size >= by.ruins.w * 2 + by.ruins.h, 'streets through the ruins');
  assert.ok(by.woods.water.size > 6 && by.woods.bridge.size >= 1, 'a stream through the woods, bridged');
  assert.ok(by.ash.road.size >= by.ash.w * 2, 'a highway across the ash');
  assert.ok(by.frost.ice.size > 6, 'a frozen lake');
  assert.ok(by.crags.chasm.size >= 2, 'a chasm in the crags');
  const kinds = new Set(); for (let i = 0; i < T.length; i++) if (T[i].b !== 'sea') for (const p of dev.genMap(i).pois) kinds.add(p.type);
  for (const t of ['trader', 'wreck', 'camp', 'mast', 'den', 'vault', 'note']) assert.ok(kinds.has(t), 'somewhere there is a ' + t);
  const A = dev.away('mire'), j = A.findIndex(t => t.b !== 'msea'); assert.ok(dev.awayMap('mire', j).w >= 15, 'Mirewater land is bigger too');
  assert.doesNotThrow(() => { for (const b of Object.keys(by)) { dev.S().owned.add(T.indexOf(T.find((t, i) => dev.genMap(i) === by[b]))); } });
});

test('an old save keeps the 11 x 9 maps it has been on, and land it has not seen comes out bigger', () => {
  const { dev, S, T } = base();
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  const [old1, fresh] = near, o = JSON.parse(JSON.stringify(dev.ser()));
  o.maps = o.maps || {}; o.maps[old1] = { rev: '0'.repeat(99), got: [], att: {} }; delete o.maps[fresh];
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...o, saved: Date.now() })]])), d2 = b2.dev, S2 = d2.S();
  const M1 = d2.genMap(old1), M2 = d2.genMap(fresh);
  assert.ok(!M1.w && M1.g.length === 99, 'the map it has been on stays 11 x 9'); assert.ok(d2.mapx.legacy(old1));
  assert.ok(M2.w >= 15 && M2.g.length === M2.w * M2.h, 'new land is bigger');
  S2.owned.add(old1); d2.setView('surface'); d2.sel(old1); d2.act('walk'); assert.equal(S2.exp.i, old1);
  assert.equal(d2.mapState().rev.length, 99); const ms = d2.mapState(); ms.rev = '1'.repeat(99);
  const k = [...reachable(M1)].find(c => c !== M1.entry && !M1.pois.some(p => p.k === c)); assert.ok(d2.path(k), 'walking the old map');
  d2.walk(); assert.equal(S2.exp.pos, k); assert.doesNotThrow(() => d2.draw()); assert.equal(d2.mapx.gm().w, 11, 'drawn at its own size');
});

test('a trip onto bigger land carries more steps, while Light Packs still add six', () => {
  const { dev, S, T } = base();
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent && dev.genMap(j).w);
  const j = near[0], M = dev.genMap(j), extra = Math.round(40 * (dev.mapx.stepK(M) - 1));
  dev.setView('surface'); dev.sel(j); dev.act('explore'); assert.ok(S.exp, 'a trip');
  assert.ok(extra >= 13, 'bigger land, more steps'); assert.equal(S.exp.sup, dev.mapx.tripSteps() + extra);
});

test('water stops the squad, bridges carry it over, and the view follows it and can be dragged', () => {
  const { dev, S, T } = base();
  const i = T.findIndex((t, j) => t.b === 'woods' && !S.owned.has(j) && dev.genMap(j).bridge && dev.genMap(j).bridge.size && dev.genMap(j).water.size > dev.genMap(j).bridge.size);
  S.owned.add(i); dev.setView('surface'); dev.sel(i); dev.act('walk'); const ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length); const M = dev.map();
  const wet = [...M.water].find(k => M.g[k] === 3), br = [...M.bridge][0];
  assert.ok(!dev.path(wet), 'no walking into water'); assert.ok(dev.path(br), 'a bridge can be walked');
  dev.setView('map'); dev.draw(); const g = dev.mapx.gm(); assert.equal(g.w, M.w); assert.equal(g.h, M.h);
  assert.ok(g.cs * M.w > 390 || g.cs * M.h > 420, 'cells stay big, so the map is bigger than the view');
  dev.mapx.pan(-200, 0); assert.ok(dev.mapx.cam().px > 0, 'dragging looks around');
  dev.path(br); assert.doesNotThrow(() => dev.draw());
});

test('a trader makes two deals and moves on; a wreck can be siphoned and stripped; a mast shows the whole tile', () => {
  const { dev, S, T } = base();
  let at = goTo(dev, S, T, 'trader'); assert.match(dev.panel(), /A trader with a pack mule/);
  const f0 = S.res.food, s0 = S.res.scrap; dev.act('tp:trade:food'); assert.equal(S.res.food, f0 + 14); assert.equal(S.res.scrap, s0 - 15);
  assert.equal(dev.card().kind, 'tp', 'one deal, he stays'); const m0 = (S.mats || {})[at.p.mat] | 0; dev.act('tp:trade:mat'); assert.equal(S.mats[at.p.mat], m0 + 3);
  assert.equal(dev.card(), null); assert.ok(at.ms.got.includes(at.pi), 'he moves on'); assert.match(S.log.join(' '), /packs up/);
  dev.act('leave'); at = goTo(dev, S, T, 'wreck', p => p.fuel);
  S.k.fuel = 0; dev.run(0.01); const cap = dev.E().fuelCap; assert.ok(cap > 0, 'fuel tanks at home');
  dev.act('tp:siphon'); assert.equal(Math.round(S.k.fuel), Math.min(12, cap)); assert.doesNotMatch(dev.panel(), /Siphon the tank/, 'once');
  const sc = S.res.scrap; dev.act('tp:strip'); assert.equal(S.res.scrap, sc + at.p.amt); assert.ok(S.mats[at.p.mat] >= 2); assert.ok(at.ms.got.includes(at.pi));
  dev.act('leave'); at = goTo(dev, S, T, 'mast'); at.ms.rev = at.ms.rev.replace(/1/g, '0'); dev.act('tp:climb'); assert.ok(!at.ms.rev.includes('0'), 'the whole tile is charted');
});

test('a vault stays shut until you find its code; campfires buy steps on a trip; dens and fishing holes feed you', () => {
  const { dev, S, T } = base();
  let at = goTo(dev, S, T, 'vault'); assert.doesNotMatch(dev.panel(), /Punch in the code/, 'no code yet');
  const ni = at.M.pois.findIndex(p => p.type === 'note'); dev.act('tp:back'); dev.path(at.M.pois[ni].k); let c = dev.walk();
  for (let n = 0; c && c.kind !== 'find' && n < 10; n++) { dev.act(c.kind === 'event' ? 'ev:close' : c.kind === 'tp' ? 'tp:back' : 'ok'); dev.path(at.M.pois[ni].k); c = dev.walk(); }
  assert.equal(c && c.kind, 'find', 'the note'); assert.equal(at.ms.att.code, 1); dev.act('ok');
  dev.path(at.M.pois[at.pi].k); c = dev.walk(); assert.equal(c.kind, 'tp'); assert.match(dev.panel(), /Punch in the code/);
  const sc = S.res.scrap, mk = S.k.medkits | 0; dev.act('tp:open'); assert.equal(S.res.scrap, sc + 40); assert.equal(S.k.medkits, mk + 1); assert.ok(at.ms.got.includes(at.pi));
  dev.act('leave'); at = goTo(dev, S, T, 'camp'); assert.doesNotMatch(dev.panel(), /Rest and eat/, 'no need to camp on your own land');
  S.exp.sup = 20; const f = S.res.food; dev.act('tp:rest'); assert.equal(S.exp.sup, 30); assert.equal(S.res.food, f - 6);
  dev.act('leave'); at = goTo(dev, S, T, 'den', p => !p.fish); const f1 = S.res.food; dev.act('tp:hunt'); assert.ok(at.ms.got.includes(at.pi), 'one try');
  assert.ok(S.res.food === f1 + 12 || /Nothing this time/.test(S.log[0]));
  dev.act('leave'); at = goTo(dev, S, T, 'den', p => p.fish); assert.match(dev.panel(), /A hole in the ice/); dev.act('tp:hunt'); assert.ok(at.ms.got.includes(at.pi));
});
