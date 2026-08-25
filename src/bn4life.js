/**
 * BitNode 4 - die Personenhaelfte.
 *
 * DIE EINZIGE INSTANZ, DIE DIE SPIELFIGUR ANFASST
 *
 * Verbrechen, Faktionsbeitritte, Einkaeufe im Darkweb. bn4net.js kuemmert
 * sich um die Rechner und ruehrt die Figur nicht an. Solange diese Trennung
 * haelt, kann kein Skript die Handlung eines anderen abbrechen - der Fehler,
 * der in BitNode 1 achtmal zugeschlagen hat.
 *
 * WARUM VERBRECHEN UND NICHT HACKING
 *
 * Die Multiplikatoren dieses BitNode (BitNode.tsx:627-655) sind eindeutig:
 *
 *     ServerMaxMoney  0.1125  x  ScriptHackMoney  0.2   =  0.0225
 *     CrimeMoney      0.2
 *
 * Hacking bringt 2,25 % des gewohnten Ertrags, Verbrechen 20 % - das
 * Neunfache. Und CrimeSuccessRate ist hier NICHT gedaempft, die Erfolgsquote
 * bleibt also die normale.
 *
 * DIE LEITER, UND WARUM SIE FEST VERDRAHTET IST
 *
 * ns.singularity.getCrimeChance kostet 5 GB - ein Sechstel des gesamten
 * Speichers, den home nach dem BitNode-Wechsel noch hat. Die Formel steht
 * aber offen im Quelltext (Crime.ts:120-136):
 *
 *     chance = (gewichtete Stats) / 975 / difficulty
 *
 * Damit laesst sich der Umschlagpunkt ausrechnen statt abfragen. Mit s als
 * mittlerem Kampfwert und dem Ertrag nach CrimeMoney 0.2:
 *
 *     shoplift  2s  $15k  diff 1/20   ->  $1.500/s * min(1, s/24.4)
 *     mug       4s  $36k  diff 1/5    ->  $1.800/s * min(1, s/48.8)
 *     homicide  3s  $45k  diff 1      ->  $3.000/s * min(1, s/195)
 *
 * Schnittpunkte bei s = 40 und s = 117. Kostet 0 GB.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // Ereignisse anhaengen, aber gedeckelt. Eine Datei, die monatelang mit "a"
  // beschrieben wird, waechst bis der Spielstand daran erstickt - und der
  // liegt komprimiert in IndexedDB, jedes Byte wird mitgeschleppt. Die letzten
  // 200 Zeilen reichen fuer jede Fehlersuche.
  const NL = String.fromCharCode(10);
  const LOG_ZEILEN = 200;
  let log = [];
  const sag = (t) => {
    const zeile = new Date().toLocaleTimeString() + "  " + t;
    ns.print(zeile);
    log.push(zeile);
    if (log.length > LOG_ZEILEN) log = log.slice(-LOG_ZEILEN);
    ns.write("data/bn4life-log.txt", log.join(NL) + NL, "w");
  };
  sag("bn4life gestartet.");

  // Die Programme in der Reihenfolge, in der sie sich lohnen. Jedes weitere
  // oeffnet einen Port mehr und damit einen ganzen Schwung Rechner fuer
  // bn4net.js. Der Faktor 3 auf den Preis ist Absicht: Wer sein letztes Geld
  // fuer ein Programm ausgibt, kann danach home nicht ausbauen.
  const PROGRAMME = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe",
    "HTTPWorm.exe", "SQLInject.exe"];

  let letzterFaktionsblick = 0;
  let letzterEinkauf = 0;
  let letzteReise = 0;
  let letztesVerbrechen = "";

  // Wie in bn4net.js: eine Ausnahme darf nicht den halben Bot beenden.
  for (let runde = 1; ; runde++) {
   try {
    const jetzt = Date.now();
    const geld = ns.getServerMoneyAvailable("home");


    // --- 0. Gegenseitige Wache ------------------------------------------------
    // Die Remote-Schnittstelle des Spiels kennt zehn Methoden, und alle zehn
    // betreffen nur Dateien (RemoteFileAPI/MessageHandlers.ts) - kein run, kein
    // exec, kein kill. Von aussen laesst sich also nichts starten. Der einzige
    // Weg ist ein Skript, das schon laeuft.
    //
    // Statt eines dritten Waechters, fuer den auf einem 32-GB-home kein Platz
    // ist, passen die beiden Haelften aufeinander auf. Faellt eine aus, ist ihr
    // Speicher frei - und die andere startet sie nach. Nur wenn beide zugleich
    // sterben, braucht es wieder einen Menschen.
    //
    // Die Bremse ist data/bn4-stop.txt: Solange die Datei da ist, wird nicht
    // wiederbelebt. Ohne sie waere ein gewolltes killall nicht durchfuehrbar.
    if (!ns.fileExists("data/bn4-stop.txt", "home")
        && !ns.isRunning("bn4net.js", "home")) {
      const pid = ns.exec("bn4net.js", "home");
      if (pid) sag("bn4net.js lag still und wurde neu gestartet (pid " + pid + ").");
    }

    // --- 0a2. Mitgliedschaften nach einem Einbau zurueckholen ----------------
    // Die billigen Augmentierungen - und damit der Weg zu den 30 Stueck, die
    // Daedalus verlangt - liegen bei Faktionen mit "keepOnInstall: false".
    // Ein Einbau wirft sie samt Reputation weg, und weil derselbe Einbau auch
    // die Kampfwerte auf den Ausgangsstand zurueckstellt, sind die
    // Beitrittsbedingungen danach ebenfalls wieder offen.
    // Am 22.08.2026 kostete das eine Handanweisung je Zyklus: nach dem Einbau
    // um 16:26 standen Netburners, Tetrads, Tian Di Hui und Slum Snakes
    // wieder auf "nicht drin", mit ihnen 19 erreichbare Augmentierungen.
    //
    // joinrun.js trainiert und tritt bei, netburn.js baut das Hacknet auf die
    // Netburners-Schwelle. Beide beenden sich von selbst; die Marke verhindert
    // nur, dass sie in derselben Runde mehrfach anlaufen.
    //
    // ACHTUNG, HIER STAND EIN FEHLER (23.08.2026): Der Kommentar behauptete,
    // die Marke falle beim naechsten Einbau mit dem Rest weg. Das stimmt
    // nicht - prestigeHomeComputer loescht `programs` und `messages`
    // (Server/ServerHelpers.ts:224-237), aber KEINE Textdateien, und
    // geloescht wurde sie im ganzen Projekt nirgends. Nach dem allerersten
    // Einbau lief der Beitrittslauf damit nie wieder: Netburners, Tetrads,
    // Tian Di Hui und Slum Snakes blieben mitsamt ihren rund 19
    // Augmentierungen dauerhaft draussen - und das sind Multiplikatorpunkte,
    // an denen der ganze Knoten haengt.
    //
    // Jetzt traegt die Marke den Zeitpunkt des Einbaus, gegen den sie gilt.
    // Ist seither ein neuer Einbau gelaufen, ist sie ungueltig.
    const BEITRITT_MARKE = "data/beitritt-erledigt.txt";
    const letzterEinbau = ns.getResetInfo().lastAugReset;
    const markeGilt = ns.fileExists(BEITRITT_MARKE, "home")
      && Number(ns.read(BEITRITT_MARKE)) >= letzterEinbau;
    if (!ns.fileExists("data/bn4-stop.txt", "home")
        && !markeGilt
        && !ns.isRunning("joinrun.js", "home")
        && !ns.isRunning("netburn.js", "home")) {
      const drin = ns.getPlayer().factions;
      const fehlend = ["Netburners", "Tetrads", "Tian Di Hui", "Slum Snakes"]
        .filter((f) => !drin.includes(f));
      // Erst ab zwei fehlenden lohnt der Lauf: eine einzelne Faktion holt
      // bn4rep beim naechsten Ziel ohnehin mit, und der Trainingslauf haelt
      // die Faktionsarbeit an.
      if (fehlend.length >= 2 && ns.fileExists("joinrun.js", "home")) {
        const pid = ns.exec("joinrun.js", "home", 1, 80);
        if (pid) {
          sag("Nach Einbau: " + fehlend.length + " Faktionen fehlen ("
            + fehlend.join(", ") + ") - joinrun.js gestartet (pid " + pid + ").");
          if (ns.fileExists("netburn.js", "home")) ns.exec("netburn.js", "home");
          // Der Zeitstempel des EINBAUS, nicht die aktuelle Uhrzeit - nur so
          // wird die Marke beim naechsten Einbau von selbst ungueltig.
          ns.write(BEITRITT_MARKE, String(letzterEinbau), "w");
        }
      }
    }

    // --- 0b. Selbstbeender ----------------------------------------------------
    // Die Fernschnittstelle kann Dateien schreiben, mehr nicht: pushFile ruft
    // writeToContentFile und sonst gar nichts (MessageHandlers.ts:92-101). Ein
    // laufendes Skript behaelt sein bereits geladenes Modul - neuer Code
    // erreicht es also NIE, solange es nicht endet. Ohne diesen Block braucht
    // jede Codeaenderung einen Menschen, der "kill" tippt; nachts heisst das
    // gar nicht.
    //
    // ns.exit() kostet nichts. Wer sich auf Zuruf beendet, wird Sekunden
    // spaeter von der anderen Haelfte neu gestartet - dann mit dem neuen Code.
    // Zielgenau. Beide Haelften lesen dieselbe Datei, aber bn4life.js taktet
    // im Sekundentakt und bn4net.js im Zehnsekundentakt - ein blosses
    // Stichwort erwischt deshalb fast immer die falsche. Steht ein Name
    // dabei, ist nur die gemeinte gemeint.
    const befehl = ns.fileExists("data/reload.txt", "home")
      ? ns.read("data/reload.txt") : "";
    if (befehl.includes("SELBST")
        && (befehl.trim() === "SELBST" || befehl.includes("bn4life.js"))) {
      ns.write("data/reload.txt", "", "w");
      sag("Neuladen angefordert - beende mich, die Wache holt mich zurueck.");
      ns.exit();
    }
    // --- 1. Einladungen annehmen ---------------------------------------------
    // Kostet nichts und verfaellt nicht, aber jede Faktion im Beutel ist ein
    // Weg zu Augmentierungen. Alle 30 Sekunden reicht.
    if (jetzt - letzterFaktionsblick > 30000) {
      letzterFaktionsblick = jetzt;
      for (const f of ns.singularity.checkFactionInvitations()) {
        // Von den sechs Staedte-Faktionen schliessen sich nur VIER wechselseitig
        // aus. Sector-12 und Aevum fuehren einander NICHT in ihren
        // enemies-Listen (FactionInfo.tsx:498-556) und sind zusammen
        // spielbar; wer dagegen Chongqing, New Tokyo, Ishima oder Volhaven
        // nimmt, verliert die beiden anderen dauerhaft (Factions.ts:57 bannt
        // Feinde unwiderruflich).
        //
        // Sector-12 und Aevum bringen zusammen vier Augmentierungen mit
        // Hacking-Multiplikator, die niedrigste ab 1.000 Reputation. Dass
        // damit die Reputation aus Coding Contracts auf mehr Faktionen
        // verteilt wird, ist kein Verlust: Sie faellt in Summe gleich aus, und
        // gebraucht wird sie in beiden.
        if (["Chongqing", "New Tokyo", "Ishima", "Volhaven"].includes(f)) continue;
        if (ns.singularity.joinFaction(f)) sag("Faktion beigetreten: " + f + ".");
      }
    }

    // --- 1b. Nach Aevum reisen, wenn es sich lohnt -----------------------------
    // Aevum verlangt neben der Anwesenheit 40 Millionen (FactionInfo.tsx:499)
    // und ist die einzige Staedte-Faktion, die neben Sector-12 bestehen kann.
    // Sie bringt drei Augmentierungen mit Hacking-Multiplikator, die
    // guenstigste ab 1.000 Reputation - fuer eine Reise zu 200.000 ein guter
    // Handel. Die Mitgliedschaft ueberlebt spaetere Reisen, nur die Einladung
    // verlangt die Anwesenheit.
    if (jetzt - letzteReise > 60000) {
      letzteReise = jetzt;
      const spieler = ns.getPlayer();
      if (!spieler.factions.includes("Aevum") && geld > 45e6
          && spieler.city !== "Aevum") {
        if (ns.singularity.travelToCity("Aevum")) {
          sag("Nach Aevum gereist (Guthaben " + Math.round(geld / 1e6) + "m).");
        }
      }
    }

    // --- 2. Darkweb ----------------------------------------------------------
    if (jetzt - letzterEinkauf > 20000) {
      letzterEinkauf = jetzt;
      if (!ns.hasTorRouter()) {
        if (geld > 200e3 * 3 && ns.singularity.purchaseTor()) sag("TOR-Router gekauft.");
      } else {
        // ALLE FEHLENDEN AUF EINMAL, UND MIT DUENNER DECKUNG (23.08.2026).
        //
        // Vorher stand hier ein `break` nach dem ersten Stueck und eine
        // dreifache Deckung. Beides stammt aus der Anfangszeit eines
        // BitNodes, wo Geld knapp ist und ein Fehlkauf weh tut. Fuer den
        // Zustand nach einem Augmentierungs-Einbau ist es falsch:
        //
        // prestigeHomeComputer setzt `homeComp.programs.length = 0`
        // (Server/ServerHelpers.ts:227) - und das laeuft bei JEDEM Einbau,
        // nicht nur beim Knotenwechsel. Alle fuenf Portprogramme sind danach
        // weg, und mit ihnen der Zugang zu den Rechnern mit dem meisten Geld.
        // Gemessen am 23.08.: 0 von 30 Fuenf-Port-Servern gerootet, waehrend
        // diese 30 Rechner 95,6 Prozent des gesamten moneyMax im Netz halten
        // ($761 von $796 Mrd). Die Gelddecke lag dadurch bei 11 statt bei
        // 248 Mrd je Sekunde.
        //
        // Ein Portprogramm ist keine Ausgabe, sondern der Schluessel zum
        // Ertrag - SQLInject allein hebt die Decke um Faktor 22. Deshalb
        // reicht knappe Deckung, und deshalb werden alle fehlenden in einem
        // Durchgang geholt statt eines je zwanzig Sekunden.
        // Was bn4rep.js fuer bereits VERDIENTE Augmentierungen zurueckgelegt
        // hat, ist auch hier tabu. Der Kanal ist data/geldbedarf.txt; bn4net
        // liest ihn seit langem (bn4net.js:348), der Programmkauf tat es
        // nicht - und mit der duennen Deckung haette er eine fertig
        // erarbeitete Augmentierung ueberholt. Bei dicker Deckung ist das nie
        // aufgefallen, weil das Dreifache faktisch dasselbe bewirkte.
        const reserviert = ns.fileExists("data/geldbedarf.txt", "home")
          ? Number(ns.read("data/geldbedarf.txt")) || 0 : 0;
        // PROGRAMME ist aufsteigend nach Preis sortiert. Der Abbruch beim
        // ersten unbezahlbaren kauft also die billigen zuerst und wartet auf
        // das teure - richtig so, denn jedes einzelne oeffnet schon Rechner.
        let gekauft = 0;
        for (const p of PROGRAMME) {
          if (ns.fileExists(p, "home")) continue;
          const preis = ns.singularity.getDarkwebProgramCost(p);
          if (preis <= 0) continue;
          const verfuegbar = ns.getServerMoneyAvailable("home") - reserviert;
          if (verfuegbar < preis * 1.05) break;
          if (ns.singularity.purchaseProgram(p)) { sag("Gekauft: " + p + "."); gekauft++; }
        }
        if (gekauft > 1) sag(gekauft + " Portprogramme in einem Durchgang zurueckgeholt.");
      }
    }

    // --- 2b. Auftraege von aussen ---------------------------------------------
    // Die Bruecke kann Dateien ins Spiel schieben, aber kein Skript starten.
    // Ohne diesen Leser haengt jeder neue Baustein daran, dass ein Mensch
    // "run xyz.js" tippt - nachts also gar nicht. Das Format ist ein
    // JSON-Array, weil Faktionen "Tian Di Hui" heissen und ein Leerzeichen
    // als Trenner die Argumente verschoben haette.
    if (ns.fileExists("data/task.txt", "home")) {
      const roh = ns.read("data/task.txt").trim();
      ns.write("data/task.txt", "", "w");   // sofort leeren, sonst Endlosstart
      if (roh) {
        try {
          const teile = JSON.parse(roh);
          // Nicht mehr stur auf home. home ist der knappste Rechner im Netz -
          // dort liegen die beiden Steuerhaelften und die Reserve. Ein neues
          // Werkzeug passt fast nie hinein, waehrend im Netz Rechner mit 32
          // oder 64 GB stehen. Singularity-Aufrufe wirken ohnehin global: Es
          // ist voellig gleich, von welchem Rechner aus die Spielfigur
          // gesteuert wird.
          const braucht = ns.getScriptRam(teile[0], "home");
          let wirt = "home", meistFrei = -1;
          for (const host of netzListe(ns)) {
            if (!ns.hasRootAccess(host)) continue;
            const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
              - (host === "home" ? 8 : 0);
            if (frei > meistFrei) { meistFrei = frei; wirt = host; }
          }
          if (wirt !== "home") ns.scp(teile[0], wirt, "home");
          const pid = ns.exec(teile[0], wirt, 1, ...teile.slice(1));
          if (pid) sag("Wirt: " + wirt + " (" + meistFrei.toFixed(1)
            + " GB frei, gebraucht " + braucht.toFixed(2) + ").");
          // ns.exec gibt bei Speichermangel still 0 zurueck. Das ist der
          // Fehlermodus, der in BitNode 1 achtmal durchgerutscht ist, weil
          // niemand den Rueckgabewert angesehen hat.
          sag(pid ? "Gestartet: " + teile.join(" ") + " (pid " + pid + ")."
            : "FEHLSCHLAG: " + teile[0] + " liess sich nicht starten - home hat "
              + (ns.getServerMaxRam("home") - ns.getServerUsedRam("home")).toFixed(2)
              + " GB frei, das Skript braucht "
              + ns.getScriptRam(teile[0], "home").toFixed(2) + " GB.");
        } catch (e) {
          sag("Auftrag unlesbar: " + String(e));
        }
      }
    }

    // --- 3. Verbrechen -------------------------------------------------------
    // Nur anstossen, wenn die Figur frei ist. Ein commitCrime auf laufende
    // Arbeit ersetzt sie kommentarlos - deshalb wird hier gefragt statt
    // gehandelt.
    // NICHT ueber isBusy() steuern. Ein per Singularity gestartetes Verbrechen
    // wiederholt sich von selbst: CrimeWork.process() gibt immer false zurueck
    // und laeuft in einer while-Schleife weiter (CrimeWork.ts:36-50), also
    // bleibt Player.currentWork gesetzt - und isBusy() ist genau diese Abfrage
    // (Singularity.ts:558-561). Wer "wenn nicht beschaeftigt, dann Verbrechen"
    // schreibt, kommt nach dem ERSTEN Aufruf nie wieder in den Block. Die
    // ganze Leiter unten waere toter Code gewesen, der Bot haette bis in alle
    // Ewigkeit Shoplift begangen: 1.500 statt 3.000 Dollar je Sekunde.
    //
    // Richtig ist der Vergleich mit dem, was tatsaechlich laeuft.
    const k = ns.getPlayer().skills;
    const kampfwert = (k.strength + k.defense + k.dexterity + k.agility) / 4;
    const verbrechen = kampfwert < 40 ? "Shoplift" : kampfwert < 117 ? "Mug" : "Homicide";
    const arbeit = ns.singularity.getCurrentWork();

    // Laeuft etwas anderes als ein Verbrechen - Faktionsarbeit, ein Studium -,
    // wird es in Ruhe gelassen. commitCrime wuerde es kommentarlos ersetzen
    // (Singularity.ts:1010-1012), und genau solche stillen Uebernahmen haben
    // in BitNode 1 stundenlange Arbeit vernichtet.
    // Der Verzicht auf Verbrechen ist eine Absprache, kein Zufall: Solange
    // bn4rep.js fuer eine Faktion arbeitet, legt es data/rep-modus.txt an.
    // Ohne diese Bremse wuerde hier jede Sekunde ein commitCrime die
    // Faktionsarbeit ersetzen - lautlos, denn commitCrime beendet laufende
    // Arbeit ohne Fehlermeldung (Singularity.ts:1010-1012). Genau so sind in
    // BitNode 1 stundenlange Arbeitsblocke verschwunden.
    // Die Bremse verfaellt. Sie stammt von bn4rep.js, das auf einem gekauften
    // Rechner laeuft - und die verschwinden bei jedem Augmentierungs-Einbau
    // (Prestige.ts:73). Bliebe die Datei dann liegen, verzichtete die Figur
    // auf Verbrechen fuer eine Faktionsarbeit, die niemand mehr steuert: kein
    // Geld, kein TOR, keine Ports, keine Werkbank, also auch nie wieder ein
    // bn4rep. Ein Zeitstempel loest diesen Knoten.
    const bremse = ns.fileExists("data/rep-modus.txt", "home")
      ? ns.read("data/rep-modus.txt") : "";
    const stempel = Number(String(bremse).split("|")[1]) || 0;
    const repModus = bremse !== "" && Date.now() - stempel < 120000;
    // BLADEBURNER SCHLAEGT VERBRECHEN (25.08.2026).
    //
    // Eine Bladeburner-Aktion ist keine Arbeit im Sinne von getCurrentWork():
    // Die Division fuehrt ihre eigene Handlung, und getCurrentWork() gibt
    // dabei null zurueck. Die Bedingung unten las das als "die Figur hat
    // nichts zu tun" und schob ein Verbrechen nach - das bricht die
    // Bladeburner-Aktion ab (Bladeburner.ts, "Your Bladeburner action was
    // cancelled because you started doing something else"). blade.js startet
    // sie sofort neu, bn4life schiebt sofort wieder ein Verbrechen nach.
    //
    // Am 25.08. um 16:25, unmittelbar nach dem Beitritt zur Division, erzeugte
    // dieses Wettrennen sekuendlich Dialoge im Spiel und liess beide Seiten
    // ins Leere laufen: kein Verbrechen kam zum Abschluss, keine
    // Bladeburner-Aktion auch.
    //
    // In einem Knoten, dessen Ausgang ueber 21 Black Operations fuehrt, ist
    // die Rangfolge eindeutig - Bladeburner traegt, Verbrechen sind Beiwerk.
    // inBladeburner() kostet 0 GB (RamCostGenerator.ts), die Bremse ist also
    // gratis.
    let inDivision = false;
    try { inDivision = ns.bladeburner.inBladeburner(); } catch { inDivision = false; }

    if (!repModus && !inDivision && (!arbeit || arbeit.crimeType)) {
      if (!arbeit || arbeit.crimeType !== verbrechen) {
        ns.singularity.commitCrime(verbrechen, true);
        if (verbrechen !== letztesVerbrechen) {
          sag("Verbrechen jetzt: " + verbrechen + " (Kampfwert "
            + kampfwert.toFixed(0) + ").");
          letztesVerbrechen = verbrechen;
        }
      }
    }

    // --- 4. Zustand nach draussen ---------------------------------------------
    if (runde % 10 === 0) {
      const spieler = ns.getPlayer();
      ns.write("data/bn4life.json", JSON.stringify({
        zeit: Date.now(),
        geld,
        verbrechen: letztesVerbrechen,
        arbeit: arbeit ? (arbeit.crimeType || arbeit.type) : null,
        kampfwert,
        skills: k,
        faktionen: spieler.factions,
        tor: ns.hasTorRouter(),
        programme: PROGRAMME.filter((x) => ns.fileExists(x, "home")),
      }), "w");
    }

   } catch (e) {
    sag("RUNDENFEHLER: " + String(e));
   }
    await ns.sleep(1000);
  }
}

/** Alle erreichbaren Rechner, per Breitensuche von home aus. */
function netzListe(ns) {
  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    for (const nachbar of ns.scan(schlange.shift())) {
      if (gesehen.has(nachbar)) continue;
      gesehen.add(nachbar);
      schlange.push(nachbar);
    }
  }
  return [...gesehen];
}
