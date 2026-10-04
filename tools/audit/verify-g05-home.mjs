// Gegenpruefung G05 (03.10.2026): Was laeuft auf home? RAM, Kerne, Skriptverteilung
// aus einem Spielstand. Liest nur.
// Aufruf: node tools/audit/verify-g05-home.mjs <backup.json.gz>
import { loadSave, runningScripts } from "./hack-save.mjs";

const file = process.argv[2];
const { p, servers } = loadSave(file);
const home = servers.home;
console.log("BN", p.bitNodeN, "home maxRam", home.maxRam, "ramUsed", home.ramUsed, "cores", home.cpuCores,
  "money", p.money, "totalPlaytime h", (p.totalPlaytime / 3.6e6).toFixed(2),
  "sinceBitnode h", (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2), "sinceAug h", (p.playtimeSinceLastAug / 3.6e6).toFixed(2));
const by = {};
for (const r of runningScripts(home)) {
  const k = r.filename;
  by[k] = by[k] || { n: 0, threads: 0, gb: 0 };
  by[k].n++; by[k].threads += r.threads || 1; by[k].gb += (r.ramUsage || 0) * (r.threads || 1);
}
const rows = Object.entries(by).sort((a, b) => b[1].gb - a[1].gb);
let tot = 0;
for (const [k, v] of rows) { tot += v.gb; console.log(k.padEnd(28), "n", String(v.n).padStart(3), "thr", String(v.threads).padStart(6), "GB", v.gb.toFixed(1)); }
console.log("Summe belegt", tot.toFixed(1), "von", home.maxRam);
const msA = (p.moneySourceA && p.moneySourceA.data) || p.moneySourceA || {};
const msB = (p.moneySourceB && p.moneySourceB.data) || p.moneySourceB || {};
console.log("moneySourceB.servers", msB.servers, " hacking", msB.hacking, " total spent?", JSON.stringify(msB).slice(0, 400));
