// VERSION-RECHNER (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Frage: Welche Spielquelldateien lesen die Rechner in tools/audit/*.mjs (und tools/lib/*.js, tools/*.js), und
// welche davon unterscheiden sich zwischen v301 (LAUFENDES Spiel) und dev ("3.0.2", Grundlage der Rechner)?
// Eine Datei, die sich unterscheidet UND von einem Rechner gelesen wird, ist ein Kandidat, dessen Ergebnis
// gegen v301 neu zu rechnen ist. Alles andere ist versionsfest.
//
// Methode: aus jedem Rechner werden Zeichenketten gezogen, die auf .ts/.tsx enden (Pfad oder Basisname),
// gegen den Dateibaum von dev aufgeloest (Basisname -> alle Pfade) und gegen die Menge der
// nach Normalisierung (Kommentare/Leerraum/Komma) verschiedenen Dateien gehalten.
//
// Eichung: (1) "Augmentation/Augmentations.ts" wird von aug-data.mjs gelesen und MUSS als betroffen erscheinen;
// (2) "Hacking.ts" (gleich) darf nicht als betroffen erscheinen.
//
// Aufruf: node tools/audit/version-rechner.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const A = path.join(ROOT, "reference", "v301", "src");
const B = path.join(ROOT, "reference", "bitburner-src", "src");

function walk(d, rel = "", o = []) {
  for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(d, r, o); else o.push(r);
  }
  return o;
}
function normal(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .split(/\r?\n/).map((l) => l.replace(/\s+/g, "").replace(/,([)\]}])/g, "$1")).filter(Boolean).join("\n");
}
const dateienB = walk(B).filter((f) => /\.(ts|tsx)$/.test(f));
const nachName = new Map();
for (const f of dateienB) { const b = path.basename(f); (nachName.get(b) || nachName.set(b, []).get(b)).push(f); }
const verschieden = new Set();
for (const f of dateienB) {
  const pa = path.join(A, f);
  if (!fs.existsSync(pa)) { verschieden.add(f); continue; }
  const ta = fs.readFileSync(pa, "utf8"), tb = fs.readFileSync(path.join(B, f), "utf8");
  if (ta !== tb && normal(ta) !== normal(tb)) verschieden.add(f);
}
console.log("Dateien dev: " + dateienB.length + ", davon nach Normalisierung verschieden/neu: " + verschieden.size);

const quellen = [];
for (const d of ["tools/audit", "tools/lib", "tools"]) {
  const dir = path.join(ROOT, d);
  for (const n of fs.readdirSync(dir)) if (/\.(mjs|js)$/.test(n)) quellen.push(path.join(dir, n));
}
const RE = /["'`]((?:[\w.-]+\/)*[\w.-]+\.(?:ts|tsx))["'`]/g;
const treffer = new Map(); // spieldatei -> Set(rechner)
for (const q of quellen) {
  const t = fs.readFileSync(q, "utf8");
  let m;
  while ((m = RE.exec(t))) {
    const name = m[1];
    const cands = name.includes("/") ? dateienB.filter((f) => f === name || f.endsWith("/" + name)) : (nachName.get(name) || []);
    for (const c of cands) (treffer.get(c) || treffer.set(c, new Set()).get(c)).add(path.relative(ROOT, q).replace(/\\/g, "/"));
  }
}
const betroffen = [...treffer.entries()].filter(([f]) => verschieden.has(f)).sort((a, b) => b[1].size - a[1].size);
const probe1 = treffer.has("Augmentation/Augmentations.ts") && verschieden.has("Augmentation/Augmentations.ts");
const probe2 = !betroffen.some(([f]) => f === "Hacking.ts");
console.log("EICHUNG Augmentations.ts betroffen: " + (probe1 ? "OK" : "ROT") + " | Hacking.ts nicht betroffen: " + (probe2 ? "OK" : "ROT"));
if (!(probe1 && probe2)) process.exit(2);
console.log("Von Rechnern gelesene Spieldateien: " + treffer.size + ", davon verschieden zwischen v301 und dev: " + betroffen.length + "\n");
for (const [f, set] of betroffen) console.log(f.padEnd(50) + set.size + " Rechner: " + [...set].slice(0, 5).join(", ") + (set.size > 5 ? ", ..." : ""));
