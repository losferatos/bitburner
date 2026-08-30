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

  // DIE REGENERATION WIRD GEMESSEN, NICHT ANGENOMMEN (26.08.2026, 14:18).
  //
  // Die Zyklusrate weiter unten teilt durch R - die Ausdauer, die je Minute
  // nachkommt. Bis 14:18 stand dort die feste Zahl 2,3 aus der Messung vom
  // 12:21. Genau die veraltet: Cyber's Edge hebt `getSkillMult(Stamina)`, und
  // der steckt in `calculateStaminaGainPerSecond` (`Bladeburner.ts:1317-1325`).
  // Gemessen ueber die Kammerphasen in `data/aktionen.txt`:
  //
  //     vor 12:21, Cyber's Edge Stufe 0   R = 2,068   (53 Phasen, 108 min)
  //     ab  13:33, Cyber's Edge Stufe 5   R = 2,313   (11 Phasen,  23 min)
  //
  // Ein fester Wert haette die Zyklusrate ab jetzt systematisch zu niedrig
  // gerechnet - und zwar zugunsten der langen Aktionen, also in die Richtung,
  // in die die Auswertung ohnehin schon zeigt. Das ist der gefaehrliche Fall.
  //
  // Die Kammer ist die einzige Aktion, in der die Ausdauer NUR steigt: Sie
  // verbraucht nichts (`GeneralActions.ts`, kein Eintrag in der
  // Verbrauchsformel), also ist die Differenz je Minute genau R.
  let regeneration = 2.3;
  let regenerationQuelle = "Vorgabe";
  try {
    const roh = ns.fileExists("data/aktionen.txt", "home")
      ? ns.read("data/aktionen.txt") : "";
    let zeit = 0, gewinn = 0, n = 0;
    // Rueckwaerts, damit die JUENGSTEN Phasen zaehlen - eine gerade gekaufte
    // Faehigkeit soll sich sofort niederschlagen, nicht erst nach Stunden.
    const zeilen = roh.split(String.fromCharCode(10)).filter((z) => z.trim());
    for (let i = zeilen.length - 1; i >= 0 && zeit < 20; i--) {
      let r;
      try { r = JSON.parse(zeilen[i]); } catch { continue; }
      if (r.aktion !== "General/Hyperbolic Regeneration Chamber") continue;
      if (r.ausdauerVon == null || r.ausdauerBis == null) continue;
      const dt = (r.bis - r.von) / 60000;
      // Kurze Phasen taugen nicht: Die Ausdauer wird auf ganze Zehntel
      // gerundet gemeldet, und bei 20 Sekunden ist der Rundungsfehler groesser
      // als das Signal.
      if (dt < 0.5) continue;
      zeit += dt; gewinn += r.ausdauerBis - r.ausdauerVon; n++;
    }
    if (zeit >= 5 && gewinn > 0) {
      regeneration = gewinn / zeit;
      regenerationQuelle = "gemessen ueber " + n + " Kammerphasen, "
        + zeit.toFixed(1) + " min";
    }
  } catch (e) { regenerationQuelle = "Vorgabe (" + String(e && e.message ? e.message : e) + ")"; }

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
    // Die Schwierigkeit der Aktion auf ihrer aktuellen Stufe. Sie geht in
    // ZWEI Groessen ein - Ausdauer je Lauf und HP je Misserfolg - und wurde
    // bisher nur fuer die Ausdauer gerechnet (siehe unten).
    const dd = DIFF[name];
    const d = dd ? dd[0] * Math.pow(dd[1], Math.max(0, stufe - 1)) : null;
    const diffMult = d != null ? Math.pow(d, 0.28) + d / 650 : null;
    const ertrag = (evJeVersuch != null && dauer)
      ? +(evJeVersuch / (dauer / 60000)).toFixed(3) : null;
    return { name, min: +min.toFixed(3), max: +max.toFixed(3),
      spanne: +(max - min).toFixed(3), offen, stufe,
      dauer, rangGewinn,
      gewinnEff: gewinnEff != null ? +gewinnEff.toFixed(3) : null,
      rangVerlust: verlust,
      // DER SCHWIERIGKEITSFAKTOR FEHLTE HIER (30.08.2026, 13:45).
      //
      // Der Kommentar an der `HP_VERLUST`-Tabelle sagt seit jeher "mal
      // difficultyMultiplier" - die Rechnung tat es nicht. Sie meldete den
      // **Rohwert** aus `data/Operations.ts` und lag damit um den Faktor
      // `d^0,28 + d/650` daneben, also bei den Operationen zwischen 6,5 und
      // 9,3. Undercover stand mit 1,4 HP je Misserfolg da; echt sind
      // 2 * 6,467 = **12,93** bei einem Maximum von 20.
      //
      // Gefunden von einem Skeptiker-Subagenten am 30.08., nachdem die Zahl
      // als Beleg dafuer zitiert worden war, Undercover sei "risikofrei".
      // Beleg: `Bladeburner.ts:981-983` (`damage = action.hpLoss *
      // difficultyMultiplier`), `data/Constants.ts:16-17`
      // (DiffMultExponentialFactor 0,28, DiffMultLinearFactor 650).
      //
      // Geeicht: Undercover Stufe 1, d = 500 (`data/Operations.ts:50`),
      // 500^0,28 = 5,6976 plus 500/650 = 0,7692 ergibt 6,4668; mal hpLoss 2
      // sind 12,93. Der Skeptiker kam unabhaengig auf denselben Wert.
      hpJeMisserfolg: +((1 - min) * (HP_VERLUST[name] ?? 0)
        * (diffMult ?? 1)).toFixed(1),
      ertragJeMinute: ertrag,
      // Ausdauer je Lauf und je Minute, plus die daraus folgende Zyklusrate.
      // `BaseStaminaLoss * difficultyMultiplier` mit
      // difficultyMultiplier = d^0,28 + d/650 (`Bladeburner.ts:913-916`,
      // Constants DiffMultExponentialFactor 0,28 / DiffMultLinearFactor 650).
      ...(() => {
        if (d == null || !dauer) return {};
        const ausJeLauf = 0.285 * diffMult;
        const min_ = dauer / 60000;
        const ausJeMin = ausJeLauf / min_;
        const R = regeneration;
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

  // ALLE STAEDTE DURCHMESSEN, NICHT NUR DIE EIGENE (26.08.2026, 15:45).
  //
  // Um 14:49 stand die Division in Sector-12 bei Chaos 53,89, waehrend
  // Chongqing 27,71 hatte - bei groesserer Population. Ein Wechsel waere
  // Faktor 2,35 wert gewesen und haette nichts gekostet: `switchCity` setzt
  // nur `bladeburner.city` (`NetscriptFunctions/Bladeburner.ts:314-319`).
  //
  // Was fehlte, war die Entscheidungsgrundlage. `getActionEstimatedSuccessChance`
  // gilt immer fuer die AKTUELLE Stadt (`Actions/Action.ts:90-101` liest
  // `bladeburner.getCurrentCity()`), also musste man hinwechseln, um zu
  // messen - und niemand wechselt ins Blaue.
  //
  // Der Ausweg ist der Wechsel selbst: Er ist ein reines Feld-Setzen, und
  // Netscript laeuft zwischen zwei `await` synchron. Diese Schleife enthaelt
  // keines, also kann die Spielengine nicht dazwischen ticken - der Rundgang
  // ist atomar, und am Ende steht die Division wieder dort, wo sie war.
  //
  // Gemessen wird die SPANNE, nicht nur die Chance. `getSuccessRange`
  // (`Action.ts:144-165`) zentriert um die ECHTE Chance und setzt die Breite
  // auf `|real - est|` - die Spanne ist damit ein direktes Mass dafuer, wie
  // gut die Division eine Stadt kennt. Eine breite Spanne heisst: Der Motor
  // wuerde dort nach `spanne().min` entscheiden und die Aktionen fuer
  // schlechter halten, als sie sind.
  const heimat = ns.bladeburner.getCity();
  const staedte = {};
  for (const stadt of ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"]) {
    try {
      let gewechselt = false;
      if (stadt !== heimat) {
        try { gewechselt = ns.bladeburner.switchCity(stadt); } catch { gewechselt = false; }
      }
      const proben = {};
      if (stadt === heimat || gewechselt) {
        // DREI EBENEN, WEIL DIE STADT NUR OBEN ZAEHLT (26.08.2026, 15:52).
        //
        // Tracking steht bei 0,83 und ist damit fast am Deckel: Die Chance
        // klemmt bei 1 (`Action.ts:196`), also bringt eine bessere Stadt dort
        // kaum noch etwas. Raid steht bei 0,10 und die naechste Black Op bei
        // 0,03 - dort schlaegt jeder Faktor voll durch. Wer die Stadtwahl an
        // Tracking misst, misst an der Aktion, die am wenigsten davon hat.
        const messe = (typ, name, schluessel) => {
          try {
            const r = ns.bladeburner.getActionEstimatedSuccessChance(typ, name);
            const lo = Array.isArray(r) ? r[0] : r, hi = Array.isArray(r) ? r[1] : r;
            proben[schluessel] = { min: +lo.toFixed(4), max: +hi.toFixed(4),
              spanne: +(hi - lo).toFixed(4) };
          } catch { /* Aktion in dieser Stadt nicht schaetzbar */ }
        };
        for (const name of ["Tracking", "Bounty Hunter", "Retirement"]) {
          messe("Contracts", name, name);
        }
        messe("Operations", "Raid", "Raid");
        if (bo) messe("Black Operations", bo.name, "BlackOp");
      }
      staedte[stadt] = {
        proben,
        // Die Population ist der Grund fuer breite Spannen: Je weniger die
        // Division ueber die Synthoids einer Stadt weiss, desto unschaerfer
        // jede Schaetzung (Bladeburner.ts, getSuccessRange).
        popEst: Math.round(ns.bladeburner.getCityEstimatedPopulation(stadt)),
        chaos: +ns.bladeburner.getCityChaos(stadt).toFixed(2),
      };
      // DIESE ZAHL IST WIDERLEGT - SIE STEHT NUR NOCH ALS WARNUNG DA
      // (26.08.2026, 15:55).
      //
      // Sie rechnet die Guete einer Stadt aus Population und Chaos, so wie
      // die Formeln es nahelegen: `(popEst/1e9)^0,7` in die competence
      // (`Action.ts:90-91`), Chaos ueber 50 mit `sqrt(1 + chaos - 50)` in die
      // Schwierigkeit (`:94-101`). Gemessen um 15:55 sagt sie das Gegenteil
      // der tatsaechlichen Chancen: Chongqing hat die HOECHSTE Guete (1,415)
      // und zugleich die NIEDRIGSTE Tracking-Chance der vier guten Staedte
      // (0,771 gegen 0,854 in Volhaven).
      //
      // Der Grund ist `popEst` gegen `pop`. Die Guete rechnet mit der
      // Schaetzung, die Chance mit der Wahrheit - und in einer Stadt, in der
      // die Division selten arbeitet, ist die Schaetzung eben falsch.
      //
      // **Wer die Stadt waehlt, waehlt nach `proben`, nicht nach `guete`.**
      const c = staedte[stadt].chaos;
      staedte[stadt].guete = +(
        Math.pow(staedte[stadt].popEst / 1e9, 0.7)
        / (c > 50 ? Math.sqrt(1 + (c - 50)) : 1)
      ).toFixed(3);
    } catch {}
  }
  // ZURUECK, BEDINGUNGSLOS. Ein Messwerkzeug, das die Arbeitsstadt verstellt,
  // waere schlimmer als gar keine Messung.
  try { ns.bladeburner.switchCity(heimat); } catch {}

  ns.write("data/bbspann.json", JSON.stringify({
    zeit: Date.now(),
    rang: ns.bladeburner.getRank(),
    regeneration: +regeneration.toFixed(3),
    regenerationQuelle,
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
