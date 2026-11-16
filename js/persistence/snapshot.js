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
// It comes in two parts, so pattern slots can store the tracks alone:
//   globals  scale, root, tempo, pattern length, chords: shared by every slot
//   tracks   the 16 lanes: rhythms, notes, lengths, gates, mute and solo

export function snapshotGlobals(session) {
  if (!session.ctx) return null;
  return {
    v: 2, scale: session.ctx.scale.key, rootPc: session.ctx.rootPc, steps: session.steps, bpm: session.bpm, rnd: session.rnd,
    micro: session.micro, harmony: session.harmony.map(c => c.j),
  };
}

export function snapshotTracks(session) {
  return session.tracks.map(t => ({ len: t.len, gates: t.gates.slice(), notes: t.notes.map(n => (n ? n.m : null)), vel: t.vel.slice(), dur: t.dur.slice(), src: { ...t.src }, edited: t.edited, muted: t.muted, solo: !!t.solo, gate: t.gate, gateSet: t.gateSet }));
}

export function snapshot(session) {
  const g = snapshotGlobals(session);
  return g ? { ...g, tracks: snapshotTracks(session) } : {};
}

export const canRestore = d => !!(d && (d.v === 1 || d.v === 2));

export function restoreGlobals(session, d) {
  try {
    const sc = SCALES.find(s => s.key === d.scale);
    if (!sc) return false;
    session.steps = MASTERS.includes(+d.steps) ? +d.steps : 16;
    session.bpm = clamp(+d.bpm || 124, 70, 170);
    session.rnd = clamp(+d.rnd || 0, 0, 100);
    session.micro = d.micro !== false;
    session.ctx = buildCtx(sc, (d.rootPc | 0) % 12);
    const nb = barsOf(session.steps), hj = Array.isArray(d.harmony) ? d.harmony : [];
    session.harmony = hj.length === nb && hj.every(j => j >= 0 && j < session.ctx.asc.length) ? hj.map(j => chordOn(session.ctx, j)) : makeHarmony(session.ctx, nb);
    return true;
  } catch (e) { return false; }
}

// Tracks onto the session's current globals. A melody note that is not in the current scale (a
// slot made under another scale) moves to the nearest pitch of the scale in the lane's range.
// v1 (16/32 steps, no lengths or durations): every lane gets the pattern length and each note is
// held until the next one, up to its role's hold, as v1 played it.
// Fewer lanes (3 or 4 melody lanes, or no drums) load with the missing lanes generated; from
// those, a kick that was switched off (`kickOff`) comes back as a muted Kick drum lane.
export function restoreTracks(session, tracks, { v1 = false, kickOff = false } = {}) {
  try {
    if (!Array.isArray(tracks) || tracks.length < 3 || tracks.length > LANES.length) return false;
    const pad = (a, f) => Array.from({ length: MAXL }, (_, i) => (Array.isArray(a) && a[i] != null ? a[i] : f));
    session.tracks = tracks.map((t, k) => {
      const R = LANES[k], pool = isDrum(k) ? null : poolFor(session.ctx, R.lo, R.hi);
      const nearest = m => pool.reduce((a, p) => (Math.abs(p.m - m) < Math.abs(a.m - m) ? p : a), pool[0]);
      const pitch = m => (m == null ? null : isDrum(k) ? drumNote() : pool.find(p => near(p.m, m)) || nearest(m) || null);
      const tr = {
        len: clamp((v1 ? session.steps : +t.len) || 16, MINL, MAXL),
        gates: pad(t.gates, 0).map(g => (g ? 1 : 0)),
        notes: pad(t.notes, null).map(pitch),
        vel: pad(t.vel, .85).map(Number), dur: pad(v1 ? null : t.dur, 0).map(Number),
        src: t.src && typeof t.src === "object" ? { ...t.src } : { kind: "random", prob: 50 }, edited: !!t.edited, muted: !!t.muted, solo: !!t.solo,
        gate: roundGate(+(v1 ? t.gateFrac : t.gate) || .8), gateSet: !!t.gateSet,
      };
      tr.gates.forEach((g, i) => { if (isNote(tr, i) && !(tr.dur[i] >= 1)) tr.dur[i] = Math.min(gapIn(tr, i), R.hold); });
      return tr;
    });
    const hadDrums = tracks.length > FIRST_DRUM;
    session.fillMissingTracks();
    if (!hadDrums && kickOff) session.tracks[FIRST_DRUM].muted = true;
    return true;
  } catch (e) { return false; }
}

export function restore(session, d) {
  if (!d || !Array.isArray(d.tracks) || d.tracks.length < 3 || d.tracks.length > LANES.length) return false;
  return restoreGlobals(session, d) && restoreTracks(session, d.tracks, { v1: d.v === 1, kickOff: d.kick === false });
}
