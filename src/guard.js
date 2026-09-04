/**
 * Der Waechter - beobachtet den Kern und die Werkzeuge, und wird vom Kern
 * beobachtet.
 *
 * ===========================================================================
 * ER LAEUFT IM BEOBACHTUNGSMODUS
 * ===========================================================================
 *
 * `modus: "observe"` ist der Auslieferungszustand und ausdruecklich der erste
 * Schritt (Position C.6): der ganze Automat laeuft, alle Signale werden
 * ausgewertet, alle Uebergaenge vollzogen - aber KEINE Sprosse wird
 * ausgefuehrt. Die Eintraege in `data/penalties.json` tragen
 * `result: "would-execute"`.
 *
 * Der Grund steht in ARCHITEKTUR 9: ein Waechter, der zuerst beobachtet,
 * kostet eine Nacht. Ein Waechter, der zuerst zuschlaegt, kostet im
 * schlechtesten Fall einen ganzen Lauf. Und die Abnahme verlangt
 * `false_penalty_count = 0` - eine Zahl, die nur VOR dem Scharfstellen
 * guenstig zu bekommen ist.
 *
 * Scharf wird er ueber `data/guard-modus.txt` mit dem Inhalt `enforce`.
 *
 * ===========================================================================
 * ER IRRT IN RICHTUNG UNTAETIGKEIT
 * ===========================================================================
 *
 * Jede Entscheidung hier folgt diesem Satz. Deshalb: Karenz vor jeder Strafe,
 * Wirkungspruefung nach jeder, Deckel gegen Wiederholung, und jeder Verdacht
 * wird geschrieben - auch der, der zu nichts fuehrt.
 *
 * ===========================================================================
 * WARUM ER NICHT SELBST RECHNET
 * ===========================================================================
 *
 * Der Traeger (S2) kommt aus `kpi.json`, die Motorzeit aus `bn4net.json`.
 * Beides selbst zu ermitteln kostete allein fuer `ns.bladeburner.getRank`
 * 4 GB und fuer jede `ns.stock.*` 2 GB - der 8-GB-Deckel waere weg. Die
 * erwuenschte Nebenwirkung: haengt der Kern, laeuft S2 nicht mehr, und genau
 * dann greifen S3a und S6, die den Kern meinen.
 *
 * @param {NS} ns
 */

import { neu as neueUhren, runde as uhrRunde, enginePuls, inKarenz, laden as ladeUhren }
  from "lib/uhren.js";
import { neu as neueLeiter, signale, schritt, verifiziert, protokolliere,
  laden as ladeLeiter, SPROSSEN } from "lib/leiter.js";
import { laden as ladeRegistry, auswahl, leseRolle, pruefeRolle } from "lib/reg.js";
import { laden as evLaden, anhaengen as evAnhaengen } from "lib/events.js";

const TAKT_MS = 10000;

export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 200) log.shift();
    ns.print(t);
    try { ns.write("data/guard-log.txt", log.join("\n") + "\n", "w"); } catch { /* egal */ }
  };

  /**
   * Lesen von home. `ns.read` hat KEINEN Host-Parameter - es liest immer vom
   * Rechner des laufenden Skripts. Der Waechter laeuft auf home, aber das ist
   * keine Garantie, und ein stiller Leerwert waere hier besonders teuer: er
   * saehe aus wie "keine Telemetrie" und loeste eine Strafe aus.
   */
  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return null;
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return null; }
  };
  const liesJson = (datei) => {
    const roh = liesVonHome(datei);
    if (!roh) return null;
    try { return JSON.parse(roh); } catch { return null; }
  };

  const ri0 = ns.getResetInfo();
  let uhren = ladeUhren(liesVonHome("data/watchdog-uhren.json"), ri0.lastNodeReset);
  let leiter = ladeLeiter(liesVonHome("data/watchdog.json"), ri0.lastNodeReset);
  let strafen = liesJson("data/penalties.json") || { version: 1, eintraege: [] };

  // BLOCKIERTE WIRTE (Position C.9).
  //
  // Sprosse 2 verschiebt ein Werkzeug auf einen anderen Wirt. Ohne Gedaechtnis
  // waere der "andere Wirt" beim naechsten Mal wieder derselbe - und die
  // Sprosse liefe sechsmal je sechs Stunden gegen dieselbe Wand.
  //
  // Der Eintrag verfaellt nach einer Stunde GUARD-Zeit: ein Wirt, der vor
  // einer Stunde zu voll war, ist es jetzt vielleicht nicht mehr, und ein
  // dauerhafter Ausschluss schrumpfte das Netz mit jeder Stoerung.
  const gesperrt = new Map();   // "werkzeug|host" -> guardTimeMs des Eintrags

  // Wann eine Sprosse fuer dieses Ziel zuletzt ausgefuehrt wurde. Die
  // Wirkungspruefung braucht es: eine Telemetriedatei von VOR dem Neustart
  // beweist nichts.
  const letzteAusfuehrung = new Map();

  // Fuer S2: der Traegerwert beim letzten Vergleich.
  let letzterTraegerWert = null;
  let letzterTraegerMotorMs = null;

  // Auftraege an den Kern. Sie leben ueber Runden hinweg, weil der Kern seinen
  // eigenen Takt hat - ein Auftrag, den der Waechter nur eine Runde lang
  // anbietet, wuerde bei gedrosseltem Tab nie gesehen. Der Verfall steht unten
  // beim Schreiben.
  let auftraege = [];

  let runden = 0;
  let errStreak = 0;
  let okRunden = 0;
  let lastError = null;

  sag("guard gestartet. Modus wird je Runde aus data/guard-modus.txt gelesen.");

  for (;;) {
    try {
      runden++;
      const wall = Date.now();
      const spieler = ns.getPlayer();
      const ri = ns.getResetInfo();

      // --- Die eigene Uhr, vor allem anderen ---------------------------------
      uhrRunde(uhren, wall, spieler.totalPlaytime);

      // --- Modus: observe oder enforce ---------------------------------------
      //
      // Je Runde gelesen, nicht beim Start: so laesst sich der Waechter
      // scharfstellen und wieder entschaerfen, ohne ihn neu zu starten - und
      // ohne dass er dabei seinen Zustand verliert.
      // DIE HANDBREMSE WIRKT SOFORT (Skeptiker Runde 3, Nachtrag, 04.09.2026).
      //
      // `data/guard-observe.txt` ist der Riegel, den ein Mensch legt. Ihn nur
      // in `boot.js` auszuwerten hiesse: er wirkt erst beim naechsten
      // Wiederanlauf. Ausgerechnet die Notbremse haette also Stunden gebraucht.
      // Sie wird deshalb HIER gelesen, in derselben Runde, in der sie liegt.
      //
      // 0,10 GB (`fileExists`) - der Waechter hat sie, `liesVonHome` benutzt
      // die Funktion ohnehin.
      const riegel = ns.fileExists("data/guard-observe.txt", "home");
      const modusRoh = riegel
        ? "observe"
        : (liesVonHome("data/guard-modus.txt") || "observe").trim();
      const scharf = modusRoh === "enforce";

      // --- Karenz -------------------------------------------------------------
      //
      // Nach einem Reset oder einem Zeitsprung ruhen alle Fristen. Der Kern
      // kann in diesem Fenster gar nicht laufen; ihn dafuer zu bestrafen waere
      // die haeufigste Fehlstrafe ueberhaupt.
      const seitReset = wall - Math.max(ri.lastNodeReset || 0, ri.lastAugReset || 0);
      if (seitReset < 10 * 60000 || inKarenz(uhren, wall)) {
        schreibeZustand(ns, uhren, leiter, strafen, {
          wall, runden, okRunden, errStreak, lastError,
          modus: modusRoh, karenz: true, motorTimeMs: 0, signale: [],
        }, spieler);
        okRunden++;
        errStreak = 0;
        await ns.sleep(TAKT_MS);
        continue;
      }

      // --- Lage einsammeln ----------------------------------------------------
      const kern = liesJson("data/bn4net.json");
      const kpi = liesJson("data/kpi.json");
      const bridge = liesJson("data/bridge.json");
      const motorTimeMs = kern && Number.isFinite(kern.motorTimeMs) ? kern.motorTimeMs : 0;

      const registry = ladeRegistry(liesVonHome("registry.json"));
      const rolle = pruefeRolle(leseRolle(liesVonHome("data/verfahren.txt") || ""),
        ri.currentNode);
      // DIE PHASE WIRD GEMESSEN, NICHT BEHAUPTET (04.09.2026).
      //
      // Hier stand fest "normal" - derselbe Fehler wie im Kern. Folge: der
      // Waechter haette die Kaltstart-Gewerke (cdump, csolve, darkweb,
      // sleevecrime) nie in seiner Auswahl gehabt und ihren Ausfall in genau
      // der Phase nicht bemerkt, in der sie das einzige Einkommen sind.
      //
      // Der Waechter kennt den Rechnerpark nicht (getServerNames kostet
      // 1,05 GB und spraengte sein Budget), aber die home-Groesse genuegt:
      // nach jedem Reset stehen 32 GB, und der erste Ausbau ist ein
      // eindeutiges Zeichen, dass die Startlage vorbei ist.
      const lage = {
        node: ri.currentNode,
        verfahren: rolle.verfahren,
        // DIE PHASE KOMMT VOM KERN (Skeptiker Runde 3, W6, 04.09.2026).
        //
        // Der Waechter kennt den Rechnerpark nicht (getServerNames kostet
        // 1,05 GB und spraengte sein Budget). Der Kern kennt ihn und zaehlt
        // einen gekauften Rechner als Ende der Startlage - der Waechter tat
        // das nicht. Mit gekauftem Rechner und home noch auf 32 GB standen
        // also zwei verschiedene Phasen nebeneinander, und der Waechter
        // ueberwachte Gewerke, die der Kern absichtlich nicht mehr startet.
        //
        // Jetzt gilt die Zahl des Kerns, solange sein Block frisch ist. Der
        // eigene Schaetzwert bleibt als Rueckfall - er wird gebraucht, wenn
        // der Kern gar nicht laeuft, und genau dann ist der Waechter dran.
        phase: kernPhaseFrisch(kern, wall)
          || (ns.getServerMaxRam("home") <= 64 ? "kaltstart" : "normal"),
        dateiDa: (d) => ns.fileExists(d, "home"),
      };
      const eintraege = auswahl(registry, lage).map((e) => ({
        name: e.name,
        freshnessMs: e.freshnessMs || 600000,
        telemetrie: e.telemetryFile ? liesJson(e.telemetryFile) : null,
      }));

      // S4 liest der Waechter SELBST, nicht aus einer Datei: im Kaltstart
      // schreibt niemand sonde.json, und genau dann ist die Frage am
      // wichtigsten. `globalThis["docu"+"ment"]` kostet 0 GB, weil der
      // RAM-Rechner den Namen nicht als Bezeichner findet.
      let sichtbar = true;
      try {
        const d = globalThis["docu" + "ment"];
        if (d && typeof d.visibilityState === "string") sichtbar = d.visibilityState === "visible";
      } catch { /* kein DOM erreichbar - dann gilt sichtbar */ }

      const puls = enginePuls(uhren);

      const sigs = signale({
        eintraege, kern, kpi, bridge,
        motorTimeMs, guardTimeMs: uhren.guardTimeMs, wall,
        // Die Enginezeit ist die Uhr, in der S1 die alten Werkzeuge misst:
        // sie steht bei gedrosseltem Tab genauso still wie das Spiel, und
        // jeder Herzschlag v2 schreibt sie mit.
        playtime: spieler.totalPlaytime,
        puls: puls ? puls.puls : null,
        sichtbar,
        letzterTraegerWert, letzterTraegerMotorMs,
      });

      // Traegerwert fortschreiben - erst NACH der Auswertung, sonst vergleicht
      // S2 den Wert mit sich selbst.
      if (kpi && kpi.traeger && Number.isFinite(kpi.traeger.wert)) {
        if (letzterTraegerWert === null
            || motorTimeMs - (letzterTraegerMotorMs ?? 0) >= 45 * 60000) {
          letzterTraegerWert = kpi.traeger.wert;
          letzterTraegerMotorMs = motorTimeMs;
        }
      }

      // --- Den Automaten fahren ------------------------------------------------
      for (const sig of sigs) {
        const r = schritt(leiter, sig, uhren.guardTimeMs, wall);

        if (r.handlung === "verdacht" || r.handlung === "deckel") {
          sag("[" + sig.sig + "] " + r.ziel + ": " + r.grund);
        }

        if (r.handlung === "ausfuehren") {
          const eintrag = {
            rung: r.sprosse.nr, target: r.ziel, reason: sig.sig, grund: sig.grund,
            wall, playtime: spieler.totalPlaytime, motorTime: motorTimeMs,
            guardTime: uhren.guardTimeMs, round: runden,
            node: ri.currentNode, nodeReset: ri.lastNodeReset, augReset: ri.lastAugReset,
            result: scharf ? "executed" : "would-execute",
            verifiedAt: null,
          };
          protokolliere(strafen, eintrag);
          // AB SPROSSE 3 IN DEN EREIGNISSTROM (04.09.2026).
          //
          // `ladder_rungs_ge3_per_week` hat Soll 0 und lautet in der
          // Architektur "jede ist ein Befund". Gerechnet wird sie aus
          // `data/events.json` - und dorthin schrieb den Vorgang niemand.
          // `data/penalties.json` fuehrt zwar dieselbe Zeile, hat aber einen
          // eigenen Deckel und wird nach einem Reset nicht mit den Spruengen
          // zusammengefuehrt; die KPI braucht beides in EINER Zeitachse.
          //
          // Erst ab Sprosse 3, weil 1 und 2 der Normalbetrieb sind: ein
          // Neustart und eine Wirtsperre sind das, wofuer die Leiter gebaut
          // ist. Ab 3 greift sie in den Spielstand ein.
          if (r.sprosse.nr >= 3) {
            ereignisAnhaengen(ns, "penalty", "Sprosse " + r.sprosse.nr + " auf "
              + r.ziel + " (" + sig.sig + ")", {
                wall, playtime: spieler.totalPlaytime, motorTimeMs,
              }, { rung: r.sprosse.nr, target: r.ziel, signal: sig.sig,
                scharf, node: ri.currentNode });
          }
          leiter.verlauf.push({ ziel: r.ziel, sprosse: r.sprosse.nr, wall });
          while (leiter.verlauf.length > 200) leiter.verlauf.shift();

          if (scharf) {
            sag("SPROSSE " + r.sprosse.nr + " auf " + r.ziel + ": " + r.sprosse.name);
            letzteAusfuehrung.set(r.ziel, wall);
            const erg = fuehreAus(ns, r, eintraege, gesperrt, sag);
            eintrag.ausgefuehrt = erg.getan;
            eintrag.details = erg.text;
            // Ein Auftrag an den Kern (bisher nur Sprosse 5). Er lebt in
            // watchdog.json und verfaellt nach 15 Minuten - ein Auftrag, den
            // der Kern nicht binnen seiner Karenz ausfuehrt, ist selbst ein
            // Kernbefund und gehoert nicht Stunden spaeter noch ausgefuehrt.
            if (erg.auftrag) auftraege.push(erg.auftrag);
            sag("  -> " + erg.text);
          } else {
            sag("BEOBACHTET: haette Sprosse " + r.sprosse.nr + " auf " + r.ziel
              + " ausgefuehrt (" + r.sprosse.name + ") - Grund: " + sig.grund);
          }
        }

        if (r.handlung === "pruefen") {
          // Die Wirkungspruefung ist im Beobachtungsmodus immer "gruen": es
          // wurde ja nichts getan, also darf der Waechter auch nicht
          // eskalieren. Sonst liefe er in einer Nacht bis EXHAUSTED hoch und
          // meldete am Morgen eine Erschoepfung, die er selbst erzeugt hat.
          const gruen = !scharf ? true
            : wirkungGruen(r, eintraege, kern, {
              wall,
              ausgefuehrtWall: letzteAusfuehrung.get(r.ziel) || 0,
            });
          const v = verifiziert(leiter, r.ziel, gruen, uhren.guardTimeMs);
          sag("Wirkung " + (gruen ? "gruen" : "rot") + " fuer " + r.ziel
            + " -> " + v.zustand);
        }
      }

      // Abgelaufene Auftraege fallen weg. Fuenfzehn Minuten Wanduhr: laenger
      // als jede Kernrunde (10 min Frischefrist) und kuerzer als die Karenz
      // der Sprosse, die den Auftrag erzeugt hat. Ein Auftrag, den der Kern
      // nicht binnen dieser Zeit ausfuehrt, ist selbst ein Kernbefund - und
      // dafuer gibt es S3a, nicht einen ewig liegenden Zettel.
      auftraege = auftraege.filter((a) => wall - a.gestellt < 15 * 60000);

      schreibeZustand(ns, uhren, leiter, strafen, {
        wall, runden, okRunden, errStreak, lastError,
        modus: modusRoh, karenz: false, motorTimeMs,
        signale: sigs.map((s) => ({ sig: s.sig, ziel: s.ziel })),
        puls: puls ? Number(puls.puls.toFixed(3)) : null,
        sichtbar, auftraege,
      }, spieler);

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
}

/**
 * Hat die Sprosse gewirkt?
 *
 * Die Pruefung verlangt "round waechst UND errStreak == 0" - mit `okRound` ist
 * das pruefbar statt nur gefordert. Ein Motor, der jede Runde wirft, zaehlt
 * `round` weiter und saehe sonst geheilt aus.
 */
/**
 * Hat die Sprosse gewirkt?
 *
 * FRISCHE, NICHT EXISTENZ (Skeptiker Fehlermodi, 04.09.2026).
 *
 * Hier stand `!!(t && t.telemetrie)` - die Datei liegt da. Sie liegt aber auch
 * da, wenn das Werkzeug seit einer Stunde nichts schreibt; genau das WAR ja
 * der Befund, der die Sprosse ausgeloest hat. Gruen war die Pruefung damit
 * ausgerechnet dann, wenn eskaliert werden muesste.
 *
 * Gemessen im Trockenlauf: Sprosse 1 sechsmal in 28 Minuten, dann der Deckel,
 * dann fuenfeinhalb Stunden Pause, dann wieder sechsmal - fuer ein Werkzeug,
 * das nie zurueckkam.
 *
 * Geprueft wird jetzt dasselbe wie in S1, mit derselben Uhrenkaskade: die
 * Telemetrie muss JUENGER sein als die Frist des Eintrags. Und zusaetzlich
 * mindestens so jung wie der Zeitpunkt, an dem die Sprosse ausgefuehrt wurde -
 * eine Datei von VOR dem Neustart beweist gar nichts.
 */
/**
 * Die Phase des Kerns - aber nur, wenn sein Block frisch ist.
 *
 * Ein liegengebliebener Block aus dem VORIGEN Knoten wuerde sonst "normal"
 * behaupten, waehrend home nach dem Sprung wieder auf 32 GB steht. Genau in
 * dem Fenster ist der Waechter allein zustaendig, und dann gilt sein eigener
 * Schaetzwert.
 */
function kernPhaseFrisch(kern, wall) {
  if (!kern || (kern.phase !== "kaltstart" && kern.phase !== "normal")) return null;
  const w = Number.isFinite(kern.wall) ? kern.wall : (Number.isFinite(kern.zeit) ? kern.zeit : 0);
  return (w > 0 && wall - w <= 15 * 60000) ? kern.phase : null;
}

function wirkungGruen(r, eintraege, kern, lage) {
  if (r.ziel === "kern") {
    // Fuer den Kern gilt weiter: er zaehlt UND wirft nicht. Ein bloss
    // zaehlender `round` ist kein Fortschrittsbeleg, deshalb `errStreak === 0`
    // daneben.
    return !!kern && Number.isFinite(kern.okRound) && kern.errStreak === 0;
  }
  const t = eintraege.find((x) => x.name === r.ziel);
  if (!t || !t.telemetrie) return false;

  const tm = t.telemetrie;
  const frist = t.freshnessMs ?? 600000;
  // Ein Werkzeug, das ausdruecklich wartet, ist geheilt - es laeuft ja.
  if (tm.state === "wait" || tm.state === "done" || tm.state === "blocked") return true;

  const w = [tm.ts, tm.wall, tm.zeit].find((x) => Number.isFinite(x));
  if (!Number.isFinite(w)) return false;

  // Juenger als die Frist UND juenger als die Ausfuehrung. Der zweite Teil ist
  // der wichtige: sonst genuegte eine Datei, die schon vor dem Neustart da war.
  const ausfuehrung = lage && Number.isFinite(lage.ausgefuehrtWall)
    ? lage.ausgefuehrtWall : 0;
  return (lage.wall - w) <= frist && w >= ausfuehrung;
}

/** Schreibt Uhren, Leiterzustand und Strafenprotokoll - drei getrennte Dateien. */
/**
 * Ein Ereignis an `data/events.json` haengen - lesen, anhaengen, schreiben.
 *
 * Der Waechter laeuft auf home, deshalb ohne scp. Der Ringpuffer sitzt in
 * `lib/events.js`; hier wird nur durchgereicht.
 */
function ereignisAnhaengen(ns, art, text, uhren, daten) {
  try {
    const strom = evLaden(ns.fileExists("data/events.json", "home")
      ? ns.read("data/events.json") : null);
    evAnhaengen(strom, art, text, uhren, daten);
    ns.write("data/events.json", JSON.stringify(strom), "w");
  } catch { /* Bericht, nie Steuerung */ }
}

function schreibeZustand(ns, uhren, leiter, strafen, lage, spieler) {
  const schreib = (datei, obj) => {
    try { ns.write(datei, JSON.stringify(obj), "w"); } catch { /* egal */ }
  };
  schreib("data/watchdog-uhren.json", uhren);
  schreib("data/penalties.json", strafen);
  schreib("data/watchdog.json", {
    ...leiter,
    // Der Herzschlag des Waechters selbst - nach demselben Schema wie alle
    // anderen (ARCHITEKTUR 4.1). Ohne errStreak und lastError waere der Block
    // ungueltig, und der Kern wuerde den Waechter zu Recht fuer tot halten.
    schema: 2,
    ts: lage.wall, wall: lage.wall,
    playtime: spieler.totalPlaytime,
    motorTimeMs: lage.motorTimeMs,
    guardTimeMs: uhren.guardTimeMs,
    round: lage.runden, okRound: lage.okRunden,
    errStreak: lage.errStreak, lastError: lage.lastError,
    host: ns.getHostname(), version: "guard-1",
    state: lage.karenz ? "wait" : "work",
    blockedReason: lage.karenz ? "locked" : null,
    modus: lage.modus,
    sichtbar: lage.sichtbar,
    puls: lage.puls,
    signaleJetzt: lage.signale,
    // Was der Kern tun soll, weil der Waechter es nicht kann. Heisst `orders`,
    // weil ARCHITEKTUR 3.1 den Kanal so nennt und tools/ ihn so liest.
    orders: lage.auftraege || [],
  });
}

/**
 * DIE SPROSSEN AUSFUEHREN (Positionen C.9 und C.10).
 *
 * ===========================================================================
 * WARUM DIE AUSFUEHRUNG SO SPAET KOMMT
 * ===========================================================================
 *
 * Der Waechter lief zuerst im Beobachtungsmodus, und zwar ausdruecklich:
 * `false_penalty_count = 0` ist eine Abnahmebedingung, und das ist eine Zahl,
 * die nur VOR dem Scharfstellen guenstig zu bekommen ist. Ein Waechter, der
 * zuerst beobachtet, kostet eine Nacht; einer, der zuerst zuschlaegt, im
 * schlechtesten Fall einen ganzen Lauf.
 *
 * ===========================================================================
 * ER IRRT IN RICHTUNG UNTAETIGKEIT
 * ===========================================================================
 *
 * Jede Handlung hier ist die kleinstmoegliche, die den Befund heilen kann, und
 * jede meldet ehrlich, wenn sie nichts getan hat. `getan: false` ist kein
 * Fehler - es heisst, die Wirkungspruefung wird gleich rot, und die Leiter
 * geht eine Sprosse hoeher. Das ist genau der vorgesehene Weg.
 *
 * Was hier NICHT steht: Sprosse 4 (Reload von innen) und Sprosse 5
 * (Soft-Reset). Beide tragen `gebaut: false` in `lib/leiter.js`, und
 * `sprosseFuer` liefert sie deshalb gar nicht erst - der Automat kommt nie
 * hier an. Sprosse 4 braucht laut Auftrag erst einen Pruefstandsbeleg, dass
 * kein `beforeunload`-Dialog stehen bleibt; ein Reload mit stehendem Dialog
 * wuerde den Bot bis zum naechsten Menschen anhalten, und das ist das
 * Gegenteil von dem, wofuer die Leiter da ist.
 *
 * @param {NS} ns
 * @param {object} r          das Ergebnis von schritt()
 * @param {Array} eintraege   die Registry-Auswahl mit Telemetrie
 * @param {Map} gesperrt      "werkzeug|host" -> Zeitstempel
 * @param {Function} sag
 * @returns {{getan: boolean, text: string}}
 */
function fuehreAus(ns, r, eintraege, gesperrt, sag) {
  const nr = r.sprosse.nr;

  // --- Sprosse 0: die Umgebung ---------------------------------------------
  //
  // Es gibt nichts zu tun, und das ist der Punkt. Ein verdecktes Browserfenster
  // oder eine stockende Bruecke lassen sich von innen nicht heilen. Die Sprosse
  // steht in der Liste, damit der Befund PROTOKOLLIERT wird - handeln waere
  // hier blinder Aktionismus.
  //
  // Seit dem 04.09. kommt der Automat hier ohnehin nicht mehr an: Signale mit
  // schwere 0 speisen die Leiter gar nicht erst (lib/leiter.js, schritt).
  // Der Zweig bleibt als Netz.
  if (nr === 0) {
    return { getan: false, text: "Umgebungsbefund protokolliert - von innen nicht heilbar." };
  }

  // --- Sprosse 1: das Werkzeug neu starten ----------------------------------
  //
  // Die kleinste wirksame Handlung: beenden, wo es laeuft, und der Kern holt
  // es in seiner naechsten Runde zurueck. Der Waechter startet es NICHT selbst -
  // die Wirtwahl, die Speicherpruefung und die Raeumkette stehen im Kern, und
  // sie doppelt zu fuehren waere die sichere Art, sie auseinanderlaufen zu
  // lassen.
  if (nr === 1) {
    const ziel = r.ziel;
    let getoetet = 0;
    const wo = [];
    try {
      for (const h of netz(ns)) {
        for (const p of ns.ps(h)) {
          if (p.filename !== ziel) continue;
          if (ns.kill(p.pid)) { getoetet++; if (!wo.includes(h)) wo.push(h); }
        }
      }
    } catch (e) {
      return { getan: false,
        text: "Neustart misslungen: " + String(e && e.message ? e.message : e) };
    }
    if (!getoetet) {
      // Das Werkzeug laeuft nirgends. Dann ist die Telemetrie zu Recht alt,
      // und der Kern hat es aus einem anderen Grund nicht gestartet - meist
      // Speichermangel. Ein Kill heilt das nicht.
      return { getan: false, text: ziel + " laeuft nirgends - nichts zu beenden."
        + " Der Kern startet es, sobald Platz ist." };
    }
    return { getan: true, text: ziel + " auf " + wo.join(", ") + " beendet ("
      + getoetet + " Instanz(en)). Der Kern holt es in seiner naechsten Runde." };
  }

  // --- Sprosse 2: ein anderer Wirt ------------------------------------------
  //
  // Ein Werkzeug, das nach dem Neustart wieder haengt, haengt vielleicht am
  // WIRT und nicht an sich selbst - ein Rechner, dessen Speicher belegt ist,
  // oder einer, der beim Ausbau gerade neu entstanden ist.
  //
  // Der Waechter waehlt den Wirt nicht selbst (das tut der Kern), aber er kann
  // den bisherigen SPERREN. Die Sperre liegt in data/blocked-hosts.json.
  if (nr === 2) {
    const ziel = r.ziel;
    let wirt = null;
    try {
      for (const h of netz(ns)) {
        if (ns.ps(h).some((p) => p.filename === ziel)) { wirt = h; break; }
      }
    } catch { /* dann bleibt wirt null */ }
    if (!wirt) {
      return { getan: false, text: ziel + " laeuft nirgends - kein Wirt zu sperren." };
    }
    if (wirt === "home") {
      // home zu sperren waere die Sorte Handlung, die alles schlimmer macht:
      // im Kaltstart ist home der einzige Wirt, und ein Werkzeug, das dort
      // nicht laufen darf, laeuft gar nicht.
      return { getan: false, text: "Wirt ist home - wird nicht gesperrt."
        + " Im Kaltstart ist es der einzige, den es gibt." };
    }
    gesperrt.set(ziel + "|" + wirt, Date.now());
    schreibeSperren(ns, gesperrt);
    let getoetet = 0;
    try {
      for (const p of ns.ps(wirt)) {
        if (p.filename === ziel && ns.kill(p.pid)) getoetet++;
      }
    } catch { /* egal */ }
    return { getan: true, text: wirt + " fuer " + ziel + " gesperrt (eine Stunde)"
      + (getoetet ? " und " + getoetet + " Instanz(en) beendet." : ".") };
  }

  // --- Sprosse 3: alles beenden, boot.js starten ----------------------------
  //
  // Die schwerste gebaute Sprosse und die einzige, die den KERN meint. Sie
  // kostet den Zustand aller laufenden Arbeiter - fliegende hack-, grow- und
  // weaken-Faeden werfen ihre bisherige Laufzeit weg.
  //
  // Deshalb der Deckel von zweimal je sechs Stunden (lib/leiter.js) und die
  // Karenz von zehn Minuten: ein Kern, der zehn Minuten lang keinen
  // Herzschlag schreibt, ist wirklich tot und nicht nur langsam.
  //
  // DIE SCHONLISTE IST DIESELBE WIE IN boot.js, und aus demselben Grund: ein
  // Aufraeumen, das seine eigene Aufsicht wegraeumt, macht den Fall
  // unsichtbar, fuer den es gebaut ist. Sie kommt aus der Registry
  // (killSafe: false), mit eingebauter Notliste.
  if (nr === 3) {
    const NOTLISTE = ["boot.js", "guard.js", "ausgang.js"];
    let schonliste = NOTLISTE;
    try {
      const roh = ns.fileExists("registry.json", "home") ? ns.read("registry.json") : null;
      const reg = roh ? JSON.parse(roh) : null;
      if (reg && Array.isArray(reg.eintraege)) {
        schonliste = [...new Set([...NOTLISTE,
          ...reg.eintraege.filter((e) => e.killSafe === false).map((e) => e.name)])];
      }
    } catch { /* die Notliste traegt */ }

    let beendet = 0;
    try {
      for (const p of ns.ps("home")) {
        if (schonliste.includes(p.filename)) continue;
        if (ns.kill(p.pid)) beendet++;
      }
    } catch (e) {
      return { getan: false,
        text: "Raeumen misslungen: " + String(e && e.message ? e.message : e) };
    }

    // boot.js starten, wenn es nicht schon laeuft. Es holt den Kern zurueck
    // und beendet sich danach von selbst.
    let pid = 0;
    try {
      if (ns.ps("home").some((p) => p.filename === "boot.js")) {
        return { getan: true, text: beendet + " Prozess(e) beendet; boot.js lief schon." };
      }
      if (!ns.fileExists("boot.js", "home")) {
        return { getan: false, text: beendet + " Prozess(e) beendet, aber boot.js"
          + " liegt nicht auf home - hier muss ein Mensch nachsehen." };
      }
      pid = ns.exec("boot.js", "home");
    } catch (e) {
      return { getan: false,
        text: "boot.js-Start warf: " + String(e && e.message ? e.message : e) };
    }
    return { getan: !!pid, text: beendet + " Prozess(e) beendet, boot.js "
      + (pid ? "gestartet (pid " + pid + ")." : "liess sich nicht starten (exec gab 0).") };
  }

  // --- Sprosse 5: der Soft-Reset durch Einbau -------------------------------
  //
  // DER WAECHTER FUEHRT SIE NICHT SELBST AUS, und das ist keine Vorsicht,
  // sondern Arithmetik: `installAugmentations` ist `SingularityFn3` und kostet
  // bei SF4.1 achtzig Gigabyte. Der Waechter hat sechs. Er kann diese Sprosse
  // nicht ausfuehren, egal wie sehr er moechte.
  //
  // Also der Weg, den die Architektur vorsieht: der Waechter BEAUFTRAGT, der
  // Kern fuehrt aus. Der Auftrag steht in `data/watchdog.json` unter `orders`
  // - dieselbe Datei, die der Waechter ohnehin je Runde schreibt und der Kern
  // ohnehin liest. Ein eigener Kanal waere ein zweiter Ort fuer denselben
  // Zustand.
  //
  // DIE VORBEDINGUNGEN PRUEFT NICHT DIESER AUFTRAG, SONDERN punish.js SELBST.
  // Das ist der Unterschied zwischen "der Waechter hat vor einer Minute
  // gemeint" und "es gilt jetzt": zwischen Auftrag und Ausfuehrung koennen
  // Minuten liegen, in denen `ausgang.json.offen` umschlaegt oder ein Graft
  // beginnt. punish.js liest alle acht Bedingungen frisch und verweigert mit
  // Grund - deshalb steht hier keine Kopie davon.
  //
  // UND ES BLEIBT EIN TROCKENLAUF, solange `data/punish-scharf.txt` nicht auf
  // home liegt. Der Kern haengt `scharf` nur dann an.
  if (nr === 5) {
    return { getan: true, auftrag: {
      sprosse: 5, ziel: r.ziel, skript: "punish.js",
      gestellt: Date.now(), signal: r.ziel,
    }, text: "Auftrag fuer Sprosse 5 gestellt - der Kern startet punish.js"
      + " (Trockenlauf, solange data/punish-scharf.txt fehlt)." };
  }

  return { getan: false, text: "Sprosse " + nr + " ist nicht gebaut." };
}

/**
 * Das Netz, so weit der Waechter es sehen muss.
 *
 * `ns.scan` kostet 0,2 GB einmalig - der Preis faellt an, ob man einmal oder
 * hundertmal scannt. Im Normalbetrieb wird diese Funktion nie aufgerufen: nur
 * wenn eine Sprosse wirklich feuert.
 */
function netz(ns) {
  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    for (const n of ns.scan(schlange.shift())) {
      if (gesehen.has(n)) continue;
      gesehen.add(n);
      schlange.push(n);
    }
  }
  // Hacknet-Server sind keine Wirte: jedes Byte, das dort laeuft, drueckt die
  // Hash-Rate ueber ramRatio (HacknetServers.ts:14).
  return [...gesehen].filter((h) => !h.startsWith("hacknet-server-"));
}

/**
 * Die Wirtsperren nach draussen, damit der Kern sie liest.
 *
 * Ein Eintrag verfaellt nach einer Stunde Wanduhr. Die Uhr ist hier bewusst
 * die Wanduhr und nicht die Guard-Zeit: der Grund einer Sperre ist meist ein
 * voller Rechner, und der leert sich in Echtzeit.
 */
function schreibeSperren(ns, gesperrt) {
  const SPERRE_MS = 3600000;
  const jetzt = Date.now();
  for (const [k, t] of [...gesperrt]) {
    if (jetzt - t > SPERRE_MS) gesperrt.delete(k);
  }
  const raus = [...gesperrt].map(([k, t]) => {
    const teile = k.split("|");
    return { werkzeug: teile[0], host: teile[1], seit: t, bis: t + SPERRE_MS };
  });
  try {
    ns.write("data/blocked-hosts.json",
      JSON.stringify({ version: 1, ts: jetzt, eintraege: raus }), "w");
  } catch { /* egal */ }
}
