// Small numeric and random helpers shared by every layer. No DOM, no state.

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const mod12 = x => ((x % 12) + 12) % 12;
export const near = (a, b) => Math.abs(a - b) < 1e-6;

// weighted pick; falls back to a uniform pick when no weight is positive
export function wpick(items, weights) {
  let sum = 0;
  for (const w of weights) sum += w;
  if (!(sum > 0)) return pick(items);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
