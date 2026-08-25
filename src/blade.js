/**
 * Der Bladeburner-Motor.
 *
 * WOZU
 *
 * In BitNode 6 und 7 fuehrt der Weg zu w0r1d_d43m0n nicht ueber das
 * Hackniveau, sondern ueber 21 Black Operations: `destroyW0r1dD43m0n`
 * akzeptiert beides (Singularity.ts:1124-1176). Der Hacking-Weg ist hier
 * versperrt - WorldDaemonDifficulty 2 hebt das Ziel auf Level 6.000, waehrend
 * HackExpGain 0,25 jede Erfahrung viertelt.
 *
 * Vorbedingung ist der Beitritt zur Division, und der verlangt alle vier
 * Kampfwerte auf 100 (NetscriptFunctions/Bladeburner.ts:356). Darum kuemmert
 * sich bbtrain.js; dieses Skript wartet, bis es soweit ist.
 *
 * DIE ENTSCHEIDUNGSREGEL
 *
 * Bladeburner ist ein Spiel gegen die Ausfallwahrscheinlichkeit. Jede Aktion
 * hat eine geschaetzte Erfolgsspanne, und der Bot bekommt sie als Paar
 * [min, max] geliefert (getSuccessRange, Bladeburner.ts:142). Zwei Dinge
 * folgen daraus:
 *
 *   - Gerechnet wird mit dem MINIMUM, nie mit dem Mittelwert. Die Spanne ist
 *     Ausdruck der Unkenntnis ueber die Synthoid-Population; wer mit ihrer
 *     Mitte plant, plant mit einer Zahl, die das Spiel nie zugesagt hat.
 *   - Ist die Spanne breit, ist nicht die Aktion schlecht, sondern die
 *     Schaetzung. Dann hilft Field Analysis, nicht ein Versuch auf gut Glueck.
 *
 * Ein misslungener Vertrag kostet Rang und Zeit, eine misslungene Black Op
 * kostet zusaetzlich den Versuch selbst - deshalb steigt die geforderte
 * Sicherheit mit dem Einsatz: 0,80 fuer Vertraege, 0,85 fuer Operationen,
 * 0,99 fuer Black Ops.
 *
 * WARUM KEIN SCHLAF, SONDERN nextUpdate
 *
 * ns.bladeburner.nextUpdate() kostet 0 GB (RamCostGenerator.ts:378,
 * CycleTiming) und weckt genau dann, wenn die Division ihren Zustand
 * fortgeschrieben hat. Ein fester Schlaf waere entweder zu langsam (verpasste
 * Ticks) oder zu schnell (Leerlaufaufrufe, die je 4 GB kosten).
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const V = "Contracts", O = "Operations", B = "Black Operations", G = "General";

  // Schwellen. Siehe Kopf - je teurer der Fehlschlag, desto hoeher.
  // GEMESSEN, NICHT GERATEN (25.08.2026, 16:45, Rang 0,7 nach 15 Minuten).
  //
  // Hier stand 0,80. Das hat den Motor in eine Sackgasse gefuehrt, die von
  // aussen wie Arbeit aussah: Die Schaetzungen waren laengst scharf (Spanne
  // 0,076 bei Tracking), also griff die Field-Analysis-Regel nicht mehr -
  // aber kein einziger Vertrag kam ueber 0,80, also fiel der Motor auf
  // "Training" durch und blieb dort. Training gibt KEINEN Rang. Nach einer
  // Viertelstunde in der Division stand der Rang bei 0,7 von 3.500.
  //
  // Die gemessenen Erfolgschancen beim Eintritt:
  //   Tracking       0,628 - 0,703
  //   Retirement     0,397 - 0,445
  //   Bounty Hunter  0,318 - 0,356
  //
  // 0,80 ist fuer Vertraege die falsche Groesse. Ein misslungener Vertrag
  // kostet etwas Rang und etwas Chaos - er wirft nicht den Lauf weg wie eine
  // misslungene Black Op. Was zaehlt, ist der Erwartungswert, und der ist ab
  // etwa der Haelfte klar positiv. Dazu kommt: Vertraege geben Kampferfahrung
  // UND Rang UND Geld, Training nur Erfahrung. Ein spielbarer Vertrag schlaegt
  // Training immer.
  //
  // Fuer Operationen und Black Ops bleibt es bei den hohen Schwellen: Dort ist
  // der Fehlschlag teuer, und dort wartet man zu Recht.
  // NACHGESCHAERFT AM 25.08. UM 18:12, nachdem der Motor erneut in Training fiel.
  //
  // Gemessen in diesem Moment:
  //   Tracking       min 0,678  offen 0,4   Stufe 10  <- leergespielt
  //   Retirement     min 0,493  offen 116,6 Stufe 1
  //   Bounty Hunter  min 0,398  offen 171,8 Stufe 1
  //   Chaos 0, Overclock bereits auf Stufe 2
  //
  // Der Vorrat an Tracking war aufgebraucht (Vertraege haben endliche Zahlen und
  // wachsen nur langsam nach, Bladeburner.ts:1387-1390). Damit blieb nur
  // Retirement mit 0,493 - sieben Tausendstel unter der Schwelle. Der Motor
  // wartete also auf nichts und fuhr stattdessen Training, das keinen Rang gibt.
  //
  // 0,45 statt 0,50: Ein misslungener Vertrag kostet Zeit und ein wenig Chaos,
  // aber keinen Rang. Verglichen wird nicht mit einem besseren Vertrag, sondern
  // mit Training - und das liefert garantiert null. Bei knapp der Haelfte
  // Erfolgswahrscheinlichkeit und dem doppelten Rangertrag von Tracking
  // (rankGain 0,6 gegen 0,3) ist die Rechnung eindeutig.
  const SICHER_VERTRAG = 0.45;
  const SICHER_OPERATION = 0.85;
  const SICHER_BLACKOP = 0.99;
  // Ab dieser Spannenbreite ist die Schaetzung das Problem, nicht die Aktion.
  const SPANNE_ZU_BREIT = 0.10;
  // Ausdauer. Die Strafe ist min(1, stamina/(0,5*max)) (Bladeburner.ts:167-169)
  // und wirkt an genau einer Stelle: competence *= staminaPenalty
  // (Action.ts:176). OBERHALB VON 50 PROZENT IST SIE EXAKT 1 - jede Ausdauer
  // darueber ist wertlos.
  //
  // Bis zum 25.08.2026 stand hier 55 / 90 Prozent. Der Bot ruhte damit ab
  // einem Punkt, an dem er noch volle Leistung hatte, und ruhte dann bis zu
  // einem Wert, der ihm nichts brachte. Gemessen zwischen 19:40 und 19:59:
  // neunzehn Minuten Regenerationskammer bei unveraendertem Rang 73, waehrend
  // die Ausdauer bei 29 von 53 stand - 54,7 Prozent, Strafe 1,0, also keine.
  //
  // Jetzt: ruhen erst unter 52 Prozent, weiterarbeiten ab 60. Der schmale
  // Streifen ist Absicht - er haelt den Bot dicht ueber der Strafgrenze,
  // statt ihn eine Reserve aufbauen zu lassen, die keine Wirkung hat.
  // Ausdauer regeneriert ohnehin passiv weiter, auch waehrend der Arbeit
  // (Bladeburner.ts:1382), die Kammer verdoppelt das nur.
  const AUSDAUER_RUHE = 0.52;
  const AUSDAUER_WEITER = 0.60;
  // Trefferpunkte. Die Kammer heilt nebenbei 2 HP je Durchlauf
  // (Bladeburner.ts:1198). Solange lange geruht wurde, geschah das von selbst;
  // bei der kurzen Ruhe oben nicht mehr. Ohne eigene Schwelle liefe der Bot
  // sonst mit sinkenden HP weiter, bis ihn ein Einsatz ins Krankenhaus bringt.
  const HP_RUHE = 0.50;
  // 0,95 WAR EINE FALLE (25.08.2026, 20:47).
  //
  // Die erste Fassung ruhte, bis die Trefferpunkte fast voll waren. Gemessen
  // um 20:46: 14 von 22, also 64 Prozent. Da jeder Vertrag neuen Schaden
  // macht, ist die 95-Prozent-Marke im laufenden Betrieb kaum je erreichbar -
  // einmal in der Ruhe, blieb der Motor dort haengen, und zwar unsichtbar,
  // weil dieser Zweig keine Telemetrie schrieb.
  //
  // 0,75 ist erreichbar (die Kammer heilt 2 HP je Durchlauf) und laesst
  // trotzdem Puffer: Unter 50 Prozent wird geruht, ab 75 wieder gearbeitet.
  const HP_WEITER = 0.75;

  // Reihenfolge der Faehigkeiten. Overclock zuerst, weil es die Dauer JEDER
  // Aktion senkt und damit auf alles andere wirkt; es ist bei Stufe 90
  // gedeckelt. Danach die Erfolgschancen, danach der Rest.
  const SKILL_PLAN = [
    ["Overclock", 90],
    ["Blade's Intuition", Infinity],
    ["Digital Observer", Infinity],
    ["Cloak", Infinity],
    ["Tracer", Infinity],
    ["Short-Circuit", Infinity],
    ["Reaper", Infinity],
    ["Evasive System", Infinity],
  ];

  const sag = (t) => ns.print(t);
  // Damit die Sparmeldung nicht bei jedem Bladeburner-Tick erneut im Log steht.
  let letzterSparziel = "";

  // --- Warten, bis der Beitritt steht --------------------------------------
  while (!ns.bladeburner.inBladeburner()) {
    sag("Noch nicht in der Division - warte (bbtrain.js trainiert).");
    await ns.sleep(30000);
  }
  sag("In der Division. Motor laeuft.");

  const VERTRAEGE = ns.bladeburner.getContractNames();
  const OPERATIONEN = ns.bladeburner.getOperationNames();
  const SKILLS = new Set(ns.bladeburner.getSkillNames());

  // Erfolgsspanne einer Aktion als {min, max}. Das Spiel liefert ein Paar;
  // aeltere Fassungen lieferten eine einzelne Zahl - beides wird angenommen,
  // damit ein Versionswechsel den Motor nicht stillegt.
  const spanne = (typ, name) => {
    try {
      const r = ns.bladeburner.getActionEstimatedSuccessChance(typ, name);
      if (Array.isArray(r)) return { min: r[0], max: r[1] };
      return { min: r, max: r };
    } catch { return { min: 0, max: 0 }; }
  };

  const offen = (typ, name) => {
    try { return ns.bladeburner.getActionCountRemaining(typ, name); }
    catch { return 0; }
  };

  // --- Faehigkeiten kaufen -------------------------------------------------
  // Punkte liegen zu lassen ist immer falsch: Sie verfallen nicht, aber jede
  // Runde ohne den Bonus ist verloren. Gekauft wird strikt nach Plan, nicht
  // nach Preis - der billigste Kauf ist selten der wirksamste.
  const faehigkeitenKaufen = () => {
    let punkte = ns.bladeburner.getSkillPoints();
    if (punkte <= 0) return;
    // SPAREN STATT AUSWEICHEN (25.08.2026).
    //
    // Hier stand eine Schleife, die bei "zu teuer" mit `break` aus dem
    // aktuellen Skill aussteigt - und danach mit dem NAECHSTEN weitermacht.
    // Der Kommentar darueber versprach "strikt nach Plan, nicht nach Preis";
    // der Code tat genau das Gegenteil. Wer den teuersten Eintrag nicht
    // bezahlen kann, kauft eben den billigsten weiter unten.
    //
    // Gemessen um 17:15, eine Dreiviertelstunde nach dem Beitritt:
    //   Overclock          Stufe 0   (Plan-Platz 1, kostet 3)
    //   Blade's Intuition  Stufe 0   (Plan-Platz 2, kostet 3)
    //   Digital Observer   Stufe 1   (Plan-Platz 3)
    // Gekauft wurde also ausgerechnet der Eintrag, der zufaellig dran war, als
    // ein Punkt anfiel. Die beiden Faehigkeiten, die auf JEDE Aktion wirken -
    // Overclock senkt die Dauer, Blade's Intuition hebt die Erfolgschance -
    // standen weiter auf null, und der Rang wuchs mit 0,24 je Minute.
    //
    // Punkte fallen hier einzeln an. Eine Kaufregel, die nie wartet, kann
    // deshalb systematisch nur das Billigste kaufen. Richtig ist: beim ersten
    // Eintrag stehenbleiben, der noch nicht am Deckel ist, und sparen bis er
    // bezahlbar ist. Ein Punkt, der eine Runde liegen bleibt, ist billiger als
    // ein Punkt, der im falschen Skill steckt - Faehigkeiten lassen sich nicht
    // zurueckgeben.
    for (const [name, deckel] of SKILL_PLAN) {
      if (!SKILLS.has(name)) continue;
      const stufe = ns.bladeburner.getSkillLevel(name);
      // Am Deckel: weiterruecken, hier ist nichts mehr zu holen.
      if (stufe >= deckel) continue;
      const preis = ns.bladeburner.getSkillUpgradeCost(name, 1);
      if (!(preis > 0)) continue;
      if (preis > punkte) {
        // NICHT weitergehen. Das ist der ganze Punkt dieser Aenderung.
        if (name !== letzterSparziel) {
          sag("Spare auf " + name + " (" + preis + " Punkte, habe " + punkte + ").");
          letzterSparziel = name;
        }
        return;
      }
      if (!ns.bladeburner.upgradeSkill(name, 1)) return;
      punkte -= preis;
      letzterSparziel = "";
      sag("Faehigkeit " + name + " auf " + (stufe + 1) + " (" + preis + " Punkte).");
      // Nach einem Kauf wieder von vorn: Vielleicht reicht der Rest schon fuer
      // die naechste Stufe desselben Eintrags.
      return faehigkeitenKaufen();
    }
  };

  // --- Die naechste Aktion waehlen -----------------------------------------
  const waehle = () => {
    // 1. Ausdauer. Alles andere ist wertlos, wenn die Chance gedrueckt ist.
    const [jetzt, max] = ns.bladeburner.getStamina();
    if (max > 0 && jetzt < max * AUSDAUER_RUHE) {
      return { typ: G, name: "Hyperbolic Regeneration Chamber", grund: "Ausdauer" };
    }
    const hp = ns.getPlayer().hp;
    if (hp && hp.max > 0 && hp.current < hp.max * HP_RUHE) {
      return { typ: G, name: "Hyperbolic Regeneration Chamber", grund: "HP" };
    }

    // 2. Die naechste Black Op, wenn Rang und Sicherheit reichen. Sie sind
    //    der eigentliche Zweck: 21 Stueck, dann ist der Knoten offen.
    const bo = ns.bladeburner.getNextBlackOp();
    if (bo) {
      if (ns.bladeburner.getRank() >= bo.rank) {
        const s = spanne(B, bo.name);
        if (s.min >= SICHER_BLACKOP) {
          return { typ: B, name: bo.name, grund: "Black Op" };
        }
        // Rang reicht, Sicherheit nicht: Das ist der Normalfall und kein
        // Grund zu warten - unten wird weiter Rang und Erfahrung gesammelt,
        // bis die Chance steht.
      }
    }

    // 3. Operationen, danach Vertraege. Innerhalb einer Gruppe gewinnt die
    //    Aktion mit dem hoechsten RANGERTRAG JE MINUTE - nicht die mit der
    //    hoechsten Erfolgschance.
    //
    // DIE SICHERSTE AKTION IST NICHT DIE BESTE (25.08.2026, 21:57).
    //
    // Bis hierher gewann `s.min`, also die Erfolgswahrscheinlichkeit allein.
    // Das optimiert die falsche Zahl: Was zaehlt, ist Ertrag mal Chance
    // geteilt durch Dauer. Gemessen um 21:56 (`data/bbspann.json`):
    //
    //   Bounty Hunter   0,457 Chance · 0,9 Rang · 21 s  ->  1,176 Rang/min
    //   Retirement      0,449 Chance · 0,6 Rang · 21 s  ->  0,770 Rang/min
    //
    // Beide Vertraege sind gleich lang und praktisch gleich sicher, aber der
    // eine bringt die Haelfte mehr. Die alte Regel hat trotzdem Retirement
    // gewaehlt, sobald dessen Schaetzung einen Hauch hoeher lag.
    //
    // Die Sicherheitsschwelle bleibt als FILTER erhalten - sie entscheidet,
    // was ueberhaupt in Frage kommt. Nur die Rangfolge darunter aendert sich.
    //
    // rankGain-Werte aus reference/bitburner-src/src/Bladeburner/data/.
    const RANG_JE_ERFOLG = {
      "Tracking": 0.3, "Bounty Hunter": 0.9, "Retirement": 0.6,
      "Investigation": 2.2, "Undercover Operation": 4.4, "Sting Operation": 5.5,
      "Stealth Retirement Operation": 22, "Assassination": 44, "Raid": 55,
    };
    const beste = (liste, typ, schwelle) => {
      let treffer = null;
      for (const name of liste) {
        if (offen(typ, name) < 1) continue;
        const s = spanne(typ, name);
        if (s.min < schwelle) continue;
        const rang = RANG_JE_ERFOLG[name];
        let dauer = 0;
        try { dauer = ns.bladeburner.getActionTime(typ, name); } catch {}
        // Fehlt eine der beiden Zahlen, faellt die Aktion auf die alte
        // Bewertung zurueck: besser eine grobe Rangfolge als gar keine.
        const ertrag = (rang && dauer) ? rang * s.min / (dauer / 60000) : s.min;
        if (!treffer || ertrag > treffer.ertrag) {
          treffer = { name, min: s.min, ertrag };
        }
      }
      return treffer;
    };

    const op = beste(OPERATIONEN, O, SICHER_OPERATION);
    if (op) return { typ: O, name: op.name, grund: "Operation" };

    const vt = beste(VERTRAEGE, V, SICHER_VERTRAG);
    if (vt) return { typ: V, name: vt.name, grund: "Vertrag" };

    // 4. Nichts sicher genug. Liegt das an der Schaetzung oder an uns?
    //    Ist irgendwo die Spanne breit, fehlt Wissen ueber die Population -
    //    dann ist Field Analysis die Antwort, nicht ein Versuch auf gut Glueck.
    for (const name of [...OPERATIONEN, ...VERTRAEGE]) {
      const s = spanne(OPERATIONEN.includes(name) ? O : V, name);
      if (s.max - s.min > SPANNE_ZU_BREIT) {
        return { typ: G, name: "Field Analysis", grund: "Schaetzung unsicher" };
      }
    }

    // 5. Die Schaetzung ist scharf und trotzdem zu niedrig: Dann sind wir zu
    //    schwach. Training hebt Kampfwerte UND Hoechstausdauer.
    return { typ: G, name: "Training", grund: "zu schwach" };
  };

  // --- Hauptschleife -------------------------------------------------------
  let letzte = "";
  let ruhend = false;
  let gewichen = false;
  for (;;) {
    try {
      // WER ZU SCHWACH IST, MACHT PLATZ (25.08.2026).
      //
      // Nach einem Augmentierungs-Einbau stehen alle Kampfwerte auf 1. In
      // diesem Zustand kommt keine Aktion ueber ihre Schwelle, und der Motor
      // faellt auf Bladeburner-Training durch - das baut die Werte auf, aber
      // ohne den Ortsmultiplikator des Powerhouse Gym (Faktor 10).
      //
      // bbtrain.js kann das zehnmal schneller, braucht dafuer aber die Figur:
      // gymWorkout ist eine normale Arbeit und wuerde jede laufende
      // Bladeburner-Aktion abbrechen. Zwei Skripte, die sich gegenseitig
      // unterbrechen, erzeugen genau die Dialogflut, die an diesem Nachmittag
      // zweimal aufgetreten ist.
      //
      // Also tritt der Motor zurueck, solange das Tor zu ist. Er verliert dabei
      // nichts: Ohne Kampfwerte gaebe es ohnehin keinen Rang.
      const kw = ns.getPlayer().skills;
      const tiefstand = Math.min(kw.strength, kw.defense, kw.dexterity, kw.agility);
      if (tiefstand < 100) {
        if (!gewichen) {
          sag("Kampfwerte bei " + tiefstand + " - ueberlasse die Figur bbtrain.js.");
          gewichen = true;
          try { ns.bladeburner.stopBladeburnerAction(); } catch {}
        }
        await ns.sleep(30000);
        continue;
      }
      gewichen = false;

      faehigkeitenKaufen();

      const [jetzt, max] = ns.bladeburner.getStamina();
      const hp = ns.getPlayer().hp;
      // Hysterese: Einmal in der Ruhe, wird bis zur Weiter-Schwelle geruht -
      // sonst pendelt der Bot bei jedem Aktionsschritt zwischen beidem.
      const ausdauerKnapp = max > 0 && jetzt < max * AUSDAUER_WEITER;
      const hpKnapp = hp && hp.max > 0 && hp.current < hp.max * HP_WEITER;
      if (ruhend && (ausdauerKnapp || hpKnapp)) {
        // TELEMETRIE AUCH IM RUHEN (25.08.2026, 20:46).
        //
        // Dieser Zweig schrieb bisher nichts. Am 25.08. stand der Motor
        // deshalb 23 Minuten hier fest, ohne dass es jemand sehen konnte:
        // data/blade.json trug um 20:42 noch den Zeitstempel 20:19, und von
        // aussen ist eine haengende Schleife nicht von ruhigem Ruhen zu
        // unterscheiden. Der Strategiepruefer meldete die ganze Zeit SPUR.
        //
        // Die Zeile kostet nichts und macht den Unterschied messbar: Altert
        // blade.json ab jetzt, steht der Motor wirklich.
        ns.write("data/blade.json", JSON.stringify({
          zeit: Date.now(),
          chance: null,
          rang: Math.round(ns.bladeburner.getRank()),
          punkte: ns.bladeburner.getSkillPoints(),
          ausdauer: Math.round(jetzt) + "/" + Math.round(max),
          hp: hp ? Math.round(hp.current) + "/" + Math.round(hp.max) : null,
          // Auch hier - gerade hier. Eine lange Ruhephase ist der Zustand, in
          // dem eine stehende Engine am laengsten unentdeckt bleibt.
          spielzeit: ns.getPlayer().totalPlaytime,
          aktion: "General/Hyperbolic Regeneration Chamber",
          grund: ausdauerKnapp ? "ruht bis Ausdauer " + Math.round(max * AUSDAUER_WEITER)
            : "ruht bis HP " + Math.round(hp.max * HP_WEITER),
        }), "w");
        if (ns.getHostname() !== "home") ns.scp("data/blade.json", "home", ns.getHostname());
        await ns.bladeburner.nextUpdate();
        continue;
      }
      ruhend = false;

      const wahl = waehle();
      if (wahl.grund === "Ausdauer" || wahl.grund === "HP") ruhend = true;

      const laeuft = ns.bladeburner.getCurrentAction();
      const gleich = laeuft && laeuft.type === wahl.typ && laeuft.name === wahl.name;
      if (!gleich) {
        if (ns.bladeburner.startAction(wahl.typ, wahl.name)) {
          const kennung = wahl.typ + "/" + wahl.name;
          if (kennung !== letzte) {
            sag(kennung + "  (" + wahl.grund + ")");
            letzte = kennung;
          }
        } else {
          sag("startAction abgelehnt: " + wahl.typ + "/" + wahl.name);
          await ns.sleep(5000);
        }
      }

      // Telemetrie nach draussen. Rang ist die Zahl, an der dieser ganze
      // Knoten gemessen wird - der Kontrollpunkt aus nodes/ROUTE.md verlangt
      // nach zwei Stunden mindestens 3.500.
      const bo = ns.bladeburner.getNextBlackOp();
      // Die Erfolgschance der laufenden Aktion gehoert nach draussen.
      //
      // Ohne sie rechnet der Strategiepruefer mit dem Bruttoertrag aus dem
      // Quellcode und haelt jeden Motor fuer zu langsam, der einen Vertrag mit
      // maessiger Chance faehrt. Gemessen am 25.08. um 18:21: Retirement gibt
      // rankGain 0,6, gelingt aber nur in 49 Prozent der Faelle - effektiv
      // rund 0,3 je Durchlauf. Der Pruefer erwartete 1,7 und meldete
      // STAGNATION, obwohl blade.js genau das Richtige tat.
      const s = spanne(wahl.typ, wahl.name);
      ns.write("data/blade.json", JSON.stringify({
        zeit: Date.now(),
        chance: +s.min.toFixed(3),
        rang: Math.round(ns.bladeburner.getRank()),
        punkte: ns.bladeburner.getSkillPoints(),
        ausdauer: Math.round(jetzt) + "/" + Math.round(max),
        hp: hp ? Math.round(hp.current) + "/" + Math.round(hp.max) : null,
        // DER PULS DER SPIELENGINE (25.08.2026, 21:15).
        //
        // Netscript und die Spielengine sind ZWEI Schleifen. Am 25.08. stand
        // updateGame ab 20:27 still - Rang, Ausdauer und Aktionsfortschritt
        // eingefroren auf siebzehn Nachkommastellen -, waehrend bn4net munter
        // Runden zaehlte und Hackgeld hereinkam. Jede vorhandene Pruefung sah
        // deshalb Normalbetrieb, und der Strategiepruefer meldete 46 Minuten
        // lang SPUR.
        //
        // totalPlaytime waechst ausschliesslich in updateGame. Steht die Zahl
        // zwischen zwei Messungen still, ist die Engine tot - und dann hilft
        // kein Neustart eines Werkzeugs, sondern nur ein Neuladen des Tabs.
        spielzeit: ns.getPlayer().totalPlaytime,
        aktion: wahl.typ + "/" + wahl.name,
        grund: wahl.grund,
        naechsteBlackOp: bo ? bo.name : null,
        blackOpRang: bo ? bo.rank : null,
      }), "w");
      if (ns.getHostname() !== "home") ns.scp("data/blade.json", "home", ns.getHostname());

      await ns.bladeburner.nextUpdate();
    } catch (e) {
      sag("FEHLER: " + String(e && e.message ? e.message : e));
      await ns.sleep(10000);
    }
  }
}
