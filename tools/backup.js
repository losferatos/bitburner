/**
 * Sicherung von Hand ausloesen. Im Regelbetrieb macht das die Bruecke selbst
 * (beim Verbinden, stuendlich, vor jedem Schub, per Handschlag) - dieses
 * Werkzeug ist fuer die Bau-Sitzung und fuer den Notfall.
 *
 * Aufruf:
 *   node tools/backup.js [--anlass manual|pre-hotswap|pre-install|pre-jump|emergency]
 *                        [--test]
 *
 * Ohne --test laeuft es gegen die LIVE-Bruecke (Dashboard 8795) und erwartet
 * Erics Spielstand; passt der identifier oder der RFA-Port nicht, bricht es mit
 * Exit 2 ab und legt NICHTS an. Genau das ist der Zweck: eine Sicherung, die
 * nicht beweisbar vom richtigen Spielstand stammt, darf nicht als Netz zaehlen.
 */

import { sichere } from "../sync/backup.js";
import {
  BACKUP_PRIMAER,
  BACKUP_SPIEGEL,
  BACKUP_TEST,
  ROLLEN,
  textAusArgv,
} from "../sync/instanz.js";

const argv = process.argv.slice(2);
const test = argv.includes("--test");
const rolle = test ? ROLLEN.TEST : ROLLEN.LIVE;
const anlass = textAusArgv(argv, "--anlass", "manual");

const erlaubt = ["manual", "pre-hotswap", "pre-install", "pre-jump", "emergency", "hourly", "connect"];
if (!erlaubt.includes(anlass)) {
  console.log("Unbekannter Anlass: " + anlass);
  console.log("Erlaubt: " + erlaubt.join(", "));
  process.exit(1);
}

try {
  const r = await sichere({
    dashPort: rolle.dashPort,
    anlass,
    praefix: rolle.prefix,
    erwartetIdentifier: rolle.identifier,
    erwartetPort: rolle.rfaPort,
    primaer: test ? BACKUP_TEST : BACKUP_PRIMAER,
    spiegel: test ? null : BACKUP_SPIEGEL,
  });

  console.log("");
  console.log("  " + rolle.instance + "  Anlass " + anlass + "  (" + r.dauerMs + " ms)");
  console.log("  BitNode " + r.kennwerte.bitNodeN + " Lauf " + r.kennwerte.lauf +
    "   Spielzeit " + (r.kennwerte.totalPlaytime / 3.6e6).toFixed(2) + " h" +
    "   Hacking " + r.kennwerte.hacking);
  console.log("  Augs " + r.kennwerte.augs + " installiert, " + r.kennwerte.queuedAugs + " wartend" +
    "   Bladeburner-Rang " + (r.kennwerte.bladeburnerRank == null ? "-" : r.kennwerte.bladeburnerRank.toFixed(1)));

  if (r.b64Befund) {
    console.log("");
    console.log("  BEFUND: Die Bruecke lieferte binary=false (Base64-Klartext).");
    console.log("  Dieser Zweig war nie erprobt. Die Datei liegt als .json mit -b64 im Namen.");
    console.log("  Gehoert nach BEFUNDE.md.");
  }

  if (!r.ok) {
    console.log("");
    console.log("  ABGELEHNT - nichts angelegt:");
    for (const g of r.gruende) console.log("    - " + g);
    console.log("");
    process.exit(2);
  }

  console.log("");
  console.log("  GRUEN  " + r.datei);
  for (const o of r.orte) console.log("         " + o);
  if (r.geloescht.length) console.log("  rotiert: " + r.geloescht.length + " alte Datei(en) entfernt");
  console.log("");
  process.exit(0);
} catch (e) {
  console.log("");
  console.log("  FEHLER: " + e.message);
  console.log("  Laeuft die Bruecke? curl.exe -s http://127.0.0.1:" + rolle.dashPort + "/api/state");
  console.log("");
  process.exit(1);
}
