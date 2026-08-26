/**
 * Haelt die ERWARTETEN Rangraten des Strategiepruefers gegen die tatsaechlich
 * gemessenen.
 *
 * WARUM ES DAS BRAUCHT
 *
 * `sollRate()` in `tools/strategie-check.js` rechnet aus dem Spielquellcode:
 * rankGain mal Erfolgschance, geteilt durch die Aktionsdauer. Das ist eine
 * gute Schaetzung - aber sie ist nie gegen die Wirklichkeit gehalten worden,
 * und zweimal an einem Nachmittag hat sie einen Fehlalarm erzeugt (17:00 eine
 * feste Rate von 29 je Minute, 18:21 Bruttoertraege ohne die
 * Erfolgswahrscheinlichkeit). Beide Male wurde die Formel nachgebessert, beide
 * Male blieb sie ungeprueft.
 *
 * Bevor man sie durch gemessene Werte ERSETZT, muss man wissen, wie weit sie
 * danebenliegt. Genau das rechnet dieses Werkzeug aus - aus `data/verlauf-
 * strategie.json`, den der Pruefer bei jedem Lauf fortschreibt.
 *
 * WAS ES NICHT TUT
 *
 * Es aendert nichts. Es ist die Messung, die der Entscheidung vorausgeht:
 * Stimmt die Formel im Rahmen, bleibt sie; liegt sie systematisch daneben,
 * gehoert sie durch den gleitenden Median ersetzt.
 *
 * ZWEI QUELLEN, EINE TAUGT (26.08.2026, 05:45)
 *
 * `data/verlauf-strategie.json` haelt alle zwanzig Minuten fest, welche Aktion
 * GERADE laeuft, und schreibt ihr den ganzen Zuwachs der Zwischenzeit zu. In
 * zwanzig Minuten wechselt der Motor aber mehrfach - Contracts/Retirement kam
 * so auf einen Median von null, waehrend der Rang nachweislich stieg. Diese
 * Quelle ist damit als Ratenmessung unbrauchbar.
 *
 * `data/aktionen.txt` schreibt blade.js seit dem 26.08. um 02:56 bei JEDEM
 * Aktionswechsel: von, bis, Aktion, Grund, Rang davor und danach - ungerundet.
 * Das ist die richtige Aufloesung. Die Datei liegt im SPIEL, nicht auf der
 * Platte, und wird ueber die Bruecke geholt.
 *
 * Aufruf:  node tools/ratencheck.js            Abschnitte aus dem Spiel
 *          node tools/ratencheck.js --verlauf  die alte, grobe Quelle
 *          node tools/ratencheck.js --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VERLAUF = path.join(WURZEL, "data", "verlauf-strategie.json");

// Groesser als der Abstand zweier Wachelaeufe (20 min), aber klein genug, dass
// eine Nachtluecke oder ein Neustart die Rechnung nicht verfaelscht.
const MAX_LUECKE_MS = 30 * 60_000;
// Unter zwei Minuten Abstand ist die Rangaenderung so klein, dass die Rundung
// auf ganze Raenge das Ergebnis dominiert.
const MIN_ABSTAND_MS = 2 * 60_000;

function median(werte) {
  if (!werte.length) return null;
  const s = [...werte].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const BRUECKE = "http://localhost:8795";

async function spieldatei(name) {
  const url = BRUECKE + "/api/rpc?method=getFile&filename="
    + encodeURIComponent(name) + "&server=home";
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  if (j.error || typeof j.result !== "string") return null;
  return j.result;
}

/**
 * Die Auswertung, auf die es ankommt: je Aktion die tatsaechliche Rate aus
 * sauber abgegrenzten Abschnitten.
 *
 * Gerechnet wird GEWICHTET - Summe Rang durch Summe Zeit -, nicht als Median
 * einzelner Abschnittsraten. Ein Vertrag von 20 Sekunden und einer von 120
 * duerfen nicht gleich zaehlen.
 *
 * Die "Erfolgsquote" ist der Anteil der ABSCHNITTE mit Rangzuwachs - NICHT
 * die Erfolgschance je Versuch. Ein Abschnitt laeuft, bis blade.js die Aktion
 * wechselt, und enthaelt in der Regel MEHRERE Durchlaeufe: Tracking dauerte
 * am 25.08. dreizehn Sekunden, die Abschnitte sind im Schnitt sechsunddreissig
 * lang. Wer die Quote als Erfolgschance liest, verrechnet sich um genau diesen
 * Faktor - so ist am 26.08. der scheinbare "Restfaktor 3,4" zwischen Erwartung
 * und Messung entstanden.
 */
async function ausAbschnitten() {
  const roh = await spieldatei("data/aktionen.txt");
  if (!roh) {
    console.log("data/aktionen.txt nicht lesbar - laeuft blade.js, und ist die"
      + " Bruecke auf " + BRUECKE + " erreichbar?");
    process.exitCode = 1;
    return;
  }
  const zeilen = roh.split(String.fromCharCode(10)).map((z) => z.trim()).filter(Boolean);
  const je = new Map();
  for (const z of zeilen) {
    let d;
    try { d = JSON.parse(z); } catch { continue; }
    if (!d.aktion || !Number.isFinite(d.rangVon) || !Number.isFinite(d.rangBis)) continue;
    const dauer = (d.bis - d.von) / 1000;
    const rang = d.rangBis - d.rangVon;
    // Ein Rueckgang ist ein Einbau oder Knotenwechsel, keine Aktion.
    if (rang < 0) continue;
    if (!je.has(d.aktion)) je.set(d.aktion, { n: 0, sek: 0, rang: 0, treffer: 0, aus: 0, ausN: 0 });
    const e = je.get(d.aktion);
    e.n++; e.sek += dauer; e.rang += rang;
    if (rang > 0) e.treffer++;
    // Der Ausdauerverbrauch ist die eigentlich knappe Groesse: Er erzwingt die
    // Ruhezeit, und die kostet mehr als jede Aktionsauswahl. Nur fallende
    // Werte zaehlen - waehrend der Kammer und in Ruhephasen steigt die
    // Ausdauer, und das ist kein Verbrauch.
    if (Number.isFinite(d.ausdauerVon) && Number.isFinite(d.ausdauerBis)
        && d.ausdauerBis < d.ausdauerVon) {
      e.aus += d.ausdauerVon - d.ausdauerBis;
      e.ausN++;
    }
  }

  const zeilenAus = [...je.entries()].map(([aktion, e]) => ({
    aktion, n: e.n,
    minuten: +(e.sek / 60).toFixed(1),
    rangJeMinute: e.sek > 0 ? +(e.rang / (e.sek / 60)).toFixed(3) : 0,
    erfolgsquote: +(e.treffer / e.n).toFixed(3),
    schnittSek: +(e.sek / e.n).toFixed(0),
    // Rang je Ausdauerpunkt. Bei einem Motor, der mehr als die Haelfte der
    // Zeit auf Ausdauer wartet, ist DAS die Kennzahl - nicht Rang je Minute.
    rangJeAusdauer: e.aus > 0 ? +(e.rang / e.aus).toFixed(3) : null,
    ausdauerJeLauf: e.ausN > 0 ? +(e.aus / e.ausN).toFixed(2) : null,
  })).sort((a, b) => b.rangJeMinute - a.rangJeMinute);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ zeit: Date.now(), quelle: "aktionen", zeilenAus }, null, 1));
    return;
  }
  console.log("Gemessene Rangraten je Aktion (aus " + zeilen.length
    + " Abschnitten, data/aktionen.txt)");
  console.log("");
  console.log("Aktion".padEnd(42) + "n".padStart(4) + "min".padStart(8)
    + "Rang/min".padStart(10) + "Erfolg".padStart(8) + "s/Lauf".padStart(8)
    + "Rang/Aus".padStart(10) + "Aus/Lauf".padStart(10));
  for (const z of zeilenAus) {
    console.log(z.aktion.padEnd(42)
      + String(z.n).padStart(4)
      + z.minuten.toFixed(1).padStart(8)
      + z.rangJeMinute.toFixed(3).padStart(10)
      + (z.erfolgsquote * 100).toFixed(0).padStart(7) + "%"
      + String(z.schnittSek).padStart(8)
      + (z.rangJeAusdauer === null ? "-" : z.rangJeAusdauer.toFixed(3)).padStart(10)
      + (z.ausdauerJeLauf === null ? "-" : z.ausdauerJeLauf.toFixed(2)).padStart(10));
  }
  const gesamt = zeilenAus.reduce((s, z) => s + z.minuten, 0);
  const rangGesamt = zeilenAus.reduce((s, z) => s + z.rangJeMinute * z.minuten, 0);
  console.log("");
  console.log("Ueber alles: " + rangGesamt.toFixed(1) + " Rang in "
    + gesamt.toFixed(0) + " Minuten = "
    + (rangGesamt / gesamt).toFixed(3) + " je Minute.");
  console.log("Achtung: 'Erfolg' ist der Anteil der ABSCHNITTE mit Zuwachs,"
    + " nicht die Erfolgschance je Versuch - ein Abschnitt enthaelt meist"
    + " mehrere Durchlaeufe (s/Lauf gegen die Aktionsdauer aus bbspann.json"
    + " halten).");
}

function main() {
  let v;
  try {
    v = JSON.parse(fs.readFileSync(VERLAUF, "utf8"));
  } catch (e) {
    console.log("Kein Verlauf lesbar: " + e.message);
    process.exitCode = 1;
    return;
  }

  const punkte = (v.punkte || [])
    .filter((p) => p.aktion && Number.isFinite(p.wert) && Number.isFinite(p.zeit))
    .sort((a, b) => a.zeit - b.zeit);

  // Je Aktionsart alle Raten sammeln, die aus einem sauberen Paar stammen:
  // gleiche Aktion, gleicher Traeger, plausibler Abstand, kein Rueckgang.
  const raten = new Map();
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1], b = punkte[i];
    if (a.aktion !== b.aktion) continue;
    if (a.traeger !== b.traeger) continue;
    const dt = b.zeit - a.zeit;
    if (dt < MIN_ABSTAND_MS || dt > MAX_LUECKE_MS) continue;
    const dw = b.wert - a.wert;
    // Ein Rueckgang ist ein Einbau oder Knotenwechsel, keine Rate.
    if (dw < 0) continue;
    const rate = dw / (dt / 60000);
    if (!raten.has(b.aktion)) raten.set(b.aktion, []);
    raten.get(b.aktion).push(rate);
  }

  const zeilen = [];
  for (const [aktion, liste] of raten) {
    liste.sort((x, y) => x - y);
    zeilen.push({
      aktion,
      n: liste.length,
      median: +median(liste).toFixed(3),
      min: +liste[0].toFixed(3),
      max: +liste[liste.length - 1].toFixed(3),
      // Der Anteil der Messungen, in denen sich GAR NICHTS bewegt hat. Bei
      // einer Aktion, die Rang bringen soll, ist das die aussagekraeftigste
      // Zahl: Sie zeigt, wie oft der Motor leerlaeuft, ohne dass es auffaellt.
      anteilNull: +(liste.filter((r) => r === 0).length / liste.length).toFixed(2),
    });
  }
  zeilen.sort((a, b) => b.n - a.n);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ zeit: Date.now(), zeilen }, null, 1));
    return;
  }

  if (!zeilen.length) {
    console.log("Noch keine auswertbaren Paare im Verlauf.");
    return;
  }
  console.log("Gemessene Rangraten je Aktion (aus " + punkte.length
    + " Messpunkten)");
  console.log("");
  console.log("Aktion".padEnd(34) + "n".padStart(5) + "median".padStart(9)
    + "min".padStart(9) + "max".padStart(9) + "Null%".padStart(8));
  for (const z of zeilen) {
    console.log(z.aktion.padEnd(34)
      + String(z.n).padStart(5)
      + z.median.toFixed(3).padStart(9)
      + z.min.toFixed(3).padStart(9)
      + z.max.toFixed(3).padStart(9)
      + (z.anteilNull * 100).toFixed(0).padStart(8));
  }
  console.log("");
  // WARUM DIESE ZAHLEN NICHT ALS SOLLWERTE TAUGEN (26.08.2026, 02:15).
  //
  // Der erste Lauf hat den geplanten Umbau widerlegt, bevor er begonnen hat:
  // Contracts/Retirement zeigt einen Median von 0,000 bei 67 Prozent
  // Nullmessungen - waehrend der Rang im selben Zeitraum nachweislich um rund
  // 0,5 je Minute gestiegen ist.
  //
  // Der Grund ist die Aufloesung. Ein Verlaufspunkt traegt die Aktion, die im
  // MOMENT der Messung lief; der Rangzuwachs davor stammt aber aus zwanzig
  // Minuten, in denen der Motor mehrfach gewechselt hat - Kammer, Vertrag,
  // Kammer. Die Rate landet dann bei der Aktion, die zufaellig zum Messpunkt
  // lief, und das ist zur Haelfte die Regenerationskammer.
  //
  // Fuer eine belastbare Rate je Aktion muesste blade.js bei JEDEM
  // Aktionswechsel Rang und Zeit protokollieren. Bis dahin bleibt die Formel
  // aus dem Quellcode die bessere Schaetzung - sie ist wenigstens nicht durch
  // die Messmethode verfaelscht.
  console.log("Zum Vergleich die Formel aus tools/strategie-check.js:");
  console.log("  rankGain * Erfolgschance / (Aktionsdauer in Minuten)");
  console.log("  Contracts   Tracking 0,3 · Bounty Hunter 0,9 · Retirement 0,6");
  console.log("  General     Field Analysis 0,1 · Training 0 · Kammer 0");
}

if (process.argv.includes("--verlauf")) main();
else await ausAbschnitten();
