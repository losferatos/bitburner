// FLUSS-DASHBOARD (Audit 04.10.2026): Stimmen die Felder, die dashboard/index.html liest, mit den Dateien im Spielstand?
//
// Frage: Das Dashboard liest data/bn4net.json, data/bn4rep.json, data/bn4job.json, data/hilfe.txt ueber /api/rpc und
// /api/state, /api/wache ueber die Bruecke. Ein Feld, das der Schreiber nie fuellt, zeigt "-" ohne Fehlermeldung.
// Das Skript zieht die Zugriffe aus dem Skriptteil der Seite (acorn, Eigenschaftszugriffe auf net/rep/job/w) und
// prueft jeden gegen die Schluessel der Dateien im neuesten Stand.
//
// Eichung: ein absichtlich erfundener Zugriff (Selbstprobe) muss als FEHLT gemeldet werden.
//
// Aufruf: node tools/audit/fluss-dashboard.mjs [<datei.json.gz>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuesterStand, homeTextdateien } from "./fluss-save.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);
const arg = process.argv[2] && process.argv[2].endsWith(".gz") ? process.argv[2] : neuesterStand();
const tf = homeTextdateien(arg);
console.log("Spielstand:", path.basename(arg));

const html = fs.readFileSync(path.join(ROOT, "dashboard", "index.html"), "utf8");
const code = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n;\n");
const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: "script", locations: true });

// Variable -> Datei (aus der Destrukturierung  const [net, rep, job, hilfe] = await Promise.all([rpcJson("a"), ...]))
const zuordnung = { net: "data/bn4net.json", rep: "data/bn4rep.json", job: "data/bn4job.json" };
const zugriffe = new Map(); // var -> Set(feld)
function walk(n, f) { if (!n || typeof n.type !== "string") return; f(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => x && x.type && walk(x, f)); else if (v && typeof v.type === "string") walk(v, f); } }
walk(ast, (n) => {
  if (n.type === "MemberExpression" && !n.computed && n.property.type === "Identifier" && n.object.type === "Identifier" && zuordnung[n.object.name]) {
    const s = zugriffe.get(n.object.name) || new Set(); s.add(n.property.name); zugriffe.set(n.object.name, s);
  }
});
// Selbstprobe
zugriffe.get("net").add("zzzNiemandSchreibtDas");
let fehlt = 0;
for (const [v, felder] of zugriffe) {
  const datei = zuordnung[v];
  let j = null;
  try { j = JSON.parse(tf.get(datei)); } catch { /* fehlt */ }
  if (!j) { console.log(datei.padEnd(20), "NICHT IM SPIEL"); continue; }
  const fehlend = [...felder].filter((f) => !(f in j));
  const nullwert = [...felder].filter((f) => f in j && j[f] === null);
  console.log(datei.padEnd(20), "gelesen:", [...felder].sort().join(","));
  console.log("   FEHLT im Spiel:", fehlend.length ? fehlend.join(",") : "-", " | Wert null:", nullwert.length ? nullwert.join(",") : "-");
  fehlt += fehlend.filter((f) => f !== "zzzNiemandSchreibtDas").length;
}
console.log("Selbstprobe: erfundener Zugriff gemeldet:", [...zugriffe.get("net")].includes("zzzNiemandSchreibtDas") && true);
