// G09: Belegungen + Stadtwechsel, Horizont bis 8 h ab BN2.1 h0,85. Rang, Krankenhaus, Stadtwechsel, Raids.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85);
setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const H = Number(process.argv[2] || 7), N = Number(process.argv[3] || 200);
const k40 = 3.45 * 3600;
const CF = {
  "A  Bot heute":            { sleeves: ["auto", "auto", "auto"], k40At: k40 },
  "A2 nur SLEEVE-1-Fix":     { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40 },
  "B1 3xInf ab Beitritt":    { sleeves: ["infil", "infil", "infil"] },
  "C1 Inf+2Dipl":            { sleeves: ["infil", "dipl", "dipl"] },
  "D  Stadtwechsel @46":     { sleeves: ["auto", "auto", "auto"], k40At: k40, switchChaos: 46, switches: 5 },
  "D+B1":                    { sleeves: ["infil", "infil", "infil"], switchChaos: 46, switches: 5 },
  "D+C1":                    { sleeves: ["infil", "dipl", "dipl"], switchChaos: 46, switches: 5 },
};
console.log(`Horizont ${H} h ab BN2.1 h0,85, n=${N}, Einkommen 3 Mrd/h; Rang+ ab Start / Krankenhaus Mrd / Raids / Stadtwechsel`);
console.log("S0".padEnd(5), Object.keys(CF).map((k) => k.padEnd(28)).join(""));
for (const s0 of (process.argv[4] || "5,39.3,125").split(",").map(Number)) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const out = [];
  for (const [name, c] of Object.entries(CF)) {
    const r = ensemble(start, { ...c, hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, N, 505);
    out.push(`${fmt(r.rank - base.rank, 0)}/${fmt(r.money / 1e9, 1)}/${fmt(r.raids, 0)}/${fmt(r.nSwitch, 1)}`.padEnd(28));
  }
  console.log(String(s0).padEnd(5), out.join(""));
}
