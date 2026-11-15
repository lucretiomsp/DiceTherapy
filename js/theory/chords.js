import { mod12, wpick } from "../core/util.js";
import { cons } from "./consonance.js";
import { pcName } from "./spelling.js";

// The chord on degree j of the scale: root, third and fifth (the most consonant ones in
// non-heptatonic scales), and the set of degrees that count as chord tones.
export function chordOn(ctx, j) {
  const P = ctx.asc, n = P.length, r = P[j];
  let t = null, f = null;
  if (n === 7) { t = (j + 2) % 7; f = (j + 4) % 7; }
  else {
    let wt = 0, wf = 0;
    for (let k = 0; k < n; k++) {
      if (k === j) continue;
      const iv = mod12(P[k] - r), c = cons(iv);
      if (iv > 2.6 && iv < 4.6 && c > wt) { wt = c; t = k; }
      if (iv > 5.9 && iv < 8.1 && c > wf) { wf = c; f = k; }
    }
  }
  const ivOf = k => (k == null ? null : mod12(P[k] - r));
  const tones = new Set([j, ...[t, f].filter(k => k != null && cons(ivOf(k)) >= .3)]);
  return { j, r, iv3: ivOf(t), iv5: ivOf(f), tones };
}

export function chordLabel(ctx, ch) {
  const sp = ctx.degs[ch.j].sp, name = pcName(sp);
  if (ctx.scale.ppo === 43) return name + (sp.cents ? `${sp.cents > 0 ? "+" : "−"}${Math.abs(sp.cents)}¢` : "");
  if (ctx.scale.ppo !== 12) return name;
  const a = ch.iv3, b = ch.iv5;
  if (a === 3) return name + (b === 6 ? "°" : "m");
  if (a === 4) return name + (b === 8 ? "+" : "");
  if (a === 2) return name + "sus2";
  if (a === 5) return name + "sus4";
  return name + (b === 7 ? "5" : "");
}

// A progression as text: repeats are folded ("Am ▸ F ×2").
export function harmonyText(ctx, h) {
  const labels = h.map(c => chordLabel(ctx, c)), n = labels.length;
  if (n === 1) return labels[0];
  if (h.every(c => c.j === h[0].j)) return `${labels[0]} ${n === 2 ? "both bars" : "all bars"}`;
  for (const P of [2, 4]) {
    if (P < n && n % P === 0 && h.every((c, b) => c.j === h[b % P].j)) return `${labels.slice(0, P).join(" ▸ ")} ×${n / P}`;
  }
  return labels.join(" ▸ ");
}

// Root motion preference from the tonic: IV, V, bVII, bVI, vi, bIII...
const MOTION = [[5, 1], [7, .9], [10, .8], [8, .75], [9, .6], [3, .6], [2, .45], [1, .4], [4, .35], [11, .15], [6, .08]];
function motionW(iv) {
  let b = .05;
  for (const [a, w] of MOTION) { let d = Math.abs(iv - a); d = Math.min(d, 12 - d); b = Math.max(b, w * Math.exp(-d * d * 4)); }
  return b;
}
function pickChordDegree(ctx) {
  const idx = ctx.asc.map((_, j) => j);
  const t0 = ctx.asc[ctx.tonic];
  const ws = ctx.asc.map((s, j) => {
    if (j === ctx.tonic) return 0;
    const ch = chordOn(ctx, j);
    const q5 = ch.iv5 == null ? .15 : cons(ch.iv5);
    const q3 = ch.iv3 == null ? .5 : .55 + .45 * cons(ch.iv3);
    return motionW(mod12(s - t0)) * q5 * q3;
  });
  return wpick(idx, ws);
}
// One chord per bar. Up to 4 bars the progression is new; 8 bars repeat it, sometimes with a
// different last bar as a turnaround.
export function makeHarmony(ctx, bars) {
  const T = chordOn(ctx, ctx.tonic);
  if (bars <= 1) return [T];
  const P = Math.min(bars, 4), phrase = [T];
  while (phrase.length < P) phrase.push(Math.random() < (P === 2 ? .3 : .15) ? T : chordOn(ctx, pickChordDegree(ctx)));
  const h = Array.from({ length: bars }, (_, b) => phrase[b % P]);
  if (bars > P && Math.random() < .5) h[bars - 1] = chordOn(ctx, pickChordDegree(ctx));
  return h;
}
