import { MIDI_CH } from "../midi/midi-output.js";
import { LANES, isDrum } from "../sequencer/lanes.js";
import { MAXL, MINL, coverage, effDur, isNote } from "../sequencer/timeline.js";
import { chordLabel } from "../theory/chords.js";
import { noteName } from "../theory/spelling.js";
import { $ } from "./dom.js";
import { ICON } from "./icons.js";

// each lane's colour is the CSS variable named after its key (css/tokens.css)
const color = k => (k < 0 ? "var(--mid)" : `var(--${LANES[k].key})`);
const rangeTxt = R => (R.kind === "drum" ? `${R.tag} · C3` : `${R.tag} · MIDI ${R.lo}-${R.hi}`);
const LEN_OPTS = Array.from({ length: MAXL - MINL + 1 }, (_, i) => `<option value="${i + MINL}">${i + MINL}</option>`).join("");
const GATE_OPTS = Array.from({ length: 16 }, (_, i) => { const v = 25 + i * 5; return `<option value="${v / 100}">${v}%</option>`; }).join("");

function srcHTML(tr) {
  const s = tr.src, ed = tr.edited ? " <i>· edited</i>" : "";
  if (s.kind === "world") return `<span class="tag">world</span>${tr.len} ${s.name} <i>· ${s.origin}</i>${ed}`;
  if (s.kind === "drum") return `<span class="tag">feel</span>${tr.len} ${s.name} pattern <i>· density ${s.density}%</i>${ed}`;
  return `<span class="tag">random</span>${tr.len} randomTrigsWithProbability: ${s.prob}${ed}`;
}

function laneHeadHTML(k) {
  if (k < 0) return `<span class="num">♪</span><span class="lname">Chords<small>one per bar</small></span><code class="src"></code>`;
  const R = LANES[k], nm = R.name;
  return `<span class="num">${k + 1}</span><span class="lname">${nm}<span class="ch">CH ${MIDI_CH[k] + 1}</span><small>${rangeTxt(R)}</small></span><button type="button" class="ib mute" aria-label="Mute ${nm}">M</button><button type="button" class="ib solo" aria-label="Solo ${nm}">S</button><button type="button" class="ib reroll" aria-label="Reroll the ${nm} track">${ICON.dice}</button>` +
    `<div class="lctl"><span class="grp"><span class="lbl">Steps</span><select class="sel len" aria-label="${nm} length in steps">${LEN_OPTS}</select></span>` +
    `<span class="grp"><span class="lbl">Shift</span><span class="stepper"><button type="button" class="ib sm" data-shift="-1" aria-label="${nm}: shift the pattern one step left">−</button>` +
    `<button type="button" class="ib sm" data-shift="1" aria-label="${nm}: shift the pattern one step right">+</button></span></span>` +
    `<span class="grp g"><span class="lbl">Gate</span><select class="sel gate" aria-label="${nm} gate time">${GATE_OPTS}</select></span></div><code class="src"></code>`;
}

// The sequencer: the chord ruler (k = -1) and the melody lanes in the melody pane, the drum lanes
// in the drum pane. Lane index li = k + 1 in the per-lane arrays.
export class LanesView {
  #lanes = [];         // lane element per li
  #cells = [];         // cells per li (ruler first)
  #heads = [];         // each lane's playhead step

  constructor(session, melodyHost = $("#lanes"), drumHost = $("#drumLanes")) {
    this.session = session;
    this.melodyHost = melodyHost;
    this.drumHost = drumHost;
    this.hosts = [melodyHost, drumHost];
  }

  // the pattern step the ruler shows, -1 when none
  get patternStep() { return this.#heads[0] >= 0 ? this.#heads[0] : -1; }

  render() {
    this.hosts.forEach(h => { h.textContent = ""; });
    this.#lanes = []; this.#cells = []; this.#heads = [];
    for (let k = -1; k < LANES.length; k++) {
      const lane = document.createElement("div");
      lane.className = "lane" + (k < 0 ? " ruler" : isDrum(k) ? " drum" : "");
      lane.dataset.k = k;
      lane.style.setProperty("--c", color(k));
      const head = document.createElement("div");
      head.className = "lh";
      head.innerHTML = laneHeadHTML(k);
      lane.appendChild(head);
      const grid = document.createElement("div");
      grid.className = "grid";
      lane.appendChild(grid);
      (k >= 0 && isDrum(k) ? this.drumHost : this.melodyHost).appendChild(lane);
      this.#lanes.push(lane);
      this.#cells.push([]);
      this.#heads.push(-1);
      this.fillGrid(k);
    }
  }

  // (re)build a lane's cells: the ruler shows the whole pattern with the chord of each bar,
  // a lane shows its own length, in bars of 16 and beats of 4
  fillGrid(k) {
    const lane = this.#lanes[k + 1];
    if (!lane) return;
    const s = this.session;
    const grid = lane.querySelector(".grid"), M = s.steps, n = k < 0 ? M : s.tracks[k].len;
    const labels = k < 0 ? s.harmony.map(c => chordLabel(s.ctx, c)) : null;
    grid.textContent = "";
    const cells = [];
    for (let b = 0; b < Math.ceil(n / 16); b++) {
      const bar = document.createElement("div");
      bar.className = "bar";
      if (k < 0) {
        const cap = document.createElement("div");
        cap.className = "cap";
        cap.innerHTML = M > 16 ? `Bar ${b + 1} · <b>${labels[b]}</b>` : `Chord · <b>${labels[0]}</b>`;
        bar.appendChild(cap);
      }
      for (let q = 0; q < 4 && b * 16 + q * 4 < n; q++) {
        const beat = document.createElement("div");
        beat.className = "beat";
        for (let j = 0; j < 4; j++) {
          const i = b * 16 + q * 4 + j;
          if (i >= n) break;
          const cell = document.createElement(k < 0 ? "span" : "button");
          cell.className = "cell" + (i % 4 === 0 ? " bt" : "");
          if (k >= 0) { cell.type = "button"; cell.dataset.i = i; }
          beat.appendChild(cell);
          cells.push(cell);
        }
        bar.appendChild(beat);
      }
      grid.appendChild(bar);
    }
    this.#cells[k + 1] = cells;
    this.#heads[k + 1] = -1;
    this.updateLane(k);
  }

  updateLane(k) {
    const cells = this.#cells[k + 1];
    if (!cells || !cells.length) return;
    const s = this.session, lane = this.#lanes[k + 1], M = s.steps;
    if (k < 0) {
      cells.forEach((c, i) => c.classList.toggle("on", i % 4 === 0));
      const bars = Math.ceil(M / 16);
      lane.querySelector(".src").innerHTML = `<span class="tag">pattern</span>${M} steps · ${bars} bar${bars > 1 ? "s" : ""}`;
      return;
    }
    const tr = s.tracks[k], R = LANES[k], drum = isDrum(k), cov = coverage(tr);
    const label = n => (drum ? "hit" : noteName(n.m, n.d.sp));
    cells.forEach((c, i) => {
      const on = isNote(tr, i), own = on ? -1 : cov.owner[i], out = i >= M ? " (past the pattern end, not played)" : "";
      c.classList.toggle("on", on);
      c.classList.toggle("tail", own >= 0);
      c.classList.toggle("end", own >= 0 && cov.end[i]);
      c.classList.toggle("out", i >= M);
      if (on) {
        const n = tr.notes[i], nm = label(n), d = effDur(tr, i);
        const ct = drum ? 0 : n.d.sp.cents;
        c.innerHTML = drum ? "" : `<span class="nn">${nm}</span>${ct ? `<span class="ct">${ct > 0 ? "+" : "−"}${Math.abs(ct)}¢</span>` : ""}`;
        c.setAttribute("aria-label", `${R.name} step ${i + 1}: ${nm}, ${d} step${d > 1 ? "s" : ""}${out}`);
      } else if (own >= 0) {
        c.innerHTML = "";
        c.setAttribute("aria-label", `${R.name} step ${i + 1}: ${label(tr.notes[own])} held${out}`);
      } else {
        c.innerHTML = i % 4 === 0 ? `<span class="st">${i + 1}</span>` : "";
        c.setAttribute("aria-label", `${R.name} step ${i + 1}: off${out}`);
      }
    });
    this.#paintMix(k, lane);
    lane.querySelector(".src").innerHTML = srcHTML(tr);
    lane.querySelector(".sel.len").value = String(tr.len);
    lane.querySelector(".sel.gate").value = String(tr.gate);
  }

  // Mute and solo touch every lane at once: repaint just the M and S keys and the silenced look.
  updateMix() {
    for (let k = 0; k < LANES.length; k++) this.#paintMix(k, this.#lanes[k + 1]);
  }
  // A lane that is not heard (muted, or left out by a solo) goes purple.
  #paintMix(k, lane) {
    const s = this.session, tr = s.tracks[k];
    lane.classList.toggle("muted", !s.isAudible(k));
    lane.querySelector(".mute").setAttribute("aria-pressed", String(tr.muted));
    lane.querySelector(".solo").setAttribute("aria-pressed", String(!!tr.solo));
  }

  // g: pattern step, -1 clears. The ruler shows g, each lane its own step g % len.
  setPlayhead(g) {
    const s = this.session;
    this.#cells.forEach((cells, li) => {
      const old = this.#heads[li];
      if (old >= 0 && cells[old]) cells[old].classList.remove("now");
      const i = g >= 0 && g < s.steps ? (li === 0 ? g : g % s.tracks[li - 1].len) : -1;
      this.#heads[li] = i;
      if (i >= 0 && cells[i]) cells[i].classList.add("now");
    });
  }
}
