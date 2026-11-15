export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16l14-8z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" fill="currentColor"/></svg>',
  reroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 11V6h14"/><path d="M15 3l3 3-3 3"/><path d="M20 13v5H6"/><path d="M9 15l-3 3 3 3"/></svg>',
};

// a plain square face with square pips
const PIPS = [["tl", 28, 28], ["tr", 72, 28], ["ml", 28, 50], ["c", 50, 50], ["mr", 72, 50], ["bl", 28, 72], ["br", 72, 72]];
export const FACES = { 1: ["c"], 2: ["tl", "br"], 3: ["tl", "c", "br"], 4: ["tl", "tr", "bl", "br"], 5: ["tl", "tr", "c", "bl", "br"], 6: ["tl", "tr", "ml", "mr", "bl", "br"] };
export const dieSVG = () => `<svg class="dface" viewBox="0 0 100 100" aria-hidden="true"><rect class="f" x="2" y="2" width="96" height="96"/><g class="p">${PIPS.map(([n, x, y]) => `<rect data-p="${n}" x="${x - 8.5}" y="${y - 8.5}" width="17" height="17"/>`).join("")}</g></svg>`;
