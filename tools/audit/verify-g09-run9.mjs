// G09: Langhorizont (bis zum ersten Tor ~13 h nach Knotenstart): wirken die Belegungsunterschiede noch?
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[2] || 120);
const hs = (process.argv[3] || "4.4,7,10,12").split(",").map(Number);
const k40 = 3.45 * 3600;
const CF = {
  "A  Bot heute": { sleeves: ["auto", "auto", "auto"], k40At: k40 },
  "A2 SLEEVE-1-Fix": { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40 },
  "B1 3xInf ab Beitritt": { sleeves: ["infil", "infil", "infil"] },
  "C1 Inf+2Dipl": { sleeves: ["infil", "dipl", "dipl"] },
  "AD dyn. Diplomacy": { sleeves: ["autod", "autod", "autod"], k40At: k40, diplOn: 40, diplOff: 25, nDipl: 2 },
  "D  Stadtwechsel": { sleeves: ["auto", "auto", "auto"], k40At: k40, switchChaos: 46, switches: 5 },
  "D+B1": { sleeves: ["infil", "infil", "infil"], switchChaos: 46, switches: 5 },
  "D+AD": { sleeves: ["autod", "autod", "autod"], k40At: k40, diplOn: 40, diplOff: 25, nDipl: 2, switchChaos: 46, switches: 5 },
};
for (const s0 of (process.argv[4] || "5,39.3,125").split(",").map(Number)) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  console.log(`\nRaid-Vorrat Start ${s0}: Rang+ (Krankenhaus Mrd) zu den Horizonten ${hs.join(" / ")} h nach h0,85; n=${N}`);
  for (const [name, c] of Object.entries(CF)) {
    const cells = hs.map((H) => {
      let sr = 0, sm = 0;
      for (let i = 0; i < N; i++) { const r = simulate(start, { ...c, hours: H, growth: 0.02, raidFirst: process.env.RAIDFIRST !== "0", income: 3e9 }, 1000 + i * 7919); sr += r.rankEnd; sm += r.moneyLost; }
      return `${fmt(sr / N - base.rank, 0)} (${fmt(sm / N / 1e9, 1)})`.padStart(14);
    });
    console.log(name.padEnd(22), cells.join(""));
  }
}
