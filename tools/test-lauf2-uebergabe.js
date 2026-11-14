/**
 * Z1 - die Lauf-2-Uebergabe der Bruecke (14.11.2026).
 *
 * Drei Ebenen, alle ohne echtes Spiel und ohne echte Daten:
 *   A. Der Lader der Identitaet (sync/instanz.js): ohne Datei bitgleich
 *      Lauf 1, kaputte Datei sperrt, gueltige Datei setzt die Epoche.
 *   B. tools/lauf2-uebergabe.js gegen Wegwerfordner (--root mit PROBE.txt):
 *      Trockenlauf aendert nichts, jedes Hindernis haelt an, die Ausfuehrung
 *      archiviert Kette und data/ und schreibt die Identitaet zuletzt;
 *      zweiter Aufruf ist ein No-op, Wiederaufnahme nach Teilabbruch.
 *   C. Die Bruecke (MOCK-Rolle, --identitaet) gegen ein nachgebautes Spiel:
 *      der Lauf-1-Stand wird nach der Uebergabe abgewiesen, das neue Spiel
 *      angenommen, ein Lauf-1-Heartbeat ist kein Anker, der Rueckwaertssprung
 *      greift in der neuen Epoche, und nach einem Brueckenneustart gilt der
 *      Anker der Epoche weiter (5c-skeptiker-kaltstart.md 3a).
 *
 * Bindet nie 12525/8795, startet keine LIVE-Bruecke, liest keine echten
 * Sicherungen. Aufruf: node tools/test-lauf2-uebergabe.js [--ohne-bruecke]
 */

import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ROLLEN,
  IDENTITAET,
  LIVE_IDENTIFIER,
  LIVE1_IDENTIFIER,
  SPERR_IDENTIFIER,
  ladeIdentitaet,
  epochenPraefix,
} from "../sync/instanz.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const TOOL = path.join(ROOT, "tools", "lauf2-uebergabe.js");
const OHNE_BRUECKE = process.argv.includes("--ohne-bruecke");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + was);
  } else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

const tempOrdner = [];
const prozesse = [];
function neuerOrdner(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bb-z1-" + name + "-"));
  tempOrdner.push(d);
  return d;
}
function raeumeAuf() {
  for (const p of prozesse) { try { if (p.exitCode === null) p.kill(); } catch { /* egal */ } }
  for (const d of tempOrdner) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* egal */ } }
}
process.on("exit", raeumeAuf);

/** Synthetischer Spielstand in der Form, die lesenKennwerte erwartet. */
function baueSave({ identifier, playtime, port = 12525, bitNode = 8, sf = { 1: 3, 4: 3 } }) {
  const p = {
    identifier,
    bitNodeN: bitNode,
    sourceFiles: { ctor: "JSONMap", data: Object.entries(sf).map(([n, s]) => [Number(n), s]) },
    skills: { hacking: 100 },
    money: 1e6,
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
  };
  const st = { RemoteFileApiPort: port, AutosaveInterval: 60, ExcludeRunningScriptsFromSave: false, AutoexecScript: "boot.js" };
  const save = { ctor: "BitburnerSaveObject", data: { PlayerSave: JSON.stringify({ ctor: "PlayerObject", data: p }), SettingsSave: JSON.stringify(st), AllServersSave: "{}" } };
  return zlib.gzipSync(Buffer.from(JSON.stringify(save), "utf8"));
}
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const KOPF = "ts\tdatei\tsha256\tidentifier\tbitNode\tlauf\ttotalPlaytime\tanlass\tbytes\tprimaer\tspiegel\n";

/** Fingerabdruck eines Ordnerbaums: Pfad + sha256 jeder Datei. */
function abdruck(dir) {
  const out = [];
  const lauf = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push(path.relative(dir, p) + "/"); lauf(p); } else out.push(path.relative(dir, p) + " " + sha(fs.readFileSync(p)));
    }
  };
  lauf(dir);
  return out.join("\n");
}

function starteWerkzeug(args) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [TOOL, ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    p.stdout.on("data", (d) => { text += d; });
    p.stderr.on("data", (d) => { text += d; });
    p.on("exit", (code) => res({ code, text }));
    p.on("error", (e) => res({ code: -1, text: "STARTFEHLER " + e.message }));
  });
}

/**
 * Eine Lauf-1-Probeumgebung: Kette in Primaer und Spiegel (Dateien + Index
 * mit sha256), data/ mit Heartbeat und einer Abweisungszeile der Bruecke.
 */
const L1 = LIVE1_IDENTIFIER;
const NEU = "abc123def456";
function baueProbe(name, opt = {}) {
  const r = neuerOrdner(name);
  fs.writeFileSync(path.join(r, "PROBE.txt"), "Wegwerfordner fuer test-lauf2-uebergabe.js\n");
  const orte = [path.join(r, "backups-primaer"), path.join(r, "backups-spiegel")];
  for (const o of orte) {
    fs.mkdirSync(o, { recursive: true });
    fs.writeFileSync(path.join(o, "INDEX.tsv"), KOPF);
  }
  const anzahl = opt.anzahl ?? 5;
  for (let i = 0; i < anzahl; i++) {
    const playtime = 7_000_000_000 + i * 3_600_000;
    const roh = baueSave({ identifier: L1, playtime });
    const datei = "LIVE_" + L1 + "_BN8L3_2026-11-1" + i + "T00-23_" + (i === anzahl - 1 ? "pre-jump" : "hourly") + ".json.gz";
    for (const o of orte) {
      fs.writeFileSync(path.join(o, datei), roh);
      fs.appendFileSync(path.join(o, "INDEX.tsv"), ["2026-11-1" + i + "T00:00:00Z", datei, sha(roh), L1, 8, 3, playtime,
        i === anzahl - 1 ? "pre-jump" : "hourly", roh.length, "", ""].join("\t") + "\n");
    }
  }
  // Eine Indexzeile, deren Datei schon weggerottet ist (Normalfall im Betrieb).
  for (const o of orte) {
    fs.appendFileSync(path.join(o, "INDEX.tsv"), ["2026-09-01T00:00:00Z", "LIVE_" + L1 + "_BN10L2_2026-09-01T00-00_hourly.json.gz",
      "00", L1, 10, 2, 1_000_000_000, "hourly", 1, "", ""].join("\t") + "\n");
  }
  fs.writeFileSync(path.join(orte[0], "MANUELL_vor-Edit.json.gz"), "fremd");
  if (opt.shaKaputt) {
    // Die juengste Datei wird nach dem Indexeintrag veraendert.
    const neueste = fs.readdirSync(orte[0]).filter((f) => f.includes("pre-jump"))[0];
    fs.writeFileSync(path.join(orte[0], neueste), baueSave({ identifier: L1, playtime: 1 }));
  }
  const data = path.join(r, "data");
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, "bridge-heartbeat.json"), JSON.stringify({ totalPlaytime: 7_100_000_000 }));
  fs.writeFileSync(path.join(data, "ausgang.json"), "{}");
  // Die Sperrliste der Bruecke (getrackte Konfiguration, Skeptiker 14.11.2026).
  fs.writeFileSync(path.join(data, "nicht-schieben.txt"), "# Sperrliste\ngraftplan.json\n");
  if (opt.sichtung !== false) {
    fs.writeFileSync(path.join(data, "bridge.log"),
      "2026-11-20T10:00:00.000Z\tinfo\tirgendwas\n"
      + "2026-11-20T10:05:00.000Z\terror\tALARM Socket abgewiesen: totalPlaytime 300000 liegt mehr als 60 s hinter dem zuletzt bekannten Wert 7100000000 (Heartbeat) - aeltere Kopie oder Import | identifier "
      + NEU + " statt " + L1 + " | Spielstand BN" + (opt.abgewiesenBn ?? 1) + " Lauf 1, 0 SF, Spielzeit 300000 ms\n");
  }
  return { r, orte, data };
}

console.log("");
console.log("=== Z1: Lauf-2-Uebergabe ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- A. Der Lader: ohne Datei bitgleich Lauf 1 --");
{
  // Dieser Baum: im Bau-Branch gibt es KEINE Identitaetsdatei (sie entsteht
  // nur per Werkzeug in der Live-Arbeitskopie). Nach der echten Uebergabe
  // liegt sie dort - dann wird sie nur auf Gueltigkeit geprueft, nicht rot.
  if (IDENTITAET.aktiv) {
    console.log("  HINWEIS  Identitaetsdatei aktiv: Epoche " + IDENTITAET.epoche + ", identifier "
      + IDENTITAET.identifier + " (" + IDENTITAET.datei + ")");
    pruefe("vorhandene Identitaetsdatei ist gueltig", !IDENTITAET.fehler, IDENTITAET.fehler);
    pruefe("ROLLEN.LIVE folgt ihr", ROLLEN.LIVE.identifier === LIVE_IDENTIFIER
      && LIVE_IDENTIFIER === (IDENTITAET.fehler ? SPERR_IDENTIFIER : IDENTITAET.identifier));
  } else {
    pruefe("ohne sync/identitaet.json: Vorgabe, keine Epoche aktiv",
      IDENTITAET.quelle === "vorgabe" && IDENTITAET.fehler === null, JSON.stringify(IDENTITAET));
    pruefe("LIVE_IDENTIFIER ist unveraendert 197f4d61481686", LIVE_IDENTIFIER === "197f4d61481686");
    pruefe("ROLLEN.LIVE unveraendert (identifier, Praefix, Ports)",
      ROLLEN.LIVE.identifier === "197f4d61481686" && ROLLEN.LIVE.prefix === "LIVE_"
      && ROLLEN.LIVE.rfaPort === 12525 && ROLLEN.LIVE.dashPort === 8795);
    pruefe("Epochenpraefix ohne Datei === Rollenpraefix (Rotation/Anker wie vorher)",
      epochenPraefix("LIVE_", IDENTITAET) === "LIVE_");
  }
  pruefe("TEST/MOCK weiter ohne identifier", ROLLEN.TEST.identifier === null && ROLLEN.MOCK.identifier === null);

  const d = neuerOrdner("lader");
  const f = (name, inhalt) => { const p = path.join(d, name); fs.writeFileSync(p, inhalt); return p; };
  const fehlt = ladeIdentitaet(path.join(d, "gibtsnicht.json"));
  pruefe("fehlende Datei -> Lauf 1, 197f4d61481686", !fehlt.aktiv && fehlt.identifier === L1 && fehlt.epoche === "lauf1");
  const fehltOhne = ladeIdentitaet(path.join(d, "gibtsnicht.json"), null);
  pruefe("fehlende Datei ohne Vorgabe (Pruefstand) -> kein identifier", fehltOhne.identifier === null && !fehltOhne.aktiv);

  const gut = ladeIdentitaet(f("gut.json", JSON.stringify({ epoche: "lauf2", identifier: NEU, anker: { totalPlaytime: 300000 } })));
  pruefe("gueltige Datei -> Epoche lauf2, identifier, Anker",
    gut.aktiv && !gut.fehler && gut.epoche === "lauf2" && gut.identifier === NEU && gut.anker === 300000, JSON.stringify(gut));
  pruefe("Epochenpraefix mit Datei = LIVE_<id>_", epochenPraefix("LIVE_", gut) === "LIVE_" + NEU + "_");
  const ohneAnker = ladeIdentitaet(f("ohneanker.json", JSON.stringify({ epoche: "lauf2", identifier: NEU })));
  pruefe("Anker ist optional", ohneAnker.aktiv && !ohneAnker.fehler && ohneAnker.anker === null);

  for (const [name, inhalt] of [
    ["kein JSON", "{epoche: lauf2"],
    ["leere Datei", ""],
    ["Array", "[]"],
    ["identifier fehlt", JSON.stringify({ epoche: "lauf2" })],
    ["identifier gross", JSON.stringify({ epoche: "lauf2", identifier: "ABC123" })],
    ["identifier zu lang", JSON.stringify({ epoche: "lauf2", identifier: "0123456789abcdef" })],
    ["epoche falsch", JSON.stringify({ epoche: "zwei", identifier: NEU })],
    ["epoche lauf0", JSON.stringify({ epoche: "lauf0", identifier: NEU })],
    ["anker negativ", JSON.stringify({ epoche: "lauf2", identifier: NEU, anker: { totalPlaytime: -1 } })],
    ["anker Text", JSON.stringify({ epoche: "lauf2", identifier: NEU, anker: { totalPlaytime: "5" } })],
  ]) {
    const k = ladeIdentitaet(f("k.json", inhalt));
    pruefe("kaputt (" + name + ") -> GESPERRT, nicht Lauf 1",
      !!k.fehler && k.identifier === SPERR_IDENTIFIER && k.identifier !== L1, JSON.stringify(k));
    pruefe("  und der Epochenpraefix faellt nicht auf eine Epoche", epochenPraefix("LIVE_", k) === "LIVE_");
  }
  pruefe("Sperr-identifier ist kein moeglicher cyrb53-Wert", !/^[0-9a-f]{1,14}$/.test(SPERR_IDENTIFIER));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- B. Das Werkzeug: Trockenlauf und Hindernisse --");
{
  const { r, orte, data } = baueProbe("trocken");
  const vorher = abdruck(r);

  let e = await starteWerkzeug(["--root", r]);
  pruefe("ohne --pin: abgelehnt (Exit 2)", e.code === 2 && /--pin <identifier> fehlt/.test(e.text), e.code + " " + e.text.slice(-300));

  e = await starteWerkzeug(["--root", r, "--pin", NEU]);
  pruefe("Trockenlauf mit gesehenem identifier: Exit 0", e.code === 0, e.code + " " + e.text.slice(-500));
  pruefe("  zeigt den Plan (Kette, data/, Identitaet)",
    /Kette archivieren/.test(e.text) && /Datenordner/.test(e.text) && /Identitaet schreiben/.test(e.text));
  pruefe("  nennt die Sichtung mit Spielzeit", /Gesehen: 2026-11-20T10:05/.test(e.text) && /5\.0 min/.test(e.text));
  pruefe("  Startanker = Spielzeit der Abweisung", /Startanker 300000 ms/.test(e.text));
  pruefe("  zeigt BN/Lauf/SF des abgewiesenen Spiels und bestaetigt: frisches Spiel",
    /Abgewiesenes Spiel: BN1, Lauf 1, 0 SF - passt zu einem frischen Spiel/.test(e.text), e.text.slice(-400));
  pruefe("  plant das Zurueckkopieren der Sperrliste", /nicht-schieben\.txt/.test(e.text) && /Konfiguration zurueck/.test(e.text));
  pruefe("  und veraendert NICHTS", abdruck(r) === vorher);

  {
    const fremd = baueProbe("fremd", { abgewiesenBn: 8 });
    const ef = await starteWerkzeug(["--root", fremd.r, "--pin", NEU]);
    pruefe("abgewiesenes Spiel BN8: Hinweis 'KEIN frisches Spiel'", /KEIN frisches Spiel/.test(ef.text), ef.text.slice(-300));
  }
  e = await starteWerkzeug(["--root", r, "--pin", "ABC123"]);
  pruefe("--pin kein cyrb53-Hex: Exit 2", e.code === 2 && /kein cyrb53/.test(e.text));
  e = await starteWerkzeug(["--root", r, "--pin", "fedcba98"]);
  pruefe("--pin nie abgewiesen gesehen: Exit 2 (Tippfehler-Schutz)", e.code === 2 && /nicht im Brueckenprotokoll/.test(e.text));
  e = await starteWerkzeug(["--root", r, "--pin", "fedcba98", "--ohne-sichtung"]);
  pruefe("  mit --ohne-sichtung: Trockenlauf gruen, Startanker 0", e.code === 0 && /Startanker 0 ms/.test(e.text), e.text.slice(-300));
  // Die Abweisung stammt von einer Bruecke mit ANDERER Identitaet (falsche
  // Epoche, fremder Datenordner): nicht uebernehmen.
  fs.appendFileSync(path.join(data, "bridge.log"),
    "2026-11-20T11:00:00.000Z\terror\tALARM Socket abgewiesen: identifier 0badc0de statt 1234abcd\n");
  e = await starteWerkzeug(["--root", r, "--pin", "0badc0de"]);
  pruefe("Abweisung nennt einen anderen erwarteten identifier: Exit 2", e.code === 2 && /die Abweisung nennt/.test(e.text),
    e.text.slice(-300));
  fs.writeFileSync(path.join(data, "bridge.log"), fs.readFileSync(path.join(data, "bridge.log"), "utf8")
    .split("\n").filter((z) => !z.includes("0badc0de")).join("\n"));
  e = await starteWerkzeug(["--root", r, "--pin", L1, "--ohne-sichtung"]);
  pruefe("--pin = laufender identifier: Exit 2", e.code === 2 && /laufende identifier/.test(e.text));
  e = await starteWerkzeug(["--root", r, "--pin", NEU, "--epoche", "lauf1"]);
  pruefe("--epoche = laufende Epoche: Exit 2", e.code === 2);

  // Bruecke laeuft: lebende PID in data/bridge.pid
  fs.writeFileSync(path.join(data, "bridge.pid"), JSON.stringify({ pid: process.pid, seit: "jetzt" }));
  e = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren"]);
  pruefe("lebende Bruecken-PID: Exit 2, nichts veraendert",
    e.code === 2 && /Bruecke laeuft/.test(e.text), e.text.slice(-300));
  fs.rmSync(path.join(data, "bridge.pid"));
  // Bruecke laeuft: Port belegt
  const srv = net.createServer(() => {});
  await new Promise((res) => srv.listen(0, "127.0.0.1", res));
  const port = srv.address().port;
  e = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren", "--pruef-ports", String(port)]);
  pruefe("belegter Brueckenport: Exit 2", e.code === 2 && /Port \d+ ist belegt/.test(e.text), e.text.slice(-300));
  await new Promise((res) => srv.close(res));
  pruefe("  nach allen Ablehnungen ist der Baum unveraendert", abdruck(r) === vorher);

  e = await starteWerkzeug(["--root", ROOT, "--pin", NEU]);
  pruefe("--root auf dem Projektbaum: Aufruffehler", e.code === 1 && /Wegwerfordner/.test(e.text));
  e = await starteWerkzeug(["--root", path.join(ROOT, "pruefstand"), "--pin", NEU]);
  pruefe("--root im Projektbaum: Aufruffehler", e.code === 1);
  // Nach dem Merge laeuft der Test auch im LIVE-Baum selbst (14.11.2026). Dort
  // ist der Aufruf zulaessig und scheitert erst an der laufenden Bruecke bzw.
  // am nie gesehenen identifier - beides Exit 2, nichts veraendert.
  const imLiveBaum = path.resolve(ROOT).toLowerCase()
    === path.resolve("C:/Users/erche/Desktop/claude_projecto/bitburner").toLowerCase();
  e = await starteWerkzeug(["--pin", NEU]);
  if (imLiveBaum) {
    pruefe("LIVE aus dem LIVE-Baum, Trockenlauf: Exit 2 (Bruecke laeuft oder identifier nie gesehen)",
      e.code === 2, e.text.slice(-300));
  } else {
    pruefe("LIVE aus dem Worktree: Exit 2, sofort (kein Portanklopfen, keine Kette gelesen)",
      e.code === 2 && /nur in/.test(e.text) && !/Kette /.test(e.text), e.text.slice(-300));
  }
  void orte;
}
{
  const { r } = baueProbe("shakaputt", { shaKaputt: true });
  const vorher = abdruck(r);
  const e = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren"]);
  pruefe("juengste Sicherung passt nicht zum Index: Exit 2, nichts veraendert",
    e.code === 2 && /sha256 passt nicht/.test(e.text) && abdruck(r) === vorher, e.text.slice(-400));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- B. Das Werkzeug: Ausfuehrung --");
{
  const { r, orte, data } = baueProbe("aus");
  const vorPrimaer = fs.readdirSync(orte[0]).filter((f) => f.startsWith("LIVE_")).sort();
  const vorData = fs.readdirSync(data).sort();
  const e = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren"]);
  pruefe("--ausfuehren: Exit 0", e.code === 0, e.code + " " + e.text.slice(-600));
  for (const o of orte) {
    const oben = fs.readdirSync(o);
    pruefe("  " + path.basename(o) + ": oben keine LIVE_-Datei und kein INDEX mehr",
      !oben.some((f) => f.startsWith("LIVE_")) && !oben.includes("INDEX.tsv"), oben.join(","));
    const archiv = path.join(o, "lauf1");
    const drin = fs.existsSync(archiv) ? fs.readdirSync(archiv) : [];
    pruefe("  " + path.basename(o) + ": lauf1/ hat alle Dateien, INDEX und ARCHIV.json",
      vorPrimaer.every((f) => drin.includes(f)) && drin.includes("INDEX.tsv") && drin.includes("ARCHIV.json"), drin.join(","));
    for (const f of vorPrimaer) {
      const zeile = fs.readFileSync(path.join(archiv, "INDEX.tsv"), "utf8").split("\n").find((z) => z.split("\t")[1] === f);
      if (!zeile || sha(fs.readFileSync(path.join(archiv, f))) !== zeile.split("\t")[2]) {
        pruefe("  " + f + " im Archiv mit passender sha256", false);
      }
    }
  }
  pruefe("  fremde Datei (MANUELL_) bleibt, wo sie war", fs.existsSync(path.join(orte[0], "MANUELL_vor-Edit.json.gz")));
  const dataJetzt = fs.readdirSync(data).sort();
  pruefe("  data/ enthaelt nur noch lauf1/, die Sperrliste (Konfiguration) und die Uebergabespur",
    dataJetzt.join(",") === ["lauf1", "nicht-schieben.txt", "uebergabe-lauf2.json"].join(","), dataJetzt.join(","));
  pruefe("  nicht-schieben.txt im NEUEN data/ ist die Sperrliste (graftplan.json bleibt gesperrt), das Archiv hat das Original",
    fs.readFileSync(path.join(data, "nicht-schieben.txt"), "utf8").includes("graftplan.json")
    && fs.existsSync(path.join(data, "lauf1", "nicht-schieben.txt")));
  pruefe("  data/lauf1/ hat den alten Inhalt (Heartbeat, Protokoll)",
    fs.readdirSync(path.join(data, "lauf1")).sort().join(",") === vorData.join(","));
  const id = ladeIdentitaet(path.join(r, "sync", "identitaet.json"));
  pruefe("  Identitaet: Epoche lauf2, gepinnter identifier, Startanker aus der Abweisung",
    id.aktiv && !id.fehler && id.epoche === "lauf2" && id.identifier === NEU && id.anker === 300000, JSON.stringify(id));
  const roh = JSON.parse(fs.readFileSync(path.join(r, "sync", "identitaet.json"), "utf8"));
  pruefe("  Vorgaenger lauf1 mit Archivorten und letztem Stand",
    roh.vorgaenger.length === 1 && roh.vorgaenger[0].epoche === "lauf1" && roh.vorgaenger[0].identifier === L1
    && roh.vorgaenger[0].sicherungsArchiv.length === 2 && roh.vorgaenger[0].letzterStand.bitNode === 8);
  pruefe("  keine tmp-Reste neben der Identitaet",
    fs.readdirSync(path.join(r, "sync")).join(",") === "identitaet.json");

  const nachher = abdruck(r);
  const e2 = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren"]);
  pruefe("zweiter Aufruf mit demselben identifier: Exit 0, nichts zu tun, nichts veraendert",
    e2.code === 0 && /nichts zu tun/.test(e2.text) && abdruck(r) === nachher, e2.text.slice(-300));

  // Lauf 3: dieselbe Mechanik von lauf2 aus (allgemein, nicht nur einmal).
  const NEU3 = "77aa00bb11";
  fs.writeFileSync(path.join(data, "bridge.log"), "2026-12-01T00:00:00Z\terror\tALARM Socket abgewiesen: identifier "
    + NEU3 + " statt " + NEU + "\n");
  for (const o of orte) {
    const roh3 = baueSave({ identifier: NEU, playtime: 9_000_000 });
    const datei = "LIVE_" + NEU + "_BN1L1_2026-11-21T00-00_connect.json.gz";
    fs.writeFileSync(path.join(o, datei), roh3);
    fs.writeFileSync(path.join(o, "INDEX.tsv"), KOPF + ["2026-11-21T00:00:00Z", datei, sha(roh3), NEU, 1, 1, 9_000_000, "connect", roh3.length, "", ""].join("\t") + "\n");
  }
  const e3 = await starteWerkzeug(["--root", r, "--pin", NEU3, "--ausfuehren"]);
  const id3 = ladeIdentitaet(path.join(r, "sync", "identitaet.json"));
  const roh3 = JSON.parse(fs.readFileSync(path.join(r, "sync", "identitaet.json"), "utf8"));
  pruefe("lauf2 -> lauf3: Exit 0, Epoche lauf3, beide Vorgaenger, Archiv lauf2/",
    e3.code === 0 && id3.epoche === "lauf3" && id3.identifier === NEU3 && roh3.vorgaenger.length === 2
    && fs.existsSync(path.join(orte[0], "lauf2", "INDEX.tsv")) && fs.existsSync(path.join(orte[0], "lauf1", "INDEX.tsv"))
    && fs.existsSync(path.join(data, "lauf2", "lauf1")), e3.text.slice(-400));
}
{
  // WIEDERAUFNAHME: Primaer schon archiviert, Spiegel und data/ noch nicht.
  const { r, orte, data } = baueProbe("wieder");
  const archiv = path.join(orte[0], "lauf1");
  fs.mkdirSync(archiv);
  for (const f of fs.readdirSync(orte[0]).filter((x) => x.startsWith("LIVE_") || x === "INDEX.tsv")) {
    fs.renameSync(path.join(orte[0], f), path.join(archiv, f));
  }
  const e = await starteWerkzeug(["--root", r, "--pin", NEU, "--ausfuehren"]);
  const id = ladeIdentitaet(path.join(r, "sync", "identitaet.json"));
  pruefe("Wiederaufnahme nach Teilabbruch: Exit 0, Spiegel und data/ nachgezogen, Identitaet geschrieben",
    e.code === 0 && /schon archiviert/.test(e.text) && fs.existsSync(path.join(orte[1], "lauf1", "INDEX.tsv"))
    && fs.existsSync(path.join(data, "lauf1", "bridge.log")) && id.identifier === NEU, e.text.slice(-500));
}

// ---------------------------------------------------------------------------
if (OHNE_BRUECKE) {
  console.log("");
  console.log("-- C. Bruecke uebersprungen (--ohne-bruecke) --");
} else {
  console.log("");
  console.log("-- C. Die Bruecke in der neuen Epoche (MOCK, --identitaet) --");
  const { WebSocket } = await import("ws");

  const freierPort = () => new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
  });
  const starteBruecke = (args) => {
    const proc = spawn(process.execPath, [path.join(ROOT, "sync", "bridge.js"), ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    prozesse.push(proc);
    const zeilen = [];
    const sammle = (d) => { for (const z of String(d).split("\n")) if (z.trim()) zeilen.push(z.trim()); };
    proc.stdout.on("data", sammle);
    proc.stderr.on("data", sammle);
    const exit = new Promise((res) => { proc.on("exit", (c) => res(c)); proc.on("error", () => res(-1)); });
    return { proc, zeilen, exit };
  };
  const zaehle = (b, re) => b.zeilen.filter((z) => re.test(z)).length;
  async function warteAufMehr(b, re, vorher, msMax = 30000) {
    const bis = Date.now() + msMax;
    while (Date.now() < bis) { if (zaehle(b, re) > vorher) return true; await schlaf(100); }
    return false;
  }
  function starteSpiel(rfaPort, saveBuf) {
    const ws = new WebSocket("ws://127.0.0.1:" + rfaPort);
    const gesehen = [];
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      gesehen.push(m.method);
      const antwort = (result) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
      if (m.method === "getSaveFile") return antwort({ save: saveBuf.toString("latin1"), binary: true, identifier: "x" });
      if (m.method === "getFileMetadata") return antwort({ filename: m.params.filename, ramUsage: 1 });
      if (m.method === "getAllFiles" || m.method === "getFileNames") return antwort([]);
      if (m.method === "getFile") return ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: "not found" }));
      if (m.method === "getDefinitionFile") return antwort("");
      return antwort("OK");
    });
    ws.on("error", () => {});
    return { ws, gesehen, schliessen: () => { try { ws.close(); } catch { /* egal */ } } };
  }
  async function trenne(b, spiel) {
    const vor = zaehle(b, /getrennt/i);
    spiel.schliessen();
    return warteAufMehr(b, /getrennt/i, vor, 20000);
  }

  // Je Lauf eigener identifier: die MOCK-Ablage ist geteilt, der
  // Epochenpraefix MOCK_<id>_ trennt diesen Lauf von allen frueheren.
  const L2 = (Date.now().toString(16) + process.pid.toString(16)).slice(-14);
  const MIN = 60000;
  const tmp = neuerOrdner("bruecke");
  const idDatei = path.join(tmp, "identitaet.json");
  fs.writeFileSync(idDatei, JSON.stringify({ format: 1, epoche: "lauf2", identifier: L2, anker: { totalPlaytime: 4 * MIN } }));
  // Hermetisch: eigener Quellordner mit EINER Datei und eigener Master-Liste.
  const srcDir = path.join(tmp, "src");
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, "probe.js"), "export async function main(ns) {}\n");
  const liste = path.join(tmp, "master.txt");
  fs.writeFileSync(liste, "probe.js\n");
  const dataRel = path.join("pruefstand", "t-z1-" + process.pid);
  const dataAbs = path.join(ROOT, dataRel);
  fs.mkdirSync(dataAbs, { recursive: true });
  tempOrdner.push(dataAbs);
  // Ein LAUF-1-HEARTBEAT liegt noch im Datenordner (von Hand zurueckkopiert,
  // halbe Uebergabe). In der Epoche darf er kein Anker sein.
  fs.writeFileSync(path.join(dataAbs, "bridge-heartbeat.json"), JSON.stringify({ totalPlaytime: 2000 * 3600000 }));
  const mockAblage = path.join(ROOT, "pruefstand", "mock-backups");

  const rfa = await freierPort();
  const dash = await freierPort();
  const args = ["--instance", "MOCK", "--rfa-port", String(rfa), "--dash-port", String(dash), "--no-watch",
    "--data-dir", dataRel, "--src-dir", srcDir, "--master-liste", liste, "--identitaet", idDatei];
  let b = starteBruecke(args);
  await warteAufMehr(b, /Identitaet: Epoche lauf2/, 0, 15000);
  pruefe("die Bruecke nennt Epoche und identifier im Protokoll", zaehle(b, new RegExp("Identitaet: Epoche lauf2, identifier " + L2)) === 1,
    b.zeilen.slice(-3).join(" | "));

  // 1. Der Lauf-1-Stand (alter identifier, 2.000+ h) kommt nach der Uebergabe nicht durch.
  let vorAbw = zaehle(b, /Socket abgewiesen/);
  let s = starteSpiel(rfa, baueSave({ identifier: L1, playtime: 2100 * 3600000, port: rfa }));
  pruefe("Lauf-1-Stand nach der Uebergabe abgewiesen", await warteAufMehr(b, /Socket abgewiesen/, vorAbw),
    b.zeilen.slice(-2).join(" | "));
  pruefe("  Grund: identifier " + L1 + " statt " + L2, b.zeilen.some((z) => z.includes("identifier " + L1 + " statt " + L2)));
  await schlaf(800);
  pruefe("  und nichts geschrieben", !s.gesehen.includes("pushFile"), s.gesehen.join(","));
  await trenne(b, s);

  // 2. Das neue Spiel (5 min) wird angenommen - trotz Lauf-1-Heartbeat.
  let vorVer = zaehle(b, /Verifiziert in/);
  s = starteSpiel(rfa, baueSave({ identifier: L2, playtime: 5 * MIN, port: rfa, bitNode: 1, sf: {} }));
  pruefe("neues Spiel angenommen (Lauf-1-Heartbeat ist kein Anker der Epoche)", await warteAufMehr(b, /Verifiziert in/, vorVer),
    b.zeilen.slice(-3).join(" | "));
  pruefe("  Sicherung unter MOCK_<neu>_ entstanden", await warteAufMehr(b, /Sicherung connect gruen: MOCK_/, 0, 15000)
    && fs.readdirSync(mockAblage).some((f) => f.startsWith("MOCK_" + L2 + "_")));
  await warteAufMehr(b, /ins Spiel uebertragen|pushAll/i, 0, 15000);
  pruefe("  und geschoben", s.gesehen.includes("pushFile"), s.gesehen.join(","));
  await schlaf(500);
  await trenne(b, s);

  // 3. Rueckwaertssprung in der neuen Epoche: eine aeltere Kopie (2 min).
  vorAbw = zaehle(b, /Socket abgewiesen/);
  s = starteSpiel(rfa, baueSave({ identifier: L2, playtime: 2 * MIN, port: rfa, bitNode: 1, sf: {} }));
  pruefe("Rueckwaertssprung im neuen Spiel abgewiesen (Riegel bleibt)", await warteAufMehr(b, /Socket abgewiesen/, vorAbw)
    && b.zeilen.some((z) => /hinter dem zuletzt/.test(z)), b.zeilen.slice(-2).join(" | "));
  await trenne(b, s);

  // Der Heartbeat traegt die Epoche.
  await schlaf(500);
  b.proc.kill();
  await b.exit;
  const hb = JSON.parse(fs.readFileSync(path.join(dataAbs, "bridge-heartbeat.json"), "utf8"));
  pruefe("Heartbeat nennt die Epoche und den neuen Anker",
    hb.epoche && hb.epoche.identifier === L2 && hb.totalPlaytime === 5 * MIN, JSON.stringify(hb).slice(0, 200));

  // 4. Brueckenneustart: der Anker der Epoche gilt weiter.
  b = starteBruecke(args);
  await warteAufMehr(b, /Anker uebernommen/, 0, 15000);
  pruefe("nach dem Neustart: Anker aus dem Epochen-Heartbeat uebernommen", zaehle(b, /Anker uebernommen/) === 1);
  vorAbw = zaehle(b, /Socket abgewiesen/);
  s = starteSpiel(rfa, baueSave({ identifier: L2, playtime: 2 * MIN, port: rfa, bitNode: 1, sf: {} }));
  pruefe("  aeltere Kopie wird auch nach dem Neustart abgewiesen", await warteAufMehr(b, /Socket abgewiesen/, vorAbw));
  await trenne(b, s);
  vorVer = zaehle(b, /Verifiziert in/);
  s = starteSpiel(rfa, baueSave({ identifier: L2, playtime: 6 * MIN, port: rfa, bitNode: 1, sf: {} }));
  pruefe("  das laufende neue Spiel wird nach dem Neustart angenommen", await warteAufMehr(b, /Verifiziert in/, vorVer),
    b.zeilen.slice(-3).join(" | "));
  await schlaf(500);
  s.schliessen();
  b.proc.kill();
  await b.exit;

  // 5. Kaputte / fehlende Identitaetsdatei: Abbruch vor dem Binden.
  const kaputt = path.join(tmp, "kaputt.json");
  fs.writeFileSync(kaputt, "{nicht json");
  const rfa2 = await freierPort();
  const dash2 = await freierPort();
  for (const [name, datei] of [["kaputte", kaputt], ["fehlende", path.join(tmp, "gibtsnicht.json")]]) {
    const bk = starteBruecke(["--instance", "MOCK", "--rfa-port", String(rfa2), "--dash-port", String(dash2), "--no-watch",
      "--data-dir", dataRel, "--src-dir", srcDir, "--master-liste", liste, "--identitaet", datei]);
    const code = await Promise.race([bk.exit, schlaf(15000).then(() => "haengt")]);
    pruefe(name + " Identitaetsdatei: Bruecke bricht ab (Exit 3)", code === 3, code + " " + bk.zeilen.slice(-2).join(" | "));
  }

  // Eigene Sicherungen dieses Laufs wegraeumen (Indexzeilen bleiben - sie
  // tragen den Laufpraefix und Spielzeiten von Minuten, heben also keinen
  // Anker der normalen MOCK-Proben).
  for (const f of fs.readdirSync(mockAblage).filter((x) => x.startsWith("MOCK_" + L2 + "_"))) {
    try { fs.rmSync(path.join(mockAblage, f)); } catch { /* egal */ }
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
raeumeAuf();
process.exit(rot ? 1 : 0);
