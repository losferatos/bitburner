/** Ein einzelnes Graft starten - genau eines je Aufruf, nie von selbst.
 *
 * WARUM DIESES SKRIPT SO VORSICHTIG IST
 *
 * Grafting ist in BitNode 10 der groesste Hebel des Knotens: Augmentierungen
 * kosten `baseCost x 3`, keine Reputation, keinen BitNode-Aufschlag
 * (`GraftableAugmentation.ts:21`), und die 17 Bladeburner-Sonderaugmentierungen
 * sind graftbar, weil der Spieler Mitglied ist (`GraftingHelpers.ts:11-18`).
 * Die Rechnung steht in `nodes/GRAFTING.md`.
 *
 * Es ist zugleich der teuerste Weg, Geld zu verbrennen: Ein abgebrochenes
 * Graft wird NICHT erstattet (`Work/GraftingWork.tsx:75-83`), und
 * `The Blade's Simulacrum` kostet $450 Mrd.
 *
 * Deshalb: KEINE Schleife, KEIN Automatismus. Ein Aufruf, ein Graft, Ende.
 * Wer mehrere will, ruft mehrmals auf und sieht dazwischen nach.
 *
 * Aufruf:
 *   node tools/task.js graft.js                      nur pruefen, nichts tun
 *   node tools/task.js graft.js "Neuroreceptor Management Implant"
 *
 * Ergebnis nach data/graft.json.
 * @param {NS} ns */
export async function main(ns) {
  const SIMULACRUM = "The Blade's Simulacrum";
  const MARKER = "data/simulacrum.txt";
  const wunsch = ns.args[0] ? String(ns.args[0]) : null;
  const raus = { zeit: Date.now(), wunsch, getan: null, fehler: null };

  // --- 1. Den Marker fuehren, den blade.js liest -----------------------------
  //
  // `src/blade.js` haelt still, sobald ein Graft laeuft und dieser Marker
  // fehlt - denn ohne das Simulacrum bricht `Bladeburner.startAction` jede
  // Spielerarbeit ab (`Bladeburner.ts:177-180`), und der Motor ruft sie im
  // Sekundentakt. Ist das Simulacrum da, laeuft die Bladeburner-Aktion
  // weiter, und dann DARF der Motor nicht stillhalten.
  //
  // Der Marker wird bei JEDEM Aufruf neu gesetzt, auch beim reinen Pruefen -
  // so steht er spaetestens vor dem naechsten Graft richtig.
  let habeSimulacrum = false;
  try {
    habeSimulacrum = ns.singularity.getOwnedAugmentations(false).includes(SIMULACRUM);
  } catch (e) {
    raus.fehler = "Besitz nicht pruefbar: " + String(e && e.message ? e.message : e);
  }
  if (habeSimulacrum && !ns.fileExists(MARKER, "home")) {
    ns.write(MARKER, String(Date.now()), "w");
    if (ns.getHostname() !== "home") ns.scp(MARKER, "home");
  }
  raus.simulacrum = habeSimulacrum;

  // --- 2. Lage aufnehmen ----------------------------------------------------
  let liste = [];
  try { liste = ns.grafting.getGraftableAugmentations(); }
  catch (e) { raus.fehler = "Kein Grafting-Zugang: " + String(e && e.message ? e.message : e); }
  raus.verfuegbar = liste.length;

  const p = ns.getPlayer();
  raus.geld = Math.round(p.money);
  raus.stadt = p.city;

  if (!wunsch) {
    raus.getan = "nur geprueft";
    fertig(ns, raus);
    return;
  }

  // --- 3. Pruefungen vor dem Geldausgeben -----------------------------------
  if (!liste.includes(wunsch)) {
    raus.fehler = "Nicht graftbar (Name falsch, schon installiert oder isSpecial ohne Bladeburners): " + wunsch;
    fertig(ns, raus);
    return;
  }
  let preis = null, dauerMs = null;
  try {
    preis = ns.grafting.getAugmentationGraftPrice(wunsch);
    dauerMs = ns.grafting.getAugmentationGraftTime(wunsch);
  } catch (e) {
    raus.fehler = "Preis/Dauer nicht lesbar: " + String(e && e.message ? e.message : e);
    fertig(ns, raus);
    return;
  }
  raus.preis = preis;
  raus.dauerMin = +(dauerMs / 60000).toFixed(1);
  if (p.money < preis) {
    raus.fehler = "Zu teuer: " + Math.round(preis) + " noetig, " + Math.round(p.money) + " da.";
    fertig(ns, raus);
    return;
  }

  // --- 4. Reisen: Grafting startet nur in New Tokyo -------------------------
  // `NetscriptFunctions/Grafting.ts:58-60`. Eine Reise bricht ein laufendes
  // Graft NICHT ab, sie ist nur fuer den Start noetig.
  if (p.city !== "New Tokyo") {
    try {
      if (!ns.singularity.travelToCity("New Tokyo")) {
        raus.fehler = "Reise nach New Tokyo misslungen.";
        fertig(ns, raus);
        return;
      }
    } catch (e) {
      raus.fehler = "Reise warf: " + String(e && e.message ? e.message : e);
      fertig(ns, raus);
      return;
    }
    raus.gereist = true;
  }

  // --- 5. Das Rennfenster schliessen ---------------------------------------
  //
  // `Bladeburner.process()` laeuft nur einmal je Sekunde
  // (`engine.tsx`, `Counters.bladeburnerProcess = 5`). Zwischen dem Graftstart
  // und dem naechsten `process()` liefert `getCurrentAction()` noch die alte
  // Aktion - der Riegel in blade.js liesse die Runde also durch, und
  // `startAction` toetete das frische Graft, ohne dass ein Dialog erschiene
  // (`GraftingWork.tsx:74-83` meldet den Abbruch nur ausserhalb von
  // Singularity). Ein `stopBladeburnerAction()` vorweg macht das Fenster zu:
  // Es ruft nur `resetAction` (`Bladeburner.ts:249-253`) und kostet nichts -
  // die naechste Aktion setzt der Motor ohnehin neu.
  //
  // Mit installiertem Simulacrum ist das unnoetig, schadet aber auch nicht.
  try { ns.bladeburner.stopBladeburnerAction(); } catch { /* nicht in der Division */ }

  // --- 6. Graften -----------------------------------------------------------
  let ok = false;
  try { ok = ns.grafting.graftAugmentation(wunsch, true); }
  catch (e) { raus.fehler = "graftAugmentation warf: " + String(e && e.message ? e.message : e); }
  raus.getan = ok ? "gestartet" : "NICHT gestartet";
  if (!ok && !raus.fehler) {
    // `graftAugmentation` gibt bei fehlenden Voraussetzungen still `false`
    // zurueck (`Grafting.ts:74-77`), es wirft nicht.
    raus.fehler = "Rueckgabe false - fehlende Voraussetzung oder Geld in der Zwischenzeit weg.";
  }
  fertig(ns, raus);
}

/** @param {NS} ns */
function fertig(ns, raus) {
  ns.write("data/graft.json", JSON.stringify(raus), "w");
  if (ns.getHostname() !== "home") ns.scp("data/graft.json", "home");
  ns.tprint("graft: " + (raus.getan || "-") + (raus.fehler ? "  FEHLER: " + raus.fehler : ""));
}
