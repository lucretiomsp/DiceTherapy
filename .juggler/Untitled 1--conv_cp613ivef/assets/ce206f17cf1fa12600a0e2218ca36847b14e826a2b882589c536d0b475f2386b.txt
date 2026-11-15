import { dragDur, effDur, ownerOf } from "../sequencer/timeline.js";

// Input controller for the sequencer lanes (event delegation on the lanes host).
// Step edits go straight to the session and redraw one lane; everything that reaches beyond the
// lanes (mute, reroll, lane length) is handed to `actions`.
//
// actions: { toggleMute(k), rerollTrack(k, button), setTrackLen(k, n), setGate(k, v) }
export class LaneInput {
  #drag = null;        // pointer press on a step, becomes a duration drag once it moves
  #lastPtr = 0;        // when and where the last pointer tap ended, to drop the click that follows
  #lastPtrCell = null;

  constructor({ session, view, actions }) {
    this.session = session;
    this.view = view;
    this.actions = actions;
    this.host = view.host;
  }

  bind() {
    const host = this.host;
    host.addEventListener("click", this.#onClick);
    host.addEventListener("change", this.#onChange);
    // Tap a step to switch it. Press on a note (or a step it holds) and drag to set its length.
    host.addEventListener("pointerdown", this.#onPointerDown);
    addEventListener("pointermove", this.#onPointerMove);
    addEventListener("pointerup", this.#onPointerUp);
    addEventListener("pointercancel", e => { if (this.#drag && e.pointerId === this.#drag.id) this.#drag = null; });
    host.addEventListener("contextmenu", e => { if (e.target.closest("button.cell")) e.preventDefault(); });
    host.addEventListener("keydown", this.#onKeyDown);
  }

  #toggleStep(k, i) {
    this.session.toggleStep(k, i);
    this.view.updateLane(k);
  }
  #setDur(k, own, d) {
    if (this.session.setDur(k, own, d)) this.view.updateLane(k);
  }

  #onClick = e => {
    const lane = e.target.closest(".lane");
    if (!lane) return;
    const k = +lane.dataset.k;
    if (e.target.closest(".mute")) { this.actions.toggleMute(k); return; }
    const rr = e.target.closest(".reroll");
    if (rr) { this.actions.rerollTrack(k, rr); return; }
    const lb = e.target.closest("[data-len]");
    if (lb && k >= 0) { this.actions.setTrackLen(k, this.session.tracks[k].len + +lb.dataset.len); return; }
    // steps: pointers act on pointerup below; a click with detail 0 comes from the keyboard
    const cell = e.target.closest("button.cell");
    if (cell && k >= 0 && e.detail === 0 && !(cell === this.#lastPtrCell && performance.now() - this.#lastPtr < 500)) this.#toggleStep(k, +cell.dataset.i);
  };

  #onChange = e => {
    const lane = e.target.closest(".lane");
    if (!lane || +lane.dataset.k < 0) return;
    const k = +lane.dataset.k;
    if (e.target.matches(".sel.len")) this.actions.setTrackLen(k, +e.target.value);
    else if (e.target.matches(".sel.gate")) this.actions.setGate(k, +e.target.value);
  };

  #cellAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest("#lanes button.cell") : null;
  }

  #onPointerDown = e => {
    if (e.button > 0) return;
    const cell = e.target.closest("button.cell");
    if (!cell) return;
    const k = +cell.closest(".lane").dataset.k, i = +cell.dataset.i;
    this.#drag = { k, i, cell, own: ownerOf(this.session.tracks[k], i), id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  #onPointerMove = e => {
    const drag = this.#drag;
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
      if (drag.own < 0) { this.#drag = null; return; }                 // a swipe from an empty step is not ours
      drag.moved = true;
    }
    const cell = this.#cellAt(e.clientX, e.clientY);
    if (!cell || +cell.closest(".lane").dataset.k !== drag.k) return;
    const tr = this.session.tracks[drag.k];
    this.#setDur(drag.k, drag.own, dragDur(tr, drag.own, +cell.dataset.i));
  };

  #onPointerUp = e => {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = null;
    this.#lastPtr = performance.now();
    this.#lastPtrCell = d.cell;
    if (!d.moved) this.#toggleStep(d.k, d.i);
  };

  // Shift + arrows on a focused note or held step: one step longer or shorter
  #onKeyDown = e => {
    if (!e.shiftKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const cell = e.target.closest("button.cell");
    if (!cell) return;
    const k = +cell.closest(".lane").dataset.k, tr = this.session.tracks[k], own = ownerOf(tr, +cell.dataset.i);
    if (own < 0) return;
    e.preventDefault();
    this.#setDur(k, own, effDur(tr, own) + (e.key === "ArrowRight" ? 1 : -1));
  };
}
