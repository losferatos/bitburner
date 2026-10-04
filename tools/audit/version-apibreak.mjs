// VERSION-APIBREAK (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Beim ersten Laden eines 3.0.1-Standes in 3.0.2 laeuft die Migration `if (ver < 52) showAPIBreaks("3.0.2", ...)`
// (utils/SaveDataMigrationUtils.ts dev :652-654; APIBreaks/3.0.2.ts). showAPIBreaks durchsucht ALLE Skripte auf ALLEN
// Servern zeilenweise nach den Namen der gebrochenen Funktionen (APIBreak.ts dev :71-91: lines[i].includes(name) ODER
// Regex searchValue) und schreibt sie bei Fund um. Gibt es mindestens einen Fund, erscheint ein Dialog
// (dialogBoxCreate ... canBeDismissedEasily:false, APIBreak.ts dev :12-15 und :155ff) - auch fuer Aenderungen mit
// showWarning:false. Ein Dialog, den der Bot nicht kennt, kann die Oberflaeche blockieren (popups.js).
//
// Dieses Werkzeug liest die juengsten Staende und zaehlt die Treffer der Suchbegriffe in den Skripten (nicht in
// Textdateien: die Migration geht nur ueber server.scripts). Suchbegriffe werden aus dem dev-Quelltext
// APIBreaks/3.0.2.ts gelesen.
//
// Eichung: derselbe Suchlauf auf einen synthetisch erzeugten AllServersSave mit einem Skript, das den Begriff
// enthaelt, MUSS genau einen Treffer melden; auf einen ohne den Begriff null.
//
// Aufruf: node tools/audit/version-apibreak.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const q = fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", "utils", "APIBreaks", "3.0.2.ts"), "utf8");
const begriffe = new Set();
for (const m of q.matchAll(/(?:name|searchValue): "([^"]+)"/g)) begriffe.add(m[1]);
console.log("Suchbegriffe aus APIBreaks/3.0.2.ts: " + [...begriffe].join(", "));

function zaehle(allServersSave) {
  const alle = JSON.parse(allServersSave);
  const funde = [];
  for (const [host, srv] of alle.data ? Object.entries(alle.data) : Object.entries(alle)) {
    const scripts = srv && srv.data && srv.data.scripts;
    const liste = scripts && scripts.data ? scripts.data : [];
    for (const [pfad, s] of liste) {
      const inhalt = (s && s.data && s.data.code) ?? (s && s.code) ?? "";
      const zeilen = String(inhalt).split("\n");
      zeilen.forEach((z, i) => { const b = [...begriffe].filter((x) => z.includes(x)); if (b.length) funde.push(host + ":" + pfad + ":" + (i + 1) + " (" + b[b.length - 1] + ")"); });
    }
  }
  return funde;
}
// Eichung
const synth = (inhalt) => JSON.stringify({ ctor: "JSONMap", data: { home: { ctor: "Server", data: { scripts: { ctor: "JSONMap", data: [["a.js", { ctor: "Script", data: { code: inhalt } }]] } } } } });
const e1 = zaehle(synth("// ns.singularity.exportGameBonus()\nfoo();")).length;
const e0 = zaehle(synth("foo();")).length;
console.log("EICHUNG: synthetischer Treffer " + e1 + " (soll 1), ohne Begriff " + e0 + " (soll 0) -> " + (e1 === 1 && e0 === 0 ? "OK" : "ROT"));
if (!(e1 === 1 && e0 === 0)) process.exit(2);

// Struktur des echten AllServersSave pruefen (damit die Eichung auf der echten Form beruht)
const idx = fs.readFileSync(path.join(ROOT, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const letzte = [];
for (let i = idx.length - 1; i >= 0 && letzte.length < 3; i--) {
  const r = idx[i];
  const f = [r[9], r[10], path.join(ROOT, "backups", r[1])].find((x) => x && fs.existsSync(x));
  if (f) letzte.push(f);
}
for (const f of letzte) {
  const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  const a = s.data.AllServersSave;
  const j = JSON.parse(a);
  const hosts = Object.keys(j.data || j);
  let nScripts = 0;
  for (const h of hosts) { const sc = (j.data || j)[h]?.data?.scripts; if (sc && sc.data) nScripts += sc.data.length; }
  const funde = zaehle(a);
  console.log(path.basename(f) + ": " + hosts.length + " Server, " + nScripts + " Skripte, Funde " + funde.length + (funde.length ? "\n   " + funde.slice(0, 10).join("\n   ") : ""));
}
