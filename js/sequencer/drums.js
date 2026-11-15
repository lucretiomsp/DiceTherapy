import { clamp, rand } from "../core/util.js";
import { makeRhythm } from "./rhythm.js";
import { MAXL } from "./timeline.js";

// The drum lanes. Every hit is the same note (DRUM_NOTE); the dice only decide the rhythm.
//
// feel: how likely a hit is on each 16th of a bar (0..1), the instrument's habits:
//   kick on the downbeats, snare and clap on the backbeat, hats on the 8ths, and so on.
// density: the dice pick a scale for the feel in this range, from sparse to busy.
// accent: how much the feel also shapes velocity (strong positions hit harder).
// gf: gate range (how much of a step the hit lasts, mostly for the open hat and MIDI).
export const DRUM_NOTE = 48;   // C3 (this app counts C4 = MIDI 60)
const NOTE = { m: DRUM_NOTE, d: null };

//                 1    e    &    a    2    e    &    a    3    e    &    a    4    e    &    a
const FEEL = {
  kick:       [  1,   0,  .1, .15,  .5,   0,  .2, .1,  .9,   0,  .35, .1,  .5,  .05, .2,  .15],
  snare:      [  0,   0,  .05,  0,  .95, .05, .05, .15,  0,  .1,  .05, .05, .95,  .1, .15, .25],
  tom:        [  0,   0,   0,  .05,  0,   0,  .1,  .1,   0,  .05, .1,  .15, .2,  .4,  .45, .5],
  rim:        [ .1,   0,   0,  .6,   0,  .15, .5,   0,   0,  .2,  .6,   0,  .1,  .5,   0,  .2],
  clap:       [  0,   0,   0,   0,  .7,   0,   0,  .05,  0,   0,   0,  .1,  .95,  0,  .05, .15],
  closedHats: [ .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .35],
  openHats:   [  0,   0,  .8,   0,   0,   0,  .8,   0,   0,   0,  .8,   0,   0,   0,  .8,  .1],
  rides:      [ .9,   0,  .45,  0,  .9,   0,  .45,  .1, .9,   0,  .45,  0,  .9,   0,  .45, .1],
};

export const DRUMS = [
  { key: "kick", name: "Kick", tag: "low drum", density: [.75, 1.15], accent: .5, hold: 1, maxDur: 1, longP: 0, shortP: 0, gf: [.5, .8] },
  { key: "snare", name: "Snare", tag: "backbeat", density: [.8, 1.1], accent: .6, hold: 1, maxDur: 1, longP: 0, shortP: 0, gf: [.5, .8] },
  { key: "tom", name: "Tom", tag: "fills", density: [.4, 1], accent: .4, hold: 1, maxDur: 2, longP: .2, shortP: 0, gf: [.5, .9] },
  { key: "rim", name: "Rim", tag: "syncopation", density: [.5, 1], accent: .3, hold: 1, maxDur: 1, longP: 0, shortP: 0, gf: [.3, .6] },
  { key: "clap", name: "Clap", tag: "backbeat", density: [.6, 1], accent: .5, hold: 1, maxDur: 1, longP: 0, shortP: 0, gf: [.5, .8] },
  { key: "closedHats", name: "Closed Hats", tag: "8ths and 16ths", density: [.5, 1.1], accent: .45, hold: 1, maxDur: 1, longP: 0, shortP: 0, gf: [.3, .6] },
  { key: "openHats", name: "Open Hats", tag: "off-beats", density: [.45, 1], accent: .3, hold: 2, maxDur: 2, longP: .3, shortP: .5, gf: [.5, .9] },
  { key: "rides", name: "Rides", tag: "pulse", density: [.6, 1.1], accent: .4, hold: 2, maxDur: 4, longP: .3, shortP: .4, gf: [.6, 1] },
].map(D => ({ ...D, kind: "drum", feel: FEEL[D.key] }));

export const drumNote = () => NOTE;
export const drumVel = (D, i) => clamp(.6 + D.accent * D.feel[i % 16] + rand(-.05, .05), .35, 1);

// 1 in 4 rolls a drum lane like a melody lane (world rhythm or random, by the Rhythm source
// slider); otherwise it follows the instrument's feel.
const FEEL_SHARE = .75;

// Gates for all MAXL steps. A feel pattern is one bar repeated, with a fresh last beat on every
// 4th bar as a small fill. At least one hit falls inside the lane length L.
export function makeDrumRhythm(D, L, pRandom, used) {
  if (Math.random() >= FEEL_SHARE) return makeRhythm(L, pRandom, used);
  const dens = rand(D.density[0], D.density[1]);
  const hit = i => (Math.random() < clamp(D.feel[i % 16] * dens, 0, 1) ? 1 : 0);
  const bar = Array.from({ length: 16 }, (_, i) => hit(i));
  const fill = Array.from({ length: 4 }, (_, j) => hit(12 + j));
  const gates = Array.from({ length: MAXL }, (_, i) => (Math.floor(i / 16) % 4 === 3 && i % 16 >= 12 ? fill[i % 16 - 12] : bar[i % 16]));
  if (!gates.slice(0, L).some(Boolean)) {                            // never an empty lane: its strongest step
    const best = D.feel.indexOf(Math.max(...D.feel));
    for (let i = best % L; i < MAXL; i += 16) gates[i] = 1;
  }
  return { gates, src: { kind: "drum", name: D.key, density: Math.round(dens * 100) } };
}
