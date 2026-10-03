/**
 * Erzeugt `src/registry.json` aus dem Block in `ARCHITEKTUR.md` 3.3.
 *
 * ERZEUGT, NICHT ABGESCHRIEBEN - zum dritten Mal an diesem Tag dieselbe Lehre.
 * Bei der Rangkurve hatte ein Zeilenversatz beim Abtippen einen eingebauten
 * Fehlalarm erzeugt; bei der RAM-Tabelle stand die falsche Tabelle in der
 * Doku. Was aus der Quelle erzeugt wird, kann nicht abweichen.
 *
 * Die Architektur ist hier die Quelle, weil dort die Begruendung je Feld steht
 * und weil sie das Dokument ist, das die Skeptiker geprueft haben.
 *
 * Aufruf: node tools/registry-bauen.js [--pruefen]
 *   --pruefen  schreibt nichts, meldet nur Abweichungen (fuer die Testsuite)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schreiberprobe, SCHREIBER } from "./lib/schreiberprobe.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const QUELLE = path.join(ROOT, "nodes", "BAU-2026-09", "ARCHITEKTUR.md");
const NUR_PRUEFEN = process.argv.includes("--pruefen");

if (!fs.existsSync(QUELLE)) {
  console.log("ARCHITEKTUR.md nicht gefunden: " + QUELLE);
  process.exit(1);
}

// WOHIN GESCHRIEBEN WIRD - und wo die Quelltexte liegen, gegen die geprueft
// wird. Beides derselbe Ordner: eine Registry, die einen Baum beschreibt und
// in einen anderen geschrieben wird, prueft nichts.
// NACH DEM MERGE IST DER LIVE-BAUM DAS ZIEL (04.09.2026). Hier stand der
// Worktree zuerst - richtig, solange dort gebaut wurde. Wer die Registry jetzt
// in den Worktree schreibt, erzeugt sie neben dem Stand, der eingespielt wird.
const zielOrdner = path.join(ROOT, "src");

const md = fs.readFileSync(QUELLE, "utf8");
const start = md.indexOf("## 3.3 `src/registry.json`");
if (start === -1) {
  console.log("Abschnitt 3.3 nicht gefunden.");
  process.exit(1);
}
// `\r?` weil die Datei je nach schreibendem Werkzeug mit CRLF gespeichert
// wird. Ohne das findet der Block sich nicht - und zwar lautlos, mit der
// Meldung "kein json-Block", die nach einem Strukturfehler aussieht.
const m = /```json\r?\n([\s\S]*?)\r?\n```/.exec(md.slice(start));
if (!m) {
  console.log("Kein json-Block in Abschnitt 3.3.");
  process.exit(1);
}

let reg;
try {
  reg = JSON.parse(m[1]);
} catch (e) {
  console.log("Der Block in ARCHITEKTUR.md 3.3 ist kein gueltiges JSON: " + e.message);
  process.exit(1);
}

// --- Pruefungen, bevor irgendetwas geschrieben wird -------------------------
//
// Eine Registry mit einem doppelten Namen oder einer fehlenden Pflichtangabe
// ist gefaehrlicher als die heutige Liste in bn4net.js: sie sieht vollstaendig
// aus. Deshalb wird sie hier abgelehnt, nicht spaeter im Spiel bemerkt.

const PFLICHT = ["name", "verfahren", "knoten", "phase",
  "hostRule", "priority", "evictRank", "restartPolicy"];

/**
 * `ramBaseGb: null` ist KEIN Fehler, sondern ein Zustand: das Gewerk ist noch
 * nicht gebaut, und einen RAM-Wert zu erfinden waere schlimmer als keiner.
 * ARCHITEKTUR E6 fuehrt ihn als `unbuilt`. Betroffen ist heute `boerse.js`
 * (Position C.15).
 *
 * Der Leser muss solche Eintraege ueberspringen, statt sie zu starten - und
 * genau das prueft `tools/test-registry.js`. Eine fehlende Datei speist die
 * Strafleiter nie (E6): ein nicht gebautes Gewerk ist kein Haenger.
 */
/**
 * WAS ALS SCHREIBAUFRUF GILT.
 *
 * `ns.write` ist der einzige echte Schreibbefehl; alles andere sind
 * Hausformen, die ihn kapseln (meist um ein `ns.scp` nach home zu ergaenzen).
 * Im Projekt gibt es vier Namen dafuer - sie stehen hier ausdruecklich, statt
 * sie ueber ein Muster zu erraten: ein Muster, das zu viel akzeptiert, laesst
 * genau den Fehler durch, gegen den diese Pruefungen gebaut sind.
 */


/** Jede .js-Datei des Zielordners, einmal gelesen. */
function alleQuellen(ordner, praefix = "") {
  const raus = {};
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const rel = praefix ? praefix + "/" + e.name : e.name;
    if (e.isDirectory()) Object.assign(raus, alleQuellen(path.join(ordner, e.name), rel));
    else if (e.name.endsWith(".js")) {
      raus[rel] = fs.readFileSync(path.join(ordner, e.name), "utf8");
    }
  }
  return raus;
}
const QUELLEN = alleQuellen(zielOrdner);

/**
 * Schreibt IRGENDEIN Skript diese Datei?
 *
 * Das ist die Verallgemeinerung des Befunds vom 04.09.2026: `shop.js` trug die
 * Vorbedingung `requiresFile: "data/buy-request.json"`, und diese Datei
 * schrieb kein einziges Skript im Repo. Das Gewerk lief damit NIE - und weil
 * es der Preislieferant war, fiel der Rechnerkauf vollstaendig aus, lautlos.
 *
 * Dieselbe Falle steckte in `csolve.js` (`requiresFile: data/contracts.json`)
 * und `cdump.js` (`forbidsFile: data/csolve-laeuft.txt`). Drei von vier
 * Vorbedingungen der ersten Fassung nannten Dateien, die es nicht gibt.
 */
/**
 * Dateien, die nicht aus einem Skript stammen - und trotzdem legitim sind.
 *
 * Zwei Sorten, beide mit Begruendung:
 *
 *   1. REPO-DATEIEN. `route.json`, `graftplan.json` und `registry.json` liegen
 *      im Repo und kommen ueber die Bruecke ins Spiel. Sie werden ausdruecklich
 *      NICHT von einem Skript geschrieben - eine Route, die sich selbst
 *      umschreiben kann, ist keine Route.
 *
 *   2. HANDBREMSEN. `data/bn4-stop.txt` setzt ein Mensch, wenn der Bot stehen
 *      soll. Dass kein Skript sie schreibt, ist ihr Sinn: sie ist der einzige
 *      Schalter, den der Bot nicht selbst umlegen kann.
 *
 * Alles andere gilt als Fehler. Die Liste ist kurz zu halten - jede Zeile hier
 * ist eine Ausnahme von der Pruefung, die den lautlosesten Fehler dieses
 * Projekts gefunden hat.
 */
const VON_AUSSEN = {
  "route.json": "Repo-Datei, kommt ueber die Bruecke",
  "graftplan.json": "Repo-Datei, erzeugt von tools/graftplan-bauen.js",
  "registry.json": "Repo-Datei, erzeugt von diesem Werkzeug",
  "data/bn4-stop.txt": "Handbremse - dass kein Skript sie schreibt, ist ihr Sinn",
  // SCHALTER, kein Zustand (03.10.2026, Paket P2). gang.js laeuft nur, wenn der
  // Orchestrator die Datei legt - und der legt sie erst, wenn die TRP-Falle
  // (Paket 0, GANG-2) UND der Kaufaufschub bis zum Tor (Paket 1, AUG-4) im
  // Spiel laufen UND der Kern die Registry nach dem Einspielen neu gelesen hat
  // (er liest sie nur beim Start, bn4net.js:95-108; Neustart: tools/neustart.js
  // bn4net.js). Ein Skript, das sie selbst schriebe, hobe diese Reihenfolge auf.
  // Zusaetzlich prueft gang.js P0 und P1 vor createGang selbst (data/bn4rep.json).
  "data/gang-an.txt": "Schalter - der Mensch/Orchestrator legt ihn, wenn Paket 0 UND Paket 1 live sind und der Kern neu gestartet wurde",
};

function irgendwerSchreibt(datei) {
  if (datei in VON_AUSSEN) return true;
  for (const txt of Object.values(QUELLEN)) {
    for (const fn of SCHREIBER) {
      if (txt.includes(fn + '("' + datei + '"')) return true;
    }
  }
  return false;
}

const fehler = [];
const gesehen = new Set();
let unbuilt = 0;

for (const e of reg.eintraege || []) {
  const wo = e.name || "(ohne Namen)";
  for (const f of PFLICHT) {
    if (e[f] === undefined || e[f] === null) fehler.push(wo + ": Feld " + f + " fehlt");
  }
  if (gesehen.has(e.name)) fehler.push(wo + ": Name kommt doppelt vor");
  gesehen.add(e.name);
  if (e.ramBaseGb === null || e.ramBaseGb === undefined) {
    unbuilt++;
    e.unbuilt = true;   // ausdruecklich markieren, statt es aus null zu raten
  } else if (!Number.isFinite(e.ramBaseGb)) {
    fehler.push(wo + ": ramBaseGb ist weder Zahl noch null (" + JSON.stringify(e.ramBaseGb) + ")");
  }
  if (!["home", "any", "werkbank", "not-hacknet"].includes(e.hostRule)) {
    fehler.push(wo + ": unbekannte hostRule '" + e.hostRule + "'");
  }
  if (!["always", "until-done", "once", "never"].includes(e.restartPolicy)) {
    fehler.push(wo + ": unbekannte restartPolicy '" + e.restartPolicy + "'");
  }

  // EINE VORBEDINGUNG MUSS ERFUELLBAR SEIN (04.09.2026).
  //
  // `requiresFile` auf eine Datei, die niemand schreibt, heisst: dieses Gewerk
  // laeuft nie. Und zwar lautlos - es steht in der Registry, es sieht
  // vollstaendig aus, und der Kern ueberspringt es in jeder Runde mit einem
  // korrekten "wartet auf ...".
  //
  // `forbidsFile` auf eine solche Datei ist harmloser (die Bedingung ist immer
  // erfuellt), aber genauso falsch: sie sollte etwas verhindern und tut es
  // nicht. In der ersten Fassung nannten drei von vier Vorbedingungen Dateien,
  // die kein Skript je schreibt.
  {
    const p = e.precondition || {};
    if (p.requiresFile && !irgendwerSchreibt(p.requiresFile)) {
      fehler.push(wo + ": Vorbedingung requiresFile '" + p.requiresFile
        + "' nennt eine Datei, die kein Skript schreibt - das Gewerk"
        + " liefe NIE, und zwar lautlos.");
    }
    if (p.forbidsFile && !irgendwerSchreibt(p.forbidsFile)) {
      fehler.push(wo + ": Vorbedingung forbidsFile '" + p.forbidsFile
        + "' nennt eine Datei, die kein Skript schreibt - die Bedingung ist"
        + " damit immer erfuellt und verhindert nichts.");
    }
  }

  // TELEMETRIE MUSS EINEN SCHREIBER HABEN (04.09.2026, Skeptiker Substanz).
  //
  // Der Kern beendet ein Werkzeug, dessen Telemetriedatei zu alt ist -
  // und wenn sie NIE geschrieben wird, gilt "seit dem Start" als Alter
  // (bn4net.js, Abschnitt Telemetriealter). Ein erfundener Dateiname macht
  // den Kern damit zum Totengraeber seiner eigenen Werkzeuge, im Takt der
  // Frischefrist.
  //
  // In der ersten Fassung standen acht solcher Namen in der Tabelle, alle
  // plausibel gebildet ("data/<name>.json"), keiner mit einem Schreiber.
  // Deshalb prueft der Generator das jetzt am Quelltext statt es zu glauben.
  if (e.telemetryFile && !e.unbuilt) {
    const quelle = path.join(zielOrdner, e.name);
    if (!fs.existsSync(quelle)) {
      fehler.push(wo + ": telemetryFile gesetzt, aber die Datei " + e.name
        + " gibt es nicht");
    } else {
      const txt = fs.readFileSync(quelle, "utf8");
      // WAS ALS SCHREIBAUFRUF GILT.
      //
      // `ns.write` ist der einzige echte Schreibbefehl; alles andere sind
      // Hausformen, die ihn kapseln (meist um ein `ns.scp` nach home zu
      // ergaenzen). Im Projekt gibt es vier Namen dafuer - sie stehen hier
      // ausdruecklich, statt sie ueber ein Muster zu erraten: ein Muster,
      // das zu viel akzeptiert, laesst genau den Fehler durch, gegen den
      // diese Pruefung gebaut ist.
      //
      // Kein Regex: der Dateiname ist ein Literal, und `includes` kann sich
      // nicht am Escaping vertun.
      // Die Probe selbst steht in `tools/lib/schreiberprobe.js` - sie war
      // hier nicht testbar, weil dieser Generator im Hauptteil schreibt.
      const probe = schreiberprobe(txt, e.telemetryFile);
      const schreibt = probe.ok;
      if (!schreibt) {
        fehler.push(wo + ": telemetryFile '" + e.telemetryFile
          + "' wird von " + e.name + " nirgends geschrieben."
          + " Entweder den Schreiber nachruesten oder das Feld auf null setzen -"
          + " ein erfundener Name laesst den Kern das Werkzeug im Takt der"
          + " Frischefrist erschlagen.");
      }
    }
  }

  // NEEDSLIBS MUSS DIE IMPORTE DECKEN (Skeptiker Runde 3, W4, 04.09.2026).
  //
  // Seit dem 04.09. hat das Feld einen Leser: der Kern kopiert genau diese
  // Dateien mit, wenn er ein Gewerk auf einen Fremdrechner bringt. Damit ist
  // eine unvollstaendige Liste kein Schoenheitsfehler mehr, sondern ein
  // stiller Ausfall - `ns.exec` gibt bei nicht uebersetzbarem Skript 0
  // zurueck, ohne Meldung.
  //
  // Geprueft wird gegen die IMPORTZEILEN des Quelltextes, transitiv: ein
  // lib-Modul, das selbst importiert, bringt seine Abhaengigkeit mit in die
  // Pflichtliste. `ns.scp` loest nichts auf - was nicht genannt ist, fehlt.
  //
  // Ausgenommen sind Gewerke mit hostRule "home": die laufen nie woanders,
  // und dort liegen die Bibliotheken ohnehin.
  if (!e.unbuilt && e.hostRule !== "home") {
    const quelle = path.join(zielOrdner, e.name);
    if (fs.existsSync(quelle)) {
      const noetig = new Set();
      const schlange = [quelle];
      const gesehen = new Set([path.resolve(quelle)]);
      while (schlange.length) {
        const t = fs.readFileSync(schlange.shift(), "utf8");
        for (const m of t.matchAll(/from\s+["']([^"']+)["']/g)) {
          const rel = m[1];
          if (rel.startsWith("node:") || rel.startsWith("@") || /^https?:/.test(rel)) continue;
          const norm = rel.replace(/^\.\//, "");
          if (!norm.startsWith("lib/")) continue;
          const abs = path.resolve(zielOrdner, norm);
          noetig.add(norm);
          if (!gesehen.has(abs) && fs.existsSync(abs)) {
            gesehen.add(abs);
            schlange.push(abs);
          }
        }
      }
      const haben = new Set([...(e.needsLibs || []), "lib/hackaugs.js"]);
      const fehlend = [...noetig].filter((x) => !haben.has(x));
      if (fehlend.length) {
        fehler.push(wo + ": needsLibs deckt die Importe nicht - es fehlen "
          + fehlend.join(", ") + ". Der Kern kopiert nur, was hier steht;"
          + " auf einem frisch gekauften Rechner liegt sonst nichts davon,"
          + " und ns.exec gibt still 0 zurueck.");
      }
    }
  }
}

// ===========================================================================
// STEUERNDE FELDER BRAUCHEN EINEN LESER (Skeptiker Runde 3, W4, 04.09.2026)
// ===========================================================================
//
// Der Befund lautete: sechs Registry-Felder haben keinen Leser. Das ist die
// gefaehrlichste Sorte Doku - sie sieht aus wie Steuerung und ist Deko. Wer
// `hostRule: "home"` eintraegt, glaubt danach, das Gewerk laufe auf home;
// gemessen lief `darkweb.js` auf joesguns und foodnstuff.
//
// Also wird die Unterscheidung ausdruecklich gemacht und geprueft:
//
//   STEUERND    ein Skript liest das Feld und handelt danach. Fehlt der
//               Leser, ist der Eintrag eine Luege - Fehler.
//   BESCHREIBEND  das Feld dokumentiert, was das Gewerk SELBST tut. Es hat
//               absichtlich keinen Leser in der Registry-Verarbeitung.
//
// Die Zuordnung steht hier und nirgends sonst. Ein neues Feld ohne Zuordnung
// faellt auf, statt still in die dritte Kategorie zu rutschen: "gemeint war
// steuernd, gebaut wurde nichts".
const STEUERND = {
  "name": "bn4net.js",
  "args": "bn4net.js",
  "ramBaseGb": "lib/reg.js",
  "ramSingGb": "lib/reg.js",
  "verfahren": "lib/reg.js",
  "knoten": "lib/reg.js",
  "phase": "lib/reg.js",
  "telemetryFile": "lib/reg.js",
  "freshnessMs": "lib/reg.js",
  "priority": "lib/reg.js",
  "precondition": "lib/reg.js",
  "hostRule": "bn4net.js",
  "restartPolicy": "bn4net.js",
  "needsLibs": "bn4net.js",
  "killSafe": "boot.js",
};
// Beschreibend - mit der Begruendung, warum kein Leser noetig ist.
const BESCHREIBEND = {
  "ramMeasuredAt": "Herkunftsangabe der RAM-Zahl, fuer Menschen",
  "taktMs": "der Takt steht im Gewerk selbst; hier zum Nachschlagen",
  "scpToHome": "das Gewerk kopiert selbst nach home (Hausform `nachHome`)",
  "singularity": "folgt aus ramSingGb > 0; hier als lesbare Kennzeichnung",
  "maxInstances": "der Starter laesst ueber `laufend` ohnehin nur eine zu",
  "evictRank": "der Kern raeumt nur Arbeiter, nie Werkzeuge - kein Verdraenger gebaut",
  "needsFigure": "der Vergabepunkt arbeitet ueber Antraege, nicht ueber die Registry",
  "unbuilt": "Merker fuer noch nicht gebaute Gewerke",
  "ramHeuteGb": "was die Datei im LAUFENDEN Spiel belegt - Vergleichswert zum Neubau",
};

{
  const quellen = {};
  for (const f of ["bn4net.js", "boot.js", "lib/reg.js"]) {
    const q = path.join(zielOrdner, f);
    quellen[f] = fs.existsSync(q) ? fs.readFileSync(q, "utf8") : "";
  }
  const gesehen = new Set();
  for (const e of reg.eintraege) for (const k of Object.keys(e)) gesehen.add(k);
  for (const k of gesehen) {
    if (k in BESCHREIBEND) continue;
    const wo2 = STEUERND[k];
    if (!wo2) {
      fehler.push("Feld '" + k + "': weder als steuernd noch als beschreibend"
        + " eingeordnet. Eintragen in STEUERND oder BESCHREIBEND"
        + " (tools/registry-bauen.js) - ein Feld ohne Zuordnung sieht aus wie"
        + " Steuerung und ist womoeglich keine.");
      continue;
    }
    if (!(quellen[wo2] || "").includes(k)) {
      fehler.push("Feld '" + k + "' gilt als steuernd, kommt aber in " + wo2
        + " nicht vor. Entweder den Leser nachruesten oder das Feld nach"
        + " BESCHREIBEND verschieben.");
    }
  }
}

if (fehler.length) {
  console.log("");
  console.log("=== Registry ABGELEHNT: " + fehler.length + " Beanstandung(en) ===");
  for (const f of fehler) console.log("  " + f);
  console.log("");
  console.log("  Nichts geschrieben. Eine Registry mit Luecken ist gefaehrlicher");
  console.log("  als die heutige Liste in bn4net.js - sie sieht vollstaendig aus.");
  console.log("");
  process.exit(1);
}

reg.erzeugtAm = new Date().toISOString();
reg.erzeugtVon = "tools/registry-bauen.js aus ARCHITEKTUR.md 3.3";
reg.hinweis = "ERZEUGT. Nicht von Hand pflegen - Aenderungen gehoeren in ARCHITEKTUR.md 3.3.";

const ziel = path.join(zielOrdner, "registry.json");

const neu = JSON.stringify(reg, null, 1);

if (NUR_PRUEFEN) {
  if (!fs.existsSync(ziel)) {
    console.log("registry.json fehlt noch: " + ziel);
    process.exit(1);
  }
  const alt = JSON.parse(fs.readFileSync(ziel, "utf8"));
  const gleich = JSON.stringify(alt.eintraege) === JSON.stringify(reg.eintraege);
  console.log(gleich
    ? "registry.json stimmt mit ARCHITEKTUR.md 3.3 ueberein (" + reg.eintraege.length + " Eintraege)"
    : "ABWEICHUNG: registry.json und ARCHITEKTUR.md 3.3 sind auseinandergelaufen");
  process.exit(gleich ? 0 : 1);
}

fs.writeFileSync(ziel, neu, "utf8");

console.log("");
console.log("=== Registry erzeugt ===");
console.log("  Eintraege   " + reg.eintraege.length +
  (unbuilt ? "  (davon " + unbuilt + " noch nicht gebaut)" : ""));
console.log("  geschrieben " + ziel);
console.log("");
for (const e of reg.eintraege) {
  console.log("  " + String(e.priority).padStart(2) + "  " + e.name.padEnd(20) +
    String(e.ramBaseGb).padStart(7) + " GB   " + e.hostRule.padEnd(12) +
    e.phase.padEnd(10) + e.restartPolicy);
}
console.log("");
