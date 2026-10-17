/** Einmal-Probe (17.10.2026): Spannen aller Operationen in der aktuellen
 * Stadt, dazu Stufen und Vorrat. Ergebnis nach data/probe-ass.json.
 * @param {NS} ns */
export async function main(ns) {
  const b = ns.bladeburner;
  const aus = { zeit: Date.now(), stadt: b.getCity(), ops: {} };
  for (const n of b.getOperationNames()) {
    aus.ops[n] = { spanne: b.getActionEstimatedSuccessChance("Operations", n),
      stufe: b.getActionCurrentLevel("Operations", n), max: b.getActionMaxLevel("Operations", n),
      vorrat: b.getActionCountRemaining("Operations", n) };
  }
  ns.write("data/probe-ass.json", JSON.stringify(aus), "w");
  if (ns.getHostname() !== "home") ns.scp("data/probe-ass.json", "home");
}
