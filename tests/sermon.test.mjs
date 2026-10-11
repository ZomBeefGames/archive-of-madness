import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function between(start, end) {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing source markers: ${start}, ${end}`);
  return script.slice(a, b);
}
function line(start) {
  return between(start, '\n');
}

// Execute the production encounter, movement, combat and floor geometry in a
// fresh VM. Only rendering/audio and unrelated game systems are stubbed.
function game(inRoom) {
  const G = { inRoom, x: inRoom ? 2.5 : 24, y: 0, ang: 0,
    room: { cx: 0, cy: 0, doors: [0, 3] }, ents: [], alerted: false,
    state: 'play', time: 0, health: 100, sanity: 100, frags: 0, tr: {},
    hurtCd: 0, floor: 0, fires: [], swingCd: 0, weapon: 'press', dark: 0 };
  const voices = [];
  const context = vm.createContext({ G, voices, HUI:{encHover:-1}, ENCS: {}, PUR: [],
    FIGRIG: [[], [], []], ENCRIG: { sleep: [], weep: [], peddler: [], count: [] },
    gaitUpd() {}, voice: (...args) => voices.push(args), sfx() {}, snd() {}, torchLit(){return false}, rememberSentence() {}, eventProof(){return true},
    drawBook() {}, closeBook() {}, galleryBarricadeAt(){return null}, burned: new Set() });
  vm.runInContext([
    between('const R=5,', 'const MAXLV='), line('const NRM='),
    line('function inHexL('), between('function hubStride()', '/* the segments of one square'), between('function walkable(', 'function placeOf('),
    between('function encChoose(', 'function encClosed('),
    between('function mkFig(', 'const seekBody='),
    between('function collideHex(', 'function wallHitIndex('), line('function wallHitIndex('),
    between('function angDiff(', 'function update('),
    between('function updPur(', 'function updSeek('),
    between('function doSwing(', 'function killPur('), line('function nearFire('),
  ].join('\n'), context);
  const run = code => vm.runInContext(code, context);
  const x = inRoom ? 3.8 : 24, y = inRoom ? 0 : 2;
  run(`G.encOn={enc:'sermon',x:${x},y:${y},state:'idle',t:0,said:2,
    members:ENCS.sermon.build({x:${x},y:${y}})};`);
  assert.ok(G.encOn.members, 'Sermon must fit on the real floor');
  return { G, run, voices, scene: G.encOn };
}

test('all inline game JavaScript parses', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

for (const inRoom of [false, true]) {
  const where = inRoom ? 'gallery' : 'catwalk';
  test(`HECKLE in a ${where}: preacher pursues and congregation flees`, () => {
    const { G, run, scene, voices } = game(inRoom);
    const preacher = scene.members.find(m => m.preach);
    const congregation = scene.members.filter(m => !m.preach);
    run('encChoose(false)');
    assert.equal(G.ents.length, 1);
    const enemy = G.ents[0];
    assert.equal(enemy.type, 'pur');
    assert.equal(enemy.hp, 6);
    assert.equal(enemy.dead, 0);
    assert.equal(enemy.x, preacher.x);
    assert.equal(enemy.y, preacher.y);
    assert.equal(enemy.seed, preacher.seed);
    assert.equal(Boolean(enemy.roaming), !inRoom);
    assert.equal(G.alerted, true);
    assert.deepEqual(scene.members, congregation);
    assert.equal(scene.state, 'talked');
    assert.equal(scene.flee, true);
    assert.equal(voices[0][0], 'scream');
    assert.match(G.note.text, /torch toward you.*congregation runs/i);

    if (!inRoom) G.y = -4; // Alerted preacher must pursue beyond the normal 4.2 range.
    const distance = () => Math.hypot(enemy.x - G.x, enemy.y - G.y);
    const before = distance(), oldX = enemy.x, oldY = enemy.y;
    run('updPur(G.ents[0],0.1)');
    assert.equal(enemy.chasing, true);
    assert.ok(distance() < before, 'Preacher must approach the player');
    assert.ok(Math.hypot(enemy.x - oldX, enemy.y - oldY) <= 0.146,
      'Preacher must not teleport into the last gallery');
    assert.equal(run('walkable(G.ents[0].x,G.ents[0].y,0.35)'), true);

    const initial = congregation.map(m => Math.hypot(m.x - G.x, m.y - G.y));
    run('sceneUpd(G.encOn,0.1)');
    congregation.forEach((m, i) => {
      assert.equal(m.pose, 'flail');
      assert.ok(Math.hypot(m.x - G.x, m.y - G.y) > initial[i]);
    });
    assert.equal(scene.members.includes(preacher), false);

    // Existing torch damage and player attacks remain active in both places.
    G.x = enemy.x - 0.5; G.y = enemy.y; G.ang = 0;
    run('updPur(G.ents[0],0.1)');
    assert.equal(G.health, 93);
    assert.equal(G.hurtCd, 1.2);
    run('doSwing()');
    assert.equal(enemy.hp, 4);
    assert.equal(enemy.hit, 1);
  });

  test(`LISTEN in a ${where} keeps the sermon peaceful`, () => {
    const { G, run, scene } = game(inRoom);
    const members = [...scene.members];
    run('encChoose(true)');
    assert.equal(G.frags, 1);
    assert.equal(G.sanity, 92);
    assert.equal(G.alerted, false);
    assert.equal(G.ents.length, 0);
    assert.deepEqual([...scene.members], members);
    assert.ok(!scene.flee);
  });
}

test('catwalk pursuit slides along railings without leaving the floor', () => {
  const { G, run } = game(false);
  run('encChoose(false)');
  Object.assign(G.ents[0], { x: 23.57, y: 2 });
  G.x = 20; G.y = 4;
  const oldY = G.ents[0].y;
  run('updPur(G.ents[0],0.1)');
  assert.equal(G.ents[0].x, 23.57);
  assert.ok(G.ents[0].y > oldY);
  assert.equal(run('walkable(G.ents[0].x,G.ents[0].y,0.35)'), true);
});

test('ordinary gallery Purifiers retain gallery collision', () => {
  const { G, run } = game(true);
  run('encChoose(false)');
  delete G.ents[0].roaming;
  Object.assign(G.ents[0], { x: 3.95, y: 0 });
  G.x = 6;
  run('updPur(G.ents[0],0.1)');
  assert.ok(G.ents[0].x <= 5 * Math.cos(Math.PI / 6) - 0.35 + 1e-9);
});
