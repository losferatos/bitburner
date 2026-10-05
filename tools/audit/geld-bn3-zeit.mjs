// Audit geldwert BN3 (05.10.2026): Laufzeitmodell V2 - Rangrate als Funktion von Rang und Competence-Faktor K.
//   dR/dt = A * (R/24000)^a * K^beta      (R >= 4567; davor gemessene BN2.3-Kurve, K wirkt dort nicht)
// A, a: Ausgleich auf BN2.3 Zyklus 1 (K = 1, gemessen 6,8 -> 12,4 h, aktueller Bot, gleiche Mults 1,43 wie BN3).
// beta: so, dass BN2.3 nach dem Einbau (K = 4,782, geld-bn3-kist.mjs) Rang 400k zur gemessenen Zeit erreicht.
// Gegenprobe: BN2.1 (aelterer Bot) Zyklus 2 und Endspurt.
// Ausgang = Rang 400.000 + 0,2 h Rest-Black-Ops (BN2.3: 400k kurz vor dem Sprung). Nur lesen.
const OBS = [[4.8, 2085], [5.8, 2926], [6.8, 4567], [7.8, 6051], [8.8, 9899], [9.8, 15512], [10.8, 19053], [11.8, 23399], [12.4, 28767]];
const rate = (R, K, p) => p.A * Math.pow(R / 24000, p.a) * Math.pow(K, p.beta);
function integrate(R0, t0, t1, K, p, dt = 0.005) { let R = R0, t = t0; while (t < t1 - 1e-9) { R += rate(R, K, p) * dt; t += dt; } return R; }
function timeTo(R0, t0, target, K, p, dt = 0.005, tmax = 300) { let R = R0, t = t0; while (R < target && t < tmax) { R += rate(R, K, p) * dt; t += dt; } return t; }
// --- Fit A, a ---
let best = null;
for (let a = 0.2; a <= 1.0001; a += 0.01) for (let A = 2000; A <= 12000; A += 25) {
  const p = { A, a, beta: 1 }; let err = 0, R = 4567, t = 6.8;
  for (const [th, Ro] of OBS.filter(o => o[0] > 6.8)) { R = integrate(R, t, th, 1, p); t = th; err += Math.log(R / Ro) ** 2; }
  if (!best || err < best.err) best = { A, a, err };
}
const P = { A: best.A, a: best.a };
console.log(`Eichung 1 (BN2.3 Zyklus 1, K=1): A=${P.A} Rang/h bei 24k, a=${P.a.toFixed(2)}, RMS ln-Fehler ${Math.sqrt(best.err / 6).toFixed(3)}`);
{ let R = 4567, t = 6.8; const row = []; for (const [th, Ro] of OBS.filter(o => o[0] > 6.8)) { R = integrate(R, t, th, 1, { ...P, beta: 1 }); t = th; row.push(`${th}h ${Math.round(R)}/${Ro}`); } console.log("   Modell/gemessen: " + row.join(", ")); }
// --- beta aus BN2.3 nach Einbau: 12,4 h Rang 28.767, 0,4 h Wiederaufbau mit K=1, dann K=4,782; gemessen 400k bei ~14,3 h ---
const fitBeta = (K, R0, t0, rebuild, tObs400) => { let lo = 0, hi = 4; for (let i = 0; i < 50; i++) { const b = (lo + hi) / 2; const p = { ...P, beta: b };
  const Rr = integrate(R0, t0, t0 + rebuild, 1, p); const t = timeTo(Rr, t0 + rebuild, 400000, K, p); if (t > tObs400) lo = b; else hi = b; } return (lo + hi) / 2; };
// BN2.3: 14,2 h Rang 246.737, 14,5 h 458.657 -> 400k bei ~14,4 h (log-linear)
const t400 = 14.2 + 0.3 * Math.log(400000 / 246737) / Math.log(458657 / 246737);
const beta = fitBeta(4.782, 28767, 12.4, 0.4, t400);
console.log(`Eichung 2 (BN2.3 nach Einbau, K=4,782): 400k gemessen bei ${t400.toFixed(2)} h -> beta = ${beta.toFixed(2)}`);
// Gegenprobe BN2.1 (aelterer Bot): Zyklus 2 K=1,189 ab 4.667 @14,6 h -> gemessen 49.994 @26,4 h; danach K=1,189*2,012 ab 50k @26,4 -> 488.516 @29,9
for (const b of [1.0, beta]) {
  const p = { ...P, beta: b };
  const R264 = integrate(4667, 14.6, 26.4, 1.189, p);
  const tEnd = timeTo(49994, 26.4 + 0.4, 400000, 1.189 * 2.012, p);
  console.log(`Gegenprobe BN2.1 beta=${b.toFixed(2)}: Rang @26,4 h Modell ${Math.round(R264)} / gemessen 49.994; 400k Modell @${tEnd.toFixed(1)} h / gemessen ~29,7 h`);
}
export { P, beta, rate, integrate, timeTo };
