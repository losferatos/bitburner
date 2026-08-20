/**
 * Einmalkauf fuer den Zugang zu den Netburners.
 *
 * Die Faktion verlangt Hacking 80, Hacknet-Level 100 gesamt, RAM 8 gesamt und
 * Cores 4 gesamt (`FactionInfo.tsx:675`). Level und Hacking haben wir laengst;
 * RAM und Cores fehlen.
 *
 * Der Verwalter kauft beides bewusst NIE - ueber den laufenden Ertrag
 * gerechnet amortisiert sich Hacknet-RAM erst nach 159 Stunden, ein Core nach
 * 556. Als Betriebsausgabe ist das Geldvernichtung.
 *
 * Als EINMALIGER Kauf fuer einen Faktionszugang ist die Rechnung eine voellig
 * andere: Netburners liefern Augmentations, und fuer Daedalus brauchen wir 30
 * verschiedene - NeuroFlux zaehlt dabei nur ein einziges Mal, egal wie viele
 * Stufen (`FactionJoinCondition.ts:130`). Jede zusaetzliche Faktion ist damit
 * bares Fortkommen, und ein paar Millionen fallen bei Milliarden nicht ins
 * Gewicht.
 *
 * Laeuft einmal durch und beendet sich.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.setTailMinimized?.(true);

  const ZIEL_RAM = 8;
  const ZIEL_CORES = 4;
  const ZIEL_LEVEL = 100;
  // Nie mehr als diesen Anteil des Guthabens einsetzen. Der Zugang ist es wert,
  // aber nicht um den Preis der Handlungsfaehigkeit.
  const MAX_ANTEIL = 0.05;

  const stand = () => {
    let ram = 0, cores = 0, lvl = 0;
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      const n = ns.hacknet.getNodeStats(i);
      ram += n.ram; cores += n.cores; lvl += n.level;
    }
    return { ram, cores, lvl };
  };

  const a = stand();
  ns.tprint("Netburners-Einkauf: RAM " + a.ram + "/" + ZIEL_RAM
    + ", Cores " + a.cores + "/" + ZIEL_CORES + ", Level " + a.lvl + "/100");

  let gekauft = 0;
  for (let versuch = 0; versuch < 400; versuch++) {
    const s = stand();
    if (s.ram >= ZIEL_RAM && s.cores >= ZIEL_CORES && s.lvl >= ZIEL_LEVEL) break;
    const budget = ns.getServerMoneyAvailable("home") * MAX_ANTEIL;

    // Immer den billigsten offenen Posten zuerst - so kommt man mit dem
    // wenigsten Geld ueber beide Schwellen.
    let bester = null;
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      if (s.ram < ZIEL_RAM) {
        const k = ns.hacknet.getRamUpgradeCost(i, 1);
        if (Number.isFinite(k) && (!bester || k < bester.kosten)) bester = { i, kosten: k, was: "ram" };
      }
      if (s.cores < ZIEL_CORES) {
        const k = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (Number.isFinite(k) && (!bester || k < bester.kosten)) bester = { i, kosten: k, was: "cores" };
      }
      // Die Stufen fehlten in der ersten Fassung ganz - sie ging davon aus,
      // dass 100 Stufen laengst zusammen sind, weil das VOR dem Reset stimmte.
      // Nach dem Reset steht das Hacknet wieder bei vier frischen Knoten, und
      // damit bei 4 x 1 Stufe. RAM und Kerne waren dann erfuellt, die Stufen
      // nicht - und der Einkauf meldete "fertig", ohne dass eine Einladung kam.
      if (s.lvl < ZIEL_LEVEL) {
        const k = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (Number.isFinite(k) && (!bester || k < bester.kosten)) bester = { i, kosten: k, was: "level" };
      }
    }
    if (!bester || bester.kosten > budget) {
      ns.tprint("Netburners-Einkauf: naechster Posten zu teuer oder nichts mehr offen");
      break;
    }
    const ok = bester.was === "ram" ? ns.hacknet.upgradeRam(bester.i, 1)
      : bester.was === "cores" ? ns.hacknet.upgradeCore(bester.i, 1)
      : ns.hacknet.upgradeLevel(bester.i, 1);
    if (!ok) break;
    gekauft++;
    await ns.sleep(200);
  }

  const e = stand();
  ns.tprint("Netburners-Einkauf fertig: " + gekauft + " Aufruestungen, jetzt RAM " + e.ram
    + ", Cores " + e.cores + (e.ram >= ZIEL_RAM && e.cores >= ZIEL_CORES
      ? " - Bedingungen erfuellt, die Einladung sollte kommen" : " - noch nicht genug"));
}
