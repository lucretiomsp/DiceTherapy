import { SLOT_COUNT } from "../persistence/pattern-bank.js";
import { $ } from "./dom.js";

// The 4×4 pattern slots and the Save key in the left pane.
// A slot is lit when active, solid when it holds a pattern, outlined when empty, and blinks
// while it waits for the next bar line.
//
// actions: { selectSlot(i), saveSlot() }
export class SlotsView {
  constructor(bank) {
    this.bank = bank;
    this.grid = $("#slotGrid");
    this.grid.innerHTML = Array.from({ length: SLOT_COUNT }, (_, i) =>
      `<button type="button" class="slot" data-slot="${i}" aria-label="Pattern ${i + 1}">${i + 1}</button>`).join("");
  }

  bind(actions) {
    this.grid.addEventListener("click", e => {
      const b = e.target.closest("[data-slot]");
      if (b) actions.selectSlot(+b.dataset.slot);
    });
    $("#slotSave").addEventListener("click", actions.saveSlot);
  }

  render() {
    const { bank } = this;
    this.grid.querySelectorAll("[data-slot]").forEach(b => {
      const i = +b.dataset.slot, active = i === bank.active;
      b.classList.toggle("filled", bank.has(i));
      b.classList.toggle("queued", i === bank.pending);
      b.setAttribute("aria-pressed", String(active));
      b.setAttribute("aria-label", `Pattern ${i + 1}${active ? ", playing" : bank.has(i) ? "" : ", empty"}${i === bank.pending ? ", next" : ""}`);
    });
    $("#slotInfo").textContent = bank.pending != null ? `→ ${bank.pending + 1} at the next bar` : `Pattern ${bank.active + 1}`;
  }
}
