// Gegenpruefung G03: B-Teil von INFRA-1 in BN2.1 (W1): 21 weitere Ausbauten 128->256 nach dem
// A-Teil im 40-s-Takt, Geldregel 2 x Kosten <= Geld (Ruecklage 0). Ertrag je Intervall gemessen,
// Faktor fuer den Grenzertrag 1,0 / 0,6 (Durchschnitt gilt als Grenzertrag / Abschlag).
// Aufruf: node tools/audit/verify-g03-b256.mjs
import { loadAll, cloudCost, interp, fmt } from "./verify-g03-lib.mjs";
const { saves } = loadAll();
const ws = saves.filter((s) => s.lauf === 1 && s.t <= new Date(2026, 9, 3, 10, 0).getTime()).sort((a, b) => a.t - b.t);
const tEnd = ws[ws.length - 1].t;
const tStartNode = ws[0].t - ws[0].tBN * 3.6e6;
const mp = [{ t: tStartNode, v: 0 }, ...ws.map((s) => ({ t: s.t, v: s.money }))];
const ys = [];
for (let i = 1; i < ws.length; i++) {
  const a = ws[i - 1], b = ws[i];
  if ((b.tBN - a.tBN) * 3600 < 600) continue;
  const ram = ((a.ramHome + a.park + a.foreign) + (b.ramHome + b.park + b.foreign)) / 2;
  ys.push({ a: a.t, b: b.t, y: (b.hackInc - a.hackInc) / ((b.tBN - a.tBN) * 3600) / ram });
}
const yAt = (t) => { if (t <= ys[0].a) return ys[0].y; for (const y of ys) if (t <= y.b) return y.y; return ys[ys.length - 1].y; };
const cost = cloudCost(256) - cloudCost(128);
const tA = new Date(2026, 9, 3, 5, 25, 35).getTime();   // letzter Ausbau des A-Teils im Gegenlauf (verify-g03-cf.mjs, W1)
// Park zum Zeitpunkt tA im Gegenlauf = Endzustand der 29 Ausbauten (3712 GB) -> 21 Rechner stehen noch auf 128
let t = tA, spent = 0, gbs = 0, dollars = 0, n = 0;
for (let k = 0; k < 21; k++) {
  t += 40000;
  while (t < tEnd && interp(mp, t) - spent < 2 * cost) t += 10000;
  if (t >= tEnd) break;
  spent += cost; n++;
  let acc = 0;
  for (let tt = t; tt < tEnd; tt += 60000) acc += yAt(tt + 30000) * Math.min(60000, tEnd - tt) / 1000;
  dollars += 128 * acc; gbs += 128 * (tEnd - t) / 1000;
}
console.log("B-Teil W1: " + n + " Ausbauten 128->256, GB*s " + gbs.toExponential(2) + ", Kosten " + (spent / 1e6).toFixed(0) + " Mio $, Gewinn " + (dollars / 1e9).toFixed(2) + " Mrd $ (Faktor 1,0), " + (dollars * 0.6 / 1e9).toFixed(2) + " Mrd $ (Faktor 0,6)");
console.log("Kontrolle: Park danach", 3712 + 21 * 128, "GB (25 x 256 =", 25 * 256, ")");
