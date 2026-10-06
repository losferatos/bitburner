/**
 * Corp-Einmalskript: Boersengang, Anteilsverkauf, Bestechung (Etappe 3). Gestartet von corp.js.
 * RAM: 1,6 + goPublic 20 + sellShares 20 + bribe 20 + getCorporation 10 = 71,6 GB.
 *
 * `sl` (Ziel in $, behaltene Anteile, ipo, Hoechstanteil je Verkauf):
 *   - ipo=true und noch privat: goPublic(0) und IM SELBEN AUFRUF verkaufen. Der Startkurs kommt aus
 *     der PRIVATEN Durchschnittsbewertung (Actions.ts:144-159); ein spaeterer Verkauf saehe die
 *     oeffentliche (~3,7x kleiner beim profitablen Unternehmen, strategie.md F5).
 *   - Anteilszahl aus dem nachgebauten calculateShareSale (corplib.sharesForMoney), gedeckelt auf
 *     1e14 (helpers.ts:98) und so, dass `keep` Anteile bleiben (nie alle, helpers.ts:97).
 *   - Rueckgabe: {n, got (tatsaechlich), pred (vorhergesagt), price, ipo, cool}
 * `bb` (Faktion, Betrag): bribe aus der Corp-Kasse, 1 Ruf je 1e9 (Constants.ts:62). Rueckgabe bool.
 */
import { runAct } from "lib/corpact.js";
import { sharesForMoney, shareSaleProfit } from "lib/corplib.js";

/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    sl: (money, keep, ipo, maxPart) => {
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
      const n = Math.max(1, Math.min(maxN, sharesForMoney(corp, money, maxN)));
      const pred = shareSaleProfit(corp, n);
      const got = c.sellShares(n);
      return { n, got, pred, price: corp.sharePrice, valuation: corp.valuation, owned: corp.numShares, total: corp.totalShares, ipo: didIpo };
    },
    bb: (faction, amount) => c.bribe(faction, amount),
  });
}
