/**
 * Messung: Wieviele Raid-Gemeinden liegen ueber ALLE Staedte?
 *
 * Die Black-Op-Schwelle in `blade.js` haengt daran (`blackOpSchwelle()`).
 * Diese Messung prueft, dass `getCityCommunities` fuer jede der sechs
 * Staedte antwortet - eine einzige Ausnahme wuerde die Summe verfaelschen
 * und die Schwelle stillschweigend fallen lassen.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
  const o = { je: {}, gesamt: 0, fehler: [] };
  for (const s of STAEDTE) {
    try {
      const c = ns.bladeburner.getCityCommunities(s);
      o.je[s] = c;
      o.gesamt += c;
    } catch (e) { o.fehler.push(s + ": " + String(e)); }
  }
  o.schwelle = o.gesamt >= 20 ? 0.90 : 0.40;
  ns.write("data/vorrat.json", JSON.stringify(o), "w");
}
