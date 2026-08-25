/**
 * Beobachtet den Fortschritt der laufenden Bladeburner-Aktion Sekunde fuer
 * Sekunde.
 *
 * Am 25.08.2026 stand der Rang eine halbe Stunde exakt still - auf siebzehn
 * Nachkommastellen -, waehrend `getActionCurrentTime()` konstant 0 von 20.000
 * meldete. Zwei Ursachen erklaeren dasselbe Bild und verlangen voellig
 * verschiedene Reparaturen:
 *
 *   Die Zahl springt hoch und faellt auf 0 zurueck
 *       Jemand startet die Aktion staendig neu. Verdaechtig sind blade.js
 *       selbst und jedes Skript, das eine Arbeit im Spiel beginnt.
 *
 *   Die Zahl bleibt konstant
 *       Die Bladeburner-Engine bekommt keine Zyklen. Dann liegt es nicht an
 *       den Skripten, sondern am Spiel.
 *
 * Aufruf:  node tools/task.js bbtick.js
 * Ergebnis: data/bbtick.json nach 30 Sekunden.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const reihe = [];
  for (let i = 0; i < 30; i++) {
    let e = { t: Date.now() };
    try {
      const a = ns.bladeburner.getCurrentAction();
      e.aktion = a ? a.type + "/" + a.name : null;
      e.zeit = Math.round(ns.bladeburner.getActionCurrentTime());
      e.rang = ns.bladeburner.getRank();
      e.ausdauer = +ns.bladeburner.getStamina()[0].toFixed(4);
      // Die Spielzeit kommt aus der Engine-Schleife (updateGame), die
      // Motorrunden von bn4net dagegen aus dem Netscript-Scheduler. Das sind
      // ZWEI Schleifen. Steht die Spielzeit still, waehrend Skripte laufen,
      // ist nicht Bladeburner kaputt, sondern die Engine haengt.
      e.spielzeit = ns.getPlayer().totalPlaytime;
    } catch (err) {
      e.fehler = String(err && err.message ? err.message : err);
    }
    reihe.push(e);
    await ns.sleep(1000);
  }

  const zeiten = reihe.map((r) => r.zeit);
  const raenge = reihe.map((r) => r.rang);
  ns.write("data/bbtick.json", JSON.stringify({
    zeit: Date.now(),
    aktion: reihe[0] && reihe[0].aktion,
    zeiten,
    rangVon: raenge[0],
    rangBis: raenge[raenge.length - 1],
    ausdauerVon: reihe[0] && reihe[0].ausdauer,
    ausdauerBis: reihe[reihe.length - 1] && reihe[reihe.length - 1].ausdauer,
    spielzeitVon: reihe[0] && reihe[0].spielzeit,
    spielzeitBis: reihe[reihe.length - 1] && reihe[reihe.length - 1].spielzeit,
    // Die Deutung gehoert in die Datei, nicht in den Kopf des Lesers.
    // EIN RUECKSPRUNG AUF 0 IST NORMAL (25.08.2026, 21:22).
    //
    // Die erste Fassung urteilte "jemand startet staendig neu", sobald
    // irgendwo eine 0 vorkam. Das ist der Regelfall: Eine abgeschlossene
    // Aktion beginnt von vorn, also faellt der Zaehler einmal je Zyklus auf
    // null. Verdaechtig ist nur, wenn er NIE nennenswert steigt - gemessen
    // wird deshalb der hoechste erreichte Wert, nicht der niedrigste.
    urteil: zeiten.every((z) => z === zeiten[0])
      ? (zeiten[0] === 0 ? "steht bei 0 - Aktion kommt nie in Gang"
        : "konstant " + zeiten[0] + " - Engine bekommt keine Zyklen")
      : (Math.max(...zeiten) < 2000
        ? "kommt nie ueber 2 s - jemand startet staendig neu"
        : "waechst - alles in Ordnung"),
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/bbtick.json", "home", ns.getHostname());
}
