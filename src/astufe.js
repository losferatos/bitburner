/** @param {NS} ns */
export async function main(ns) {
  const b = ns.bladeburner;
  const o = {};
  for (const n of ["Assassination", "Raid", "Stealth Retirement Operation"]) {
    try {
      o[n] = { lvl: b.getActionCurrentLevel("Operations", n), max: b.getActionMaxLevel("Operations", n),
        chance: Number(b.getActionEstimatedSuccessChance("Operations", n)[0].toFixed(3)) };
    } catch (e) { o[n] = "FEHLER"; }
  }
  try { o.overclock = b.getSkillLevel("Overclock"); o.blade = b.getSkillLevel("Blade's Intuition"); } catch {}
  ns.write("data/astufe.json", JSON.stringify(o), "w");
}
