/**
 * Takt-Logik fuer Material-Divisionen, geteilt von corp-tickb.js (Boosts) und corp-tick.js (Einkauf +
 * Verkauf). KEIN ns-Funktionsname hier (RAM): die Skripte reichen ihre Funktionen als api.gm/bp/bm/sm
 * herein. Zerlegt am 06.10.2026 (corp-e2c), weil nach dem ersten Einbau kein Wirt > 64 GB frei war.
 * Inhalt unveraendert aus corp-tick.js (Fassung corp-e2b), nur nach Modus getrennt.
 */
import { INDUSTRY, MAT, boostTarget, flowSpace, priceMaterial, priceExpr, productionMultFromBoosts } from "lib/corplib.js";

/**
 * @param {object} api  gm (Material lesen), bp (Sofortkauf), bm (Rate), sm (Verkauf) - je nach Modus nur ein Teil
 * @param {object} order Auftrag wie im Kopf von corp-tick.js
 * @param {"boost"|"trade"} mode boost = Schritte 1-3, trade = Schritte 1 und 4-5
 */
export function runTick(api, order, mode) {
  const out = { job: order.job, ok: 0, err: [], price: {}, boost: {}, spent: 0, diag: {}, boostPending: false };
  try {
    let cash = order.cash;
    const price = order.price || {};
    for (const dv of order.divs || []) {
      const ind = INDUSTRY[dv.ind];
      const boostMats = Object.keys(ind.factors);
      // --- 1. Lesen
      const mats = {};
      for (const city of dv.cities) {
        mats[city] = {};
        for (const m of [...ind.prod, ...Object.keys(ind.req), ...boostMats]) mats[city][m] = api.gm(dv.name, city, m);
      }
      const stocks = () => {
        const r = {};
        for (const city of dv.cities) {
          r[city] = {};
          for (const m of boostMats) r[city][m] = mats[city][m].stored;
        }
        return r;
      };
      // Produktdivision: je fertigem Produkt dieselbe Hoechstproduktion (Division.ts:856-875, ohne Grenzen)
      const unitsOf = (city, pm) => dv.officeProd[city] * pm * dv.mult * 10 * (ind.products ? dv.nProducts || 0 : 1);
      let pm = productionMultFromBoosts(ind.factors, stocks());
      const boost = dv.boost || {};
      // --- 2. Boost-Ziel neu (nur auf Anweisung des Koordinators, mit Budget)
      if (mode === "boost" && dv.boostOrder) {
        const per = dv.boostOrder.budget / dv.cities.length;
        for (const city of dv.cities) {
          const wh = dv.wh[city];
          const S = Math.max(0, Math.min(wh.size * dv.boostOrder.frac, wh.size - flowSpace(ind, unitsOf(city, pm)) - 1));
          const stored = {}, pr = {};
          for (const m of boostMats) {
            stored[m] = mats[city][m].stored;
            pr[m] = mats[city][m].marketPrice;
          }
          boost[city] = boostTarget(ind.factors, boost[city] || {}, stored, pr, S, per).target;
        }
      }
      // --- 3. Boosts kaufen (sofort)
      for (const city of mode === "boost" ? dv.cities : []) {
        const bt = boost[city];
        if (!bt) continue;
        const wh = dv.wh[city];
        let free = wh.size - wh.used - flowSpace(ind, unitsOf(city, pm));
        for (const [m, target] of Object.entries(bt)) {
          const need = target - mats[city][m].stored;
          if (!(need > 1) || !(free > 0)) continue;
          let amt = Math.min(need, (free / MAT[m].size) * 0.999);
          amt = Math.min(amt, (cash * 0.999) / mats[city][m].marketPrice);
          if (!(amt > 1)) continue;
          try {
            api.bp(dv.name, city, m, amt);
            out.ok++;
            const cost = amt * mats[city][m].marketPrice;
            cash -= cost;
            out.spent += cost;
            free -= amt * MAT[m].size;
            wh.used += amt * MAT[m].size;
            mats[city][m] = { ...mats[city][m], stored: mats[city][m].stored + amt };
          } catch (e) {
            out.err.push(`bp/${dv.name}/${city}/${m}: ${String(e).slice(0, 120)}`);
          }
        }
      }
      out.boost[dv.name] = boost;
      // offen gebliebene Boost-Ziele -> der Koordinator startet das Boost-Skript im naechsten Zyklus wieder
      for (const city of dv.cities) for (const [m, target] of Object.entries(boost[city] || {})) if (target - mats[city][m].stored > 1) out.boostPending = true;
      pm = productionMultFromBoosts(ind.factors, stocks());
      // --- 4. Rohstoffe: Rate = Bedarf dieses Zyklus / 10 s
      for (const city of mode === "trade" ? dv.cities : []) {
        const units = unitsOf(city, pm);
        for (const [m, q] of Object.entries(ind.req)) {
          const mt = mats[city][m];
          // intern belieferte Rohstoffe (Export) nur zum Anlauf kaufen: Marktware hat Qualitaet 1 und
          // verduennt den Bestand (Division.ts:571, Falle F10) - wie corpsim.ts supply()
          const internal = (dv.internal || []).includes(m) && (mt.importAmount > 0 || mt.stored > 0);
          const rate = internal ? 0 : Math.max(0, q * units - mt.stored) / 10;
          if (Math.abs(rate - (mt.buyAmount || 0)) <= 1e-9 * Math.max(1, rate)) continue;
          try {
            api.bm(dv.name, city, m, rate);
            out.ok++;
          } catch (e) {
            out.err.push(`bm/${dv.name}/${city}/${m}: ${String(e).slice(0, 120)}`);
          }
        }
        // --- 5. Verkauf
        for (const m of ind.prod) {
          const mt = mats[city][m];
          const key = dv.name + "|" + city + "|" + m;
          const prev = price[key];
          const p = priceMaterial(prev, {
            mpLast: prev ? prev.mp : NaN,
            quality: mt.quality,
            stored: mt.stored,
            sold: mt.actualSellAmount,
            offer: Math.max(0, mt.stored / 10 + units / 10 - ((dv.exportOut || {})[city + "|" + m] || 0)),
          }, MAT[m].markup);
          p.mp = mt.marketPrice;
          out.price[key] = p;
          const expr = priceExpr(p);
          if (mt.desiredSellPrice === expr && mt.desiredSellAmount === "MAX") continue;
          try {
            api.sm(dv.name, city, m, "MAX", expr);
            out.ok++;
          } catch (e) {
            out.err.push(`sm/${dv.name}/${city}/${m}: ${String(e).slice(0, 120)}`);
          }
        }
        out.diag[dv.name + "|" + city] = { units, pm, plants: mats[city].Plants ? mats[city].Plants.productionAmount : 0 };
      }
    }
  } catch (e) {
    out.err.push("tick: " + String(e && e.stack ? e.stack : e).slice(0, 300));
  }
  return out;
}
