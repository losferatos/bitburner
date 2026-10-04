// G09: Rang-Verlauf (Mittel ueber n Laeufe) je Belegung zu festen Zeitpunkten.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble } from "./verify-g09-sim.mjs";
const f = listRun(process.argv[5] || "BN2L1").find((x) => x.includes(process.argv[6] || "T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const s0 = Number(process.argv[2] || 39.3);
const CONFIGS = {
  "A  Bot heute":            { sleeves: ["auto", "auto", "auto"], k40At: 3.45 * 3600 },
  "B1 3x Infiltrate":        { sleeves: ["infil", "infil", "infil"] },
  "B2 2x Infiltrate+1 auto": { sleeves: ["infil", "infil", "auto"], k40At: 3.45 * 3600 },
  "C1 1 Infiltrate+2 Dipl":  { sleeves: ["infil", "dipl", "dipl"] },
  "C2 2 Infiltrate+1 Dipl":  { sleeves: ["infil", "infil", "dipl"] },
  "Z  nur Gym":              { sleeves: ["gym", "gym", "gym"] },
};
const hs = (process.argv[3] || "1,2,3,4.5,6,8").split(",").map(Number);
const N = Number(process.argv[4] || 120);
const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
console.log(`Stand ${f}, Raid-Vorrat ${s0}, Vorrat/Chaos/Pop Start: ${fmt(start.act.Raid.count,1)} / ${fmt(start.city.chaos,1)} / ${Math.round(start.city.pop/1e6)}M`);
console.log("Belegung".padEnd(26), hs.map((h) => ("Rang+@" + h + "h").padStart(10)).join(""), "  | Krankenhaus Mrd @", hs.join("/"));
for (const [name, c] of Object.entries(CONFIGS)) {
  const row = [], mon = [];
  for (const h of hs) {
    const r = ensemble(start, { ...c, hours: h, growth: 0.04, raidFirst: true, income: 3e9 }, N, 202);
    row.push(fmt(r.rank - base.rank, 0).padStart(10)); mon.push(fmt(r.money / 1e9, 2));
  }
  console.log(name.padEnd(26), row.join(""), "  |", mon.join(" / "));
}
