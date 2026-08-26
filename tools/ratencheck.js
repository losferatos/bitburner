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
 * Aufruf:  node tools/ratencheck.js
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

main();
