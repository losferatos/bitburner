// G09: Eichung der Simulation: "Spieler allein" eine Stunde ab 07:33 / 08:33 (BN2L1), Sleeves im Gym.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble } from "./verify-g09-sim.mjs";
for (const key of ["07-33", "08-33"]) {
  const f = listRun("BN2L1").find((x) => x.includes("T" + key));
  const { p } = readSave(f);
  const s0 = startFromSave(p);
  const r = ensemble(s0, { sleeves: ["gym", "gym", "gym"], hours: 1, growth: 0.0, raidFirst: true }, 400, 11);
  console.log(key, "Raid-Vorrat Start", fmt(s0.act.Raid.count, 2), "| Sim 1 h: Raids", fmt(r.raids, 1), "Raid-Erfolge", fmt(r.raidSucc, 2), "Retirement", fmt(r.paRet, 1), "Kammer min", fmt(r.kammerMin, 1), "Diplomacy min", fmt(r.dipMin, 1), "Rang +", fmt(r.rank - s0.rank, 1), "(sd", fmt(r.rankSd, 1), ") Krankenhaus Mrd", fmt(r.money / 1e9, 3), "Zeit min", JSON.stringify(Object.fromEntries(Object.entries(r.tt).map(([k, v]) => [k, +v.toFixed(1)]))));
}
console.log("Ist 07:33-08:33 (Konsole/Spielstand): Raids 16-17, Erfolge 7, Retirement 51, Kammer 23 min; Rang +593 (Raid-Glueck), Krankenhaus moneyLost + 0,367 Mrd (2,547 -> 2,914)");
