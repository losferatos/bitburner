/**
 * Corp-Einmalskript: Gruendung, Investorenrunde, Boersengang. Gestartet von corp.js.
 * RAM: 1,6 + 3 x 20 + 10 = 71,6 GB.
 *
 * `cc` gruendet IMMER mit selfFund=false (Falle F1: die Vorgabe true will
 * 150 Mrd vom Spieler, NetscriptFunctions/Corporation.ts:629-631).
 * `ai` nimmt das Angebot nur an, wenn es die erwartete Runde ist und mindestens `minFunds` bringt -
 * Angebot und Annahme im selben Skript, damit dazwischen kein Zustand liegt.
 */
import { runAct } from "lib/corpact.js";
/** @param {NS} ns */
export async function main(ns) {
  const c = ns.corporation;
  runAct(ns, {
    cc: (name) => c.createCorporation(name, false),
    io: () => c.getInvestmentOffer(),
    ai: (minFunds, round) => {
      const off = c.getInvestmentOffer();
      // nur die ERWARTETE Runde: nach Zustandsverlust ginge sonst Runde 2 (35 %) als "Runde 1" raus
      if ((round !== -1 && off.round !== round) || !(off.funds >= minFunds)) return { accepted: false, offer: off };
      return { accepted: c.acceptInvestmentOffer(), offer: off };
    },
    gp: (n) => c.goPublic(n),
  });
}
