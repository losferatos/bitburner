/**
 * Erzeugt die RAM-Tabelle fuer doku/ram-budget.md aus der Rohmessung.
 *
 * WARUM ES DIESES WERKZEUG GIBT (04.09.2026)
 * Die Messung selbst war sauber - 114 Dateien, je ein calculateRam gegen das
 * laufende Spiel, Live-Wert gegen lokalen Rechner abgeglichen, Abweichung bei
 * allen 114 gleich null. In den BERICHT geriet aber die falsche Tabelle: an der
 * Stelle, an der die RAM-Werte stehen sollten, stand die Inventur der
 * data/-Dateien aus einer anderen Teilaufgabe. Ein Skeptiker fand es; ohne ihn
 * haette die zentrale Tabelle des RAM-Budgets aus 114 Zeilen ueber ein voellig
 * anderes Thema bestanden.
 *
 * Die Lehre ist nicht "sorgfaeltiger sein", sondern: die Tabelle wird aus den
 * Rohdaten ERZEUGT, nicht abgeschrieben. Dann kann sie nicht mehr vom Thema
 * abweichen.
 *
 * Aufruf: node tools/ram-tabelle.js <messung.json>
 */

import fs from "node:fs";

const quelle = process.argv[2];
if (!quelle || !fs.existsSync(quelle)) {
  console.log("Aufruf: node tools/ram-tabelle.js <messung.json>");
  process.exit(1);
}

const daten = JSON.parse(fs.readFileSync(quelle, "utf8"));
daten.sort((a, b) => b.live41 - a.live41);

const HOME_KALT = 32;
const z = (n) => (n === null || n === undefined ? "-" : String(n).replace(".", ","));

console.log("| Datei | SF4.1 live | SF4.3 | Ersparnis | passt auf 32 GB? | Singularity-Aufrufe | Zeilen |");
console.log("|---|---:|---:|---:|---|---:|---:|");
for (const d of daten) {
  const passt41 = d.live41 <= HOME_KALT;
  const passt43 = d.lokal43 <= HOME_KALT;
  const marke = passt41 ? "ja" : passt43 ? "erst ab SF4.3" : "**nein**";
  console.log(
    "| `" + d.file + "` | " + z(d.live41) + " | " + z(d.lokal43) + " | " +
      z(Math.round((d.live41 - d.lokal43) * 100) / 100) + " | " + marke + " | " +
      (d.singFns ? d.singFns.length : 0) + " | " + d.lines + " |",
  );
}

const summe41 = daten.reduce((a, d) => a + d.live41, 0);
const summe43 = daten.reduce((a, d) => a + d.lokal43, 0);
const ueber32heute = daten.filter((d) => d.live41 > HOME_KALT).length;
const ueber32danach = daten.filter((d) => d.lokal43 > HOME_KALT).length;
const abweichungen = daten.filter((d) => d.diff !== 0);

console.error("");
console.error("Zusammenfassung:");
console.error("  Dateien                 " + daten.length);
console.error("  Summe SF4.1             " + summe41.toFixed(1) + " GB");
console.error("  Summe SF4.3             " + summe43.toFixed(1) + " GB");
console.error("  Der Faktor 16 kostet    " + (summe41 - summe43).toFixed(1) + " GB");
console.error("  Ueber 32 GB heute       " + ueber32heute);
console.error("  Ueber 32 GB ab SF4.3    " + ueber32danach);
console.error("  Live gegen lokal        " + abweichungen.length + " Abweichung(en)");
