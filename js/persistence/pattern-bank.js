import { loadPref, savePref } from "../core/storage.js";

export const SLOT_COUNT = 16;
const BANK_KEY = "diceTherapy.bank";

// The pattern bank: 16 slots, each the tracks of all 16 lanes (see snapshotTracks), plus the
// globals they share (scale, root, tempo, pattern length, chords: see snapshotGlobals).
// Kept in localStorage, so it is global to this browser and survives a reload.
//
// active:  the slot being played and edited
// pending: a slot waiting for the next bar line to take over, or null
export class PatternBank {
  slots = Array(SLOT_COUNT).fill(null);
  globals = null;
  active = 0;
  pending = null;

  has(i) { return !!this.slots[i]; }
  get(i) { return this.slots[i]; }
  put(i, tracks) { this.slots[i] = tracks; }

  // false when nothing was stored yet (or it could not be read)
  load() {
    try {
      const d = JSON.parse(loadPref(BANK_KEY) || "null");
      if (!d || !Array.isArray(d.slots) || !d.globals) return false;
      this.slots = Array.from({ length: SLOT_COUNT }, (_, i) => d.slots[i] || null);
      this.globals = d.globals;
      this.active = Math.min(SLOT_COUNT - 1, Math.max(0, d.active | 0));
      return this.has(this.active);
    } catch (e) { return false; }
  }

  persist() {
    savePref(BANK_KEY, JSON.stringify({ v: 1, active: this.active, globals: this.globals, slots: this.slots }));
  }
}
