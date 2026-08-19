/**
 * Ein-Zweck-Arbeiter: senkt die Sicherheitsstufe des Ziels einmal.
 * Kosten: 1.60 GB Grundlast + 0.15 GB fuer weaken = 1.75 GB.
 *
 * args: [ziel, verzoegerungMs]
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.weaken(ns.args[0], { additionalMsec: ns.args[1] ?? 0 });
}
