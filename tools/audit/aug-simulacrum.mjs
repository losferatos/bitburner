// Audit 03.10.2026, Bereich AUG: Was The Blade's Simulacrum im Kampfknoten
// bringen WUERDE, wenn der Arbeitskanal neben der Bladeburner-Aktion genutzt
// wird (Gym parallel).
//
// Quellcode:
//   Bladeburner.ts:178-180  startAction beendet die Spielerarbeit nur OHNE Simulacrum
//   Bladeburner.ts:1354-1360 process bricht die Aktion nur OHNE Simulacrum ab
//   PlayerObjectBladeburnerMethods.ts:13-19  SF7.3 schenkt das Simulacrum beim Beitritt
//   Work/Formulas.ts:108-121 + Locations Powerhouse expMult 10: Gym-Exp/s = 10 * <stat>_exp-Mult
//     (ClassGymExpGain wird nicht angewandt), immer EIN Wert
//   Augmentations.ts:284-296 Simulacrum: repCost 1.250, moneyCost 1,5e11, Bladeburners
//
// Rechnung 1: Exp-Zuwachs aus Bladeburner-Aktionen gemessen (zwei Spielstaende
//   BN2.1), Gym parallel reihum ueber 4 Werte addiert. Stufen exakt (formulas/skill.ts),
//   competence-Verhaeltnis wie aug-graft.mjs (Black-Op-Gewichte).
// Rechnung 2: Wiederaufbau nach einem Einbau bis Tiefstand 100 (Gym, kein Rang)
//   je Knoten der Restroute mit dessen Kampf-Levelmultiplikator.
//
// Aufruf: node tools/audit/aug-simulacrum.mjs [--k 1.2]
import { loadSave } from "./aug-save.mjs";
import { loadAugs } from "./aug-data.mjs";
import { computeMults } from "./aug-mults.mjs";
import { competence } from "./aug-graft.mjs";

const args = process.argv.slice(2);
const k = Number(args[args.indexOf("--k") + 1]) || 1.2;
const augs = loadAugs();
const A = loadSave("backups/LIVE_197f4d61481686_BN2L1_2026-10-03T08-33_hourly.json.gz").p;
const B = loadSave("backups/LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz").p;
const STATS = ["strength", "defense", "dexterity", "agility"];
const m = computeMults(B, augs);
const dtH = (B.playtimeSinceLastAug - A.playtimeSinceLastAug) / 3.6e6;
const g = Object.fromEntries(STATS.map((s) => [s, (B.exp[s] - A.exp[s]) / dtH]));
const gym = Object.fromEntries(STATS.map((s) => [s, 10 * m[s + "_exp"] * 3600 / 4]));
console.log(`Exp/h je Wert aus Bladeburner (gemessen): ${STATS.map((s) => g[s].toFixed(0)).join("/")}`);
console.log(`Exp/h je Wert aus Gym parallel (reihum, Powerhouse): ${STATS.map((s) => gym[s].toFixed(0)).join("/")}  -> Faktor ${((g.strength + gym.strength) / g.strength).toFixed(2)}`);
const c0 = competence(B.exp, m, 2, B.skills.intelligence);
for (const H of [5, 10, 20, 40]) {
  const e1 = { ...B.exp }, e2 = { ...B.exp };
  for (const s of STATS) { e1[s] += g[s] * H; e2[s] += (g[s] + gym[s]) * H; }
  const c1 = competence(e1, m, 2, B.skills.intelligence);
  const c2 = competence(e2, m, 2, B.skills.intelligence);
  console.log(`nach ${String(H).padStart(2)} h: competence ohne Gym x${(c1 / c0).toFixed(3)}, mit Gym x${(c2 / c0).toFixed(3)}  -> Verhaeltnis x${(c2 / c1).toFixed(3)}, Rang/h x${Math.pow(c2 / c1, k).toFixed(3)} (k=${k})`);
}
// Rechnung 2: Wiederaufbau-Zeit je Knoten (Gym bis 100, ein Wert je Zeitpunkt)
console.log("\nWiederaufbau bis Tiefstand 100 nach einem Einbau (Gym, ohne Simulacrum kein Rang in dieser Zeit):");
const LVL = { 2: 1, 3: 1, 11: 1, 6: 1, 7: 1, 14: 0.5, 13: 0.7, 15: 0.7 };
for (const [bn, lm] of Object.entries(LVL)) {
  let h = 0;
  for (const s of STATS) h += (Math.exp((100 / (m[s] * lm) + 200) / 32) - 534.6) / (10 * m[s + "_exp"]) / 3600;
  console.log(`  BN${bn.padEnd(2)} Kampf-Levelmult ${lm}: ${(h * 60).toFixed(0)} min (mit Mults wie heute in BN2.1: ${m.strength.toFixed(3)})`);
}
console.log(`\nSimulacrum-Preis: Kauf 150 Mrd x 1,9^q x AugmentationMoneyCost (BN3/7/15 x3, BN11 x2, BN14 x1,5), Graft 450 Mrd, Graft-Zeit 15 min / Int-Bonus (${(15 / (1 + Math.pow(B.skills.intelligence, 0.8) / 600)).toFixed(1)} min bei Int ${B.skills.intelligence})`);
