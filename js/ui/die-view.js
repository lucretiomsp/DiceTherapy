import { $, $$, prefersReducedMotion, restartAnimation } from "./dom.js";
import { FACES, dieSVG } from "./icons.js";

const randomFace = () => 1 + Math.floor(Math.random() * 6);

// The two dice buttons (hero and transport bar): faces and the tumble.
export class DieView {
  #rolling = false;

  constructor(selectors = ["#die", "#die2"]) {
    this.els = selectors.map(s => $(s));
    this.els.forEach(el => { el.innerHTML = dieSVG(); });
  }

  onClick(fn) { this.els.forEach(el => el.addEventListener("click", fn)); }

  setFace(n) {
    $$(".dface [data-p]").forEach(c => { c.style.display = FACES[n].includes(c.dataset.p) ? "" : "none"; });
  }

  // Tumble through a few faces, then call `onLanded` and show the final face. Ignored mid-roll.
  roll(onLanded) {
    if (this.#rolling) return;
    this.#rolling = true;
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) { /* not supported */ }
    const finish = () => { onLanded(); this.setFace(randomFace()); this.#rolling = false; };
    if (prefersReducedMotion()) { finish(); return; }
    this.els.forEach(el => restartAnimation(el, "rolling"));
    let n = 0;
    const iv = setInterval(() => {
      this.setFace(randomFace());
      if (++n >= 7) { clearInterval(iv); finish(); }
    }, 75);
  }
}
