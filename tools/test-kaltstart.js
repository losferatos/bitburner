/**
 * Ebene 0: `lib/kaltstart.js` - die gemeinsame Kaltstart-Definition fuer
 * Kern (bn4net.js) und Waechter (guard.js), Audit-Fund 6#7, Paket C.5
 * (26./27.09.2026).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * Beide Dateien kannten "Kaltstart" bisher als `home <= 64 GB` - richtig, so
 * lange home nach jedem Reset mit 32 GB startet. Ab Source-File 9 Stufe 2
 * startet home mit 128 GB (`Prestige.ts:241-242`, Eric hat SF9.3): "<=64"
 * war damit im Rueckfall-Fenster (Kern tot, oder kurz nach einem Sprung) nie
 * mehr wahr. Ein erster Reparaturversuch (b16e381, nur die Zahl 64 -> 128 ab
 * SF9 Stufe 2) wurde deshalb zurueckgenommen (11eb9a6): die naechste
 * SF-Stufe haette dieselbe Falle wieder aufgestellt.
 *
 * Dieser Test rechnet mit den ECHTEN Zahlen des laufenden BN5L3-Spielstands
 * (Sprung 26.09.2026 20:41, aus den Backups entschluesselt und gegen die
 * tatsaechlich geschriebene `data/bn4net.json` gegengeprueft):
 *
 *   Sprungmoment (20:41): home 128 GB, 0 gekaufte Rechner, 245 GB Netz
 *     gesamt (gerootete Wirte). Die ECHTE Telemetrie zeigte in diesem
 *     Moment "phase":"normal" - die alte Schwelle (home <= 64) griff nicht,
 *     obwohl die Startlage gerade erst begonnen hatte.
 *   23 Minuten spaeter (21:04): 2 gekaufte Rechner (96 GB), Netz 1957 GB.
 *
 * ALT (home <= 64): RED im Sprungmoment (128 > 64 -> "normal", obwohl 0
 * Park). NEU (Park/Netzgroesse): GREEN (kein Park, Netz 245 < 2048 ->
 * "kaltstart").
 *
 * Aufruf: node tools/test-kaltstart.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const K = await import(pathToFileURL(path.join(ROOT, "src", "lib", "kaltstart.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

// Die ALTE Regel, nur zum Gegenrechnen (nicht mehr im Quelltext).
const alteRegel = (homeGb) => (homeGb <= 64 ? "kaltstart" : "normal");

console.log("");
console.log("=== Ebene 0: lib/kaltstart.js (C.5, Audit-Fund 6#7) ===");

console.log("");
console.log("-- die eigentliche Regression: BN5L3-Sprung 26.09.2026 20:41 --");
{
  // Echte Werte, entschluesselt aus
  // backups/LIVE_197f4d61481686_BN5L3_2026-09-26T20-41_connect.json.gz
  // (AllServersSave: 0 purchasedByPlayer ausser home/Hacknet, Summe maxRam
  // ueber gerootete Wirte = 245 GB; home = 128 GB, SF9.3).
  const homeGb = 128, hatPark = false, netzGb = 245;

  pruefe("ALTE Regel haette den Sprungmoment verfehlt (RED)",
    alteRegel(homeGb) === "normal");
  pruefe("NEUE Regel erkennt den Sprungmoment als Kaltstart (GREEN)",
    K.phaseAus(hatPark, netzGb) === "kaltstart");
}

console.log("");
console.log("-- 23 Minuten spaeter (21:04): Park bereits da --");
{
  // backups/..._2026-09-26T21-04_hourly.json.gz: 2 gekaufte Rechner
  // (64 + 32 GB), Netz gesamt 1957 GB, home weiterhin 128 GB.
  const hatPark = true, netzGb = 1957;
  pruefe("mit Park gilt sofort 'normal', auch unterhalb der Netz-Schwelle",
    K.phaseAus(hatPark, netzGb) === "normal");
  pruefe("istKaltstart liefert dasselbe (false)",
    K.istKaltstart(hatPark, netzGb) === false);
}

console.log("");
console.log("-- Park schlaegt IMMER, unabhaengig von der Netzgroesse --");
{
  pruefe("Park + winziges Netz (1 GB) -> normal",
    K.phaseAus(true, 1) === "normal");
  pruefe("Park + Netz 0 -> normal",
    K.phaseAus(true, 0) === "normal");
}

console.log("");
console.log("-- ohne Park entscheidet die Netzgroesse (Rueckfall fuer Knoten");
console.log("   ohne Park, z. B. BitNode 9, CloudServerLimit 0) --");
{
  pruefe("kein Park, Netz knapp unter der Schwelle -> kaltstart",
    K.phaseAus(false, K.KALTSTART_NETZ_SCHWELLE_GB - 1) === "kaltstart");
  pruefe("kein Park, Netz genau an der Schwelle -> normal",
    K.phaseAus(false, K.KALTSTART_NETZ_SCHWELLE_GB) === "normal");
  pruefe("kein Park, Netz weit darueber (BN9-Spaetphase, 50 TB) -> normal",
    K.phaseAus(false, 50000) === "normal");
  pruefe("kein Park, Netz 0 -> kaltstart",
    K.phaseAus(false, 0) === "kaltstart");
}

console.log("");
console.log("-- sichere Richtung bei kaputten/fehlenden Werten --");
{
  pruefe("kein Park, netzGb undefined -> kaltstart (nicht 'normal')",
    K.phaseAus(false, undefined) === "kaltstart");
  pruefe("kein Park, netzGb NaN -> kaltstart",
    K.phaseAus(false, NaN) === "kaltstart");
  pruefe("kein Park, netzGb als String einer grossen Zahl -> normal (Number() greift)",
    K.phaseAus(false, "5000") === "normal");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
