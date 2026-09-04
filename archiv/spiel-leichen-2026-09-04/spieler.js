export async function main(ns) {
  const p = ns.getPlayer(); const z = [];
  const inst = ns.singularity.getOwnedAugmentations(false);
  z.push("Hacking " + p.skills.hacking + " / 4500   Geld $" + (p.money/1e9).toFixed(2) + "b");
  z.push("mults hack " + p.mults.hacking.toFixed(3) + "  hacking_exp " + p.mults.hacking_exp.toFixed(3)
    + "  faction_rep " + p.mults.faction_rep.toFixed(3));
  z.push("Augmentierungen eingebaut: " + inst.length);
  z.push("Faktionen (" + p.factions.length + "): " + p.factions.join(", "));
  z.push("home " + ns.getServerMaxRam("home") + " GB / " + ns.getServer("home").cpuCores + " Kerne");
  ns.write("data/spieler.txt", z.join("\n"), "w");
  if (ns.getHostname() !== "home") ns.scp("data/spieler.txt", "home", ns.getHostname());
}
