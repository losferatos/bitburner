// Gegenpruefung G06 (INFRA-3): Wo bindet der Deckel 600 s ueberhaupt, wenn
// wartend >= 2 gilt (Kampfknoten ohne Gang: BN3, 6, 7, 11, 13, 14, 15)?
// Band-Simulation wie verify-g06-deckel.mjs (Eichung dort), aber mit den
// Cloud-Preisfaktoren des jeweiligen BitNode (infra-costs.mjs BN_MULTS) und der
// Grenzertragskurve eines BN2-Zustands, skaliert mit dem Hackertrag-Faktor der
// Route (hack-knoten.mjs: BN3 0,17, BN6 1,60, BN7 1,51, BN11 0,05, BN13 0,82,
// BN14 1,47, BN15 4,00 gegen BN2 = 1). GERECHNET_UNGEEICHT: die Kurven sind BN2.
// Startpark 25 x 128 GB (Zustand kurz nach dem Wiederaufbau, INFRA-1 behoben).
// Aufruf: node tools/audit/verify-g06-bn.mjs
import { cloudCost } from "./infra-costs.mjs";
const FACTOR = { 2: 1, 3: 0.17, 6: 1.6, 7: 1.51, 11: 0.05, 13: 0.82, 14: 1.47, 15: 4.0 };
const CURVES = { "c1-09:59 [338,295,193]": [338, 295, 193], "c2-22:17 [470,363,208]": [470, 363, 208], "c2-07:05 [554,480,295]": [554, 480, 295] };
function simulate(bn, grenz, kapFrei, start, deckel, fac) {
  const I1 = grenz[0] * 1024 * fac, I2 = grenz[1] * 4096 * fac, I3 = grenz[2] * 16384 * fac;
  const bands = [{ upTo: 1024, m: I1 / 1024 }, { upTo: 4096, m: (I2 - I1) / 3072 }, { upTo: 16384, m: (I3 - I2) / 12288 }];
  const marg = (x) => { if (x >= kapFrei) return 0; for (const b of bands) if (x < b.upTo) return Math.max(0, b.m); return 0; };
  const park = start.slice(); let extra = 0, cost = 0, income = 0;
  for (let g = 0; g < 800; g++) {
    park.sort((a, b) => a - b); const r = park[0];
    if (r >= 1048576) break;
    const c = cloudCost(2 * r, bn) - cloudCost(r, bn);
    let sum = 0; for (let x = extra; x < extra + r; x += 64) sum += marg(x) * Math.min(64, extra + r - x);
    const ertrag = sum / r; const amort = ertrag > 0 ? c / (r * ertrag) : Infinity;
    if (amort > deckel) break;
    park[0] = 2 * r; extra += r; cost += c; income += sum;
  }
  return { extra, cost, income, end: park.reduce((a, b) => a + b, 0), min: Math.min(...park) };
}
const start = Array(25).fill(128);
console.log("BN   Faktor  Kurve                     | 600 s: +GB  Park-min  Kosten Mrd | 1800 s: +GB  Park-min  Kosten Mrd | Diff Mrd $/h (Bot-Einh.) / real q=0,6 | Amort. 1800-Zusatz min");
for (const bn of [2, 6, 7, 13, 14, 15, 3, 11]) {
  for (const [name, c] of Object.entries(CURVES)) {
    const fac = FACTOR[bn];
    const a = simulate(bn, c, 18000, start, 600, fac), b = simulate(bn, c, 18000, start, 1800, fac);
    const d = (b.income - a.income) * 3600 / 1e9;
    const dc = (b.cost - a.cost) / 1e9;
    console.log(String(bn).padEnd(4), String(fac).padEnd(7), name.padEnd(26), "|", ("+" + a.extra).padStart(7), String(a.min).padStart(6), a.cost / 1e9 < 10 ? (a.cost / 1e9).toFixed(2).padStart(8) : (a.cost / 1e9).toFixed(1).padStart(8),
      "|", ("+" + b.extra).padStart(7), String(b.min).padStart(6), (b.cost / 1e9).toFixed(2).padStart(8), "|", d.toFixed(2).padStart(6), "/", (d * 0.6).toFixed(2).padStart(5), "|",
      d > 0 ? ((dc / d) * 60).toFixed(0) : "-");
  }
}
