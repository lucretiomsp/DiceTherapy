import { $ } from "./dom.js";

// The Coypu code dialog, for when the clipboard is not available.
export class CodeModal {
  constructor() {
    this.el = $("#modal");
    this.text = $("#mtext");
  }

  bind() {
    $("#mclose").addEventListener("click", () => this.close());
    $("#msel").addEventListener("click", () => this.#selectAll());
    this.el.addEventListener("click", e => { if (e.target.id === "modal") this.close(); });
  }

  open(txt) {
    this.text.value = txt;
    this.el.classList.add("open");
    this.#selectAll();
  }

  close() { this.el.classList.remove("open"); }

  #selectAll() { this.text.focus(); this.text.select(); }
}
