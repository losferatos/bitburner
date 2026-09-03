/**
 * Macht aus einer LIVE-Sicherung eine Testkopie - mit gepatchtem Port.
 *
 * WARUM DER PORT-PATCH DER GANZE PUNKT IST
 * Ein Bitburner-Spielstand traegt seine Remote-API-Einstellungen mit sich. Wird
 * eine unveraenderte Live-Sicherung in die Testinstanz geladen, verbindet sich
 * diese zwei Sekunden nach dem Laden auf Port 12525 - die LIVE-Bruecke. Die
 * nimmt die Verbindung an, und ab dann laeuft der Testlauf gegen den echten
 * Spielstand. Der Auftrag fuehrt genau das als den WAHRSCHEINLICHSTEN
 * Verlustweg.
 *
 * Zwei Riegel sichern dagegen, und dieser ist der erste:
 *  1. hier: RemoteFileApiPort wird auf 12526 gesetzt, und die erzeugte Datei
 *     wird sofort dagegen geprueft. Ohne gruenen Nachweis entsteht keine Datei.
 *  2. in der Bruecke: der Wachhund weist eine Verbindung ab, deren Spielstand
 *     einen anderen Port traegt als die Bruecke haelt.
 *
 * Der identifier hilft nicht - er wird beim Kopieren mitgenommen und ist in
 * Live und Kopie identisch. Der Port ist das einzige unterscheidende Merkmal.
 *
 * Aufruf:
 *   node tools/klon.js <LIVE-datei> [--out <ziel>] [--dev]
 *
 * --dev setzt den Port auf 12527 statt 12526, fuer die Dev-Build-Instanz auf
 * Port 8798, damit auch zwei Testinstanzen sich nicht in die Quere kommen.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { lesenKennwerte } from "../sync/backup.js";
import { BACKUP_TEST, ROOT, textAusArgv } from "../sync/instanz.js";

const argv = process.argv.slice(2);
const quelle = argv[0];
const istDev = argv.includes("--dev");
const ZIEL_PORT = istDev ? 12527 : 12526;

if (!quelle || quelle.startsWith("--")) {
  console.log("Aufruf: node tools/klon.js <LIVE-datei> [--out <ziel>] [--dev]");
  process.exit(1);
}
if (!fs.existsSync(quelle)) {
  console.log("Quelle existiert nicht: " + quelle);
  process.exit(1);
}

const roh = fs.readFileSync(quelle);
const vorher = lesenKennwerte(roh, !/-b64\.json$/.test(quelle));

if (vorher.remoteFileApiPort !== 12525) {
  console.log("");
  console.log("  WARNUNG: die Quelle traegt bereits Port " + vorher.remoteFileApiPort + ".");
  console.log("  Das ist keine frische Live-Sicherung. Weiter, aber pruefe die Herkunft.");
}

// Der Spielstand ist JSON mit serialisierten Teilobjekten als Strings. Es wird
// AUSSCHLIESSLICH SettingsSave angefasst - alles andere bleibt Byte fuer Byte,
// damit die Kopie sich im Spiel genauso verhaelt wie das Original.
const text = zlib.gunzipSync(roh).toString("utf8");
const save = JSON.parse(text);
const settings = JSON.parse(save.data.SettingsSave);

const alt = {
  port: settings.RemoteFileApiPort,
  adresse: settings.RemoteFileApiAddress,
  autoexec: settings.AutoexecScript,
  autosave: settings.AutosaveInterval,
};

settings.RemoteFileApiPort = ZIEL_PORT;
settings.RemoteFileApiAddress = "localhost";
save.data.SettingsSave = JSON.stringify(settings);

const neuRoh = zlib.gzipSync(Buffer.from(JSON.stringify(save), "utf8"));

const z = (n) => String(n).padStart(2, "0");
const d = new Date();
const stempel =
  d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) +
  "T" + z(d.getHours()) + "-" + z(d.getMinutes());
const name =
  "TEST_" + vorher.identifier + "_BN" + vorher.bitNodeN + "L" + vorher.lauf +
  "_" + stempel + "_klon.json.gz";
const ziel = textAusArgv(argv, "--out", path.join(BACKUP_TEST, name));

fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, neuRoh);

console.log("");
console.log("  Quelle  " + path.basename(quelle));
console.log("          BN" + vorher.bitNodeN + " L" + vorher.lauf +
  ", " + (vorher.totalPlaytime / 3.6e6).toFixed(2) + " h, Port " + alt.port);
console.log("  Klon    " + path.basename(ziel));
console.log("          Port " + ZIEL_PORT + ", Adresse localhost");
console.log("  Unveraendert: AutoexecScript " + JSON.stringify(alt.autoexec) +
  ", AutosaveInterval " + alt.autosave);

/**
 * Der Nachweis. Ohne ihn ist der Port-Patch ein erinnerter Handgriff, und genau
 * solche Handgriffe sind es, die man einmal vergisst. Faellt die Pruefung durch,
 * wird die Datei wieder geloescht: eine halbe Testkopie im Ablageort ist
 * gefaehrlicher als gar keine, weil sie beim naechsten Mal geladen wird.
 */
let rc = 0;
try {
  const aus = execFileSync(
    "node",
    [
      path.join(ROOT, "tools", "backup-check.js"),
      ziel,
      "--expect-id",
      vorher.identifier,
      "--expect-port",
      String(ZIEL_PORT),
      "--no-index",
    ],
    { encoding: "utf8" },
  );
  console.log(aus);
} catch (e) {
  rc = e.status || 2;
  console.log(e.stdout || "");
  console.log("  Pruefung fehlgeschlagen - Klon wird geloescht.");
  fs.unlinkSync(ziel);
}

if (rc !== 0) process.exit(rc);
console.log("  Klon geprueft. Er darf in die Testinstanz geladen werden.");
console.log("");
