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

// in the order of ROLE: Saw, Square, Tri, Bell
export const VOICES = [saw, square, tri, bell];

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
