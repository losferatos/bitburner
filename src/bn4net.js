/**
 * BitNode 4 - die Netzhaelfte.
 *
 * ARBEITSTEILUNG
 *
 * Dieses Skript fasst NUR Rechner an: rooten, Arbeiter ausbringen, home
 * ausbauen. Es ruehrt die Spielfigur nicht an - kein Verbrechen, keine
 * Arbeit, kein Faktionsbeitritt. Das macht bn4life.js, und zwar als einzige
 * Instanz.
 *
 * Der Grund steht in den Truemmern von BitNode 1: Dort griffen autopilot.js,
 * work.js und buyaugs.js gleichzeitig auf dieselbe Arbeitsseite zu. Eines
 * beendete die Arbeit des anderen, gemeldet wurde trotzdem Erfolg. Wenn genau
 * ein Skript die Figur steuert, kann das nicht passieren.
 *
 * WOZU HACKING HIER UEBERHAUPT NOCH GUT IST
 *
 * Nicht fuers Geld. In BitNode 4 ist ServerMaxMoney 0.1125 und ScriptHackMoney
 * 0.2 - zusammen 2,25 % des Ertrags aus BitNode 1. Verbrechen bringt bei
 * CrimeMoney 0.2 rund das Neunfache. Die Arbeiter laufen trotzdem, weil das
 * Hacking-LEVEL gebraucht wird: fuer Serverzugang, fuer Faktionen wie
 * BitRunners, und am Ende fuer w0r1d_d43m0n - der hier wegen
 * WorldDaemonDifficulty 3 nicht 3000 verlangt, sondern 9000.
 *
 * Erschwerend: HackExpGain ist 0.4. Das Level waechst zweieinhalb Mal
 * langsamer als gewohnt. Umso frueher muss es anfangen.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // Reserve auf home. ACHTUNG, hier lag der erste Fehler dieses BitNode: 12 GB
  // reichen nicht. bn4net.js belegt selbst 19,65 GB (gemessen am 22.08.2026,
  // davon 3 GB fuer hackAnalyze/hackAnalyzeChance/growthAnalyze aus der
  // Aktionsmischung), bn4life.js braucht 22,8 - zusammen 42,45. Auf einem
  // 32-GB-home passen beide NICHT MEHR nebeneinander; das trifft nach einem
  // BitNode-Wechsel zu (Prestige.ts:243-249 setzt home auf 32 GB zurueck),
  // nicht nach einem Augmentierungs-Einbau. Wer dorthin geht, muss die
  // Mischung vorher wieder auf die nachgebauten Formeln umstellen oder
  // bn4net.js aufteilen. Wer nur 12 reserviert, laesst die Arbeiter die
  // restlichen 9 GB fressen, und bn4life.js startet nie. Genau die Falle, die
  // der Skeptiker vorhergesagt hatte: RAM-Aushungern von home durch die
  // eigenen Worker. Bei 20 bleibt auf einem 32-GB-home gar kein Arbeiter -
  // richtig so, denn die Steuerung ist mehr wert als drei Faeden. Sobald home
  // verdoppelt ist, ist wieder Platz.
  // Waechst mit home mit. Eine feste Reserve entwertet jeden Ausbau: Die
  // Arbeiter belegen binnen zehn Sekunden alles Neue, und der naechste
  // Baustein - Contract-Loeser, Autopilot - passt nie hinein. Untergrenze ist
  // bn4life.js selbst (19,85 GB), sonst kann es nach einem Absturz nicht mehr
  // starten.
  let werkbankMerker = null;
  // Zeitpunkt des letzten darkweb.js-Anlaufs (Abschnitt 2b1).
  let nachholMerker = 0;
  // Gedaechtnis ueber Rundengrenzen hinweg. Ein Ziel, das seit zwanzig
  // Minuten anlaeuft, ohne fertig zu werden, ist nur zu erkennen, wenn sich
  // irgendwer merkt, wann es angefangen hat - eine Runde allein sieht immer
  // nur den Augenblick. Genau deshalb konnte the-hub stundenlang 30 % des
  // Netzes binden, ohne dass es irgendwo auffiel.
  const anlaufSeit = new Map();     // Ziel -> Zeitstempel des Anlaufbeginns
  const gesperrtBis = new Map();    // Ziel -> Zeitstempel, ab dem es wieder darf
  // --- Stapelbetrieb (HWGW), Zustand ueber Rundengrenzen hinweg ------------
  // batchStand: Ziel -> { phase, proben[], fraction, stapel, seitLeer }
  //   phase "prep"  vorbereiten: Sicherheit auf das Minimum, Guthaben auf 100 %
  //   phase "batch" Stapel takten
  //   phase "drain" auslaufen lassen, weil die Kette aus der Reihe lief
  // batchKalender: Ziel -> Zeitpunkt der ZULETZT eingeplanten Landung.
  //   Das ist der Kern des ganzen Verfahrens. Er wird nur nach vorn gesetzt,
  //   nie zurueck - deshalb kann ein neuer Stapel einen alten NIE ueberholen,
  //   egal wie sehr das Hacking-Level zwischendurch steigt und die Laufzeiten
  //   verkuerzt. Landezeiten sind absolute Wanduhrzeiten, keine relativen
  //   Fristen; ein kuerzer gewordener Stapel startet einfach spaeter.
  const batchStand = new Map();
  const batchKalender = new Map();
  // GRENZERTRAG von zusaetzlichem Arbeitsspeicher, aus der VORIGEN Runde.
  // Die Serveraufruestung braucht ihn (Abschnitt 1a2), er entsteht aber erst
  // in Abschnitt 2 - eine Runde Verzoegerung ist unschaedlich, weil sich der
  // Wert nur mit Level und Zielauswahl aendert, also langsam.
  //
  // WARUM NICHT MEHR DER MITTELWERT (22.08.2026). Bis hierher stand hier der
  // Durchschnitt der laufenden Geldziele. Zwei Fehler auf einmal:
  //   (1) Seit die drei besten Ziele im Stapelbetrieb laufen, sind sie aus
  //       moneyTargets heraus - der Durchschnitt mittelte nur noch ueber die
  //       verbliebenen, schlechteren. Gemessen am 22.08.2026: 202 $/GB*s
  //       gemeldet, tatsaechlicher Grenzertrag fuer den anstehenden Schritt
  //       (4096 GB) 250 $/GB*s. Kaeufe wurden also 24 % unrentabler
  //       gerechnet, als sie sind.
  //   (2) Ein Durchschnitt ist ohnehin die falsche Groesse. Bezahlt wird der
  //       NAECHSTE Speicher, und der landet nicht beim Durchschnittsziel: Er
  //       geht der Reihe nach dorthin, wo noch Aufnahme frei ist. Und das
  //       haengt an der MENGE - gemessen im selben Zustand 301 $/GB*s fuer
  //       1024 GB, 250 fuer 4096, 154 fuer 16384, 112 fuer 65536. Eine
  //       einzelne Zahl kann das gar nicht abbilden, deshalb steht hier eine
  //       Kurve und eine Funktion, die sie fuer eine Menge auswertet.
  //
  // Zwei Listen, weil die beiden Verfahren zusaetzlichen Speicher voellig
  // verschieden aufnehmen - Begruendung bei grenzErtrag().
  // Leere Listen heissen "noch nichts gerechnet" und lassen keinen Ausbau zu.
  let grenzStapelMerker = [];   // [{eff, frei}] je Stapelziel
  let grenzOffenMerker = [];    // [{eff, frei}] je offenem Ziel, absteigend
  let grenzAnteilMerker = 0;    // F_NETZANTEIL der letzten Runde

  /**
   * Was bringen `gb` zusaetzliche Gigabyte Arbeitsspeicher, in $/GB*s?
   *
   * Die beiden Verfahren nehmen ihn verschieden auf:
   *
   *   STAPELZIELE nehmen einen ANTEIL des Netzes, keinen festen Betrag. Ihre
   *   Aufnahme ist ram(f) * kalenderPlaetze, und f waehlt der Stapelbetrieb
   *   selbst als das kleinste, dessen voller Kalender ramTotal*F_NETZANTEIL
   *   fasst. Waechst das Netz, waechst f mit - jedes Stapelziel schluckt also
   *   F_NETZANTEIL jedes zusaetzlichen Gigabytes, und zwar zur GRENZ-Guete
   *   der naechsten Leitersprosse (nicht zur Durchschnittsguete: die Sprosse
   *   bringt zusaetzliches Geld fuer zusaetzlichen Speicher, das Verhaeltnis
   *   der beiden Zuwaechse ist der Grenzertrag). Erst am oberen Ende der
   *   Leiter ist ein Ziel wirklich gesaettigt; dann steht in "frei" die
   *   restliche Aufnahme statt Infinity.
   *
   *   OFFENE ZIELE haben eine feste Kapazitaet (KAP_ABZUG, siehe kennzahlen).
   *   Was dort noch frei ist, wird der Guete nach aufgefuellt - das beste
   *   Ziel zuerst, genau wie die Zuteilung es tut.
   *
   * Was danach noch uebrig ist, bringt NICHTS. Das ist der Fall, den die
   * alte Zahl nicht kannte und der die Amortisationsrechnung wertlos macht,
   * sobald das Netz die Ziele ueberholt.
   */
  const grenzErtrag = (gb) => {
    if (!(gb > 0)) return 0;
    let ertrag = 0, rest = gb;
    for (const s of grenzStapelMerker) {
      const nimm = Math.min(grenzAnteilMerker * gb, s.frei);
      if (!(nimm > 0)) continue;
      ertrag += nimm * s.eff;
      rest -= nimm;
    }
    for (const o of grenzOffenMerker) {
      if (rest <= 0) break;
      const nimm = Math.min(o.frei, rest);
      if (!(nimm > 0)) continue;
      ertrag += nimm * o.eff;
      rest -= nimm;
    }
    return ertrag / gb;
  };
  // Ungenutzter Speicher der letzten Runde. Die Serveraufruestung braucht ihn
  // als Bremse: Wer Speicher kauft, obwohl der vorhandene brachliegt,
  // verbrennt Geld.
  let ueberschussMerker = 0;
  // ABSOLUT STATT ANTEILIG (23.08.2026). Der Viertelanteil stammt aus der
  // Zeit, in der home 32 GB hatte - acht Gigabyte freizuhalten war da
  // vernuenftig. Bei einem Petabyte sperrt dieselbe Formel 262.144 GB, um
  // Werkzeuge zu schuetzen, die zusammen rund 126 GB brauchen. Gemessen am
  // 23.08. waren das 24,9 Prozent des GESAMTEN Netzes ohne jeden Zweck,
  // waehrend 71,7 Prozent des Speichers ohnehin schon brachlagen.
  //
  // Jetzt wird der tatsaechliche Bedarf gerechnet und verdreifacht. Der
  // Puffer faengt ab, dass ein Werkzeug neu startet, waehrend Arbeiter den
  // Platz schon belegt haben - das ist der Fehler, wegen dem bn4rep.js
  // einmal stundenlang gar nicht lief. Die Untergrenze von 64 GB gilt fuer
  // den Zustand direkt nach einem Knotenwechsel, wenn home wieder bei 32 GB
  // steht und getScriptRam fuer noch nicht kopierte Dateien 0 liefert.
  const reserveHome = () => {
    const homeMax = ns.getServerMaxRam("home");
    const eigenRam = ns.getScriptRam("bn4net.js", "home");
    const passtAufHome = Math.max(0, homeMax - (eigenRam > 0 ? eigenRam : 0));
    let bedarf = 0;
    for (const [datei] of WERKZEUGE) {
      const r = ns.getScriptRam(datei, "home");
      if (r > 0 && r <= passtAufHome) bedarf += r;
    }
    // REIHENFOLGE BEACHTEN. Erst deckeln, dann die Untergrenze - andersherum
    // deckelt das Viertel die Untergrenze weg: bei einem frischen 32-GB-home
    // gab Math.min(8, Math.max(64, ...)) genau 8 GB, also WENIGER als die
    // alte Formel mit ihren 24. Genau dort, wo es am meisten weh tut, weil
    // dann kein Werkzeug mehr Platz zum Neustart findet und der Bot ohne
    // Logzeile stehenbleibt - das Muster des Stillstands vom 20.08.
    // bn4life.js steht NICHT in WERKZEUGE (es laeuft immer auf home und wird
    // von bn4net gestartet, nicht auf die Werkbank verteilt) - es muss hier
    // aber mitgezaehlt werden, sonst schuetzt die Reserve genau die Haelfte
    // der Steuerung nicht.
    const rLife = ns.getScriptRam("bn4life.js", "home");
    if (rLife > 0 && rLife <= passtAufHome) bedarf += rLife;

    // Erst die Untergrenze, dann der Deckel - und die Untergrenze gewinnt.
    // Die vorige Fassung schrieb Math.max(24, Math.min(max/4, Math.max(64,
    // ...))): auf einem frischen 32-GB-home kuerzte das innere Math.min die
    // 64 auf 8 weg, und uebrig blieben 24. Der Kommentar versprach 64.
    //
    // Auf einem kleinen home ist der Viertel-Deckel das falsche Werkzeug:
    // Lieber vier Werkzeuge weniger gleichzeitig als eine Steuerung, die
    // nicht mehr startet. Deshalb gilt der Deckel nur oberhalb der
    // Untergrenze.
    const max = ns.getServerMaxRam("home");

    // DIE RESERVE DARF NICHT GROESSER SEIN ALS DAS, WAS SIE SCHUETZEN SOLL
    // (23.08.2026, im neuen Knoten gemessen).
    //
    // Diese Zeile ist zweimal repariert worden, beide Male nach oben - und
    // beide Male ist der Fall uebersehen worden, in dem die Untergrenze
    // groesser ist als der Platz, der nach bn4net selbst uebrig bleibt.
    // Gemessen 25 Minuten nach dem Eintritt in BitNode 5: home 32 GB,
    // bn4net.js belegt 16,25 davon, frei 15,75 - und die Untergrenze
    // min(64, 32/2) = 16 lag DARUEBER. home hat also null Faeden getragen,
    // waehrend das Guthaben eine halbe Stunde lang auf 1.262 Dollar stand.
    //
    // Zwei Grenzen, beide aus derselben Ueberlegung: Eine Reserve ist nur
    // sinnvoll, wenn ein Werkzeug sie auch benutzen kann.
    //   - `bedarf` zaehlt nur noch Werkzeuge, die auf home ueberhaupt Platz
    //     faenden. Ausserhalb von BitNode 4 kostet jeder Singularity-Aufruf
    //     das Sechzehnfache; bn4life.js misst dort 293,8 GB und bn4rep.js
    //     noch mehr. Fuer die auf einem 32-GB-home Platz freizuhalten, ist
    //     nicht vorsichtig, sondern sinnlos - sie starten dort nie.
    //   - Nichts zu schuetzen heisst nichts zu reservieren, und mehr als die
    //     Haelfte des Verteilbaren nimmt die Reserve nie.
    const eigen = ns.getScriptRam("bn4net.js", "home");
    const verteilbar = Math.max(0, max - (eigen > 0 ? eigen : 0));
    if (bedarf <= 0) return 0;
    const untergrenze = Math.min(64, max / 2);
    const wunsch = Math.max(untergrenze, Math.min(max / 4, bedarf * 3));
    return Math.min(wunsch, bedarf, verteilbar / 2);
  };
  const WORKER = ["worker/weaken.js", "worker/grow.js", "worker/hack.js", "worker/share.js"];

  // Die Werkzeugliste steht hier oben statt unten bei ihrer Verwendung, weil
  // seit dem 22.08.2026 schon die RAM-Verteilung sie braucht: Die Werkbank
  // wird nur noch um den TATSAECHLICHEN Werkzeugbedarf freigehalten, und den
  // kann man erst ausrechnen, wenn man die Liste kennt. Zugleich ist sie der
  // Wiederaufbauplan nach einem Reset (Prestige.ts:73 loescht alle gekauften
  // Rechner) - wer die Werkzeuge von Hand starten muesste, haette nach jedem
  // Einbau einen toten Bot.
  // REIHENFOLGE = DRINGLICHKEIT (23.08.2026). Der Werkzeugstarter geht die
  // Liste der Reihe nach durch und ueberspringt, was gerade nicht in die
  // Werkbank passt. In einem frischen Knoten ist der Platz knapp, und dann
  // entscheidet diese Reihenfolge, was zuerst laeuft.
  //
  // Vorn stehen die beiden, ohne die der Bot nicht aus der Startlage
  // herauskommt: bn4life kauft TOR und die Portprogramme - ohne sie bleibt
  // das Netz bei den sechs Servern ohne Portbedarf stehen. homegrow baut
  // home aus, und erst ein grosses home traegt den Rest. Vertragsloeser,
  // Reputationsarbeit und die Bequemlichkeiten kommen danach.
  const WERKZEUGE = [
    // DER KNOTENSPEZIFISCHE MOTOR (25.08.2026).
    //
    // In BitNode 6 und 7 fuehrt der Weg nicht ueber das Hackniveau, sondern
    // ueber 21 Black Operations. blade.js steht deshalb GANZ oben: Es ist in
    // diesen Knoten nicht ein Werkzeug neben anderen, sondern der Motor, der
    // den Knoten ueberhaupt abschliesst. In anderen Knoten wartet es nur und
    // kostet ausser dem Speicher nichts.
    //
    // bbtrain.js steht bewusst NICHT hier: Es raeumt einmalig das
    // Beitrittstor weg (alle Kampfwerte auf 100) und beendet sich danach -
    // diese Liste wuerde es ewig neu starten.
    ["blade.js", []],
    // bbtrain gehoert HIERHER, nicht danebenn (25.08.2026).
    //
    // Es stand bewusst nicht in dieser Liste: "raeumt einmalig das
    // Beitrittstor weg und beendet sich danach - die Liste wuerde es ewig neu
    // starten." Der erste Satz war falsch. Ein Augmentierungs-Einbau setzt
    // alle Kampfwerte auf 1 zurueck; die Aufgabe faellt also nach JEDEM Reset
    // erneut an. Am 25.08. um 05:50 hat bn4rep sechs Stueck eingebaut, das
    // Training war weg, und niemand hat es wieder angestossen - der Knoten
    // stand. Seitdem wartet bbtrain, statt sich zu beenden, und gehoert damit
    // in die Liste wie jedes andere Werkzeug.
    ["bbtrain.js", []],
    // bn4life kauft TOR und die Portprogramme. Es steht in dieser Liste und
    // nicht in boot.js, weil es voller Singularity ist und ausserhalb von
    // BitNode 4 mehrere hundert GB gross - in ein frisches home mit 32 GB
    // passt es nie. Auf der Werkbank stoert der Preis nicht; Singularity
    // wirkt spielerweit, nicht rechnergebunden.
    ["bn4life.js", []],
    // home-Ausbau, aus demselben Grund ausgelagert (vier Singularity-Aufrufe,
    // 9 GB im Knoten 4 und 144 GB draussen) - siehe Kopf von homegrow.js.
    ["homegrow.js", []],
    ["contracts.js", ["--loop", "300"]],
    // Der Tonanker gehoert dazu, nicht daneben: Ein verborgener Browsertab
    // bekommt statt sechzehn Zeitgebern je Sekunde nur einen je Minute, und
    // ohne ihn laeuft der ganze Bot dreifach langsamer. Er lag bisher auf
    // einem gekauften Rechner - und die verschwinden bei jedem Einbau.
    ["wakelock.js", []],
    // Popup-Waechter. Das Spiel sammelt Dialoge in einer Warteschlange
    // (AlertManager.tsx); wer stundenlang nicht hinsieht, findet dutzende
    // vor und muss jeden einzeln wegklicken. Gehoert aus demselben Grund
    // hierher wie der Tonanker: er soll den Einbau ueberleben.
    ["popups.js", []],
    // bn4rep und bn4door stehen ANS ENDE, seit die Werkbank immer nur EIN
    // Rechner ist (der groesste). In BitNode 5 hat der 128 GB, und bn4door
    // allein belegt 99,85 davon - zusammen mit dem Vertragsloeser war die
    // Werkbank voll, und wakelock.js (34,25 GB) fand keinen Platz mehr.
    //
    // Das ist die falsche Reihenfolge: Der Tonanker schuetzt die
    // Geschwindigkeit des GANZEN Laufs (ein verborgener Browsertab bekommt
    // statt sechzehn Zeitgebern je Sekunde nur einen je Minute), waehrend
    // Backdoors eine Verbilligung der FIRMENreputation sind - ein Posten der
    // Spaetphase, der in den ersten Stunden eines Knotens nichts beitraegt.
    // bn4rep braucht ohnehin 768,3 GB und wartet, bis der Park so weit ist.
    ["bn4rep.js", []],
    ["bn4door.js", []],
  ];
  const BIBLIOTHEKEN = ["lib/hackaugs.js"];

  const knacker = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];

  const scanAll = () => {
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
  };

  // Melden, und zwar nach DRAUSSEN. ns.print landet im Spiel-Log, das von
  // aussen niemand liest - und ein Bot, dessen Zustand man nicht sehen kann,
  // steht irgendwann still, ohne dass es auffaellt. In BitNode 1 ist genau das
  // achtmal passiert: ausgeloest, gemeldet, nie geprueft.
  const LOG_ZEILEN = 200;
  let log = [];
  const sag = (t) => {
    const zeile = new Date().toLocaleTimeString() + "  " + t;
    ns.print(zeile);
    log.push(zeile);
    if (log.length > LOG_ZEILEN) log = log.slice(-LOG_ZEILEN);
    ns.write("data/bn4net-log.txt", log.join("\n") + "\n", "w");
  };
  sag("bn4net gestartet.");

  // Der ganze Rundeninhalt liegt in einem try. Ohne das beendet eine einzige
  // unerwartete Ausnahme - ein Server, der zwischen scan und getServer
  // verschwindet, eine Zahl, die das Spiel nicht mag - die Schleife und damit
  // die Netzhaelfte fuer den Rest des Monats. Ein Bot, der monatelang
  // unbeaufsichtigt laeuft, muss Fehler ueberleben statt an ihnen zu sterben.
  for (let runde = 1; ; runde++) {
   try {
    const hosts = scanAll();


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
        && !ns.isRunning("bn4life.js", "home")) {
      const pid = ns.exec("bn4life.js", "home");
      if (pid) sag("bn4life.js lag still und wurde neu gestartet (pid " + pid + ").");
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
        && (befehl.trim() === "SELBST" || befehl.includes("bn4net.js"))) {
      ns.write("data/reload.txt", "", "w");
      sag("Neuladen angefordert - beende mich, die Wache holt mich zurueck.");
      ns.exit();
    }
    // --- 0b2. Auftragslaeufer, ersatzweise ------------------------------------
    // data/task.txt ist der einzige Weg, von aussen ein Skript im Spiel zu
    // starten - die Bruecke kann Dateien schieben, aber nichts ausfuehren.
    // Gelesen hat ihn bisher nur bn4life.js. Das faellt genau dann aus, wenn
    // man ihn am dringendsten braucht: bn4life ist ausserhalb von BitNode 4
    // 293,8 GB gross und laeuft nach einem Knotenwechsel stundenlang nicht.
    // Am 23.08. um 17:30 stand der Bot in BitNode 5 fest, und es gab keinen
    // Weg mehr, ihm etwas zu sagen - ausser einem Menschen an der Tastatur.
    //
    // bn4net.js ist die Haelfte, die IMMER laeuft (16,25 GB, singularityfrei).
    // Deshalb liest es den Auftrag ersatzweise mit - aber nur, wenn bn4life
    // nirgends laeuft. Damit gibt es nie zwei Leser und nie ein Wettrennen um
    // dieselbe Zeile.
    // EIN LEBENDER LESER, KEIN VORHANDENER (25.08.2026).
    //
    // Hier stand nur "laeuft bn4life irgendwo?". Der Gedanke war richtig - es
    // soll nie zwei Leser derselben Zeile geben. Die Pruefung war es nicht:
    // Sie fragt nach der EXISTENZ eines Prozesses, nicht nach seiner Arbeit.
    //
    // Am 25.08. um 05:25 stand bn4life seit 484 Minuten (letzte Telemetrie
    // vom Vortag um 21:21), lief aber noch als Prozess. Damit trat der
    // Auftragslaeufer zurueck, bn4life selbst las nichts mehr - und der
    // einzige Fernkanal ins Spiel war zu. Ein Auftrag lag minutenlang
    // unangetastet in data/task.txt. Ausgerechnet die Schutzbedingung gegen
    // zwei Leser hat dafuer gesorgt, dass es KEINEN gab.
    //
    // Massgeblich ist deshalb das Lebenszeichen, nicht der Prozess.
    const lifeZeit = (() => {
      try { return JSON.parse(ns.read("data/bn4life.json")).zeit || 0; }
      catch { return 0; }
    })();
    const lifeFrisch = lifeZeit > 0 && Date.now() - lifeZeit < 300000;
    const lifeLaeuft = lifeFrisch && hosts.some((h) => {
      try { return ns.ps(h).some((pr) => pr.filename === "bn4life.js"); }
      catch { return false; }
    });
    if (!lifeLaeuft && ns.fileExists("data/task.txt", "home")) {
      const roh = ns.read("data/task.txt").trim();
      ns.write("data/task.txt", "", "w");     // sofort leeren, sonst Endlosstart
      if (roh) {
        try {
          const teile = JSON.parse(roh);
          const braucht = ns.getScriptRam(teile[0], "home");
          // Wirt mit dem meisten freien Speicher. Auf home bleibt ein Sockel
          // stehen, damit ein Auftrag nicht die Steuerung selbst verdraengt.
          let wirt = "home", meistFrei = -1;
          for (const host of hosts) {
            if (!ns.hasRootAccess(host)) continue;
            const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
              - (host === "home" ? 2 : 0);
            if (frei > meistFrei) { meistFrei = frei; wirt = host; }
          }
          // PLATZ SCHAFFEN, STATT ZU SCHEITERN (23.08.2026).
          //
          // Im frischen Knoten ist jedes Byte mit Arbeitern belegt: gemessen
          // 11 GB frei im ganzen Netz, verteilt auf acht Rechner mit je 1,6 -
          // ein Auftrag von 12 GB passt nirgends, obwohl das Netz 132 GB hat.
          // Ohne diesen Block waere der Fernkanal genau dann tot, wenn man ihn
          // braucht.
          //
          // Arbeiter sind der richtige Posten zum Raeumen: sie sind
          // Einwegskripte, bn4net legt sie in der naechsten Runde von selbst
          // wieder nach, und der Verlust ist die angefangene Aktion - Sekunden.
          // Ein Werkzeug dagegen verliert beim Abbruch seinen Arbeitsstand.
          // Geraeumt wird nur auf dem gewaehlten Wirt und nur so viel, wie der
          // Auftrag braucht.
          if (braucht > 0 && meistFrei < braucht) {
            const vorher = meistFrei;
            for (const w of WORKER) {
              if (!ns.ps(wirt).some((pr) => pr.filename === w)) continue;
              ns.scriptKill(w, wirt);
              const frei = ns.getServerMaxRam(wirt) - ns.getServerUsedRam(wirt)
                - (wirt === "home" ? 2 : 0);
              if (frei >= braucht) break;
            }
            const nachher = ns.getServerMaxRam(wirt) - ns.getServerUsedRam(wirt);
            sag("Fuer den Auftrag Arbeiter auf " + wirt + " geraeumt: "
              + vorher.toFixed(1) + " -> " + nachher.toFixed(1) + " GB frei.");
            meistFrei = nachher;
          }
          if (wirt !== "home") ns.scp([teile[0], ...BIBLIOTHEKEN], wirt, "home");
          const pid = ns.exec(teile[0], wirt, 1, ...teile.slice(1));
          // ns.exec gibt bei Speichermangel still 0 zurueck - der Rueckgabewert
          // gehoert ins Log, sonst verschwindet der Auftrag spurlos.
          sag(pid ? "Auftrag gestartet: " + teile.join(" ") + " auf " + wirt
              + " (pid " + pid + ")."
            : "Auftrag FEHLGESCHLAGEN: " + teile[0] + " braucht "
              + braucht.toFixed(2) + " GB, bester Wirt " + wirt + " hat "
              + meistFrei.toFixed(2) + " GB frei.");
        } catch (e) {
          sag("Auftrag unlesbar: " + String(e));
        }
      }
    }

    // --- 1. Aufschliessen -----------------------------------------------------
    const offen = knacker.filter(([datei]) => ns.fileExists(datei, "home"));
    let neu = 0;
    for (const host of hosts) {
      if (host === "home" || ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (s.numOpenPortsRequired > offen.length) continue;
      // Kein Level-Filter. nuke prueft ausschliesslich die Ports und den
      // Besitz von NUKE.exe (NetscriptFunctions.ts:504-521) - das Hacking-
      // Level interessiert es nicht. Wer hier filtert, laesst fremden
      // Arbeitsspeicher brachliegen, und bei HackExpGain 0.4 dauert es sehr
      // lange, bis der Filter von selbst faellt.
      for (const [, fn] of offen) { try { fn(host); } catch { /* schon offen */ } }
      try { ns.nuke(host); neu++; } catch { /* Ports fehlen doch */ }
    }
    if (neu) sag(neu + " Rechner gerootet.");

    // Gerooteter Netzspeicher. Steht hier oben, weil ihn schon die
    // Serveraufruestung (1a2) und spaeter das Erfahrungsbudget brauchen -
    // und weil er erst NACH dem Rooten stimmt.
    const ramTotal = hosts.reduce((a, h) => a + (ns.hasRootAccess(h) ? ns.getServerMaxRam(h) : 0), 0);

    // --- 0c. Werkzeug auf der Werkbank neu laden -------------------------------
    // Die Werkzeuge (Vertragsloeser, Reputationssteuerung, Backdoors) laufen
    // auf einem gekauften Rechner und koennen sich nicht selbst beenden - sie
    // lesen data/ auf ihrem Wirt, nicht auf home. bn4net.js sitzt auf home,
    // sieht den Befehl und beendet sie stellvertretend; die Werkzeugliste
    // weiter unten startet sie in derselben Runde mit neuem Code wieder.
    {
      const b = ns.fileExists("data/reload.txt", "home") ? ns.read("data/reload.txt") : "";
      if (b.startsWith("WERKZEUG ")) {
        const name = b.slice(9).trim();
        // NICHT UEBER DIESEN KANAL SELBSTMORD (25.08.2026).
        //
        // "WERKZEUG bn4net.js" laesst diese Schleife sich selbst beenden - und
        // dann haengt es an der Wache in popups.js, ob jemand zurueckkommt.
        // Steht die auch nicht (etwa direkt nach einem Einbau, wo ALLE
        // Skripte tot sind und boot.js gerade erst bn4net gestartet hat), ist
        // der Bot weg. Genau so ist am 25.08. um 05:59 der Wiederanlauf
        // gescheitert - das Protokoll meldete "gestartet" und "laeuft".
        //
        // Fuer den eigenen Neustart gibt es den SELBST-Kanal eine Ebene
        // hoeher; der beendet sich an definierter Stelle, statt auf eine
        // Wache zu hoffen.
        if (name === "bn4net.js") {
          ns.write("data/reload.txt", "", "w");
          sag("WERKZEUG bn4net.js abgelehnt - fuer den Selbstneustart"
            + " 'SELBST bn4net.js' benutzen.");
        } else {
        ns.write("data/reload.txt", "", "w");
        // Ueberall killen, nicht nur auf der aktuellen Werkbank. Die Werkbank
        // ist der GROESSTE Rechner und wechselt, sobald ein groesserer gekauft
        // wird - ein Werkzeug laeuft dann noch auf dem alten, waehrend hier
        // schon der neue gemeint ist. Genau daran sind drei Neustarts
        // wirkungslos verpufft: Der Befehl kam an, traf aber ins Leere.
        let getroffen = 0;
        for (const host of scanAll()) {
          if (!ns.hasRootAccess(host)) continue;
          if (!ns.ps(host).some((pr) => pr.filename === name)) continue;
          ns.scriptKill(name, host);
          getroffen++;
        }
        sag(name + ": " + getroffen + " Instanz(en) beendet, startet gleich neu.");
        }
      }
    }

    // --- 1a. Rechenzeit kaufen -----------------------------------------------
    // Der Bot hat ein Geldproblem nicht mehr, sondern ein Platzproblem: home
    // fasst 64 GB, davon gehen zwei Steuerhaelften ab, und die Werkzeuge
    // (Vertragsloeser 17,65 GB, Reputationssteuerung 28,4 GB) passen nirgends
    // hin. Ein gekaufter Rechner loest das fuer wenige Millionen - Geld, das
    // ein einziger Coding Contract in einer Sekunde einbringt.
    //
    // Der Faktor 4 auf den Preis ist Absicht: Wer sein Guthaben leerkauft,
    // kann danach keine Augmentierung mehr bezahlen, und die sind der
    // eigentliche Fortschritt.
    // Was bn4rep.js fuer verdiente Augmentierungen braucht, ist tabu.
    const reserviert = ns.fileExists("data/geldbedarf.txt", "home")
      ? Number(ns.read("data/geldbedarf.txt")) || 0 : 0;
    const eigene = ns.cloud.getServerNames();
    if (eigene.length < ns.cloud.getServerLimit()) {
      // Groesste bezahlbare Stufe. In BitNode 4 verteuert CloudServerSoftcap
      // 1.2 die grossen Rechner ueberproportional, deshalb wird gefragt statt
      // gerechnet.
      // DER KALTSTART BRAUCHT ANDERE REGELN (24.08.2026).
      //
      // Die Leiter begann bei 64 GB und verlangte das VIERFACHE des Preises.
      // Fuer einen eingespielten Bot ist beides richtig; nach einem
      // Knotenwechsel ist es eine Sackgasse. Gemessen in BitNode 6 um 21:40:
      // home faellt auf 32 GB zurueck, bn4net belegt davon 16,25, es bleiben
      // 3,4 GB. Der groesste sonstige Rechner im Netz hat 16 GB. Damit passt
      // KEIN einziges Werkzeug mehr irgendwohin - nicht contracts.js (17,65),
      // nicht darkweb.js (27,65), erst recht nicht der Rest. Ohne darkweb
      // keine Portknacker, ohne Portknacker bleibt es bei 8 von 70 Rechnern,
      // und die naechsten Ziele brauchen genau den einen Port.
      //
      // Der einzige Ausweg ist ein gekaufter Rechner. 64 GB kosten dort
      // 3,52m, mal vier also 14,1m Guthaben - bei gemessenen 260 $/s sind das
      // fuenfzehn Stunden Leerlauf.
      //
      // Deshalb: Solange KEIN eigener Rechner existiert, geht die Leiter bis
      // 32 GB hinunter (das genuegt fuer darkweb.js oder contracts.js) und der
      // Sicherheitsfaktor faellt auf 1,25. Der Faktor soll Geld fuer
      // Augmentierungen schonen - bei Hacking-Level 11 gibt es keine zu
      // kaufen. Sobald der erste Rechner steht, gelten wieder die alten Werte.
      const kaltstart = eigene.length === 0;
      const leiter = kaltstart ? [1024, 512, 256, 128, 64, 32] : [1024, 512, 256, 128, 64];
      const faktor = kaltstart ? 1.25 : 4;
      for (const gb of leiter) {
        const preis = ns.cloud.getServerCost(gb);
        if (!(preis > 0)) continue;
        if (ns.getServerMoneyAvailable("home") - reserviert < preis * faktor) continue;
        const name = ns.cloud.purchaseServer("werk-" + eigene.length, gb);
        if (name) sag("Rechner gekauft: " + name + " mit " + gb + " GB fuer "
          + (preis / 1e6).toFixed(2) + "m.");
        break;
      }
    } else {
      // --- 1a2. Serveraufruestung (HEBEL 2, 22.08.2026) ---------------------
      // ns.cloud.upgradeServer wurde von dieser Kette NIE aufgerufen. Alle 25
      // Plaetze sind seit langem belegt, gekauft wurde hoechstens bis 1024 GB
      // und aufgeruestet gar nicht - der Park stand bei 2x128 und 23x64 GB,
      // zusammen 1728 GB, waehrend das Guthaben ein Vielfaches hergab.
      //
      // WELCHER RECHNER. getCloudServerCost (Server/ServerPurchases.ts:22-40):
      //   preis(r) = r * 55000 * CloudServerCost * CloudServerSoftcap^max(0, log2(r)-6)
      // CloudServerCost ist in BitNode 4 nicht gesetzt und damit 1, der
      // Softcap ist 1.2 (BitNode.tsx:632). Eine Verdopplung von r auf 2r
      // kostet damit preis(r) * 1.4 und bringt r zusaetzliche GB; der Preis
      // JE GB ist 1.4 * 55000 * 1.2^(log2 r - 6) und waechst mit der Groesse
      // des Rechners. Der KLEINSTE Rechner liefert deshalb immer das
      // billigste GB - darum wird der verdoppelt und nicht der groesste.
      // Konkret: 64 -> 128 GB kostet 4.93 Mio fuer 64 GB, also 77 k$ je GB;
      // 512 -> 1024 GB kostet 68.1 Mio fuer 512 GB, also 133 k$ je GB.
      //
      // WIEVIEL DARF DAS KOSTEN. Die Vermutung war, ein Rechnerpark kurz vor
      // einem Augmentierungs-Einbau sei verbranntes Geld, weil der Einbau
      // alle gekauften Rechner loescht (Prestige.ts:73). Das stimmt fuer die
      // Rechner - aber das GUTHABEN faellt beim selben Einbau ebenfalls auf
      // 1000 Dollar (PlayerObjectGeneralMethods.ts:102,
      // this.money = 1000 + CONSTANTS.Donations, gerufen aus
      // Prestige.ts:69). Nicht ausgegebenes Geld ist also genauso verloren
      // wie ein aufgeruesteter Rechner. Fuer die Zeit nach dem Einbau laesst
      // sich gar nicht sparen; das Einzige, was hinueberkommt, sind
      // Augmentierungen. Daraus folgen genau zwei Grenzen:
      //
      //  (1) Was bn4rep.js fuer bereits verdiente Augmentierungen braucht,
      //      ist tabu (reserviert, aus data/geldbedarf.txt). Augmentierungen
      //      sind dauerhafter Fortschritt, Rechenzeit ist es nicht. Zusaetz-
      //      lich wird nie mehr als die Haelfte des freien Guthabens auf
      //      einmal ausgegeben, damit ein Preissprung nicht ins Leere faellt.
      //  (2) Der Ausbau muss sich VOR dem naechsten Einbau bezahlt machen,
      //      sonst waere das Geld in der naechsten Augmentierung besser
      //      aufgehoben. Wie nah der Einbau ist, weiss bn4rep.js: Es baut ab
      //      drei gekauften, noch nicht eingebauten Augmentierungen ein
      //      (MINDEST_WARTESCHLANGE, bn4rep.js) und meldet diese Zahl als
      //      "wartend" in data/bn4rep.json.
      // Mehrere Schritte je Runde, nicht einer. Ein Schritt kostete anfangs
      // 4.9 Millionen, waehrend in denselben zehn Sekunden 18 Millionen
      // hereinkamen - bei einem Schritt je Runde waere das Guthaben schneller
      // gewachsen als der Park, und der Ausbau haette Stunden gebraucht, fuer
      // die es keinen Grund gibt. Die Schleife bricht von selbst ab, sobald
      // eines der Kriterien nicht mehr traegt; die Obergrenze von 25 ist nur
      // die Notbremse, damit eine Runde nicht beliebig lange laeuft.
      const maxGb = ns.cloud.getRamLimit();
      for (let schritt = 0; schritt < 25; schritt++) {
        const smallest = eigene
          .map((h) => ({ host: h, gb: ns.getServerMaxRam(h) }))
          .sort((a, b) => a.gb - b.gb)[0];
        // Nichts mehr aufzuruesten: kein gekaufter Rechner da, oder der
        // kleinste ist schon am Maximum von 2^20 GB.
        if (!smallest || !(smallest.gb > 0) || smallest.gb >= maxGb) break;
        const zielGb = smallest.gb * 2;
        const zusatzGb = zielGb - smallest.gb;
        let kosten = 0;
        try { kosten = ns.cloud.getServerUpgradeCost(smallest.host, zielGb); }
        catch { kosten = 0; }   // wirft, wenn der Rechner kein gekaufter ist

        // Ertrag je GB und Sekunde aus der letzten Runde. Massgeblich ist der
        // GRENZERTRAG genau dieses Schrittes: was die zusatzGb bringen, die
        // hier bezahlt werden - nicht, was der bereits laufende Speicher
        // bringt. Herleitung und Messung stehen bei grenzErtrag() oben.
        // Das Modell dahinter ist gegen die Telemetrie geprueft und stimmt
        // auf 2 % (stapelGb/kalenderPlaetze/erwartetProS, 22.08.2026); es
        // waechst und faellt automatisch mit Level, Zielen und BitNode,
        // anders als eine eingetragene Zahl.
        //
        // ABER: Der Ertrag gilt nur fuer Speicher, den die Geldziele auch
        // AUFNEHMEN. Seit der Kapazitaetsgrenze (siehe kennzahlen) ist das
        // nicht mehr selbstverstaendlich - nach dem Ausbau auf 63.612 GB
        // blieben in einer Runde 39.030 GB uebrig, weil die Summe der
        // Kapazitaeten aller erreichbaren Ziele endlich ist. Weiteren
        // Speicher zu kaufen, waehrend der vorhandene brachliegt, ist
        // verbranntes Geld: Der Grenzertrag ist dort null, nicht effFlotte.
        //
        // Der Ueberschuss geht zwar an die Erfahrung und liegt damit nicht
        // buchstaeblich brach - aber Erfahrung ist keine Rechtfertigung fuer
        // eine Ausgabe, die sich in Dollar amortisieren soll. Deshalb: Sobald
        // die Geldziele mehr als ein Zwanzigstel des Netzes nicht abnehmen,
        // wird nicht mehr gekauft. grenzErtrag() faengt denselben Fall
        // inzwischen selbst ab (kein Abnehmer - kein Ertrag); die Bremse
        // bleibt trotzdem stehen, weil sie einen zweiten Fall deckt: eine
        // Zuteilung, die die vorhandene Aufnahme nicht FINDET. Das ist kein
        // Modellfall, das ist ein Fehler - und dann ist neuer Speicher erst
        // recht keine Loesung.
        const ertrag = ueberschussMerker > ramTotal * 0.05 ? 0 : grenzErtrag(zusatzGb);
        const amortSek = (ertrag > 0 && zusatzGb > 0)
          ? kosten / (zusatzGb * ertrag) : Infinity;

        // wartend aus bn4rep.js. Fehlt die Meldung oder ist sie alt, wird der
        // Einbau als NAH angenommen - vorsichtig, nicht grosszuegig. Ein
        // abgestuerztes bn4rep.js darf nicht dazu fuehren, dass eine veraltete
        // Null teure Ausbauten freigibt, waehrend laengst drei Augmentierungen
        // auf den Einbau warten.
        let wartend = 99;
        try {
          if (ns.fileExists("data/bn4rep.json", "home")) {
            const r = JSON.parse(ns.read("data/bn4rep.json"));
            if (Number.isFinite(r.zeit) && Date.now() - r.zeit < 300000) {
              wartend = r.wartend || 0;
            }
          }
        } catch { /* kaputtes JSON - dann bleibt es bei "nah" */ }
        // Zwei Stufen genuegen. Zehn Minuten sind auch dann noch reichlich:
        // Die billigen Stufen amortisieren sich in drei bis fuenf Minuten,
        // erst weit oben auf der Kostenkurve wird es eng - und genau dort
        // soll die Bremse ja greifen.
        const amortDeckel = wartend >= 2 ? 600 : 1800;
        const geldFrei = ns.getServerMoneyAvailable("home") - reserviert;

        if (kosten > 0 && amortSek <= amortDeckel && kosten * 2 <= geldFrei) {
          if (!ns.cloud.upgradeServer(smallest.host, zielGb)) break;
          sag(smallest.host + ": " + smallest.gb + " -> " + zielGb + " GB fuer "
            + (kosten / 1e6).toFixed(1) + "m, amortisiert in "
            + Math.round(amortSek) + " s.");
          continue;
        }
        // Nicht stillschweigend nichts tun. Ein Ausbau, der seit einer Stunde
        // nicht stattfindet, muss von aussen erklaerbar sein. Nur beim ersten
        // Schritt melden - die spaeteren brechen normal ab, das ist kein
        // Zustand, ueber den berichtet werden muesste.
        if (schritt === 0 && runde % 60 === 0 && kosten > 0) {
          sag("Ausbau wartet: " + smallest.host + " -> " + zielGb + " GB kostet "
            + (kosten / 1e6).toFixed(1) + "m, amortisiert in "
            + (Number.isFinite(amortSek) ? Math.round(amortSek) : "?") + " s (Deckel "
            + amortDeckel + "), frei " + (geldFrei / 1e6).toFixed(0) + "m.");
        }
        break;
      }
    }

    // --- 1b. Werkbank waehlen -------------------------------------------------
    // Ein gerooteter Rechner, der NICHT mit Arbeitern vollgestopft wird,
    // sondern Platz fuer Werkzeuge laesst. contracts.js braucht 17,65 GB und
    // passt damit nirgends hin, solange jeder freie Block sofort mit
    // hack-Faeden belegt wird.
    //
    // Warum das den home-Ausbau schlaegt: Coding Contracts sind in BitNode 4
    // NICHT gedaempft. Weder CodingContractMoney noch die Reputationsprämie
    // stehen in den Multiplikatoren dieses Knotens (BitNode.tsx:627-655), also
    // gelten beide mit 1.0 - waehrend Verbrechen bei 0.2 und Hacking bei
    // 0.0225 liegen. Ein einziger Geld-Vertrag bringt bis zu 75 Millionen,
    // mehr als eine Stunde Homicide. Und die Reputation wird direkt auf das
    // Faktionskonto gebucht, am 0,75-Daempfer der Faktionsarbeit vorbei.
    const WERKBANK_GB = 20;
    let werkbank = null, werkbankGb = 0;
    for (const host of hosts) {
      if (host === "home" || !ns.hasRootAccess(host)) continue;
      const gb = ns.getServerMaxRam(host);
      if (gb >= WERKBANK_GB && gb > werkbankGb) { werkbank = host; werkbankGb = gb; }
    }
    // Notfalls home. Nach einem Augmentierungs-Einbau sind alle gekauften
    // Rechner weg, TOR und die Portprogramme ebenfalls - es dauert eine
    // Stunde Shoplift, bis wieder ein 20-GB-Rechner offensteht. Solange liegt
    // der Vertragsloeser brach, obwohl er auf home passt: 64 GB bleiben beim
    // Einbau erhalten (nur der BitNode-Wechsel setzt sie zurueck). Das ist der
    // Unterschied zwischen einer Stunde Anlauf und fuenf Minuten.
    // Die Schwelle 18 war auf contracts.js gemuenzt (17,65 GB) und hat
    // deshalb im frischen Knoten alles blockiert: home hatte 15,75 GB frei,
    // also fiel die Werkbank ganz aus - und mit ihr der Werkzeugstarter, der
    // nur innerhalb von `if (werkbank)` laeuft. popups.js braucht 1,6 GB und
    // haette dort muehelos Platz gefunden; stattdessen sammelten sich die
    // Dialoge im Spiel, weil eine Schwelle fuer ein ganz anderes Werkzeug im
    // Weg stand. Jetzt entscheidet das KLEINSTE noch nicht laufende Werkzeug:
    // passt eines, ist home Werkbank; passt keines, aendert die Werkbank
    // ohnehin nichts.
    if (!werkbank) {
      const freiHome = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      let kleinstes = Infinity;
      for (const [datei] of WERKZEUGE) {
        const r = ns.getScriptRam(datei, "home");
        if (r > 0 && r < kleinstes) kleinstes = r;
      }
      if (Number.isFinite(kleinstes) && freiHome >= kleinstes) werkbank = "home";
    }
    werkbankMerker = werkbank;

    // --- 1c. Wieviel die Werkbank wirklich freihalten muss ---------------------
    // HEBEL 1 (22.08.2026). Bis hierher war die Werkbank PAUSCHAL von der
    // Arbeiterverteilung ausgenommen ("if (host === werkbank) continue"). Das
    // war gedacht fuer einen gekauften 20-GB-Rechner, auf dem gerade
    // contracts.js Platz finden sollte. Inzwischen ist die Werkbank
    // fulcrumtech mit 2048 GB - rund 28 % des gesamten Netzspeichers - und die
    // Werkzeuge laufen alle auf home, weil sie dort schon liefen, als das Netz
    // noch klein war. Die netzweite Laufpruefung weiter unten startet sie
    // deshalb nie neu, und die Werkbank stand mit NULL Prozessen da: 2048 GB
    // vollstaendig ungenutzt. Gemessen am 22.08.2026 im Spielstand.
    //
    // Jetzt wird nur noch der tatsaechliche Bedarf freigehalten:
    //   - Werkzeuge, die HIER laufen (ihr Platz darf nicht wegverteilt werden;
    //     genau genommen belegen sie ihn schon, aber getServerUsedRam zaehlt
    //     sie mit - der Posten steht hier trotzdem, weil ein Werkzeug zwischen
    //     zwei Runden abstuerzen kann und der Platz dann sofort wieder da sein
    //     muss, statt erst von einer Raeumung zurueckgeholt zu werden).
    //   - Werkzeuge, die NIRGENDS laufen und also hier gestartet werden.
    //   - Ein Werkzeug, das auf einem ANDEREN Rechner laeuft, braucht hier
    //     nichts. Genau das ist der Unterschied zu vorher.
    // Dazu ein Puffer in Groesse des groessten Werkzeugs, damit ein Absturz
    // sofort aufgefangen wird, ohne dass fliegende Arbeit weggeworfen werden
    // muss.
    //
    // ACHTUNG, das darf NICHT dazu fuehren, dass ein Werkzeug doppelt laeuft:
    // die Entscheidung, ob gestartet wird, faellt weiterhin allein in 2c ueber
    // die netzweite Prozessliste. Hier wird nur Platz reserviert, nie gestartet.
    // toolHosts und die Liste in 2c stammen aus demselben Rundenzustand -
    // zwischen beiden Stellen wird kein Werkzeug gestartet oder beendet.
    const toolHosts = new Map();
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      for (const pr of ns.ps(host)) {
        if (WORKER.includes(pr.filename)) continue;
        if (!toolHosts.has(pr.filename)) toolHosts.set(pr.filename, []);
        toolHosts.get(pr.filename).push(host);
      }
    }
    let werkbankReserve = 0;
    // Auf home greift schon reserveHome(); zwei Reserven uebereinander wuerden
    // dem Netz denselben Platz zweimal abziehen.
    if (werkbank && werkbank !== "home") {
      let groesstes = 0;
      for (const [datei] of WERKZEUGE) {
        // getScriptRam gibt bei fehlender Datei still 0 zurueck. Ein solches
        // Werkzeug bekommt keine Reserve - es liesse sich ohnehin nicht
        // starten, und 2c meldet den Fall.
        const braucht = ns.getScriptRam(datei, "home");
        if (!(braucht > 0)) continue;
        if (braucht > groesstes) groesstes = braucht;
        const wo = toolHosts.get(datei);
        if (wo && wo.length && !wo.includes(werkbank)) continue;
        werkbankReserve += braucht;
      }
      werkbankReserve += groesstes;
    }

    // --- 2. Ziele waehlen (Erfahrung und mehrere Geldziele) --------------------
    // STUFE 2 (22.08.2026): frueher genau EIN Geldziel fuer das ganze Netz -
    // jeder Faden, der nicht auf ihm oder dem Erfahrungsziel landete, blieb
    // liegen, obwohl das Netz laengst mehr als ein Ziel gleichzeitig bedienen
    // kann. autopilot.js macht das seit jeher so (MAX_TARGETS/maxTargets,
    // autopilot.js:103 und :1173) und skaliert die Zielzahl am Netzspeicher
    // statt an einer festen Zahl - aus demselben Grund wie dort: eine feste
    // Zahl passt nur zu einer einzigen Ausbaustufe.
    // HEBEL 3 (22.08.2026), zweite Fassung. Erste Fassung war eine feste,
    // logarithmisch am Netzspeicher haengende Zahl (vier Ziele bei 7276 GB)
    // und hat gemessen +41 % gebracht. Sie ist trotzdem falsch, und der
    // Serverausbau hat es sofort gezeigt: Bei 63.612 GB waren daraus sechs
    // Ziele, jedes mit rund 7000 GB - das Fuenffache dessen, was ein Ziel
    // aufnehmen kann. Die Server standen leergehackt bei 0 bis 11 % Guthaben
    // und der Ertrag FIEL.
    //
    // Eine Zielanzahl ist die falsche Stellschraube. Richtig ist die
    // KAPAZITAET je Ziel (siehe kennzahlen oben) und eine Zuteilung, die der
    // Reihe nach auffuellt statt gleich zu verteilen. Die Zielanzahl ist
    // damit nur noch eine Obergrenze gegen zu viele exec-Aufrufe und
    // ns-Abfragen je Runde: Jedes zusaetzliche Ziel kostet drei Abfragen in
    // planMix und bis zu drei Wuensche im Verteiler.
    //
    // 25 als Deckel, sonst alle Kandidaten. Ein schwaches Ziel schadet
    // nicht mehr: Der Wasserfall gibt ihm nur, was die besseren nicht
    // aufnehmen konnten - und dieser Speicher laege sonst brach.
    const MONEY_TARGET_COUNT = 25;

    // War bisher EIN Ziel nach Erfahrung je Sekunde fuer ALLE Arbeiter - das
    // liess das Geldeinkommen um Faktor 70 einbrechen (545.000 auf 8.000 je
    // Minute), weil joesguns zwar der beste Erfahrungsserver ist, aber wenig
    // Geld haelt. Gemessen: Erfahrung und Geld skalieren beide linear mit der
    // Fadenzahl (keine Saettigung unter ~1300 Faeden je Ziel), aber schon
    // ~180 Faeden auf dem Erfahrungsziel holen die volle Erfahrungsrate -
    // joesguns liefert 0,262 Erfahrung je Faden und Sekunde (Bestwert im
    // Netz), silver-helix nur 0,062, dafuer deutlich mehr Geld. Jeder Faden
    // ueber 180 ist im Geld besser angelegt. Deshalb zwei Ziele mit festem
    // Erfahrungsbudget, der Rest netzweit ans Geldziel.
    //
    // Ohne den beruehmten Halbierungsfilter. "Nur Ziele bis zum halben Level"
    // ist eine Spaetspielregel; beim Neustart mit Hacking 1 ergibt sie die
    // Schwelle 0,5, an der selbst n00dles scheitert. Dann gibt es kein Ziel,
    // keinen Arbeiter, keine Erfahrung - und weil das Level nicht steigt, wird
    // die Schranke nie milder. Genau daran stand der Bot heute zwanzig Minuten.
    //
    //   expGain   = 3 + 0.3 * baseDifficulty          (Hacking.ts:30-38)
    //   hackTime  ~ (2.5 * requiredHackingSkill * minDifficulty + 500)
    //               / (hackingLevel + 50)
    //   expValue  = expGain / hackTime
    //   moneyValue = moneyMax / hackTime
    //
    // minDifficulty statt hackDifficulty in der Dauer: Die Arbeiter schwaechen
    // jeden Server ohnehin auf sein Minimum herunter (weiter unten waehlt der
    // Skriptwaehler weaken.js, solange hackDifficulty > minDifficulty + 5) -
    // im Dauerbetrieb naehert sich die tatsaechliche Dauer also minDifficulty
    // an, nicht dem Startwert. baseDifficulty dagegen bleibt fuer die
    // Erfahrung massgeblich: Es wird bei der Servererzeugung einmalig gesetzt
    // und aendert sich durch weaken NICHT (Server.ts:82 this.baseDifficulty =
    // this.hackDifficulty, danach ruehrt nur noch capDifficulty an
    // hackDifficulty) - waehrend hackDifficulty sinkt und mit ihm die Dauer.
    //
    // Geldziel bewusst NICHT nach moneyMax/minDifficulty: Ein hoeheres
    // moneyMax bedeutet NICHT automatisch mehr Geld je Sekunde, weil die
    // Zykluszeit mitwaechst. Gemessen: omega-net haelt mehr Maximalgeld als
    // silver-helix, liefert aber weniger, weil seine Zykluszeit schneller
    // waechst als seine Beute - moneyMax/minDifficulty wuerde omega-net
    // trotzdem bevorzugen, moneyMax/hackTime nicht.
    // getScriptRam gibt bei fehlender Datei still 0 zurueck
    // (NetscriptFunctions.ts:1179-1191). Ungeprueft ergaebe das
    // Math.floor(frei/0) = Infinity, und das Spiel wirft daraufhin eine
    // Ausnahme. Die Pruefung steht weiter unten bei den Arbeitern; hier oben
    // werden die Werte gebraucht, weil die Kennzahlen je Ziel sie brauchen.
    const ramHack = ns.getScriptRam("worker/hack.js", "home");
    const ramGrow = ns.getScriptRam("worker/grow.js", "home");
    const ramWeaken = ns.getScriptRam("worker/weaken.js", "home");

    // --- Kennzahlen je Ziel ---------------------------------------------------
    // Zwei Zahlen je Server, beide fuer den SAUBEREN Dauerbetrieb gerechnet
    // (Sicherheit am Minimum), beide aus dem Spiel selbst statt aus
    // nachgebauten Formeln:
    //
    //   steadyEff   Ertrag in Dollar je GB und Sekunde. Sagt, WIE GUT das Ziel
    //               ist - danach wird sortiert und danach entscheidet das
    //               Nutzen-Gate der Anlaufphase.
    //   kapazitaet  Wieviel Arbeitsspeicher das Ziel ueberhaupt aufnehmen
    //               kann, in GB. Sagt, WIEVIEL davon man haben kann.
    //
    // Die Kapazitaet ist der Befund vom 22.08.2026, der die Serveraufruestung
    // zunaechst zu einem Rueckschritt gemacht hat. Der Gleichgewichtsertrag
    // ist zwar skalenfrei - die Mischung aus hack, grow und weaken haelt jedes
    // Verhaeltnis - aber der BETRIEB ist es nicht: Zugeteilt wird alle zehn
    // Sekunden, eine Welle fliegt zwanzig Sekunden bis Minuten. Landen in
    // einem hackTime-Fenster zu viele hack-Faeden, raeumen sie den Server
    // vollstaendig leer, statt ihn bei 95 % zu halten. Genau das war messbar:
    // Nach dem Ausbau von 7.276 auf 63.612 GB stand phantasy bei 0 %
    // Guthaben, silver-helix bei 1 %, der grow-Anteil bei 77 % und der
    // hack-Anteil bei 11 % - und der Ertrag FIEL von 1.83 auf 1.54 Mio/s.
    //
    // Herleitung der Grenze. Ein hack-Faden zieht den Anteil p*chance vom
    // AKTUELLEN Guthaben ab. Werden je Sekunde n Faeden gestartet, landen in
    // einem hackTime-Fenster n*hackTime davon, der Abzug ist also rund
    // n*hackTime*p*chance. Damit die Rueckkopplung im linearen Bereich bleibt
    // - MIX_MONEY_LOW 0.75 bis MIX_MONEY_HIGH 0.95, also 20 Prozentpunkte -
    // darf dieser Abzug KAP_ABZUG nicht ueberschreiten:
    //     n = KAP_ABZUG / (hackTime * p * chance)
    // Der Speicher, den diese n Faeden je Sekunde belegen, ist n mal dem
    // GB-Sekunden-Preis einer Mischeinheit. Daraus:
    //     kapazitaet = KAP_ABZUG * gbSekProEinheit / (hackTime * p * chance)
    // Fuer phantasy ergibt das rund 1400 GB - und genau in dieser
    // Groessenordnung lief es vor dem Ausbau sauber (934 GB, 313 $/GB*s).
    const KAP_ABZUG = 0.2;
    const SERVER_MAX_GROWTH_LOG = 0.00349388925425578;
    const wachstumsLog = (hd) => Math.min(Math.log1p(0.03 / hd), SERVER_MAX_GROWTH_LOG);
    const FORTIFY_HACK = 0.002;
    const FORTIFY_GROW = 0.004;
    const WEAKEN_POWER = 0.05;
    const MIX_MONEY_HIGH = 0.95;
    const kennzahlen = (host, s) => {
      const p = ns.hackAnalyze(host);
      const chance = ns.hackAnalyzeChance(host);
      const cycles = ns.growthAnalyze(host, 2);
      const k = cycles > 0 ? Math.LN2 / cycles : 0;
      // Alles auf minDifficulty hochrechnen. hackAnalyze & Co. liefern immer
      // den IST-Wert; ein verschmutzter Server saehe sonst dauerhaft
      // schlechter aus, als er nach dem Saeubern waere - und wuerde vom
      // Nutzen-Gate aus dem falschen Grund verworfen. Jeder Faktor haengt
      // bekannt von der Sicherheit ab:
      //   p, chance  ~ (100 - hackDifficulty)      (Hacking.ts:50, :15)
      //   hackTime   ~ 2.5*req*hackDifficulty+500  (Hacking.ts:64-70)
      //   k          ~ min(log1p(0.03/hd), ServerMaxGrowthLog)
      //                (grow.ts:16-19, Constants.ts:8)
      // Der Deckel ServerMaxGrowthLog greift ab hackDifficulty <= 8.571;
      // ohne ihn waere die Umrechnung fuer omega-net (min 9), silver-helix
      // (10) und iron-gym (10) falsch.
      const hdIst = s.hackDifficulty, hdMin = s.minDifficulty;
      const sauber = (100 - hdIst) > 0 ? (100 - hdMin) / (100 - hdIst) : 1;
      const pMin = Math.min(1, p * sauber);
      const chanceMin = Math.min(1, chance * sauber);
      const zeitIst = 2.5 * s.requiredHackingSkill * hdIst + 500;
      const zeitMin = 2.5 * s.requiredHackingSkill * hdMin + 500;
      const hackTimeMin = ns.getHackTime(host) * (zeitIst > 0 ? zeitMin / zeitIst : 1) / 1000;
      const kMin = k * (wachstumsLog(hdIst) > 0 ? wachstumsLog(hdMin) / wachstumsLog(hdIst) : 1);
      // grow dauert das 3,2-fache, weaken das 4-fache eines hack
      // (Hacking.ts:81-95).
      const gphMin = kMin > 0 ? (pMin * chanceMin) / kMin : 0;
      const wphMin = (FORTIFY_HACK * chanceMin + FORTIFY_GROW * gphMin) / WEAKEN_POWER;
      const gbSekProEinheit = hackTimeMin
        * (ramHack + 3.2 * gphMin * ramGrow + 4 * wphMin * ramWeaken);
      const beute = pMin * chanceMin;
      // null statt 0, wenn sich nichts bestimmen laesst: Bei hackDifficulty
      // >= 100 gibt hackAnalyze 0 zurueck (Hacking.ts:46). Ein Gate, das
      // darauf mit "unrentabel" antwortet, wuerde genau diesen Server fuer
      // immer ungesaeubert liegen lassen. Unbekannt heisst: durchlassen.
      const brauchbar = p > 0 && gbSekProEinheit > 0 && beute > 0 && hackTimeMin > 0;
      return {
        p, chance, k,
        // Dieselben Groessen im VORBEREITETEN Zustand. Der Stapelbetrieb
        // braucht genau sie: seine Auftraege landen auf einem Server, der auf
        // Mindestsicherheit steht, also gelten dort pMin/chanceMin/kMin - und
        // zwar fuer jeden Stapel dieselben, sonst verschiebt sich die Kette
        // mit jeder Ablesung der Momentansicherheit selbst.
        pMin, chanceMin, kMin, hackTimeMin,
        steadyEff: brauchbar ? (s.moneyMax * MIX_MONEY_HIGH * beute) / gbSekProEinheit : null,
        kapazitaet: brauchbar ? (KAP_ABZUG * gbSekProEinheit) / (hackTimeMin * beute) : 0,
      };
    };

    let expTarget = null, expBestValue = 0;
    const moneyCandidates = [];
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (!s.moneyMax || s.requiredHackingSkill > ns.getHackingLevel()) continue;
      const hackTime = (2.5 * s.requiredHackingSkill * s.minDifficulty + 500)
        / (ns.getHackingLevel() + 50);

      const expGain = 3 + 0.3 * s.baseDifficulty;
      const expValue = expGain / hackTime;
      if (expValue > expBestValue) { expBestValue = expValue; expTarget = host; }

      // Sortiert wird seit dem 22.08.2026 nach steadyEff statt nach der alten
      // Naeherung moneyMax*skillMult*difficultyMult/hackTime. Die Naeherung
      // liess den Wachstumsaufwand weg und hat deshalb Server bevorzugt, die
      // viel Geld halten, es aber nur langsam nachwachsen lassen. Belegt:
      // iron-gym stand darin auf Rang 5 und bekam nach dem Serverausbau
      // 11.609 GB, obwohl es im Gleichgewicht nur 154 $/GB*s bringt - halb
      // so viel wie phantasy.
      let kz = null;
      try { kz = kennzahlen(host, s); } catch { kz = null; }
      if (kz && kz.steadyEff > 0) {
        moneyCandidates.push({ host, moneyValue: kz.steadyEff, kapazitaet: kz.kapazitaet });
      }
    }
    moneyCandidates.sort((a, b) => b.moneyValue - a.moneyValue);

    // Erfahrungsziel ausschliessen: es hat sein eigenes festes Fadenbudget
    // (EXP_THREAD_BUDGET weiter unten) und soll nicht zusaetzlich als Geldziel
    // zaehlen - sonst bekaeme derselbe Host zwei getrennte exec-Auftraege mit
    // je eigener Fadenzaehlung, ohne jeden Nutzen.
    // Gesperrte Ziele fallen VOR dem Zuschnitt heraus, nicht danach: Sonst
    // belegte ein gesperrtes Ziel weiter seinen Platz in der Liste, und die
    // Sperre haette nur den Platz stillgelegt statt ihn weiterzugeben.
    // Abgelaufene Sperren werden im selben Durchgang aufgeraeumt, damit die
    // Karte nicht ueber Tage waechst.
    for (const [host, bis] of gesperrtBis) if (Date.now() >= bis) gesperrtBis.delete(host);
    let moneyTargets = moneyCandidates
      .filter((c) => c.host !== expTarget && !gesperrtBis.has(c.host))
      .slice(0, MONEY_TARGET_COUNT)
      .map((c) => c.host);

    // Randbedingung: kein eigenstaendiges Geldziel gefunden (z. B. ganz am
    // Anfang, wenn ausser dem Erfahrungsziel noch nichts erreichbar ist) -
    // dann alles aufs Erfahrungsziel, wie zuvor. sameTarget loest den
    // Ein-Ziel-Fall unten aus.
    if (moneyTargets.length === 0 && expTarget) moneyTargets = [expTarget];
    const sameTarget = moneyTargets.length === 1 && moneyTargets[0] === expTarget;

    // --- Stapelziele aussondern (Stufe 4, 22.08.2026) ---------------------
    // Ein Stapelziel wird NICHT mehr von der offenen Steuerung bedient. Beide
    // Verfahren auf demselben Server gleichzeitig waere das Schlechteste aus
    // zwei Welten: die offenen hack-Wellen landen ungetaktet zwischen den
    // Stapeln, heben die Sicherheit und verschieben deren Laufzeiten.
    //
    // Warum ueberhaupt zwei Verfahren nebeneinander bleiben: Der Stapel ist
    // pro Gigabyte SCHLECHTER als die ideale Mischung - in ihm wartet jeder
    // Faden bis zu einer weaken-Zeit auf seinen Landeplatz, statt nur seine
    // eigene Aktionsdauer zu belegen. Gerechnet fuer omega-net: 4*tHack*(1.7
    // + gph*1.75 + wph*1.75) statt tHack*(1.7 + 3.2*gph*1.75 + 4*wph*1.75),
    // also gut das Doppelte an GB-Sekunden fuer dieselbe Beute. Sein Vorteil
    // liegt woanders und ist groesser: er ist GESCHLOSSEN. Die offene
    // Steuerung erreicht ihr Modell nachweislich nicht (gemessen 110 gegen
    // 208 $/GB*s) und kann pro Ziel nur KAP_ABZUG aufnehmen, weil ungetaktete
    // Wellen den Server sonst leerraeumen. Der Stapel nimmt statt 1.779 GB
    // (omega-net, KAP_ABZUG 0.2) rund 8.100 GB auf und liefert dabei
    // rechnerisch 237 $/GB*s - also mehr als das Doppelte des gemessenen
    // Ist-Werts, auf ein Mehrfaches des Speichers.
    //
    // Deshalb: die besten Ziele in den Stapelbetrieb, der Rest bleibt bei der
    // offenen Steuerung, die den uebrigen Speicher weiter aufnimmt.
    // Der Vorgabewert steht im CODE, nicht in der Datei. Die Datei ist nur der
    // Uebersteuerungsschalter fuer Messungen ("0" schaltet ganz ab). Stuende
    // die Vorgabe in der Datei, waere der groesste Hebel dieses Bots von einer
    // Textdatei abhaengig, die niemand vermisst - genau das Muster, an dem
    // dieser Bot schon mehrfach stundenlang stillstand. Drei Ziele sind
    // gemessen: 1 Ziel gab $9.12m/s, 3 Ziele $18.06m/s.
    const batchRoh = ns.read("data/batch-ziele.txt").trim();
    const BATCH_ZIELE = batchRoh === "" ? 3 : (Number(batchRoh) || 0);
    // --- Die Sicherung fuer die Zeit direkt nach einem Einbau -------------
    //
    // WAS HIER FRUEHER STAND UND WARUM ES NICHTS TAT (22.08.2026). Hier stand
    // BATCH_MIN_NETZ_GB = 3000 mit der Begruendung, nach einem
    // Augmentierungs-Einbau falle das Netz "auf wenige hundert GB". Das ist
    // falsch: home-RAM ueberlebt den Einbau (src/install.js:8-9), im
    // laufenden Stand sind das 4096 GB. ramTotal zaehlt home mit, liegt also
    // NIE unter 4096 - die Schwelle konnte gar nicht ausloesen. Eine
    // Sicherung, die auf einer nicht erreichbaren Groesse steht, ist keine.
    //
    // WAS NACH EINEM EINBAU WIRKLICH KNAPP IST, IST NICHT DER SPEICHER,
    // SONDERN DIE ZAHL DER ZIELE. Das Hacking-Level faellt auf 1, und alle
    // Portprogramme sind weg ausser NUKE.exe - erreichbar sind dann nur die
    // Server ohne Portanforderung und unter dem eigenen Level. Aus dem
    // Spielstand gezaehlt (22.08.2026):
    //     Level 1   -> 2 Geldziele    Level 30  -> 6
    //     Level 10  -> 4 Geldziele    ab hier deckelt die Portgrenze bei 7
    // Ein Stapelziel wird der offenen Steuerung ENTZOGEN und verdient
    // waehrend seiner Vorbereitung nichts. Mit BATCH_ZIELE = 3 und zwei
    // erreichbaren Zielen - eines davon meist das Erfahrungsziel - bliebe
    // moneyTargets LEER, und dann faellt Durchgang 2 komplett aus
    // ("if (!sameTarget && moneyTargets.length)"): Der Bot verdiente gar
    // nichts, bis die Vorbereitung durch ist.
    //
    // Deshalb die Sicherung auf der Groesse, die wirklich knapp ist: Es
    // muessen immer Ziele fuer die offene Steuerung uebrig bleiben. Zwei,
    // nicht eines - ein einzelnes Ziel taeuscht sonst nur Betrieb vor,
    // waehrend ein Anlauf oder eine Sperre es sofort wieder leert.
    // Ab Level 50 ist die Sicherung von selbst inaktiv (8 Ziele, davon 3 im
    // Stapel, 5 offen), sie bremst also nur den Wiederanlauf.
    const BATCH_MIN_OFFENE_ZIELE = 2;
    // Das Erfahrungsziel bleibt aussen vor: Es hat sein eigenes Fadenbudget
    // und bekommt zusaetzlich den Ueberschuss - beides wuerde ungetaktet
    // zwischen den Stapeln landen. Der Fall tritt nur ueber den Notnagel
    // "moneyTargets = [expTarget]" weiter oben ueberhaupt ein.
    const batchKandidaten = moneyTargets.filter((h) => h !== expTarget);
    const batchPlaetze = Math.max(0,
      Math.min(BATCH_ZIELE, batchKandidaten.length - BATCH_MIN_OFFENE_ZIELE));
    const batchTargets = BATCH_ZIELE > 0 ? batchKandidaten.slice(0, batchPlaetze) : [];
    if (batchTargets.length) {
      moneyTargets = moneyTargets.filter((h) => !batchTargets.includes(h));
    }
    // Zustaende von Zielen aufraeumen, die nicht mehr Stapelziel sind - sonst
    // kaeme ein Ziel nach Stunden mit einem uralten Kalender zurueck und
    // wuerde Stapel in die Vergangenheit legen.
    for (const h of [...batchStand.keys()]) {
      if (!batchTargets.includes(h)) { batchStand.delete(h); batchKalender.delete(h); }
    }

    let fehlstart = 0;
    let mixStat = null;
    let batchStat = null;
    // Zugeteilte share-Faeden dieser Runde, nur zur Beobachtung.
    let shareStand = 0;
    // Grenzertragskurve dieser Runde. Wird JEDE Runde neu aufgebaut, auch
    // wenn ein Zweig gar nicht laeuft - sonst rechnete die Serveraufruestung
    // mit den Abnehmern eines Zustands, den es nicht mehr gibt (Stapelbetrieb
    // abgeschaltet, Ziel gesperrt, Netz geschrumpft).
    const grenzStapel = [];
    const grenzOffen = [];
    // Speicher, den die Geldziele in dieser Runde nicht aufnehmen konnten und
    // der deshalb an die Erfahrung ging. Gehoert nach draussen: Er ist das
    // Mass dafuer, ob sich weiterer Serverausbau ueberhaupt noch lohnt.
    let ueberschussGb = 0;
    if (expTarget || moneyTargets.length || batchTargets.length) {
      // Aktionswahl fuer das ERFAHRUNGSziel: hier bleibt es beim Dreifach-
      // Ternaer. Erfahrung haengt allein am Server und an der Fadenzahl -
      // calculateHackingExpGain (Hacking.ts:29-38) unterscheidet die drei
      // Aktionen ueberhaupt nicht. Es gibt dort also nichts zu mischen; der
      // Ternaer haelt den Server nebenbei entschaerft, damit die Aktionsdauer
      // nicht davonlaeuft.
      const pickScript = (host) => {
        const s = ns.getServer(host);
        return s.hackDifficulty > s.minDifficulty + 5 ? "worker/weaken.js"
          : s.moneyAvailable < s.moneyMax * 0.9 ? "worker/grow.js"
            : "worker/hack.js";
      };
      const expScript = expTarget ? pickScript(expTarget) : null;
      const expRam = expScript ? ns.getScriptRam(expScript, "home") : 0;

      // STUFE 1 (22.08.2026): Landezeit und Aktionsdauer statt 0, 0, 0 an die
      // Arbeiter uebergeben, genau wie autopilot.js es tut (autopilot.js:1346-
      // 1355). Ohne echte Werte bleiben args[2]/args[3] leer und die
      // Terminlogik in worker/hack.js:38-42 (identisch in grow.js/weaken.js)
      // greift nie. Kostet 0,05 GB je Funktion (reference/bitburner-src/src/
      // Netscript/RamCostGenerator.ts:48,649-651), zusammen 0,15 GB fuer alle
      // drei - das ist die gesamte Mehrkosten dieses Umbaus.
      const actionTime = (host, script) => {
        if (script === "worker/hack.js") return ns.getHackTime(host);
        if (script === "worker/grow.js") return ns.getGrowTime(host);
        return ns.getWeakenTime(host);
      };

      // getScriptRam gibt bei fehlender Datei still 0 zurueck
      // (NetscriptFunctions.ts:1179-1191). Ungeprueft ergaebe das
      // Math.floor(frei/0) = Infinity, und das Spiel wirft daraufhin eine
      // Ausnahme - die diese Schleife und damit den halben Bot beenden wuerde.
      // weiter unten), also werden auch alle drei geprueft. Die Werte selbst
      // stehen oben bei den Kennzahlen je Ziel, die sie ebenfalls brauchen.
      if ((expScript && !(expRam > 0))
          || !(ramHack > 0) || !(ramGrow > 0) || !(ramWeaken > 0)) {
        sag("worker-Skript nicht lesbar, Runde uebersprungen.");
        await ns.sleep(10000); continue;
      }

      // Reputationsmodus: laeuft Faktions- oder Firmenarbeit, lohnt es sich,
      // einen Teil der Arbeiter statt zu hacken teilen zu lassen. ns.share()
      // wirkt einzig ueber calculateCurrentShareBonus() in
      // getHackingWorkRepGain()/getFactionFieldWorkRepGain()
      // (PersonObjects/formulas/reputation.ts:16-23) - ohne eine solche
      // Arbeit gerade laeuft, gibt es nichts, worauf der Bonus wirken
      // koennte, und die Faeden waeren verschenkte Hacking-Erfahrung. Genau
      // deshalb komplett aus, sobald keine Faktionsarbeit laeuft, statt einen
      // festen Anteil zu reservieren.
      // bn4rep.js schreibt data/rep-modus.txt bei jedem Arbeitsschritt neu
      // (bn4rep.js:168, Rundentakt 15 Sekunden) und loescht sie, sobald keine
      // offene Augmentierung mehr wartet (bn4rep.js:83-84). 120 Sekunden
      // Toleranz ueberstehen mehrere Runden, ohne dass ein abgestuerztes
      // bn4rep.js unbemerkt Faeden auf share bindet.
      let repModus = false;
      if (ns.fileExists("data/rep-modus.txt", "home")) {
        const stempel = Number(ns.read("data/rep-modus.txt").split("|")[1]);
        repModus = Number.isFinite(stempel) && Date.now() - stempel < 120000;
      }
      const shareBraucht = repModus ? ns.getScriptRam("worker/share.js", "home") : 0;
      // Netzweite Obergrenze. Jenseits davon kostet ein share-Faden mehr
      // Hacking-Erfahrung, als sein Reputationsbeitrag wert ist.
      // Gemessen, nicht geschaetzt: Mit 600 Faeden fiel die Hacking-Rate von
      // 1,07 auf 0,91 je Minute und die Reputationsrate von 100 auf 85. Der
      // Grund ist die Groessenordnung - worker/share.js kostet 4 GB je Faden,
      // 600 Faeden sind 2400 GB und damit mehr, als das ganze Netz hat. Share
      // hatte die hack-Faeden schlicht verdraengt.
      //
      // Der Bonus ist logarithmisch (1 + ln(n)/25): 100 Faeden bringen +18,4 %,
      // 600 nur +25,6 %. Die 500 Faeden dazwischen kosten 2000 GB fuer sieben
      // Prozentpunkte. Bei 100 Faeden sind es 400 GB - ein Fuenftel des Netzes
      // fuer knapp ein Fuenftel mehr Reputation, also etwa ein Nullsummen-
      // geschaeft, das nur wegen der sofortigen Wirkung ueberhaupt lohnt.
      //
      // NEU AM 22.08.2026 - DIE ALTE MESSUNG GALT FUER EIN 50-MAL KLEINERES
      // NETZ. Der Absatz darueber begruendet die 100 damit, dass 600 Faeden
      // (2400 GB) "mehr sind, als das ganze Netz hat". Das Netz hat inzwischen
      // rund 130.000 GB; 600 Faeden sind davon 1,8 %. Die Verdraengung, die
      // damals gemessen wurde, gibt es in dieser Groessenordnung nicht mehr.
      //
      // Und der Engpass hat sich gedreht: Gemessen am laufenden Spiel liegen
      // ueber 70 Milliarden ungenutzt herum, waehrend acht Augmentierungen auf
      // Reputation warten. Geld hat gerade wenig Grenznutzen, Reputation ist
      // der Fortschritt. RAM von Geld auf Reputation umzuschichten ist damit
      // ein guter Handel - genau der umgekehrte Befund von damals.
      //
      // Die Rechnung (calculateShareBonus, NetworkShare/Share.ts:43-49:
      // 1 + ln(n)/25, wobei n die EFFEKTIVEN Faeden sind, also inklusive
      // Intelligenz- und Kernbonus):
      //     n=100 -> 1,184    n=2000 -> 1,304
      //     n=600 -> 1,256    n=3900 -> 1,331
      // Von 100 auf rund 3900 Faeden sind das +12,4 % Reputationsrate fuer
      // 15.600 GB.
      //
      // ANTEIL STATT FESTER ZAHL, gleiches Muster wie EXP_THREAD_BUDGET
      // gleich darunter und aus demselben Grund: Direkt nach einem
      // Augmentierungs-Einbau sind alle gekauften Rechner weg
      // (Prestige.ts:73), und ein fester Deckel von ein paar tausend Faeden
      // frisst dann das ganze Netz - dieselbe Falle, in die das
      // Erfahrungsbudget schon einmal gelaufen ist.
      //
      // Die absolute Obergrenze bleibt trotzdem noetig, weil der Bonus
      // logarithmisch ist: Von 4.000 auf 10.000 Faeden sind es noch +3,7 %
      // fuer weitere 24.000 GB. Jenseits davon ist der Speicher im Geldziel
      // mehr wert, auch bei niedrigem Grenznutzen des Geldes.
      // DECKEL GELOEST (23.08.2026). Der Absatz darueber begruendet die 4.000
      // damit, dass "jenseits davon der Speicher im Geldziel mehr wert" sei.
      // Diese Begruendung traegt nicht mehr, aus zwei unabhaengigen Gruenden:
      //
      // 1. Der Speicher hat im Geldziel gar keinen Abnehmer. Gemessen am
      //    23.08.: kapGesamtGb 8.951 - so viel nehmen ALLE offenen Ziele
      //    zusammen auf - bei einem Netz von 1.072.988 GB. 71,7 Prozent
      //    liegen brach. Wer share deckelt, verschenkt nichts an das
      //    Geldziel, sondern an niemanden.
      // 2. Geld ist nicht der Engpass des Knotens. Reputation ist es, und der
      //    share-Bonus wirkt auf die aktive UND die passive Reputation
      //    zugleich (reputation.ts:16-24, FactionHelpers.tsx:132-170).
      //
      // Gerechnet: 4.000 Faeden geben 1,3318, die vom SHARE_ANTEIL erlaubten
      // 32.189 geben 1,4152 - also +6,3 Prozent auf jede Reputationsquelle,
      // ohne ein Byte mehr als ohnehin vorgesehen.
      //
      // Der Deckel bleibt als Sicherheitsnetz stehen, nur weit oben: Der
      // Bonus ist logarithmisch, jenseits von etwa 200.000 Faeden bringt
      // eine Verdopplung noch 2,8 Prozent. Die eigentliche Bremse ist und
      // bleibt SHARE_ANTEIL.
      const SHARE_ANTEIL = 0.12;
      const SHARE_MAX = 200000;
      const SHARE_DECKEL = shareBraucht > 0
        ? Math.max(1, Math.min(SHARE_MAX, Math.floor((ramTotal * SHARE_ANTEIL) / shareBraucht)))
        : 0;
      let shareGesamt = 0;

      // Erfahrungsbudget netzweit, gleiches Muster wie SHARE_DECKEL/shareGesamt
      // oben: ein Deckel, ein mitlaufender Zaehler ueber die Host-Schleife.
      // Anders als worker/share.js sind die Hack-Arbeiter Einwegskripte (siehe
      // Kopfkommentar worker/hack.js: "hackt einmal und beendet sich") - es
      // gibt also keine dauerhaft laufenden Faeden, die per ns.ps() gegenzu-
      // rechnen waeren. Der Zaehler summiert deshalb die in dieser Runde neu
      // zugeteilten Faeden. 180 genuegen laut Messung fuer die volle
      // Erfahrungsrate (joesguns: 0,262 Erfahrung je Faden und Sekunde), jeder
      // Faden darueber ist im Geldziel mehr wert.
      //
      // ABER: 180 Faeden sind 315 GB, und das ist nur dann ein kleiner Posten,
      // wenn das Netz gross ist. Direkt nach einem Augmentierungs-Einbau sind
      // alle gekauften Rechner weg (Prestige.ts:73), home faellt auf seine
      // Reserve zurueck, und vom Netz bleiben wenige hundert GB - das
      // Erfahrungsbudget allein frass dann ALLES, und fuer die Geldziele blieb
      // nichts. Belegt im Verlauf: nach dem Einbau um 21:55 stieg das
      // Hacking-Level ueber vierzig Minuten von 36 auf 186, das Geld aber nur
      // von 12,5 auf 13,9 Millionen - also praktisch kein Einkommen, genau in
      // der Phase, in der es fuer den Wiederaufbau am noetigsten waere.
      //
      // Deshalb zusaetzlich am Netz gedeckelt: hoechstens ein Fuenftel des
      // gerooteten Speichers geht an die Erfahrung. Ein Fuenftel, weil die
      // Erfahrung in diesem BitNode zwar der eigentliche Zweck der Arbeiter
      // ist (HackExpGain 0.4, Level 9000 fuer w0r1d_d43m0n), das Einkommen
      // aber die Rechner bezahlt, auf denen die Erfahrung entsteht. Bei
      // 7276 GB Netz greift der Deckel nicht (1455 GB Spielraum gegen 315 GB
      // Bedarf); er greift genau dann, wenn das Netz klein ist.
      const EXP_THREAD_BUDGET = Math.max(1, Math.min(180,
        Math.floor((ramTotal * 0.2) / Math.max(expRam, 1))));
      // Laufende Faeden mitzaehlen, nicht nur neu vergebene. hack, grow und
      // weaken dauern deutlich laenger als eine Runde von zehn Sekunden - bei
      // niedrigem Level sind es Minuten. Ein Zaehler, der jede Runde bei null
      // beginnt, legt also Welle um Welle nach, bis Tausende Faeden auf dem
      // Erfahrungsziel liegen und dem Geldziel den Speicher wegfressen.
      // Genau dieser Fehler ist bei worker/share.js schon einmal passiert;
      // dort loest ihn ns.ps, und hier tut es dasselbe. Das erste Argument der
      // Arbeiter ist ihr Ziel, daran sind sie zu erkennen.
      //
      // Derselbe Durchgang zaehlt zusaetzlich, was je GELDZIEL und Aktion
      // gerade unterwegs ist (flight). Das braucht die Anlaufphase weiter
      // unten: Ohne diese Gegenrechnung legt jede Runde eine weitere volle
      // Korrekturwelle obendrauf, obwohl die erste noch fliegt - genau der
      // Fehler, der beim Erfahrungsziel schon einmal Tausende Faeden
      // gestapelt hat. ns.isRunning mit Argumenten findet diese Prozesse
      // uebrigens NICHT, deshalb ns.ps.
      let expThreadsAssigned = 0;
      // Nur zur Beobachtung: der Speicher, der gerade auf dem Erfahrungsziel
      // liegt, JE SKRIPT gezaehlt. Faeden mal expRam waere falsch - expRam ist
      // der Bedarf der Aktion, die das Erfahrungsziel in DIESER Runde
      // bekaeme, waehrend dort Wellen aus frueheren Runden mit anderen
      // Aktionen liegen. Ueber Faeden mal expRam kam die Bezugsgroesse auf
      // 106.766 GB, obwohl das Netz nur 85.618 GB Arbeiterspeicher hatte.
      const ramJeSkript = {
        "worker/hack.js": ramHack, "worker/grow.js": ramGrow,
        "worker/weaken.js": ramWeaken,
      };
      let expRamAssigned = 0;
      const flight = new Map();
      for (const h of moneyTargets) flight.set(h, { hack: 0, grow: 0, weaken: 0 });
      // Stapelziele gehoeren mit in die Zaehlung. Die Vorbereitungsphase
      // rechnet gegen, was schon fliegt (sonst legt sie jede Runde eine
      // weitere volle Korrekturwelle obendrauf), und das Auslaufen erkennt
      // ueber dieselbe Zahl, wann der letzte Stapel gelandet ist.
      for (const h of batchTargets) flight.set(h, { hack: 0, grow: 0, weaken: 0 });
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        for (const pr of ns.ps(host)) {
          if (!WORKER.includes(pr.filename)) continue;
          if (pr.args[0] === expTarget) {
            expThreadsAssigned += pr.threads;
            expRamAssigned += pr.threads * (ramJeSkript[pr.filename] || 0);
            continue;
          }
          const f = flight.get(pr.args[0]);
          if (!f) continue;
          if (pr.filename === "worker/hack.js") f.hack += pr.threads;
          else if (pr.filename === "worker/grow.js") f.grow += pr.threads;
          else if (pr.filename === "worker/weaken.js") f.weaken += pr.threads;
        }
      }

      // --- Aktionsmischung je Geldziel (Stufe 3, 22.08.2026) ----------------
      // Bis hierher machten ALLE Faeden eines Ziels DIESELBE Aktion (der
      // Dreifach-Ternaer von pickScript). Gemessen ueber die Arbeiter-RAM-
      // Sekunden ergab das rund 7-20 % hack, 47-57 % grow, 33-39 % weaken:
      // Nach jeder Hackwelle faellt das Ziel unter die 90-Prozent-Schwelle
      // und wird minutenlang nur noch gewachsen, waehrend gar nichts
      // verdient wird. Und jede Welle schiesst weit ueber ihr Ziel hinaus -
      // 2000 weaken-Faeden nehmen 100 Sicherheit weg, wo 5 zuviel sind.
      //
      // Jetzt bekommt jedes Ziel gleichzeitig hack-, grow- und weaken-Faeden
      // im Gleichgewichtsverhaeltnis. Herleitung, alle Fundstellen in
      // reference/bitburner-src/src:
      //
      //   GELD  Ein hack-Faden zieht den Anteil p ab - aber nur bei Erfolg.
      //         Der Fehlschlagzweig (NetscriptHelpers.tsx:678-690) zieht kein
      //         Geld ab UND erhoeht die Sicherheit nicht; beides steht im
      //         Erfolgszweig (:629-643 bzw. :667). Also zaehlt p * chance.
      //         Ein grow-Faden multipliziert das Guthaben mit e^k
      //         (Server/formulas/grow.ts:8-29).
      //         Gleichgewicht:  k * grow = p * chance * hack
      //
      //   SICHERHEIT  hack +0.002 je Faden (Server/data/Constants.ts:9,
      //         angewandt NetscriptHelpers.tsx:667), grow +2*0.002 = 0.004
      //         (Server/ServerHelpers.ts:213), weaken -0.05 (Constants.ts:10).
      //         Gleichgewicht:  0.05 * weaken = 0.002*chance*hack + 0.004*grow
      //
      //   DAUER  grow = 3.2 * hack, weaken = 4 * hack (Hacking.ts:81-95).
      //         Geht hier nicht in die Rechnung ein, weil das Verhaeltnis in
      //         FADENSTARTS je Sekunde gilt - die Belegungsdauer kuerzt sich
      //         heraus. Aus dem Fadenverhaeltnis wird der RAM-Sekunden-Anteil
      //         erst durch Multiplikation mit RAM * Dauer.
      //
      // ENTSCHEIDEND FUER BITNODE 4: ScriptHackMoney 0.2 steckt bereits IN p
      // (Hacking.ts:54 multipliziert es in calculatePercentMoneyHacked hinein).
      // ScriptHackMoneyGain ist in diesem BitNode NICHT gesetzt
      // (BitNode.tsx:628-655) und bleibt damit 1 (BitNodeMultipliers.ts:153).
      // moneyGained = moneyDrained * 1 (NetscriptHelpers.tsx:648) - der Server
      // verliert also GENAU das, was der Spieler bekommt. Der Wachstumsbedarf
      // ist folglich nicht um den Faktor 5 hoeher, sondern genau umgekehrt:
      // weil p durch die 0.2 gefuenftelt wurde und ServerGrowthRate in diesem
      // BitNode bei 1.0 bleibt, braucht ein hack-Faden hier nur rund 0,42
      // grow-Faden statt gut 2 wie in BitNode 1. Gerechnet fuer phantasy
      // (Level 339): p = 6.4e-4, chance = 0.94, k = 1.42e-3
      //   -> hack : grow : weaken = 1 : 0.42 : 0.072  (Faeden)
      //   -> 37 % : 52 % : 11 %                       (RAM-Sekunden)
      // FORTIFY_HACK, FORTIFY_GROW, WEAKEN_POWER und MIX_MONEY_HIGH stehen
      // oben bei den Kennzahlen je Ziel - dieselben Konstanten, eine Quelle.
      // Zielband. MIX_MONEY_HIGH ist der Fixpunkt der Regelung, nicht die
      // Obergrenze: darueber waere jeder grow-Faden verschenkt, weil
      // calculateGrowMoney (grow.ts:44-52) bei moneyMax abschneidet. Etwas
      // Luft nach oben zu lassen kostet 5 % Beute je Faden und spart mehr
      // als das an weggeworfenen grow-Faeden.
      const MIX_MONEY_LOW = 0.75;   // darunter: Anlaufphase
      const MIX_SEC_OK = 1.0;       // bis hierher gilt die Sicherheit als am Minimum
      const MIX_SEC_BAD = 5.0;      // darueber: Anlaufphase
      const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

      // p, chance und k kommen aus dem Spiel selbst statt aus nachgebauten
      // Formeln. Das kostet 3 GB (hackAnalyze, hackAnalyzeChance,
      // growthAnalyze je 1 GB, RamCostGenerator.ts:569-579) und ist dafuer
      // gegen jeden Abschreibfehler immun und gegen jede Balance-Aenderung
      // des Spiels.
      //
      // ns.growthAnalyze gilt in diesem Projekt als unbrauchbar - zu Recht,
      // aber nur fuer die Frage "wieviele Faeden von HIER bis moneyMax".
      // numCycleForGrowth (Server/ServerHelpers.ts:69-80) laesst den additiven
      // +1-je-Faden-Term weg und liefert bei moneyAvailable 0 eine Division
      // durch null. Hier wird es anders benutzt: growthAnalyze(host, 2) ist
      // schlicht ln(2)/k und haengt weder am Guthaben noch am additiven Term.
      // k faellt daraus exakt heraus. Der dritte Parameter (cores) bleibt 1.
      //
      // Das war frueher damit begruendet, dass die Arbeiter fast alle auf
      // Fremdrechnern mit einem Kern laufen. Diese Begruendung ist seit dem
      // home-Ausbau falsch: home traegt 98 Prozent des Netzes. Die 1 bleibt
      // trotzdem, jetzt aber aus einem anderen Grund - sie ist die SICHERE
      // Annahme. Wer mit acht Kernen plant und einen Faden auf einem
      // Mietrechner landen laesst, weakent zu wenig; die Sicherheit steigt
      // und der Ertrag faellt. Umgekehrt kostet die Untertreibung nichts, was
      // knapp waere: 71,7 Prozent des Netzes liegen ohnehin brach, Faeden sind
      // nicht der Engpass. Der Kernbonus kommt als ungeplanter Ueberschuss
      // an - sauberere Server, vollere Guthaben - statt als eingesparte
      // Faeden. Erst wenn das Netz wirklich ausgelastet ist, lohnt es, die
      // Kerne je Ausfuehrungsort einzurechnen (Befund N8).
      const planMix = (host) => {
        const s = ns.getServer(host);
        const secOver = Math.max(0, s.hackDifficulty - s.minDifficulty);
        const moneyFrac = s.moneyMax > 0 ? clamp01(s.moneyAvailable / s.moneyMax) : 0;
        // Dieselbe Rechnung wie bei der Zielauswahl - eine Quelle, kein
        // zweiter Satz Formeln, der auseinanderlaufen kann. p, chance und k
        // sind die IST-Werte (fuer die Mischung), steadyEff und kapazitaet
        // sind auf minDifficulty hochgerechnet (fuer Gate und Deckel).
        const kz = kennzahlen(host, s);
        const p = kz.p, chance = kz.chance, k = kz.k;
        const f = flight.get(host) || { hack: 0, grow: 0, weaken: 0 };

        // ANLAUFPHASE, ausdruecklich und als eigener Zweig. Aus einem
        // beliebigen Ausgangszustand (Sicherheit hoch, Guthaben leer) fuehrt
        // die Gleichgewichtsmischung allein nicht heraus - sie HAELT einen
        // Zustand, sie stellt ihn nicht her. Hier stehen deshalb keine
        // Verhaeltnisse, sondern der noch OFFENE BEDARF: soviele Faeden
        // fehlen bis zum Gleichgewicht, abzueglich dessen, was schon fliegt.
        // Der Verteiler unten arbeitet diesen Bedarf der Reihe nach ab -
        // erst weaken, dann grow, kein hack.
        //
        // Warum weaken VORRANG hat und nicht parallel laeuft: k haengt ueber
        // log1p(0.03/hackDifficulty) (grow.ts:17) am Kehrwert der Sicherheit.
        // Fuer the-hub (minDifficulty 14, aktuell 41) heisst das k = 4.6e-4
        // statt 1.35e-3 - Wachstum ist bei hoher Sicherheit fast dreimal so
        // teuer. Nachgerechnet fuer diesen Server, von 27 % auf 95 %:
        //   sofort wachsen  2737 grow + 758 weaken = 3495 Faeden
        //   erst saeubern    540 weaken + 935 grow + 75 weaken = 1550 Faeden
        // Die zusaetzliche Wartezeit einer weaken-Runde ist billig, weil der
        // Speicher in der Zwischenzeit den anderen Zielen zufaellt.
        const anlauf = secOver > MIX_SEC_BAD || moneyFrac < MIX_MONEY_LOW || !(p > 0);
        if (anlauf) {
          const growNeed = k > 0
            ? Math.max(0, Math.log(MIX_MONEY_HIGH / Math.max(moneyFrac, 1e-9)) / k)
            : 0;
          // Nur die Sicherheit gegenrechnen, die WIRKLICH da ist, plus die,
          // welche der schon fliegende grow noch erzeugen wird. Die Sicherheit
          // eines erst geplanten grow gehoert nicht dazu - sonst schwaecht
          // diese Runde auf Vorrat, und der Deckel waere wieder wirkungslos.
          const weakenNeed = (secOver + FORTIFY_GROW * f.grow) / WEAKEN_POWER;
          // SEQUENZIELL, nicht gleichzeitig (Korrektur 22.08.2026). Der
          // Kommentar oben rechnet seit jeher vor, warum erst gesaeubert und
          // dann gewachsen wird - der Code hat weaken und grow aber in
          // DERSELBEN Runde aus demselben Anteil vergeben. Damit lief grow
          // genau in dem Zustand, den die Rechnung als dreimal zu teuer
          // ausweist: the-hub wuchs bei Sicherheit 41 mit k = 4.6e-4 statt
          // bei 14 mit 1.35e-3. Gemessen lagen dort 369 GB grow, von denen
          // rund zwei Drittel verschenkt waren.
          //
          // Solange also nennenswert Sicherheit ueber dem Minimum liegt, gibt
          // es NUR weaken. Das kostet eine weaken-Runde Wartezeit; die ist
          // billig, weil der nicht abgerufene Anteil unten an die anderen
          // Ziele weiterkaskadiert, statt liegenzubleiben.
          const nurSaeubern = secOver > MIX_SEC_OK;
          return {
            anlauf: true,
            steadyEff: kz.steadyEff, kapazitaet: kz.kapazitaet,
            bedarf: {
              hack: 0,
              grow: nurSaeubern ? 0 : Math.max(0, growNeed - f.grow),
              weaken: Math.max(0, weakenNeed - f.weaken),
            },
          };
        }

        // DAUERBETRIEB. Gleichgewichtsverhaeltnis plus proportionale
        // Rueckkopplung. Die Rueckkopplung ist der Grund, warum hier keine
        // harte Schwelle mehr steht: Ein Ternaer hat denselben Mittelwert,
        // aber er pendelt - erst nur hacken, bis das Guthaben faellt, dann
        // nur wachsen, bis es voll ist. Genau dieses Pendeln hat den
        // hack-Anteil auf unter 20 % gedrueckt. Die lineare Drosselung hat
        // ihren Fixpunkt bei MIX_MONEY_HIGH und regelt in beide Richtungen:
        // zuviel Geld -> voller hack-Anteil, zuwenig -> hack faellt, grow
        // steigt.
        const growPerHack = k > 0 ? (p * chance) / k : 0;
        const weakenPerHack = (FORTIFY_HACK * chance + FORTIFY_GROW * growPerHack) / WEAKEN_POWER;
        // Die Verstaerkung der Korrektur wird an der Groesse einer
        // Mischeinheit gemessen statt an einer geratenen Zahl - so bleibt sie
        // richtig, wenn sich p, k oder chance mit dem Level aendern.
        const einheit = 1 + growPerHack + weakenPerHack;
        const moneyErr = clamp01((MIX_MONEY_HIGH - moneyFrac) / (MIX_MONEY_HIGH - MIX_MONEY_LOW));
        const secErr = clamp01((secOver - MIX_SEC_OK) / (MIX_SEC_BAD - MIX_SEC_OK));
        return {
          anlauf: false,
          steadyEff: kz.steadyEff, kapazitaet: kz.kapazitaet,
          ratio: {
            hack: (1 - moneyErr) * (1 - secErr),
            grow: growPerHack + moneyErr * einheit,
            weaken: weakenPerHack + secErr * einheit,
          },
        };
      };

      // Durchgang 1: share und Erfahrungsziel je Rechner, wie bisher. Was
      // danach frei bleibt, wird nur GEMERKT statt sofort vergeben - die
      // Geldziele brauchen im Durchgang 2 den Gesamtbetrag, um ihre
      // Fadenzahlen ueberhaupt ausrechnen zu koennen.
      const restFrei = new Map();
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        // Die Werkbank ist nicht mehr pauschal ausgenommen, sondern nur noch
        // um ihren gemessenen Werkzeugbedarf gekuerzt (siehe 1c).
        const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
          - (host === "home" ? reserveHome() : 0)
          - (host === werkbank ? werkbankReserve : 0);
        if (host !== "home") ns.scp(WORKER, host, "home");

        // Home bleibt verschont, genau wie die Werkbank oben: Es ist die
        // Steuerung selbst und die Reserve dort ist schon knapp genug
        // bemessen (siehe reserveHome oben). Auf jedem anderen Rechner geht
        // ungefaehr die Haelfte der freien RAM an share, der Rest wie bisher
        // an den Ziel-Arbeiter.
        let freiFuerSkript = frei;
        // Gedeckelt, nicht anteilig - und aufgeraeumt. Der Bonus ist
        // 1 + ln(threads)/25 (NetworkShare/Share.ts:43), also logarithmisch:
        // 400 Faeden bringen +24 %, 800 nur +26,7 %. Die zweiten 400 Faeden
        // waeren als hack-Faeden das Doppelte an Hacking-Erfahrung wert, und
        // die ist in diesem BitNode der einzige Zweck der Arbeiter. Ein halbes
        // Netz an share zu haengen waere teuer bezahlte Bequemlichkeit.
        //
        // Zwei Fallen, die ohne ns.ps zuschlagen: worker/share.js laeuft
        // endlos, ein neues exec je Runde stapelt also alle zehn Sekunden
        // Faeden obendrauf - und wenn die Faktionsarbeit endet, laufen die
        // alten fuer immer weiter und blockieren Speicher ohne jeden Nutzen.
        const shareLaeuft = ns.ps(host)
          .filter((pr) => pr.filename === "worker/share.js")
          .reduce((n, pr) => n + pr.threads, 0);

        // ZWEI FEHLER BIS 22.08.2026, beide im Deckel:
        //
        // (1) shareGesamt zaehlte nur die schon LAUFENDEN Faeden, nicht die
        //     in derselben Runde neu gestarteten. In der ersten Runde des
        //     repModus stand der Zaehler deshalb auf jedem Rechner bei null,
        //     und jeder durfte den vollen Deckel ausschoepfen - der netzweite
        //     Deckel wirkte faktisch pro Rechner.
        // (2) Ein einmal entstandener Ueberhang wurde nie wieder abgebaut.
        //     worker/share.js laeuft endlos und wurde nur beendet, wenn der
        //     repModus ganz endete. Ohne (2) haette (1) allein nichts
        //     geholfen: Die zuviel gestarteten Faeden waeren stehengeblieben.
        //
        // Gemessene Folge: 250 Faeden statt 100, also 1000 statt 400 GB - ein
        // Fuenftel des Netzes.
        //
        // Der Handel dahinter, weil er nicht offensichtlich ist: Der Bonus
        // ist 1 + ln(n)/25 (NetworkShare/Share.ts:44). 100 Faeden geben
        // +18.4 %, 250 geben +22.1 %. Die 150 Faeden dazwischen kosten 600 GB
        // - bei gemessenen 320 $/GB*s rund 192 k$/s - und bringen 3.1
        // Prozentpunkte Reputation. Das ist der schlechteste Teil einer
        // ohnehin logarithmischen Kurve.
        // Die Frage nach der richtigen Zahl ist am 22.08.2026 beantwortet
        // worden: Der Deckel ist jetzt ein Anteil des Netzes, siehe
        // SHARE_ANTEIL oben. Der Mechanismus hier - Ueberhang raeumen, dann
        // gedeckelt neu aufbauen - bleibt unveraendert richtig und traegt den
        // groesseren Deckel unverandert.
        let shareHier = shareLaeuft;
        if (!repModus) {
          if (shareLaeuft) ns.scriptKill("worker/share.js", host);
          shareHier = 0;
        } else if (shareBraucht > 0) {
          // home ist hier NICHT mehr ausgenommen (23.08.2026). Der Ausschluss
          // machte den ganzen SHARE_ANTEIL zur Luege: Der Deckel wird aus
          // ramTotal gerechnet - und home stellt 97,7 Prozent davon -,
          // verteilt werden durfte aber nur auf den Rest. Von den
          // beabsichtigten 32.189 Faeden waren dadurch rund 6.000 erreichbar,
          // also 19 Prozent der Wirkung; gemessen wurde genau das.
          //
          // Der Platz auf home ist geschuetzt, ohne dass es diesen Ausschluss
          // braucht: `frei` zieht reserveHome() bereits ab, und `passt` nimmt
          // ohnehin nur die Haelfte des Verbleibenden.
          const nochOffen = Math.max(0, SHARE_DECKEL - shareGesamt);
          if (shareHier > nochOffen) {
            // Ueberhang. Ganz raeumen und im naechsten Durchgang gedeckelt
            // neu aufbauen, statt einzelne Prozesse zu suchen: share-Faeden
            // sind gleichwertig und ihr Nutzen faengt beim Neustart ohne
            // Verlust wieder an - anders als bei hack, grow und weaken, wo
            // ein Abbruch die ganze Laufzeit wegwirft.
            ns.scriptKill("worker/share.js", host);
            shareHier = 0;
          } else if (shareHier < nochOffen) {
            const passt = Math.floor((frei * 0.5) / shareBraucht);
            const shareFaeden = Math.min(nochOffen - shareHier, passt);
            if (shareFaeden >= 1) {
              if (ns.exec("worker/share.js", host, shareFaeden) === 0) fehlstart++;
              freiFuerSkript = frei - shareFaeden * shareBraucht;
              shareHier += shareFaeden;
            }
          }
        }
        shareGesamt += shareHier;

        // Die Argumente muessen zum Protokoll der Arbeiter passen: args[1] ist
        // dort die Verzoegerung in Millisekunden (worker/hack.js:38-40) und
        // bleibt 0 - seit Stufe 1 tragen stattdessen args[2]/args[3] die
        // echte Landezeit und Aktionsdauer (siehe actionTime oben). Die
        // Rundennummer gehoert ans Ende (args[4]) - stuende sie an Position 1,
        // waere jede Aktion um sie verzoegert gestartet, nach einem Tag um
        // 8,6 Sekunden, nach drei Monaten um dreizehn Minuten. Dort dient sie
        // nur noch dazu, den Aufruf von seinem Vorgaenger zu unterscheiden.
        if (sameTarget) {
          // Beide Ziele sind derselbe Server - ein Aufruf genuegt, alle
          // freien Faeden gehen an ihn.
          const faeden = Math.floor(freiFuerSkript / expRam);
          if (faeden < 1) continue;
          const dauer = actionTime(expTarget, expScript);
          const landAt = Date.now() + dauer;
          if (ns.exec(expScript, host, faeden, expTarget, 0, Math.round(landAt), Math.round(dauer), runde) === 0) {
            fehlstart++;
          }
          continue;
        }

        // Erfahrungsziel zuerst bis zum Netzbudget, der Rest auf die
        // Geldziele verteilt.
        if (expScript) {
          const nochOffenExp = Math.max(0, EXP_THREAD_BUDGET - expThreadsAssigned);
          if (nochOffenExp > 0) {
            const passtExp = Math.floor(freiFuerSkript / expRam);
            const expFaeden = Math.min(nochOffenExp, passtExp);
            if (expFaeden >= 1) {
              const dauer = actionTime(expTarget, expScript);
              const landAt = Date.now() + dauer;
              if (ns.exec(expScript, host, expFaeden, expTarget, 0, Math.round(landAt), Math.round(dauer), runde) === 0) {
                fehlstart++;
              }
              freiFuerSkript -= expFaeden * expRam;
              expThreadsAssigned += expFaeden;
            }
          }
        }

        if (freiFuerSkript > 0) restFrei.set(host, freiFuerSkript);
      }
      shareStand = shareGesamt;

      // --- Durchgang 1b: Stapelbetrieb HWGW (Stufe 4, 22.08.2026) ----------
      //
      // Der strukturelle Unterschied zu allem darueber: Hier wird nicht mehr
      // "der gerade freie Speicher" verteilt, sondern ein VOLLSTAENDIGER
      // Stapel reserviert und nur gestartet, wenn er ganz passt. Vier
      // Auftraege, feste Reihenfolge, feste Landeabstaende:
      //
      //   hack     nimmt den Anteil f vom vollen Guthaben
      //   weaken   hebt die Sicherheit des hack wieder auf
      //   grow     holt das Guthaben zurueck auf das Maximum
      //   weaken   hebt die Sicherheit des grow wieder auf
      //
      // Das Verfahren beruht auf einer Asymmetrie im Spielcode: Die DAUER
      // einer Aktion wird einmalig beim Aufruf festgelegt (NetscriptHelpers
      // .tsx:598, netscriptDelay :469-482 ist ein einziges setTimeout, keine
      // Neubewertung), die WIRKUNG dagegen erst beim Landen aus dem dann
      // aktuellen Serverzustand (:616-629 fuer hack, ServerHelpers.ts:204-224
      // fuer grow). Wer die Landezeitpunkte in der Hand hat, kann jeden hack
      // auf ein Ziel treffen lassen, das genau auf Hoechstguthaben und
      // Mindestsicherheit steht - dort ist Beuteanteil und Erfolgschance am
      // groessten und die Laufzeit am kuerzesten.
      //
      // DAS UEBERHOL-PROBLEM bei steigendem Level: Bei jedem Levelaufstieg
      // wird hackTime um 1/(Level+50) kuerzer, bei Level 501 also um 0,2 % je
      // Punkt - auf eine weaken-Zeit von 134 s sind das 270 ms je Level, und
      // das Level steigt hier mehrmals je Minute. Wer Stapel mit RELATIVEN
      // Fristen plant ("dieser Stapel startet 1,6 s nach dem letzten"), laesst
      // den neuen den alten einholen. Deshalb ist der Kalender (batchKalender)
      // eine absolute Wanduhrzeit: Ein neuer Stapel bekommt seine Landung
      // frueheste GAP_MS nach der letzten schon vergebenen Landung, und der
      // Kalender wird nur nach vorn gesetzt. Wird ein Stapel durch ein
      // hoeheres Level kuerzer, startet er einfach spaeter - seine Landung
      // bleibt, wo sie im Kalender steht. Ueberholen ist damit nicht moeglich,
      // ohne dass irgendwo eine Fallunterscheidung noetig waere.
      // Die zweite Haelfte derselben Sache steckt in den Arbeitern: Sie messen
      // ihre Dauer seit dem 22.08.2026 SELBST, unmittelbar vor dem Aufruf
      // (worker/hack.js). Sonst ginge jede Sicherheitsaenderung zwischen
      // Planung und Start ungefiltert in die Landezeit ein - fuer omega-net
      // waeren das 4,5 s bei 400 ms Landeabstand.
      if (batchTargets.length) {
        // Abstand zwischen zwei Landungen desselben Stapels und zwischen den
        // Stapeln. Der einzige wirklich heikle Wert: zu klein, und eine
        // verrutschte Landung dreht die Reihenfolge um - dann faellt das
        // Guthaben nicht sanft, sondern binnen Minuten auf null. Zu gross, und
        // der Kalender wird zum Engpass, weil jeder Stapel 4*gap Kalenderzeit
        // belegt und in eine weaken-Zeit nur tWeaken/(4*gap) Stapel passen.
        // 400 ms stammen aus der Simulation des BitNode-1-Autopiloten (dort
        // 300 ms Streuung unbeschadet ueberstanden) und sind hier zum ersten
        // Mal am laufenden Spiel. Der Wert bestimmt NICHT den Ertrag je
        // Gigabyte - nur, wieviel Speicher ein Ziel aufnehmen kann.
        const GAP_MS = 400;
        // Vorlauf, damit der zuletzt landende Ausgleich beim Start nicht schon
        // ueberfaellig ist. Grosszuegig, weil zwischen dem exec und dem
        // ersten Befehl des Arbeiters der REST DIESER RUNDE liegt - bei 95
        // Rechnern sind das Sekunden, nicht Millisekunden.
        const SLACK_MS = 5000;
        // Wie weit vor seinem Starttermin ein Stapel losgeschickt werden darf.
        // Muss ueber der Rundenlaenge von 10 s liegen, sonst faellt in jeder
        // Runde ein Teil des Kalenders ersatzlos aus. Der Preis ist, dass die
        // Faeden bis zu 14 s laenger Speicher binden als noetig - das steckt
        // in additionalMsec und kostet nur Speicher, keine Genauigkeit.
        const LEAD_MS = 14000;
        // Aufschlag auf die Ausgleichsauftraege. Ueberzaehlige weaken-Faeden
        // sind wirkungslos (die Sicherheit ist nach unten auf minDifficulty
        // gedeckelt, Server.ts:91-104), zu wenige dagegen lassen nach jedem
        // Stapel einen Rest stehen, der sich ueber hunderte Stapel aufschaukelt.
        const WEAKEN_MARGIN = 1.5;
        // Aufschlag auf das Nachwachsen. Er faengt genau den Fehler ab, den
        // ein steigendes Level erzeugt: Die Fadenzahl eines Stapels wird beim
        // Einplanen gerechnet, gelandet wird bis zu einer weaken-Zeit spaeter
        // - und bis dahin ist p (Beute je Faden) mit dem Level gewachsen. Der
        // hack nimmt dann etwas mehr, als sein grow zurueckholen sollte, und
        // ueber hunderte Stapel sackt das Guthaben ab. Zuviel grow ist
        // dagegen gratis: calculateGrowMoney schneidet bei moneyMax ab, und
        // die verpuffenden Faeden erhoehen nicht einmal die Sicherheit
        // (ServerHelpers.ts:210-213 deckelt usedCycles auf die genutzten).
        // Derselbe Aufschlag deckt den Aufteilungsverlust, wenn die
        // hack-Faeden auf mehrere Rechner mussten.
        const GROW_MARGIN = 1.15;
        const MAX_STAPEL_PRO_RUNDE = 80;
        // Drifterkennung. In einem gesunden Stapelbetrieb faellt die
        // Sicherheit nach jedem Stapel exakt auf das Minimum zurueck und das
        // Guthaben auf hoechstens (1-f) unter das Maximum. Beobachtet wird
        // deshalb nicht der Mittelwert, sondern das MINIMUM ueber ein Fenster:
        // Wenn selbst der beste Moment der letzten zwei Minuten daneben liegt,
        // stimmt die Kette nicht mehr - und dann muss der Betrieb ANHALTEN,
        // nicht stillschweigend weiterrechnen.
        const DRIFT_PROBEN = 12;
        const DRIFT_SEC = 1.0;
        // Anteil des noch freien Speichers, den ein Stapelziel je Runde
        // hoechstens an sich ziehen darf. Ohne die Bremse fuellt ein einzelnes
        // Ziel beim kalten Start seinen ganzen Kalender auf einen Schlag und
        // laesst der offenen Steuerung eine Runde lang gar nichts.
        const BATCH_ANTEIL = 0.6;
        // Erntanteile, aufsteigend. Kleines f ist speichereffizienter (hack
        // nimmt linear weg, grow muss multiplikativ zurueckholen), grosses f
        // laesst ein Ziel mehr Speicher aufnehmen. Gerechnet fuer omega-net:
        // f=0.02 gibt 237 $/GB*s bei 8.100 GB Aufnahme, f=0.5 nur noch
        // 192 $/GB*s, dafuer 200.000 GB. Gesucht wird das KLEINSTE f, dessen
        // voller Kalender ungefaehr den Anteil des Netzes fasst, der diesem
        // Ziel zusteht.
        const F_LEITER = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
        const F_NETZANTEIL = 0.15;

        const freiGesamt = () => {
          let s = 0;
          for (const gb of restFrei.values()) s += gb;
          return s;
        };
        const batchInfo = [];

        for (const ziel of batchTargets) {
         // Je Ziel abgesichert. Wirft die Kennzahlenrechnung fuer EINEN
         // Server, soll nicht die ganze Runde ausfallen - dann stuende auch
         // die offene Steuerung fuer alle uebrigen Ziele still.
         try {
          const s = ns.getServer(ziel);
          let st = batchStand.get(ziel);
          if (!st) {
            st = { phase: "prep", proben: [], fraction: F_LEITER[0], stapel: 0 };
            batchStand.set(ziel, st);
          }
          const fl = flight.get(ziel) || { hack: 0, grow: 0, weaken: 0 };
          const laeuft = fl.hack + fl.grow + fl.weaken;
          const secOver = Math.max(0, s.hackDifficulty - s.minDifficulty);
          const moneyFrac = s.moneyMax > 0 ? s.moneyAvailable / s.moneyMax : 0;
          let neueStapel = 0, secBoden = null, geldBoden = null;

          // --- Drifterkennung, bevor irgendetwas Neues gestartet wird ------
          //
          // ACHTUNG BEIM LESEN VON geldBoden: Diese Runde taktet mit 10 s, ein
          // Stapel mit 4*gap = 1,6 s. Die Probe ist also mit dem Vorgang
          // verschraenkt (Aliasing) und trifft haeufig genau das Fenster, in
          // dem das Guthaben wieder voll ist - gemessen am 22.08.2026 stand
          // geldBoden fuer phantasy auf 1,00, waehrend eine Messung im
          // 0,7-s-Takt sauber zwischen 85,00 % und 100,00 % pendeln sah.
          // geldBoden ist deshalb KEINE Anzeige des echten Guthabenbodens.
          // Als BREMSE taugt es trotzdem, und nur darum geht es hier: eine
          // wirklich gerissene Kette laesst das Guthaben dauerhaft unten, dann
          // ist auch die beste Probe schlecht. Der Sicherheitsboden ist der
          // verlaesslichere der beiden Zeugen - in einer gesunden Kette steht
          // die Sicherheit die meiste Zeit exakt auf minDifficulty.
          if (st.phase === "batch") {
            st.proben.push({ sec: secOver, geld: moneyFrac });
            if (st.proben.length > DRIFT_PROBEN) st.proben.shift();
            if (st.proben.length >= DRIFT_PROBEN) {
              secBoden = Infinity; geldBoden = Infinity;
              for (const pr of st.proben) {
                if (pr.sec < secBoden) secBoden = pr.sec;
                if (pr.geld < geldBoden) geldBoden = pr.geld;
              }
              // Untergrenze fuers Guthaben: im gesunden Betrieb faellt es nie
              // unter (1-f), denn genau so viel nimmt ein Stapel weg. Der
              // Faktor 0.5 laesst Platz dafuer, dass sich zwei Stapel einmal
              // ueberholen, ohne dass gleich alles angehalten wird.
              const grenze = Math.max(0.05, (1 - st.fraction) * 0.5);
              if (secBoden > DRIFT_SEC || geldBoden < grenze) {
                st.phase = "drain";
                st.proben = [];
                sag(ziel + ": Stapel laufen aus der Reihe (Sicherheitsboden +"
                  + secBoden.toFixed(2) + ", Guthabenboden "
                  + Math.round(geldBoden * 100) + " %, Grenze "
                  + Math.round(grenze * 100) + " %) - Kette wird angehalten.");
              }
            }
          }
          // Auslaufen: keine neuen Stapel, bis der letzte gelandet ist. Erst
          // dann darf neu vorbereitet werden - wer schon waehrend des
          // Auslaufens wieder Faeden schickt, kommt nie aus dem Zustand heraus.
          if (st.phase === "drain" && laeuft === 0) {
            st.phase = "prep";
            batchKalender.delete(ziel);
            st.stapel = 0;
          }

          // --- Vorbereiten -------------------------------------------------
          // Erst die Sicherheit auf das Minimum, DANN das Guthaben auf 100 %.
          // Die Reihenfolge ist nicht Geschmack: k haengt ueber log1p(0.03/hd)
          // am Kehrwert der Sicherheit (grow.ts:17), Wachstum bei hoher
          // Sicherheit ist also ein Vielfaches teurer.
          // Diese Auftraege bekommen ausdruecklich KEINE Landezeit (0, 0) -
          // sie sollen so schnell wie moeglich wirken, nicht getaktet.
          if (st.phase === "prep") {
            let budget = freiGesamt() * BATCH_ANTEIL;
            const weakenNoetig = Math.ceil(
              (secOver + FORTIFY_GROW * fl.grow) / WEAKEN_POWER) - fl.weaken;
            if (weakenNoetig > 0) {
              const n = Math.min(weakenNoetig, Math.floor(budget / ramWeaken));
              if (n >= 1) {
                const ops = [{ script: "worker/weaken.js", threads: n, cost: ramWeaken }];
                const b = platziere(restFrei, ops);
                if (b) {
                  for (const stueck of b.belegung) {
                    if (ns.exec("worker/weaken.js", stueck.host, stueck.threads,
                      ziel, 0, 0, 0, "p" + runde) === 0) fehlstart++;
                  }
                  for (const [h, gb] of b.frei) restFrei.set(h, gb);
                }
              }
            } else if (moneyFrac < 0.9999) {
              const kz0 = kennzahlen(ziel, s);
              const growNoetig = growFaeden(kz0.kMin, s.moneyMax,
                s.moneyAvailable, s.moneyMax) - fl.grow;
              const n = Math.min(Math.ceil(growNoetig), Math.floor(budget / ramGrow));
              if (n >= 1) {
                const ops = [{ script: "worker/grow.js", threads: n, cost: ramGrow }];
                const b = platziere(restFrei, ops);
                if (b) {
                  for (const stueck of b.belegung) {
                    if (ns.exec("worker/grow.js", stueck.host, stueck.threads,
                      ziel, 0, 0, 0, "p" + runde) === 0) fehlstart++;
                  }
                  for (const [h, gb] of b.frei) restFrei.set(h, gb);
                }
              }
            } else if (laeuft === 0) {
              // Fertig - und zwar wirklich: kein Faden mehr unterwegs, der
              // die Sicherheit noch heben oder das Guthaben noch bewegen
              // koennte. Ein landender grow waehrend der ersten Stapel wuerde
              // deren Laufzeiten verschieben.
              st.phase = "batch";
              st.proben = [];
              st.stapel = 0;
              batchKalender.set(ziel, 0);
              sag(ziel + " ist vorbereitet - Stapelbetrieb beginnt.");
            }
          }

          // --- Stapel takten -----------------------------------------------
          if (st.phase === "batch") {
            const kz = kennzahlen(ziel, s);
            // Fadenzahlen im VORBEREITETEN Zustand rechnen (Sicherheit am
            // Minimum), nicht im gerade abgelesenen. Genau dort landen die
            // Auftraege, dort wirken sie - und nur so bekommt jeder Stapel
            // dieselben Zahlen, statt dass sich die Kette selbst verschiebt.
            const pMin = kz.pMin, chanceMin = kz.chanceMin, kMin = kz.kMin;
            // Die LAUFZEIT dagegen bei der jetzigen Sicherheit - das Spiel
            // bestimmt sie beim Aufruf. Sie geht nur in den fruehesten
            // moeglichen Landetermin ein; die Feinkorrektur macht der Arbeiter
            // selbst.
            const tHack = ns.getHackTime(ziel);
            const tWeaken = tHack * 4;
            if (pMin > 0 && kMin > 0 && tHack > 0 && s.moneyMax > 0) {
              const kalenderPlaetze = Math.max(1, Math.floor(tWeaken / (4 * GAP_MS)));
              // f waehlen: das kleinste, dessen voller Kalender den Anteil des
              // Netzes fasst, der diesem Ziel zusteht.
              const wunschGb = ramTotal * F_NETZANTEIL;
              let fraction = F_LEITER[F_LEITER.length - 1];
              const stapelPlan = (f) => {
                const hackT = Math.max(1, Math.floor(f / pMin));
                // Ein Block mit n Faeden nimmt p*n vom AKTUELLEN Guthaben -
                // linear, nicht multiplikativ (NetscriptHelpers.tsx:629).
                const echt = Math.min(0.99, pMin * hackT);
                const growT = Math.max(1, Math.ceil(
                  growFaeden(kMin, s.moneyMax, s.moneyMax * (1 - echt), s.moneyMax)
                  * GROW_MARGIN));
                const w1 = Math.max(1, Math.ceil(hackT * FORTIFY_HACK * WEAKEN_MARGIN / WEAKEN_POWER));
                const w2 = Math.max(1, Math.ceil(growT * FORTIFY_GROW * WEAKEN_MARGIN / WEAKEN_POWER));
                return {
                  hackT, growT, w1, w2, echt,
                  ram: hackT * ramHack + growT * ramGrow + (w1 + w2) * ramWeaken,
                  geld: echt * s.moneyMax * chanceMin,
                };
              };
              let fIndex = F_LEITER.length - 1;
              for (let i = 0; i < F_LEITER.length; i++) {
                const pl = stapelPlan(F_LEITER[i]);
                fIndex = i;
                if (pl.ram * kalenderPlaetze >= wunschGb) break;
              }
              fraction = F_LEITER[fIndex];
              st.fraction = fraction;
              const plan = stapelPlan(fraction);

              // --- Beitrag dieses Ziels zur Grenzertragskurve (22.08.2026) --
              // Ein Stapelziel nimmt keinen festen Betrag auf, sondern einen
              // ANTEIL des Netzes: wunschGb waechst mit ramTotal, also rutscht
              // f eine Sprosse hoeher, sobald genug Speicher da ist. Der
              // Ertrag DIESER Sprosse ist der Grenzertrag - zusaetzliches Geld
              // geteilt durch zusaetzlichen Speicher, nicht der Durchschnitt.
              // Gemessen am 22.08.2026 liegen beide dicht beieinander
              // (omega-net 249 Schnitt gegen 242 Grenz), das ist kein
              // Rechenfehler: Die Guete ist ueber f fast flach, weil hack und
              // grow beide ungefaehr linear mitwachsen.
              //
              // Oben auf der Leiter (f = 0.5) waechst die Aufnahme nicht mehr
              // mit. Dann - und nur dann - ist ein Stapelziel wirklich
              // gesaettigt, und mehr Speicher bringt dort NICHTS mehr; "frei"
              // ist dann die restliche Aufnahme statt Infinity.
              const uNun = plan.ram * kalenderPlaetze;
              const rNun = plan.geld / (4 * GAP_MS / 1000);
              const naechst = fIndex + 1 < F_LEITER.length ? stapelPlan(F_LEITER[fIndex + 1]) : null;
              const uNext = naechst ? naechst.ram * kalenderPlaetze : 0;
              if (naechst && uNext > uNun) {
                const rNext = naechst.geld / (4 * GAP_MS / 1000);
                grenzStapel.push({ eff: (rNext - rNun) / (uNext - uNun), frei: Infinity });
              } else if (uNun > 0) {
                grenzStapel.push({
                  eff: rNun / uNun,
                  frei: Math.max(0, uNun - (fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken)),
                });
              }

              let kalender = batchKalender.get(ziel) || 0;
              let budget = freiGesamt() * BATCH_ANTEIL;
              while (neueStapel < MAX_STAPEL_PRO_RUNDE && budget >= plan.ram) {
                const jetzt = Date.now();
                // Der zuletzt landende Ausgleich hat die laengste Laufzeit.
                // Frueher als (jetzt + tWeaken) kann er nicht landen, also darf
                // der hack - der 3*gap vor ihm liegt - nicht frueher stehen.
                const frueheste = jetzt + tWeaken - 3 * GAP_MS + SLACK_MS;
                const landHack = Math.max(kalender + GAP_MS, frueheste);
                // Gehoert dieser Stapel schon in diese Runde? Massgeblich ist,
                // ob sein zuletzt landender Ausgleich jetzt startbar waere.
                if (landHack + 3 * GAP_MS - tWeaken > jetzt + LEAD_MS) break;

                const ops = [
                  { art: "hack", script: "worker/hack.js", threads: plan.hackT, cost: ramHack, landAt: landHack, dauer: tHack },
                  { art: "weaken1", script: "worker/weaken.js", threads: plan.w1, cost: ramWeaken, landAt: landHack + GAP_MS, dauer: tWeaken },
                  { art: "grow", script: "worker/grow.js", threads: plan.growT, cost: ramGrow, landAt: landHack + 2 * GAP_MS, dauer: tHack * 3.2 },
                  { art: "weaken2", script: "worker/weaken.js", threads: plan.w2, cost: ramWeaken, landAt: landHack + 3 * GAP_MS, dauer: tWeaken },
                ];
                const b = platziere(restFrei, ops);
                if (!b) break;

                // Festschreiben - und die Ernte ZULETZT. Sollte ein exec
                // scheitern, fehlt dann hoechstens die Beute. Waere sie zuerst
                // gestartet, koennte ihr das Nachwachsen fehlen, und genau
                // daraus wird ein Ziel, das langsam ausblutet.
                let abbruch = false;
                for (const op of [ops[1], ops[2], ops[3], ops[0]]) {
                  for (const stueck of b.belegung) {
                    if (stueck.op !== op) continue;
                    const pid = ns.exec(op.script, stueck.host, stueck.threads,
                      ziel, 0, Math.round(op.landAt), Math.round(op.dauer),
                      "b" + runde + "-" + neueStapel);
                    if (!pid) { abbruch = true; fehlstart++; break; }
                  }
                  if (abbruch) break;
                }
                for (const [h, gb] of b.frei) restFrei.set(h, gb);
                budget -= plan.ram;
                kalender = landHack + 3 * GAP_MS;
                neueStapel++;
                st.stapel++;
                if (abbruch) break;
              }
              batchKalender.set(ziel, kalender);

              // STILLSTANDSWACHE. Ein Ziel im Stapelbetrieb, das keinen
              // einzigen Stapel mehr unterbringt und auch nichts mehr fliegen
              // hat, verdient nichts und blockiert zugleich seinen Platz - die
              // offene Steuerung fasst es ja nicht mehr an. Das kann jederzeit
              // eintreten, wenn das Netz schrumpft: ein Augmentierungs-Einbau
              // loescht alle gekauften Rechner (Prestige.ts:73). Fuer den
              // grossen Fall greift BATCH_MIN_OFFENE_ZIELE (dann wird das Ziel
              // gar nicht erst zum Stapelziel), fuer den schleichenden diese
              // Wache.
              //
              // Behandelt wird er ueber die schon vorhandene Sperrliste: Das
              // Ziel faellt fuer eine Weile aus den Kandidaten, damit wird der
              // naechstbeste Server zum Stapelziel, und nach Ablauf wird es
              // mit dem dann gueltigen Netz neu versucht.
              st.leer = neueStapel > 0 ? 0 : (st.leer || 0) + 1;
              if (st.leer >= 30 && laeuft === 0) {
                gesperrtBis.set(ziel, Date.now() + 10 * 60000);
                batchStand.delete(ziel);
                batchKalender.delete(ziel);
                sag(ziel + ": Stapelbetrieb steht seit fuenf Minuten still (kein"
                  + " Stapel passt, nichts unterwegs) - 10 min gesperrt, das"
                  + " naechstbeste Ziel rueckt nach.");
              }
              batchInfo.push({
                ziel, phase: st.phase, fraction, neueStapel,
                gesamt: st.stapel,
                stapelGb: Math.round(plan.ram),
                kalenderPlaetze,
                belegtGb: Math.round(fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken),
                erwartetProS: Math.round(plan.geld / (4 * GAP_MS / 1000)),
                secBoden: secBoden === null ? null : Number(secBoden.toFixed(2)),
                geldBoden: geldBoden === null ? null : Number(geldBoden.toFixed(3)),
              });
            }
          }

          if (st.phase !== "batch") {
            batchInfo.push({
              ziel, phase: st.phase, fraction: st.fraction, neueStapel: 0,
              gesamt: st.stapel,
              moneyFrac: Number(moneyFrac.toFixed(3)),
              secOver: Number(secOver.toFixed(2)),
              laeuft,
            });
          }
         } catch (e) {
          if (runde % 10 === 0) sag("Stapelbetrieb " + ziel + " warf: " + String(e));
         }
        }
        batchStat = { gap: GAP_MS, ziele: batchInfo };
        grenzAnteilMerker = F_NETZANTEIL;
      }

      // --- Durchgang 2: Geldziele mit gemischten Aktionen -------------------
      // Frueher lief die Verteilung IM Host-Durchgang: jeder Rechner teilte
      // seinen Rest zu gleichen Teilen auf die Ziele auf. Mit drei Aktionen je
      // Ziel waeren daraus bei 43 nennenswerten Rechnern und 10 Zielen bis zu
      // 1290 exec-Aufrufe je Runde geworden, und auf einem 64-GB-Rechner
      // haette ein Zieldrittel nicht einmal fuer einen weaken-Faden gereicht.
      // Deshalb umgedreht: erst netzweit ausrechnen, WIEVIELE Faeden welcher
      // Art gebraucht werden, dann diese Wuensche auf die groessten Rechner
      // packen. Das sind rund 30 Wuensche und damit hoechstens etwa 70
      // exec-Aufrufe - weniger als vorher, bei feinerer Aufteilung.
      if (!sameTarget && moneyTargets.length) {
        let budget = 0;
        for (const gb of restFrei.values()) budget += gb;
        // Melden, wenn fuer die Geldziele nichts uebrigbleibt. Das passiert
        // nicht theoretisch: Direkt nach einem Augmentierungs-Einbau sind alle
        // gekauften Rechner weg (Prestige.ts:73) und das Netz faellt auf
        // wenige hundert GB - das Erfahrungsbudget allein belegt dann schon
        // 180 * 1.75 = 315 GB, und Durchgang 2 bekommt gar nichts mehr. Ohne
        // diese Zeile sieht das von aussen aus wie normaler Betrieb.
        if (budget < 2 && runde % 10 === 0) {
          sag("Geldziele bekommen nichts: nach share und Erfahrungsziel sind "
            + budget.toFixed(1) + " GB frei.");
        }

        const wuensche = [];
        const summeFaeden = { hack: 0, grow: 0, weaken: 0 };
        let anlaufZiele = 0;

        // --- Anlaufphase eindaemmen (22.08.2026) ---------------------------
        // Gemessener Anlass: the-hub lag ueber Stunden bei Sicherheit 41
        // (Minimum 14) und 27 % Guthaben und band dabei 1376 von 4608 GB
        // Arbeiterspeicher - 30 % des Netzes fuer null Ertrag. Der Grund ist
        // nicht ein einzelner Rechenfehler, sondern dass die Anlaufphase gar
        // keine Grenze kannte: kein Nutzen-Gate, keine Obergrenze, keine
        // Frist. Ein Ziel, das aus eigener Kraft nicht herausfindet, konnte
        // beliebig lange beliebig viel binden.
        //
        // Drei Bremsen, absichtlich getrennt, weil sie verschiedene Fehler
        // abfangen:
        //   Gate   - Ziele, die den Anlauf sachlich nicht wert sind.
        //   Deckel - Ziele, die ihn wert waeren, aber nicht auf einmal.
        //   Frist  - Ziele, bei denen die Rechnung stimmt und es trotzdem
        //            nicht vorangeht (Ursache unbekannt und egal).
        const ANLAUF_ANTEIL_ZIEL = 0.15;    // je Ziel und Runde
        const ANLAUF_ANTEIL_GESAMT = 0.30;  // alle Anlaufziele zusammen
        const ANLAUF_FRIST_MS = 20 * 60000;
        const ANLAUF_SPERRE_MS = 30 * 60000;

        // Erst planen, dann verteilen. Der Grund fuer die getrennten
        // Durchgaenge ist das Nutzen-Gate: Es vergleicht ein Anlaufziel mit
        // dem Durchschnitt der Ziele, die schon im Dauerbetrieb laufen - und
        // den kennt man erst, wenn alle Plaene vorliegen.
        const plaene = [];
        for (const ziel of moneyTargets) {
          try {
            plaene.push({ ziel, plan: planMix(ziel) });
          } catch (e) {
            // Nicht stillschweigend ueberspringen. Wirft hackAnalyze oder
            // growthAnalyze fuer ein Ziel dauerhaft, faellt dieses Ziel sonst
            // fuer immer aus, ohne dass irgendwo etwas davon steht - genau
            // das Muster, das diesen Bot schon mehrfach stundenlang hat
            // stillstehen lassen. Gedrosselt, damit das Log lesbar bleibt.
            if (runde % 10 === 0) sag("planMix(" + ziel + ") warf: " + String(e));
          }
        }

        // Vergleichsmassstab: der mittlere Gleichgewichtsertrag der Ziele, die
        // gerade LAUFEN. Ist keines im Dauerbetrieb - direkt nach einem
        // Einbau, oder wenn wirklich alles schmutzig ist -, bleibt das Gate
        // aus. Sonst blockierte es sich selbst: Kein Ziel duerfte anlaufen,
        // weil keines laeuft, und keines liefe, weil keines anlaufen darf.
        const laufende = plaene.filter((e) => !e.plan.anlauf && e.plan.steadyEff > 0);
        const massstab = laufende.length
          ? laufende.reduce((n, e) => n + e.plan.steadyEff, 0) / laufende.length : 0;

        // --- Modellobergrenze, NUR ZUR BEOBACHTUNG (22.08.2026) ------------
        // Die einzige ehrliche Bezugsgroesse fuer einen Umbau an der
        // Zuteilung. "Besser als vorher" sagt nichts, solange Level und
        // gekaufter Speicher gleichzeitig wachsen; "so viel Prozent des mit
        // diesem Netz Moeglichen" schon. Diese Rechnung greift NICHT in die
        // Zuteilung ein - sie zaehlt nur mit.
        //
        //   kapGesamt  Summe der Aufnahme aller Geldziele. Beantwortet die
        //              Frage, an der die Ueberschuss-Praemisse haengt: Hat
        //              das Netz die Ziele wirklich ueberholt (dann waere
        //              kapGesamt kleiner als das Netz), oder findet die
        //              Zuteilung die Aufnahme nur nicht? Gemessen am
        //              22.08.2026: 137.860 GB Aufnahme gegen 77.803 GB
        //              Arbeiterspeicher - die Praemisse war falsch.
        //   deckeNetz  Was herauskaeme, wenn dieser Speicher gierig auf die
        //              besten Ziele verteilt waere. Bezugsgroesse fuer den
        //              Prozentsatz.
        let deckeGesamt = 0, kapGesamt = 0, kapFrei = 0, moneyStandGb = 0;
        for (const e of plaene) {
          const kap = e.plan.kapazitaet || 0;
          kapGesamt += kap;
          deckeGesamt += (e.plan.steadyEff || 0) * kap;
          const f0 = flight.get(e.ziel) || { hack: 0, grow: 0, weaken: 0 };
          const b0 = f0.hack * ramHack + f0.grow * ramGrow + f0.weaken * ramWeaken;
          moneyStandGb += b0;
          kapFrei += Math.max(0, kap - b0);
          // Beitrag zur Grenzertragskurve. Nur Ziele im DAUERBETRIEB: Ein
          // Anlaufziel nimmt Speicher erst auf, nachdem es gesaeubert wurde,
          // und ob es ueberhaupt anlaufen darf, entscheidet das Nutzen-Gate
          // weiter unten. Wer solche Aufnahme in eine Amortisationsrechnung
          // schreibt, bezahlt Speicher fuer Abnehmer, die es noch gar nicht
          // gibt - genau der Fehler, den kapFrei oben schon einmal gemacht
          // hat (137.860 GB gemeldete Aufnahme, 3.400 GB tatsaechlich
          // zugeteilt).
          if (!e.plan.anlauf && e.plan.steadyEff > 0 && kap - b0 > 0) {
            grenzOffen.push({ eff: e.plan.steadyEff, frei: kap - b0 });
          }
        }
        // Der in DIESER Runde freie Speicher taugt nicht als Bezugsgroesse -
        // er ist selbst das Ergebnis der Zuteilung: Was einmal ans
        // Erfahrungsziel ging, liegt dort eine weaken-Dauer fest und taucht
        // als "frei" nie wieder auf. Gezaehlt wird deshalb, was im
        // Dauerbetrieb auf Geldzielen liegen KOENNTE.
        const budgetStart = budget;
        const verfuegbarGb = budgetStart + moneyStandGb
          + Math.max(0, expRamAssigned - EXP_THREAD_BUDGET * expRam);
        let deckeNetz = 0, restNetz = verfuegbarGb;
        for (const e of plaene) {
          const nimm = Math.min(e.plan.kapazitaet || 0, restNetz);
          deckeNetz += (e.plan.steadyEff || 0) * nimm;
          restNetz -= nimm;
        }

        const anlaufDeckelZiel = budget * ANLAUF_ANTEIL_ZIEL;
        let anlaufDeckelRest = budget * ANLAUF_ANTEIL_GESAMT;
        let restZiele = plaene.length;
        for (const eintrag of plaene) {
          const ziel = eintrag.ziel;
          const plan = eintrag.plan;
          if (restZiele <= 0) break;
          restZiele--;

          // WASSERFALL STATT GLEICHVERTEILUNG (22.08.2026). Bisher bekam jedes
          // Ziel budget/restZiele, also gleich viel, und was ein Ziel liegen
          // liess, kaskadierte nach unten. Das war richtig, solange alle Ziele
          // ungefaehr gleich gut waren und keines gesaettigt werden konnte.
          // Beides gilt nicht: Die Spanne betraegt 3:1, und jedes Ziel hat
          // eine berechenbare Kapazitaet (siehe kennzahlen oben).
          //
          // Jetzt nimmt sich jedes Ziel der Reihe nach - und die Reihe ist
          // nach steadyEff sortiert, also das beste zuerst - hoechstens so
          // viel, wie es noch aufnehmen kann. Der Rest faellt an das naechste.
          // Das ist die richtige Zuteilung fuer ungleiche Ziele mit endlicher
          // Aufnahme: Die besten werden voll, die schlechten bekommen nur, was
          // uebrig bleibt, und ist gar nichts uebrig, bekommen sie nichts.
          //
          // Was schon fliegt, wird gegengerechnet. Sonst legte jede Runde eine
          // volle Kapazitaet obendrauf, obwohl die vorige noch unterwegs ist -
          // derselbe Stapelfehler, der beim Erfahrungsziel und bei share schon
          // zweimal zugeschlagen hat.
          const fl = flight.get(ziel) || { hack: 0, grow: 0, weaken: 0 };
          const belegt = fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken;
          let anteil = Math.min(budget, Math.max(0, (plan.kapazitaet || 0) - belegt));

          if (plan.anlauf) {
            // Die Anlaufphase kennt keine Kapazitaetsgrenze: Ihr Bedarf ist
            // endlich und in planMix ausgerechnet, und sie hackt nicht, kann
            // den Server also gar nicht leerraeumen. Sie bekommt deshalb den
            // vollen Rest angeboten - gebremst wird sie von ihren eigenen
            // Deckeln weiter unten.
            anteil = budget;
            // GATE. Ein Anlauf kostet Speicher, der sonst SOFORT Geld
            // brachte. Er lohnt nur, wenn das Ziel hinterher mindestens so
            // gut zahlt wie das, was man dafuer stehenlaesst. steadyEff ist
            // dafuer schon auf minDifficulty hochgerechnet, das Ziel wird
            // also nach seinem Zustand NACH dem Saeubern beurteilt, nicht
            // nach dem davor. null heisst "nicht bestimmbar" und laesst
            // durch (Begruendung bei steadyEff).
            if (plan.steadyEff != null && massstab > 0 && plan.steadyEff < massstab) {
              if (runde % 30 === 0) {
                sag("Anlauf fuer " + ziel + " uebersprungen: " + Math.round(plan.steadyEff)
                  + " $/GB*s im Gleichgewicht, Flotte laeuft mit " + Math.round(massstab) + ".");
              }
              anlaufSeit.delete(ziel);
              continue;
            }
            // FRIST. Auch ein rentables Ziel darf nicht ewig anlaufen. Kommt
            // es binnen ANLAUF_FRIST_MS nicht in den Dauerbetrieb, wird es
            // fuer ANLAUF_SPERRE_MS beiseitegelegt. Die Sperre ist kein
            // Urteil ueber den Server, sondern ueber die Lage: Sie laeuft ab,
            // und dann wird es mit dem dann gueltigen Netz neu versucht.
            const seit = anlaufSeit.get(ziel);
            if (seit == null) {
              anlaufSeit.set(ziel, Date.now());
            } else if (Date.now() - seit > ANLAUF_FRIST_MS) {
              gesperrtBis.set(ziel, Date.now() + ANLAUF_SPERRE_MS);
              anlaufSeit.delete(ziel);
              sag(ziel + ": Anlauf nach " + Math.round((Date.now() - seit) / 60000)
                + " min ohne Erfolg abgebrochen, " + Math.round(ANLAUF_SPERRE_MS / 60000)
                + " min gesperrt.");
              continue;
            }
            // DECKEL. Auch mit Gate und Frist darf ein einzelnes Anlaufziel
            // nicht das halbe Netz binden, und alle zusammen erst recht
            // nicht. Was hier gekuerzt wird, faellt ueber die Kaskade an die
            // Ziele, die schon Geld verdienen.
            anteil = Math.min(anteil, anlaufDeckelZiel, anlaufDeckelRest);
          } else {
            anlaufSeit.delete(ziel);
          }

          const faeden = { hack: 0, grow: 0, weaken: 0 };
          if (plan.anlauf) {
            // Anlaufphase: der offene Bedarf wird der Reihe nach abgearbeitet,
            // weaken vor grow (Begruendung in planMix). Der Deckel auf den
            // Bedarf ist der eigentliche Gewinn dieser Fassung - bisher ging
            // der GANZE freie Netzspeicher in eine Aktion, also nahm eine
            // weaken-Welle hundert Sicherheitspunkte weg, wo fuenf zuviel
            // waren. Alles darueber war ersatzlos verschenkt.
            anlaufZiele++;
            let rest = anteil;
            faeden.weaken = Math.min(Math.ceil(plan.bedarf.weaken), Math.floor(rest / ramWeaken));
            rest -= faeden.weaken * ramWeaken;
            faeden.grow = Math.min(Math.ceil(plan.bedarf.grow), Math.floor(rest / ramGrow));
          } else {
            // Dauerbetrieb: GB je Mischeinheit. Eine Einheit besteht aus
            // r.hack hack-Faeden, r.grow grow-Faeden und r.weaken
            // weaken-Faeden; daraus faellt die Fadenzahl je Aktion direkt
            // heraus, ohne Zwischenrundung.
            const r = plan.ratio;
            const gbProEinheit = r.hack * ramHack + r.grow * ramGrow + r.weaken * ramWeaken;
            if (!(gbProEinheit > 0)) continue;
            const einheiten = anteil / gbProEinheit;
            faeden.hack = Math.floor(einheiten * r.hack);
            faeden.grow = Math.floor(einheiten * r.grow);
            faeden.weaken = Math.floor(einheiten * r.weaken);
            // Der kleinste Anteil geht beim Abrunden systematisch unter:
            // weaken hat im Gleichgewicht nur rund 7 % der Faeden, es braucht
            // also 14 volle Mischeinheiten fuer den ERSTEN Faden. Bei knappem
            // Budget - kleines Netz, viele Ziele, frisch nach einem Einbau -
            // faellt weaken damit Runde um Runde aus, die Sicherheit steigt
            // schleichend, und am Ende steht wieder das Pendeln, das dieser
            // Umbau gerade abschafft. Deshalb: wer im Verhaeltnis ueberhaupt
            // vorkommt, bekommt mindestens einen Faden, solange der Anteil
            // dafuer reicht. Kostet hoechstens zwei Faeden je Ziel und Runde.
            let uebrig = anteil - faeden.hack * ramHack - faeden.grow * ramGrow
              - faeden.weaken * ramWeaken;
            for (const [art, ram] of [["weaken", ramWeaken], ["grow", ramGrow], ["hack", ramHack]]) {
              if (faeden[art] === 0 && r[art] > 0 && uebrig >= ram) {
                faeden[art] = 1;
                uebrig -= ram;
              }
            }
          }
          let verbraucht = 0;
          for (const [art, skript, ram] of [
            ["weaken", "worker/weaken.js", ramWeaken],
            ["grow", "worker/grow.js", ramGrow],
            ["hack", "worker/hack.js", ramHack],
          ]) {
            const n = faeden[art];
            if (n < 1) continue;
            verbraucht += n * ram;
            summeFaeden[art] += n;
            // Dauer und Landezeit einmal je Wunsch, nicht je Rechner: alle
            // Teilwellen desselben Wunsches sollen gemeinsam landen.
            const dauer = actionTime(ziel, skript);
            wuensche.push({
              ziel, skript, ram, offen: n,
              dauer: Math.round(dauer), landAt: Math.round(Date.now() + dauer),
            });
          }
          budget = Math.max(0, budget - verbraucht);
          // Der Gesamtdeckel wird nur von Anlaufzielen abgetragen, sonst
          // waere er nach dem ersten Dauerbetriebsziel aufgebraucht und
          // wirkte gar nicht.
          if (plan.anlauf) anlaufDeckelRest = Math.max(0, anlaufDeckelRest - verbraucht);
        }

        // --- Ueberschuss an die Erfahrung (22.08.2026) ---------------------
        // Seit die Geldziele eine Kapazitaetsgrenze haben, kann Speicher
        // uebrigbleiben - und nach dem Serverausbau bleibt sehr viel uebrig:
        // gemessen 39.030 von 63.612 GB in einer Runde. Der Grund ist keine
        // Panne, sondern eine Tatsache ueber dieses BitNode: Die Summe der
        // Kapazitaeten aller erreichbaren Geldziele ist endlich, und das Netz
        // hat sie ueberholt.
        //
        // Brachliegen ist die schlechteste aller Verwendungen. Die zweitbeste
        // ist die Erfahrung, und in BitNode 4 ist sie sogar der eigentliche
        // Zweck der Arbeiter: w0r1d_d43m0n verlangt hier Hacking 9000 statt
        // 3000 (WorldDaemonDifficulty 3), und HackExpGain 0.4 macht jeden
        // Punkt zweieinhalbmal so teuer wie sonst.
        //
        // Erfahrung saettigt nicht: calculateHackingExpGain (Hacking.ts:29-38)
        // haengt allein an baseDifficulty und wird von hack, grow UND weaken
        // gleichermassen vergeben - der Zustand des Servers ist ihr egal, ein
        // leergehacktes Ziel liefert genauso viel wie ein volles. Deshalb
        // braucht dieser Zweig keinen Deckel; er nimmt, was sonst niemand
        // will.
        if (budget >= expRam && expTarget && expScript && expRam > 0) {
          const dauer = actionTime(expTarget, expScript);
          wuensche.push({
            ziel: expTarget, skript: expScript, ram: expRam,
            offen: Math.floor(budget / expRam),
            dauer: Math.round(dauer), landAt: Math.round(Date.now() + dauer),
          });
          ueberschussGb = Math.round(budget);
          budget = 0;
        }

        // Wuensche auf Rechner legen, groesster Rechner zuerst. So braucht ein
        // grosser Wunsch wenige exec-Aufrufe, und die kleinen Rechner bleiben
        // fuer die Reste uebrig.
        const platz = [...restFrei.entries()].sort((a, b) => b[1] - a[1]);
        for (const w of wuensche) {
          for (const eintrag of platz) {
            if (w.offen < 1) break;
            const passt = Math.floor(eintrag[1] / w.ram);
            if (passt < 1) continue;
            const n = Math.min(w.offen, passt);
            // Argumentreihenfolge unveraendert: (ziel, verzoegerung, landezeit,
            // dauer, runde) - siehe worker/hack.js:38-42.
            if (ns.exec(w.skript, eintrag[0], n, w.ziel, 0, w.landAt, w.dauer, runde) === 0) {
              fehlstart++;
              continue;
            }
            eintrag[1] -= n * w.ram;
            w.offen -= n;
          }
        }

        // Nur fuer die Beobachtung von aussen - die Verteilung ist die Zahl,
        // an der dieser Umbau gemessen wird.
        ueberschussMerker = ueberschussGb;
        mixStat = {
          ...summeFaeden, anlaufZiele, restGb: Math.round(budget),
          // Der Massstab des Nutzen-Gates gehoert nach draussen: Er ist die
          // einzige Zahl, an der von aussen zu sehen ist, wie gut die Flotte
          // gerade laeuft - und wie streng das Gate deshalb ist.
          effFlotte: Math.round(massstab),
          ueberschussGb,
          // Bezugsgroessen (siehe Modellobergrenze oben). Nur Beobachtung.
          deckeDollarProS: Math.round(deckeGesamt),
          deckeNetzDollarProS: Math.round(deckeNetz),
          kapGesamtGb: Math.round(kapGesamt),
          kapFreiGb: Math.round(kapFrei),
          budgetGb: Math.round(budgetStart),
          verfuegbarGb: Math.round(verfuegbarGb),
          expStandGb: Math.round(expRamAssigned),
          gesperrt: [...gesperrtBis.keys()],
        };
      }
    }

    // --- Grenzertragskurve festschreiben (22.08.2026) ---------------------
    // Ausserhalb aller if-Zweige, damit sie auch dann stimmt, wenn ein Zweig
    // in dieser Runde nicht gelaufen ist. Gelesen wird sie eine Runde spaeter
    // von der Serveraufruestung (Abschnitt 1a2).
    grenzStapelMerker = grenzStapel;
    grenzOffen.sort((a, b) => b.eff - a.eff);
    grenzOffenMerker = grenzOffen;
    // Nach draussen, sonst ist die Zahl, an der jeder Serverkauf haengt, von
    // aussen unsichtbar. Drei Stuetzstellen, weil der Grenzertrag von der
    // MENGE abhaengt - eine einzelne Zahl waere wieder derselbe Fehler.
    if (mixStat) mixStat.grenz = [1024, 4096, 16384].map((g) => Math.round(grenzErtrag(g)));

    if (fehlstart) sag(fehlstart + " Arbeiter liessen sich nicht starten (Speicher?).");

    // --- 2c. Werkzeuge betreiben ----------------------------------------------
    // Alles, was nicht Netz und nicht Spielfigur ist, laeuft auf der Werkbank -
    // oder bleibt, wo es schon laeuft. Die Liste WERKZEUGE steht oben am
    // Skriptanfang, weil die RAM-Verteilung sie frueher braucht als diese
    // Stelle.
    let vertraege = 0;
    for (const host of hosts) vertraege += ns.ls(host, ".cct").length;

    // Sammeln und Entdoppeln stehen VOR der Werkbank-Pruefung (23.08.2026).
    // Vorher hing der ganze Block an `if (werkbank)` - gab es keine
    // Werkbank, unterblieb auch die Entdopplung. Genau dieser Zustand
    // herrscht direkt nach einem Knotenwechsel, wenn home wieder 32 GB hat
    // und noch nichts gekauft ist: also dort, wo ein Mensch am ehesten von
    // Hand nachhilft und dabei eine zweite Instanz erzeugt.
    // Netzweit pruefen. Nur auf der Werkbank nachzusehen hiesse: Sobald ein
    // groesserer Rechner gekauft wird und die Werkbank wechselt, gilt jedes
    // Werkzeug als fehlend und wird ein zweites Mal gestartet - waehrend die
    // alte Instanz weiterlaeuft. Bei bn4rep.js waeren das zwei Steuerungen
    // fuer dieselbe Spielfigur, also genau der Fehler, den die
    // Aufgabenteilung verhindern soll.
    const laufend = [];
    const orte = new Map();          // Datei -> [{host, pid}, ...]
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      for (const pr of ns.ps(host)) {
        laufend.push(pr.filename);
        // Die beiden Steuerhaelften gehoeren mit in die Entdopplung, obwohl
        // sie nicht in WERKZEUGE stehen: Der Auftragslaeufer in bn4life.js
        // startet ein Skript auf dem Rechner mit dem MEISTEN freien
        // Speicher, und das ist praktisch nie home. Wer bn4life.js von Hand
        // neu startet, bekommt eine Instanz auf einem Mietrechner - und
        // weil die Wiederbelebung mit ns.isRunning(..., "home") prueft,
        // startet die andere Haelfte prompt eine zweite auf home. Zwei
        // bn4life begehen dann gleichzeitig Verbrechen, treten Faktionen
        // bei und reisen.
        const istSteuerung = pr.filename === "bn4life.js" || pr.filename === "bn4net.js";
        if (!istSteuerung && !WERKZEUGE.some(([d]) => d === pr.filename)) continue;
        if (!orte.has(pr.filename)) orte.set(pr.filename, []);
        orte.get(pr.filename).push({ host, pid: pr.pid });
      }
    }

    // Doppelte Werkzeuge einsammeln. Die Pruefung oben verhindert nur, dass
    // DIESES Skript ein zweites Mal startet - sie raeumt nichts weg, was
    // auf anderem Weg dazugekommen ist. Am 23.08.2026 lief bn4rep.js
    // gleichzeitig auf home und auf fulcrumtech, weil ein Neustart von Hand
    // (tools/task.js) auf home landete, waehrend die Werkbank ihre Instanz
    // behielt. Zwei Steuerungen fuer dieselbe Spielfigur heben sich
    // gegenseitig die Arbeit ab: workForCompany und workForFaction ersetzen
    // die jeweils laufende Taetigkeit, das Ergebnis ist eine Figur, die im
    // Sekundentakt zwischen zwei Auftraegen springt und an keinem
    // Fortschritt macht. Genau so stand der Bot am 22.08. eine Stunde.
    //
    // Die aelteste Instanz bleibt: Sie hat den laengsten ununterbrochenen
    // Arbeitsfortschritt hinter sich, und bei bn4rep.js haengt daran die
    // laufende Faktions- oder Firmenarbeit. Kleinere pid heisst frueher
    // gestartet - die Vergabe ist im Spiel streng aufsteigend
    // (Netscript/killWorkerScript.ts, generatePid).
    for (const [datei, wo] of orte) {
      if (wo.length < 2) continue;
      // Bei den Steuerhaelften gewinnt IMMER die auf home - dort sucht die
      // jeweils andere Haelfte sie. Sonst die aelteste, also die kleinste
      // pid: sie hat den laengsten Arbeitsfortschritt hinter sich.
      const istSteuerung = datei === "bn4life.js" || datei === "bn4net.js";
      if (istSteuerung && wo.some((w) => w.host === "home")) {
        wo.sort((a, b) => (a.host === "home" ? -1 : 0) - (b.host === "home" ? -1 : 0));
      } else {
        wo.sort((a, b) => a.pid - b.pid);
      }
      for (const ueberzaehlig of wo.slice(1)) {
        ns.kill(ueberzaehlig.pid);
        sag("Doppelte Instanz von " + datei + " auf " + ueberzaehlig.host
          + " beendet (pid " + ueberzaehlig.pid + "); " + wo[0].host
          + " behaelt sie.");
      }
    }

    // --- 2b1. Nachholer: TOR und Portknacker ----------------------------------
    //
    // Der Reset nimmt alle Programme ausser NUKE.exe mit, und der TOR-Router
    // ueberlebt ihn ebenfalls nicht. Ohne Portknacker sind von 87 Rechnern
    // acht erreichbar - ohne Einkommen keine Server, ohne Server keine
    // Rechenzeit. src/darkweb.js nennt das im Kopf "der Engpass nach jedem
    // Reset", und genau so war es: In BitNode 5 stand der Bot bei acht
    // Rechnern, bis der Kauf von Hand angestossen wurde.
    //
    // WARUM DER OBERFLAECHENWEG UND NICHT bn4life. bn4life kauft dasselbe
    // ueber Singularity und ist damit ausserhalb von BitNode 4 293,8 GB gross
    // - es laeuft im frischen Knoten stundenlang nicht. darkweb.js liest die
    // Oberflaeche ueber globalThis["document"]; der Zugriff kostet pauschal
    // 25 GB und ist vom BitNode voellig unabhaengig. Gemessen 27,65 GB, also
    // auf jedem 64-GB-Mietrechner startbar. Dieselbe Ueberlegung gilt fuer
    // homeram.js (30,4 GB statt 148,5 GB fuer homegrow.js).
    //
    // ABSTAND VON FUENF MINUTEN. darkweb.js wechselt die Seite im Spiel. Alle
    // zehn Sekunden gestartet, wuerde es die Oberflaeche unter den Haenden
    // wegziehen, waehrend jemand zusieht. Es beendet sich von selbst, sobald
    // das Geld fuer das naechste Programm nicht reicht - der Wiederanlauf
    // holt dann das nach, was inzwischen bezahlbar geworden ist.
    const PORTPROGRAMME = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe",
                           "HTTPWorm.exe", "SQLInject.exe"];
    const NACHHOL_ABSTAND_MS = 300000;
    if (PORTPROGRAMME.some((d) => !ns.fileExists(d, "home"))
        && Date.now() - nachholMerker > NACHHOL_ABSTAND_MS
        && !hosts.some((h) => {
          try { return ns.ps(h).some((pr) => pr.filename === "darkweb.js"); }
          catch { return false; }
        })) {
      const braucht = ns.getScriptRam("darkweb.js", "home");
      let wirt = null, meistFrei = 0;
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
          - (host === "home" ? reserveHome() : 0);
        if (frei > meistFrei) { meistFrei = frei; wirt = host; }
      }
      if (braucht > 0 && wirt && meistFrei >= braucht) {
        nachholMerker = Date.now();
        if (wirt !== "home") ns.scp("darkweb.js", wirt, "home");
        const pid = ns.exec("darkweb.js", wirt, 1);
        sag(pid ? "Portknacker nachkaufen: darkweb.js auf " + wirt
            + " (pid " + pid + ")."
          : "darkweb.js liess sich auf " + wirt + " nicht starten (exec gab 0).");
      } else if (runde % 30 === 0) {
        sag("Portknacker fehlen, aber darkweb.js (" + braucht.toFixed(1)
          + " GB) findet nirgends Platz.");
      }
    }

    if (werkbank) {
      const fehlend = WERKZEUGE.filter(([d]) => !laufend.includes(d));

      // Nur raeumen, wenn wirklich nichts von uns dort laeuft. Ein killall auf
      // eine belegte Werkbank wuerde den Vertragsloeser mitten im Durchlauf
      // erschlagen - und das alle zehn Sekunden erneut.
      const frei = () => ns.getServerMaxRam(werkbank) - ns.getServerUsedRam(werkbank);

      // Gezielt die Arbeiter raeumen, nicht pauschal alles. Ein killall haette
      // die laufenden Werkzeuge miterschlagen, ein Verzicht auf jede Raeumung
      // dagegen laesst ein fehlendes Werkzeug ewig draussen stehen: Genau so
      // lief bn4rep.js eine Zeitlang gar nicht mehr - gekillt, aber der Platz
      // fuer den Neustart war von Arbeitern belegt, und weil daneben
      // contracts.js lief, galt die Werkbank als "in Benutzung".
      //
      // Seit Hebel 1 (22.08.2026) liegen auf der Werkbank Hunderte GB
      // fliegende Arbeit statt gar nichts. Deshalb wird nicht mehr in einem
      // Rutsch alles erschlagen, sondern eine Arbeiterart nach der anderen,
      // und nur so lange, bis der Platz reicht. Die Reihenfolge ist nach
      // Verlustwert sortiert: share bringt seinen Nutzen laufend und faengt
      // beim Neustart ohne Verlust wieder an; ein abgebrochener weaken, grow
      // oder hack dagegen wirft seine gesamte bisherige Laufzeit weg, und
      // hack ist der einzige, der Geld bringt - er stirbt zuletzt.
      if (fehlend.length && werkbank !== "home") {
        for (const [datei] of fehlend) {
          const braucht = ns.getScriptRam(datei, "home");
          if (!(braucht > 0) || frei() >= braucht) continue;
          let geraeumt = 0;
          for (const w of ["worker/share.js", "worker/weaken.js", "worker/grow.js", "worker/hack.js"]) {
            if (frei() >= braucht) break;
            if (!ns.ps(werkbank).some((pr) => pr.filename === w)) continue;
            ns.scriptKill(w, werkbank);
            geraeumt++;
          }
          if (geraeumt) {
            sag(geraeumt + " Arbeiterart(en) auf " + werkbank + " geraeumt, "
              + datei + " braucht " + braucht.toFixed(1) + " GB.");
          }
          break;
        }
      }

      for (const [datei, args] of fehlend) {
        const braucht = ns.getScriptRam(datei, "home");
        // Nicht stillschweigend ueberspringen. Ein Werkzeug, das seit einer
        // halben Stunde fehlt, ohne dass irgendwo steht warum, ist genau das
        // Muster, das diesen Bot schon mehrfach stundenlang hat stillstehen
        // lassen. Die Drosselung auf alle zehn Runden haelt das Log lesbar.
        if (!(braucht > 0)) {
          if (runde % 10 === 0) sag(datei + " nicht lesbar (getScriptRam gibt 0).");
          continue;
        }
        if (frei() < braucht) {
          if (runde % 10 === 0) sag(datei + " wartet: " + werkbank + " hat "
            + frei().toFixed(1) + " von " + braucht.toFixed(1) + " GB frei.");
          continue;
        }
        // Abhaengigkeiten mitkopieren. ns.scp nimmt nur, was man ihm nennt -
        // fehlt eine importierte Datei auf dem Zielrechner, laesst sich das
        // Skript dort nicht uebersetzen und ns.exec gibt still 0 zurueck. Kein
        // Absturz, keine Meldung, das Werkzeug fehlt einfach.
        ns.scp([datei, ...BIBLIOTHEKEN], werkbank, "home");
        const pid = ns.exec(datei, werkbank, 1, ...args);
        sag(pid ? datei + " laeuft auf " + werkbank + " (pid " + pid + ")."
          : datei + " liess sich auf " + werkbank + " nicht starten (exec gab 0).");
      }
    }

    // --- 3. home ausbauen -----------------------------------------------------
    // Der wichtigste Posten des Laufs. Anders als beim Augmentierungs-Einbau
    // wird home beim BitNode-Wechsel auf 32 GB und einen Kern zurueckgesetzt
    // (Prestige.ts:243-249) - der Ausbau aus BitNode 1 ist ersatzlos weg.
    // Solange home klein ist, passt kein richtiger Autopilot hinein.
    //
    // AMORTISATION (23.08.2026). Bis hierher war die einzige Bedingung
    // "Geld > Kosten mal drei" - der home-Ausbau war die einzige Ausgabe der
    // ganzen Kette ohne Pruefung, ob der Speicher ueberhaupt gebraucht wird.
    // Der Mietrechner-Ausbau vierzig Zeilen weiter oben hat all das.
    //
    // Was das gekostet hat: die letzten beiden Verdopplungen schlugen mit
    // rund 131 Bio zu Buche, das sind 167 Mio je GB. Ein Mietrechner kostet
    // auf derselben Sprosse 409.000 je GB - Faktor 409. Fuer dasselbe Geld
    // waere der 25er-Park siebenmal komplett zu maximieren gewesen.
    //
    // Zwei Bremsen, beide aus dem Bestand:
    //   - was bn4rep fuer verdiente Augmentierungen zurueckgelegt hat, ist
    //     tabu (data/geldbedarf.txt, dieselbe Quelle wie beim Serverkauf)
    //   - liegt mehr als ein Drittel des Netzes brach, wird nicht gekauft.
    //     Speicher, fuer den es keinen Abnehmer gibt, ist kein Engpass.
    // AUSGELAGERT nach src/homegrow.js (23.08.2026). Der Ausbau stand hier,
    // mit vier Singularity-Aufrufen - und genau die haben den Bot am
    // Knotenuebergang unbrauchbar gemacht: SF4Cost (RamCostGenerator.ts:82-96)
    // gibt den Rabatt NUR in BitNode 4, ausserhalb kostet jeder Aufruf das
    // Sechzehnfache. Die 9 GB Grundpreis dieser vier Aufrufe waeren draussen
    // 144 GB gewesen; bn4net.js waere von 16 auf 160 GB gesprungen und haette
    // in das frische home mit 32 GB (Prestige.ts:241-247) nicht mehr
    // hineingepasst. boot.js haette zwanzig Minuten gewartet und aufgegeben.
    //
    // Ohne Singularity bleibt diese Datei portabel. Der Ausbau laeuft als
    // Werkzeug auf der Werkbank weiter (WERKZEUGE, homegrow.js) - dort stoert
    // sein Preis nicht, und Singularity wirkt spielerweit, nicht
    // rechnergebunden. Der brachAnteil geht unten mit hinaus, weil homegrow
    // ihn fuer die Amortisationsbremse braucht und ihn selbst nicht kennt.
    const brachAnteil = ramTotal > 0 ? ueberschussMerker / ramTotal : 0;

    // --- 4. Zustand nach draussen ---------------------------------------------
    const gerootet = hosts.filter((h) => ns.hasRootAccess(h));
    ns.write("data/bn4net.json", JSON.stringify({
      zeit: Date.now(),
      runde,
      netz: hosts.length,
      gerootet: gerootet.length,
      // Feld "ziel" bedeutet weiterhin das BESTE Geldziel (bisheriger Name
      // bleibt, damit tools/bn4.js unveraendert lesbar ist). Seit Stufe 2
      // (22.08.2026) laufen mehrere Geldziele gleichzeitig - siehe zieleAnzahl.
      ziel: moneyTargets[0] ?? null,
      expZiel: expTarget,
      zieleAnzahl: moneyTargets.length,
      // Seit Stufe 4 (22.08.2026) gibt es echtes HWGW-Batching: versetzte,
      // absolut terminierte Landungen mit reserviertem Speicher. Wieviele
      // Ziele so gefahren werden, steht in data/batch-ziele.txt und kann ohne
      // Neustart geaendert werden - das ist die Voraussetzung dafuer, den
      // Umbau ueberhaupt gegen den einfachen Betrieb messen zu koennen.
      batchModus: batchTargets.length > 0,
      batchZiele: batchTargets,
      stapel: batchStat,
      // Was in dieser Runde je Aktion neu vergeben wurde, plus die Zahl der
      // Ziele in der Anlaufphase und der nicht vergebene Netzspeicher.
      mischung: mixStat,
      homeRam: ns.getServerMaxRam("home"),
      homeFrei: ns.getServerMaxRam("home") - ns.getServerUsedRam("home"),
      brachAnteil,
      reserve: reserveHome(),
      fehlstart,
      werkbank,
      // Seit Hebel 1 kein pauschaler Ausschluss mehr, sondern eine Zahl - und
      // eine Zahl gehoert nach draussen, sonst merkt niemand, wenn sie
      // davonlaeuft.
      werkbankReserve: Math.round(werkbankReserve),
      // Der Deckel ist seit dem 22.08.2026 kein fester Wert mehr, sondern
      // haengt am Netz. Eine Groesse, die sich von selbst bewegt, gehoert
      // nach draussen - sonst merkt niemand, wenn sie irgendwohin laeuft.
      shareFaeden: shareStand,
      vertraege,
      geld: ns.getServerMoneyAvailable("home"),
      hacking: ns.getHackingLevel(),
    }), "w");

   } catch (e) {
    sag("RUNDENFEHLER: " + String(e));
   }
    await ns.sleep(10000);
  }
}

/**
 * Wieviele grow-Faeden bringen ein Guthaben von start auf ziel?
 *
 * Loest n = (o + x) * exp(k*x) nach x auf - dieselbe Gleichung wie das Spiel
 * (Server/ServerHelpers.ts:90), Newton-Raphson in Log-Form, mit demselben
 * Startwert. Der additive Anteil von $1 je Faden ist mit drin.
 *
 * ns.growthAnalyze taugt dafuer NICHT: numCycleForGrowth laesst genau diesen
 * additiven Term weg. Fuer growthAnalyze(host, 2) = ln2/k ist es dagegen
 * zulaessig, denn dort faellt der Term heraus - so kommt k unten in den
 * Stapelplan.
 *
 * Steht ausserhalb von main, weil es keine einzige ns-Funktion braucht und
 * damit 0 GB kostet.
 *
 * @param {number} k Wachstumsexponent EINES Fadens
 * @param {number} moneyMax Deckel
 * @param {number} start Guthaben jetzt
 * @param {number} ziel Wunschguthaben
 * @returns {number} ganze Faeden, 0 wenn nichts noetig ist
 */
function growFaeden(k, moneyMax, start, ziel) {
  if (!(k > 0)) return 0;
  const o = Math.max(0, start);
  const n = Math.min(ziel, moneyMax);
  if (!(n > o)) return 0;
  let x = (n - o) / (1 + (n / 16 + (15 * o) / 16) * k);
  let diff = Infinity, wache = 0;
  while (Math.abs(diff) > 1 && wache++ < 60) {
    const ox = o + x;
    const neu = (x - ox * Math.log(ox / n)) / (1 + ox * k);
    diff = neu - x;
    x = neu;
  }
  if (!Number.isFinite(x) || x < 0) return 0;
  let faeden = Math.ceil(x);
  if (faeden > 0) {
    const probe = (t) => (o + t) * Math.exp(k * t);
    if (probe(faeden - 1) >= n) faeden--;
    else if (probe(faeden) < n) faeden++;
  }
  return Math.max(0, faeden);
}

/**
 * Sucht Platz fuer eine Reihe von Auftraegen - oder liefert null, wenn auch
 * nur EINER nicht vollstaendig unterkommt.
 *
 * Alles-oder-nichts ist hier keine Feinheit, sondern die zentrale Sicherung
 * des ganzen Stapelbetriebs. Ein halber Stapel ist schlimmer als gar keiner:
 * der hack landet, das Guthaben faellt, und der grow, der es zurueckholen
 * sollte, wurde nie gestartet. Genau daraus entsteht ein Ziel, das langsam
 * ausblutet - und genau das ist beim Anheben von KAP_ABZUG passiert.
 *
 * Herkunft: inhaltsgleich mit placeOps aus src/lib/batch.js. Bewusst kopiert
 * statt importiert - lib/batch.js zieht lib/calc.js mit, und dessen Formeln
 * rechnen ohne die BitNode-4-Multiplikatoren (ScriptHackMoney 0.2). Ein
 * Import haette entweder eine stille Verfuenffachung der Beute je Faden
 * bedeutet oder einen Umbau an der Datei, an der der BitNode-1-Autopilot
 * haengt. Diese Funktion hier ist reine Behaelterpackerei und kennt weder
 * Spielformeln noch BitNode.
 *
 * @param {Map<string, number>} frei Rechner -> freie GB. Wird NICHT veraendert.
 * @param {{threads: number, cost: number}[]} ops
 * @returns {null | {belegung: {host: string, op: object, threads: number}[], frei: Map<string, number>}}
 */
function platziere(frei, ops) {
  const rest = new Map(frei);
  const belegung = [];
  for (const op of ops) {
    let offen = op.threads;
    if (offen < 1) continue;
    // Erst versuchen, den ganzen Auftrag auf EINEN Rechner zu legen, und zwar
    // auf den kleinsten, der ihn fasst. Das haelt die grossen Rechner fuer die
    // grossen Auftraege frei und vermeidet beim hack den Aufteilungsverlust:
    // zwei Bloecke a 10 % nehmen zusammen 19 %, nicht 20 %.
    let bester = null;
    for (const [host, platz] of rest) {
      if (Math.floor(platz / op.cost) < offen) continue;
      if (bester === null || platz < rest.get(bester)) bester = host;
    }
    if (bester !== null) {
      rest.set(bester, rest.get(bester) - offen * op.cost);
      belegung.push({ host: bester, op, threads: offen });
      continue;
    }
    // Passt nirgends am Stueck: aufteilen, groesste Rechner zuerst.
    for (const [host, platz] of [...rest.entries()].sort((a, b) => b[1] - a[1])) {
      if (offen <= 0) break;
      const passt = Math.floor(platz / op.cost);
      if (passt < 1) continue;
      const n = Math.min(passt, offen);
      rest.set(host, platz - n * op.cost);
      belegung.push({ host, op, threads: n });
      offen -= n;
    }
    if (offen > 0) return null;
  }
  return { belegung, frei: rest };
}
