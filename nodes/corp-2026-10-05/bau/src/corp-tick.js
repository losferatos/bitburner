/**
 * Corp-Takt fuer Material-Divisionen, Teil EINKAUF + VERKAUF: einmal je Corp-Zyklus von corp.js
 * gestartet, direkt nach START (vor PURCHASE). Logik in lib/corptick.js (Modus "trade"):
 *  - Rohstoffe (Water, Chemicals, Plants) als Rate fuer genau den Bedarf dieses Zyklus. Die Rate bleibt
 *    bei Skripttod stehen; sie entspricht dem Verbrauch.
 *  - Verkaufspreis je Material aus dem gemessenen Absatz (corplib.priceMaterial), als "MP+x"/"MP*x".
 * Die Boosts kauft corp-tickb.js (davor, nur wenn noetig).
 *
 * Auftrag (ns.args[0], JSON): {job, cash, divs:[...], price:{}}; Ergebnis auf RESULT_PORT.
 * RAM: 1,6 + getMaterial 10 + buyMaterial 20 + sellMaterial 20 = 51,6 GB.
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
    bm: (d, city, m, rate) => c.buyMaterial(d, city, m, rate),
    sm: (d, city, m, amt, price) => c.sellMaterial(d, city, m, amt, price),
  };
  sendResult(ns, runTick(api, order, "trade"));
}
