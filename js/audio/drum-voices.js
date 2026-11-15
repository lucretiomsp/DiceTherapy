// Strategy, like voices.js: one synthesised drum per drum lane, all with the signature
// (ac, bus, t, vel, dur). bus: { out (the lane's gain), noise (1 s of white noise), click (20 ms
// of decaying noise), synth (the synth bus, which the kick ducks) }.
// Every sound is a few nodes that free themselves when they end.

function cleanup(src, ...rest) { src.onended = () => { src.disconnect(); rest.forEach(n => n.disconnect()); }; }

// filtered noise with a percussive envelope; returns the end time
function noiseHit(c, bus, t, { type, freq, q = .7, level, decay, until = Infinity, offset = 0 }) {
  const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = bus.noise;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + .001);
  g.gain.setTargetAtTime(0, t + .001, decay);
  if (until < Infinity) g.gain.setTargetAtTime(0, until, .01);   // choked: stop at the note's end
  n.connect(f); f.connect(g); g.connect(bus.out);
  const end = t + Math.min(decay * 7, until - t + .08);
  n.start(t, offset); n.stop(end);
  cleanup(n, f, g);
}

// a pitched sine dropping from f0 to f1
function body(c, bus, t, { f0, f1, drop, level, decay, type = "sine" }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + drop);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + .002);
  g.gain.setTargetAtTime(0, t + .01, decay);
  o.connect(g); g.connect(bus.out);
  o.start(t); o.stop(t + decay * 8);
  cleanup(o, g);
}

// the kick of the original app: a sine sweep, a click, and a duck on the synths
function kick(c, bus, t, vel) {
  const accent = .75 + .25 * vel;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(165, t);
  o.frequency.exponentialRampToValueAtTime(52, t + .07);
  o.frequency.exponentialRampToValueAtTime(42, t + .35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(accent, t + .002);
  g.gain.setTargetAtTime(0, t + .05, .1);
  o.connect(g); g.connect(bus.out);
  o.start(t); o.stop(t + .9);
  cleanup(o, g);
  const n = c.createBufferSource(), hp = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = bus.click; hp.type = "highpass"; hp.frequency.value = 3000; ng.gain.value = .18 * accent;
  n.connect(hp); hp.connect(ng); ng.connect(bus.out);
  n.start(t);
  cleanup(n, hp, ng);
  const sg = bus.synth.gain;                                        // sidechain-style duck
  sg.cancelScheduledValues(t);
  sg.setTargetAtTime(.5, t, .004);
  sg.setTargetAtTime(1, t + .04, .09);
}

function snare(c, bus, t, vel) {
  body(c, bus, t, { f0: 240, f1: 170, drop: .05, level: .35 * vel, decay: .05, type: "triangle" });
  noiseHit(c, bus, t, { type: "highpass", freq: 1600, level: .45 * vel, decay: .07 });
}

function tom(c, bus, t, vel) {
  body(c, bus, t, { f0: 180, f1: 95, drop: .18, level: .6 * vel, decay: .16 });
  noiseHit(c, bus, t, { type: "bandpass", freq: 900, q: 1.2, level: .06 * vel, decay: .02 });
}

function rim(c, bus, t, vel) {
  body(c, bus, t, { f0: 1700, f1: 1500, drop: .01, level: .3 * vel, decay: .012, type: "square" });
  noiseHit(c, bus, t, { type: "bandpass", freq: 3200, q: 3, level: .2 * vel, decay: .01 });
}

// three quick slaps and a short tail, like hands that don't land together
function clap(c, bus, t, vel) {
  [0, .011, .022].forEach((d, i) => noiseHit(c, bus, t + d, { type: "bandpass", freq: 1200, q: 1.5, level: .5 * vel, decay: i < 2 ? .008 : .11, offset: i * .1 }));
}

function closedHats(c, bus, t, vel) {
  noiseHit(c, bus, t, { type: "highpass", freq: 7500, level: .3 * vel, decay: .025 });
}

// rings until the note ends (its length and gate), then chokes
function openHats(c, bus, t, vel, dur) {
  noiseHit(c, bus, t, { type: "highpass", freq: 7000, level: .26 * vel, decay: .25, until: t + Math.max(.06, dur) });
}

// a wash of high noise with a faint bell on top
function rides(c, bus, t, vel) {
  noiseHit(c, bus, t, { type: "bandpass", freq: 8500, q: .8, level: .16 * vel, decay: .45 });
  body(c, bus, t, { f0: 3520, f1: 3500, drop: .5, level: .03 * vel, decay: .35 });
}

// in the order of DRUMS
export const DRUM_VOICES = [kick, snare, tom, rim, clap, closedHats, openHats, rides];
