// Ashen Sphere: defenses and raids. Once the colony holds 9 tiles, raiders, mutant packs and feral dogs come at its
// border tiles every few minutes of play (never while you're away). You get a warning, then they're at the wall: fight
// it out, let the defenses fight, or strike from orbit with a charged Orbital Lance. Walls, gates, turrets, pillboxes,
// watchtowers, barbed wire and minefields add strength, and each does something in the fight itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base(tiles = 10) { const b = boot(); readyBase(b.dev); const S = b.dev.S(), T = b.dev.home(); S.pop = Math.max(S.pop, 14);
  const more = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => T[j].b !== 'sea' && !T[j].pent && !S.owned.has(j));
  for (const j of more) { if (S.owned.size >= tiles) break; S.owned.add(j); S.seen.add(j) }
  S.mats = { iron: 60, copper: 20, powder: 20, crystal: 6 }; b.dev.run(0.01); return { ...b, S, T }; }
const rich = S => { S.res = { scrap: 840, water: 400, food: 400 }; };
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// a raid at the wall of tile i right now
function raidAt(dev, S, T, i, foe = 'raiders', lvl = 2) { dev.def.tick(0.001); const R = S.raid; R.on = true; const from = T[i].n.find(j => T[j].b !== 'sea' && !S.owned.has(j));
  R.cur = { i, from: from ?? T[i].n[0], foe, lvl, left: 0, total: 40, phase: 'here', wait: 30, seed: 99, att: 0, mined: false }; return R.cur; }

test('raids start once the colony holds 9 tiles, and only while the game is being played', () => {
  const small = base(5); small.dev.def.tick(5); assert.ok(!small.S.raid.on, 'a small colony is left alone');
  const { dev, S } = base(10); dev.run(600); assert.ok(!S.raid || !S.raid.cur, 'the clock alone (and time away) brings no raid');
  dev.def.tick(1); assert.ok(S.raid.on); assert.match(S.log[0], /Smoke on the horizon/); assert.equal(S.raid.cur, null);
  dev.def.tick(149); assert.equal(S.raid.cur, null, 'not straight away'); dev.def.tick(2); const c = S.raid.cur; assert.ok(c, 'the first raid');
  assert.ok(S.owned.has(c.i) && !S.owned.has(c.from), 'from wild land into one of your tiles'); assert.ok(dev.def.border().includes(c.i), 'a border tile');
  assert.equal(c.phase, 'coming'); assert.equal(c.lvl, c.foe === 'nest' ? 2 : 1, 'the first ones are weak');
  assert.match(dev.def.alert().t, /coming at tile/); assert.equal(dev.def.alert().b[0][0], 'df:look');
  dev.def.tick(c.left + .1); assert.equal(c.phase, 'here'); assert.match(dev.def.alert().t, /at tile/); assert.deepEqual(dev.def.alert().b.map(b => b[0]).join(), 'df:fight,df:quick');
  dev.def.tick(31); assert.equal(S.raid.cur, null, 'nobody answered: the defenses fought it out'); assert.ok(S.raid.won + S.raid.lost === 1);
  assert.ok(S.raid.next > S.raid.t + 200, 'the next one comes minutes later');
});

test('walls, gates, turrets, pillboxes, watchtowers and wire add strength, and the blueprints open the better ones', () => {
  const { dev, S, T } = base(10); const i = dev.def.border()[0], q0 = dev.def.P(i); assert.equal(dev.def.str(i), 0);
  rich(S); dev.def.build(i, 'gate'); assert.equal(dev.def.str(i), 0, 'no gate without a wall');
  dev.def.build(i, 'wall'); dev.def.build(i, 'gate'); assert.equal(dev.def.str(i), 2, 'a palisade and a gate');
  assert.match(dev.def.why(i, 'wall'), /Poured Concrete/); assert.match(dev.def.why(i, 'tur'), /Auto Turrets/); assert.match(dev.def.why(i, 'pill'), /Poured Concrete/);
  rich(S); dev.def.build(i, 'tower'); dev.def.build(i, 'wire'); assert.equal(dev.def.str(i), 4);
  S.bp.push('concrete', 'turrets'); dev.run(0.01); rich(S); dev.def.build(i, 'wall'); assert.equal(S.dfs[i].wall, 2); assert.equal(dev.def.str(i), 5, 'concrete counts 2');
  // a pillbox needs someone to man it: it takes a free worker
  rich(S); dev.def.build(i, 'pill'); dev.run(0.01); assert.ok(dev.E().st.has('d:' + i), 'a guard mans it'); assert.equal(dev.def.str(i), 8);
  // a turret runs on the bunker's spare power, and covers the tiles next to it
  rich(S); dev.def.build(i, 'tur'); dev.run(0.01); const pw = dev.E().power; assert.ok(pw.supply - pw.demand >= 1, 'spare power'); assert.equal(dev.def.turOn(), 1); assert.equal(dev.def.str(i), 10);
  const nb = T[i].n.find(j => S.owned.has(j)); if (nb !== undefined) assert.ok(dev.def.str(nb) >= 1, 'the turret covers next door');
  rich(S); dev.def.build(i, 'tur'); rich(S); dev.def.build(i, 'tur'); assert.equal(S.dfs[i].tur, 2, 'two at most');
  assert.ok(dev.def.P(i) > q0 + 9); assert.deepEqual([...dev.def.abs(i)].sort().join(), ['dgate', 'dpill', 'dtower', 'dturret', 'dwall2', 'dwire'].join());
  dev.setView('surface'); dev.def.open(i); const p = text(dev.panel()); assert.match(p, /Strength here/); assert.match(p, /Minefield|Blueprints open more/);
  assert.doesNotThrow(() => dev.draw(), 'the globe draws the defenses');
});

test('in the fight the defenses fight too, and winning drives them off with what they carried', () => {
  const { dev, S, T } = base(10); const i = dev.def.border()[0]; rich(S); for (const k of ['wall', 'gate', 'tower', 'wire']) dev.def.build(i, k);
  const c = raidAt(dev, S, T, i); dev.def.fight('play'); assert.equal(dev.view(), 'fight'); const F = dev.fight.state(); assert.equal(F.kind, 'raid');
  const ab = [...F.g.f[0].ab]; for (const k of ['dwall', 'dgate', 'dtower', 'dwire']) assert.ok(ab.includes(k), 'the ' + k + ' fights on your side');
  for (let n = 0; n < 60; n++) dev.fight.tick(1 / 30); assert.ok(F.g.f[0].pu.shieldN > 0 || F.g.f[0].pu.shield > 0, 'the wall blocks hits from the start of the round');
  dev.act('fquit'); assert.equal(S.raid.cur, null, 'giving up counts as a loss'); assert.equal(S.raid.lost, 1); raidAt(dev, S, T, i); dev.def.fight('play');
  dev.draw(); assert.match(dev.panel(), /Raid/); assert.equal(dev.def.alert(), null, 'the alert bar stays out of the fight');
  dev.act('fquit'); raidAt(dev, S, T, i); const sc = S.res.scrap; dev.def.out(true); assert.equal(S.raid.cur, null); assert.equal(S.raid.won, 1); assert.ok(S.res.scrap > sc, 'loot');
  assert.ok((S.mats.powder | 0) > 20, 'raiders drop powder'); assert.ok(S.dfs[i].wh < 100, 'the wall took some wear');
  rich(S); const fixc = S.res.scrap; dev.def.fix(i); assert.equal(S.dfs[i].wh, 100); assert.ok(S.res.scrap < fixc, 'patching costs a little');
});

test('losing: they take a share of the stores and wreck the building, which does nothing until repaired', () => {
  const { dev, S, T } = base(10); const i = dev.def.border().find(j => S.bld[j] && !['bunker', 'pad', 'tank', 'garage'].includes(S.bld[j])) ?? (() => { const j = dev.def.border()[0]; S.bld[j] = 'camp'; S.order.push(j); return j })();
  dev.run(0.01); const staffed = dev.E().st.has(i); rich(S); raidAt(dev, S, T, i, 'raiders', 3); const sc = S.res.scrap, wa = S.res.water;
  dev.def.out(false); assert.equal(S.raid.lost, 1); assert.ok(S.res.scrap < sc && S.res.water < wa, 'raiders take scrap and water'); assert.ok(sc - S.res.scrap <= 90, 'a share, not everything');
  assert.ok(S.raid.dmg[i], 'wrecked'); dev.run(0.01); assert.ok(!dev.E().st.has(i), 'nobody works a wreck'); if (staffed) assert.match(S.log[0], /wrecked the/);
  dev.setView('surface'); dev.sel(i); assert.match(dev.panel(), /Wrecked by raiders/); rich(S); dev.act('df:rep'); assert.ok(!S.raid.dmg[i], 'repaired'); dev.run(0.01);
  // dogs go for the food
  rich(S); raidAt(dev, S, T, i, 'dogs', 1); const fo = S.res.food; dev.def.out(false); assert.ok(S.res.food < fo);
});

test('a minefield takes a level off the raid that walks into it, and the watchtower sees them coming sooner', () => {
  const { dev, S, T } = base(10); const B = dev.def.border(); S.bp.push('concrete', 'mines'); dev.run(0.01);
  for (const i of B) { rich(S); dev.def.build(i, 'mines'); dev.def.build(i, 'tower') }
  dev.def.tick(1); S.raid.next = 0; S.raid.n = 6; dev.def.tick(0.1); const c = S.raid.cur; assert.ok(c, 'a raid'); const lvl = c.lvl;
  assert.equal(c.left, 75, '30 s more warning near a watchtower'); dev.def.tick(c.left + .1); assert.equal(c.lvl, Math.max(1, lvl - 1)); assert.ok(c.mined); assert.equal(S.dfs[c.i].mines, 0, 'used up');
});

test('a charged Orbital Lance can strike the raid from orbit', () => {
  const { dev, S, T } = base(10); S.mats = { copper: 80, iron: 90, wire: 60, crystal: 60 }; S.res = { scrap: 840, water: 400, food: 400 }; S.k.fuel = 200;
  dev.orbit.board(); dev.run(21); S.bp.push('turrets', 'lance'); dev.orbit.act('open');
  for (const [sl, k] of [[0, 'solar'], [1, 'solar'], [2, 'lance']]) { S.res = { scrap: 840, water: 400, food: 400 }; S.k.fuel = 200; dev.orbit.pick(sl); dev.orbit.act('fit:' + k); dev.run(16) }
  assert.ok(dev.orbit.info().on.has(2), 'the lance has power and crew'); assert.ok(!dev.orbit.lance()); dev.run(91); assert.ok(dev.orbit.lance(), 'charged after a day');
  const i = dev.def.border()[0]; raidAt(dev, S, T, i); assert.ok(dev.def.alert().b.some(b => b[0] === 'df:lance'));
  dev.act('df:lance'); assert.equal(S.raid.cur, null); assert.equal(S.raid.won, 1); assert.ok(!dev.orbit.lance(), 'spent'); assert.match(S.log[0], /Orbital Lance/);
});

test('defenses and raids survive a save, and older saves load without them', () => {
  const { dev, S, T } = base(10); const i = dev.def.border()[0]; rich(S); dev.def.build(i, 'wall'); dev.def.tick(1); dev.def.spawn();
  S.raid.dmg[i] = 1; const save = JSON.parse(JSON.stringify(dev.ser())), b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]])), S2 = b2.dev.S();
  assert.equal(S2.dfs[i].wall, 1); assert.ok(S2.raid.on); assert.ok(S2.raid.cur, 'the raid on its way'); assert.ok(S2.raid.dmg[i]); assert.equal(b2.A.bugs.length, 0);
  delete save.dfs; delete save.raid; const b3 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() })]]));
  assert.ok(!b3.dev.S().raid || !b3.dev.S().raid.cur); assert.doesNotThrow(() => b3.dev.draw()); b3.dev.def.tick(1); assert.ok(b3.dev.S().raid.on, 'an older colony this size gets raids from now on');
});
