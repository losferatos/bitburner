/**
 * Die Figurwache - vergleicht, was vergeben wurde, mit dem, was die Figur tut.
 *
 * ===========================================================================
 * WARUM DIE DRITTE SCHICHT NOETIG IST
 * ===========================================================================
 *
 * Der Vergabepunkt (`lib/figur.js`) regelt, WER darf. Der Verbotsgrep prueft,
 * dass jedes Gewerk vorher fragt. Beide koennen nur, was im Quelltext steht.
 *
 * Diese Datei prueft, was tatsaechlich passiert. Der Fall, den sie fangen
 * soll: ein Gewerk fragt korrekt, bekommt ein Nein - und faengt trotzdem an,
 * weil zwischen Frage und Handlung eine Runde vergangen ist. Oder das Spiel
 * beendet die Handlung von sich aus, und niemand merkt es.
 *
 * Das Symptom ohne diese Wache ist eine Zeile im Bericht: "der Graft war
 * ploetzlich weg". Mit ihr steht in `data/events.json`, wer ihn abgeraeumt hat.
 *
 * ===========================================================================
 * SIE LAEUFT AUF DER WERKBANK, NICHT AUF home
 * ===========================================================================
 *
 * `ns.singularity.getCurrentWork` und `ns.bladeburner.getCurrentAction`
 * kosten zusammen 35,15 GB bei SF4.1 (5,15 ab SF4.3). Auf `home` waere das im
 * Kaltstart das Ende; auf der Werkbank stoert es nicht.
 *
 * Daraus folgt: sie ist NICHT kaltstartfaehig und soll es nicht sein. In den
 * ersten Minuten eines neuen Knotens gibt es weder Grafts noch
 * Bladeburner-Aktionen - es gibt nichts zu bewachen.
 *
 * @param {NS} ns
 */

import { vergabeGilt, pruefeHandlung } from "lib/figur.js";

const TAKT_MS = 15000;

export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 100) log.shift();
    ns.print(t);
    try {
      ns.write("data/figwatch-log.txt", log.join("\n") + "\n", "w");
      if (ns.getHostname() !== "home") ns.scp("data/figwatch-log.txt", "home", ns.getHostname());
    } catch { /* egal */ }
  };

  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return null;
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return null; }
  };
  const nachHome = (datei, inhalt) => {
    try {
      ns.write(datei, inhalt, "w");
      if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
    } catch { /* egal */ }
  };

  let runden = 0;
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;
  let konflikte = 0;
  let letzteSeq = null;
  let letzterKonflikt = null;

  // Ein Konflikt wird nur gemeldet, wenn er ZWEIMAL HINTEREINANDER auftritt.
  // Zwischen Vergabe und Handlung liegt immer eine Runde: das Gewerk liest die
  // Vergabe, startet die Handlung, und die Wache sieht sie erst danach. Wer
  // beim ersten Mal meldet, meldet in jeder Uebergabe.
  let verdacht = null;

  sag("figwatch gestartet auf " + ns.getHostname() + ".");

  for (;;) {
    try {
      runden++;
      const jetzt = Date.now();
      const ri = ns.getResetInfo();

      let vergabe = null;
      try {
        const roh = liesVonHome("data/figure.txt");
        vergabe = roh ? JSON.parse(roh) : null;
      } catch { vergabe = null; }

      // Die Veraltungspruefung aus lib/figur.js gilt auch hier: eine kleinere
      // Folgenummer heisst, dass diese Datei aelter ist als die zuletzt
      // gelesene - dann wird nicht geurteilt.
      if (vergabe && Number.isFinite(vergabe.seq) && letzteSeq !== null
          && vergabe.seq < letzteSeq) {
        okRunden++;
        errStreak = 0;
        await ns.sleep(TAKT_MS);
        continue;
      }
      if (vergabe && Number.isFinite(vergabe.seq)) letzteSeq = vergabe.seq;

      // --- Was tut die Figur wirklich? ---------------------------------------
      //
      // Zwei Quellen, weil eine Bladeburner-Aktion nicht als "Work" zaehlt:
      // getCurrentWork liefert dafuer null, obwohl die Figur beschaeftigt ist.
      let tatsaechlich = null;
      let einzelheit = null;
      try {
        const w = ns.singularity.getCurrentWork();
        if (w && w.type) {
          tatsaechlich = ({
            GRAFTING: "graft",
            FACTION: "faktion",
            COMPANY: "arbeit",
            CLASS: "gym",
            CRIME: "verbrechen",
            CREATE_PROGRAM: "programm",
          })[w.type] || String(w.type).toLowerCase();
          einzelheit = w.augmentation || w.factionName || w.classType || w.crimeType || null;
        }
      } catch { /* nicht lesbar - dann bleibt es bei null */ }

      if (tatsaechlich === null) {
        try {
          const a = ns.bladeburner.getCurrentAction();
          if (a && a.type && a.type !== "Idle") {
            tatsaechlich = "bladeburner";
            einzelheit = a.name || a.type;
          }
        } catch { /* nicht in der Division */ }
      }

      // --- Vergleichen --------------------------------------------------------
      const gueltig = vergabeGilt(vergabe, jetzt, ri.lastNodeReset);
      const urteil = pruefeHandlung(gueltig ? vergabe : null, tatsaechlich);

      if (!urteil.stimmt) {
        const schluessel = (gueltig ? vergabe.owner + ":" + vergabe.action : "-")
          + "|" + tatsaechlich;
        if (verdacht === schluessel) {
          // Zweimal hintereinander dasselbe: das ist kein Uebergabefenster.
          konflikte++;
          letzterKonflikt = {
            wall: jetzt,
            besitzer: gueltig ? vergabe.owner : null,
            vergeben: gueltig ? vergabe.action : null,
            tatsaechlich,
            einzelheit,
            grund: urteil.grund,
          };
          sag("FIGUR-KONFLIKT (" + konflikte + "): " + urteil.grund
            + (einzelheit ? " [" + einzelheit + "]" : ""));
          ereignis(nachHome, liesVonHome, letzterKonflikt, jetzt);
          verdacht = null;   // gemeldet, nicht in jeder Runde erneut
        } else {
          verdacht = schluessel;
        }
      } else {
        verdacht = null;
      }

      nachHome("data/figwatch.json", JSON.stringify({
        schema: 2,
        ts: jetzt, wall: jetzt,
        playtime: (() => { try { return ns.getPlayer().totalPlaytime; } catch { return 0; } })(),
        motorTimeMs: 0,
        round: runden, okRound: okRunden,
        errStreak, lastError,
        host: ns.getHostname(), version: "figwatch-1",
        state: "work", blockedReason: null,
        besitzer: gueltig ? vergabe.owner : null,
        vergeben: gueltig ? vergabe.action : null,
        tatsaechlich, einzelheit,
        stimmt: urteil.stimmt,
        figure_conflict: konflikte,
        letzterKonflikt,
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
}

/**
 * Den Konflikt in den Ereignisstrom haengen.
 *
 * Er gehoert dorthin und nicht nur in die eigene Telemetrie: die wird beim
 * naechsten Schreibvorgang ueberschrieben, und ein Konflikt von heute Nacht
 * waere morgen frueh nicht mehr auffindbar.
 */
function ereignis(nachHome, liesVonHome, konflikt, jetzt) {
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
    text: ("Figur-Konflikt: " + konflikt.grund).slice(0, 160),
    wall: jetzt,
    playtime: 0,
    motorTimeMs: 0,
    daten: konflikt,
  });
  while (strom.eintraege.length > 400) strom.eintraege.shift();
  nachHome("data/events.json", JSON.stringify(strom));
}
