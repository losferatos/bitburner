/** @param {NS} ns */
export async function main(ns) {
  const b = ns.bladeburner;
  const o = [];
  for (const n of b.getBlackOpNames()) {
    let rest = 0;
    try { rest = b.getActionCountRemaining("Black Operations", n); } catch { continue; }
    if (rest <= 0) continue;
    try {
      const t = b.getActionTime("Black Operations", n) / 1000;
      const c = b.getActionEstimatedSuccessChance("Black Operations", n);
      o.push(n + " | " + t.toFixed(0) + "s | " + c[0].toFixed(3) + "-" + c[1].toFixed(3));
    } catch (e) { o.push(n + " FEHLER"); }
    if (o.length >= 4) break;
  }
  try {
    o.push("Raid " + (b.getActionTime("Operations", "Raid") / 1000).toFixed(0) + "s");
    o.push("Rang " + b.getRank().toFixed(0));
  } catch { /* egal */ }
  ns.write("data/bodauer.json", JSON.stringify(o), "w");
}
