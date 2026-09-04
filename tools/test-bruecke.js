/**
 * Ebene 2: die Bruecke (`sync/bridge.js`) gegen ein nachgebautes Spiel.
 *
 * ===========================================================================
 * WARUM DIESER TEST DER WICHTIGSTE IST
 * ===========================================================================
 *
 * Die Bruecke ist der EINZIGE Prozess des ganzen Projekts, der Erics
 * Spielstand anfassen kann. Alles andere - Kern, Waechter, Gewerke - laeuft im
 * Spiel und kann dort hoechstens Skripte beenden. Die Bruecke schreibt Dateien
 * hinein und liest den Spielstand heraus.
 *
 * Sie hatte bis zum 04.09.2026 keinen einzigen Test. 1.560 Zeilen, drei
 * Schutzmechanismen (Wachhund, Rollentrennung, Sicherung vor dem ersten
 * Schreiben) - und keine Zeile, die je gepruefte, dass sie greifen. Auftrag
 * 6.1 verlangt den Test namentlich; die vierte Skeptikerrunde hat den Mangel
 * als eigenen Befund aufgeschrieben.
 *
 * ===========================================================================
 * WIE GEPRUEFT WIRD
 * ===========================================================================
 *
 * Die Bruecke laeuft als echter Unterprozess - nicht als importiertes Modul.
 * Das ist Absicht: ihre Schutzmechanismen sitzen zum Teil in `process.exit`
 * und in `wss.on("error")`, und beides laesst sich nur an einem echten Prozess
 * beobachten.
 *
 * Als Gegenstelle dient ein WebSocket-Client, der die RFA des Spiels
 * nachbildet: er beantwortet `getSaveFile` mit einem SYNTHETISCHEN
 * Spielstand, den dieser Test selbst baut (gzip, Magic-Bytes, PlayerSave,
 * SettingsSave). Damit laesst sich jede Pruefung der Bruecke gezielt
 * verletzen - falscher Port, ruecklaeufige Spielzeit, fremder identifier.
 *
 * ===========================================================================
 * WAS DIESER TEST NIEMALS TUT
 * ===========================================================================
 *
 * Er startet KEINE LIVE-Bruecke und bindet WEDER 12525 NOCH 8795. Die Rolle
 * ist immer TEST, die Ports werden je Lauf frei gewaehlt, der Datenordner
 * liegt unter `pruefstand/`.
 *
 * Die eine LIVE-Probe (Abschnitt "die Rollentrennung") laeuft gegen den
 * WORKTREE, nicht gegen die Arbeitskopie: dort MUSS die Bruecke abbrechen,
 * bevor sie irgendetwas bindet. Bestuende sie diese Probe nicht, waere das
 * schon der Beweis des Fehlers - der Prozess haette dann Port 12525 belegt.
 *
 * Aufruf: node tools/test-bruecke.js
 */

import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const BRIDGE = path.join(ROOT, "sync", "bridge.js");
const WORKTREE = path.resolve(ROOT, "..", "bitburner-bau");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ein freier Port - vom Betriebssystem vergeben, nie geraten. */
function freierPort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
}

// ---------------------------------------------------------------------------
// Der synthetische Spielstand
// ---------------------------------------------------------------------------

/**
 * Baut einen Spielstand in genau der Form, die `lesenKennwerte` erwartet:
 * gzip ueber JSON, das mit `{"ctor":"BitburnerSaveObject"` beginnt, mit
 * `PlayerSave` und `SettingsSave` als eingebetteten JSON-Zeichenketten.
 *
 * KEINE ECHTEN DATEN. Der identifier ist frei erfunden - die TEST-Rolle
 * prueft ihn ohnehin nicht (`instanz.js`: `identifier: null`, weil eine Kopie
 * denselben traegt). Was hier zaehlt, sind Port und Spielzeit.
 */
function baueSave({ port, playtime = 100 * 3600000, identifier = "testtesttest01",
  bitNode = 10, sf = { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 } }) {
  const player = {
    ctor: "PlayerObject",
    data: {
      identifier,
      bitNodeN: bitNode,
      sourceFiles: { ctor: "JSONMap", data: Object.entries(sf).map(([n, s]) => [Number(n), s]) },
      skills: { hacking: 1234 },
      money: 1e9,
      totalPlaytime: playtime,
      playtimeSinceLastBitnode: playtime / 2,
      playtimeSinceLastAug: playtime / 4,
      lastSave: Date.now(),
      augmentations: [],
      queuedAugmentations: [],
      sleeves: [],
      city: "Sector-12",
      factions: [],
      bladeburner: null,
    },
  };
  const settings = {
    AutosaveInterval: 60,
    ExcludeRunningScriptsFromSave: false,
    RemoteFileApiPort: port,
    AutoexecScript: "boot.js",
  };
  const save = {
    ctor: "BitburnerSaveObject",
    data: {
      PlayerSave: JSON.stringify(player),
      SettingsSave: JSON.stringify(settings),
      AllServersSave: "{}",
    },
  };
  const text = JSON.stringify(save);
  if (!text.startsWith('{"ctor":"BitburnerSaveObject"')) {
    throw new Error("Der Testspielstand faengt falsch an - die Schluesselreihenfolge zaehlt");
  }
  return zlib.gzipSync(Buffer.from(text, "utf8"));
}

// ---------------------------------------------------------------------------
// Bruecke und Spiel starten
// ---------------------------------------------------------------------------

/**
 * Startet eine TEST-Bruecke und sammelt ihre Ausgabe.
 * @returns {{proc: object, zeilen: string[], exit: Promise<number>}}
 */
function starteBruecke(args, cwd = ROOT) {
  const proc = spawn("node", [path.join(cwd, "sync", "bridge.js"), ...args],
    { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const zeilen = [];
  const sammle = (d) => {
    for (const z of String(d).split("\n")) if (z.trim()) zeilen.push(z.trim());
  };
  proc.stdout.on("data", sammle);
  proc.stderr.on("data", sammle);
  const exit = new Promise((res) => proc.on("exit", (code) => res(code)));
  return { proc, zeilen, exit };
}

/** Wartet, bis eine der Zeilen passt - oder die Frist ablaeuft. */
async function warteAufZeile(zeilen, muster, msMax = 20000) {
  const bis = Date.now() + msMax;
  while (Date.now() < bis) {
    if (zeilen.some((z) => muster.test(z))) return true;
    await schlaf(50);
  }
  return false;
}

/**
 * Das nachgebaute Spiel. Es verbindet sich als Client - so herum laeuft die
 * echte RFA auch: der Server ist die Bruecke, das Spiel waehlt an.
 */
function starteSpiel(rfaPort, saveBuf, opt = {}) {
  const ws = new WebSocket("ws://127.0.0.1:" + rfaPort);
  const gesehen = [];          // alle Methoden, die die Bruecke geschickt hat
  const dateien = new Map();   // was sie geschrieben hat
  let offen = false;
  ws.on("open", () => { offen = true; });
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    gesehen.push(m.method);
    const antwort = (result) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
    const fehlerAus = (msg) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: msg }));

    switch (m.method) {
      case "getSaveFile":
        if (opt.stummBeiSave) return;      // fuer die Timeout-Probe
        antwort({ save: saveBuf.toString("latin1"), binary: true, identifier: "testtesttest01" });
        return;
      case "pushFile":
        dateien.set(m.params.server + ":" + m.params.filename, m.params.content);
        antwort("OK");
        return;
      case "getFileMetadata":
        if (opt.stummBeiMetadata) return;  // fuer die Zweitverbindungs-Probe
        antwort({ filename: m.params.filename, ramUsage: 1 });
        return;
      case "getAllFiles":
        antwort([]);
        return;
      case "getFileNames":
        antwort([]);
        return;
      case "getFile":
        fehlerAus("not found");
        return;
      case "getDefinitionFile":
        antwort("");
        return;
      default:
        antwort("OK");
    }
  });
  ws.on("error", () => { /* der Test wertet die Zeilen aus, nicht die Socketfehler */ });
  return {
    ws, gesehen, dateien,
    istOffen: () => offen && ws.readyState === 1,
    schliessen: () => { try { ws.close(); } catch { /* egal */ } },
  };
}

const aufraeumen = [];
const tempOrdner = [];
function merkeZumAufraeumen(p) { aufraeumen.push(p); }

/**
 * JEDER ABSCHNITT BEKOMMT EINEN EIGENEN DATENORDNER.
 *
 * Sonst schleppt der Heartbeat den Anker des vorigen Abschnitts mit, und der
 * naechste faellt an Pruefung 2 durch. Beim ersten Lauf am 04.09.2026 ist
 * genau das passiert - vier Proben rot, und die Bruecke hatte jedes Mal
 * recht: sie sah eine Spielzeit von 100 h gegen einen Anker von 369 h.
 */
let ordnerNr = 0;
function frischerDatenordner() {
  const rel = path.join("pruefstand", "t-" + process.pid + "-" + (++ordnerNr));
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(abs, { recursive: true });
  tempOrdner.push(abs);
  return rel;
}

/**
 * Die Spielzeit, ab der dieser Lauf rechnet.
 *
 * Der Sicherungsindex unter `pruefstand/backups` ist der LETZTE Anker der
 * Kette (Heartbeat -> Heartbeat-Datei -> INDEX.tsv), und er ueberlebt einen
 * frischen Datenordner. Er wird deshalb GELESEN statt weggeraeumt: eine
 * Sicherung zu loeschen, um einen Test gruen zu bekommen, waere die falsche
 * Richtung.
 */
function basisPlaytime() {
  let hoechster = 0;
  const idx = path.join(ROOT, "pruefstand", "backups", "INDEX.tsv");
  if (fs.existsSync(idx)) {
    for (const zeile of fs.readFileSync(idx, "utf8").split("\n")) {
      for (const feld of zeile.split("\t")) {
        const n = Number(feld);
        // Spielzeiten sind Millisekunden und liegen weit ueber jeder
        // Zeilennummer; alles Kleinere ist ein anderes Feld.
        if (Number.isFinite(n) && n > 3600000 && n < 1e15 && n > hoechster) hoechster = n;
      }
    }
  }
  return hoechster + 1000 * 3600000;   // 1.000 h Luft nach oben
}

const BASIS = basisPlaytime();
const STUNDE = 3600000;

console.log("");
console.log("=== Die Bruecke gegen ein nachgebautes Spiel ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Rollentrennung: ohne --instance passiert gar nichts --");
{
  const b = starteBruecke([]);
  const code = await b.exit;
  pruefe("Abbruch mit Code 3", code === 3, "Code " + code);
  pruefe("und sie sagt, was fehlt",
    b.zeilen.some((z) => /--instance fehlt/.test(z)));

  const b2 = starteBruecke(["--instance", "QUATSCH"]);
  const c2 = await b2.exit;
  pruefe("eine unbekannte Instanz ebenso", c2 === 3, "Code " + c2);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- TEST darf die Live-Ports nicht binden --");
{
  // DAS IST DER RIEGEL VOR ERICS SPIELSTAND. Eine TEST-Bruecke auf Port 12525
  // wuerde den Live-Socket verdraengen und danach Testcode in die live file
  // schieben. Ein vertippter Portparameter genuegt.
  for (const [name, args] of [
    ["RFA 12525", ["--instance", "TEST", "--rfa-port", "12525", "--dash-port", "8796"]],
    ["Dashboard 8795", ["--instance", "TEST", "--rfa-port", "12526", "--dash-port", "8795"]],
  ]) {
    const b = starteBruecke(args);
    const code = await b.exit;
    pruefe("TEST mit " + name + " bricht ab", code === 3, "Code " + code);
    pruefe("  und bindet nichts", b.zeilen.some((z) => /darf 12525\/8795 nicht binden/.test(z)));
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- LIVE laeuft nur in der Arbeitskopie, nie im Worktree --");
{
  if (!fs.existsSync(path.join(WORKTREE, "sync", "bridge.js"))) {
    console.log("       (kein Worktree da - Probe uebersprungen)");
  } else {
    // Diese Probe MUSS abbrechen, bevor irgendein Port gebunden wird. Bestuende
    // sie nicht, haette der Prozess in diesem Moment Port 12525 belegt - der
    // Fehlschlag waere sein eigener Beweis.
    const b = starteBruecke(["--instance", "LIVE"], WORKTREE);
    const code = await b.exit;
    pruefe("LIVE aus dem Worktree bricht ab", code === 3, "Code " + code);
    pruefe("  mit der Begruendung Pfad oder Git-Wurzel",
      b.zeilen.some((z) => /Projektpfad|Git-Wurzel|Worktree/.test(z)),
      b.zeilen.slice(0, 3).join(" | "));
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Wachhund: vor der Verifikation geht nichts hinaus --");
let normalPorts = null;
{
  const rfa = await freierPort();
  const dash = await freierPort();
  normalPorts = { rfa, dash };
  const b = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  const bereit = await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);
  pruefe("die Bruecke startet", bereit, b.zeilen.slice(0, 2).join(" | "));

  // Ein Spiel, das auf getSaveFile SCHWEIGT. Die Bruecke darf dann nichts
  // schreiben - und zwar dauerhaft, nicht nur bis zum Timeout.
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS }), { stummBeiSave: true });
  await schlaf(3000);

  pruefe("die erste Frage ist getSaveFile",
    spiel.gesehen[0] === "getSaveFile", spiel.gesehen.slice(0, 3).join(", "));
  pruefe("und es kam KEIN pushFile",
    !spiel.gesehen.includes("pushFile"),
    spiel.gesehen.join(", ") || "(nichts)");
  pruefe("auch sonst nichts Schreibendes",
    !spiel.gesehen.some((m) => /^(pushFile|deleteFile|write)/.test(m || "")));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein Spielstand mit FREMDEM RFA-Port wird abgewiesen --");
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Der Port im Spielstand ist das EINZIGE Merkmal, das Live von einer Kopie
  // trennt - der identifier wandert beim Kopieren mit.
  const spiel = starteSpiel(rfa, baueSave({ port: rfa + 999, playtime: BASIS }));
  const abgewiesen = await warteAufZeile(b.zeilen, /abgewiesen|RemoteFileApiPort/i, 15000);
  pruefe("die Bruecke weist ab", abgewiesen,
    b.zeilen.slice(-2).join(" | "));
  await schlaf(1500);
  pruefe("und schreibt nichts", !spiel.gesehen.includes("pushFile"),
    spiel.gesehen.join(", "));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der normale Weg: pruefen, sichern, DANN schieben --");
let sicherungVorher = 0;
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const backups = path.join(ROOT, "pruefstand", "backups");
  sicherungVorher = fs.existsSync(backups)
    ? fs.readdirSync(backups).filter((f) => f.startsWith("TEST_")).length : 0;

  const b = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS }));
  const verifiziert = await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  pruefe("die Verbindung wird verifiziert", verifiziert,
    b.zeilen.slice(-3).join(" | "));

  const geschoben = await warteAufZeile(b.zeilen, /pushAll|geschoben|Datei\(en\)/i, 30000);
  pruefe("danach wird geschoben", geschoben || spiel.gesehen.includes("pushFile"),
    spiel.gesehen.filter((m) => m === "pushFile").length + " pushFile");

  // DIE REIHENFOLGE IST DER PUNKT. Eine Sicherung NACH dem ersten Schreiben
  // sichert einen Stand, den die Bruecke schon veraendert hat.
  const nachher = fs.existsSync(backups)
    ? fs.readdirSync(backups).filter((f) => f.startsWith("TEST_")).length : 0;
  pruefe("eine Sicherung ist entstanden", nachher > sicherungVorher,
    sicherungVorher + " -> " + nachher);

  const iPush = spiel.gesehen.indexOf("pushFile");
  const iSave = spiel.gesehen.indexOf("getSaveFile");
  pruefe("und getSaveFile kam VOR dem ersten pushFile",
    iSave >= 0 && (iPush === -1 || iSave < iPush),
    "getSaveFile@" + iSave + ", pushFile@" + iPush);

  // ---- Wiederverbinden ----
  spiel.schliessen();
  await warteAufZeile(b.zeilen, /getrennt/i, 10000);
  // GEZAEHLT WIRD, NICHT GESUCHT. Die Zeile "Verifiziert in" steht nach der
  // ersten Verbindung schon da - eine Suche danach waere immer gruen gewesen,
  // egal ob die zweite Verbindung je geprueft wurde.
  const vorher2 = b.zeilen.filter((z) => /Verifiziert in/i.test(z)).length;
  const spiel2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS + STUNDE }));
  const bis = Date.now() + 25000;
  let jetzt2 = vorher2;
  while (Date.now() < bis && jetzt2 <= vorher2) {
    await schlaf(100);
    jetzt2 = b.zeilen.filter((z) => /Verifiziert in/i.test(z)).length;
  }
  pruefe("nach dem Trennen wird neu verbunden und ERNEUT geprueft",
    jetzt2 > vorher2 && spiel2.gesehen.includes("getSaveFile"),
    vorher2 + " -> " + jetzt2 + " Verifikationen");

  spiel2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein RUECKWAERTSSPRUNG der Spielzeit wird abgewiesen --");
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Erst ein Stand mit 200 h - er setzt den Anker.
  const s1 = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS + 100 * STUNDE }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  s1.schliessen();
  await warteAufZeile(b.zeilen, /getrennt/i, 10000);

  // Dann eine aeltere Kopie mit 100 h. Genau der Fall, gegen den Pruefung 2
  // gebaut ist: ein Klon oder ein Import.
  const s2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS }));
  const abgewiesen = await warteAufZeile(b.zeilen, /abgewiesen|hinter dem zuletzt/i, 20000);
  pruefe("die aeltere Kopie faellt durch", abgewiesen, b.zeilen.slice(-2).join(" | "));
  await schlaf(1500);
  pruefe("und es wird nichts geschrieben", !s2.gesehen.includes("pushFile"),
    s2.gesehen.join(", "));

  s2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- eine ZWEITE Verbindung uebernimmt nicht, solange die erste lebt --");
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const s1 = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);

  // Ein zweiter Tab. Frueher gewann hier IMMER die neue Verbindung - der Weg,
  // auf dem zwei autosavende Instanzen denselben Spielstand ueberschreiben.
  const s2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: BASIS }));
  await schlaf(6000);
  pruefe("die zweite Verbindung wird geschlossen", !s2.istOffen(),
    "readyState " + s2.ws.readyState);
  pruefe("die erste lebt weiter", s1.istOffen());
  pruefe("und die Bruecke meldet es",
    b.zeilen.some((z) => /Zweite RFA-Verbindung|zweiter/i.test(z)),
    b.zeilen.slice(-2).join(" | "));

  s1.schliessen();
  s2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ZWEI BRUECKEN auf einem Port: die zweite beendet sich --");
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const dash2 = await freierPort();
  const a = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(a.proc);
  await warteAufZeile(a.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // OHNE DIESEN RIEGEL laufen zwei Bruecken nebeneinander, und die zweite
  // schiebt in einen Socket, den die erste geprueft hat.
  const b2 = starteBruecke(["--instance", "TEST", "--rfa-port", String(rfa),
    "--dash-port", String(dash2), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  const code = await Promise.race([b2.exit, schlaf(15000).then(() => "haengt")]);
  pruefe("die zweite Bruecke beendet sich mit Code 2", code === 2,
    "Code " + code + " | " + b2.zeilen.slice(-2).join(" | "));
  pruefe("und sagt, dass der Port belegt ist",
    b2.zeilen.some((z) => /belegt|EADDRINUSE/i.test(z)),
    b2.zeilen.slice(-1).join(""));
  if (code === "haengt") b2.proc.kill();

  pruefe("die erste laeuft unbeeindruckt weiter", a.proc.exitCode === null);
  a.proc.kill();
  await a.exit;
}

// ---------------------------------------------------------------------------
for (const p of aufraeumen) {
  try { if (p.exitCode === null) p.kill(); } catch { /* egal */ }
}
for (const o of tempOrdner) {
  try { fs.rmSync(o, { recursive: true, force: true }); } catch { /* egal */ }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
