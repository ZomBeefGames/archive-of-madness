// Ashen Sphere: zoom and move around the cutaways (the bunker below, and the cave bunkers). The + and − buttons, a
// pinch or Ctrl-wheel zoom up to 3x about a point; a drag moves around; ⌂ shows the whole thing again; a tap still picks
// the cell under the finger, wherever the view is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, readyBase } from './ashen-harness.mjs';

function below() { const b = boot(); readyBase(b.dev); const S = b.dev.S(); S.pop = Math.max(S.pop, 14); b.dev.setView('below'); b.dev.draw(); return { ...b, S }; }

test('the bunker cutaway zooms about a point and keeps what was under it in place, and a tap still finds its cell', () => {
  const B = below(), { dev } = B, Z = dev.zoomx, W = Z.W(), H = Z.H();
  assert.equal(Z.btn('z-in'), false, '+ shows below'); assert.equal(Z.btn('z-out'), true, 'nothing to zoom out to at 1x'); assert.equal(Z.btn('home'), true);
  const sx = W * .5, sy = H * .45, cell0 = Z.gr(); Z.tap(sx, sy); const at0 = dev.panel(); assert.match(at0, /Row \d+/, 'a cell is picked');
  Z.click('z-in'); B.frame(5000); B.frame(5400); assert.equal(Z.btn('z-out'), false, 'zoomed in: − and ⌂ show'); assert.equal(Z.btn('home'), false);
  dev.draw(); const cam = Z.cam('below'); assert.ok(Math.abs(cam.z - 1.4) < 1e-9, 'one step in'); assert.equal(Z.gr().k, 1, 'drawn sharp at the new size');
  assert.ok(Math.abs(Z.gr().cw - cell0.cw * 1.4) < 1e-6, 'cells are bigger');
  assert.equal(Z.W(), W, 'the screen width is back after drawing');
  Z.tap(sx, sy); assert.equal(dev.panel(), at0, 'the same cell is still under the middle of the screen');
  // drag right: what's left of it comes under the finger
  Z.pan(Z.gr().cw * 2, 0); dev.draw(); Z.tap(sx, sy); assert.notEqual(dev.panel(), at0, 'moved: another cell under the finger');
});

test('zoom stops at 1x and 3x, the view never leaves the picture, and ⌂ shows all of it again', () => {
  const { dev } = below(), Z = dev.zoomx;
  for (let n = 0; n < 9; n++) Z.click('z-in'); dev.draw(); assert.equal(Z.cam('below').z, 3, 'at most 3x');
  Z.pan(-1e6, -1e6); dev.draw(); const c = Z.cam('below'), W = Z.W(), H = Z.H();
  assert.ok(c.ox <= W * 3 - W + 1e-6 && c.ox >= 0, 'not past the right edge'); assert.ok(c.oy >= 0);
  Z.pan(1e6, 1e6); dev.draw(); assert.equal(c.ox, 0); assert.equal(c.oy, 0);
  for (let n = 0; n < 9; n++) Z.click('z-out'); dev.draw(); assert.equal(c.z, 1, 'at least 1x');
  Z.click('z-in'); Z.pan(-200, -200); Z.click('home'); dev.draw(); assert.equal(c.z, 1); assert.equal(c.ox, 0); assert.equal(c.oy, 0);
  Z.key('+'); assert.ok(c.z > 1, 'the + key zooms too'); Z.key('-'); assert.equal(c.z, 1);
  assert.doesNotThrow(() => { for (const z of [1, 1.7, 2.4, 3]) { c.z = z; c.rz = 1; dev.draw() } }, 'draws stretched mid-pinch, at any zoom');
});

test('the cave bunker zooms and moves the same way, and its taps follow', () => {
  const b = boot(); readyBase(b.dev); const { dev } = b, S = dev.S(), T = dev.home(); S.res = { scrap: 3000, water: 900, food: 900 }; S.pop = 16; dev.run(0.01);
  const i = T.findIndex((t, j) => t.b !== 'sea' && !t.pent && !S.owned.has(j) && S.bld[j] !== 'bunker' && dev.genMap(j).pois.some(p => p.type === 'cave'));
  S.owned.add(i); S.seen.add(i); dev.setView('surface'); dev.sel(i); dev.act('walk'); const ms = dev.mapState(); ms.rev = '1'.repeat(ms.rev.length); dev.act('leave');
  dev.setView('surface'); dev.cave.found(i); assert.equal(dev.view(), 'cave'); dev.draw();
  const Z = dev.zoomx, W = Z.W(), H = Z.H(); assert.equal(Z.btn('z-in'), false);
  const g0 = Z.grc(); Z.tap(W * .5, g0.gy + g0.ch * 1.5); const p0 = dev.panel();
  Z.click('z-in'); dev.draw(); assert.ok(Math.abs(Z.grc().cw - g0.cw * 1.4) < 1e-6);
  Z.tap(W * .5, (g0.gy + g0.ch * 1.5) * 1.4 - Z.cam('cave').oy); assert.equal(dev.panel(), p0, 'the same chamber');
  assert.equal(Z.W(), W); dev.setView('surface'); assert.equal(Z.btn('z-in'), false, 'the globe keeps its buttons');
});
