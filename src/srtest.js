/** @param {NS} ns */
export async function main(ns) {
  const b = ns.bladeburner;
  const o = [];
  try { const s = b.getCity(); o.push("stadt " + s);
    o.push("pop " + b.getCityEstimatedPopulation(s));
    o.push("chaos " + b.getCityChaos(s));
  } catch (e) { o.push("stadt/pop FEHLER " + String(e)); }
  try { const c = b.getActionEstimatedSuccessChance("Operations", "Stealth Retirement Operation");
    o.push("chance " + JSON.stringify(c));
  } catch (e) { o.push("chance FEHLER " + String(e)); }
  ns.write("data/srtest.json", JSON.stringify(o), "w");
}
