/**
 * Was ist bei BitRunners noch offen, und was kostet es per Spende?
 * Einmalige Diagnose - der Bot waehlte trotz Spendenrecht ein anderes Ziel.
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const z = [];
  const p = ns.getPlayer();
  const besitz = new Set(s.getOwnedAugmentations(true));
  const f = "BitRunners";
  const rep = s.getFactionRep(f);
  z.push(`${f}: Favor ${s.getFactionFavor(f).toFixed(1)} | Rep ${ns.format.number(rep)} | Geld ${ns.format.number(p.money)} | faction_rep x${p.mults.faction_rep.toFixed(3)}`);
  let offen = 0;
  for (const a of s.getAugmentationsFromFaction(f)) {
    if (besitz.has(a)) continue;
    offen++;
    const rr = s.getAugmentationRepReq(a);
    const pr = s.getAugmentationPrice(a);
    const fehlend = Math.max(0, rr - rep);
    const spende = fehlend * 1e6 / p.mults.faction_rep;
    z.push(`  ${a} | Rep ${ns.format.number(rr)} (fehlen ${ns.format.number(fehlend)}) | Preis ${ns.format.number(pr)} | Spende ${ns.format.number(spende)} | zusammen ${ns.format.number(spende + pr)} ${spende + pr <= p.money ? "BEZAHLBAR" : "zu teuer"}`);
  }
  if (!offen) z.push("  nichts mehr offen bei BitRunners");
  const t = z.join("\n");
  ns.write("data/brcheck.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/brcheck.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
