/**
 * Der Live-Eingriff - und die Checkliste, die ihn erlaubt oder verweigert.
 *
 * ===========================================================================
 * WOZU EIN WERKZEUG UND NICHT EINE ANLEITUNG
 * ===========================================================================
 *
 * Auftrag 9 nennt acht Punkte, die vor jedem Eingriff ins laufende Spiel
 * abzuarbeiten sind. Eine Checkliste auf Papier hat einen bekannten
 * Fehlermodus: **ein unbestimmter Punkt wird uebersprungen oder behauptet.**
 * Der Auftrag sagt genau das, in dieser Formulierung, an zwei Stellen.
 *
 * Deshalb prueft dieses Werkzeug, was pruefbar ist, und VERWEIGERT, statt zu
 * warnen. Was es nicht selbst pruefen kann (der Kanarienvogel auf der
 * TEST-Instanz), verlangt es als ausdrueckliche Angabe mit Zahlen - eine
 * Behauptung, die man tippen muss, ist immer noch besser als eine, die man
 * stillschweigend auslaesst.
 *
 * ===========================================================================
 * WAS ES TUT
 * ===========================================================================
 *
 * Es schreibt NICHTS ins Spiel. Der Weg dorthin ist die Bruecke: sie beobachtet
 * `src/` und schiebt geaenderte Dateien 400 ms spaeter nach. Dieses Werkzeug
 *
 *   1. prueft die Checkliste,
 *   2. wartet auf die Bestaetigung im Bruecken-Protokoll,
 *   3. loest den Neustart der betroffenen Werkzeuge aus (`data/reload.txt`),
 *   4. und prueft, ob die neue Fassung binnen zweier Takte in der Telemetrie
 *      steht.
 *
 * Ein Swap, dessen neue `version` nicht auftaucht, ist NICHT eingespielt -
 * ein laufendes Skript behaelt seinen alten Code, und das sieht von aussen
 * genauso aus wie Erfolg.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/hotswap.js --pruefen                 nur die Checkliste
 *   node tools/hotswap.js <datei> [<datei> ...]     Checkliste und Swap
 *   node tools/hotswap.js <datei> --test            gegen die TEST-Instanz
 *
 * Weitere Angabe, die die Checkliste verlangt:
 *   --kanarienvogel "<Klonzeit>|<Minuten>|<neue penalties>|<errStreak>"
 *
 * Es gibt KEINEN Schalter, der die Liste uebergeht. Das ist Absicht: ein
 * "--ich-weiss-was-ich-tue" waere nach der zweiten Benutzung der Normalfall.
 *
 * ===========================================================================
 * WAS ES AUSDRUECKLICH NICHT TUT
 * ===========================================================================
 *
 * Es fasst den Spielstand nicht an. Kein `deleteFile` auf der Schonliste, kein
 * Import, kein Reset, kein Schreiben in IndexedDB. Der Rollback ist ein
 * `git checkout <hash> -- <datei>` und steht in der Ausgabe, nicht in diesem
 * Code - ein Werkzeug, das selbst zurueckrollt, rollt irgendwann zurueck, wenn
 * es das nicht soll.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const NUR_PRUEFEN = argv.includes("--pruefen");
const TEST = argv.includes("--test");
const dateien = argv.filter((a) => !a.startsWith("--"));

const flagWert = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const ROLLE = TEST ? "TEST" : "LIVE";
const BASE = TEST ? "http://localhost:8796" : "http://localhost:8795";

// Der Identifier des Live-Spielstands. Er steht im Auftrag (9, Punkt 2) und
// ist die einzige Zahl, an der sich der richtige Spielstand erkennen laesst -
// Knoten und Lauf aendern sich, der Identifier nicht.
const LIVE_IDENTIFIER = "197f4d61481686";

const befunde = [];
let rot = 0;

function punkt(nr, name, ok, text) {
  const marke = ok ? "  ok  " : "  ROT ";
  if (!ok) rot++;
  befunde.push({ nr, name, ok, text });
  console.log(marke + " (" + nr + ") " + name + (text ? " - " + text : ""));
}

async function hole(pfad) {
  const res = await fetch(BASE + pfad);
  return await res.json();
}

/** Eine Datei AUS DEM SPIEL lesen. `getFile` ist lesend und braucht nichts. */
async function spielDatei(name) {
  try {
    const b = await hole("/api/rpc?method=getFile&filename="
      + encodeURIComponent(name) + "&server=home");
    if (b.error) return { fehlt: true, grund: b.error };
    const inhalt = b.result && (b.result.content ?? b.result);
    if (typeof inhalt !== "string" || !inhalt.length) return { fehlt: true };
    return { fehlt: false, text: inhalt };
  } catch (e) {
    return { fehlt: true, grund: e.message };
  }
}

async function spielJson(name) {
  const d = await spielDatei(name);
  if (d.fehlt) return d;
  try { return { fehlt: false, wert: JSON.parse(d.text) }; }
  catch { return { fehlt: true, grund: "kein gueltiges JSON" }; }
}

console.log("");
console.log("=== Live-Einspielung nach Auftrag 9 ===");
console.log("    Instanz: " + ROLLE + " (" + BASE + ")");
if (dateien.length) console.log("    Dateien: " + dateien.join(", "));
console.log("");

// ---------------------------------------------------------------------------
// (1) Uhrzeit und Verbindung
// ---------------------------------------------------------------------------
//
// Die Systemzeit gehoert ins Protokoll, weil jede spaetere Zuordnung daran
// haengt - und weil eine aus dem Kopf genannte Uhrzeit in diesem Projekt schon
// mehrfach danebenlag.
const jetzt = new Date();
console.log("  Zeit: " + jetzt.toISOString() + "  (" + jetzt.toLocaleString() + ")");

let state = null;
try {
  state = await hole("/api/state");
} catch (e) {
  punkt(1, "Bruecke erreichbar", false, e.message + " - laeuft sync/bridge.js?");
}
if (state) {
  punkt(1, "Bruecke verbunden und richtige Instanz",
    state.connected === true && state.instance === ROLLE,
    "connected=" + state.connected + ", instance=" + state.instance
    + ", verified=" + state.verified);
}

// ---------------------------------------------------------------------------
// (2) Der richtige Spielstand
// ---------------------------------------------------------------------------
if (state) {
  const stimmt = TEST ? true : state.identifier === LIVE_IDENTIFIER;
  punkt(2, "Spielstand-Identifier", stimmt,
    "identifier=" + state.identifier + (TEST ? " (TEST - nicht geprueft)" : "")
    + ", BitNode " + state.bitNode + " Lauf " + state.lauf);
}

// ---------------------------------------------------------------------------
// (3) Frisches Backup
// ---------------------------------------------------------------------------
//
// Nicht "es gibt Backups", sondern "es gibt ein frisches, geprueftes". Ein
// Backup von gestern hilft bei einem Swap von heute nicht.
if (state) {
  const alter = state.backupAgeMin;
  punkt(3, "Backup juenger als 15 Minuten",
    Number.isFinite(alter) && alter <= 15,
    "juengstes Backup " + (Number.isFinite(alter) ? alter.toFixed(1) + " min alt" : "unbekannt")
    + " - erst `node tools/backup.js`, dann `node tools/backup-check.js`");
  const lvb = state.lastVerifiedBackup;
  punkt(3, "und es ist geprueft", !!(lvb && lvb.file),
    lvb && lvb.file ? lvb.file + " (" + lvb.ts + ")"
      : "lastVerifiedBackup fehlt - backup-check lief nie erfolgreich");
}

// ---------------------------------------------------------------------------
// (4) Kein Sprung, kein Graft, kein Einbau im Gange
// ---------------------------------------------------------------------------
//
// Alle drei sind Zustaende, in denen ein halb eingespielter Dateisatz echten
// Schaden anrichtet: der Sprung startet boot.js auf einer halben Registry, ein
// Graft verliert seine Stunden, ein Einbau ebenso.
if (state) {
  // AUS DEM SPIEL GELESEN, nicht aus dem Zustandsobjekt der Bruecke.
  //
  // Hier stand `state.telemetry["data/ausgang.json"]`. `state.telemetry` ist
  // aber KEINE Tabelle aller Telemetriedateien, sondern der Inhalt von
  // `data/bn4net.json` - der Kern und sonst nichts. Alle drei Abfragen kamen
  // deshalb immer `null` zurueck, und zwei davon schlossen daraus "in Ordnung".
  //
  // Eine Probe, die ihren Gegenstand gar nicht sehen kann, ist keine Probe.
  // Genau diese Fehlerklasse soll die Checkliste verhindern - sie hatte sie
  // selbst.
  const a = await spielJson("data/ausgang.json");
  const offen = !a.fehlt && a.wert && a.wert.offen === true;
  punkt(4, "kein offener Ausgang", !offen,
    a.fehlt ? "data/ausgang.json liegt nicht im Spiel"
      + (a.grund ? " (" + a.grund + ")" : "") + " - dann laeuft auch kein Sprung"
      : "offen=" + a.wert.offen
        + (a.wert.route_state ? ", route_state=" + a.wert.route_state : ""));

  const g = await spielJson("data/graftauto.json");
  const graftLaeuft = !g.fehlt && g.wert && g.wert.laeuft;
  punkt(4, "kein laufendes Graft", !graftLaeuft,
    graftLaeuft ? "laeuft: " + graftLaeuft
      : (g.fehlt ? "kein graftauto.json - dann graftet auch niemand" : "keins"));

  // Die Einbausperre wird GESETZT, nicht geschaetzt. Ob sie GELESEN wurde,
  // muss danach in der Telemetrie stehen - das prueft dieses Werkzeug nicht
  // selbst, weil es dafuer eine volle Motorrunde warten muesste; es sagt den
  // Befehl an.
  const sp = await spielJson("data/install-sperre.txt");
  const gilt = !sp.fehlt && sp.wert && Number(sp.wert.bis) > Date.now();
  punkt(4, "Einbausperre gesetzt und noch gueltig", gilt,
    gilt ? "laeuft bis " + new Date(Number(sp.wert.bis)).toLocaleTimeString()
      : (sp.fehlt ? "FEHLT" : "abgelaufen")
        + " - setzen, eine volle Motorrunde abwarten und in der Telemetrie\n"
        + "        bestaetigen, dass bn4rep.js sie gelesen hat (bn4rep.js:321).\n"
        + "        Inhalt: {\"ts\":<now>,\"reason\":\"hotswap\",\"bis\":<now+3600e3>}");
}

// ---------------------------------------------------------------------------
// (5) Sauberer Baum, Rollback-Ziel, Kanarienvogel
// ---------------------------------------------------------------------------
let hash = null;
try {
  const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" }).trim();
  punkt(5, "git status sauber", status === "",
    status ? status.split("\n").length + " geaenderte Datei(en) - erst committen" : "");
  hash = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  console.log("       Rollback-Ziel: git checkout " + hash.slice(0, 12) + " -- <datei>");
} catch (e) {
  punkt(5, "git lesbar", false, e.message);
}

// Der Kanarienvogel laesst sich von hier nicht messen - er ist ein Lauf auf
// einer anderen Instanz. Er wird deshalb als Angabe VERLANGT, mit allen vier
// Zahlen, die der Auftrag nennt. Fehlt sie, wird nicht eingespielt.
{
  const kv = flagWert("--kanarienvogel");
  if (TEST) {
    punkt(5, "Kanarienvogel", true, "entfaellt - dies IST die TEST-Instanz");
  } else if (!kv) {
    punkt(5, "Kanarienvogel auf TEST", false,
      "fehlt. Verlangt ist: derselbe Dateisatz, auf TEST mit einem Klon\n"
      + "        DERSELBEN Stunde eingespielt, dort mindestens 20 min gelaufen,\n"
      + "        mit keiner neuen Zeile in pruefstand/data/penalties.json, allen\n"
      + "        Werkzeugen innerhalb ihrer freshnessMs, errStreak == 0 und der\n"
      + "        neuen version in jeder betroffenen Telemetrie.\n"
      + "        Angabe: --kanarienvogel \"<Klonzeit>|<Minuten>|<neue penalties>|<errStreak>\"");
  } else {
    const teile = kv.split("|").map((x) => x.trim());
    const [klonzeit, minuten, penalties, errStreak] = teile;
    const ok = teile.length === 4
      && Number(minuten) >= 20
      && Number(penalties) === 0
      && Number(errStreak) === 0;
    punkt(5, "Kanarienvogel auf TEST", ok,
      "Klon " + klonzeit + ", " + minuten + " min, " + penalties
      + " neue Strafen, errStreak " + errStreak
      + (ok ? "" : " - verlangt sind >= 20 min, 0 Strafen, errStreak 0"));
  }
}

// ---------------------------------------------------------------------------
// (6) Die Reihenfolge
// ---------------------------------------------------------------------------
//
// Bruecke -> Waechter und Telemetrie -> Registry/boot.js -> Motor -> Gewerke.
// Kern und Waechter NIE im selben Schritt: wer beide zugleich austauscht, hat
// im Fehlerfall weder eine Aufsicht noch einen Motor.
{
  const KERN = ["bn4net.js"];
  const WAECHTER = ["guard.js"];
  const hatKern = dateien.some((d) => KERN.includes(path.basename(d)));
  const hatWaechter = dateien.some((d) => WAECHTER.includes(path.basename(d)));
  punkt(6, "Kern und Waechter nicht im selben Schritt",
    !(hatKern && hatWaechter),
    hatKern && hatWaechter
      ? "bn4net.js UND guard.js zusammen - in zwei Schritte teilen,\n"
        + "        dazwischen mindestens 30 Minuten beobachten"
      : "");

  const STUFEN = [
    ["Bruecke", (d) => d.startsWith("sync/")],
    ["Waechter und Telemetrie", (d) => ["guard.js", "wakelock.js", "figwatch.js"].includes(d)],
    ["Registry und boot.js", (d) => ["registry.json", "boot.js"].includes(d)],
    ["Motor", (d) => d === "bn4net.js"],
    ["Gewerke", () => true],
  ];
  if (dateien.length > 1) {
    const stufen = new Set();
    for (const d of dateien) {
      const b = path.basename(d);
      stufen.add(STUFEN.find(([, f]) => f(b))[0]);
    }
    punkt(6, "alle Dateien aus derselben Stufe", stufen.size === 1,
      stufen.size === 1 ? [...stufen][0]
        : "gemischt: " + [...stufen].join(" + ") + " - je Stufe ein eigener Lauf");
  }
}

// ---------------------------------------------------------------------------
// Die Dateien selbst
// ---------------------------------------------------------------------------
for (const d of dateien) {
  const p = path.join(SRC, d);
  punkt(0, d + " liegt in src/", fs.existsSync(p), fs.existsSync(p) ? "" : p);
}

console.log("");
if (rot) {
  console.log("=== " + rot + " Punkt(e) ROT - es wird NICHTS eingespielt ===");
  console.log("");
  console.log("  Ein uebersprungener Punkt dieser Liste ist der Weg, auf dem in");
  console.log("  diesem Projekt schon einmal ein halber Tag verlorenging. Die");
  console.log("  Liste wird abgearbeitet, nicht abgekuerzt.");
  console.log("");
  process.exit(1);
}

console.log("=== Checkliste vollstaendig gruen ===");
console.log("");

if (NUR_PRUEFEN || !dateien.length) {
  console.log("  Nur geprueft, nichts eingespielt.");
  console.log("");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Der Swap
// ---------------------------------------------------------------------------
//
// Ab hier wird das laufende Spiel beruehrt. Die Bruecke schiebt von selbst,
// sobald sich eine Datei unter src/ aendert - dieses Werkzeug ruehrt die
// Dateien deshalb nur an (mtime), wartet auf die Bestaetigung und loest dann
// den Neustart aus.
// ---------------------------------------------------------------------------
// DER FREIBRIEF (Skeptikerrunde 6)
// ---------------------------------------------------------------------------
//
// Seit dem 04.09.2026 deckelt die Bruecke einen Watcher-Schub bei acht
// Dateien (`SCHUB_MAX`) - gegen den Fall, dass ein `git merge` vierzig
// Dateien in einer Sekunde ins laufende Spiel legt, ohne Checkliste und ohne
// Reihenfolge.
//
// Der Kommentar dort behauptete, `data/schub-frei.txt` sei "der bewusste
// Handgriff, den `tools/hotswap.js` verlangt". Dieses Werkzeug kannte die
// Datei nicht einmal. Zwei Skeptiker haben es unabhaengig gefunden: der
// Deckel haette beim ersten echten Hot-Swap zugeschlagen, und jemand haette
// die Datei unter Zeitdruck von Hand angelegt - genau die Bedienung, die ein
// Sicherungsmechanismus nicht haben darf.
//
// Jetzt legt die Checkliste ihn selbst an, und zwar ERST HIER: nach dem
// letzten gruenen Punkt und nur, wenn wirklich eingespielt wird. Der Deckel
// heisst damit "kein Schub, den die Checkliste nicht freigegeben hat" - das
// ist die eigentliche Absicht - statt "kein Schub ueber acht Dateien", was
// nur eine Stellvertretergroesse ist.
//
// Die Bruecke loescht ihn wieder, sobald ein grosser Schub durchgegangen ist
// (Einmal-Ticket), und er verfaellt ohnehin nach 30 Minuten.
const SCHUB_MAX = 8;
if (dateien.length > SCHUB_MAX) {
  const ziel = TEST
    ? path.join(ROOT, "pruefstand", "data", "schub-frei.txt")
    : path.join(ROOT, "data", "schub-frei.txt");
  const ordner = path.dirname(ziel);
  try {
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(ziel,
      "Freigegeben von tools/hotswap.js am " + new Date().toISOString()
      + " fuer " + dateien.length + " Datei(en):" + String.fromCharCode(10)
      + dateien.join(String.fromCharCode(10)) + String.fromCharCode(10), "utf8");
    console.log("  Freibrief gelegt: " + path.relative(ROOT, ziel));
    console.log("    " + dateien.length + " Dateien liegen ueber dem Deckel ("
      + SCHUB_MAX + "). Ohne ihn wuerde die Bruecke den Schub verweigern.");
    console.log("    Er gilt 30 Minuten und wird nach dem ersten grossen Schub");
    console.log("    von der Bruecke geloescht - er ist ein Einmal-Ticket.");
    console.log("");
  } catch (e) {
    console.log("  ACHTUNG: Freibrief liess sich nicht legen (" + e.message + ").");
    console.log("    Die Bruecke wird den Schub verweigern. Datei von Hand anlegen:");
    console.log("      " + ziel);
    console.log("");
  }
}

console.log("  Dateien werden von der Bruecke nachgeschoben (sie beobachtet src/).");
console.log("  Falls sie schon geschoben wurden, steht es im Protokoll:");
console.log("");
console.log("      node -e \"fetch('" + BASE + "/api/state').then(r=>r.json())"
  + ".then(s=>console.log(s.log.slice(-12).join('\\n')))\"");
console.log("");
console.log("  Danach je Werkzeug den Neustart ausloesen. `reload.txt` nennt");
console.log("  ENTWEDER `SELBST bn4net.js` (der Kern beendet sich selbst und");
console.log("  boot.js holt ihn zurueck) ODER `WERKZEUG <name>.js`:");
console.log("");
for (const d of dateien) {
  const b = path.basename(d);
  const befehl = b === "bn4net.js" ? "SELBST bn4net.js" : "WERKZEUG " + b;
  console.log("      node tools/hand.js reload \"" + befehl + "\"");
}
console.log("");
console.log("  Der Swap gilt erst, wenn die neue `version` binnen zweier Takte");
console.log("  in der Telemetrie steht. Ein laufendes Skript behaelt sonst den");
console.log("  ALTEN Code (bn4net.js:421-427), und das sieht von aussen genauso");
console.log("  aus wie Erfolg.");
console.log("");
console.log("  Danach: 10 Minuten beobachten, penalties.json leer, checkin.js");
console.log("  unveraendert oder besser. Dann die Einbausperre loeschen UND das");
console.log("  Loeschen bestaetigen. Dann Commit mit [skeptiker] und Push.");
console.log("");
console.log("  Rollback, wenn eine dieser Zahlen kippt (Auftrag 9):");
console.log("    - Sprosse >= 3 binnen 2 h nach dem Einspielen");
console.log("    - Konto < 0");
console.log("    - T2 > 2 x Soll ueber 60 Motorminuten");
console.log("    - Telemetrie > 15 min alt bei tickender Engine");
console.log("    - eine Fehlstrafe");
console.log("");
console.log("      git checkout " + (hash || "<hash>").slice(0, 12) + " -- "
  + dateien.map((d) => "src/" + d).join(" "));
console.log("");
