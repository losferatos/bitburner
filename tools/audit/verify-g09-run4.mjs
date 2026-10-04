// G09: Detail A gegen B1 bei grossem n: Raid-Versuche, Erfolge, Rangverlust, Pop, Chaos, Krankenhaus.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85);
setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const s0 = Number(process.argv[2] || 39.3), N = Number(process.argv[3] || 600), H = Number(process.argv[4] || 4.5);
const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
const CF = { "A  Bot heute": { sleeves: ["auto", "auto", "auto"], k40At: 3.45 * 3600 }, "B1 3x Infiltrate": { sleeves: ["infil", "infil", "infil"] }, "C1 I1+D2": { sleeves: ["infil", "dipl", "dipl"] } };
console.log(`S0 ${s0}, H ${H} h, n ${N}`);
console.log("Belegung".padEnd(20), "Rang+  SE  Raids Erfolge Verlust Gewinn(Sp) Pop_end Comms Chaos h>50 Krankh.Mrd Kammer Dipl");
for (const [name, c] of Object.entries(CF)) {
  const r = ensemble(start, { ...c, hours: H, growth: 0.04, raidFirst: true, income: 3e9 }, N, 303);
  console.log(name.padEnd(20), fmt(r.rank - base.rank, 0).padStart(5), fmt(r.rankSd / Math.sqrt(N), 0).padStart(4), fmt(r.raids, 0).padStart(5), fmt(r.raidSucc, 1).padStart(7), fmt(r.loss, 0).padStart(7), fmt(r.rankPlayer, 0).padStart(10), fmt(r.popEnd, 0).padStart(7), fmt(r.commsEnd, 0).padStart(5), fmt(r.chaosEnd, 1).padStart(6), fmt(r.over50h, 2).padStart(5), fmt(r.money / 1e9, 2).padStart(9), fmt(r.kammerMin, 0).padStart(6), fmt(r.dipMin, 0).padStart(4));
}

for (const [name, c] of Object.entries(CF)) {
  const r = ensemble(start, { ...c, hours: H, growth: 0.04, raidFirst: true, income: 3e9 }, N, 303);
  console.log(name, "je Stunde: [n Raids, Erfolge, mittleres p, Pop(M), Chaos, Vorrat]", Object.entries(r.hb).sort((a, b) => a[0] - b[0]).map(([h, e]) => `h${h}: ${fmt(e.n, 1)}, ${fmt(e.s, 2)}, p${fmt(e.pm, 3)}, ${fmt(e.popm, 0)}M, ${fmt(e.chaosm, 1)}, ${fmt(e.stockm, 0)}`).join(" | "));
}

console.log("Rang je Stunde (kumuliert ab Start, Mittel):");
for (const [name, c] of Object.entries(CF)) {
  const r = ensemble(start, { ...c, hours: H, growth: 0.04, raidFirst: true, income: 3e9 }, N, 303);
  console.log(name.padEnd(20), r.ranksH.filter((x) => Number.isFinite(x)).map((x) => fmt(x - base.rank, 0)).join(" -> "));
}
