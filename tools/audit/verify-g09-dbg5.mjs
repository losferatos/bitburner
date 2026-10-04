import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
for (const s0 of [5, 39.3, 125]) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const r = ensemble(start, { sleeves: ["auto", "auto", "auto"], k40At: 3.45 * 3600, hours: 6, growth: 0.02, raidFirst: true, income: 3e9 }, 60, 1);
  console.log("S0", s0, "A: Sleeve-Vertraege", fmt(r.contracts, 1), "Rang Sleeve", fmt(r.rankSleeve, 1), "Infiltrate-Ereignisse", fmt(r.infil, 0), "Rang", fmt(r.rank - base.rank, 0));
}
