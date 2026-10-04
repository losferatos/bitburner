// Gegenpruefung G10 (BLADE-1): Wie gut war die Stadt der Division in ECHTEN Staenden?
// Je Spielstand mit aktiver Division: Wert = (pop/1e9)^0,7 / Chaosfaktor (proportional zur
// Chance jeder Nicht-Black-Op-Aktion, solange nicht bei 1 geklemmt). Verhaeltnis
// Wert(beste Stadt nach wahrer pop) / Wert(aktuelle Stadt) = Chancenvorteil einer
// bevoelkerungsbewussten Wahl in genau diesem Moment. Zeigt auch, ob die Bot-Regel
// (popEst/Chaosfaktor, Vorsprung 2) die bessere Stadt gewaehlt haette.
// Aufruf: node tools/audit/verify-g10-snapshots.mjs [muster] [--min-rang 1]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const muster = process.argv[2] || "";
const dir = path.join(root, "backups");
const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
// nur ein Stand je 55 min und Lauf, damit Zeilen nicht doppelt zaehlen
let letzteLauf = "", letzterTs = 0;
const zeilen = [];
for (const [ts, datei, , , bn, lauf, tp] of idx) {
  if (muster && !datei.includes(muster)) continue;
  if (!fs.existsSync(path.join(dir, datei))) continue;
  const key = bn + "L" + lauf;
  const t = Date.parse(ts);
  if (key === letzteLauf && t - letzterTs < 55 * 60000) continue;
  let st;
  try { st = ladeSpielstand(path.join(dir, datei)); } catch { continue; }
  const bbRaw = st.p.bladeburner; if (!bbRaw) continue;
  const bb = flach(bbRaw);
  if (!bb.cities || !bb.city) continue;
  letzteLauf = key; letzterTs = t;
  const fak = (ch) => (ch > 50 ? Math.sqrt(1 + ch - 50) : 1);
  const wertW = (c) => Math.pow(c.pop / 1e9, 0.7) / fak(c.chaos);
  const wertB = (c) => c.popEst / fak(c.chaos);
  const namen = Object.keys(bb.cities);
  const hier = bb.cities[bb.city];
  let bw = wertW(hier), bn1 = bb.city;
  for (const n of namen) if (wertW(bb.cities[n]) > bw) { bw = wertW(bb.cities[n]); bn1 = n; }
  let bb2 = wertB(hier), bn2 = bb.city;
  for (const n of namen) if (wertB(bb.cities[n]) > bb2) { bb2 = wertB(bb.cities[n]); bn2 = n; }
  const botWechselt = bn2 !== bb.city && wertB(bb.cities[bn2]) > 2 * wertB(hier);
  zeilen.push({ key, ts: ts.slice(0, 16), rang: Math.round(bb.rank), bn: Number(bn), stadt: bb.city, beste: bn1, vorteil: bw / wertW(hier), botPickWahr: wertW(bb.cities[botWechselt ? bn2 : bb.city]) / wertW(hier), botWechselt, hierPop: hier.pop / 1e6, hierCh: hier.chaos, bestePop: bb.cities[bn1].pop / 1e6, besteCh: bb.cities[bn1].chaos });
}
for (const z of zeilen) console.log(z.key.padEnd(8), z.ts, "Rang", String(z.rang).padStart(7), "|", z.stadt.padEnd(9), "pop", z.hierPop.toFixed(0).padStart(5) + "M ch", z.hierCh.toFixed(0).padStart(3), "| beste", z.beste.padEnd(9), "pop", z.bestePop.toFixed(0).padStart(5) + "M ch", z.besteCh.toFixed(0).padStart(3), "| Chancenvorteil x" + z.vorteil.toFixed(2), z.botWechselt ? "(Bot wuerde wechseln)" : "");
const v = zeilen.map((z) => z.vorteil);
const s = [...v].sort((a, b) => a - b);
const m = v.reduce((a, b) => a + b, 0) / v.length;
console.log("\nStaende", v.length, "| Chancenvorteil beste/aktuell: Mittel x" + m.toFixed(2), "Median x" + s[Math.floor(v.length / 2)].toFixed(2), "10 %", s[Math.floor(v.length * 0.1)].toFixed(2), "90 %", s[Math.floor(v.length * 0.9)].toFixed(2), "| Anteil Staende mit Vorteil > 1,2:", (100 * v.filter((x) => x > 1.2).length / v.length).toFixed(0) + " %", "> 1,5:", (100 * v.filter((x) => x > 1.5).length / v.length).toFixed(0) + " %");
