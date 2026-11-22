// Ashen Sphere, home-and-away slice 1: one whole expedition, played through the page's own code.
// The page script runs in a Node VM with a tiny stand-in for the browser (no canvas output, no network),
// then the test presses the same buttons a player would: build the ship, launch, fly, land, explore, fly home.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

test('the whole first expedition: build, launch, fly, land, explore, fly home, unlock', () => {
  const { dev, frame } = boot();
  const S = () => dev.S();
  const pad = readyBase(dev);
  dev.setView('surface'); dev.sel(pad);
  assert.match(dev.panel(), /expedition to Mirewater/, 'the pad offers the expedition after Lantern-2');
  assert.match(dev.panel(), /Roc engine/, 'the default ship uses the Roc engine from Lantern-2');

  // crew of two, three packs of rations
  const crewIds = S().people.slice(0, 2).map(p => p.id);
  S().k.crew = []; S().k.crewTouched = true;
  for (const id of crewIds) dev.act('xc:' + id);
  dev.act('xr:+');
  assert.equal(S().k.rations, 60);
  dev.sel(pad);
  const html = dev.panel();
  assert.doesNotMatch(html, /✗/, 'every pre-launch check is green: ' + html.match(/✗[^<]*/g));
  const scrap0 = S().res.scrap, pop0 = S().people.length;
  dev.act('xlaunch');
  assert.ok(S().x, 'the expedition exists');
  assert.equal(S().x.phase, 'ascent');
  assert.equal(S().people.length, pop0 - 2, 'the crew leaves the base');
  assert.ok(S().res.scrap < scrap0, 'new parts were paid for');
  assert.equal(JSON.stringify(S().x.crew.map(p => p.id)), JSON.stringify(crewIds));

  // the base keeps running while the ship is away: time passes, food is eaten
  const t0 = S().t;
  dev.run(21);
  assert.equal(S().x.phase, 'out', 'after the ascent the ship is on its way');
  assert.ok(S().t > t0);
  dev.setView('stars'); frame(2000); frame(2100);   // draw the system map with the ship in transit
  assert.match(dev.panel(), /on its way to Mirewater/);
  dev.run(31);
  assert.equal(S().x.phase, 'orbit');

  // choose a landing site: a land tile with plenty of land around it
  dev.setView('away');
  assert.equal(dev.view(), 'away');
  frame(2200);
  const A = dev.away('mire');
  assert.equal(A.length, 642);
  const kinds = new Set(A.map(t => t.b));
  for (const b of ['msea', 'bog', 'reeds', 'spore', 'shell', 'spire']) assert.ok(kinds.has(b), 'Mirewater has ' + b);
  assert.ok(!kinds.has('ash') && !kinds.has('ruins'), 'and none of the Ashen biomes');
  const site = A.findIndex((t, i) => t.b !== 'msea' && !t.pent && t.n.filter(j => A[j].b !== 'msea' && !A[j].pent).length >= 5);
  assert.ok(site >= 0);
  dev.sel(site);
  assert.match(dev.panel(), /Land here/);
  dev.act('land');
  assert.equal(S().x.phase, 'landed');
  assert.equal(S().x.site, site);
  frame(2300);

  // walk the landing site (free), then explore a neighbour with rations
  dev.sel(site); dev.act('xwalk');
  assert.equal(dev.view(), 'map');
  assert.ok(S().exp.away);
  frame(2400);
  // A scripted player: pick up any find it can reach, otherwise walk into the nearest fog at the edge of what it has seen.
  const MW = 11, MH = 9;
  const walkAll = () => {
    for (let guard = 0; guard < 120; guard++) {
      const card = dev.card();
      if (card) {
        if (card.kind === 'threat') { dev.act(S().x.steps >= 20 ? 'pay' : 'back'); if (dev.card()) dev.act('back'); continue; }
        if (card.kind === 'event') { dev.act('ev:close'); continue; }
        if (card.kind === 'out') return 'out';
        dev.act('ok'); continue;
      }
      if (!S().exp) return 'left';
      const M = dev.map(), ms = dev.mapState(), skip = new Set(M.pois.filter(p => p.type === 'event').map(p => p.k));
      const todo = M.pois.map((p, ix) => ({ p, ix })).filter(({ p, ix }) => !ms.got.includes(ix) && p.type !== 'event' && ms.rev[p.k] === '1');
      let moved = false;
      for (const { p } of todo) if (dev.path(p.k)) { dev.walk(); moved = true; break; }
      if (moved) continue;
      const fog = [];
      for (let k = 0; k < MW * MH; k++) {
        if (ms.rev[k] === '1' || skip.has(k)) continue;
        const x = k % MW, y = (k / MW) | 0;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return false; const n = ny * MW + nx; return ms.rev[n] === '1' && M.g[n] !== 1; })) fog.push(k);
      }
      for (const k of fog) if (dev.path(k)) { dev.walk(); moved = true; break; }
      if (!moved) return 'done';
    }
    return 'guard';
  };
  walkAll();
  dev.act('leave');
  assert.equal(dev.view(), 'away');
  const nb = A[site].n.find(j => A[j].b !== 'msea' && !A[j].pent);
  dev.sel(nb);
  assert.match(dev.panel(), /Send the crew|Go back in/);
  const steps0 = S().x.steps;
  dev.act('xexplore');
  assert.equal(dev.view(), 'map');
  walkAll();
  assert.ok(S().x.steps < steps0, 'walking uncharted land spends rations');
  if (S().exp) dev.act(dev.card() && dev.card().kind === 'out' ? 'out' : 'leave');
  assert.equal(dev.view(), 'away');

  // whatever the crew found went into the hold, not straight home
  const hold = { ...S().x.hold };
  const held = hold.scrap + hold.water + hold.food;
  assert.ok(held > 0, 'something is in the hold');
  assert.ok(held <= S().x.cap, 'the hold never overfills');

  // note a codex site by hand if the walk didn't find one, so the unlock path is always tested
  if (!S().x.notes.length) S().x.notes.push('algae');
  const notes = S().x.notes.slice();
  assert.equal(S().codex.found.length, 0, 'nothing applies until the crew is home');

  // fly home
  dev.sel(site);
  assert.match(dev.panel(), /Fly home/);
  dev.act('flyhome');
  assert.equal(S().x.phase, 'back');
  assert.equal(dev.view(), 'stars');
  dev.run(31);
  assert.equal(S().x, null, 'the expedition is over');
  for (const id of crewIds) assert.ok(S().people.some(p => p.id === id), 'crew member ' + id + ' is home');
  assert.ok(S().log.some(l => /home from Mirewater/.test(l) && /in the hold/.test(l)), 'the hold was unloaded: ' + S().log.join(' | '));
  for (const k of notes) assert.ok(S().codex.found.includes(k), 'codex entry ' + k + ' learned');
  assert.equal(S().xs.trips, 1);
  assert.equal(dev.view(), 'surface', 'the view comes home with the ship');

  // codex unlocks really change the base: an Algae Vat makes food with nobody working it
  S().codex.found = S().codex.found.filter(k => k !== 'algae'); delete S().unl.algae;
  S().x = null;
  const learned = [];
  for (const k of ['algae', 'catalyst', 'filters', 'glass']) if (!S().codex.found.includes(k)) { S().codex.found.push(k); S().unl[k] = 1; learned.push(k); }
  S().ug['1,0'] = { d: 1 };
  dev.setView('below'); dev.selU('1,0');
  assert.match(dev.panel(), /Algae Vat/, 'the new room is offered below');
  const fo0 = dev.E().fo;
  S().ug['1,0'].room = 'algae'; S().order.push('u:1,0');
  dev.run(0.01);
  assert.ok(dev.E().on.has('u:1,0'), 'the vat is running');
  assert.ok(dev.E().fo > fo0 + 0.25, 'and it adds food');
  dev.setView('surface'); dev.sel(pad);
  assert.match(dev.panel(), /Add mire-glass tank/, 'the glass tank part is on the ship builder');
  // the second trip reuses the ship: no new parts to pay for
  dev.setView('surface'); dev.sel(pad);
  assert.match(dev.panel(), /Launch the expedition/);
  assert.doesNotMatch(dev.panel(), /New parts: [1-9]/, 'the kept ship needs no new parts');
});

test('Cinderfall and Glasswind are out of reach for any rocket', () => {
  const { dev } = boot();
  const pad = readyBase(dev);
  dev.setView('surface'); dev.sel(pad);
  dev.act('xd:dest');
  assert.equal(dev.S().k.dest, 'cinder');
  assert.match(dev.panel(), /no rocket carries that much fuel/);
  assert.match(dev.panel(), /data-act="xlaunch" disabled/);
  dev.act('xd:dest'); dev.act('xd:dest');
  assert.equal(dev.S().k.dest, 'mire');
});

test('a thin-margin launch can fail, and the escape tower always saves the crew', () => {
  const { dev } = boot();
  const pad = readyBase(dev);
  const S = dev.S();
  // Roc with four large tanks and two pods is just over Mirewater's 4000 m/s: under the 5% margin
  S.k.ship = { engine: 'roc', tanks: ['large', 'large', 'large', 'large'], pods: 2, antenna: true };
  dev.sel(pad);
  assert.match(dev.panel(), /Thin margin/);
  const crew = S.people.slice(0, 2).map(p => p.id);
  S.k.crew = crew.slice(); S.k.crewTouched = true;
  let failed = false;
  for (let n = 0; n < 12 && !failed; n++) {
    S.k.fuel = 200; S.res.scrap = 900; S.res.food = 400; S.res.water = 400; S.xs.built = [];
    dev.sel(pad); dev.act('xlaunch');
    assert.ok(S.k.flight && S.k.flight.ms === 'exped');
    const willFail = S.k.flight.fail;
    dev.run(21);
    if (willFail) {
      failed = true;
      assert.equal(S.x, null);
      for (const id of crew) assert.ok(S.people.some(p => p.id === id), 'the crew walked away');
      assert.equal(S.xs.built.length, 0, 'the ship is lost');
    } else {
      // bring them home and try again
      dev.run(31); dev.setView('away');
      const A = dev.away('mire'), site = A.findIndex(t => t.b !== 'msea' && !t.pent);
      dev.sel(site); dev.act('land'); dev.act('flyhome'); dev.run(31);
      assert.equal(S.x, null);
    }
  }
  assert.ok(failed, 'at least one thin-margin launch failed in twelve tries');
});

test('mid-trip saves load back, and v7 saves migrate', () => {
  const { dev, storage } = boot();
  const pad = readyBase(dev);
  dev.sel(pad); dev.act('xlaunch');
  dev.run(25);
  assert.equal(dev.S().x.phase, 'out');
  const snap = JSON.parse(JSON.stringify(dev.ser()));
  assert.equal(snap.v, 9);
  const back = dev.deser(snap);
  assert.equal(back.x.phase, 'out');
  assert.equal(back.x.crew.length, dev.S().x.crew.length);
  // reload the page from storage: the trip carries on
  storage.set('ashen-sphere-v9', JSON.stringify(snap));
  const b2 = boot(storage);
  assert.ok(b2.dev.S().x, 'the expedition survives a reload');
  b2.dev.run(40);
  assert.ok(['orbit', 'landed'].includes(b2.dev.S().x.phase));

  // a v7 save (before expeditions) still loads, gets a ship design, and keeps its goal
  const v7 = JSON.parse(JSON.stringify(snap));
  v7.v = 7; delete v7.x; delete v7.xw; delete v7.xs; delete v7.k.ship; delete v7.k.dest; delete v7.k.rations; delete v7.k.crew; delete v7.codex.found;
  v7.goal = 15;   // was "Hold 60 tiles"
  const m = dev.deser(v7);
  assert.ok(m, 'v7 loads');
  assert.equal(m.x, null);
  assert.equal(JSON.stringify(m.xs), JSON.stringify({ built: [], trips: 0 }));
  assert.equal(m.k.ship.engine, 'roc');
  assert.equal(m.codex.found.length, 0);
  assert.equal(m.goal, 16, 'old goal 15 (Hold 60 tiles) is goal 16 now that the expedition goal sits before it');
});
