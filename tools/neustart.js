/**
 * Ein Werkzeug im Spiel neu starten - und BELEGEN, dass es neu gestartet ist.
 *
 * ===========================================================================
 * WARUM ES DIESES WERKZEUG GIBT
 * ===========================================================================
 *
 * Mehrere Stellen im Projekt nennen den Aufruf
 * `node tools/hand.js reload "WERKZEUG blade.js"` - `tools/einspielen.js` in
 * seiner Abschlussmeldung, `tools/rollback.js`, das Einspielprotokoll.
 * **Diesen Aufruf gibt es nicht.** `tools/hand.js` kennt kein `reload`; es
 * setzt Terminalbefehle ab, und der Terminalkanal antwortet derzeit gar nicht
 * ("Terminal nicht erreichbar - steht ein Fenster im Weg?", 04.09.2026,
 * 18:4x). Wer der Meldung folgt, startet nichts neu und merkt es nicht.
 *
 * Der Neustart laeuft in Wahrheit ueber `data/reload.txt`: die Datei wird
 * geschrieben, der LAUFENDE Kern liest sie in seiner naechsten Runde, killt
 * das Werkzeug netzweit und laesst es von der Werkzeugliste neu starten.
 *
 * ===========================================================================
 * WARUM DER BELEG NICHT VERHANDELBAR IST
 * ===========================================================================
 *
 * Am 27.08.2026 sind drei Aenderungen an `blade.js` eingebaut, committet und
 * "neu gestartet" worden - und blieben wirkungslos. Der Prozess lief die ganze
 * Zeit unter derselben PID mit altem Code. Der Befehl war ohne `.js`
 * geschrieben, traf ins Leere, und die Meldung sagte trotzdem Erfolg. Es hat
 * einen Nachmittag gekostet, und gefunden hat es erst ein PID-Vergleich.
 *
 * Deshalb tut dieses Werkzeug drei Dinge und nicht eines:
 *
 *   1. Es merkt sich die PID VORHER (ueber `data/ps.json`, frisch geholt).
 *   2. Es schreibt `data/reload.txt` und wartet, bis der Kern die Datei
 *      LEERT - das ist die Quittung, dass er den Auftrag gesehen hat.
 *   3. Es holt die Prozessliste erneut und vergleicht die PID.
 *
 * Erst wenn die PID eine andere ist, gilt der Neustart als geschehen. "Kein
 * Fehler zurueckgekommen" gilt nicht.
 *
 * ===========================================================================
 * DER KERN GEHT ANDERS
 * ===========================================================================
 *
 * `bn4net.js` lehnt "WERKZEUG bn4net.js" ausdruecklich ab: die Schleife
 * wuerde sich selbst beenden, und ob jemand zurueckkommt, haengt dann an der
 * Wache in `popups.js`. Genau daran ist am 25.08. um 05:59 ein Wiederanlauf
 * gescheitert. Fuer den Kern gibt es `SELBST bn4net.js` - das beendet ihn an
 * definierter Stelle, und `bn4life.js` holt ihn zurueck. Dieses Werkzeug
 * waehlt den richtigen Kanal von selbst.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/neustart.js popups.js
 *   node tools/neustart.js blade.js bbtrain.js      (nacheinander, je mit Beleg)
 *   node tools/neustart.js --nurpruefen popups.js   (nur die PID zeigen)
 *
 * Exit 0 = jedes genannte Werkzeug laeuft unter einer NEUEN PID.
 * Exit 1 = mindestens eines nicht.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const BASE = "http://localhost:8795";

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes("--nurpruefen");
const ziele = argv.filter((a) => !a.startsWith("--")).map((z) => z.endsWith(".js") ? z : z + ".js");

if (!ziele.length) {
  console.log("Aufruf: node tools/neustart.js [--nurpruefen] <werkzeug.js> [...]");
  process.exit(1);
}

async function rpc(params) {
  const { content, ...rest } = params;
  const q = new URLSearchParams({ instance: "LIVE", ...rest });
  const res = content === undefined
    ? await fetch(BASE + "/api/rpc?" + q)
    : await fetch(BASE + "/api/rpc?" + q, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Frische Prozessliste. `ps.js` ist ein Einmalskript und steht NICHT in der
 * Registry - es laeuft ueber den Auftragslaeufer (`data/task.txt`). Die
 * Wartezeit richtet sich nach der Motorrunde des Kerns, nicht nach einer
 * Sekundenzahl: gemessen am 04.09.2026 lagen zwischen Auftrag und frischem
 * Ergebnis rund 50 Sekunden.
 */
async function prozesse(maxWartenMs = 900000) {
  const vorher = await psStand();
  // DER AUFTRAG IST EIN JSON-ARRAY, KEINE NACKTE ZEILE (04.09.2026).
  //
  // `tools/task.js` schreibt `JSON.stringify(args)`, also `["ps.js"]`. Hier
  // stand `"ps.js"` - der Kern hat die Datei gelesen, nicht verstanden und
  // GELEERT. Von aussen sah das aus wie "der Auftragslaeufer antwortet
  // nicht", und der Beleg fuer den Neustart waere ausgeblieben, obwohl der
  // Kanal voellig in Ordnung ist.
  await rpc({
    method: "pushFile", filename: "data/task.txt", server: "home",
    content: JSON.stringify(["ps.js"]),
  });
  // DIE WARTEZEIT RICHTET SICH NACH DER MOTORRUNDE, NICHT NACH DER WANDUHR.
  //
  // Der Spieltab ist verdeckt und wird vom Browser gedrosselt: gemessen am
  // 04.09.2026 lief der Motor mit 0,39 Runden je Minute statt 4-6 - eine
  // Runde dauert also rund zweieinhalb Minuten statt zehn Sekunden. Mit 150 s
  // Geduld haette dieses Werkzeug einen voellig gesunden Kern fuer tot
  // erklaert. 15 Minuten decken auch einen schlechten Tag ab.
  const bis = Date.now() + maxWartenMs;
  while (Date.now() < bis) {
    await schlaf(5000);
    const d = await psStand();
    if (d && (!vorher || d.zeit > vorher.zeit)) return d;
  }
  return null;
}

async function psStand() {
  try {
    const roh = await rpc({ method: "getFile", filename: "data/ps.json", server: "home" });
    return roh ? JSON.parse(roh) : null;
  } catch { return null; }
}

const finde = (d, name) => (d && d.gesehen || []).find((e) => e.datei === name) || null;

console.log("");
console.log("=== Neustart: " + ziele.join(" ") + " ===");
console.log("");

console.log("  Prozessliste vorher holen ...");
let vorher = await prozesse();
if (!vorher) {
  console.log("  KEINE FRISCHE PROZESSLISTE - der Auftragslaeufer antwortet nicht.");
  console.log("  Ohne PID vorher gibt es keinen Beleg nachher. Abbruch.");
  process.exit(1);
}

for (const z of ziele) {
  const alt = finde(vorher, z);
  console.log("  " + z.padEnd(16) + (alt ? "laeuft auf " + alt.host + ", pid " + alt.pid : "laeuft NICHT"));
}

if (NUR_PRUEFEN) { console.log(""); process.exit(0); }

let fehler = 0;

for (const z of ziele) {
  const alt = finde(vorher, z);
  const kern = z === "bn4net.js";
  const befehl = kern ? "SELBST bn4net.js" : "WERKZEUG " + z;

  console.log("");
  console.log("  --- " + z + "   ->   " + befehl);
  await rpc({ method: "pushFile", filename: "data/reload.txt", server: "home", content: befehl });

  // DIE QUITTUNG. Der Kern LEERT `reload.txt`, sobald er den Auftrag
  // gesehen hat - in beiden Kanaelen. Bleibt die Datei stehen, hat er sie
  // nicht gelesen, und dann ist alles Weitere Kaffeesatz.
  let quittiert = false;
  const bis = Date.now() + 900000;
  while (Date.now() < bis) {
    await schlaf(4000);
    let inhalt = "";
    try { inhalt = (await rpc({ method: "getFile", filename: "data/reload.txt", server: "home" })) || ""; }
    catch { inhalt = ""; }
    if (inhalt.trim() === "") { quittiert = true; break; }
  }
  if (!quittiert) {
    console.log("      KEINE QUITTUNG - reload.txt steht nach 15 min noch da.");
    console.log("      Der Kern liest sie nicht. Neustart NICHT belegt.");
    fehler++;
    continue;
  }
  console.log("      quittiert (reload.txt geleert)");

  // Der Kern braucht danach noch eine Runde zum Nachstarten.
  const nach = await prozesse();
  if (!nach) {
    console.log("      Prozessliste nachher nicht zu bekommen - Neustart NICHT belegt.");
    fehler++;
    continue;
  }
  const neu = finde(nach, z);
  if (!neu) {
    console.log("      GEKILLT, ABER NICHT ZURUECK - " + z + " laeuft nicht mehr.");
    console.log("      Das ist der Fall, vor dem der Kern warnt: der Nachstart");
    console.log("      haengt an einer Werkbank mit freiem Speicher.");
    fehler++;
    continue;
  }
  if (alt && neu.pid === alt.pid) {
    console.log("      PID UNVERAENDERT (" + neu.pid + ") - der alte Code laeuft weiter.");
    fehler++;
    continue;
  }
  console.log("      NEU GESTARTET  pid " + (alt ? alt.pid : "(lief nicht)") + " -> " + neu.pid
    + "  auf " + neu.host);
  vorher = nach;
}

console.log("");
console.log(fehler ? "=== " + fehler + " NICHT belegt ===" : "=== alle Neustarts belegt ===");
console.log("");
process.exitCode = fehler ? 1 : 0;
