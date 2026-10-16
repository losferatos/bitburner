/**
 * Tracer nach Vertragsanteil gewichten (16.10.2026).
 *
 * BitNode 7.1, 16.10. 13:00: Tracer 14 (433 Punkte) im Gleichschritt mit
 * Digital Observer 14, waehrend die Vertragsvorraete leer waren und der Rang
 * aus Raid kam. Tracer wirkt nur auf Vertraege (data/Skills.ts:38-43), seine
 * Abdeckung stand fest auf 1,0. Gegen den alten Stand ROT:
 * anteilFortschreiben fehlt, relNutzen kennt vertragsAnteil nicht.
 *
 * Aufruf: node tools/test-tracer-anteil.js [pfad/zu/blade.js]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "blade.js");
const quelle = fs.readFileSync(DATEI, "utf8");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

function extrahiere(text, name) {
  const start = text.indexOf("const " + name + " = ");
  if (start < 0) return null;
  const k = text.indexOf("{", start);
  let tiefe = 0, i = k;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (tiefe === 0) break; }
  }
  return text.slice(start, text[i + 1] === ";" ? i + 2 : i + 1);
}

console.log("\n=== Tracer nach Vertragsanteil ===\n");

const q = extrahiere(quelle, "anteilFortschreiben");
pruefe("anteilFortschreiben im Quelltext", !!q, q ? "" : "alte Fassung");
if (q) {
  const f = new Function(q + "\nreturn anteilFortschreiben;")();
  const TAU = 10 * 60000, MAX = 2 * 60000;
  const g = (alt, v, dt) => f(alt, v, dt, TAU, MAX);
  pruefe("Neustart: Prior 0,5, erste Stichprobe kippt ihn nicht (Skeptiker 2)",
    g(null, false, 0) === 0.5 && g(null, true, 0) === 0.5);
  pruefe("dt hoechstens 2 min: 50 min Pause zaehlt wie 2 min (Skeptiker 1)",
    Math.abs(g(0.1, true, 50 * 60000) - g(0.1, true, 2 * 60000)) < 1e-12);
  // 30 min Raid im offenen Tab (ein Durchlauf je Sekunde) aus 1 heraus
  let x = 1;
  for (let i = 0; i < 1800; i++) x = g(x, false, 1000);
  pruefe("30 min Raid: Anteil unter 0,06", x < 0.06, x.toFixed(4));
  // dasselbe im verdeckten Tab (ein Durchlauf je Minute): gleiche Wandzeit, gleiches Ergebnis
  let y = 1;
  for (let i = 0; i < 30; i++) y = g(y, false, 60000);
  pruefe("verdeckter Tab: gleiche Wandzeit, gleicher Anteil", Math.abs(x - y) < 1e-6, y.toFixed(4));
  let z = 0.5;
  for (let i = 0; i < 600; i++) z = g(z, true, 1000);
  pruefe("Vertraege zurueck: Anteil steigt wieder", z > 0.8, z.toFixed(3));
  pruefe("negatives dt veraendert nichts", g(0.4, true, -5000) === 0.4);
}

const rel = extrahiere(quelle, "relNutzen") || "";
pruefe("relNutzen nimmt vertragsAnteil fuer Tracer",
  /name === "Tracer" && Number\.isFinite\(vertragsAnteil\)\)\s*\?\s*vertragsAnteil/.test(rel));
pruefe("Hauptschleife schreibt den Anteil nur fuer V/O/B fort",
  /if \(wahl\.typ === V \|\| wahl\.typ === O \|\| wahl\.typ === B\) \{\s*vertragsAnteil = anteilFortschreiben\(vertragsAnteil, wahl\.typ === V,/.test(quelle));
pruefe("Zeit wird bei jeder Wahl nachgezogen, auch General (Skeptiker 1)",
  /VERTRAGSANTEIL_DT_MAX_MS\);\s*\}\s*vertragsAnteilZeit = jetztMs;\s*\}/.test(quelle));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
