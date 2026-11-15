import { clamp, rand } from "../core/util.js";

// The synth lanes. Index k is used everywhere: track k, voice k, MIDI_CH[k], colour var(--key).
// Lanes are generated in this order, so a lane can only listen to lanes before it.
//
// role: "bass" anchors bars on the chord root and prefers octaves and fifths; "mid" tolerates
//   repeated notes; every other role moves like a melody (steps, leap recovery).
// tag: the short register text on the lane.
// fit: the lanes this one must sound good against, [lane, strength, avoidUnison]. Lane 0 is
//   heard as held (the bass carries under everything), the others where their notes start.
// hold: notes usually last until the next one, up to this many steps; maxDur, longP: occasional
// long notes, likelier on strong beats; shortP: chance of a single step; gf: gate range (gateTimes)
export const ROLE = [
  { key: "saw", name: "Saw", role: "bass", tag: "bass", lo: 24, hi: 48, spread: 10, tau: 1.45, hold: 2, maxDur: 4, longP: .15, shortP: .35, gf: [.55, .9],
    fit: [] },
  { key: "square", name: "Square", role: "mid", tag: "mid", lo: 48, hi: 70, center: 59, spread: 7, tau: 1.2, hold: 2, maxDur: 4, longP: .2, shortP: .3, gf: [.45, .85],
    fit: [[0, 1.3]] },
  { key: "tri", name: "Tri", role: "lead", tag: "lead", lo: 62, hi: 86, center: 73, spread: 8, tau: 1.15, hold: 3, maxDur: 8, longP: .35, shortP: .15, gf: [.6, .95],
    fit: [[0, 1.3], [1, 1.1, true]] },
  // a sparkle line above the lead: short gates, the bell's own decay gives it length
  { key: "bell", name: "Bell", role: "bell", tag: "sparkle", lo: 72, hi: 96, center: 84, spread: 7, tau: 1.3, hold: 1, maxDur: 6, longP: .25, shortP: .5, gf: [.3, .7],
    fit: [[0, 1.3], [1, .8], [2, 1.1, true]] },
  // a squelchy line just above the bass: short, busy, off the bass's notes
  { key: "acid", name: "Acid", role: "acid", tag: "low line", lo: 36, hi: 60, center: 47, spread: 7, tau: 1.3, hold: 1, maxDur: 3, longP: .1, shortP: .6, gf: [.35, .7],
    fit: [[0, 1.3, true]] },
  // staccato figures in the middle, kept off the square and the acid
  { key: "pluck", name: "Pluck", role: "pluck", tag: "figures", lo: 55, hi: 79, center: 67, spread: 7, tau: 1.25, hold: 1, maxDur: 3, longP: .1, shortP: .6, gf: [.3, .6],
    fit: [[0, 1.3], [1, 1, true], [4, .8, true]] },
  // long, soft notes: the harmony's glue
  { key: "pad", name: "Pad", role: "pad", tag: "sustain", lo: 50, hi: 74, center: 62, spread: 6, tau: 1.2, hold: 6, maxDur: 12, longP: .5, shortP: .05, gf: [.85, 1],
    fit: [[0, 1.3], [1, 1.1, true]] },
  // a counter-line between square and tri
  { key: "organ", name: "Organ", role: "organ", tag: "counter", lo: 60, hi: 84, center: 71, spread: 7, tau: 1.2, hold: 2, maxDur: 6, longP: .3, shortP: .25, gf: [.6, .95],
    fit: [[0, 1.3], [1, .9], [2, 1.1, true], [6, .9, true]] },
];
// Metric weight of each 16th in a bar
export const BEAT = [1, .2, .45, .25, .75, .2, .45, .25, .9, .2, .45, .25, .75, .2, .45, .25];
export const roundGate = x => clamp(Math.round(x * 20) / 20, .25, 1);
export const randGate = R => roundGate(rand(R.gf[0], R.gf[1]));
export function genDur(R, step, gap) {
  const cap = Math.min(gap, R.maxDur);
  let d = Math.min(gap, R.hold);
  if (cap > d && Math.random() < R.longP * (.4 + BEAT[step % 16])) d += 1 + Math.floor(Math.random() * (cap - d));
  else if (d > 1 && Math.random() < R.shortP) d = 1;
  return d;
}
