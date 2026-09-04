/**
 * Bridge zwischen Bitburner (Browser) und diesem Rechner.
 *
 * Zwei Aufgaben in einem Prozess:
 *  1. RFA-Server (Remote File API). Das SPIEL verbindet sich hierher als
 *     WebSocket-Client. Wir stellen Anfragen, das Spiel antwortet. Darueber
 *     schieben wir unsere Skripte ins Spiel und lesen Zustand zurueck.
 *  2. Dashboard-Server. Liefert die Oberflaeche, Server-Sent-Events und den
 *     RPC-Draht /api/rpc.
 *
 * ============================================================================
 * UMBAU 04.09.2026 - DIE BRUECKE IST BEOBACHTER, NICHT ARZT
 * ============================================================================
 *
 * Sie startet keine Skripte im Spiel und toetet keine (ein Aussenneustart
 * erzeugte am 02.09. Doppelinstanzen). Sie oeffnet keinen Tab. Sie fordert
 * keine Freigaben an. Was sie erkennt, schreibt sie auf.
 *
 * Fuenf Vorfaelle haben diesen Umbau erzwungen:
 *
 * 1. UNBEDINGTES pushAll (frueher :421-422). Beim Verbinden schob die Bruecke
 *    ALLE Dateien aus src/ ins laufende Spiel, ohne vorher zu pruefen, WELCHES
 *    Spiel dort haengt und ohne Sicherung davor. Am 03.09. geschah das dreimal
 *    an einem Tag - 115, 114 und 106 Dateien. Haette an einem dieser Sockets
 *    eine Testkopie gehangen, waere Testcode in Erics Spielstand gelandet;
 *    haette umgekehrt src/ einen halben Umbau enthalten, waere er geschlossen
 *    live gegangen. Jetzt gilt: erst Identitaet pruefen, dann sichern, dann
 *    schieben. Faellt eines aus, wird nicht geschoben - der Bot laeuft mit dem
 *    Code weiter, den er schon hat.
 *
 * 2. lastTelemetryAt LOG DIE UHRZEIT DES ABRUFS (frueher :238-241). Das Feld
 *    wurde bei jedem erfolgreichen Lesen auf "jetzt" gesetzt, unabhaengig vom
 *    Alter des INHALTS. Am 03.09. 23:58 meldete /api/state "vor 13 Sekunden"
 *    fuer einen Block vom 21.08. Ein Urteil "Tab eingefroren" auf dieser
 *    Grundlage kann per Konstruktion nie ausloesen. Jetzt stammt der
 *    Zeitstempel aus dem Inhalt.
 *
 * 3. KEIN LOCK, KEIN EXIT-FANG. EADDRINUSE wurde nur geloggt; zwei Bruecken
 *    konnten sich um denselben Port streiten, ohne dass es auffiel. Eine
 *    unbehandelte Ausnahme riss den Prozess weg, ohne Spur. Jetzt: Port ist
 *    das Lock, jede Ausnahme wird protokolliert, der Prozess geht mit einem
 *    Code, den die Startschleife lesen kann.
 *
 * 4. ZWEITE VERBINDUNG GEWANN IMMER (frueher :394-402). Ein zweiter Tab -
 *    Erics ausdrueckliches Verbot - haette die Live-Verbindung stillschweigend
 *    uebernommen. Jetzt wird die bestehende zuerst befragt; nur eine
 *    schweigende wird ersetzt, und beide Faelle erzeugen Alarm.
 *
 * 5. /api/rpc REICHTE ALLES DURCH (frueher :338-358). Auch pushFile und
 *    deleteFile, aus jedem lokalen Prozess, ohne Rollenpruefung. Jetzt trennt
 *    eine Schranke lesende von schreibenden Methoden.
 *
 * Der Kern - request/handleGameMessage/pushFile/collectScripts - ist unangetastet;
 * er hat sich bewaehrt.
 */

import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir, appendFile, stat, rename, rm } from "node:fs/promises";
import { watch, readFileSync as fsReadSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROLLEN,
  LIVE_ROOT,
  SCHONLISTE,
  BACKUP_PRIMAER,
  BACKUP_SPIEGEL,
  BACKUP_MOCK,
  pfadGleich,
  textAusArgv,
  zahlAusArgv,
} from "./instanz.js";
import { sichere, lesenKennwerte, alterJuengsteMin, letzterEintrag } from "./backup.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SCRIPT_DIR_VORGABE = path.join(ROOT, "src");
const DASHBOARD_DIR = path.join(ROOT, "dashboard");

// ---------------------------------------------------------------------------
// Aufruf auswerten und Rolle bestimmen
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const NO_PUSH = argv.includes("--no-push");
const NO_WATCH = argv.includes("--no-watch");

const instanzName = (textAusArgv(argv, "--instance", "") || "").toUpperCase();

/**
 * LIVE nur ausdruecklich. Ohne --instance bricht der Start ab - es gibt keinen
 * Default.
 *
 * Der Grund ist nicht Bequemlichkeit, sondern der wahrscheinlichste Verlustweg:
 * eine Bau-Sitzung im Worktree startet "mal eben die Bruecke", diese bindet
 * 12525, das echte Spiel verbindet sich darauf, und der Worktree-Stand geht
 * geschlossen ins Spiel. Drei Bedingungen muessen zusammenkommen, damit LIVE
 * gilt: das Flag, der Projektpfad und die Git-Wurzel.
 */
function bestimmeRolle() {
  if (!instanzName) {
    console.log("");
    console.log("  ABBRUCH: --instance fehlt.");
    console.log("  Aufruf:  node sync/bridge.js --instance LIVE");
    console.log("           node sync/bridge.js --instance TEST --rfa-port 12526 --dash-port 8796");
    console.log("");
    process.exit(3);
  }
  const rolle = ROLLEN[instanzName];
  if (!rolle) {
    console.log("  ABBRUCH: unbekannte Instanz " + instanzName + " (LIVE oder TEST)");
    process.exit(3);
  }
  if (rolle.instance === "LIVE") {
    if (!pfadGleich(ROOT, LIVE_ROOT)) {
      console.log("  ABBRUCH: --instance LIVE, aber der Projektpfad ist");
      console.log("           " + ROOT);
      console.log("           erwartet " + LIVE_ROOT);
      process.exit(3);
    }
    let toplevel = null;
    try {
      toplevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim();
    } catch (e) {
      console.log("  ABBRUCH: git rev-parse --show-toplevel schlug fehl: " + e.message);
      process.exit(3);
    }
    if (!pfadGleich(toplevel, LIVE_ROOT)) {
      console.log("  ABBRUCH: Git-Wurzel ist " + toplevel);
      console.log("           Das ist ein Worktree. LIVE laeuft nur in der Arbeitskopie.");
      process.exit(3);
    }
  }
  return rolle;
}

const ROLLE = bestimmeRolle();
/** Vor dem Portriegel gebraucht - deshalb hier und nicht weiter unten. */
const IST_LIVE_ROLLE = ROLLE.instance === "LIVE";
const RFA_PORT = zahlAusArgv(argv, "--rfa-port", ROLLE.rfaPort);
const DASHBOARD_PORT = zahlAusArgv(argv, "--dash-port", ROLLE.dashPort);
const DATA_DIR = path.resolve(ROOT, textAusArgv(argv, "--data-dir", ROLLE.dataDir));

/**
 * WELCHEN ORDNER DER WATCHER BEOBACHTET - und warum das ueberhaupt ein
 * Schalter ist.
 *
 * Der Dateibeobachter war bis zum 04.09.2026 nicht testbar: er haengt fest an
 * `<repo>/src`, und ein Test, der dort Dateien anlegt, schiebt sie ins ECHTE
 * Spiel. Alle 48 Brueckenproben liefen deshalb mit `--no-watch` - also am
 * stillsten Weg ins Spiel vorbei, den diese Bruecke hat.
 *
 * Der Schalter ist fuer die Rolle LIVE GESPERRT, nicht nur unueblich. Ein
 * umgebogener Quellordner auf der Live-Bruecke waere genau der Fehler, den
 * `--data-dir` schon einmal beinahe erzeugt haette: ein Testlauf, der in
 * Erics laufendes Spiel schreibt.
 */
/**
 * WOHER DER MASTER-RIEGEL SEINE LISTE NIMMT.
 *
 * Live: aus `git ls-tree master -- src/`. Im Pruefstand: aus einer Datei,
 * denn ein Testordner hat kein `master`, gegen das er sich messen koennte.
 *
 * Fuer LIVE gesperrt, wie `--src-dir` und `--race-takt-ms`. Der Riegel der
 * Live-Bruecke fragt git, und daran dreht kein Aufrufparameter.
 */
const MASTER_LISTE_DATEI = (() => {
  const wunsch = textAusArgv(argv, "--master-liste", "");
  if (!wunsch) return null;
  if (IST_LIVE_ROLLE) {
    console.error("--master-liste ist fuer die Rolle LIVE gesperrt.");
    process.exit(2);
  }
  return path.resolve(ROOT, wunsch);
})();

const SCRIPT_DIR = (() => {
  const wunsch = textAusArgv(argv, "--src-dir", "");
  if (!wunsch) return SCRIPT_DIR_VORGABE;
  if (IST_LIVE_ROLLE) {
    console.error(
      "--src-dir ist fuer die Rolle LIVE gesperrt. Der Quellordner der " +
        "Live-Bruecke ist immer <repo>/src.",
    );
    process.exit(2);
  }
  return path.resolve(ROOT, wunsch);
})();

/**
 * TEST weigert sich, die Live-Ports zu binden. Ein vertippter Portparameter ist
 * sonst genau der Fehler, gegen den die ganze Rollentrennung gebaut ist.
 */
// ZWEI ERWEITERUNGEN AM 04.09.2026 (Skeptiker Runde 5):
//
//   1. Der Riegel galt nur fuer TEST. Mit MOCK gibt es eine dritte Rolle, und
//      eine Ausnahme, die man beim Hinzufuegen einer Rolle vergessen kann, ist
//      keine. Jetzt gilt er fuer ALLES ausser LIVE.
//   2. Er prueft die KREUZFAELLE mit. Vorher stand da
//      `RFA_PORT === 12525 || DASHBOARD_PORT === 8795` - ein `--rfa-port 8795`
//      oder `--dash-port 12525` kam durch und wurde nur durch EADDRINUSE
//      abgefangen, also nur, solange LIVE gerade laeuft. Ausgerechnet dann,
//      wenn die Live-Bruecke steht, waere der Vertipper durchgegangen.
if (!IST_LIVE_ROLLE
    && [RFA_PORT, DASHBOARD_PORT].some((p) => p === 12525 || p === 8795)) {
  console.log("  ABBRUCH: " + ROLLE.instance + " darf 12525/8795 nicht binden"
    + " (angefragt " + RFA_PORT + "/" + DASHBOARD_PORT + ")");
  process.exit(3);
}

const IST_LIVE = IST_LIVE_ROLLE;
const BACKUP_ORT = IST_LIVE
  ? BACKUP_PRIMAER
  : (ROLLE.instance === "MOCK"
    ? BACKUP_MOCK
    : path.join(ROOT, "pruefstand", "backups"));
const BACKUP_SPIEGEL_ORT = IST_LIVE ? BACKUP_SPIEGEL : null;

const POLL_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;
/** Der Wachhund gibt getSaveFile 15 s - gemessen braucht es 0,25 s. */
const VERIFY_TIMEOUT_MS = 15000;
const HEARTBEAT_MS = 30000;
const RUECKKANAL_MS = 60000;
const SOFORT_MS = 60000;
const SAVE_ALTER_MS = 10 * 60000;
const STUNDENSICHERUNG_MS = 60 * 60000;
/**
 * Der Sicherungstakt, solange ein zweiter Spiel-Tab im Verdacht steht
 * (Auftrag 7.1.1, Befund W.6).
 *
 * Zwei Tabs speichern beide alle 60 s in dieselbe IndexedDB, und der letzte
 * Schreiber gewinnt. Die Gefahr ist nicht der Alarm, sondern die Zeit danach:
 * bis jemand hinsieht, koennen Stunden vergehen, und die naechste
 * Stundensicherung faengt womoeglich schon den ueberschriebenen Stand.
 */
const ZWEITTAB_SICHERUNG_MS = 5 * 60000;

/**
 * Wie oft der Sicherungstimer ueberhaupt nachsieht. Live eine Minute; im
 * Pruefstand faellt er mit `--race-takt-ms` mit, sonst koennte eine Probe den
 * Fuenfminutentakt nie beobachten - der Timer wuerde erst nach einer Minute
 * zum ersten Mal aufwachen.
 */
const TIMER_TAKT_MS = (() => {
  const wunsch = zahlAusArgv(argv, "--race-takt-ms", 0);
  if (!wunsch || IST_LIVE_ROLLE) return 60000;
  return Math.max(200, Math.min(60000, Math.floor(wunsch / 2)));
})();

/**
 * DER RENNTAKT IST IM PRUEFSTAND EINSTELLBAR - sonst waere er nicht messbar.
 *
 * Ein Skeptiker hat es gefunden: `ZWEITTAB_SICHERUNG_MS` liess sich auf FUENF
 * STUNDEN setzen, ohne dass eine der 59 Brueckenproben rot wurde. Der Test
 * behauptete, der Takt "faellt mit der Abfrage" - geteilt ist aber nur die
 * Abfrage, nicht die Wirkung. Eine Zusicherung ohne Probe ist eine
 * Behauptung, und diese hier stand in der Abnahmeliste.
 *
 * Fuer LIVE gesperrt, wie `--src-dir`: der Renntakt der Live-Bruecke sind
 * fuenf Minuten, und daran dreht kein Aufrufparameter.
 */
const RACE_TAKT_MS = (() => {
  const wunsch = zahlAusArgv(argv, "--race-takt-ms", 0);
  if (!wunsch) return ZWEITTAB_SICHERUNG_MS;
  if (IST_LIVE_ROLLE) {
    console.error("--race-takt-ms ist fuer die Rolle LIVE gesperrt.");
    process.exit(2);
  }
  return wunsch;
})();
/**
 * Wieviele Dateien ein einzelner Watcher-Schub hoechstens ins Spiel schiebt
 * (Befund B.3).
 *
 * Der Anlass: der Bau liegt in einem zweiten Baum (`bitburner-bau`), und die
 * Live-Bruecke beobachtet `bitburner/src`. Ein `git merge` des Baus in den
 * Live-Baum aendert rund vierzig Dateien in einer Sekunde - der Watcher haette
 * sie in EINEM Schub ins laufende Spiel geschoben, ohne Checkliste, ohne
 * Kanarienvogel, ohne die Reihenfolge aus Auftrag 9. Der Merge waere die
 * Einspielung gewesen, und niemand haette ihn so genannt.
 *
 * Acht ist die Grenze zwischen "jemand hat an einem Gewerk gearbeitet" und
 * "hier kippt ein ganzer Stand um". Wer mehr will, legt `data/schub-frei.txt`
 * an - das ist der bewusste Handgriff, den `tools/hotswap.js` verlangt.
 */
const SCHUB_MAX = 8;
/** Nach einem Schub mindestens so lange keine weitere Schub-Sicherung. */
const SCHUB_SICHERUNG_ABSTAND_MS = 10 * 60000;

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** @type {import("ws").WebSocket | null} */
let gameSocket = null;
let nextRequestId = 1;
/** @type {Map<number, {resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
const pendingRequests = new Map();

/**
 * Solange ein Socket `unverified` ist, darf ausser getSaveFile nichts hinaus.
 * Das ist der Kern des Wachhunds: die Bruecke weiss beim Verbinden noch nicht,
 * WELCHES Spiel dort haengt, und alles, was sie in diesem Zustand schreibt,
 * schreibt sie moeglicherweise in den falschen Spielstand.
 *
 * DIE FREIGABE HAENGT AM SOCKET, NICHT AN EINEM BOOLEAN (Befund 04.09.2026).
 * Ein globales `socketVerifiziert = true` gilt fuer die Verbindung, die
 * gerade in `gameSocket` steht - nicht fuer die, die geprueft wurde. Ablauf:
 * Socket A verbindet, die Verifikation laeuft; Socket B verbindet und
 * uebernimmt `gameSocket`; As Close-Handler prueft `gameSocket === socket`,
 * findet B und setzt nichts zurueck; As Verifikation wird gruen und startet
 * pushAll - in den nie geprueften Socket B. Verifiziert wurde Spielstand A,
 * geschrieben wird in Spiel B.
 * Deshalb ist die Freigabe eine Referenz auf genau den Socket, der die drei
 * Pruefungen bestanden hat. Wechselt gameSocket, erlischt sie von selbst.
 */
let verifizierterSocket = null;
let verifikationLaeuft = false;
/**
 * EIN SOCKET, DER WAEHREND EINER LAUFENDEN VERIFIKATION ANKOMMT (04.09.2026).
 *
 * `verifiziereSocket` stieg bei `verifikationLaeuft` mit einem blossen
 * `return` aus - ohne Meldung und ohne dass irgendetwas die Pruefung spaeter
 * nachgeholt haette. Der neue Socket blieb damit DAUERHAFT unverifiziert: der
 * Wachhund liess nichts hinaus, jeder Schub landete in `zurueckgestellt`, und
 * der einzige Wiederholungsanlauf (60 s) steht im catch-Zweig, den ein
 * stiller Ausstieg nie erreicht. Von aussen sah das aus wie eine gesunde
 * Verbindung, die nichts tut.
 *
 * Das Fenster ist groesser, als es aussieht: `Verifiziert in ...` wird
 * geloggt, BEVOR Sicherung und pushAll laufen - beide dauern zusammen leicht
 * mehrere Sekunden. Getroffen hat es zuerst den Brueckentest unter Last
 * (04.09.2026, voller Suitendurchlauf); im Betrieb trifft es jeden Reconnect,
 * der in dieses Fenster faellt.
 */
let nachzuholen = null;
const istVerifiziert = () => gameSocket !== null && verifizierterSocket === gameSocket;

const state = {
  connected: false,
  connectedSince: null,
  /** Zeitstempel AUS DEM INHALT der Telemetrie, nicht der des Abrufs. */
  lastTelemetryAt: null,
  lastTelemetryReadAt: null,
  lastSaveAt: null,
  lastSaveGemessenAm: null,
  telemetry: null,
  servers: [],
  syncedFiles: [],
  log: [],
  verified: false,
  lastVerifiedBackup: null,
  alarm: null,
  bitNode: null,
  lauf: null,
  identifier: null,
  motorRound: null,
  totalPlaytime: null,
};

/** @type {Set<import("node:http").ServerResponse>} */
const dashboardClients = new Set();

let letzteSchubSicherung = 0;
let letzteStundensicherung = 0;
let letzteSaveAbfrage = 0;
/** Zurueckgestellte Schuebe aus dem unverified-Fenster. */
const zurueckgestellt = new Set();

/**
 * MANUAL_ACTIONS - der Eingriffszaehler (04.09.2026).
 *
 * Abnahmestufe B verlangt 12 h mit `manual_actions = 0`, und die Zahl hatte
 * bis heute keinen Schreiber. Sie stand dauerhaft auf null und war damit
 * unfaelschbar - dieselbe Luecke wie bei `false_penalty_count`.
 *
 * SIE GEHOERT IN DIE BRUECKE, und das ist kein Umweg, sondern der einzige
 * moegliche Ort: Der Kern laeuft IM Spiel und kann nicht sehen, dass etwas von
 * aussen hineingeschrieben wurde. Die Bruecke ist der einzige Weg hinein, und
 * damit die einzige Stelle, an der sich ein Eingriff ueberhaupt bemerken
 * laesst.
 *
 * WAS ZAEHLT (Auftrag, Stufe B): "jede Aenderung, die das Live-Spiel erreicht
 * - Hot-Swap, pushFile, deleteFile, task.txt, reload.txt, Neustart der
 * Bruecke."
 *
 * WAS NICHT ZAEHLT:
 *   - `pushAll` beim Verbinden. Das ist die Bruecke, die ihren eigenen Stand
 *     wiederherstellt, kein Mensch. Der Auftrag nennt einen Brueckenausfall
 *     ausdruecklich KEINEN Eingriff.
 *   - Lesende Methoden. `getSaveFile` alle 60 s ist Beobachtung.
 *
 * Gezaehlt wird als EIN Eingriff, was in einem Schub zusammen ins Spiel geht -
 * ein Hot-Swap von zwoelf Dateien ist ein Handgriff, nicht zwoelf. Die
 * Gegenprobe dazu steht in der Datei: sie fuehrt die Zahl der Dateien mit.
 */
const MANUAL_DATEI = path.join(DATA_DIR, "manual-actions.json");
/**
 * Der Zweit-Tab-Alarm steht in einer DATEI, nicht in einer Variablen.
 *
 * `sync/bridge-start.cmd` startet die Bruecke nach jedem Absturz neu. Ein
 * Merker im Prozess waere damit genau in dem Moment weg, in dem er zaehlt -
 * ein Save-Rennen zwischen zwei Tabs bringt die Bruecke durchaus zum Sterben,
 * und der Neustart haette die Sperre still aufgehoben.
 *
 * Aufgehoben wird sie nur von Hand: Datei loeschen. Das ist Absicht. Ein
 * Verdacht auf ein Save-Rennen ist nichts, was sich von selbst erledigt.
 */
const ZWEITTAB_DATEI = path.join(DATA_DIR, "zweittab-alarm.json");
/** Der Freibrief fuer einen grossen Schub - siehe SCHUB_MAX. */
const SCHUB_FREI_DATEI = path.join(DATA_DIR, "schub-frei.txt");
const SCHUB_FREI_MAX_MS = 30 * 60000;
/**
 * DER VERWEIGERTE SCHUB HAT EINEN NAMEN UND EINE DATEI.
 *
 * Ohne sie liefen `src/` und Spiel still auseinander: der Watcher verweigert,
 * der Stapel ist weg, und nichts erinnert daran. Aufgeloest haette das
 * spaeter `pushAll` beim naechsten Verbinden - auf die schlechteste denkbare
 * Art, naemlich alles auf einmal und ohne Checkliste (Skeptikerrunde 6).
 *
 * Die Datei traegt die Liste. `pushAll` haelt sie ein, das Dashboard zeigt
 * sie, und `tools/hotswap.js` kann daran erkennen, dass etwas ansteht.
 */
const SCHUB_OFFEN_DATEI = path.join(DATA_DIR, "schub-offen.json");
/**
 * DIE FREIGABELISTE FUER DEN HOT-SWAP.
 *
 * Sie steht neben dem Master-Riegel (siehe `inMaster`): eine Datei, die noch
 * nicht committet ist, geht nicht ins Spiel - ausser sie steht hier drin. Das
 * ist der Weg fuer den Hot-Swap selbst, der ja gerade neue Staende einspielt.
 *
 * Geschrieben von `tools/hotswap.js`, geleert von der Bruecke, sobald die
 * gelisteten Dateien durch sind. Sie verfaellt ausserdem - eine liegen
 * gebliebene Freigabe ist keine Freigabe mehr, sondern ein abgeschalteter
 * Riegel.
 */
const FREIGABE_DATEI = path.join(DATA_DIR, "hotswap-freigabe.txt");
const FREIGABE_MAX_MS = 30 * 60000;
const MANUAL_MAX = 200;

/**
 * Steht der Zweit-Tab-Alarm? Der Inhalt der Datei, sonst null.
 *
 * Wird bei jeder Abfrage frisch von Platte gelesen, damit ein Mensch die
 * Sperre durch Loeschen der Datei aufheben kann, ohne die Bruecke neu zu
 * starten - ein Neustart waere selbst ein Eingriff.
 */
let zweitTabMerker = null;
/** Was das Dashboard ueber den Master-Riegel sagen kann. */
let masterRiegelStand = { an: false, quelle: "unbekannt", dateien: null };

/**
 * Steht der Zweit-Tab-Alarm?
 *
 * FAIL-CLOSED, und zwar aus dem eigenen Grund heraus (Skeptikerrunde 6).
 *
 * Der erste Entwurf fing JEDEN Fehler und lieferte `null` - also "keine
 * Sperre". Damit hob ein transienter Lesefehler die Sperre still auf:
 * EBUSY/EPERM unter Windows (Virenscanner, offener Editor), EMFILE, oder ein
 * `SyntaxError` auf einer halb geschriebenen Datei. Die Datei laege sichtbar
 * im Ordner, ein Mensch hielte sie fuer die Sperre - und es gaebe keine.
 *
 * Das widersprach der eigenen Begruendung im RPC-Riegel: "in einen
 * unbekannten Stand zu schreiben macht aus einem Rennen einen Schaden". Ein
 * Lesefehler IST der unbekannte Zustand.
 *
 * Jetzt: `ENOENT` heisst "keine Sperre" - das ist der einzige Fehler, der
 * eine Aussage traegt. Alles andere haelt die Sperre (oder setzt sie, wenn
 * noch keine bekannt war) und wird protokolliert.
 */
async function zweitTabAlarm() {
  try {
    zweitTabMerker = JSON.parse(await readFile(ZWEITTAB_DATEI, "utf8"));
  } catch (e) {
    if (e && e.code === "ENOENT") {
      zweitTabMerker = null;
    } else {
      log("error", "Zweit-Tab-Sperre nicht lesbar (" + (e && (e.code || e.message))
        + ") - sie gilt weiter, im Zweifel gesperrt");
      if (!zweitTabMerker) {
        zweitTabMerker = {
          at: new Date().toISOString(), ts: Date.now(),
          text: "Sperrdatei unlesbar (" + (e && (e.code || e.message)) + ")",
        };
      }
    }
  }
  return zweitTabMerker;
}

/** Den Alarm setzen. Ueberschreibt einen bestehenden nicht - der erste zaehlt. */
async function setzeZweitTabAlarm(text) {
  if (await zweitTabAlarm()) return;
  try {
    // ATOMAR: erst daneben schreiben, dann umbenennen. Ein Absturz mitten im
    // Schreiben hinterliesse sonst eine abgeschnittene Datei - und die parst
    // nie wieder. Das Fenster ist schmal und liegt genau in dem Moment, in
    // dem die Sperre zaehlt.
    const tmp = ZWEITTAB_DATEI + ".tmp";
    await writeFile(
      tmp,
      JSON.stringify({ at: new Date().toISOString(), ts: Date.now(), text }, null, 1),
      "utf8",
    );
    await rename(tmp, ZWEITTAB_DATEI);
    await zweitTabAlarm();
    log(
      "error",
      "ZWEIT-TAB-SPERRE gesetzt: Sicherungstakt 5 min, alle schreibenden " +
        "Eingriffe gesperrt. Aufheben: " + ZWEITTAB_DATEI + " loeschen.",
    );
  } catch (e) {
    log("error", "Zweit-Tab-Sperre liess sich nicht schreiben: " + e.message);
  }
}

/**
 * Der Freibrief fuer einen grossen Schub - und warum er verfaellt.
 *
 * Eine Datei, die liegen bleibt, ist keine Freigabe mehr, sondern eine
 * abgeschaltete Sicherung. Nach dreissig Minuten gilt sie nicht mehr; das ist
 * lang genug fuer einen Hot-Swap in Stufen und kurz genug, dass sie niemand
 * ueber eine Nacht vergisst.
 */
async function schubFrei() {
  try {
    const st = await stat(SCHUB_FREI_DATEI);
    const alter = Date.now() - st.mtimeMs;
    // NEGATIV IST NICHT JUNG (Skeptikerrunde 6). Springt die Systemuhr
    // rueckwaerts - NTP-Korrektur, Rueckkehr aus dem Standby, VM-Resume -,
    // wird die Differenz negativ, und ein blosses `< MAX` waere wahr. Ein
    // Freibrief von vor drei Wochen gaelte damit wieder, und zwar fuer die
    // Dauer des Versatzes statt fuer 30 Minuten.
    if (alter < 0) {
      log("warn", "schub-frei.txt liegt in der Zukunft (" + (-alter / 60000).toFixed(0)
        + " min) - gilt NICHT");
      return false;
    }
    return alter < SCHUB_FREI_MAX_MS;
  } catch {
    return false;
  }
}

/**
 * Der Freibrief ist ein EINMAL-TICKET, kein Zeitfenster.
 *
 * Sonst passen in dreissig Minuten mehrere Merges, und die Datei bliebe
 * liegen: jedes Werkzeug, das die mtime anfasst - Editor, Kopieren des
 * data/-Ordners, ein Indexer - schaltete den Deckel erneut fuer 30 min ab,
 * ohne dass es jemand wollte.
 */
/**
 * ===========================================================================
 * DER MASTER-RIEGEL: WAS NICHT COMMITTET IST, GEHT NICHT INS SPIEL
 * ===========================================================================
 *
 * Der Anlass ist ein Ausrutscher vom 04.09.2026, 06:40: eine Datei landete
 * im Live-Baum statt im Worktree und war 400 ms spaeter im laufenden Spiel.
 * Diesmal war es `lib/blackops.json` und harmlos. Ein halbfertiges Skript
 * waere es nicht gewesen.
 *
 * Der Worktree schuetzt nur, solange jeder Agent den richtigen Baum trifft -
 * und einmal hat es schon nicht geklappt. Ein Riegel, der nicht davon
 * abhaengt, ist besser als eine Regel, an die man sich erinnern muss.
 *
 * DIE REGEL: eine Datei unter `src/` wird nur geschoben, wenn ihr PFAD im
 * Git-Index von `master` steht - oder wenn sie ausdruecklich freigegeben ist
 * (`data/hotswap-freigabe.txt`).
 *
 * Der Riegel arbeitet auf PFADebene, nicht auf Inhaltsebene. Das ist Absicht:
 * eine Aenderung an einer bekannten Datei ist der Alltag und darf nicht
 * blockiert werden; eine NEUE, unbekannte Datei ist der Fehlgriff, gegen den
 * er gebaut ist.
 *
 * IM ZWEIFEL GESCHLOSSEN. Antwortet git nicht, geht nichts hinaus, und es
 * steht laut im Protokoll. Der Bot im Spiel laeuft ohnehin weiter - was
 * ausbleibt, ist eine Aktualisierung, nicht der Betrieb.
 */
let masterIndex = null;
let masterIndexAlter = 0;
/**
 * WANN NACH EINEM FEHLSCHLAG FRUEHESTENS WIEDER GEFRAGT WIRD.
 *
 * Eigener Zustand, nicht `masterIndexAlter` (Skeptikerrunde 7, Nachtrag N1).
 * Der erste Versuch setzte nur die Alterszahl zurueck - gelesen wurde sie
 * aber in einer Bedingung, die ein WAHRES `masterIndex` verlangt, und das ist
 * im Fehlerfall `null`. Der Negativ-Cache war damit wirkungslos: nachgerechnet
 * 142 git-Aufrufe statt einem. Ein Wachtposten, der auf den Erfolg schaut,
 * kann einen Misserfolg nicht merken.
 */
let masterIndexFehlerBis = 0;
const MASTER_INDEX_TTL_MS = 30000;
const MASTER_INDEX_FEHLER_MS = 5000;

/**
 * WANN DER RIEGEL UEBERHAUPT GILT.
 *
 * Immer - ausser der Quellordner ist umgebogen (`--src-dir`) und es wurde
 * keine Ersatzliste mitgegeben. Ein Testordner hat kein `master`, gegen das
 * er sich messen koennte; ohne diese Ausnahme waere jede Probe rot, die mit
 * einem eigenen Quellordner arbeitet.
 *
 * Die Ausnahme ist LAUT: sie schreibt beim Start eine Zeile ins Protokoll.
 * Ein stiller Riegel, der aus ist, waere schlimmer als keiner - man verliesse
 * sich auf ihn.
 */
const MASTER_RIEGEL_AN = !(SCRIPT_DIR !== SCRIPT_DIR_VORGABE && !MASTER_LISTE_DATEI);

function ladeMasterIndex() {
  if (masterIndex && Date.now() - masterIndexAlter < MASTER_INDEX_TTL_MS) {
    return masterIndex;
  }
  // Der Negativ-Cache. Er steht VOR dem Lesen, nicht danach.
  if (Date.now() < masterIndexFehlerBis) return null;
  // Der Pruefstandsweg: eine Datei statt git.
  if (MASTER_LISTE_DATEI) {
    try {
      const roh = fsReadSync(MASTER_LISTE_DATEI, "utf8");
      masterIndex = new Set(roh.split(/\r?\n/).map((z) => z.trim())
        .filter((z) => z && !z.startsWith("#")));
      masterIndexAlter = Date.now();
    } catch (e) {
      log("error", "--master-liste nicht lesbar: " + e.message);
      masterIndex = null;
    }
    return masterIndex;
  }
  try {
    const aus = execFileSync("git",
      ["ls-tree", "-r", "--name-only", "master", "--", "src/"],
      { cwd: ROOT, encoding: "utf8", timeout: 3000 });
    const menge = new Set();
    for (const zeile of aus.split("\n")) {
      const t = zeile.trim();
      if (t.startsWith("src/")) menge.add(t.slice(4));
    }
    if (!menge.size) throw new Error("git ls-tree lieferte keine Datei unter src/");
    masterIndex = menge;
    masterIndexAlter = Date.now();
  } catch (e) {
    /**
     * AUCH DER FEHLSCHLAG WIRD GEMERKT (Skeptikerrunde 7).
     *
     * Vorher wurde `masterIndexAlter` nur im Erfolgsfall gesetzt. Nach einem
     * Fehler war `masterIndex === null`, die Cache-Bedingung damit falsch -
     * und es lief JE DATEI ein neues `execFileSync`. Gemessen: 42 ms warm,
     * 142 Dateien unter src/. Bei langsamem git (Virenscanner auf .git, ein
     * laufendes `gc`) waeren das 142 Aufrufe synchron hintereinander, im
     * Grenzfall 142 x 3 s = sieben Minuten blockierter Event-Loop - in einem
     * Prozess, der WebSocket, RFA und HTTP bedient. Kein Herzschlag, keine
     * Sicherung, keine Antwort ans Spiel; die Neustartschleife haelt die
     * Bruecke fuer tot.
     *
     * Fuenf Sekunden Sperrfrist sind kurz genug, dass eine vorbeiziehende
     * Stoerung nicht lange nachwirkt, und lang genug, dass ein Stapel von
     * 142 Dateien EINEN Versuch macht, nicht 142.
     */
    log("error", "Master-Index nicht lesbar (" + e.message.slice(0, 120)
      + ") - es geht NICHTS ins Spiel, bis git wieder antwortet");
    masterIndex = null;
    masterIndexFehlerBis = Date.now() + MASTER_INDEX_FEHLER_MS;
    void sofortZeile(
      "Master-Riegel blind: git antwortet nicht",
      "`git ls-tree master -- src/` schlug fehl (" + e.message.slice(0, 200)
        + "). Solange das so bleibt, geht KEINE Datei mehr ins Spiel - der "
        + "Bot laeuft weiter, bekommt aber keine Aktualisierung. Pruefen: "
        + "liegt `master` noch vor, ist `.git` heil, findet der Prozess `git` "
        + "im PATH?",
    );
  }
  return masterIndex;
}

/** Die Freigabeliste, mit Verfall. Leere Menge, wenn keine gilt. */
async function freigabeListe() {
  try {
    const st = await stat(FREIGABE_DATEI);
    const alter = Date.now() - st.mtimeMs;
    if (alter < 0) {
      log("warn", "hotswap-freigabe.txt liegt in der Zukunft - gilt NICHT");
      return new Set();
    }
    if (alter >= FREIGABE_MAX_MS) {
      log("warn", "hotswap-freigabe.txt ist " + (alter / 60000).toFixed(0)
        + " min alt - verfallen");
      return new Set();
    }
    const roh = await readFile(FREIGABE_DATEI, "utf8");
    return new Set(roh.split(/\r?\n/).map((z) => z.trim())
      .filter((z) => z && !z.startsWith("#")));
  } catch {
    return new Set();
  }
}

/**
 * Wurde seit dem letzten Leeren eine Freigabe wirklich EINGELOEST?
 *
 * Ohne diesen Merker war `leereFreigabe()` toter Code - der einzige Treffer
 * im ganzen Projekt war die Definition (Skeptikerrunde 7, Befund 5). Folge:
 * die Freigabe war kein Einmal-Ticket, sondern ein Blankoschein ueber
 * dreissig Minuten, und in dieser Zeit galt sie fuer JEDEN Weg - auch fuer
 * `pushAll` beim naechsten Verbinden, und ein Reconnect ist das haeufigste
 * Ereignis im System.
 */
let freigabeBenutzt = false;

/** Den Freibrief leeren, sobald die freigegebenen Dateien durch sind. */
async function leereFreigabe() {
  try {
    await writeFile(FREIGABE_DATEI, "", "utf8");
    log("info", "hotswap-freigabe.txt geleert - die Freigabe ist verbraucht");
  } catch { /* dann greift der Verfall */ }
}

/** Den verweigerten Stapel festhalten - siehe SCHUB_OFFEN_DATEI. */
async function schreibeSchubOffen(stapel) {
  try {
    await writeFile(SCHUB_OFFEN_DATEI, JSON.stringify({
      at: new Date().toISOString(),
      ts: Date.now(),
      anzahl: stapel.length,
      dateien: stapel.slice(0, 200),
    }, null, 1), "utf8");
  } catch (e) {
    log("error", "schub-offen.json nicht schreibbar: " + e.message);
  }
}

/** Welche Dateien warten? Leere Menge, wenn nichts ansteht. */
async function schubOffenListe() {
  try {
    const o = JSON.parse(await readFile(SCHUB_OFFEN_DATEI, "utf8"));
    return new Set(Array.isArray(o.dateien) ? o.dateien : []);
  } catch {
    return new Set();
  }
}

async function verbraucheSchubFrei() {
  try {
    await rm(SCHUB_FREI_DATEI, { force: true });
    log("info", "Freibrief verbraucht - der naechste grosse Schub braucht einen neuen");
  } catch { /* dann liegt sie eben noch da, der Verfall greift trotzdem */ }
}

async function zaehleEingriff(art, was, anzahl = 1) {
  try {
    let buch = { version: 1, eintraege: [] };
    try {
      buch = JSON.parse(await readFile(MANUAL_DATEI, "utf8"));
      if (!Array.isArray(buch.eintraege)) buch.eintraege = [];
    } catch { /* erster Eingriff dieser Instanz */ }
    buch.eintraege.push({
      wall: Date.now(),
      art,
      was: String(was).slice(0, 200),
      dateien: anzahl,
      // Die Spielzeit, damit sich ein Eintrag einem LAUF zuordnen laesst -
      // `manual_actions` ist "je Lauf", und Laeufe trennt kein Wanduhrdatum.
      playtime: Number.isFinite(state.totalPlaytime) ? state.totalPlaytime : null,
    });
    // Ringpuffer. Aeltere Eintraege gehen verloren; die Zahl, die zaehlt,
    // ist die der letzten Stunden.
    if (buch.eintraege.length > MANUAL_MAX) {
      buch.eintraege = buch.eintraege.slice(-MANUAL_MAX);
    }
    await writeFile(MANUAL_DATEI, JSON.stringify(buch, null, 1), "utf8");
    log("info", "Eingriff " + art + ": " + was
      + " (" + buch.eintraege.length + " im Puffer)");
  } catch (err) {
    // Buchhaltung darf den Betrieb nicht anhalten - aber der Ausfall gehoert
    // ins Protokoll, sonst ist auch er lautlos.
    log("warn", "manual-actions nicht schreibbar: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Protokollierung: Konsole, Dashboard UND Datei
// ---------------------------------------------------------------------------

const LOGDATEI = path.join(DATA_DIR, "bridge.log");
const LOG_MAX_BYTES = 4 * 1024 * 1024;

async function schreibeLogZeile(zeile) {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    try {
      const s = await stat(LOGDATEI);
      if (s.size > LOG_MAX_BYTES) await rename(LOGDATEI, LOGDATEI + ".1");
    } catch {
      // gibt es noch nicht
    }
    await appendFile(LOGDATEI, zeile + "\n", "utf8");
  } catch {
    // Ein fehlgeschlagenes Logschreiben darf die Bruecke nicht umbringen.
  }
}

function log(level, message) {
  const entry = { at: new Date().toISOString(), level, message };
  state.log.push(entry);
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  const stamp = entry.at.slice(11, 19);
  const mark = level === "error" ? "XX" : level === "warn" ? " !" : "  ";
  console.log(stamp + " " + mark + " " + message);
  // Die Speicherliste stirbt mit dem Prozess - genau dann, wenn man sie braucht.
  void schreibeLogZeile(entry.at + "\t" + level + "\t" + message);
  broadcast({ type: "log", entry });
}

async function alarm(titel, text) {
  state.alarm = { at: new Date().toISOString(), titel, text };
  log("error", "ALARM " + titel + ": " + text);
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      path.join(DATA_DIR, "bridge-alarm.json"),
      JSON.stringify(state.alarm, null, 1),
      "utf8",
    );
  } catch {
    // egal
  }
}

// ---------------------------------------------------------------------------
// RFA: Anfragen an das Spiel
// ---------------------------------------------------------------------------

/** Methoden, die nur lesen. Alles andere veraendert das Spiel. */
const LESENDE_METHODEN = new Set([
  "getFile",
  "getFileNames",
  "getAllFiles",
  "getAllFileMetadata",
  "getFileMetadata",
  "calculateRam",
  "getAllServers",
  "getDefinitionFile",
  "getSaveFile",
]);

/**
 * Schickt eine JSON-RPC-Anfrage ans Spiel und wartet auf die Antwort.
 * @param {string} method
 * @param {object} [params]
 * @param {{trotzUnverified?: boolean}} [opt]
 */
function request(method, params, opt = {}) {
  return new Promise((resolve, reject) => {
    if (!gameSocket || gameSocket.readyState !== 1) {
      reject(new Error("Spiel ist nicht verbunden"));
      return;
    }
    // Der Riegel des Wachhunds. Er sitzt HIER und nicht in den Aufrufern,
    // damit ein neuer Aufrufer ihn nicht versehentlich umgeht.
    if (!istVerifiziert() && !opt.trotzUnverified) {
      reject(new Error("Socket noch nicht verifiziert - " + method + " zurueckgestellt"));
      return;
    }
    const id = nextRequestId++;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Zeitueberschreitung bei " + method));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timer });

    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    try {
      gameSocket.send(JSON.stringify(payload));
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(err);
    }
  });
}

function handleGameMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    log("warn", "Unlesbare Nachricht vom Spiel erhalten");
    return;
  }
  const waiting = pendingRequests.get(msg.id);
  if (!waiting) return;
  pendingRequests.delete(msg.id);
  clearTimeout(waiting.timer);
  if (msg.error !== undefined) reject_(waiting, msg.error);
  else waiting.resolve(msg.result);
}

function reject_(waiting, error) {
  waiting.reject(new Error(typeof error === "string" ? error : JSON.stringify(error)));
}

// ---------------------------------------------------------------------------
// Dateien ins Spiel schieben
// ---------------------------------------------------------------------------

const SYNCABLE = /\.(js|jsx|ts|tsx|txt|json|script)$/;

/**
 * Dateien, die NIE ins Spiel gehen, egal wie sie enden.
 *
 * ES GIBT NUR EINE REGEL: der Name faengt mit einem Punkt an. Punktdateien
 * sind in diesem Projekt durchweg Werkzeugkram - Wegwerfkopien des Laders
 * (`.mock-<name>-<pid>.mjs`), Editorreste, Sperrdateien. Nichts davon hat im
 * Spielstand etwas zu suchen.
 *
 * WARUM DAS SEIT DEM 04.09.2026 AUSDRUECKLICH DASTEHT (Skeptiker Runde 5, B3):
 * Bis dahin hielt die Endung allein die Kopien draussen - `.mock-figur-123.mjs`
 * faellt durch `SYNCABLE`, weil dort `.mjs` fehlt. Das stimmte, war aber ein
 * Zufall zweier unabhaengiger Entscheidungen: die Endung waehlt `mockPfad` in
 * `tools/mock/lader.js`, und wer sie eines Tages auf `.js` aendert, schiebt
 * Wegwerfdateien in Erics laufendes Spiel. Ein Riegel, der nur mittelbar haelt,
 * ist keiner.
 */
const NIE_SCHIEBEN = (name) => name.startsWith(".");

async function collectScripts(dir = SCRIPT_DIR, prefix = "") {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const gameName = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      // `archiv/` GEHT NIE INS SPIEL (04.09.2026, Auftrag 6.1).
      //
      // Das Archiv liegt bewusst NEBEN src/, nicht darin - `collectScripts`
      // laeuft rekursiv und haette einen Ordner `src/archiv/` mitgeschoben,
      // also genau die Dateien, die gerade als tot ausgemustert wurden. Zwei
      // Werkzeuge (test-verbote.js, archivliste.js) ueberspringen ein
      // `src/archiv` bereits; die Bruecke tat es nicht, und sie ist die
      // einzige, die wirklich schreibt.
      if (entry.name === "archiv") continue;
      out.push(...(await collectScripts(full, gameName)));
    } else if (SYNCABLE.test(entry.name) && !entry.name.endsWith(".d.ts")
      && !NIE_SCHIEBEN(entry.name)) {
      out.push({ localPath: full, gameName });
    }
  }
  return out;
}

/**
 * Inhalts-Fingerabdruecke der zuletzt geschobenen Fassungen.
 *
 * WARUM (gemessen 04.09.2026)
 * `fs.watch` mit `recursive: true` feuert auf Windows auch dann, wenn sich am
 * INHALT nichts geaendert hat. Das Bruecken-Log zeigt am 03.09. drei
 * Massenuebertragungen - 114, 106 und 110 Dateien - zu Zeitpunkten, an denen
 * `git status` sauber war, der Inhalt also unveraendert. Zwei davon lagen
 * nachweislich in Zeitraeumen, in denen niemand `src/` bearbeitet hat.
 *
 * Die Ursache des Watcher-Feuerns ist NICHT geklaert (ein Lesetest mit `cat`
 * und `grep` ueber `src/` loeste am 04.09. 01:26 keinen Schub aus - die
 * naheliegende Erklaerung faellt damit aus). Der Inhaltsvergleich macht die
 * Ursache aber gleichgueltig: was sich nicht geaendert hat, geht nicht raus.
 *
 * Das ist mehr als Sparsamkeit. Ein Massenschub ist der Weg, auf dem
 * halbfertiger Code geschlossen ins laufende Spiel gelangt - genau der
 * Vorfall, gegen den die ganze Checkliste aus Auftrag 9 gebaut ist.
 */
const zuletztGeschoben = new Map();

/**
 * DIE AUSNAHME VON DER SPERRE, UND WARUM ES SIE GEBEN MUSS.
 *
 * `data/backup-ok.txt` ist die Antwort des Handschlags (`lib/handschlag.js`).
 * Kommt sie nicht, wartet `punish.js` vor dem Einbau bis zum Deckel und
 * `ausgang.js` schreibt eine Wartemarke. Eine Sperre, die diese eine Datei
 * mitsperrt, laesst den Bot in einem Wartezustand stehen, den nur derselbe
 * Mensch aufloest, der auch die Sperre aufhebt - also doppelt.
 *
 * Die Datei traegt keinen Spielzustand, nur ein Ja/Nein mit Zeitstempel.
 */
const TROTZ_SPERRE = new Set(["data/backup-ok.txt"]);

/**
 * Darf ueberhaupt etwas ins Spiel? Eine Antwort fuer ALLE Schreibwege.
 *
 * Der erste Entwurf pruefte an zwei Stellen - im Watcher-Schub und im
 * Dashboard-RPC - und liess damit die drei lautesten offen: `pushAll` beim
 * Verbinden (114 Dateien auf einen Schlag), den Rueckkanal (alle 60 s) und
 * den Handschlag. Ein Skeptiker hat es gefunden und richtig eingeordnet:
 * "gedeckelt wurden die zwei leisesten Wege, offen blieb der lauteste".
 *
 * Besonders schaerfend war der Fall, in dem die Sperre gerade gesetzt wurde:
 * derselbe Socket bekam unmittelbar danach ueber `verifiziereSocket()` das
 * komplette Dateiverzeichnis geschrieben - in einen Stand, von dem die
 * Bruecke soeben festgestellt hatte, dass sie nicht weiss, wer ihn gewinnt.
 *
 * Jetzt sitzt die Pruefung in `pushFile` - dem einen Punkt, durch den jeder
 * Schreibweg laeuft.
 */
async function darfSchreiben(zielName) {
  if (TROTZ_SPERRE.has(zielName)) return true;
  const za = await zweitTabAlarm();
  return !za;
}

/**
 * ===========================================================================
 * DIE EINE STELLE, DURCH DIE JEDER SCHREIBVORGANG LAEUFT
 * ===========================================================================
 *
 * Der Riegel sass bis zum 04.09.2026 16:40 in `pushFile` - und der Kommentar
 * dort nannte das "die eine Engstelle". Das stimmte nicht: ZWEI Wege riefen
 * `request("pushFile", ...)` direkt und kamen daran vorbei.
 *
 *   `data/backup-ok.txt`  - die Antwort des Handschlags (`:1416`)
 *   `data/bridge.json`    - der Rueckkanal, alle 60 Sekunden (`:1535`)
 *
 * Beim ersten ist das gewollt (sonst wartete der Bot vor jedem Einbau ins
 * Leere), beim zweiten war es Zufall. Ein Zufall, der genau so aussieht wie
 * eine Entscheidung, ist die schlechteste Sorte - deshalb laufen jetzt beide
 * hier durch, und die Ausnahme steht als Ausnahme da.
 *
 * `herkunft` unterscheidet, was geprueft wird:
 *   "src"     - eine Datei aus dem Quellordner. Zweit-Tab-Sperre UND
 *               Master-Riegel.
 *   "bruecke" - die Bruecke schreibt ihren eigenen Zustand. Nur die
 *               Zweit-Tab-Sperre; ein Master-Riegel waere hier sinnlos, die
 *               Datei liegt nicht unter src/.
 *
 * @returns {Promise<boolean>} true, wenn wirklich geschrieben wurde
 */
async function schreibeInsSpiel(gameName, content, herkunft) {
  if (!(await darfSchreiben(gameName))) {
    const za = zweitTabMerker;
    log("warn", "Schreiben von " + gameName + " gesperrt (Zweit-Tab-Sperre seit "
      + (za ? za.at : "?") + ")");
    const fehler = new Error("Zweit-Tab-Sperre: " + gameName + " nicht geschrieben");
    fehler.code = "ZWEITTAB_GESPERRT";
    throw fehler;
  }

  if (herkunft === "src" && MASTER_RIEGEL_AN) {
    /**
     * DIE FREIGABE WIRD ZUERST GEFRAGT (Skeptikerrunde 7, Befund 1).
     *
     * Vorher stand die Indexpruefung davor und warf bei `!index` sofort - die
     * Freigabe wurde nie erreicht. Damit fuehrte der Notausgang gegen eine
     * Wand: `tools/hotswap.js` faellt bei einem git-Fehler ausdruecklich AUF
     * ("alle Dateien werden vorsorglich freigegeben") und legt eine Freigabe,
     * die die Bruecke in genau dieser Lage nicht gelesen haette.
     *
     * Zwei Werkzeuge mit gegenlaeufiger Fehlerrichtung sind schlimmer als
     * eines mit der falschen.
     */
    const frei = await freigabeListe();
    if (!frei.has(gameName)) {
      const index = ladeMasterIndex();
      if (!index) {
        const fehler = new Error("Master-Index nicht lesbar - " + gameName
          + " nicht geschrieben");
        fehler.code = "KEIN_INDEX";
        throw fehler;
      }
      if (!index.has(gameName)) {
        log("error", "NICHT IN MASTER: " + gameName + " steht weder im Git-Index "
          + "noch in " + path.basename(FREIGABE_DATEI) + " - es wird NICHT geschoben");
        const fehler = new Error("nicht in master und nicht freigegeben: " + gameName);
        fehler.code = "NICHT_IN_MASTER";
        throw fehler;
      }
    } else {
      log("info", "Freigegeben trotz fehlendem Master-Eintrag: " + gameName);
      freigabeBenutzt = true;
    }
  }

  await request("pushFile", { filename: gameName, content, server: "home" });
  return true;
}

async function pushFile(localPath, gameName, nurBeiAenderung = false) {
  const content = await readFile(localPath, "utf8");
  if (nurBeiAenderung) {
    const fp = createHash("sha256").update(content).digest("hex");
    if (zuletztGeschoben.get(gameName) === fp) return null;
    await schreibeInsSpiel(gameName, content, "src");
    zuletztGeschoben.set(gameName, fp);
    return gameName;
  }
  await schreibeInsSpiel(gameName, content, "src");
  zuletztGeschoben.set(gameName, createHash("sha256").update(content).digest("hex"));
  return gameName;
}

async function pushAll() {
  if (NO_PUSH) {
    log("warn", "pushAll uebersprungen (--no-push)");
    return;
  }
  const files = await collectScripts();

  // EIN VERWEIGERTER SCHUB BLEIBT AUCH HIER VERWEIGERT (Skeptikerrunde 6).
  //
  // Der Deckel sass bis heute nur im Watcher-Pfad. Damit war B.3 nicht
  // geloest, sondern um einen Reconnect verschoben: der Merge legt vierzig
  // Dateien in `src/`, der Watcher verweigert - und beim naechsten Verbinden
  // (Seitenneuladen, Brueckenneustart, Standby-Rueckkehr) schob `pushAll`
  // alles hinaus, inklusive der vierzig. Der Reconnect ist das haeufigste
  // Ereignis im System, nicht das seltenste.
  //
  // Zurueckgehalten wird NUR die wartende Liste, nicht der ganze Schub: fuer
  // alles andere ist die Uebertragung beim Verbinden richtig und noetig.
  const wartend = (await schubFrei()) ? new Set() : await schubOffenListe();
  const done = [];
  let gehalten = 0;
  for (const file of files) {
    if (wartend.has(file.gameName)) {
      gehalten++;
      zurueckgestellt.add(file.gameName);
      continue;
    }
    try {
      await pushFile(file.localPath, file.gameName);
      done.push(file.gameName);
    } catch (err) {
      log("error", "Konnte " + file.gameName + " nicht uebertragen: " + err.message);
    }
  }
  // DAS FREIGABE-FLAG LECKT SONST AUS pushAll HERAUS (Nachtrag N2).
  //
  // Es wurde nur in `schiebeStapel` geleert. Zwei Folgen: eine beim Reconnect
  // eingeloeste Freigabe blieb die vollen 30 Minuten liegen - also genau das
  // Blankoscheck-Loch, gegen das das Einmal-Ticket gebaut ist -, und das Flag
  // stand danach dauerhaft auf `true`. Der naechste Watcher-Stapel, Stunden
  // spaeter und ohne eigene Freigabe, haette dann eine frisch geschriebene
  // `hotswap-freigabe.txt` geloescht, BEVOR ihre Dateien geschoben waren. Ein
  // Hot-Swap waere scheinbar grundlos fehlgeschlagen.
  if (freigabeBenutzt) {
    freigabeBenutzt = false;
    await leereFreigabe();
  }

  state.syncedFiles = done;
  log("info", done.length + " Datei(en) ins Spiel uebertragen"
    + (gehalten ? " - " + gehalten + " aus einem verweigerten Schub ZURUECKGEHALTEN" : ""));
  broadcast({ type: "state", state: publicState() });
}

/**
 * Beobachtet src/ und schiebt geaenderte Dateien nach.
 * fs.watch feuert auf Windows mehrfach pro Speichervorgang, daher entprellt.
 */
function watchScripts() {
  if (NO_WATCH) {
    log("warn", "Dateibeobachtung aus (--no-watch)");
    return;
  }
  /** @type {Set<string>} */
  const geaendert = new Set();
  /** @type {NodeJS.Timeout | null} */
  let timer = null;

  try {
    watch(SCRIPT_DIR, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = filename.toString().split(path.sep).join("/");
      if (name.endsWith(".d.ts") || !SYNCABLE.test(name)) return;
      // Auch hier, nicht nur in collectScripts: der Watcher meldet den PFAD,
      // also muss der DATEINAME geprueft werden, nicht der Anfang des Pfades.
      if (NIE_SCHIEBEN(name.split("/").pop())) return;

      // Alle Aenderungen eines Umbaus sammeln und ERST DANN gemeinsam
      // schieben. Wer jede Datei einzeln nachschiebt, liefert Zwischenstaende
      // aus: Der Autopilot erkennt seine neue Fassung, startet neu - und
      // stuerzt ab, weil die Konstante, die er benutzt, noch in der Datei
      // steckt, die erst 200 ms spaeter kommt. Genau so passiert.
      geaendert.add(name);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const stapel = [...geaendert];
        geaendert.clear();
        void schiebeStapel(stapel);
      }, 400);
    });
    log("info", "Beobachte src/ auf Aenderungen");
  } catch (err) {
    log("error", "Dateibeobachtung nicht moeglich: " + err.message);
  }
}

/**
 * Ein Schub geht erst nach gruener Sicherung ins Spiel.
 *
 * Faellt die Sicherung aus, wird der Stapel VERWORFEN - nicht gestaut. Ein
 * gestauter Stapel ginge beim naechsten Ereignis geschlossen raus, also genau
 * dann, wenn niemand hinsieht. Der Bot laeuft derweil mit dem Code weiter, den
 * er hat; das ist kein Stillstand, nur kein Fortschritt.
 */
async function schiebeStapel(stapelEingang) {
  let stapel = stapelEingang;
  if (!gameSocket || !istVerifiziert()) {
    for (const d of stapel) zurueckgestellt.add(d);
    log("warn", stapel.length + " Aenderung(en) zurueckgestellt - Socket nicht verifiziert");
    return;
  }
  if (NO_PUSH) {
    log("warn", "Schub uebersprungen (--no-push): " + stapel.join(", "));
    return;
  }

  // Erst pruefen, ob ueberhaupt etwas Neues dabei ist. Ohne diese Vorpruefung
  // zoege ein Watcher-Fehlalarm eine vollstaendige Sicherung nach sich - und
  // bei einem Massen-Fehlalarm eine je zehn Minuten, dauerhaft.
  const neu = [];
  for (const datei of stapel) {
    try {
      const inhalt = await readFile(path.join(SCRIPT_DIR, datei), "utf8");
      const fp = createHash("sha256").update(inhalt).digest("hex");
      if (zuletztGeschoben.get(datei) !== fp) neu.push(datei);
    } catch {
      // Geloescht oder unlesbar - der Schub selbst meldet es.
      neu.push(datei);
    }
  }
  if (!neu.length) {
    log("info", stapel.length + " Watcher-Meldung(en) ohne Inhaltsaenderung - nichts geschoben");
    return;
  }
  stapel = neu;

  // DIE ZWEIT-TAB-SPERRE GILT AUCH HIER (Befund W.6). Der Watcher ist der
  // stillste aller Wege ins Spiel - eine gespeicherte Datei genuegt.
  {
    const za = await zweitTabAlarm();
    if (za) {
      log(
        "error",
        "Schub verweigert: Zweit-Tab-Sperre seit " + za.at + " (" + stapel.length + " Datei(en))",
      );
      await sofortZeile(
        "Schub verweigert - Zweit-Tab-Sperre",
        stapel.length + " geaenderte Datei(en) unter src/ wurden NICHT ins Spiel " +
          "geschoben. Seit " + za.at + " steht der Verdacht auf einen zweiten " +
          "Spiel-Tab (" + za.text + "). Erst das Save-Rennen klaeren, dann " +
          ZWEITTAB_DATEI + " loeschen.",
      );
      return;
    }
  }

  // DER MERGE IST NICHT DIE EINSPIELUNG (Befund B.3).
  //
  // Der Bau liegt in `bitburner-bau`, die Bruecke beobachtet `bitburner/src`.
  // Ein `git merge` haette hier rund vierzig Dateien in einem Schub ins
  // laufende Spiel gelegt - unter Umgehung der Reihenfolge aus Auftrag 9 und
  // der Checkliste in `tools/hotswap.js`, die genau dafuer gebaut ist.
  //
  // Der Deckel unterscheidet nicht zwischen Merge und Handarbeit; er
  // unterscheidet zwischen "ein Gewerk" und "ein ganzer Stand". Wer den
  // ganzen Stand einspielen will, sagt es: `data/schub-frei.txt`.
  // Zurueckgestelltes zaehlt mit: sonst liesse sich ein grosser Schub in
  // kleine Haeppchen zerlegen, und der Deckel waere ein Vorschlag.
  const gesamt = new Set([...zurueckgestellt, ...stapel]).size;
  if (gesamt > SCHUB_MAX && !(await schubFrei())) {
    stapel = [...new Set([...zurueckgestellt, ...stapel])];
    log(
      "error",
      "Schub verweigert: " + stapel.length + " Dateien > SCHUB_MAX " + SCHUB_MAX,
    );
    await sofortZeile(
      // Die Dateizahl gehoert IN den Titel: er ist der Entdopplungsschluessel,
      // und ein konstanter Titel haette jede weitere Verweigerung verschluckt.
      "Grosser Schub verweigert (" + stapel.length + " Dateien) - sieht nach einem Merge aus",
      stapel.length + " Dateien unter src/ haben sich gleichzeitig geaendert; " +
        "die Grenze liegt bei " + SCHUB_MAX + ". Es wurde NICHTS ins Spiel " +
        "geschoben.\n\nWar das ein Hot-Swap? Dann `tools/hotswap.js` fahren " +
        "und die Reihenfolge aus Auftrag 9 einhalten. War es Absicht? Dann " +
        SCHUB_FREI_DATEI + " anlegen (gilt 30 min) und eine Datei erneut " +
        "speichern.\n\nGeaendert: " + stapel.slice(0, 12).join(", ") +
        (stapel.length > 12 ? " (+" + (stapel.length - 12) + ")" : ""),
    );
    // DER STAPEL BLEIBT LIEGEN (Skeptikerrunde 6).
    //
    // Der erste Entwurf verwarf ihn und begruendete das damit, dass "beim
    // naechsten Mal derselbe Schub wieder auffaellt". Das stimmt nicht: der
    // Stapel entsteht aus `geaendert`, und das Set ist beim Aufruf schon
    // geleert. Nach einem verweigerten Vierzig-Datei-Merge bildete die
    // NAECHSTE einzelne gespeicherte Datei einen Stapel von eins - unter dem
    // Deckel, also durch. Ergebnis: eine Datei des neuen Standes bei
    // neununddreissig alten. Genau der Mischzustand, gegen den der Deckel
    // gebaut ist.
    //
    // Jetzt wandert er nach `zurueckgestellt` (dieselbe Ablage, die der
    // unverifizierte Pfad benutzt) und zaehlt beim naechsten Schub mit.
    for (const d of stapel) zurueckgestellt.add(d);
    await schreibeSchubOffen(stapel);
    return;
  }

  /**
   * ENTWEDER ALLE ODER KEINE (Skeptikerrunde 7, Befund 4).
   *
   * Der Master-Riegel griff bis hierher PRO DATEI, mitten in der Schleife -
   * nach Eingriffszaehlung und Sicherung. Ein Hot-Swap aus drei Dateien, von
   * denen eine neu ist: zwei gehen hinaus, eine nicht. Das ist genau der
   * Mischzustand, gegen den zwanzig Zeilen weiter oben der Schubdeckel
   * gebaut ist ("eine Datei des neuen Standes bei neununddreissig alten") -
   * der Riegel unterlief ihn.
   *
   * Jetzt wird der ganze Stapel VORHER gegen Index und Freigabe gehalten.
   * Faellt eine Datei durch, geht keine.
   */
  if (MASTER_RIEGEL_AN) {
    const frei = await freigabeListe();
    const index = ladeMasterIndex();
    const abgewiesen = [];
    for (const datei of stapel) {
      if (frei.has(datei)) continue;
      if (!index) { abgewiesen.push(datei + " (kein Index)"); continue; }
      if (!index.has(datei)) abgewiesen.push(datei);
    }
    if (abgewiesen.length) {
      log("error", "Schub verweigert: " + abgewiesen.length + " von " + stapel.length
        + " Datei(en) stehen nicht in master und sind nicht freigegeben: "
        + abgewiesen.slice(0, 10).join(", "));
      await sofortZeile(
        "Schub verweigert (" + abgewiesen.length + " nicht in master) - Fehlgriff?",
        abgewiesen.length + " von " + stapel.length + " geaenderten Dateien unter "
          + "src/ stehen weder im Git-Index von master noch in "
          + path.basename(FREIGABE_DATEI) + ". Es wurde NICHTS ins Spiel "
          + "geschoben - entweder alle oder keine.\n\nBetroffen: "
          + abgewiesen.slice(0, 20).join(", ")
          + "\n\nWar das Absicht? Dann committen (dann steht der Pfad in "
          + "master) oder `tools/hotswap.js` fahren, das legt die Freigabe "
          + "selbst. War es ein Fehlgriff - eine Datei im falschen Baum -, "
          + "dann ist genau dafuer dieser Riegel gebaut.",
      );
      for (const d of stapel) zurueckgestellt.add(d);
      await schreibeSchubOffen(stapel);
      return;
    }
  }

  // EIN SCHUB IST EIN EINGRIFF. Er entsteht nur, weil ein Mensch oder eine
  // Claude-Sitzung eine Datei unter src/ geaendert hat - der Bot selbst kann
  // das nicht. Gezaehlt wird NACH der Inhaltspruefung: eine Watcher-Meldung
  // ohne Inhaltsaenderung erreicht das Spiel nicht und ist kein Eingriff.
  await zaehleEingriff("push", stapel.slice(0, 5).join(", ")
    + (stapel.length > 5 ? " (+" + (stapel.length - 5) + ")" : ""), stapel.length);

  // Der Freibrief ist ein Einmal-Ticket. Er wird eingeloest, sobald ein
  // Schub ueber der Grenze wirklich hinausgeht - nicht schon beim Nachsehen.
  if (stapel.length > SCHUB_MAX) {
    await verbraucheSchubFrei();
    try { await rm(SCHUB_OFFEN_DATEI, { force: true }); } catch { /* egal */ }
    zurueckgestellt.clear();
  }

  const jetzt = Date.now();
  if (jetzt - letzteSchubSicherung > SCHUB_SICHERUNG_ABSTAND_MS) {
    const ok = await sichereJetzt("pre-hotswap");
    if (!ok) {
      await alarm(
        "Schub verworfen",
        stapel.length + " Datei(en) NICHT geschoben - Sicherung rot oder ausgefallen: " +
          stapel.join(", "),
      );
      await sofortZeile(
        "Sicherung vor Codeschub fehlgeschlagen",
        "Die Bruecke hat " + stapel.length + " geaenderte Datei(en) NICHT ins Spiel " +
          "geschoben, weil vorher keine gruene Sicherung zustande kam. Der Bot laeuft " +
          "mit dem vorhandenen Code weiter. Dateien: " + stapel.join(", "),
      );
      return;
    }
    letzteSchubSicherung = jetzt;
  }

  const erledigt = [];
  let unveraendert = 0;
  for (const datei of stapel) {
    try {
      const r = await pushFile(path.join(SCRIPT_DIR, datei), datei, true);
      if (r) erledigt.push(datei);
      else unveraendert++;
    } catch (err) {
      // GELOESCHTE DATEIEN LANDEN AUCH HIER - das ist kein echter Fehler.
      // Die beiden Riegelfehler dagegen schon, und sie muessen sich
      // unterscheiden lassen (Skeptikerrunde 7, Befund 3): ein Schub, von dem
      // alles abgewiesen wurde, war vorher im Protokoll praktisch stumm.
      if (err.code === "NICHT_IN_MASTER" || err.code === "KEIN_INDEX") {
        log("error", "ABGEWIESEN " + datei + ": " + err.message);
      } else {
        log("warn", datei + ": " + err.message);
      }
    }
  }
  if (freigabeBenutzt) {
    freigabeBenutzt = false;
    await leereFreigabe();
  }
  if (unveraendert) {
    log("info", unveraendert + " Datei(en) unveraendert - nicht geschoben");
  }
  if (erledigt.length === 1) log("info", "Nachgeschoben: " + erledigt[0]);
  else if (erledigt.length > 1)
    log("info", erledigt.length + " Dateien zusammen nachgeschoben: " + erledigt.join(", "));
}

// ---------------------------------------------------------------------------
// Wachhund: wer haengt da eigentlich?
// ---------------------------------------------------------------------------

const HEARTBEAT_DATEI = () => path.join(DATA_DIR, "bridge-heartbeat.json");

async function leseHeartbeat() {
  try {
    return JSON.parse(await readFile(HEARTBEAT_DATEI(), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Der zuletzt GELESENE Live-Wert von totalPlaytime. Er ist der Anker der
 * Wachhund-Pruefung (2) und darf nie durch null ueberschrieben werden.
 *
 * BEFUND 04.09.2026: `state.totalPlaytime` startet als null, und der Heartbeat
 * schrieb es alle 30 s ungeprueft in die Datei. Startete die Bruecke, ohne dass
 * ein Spiel-Tab haengt - also nach jeder Nacht mit geschlossenem Tab, nach
 * jedem Reboot, nach jedem Absturz der Neustartschleife -, stand nach 30
 * Sekunden `totalPlaytime: null` im Anker. Pruefung (2) verlangt
 * `Number.isFinite` und uebersprang sich dann STILL.
 *
 * Damit blieben von drei Pruefungen zwei, und beide lassen genau den Hauptfall
 * durch: ein ungepatchter Klon traegt Port 12525 (der Auftrag sagt das selbst)
 * und denselben identifier (der wird beim Kopieren mitgenommen). Der Anker war
 * das einzige Merkmal, das ihn gefangen haette.
 */
let ankerPlaytime = null;

/** Anker beim Start aus der Datei uebernehmen - ein Neustart verlaere ihn sonst. */
async function ladeAnker() {
  const hb = await leseHeartbeat();
  if (hb && Number.isFinite(hb.totalPlaytime)) {
    ankerPlaytime = hb.totalPlaytime;
    log("info", "Anker uebernommen: totalPlaytime " + (hb.totalPlaytime / 3.6e6).toFixed(2) + " h");
  }
}

/**
 * Die drei Pruefungen vor dem ersten Schreiben.
 *
 * Pruefung 2 vergleicht gegen den ZULETZT VON DIESER ROLLE GELESENEN Wert,
 * nicht gegen eine Backup-Datei. Der Grund ist genau der Fall, den sie fangen
 * soll: ein Klon der laufenden Stunde stammt aus der juengsten Sicherung und
 * bestuende jeden Vergleich gegen sie. Gegen den zuletzt gelesenen Live-Wert
 * faellt er durch, weil eine Kopie immer mindestens so alt ist wie ihre Quelle.
 *
 * Das ist zusammen mit dem RFA-Port das einzige Merkmal, das Live von einer
 * Kopie trennt - der identifier ist in beiden gleich.
 */
async function verifiziereSocket(kandidat) {
  if (verifikationLaeuft) {
    // NICHT VERWERFEN, SONDERN VORMERKEN. Siehe `nachzuholen`.
    nachzuholen = kandidat || gameSocket;
    log("warn", "Verifikation laeuft bereits - der neue Socket wird vorgemerkt");
    return;
  }
  verifikationLaeuft = true;
  const beginn = Date.now();
  // Der geprueft werdende Socket wird HIER festgehalten. Alles Weitere gilt
  // nur fuer ihn - wenn zwischendurch ein anderer uebernimmt, wird die
  // Freigabe nicht erteilt.
  const geprueft = kandidat || gameSocket;
  try {
    const antwort = await Promise.race([
      request("getSaveFile", undefined, { trotzUnverified: true }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("getSaveFile antwortet nicht")), VERIFY_TIMEOUT_MS),
      ),
    ]);

    const binary = antwort.binary !== false;
    const roh = binary
      ? Buffer.from(antwort.save, "latin1")
      : Buffer.from(antwort.save, "base64");
    const k = lesenKennwerte(roh, binary);

    const gruende = [];
    let keinAnker = false;
    // (1) Port
    if (k.remoteFileApiPort !== RFA_PORT) {
      gruende.push(
        "RemoteFileApiPort im Spielstand ist " + k.remoteFileApiPort +
          ", diese Bruecke haelt " + RFA_PORT,
      );
    }
    // (2) Rueckwaertssprung gegen den zuletzt bekannten Wert dieser Rolle.
    //
    // Ein FEHLENDER Anker wird nicht still durchgewunken. Er heisst, dass diese
    // Pruefung gar nicht stattfinden konnte - und ein Ausschluss gilt nur, wenn
    // das Werkzeug den ausgeschlossenen Fall anzeigen koennte. Ersatzweise
    // dient die juengste Zeile des Sicherungsindex; sie ist schwaecher, weil sie
    // bis zu eine Stunde alt sein kann, aber besser als nichts. Bleibt auch die
    // aus, wird die Verbindung angenommen UND der Zustand gemeldet.
    let anker = ankerPlaytime;
    let ankerQuelle = "Heartbeat";
    if (!Number.isFinite(anker)) {
      const hb = await leseHeartbeat();
      if (hb && Number.isFinite(hb.totalPlaytime)) {
        anker = hb.totalPlaytime;
        ankerQuelle = "Heartbeat-Datei";
      }
    }
    if (!Number.isFinite(anker)) {
      const letzte = letzterEintrag(BACKUP_ORT, ROLLE.prefix);
      if (letzte && Number.isFinite(Number(letzte.totalPlaytime))) {
        anker = Number(letzte.totalPlaytime);
        ankerQuelle = "INDEX.tsv (" + letzte.datei + ")";
      }
    }
    if (Number.isFinite(anker)) {
      if (k.totalPlaytime < anker - 60000) {
        gruende.push(
          "totalPlaytime " + k.totalPlaytime + " liegt mehr als 60 s hinter dem zuletzt " +
            "bekannten Wert " + anker + " (" + ankerQuelle + ") - aeltere Kopie oder Import",
        );
      }
    } else {
      keinAnker = true;
      log(
        "warn",
        "Pruefung 2 uebersprungen: kein Anker vorhanden (weder Heartbeat noch Index). " +
          "Die Verbindung wird nur ueber Port und identifier geprueft - beide traegt " +
          "auch eine unveraenderte Kopie.",
      );
    }
    // (3) identifier
    if (ROLLE.identifier && k.identifier !== ROLLE.identifier) {
      gruende.push("identifier " + k.identifier + " statt " + ROLLE.identifier);
    }

    if (gruende.length) {
      await alarm("Socket abgewiesen", gruende.join(" | "));
      await sofortZeile(
        "Fremde Spielverbindung abgewiesen",
        "Ein Spiel hat sich auf Port " + RFA_PORT + " verbunden, das nicht der erwartete " +
          "Live-Stand ist. Es wurde NICHTS geschrieben. Gruende:\n\n- " + gruende.join("\n- "),
      );
      if (verifizierterSocket === geprueft) verifizierterSocket = null;
      return;
    }

    state.identifier = k.identifier;
    state.bitNode = k.bitNodeN;
    state.lauf = k.lauf;
    state.totalPlaytime = k.totalPlaytime;
    state.lastSaveAt = new Date(k.lastSave).toISOString();
    state.lastSaveGemessenAm = new Date().toISOString();
    state.settings = {
      autosaveInterval: k.autosaveInterval,
      excludeRunningScriptsFromSave: k.excludeRunningScriptsFromSave,
      remoteFileApiPort: k.remoteFileApiPort,
      autoexecScript: k.autoexecScript,
      gelesenAm: new Date().toISOString(),
    };
    log(
      "info",
      "Verifiziert in " + (Date.now() - beginn) + " ms: " + k.identifier +
        " BN" + k.bitNodeN + " L" + k.lauf + ", " + (k.totalPlaytime / 3.6e6).toFixed(2) + " h",
    );

    // Erst sichern, dann schreiben.
    const ok = await sichereJetzt("connect");
    if (!ok) {
      await alarm(
        "Kein pushAll",
        "Verbindung ist verifiziert, aber die Sicherung kam nicht gruen zustande. " +
          "Es wird nichts ins Spiel geschrieben.",
      );
      if (verifizierterSocket === geprueft) verifizierterSocket = null;
      return;
    }

    // Hat waehrend der Pruefung ein anderer Socket uebernommen, wird die
    // Freigabe NICHT erteilt. Sonst schriebe die Bruecke in eine Verbindung,
    // die sie nie geprueft hat.
    if (gameSocket !== geprueft) {
      await alarm(
        "Freigabe verweigert",
        "Waehrend der Verifikation hat eine andere Verbindung uebernommen. " +
          "Geprueft wurde Socket A, aktuell haengt Socket B - es wird nichts geschrieben.",
      );
      return;
    }

    verifizierterSocket = geprueft;
    state.verified = true;
    // Der Anker existiert ab jetzt; die naechste Verbindung wird wieder
    // vollstaendig geprueft.
    ankerPlaytime = k.totalPlaytime;
    await schreibeHeartbeat();

    if (keinAnker) {
      // Angenommen wurde die Verbindung trotzdem - eine Bruecke, die nach jedem
      // Reboot dichtmacht, waere im unbeaufsichtigten Betrieb schlimmer als das
      // Risiko. Aber der Zustand wird gemeldet: es ist der eine Zeitpunkt, an
      // dem eine unveraenderte Kopie durchgekommen waere.
      await sofortZeile(
        "Verbindung ohne Anker angenommen",
        "Beim Verbinden lag kein bekannter totalPlaytime-Wert vor - weder im " +
          "Heartbeat noch im Sicherungsindex. Die Verbindung wurde deshalb nur " +
          "ueber RFA-Port und identifier geprueft, und beide traegt auch eine " +
          "unveraenderte Kopie des Spielstands.\\n\\nAngenommen wurde BN" +
          k.bitNodeN + " Lauf " + k.lauf + " mit " +
          (k.totalPlaytime / 3.6e6).toFixed(2) + " h Spielzeit, Hacking " +
          k.hacking + ", " + k.augs + " Augmentierungen.\\n\\nWenn das nicht der " +
          "erwartete Stand ist: Bruecke beenden und doku/spielstand-schutz.md folgen.",
      );
    }
    await pushAll();

    if (zurueckgestellt.size) {
      const stapel = [...zurueckgestellt];
      zurueckgestellt.clear();
      log("info", "Nachgereicht aus dem unverified-Fenster: " + stapel.length + " Datei(en)");
      await schiebeStapel(stapel);
    }
  } catch (err) {
    // Timeout: Socket offen lassen und in 60 s erneut fragen. Ein Spiel, das
    // gerade laedt, ist kein fremdes Spiel.
    await alarm("Verifikation fehlgeschlagen", err.message);
    if (verifizierterSocket === geprueft) verifizierterSocket = null;
    setTimeout(() => {
      if (gameSocket && !istVerifiziert()) void verifiziereSocket(gameSocket);
    }, 60000);
  } finally {
    verifikationLaeuft = false;
    // Den vorgemerkten Socket jetzt pruefen - aber nur, wenn er noch der
    // aktuelle ist und noch nicht verifiziert wurde.
    const offen = nachzuholen;
    nachzuholen = null;
    if (offen && gameSocket === offen && !istVerifiziert()) {
      log("info", "Vorgemerkten Socket nachtraeglich pruefen");
      setTimeout(() => {
        if (gameSocket === offen && !istVerifiziert()) void verifiziereSocket(offen);
      }, 0);
    }
  }
}

// ---------------------------------------------------------------------------
// Sicherung
// ---------------------------------------------------------------------------

async function sichereJetzt(anlass) {
  try {
    const r = await sichere({
      dashPort: DASHBOARD_PORT,
      anlass,
      praefix: ROLLE.prefix,
      erwartetIdentifier: ROLLE.identifier,
      erwartetPort: RFA_PORT,
      primaer: BACKUP_ORT,
      spiegel: BACKUP_SPIEGEL_ORT,
    });
    if (!r.ok) {
      await alarm("Sicherung abgelehnt (" + anlass + ")", r.gruende.join(" | "));
      return false;
    }
    state.lastVerifiedBackup = {
      file: r.datei,
      ts: new Date().toISOString(),
      ageMin: 0,
      anlass,
    };
    state.lastSaveAt = new Date(r.kennwerte.lastSave).toISOString();
    state.lastSaveGemessenAm = new Date().toISOString();
    state.totalPlaytime = r.kennwerte.totalPlaytime;
    state.bitNode = r.kennwerte.bitNodeN;
    state.lauf = r.kennwerte.lauf;
    log("info", "Sicherung " + anlass + " gruen: " + r.datei + " (" + r.dauerMs + " ms)");
    if (r.b64Befund) {
      await sofortZeile(
        "Spielstand kam als Base64-Klartext",
        "Die RFA lieferte binary=false. Dieser Zweig war nie erprobt; die Datei liegt als " +
          ".json mit -b64 im Namen. Gehoert nach BEFUNDE.md.",
      );
    }
    return true;
  } catch (e) {
    await alarm("Sicherung ausgefallen (" + anlass + ")", e.message);
    return false;
  }
}

/**
 * Handschlag vor Einbau und Sprung: das Skript im Spiel legt
 * data/backup-request.txt ab, die Bruecke sichert und antwortet mit
 * data/backup-ok.txt. Das Skript wartet hoechstens 90 s darauf.
 */
async function pruefeHandschlag() {
  if (!istVerifiziert()) return;
  let roh;
  try {
    roh = await request("getFile", { filename: "data/backup-request.txt", server: "home" });
  } catch {
    return;
  }
  if (typeof roh !== "string" || !roh.trim()) return;
  let anfrage;
  try {
    anfrage = JSON.parse(roh);
  } catch {
    return;
  }
  if (!anfrage || !anfrage.ts) return;
  // Schon beantwortet?
  try {
    const ok = await request("getFile", { filename: "data/backup-ok.txt", server: "home" });
    if (ok && JSON.parse(ok).ts >= anfrage.ts) return;
  } catch {
    // noch keine Antwort
  }

  const anlass = anfrage.reason === "install" ? "pre-install" : "pre-jump";
  log("info", "Handschlag angefragt: " + anfrage.reason + " -> " + anlass);
  const gruen = await sichereJetzt(anlass);
  if (!gruen) return;
  await schreibeInsSpiel(
    "data/backup-ok.txt",
    JSON.stringify({ ts: Date.now(), anlass, datei: state.lastVerifiedBackup.file }),
    "bruecke",
  );
}

// ---------------------------------------------------------------------------
// Telemetrie und Rueckkanal
// ---------------------------------------------------------------------------

/**
 * Liest die Telemetrien der Registry-Werkzeuge.
 *
 * Der Zeitstempel kommt AUS DEM INHALT. Frueher stand hier new Date() bei jedem
 * erfolgreichen Lesen - damit meldete /api/state am 03.09. "vor 13 Sekunden"
 * fuer einen Block vom 21.08., und das Urteil "Tab eingefroren" konnte nie
 * ausloesen.
 *
 * Das Pollen von data/telemetry.txt ist entfallen: die schreibende telemetry.js
 * ist seit dem 21.08. tot, die Datei war 14 Tage alt und wurde vom Dashboard
 * als Lage ausgegeben.
 */
async function pollTelemetry() {
  if (!gameSocket || gameSocket.readyState !== 1 || !istVerifiziert()) return;

  try {
    const raw = await request("getFile", { filename: "data/bn4net.json", server: "home" });
    if (typeof raw === "string" && raw.trim()) {
      const t = JSON.parse(raw);
      state.telemetry = t;
      state.lastTelemetryReadAt = new Date().toISOString();
      // `zeit` ist der Zeitstempel, den der Motor selbst gesetzt hat.
      state.lastTelemetryAt = Number.isFinite(t.zeit) ? new Date(t.zeit).toISOString() : null;
      state.motorRound = t.runde ?? null;
    }
  } catch {
    // Solange im Spiel noch nichts geschrieben wurde, ist das normal.
  }

  try {
    const servers = await request("getAllServers");
    if (Array.isArray(servers)) state.servers = servers;
  } catch {
    // nicht schlimm, naechster Durchlauf
  }

  broadcast({ type: "state", state: publicState() });
}

/** Alle 10 min den echten lastSave holen - die einzige Sicht auf den Recovery-Modus. */
async function pruefeLastSave() {
  if (!istVerifiziert()) return;
  if (Date.now() - letzteSaveAbfrage < SAVE_ALTER_MS) return;
  letzteSaveAbfrage = Date.now();
  try {
    const antwort = await request("getSaveFile");
    const binary = antwort.binary !== false;
    const roh = binary ? Buffer.from(antwort.save, "latin1") : Buffer.from(antwort.save, "base64");
    const k = lesenKennwerte(roh, binary);
    state.lastSaveAt = new Date(k.lastSave).toISOString();
    state.lastSaveGemessenAm = new Date().toISOString();
    state.totalPlaytime = k.totalPlaytime;
    state.bitNode = k.bitNodeN;
    state.lauf = k.lauf;
    state.settings = {
      autosaveInterval: k.autosaveInterval,
      excludeRunningScriptsFromSave: k.excludeRunningScriptsFromSave,
      remoteFileApiPort: k.remoteFileApiPort,
      autoexecScript: k.autoexecScript,
      gelesenAm: new Date().toISOString(),
    };
  } catch {
    // naechster Durchlauf
  }
}

async function schreibeHeartbeat() {
  if (Number.isFinite(state.totalPlaytime)) ankerPlaytime = state.totalPlaytime;
  const eintrag = {
    ts: new Date().toISOString(),
    pid: process.pid,
    instance: ROLLE.instance,
    rfaPort: RFA_PORT,
    dashPort: DASHBOARD_PORT,
    connected: state.connected,
    verified: istVerifiziert(),
    connectedSince: state.connectedSince,
    lastTelemetryAt: state.lastTelemetryAt,
    lastSaveAt: state.lastSaveAt,
    totalPlaytime: ankerPlaytime,
    motorRound: state.motorRound,
    lastVerifiedBackup: state.lastVerifiedBackup,
    backupAgeMin: alterJuengsteMin(BACKUP_ORT, ROLLE.prefix),
  };
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(HEARTBEAT_DATEI(), JSON.stringify(eintrag, null, 1), "utf8");
  } catch {
    // egal
  }
}

/** Der Rueckkanal INS Spiel - der Kern liest ihn, um sein eigenes Netz zu kennen. */
async function schreibeRueckkanal() {
  if (!istVerifiziert()) return;
  const ageMin = alterJuengsteMin(BACKUP_ORT, ROLLE.prefix);
  const inhalt = {
    ts: Date.now(),
    instance: ROLLE.instance,
    pid: process.pid,
    lastVerifiedBackup: state.lastVerifiedBackup
      ? { ...state.lastVerifiedBackup, ageMin: ageMin == null ? null : Math.round(ageMin) }
      : null,
    settings: state.settings || null,
    alarm: state.alarm,
    zweitTabSperre: zweitTabMerker,
    masterRiegel: masterRiegelStand,
  };
  try {
    await schreibeInsSpiel("data/bridge.json", JSON.stringify(inhalt), "bruecke");
  } catch {
    // naechster Durchlauf
  }
}

/**
 * data/sofort.json ist der EINZIGE Weg vom Spiel nach nodes/BAUSTELLEN.md.
 * Ein Skript im Spiel laeuft im Browser und sieht nur home; es kann die Datei
 * nicht erreichen. Die Bruecke holt die Eintraege ab, entdoppelt sie ueber
 * quelle+titel und reicht sie an tools/liste.js weiter, den einzigen
 * zugelassenen Schreiber.
 */
/**
 * ENTDOPPLUNG MIT VERFALL (Skeptikerrunde 6).
 *
 * Vorher ein Set ohne Ablauf: EINE Meldung je Titel und Prozessleben, danach
 * Stille. Bei einem Titel, der eine Konstante ist - "Grosser Schub
 * verweigert" -, hiess das: die zweite und dritte Verweigerung waren
 * unsichtbar. Das ist keine Meldungsflut, es ist das Gegenteil, und das ist
 * schlimmer: der Mensch sieht einen Vorfall und haelt ihn fuer einmalig.
 *
 * Sechs Stunden sind lang genug, dass ein wiederkehrender Fehler nicht in
 * jede Zeile schreibt, und kurz genug, dass ein Vorfall am Abend nicht durch
 * einen am Morgen gedeckelt wird.
 */
const SOFORT_VERFALL_MS = 6 * 3600000;
const sofortGesehen = new Map();

async function sofortZeile(titel, text, quelle = "bruecke") {
  const schluessel = quelle + "|" + titel;
  const jetztMs = Date.now();
  for (const [k, t] of sofortGesehen) {
    if (jetztMs - t > SOFORT_VERFALL_MS) sofortGesehen.delete(k);
  }
  if (sofortGesehen.has(schluessel)) return;
  sofortGesehen.set(schluessel, jetztMs);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  /**
   * NUR DIE LIVE-ROLLE SCHREIBT IN ERICS ARBEITSLISTE.
   *
   * Belegt am 04.09.2026 02:27: die frisch aufgesetzte TEST-Instanz meldete
   * "Verbindung ohne Anker angenommen" und "Autosave steht" - beides in der
   * Sache richtig FUER DIE TESTKOPIE - und trug beides in nodes/BAUSTELLEN.md
   * ein, also in die Liste, an der Eric seine echte Arbeit ablesen soll.
   *
   * Eine Liste, in der Testlaufmeldungen stehen, wird nach dem dritten Mal
   * nicht mehr gelesen. Damit waere der einzige Kanal vom Spiel zu Eric
   * unbrauchbar - und zwar durch die Bauarbeit selbst, die ihn schuetzen soll.
   * TEST schreibt deshalb in eine eigene Datei unter pruefstand/.
   */
  if (!IST_LIVE) {
    try {
      const ziel = path.join(DATA_DIR, "sofort-test.md");
      await mkdir(DATA_DIR, { recursive: true });
      await appendFile(
        ziel,
        "\n### " + titel + "  (" + new Date().toISOString() + ", " + quelle + ")\n\n" + text + "\n",
        "utf8",
      );
      log("info", "TEST-Meldung nach " + ziel + " (nicht nach ## Sofort): " + titel);
    } catch (e) {
      log("error", "TEST-Meldung nicht schreibbar: " + e.message);
    }
    return;
  }

  const ordner = path.join(ROOT, "nodes", "BAU-2026-09", "sofort");
  const datei = path.join(ordner, ts + "-" + quelle + ".md");
  try {
    await mkdir(ordner, { recursive: true });
    await writeFile(datei, "### " + titel + "\n\n" + text + "\n", "utf8");
    // execFile statt execFileSync: die synchrone Fassung blockiert die
    // komplette Event-Loop je Eintrag - und holeSofortEintraege ruft sie in
    // einer Schleife auf. Waehrend sie laeuft, beantwortet die Bruecke keine
    // RFA-Nachricht, kein Dashboard und keinen Timer. (Befund 04.09.2026.)
    await new Promise((fertig, schiefgelaufen) => {
      execFile(
        "node",
        [path.join(ROOT, "tools", "liste.js"), "--eintragen", "sofort", "--datei", datei],
        { cwd: ROOT, encoding: "utf8" },
        (err) => (err ? schiefgelaufen(err) : fertig()),
      );
    });
    log("info", "Nach ## Sofort eingetragen: " + titel);
  } catch (e) {
    log("error", "Eintrag nach ## Sofort fehlgeschlagen (" + titel + "): " + e.message);
  }
}

async function holeSofortEintraege() {
  if (!istVerifiziert()) return;
  let roh;
  try {
    roh = await request("getFile", { filename: "data/sofort.json", server: "home" });
  } catch {
    return;
  }
  if (typeof roh !== "string" || !roh.trim()) return;
  let liste;
  try {
    liste = JSON.parse(roh);
  } catch {
    return;
  }
  if (!Array.isArray(liste)) return;
  for (const e of liste) {
    if (!e || !e.titel) continue;
    await sofortZeile(e.titel, e.text || "", e.quelle || "spiel");
  }
}

// ---------------------------------------------------------------------------
// Urteile - die Bruecke schreibt, sie handelt nicht
// ---------------------------------------------------------------------------

let letztesUrteil = { nichtVerbunden: 0, eingefroren: 0, autosave: 0 };
const URTEIL_ABSTAND_MS = 6 * 60 * 60000;

async function faelleUrteile() {
  const jetzt = Date.now();

  // (a) Spiel-Tab nicht verbunden
  if (!state.connected && state.connectedSince) {
    const seit = jetzt - new Date(state.connectedSince).getTime();
    if (seit > 30 * 60000 && jetzt - letztesUrteil.nichtVerbunden > URTEIL_ABSTAND_MS) {
      letztesUrteil.nichtVerbunden = jetzt;
      await sofortZeile(
        "Spiel-Tab nicht verbunden",
        "Die Bruecke laeuft, aber seit " + state.connectedSince + " haengt kein Spiel am " +
          "RFA-Port " + RFA_PORT + ". Der Bot steht still, solange der Tab zu ist. " +
          "Eric muss den Tab oeffnen.",
      );
    }
  }

  // (b) Tab eingefroren - lastTelemetryAt aus dem INHALT
  if (state.connected && state.lastTelemetryAt) {
    const alter = jetzt - new Date(state.lastTelemetryAt).getTime();
    if (alter > 10 * 60000 && jetzt - letztesUrteil.eingefroren > URTEIL_ABSTAND_MS) {
      letztesUrteil.eingefroren = jetzt;
      await sofortZeile(
        "Telemetrie veraltet",
        "Das Spiel ist verbunden, aber der Motor hat seit " +
          Math.round(alter / 60000) + " Minuten nichts geschrieben (Inhaltsstempel " +
          state.lastTelemetryAt + "). Entweder steht der Motor oder der Tab ist eingefroren.",
      );
    }
  }

  // (c) Autosave steht.
  //
  // Das Alter wird gegen den ZEITPUNKT DER MESSUNG gerechnet, nicht gegen jetzt.
  // `state.lastSaveAt` stammt aus pruefeLastSave, das nur alle zehn Minuten
  // laeuft (SAVE_ALTER_MS). Eine Schwelle von fuenf Minuten gegen "jetzt" waere
  // kleiner als der Auffrischtakt und feuerte deshalb auf einem kerngesunden
  // Spiel - garantiert, alle sechs Stunden.
  //
  // Das ist derselbe Fehler wie beim alten lastTelemetryAt, nur spiegelverkehrt:
  // statt nie zu feuern, feuert er immer. Beide vergiften denselben Kanal, den
  // fuer echte Notfaelle. (Befund 04.09.2026.)
  //
  // Zusaetzlich muss die Verbindung STEHEN. Belegt am 04.09.2026 02:27: eine
  // frisch geladene Instanz traegt das `lastSave` aus ihrem Spielstand, das
  // beliebig alt sein kann - beim Klon war es 56 Minuten. Das Urteil feuerte
  // deshalb SOFORT nach dem Laden, obwohl das Spiel nur noch keine Minute
  // gelaufen war und binnen 60 Sekunden von selbst speichert.
  // In einer Reload-Schleife waere daraus Dauerfeuer geworden.
  const verbunden = state.connectedSince
    ? jetzt - new Date(state.connectedSince).getTime()
    : 0;
  if (state.connected && verbunden > 10 * 60000 && state.lastSaveAt && state.lastSaveGemessenAm) {
    const alter =
      new Date(state.lastSaveGemessenAm).getTime() - new Date(state.lastSaveAt).getTime();
    if (alter > 5 * 60000 && jetzt - letztesUrteil.autosave > URTEIL_ABSTAND_MS) {
      letztesUrteil.autosave = jetzt;
      await sofortZeile(
        "Autosave steht",
        "lastSave im Spielstand war bei der Messung um " + state.lastSaveGemessenAm +
          " bereits " + Math.round(alter / 60000) + " Minuten alt " +
          "(Autosave-Intervall 60 s). Moegliche Ursache: Recovery-Modus oder " +
          "fehlgeschlagenes IndexedDB-Schreiben.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function publicState() {
  return {
    instance: ROLLE.instance,
    rfaPort: RFA_PORT,
    dashPort: DASHBOARD_PORT,
    connected: state.connected,
    verified: istVerifiziert(),
    connectedSince: state.connectedSince,
    lastTelemetryAt: state.lastTelemetryAt,
    lastTelemetryReadAt: state.lastTelemetryReadAt,
    lastSaveAt: state.lastSaveAt,
    bitNode: state.bitNode,
    lauf: state.lauf,
    identifier: state.identifier,
    motorRound: state.motorRound,
    lastVerifiedBackup: state.lastVerifiedBackup,
    backupAgeMin: alterJuengsteMin(BACKUP_ORT, ROLLE.prefix),
    alarm: state.alarm,
    zweitTabSperre: zweitTabMerker,
    masterRiegel: masterRiegelStand,
    serverCount: state.servers.length,
    rootedCount: state.servers.filter((s) => s.hasAdminRights).length,
    purchasedCount: state.servers.filter((s) => s.purchasedByPlayer).length,
    syncedFiles: state.syncedFiles,
  };
}

function broadcast(payload) {
  const line = "data: " + JSON.stringify(payload) + "\n\n";
  for (const client of dashboardClients) {
    try {
      client.write(line);
    } catch {
      dashboardClients.delete(client);
    }
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startDashboard() {
  return new Promise((fertig) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("data: " + JSON.stringify({ type: "state", state: publicState() }) + "\n\n");
      for (const entry of state.log.slice(-60)) {
        res.write("data: " + JSON.stringify({ type: "log", entry }) + "\n\n");
      }
      dashboardClients.add(res);
      req.on("close", () => dashboardClients.delete(res));
      return;
    }

    if (url.pathname === "/api/wache") {
      try {
        const roh = await readFile(path.join(DATA_DIR, "watchdog.json"), "utf8");
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(roh);
      } catch {
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ fehlt: true }));
      }
      return;
    }

    if (url.pathname === "/api/state") {
      res.writeHead(200, { "Content-Type": MIME[".json"] });
      res.end(
        JSON.stringify({
          ...publicState(),
          telemetry: state.telemetry,
          servers: state.servers,
          log: state.log.slice(-100),
        }),
      );
      return;
    }

    /**
     * Direkter Draht zur Remote API.
     *
     * SCHREIBSCHRANKE. Lesende Methoden gehen immer durch. pushFile und
     * deleteFile verlangen zusaetzlich `instance=<Rolle>` im Aufruf - ein
     * Werkzeug, das versehentlich die falsche Bruecke anspricht, faellt damit
     * auf, statt zu schreiben. Die Schonliste verlangt darueber hinaus
     * confirm=<dateiname>: boot.js, der Kern, exit.js, ausgang.js und
     * route.json sind der Rueckweg des Bots aus jedem Zustand.
     */
    if (url.pathname === "/api/rpc") {
      const method = url.searchParams.get("method");
      if (!method) {
        res.writeHead(400, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "Parameter 'method' fehlt" }));
        return;
      }

      if (!LESENDE_METHODEN.has(method)) {
        const behauptet = url.searchParams.get("instance");
        if (behauptet !== ROLLE.instance) {
          log(
            "warn",
            "403 fuer " + method + " von " + (req.socket.remotePort || "?") +
              " - instance=" + behauptet + ", diese Bruecke ist " + ROLLE.instance,
          );
          res.writeHead(403, { "Content-Type": MIME[".json"] });
          res.end(
            JSON.stringify({
              error:
                "Schreibende Methode " + method + " verlangt instance=" + ROLLE.instance,
            }),
          );
          return;
        }
        const ziel = url.searchParams.get("filename") || "";
        const basis = ziel.split("/").pop();
        if (method === "deleteFile" && SCHONLISTE.includes(basis)) {
          if (url.searchParams.get("confirm") !== basis) {
            log("warn", "403 fuer deleteFile " + ziel + " - confirm fehlt");
            res.writeHead(403, { "Content-Type": MIME[".json"] });
            res.end(
              JSON.stringify({
                error: ziel + " steht auf der Schonliste - confirm=" + basis + " noetig",
              }),
            );
            return;
          }
        }
      }

      if (!istVerifiziert() && method !== "getSaveFile") {
        res.writeHead(409, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "Socket noch nicht verifiziert" }));
        return;
      }

      // DIE ZWEIT-TAB-SPERRE (Auftrag 7.1.1, Befund W.6).
      //
      // Solange zwei Spiele im Verdacht stehen, denselben Spielstand zu
      // schreiben, geht NICHTS mehr ins Spiel. Der Grund ist einfach: welcher
      // der beiden Staende gerade gewinnt, ist unbekannt, und in einen
      // unbekannten Stand zu schreiben macht aus einem Rennen einen Schaden.
      //
      // Lesen bleibt erlaubt - man muss ja nachsehen koennen, was los ist.
      if (!LESENDE_METHODEN.has(method)) {
        const za = await zweitTabAlarm();
        if (za) {
          log("warn", "423 fuer " + method + " - Zweit-Tab-Sperre steht seit " + za.at);
          res.writeHead(423, { "Content-Type": MIME[".json"] });
          res.end(
            JSON.stringify({
              error: "Zweit-Tab-Sperre: seit " + za.at + " geht nichts ins Spiel. " +
                "Grund: " + za.text + " Aufheben: " + ZWEITTAB_DATEI + " loeschen.",
            }),
          );
          return;
        }
      }

      /**
       * AUCH DER DASHBOARD-WEG BEKOMMT DEN MASTER-RIEGEL (Runde 7, Befund 7).
       *
       * `filename` ist hier ein freier Abfrageparameter. Zehn Werkzeuge
       * benutzen den Weg - und sie schreiben ausnahmslos Steuerdateien unter
       * `data/`, fuer die ein Master-Riegel sinnlos waere. Aber nichts hielt
       * einen Aufruf mit `filename=lib/kern.js` auf, und das ist derselbe
       * Bautyp, den `schreibeInsSpiel` weiter oben als "ein Zufall, der genau
       * so aussieht wie eine Entscheidung" verurteilt.
       *
       * Die Regel ist schmal: alles unter `data/` geht durch wie bisher,
       * alles andere muss in master stehen oder freigegeben sein.
       */
      if (method === "pushFile" && MASTER_RIEGEL_AN) {
        const ziel = String(url.searchParams.get("filename") || "");
        if (ziel && !ziel.startsWith("data/")) {
          const frei = await freigabeListe();
          const index = ladeMasterIndex();
          const drin = frei.has(ziel) || (index && index.has(ziel));
          if (!drin) {
            log("error", "423 fuer pushFile " + ziel + " - nicht in master und "
              + "nicht freigegeben (Dashboard-Weg)");
            res.writeHead(423, { "Content-Type": MIME[".json"] });
            res.end(JSON.stringify({
              error: ziel + " steht weder im Git-Index von master noch in "
                + path.basename(FREIGABE_DATEI) + ". Steuerdateien unter data/ "
                + "sind davon nicht betroffen.",
            }));
            return;
          }
        }
      }

      // Eine schreibende Methode ueber das Dashboard kommt IMMER von aussen -
      // der Bot im Spiel benutzt diesen Weg nicht, er hat die ns-API.
      if (!LESENDE_METHODEN.has(method)) {
        await zaehleEingriff("rpc", method + " " + (url.searchParams.get("filename") || ""));
      }

      const params = {};
      for (const [key, value] of url.searchParams) {
        if (key !== "method" && key !== "instance" && key !== "confirm") params[key] = value;
      }
      try {
        const result = await request(
          method,
          Object.keys(params).length ? params : undefined,
          { trotzUnverified: method === "getSaveFile" },
        );
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ result }, null, 1));
      } catch (err) {
        res.writeHead(502, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    const wanted = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.join(DASHBOARD_DIR, path.normalize(wanted).replace(/^[\\/]+/, ""));
    if (!file.startsWith(DASHBOARD_DIR)) {
      res.writeHead(403).end("verboten");
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("nicht gefunden");
    }
  });

  // Ausdruecklich nur auf die Loopback-Schnittstelle binden. Sonst haengt
  // /api/rpc im ganzen Netz - und darueber kann jeder beliebige Remote-API-
  // Aufrufe ins Spiel schicken, Spielstand auslesen inbegriffen.
  server.listen(DASHBOARD_PORT, "127.0.0.1", () => {
    console.log("\n  Dashboard:  http://localhost:" + DASHBOARD_PORT + "/");
    fertig();
  });
  // Der Port IST das Lock. Laeuft schon eine Bruecke, beendet sich diese -
  // zwei Bruecken auf demselben Spiel erzeugen ein Rennen um jeden Schub.
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log("\n  ABBRUCH: Dashboard-Port " + DASHBOARD_PORT + " ist belegt.");
      console.log("  Es laeuft bereits eine Bruecke. Diese beendet sich.\n");
      process.exit(2);
    }
    log("error", "Dashboard-Server: " + err.message);
  });
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function startRfaServer() {
  return new Promise((fertig) => {
  const wss = new WebSocketServer({ port: RFA_PORT, host: "127.0.0.1" });

  /**
   * TOTE SOCKETS ERNTEN (Skeptikerrunde 6, zwei Agenten unabhaengig).
   *
   * Diese Bruecke hatte kein Ping/Pong. Ein Tab, der abstuerzt, verworfen
   * wird oder aus dem Standby nicht zurueckkommt, schickt keinen Close-Frame
   * - der Server-Socket bleibt auf `readyState === 1` stehen, bis TCP
   * irgendwann aufgibt. `data/bridge.log` zeigt fuer den 03./04.09. SIEBEN
   * "Spiel verbunden" und NULL "getrennt".
   *
   * Folge: JEDER Reconnect traf eine "lebende" alte Verbindung an und lief
   * in den Zweit-Tab-Zweig. Der haeufigste harmlose Vorgang im System sah
   * damit aus wie der seltenste gefaehrliche.
   *
   * 30 s Takt, zwei verpasste Pongs, dann `terminate()`. Das ist der uebliche
   * Zuschnitt fuer `ws` und deutlich kuerzer als die Drei-Sekunden-Frist der
   * Zweitverbindungspruefung - wer tot ist, ist beim naechsten Verbinden weg.
   */
  const PING_MS = 30000;
  const lebt = new WeakSet();
  const pingTimer = setInterval(() => {
    for (const sock of wss.clients) {
      if (sock.readyState !== 1) continue;
      if (!lebt.has(sock)) {
        log("warn", "Socket antwortet nicht mehr auf Ping - wird beendet");
        try { sock.terminate(); } catch { /* egal */ }
        continue;
      }
      lebt.delete(sock);
      try { sock.ping(); } catch { /* egal */ }
    }
  }, PING_MS);
  pingTimer.unref?.();

  wss.on("listening", () => {
    console.log("  RFA-Port:   " + RFA_PORT + "  (im Spiel unter Options -> Remote API eintragen)");
    fertig();
  });

  wss.on("connection", async (socket) => {
    // Frisch verbunden gilt als lebendig, sonst raeumte der erste Ping-Lauf
    // eine Verbindung ab, die noch gar nicht gefragt wurde.
    lebt.add(socket);
    socket.on("pong", () => lebt.add(socket));

    if (gameSocket && gameSocket.readyState === 1) {
      /**
       * Frueher gewann hier IMMER die neue Verbindung. Ein zweiter Tab haette
       * die Live-Verbindung stillschweigend uebernommen - Erics ausdrueckliches
       * Verbot, und der Weg, auf dem zwei autosavende Instanzen denselben
       * Spielstand ueberschreiben. Jetzt wird die bestehende zuerst befragt.
       */
      let alteLebt = false;
      try {
        await Promise.race([
          request("getFileMetadata", { filename: "boot.js", server: "home" }, { trotzUnverified: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("stumm")), 3000)),
        ]);
        alteLebt = true;
      } catch {
        alteLebt = false;
      }

      // AUFTRAG 7.1.1 VERLANGT VIER REAKTIONEN, GEBAUT WAREN ZWEI (Befund W.6).
      //
      // Alarm und `## Sofort`-Zeile standen hier seit dem ersten Entwurf. Was
      // fehlte, waren die beiden, die tatsaechlich schuetzen: der kuerzere
      // Sicherungstakt und die Sperre aller Eingriffe. Ein Alarm allein
      // beschreibt das Rennen, er gewinnt es nicht.
      //
      // ABER NUR, WENN DIE ALTE VERBINDUNG ANTWORTET (Skeptikerrunde 6, zwei
      // Agenten unabhaengig voneinander).
      //
      // Der erste Entwurf setzte die Sperre in BEIDEN Zweigen. Der Zweig
      // "schweigt" ist aber die Signatur eines RECONNECTS, nicht eines
      // zweiten Tabs: der alte Socket steht noch auf readyState 1 und
      // antwortet nicht mehr. Das erzeugen die harmlosesten Vorgaenge -
      // Rueckkehr aus dem Standby, Tab-Discard, ein Neuladen der Seite, ein
      // verdeckter Tab, der wegen der Drosselung (gemessen: 1 Timer-Wake je
      // Minute) die Drei-Sekunden-Frist reisst.
      //
      // Und `data/bridge.log` zeigt fuer den 03./04.09. SIEBEN "Spiel
      // verbunden" und NULL "getrennt" - tote Sockets werden hier nie
      // geerntet. Der Reconnect ist damit das haeufigste Ereignis im System,
      // nicht das seltenste.
      //
      // Eine Sperre, die nur ein Mensch aufheben kann, im haeufigsten
      // harmlosen Fall zu setzen, waere im Nachtbetrieb Risiko statt Schutz:
      // der Bot laeuft weiter, aber nichts kommt mehr herein, und niemand
      // sieht hin. Zwei Sockets, die BEIDE antworten, sind dagegen kein
      // Verdacht mehr, sondern ein Befund.
      if (alteLebt) {
        await setzeZweitTabAlarm(
          "Zweite RFA-Verbindung auf Port " + RFA_PORT + ", waehrend die " +
            "bestehende noch antwortet - zwei Spiele auf demselben Spielstand.",
        );
      } else {
        log(
          "warn",
          "Zweite Verbindung, aber die alte schweigt - als Reconnect gewertet, " +
            "KEINE Sperre. (Ein Save-Rennen zeigt sich an sinkendem totalPlaytime; " +
            "diesen Detektor traegt die Sicherungspruefung.)",
        );
      }

      await alarm(
        "Zweite RFA-Verbindung",
        "moeglicher zweiter Spiel-Tab, Save-Rennen pruefen. Bestehende Verbindung " +
          (alteLebt ? "antwortet - die neue wird geschlossen." : "schweigt - sie wird ersetzt."),
      );
      await sofortZeile(
        "Zweite RFA-Verbindung",
        "Ein zweites Spiel hat sich auf Port " + RFA_PORT + " verbunden. " +
          (alteLebt
            ? "Die bestehende Verbindung antwortet noch, die neue wurde geschlossen."
            : "Die bestehende Verbindung schwieg und wurde ersetzt.") +
          "\n\nMoeglicher zweiter Tab auf bitburner-official.github.io. Beide Tabs " +
          "speichern alle 60 s in dieselbe IndexedDB, der letzte Schreiber gewinnt. " +
          "Save-Rennen pruefen: sinkt totalPlaytime in den Sicherungen?",
      );

      if (alteLebt) {
        try {
          socket.close();
        } catch {
          // egal
        }
        return;
      }
      try {
        gameSocket.close();
      } catch {
        // egal
      }
    }

    gameSocket = socket;
    verifizierterSocket = null;
    state.verified = false;
    state.connected = true;
    state.connectedSince = new Date().toISOString();
    log("info", "Spiel verbunden - Verifikation laeuft, es wird noch nichts geschrieben");

    socket.on("message", handleGameMessage);

    socket.on("close", () => {
      if (gameSocket === socket) {
        gameSocket = null;
        state.connected = false;
      }
      // Die Freigabe erlischt IMMER mit ihrem Socket, auch wenn inzwischen ein
      // anderer in gameSocket steht.
      if (verifizierterSocket === socket) verifizierterSocket = null;
      if (gameSocket === null) {
        state.verified = false;
        log("warn", "Spielverbindung getrennt - warte auf neue Verbindung");
        broadcast({ type: "state", state: publicState() });
      }
    });

    socket.on("error", (err) => log("error", "Spielverbindung: " + err.message));

    // KEIN unbedingtes pushAll mehr. Erst pruefen, dann sichern, dann schieben.
    void verifiziereSocket(socket);
  });

  wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log("\n  ABBRUCH: RFA-Port " + RFA_PORT + " ist belegt.");
      console.log("  Es laeuft bereits eine Bruecke. Diese beendet sich.\n");
      process.exit(2);
    }
    log("error", "RFA-Server: " + err.message);
  });
  });
}

// Jede Ausnahme wird protokolliert, bevor der Prozess geht. Frueher riss eine
// unbehandelte Ausnahme die Bruecke weg, ohne eine Spur zu hinterlassen -
// zweimal am 03.09.2026, und niemand konnte sagen, warum.
process.on("uncaughtException", (err) => {
  console.log("XX uncaughtException: " + (err && err.stack ? err.stack : err));
  void schreibeLogZeile(new Date().toISOString() + "\tfatal\tuncaughtException: " + (err && err.stack));
  setTimeout(() => process.exit(1), 200);
});
process.on("unhandledRejection", (reason) => {
  console.log("XX unhandledRejection: " + reason);
  void schreibeLogZeile(new Date().toISOString() + "\tfatal\tunhandledRejection: " + reason);
  setTimeout(() => process.exit(1), 200);
});

async function schreibePid() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      path.join(DATA_DIR, "bridge.pid"),
      JSON.stringify({ pid: process.pid, instance: ROLLE.instance, rfaPort: RFA_PORT, dashPort: DASHBOARD_PORT, seit: new Date().toISOString() }),
      "utf8",
    );
  } catch {
    // egal
  }
}

console.log("\n=== Bitburner Bridge  [" + ROLLE.instance + "]  ===");
if (NO_PUSH) console.log("  --no-push:  es wird NICHTS ins Spiel geschrieben");
if (NO_WATCH) console.log("  --no-watch: src/ wird nicht beobachtet");
if (SCRIPT_DIR !== SCRIPT_DIR_VORGABE) console.log("  --src-dir: " + SCRIPT_DIR);
if (!MASTER_RIEGEL_AN) {
  console.log("  Master-Riegel AUS (--src-dir ohne --master-liste)");
} else if (MASTER_LISTE_DATEI) {
  console.log("  Master-Riegel gegen " + MASTER_LISTE_DATEI);
} else {
  // EIN STILLER RIEGEL, DER AN IST, ist genauso schlecht wie einer, der aus
  // ist: nach einem Vorfall laesst sich am Protokoll nicht belegen, dass er
  // lief. Und der Index wird gleich WARM geladen - dann faellt ein kaputtes
  // git beim Start auf, nicht erst beim ersten Schub.
  const i = ladeMasterIndex();
  const text = "Master-Riegel gegen git ls-tree master -- src/ ("
    + (i ? i.size + " Dateien" : "GIT ANTWORTET NICHT") + ")";
  console.log("  " + text);
  // UND INS PROTOKOLL, nicht nur auf die Konsole. Die Bannerzeile geht nach
  // stdout, und stdout landet je nach Starter nirgends - `data/bridge.log`
  // ist das, was nach einem Vorfall gelesen wird. Ein Riegel, dessen Wirken
  // sich dort nicht belegen laesst, ist im Nachhinein kein Beleg.
  log(i ? "info" : "error", text);
  masterRiegelStand = { an: true, quelle: "git", dateien: i ? i.size : null };
}

/**
 * ERST BINDEN, DANN ALLES ANDERE. Diese Reihenfolge ist nicht Kosmetik.
 *
 * Gemessen 04.09.2026 01:23: In der ersten Fassung liefen schreibePid() und
 * watchScripts() los, bevor der EADDRINUSE-Fehler eintraf. Eine zweite,
 * sofort sterbende Instanz ueberschrieb dadurch data/bridge.pid mit ihrer
 * eigenen PID (22204) - die lebende Bruecke (12472) war danach unter einer
 * toten Nummer verzeichnet, und jedes Werkzeug, das die Datei liest, haette
 * die lebende Bruecke fuer tot gehalten.
 *
 * Es ist dasselbe Muster, vor dem der Auftrag beim Wakelock warnt: eine
 * sterbende Doppelinstanz rollt den Zustand der lebenden zurueck. Wer nur den
 * Exit-Code prueft, sieht den Schaden nicht - der Test war gruen.
 */
await startRfaServer();
await startDashboard();
await schreibePid();
await ladeAnker();
await zweitTabAlarm();
watchScripts();

setInterval(() => {
  void pollTelemetry().catch(() => {});
}, POLL_INTERVAL_MS);

setInterval(() => {
  void schreibeHeartbeat();
}, HEARTBEAT_MS);

setInterval(() => {
  void schreibeRueckkanal();
  void faelleUrteile();
  void pruefeLastSave();
}, RUECKKANAL_MS);

setInterval(() => {
  void holeSofortEintraege();
  void pruefeHandschlag();
}, SOFORT_MS);

/**
 * Die Stundensicherung zaehlt ab der juengsten vorhandenen Sicherung, nicht ab
 * dem Prozessstart.
 *
 * Gemessen 04.09.2026 01:28: nach einem Neustart stand der Zaehler auf 0, und
 * die Bruecke sicherte zwei Minuten nach der letzten Sicherung erneut "hourly".
 * Bei einer Neustartschleife, die genau fuer den Absturzfall gebaut ist, haette
 * jeder Absturz eine zusaetzliche Sicherung erzeugt - der Anlassname "hourly"
 * waere zur Luege geworden, und die Rotation haette echte Stundenstaende gegen
 * Neustart-Artefakte ausgetauscht.
 *
 * Es ist derselbe Fehlertyp wie bei einer Frist ohne benannte Uhr: ein "je
 * Stunde", das sich beim Neustart still zuruecksetzt.
 */
{
  const alter = alterJuengsteMin(BACKUP_ORT, ROLLE.prefix);
  if (alter != null) letzteStundensicherung = Date.now() - alter * 60000;
}

setInterval(async () => {
  // Steht der Zweit-Tab-Verdacht, wird alle fuenf Minuten gesichert statt
  // stuendlich (Auftrag 7.1.1, Befund W.6).
  //
  // UND UNTER EIGENEM ANLASSNAMEN (Skeptikerrunde 6). Der erste Entwurf
  // behielt "hourly" - "damit die Rotation greift". Sie greift dann auch:
  // `ANLAESSE.hourly` ist ein Stueckzahldeckel (48), kein Altersdeckel. Nach
  // genau vier Stunden stehendem Alarm waere jede Sicherung von VOR dem
  // Vorfall herausrotiert - also der Bestand, aus dem man wiederherstellt,
  // und der Beleg, den die Alarmmeldung selbst anfordert. Die Massnahme
  // haette unbeaufsichtigt genau das weggeraeumt, was sie schuetzen soll.
  const rennen = !!(await zweitTabAlarm());
  const takt = rennen ? RACE_TAKT_MS : STUNDENSICHERUNG_MS;
  if (Date.now() - letzteStundensicherung < takt) return;
  if (!istVerifiziert()) return;
  letzteStundensicherung = Date.now();
  void sichereJetzt(rennen ? "race" : "hourly");
}, TIMER_TAKT_MS);
