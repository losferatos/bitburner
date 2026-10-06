/**
 * Corp-Einmalskript: Divisionen, Staedte, Lager. Gestartet von corp.js.
 * RAM: 1,6 + 4 x 20 = 81,6 GB.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    ei: (ind, d) => c.expandIndustry(ind, d),
    ec: (d, city) => c.expandCity(d, city),
    pw: (d, city) => c.purchaseWarehouse(d, city),
    uw: (d, city, n) => c.upgradeWarehouse(d, city, n),
  });
}
