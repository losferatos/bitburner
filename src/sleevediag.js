/** @param {NS} ns */
// Reine Lesediagnose: Aufgabe und Zustand ALLER Sleeves (14.10.2026 auf alle
// erweitert - vorher nur Sleeve 0).
export async function main(ns) {
  const out = { zeit: Date.now(), sleeves: [] };
  for (let i = 0; i < 8; i++) {
    const e = { nr: i };
    try { e.task = ns.sleeve.getTask(i); } catch (err) { e.taskErr = String(err).slice(0, 140); break; }
    try { const s = ns.sleeve.getSleeve(i);
      e.skills = s.skills; e.shock = s.shock; e.sync = s.sync; e.storedCycles = s.storedCycles;
      e.city = s.city;
    } catch (err) { e.sleeveErr = String(err).slice(0, 140); }
    out.sleeves.push(e);
  }
  try {
    out.vorrat = {};
    for (const a of ["Tracking", "Bounty Hunter", "Retirement"])
      out.vorrat[a] = ns.bladeburner.getActionCountRemaining("Contracts", a);
  } catch (e) { out.vorratErr = String(e).slice(0, 140); }
  ns.write("data/sleevediag.json", JSON.stringify(out), "w");
}
