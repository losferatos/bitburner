/**
 * Speicher teilen - der Hebel auf die Faktionsreputation.
 *
 * `getHackingWorkRepGain` multipliziert den Ertrag direkt mit
 * `calculateCurrentShareBonus()` (PersonObjects/formulas/reputation.ts). Der
 * Bonus ist `1 + ln(Faeden)/25` (NetworkShare/Share.ts) - rein logarithmisch.
 *
 * Diese Datei enthaelt mit Absicht NICHTS ausser der Schleife. Jeder weitere
 * Aufruf im Quelltext schlaegt auf die Kosten JEDES Fadens durch: 1,6 GB
 * Grundlast plus 2,4 GB fuer `share` sind 4,0 GB, und bei zehntausenden Faeden
 * kostet jedes zusaetzliche Zehntel echten Speicher.
 *
 * `ns.share()` laeuft je Aufruf zehn Sekunden (ShareBonusTime = 10000) und
 * gibt den Speicher danach frei - deshalb die Endlosschleife. Beendet wird
 * das Skript von aussen, vom Autopiloten.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  for (;;) await ns.share();
}
