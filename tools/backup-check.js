/**
 * Prueft eine Spielstand-Sicherung. Erst nach gruener Pruefung gilt ein Backup
 * als vorhanden (Auftrag 7.2).
 *
 * WARUM ES DIESEN PRUEFER GIBT
 * Eine Sicherung, die nie gelesen wurde, ist eine Behauptung. Am 04.09.2026 lag
 * genau eine Datei in backups/, aus BitNode 6, und niemand hatte je geprueft,
 * ob sie sich entpacken laesst. Der Pruefer wird deshalb mit ABSICHT streng:
 * er wirft bei allem, was kein vollstaendiger, zum erwarteten Spielstand
 * passender Save ist.
 *
 * DER PORT IST DER FINGERABDRUCK
 * identifier und Spielinhalt sind in einer Kopie identisch (der identifier wird
 * beim Kopieren mitgenommen). Was Live von einer Testkopie trennt, ist einzig
 * SettingsSave.RemoteFileApiPort: LIVE 12525, TEST 12526. Deshalb ist
 * --expect-port bei LIVE_-Dateien Pflicht und nicht optional - eine Kopie ohne
 * Port-Patch waehlt zwei Sekunden nach dem Laden die Live-Bruecke an.
 *
 * DER RUECKWAERTSSPRUNG
 * Sinkt totalPlaytime gegenueber der letzten LIVE_-Zeile des Index, schreibt
 * eine zweite Instanz mit (zweiter Tab oder Import). Das ist der einzige
 * Detektor dafuer, und er funktioniert nur, wenn der Index gefuehrt wird -
 * deshalb sucht das Werkzeug ihn selbst, wenn --index fehlt.
 *
 * Aufruf:
 *   node tools/backup-check.js <datei> --expect-id <id> --expect-port <port>
 *                              [--expect-node <n>] [--expect-lauf <n>]
 *                              [--anlass <name>] [--index <INDEX.tsv>]
 *                              [--no-index]
 * Exit 0 = gruen, 2 = abgelehnt, 1 = Aufruffehler oder unlesbar.
 */

import fs from "node:fs";
import path from "node:path";
import { lesenKennwerte, pruefeKennwerte, letzterEintrag } from "../sync/backup.js";
import { BACKUP_PRIMAER, BACKUP_SPIEGEL, textAusArgv, zahlAusArgv } from "../sync/instanz.js";

const argv = process.argv.slice(2);
const datei = argv[0];

if (!datei || datei.startsWith("--")) {
  console.log("Aufruf: node tools/backup-check.js <datei> --expect-id <id> --expect-port <port>");
  process.exit(1);
}
if (!fs.existsSync(datei)) {
  console.log("ABGELEHNT  Datei existiert nicht: " + datei);
  process.exit(1);
}

const name = path.basename(datei);
const istLive = name.startsWith("LIVE_");
const erwartetId = textAusArgv(argv, "--expect-id", null);
const erwartetPort = zahlAusArgv(argv, "--expect-port", null);
const erwartetNode = zahlAusArgv(argv, "--expect-node", null);
const erwartetLauf = zahlAusArgv(argv, "--expect-lauf", null);
const anlassFlag = textAusArgv(argv, "--anlass", null);
const indexFlag = textAusArgv(argv, "--index", null);
const ohneIndex = argv.includes("--no-index");

// Bei LIVE_-Dateien sind die Erwartungen Pflicht. Ein Pruefer, den man ohne
// Erwartung aufrufen kann, wird genau dann ohne Erwartung aufgerufen, wenn es
// darauf ankommt.
if (istLive && (!erwartetId || erwartetPort == null)) {
  console.log("ABGELEHNT  LIVE_-Datei ohne --expect-id und --expect-port geprueft.");
  console.log("           Beide sind bei LIVE_ Pflicht (Auftrag 7.2).");
  process.exit(2);
}

let kennwerte;
try {
  const roh = fs.readFileSync(datei);
  const binary = !/-b64\.json$/.test(name);
  kennwerte = lesenKennwerte(roh, binary);
} catch (e) {
  console.log("ABGELEHNT  nicht lesbar: " + e.message);
  process.exit(2);
}

// Anlass aus dem Dateinamen ableiten, wenn er nicht uebergeben wurde. (Die
// pre-jump-Regel "keine wartenden Augs" hing daran; sie ist seit dem
// 22.09.2026 gestrichen, siehe sync/backup.js.)
const anlass =
  anlassFlag || (/_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(name) || [])[1] || null;

// Rueckwaertssprung: gegen den Index des Ablageorts der Datei, sonst gegen den
// primaeren Ort.
let minPlaytime = null;
let indexQuelle = "(keiner)";
if (!ohneIndex) {
  const orte = indexFlag
    ? [path.dirname(path.resolve(indexFlag))]
    : [path.dirname(path.resolve(datei)), BACKUP_PRIMAER, BACKUP_SPIEGEL];
  for (const ort of orte) {
    const letzter = letzterEintrag(ort, istLive ? "LIVE_" : "TEST_");
    if (letzter) {
      // Die Datei selbst darf nicht ihr eigener Vergleichswert sein.
      if (letzter.datei === name) continue;
      minPlaytime = Number(letzter.totalPlaytime);
      indexQuelle = path.join(ort, "INDEX.tsv") + " (" + letzter.datei + ")";
      break;
    }
  }
}

const urteil = pruefeKennwerte(kennwerte, {
  identifier: erwartetId,
  port: erwartetPort,
  minPlaytime,
  bitNode: erwartetNode,
  lauf: erwartetLauf,
  anlass,
});

const h = (kennwerte.totalPlaytime / 3.6e6).toFixed(2);
console.log("");
console.log("  Datei        " + name);
console.log("  Groesse      " + kennwerte.rohBytes + " B gepackt, " + kennwerte.klartextZeichen + " Zeichen roh");
console.log("  identifier   " + kennwerte.identifier + (erwartetId ? "  (erwartet " + erwartetId + ")" : ""));
console.log("  BitNode      " + kennwerte.bitNodeN + " Lauf " + kennwerte.lauf);
console.log("  SourceFiles  " + JSON.stringify(kennwerte.sourceFiles));
console.log("  Spielzeit    " + h + " h gesamt, " + (kennwerte.playtimeSinceLastBitnode / 3.6e6).toFixed(2) + " h im Knoten");
console.log("  Hacking      " + kennwerte.hacking + "   Geld " + kennwerte.money.toExponential(3));
console.log("  Augs         " + kennwerte.augs + " installiert, " + kennwerte.queuedAugs + " wartend" +
  (kennwerte.queuedAugs ? " (" + kennwerte.queuedAugNamen.join(", ") + ")" : ""));
console.log("  Sleeves      " + kennwerte.sleeves + "   Stadt " + kennwerte.city);
console.log("  Bladeburner  Rang " + (kennwerte.bladeburnerRank == null ? "-" : kennwerte.bladeburnerRank.toFixed(1)) +
  ", BlackOps " + kennwerte.blackOpsComplete);
console.log("  lastSave     " + new Date(kennwerte.lastSave).toISOString());
console.log("  RFA-Port     " + kennwerte.remoteFileApiPort + (erwartetPort != null ? "  (erwartet " + erwartetPort + ")" : ""));
console.log("  Autosave     " + kennwerte.autosaveInterval + "   ExcludeRunningScripts " +
  kennwerte.excludeRunningScriptsFromSave + "   Autoexec " + JSON.stringify(kennwerte.autoexecScript));
console.log("  Anlass       " + (anlass || "(unbekannt)"));
console.log("  Vergleich    " + indexQuelle + (minPlaytime != null ? "  totalPlaytime " + minPlaytime : ""));
console.log("");

if (urteil.ok) {
  console.log("  GRUEN - Sicherung gilt als vorhanden.");
  console.log("");
  process.exit(0);
}
console.log("  ABGELEHNT:");
for (const g of urteil.gruende) console.log("    - " + g);
console.log("");
process.exit(2);
