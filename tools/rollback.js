/**
 * Den Spielstand VOR der Einspielung wiederherstellen - byte-genau.
 *
 * ===========================================================================
 * WARUM NICHT `git checkout <hash> -- <datei>`
 * ===========================================================================
 *
 * Weil das nicht zurueckgibt, was im Spiel LAG. Gemessen am 04.09.2026,
 * 17:45, unmittelbar vor der Einspielung:
 *
 *     Datei          Spiel          Commit vor dem Merge
 *     bn4net.js      dc0075c7e610   fb3466fd63d7      ABWEICHUNG
 *     wakelock.js    55b09f562b62   950597d469ed      ABWEICHUNG
 *     boot.js        3f789382c43e   3f789382c43e      gleich
 *     popups.js      d6ccd79fee51   d6ccd79fee51      gleich
 *
 * Zwei von vier Stichproben wichen ab: die Spielfassung war AELTER als der
 * Commit. Ein `git checkout` haette dort also nicht zurueckgerollt, sondern
 * eine dritte, nie gelaufene Fassung eingespielt - im Notfall, unter
 * Zeitdruck, und ohne dass es jemandem aufgefallen waere.
 *
 * Der Grund ist einfach: was im Spiel liegt, ist der Stand des letzten
 * erfolgreichen Schubs, und der faellt nicht mit einem Commit zusammen.
 *
 * ===========================================================================
 * WAS HIER LIEGT
 * ===========================================================================
 *
 * `archiv/rollback-2026-09-04/` haelt die exakten Bytes aus dem Spiel, wie
 * sie um 17:45 dort lagen - 24 Dateien. Die uebrigen 25 der Einspielung
 * lagen ueberhaupt noch nicht im Spiel; ihr Rollback ist ein `deleteFile`.
 *
 * Schraegstriche im Pfad sind im Dateinamen durch `_` ersetzt
 * (`lib/kpi.js` -> `lib_kpi.js`).
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/rollback.js --pruefen            was wuerde passieren
 *   node tools/rollback.js --alles              alle 49 zurueck
 *   node tools/rollback.js bn4net.js lib/kpi.js einzelne
 *
 * Danach die betroffenen Skripte neu starten - sonst laeuft die alte Datei
 * mit dem neuen Code im Speicher weiter:
 *   node tools/hand.js reload "SELBST bn4net.js"
 *   node tools/hand.js reload "WERKZEUG <name>.js"
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const ABLAGE = path.join(ROOT, "archiv", "rollback-2026-09-04");
const BASE = "http://localhost:8795";

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes("--pruefen");
const ALLES = argv.includes("--alles");
const genannt = argv.filter((a) => !a.startsWith("--"));

/**
 * Die vollstaendige Einspielliste. Sie steht HIER und nicht in
 * `data/schub-offen.json`: diese Datei wird von der Bruecke ueberschrieben,
 * sobald der naechste Schub verweigert wird - und ein Rollback-Werkzeug, das
 * seine Liste aus einer fluechtigen Datei zieht, hat im Ernstfall keine.
 */
const EINGESPIELT = [
  "ausgang.js", "bbtrain.js", "blade.js", "bn4life.js", "bn4net.js", "bn4rep.js",
  "boerse.js", "boot.js", "buyaugs.js", "cdump.js", "contracts.js", "csolve.js",
  "darkweb.js", "exit.js", "export.js", "figwatch.js", "graft.js", "graftauto.js",
  "graftplan.json", "guard.js", "hashes.js", "homeram.js", "join.js", "kampfaugs.js",
  "lib/bitnodes.json", "lib/calc.js", "lib/endspurt.js", "lib/eta.js", "lib/events.js",
  "lib/figur.js", "lib/figurns.js", "lib/graftwahl.js", "lib/handschlag.js",
  "lib/herzschlag.js", "lib/kpi.js", "lib/leiter.js", "lib/loeser.js",
  "lib/motorzeit.js", "lib/reg.js", "lib/route.js", "lib/uhren.js", "popups.js",
  "probe.js", "punish.js", "registry.json", "shop.js", "stopnight.js", "travel.js",
  "wakelock.js",
];

const ziel = ALLES ? EINGESPIELT : genannt;
if (!ziel.length) {
  console.log("Aufruf: node tools/rollback.js [--pruefen] (--alles | <datei> [...])");
  process.exit(1);
}

async function rpc(params) {
  const q = new URLSearchParams({ instance: "LIVE", ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

const hash = (t) => createHash("sha256").update(t, "utf8").digest("hex").slice(0, 12);
const ablageName = (d) => path.join(ABLAGE, d.split("/").join("_"));

console.log("");
console.log("=== ROLLBACK auf den Stand vom 04.09.2026, 17:45 ===");
console.log("");
if (NUR_PRUEFEN) console.log("  (Trockenlauf - es wird nichts geschrieben)");
console.log("");

let zurueck = 0;
let geloescht = 0;
let fehler = 0;

for (const d of ziel) {
  const kopie = ablageName(d);
  const hatKopie = fs.existsSync(kopie);

  if (!hatKopie) {
    // Die Datei lag vor der Einspielung nicht im Spiel. Rollback = weg damit.
    if (NUR_PRUEFEN) {
      console.log("  WUERDE LOESCHEN  " + d + "  (lag vorher nicht im Spiel)");
      continue;
    }
    try {
      await rpc({ method: "deleteFile", filename: d, server: "home" });
      console.log("  GELOESCHT        " + d);
      geloescht++;
    } catch (e) {
      // "not found" ist hier kein Fehler, sondern das Ziel.
      if (/not found|does not exist/i.test(e.message)) {
        console.log("  lag schon nicht drin  " + d);
      } else {
        console.log("  FEHLER           " + d + "  " + e.message);
        fehler++;
      }
    }
    continue;
  }

  const soll = fs.readFileSync(kopie, "utf8");
  let ist = null;
  try { ist = await rpc({ method: "getFile", filename: d, server: "home" }); }
  catch { ist = null; }

  if (ist === soll) {
    console.log("  schon zurueck    " + d + "  (" + hash(soll) + ")");
    zurueck++;
    continue;
  }
  if (NUR_PRUEFEN) {
    console.log("  WUERDE ZURUECK   " + d + "  " + (ist === null ? "(fehlt)" : hash(ist))
      + " -> " + hash(soll));
    continue;
  }

  try {
    await rpc({ method: "pushFile", filename: d, server: "home", content: soll });
  } catch (e) {
    console.log("  ABGEWIESEN       " + d + "  " + e.message);
    fehler++;
    continue;
  }
  // Gegenprobe, wie beim Einspielen: geschrieben ist nicht angekommen.
  let nach = null;
  try { nach = await rpc({ method: "getFile", filename: d, server: "home" }); }
  catch { nach = null; }
  if (nach === soll) {
    console.log("  ZURUECK          " + d + "  " + hash(soll));
    zurueck++;
  } else {
    console.log("  NICHT ANGEKOMMEN " + d);
    fehler++;
  }
}

console.log("");
console.log("=== " + zurueck + " zurueckgerollt, " + geloescht + " geloescht, "
  + fehler + " Fehler ===");
if (!NUR_PRUEFEN && !fehler) {
  console.log("");
  console.log("  Die Dateien liegen wieder auf dem alten Stand. Ein LAUFENDES");
  console.log("  Skript hat aber noch den neuen Code im Speicher - es muss neu");
  console.log("  gestartet werden, sonst ist der Rollback nur halb:");
  console.log("      node tools/hand.js reload \"SELBST bn4net.js\"");
  console.log("      node tools/hand.js reload \"WERKZEUG <name>.js\"");
}
console.log("");
process.exitCode = fehler ? 1 : 0;
