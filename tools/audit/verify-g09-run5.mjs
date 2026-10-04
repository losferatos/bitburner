// G09: Empfindlichkeit gegen den zufaelligen Start-Vorrat (U[1,150]): Rang-Differenz und Krankenhauskosten gegen "Bot heute".
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85);
setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const H = Number(process.argv[2] || 4.4), N = Number(process.argv[3] || 300);
const CF = {
  "A  Bot heute": { sleeves: ["auto", "auto", "auto"], k40At: 3.45 * 3600 },
  "B1 3xInf ab Beitritt": { sleeves: ["infil", "infil", "infil"] },
  "B2 2xInf+1 auto": { sleeves: ["infil", "infil", "auto"], k40At: 3.45 * 3600 },
  "B4 1xInf+2 auto": { sleeves: ["infil", "auto", "auto"], k40At: 3.45 * 3600 },
  "C1 Inf+2Dipl": { sleeves: ["infil", "dipl", "dipl"] },
};
console.log(`Horizont ${H} h ab BN2.1 h0,85 (Bot-Stats/Skills nach Spielstand), n=${N}; Differenz gegen A (Rang, Krankenhaus Mrd)`);
const S0s = (process.argv[4] || "5,39.3,80,125").split(",").map(Number);
console.log("S0".padEnd(6), Object.keys(CF).map((k) => k.padEnd(24)).join(""));
for (const s0 of S0s) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const res = {};
  for (const [name, c] of Object.entries(CF)) res[name] = ensemble(start, { ...c, hours: H, growth: 0.04, raidFirst: true, income: 3e9 }, N, 404);
  const A = res["A  Bot heute"];
  console.log(String(s0).padEnd(6), Object.entries(res).map(([k, r]) => (k.startsWith("A") ? `Rang ${fmt(r.rank - base.rank, 0)} / ${fmt(r.money / 1e9, 2)}Mrd` : `${r.rank - A.rank >= 0 ? "+" : ""}${fmt(r.rank - A.rank, 0)} / ${r.money - A.money >= 0 ? "+" : ""}${fmt((r.money - A.money) / 1e9, 2)}Mrd`).padEnd(24)).join(""));
}
