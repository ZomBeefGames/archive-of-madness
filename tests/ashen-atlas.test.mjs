// Ashen Sphere, the Library atlas: every book in the Archives' Library of Babel charts one star system.
// The book's address is the seed, so these tests check three promises: it is the same book as in the Archives (same
// letters on the same page), the same address always gives the same system (some systems are pinned below), and
// reading the atlas never changes your own world or your save.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { boot, readyBase } from './ashen-harness.mjs';

const HOME = '0,0,0,1,1,1';
const str = a => [a.i, a.j, a.f, a.w, a.s, a.b].join(',');
const randCode = r => Array.from({ length: 12 }, () => Math.floor(r() * 16));
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the Archives' own page maker, lifted out of index.html and run as it is
async function archivesPageMaker() {
  const src = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const line = re => { const m = src.match(re); assert.ok(m, 'index.html still has ' + re); return m[0]; };
  const start = src.indexOf('function makePage(');
  assert.ok(start > 0, 'index.html still has makePage');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 2);
  const code = [line(/^function hashStr\(s\)\{.*\}$/m), line(/^function prng\(seed\)\{.*\}$/m), line(/^const ALPHA=.*;$/m), line(/^const SENTENCES=\[.*\];$/m), body,
    'this.makePage=makePage;this.hashStr=hashStr;this.prng=prng;this.SENTENCES=SENTENCES;'].join('\n');
  const box = { G: { q: 0 }, isMyBook: () => false };
  vm.createContext(box); vm.runInContext(code, box);
  return box;
}

test('the same book as the Archives: same letters, same sentence, same hash', async () => {
  const AR = await archivesPageMaker();
  const { dev } = boot(), X = dev.atlas;
  assert.equal(X.hash('0,0.0|1|1|1|1'), AR.hashStr('0,0.0|1|1|1|1'));
  const r = seeded(77);
  let sentences = 0;
  for (let n = 0; n < 400; n++) {
    const a = { i: Math.floor(r() * 41) - 20, j: Math.floor(r() * 41) - 20, f: Math.floor(r() * 21) - 10, w: [1, 2, 4, 5][n % 4], s: 1 + Math.floor(r() * 5), b: 1 + Math.floor(r() * 32) };
    const pg = n % 5 ? 1 : 1 + Math.floor(r() * 410);
    const mine = X.page(a, pg), theirs = AR.makePage(a.i + ',' + a.j, a.f, a.w, a.s, a.b, pg, 'nobody');
    assert.equal(mine.key, theirs.key);
    assert.equal(mine.text, theirs.chars.join(''), 'page ' + pg + ' of ' + theirs.key);
    assert.equal(!!mine.sent, theirs.kind === 'sentence');
    if (mine.sent) { sentences++; assert.equal(mine.at, theirs.at); }
  }
  assert.ok(sentences > 5, 'some of those pages carry one of the Archives\' sentences: ' + sentences);
});

test('twelve glyphs: home is twelve Suns, every code opens a book, and back again', () => {
  const { dev } = boot(), X = dev.atlas;
  const home = X.code({ i: 0, j: 0, f: 0, w: 1, s: 1, b: 1 });
  assert.equal(home.join(''), '000000000000');
  assert.equal(X.code({ i: 0, j: 0, f: 0, w: 1, s: 1, b: 2 }).join(''), '000000000001', 'the next book along is eleven Suns and a Seam');
  assert.equal(str(X.fromCode(home)), HOME);
  const r = seeded(5);
  for (let n = 0; n < 4000; n++) {
    const d = randCode(r), a = X.fromCode(d);
    assert.ok(a && [1, 2, 4, 5].includes(a.w) && a.s >= 1 && a.s <= 5 && a.b >= 1 && a.b <= 32, 'code ' + d.join('') + ' opens a real book');
    assert.ok(Math.abs(a.i) <= 8192 && Math.abs(a.j) <= 8192 && Math.abs(a.f) <= 819);
    assert.equal(X.code(a).join(), d.join(), 'and that book gives the same code back');
  }
  for (const a of [{ i: 8191, j: -8192, f: 0, w: 5, s: 5, b: 32 }, { i: -8192, j: 8191, f: -819, w: 1, s: 1, b: 1 }, { i: 77, j: -3, f: 400, w: 4, s: 3, b: 9 }])
    assert.equal(str(X.fromCode(X.code(a))), str(a));
  assert.equal(X.code({ i: 9000, j: 0, f: 0, w: 1, s: 1, b: 1 }), null, 'far out books have no gate address');
  assert.equal(X.code({ i: 0, j: 0, f: 900, w: 1, s: 1, b: 1 }), null);
  assert.equal(X.fromCode([1, 2, 3]), null);
  assert.equal(X.fromCode(Array(12).fill(16)), null);
});

test('same address, same system, and these ones stay as they are', () => {
  const a = boot().dev.atlas, b = boot().dev.atlas;
  const sum = (X, s) => { const C = X.chart(s); return [C.star.name + '/' + C.star.kind, C.galaxy.name, C.worlds.map(w => w.name + '/' + w.kind).join(' '), C.code ? C.code.map(x => x.toString(16)).join('') : null, !!C.page.sent].join(' | '); };
  // pinned: if one of these changes, every address players have shared changes too. Do it on purpose or not at all.
  const PIN = {
    '0,0,0,1,1,2': 'Wule/blue | the Ezehui Drift | Enip/sulfur Keca/glass | 000000000001 | false',
    '3,-2,7,4,2,17': 'Heto/amber | the Iafu Embers | Usoumo/cinder Delia/dust Pato/dust | 011801dffc70 | false',
    '-100,55,-3,5,5,32': 'Ocini/ember | the Afaki Wheel | Ommag/cinder Iepimo/giant | ff87c1808bff | false',
    '0,0,0,1,1,11': 'Qilgoz/white | the Ezehui Drift | Ouloip/sulfur Meoz/garden Upeo/mire Usou/sea Itti/ice | 00000000000a | true',
  };
  for (const [s, want] of Object.entries(PIN)) {
    assert.equal(sum(a, s), want, s);
    assert.equal(sum(b, s), want, 'a second game reads the same system for ' + s);
  }
  const speaking = a.chart('0,0,0,1,1,11');
  assert.equal(speaking.page.sent, 'you were sampled, not chosen.', 'book 11 by the home shelf carries a sentence from the Archives');
  assert.equal(speaking.worlds.filter(w => w.beacon).length, 1, 'and one of its worlds has a beacon repeating it');
  // the whole chart, not just the summary, is the same in both games
  const strip = C => JSON.stringify({ ...C, page: C.page.key, galaxy: C.galaxy.name });
  for (const s of ['12,-7,3,2,4,30', '-5,5,-5,5,5,5', '400,-300,77,1,3,8']) assert.equal(strip(a.chart(s)), strip(b.chart(s)));
});

test('an endless variety: every kind of sun and world turns up, with sayable names', () => {
  const { dev } = boot(), X = dev.atlas;
  const r = seeded(2026), stars = {}, kinds = {}, counts = {}, names = new Set();
  let sent = 0, people = 0, spires = 0, systems = 1500, worlds = 0;
  for (let n = 0; n < systems; n++) {
    const C = X.chart(str(X.fromCode(randCode(r))));
    stars[C.star.kind] = (stars[C.star.kind] || 0) + 1; counts[C.worlds.length] = 1; names.add(C.star.name);
    if (C.page.sent) sent++;
    assert.ok(X.nameOk(C.star.name.toLowerCase()), 'star name ' + C.star.name);
    for (const w of C.worlds) {
      worlds++; kinds[w.kind] = 1; if (w.people) people++; if (w.spire) spires++;
      assert.ok(w.name && w.name.length >= 4, 'every world has a name');
      assert.ok(X.WKIND[w.kind], w.kind);
      assert.ok(w.col.every(v => v >= 0 && v <= 255));
      if (w.kind === 'giant') assert.ok(!w.ruins && !w.caves && !w.spire && !w.people, 'nothing stands on a gas giant');
    }
  }
  assert.deepEqual(Object.keys(stars).sort(), Object.keys(X.SKIND).sort(), 'every kind of sun: ' + JSON.stringify(stars));
  assert.deepEqual(Object.keys(kinds).sort(), Object.keys(X.WKIND).sort(), 'every kind of world');
  assert.deepEqual(Object.keys(counts).map(Number).sort(), [1, 2, 3, 4, 5, 6, 7], 'one to seven worlds');
  assert.ok(names.size > systems * 0.95, 'names hardly repeat: ' + names.size);
  assert.ok(sent > systems * 0.03 && sent < systems * 0.09, 'about one book in nineteen speaks: ' + sent);
  assert.ok(people > 0 && people < worlds * 0.05, 'lights on a night side are rare: ' + people);
  assert.ok(spires > 0 && spires < worlds * 0.1, 'Spires are rare: ' + spires);
  // galaxies: one per floor, each with a name and a shape
  const shapes = new Set();
  for (let f = -40; f <= 40; f++) { const G = X.galaxy(f); shapes.add(G.shape); assert.match(G.name, /^the [A-Z][a-z]{3,6} (Wheel|Bar|Lantern|Ring|Drift|Embers)$/); }
  assert.ok(shapes.size >= 5, 'galaxies come in many shapes');
});

test('the home book charts your own sun, and looking around the Library never changes your world', () => {
  const plain = boot(), seen = boot();
  const X = seen.dev.atlas, C = X.chart(HOME);
  assert.ok(C.home);
  assert.equal(C.worlds.map(w => w.name).join(' | '), 'Cinderfall | the Ashen World | Mirewater | Glasswind');
  assert.equal(X.tiles(C.worlds[1]), seen.dev.home(), 'the Ashen World is your world');
  assert.equal(X.tiles(C.worlds[2]), seen.dev.away('mire'), 'Mirewater is the Mirewater the crew lands on');
  // other worlds get their own land from their own seed
  const r = seeded(9), A = [];
  for (let n = 0; n < 30; n++) { const S2 = X.chart(str(X.fromCode(randCode(r)))); for (const w of S2.worlds) A.push(X.tiles(w)); }
  for (const tiles of A) { assert.equal(tiles.length, 642); assert.ok(tiles.every(t => t.base.every(v => v >= 0 && v <= 255))); }
  const distinct = new Set(A.map(t => t.slice(0, 40).map(x => x.base.map(v => v | 0).join(',')).join(';')));
  assert.ok(distinct.size > A.length * 0.9, 'worlds look different from each other');
  // after all that, a tile map at home is still exactly what it would have been
  const T = seen.dev.home();
  for (const i of [3, 41, 207, 400, 611]) {
    if (T[i].b === 'sea') continue;
    assert.equal(JSON.stringify(seen.dev.genMap(i)), JSON.stringify(plain.dev.genMap(i)), 'tile ' + i + ' at home is unchanged');
  }
});

test('the atlas on the system map: flip, pick, dial, bookmark, close', () => {
  const { dev, els, frame } = boot();
  const S = () => dev.S(), X = dev.atlas;
  readyBase(dev);
  dev.act('sys');   // the ✦ button
  assert.equal(dev.view(), 'stars');
  assert.match(dev.panel(), /Open the Library atlas/);
  dev.act('atl:open');
  assert.ok(X.ui().open);
  let html = dev.panel();
  assert.match(html, /Library atlas · the /);
  assert.match(html, /This book charts your own sun/);
  assert.match(html, /Hex 0,0 · floor 0 · wall 1 · shelf 1 · book 1/);
  assert.match(html, /Code 0000·0000·0000/);
  assert.equal((html.match(/class="gly dim"/g) || []).length, 12, 'no glyphs known yet, so all twelve are dim');
  frame(3000); frame(3100);   // draw it
  assert.match(els.get('legend').textContent, /^Library atlas · The Ashen sun/);

  // flip through books; the drawer keeps its place
  dev.act('atl:b+'); assert.equal(S().atlas.at, '0,0,0,1,1,2');
  assert.match(dev.panel(), /Wule/);
  dev.act('atl:b-'); dev.act('atl:b-');
  assert.equal(S().atlas.at, '-1,0,0,5,5,32', 'flipping back from the first book goes to the last book of the hex before');
  dev.act('atl:b+'); assert.equal(S().atlas.at, HOME, 'and forward again across the hex');
  for (let n = 0; n < 32; n++) dev.act('atl:b+');
  assert.equal(S().atlas.at, '0,0,0,1,2,1', 'thirty-two books on, the next shelf');
  dev.act('atl:s-'); dev.act('atl:w'); dev.act('atl:i+'); dev.act('atl:j-'); dev.act('atl:f+');
  assert.equal(S().atlas.at, '1,-1,1,2,1,1');
  assert.match(dev.panel(), /Hex 1,-1 · floor 1 · wall 2 · shelf 1 · book 1/);
  frame(3200);

  // pick a world: its details show, and it is drawn close up
  const C = X.chart(S().atlas.at), k = C.worlds.length - 1;
  dev.act('atl:pick:' + k);
  assert.equal(X.ui().w, k);
  assert.match(dev.panel(), new RegExp('<div class="tile-h">' + C.worlds[k].name + '</div>'));
  frame(3300);

  // bookmark it, wander off, come back from the list
  dev.act('atl:mark');
  assert.deepEqual([...S().atlas.marks], ['1,-1,1,2,1,1']);
  assert.match(dev.panel(), /Bookmarked ★/);
  dev.act('atl:home');
  assert.equal(S().atlas.at, HOME);
  assert.match(dev.panel(), /★ /);
  dev.act('atl:go:0');
  assert.equal(S().atlas.at, '1,-1,1,2,1,1');

  // dial an address: twelve glyphs, one at a time
  dev.act('atl:dial');
  assert.match(dev.panel(), /Twelve glyphs/);
  for (let n = 0; n < 10; n++) dev.act('atl:g:0');
  dev.act('atl:g:3'); dev.act('atl:g:back'); dev.act('atl:g:0');
  assert.equal(X.ui().dial.length, 11);
  dev.act('atl:g:10');
  assert.equal(X.ui().dial, null, 'twelve glyphs open the book');
  assert.equal(S().atlas.at, '0,0,0,1,1,11', 'eleven Suns and a Star (A) is book 11 on the home shelf');
  assert.match(dev.panel(), /This book speaks/);
  dev.act('atl:dial'); dev.act('atl:g:cancel');
  assert.equal(X.ui().dial, null);
  dev.act('atl:rand');
  assert.ok(X.chart(S().atlas.at), 'a random book is a real book');

  // known glyphs light up
  S().glyphs = 1; dev.act('atl:home');
  assert.equal((dev.panel().match(/class="gly dim"/g) || []).length, 0, 'knowing the Sun is enough to read the home address');
  assert.match(dev.panel(), /you know every glyph in it/);

  // arrow keys are wired, and closing goes back to the Ashen system
  dev.act('atl:close');
  assert.ok(!X.ui().open);
  assert.match(dev.panel(), /The Ashen system/);
  dev.act('atl:open'); dev.setView('surface');
  assert.ok(!X.ui().open, 'leaving the system map closes the atlas');
});

test('saves keep the atlas; old saves and bad data load with the home book', () => {
  const g = boot(), S = g.dev.S();
  readyBase(g.dev);
  g.dev.setView('stars'); g.dev.act('atl:open'); g.dev.act('atl:b+'); g.dev.act('atl:mark'); g.dev.act('atl:f-');
  const saved = JSON.parse(JSON.stringify(g.dev.ser()));
  const back = g.dev.deser(saved);
  assert.equal(back.atlas.at, '0,0,-1,1,1,2');
  assert.deepEqual([...back.atlas.marks], ['0,0,0,1,1,2']);
  // a slice-2 save (version 9, no atlas) loads at the home book
  const old = JSON.parse(JSON.stringify(saved)); delete old.atlas;
  const storage = new Map([['ashen-sphere-v9', JSON.stringify(old)]]);
  const g2 = boot(storage);
  assert.equal(g2.dev.S().atlas.at, HOME);
  assert.deepEqual([...g2.dev.S().atlas.marks], []);
  assert.equal(g2.dev.S().pop, S.pop, 'and the rest of the save is there');
  // garbage in, home book out
  const fix = g.dev.atlas.fix;
  assert.deepEqual(JSON.parse(JSON.stringify(fix({ at: 'x', marks: ['1,1,1,3,1,1', '2,2,2,2,2,2', '2,2,2,2,2,2', 5] }))), { at: HOME, marks: ['2,2,2,2,2,2'] });
  assert.deepEqual(JSON.parse(JSON.stringify(fix(null))), { at: HOME, marks: [] });
  assert.equal(fix({ at: ' 1,-0,2,4,5,6', marks: [] }).at, '1,0,2,4,5,6', 'addresses are stored one way only');
});

test('the system map buttons work again: look at the Ashen World, go to the crew', () => {
  const { dev } = boot();
  const S = () => dev.S();
  const pad = readyBase(dev);
  dev.setView('stars');
  dev.act('view:home');
  assert.equal(dev.view(), 'surface', '"Look at the Ashen World" goes to the planet');
  // fly a crew to Mirewater orbit, then use the button on the system map
  dev.sel(pad);
  const crewIds = S().people.slice(0, 2).map(p => p.id);
  S().k.crew = []; S().k.crewTouched = true;
  for (const id of crewIds) dev.act('xc:' + id);
  dev.act('xr:+'); dev.sel(pad); dev.act('xlaunch');
  dev.run(21); dev.run(31);
  assert.equal(S().x.phase, 'orbit');
  dev.setView('stars'); dev.act('view:away');
  assert.equal(dev.view(), 'away', '"Choose a landing site" goes to the world below the ship');
});
