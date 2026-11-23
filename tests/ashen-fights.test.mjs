// Ashen Sphere: people are balloon-head stick puppets, and fights are settled the Stick 'Em Up way (the engine is
// Stick 'Em Up's own, brought over from the ZomBrains arcade). A threat is fought out with the stick and button, or a
// quick fight plays it out with bots on both sides at the same odds the old roll had. Space battles use the same rules
// with cardboard ships. Played through the page's own code, like a player.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

const A = { name: 'A', col: '#7fb2ff', hat: 'hard', big: 1 }, B = { name: 'B', col: '#9b7b55', hat: 'ears', big: 1 };
const MAP_CELLS = 11 * 9;

// explore a neighbouring tile with a live threat on it and walk up to the threat
function toThreat(dev, kinds = ['dogs', 'raiders', 'nest']) {
  const S = dev.S(), T = dev.home();
  const near = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea' && !T[j].pent);
  let tile = -1, pi = -1;
  for (const i of near) { const k = dev.genMap(i).pois.findIndex(p => p.type === 'threat' && kinds.includes(p.t)); if (k >= 0) { tile = i; pi = k; break; } }
  assert.ok(tile >= 0, 'a tile next to the base has a threat on it');
  for (const j of [tile, ...T[tile].n]) S.seen.add(j);
  S.res = { scrap: 400, water: 400, food: 400 };
  dev.setView('surface'); dev.sel(tile); dev.act('explore');
  assert.ok(S.exp && S.exp.i === tile, 'exploring the tile');
  const M = dev.map(); dev.mapState().rev = '1'.repeat(MAP_CELLS);
  for (let n = 0; n < 12; n++) {
    dev.path(M.pois[pi].k); const c = dev.walk();
    if (c && c.kind === 'threat') break;
    if (c) { if (c.kind === 'event') dev.act('ev:close'); else dev.act('ok'); if (dev.card()) dev.act('back'); }
  }
  assert.equal(dev.card() && dev.card().kind, 'threat', 'standing at the threat');
  return { tile, pi, M };
}

test('the Stick \'Em Up engine: every weapon plays to the end, and the same seed plays the same fight', () => {
  const { dev } = boot(), P = dev.fight.PUP;
  for (const w of P.ORDER) {
    const o = () => ({ weapon: w, seed: 20261122, look0: { ...A }, look1: { ...B }, ctl0: 1.5, ctl1: 1.5, needs: [2, 2] });
    const a = P.quick(o()), b = P.quick(o());
    assert.ok(a.over && !a.over.timeout, w + ' fight ends');
    assert.equal(Math.max(a.wins[0], a.wins[1]), 2, w + ': first to two pops');
    assert.equal(a.over.win, b.over.win, w + ': same seed, same winner');
    assert.equal(a.wins.join(), b.wins.join());
    assert.equal(a.t.toFixed(6), b.t.toFixed(6), w + ': same seed, same fight to the step');
  }
  const winners = new Set();
  for (let s = 1; s <= 12; s++) winners.add(P.quick({ weapon: 'gun', seed: s, look0: { ...A }, look1: { ...B }, ctl0: 1.5, ctl1: 1.5, needs: [1, 1] }).over.win);
  assert.equal(winners.size, 2, 'even rivals each win some');
  // uneven needs: one side must pop three times, the other once
  const g = P.quick({ weapon: 'star', seed: 7, look0: { ...A }, look1: { ...B }, ctl0: 4, ctl1: 0, needs: [3, 1] });
  assert.ok(g.over.win === 0 ? g.wins[0] === 3 : g.wins[1] === 1);
});

test('a quick fight keeps the old odds: strength against danger', () => {
  const { dev } = boot(), P = dev.fight.PUP, lv = dev.fight.fightLevels;
  for (const [str, dng] of [[3, 1], [2, 2], [2, 4], [6, 3]]) {
    const L = lv(str, dng), N = 120; let win = 0;
    for (let s = 0; s < N; s++) {
      const w = P.ORDER[s % P.ORDER.length];
      if (P.quick({ weapon: w, seed: 1000 + s * 7919 + str * 31 + dng * 131, look0: { ...A }, look1: { ...B }, ctl0: L.you, ctl1: L.foe, needs: [1, 1] }).over.win === 0) win++;
    }
    const want = str / (str + dng);
    assert.ok(Math.abs(win / N - want) < 0.13, 'strength ' + str + ' vs danger ' + dng + ': ' + (win / N).toFixed(2) + ' against ' + want.toFixed(2));
  }
});

test('a threat: quick fight settles it, win or lose, with the same results as before', () => {
  let wins = 0, losses = 0;
  for (let run = 0; run < 6 && (!wins || !losses); run++) {
    const { dev } = boot(); readyBase(dev);
    const S = dev.S(); S.pop = 3 + run; dev.run(0.01);
    const { tile, pi } = toThreat(dev, ['raiders', 'nest', 'warden']);
    const scrap0 = S.res.scrap;
    assert.match(dev.panel(), /Fight it out/); assert.match(dev.panel(), /Quick fight/);
    dev.act('fight');
    if (S.exp && !dev.card()) {
      wins++; assert.ok(dev.mapState().got.includes(pi), 'the threat is gone');
      assert.ok(S.res.scrap > scrap0, 'and left some scrap'); assert.match(S.log.join(' '), /Popped/);
    } else {
      losses++; assert.equal(S.exp, null, 'the squad came home'); assert.ok(S.wounded > 0, 'hurt');
      assert.match(S.log.join(' '), /popped the squad/); assert.equal(dev.view(), 'surface'); assert.equal(tile >= 0, true);
    }
  }
  assert.ok(wins + losses > 0);
});

test('a fight you play: the stick, the button, a puppet that can go on alone, and giving up', () => {
  const { dev, els } = boot(); readyBase(dev);
  const S = dev.S(); S.gear.armor = 1;
  toThreat(dev);
  dev.act('play');
  assert.equal(dev.view(), 'fight');
  const F = dev.fight.state();
  assert.ok(F && F.kind === 'threat' && F.g.f[0].ctl === 'cab', 'you hold the rod');
  assert.equal(els.get('fdeck').hidden, false, 'the stick and button show');
  assert.match(dev.panel(), /against the /);
  assert.ok(F.g.f[0].ab.includes('armour'), 'armour is an ability now: Plate Armour');
  assert.equal(F.g.f[0].pu.bubble, 1, 'a spare balloon every round');
  for (let n = 0; n < 90; n++) dev.fight.tick(1 / 30);
  dev.draw();
  assert.ok(F.g.t > 2, 'the fight runs');
  dev.act('fauto');
  assert.equal(typeof F.g.f[0].ctl, 'number', 'your puppet goes on by itself');
  for (let n = 0; n < 6000 && dev.fight.state(); n++) dev.fight.tick(1 / 30);
  assert.equal(dev.fight.state(), null, 'the fight ended');
  assert.notEqual(dev.view(), 'fight');
  assert.equal(els.get('fdeck').hidden, true, 'the stick and button are put away');
  assert.match(S.log.slice(0, 3).join(' '), /Popped|popped the squad/);
  // and one given up counts as a loss
  const g2 = boot(); readyBase(g2.dev); toThreat(g2.dev);
  g2.dev.act('play'); g2.dev.act('fquit');
  assert.equal(g2.dev.fight.state(), null);
  assert.equal(g2.dev.S().exp, null); assert.ok(g2.dev.S().wounded > 0);
});

test('weapons: fists always, more once crafted, and the pick is saved', () => {
  const g1 = boot(); readyBase(g1.dev); toThreat(g1.dev);
  assert.doesNotMatch(g1.dev.panel(), /Weapon:/, 'only fists: nothing to pick');
  assert.match(g1.dev.panel(), /fists/);
  const { dev } = boot(); readyBase(dev);
  const S = dev.S(); S.gear.spear = 1; S.gear.tackgun = 1;
  toThreat(dev);
  assert.match(dev.panel(), /Weapon: /);
  const seen = new Set(); for (let n = 0; n < 3; n++) { dev.act('fw'); seen.add(S.fw); }
  assert.deepEqual([...seen].sort(), ['box', 'gun', 'sword']);
  S.fw = 'sword'; dev.act('play'); assert.equal(dev.fight.state().g.wk, 'sword'); dev.act('fquit');
  const back = dev.deser(JSON.parse(JSON.stringify(dev.ser())));
  assert.equal(back.fw, 'sword');
});

// fly a crew out on a second trip (encounters wait for the first trip to be done)
function flying(dev) {
  const S = dev.S(), pad = readyBase(dev);
  S.xs.trips = 1;
  dev.setView('surface'); dev.sel(pad);
  const crew = S.people.slice(0, 2).map(p => p.id); S.k.crew = []; S.k.crewTouched = true;
  for (const id of crew) dev.act('xc:' + id);
  dev.act('xr:+'); dev.sel(pad); dev.act('xlaunch');
  dev.run(21);
  assert.equal(S.x.phase, 'out');
  return S;
}

test('space: something alongside holds the ship still until it is settled', () => {
  const { dev, els } = boot(); const S = flying(dev);
  // the roll: never on a first trip, now and then after, and the same for the same leg
  const rolls = [];
  for (let tr = 0; tr < 40; tr++) { S.xs.trips = tr; S.x.enc = null; S.x.encLeg = ''; dev.fight.spaceRoll(); rolls.push(S.x.enc ? S.x.enc.k : '-'); }
  assert.equal(rolls[0], '-', 'nothing on the first trip');
  const hits = rolls.filter(k => k !== '-');
  assert.ok(hits.length >= 5 && hits.length <= 25, 'about one leg in three: ' + rolls.join(''));
  assert.ok(hits.every(k => dev.fight.SPACE_FOES[k]));
  S.xs.trips = 1; S.x.enc = null; S.x.encLeg = '1:out';
  // a quick fight when nobody answers
  S.x.enc = { k: 'salvage', t: 0, seed: 99 };
  const t0 = S.x.t; dev.run(10);
  assert.equal(S.x.t, t0, 'the ship holds still');
  dev.setView('stars'); dev.act('sys');
  assert.match(dev.panel(), /Salvagers/); assert.match(dev.panel(), /Quick fight/);
  dev.run(55);
  assert.equal(S.x.enc, null, 'the crew fought it out on their own');
  assert.match(S.log.slice(0, 2).join(' '), /skiff/);
  dev.run(1); assert.ok(S.x.t > t0, 'and the flight goes on');
  // paying them off
  S.x.enc = { k: 'cutter', t: 0, seed: 5 }; const sc = S.res.scrap = 300;
  dev.act('spay'); assert.equal(S.x.enc, null); assert.equal(S.res.scrap, sc - 60);
  // a battle you fly: cardboard ships, then back to the system map
  S.x.enc = { k: 'sentinel', t: 0, seed: 77 };
  dev.act('sfight');
  assert.equal(dev.view(), 'fight'); const F = dev.fight.state();
  assert.equal(F.kind, 'space'); assert.equal(F.g.skin, 'space'); assert.equal(F.g.wk, 'bow');
  for (let n = 0; n < 60; n++) dev.fight.tick(1 / 30);
  dev.draw();
  dev.run(70); assert.ok(S.x.enc, 'no auto-fight while you are flying the battle yourself');
  dev.act('fauto'); for (let n = 0; n < 8000 && dev.fight.state(); n++) dev.fight.tick(1 / 30);
  assert.equal(dev.fight.state(), null); assert.equal(dev.view(), 'stars'); assert.equal(S.x.enc, null);
  assert.equal(els.get('fdeck').hidden, true);
  // an encounter survives a save
  S.x.enc = { k: 'cutter', t: 12, seed: 3, att: 1 };
  const back = dev.deser(JSON.parse(JSON.stringify(dev.ser())));
  assert.equal(back.x.enc.k, 'cutter'); assert.equal(back.x.enc.t, 12);
});

test('people are puppets: a balloon of their own, a hat for their job, faces in the list', () => {
  const { dev, els } = boot(); readyBase(dev);
  const S = dev.S(), look = dev.fight.lookOf;
  const p = S.people[0], L = look(p);
  assert.equal(look(p), L, 'the same person keeps the same look');
  assert.equal(L.hat, { eng: 'hard', scav: 'band', grow: 'straw' }[p.sk]);
  assert.match(L.col, /^#[0-9a-f]{6}$/);
  const cols = new Set(S.people.map(q => look(q).col)); assert.ok(cols.size >= 4, 'people look different from each other');
  els.get('people-chip').onclick(); dev.act('noop');
  assert.match(dev.panel(), /<svg class="pface"/);
  // the squad, the bunker and the map all draw with puppets
  dev.setView('below'); dev.draw();
  toThreat(dev); dev.draw();
});
