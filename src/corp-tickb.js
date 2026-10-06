/**
 * Corp-Takt fuer Material-Divisionen, Teil BOOSTS: von corp.js VOR corp-tick.js gestartet, nur wenn ein
 * neues Boost-Ziel ansteht oder Ziele offen sind. Logik in lib/corptick.js (Modus "boost"):
 * Boost-Material per bulkPurchase sofort kaufen (keine stehende Rate, F8), nur neben dem Durchfluss
 * eines Zyklus (F9).
 * RAM: 1,6 + getMaterial 10 + bulkPurchase 20 = 31,6 GB.
 */
import { runTick } from "lib/corptick.js";
import { sendResult } from "lib/corpact.js";

/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  let order = {};
  try {
    order = JSON.parse(String(ns.args[0] || "{}"));
  } catch {
    /* leer */
  }
  const api = {
    gm: (d, city, m) => c.getMaterial(d, city, m),
    bp: (d, city, m, amt) => c.bulkPurchase(d, city, m, amt),
  };
  sendResult(ns, runTick(api, order, "boost"));
}
