// G09: im Stadtrotations-Regime (BLADE-1 gebaut): gepaarte Differenzen D (Sleeves wie Bot heute) gegen D+A2 (SLEEVE-1) und D+B1 (SLEEVE-2).
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[2] || 150), H = Number(process.argv[3] || 12);
const k40 = 3.45 * 3600, sw = { switchChaos: 46, switches: 5 };
const CF = {
  D: { sleeves: ["auto", "auto", "auto"], k40At: k40, ...sw },
  D2: { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40, ...sw },
  DB1: { sleeves: ["infil", "infil", "infil"], ...sw },
  DAD: { sleeves: ["autod", "autod", "autod"], k40At: k40, diplOn: 40, diplOff: 25, nDipl: 2, ...sw },
};
function paired(s0, c1, c2) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const d = [], dm = [];
  for (let i = 0; i < N; i++) {
    const seed = 1300 + i * 7919;
    const a = simulate(start, { ...CF[c1], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    const b = simulate(start, { ...CF[c2], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    d.push(b.rankEnd - a.rankEnd); dm.push((b.moneyLost - a.moneyLost) / 1e9);
  }
  const m = d.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / N);
  return `${m >= 0 ? "+" : ""}${fmt(m, 0)} (+-${fmt(sd / Math.sqrt(N), 0)}) / ${(dm.reduce((x, y) => x + y, 0) / N) >= 0 ? "+" : ""}${fmt(dm.reduce((x, y) => x + y, 0) / N, 2)}`;
}
console.log(`== mit Stadtrotation (Wechsel bei Chaos 46, bis 5 Staedte), ${H} h, n=${N}: Rang (+-SE) / Krankenhaus Mrd, Differenz gegen D (Sleeves wie heute)`);
console.log("S0".padEnd(6), ["D2-D (SLEEVE-1)", "DB1-D (SLEEVE-2)", "DAD-D (SLEEVE-3 dyn.)"].map((x) => x.padEnd(32)).join(""));
for (const s0 of [5, 39.3, 125]) console.log(String(s0).padEnd(6), [paired(s0, "D", "D2"), paired(s0, "D", "DB1"), paired(s0, "D", "DAD")].map((x) => x.padEnd(32)).join(""));
