import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate } from "./verify-g09-sim.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const s0 = startFromSave(p);
s0.act.Raid.count = 39.3;
simulate(s0, { sleeves: ["infil","infil","infil"], hours: 4.5, growth: 0.04, trace: 40, traceFrom: 3.2*3600 }, 3);
