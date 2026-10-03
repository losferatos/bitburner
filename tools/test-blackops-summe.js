/**
 * Die Black-Ops-Summe, gegen den Quelltext gerechnet statt abgeschrieben.
 *
 * ===========================================================================
 * WARUM ES DIESEN TEST GIBT
 * ===========================================================================
 *
 * Fuer dieselbe Groesse standen in diesem Projekt drei Zahlen: 58.928,
 * 73.660 und 113.660. Keine davon war belegt, alle drei waren falsch, und
 * die falsche wurde benutzt - `tools/checkin.js` zog sie von den 400.000
 * Rang ab, die der Ausgang aus einem Kampfknoten verlangt, und die BN10-ETA
 * hing daran.
 *
 * Nachgerechnet sind es **2.271,5** fuer alle einundzwanzig Operationen und
 * **2.231,5** ohne Daedalus. Der Fehler ist rekonstruierbar: die kleinen
 * `rankGain`-Werte ab Deckard (1,0 · 1,5 · 2,0 · 2,5 · 3 · 4 · 5 · 7,5 · 10
 * · 15 · 20) wurden als Tausender gelesen. 71.500 plus 2.160 aus den ersten
 * neun ergibt exakt 73.660, und "Daedalus 40.000" ist `rankGain: 40`.
 *
 * CLAUDE.md sagt dazu: "Wer eine Formel aus fremdem Quellcode anwendet, baut
 * sie als ausfuehrbaren Code nach und eicht sie gegen einen unabhaengig
 * bekannten Wert." Genau das tut dieser Test - und er tut es bei JEDEM Lauf,
 * damit die Zahl nicht ein zweites Mal abdriftet.
 *
 * ===========================================================================
 * WAS ER PRUEFT
 * ===========================================================================
 *
 * 1. Der Quelltext liefert genau 21 Operationen.
 * 2. Die Summe der `rankGain` trifft die Konstante in `tools/checkin.js`.
 * 3. Die Schwellen (`reqdRank`) sind aufsteigend und enden bei 400.000.
 * 4. `src/lib/blackops.json` deckt sich mit dem Quelltext - sonst rechnen
 *    Werkzeug und Gewerk mit verschiedenen Tabellen.
 * 5. Die Gegenprobe zum alten Fehler: die Summe liegt unter 10.000. Eine
 *    Zahl in der Groessenordnung 73.660 kann keine Summe von 21 Werten sein,
 *    deren groesster 750 ist.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehler.push(text + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + text + (zusatz ? " - " + zusatz : ""));
  }
}

console.log("");
console.log("=== Die Black-Ops-Summe (Befund E.2) ===");
console.log("");

const QUELLE = path.join(ROOT, "reference", "v301", "src", "Bladeburner",
  "data", "BlackOperations.ts");

if (!fs.existsSync(QUELLE)) {
  console.log("  UEBERSPRUNGEN: " + path.relative(ROOT, QUELLE) + " fehlt.");
  console.log("  (Die Referenzkopie liegt nur im Hauptbaum, nicht im Worktree.)");
  console.log("");
  process.exit(0);
}

const text = fs.readFileSync(QUELLE, "utf8");

/**
 * Je Operation EIN Block, aufgeteilt am Namensschluessel. Wichtig ist die
 * Aufteilung: ein globales `match` ueber die ganze Datei wuerde `rankGain`
 * und `reqdRank` unabhaengig voneinander einsammeln und stillschweigend
 * falsch paaren, sobald eine Operation ein Feld nicht hat.
 */
const teile = text.split("[BladeburnerBlackOpName.").slice(1);
const ops = [];
for (const teil of teile) {
  const name = teil.split("]")[0];
  const mR = /reqdRank:\s*([0-9_.e+]+)/.exec(teil);
  const mG = /rankGain:\s*([0-9_.]+)/.exec(teil);
  if (!mR || !mG) continue;
  // Gewichte und Abklingexponenten (P1/AUG-4): bn4rep.js rechnet damit die
  // Erfolgschance der naechsten Black Op (lib/einbau.js waehleTorRunde).
  const zahlen = (feld) => {
    const m = new RegExp(feld + ":\\s*\\{([^}]*)\\}").exec(teil);
    if (!m) return null;
    const o = {};
    for (const e of m[1].matchAll(/(\w+):\s*([0-9.]+)/g)) o[e[1]] = Number(e[2]);
    return o;
  };
  ops.push({
    name,
    reqdRank: Number(mR[1].replace(/_/g, "")),
    rankGain: Number(mG[1]),
    weights: zahlen("weights"),
    decays: zahlen("decays"),
  });
}

pruefe("der Quelltext liefert 21 Operationen", ops.length === 21,
  ops.length + " gefunden");

const summeAlle = ops.reduce((a, o) => a + o.rankGain, 0);
const letzte = ops[ops.length - 1];
const summeOhneLetzte = summeAlle - (letzte ? letzte.rankGain : 0);

console.log("       Summe rankGain aller 21 : " + summeAlle);
console.log("       ohne " + (letzte ? letzte.name : "?") + " : " + summeOhneLetzte);

pruefe("die letzte Operation ist Daedalus mit reqdRank 400.000",
  letzte && letzte.name === "OperationDaedalus" && letzte.reqdRank === 400000,
  letzte ? letzte.name + " / " + letzte.reqdRank : "keine");

pruefe("die Schwellen steigen streng an",
  ops.every((o, i) => i === 0 || o.reqdRank > ops[i - 1].reqdRank),
  ops.map((o) => o.reqdRank).join(" "));

// Die Konstante im Werkzeug.
const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
const mK = /const RANG_UNTERWEGS = ([0-9.]+);/.exec(checkin);
pruefe("tools/checkin.js fuehrt eine Konstante RANG_UNTERWEGS", !!mK);
if (mK) {
  const wert = Number(mK[1]);
  pruefe("und sie trifft die gerechnete Summe ohne Daedalus",
    Math.abs(wert - summeOhneLetzte) < 0.01,
    "Konstante " + wert + ", gerechnet " + summeOhneLetzte);
}

/**
 * DIE GEGENPROBE ZUM ALTEN FEHLER.
 *
 * Sie ist bewusst grob: 10.000 ist keine Grenze, die aus der Mechanik folgt,
 * sondern eine Groessenordnung. Eine Summe von 21 Werten, deren groesster
 * 750 ist, kann die 73.660 nicht erreichen - und genau diese Art von
 * Groessenordnungsfehler ist hier schon zweimal passiert (die Rangrate um
 * Faktor 5000, der Speicherwert um Faktor 64).
 */
pruefe("die Summe liegt in der richtigen Groessenordnung (< 10.000)",
  summeAlle < 10000,
  summeAlle + " - die alten 73.660 waren ein Lesefehler um Faktor 1000");

pruefe("kein Einzelwert ueber 1.000",
  ops.every((o) => o.rankGain <= 1000),
  ops.filter((o) => o.rankGain > 1000).map((o) => o.name).join(", "));

// Und die Tabelle, mit der das Gewerk arbeitet.
// BN4REP_SRC wie in den bn4rep-Tests: dieselbe Pruefung gegen einen alten Stand.
const tabelleDatei = path.join(process.env.BN4REP_SRC ? path.resolve(process.env.BN4REP_SRC) : path.join(ROOT, "src"),
  "lib", "blackops.json");
if (fs.existsSync(tabelleDatei)) {
  const tab = JSON.parse(fs.readFileSync(tabelleDatei, "utf8"));
  pruefe("src/lib/blackops.json kennt dieselbe Zahl an Operationen",
    tab.anzahl === ops.length && Array.isArray(tab.ops) && tab.ops.length === ops.length,
    "json " + tab.anzahl + " / Quelltext " + ops.length);
  pruefe("und dieselben Schwellen",
    tab.ops.every((o, i) => ops[i] && o.rang === ops[i].reqdRank),
    tab.ops.filter((o, i) => !ops[i] || o.rang !== ops[i].reqdRank)
      .map((o) => o.name).join(", "));
  pruefe("und denselben Hoechstrang",
    tab.hoechsterRang === 400000, String(tab.hoechsterRang));
  // P1/AUG-4: die Gewichte, mit denen bn4rep.js die Runde am Einbau-Tor plant.
  const gleich = (a, b) => !!a && !!b && JSON.stringify(Object.entries(a).sort())
    === JSON.stringify(Object.entries(b).sort());
  pruefe("und dieselben Gewichte (weights) je Operation",
    tab.ops.every((o, i) => ops[i] && gleich(o.weights, ops[i].weights)),
    tab.ops.filter((o, i) => !ops[i] || !gleich(o.weights, ops[i].weights))
      .map((o) => o.name).join(", "));
  pruefe("und dieselben Abklingexponenten (decays) je Operation",
    tab.ops.every((o, i) => ops[i] && gleich(o.decays, ops[i].decays)),
    tab.ops.filter((o, i) => !ops[i] || !gleich(o.decays, ops[i].decays))
      .map((o) => o.name).join(", "));
  pruefe("jeder gewichtete Wert hat einen Abklingexponenten > 0",
    tab.ops.every((o) => !!o.weights && !!o.decays
      && Object.entries(o.weights).every(([s, w]) => !(w > 0) || o.decays[s] > 0)),
    "sonst rechnet Math.pow(x, undefined) NaN durch die Competence");
} else {
  pruefe("src/lib/blackops.json liegt vor", false, "fehlt");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
