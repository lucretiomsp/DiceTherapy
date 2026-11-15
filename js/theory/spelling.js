import { mod12 } from "../core/util.js";

// Note spelling: letter + accidental (quarter tones included) and cents for JI.
export const LET = ["C", "D", "E", "F", "G", "A", "B"];
export const NAT = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1.5": "♭↓", "-1": "♭", "-0.5": "↓", "0": "", "0.5": "↑", "1": "♯", "1.5": "♯↑", "2": "𝄪" };
export const accStr = a => ACC[String(Math.round(a * 2) / 2 || 0)] ?? "";
const normAcc = a => ((a % 12) + 18) % 12 - 6;
const wrap7 = L => ((L % 7) + 7) % 7;

// Letter offset for an interval in a non-heptatonic scale (S = set of semitone classes).
function letterOffset(iv, S) {
  switch (iv) {
    case 0: return 0;
    case 1: case 2: return 1;
    case 3: return S.has(4) && !S.has(2) ? 1 : 2;
    case 4: return 2;
    case 5: return 3;
    case 6: return S.has(5) ? 4 : 3;
    case 7: return 4;
    case 8: return S.has(7) || S.has(9) ? 5 : 4;
    case 9: return 5;
    default: return 6;
  }
}
function spellAt(target, Lp, strict) {
  let L = wrap7(Lp), acc = normAcc(target - NAT[L]);
  if (!strict && Math.abs(acc) > 1) {
    for (const d of [-1, 1]) {
      const L2 = wrap7(Lp + d), a2 = normAcc(target - NAT[L2]);
      if (Math.abs(a2) < Math.abs(acc)) { L = L2; acc = a2; }
    }
  }
  return { L, acc };
}
// strict: one letter per degree (7-note scales). JI notes are spelled by the nearest
// 12-TET pitch and keep their deviation in cents.
export function spellList(semis, rootPc, root, ppo, strict) {
  const ji = ppo === 43;
  const vals = semis.map(s => (ji ? Math.round(s) : s));
  const S = new Set(vals.map(v => mod12(Math.floor(v + 1e-9))));
  return semis.map((s, i) => {
    const v = vals[i];
    const Lp = root.L + (strict ? i : letterOffset(mod12(Math.floor(v + 1e-9)), S));
    const sp = spellAt(rootPc + v, Lp, strict);
    sp.cents = ji ? Math.round((s - v) * 100) : 0;
    return sp;
  });
}
// candidate spellings [letter, accidental] for each pitch class of the root
export const ROOTS = { 0: [[0, 0]], 1: [[0, 1], [1, -1]], 2: [[1, 0]], 3: [[2, -1], [1, 1]], 4: [[2, 0]], 5: [[3, 0]], 6: [[3, 1], [4, -1]], 7: [[4, 0]], 8: [[4, 1], [5, -1]], 9: [[5, 0]], 10: [[6, -1], [5, 1]], 11: [[6, 0]] };
export const pcName = sp => LET[sp.L] + accStr(sp.acc);
export function noteName(m, sp) {
  const oct = Math.round((m - sp.cents / 100 - sp.acc - NAT[sp.L]) / 12) - 1;
  return LET[sp.L] + accStr(sp.acc) + oct;
}
// ASCII form for Coypu comments
export const asciiName = s => s.replace(/♯/g, "#").replace(/♭/g, "b").replace(/↑/g, "+").replace(/↓/g, "-");
