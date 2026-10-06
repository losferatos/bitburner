/**
 * Corp-Einmalskript: Export-Routen zwischen Divisionen. Gestartet von corp.js, nur wenn sich
 * eine Menge um > 10 % aendert (Mengen sind Ausdruecke "X-IINV/10" und bleiben im Spiel stehen).
 * RAM: 1,6 + 2 x 20 = 41,6 GB.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    ex: (src, city, dst, dcity, mat, amt) => c.exportMaterial(src, city, dst, dcity, mat, amt),
    cx: (src, city, dst, dcity, mat) => c.cancelExportMaterial(src, city, dst, dcity, mat),
  });
}
