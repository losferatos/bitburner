/** Warum waehlt blade.js was es waehlt? Erfolgsspannen aller Aktionen.
 *
 * Der Motor entscheidet nach `spanne().min` gegen feste Schwellen. Bleibt er in
 * "Field Analysis" haengen, sieht man von aussen nur, DASS er es tut - nicht,
 * wie weit die Schaetzungen davon entfernt sind, einen Vertrag freizugeben.
 * Genau diese Zahlen fehlen, wenn man entscheiden muss, ob die Schwelle falsch
 * ist oder die Division schlicht noch zu schwach.
 *
 * Ergebnis nach data/bbspann.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) {
    ns.write("data/bbspann.json", JSON.stringify({
      zeit: Date.now(), fehler: "nicht in der Division" }), "w");
    if (ns.getHostname() !== "home") ns.scp("data/bbspann.json", "home", ns.getHostname());
    return;
  }

  const zeile = (typ, name) => {
    let min = 0, max = 0;
    try {
      const r = ns.bladeburner.getActionEstimatedSuccessChance(typ, name);
      if (Array.isArray(r)) { min = r[0]; max = r[1]; } else { min = max = r; }
    } catch {}
    let offen = 0, stufe = 0;
    try { offen = ns.bladeburner.getActionCountRemaining(typ, name); } catch {}
    try { stufe = ns.bladeburner.getActionCurrentLevel(typ, name); } catch {}
    // DER ERTRAG JE ZEIT IST DIE ENTSCHEIDENDE GROESSE (25.08.2026, 21:55).
    //
    // blade.js waehlt bisher die SICHERSTE Aktion oberhalb einer Schwelle.
    // Das optimiert die falsche Zahl: Ein Vertrag mit 56 Prozent Chance und
    // 0,6 Rang schlaegt eine Operation mit 28 Prozent und 2,2 Rang nur dann,
    // wenn er auch entsprechend kuerzer dauert. Ohne die Dauer laesst sich
    // das nicht entscheiden - deshalb steht sie jetzt hier.
    //
    // rankGain aus reference/bitburner-src/src/Bladeburner/data/:
    //   Contracts   Tracking 0,3 · Bounty Hunter 0,9 · Retirement 0,6
    //   Operations  Investigation 2,2 · Undercover 4,4 · Sting 5,5
    //               Stealth Retirement 22 · Assassination 44 · Raid 55
    let dauer = null;
    try { dauer = Math.round(ns.bladeburner.getActionTime(typ, name)); } catch {}
    const RANG = {
      "Tracking": 0.3, "Bounty Hunter": 0.9, "Retirement": 0.6,
      "Investigation": 2.2, "Undercover Operation": 4.4, "Sting Operation": 5.5,
      "Stealth Retirement Operation": 22, "Assassination": 44, "Raid": 55,
    };
    const rangGewinn = RANG[name] ?? null;
    // Erwarteter Rang je Minute: Ertrag mal Erfolgswahrscheinlichkeit,
    // geteilt durch die Dauer. Die untere Schaetzgrenze ist die vorsichtige
    // Wahl - die Spanne ist bei unsicheren Aktionen betraechtlich.
    const ertrag = (rangGewinn != null && dauer)
      ? +(rangGewinn * min / (dauer / 60000)).toFixed(3) : null;
    return { name, min: +min.toFixed(3), max: +max.toFixed(3),
      spanne: +(max - min).toFixed(3), offen, stufe,
      dauer, rangGewinn, ertragJeMinute: ertrag };
  };

  const vertraege = ns.bladeburner.getContractNames().map((n) => zeile("Contracts", n));
  const operationen = ns.bladeburner.getOperationNames().map((n) => zeile("Operations", n));
  const bo = ns.bladeburner.getNextBlackOp();

  // DIE FAEHIGKEITEN SIND DER VERSTAERKUNGSPFAD (25.08.2026).
  //
  // Ohne sie bleibt Bladeburner linear: Jede Aktion dauert gleich lang und
  // gelingt gleich oft. Blade's Intuition hebt die Erfolgschance aller
  // Vertraege und Operationen, Overclock senkt die Dauer JEDER Aktion. Wenn
  // der Rang zu langsam waechst, ist die erste Frage nicht "welche Aktion",
  // sondern "kommen ueberhaupt Punkte an und werden sie ausgegeben".
  const faehigkeiten = [];
  for (const name of ns.bladeburner.getSkillNames()) {
    let stufe = 0, preis = 0;
    try { stufe = ns.bladeburner.getSkillLevel(name); } catch {}
    try { preis = ns.bladeburner.getSkillUpgradeCost(name, 1); } catch {}
    faehigkeiten.push({ name, stufe, preis });
  }

  const staedte = {};
  for (const stadt of ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"]) {
    try {
      staedte[stadt] = {
        // Die Population ist der Grund fuer breite Spannen: Je weniger die
        // Division ueber die Synthoids einer Stadt weiss, desto unschaerfer
        // jede Schaetzung (Bladeburner.ts, getSuccessRange).
        popEst: Math.round(ns.bladeburner.getCityEstimatedPopulation(stadt)),
        chaos: +ns.bladeburner.getCityChaos(stadt).toFixed(2),
      };
    } catch {}
  }

  ns.write("data/bbspann.json", JSON.stringify({
    zeit: Date.now(),
    rang: ns.bladeburner.getRank(),
    punkte: ns.bladeburner.getSkillPoints(),
    stadt: ns.bladeburner.getCity(),
    ausdauer: ns.bladeburner.getStamina(),
    aktion: ns.bladeburner.getCurrentAction(),
    // DER FORTSCHRITT DER LAUFENDEN AKTION (25.08.2026, 20:53).
    //
    // Ohne ihn ist ein Stillstand nicht zu deuten. Drei Faelle sehen von
    // aussen gleich aus und haben voellig verschiedene Ursachen:
    //   waechst        - alles in Ordnung, die Aktion laeuft
    //   steht bei 0    - sie wird bei jedem Tick neu gestartet
    //   steht konstant - die Bladeburner-Engine bekommt keine Zyklen
    aktionZeit: (() => { try { return ns.bladeburner.getActionCurrentTime(); } catch (e) { return null; } })(),
    aktionDauer: (() => {
      try {
        const a = ns.bladeburner.getCurrentAction();
        return a ? ns.bladeburner.getActionTime(a.type, a.name) : null;
      } catch (e) { return null; }
    })(),
    naechsteBlackOp: bo ? { name: bo.name, rang: bo.rank } : null,
    vertraege, operationen, staedte, faehigkeiten,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/bbspann.json", "home", ns.getHostname());
}
