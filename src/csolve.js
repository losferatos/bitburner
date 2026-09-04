/**
 * Vertragsantworten einreichen - die zweite schlanke Haelfte zu cdump.js.
 *
 * ===========================================================================
 * WARUM ZWEI DATEIEN
 * ===========================================================================
 *
 * `attempt` kostet 10 GB, `getContractType` und `getData` je 5. Zusammen mit
 * dem Grundpreis waeren das 22,25 GB - auf einem frischen `home` neben Kern,
 * Waechter und Wachhalter (19,15) unmoeglich.
 *
 * Getrennt passt jede Haelfte, aber KNAPP - und die Zahlen hier waren zu
 * guenstig gerundet (Skeptiker Runde 3, C6, 04.09.2026). Gemessen mit
 * tools/ram.js:
 *
 *   cdump.js   12,65 GB   Grundpreis 1,60 + getContractType 5 + getData 5
 *                         + ls 0,20 + scan 0,20 + write/read + scp 0,60
 *   csolve.js  12,85 GB   Grundpreis 1,60 + attempt 10 + scp 0,60
 *                         + rm 0,60 + getHostname 0,05
 *
 * Hier stand "12,00 und 12,25" - es fehlte in beiden Faellen `ns.scp`, das
 * seit dem 04.09. noetig ist, weil die Vorbedingungen auf HOME geprueft
 * werden und ein Gewerk auch auf einem Ausweichwirt landen kann.
 *
 * Damit bleibt neben Kern, Waechter und Wachhalter (19,15) genau 12,85 GB,
 * und csolve.js fuellt sie AUF DAS GIGABYTE GENAU. Das ist kein Zufall und
 * keine Reserve: jeder weitere ns-Aufruf in dieser Datei macht die
 * Kaltstart-Geldkette unlauffaehig. Der naechste, der hier `ns.getPlayer`
 * fuer ein Telemetriefeld ergaenzen will, findet die Begruendung unten beim
 * Herzschlag - genau das ist schon einmal passiert und wurde
 * zurueckgenommen.
 *
 * `cdump.js` sucht, loest und prueft gegen; diese Datei reicht nur noch ein.
 * Sie raet NICHTS: was nicht in `data/cantwort.json` steht, wird nicht
 * angefasst. Ein Versuch ist unwiederbringlich.
 *
 * ===========================================================================
 * SIE SCHLIESST DIE ROTATION (Position C.8, 04.09.2026)
 * ===========================================================================
 *
 * Nach dem Einreichen wird `data/cantwort.json` GELOESCHT. Das ist die
 * Bedingung dafuer, dass `cdump.js` wieder laufen darf (Registry:
 * `forbidsFile: data/cantwort.json`), und damit der Taktgeber der ganzen
 * Kette. Ohne das Loeschen liefe `csolve.js` in jeder Runde gegen dieselben,
 * laengst eingereichten Vertraege - und `attempt` auf einen Vertrag, den es
 * nicht mehr gibt, ist ein verbrannter Versuch.
 *
 * `ns.rm` kostet 0,60 GB (es teilt sich die Konstante mit `scp`). Hier ist das
 * gut angelegt: ohne die Loeschung steht die Geldkette des Kaltstarts.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  // Der Auftragslaeufer legt das Skript dorthin, wo Platz ist - das ist selten
  // home. `ns.read` hat KEINEN Host-Parameter (NetscriptFunctions.ts:1120-1122)
  // und liest immer lokal, deshalb zuerst holen.
  if (ns.getHostname() !== "home") {
    ns.scp("data/cantwort.json", ns.getHostname(), "home");
  }
  const roh = ns.read("data/cantwort.json");
  if (!roh) {
    ns.print("csolve: data/cantwort.json fehlt oder ist leer.");
    return;
  }

  let liste;
  try { liste = JSON.parse(roh); } catch (e) {
    // Eine unlesbare Antwortdatei blockierte die Rotation fuer immer: cdump
    // darf nicht laufen, solange sie da ist, und csolve kommt nicht durch.
    // Deshalb wird sie hier geraeumt - der naechste Dump kostet nichts.
    ns.print("csolve: data/cantwort.json ist unlesbar - geloescht, damit die"
      + " Rotation weiterlaeuft.");
    entferne(ns);
    return;
  }
  if (!Array.isArray(liste) || !liste.length) { entferne(ns); return; }

  const log = [];
  let erfolge = 0;
  let ertrag = [];
  for (const a of liste) {
    if (!a || !a.datei || !a.host || a.antwort === undefined) {
      log.push("uebersprungen (unvollstaendiger Eintrag)");
      continue;
    }
    let ergebnis;
    try {
      ergebnis = ns.codingcontract.attempt(a.antwort, a.datei, a.host);
    } catch (e) {
      ergebnis = "FEHLER " + String(e && e.message ? e.message : e).slice(0, 120);
    }
    // `attempt` gibt bei Erfolg den Belohnungstext, bei Misserfolg "".
    if (ergebnis && !String(ergebnis).startsWith("FEHLER")) {
      erfolge++;
      ertrag.push(String(ergebnis));
    }
    log.push(a.host + " " + a.datei + " (" + (a.typ || "?") + ") -> "
      + (ergebnis || "FEHLSCHLAG"));
  }

  // DER ERTRAG NACH DRAUSSEN (ARCHITEKTUR O4).
  //
  // Modell und Feldwert liegen um Faktor 6,6 auseinander - 24 Vertraege
  // ergaben am 02.09. 86 Mio, das Modell erwartete deutlich mehr. Solange
  // niemand den echten Wert je Vertrag aufschreibt, bleibt das eine Vermutung,
  // und die Zeitplanung des Kaltstarts (`t_workbench`) haengt daran.
  // HERZSCHLAG v2, NICHT NUR EINE ERTRAGSZEILE (Skeptiker Runde 3, W7).
  //
  // Hier standen nur Zeit und Ertrag. Der Waechter erkennt einen
  // Einmallaeufer aber an `state`: bei "done" laesst S1 ihn in Ruhe, ohne
  // das Feld faellt er durch die ganze Uhrenkaskade bis zur Wanduhr - und
  // schlaegt dann Alarm ueber ein Gewerk, das seine Arbeit getan hat und
  // sich planmaessig beendet.
  //
  // KEIN `playtime` HIER - und das ist eine Budgetentscheidung, keine
  // Nachlaessigkeit. `ns.getPlayer` kostet 0,50 GB, und dieses Gewerk laeuft
  // im Kaltstart neben Kern, Waechter und Wachhalter auf 32 GB home; bei
  // 12,85 GB bleiben davon exakt 0,00 GB uebrig. Ein halbes Gigabyte fuer ein
  // Feld, das ohnehin nur greift, wenn `state` fehlt, waere der falsche
  // Tausch: mit `state: "done"` ueberspringt S1 den Eintrag, bevor irgendeine
  // Uhr befragt wird (`lib/signale.js`, Skip-Liste wait/done/blocked).
  ns.write("data/csolve.json", JSON.stringify({
    schema: 2,
    zeit: Date.now(), ts: Date.now(), wall: Date.now(),
    playtime: 0,
    motorTimeMs: 0,
    round: 1, okRound: 1,
    errStreak: 0, lastError: null,
    host: ns.getHostname(), version: "csolve-2",
    state: "done", blockedReason: null,
    versuche: liste.length,
    erfolge,
    ertrag,
  }), "w");
  ns.write("data/csolve.txt", log.join("\n") + "\n", "w");
  if (ns.getHostname() !== "home") {
    ns.scp(["data/csolve.txt", "data/csolve.json"], "home", ns.getHostname());
  }

  // Erst ganz zum Schluss: die Rotation freigeben.
  entferne(ns);
  ns.print(erfolge + " von " + liste.length + " Vertraegen eingereicht.");
}

/**
 * Die Antwortdatei entfernen - ueberall, wo sie liegen koennte.
 *
 * `ns.rm` wirkt nur auf EINEM Rechner. Liegt eine Kopie auf der Werkbank und
 * eine auf home, blockiert die verbliebene die Rotation weiter.
 */
function entferne(ns) {
  const hier = ns.getHostname();
  try { ns.rm("data/cantwort.json", "home"); } catch { /* egal */ }
  if (hier !== "home") {
    try { ns.rm("data/cantwort.json", hier); } catch { /* egal */ }
  }
}
