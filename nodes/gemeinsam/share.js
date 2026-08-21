/**
 * Ein-Zweck-Arbeiter: teilt RAM, bis er beendet wird.
 *
 * ns.share() erzeugt KEINERLEI Hacking-Erfahrung - anders als hack.js. Es
 * multipliziert ausschliesslich die Reputation aus Faktions- und
 * Firmenarbeit, ueber calculateCurrentShareBonus() in getHackingWorkRepGain()
 * und getFactionFieldWorkRepGain() (PersonObjects/formulas/reputation.ts:16-23).
 * Ohne laufende Faktions- oder Firmenarbeit verpufft der Bonus wirkungslos -
 * darum darf dieser Arbeiter nur eingesetzt werden, wenn genau das der Fall
 * ist (Regel steht in bn4net.js).
 *
 * Bonus: calculateShareBonus(threads) = 1 + ln(threads)/25
 * (NetworkShare/Share.ts:43). Logarithmisch, nicht linear - Verdoppeln der
 * Faeden bringt lange nicht das Doppelte an Bonus, sondern nur einen
 * konstanten Zuwachs von ln(2)/25 ~ 0,0277.
 *
 * Kosten: 1.60 GB Grundlast + 2.40 GB fuer share (RamCostGenerator.ts:575)
 * = 4.00 GB je Thread - mehr als das Doppelte von hack.js, deshalb nur die
 * HAELFTE der Faeden eines Rechners dafuer verwenden.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  while (true) {
    await ns.share();
  }
}
