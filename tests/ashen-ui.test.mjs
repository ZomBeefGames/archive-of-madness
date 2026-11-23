// Ashen Sphere: the screen is the game. Supplies sit in a slim bar on top, the panel is a sheet that slides up from the
// bottom (a column on the right on wide screens), and messages go to a small event channel at the top left instead of
// a box over the game. A fight gets the screen to itself; a tap that picks something raises a lowered sheet to show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function base(tiles = 10) { const b = boot(); readyBase(b.dev); const S = b.dev.S(), T = b.dev.home(); S.pop = Math.max(S.pop, 14);
  const more = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => T[j].b !== 'sea' && !T[j].pent && !S.owned.has(j));
  for (const j of more) { if (S.owned.size >= tiles) break; S.owned.add(j); S.seen.add(j) }
  b.dev.run(0.01); return { ...b, S, T }; }
// a raid at the wall of tile i right now
function raidAt(dev, S, T, i) { dev.def.tick(0.001); const R = S.raid; R.on = true; const from = T[i].n.find(j => T[j].b !== 'sea' && !S.owned.has(j));
  R.cur = { i, from: from ?? T[i].n[0], foe: 'raiders', lvl: 2, left: 0, total: 40, phase: 'here', wait: 30, seed: 99, att: 0, mined: false }; return R.cur; }

test('what happens goes to the event channel with its day, and the log keeps its last 20 lines', () => {
  const { dev, S } = base(10), U = dev.uix;
  S.log = Array.from({ length: 25 }, (_, n) => 'D1 · line ' + n);
  dev.def.tick(1); assert.match(S.log[0], /Smoke on the horizon/, 'the game said something');
  assert.equal(S.log.length, 20, 'the log keeps 20 lines (it kept 4)');
  const e = U.feed().find(x => /^Smoke on the horizon/.test(x.text)); assert.ok(e, 'the same line, in the channel'); assert.equal(e.kind, 'ev');
  assert.ok(e.d >= 1, 'with its day'); assert.ok(U.live().includes(U.feed()[0].text.slice(0, 20)), 'the newest is shown for a few seconds');
  U.list(true); assert.match(U.listHTML(), /<i>Day \d+<\/i>Smoke on the horizon/, 'Events lists it with its day'); assert.equal(U.live(), '', 'the open list takes the place of the fading lines');
  U.list(false); assert.ok(U.live().includes(U.feed()[0].text.slice(0, 20)));
  // saves: 20 lines come back, an old save's 4 still load
  const save = JSON.parse(JSON.stringify(dev.ser())); assert.equal(dev.deser(save).log.length, 20);
  save.log = save.log.slice(0, 4); assert.equal(dev.deser(save).log.length, 4);
});

test('a note is counted when it comes again, not repeated, and text stays text', () => {
  const { dev } = boot(), U = dev.uix;
  U.push('Not enough scrap.'); U.push('Not enough scrap.');
  const f = U.feed(); assert.equal(f[0].n, 2); assert.equal(f.filter(e => e.text === 'Not enough scrap.').length, 1);
  assert.match(U.live(), /Not enough scrap\.<em>×2<\/em>/);
  U.push('<b>bold</b> & more'); assert.doesNotMatch(U.live(), /<b>bold<\/b>/); assert.match(U.live(), /&lt;b&gt;bold&lt;\/b&gt; &amp; more/);
  // at most three at once, newest first
  for (const t of ['one', 'two', 'three', 'four']) U.push(t);
  const lines = U.live().match(/<div class="ev /g) || []; assert.equal(lines.length, 3); assert.ok(U.live().indexOf('four') < U.live().indexOf('three'));
});

test('the log a save already holds is in the channel from the start, and time away comes in as a note, not a box', () => {
  const { dev } = boot(); readyBase(dev); const save = JSON.parse(JSON.stringify(dev.ser()));
  save.log = ['D3 · An old line from the save.'];
  const b2 = boot(new Map([['ashen-sphere-v9', JSON.stringify({ ...save, saved: Date.now() - 20 * 60 * 1000 })]])), f = b2.dev.uix.feed();
  const away = f.find(e => /^While you were away/.test(e.text)); assert.ok(away, 'the time away is in the channel'); assert.equal(away.kind, 'note');
  const old = f.find(e => e.text === 'An old line from the save.'); assert.ok(old, "the save's log is there"); assert.equal(old.d, 3); assert.ok(old.t < 0, 'old lines are listed, not shown again');
  assert.ok(f.indexOf(away) < f.indexOf(old), 'newest first');
  assert.match(b2.els.get('toast').textContent, /^While you were away/, 'the toast text is still set for anything that reads it');
});

test('a fight gets the screen: the sheet drops to its peek and comes back after, and the result is a note', () => {
  const { dev, S, T, els } = base(10), U = dev.uix, i = dev.def.border()[0];
  U.set('half'); raidAt(dev, S, T, i); dev.def.fight('play');
  assert.equal(dev.view(), 'fight'); assert.equal(U.st().st, 'peek', 'lowered for the fight'); assert.equal(U.st().pre, 'half');
  els.get('toast').hidden = true; dev.act('fquit');
  assert.notEqual(dev.view(), 'fight'); assert.equal(U.st().st, 'half', 'back as it was'); assert.equal(U.st().pre, null);
  assert.equal(els.get('toast').hidden, true, 'no box pops up over the game'); assert.match(U.feed()[0].text, /^Lost .* against /);
  // raised by hand during a fight: it stays where it was put
  raidAt(dev, S, T, i); dev.def.fight('play'); U.set('full'); dev.act('fquit'); assert.equal(U.st().st, 'full');
});

test('a tap that picks something raises a lowered sheet; the game changing the panel on its own does not', () => {
  const { dev } = boot(); readyBase(dev); const U = dev.uix, [a, b, c] = [...dev.S().owned];
  dev.sel(a); U.set('peek');
  dev.sel(b); assert.equal(U.st().st, 'peek', 'no tap: it stays down');
  U.poke(); dev.sel(c); assert.equal(U.st().st, 'half', 'a tap on a tile raises it to show the tile');
  U.set('full'); U.poke(); dev.sel(a); assert.equal(U.st().st, 'full', 'a raised sheet is left as it is');
});

test("the sheet's heights leave the game room on any phone, and the peek clears the home bar", () => {
  const { dev } = boot(), px = dev.uix.px;
  for (const [vh, hh] of [[844, 67], [740, 63], [667, 84], [568, 63], [480, 60]]) {
    const peek = px('peek', vh, hh, 0), half = px('half', vh, hh, 0), full = px('full', vh, hh, 0);
    assert.ok(peek <= half && half <= full, vh + ': peek, half, full in order');
    assert.ok(vh - hh - full >= 170, vh + ': the game keeps at least 170 px');
    assert.ok(half >= vh * .3 || half === full, vh + ': half is a real look at the panel');
  }
  assert.equal(px('peek', 844, 67, 34), px('peek', 844, 67, 0) + 34, 'the peek clears the home bar');
});
