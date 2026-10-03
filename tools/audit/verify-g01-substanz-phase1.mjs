// Gegenpruefung G01 (Substanz): gekoppeltes Abschnitt-1-Modell (kompetenzbegrenzt).
// Kompetenz C = S(Rang) * T(t) * k: S aus den Skillpunkten (1 SP je 3 Rang), gemessen
// S ~ Rang^a mit a = 0,42-0,57 (BN2.1, BN4.3, BN9.3, verify-g01-substanz-ertrag/decomp),
// T = exp(gs * t) aus Erfahrung und Kleinaugs, gemessen gs = 0,032-0,08/h (BN2.1 0,032+0,010).
// Rangrate R = R0 * (C/C0)^beta; beta = 1 bei fester Stufe (p ~ C), 1,25 wenn die Stufe frei
// mitwandert (Rang/Aktion ~ diff^2,25, Zeit ~ diff), kleiner wenn Kappung p=1 greift.
// Geeicht auf BN2.1 22:17: Rang 7178, gemessene Rate 435 Rang/h (20:17->21:17: 1036 in
// 2,65 eff. h = 391/h; 21:17->22:17: 435/h ohne Bonuszeit).
// Ende des Abschnitts 1: Rang 25.000-30.000 (BN4.3 Explosion ab ~30k / 31,5 h,
// BN9.3 ab ~24k / 41,4 h). Ausgabe: Stunden bis Rang 25k ohne/mit Gang-Faktor k.
const R0 = 435, rank0 = 7178;
function run({ k = 1, a = 0.5, gs = 0.042, beta = 1, target = 25000, tStart = 0.5, dt = 0.01 }) {
  let r = rank0, t = 0;
  while (r < target && t < 200) {
    const kk = t >= tStart ? k : 1;           // Gang-Runde nach Einbau + Wiederaufbau
    const lost = (k > 1 && t < tStart) ? 0 : 1; // Wiederaufbau: kein Rang
    const C = Math.pow(r / rank0, a) * Math.exp(gs * t) * kk;
    r += lost * R0 * Math.pow(C, beta) * dt;
    t += dt;
  }
  return t;
}
console.log("a | gs | beta | k | h bis 25k ohne | mit | Ersparnis | h bis 30k Ersparnis");
for (const a of [0.42, 0.57]) for (const gs of [0.042, 0.08]) for (const beta of [0.8, 1.0, 1.25]) for (const k of [2.0, 2.85, 3.8]) {
  const b = run({ a, gs, beta }), g = run({ a, gs, beta, k });
  const b3 = run({ a, gs, beta, target: 30000 }), g3 = run({ a, gs, beta, k, target: 30000 });
  console.log(`${a} | ${gs} | ${beta} | ${k} | ${b.toFixed(1)} | ${g.toFixed(1)} | ${(b - g).toFixed(1)} | ${(b3 - g3).toFixed(1)}`);
}
