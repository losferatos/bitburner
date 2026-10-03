// Audit 03.10.2026, Bereich AUG: Kaufreihenfolge und Preis-Treppe.
//
// Formel (reference/bitburner-src/src/Augmentation/AugmentationHelpers.ts):
//   :29-31  base = 1,9 * [1, 0.96, 0.94, 0.93][SF11-Stufe]
//   :32-37  Faktor = base ^ (Zahl wartender Nicht-SoA-Stuecke)
//   :133-139 NFG: 750e3 * 1,14^Stufe * AugmentationMoneyCost * Faktor
//   :156-158 sonst: baseCost * Faktor * AugmentationMoneyCost
// Kauf haengt das Stueck an die Warteschlange (FactionHelpers.tsx:118-120),
// jeder weitere Kauf zahlt also den Faktor der schon wartenden.
//
// Eichung: (1) Summe der tatsaechlich gezahlten Preise in Kaufreihenfolge
// gegen moneySourceA.augmentations im Spielstand; (2) Preis des Simulacrum
// bei 4 wartenden gegen data/bn4rep.json "teuerstesVerdiente".
//
// Aufruf: node tools/audit/aug-order.mjs [save.json.gz]
import { loadSave, homeFiles } from "./aug-save.mjs";
import { loadAugs } from "./aug-data.mjs";

export function queueMult(sf11 = 0) {
  return 1.9 * [1, 0.96, 0.94, 0.93][sf11];
}

/** Summe, wenn in gegebener Reihenfolge gekauft wird (q0 = schon wartende). */
export function costInOrder(bases, { moneyMult = 1, sf11 = 0, q0 = 0 } = {}) {
  const g = queueMult(sf11);
  return bases.reduce((s, b, i) => s + b * moneyMult * Math.pow(g, q0 + i), 0);
}

/** NFG-Stufen, die mit `budget` noch kaufbar sind (Geld als einzige Grenze). */
export function nfgLevelsFor(budget, { level0, q0, moneyMult = 1, sf11 = 0 }) {
  const g = queueMult(sf11);
  let n = 0, spent = 0;
  for (;;) {
    const p = 750e3 * Math.pow(1.14, level0 + n) * moneyMult * Math.pow(g, q0 + n);
    if (spent + p > budget) return { n, spent, next: p };
    spent += p;
    n++;
  }
}

if (process.argv[1] && process.argv[1].endsWith("aug-order.mjs")) {
  const f = process.argv[2] || "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
  const { p, servers } = loadSave(f);
  const augs = loadAugs();
  const sf = Object.fromEntries((p.sourceFiles && p.sourceFiles.data) || []);
  // BN2: AugmentationMoneyCost 1 (BitNode.tsx:569-591, kein Eintrag)
  const moneyMult = 1;
  const q = (p.queuedAugmentations || []).map((a) => a.name);
  const bases = q.map((n) => augs[n].moneyCost);
  const ms = p.moneySourceA && (p.moneySourceA.data || p.moneySourceA);
  const paidSoll = -(ms ? ms.augmentations : NaN);
  const paidIst = costInOrder(bases, { moneyMult, sf11: sf[11] || 0 });
  console.log("Spielstand:", f.split(/[\\/]/).pop());
  console.log("Warteschlange (Kaufreihenfolge):", q.join(" | "));
  console.log("Grundpreise:", bases.map((b) => (b / 1e6).toFixed(1) + "M").join(", "));
  console.log(`EICHUNG 1  gezahlt laut moneySourceA: ${(paidSoll / 1e9).toFixed(6)} Mrd   nachgerechnet: ${(paidIst / 1e9).toFixed(6)} Mrd   Abw ${(paidIst / paidSoll - 1).toExponential(2)}`);
  const sorted = bases.slice().sort((a, b) => b - a);
  const best = costInOrder(sorted, { moneyMult });
  console.log(`Optimal (teuerste zuerst): ${(best / 1e9).toFixed(3)} Mrd  -> Mehrkosten ${((paidIst - best) / 1e9).toFixed(3)} Mrd (x${(paidIst / best).toFixed(2)})`);
  // Simulacrum
  const sim = augs["The Blade's Simulacrum"].moneyCost;
  const simNow = sim * moneyMult * Math.pow(queueMult(sf[11] || 0), q.length);
  let teuerst = null;
  try {
    const bn = JSON.parse(homeFiles(servers)["data/bn4rep.json"]);
    teuerst = bn.teuerstesVerdiente;
  } catch { teuerst = null; }
  console.log(`EICHUNG 2  Simulacrum bei q=${q.length}: nachgerechnet ${(simNow / 1e9).toFixed(3)} Mrd   bn4rep.json teuerstesVerdiente ${teuerst ? (teuerst / 1e9).toFixed(3) + " Mrd" : "-"}   Abw ${teuerst ? (simNow / teuerst - 1).toExponential(2) : "-"}`);
  console.log(`Simulacrum bei leerer Warteschlange: ${(sim / 1e9).toFixed(1)} Mrd, als erstes vor den ${q.length} Stuecken gekauft: Rest kostet dann ${(costInOrder(sorted, { moneyMult, q0: 1 }) / 1e9).toFixed(3)} Mrd`);
  // NFG mit dem Restgeld, tatsaechlich gegen optimal
  const nfgLevel = (p.augmentations.find((a) => a.name === "NeuroFlux Governor") || { level: 0 }).level;
  const budgetIst = p.money;
  const a = nfgLevelsFor(budgetIst, { level0: nfgLevel, q0: q.length, moneyMult });
  const b = nfgLevelsFor(budgetIst + (paidIst - best), { level0: nfgLevel, q0: q.length, moneyMult });
  console.log(`NFG vor dem Einbau mit ${(budgetIst / 1e9).toFixed(2)} Mrd: ${a.n} Stufen (naechste ${(a.next / 1e9).toFixed(2)} Mrd); mit der ersparten Differenz: ${b.n} Stufen`);
  const c = nfgLevelsFor(budgetIst + paidIst, { level0: nfgLevel, q0: 0, moneyMult });
  console.log(`Gegenprobe ohne die 4 Kleinstuecke (Geld ganz in NFG): ${c.n} Stufen`);
}
