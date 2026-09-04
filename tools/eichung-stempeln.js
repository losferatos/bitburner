/**
 * Stempelt Zeilen der RAM-Eichung neu - aber nur die, bei denen die Rechnung
 * den Messwert WEITER trifft.
 *
 * ===========================================================================
 * WOZU
 * ===========================================================================
 *
 * `doku/ram-messung-2026-09-04.json` haelt 114 im Spiel gemessene RAM-Werte.
 * Seit dem 04.09.2026 traegt jede Zeile den sha256 des Dateiinhalts, der den
 * Wert erzeugt hat: aendert sich die Datei, gilt die Zeile als VERALTET und
 * belegt nichts mehr (`tools/test-ram.js`).
 *
 * Das ist streng, und es soll streng sein - so ueberlebte Befund M.3 (eine
 * Schwelle von 4,0 GB fuer eine Datei, die 5,5 wiegt). Aber es gibt einen
 * Fall, in dem die Strenge ins Leere trifft: eine Aenderung, die den
 * Speicherbedarf NICHT beruehrt. Ein Kommentar kostet nichts (`test-ram.js`
 * prueft das eigens), ein umbenannter Pfad in einer Kommentarzeile erst
 * recht.
 *
 * Dann waere es falsch, die Zeile zu verwerfen - der Messwert stimmt ja noch.
 * Und es waere genauso falsch, sie von Hand nachzustempeln, ohne das zu
 * pruefen: damit koennte man jede Abweichung wegstempeln.
 *
 * ===========================================================================
 * DIE REGEL
 * ===========================================================================
 *
 * Neu gestempelt wird eine Zeile GENAU DANN, wenn der RAM-Rechner fuer den
 * heutigen Dateiinhalt weiterhin den gemessenen Wert liefert. Trifft er ihn
 * nicht mehr, bleibt die Zeile veraltet und braucht eine neue Messung im
 * Spiel (`calculateRam`) - dieses Werkzeug kann sie nicht ersetzen.
 *
 * Anders gesagt: es stempelt nur nach, was ohnehin gestimmt haette. Es kann
 * eine Eichung nicht retten, nur ihre Buchfuehrung nachziehen.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/eichung-stempeln.js            zeigt, was passieren wuerde
 *   node tools/eichung-stempeln.js --schreib  schreibt
 *   node tools/eichung-stempeln.js --schreib <datei> [<datei> ...]
 *
 * Ohne Dateiliste werden alle veralteten Zeilen geprueft.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { rechne } from "./ram.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const MESSUNG = path.join(ROOT, "doku", "ram-messung-2026-09-04.json");
const WURZEL = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const SCHREIB = argv.includes("--schreib");
const NUR = argv.filter((a) => !a.startsWith("--"));

const daten = JSON.parse(fs.readFileSync(MESSUNG, "utf8"));

const gestempelt = [];
const bleibtVeraltet = [];
const fehlt = [];

for (const e of daten) {
  if (NUR.length && !NUR.includes(e.file)) continue;
  const datei = path.join(WURZEL, e.file);
  if (!fs.existsSync(datei)) {
    fehlt.push(e.file);
    continue;
  }
  const jetzt = createHash("sha256").update(fs.readFileSync(datei)).digest("hex");
  if (e.sha256 === jetzt) continue;          // gilt schon, nichts zu tun

  const r = rechne(e.file, { sf4: 1, wurzel: WURZEL });
  if (r.gb !== null && Math.abs(r.gb - e.live41) < 0.005) {
    gestempelt.push(e.file);
    if (SCHREIB) {
      e.sha256 = jetzt;
      delete e.veraltet;
    }
  } else {
    bleibtVeraltet.push(e.file + " (gemessen " + e.live41 + ", gerechnet " + r.gb + ")");
  }
}

console.log("");
console.log("=== Eichung nachstempeln ===");
console.log("");
console.log("  Zeilen, deren Rechnung den Messwert weiter trifft: " + gestempelt.length);
for (const f of gestempelt) console.log("    " + f);
console.log("");
console.log("  Zeilen, die VERALTET bleiben (neue Messung im Spiel noetig): "
  + bleibtVeraltet.length);
for (const f of bleibtVeraltet) console.log("    " + f);
if (fehlt.length) {
  console.log("");
  console.log("  Datei nicht (mehr) unter src/: " + fehlt.join(", "));
}
console.log("");

if (SCHREIB && gestempelt.length) {
  fs.writeFileSync(MESSUNG, JSON.stringify(daten, null, 1) + "\n", "utf8");
  console.log("  Geschrieben: " + path.relative(ROOT, MESSUNG));
} else if (!SCHREIB) {
  console.log("  Trockenlauf. Mit --schreib wird geschrieben.");
}
console.log("");
