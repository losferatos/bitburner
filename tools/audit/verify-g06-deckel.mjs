// Gegenpruefung G06 (INFRA-3): Wie weit laesst die Bot-Regel (kleinsten Rechner
// verdoppeln, solange Kosten/(zusatzGb*Ertrag) <= Deckel) den Park wachsen, mit
// Deckel 600 s bzw. 1800 s - fuer die Grenzertragskurve JEDES Spielstands
// (data/bn4net.json mischung.grenz = Mittel der naechsten 1024/4096/16384 GB).
//
// Methode wie tools/audit/infra-deckel.mjs (Baender aus den drei Mittelwerten,
// Position = bereits zugekaufte GB), aber:
//  (a) fuer alle BN2-Staende statt nur 09:59 des ersten Zyklus,
//  (b) Entscheidung mit der Bot-Kurve (unskaliert, so entscheidet der Bot),
//      Einkommen mit der Bot-Kurve mal q (q = gemessen/Bot, hier als Parameter),
//  (c) Startpark = tatsaechlicher Park des Stands (INFRA-1 als behoben gedacht),
//  (d) Kapazitaetsgrenze kapFreiGb des Bots: darueber kein Ertrag, und die
//      5-%-Regel (ueberschuss > 5 % Netz) sperrt weitere Kaeufe.
// Eichung: die Rechnung reproduziert fuer 09:59 die Zahlen aus infra-deckel.mjs
// (Soll +3968 / +16256 GB, 4,22 / 11,31 Mrd $/h bei Skala 1).
// Aufruf: node tools/audit/verify-g06-deckel.mjs
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";
import { cloudCost } from "./infra-costs.mjs";

const files = fs.readdirSync("backups").filter((f) => /BN2L[12]_/.test(f) && f.endsWith(".json.gz")).sort();
const CSS_BN = 2;
function simulate(grenz, kapFrei, parkStart, deckel) {
  const I1 = grenz[0] * 1024, I2 = grenz[1] * 4096, I3 = grenz[2] * 16384;
  const bands = [{ upTo: 1024, m: I1 / 1024 }, { upTo: 4096, m: (I2 - I1) / 3072 }, { upTo: 16384, m: (I3 - I2) / 12288 }];
  const marg = (x) => { if (x >= kapFrei) return 0; for (const b of bands) if (x < b.upTo) return Math.max(0, b.m); return 0; };
  const park = parkStart.slice();
  let extra = 0, cost = 0, income = 0;
  for (let guard = 0; guard < 600; guard++) {
    park.sort((a, b) => a - b);
    const r = park[0];
    if (r >= 1048576) break;
    const c = cloudCost(2 * r, CSS_BN) - cloudCost(r, CSS_BN);
    let sum = 0;
    for (let x = extra; x < extra + r; x += 64) sum += marg(x) * Math.min(64, extra + r - x);
    const ertrag = sum / r;
    const amort = ertrag > 0 ? c / (r * ertrag) : Infinity;
    if (amort > deckel) break;
    park[0] = 2 * r; extra += r; cost += c; income += sum;
  }
  return { extra, cost, income, parkEnd: park.reduce((a, b) => a + b, 0) };
}
console.log("Eichung (Soll aus infra-deckel.mjs, Park 4x256+21x128, Kurve [338,295,193], kapFrei 17854):");
{
  const p0 = [256, 256, 256, 256, ...Array(21).fill(128)];
  const a = simulate([338, 295, 193], 17854, p0, 600), b = simulate([338, 295, 193], 17854, p0, 1800);
  console.log("  Ist  600 s: +" + a.extra + " GB, " + (a.income * 3600 / 1e9).toFixed(2) + " Mrd/h   (Soll +3968, 4,22)");
  console.log("  Ist 1800 s: +" + b.extra + " GB, " + (b.income * 3600 / 1e9).toFixed(2) + " Mrd/h   (Soll +16256, 11,31)");
}
console.log("\nStand                              L   park  Kurve                kapFrei | 600 s: +GB   | 1800 s: +GB  | Differenz GB | Diff Mrd/h bei q=1 / q=0,6");
for (const f of files) {
  const { p, servers } = loadSave("backups/" + f);
  const net = JSON.parse(textFile(servers.home, "data/bn4net.json") || "{}");
  const g = net.mischung && net.mischung.grenz, kap = net.mischung && net.mischung.kapFreiGb;
  if (!g || !(g[0] > 50)) continue;
  const ps = (p.purchasedServers || []).map((h) => (servers[h] ? servers[h].maxRam : 0)).filter((x) => x > 0);
  if (ps.length < 25) continue;
  const a = simulate(g, kap, ps, 600), b = simulate(g, kap, ps, 1800);
  const d = b.income - a.income;
  console.log(f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(34), String(p.skills.hacking).padStart(3),
    String(ps.reduce((x, y) => x + y, 0)).padStart(6), JSON.stringify(g).padEnd(18), String(kap).padStart(6), "|",
    ("+" + a.extra).padStart(8), "(" + (a.income * 3600 / 1e9).toFixed(1) + ")", "|", ("+" + b.extra).padStart(8), "(" + (b.income * 3600 / 1e9).toFixed(1) + ")", "|",
    String(b.extra - a.extra).padStart(7), "|", (d * 3600 / 1e9).toFixed(2), "/", (d * 0.6 * 3600 / 1e9).toFixed(2));
}
