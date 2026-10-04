// Gegenpruefung G11 (BLADE-2): Wie lange war die Black-Op-Kette nach Typhoon chancenbegrenzt, und was bringt ein
// Chancenfaktor f dort? Aus den Spielstaenden: boChancen (alle offenen Black Ops, Bot-Messung in data/blade.json),
// Feuerzeiten aus dem Aktionsprotokoll. Je Black Op: Zeitpunkt, an dem ihre gemessene Chance 0,90 erreicht,
// gegen das tatsaechliche Feuern, dazu die Verschiebung bei Faktor f (Chance*f, log-lineare Bahn zwischen Staenden).
import path from "node:path";
import fs from "node:fs";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
import { root } from "./verify-g11-lib.mjs";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const st = [];
for (const z of idx) {
  if (!z[1].includes("BN2L1")) continue;
  const { servers } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  if (bj && bj.boChancen) st.push({ t: Date.parse(z[0]) / 3.6e6, c: bj.boChancen, f: z[1].slice(22, 48) });
}
const letzte = idx.filter((z) => z[1].includes("BN2L1")).pop();
const { servers } = ladeSpielstand(path.join(root, "backups", letzte[1]));
const bjL = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const LOG = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean).filter((z) => z.von >= (bjL?.nodeReset || 0));
const feuer = {};
for (const z of LOG) if (z.aktion.startsWith("Black Operations/")) { const n = z.aktion.replace("Black Operations/", ""); if (!(n in feuer)) feuer[n] = z.von / 3.6e6; }
const F = Number(process.argv[2] || 1.2);
console.log("Black Op | feuerte (lokal) | letzter Stand davor: Chance | Stand 1 h davor");
const namen = Object.keys(feuer);
let summe = 0;
for (const n of namen) {
  const tf = feuer[n];
  const davor = st.filter((s) => s.t < tf && s.c[n] != null);
  const s1 = davor[davor.length - 1], s0 = davor[davor.length - 2];
  const L = (t) => new Date(t * 3.6e6 + 2 * 3.6e6).toISOString().slice(5, 16).replace("T", " ");
  console.log(n.padEnd(22), L(tf), s1 ? `${s1.f.slice(11)} c=${s1.c[n]}` : "-", s0 ? `${s0.f.slice(11)} c=${s0.c[n]}` : "");
}
