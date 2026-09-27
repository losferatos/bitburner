/**
 * H1 (Audit 26.09.2026, bn12-bericht SHOULD-FIX #1) - ServerWeakenRate wurde
 * ueberall ignoriert (WEAKEN_POWER/SERVER_WEAKEN_AMOUNT fest 0.05). Das Spiel
 * multipliziert die Rate mit ein (ServerHelpers.ts:322). In BN12 ist sie < 1
 * (0,9804/0,9612/0,9423 auf den drei Stufen) - jeder weaken-Faden senkt die
 * Sicherheit WENIGER, jede Vorbereitung war also mit zu wenigen Faeden/zu
 * kurzen Wellen gerechnet.
 *
 * Aufruf: node tools/test-h1-weakenrate.js
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else { rot++; fehler.push(name + (hinweis ? " - " + hinweis : "")); console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
}

console.log("");
console.log("=== H1 - ServerWeakenRate (BN12) in Vorbereitung, Mischung, Stapeltakt ===");

const C = await import(pathToFileURL(path.join(ROOT, "src", "lib", "calc.js")).href);

// Echte BN12-Stufen aus src/lib/bitnodes.json (knotenLevel."12".1/2/3.ServerWeakenRate).
const BN5_RATE = 1;               // Vorgabe, kein Eintrag in bitnodes.json
const BN12_1 = 0.9803921568627451;
const BN12_2 = 0.9611687812379854;
const BN12_3 = 0.9423223345470444; // "bn12-bericht", die Stufe, die die Route ansteuert

console.log("");
console.log("-- weakenThreads: RED auf dem alten Stand (fehlender dritter Parameter) --");
// Function.length zaehlt NICHT Parameter mit Vorgabewert - deshalb ueber den
// Aufruf pruefen, nicht ueber die Signaturlaenge (die bliebe bei "1", ob der
// dritte Parameter existiert oder nicht).
pruefe("weakenThreads nimmt einen dritten Parameter bnWeakenRate entgegen und wirkt",
  C.weakenThreads(100, 1, 0.5) === 2 * C.weakenThreads(100, 1, 1),
  "halbe Rate muss doppelt so viele Faeden brauchen - sonst wird der Parameter ignoriert");
pruefe("BN5 (Rate 1): weakenThreads unveraendert gegen die alte Formel",
  C.weakenThreads(100, 1, BN5_RATE) === Math.ceil(100 / 0.05));
pruefe("BN12.3 (Rate 0,9423): mehr Faeden als bei Rate 1 fuer dieselbe Sicherheitssenkung",
  C.weakenThreads(100, 1, BN12_3) > C.weakenThreads(100, 1, BN5_RATE),
  "BN12.3=" + C.weakenThreads(100, 1, BN12_3) + " BN5=" + C.weakenThreads(100, 1, BN5_RATE));
pruefe("BN12.3 exakt: ceil(100/(0.05*0.9423223345470444)) = 2123",
  C.weakenThreads(100, 1, BN12_3) === Math.ceil(100 / (0.05 * BN12_3)));
pruefe("kein bnWeakenRate (alter Aufrufstil) faellt auf Vorgabe 1 zurueck",
  C.weakenThreads(100, 1) === C.weakenThreads(100, 1, 1));

console.log("");
console.log("-- targetMetrics: prepSec und wphMin steigen mit sinkender Rate --");
{
  const SP = { skill: 3000, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
  // Sicherheit 100 -> min 60, kleines Anlaufbudget (500 GB je Welle) - so
  // erzwingt die Vorbereitung mehrere Wellen, deren ZAHL sich mit der Rate
  // aendert (bei einem zu grossen Budget passt beides in eine einzige Welle,
  // und der Unterschied verschwindet in der Aufrundung).
  const S = { hackDifficulty: 100, minDifficulty: 60, requiredHackingSkill: 500, serverGrowth: 60,
    moneyMax: 8e9, moneyAvailable: 7.9e9, hasAdminRights: true };
  const cfgBase = { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
    mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: 500 };
  const tIst = C.hackTime({ reqSkill: 500, sec: 100 }, SP);

  const kzBn5 = C.targetMetrics(S, SP, tIst, { ...cfgBase, bnServerWeakenRate: BN5_RATE });
  const kzBn12_3 = C.targetMetrics(S, SP, tIst, { ...cfgBase, bnServerWeakenRate: BN12_3 });
  const kzOhneFeld = C.targetMetrics(S, SP, tIst, cfgBase); // kein bnServerWeakenRate im cfg

  pruefe("BN5 (Rate 1) und 'kein Feld gesetzt' rechnen identisch (Vorgabe 1)",
    kzBn5.prepSec === kzOhneFeld.prepSec && kzBn5.steadyEff === kzOhneFeld.steadyEff);
  pruefe("BN12.3: prepSec steigt gegenueber BN5 (mehr Wellen fuer dieselbe Sicherheitssenkung)",
    kzBn12_3.prepSec > kzBn5.prepSec,
    "BN12.3=" + kzBn12_3.prepSec.toFixed(1) + " BN5=" + kzBn5.prepSec.toFixed(1));
  // wphMin ist intern (nicht Teil des Rueckgabeobjekts) - sein Anstieg zeigt
  // sich in steadyEff (mehr Ausgleichsaufwand je hack-Faden im Dauerbetrieb)
  // und in kapazitaet (mehr GB*s je Beuteanteil).
  pruefe("BN12.3: steadyEff sinkt gegenueber BN5 (mehr Ausgleichsaufwand je hack-Faden)",
    kzBn12_3.steadyEff < kzBn5.steadyEff,
    "BN12.3=" + kzBn12_3.steadyEff.toFixed(2) + " BN5=" + kzBn5.steadyEff.toFixed(2));
  pruefe("BN12.3: kapazitaet steigt gegenueber BN5 (mehr GB*s je Beuteanteil)",
    kzBn12_3.kapazitaet > kzBn5.kapazitaet,
    "BN12.3=" + kzBn12_3.kapazitaet.toFixed(1) + " BN5=" + kzBn5.kapazitaet.toFixed(1));
}

console.log("");
console.log("-- batchThroughput/stapelPlan: BN12.3 braucht mehr Ausgleichs-Faeden --");
{
  const SP = { skill: 3000, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
  const S = { hackDifficulty: 60, minDifficulty: 60, requiredHackingSkill: 500, serverGrowth: 60,
    moneyMax: 8e9, moneyAvailable: 7.9e9, hasAdminRights: true };
  const cfg = { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
    mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: 6000, bnServerWeakenRate: BN12_3 };
  const tIst = C.hackTime({ reqSkill: 500, sec: 60 }, SP);
  const kzBn5 = C.targetMetrics(S, SP, tIst, { ...cfg, bnServerWeakenRate: BN5_RATE });
  const kzBn12 = C.targetMetrics(S, SP, tIst, cfg);
  const costs = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
  const planBn5 = C.stapelPlan(0.1, kzBn5, S.moneyMax, costs, BN5_RATE);
  const planBn12 = C.stapelPlan(0.1, kzBn12, S.moneyMax, costs, BN12_3);
  pruefe("BN12.3: w1+w2 (weaken-Ausgleich je Stapel) groesser als bei BN5",
    (planBn12.w1 + planBn12.w2) > (planBn5.w1 + planBn5.w2),
    "BN12.3=" + (planBn12.w1 + planBn12.w2) + " BN5=" + (planBn5.w1 + planBn5.w2));
  pruefe("stapelPlan ohne bnWeakenRate (alter Aufrufstil) faellt auf Vorgabe 1 zurueck",
    JSON.stringify(C.stapelPlan(0.1, kzBn5, S.moneyMax, costs))
    === JSON.stringify(C.stapelPlan(0.1, kzBn5, S.moneyMax, costs, 1)));

  const btBn5 = C.batchThroughput(kzBn5, S.moneyMax, 20000, costs, BN5_RATE);
  const btBn12 = C.batchThroughput(kzBn12, S.moneyMax, 20000, costs, BN12_3);
  pruefe("batchThroughput: BN12.3 braucht mehr RAM je Stapel als BN5 bei gleichem f",
    btBn12.ram >= btBn5.ram, "BN12.3=" + btBn12.ram + " BN5=" + btBn5.ram);
}

console.log("");
console.log("-- bn4net.js: liest ServerWeakenRate level-aware aus lib/bitnodes.json --");
{
  const quelle = await (await import("node:fs")).promises.readFile(
    path.join(ROOT, "src", "bn4net.js"), "utf8");
  pruefe("bn4net.js deklariert bnServerWeakenRate", /let bnServerWeakenRate = 1;/.test(quelle));
  pruefe("bn4net.js liest k.ServerWeakenRate (dieselbe Stelle wie ScriptHackMoney/ServerGrowthRate)",
    /if \(Number\.isFinite\(k\.ServerWeakenRate\)\) bnServerWeakenRate = k\.ServerWeakenRate;/.test(quelle));
  pruefe("WEAKEN_POWER wird EINMAL aus bnServerWeakenRate gebildet (wirkt in Vorbereitung, Mischung, Stapeltakt)",
    /const WEAKEN_POWER = 0\.05 \* bnServerWeakenRate;/.test(quelle));
  pruefe("kennzahlen() reicht bnServerWeakenRate an targetMetrics durch",
    /bnScriptHackMoney, bnServerGrowthRate, bnServerWeakenRate,/.test(quelle));
  pruefe("die Stapelziel-Auswahl (B5) reicht bnServerWeakenRate an batchThroughput durch",
    /batchThroughput\(\s*\{[^}]*\},\s*c\.moneyMax, ramTotal, \{[^}]*\}, bnServerWeakenRate\);/s.test(quelle));
  // Keine zweite, unabhaengige Konstante - sonst laueft dieselbe Falle wie
  // bei B5s F_LEITER/GAP_MS wieder auseinander.
  const treffer = quelle.match(/const WEAKEN_POWER = /g) || [];
  pruefe("WEAKEN_POWER wird nur an EINER Stelle definiert (kein Auseinanderlaufen)", treffer.length === 1,
    treffer.length + " Definitionen gefunden");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
