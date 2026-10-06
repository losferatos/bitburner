/**
 * Corp-Einmalskript: Divisionen und Staedte. Gestartet von corp.js.
 * RAM: 1,6 + 2 x 20 = 41.6 GB (Familien seit corp-e2c hoechstens 2 Aktionen: jedes Kind
 * passt auf einen 64-GB-Server, Lage nach dem ersten Einbau am 06.10.2026).
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    ei: (ind, d) => c.expandIndustry(ind, d),
    ec: (d, city) => c.expandCity(d, city),
  });
}
