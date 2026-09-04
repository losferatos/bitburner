/**
 * Loest die Importkette einer Datei auf und prueft, ob JEDES Glied im Spiel
 * liegt - bevor eingespielt wird.
 *
 * ===========================================================================
 * WOZU
 * ===========================================================================
 *
 * Ein fehlender Import ist in Bitburner kein leiser Fehler, sondern ein
 * sofortiger Tod des Skripts beim Start: die Engine kann das Modul nicht
 * aufloesen und bricht ab. Bei einem SCHLAFENDEN Gewerk faellt das nicht auf,
 * weil es niemand startet - bis der Kern es Stunden spaeter startet und es
 * still stirbt.
 *
 * Genau das ist die gefaehrliche Bauform des gestuften Hot-Swaps: die neue
 * Fassung einer Datei bringt einen neuen Import mit, der erst in einer
 * SPAETEREN Stufe eingespielt wird. Zwischen beiden Stufen ist die Datei
 * kaputt, und zwar unsichtbar.
 *
 * `tools/einspielen.js` prueft, ob die Datei ANGEKOMMEN ist. Dieses Werkzeug
 * prueft, ob sie danach auch LAUFEN kann.
 *
 * ===========================================================================
 * WAS ES NICHT KANN
 * ===========================================================================
 *
 * Es liest statische `import ... from "..."`-Zeilen. Ein dynamisches
 * `await import(variable)` sieht es nicht. Im Projekt gibt es keines - das
 * ist mit `grep -n "import(" src/` geprueft und muss geprueft bleiben, wenn
 * jemand eines einbaut.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/importpruefung.js blade.js bbtrain.js ...
 *   node tools/importpruefung.js --mit <datei> [...] -- <auch-diese-stufe> [...]
 *
 * Die Form mit `--mit` beantwortet die eigentliche Frage einer Stufe:
 * "wenn ich DIESE Dateien zusammen einspiele, ist danach alles aufloesbar?"
 * Dateien nach `--` gelten als mit-eingespielt, auch wenn sie im Spiel noch
 * fehlen.
 *
 * Exit 0 = jede Importkette ist geschlossen.
 * Exit 1 = mindestens ein Glied fehlt.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");
const BASE = "http://localhost:8795";

const argv = process.argv.slice(2);
const trenner = argv.indexOf("--");
const ziele = (trenner >= 0 ? argv.slice(0, trenner) : argv).filter((a) => !a.startsWith("--"));
const mitStufe = trenner >= 0 ? argv.slice(trenner + 1) : [];

if (!ziele.length) {
  console.log("Aufruf: node tools/importpruefung.js <datei> [...] [-- <mit-eingespielt> ...]");
  process.exit(1);
}

async function imSpiel(datei) {
  const q = new URLSearchParams({ instance: "LIVE", method: "getFile", server: "home", filename: datei });
  try {
    const b = await (await fetch(BASE + "/api/rpc?" + q)).json();
    return b.result !== null && b.result !== undefined;
  } catch {
    return false;
  }
}

/**
 * Importe einer Datei. Bitburner-Pfade sind absolut ab Serverwurzel:
 * `import { x } from "lib/kpi.js"` meint die Datei `lib/kpi.js` auf home.
 * Ein fuehrender Schraegstrich kommt vor und meint dasselbe.
 */
function importeVon(inhalt) {
  const raus = new Set();
  const muster = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["']([^"']+)["']/gm;
  let m;
  while ((m = muster.exec(inhalt)) !== null) {
    let p = m[1];
    if (p.startsWith("./")) p = p.slice(2);
    if (p.startsWith("/")) p = p.slice(1);
    raus.add(p);
  }
  return [...raus];
}

const cacheSpiel = new Map();
async function liegtVor(datei) {
  if (mitStufe.includes(datei)) return "mit dieser Stufe";
  if (cacheSpiel.has(datei)) return cacheSpiel.get(datei);
  const da = (await imSpiel(datei)) ? "im Spiel" : null;
  cacheSpiel.set(datei, da);
  return da;
}

console.log("");
console.log("=== Importketten pruefen ===");
if (mitStufe.length) console.log("  (als mit-eingespielt gelten: " + mitStufe.join(" ") + ")");
console.log("");

let fehlend = 0;
const gesehen = new Set();

async function kette(datei, tiefe, pfad) {
  if (gesehen.has(datei)) return;
  gesehen.add(datei);

  const lokal = path.join(SRC, datei);
  if (!fs.existsSync(lokal)) {
    // Ein Glied, das es lokal gar nicht gibt, kann auch nicht eingespielt
    // werden. Das ist der schlimmste Fall - dann ist der Import schlicht tot.
    const da = await liegtVor(datei);
    if (!da) {
      console.log("  ".repeat(tiefe) + "FEHLT UEBERALL  " + datei + "   <- " + pfad);
      fehlend++;
    } else {
      console.log("  ".repeat(tiefe) + "nur im Spiel    " + datei);
    }
    return;
  }

  const inhalt = fs.readFileSync(lokal, "utf8");
  for (const imp of importeVon(inhalt)) {
    const da = await liegtVor(imp);
    if (!da) {
      console.log("  ".repeat(tiefe) + "FEHLT IM SPIEL  " + imp + "   <- " + datei);
      fehlend++;
    } else {
      console.log("  ".repeat(tiefe) + "ok " + da.padEnd(17) + imp + "   <- " + datei);
    }
    await kette(imp, tiefe + 1, datei);
  }
}

for (const z of ziele) {
  console.log("--- " + z);
  const lokal = path.join(SRC, z);
  if (!fs.existsSync(lokal)) {
    console.log("  FEHLT LOKAL - kann nicht eingespielt werden");
    fehlend++;
    continue;
  }
  const imps = importeVon(fs.readFileSync(lokal, "utf8"));
  if (!imps.length) console.log("  (importiert nichts)");
  await kette(z, 1, "(Wurzel)");
}

console.log("");
console.log(fehlend
  ? "=== " + fehlend + " fehlendes Glied - NICHT einspielen ==="
  : "=== alle Ketten geschlossen ===");
console.log("");
process.exitCode = fehlend ? 1 : 0;
