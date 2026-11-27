// Ashen Sphere: a Spire is taken the way every tile is, by a squad clearing its threats, and it must give its gift then
// (its cache, the stranger guarding it, and one lesson). The older tests reached the lesson through a 'claim' action that
// no button offers any more, so a player who cleared a Spire got nothing and could never teach anyone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './ashen-harness.mjs';

function nearSpire(dev) {
  const S = dev.S(), T = dev.home();
  const spire = T.findIndex(t => t.pent && t.n.some(n => T[n].b !== 'sea')), nb = T[spire].n.find(n => T[n].b !== 'sea');
  S.owned.add(nb); for (const j of [spire, nb, ...T[spire].n]) S.seen.add(j);
  return spire;
}

test('a squad that clears a Spire gets its cache, its stranger and a lesson; the tile says so; a building does not hide it', () => {
  const { dev } = boot(), S = dev.S(), spire = nearSpire(dev);
  S.res = { scrap: 400, water: 400, food: 400 };
  dev.setView('surface'); dev.sel(spire);
  assert.match(dev.panel(), /Send a squad/); assert.doesNotMatch(dev.panel(), /data-act="claim"/, 'there is no Claim button');
  const pop0 = S.pop, scrap0 = S.res.scrap;
  dev.act('explore'); assert.ok(S.exp && S.exp.i === spire, 'the squad is out on the Spire');
  const M = dev.map(); dev.mapState().rev = '1'.repeat(dev.mapState().rev.length);
  const threats = M.pois.map((p, ix) => p.type === 'threat' ? ix : -1).filter(ix => ix >= 0);
  for (const pi of threats) {
    S.exp.sup = 999;
    for (let n = 0; n < 30; n++) {
      dev.path(M.pois[pi].k); const c = dev.walk();
      if (c && c.kind === 'threat') break;
      if (c) { if (c.kind === 'event') dev.act('ev:close'); else dev.act('ok'); if (dev.card()) dev.act('back'); }
    }
    assert.equal(dev.card() && dev.card().kind, 'threat', 'standing at a threat');
    dev.mats.win();
  }
  assert.ok(S.owned.has(spire), 'every threat gone: the Spire is yours');
  assert.equal(S.k.lessons, 1, 'and it holds a lesson');
  assert.equal(S.pop, pop0 + 1, 'the stranger joins'); assert.ok(S.res.scrap >= scrap0 + 120, 'the cache');
  assert.ok(S.log.some(l => /The Spire can teach one of your people/.test(l)), 'the feed says so');
  assert.equal(dev.spire.gift(spire), false, 'the gift comes once');
  // the tile itself now says what to do
  dev.setView('surface'); dev.sel(spire);
  assert.match(dev.panel(), /You hold this Spire/); assert.match(dev.panel(), /A lesson is waiting/); assert.match(dev.panel(), /data-act="tab:people"/);
  dev.run(0.01); const p = S.people.find(q => !(q.iq > 0)) || S.people[0], iq0 = p.iq | 0; dev.act('teach:' + p.id);
  assert.ok((p.iq | 0) > iq0, 'someone studied it'); assert.equal(S.k.taught, 1);
  dev.sel(spire); assert.match(dev.panel(), /Its lesson has been used/);
  // building on the tile keeps the Spire
  S.res.scrap = 5000; dev.act('build:camp'); assert.equal(S.bld[spire], 'camp');
  dev.sel(spire); assert.match(dev.panel(), /The Spire still stands behind what you built here/); assert.doesNotThrow(() => dev.draw());
});

test('an older save that holds Spires with no lesson is given what it was owed, once', () => {
  const first = boot(), S0 = first.dev.S(), spire = nearSpire(first.dev);
  S0.owned.add(spire);   // as a squad left it before the fix: owned, nothing given
  assert.equal(S0.k.lessons | 0, 0);
  const o = JSON.parse(JSON.stringify(first.dev.ser())), pop0 = o.pop, scrap0 = o.res.scrap; delete o.k.spg;   // a save from before the fix has no gift list
  const store = new Map([['ashen-sphere-v9', JSON.stringify(o)]]);
  const second = boot(store), S1 = second.dev.S();
  assert.ok(S1.owned.has(spire)); assert.equal(S1.k.lessons, 1, 'the lesson arrives on load');
  assert.equal(S1.pop, pop0 + 1); assert.equal(S1.people.length, S1.pop, 'the stranger is a person');
  assert.ok(S1.res.scrap >= scrap0 + 120); assert.ok(S1.log.some(l => /had not given its gift/.test(l)));
  assert.equal(second.dev.spire.fix(), 0, 'nothing more is owed');
  // and a save where the old Claim button did pay out is left alone
  const o2 = JSON.parse(JSON.stringify(second.dev.ser())); delete o2.k.spg; o2.k.lessons = 1;
  const third = boot(new Map([['ashen-sphere-v9', JSON.stringify(o2)]])), S2 = third.dev.S();
  assert.equal(S2.k.lessons, 1, 'no second lesson'); assert.equal(S2.pop, o2.pop);
});
