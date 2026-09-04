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
 * Er startet KEINE LIVE-Bruecke und bindet WEDER 12525 NOCH 8795. Die Ports
 * werden je Lauf frei gewaehlt, der Datenordner liegt unter `pruefstand/`.
 *
 * DIE ROLLE IST **MOCK**, NICHT TEST (seit 04.09.2026, Skeptiker Runde 5).
 * Das ist kein Etikett, sondern der Kern einer Reparatur: Der Test muss mit
 * einer Spielzeit OBERHALB des vorhandenen Ankers arbeiten - sonst weist die
 * Bruecke ihn zu Recht als Rueckwaertssprung ab. Jede verifizierte Verbindung
 * schreibt aber eine Sicherung in den Index, und der Anker steigt mit.
 *
 * Solange der Test die TEST-Rolle benutzte, hob er damit den Anker der Rolle,
 * mit der ein Mensch einen KLON von Erics Spielstand fuehrt: gemessen von 369
 * auf 6.800 Stunden nach wenigen Laeufen. Eine echte Kopie waere ab da
 * dauerhaft abgelehnt worden - `rotiere()` loescht Dateien, keine Indexzeilen.
 * Erfundene Spielzeiten und echte gehoeren nicht in denselben Index.
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
  // `process.execPath` STATT "node" (Skeptiker Runde 5, W5). Findet die
  // Umgebung `node` nicht auf dem PATH - Aufgabenplanung, ein .cmd mit eigenem
  // PATH, ein anderer Rechner -, wirft das Kindobjekt ein `error`-Ereignis
  // ohne Zuhoerer, und `exit` feuert NIE: `await b.exit` haengt dann
  // unbegrenzt. Der eigene Interpreter ist immer da.
  const proc = spawn(process.execPath, [path.join(cwd, "sync", "bridge.js"), ...args],
    { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const zeilen = [];
  const sammle = (d) => {
    for (const z of String(d).split("\n")) if (z.trim()) zeilen.push(z.trim());
  };
  proc.stdout.on("data", sammle);
  proc.stderr.on("data", sammle);
  // Ohne diesen Zuhoerer beendet ein Startfehler den ganzen Testlauf mit
  // "Unhandled 'error' event" - vor jedem Aufraeumen.
  const exit = new Promise((res) => {
    proc.on("exit", (code) => res(code));
    proc.on("error", (err) => { zeilen.push("STARTFEHLER: " + err.message); res(-1); });
  });
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
      case "getSaveFile": {
        if (opt.stummBeiSave) return;      // fuer die Timeout-Probe
        const geben = () => antwort({ save: saveBuf.toString("latin1"),
          binary: true, identifier: "testtesttest01" });
        // Verzoegert antworten - damit laesst sich eine LAUFENDE Verifikation
        // stellen, in die eine zweite Verbindung hineinplatzt.
        if (opt.saveVerzoegerungMs) setTimeout(geben, opt.saveVerzoegerungMs);
        else geben();
        return;
      }
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
 * AUFRAEUMEN AUCH BEI EINER AUSNAHME (Skeptiker Runde 5, W4).
 *
 * Die Schleifen am Dateiende laufen nur, wenn der Test durchlaeuft. Wirft ein
 * Abschnitt, bleiben bis zu sechs Ordner `pruefstand/t-<pid>-<n>` liegen - und
 * die stehen NICHT in .gitignore - sowie mehrere Brueckenprozesse, an denen
 * unter Windows kein Job-Objekt haengt.
 *
 * `process.on("exit")` feuert auch nach einer unbehandelten Ausnahme. Er darf
 * nur synchron arbeiten, deshalb `rmSync` und `kill`.
 */
let schonAufgeraeumt = false;
function raeumeAuf() {
  if (schonAufgeraeumt) return;
  schonAufgeraeumt = true;
  for (const p of aufraeumen) {
    try { if (p.exitCode === null) p.kill(); } catch { /* egal */ }
  }
  for (const o of tempOrdner) {
    try { fs.rmSync(o, { recursive: true, force: true }); } catch { /* egal */ }
  }
}
process.on("exit", raeumeAuf);
process.on("SIGINT", () => { raeumeAuf(); process.exit(130); });

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
  const idx = path.join(ROOT, "pruefstand", "mock-backups", "INDEX.tsv");
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

/**
 * DIE SPIELZEITEN DER ABSCHNITTE STEIGEN, und das ist keine Kosmetik.
 *
 * Jeder Abschnitt, der eine Verbindung verifiziert, schreibt eine Sicherung -
 * und die ist ab diesem Moment der Anker fuer den naechsten (die Kette lautet
 * Heartbeat -> Heartbeat-Datei -> INDEX.tsv, und der Index ueberlebt einen
 * frischen Datenordner). Ein Abschnitt mit derselben Spielzeit faellt deshalb
 * an Pruefung 2 durch, voellig zu Recht.
 *
 * Gemessen am 04.09.2026: genau das ist passiert - der Eingriffszaehler-
 * Abschnitt bekam HTTP 409, weil sein Spielstand eine Stunde hinter dem lag,
 * den der vorige Abschnitt gerade gesichert hatte.
 *
 * Die Zahlen stehen deshalb ausdruecklich hier und nicht verstreut im Text.
 */
const ZEIT = {
  normal: BASIS + 10 * STUNDE,
  normalWieder: BASIS + 20 * STUNDE,
  eingriff: BASIS + 30 * STUNDE,
  rueckwaertsVor: BASIS + 40 * STUNDE,
  rueckwaertsAlt: BASIS + 35 * STUNDE,   // 5 h hinter dem eigenen Anker
  zweite: BASIS + 50 * STUNDE,
  koeder: BASIS + 25 * STUNDE,
  rennen: BASIS + 55 * STUNDE,
  sperre: BASIS + 60 * STUNDE,
  schub: BASIS + 65 * STUNDE,
};

/**
 * DER ABLAGEORT DER TEST-ROLLE, VOR UND NACH DEM LAUF.
 *
 * Der Schaden aus Skeptikerrunde 5 (A-B1) bestand nicht aus falschem Code,
 * sondern aus falschen DATEN: dieser Test schrieb erfundene Spielzeiten in
 * denselben Sicherungsindex wie die echten Kopien von Erics Spielstand und hob
 * dessen Anker von 369 auf 6.800 Stunden. Eine echte Kopie waere ab da
 * dauerhaft als Rueckwaertssprung abgelehnt worden.
 *
 * Behoben ist das durch die eigene Rolle MOCK. Diese Zusicherung ist der
 * Waechter darueber - denn die Rolle steht an sieben Stellen in dieser Datei,
 * und eine vergessene genuegt.
 */
function testAblage() {
  const o = path.join(ROOT, "pruefstand", "backups");
  if (!fs.existsSync(o)) return [];
  return fs.readdirSync(o).sort();
}
const ABLAGE_VORHER = testAblage();

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
    ["RFA 12525", ["--instance", "MOCK", "--rfa-port", "12525", "--dash-port", "8796"]],
    ["Dashboard 8795", ["--instance", "MOCK", "--rfa-port", "12526", "--dash-port", "8795"]],
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
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  const bereit = await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);
  pruefe("die Bruecke startet", bereit, b.zeilen.slice(0, 2).join(" | "));

  // Ein Spiel, das auf getSaveFile SCHWEIGT. Die Bruecke darf dann nichts
  // schreiben - und zwar dauerhaft, nicht nur bis zum Timeout.
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.normal }), { stummBeiSave: true });
  await schlaf(3000);

  pruefe("die erste Frage ist getSaveFile",
    spiel.gesehen[0] === "getSaveFile", spiel.gesehen.slice(0, 3).join(", "));
  pruefe("und es kam KEIN pushFile",
    !spiel.gesehen.includes("pushFile"),
    spiel.gesehen.join(", ") || "(nichts)");
  // Nicht "auch sonst nichts Schreibendes" - das konnte nur rot werden, wenn
  // die Zeile darueber ohnehin rot ist (Skeptiker Runde 5, K4). Gefragt ist,
  // ob der Riegel im RICHTIGEN Zustand haengt: unverifiziert, und der einzige
  // Grund dafuer ist das ausbleibende getSaveFile.
  pruefe("die Bruecke fragt weiter nach - sie gibt nicht auf",
    spiel.gesehen.filter((m) => m === "getSaveFile").length >= 1,
    spiel.gesehen.length + " Aufrufe insgesamt: " + spiel.gesehen.join(", "));
  pruefe("und der Dashboard-Weg ist ebenfalls zu",
    await (async () => {
      try {
        const r = await fetch("http://127.0.0.1:" + dash
          + "/api/rpc?method=pushFile&instance=MOCK&filename=x.js&server=home&content=x");
        return r.status === 409;
      } catch { return false; }
    })(),
    "der Riegel sitzt in request(), nicht in den Aufrufern - er muss auch"
    + " von aussen halten");

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
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Der Port im Spielstand ist das EINZIGE Merkmal, das Live von einer Kopie
  // trennt - der identifier wandert beim Kopieren mit.
  const spiel = starteSpiel(rfa, baueSave({ port: rfa + 999, playtime: ZEIT.normal }));
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
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const backups = path.join(ROOT, "pruefstand", "mock-backups");
  // NAMEN MERKEN, NICHT ZAEHLEN. Der Ablageort wird gedeckelt (10 je Anlass
  // "connect", instanz.js ANLAESSE) - eine neue Sicherung kann also entstehen,
  // waehrend die aelteste geht, und die Anzahl bleibt gleich. Am 04.09.2026
  // hat genau das die Probe rot gemacht, obwohl die Bruecke richtig lag.
  const vorNamen = new Set(fs.existsSync(backups)
    ? fs.readdirSync(backups).filter((f) => f.startsWith("MOCK_")) : []);

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.normal }));
  const verifiziert = await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  pruefe("die Verbindung wird verifiziert", verifiziert,
    b.zeilen.slice(-3).join(" | "));

  const geschoben = await warteAufZeile(b.zeilen, /pushAll|geschoben|Datei\(en\)/i, 30000);
  pruefe("danach wird geschoben", geschoben || spiel.gesehen.includes("pushFile"),
    spiel.gesehen.filter((m) => m === "pushFile").length + " pushFile");

  // DIE REIHENFOLGE IST DER PUNKT. Eine Sicherung NACH dem ersten Schreiben
  // sichert einen Stand, den die Bruecke schon veraendert hat.
  const nachNamen = fs.existsSync(backups)
    ? fs.readdirSync(backups).filter((f) => f.startsWith("MOCK_")) : [];
  const neueNamen = nachNamen.filter((f) => !vorNamen.has(f));
  pruefe("eine NEUE Sicherung ist entstanden", neueNamen.length > 0,
    neueNamen.join(", ") || "keine neue unter " + nachNamen.length + " Dateien");

  // DIE REIHENFOLGE, WIRKLICH GEPRUEFT (Skeptiker Runde 5, W5).
  //
  // Hier stand `getSaveFile kam VOR dem ersten pushFile`, gemessen an den
  // Indizes der RPC-Liste. Das ist nahezu tautologisch: das RFA-Protokoll
  // BEGINNT immer mit getSaveFile, der Wachhund-Abschnitt sichert das eine
  // Bildschirmseite weiter oben eigens zu. `iSave` ist also stets 0, und
  // `0 < iPush` gilt, sobald ueberhaupt geschoben wurde. Rot wuerde die Probe
  // nur bei einem voellig anderen Fehler.
  //
  // Der Kommentar behauptete aber etwas anderes und Wichtigeres: dass die
  // SICHERUNG vor dem ersten Schreiben liegt. Die Daten dafuer stehen im
  // Protokoll der Bruecke - dort meldet sie beides mit eigener Zeile.
  const iSicher = b.zeilen.findIndex((z) => /Sicherung connect gruen/i.test(z));
  const iUeber = b.zeilen.findIndex((z) => /Datei\(en\) ins Spiel uebertragen/i.test(z));
  pruefe("die Sicherung steht VOR der Uebertragung",
    iSicher >= 0 && iUeber >= 0 && iSicher < iUeber,
    "Sicherung@" + iSicher + ", Uebertragung@" + iUeber
    + " - eine Sicherung DANACH sichert einen Stand, den die Bruecke schon"
    + " veraendert hat");

  // ---- Wiederverbinden ----
  // Dieselbe Falle wie im Rueckwaertssprung-Abschnitt: verbindet sich die
  // naechste, bevor die Bruecke das Trennen bemerkt hat, landet sie im Zweig
  // fuer die ZWEITE Verbindung und wird geschlossen.
  {
    const vorG = b.zeilen.filter((z) => /getrennt/i.test(z)).length;
    spiel.schliessen();
    const bis = Date.now() + 20000;
    let jetztG = vorG;
    while (Date.now() < bis && jetztG <= vorG) {
      await schlaf(100);
      jetztG = b.zeilen.filter((z) => /getrennt/i.test(z)).length;
    }
    pruefe("die Verbindung ist wirklich getrennt", jetztG > vorG);
  }
  // GEZAEHLT WIRD, NICHT GESUCHT. Die Zeile "Verifiziert in" steht nach der
  // ersten Verbindung schon da - eine Suche danach waere immer gruen gewesen,
  // egal ob die zweite Verbindung je geprueft wurde.
  const vorher2 = b.zeilen.filter((z) => /Verifiziert in/i.test(z)).length;
  const spiel2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.normalWieder }));
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
console.log("-- WEGWERFDATEIEN DES PRUEFSTANDS gehen NIE ins Spiel (B3) --");
{
  // DER EINZIGE RIEGEL, DER `.mock-*`-DATEIEN AUS ERICS SPIEL HAELT, WAR
  // UNGEPRUEFT (Skeptiker Runde 5, B3).
  //
  // Jeder Ebene-2-Test legt Wegwerfkopien NEBEN die Originale unter `src/` -
  // anders stimmen die relativen Pfade nicht. Und `src/` ist genau der Ordner,
  // den die Live-Bruecke beobachtet. Bisher hielt sie allein die Endung
  // draussen (`.mjs` fehlt in SYNCABLE) - ein Zufall zweier unabhaengiger
  // Entscheidungen, denn die Endung waehlt der Lader.
  //
  // Verschaerft nach dem Hot-Swap: faellt der Worktree weg, schreibt jeder
  // Test in `bitburner/src` selbst.
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Zwei Koeder in den beobachteten Ordner: einer mit der Endung, die der
  // Lader heute waehlt, und einer mit der, die jemand morgen waehlen koennte.
  const srcDir = path.join(ROOT, "src");
  const koeder = [
    path.join(srcDir, ".mock-koeder-" + process.pid + ".mjs"),
    path.join(srcDir, ".mock-koeder-" + process.pid + ".js"),
  ];
  for (const k of koeder) fs.writeFileSync(k, "// Wegwerfkopie" + String.fromCharCode(10), "utf8");

  try {
    const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.koeder }));
    const ok = await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
    pruefe("die Verbindung ist verifiziert", ok);
    await schlaf(3000);

    const geschoben = [...spiel.dateien.keys()];
    const mockDrin = geschoben.filter((n) => n.includes(".mock-"));
    pruefe("ueberhaupt wurde geschoben", geschoben.length > 0,
      geschoben.length + " Datei(en)");
    pruefe("aber KEINE Punktdatei ist dabei", mockDrin.length === 0,
      mockDrin.join(", "));
    pruefe("auch die mit der Endung .js nicht",
      !geschoben.some((n) => n.endsWith(".mock-koeder-" + process.pid + ".js")),
      "die Endung allein darf den Riegel nicht tragen");

    spiel.schliessen();
  } finally {
    for (const k of koeder) { try { fs.unlinkSync(k); } catch { /* egal */ } }
  }
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Eingriffszaehler: pushAll zaehlt nicht, ein RPC zaehlt --");
{
  // manual_actions HAT SOLL 0 UND IST ABNAHMEBEDINGUNG (Stufe B: 12 h ohne
  // Eingriff). Die Zahl hatte bis zum 04.09.2026 keinen Schreiber - sie stand
  // dauerhaft auf null und war damit unfaelschbar.
  //
  // Die beiden Proben hier sind die Grenze der Definition: das automatische
  // pushAll beim Verbinden ist KEIN Eingriff (der Auftrag nennt einen
  // Brueckenausfall ausdruecklich keinen), ein schreibender Aufruf ueber das
  // Dashboard ist einer.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const datenAbs = path.join(ROOT, datenRel);
  const buchDatei = path.join(datenAbs, "manual-actions.json");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", datenRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.eingriff }));
  const verifiziert = await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  pruefe("die Verbindung ist verifiziert", verifiziert,
    "ohne Verifikation antwortet das Dashboard mit 409, und der Zaehler "
    + "wuerde geprueft, ohne dass er je drankam");
  await schlaf(2000);

  pruefe("das pushAll beim Verbinden zaehlt NICHT als Eingriff",
    !fs.existsSync(buchDatei),
    spiel.gesehen.filter((m) => m === "pushFile").length
      + " pushFile beim Verbinden, und trotzdem kein Eintrag");

  // Jetzt ein schreibender Aufruf von aussen - genau das, was ein Mensch oder
  // eine Claude-Sitzung tut.
  let antwort = null;
  try {
    const r = await fetch("http://127.0.0.1:" + dash
      + "/api/rpc?method=pushFile&instance=MOCK&filename=zzz-probe.js&server=home&content=%2F%2Fx");
    antwort = r.status;
  } catch (e) {
    antwort = String(e.message);
  }
  await schlaf(1500);

  pruefe("der Aufruf kommt durch", antwort === 200, "HTTP " + antwort);
  pruefe("und er wird gezaehlt", fs.existsSync(buchDatei));
  if (fs.existsSync(buchDatei)) {
    const buch = JSON.parse(fs.readFileSync(buchDatei, "utf8"));
    pruefe("  genau ein Eintrag", buch.eintraege.length === 1,
      buch.eintraege.length + " Eintrag/Eintraege");
    pruefe("  mit der Art rpc", buch.eintraege[0] && buch.eintraege[0].art === "rpc",
      buch.eintraege[0] ? buch.eintraege[0].art + " / " + buch.eintraege[0].was : "");
    // `!== undefined` haette auch `null` bestanden (Skeptiker Runde 5, K4).
    // Der Zusatztext behauptet, die Spielzeit trenne die Laeufe - dann muss
    // sie eine Zahl sein, sonst trennt sie nichts.
    pruefe("  und mit Wanduhr UND einer echten Spielzeit",
      Number.isFinite(buch.eintraege[0].wall)
        && Number.isFinite(buch.eintraege[0].playtime),
      "Laeufe trennt kein Wanduhrdatum - playtime="
      + JSON.stringify(buch.eintraege[0].playtime));
  }

  // Und die Gegenprobe: LESEN zaehlt nicht.
  try {
    await fetch("http://127.0.0.1:" + dash + "/api/rpc?method=getAllFiles&server=home");
  } catch { /* egal */ }
  await schlaf(1200);
  if (fs.existsSync(buchDatei)) {
    const buch = JSON.parse(fs.readFileSync(buchDatei, "utf8"));
    pruefe("ein LESENDER Aufruf zaehlt nicht", buch.eintraege.length === 1,
      buch.eintraege.length + " Eintrag/Eintraege nach dem Lesen");
  }

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein RUECKWAERTSSPRUNG der Spielzeit wird abgewiesen --");
{
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Erst ein Stand mit 200 h - er setzt den Anker.
  const s1 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.rueckwaertsVor }));
  // DIE ERSTE VERBINDUNG SETZT DEN ANKER - ohne sie prueft der Abschnitt
  // nichts (dieselbe Falle wie in "zweite Verbindung", Skeptiker Runde 5, B2).
  pruefe("der hoehere Stand wird angenommen",
    await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000),
    "er ist der Anker, gegen den die aeltere Kopie gemessen wird");
  // AUF DAS TRENNEN WARTEN, UND ES ZUSICHERN.
  //
  // Ohne das lief der Abschnitt in den Zweig fuer die ZWEITE Verbindung: die
  // alte war noch offen, also wurde die neue geschlossen, statt geprueft zu
  // werden - und die Abweisung, um die es hier geht, fand nie statt. Der Test
  // war dadurch zeitabhaengig: einzeln schnell genug, im vollen
  // Suitendurchlauf nicht (gemessen 04.09.2026).
  const vorGetrennt = b.zeilen.filter((z) => /getrennt/i.test(z)).length;
  s1.schliessen();
  const bisTrenn = Date.now() + 20000;
  let jetztGetrennt = vorGetrennt;
  while (Date.now() < bisTrenn && jetztGetrennt <= vorGetrennt) {
    await schlaf(100);
    jetztGetrennt = b.zeilen.filter((z) => /getrennt/i.test(z)).length;
  }
  pruefe("die erste Verbindung ist wirklich getrennt", jetztGetrennt > vorGetrennt,
    "sonst landet die naechste im Zweig fuer die zweite Verbindung und wird"
    + " geschlossen, statt geprueft zu werden");

  // Dann eine aeltere Kopie mit 100 h. Genau der Fall, gegen den Pruefung 2
  // gebaut ist: ein Klon oder ein Import.
  // GEZAEHLT, NICHT GESUCHT (Skeptiker Runde 5). Das Wort "abgewiesen" steht
  // nach dem Abschnitt mit dem fremden RFA-Port schon im Protokoll - eine
  // Suche danach waere hier immer gruen gewesen. Und die Frist war mit 20 s zu
  // knapp: in einem vollen Suitendurchlauf ist die Verifikation langsamer, und
  // die Probe wurde rot, obwohl die Bruecke richtig lag.
  const vorAbw = b.zeilen.filter((z) => /abgewiesen|hinter dem zuletzt/i.test(z)).length;
  const s2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.rueckwaertsAlt }));
  const bisAbw = Date.now() + 40000;
  let jetztAbw = vorAbw;
  while (Date.now() < bisAbw && jetztAbw <= vorAbw) {
    await schlaf(100);
    jetztAbw = b.zeilen.filter((z) => /abgewiesen|hinter dem zuletzt/i.test(z)).length;
  }
  pruefe("die aeltere Kopie faellt durch", jetztAbw > vorAbw,
    vorAbw + " -> " + jetztAbw + " Abweisungen | " + b.zeilen.slice(-2).join(" | "));
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
  const datenRel = frischerDatenordner();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", datenRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const s1 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.zweite }));
  // DIE ERSTE VERBINDUNG MUSS VERIFIZIERT SEIN (Skeptiker Runde 5, B2).
  //
  // Sie war es bis zum 04.09.2026 nicht: ihre Spielzeit lag unter dem Anker,
  // den ein frueherer Abschnitt gesetzt hatte, also wurde sie abgewiesen. Die
  // drei Proben unten wurden trotzdem gruen, weil der Zweig fuer die zweite
  // Verbindung nur an `gameSocket.readyState` haengt und `alteLebt` ueber
  // `trotzUnverified` beantwortet wird. Geprueft wurde also der uninteressante
  // Fall, und der Abschnitt bezahlte 25 s fuer eine Frist, die ablaufen MUSSTE.
  const ersteOk = await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  pruefe("die erste Verbindung ist verifiziert", ersteOk,
    "sonst prueft der Abschnitt den Fall nicht, um den es geht");

  // Ein zweiter Tab. Frueher gewann hier IMMER die neue Verbindung - der Weg,
  // auf dem zwei autosavende Instanzen denselben Spielstand ueberschreiben.
  const s2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.zweite }));
  await schlaf(6000);
  pruefe("die zweite Verbindung wird geschlossen", !s2.istOffen(),
    "readyState " + s2.ws.readyState);
  pruefe("die erste lebt weiter", s1.istOffen());
  pruefe("und die Bruecke meldet es",
    b.zeilen.some((z) => /Zweite RFA-Verbindung|zweiter/i.test(z)),
    b.zeilen.slice(-2).join(" | "));

  // UND SIE SETZT DIE SPERRE (Auftrag 7.1.1, Befund W.6). Melden allein
  // reicht nicht: bis jemand die Meldung liest, koennen Stunden vergehen, und
  // in dieser Zeit soll nichts mehr ins Spiel gehen und alle 5 min gesichert
  // werden. Die Datei ist der Traeger beider Wirkungen.
  const sperrDatei = path.join(ROOT, datenRel, "zweittab-alarm.json");
  pruefe("und setzt die Zweit-Tab-Sperre", fs.existsSync(sperrDatei),
    "ohne sie bleibt es bei einer Meldung - Auftrag 7.1.1 verlangt vier "
    + "Reaktionen, nicht zwei");
  if (fs.existsSync(sperrDatei)) {
    const sp = JSON.parse(fs.readFileSync(sperrDatei, "utf8"));
    pruefe("  mit Zeitpunkt und Grund",
      typeof sp.at === "string" && Number.isFinite(sp.ts)
        && typeof sp.text === "string" && sp.text.length > 10,
      JSON.stringify(sp));
  }

  s1.schliessen();
  s2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein Socket, der IN eine laufende Verifikation platzt --");
{
  // GEFUNDEN, WEIL DER TEST UNTER LAST UMFIEL (04.09.2026).
  //
  // `verifiziereSocket` stieg bei laufender Verifikation mit einem blossen
  // `return` aus. Der neue Socket blieb dauerhaft unverifiziert: der Wachhund
  // liess nichts hinaus, jeder Schub landete in `zurueckgestellt`, und der
  // einzige Wiederholungsanlauf steht im catch-Zweig, den ein stiller
  // Ausstieg nie erreicht. Von aussen: eine gesunde Verbindung, die nichts tut.
  //
  // Das Fenster ist groesser, als es aussieht - "Verifiziert in ..." wird
  // geloggt, BEVOR Sicherung und pushAll laufen.
  //
  // Hier wird es absichtlich gestellt: das erste Spiel antwortet auf
  // getSaveFile erst nach 6 Sekunden, das zweite verbindet sich nach einer.
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const langsam = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.rennen }),
    { saveVerzoegerungMs: 6000 });
  await schlaf(1000);                       // die Verifikation laeuft jetzt
  langsam.schliessen();
  const zweit = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.rennen }));

  // Er muss ENTWEDER verifiziert ODER abgewiesen werden - nur nicht schweigen.
  const bis = Date.now() + 40000;
  let entschieden = false;
  while (Date.now() < bis && !entschieden) {
    await schlaf(200);
    entschieden = b.zeilen.some((z) => /Verifiziert in|abgewiesen/i.test(z));
  }
  pruefe("die zweite Verbindung wird entschieden, nicht verschwiegen", entschieden,
    b.zeilen.slice(-3).join(" | "));
  pruefe("und die Bruecke sagt, dass sie ihn vorgemerkt hat",
    b.zeilen.some((z) => /vorgemerkt|Vorgemerkten/i.test(z)),
    "sonst hat sie ihn nur zufaellig doch noch geprueft");

  zweit.schliessen();
  langsam.schliessen();
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
  const a = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(a.proc);
  await warteAufZeile(a.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // OHNE DIESEN RIEGEL laufen zwei Bruecken nebeneinander, und die zweite
  // schiebt in einen Socket, den die erste geprueft hat.
  const b2 = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
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
console.log("");
console.log("-- die ZWEIT-TAB-SPERRE: kein Schreiben, solange sie steht (W.6) --");
{
  // AUFTRAG 7.1.1 VERLANGT VIER REAKTIONEN AUF EINEN ZWEITEN SPIEL-TAB.
  // Gebaut waren zwei: Alarm und `## Sofort`-Zeile - beides Beschreibung.
  // Die beiden, die tatsaechlich schuetzen, fehlten: Sicherungstakt auf
  // 5 min und Sperre aller Eingriffe.
  //
  // Geprueft wird hier die Sperre, weil sie die einzige der vier ist, die
  // sich in Sekunden statt in Stunden zeigt. Der Takt steht in derselben
  // Abfrage (`zweitTabAlarm()`) und faellt mit ihr.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const sperrDatei = path.join(ROOT, datenRel, "zweittab-alarm.json");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", datenRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.sperre }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(1500);

  const schreibe = async () => {
    try {
      const r = await fetch("http://127.0.0.1:" + dash
        + "/api/rpc?method=pushFile&instance=MOCK&filename=zzz-sperre.js"
        + "&server=home&content=%2F%2Fx");
      return r.status;
    } catch (e) { return String(e.message); }
  };
  const lies = async () => {
    try {
      const r = await fetch("http://127.0.0.1:" + dash
        + "/api/rpc?method=getAllFiles&server=home");
      return r.status;
    } catch (e) { return String(e.message); }
  };

  pruefe("ohne Sperre kommt ein schreibender Aufruf durch",
    (await schreibe()) === 200,
    "sonst prueft der Rest dieses Abschnitts eine Sperre, die gar nicht wirkt");

  // Die Sperre von Hand setzen - so, wie die Bruecke selbst sie schreibt.
  fs.writeFileSync(sperrDatei, JSON.stringify({
    at: new Date().toISOString(), ts: Date.now(), text: "Probe",
  }), "utf8");
  await schlaf(300);

  pruefe("mit Sperre wird ein schreibender Aufruf mit 423 abgewiesen",
    (await schreibe()) === 423);
  pruefe("LESEN bleibt erlaubt - man muss nachsehen koennen",
    (await lies()) === 200);

  // Und sie laesst sich ohne Neustart aufheben. Das ist wichtig: ein
  // Brueckenneustart waere selbst ein Eingriff, und die Sperre gaebe es
  // sonst nur zusammen mit einem.
  fs.rmSync(sperrDatei, { force: true });
  await schlaf(300);
  pruefe("nach dem Loeschen der Datei geht es ohne Neustart weiter",
    (await schreibe()) === 200);

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der SCHUBDECKEL: ein Merge ist keine Einspielung (B.3) --");
{
  // DER STILLSTE WEG INS SPIEL, UND DER EINZIGE, DEN KEINE PROBE BETRAT.
  //
  // Alle 48 bisherigen Brueckenproben liefen mit `--no-watch`. Der Grund war
  // gut: der Watcher haengt an `<repo>/src`, und ein Test, der dort Dateien
  // anlegt, schiebt sie ins ECHTE Spiel. Seit dem 04.09.2026 gibt es
  // `--src-dir` (fuer LIVE gesperrt), und damit ist er pruefbar.
  //
  // Der Befund dahinter: der Bau liegt in `bitburner-bau`, die Live-Bruecke
  // beobachtet `bitburner/src`. Ein `git merge` haette rund vierzig Dateien
  // in einer Sekunde ins laufende Spiel gelegt - ohne Checkliste, ohne
  // Kanarienvogel, ohne die Reihenfolge aus Auftrag 9.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "src-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);

  const DATEIEN = [];
  for (let i = 1; i <= 12; i++) DATEIEN.push("w" + i + ".js");
  const schreibeAlle = (text) => {
    for (const d of DATEIEN) {
      fs.writeFileSync(path.join(quellAbs, d), "// " + text + "\n", "utf8");
    }
  };
  schreibeAlle("start");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel,
    "--src-dir", quellRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.schub }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(2000);

  pruefe("beim Verbinden gehen alle 12 Dateien hinaus - pushAll hat keinen Deckel",
    DATEIEN.every((d) => spiel.dateien.has("home:" + d)),
    [...spiel.dateien.keys()].join(", "));

  // (1) Ein normaler Umbau: drei Dateien. Muss durchgehen.
  for (const d of DATEIEN.slice(0, 3)) {
    fs.writeFileSync(path.join(quellAbs, d), "// drei\n", "utf8");
  }
  await schlaf(2500);
  pruefe("drei geaenderte Dateien gehen normal ins Spiel",
    DATEIEN.slice(0, 3).every((d) => (spiel.dateien.get("home:" + d) || "").includes("drei")),
    DATEIEN.slice(0, 3).map((d) => spiel.dateien.get("home:" + d)).join(" | "));

  // (2) Ein Merge: alle zwoelf auf einmal. Muss verweigert werden.
  const vorher = b.zeilen.length;
  schreibeAlle("merge");
  await schlaf(3000);
  pruefe("zwoelf auf einmal werden VERWEIGERT",
    b.zeilen.slice(vorher).some((z) => /Schub verweigert/i.test(z)),
    b.zeilen.slice(vorher).slice(-3).join(" | "));
  pruefe("und nichts davon erreicht das Spiel",
    !DATEIEN.some((d) => (spiel.dateien.get("home:" + d) || "").includes("merge")),
    DATEIEN.filter((d) => (spiel.dateien.get("home:" + d) || "").includes("merge")).join(", "));

  // (3) Mit Freibrief geht derselbe Schub durch.
  fs.writeFileSync(path.join(ROOT, datenRel, "schub-frei.txt"),
    "Probe " + new Date().toISOString(), "utf8");
  await schlaf(300);
  schreibeAlle("frei");
  await schlaf(3000);
  pruefe("mit data/schub-frei.txt geht derselbe Schub durch",
    DATEIEN.every((d) => (spiel.dateien.get("home:" + d) || "").includes("frei")),
    DATEIEN.filter((d) => !(spiel.dateien.get("home:" + d) || "").includes("frei")).join(", "));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
raeumeAuf();

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die TEST-Ablage ist unberuehrt (A-B1) --");
{
  const nachher = testAblage();
  const neu = nachher.filter((f) => !ABLAGE_VORHER.includes(f));
  pruefe("dieser Lauf hat NICHTS in pruefstand/backups geschrieben",
    neu.length === 0,
    neu.join(", ") + " - erfundene Spielzeiten gehoeren nicht in denselben"
    + " Index wie echte Spielstandskopien");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
