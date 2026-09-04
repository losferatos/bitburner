/**
 * Wie weit ist der Bau? Eine Zahl, die reproduzierbar ist statt geschaetzt.
 *
 * ===========================================================================
 * WARUM ES DIESES WERKZEUG GIBT
 * ===========================================================================
 *
 * Eric will alle 30 Minuten einen Fortschritt in Prozent. Eine Zahl, die
 * jedes Mal neu aus dem Gefuehl entsteht, ist keine Messung - sie steigt,
 * wenn man viel getippt hat, und faellt, wenn man einen Befund findet. Genau
 * die falsche Richtung.
 *
 * Hier kommt sie aus zwei Quellen: der Positionsliste in ARCHITEKTUR.md 9
 * (was zu bauen ist) und STATUS.json (wie weit jede Position ist). Beide sind
 * versioniert; wer die Zahl anzweifelt, kann sie nachrechnen.
 *
 * ===========================================================================
 * DIE STUFEN UND IHRE GEWICHTE
 * ===========================================================================
 *
 * "gebaut" ist bewusst nur 40 %. Code zu schreiben ist der kleinere Teil der
 * Arbeit; bei C.3 fanden die Ebene-0-Pruefungen und die Skeptikerrunde
 * zusammen mehr Fehler, als der Bau selbst Zeilen hatte. Und "live" ist nicht
 * 100 %, weil eine Position erst abgenommen ist, wenn ihre Bedingung aus
 * ARCHITEKTUR 9 gemessen erfuellt wurde - nicht wenn sie laeuft.
 *
 * Aufruf: node tools/fortschritt.js [--kurz]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const STATUS = path.join(ROOT, "nodes", "BAU-2026-09", "STATUS.json");

const GEWICHT = { offen: 0, gebaut: 0.4, getestet: 0.7, live: 0.9, abgenommen: 1 };

/**
 * Wie stark die drei Bloecke in die Gesamtzahl eingehen.
 *
 * Die Vorphasen sind abgeschlossen und zaehlen 15 % - sie waren gut ein
 * Drittel der bisherigen Arbeitszeit, aber sie tragen nichts zum laufenden
 * Bot bei. Die Abnahme zaehlt 15 %, weil sie Wartezeit ist (12 h Beobachtung,
 * ein beobachteter Sprung) und nicht beliebig zu beschleunigen.
 */
const BLOCK = { vorphasen: 0.15, positionen: 0.70, abnahme: 0.15 };

if (!fs.existsSync(STATUS)) {
  console.log("STATUS.json fehlt: " + STATUS);
  process.exit(1);
}
const s = JSON.parse(fs.readFileSync(STATUS, "utf8"));

function anteil(gruppe) {
  const werte = Object.values(gruppe);
  if (!werte.length) return 0;
  let summe = 0;
  for (const e of werte) {
    const g = GEWICHT[e.stand];
    if (g === undefined) {
      console.log("  WARNUNG: unbekannter Stand '" + e.stand + "' - zaehlt 0");
      continue;
    }
    summe += g;
  }
  return summe / werte.length;
}

const aVor = anteil(s.vorphasen);
const aPos = anteil(s.positionen);
const aAbn = anteil(s.abnahme);
const gesamt = aVor * BLOCK.vorphasen + aPos * BLOCK.positionen + aAbn * BLOCK.abnahme;

const kurz = process.argv.includes("--kurz");

if (kurz) {
  console.log(Math.round(gesamt * 100) + "%");
  process.exit(0);
}

console.log("");
console.log("=== Fortschritt des Baus ===");
console.log("  Stand der Datei: " + s.aktualisiert);
console.log("");

const zeile = (name, e) => {
  const g = GEWICHT[e.stand] ?? 0;
  const balken = "#".repeat(Math.round(g * 10)).padEnd(10, ".");
  console.log("  " + name.padEnd(6) + " [" + balken + "] " + e.stand.padEnd(11) + " " + e.was);
  if (e.offen) console.log("           offen: " + e.offen);
};

console.log("-- Vorphasen (" + Math.round(aVor * 100) + " %) --");
for (const [n, e] of Object.entries(s.vorphasen)) zeile(n, e);

console.log("");
console.log("-- Baupositionen (" + Math.round(aPos * 100) + " %) --");
for (const [n, e] of Object.entries(s.positionen)) zeile(n, e);

console.log("");
console.log("-- Abnahme (" + Math.round(aAbn * 100) + " %) --");
for (const [n, e] of Object.entries(s.abnahme)) zeile(n, e);

// Was als Naechstes dran ist: die erste Position, die nicht abgenommen ist.
const naechste = Object.entries(s.positionen).find(([, e]) => e.stand !== "abgenommen");

console.log("");
console.log("===========================================");
console.log("  GESAMT: " + Math.round(gesamt * 100) + " %");
console.log("===========================================");
if (naechste) {
  console.log("  Als Naechstes: " + naechste[0] + " - " + naechste[1].was);
  if (naechste[1].offen) console.log("  Dort offen:    " + naechste[1].offen);
}
const fertigePos = Object.values(s.positionen).filter((e) => e.stand === "abgenommen").length;
console.log("  Positionen abgenommen: " + fertigePos + " von " + Object.keys(s.positionen).length);
console.log("");
