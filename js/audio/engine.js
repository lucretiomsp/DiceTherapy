import { DRUM_VOICES } from "./drum-voices.js";
import { VOICES } from "./voices.js";

// Per lane, in the order of LANES: stereo position (-1 left .. 1 right) and delay send.
// Low voices stay central; the rest alternate sides so the image balances (pans sum to ~0).
// Drums sit like a kit seen from the front: kick and snare in the middle, hats right, ride left.
const MIX = [
  { pan: 0, send: 0 },        // Saw
  { pan: -.22, send: .2 },    // Square
  { pan: .22, send: .28 },    // Tri
  { pan: .35, send: .4 },     // Bell
  { pan: -.08, send: .1 },    // Acid
  { pan: -.4, send: .35 },    // Pluck
  { pan: -.15, send: .3 },    // Pad
  { pan: .3, send: .15 },     // Organ
  { pan: 0, send: 0 },        // Kick
  { pan: 0, send: .12 },      // Snare
  { pan: -.25, send: .1 },    // Tom
  { pan: .3, send: .15 },     // Rim
  { pan: .1, send: .15 },     // Clap
  { pan: .35, send: 0 },      // Closed Hats
  { pan: .4, send: .05 },     // Open Hats
  { pan: -.35, send: .05 },   // Rides
];

// Facade over the Web Audio graph: the AudioContext is created lazily on the first user gesture,
// and callers only ever say "play lane k", "mute lane k", "set the delay".
//
//   synth voice k -> lane gain k -> panner -> synth bus (ducked by the kick) -> master -> compressor -> out
//                                \-> send -> dotted-8th delay -> synth bus
//   drum k        -> lane gain k -> panner -> drum bus -> master   (sends into the delay too)
export class AudioEngine {
  ctx = null;
  #nodes = null;

  get ready() { return !!(this.ctx && this.#nodes); }
  get currentTime() { return this.ctx.currentTime; }

  // Resolves true once the context runs. `muted` and `stepDuration` set up a graph built now.
  ensure({ muted = [], stepDuration } = {}) {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return Promise.resolve(false);
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* iOS ringer switch */ }
        this.ctx = new Ctor({ latencyHint: "interactive" });
        this.#build(muted, stepDuration);
      }
      const AC = this.ctx;
      const b = AC.createBuffer(1, 1, AC.sampleRate), s = AC.createBufferSource();   // iOS unlock
      s.buffer = b; s.connect(AC.destination); s.start(0);
      if (AC.state === "running") return Promise.resolve(true);
      return AC.resume().then(() => AC.state === "running", () => false);
    } catch (e) { return Promise.resolve(false); }
  }

  // melody lane k (0..7)
  playVoice(k, t, m, dur, vel) { VOICES[k](this.ctx, this.#nodes.tracks[k], t, m, dur, vel); }
  // drum lane k (8..15)
  playDrum(k, t, vel, dur) {
    const n = this.#nodes;
    DRUM_VOICES[k - VOICES.length](this.ctx, { out: n.tracks[k], noise: n.noise, click: n.click, synth: n.synth }, t, vel, dur);
  }

  setDelayTime(stepDuration) {
    if (this.ready) this.#nodes.dly.delayTime.setTargetAtTime(Math.min(1.9, stepDuration * 3), this.ctx.currentTime, .05);   // dotted 8th
  }
  setTrackMuted(k, muted) {
    if (this.ready) this.#nodes.tracks[k].gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, .012);
  }

  // context time that is coming out of the speakers right now
  audibleTime() {
    const AC = this.ctx;
    if (AC.getOutputTimestamp) {
      const ts = AC.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return AC.currentTime - (AC.outputLatency || AC.baseLatency || 0);
  }
  outputTimestamp() { return this.ctx.getOutputTimestamp ? this.ctx.getOutputTimestamp() : null; }
  outputLatency() { return this.ctx.outputLatency || this.ctx.baseLatency || 0; }

  #build(muted, stepDuration) {
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    const master = c.createGain(); master.gain.value = .8;
    master.connect(comp); comp.connect(c.destination);
    const synth = c.createGain(); synth.connect(master);             // ducked by the kick
    const drums = c.createGain(); drums.gain.value = .95; drums.connect(master);
    const dly = c.createDelay(2), fb = c.createGain(), dlp = c.createBiquadFilter(), wet = c.createGain();
    fb.gain.value = .32; dlp.type = "lowpass"; dlp.frequency.value = 2600; wet.gain.value = .5;
    dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(wet); wet.connect(synth);
    const tracks = MIX.map(({ pan, send }, k) => {
      const g = c.createGain();
      g.gain.value = muted[k] ? 0 : 1;
      let out = g;
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      out.connect(k < VOICES.length ? synth : drums);
      if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(dly); }
      return g;
    });
    const noiseBuf = (secs, shape) => {
      const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * shape(i / d.length);
      return b;
    };
    const click = noiseBuf(.02, x => 1 - x);                         // the kick's click
    const noise = noiseBuf(1, () => 1);                              // snares, hats, claps
    this.#nodes = { synth, dly, tracks, click, noise };
    if (stepDuration) this.setDelayTime(stepDuration);
  }
}
