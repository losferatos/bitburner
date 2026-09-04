/** Warum faellt Daedalus aus der Rangliste? */
export async function main(ns) {
  const p = ns.getPlayer();
  const inst = ns.singularity.getOwnedAugmentations(false);
  const mitGekauft = ns.singularity.getOwnedAugmentations(true);
  const z = [];
  z.push("Faktionen: " + p.factions.join(", "));
  z.push("Daedalus Mitglied: " + p.factions.includes("Daedalus"));
  z.push("TRP installiert: " + inst.includes("The Red Pill"));
  z.push("TRP gekauft/besessen: " + mitGekauft.includes("The Red Pill"));
  z.push("Warteschlange: " + mitGekauft.filter((a) => !inst.includes(a)).join(" | "));
  if (p.factions.includes("Daedalus")) {
    const augs = ns.singularity.getAugmentationsFromFaction("Daedalus");
    z.push("Daedalus bietet: " + augs.join(" | "));
    z.push("davon offen: " + augs.filter((a) => !mitGekauft.includes(a)).join(" | "));
    z.push("Daedalus Rep: " + ns.singularity.getFactionRep("Daedalus").toFixed(0)
      + "  Favor: " + ns.singularity.getFactionFavor("Daedalus").toFixed(1));
  }
  ns.write("data/rpdiag.txt", z.join("\n"), "w");
}
