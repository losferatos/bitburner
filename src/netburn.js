/**
 * Netburners freischalten - der billigste Weg zu sechs Augmentierungen.
 *
 * Die 30er-Schwelle fuer Daedalus scheitert nicht an Reputation, sondern an
 * Mitgliedschaften: 48 Augmentierungen liegen unter 25.000 Rep, aber fast
 * alle bei Faktionen, in denen der Bot nicht ist. Netburners ist die einzige
 * davon, die sich mit reinem Geld erfuellen laesst - kein Training, keine
 * Reise, kein Karma.
 *
 * Bedingung (FactionInfo.tsx): Hacking 80, Summe der Hacknet-Level 100,
 * Summe RAM 8, Summe Cores 4. Bei 92 Mrd auf der Hand sind das Centbetraege.
 *
 * Dahinter liegen sechs Hacknet-Augmentierungen mit Huerden von 1.875 bis
 * 12.500 Rep - jede zaehlt fuer die 30er-Schwelle.
 *
 * Aufruf: node tools/task.js netburn.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const hn = ns.hacknet;
  const z = [];

  const ZIEL_LEVEL = 105;   // etwas Luft ueber der Schwelle von 100
  const ZIEL_RAM = 10;      // Schwelle 8
  const ZIEL_CORES = 5;     // Schwelle 4
  const KNOTEN = 5;

  function stand() {
    let level = 0, ram = 0, cores = 0;
    for (let i = 0; i < hn.numNodes(); i++) {
      const s = hn.getNodeStats(i);
      level += s.level; ram += s.ram; cores += s.cores;
    }
    return { level, ram, cores, n: hn.numNodes() };
  }

  try {
    // Knoten beschaffen. purchaseNode gibt -1, wenn es nicht geht.
    while (hn.numNodes() < KNOTEN) {
      if (hn.purchaseNode() === -1) break;
      await ns.sleep(20);
    }

    // Aufruesten, bis alle drei Summen ueber der Schwelle liegen. Jede
    // Aufruestung einzeln, damit ein zu teurer Schritt die anderen nicht
    // blockiert.
    for (let runde = 0; runde < 400; runde++) {
      const s = stand();
      if (s.level >= ZIEL_LEVEL && s.ram >= ZIEL_RAM && s.cores >= ZIEL_CORES) break;
      let etwasGetan = false;
      for (let i = 0; i < hn.numNodes(); i++) {
        const cur = stand();
        if (cur.level < ZIEL_LEVEL && hn.upgradeLevel(i, 1)) etwasGetan = true;
        if (cur.ram < ZIEL_RAM && hn.upgradeRam(i, 1)) etwasGetan = true;
        if (cur.cores < ZIEL_CORES && hn.upgradeCore(i, 1)) etwasGetan = true;
      }
      if (!etwasGetan) { z.push("Keine Aufruestung mehr moeglich - Geld oder Deckel."); break; }
      await ns.sleep(20);
    }

    const s = stand();
    // ALTE KNOTENMARKE ENTWERTEN (29.10.2026, BN13.1). hacknet.js setzt
    // data/keine-hacknet.txt, wenn nach einem Einbau kein Server mehr da ist;
    // die Marke gilt bis zum Knotenwechsel. Kauft dieses Skript danach
    // Server, blieb hashes.js trotzdem gesperrt: 5 Server, Speicher 320/320
    // voll, nichts getauscht (gemessen 29.10., Marke vom 28.10. 07:44).
    // "0" statt rm: ns.write kostet kein RAM, und "0" gilt in keinem Knoten
    // (lib/reg.js knotenMarkeGilt, bn4net markerGilt, strategie-check).
    // hacknet.js startet dann mit - ausserhalb BN9 ruht es nur (Punkt 2).
    if (s.n > 0) {
      ns.write("data/keine-hacknet.txt", "0", "w");
      if (ns.getHostname() !== "home") ns.scp("data/keine-hacknet.txt", "home", ns.getHostname());
    }
    z.push(`Hacknet:${s.n} Knoten | Level ${s.level}/100 | RAM ${s.ram}/8 | Cores ${s.cores}/4`);
    z.push(`Geld danach: ${ns.format.number(ns.getPlayer().money)}`);

    // Auf die Einladung warten und beitreten. Die Pruefung laeuft im Spiel
    // im Sekundentakt, deshalb genuegen wenige Runden.
    let drin = ns.getPlayer().factions.includes("Netburners");
    for (let i = 0; i < 30 && !drin; i++) {
      await ns.sleep(2000);
      if (ns.singularity.checkFactionInvitations().includes("Netburners")) {
        if (ns.singularity.joinFaction("Netburners")) drin = true;
      }
      drin = drin || ns.getPlayer().factions.includes("Netburners");
    }
    z.push(drin ? "Netburners: BEIGETRETEN" : "Netburners: keine Einladung erhalten");
    if (drin) {
      const augs = ns.singularity.getAugmentationsFromFaction("Netburners");
      const eigen = new Set(ns.singularity.getOwnedAugmentations(true));
      const offen = augs.filter((a) => !eigen.has(a));
      z.push(`Dort offen: ${offen.length} Stueck`);
      for (const a of offen) {
        z.push(`  ${a} | Rep ${ns.format.number(ns.singularity.getAugmentationRepReq(a))} | ${ns.format.number(ns.singularity.getAugmentationPrice(a))}`);
      }
    }
  } catch (e) {
    z.push("FEHLER: " + String(e && e.message ? e.message : e));
  }

  const t = z.join("\n");
  ns.write("data/netburn.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/netburn.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
