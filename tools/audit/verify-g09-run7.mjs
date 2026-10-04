// G09: Belegungen ab dem BN2.2-Stand 13:17 (h 2,65): Vorrat 107, Sleeves k24.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
setStatPath(null); setSkillPath(null);
const f = listRun("BN2L2").find((x) => x.includes("T13-17"));
const { p } = readSave(f);
const base = startFromSave(p);
console.log("Start:", f.slice(25, 41), "Rang", fmt(base.rank, 0), "Vorrat Raid", fmt(base.act.Raid.count, 1), "Stufe", base.act.Raid.level, "Chaos", base.city.chaos, "pop", Math.round(base.city.pop / 1e6) + "M comms", base.city.comms,
  "Stamina", fmt(base.stamina, 1), "Skills", JSON.stringify(p.bladeburner.data ? p.bladeburner.data.skills : p.bladeburner.skills));
const H = Number(process.argv[2] || 7), N = Number(process.argv[3] || 200);
const k40 = 1.6 * 3600;
const CF = {
  "A  Bot heute":            { sleeves: ["auto", "auto", "auto"], k40At: k40 },
  "B1 3xInf ab jetzt":       { sleeves: ["infil", "infil", "infil"] },
  "C1 Inf+2Dipl":            { sleeves: ["infil", "dipl", "dipl"] },
  "D  Stadtwechsel @46":     { sleeves: ["auto", "auto", "auto"], k40At: k40, switchChaos: 46, switches: 5 },
  "D+B1":                    { sleeves: ["infil", "infil", "infil"], switchChaos: 46, switches: 5 },
};
for (const s0 of (process.argv[4] || "107").split(",").map(Number)) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  console.log(`\nRaid-Vorrat ${s0}, Horizont ${H} h; Rang+ / Krankenhaus Mrd / Raids / Stadtwechsel / Chaos_end`);
  for (const [name, c] of Object.entries(CF)) {
    const r = ensemble(start, { ...c, hours: H, growth: 0.03, raidFirst: true, income: 1.5e9 }, N, 606);
    console.log(name.padEnd(24), fmt(r.rank - base.rank, 0).padStart(6), "/", fmt(r.money / 1e9, 1).padStart(5), "/", fmt(r.raids, 0).padStart(4), "/", fmt(r.nSwitch, 1), "/", fmt(r.chaosEnd, 1), " stock_end", fmt(r.stockRaid, 0), "pop_end", fmt(r.popEnd, 0));
  }
}
