// Ashen Sphere: the panel's tabs (Here, People, Research, Stores, Guide, Menu), the options behind the Menu tab (sound
// and music levels, difficulty, the tutorial, starting over), the small tutorial, and how a Spire's lesson is offered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base(tiles = 10) { const b = boot(); readyBase(b.dev); const S = b.dev.S(), T = b.dev.home(); S.pop = Math.max(S.pop, 14);
  const more = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => T[j].b !== 'sea' && !T[j].pent && !S.owned.has(j));
  for (const j of more) { if (S.owned.size >= tiles) break; S.owned.add(j); S.seen.add(j) }
  b.dev.run(0.01); return { ...b, S, T }; }
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the tabs are the windows: Here shows what was picked, the others their own page, and picking something else goes back to Here', () => {
  const { dev, S, els } = base(10), U = dev.uix, [a, b] = [...S.owned];
  dev.setView('surface'); dev.sel(a); assert.equal(U.tab(), 'here'); assert.match(U.tabs(), /data-tab="here" aria-selected="true"/);
  for (const k of ['people', 'research', 'stores', 'guide', 'menu']) assert.match(U.tabs(), new RegExp('data-tab="' + k + '" aria-selected="false"'));
  U.setTab('people'); assert.match(dev.panel(), /Your people/); assert.match(U.tabs(), /data-tab="people" aria-selected="true"/);
  U.setTab('research'); assert.match(dev.panel(), /Blueprints/); assert.doesNotMatch(dev.panel(), /Back to your people/);
  U.setTab('stores'); assert.match(text(dev.panel()), /Stores Supplies · room for \d+ of each Scrap/); assert.match(dev.panel(), /Materials/);
  U.setTab('guide'); assert.match(text(dev.panel()), /Guide Goal \d+ of \d+/); assert.match(dev.panel(), /Teach someone at a Spire/);
  U.setTab('menu'); assert.match(dev.panel(), /Sound/); assert.match(dev.panel(), /Difficulty/); assert.match(dev.panel(), /Start a new world/);
  dev.sel(b); assert.equal(U.tab(), 'here', 'choosing another tile shows it'); assert.match(dev.panel(), /Tile \d+/);
  // the People chip still opens and closes the people
  els.get('people-chip').onclick(); dev.act('noop'); assert.equal(U.tab(), 'people'); els.get('people-chip').onclick(); dev.act('noop'); assert.equal(U.tab(), 'here');
  // a tab raises a lowered panel; a fight has no tabs
  U.set('peek'); U.setTab('guide'); assert.equal(U.st().st, 'half');
  const i = dev.def.border()[0]; dev.def.tick(0.001); S.raid.on = true;
  S.raid.cur = { i, from: dev.home()[i].n[0], foe: 'raiders', lvl: 1, left: 0, total: 40, phase: 'here', wait: 30, seed: 5, att: 0, mined: false };
  dev.def.fight('play'); assert.equal(dev.view(), 'fight'); dev.act('noop'); assert.equal(U.tabs(), '', 'no tabs in a fight'); assert.doesNotMatch(dev.panel(), /Guide/);
  dev.act('fquit'); dev.act('noop'); assert.match(U.tabs(), /data-tab="here"/);
});

test('sound and music levels are options that are remembered, and the game runs where there is no sound at all', () => {
  const b = boot(), U = b.dev.uix; readyBase(b.dev);
  assert.deepEqual([U.opts().sfx, U.opts().mus], [2, 2], 'medium to start with');
  U.setTab('menu'); assert.match(b.dev.panel(), /data-act="opt:sfx:2" aria-pressed="true"/); assert.match(b.dev.panel(), /This browser has no sound/);
  b.dev.act('opt:sfx:0'); b.dev.act('opt:mus:3'); assert.deepEqual([U.opts().sfx, U.opts().mus], [0, 3]);
  assert.match(b.dev.panel(), /data-act="opt:sfx:0" aria-pressed="true"/); assert.match(b.dev.panel(), /data-act="opt:mus:3" aria-pressed="true"/);
  const saved = JSON.parse(b.storage.get('ashen-ui')); assert.equal(saved.sfx, 0); assert.equal(saved.mus, 3);
  b.dev.act('opt:mus:9'); assert.equal(U.opts().mus, 3, 'never past high');
  const b2 = boot(b.storage); assert.deepEqual([b2.dev.uix.opts().sfx, b2.dev.uix.opts().mus], [0, 3], 'the next visit keeps them');
  assert.equal(U.sndx.on(), false, 'no sound here, and nothing breaks'); U.push('Goal met: something.'); assert.equal(b.A.bugs.length, 0);
  // the words in the events bar pick the effect
  assert.equal(U.sndFor('A pack of feral dogs is coming at tile 204: 75 s. Tap Show me.', 'note'), 'warn'); assert.equal(U.sndFor('A raider band is at the wall of tile 9. Fight, or let the defenses fight.', 'note'), 'alarm');
  assert.equal(U.sndFor('Mara studied the Spire and came back changed: spire-taught, 1 research a second.', 'ev'), 'learn'); assert.equal(U.sndFor('Goal met: claim 3 more tiles. Reward 40 scrap.', 'ev'), 'good');
  assert.equal(U.sndFor('Not enough scrap.', 'note'), 'deny'); assert.equal(U.sndFor('Something broke (draw: x). The game kept going.', 'bug'), ''); assert.equal(U.sndFor('The trader packs up and heads off.', 'ev'), 'ev');
});

test('difficulty moves the raids and the creatures, Normal changes nothing, and it is saved with the world', () => {
  const spawn = d => { const { dev, S } = base(10); if (d) dev.act('opt:diff:' + d); dev.def.tick(1); S.raid.next = 0; S.raid.n = 3; dev.def.tick(0.1); return { dev, S, c: S.raid.cur }; };
  const n = spawn(''), e = spawn('easy'), h = spawn('hard');
  assert.equal(n.dev.uix.opts().diff, 'normal'); assert.equal(n.dev.uix.diffOf().every, 1);
  assert.equal(n.c.i, e.c.i, 'the same raid, at the same tile'); assert.equal(n.c.foe, h.c.foe);
  assert.equal(e.c.lvl, Math.max(1, n.c.lvl - 1), 'easy: a level weaker'); assert.equal(h.c.lvl, Math.min(4, n.c.lvl + 1), 'hard: a level stronger');
  assert.equal(e.c.left, n.c.left * 1.5, 'easy: half as much warning again'); assert.equal(h.c.left, n.c.left * 0.75); assert.equal(e.c.wait, 45); assert.equal(h.c.wait, 22.5);
  // losing costs half as much on easy, half as much again on hard
  const lose = x => { x.S.res = { scrap: 800, water: 400, food: 400 }; x.c.foe = 'raiders'; x.c.lvl = 2; x.c.phase = 'here'; const before = x.S.res.scrap; x.dev.def.out(false); return before - x.S.res.scrap; };
  const ln = lose(n), le = lose(e), lh = lose(h); assert.ok(ln > 0); assert.equal(le, Math.round(ln / 2)); assert.equal(lh, Math.round(ln * 1.5));
  // creatures out on the tiles: a level either way, never below 1, and harmless things stay harmless
  const tn = n.dev.uix.threat('dogs'), te = e.dev.uix.threat('dogs'), th = h.dev.uix.threat('dogs');
  assert.ok(tn.lvl >= 1); assert.equal(te.lvl, Math.max(1, tn.lvl - 1)); assert.equal(th.lvl, tn.lvl + 1); assert.equal(te.name, tn.name); assert.equal(n.dev.uix.threat('nothing-like-this'), undefined);
  // saved with the world, shown in the menu, carried into a new world, and Normal takes it off again
  const save = JSON.parse(JSON.stringify(h.dev.ser())); assert.equal(h.dev.deser(save).k.diff, 'hard');
  h.dev.uix.setTab('menu'); assert.match(h.dev.panel(), /data-act="opt:diff:hard" aria-pressed="true"/); assert.match(h.dev.panel(), /Raids come more often/);
  h.dev.act('menu:new'); assert.match(h.dev.panel(), /Start over on a fresh world\?/); h.dev.act('menu:newno'); assert.doesNotMatch(h.dev.panel(), /Start over on a fresh world\?/);
  h.dev.act('menu:new'); h.dev.act('menu:newyes'); const S2 = h.dev.S(); assert.equal(S2.owned.size, 3, 'a fresh world'); assert.equal(S2.k.diff, 'hard', 'as hard as the last'); assert.equal(h.dev.uix.tab(), 'here');
  h.dev.act('opt:diff:normal'); assert.equal(h.dev.S().k.diff, undefined); assert.equal(h.dev.uix.diffOf().lvl, 0);
});

test('a small tutorial: a new world starts with it, doing each step ticks it, and it can be skipped and brought back', () => {
  const { dev } = boot(), U = dev.uix, S = dev.S(), T = dev.home();
  assert.equal(U.opts().tut, 1); dev.setView('surface'); dev.act('noop'); assert.match(dev.panel(), /Getting started · 1 of 6/); assert.match(dev.panel(), /Look around/);
  U.tutMark(1); dev.act('noop'); assert.match(dev.panel(), /2 of 6/); assert.match(dev.panel(), /Claim land/);
  const next = [...new Set([...S.owned].flatMap(i => T[i].n))].find(j => T[j].b !== 'sea' && !T[j].pent && !S.owned.has(j)); S.res.scrap = 900; dev.sel(next); dev.act('claim');
  assert.ok(S.owned.has(next)); assert.match(dev.panel(), /3 of 6/); assert.match(dev.panel(), /Build\./);
  S.bld[next] = 'camp'; S.order.push(next); dev.act('noop'); assert.match(dev.panel(), /4 of 6/); assert.match(dev.panel(), /data-act="tut:ok"/, 'a step that only wants reading has Got it');
  dev.act('tut:ok'); assert.match(dev.panel(), /5 of 6/); assert.match(dev.panel(), /The tabs/);
  U.setTab('guide'); assert.match(dev.panel(), /class="ok">Open a tab/); assert.match(dev.panel(), /class="">Follow the goal/); U.setTab('here'); assert.match(dev.panel(), /6 of 6/);
  dev.act('tut:ok'); assert.equal(U.opts().tut, 0, 'done'); assert.doesNotMatch(dev.panel(), /Getting started/); assert.match(S.log[0], /tutorial done/);
  // brought back from the menu, skipped again; it never shows away from the surface
  dev.act('opt:tut:1'); assert.equal(U.opts().tut, 1); assert.equal(U.tab(), 'here'); assert.match(dev.panel(), /Getting started · 1 of 6/);
  dev.act('tut:skip'); assert.equal(U.opts().tut, 0); assert.doesNotMatch(dev.panel(), /Getting started/);
  // a world saved before the tutorial existed does not get it
  const old = JSON.parse(JSON.stringify(dev.ser())); delete old.k.tut; delete old.k.tf;
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...old, saved: Date.now() })]])); assert.equal(b2.dev.uix.opts().tut, 0); b2.dev.act('noop'); assert.doesNotMatch(b2.dev.panel(), /Getting started/);
  b2.dev.uix.setTab('guide'); assert.match(b2.dev.panel(), /Show the tutorial/);
});

test("a Spire's lesson is offered where you can see it: an icon in the events bar, a dot on People, and the Guide says how", () => {
  const { dev, S, T } = base(10), U = dev.uix;
  assert.ok(!U.alerts().some(a => a.k === 'lesson')); assert.doesNotMatch(U.tabs(), /class="tab dot"/);
  const spire = T.findIndex(t => t.pent && t.n.some(n => T[n].b !== 'sea')), nb = T[spire].n.find(n => T[n].b !== 'sea'); S.owned.add(nb); S.seen.add(spire); S.res.scrap = 5000;
  dev.setView('surface'); dev.sel(spire); dev.act('claim'); assert.ok(S.owned.has(spire)); assert.equal(S.k.lessons, 1);
  const a = U.alerts().find(x => x.k === 'lesson'); assert.ok(a, 'it is one of the things going on'); assert.equal(a.ic, 'spire'); assert.equal(a.hot, 0, 'steady: it has no clock'); assert.equal(a.b[0].join('|'), 'tab:people|Choose who');
  U.tick(); assert.match(U.icons(), /data-al="lesson"/); assert.match(U.tabs(), /class="tab dot" type="button" role="tab" data-tab="people"/);
  U.setTab('guide'); dev.act('help:spire'); const g = text(dev.panel()); assert.match(g, /Find a Spire: a five-sided tile/); assert.match(g, /You hold 1 of 12 Spires, and 1 lesson is waiting/); assert.match(dev.panel(), /data-act="tab:people"/);
  dev.act('help:spire'); assert.doesNotMatch(text(dev.panel()), /five-sided tile\. There are 12/, 'a topic closes again');
  // the icon's button goes to the People tab, where a tap on a name teaches them
  U.pick('lesson'); assert.match(U.alertBox().html, /A Spire can teach someone: pick who studies it/); dev.act('tab:people'); assert.equal(U.tab(), 'people');
  const plain = S.people.find(p => !p.iq); assert.match(dev.panel(), new RegExp('data-act="teach:' + plain.id + '"')); dev.act('teach:' + plain.id);
  assert.equal(plain.iq, 2, 'one lesson makes anyone Spire-taught'); U.tick(); assert.ok(!U.alerts().some(x => x.k === 'lesson')); assert.equal(U.icons(), ''); dev.act('noop'); assert.doesNotMatch(U.tabs(), /class="tab dot"/);
});
