import { clamp, near } from "../core/util.js";
import { SCALES } from "../data/scales.js";
import { buildCtx } from "../theory/scale-context.js";
import { chordOn, makeHarmony } from "../theory/chords.js";
import { poolFor } from "../sequencer/melody.js";
import { roundGate } from "../sequencer/roles.js";
import { drumNote } from "../sequencer/drums.js";
import { FIRST_DRUM, LANES, isDrum } from "../sequencer/lanes.js";
import { MASTERS, MAXL, MINL, barsOf, gapIn, isNote } from "../sequencer/timeline.js";

// Memento: the session as plain JSON (pitches instead of object references), and back.

export function snapshot(session) {
  if (!session.ctx) return {};
  return {
    v: 2, scale: session.ctx.scale.key, rootPc: session.ctx.rootPc, steps: session.steps, bpm: session.bpm, rnd: session.rnd,
    micro: session.micro, harmony: session.harmony.map(c => c.j),
    tracks: session.tracks.map(t => ({ len: t.len, gates: t.gates, notes: t.notes.map(n => (n ? n.m : null)), vel: t.vel, dur: t.dur, src: t.src, edited: t.edited, muted: t.muted, solo: !!t.solo, gate: t.gate, gateSet: t.gateSet })),
  };
}

export const canRestore = d => !!(d && (d.v === 1 || d.v === 2));

// v1 (16/32 steps, no lengths or durations) loads too: every lane gets the pattern length and
// each note is held until the next one, up to its role's hold, as v1 played it.
// Saves with fewer lanes (3 or 4 melody lanes, or no drums) load with the missing lanes generated;
// from those, a kick that was switched off comes back as a muted Kick drum lane.
export function restore(session, d) {
  try {
    const sc = SCALES.find(s => s.key === d.scale);
    if (!sc || !Array.isArray(d.tracks) || d.tracks.length < 3 || d.tracks.length > LANES.length) return false;
    const v1 = d.v === 1;
    session.steps = MASTERS.includes(+d.steps) ? +d.steps : 16;
    session.bpm = clamp(+d.bpm || 124, 70, 170);
    session.rnd = clamp(+d.rnd || 0, 0, 100);
    session.micro = d.micro !== false;
    session.ctx = buildCtx(sc, (d.rootPc | 0) % 12);
    const nb = barsOf(session.steps), hj = Array.isArray(d.harmony) ? d.harmony : [];
    session.harmony = hj.length === nb && hj.every(j => j >= 0 && j < session.ctx.asc.length) ? hj.map(j => chordOn(session.ctx, j)) : makeHarmony(session.ctx, nb);
    const pad = (a, f) => Array.from({ length: MAXL }, (_, i) => (Array.isArray(a) && a[i] != null ? a[i] : f));
    session.tracks = d.tracks.map((t, k) => {
      const R = LANES[k], pool = isDrum(k) ? null : poolFor(session.ctx, R.lo, R.hi);
      const pitch = m => (m == null ? null : isDrum(k) ? drumNote() : pool.find(p => near(p.m, m)) || null);
      const tr = {
        len: clamp((v1 ? session.steps : +t.len) || 16, MINL, MAXL),
        gates: pad(t.gates, 0).map(g => (g ? 1 : 0)),
        notes: pad(t.notes, null).map(pitch),
        vel: pad(t.vel, .85).map(Number), dur: pad(v1 ? null : t.dur, 0).map(Number),
        src: t.src && typeof t.src === "object" ? t.src : { kind: "random", prob: 50 }, edited: !!t.edited, muted: !!t.muted, solo: !!t.solo,
        gate: roundGate(+(v1 ? t.gateFrac : t.gate) || .8), gateSet: !!t.gateSet,
      };
      tr.gates.forEach((g, i) => { if (isNote(tr, i) && !(tr.dur[i] >= 1)) tr.dur[i] = Math.min(gapIn(tr, i), R.hold); });
      return tr;
    });
    const hadDrums = d.tracks.length > FIRST_DRUM;
    session.fillMissingTracks();
    if (!hadDrums && d.kick === false) session.tracks[FIRST_DRUM].muted = true;
    return true;
  } catch (e) { return false; }
}
