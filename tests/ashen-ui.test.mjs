// Ashen Sphere: the screen is the game. Supplies sit in a slim bar on top, the panel is a sheet that slides up from the
// bottom (a column on the right on wide screens), and messages go to the events bar just under the game instead of a
// box over it: two lines at most, all of them on request, and it can be closed. What is going on right now (a raid, the
// squad out, inspectors) is an icon in that bar that opens on a tap. A fight gets the screen to itself; a tap that
// picks something raises a lowered sheet to show it.
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
  assert.ok(e.d >= 1, 'with its day'); assert.ok(U.live().includes(U.feed()[0].text.slice(0, 20)), 'the newest is shown in the bar');
  U.list(true); assert.match(U.listHTML(), /<i>Day \d+<\/i>Smoke on the horizon/, 'Events lists it with its day'); assert.equal(U.live(), '', 'the open list takes the place of the two lines');
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
  // two lines at most, newest first; a new line is lit, and it stays as the last thing that happened once it is old
  for (const t of ['one', 'two', 'three', 'four']) U.push(t);
  const lines = U.live().match(/<div class="ev /g) || []; assert.equal(lines.length, 2); assert.ok(U.live().indexOf('four') < U.live().indexOf('three'));
  assert.doesNotMatch(U.live(), /two/); assert.match(U.live(), /class="ev note new"/);
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

test('the events bar can be closed and opened again, and it is remembered', () => {
  const b = boot(), U = b.dev.uix;
  assert.equal(U.ev(), 'open'); U.push('A line.'); assert.match(U.live(), /A line\./);
  U.setEv('closed'); assert.equal(U.ev(), 'closed'); assert.equal(U.live(), '', 'closed: no lines, only the strip');
  assert.equal(JSON.parse(b.storage.get('ashen-ui')).ev, 'closed');
  U.push('Another.'); assert.equal(U.live(), '', 'it stays closed when something happens'); assert.equal(U.feed()[0].text, 'Another.', 'and nothing is lost');
  const b2 = boot(b.storage); assert.equal(b2.dev.uix.ev(), 'closed', 'the next visit finds it closed');
  b2.dev.uix.list(true); assert.equal(b2.dev.uix.ev(), 'open', 'asking for all events opens it'); assert.match(b2.dev.uix.listHTML(), /Nothing has happened yet|evl/);
  b2.dev.uix.setEv('closed'); assert.equal(b2.dev.uix.st().list, false, 'closing it puts the list away too');
  b2.dev.uix.setEv('open'); assert.equal(b2.dev.uix.ev(), 'open');
});

test('what is going on right now is an icon in the bar: it flashes, a tap opens it with its buttons, and it closes when it is over', () => {
  const { dev, S, T } = base(10), U = dev.uix, i = dev.def.border()[0];
  U.tick(); assert.equal(U.alerts().length, 0); assert.equal(U.icons(), ''); assert.equal(U.alertBox().hidden, true, 'nothing on: no icons, nothing open');
  const c = raidAt(dev, S, T, i); c.foe = 'dogs'; c.phase = 'coming'; c.left = 61; U.tick();
  const [a] = U.alerts(); assert.equal(a.k, 'raid'); assert.equal(a.ic, 'paw', 'feral dogs get a paw'); assert.equal(a.n, 61); assert.equal(a.hot, 1);
  assert.match(U.icons(), /class="evic hot" type="button" data-al="raid" aria-expanded="false"/); assert.match(U.icons(), /<b>61s<\/b>/);
  assert.equal(U.alertBox().hidden, true, 'it does not open by itself: nothing covers the game');
  U.pick('raid'); assert.equal(U.picked(), 'raid'); assert.equal(U.alertBox().hidden, false);
  assert.match(U.alertBox().html, /Feral dogs coming at tile \d+ · 61 s/); assert.match(U.alertBox().html, /data-act="df:look"/); assert.match(U.icons(), /aria-expanded="true"/);
  // at the wall it wants an answer: it flashes faster, and the open box has the choices
  c.phase = 'here'; c.left = 0; c.wait = 30; U.tick();
  assert.equal(U.alerts()[0].hot, 2); assert.match(U.icons(), /class="evic hot now"/); assert.match(U.alertBox().html, /data-act="df:fight"/); assert.match(U.alertBox().html, /data-act="df:quick"/);
  // the kind of band shows in the icon
  c.foe = 'raiders'; assert.equal(U.alerts()[0].ic, 'raid'); c.foe = 'nest'; assert.equal(U.alerts()[0].ic, 'mut');
  // a tap again closes it; the thing ending closes it too
  U.pick('raid'); assert.equal(U.picked(), null); assert.equal(U.alertBox().hidden, true);
  U.pick('raid'); assert.equal(U.alertBox().hidden, false); S.raid.cur = null; U.tick();
  assert.equal(U.picked(), null); assert.equal(U.alertBox().hidden, true); assert.equal(U.icons(), '');
  // the first of them is still what alertText() gives (the old single alert)
  raidAt(dev, S, T, i); assert.equal(dev.def.alertNow().b[0][0], 'df:fight');
});

test('long countdowns show in minutes, and text in an opened event stays text', () => {
  const { dev, S, T } = base(10), U = dev.uix, i = dev.def.border()[0];
  const c = raidAt(dev, S, T, i); c.phase = 'coming'; c.left = 240; U.tick(); assert.match(U.icons(), /<b>4m<\/b>/);
  c.left = 99; U.tick(); U.pick('raid'); assert.match(U.icons(), /<b>99s<\/b>/);
  assert.doesNotMatch(U.alertBox().html, /<script/); assert.match(U.alertBox().html, /^<span>Raiders coming at tile/);
});
