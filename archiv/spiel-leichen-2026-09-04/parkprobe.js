/** @param {NS} ns */
export async function main(ns) {
  const out = { limit: ns.cloud.getServerLimit(), server: {} };
  for (const n of ns.cloud.getServerNames()) out.server[n] = [ns.getServerMaxRam(n), +(ns.getServerMaxRam(n) - ns.getServerUsedRam(n)).toFixed(1)];
  out.home = [ns.getServerMaxRam("home"), +(ns.getServerMaxRam("home") - ns.getServerUsedRam("home")).toFixed(1)];
  out.preis1024 = ns.cloud.getServerCost(1024); out.preis2048 = ns.cloud.getServerCost(2048);
  ns.write("data/parkprobe.txt", JSON.stringify(out), "w");
  if (ns.getHostname() !== "home") ns.scp("data/parkprobe.txt", "home", ns.getHostname());
}
