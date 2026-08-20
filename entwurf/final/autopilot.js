import * as calc from "lib/calc";
import * as batch from "lib/batch";

/** Ueber diesen Netscript-Port bekommt der Verwalter die Sperrkasse gemeldet. */
const RESERVE_PORT = 1;

/**
 * Bis zu welcher Sicherheitsstufe ueber dem Minimum gilt ein Ziel als bereit?
 *
 * Frueher stand hier die feste 3. Absolut ist der falsche Massstab: bei
 * secMin 1 sind drei Punkte dreihundert Prozent Aufschlag, bei secMin 50
 * ganze sechs. Sicherheit geht doppelt in den Ertrag ein - in den Beuteanteil
 * ueber (100 - sec)/100 und in die Laufzeit ueber 2.5 * reqSkill * sec.
 *
 * Ein Zehntel des Minimums ist der ehrlichere Massstab. Das absolute Minimum
 * von 1 verhindert, dass ein erntendes Ziel durch die Sicherheit seiner
 * eigenen Erntewelle (0.002 je Faden) sofort wieder aus der Erntereife faellt
 * und zwischen Ernte und Beruhigung pendelt.
 *
 * Steht hier oben, damit die Anzeige DIESELBE Schwelle benutzt wie die
 * Entscheidung - sonst meldet sie gruen, was der Bot laengst anders behandelt.
 */
const secTolerance = (s) => Math.max(1, s.secMin * 0.1);

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
 *   4. Ernten - was reif ist, zahlt zuerst - und mit dem Rest vorbereiten
 *
 * ZWEI BETRIEBSARTEN, umgeschaltet allein nach vorhandenem Speicher:
 *
 *   - WELLEN (unter BATCH_MIN_RAM): je Ziel und Landung eine Welle, wie seit
 *     jeher. Das ist der Zustand nach einem Reset.
 *   - STAPEL (darueber): HWGW-Stapel, ineinander geschachtelt. Erst das
 *     fuellt ein grosses Netz aus.
 *
 * Warum nicht immer Stapel: siehe die Tabelle bei BATCH_MIN_RAM. Jeder der
 * vier Auftraege eines Stapels haelt seinen Speicher bis zu SEINER Landung,
 * auch der Erntefaden, der fuer sich nur ein Viertel der Zeit braucht. Wo
 * Speicher der Engpass ist, ist das der teuerste Fehler ueberhaupt.
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
  // Die Schluessel heissen hackT/growT/weakenT, nicht hack/grow/weaken.
  // Grund ist kein Geschmack, sondern Speicher: Bitburners Speicherrechner
  // laeuft ueber den Syntaxbaum und bucht JEDEN Bezeichner, dessen Name auf
  // eine ns-Funktion passt - auch `busy.hack`, obwohl `busy` kein `ns` ist
  // (Script/RamCalculations.ts, Besucher Identifier und MemberExpression).
  // Ein einziges `.hack` im Quelltext kostet 0.10 GB, `.grow` und `.weaken`
  // je 0.15 GB. Zusammen 0.40 GB von den 16 GB auf home - fuer nichts.
  // Schluessel in Objektliteralen sind dagegen frei (acorn-walk besucht bei
  // einer Property nur den Wert), deshalb darf die Telemetrie weiter
  // `{ hack: ... }` schreiben und das Dashboard bleibt unveraendert.
  const SCRIPTS = { hackT: "worker/hack.js", growT: "worker/grow.js", weakenT: "worker/weaken.js" };
  // Kleiner Puffer auf home. Bewusst klein: Der Autopilot selbst steckt
  // bereits in getServerUsedRam - wer hier nochmal seine vollen 7 GB abzieht,
  // rechnet ihn doppelt und verschenkt den halben Heimrechner.
  const HOME_RESERVE = 2;
  // Ab diesem Anteil des Maximalgeldes lohnt das Ernten (Wellenbetrieb).
  const MONEY_READY = 0.9;
  // OBERGRENZEN, keine festen Zahlen. Wie viele Ziele wirklich bedient werden,
  // haengt am vorhandenen Speicher und wird jede Runde neu bestimmt.
  //
  // Feste Zahlen sind fuer genau eine Ausbaustufe richtig. In der Nacht zum
  // 20.08. hat das den Wiederaufbau nach dem ersten Reset abgewuergt: die
  // Werte 60/40 stammten von einem Netz mit 274 TB, nach dem Reset standen
  // noch 116 GB. Der Autopilot hat daraufhin fuenf Stunden lang sieben Ziele
  // gleichzeitig vorbereitet, keines je fertig bekommen und keinen Dollar
  // verdient.
  const MAX_TARGETS = 60;
  const PREP_TARGETS = 40;
  // Anteil des freien Speichers, den eine grow-Bestellung hoechstens binden
  // darf. Nie mehr bestellen, als hineinpasst: sonst wird der Ausgleich unten
  // fuer Tausende Faeden berechnet, die es nie geben wird.
  //
  // 85 % und nicht 50 %: der Ausgleich fuer die grow-Faeden kostet nur rund
  // 8 % ihres Speichers (0.004 Sicherheit je grow gegen 0.05 Abbau je weaken,
  // bei fast gleichem Preis je Faden), 15 % Reserve sind also reichlich.
  const GROW_ORDER_SHARE = 0.85;

  // Preise der Darkweb-Programme (src/DarkWeb/DarkWebItems.ts). Kein Skript
  // kann sie kaufen - das erledigt der Nachtdienst am Terminal, aber nur wenn
  // das Geld dasteht. Der Autopilot haelt den Preis des naechsten fehlenden
  // Programms zurueck, sonst setzt der Verwalter jeden Dollar in Speicher um
  // und die Schwelle wird nie erreicht. Der TOR-Router (200k) braucht keinen
  // eigenen Eintrag: er ist Voraussetzung fuer BruteSSH und wird auf dem Weg
  // zu dessen Schwelle ohnehin mitfinanziert.
  const DARKWEB = [
    ["BruteSSH.exe", 500e3],
    ["FTPCrack.exe", 1.5e6],
    ["relaySMTP.exe", 5e6],
    ["HTTPWorm.exe", 30e6],
    ["SQLInject.exe", 250e6],
  ];
  // Unterhalb dieses Guthabens wird eine gesetzte Sperrkasse ignoriert.
  //
  // Der Grund ist der Reset. data/reserve.txt ist eine Textdatei auf home;
  // prestigeHomeComputer leert programs und messages, laesst scripts und
  // textFiles aber stehen (Server/ServerHelpers.ts:224-237). Der Betrag darin
  // stammt also aus einem Leben, in dem Milliarden herumlagen - mit 1262
  // Dollar wird eine Milliardenschwelle nie wieder unterschritten, der
  // Verwalter kauft nie wieder etwas, und das Netz waechst nie wieder.
  //
  // BEWUSST NICHT die urspruenglich vorgeschlagene Deckelung auf das halbe
  // Guthaben: die haette die Sperrkasse als Werkzeug zerstoert. Sie ist keine
  // Notbremse, sondern das Sparbuch fuer alles, was kein Skript kaufen kann
  // (Augmentierungen, Portknacker, Reisen) - und beim Sparen auf 4 Milliarden
  // steht der Betrag naturgemaess dauerhaft weit ueber dem halben Guthaben.
  // Eine Halbierung haette den Verwalter die andere Haelfte verbauen lassen
  // und das Sparziel nie erreichen lassen. Ebenso waere `node tools/reserve.js
  // 1e12` als Messbremse wirkungslos geworden.
  //
  // Der Schwellenwert ist der Preis des TOR-Routers - das Billigste, was ein
  // Skript nicht kaufen kann. Darunter hat eine Sperre schlicht keinen
  // Gegenstand: es gibt nichts, wofuer sich zu sparen lohnte, und jeder
  // Dollar gehoert in den Wiederaufbau.
  const RESERVE_FLOOR = 200e3;

  // ---------------------------------------------------------------------
  // Stapelbetrieb (HWGW)
  //
  // Ein Stapel sind vier Auftraege, die nacheinander landen: ernten,
  // ausgleichen, nachwachsen, ausgleichen. Der Erntefaden trifft dadurch
  // IMMER ein Ziel auf Hoechstguthaben und Mindestsicherheit - genau dort, wo
  // Beuteanteil, Erfolgswahrscheinlichkeit und Tempo am besten sind. Und weil
  // die Stapel ineinander geschachtelt starten, sind Dutzende gleichzeitig
  // unterwegs; erst das fuellt eine grosse Flotte aus.
  // ---------------------------------------------------------------------

  // Ab wie viel Gesamtspeicher ueberhaupt in Stapeln gearbeitet wird.
  //
  // Der Stapelbetrieb ist NICHT unter allen Umstaenden besser. Jeder der vier
  // Auftraege belegt seinen Speicher von seinem Start bis zu SEINER Landung -
  // also praktisch eine ganze weaken-Zeit, auch der Erntefaden, der fuer sich
  // nur ein Viertel so lange braucht. Solange Speicher der Engpass ist, ist
  // das teuer: eine Erntewelle alter Art holt dieselbe Beute mit einem Viertel
  // der Speicherzeit.
  //
  // Nachgerechnet an harakiri-sushi (Level 219, ein Ziel, 90 Minuten,
  // Landungen exakt nach Laufzeit), Ertrag in $/s:
  //
  //     Speicher     Wellen    Stapel   Faktor
  //       64 GB       47 186    19 001    0.40
  //      116 GB       84 951    50 568    0.60
  //      200 GB      125 740    83 360    0.66
  //      300 GB      152 164   137 453    0.90
  //      400 GB      152 164   180 972    1.19
  //      506 GB      153 579   233 838    1.52
  //     1000 GB      154 982   402 244    2.60
  //
  // Die Wellen saettigen bei rund 155 k$/s je Ziel und lassen alles weitere
  // brachliegen; die Stapel wachsen weiter, bis der Kalender voll ist. Der
  // Schnittpunkt liegt bei etwa 350 GB. Unterhalb davon wird geerntet wie
  // bisher - das ist genau der Zustand nach einem Reset, und dort haette der
  // Stapelbetrieb Ertrag gekostet, nicht gebracht.
  //
  // Ein Hin- und Herspringen an der Schwelle ist nicht moeglich: der Speicher
  // waechst nur (der Verwalter kauft und vergroessert, er verkleinert nie) und
  // faellt ausschliesslich beim Augmentierungs-Reset. Der Uebergang findet
  // also genau zweimal je Durchgang statt.
  const BATCH_MIN_RAM = 400;
  // Anteil des freien Speichers, der der Vorbereitung reserviert bleibt,
  // solange ueberhaupt ein Ziel vorbereitet wird. Ohne ihn koennte der
  // Stapelbetrieb - dessen Bedarf praktisch unbegrenzt ist - jede Runde allen
  // Speicher wegnehmen, und der Bot bliebe fuer immer bei den Zielen, die
  // zufaellig zuerst fertig geworden sind. Der Anteil kostet nichts, sobald
  // nichts mehr vorzubereiten ist: dann ist er null.
  const PREP_RESERVE = 0.25;
  // Abstand zwischen zwei Landungen desselben Stapels.
  //
  // Der einzige wirklich heikle Wert. Zu klein, und schon eine um 300 ms
  // verrutschte Landung dreht die Reihenfolge um - in der Simulation faellt
  // das Guthaben dann binnen Minuten auf null, es ist KEIN sanfter Abfall.
  // Zu gross, und der Kalender wird zum Engpass: jeder Stapel belegt 4*gap
  // Kalenderzeit, in eine weaken-Zeit passen also nur tWeaken/(4*gap) Stapel.
  // 400 ms hat in der Simulation 300 ms Streuung unbeschadet ueberstanden und
  // kostet gegenueber dem Optimum (100 ms, aber ohne jede Reserve) rund 10 %.
  //
  // ACHTUNG: nie im Spiel gemessen, nur simuliert. Nicht senken, bevor die
  // tatsaechliche Streuung der Landungen gemessen ist.
  const GAP_MS = 400;
  // Kleiner Vorlauf, damit der zuletzt landende Ausgleich beim Start nicht
  // schon ueberfaellig ist. Ohne ihn waere seine additionalMsec negativ, das
  // Spiel deckelt auf 0, und der Auftrag landet zu spaet.
  const SLACK_MS = 200;
  // Wie weit vor seinem Starttermin ein Stapel losgeschickt werden darf.
  // Etwas mehr als eine Rundenlaenge - sonst faellt bei einer langsamen Runde
  // ein Kalenderplatz ersatzlos aus.
  const LEAD_MS = 1200;
  // Aufschlag auf beide Ausgleichsauftraege. Ueberzaehlige Ausgleichsfaeden
  // sind wirkungslos (die Sicherheit ist nach unten gedeckelt), zu wenige
  // dagegen lassen nach jedem Stapel einen Rest stehen, der sich aufschaukelt.
  const WEAKEN_MARGIN = 1.5;
  const FRACTION_MIN = 0.01;
  // Ueber 0.5 lohnt sich nichts mehr: abschoepfen nimmt linear weg,
  // nachwachsen muss multiplikativ zurueckholen.
  const FRACTION_MAX = 0.5;
  // Bremsen gegen Ausreisser. Im eingeschwungenen Zustand vergibt ein Ziel
  // einen Stapel je 4*gap - die Grenzen greifen nur beim Anlaufen, wenn ein
  // leerer Kalender auf einen Schlag gefuellt wuerde.
  const MAX_BATCHES_PER_ROUND = 12;
  const MAX_BATCHES_TOTAL = 80;
  // Drifterkennung. In einem gesunden Stapelbetrieb faellt die Sicherheit nach
  // jedem Stapel exakt auf secMin zurueck. Beobachtet wird deshalb nicht der
  // Mittelwert, sondern das MINIMUM ueber ein Zeitfenster: wenn selbst der
  // beste Moment der letzten halben Minute daneben liegt, stimmt die Kette
  // nicht mehr.
  const DRIFT_WINDOW = 30;
  const DRIFT_SEC = 1.0;

  // Eigener Quelltext beim Start. Aendert er sich, ist eine neue Fassung
  // eingetroffen - dann beendet sich dieser Prozess, und der Verwalter auf
  // dem Nachbarrechner startet die neue Fassung. Das macht die Entwicklung
  // unabhaengig davon, ob eine Terminaleingabe im richtigen Fenster landet.
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
  // Wird nur im Stapelbetrieb wirklich gebraucht, aber auch im Wellenbetrieb
  // gefuehrt - sonst stuende beim Ueberschreiten der Schwelle jedes Ziel ohne
  // Vorgeschichte da.
  const phases = new Map();
  let round = 0;
  let lastTarget = null;
  let earned = 0;
  // Die Wege zu den Faktionsservern sind teuer zu berechnen (Breitensuche
  // ueber das ganze Netz), aendern sich aber nur bei einem Reset. Also merken.
  let pathCache = null;
  // Ab welcher Runde eine neue Fassung bereitliegt. Ohne diese Marke wartet
  // der Autopilot unbegrenzt auf einen Verwalter, den es vielleicht nicht mehr
  // gibt - und steht dabei still, ohne dass eine Wache es merkt.
  let neueFassungSeit = 0;
  // Fortlaufende Kennung fuer die Arbeiter. ns.exec weist einen Start ab, der
  // sich in Skript, Rechner UND Argumenten nicht von einem laufenden
  // unterscheidet - ohne diese Kennung ginge in einer Runde jeder zweite
  // Auftrag still verloren.
  let marke = 0;
  let moneyAtStart = ns.getServerMoneyAvailable("home");
  // Damit der Hinweis auf eine ignorierte Sperrkasse nicht jede Sekunde im
  // Verlauf steht.
  let reserveNoted = 0;
  // Gleitender Schnitt ueber den erwarteten Geldwert der zuletzt eingeplanten
  // Stapel. Im eingeschwungenen Zustand ist die Einplanungsrate gleich der
  // Landerate, also ist das die erwartete Einnahme je Sekunde. Der Vergleich
  // mit dem tatsaechlichen Zuwachs ist die schaerfste Betriebskontrolle, die
  // wir haben: klaffen die beiden dauerhaft auseinander, landen Stapel in der
  // falschen Reihenfolge, ohne dass es sonst irgendwo auffiele.
  const moneyWindow = [];

  /** Merkt sich eine Entscheidung fuer die Anzeige. */
  const note = (text) => {
    events.push({ at: Date.now(), text });
    if (events.length > 12) events.shift();
  };

  const phaseOf = (host) => {
    let st = phases.get(host);
    if (!st) {
      st = { phase: "prep", samples: [], fraction: FRACTION_MIN, batches: 0 };
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

    // Das Spiel schiebt Programme und Nachrichten unangekuendigt auf home -
    // Story-Meilensteine wie fl1ght.exe, aber auch Hinweise auf freigeschaltete
    // Moeglichkeiten. Als Popup gehen sie leicht unter, deshalb landen sie hier
    // im Verlauf, wo sie stehen bleiben.
    //
    // Der Bestand wird jede Runde frisch aufgenommen, weil die Sperrkasse
    // gleich wissen muss, welche Portknacker fehlen. Nach einem Reset sind sie
    // alle weg: prestigeHomeComputer setzt programs.length = 0
    // (Server/ServerHelpers.ts:227) - Skripte und Textdateien bleiben dagegen.
    const homeFiles = new Set(ns.ls("home"));
    for (const f of homeFiles) {
      if (knownFiles.has(f)) continue;
      knownFiles.add(f);
      if (round === 1) continue; // beim Start nur den Bestand merken
      if (/\.(exe|msg|lit|cct)$/.test(f)) note("Neu auf home: " + f);
    }

    // Sperrkasse an den Verwalter durchreichen. Er laeuft auf einem fremden
    // Rechner und koennte die Datei auf home gar nicht lesen - Ports sind
    // dagegen global und kosten nichts.
    const cash = ns.getServerMoneyAvailable("home");
    let reserve = 0;
    if (ns.fileExists("data/reserve.txt", "home")) {
      const roh = Number(ns.read("data/reserve.txt"));
      if (Number.isFinite(roh) && roh >= 0) reserve = roh;
    }
    // Sperre aus einem frueheren Leben unwirksam machen - Begruendung oben bei
    // RESERVE_FLOOR.
    if (reserve > 0 && cash < RESERVE_FLOOR) {
      if (reserveNoted !== 1) {
        note("Sperrkasse " + geld(reserve) + " bei " + geld(cash) + " Guthaben - im Wiederaufbau ausgesetzt");
        reserveNoted = 1;
      }
      reserve = 0;
    } else if (reserve > 0 && reserve >= cash && reserveNoted !== 2) {
      // Kein Fehler, aber die haeufigste Ursache fuer "der Verwalter kauft
      // nichts mehr". Einmal sagen, nicht raten lassen.
      note("Sperrkasse " + geld(reserve) + " bindet das ganze Guthaben - der Einkauf ruht");
      reserveNoted = 2;
    }

    // Rueckhalt fuer das naechste fehlende Darkweb-Programm. Der Nachtdienst
    // kauft es am Terminal, sobald das Anderthalbfache des Preises dasteht -
    // also muss das Geld auch dastehen duerfen. Zurueckgehalten wird erst,
    // wenn die Schwelle in Reichweite ist: sonst blockiert SQLInject mit
    // seinen 375 Millionen schon in der ersten Stunde jeden Serverkauf.
    let goalHold = 0;
    for (const [datei, preis] of DARKWEB) {
      if (homeFiles.has(datei)) continue;
      if (cash >= preis * 0.4) goalHold = preis * 1.5;
      break;
    }

    ns.clearPort(RESERVE_PORT);
    ns.tryWritePort(RESERVE_PORT, Math.max(reserve, goalHold));

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

    // Bewusst KEIN Aufraeumen beim Start. Arbeiter aus dem vorigen Leben
    // arbeiten an denselben Zielen weiter und beenden sich ohnehin nach einer
    // Aktion. Sie wegzuraeumen wuerde bei jedem Neustart einen ganzen
    // Erntezyklus kosten - und da sich der Autopilot bei jeder neuen Fassung
    // selbst neu startet, waere das teuer erkauft.

    // Der Einkaeufer muss laufen - er besorgt den Speicher, von dem alles
    // andere abhaengt. Er lebt auf einem fremden Rechner, weil allein
    // ns.cloud.purchaseServer 2.25 GB kostet und home damit gesprengt waere.
    // Nach jedem killall ist er tot, also hier jede Runde nachsehen.
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
        // den Verwalter - und raeumt zur Strafe einen fremden 16-GB-Rechner
        // per killall leer. Bei jedem Neustart aufs Neue.
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
      // ein Rechner wird notfalls freigeraeumt. Ein paar verlorene Threads
      // wiegen weniger als dauerhaft ausbleibendes Wachstum.
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

    // --- 3b. Die Hand ------------------------------------------------------
    // hand.js bedient das Terminal ueber das DOM. Das kostet pauschal 25 GB
    // Aufschlag, ist aber der einzige Weg, Terminalbefehle abzusetzen, ohne
    // von aussen auf den Browser zuzugreifen - und jeder solche Zugriff loest
    // in Opera eine Freigabeabfrage aus, die den Nutzer bei der Arbeit
    // lahmlegt. Ueber die Hand laufen Backdoors und Programmkaeufe.
    if (ns.fileExists("hand.js", "home")) {
      const handRam = ns.getScriptRam("hand.js", "home");
      // In der ERSTEN Runde die alte Fassung ueberall beenden. Anders als beim
      // Autopiloten selbst gibt es fuer die Hand keinen Weg, sich zu erneuern:
      // sie laeuft auf einem fremden Rechner, und ohne Browserzugriff kann
      // niemand sie von aussen beenden.
      if (round === 1) {
        for (const s of workforce) {
          for (const pr of ns.ps(s.host)) if (pr.filename === "hand.js") ns.kill(pr.pid);
        }
      }
      // Haengende Hand erschlagen. Ein toter Prozess wird unten ohnehin neu
      // gestartet, ein haengender bliebe fuer immer stehen - und mit ihm der
      // einzige Steuerkanal, der ohne Browserzugriff funktioniert. Der Puls
      // kommt aus hand.js selbst und wird alle drei Sekunden erneuert.
      if (ns.fileExists("data/hand-puls.txt", "home")) {
        const puls = Number(ns.read("data/hand-puls.txt"));
        if (Number.isFinite(puls) && Date.now() - puls > 90000) {
          for (const s of workforce) {
            for (const pr of ns.ps(s.host)) if (pr.filename === "hand.js") ns.kill(pr.pid);
          }
          note("Die Hand hing seit " + Math.round((Date.now() - puls) / 1000) + "s - beendet");
        }
      }
      const laeuftSchon = workforce.some((s) => ns.ps(s.host).some((pr) => pr.filename === "hand.js"));
      if (!laeuftSchon) {
        // NICHT auf den Rechner des Einkaeufers: der raeumt sich bei Bedarf
        // mit killall frei und wuerde die Hand jedes Mal mit erschlagen.
        // Genau das ist am 20.08. passiert - beide landeten auf bot-3.
        const investHost = workforce.find((s) => ns.ps(s.host).some((pr) => pr.filename === "invest.js"));
        const platz = workforce
          .filter((s) => s.host !== "home" && s.ramFree >= handRam)
          .filter((s) => !investHost || s.host !== investHost.host)
          .sort((a, b) => b.ramFree - a.ramFree)[0];
        if (!platz) {
          note("Fuer die Hand ist nirgends Platz (" + handRam.toFixed(2) + " GB noetig)");
        } else {
          ns.scp("hand.js", platz.host, "home");
          if (ns.exec("hand.js", platz.host)) {
            platz.ramFree -= handRam;
            note("Die Hand laeuft jetzt auf " + platz.host);
          } else {
            note("Start der Hand auf " + platz.host + " abgelehnt (" + handRam.toFixed(2)
              + " GB noetig, " + platz.ramFree.toFixed(2) + " GB frei)");
          }
        }
      }
    }

    // --- 4. Laufende Arbeit aufnehmen -------------------------------------
    // Erst nachsehen, wer schon fuer wen arbeitet - VOR jeder neuen
    // Entscheidung. Wer das nicht tut, schickt jede Sekunde eine volle Welle
    // los, obwohl die vorige noch laeuft, verstopft damit den eigenen Speicher
    // und laesst alle anderen Ziele verhungern.
    //
    // Nebenbei entsteht dabei der KALENDER: der spaeteste bereits vergebene
    // Landetermin je Ziel. Er liegt bewusst nirgendwo sonst. Er steht in den
    // Argumenten der laufenden Arbeiter und wird jede Runde daraus neu
    // gelesen. Damit uebersteht er einen Neustart des Autopiloten ohne jede
    // Vorkehrung: die Arbeiter laufen weiter, ihre Termine stehen weiter in
    // ns.ps, und die neue Fassung setzt die Kette genau dort fort. Eine Datei
    // oder eine Variable im Speicher waere nach jedem Austausch verloren - und
    // ein Stapel, der auf einen vergessenen Termin gesetzt wird, landet mitten
    // in einen fremden Stapel hinein. Vorbereitungs- und Wellenauftraege
    // tragen landeZeit = 0 und werden vom Kalender ignoriert.
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
    // Sortiert wird nach erwartetem Ertrag der naechsten Viertelstunde,
    // NICHT nach Dauerertrag. Sonst gewinnt immer der fetteste Server, auch
    // wenn er mit dem vorhandenen Speicher eine halbe Stunde Vorbereitung
    // braucht - und in der Zeit haette ein magerer laengst gezahlt.
    const ramNow = workforce.reduce((a, s) => a + s.ramFree, 0);
    // Fuer die Bewertung zaehlt der GESAMTE Arbeitsspeicher, nicht der gerade
    // freie: beim Zielwechsel werden die Arbeiter ohnehin abgezogen. Wer hier
    // mit dem freien Speicher rechnet, haelt jedes neue Ziel faelschlich fuer
    // unerreichbar, sobald das alte gut ausgelastet ist - und bleibt fuer
    // immer beim ersten Ziel haengen.
    const ramTotal = Math.max(2, workforce.reduce((a, s) => a + s.ram, 0) - HOME_RESERVE);
    // Echte Arbeiterkosten statt fest verdrahteter 1.75 - sonst luegt jede
    // Speicherrechnung still, sobald ein Arbeiter eine ns-Funktion dazubekommt.
    const workerRam = {
      hackT: ns.getScriptRam(SCRIPTS.hackT, "home"),
      growT: ns.getScriptRam(SCRIPTS.growT, "home"),
      weakenT: ns.getScriptRam(SCRIPTS.weakenT, "home"),
    };
    const candidates = servers
      .filter((s) => s.root && s.moneyMax > 0 && s.reqSkill <= player.skill)
      .map((s) => ({
        ...s,
        score: calc.targetScore(s, player),
        yield: calc.expectedYield(s, player, ramTotal, 900, workerRam),
        prep: calc.prepSeconds(s, player, ramTotal, workerRam),
        busy: busyPerTarget.get(s.host) ?? { hackT: 0, growT: 0, weakenT: 0 },
      }))
      .sort((a, b) => b.yield - a.yield);

    const target = candidates[0] ?? null;

    if (target && target.host !== lastTarget) {
      note("Bestes Ziel ist jetzt " + target.host + " (" + geld(target.score) + "/s)");
      lastTarget = target.host;
    }

    // --- 6. Betriebsart und Zustand je Ziel --------------------------------
    const batchMode = ramTotal >= BATCH_MIN_RAM;
    // Erntereife im Wellenbetrieb: die alte, lockere Schwelle. Exakt 100 %
    // Guthaben zu verlangen kostet bei knappem Speicher eine Dreiviertelstunde,
    // in der nichts hereinkommt.
    const ready = (s) => s.sec <= s.secMin + secTolerance(s) && s.moneyNow >= s.moneyMax * MONEY_READY;

    for (const c of candidates) {
      const st = phaseOf(c.host);
      const laeuft = c.busy.hackT + c.busy.growT + c.busy.weakenT;

      if (!batchMode) {
        // Kein Zustandsautomat, keine Drifterkennung: ein Ziel erntet, sobald
        // es reif ist, und wird sonst vorbereitet. Genau wie bisher.
        st.phase = ready(c) ? "batch" : "prep";
        continue;
      }

      // Umgekehrter Wechsel: das Netz ist gerade ueber BATCH_MIN_RAM
      // gewachsen, und ein Ziel steht noch aus dem Wellenbetrieb auf "batch",
      // ohne je fuer Stapel vorbereitet worden zu sein. Einmal zurueck in die
      // Vorbereitung - sonst erntet der erste Stapel in ein halb leeres Ziel.
      if (st.phase === "batch" && st.batches === 0 && c.moneyNow < c.moneyMax * 0.999) {
        st.phase = "prep";
      }

      if (st.phase === "batch") {
        st.samples.push({ sec: c.sec, money: c.moneyMax > 0 ? c.moneyNow / c.moneyMax : 0 });
        if (st.samples.length > DRIFT_WINDOW) st.samples.shift();
        if (st.samples.length >= DRIFT_WINDOW) {
          let secFloor = Infinity, moneyFloor = Infinity;
          for (const pkt of st.samples) {
            if (pkt.sec < secFloor) secFloor = pkt.sec;
            if (pkt.money < moneyFloor) moneyFloor = pkt.money;
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

      if (st.phase === "drain" && laeuft === 0) st.phase = "prep";

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
    // Wie viele Threads fehlen diesem Ziel noch bis zur Erntereife?
    const restBedarf = (s) => {
      if (phaseOf(s.host).phase === "batch") return 0;
      let n = calc.weakenThreads(Math.max(0, s.sec - s.secMin));
      if (s.moneyNow < s.moneyMax * MONEY_READY) {
        const g = calc.growThreads(s, s.moneyMax, Math.max(1, s.moneyNow), player, 1);
        if (Number.isFinite(g)) n += g;
      }
      return Math.max(1, n);
    };
    for (const c of candidates) c.rest = restBedarf(c);

    // Die Obergrenzen muessen sich am vorhandenen Speicher ausrichten, sonst
    // sind sie fuer genau eine Ausbaustufe richtig. In der Nacht zum 20.08.
    // hat genau das den Wiederaufbau nach dem ersten Reset abgewuergt: die
    // Werte 60 und 40 stammten von einem Netz mit 274 TB, nach dem Reset
    // standen noch 116 GB. Der Autopilot hat daraufhin fuenf Stunden lang
    // sieben Ziele gleichzeitig vorbereitet, keines je fertig bekommen und in
    // der ganzen Zeit keinen Dollar verdient.
    const maxTargets = Math.max(2, Math.min(MAX_TARGETS, Math.floor(ramTotal / 2000)));
    const prepTargets = Math.max(1, Math.min(PREP_TARGETS, Math.floor(ramTotal / 4000)));

    // Erntende Ziele zuerst - die kosten am wenigsten und zahlen sofort.
    // Vorbereitung wird nach Ertrag JE THREAD sortiert, nicht nach Ertrag
    // allein: sonst frisst der fetteste Server allen Speicher fuer eine halbe
    // Stunde Vorbereitung, waehrend ein fast fertiges Ziel danebensteht, das
    // mit dreissig Threads sofort zahlen wuerde.
    const lohnend = candidates.filter((c) => c.score > 0);
    const harvesting = lohnend
      .filter((c) => phaseOf(c.host).phase === "batch")
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTargets);
    // Ausdruecklich NUR "prep", nicht "alles ausser batch". Ein Ziel im
    // Zustand "drain" wartet darauf, dass seine letzten Auftraege landen -
    // erst wenn nichts mehr laeuft, darf es neu vorbereitet werden. Wer ihm
    // hier weiter Arbeit gibt, haelt laeuft dauerhaft ueber null: das Ziel
    // kaeme nie aus dem Auslaufen heraus und waere fuer immer verloren.
    const preparing = lohnend
      .filter((c) => phaseOf(c.host).phase === "prep")
      .sort((a, b) => b.score / b.rest - a.score / a.rest)
      .slice(0, prepTargets);
    const active = [...harvesting, ...preparing];

    // Ziele, die aus der Rangfolge gefallen sind, aber noch Arbeiter haben,
    // muessen mitbetreut werden. Sonst laufen dort Erntefaeden weiter,
    // waehrend niemand mehr nachwachsen laesst - der Server wird leergeraeumt
    // und ist beim naechsten Aufstieg in die Rangfolge wertlos.
    for (const c of candidates) {
      if (active.includes(c)) continue;
      if (c.busy.hackT + c.busy.growT + c.busy.weakenT > 0) active.push(c);
    }

    // Speicher, der einem einzelnen Ziel zusteht. Damit wird im Wellenbetrieb
    // der Erntanteil bemessen: ein Zyklus, der hier nicht hineinpasst, ist
    // kein Zyklus, sondern eine halbe Ernte ohne Nachwuchs.
    const ramShare = ramTotal / Math.max(1, active.length);

    const plan = [];
    let batchesTotal = 0;
    let moneyPlanned = 0;

    /**
     * Schickt einen Auftrag los und schreibt mit, was davon wirklich
     * gestartet ist. Der Rueckgabewert ist der Kern der Korrektur vom 20.08.:
     * der Sicherheitsausgleich wird spaeter aus den TATSAECHLICH gestarteten
     * Faeden bemessen, nicht aus den bestellten.
     */
    const schicke = (t, datei, wieviele, was) => {
      if (!wieviele || wieviele < 1) return 0;
      const gestartet = deploy(ns, workforce, datei, wieviele, t.host, marke++);
      plan.push({ host: t.host, what: was, threads: gestartet, need: wieviele });
      return gestartet;
    };

    // --- 8. Ernte ZUERST ---------------------------------------------------
    //
    // Reihenfolge der ganzen Runde:
    //   (1) Ernte - sie zahlt sofort
    //   (2) echter Sicherheitsueberschuss der Vorbereitungsziele
    //   (3) nachwachsen, gedeckelt
    //   (4) Ausgleich fuer die TATSAECHLICH gestarteten Faeden
    //
    // Vorher wurde streng nach Auftragsart verteilt - erst alle weaken, dann
    // alles andere -, sodass der riesige Sicherheitsbedarf EINES
    // Vorbereitungsziels den gesamten Speicher band, bevor auch nur ein
    // Erntefaden startete. Ernte bringt sofort Geld, Vorbereitung ist
    // Investition und kann warten.
    //
    // Damit die Vorbereitung im Stapelbetrieb trotzdem nicht verhungert,
    // bleibt ihr dort ein fester Anteil des freien Speichers reserviert. Im
    // Wellenbetrieb braucht es das nicht: eine Erntewelle bestellt nur den
    // Fehlbetrag eines Zyklus und kann den Speicher gar nicht leerraeumen.
    const prepReserve = batchMode && preparing.length ? ramNow * PREP_RESERVE : 0;

    if (batchMode) {
      // Zwei Durchgaenge. Im ersten bekommt jedes Ziel seinen nach Ertrag
      // gewichteten Anteil - so kommt auch das zweitbeste zum Zug. Im zweiten
      // darf das beste Ziel den Rest nehmen, falls die anderen ihren Anteil
      // nicht verbrauchen konnten. Denn ein Ziel kann nur begrenzt viel
      // Speicher binden: mehr als tWeaken/(4*gap) Stapel passen nicht in
      // seinen Kalender, egal wie viel frei ist.
      for (const durchgang of [1, 2]) {
        const freiZuBeginn = Math.max(0, workforce.reduce((a, s) => a + s.ramFree, 0) - prepReserve);
        if (freiZuBeginn < 10) break;
        const summe = harvesting.reduce((a, t) => a + Math.max(1e-9, t.score), 0);

        for (const t of harvesting) {
          const st = phaseOf(t.host);
          // Im zweiten Durchgang wird der Rest jedes Mal neu ermittelt - sonst
          // bekaeme das zweite Ziel ein Budget zugeteilt, das das erste laengst
          // aufgebraucht hat, und die Platzierung liefe ins Leere.
          const budget = durchgang === 1
            ? freiZuBeginn * (Math.max(1e-9, t.score) / summe)
            : Math.max(0, workforce.reduce((a, s) => a + s.ramFree, 0) - prepReserve);
          if (budget < 10) continue;

          const wahl = batch.chooseFraction(t, player, budget, {
            gapMs: GAP_MS,
            secNow: t.sec,
            weakenMargin: WEAKEN_MARGIN,
            ram: workerRam,
            min: FRACTION_MIN,
            max: FRACTION_MAX,
          });
          if (!wahl) continue;
          st.fraction = wahl.fraction;
          t.fraction = wahl.fraction;
          t.fractionFits = true;
          const p = wahl.plan;

          let kalender = calendar.get(t.host) ?? 0;
          let verbraucht = 0;
          let gestartet = 0;

          while (
            gestartet < MAX_BATCHES_PER_ROUND &&
            batchesTotal < MAX_BATCHES_TOTAL &&
            verbraucht + p.ram <= budget
          ) {
            // Sicherheit unmittelbar vor dem Start neu ablesen, nicht die zu
            // Rundenbeginn gemessene verwenden. Dazwischen liegen die Scans
            // des ganzen Netzes; in dieser Zeit kann ein Auftrag gelandet sein
            // und die Sicherheit angehoben haben. Aus einer veralteten
            // Laufzeit wird eine negative additionalMsec, das Spiel deckelt
            // sie auf 0, der Auftrag landet zu spaet - und der naechste noch
            // spaeter. Das ist der Fehler, der eine Kette kippen laesst.
            const zeiten = batch.opTimes(t, player, ns.getServerSecurityLevel(t.host));
            const jetzt = Date.now();
            // Der zuletzt landende Ausgleich hat die laengste Laufzeit.
            // Frueher als (jetzt + tWeaken) kann er nicht landen, also darf
            // die Ernte - die 3*gap vor ihm liegt - nicht frueher angesetzt
            // werden.
            const frueheste = jetzt + zeiten.tWeaken - 3 * GAP_MS + SLACK_MS;
            const landHack = Math.max(kalender + GAP_MS, frueheste);
            // Gehoert dieser Stapel schon in diese Runde? Massgeblich ist, ob
            // sein letzter Ausgleich jetzt startbar ist.
            if (landHack + 3 * GAP_MS - zeiten.tWeaken > jetzt + LEAD_MS) break;

            const platz = () =>
              workforce.filter((s) => s.ramFree >= 1).map((s) => ({ host: s.host, frei: s.ramFree }));
            let pEff = p;
            let ops = batch.batchOps(p, t.host, landHack, GAP_MS, SCRIPTS, workerRam, zeiten);
            let belegung = batch.placeOps(platz(), ops);
            if (!belegung) break;

            // Musste die Ernte auf mehrere Rechner aufgeteilt werden? Dann
            // nehmen die Bloecke nacheinander vom bereits verkleinerten
            // Guthaben und holen zusammen WENIGER als geplant. Einmal
            // nachrechnen, sonst legt das Nachwachsen blind zu viel nach.
            const stuecke = belegung.placements.filter((x) => x.op === ops[0]).map((x) => x.threads);
            if (stuecke.length > 1) {
              const p2 = batch.batchPlan(t, player, {
                fraction: wahl.fraction,
                secNow: t.secMin,
                weakenMargin: WEAKEN_MARGIN,
                ram: workerRam,
                hackChunks: stuecke,
              });
              const ops2 = p2 ? batch.batchOps(p2, t.host, landHack, GAP_MS, SCRIPTS, workerRam, zeiten) : null;
              const b2 = ops2 ? batch.placeOps(platz(), ops2) : null;
              if (b2) { pEff = p2; ops = ops2; belegung = b2; }
            }

            // Festschreiben - und zwar die Ernte ZULETZT. Sollte ein exec
            // scheitern (fremdes Skript belegt in derselben Millisekunde den
            // Platz), fehlt dann hoechstens die Beute. Waere die Ernte zuerst
            // gestartet, koennte ihr das Nachwachsen fehlen - und genau daraus
            // wird ein Ziel, das langsam ausblutet.
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
            batchesTotal++;
            st.batches++;
            if (!abbruch) moneyPlanned += pEff.money;
            if (abbruch) break;
          }

          calendar.set(t.host, kalender);
          t.doing = "stapeln";
          if (gestartet > 0) {
            plan.push({ host: t.host, what: "stapel", threads: gestartet, need: gestartet });
          } else if (durchgang === 2 && p.ram > budget) {
            // Nicht einmal EIN Stapel passt ins Budget. Das ist der einzige
            // Fall, in dem ein Stapelziel stumm dasteht - er gehoert in die
            // Engpassmeldung, sonst sucht man ihn im Dunkeln.
            plan.push({ host: t.host, what: "stapel(" + fmt(p.ram, 0) + "GB)", threads: 0, need: 1 });
          }
        }
      }
    } else {
      // Wellenbetrieb. Je Ziel und Landung eine Welle: erst der ECHTE
      // Sicherheitsueberschuss, dann die Ernte. Der Ausgleich fuer die Ernte
      // folgt weiter unten, aus den tatsaechlich gestarteten Faeden.
      for (const t of harvesting) {
        t.doing = "ernten";
        schicke(t, SCRIPTS.weakenT,
          Math.max(0, calc.weakenThreads(Math.max(0, t.sec - t.secMin)) - t.busy.weakenT), "weaken");

        // Erntanteil je Ziel aus dem Speicherbudget bestimmen, nicht fest
        // setzen. Genommen wird der groesste Anteil, dessen VOLLER Zyklus
        // (abschoepfen, nachwachsen, Sicherheit abbauen) noch in ramShare
        // passt. Passt nicht einmal der kleinste, wird trotzdem der kleinste
        // genommen - ein winziger Happen ist immer noch besser als Stillstand.
        //
        // Die feste 0.1 war fuer ein Netz mit 274 TB gewaehlt. Nach einem
        // Reset stehen 116 GB; dort passt der volle Zyklus eines
        // 10-Prozent-Happens auf den meisten Zielen nicht mehr hinein - der
        // Bot schoepft ab, bekommt das Ziel nicht wieder voll und faellt in
        // eine Dauervorbereitung.
        const wahl = calc.pickHackFraction(t, player, ramShare, workerRam);
        t.fraction = wahl.fraction;
        t.fractionFits = wahl.fits;
        phaseOf(t.host).fraction = wahl.fraction;
        const voll = wahl.cost ? wahl.cost.hackT : 0;
        t.hackStarted = schicke(t, SCRIPTS.hackT, Math.max(0, voll - t.busy.hackT), "hack");
      }
    }

    // --- 9. Vorbereitung in drei Durchgaengen ------------------------------
    //
    // Die Aufteilung ist der Kern der Korrektur vom 20.08. Frueher stand hier
    // EIN Durchgang, der den Sicherheitsausgleich fuer die GEPLANTEN
    // grow-Faeden bemessen und VOR ihnen verteilt hat. Bei einem Ziel von 4 %
    // auf 100 % sind das tausende Faeden; ihr Ausgleich allein braucht mehr
    // Speicher als das ganze Netz. Er band also alles, grow kam nie dran, und
    // in der naechsten Runde begann dasselbe von vorn.
    for (const t of preparing) t.doing = "vorbereiten";

    // Durchgang 1: NUR der echte Sicherheitsueberschuss. Was noch niemand
    // erzeugt hat, muss auch niemand ausgleichen.
    for (const t of preparing) {
      schicke(t, SCRIPTS.weakenT,
        Math.max(0, calc.weakenThreads(Math.max(0, t.sec - t.secMin)) - t.busy.weakenT), "weaken");
    }

    // Durchgang 2: nachwachsen mit dem, was uebrig ist - und GEDECKELT.
    //
    // Der Deckel ist die zweite Haelfte derselben Korrektur. Ohne ihn wird
    // eine Bestellung ueber tausende Faeden aufgegeben, von denen nur ein
    // Bruchteil startet; der Ausgleich in Durchgang 3 wuerde dann wieder fuer
    // die Bestellung statt fuer die Wirklichkeit bemessen.
    for (const t of preparing) {
      if (t.moneyNow >= t.moneyMax) continue;
      // Bei hoher Sicherheit erst beruhigen. Nachwachsen wirkt dann schwaecher
      // (der Wachstumsexponent haengt an der Sicherheit) und erzeugt zugleich
      // neue Sicherheit - in dieser Lage ist Beruhigen die guenstigere
      // Reihenfolge. Der Ausgleich aus Durchgang 1 laeuft ohnehin schon.
      if (t.sec > t.secMin + secTolerance(t)) {
        t.doing = "beruhigen";
        continue;
      }
      const voll = calc.growThreads(t, t.moneyMax, Math.max(1, t.moneyNow), player, 1);
      if (!Number.isFinite(voll)) continue;
      const frei = workforce.reduce((a, s) => a + s.ramFree, 0);
      const passt = Math.floor((frei * GROW_ORDER_SHARE) / Math.max(0.01, workerRam.growT));
      t.growStarted = schicke(t, SCRIPTS.growT, Math.max(0, Math.min(voll, passt) - t.busy.growT), "grow");
    }

    // Durchgang 3: Sicherheitsausgleich - und zwar erst jetzt, fuer die
    // TATSAECHLICH gestarteten Faeden. Was keinen Platz mehr gefunden hat,
    // hebt die Sicherheit auch nicht an; ein Ausgleich dafuer waere reine
    // Verschwendung und hat in der Nacht zum 20.08. das ganze Netz blockiert.
    // Gilt fuer Ernte und Vorbereitung gleichermassen - im Stapelbetrieb
    // bringt jeder Stapel seinen Ausgleich selbst mit, dort ist beides null.
    for (const t of active) {
      const erzeugt = (t.growStarted || 0) * calc.GROW_FORTIFY_AMOUNT
        + (t.hackStarted || 0) * calc.SERVER_FORTIFY_AMOUNT;
      if (erzeugt > 0) schicke(t, SCRIPTS.weakenT, calc.weakenThreads(erzeugt), "weaken");
    }

    for (const c of active) {
      if (!c.doing) c.doing = phaseOf(c.host).phase === "drain" ? "auslaufen" : "warten";
    }

    // Eine Runde dauert rund eine Sekunde, also ist der Mittelwert je Runde
    // zugleich der erwartete Ertrag je Sekunde.
    moneyWindow.push(moneyPlanned);
    if (moneyWindow.length > 30) moneyWindow.shift();
    const ertragErwartet = moneyWindow.reduce((a, b) => a + b, 0) / moneyWindow.length;

    // --- 10. Lagebericht ---------------------------------------------------
    // Nach Zustand zaehlen, nicht nach neu gestarteten Threads: ein voll
    // ausgelastetes Netz startet naemlich genauso wenig Neues wie ein
    // stehendes, und beides duerfte nicht gleich aussehen.
    const ramFreiJetzt = workforce.reduce((a, s) => a + s.ramFree, 0);
    let phase = "warten";
    let reason = "Kein erreichbares Ziel - das eigene Hacking-Level ist noch zu niedrig.";
    if (active.length) {
      phase = harvesting.length ? "ernten" : "vorbereiten";
      const wartend = plan.filter((p) => p.need > 0 && p.threads === 0).length;
      reason =
        (batchMode
          ? harvesting.length + " Ziel(e) im Stapelbetrieb (" + batchesTotal + " neue Stapel diese Runde), "
          : harvesting.length + " Ziel(e) werden abgeschoepft (Wellenbetrieb, Netz unter "
            + BATCH_MIN_RAM + " GB), ") +
        preparing.length + " vorbereitet. " +
        (ramFreiJetzt < ramTotal * 0.05
          ? "Der Speicher ist voll ausgelastet."
          : fmt(ramFreiJetzt, 0) + " GB frei - entweder passt kein weiterer Auftrag hinein, " +
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
      batchMode,
      batches: batchesTotal,
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
      // Die Anzeige zeigt dieselbe Reihenfolge, in der auch gearbeitet wird.
      candidates: active.slice(0, 6),
      active,
      events,
      // Nur alle zehn Runden neu berechnen - die Breitensuche laeuft ueber das
      // ganze Netz und aendert sich zwischen zwei Sekunden nicht. Den Wert
      // aber JEDE Runde mitschreiben, sonst faellt er aus der Telemetrie und
      // ist neun von zehn Runden lang nicht abrufbar.
      factionPaths: (pathCache = round % 10 === 1 || !pathCache ? factionPaths(ns) : pathCache),
    };

    draw(ns, view);
    writeBrain(ns, view);

    // Neue Fassung eingetroffen? Dann Platz machen. Das eigene Fenster noch
    // selbst schliessen - nach dem Beenden geht das nicht mehr, und tote
    // Fenster bleiben sonst als Muell auf dem Bildschirm liegen.
    if (ns.read("autopilot.js") !== ownSource) {
      // NUR beenden, wenn der Verwalter auch wirklich laeuft - er ist der
      // einzige, der uns wieder hochfahren kann. Sonst liegen beide, und
      // niemand merkt es: der Autopilot ist tot, der Verwalter wurde
      // Sekunden vorher ausgetauscht und noch nicht gestartet. Genau so
      // passiert. Lieber eine Runde spaeter erneuern als gar nicht mehr.
      if (investLives) {
        note("Neue Fassung erkannt - beende mich, der Verwalter startet sie");
        writeBrain(ns, { ...view, phase: "neustart", reason: "Neue Fassung wird uebernommen." });
        ns.ui.closeTail(ns.pid);
        ns.exit();
      } else if (round > neueFassungSeit + 40) {
        // Nicht ewig warten. Ist der Verwalter tot, wartet sonst niemand mehr
        // auf niemanden: der Autopilot steht mit "Neue Fassung wird
        // uebernommen" still, und weil sein Prozess LEBT, greift auch keine
        // Lebenswache. Genau so ist der Bot am 19.08. abends und am 20.08.
        // vormittags haengengeblieben. Nach rund vierzig Runden beendet er
        // sich also trotzdem - ein toter Autopilot wird von jeder Wache
        // erkannt und neu gestartet, ein haengender nicht.
        note("Kein Verwalter in Sicht - beende mich trotzdem, damit eine Wache greift");
        writeBrain(ns, { ...view, phase: "neustart", reason: "Neue Fassung, kein Verwalter - Selbstbeendigung." });
        ns.ui.closeTail(ns.pid);
        ns.exit();
      } else {
        note("Neue Fassung liegt bereit - warte auf einen laufenden Verwalter");
        if (neueFassungSeit === 0) neueFassungSeit = round;
      }
    }
    } catch (err) {
      // Ein einzelner Rechner, der sich unerwartet verhaelt, darf nicht den
      // ganzen Autopiloten toeten - sonst startet ihn der Verwalter alle fuenf
      // Sekunden neu, und aus einem Schluckauf wird eine Dauerschleife.
      //
      // ACHTUNG: Bitburner beendet Skripte, indem es intern ein ScriptDeath
      // wirft - das ist KEIN Error. Wer es hier verschluckt, baut sich eine
      // Schleife, die sich nicht mehr beenden laesst und beim naechsten
      // Verschieben des sleep das ganze Spiel einfriert. Also durchlassen.
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
    C.dim + "   (" + geld(v.income) + "/s)" + C.off,
  );
  line("");

  line("  " + C.dim + "Netz    " + C.off + v.net.rooted + " von " + v.net.total + " Rechnern offen" +
    C.dim + "   ·   Speicher " + C.off + fmt(v.net.ramTotal - v.net.ramFree, 0) + C.dim + " / " + fmt(v.net.ramTotal, 0) + " GB" +
    "   ·   Hacking " + C.off + C.hell + v.player.skill + C.off + C.dim + "   ·   " + fmt(v.exp, 1) + " exp/s" + C.off);
  if (v.batchMode) {
    line("  " + C.dim + "Stapel  " + C.off + v.batches + " neu in dieser Runde" +
      C.dim + "   ·   rechnerisch " + C.off + C.gold + geld(v.erwartet) + "/s" + C.off +
      C.dim + " bei dieser Taktung" + C.off);
  }
  line("  " + C.dim + "Lage    " + C.off + umbruch(v.reason, 62, 10));

  line("");
  if (v.active?.length) {
    line(
      C.dim + "  Ziel              Guthaben            Sicherheit    Wert/s     Im Einsatz" + C.off,
    );
    for (const t of v.active) {
      const anteil = t.moneyMax > 0 ? t.moneyNow / t.moneyMax : 0;
      const b = t.busy ?? { hackT: 0, growT: 0, weakenT: 0 };
      const arbeit = [];
      if (b.hackT) arbeit.push(C.gold + b.hackT + "h" + C.off);
      if (b.growT) arbeit.push(C.gruen + b.growT + "g" + C.off);
      if (b.weakenT) arbeit.push(C.blau + b.weakenT + "w" + C.off);

      // Dieselbe relative Schwelle wie in der Entscheidung. Frueher stand hier
      // eine fest verdrahtete 3, die Anzeige haette also gruen gemeldet, was
      // der Bot laengst als zu unruhig behandelt.
      const secOk = t.sec <= t.secMin + secTolerance(t);
      const farbe = t.doing === "ernten" || t.doing === "stapeln"
        ? C.gold
        : t.doing === "vorbereiten" ? C.gruen : C.blau;
      // Der selbst gewaehlte Erntanteil - das ist die Zahl, an der man sieht,
      // ob sich der Bot an die Groesse des Netzes anpasst. Ein "!" heisst:
      // nicht einmal der kleinste volle Zyklus passt ins Budget.
      const f = t.fraction
        ? C.dim + " f" + pct(t.fraction) + (t.fractionFits === false ? "!" : "") + C.off
        : "";

      line(
        "  " + farbe + pad(t.host, 18) + C.off +
        pad(geld(t.moneyNow), 9) + balken(anteil, 8) + pad(" " + pct(anteil), 8) +
        (secOk ? C.gruen : C.rot) + pad(fmt(t.sec, 1) + "/" + fmt(t.secMin, 1), 14) + C.off +
        pad(geld(t.score), 11) +
        (arbeit.length ? arbeit.join(C.dim + "·" + C.off) : C.dim + "-" + C.off) + f,
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
  // und weaken brauchen kein Level, nur Root. Das Level entscheidet allein
  // darueber, ob man einen Rechner ERNTEN kann - als Arbeitspferd taugt er
  // vorher schon, und genau davon haben wir zu wenig.
  if (open < ns.getServerNumPortsRequired(host)) return false;
  try {
    return ns.nuke(host) !== false;
  } catch {
    return false;
  }
}

/**
 * Wege zu den Faktionsservern, als Terminalkette.
 *
 * Das Netz wird bei JEDEM Reset neu verdrahtet - ein einmal notierter Weg ist
 * danach wertlos. Am 20.08. hat mich das Stunden gekostet: der Backdoor auf
 * CSEC scheiterte viermal, weil harakiri-sushi kein Nachbar mehr war. Deshalb
 * kommt der Weg jetzt aus dem laufenden Netz statt aus dem Gedaechtnis.
 *
 * @param {NS} ns
 */
function factionPaths(ns) {
  const ZIELE = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "The-Cave", "fulcrumassets"];
  const vorgaenger = new Map([["home", null]]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (vorgaenger.has(nachbar)) continue;
      vorgaenger.set(nachbar, hier);
      schlange.push(nachbar);
    }
  }
  const raus = {};
  for (const ziel of ZIELE) {
    if (!vorgaenger.has(ziel)) continue;
    const kette = [];
    for (let h = ziel; h && h !== "home"; h = vorgaenger.get(h)) kette.unshift(h);
    let bd = false;
    try { bd = !!ns.getServer(ziel).backdoorInstalled; } catch { /* nicht erreichbar */ }
    raus[ziel] = {
      cmd: ["home", ...kette.map((h) => "connect " + h)].join("; "),
      level: ns.getServerRequiredHackingLevel(ziel),
      root: ns.hasRootAccess(ziel),
      backdoor: bd,
    };
  }
  return raus;
}

/**
 * Verteilt Arbeiter ohne Zeitvorgabe ueber alle Rechner mit freiem Speicher.
 * Das ist der Weg fuer Wellen und Vorbereitung - dort ist der Landezeitpunkt
 * egal, es zaehlt nur, dass die Threads ueberhaupt laufen.
 *
 * landeZeit wird als 0 uebergeben. Damit erkennt der Kalender in Schritt 4
 * diese Auftraege nicht als vergebene Termine - was richtig ist, denn sie
 * gehoeren zu keinem Stapel.
 *
 * Liefert die tatsaechlich gestartete Threadzahl zurueck - die kann kleiner
 * sein als gewuenscht, wenn der Speicher nicht reicht. Genau das will man in
 * der Anzeige sehen, und genau daraus wird der Sicherheitsausgleich bemessen.
 *
 * @param {NS} ns
 * @returns {number}
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
 * Skript zu ueberlassen: auf home ist der Platz knapp, und ein eigener
 * Telemetrie-Prozess haette 2.75 GB davon gefressen - mehr als ein ganzer
 * Arbeiter.
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
    // Was die Taktung rechnerisch hergeben sollte. Weicht das dauerhaft stark
    // vom tatsaechlichen Zuwachs ab, stimmt mit den Stapeln etwas nicht.
    batching: { active: v.batchMode, newBatches: v.batches, expectedPerSec: v.erwartet },
    ram: { used: v.net.ramTotal - v.net.ramFree, max: v.net.ramTotal },
    network: { total: v.net.total, rooted: v.net.rooted, backdoored: 0 },
    // Die Schluessel heissen hier wieder hack/grow/weaken, damit die Bruecke
    // und das Dashboard unveraendert weiterlesen koennen. Schluessel in einem
    // Objektliteral kosten kein RAM, nur Zugriffe auf sie.
    busy: { hack: v.busy.hackT, grow: v.busy.growT, weaken: v.busy.weakenT },
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
      // Der selbst bestimmte Erntanteil. Steht hier, damit sich von aussen
      // messen laesst, ob er nach einem Reset wirklich faellt und mit dem
      // Netz wieder steigt.
      hackFraction: c.fraction ?? null,
      hackFractionFits: c.fractionFits ?? null,
    })),
    // Wege zu den Faktionsservern. Das Netz wird bei JEDEM Reset neu
    // verdrahtet, ein einmal notierter Weg ist danach wertlos.
    factionPaths: v.factionPaths,
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
