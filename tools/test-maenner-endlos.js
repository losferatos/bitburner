/**
 * maennerNoetig (src/blade.js) darf nie haengen.
 *
 * WARUM ES DIESEN TEST GIBT (03.10.2026)
 *
 * maennerNoetig rechnet (s/c0)^20 - 1 und korrigiert mit n-- / n++. Bei
 * Typhoon (Chance 0,102, Schwelle 0,90) ist das 8,2e18 - oberhalb 2^53
 * aendern n-- und n++ den Wert nicht, die while-Schleife lief ewig ohne
 * ns-Aufruf und fror den ganzen Spiel-Tab ein (08:33 und nach jedem
 * Neuladen). Der alte Test (test-trupp-sleeve.js) pruefte nur Chancen
 * 0,50-0,99 und nur die Kopie in tools/trupp-rechnung.js.
 *
 * Der Test zieht die Funktion WOERTLICH aus blade.js (nicht aus der Kopie)
 * und fuehrt sie in einem Kindprozess mit Zeitlimit aus - ein Haenger ist so
 * ein rotes Ergebnis statt eines haengenden Tests.
 *
 * Aufruf: node tools/test-maenner-endlos.js [--blade <pfad zu blade.js>]
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const i = argv.indexOf("--blade");
const datei = i >= 0 ? argv[i + 1] : path.join(HIER, "..", "src", "blade.js");
const quelle = fs.readFileSync(datei, "utf8");

const start = quelle.indexOf("const maennerNoetig = (c0, s) => {");
if (start < 0) { console.log("ROT  maennerNoetig nicht gefunden in " + datei); process.exit(1); }
const ende = quelle.indexOf("\n  };", start);
const fn = quelle.slice(start, ende + 4);

let fehler = 0;
const pruefe = (name, ok, info = "") => {
  console.log((ok ? "gruen " : "ROT   ") + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fehler++;
};

// Referenz: kleinste n mit c0 * (n+1)^0,05 >= s, durch Hochzaehlen (nur fuer
// kleine Antworten, wo das sicher endet).
const referenz = (c0, s) => {
  if (!(c0 > 0) || !(s > 0)) return Infinity;
  if (c0 >= s) return 0;
  for (let n = 0; n <= 2e6; n++) if (c0 * Math.pow(n + 1, 0.05) >= s) return n;
  return Infinity;
};

// Gitter: die Faelle, die den Tab einfroren, plus der normale Bereich.
const faelle = [];
for (const s of [0.35, 0.4, 0.9]) {
  for (const c0 of [0.001, 0.01, 0.05, 0.102, 0.2, 0.3, 0.33, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.89, 0.9, 0.95]) {
    faelle.push([c0, s]);
  }
}
faelle.push([0, 0.9], [NaN, 0.9], [0.5, 0], [-1, 0.9]);

const kind = `${fn}\nconst f = ${JSON.stringify(faelle)}.map(([c, s]) => maennerNoetig(c, s));\nprocess.stdout.write(JSON.stringify(f));`;
const t0 = Date.now();
const r = spawnSync(process.execPath, ["-e", kind], { timeout: 5000, encoding: "utf8" });
const dauer = Date.now() - t0;
const haengt = r.error && r.error.code === "ETIMEDOUT" || r.signal === "SIGTERM";
pruefe("maennerNoetig endet fuer alle " + faelle.length + " Faelle binnen 5 s (Typhoon 0,102/0,90 eingeschlossen)",
  !haengt && r.status === 0, haengt ? "HAENGT - Zeitlimit nach " + dauer + " ms" : dauer + " ms");

if (!haengt && r.status === 0) {
  const werte = JSON.parse(r.stdout.replace(/null/g, "\"Infinity\"")).map((x) => (x === "Infinity" ? Infinity : x));
  let abw = 0;
  const abwListe = [];
  faelle.forEach(([c0, s], k) => {
    const soll = referenz(c0, s);
    const ist = werte[k];
    const gleich = soll === ist || (soll > 1e6 && ist === Infinity);
    if (!gleich) { abw++; abwListe.push(c0 + "/" + s + ": soll " + soll + " ist " + ist); }
  });
  pruefe("maennerNoetig = kleinste ausreichende Zahl, ueber 1e6 Mann Infinity", abw === 0, abwListe.slice(0, 4).join("; "));
  pruefe("Typhoon heute (0,102 gegen 0,90) ist unerreichbar = Infinity", werte[faelle.findIndex(([c, s]) => c === 0.102 && s === 0.9)] === Infinity);
  pruefe("0,85 gegen 0,90 braucht 3 Mann (wie test-trupp-sleeve)", werte[faelle.findIndex(([c, s]) => c === 0.85 && s === 0.9)] === 3);
}

console.log(fehler ? "\n" + fehler + " ROT" : "\nalles gruen");
process.exit(fehler ? 1 : 0);
