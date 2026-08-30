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
  // UND WEG DAMIT, WENN DIE AUGMENTIERUNG WEG IST (30.08.2026, 21:40).
  //
  // `prestigeHomeComputer` (`ServerHelpers.ts:226-239`) loescht beim
  // BitNode-Wechsel Programme und Nachrichten, **aber keine Textdateien**.
  // Der Marker ueberlebt also, die Augmentierung nicht. Im naechsten Knoten
  // laese `blade.js` `true`, riegelte nie - und `Bladeburner.startAction`
  // toetete das erste Graft dort in rund einer Sekunde
  // (`Bladeburner.ts:177-180`). Bei fuenfzehn geplanten Knoten ist das eine
  // Mine mit Datum.
  //
  // Nur loeschen, wenn der Besitz auch wirklich geprueft werden konnte -
  // sonst wuerde ein Fehler beim Lesen den Riegel abschalten statt ihn zu
  // schaerfen.
  if (!habeSimulacrum && !raus.fehler && ns.fileExists(MARKER, "home")) {
    try { ns.rm(MARKER, "home"); } catch { /* dann bleibt er stehen */ }
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
  //
  // LAEUFT SCHON EINS? Dann auf keinen Fall ein zweites starten.
  // `getGraftableAugmentations` hilft hier NICHT: `GraftingHelpers.ts:20`
  // filtert nur `!Player.hasAugmentation(aug)`, und eine gerade im Graft
  // befindliche Augmentierung steht weder in `augmentations` noch in
  // `queuedAugmentations` - sie bleibt in der Liste. Ein zweiter Aufruf
  // liefe also durch, `Player.startWork` (`PlayerObjectWorkMethods.ts:5-10`)
  // riefe `finish(true)` auf dem laufenden Graft, und der Konstruktor von
  // `GraftingWork` (`:33`) buchte den Preis ein zweites Mal ab. Zweimal
  // "The Blade's Simulacrum" im Abstand von 30 Sekunden waeren $900 Mrd fuer
  // eine Augmentierung - lautlos, weil der Abbruchdialog bei
  // `singularity: true` unterdrueckt ist (`GraftingWork.tsx:75-83`).
  let laufend = null;
  try { laufend = ns.singularity.getCurrentWork(); } catch { laufend = null; }
  if (laufend && laufend.type === "GRAFTING") {
    raus.fehler = "Es laeuft bereits ein Graft ("
      + (laufend.augmentation || "unbekannt") + ") - nichts angefasst.";
    fertig(ns, raus);
    return;
  }
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
  // KORRIGIERTE BEGRUENDUNG (30.08.2026, 21:00, nach einem Skeptiker-Lauf).
  //
  // Die erste Fassung sprach von einem Rennfenster: `getCurrentAction()`
  // liefere nach dem Graftstart noch die alte Aktion, der Riegel in blade.js
  // liesse die Runde durch. **Das Rennen gibt es nicht mehr** - der Riegel
  // liest seit Commit 578e750 keinen Aktionszustand, sondern die Datei
  // `data/simulacrum.txt` (`blade.js`, Riegel am Schleifenanfang).
  //
  // Der Aufruf bleibt trotzdem richtig, nur aus einem anderen Grund:
  // `Bladeburner.process()` oeffnet einen Dialog "Your Bladeburner action was
  // cancelled...", sobald eine Spielerarbeit laeuft und eine Aktion gesetzt
  // ist (`Bladeburner.ts:1354-1362`) - aber nur `if (this.action)`. Wer die
  // Aktion vorher zurueckstellt, bekommt keinen Dialog. Und
  // `stopBladeburnerAction` ruft nur `resetAction` (`Bladeburner.ts:249-253`),
  // kostet also nichts: Die naechste Aktion setzt der Motor ohnehin neu.
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
