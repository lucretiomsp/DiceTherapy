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

// in the order of ROLE: Saw, Square, Tri
export const VOICES = [saw, square, tri];

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
