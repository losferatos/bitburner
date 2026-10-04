// VERSION-ZAHLEN (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Objektiver Filter "wo hat sich eine ZAHL im Spielquelltext geaendert": alle Quelldateien, die sich zwischen
// reference/v301 (LAUFENDES Spiel, 3.0.1) und reference/bitburner-src (dev, "3.0.2") unterscheiden, werden von
// Kommentaren und Zeichenketten befreit; die uebrigen Zahlenliterale werden als Multimenge verglichen.
// Eine Datei erscheint nur, wenn sich mindestens ein Zahlenliteral geaendert hat (hinzu/weg/anderer Wert).
// Reine Text-, Umbenennungs- und Umformatierungsaenderungen fallen heraus. Oberflaechen-/Doku-/Terminal-Pfade
// sind ausgenommen (nur Text).
//
// Eichung (SELBSTPROBE): zwei synthetische Quellen - Kommentar-/String-/Format-Aenderung darf NICHT melden,
// eine geaenderte Zahl MUSS melden. Zusaetzlich bekannt-geaenderte Datei Augmentation/Augmentations.ts MUSS
// im Ergebnis stehen (Charisma-Werte), Hacking.ts (unveraendert) NICHT.
//
// Aufruf: node tools/audit/version-zahlen.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const A = path.join(ROOT, "reference", "v301", "src");
const B = path.join(ROOT, "reference", "bitburner-src", "src");

const BT = String.fromCharCode(96); // Backtick ohne Backtick im Quelltext
function strip(t) {
  let out = "";
  let i = 0;
  const n = t.length;
  while (i < n) {
    const c = t[i], d = t[i + 1];
    if (c === "/" && d === "*") { const e = t.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; out += " "; continue; }
    if (c === "/" && d === "/") { const e = t.indexOf("\n", i); i = e < 0 ? n : e; continue; }
    if (c === '"' || c === "'" || c === BT) {
      let j = i + 1;
      while (j < n && t[j] !== c) { if (t[j] === "\\") j++; j++; }
      i = j + 1; out += c + c; continue;
    }
    out += c; i++;
  }
  return out;
}
function zahlen(t) {
  return strip(t).match(/(?<![\w.])\d+(?:\.\d+)?(?:e[+-]?\d+)?(?![\w])/g) || [];
}
function multi(arr) { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return m; }
function vergleiche(ta, tb) {
  const ca = multi(zahlen(ta)), cb = multi(zahlen(tb));
  const dif = [];
  for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) if ((ca[k] || 0) !== (cb[k] || 0)) dif.push(k + ":" + (ca[k] || 0) + "->" + (cb[k] || 0));
  return dif;
}

// Selbstprobe
{
  const alt = "const x = 5; // 7 Kommentar\nconst s = 'abc 123';\nfoo(10,\n  20);";
  const neu1 = "const x = 5; // 99 anderer Kommentar\nconst s = 'xyz 456';\nfoo(10, 20,);";
  const neu2 = "const x = 5;\nconst s = 'abc 123';\nfoo(10, 21);";
  const ok = vergleiche(alt, neu1).length === 0 && vergleiche(alt, neu2).length === 2;
  console.log("SELBSTPROBE synthetisch: " + (ok ? "OK" : "FEHLER"));
  if (!ok) process.exit(2);
}

function walk(d, rel = "", o = []) {
  for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(d, r, o); else o.push(r);
  }
  return o;
}
const AUS = /^(Documentation|Terminal|Themes|ui\/|DevMenu|Achievements|Sidebar|GameOptions|ScriptEditor|ErrorHandling|Diagnostic|Alias)/;
const alle = new Set([...walk(A), ...walk(B)]);
const treffer = [];
let verglichen = 0, geaendert = 0;
for (const f of [...alle].sort()) {
  if (!/\.(ts|tsx|json)$/.test(f) || AUS.test(f)) continue;
  const pa = path.join(A, f), pb = path.join(B, f);
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) continue;
  const ta = fs.readFileSync(pa, "utf8"), tb = fs.readFileSync(pb, "utf8");
  verglichen++;
  if (ta === tb) continue;
  geaendert++;
  const dif = vergleiche(ta, tb);
  if (dif.length) treffer.push({ f, dif });
}
const namen = treffer.map((t) => t.f);
const probe1 = namen.includes("Augmentation/Augmentations.ts"), probe2 = !namen.includes("Hacking.ts");
console.log("SELBSTPROBE Quelltext: Augmentations.ts gefunden " + (probe1 ? "OK" : "FEHLER") + ", Hacking.ts nicht gefunden " + (probe2 ? "OK" : "FEHLER"));
if (!(probe1 && probe2)) process.exit(2);
console.log("Dateien in beiden Baeumen (ohne UI/Doku/Terminal): " + verglichen + ", davon textlich verschieden: " + geaendert + ", davon mit geaendertem Zahlenliteral: " + treffer.length + "\n");
for (const t of treffer) console.log(t.f.padEnd(52) + t.dif.slice(0, 12).join(" ") + (t.dif.length > 12 ? " ... (+" + (t.dif.length - 12) + ")" : ""));
