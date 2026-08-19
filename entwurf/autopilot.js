import * as calc from "lib/calc";
import * as batch from "lib/batch";

/** Ueber diesen Netscript-Port bekommt der Verwalter die Sperrkasse gemeldet. */
const RESERVE_PORT = 1;

/**
 * Der Autopilot.
 *
 * Laeuft dauerhaft, verschafft sich Zugriff auf das Netz, verteilt Arbeiter
 * und erntet Geld. Alles, was er entscheidet, schreibt er sichtbar in sein
 * eigenes Fenster im Spiel - das ist Absicht: man soll ihm beim Denken
 * zusehen koennen, nicht nur beim Verdienen.
 *
 * Aufbau einer Runde:
 *   1. Netz abgehen und alles knacken, was knackbar ist
 *   2. Arbeiter auf jeden Rechner mit Speicher kopieren
 *   3. Ziele bewerten
 *   4. Ziele vorbereiten, vorbereitete Ziele in Stapeln abschoepfen
 *
 * Zum Ernten siehe den Block "HWGW-Stapel" weiter unten.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  ns.ui.openTail();
  ns.ui.setTailTitle?.("Autopilot");
  ns.ui.resizeTail(760, 560);
  ns.ui.moveTail(20, 20);
  // Eingeklappt starten: Das Fenster soll da sein, wenn man hineinsehen will,
  // aber nicht bei jedem Neustart ungefragt den halben Bildschirm belegen.
  ns.ui.setTailMinimized?.(true);

  const WORKERS = ["worker/hack.js", "worker/grow.js", "worker/weaken.js"];
  const SCRIPTS = { hackT: "worker/hack.js", growT: "worker/grow.js", weakenT: "worker/weaken.js" };
  // Kleiner Puffer auf home. Bewusst klein: Der Autopilot selbst steckt
  // bereits in getServerUsedRam - wer hier nochmal seine vollen 7 GB abzieht,
  // rechnet ihn doppelt und verschenkt den halben Heimrechner.
  const HOME_RESERVE = 2;
  // So viele Ziele gleichzeitig in Stapeln abschoepfen. Ein einzelnes Ziel
  // kann nur eine begrenzte Menge Speicher binden (siehe chooseFraction) -
  // waechst die Flotte, ist Breite der einzige Weg, sie auszulasten. Werte
  // von Argus uebernommen (Stand 07fa272); sie wirken faktisch als "alle
  // lohnenden Ziele", was mit Stapelbetrieb genau richtig ist.
  const MAX_TARGETS = 60;
  // So viele Ziele gleichzeitig VORBEREITEN. Der Bedarf der Vorbereitung ist
  // endlich, sie laeuft also nur einmal je Ziel voll auf und uebergibt danach
  // an den Stapelbetrieb. Bei 164 TB freiem Speicher ist Breite hier billig.
  const PREP_TARGETS = 40;

  // ---------------------------------------------------------------------
  // HWGW-Stapel
  //
  // Ein Stapel sind vier Auftraege, die nacheinander landen: hack, weaken,
  // grow, weaken. Der hack trifft dadurch IMMER ein Ziel auf Hoechstguthaben
  // und Mindestsicherheit - genau dort, wo Beuteanteil, Erfolgswahrschein-
  // lichkeit und Tempo am besten sind. Und weil die Stapel ineinander
  // geschachtelt starten, sind Dutzende gleichzeitig unterwegs; erst das
  // fuellt eine grosse Flotte aus. Die alte Fassung schickte je Ziel eine
  // Welle und wartete dann eine ganze weaken-Zeit auf deren Landung, was bei
  // 21 TB Flotte weniger als ein Fuenftel des Speichers beschaeftigt hat.
  // ---------------------------------------------------------------------

  // Abstand zwischen zwei Landungen desselben Stapels.
  //
  // Der einzige wirklich heikle Wert. Zu klein, und schon eine um 300 ms
  // verrutschte Landung dreht die Reihenfolge um - in der Simulation faellt
  // das Guthaben dann binnen Minuten auf null, es ist KEIN sanfter Abfall.
  // Zu gross, und der Kalender wird zum Engpass: jeder Stapel belegt 4*gap
  // Kalenderzeit, in eine weaken-Zeit passen also nur tWeaken/(4*gap) Stapel.
  // 400 ms hat in der Simulation 300 ms Streuung unbeschadet ueberstanden und
  // kostet gegenueber dem Optimum (100 ms, aber ohne jede Reserve) rund 10 %.
  const GAP_MS = 400;
  // Kleiner Vorlauf, damit der zuletzt landende weaken beim Start nicht schon
  // ueberfaellig ist. Ohne ihn waere seine additionalMsec negativ, das Spiel
  // deckelt auf 0, und der Auftrag landet zu spaet.
  const SLACK_MS = 200;
  // Wie weit vor seinem Starttermin ein Stapel losgeschickt werden darf.
  // Etwas mehr als eine Rundenlaenge - sonst faellt bei einer langsamen Runde
  // ein Kalenderplatz ersatzlos aus.
  const LEAD_MS = 1200;
  // Aufschlag auf beide Ausgleichsauftraege. Ueberzaehlige weaken-Threads sind
  // wirkungslos (die Sicherheit ist nach unten gedeckelt), zu wenige dagegen
  // lassen nach jedem Stapel einen Rest stehen, der sich aufschaukelt.
  const WEAKEN_MARGIN = 1.5;
  const FRACTION_MIN = 0.01;
  // Ueber 0.5 lohnt sich nichts mehr: hack nimmt linear weg, grow muss
  // multiplikativ zurueckholen. Bei f=0.7 war der Ertrag in der Simulation
  // durchweg schlechter als bei f=0.4, bei doppeltem Speicherbedarf.
  const FRACTION_MAX = 0.5;
  // Bremsen gegen Ausreisser. Im eingeschwungenen Zustand vergibt ein Ziel
  // einen Stapel je 4*gap, also gut einen halben je Sekunde - die Grenzen
  // greifen nur beim Anlaufen, wenn ein leerer Kalender auf einen Schlag
  // gefuellt wuerde. Ohne sie kaeme man bei 60 Zielen auf mehrere tausend
  // exec-Aufrufe in einer einzigen Runde, und die Runde ist eine Sekunde lang.
  // Ein langsamer gefuellter Kalender kostet nichts ausser ein paar Sekunden
  // Anlauf.
  const MAX_BATCHES_PER_ROUND = 12;
  const MAX_BATCHES_TOTAL = 80;

  // Drifterkennung. In einem gesunden Stapelbetrieb faellt die Sicherheit nach
  // jedem Stapel exakt auf secMin zurueck und das Guthaben auf das Maximum.
  // Beobachtet wird deshalb nicht der Mittelwert, sondern das MINIMUM ueber
  // ein Zeitfenster: wenn selbst der beste Moment der letzten halben Minute
  // deutlich daneben liegt, stimmt die Kette nicht mehr.
  const DRIFT_WINDOW = 30;
  const DRIFT_SEC = 1.0;

  // Eigener Quelltext beim Start. Aendert er sich, ist eine neue Fassung
  // eingetroffen - dann beendet sich dieser Prozess, und der Verwalter auf
  // dem Nachbarrechner startet die neue Fassung.
  const ownSource = ns.read("autopilot.js");
  // Auch den Quelltext des Verwalters mitverfolgen. Er selbst kann eine neue
  // Fassung nicht erkennen (ns.read liest vom Rechner, auf dem man laeuft, und
  // er laeuft woanders) - der Autopilot dagegen sitzt auf home, wo die
  // massgebliche Fassung liegt. Also uebernimmt er das Nachhalten.
  let investSource = ns.read("invest.js");

  const startedAt = Date.now();
  const events = [];
  const knownFiles = new Set();
  // Zustand je Ziel ueber Rundengrenzen hinweg: "prep" | "batch" | "drain".
  const phases = new Map();
  let round = 0;
  let lastTarget = null;
  let earned = 0;
  let marke = 0;
  let moneyAtStart = ns.getServerMoneyAvailable("home");
  // Gleitender Schnitt ueber den erwarteten Geldwert der zuletzt eingeplanten
  // Stapel. Im eingeschwungenen Zustand ist die Einplanungsrate gleich der
  // Landerate, also ist das die erwartete Einnahme je Sekunde. Der Vergleich
  // mit dem tatsaechlichen Zuwachs ist die schaerfste Betriebskontrolle, die
  // wir haben: klaffen die beiden dauerhaft auseinander, landen Stapel in der
  // falschen Reihenfolge, ohne dass es sonst irgendwo auffiele.
  const geldFenster = [];

  /** Merkt sich eine Entscheidung fuer die Anzeige. */
  const note = (text) => {
    events.push({ at: Date.now(), text });
    if (events.length > 12) events.shift();
  };

  const phaseOf = (host) => {
    let st = phases.get(host);
    if (!st) {
      st = { phase: "prep", samples: [], fraction: FRACTION_MIN, batches: 0, ram: 0 };
      phases.set(host, st);
    }
    return st;
  };

  note("Autopilot gestartet");

  while (true) {
    round++;
    try {

    const player = playerFacts(ns);
    const hosts = scanAll(ns);

    // Sperrkasse an den Verwalter durchreichen. Er laeuft auf einem fremden
    // Rechner und koennte die Datei auf home gar nicht lesen - Ports sind
    // dagegen global und kosten nichts.
    let reserve = 0;
    if (ns.fileExists("data/reserve.txt", "home")) {
      const roh = Number(ns.read("data/reserve.txt"));
      if (Number.isFinite(roh) && roh >= 0) reserve = roh;
    }
    ns.clearPort(RESERVE_PORT);
    ns.tryWritePort(RESERVE_PORT, reserve);

    // Das Spiel schiebt Programme und Nachrichten unangekuendigt auf home -
    // Story-Meilensteine wie fl1ght.exe, aber auch Hinweise auf freigeschaltete
    // Moeglichkeiten. Als Popup gehen sie leicht unter, deshalb landen sie hier
    // im Verlauf, wo sie stehen bleiben.
    for (const f of ns.ls("home")) {
      if (knownFiles.has(f)) continue;
      knownFiles.add(f);
      if (round === 1) continue; // beim Start nur den Bestand merken
      if (/\.(exe|msg|lit|cct)$/.test(f)) note("Neu auf home: " + f);
    }

    // --- 1. Zugriff verschaffen -------------------------------------------
    for (const host of hosts) {
      if (host === "home" || ns.hasRootAccess(host)) continue;
      if (tryCrack(ns, host)) note("Zugriff auf " + host + " erlangt");
    }

    // --- 2. Lage aufnehmen -------------------------------------------------
    const servers = [];
    for (const host of hosts) {
      const root = ns.hasRootAccess(host);
      const ram = ns.getServerMaxRam(host);
      const moneyMax = ns.getServerMaxMoney(host);
      servers.push({
        host,
        root,
        ram,
        ramFree: Math.max(0, ram - ns.getServerUsedRam(host) - (host === "home" ? HOME_RESERVE : 0)),
        moneyMax,
        moneyNow: moneyMax > 0 ? ns.getServerMoneyAvailable(host) : 0,
        sec: ns.getServerSecurityLevel(host),
        secMin: ns.getServerMinSecurityLevel(host),
        growth: moneyMax > 0 ? ns.getServerGrowth(host) : 0,
        reqSkill: ns.getServerRequiredHackingLevel(host),
      });
    }

    // --- 3. Arbeiter ausliefern -------------------------------------------
    // Die Arbeiter werden bei JEDEM Start neu ausgeliefert, nicht nur wenn sie
    // fehlen. Sonst erreicht geaenderter Arbeitercode die Flotte nie - die
    // alte Fassung ist ja "vorhanden". Eine Fassung auf einem fremden Rechner
    // laesst sich nicht pruefen (ns.read kennt keinen Host-Parameter), also
    // wird stumpf ueberschrieben. Da der Autopilot sich bei jeder Aenderung
    // seines Quelltexts selbst neu startet, sitzt danach ueberall der aktuelle
    // Stand. In den Folgerunden nur noch neu hinzugekommene Rechner bedienen.
    const workforce = servers.filter((s) => s.root && s.ram > 0);
    for (const s of workforce) {
      if (s.host === "home") continue;
      if (round === 1 || !ns.fileExists("worker/weaken.js", s.host)) {
        ns.scp(WORKERS, s.host, "home");
      }
    }

    // Der Einkaeufer muss laufen - er besorgt den Speicher, von dem alles
    // andere abhaengt. Er lebt auf einem fremden Rechner, weil allein
    // ns.cloud.purchaseServer 2.25 GB kostet und home damit gesprengt waere.
    const investRam = ns.getScriptRam("invest.js", "home");
    const investNeu = ns.read("invest.js");
    const investVeraltet = round === 1 || investNeu !== investSource;
    if (investNeu !== investSource) {
      note("Neue Fassung des Verwalters - wird ausgetauscht");
      investSource = investNeu;
    }

    let investLives = false;
    for (const s of workforce) {
      const laeuft = ns.ps(s.host).find((p) => p.filename === "invest.js");
      if (!laeuft) continue;
      // Veralteten Verwalter abraeumen. Er selbst kann das nicht merken -
      // ns.read liest immer vom eigenen Rechner, und dort liegt seine alte
      // Kopie, die sich nie aendert.
      if (investVeraltet) {
        ns.kill(laeuft.pid);
        // Den frei gewordenen Speicher sofort mitschreiben. Ohne das haelt der
        // Autopilot den Rechner weiter fuer belegt, findet nirgends Platz fuer
        // den Verwalter - und raeumt zur Strafe einen fremden Rechner leer.
        s.ramFree += investRam;
        continue;
      }
      investLives = true;
      break;
    }
    if (!investLives && investRam > 0) {
      let wirt = workforce
        .filter((s) => s.host !== "home" && s.ramFree >= investRam)
        .sort((a, b) => b.ramFree - a.ramFree)[0];

      // Wenn die Arbeiter jeden Winkel belegen, kommt der Einkaeufer nie zum
      // Zug - und ohne ihn waechst der Speicher nie. Also hat er Vorrang:
      // ein Rechner wird notfalls freigeraeumt.
      if (!wirt) {
        wirt = workforce
          .filter((s) => s.host !== "home" && s.ram >= investRam)
          .sort((a, b) => a.ram - b.ram)[0];
        if (wirt) {
          ns.killall(wirt.host);
          wirt.ramFree = wirt.ram;
          note("Platz fuer den Einkaeufer geschaffen auf " + wirt.host);
        }
      }

      if (wirt) {
        ns.scp("invest.js", wirt.host, "home");
        if (ns.exec("invest.js", wirt.host)) {
          wirt.ramFree -= investRam;
          investLives = true;
          note("Einkaeufer laeuft jetzt auf " + wirt.host);
        }
      }
    }

    // --- 4. Laufende Arbeit aufnehmen -------------------------------------
    // Erst nachsehen, wer schon fuer wen arbeitet - VOR jeder neuen
    // Entscheidung. Nebenbei entsteht dabei der KALENDER: der spaeteste
    // bereits vergebene Landetermin je Ziel.
    //
    // Der Kalender liegt bewusst nirgendwo sonst. Er steht in den Argumenten
    // der laufenden Arbeiter und wird jede Runde daraus neu gelesen. Damit
    // uebersteht er einen Neustart des Autopiloten ohne jede Vorkehrung: die
    // Arbeiter laufen weiter, ihre Termine stehen weiter in ns.ps, und die
    // neue Fassung setzt die Kette genau dort fort. Eine Datei oder eine
    // Variable im Speicher waere nach jedem Austausch verloren - und ein
    // Stapel, der auf einen vergessenen Termin gesetzt wird, landet mitten in
    // einen fremden Stapel hinein.
    const busy = { hackT: 0, growT: 0, weakenT: 0 };
    const busyPerTarget = new Map();
    const calendar = new Map();
    const ART = {
      "worker/hack.js": "hackT",
      "worker/grow.js": "growT",
      "worker/weaken.js": "weakenT",
    };
    for (const s of workforce) {
      for (const proc of ns.ps(s.host)) {
        const art = ART[proc.filename];
        if (!art) continue;
        busy[art] += proc.threads;
        const ziel = String(proc.args[0] ?? "?");
        if (!busyPerTarget.has(ziel)) busyPerTarget.set(ziel, { hackT: 0, growT: 0, weakenT: 0 });
        busyPerTarget.get(ziel)[art] += proc.threads;
        const landAt = Number(proc.args[2]);
        if (Number.isFinite(landAt) && landAt > 0) {
          calendar.set(ziel, Math.max(calendar.get(ziel) ?? 0, landAt));
        }
      }
    }

    // --- 5. Ziele bewerten -------------------------------------------------
    // Fuer die Bewertung zaehlt der GESAMTE Arbeitsspeicher, nicht der gerade
    // freie: beim Zielwechsel werden die Arbeiter ohnehin abgezogen. Wer hier
    // mit dem freien Speicher rechnet, haelt jedes neue Ziel faelschlich fuer
    // unerreichbar, sobald das alte gut ausgelastet ist.
    const ramNow = workforce.reduce((a, s) => a + s.ramFree, 0);
    const ramTotal = Math.max(2, workforce.reduce((a, s) => a + s.ram, 0) - HOME_RESERVE);
    const candidates = servers
      .filter((s) => s.root && s.moneyMax > 0 && s.reqSkill <= player.skill)
      .map((s) => ({
        ...s,
        score: calc.targetScore(s, player),
        yield: calc.expectedYield(s, player, ramTotal),
        prep: calc.prepSeconds(s, player, ramTotal),
        busy: busyPerTarget.get(s.host) ?? { hackT: 0, growT: 0, weakenT: 0 },
      }))
      .filter((s) => s.score > 0);

    const target = [...candidates].sort((a, b) => b.yield - a.yield)[0] ?? null;
    if (target && target.host !== lastTarget) {
      note("Bestes Ziel ist jetzt " + target.host + " (" + geld(target.score) + "/s)");
      lastTarget = target.host;
    }

    // --- 6. Zustandswechsel je Ziel ---------------------------------------
    // Ein Ziel ist entweder in Vorbereitung, im Stapelbetrieb, oder es laeuft
    // gerade aus, weil etwas nicht stimmt. Dazwischen gibt es nichts: ein
    // halb vorbereitetes Ziel zu hacken ist genau der Fehler, den die Stapel
    // vermeiden sollen.
    for (const c of candidates) {
      const st = phaseOf(c.host);
      const laeuft = c.busy.hackT + c.busy.growT + c.busy.weakenT;

      if (st.phase === "batch") {
        st.samples.push({ sec: c.sec, money: c.moneyMax > 0 ? c.moneyNow / c.moneyMax : 0 });
        if (st.samples.length > DRIFT_WINDOW) st.samples.shift();
        if (st.samples.length >= DRIFT_WINDOW) {
          let secFloor = Infinity, moneyFloor = Infinity;
          for (const p of st.samples) {
            if (p.sec < secFloor) secFloor = p.sec;
            if (p.money < moneyFloor) moneyFloor = p.money;
          }
          // Untergrenze fuer das Guthaben: im gesunden Betrieb faellt es nie
          // unter (1 - f), denn genau so viel nimmt ein Stapel weg. Der Faktor
          // 0.5 laesst Platz fuer zwei Stapel, die sich einmal ueberholen.
          const grenze = Math.max(0.05, (1 - st.fraction) * 0.5);
          if (secFloor > c.secMin + DRIFT_SEC || moneyFloor < grenze) {
            st.phase = "drain";
            st.samples.length = 0;
            note(c.host + " laeuft aus der Reihe - Stapel werden angehalten");
          }
        }
      }

      if (st.phase === "drain" && laeuft === 0) {
        st.phase = "prep";
      }

      // Aufstieg in den Stapelbetrieb nur aus dem Vollzustand heraus, und erst
      // wenn kein grow mehr unterwegs ist: ein landender grow hebt die
      // Sicherheit und wuerde die ersten Stapel verrutschen lassen.
      if (
        st.phase === "prep" &&
        c.sec <= c.secMin + 0.001 &&
        c.moneyNow >= c.moneyMax * 0.999 &&
        c.busy.growT === 0
      ) {
        st.phase = "batch";
        st.samples.length = 0;
        note(c.host + " ist vorbereitet - Stapelbetrieb beginnt");
      }
    }

    // --- 7. Rangfolge ------------------------------------------------------
    // Ziele im Stapelbetrieb zuerst: die zahlen sofort. Was danach an Speicher
    // uebrig ist, geht in die Vorbereitung des naechstbesten. Vorbereitung
    // wird nach Ertrag JE THREAD sortiert, nicht nach Ertrag allein - sonst
    // frisst der fetteste Server eine halbe Stunde lang allen Speicher.
    const restBedarf = (s) => {
      let n = calc.weakenThreads(Math.max(0, s.sec - s.secMin));
      if (s.moneyNow < s.moneyMax) {
        const g = calc.growThreads(s, s.moneyMax, Math.max(1, s.moneyNow), player, 1);
        if (Number.isFinite(g)) n += g;
      }
      return Math.max(1, n);
    };
    for (const c of candidates) c.rest = restBedarf(c);

    const imStapel = candidates
      .filter((c) => phaseOf(c.host).phase === "batch")
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TARGETS);
    const inVorbereitung = candidates
      .filter((c) => phaseOf(c.host).phase === "prep")
      .sort((a, b) => b.score / b.rest - a.score / a.rest)
      .slice(0, PREP_TARGETS);
    const active = [...imStapel, ...inVorbereitung];
    // Ziele, die aus der Rangfolge gefallen sind, aber noch Arbeiter haben,
    // muessen in der Anzeige mitlaufen - sonst sieht man nicht, wo der
    // Speicher steckt.
    for (const c of candidates) {
      if (active.includes(c)) continue;
      if (c.busy.hackT + c.busy.growT + c.busy.weakenT > 0) active.push(c);
    }

    const plan = [];

    // --- 8. Vorbereitung ---------------------------------------------------
    // Zuerst, und zwar bewusst: der Bedarf der Vorbereitung ist endlich (eine
    // feste Threadzahl bis zum Vollzustand), der Bedarf der Stapel dagegen
    // unbegrenzt. Wer die Stapel zuerst bedient, bereitet nie wieder ein Ziel
    // vor. Umgekehrt kann die Vorbereitung die Stapel nicht aushungern.
    //
    // Anders als frueher wird bis EXAKT auf secMin und moneyMax vorbereitet,
    // nicht nur auf "drei Punkte Toleranz und 90 %". Der Stapelbetrieb setzt
    // den exakten Zustand voraus.
    for (const t of inVorbereitung) {
      t.doing = "vorbereiten";
      let growT = 0;
      if (t.moneyNow < t.moneyMax) {
        const voll = calc.growThreads(t, t.moneyMax, Math.max(1, t.moneyNow), player, 1);
        if (Number.isFinite(voll)) growT = Math.max(0, voll - t.busy.growT);
      }
      // Ausgleich fuer den vorhandenen UND den geplanten grow, plus die
      // Sicherheit, die jetzt schon zu viel ist. Lieber ein weaken zu viel:
      // ueberzaehlige Threads richten keinen Schaden an, die Sicherheit ist
      // nach unten gedeckelt (Server.ts:91).
      const secBedarf =
        Math.max(0, t.sec - t.secMin) + (t.busy.growT + growT) * calc.GROW_FORTIFY_AMOUNT;
      const weakenT = Math.max(0, calc.weakenThreads(secBedarf) - t.busy.weakenT);
      if (weakenT > 0) {
        const n = deploy(ns, workforce, SCRIPTS.weakenT, weakenT, t.host, marke++);
        plan.push({ host: t.host, what: "weaken", threads: n, need: weakenT });
      }
      if (growT > 0) {
        const n = deploy(ns, workforce, SCRIPTS.growT, growT, t.host, marke++);
        plan.push({ host: t.host, what: "grow", threads: n, need: growT });
      }
    }

    // --- 9. Stapel losschicken --------------------------------------------
    const ramCost = {
      hackT: ns.getScriptRam(SCRIPTS.hackT, "home"),
      growT: ns.getScriptRam(SCRIPTS.growT, "home"),
      weakenT: ns.getScriptRam(SCRIPTS.weakenT, "home"),
    };
    let stapelGesamt = 0;
    let geldGeplant = 0;

    // Zwei Durchgaenge. Im ersten bekommt jedes Ziel seinen nach Ertrag
    // gewichteten Anteil - so kommt auch das zweitbeste zum Zug. Im zweiten
    // darf das beste Ziel den Rest nehmen, falls die anderen ihren Anteil
    // nicht verbrauchen konnten. Denn ein Ziel kann nur begrenzt viel
    // Speicher binden: mehr als tWeaken/(4*gap) Stapel passen nicht in seinen
    // Kalender, egal wie viel frei ist.
    for (const durchgang of [1, 2]) {
      const freiZuBeginn = workforce.reduce((a, s) => a + s.ramFree, 0);
      if (freiZuBeginn < 10) break;
      const summe = imStapel.reduce((a, t) => a + Math.max(1e-9, t.score), 0);

      for (const t of imStapel) {
        const st = phaseOf(t.host);
        // Im zweiten Durchgang wird der Rest jedes Mal neu ermittelt - sonst
        // bekaeme das zweite Ziel ein Budget zugeteilt, das das erste laengst
        // aufgebraucht hat, und die Platzierung liefe ins Leere.
        const budget = durchgang === 1
          ? freiZuBeginn * (Math.max(1e-9, t.score) / summe)
          : workforce.reduce((a, s) => a + s.ramFree, 0);
        if (budget < 10) continue;

        const wahl = batch.chooseFraction(t, player, budget, {
          gapMs: GAP_MS,
          secNow: t.sec,
          weakenMargin: WEAKEN_MARGIN,
          ram: ramCost,
          min: FRACTION_MIN,
          max: FRACTION_MAX,
        });
        if (!wahl) continue;
        st.fraction = wahl.fraction;
        const p = wahl.plan;

        let kalender = calendar.get(t.host) ?? 0;
        let verbraucht = 0;
        let gestartet = 0;

        while (
          gestartet < MAX_BATCHES_PER_ROUND &&
          stapelGesamt < MAX_BATCHES_TOTAL &&
          verbraucht + p.ram <= budget
        ) {
          // Sicherheit unmittelbar vor dem Start neu ablesen, nicht die zu
          // Rundenbeginn gemessene verwenden. Dazwischen liegen die Scans des
          // ganzen Netzes; in dieser Zeit kann ein Auftrag gelandet sein und
          // die Sicherheit angehoben haben. Aus einer veralteten Laufzeit wird
          // eine negative additionalMsec, das Spiel deckelt sie auf 0, der
          // Auftrag landet zu spaet - und der naechste noch spaeter.
          const zeiten = batch.opTimes(t, player, ns.getServerSecurityLevel(t.host));
          const jetzt = Date.now();
          // Der zuletzt landende weaken hat die laengste Laufzeit. Frueher als
          // (jetzt + tWeaken) kann er nicht landen, also darf der hack - der
          // 3*gap vor ihm liegt - nicht frueher angesetzt werden.
          const frueheste = jetzt + zeiten.tWeaken - 3 * GAP_MS + SLACK_MS;
          const landHack = Math.max(kalender + GAP_MS, frueheste);
          // Gehoert dieser Stapel schon in diese Runde? Massgeblich ist, ob
          // sein letzter weaken jetzt startbar ist.
          if (landHack + 3 * GAP_MS - zeiten.tWeaken > jetzt + LEAD_MS) break;

          const platz = () =>
            workforce.filter((s) => s.ramFree >= 1).map((s) => ({ host: s.host, frei: s.ramFree }));
          let pEff = p;
          let ops = batch.batchOps(p, t.host, landHack, GAP_MS, SCRIPTS, ramCost, zeiten);
          let belegung = batch.placeOps(platz(), ops);
          if (!belegung) break;

          // Musste der hack auf mehrere Rechner aufgeteilt werden? Dann nehmen
          // die Bloecke nacheinander vom bereits verkleinerten Guthaben und
          // holen zusammen WENIGER als geplant. Einmal nachrechnen, sonst legt
          // der grow blind zu viel nach - der Deckel frisst es, die Threads
          // sind trotzdem bezahlt.
          const stuecke = belegung.placements.filter((x) => x.op === ops[0]).map((x) => x.threads);
          if (stuecke.length > 1) {
            const p2 = batch.batchPlan(t, player, {
              fraction: wahl.fraction,
              secNow: t.secMin,
              weakenMargin: WEAKEN_MARGIN,
              ram: ramCost,
              hackChunks: stuecke,
            });
            const ops2 = p2 ? batch.batchOps(p2, t.host, landHack, GAP_MS, SCRIPTS, ramCost, zeiten) : null;
            const b2 = ops2 ? batch.placeOps(platz(), ops2) : null;
            if (b2) { pEff = p2; ops = ops2; belegung = b2; }
          }

          // Festschreiben - und zwar den hack ZULETZT. Sollte ein exec
          // scheitern (fremdes Skript belegt in derselben Millisekunde den
          // Platz), fehlt dann hoechstens die Beute. Waere der hack zuerst
          // gestartet, koennte ihm der grow fehlen - und genau daraus wird ein
          // Ziel, das langsam ausblutet.
          let abbruch = false;
          for (const op of [ops[1], ops[2], ops[3], ops[0]]) {
            for (const stueck of belegung.placements) {
              if (stueck.op !== op) continue;
              const pid = ns.exec(
                op.script,
                stueck.host,
                stueck.threads,
                t.host,
                0,
                Math.round(op.landAt),
                Math.round(op.opMs),
                "b" + marke++,
              );
              if (!pid) { abbruch = true; break; }
              const w = workforce.find((s) => s.host === stueck.host);
              if (w) w.ramFree -= stueck.threads * op.cost;
            }
            if (abbruch) break;
          }

          kalender = landHack + 3 * GAP_MS;
          verbraucht += pEff.ram;
          gestartet++;
          stapelGesamt++;
          st.batches++;
          if (!abbruch) geldGeplant += pEff.money;
          if (abbruch) break;
        }

        calendar.set(t.host, kalender);
        st.ram = verbraucht;
        t.doing = "stapeln";
        if (gestartet > 0) {
          plan.push({ host: t.host, what: "stapel", threads: gestartet, need: gestartet });
        }
      }
    }

    for (const c of active) {
      if (!c.doing) c.doing = phaseOf(c.host).phase === "drain" ? "auslaufen" : "warten";
    }

    // Eine Runde dauert rund eine Sekunde, also ist der Mittelwert je Runde
    // zugleich der erwartete Ertrag je Sekunde.
    geldFenster.push(geldGeplant);
    if (geldFenster.length > 30) geldFenster.shift();
    const ertragErwartet = geldFenster.reduce((a, b) => a + b, 0) / geldFenster.length;

    // --- 10. Lagebericht ---------------------------------------------------
    const ramFreiJetzt = workforce.reduce((a, s) => a + s.ramFree, 0);
    let phase = "warten";
    let reason = "Kein erreichbares Ziel - das eigene Hacking-Level ist noch zu niedrig.";
    if (active.length) {
      phase = imStapel.length ? "ernten" : "vorbereiten";
      const wartend = plan.filter((p) => p.need > 0 && p.threads === 0).length;
      reason =
        imStapel.length + " Ziel(e) im Stapelbetrieb (" + stapelGesamt + " neue Stapel diese Runde), " +
        inVorbereitung.length + " in Vorbereitung. " +
        (ramFreiJetzt < ramTotal * 0.05
          ? "Der Speicher ist voll ausgelastet."
          : fmt(ramFreiJetzt, 0) + " GB frei - entweder passt kein weiterer Stapel in den Kalender, " +
            "oder der Rest liegt in zu kleinen Stuecken.") +
        (wartend ? " " + wartend + " Auftrag/Auftraege warten auf Platz." : "");
    }

    earned = ns.getServerMoneyAvailable("home") - moneyAtStart;

    // --- 11. Anzeigen ------------------------------------------------------
    const view = {
      round,
      uptime: (Date.now() - startedAt) / 1000,
      phase,
      reason,
      plan,
      busy,
      target,
      player,
      earned,
      stapel: stapelGesamt,
      erwartet: ertragErwartet,
      // [0] misst nur LAUFENDE Skripte - unsere Ein-Weg-Arbeiter buchen ihr
      // Geld aber in der letzten Millisekunde ihres Lebens und sind dann weg.
      // Diese Anzeige stuende strukturell nahe null. [1] ist der Schnitt seit
      // dem letzten Reset und damit das, was wir wirklich wissen wollen.
      income: ns.getTotalScriptIncome()[1],
      exp: ns.getTotalScriptExpGain(),
      net: {
        total: servers.length,
        rooted: servers.filter((s) => s.root).length,
        ramFree: ramFreiJetzt,
        ramTotal: workforce.reduce((a, s) => a + s.ram, 0),
      },
      candidates: active.slice(0, 6),
      active,
      phases,
      events,
    };

    draw(ns, view);
    writeBrain(ns, view);

    // Neue Fassung eingetroffen? Dann Platz machen. Das eigene Fenster noch
    // selbst schliessen - nach dem Beenden geht das nicht mehr.
    if (ns.read("autopilot.js") !== ownSource) {
      // NUR beenden, wenn der Verwalter auch wirklich laeuft - er ist der
      // einzige, der uns wieder hochfahren kann.
      if (investLives) {
        note("Neue Fassung erkannt - beende mich, der Verwalter startet sie");
        writeBrain(ns, { ...view, phase: "neustart", reason: "Neue Fassung wird uebernommen." });
        ns.ui.closeTail(ns.pid);
        ns.exit();
      } else {
        note("Neue Fassung liegt bereit - warte auf einen laufenden Verwalter");
      }
    }
    } catch (err) {
      // Ein einzelner Rechner, der sich unerwartet verhaelt, darf nicht den
      // ganzen Autopiloten toeten - sonst startet ihn der Verwalter alle fuenf
      // Sekunden neu, und aus einem Schluckauf wird eine Dauerschleife.
      //
      // ACHTUNG: Bitburner beendet Skripte, indem es intern ein ScriptDeath
      // wirft - das ist KEIN Error. Wer es hier verschluckt, baut sich eine
      // Schleife, die sich nicht mehr beenden laesst. Also durchlassen.
      if (!(err instanceof Error)) throw err;
      note("Fehler in Runde " + round + ": " + err.message);
    }

    await ns.sleep(1000);
  }
}

// ---------------------------------------------------------------------------
// Anzeige im Spiel
// ---------------------------------------------------------------------------

const C = {
  off: "[0m",
  dim: "[38;5;65m",
  gruen: "[38;5;83m",
  hell: "[38;5;158m",
  gold: "[38;5;220m",
  rot: "[38;5;203m",
  blau: "[38;5;117m",
};

/**
 * Zeichnet den Zustand ins Skriptfenster. Wird jede Sekunde neu gemalt.
 * @param {NS} ns
 */
function draw(ns, v) {
  ns.clearLog();
  const line = (s = "") => ns.print(s);
  const pad = (s, n) => String(s).padEnd(n);

  const phaseFarbe =
    v.phase === "ernten" ? C.gold : v.phase === "warten" ? C.rot : C.blau;

  line(C.dim + "  Runde " + v.round + "   ·   Laufzeit " + dauer(v.uptime) + C.off);
  line("");
  line(
    "  " + phaseFarbe + pad(v.phase.toUpperCase(), 14) + C.off +
    C.dim + "Verdient  " + C.off + C.gold + geld(v.earned) + C.off +
    C.dim + "   (" + geld(v.income) + "/s im Schnitt seit dem Reset)" + C.off,
  );
  line("");

  line("  " + C.dim + "Netz    " + C.off + v.net.rooted + " von " + v.net.total + " Rechnern offen" +
    C.dim + "   ·   Speicher " + C.off + fmt(v.net.ramTotal - v.net.ramFree, 0) + C.dim + " / " + fmt(v.net.ramTotal, 0) + " GB" +
    "   ·   Hacking " + C.off + C.hell + v.player.skill + C.off + C.dim + "   ·   " + fmt(v.exp, 1) + " exp/s" + C.off);
  line("  " + C.dim + "Stapel  " + C.off + v.stapel + " neu in dieser Runde" +
    C.dim + "   ·   rechnerisch " + C.off + C.gold + geld(v.erwartet) + "/s" + C.off +
    C.dim + " bei dieser Taktung" + C.off);
  line("  " + C.dim + "Lage    " + C.off + umbruch(v.reason, 62, 10));

  line("");
  if (v.active?.length) {
    line(
      C.dim + "  Ziel              Guthaben            Sicherheit    Wert/s     Zustand      Im Einsatz" + C.off,
    );
    for (const t of v.active) {
      const anteil = t.moneyMax > 0 ? t.moneyNow / t.moneyMax : 0;
      const b = t.busy ?? { hackT: 0, growT: 0, weakenT: 0 };
      const arbeit = [];
      if (b.hackT) arbeit.push(C.gold + b.hackT + "h" + C.off);
      if (b.growT) arbeit.push(C.gruen + b.growT + "g" + C.off);
      if (b.weakenT) arbeit.push(C.blau + b.weakenT + "w" + C.off);

      const st = v.phases?.get(t.host);
      const zustand = t.doing === "stapeln"
        ? "f=" + (st ? st.fraction.toFixed(2) : "?")
        : t.doing ?? "-";
      const secOk = t.sec <= t.secMin + 0.5;
      const farbe = t.doing === "stapeln" ? C.gold : t.doing === "vorbereiten" ? C.gruen : C.rot;

      line(
        "  " + farbe + pad(t.host, 18) + C.off +
        pad(geld(t.moneyNow), 9) + balken(anteil, 8) + pad(" " + pct(anteil), 8) +
        (secOk ? C.gruen : C.rot) + pad(fmt(t.sec, 2) + "/" + fmt(t.secMin, 0), 14) + C.off +
        pad(geld(t.score), 11) + C.dim + pad(zustand, 13) + C.off +
        (arbeit.length ? arbeit.join(C.dim + "·" + C.off) : C.dim + "-" + C.off),
      );
    }
  } else {
    line("  " + C.rot + "Noch kein erreichbares Ziel" + C.off);
  }

  // Was gerade nicht losgeschickt werden konnte, ist die wichtigste
  // Engpassmeldung - sie sagt, wofuer der naechste Speicher gebraucht wird.
  const wartend = v.plan.filter((p) => p.need > 0 && p.threads === 0);
  if (wartend.length) {
    const kurz = wartend.slice(0, 3).map((p) => p.what + " " + p.need + " auf " + p.host);
    line("");
    line("  " + C.dim + "Wartet auf Speicher: " + kurz.join(", ") +
      (wartend.length > 3 ? " (+" + (wartend.length - 3) + " weitere)" : "") + C.off);
  }

  line("");
  line("  " + C.dim + "Verlauf" + C.off);
  for (const e of [...v.events].reverse().slice(0, 6)) {
    line("    " + C.dim + uhr(e.at) + "  " + C.off + e.text);
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** @param {NS} ns */
function playerFacts(ns) {
  const p = ns.getPlayer();
  return {
    skill: p.skills.hacking,
    int: p.skills.intelligence ?? 0,
    money: p.money,
    multMoney: p.mults.hacking_money,
    multChance: p.mults.hacking_chance,
    multSpeed: p.mults.hacking_speed,
    multGrow: p.mults.hacking_grow,
  };
}

/** @param {NS} ns */
function scanAll(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const next of ns.scan(queue.pop())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

/**
 * Versucht, einen Rechner zu knacken. Oeffnet so viele Anschluesse wie
 * moeglich und nukt, sobald es reicht.
 * @param {NS} ns
 */
function tryCrack(ns, host) {
  let open = 0;
  const tools = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];
  for (const [file, fn] of tools) {
    if (ns.fileExists(file, "home")) {
      try {
        fn(host);
        open++;
      } catch {
        // Anschluss war schon offen
        open++;
      }
    }
  }
  // Bewusst OHNE Pruefung des Hacking-Levels: ns.nuke verlangt nur NUKE.exe
  // und genug offene Anschluesse (src/NetscriptFunctions.ts:531). Auch grow
  // und weaken brauchen kein Level, nur Root.
  if (open < ns.getServerNumPortsRequired(host)) return false;
  try {
    return ns.nuke(host) !== false;
  } catch {
    return false;
  }
}

/**
 * Verteilt Arbeiter ohne Zeitvorgabe ueber alle Rechner mit freiem Speicher.
 * Das ist der Weg fuer die VORBEREITUNG - dort ist der Landezeitpunkt egal,
 * es zaehlt nur, dass die Threads ueberhaupt laufen.
 *
 * landeZeit wird als 0 uebergeben. Damit erkennt der Kalender in Schritt 4
 * diese Auftraege nicht als vergebene Termine - was richtig ist, denn sie
 * gehoeren zu keinem Stapel.
 *
 * @param {NS} ns
 * @returns {number} tatsaechlich gestartete Threads
 */
function deploy(ns, workforce, script, threads, target, marke) {
  if (!threads || threads < 1 || !Number.isFinite(threads)) return 0;
  const cost = ns.getScriptRam(script, "home");
  let left = Math.floor(threads);
  let started = 0;

  // Grosse Rechner zuerst, das haelt die Zahl der Prozesse klein.
  const order = [...workforce].sort((a, b) => b.ramFree - a.ramFree);
  for (const s of order) {
    if (left <= 0) break;
    const fits = Math.floor(s.ramFree / cost);
    if (fits < 1) continue;
    const n = Math.min(fits, left);
    const pid = ns.exec(script, s.host, n, target, 0, 0, 0, "p" + marke + "-" + started);
    if (pid) {
      s.ramFree -= n * cost;
      left -= n;
      started += n;
    }
  }
  return started;
}

/**
 * Legt den Zustand fuer die Bruecke nach draussen ab.
 *
 * Der Autopilot schreibt die Telemetrie selbst, statt sie einem zweiten
 * Skript zu ueberlassen: auf home sind nur 8 GB, und ein eigener
 * Telemetrie-Prozess haette 2.75 GB davon gefressen - mehr als ein
 * ganzer Arbeiter.
 *
 * @param {NS} ns
 */
function writeBrain(ns, v) {
  const data = {
    t: Date.now(),
    uptime: v.uptime,
    cycle: v.round,
    phase: v.phase,
    action: v.plan.map((p) => p.what + " x" + p.threads).join(", "),
    reason: v.reason,
    player: {
      money: v.player.money,
      hackLevel: v.player.skill,
      karma: ns.heart.break(),
    },
    income: { scriptIncome: v.income, scriptExpGain: v.exp },
    // Neu: was die Taktung rechnerisch hergeben sollte. Weicht das dauerhaft
    // stark vom tatsaechlichen Zuwachs ab, stimmt mit den Stapeln etwas nicht.
    batching: { newBatches: v.stapel, expectedPerSec: v.erwartet },
    ram: { used: v.net.ramTotal - v.net.ramFree, max: v.net.ramTotal },
    network: { total: v.net.total, rooted: v.net.rooted, backdoored: 0 },
    busy: v.busy,
    events: v.events,
    targets: v.candidates.map((c) => ({
      host: c.host,
      action: c.doing ?? "",
      threads: 0,
      money: c.moneyNow,
      moneyPct: c.moneyMax > 0 ? c.moneyNow / c.moneyMax : 0,
      sec: c.sec,
      minSec: c.secMin,
      valuePerSec: c.score,
      fraction: v.phases?.get(c.host)?.fraction ?? 0,
    })),
  };
  ns.write("data/telemetry.txt", JSON.stringify(data), "w");
}

// --- Formatierung ----------------------------------------------------------

function geld(n) {
  if (!Number.isFinite(n)) return "--";
  const neg = n < 0;
  n = Math.abs(n);
  const u = ["", "k", "m", "b", "t", "q"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return (neg ? "-$" : "$") + (n < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
}

function fmt(n, d = 0) {
  return Number.isFinite(n) ? n.toFixed(d) : "--";
}

function pct(x) {
  return Number.isFinite(x) ? (x * 100).toFixed(1) + "%" : "--";
}

function dauer(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return h + "h " + m + "m";
  if (m) return m + "m " + Math.floor(s % 60) + "s";
  return Math.floor(s) + "s";
}

function uhr(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0");
}

function balken(anteil, breite) {
  const voll = Math.max(0, Math.min(breite, Math.round(anteil * breite)));
  return C.gruen + "█".repeat(voll) + C.dim + "░".repeat(breite - voll) + C.off;
}

/** Bricht langen Text um und rueckt Folgezeilen ein. */
function umbruch(text, breite, einzug) {
  const worte = String(text).split(" ");
  const zeilen = [];
  let z = "";
  for (const w of worte) {
    if ((z + " " + w).trim().length > breite) {
      zeilen.push(z.trim());
      z = w;
    } else {
      z += " " + w;
    }
  }
  if (z.trim()) zeilen.push(z.trim());
  return zeilen.join("\n  " + " ".repeat(einzug));
}
