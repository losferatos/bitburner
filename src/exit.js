/**
 * Den BitNode verlassen - und im naechsten sofort wieder anlaufen.
 *
 * WARUM NICHT UEBER DIE OBERFLAECHE
 *
 * Bisher lief der Ausgang ueber `bitverse.js`, also ueber einen Klick im
 * BitVerse-Bildschirm. Das funktioniert, hat aber einen Haken, der erst beim
 * unbeaufsichtigten Lauf weh tut: `prestigeSourceFile` beendet JEDES
 * laufende Skript. Nach dem Klick steht der Bot im neuen Knoten still, bis
 * ein Mensch ihn anwirft.
 *
 * `ns.singularity.destroyW0r1dD43m0n(nextBN, callbackScript)`
 * (NetscriptFunctions/Singularity.ts:1153-1161) macht beides in einem Zug:
 * Knoten abschliessen, naechsten betreten, und im neuen Knoten ein Skript
 * starten. Genau dafuer gibt es `src/boot.js`.
 *
 * VORAUSSETZUNGEN, die diese Datei selbst prueft:
 *   - w0r1d_d43m0n haengt am Netz. Das tut er erst nach dem Einbau von
 *     The Red Pill (Prestige.ts:173-181); vorher wirft schon ns.nuke.
 *   - Hacking-Level >= requiredHackingSkill des Servers. In BitNode 4 sind
 *     das 9000 (3000 mal WorldDaemonDifficulty 3).
 *   - Root-Zugang (hasAdminRights). w0r1d_d43m0n braucht funf offene Ports.
 *
 * Der Alternativweg ueber 21 Black Ops (Bladeburner) ist hier NICHT gebaut -
 * er braucht SF6 oder SF7, die es in diesem Spielstand nicht gibt.
 *
 * Aufruf:  node tools/task.js exit.js 5        naechster Knoten ist BitNode 5
 *          node tools/task.js exit.js 5 --pruefen   nur nachsehen, nichts tun
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const ziel = Number(ns.args[0]);
  const nurPruefen = ns.args.includes("--pruefen");
  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/exit.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/exit.txt", "home", ns.getHostname());
  };

  if (!Number.isFinite(ziel) || ziel < 1 || ziel > 15) {
    sag("Kein gueltiger Ziel-BitNode angegeben (1 bis 15). Nichts getan.");
    return;
  }

  const WD = "w0r1d_d43m0n";

  // ZWEITER WEG: 21 BLACK OPS (28.08.2026, 17:05).
  //
  // Oben stand "der Alternativweg ueber Bladeburner ist NICHT gebaut - er
  // braucht SF6 oder SF7, die es in diesem Spielstand nicht gibt". Seit dem
  // Einstieg in BitNode 6 gibt es Bladeburner nativ, und um 17:00 ist
  // Operation Daedalus gefallen: 21 von 21.
  //
  // destroyW0r1dD43m0n prueft zwei Bedingungen ODER-verknuepft
  // (NetscriptFunctions/Singularity.ts:1148-1164): Hacking-Level plus Root,
  // ODER numBlackOpsComplete >= 21. Der Server muss dafuer NICHT am Netz
  // haengen - die Funktion holt ihn mit GetServer(SpecialServers.WorldDaemon)
  // direkt aus der Serverliste. Die Vorpruefung ns.serverExists(WD) unten
  // haette den Bladeburner-Weg also faelschlich abgewiesen.
  let ueberBlackOps = false;
  try {
    if (ns.bladeburner.inBladeburner()) {
      const anzahl = ns.bladeburner.getBlackOpNames().length;
      const naechste = ns.bladeburner.getNextBlackOp();
      ueberBlackOps = naechste === null && anzahl > 0;
      sag("Black Ops: " + (ueberBlackOps
        ? "alle " + anzahl + " gefallen - Weg 2 offen"
        : "noch offen: " + (naechste ? naechste.name : "?")));
    }
  } catch { sag("Keine Bladeburner-Division - Weg 2 entfaellt."); }

  if (ueberBlackOps) {
    if (nurPruefen) {
      sag("PRUEFLAUF: Weg 2 ist offen. Ohne --pruefen wuerde jetzt BitNode "
        + ziel + " betreten, Rueckruf boot.js.");
      return;
    }
    if (!ns.fileExists("boot.js", "home")) {
      sag("ABBRUCH: boot.js liegt nicht auf home. Ohne den Rueckruf staende"
        + " der Bot im neuen Knoten still.");
      return;
    }
    sag("Verlasse BitNode ueber 21 Black Ops Richtung " + ziel
      + ", Rueckruf boot.js.");
    await ns.sleep(500);
    ns.singularity.destroyW0r1dD43m0n(ziel, "boot.js");
    return;
  }

  if (!ns.serverExists(WD)) {
    sag(WD + " haengt nicht am Netz. The Red Pill ist noch nicht eingebaut.");
    return;
  }

  const s = ns.getServer(WD);
  const level = ns.getPlayer().skills.hacking;
  sag("Hacking " + level + " von " + s.requiredHackingSkill
    + ", Root: " + (s.hasAdminRights ? "ja" : "nein"));

  if (level < s.requiredHackingSkill) {
    sag("Level reicht nicht. Es fehlen " + (s.requiredHackingSkill - level) + ".");
    return;
  }

  if (!s.hasAdminRights) {
    // Fuenf Ports, dann nuke. Jedes Programm einzeln in try, weil ein
    // fehlendes eine Ausnahme wirft und den Rest sonst mitreisst.
    for (const [datei, fn] of [["BruteSSH.exe", ns.brutessh], ["FTPCrack.exe", ns.ftpcrack],
                               ["relaySMTP.exe", ns.relaysmtp], ["HTTPWorm.exe", ns.httpworm],
                               ["SQLInject.exe", ns.sqlinject]]) {
      if (!ns.fileExists(datei, "home")) { sag("Fehlt: " + datei); continue; }
      try { fn(WD); } catch (e) { sag(datei + ": " + e); }
    }
    // nuke wirft bei zu wenig offenen Ports NICHT, es gibt false zurueck
    // (NetscriptFunctions.ts:541-544) - der Rueckgabewert entscheidet.
    let root = false;
    try { root = ns.nuke(WD); }
    catch (e) { sag("nuke fehlgeschlagen: " + e); return; }
    if (!root) { sag("nuke: zu wenig Ports offen, kein Root auf " + WD + "."); return; }
    sag("Root auf " + WD + " geholt.");
  }

  if (nurPruefen) {
    sag("PRUEFLAUF: alle Bedingungen erfuellt. Ohne --pruefen wuerde jetzt"
      + " BitNode " + ziel + " betreten.");
    return;
  }

  if (!ns.fileExists("boot.js", "home")) {
    sag("ABBRUCH: boot.js liegt nicht auf home. Ohne den Rueckruf staende der"
      + " Bot im neuen Knoten still - das ist schlimmer als hier zu warten.");
    return;
  }

  sag("Verlasse BitNode Richtung " + ziel + ", Rueckruf boot.js.");
  await ns.sleep(500);
  ns.singularity.destroyW0r1dD43m0n(ziel, "boot.js");
}
