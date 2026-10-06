/**
 * Corp-Einmalskript: Corp-Upgrades, Freischaltungen, Forschung. Gestartet von corp.js.
 * RAM: 1,6 + 3 x 20 = 61,6 GB.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    lu: (u) => c.levelUpgrade(u),
    ul: (u) => c.purchaseUnlock(u),
    rs: (d, r) => c.research(d, r),
  });
}
