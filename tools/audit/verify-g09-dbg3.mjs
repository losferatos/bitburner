import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, simulate } from "./verify-g09-sim.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T05-33"));
const { p } = readSave(f);
const s0 = startFromSave(p);
s0.act.Raid.count = 39.3;
for (const h of [1, 2, 3, 4.5]) {
  const r = simulate(s0, { sleeves: ["infil","infil","infil"], hours: h, growth: 0.04 }, 3);
  console.log(h, "Raids", r.raids, "tt", JSON.stringify(Object.fromEntries(Object.entries(r.tt).map(([k, v]) => [k, +(v / 60).toFixed(0)]))), "stock", r.stockRaid.toFixed(0), "chaos", r.chaosEnd.toFixed(1), "pop", (r.city.pop/1e6).toFixed(0), "comms", r.city.comms, "rank", r.rankEnd.toFixed(0), "lvl", r.levelRaid);
}
