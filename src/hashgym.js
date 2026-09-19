/**
 * Einmal-Werkzeug (19.09.2026, auf Erics Ansage "gib du die hashes mal aus"):
 * gibt den Hash-Vorrat fuer "Improve Gym Training" aus (+20 % Gym-EXP je
 * Stufe fuer Spieler und Sleeves, Work/Formulas.ts:113; haelt bis zum
 * naechsten Install) und beendet sich. Kein Dauerlaeufer.
 * Ergebnis in data/hashgym.txt.
 * @param {NS} ns
 */
export async function main(ns) {
  const UPG = "Improve Gym Training";
  const vorher = ns.hacknet.numHashes();
  let stufen = 0;
  while (ns.hacknet.spendHashes(UPG)) stufen++;
  const text = new Date().toLocaleTimeString() + "  " + stufen + " Stufen gekauft, Hashes "
    + Math.round(vorher) + " -> " + Math.round(ns.hacknet.numHashes())
    + ", Gym-Faktor jetzt " + ns.hacknet.getTrainingMult().toFixed(2);
  ns.write("data/hashgym.txt", text + "\n", "a");
  if (ns.getHostname() !== "home") { try { ns.scp("data/hashgym.txt", "home"); } catch { /* egal */ } }
  ns.tprint(text);
}
