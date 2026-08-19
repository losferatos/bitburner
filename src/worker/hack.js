/**
 * Ein-Zweck-Arbeiter: hackt einmal und beendet sich.
 *
 * Bewusst winzig gehalten - jede zusaetzliche ns-Funktion wuerde den
 * RAM-Bedarf JEDES Threads erhoehen, und davon laufen tausende.
 * Kosten: 1.60 GB Grundlast + 0.10 GB fuer hack = 1.70 GB.
 *
 * args: [ziel, verzoegerungMs]
 * Die Verzoegerung liegt bewusst INNERHALB der Aktion (additionalMsec)
 * statt in einem sleep davor: nur so ist der Landezeitpunkt exakt.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.hack(ns.args[0], { additionalMsec: ns.args[1] ?? 0 });
}
