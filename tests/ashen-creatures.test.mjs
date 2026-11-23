// Ashen Sphere: creatures fight like themselves (dogs bite, crabs pinch, eels spit, each with a body to match), and the
// Stick 'Em Up crates are gone: abilities take their place. Creatures have abilities of their kind, a mutant's are
// rolled, and your colony learns its own from what it builds, crafts, finds and beats. Played through the page's own code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const YOU = { name: 'YOU', col: '#7fb2ff', hat: 'hard', big: 1 };
const MAP_CELLS = 11 * 9;
const noop = () => {};
const ctx = new Proxy({}, { get: (o, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k in o ? o[k] : noop, set: (o, k, v) => { o[k] = v; return true; } });

// explore a neighbouring tile with a live threat on it and walk up to the threat (as in ashen-fights.test.mjs)
function toThreat(dev, kinds = ['dogs', 'raiders', 'nest']) {
  const S = dev.S(), T = dev.home();
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  let tile = -1, pi = -1;
  for (const i of near) { const k = dev.genMap(i).pois.findIndex(p => p.type === 'threat' && kinds.includes(p.t)); if (k >= 0) { tile = i; pi = k; break; } }
  assert.ok(tile >= 0, 'a tile next to the base has a threat on it');
  for (const j of [tile, ...T[tile].n]) S.seen.add(j);
  S.res = { scrap: 400, water: 400, food: 400 };
  dev.setView('surface'); dev.sel(tile); dev.act('explore');
  const M = dev.map(); dev.mapState().rev = '1'.repeat(dev.mapState().rev.length);
  for (let n = 0; n < 12; n++) {
    dev.path(M.pois[pi].k); const c = dev.walk();
    if (c && c.kind === 'threat') break;
    if (c) { if (c.kind === 'event') dev.act('ev:close'); else dev.act('ok'); if (dev.card()) dev.act('back'); }
  }
  assert.equal(dev.card() && dev.card().kind, 'threat', 'standing at the threat');
  return { tile, pi, M, t: M.pois[pi].t };
}

test('creatures fight like themselves: dogs bite, crabs pinch, eels spit, each with a body to match', () => {
  const { dev } = boot(), P = dev.fight.PUP, FO = dev.fight.FOES;
  const want = { dogs: ['bite', 'dog'], stalker: ['bite', 'dog'], crab: ['claw', 'crab'], crawlers: ['claw', 'bug'], eels: ['spit', 'snake'], leech: ['bite', 'snake'], wyrm: ['bite', 'snake'] };
  const theirs = { bite: ['bite'], claw: ['pinch', 'crush'], spit: ['acid'] };
  for (const [k, [wk, body]] of Object.entries(want)) {
    assert.equal(FO[k].wk, wk, k + ' fights its own way'); assert.equal(FO[k].look.body, body, k + ' has its own body');
    const how = new Set();
    for (let s = 0; s < 24; s++) {
      const g = P.quick({ weapon0: 'sword', weapon1: wk, seed: 500 + s * 31, look0: { ...YOU }, look1: { big: 1, ...FO[k].look }, ctl0: 1.5, ctl1: 2.5, needs: [1, 1], ab1: FO[k].ab });
      assert.ok(g.over && !g.over.timeout, k + ': the fight ends');
      assert.equal(g.f[0].wk, 'sword', 'you keep your own weapon'); assert.equal(g.f[1].wk, wk);
      for (const p of g.popLog) how.add(p.how);
      if (s === 0) P.draw(ctx, g, 390, 300, 1, 1 / 60);   // (it draws)
    }
    assert.ok(theirs[wk].some(h => how.has(h)), k + ' pops balloons with its own attack: ' + [...how].join(', '));
  }
  // a beast walks in across the board to reach you; a person stays where they stand
  const g = P.start({ weapon0: 'gun', weapon1: 'bite', seed: 9, look0: { ...YOU }, look1: { big: 1, ...FO.dogs.look }, ctl0: 'idle', ctl1: 3, needs: [1, 1] });
  const x0 = g.f[1].p.nx; let closest = x0;
  for (let n = 0; n < 120 * 6; n++) { P.run(g, 1 / 120); closest = Math.min(closest, g.f[1].p.nx); }
  assert.ok(x0 - closest > 120, 'the dog came a long way in: ' + Math.round(x0 - closest));
});

test('no more crates: each side brings abilities, used once a round', () => {
  const { dev } = boot(), P = dev.fight.PUP, FO = dev.fight.FOES;
  // what's always on comes on at the start of every round: the dogs' pack-mate, the Warden's plate
  const d = P.start({ weapon0: 'gun', weapon1: 'bite', seed: 3, look0: { ...YOU }, look1: { big: 1, ...FO.dogs.look }, ctl0: 2, ctl1: 2, needs: [2, 2], ab1: FO.dogs.ab });
  assert.equal(d.f[1].pu.decoy, 1, 'the pack: another dog takes the first hit');
  const w = P.start({ weapon0: 'box', weapon1: 'box', seed: 3, look0: { ...YOU }, look1: { big: 1, ...FO.warden.look }, ctl0: 2, ctl1: 2, needs: [2, 2], ab1: FO.warden.ab });
  assert.ok(w.f[1].pu.shield > 0 && w.f[1].pu.shieldN === 1, 'welded plate: a hit blocked every round');
  let used = new Set(), crates = 0;
  for (let s = 0; s < 16; s++) {
    const g = P.quick({ weapon0: 'gun', weapon1: 'bite', seed: 77 + s * 13, look0: { ...YOU }, look1: { big: 1, ...FO.dogs.look }, ctl0: 2, ctl1: 2, needs: [2, 2], ab0: ['scrap', 'flash'], ab1: FO.dogs.ab });
    if (g.crate) crates++;
    const seen = new Set();
    for (const a of g.abLog) { const key = a.i + ':' + a.id + ':' + a.r; assert.ok(!seen.has(key), 'once a round: ' + key); seen.add(key); used.add(a.id); }
  }
  assert.equal(crates, 0, 'no crates float down');
  assert.ok(used.has('howl') || used.has('pounce'), 'the dogs use their abilities: ' + [...used]);
  assert.ok(used.has('scrap') || used.has('flash'), 'and so do you');
});

test('a mutant is different in every nest, and the same one every time you go back', () => {
  const { dev } = boot(), m = dev.fight.mutant, P = dev.fight.PUP;
  assert.equal(JSON.stringify(m(5, 2)), JSON.stringify(m(5, 2)), 'the same nest, the same mutant');
  const bodies = new Set(), kinds = new Set();
  for (let i = 0; i < 40; i++) {
    const M = m(i, i % 4);
    bodies.add(M.look.body || 'person'); kinds.add(M.wk);
    assert.equal(M.ab.length, 3, 'three abilities');
    assert.equal(new Set(M.ab.map(k => P.ABIL[k].k)).size, 3, 'and they all do different things');
    for (const k of M.ab) assert.ok(P.ABIL[k] && !['armour', 'patch', 'scare', 'pack'].includes(k), 'wild abilities only: ' + k);
  }
  assert.ok(bodies.size >= 4, 'many shapes: ' + [...bodies]); assert.ok(kinds.size === 3, 'bites, claws and spit');
  const M = m(11, 1), g = P.quick({ weapon0: 'box', weapon1: M.wk, seed: 4, look0: { ...YOU }, look1: { big: 1, ...M.look }, ctl0: 2, ctl1: 2, needs: [1, 1], ab1: M.ab });
  assert.ok(g.over && !g.over.timeout, 'and it fights');
});

test('abilities are learned from what you build, craft, find and beat, and each is announced once', () => {
  const { dev } = boot(), S = dev.S(), F = dev.fight;
  dev.run(2);
  assert.deepEqual([...F.abKnown()], ['scare'], 'a new colony knows one trick: the greenhouse is a scarecrow');
  assert.match(S.log.join(' '), /New ability for fights: Scarecrow/);
  const T = dev.home(), free = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea');
  S.owned.add(free[0]); S.bld[free[0]] = 'camp'; S.order.push(free[0]);
  S.gear.armor = 1; S.arts.push('lamp'); S.beat = { dogs: 1 };
  dev.run(2);
  for (const k of ['scrap', 'armour', 'flash', 'warcry']) assert.ok(F.abKnown().includes(k), k + ' learned');
  assert.match(S.log.join(' '), /Scrap Shield|Plate Armour|Lamp Flash|War Cry/);
  const n = S.log.length; dev.run(3); assert.equal(S.log.length, n, 'announced once');
  assert.ok(F.abBring().includes('armour'), 'armour is always on');
  // a save from before abilities doesn't announce everything it already has
  const o = JSON.parse(JSON.stringify(dev.ser())); delete o.abk; o.log = ['loaded'];
  const S2 = dev.deser(o); assert.equal(S2.abk, null);
});

test('you pick two to bring; the pick is saved; the buttons and keys work in a fight', () => {
  const { dev, els } = boot(); readyBase(dev);
  const S = dev.S(), F = dev.fight, P = F.PUP;
  S.gear.armor = 1; S.arts.push('lamp'); S.beat = { dogs: 1 };
  dev.run(2);
  const acts = F.abKnown().filter(k => !P.ABIL[k].when);
  assert.ok(acts.length >= 3, 'more than two to choose from: ' + acts);
  toThreat(dev);
  assert.match(dev.panel(), /You bring/); assert.match(dev.panel(), /It has|They/);
  dev.act('fab'); assert.match(dev.panel(), /Pick two to bring/);
  dev.act('fab:scare'); assert.equal(F.abLoadout()[0], 'scare', 'the one you tap comes first');
  dev.act('fab'); assert.doesNotMatch(dev.panel(), /Pick two to bring/);
  const back = dev.deser(JSON.parse(JSON.stringify(dev.ser()))); assert.deepEqual([...back.fab], [...S.fab], 'the pick is saved');
  dev.act('play');
  const Fi = F.state(), g = Fi.g, mine = P.activeAb(g.f[0]);
  assert.deepEqual([...mine], [...F.abLoadout()], 'you bring the two you picked');
  assert.ok(g.f[0].ab.includes('armour'), 'and what is always on');
  assert.equal(els.get('fabs').hidden, false); assert.match(els.get('fabs').innerHTML, /Scarecrow/);
  for (let n = 0; n < 200 && g.phase !== 'fight'; n++) F.tick(1 / 60);
  P.CTL.q.push(0); F.tick(1 / 60);
  assert.ok(g.abLog.some(a => a.i === 0 && a.id === mine[0]), 'the first button uses the first ability');
  assert.equal(g.cap.text, P.ABIL[mine[0]].name + '!', 'and says so across the top');
  const n = g.abLog.length; P.CTL.q.push(0); F.tick(1 / 60);
  assert.equal(g.abLog.filter(a => a.i === 0 && a.id === mine[0]).length, 1, 'once a round');
  assert.ok(g.abLog.length >= n);
  dev.draw(); dev.act('noop'); assert.match(dev.panel(), /Yours: .*\(used\)/);
  dev.act('fquit');
});

test('a quick fight against a creature keeps the card\'s odds: your strength against its danger', () => {
  const { dev } = boot(), F = dev.fight, P = F.PUP, FO = F.FOES;
  const lvl = { dogs: 1, eels: 2, crab: 3 };
  for (const [k, pw, str] of [['dogs', 'sword', 1], ['dogs', 'box', 3], ['crab', 'gun', 3], ['eels', 'bow', 2]]) {
    const Fo = { key: k, ...FO[k] }, L = F.fightLevels(str, lvl[k], F.foeCal(Fo, pw)), N = 80; let win = 0;
    for (let s = 0; s < N; s++) if (P.quick({ weapon0: pw, weapon1: Fo.wk, seed: 31337 + s * 7919, look0: { ...YOU }, look1: { big: 1, ...Fo.look }, ctl0: L.you, ctl1: L.foe, needs: [1, 1], ab0: ['scare', 'scrap'], ab1: Fo.ab }).over.win === 0) win++;
    const want = str / (str + lvl[k]);
    assert.ok(Math.abs(win / N - want) < 0.16, k + ' with ' + pw + ', strength ' + str + ': ' + (win / N).toFixed(2) + ' against ' + want.toFixed(2));
  }
});
