// G09: SLEEVE-3 im Zustand des LP (BN2.1 09:19 bzw. 09:59, Chaos 29-49, Pop ~590 M): Belegungen fuer die naechsten 3 / 6 h.
import { listRun, readSave, fmt, sleeveOf } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
setStatPath(null); setSkillPath(null);
const key = process.argv[2] || "T09-19";
const f = listRun("BN2L1").find((x) => x.includes(key));
const { p } = readSave(f);
const sl = (p.sleeves || []).map(sleeveOf);
const base = startFromSave(p, { ...sl[1].skills });
console.log("Start", f.slice(25, 52), "Rang", fmt(base.rank, 0), "Raid-Vorrat", fmt(base.act.Raid.count, 1), "L", base.act.Raid.level, "Chaos", fmt(base.city.chaos, 1), "pop", Math.round(base.city.pop / 1e6) + "M", "Sleeve-Skills", JSON.stringify(sl[1].skills), "Stamina", fmt(base.stamina, 1));
const N = Number(process.argv[3] || 150);
const CF = {
  "I2 + Vertrag (heute, LP 211)": { sleeves: ["infil", "infil", "c:Bounty Hunter"] },
  "V3 drei Vertraege (LP 270)": { sleeves: ["c:Tracking", "c:Bounty Hunter", "c:Retirement"] },
  "I1 + D2 (LP 328)": { sleeves: ["infil", "dipl", "dipl"] },
  "I3 (LP 176)": { sleeves: ["infil", "infil", "infil"] },
  "D3 drei Diplomacy": { sleeves: ["dipl", "dipl", "dipl"] },
  "Stadtwechsel + I2+V": { sleeves: ["infil", "infil", "c:Bounty Hunter"], switchChaos: 46, switches: 5 },
  "Stadtwechsel + V3": { sleeves: ["c:Tracking", "c:Bounty Hunter", "c:Retirement"], switchChaos: 46, switches: 5 },
  "Stadtwechsel + I1+D2": { sleeves: ["infil", "dipl", "dipl"], switchChaos: 46, switches: 5 },
};
for (const H of [3, 6]) {
  console.log(`\nHorizont ${H} h: Rang+ / Rang je h / Krankenhaus Mrd / Raids / Chaos_end`);
  for (const [name, c] of Object.entries(CF)) {
    const r = ensemble(base, { ...c, hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, N, 707);
    console.log(name.padEnd(32), fmt(r.rank - base.rank, 0).padStart(6), "/", fmt((r.rank - base.rank) / H, 0).padStart(4), "/", fmt(r.money / 1e9, 2).padStart(5), "/", fmt(r.raids, 0).padStart(4), "/", fmt(r.chaosEnd, 1).padStart(5), " (sd Mittel", fmt(r.rankSd / Math.sqrt(N), 0) + ")");
  }
}
