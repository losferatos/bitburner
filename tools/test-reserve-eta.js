/**
 * Ebene 0: Wirtreserve und Restzeitschaetzung (Phase C, Position C.3).
 *
 * Beide loesen einen Fehler, der sich SELBST STABILISIERT und deshalb nie als
 * Fehler auffaellt:
 *
 *   - Ohne Reserve gibt der Bot kurz vor dem Sprung alles aus, kann den Wirt
 *     nicht bezahlen, springt nicht, verdient weiter, gibt wieder alles aus.
 *   - Ohne robuste Rate liest ein Nachholklumpen sich als Rakete, und die
 *     Reserve wird zum falschen Zeitpunkt gehalten.
 *
 * Aufruf: node tools/test-reserve-eta.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(rel) {
  const k = [
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
    path.join(ROOT, "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  src/" + rel + " nicht gefunden.");
    process.exit(1);
  }
  return t;
}

const RES = await import(pathToFileURL(finde("lib/reserve.js")).href);
const ETA = await import(pathToFileURL(finde("lib/eta.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

/**
 * Ein Mini-ns mit einem Dateisystem im Speicher. Er kennt genau die vier
 * Funktionen, die reserve.js benutzt - mehr waere ein Mock, der etwas anderes
 * prueft als den Code.
 */
function mockNs(dateien = {}, geld = 0, host = "home") {
  return {
    _dateien: dateien,
    _geschrieben: [],
    fileExists: (d) => d in dateien,
    read: (d) => dateien[d] ?? "",
    write: (d, inhalt) => { dateien[d] = inhalt; },
    scp: () => true,
    getHostname: () => host,
    getServerMoneyAvailable: () => geld,
  };
}

console.log("");
console.log("=== Ebene 0: Wirtreserve und ETA (C.3) ===");

console.log("");
console.log("-- reserve.js: die beiden Kanaele sind getrennt --");
{
  pruefe("Augmentierungskanal ist geldbedarf.txt", RES.KANAL_AUG === "data/geldbedarf.txt",
    "der bestehende Vertrag mit bn4rep.js:1205");
  pruefe("Wirtkanal ist eine ANDERE Datei", RES.KANAL_WIRT !== RES.KANAL_AUG,
    "ein zweiter Schreiber auf derselben Datei ueberschriebe den ersten still");
}

console.log("");
console.log("-- reserve.js: Augmentierungsreserve unveraendert lesbar --");
{
  const ns = mockNs({ "data/geldbedarf.txt": "5000000000" });
  pruefe("nackte Zahl wird gelesen", RES.augReserve(ns) === 5e9);
  pruefe("fehlende Datei ergibt 0", RES.augReserve(mockNs({})) === 0);
  pruefe("Unsinn ergibt 0", RES.augReserve(mockNs({ "data/geldbedarf.txt": "viel" })) === 0);
  pruefe("negative Zahl ergibt 0", RES.augReserve(mockNs({ "data/geldbedarf.txt": "-5" })) === 0);
}

console.log("");
console.log("-- reserve.js: die Wirtreserve verfaellt --");
{
  const jetzt = 1_700_000_000_000;
  const ns = mockNs({});
  RES.setzeWirtReserve(ns, 412e6, jetzt, "Wirt fuer exit.js");
  const frisch = RES.wirtReserve(ns, jetzt + 60000);
  pruefe("frische Reserve gilt", frisch.betrag === 412e6, JSON.stringify(frisch));
  pruefe("Zweck steht drin", /exit\.js/.test(frisch.zweck));

  // DER FALL, DER SONST EWIG GELD SPERRT: der Schreiber ist tot, die Datei
  // liegt noch da. Ohne Verfall bleibt das Geld fuer immer reserviert - und
  // niemand sucht danach, weil der Kontostand ja stimmt.
  const alt = RES.wirtReserve(ns, jetzt + RES.WIRT_GUELTIG_MS + 1000);
  pruefe("abgelaufene Reserve zaehlt NULL", alt.betrag === 0);
  pruefe("und meldet sich als abgelaufen", alt.abgelaufen === true);

  const genauAufDerGrenze = RES.wirtReserve(ns, jetzt + RES.WIRT_GUELTIG_MS);
  pruefe("genau auf der Grenze gilt sie noch", genauAufDerGrenze.betrag === 412e6);
}

console.log("");
console.log("-- reserve.js: Erneuern und Loeschen --");
{
  const jetzt = 1_700_000_000_000;
  const ns = mockNs({});
  RES.setzeWirtReserve(ns, 100, jetzt);
  RES.setzeWirtReserve(ns, 200, jetzt + 300000);
  const r = RES.wirtReserve(ns, jetzt + 300000 + 60000);
  pruefe("Erneuern verschiebt das Verfallsdatum", r.betrag === 200);
  RES.loescheWirtReserve(ns);
  pruefe("Loeschen setzt auf 0", RES.wirtReserve(ns, jetzt + 300000).betrag === 0);
  RES.setzeWirtReserve(ns, 0, jetzt);
  pruefe("Betrag 0 loescht statt zu setzen", RES.wirtReserve(ns, jetzt).betrag === 0);
  RES.setzeWirtReserve(ns, -5, jetzt);
  pruefe("negativer Betrag loescht", RES.wirtReserve(ns, jetzt).betrag === 0);
}

console.log("");
console.log("-- reserve.js: Summe und freies Geld --");
{
  const jetzt = 1_700_000_000_000;
  const ns = mockNs({ "data/geldbedarf.txt": "1000000000" }, 5e9);
  RES.setzeWirtReserve(ns, 412e6, jetzt);
  pruefe("Summe addiert beide Kanaele", RES.gesamt(ns, jetzt) === 1e9 + 412e6,
    "erhalten " + RES.gesamt(ns, jetzt));
  pruefe("frei() zieht beide ab", RES.frei(ns, jetzt) === 5e9 - 1e9 - 412e6);

  // Nach dem Verfall gehoert das Geld wieder dem Bot - sonst ist die Reserve
  // ein Speicherleck in Geldform.
  pruefe("nach dem Verfall bleibt nur die Augmentierungsreserve",
    RES.gesamt(ns, jetzt + RES.WIRT_GUELTIG_MS + 1) === 1e9);
}

console.log("");
console.log("-- reserve.js: unlesbare Datei sperrt kein Geld --");
{
  const ns = mockNs({ "data/wirtreserve.txt": "{kaputt" });
  pruefe("unlesbare Wirtreserve zaehlt 0", RES.wirtReserve(ns, 1).betrag === 0,
    "ein Parserfehler darf nicht dazu fuehren, dass der Bot nichts mehr kauft");
}

console.log("");
console.log("-- reserve.js: gilt() als reine Funktion --");
{
  pruefe("gueltige Reserve", RES.gilt({ betrag: 5, bis: 100 }, 50));
  pruefe("abgelaufene Reserve", !RES.gilt({ betrag: 5, bis: 100 }, 101));
  pruefe("Betrag 0", !RES.gilt({ betrag: 0, bis: 100 }, 50));
  pruefe("kein Objekt", !RES.gilt(null, 50));
  pruefe("bis fehlt", !RES.gilt({ betrag: 5 }, 50));
}

// ===========================================================================
console.log("");
console.log("-- eta.js: normale Rate --");
{
  let p = [];
  // Zehn Runden je 60 s, Level waechst um 2 je Runde -> 2 je Minute.
  for (let i = 0; i < 10; i++) p = ETA.messe(p, i * 60000, 100 + i * 2);
  const r = ETA.rateJeMinute(p);
  pruefe("Rate erkannt", r !== null && Math.abs(r.rate - 2) < 0.001,
    r ? "erhalten " + r.rate : "null");
  const e = ETA.etaMinuten(p, 118, 200);
  pruefe("ETA gerechnet", e !== null && Math.abs(e.min - 41) < 0.001,
    e ? "erhalten " + e.min : "null");
  pruefe("als sicher gekennzeichnet", e.sicher === true);
}

console.log("");
console.log("-- eta.js: der NACHHOLKLUMPEN (Falle 2) --");
{
  // Neun normale Runden, dann eine, in der die Engine acht Stunden Rueckstand
  // in 60 Sekunden verbucht. Ein Mittelwert liest daraus eine Rakete.
  let p = [];
  for (let i = 0; i < 9; i++) p = ETA.messe(p, i * 60000, 100 + i * 2);
  p = ETA.messe(p, 9 * 60000, 100 + 8 * 2 + 5000);   // +5000 Level in einer Runde

  const raten = [];
  for (let i = 1; i < p.length; i++) {
    raten.push((p[i].wert - p[i - 1].wert) / ((p[i].wall - p[i - 1].wall) / 60000));
  }
  const mittel = raten.reduce((a, b) => a + b, 0) / raten.length;
  const r = ETA.rateJeMinute(p);
  pruefe("der Mittelwert waere unbrauchbar", mittel > 500,
    "Mittelwert " + mittel.toFixed(0) + " statt 2");
  pruefe("der MEDIAN bleibt bei 2", Math.abs(r.rate - 2) < 0.001,
    "erhalten " + r.rate + " - ein Ausreisser verschiebt ihn nicht");

  const e = ETA.etaMinuten(p, 118, 200);
  pruefe("ETA bleibt realistisch", Math.abs(e.min - 41) < 0.001,
    "erhalten " + e.min.toFixed(1) + " min statt der Rakete");
}

console.log("");
console.log("-- eta.js: die OFFLINE-LUECKE (Falle 1) --");
{
  let p = [];
  for (let i = 0; i < 6; i++) p = ETA.messe(p, i * 60000, 100 + i * 2);
  // Acht Stunden aus. Wanduhr und Wert springen beide.
  p = ETA.messe(p, 6 * 60000 + 8 * 3600000, 112 + 960);
  for (let i = 0; i < 6; i++) p = ETA.messe(p, 6 * 60000 + 8 * 3600000 + (i + 1) * 60000, 1072 + i * 2);
  const r = ETA.rateJeMinute(p);
  pruefe("der Sprung wird verworfen", r.verworfen >= 1, JSON.stringify(r));
  pruefe("die Rate bleibt bei 2", Math.abs(r.rate - 2) < 0.001, "erhalten " + r.rate);
}

console.log("");
console.log("-- eta.js: Wert faellt (Prestige) --");
{
  let p = [];
  for (let i = 0; i < 6; i++) p = ETA.messe(p, i * 60000, 100 + i * 2);
  p = ETA.messe(p, 6 * 60000, 1);           // Reset
  for (let i = 0; i < 6; i++) p = ETA.messe(p, (7 + i) * 60000, 1 + i * 2);
  const r = ETA.rateJeMinute(p);
  pruefe("der Rueckschritt wird verworfen", r.verworfen >= 1);
  pruefe("keine negative Rate", r.rate > 0, "erhalten " + r.rate);
}

console.log("");
console.log("-- eta.js: lieber null als geraten --");
{
  pruefe("zu wenige Punkte ergeben null", ETA.rateJeMinute([{ wall: 0, wert: 1 }]) === null);
  pruefe("leere Liste ergibt null", ETA.rateJeMinute([]) === null);
  let flach = [];
  for (let i = 0; i < 10; i++) flach = ETA.messe(flach, i * 60000, 100);
  pruefe("Rate 0 ergibt keine ETA", ETA.etaMinuten(flach, 100, 200) === null,
    "sonst waere die ETA unendlich und die Reserve stuende fuer immer");
  pruefe("unsinnige Schwelle ergibt null", ETA.etaMinuten(flach, 100, NaN) === null);
}

console.log("");
console.log("-- eta.js: Schwelle bereits erreicht --");
{
  let p = [];
  for (let i = 0; i < 10; i++) p = ETA.messe(p, i * 60000, 100 + i * 2);
  const e = ETA.etaMinuten(p, 250, 200);
  pruefe("ETA ist 0", e !== null && e.min === 0);
  pruefe("und sicher", e.sicher === true);
}

console.log("");
console.log("-- eta.js: eine Woche ist die Grenze der Aussage --");
{
  let p = [];
  for (let i = 0; i < 10; i++) p = ETA.messe(p, i * 60000, 100 + i * 0.01);
  const e = ETA.etaMinuten(p, 100, 1e6);
  pruefe("sehr weite ETA gilt als unsicher", e !== null && e.sicher === false,
    "die Rate von heute sagt ueber naechsten Dienstag nichts");
}

console.log("");
console.log("-- eta.js: Ringpuffer und Reset --");
{
  let p = [];
  for (let i = 0; i < ETA.MAX_PUNKTE + 20; i++) p = ETA.messe(p, i * 60000, i);
  pruefe("Punkte gedeckelt", p.length === ETA.MAX_PUNKTE, "erhalten " + p.length);
  pruefe("die juengsten bleiben", p[p.length - 1].wert === ETA.MAX_PUNKTE + 19);
  pruefe("zuruecksetzen leert", ETA.zuruecksetzen().length === 0);
  pruefe("unsinnige Werte werden nicht angehaengt",
    ETA.messe([], NaN, 5).length === 0);
}

console.log("");
console.log("-- eta.js: median --");
{
  pruefe("ungerade Anzahl", ETA.median([3, 1, 2]) === 2);
  pruefe("gerade Anzahl", ETA.median([1, 2, 3, 4]) === 2.5);
  pruefe("ein Ausreisser verschiebt nicht", ETA.median([2, 2, 2, 2, 99999]) === 2);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
