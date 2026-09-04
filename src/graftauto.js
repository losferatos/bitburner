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
 * DER VORZUG WARTET, ER WIRD NICHT UEBERSPRUNGEN
 * ===========================================================================
 *
 * `Violet Congruity Implant` loescht die Entropie rueckwirkend
 * (`AugmentationHelpers.ts:45-49`), und danach erzeugt kein Graft mehr welche
 * (`GraftingWork.tsx:61-64`). Das Endergebnis ist in beiden Faellen null
 * Entropie - aber wer es ZUERST graftet, arbeitet die restlichen 38 Stuecke
 * mit vollen Multiplikatoren ab statt mit 0,98^n. Nach 38 Grafts stuende
 * bladeburner_success_chance sonst bei x0,822 statt x1,771.
 *
 * Deshalb wird auf ihn GEWARTET, wenn das Geld nicht reicht. Die Entscheidung
 * steht in `lib/graftwahl.js` und ist dort ohne Spiel geprueft.
 *
 * @param {NS} ns
 */

import { naechstes, fortschritt } from "lib/graftwahl.js";

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

      const wahl = naechstes({
        plan, besitzt, preise, dauern,
        geld: ns.getServerMoneyAvailable("home"),
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
