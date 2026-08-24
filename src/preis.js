/** Was kosten gekaufte Rechner in diesem BitNode?
 * @param {NS} ns */
export async function main(ns) {
  const out = {};
  for (const gb of [8, 16, 32, 64, 128]) {
    try { out[gb] = ns.cloud.getServerCost(gb); } catch (e) { out[gb] = String(e); }
  }
  out.geld = ns.getServerMoneyAvailable("home");
  out.limit = ns.cloud.getServerLimit();
  ns.write("data/preis.json", JSON.stringify(out), "w");
  if (ns.getHostname() !== "home") ns.scp("data/preis.json", "home", ns.getHostname());
}
