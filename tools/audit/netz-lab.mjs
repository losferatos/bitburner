// Audit 03.10.2026, Bereich NETZ: Ist das DarkNet-Labyrinth (V1b in BN15) ueberhaupt
// erreichbar? Jedes Labor verlangt einen Charisma-Wert (DarkNet/effects/labyrinth.ts:37-107),
// The Red Pill liegt in BN15 im fuenften Labor (EternalLab, cha 3000; :419-422, :449-452).
//
// Teil 1  Eichung der Skill-Formel calculateSkill (PersonObjects/formulas/skill.ts:7-15)
//         gegen die sieben Werte im Spielstand (exp, mults, BN-Level-Mults).
// Teil 2  Benoetigte Charisma-Erfahrung je Labor bei BN15 CharismaLevelMultiplier 1,1
//         (BitNode.tsx:1094) und verschiedenen Aug-Mults; Obergrenze des Aug-Mults aus dem
//         Katalog (fakt-augs.mjs). Erfahrungsquelle Phishing (phishing.ts:12-68).
//
// Aufruf: node tools/audit/netz-lab.mjs [muster]
import { loadSave, pickFile } from "./netz-save.mjs";
import { loadAugs } from "./fakt-augs.mjs";
import path from "node:path";

const calcSkill = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
// Umkehrung (skill.ts:20-24 calculateExp): exp = e^((skill/mult + 200)/32) - 534,6
const calcExp = (skill, mult) => Math.exp((skill / mult + 200) / 32) - 534.6;

// BN-Level-Mults der Stats (BitNode.tsx), nur die hier gebrauchten Knoten
const LVL = {
  2: { hacking: 0.8, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1, intelligence: 1 },
  12: null, // dynamisch, nicht benutzt
};

const file = pickFile(process.argv[2] || "BN2L1_2026-10-03T17-17");
const { player: p } = loadSave(file);
console.log("Stand:", path.basename(file), " BN" + p.bitNodeN);

// ---- Teil 1: Eichung
const bn = LVL[p.bitNodeN];
if (bn) {
  let ok = 0, n = 0;
  for (const s of ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]) {
    // Spieler-Mult = mults[s] (Augs/SF/Exploits) x BN-Level-Mult (PlayerObject updateSkillLevels)
    const soll = p.skills[s];
    const ist = calcSkill(p.exp[s], p.mults[s] * bn[s]);
    n++;
    if (ist === soll) ok++;
    console.log(`  ${s.padEnd(9)} exp ${p.exp[s].toExponential(4)} mult ${(p.mults[s] * bn[s]).toFixed(5)} -> Formel ${ist}, Spielstand ${soll}${ist === soll ? "" : "  ABWEICHUNG"}`);
  }
  console.log(`  Eichung calculateSkill: ${ok}/${n} exakt`);
}

// ---- Teil 2: Labor-Schwellen in BN15
const LABS = [["NormalLab (Broken Wings)", 300], ["CruelLab (Boots)", 600], ["MercilessLab (Hammer)", 1500],
  ["UberLab (Staff)", 2500], ["EternalLab (BN15: Red Pill)", 3000]];
const augs = loadAugs();
const chaAugs = Object.values(augs).filter((a) => a.mults.charisma && a.mults.charisma > 1);
const prodAll = chaAugs.reduce((s, a) => s * a.mults.charisma, 1);
const prodBuyable = chaAugs.filter((a) => !a.isSpecial && a.factions.length).reduce((s, a) => s * a.mults.charisma, 1);
console.log(`\nCharisma-Augs im Katalog: ${chaAugs.length}, Produkt aller ${prodAll.toFixed(2)}, davon kaeuflich (nicht speziell, mit Faktion) ${prodBuyable.toFixed(2)}`);
console.log("  " + chaAugs.map((a) => a.name + " x" + a.mults.charisma).join(", "));
const BN15_CHA = 1.1;
const SF_EXPLOIT = p.mults.charisma; // heutiger Grundmult (SF1.3, Exploits, 1 NFG-Stufe) als Untergrenze
console.log(`\nBenoetigte Charisma-Erfahrung in BN15 (CharismaLevelMultiplier ${BN15_CHA}); Aug-Mult x Grundmult ${SF_EXPLOIT.toFixed(3)}:`);
const mults = [1, 2, 4, Math.min(prodBuyable, 50)];
console.log("  Labor".padEnd(34) + mults.map((m) => ("Augs x" + m.toFixed(1)).padStart(14)).join(""));
for (const [name, cha] of LABS) {
  console.log("  " + name.padEnd(32) + mults.map((m) => calcExp(cha, BN15_CHA * SF_EXPLOIT * m).toExponential(1).padStart(14)).join(""));
}
// Phishing als Erfahrungsquelle (phishing.ts:12-68): je Versuch threads*50*charisma_exp bei Erfolg,
// /4 bei Fehlschlag; Versuch alle max(10000*400/(400+cha), 200) ms.
function phishXpPerH(threads, cha, chaExpMult, pMoney) {
  const waitS = Math.max(10000 * (400 / (400 + cha)), 200) / 1000;
  const perTry = threads * 50 * chaExpMult * (pMoney + (1 - pMoney) / 4);
  return (3600 / waitS) * perTry;
}
for (const thr of [4, 100, 1000]) {
  console.log(`  Phishing ${String(thr).padStart(4)} Faeden bei cha 600: ~${phishXpPerH(thr, 600, p.mults.charisma_exp, 0.1).toExponential(2)} exp/h`);
}
