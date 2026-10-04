// Audit 04.10.2026, Gegenpruefung G04: wo liegen die share-Faeden? (home vs. Rest)
// Aufruf: node tools/audit/verify-g04-shareverteilung.mjs <backup.json.gz>
import { loadSave, runningScripts } from "./hack-save.mjs";
const { servers } = loadSave(process.argv[2]);
const rows = [];
for (const [n, s] of Object.entries(servers)) {
  let gb = 0, thr = 0;
  for (const r of runningScripts(s)) if (r.filename === "worker/share.js") { gb += r.ramUsage * r.threads; thr += r.threads; }
  if (gb > 0) rows.push([n, s.maxRam, s.cpuCores, thr, gb]);
}
rows.sort((a, b) => b[4] - a[4]);
let sum = 0; for (const r of rows) sum += r[4];
console.log("host\tmaxRam\tcores\tthreads\tshareGb");
for (const r of rows) console.log(r.join("\t"));
console.log("Summe", sum, "GB auf", rows.length, "Hosts; home-Anteil", ((rows.find((r) => r[0] === "home") || [0, 0, 0, 0, 0])[4] / sum * 100).toFixed(1), "%");
