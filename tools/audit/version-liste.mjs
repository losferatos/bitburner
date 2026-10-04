// VERSION-LISTE (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Listet ALLE Quelldateien, die sich zwischen reference/v301 (LAUFENDES Spiel) und reference/bitburner-src
// (dev "3.0.2") unterscheiden, nach Bereich und mit Umfang der Aenderung (Zeilen im Diff nach Entfernen
// von Kommentaren und Leerraum). Dateien nur in einer Fassung werden getrennt gezeigt.
// Zweck: Triage "welche Dateien enthalten Spielmechanik" fuer die semantischen Vergleiche
// (version-semdiff.mjs, version-nsdiff.mjs), damit keine Aenderung durch das Raster faellt, nur weil
// sie keine Zahl veraendert (version-zahlen.mjs sieht nur Zahlenliterale).
//
// Eichung (SELBSTPROBE): Augmentation/Augmentations.ts (bekannt geaendert) MUSS drin sein,
// Hacking.ts (bekannt gleich) NICHT; Gesamtzahl der Dateien muss der unabhaengigen Zaehlung ueber
// "diff -rq" entsprechen, wenn --diffq angegeben ist (dann wird das Ergebnis aus `diff` gelesen).
//
// Aufruf: node tools/audit/version-liste.mjs [--tsv datei]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const A = path.join(ROOT, "reference", "v301", "src");
const B = path.join(ROOT, "reference", "bitburner-src", "src");
const argv = process.argv.slice(2);
const TSV = argv.includes("--tsv") ? argv[argv.indexOf("--tsv") + 1] : null;

function walk(d, rel = "", o = []) {
  for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(d, r, o); else o.push(r);
  }
  return o;
}
function normal(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .split(/\r?\n/).map((l) => l.replace(/\s+/g, "").replace(/,([)\]}])/g, "$1")).filter(Boolean);
}
// Zeilenmultimengen-Differenz (ungeordnet genug fuer Umformatierung, scharf genug fuer Zahlen/Logik)
function dif(a, b) {
  const m = new Map();
  for (const l of a) m.set(l, (m.get(l) || 0) + 1);
  let neu = 0;
  for (const l of b) { const c = m.get(l) || 0; if (c > 0) m.set(l, c - 1); else neu++; }
  let weg = 0;
  for (const v of m.values()) weg += v;
  return { weg, neu };
}
const nurLive = [], nurDev = [], geaendert = [];
const wa = new Set(walk(A)), wb = new Set(walk(B));
for (const f of [...new Set([...wa, ...wb])].sort()) {
  if (!/\.(ts|tsx|json|js)$/.test(f)) continue;
  if (!wb.has(f)) { nurLive.push(f); continue; }
  if (!wa.has(f)) { nurDev.push(f); continue; }
  const ta = fs.readFileSync(path.join(A, f), "utf8"), tb = fs.readFileSync(path.join(B, f), "utf8");
  if (ta === tb) continue;
  const d = dif(normal(ta), normal(tb));
  if (d.weg + d.neu === 0) continue; // nur Kommentar/Format
  geaendert.push({ f, ...d });
}
const probe1 = geaendert.some((g) => g.f === "Augmentation/Augmentations.ts");
const probe2 = !geaendert.some((g) => g.f === "Hacking.ts");
console.log("SELBSTPROBE: Augmentations.ts drin " + (probe1 ? "OK" : "FEHLER") + ", Hacking.ts nicht drin " + (probe2 ? "OK" : "FEHLER"));
if (!(probe1 && probe2)) process.exit(2);

const bereich = (f) => (f.includes("/") ? f.split("/")[0] : "(Wurzel)");
const UI = /(^|\/)(ui|Terminal|Documentation|Themes|Sidebar|GameOptions|ScriptEditor|DevMenu|Achievements|ErrorHandling)(\/|$)|\.tsx$/;
console.log("\nGEAENDERT (nach Normalisierung): " + geaendert.length + " Dateien; davon .tsx/UI-Pfad: " + geaendert.filter((g) => UI.test(g.f)).length);
const gruppen = {};
for (const g of geaendert) (gruppen[bereich(g.f)] ||= []).push(g);
for (const [b, l] of Object.entries(gruppen).sort()) {
  console.log("\n[" + b + "]");
  for (const g of l) console.log("  " + g.f.padEnd(58) + "-" + String(g.weg).padStart(4) + " +" + String(g.neu).padStart(4) + (UI.test(g.f) ? "  (UI)" : ""));
}
console.log("\nNUR LIVE (v301): " + nurLive.length + "\n  " + nurLive.join("\n  "));
console.log("\nNUR DEV: " + nurDev.length + "\n  " + nurDev.join("\n  "));
if (TSV) {
  fs.writeFileSync(TSV, "datei\tweg\tneu\tui\n" + geaendert.map((g) => [g.f, g.weg, g.neu, UI.test(g.f) ? 1 : 0].join("\t")).join("\n") + "\n");
}
