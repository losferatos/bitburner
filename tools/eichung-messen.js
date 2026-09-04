/**
 * Eine NEUE RAM-Messung aus dem Spiel in die Eichung uebernehmen.
 *
 * ===========================================================================
 * DER UNTERSCHIED ZU `eichung-stempeln.js`
 * ===========================================================================
 *
 * `tools/eichung-stempeln.js` zieht nur die BUCHFUEHRUNG nach: es stempelt
 * eine Zeile neu, wenn die Rechnung den alten Messwert weiterhin trifft - also
 * wenn die Aenderung den Speicherbedarf gar nicht beruehrt hat. Es kann
 * ausdruecklich keine Messung ersetzen.
 *
 * Genau die fehlt aber, sobald sich der Bedarf WIRKLICH aendert. Am 04.09.2026
 * war das bei `popups.js` (3,3 -> 3,95 GB durch `lib/hostdatei.js`) und
 * `export.js` (2,25 -> 3,35 GB durch `ns.getResetInfo`) der Fall. Ohne dieses
 * Werkzeug bleiben nur zwei schlechte Wege: die Ausnahmeliste
 * `VERALTET_ERLAUBT` verlaengern (dann schrumpft die Eichung unbemerkt - der
 * Zustand, aus dem Befund M.3 entstand), oder den Wert von Hand eintragen
 * (dann ist er behauptet, nicht gemessen).
 *
 * ===========================================================================
 * DIE QUELLE IST DAS SPIEL, NICHT DER RECHNER
 * ===========================================================================
 *
 * Uebernommen wird ausschliesslich, was `src/startdiag.js` im Spiel ueber
 * `ns.getScriptRam(datei, "home")` erhoben hat - dieselbe Funktion, die auch
 * der Kern beim Starten benutzt. Das Ergebnis liegt in
 * `data/startdiag.json`.
 *
 * Zwei Waechter dagegen, dass daraus ein Wegstempeln wird:
 *
 *   - Die Messung muss FRISCH sein (Vorgabe: hoechstens 30 Minuten). Eine
 *     alte Sonde beschreibt einen Dateistand, den es nicht mehr gibt.
 *   - Der lokale Rechner muss denselben Wert liefern. Weichen Spiel und
 *     Rechner ab, ist das ein BEFUND und keine Buchungsangelegenheit: dann
 *     stimmt entweder die RAM-Tabelle des Projekts nicht mehr oder die
 *     Sonde hat etwas anderes gemessen als gemeint. In dem Fall wird nichts
 *     geschrieben.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/eichung-messen.js                 zeigt, was passieren wuerde
 *   node tools/eichung-messen.js --schreib       schreibt
 *   node tools/eichung-messen.js --schreib popups.js export.js
 *
 * Exit 0 = jede genannte Datei ist uebernommen oder war schon richtig.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");
const MESSUNG = path.join(ROOT, "doku", "ram-messung-2026-09-04.json");
const BASE = "http://localhost:8795";

const argv = process.argv.slice(2);
const SCHREIB = argv.includes("--schreib");
const genannt = argv.filter((a) => !a.startsWith("--"));
const MAX_ALTER_MS = 30 * 60000;

async function rpc(params) {
  const q = new URLSearchParams({ instance: "LIVE", ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");

// DER GEGENRECHNER MUSS WIRKLICH RECHNEN (04.09.2026, 20:00).
//
// Hier stand ein Import auf `./lib/ramrechner.js` - die Datei gibt es nicht,
// der catch lieferte `null`, und damit war der zweite Waechter still
// abgeschaltet. Das Werkzeug haette jede Abweichung wegstempeln koennen,
// also genau das getan, wogegen es gebaut ist. Ein Ausschluss gilt nur,
// wenn das benutzte Werkzeug den ausgeschlossenen Fall auch anzeigen kann.
//
// `rechne` aus `tools/ram.js` ist dieselbe Quelle, die `tools/test-ram.js`
// benutzt.
import { rechne } from "./ram.js";
//
// UND ER MUSS DIESELBE STUFE RECHNEN. Die Eichung fuehrt `live41`/`lokal41`,
// also SF4-STUFE 1 - den teuersten Fall, in dem Singularity-Funktionen das
// Sechzehnfache kosten. Ohne `{ sf4: 1 }` rechnet `rechne` den Grundpreis,
// und der Vergleich meldet dann eine Abweichung, die keine ist: fuer
// `export.js` standen sich 19,35 GB (Spiel) und 4,35 GB (Grundpreis)
// gegenueber - derselbe Wert, nur einmal mit und einmal ohne den
// Multiplikator aus `RamCostGenerator.ts`.
const rechneRam = (name) => {
  const r = rechne(name, { sf4: 1 });
  return typeof r === "number" ? r : (r && Number.isFinite(r.gb) ? r.gb : null);
};

console.log("");
console.log("=== Neue RAM-Messung aus dem Spiel uebernehmen ===");
console.log("");

let diag;
try {
  diag = JSON.parse(await rpc({ method: "getFile", filename: "data/startdiag.json", server: "home" }));
} catch (e) {
  console.log("  data/startdiag.json nicht lesbar: " + e.message);
  console.log("  Erst messen:  node tools/task.js startdiag.js <datei> [...]");
  process.exit(1);
}

const alterMin = (Date.now() - diag.zeit) / 60000;
if (Date.now() - diag.zeit > MAX_ALTER_MS) {
  console.log("  Die Sonde ist " + alterMin.toFixed(0) + " min alt (Grenze 30).");
  console.log("  Eine alte Messung beschreibt einen Dateistand, den es nicht mehr gibt.");
  console.log("  Erst neu messen:  node tools/task.js startdiag.js <datei> [...]");
  process.exit(1);
}
console.log("  Sonde ist " + alterMin.toFixed(1) + " min alt.");
console.log("");

const eichung = JSON.parse(fs.readFileSync(MESSUNG, "utf8"));
const nachName = new Map(eichung.map((z) => [z.file, z]));

let uebernommen = 0, unveraendert = 0, abgelehnt = 0;

for (const z of diag.zeilen || []) {
  const name = z.datei;
  if (genannt.length && !genannt.includes(name)) continue;
  if (!(z.ramGb > 0)) {
    console.log("  UEBERSPRUNGEN " + name.padEnd(20) + "im Spiel nicht uebersetzbar (0 GB)");
    abgelehnt++;
    continue;
  }
  const lokalPfad = path.join(SRC, name);
  if (!fs.existsSync(lokalPfad)) {
    console.log("  UEBERSPRUNGEN " + name.padEnd(20) + "gibt es lokal nicht");
    continue;
  }
  const inhalt = fs.readFileSync(lokalPfad, "utf8");
  const h = sha(inhalt);
  const alt = nachName.get(name);

  if (alt && alt.sha256 === h && alt.live41 === z.ramGb) {
    console.log("  schon richtig " + name.padEnd(20) + z.ramGb + " GB");
    unveraendert++;
    continue;
  }

  // Der Waechter: weicht der lokale Rechner ab, ist das ein Befund.
  if (rechneRam) {
    let lokal = null;
    try { lokal = rechneRam(name); } catch { lokal = null; }
    if (Number.isFinite(lokal) && Math.abs(lokal - z.ramGb) > 0.001) {
      console.log("  ABGELEHNT     " + name.padEnd(20) + "Spiel " + z.ramGb
        + " GB, Rechner " + lokal + " GB - das ist ein BEFUND, keine Buchung.");
      abgelehnt++;
      continue;
    }
  }

  console.log("  UEBERNEHMEN   " + name.padEnd(20)
    + (alt ? alt.live41 + " -> " : "(neu) ") + z.ramGb + " GB");
  if (SCHREIB) {
    if (alt) {
      alt.live41 = z.ramGb;
      alt.lokal41 = z.ramGb;
      alt.diff = 0;
      alt.sha256 = h;
      alt.bytes = Buffer.byteLength(inhalt, "utf8");
      alt.gemessenAm = new Date(diag.zeit).toISOString();
      alt.quelle = "startdiag.js (ns.getScriptRam im Spiel)";
    } else {
      eichung.push({
        file: name, live41: z.ramGb, lokal41: z.ramGb, diff: 0,
        sha256: h, bytes: Buffer.byteLength(inhalt, "utf8"),
        gemessenAm: new Date(diag.zeit).toISOString(),
        quelle: "startdiag.js (ns.getScriptRam im Spiel)",
      });
    }
  }
  uebernommen++;
}

if (SCHREIB && uebernommen) {
  fs.writeFileSync(MESSUNG, JSON.stringify(eichung, null, 1) + "\n", "utf8");
  console.log("");
  console.log("  Geschrieben: " + path.relative(ROOT, MESSUNG));
}

console.log("");
console.log("=== " + uebernommen + " uebernommen, " + unveraendert + " schon richtig, "
  + abgelehnt + " abgelehnt ===");
if (!SCHREIB && uebernommen) console.log("  Trockenlauf. Mit --schreib wird geschrieben.");
console.log("");
process.exitCode = abgelehnt ? 1 : 0;
