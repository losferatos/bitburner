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
import { readFile, readdir, writeFile, mkdir, appendFile, stat, rename } from "node:fs/promises";
import { watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROLLEN,
  LIVE_ROOT,
  SCHONLISTE,
  BACKUP_PRIMAER,
  BACKUP_SPIEGEL,
  pfadGleich,
  textAusArgv,
  zahlAusArgv,
} from "./instanz.js";
import { sichere, lesenKennwerte, alterJuengsteMin } from "./backup.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SCRIPT_DIR = path.join(ROOT, "src");
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
const RFA_PORT = zahlAusArgv(argv, "--rfa-port", ROLLE.rfaPort);
const DASHBOARD_PORT = zahlAusArgv(argv, "--dash-port", ROLLE.dashPort);
const DATA_DIR = path.resolve(ROOT, textAusArgv(argv, "--data-dir", ROLLE.dataDir));

/**
 * TEST weigert sich, die Live-Ports zu binden. Ein vertippter Portparameter ist
 * sonst genau der Fehler, gegen den die ganze Rollentrennung gebaut ist.
 */
if (ROLLE.instance === "TEST" && (RFA_PORT === 12525 || DASHBOARD_PORT === 8795)) {
  console.log("  ABBRUCH: TEST darf 12525/8795 nicht binden (angefragt " + RFA_PORT + "/" + DASHBOARD_PORT + ")");
  process.exit(3);
}

const IST_LIVE = ROLLE.instance === "LIVE";
const BACKUP_ORT = IST_LIVE ? BACKUP_PRIMAER : path.join(ROOT, "pruefstand", "backups");
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
 */
let socketVerifiziert = false;
let verifikationLaeuft = false;

const state = {
  connected: false,
  connectedSince: null,
  /** Zeitstempel AUS DEM INHALT der Telemetrie, nicht der des Abrufs. */
  lastTelemetryAt: null,
  lastTelemetryReadAt: null,
  lastSaveAt: null,
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
    if (!socketVerifiziert && !opt.trotzUnverified) {
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
      out.push(...(await collectScripts(full, gameName)));
    } else if (SYNCABLE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
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

async function pushFile(localPath, gameName, nurBeiAenderung = false) {
  const content = await readFile(localPath, "utf8");
  if (nurBeiAenderung) {
    const fp = createHash("sha256").update(content).digest("hex");
    if (zuletztGeschoben.get(gameName) === fp) return null;
    await request("pushFile", { filename: gameName, content, server: "home" });
    zuletztGeschoben.set(gameName, fp);
    return gameName;
  }
  await request("pushFile", { filename: gameName, content, server: "home" });
  zuletztGeschoben.set(gameName, createHash("sha256").update(content).digest("hex"));
  return gameName;
}

async function pushAll() {
  if (NO_PUSH) {
    log("warn", "pushAll uebersprungen (--no-push)");
    return;
  }
  const files = await collectScripts();
  const done = [];
  for (const file of files) {
    try {
      await pushFile(file.localPath, file.gameName);
      done.push(file.gameName);
    } catch (err) {
      log("error", "Konnte " + file.gameName + " nicht uebertragen: " + err.message);
    }
  }
  state.syncedFiles = done;
  log("info", done.length + " Datei(en) ins Spiel uebertragen");
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
  if (!gameSocket || !socketVerifiziert) {
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
      // Geloeschte Dateien landen auch hier, das ist kein echter Fehler.
      log("warn", datei + ": " + err.message);
    }
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
async function verifiziereSocket() {
  if (verifikationLaeuft) return;
  verifikationLaeuft = true;
  const beginn = Date.now();
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
    // (1) Port
    if (k.remoteFileApiPort !== RFA_PORT) {
      gruende.push(
        "RemoteFileApiPort im Spielstand ist " + k.remoteFileApiPort +
          ", diese Bruecke haelt " + RFA_PORT,
      );
    }
    // (2) Rueckwaertssprung gegen den zuletzt gelesenen Wert dieser Rolle
    const hb = await leseHeartbeat();
    if (hb && Number.isFinite(hb.totalPlaytime)) {
      if (k.totalPlaytime < hb.totalPlaytime - 60000) {
        gruende.push(
          "totalPlaytime " + k.totalPlaytime + " liegt mehr als 60 s hinter dem zuletzt " +
            "gelesenen Wert " + hb.totalPlaytime + " - das ist eine aeltere Kopie oder ein Import",
        );
      }
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
      socketVerifiziert = false;
      return;
    }

    state.identifier = k.identifier;
    state.bitNode = k.bitNodeN;
    state.lauf = k.lauf;
    state.totalPlaytime = k.totalPlaytime;
    state.lastSaveAt = new Date(k.lastSave).toISOString();
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
      socketVerifiziert = false;
      return;
    }

    socketVerifiziert = true;
    state.verified = true;
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
    socketVerifiziert = false;
    setTimeout(() => {
      if (gameSocket && !socketVerifiziert) void verifiziereSocket();
    }, 60000);
  } finally {
    verifikationLaeuft = false;
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
  if (!socketVerifiziert) return;
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
  await request("pushFile", {
    filename: "data/backup-ok.txt",
    content: JSON.stringify({ ts: Date.now(), anlass, datei: state.lastVerifiedBackup.file }),
    server: "home",
  });
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
  if (!gameSocket || gameSocket.readyState !== 1 || !socketVerifiziert) return;

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
  if (!socketVerifiziert) return;
  if (Date.now() - letzteSaveAbfrage < SAVE_ALTER_MS) return;
  letzteSaveAbfrage = Date.now();
  try {
    const antwort = await request("getSaveFile");
    const binary = antwort.binary !== false;
    const roh = binary ? Buffer.from(antwort.save, "latin1") : Buffer.from(antwort.save, "base64");
    const k = lesenKennwerte(roh, binary);
    state.lastSaveAt = new Date(k.lastSave).toISOString();
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
  const eintrag = {
    ts: new Date().toISOString(),
    pid: process.pid,
    instance: ROLLE.instance,
    rfaPort: RFA_PORT,
    dashPort: DASHBOARD_PORT,
    connected: state.connected,
    verified: socketVerifiziert,
    connectedSince: state.connectedSince,
    lastTelemetryAt: state.lastTelemetryAt,
    lastSaveAt: state.lastSaveAt,
    totalPlaytime: state.totalPlaytime,
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
  if (!socketVerifiziert) return;
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
  };
  try {
    await request("pushFile", {
      filename: "data/bridge.json",
      content: JSON.stringify(inhalt),
      server: "home",
    });
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
const sofortGesehen = new Set();

async function sofortZeile(titel, text, quelle = "bruecke") {
  const schluessel = quelle + "|" + titel;
  if (sofortGesehen.has(schluessel)) return;
  sofortGesehen.add(schluessel);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const ordner = path.join(ROOT, "nodes", "BAU-2026-09", "sofort");
  const datei = path.join(ordner, ts + "-" + quelle + ".md");
  try {
    await mkdir(ordner, { recursive: true });
    await writeFile(datei, "### " + titel + "\n\n" + text + "\n", "utf8");
    execFileSync("node", [path.join(ROOT, "tools", "liste.js"), "--eintragen", "sofort", "--datei", datei], {
      cwd: ROOT,
      encoding: "utf8",
    });
    log("info", "Nach ## Sofort eingetragen: " + titel);
  } catch (e) {
    log("error", "Eintrag nach ## Sofort fehlgeschlagen (" + titel + "): " + e.message);
  }
}

async function holeSofortEintraege() {
  if (!socketVerifiziert) return;
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

  // (c) Autosave steht
  if (state.connected && state.lastSaveAt) {
    const alter = jetzt - new Date(state.lastSaveAt).getTime();
    if (alter > 5 * 60000 && jetzt - letztesUrteil.autosave > URTEIL_ABSTAND_MS) {
      letztesUrteil.autosave = jetzt;
      await sofortZeile(
        "Autosave steht",
        "lastSave im Spielstand ist " + Math.round(alter / 60000) + " Minuten alt " +
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
    verified: socketVerifiziert,
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

      if (!socketVerifiziert && method !== "getSaveFile") {
        res.writeHead(409, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "Socket noch nicht verifiziert" }));
        return;
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
  wss.on("listening", () => {
    console.log("  RFA-Port:   " + RFA_PORT + "  (im Spiel unter Options -> Remote API eintragen)");
    fertig();
  });

  wss.on("connection", async (socket) => {
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
          request("getFileMetadata", { filename: "boot.js", server: "home" }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("stumm")), 3000)),
        ]);
        alteLebt = true;
      } catch {
        alteLebt = false;
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
    socketVerifiziert = false;
    state.verified = false;
    state.connected = true;
    state.connectedSince = new Date().toISOString();
    log("info", "Spiel verbunden - Verifikation laeuft, es wird noch nichts geschrieben");

    socket.on("message", handleGameMessage);

    socket.on("close", () => {
      if (gameSocket === socket) {
        gameSocket = null;
        socketVerifiziert = false;
        state.connected = false;
        state.verified = false;
        log("warn", "Spielverbindung getrennt - warte auf neue Verbindung");
        broadcast({ type: "state", state: publicState() });
      }
    });

    socket.on("error", (err) => log("error", "Spielverbindung: " + err.message));

    // KEIN unbedingtes pushAll mehr. Erst pruefen, dann sichern, dann schieben.
    void verifiziereSocket();
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

setInterval(() => {
  if (Date.now() - letzteStundensicherung < STUNDENSICHERUNG_MS) return;
  if (!socketVerifiziert) return;
  letzteStundensicherung = Date.now();
  void sichereJetzt("hourly");
}, 60000);
