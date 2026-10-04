// G09 Endlauf: (1) Eichung der Simulation A gegen BN2.1 (Spielstand), (2) gepaarte Differenzen ueber den Start-Vorrat.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
import { statPath, skillPath } from "./verify-g09-statpath.mjs";
setStatPath(statPath("BN2L1", 5.4), 0.85); setSkillPath(skillPath("BN2L1", 5.4), 0.85);
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[2] || 300), H = Number(process.argv[3] || 4.4);
const k40 = 3.45 * 3600;
const CF = {
  A: { sleeves: ["auto", "auto", "auto"], k40At: k40 },
  A2: { sleeves: ["gymthen", "gymthen", "gymthen"], k40At: k40 },
  B1: { sleeves: ["infil", "infil", "infil"] },
  C1: { sleeves: ["infil", "dipl", "dipl"] },
  AD: { sleeves: ["autod", "autod", "autod"], k40At: k40, diplOn: 40, diplOff: 25, nDipl: 2 },
  ADB: { sleeves: ["infil", "infil", "infil"] },
};
// (1) Eichung A (Start-Vorrat 50 wie BN2.1) gegen Ist
{
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = 50;
  const r = ensemble(start, { ...CF.A, hours: 4.44, growth: 0.02, raidFirst: true, income: 3e9 }, N, 31);
  console.log("== Eichung Sim A (S0 50, 4,44 h ab 05:33) gegen BN2.1 05:33 -> 09:59");
  console.log(`Raid-Versuche Soll(Ist BN2.1) 129  Sim ${fmt(r.raids, 0)} | Erfolge Ist 19 Sim ${fmt(r.raidSucc, 1)} | Chaos Ende Ist 49,1 Sim ${fmt(r.chaosEnd, 1)} | Pop Ende Ist 587M Sim ${fmt(r.popEnd, 0)}M | Krankenhaus Ist 4,32 Mrd Sim ${fmt(r.money / 1e9, 2)} | Raid-Vorrat Ende Ist 9,6 Sim ${fmt(r.stockRaid, 1)} | Dipl min Sim ${fmt(r.dipMin, 0)}`);
  console.log("Raids/h Sim:", Object.entries(r.hb).sort((a, b) => a[0] - b[0]).map(([h, e]) => `h${h}:${fmt(e.n, 1)}`).join(" "), " | Ist (BN2.1): 37 33 16 21(h3,85-4,62) ...");
}
function paired(s0, c1, c2) {
  const start = JSON.parse(JSON.stringify(base)); start.act.Raid.count = s0;
  const d = [], dm = [];
  for (let i = 0; i < N; i++) {
    const seed = 900 + i * 7919;
    const a = simulate(start, { ...CF[c1], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    const b = simulate(start, { ...CF[c2], hours: H, growth: 0.02, raidFirst: true, income: 3e9 }, seed);
    d.push(b.rankEnd - a.rankEnd); dm.push((b.moneyLost - a.moneyLost) / 1e9);
  }
  const m = d.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / N);
  const mm = dm.reduce((x, y) => x + y, 0) / N;
  return `${m >= 0 ? "+" : ""}${fmt(m, 0)} (+-${fmt(sd / Math.sqrt(N), 0)}) / ${mm >= 0 ? "+" : ""}${fmt(mm, 2)}`;
}
console.log(`\n== gepaarte Differenzen nach ${H} h, n=${N}: Rang (+-SE) / Krankenhaus Mrd`);
console.log("S0".padEnd(6), ["A2-A (SLEEVE-1)", "B1-A2 (SLEEVE-2)", "B1-A (1+2 gesamt)", "C1-A (SLEEVE-3 fest)", "AD-A (SLEEVE-3 dynamisch)"].map((x) => x.padEnd(30)).join(""));
for (const s0 of [5, 20, 39.3, 80, 125]) {
  console.log(String(s0).padEnd(6), [paired(s0, "A", "A2"), paired(s0, "A2", "B1"), paired(s0, "A", "B1"), paired(s0, "A", "C1"), paired(s0, "A", "AD")].map((x) => x.padEnd(30)).join(""));
}
