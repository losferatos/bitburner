/**
 * Corp-Einmalskript: Produkte entwickeln und einstellen. Gestartet von corp.js.
 * RAM: 1,6 + 2 x 20 = 41,6 GB.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    mp: (d, city, name, design, marketing) => c.makeProduct(d, city, name, design, marketing),
    dp: (d, name) => c.discontinueProduct(d, name),
  });
}
