import { $ } from "./dom.js";

// The MIDI out / Clock out menus and the local-synths switch. Observes the MidiOutput and redraws
// from it on every change; user choices go back to it.
export class MidiPanel {
  constructor(midi) {
    this.midi = midi;
    this.outSel = $("#midiOut");
    this.clockSel = $("#clockOut");
    this.local = $("#local");
    this.localRow = $("#localRow");
  }

  bind() {
    const midi = this.midi;
    midi.on("change", () => this.render());
    if (!midi.supported) { this.render(); return; }
    [this.outSel, this.clockSel].forEach((sel, i) => {
      sel.addEventListener("change", () => {
        if (sel.value === "?") { midi.connect(i ? "clock" : "out"); return; }
        const port = midi.portById(sel.value);
        if (i) midi.setClock(port, true); else midi.setOut(port, true);
      });
    });
    this.local.addEventListener("change", e => midi.setLocal(e.target.checked));
    this.render();
  }

  render() {
    const midi = this.midi, sels = [[this.outSel, midi.out], [this.clockSel, midi.sync]];
    if (!midi.supported) {
      sels.forEach(([sel]) => { sel.replaceChildren(new Option("Not available in this browser", "")); sel.disabled = true; });
      return;
    }
    const outs = midi.outputs;
    for (const [sel, port] of sels) {
      if (!midi.access) sel.replaceChildren(new Option("Off", ""), new Option("Connect…", "?"));
      else {
        const none = new Option("No MIDI outputs found", "-");
        none.disabled = true;
        sel.replaceChildren(new Option("Off", ""), ...outs.map(o => new Option(o.name, o.id)), ...(outs.length ? [] : [none]));
      }
      sel.value = port ? port.id : "";
    }
    this.local.checked = midi.local;
    this.localRow.hidden = !midi.out;
  }
}
