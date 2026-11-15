import { $ } from "./dom.js";

// A short status message above the transport.
export class Toast {
  #timer = 0;
  constructor(el = $("#toast")) { this.el = el; }

  show(msg) {
    this.el.textContent = msg;
    this.el.classList.add("show");
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.el.classList.remove("show"), 1700);
  }
}
