// G09: beste Alternative zu "mehr Raids": Geld im Spielerwert (lambda = Rang je Mio $ Krankenhaus) - gleicher Rang, weniger Kosten?
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[2] || 100);
const k40 = 3.45 * 3600;
const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = Number(process.argv[3] || 39.3);
console.log("lambda = Rang je Mio $ (0 = Bot, blind); 0,05 = 1 Mrd entspricht 50 Rang");
for (const [name, c] of Object.entries({ "A  Bot heute": { sleeves: ["auto", "auto", "auto"], k40At: k40 }, "B1 3xInf": { sleeves: ["infil", "infil", "infil"] }, "D  Stadtwechsel": { sleeves: ["auto", "auto", "auto"], k40At: k40, switchChaos: 46, switches: 5 }, "D+B1": { sleeves: ["infil", "infil", "infil"], switchChaos: 46, switches: 5 } })) {
  for (const lam of [0, 0.05, 0.15]) {
    const r = ensemble(start, { ...c, hours: 12, growth: 0.02, raidFirst: false, lambda: lam, income: 3e9 }, N, 808);
    console.log(name.padEnd(18), "lambda", String(lam).padEnd(5), "Rang+", fmt(r.rank - base.rank, 0).padStart(5), "Krankenhaus", fmt(r.money / 1e9, 1).padStart(5), "Mrd Raids", fmt(r.raids, 0).padStart(4), "Rang je Mrd", fmt((r.rank - base.rank) / (r.money / 1e9), 0));
  }
}
