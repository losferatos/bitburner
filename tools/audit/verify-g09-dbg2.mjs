import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate } from "./verify-g09-sim.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T07-33"));
const { p } = readSave(f);
const s0 = startFromSave(p);
const r = simulate(s0, { sleeves: ["gym","gym","gym"], hours: 1, growth: 0 }, 5);
console.log(JSON.stringify(r.pa), JSON.stringify(r.tt), r.rankEnd - s0.rank);
console.log(s0.act.Assassination, s0.act["Stealth Retirement Operation"], s0.act.Retirement);
