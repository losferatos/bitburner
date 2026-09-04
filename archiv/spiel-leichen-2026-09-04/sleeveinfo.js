/** Einmaliger Diagnoselauf: Sleeve-Zustand und kaufbare Augmentierungen. */
export async function main(ns) {
  const out = [];
  const n = ns.sleeve.getNumSleeves();
  for (let i = 0; i < n; i++) {
    const s = ns.sleeve.getSleeve(i);
    out.push("sleeve " + i + " shock=" + s.shock.toFixed(2) + " sync=" + s.sync.toFixed(1)
      + " skills=" + JSON.stringify(s.skills));
  }
  let augs = [];
  try { augs = ns.sleeve.getSleevePurchasableAugs(0); } catch (e) { out.push("augs: " + e); }
  augs.sort((a, b) => a.cost - b.cost);
  out.push("kaufbar: " + augs.length);
  for (const a of augs.slice(0, 40)) out.push("  " + a.cost + "  " + a.name);
  out.push("geld=" + ns.getPlayer().money);
  ns.write("data/sleeveinfo.txt", out.join("\n"), "w");
  if (ns.getHostname() !== "home") ns.scp("data/sleeveinfo.txt", "home", ns.getHostname());
}
