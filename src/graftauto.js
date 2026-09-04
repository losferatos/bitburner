/**
 * Die Grafting-Automatik (Position C.14).
 *
 * ===========================================================================
 * WARUM ES DIESES GEWERK GIBT
 * ===========================================================================
 *
 * Grafting ist laut Auftrag der groesste Posten nach der Route selbst: Faktor
 * 10 bis 20 auf den Rangweg, wirksam in 30 der 40 Restlaeufe. Augmentierungen
 * kosten beim Graften `baseCost x 3`, aber KEINE Reputation und keinen
 * BitNode-Aufschlag (`GraftableAugmentation.ts:21`) - und die 17
 * Bladeburner-Sonderstuecke sind graftbar, sobald man Mitglied ist
 * (`GraftingHelpers.ts:11-18`).
 *
 * Bis heute entschied darueber ein Mensch: `tools/graftnext.js` las die
 * Reihenfolge ueber die Bruecke und legte einen Auftrag ab, auf Zuruf. Damit
 * war Grafting das einzige Gewerk, das jemanden brauchte - und es stand still,
 * sobald niemand hinsah. In einem Auftrag, dessen erste Zeile "maximal
 * autonom" lautet, ist das die groesste einzelne Luecke.
 *
 * ===========================================================================
 * ENTSCHEIDEN UND AUSFUEHREN SIND GETRENNT
 * ===========================================================================
 *
 * Dieses Gewerk entscheidet NUR. Die Ausfuehrung bleibt in `graft.js`: dort
 * steht die Reise nach New Tokyo, der Simulacrum-Marker, den `blade.js` liest,
 * das Zurueckstellen der Bladeburner-Aktion und die Figur-Wache. Das alles
 * doppelt zu fuehren waere die sichere Art, es auseinanderlaufen zu lassen.
 *
 * `graft.js` laeuft einmal und beendet sich. Dieses Gewerk startet es und
 * sieht in der naechsten Runde nach, was daraus geworden ist.
 *
 * ===========================================================================
 * KEIN getOwnedAugmentations - 80 GB GESPART
 * ===========================================================================
 *
 * Naheliegend waere, den Besitz zu erfragen und mit dem Plan abzugleichen. Das
 * kostet bei SF4.1 achtzig Gigabyte und ist ueberfluessig:
 * `getGraftableAugmentations` (5 GB) filtert bereits alles heraus, was der
 * Spieler hat - und zwar einschliesslich der GEKAUFTEN, noch nicht
 * eingebauten (`Person.ts:233-241`, `hasAugmentation` ohne `ignoreQueued`).
 * Was diese Liste nennt, ist graftbar; was fehlt, ist es nicht. Mehr muss man
 * nicht wissen.
 *
 * ===========================================================================
 * DER VORZUG BLOCKIERT NICHT
 * ===========================================================================
 *
 * `Violet Congruity Implant` loescht die Entropie rueckwirkend
 * (`AugmentationHelpers.ts:45-49`), und danach erzeugt kein Graft mehr welche
 * (`GraftingWork.tsx:61-64`). Hier stand deshalb, auf ihn werde GEWARTET.
 *
 * Das war falsch (04.09.2026, Skeptiker Substanz), und zwar doppelt:
 * `applyEntropy` rechnet die Multiplikatoren ueber `reapplyAllAugmentations()`
 * jedes Mal neu (`PlayerObjectAugmentationMethods.ts:8-25`), das Endergebnis
 * haengt also gar nicht an der Reihenfolge - und Congruity kostet als Graft
 * 150 Billionen gegen 0,42 Billionen fuer alle 38 anderen zusammen. Die alte
 * Regel haette dieses Gewerk ab der ersten Runde stillgelegt.
 *
 * Jetzt gilt: wenn bezahlbar, dann zuerst; sonst geht die Liste vor. Die
 * Entscheidung steht in `lib/graftwahl.js` und ist dort ohne Spiel geprueft.
 *
 * @param {NS} ns
 */

// Steuer- und Lagedateien wohnen auf home; dieses Gewerk laeuft nicht
// zwingend dort. `ns.read` liest immer LOKAL - siehe lib/hostdatei.js.
import { liesVonHome } from "lib/hostdatei.js";


import { naechstes, fortschritt } from "lib/graftwahl.js";
import { beantrage as figBeantrage } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";

const TAKT_MS = 60000;

export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 100) log.shift();
    ns.print(t);
    try {
      ns.write("data/graftauto-log.txt", log.join("\n") + "\n", "w");
      if (ns.getHostname() !== "home") ns.scp("data/graftauto-log.txt", "home", ns.getHostname());
    } catch { /* egal */ }
  };

  const nachHome = (datei, inhalt) => {
    try {
      ns.write(datei, inhalt, "w");
      if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
    } catch { /* egal */ }
  };
  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return null;
      // `ns.read` hat KEINEN Host-Parameter (NetscriptFunctions.ts:1120-1122).
      // Ohne dieses scp laese ein Gewerk auf der Werkbank still einen leeren
      // String - und haette damit "kein Plan" statt "Plan da".
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return null; }
  };

  let plan = null;
  try {
    const roh = liesVonHome("graftplan.json");
    plan = roh ? JSON.parse(roh) : null;
  } catch { plan = null; }
  if (!plan || !Array.isArray(plan.reihenfolge)) {
    sag("graftplan.json fehlt oder ist unlesbar - dieses Gewerk hat nichts zu tun.");
    nachHome("data/graftauto.json", JSON.stringify({
      schema: 2, ts: Date.now(), wall: Date.now(), playtime: 0, motorTimeMs: 0,
      round: 0, okRound: 0, errStreak: 0, lastError: null,
      host: ns.getHostname(), version: "graftauto-1",
      state: "done", blockedReason: "kein Plan",
    }));
    return;
  }

  let runden = 0;
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;

  // graft_busy_pct und graft_aborted (ARCHITEKTUR 5.1). Gezaehlt wird in
  // MOTORZEIT, nicht an der Wanduhr: im gedrosselten Tab laeuft die Wanduhr
  // weiter, waehrend das Spiel steht - eine Beschaeftigungsquote in Wanduhr
  // waere dort systematisch zu niedrig und saehe aus wie Leerlauf.
  let motorGesamt = 0;
  let motorBeschaeftigt = 0;
  let letzteMotorzeit = null;
  let abgebrochen = 0;
  let letztesLaufendes = null;
  let letzterGrund = null;
  let letzteRuecklage = -1;
  // Stuecke, die graft.js nicht starten konnte - Name -> Zahl der Versuche.
  // Ueber Rundengrenzen hinweg, aber nicht ueber Prozessgrenzen: nach einem
  // Neustart darf jedes Stueck wieder zweimal versucht werden, denn die
  // Ursache kann inzwischen behoben sein (ein Vorgaenger eingebaut, Geld da).
  const fehlversuche = new Map();
  let letzteGraftMeldung = 0;

  sag("graftauto gestartet. " + plan.reihenfolge.length + " Eintraege im Plan"
    + (plan.vorzug ? ", Vorzug: " + plan.vorzug.name : "") + ".");

  for (;;) {
    try {
      runden++;
      const jetzt = Date.now();

      // --- Die Uhren --------------------------------------------------------
      //
      // Die Motorzeit kommt aus dem Kern - er ist der einzige, der sie fuehrt,
      // und sie ist die Uhr, in der Nachholklumpen und Drosselung schon
      // herausgerechnet sind. Fehlt sie, wird nicht gezaehlt: eine Quote aus
      // einer Uhr, die man nicht kennt, ist keine Quote.
      let motorJetzt = null;
      let etaMin = null;
      let etaSicher = false;
      try {
        const kern = JSON.parse(liesVonHome("data/bn4net.json") || "{}");
        if (Number.isFinite(kern.motorTimeMs)) motorJetzt = kern.motorTimeMs;
      } catch { /* kein Kern - dann keine Motorzeit */ }
      try {
        const a = JSON.parse(liesVonHome("data/ausgang.json") || "{}");
        if (a.eta_min === null || Number.isFinite(a.eta_min)) etaMin = a.eta_min;
        etaSicher = a.eta_sicher === true;
      } catch { /* keine Schaetzung */ }

      // --- Was ist graftbar, was kostet es, wie lange dauert es -------------
      //
      // Die drei Fragen kosten zusammen 12,50 GB und sind der ganze
      // Spielzugriff dieses Gewerks. Preis und Dauer werden NUR fuer die
      // wenigen Kandidaten erfragt, die ueberhaupt in Frage kommen - die
      // vollstaendige Liste hat rund 90 Eintraege, und 90 mal 7,50 GB waere
      // nicht der Speicher, aber die Rechenzeit nicht wert.
      let graftbar = [];
      try { graftbar = ns.grafting.getGraftableAugmentations(); }
      catch (e) {
        // Kein Zugriff heisst: keine Bladeburners-Mitgliedschaft oder BitNode
        // ohne Grafting. Das ist kein Fehler, sondern ein Zustand.
        nachHome("data/graftauto.json", herzschlag({
          state: "wait", blockedReason: "kein Grafting-Zugriff",
        }));
        await ns.sleep(TAKT_MS);
        continue;
      }

      let laeuft = null;
      try {
        const w = ns.singularity.getCurrentWork();
        if (w && w.type === "GRAFTING") laeuft = w.augmentation || "unbekannt";
      } catch { /* nicht lesbar */ }

      // --- DEN ANTRAG ERNEUERN, SOLANGE DER GRAFT LAEUFT --------------------
      //
      // DER FALL (Skeptiker Fehlermodi, 04.09.2026). `graft.js` beantragt die
      // Figur, startet den Graft und BEENDET SICH. Danach erneuert niemand den
      // Antrag - er laeuft nach zweieinhalb Minuten ab, der Lease nach zwei
      // Stunden, und dazwischen kann jeder mit hoeherer Prioritaet die Figur
      // uebernehmen. Ein abgebrochener Graft ist vollstaendig verloren
      // (`GraftingWork.tsx:75-83` erstattet nicht), beim Simulacrum 450 Mrd.
      //
      // Dieses Gewerk laeuft die ganze Graftdauer mit und ist damit der
      // einzige, der den Antrag halten kann. Es beantragt AUF DEN NAMEN
      // graft.js - sonst gaebe es zwei Antragsteller fuer dieselbe Handlung,
      // und die Vergabe wechselte im Minutentakt zwischen ihnen.
      if (laeuft) {
        figBeantrage(ns, "graft.js", FIG_PRIO.graft, "graft", laeuft,
          "laufender Graft, Antrag erneuert");
      }

      // --- Die Beschaeftigungsquote ------------------------------------------
      if (motorJetzt !== null && letzteMotorzeit !== null && motorJetzt >= letzteMotorzeit) {
        const d = motorJetzt - letzteMotorzeit;
        motorGesamt += d;
        if (laeuft) motorBeschaeftigt += d;
      }
      if (motorJetzt !== null) letzteMotorzeit = motorJetzt;

      // ABBRUCH ERKENNEN. Lief in der vorigen Runde ein Graft, laeuft jetzt
      // keines mehr, und das Stueck steht immer noch auf der Liste der
      // graftbaren - dann wurde es nicht fertig, sondern abgebrochen. Ein
      // fertiges Graft verschwindet aus der Liste (hasAugmentation greift
      // sofort, auch fuer eingereihte Stuecke).
      if (letztesLaufendes && !laeuft && graftbar.includes(letztesLaufendes)) {
        abgebrochen++;
        sag("ABBRUCH: " + letztesLaufendes + " lief und ist weg, steht aber noch"
          + " auf der Liste. Das Geld ist verloren"
          + " (GraftingWork.tsx:75-83 erstattet nicht).");
        ereignis("graft_aborted", letztesLaufendes);
      }
      letztesLaufendes = laeuft;

      // --- Die Wahl ----------------------------------------------------------
      //
      // Erst die Kandidaten bestimmen, DANN die Preise erfragen. `naechstes`
      // braucht Preis und Dauer nur fuer die Stuecke, die es ueberhaupt
      // ansieht: den Vorzug und den ersten offenen Listeneintrag.
      const kandidaten = [];
      if (plan.vorzug && plan.vorzug.name && graftbar.includes(plan.vorzug.name)) {
        kandidaten.push(plan.vorzug.name);
      }
      for (const n of plan.reihenfolge) {
        if (graftbar.includes(n)) { kandidaten.push(n); break; }
      }

      const preise = {};
      const dauern = {};
      for (const n of kandidaten) {
        try {
          preise[n] = ns.grafting.getAugmentationGraftPrice(n);
          dauern[n] = ns.grafting.getAugmentationGraftTime(n);
        } catch { /* dann gilt es als nicht graftbar */ }
      }

      // `besitzt` ist hier alles, was NICHT graftbar ist.
      //
      // DAS IST NICHT DASSELBE WIE "BESESSEN", und die Grenze ist bewusst
      // gezogen: `getGraftableAugmentations` laesst ein Stueck aus zwei
      // Gruenden weg - der Spieler hat es schon, ODER es ist ein isSpecial-
      // Stueck ohne die zugehoerige Fraktionsmitgliedschaft
      // (GraftingHelpers.ts:11-18). Fuer die AUSWAHL ist beides gleich
      // richtig: was nicht graftbar ist, wird uebersprungen.
      //
      // Fuer die FORTSCHRITTSMELDUNG ist es das nicht - ein unerreichbares
      // Stueck wuerde als "fertig" gezaehlt. Deshalb heisst das Feld unten
      // `nichtOffen` und nicht `fertig`, und die Prozentzahl traegt denselben
      // Vorbehalt. Den Unterschied sauber zu messen kostete
      // `getOwnedAugmentations`, also 80 GB bei SF4.1 - fuer eine Zahl, die
      // nur im Bericht steht.
      const besitzt = [
        ...plan.reihenfolge.filter((n) => !graftbar.includes(n)),
        ...(plan.vorzug && !graftbar.includes(plan.vorzug.name) ? [plan.vorzug.name] : []),
      ];

      // --- Was schon gescheitert ist, wird nicht ewig wiederholt ------------
      //
      // DER FALL (Skeptiker Substanz, 04.09.2026): `getGraftableAugmentations`
      // filtert NICHT nach Voraussetzungen - das tut erst `graftAugmentation`,
      // und zwar still mit `return false` (`Grafting.ts:76-79` ->
      // `FactionHelpers.tsx:56-58`). Ein Stueck, dessen Vorgaenger fehlt, steht
      // also auf der Liste, laesst sich aber nicht graften.
      //
      // Und der Vorgaenger fehlt nach JEDEM Knotensprung: `prestigeSourceFile`
      // setzt `this.augmentations = []`
      // (`PlayerObjectGeneralMethods.ts:143-175`). Im Plan steht
      // `LuminCloaking-V2 Skin Implant`, dessen V1 im aktuellen Lauf installiert
      // ist - im naechsten nicht mehr.
      //
      // Ohne diese Sperre meldete das Gewerk jede Minute "Graft gestartet",
      // graft.js gaebe still `false` zurueck, und niemand laese es. Eine
      // Endlosschleife am Planende, die nur an der ausbleibenden Zahl im
      // Bericht auffiele.
      //
      // ZWEI FEHLVERSUCHE, nicht einer: der erste kann am Geld liegen, das
      // zwischen Entscheidung und Ausfuehrung weg war.
      try {
        const g = JSON.parse(liesVonHome("data/graft.json") || "{}");
        if (g && g.wunsch && g.getan === "NICHT gestartet"
            && Number.isFinite(g.zeit) && g.zeit > letzteGraftMeldung) {
          letzteGraftMeldung = g.zeit;
          const n = (fehlversuche.get(g.wunsch) || 0) + 1;
          fehlversuche.set(g.wunsch, n);
          sag("graft.js hat " + g.wunsch + " NICHT gestartet (" + n + ". Mal): "
            + String(g.fehler || "ohne Grund").slice(0, 120));
          if (n >= 2) {
            sag("  -> " + g.wunsch + " wird uebersprungen. Meist fehlt eine"
              + " Voraussetzung; die Liste filtert sie nicht.");
            ereignis("graft_uebersprungen", g.wunsch);
          }
        }
      } catch { /* kein graft.json - dann gibt es nichts zu lernen */ }

      // Gescheiterte Stuecke zaehlen wie besessen: sie werden uebersprungen,
      // und der naechste offene Eintrag kommt dran.
      for (const [name, n] of fehlversuche) if (n >= 2) besitzt.push(name);

      // DIE RUECKLAGE WIRD ABGEZOGEN (Skeptiker Runde 3, W8, 04.09.2026).
      //
      // `data/geldbedarf.txt` ist der Kanal, ueber den `bn4rep.js` sagt, wieviel
      // Geld fuer die naechste Augmentierungsrunde zurueckgelegt ist. Der
      // Serverkauf im Kern (bn4net.js:1072) und der Programmkauf in bn4life.js
      // (:263) ziehen ihn ab; das Grafting war der einzige Geldausgeber, der
      // ihn nicht kannte - und mit Abstand der teuerste.
      //
      // Ein Graft ueber der Ruecklage haette also genau das Geld verbraucht,
      // das fuer den Einbau gedacht war. Der Einbau ist der Schritt, der die
      // Multiplikatoren mitnimmt; ein Graft ist ein einzelnes Stueck. Im
      // Zweifel gewinnt der Einbau.
      let ruecklage = 0;
      try {
        ruecklage = ns.fileExists("data/geldbedarf.txt", "home")
          ? Number(liesVonHome(ns, "data/geldbedarf.txt")) || 0 : 0;
      } catch { /* dann ohne Ruecklage - lieber graften als haengen */ }
      const geldRoh = ns.getServerMoneyAvailable("home");
      const geldFrei = Math.max(0, geldRoh - ruecklage);
      if (ruecklage > 0 && ruecklage !== letzteRuecklage) {
        sag("Ruecklage fuer Augmentierungen: " + (ruecklage / 1e9).toFixed(2)
          + " Mrd - verfuegbar bleiben " + (geldFrei / 1e9).toFixed(2) + " Mrd.");
        letzteRuecklage = ruecklage;
      }

      const wahl = naechstes({
        plan, besitzt, preise, dauern,
        geld: geldFrei,
        etaMin, etaSicher,
        laeuft,
      });

      // --- Handeln ------------------------------------------------------------
      if (wahl.name) {
        // graft.js laeuft auf home: es braucht die Singularity-Familie, und im
        // Kaltstart gibt es keine Werkbank. Startet es nicht, sagt der
        // Rueckgabewert 0 genau das - kein Platz oder Datei fehlt.
        const pid = ns.exec("graft.js", "home", 1, wahl.name);
        if (pid) {
          sag("Graft gestartet: " + wahl.name + " (" + wahl.grund + ", "
            + (preise[wahl.name] / 1e9).toFixed(2) + " Mrd, "
            + (dauern[wahl.name] / 60000).toFixed(0) + " min)");
          ereignis("graft_start", wahl.name);
        } else {
          sag("graft.js liess sich nicht starten (exec gab 0) fuer " + wahl.name
            + " - vermutlich kein Platz auf home.");
        }
      } else if (wahl.grund !== letzterGrund) {
        sag(wahl.grund);
        letzterGrund = wahl.grund;
      }

      const f = fortschritt(plan, besitzt);
      nachHome("data/graftauto.json", herzschlag({
        state: laeuft ? "work" : (wahl.wartet ? "blocked" : "wait"),
        blockedReason: wahl.wartet ? wahl.grund.slice(0, 120) : null,
        laeuft,
        naechstes: wahl.name,
        grund: wahl.grund,
        graft_busy_pct: motorGesamt > 0
          ? Number(((motorBeschaeftigt / motorGesamt) * 100).toFixed(1)) : null,
        graft_aborted: abgebrochen,
        // `nichtOffen`, nicht `fertig`: siehe die Begruendung oben bei
        // `besitzt`. Ein Stueck, das mangels Mitgliedschaft nicht graftbar
        // ist, steckt hier mit drin.
        nichtOffen: f.fertig,
        offen: f.offen,
        gesamt: f.gesamt,
        prozentNichtOffen: f.prozent,
      }));

      okRunden++;
      errStreak = 0;
    } catch (e) {
      errStreak++;
      const msg = String(e && e.message ? e.message : e);
      lastError = { cls: (e && e.name) || "Error",
        msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now() };
      sag("RUNDENFEHLER (" + errStreak + " in Folge): " + msg);
    }
    await ns.sleep(TAKT_MS);
  }

  /** Der Herzschlag v2 mit den gemeinsamen Feldern (ARCHITEKTUR 4.1). */
  function herzschlag(extra) {
    return JSON.stringify({
      schema: 2,
      ts: Date.now(), wall: Date.now(),
      playtime: (() => { try { return ns.getPlayer().totalPlaytime; } catch { return 0; } })(),
      motorTimeMs: 0,
      round: runden, okRound: okRunden,
      errStreak, lastError,
      host: ns.getHostname(), version: "graftauto-1",
      ...extra,
    });
  }

  /**
   * Ein Ereignis in den Strom haengen.
   *
   * Der Grund fuer den Strom statt der eigenen Telemetrie: die wird bei jedem
   * Schreibvorgang ueberschrieben. Ein Abbruch von heute Nacht waere morgen
   * frueh nicht mehr auffindbar - und `graft_aborted = 0` ist eine
   * Abnahmebedingung.
   */
  function ereignis(art, name) {
    let strom = { version: 1, eintraege: [] };
    try {
      const roh = liesVonHome("data/events.json");
      if (roh) {
        const g = JSON.parse(roh);
        if (g && Array.isArray(g.eintraege)) strom = g;
      }
    } catch { /* dann ein frischer Strom */ }
    strom.eintraege.push({
      art: "note",
      text: (art + ": " + name).slice(0, 160),
      wall: Date.now(),
      playtime: 0,
      motorTimeMs: letzteMotorzeit ?? 0,
      daten: { art, name },
    });
    while (strom.eintraege.length > 400) strom.eintraege.shift();
    nachHome("data/events.json", JSON.stringify(strom));
  }
}
