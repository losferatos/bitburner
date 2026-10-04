// G09: welche Wand traegt das Ergebnis? B1-A2 (SLEEVE-2) mit/ohne Pop-Verbrauch, mit/ohne Chaoswachstum (S0=5 und 39,3).
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[2] || 150);
const k40 = 3.45 * 3600;
const A2 = { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40 }, B1 = { sleeves: ["infil", "infil", "infil"] };
function paired(s0, extra, H) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const d = [], dm = [];
  for (let i = 0; i < N; i++) {
    const seed = 1700 + i * 7919;
    const a = simulate(start, { ...A2, ...extra, hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    const b = simulate(start, { ...B1, ...extra, hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    d.push(b.rankEnd - a.rankEnd); dm.push((b.moneyLost - a.moneyLost) / 1e9);
  }
  const m = d.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / N);
  return `${m >= 0 ? "+" : ""}${fmt(m, 0)} (+-${fmt(sd / Math.sqrt(N), 0)}) / ${fmt(dm.reduce((x, y) => x + y, 0) / N, 2)} Mrd`;
}
console.log("B1-A2 (SLEEVE-2) Rang (+-SE) / Krankenhaus, nach 4,4 h und 12 h; n=" + N);
for (const s0 of [5, 39.3]) {
  for (const [name, ex] of Object.entries({ "alle Regeln (Spiel)": {}, "ohne Chaoswachstum": { noChaos: true }, "ohne Pop-/Comms-Verbrauch": { noPop: true }, "ohne beides": { noChaos: true, noPop: true } })) {
    console.log(`S0 ${String(s0).padEnd(5)} ${name.padEnd(28)} 4,4 h: ${paired(s0, ex, 4.4).padEnd(34)} 12 h: ${paired(s0, ex, 12)}`);
  }
}
