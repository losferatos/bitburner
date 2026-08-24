/** Einmaliger Steckbrief nach data/stat.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  const p = ns.getPlayer();
  const besitz = new Set(ns.singularity.getOwnedAugmentations(true));
  const rep = {}, offen = [];
  for (const f of p.factions) {
    const r = ns.singularity.getFactionRep(f);
    rep[f] = Math.round(r);
    for (const a of ns.singularity.getAugmentationsFromFaction(f)) {
      if (besitz.has(a) || a.startsWith("NeuroFlux")) continue;
      const req = ns.singularity.getAugmentationRepReq(a);
      offen.push({ aug: a, fak: f, req: Math.round(req),
        luecke: Math.round(req - r),
        preis: ns.singularity.getAugmentationPrice(a) });
    }
  }
  offen.sort((a, b) => a.luecke - b.luecke);
  ns.write("data/stat.json", JSON.stringify({
    zeit: Date.now(), hacking: p.skills.hacking, exp: p.exp.hacking,
    intelligence: p.skills.intelligence, intExp: p.exp.intelligence,
    geld: p.money, rep, offen: offen.slice(0, 12),
    warteschlange: ns.singularity.getOwnedAugmentations(true)
      .filter((a) => !ns.singularity.getOwnedAugmentations(false).includes(a)),
  }), "w");
}
