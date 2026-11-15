import { pick, rand } from "../core/util.js";
import { WORLD } from "../data/rhythms.js";
import { MAXL } from "./timeline.js";

const tile = (pat, N) => Array.from({ length: N }, (_, i) => pat[i % pat.length]);
const count = g => g.reduce((a, b) => a + b, 0);

// Gates are made for all MAXL steps; at least two hits must fall inside the lane length L.
// A world rhythm is tiled, so the first L steps are exactly Coypu's `L name`.
// pRandom: chance of a random rhythm; used: world rhythm names other lanes already have.
export function makeRhythm(L, pRandom, used) {
  if (Math.random() >= pRandom) {
    const fits = w => count(tile(w.pat, L)) >= 2;
    const fresh = WORLD.filter(w => !used.has(w.name) && fits(w));
    const w = pick(fresh.length ? fresh : WORLD.filter(fits));
    if (w) {
      used.add(w.name);
      return { gates: tile(w.pat, MAXL), src: { kind: "world", name: w.name, origin: w.origin } };
    }
  }
  const prob = Math.round(rand(15, 70));
  let g, tries = 0;
  do { g = Array.from({ length: MAXL }, () => (Math.random() < prob / 100 ? 1 : 0)); } while (count(g.slice(0, L)) < 2 && ++tries < 40);
  if (count(g.slice(0, L)) < 2) { g[0] = 1; g[Math.floor(L / 2)] = 1; }
  return { gates: g, src: { kind: "random", prob } };
}
