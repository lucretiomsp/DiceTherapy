// Tuning.partch: Harry Partch's 43-tone just intonation
export const PARTCH_R = "1/1 81/80 33/32 21/20 16/15 12/11 11/10 10/9 9/8 8/7 7/6 32/27 6/5 11/9 5/4 14/11 9/7 21/16 4/3 27/20 11/8 7/5 10/7 16/11 40/27 3/2 32/21 14/9 11/7 8/5 18/11 5/3 27/16 12/7 7/4 16/9 9/5 20/11 11/6 15/8 40/21 64/33 160/81".split(" ");
export const TUNING = {
  12: { label: "12-TET", semis: Array.from({ length: 12 }, (_, i) => i) },
  24: { label: "24-TET", semis: Array.from({ length: 24 }, (_, i) => i / 2) },
  43: { label: "Partch 43 JI", semis: PARTCH_R.map(r => { const [a, b] = r.split("/").map(Number); return 12 * Math.log2(a / b); }) },
};
