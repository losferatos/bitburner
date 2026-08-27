/** Reichen Rang und Chance fuer die 21 Black Operations? Alle auf einmal.
 *
 * Der Ausgang aus BitNode 6 fuehrt ueber 21 Black Ops, nicht ueber das
 * Hackniveau. `bbspann.js` zeigt aber immer nur die NAECHSTE - damit laesst
 * sich nicht beantworten, was die eigentliche Frage ist: Ist der Rang der
 * Engpass oder die Erfolgschance? Am 27.08. um 17:50 stand die Schwelle
 * `SICHER_BLACKOP` auf 0,40, und die Begruendung dafuer stuetzte sich auf
 * eine Rangrechnung gegen Bounty Hunter mit 2,0 Rang je Minute - gemessen
 * wurden zu dem Zeitpunkt 15,67.
 *
 * Ergebnis nach data/blackops.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) {
    ns.write("data/blackops.json", JSON.stringify({
      zeit: Date.now(), fehler: "nicht in der Division" }), "w");
    return;
  }
  const rang = ns.bladeburner.getRank();
  const liste = [];
  for (const name of ns.bladeburner.getBlackOpNames()) {
    const eintrag = { name, rang: ns.bladeburner.getBlackOpRank(name) };
    // Erledigte Black Ops melden Stufe 0 und lassen sich nicht mehr abfragen -
    // die Ausnahme ist das Kennzeichen, nicht ein Fehler.
    try {
      const s = ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", name);
      eintrag.min = s[0];
      eintrag.max = s[1];
      eintrag.dauer = ns.bladeburner.getActionTime("Black Operations", name);
    } catch { eintrag.erledigt = true; }
    liste.push(eintrag);
  }
  ns.write("data/blackops.json", JSON.stringify({
    zeit: Date.now(), rang, liste }), "w");
}
