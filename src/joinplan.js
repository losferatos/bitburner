/**
 * Beitrittsplan: was fehlt fuer die leicht erreichbaren Faktionen?
 *
 * Die 30er-Schwelle scheitert nicht an Reputation (48 Augmentierungen liegen
 * unter 25.000 Rep), sondern an der Mitgliedschaft. Dieses Skript prueft je
 * Faktion, welche Bedingung offen ist - Kampfwerte, Karma, Stadt, Geld,
 * Hacknet - damit klar ist, was billig zu erfuellen waere.
 *
 * Aufruf: node tools/task.js joinplan.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const z = [];
  try {
    const p = ns.getPlayer();
    const hn = ns.hacknet;
    let hnLevel = 0, hnRam = 0, hnCores = 0;
    for (let i = 0; i < hn.numNodes(); i++) {
      const s = hn.getNodeStats(i);
      hnLevel += s.level; hnRam += s.ram; hnCores += s.cores;
    }
    z.push(`Stadt ${p.city} | Geld ${ns.format.number(p.money)} | Karma ${ns.format.number(ns.heart.break())}`);
    z.push(`Hack ${p.skills.hacking} | Str ${p.skills.strength} Def ${p.skills.defense} Dex ${p.skills.dexterity} Agi ${p.skills.agility} Cha ${p.skills.charisma}`);
    z.push(`Hacknet: ${hn.numNodes()} Knoten, Level ${hnLevel}, RAM ${hnRam}, Cores ${hnCores}`);
    z.push(`Drin: ${p.factions.join(", ")}`);
    z.push("");
    z.push("Bedingungen der billigen Faktionen (aus FactionInfo.tsx):");
    z.push(`  Tian Di Hui : Geld 1m, Hack 50, Stadt Chongqing/New Tokyo/Ishima`);
    z.push(`  Netburners  : Hack 80, HN-Level 100, HN-RAM 8, HN-Cores 4`);
    z.push(`  Slum Snakes : Karma -9, alle Kampfwerte 30`);
    z.push(`  Tetrads     : Karma -18, Kampfwerte 75, Stadt Chongqing/New Tokyo/Ishima`);
    z.push(`  New Tokyo   : Stadt New Tokyo`);
    z.push(`  Ishima      : Stadt Ishima`);
    z.push(`  Volhaven    : Stadt Volhaven`);
    z.push(`  Chongqing   : Stadt Chongqing`);
    z.push(`  Silhouette  : CTO/CFO/CEO irgendwo, Geld 15m, Karma -22`);
    z.push(`  Church      : Stanek's Gift annehmen (Augmentation-Menue)`);
  } catch (e) {
    z.push("FEHLER: " + String(e && e.message ? e.message : e));
  }
  const t = z.join("\n");
  ns.write("data/joinplan.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/joinplan.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
