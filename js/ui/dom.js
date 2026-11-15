export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

// replay a one-shot CSS animation class
export function restartAnimation(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
