/**
 * Corp-Einmalskript: Gruendung, IMMER selfFund=false (Falle F1, NetscriptFunctions/Corporation.ts:629-631). Gestartet von corp.js.
 * RAM: 1,6 + 1 x 20 = 21.6 GB (Familien seit corp-e2c hoechstens 2 Aktionen: jedes Kind
 * passt auf einen 64-GB-Server, Lage nach dem ersten Einbau am 06.10.2026).
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    cc: (name) => c.createCorporation(name, false),
  });
}
