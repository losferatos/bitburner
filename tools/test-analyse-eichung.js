/**
 * Ebene 0: die Eichung der Analyse-Familie (Position C.7).
 *
 * ===========================================================================
 * WORUM ES GEHT
 * ===========================================================================
 *
 * Der Kern hat `ns.hackAnalyze`, `ns.hackAnalyzeChance` und
 * `ns.growthAnalyze` durch eigene Rechnungen aus `lib/calc.js` ersetzt - drei
 * Funktionen zu je 1 GB, in einer Datei, die im Kaltstart auf ein home mit
 * 32 GB passen muss.
 *
 * Eine ersetzte Formel, die um Faktor 5 danebenliegt, ist schlimmer als die
 * teure Variante: die Zielauswahl des Bots haengt an diesen Zahlen. Deshalb
 * wird hier gegen den SPIELQUELLTEXT geeicht, nicht gegen eine Erinnerung.
 *
 * ===========================================================================
 * DIE FALLE, DIE DAS PROJEKT SCHON KENNT
 * ===========================================================================
 *
 * `bn4net.js:3404-3410` warnt ausdruecklich: `lib/calc.js` rechnet OHNE die
 * BitNode-Multiplikatoren. Ein naiver Import haette in BitNode 4 eine stille
 * Verfuenffachung der Beute je Faden bedeutet (ScriptHackMoney 0,2). Genau
 * dieser Faktor wird hier geprueft - in beiden Richtungen.
 *
 * Aufruf: node tools/test-analyse-eichung.js
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
  if (!t) { console.log("\n  src/" + rel + " nicht gefunden."); process.exit(1); }
  return t;
}

const C = await import(pathToFileURL(finde("lib/calc.js")).href);
const BN = JSON.parse(fs.readFileSync(finde("lib/bitnodes.json"), "utf8"));

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

function nah(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
}

console.log("");
console.log("=== Ebene 0: Eichung der Analyse-Familie (C.7) ===");

// ===========================================================================
// Die Spielformeln, aus dem Quelltext abgelesen und hier NACHGEBAUT. Sie sind
// der Massstab - nicht die Erinnerung daran, wie sie lauten.
//
//   calculatePercentMoneyHacked  (Hacking.ts)
//     difficultyMult = (100 - hackDifficulty) / 100
//     skillMult      = (skill - (reqSkill - 1)) / skill
//     percent        = difficultyMult * skillMult * mults.hacking_money
//                      * currentNodeMults.ScriptHackMoney / 240
//
//   calculateHackingChance (Hacking.ts)
//     skillMult      = max(1.75 * skill, 1)
//     skillChance    = (skillMult - reqSkill) / skillMult
//     difficultyMult = (100 - hackDifficulty) / 100
//     chance         = skillChance * difficultyMult * mults.hacking_chance * intBonus
// ===========================================================================

function spielHackPercent(sec, reqSkill, skill, multMoney, bnScriptHackMoney) {
  if (sec >= 100) return 0;
  const difficultyMult = (100 - sec) / 100;
  const skillMult = (skill - (reqSkill - 1)) / skill;
  const p = (difficultyMult * skillMult * multMoney * bnScriptHackMoney) / 240;
  return Math.min(1, Math.max(0, p));
}

function spielHackChance(sec, reqSkill, skill, multChance, intBonus) {
  if (sec >= 100) return 0;
  const skillMult = Math.max(1.75 * skill, 1);
  const skillChance = (skillMult - reqSkill) / skillMult;
  const difficultyMult = (100 - sec) / 100;
  return Math.min(1, Math.max(0, skillChance * difficultyMult * multChance * intBonus));
}

console.log("");
console.log("-- hackPercent gegen die Spielformel --");
{
  const faelle = [
    { sec: 5, reqSkill: 100, skill: 500, multMoney: 1, bn: 1 },
    { sec: 1, reqSkill: 1, skill: 1, multMoney: 1, bn: 1 },
    { sec: 50, reqSkill: 300, skill: 1000, multMoney: 2.5, bn: 1 },
    { sec: 8.5, reqSkill: 800, skill: 3184, multMoney: 1.8, bn: 0.5 },
    { sec: 99, reqSkill: 10, skill: 100, multMoney: 1, bn: 1 },
  ];
  for (const f of faelle) {
    const soll = spielHackPercent(f.sec, f.reqSkill, f.skill, f.multMoney, f.bn);
    const ist = C.hackPercent({ sec: f.sec, reqSkill: f.reqSkill },
      { skill: f.skill, multMoney: f.multMoney }, f.bn);
    pruefe("sec " + f.sec + ", req " + f.reqSkill + ", skill " + f.skill +
      ", bn " + f.bn, nah(ist, soll),
      "Spiel " + soll.toExponential(6) + " gegen calc " + ist.toExponential(6));
  }
  pruefe("sec 100 ergibt null Beute",
    C.hackPercent({ sec: 100, reqSkill: 1 }, { skill: 1000, multMoney: 1 }, 1) === 0);
}

console.log("");
console.log("-- DER FAKTOR, DER DAS PROJEKT SCHON EINMAL FAST ERWISCHT HAT --");
{
  // bn4net.js:3404-3410: ein Import ohne BitNode-Multiplikator haette in
  // BitNode 4 eine stille Verfuenffachung der Beute bedeutet.
  const ohne = C.hackPercent({ sec: 5, reqSkill: 100 }, { skill: 500, multMoney: 1 }, 1);
  const mitBn4 = C.hackPercent({ sec: 5, reqSkill: 100 }, { skill: 500, multMoney: 1 }, 0.2);
  pruefe("BitNode 4 fuenftelt die Beute", nah(mitBn4, ohne * 0.2),
    "ohne " + ohne.toExponential(4) + ", mit " + mitBn4.toExponential(4));
  pruefe("das Verhaeltnis ist genau 5", nah(ohne / mitBn4, 5),
    "erhalten " + (ohne / mitBn4).toFixed(6));

  // Und der Wert, mit dem der Kern heute rechnet.
  const bn10 = BN.knoten["10"];
  pruefe("BitNode 10 steht in der Tabelle", !!bn10);
  pruefe("und hat ScriptHackMoney 0,5", bn10 && bn10.ScriptHackMoney === 0.5,
    bn10 ? String(bn10.ScriptHackMoney) : "fehlt");
  const bn4 = BN.knoten["4"];
  pruefe("BitNode 4 hat ScriptHackMoney 0,2", bn4 && bn4.ScriptHackMoney === 0.2,
    bn4 ? String(bn4.ScriptHackMoney) : "fehlt");
}

console.log("");
console.log("-- ein fehlendes Feld ist 1, NICHT 0 --");
{
  // Wer fehlende Felder als 0 liest, setzt jede Beute auf null - und der Bot
  // haelt jedes Ziel fuer wertlos. Das ist die stillste Art, ihn anzuhalten.
  const bn1 = BN.knoten["1"] || {};
  pruefe("BitNode 1 ueberschreibt ScriptHackMoney nicht",
    !("ScriptHackMoney" in bn1), JSON.stringify(bn1).slice(0, 80));
  const faktor = Number.isFinite(bn1.ScriptHackMoney) ? bn1.ScriptHackMoney : 1;
  pruefe("der Ersatzwert ist 1", faktor === 1);
  pruefe("und ergibt die volle Beute",
    C.hackPercent({ sec: 5, reqSkill: 100 }, { skill: 500, multMoney: 1 }, faktor) > 0);
  pruefe("die Tabelle warnt davor im Klartext",
    /ist 1 - NICHT 0/.test(BN.warnung || ""), BN.warnung);
}

console.log("");
console.log("-- hackChance gegen die Spielformel --");
{
  const faelle = [
    { sec: 5, reqSkill: 100, skill: 500, multChance: 1 },
    { sec: 50, reqSkill: 300, skill: 1000, multChance: 1.5 },
    { sec: 1, reqSkill: 1, skill: 3184, multChance: 1 },
  ];
  for (const f of faelle) {
    const soll = spielHackChance(f.sec, f.reqSkill, f.skill, f.multChance, C.intBonus(0));
    const ist = C.hackChance({ sec: f.sec, reqSkill: f.reqSkill, root: true },
      { skill: f.skill, multChance: f.multChance, int: 0 });
    pruefe("Chance bei sec " + f.sec + ", req " + f.reqSkill, nah(ist, soll),
      "Spiel " + soll.toFixed(8) + " gegen calc " + ist.toFixed(8));
  }
  pruefe("ohne Root keine Chance",
    C.hackChance({ sec: 5, reqSkill: 1, root: false }, { skill: 1000, multChance: 1, int: 0 }) === 0);
}

console.log("");
console.log("-- growthLogPerThread und der Deckel --");
{
  // Der Deckel greift ab sec <= 8,5714: darunter bringt Weakenen dem Wachstum
  // nichts mehr. Das ist der Wert, mit dem der Kern seine Kennzahlen bildet.
  const DECKEL = 0.00349388925425578;
  const hoch = C.growthLogPerThread({ sec: 1, growth: 100 }, 1, 1, 1);
  pruefe("bei sec 1 greift der Deckel", nah(hoch, DECKEL, 1e-6),
    "erhalten " + hoch.toExponential(8));
  const mittel = C.growthLogPerThread({ sec: 50, growth: 100 }, 1, 1, 1);
  pruefe("bei sec 50 liegt es darunter", mittel < DECKEL && mittel > 0,
    "erhalten " + mittel.toExponential(6));
  pruefe("ein Server ohne Wachstum ergibt -Infinity",
    C.growthLogPerThread({ sec: 5, growth: 0 }, 1, 1, 1) === -Infinity);

  // Der BitNode-Faktor wirkt auch hier.
  const bn = C.growthLogPerThread({ sec: 50, growth: 100 }, 1, 1, 0.2);
  pruefe("ServerGrowthRate 0,2 fuenftelt das Wachstum", nah(bn, mittel * 0.2),
    "erhalten " + bn.toExponential(6));
}

console.log("");
console.log("-- die Rechnung des Kerns ist billiger --");
{
  // Der eigentliche Zweck: drei ns-Funktionen zu je 1 GB fallen weg.
  const kern = fs.readFileSync(finde("bn4net.js"), "utf8");
  for (const f of ["ns.hackAnalyze(", "ns.hackAnalyzeChance(", "ns.growthAnalyze("]) {
    // Kommentare zaehlen nicht - der RAM-Rechner sieht sie auch nicht.
    const code = kern.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");
    pruefe("der Kern ruft " + f + " nicht mehr auf", !code.includes(f),
      "das waere 1 GB, das im Kaltstart fehlt");
  }
  pruefe("er importiert die Formeln stattdessen",
    /from "lib\/calc\.js"/.test(kern));
  pruefe("und liest den BitNode-Faktor",
    /bitnodes\.json/.test(kern), "sonst rechnet er ohne ihn - die bekannte Falle");
}

console.log("");
console.log("-- der Kern fasst die cloud-Familie nicht mehr an --");
{
  // ns.cloud.* kostet 3,85 GB: purchaseServer 2,25, getServerNames 1,05,
  // getServerCost 0,25, upgradeServer 0,25, getRamLimit 0,05. Das ist mehr
  // als ein Zehntel des Kaltstart-Budgets fuer eine Handlung, die vielleicht
  // einmal je Stunde vorkommt.
  const kern = fs.readFileSync(finde("bn4net.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
  for (const f of ["cloud.purchaseServer", "cloud.getServerNames", "cloud.getServerCost",
                   "cloud.upgradeServer", "cloud.getRamLimit", "cloud.getServerLimit",
                   "cloud.getServerUpgradeCost"]) {
    pruefe("der Kern ruft ns." + f + " nicht mehr auf", !kern.includes("ns." + f));
  }
  pruefe("er liest stattdessen die Preistabelle", /data\/preise\.json/.test(kern));
  pruefe("und stellt Auftraege", /data\/kaufauftrag\.json/.test(kern));

  // shop.js MUSS sie dafuer haben - sonst kauft niemand mehr.
  const shop = fs.readFileSync(finde("shop.js"), "utf8");
  pruefe("shop.js kauft", /ns\.cloud\.purchaseServer/.test(shop));
  pruefe("shop.js baut aus", /ns\.cloud\.upgradeServer/.test(shop));
  pruefe("shop.js schreibt die Preistabelle", /data\/preise\.json/.test(shop));
  pruefe("und meldet jedes Ergebnis zurueck", /data\/kaufergebnis\.json/.test(shop),
    "sonst wartet der Kern ewig auf einen Rechner, den es nie geben wird");
}

console.log("");
console.log("-- der Ausbaupreis ist eine Preisdifferenz --");
{
  // getServerUpgradeCost kostet 0,25 GB und liefert dasselbe wie die
  // Differenz zweier Rechnerpreise (ServerPurchases.ts). Der Kern rechnet
  // sie jetzt aus der Tabelle.
  const preise = { 64: 3.52e6, 128: 7.04e6, 256: 14.08e6 };
  const diff = (von, nach) => Math.max(0, (preise[nach] || 0) - (preise[von] || 0));
  pruefe("64 -> 128 kostet die Differenz", diff(64, 128) === 3.52e6);
  pruefe("128 -> 256 ebenso", diff(128, 256) === 7.04e6);
  pruefe("ein Rueckbau kostet nichts (nicht negativ)", diff(256, 64) === 0,
    "eine negative Zahl haette jede Pruefung 'kosten > 0' bestanden");
  pruefe("eine unbekannte Groesse ergibt 0", diff(64, 999) === 0,
    "und wird damit nicht gekauft - richtig, denn der Preis ist unbekannt");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
