import { mod12 } from "../core/util.js";

// Consonance of an interval (semitones, any tuning): peaks at just ratios and
// their 12/24-TET neighbours, Gaussian falloff (sigma 0.15 semitone).
const ANCHORS = [
  [0, 1], [7.02, .92], [7, .92], [3.86, .8], [4, .8], [3.16, .78], [3, .78],
  [8.84, .66], [9, .66], [4.98, .62], [5, .62], [3.47, .6], [3.5, .6], [8.14, .58], [8, .58],
  [9.69, .5], [8.53, .45], [8.5, .45], [10, .45], [2.67, .42], [10.18, .42], [9.96, .42],
  [2.04, .4], [2, .4], [4.35, .4], [1.82, .36], [9.5, .34], [10.49, .32], [10.5, .32],
  [5.51, .3], [2.5, .3], [4.5, .28], [10.88, .28], [11, .28], [7.5, .26], [1.51, .25], [1.5, .25],
  [5.83, .25], [5.5, .24], [6.17, .22], [6.49, .2], [6.5, .2], [6, .18], [11.5, .16],
  [1.12, .12], [1, .12], [.5, .1],
];
const consMemo = new Map();   // polymetric lanes ask for the same intervals many times

export function cons(iv) {
  const x = mod12(iv), key = Math.round(x * 1e4);
  const hit = consMemo.get(key);
  if (hit !== undefined) return hit;
  let best = .05;
  for (const [a, w] of ANCHORS) {
    let d = Math.abs(x - a);
    if (d > 6) d = 12 - d;
    if (d > .5) continue;
    const v = w * Math.exp(-d * d * 44.4);
    if (v > best) best = v;
  }
  consMemo.set(key, best);
  return best;
}
