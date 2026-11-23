// Ashen Sphere: buildings have floors. A basement, the ground floor and upstairs, joined by stairs, each with its own
// threats and finds; the prize sits on the floor it belongs on (the trauma ward upstairs, the armoury in the basement).
// Most buildings have a room someone walled up: walk up to the cracked wall, break through, and there is a stash.
// An old save's ground floor keeps its layout and its finds, and gets stairs added.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.res = { scrap: 400, water: 400, food: 400 }; return { ...b, S, T: b.dev.home() }; }
function outOn(dev, S) { const i = [...S.owned].find(j => !S.bld[j] || S.bld[j] === 'bunker') ?? [...S.owned][0]; dev.setView('surface'); dev.sel(i); dev.act('walk'); assert.ok(S.exp); return i; }
const seeAll = dev => { const ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length); return ms; };
// walk to a cell, dealing with whatever stops the squad on the way
function walkTo(dev, k, want) {
  for (let n = 0; n < 16; n++) {
    const M = dev.map(), ms = dev.mapState();
    if (!dev.path(k)) { const ti = M.pois.findIndex((p, j) => p.type === 'threat' && !ms.got.includes(j) && dev.path(p.k)); assert.ok(ti >= 0, 'a way there'); dev.path(M.pois[ti].k); const c = dev.walk(); if (c && c.kind === 'threat') { dev.act('pay'); if (dev.card()) dev.act('back'); } continue; }
    const c = dev.walk(); if (c && c.kind === want) return c;
    if (!c) return null;
    if (c.kind === 'threat') { dev.act('pay'); if (dev.card()) dev.act('back'); } else dev.act(c.kind === 'event' ? 'ev:close' : 'ok');
  }
  assert.fail('never got there');
}

test('a cracked wall opens into a room someone walled up, with a stash in it, and stays open after a save', () => {
  const { dev, S } = base(); const i = outOn(dev, S);
  const kind = 'police', fl = dev.floors.list(kind).find(f => dev.place.map(i, null, kind, f).secret); assert.ok(fl !== undefined, 'the station has a hidden room');
  dev.place.enter(kind); for (let n = 0; n < Math.abs(fl); n++) dev.floors.go(Math.sign(fl)); assert.equal(S.exp.cave.fl, fl);
  const M = dev.map(), ms = seeAll(dev), wall = M.secret.wall; assert.equal(M.g[wall], 1, 'a wall for now');
  const stash = M.pois.find(p => p.stash); assert.ok(!dev.path(stash.k), 'no way to the stash yet');
  const c = walkTo(dev, wall, 'crack'); assert.ok(c, 'the squad walks up to the crack'); assert.notEqual(S.exp.pos, wall, 'and stops in front of it');
  assert.match(dev.panel(), /A draft through the wall/);
  dev.act('pl:break'); assert.equal(M.g[wall], 0, 'broken through'); assert.equal(ms.att.secret, 1); assert.match(S.log[0], /walled up/);
  const sc = S.res.scrap, m0 = JSON.stringify(S.mats || {}); assert.ok(dev.path(stash.k), 'a way in now'); dev.walk();
  assert.ok(S.res.scrap > sc, 'the stash: scrap'); assert.notEqual(JSON.stringify(S.mats || {}), m0, 'and materials');
  dev.setView('map'); assert.doesNotThrow(() => dev.draw(), 'the broken wall draws');
  const save = JSON.parse(JSON.stringify(dev.ser())), b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]]));
  assert.equal(b2.dev.S().exp.cave.fl, fl, 'still on that floor'); assert.equal(b2.dev.map().g[wall], 0, 'the wall stays broken');
  assert.doesNotThrow(() => b2.dev.draw());
});

test('stairs take the squad between floors, the panel says where they go, and each floor keeps its own finds', () => {
  const { dev, S } = base(); outOn(dev, S); dev.place.enter('hospital');
  assert.match(dev.panel(), /Stairs go up to the wards upstairs and down to the morgue/);
  const M0 = dev.map(); assert.ok(M0.stairs.up !== undefined && M0.stairs.down !== undefined);
  seeAll(dev); const c = walkTo(dev, M0.stairs.down, 'stairs'); assert.match(dev.panel(), /The morgue/); dev.act('pl:go');
  assert.equal(S.exp.cave.fl, -1); assert.equal(S.exp.pos, dev.map().entry, 'at the foot of the stairs'); assert.match(dev.panel(), /Back up the stairs/);
  dev.setView('map'); assert.doesNotThrow(() => dev.draw());
  const ms = dev.mapState(); ms.got.push(0); dev.act('pl:go'); assert.equal(S.exp.cave.fl, 0); assert.equal(S.exp.pos, M0.stairs.down, 'back at the top of those stairs');
  assert.ok(S.inside[S.exp.i + ':hospital:-1'].got.includes(0), 'the morgue keeps its own state');
  assert.ok(!dev.floors.list('sewer').includes(1) && !dev.floors.list('sewer').includes(-1), 'the sewers are one level'); void c;
});

test("an old save's building keeps its ground floor and what was taken there, and gets stairs to the new floors", () => {
  const { dev, S } = base(); const i = outOn(dev, S); dev.act('leave');
  const save = JSON.parse(JSON.stringify(dev.ser())); save.inside = { [i + ':hospital']: { rev: '0'.repeat(99), got: [0], att: {} } };
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]])), d2 = b2.dev, S2 = d2.S();
  const old = d2.place.map(i, null, 'hospital', 0), n = old.pois.length;
  assert.ok(!old.w && old.g.length === 99, 'the ground floor is the old 11 x 9');
  assert.ok(old.pois.some(p => p.type === 'meds'), 'with its prize where it was');
  const st = old.pois.filter(p => p.type === 'stairs'); assert.equal(st.length, 2, 'stairs up and down added');
  assert.ok(old.pois.indexOf(st[0]) >= n - 2, 'after the old finds, so what was taken keeps its place');
  const up = d2.place.map(i, null, 'hospital', 1); assert.ok(up.w >= 13, 'the wards are a new floor'); assert.ok(!up.pois.some(p => p.type === 'meds'), 'no second trauma ward');
  S2.owned.add(i); d2.setView('surface'); d2.sel(i); d2.act('walk'); d2.place.enter('hospital'); assert.deepEqual([...d2.mapState().got], [0], 'what was taken is still taken');
  d2.floors.go(1); assert.equal(S2.exp.cave.fl, 1); assert.equal(d2.mapState().rev.length, up.w * up.h); assert.doesNotThrow(() => d2.draw());
});
