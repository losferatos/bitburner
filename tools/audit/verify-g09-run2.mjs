// G09: Belegungsvergleich ab BN2.1 05:33 (h 0,85): Rang, Krankenhauskosten, Chaos nach 3/5/8 h.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble } from "./verify-g09-sim.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const CONFIGS = {
  "A  Bot heute (gym->auto ab k40)":      { sleeves: ["auto", "auto", "auto"], k40At: 3.45 * 3600 },
  "B1 3x Infiltrate ab Beitritt":         { sleeves: ["infil", "infil", "infil"] },
  "B2 2x Infiltrate + 1 auto":            { sleeves: ["infil", "infil", "auto"], k40At: 3.45 * 3600 },
  "B3 1x Infiltrate + 2 auto":            { sleeves: ["infil", "auto", "auto"], k40At: 3.45 * 3600 },
  "C1 1 Infiltrate + 2 Diplomacy":        { sleeves: ["infil", "dipl", "dipl"] },
  "C2 2 Infiltrate + 1 Diplomacy":        { sleeves: ["infil", "infil", "dipl"] },
  "Z  alle Gym (kein Sleeve-Beitrag)":    { sleeves: ["gym", "gym", "gym"] },
};
const stocks = process.argv[2] ? process.argv[2].split(",").map(Number) : [39.3];
const hours = Number(process.argv[3] || 8);
for (const s0 of stocks) {
  const start = JSON.parse(JSON.stringify(base));
  start.act.Raid.count = s0;
  console.log(`\n== Raid-Vorrat Start ${s0}, Horizont ${hours} h ab h0,85 (BN2.1-Zustand 05:33), n=150 je Belegung`);
  console.log("Belegung".padEnd(38), "Rang+", "sd", " Raids Erf  Krankh.Mrd  Chaos_end  h>50  Vorrat_end  LvRaid  Kammer_min  Dipl_min  Rang_Spieler Rang_Sleeve");
  for (const [name, c] of Object.entries(CONFIGS)) {
    const r = ensemble(start, { ...c, hours, growth: 0.04, raidFirst: process.argv[4] !== "ev" }, 150, 101);
    console.log(name.padEnd(38), fmt(r.rank - base.rank, 0).padStart(5), fmt(r.rankSd, 0).padStart(4), fmt(r.raids, 0).padStart(6), fmt(r.raidSucc, 1).padStart(5),
      fmt(r.money / 1e9, 2).padStart(8), fmt(r.chaosEnd, 1).padStart(9), fmt(r.over50h, 2).padStart(6), fmt(r.stockRaid, 0).padStart(8), fmt(r.levelRaid, 1).padStart(7),
      fmt(r.kammerMin, 0).padStart(8), fmt(r.dipMin, 0).padStart(8), fmt(r.rankPlayer, 0).padStart(9), fmt(r.rankSleeve, 0).padStart(9));
  }
}
