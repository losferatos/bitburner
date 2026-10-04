// Gegenpruefung G06: Empfindlichkeit gegen die Wahl des Deckels (600/1800/3600/7200 s)
// bei BN2- und BN6/7/13-Preisen; Kurve = BN2-Zyklus 2 Ende [554,480,295], kapFrei 20834
// bzw. 17854 (BN2.1 Zyklus 1). Startpark 25x128. Bot-Einheiten und real (q = 0,6).
import { cloudCost } from "./infra-costs.mjs";
const FACTOR = { 2: 1, 6: 1.6, 7: 1.51, 13: 0.82 };
function simulate(bn, grenz, kapFrei, start, deckel, fac) {
  const I1 = grenz[0] * 1024 * fac, I2 = grenz[1] * 4096 * fac, I3 = grenz[2] * 16384 * fac;
  const bands = [{ upTo: 1024, m: I1 / 1024 }, { upTo: 4096, m: (I2 - I1) / 3072 }, { upTo: 16384, m: (I3 - I2) / 12288 }];
  const marg = (x) => { if (x >= kapFrei) return 0; for (const b of bands) if (x < b.upTo) return Math.max(0, b.m); return 0; };
  const park = start.slice(); let extra = 0, cost = 0, income = 0;
  for (let g = 0; g < 800; g++) {
    park.sort((a, b) => a - b); const r = park[0]; if (r >= 1048576) break;
    const c = cloudCost(2 * r, bn) - cloudCost(r, bn);
    let sum = 0; for (let x = extra; x < extra + r; x += 64) sum += marg(x) * Math.min(64, extra + r - x);
    const ertrag = sum / r; const amort = ertrag > 0 ? c / (r * ertrag) : Infinity;
    if (amort > deckel) break;
    park[0] = 2 * r; extra += r; cost += c; income += sum;
  }
  return { extra, cost, income, min: Math.min(...park) };
}
const start = Array(25).fill(128);
for (const [name, g, kap] of [["c2-Ende [554,480,295] kap 20834", [554, 480, 295], 20834], ["c1 [338,295,193] kap 17854", [338, 295, 193], 17854]]) {
  console.log("\n" + name);
  for (const bn of [2, 6, 7, 13]) {
    const row = [600, 1800, 3600, 7200].map((d) => { const s = simulate(bn, g, kap, start, d, FACTOR[bn]); return "+" + s.extra + "GB/" + (s.income * 3600 * 0.6 / 1e9).toFixed(1) + "Mrd/h(real)/" + (s.cost / 1e9).toFixed(1) + "Mrd"; });
    console.log("BN" + String(bn).padEnd(3), "Deckel 600:", row[0].padEnd(34), "1800:", row[1].padEnd(34), "3600:", row[2].padEnd(34), "7200:", row[3]);
  }
}
