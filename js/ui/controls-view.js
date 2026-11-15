import { WORLD } from "../data/rhythms.js";
import { MASTERS } from "../sequencer/timeline.js";
import { $, $$, restartAnimation } from "./dom.js";
import { ICON } from "./icons.js";

// Pattern settings (length, tempo, rhythm source, microtonal) and the transport buttons.
// Reads the session to show it; user input goes to `actions`.
//
// actions: { setMaster(n), setBpm(bpm), setRnd(pct), setMicro(on), togglePlay(), regenerate(), copyCoypu() }
export class ControlsView {
  constructor(session) {
    this.session = session;
    this.regenBtn = $("#regen");
    this.regenBtn.innerHTML = `${ICON.dice}<span>Regenerate</span>`;
  }

  bind(actions) {
    $("#play").addEventListener("click", actions.togglePlay);
    this.regenBtn.addEventListener("click", actions.regenerate);
    $("#copy").addEventListener("click", actions.copyCoypu);
    $$(".seg button").forEach(b => b.addEventListener("click", () => actions.setMaster(+b.dataset.steps)));
    $("#bpm").addEventListener("input", e => actions.setBpm(+e.target.value));
    $("#rnd").addEventListener("input", e => actions.setRnd(+e.target.value));
    $("#micro").addEventListener("change", e => actions.setMicro(e.target.checked));
  }

  sync() {
    const s = this.session;
    MASTERS.forEach(n => $("#s" + n).setAttribute("aria-checked", String(s.steps === n)));
    $("#bpm").value = s.bpm;
    this.showBpm();
    $("#rnd").value = s.rnd;
    $("#rndOut").textContent = `${s.rnd}% random · ${100 - s.rnd}% world`;
    $("#micro").checked = s.micro;
    const n = s.availableScales().length;
    $("#meta").innerHTML = `<span>${n} SC scales ·</span> <span>${WORLD.length} Coypu rhythms</span>`;
  }

  showBpm() { $("#bpmOut").textContent = `${this.session.bpm} BPM`; }

  setPlaying(playing) {
    const b = $("#play");
    b.setAttribute("aria-pressed", String(playing));
    b.innerHTML = playing ? `${ICON.stop}<span>Stop</span>` : `${ICON.play}<span>Play</span>`;
  }

  spinRegen() { restartAnimation(this.regenBtn, "spin"); }
}
