import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { ACT, ctxOf, chance, actionTime, stamCost, rankGain, rankLossAt, damage } from "./verify-g09-model.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T07-33"));
const { p } = readSave(f);
const { ctx, levels, bb } = ctxOf(p);
console.log("stamina", ctx.stamina, ctx.maxStamina, "pop", ctx.city.pop, "chaos", ctx.city.chaos);
for (const n of Object.keys(ACT)) {
  const a = ACT[n], L = levels[n].level;
  const c = { ...ctx, stamina: ctx.maxStamina * 0.6 };
  const pr = chance(a, L, c), t = actionTime(a, L, c);
  const ev = pr * rankGain(a, L) - (1 - pr) * rankLossAt(a, L);
  console.log(n.padEnd(30), "L", L, "count", fmt(levels[n].count, 1), "p", fmt(pr, 3), "t", t, "ev", fmt(ev, 2), "ev/s", fmt(ev / t, 4), "stam", fmt(stamCost(a, L), 2), "dmg", fmt(damage(a, L), 0));
}
