// Pattern and lane lengths, and the pure track queries built on them.
//
// The pattern (MASTERS) sets the chord bars and restarts every lane when it ends. Each lane loops
// on its own length (MINL..MAXL) inside it. Lanes store MAXL steps, so shortening a lane and
// lengthening it again brings the same steps back.
//
// A track: { len, gates[], notes[], vel[], dur[], src, edited, muted, gate, gateSet }

export const MASTERS = [16, 32, 64, 128], MINL = 3, MAXL = 64;
export const barsOf = M => Math.ceil(M / 16);
export const chordAt = (harmony, g) => harmony[Math.floor(g / 16) % harmony.length];

// pattern positions where lane step i is heard (a step past the pattern end is judged where it sits)
export function occ(i, L, M) {
  const out = [];
  for (let g = i; g < M; g += L) out.push(g);
  return out.length ? out : [i];
}
export const isNote = (tr, i) => !!(tr.gates[i] && tr.notes[i]);
// steps from note i to the next note in the lane's own loop
export function gapIn(tr, i) {
  const L = tr.len;
  for (let d = 1; d < L; d++) if (isNote(tr, (i + d) % L)) return d;
  return L;
}
// steps from pattern step g to this lane's next note while playing (the lane restarts at the pattern end)
export function gapAhead(tr, g, M) {
  for (let d = 1; d <= M; d++) { const g2 = (g + d) % M; if (isNote(tr, g2 % tr.len)) return d; }
  return M;
}
// a note never outlasts the gap to the next one, so lanes stay monophonic (as Coypu's asSeq does)
export const effDur = (tr, i) => Math.max(1, Math.min(tr.dur[i] || 1, gapIn(tr, i)));
// for each step: the note holding it (-1 if none), and whether it is the note's last step
export function coverage(tr) {
  const L = tr.len, owner = Array(L).fill(-1), end = Array(L).fill(false);
  for (let i = 0; i < L; i++) {
    if (!isNote(tr, i)) continue;
    const d = effDur(tr, i);
    for (let s = 1; s < d; s++) { const j = (i + s) % L; owner[j] = i; end[j] = s === d - 1; }
  }
  return { owner, end };
}
// note under step i: itself, the note holding it, or -1
export function ownerOf(tr, i) { return isNote(tr, i) ? i : coverage(tr).owner[i]; }
// length of note `own` when dragged to step j: up to j going forward (across the loop end too),
// the most it can have when dragged past the next note, one step when dragged back before it
export function dragDur(tr, own, j) {
  const L = tr.len, gap = gapIn(tr, own), f = (j - own + L) % L;
  if (f < gap) return f + 1;
  return j > own ? gap : 1;
}
