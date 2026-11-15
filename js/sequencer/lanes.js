import { DRUMS } from "./drums.js";
import { ROLE } from "./roles.js";

// All lanes in one list, as the session, the mixer, MIDI and the UI index them:
// 0..7 melody lanes (ROLE), 8..15 drum lanes (DRUMS). Melody lanes come first so they are
// generated first, and so a melody lane can only listen to melody lanes before it.
export const LANES = [...ROLE.map(R => ({ ...R, kind: "synth" })), ...DRUMS];
export const FIRST_DRUM = ROLE.length;
export const isDrum = k => k >= FIRST_DRUM;
