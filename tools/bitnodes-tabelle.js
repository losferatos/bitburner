/**
 * Erzeugt `src/lib/bitnodes.json` aus dem Spielquelltext.
 *
 * WOZU: Der Kern rechnet heute mit `ns.hackAnalyze` und Verwandten - drei
 * Funktionen zu je 1 GB. Dieselben Werte lassen sich aus `lib/calc.js`
 * rechnen, ABER dessen Formeln kennen die BitNode-Multiplikatoren nicht
 * (`bn4net.js:3404-3410` warnt ausdruecklich davor: ein naiver Import haette
 * eine stille Verfuenffachung der Beute je Faden bedeutet, weil BitNode 4
 * ScriptHackMoney auf 0,2 setzt).
 *
 * Diese Tabelle liefert die fehlenden Faktoren - erzeugt aus
 * `BitNodeMultipliers.ts` und `BitNode.tsx`, nicht abgeschrieben.
 *
 * Aufruf: node tools/bitnodes-tabelle.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const REF = path.join(ROOT, "reference", "v301", "src", "BitNode");

const datei = (n) => path.join(REF, n);
for (const n of ["BitNode.tsx", "BitNodeMultipliers.ts"]) {
  if (!fs.existsSync(datei(n))) {
    console.log("nicht gefunden: " + datei(n));
    process.exit(1);
  }
}

const tsx = fs.readFileSync(datei("BitNode.tsx"), "utf8");

// Die Standardwerte stehen als Klassenfelder in BitNodeMultipliers.ts:
//   AgilityLevelMultiplier = 1;
// Ein Feld, das ein Knoten nicht ueberschreibt, hat diesen Wert.
const mults = fs.readFileSync(datei("BitNodeMultipliers.ts"), "utf8");
const standard = {};
for (const m of mults.matchAll(/^\s*(\w+)\s*=\s*([\d.]+)\s*;/gm)) {
  standard[m[1]] = Number(m[2]);
}

// Die knotenspezifischen Werte stehen in getBitNodeMultipliers() als
// switch-Faelle: `case 10: { ... return new BitNodeMultipliers({ ... }) }`.
// Der Block reicht vom `case n:` bis zum naechsten `case`.
const knoten = {};
const faelle = [...tsx.matchAll(/^\s*case (\d+):\s*\{/gm)];
for (let i = 0; i < faelle.length; i++) {
  const n = Number(faelle[i][1]);
  if (!Number.isFinite(n) || n < 1 || n > 15) continue;
  const ab = faelle[i].index;
  const bis = i + 1 < faelle.length ? faelle[i + 1].index : tsx.length;
  const block = tsx.slice(ab, bis);
  const eigen = {};
  for (const f of block.matchAll(/^\s*(\w+)\s*:\s*([\d.]+)\s*,/gm)) {
    const name = f[1];
    if (name in standard) eigen[name] = Number(f[2]);
  }
  // Ein Knoten kann mehrfach vorkommen (Stufen); der erste Fall gilt.
  if (!knoten[n]) knoten[n] = eigen;
}

const gefunden = Object.keys(knoten).length;
if (gefunden < 10) {
  console.log("Nur " + gefunden + " Knoten gefunden - das Muster in BitNode.tsx");
  console.log("passt nicht mehr. Die Datei wird NICHT geschrieben.");
  process.exit(1);
}

const ausgabe = {
  hinweis: "ERZEUGT von tools/bitnodes-tabelle.js aus reference/v301/src/BitNode/. "
    + "Nicht von Hand pflegen.",
  erzeugtAm: new Date().toISOString(),
  warnung: "Ein Feld, das hier fehlt, ist 1 - NICHT 0. Wer fehlende Felder als 0 "
    + "liest, setzt jede Beute auf null.",
  standard,
  knoten,
};

const worktree = path.resolve(ROOT, "..", "bitburner-bau", "src", "lib");
const ziel = fs.existsSync(worktree)
  ? path.join(worktree, "bitnodes.json")
  : path.join(ROOT, "src", "lib", "bitnodes.json");
fs.writeFileSync(ziel, JSON.stringify(ausgabe, null, 1), "utf8");

console.log("");
console.log("=== BitNode-Multiplikatoren ===");
console.log("  Knoten          " + gefunden);
console.log("  Standardfelder  " + Object.keys(standard).length);
console.log("  geschrieben     " + ziel);
console.log("");
for (const n of [1, 4, 8, 9, 10]) {
  const k = knoten[n];
  if (!k) continue;
  const wichtig = ["ScriptHackMoney", "HackingLevelMultiplier", "ServerGrowthRate",
    "CloudServerLimit", "CloudServerCost"]
    .filter((f) => f in k)
    .map((f) => f + "=" + k[f]);
  console.log("  BN" + String(n).padEnd(3) + (wichtig.join("  ") || "(keine der wichtigen Abweichungen)"));
}
console.log("");
