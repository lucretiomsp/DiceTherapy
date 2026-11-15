import { mod12, near } from "../core/util.js";
import { TUNING } from "../data/tunings.js";
import { cons } from "./consonance.js";
import { ROOTS, spellList } from "./spelling.js";

// The scale context: a scale on a root, with its degrees in semitones, their spelling and the tonic.
// { scale, rootPc, root: {L, acc}, asc: number[], degs: [{s, sp, asc, desc, ai, step}], tonic }
export function buildCtx(scale, rootPc) {
  const T = TUNING[scale.ppo].semis;
  const asc = scale.deg.map(d => T[d]);
  const desc = scale.desc ? scale.desc.map(d => T[d]) : null;
  const major = asc.some(s => Math.abs(s - 4) < .05);
  const cands = ROOTS[rootPc].slice();
  if ((rootPc === 1 || rootPc === 8) && major) cands.reverse();
  const tryMode = strict => {
    let best = null;
    for (const [L, acc] of cands) {
      const root = { L, acc };
      const a = spellList(asc, rootPc, root, scale.ppo, strict);
      const d = desc ? spellList(desc, rootPc, root, scale.ppo, strict) : null;
      let cost = 0;
      for (const sp of d ? a.concat(d) : a) cost += Math.abs(sp.acc) + (Math.abs(sp.acc) > 1.5 ? 100 : 0);
      if (!best || cost < best.cost - 1e-9) best = { root, a, d, cost };
    }
    return best;
  };
  let sp = asc.length === 7 ? tryMode(true) : null;
  if (!sp || sp.cost >= 100) sp = tryMode(false);
  const degs = asc.map((s, i) => ({ s, sp: sp.a[i], asc: true, desc: !desc || desc.some(x => near(x, s)), ai: i, step: scale.deg[i] }));
  if (desc) desc.forEach((s, i) => {
    if (!asc.some(x => near(x, s))) degs.push({ s, sp: sp.d[i], asc: false, desc: true, ai: -1, step: scale.desc[i] });
  });
  // Partch otonalities: degree 0 can be a high harmonic, so centre on the degree most
  // consonant with the others (the fundamental of the series).
  let tonic = 0;
  if (scale.ppo === 43) {
    let best = -1;
    asc.forEach((s, j) => {
      let sum = 0, b3 = 0, b5 = 0;
      asc.forEach((x, k) => {
        if (k === j) return;
        const iv = mod12(x - s), c = cons(iv);
        sum += c;
        if (iv > 2.6 && iv < 4.6) b3 = Math.max(b3, c);
        if (iv > 5.9 && iv < 8.1) b5 = Math.max(b5, c);
      });
      if (sum + b3 + b5 > best + 1e-9) { best = sum + b3 + b5; tonic = j; }
    });
  }
  return { scale, rootPc, root: sp.root, asc, degs, tonic };
}
