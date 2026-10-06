/**
 * Corp-Einmalskript: Boersengang, Anteilsverkauf, Bestechung (Etappe 3). Gestartet von corp.js.
 * RAM: 1,6 + goPublic 20 + sellShares 20 + getCorporation 10 = 51,6 GB (Bestechung seit corp-e2c in corp-act-bribe.js).
 *
 * `sl` (Ziel in $, behaltene Anteile, ipo, Hoechstanteil je Verkauf, Zaehler bis zur Preisstufe,
 *       Quirk-Bremse x; Begruendung im Kopf von corp.js financeWork):
 *   - ipo=true und noch privat: goPublic(0) und IM SELBEN AUFRUF verkaufen. Der Startkurs kommt aus
 *     der PRIVATEN Durchschnittsbewertung (Actions.ts:144-159); ein spaeterer Verkauf saehe die
 *     oeffentliche (~3,7x kleiner beim profitablen Unternehmen, strategie.md F5).
 *   - Anteilszahl aus dem nachgebauten calculateShareSale (corplib.sharesForMoney), gedeckelt auf
 *     1e14 (helpers.ts:98) und so, dass `keep` Anteile bleiben (nie alle, helpers.ts:97).
 *   - Rueckgabe: {n, got (tatsaechlich), pred (vorhergesagt), price, ipo, cool}
 */
import { runAct } from "lib/corpact.js";
import { sharesForMoney, shareSale } from "lib/corplib.js";

/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    sl: (money, keep, ipo, maxPart, until, quirkMax) => {
      let didIpo = false;
      const before = c.getCorporation();
      if (ipo && !before.public) {
        c.goPublic(0);
        didIpo = true;
      }
      const corp = c.getCorporation();
      if (!corp.public) return { n: 0, got: 0, ipo: didIpo, why: "privat" };
      if (corp.shareSaleCooldown > 0) return { n: 0, got: 0, ipo: didIpo, cool: corp.shareSaleCooldown };
      const maxN = Math.floor(Math.min(1e14, corp.numShares - Math.max(1, keep), corp.numShares * maxPart));
      if (!(maxN >= 1)) return { n: 0, got: 0, ipo: didIpo, why: "keine freien Anteile" };
      const u = didIpo ? 1e6 : until || 1e6;
      let n = Math.max(1, Math.min(maxN, sharesForMoney(corp, money, maxN, u)));
      let sim = shareSale(corp, n, u);
      // Quirk-Bremse: Mehrerloes > quirkMax x Ziel -> einen Anteil weniger, wenn das noch >= 50 % bringt
      let trimmed = false;
      if (quirkMax > 0 && n > 1 && sim.profit > quirkMax * money) {
        const lower = shareSale(corp, n - 1, u);
        if (lower.profit >= 0.5 * money) {
          n -= 1;
          sim = lower;
          trimmed = true;
        }
      }
      const got = c.sellShares(n);
      return { n, got, pred: sim.profit, until: sim.until, trimmed, price: corp.sharePrice, valuation: corp.valuation, owned: corp.numShares, total: corp.totalShares, ipo: didIpo };
    },
  });
}
