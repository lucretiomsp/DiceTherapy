// Shared by the scheduler and the MIDI output.
export const LOOKAHEAD = .12;        // seconds scheduled ahead of currentTime
export const TICK_MS = 25;           // how often the scheduler wakes up
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
