/**
 * Ebene 0: die Restzeitschaetzung (Phase C, Position C.3).
 *
 * Sie loest einen Fehler, der sich SELBST STABILISIERT: ein Nachholklumpen
 * liest sich als Rakete, und jede Entscheidung, die an der Restzeit haengt,
 * faellt zum falschen Zeitpunkt.
 *
 * Die Wirtreserve, die hier ebenfalls geprueft wurde, ist am 04.09.2026 nach
 * einer Skeptikerrunde entfallen - sie loeste einen Deadlock, der so nicht
 * existiert. Ihre Aufgabe traegt jetzt der Interlock in lib/endspurt.js.
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
    path.join(ROOT, "src", rel),
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  src/" + rel + " nicht gefunden.");
    process.exit(1);
  }
  return t;
}

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

console.log("");
console.log("=== Ebene 0: Restzeitschaetzung (C.3) ===");

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
console.log("-- eta.js: die QUANTISIERUNGSFALLE (Skeptiker 04.09.) --");
{
  // Der Hacking-Level ist eine GANZZAHL im 60-s-Takt. Waechst er langsamer als
  // etwa 0,6 Stufen je Minute, steht er in mehr als der Haelfte der Fenster
  // still - der Median ist dann 0 und die Restzeit faellt auf null. Genau im
  // Endanflug, wo die Zahl gebraucht wird.
  const reihe = (proMin, n = 30) => {
    let p = [];
    for (let i = 0; i < n; i++) p = ETA.messe(p, i * 60000, 100 + Math.floor(i * proMin));
    return p;
  };
  for (const [proMin, name] of [[0.5, "0,5"], [0.3, "0,3"], [0.1, "0,1"]]) {
    const p = reihe(proMin);
    const r = ETA.rateJeMinute(p);
    pruefe("bei " + name + " Stufen/min kommt eine Rate heraus",
      r !== null && r.rate > 0, r ? "Rate " + r.rate : "null");
    if (r) {
      pruefe("  und sie ist als grob gekennzeichnet", r.grob === true,
        "eine grobe Zahl ist besser als keine, aber sie darf sich nicht als genau ausgeben");
      // KEINE ENGE TOLERANZ, und das ist kein Nachgeben. Bei 0,1 Stufen je
      // Minute liefert ein GANZZAHLIGER Zaehler in 29 Minuten 2 Stufen statt
      // 2,9 - die Quantisierung deckelt die erreichbare Genauigkeit auf rund
      // 30 %, egal wie gut die Rechnung ist. Geprueft wird deshalb die
      // Groessenordnung: die Zahl muss brauchbar sein, nicht genau.
      pruefe("  und liegt in der richtigen Groessenordnung (" + name + ")",
        r.rate > proMin / 2.5 && r.rate < proMin * 2.5,
        "erhalten " + r.rate.toFixed(3) + " - Quantisierung deckelt die Genauigkeit");
    }
  }
  const e = ETA.etaMinuten(reihe(0.5), 109, 200);
  pruefe("die ETA daraus gilt NICHT als sicher", e !== null && e.sicher === false,
    "sie stammt aus einer Notrechnung ueber die Gesamtstrecke");
  // Ein wirklich stehender Wert darf weiterhin null ergeben - sonst waere die
  // Notrechnung ein Freibrief fuer erfundene Zahlen.
  let steht = [];
  for (let i = 0; i < 20; i++) steht = ETA.messe(steht, i * 60000, 100);
  pruefe("ein wirklich stehender Wert ergibt weiter null",
    ETA.rateJeMinute(steht) === null || ETA.rateJeMinute(steht).rate === 0);
}

console.log("");
console.log("-- eta.js: der Median bei WENIGEN Punkten (Skeptiker 04.09.) --");
{
  // Nachgerechnet: mit MIN_PUNKTE 5 standen dem Median vier Abschnitte zur
  // Verfuegung, und zwei Klumpen darin machten die ETA um Faktor 125 falsch -
  // bei sicher:true. Das Fenster ist real, weil die Punkte nur im Prozess
  // leben und jeder Neustart sie leert.
  const mitKlumpen = (gesamt, klumpen) => {
    let p = [];
    let wert = 100;
    for (let i = 0; i < gesamt; i++) {
      p = ETA.messe(p, i * 60000, wert);
      wert += (i < klumpen) ? 500 : 2;
    }
    return p;
  };
  pruefe("MIN_PUNKTE ist mindestens 9", ETA.MIN_PUNKTE >= 9,
    "erhalten " + ETA.MIN_PUNKTE + " - mit 5 kippt der Median schon bei zwei Klumpen");
  const p = mitKlumpen(ETA.MIN_PUNKTE, 2);
  const r = ETA.rateJeMinute(p);
  pruefe("zwei Klumpen kippen den Median nicht mehr",
    r !== null && Math.abs(r.rate - 2) < 0.001, r ? "erhalten " + r.rate : "null");
  const p4 = mitKlumpen(ETA.MIN_PUNKTE, 4);
  const r4 = ETA.rateJeMinute(p4);
  pruefe("auch vier Klumpen nicht", r4 !== null && Math.abs(r4.rate - 2) < 0.001,
    r4 ? "erhalten " + r4.rate : "null");
}

console.log("");
console.log("-- die Konstanten selbst, mit ABSOLUTEN Zahlen --");
{
  // Der Skeptiker hat belegt, dass die alten Pruefungen gegen die Konstanten
  // GEEICHT waren: `jetzt + WIRT_GUELTIG_MS + 1000` bleibt gruen, egal ob die
  // Konstante 10 Minuten oder 10 Jahre betraegt. Eine Konstante prueft man nur
  // gegen eine Zahl, die woanders steht.
  pruefe("ABSTAND_DECKEL_MS sind 12 Minuten", ETA.ABSTAND_DECKEL_MS === 720000,
    "erhalten " + ETA.ABSTAND_DECKEL_MS + " - 12x der 60-s-Takt von ausgang.js");
  pruefe("MAX_PUNKTE ist 30", ETA.MAX_PUNKTE === 30, "erhalten " + ETA.MAX_PUNKTE);
  pruefe("MIN_PUNKTE ist 9", ETA.MIN_PUNKTE === 9, "erhalten " + ETA.MIN_PUNKTE);
  pruefe("MAX_PUNKTE traegt MIN_PUNKTE mit Abstand", ETA.MAX_PUNKTE >= ETA.MIN_PUNKTE * 3);
}

console.log("");
console.log("-- eta.js: median --");
{
  pruefe("ungerade Anzahl", ETA.median([3, 1, 2]) === 2);
  pruefe("gerade Anzahl: der UNTERE der beiden mittleren", ETA.median([1, 2, 3, 4]) === 2,
    "das Mittel waere 2,5 - und bei vier Klumpen von acht 251 statt 2");
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
