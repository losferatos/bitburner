// Audit 03.10.2026, Bereich HACK: Vorbereitungszeit und Rang der Geldziele
// nach der Zielwahl des Bots (src/lib/calc.js targetMetrics/targetRank,
// ZIELWAHL aus src/bn4net.js:1695-1696) am echten Spielstand.
// Aufruf: node tools/audit/hack-prep.mjs <backup.json.gz> [horizonSec] [prepMaxSec]
import { loadSave, textFile } from "./hack-save.mjs";
import { targetMetrics, targetRank, hackTime } from "../../src/lib/calc.js";
const { p, servers } = loadSave(process.argv[2]);
const H = Number(process.argv[3] || 1800), PM = Number(process.argv[4] || 1200);
const tele = JSON.parse(textFile(servers.home, "data/bn4net.json"));
const pl = { skill: p.skills.hacking, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
  multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
let netz = 0; for (const [n, s] of Object.entries(servers)) if (s.hasAdminRights && !n.startsWith("hacknet-")) netz += s.maxRam || 0;
const rows = [];
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || s.purchasedByPlayer || !(s.moneyMax > 0) || s.requiredHackingSkill > pl.skill) continue;
  const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
  const kz = targetMetrics(s, pl, tIst, { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 1,
    bnServerGrowthRate: tele.bnWerte.serverGrowthRate, bnServerWeakenRate: 1, mixMoneyHigh: 0.95, kapAbzug: 0.2,
    secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3 });
  const rang = targetRank(kz, { horizonSec: H, prepMaxSec: PM }, null);
  rows.push([n, s.hackDifficulty.toFixed(1), s.minDifficulty, (s.moneyAvailable / s.moneyMax).toFixed(2),
    (kz.steadyEff || 0).toFixed(0), kz.kapazitaet.toFixed(0), kz.prepSec.toFixed(0), rang.toFixed(0)]);
}
rows.sort((a, b) => Number(b[4]) - Number(a[4]));
console.log("Netz", netz, "GB, Level", pl.skill, "horizon", H, "prepMax", PM);
console.log("host\tsec\tmin\tfill\tsteadyEff\tkap\tprepSec\trang(neu)");
console.log(rows.map((r) => r.join("\t")).join("\n"));
