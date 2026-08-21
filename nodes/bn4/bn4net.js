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
  // reichen nicht. bn4net.js belegt selbst 11 GB, bn4life.js braucht 18,35 -
  // zusammen 29,35 von 32. Wer nur 12 reserviert, laesst die Arbeiter die
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
  const reserveHome = () => Math.max(24, ns.getServerMaxRam("home") / 4);
  const WORKER = ["worker/weaken.js", "worker/grow.js", "worker/hack.js", "worker/share.js"];

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
      for (const gb of [1024, 512, 256, 128, 64]) {
        const preis = ns.cloud.getServerCost(gb);
        if (!(preis > 0)) continue;
        if (ns.getServerMoneyAvailable("home") - reserviert < preis * 4) continue;
        const name = ns.cloud.purchaseServer("werk-" + eigene.length, gb);
        if (name) sag("Rechner gekauft: " + name + " mit " + gb + " GB fuer "
          + (preis / 1e6).toFixed(2) + "m.");
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
    if (!werkbank) {
      const freiHome = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      if (freiHome >= 18) werkbank = "home";
    }
    werkbankMerker = werkbank;

    // --- 2. Ziel waehlen ------------------------------------------------------
    // Ohne den beruehmten Halbierungsfilter. "Nur Ziele bis zum halben Level"
    // ist eine Spaetspielregel; beim Neustart mit Hacking 1 ergibt sie die
    // Schwelle 0,5, an der selbst n00dles scheitert. Dann gibt es kein Ziel,
    // keinen Arbeiter, keine Erfahrung - und weil das Level nicht steigt, wird
    // die Schranke nie milder. Genau daran stand der Bot heute zwanzig Minuten.
    //
    // Kriterium ist Erfahrung je Sekunde, nicht Geld. Geld kommt bei diesem
    // Bot aus Coding Contracts (Abschnitt 1b), gebraucht wird ausschliesslich
    // das Hacking-LEVEL - siehe Kopfkommentar "WOZU HACKING HIER UEBERHAUPT
    // NOCH GUT IST". moneyMax/minDifficulty waere das richtige Kriterium fuer
    // einen Geld-Bot, nicht fuer diesen.
    //
    //   expGain  = 3 + 0.3 * baseDifficulty          (Hacking.ts:30-38)
    //   hackTime ~ (2.5 * requiredHackingSkill * minDifficulty + 500)
    //              / (hackingLevel + 50)
    //   wert     = expGain / hackTime
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
    let ziel = null, bester = 0;
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (!s.moneyMax || s.requiredHackingSkill > ns.getHackingLevel()) continue;
      const expGain = 3 + 0.3 * s.baseDifficulty;
      const hackTime = (2.5 * s.requiredHackingSkill * s.minDifficulty + 500)
        / (ns.getHackingLevel() + 50);
      const wert = expGain / hackTime;
      if (wert > bester) { bester = wert; ziel = host; }
    }

    let fehlstart = 0;
    if (ziel) {
      const s = ns.getServer(ziel);
      const skript = s.hackDifficulty > s.minDifficulty + 5 ? "worker/weaken.js"
        : s.moneyAvailable < s.moneyMax * 0.9 ? "worker/grow.js"
          : "worker/hack.js";
      const braucht = ns.getScriptRam(skript, "home");
      // getScriptRam gibt bei fehlender Datei still 0 zurueck
      // (NetscriptFunctions.ts:1179-1191). Ungeprueft ergaebe das
      // Math.floor(frei/0) = Infinity, und das Spiel wirft daraufhin eine
      // Ausnahme - die diese Schleife und damit den halben Bot beenden wuerde.
      if (!(braucht > 0)) { sag("worker-Skript nicht lesbar, Runde uebersprungen."); await ns.sleep(10000); continue; }

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
      const SHARE_DECKEL = 100;
      let shareGesamt = 0;

      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        if (host === werkbank) continue;   // bleibt fuer die Werkzeuge frei
        const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
          - (host === "home" ? reserveHome() : 0);
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

        if (!repModus) {
          if (shareLaeuft) ns.scriptKill("worker/share.js", host);
        } else if (shareBraucht > 0 && host !== "home") {
          const nochOffen = Math.max(0, SHARE_DECKEL - shareGesamt - shareLaeuft);
          const passt = Math.floor((frei * 0.5) / shareBraucht);
          const shareFaeden = Math.min(nochOffen, passt);
          if (shareFaeden >= 1) {
            if (ns.exec("worker/share.js", host, shareFaeden) === 0) fehlstart++;
            freiFuerSkript = frei - shareFaeden * shareBraucht;
          }
        }
        shareGesamt += shareLaeuft;

        const faeden = Math.floor(freiFuerSkript / braucht);
        if (faeden < 1) continue;
        // Die Argumente muessen zum Protokoll der Arbeiter passen: args[1] ist
        // dort die Verzoegerung in Millisekunden (worker/hack.js:38-40). Die
        // Rundennummer stand vorher genau dort - jede Aktion waere um die
        // Rundennummer verzoegert gestartet, nach einem Tag um 8,6 Sekunden,
        // nach drei Monaten um dreizehn Minuten. Sie gehoert ans Ende, wo sie
        // nur noch dazu dient, den Aufruf von seinem Vorgaenger zu
        // unterscheiden.
        if (ns.exec(skript, host, faeden, ziel, 0, 0, 0, runde) === 0) fehlstart++;
      }
    }

    if (fehlstart) sag(fehlstart + " Arbeiter liessen sich nicht starten (Speicher?).");

    // --- 2c. Werkzeuge betreiben ----------------------------------------------
    // Alles, was nicht Netz und nicht Spielfigur ist, laeuft auf der Werkbank.
    // Diese Liste ist zugleich der Wiederaufbauplan nach einem Reset: Ein
    // Augmentierungs-Einbau loescht saemtliche gekauften Rechner
    // (Prestige.ts:73 prestigeAllServers), home ueberlebt. Wer die Werkzeuge
    // von Hand starten muesste, haette nach jedem Reset einen toten Bot.
    const WERKZEUGE = [
      ["contracts.js", ["--loop", "300"]],
      ["bn4rep.js", []],
      ["bn4door.js", []],
      // Der Tonanker gehoert dazu, nicht danebem: Ein verborgener Browsertab
      // bekommt statt sechzehn Zeitgebern je Sekunde nur einen je Minute, und
      // ohne ihn laeuft der ganze Bot dreifach langsamer. Er lag bisher auf
      // einem gekauften Rechner - und die verschwinden bei jedem Einbau.
      ["wakelock.js", []],
    ];
    const BIBLIOTHEKEN = ["lib/hackaugs.js"];

    let vertraege = 0;
    for (const host of hosts) vertraege += ns.ls(host, ".cct").length;

    if (werkbank) {
      // Netzweit pruefen. Nur auf der Werkbank nachzusehen hiesse: Sobald ein
      // groesserer Rechner gekauft wird und die Werkbank wechselt, gilt jedes
      // Werkzeug als fehlend und wird ein zweites Mal gestartet - waehrend die
      // alte Instanz weiterlaeuft. Bei bn4rep.js waeren das zwei Steuerungen
      // fuer dieselbe Spielfigur, also genau der Fehler, den die
      // Aufgabenteilung verhindern soll.
      const laufend = [];
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        for (const pr of ns.ps(host)) laufend.push(pr.filename);
      }
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
      if (fehlend.length && werkbank !== "home") {
        for (const [datei] of fehlend) {
          const braucht = ns.getScriptRam(datei, "home");
          if (!(braucht > 0) || frei() >= braucht) continue;
          for (const w of WORKER) ns.scriptKill(w, werkbank);
          sag("Arbeiter auf " + werkbank + " geraeumt, " + datei + " braucht "
            + braucht.toFixed(1) + " GB.");
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
    const kosten = ns.singularity.getUpgradeHomeRamCost();
    if (ns.getServerMoneyAvailable("home") > kosten * 3) {
      if (ns.singularity.upgradeHomeRam()) {
        sag("home-Speicher verdoppelt auf " + ns.getServerMaxRam("home") + " GB.");
      }
    }

    // --- 4. Zustand nach draussen ---------------------------------------------
    const gerootet = hosts.filter((h) => ns.hasRootAccess(h));
    ns.write("data/bn4net.json", JSON.stringify({
      zeit: Date.now(),
      runde,
      netz: hosts.length,
      gerootet: gerootet.length,
      ziel,
      homeRam: ns.getServerMaxRam("home"),
      homeFrei: ns.getServerMaxRam("home") - ns.getServerUsedRam("home"),
      ausbauKosten: kosten,
      reserve: reserveHome(),
      fehlstart,
      werkbank,
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
