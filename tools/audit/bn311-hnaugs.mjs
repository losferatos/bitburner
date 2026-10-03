// Audit 03.10.2026, Gruppe BN3/BN11: Was kosten die Hacknet-Augs, die der
// V2-Filter (src/lib/hackaugs.js:346-350 kampfknotenNuetzlich, mitHashes = SF9)
// in jedem V2-Knoten kauft, ueber die Preistreppe - und was bringen sie in
// BN3/BN11 (HacknetNodeMoney 0,25 / 0,1, BitNode.tsx case 3/11)?
//
// Formeln: Preis = base * 1,9^q * AugmentationMoneyCost (AugmentationHelpers.ts:32-37,155-158).
// Kaufregel des Bots (src/bn4rep.js, Kaufschleife je Runde): alle verdienten und
// bezahlbaren Stuecke, teuerste zuerst; Geld kommt in kleinen Schritten.
// Eichung: Summe der BN2.1-Warteschlange in Kaufreihenfolge gegen
// moneySourceB.augmentations (Spielstand 17:17) - exakt.
//
// Aufruf: node tools/audit/bn311-hnaugs.mjs
import { loadAugs } from "./aug-data.mjs";
import { costInOrder } from "./aug-order.mjs";
import { loadSave } from "./player-save.mjs";

const A = loadAugs();
const by = (n) => Object.values(A).find((x) => x.name === n);
const HN = new Set(["Hacknet Node CPU Architecture Neural-Upload", "Hacknet Node Cache Architecture Neural-Upload",
  "Hacknet Node NIC Architecture Neural-Upload", "Hacknet Node Kernel Direct-Neural Interface", "Hacknet Node Core Direct-Neural Interface"]);

const { player: p } = loadSave("backups/LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz");
const queue = p.queuedAugmentations.map((a) => a.name);
const msB = p.moneySourceB.data || p.moneySourceB;
const bases = queue.map((n) => by(n).moneyCost);
console.log(`EICHUNG BN2.1-Warteschlange (${queue.length} Stueck, davon Hacknet ${queue.filter((n) => HN.has(n)).length}):`
  + ` Soll ${(-msB.augmentations / 1e9).toFixed(9)} Mrd  Ist ${(costInOrder(bases, {}) / 1e9).toFixed(9)} Mrd`);
const ohne = queue.filter((n) => !HN.has(n)).map((n) => by(n).moneyCost);
console.log(`Gleiche Reihenfolge ohne Hacknet-Augs: ${(costInOrder(ohne, {}) / 1e9).toFixed(2)} Mrd -> Treppenaufschlag ${((costInOrder(bases, {}) - costInOrder(ohne, {})) / 1e9).toFixed(2)} Mrd (+${((costInOrder(bases, {}) / costInOrder(ohne, {}) - 1) * 100).toFixed(0)} %)`);

// Wirkung der drei Hacknet-Augs: Produkt der hacknet_node_money-Mults
const hnMult = queue.filter((n) => HN.has(n)).reduce((m, n) => m * (by(n).mults.hacknet_node_money || 1), 1);
console.log(`Wirkung: hacknet_node_money x${hnMult.toFixed(3)}`);
const hnRateBN2 = (msB.hacknet || 0) / (p.playtimeSinceLastBitnode / 3.6e6);
for (const [bn, hnm] of [["BN2", 1], ["BN3", 0.25], ["BN11", 0.1]]) {
  const gain = hnRateBN2 * hnm * (hnMult - 1);
  console.log(`  ${bn}: Hacknet-Einnahme ${(hnRateBN2 * hnm / 1e9).toFixed(3)} Mrd/h -> +${(gain / 1e9).toFixed(3)} Mrd/h durch die Augs`);
}

// Bot-Kaufregel simulieren: Geld steigt in Schritten, je Runde alle bezahlbaren, teuerste zuerst
function botBuys(names, budget, mm) {
  let money = 0, q = 0, spent = 0;
  const open = names.map((n) => ({ n, base: by(n).moneyCost }));
  const bought = [];
  const STEP = budget / 4000;
  while (money + spent < budget - 1e-6) {
    money += STEP;
    let again = true;
    while (again) {
      again = false;
      const afford = open.filter((o) => o.base * mm * Math.pow(1.9, q) <= money).sort((a, b) => b.base - a.base);
      if (afford.length) {
        const o = afford[0];
        const price = o.base * mm * Math.pow(1.9, q);
        money -= price; spent += price; q++;
        bought.push(o.n); open.splice(open.indexOf(o), 1); again = true;
      }
    }
  }
  return bought;
}
const kampf = (l) => l.filter((n) => !HN.has(n));
console.log("\nKaufregel des Bots mit dem BN2.1-Angebot (alle 11 als verdient angenommen):");
console.log("Knoten  Budget   mit Hacknet: Stuecke (davon Kampf)   ohne Hacknet: Kampfstuecke");
for (const [bn, mm, budgets] of [["BN2", 1, [5e9, 15e9, 28.4e9]], ["BN3", 3, [3e9, 6e9, 9e9, 20e9]], ["BN11", 2, [1e9, 1.5e9, 3e9, 6e9]]]) {
  for (const B of budgets) {
    const mit = botBuys(queue, B, mm);
    const oh = botBuys(queue.filter((n) => !HN.has(n)), B, mm);
    console.log(`${bn.padEnd(6)} ${(B / 1e9).toFixed(1).padStart(5)} Mrd   ${String(mit.length).padStart(2)} (${kampf(mit).length})`.padEnd(40)
      + `   ${oh.length}   neu: ${oh.filter((n) => !mit.includes(n)).join(", ") || "-"}`);
  }
}
