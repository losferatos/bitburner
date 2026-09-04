/**
 * Der zweite, brueckenfreie Sicherungsweg.
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI GIBT
 * ===========================================================================
 *
 * Jede Sicherung dieses Projekts haengt an der Bruecke - also an einem
 * einzelnen Windows-Prozess. Der ist am 03.09.2026 zweimal gestorben und hat
 * bis zu Erics Autostart-Handgriff keinen Starter, der eine Abmeldung
 * ueberlebt.
 *
 * Erics einzige absolute Bedingung an dieses Projekt lautet: sein Spielstand
 * darf nicht zerstoert werden. Eine Bedingung dieser Art darf nicht an einem
 * Prozess haengen. Auftrag 7.2 nennt den zweiten Weg deshalb ausdruecklich
 * "Pflicht, nicht Kuer".
 *
 * `ns.singularity.exportGame()` legt den Spielstand als
 * `bitburnerSave_<epoch>_BN<n>x<level>.json.gz` in den Downloads-Ordner -
 * ohne Bruecke, ohne Netz, ohne irgendetwas ausserhalb des Browsers.
 * `tools/backup-check.js` liest diese Dateien unveraendert; es ist dasselbe
 * Format.
 *
 * ===========================================================================
 * WARUM ES EIN EIGENES GEWERK IST UND NICHT IM KERN STEHT
 * ===========================================================================
 *
 * `exportGame` kostet 1 GB Grundpreis (`RamCostGenerator.ts:216`) - bei SF4.1
 * also SECHZEHN. Der Kern wiegt 10,80 GB und muss zusammen mit Waechter und
 * Wachhalter auf ein frisch zurueckgesetztes 32-GB-home passen; 16 GB mehr
 * spraengten den Kaltstart und damit die Geldquelle, von der alles abhaengt.
 *
 * Der Auftrag sieht das selbst so: "im Kaltstart also erst ab Werkbank, ab
 * SF4.3 ueberall". Als eigenes Gewerk mit `phase: "normal"` startet der Kern
 * es genau dann, wenn Platz da ist - und laesst es im Kaltstart weg, wo die
 * Bruecke ohnehin gerade erst verbunden ist.
 *
 * ===========================================================================
 * WANN EXPORTIERT WIRD
 * ===========================================================================
 *
 * Wenn `data/bridge.json.lastVerifiedBackup` aelter als 90 Minuten ist ODER
 * das Feld fehlt. Hoechstens einmal je 60 Minuten - der Export-Bonus
 * (+1 Favor bei allen Faktionen, hoechstens alle 24 h,
 * `ExportBonus.tsx:6-19`) ist ein erwuenschter Nebeneffekt, aber kein Grund
 * fuer haeufigere Aufrufe. Jede Datei wiegt rund 662 KB.
 *
 * Gemeldet wird beides: eine Zeile in den Ereignisstrom, und eine nach
 * `## Sofort` ueber `data/sofort.json` - denn wenn dieser Weg greift, ist die
 * Bruecke seit anderthalb Stunden ohne Sicherung, und das gehoert einem
 * Menschen gesagt.
 *
 * ===========================================================================
 * WAS NOCH NICHT GEMESSEN IST
 * ===========================================================================
 *
 * Ob Chromium die Datei ohne Dialog in den Standardordner legt. Zeigt der
 * erste Lauf einen Dateidialog, entfaellt dieser Weg - dann steht er als
 * Befund da, statt still offen zu bleiben. Das ist eine Ebene-3-Messung und
 * steht in der Lueckenliste.
 */

import { laden as evLaden, anhaengen as evAnhaengen } from "lib/events.js";
import { liesVonHome } from "lib/hostdatei.js";

/** Ab wann die Bruecke als saeumig gilt. */
const BRUECKE_MAX_MS = 90 * 60000;
/** Wie oft hoechstens exportiert wird. */
const ABSTAND_MS = 60 * 60000;
/** Wie oft nachgesehen wird. */
const TAKT_MS = 5 * 60000;

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const sag = (t) => ns.print(new Date().toLocaleTimeString() + "  " + t);

  // EINE home-DATEI VON EINEM ANDEREN RECHNER LESEN (04.09.2026, 18:45).
  //
  // `ns.read` liest IMMER vom eigenen Rechner. Dieses Gewerk hat hostRule
  // "any" und lief bei seinem ersten Start auf werk-0 - dort gibt es
  // `data/bridge.json` nicht. `ns.read` gab "", `JSON.parse("")` warf, und
  // der catch-Zweig schloss daraus "bridge.json fehlt oder ist unlesbar".
  //
  // Die Folge war genau die, die vermieden werden sollte: `saeumig` wurde
  // wahr, obwohl die Bruecke tadellos sicherte, und um 18:31 stand die erste
  // Falschmeldung in `data/sofort.json` - dem einzigen Kanal, ueber den Eric
  // noch etwas erfaehrt, seit die Push-Nachrichten aus sind. Stuendlich
  // wiederholt haette sie den Briefkasten (Deckel 20) in einem Tag
  // leergeraeumt.
  //
  // Das ist NICHT derselbe Fehler wie der ISO-String weiter unten, sondern
  // ein zweiter davor: der eine las das falsche Feld, dieser liest am
  // falschen ORT. Beide muessen weg, sonst deckt einer den anderen zu.
  //
  // `ns.scp` kostet hier keinen zusaetzlichen Arbeitsspeicher - `nachHome`
  // benutzt es schon.
  /**
   * Eine home-Datei lesen - ueber `lib/hostdatei.js`, nicht von Hand.
   *
   * Hier stand zuerst `ns.read(datei)` (liest LOKAL, und dieses Gewerk lief
   * auf werk-0), dann eine eigene Fassung mit `ns.scp` in einem try/catch
   * (`scp` wirft nicht, es gibt false zurueck - der catch war wirkungslos,
   * und ohne `fileExists`-Waechter haette ein lokaler Altbestand still als
   * aktueller Stand durchgehen koennen).
   *
   * `ausgang.js`, `figwatch.js`, `graftauto.js` und `punish.js` hatten die
   * richtige Fassung die ganze Zeit. Sechs Kopien desselben Musters in drei
   * Qualitaeten waren der eigentliche Fehler - jetzt gibt es eine.
   */
  const lies = (datei) => liesVonHome(ns, datei);

  const nachHome = (datei, inhalt) => {
    ns.write(datei, inhalt, "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp(datei, "home", ns.getHostname()); } catch { /* egal */ }
    }
  };

  for (;;) {
    const jetzt = Date.now();
    let alterMs = null;
    let grund = "";

    try {
      const b = JSON.parse(lies("data/bridge.json"));
      const lv = b && b.lastVerifiedBackup;
      // `lv.ts` IST DER ISO-STRING - nicht `zeit`, nicht `at` (04.09.2026).
      //
      // Hier stand `Date.parse(lv.zeit || lv.at)`, und beide Felder gibt es
      // nicht: die Bruecke schreibt {file, ts, ageMin, anlass} mit `ts` als
      // ISO-String. `Number.isFinite("2026-09-04T16:01:38.106Z")` ist falsch,
      // also lief es in den Fallback, und der bekam `undefined`. Ergebnis:
      // `ts` war IMMER NaN, `saeumig` IMMER wahr.
      //
      // Das waere nicht harmlos gewesen. Das Gewerk haette stuendlich
      // exportiert (bei ~662 KB je Datei) und stuendlich "Bruecke ohne
      // Sicherung" nach `data/sofort.json` geschrieben - in den einzigen
      // Kanal, ueber den Eric ueberhaupt noch etwas erfaehrt, seit die
      // Push-Nachrichten aus sind. Bei einem Deckel von 20 Eintraegen waere
      // der Briefkasten nach einem Tag nur noch Fehlalarm gewesen, und ein
      // echter Befund darunter begraben.
      //
      // `lv.ts` steht deshalb zuerst; die Zahlvariante bleibt fuer den Fall,
      // dass jemand spaeter einen Zeitstempel statt eines Strings schreibt.
      const ts = lv && (Number.isFinite(lv.ts) ? lv.ts : Date.parse(lv.ts || lv.zeit || lv.at));

      // KEIN HAENGENDES `else` MEHR (04.09.2026, 19:25).
      //
      // Um 19:10 wurde die Negativ-Alter-Wache ZWISCHEN das `if` und sein
      // `else` gesetzt. Damit hat sie das `else` gekapert, und beide Zweige
      // sagten das Gegenteil dessen, was sie sollten:
      //
      //   gesunder Fall   -> grund = "bridge.json ohne lastVerifiedBackup"
      //   kaputter Fall   -> grund bleibt leer, und weiter unten rechnet
      //                      `(null / 60000).toFixed(0)` die Zahl 0 aus:
      //                      "letzte gruene Sicherung 0 min alt"
      //
      // Der zweite Fall ist der schlimmere: die Meldung behauptet eine
      // taufrische Sicherung genau dann, wenn keine nachweisbar ist - und
      // sie sieht nicht einmal kaputt aus, weil `null / 60000` nicht NaN
      // ist, sondern 0. Gefunden hat es ein Skeptiker, keine Messung.
      //
      // Deshalb steht hier jetzt eine Kette ohne `else`: jeder Fall setzt
      // seinen Grund selbst.
      if (!Number.isFinite(ts)) {
        grund = "bridge.json ohne lastVerifiedBackup";
      } else if (jetzt - ts < 0) {
        // Zeitstempel in der Zukunft. Ein negatives Alter wuerde jede
        // Altersschwelle unterlaufen und eine beliebig alte Sicherung als
        // frisch durchgehen lassen. Die sichere Seite ist "unbekannt".
        grund = "lastVerifiedBackup liegt in der Zukunft";
      } else {
        alterMs = jetzt - ts;
      }
    } catch {
      grund = "bridge.json fehlt oder ist unlesbar";
    }

    const saeumig = alterMs === null || alterMs > BRUECKE_MAX_MS;
    if (!grund && saeumig) {
      // `alterMs` ist hier zwangslaeufig eine Zahl - waere es null, haette
      // der Block oben einen Grund gesetzt. Die Pruefung steht trotzdem da:
      // genau diese stillschweigende Annahme hat oben "0 min alt" erzeugt.
      grund = alterMs === null ? "Alter der Sicherung unbekannt"
        : "letzte gruene Sicherung " + (alterMs / 60000).toFixed(0) + " min alt";
    }

    // Der eigene Abstand. Er steht in einer Datei und nicht in einer Variablen:
    // dieses Gewerk wird vom Kern neu gestartet, wann immer es ihm passt, und
    // ein Zaehler im Prozess waere damit wirkungslos.
    let letzterExport = 0;
    try {
      const e = JSON.parse(lies("data/export.json"));
      if (e && Number.isFinite(e.letzterExport)) letzterExport = e.letzterExport;
    } catch { /* erster Lauf */ }

    let exportiert = false;
    let fehler = null;
    if (saeumig && jetzt - letzterExport >= ABSTAND_MS) {
      try {
        // KEIN await - `exportGame` ist synchron (`Singularity.ts`), und ein
        // await auf einen Nicht-Promise wuerde nur eine Runde der Event-Loop
        // kosten. Wichtiger: der Aufruf wirft, wenn SF4 fehlt; das faengt der
        // catch, und das Gewerk meldet es, statt zu sterben.
        ns.singularity.exportGame();
        exportiert = true;
        letzterExport = jetzt;
        sag("Spielstand exportiert - " + grund);
      } catch (e) {
        fehler = String(e && e.message ? e.message : e).slice(0, 160);
        sag("exportGame warf: " + fehler);
      }
    }

    if (exportiert) {
      // In den Ereignisstrom.
      try {
        const strom = evLaden(lies("data/events.json"));
        evAnhaengen(strom, "note", "Spielstand ohne Bruecke exportiert",
          { wall: jetzt },
          { grund, alterMs, ort: "Downloads" });
        nachHome("data/events.json", JSON.stringify(strom));
      } catch { /* Bericht, nie Steuerung */ }

      // Und nach `## Sofort` - wenn dieser Weg greift, ist die Bruecke seit
      // anderthalb Stunden ohne Sicherung. Das gehoert einem Menschen gesagt.
      try {
        let liste = [];
        try { liste = JSON.parse(lies("data/sofort.json")) || []; } catch { liste = []; }
        if (!Array.isArray(liste)) liste = [];
        liste.push({
          titel: "Bruecke ohne Sicherung - Spielstand liegt in Downloads",
          text: "Der brueckenfreie Weg hat gegriffen (" + grund + "). Der Stand "
            + "liegt als bitburnerSave_<epoch>_BN<n>x<level>.json.gz im "
            + "Downloads-Ordner; tools/backup-check.js liest ihn unveraendert. "
            + "Nachsehen, warum die Bruecke nicht sichert.",
          quelle: "export.js",
        });
        // Deckel: die Liste ist ein Postfach, kein Archiv.
        if (liste.length > 20) liste = liste.slice(-20);
        nachHome("data/sofort.json", JSON.stringify(liste));
      } catch { /* egal - der Export ist das Wichtige */ }
    }

    nachHome("data/export.json", JSON.stringify({
      zeit: jetzt,
      ts: jetzt,
      letzterExport,
      bridgeAlterMs: alterMs,
      saeumig,
      grund: grund || null,
      exportiertJetzt: exportiert,
      lastError: fehler,
      errStreak: fehler ? 1 : 0,
      state: "run",
    }));

    await ns.sleep(TAKT_MS);
  }
}
