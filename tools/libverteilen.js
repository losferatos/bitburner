/**
 * Bibliotheken auf die Rechner verteilen, auf denen Werkzeuge laufen koennen.
 *
 * ===========================================================================
 * DER ANLASS - UND WARUM ES DIE GANZE EINSPIELUNG BETRIFFT
 * ===========================================================================
 *
 * Gemessen am 04.09.2026, 18:2x. Nach `WERKZEUG ausgang.js` war das Werkzeug
 * weg und kam nicht zurueck. Der Kern schrieb alle zehn Sekunden:
 *
 *     ausgang.js liess sich auf werk-0 nicht starten (exec gab 0).
 *
 * Die Ursache steht im LAUFENDEN Kern:
 *
 *     const BIBLIOTHEKEN = ["lib/hackaugs.js"];
 *     ...
 *     ns.scp([datei, ...BIBLIOTHEKEN], wirt, "home");
 *
 * Er kopiert genau EINE Bibliothek mit. Die neue `ausgang.js` importiert vier
 * (`lib/route.js`, `lib/eta.js`, `lib/events.js`, `lib/handschlag.js`), und
 * keine davon lag auf werk-0. Bitburner loest Importe beim Uebersetzen auf
 * und braucht sie auf DEMSELBEN Rechner - fehlt eine, gibt `ns.exec` 0
 * zurueck.
 *
 * Das ist die gefaehrliche Stelle des gestuften Hot-Swaps und sie war im Plan
 * nicht vorgesehen: Der neue Kern liest `needsLibs` aus `registry.json` und
 * kopiert richtig - aber er kommt eine Stufe SPAETER als die Werkzeuge, die
 * darauf angewiesen sind. Zwischen beiden Stufen ist jedes Werkzeug mit neuen
 * Importen tot, sobald es einmal neu startet, und der einzige Hinweis darauf
 * ist eine Logzeile, die niemand liest.
 *
 * `tools/importpruefung.js` sah das NICHT: es prueft gegen `home`, und auf
 * home lag alles.
 *
 * ===========================================================================
 * WAS DIESES WERKZEUG TUT
 * ===========================================================================
 *
 * Es legt die Bibliotheken auf jeden Rechner, den der Kern als Wirt waehlen
 * koennte. Damit ist es egal, welchen er nimmt. Das ist eine Kruecke fuer die
 * Dauer der Einspielung - der neue Kern braucht sie nicht mehr.
 *
 * Es benutzt `pushFile` ueber die Bruecke, nicht `ns.scp`: Ein Skript im
 * Spiel muesste dafuer erst laufen, und genau das tut es ja nicht.
 *
 *   node tools/libverteilen.js --pruefen     was fehlt wo
 *   node tools/libverteilen.js               verteilen
 *
 * Exit 0 = jede Bibliothek liegt auf jedem Kandidaten.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");
const BASE = "http://localhost:8795";
const NUR_PRUEFEN = process.argv.includes("--pruefen");
const ENTFERNEN = process.argv.includes("--entfernen");

async function rpc(params) {
  const { content, ...rest } = params;
  const q = new URLSearchParams({ instance: "LIVE", ...rest });
  const res = content === undefined
    ? await fetch(BASE + "/api/rpc?" + q)
    : await fetch(BASE + "/api/rpc?" + q, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

/** Alle lib/-Dateien, die es lokal gibt. Lieber eine zuviel als eine zuwenig
 *  - sie kosten auf dem Zielrechner keinen Arbeitsspeicher, solange sie
 *  niemand importiert. */
const LIBS = fs.readdirSync(path.join(SRC, "lib"))
  .filter((d) => d.endsWith(".js"))
  .map((d) => "lib/" + d);

/**
 * Die Wirte. `data/startdiag.json` nennt sie, wenn die Sonde gelaufen ist;
 * sonst die Rechner aus der Prozessliste plus die gekauften.
 */
async function wirte() {
  const raus = new Set(["home"]);
  try {
    const d = JSON.parse(await rpc({ method: "getFile", filename: "data/startdiag.json", server: "home" }));
    for (const z of d.zeilen || []) for (const p of z.passtAuf || []) raus.add(p.host);
  } catch { /* Sonde nicht gelaufen */ }
  try {
    const d = JSON.parse(await rpc({ method: "getFile", filename: "data/ps.json", server: "home" }));
    for (const e of d.gesehen || []) raus.add(e.host);
  } catch { /* keine Prozessliste */ }
  // Die gekauften Rechner heissen werk-N. Sie sind die ueblichen Wirte, und
  // sie tauchen in den Listen oben nur auf, wenn dort gerade etwas laeuft.
  for (let i = 0; i < 25; i++) raus.add("werk-" + i);
  return [...raus];
}

const kandidaten = await wirte();
console.log("");
console.log("=== " + LIBS.length + " Bibliotheken auf bis zu " + kandidaten.length + " Wirte ===");
console.log("");

/**
 * ===========================================================================
 * DER RUECKBAU - UND WARUM ER PFLICHT IST (04.09.2026, 19:35)
 * ===========================================================================
 *
 * Die Verteilung war richtig, solange der ALTE Kern lief: der kopierte nur
 * `lib/hackaugs.js` mit, und ohne die uebrigen liess sich kein Werkzeug mit
 * Importen starten. Seit 19:21 laeuft der neue Kern, und der kopiert
 * `needsLibs` aus der Registry beim Start mit
 * (bn4net.js: `ns.scp([datei, ...BIBLIOTHEKEN, ...libs], wirt, "home")`).
 * Damit ist die Kruecke nicht nur ueberfluessig, sondern schaedlich.
 *
 * ZWEI GEMESSENE GRUENDE, beide von Skeptikern gefunden:
 *
 * (1) DER SPIELSTAND HAT SICH MEHR ALS VERDOPPELT. Gemessen 18:24 gegen
 *     18:31: entpackt 4,35 -> 9,19 MB, gzip 0,83 -> 2,17 MB, davon `lib/*`
 *     0,31 -> 4,51 MB. Jeder Autosave im gedrosselten Tab, jede Sicherung
 *     und jeder Export zahlen das mit.
 *
 * (2) UND DAS FRISST DIE RUECKFALLTIEFE. `sync/instanz.js` deckelt die
 *     Sicherungen doppelt: nach Stueckzahl (252 rotierbare) UND nach Bytes
 *     (300 MB je Ort). Bei 0,83 MB je Datei band die Stueckzahl, bei 2,17 MB
 *     bindet das Budget - 252 Dateien waeren 547 MB, also 82 Prozent
 *     darueber. Geraeumt wird in fester Reihenfolge, und die beginnt mit
 *     `pre-hotswap`: der Sicherung UNMITTELBAR VOR einer Codeaenderung,
 *     also genau dem Stand, auf den man zurueckgeht, wenn eine Einspielung
 *     schiefgeht.
 *
 * Das ist woertlich der Fehlermodus, den die Skeptikerrunde in
 * `sync/instanz.js` selbst formuliert hat: "eine Massnahme zum Schutz des
 * Spielstands haette in vier Stunden die Belege weggeraeumt, unbeaufsichtigt,
 * ueber Nacht". Dort wurde er ueber die Stueckzahl behoben - die Verteilung
 * stellt ihn ueber die Bytes wieder her.
 *
 * (3) Ausserdem macht sie aus einem lauten Fehler einen leisen: eine
 *     GEAENDERTE Bibliothek wird nur nach home eingespielt. Ein Werkzeug
 *     startet dann mit der ALTEN Kopie vom Fremdrechner - fehlerfrei,
 *     ohne Logzeile, unbegrenzt unentdeckt. Fehlt sie ganz, bricht der Start
 *     wenigstens hoerbar ab.
 *
 * `--entfernen` raeumt deshalb alle Bibliothekskopien ausserhalb von home
 * wieder weg. home bleibt unangetastet - dort gehoeren sie hin.
 */
if (ENTFERNEN) {
  let weg = 0, nichtDa = 0, fehlerE = 0;
  for (const host of kandidaten) {
    if (host === "home") continue;
    for (const l of LIBS) {
      try {
        await rpc({ method: "deleteFile", filename: l, server: host });
        weg++;
      } catch (e) {
        if (/not found|does not exist|Invalid hostname/i.test(e.message)) nichtDa++;
        else { console.log("  FEHLER " + host + " " + l + ": " + e.message); fehlerE++; }
      }
    }
    if (weg) console.log("  " + host.padEnd(14) + "aufgeraeumt");
  }
  console.log("");
  console.log("=== " + weg + " Kopien entfernt, " + nichtDa + " lagen nicht dort, "
    + fehlerE + " Fehler ===");
  console.log("  home ist unangetastet. Der neue Kern kopiert `needsLibs` beim");
  console.log("  Start jedes Werkzeugs selbst mit.");
  console.log("");
  process.exitCode = fehlerE ? 1 : 0;
} else {

let gelegt = 0, schonDa = 0, ohneWirt = 0, fehler = 0;

for (const host of kandidaten) {
  // Gibt es den Rechner ueberhaupt? Ein nicht gekaufter werk-N antwortet mit
  // einem Fehler, und der ist hier kein Problem, sondern die Antwort.
  let lebt = true;
  try { await rpc({ method: "getFile", filename: "lib/hackaugs.js", server: host }); }
  catch (e) { if (/Invalid hostname|not found|Cannot find/i.test(e.message)) lebt = false; }
  if (!lebt) { ohneWirt++; continue; }

  const fehlt = [];
  for (const l of LIBS) {
    const soll = fs.readFileSync(path.join(SRC, l), "utf8");
    let ist = null;
    try { ist = await rpc({ method: "getFile", filename: l, server: host }); } catch { ist = null; }
    if (ist === soll) { schonDa++; continue; }
    fehlt.push({ l, soll, neu: ist === null });
  }
  if (!fehlt.length) { console.log("  " + host.padEnd(14) + "vollstaendig"); continue; }
  if (NUR_PRUEFEN) {
    console.log("  " + host.padEnd(14) + fehlt.length + " fehlen/veraltet: "
      + fehlt.map((f) => f.l.replace("lib/", "") + (f.neu ? "" : "*")).join(" "));
    continue;
  }
  for (const f of fehlt) {
    try {
      await rpc({ method: "pushFile", filename: f.l, server: host, content: f.soll });
      gelegt++;
    } catch (e) { console.log("  FEHLER " + host + " " + f.l + ": " + e.message); fehler++; }
  }
  console.log("  " + host.padEnd(14) + fehlt.length + " gelegt");
}

console.log("");
console.log("=== " + gelegt + " gelegt, " + schonDa + " lagen schon richtig, "
  + ohneWirt + " Rechner gibt es nicht, " + fehler + " Fehler ===");
console.log("");
process.exitCode = fehler ? 1 : 0;
}
