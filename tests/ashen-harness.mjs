// Shared harness for the Ashen Sphere tests: runs the page script in a Node VM with a tiny stand-in for the browser
// (no canvas output, no network) and exposes the page's own test hooks (window.__ashen.dev).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const page = await readFile(new URL('../ashen-sphere.html', import.meta.url), 'utf8');
const script = page.match(/<script>([\s\S]*)<\/script>/)[1];

export function boot(storage = new Map()) {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = new Proxy({}, {
    get: (o, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad
      : k === 'measureText' ? s => ({ width: String(s).length * 7 })
      : k in o ? o[k] : noop,
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const els = new Map();
  const el = id => {
    if (!els.has(id)) els.set(id, {
      id, hidden: false, innerHTML: '', textContent: '', className: '', dataset: {}, style: {}, width: 0, height: 0,
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      setAttribute: noop, getAttribute: () => null, addEventListener: noop, focus: noop, setPointerCapture: noop,
      querySelectorAll: () => [], querySelector: () => null, closest: () => null, getContext: () => ctx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 420, right: 390, bottom: 420 }),
    });
    return els.get(id);
  };
  let raf = null;
  const sandbox = {
    document: { getElementById: el, activeElement: { dataset: {} }, hidden: false, addEventListener: noop },
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class { observe() {} },
    localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    requestAnimationFrame: f => { raf = f; return 1; },
    setTimeout: () => 0, clearTimeout: noop,
    performance: { now: () => 1000 }, location: { search: '' }, URLSearchParams, devicePixelRatio: 1,
    console, Math, JSON, Date, Map, Set, Array, Object, Number, String, Boolean, Error, Proxy,
    addEventListener: noop, removeEventListener: noop,   // (the fight keys listen on the window)
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  const A = sandbox.__ashen;
  assert.ok(A && A.dev, 'test hooks are exposed');
  return { A, dev: A.dev, storage, els, frame: t => raf && raf(t) };
}

// Put a base at the point the expedition opens up: Lantern-2 repaired, a crewed pad, fuel, storage, people.
export function readyBase(dev) {
  const S = dev.S();
  S.k.ping = S.k.scout = S.k.lantern = true; S.h.secret = true;
  S.hatch = true;
  const T = dev.home();
  // the pad goes on one of the starter tiles; two fuel tanks on free land next to the base
  const pad = [...S.owned].find(i => S.bld[i] !== 'bunker');
  delete S.bld[pad]; S.order = S.order.filter(x => x !== pad);
  S.bld[pad] = 'pad'; S.order.push(pad);
  const free = [...new Set([...S.owned].flatMap(i => T[i].n))].filter(j => !S.owned.has(j) && T[j].b !== 'sea');
  for (const j of free.slice(0, 2)) { S.owned.add(j); S.bld[j] = 'tank'; S.order.push(j); }
  S.ug['0,0'] = { d: 1, room: 'fuel' }; S.order.push('u:0,0');
  for (const c of [1, 2, 3]) { S.ug['0,' + c] = { d: 1, room: 'store' }; S.order.push('u:0,' + c); }
  S.pop = 12; S.k.fuel = 200;
  S.res = { scrap: 900, water: 400, food: 400 };
  dev.run(1);
  S.res = { scrap: 900, water: 400, food: 400 };
  dev.run(0.01);
  return pad;
}
