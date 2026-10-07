// Corp je BitNode: echte Spielquelle v301, Gruendung selbstfinanziert ausserhalb BN3 (150 Mrd Spielergeld), SF3.3.
import * as fs from "fs";
import * as path from "path";
import { initGameEnvironment } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/test/jest/Utilities";
import { Sim, Params } from "./corpsim";
initGameEnvironment();
const CP = [1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 30, 36];
const PROD_SUP = { Operations: 2, Engineer: 2, Business: 1, Management: 2, "Research & Development": 3 };
const TF = ["Export", "Tobacco", "Agri-Bueros 8", "Chemical"];
const SH_B = { wilson: 0.2, ads: 0.15, main: 0.4 };
const SH_A = { wilson: 0.3, ads: 0.2, main: 0.3 };
const BEST = { mode: "doc" as const, order: TF, tobAfterRound: 1, supMix: PROD_SUP, supRatio: 0.6, checkpoints: CP, pricing: "lagK" as const, agriFixed: true };
const SCEN: Record<string, any> = {
  C4B_KF: { ...BEST, name: "C4B_KF", rounds: [0.5, 2, 4.5, 8.5], shares: SH_B },
  C4A_KF: { ...BEST, name: "C4A_KF", rounds: [0.5, 2, 3.5, 6], shares: SH_A },
};
const node = Number(process.env.CORP_NODE ?? 3);
const hours = Number(process.env.CORP_HOURS ?? 24);
const names = (process.env.CORP_SCEN ?? "C4B_KF").split(",");
const seeds = (process.env.CORP_SEEDS ?? "1").split(",").map(Number);
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
for (const n of names) for (const seed of seeds) {
  test(`BN${node} ${n} s${seed}`, () => {
    const p: Params = JSON.parse(JSON.stringify({ ...SCEN[n], seed, hours, verbose: false }));
    p.checkpoints = p.checkpoints.filter((h: number) => h <= hours);
    const t0 = Date.now();
    const sim = new Sim(p);
    const res = sim.run();
    const out = { node, params: p, results: res, events: sim.events, traj: sim.traj, maxDiv: (sim as any).c.maxDivisions, wallSec: (Date.now() - t0) / 1000 };
    fs.writeFileSync(path.join(outDir, `BN${node}_${n}_s${seed}.json`), JSON.stringify(out, null, 1));
  });
}
