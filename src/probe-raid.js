/** Einmal-Probe (04.10.2026): je Stadt Spannen von Raid und naechster Black
 * Op, popEst, Chaos, Gemeinden. Wechselt synchron (ohne await) durch die
 * Staedte und zurueck - switchCity ist ein reines Feldsetzen.
 * Ergebnis nach data/probe-raid.json.
 * @param {NS} ns */
export async function main(ns) {
  const heimat = ns.bladeburner.getCity();
  const bo = ns.bladeburner.getNextBlackOp();
  const aus = { zeit: Date.now(), rang: ns.bladeburner.getRank(), heimat, bo: bo ? bo.name : null, staedte: {} };
  const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
  try {
    for (const stadt of STAEDTE) {
      ns.bladeburner.switchCity(stadt);
      aus.staedte[stadt] = {
        raid: ns.bladeburner.getActionEstimatedSuccessChance("Operations", "Raid"),
        bo: bo ? ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", bo.name) : null,
        popEst: ns.bladeburner.getCityEstimatedPopulation(stadt),
        chaos: ns.bladeburner.getCityChaos(stadt),
        comms: ns.bladeburner.getCityCommunities(stadt),
      };
    }
  } finally {
    ns.bladeburner.switchCity(heimat);
  }
  ns.write("data/probe-raid.json", JSON.stringify(aus), "w");
  if (ns.getHostname() !== "home") ns.scp("data/probe-raid.json", "home");
}
