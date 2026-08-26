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
  // DIE RUHESPANNE WAR DOPPELT SO BREIT WIE NOETIG (26.08.2026, 07:46).
  //
  // Nach dem Krankenhaus-Hebel von 06:55 ist die Ausdauer der letzte Grund,
  // aus dem der Motor noch ruht - gemessen 33,5 Prozent der Zeit. Die Spanne
  // von 52 auf 60 Prozent sind acht Prozent der Hoechstausdauer, bei 64 also
  // gut fuenf Punkte. Die Regeneration betraegt rund 1,2 je Minute
  // (Bladeburner.ts:1317-1325), macht vier Minuten Ruhe je Zyklus.
  //
  // Die Haelfte davon ist geschenkt: Die Strafe beginnt erst UNTER 50 Prozent
  // (`min(1, stamina/(0,5*max))`, Bladeburner.ts:167-169). Alles zwischen 50
  // und 100 Prozent ist gleich gut. Eine Spanne von 51 auf 56 haelt denselben
  // Sicherheitsabstand zur Strafgrenze und halbiert die Ruhezeit.
  //
  // Erwartung: Der Kammeranteil faellt von 33,5 auf unter 25 Prozent, die
  // Rangrate steigt entsprechend um rund ein Zehntel.
  const AUSDAUER_RUHE = 0.51;
  const AUSDAUER_WEITER = 0.56;
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

  // Reihenfolge der Faehigkeiten.
  //
  // OVERCLOCK STAND HIER AUF PLATZ 1 UND IST DORT WERTLOS (26.08.2026, 12:20).
  //
  // Die alte Begruendung lautete: Overclock senkt die Dauer JEDER Aktion und
  // wirkt damit auf alles andere. Das stimmt, solange die ZEIT der Engpass
  // ist. Sie ist es nicht: Der Motor steht rund die Haelfte der Zeit in der
  // Regenerationskammer und wartet auf Ausdauer.
  //
  // Der Ausdauerverlust faellt JE AKTION an, nicht je Zeit
  // (`Bladeburner.ts:921`: `stamina -= BaseStaminaLoss * difficultyMultiplier`,
  // BaseStaminaLoss 0,285). Eine um ein Prozent kuerzere Aktion heisst also ein
  // Prozent mehr Aktionen je Minute UND ein Prozent mehr Verbrauch je Minute.
  // Nachgerechnet mit Verbrauch V = 2,7 und Regeneration R = 1,2 je Minute:
  //
  //     ohne Overclock   Arbeit S/1,5000   Ruhe S/1,2   Rate 0,4444 * g/T
  //     mit  Overclock   Arbeit S/1,5273   Ruhe S/1,2   Rate 0,4445 * g/T
  //
  // Der Gewinn ist ein Zehntausendstel. Overclock zahlt sich erst aus, wenn
  // die Ausdauer nicht mehr klemmt - deshalb steht es jetzt hinter dem, was
  // genau diesen Engpass hebt, und behaelt seinen Deckel bei Stufe 90.
  //
  // CYBER'S EDGE steht dafuer auf Platz 1. Es hebt `getSkillMult(Stamina)` um
  // 2 Prozent je Stufe, und der Multiplikator steckt in BEIDEN Formeln:
  // `calculateMaxStamina` (`Bladeburner.ts:1327-1343`) und
  // `calculateStaminaGainPerSecond` (`:1317-1325`). Die Ruhezeit S/R bleibt
  // damit gleich, die Arbeitszeit S/(V-R) waechst ueberproportional, weil V
  // fest bleibt und nur R steigt. Fuenf Stufen (+10 Prozent) bringen rund
  // zehn Prozent Rangrate.
  //
  // Der Deckel 5 ist Absicht: Die Kosten sind `1 + 3 * Stufe` und damit
  // quadratisch kumulativ (5 Stufen = 35 Punkte, 8 Stufen = 92), der Nutzen
  // dagegen linear. Ohne Deckel fraesse die Faehigkeit jeden weiteren Punkt.
  const SKILL_PLAN = [
    ["Cyber's Edge", 5],
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

  // EINE STELLE FUER DIE TELEMETRIE (25.08.2026, 22:15).
  //
  // Zweimal an einem Abend ist derselbe Fehler an verschiedenen Stellen
  // aufgetreten: Ein Zweig der Hauptschleife machte `continue`, ohne etwas zu
  // schreiben. Erst der Ruhe-Zweig - das kostete 23 Minuten Blindflug, weil
  // niemand einen Haenger von ruhigem Ruhen unterscheiden konnte. Dann der
  // Weichen-Zweig, der einen Fehlalarm ueber eine angeblich stehende
  // Spielengine ausloeste, waehrend sie nachweislich lief. Beide Male wurde
  // der Einzelfall geflickt.
  //
  // Die Ursache ist die Duplikation selbst. Diese Funktion holt sich alles,
  // was jeder Zustand gemeinsam hat, selbst - ein neuer Zweig kann damit
  // nichts mehr vergessen ausser dem Aufruf. Und der faellt beim Lesen auf.
  const meldeLage = (aktion, grund, chance) => {
    let ausdauer = "?", hp = null, spielzeit = null, rang = null, punkte = null;
    try {
      const [a, amax] = ns.bladeburner.getStamina();
      ausdauer = Math.round(a) + "/" + Math.round(amax);
    } catch { /* nicht in der Division */ }
    try {
      const p = ns.getPlayer();
      spielzeit = p.totalPlaytime;
      if (p.hp && p.hp.max > 0) {
        hp = Math.round(p.hp.current) + "/" + Math.round(p.hp.max);
      }
    } catch { /* egal */ }
    try { rang = Math.round(ns.bladeburner.getRank()); } catch { /* egal */ }
    try { punkte = ns.bladeburner.getSkillPoints(); } catch { /* egal */ }
    let bo = null;
    try { bo = ns.bladeburner.getNextBlackOp(); } catch { /* egal */ }
    // DAS AKTIONSLEVEL GEHOERT NACH DRAUSSEN (26.08.2026, 06:15).
    //
    // Der Strategiepruefer erwartete fuer Contracts/Tracking 0,35 Rang je
    // Minute, gemessen waren 1,994 - Faktor 6. Der Grund steht in
    // Formulas.ts:9-23: Der Ertrag ist nicht `rankGain`, sondern
    // `rankGain * rewardFac^(level-1) * BitNode-Multiplikator`. Jede Aktion
    // hat einen eigenen rewardFac (Tracking 1,041, Bounty Hunter 1,085,
    // Retirement 1,065), und die Stufe steigt mit jedem zehnten Erfolg.
    // Ohne sie unterschaetzt der Pruefer systematisch und meldet STAGNATION,
    // wo der Motor genau das Richtige tut.
    let stufe = null;
    try {
      const teile = String(aktion).split("/");
      if (teile.length === 2 && teile[0] !== "General") {
        stufe = ns.bladeburner.getActionCurrentLevel(teile[0], teile[1]);
      }
    } catch { /* General-Aktionen haben keine Stufe */ }
    ns.write("data/blade.json", JSON.stringify({
      zeit: Date.now(),
      chance: Number.isFinite(chance) ? +chance.toFixed(3) : null,
      rang, punkte, ausdauer, hp,
      // Der Puls der Spielengine. Netscript und die Engine sind zwei
      // Schleifen; totalPlaytime waechst nur in updateGame. Steht die Zahl
      // zwischen zwei Messungen still, ist die Engine tot, und dann hilft
      // kein Neustart eines Werkzeugs, sondern nur ein Neuladen des Tabs.
      spielzeit,
      aktion, grund,
      stufe,
      naechsteBlackOp: bo ? bo.name : null,
      blackOpRang: bo ? bo.rank : null,
    }), "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/blade.json", "home", ns.getHostname()); } catch { /* egal */ }
    }
  };

  // DER ABSCHNITTSSCHREIBER (26.08.2026, 02:45).
  //
  // Der Strategiepruefer rechnet seine Erwartungswerte aus dem Quellcode:
  // rankGain mal Erfolgschance durch Aktionsdauer. Ob das stimmt, liess sich
  // bisher nicht sagen - `tools/ratencheck.js` hat am 26.08. um 02:15 gezeigt,
  // warum: Der Messverlauf haelt alle zwanzig Minuten fest, welche Aktion
  // GERADE laeuft, und schreibt ihr den ganzen Zuwachs der Zwischenzeit zu.
  // In zwanzig Minuten wechselt der Motor aber mehrfach. Contracts/Retirement
  // kam so auf einen Median von null, waehrend der Rang nachweislich stieg.
  //
  // Hier entsteht die saubere Grundlage: Bei JEDEM Aktionswechsel wird der
  // abgeschlossene Abschnitt weggeschrieben - von wann bis wann, welche
  // Aktion, wie viel Rang dazwischen. Daraus laesst sich die Rate je Aktion
  // ohne Vermischung ableiten.
  //
  // Die Endung ist .txt und nicht .jsonl: Bitburner laesst nur eine kurze
  // Liste von Dateiendungen zu und weist alles andere mit "Invalid file
  // extension" ab. Der Inhalt ist trotzdem JSON, eine Zeile je Abschnitt.
  let abschnitt = null;
  // DER AUSDAUERVERBRAUCH IST DER LETZTE UNGEMESSENE POSTEN (26.08., 09:15).
  //
  // Nach dem Krankenhaus-Hebel bleibt die Ausdauer der einzige Grund zu ruhen,
  // und sie kostet weiter 58 Prozent der Zeit (gemessen 09:14 ueber 59
  // Minuten). Zwei Ansaetze dagegen sind schon widerlegt: die Hysteresespanne
  // (symmetrisch) und die Hoechstausdauer (Regeneration waechst mit).
  //
  // Uebrig bleibt der Verbrauch selbst: `BaseStaminaLoss * difficultyMultiplier`
  // (Bladeburner.ts:921), und die Schwierigkeit steigt mit dem AKTIONSLEVEL
  // (`difficultyFac^(level-1)`). Tracking steht auf Stufe 24 und ist damit
  // teuer geworden - moeglicherweise teurer, als sein Ertrag von 2,2 Rang je
  // Minute wert ist. Ohne den Verbrauch je Aktion laesst sich das nicht
  // entscheiden, also wird er ab jetzt mitgeschrieben.
  const holeAusdauer = () => {
    try { return +ns.bladeburner.getStamina()[0].toFixed(3); } catch { return null; }
  };
  const schliesseAbschnitt = (jetztRang) => {
    if (!abschnitt) return;
    const dauer = Date.now() - abschnitt.von;
    // Abschnitte unter zehn Sekunden sind Umschaltzucken, keine Arbeit.
    if (dauer >= 10_000) {
      const zeile = JSON.stringify({
        von: abschnitt.von, bis: Date.now(), aktion: abschnitt.aktion,
        grund: abschnitt.grund, rangVon: abschnitt.rang, rangBis: jetztRang,
        ausdauerVon: abschnitt.ausdauer, ausdauerBis: holeAusdauer(),
      }) + String.fromCharCode(10);
      try {
        ns.write("data/aktionen.txt", zeile, "a");
        if (ns.getHostname() !== "home") {
          ns.scp("data/aktionen.txt", "home", ns.getHostname());
        }
      } catch (e) { /* Protokoll ist Beiwerk, nie ein Grund zum Abbruch */ }
    }
    abschnitt = null;
  };

  // WAS EINE AKTION AN AUSDAUER KOSTET - AUS DEM EIGENEN PROTOKOLL
  // (26.08.2026, 09:52).
  //
  // Seit dem Krankenhaus-Hebel ist die Ausdauer der einzige Grund zu ruhen,
  // und sie kostet 55 Prozent der Zeit. Damit zaehlt nicht mehr Rang je
  // MINUTE, sondern Rang je AUSDAUERPUNKT - die Minuten sind reichlich da,
  // die Ausdauer ist knapp.
  //
  // Gemessen 09:45 ueber 295 Abschnitte (tools/ratencheck.js):
  //   Tracking        2,180 Rang/min   0,533 je Ausdauer   1,17 je Lauf
  //   Bounty Hunter   1,710 Rang/min   0,989 je Ausdauer   1,78 je Lauf
  // Die beiden Kennzahlen widersprechen sich, und ueber den vollen Zyklus aus
  // Arbeit und Ruhe gewinnt Bounty Hunter um Faktor 1,44.
  //
  // Die Kosten werden NICHT geschaetzt, sondern aus data/aktionen.txt
  // gerechnet - derselben Datei, die dieses Skript selbst fuellt. Damit
  // kalibriert sich die Auswahl mit jedem Aktionslevel neu, statt auf einer
  // Tabelle von heute stehen zu bleiben.
  let kostenStand = 0;
  let kosten = new Map();
  let kostenSchnitt = null;
  const kostenAktualisieren = () => {
    // Alle fuenf Minuten reicht: Die Werte aendern sich mit dem Aktionslevel,
    // und das steigt mit jedem zehnten Erfolg.
    if (Date.now() - kostenStand < 5 * 60_000) return;
    kostenStand = Date.now();
    try {
      const roh = ns.read("data/aktionen.txt");
      if (!roh) return;
      const zeilen = roh.split(String.fromCharCode(10)).filter((z) => z.trim());
      const neu = new Map();
      // Nur die juengsten dreihundert Abschnitte: Aeltere stammen aus einer
      // Zeit mit anderen Aktionsleveln und verfaelschen den Schnitt.
      for (const z of zeilen.slice(-300)) {
        let d;
        try { d = JSON.parse(z); } catch { continue; }
        if (!Number.isFinite(d.ausdauerVon) || !Number.isFinite(d.ausdauerBis)) continue;
        if (d.ausdauerBis >= d.ausdauerVon) continue;   // Ruhephase, kein Verbrauch
        const e = neu.get(d.aktion) || { aus: 0, n: 0 };
        e.aus += d.ausdauerVon - d.ausdauerBis;
        e.n++;
        neu.set(d.aktion, e);
      }
      const fertig = new Map();
      for (const [name, e] of neu) {
        // Unter fuenf Abschnitten ist der Schnitt Rauschen.
        if (e.n >= 5) fertig.set(name, e.aus / e.n);
      }
      kosten = fertig;
      const werte = [...fertig.values()];
      kostenSchnitt = werte.length
        ? werte.reduce((n, v) => n + v, 0) / werte.length : null;
    } catch (e) { /* Protokoll fehlt: dann eben nach Zeit */ }
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
        // Rang je AUSDAUERPUNKT, sobald ueberhaupt etwas gemessen ist.
        //
        // ZWEI EINHEITEN IM SELBEN VERGLEICH SIND KEIN VERGLEICH
        // (26.08.2026, 09:55). Der erste Entwurf liess Aktionen ohne Messung
        // auf "Rang je Minute" zurueckfallen - und die Zahlen liegen auf
        // voellig verschiedenen Skalen: 0,19 gegen 0,77. Der Rueckfall gewann
        // dadurch IMMER, und um 09:54 fuhr der Motor prompt Retirement, die
        // einzige Aktion ohne Messwert.
        //
        // Jetzt bekommt eine ungemessene Aktion den Durchschnitt der
        // gemessenen als Schaetzwert. Damit steht sie auf derselben Skala,
        // kommt trotzdem an die Reihe und liefert dabei ihre eigene Messung.
        // ZURUECKGEDREHT (26.08.2026, 10:15) - die Messung hat die Rechnung
        // widerlegt. Ausgewaehlt wird wieder nach Rang je MINUTE.
        //
        // Von 09:57 bis 10:14 lief die Auswahl nach Rang je Ausdauerpunkt:
        //   vorher (09:19-09:45)   55,5 % Kammer   0,926 Rang/min
        //   danach (09:57-10:14)   62,3 % Kammer   0,606 Rang/min
        // Erwartet waren mindestens 1,15. Selbst auf siebzehn Minuten
        // Messstrecke ist ein Drittel Verlust kein Rauschen.
        //
        // Die Zyklusrechnung von 09:46 hat etwas uebersehen - vermutlich, dass
        // Bounty Hunter mit 44 Prozent Erfolgschance unter der Sicherheits-
        // schwelle liegt und ueber den Notvertrag-Zweig laeuft: Jeder
        // Fehlschlag kostet volle Ausdauer und bringt null Rang, und das
        // trifft mehr als die Haelfte der Versuche.
        //
        // Die MESSUNG bleibt (kostenAktualisieren oben): Sie kostet nichts,
        // liefert weiter Daten, und die naechste Hypothese kann darauf
        // aufbauen, statt wieder bei null anzufangen.
        const proLauf = kosten.get(typ + "/" + name) ?? kostenSchnitt;
        const ertrag = (rang && dauer) ? rang * s.min / (dauer / 60000) : s.min;
        // proMinute wird MITGEFUEHRT, auch wenn nach Ausdauer ausgewaehlt
        // wird: Der Vergleich mit General-Aktionen (Field Analysis, Training)
        // geht nur ueber die Zeit, denn die kosten gar keine Ausdauer. Ohne
        // diese zweite Zahl vergleicht man Aepfel mit Birnen - genau das ist
        // um 09:55 passiert, und der Motor landete prompt auf Field Analysis.
        const proMinute = (rang && dauer) ? rang * s.min / (dauer / 60000) : s.min;
        if (!treffer || ertrag > treffer.ertrag) {
          treffer = { name, min: s.min, ertrag, proMinute };
        }
      }
      return treffer;
    };

    const op = beste(OPERATIONEN, O, SICHER_OPERATION);
    if (op) return { typ: O, name: op.name, grund: "Operation" };

    const vt = beste(VERTRAEGE, V, SICHER_VERTRAG);
    if (vt) return { typ: V, name: vt.name, grund: "Vertrag" };

    // EIN UNSICHERER VERTRAG SCHLAEGT FIELD ANALYSIS UM LAENGEN
    // (26.08.2026, 00:55).
    //
    // Faellt keine Aktion ueber ihre Sicherheitsschwelle, landete der Motor
    // bisher bei Field Analysis - und die bringt rankGain 0,1, also rund 0,2
    // Rang je Minute. Gemessen am 26.08. zwischen 22:43 und 00:51: 28 Rang in
    // 128 Minuten, 0,22 je Minute. Genau dieser Wert.
    //
    // Dabei lagen die Vertraege nur knapp darunter: Bounty Hunter 0,381 gegen
    // eine Schwelle von 0,45. Sein Ertrag betraegt trotzdem 0,98 Rang je
    // Minute - das FUENFFACHE von Field Analysis. Die Schwelle vergleicht die
    // Chance mit einer festen Zahl, statt den Ertrag mit der Alternative.
    //
    // Bei Vertraegen ist ein Misserfolg billig: etwas Ausdauer, etwas Chaos,
    // kein Rangverlust und kein Toter. Deshalb gilt hier der Ertragsvergleich.
    // Operationen (Teamverluste) und Black Ops (Tod) behalten ihre
    // Sicherheitsschwellen unangetastet.
    let feldErtrag = 0.2;
    try {
      const t = ns.bladeburner.getActionTime(G, "Field Analysis");
      if (t > 0) feldErtrag = 0.1 / (t / 60000);
    } catch { /* Schaetzwert bleibt */ }
    const notvertrag = beste(VERTRAEGE, V, 0);
    // Der Faktor 1,5 ist Absicht: Ein knapper Vorsprung waere die Unschaerfe
    // nicht wert, die Field Analysis ausraeumen wuerde.
    if (notvertrag && notvertrag.proMinute > feldErtrag * 1.5) {
      return { typ: V, name: notvertrag.name,
        grund: "Vertrag unter Schwelle, lohnt trotzdem" };
    }

    // 3b. SIND DIE VORRAETE LEER? DANN NACHFUELLEN (26.08.2026, 10:48).
    //
    // Gemessen 10:45: Tracking hat nur noch **1,0** offene Vertraege, und
    // seine Erfolgschance ist von 0,74 auf 0,525 gefallen. Bounty Hunter und
    // Retirement stehen bei 0,273 und 0,324 - beide unter der Schwelle. Der
    // Motor faellt deshalb auf schlechte Aktionen zurueck, und die Rangrate
    // ist von 0,926 auf 0,60 je Minute eingebrochen.
    //
    // `Incite Violence` fuellt ALLE Vertraege und Operationen auf einen
    // Schlag: Es rechnet 180 Wachstumsschritte auf einmal gut
    // (`Bladeburner.ts:1219-1225`, `60 * 3 * growthFunction()`). Es dauert
    // 60 Sekunden und kostet **keine Ausdauer**
    // (`data/GeneralActions.ts:52-58`) - genau richtig, wenn die Ausdauer
    // ohnehin der Engpass ist.
    //
    // Der Preis ist Chaos: +10 plus chaos/log10(chaos) in JEDER Stadt. Erst
    // ueber 50 macht Chaos die Aktionen schwerer
    // (`ChaosThreshold`, `Actions/Action.ts:94-101`), und aktuell steht
    // Sector-12 bei 13. Ein Durchlauf bringt es auf etwa 35, ein zweiter
    // darueber - deshalb die Grenze bei 25.
    const chaosJetzt = (() => {
      try { return ns.bladeburner.getCityChaos(ns.bladeburner.getCity()); }
      catch { return 999; }
    })();
    // `some`, nicht `every` (korrigiert 10:49): Leer sein muss nur EIN
    // Vertrag - und zwar der beste. Um 10:47 stand Tracking bei 1,0 offenen
    // Auftraegen, waehrend Bounty Hunter noch 487 hatte; mit `every` haette
    // der Block nie gegriffen, obwohl genau dieser Fall gemeint ist.
    //
    // Die Rechnung dahinter: Eine Minute Incite Violence kostet den Ertrag
    // des Notvertrags (Bounty Hunter, 0,567 Rang je Minute). Danach ist
    // Tracking wieder da und bringt 2,2 - der Verlust ist nach gut dreissig
    // Sekunden wieder eingespielt.
    const vorratLeer = VERTRAEGE.some((name) => offen(V, name) < 3);
    if (vorratLeer && chaosJetzt < 25) {
      return { typ: G, name: "Incite Violence", grund: "Vertragsvorrat leer" };
    }

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
        meldeLage("General/keine", "weicht bbtrain, Kampfwerte " + tiefstand);
        await ns.sleep(30000);
        continue;
      }
      gewichen = false;

      faehigkeitenKaufen();
      kostenAktualisieren();

      const [jetzt, max] = ns.bladeburner.getStamina();
      let hp = ns.getPlayer().hp;

      // DAS KRANKENHAUS SCHLAEGT DIE KAMMER UM LAENGEN (26.08.2026, 06:55).
      //
      // Gemessen ueber 222 Minuten: Der Motor stand 161 davon - 72,5 Prozent -
      // in der Regenerationskammer, und der Grund waren fast immer die
      // Trefferpunkte, nicht die Ausdauer. Kein Wunder: Das Maximum ist
      // floor(10 + defense/10), also 23 (Person.ts:97), und die Kammer heilt
      // 2 je Durchlauf (Bladeburner.ts:1198). Von 11 auf 17 sind das drei
      // Durchlaeufe - Minuten, in denen kein Rang entsteht.
      //
      // `ns.singularity.hospitalize()` setzt hp.current in EINEM Aufruf auf
      // das Maximum (PlayerObjectGeneralMethods.ts:281-290). Es kostet Geld
      // und sonst nichts: keine Zeit, keine Aktionsunterbrechung. Auf das
      // Ereignis hoert nur die Infiltration (Infiltration.ts:83), und die
      // fahren wir nicht.
      //
      // Kosten: min(Guthaben * 0,1, fehlendeHP * 100.000). Bei zwoelf
      // fehlenden Punkten sind das 1,2 Millionen - gegen ein Guthaben von
      // siebeneinhalb Milliarden ist das nichts. Die Untergrenze von zehn
      // Millionen schuetzt den Wiederaufbau nach einem Einbau: Dort zaehlt
      // jeder Euro fuer Server und Programme, und die Kammer tut es auch.
      if (hp && hp.max > 0 && hp.current < hp.max * HP_WEITER) {
        try {
          if (ns.getPlayer().money > 10e6) {
            ns.singularity.hospitalize();
            hp = ns.getPlayer().hp;
          }
        } catch (e) { /* ohne Singularity bleibt die Kammer */ }
      }

      // Hysterese: Einmal in der Ruhe, wird bis zur Weiter-Schwelle geruht -
      // sonst pendelt der Bot bei jedem Aktionsschritt zwischen beidem.
      const ausdauerKnapp = max > 0 && jetzt < max * AUSDAUER_WEITER;
      const hpKnapp = hp && hp.max > 0 && hp.current < hp.max * HP_WEITER;
      if (ruhend && (ausdauerKnapp || hpKnapp)) {
        // Telemetrie auch im Ruhen - gerade hier. Eine lange Ruhephase ist
        // der Zustand, in dem ein Haenger am laengsten unentdeckt bliebe.
        meldeLage("General/Hyperbolic Regeneration Chamber",
          ausdauerKnapp ? "ruht bis Ausdauer " + Math.round(max * AUSDAUER_WEITER)
            : "ruht bis HP " + Math.round(hp.max * HP_WEITER));
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
          let r = null;
          try { r = ns.bladeburner.getRank(); } catch { /* egal */ }
          schliesseAbschnitt(r);
          abschnitt = { von: Date.now(), aktion: wahl.typ + "/" + wahl.name,
            grund: wahl.grund, rang: r, ausdauer: holeAusdauer() };
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
      // Die Erfolgschance der laufenden Aktion gehoert nach draussen: Ohne sie
      // rechnet der Strategiepruefer mit dem Bruttoertrag aus dem Quellcode
      // und haelt jeden Motor fuer zu langsam, der einen Vertrag mit maessiger
      // Chance faehrt. Gemessen am 25.08. um 18:21: Retirement gibt rankGain
      // 0,6, gelingt aber nur in 49 Prozent der Faelle - effektiv rund 0,3 je
      // Durchlauf. Der Pruefer erwartete 1,7 und meldete STAGNATION, obwohl
      // blade.js genau das Richtige tat.
      meldeLage(wahl.typ + "/" + wahl.name, wahl.grund, s.min);

      await ns.bladeburner.nextUpdate();
    } catch (e) {
      sag("FEHLER: " + String(e && e.message ? e.message : e));
      await ns.sleep(10000);
    }
  }
}
