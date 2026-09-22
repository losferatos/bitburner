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
import { spawn, execFileSync } from "node:child_process";
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
/**
 * DER PRUEFSTAND BLEIBT HERMETISCH (Skeptikerrunde 7).
 *
 * Seit dem Master-Riegel haengt jede Bruecke, die ohne `--master-liste`
 * startet, am COMMIT-Zustand des Arbeitsverzeichnisses: `git ls-tree master`.
 * Vierzehn der zwanzig Abschnitte liefen so. Heute passt es (142 Dateien auf
 * Platte, 142 in master) - aber wer waehrend einer Bau-Sitzung eine Datei
 * unter `src/` anlegt und dann testet, bekaeme rote oder, schlimmer,
 * anders-gruene Laeufe. Ein Test, dessen Ergebnis vom Commit-Zustand abhaengt,
 * misst nicht mehr den Code.
 *
 * Deshalb bekommt JEDE Bruecke ohne eigene Liste eine erzeugte: den heutigen
 * Stand von master, einmal beim Start dieses Laufs eingefroren.
 */
const MASTER_SNAPSHOT = (() => {
  const ziel = path.join(ROOT, "pruefstand", "master-" + process.pid + ".txt");
  try {
    const aus = execFileSync("git",
      ["ls-tree", "-r", "--name-only", "master", "--", "src/"],
      { cwd: ROOT, encoding: "utf8", timeout: 10000 });
    const namen = aus.split("\n").map((z) => z.trim()).filter(Boolean)
      .map((z) => z.replace(/^src\//, ""));
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, namen.join("\n") + "\n", "utf8");
    tempDateien.push(ziel);
    return path.relative(ROOT, ziel);
  } catch (e) {
    console.log("  HINWEIS: master-Schnappschuss nicht moeglich (" + e.message + ")");
    return null;
  }
})();

function starteBruecke(args, cwd = ROOT) {
  // Ohne eigene Liste und ohne eigenen Quellordner: den Schnappschuss
  // mitgeben, damit der Lauf nicht am Commit-Zustand haengt.
  if (MASTER_SNAPSHOT && !args.includes("--master-liste")
      && !args.includes("--src-dir")) {
    args = [...args, "--master-liste", MASTER_SNAPSHOT];
  }
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
        // Vorgegebene Dateien (22.09.2026, Handschlag-Probe): was der Test in
        // opt.lesbar ablegt, liefert das Spiel aus - sonst "not found".
        if (opt.lesbar && opt.lesbar.has(m.params.filename)) {
          antwort(opt.lesbar.get(m.params.filename));
          return;
        }
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
const tempDateien = [];
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
  for (const d of tempDateien) {
    try { fs.rmSync(d, { force: true }); } catch { /* egal */ }
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
  handschlag: BASIS + 22 * STUNDE,     // Handschlag-Probe (22.09.2026)
  handschlagOk: BASIS + 23 * STUNDE,
  handschlagAlt: BASIS + 24 * STUNDE,
  eingriff: BASIS + 30 * STUNDE,
  rueckwaertsVor: BASIS + 40 * STUNDE,
  rueckwaertsAlt: BASIS + 35 * STUNDE,   // 5 h hinter dem eigenen Anker
  zweite: BASIS + 50 * STUNDE,
  koeder: BASIS + 25 * STUNDE,
  rennen: BASIS + 55 * STUNDE,
  sperre: BASIS + 60 * STUNDE,
  schub: BASIS + 65 * STUNDE,
  // DIE REIHENFOLGE HIER IST DIE REIHENFOLGE IM DATEIABLAUF, und das ist
  // keine Kosmetik: jede verifizierte Verbindung hebt den Sicherungsanker.
  // Ein spaeterer Abschnitt mit kleinerer Spielzeit wird als
  // Rueckwaertssprung abgewiesen - und dann misst er nichts mehr, sondern
  // nur noch die Ablehnung. Genau das ist beim ersten Lauf der Taktprobe
  // passiert (04.09.2026): 80 h nach 90 h, null Rennsicherungen, und der
  // Befund sah aus wie ein Fehler im Takt.
  watcherSperre: BASIS + 70 * STUNDE,
  verfall: BASIS + 75 * STUNDE,
  grenze: BASIS + 80 * STUNDE,
  takt: BASIS + 85 * STUNDE,
  reconnect: BASIS + 90 * STUNDE,
  master: BASIS + 95 * STUNDE,
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
console.log("-- der HANDSCHLAG: eine Antwort mit FREMDEM Anlass zaehlt nicht (22.09.2026) --");
{
  // BAUSTELLEN Zeile 41. Liegt eine pre-install-Antwort, die juenger ist als
  // die jump-Anfrage, galt die Anfrage bisher als beantwortet - die Bruecke
  // sicherte nicht, und ausgang.js sprang nach 90 s ohne pre-jump-Sicherung.
  const rfa = await freierPort();
  const dash = await freierPort();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--sofort-ms", "1500",
    "--data-dir", frischerDatenordner()]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);
  const T = Date.now();
  const lesbar = new Map([
    ["data/backup-request.txt", JSON.stringify({ reason: "jump", target: "BN1 L2", ts: T })],
    ["data/backup-ok.txt", JSON.stringify({ ts: T + 1000, anlass: "pre-install", datei: "x" })],
  ]);
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.handschlag }), { lesbar });
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  const angefragt = await warteAufZeile(b.zeilen, /Handschlag angefragt: jump -> pre-jump/i, 15000);
  pruefe("die jump-Anfrage wird trotz juengerer pre-install-Antwort bearbeitet", angefragt,
    b.zeilen.slice(-4).join(" | "));
  const bis = Date.now() + 15000;
  let ok = null;
  while (Date.now() < bis && !ok) {
    await schlaf(200);
    const roh = spiel.dateien.get("home:data/backup-ok.txt");
    if (roh) { try { ok = JSON.parse(roh); } catch { ok = null; } }
  }
  pruefe("und mit einer pre-jump-Antwort quittiert", !!ok && ok.anlass === "pre-jump",
    ok ? JSON.stringify(ok) : "keine backup-ok.txt geschrieben");
  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der HANDSCHLAG: passender Anlass gilt als beantwortet, alte Anfragen nicht (22.09.2026) --");
{
  // Die Gegenstuecke zur Probe oben (Skeptiker Paket C, B7): eine Antwort
  // MIT passendem Anlass beendet den Handschlag - sonst saehe man hier nur,
  // dass die Bruecke IMMER sichert. Und eine Anfrage, die aelter ist als das
  // Wartefenster des Spiels, wird nicht mehr gesichert (B4/B5).
  const fahreHandschlag = async (zeit, lesbar) => {
    const rfa = await freierPort();
    const dash = await freierPort();
    const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
      "--dash-port", String(dash), "--no-watch", "--sofort-ms", "1500",
      "--data-dir", frischerDatenordner()]);
    merkeZumAufraeumen(b.proc);
    await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);
    const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: zeit }), { lesbar });
    await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
    // Vier Takte abwarten - lang genug, dass ein Handschlag sicher faellig war.
    await schlaf(6500);
    const angefragt = b.zeilen.some((z) => /Handschlag angefragt/i.test(z));
    spiel.schliessen();
    b.proc.kill();
    await b.exit;
    return angefragt;
  };
  const T = Date.now();
  const beantwortet = await fahreHandschlag(ZEIT.handschlagOk, new Map([
    ["data/backup-request.txt", JSON.stringify({ reason: "jump", target: "BN1 L2", ts: T })],
    ["data/backup-ok.txt", JSON.stringify({ ts: T + 1000, anlass: "pre-jump", datei: "x" })],
  ]));
  pruefe("eine Antwort mit PASSENDEM Anlass beendet den Handschlag", !beantwortet,
    "die Bruecke sicherte trotzdem - dann saehe die Probe oben nur 'sichert immer'");
  const alt = await fahreHandschlag(ZEIT.handschlagAlt, new Map([
    ["data/backup-request.txt", JSON.stringify({ reason: "jump", target: "BN1 L2", ts: Date.now() - 10 * 60000 })],
  ]));
  pruefe("eine zehn Minuten alte Anfrage wird NICHT mehr gesichert", !alt,
    "das Spiel wartet 90 s - danach saehe die Sicherung den Stand NACH dem Sprung");
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
  //
  // ---------------------------------------------------------------------
  // UND GENAU DAS TAT DIESER ABSCHNITT SELBST (gefunden 04.09.2026 14:20).
  //
  // Er legte seine beiden Koeder bis heute in den ECHTEN `src/`-Ordner -
  // also in den, den die LIVE-Bruecke beobachtet. Der Riegel `NIE_SCHIEBEN`
  // ist zwar gebaut, aber der LAUFENDE Brueckenprozess stammt von VOR dem
  // Einbau. Im Brueckenprotokoll steht die Folge, einmal je Testlauf:
  //
  //     12:00:58  Nachgeschoben: .mock-koeder-12884.js
  //     12:01:59  Nachgeschoben: .mock-koeder-22856.js
  //     12:03:15  Nachgeschoben: .mock-koeder-10644.js
  //
  // Ein Test, der die Zusicherung "Wegwerfdateien gehen NIE ins Spiel"
  // prueft, hat sie beim Pruefen selbst verletzt. Das ist derselbe
  // Fehlertyp wie der Sicherungsanker aus Runde 5 (A-B1): der Pruefstand
  // benutzt die Ablage, die er schuetzen soll.
  //
  // Seit heute gibt es `--src-dir` (fuer LIVE gesperrt). Der Abschnitt
  // beobachtet damit einen EIGENEN Ordner und prueft trotzdem dieselbe
  // Sache - nur ohne Erics Spiel anzufassen.
  // ---------------------------------------------------------------------
  const rfa = await freierPort();
  const dash = await freierPort();
  const quellRel = path.join("pruefstand", "koeder-" + process.pid);
  const srcDir = path.join(ROOT, quellRel);
  fs.rmSync(srcDir, { recursive: true, force: true });
  fs.mkdirSync(srcDir, { recursive: true });
  tempOrdner.push(srcDir);
  // Eine echte Datei muss dabei sein - sonst ist "ueberhaupt wurde
  // geschoben" nicht zu haben, und die Probe koennte gruen werden, weil
  // gar nichts hinausging.
  fs.writeFileSync(path.join(srcDir, "echt.js"), "// echt" + String.fromCharCode(10), "utf8");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", frischerDatenordner(),
    "--src-dir", quellRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Zwei Koeder in den beobachteten Ordner: einer mit der Endung, die der
  // Lader heute waehlt, und einer mit der, die jemand morgen waehlen koennte.
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
      // NACH data/ - das ist der realistische Fall (alle zehn Werkzeuge, die
      // diesen Weg benutzen, schreiben Steuerdateien) UND der einzige, den
      // der Master-Riegel seit dem 04.09.2026 durchlaesst: ein Skriptpfad,
      // der nicht in master steht, wird hier mit 423 abgewiesen.
      + "/api/rpc?method=pushFile&instance=MOCK&filename=data/zzz-probe.txt&server=home&content=x");
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
        + "/api/rpc?method=pushFile&instance=MOCK&filename=data/zzz-sperre.txt"
        + "&server=home&content=x");
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
  // 200 allein sagt nur, dass die Bruecke geantwortet hat. Angekommen ist die
  // Datei erst, wenn das nachgebaute Spiel sie hat (Skeptikerrunde 6, 1.6).
  await schlaf(500);
  pruefe("  und die Datei ist im Spiel angekommen",
    spiel.dateien.has("home:data/zzz-sperre.txt"),
    [...spiel.dateien.keys()].filter((k) => k.includes("zzz")).join(", "));

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
  // AUF DEN GRUND PRUEFEN, NICHT AUF DEN SATZ (Skeptikerrunde 6, 1.4).
  // "Schub verweigert" schreibt die Bruecke an ZWEI Stellen - hier und bei
  // der Zweit-Tab-Sperre. Ein Muster, das beide trifft, prueft nicht, welche
  // von beiden gegriffen hat.
  pruefe("zwoelf auf einmal werden VERWEIGERT, und zwar wegen SCHUB_MAX",
    b.zeilen.slice(vorher).some((z) => /> SCHUB_MAX/.test(z)),
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
console.log("");
console.log("-- die Sperre haelt AUCH den Watcher und AUCH pushAll (R6, 1.1) --");
{
  // DER GEFAEHRLICHSTE DER FUENF WEGE HATTE KEINE PROBE.
  //
  // Ein Skeptiker hat es gefunden: `grep -rn "zweittab-alarm" tools/` traf
  // nur den RPC-Abschnitt. Die Mutation `if (za) {` -> `if (false) {` im
  // Schub-Pfad waere gruen geblieben - und dann ginge bei stehender Sperre
  // jede gespeicherte Datei still ins Spiel, ueber den Weg, den der Kommentar
  // selbst "den stillsten aller Wege" nennt.
  //
  // Seit Runde 6 sitzt der Riegel in `pushFile`, also in der Engstelle. Diese
  // Proben pruefen ihn an den beiden Wegen, die ihn frueher umgingen.
  //
  // ZUR EHRLICHKEIT: die Eigenschaft ist doppelt gesichert - der alte Riegel
  // im Schub-Pfad und der neue in `pushFile`. Gemessen (04.09.2026): jede
  // EINZELNE der beiden Mutationen laesst diese Probe gruen, erst beide
  // zusammen machen sie rot. Sie nagelt also die EIGENSCHAFT fest, nicht eine
  // bestimmte Zeile - was hier richtig ist, aber gesagt gehoert.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "wsperre-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);
  fs.writeFileSync(path.join(quellAbs, "a.js"), "// eins" + String.fromCharCode(10), "utf8");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel, "--src-dir", quellRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.watcherSperre }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(1500);
  pruefe("ohne Sperre geht eine geaenderte Datei ins Spiel",
    spiel.dateien.has("home:a.js"));

  // Jetzt sperren und dieselbe Datei aendern.
  fs.writeFileSync(path.join(ROOT, datenRel, "zweittab-alarm.json"), JSON.stringify({
    at: new Date().toISOString(), ts: Date.now(), text: "Probe Watcher",
  }), "utf8");
  await schlaf(300);
  fs.writeFileSync(path.join(quellAbs, "a.js"), "// zwei" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("mit Sperre erreicht die Aenderung das Spiel NICHT",
    !(spiel.dateien.get("home:a.js") || "").includes("zwei"),
    String(spiel.dateien.get("home:a.js")).trim());
  pruefe("und die Bruecke sagt, warum",
    b.zeilen.some((z) => /Zweit-Tab-Sperre/i.test(z)),
    b.zeilen.slice(-2).join(" | "));

  // Und der lauteste Weg: eine neue Verbindung, also pushAll.
  const vorAll = spiel.dateien.size;
  spiel.schliessen();
  await schlaf(1000);
  const spiel2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.watcherSperre + 60000 }));
  await schlaf(5000);
  pruefe("auch pushAll beim Verbinden schreibt unter Sperre nichts",
    spiel2.dateien.size === 0,
    spiel2.dateien.size + " Datei(en) trotz Sperre - vorher waren es " + vorAll);

  spiel2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Freibrief VERFAELLT nach 30 Minuten (R6, 1.2) --");
{
  // Eine Mutation `return !!st;` waere bis Runde 6 gruen geblieben. Dann
  // waere der Freibrief unbefristet: eine einmal angelegte Datei schaltete
  // den Deckel dauerhaft ab - "eine abgeschaltete Sicherung", wie der
  // Entwurfskommentar es selbst nennt.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "verfall-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);
  const DATEIEN = [];
  for (let i = 1; i <= 12; i++) DATEIEN.push("v" + i + ".js");
  const schreibeAlle = (t) => {
    for (const d of DATEIEN) {
      fs.writeFileSync(path.join(quellAbs, d), "// " + t + String.fromCharCode(10), "utf8");
    }
  };
  schreibeAlle("start");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel, "--src-dir", quellRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.verfall }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(1500);

  // Ein Freibrief, der 31 Minuten alt ist. `utimesSync` ist der einzige Weg,
  // das zu stellen, ohne eine halbe Stunde zu warten.
  const frei = path.join(ROOT, datenRel, "schub-frei.txt");
  fs.writeFileSync(frei, "alt", "utf8");
  const alt = (Date.now() - 31 * 60000) / 1000;
  fs.utimesSync(frei, alt, alt);

  const vorher = b.zeilen.length;
  schreibeAlle("verfallen");
  await schlaf(3000);
  pruefe("ein 31 Minuten alter Freibrief gilt NICHT",
    b.zeilen.slice(vorher).some((z) => /> SCHUB_MAX/.test(z)),
    b.zeilen.slice(vorher).slice(-3).join(" | "));
  pruefe("  und nichts davon erreicht das Spiel",
    !DATEIEN.some((d) => (spiel.dateien.get("home:" + d) || "").includes("verfallen")));

  // Gegenprobe: derselbe Freibrief, frisch.
  fs.writeFileSync(frei, "frisch", "utf8");
  await schlaf(300);
  const vorher2 = b.zeilen.length;
  schreibeAlle("frisch");
  await schlaf(3500);
  pruefe("ein frischer Freibrief laesst denselben Schub durch",
    DATEIEN.every((d) => (spiel.dateien.get("home:" + d) || "").includes("frisch")),
    DATEIEN.filter((d) => !(spiel.dateien.get("home:" + d) || "").includes("frisch")).join(", "));
  // POSITIV pruefen, nicht nur am Ergebnis (Skeptikerrunde 6, 1.3): ein
  // Stapel, der wegen der Entprellung in zwei Haelften zerfaellt, kaeme auch
  // ohne Freibrief durch - und die Probe waere aus dem falschen Grund gruen.
  pruefe("  und es war wirklich EIN grosser Stapel",
    b.zeilen.slice(vorher2).some((z) => /12 Dateien zusammen nachgeschoben/i.test(z)),
    b.zeilen.slice(vorher2).slice(-3).join(" | "));
  // Einmal-Ticket: nach dem Durchgang ist er weg.
  pruefe("  und der Freibrief ist danach verbraucht", !fs.existsSync(frei));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Grenze liegt bei genau 8 (R6, 1.5) --");
{
  // Vorher sicherte der Test nur das Intervall 3 < SCHUB_MAX < 12 - `11`
  // haette beide Proben bestanden. Hier sind es genau acht und genau neun.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "grenze-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);
  const ALLE = [];
  for (let i = 1; i <= 9; i++) ALLE.push("g" + i + ".js");
  for (const d of ALLE) {
    fs.writeFileSync(path.join(quellAbs, d), "// start" + String.fromCharCode(10), "utf8");
  }

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel, "--src-dir", quellRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.grenze }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(1500);

  const acht = ALLE.slice(0, 8);
  for (const d of acht) {
    fs.writeFileSync(path.join(quellAbs, d), "// acht" + String.fromCharCode(10), "utf8");
  }
  await schlaf(3000);
  pruefe("genau acht gehen durch",
    acht.every((d) => (spiel.dateien.get("home:" + d) || "").includes("acht")),
    acht.filter((d) => !(spiel.dateien.get("home:" + d) || "").includes("acht")).join(", "));

  const vorher = b.zeilen.length;
  for (const d of ALLE) {
    fs.writeFileSync(path.join(quellAbs, d), "// neun" + String.fromCharCode(10), "utf8");
  }
  await schlaf(3000);
  pruefe("genau neun werden verweigert",
    b.zeilen.slice(vorher).some((z) => /> SCHUB_MAX/.test(z)),
    b.zeilen.slice(vorher).slice(-3).join(" | "));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- unter Sperre wird OEFTER gesichert, und unter eigenem Anlass (R6, 1.7) --");
{
  // `ZWEITTAB_SICHERUNG_MS` liess sich auf fuenf STUNDEN setzen, ohne dass
  // eine der 59 Proben rot wurde - der Takt war eine Zusicherung ohne Probe.
  // Messbar wird er ueber `--race-takt-ms` (fuer LIVE gesperrt).
  //
  // Und der Anlassname ist der zweite Teil des Befunds: unter "hourly" haette
  // der Stueckzahldeckel (48) die Historie in vier Stunden auf vier
  // zusammengeschnurrt.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const sperrDatei = path.join(ROOT, datenRel, "zweittab-alarm.json");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", datenRel,
    "--race-takt-ms", "2000"]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.takt }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(2000);

  const vorher = b.zeilen.filter((z) => /Sicherung race gruen/i.test(z)).length;
  pruefe("ohne Sperre gibt es keine Rennsicherung", vorher === 0);

  fs.writeFileSync(sperrDatei, JSON.stringify({
    at: new Date().toISOString(), ts: Date.now(), text: "Probe Takt",
  }), "utf8");
  await schlaf(7000);
  const nachher = b.zeilen.filter((z) => /Sicherung race gruen/i.test(z)).length;
  pruefe("mit Sperre entstehen Sicherungen im Renntakt", nachher >= 2,
    nachher + " Rennsicherung(en) in 7 s bei 2 s Takt");
  pruefe("  und sie heissen NICHT hourly - sonst frisst der Deckel die Historie",
    !b.zeilen.some((z) => /Sicherung hourly gruen/i.test(z)),
    b.zeilen.filter((z) => /Sicherung .* gruen/i.test(z)).slice(-2).join(" | "));

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein RECONNECT ist kein zweiter Tab (R6, Praemisse) --");
{
  // Der erste Entwurf setzte die Sperre in BEIDEN Zweigen. Der Zweig, in dem
  // die alte Verbindung SCHWEIGT, ist aber die Signatur eines Reconnects -
  // und ohne Ping/Pong (bis heute) war das der haeufigste Vorgang im System.
  // Eine Sperre, die nur ein Mensch aufheben kann, im haeufigsten harmlosen
  // Fall zu setzen, waere im Nachtbetrieb Risiko statt Schutz.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--no-watch", "--data-dir", datenRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /RFA|lauscht|Bruecke|Dashboard/i, 15000);

  // Die erste Verbindung antwortet auf getSaveFile, aber NICHT auf
  // getFileMetadata - genau der Zustand eines toten Tabs, der noch offen ist.
  const s1 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.reconnect }),
    { stummBeiMetadata: true });
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);

  // Hoehere Spielzeit als s1: der Anker steht nach dessen Verifikation, und
  // ein gleich alter Stand faellt als Rueckwaertssprung durch - dann pruefte
  // dieser Abschnitt die Ablehnung statt den Reconnect.
  const s2 = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.reconnect + 3600000 }));
  await schlaf(7000);

  const sperrDatei = path.join(ROOT, datenRel, "zweittab-alarm.json");
  pruefe("die schweigende alte Verbindung wird ersetzt",
    b.zeilen.some((z) => /schwieg|ersetzt/i.test(z)),
    b.zeilen.slice(-3).join(" | "));
  pruefe("und es wird KEINE Sperre gesetzt", !fs.existsSync(sperrDatei),
    "ein Reconnect darf den Bot nicht bis zum naechsten Menschen anhalten");
  pruefe("die Bruecke sagt trotzdem, dass sie es gesehen hat",
    b.zeilen.some((z) => /Reconnect gewertet/i.test(z)),
    b.zeilen.slice(-3).join(" | "));

  s1.schliessen();
  s2.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- DER MASTER-RIEGEL: was nicht committet ist, geht nicht hinaus --");
{
  // DER ANLASS IST EIN AUSRUTSCHER, KEIN GEDANKENSPIEL.
  //
  // Am 04.09.2026 um 06:40 landete eine Datei im Live-Baum statt im Worktree
  // und war 400 ms spaeter im laufenden Spiel. Diesmal war es
  // `lib/blackops.json` und harmlos; ein halbfertiges Skript waere es nicht
  // gewesen. Der Worktree schuetzt nur, solange jeder Agent den richtigen
  // Baum trifft - und einmal hat es schon nicht geklappt.
  //
  // Der Riegel arbeitet auf PFADebene: eine Aenderung an einer bekannten
  // Datei ist der Alltag und darf nicht blockiert werden, eine NEUE
  // unbekannte Datei ist der Fehlgriff.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "master-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);

  // `bekannt.js` steht in der Ersatz-Masterliste, `fremd.js` nicht.
  fs.writeFileSync(path.join(quellAbs, "bekannt.js"), "// eins" + String.fromCharCode(10), "utf8");
  fs.writeFileSync(path.join(quellAbs, "fremd.js"), "// fremd" + String.fromCharCode(10), "utf8");
  // Die Liste liegt NEBEN dem Quellordner, nicht darin - sonst beobachtet der
  // Watcher sie mit und meldet sie brav als "nicht in master".
  const listeRel = path.join(datenRel, "MASTER.txt");
  fs.writeFileSync(path.join(ROOT, listeRel),
    "bekannt.js" + String.fromCharCode(10), "utf8");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel,
    "--src-dir", quellRel, "--master-liste", listeRel]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);

  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.master }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(2500);

  // (1) pushAll beim Verbinden - der lauteste Weg.
  pruefe("die bekannte Datei geht beim Verbinden hinaus",
    spiel.dateien.has("home:bekannt.js"),
    [...spiel.dateien.keys()].join(", "));
  pruefe("die UNBEKANNTE nicht - auch nicht ueber pushAll",
    !spiel.dateien.has("home:fremd.js"),
    "pushAll war frueher der Weg, der an jedem Riegel vorbeikam");
  pruefe("und die Bruecke sagt, warum",
    b.zeilen.some((z) => /NICHT IN MASTER/.test(z)),
    b.zeilen.slice(-3).join(" | "));

  // (2) Der Watcher-Weg - der leiseste.
  const vorher = b.zeilen.length;
  fs.writeFileSync(path.join(quellAbs, "fremd.js"), "// zweiter Anlauf" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("auch der Watcher schiebt die unbekannte Datei nicht",
    !spiel.dateien.has("home:fremd.js"));
  // Seit Runde 7 wird der GANZE Stapel vorab geprueft und als Ganzes
  // abgewiesen - sonst entstuende genau der Mischzustand, gegen den der
  // Schubdeckel gebaut ist. Die Meldung nennt deshalb Zahl und Namen.
  pruefe("  und meldet es erneut, mit Zahl und Namen",
    b.zeilen.slice(vorher).some((z) => /stehen nicht in master/.test(z)
      && /fremd\.js/.test(z)),
    b.zeilen.slice(vorher).slice(-2).join(" | "));

  // (3) Eine Aenderung an der BEKANNTEN Datei muss weiter durchgehen -
  // sonst waere der Riegel eine Vollbremsung statt einer Sperre.
  fs.writeFileSync(path.join(quellAbs, "bekannt.js"), "// zwei" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("eine Aenderung an der bekannten Datei geht durch",
    (spiel.dateien.get("home:bekannt.js") || "").includes("zwei"),
    String(spiel.dateien.get("home:bekannt.js")).trim());

  // (4) Die Freigabeliste - der Weg fuer den Hot-Swap.
  fs.writeFileSync(path.join(ROOT, datenRel, "hotswap-freigabe.txt"),
    "# von tools/hotswap.js" + String.fromCharCode(10)
    + "fremd.js" + String.fromCharCode(10), "utf8");
  await schlaf(300);
  fs.writeFileSync(path.join(quellAbs, "fremd.js"), "// freigegeben" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("mit Freigabe geht dieselbe Datei durch",
    (spiel.dateien.get("home:fremd.js") || "").includes("freigegeben"),
    String(spiel.dateien.get("home:fremd.js")).trim());

  // (5) Und eine verfallene Freigabe gilt nicht.
  const freigabe = path.join(ROOT, datenRel, "hotswap-freigabe.txt");
  fs.writeFileSync(freigabe, "andere.js" + String.fromCharCode(10), "utf8");
  const alt = (Date.now() - 31 * 60000) / 1000;
  fs.utimesSync(freigabe, alt, alt);
  fs.writeFileSync(path.join(quellAbs, "andere.js"), "// verfallen" + String.fromCharCode(10), "utf8");
  const vorher2 = b.zeilen.length;
  await schlaf(2500);
  pruefe("eine 31 Minuten alte Freigabe gilt NICHT",
    !spiel.dateien.has("home:andere.js"),
    "eine liegen gebliebene Freigabe ist ein abgeschalteter Riegel");
  pruefe("  und die Bruecke nennt den Verfall",
    b.zeilen.slice(vorher2).some((z) => /verfallen/i.test(z)),
    b.zeilen.slice(vorher2).slice(-2).join(" | "));

  // (6) DIE SPERRLISTE - eine Datei, die NIE von selbst ins Spiel geht.
  //
  // Der Anlass steht in sync/bridge.js: am 04.09.2026 um 20:06 hat der
  // Watcher `graftplan.json` ins Spiel geschoben, den Zuender fuer einen
  // Graft ueber 450 Milliarden. Zurueckgehalten war sie nur ueber die MENGE
  // des verweigerten Schubs - und als eine Aufraeummassnahme die Menge
  // senkte, fiel sie unter den Deckel und ging hinaus. Eine Datei, die nie
  // von selbst ins Spiel darf, darf nicht an einer Menge haengen.
  //
  // Der Riegel muss gegen den EINZELSCHUB halten (eine Datei, weit unter
  // dem Deckel), sonst prueft die Probe den harmlosen Fall.
  // WICHTIG: `zuender.json` steht nicht in der Master-Liste dieses
  // Pruefstands. Ohne Freigabe wuerde sie schon der Master-Riegel abweisen -
  // und die Probe waere aus dem FALSCHEN Grund gruen. Sie bekommt deshalb
  // eine Freigabe, damit wirklich nur die Sperrliste sie aufhaelt.
  fs.writeFileSync(path.join(ROOT, datenRel, "hotswap-freigabe.txt"),
    "zuender.json" + String.fromCharCode(10), "utf8");
  fs.writeFileSync(path.join(ROOT, datenRel, "nicht-schieben.txt"),
    "# Zuender, nur von Hand" + String.fromCharCode(10)
    + "zuender.json" + String.fromCharCode(10), "utf8");
  await schlaf(300);
  const vorher3 = b.zeilen.length;
  fs.writeFileSync(path.join(quellAbs, "zuender.json"), "{\"scharf\":true}" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("was in nicht-schieben.txt steht, geht NICHT ins Spiel",
    !spiel.dateien.has("home:zuender.json"),
    String(spiel.dateien.get("home:zuender.json") || "(nicht im Spiel - richtig)"));
  pruefe("  und die Bruecke sagt, dass sie es gesehen hat",
    b.zeilen.slice(vorher3).some((z) => /nicht-schieben/i.test(z)),
    b.zeilen.slice(vorher3).slice(-3).join(" | "));
  // KEIN EINGRIFF, KEINE SICHERUNG (22.09.2026). Die Sperrliste griff erst
  // nach Eingriffszaehlung und pre-hotswap-Sicherung: jeder Watcher-Anstoss
  // an graftplan.json buchte "Eingriff push" und setzte die 12-h-Uhr der
  // Stufe B zurueck, obwohl nichts hinausging (bridge.log 22.09., 19:38).
  pruefe("  und bucht dafuer keinen Eingriff",
    !b.zeilen.slice(vorher3).some((z) => /Eingriff push: zuender\.json/.test(z)),
    b.zeilen.slice(vorher3).filter((z) => /Eingriff/.test(z)).join(" | "));
  pruefe("  und zieht keine pre-hotswap-Sicherung",
    !b.zeilen.slice(vorher3).some((z) => /pre-hotswap/.test(z)),
    b.zeilen.slice(vorher3).filter((z) => /pre-hotswap/.test(z)).join(" | "));

  // Und die Gegenprobe: ohne Eintrag geht dieselbe Datei durch. Ohne sie
  // wuerde ein Riegel, der ALLES blockt, als Erfolg durchgehen.
  fs.writeFileSync(path.join(ROOT, datenRel, "hotswap-freigabe.txt"),
    "zuender.json" + String.fromCharCode(10), "utf8");
  fs.writeFileSync(path.join(ROOT, datenRel, "nicht-schieben.txt"),
    "# leer" + String.fromCharCode(10), "utf8");
  await schlaf(300);
  fs.writeFileSync(path.join(quellAbs, "zuender.json"),
    "{\"scharf\":false}" + String.fromCharCode(10), "utf8");
  await schlaf(2500);
  pruefe("  ohne Eintrag geht dieselbe Datei durch",
    String(spiel.dateien.get("home:zuender.json") || "").includes("false"),
    String(spiel.dateien.get("home:zuender.json") || "(fehlt)").trim());

  spiel.schliessen();
  b.proc.kill();
  await b.exit;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Riegel BLIND: keine Liste heisst kein Schreiben (R7, N1) --");
{
  // DER FEHLERZWEIG HATTE KEINE PROBE.
  //
  // Alle fuenf Riegelproben laufen ueber `--master-liste` und treffen damit
  // nur den Gutfall. Was passiert, wenn die Quelle der Liste ausfaellt - git
  // haengt, `.git` ist kaputt, `master` fehlt -, war ungeprueft. Und der
  // erste Anlauf des Negativ-Caches war genau dort falsch: er setzte eine
  // Sperrfrist, die eine Bedingung las, die im Fehlerfall nie wahr ist.
  //
  // Gestellt wird der Fall ueber eine `--master-liste`, die es nicht gibt.
  const rfa = await freierPort();
  const dash = await freierPort();
  const datenRel = frischerDatenordner();
  const quellRel = path.join("pruefstand", "blind-" + process.pid);
  const quellAbs = path.join(ROOT, quellRel);
  fs.rmSync(quellAbs, { recursive: true, force: true });
  fs.mkdirSync(quellAbs, { recursive: true });
  tempOrdner.push(quellAbs);
  fs.writeFileSync(path.join(quellAbs, "egal.js"), "// eins" + String.fromCharCode(10), "utf8");

  const b = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa),
    "--dash-port", String(dash), "--data-dir", datenRel,
    "--src-dir", quellRel,
    "--master-liste", path.join(datenRel, "GIBTESNICHT.txt")]);
  merkeZumAufraeumen(b.proc);
  await warteAufZeile(b.zeilen, /Beobachte src/i, 15000);
  const spiel = starteSpiel(rfa, baueSave({ port: rfa, playtime: ZEIT.master + 3600000 }));
  await warteAufZeile(b.zeilen, /Verifiziert in/i, 25000);
  await schlaf(2500);

  pruefe("ohne lesbare Liste geht NICHTS ins Spiel",
    !spiel.dateien.has("home:egal.js"),
    [...spiel.dateien.keys()].join(", ") + " - im Zweifel geschlossen");
  pruefe("und die Bruecke sagt es laut",
    b.zeilen.some((z) => /nicht lesbar/i.test(z)),
    b.zeilen.slice(-3).join(" | "));
  // Der Negativ-Cache: ohne ihn liefe je Datei ein neuer Versuch. Ein Stapel
  // aus zehn Dateien darf nicht zehn Fehlermeldungen erzeugen.
  const vorher = b.zeilen.filter((z) => /nicht lesbar/i.test(z)).length;
  for (let i = 1; i <= 10; i++) {
    fs.writeFileSync(path.join(quellAbs, "m" + i + ".js"), "// x" + String.fromCharCode(10), "utf8");
  }
  await schlaf(2500);
  const nachher = b.zeilen.filter((z) => /nicht lesbar/i.test(z)).length;
  // ZUR EHRLICHKEIT: was diese Probe misst und was nicht.
  //
  // Gemessen wird die EIGENSCHAFT "ein Stapel erzeugt nicht einen Lesefehler
  // je Datei". Sie wird heute von ZWEI Dingen getragen: der Vorabpruefung des
  // ganzen Stapels (Befund 4) und dem Negativ-Cache (N1). Die Probe kann
  // nicht unterscheiden, welches von beiden greift - sie faellt erst, wenn
  // BEIDE weg sind. Der Negativ-Cache allein ist damit hier nicht angenagelt;
  // seine Wirkung zeigt sich erst, wenn ein Weg ohne Vorabpruefung dazukommt.
  pruefe("ein Stapel aus zehn Dateien erzeugt hoechstens zwei Fehlversuche",
    nachher - vorher <= 2,
    (nachher - vorher) + " Versuche - ohne Vorabpruefung UND ohne "
    + "Negativ-Cache waeren es zehn, jeder mit einem synchronen git-Aufruf "
    + "im Event-Loop");

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
