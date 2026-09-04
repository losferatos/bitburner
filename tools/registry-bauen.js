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

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const QUELLE = path.join(ROOT, "nodes", "BAU-2026-09", "ARCHITEKTUR.md");
const NUR_PRUEFEN = process.argv.includes("--pruefen");

if (!fs.existsSync(QUELLE)) {
  console.log("ARCHITEKTUR.md nicht gefunden: " + QUELLE);
  process.exit(1);
}

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

const worktree = path.resolve(ROOT, "..", "bitburner-bau", "src");
const ziel = fs.existsSync(worktree)
  ? path.join(worktree, "registry.json")
  : path.join(ROOT, "src", "registry.json");

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
