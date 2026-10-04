// Gegenpruefung G05: Wo laufen die Steuerdienste (alles ausser worker/*), mit RAM je Dienst?
// Aufruf: node tools/audit/verify-g05-dienste.mjs <backup.json.gz>
import { loadSave, runningScripts } from "./hack-save.mjs";
const { p, servers } = loadSave(process.argv[2]);
let tot = 0; const rows = [];
for (const [n, s] of Object.entries(servers)) {
  for (const r of runningScripts(s)) {
    if (r.filename.startsWith("worker/")) continue;
    const gb = (r.ramUsage || 0) * (r.threads || 1);
    tot += gb; rows.push([r.filename, n, gb]);
  }
}
rows.sort((a, b) => b[2] - a[2]);
for (const [f, n, gb] of rows) console.log(f.padEnd(18), n.padEnd(22), gb.toFixed(1));
const onHome = rows.filter((r) => r[1] === "home").reduce((s, r) => s + r[2], 0);
console.log("Summe Dienste", tot.toFixed(1), "GB, davon auf home", onHome.toFixed(1), " home maxRam", servers.home.maxRam);
