// Audit 03.10.2026, Gruppe BN3/BN11: Hackertrag BN3/BN11 gegen BN2 - wie
// tools/audit/hack-knoten.mjs, aber mit dem HACKING-LEVEL, den derselbe
// Spieler im Zielknoten haette. hack-knoten.mjs rechnet mit dem BN2-Level;
// in BN11 sind HackingLevelMultiplier 0,6 (BN2 0,8) und HackExpGain 0,5
// (BitNode.tsx:883-916) - Level und damit Ziele/Chance/Tempo fallen.
//
// Level aus Exp: skill = mult * (32 * ln(exp + 534.6) - 200)
//   (PersonObjects/formulas/skill.ts:7-15, mult = mults.hacking * HackingLevelMultiplier)
// Eichung: BN2-Stand selbst (Level im Spielstand gegen Formel).
//
// Aufruf: node tools/audit/bn311-hack.mjs <BN2-backup.json.gz> [ramGb]
import { loadSave } from "./hack-save.mjs";
import { targetMetrics, hackTime } from "../../src/lib/calc.js";

const file = process.argv[2] || "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz";
const RAMGB = Number(process.argv[3] || 6745);
const { p, servers } = loadSave(file);

export const skillFrom = (exp, mult) => Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));

// Eichung Level BN2 (HackingLevelMultiplier 0,8)
const lvBN2 = skillFrom(p.exp.hacking, p.mults.hacking * 0.8);
console.log("Eichung Level BN2: Formel", lvBN2, " Spielstand", p.skills.hacking, lvBN2 === p.skills.hacking ? "OK" : "ABWEICHUNG");

// gleiche Spielzeit im Zielknoten: Exp x HackExpGain(Ziel)/HackExpGain(BN2), Mult x HLM
// (erste Naeherung: die Exp je Faden haengt an der Server-Grundschwierigkeit, nicht am Geld;
// ein niedrigerer Level verlangsamt die Faeden zusaetzlich -> Level eher noch tiefer)
const KN = {
  2: { MM: 0.08, SHM: 1, GR: 0.8, WR: 1, SSS: 1, HS: 1, HLM: 0.8, HEG: 1 },
  3: { MM: 0.04, SHM: 0.2, GR: 0.2, WR: 1, SSS: 1, HS: 1, HLM: 0.8, HEG: 1 },
  11: { MM: 0.01, SHM: 1, GR: 0.2, WR: 2, SSS: 1, HS: 1, HLM: 0.6, HEG: 0.5 },
};
const BN2 = { MM: 0.08, SSS: 1 };

function yieldFor(m, skill) {
  const pl = { skill, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
    multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
  const seg = [];
  for (const s0 of Object.values(servers)) {
    if (!s0.hasAdminRights || s0.purchasedByPlayer || !(s0.moneyMax > 0) || s0.requiredHackingSkill > pl.skill) continue;
    const base = s0.moneyMax / (25 * BN2.MM);
    const real = (s0.baseDifficulty / BN2.SSS) * m.SSS;
    const minD = Math.min(Math.max(1, Math.round(real / 3)), 100);
    const s = { ...s0, moneyMax: 25 * base * m.MM, moneyAvailable: 25 * base * m.MM, hackDifficulty: minD, minDifficulty: minD };
    const tIst = hackTime({ sec: minD, reqSkill: s.requiredHackingSkill }, pl, m.HS);
    const kz = targetMetrics(s, pl, tIst, { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: m.SHM,
      bnServerGrowthRate: m.GR, bnServerWeakenRate: m.WR, mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: 3000 });
    if (kz.steadyEff > 0) seg.push({ cap: kz.kapazitaet, eff: kz.steadyEff });
  }
  seg.sort((a, b) => b.eff - a.eff);
  let rest = RAMGB, sum = 0;
  for (const g of seg) { if (rest <= 0) break; const t = Math.min(rest, g.cap); sum += t * g.eff; rest -= t; }
  return sum;
}

const base = yieldFor(KN[2], p.skills.hacking);
console.log("Stand", file.split("_").slice(2, 4).join(" "), " Level", p.skills.hacking, " Speicher", RAMGB, "GB");
for (const bn of [2, 3, 11]) {
  const m = KN[bn];
  const lv = skillFrom(p.exp.hacking * m.HEG, p.mults.hacking * m.HLM);
  const yGleich = yieldFor(m, p.skills.hacking);
  const yLevel = yieldFor(m, lv);
  console.log(`BN${bn}: Level ${lv}  relativ zu BN2 bei BN2-Level ${(yGleich / base).toFixed(3)}  bei Knoten-Level ${(yLevel / base).toFixed(3)}`);
}
