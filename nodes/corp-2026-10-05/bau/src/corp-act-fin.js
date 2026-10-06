/**
 * Corp-Einmalskript: Investorenrunde. Gestartet von corp.js.
 * RAM: 1,6 + getInvestmentOffer 10 + acceptInvestmentOffer 20 = 31,6 GB.
 *
 * `ai` nimmt das Angebot nur an, wenn es die erwartete Runde ist und mindestens `minFunds` bringt -
 * Angebot und Annahme im selben Skript, damit dazwischen kein Zustand liegt. Runde -1 = ohne Pruefung
 * (nur fuer den Rot-Nachweis).
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    io: () => c.getInvestmentOffer(),
    ai: (minFunds, round) => {
      const off = c.getInvestmentOffer();
      // nur die ERWARTETE Runde: nach Zustandsverlust ginge sonst Runde 2 (35 %) als "Runde 1" raus
      if ((round !== -1 && off.round !== round) || !(off.funds >= minFunds)) return { accepted: false, offer: off };
      return { accepted: c.acceptInvestmentOffer(), offer: off };
    },
  });
}
