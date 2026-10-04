// G09: gestaffelte Fixes: A (heute) -> A2 (SLEEVE-1-Fix) -> B1 (SLEEVE-2-Fix) -> C1 (SLEEVE-3), n gross, mit Standardfehler der Differenz.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[3] || 400), H = Number(process.argv[2] || 4.4);
const k40 = 3.45 * 3600;
const CF = {
  A: { sleeves: ["auto", "auto", "auto"], k40At: k40 },
  A2: { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40 },
  B1: { sleeves: ["infil", "infil", "infil"] },
  C1: { sleeves: ["infil", "dipl", "dipl"] },
};
function paired(s0, name1, name2) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const d = [], dm = [];
  for (let i = 0; i < N; i++) {
    const seed = 900 + i * 7919;
    const a = simulate(start, { ...CF[name1], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    const b = simulate(start, { ...CF[name2], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    d.push(b.rankEnd - a.rankEnd); dm.push((b.moneyLost - a.moneyLost) / 1e9);
  }
  const m = d.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / N);
  const mm = dm.reduce((x, y) => x + y, 0) / N;
  return `${m >= 0 ? "+" : ""}${fmt(m, 0)} (+-${fmt(sd / Math.sqrt(N), 0)}) Rang, ${mm >= 0 ? "+" : ""}${fmt(mm, 2)} Mrd`;
}
console.log(`Horizont ${H} h, n=${N}, gepaarte Zufallsfolgen. Differenzen des Mittels (Rang, Krankenhaus)`);
for (const s0 of [5, 20, 39.3, 80, 125]) {
  console.log(`S0 ${String(s0).padEnd(5)} SLEEVE-1 (A2-A): ${paired(s0, "A", "A2").padEnd(36)} SLEEVE-2 (B1-A2): ${paired(s0, "A2", "B1").padEnd(36)} gesamt B1-A: ${paired(s0, "A", "B1").padEnd(36)} C1-A: ${paired(s0, "A", "C1")}`);
}
