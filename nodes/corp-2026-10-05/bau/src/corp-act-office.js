/**
 * Corp-Einmalskript: Bueros (einstellen, Jobs, Groesse). Gestartet von corp.js.
 * RAM: 1,6 + 3 x 20 = 61,6 GB (RamCostGenerator.ts: Aktion 20 GB).
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    he: (d, city, job) => c.hireEmployee(d, city, job),
    sj: (d, city, job, n) => c.setJobAssignment(d, city, job, n),
    uo: (d, city, n) => c.upgradeOfficeSize(d, city, n),
  });
}
