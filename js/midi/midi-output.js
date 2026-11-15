import { Emitter } from "../core/emitter.js";
import { loadPref, savePref } from "../core/storage.js";
import { clamp } from "../core/util.js";
import { LOOKAHEAD } from "../audio/timing.js";

// Saw, Square, Tri go out on MIDI channels 1, 2, 3. Each lane is monophonic on its own
// channel, so microtones (24-TET, Partch JI) ride on a per-note pitch bend.
// MIDI clock (24 ppqn, Start, Stop) has its own port, which can also be the notes port.
export const MIDI_CH = [0, 1, 2];                // 0-based: ch 1, 2, 3
const BEND_RANGE = 2;                            // semitones, also sent to the synth as RPN 0
const MIDI_KEY = "diceTherapy.midiOut";          // last port used
const CLOCK_KEY = "diceTherapy.clockOut";        // last clock port used

// Events: "change" (ports, selection or the local-synth switch changed), "notice" (message).
export class MidiOutput extends Emitter {
  access = null;
  out = null;          // notes port
  sync = null;         // clock port
  local = true;        // also play the built-in synths
  #tb = null;          // audio-to-performance.now() offset, ms
  #tbOk = false;
  #run = false;        // clock: Start sent
  #tickAt = 0;         // time of the last clock
  #stopAt = 0;         // time of the last Stop
  #pend = [null, null, null];
  #bend = [null, null, null];

  constructor(audio) {
    super();
    this.audio = audio;
  }

  get supported() { return !!navigator.requestMIDIAccess; }
  // connected outputs, empty before access is granted
  get outputs() { return this.access ? [...this.access.outputs.values()].filter(o => o.state !== "disconnected") : []; }

  /* ---------------------------- timebase ---------------------------- */
  // Offset from AudioContext time to performance.now() time at which it is heard, so MIDI lands
  // with the audio. The output timestamp is exact; the currentTime fallback moves in audio-callback
  // chunks, so it is smoothed. Switching source or a jump (new output device) snaps it.
  timebase() {
    const ts = this.audio.outputTimestamp();
    const ok = !!(ts && ts.contextTime > 0 && ts.performanceTime > 0);
    const raw = ok ? ts.performanceTime - ts.contextTime * 1000
      : performance.now() - (this.audio.currentTime - this.audio.outputLatency()) * 1000;
    this.#tb = this.#tb == null || ok !== this.#tbOk || Math.abs(raw - this.#tb) > 50 ? raw : this.#tb + (raw - this.#tb) * .02;
    this.#tbOk = ok;
  }
  resetTimebase() { this.#tb = null; }
  // The first output timestamps of a fresh AudioContext are off by up to a buffer while the device
  // primes: before the first notes, wait (~30 ms) until two readings agree
  settle() {
    return new Promise(res => {
      const t0 = performance.now();
      let last = null;
      const poll = () => {
        const ts = this.audio.outputTimestamp();
        if (!ts || ts.contextTime > .5 || performance.now() - t0 > 300) return res();
        if (ts.contextTime > 0 && ts.performanceTime > 0 && (!last || ts.contextTime !== last.c)) {
          const o = ts.performanceTime - ts.contextTime * 1000;
          if (last && Math.abs(o - last.o) < 1) return res();
          last = { c: ts.contextTime, o };
        }
        setTimeout(poll, 4);
      };
      poll();
    });
  }
  #perfAt(t) {
    if (this.#tb == null) this.timebase();
    return this.#tb + t * 1000;
  }
  #send(data, at, port = this.out) {
    try { port.send(data, at); } catch (e) { /* port went away */ }
  }

  /* ------------------------------ notes ----------------------------- */
  note(k, m, t, dur, vel) {
    if (!this.out) return;
    const ch = MIDI_CH[k], n = clamp(Math.round(m), 0, 127), on = this.#perfAt(t), p = this.#pend[k];
    const bend = clamp(Math.round(8192 + (m - n) / BEND_RANGE * 8192), 0, 16383);
    if (p) this.#send([0x80 | ch, p.n, 0], Math.min(this.#perfAt(p.off), on));   // a tempo jump can overlap notes: cut the old one
    if (bend !== this.#bend[k]) { this.#send([0xE0 | ch, bend & 127, bend >> 7], on); this.#bend[k] = bend; }
    this.#send([0x90 | ch, n, clamp(Math.round(vel * 127), 1, 127)], on);
    this.#pend[k] = { n, off: t + dur };
  }
  // note-offs wait here until they fall inside the lookahead, so a later note can still pull them in
  flush(horizon) {
    this.#pend.forEach((p, k) => {
      if (!p || p.off >= horizon) return;
      if (this.out) this.#send([0x80 | MIDI_CH[k], p.n, 0], this.#perfAt(p.off));
      this.#pend[k] = null;
    });
  }
  // after stop, ringing notes still get their note-off when due
  drain(isPlaying) {
    if (isPlaying()) return;
    this.flush(this.audio.currentTime + LOOKAHEAD);
    if (this.#pend.some(Boolean)) setTimeout(() => this.drain(isPlaying), 25);
  }

  /* ------------------------------ clock ----------------------------- */
  // MIDI clock: 6 clocks per 16th step, laid on the step grid with the same lookahead and timestamps
  // as the notes, so tempo changes reach the clock from the next step, like the notes. Start goes
  // just before the first clock, which the other device plays as step 1. Stop goes after the clocks
  // already queued, so the other device stops where the audio does.
  clockTicks(g, t, stepDuration) {
    if (!this.#run) {
      if (g % 16) return;                                             // start, or join while playing, on a bar line
      this.#tickAt = Math.max(this.#perfAt(t) - 1, this.#stopAt + 1); // never before the last Stop
      this.#send([0xFA], this.#tickAt, this.sync);
      this.#run = true;
    }
    const sd = stepDuration / 6;
    for (let n = 0; n < 6; n++) {
      this.#tickAt = Math.max(this.#perfAt(t + n * sd), this.#tickAt); // never out of order
      this.#send([0xF8], this.#tickAt, this.sync);
    }
  }
  clockStop(now) {
    if (!this.#run) return;
    this.#run = false;
    this.#stopAt = now ? performance.now() : Math.max(performance.now(), this.#tickAt + 1);
    if (this.sync) this.#send([0xFC], now ? undefined : this.#stopAt, this.sync);
  }

  /* ------------------------------ ports ----------------------------- */
  setOut(out, remember) {
    out = out || null;
    if (this.out && this.out !== out) this.flush(Infinity);
    this.out = out;
    this.#bend = [null, null, null];
    if (out) MIDI_CH.forEach(ch => { const c = 0xB0 | ch; this.#send([c, 101, 0, c, 100, 0, c, 6, BEND_RANGE, c, 38, 0, c, 101, 127, c, 100, 127]); });
    else if (!this.local) this.local = true;                          // without MIDI, never leave the synths silent
    if (remember) savePref(MIDI_KEY, out ? out.name : "off");
    this.emit("change");
  }
  setClock(out, remember) {
    out = out || null;
    if (this.sync !== out) this.clockStop();                          // the old port stops after the clocks it already has
    this.sync = out;
    if (remember) savePref(CLOCK_KEY, out ? out.name : "off");
    this.emit("change");
  }
  setLocal(on) { this.local = on; }
  // id from a port menu ("" = off)
  portById(id) { return id && this.access ? this.access.outputs.get(id) : null; }

  // Notes: the last port used (waiting for it while unplugged), else the first real one.
  // Clock: only a port picked for it before, or the first real one when connecting from its menu.
  // who: the menu that asked to connect ("out" or "clock"), null when it happens on its own.
  refresh(who) {
    const outs = this.outputs;
    const first = outs.find(o => !/GS Wavetable/i.test(o.name));
    const byName = n => outs.find(o => o.name === n);
    if (this.out && !outs.some(o => o.id === this.out.id)) this.setOut(null);      // unplugged
    if (this.sync && !outs.some(o => o.id === this.sync.id)) this.setClock(null);
    if (!this.out) {
      let last = loadPref(MIDI_KEY);
      if (who === "out" && last === "off") last = null;
      if (who === "clock" && last == null) { last = "off"; savePref(MIDI_KEY, "off"); }   // connecting for clock only keeps the notes off
      const d = last === "off" ? null : !last ? first : byName(last) || (who === "out" ? first : null);
      if (d) this.setOut(d, who === "out");
    }
    if (!this.sync) {
      const last = loadPref(CLOCK_KEY);
      const d = who === "clock" ? byName(last) || first : last && last !== "off" ? byName(last) : null;
      if (d) this.setClock(d, who === "clock");
    }
    this.emit("change");
  }
  async connect(who) {
    try { this.access = await navigator.requestMIDIAccess(); }
    catch (e) {
      if (who) this.emit("notice", "MIDI is blocked: allow it in the site settings");
      this.emit("change");
      return;
    }
    this.access.onstatechange = () => this.refresh(null);
    this.refresh(who);
  }
  // connect without asking when the permission was granted before
  autoConnect() {
    try { navigator.permissions.query({ name: "midi" }).then(s => { if (s.state === "granted") this.connect(null); }, () => {}); }
    catch (e) { /* no Permissions API */ }
  }
  // page is going away: all notes off, Stop right away
  panic() {
    if (this.out) MIDI_CH.forEach(ch => this.#send([0xB0 | ch, 123, 0]));
    this.clockStop(true);
  }
}
