/** Kern-Diagnose: Kosten, Geld, Ergebnis eines Kaufversuchs. */
export async function main(ns) {
  const s = ns.getServer("home");
  const kosten = ns.singularity.getUpgradeHomeCoresCost();
  const geld = ns.getServerMoneyAvailable("home");
  const z = ["Kerne " + s.cpuCores, "Kosten " + kosten.toExponential(3),
             "Geld " + geld.toExponential(3), "reicht3x " + (geld > kosten * 3)];
  const ok = ns.singularity.upgradeHomeCores();
  z.push("Kauf " + ok + " -> jetzt " + ns.getServer("home").cpuCores + " Kerne");
  ns.write("data/coreprobe.txt", z.join("\n"), "w");
  ns.tprint(z.join(" | "));
}
