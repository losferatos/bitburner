// Audit 03.10.2026, Bereich HACK: $/GB je Stapel ueber die F_LEITER, wenn
// Speicher (nicht der Kalender) der Engpass ist. stapelPlan = Formel des Bots
// (src/lib/calc.js:712-727, Aufschlaege 1,15/1,5 wie im Kerntakt).
// Aufruf: node tools/audit/hack-fleiter.mjs <backup.json.gz>
import { loadSave, textFile } from "./hack-save.mjs";
import { targetMetrics, hackTime, stapelPlan, BATCH_F_LEITER } from "../../src/lib/calc.js";
const { p, servers } = loadSave(process.argv[2]);
const tele = JSON.parse(textFile(servers.home, "data/bn4net.json"));
const pl = { skill: p.skills.hacking, int: p.skills.intelligence, multMoney: p.mults.hacking_money,
  multChance: p.mults.hacking_chance, multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
for (const z of tele.stapel.ziele) {
  const s = servers[z.ziel];
  const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
  const kz = targetMetrics(s, pl, tIst, { ramHackT: 1.75, ramGrowT: 1.8, ramWeakenT: 1.8, bnScriptHackMoney: 1,
    bnServerGrowthRate: tele.bnWerte.serverGrowthRate, bnServerWeakenRate: 1, mixMoneyHigh: 0.95, kapAbzug: 0.2,
    secOk: 1, moneyLow: 0.75, prepRamGb: 1000 });
  const zeile = BATCH_F_LEITER.map((f) => { const pl2 = stapelPlan(f, kz, s.moneyMax, RAM, 1);
    return f + ":" + (pl2.geld / pl2.ram / 1e3).toFixed(1) + "k"; });
  console.log(z.ziel.padEnd(14), "Bot-f", z.fraction, "| $/GB je Stapel:", zeile.join("  "));
}
