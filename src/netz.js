/** Netzuebersicht: welcher Rechner hat wieviel RAM und ist gerootet?
 * @param {NS} ns */
export async function main(ns) {
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  const liste = [];
  for (const h of bekannt) {
    const s = ns.getServer(h);
    liste.push({
      host: h, ram: s.maxRam, frei: s.maxRam - s.ramUsed,
      root: s.hasAdminRights, ports: s.numOpenPortsRequired,
      level: s.requiredHackingSkill, geld: s.moneyMax,
    });
  }
  liste.sort((a, b) => b.ram - a.ram);
  ns.write("data/netz.json", JSON.stringify({ zeit: Date.now(), liste }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/netz.json", "home", ns.getHostname());
}
