/**
 * Erzeugt `src/lib/blackops.json` aus dem Spielquelltext.
 *
 * ERZEUGT, NICHT ABGESCHRIEBEN. Dieselbe Lehre wie bei der RAM-Tabelle und der
 * Rangkurve am 04.09.2026: eine von Hand uebertragene Zahlenliste weicht ab,
 * sobald sich etwas aendert, und niemand merkt es, weil die Zahlen weiterhin
 * plausibel aussehen. Ein Zeilenversatz in der Rangkurve hatte an dem Tag
 * einen eingebauten Fehlalarm erzeugt.
 *
 * Die Raenge sind Freischaltschwellen, keine Abschlussbedingungen: wer Rang
 * 400.000 hat, DARF die letzte Black Op angehen - erledigt hat er sie damit
 * nicht. Jede Schaetzung, die nur den Rang kennt, ist deshalb eine UNTERE
 * Schranke. Das steht so in der erzeugten Datei, damit es niemand vergisst.
 *
 * GEWICHTE UND ABKLINGEXPONENTEN (03.10.2026, Paket P1 / AUG-4). Je Operation
 * stehen jetzt auch `weights` und `decays` aus demselben Quelltext in der
 * Datei. bn4rep.js rechnet damit, welche Augmentierung die Erfolgschance der
 * naechsten Black Op am staerksten hebt (lib/einbau.js waehleTorRunde); vorher
 * standen die Gewichte nur in blade.js, ein zweites Mal von Hand. Gepaart wird
 * je Operation innerhalb ihres eigenen Blocks, nicht ueber globale Listen -
 * ein Block ohne `decays` wuerde sonst alle folgenden um eins verschieben.
 *
 * Aufruf: node tools/blackops-tabelle.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const QUELLE = path.join(ROOT, "reference", "v301", "src", "Bladeburner", "data", "BlackOperations.ts");

if (!fs.existsSync(QUELLE)) {
  console.log("BlackOperations.ts nicht gefunden: " + QUELLE);
  process.exit(1);
}

const t = fs.readFileSync(QUELLE, "utf8");

// Name und Rang stehen im selben Eintrag, aber nicht auf derselben Zeile. Sie
// werden getrennt gesammelt und ueber die Reihenfolge gepaart - deshalb prueft
// der Code unten, dass beide Listen gleich lang sind. Waeren sie es nicht,
// entstuende genau der Zeilenversatz, den dieses Werkzeug verhindern soll.
const namen = [...t.matchAll(/name:\s*BladeburnerBlackOpName\.(\w+)/g)].map((m) => m[1]);
const raenge = [...t.matchAll(/reqdRank:\s*([\d.e+]+)/g)].map((m) => Number(m[1]));

if (namen.length !== raenge.length) {
  console.log("Namen (" + namen.length + ") und Raenge (" + raenge.length +
    ") passen nicht zusammen - die Datei wird NICHT geschrieben.");
  process.exit(1);
}
if (namen.length !== 21) {
  console.log("Erwartet werden 21 Black Ops, gefunden " + namen.length +
    " - die Datei wird NICHT geschrieben.");
  process.exit(1);
}

// Die Raenge muessen aufsteigend sein; darauf beruht jede Schwellenrechnung.
for (let i = 1; i < raenge.length; i++) {
  if (raenge[i] <= raenge[i - 1]) {
    console.log("Raenge nicht aufsteigend bei " + namen[i] + " (" + raenge[i] +
      " nach " + raenge[i - 1] + ") - die Datei wird NICHT geschrieben.");
    process.exit(1);
  }
}

// Je Operation EIN Block (aufgeteilt am Namensschluessel), darin genau ein
// `weights: {...}` und ein `decays: {...}`. Fehlt eines, wird nichts
// geschrieben - lieber keine Datei als eine mit verschobenen Gewichten.
const zahlenBlock = (text, feld) => {
  const m = new RegExp(feld + ":\\s*\\{([^}]*)\\}").exec(text);
  if (!m) return null;
  const out = {};
  for (const e of m[1].matchAll(/(\w+):\s*([0-9.]+)/g)) out[e[1]] = Number(e[2]);
  return out;
};
const bloecke = t.split("[BladeburnerBlackOpName.").slice(1);
if (bloecke.length !== namen.length) {
  console.log("Bloecke (" + bloecke.length + ") und Namen (" + namen.length +
    ") passen nicht zusammen - die Datei wird NICHT geschrieben.");
  process.exit(1);
}
const gewichte = bloecke.map((b) => ({
  name: b.split("]")[0],
  weights: zahlenBlock(b, "weights"),
  decays: zahlenBlock(b, "decays"),
}));
gewichte.forEach((g, i) => {
  if (g.name !== namen[i] || !g.weights || !g.decays) {
    console.log("Operation " + (namen[i] || i) + ": Gewichte oder Abklingexponenten fehlen" +
      " oder der Block gehoert zu " + g.name + " - die Datei wird NICHT geschrieben.");
    process.exit(1);
  }
  // Jeder gewichtete Wert braucht einen Abklingexponenten, sonst rechnet
  // Math.pow(x, undefined) = NaN durch die ganze Summe.
  for (const [stat, w] of Object.entries(g.weights)) {
    if (w > 0 && !(g.decays[stat] > 0)) {
      console.log(g.name + ": Gewicht fuer " + stat + " ohne Abklingexponent - die Datei wird NICHT geschrieben.");
      process.exit(1);
    }
  }
});

const ausgabe = {
  hinweis:
    "ERZEUGT von tools/blackops-tabelle.js aus reference/v301/src/Bladeburner/" +
    "data/BlackOperations.ts. Nicht von Hand pflegen.",
  erzeugtAm: new Date().toISOString(),
  warnung:
    "reqdRank ist eine FREISCHALTSCHWELLE, keine Abschlussbedingung. Wer den " +
    "Rang hat, darf die Aktion angehen - erledigt hat er sie nicht. Eine " +
    "Restzeit, die nur den Rang kennt, ist eine UNTERE Schranke und darf keinen " +
    "Einbau blockieren.",
  anzahl: namen.length,
  hoechsterRang: Math.max(...raenge),
  ops: namen.map((n, i) => ({
    name: n, rang: raenge[i], weights: gewichte[i].weights, decays: gewichte[i].decays,
  })),
};

// NUR IN DEN WORKTREE, SOLANGE ES IHN GIBT.
//
// Der erste Lauf dieses Werkzeugs schrieb in BEIDE Baeume - und alles unter
// der Live-Arbeitskopie `src/` geht binnen 400 ms ins laufende Spiel. Die
// Bruecke hat sauber gearbeitet (Sicherung davor, genau eine Datei), aber die
// Checkliste aus Auftrag 9 lief nicht: das war ein ungeplanter Live-Eingriff.
//
// Ein Werkzeug, das nebenbei ins laufende Spiel schreibt, ist ein Werkzeug zu
// viel. Live kommt die Datei ueber den Hot-Swap, wie jede andere auch.
const worktree = path.resolve(ROOT, "..", "bitburner-bau", "src", "lib");
const ziel = fs.existsSync(worktree)
  ? path.join(worktree, "blackops.json")
  : path.join(ROOT, "src", "lib", "blackops.json");

fs.writeFileSync(ziel, JSON.stringify(ausgabe, null, 1), "utf8");
console.log("geschrieben: " + ziel);
if (!fs.existsSync(worktree)) {
  console.log("  ACHTUNG: kein Worktree gefunden - das ging in die LIVE-Arbeitskopie.");
}

console.log("");
console.log("=== Black Operations ===");
console.log("  Anzahl          " + ausgabe.anzahl);
console.log("  Rang von/bis    " + raenge[0] + " bis " + ausgabe.hoechsterRang);
console.log("  letzte drei     " + namen.slice(-3).map((n, i) =>
  n + " (" + raenge[raenge.length - 3 + i] + ")").join(", "));
console.log("");
