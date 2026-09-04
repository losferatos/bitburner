/** @param {NS} ns */
export async function main(ns) {
  const p = ns.getPlayer();
  const out = {
    zeit: Date.now(),
    hacking: p.skills.hacking,
    hackingExp: p.exp.hacking,
    money: p.money,
    city: p.city,
    factions: p.factions,
    mults: {
      hacking: p.mults.hacking,
      hacking_exp: p.mults.hacking_exp,
      faction_rep: p.mults.faction_rep,
      hacking_money: p.mults.hacking_money,
    },
    augs: ns.singularity ? null : null,
  };
  try { out.augsInstalled = ns.singularity.getOwnedAugmentations(false).length; } catch (e) { out.augsInstalled = 'n/a'; }
  try { out.augsQueued = ns.singularity.getOwnedAugmentations(true).length; } catch (e) { out.augsQueued = 'n/a'; }
  try {
    const rep = {};
    for (const f of p.factions) rep[f] = Math.round(ns.singularity.getFactionRep(f));
    out.rep = rep;
    const fav = {};
    for (const f of p.factions) fav[f] = Math.round(ns.singularity.getFactionFavor(f) * 10) / 10;
    out.favor = fav;
  } catch (e) { out.rep = 'n/a: ' + e; }
  try { out.work = JSON.stringify(ns.singularity.getCurrentWork()); } catch (e) { out.work = 'n/a'; }
  ns.write('data/wachestat.json', JSON.stringify(out, null, 1), 'w');
}
