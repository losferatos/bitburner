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

// STEUERKANAELE WOHNEN AUF home (04.09.2026, 20:10).
//
// Dieses Skript hat `hostRule: "werkbank"`, laeuft also im Regelfall NICHT
// auf home - und es liest vier Dateien, die dort wohnen. Der gefaehrlichste
// Fall war `data/task.txt`:
//
//     if (ns.fileExists("data/task.txt", "home")) {   // prueft HOME
//       const roh = ns.read("data/task.txt").trim();  // liest LOKAL -> ""
//       ns.write("data/task.txt", "", "w");           // leert LOKAL -> nichts
//
// Auf einem Fremdwirt haette das den Auftrag weder ausgefuehrt NOCH geleert.
// `task.txt` auf home waere dauerhaft belegt geblieben, und damit der
// einzige Kanal, ueber den dem Bot von aussen etwas gesagt werden kann -
// lautlos, ohne Fehler, ohne Logzeile. Dasselbe Muster bei `reload.txt`,
// also dem Neustartweg.
//
// Heute faellt es nicht auf, weil bn4life zufaellig auf home liegt. Genau
// solche Zufaelle sind es, die dieser Bot nicht ueberleben soll.
import { liesVonHome, nachHome } from "lib/hostdatei.js";


// --- Die Figur-Wache (Position C.11) ---------------------------------------
//
// Es gibt genau EINE Spielfigur, und sechs Gewerke wollen sie. Der Kern ist
// der Schiedsrichter (bn4net.js, Abschnitt 9a); hier wird nur beantragt und
// nachgesehen.
import { beantrage as figBeantrage, darf as figDarf } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";

export async function main(ns) {
  const auftragVersuche = new Map();   // data/task.txt-Inhalt -> Fehlversuche
  let letzteTelemetrie = 0;            // Wanduhr der letzten bn4life.json
  let auftragPause = 0;                // fruehestens dann task.txt wieder lesen
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
  // Fuer die Figur-Wache: zuletzt gesehene Folgenummer und zuletzt gemeldeter
  // Grund. bn4life taktet im Sekundentakt - ohne den Merker stuende jede
  // Sekunde dieselbe Zeile im Log.
  let figSeq = null;
  let figGrundLetzt = null;

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
    // Derselbe Boden wie in joinrun.js vor gymWorkout (dort 5e6).
    const JOINRUN_GELD_BODEN = 5e6;
    // Derselbe Zielwert, mit dem joinrun.js unten gestartet wird (Audit G1) -
    // eine einzige Konstante statt zweier Literale, die auseinanderlaufen
    // koennten.
    const JOINRUN_ZIEL = 80;
    const letzterEinbau = ns.getResetInfo().lastAugReset;
    // NACHHOME/LIESVONHOME STATT ns.fileExists/ns.read (27.09.2026, Audit G1).
    //
    // Hier stand `ns.fileExists(BEITRITT_MARKE, "home")` (prueft home) neben
    // `Number(ns.read(BEITRITT_MARKE))` OHNE Host-Parameter - `ns.read` liest
    // IMMER vom eigenen Rechner (NetscriptFunctions.ts:1120ff, siehe
    // lib/hostdatei.js, dort steht `boerse.js` als genau dieselbe
    // Fehlerklasse: "Waechter auf home, gelesen wird LOKAL - falsch"). Der
    // Schreiber (weiter unten) hatte dasselbe Loch: `ns.write(...)` ohne Host
    // schreibt lokal, nicht auf home.
    //
    // bn4life.js hat `hostRule: "werkbank"` und lief zum Vorfallszeitpunkt auf
    // "I.I.I.I", nicht auf home - belegt im Spielstand der 09:08-Sicherung
    // vom 27.09.2026 (AllServersSave, home.runningScripts): dort liefen ZWEI
    // joinrun.js-Prozesse gleichzeitig auf home, waehrend bn4life.js selbst
    // auf I.I.I.I stand. Die Marke landete beim Schreiben also nie auf home,
    // `markeGilt` blieb fuer immer false, und joinrun.js startete nach jedem
    // natuerlichen Fristablauf (FRIST_MS, 45 min) erneut - ganz ohne dass ein
    // bn4life-Neustart noetig gewesen waere. `liesVonHome`/`nachHome` sind
    // oben schon importiert (fuer data/reload.txt und data/task.txt) und
    // kosten hier nichts zusaetzlich.
    const markeRoh = liesVonHome(ns, BEITRITT_MARKE);
    const markeGilt = markeRoh !== "" && Number(markeRoh) >= letzterEinbau;
    // DIE DAEDALUS-SCHWELLE LEBT IN joinrun.js, NICHT HIER (26.09.2026,
    // Skeptiker-Rework nach Paket C.2).
    //
    // Ein erster Durchgang hatte den Blick hierher gebaut
    // (ns.singularity.getOwnedAugmentations + ns.getBitNodeMultipliers) -
    // bn4life.js ist aber ein Dauerlaeufer, der direkt nach jedem Einbau auf
    // einem knappen home steht, und der Skeptiker mass dort +4/+5 GB. Die
    // Pruefung braucht ausserdem nur EINMAL zu laufen, am Anfang von
    // joinrun.js: dort kostet sie nichts Zusaetzliches (293+ GB Singularity
    // ohnehin), und joinrun.js setzt BEITRITT_MARKE selbst, wenn die
    // Schwelle schon erreicht ist - `markeGilt` oben faengt den naechsten
    // Start dieses Zyklus dann genauso ab, wie es ein direkter Blick hier
    // getan haette.
    //
    // ERST AB DEM GYM-GELDBODEN STARTEN (27.09.2026, Integrationspruefung).
    // joinrun.js trainiert erst ab 5 Mio ("Konto unter 5 Mio - kein Gym")
    // und wartete nach einem Sprung (1.262 $) bis zu 45 min untaetig - mit
    // netburn.js zusammen 58,2 GB auf home (tools/ram.js, SF4.3). Auf dem
    // 128-GB-home nach dem Sprung blieben so 0,55 GB frei, und shop.js
    // (7 GB, hostRule home, einziger Preislieferant fuer den Rechnerkauf)
    // fand keinen Platz (tools/test-bn4life-beitritt.js). Die Marke wird
    // erst beim Start gesetzt - der Lauf entfaellt nicht, er kommt spaeter,
    // und seine 45-Minuten-Frist geht nicht mehr mit Warten verloren.
    // DIESELBE ARGUMENTLISTE WIE BEIM START (27.09.2026, Audit G1).
    //
    // `ns.isRunning(script, host)` OHNE weitere Argumente prueft auf eine
    // LEERE Argumentliste (NetscriptHelpers.tsx, scriptIdentifier: `_args ===
    // undefined ? [] : scriptArgs(...)`) - joinrun.js laeuft aber immer mit
    // dem Zielwert 80 (`ns.exec("joinrun.js", "home", 1, JOINRUN_ZIEL)`
    // unten). Die Pruefung fand das laufende Skript deshalb NIE, egal ob es
    // lief oder nicht - direkt belegt im Spielstand der 09:08-Sicherung:
    // ZWEI joinrun.js-Prozesse gleichzeitig auf home, beide mit Argument 80.
    if (!ns.fileExists("data/bn4-stop.txt", "home")
        && !markeGilt
        && geld >= JOINRUN_GELD_BODEN
        && !ns.isRunning("joinrun.js", "home", JOINRUN_ZIEL)
        && !ns.isRunning("netburn.js", "home")) {
      const drin = ns.getPlayer().factions;
      const fehlend = ["Netburners", "Tetrads", "Tian Di Hui", "Slum Snakes"]
        .filter((f) => !drin.includes(f));
      // Erst ab zwei fehlenden lohnt der Lauf: eine einzelne Faktion holt
      // bn4rep beim naechsten Ziel ohnehin mit, und der Trainingslauf haelt
      // die Faktionsarbeit an.
      if (fehlend.length >= 2 && ns.fileExists("joinrun.js", "home")) {
        const pid = ns.exec("joinrun.js", "home", 1, JOINRUN_ZIEL);
        if (pid) {
          sag("Nach Einbau: " + fehlend.length + " Faktionen fehlen ("
            + fehlend.join(", ") + ") - joinrun.js gestartet (pid " + pid + ").");
          if (ns.fileExists("netburn.js", "home")) ns.exec("netburn.js", "home");
          // Der Zeitstempel des EINBAUS, nicht die aktuelle Uhrzeit - nur so
          // wird die Marke beim naechsten Einbau von selbst ungueltig. UEBER
          // nachHome (Audit G1): sonst verpufft der Schreibvorgang auf der
          // Werkbank, siehe Begruendung oben bei markeGilt.
          nachHome(ns, BEITRITT_MARKE, String(letzterEinbau));
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
    const befehl = liesVonHome(ns, "data/reload.txt");
    if (befehl.includes("SELBST")
        && (befehl.trim() === "SELBST" || befehl.includes("bn4life.js"))) {
      nachHome(ns, "data/reload.txt", "");
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
          ? Number(liesVonHome(ns, "data/geldbedarf.txt")) || 0 : 0;
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
    if (Date.now() >= auftragPause && ns.fileExists("data/task.txt", "home")) {
      const roh = liesVonHome(ns, "data/task.txt").trim();
      nachHome(ns, "data/task.txt", "");   // sofort leeren, sonst Endlosstart
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
            // HACKNET-SERVER SIND KEINE WIRTE (22.09.2026). Sie haben
            // adminRights ab Konstruktion (PlayerObjectServerMethods.ts:50)
            // und kaemen deshalb durch die Root-Pruefung. Belegter Speicher
            // kostet dort direkt Hashes: die Rate haengt linear an
            // ramRatio = 1 - ramUsed/maxRam (HacknetServers.ts:14), bei
            // einem frischen 1-GB-Server (HacknetServer.ts:61) also alles.
            // bn4net.js:823 nimmt sie aus demselben Grund aus.
            if (host.startsWith("hacknet-server-")) continue;
            if (!ns.hasRootAccess(host)) continue;
            const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
              - (host === "home" ? 8 : 0);
            if (frei > meistFrei) { meistFrei = frei; wirt = host; }
          }
          // DIE BIBLIOTHEKEN MUESSEN MIT (22.09.2026).
          //
          // Hier stand nur das Skript selbst. Fehlt eine importierte Datei
          // auf dem Ziel, ist das Skript dort UNGUELTIG: Bitburner kann
          // seinen Speicherbedarf nicht berechnen und ns.exec gibt still 0
          // zurueck - kein Absturz, keine Meldung.
          //
          // Am 22.09.2026 hat das nach dem Sprung nach BN9 L3 eine Stunde
          // gekostet: autopilot.js importiert lib/calc und lib/batch, auf
          // fulcrumtech lag nur lib/hackaugs.js. Ueber die Bruecke gemessen:
          //   calculateRam autopilot.js auf fulcrumtech
          //     vorher : "Cannot calculate RAM usage of an invalid script"
          //     nachher: 34.2
          // Nach dem Nachschieben der beiden Dateien startete es sofort.
          //
          // bn4net.js:3859 loest das ueber needsLibs aus registry.json.
          // Das genuegt hier nicht: autopilot.js steht gar nicht in der
          // Registry, und der Auftragskanal soll JEDES Skript starten
          // koennen. Deshalb werden die Importe aus der Quelle gelesen.
          //
          // TRANSITIV, anders als bn4net: lib/batch.js importiert
          // selbst lib/calc. Die Tiefe ist auf 4 begrenzt, damit ein
          // Ringimport die Runde nicht aufhaengt; `gesehen` faengt ihn
          // ohnehin ab und dient zugleich als Ergebnisliste.
          //
          // liesVonHome statt ns.read, weil bn4life fast nie auf home
          // sitzt und ns.read IMMER lokal liest - genau der Fehler, der
          // in lib/hostdatei.js dokumentiert ist. Kostet nichts extra:
          // die Funktion ist oben schon importiert.
          // DIE REGEX LIEST AUCH KOMMENTARE (Skeptiker, 22.09.2026).
          //
          // Ein Bot, dessen Kommentare Code zitieren, hat davon reichlich:
          // join.js:58 und lib/figurns.js:17-18 enthalten Importzeilen in
          // Prosa. Heute sind das gueltige Dateinamen, also folgenlos. Ein
          // Kommentar wie `... from "der Bruecke"` ergaebe dagegen den Pfad
          // "der Bruecke.js", und ns.scp WIRFT bei einem ungueltigen Pfad
          // (NetscriptFunctions.ts:745-757 ueber helpers.filePath). Der Wurf
          // landet im catch weiter unten als "Auftrag unlesbar" - der
          // Auftragskanal waere fuer dieses Skript dauerhaft tot.
          //
          // Deshalb wird jeder Treffer verworfen, der ein in Dateipfaden
          // verbotenes Zeichen enthaelt. Die Liste stammt aus
          // Paths/Directory.ts:28 (dort ohne "/", das hier als Trenner
          // erlaubt bleibt) plus Leerraum.
          //
          // Endungen: validScriptExtensions sind .js/.jsx/.ts/.tsx
          // (ScriptFilePath.ts:20). Nur wenn KEINE davon dransteht, wird
          // ".js" angehaengt - sonst wuerde aus "lib/x.tsx" ein
          // "lib/x.tsx.js". .json und .txt sind KEINE gueltigen
          // Importziele (TextFilePath.ts:8 trennt sie ab); eine Datei, die
          // eine JSON liest, laedt sie zur Laufzeit und muss sie darum wie
          // exit.js von Hand fuehren - siehe ausgang.js:60.
          const VERBOTEN = /[\s*?[\]!\\~|#"']/;
          const libsVon = (datei, tiefe, gesehen) => {
            if (tiefe > 4) return gesehen;
            const quelle = liesVonHome(ns, datei) || "";
            for (const m of quelle.matchAll(/from\s+["']([^"']+)["']/g)) {
              let lib = m[1];
              if (!lib || VERBOTEN.test(lib)) continue;
              if (!/\.(js|jsx|ts|tsx)$/.test(lib)) lib += ".js";
              if (gesehen.has(lib)) continue;
              gesehen.add(lib);
              libsVon(lib, tiefe + 1, gesehen);
            }
            return gesehen;
          };
          const libs = [...libsVon(teile[0], 0, new Set())];
          if (wirt !== "home") {
            const ok = ns.scp([teile[0], ...libs], wirt, "home");
            // ns.scp WIRFT NICHT, wenn eine Quelldatei fehlt - es meldet
            // den Teilausfall nur im Rueckgabewert (NetscriptFunctions.ts:
            // 803-808). Ohne diese Zeile waere der Fehlschlag wieder still.
            if (!ok) {
              const fehlend = [teile[0], ...libs]
                .filter((d) => !ns.fileExists(d, wirt));
              sag("BEFUND: scp nach " + wirt + " unvollstaendig - fehlt: "
                + (fehlend.join(", ") || "(scp meldete Teilausfall)")
                + ". ns.exec wird gleich still 0 geben.");
            }
          }
          const pid = ns.exec(teile[0], wirt, 1, ...teile.slice(1));
          if (pid) sag("Wirt: " + wirt + " (" + meistFrei.toFixed(1)
            + " GB frei, gebraucht " + braucht.toFixed(2) + ").");
          // ns.exec gibt bei Speichermangel still 0 zurueck. Das ist der
          // Fehlermodus, der in BitNode 1 achtmal durchgerutscht ist, weil
          // niemand den Rueckgabewert angesehen hat.
          sag(pid ? "Gestartet: " + teile.join(" ") + " (pid " + pid + ")."
            // DEN ECHTEN WIRT NENNEN (22.09.2026).
            //
            // Hier stand fest home samt dessen freiem Speicher, obwohl
            // ns.exec auf `wirt` lief. Am 22.09. meldete die Zeile
            //   "home hat 12.95 GB frei, das Skript braucht 34.20 GB"
            // waehrend der tatsaechliche Wirt 212 GB frei hatte und der
            // Grund ein fehlender Import war. Die Meldung hat die
            // Fehlersuche zweimal in die falsche Richtung geschickt.
            //
            // getScriptRam auf dem ZIEL ist der entscheidende Zusatz: es
            // gibt dort 0 zurueck, wenn das Skript wegen eines fehlenden
            // Imports ungueltig ist. Damit unterscheidet die Meldung die
            // beiden Faelle, die vorher gleich aussahen.
            : "FEHLSCHLAG: " + teile[0] + " liess sich auf " + wirt
              + " nicht starten - dort " + meistFrei.toFixed(2)
              + " GB frei, gebraucht " + braucht.toFixed(2) + " GB"
              + (ns.getScriptRam(teile[0], wirt) === 0
                  ? " - UND das Skript ist auf " + wirt + " ungueltig (fehlender Import?), deshalb gibt exec 0."
                  : ".") + " home haette "
              + (ns.getServerMaxRam("home") - ns.getServerUsedRam("home")).toFixed(2)
              + " GB frei, das Skript braucht "
              + ns.getScriptRam(teile[0], "home").toFixed(2) + " GB.");
          // NICHT VERFALLEN LASSEN (02.09.2026): wie in bn4net.js - ein
          // Auftrag ohne Platz wird bis zu 30 Runden zurueckgelegt.
          if (!pid) {
            // Zeitbasiert (bn4life laeuft im Sekundentakt): fuenf Minuten ab
            // dem ersten Fehlversuch, dazwischen liegen lassen.
            const erster = auftragVersuche.get(roh) || Date.now();
            auftragVersuche.set(roh, erster);
            if (Date.now() - erster <= 5 * 60000) { ns.write("data/task.txt", roh, "w"); auftragPause = Date.now() + 30000; }
            else { auftragVersuche.delete(roh); sag("Auftrag nach 5 Minuten verworfen: " + roh); }
          } else auftragVersuche.delete(roh);
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
      ? liesVonHome(ns, "data/rep-modus.txt") : "";
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
        // DIE FIGUR-WACHE. `commitCrime` bricht einen laufenden Graft wortlos
        // ab, und `GraftingWork.finish(cancelled)` gibt das Geld NICHT zurueck
        // (Work/GraftingWork.tsx:75-83). Beim Simulacrum waeren das 450 Mrd.
        // Verbrechen haben deshalb die NIEDRIGSTE Prioritaet der sechs
        // Gewerke - sie sind Beiwerk, kein Traeger.
        figBeantrage(ns, "bn4life.js", FIG_PRIO.verbrechen, "verbrechen",
          verbrechen, "Kampfwerte und Geld nebenbei");
        const figW = figDarf(ns, "bn4life.js", figSeq);
        if (figW.seq !== null) figSeq = figW.seq;
        if (!figW.darf) {
          if (figGrundLetzt !== figW.grund) {
            sag("Kein Verbrechen: " + figW.grund);
            figGrundLetzt = figW.grund;
          }
        } else {
        figGrundLetzt = null;
        ns.singularity.commitCrime(verbrechen, true);
        if (verbrechen !== letztesVerbrechen) {
          sag("Verbrechen jetzt: " + verbrechen + " (Kampfwert "
            + kampfwert.toFixed(0) + ").");
          letztesVerbrechen = verbrechen;
        }
        }
      }
    }

    // --- 4. Zustand nach draussen ---------------------------------------------
    // NACH WANDUHR, NICHT NACH RUNDEN (02.09.2026): Im gedrosselten Tab (ein
    // Wake je Minute) kam Runde 10 erst nach ~10 min - bn4net haette das
    // Skript fuer tot gehalten und alle paar Minuten neu gestartet. Und die
    // Datei muss nach home: bn4net liest sie dort, bn4life laeuft nach einem
    // Knotenwechsel aber auf der Werkbank.
    if (Date.now() - letzteTelemetrie >= 10000) {
      letzteTelemetrie = Date.now();
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
      if (ns.getHostname() !== "home") {
        try { ns.scp("data/bn4life.json", "home", ns.getHostname()); } catch { /* egal */ }
      }
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
