/**
 * B5-Skeptiker, Einwand 2b (27.09.2026) - die Hysterese haelt der
 * Kalenderleiter nicht stand.
 *
 * BEFUND. batchThroughput waehlte die kleinste F_LEITER-Sprosse, deren
 * voller Kalender den Netzanteil erreicht - eine Stufenfunktion. An der
 * Sprossengrenze kann ein einziger Levelaufstieg (wenige Millisekunden
 * hackTimeMin) kalenderPlaetze um 1 verschieben und damit die gewaehlte
 * Sprosse springen lassen: gemessen bis zu Faktor 2,5 in perS (F_LEITER 0.02
 * gegen 0.05). ZIELWAHL.bonusBatch (1,3) haelt das nicht auf - ein
 * amtierendes Stapelziel waere durch einen einzigen Levelpunkt verdraengbar
 * gewesen und beim naechsten Levelpunkt zurueckgetauscht: Flattern im
 * unbeaufsichtigten Betrieb.
 *
 * FIX. batchThroughput interpoliert perS jetzt linear zwischen den zwei
 * Sprossen, zwischen denen der Netzanteil tatsaechlich liegt, und rechnet
 * die Kalenderplaetze dafuer UNGERUNDET (slotsCont) - sonst waere schon die
 * Rundung selbst bei kleinen Platzzahlen ein Sprung gewesen (1 -> 2 Plaetze
 * sind +100 %). Die diskreten Felder (fraction/ram/ramCeiling), die den
 * Kerntakt widerspiegeln, bleiben unveraendert ganzzahlig.
 *
 * Aufruf: node tools/test-b5-flattern.js
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
console.log("=== B5-Skeptiker 2b - keine Sprossen-Sprünge über ZIELWAHL.bonusBatch hinaus ===");

const C = await import(pathToFileURL(path.join(ROOT, "src", "lib", "calc.js")).href);

const SP = { skill: 3000, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
const RAM_TOTAL = 20000;
const CFG = { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 0.15, bnServerGrowthRate: 1,
  mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1.0, moneyLow: 0.75, prepRamGb: RAM_TOTAL * 0.3 };
const COSTS = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
const BONUS_BATCH = 1.3; // ZIELWAHL.bonusBatch, bn4net.js

// Genau die Sprossengrenze aus der Skeptikerpruefung: ein Ziel, dessen
// Kalenderplaetze bei hackTimeMin=5.199s bei 12 stehen (Sprosse 0.05) und bei
// 5.200s auf 13 springen (Sprosse 0.02 reicht dann allein schon).
const S_GRENZE = { hackDifficulty: 40, minDifficulty: 40, requiredHackingSkill: 300, serverGrowth: 50,
  moneyMax: 5e9, moneyAvailable: 4.9e9, hasAdminRights: true };

function perSBei(hackTimeMin) {
  const kz = C.targetMetrics(S_GRENZE, SP, hackTimeMin, CFG);
  const bt = C.batchThroughput(kz, S_GRENZE.moneyMax, RAM_TOTAL, COSTS);
  return bt.perS;
}

console.log("");
console.log("-- die belegte Sprossengrenze: ein Levelpunkt darf keinen 2,5x-Sprung mehr geben --");
{
  const vor = perSBei(5.199);
  const nach = perSBei(5.200);
  const sprung = Math.max(vor / nach, nach / vor);
  pruefe("Sprung an der Sprossengrenze bleibt unter ZIELWAHL.bonusBatch (1,3)", sprung < BONUS_BATCH,
    "vor=" + vor.toExponential(4) + " nach=" + nach.toExponential(4) + " Faktor=" + sprung.toFixed(3));
  pruefe("...und liegt in Wirklichkeit im niedrigen Prozentbereich (< 1,1x), nicht nur knapp unter 1,3x",
    sprung < 1.1, "Faktor=" + sprung.toFixed(4));
}

console.log("");
console.log("-- Flatter-Simulation: amtierendes Ziel wird an der Grenze nicht mehr verdraengt --");
{
  // 'lang' amtiert bei hackTimeMin=5.199s (12 Plaetze), 'kurz' ist ein
  // Herausforderer mit konstant niedrigerem, ungefaehr gleich bleibendem
  // Durchsatz (z. B. ein zweites Ziel derselben Groessenordnung). Ein
  // Levelaufstieg verschiebt 'lang' auf 5.200s (13 Plaetze) - VOR dem Fix
  // sprang sein perS dabei um Faktor 2,5 nach UNTEN, was einen fast
  // gleichwertigen Herausforderer ploetzlich ueber den amtierenden Bonus
  // gehoben haette; NACH dem Fix bleibt der amtierende Bonus stabil genug.
  const perSVorLevel = perSBei(5.199);
  const perSNachLevel = perSBei(5.200);
  const herausforderer = perSVorLevel / 1.15; // 15 % schwaecher, haette den alten Sprung locker ausgenutzt
  const amtierendVorLevelScore = perSVorLevel * BONUS_BATCH;
  const amtierendNachLevelScore = perSNachLevel * BONUS_BATCH;
  pruefe("vor dem Levelaufstieg: 'lang' haelt seinen Platz gegen den Herausforderer",
    amtierendVorLevelScore > herausforderer);
  pruefe("nach dem Levelaufstieg (derselbe Herausforderer): 'lang' haelt seinen Platz weiterhin",
    amtierendNachLevelScore > herausforderer,
    "amtierend(neu)=" + amtierendNachLevelScore.toExponential(3) + " Herausforderer=" + herausforderer.toExponential(3));
}

console.log("");
console.log("-- Sonderfall: sehr wenige Kalenderplaetze (1 -> 2) - allein die Rundung darf nicht springen --");
{
  // slots=1 knapp unter der Grenze zu slots=2. Ohne slotsCont (ungerundete
  // Platzzahl) blieb hier ein Sprung von Faktor 1,92 stehen, obwohl die
  // Sprossenwahl selbst (F_LEITER-Interpolation) schon griff.
  const S_KLEIN = { hackDifficulty: 40, minDifficulty: 40, requiredHackingSkill: 300, serverGrowth: 50,
    moneyMax: 5e9, moneyAvailable: 4.9e9, hasAdminRights: true };
  const vor = (() => {
    const kz = C.targetMetrics(S_KLEIN, SP, 0.799, CFG);
    return C.batchThroughput(kz, S_KLEIN.moneyMax, RAM_TOTAL, COSTS);
  })();
  const nach = (() => {
    const kz = C.targetMetrics(S_KLEIN, SP, 0.800, CFG);
    return C.batchThroughput(kz, S_KLEIN.moneyMax, RAM_TOTAL, COSTS);
  })();
  pruefe("kalenderPlaetze springt hier tatsaechlich 1 -> 2 (Vorbedingung des Falls)",
    vor.kalenderPlaetze === 1 && nach.kalenderPlaetze === 2,
    "vor=" + vor.kalenderPlaetze + " nach=" + nach.kalenderPlaetze);
  const sprung = Math.max(vor.perS / nach.perS, nach.perS / vor.perS);
  pruefe("trotzdem bleibt der perS-Sprung unter ZIELWAHL.bonusBatch (1,3)", sprung < BONUS_BATCH,
    "vor=" + vor.perS.toExponential(4) + " nach=" + nach.perS.toExponential(4) + " Faktor=" + sprung.toFixed(3));
}

console.log("");
console.log("-- Weiter geltende Eigenschaften (keine Regression) --");
{
  // A: wenige Kalenderplaetze, B: viele - B muss weiterhin klar vorn liegen
  // (B5s Kernaussage), auch mit der Glaettung.
  const A = { hackDifficulty: 5, minDifficulty: 5, requiredHackingSkill: 10, serverGrowth: 30,
    moneyMax: 2e7, moneyAvailable: 1.9e7, hasAdminRights: true };
  const B = { hackDifficulty: 60, minDifficulty: 60, requiredHackingSkill: 500, serverGrowth: 60,
    moneyMax: 8e9, moneyAvailable: 7.9e9, hasAdminRights: true };
  const kzA = C.targetMetrics(A, SP, C.hackTime({ reqSkill: 10, sec: 5 }, SP), CFG);
  const kzB = C.targetMetrics(B, SP, C.hackTime({ reqSkill: 500, sec: 60 }, SP), CFG);
  const btA = C.batchThroughput(kzA, A.moneyMax, RAM_TOTAL, COSTS);
  const btB = C.batchThroughput(kzB, B.moneyMax, RAM_TOTAL, COSTS);
  pruefe("B (viele Kalenderplaetze) liegt weiterhin klar vor A (wenige) - B5 bleibt wirksam",
    btB.perS > 5 * btA.perS, "A=" + btA.perS.toExponential(3) + " B=" + btB.perS.toExponential(3));
  // Ein Ziel, das schon deutlich (>1.3x) besser ist, MUSS weiterhin gewinnen
  // koennen - die Glaettung darf keine echte Verbesserung verschlucken.
  pruefe("ein wirklich (>1,3x) besseres Ziel gewinnt weiterhin gegen den Bonus",
    btB.perS > btA.perS * BONUS_BATCH);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
