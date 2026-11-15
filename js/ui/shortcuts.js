// Global keys: Space play/stop, D roll, R regenerate, Escape closes the dialog.
// actions: { togglePlay(), roll(), regenerate(), closeModal() }
export function bindShortcuts(actions) {
  const typing = e => e.target.matches("input, textarea, select");
  document.addEventListener("keydown", e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") { actions.closeModal(); return; }
    if (e.code === "Space") { e.preventDefault(); if (!e.repeat) actions.togglePlay(); }
    else if (e.key === "d" || e.key === "D") actions.roll();
    else if (e.key === "r" || e.key === "R") actions.regenerate();
  });
  document.addEventListener("keyup", e => { if (e.code === "Space" && !typing(e)) e.preventDefault(); });
}
