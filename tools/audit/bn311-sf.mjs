// Audit 03.10.2026, Gruppe BN3/BN11: Was bringt SF11 (Preistreppe) der
// Restroute, und was kostet BN3 (AugmentationMoneyCost 3) ohne/mit SF11?
//
// Formeln (wortgleich):
//   Treppe   1,9 * [1; 0,96; 0,94; 0,93][SF11]   (Augmentation/AugmentationHelpers.ts:29-31)
//   Preis    baseCost * Treppe^q * AugmentationMoneyCost   (AugmentationHelpers.ts:32-37,155-158)
//   q = Zahl der schon wartenden Stuecke (NFG je Stufe)
// Eichung: Kaufsumme der 4 Stuecke BN2.1 (Wired Reflexes -> Neurotrainer I ->
//   EsperTech -> EMS-4) gegen moneySourceA.augmentations im Spielstand 09:59.
//
// Aufruf: node tools/audit/bn311-sf.mjs
import { loadAugs } from "./aug-data.mjs";
import { costInOrder, queueMult } from "./aug-order.mjs";
import { loadSave } from "./player-save.mjs";

const A = loadAugs();
const byName = (n) => Object.values(A).find((x) => x.name === n);

// --- Eichung ---------------------------------------------------------------
const { player } = loadSave("backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
const msA = player.moneySourceA.data || player.moneySourceA;
const four = ["Wired Reflexes", "Neurotrainer I", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination"].map((n) => byName(n).moneyCost);
console.log(`EICHUNG Kaufsumme BN2.1: Soll (moneySourceA.augmentations) ${(-msA.augmentations).toFixed(0)}  Ist ${costInOrder(four, { sf11: 0 }).toFixed(0)}`);

console.log("\nTreppe je SF11-Stufe:", [0, 1, 2, 3].map((s) => `SF11.${s} ${queueMult(s).toFixed(4)}`).join("  "));

// --- Bladeburner-Augs (V2-Kern), teuerste zuerst wie bn4rep je Runde ---------
const bb = Object.values(A).filter((x) => x.factions && x.factions.includes("Bladeburners") && x.name !== "The Blade's Simulacrum")
  .map((x) => x.moneyCost).sort((a, b) => b - a);
console.log(`\nBladeburner-Augs ohne Simulacrum: ${bb.length} Stueck, Grundpreis-Summe ${(bb.reduce((s, v) => s + v, 0) / 1e9).toFixed(2)} Mrd`);

console.log("\nKosten eines Einbauzyklus mit n Stuecken (die n teuersten BB-Augs, teuerste zuerst), Mrd $:");
console.log("n    BN2/6/13/14(x1)  SF11.0 -> SF11.3   |  BN3 (x3) SF11.0  SF11.3   | BN11 (x2) .1 (SF0)  .2 (SF1)  .3 (SF2)");
for (const n of [3, 5, 8, 12]) {
  const sel = bb.slice(0, n);
  const c = (s, mm) => costInOrder(sel, { sf11: s, moneyMult: mm }) / 1e9;
  console.log(`${String(n).padEnd(4)} ${c(0, 1).toFixed(1).padStart(10)} -> ${c(3, 1).toFixed(1).padStart(7)} (${((c(3, 1) / c(0, 1) - 1) * 100).toFixed(0)} %)`
    + `   |  ${c(0, 3).toFixed(1).padStart(10)}  ${c(3, 3).toFixed(1).padStart(7)}   | ${c(0, 2).toFixed(1).padStart(12)} ${c(1, 2).toFixed(1).padStart(9)} ${c(2, 2).toFixed(1).padStart(9)}`);
}

// --- NFG-Schleife vor dem Einbau: Stufen je Budget -----------------------------
console.log("\nWie viele Stuecke kauft ein festes Budget (billigste BB-Augs zuerst, Zyklus ab q=0)?");
const asc = [...bb].sort((a, b) => a - b);
function howMany(budget, mm, s) {
  // in der Kaufreihenfolge des Bots je Runde teuerste zuerst; hier obere Schranke: billigste Menge, teuerste zuerst gekauft
  let best = 0;
  for (let n = 1; n <= asc.length; n++) {
    const sel = asc.slice(0, n).sort((a, b) => b - a);
    if (costInOrder(sel, { sf11: s, moneyMult: mm }) <= budget) best = n; else break;
  }
  return best;
}
for (const budget of [2e9, 5e9, 10e9, 30e9]) {
  console.log(`  Budget ${(budget / 1e9).toFixed(0).padStart(3)} Mrd:  BN2 ${howMany(budget, 1, 0)}  | BN3 SF11.0 ${howMany(budget, 3, 0)}  BN3 SF11.3 ${howMany(budget, 3, 3)}  | BN11.1 ${howMany(budget, 2, 0)}  BN11.3 ${howMany(budget, 2, 2)}`);
}
