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

  const lies = (datei) => {
    try { return ns.read(datei) || ""; } catch { return ""; }
  };
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
      if (Number.isFinite(ts)) alterMs = jetzt - ts;
      else grund = "bridge.json ohne lastVerifiedBackup";
    } catch {
      grund = "bridge.json fehlt oder ist unlesbar";
    }

    const saeumig = alterMs === null || alterMs > BRUECKE_MAX_MS;
    if (!grund && saeumig) {
      grund = "letzte gruene Sicherung " + (alterMs / 60000).toFixed(0) + " min alt";
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
