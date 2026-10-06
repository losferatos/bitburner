// Hebel-Vorlage: BN3.1 Restlaufzeit ab einem Live-Stand (Rang R, Daedalus-Chance p0, Bonus-Vorrat in BB-h), GESCHAETZT.
// Gleiche Bausteine wie lauf.mjs; Bonuszeit: Bladeburner.ts:1377-1380 (bis 5 BB-Sekunden je Echtsekunde).
// Aufruf: node bn31.mjs <Rang> <p0 Daedalus> <Bonus BB-h> <Uhrzeit hh:mm>
const [R0, p0, bonus, uhr] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const res = [];
for (const e of [1.0, 1.2, 1.4]) for (const b of [1.0, 1.35, 1.7]) for (const thr of [0.35, 0.40]) {
  const c = 84000 / Math.pow(152000, e); let R = R0, t = 0; const dt = 0.002;
  for (;;) { const p = p0 * Math.pow(R / R0, b); if (R >= 400000 && p >= thr) { t += 0.15 + 0.35 / Math.min(1, p); break; } R += c * Math.pow(R, e) * dt; t += dt; }
  const real = t <= bonus ? t / 5 : bonus / 5 + (t - bonus);
  res.push({ e, b, thr, bb: t, real });
}
res.sort((a, b) => a.real - b.real);
const [hh, mm] = uhr.split(":").map(Number); const at = (h) => { const m = Math.round(hh * 60 + mm + h * 60); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const q = (f) => res[Math.min(res.length - 1, Math.floor(f * res.length))];
console.log(`ab ${uhr}: Rest ${res[0].bb.toFixed(1)}-${res.at(-1).bb.toFixed(1)} BB-h, Echtzeit ${res[0].real.toFixed(1)}-${res.at(-1).real.toFixed(1)} h -> Ausgang ${at(res[0].real)} .. Median ${at(q(0.5).real)} .. ${at(res.at(-1).real)}`);
