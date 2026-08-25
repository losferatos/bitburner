/**
 * Der Eintritt in die Bladeburner-Division.
 *
 * WARUM ES DIESES SKRIPT BRAUCHT
 *
 * BitNode 6 wird nicht ueber das Hackniveau abgeschlossen, sondern ueber 21
 * Black Ops (`destroyW0r1dD43m0n` akzeptiert beides, Singularity.ts:1124-1176).
 * Der Hacking-Weg ist hier praktisch versperrt: WorldDaemonDifficulty 2 hebt
 * das Ziel auf Level 6.000, waehrend HackExpGain 0,25 jede Erfahrung viertelt.
 *
 * Der Bladeburner-Weg hat dafuer ein eigenes Tor: **alle vier Kampfwerte
 * muessen mindestens 100 sein** (NetscriptFunctions/Bladeburner.ts:356). In
 * der Nacht zum 25.08.2026 stand der Bot nach sieben Stunden bei 95 von 95
 * gerooteten Rechnern, 755 Millionen Dollar - und Kampfwerten von jeweils 1.
 * Er hat die ganze Nacht in eine Richtung gearbeitet, die in diesem Knoten
 * nicht zum Ausgang fuehrt.
 *
 * Dieses Skript raeumt das Tor weg und beendet sich danach. Es laeuft einmal
 * je BitNode, nicht dauernd.
 *
 * KOSTEN
 *
 * gymWorkout ist ein Singularity-Aufruf, kostet also mit SF4.1 ausserhalb von
 * BitNode 4 das Sechzehnfache: 32 GB. Zusammen mit dem Rest liegt das Skript
 * bei rund 40 GB - es passt auf home, sobald der Kaltstart vorbei ist, und
 * gehoert deshalb NICHT in die Werkzeugliste des Motors, die auch im frischen
 * Knoten greifen muss.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  // Aeussere Schleife: Nach jedem Augmentierungs-Einbau faellt der Beitritt
  // nicht weg, wohl aber - in einem frischen Knoten - die Kampfwerte. Das
  // Skript laeuft deshalb dauerhaft und faengt bei Bedarf von vorn an.
  for (;;) {
    await runde(ns);
    await ns.sleep(30000);
  }
}

/** @param {NS} ns */
async function runde(ns) {

  const ZIEL = Number(ns.args[0]) || 100;
  // DAS BESTE STUDIO, NICHT DAS NAECHSTE (25.08.2026).
  //
  // Der Ortsmultiplikator geht voll in die Erfahrung ein, und die Spanne ist
  // gross (LocationsMetadata.ts):
  //   Powerhouse Gym, Sector-12   expMult 10
  //   Snap Fitness, Aevum         expMult  5
  //   Millenium Fitness, Volhaven expMult  4
  //   Crush Fitness, Aevum        expMult  2
  //   Iron Gym, Sector-12         expMult  1
  //
  // Gemessen am 25.08. um 05:34 in Crush Fitness: von Kampfwert 1 auf gut 3
  // in zehn Minuten. Hochgerechnet auf 100 waeren das Tage. In Powerhouse ist
  // dieselbe Strecke fuenfmal kuerzer, und die Reise kostet einmalig $200.000
  // bei einem Guthaben von 741 Millionen.
  //
  // Die Reise ist unbedenklich: travelToCity aendert nur den Aufenthaltsort.
  // Mitgliedschaften in Stadtfaktionen bleiben bestehen - verloren geht
  // hoechstens die Moeglichkeit, EINER weiteren beizutreten, und die
  // Stadtfaktionen sind fuer diesen Knoten ohne Bedeutung.
  const BESTES_GYM = { stadt: "Sector-12", name: "Powerhouse Gym" };
  const GYM = {
    "Sector-12": "Powerhouse Gym",
    Aevum: "Snap Fitness Gym",
    Volhaven: "Millenium Fitness Gym",
  };
  const WERTE = [
    ["strength", "str"], ["defense", "def"],
    ["dexterity", "dex"], ["agility", "agi"],
  ];

  const sag = (t) => { ns.print(t); ns.tprint("[bbtrain] " + t); };

  // Schon drin? Dann gibt es hier nichts zu tun.
  // NICHT BEENDEN, SONDERN WARTEN (25.08.2026).
  //
  // Hier stand `return`, sobald der Beitritt stand - mit der Begruendung, das
  // Skript habe seine Arbeit getan. Das war falsch, und zwar teuer: Um 05:50
  // hat bn4rep sechs Augmentierungen eingebaut. Ein Einbau setzt ALLE
  // Kampfwerte auf 1 zurueck und toetet jedes laufende Skript. bbtrain war
  // deshalb weg, stand nicht in der Werkzeugliste (weil es sich ja beendet)
  // und wurde nie wieder gestartet. Drei Stunden Training waren verloren, und
  // niemand hat es gemerkt.
  //
  // Ein Skript, dessen Aufgabe nach jedem Reset erneut anfaellt, darf sich
  // nicht beenden. Es wartet.
  while (ns.bladeburner.inBladeburner()) {
    await ns.sleep(60000);
  }

  // Erst umziehen, dann trainieren.
  if (ns.getPlayer().city !== BESTES_GYM.stadt) {
    if (ns.singularity.travelToCity(BESTES_GYM.stadt)) {
      sag("Nach " + BESTES_GYM.stadt + " gereist (" + BESTES_GYM.name + ", expMult 10).");
    } else {
      sag("Reise nach " + BESTES_GYM.stadt + " fehlgeschlagen - trainiere vor Ort.");
    }
  }

  const stadt = ns.getPlayer().city;
  const gym = GYM[stadt];
  if (!gym) {
    // Kein Studio in dieser Stadt bekannt. Reisen waere moeglich, kostet aber
    // einen weiteren Singularity-Aufruf und - schlimmer - koennte eine
    // Stadtfaktion beruehren. Lieber melden als raten.
    ns.write("data/hilfe.txt",
      "bbtrain: kein Fitnessstudio fuer Stadt " + stadt + " hinterlegt."
      + " Kampfwerte lassen sich nicht trainieren, BitNode 6 bleibt zu.", "w");
    sag("Kein Studio fuer " + stadt + " - Notruf gesetzt.");
    return;
  }

  sag("Trainiere auf " + ZIEL + " in " + stadt + " (" + gym + ").");

  for (;;) {
    const p = ns.getPlayer();
    // Der niedrigste Wert zuerst. Das Tor ist ein Minimum ueber alle vier -
    // wer den hoechsten weitertreibt, kommt dem Ziel keinen Schritt naeher.
    let schlechtester = null, tiefstand = Infinity;
    for (const [lang, kurz] of WERTE) {
      const wert = p.skills[lang];
      if (wert < tiefstand) { tiefstand = wert; schlechtester = kurz; }
    }

    if (tiefstand >= ZIEL) break;

    const laeuft = ns.singularity.getCurrentWork();
    const trainiertSchon = laeuft && laeuft.type === "CLASS"
      && laeuft.classType === schlechtester;
    if (!trainiertSchon) {
      if (!ns.singularity.gymWorkout(gym, schlechtester, false)) {
        sag("gymWorkout abgelehnt (" + schlechtester + ") - Geld? Stadt?");
        await ns.sleep(30000);
        continue;
      }
      sag(schlechtester + " bei " + tiefstand + " - trainiere weiter.");
    }
    // Laenger schlafen als frueher: Der Wechsel lohnt erst, wenn ein anderer
    // Wert der niedrigste geworden ist. Bei zwanzig Sekunden wurde die Arbeit
    // staendig neu gestartet, ohne dass sich an der Rangfolge etwas aenderte.
    await ns.sleep(60000);
  }

  sag("Alle Kampfwerte >= " + ZIEL + " - trete bei.");
  ns.singularity.stopAction();

  if (ns.bladeburner.joinBladeburnerDivision()) {
    sag("BLADEBURNER-DIVISION BEIGETRETEN.");
    ns.write("data/bbjoin.txt", String(Date.now()), "w");
  } else {
    ns.write("data/hilfe.txt",
      "bbtrain: Kampfwerte stehen auf " + ZIEL + ", aber der Beitritt zur"
      + " Bladeburner-Division wurde abgelehnt.", "w");
    sag("Beitritt abgelehnt - Notruf gesetzt.");
  }
}
