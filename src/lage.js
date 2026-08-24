/** Zustand der erreichbaren Ziele: Geld, Sicherheit, Level.
 * @param {NS} ns */
export async function main(ns) {
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  const p = ns.getPlayer();
  const liste = [];
  for (const h of bekannt) {
    const s = ns.getServer(h);
    if (!s.hasAdminRights || h === "home" || s.purchasedByPlayer) continue;
    if (!(s.moneyMax > 0)) continue;
    liste.push({
      host: h,
      geld: Math.round(s.moneyAvailable),
      max: Math.round(s.moneyMax),
      anteil: s.moneyMax > 0 ? +(s.moneyAvailable / s.moneyMax).toFixed(3) : 0,
      sec: +s.hackDifficulty.toFixed(2),
      minSec: +s.minDifficulty.toFixed(2),
      req: s.requiredHackingSkill,
      chance: +ns.hackAnalyzeChance(h).toFixed(3),
      anteilProFaden: +ns.hackAnalyze(h).toFixed(6),
      hackZeit: Math.round(ns.getHackTime(h) / 1000),
    });
  }
  liste.sort((a, b) => b.max - a.max);
  ns.write("data/lage.json", JSON.stringify({
    zeit: Date.now(), hacking: p.skills.hacking, geld: p.money, liste,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/lage.json", "home", ns.getHostname());
}
