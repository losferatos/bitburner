/**
 * Corp-Takt fuer Produkte (Tobacco): einmal je Zyklus von corp.js gestartet, nach START.
 *
 * Je fertigem Produkt und Stadt:
 *  - Verkauf "MAX" zu "MP+x" (corplib.priceProduct, nur aus getProduct-Rueckgaben). MP ist dort
 *    productionCost (Division.ts:283-288) - der Ausdruck wandert bei Skripttod mit.
 *  - Mit Market-TA.II (Auftrag ta2=true) nur noch "MAX"/"MP"; setProductMarketTA2 setzt corp.js einmal je
 *    Produkt ueber corp-act-rs.js (seit corp-e2c, RAM). Das Spiel rechnet den Preis dann selbst exakt.
 *  - Meldet fuer JEDES Produkt Fortschritt/Rating (ersetzt seit corp-e2c getProduct im Koordinator).
 *  - Produktionsgrenze = gemessener Absatz, aber nur bei Lager > 80 % (corplib.productLimit, F9).
 *    Die Grenze bleibt im Spiel stehen.
 *
 * Auftrag (ns.args[0], JSON): {job, div, cities, products:[name], ta2, fill:{city: Lagerfuellung 0..1}, price:{}}
 * Ergebnis auf RESULT_PORT: {job, ok, err, price, diag}
 * RAM: 1,6 + getProduct 10 + sellProduct 20 + limitProductProduction 20 = 51,6 GB.
 */
import { priceProduct, productLimit, priceExpr } from "lib/corplib.js";
import { sendResult } from "lib/corpact.js";

/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  const out = { job: "?", ok: 0, err: [], price: {}, diag: {}, info: {} };
  try {
    const order = JSON.parse(String(ns.args[0] || "{}"));
    out.job = order.job;
    const price = order.price || {};
    for (const name of order.products || []) {
      for (const city of order.cities) {
        const p = c.getProduct(order.div, city, name);
        if (city === order.main) out.info[name] = { developmentProgress: p.developmentProgress, rating: p.rating, effectiveRating: p.effectiveRating };
        if (p.developmentProgress < 100) continue;
        const key = name + "|" + city;
        const prev = price[key];
        const MP = p.productionCost;
        // productionCost wird erst im SALE-Zustand gesetzt; vor dem ersten Verkauf ist es 0 - dann
        // KEINEN Preis setzen ("MP*1e6" waere 0 und verschenkte alles, helpers.ts:145-148)
        if (!(MP > 0) && !order.ta2) continue;
        const pr = priceProduct(prev, { mpLast: prev ? prev.mp : NaN, sold: p.actualSellAmount, offer: p.stored / 10 + p.productionAmount });
        const rec = { K: pr.K, mp: MP, P: pr.kind === "add" ? MP + pr.x : MP * pr.x };
        out.price[key] = rec;
        const expr = order.ta2 ? "MP" : priceExpr(pr);
        if (!(p.desiredSellAmount === "MAX" && p.desiredSellPrice === expr)) {
          try {
            c.sellProduct(order.div, city, name, "MAX", expr, false);
            out.ok++;
          } catch (e) {
            out.err.push(`sp/${key}: ${String(e).slice(0, 120)}`);
          }
        }
        const probing = !order.ta2 && !(pr.K > 0);
        const lim = order.noFixLimit
          ? (((order.fill || {})[city] || 0) > 0.8 && p.actualSellAmount > 0 ? p.actualSellAmount * 1.05 : undefined)
          : productLimit({ fill: (order.fill || {})[city] || 0, sold: p.actualSellAmount, limit: p.productionLimit, prod: p.productionAmount, ta2: order.ta2, isProbe: probing });
        if (lim !== undefined) {
          try {
            c.limitProductProduction(order.div, city, name, lim);
            out.ok++;
          } catch (e) {
            out.err.push(`lp/${key}: ${String(e).slice(0, 120)}`);
          }
        }
        out.diag[key] = { stored: p.stored, sold: p.actualSellAmount, prod: p.productionAmount, lim: p.productionLimit, eff: p.effectiveRating };
      }
    }
  } catch (e) {
    out.err.push("tickp: " + String(e && e.stack ? e.stack : e).slice(0, 300));
  }
  sendResult(ns, out);
}
