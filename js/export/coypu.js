import { near } from "../core/util.js";
import { LANES, isDrum } from "../sequencer/lanes.js";
import { gapAhead, isNote } from "../sequencer/timeline.js";
import { asciiName, pcName } from "../theory/spelling.js";

// Exporter: the session as a Coypu (Pharo) script.

const fmtNote = m => (near(m, Math.round(m)) ? String(Math.round(m)) : String(Math.round(m * 100) / 100));
const fmtNum = x => String(Math.round(x * 100) / 100);

// Notes of a lane over `span` steps as Coypu plays them: one entry per trig, with its length
// cut at the next trig. Coypu loops each sequencer on its own size with no pattern restart, so a
// lane whose length does not divide the pattern is written out over the whole pattern.
function laneEvents(tr, span) {
  const ev = [];
  for (let g = 0; g < span; g++) {
    const i = g % tr.len;
    if (isNote(tr, i)) ev.push({ g, m: tr.notes[i].m, d: Math.min(tr.dur[i] || 1, gapAhead(tr, g, span)) });
  }
  return ev;
}

export function coypuCode(session) {
  const M = session.steps, ctx = session.ctx;
  const L = [];
  L.push(`"Scale Dice: ${asciiName(pcName(ctx.root))} ${ctx.scale.key} (Scale.${ctx.scale.key}), ${session.bpm} bpm, ${M}-step pattern. Rename the track keys to your instruments. durations: are in steps, gateTimes: is the share of each duration that sounds."`);
  L.push("p := Performance uniqueInstance.");
  L.push(`p freq: ${session.bpm} bpm.`);
  session.tracks.forEach((tr, k) => {
    const n = tr.len, fits = M % n === 0, span = fits ? n : M, key = LANES[k].key;
    const ev = laneEvents(tr, span);
    if (!ev.length) { L.push(`"${key}: no notes"`); return; }
    const gates = Array.from({ length: span }, (_, g) => (isNote(tr, g % n) ? 1 : 0));
    const rhythm = fits && tr.src.kind === "world" && !tr.edited ? `${n} ${tr.src.name}` : `#(${gates.join(" ")}) asSeq`;
    const why = fits ? "" : ` "${n} steps written out to ${M}, so it restarts with the pattern"`;
    if (isDrum(k)) { L.push(`${tr.muted ? '"muted" ' : ""}${rhythm} to: #${key}.${why}`); return; }   // drums: triggers only
    L.push(`${tr.muted ? '"muted" ' : ""}((${rhythm} durations: #(${ev.map(e => e.d).join(" ")})) gateTimes: ${fmtNum(tr.gate)}) notes: #(${ev.map(e => fmtNote(e.m)).join(" ")}) to: #${key}.${why}`);
  });
  L.push("p playFor: 16 bars.");
  return L.join("\n");
}
