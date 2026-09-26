// Zeit von Level 1 bis Ziel, wenn die Erfahrungsrate proportional zu (L+50) ist.
// Eichung: 17:04 -> 17:19 (900 s Spielzeit, Spielstaende), E 3.62e7 -> 1.4237e8, L 2557 -> 2871.
const skill = (E, m) => Math.max(Math.floor(m * (32 * Math.log(E + 534.6) - 200)), 1);
const E0 = 3.62e7, E1 = 142367274.77, m0 = 7.16552645088455;
// c so bestimmen, dass die Simulation die 900 s trifft
function sim(m, c, Estart, ziel, dtMax = 1e9) {
  let E = Estart, t = 0; const dt = 5;
  while (skill(E, m) < ziel && t < dtMax) { E += c * (skill(E, m) + 50) * dt; t += dt; }
  return t;
}
let lo = 1, hi = 1000;
for (let i = 0; i < 60; i++) { const c = (lo + hi) / 2; const E = (() => { let E = E0, t = 0; while (t < 900) { E += c * (skill(E, m0) + 50) * 5; t += 5; } return E; })(); if (E > E1) hi = c; else lo = c; }
const c0 = (lo + hi) / 2; console.log("c (exp/s je Level) =", c0.toFixed(2), "bei hacking_exp 6.96");
const cNeu = c0 * (6.9613827 * 1.12 * 1.15 * Math.pow(1.01, 6)) / 6.9613827; // wartende Stuecke
for (const m of [7.17, 8, 9.04, 10, 11, 12]) {
  const T = sim(m, cNeu, 0, 4500);
  console.log("m", m, "Zeit 1 -> 4500:", (T / 3600).toFixed(2), "h", "  (Ziel 3000: " + (sim(m, cNeu, 0, 3000) / 3600).toFixed(2) + " h)");
}
