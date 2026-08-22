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

    // --- 2. Ziele waehlen (Erfahrung und mehrere Geldziele) --------------------
    // STUFE 2 (22.08.2026): frueher genau EIN Geldziel fuer das ganze Netz -
    // jeder Faden, der nicht auf ihm oder dem Erfahrungsziel landete, blieb
    // liegen, obwohl das Netz laengst mehr als ein Ziel gleichzeitig bedienen
    // kann. autopilot.js macht das seit jeher so (MAX_TARGETS/maxTargets,
    // autopilot.js:103 und :1173) und skaliert die Zielzahl am Netzspeicher
    // statt an einer festen Zahl - aus demselben Grund wie dort: eine feste
    // Zahl passt nur zu einer einzigen Ausbaustufe.
    const ramTotal = hosts.reduce((a, h) => a + (ns.hasRootAccess(h) ? ns.getServerMaxRam(h) : 0), 0);
    // Groessenordnung 3 bis 10, wie vorgegeben. 400 GB je Ziel ist eine
    // Hausnummer, keine Messung hier im BitNode-4-Netz - aber vorsichtig
    // gewaehlt: mehr Ziele als das Netz sinnvoll bedienen kann, verduennen
    // nur die Faeden je Ziel, ohne dass ein einziges davon reif wird.
    const MONEY_TARGET_COUNT = Math.max(3, Math.min(10, Math.floor(ramTotal / 400)));

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

      // moneyMax allein ueberschaetzt Server, deren Anforderung knapp unter dem
      // eigenen Level liegt. calculatePercentMoneyHacked (Hacking.ts:44-57)
      // enthaelt den Faktor
      //     skillMult = (level - (requiredHackingSkill - 1)) / level
      // der gegen null geht, je naeher die Anforderung am eigenen Level liegt.
      // Ohne ihn bekommt ein gerade erst erreichbarer Rechner den 310-fachen
      // Wert dessen, was er wirklich einbringt.
      const level = ns.getHackingLevel();
      const skillMult = (level - (s.requiredHackingSkill - 1)) / level;
      const difficultyMult = (100 - s.minDifficulty) / 100;
      const moneyValue = s.moneyMax * Math.max(0, skillMult) * difficultyMult / hackTime;
      if (moneyValue > 0) moneyCandidates.push({ host, moneyValue });
    }
    moneyCandidates.sort((a, b) => b.moneyValue - a.moneyValue);

    // Erfahrungsziel ausschliessen: es hat sein eigenes festes Fadenbudget
    // (EXP_THREAD_BUDGET weiter unten) und soll nicht zusaetzlich als Geldziel
    // zaehlen - sonst bekaeme derselbe Host zwei getrennte exec-Auftraege mit
    // je eigener Fadenzaehlung, ohne jeden Nutzen.
    let moneyTargets = moneyCandidates
      .filter((c) => c.host !== expTarget)
      .slice(0, MONEY_TARGET_COUNT)
      .map((c) => c.host);

    // Randbedingung: kein eigenstaendiges Geldziel gefunden (z. B. ganz am
    // Anfang, wenn ausser dem Erfahrungsziel noch nichts erreichbar ist) -
    // dann alles aufs Erfahrungsziel, wie zuvor. sameTarget loest den
    // Ein-Ziel-Fall unten aus.
    if (moneyTargets.length === 0 && expTarget) moneyTargets = [expTarget];
    const sameTarget = moneyTargets.length === 1 && moneyTargets[0] === expTarget;

    let fehlstart = 0;
    let mixStat = null;
    if (expTarget || moneyTargets.length) {
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
      // Alle drei Arbeiter werden jetzt in JEDER Runde gebraucht (Mischung
      // weiter unten), also werden auch alle drei geprueft.
      const ramHack = ns.getScriptRam("worker/hack.js", "home");
      const ramGrow = ns.getScriptRam("worker/grow.js", "home");
      const ramWeaken = ns.getScriptRam("worker/weaken.js", "home");
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
      const SHARE_DECKEL = 100;
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
      const EXP_THREAD_BUDGET = 180;
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
      const flight = new Map();
      for (const h of moneyTargets) flight.set(h, { hack: 0, grow: 0, weaken: 0 });
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        for (const pr of ns.ps(host)) {
          if (!WORKER.includes(pr.filename)) continue;
          if (pr.args[0] === expTarget) { expThreadsAssigned += pr.threads; continue; }
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
      const FORTIFY_HACK = 0.002;
      const FORTIFY_GROW = 0.004;
      const WEAKEN_POWER = 0.05;
      // Zielband. MIX_MONEY_HIGH ist der Fixpunkt der Regelung, nicht die
      // Obergrenze: darueber waere jeder grow-Faden verschenkt, weil
      // calculateGrowMoney (grow.ts:44-52) bei moneyMax abschneidet. Etwas
      // Luft nach oben zu lassen kostet 5 % Beute je Faden und spart mehr
      // als das an weggeworfenen grow-Faeden.
      const MIX_MONEY_HIGH = 0.95;
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
      // k faellt daraus exakt heraus. Der dritte Parameter (cores) ist 1 -
      // richtig so, denn die Arbeiter laufen fast alle auf Fremdrechnern mit
      // einem Kern.
      const planMix = (host) => {
        const s = ns.getServer(host);
        const secOver = Math.max(0, s.hackDifficulty - s.minDifficulty);
        const moneyFrac = s.moneyMax > 0 ? clamp01(s.moneyAvailable / s.moneyMax) : 0;
        const p = ns.hackAnalyze(host);
        const chance = ns.hackAnalyzeChance(host);
        const cycles = ns.growthAnalyze(host, 2);
        const k = cycles > 0 ? Math.LN2 / cycles : 0;
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
          return {
            anlauf: true,
            bedarf: {
              hack: 0,
              grow: Math.max(0, growNeed - f.grow),
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
        let restZiele = moneyTargets.length;
        for (const ziel of moneyTargets) {
          if (restZiele <= 0) break;
          // Gleicher Anteil je Ziel, Rest kaskadiert - wie bisher. Ein Ziel in
          // der Anlaufphase nimmt nur, was es braucht; was es liegen laesst,
          // kommt den folgenden Zielen zugute.
          const anteil = budget / restZiele;
          restZiele--;
          let plan;
          try {
            plan = planMix(ziel);
          } catch (e) {
            // Nicht stillschweigend ueberspringen. Wirft hackAnalyze oder
            // growthAnalyze fuer ein Ziel dauerhaft, faellt dieses Ziel sonst
            // fuer immer aus, ohne dass irgendwo etwas davon steht - genau
            // das Muster, das diesen Bot schon mehrfach stundenlang hat
            // stillstehen lassen. Gedrosselt, damit das Log lesbar bleibt.
            if (runde % 10 === 0) sag("planMix(" + ziel + ") warf: " + String(e));
            continue;
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
        mixStat = { ...summeFaeden, anlaufZiele, restGb: Math.round(budget) };
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
      // Feld "ziel" bedeutet weiterhin das BESTE Geldziel (bisheriger Name
      // bleibt, damit tools/bn4.js unveraendert lesbar ist). Seit Stufe 2
      // (22.08.2026) laufen mehrere Geldziele gleichzeitig - siehe zieleAnzahl.
      ziel: moneyTargets[0] ?? null,
      expZiel: expTarget,
      zieleAnzahl: moneyTargets.length,
      // Echtes HWGW-Batching (versetzte Landung ganzer Wellen) ist weiterhin
      // NICHT gebaut - Stufe 3 mischt die Aktionen nur im richtigen
      // Verhaeltnis, ohne die Landezeitpunkte zu takten.
      batchModus: false,
      // Was in dieser Runde je Aktion neu vergeben wurde, plus die Zahl der
      // Ziele in der Anlaufphase und der nicht vergebene Netzspeicher.
      mischung: mixStat,
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
