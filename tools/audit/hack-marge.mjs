// Audit 03.10.2026, Bereich HACK: Was kosten die festen Stapel-Aufschlaege
// (BATCH_GROW_MARGIN 1,15 / BATCH_WEAKEN_MARGIN 1,5, src/lib/calc.js:654-655)
// an Stapelspeicher, gerechnet am echten BN2-Stand?
//
// stapelPlan ist die Formel des Bots (src/lib/calc.js:712-727); hier wird sie
// mit parametrierten Aufschlaegen nachgerechnet. Eichung: der Bot meldet je
// Stapelziel stapelGb (data/bn4net.json) - mit 1,15/1,5 muss dieselbe Zahl
// herauskommen.
// Aufruf: node tools/audit/hack-marge.mjs <backup.json.gz>
import { loadSave, textFile } from "./hack-save.mjs";
import { targetMetrics, hackTime, growThreadsFromK } from "../../src/lib/calc.js";

const file = process.argv[2];
const { p, servers } = loadSave(file);
const tele = JSON.parse(textFile(servers.home, "data/bn4net.json"));
const pl = {
  skill: p.skills.hacking, int: p.skills.intelligence,
  multMoney: p.mults.hacking_money, multChance: p.mults.hacking_chance,
  multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed,
};
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };
const bnGrowth = tele.bnWerte ? tele.bnWerte.serverGrowthRate : 1;

function plan(f, kz, moneyMax, gm, wm) {
  const hackT = Math.max(1, Math.floor(f / kz.pMin));
  const echt = Math.min(0.99, kz.pMin * hackT);
  const growT = Math.max(1, Math.ceil(growThreadsFromK(kz.kMin, moneyMax, moneyMax * (1 - echt), moneyMax) * gm));
  const w1 = Math.max(1, Math.ceil(hackT * 0.002 * wm / 0.05));
  const w2 = Math.max(1, Math.ceil(growT * 0.004 * wm / 0.05));
  return { hackT, growT, w1, w2, ram: hackT * RAM.hackT + growT * RAM.growT + (w1 + w2) * RAM.weakenT };
}

let belegtSumme = 0, sparSumme = 0;
for (const z of tele.stapel.ziele) {
  const s = servers[z.ziel];
  const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
  const kz = targetMetrics(s, pl, tIst, {
    ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
    bnScriptHackMoney: 1, bnServerGrowthRate: bnGrowth, bnServerWeakenRate: 1,
    mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: 1000,
  });
  const bot = plan(z.fraction, kz, s.moneyMax, 1.15, 1.5);
  const knapp = plan(z.fraction, kz, s.moneyMax, 1.02, 1.1);
  const ideal = plan(z.fraction, kz, s.moneyMax, 1.0, 1.0);
  const spar = 1 - knapp.ram / bot.ram;
  belegtSumme += z.belegtGb; sparSumme += z.belegtGb * spar;
  console.log(z.ziel.padEnd(14), "f", z.fraction, "| Soll stapelGb (Telemetrie)", z.stapelGb, "| Ist 1,15/1,5:", bot.ram.toFixed(2),
    JSON.stringify(bot), "| 1,02/1,1:", knapp.ram.toFixed(2), "| ideal:", ideal.ram.toFixed(2),
    "| Ersparnis", (100 * spar).toFixed(1), "% von belegt", z.belegtGb, "GB");
}
console.log("Stapelspeicher belegt", belegtSumme, "GB, davon mit 1,02/1,1 frei:", sparSumme.toFixed(0), "GB");
