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
    // DER BRUTTOERTRAG HAT AM 26.08. UM 12:55 EINEN FALSCHEN AUFTRAG ERZEUGT.
    //
    // Die alte Zeile rechnete `rangGewinn * min / Dauer` und meldete damit
    // fuer Raid 4,302 gegen 0,602 bei Tracking - angeblich das Siebenfache.
    // Beide Zahlen waren falsch, und zwar in ENTGEGENGESETZTE Richtung:
    //
    //   Es fehlte der LEVELFAKTOR. `Bladeburner.ts:917` multipliziert den
    //   Ertrag mit `rewardFac^(level-1)`. Tracking steht auf Stufe 28
    //   (1,041^27 = 2,96), alle Operationen auf Stufe 1 (Faktor 1). Der
    //   Vergleich verglich also eine ausgereizte Aktion mit einer frischen.
    //
    //   Es fehlte der RANGVERLUST. Operationen haben `rankLoss`
    //   (Operations.ts:20, 54, 90, 125, 165, 203), Vertraege nicht. Bei
    //   Erfolgschancen unter 0,2 dominiert dieser Term: Stealth Retirement
    //   und Assassination haben einen NEGATIVEN Erwartungswert.
    //
    // Richtig gerechnet liegen Raid (1,819) und Tracking (1,783) gleichauf.
    const REWARD_FAC = {
      "Tracking": 1.041, "Bounty Hunter": 1.085, "Retirement": 1.065,
      "Investigation": 1.07, "Undercover Operation": 1.09,
      "Sting Operation": 1.095, "Raid": 1.1,
      "Stealth Retirement Operation": 1.11, "Assassination": 1.14,
    };
    // Nur Operationen verlieren Rang bei einem Misserfolg.
    const RANG_VERLUST = {
      "Investigation": 0.2, "Undercover Operation": 0.4, "Sting Operation": 0.5,
      "Raid": 2.5, "Stealth Retirement Operation": 2, "Assassination": 4,
    };
    // Trefferpunkte je Misserfolg, mal difficultyMultiplier
    // (`Bladeburner.ts:983`). Raid nimmt 50 - bei einem Maximum von 25
    // bedeutet das Krankenhaus bei jedem einzelnen Fehlschlag.
    const HP_VERLUST = {
      "Tracking": 0.5, "Bounty Hunter": 1, "Retirement": 1,
      "Undercover Operation": 2, "Sting Operation": 2.5, "Raid": 50,
      "Stealth Retirement Operation": 10, "Assassination": 5,
    };
    // DIE ZYKLUSRATE IST DIE ZAHL, DIE ZAEHLT (26.08.2026, 13:20).
    //
    // Rang je Minute misst nur die ARBEITSphase. Der Motor steht aber rund
    // die Haelfte der Zeit in der Regenerationskammer, und wie lange, haengt
    // an der Aktion: Der Ausdauerverlust faellt JE AKTION an
    // (`Bladeburner.ts:921`), nicht je Zeit. Eine lange Aktion verteilt
    // denselben Verlust auf mehr Minuten und braucht deshalb weniger Ruhe.
    //
    // Das kehrt die Rangfolge um. Tracking dauert 15 Sekunden und verbraucht
    // 5,53 Ausdauer je Minute; Raid dauert 56 Sekunden und verbraucht 2,36 -
    // knapp unter der Regeneration von 2,3. Der Arbeitsanteil steigt damit
    // von 42 auf 97 Prozent.
    //
    //     Zyklusrate = netto/min * min(1, R/V)
    //
    // mit R = Regeneration je Minute (Kammer, gemessen 2,3) und V = Verbrauch
    // je Minute. Diese Zahl, nicht `ertragJeMinute`, ist mit dem tatsaechlich
    // beobachteten Rangzuwachs vergleichbar.
    const DIFF = {
      "Tracking": [125, 1.02], "Bounty Hunter": [250, 1.04],
      "Retirement": [200, 1.03], "Investigation": [300, 1.03],
      "Undercover Operation": [500, 1.04], "Sting Operation": [650, 1.04],
      "Raid": [800, 1.045], "Stealth Retirement Operation": [1000, 1.05],
      "Assassination": [1500, 1.06],
    };
    const rangGewinn = RANG[name] ?? null;
    const rf = REWARD_FAC[name] ?? 1;
    const verlust = RANG_VERLUST[name] ?? 0;
    // Der Ertrag je Stufe, wie ihn das Spiel tatsaechlich gutschreibt.
    const gewinnEff = (rangGewinn != null && stufe > 0)
      ? rangGewinn * Math.pow(rf, stufe - 1) : rangGewinn;
    // Erwartungswert je Versuch: Gewinn mal Chance minus Verlust mal
    // Gegenchance. Die untere Schaetzgrenze ist die vorsichtige Wahl.
    const evJeVersuch = (gewinnEff != null)
      ? gewinnEff * min - (1 - min) * verlust : null;
    const ertrag = (evJeVersuch != null && dauer)
      ? +(evJeVersuch / (dauer / 60000)).toFixed(3) : null;
    return { name, min: +min.toFixed(3), max: +max.toFixed(3),
      spanne: +(max - min).toFixed(3), offen, stufe,
      dauer, rangGewinn,
      gewinnEff: gewinnEff != null ? +gewinnEff.toFixed(3) : null,
      rangVerlust: verlust,
      hpJeMisserfolg: +((1 - min) * (HP_VERLUST[name] ?? 0)).toFixed(1),
      ertragJeMinute: ertrag,
      // Ausdauer je Lauf und je Minute, plus die daraus folgende Zyklusrate.
      // `BaseStaminaLoss * difficultyMultiplier` mit
      // difficultyMultiplier = d^0,28 + d/650 (`Bladeburner.ts:913-916`,
      // Constants DiffMultExponentialFactor 0,28 / DiffMultLinearFactor 650).
      ...(() => {
        const dd = DIFF[name];
        if (!dd || !dauer) return {};
        const d = dd[0] * Math.pow(dd[1], Math.max(0, stufe - 1));
        const ausJeLauf = 0.285 * (Math.pow(d, 0.28) + d / 650);
        const min_ = dauer / 60000;
        const ausJeMin = ausJeLauf / min_;
        // R aus der Kammermessung vom 26.08., 12:21. Waechst mit Cyber's Edge -
        // dann verschiebt sich die Rangfolge zugunsten der kurzen Aktionen.
        const R = 2.3;
        const anteil = Math.min(1, R / ausJeMin);
        return {
          ausdauerJeLauf: +ausJeLauf.toFixed(2),
          ausdauerJeMinute: +ausJeMin.toFixed(2),
          arbeitsanteil: +anteil.toFixed(3),
          zyklusrate: ertrag != null ? +(ertrag * anteil).toFixed(3) : null,
          rangJeAusdauer: (evJeVersuch != null && ausJeLauf)
            ? +(evJeVersuch / ausJeLauf).toFixed(3) : null,
        };
      })(),
      // Was die alte Zeile gemeldet haette - zum Vergleich, damit ein
      // Rueckfall auf die falsche Zahl sofort auffaellt.
      bruttoJeMinute: (rangGewinn != null && dauer)
        ? +(rangGewinn * min / (dauer / 60000)).toFixed(3) : null };
  };

  const vertraege = ns.bladeburner.getContractNames().map((n) => zeile("Contracts", n));
  const operationen = ns.bladeburner.getOperationNames().map((n) => zeile("Operations", n));
  const bo = ns.bladeburner.getNextBlackOp();
  // DIE CHANCE DER NAECHSTEN BLACK OP ENTSCHEIDET UEBER DEN SKILL_PLAN
  // (26.08.2026, 12:47).
  //
  // Die Chancen-Faehigkeiten (Blade's Intuition, Digital Observer, Cloak,
  // Short-Circuit) wirken laut `Actions/Action.ts:184-187` auf Contracts,
  // Operations UND BlackOps. Ob eine von ihnen ausgereizt ist, laesst sich
  // deshalb NICHT an den Vertraegen ablesen - erst wenn auch die naechste
  // Black Op bei 1,0 steht, bringt eine weitere Stufe nichts mehr. Ohne diese
  // Zahl faellt die Entscheidung "Deckel oder nicht" ins Blaue.
  let boChance = null;
  if (bo) {
    try {
      const r = ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", bo.name);
      boChance = Array.isArray(r) ? { min: +r[0].toFixed(3), max: +r[1].toFixed(3) }
        : { min: +r.toFixed(3), max: +r.toFixed(3) };
    } catch (e) { boChance = { fehler: String(e && e.message ? e.message : e) }; }
  }

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
    naechsteBlackOp: bo ? { name: bo.name, rang: bo.rank, chance: boChance } : null,
    vertraege, operationen, staedte, faehigkeiten,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/bbspann.json", "home", ns.getHostname());
}
