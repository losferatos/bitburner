/**
 * Corp-Einmalskript: Forschung und Market-TA.II an Produkten. Gestartet von corp.js.
 * RAM: 1,6 + 2 x 20 = 41.6 GB (Familien seit corp-e2c hoechstens 2 Aktionen: jedes Kind
 * passt auf einen 64-GB-Server, Lage nach dem ersten Einbau am 06.10.2026).
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    rs: (d, r) => c.research(d, r),
    t2: (d, name) => c.setProductMarketTA2(d, name, true),
  });
}
