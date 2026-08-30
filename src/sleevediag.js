/** @param {NS} ns */
export async function main(ns) {
  const out = { zeit: Date.now() };
  try { out.task = ns.sleeve.getTask(0); } catch (e) { out.taskErr = String(e).slice(0, 140); }
  try { const s = ns.sleeve.getSleeve(0);
    out.skills = s.skills; out.shock = s.shock; out.sync = s.sync; out.memory = s.memory;
  } catch (e) { out.sleeveErr = String(e).slice(0, 140); }
  try {
    out.vorrat = {};
    for (const a of ["Tracking", "Bounty Hunter", "Retirement"])
      out.vorrat[a] = ns.bladeburner.getActionCountRemaining("Contracts", a);
  } catch (e) { out.vorratErr = String(e).slice(0, 140); }
  ns.write("data/sleevediag.json", JSON.stringify(out), "w");
}
