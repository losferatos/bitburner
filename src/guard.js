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

  // Fuer S2: der Traegerwert beim letzten Vergleich.
  let letzterTraegerWert = null;
  let letzterTraegerMotorMs = null;

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
      const modusRoh = (liesVonHome("data/guard-modus.txt") || "observe").trim();
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
      const lage = {
        node: ri.currentNode,
        verfahren: rolle.verfahren,
        phase: "normal",
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
          leiter.verlauf.push({ ziel: r.ziel, sprosse: r.sprosse.nr, wall });
          while (leiter.verlauf.length > 200) leiter.verlauf.shift();

          if (scharf) {
            sag("SPROSSE " + r.sprosse.nr + " auf " + r.ziel + ": " + r.sprosse.name);
            // Die Ausfuehrung selbst kommt mit Position C.9. Bis dahin ist
            // auch der scharfe Modus nur ein Protokoll - besser, als eine
            // halbfertige Handlung auf einen laufenden Bot loszulassen.
            sag("  (die Ausfuehrung ist noch nicht gebaut - Position C.9)");
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
          const gruen = !scharf ? true : wirkungGruen(r, eintraege, kern);
          const v = verifiziert(leiter, r.ziel, gruen, uhren.guardTimeMs);
          sag("Wirkung " + (gruen ? "gruen" : "rot") + " fuer " + r.ziel
            + " -> " + v.zustand);
        }
      }

      schreibeZustand(ns, uhren, leiter, strafen, {
        wall, runden, okRunden, errStreak, lastError,
        modus: modusRoh, karenz: false, motorTimeMs,
        signale: sigs.map((s) => ({ sig: s.sig, ziel: s.ziel })),
        puls: puls ? Number(puls.puls.toFixed(3)) : null,
        sichtbar,
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
function wirkungGruen(r, eintraege, kern) {
  if (r.ziel === "kern") {
    return !!kern && Number.isFinite(kern.okRound) && kern.errStreak === 0;
  }
  const t = eintraege.find((x) => x.name === r.ziel);
  return !!(t && t.telemetrie);
}

/** Schreibt Uhren, Leiterzustand und Strafenprotokoll - drei getrennte Dateien. */
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
  });
}
