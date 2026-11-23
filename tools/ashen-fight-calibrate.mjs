// Ashen Sphere: recompute FOE_CAL in ashen-sphere.html. For each creature (and each space foe) and each weapon you
// could bring, it finds the skill correction that makes a quick fight come out even when your strength equals its
// danger, so a quick fight's odds are the ones the threat card shows. Bots fight each pairing out hundreds of times,
// through the page's own code. Run it after changing how a creature fights or what it has:
//   node tools/ashen-fight-calibrate.mjs        (about a minute and a half)
// then paste the printed table between the /*CAL*/ marks in FOE_CAL.
import { boot } from '../tests/ashen-harness.mjs';

const { dev } = boot(), F = dev.fight, P = F.PUP, N = +process.env.N || 60;
const YOU = { name: 'YOU', col: '#7fb2ff', hat: 'hard', big: 1 };
const AB0 = ['scare', 'scrap'];   // what a young colony brings: the Greenhouse and the Scav Camp
const WEAPONS = ['box', 'sword', 'gun', 'bow', 'star'];
const FBASE = L => [0.5, 0.5, 1.5, 2.5, 3][Math.max(0, Math.min(4, L | 0))];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function levels(b, c) { let you = b - c, foe = b + c; if (you < 0) { foe -= you; you = 0; } if (foe < 0) { you -= foe; foe = 0; } if (you > 4) { foe -= you - 4; you = 4; } if (foe > 4) { you -= foe - 4; foe = 4; } return { you: clamp(you, 0, 4), foe: clamp(foe, 0, 4) }; }
function win(look, ab, lvl, w0, w1, c, salt) {
  const L = levels(FBASE(lvl), c); let n = 0;
  for (let s = 0; s < N; s++) {
    const g = P.quick({ weapon0: w0, weapon1: w1, seed: (90001 + s * 7919 + salt * 104729) >>> 0, look0: { ...YOU }, look1: { big: 1, ...look }, ctl0: L.you, ctl1: L.foe, needs: [1, 1], ab0: AB0, ab1: ab });
    if (g.over.win === 0) n++;
  }
  return n / N;
}
// a skill correction c (your side c lower, theirs c higher) that evens the fight out, found by halving
function solve(look, ab, lvl, w0, w1, salt) {
  let lo = -2.5, hi = 2.5;
  if (win(look, ab, lvl, w0, w1, lo, salt) < 0.5) return lo;
  if (win(look, ab, lvl, w0, w1, hi, salt) > 0.5) return hi;
  for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (win(look, ab, lvl, w0, w1, m, salt) > 0.5) lo = m; else hi = m; }
  return +(((lo + hi) / 2).toFixed(2));
}
const out = {}, t0 = Date.now(); let salt = 1;
for (const [k, Fo] of Object.entries(F.FOES)) {
  const lvl = (F.THREAT[k] || F.ATHREAT[k]).lvl; out[k] = {};
  for (const w of WEAPONS) out[k][w] = solve(Fo.look, Fo.ab, lvl, w, Fo.wk === 'same' ? w : Fo.wk, salt++);
  console.error(k, JSON.stringify(out[k]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
for (const [k, D] of Object.entries(F.SPACE_FOES)) {
  const look = { name: D.name, col: D.col, hat: D.hat, blind: D.blind, plural: D.plural };
  out['space:' + k] = { [D.weapon]: solve(look, D.ab, D.lvl, D.weapon, D.weapon, salt++) };
}
console.log(JSON.stringify(out));
