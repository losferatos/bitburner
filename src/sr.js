/**
 * Messung: traegt Stealth Retirement als Chaos-Senker statt Diplomacy?
 *
 * Beide senken das Chaos prozentual (`changeChaosByPercentage`,
 * `Bladeburner.ts:853` und `:1187`), aber nur eines gibt Rang. Diese Messung
 * holt Stufe, Chance, Dauer und Rangertrag der drei Operationen, damit der
 * Vergleich nicht geschaetzt werden muss.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const b = ns.bladeburner;
  const out = [];
  for (const n of ["Raid", "Stealth Retirement Operation", "Assassination"]) {
    try {
      const lvl = b.getActionCurrentLevel("Operations", n);
      const ch = b.getActionEstimatedSuccessChance("Operations", n);
      const t = b.getActionTime("Operations", n);
      const rep = b.getActionRepGain("Operations", n, lvl);
      const rest = b.getActionCountRemaining("Operations", n);
      out.push(n + " | lvl " + lvl + " | chance " + ch[0].toFixed(3) + "-" + ch[1].toFixed(3)
        + " | zeit " + (t / 1000).toFixed(0) + "s | rep " + rep.toFixed(1) + " | rest " + rest);
    } catch (e) { out.push(n + " FEHLER " + String(e)); }
  }
  try {
    out.push("Diplomacy zeit " + (b.getActionTime("General", "Diplomacy") / 1000).toFixed(0) + "s");
    out.push("Chaos " + b.getCityChaos(b.getCity()).toFixed(2) + " | Stadt " + b.getCity());
  } catch (e) { out.push("allgemein FEHLER " + String(e)); }
  ns.write("data/sr.json", JSON.stringify(out, null, 1), "w");
}
