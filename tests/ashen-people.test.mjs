// Ashen Sphere: the people in the base never vanish and the game never freezes.
// A bug report: in a long game, with a dig running, the people disappeared from the base and the whole game stopped.
// The digger has no name, so it is drawn as a plain puppet, and the plain puppets (ANON) had gone missing from the page,
// so drawing it threw an error halfway through the frame, before anyone else was drawn, and the next frame never came.
// These tests play that through the page's own frame loop, and check that a bug in one part of a frame can't freeze
// the game again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

test('people are drawn even when the game has no name for them: the digger, and anyone it has no record for', () => {
  const { A, dev, frame } = boot();
  readyBase(dev);
  const S = dev.S();
  S.dig = { k: '1,4', left: 6, total: 8 };   // digging the shaft below the first row, as in the report
  dev.setView('below');
  assert.doesNotThrow(() => dev.draw(), 'the base draws with a dig running');
  assert.ok(dev.E().idle > 0, 'some people are resting in the bunks');
  const people = S.people;
  S.people = [];   // the bunks still have resting people to draw, with no record of who they are
  try { assert.doesNotThrow(() => dev.draw(), 'unnamed people are drawn as plain puppets'); } finally { S.people = people; }
  frame(2000); frame(2600);
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  assert.ok(S.dig && S.dig.left < 6, 'the dig carries on');
});

test('a save with a dig running loads, draws the base and keeps going', () => {
  const first = boot();
  readyBase(first.dev);
  const S0 = first.dev.S();
  S0.dig = { k: '1,4', left: 30, total: 40 };
  const storage = new Map([['ashen-sphere-v9', JSON.stringify(first.dev.ser())]]);
  const { A, dev, frame } = boot(storage);
  const S = dev.S();
  assert.ok(S.dig, 'the dig came back with the save');
  dev.setView('below');
  const t0 = S.t, left0 = S.dig.left;
  for (let i = 1; i <= 4; i++) frame(2000 + 500 * i);
  assert.deepEqual([...A.bugs], [], 'no part of a frame hit a bug');
  assert.ok(S.t > t0 + 1.9, 'the game clock is running');
  assert.ok(S.dig.left < left0 - 1.9, 'the dig is moving');
});

test('a bug in one part of a frame cannot freeze the game: the rest runs, the next frame comes, the bug is noted once', () => {
  const { A, dev, els, frame, rafs } = boot();
  readyBase(dev);
  const S = dev.S();
  S.ug['2,0'] = { d: 1, room: 'no-such-room' };   // a deliberate fault: drawing the base will hit it every frame
  dev.setView('below');
  const t0 = S.t, n0 = rafs();
  assert.doesNotThrow(() => { frame(2000); frame(2500); }, 'the frame loop does not throw');
  assert.ok(S.t > t0 + 1.4, 'the game clock kept running');
  assert.equal(rafs(), n0 + 2, 'each frame asked for the next one');
  assert.equal(A.bugs.length, 1, 'the bug is noted once, not every frame');
  assert.match(A.bugs[0], /^draw: /);
  assert.match(els.get('toast').textContent, /^Something broke \(draw: .+\)\. The game kept going\.$/, 'the player is told what broke');
  delete S.ug['2,0'];
  frame(3000);
  assert.equal(A.bugs.length, 1, 'with the fault gone, nothing new breaks');
});
