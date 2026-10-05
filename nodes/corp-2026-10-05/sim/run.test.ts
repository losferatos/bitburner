// Szenario-Laeufer. Auswahl per Umgebungsvariable CORP_SCEN (kommagetrennt), Saaten per CORP_SEEDS.
// Ergebnis: sim/out/<szenario>_s<saat>.json
import * as fs from "fs";
import * as path from "path";
import { initGameEnvironment } from "../../../reference/v301/test/jest/Utilities";
import { Sim, Params } from "./corpsim";

initGameEnvironment();

const CP = [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24];
const PROD_SUP = { Operations: 2, Engineer: 2, Business: 1, Management: 2, "Research & Development": 3 };
const TF = ["Export", "Tobacco", "Agri-Bueros 8", "Chemical"];
export const SCEN: Record<string, Omit<Params, "seed">> = {
  A_seed: { name: "A_seed", hours: 24, mode: "seed", rounds: [], checkpoints: CP },
  B_agri_r0: { name: "B_agri_r0", hours: 24, mode: "agri", rounds: [], checkpoints: CP },
  B_agri_r1: { name: "B_agri_r1", hours: 24, mode: "agri", rounds: [0.5], checkpoints: CP },
  C_r1tf: { name: "C_r1tf", hours: 24, mode: "doc", rounds: [0.5], order: TF, tobAfterRound: 1, checkpoints: CP },
  C_r1tf_ps: { name: "C_r1tf_ps", hours: 24, mode: "doc", rounds: [0.5], order: TF, tobAfterRound: 1, supMix: PROD_SUP, supRatio: 0.6, checkpoints: CP },
  C_r2: { name: "C_r2", hours: 24, mode: "doc", rounds: [0.5, 2], checkpoints: CP },
  C_r2tf: { name: "C_r2tf", hours: 24, mode: "doc", rounds: [0.5, 2], order: TF, tobAfterRound: 1, checkpoints: CP },
  C_r2tf_ps: { name: "C_r2tf_ps", hours: 24, mode: "doc", rounds: [0.5, 2], order: TF, tobAfterRound: 1, supMix: PROD_SUP, supRatio: 0.6, checkpoints: CP },
  C_r3: { name: "C_r3", hours: 24, mode: "doc", rounds: [0.5, 2, 4.5], checkpoints: CP },
  C_r4: { name: "C_r4", hours: 24, mode: "doc", rounds: [0.5, 2, 4.5, 8.5], checkpoints: CP },
  C_r4tf_ps: { name: "C_r4tf_ps", hours: 24, mode: "doc", rounds: [0.5, 2, 4.5, 8.5], order: TF, tobAfterRound: 1, supMix: PROD_SUP, supRatio: 0.6, checkpoints: CP },
};
const SH_A = { wilson: 0.3, ads: 0.2, main: 0.3 };
const SH_B = { wilson: 0.2, ads: 0.15, main: 0.4 };
const BEST = { mode: "doc" as const, order: TF, tobAfterRound: 1, supMix: PROD_SUP, supRatio: 0.6, hours: 24, checkpoints: CP };
SCEN.C2B = { ...BEST, name: "C2B", rounds: [0.5, 2], shares: SH_B };
SCEN.C3A = { ...BEST, name: "C3A", rounds: [0.5, 2, 4.5], shares: SH_A };
SCEN.C3B = { ...BEST, name: "C3B", rounds: [0.5, 2, 4.5], shares: SH_B };
SCEN.C4A = { ...BEST, name: "C4A", rounds: [0.5, 2, 3.5, 6], shares: SH_A };
SCEN.C4B = { ...BEST, name: "C4B", rounds: [0.5, 2, 4.5, 8.5], shares: SH_B };
SCEN.C4B_K = { ...SCEN.C4B, name: "C4B_K", pricing: "lagK" };
SCEN.C3A_K = { ...SCEN.C3A, name: "C3A_K", pricing: "lagK" };
SCEN.C4A_K = { ...SCEN.C4A, name: "C4A_K", pricing: "lagK" };
SCEN.B_fix = { ...SCEN.B_agri_r0, name: "B_fix", agriFixed: true };
SCEN.B1_fix = { ...SCEN.B_agri_r1, name: "B1_fix", agriFixed: true };
SCEN.C4A_KF = { ...SCEN.C4A_K, name: "C4A_KF", agriFixed: true };
SCEN.C4B_KF = { ...SCEN.C4B_K, name: "C4B_KF", agriFixed: true };
SCEN.C3B_KF = { ...SCEN.C3B, name: "C3B_KF", pricing: "lagK", agriFixed: true };
SCEN.D4A_K = { ...SCEN.C4A_K, name: "D4A_K", tranches: [{ h: 6.3, frac: 0.5 }] };
SCEN.D4B_K = { ...SCEN.C4B_K, name: "D4B_K", tranches: [{ h: 8.8, frac: 0.5 }] };

// Sweep: CORP_SWEEP='[{"name":"x","base":"C_r4","o":{...}}]' -> zusaetzliche Szenarien
for (const sw of JSON.parse(process.env.CORP_SWEEP ?? "[]")) SCEN[sw.name] = { ...SCEN[sw.base], ...sw.o, name: sw.name };
const names = (process.env.CORP_SCEN ?? (process.env.CORP_SWEEP ? JSON.parse(process.env.CORP_SWEEP).map((x: any) => x.name).join(",") : "A_seed")).split(",");
const seeds = (process.env.CORP_SEEDS ?? "1").split(",").map(Number);
const hoursOverride = process.env.CORP_HOURS ? Number(process.env.CORP_HOURS) : undefined;
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

for (const n of names) {
  for (const seed of seeds) {
    test(`${n} s${seed}`, () => {
      const base = SCEN[n];
      if (!base) throw new Error("unbekanntes Szenario " + n);
      const p: Params = JSON.parse(JSON.stringify({ ...base, seed, verbose: process.env.CORP_VERBOSE !== '0' }));
      if (hoursOverride) {
        p.hours = hoursOverride;
        p.checkpoints = p.checkpoints.filter((h) => h <= hoursOverride);
      }
      const t0 = Date.now();
      const sim = new Sim(p);
      const res = sim.run();
      const out = { params: p, results: res, ramGB: sim.ramGB(), used: [...sim.used].sort(), events: sim.events, traj: sim.traj, wallSec: (Date.now() - t0) / 1000 };
      fs.writeFileSync(path.join(outDir, `${n}_s${seed}.json`), JSON.stringify(out, null, 1));
      console.log(`${n} s${seed}: RAM ${sim.ramGB().toFixed(1)} GB, Rechenzeit ${out.wallSec.toFixed(0)} s`);
    });
  }
}
