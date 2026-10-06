/**
 * Corp-Einmalskript: Tee, Feier, Werbung. Gestartet von corp.js.
 * RAM: 1,6 + 3 x 20 = 61,6 GB.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    te: (d, city) => c.buyTea(d, city),
    pa: (d, city, perHead) => c.throwParty(d, city, perHead),
    ad: (d) => c.hireAdVert(d),
  });
}
