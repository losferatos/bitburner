/**
 * Eine STUFE einspielen - Datei fuer Datei, mit Gegenprobe.
 *
 * ===========================================================================
 * WARUM NICHT EINFACH DER WATCHER
 * ===========================================================================
 *
 * Der uebliche Weg ins Spiel ist die Dateibeobachtung: `src/` aendern, 400 ms
 * spaeter liegt es drin. Fuer einen gestuften Hot-Swap taugt der nicht:
 *
 * - Er schiebt, was sich geaendert hat, nicht was man ausgewaehlt hat. Eine
 *   Stufe waere damit nicht abgrenzbar.
 * - Er zaehlt einen Schub als EINEN Eingriff. Fuer die Abnahme ist aber
 *   interessant, welche Datei wann hineinging.
 * - Und er sagt nicht, ob die Datei angekommen IST. Der Auftrag verlangt
 *   genau das: "Ein Swap, dessen neue version nicht auftaucht, ist NICHT
 *   eingespielt."
 *
 * Dieses Werkzeug schiebt deshalb Datei fuer Datei ueber das Dashboard und
 * liest jede danach WIEDER AUS. Verglichen wird der sha256 - nicht die
 * Laenge, nicht "kein Fehler zurueckgekommen".
 *
 * ===========================================================================
 * WAS ES NICHT TUT
 * ===========================================================================
 *
 * Es startet nichts neu. Das ist Absicht: ein Neustart ist der Moment, in dem
 * die neue Fassung wirklich wirkt, und der gehoert in eine eigene, bewusste
 * Handlung (`node tools/hand.js reload "WERKZEUG <name>.js"`). Wer beides in
 * einem Werkzeug hat, macht aus zwei Entscheidungen eine.
 *
 * Es prueft auch die Checkliste nicht - das tut `tools/hotswap.js`.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/einspielen.js --stufe 1 lib/uhren.js lib/kpi.js ...
 *   node tools/einspielen.js --pruefen  lib/uhren.js       (nur vergleichen)
 *
 * Exit 0 = alle Dateien liegen mit dem erwarteten Inhalt im Spiel.
 * Exit 1 = mindestens eine nicht.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const BASE = "http://localhost:8795";

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes("--pruefen");
const stufeIdx = argv.indexOf("--stufe");
const STUFE = stufeIdx >= 0 ? argv[stufeIdx + 1] : "?";
const dateien = argv.filter((a, i) =>
  !a.startsWith("--") && !(stufeIdx >= 0 && i === stufeIdx + 1));

if (!dateien.length) {
  console.log("Aufruf: node tools/einspielen.js [--stufe N] [--pruefen] <datei> [...]");
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

console.log("");
console.log("=== Einspielen, Stufe " + STUFE + " - " + dateien.length + " Datei(en) ===");
console.log("");

let ok = 0;
let fehler = 0;
const bericht = [];

for (const d of dateien) {
  const lokal = path.join(ROOT, "src", d);
  if (!fs.existsSync(lokal)) {
    console.log("  FEHLT LOKAL  " + d);
    fehler++;
    bericht.push({ datei: d, stand: "fehlt lokal" });
    continue;
  }
  const soll = fs.readFileSync(lokal, "utf8");

  // Vorher: was liegt im Spiel?
  let vorher = null;
  try {
    vorher = await rpc({ method: "getFile", filename: d, server: "home" });
  } catch {
    vorher = null;      // liegt noch nicht drin
  }

  if (vorher === soll) {
    console.log("  schon drin   " + d + "  (" + hash(soll) + ")");
    ok++;
    bericht.push({ datei: d, stand: "unveraendert", hash: hash(soll) });
    continue;
  }

  if (NUR_PRUEFEN) {
    console.log("  WUERDE       " + d + "  " + (vorher === null ? "(neu)" : hash(vorher))
      + " -> " + hash(soll));
    bericht.push({ datei: d, stand: "offen", vorher: vorher === null ? null : hash(vorher), soll: hash(soll) });
    continue;
  }

  try {
    await rpc({ method: "pushFile", filename: d, server: "home", content: soll });
  } catch (e) {
    console.log("  ABGEWIESEN   " + d + "  " + e.message);
    fehler++;
    bericht.push({ datei: d, stand: "abgewiesen", grund: e.message });
    continue;
  }

  // DIE GEGENPROBE. Ohne sie hiesse "kein Fehler zurueckgekommen" dasselbe
  // wie "angekommen", und das ist in diesem Projekt schon einmal teuer
  // gewesen.
  let nachher = null;
  try {
    nachher = await rpc({ method: "getFile", filename: d, server: "home" });
  } catch (e) {
    nachher = null;
  }
  if (nachher === soll) {
    console.log("  EINGESPIELT  " + d + "  " + (vorher === null ? "(neu)" : hash(vorher))
      + " -> " + hash(soll));
    ok++;
    bericht.push({ datei: d, stand: "eingespielt", vorher: vorher === null ? null : hash(vorher), hash: hash(soll) });
  } else {
    console.log("  NICHT ANGEKOMMEN " + d + " - geschrieben, aber der Inhalt stimmt nicht");
    fehler++;
    bericht.push({ datei: d, stand: "inhalt weicht ab", soll: hash(soll), ist: nachher === null ? null : hash(nachher) });
  }
}

console.log("");
console.log("=== " + ok + " in Ordnung, " + fehler + " Fehler ===");
if (!NUR_PRUEFEN && !fehler) {
  console.log("");
  console.log("  Die Dateien LIEGEN im Spiel. Sie WIRKEN erst nach einem Neustart");
  console.log("  des jeweiligen Skripts - das ist ein eigener Handgriff:");
  console.log("      node tools/hand.js reload \"WERKZEUG <name>.js\"");
  console.log("      node tools/hand.js reload \"SELBST bn4net.js\"   (fuer den Kern)");
}
console.log("");
// `process.exit()` reisst unter Windows offene fetch-Handles mit und Node
// meldet dann "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)". Der
// Rueckgabewert genuegt - der Prozess endet von selbst, sobald nichts mehr
// laeuft.
process.exitCode = fehler ? 1 : 0;
