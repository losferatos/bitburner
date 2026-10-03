// Audit 03.10.2026, Bereich HACK: Wie stark tragen die BitNode-Multiplikatoren
// der Restroute die Hacking-Einnahme? Gleicher Spieler (BN2-Stand), gleiche
// Server-Grundwerte, gleicher Speicher - nur die Knotenwerte wechseln.
// Grundwerte aus dem BN2-Stand zurueckgerechnet (Server.ts:74-83):
//   moneyMax = 25*base*ServerMaxMoney, hackDifficulty0 = base*SSS (max 100),
//   minDifficulty = max(1, round(base*SSS/3)).
// Multiplikatoren: BitNode.tsx:569-1116 (nachgeschlagen, src/lib/bitnodes.json
// stimmt fuer diese Knoten ueberein). HackingSpeedMultiplier geht in die
// Laufzeit (Hacking.ts:73-77) und damit in $/GB*s.
// Aufruf: node tools/audit/hack-knoten.mjs <BN2-backup.json.gz> [ramGb]
import { loadSave } from "./hack-save.mjs";
import { targetMetrics, hackTime } from "../../src/lib/calc.js";
const { p, servers } = loadSave(process.argv[2]);
const RAMGB = Number(process.argv[3] || 6745);
const pl = { skill: p.skills.hacking, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
  multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
const BN2 = { MM: 0.08, SSS: 1 };
const KN = {
  2: { MM: 0.08, SHM: 1, GR: 0.8, WR: 1, SSS: 1, HS: 1 },
  3: { MM: 0.04, SHM: 0.2, GR: 0.2, WR: 1, SSS: 1, HS: 1 },
  11: { MM: 0.01, SHM: 1, GR: 0.2, WR: 2, SSS: 1, HS: 1 },
  6: { MM: 0.2, SHM: 0.75, GR: 1, WR: 1, SSS: 1.5, HS: 1 },
  7: { MM: 0.2, SHM: 0.5, GR: 1, WR: 1, SSS: 1.5, HS: 1 },
  14: { MM: 0.7, SHM: 0.3, GR: 1, WR: 1, SSS: 1.5, HS: 0.3 },
  13: { MM: 0.3375, SHM: 0.2, GR: 1, WR: 1, SSS: 3, HS: 1 },
  15: { MM: 0.8, SHM: 1, GR: 1, WR: 1, SSS: 1.5, HS: 0.6 },
  8: { MM: 1, SHM: 0.3, GR: 1, WR: 1, SSS: 1, HS: 1, GAIN: 0 },
};
const ergebnis = {};
for (const [bn, m] of Object.entries(KN)) {
  const seg = [];
  for (const [n, s0] of Object.entries(servers)) {
    if (!s0.hasAdminRights || s0.purchasedByPlayer || !(s0.moneyMax > 0) || s0.requiredHackingSkill > pl.skill) continue;
    const base = s0.moneyMax / (25 * BN2.MM);
    const baseDiff = s0.baseDifficulty / BN2.SSS;
    const real = baseDiff * m.SSS;
    const minD = Math.min(Math.max(1, Math.round(real / 3)), 100);
    const s = { ...s0, moneyMax: 25 * base * m.MM, moneyAvailable: 25 * base * m.MM, hackDifficulty: minD, minDifficulty: minD };
    const tIst = hackTime({ sec: minD, reqSkill: s.requiredHackingSkill }, pl, m.HS);
    const kz = targetMetrics(s, pl, tIst, { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: m.SHM,
      bnServerGrowthRate: m.GR, bnServerWeakenRate: m.WR, mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: 3000 });
    if (kz.steadyEff > 0) seg.push({ cap: kz.kapazitaet, eff: kz.steadyEff * (m.GAIN ?? 1) });
  }
  seg.sort((a, b) => b.eff - a.eff);
  let rest = RAMGB, sum = 0;
  for (const g of seg) { if (rest <= 0) break; const t = Math.min(rest, g.cap); sum += t * g.eff; rest -= t; }
  ergebnis[bn] = { sum, kapGesamt: seg.reduce((a, g) => a + g.cap, 0) };
}
console.log("Spieler BN2-Stand (Level", pl.skill + "), Geldspeicher", RAMGB, "GB, offenes Modell (ohne Stapel, ohne r):");
for (const [bn, e] of Object.entries(ergebnis))
  console.log("BN" + bn, "Modell $/s", e.sum.toExponential(3), " relativ zu BN2", (e.sum / ergebnis[2].sum).toFixed(3), " Zielkapazitaet GB", e.kapGesamt.toFixed(0));
