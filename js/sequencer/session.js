import { clamp, pick, wpick } from "../core/util.js";
import { SCALES } from "../data/scales.js";
import { buildCtx } from "../theory/scale-context.js";
import { makeHarmony } from "../theory/chords.js";
import { genNotes, noteWeights, poolFor, voiceRefs } from "./melody.js";
import { makeRhythm } from "./rhythm.js";
import { BEAT, ROLE, genDur, randGate, roundGate } from "./roles.js";
import { drumNote, drumVel, makeDrumRhythm } from "./drums.js";
import { FIRST_DRUM, LANES, isDrum } from "./lanes.js";
import { MASTERS, MAXL, MINL, barsOf, effDur, gapIn, isNote, occ } from "./timeline.js";

// The model: everything the dice decided and everything the user edited. No DOM, no audio.
// Methods that change the pattern return false when nothing changed, so the caller can skip a redraw.
export class Session {
  ctx = null;          // scale context, see buildCtx
  steps = 16;          // pattern length, one of MASTERS
  bpm = 136;
  rnd = 60;            // % of lanes that get a random rhythm instead of a world rhythm
  micro = true;        // microtonal scales allowed
  harmony = [];        // one chord per bar
  tracks = [];         // one per LANES: melody lanes, then drum lanes

  get stepDuration() { return 60 / this.bpm / 4; }

  availableScales() { return SCALES.filter(s => this.micro || s.ppo === 12); }

  refs() { return voiceRefs(this.tracks, this.steps); }

  /* ------------------------------ dice ------------------------------ */
  roll() {
    this.ctx = buildCtx(this.#pickScale(), Math.floor(Math.random() * 12));
    this.regenerate();
  }
  regenerate() {
    this.harmony = makeHarmony(this.ctx, barsOf(this.steps));
    const used = new Set(), drumUsed = new Set();   // melody and drum lanes each avoid repeating a world rhythm
    for (let k = 0; k < LANES.length; k++) this.#genTrack(k, isDrum(k) ? drumUsed : used);
  }
  // generate the lanes that are missing (a save from before a lane was added)
  fillMissingTracks() {
    for (let k = 0; k < LANES.length; k++) if (!this.tracks[k]) this.#genTrack(k, this.#worldUsed(k));
  }
  rerollTrack(k) { this.#genTrack(k, this.#worldUsed(k)); }

  /* ----------------------------- lengths ---------------------------- */
  // New pattern length: new chords for the new number of bars, lanes that matched the old length
  // follow it, rhythms stay, notes and durations are picked again for the new chords.
  setMaster(M) {
    if (!MASTERS.includes(M) || M === this.steps) return false;
    const follow = Math.min(this.steps, MAXL);
    this.steps = M;
    this.tracks.forEach(tr => { if (tr.len === follow) tr.len = Math.min(M, MAXL); });
    this.harmony = makeHarmony(this.ctx, barsOf(M));
    for (let k = 0; k < FIRST_DRUM; k++) genNotes(k, this.tracks[k], this.ctx, this.harmony, this.refs(), this.steps);
    return true;
  }
  // Lane length: shorter hides steps without deleting them; longer brings back the hidden steps,
  // or continues the rhythm with new notes where there were none.
  setTrackLen(k, n) {
    const tr = this.tracks[k], old = tr.len;
    n = clamp(Math.round(n) || old, MINL, MAXL);
    if (n === old) return false;
    tr.len = n;
    const fresh = [];
    for (let i = old; i < n; i++) if (tr.gates[i] && !tr.notes[i]) { this.#pickNoteAt(k, i); fresh.push(i); }
    fresh.forEach(i => { tr.dur[i] = genDur(LANES[k], i, gapIn(tr, i)); });
    return true;
  }

  /* ------------------------------ edits ----------------------------- */
  // A tap on a note removes it; on an empty or held step it starts a one-step note there.
  toggleStep(k, i) {
    const tr = this.tracks[k];
    if (isNote(tr, i)) { tr.gates[i] = 0; tr.notes[i] = null; }
    else { tr.gates[i] = 1; this.#pickNoteAt(k, i); tr.dur[i] = 1; }
    tr.edited = true;
  }
  setDur(k, i, d) {
    const tr = this.tracks[k];
    if (!isNote(tr, i)) return false;
    const v = clamp(Math.round(d), 1, gapIn(tr, i));
    if (v === effDur(tr, i) && v === tr.dur[i]) return false;
    tr.dur[i] = v;
    return true;
  }
  // Shift lane k's pattern by d steps inside its own loop: + to the right (later), − to the left.
  // Notes travel with their velocity and length; steps past the lane length stay where they are.
  rotateTrack(k, d) {
    const tr = this.tracks[k], L = tr.len;
    d = ((Math.round(d) % L) + L) % L;
    if (!d) return false;
    for (const key of ["gates", "notes", "vel", "dur"]) {
      const a = tr[key], head = a.slice(0, L);
      for (let i = 0; i < L; i++) a[(i + d) % L] = head[i];
    }
    tr.edited = true;
    return true;
  }
  setGate(k, v) {
    const tr = this.tracks[k];
    tr.gate = roundGate(v);
    tr.gateSet = true;
  }
  // Returns whether the lane is now muted.
  toggleMute(k) {
    const tr = this.tracks[k];
    tr.muted = !tr.muted;
    return tr.muted;
  }
  // Returns whether the lane is now soloed.
  toggleSolo(k) {
    const tr = this.tracks[k];
    tr.solo = !tr.solo;
    return tr.solo;
  }
  // A whole pane at once (group "synth" or "drum"): if every lane in it is already muted (or
  // soloed), switch them all off, otherwise switch them all on.
  groupLanes(group) { return this.tracks.map((_, k) => k).filter(k => isDrum(k) === (group === "drum")); }
  toggleGroup(group, prop) {
    const ks = this.groupLanes(group), all = ks.every(k => !!this.tracks[k][prop]);
    ks.forEach(k => { this.tracks[k][prop] = !all; });
  }
  // "true" when every lane in the group has it, "mixed" when some do, "false" when none
  groupState(group, prop) {
    const n = this.groupLanes(group).filter(k => !!this.tracks[k][prop]).length;
    return n === 0 ? "false" : n === this.groupLanes(group).length ? "true" : "mixed";
  }
  get anySolo() { return this.tracks.some(t => t.solo); }
  // Whether lane k is heard: not muted, and soloed whenever any lane is. Mute wins.
  isAudible(k) {
    const tr = this.tracks[k];
    return !tr.muted && (!this.anySolo || !!tr.solo);
  }

  /* ----------------------------- private ---------------------------- */
  #pickScale() {
    const list = this.availableScales();
    let s;
    do { s = pick(list); } while (list.length > 1 && this.ctx && s.key === this.ctx.scale.key);
    return s;
  }
  // world rhythms the other lanes of the same kind (melody or drum) already use
  #worldUsed(k) {
    return new Set(this.tracks.filter((t, i) => t && i !== k && isDrum(i) === isDrum(k) && t.src.kind === "world").map(t => t.src.name));
  }
  // A lane keeps its length, its mute and solo, and once you have set it, its gate across rerolls.
  // Drum lanes only get a new rhythm: every hit is the same note.
  #genTrack(k, used) {
    const R = LANES[k], old = this.tracks[k];
    const len = old ? old.len : Math.min(this.steps, MAXL);
    const r = isDrum(k) ? makeDrumRhythm(R, len, this.rnd / 100, used) : makeRhythm(len, this.rnd / 100, used);
    const tr = {
      len, gates: r.gates, src: r.src, edited: false, muted: old ? old.muted : false, solo: old ? !!old.solo : false,
      gate: old && old.gateSet ? old.gate : randGate(R), gateSet: !!(old && old.gateSet),
      notes: Array(MAXL).fill(null), vel: Array(MAXL).fill(0), dur: Array(MAXL).fill(1),
    };
    this.tracks[k] = tr;
    if (isDrum(k)) this.#drumHits(k, tr);
    else genNotes(k, tr, this.ctx, this.harmony, this.refs(), this.steps);
    return tr;
  }
  #drumHits(k, tr) {
    const D = LANES[k];
    for (let i = 0; i < MAXL; i++) {
      tr.notes[i] = i < tr.len && tr.gates[i] ? drumNote() : null;
      if (tr.notes[i]) tr.vel[i] = drumVel(D, i);
    }
    for (let i = 0; i < tr.len; i++) if (tr.notes[i]) tr.dur[i] = genDur(D, i, gapIn(tr, i));
  }
  #pickNoteAt(k, i) {
    const tr = this.tracks[k];
    if (isDrum(k)) { tr.notes[i] = drumNote(); tr.vel[i] = drumVel(LANES[k], i); return; }
    const R = ROLE[k], L = tr.len, pool = poolFor(this.ctx, R.lo, R.hi);
    let prev = null, next = null;
    for (let d = 1; d < L && !prev; d++) { const j = (i - d + L) % L; if (isNote(tr, j)) prev = tr.notes[j]; }
    for (let d = 1; d < L && !next; d++) { const j = (i + d) % L; if (isNote(tr, j)) next = tr.notes[j]; }
    const ws = noteWeights(k, pool, { occ: occ(i, L, this.steps), prev, lastLeap: 0, next, isFirst: !prev, refs: this.refs() }, this.harmony, this.ctx);
    tr.notes[i] = wpick(pool, ws.map(w => Math.pow(w, R.tau)));
    tr.vel[i] = clamp(.7 + .3 * BEAT[i % 16], .45, 1);
  }
}
