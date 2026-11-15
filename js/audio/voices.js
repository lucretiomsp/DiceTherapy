import { mtof } from "./timing.js";

// Strategy: one voice per lane, all with the signature (ac, out, t, m, dur, vel).
// Each builds its own short-lived nodes into `out` and frees them when they end.

function cleanup(src, ...rest) { src.onended = () => { src.disconnect(); rest.forEach(n => n.disconnect()); }; }

function saw(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.03, dur);
  const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.Q.value = 7;
  lp.frequency.setValueAtTime(Math.min(9000, 250 + f * (5 + 9 * vel)), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.6), t + .09 + dur * .5);
  const pk = .5 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .004);
  g.gain.setTargetAtTime(pk * .75, t + .004, .12);
  g.gain.setTargetAtTime(0, end, .012);
  o.connect(lp); lp.connect(g); g.connect(out);
  o.start(t); o.stop(end + .1);
  cleanup(o, lp, g);
}

function square(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.03, dur);
  const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "square"; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(Math.min(9000, f * 8 + 1200 * vel), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 3), t + .25);
  const pk = .17 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .005);
  g.gain.setTargetAtTime(pk * .6, t + .005, .09);
  g.gain.setTargetAtTime(0, end, .02);
  o.connect(lp); lp.connect(g); g.connect(out);
  o.start(t); o.stop(end + .15);
  cleanup(o, lp, g);
}

function tri(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.04, dur);
  const o = c.createOscillator(), g = c.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(f, t);
  const pk = .42 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .008);
  g.gain.setTargetAtTime(pk * .7, t + .008, .25);
  g.gain.setTargetAtTime(0, end, .045);
  if (dur > .22) {                                                  // delayed vibrato on long notes
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.4;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(9, t + Math.min(.3, dur));
    lfo.connect(lg); lg.connect(o.detune);
    lfo.start(t); lfo.stop(end + .3);
    cleanup(lfo, lg);
  }
  o.connect(g); g.connect(out);
  o.start(t); o.stop(end + .3);
  cleanup(o, g);
}

// Two-operator FM bell: a sine carrier whose pitch is shaken by a sine modulator at an inharmonic
// ratio. The carrier keeps the pitch exact (microtones stay in tune); the ratio gives the metal.
// ratio: 3.5 bell, 1.4 gong, 7 glockenspiel, 2 electric piano (not metallic).
export const BELL = {
  ratio: 3.5,
  index: [2, 3],       // modulation depth at the strike, times the frequency: base + per velocity
  indexRest: .3,       // depth it settles to
  brightDecay: .08,    // seconds: how fast the strike mellows
  decay: .35,          // seconds: natural ring-out
  level: .22,
};
function bell(c, out, t, m, dur, vel) {
  const B = BELL, f = mtof(m), end = t + Math.max(.05, dur);
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.frequency.setValueAtTime(f, t);
  mod.frequency.setValueAtTime(f * B.ratio, t);
  mg.gain.setValueAtTime(f * (B.index[0] + B.index[1] * vel), t);
  mg.gain.setTargetAtTime(f * B.indexRest, t, B.brightDecay);
  const pk = B.level * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .002);
  g.gain.setTargetAtTime(0, t + .002, B.decay);
  g.gain.setTargetAtTime(0, end, .06);
  mod.connect(mg); mg.connect(car.frequency);
  car.connect(g); g.connect(out);
  car.start(t); mod.start(t); car.stop(end + .4); mod.stop(end + .4);
  cleanup(car, g); cleanup(mod, mg);
}

// Acid: a saw through a resonant lowpass that snaps shut, harder with velocity (303-ish squelch).
function acid(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.03, dur);
  const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.Q.value = 14;
  lp.frequency.setValueAtTime(Math.min(8000, f * (4 + 14 * vel)), t);
  lp.frequency.setTargetAtTime(Math.max(150, f * 1.2), t, .06 + .08 * vel);
  const pk = .3 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .003);
  g.gain.setTargetAtTime(pk * .7, t + .003, .1);
  g.gain.setTargetAtTime(0, end, .01);
  o.connect(lp); lp.connect(g); g.connect(out);
  o.start(t); o.stop(end + .1);
  cleanup(o, lp, g);
}

// Pluck: a square whose brightness and level both die fast, like a plucked string.
function pluck(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.03, dur);
  const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = "square"; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.Q.value = 2;
  lp.frequency.setValueAtTime(Math.min(10000, f * 12), t);
  lp.frequency.setTargetAtTime(f * 1.5, t, .05);
  const pk = .2 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .002);
  g.gain.setTargetAtTime(0, t + .002, .16);
  g.gain.setTargetAtTime(0, end, .015);
  o.connect(lp); lp.connect(g); g.connect(out);
  o.start(t); o.stop(end + .2);
  cleanup(o, lp, g);
}

// Pad: two saws detuned against each other, darkened, with a slow swell and release.
function pad(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.08, dur);
  const a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  a.type = b.type = "sawtooth";
  a.frequency.setValueAtTime(f, t); b.frequency.setValueAtTime(f, t);
  a.detune.value = -8; b.detune.value = 8;
  lp.type = "lowpass"; lp.Q.value = .7;
  lp.frequency.setValueAtTime(Math.min(6000, 600 + f * 2.5), t);
  const pk = .1 * (.6 + .4 * vel), rise = Math.min(.25, dur * .4);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + rise);
  g.gain.setTargetAtTime(0, end, .15);
  a.connect(lp); b.connect(lp); lp.connect(g); g.connect(out);
  a.start(t); b.start(t); a.stop(end + .8); b.stop(end + .8);
  cleanup(a, lp, g); cleanup(b);
}

// Organ: one oscillator playing drawbar-like harmonics (a PeriodicWave), on/off like a key.
const organWaves = new WeakMap();   // one wave per AudioContext
function organWave(c) {
  if (!organWaves.has(c)) {
    const amps = [0, 1, .8, .55, .4, 0, .25, 0, .18];                 // harmonics 1..8 (index 0 is DC)
    organWaves.set(c, c.createPeriodicWave(new Float32Array(amps), new Float32Array(amps.length)));
  }
  return organWaves.get(c);
}
function organ(c, out, t, m, dur, vel) {
  const f = mtof(m), end = t + Math.max(.03, dur);
  const o = c.createOscillator(), g = c.createGain();
  o.setPeriodicWave(organWave(c)); o.frequency.setValueAtTime(f, t);
  const pk = .11 * (.7 + .3 * vel);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pk, t + .006);
  g.gain.setTargetAtTime(0, end, .025);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(end + .2);
  cleanup(o, g);
}

// in the order of ROLE
export const VOICES = [saw, square, tri, bell, acid, pluck, pad, organ];

// The kick: a pitched sine with a noise click, ducking the synth bus. bus: {kick, synth, noise}
export function kick(c, bus, t, accent) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(165, t);
  o.frequency.exponentialRampToValueAtTime(52, t + .07);
  o.frequency.exponentialRampToValueAtTime(42, t + .35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(accent, t + .002);
  g.gain.setTargetAtTime(0, t + .05, .1);
  o.connect(g); g.connect(bus.kick);
  o.start(t); o.stop(t + .9);
  cleanup(o, g);
  const n = c.createBufferSource(), hp = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = bus.noise; hp.type = "highpass"; hp.frequency.value = 3000; ng.gain.value = .18 * accent;
  n.connect(hp); hp.connect(ng); ng.connect(bus.kick);
  n.start(t);
  cleanup(n, hp, ng);
  const sg = bus.synth.gain;                                        // sidechain-style duck
  sg.cancelScheduledValues(t);
  sg.setTargetAtTime(.5, t, .004);
  sg.setTargetAtTime(1, t + .04, .09);
}
