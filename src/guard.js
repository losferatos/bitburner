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
import { neu as neueLeiter, signale, schritt, verifiziert, protokolliere, freigeben,
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
  // SIE UEBERLEBEN DEN NEUSTART (Skeptiker Runde 4, R17, 04.09.2026).
  //
  // `letzteAusfuehrung` war prozesslokal. Der Leiterzustand ueberlebt den
  // Neustart (data/watchdog.json), die Ausfuehrungszeitpunkte nicht - und
  // `guard.js` traegt `restartPolicy: always`, Neustarts sind der Normalfall.
  //
  // Stand ein Ziel bei EXECUTED, wenn der Waechter neu startete, lieferte
  // `letzteAusfuehrung.get(ziel) || 0` eine Null, und die Pruefung
  // `w >= ausfuehrung` war trivial erfuellt. Damit galt wieder "Datei liegt da
  // = geheilt" - genau der Fehler, den C.16 behoben hat, still
  // wiederhergestellt durch jeden Neustart.
  const letzteAusfuehrung = new Map(
    Object.entries((leiter && leiter.letzteAusfuehrung) || {}));

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
        phase: kernPhaseFrisch(kern, wall, ri.lastNodeReset)
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
      //
      // NUR BEI WACHSTUM (04.09.2026, gefunden vom Kettentest der Sprosse 5).
      //
      // Hier wurde alle 45 Minuten Motorzeit BEDINGUNGSLOS fortgeschrieben.
      // Damit mass `dMotor` immer nur "seit dem letzten Vergleichspunkt", nie
      // "seit der Traeger steht": ein Rang, der zehn Stunden festhing, zeigte
      // dauerhaft 45 bis 60 Minuten.
      //
      // Folge: die erste Vorbedingung von Sprosse 5 - "S2 seit >= 6 h
      // Motorzeit" - war ueber dieses Feld UNERREICHBAR. Die teuerste Sprosse
      // der Leiter haette ihre eigene Eingangsbedingung nie erfuellt.
      //
      // Jetzt wandert der Vergleichspunkt nur mit, wenn der Traeger wirklich
      // gewachsen ist. Steht er, bleibt der alte Punkt stehen und `dMotor`
      // waechst - das ist die Zahl, die S2 meint.
      if (kpi && kpi.traeger && Number.isFinite(kpi.traeger.wert)) {
        const gewachsen = letzterTraegerWert !== null
          && kpi.traeger.wert > letzterTraegerWert;
        if (letzterTraegerWert === null
            || (gewachsen && motorTimeMs - (letzterTraegerMotorMs ?? 0) >= 45 * 60000)) {
          letzterTraegerWert = kpi.traeger.wert;
          letzterTraegerMotorMs = motorTimeMs;
        }
      }

      // --- Der Ausgang aus EXHAUSTED (Skeptiker Runde 4) -----------------------
      //
      // `freigeben()` wurde in C.16 ausdruecklich als "DER AUSGANG AUS DER
      // SACKGASSE" gebaut - und hatte keinen Aufrufer. Es war in dieser Datei
      // nicht einmal importiert. Damit blieb EXHAUSTED bis zum naechsten
      // Knotenwechsel stehen, obwohl der Kommentar das Gegenteil versprach:
      // derselbe Fehler eine Ebene tiefer als der, den C.16 behoben hat.
      //
      // Zwoelf Stunden Waechterzeit sind die Frist aus Auftrag 5.2. Danach ist
      // ein neuer Anlauf besser als endloses Schweigen: die Lage kann sich
      // geaendert haben (ein Rechner gekauft, home ausgebaut, ein Gewerk
      // nachgeliefert), und die Deckel je Sprosse verhindern weiterhin, dass
      // daraus eine Dauerstrafe wird.
      {
        const EXHAUSTED_MS = 12 * 3600000;
        for (const [name, z] of Object.entries(leiter.ziele || {})) {
          if (z.zustand !== "EXHAUSTED") continue;
          if (uhren.guardTimeMs - z.seit < EXHAUSTED_MS) continue;
          const frei = freigeben(leiter, name, uhren.guardTimeMs);
          if (frei.length) {
            sag(frei.join(", ") + " nach 12 h wieder freigegeben - die Leiter"
              + " beginnt fuer dieses Ziel von vorn.");
          }
        }
      }

      // --- Den Automaten fahren ------------------------------------------------
      for (const sig of sigs) {
        // Die drei Uhren gehen mit hinein (R15). Welche gilt, entscheidet die
        // Sprosse ueber ihr Feld `uhr` - bis zum 04.09.2026 las das niemand,
        // und Sprosse 5 mass ihre sechs Stunden Motorzeit in Wanduhr.
        const r = schritt(leiter, sig, uhren.guardTimeMs, wall, {
          guard: uhren.guardTimeMs,
          engine: spieler.totalPlaytime,
          motor: motorTimeMs,
        });

        if (r.handlung === "verdacht" || r.handlung === "deckel") {
          sag("[" + sig.sig + "] " + r.ziel + ": " + r.grund);
        }

        if (r.handlung === "ausfuehren") {
          const eintrag = {
            rung: r.sprosse.nr, target: r.ziel, reason: sig.sig, grund: sig.grund,
            wall, playtime: spieler.totalPlaytime, motorTime: motorTimeMs,
            guardTime: uhren.guardTimeMs, round: runden,
            node: ri.currentNode, nodeReset: ri.lastNodeReset, augReset: ri.lastAugReset,
            // ERST NACH DER RUECKMELDUNG (Skeptiker Runde 4, R4).
            //
            // Hier stand `scharf ? "executed" : "would-execute"` - gesetzt,
            // BEVOR `fuehreAus` lief. `punish.js` liest genau dieses Protokoll
            // fuer seinen Knotendeckel: ein Eintrag mit `rung===5 &&
            // result==="executed"` sperrt jede weitere Sprosse 5 im Knoten.
            //
            // Die Folge: die erste S2-Ausloesung verbrannte das Kontingent,
            // auch wenn punish.js mit Grund verweigert hatte. Legte danach ein
            // Mensch `punish-scharf.txt`, bekam er "lief in diesem Knoten
            // schon einmal".
            //
            // Der Wert wird unten korrigiert, sobald `getan` feststeht.
            result: scharf ? "pending" : "would-execute",
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
            const erg = fuehreAus(ns, r, eintraege, gesperrt, sag, {
              wall,
              nodeReset: ri.lastNodeReset,
              // Wie lange S2 schon steht - in MOTORZEIT, so wie punish.js es
              // prueft. Der Waechter fuehrt das Signal, also gibt er die Zahl
              // mit; eine zweite Rechnung in punish.js waere eine zweite
              // Wahrheit.
              s2MotorMs: (sigs.find((x) => x.sig === "S2") || {}).alterMotorMs || 0,
              // Welche Sprossen in DIESEM KNOTEN schon ausgefuehrt und
              // verifiziert wirkungslos waren - ueber ALLE Ziele, nicht nur
              // ueber das eigene.
              //
              // Das ist eine inhaltliche Entscheidung, keine Bequemlichkeit
              // (04.09.2026). S2 traegt das Ziel "fortschritt", und fuer den
              // Traeger gibt es die Sprossen 1 bis 3 gar nicht: sie starten
              // Werkzeuge neu und sperren Wirte. Waere die Bedingung auf das
              // eigene Ziel bezogen, koennte sie nie erfuellt werden, und
              // Sprosse 5 waere unerreichbar - eine Sprosse, die man baut,
              // testet und dokumentiert, und die dann nie feuert, ist
              // schlimmer als keine.
              //
              // Der Sinn der Bedingung bleibt gewahrt: ein Soft-Reset ist eine
              // systemweite Handlung, also gilt als Beleg auch systemweit, dass
              // die billigen Mittel ausgeschoepft sind. Kein einziges davon
              // gefeuert zu haben heisst: der Bot laeuft technisch rund und
              // kommt trotzdem nicht voran - und das ist ein Strategieproblem,
              // kein Neustartproblem.
              wirkungslos: [...new Set((leiter.verlauf || [])
                .filter((v) => v.sprosse < 5)
                .map((v) => v.sprosse))].sort((a, b) => a - b),
            });
            eintrag.ausgefuehrt = erg.getan;
            eintrag.details = erg.text;
            // Jetzt erst steht fest, was wirklich geschah (R4).
            //
            // Fuer Sprosse 5 heisst `getan` allerdings nur "Auftrag gestellt" -
            // ob eingebaut wurde, weiss erst `data/punish.json`. Deshalb bleibt
            // sie auf "ordered", bis die Rueckmeldung da ist; der Deckel in
            // punish.js zaehlt nur "executed".
            eintrag.result = r.sprosse.nr === 5
              ? (erg.getan ? "ordered" : "failed")
              : (erg.getan ? "executed" : "failed");
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
              // Fuer Sprosse 5 (R5): der Erfolg ist ein gesprungener
              // Augmentierungs-Reset bei positivem Konto.
              augReset: ri.lastAugReset,
              geld: spieler.money,
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
        letzteAusfuehrung: Object.fromEntries(letzteAusfuehrung),
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
function kernPhaseFrisch(kern, wall, nodeReset) {
  if (!kern || (kern.phase !== "kaltstart" && kern.phase !== "normal")) return null;
  // AUCH DER KNOTEN MUSS STIMMEN (Skeptiker Runde 4, R25, 04.09.2026).
  //
  // Die Frischepruefung allein liess ein Fenster von fuenf Minuten offen: die
  // Karenz des Waechters nach einem Reset dauert zehn Minuten, die Frist hier
  // fuenfzehn. Dazwischen - und nur dann, wenn der neue Kern noch nicht
  // schreibt, also genau im Fall, fuer den es den Waechter gibt - lieferte der
  // liegengebliebene Block des VORIGEN Knotens "normal", waehrend home auf
  // 32 GB stand. Der Waechter haette die Normalphase-Gewerke gegen ihre alten
  // Telemetriedateien geprueft, und ueber die Enginezeit (die waechst ueber
  // Knoten hinweg) fuer mehrere Ziele zugleich gefeuert.
  //
  // `false_penalty_count = 0` ist Abnahmebedingung. Der Kern schreibt
  // `nodeReset` ohnehin mit - es kostet nichts, ihn zu vergleichen.
  if (Number.isFinite(nodeReset) && Number.isFinite(kern.nodeReset)
      && kern.nodeReset !== nodeReset) return null;
  const w = Number.isFinite(kern.wall) ? kern.wall : (Number.isFinite(kern.zeit) ? kern.zeit : 0);
  return (w > 0 && wall - w <= 15 * 60000) ? kern.phase : null;
}

function wirkungGruen(r, eintraege, kern, lage) {
  // SPROSSE 5 HAT IHREN EIGENEN ERFOLGSBEGRIFF (Skeptiker Runde 4, R5).
  //
  // Hier kannte die Funktion zwei Faelle: `ziel === "kern"` und "Ziel ist ein
  // Registry-Eintrag". S2 traegt `ziel: "fortschritt"` - keines von beiden.
  // `eintraege.find(...)` gab `undefined`, die Funktion `false`, und danach
  // fand `verifiziert` keine hoehere Sprosse: EXHAUSTED, dauerhaft, bis zum
  // naechsten Knotenwechsel.
  //
  // Der Fortschrittszweig war damit ab der ERSTEN sechsstuendigen Stagnation
  // still - also ab dem ersten Mal, dass er gebraucht wurde. Und sichtbar war
  // das nur im scharfen Betrieb: im Beobachtungsmodus erzwingt der Waechter
  // `gruen = true`.
  //
  // Der deklarierte Erfolg steht seit jeher in der Sprossentabelle:
  // "lastAugReset gesprungen und Konto > 0". Er wird jetzt auch geprueft.
  if (r.ziel === "fortschritt") {
    if (!lage || !Number.isFinite(lage.augReset) || !Number.isFinite(lage.ausgefuehrtWall)) {
      return false;
    }
    // Der Einbau muss NACH der Ausfuehrung liegen - ein Einbau von gestern
    // beweist nichts. Und das Konto muss wieder ueber null sein: nach
    // `installAugmentations` stehen 1.262 Dollar, alles darueber heisst, dass
    // der Wiederaufbau laeuft.
    return lage.augReset > lage.ausgefuehrtWall && (lage.geld || 0) > 0;
  }

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
    // Die Ausfuehrungszeitpunkte gehen mit hinaus (R17) - ohne sie faellt die
    // Wirkungspruefung nach jedem Neustart auf ihr altes Verhalten zurueck.
    letzteAusfuehrung: lage.letzteAusfuehrung || {},
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
function fuehreAus(ns, r, eintraege, gesperrt, sag, lage) {
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
    // `wakelock.js` GEHOERT DAZU (Skeptiker Runde 4, R16, 04.09.2026).
    //
    // Es stand mit `killSafe: true` in der Registry, und die Schonliste nimmt
    // nur `killSafe === false` plus diese Notliste - Sprosse 3 hat es also
    // mitgeraeumt. Sprosse 3 feuert per Definition, wenn der Kern tot ist, und
    // NUR der Kern startet den Wachhalter zurueck. Kann boot.js den Kern nicht
    // anwerfen - Platzmangel, der haeufigste Grund, warum er weg war -, bleibt
    // der Tab ohne Drosselungsbremse, und zwar genau in der Nacht, in der die
    // Leiter arbeiten soll.
    //
    // 2,25 GB fuer die einzige gemessene Gegenmassnahme gegen die
    // Tab-Drosselung sind gut angelegt.
    const NOTLISTE = ["boot.js", "guard.js", "ausgang.js", "wakelock.js"];
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
    // EIN KANAL, NICHT ZWEI (Skeptiker Runde 4, R1, 04.09.2026).
    //
    // Hier stand ein Auftrag mit den Feldern `{sprosse, ziel, skript,
    // gestellt, signal}`. `punish.js` liest aber `data/penalty-order.json` und
    // erwartet `{rung, wall, nodeReset, s2MotorMs, wirkungslos}` - KEIN
    // einziger Feldname ueberschnitt sich, und die Datei hatte im ganzen Baum
    // keinen Schreiber.
    //
    // Drei von vier Pruefern haben denselben Befund gefunden: die C.19-Kette
    // lief an, protokollierte "executed" und tat nichts. Genau die
    // Fehlerklasse, gegen die C.19 antritt - eine Ebene tiefer.
    //
    // Jetzt schreibt der Waechter BEIDES aus einer Quelle: den Auftrag in
    // `data/penalty-order.json` (das liest punish.js) und denselben Inhalt in
    // `watchdog.json.orders` (das liest der Kern, um punish.js zu starten).
    // Zwei Leser, ein Inhalt, ein Schreiber.
    const auftrag = {
      // Die Felder, die punish.js prueft.
      rung: 5,
      wall: lage.wall,
      nodeReset: lage.nodeReset,
      s2MotorMs: lage.s2MotorMs,
      wirkungslos: lage.wirkungslos,
      // Die Felder, die der Kern braucht.
      sprosse: 5,
      ziel: r.ziel,
      skript: "punish.js",
      gestellt: lage.wall,
      signal: r.ziel,
    };
    try {
      ns.write("data/penalty-order.json", JSON.stringify(auftrag), "w");
    } catch (e) {
      return { getan: false, text: "Auftrag nicht schreibbar: "
        + String(e && e.message ? e.message : e) };
    }
    return { getan: true, auftrag,
      text: "Auftrag fuer Sprosse 5 in data/penalty-order.json und"
        + " watchdog.json.orders - der Kern startet punish.js"
        + " (Trockenlauf, solange data/punish-scharf.txt fehlt)."
        + " S2 steht bei " + (auftrag.s2MotorMs / 3600000).toFixed(1) + " h"
        + " Motorzeit, wirkungslos: " + JSON.stringify(auftrag.wirkungslos) };
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
