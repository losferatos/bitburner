/**
 * Messung: Waere Assassination auf einer NIEDRIGEREN Stufe fahrbar?
 *
 * `autoLevel` setzt nach jeder Aktion `level = maxLevel`
 * (`Bladeburner.ts:1004`). In der Wiederaufbauphase nach einem Einbau kann
 * das heissen: die hoechste Stufe ist zu schwer, also ruht der Motor - waehrend
 * eine niedrigere fahrbar waere.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const b = ns.bladeburner;
  const N = "Assassination";
  const o = { max: null, jetzt: null, proben: [] };
  try {
    o.max = b.getActionMaxLevel("Operations", N);
    o.jetzt = b.getActionCurrentLevel("Operations", N);
    const alt = b.getActionCurrentLevel("Operations", N);
    b.setActionAutolevel("Operations", N, false);
    for (const lvl of [o.max, Math.max(1, o.max - 4), Math.max(1, o.max - 7), 1]) {
      b.setActionLevel("Operations", N, lvl);
      const c = b.getActionEstimatedSuccessChance("Operations", N);
      const t = b.getActionTime("Operations", N) / 1000;
      const rep = b.getActionRepGain("Operations", N, lvl);
      o.proben.push({ lvl, chance: Number(c[0].toFixed(3)), zeit: Number(t.toFixed(0)), rep: Number(rep.toFixed(1)) });
    }
    b.setActionLevel("Operations", N, alt);
    b.setActionAutolevel("Operations", N, true);
  } catch (e) { o.fehler = String(e); }
  ns.write("data/stufentest.json", JSON.stringify(o), "w");
}
