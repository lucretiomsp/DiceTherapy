import { Emitter } from "../core/emitter.js";
import { isDrum } from "../sequencer/lanes.js";
import { gapAhead, isNote } from "../sequencer/timeline.js";
import { createTicker } from "./ticker.js";
import { LOOKAHEAD } from "./timing.js";

// Play/stop and the lookahead scheduler: reads the session step by step and sends each step to
// the audio engine and the MIDI output ahead of time.
//
// Events: "state" (playing: boolean), "playhead" (pattern step heard now, -1 when stopped),
//         "notice" (message for the user).
export class Transport extends Emitter {
  #playing = false;
  #nextT = 0;          // context time of the next step to schedule
  #stepIdx = 0;        // pattern step to schedule next
  #vq = [];            // scheduled steps for the playhead {i, t}
  #ticker;

  constructor({ session, audio, midi }) {
    super();
    this.session = session;
    this.audio = audio;
    this.midi = midi;
    this.#ticker = createTicker(() => this.#schedule());
  }

  get playing() { return this.#playing; }

  toggle() { return this.#playing ? this.stop() : this.start(); }

  async start() {
    const { session, audio, midi } = this;
    const ok = await audio.ensure({ muted: session.tracks.map((_, k) => !session.isAudible(k)), stepDuration: session.stepDuration });
    if (!ok) { this.emit("notice", "Audio is blocked here. Tap Play again."); return; }
    if (midi.out || midi.sync) await midi.settle();
    midi.resetTimebase();                                             // fresh audio-to-MIDI offset: it is not tracked while stopped
    this.#playing = true; this.#stepIdx = 0; this.#vq.length = 0;
    this.#nextT = Math.max(audio.currentTime + .05, this.#nextT);     // a quick restart waits for the steps already scheduled
    this.#ticker.start(); this.#schedule(); requestAnimationFrame(this.#frame);
    this.emit("state", true);
  }

  stop() {
    this.#playing = false; this.#ticker.stop(); this.#vq.length = 0;
    this.emit("playhead", -1);
    this.emit("state", false);
    this.midi.clockStop();
    this.midi.drain(() => this.#playing);
  }

  // the pattern got shorter: keep the next step inside it
  wrap(steps) { this.#stepIdx %= steps; }

  // g: step in the pattern. Each lane reads its own step g % len; a note sounds for its duration
  // (cut at the lane's next note, also across the pattern restart) times the lane's gate, as in Coypu.
  #playStep(g, t) {
    const { session, audio, midi } = this, M = session.steps, sd = session.stepDuration;
    if (midi.sync) midi.clockTicks(g, t, sd);
    session.tracks.forEach((tr, k) => {
      const i = g % tr.len;
      if (!isNote(tr, i)) return;
      const steps = Math.min(tr.dur[i] || 1, gapAhead(tr, g, M));
      const m = tr.notes[i].m, dur = steps * sd * tr.gate, vel = tr.vel[i] || .85, heard = session.isAudible(k);
      if (isDrum(k)) {
        // a silent drum is not played at all, so a muted kick does not duck the synths either
        if (midi.local && heard) audio.playDrum(k, t, vel, dur);
      } else if (midi.local) audio.playVoice(k, t, m, dur, vel);       // silenced by its lane gain when not heard
      if (heard) midi.note(k, m, t, dur, vel);
    });
  }

  #schedule() {
    if (!this.#playing || !this.audio.ctx) return;
    const now = this.audio.currentTime;
    this.midi.timebase();
    if (this.#nextT < now - .05) this.#nextT = now + .03;              // resumed after an interruption
    while (this.#nextT < now + LOOKAHEAD) {
      this.#playStep(this.#stepIdx, this.#nextT);
      this.#vq.push({ i: this.#stepIdx, t: this.#nextT });
      this.#nextT += this.session.stepDuration;
      this.#stepIdx = (this.#stepIdx + 1) % this.session.steps;
    }
    this.midi.flush(now + LOOKAHEAD);
  }

  // the playhead follows what is heard, not what is scheduled
  #frame = () => {
    if (!this.#playing) return;
    this.#schedule();
    const now = this.audio.audibleTime();
    let s = null;
    while (this.#vq.length && this.#vq[0].t <= now) s = this.#vq.shift().i;
    if (s !== null) this.emit("playhead", s);
    requestAnimationFrame(this.#frame);
  };
}
