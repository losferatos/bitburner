// Auswertung der Simulationslaeufe (out/*.json): Spielergeld je Checkpoint (min/median/max ueber Saaten),
// Zuendzeitpunkt (erster Halbstundenpunkt mit Betriebsgewinn > Schwelle).
import fs from "node:fs";
import path from "node:path";
const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "out");
const runs = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f)));
  (runs[j.params.name] ??= []).push(j);
}
const fmt = (x) => (x >= 1e15 ? x.toExponential(1) : x >= 1e12 ? (x / 1e12).toFixed(1) + "T" : (x / 1e9).toFixed(0) + "G");
const cps = [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24];
console.log("Spielergeld bei Liquidation zum Zeitpunkt h (min/median/max ueber Saaten), G=Mrd, T=Bio");
console.log("Szenario".padEnd(10) + cps.map((h) => String(h).padStart(15)).join(""));
for (const [n, rs] of Object.entries(runs).sort()) {
  let line = n.padEnd(10);
  for (const h of cps) {
    const v = rs.map((r) => r.results.find((x) => x.h === h)?.money).filter((x) => x !== undefined).sort((a, b) => a - b);
    if (!v.length) { line += "".padStart(15); continue; }
    const med = v[Math.floor(v.length / 2)];
    line += (v.length > 1 ? `${fmt(v[0])}/${fmt(med)}/${fmt(v[v.length - 1])}` : fmt(med)).padStart(15);
  }
  console.log(line + `  (${rs.length} Saaten, RAM ${rs[0].ramGB.toFixed(0)} GB)`);
}
console.log("\nZuendung: erster Zeitpunkt (h) mit Betriebsgewinn je s ueber 1e9 / 1e12 / 1e20 (je Saat)");
for (const [n, rs] of Object.entries(runs).sort()) {
  const z = rs.map((r) => [1e9, 1e12, 1e20].map((th) => r.traj?.find((p) => p.profit > th)?.h ?? "-").join("/"));
  console.log(n.padEnd(10) + z.join("   "));
}
