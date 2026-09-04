/**
 * Sprosse 5: der Soft-Reset durch Augmentierungs-Einbau (Position C.12).
 *
 * ===========================================================================
 * DIE GEFAEHRLICHSTE DATEI DES PROJEKTS
 * ===========================================================================
 *
 * `installAugmentations` ist unwiderruflich und kostet fast alles: gekaufte
 * Rechner, Programme, Faktionsmitgliedschaften, Reputation, Hacking-Level,
 * Kampfwerte, das Aktiendepot (`Prestige.ts:169-172`) und ein laufendes Graft.
 * Das Konto steht danach auf 1.262 Dollar
 * (`PlayerObjectGeneralMethods.ts:102`). Der Wiederaufbau dauert gemessen
 * 3,1 Stunden.
 *
 * Sie ist trotzdem gebaut, weil es einen Zustand gibt, den sonst nichts loest:
 * der Traeger waechst seit sechs Stunden Motorzeit nicht mehr, und die
 * Sprossen 1 bis 4 waren nachweislich wirkungslos. Dann steht der Lauf, und
 * ein Einbau ist der einzige Weg zurueck in einen Zustand, in dem der Bot
 * ueberhaupt wieder etwas tun kann.
 *
 * ===========================================================================
 * SIE WIRD IM TROCKENMODUS AUSGELIEFERT
 * ===========================================================================
 *
 * Ohne das Argument `scharf` prueft sie alle acht Vorbedingungen, schreibt das
 * Ergebnis und BAUT NICHTS EIN. Das ist dieselbe Bauform wie beim Waechter
 * (`modus: "observe"`) und aus demselben Grund: eine Strafe, die zuerst
 * beobachtet, kostet eine Nacht; eine, die zuerst zuschlaegt, kostet im
 * schlechtesten Fall einen ganzen Lauf.
 *
 * Der Kern haengt `scharf` nur an, wenn `data/punish-scharf.txt` auf home
 * liegt. Solange sie fehlt, laeuft jede Sprosse-5-Ausloesung als Trockenlauf
 * ins Protokoll - und genau das ist der Beleg, den der Auftrag verlangt
 * ("Trockenlauf im Klon"), bevor sie scharf wird.
 *
 * ===========================================================================
 * DIE ACHT VORBEDINGUNGEN (Auftrag 5.3, woertlich)
 * ===========================================================================
 *
 *   1. S2 seit >= 6 h MOTORZEIT: der Traeger waechst nicht.
 *   2. Sprossen 1 bis 4 verifiziert wirkungslos.
 *   3. Kein Nachholfenster (kein Offline-Klumpen in Arbeit).
 *   4. Mindestens eine gekaufte, noch nicht eingebaute Augmentierung.
 *   5. Nicht vor dem Divisionsbeitritt (Kampfwerte gingen auf 1 zurueck -
 *      6,6 Stunden Wiederaufbau, ENTSCHIEDEN "nie").
 *   6. Depot leer (Aktien ueberleben den Einbau nicht).
 *   7. Kein laufendes Graft.
 *   8. `ausgang.json.offen === false` - ein offener Ausgang wird GESPRUNGEN,
 *      nicht resettet.
 *
 * Der Waechter hat sie schon geprueft, als er den Auftrag schrieb. Hier werden
 * sie ERNEUT geprueft, weil zwischen Auftrag und Ausfuehrung Minuten liegen
 * koennen - und `ausgang.json.offen` ist genau das Feld, das sich in dieser
 * Zeit aendert. Punkt 8 ist zugleich der haeufigste S2-Fall ueberhaupt:
 * fertiger Knoten, blockierter Sprung. Ein Einbau behebt das nicht, er raeumt
 * nur den Park leer.
 *
 * Aufruf:
 *   run punish.js            Trockenlauf - prueft und meldet, baut nichts ein
 *   run punish.js scharf     fuehrt aus, wenn alle acht Bedingungen halten
 *
 * @param {NS} ns
 */

/** Wie lange der Auftrag des Waechters gilt. Aelter heisst: verworfen. */
const AUFTRAG_TTL_MS = 600000;

import { handschlag } from "lib/handschlag.js";

export async function main(ns) {
  ns.disableLog("ALL");

  const scharf = ns.args.includes("scharf");
  const jetzt = Date.now();
  const raus = {
    zeit: jetzt, ts: jetzt, wall: jetzt,
    scharf,
    ausgefuehrt: false,
    verweigert: null,
    bedingungen: {},
  };

  const lies = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return null;
      // `ns.read` hat KEINEN Host-Parameter (NetscriptFunctions.ts:1120-1122).
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return null; }
  };
  const liesJson = (datei) => {
    const roh = lies(datei);
    if (!roh) return null;
    try { return JSON.parse(roh); } catch { return null; }
  };
  const fertig = (grund) => {
    raus.verweigert = grund;
    try {
      ns.write("data/punish.json", JSON.stringify(raus), "w");
      if (ns.getHostname() !== "home") ns.scp("data/punish.json", "home", ns.getHostname());
    } catch { /* egal */ }

    // DER TROCKENLAUF MUSS BEOBACHTBAR SEIN (Skeptiker Runde 4, R19,
    // 04.09.2026).
    //
    // Der Auftrag verlangt einen protokollierten Trockenlauf als Beleg, bevor
    // Sprosse 5 scharf wird. Bis heute schrieb diese Datei ihr Ergebnis nach
    // `data/punish.json` - und die las NIEMAND: kein Skript, kein Werkzeug,
    // und `punish.js` steht in keiner Registry, hat also auch keine
    // Frischeueberwachung. Der Beleg war unauffindbar.
    //
    // Der Ereignisstrom ist der richtige Ort: ihn liest der Kern, er geht in
    // `kpi.json` und damit in `checkin.js`, und er ueberlebt als Ringpuffer
    // auch den naechsten Lauf. Die Art `penalty` bleibt, was sie ist - hier
    // steht dazu, ob wirklich eingebaut wurde.
    try {
      const roh = lies("data/events.json");
      let strom = { version: 1, eintraege: [] };
      if (roh) {
        try {
          const g = JSON.parse(roh);
          if (g && Array.isArray(g.eintraege)) strom = g;
        } catch { /* frischer Strom */ }
      }
      strom.eintraege.push({
        art: "penalty",
        text: ("Sprosse 5 " + (raus.ausgefuehrt ? "AUSGEFUEHRT"
          : (scharf ? "verweigert" : "Trockenlauf")) + ": "
          + (grund || "eingebaut")).slice(0, 160),
        wall: Date.now(), playtime: 0, motorTimeMs: 0,
        daten: { rung: 5, scharf, ausgefuehrt: raus.ausgefuehrt,
          verweigert: grund || null },
      });
      while (strom.eintraege.length > 460) strom.eintraege.shift();
      ns.write("data/events.json", JSON.stringify(strom), "w");
      if (ns.getHostname() !== "home") {
        ns.scp("data/events.json", "home", ns.getHostname());
      }
    } catch { /* Bericht, nie Steuerung */ }

    if (grund) ns.print("Sprosse 5 VERWEIGERT: " + grund);
  };

  // --- Der Auftrag ----------------------------------------------------------
  //
  // Ohne Auftrag laeuft diese Datei gar nicht. Ein Handstart soll ausdruecklich
  // NICHTS tun: die teuerste Handlung des Bots darf nicht davon abhaengen,
  // dass jemand die richtige Datei nicht doppelt angeklickt hat.
  const auftrag = liesJson("data/penalty-order.json");
  if (!auftrag || auftrag.rung !== 5) {
    return fertig("kein Sprosse-5-Auftrag in data/penalty-order.json");
  }
  if (!Number.isFinite(auftrag.wall) || jetzt - auftrag.wall > AUFTRAG_TTL_MS) {
    return fertig("Auftrag ist aelter als zehn Minuten - verworfen");
  }
  let ri;
  try { ri = ns.getResetInfo(); } catch { return fertig("getResetInfo nicht lesbar"); }
  if (Number.isFinite(auftrag.nodeReset) && auftrag.nodeReset !== ri.lastNodeReset) {
    return fertig("Auftrag stammt aus einem anderen Knoten");
  }

  // --- 1. S2 seit mindestens sechs Stunden Motorzeit -------------------------
  //
  // Die Zahl kommt vom Waechter, nicht von hier: er fuehrt die Signale, und
  // eine zweite Rechnung waere eine zweite Wahrheit. Geprueft wird, dass sie
  // ueberhaupt da ist und stimmt.
  const s2Ms = Number(auftrag.s2MotorMs);
  raus.bedingungen.s2 = { wert: s2Ms, soll: 6 * 3600000 };
  if (!Number.isFinite(s2Ms) || s2Ms < 6 * 3600000) {
    return fertig("S2 steht erst " + Math.round((s2Ms || 0) / 3600000)
      + " h Motorzeit an, noetig sind 6");
  }

  // --- 2. Sprossen 1 bis 4 verifiziert wirkungslos ---------------------------
  const vorher = Array.isArray(auftrag.wirkungslos) ? auftrag.wirkungslos : [];
  raus.bedingungen.sprossenVorher = vorher;
  for (const k of [1, 2, 3]) {
    if (!vorher.includes(k)) {
      return fertig("Sprosse " + k + " war nicht verifiziert wirkungslos -"
        + " die Leiter wird nicht uebersprungen");
    }
  }

  // --- 3. Kein Nachholfenster ------------------------------------------------
  //
  // Nach einer Offline-Nacht bucht die Engine die gesamte Abwesenheit in EINEM
  // Klumpen (`engine.tsx:280-282`). In diesem Fenster steht jede Uhr
  // durcheinander, und ein Traeger, der "nicht waechst", waechst gleich um
  // acht Stunden auf einmal. Der Kern meldet den Fall in seiner Motorzeit-
  // Telemetrie.
  const kern = liesJson("data/bn4net.json");
  raus.bedingungen.nachholfenster = kern ? (kern.letzterMzGrund || null) : "kein Kern";
  if (kern && typeof kern.letzterMzGrund === "string"
      && /Nachholklumpen|Abstand/.test(kern.letzterMzGrund)) {
    return fertig("Nachholfenster offen (" + kern.letzterMzGrund + ")");
  }

  // --- 4. Mindestens eine gekaufte, nicht eingebaute Augmentierung -----------
  //
  // GELESEN, NICHT ERFRAGT. `getOwnedAugmentations(true)` kostet bei SF4.1
  // achtzig Gigabyte - und `bn4rep.js` weiss beim Kauf ohnehin, was es gekauft
  // hat. Die Datei ist damit kostenlos und aelter als der Kauf kann sie nicht
  // sein.
  //
  // Ohne gekaufte Augmentierung waere der Einbau ein reiner Soft-Reset: er
  // naehme alles und gaebe nichts. `ns.singularity.softReset` ist genau
  // deshalb ausdruecklich NICHT gebaut.
  // AUS `data/einbau.json`, NICHT AUS EINER PHANTOMDATEI (Skeptiker Runde 4,
  // R2, 04.09.2026).
  //
  // Hier stand `data/aug-queue.json`, und die hatte im ganzen Baum keinen
  // Schreiber - der Kommentar behauptete, `bn4rep.js` wisse es "ohnehin", nur
  // schrieb es das nirgends hin. Die Vorbedingung war damit dauerhaft
  // unerfuellbar, und drei von vier Pruefern haben sie unabhaengig gefunden.
  //
  // `bn4rep.js` fuehrt die Zahl seit jeher in `data/einbau.json` unter
  // `wartend` (bn4rep.js:1041-1046) - es ist die Differenz aus
  // `getOwnedAugmentations(true)` und `(false)`, also genau "gekauft, aber
  // noch nicht eingebaut". Diese Datei hat einen Schreiber, einen Zeitstempel
  // und wird bei jedem Durchlauf neu geschrieben.
  const einbau = liesJson("data/einbau.json");
  const wartende = einbau && Number.isFinite(einbau.wartend) ? einbau.wartend : 0;
  raus.bedingungen.queuedAugs = wartende;
  if (!einbau) {
    return fertig("data/einbau.json fehlt - ohne die Zahl der gekauften"
      + " Augmentierungen wird nicht eingebaut");
  }
  // Eine alte Zahl ist so schlimm wie keine: zwischen dem Schreiben und hier
  // kann ein Einbau gelaufen sein, und dann waere die Warteschlange leer.
  if (!Number.isFinite(einbau.zeit) || jetzt - einbau.zeit > 30 * 60000) {
    return fertig("data/einbau.json ist aelter als 30 Minuten - die Zahl der"
      + " wartenden Augmentierungen ist nicht mehr verlaesslich");
  }
  if (wartende < 1) {
    return fertig("keine gekaufte Augmentierung (data/einbau.json: wartend "
      + wartende + ") - ein Einbau ohne Aug ist ein Soft-Reset, und der ist"
      + " nicht gebaut");
  }


  // --- 5. Nicht vor dem Divisionsbeitritt ------------------------------------
  //
  // Der Einbau setzt die Kampfwerte auf 1 zurueck. Vor dem Bladeburner-Beitritt
  // (alle vier >= 100) waeren das 6,6 Stunden Wiederaufbau fuer nichts - der
  // Auftrag entscheidet das mit "nie".
  const blade = liesJson("data/blade.json");
  const bbtrain = liesJson("data/bbtrain.json");
  const verfahren = (lies("data/verfahren.txt") || "").trim();
  const istV2 = /^V2\b/.test(verfahren);
  const inDivision = !!(blade && (blade.rang !== undefined && blade.rang !== null));
  raus.bedingungen.divisionsbeitritt = { istV2, inDivision };
  if (istV2 && !inDivision) {
    return fertig("Bladeburner-Beitritt steht noch aus - ein Einbau setzte die"
      + " Kampfwerte auf 1 zurueck (6,6 h fuer nichts)");
  }
  if (bbtrain && bbtrain.trainiert === true) {
    return fertig("bbtrain.js baut gerade Kampfwerte auf - der Einbau naehme"
      + " genau diese Arbeit zurueck");
  }

  // --- 5b. Auf dem Bladeburner-Weg muss der Einbau den Wiederaufbau VERKUERZEN
  //
  // DER BEFUND, DER DIESE BEDINGUNG ERZWINGT (Skeptiker Runde 4, R9,
  // 04.09.2026):
  //
  // `prestigeAugmentation` setzt alle Kampfwerte auf 1 und die Erfahrung auf 0
  // (`PlayerObjectGeneralMethods.ts:86-100`). Der Bladeburner selbst ueberlebt
  // - Rang und Skills bleiben, `this.bladeburner = null` steht nur in
  // `prestigeSourceFile` (:160). Die Erfolgswahrscheinlichkeit einer Aktion ist
  // aber ein gewichtetes Potenzprodukt der Kampfwerte
  // (`Bladeburner/Actions/Action.ts:169-195`), und ein Fehlschlag zieht Rang AB
  // (`Bladeburner.ts:1055-1059`).
  //
  // Auf dem V2-Weg erzeugt ein Einbau damit genau den Zustand, den Sprosse 5
  // heilen soll: der Traeger waechst nicht nur nicht, er faellt - bis die
  // Kampfwerte wieder oben sind, gemessen 6,6 Stunden. Die bisherige
  // Vorbedingung 5 sperrte nur VOR dem Divisionsbeitritt; danach, also im
  // gesamten Normalbetrieb der Route, war der Einbau erlaubt und garantierte
  // sechs weitere Stunden S2.
  //
  // Die Ausnahme, die ihn trotzdem lohnt: wenn unter den wartenden Stuecken
  // eines ist, das den Wiederaufbau verkuerzt (Kampf- oder
  // Bladeburner-Multiplikatoren). Genau diese Frage beantwortet `bn4rep.js`
  // seit jeher und schreibt sie als `wiederaufbauHilfe` mit hinaus
  // (bn4rep.js:1000-1024) - eine zweite Rechnung hier waere eine zweite
  // Wahrheit.
  if (istV2 && einbau.wiederaufbauHilfe === false) {
    return fertig("Bladeburner-Weg, und keine der wartenden Augmentierungen"
      + " verkuerzt den Wiederaufbau: der Einbau setzt die Kampfwerte auf 1,"
      + " die Erfolgswahrscheinlichkeit bricht zusammen, Fehlschlaege ziehen"
      + " Rang ab - er erzeugt genau die Stagnation, die er beheben soll");
  }


  // --- 6. Depot leer ---------------------------------------------------------
  //
  // `Prestige.ts:171` ruft `initStockMarket()`. Jede Position ist danach weg,
  // und mit ihr ihr Gegenwert. In BitNode 8 waere das der ganze Lauf.
  const boerse = liesJson("data/boerse.json");
  raus.bedingungen.depot = boerse ? (boerse.posten ?? null) : null;
  if (boerse && Number.isFinite(boerse.posten) && boerse.posten > 0) {
    return fertig("das Depot haelt " + boerse.posten + " Posten ("
      + ((boerse.depotWert || 0) / 1e9).toFixed(2) + " Mrd) - sie waeren weg");
  }

  // --- 7. Kein laufendes Graft ------------------------------------------------
  //
  // `GraftingWork.finish(cancelled)` gibt das Geld NICHT zurueck
  // (`Work/GraftingWork.tsx:75-83`). Beim Simulacrum waeren das 450 Mrd.
  const graftauto = liesJson("data/graftauto.json");
  const graft = liesJson("data/graft.json");
  const laeuftGraft = !!(graftauto && graftauto.laeuft)
    || !!(graft && graft.getan === "gestartet"
          && Number.isFinite(graft.zeit) && jetzt - graft.zeit < 3 * 3600000);
  raus.bedingungen.graft = laeuftGraft;
  if (laeuftGraft) {
    return fertig("es laeuft ein Graft - abgebrochen ist es vollstaendig"
      + " verloren (GraftingWork.tsx:75-83 erstattet nicht)");
  }

  // --- 8. Der Ausgang ist NICHT offen -----------------------------------------
  //
  // DER HAEUFIGSTE S2-FALL UEBERHAUPT: fertiger Knoten, blockierter Sprung. Ein
  // Einbau behebt das nicht - er raeumt den Park leer und kostet 3,1 h
  // Wiederaufbau, waehrend der Ausgang danach genauso blockiert ist.
  const ausgang = liesJson("data/ausgang.json");
  raus.bedingungen.ausgangOffen = ausgang ? (ausgang.offen ?? null) : null;
  if (ausgang && ausgang.offen === true) {
    return fertig("der Ausgang steht offen - ein offener Ausgang wird"
      + " GESPRUNGEN, nicht resettet");
  }

  // --- Die Deckel --------------------------------------------------------------
  //
  // Hoechstens einmal je 24 h Motorzeit und einmal je Knotenstufe. Die Zaehler
  // stehen im Strafprotokoll, nicht hier - eine Datei, die der Waechter fuehrt,
  // ueberlebt den Neustart dieses Einmalskripts.
  const strafen = liesJson("data/penalties.json");
  if (strafen && Array.isArray(strafen.eintraege)) {
    const fuenfen = strafen.eintraege.filter(
      (e) => e && e.rung === 5 && e.result === "executed");
    const imKnoten = fuenfen.filter((e) => e.nodeReset === ri.lastNodeReset);
    raus.bedingungen.deckel = { gesamt: fuenfen.length, imKnoten: imKnoten.length };
    if (imKnoten.length >= 1) {
      return fertig("Sprosse 5 lief in diesem Knoten schon einmal - hoechstens"
        + " einmal je Knotenstufe");
    }
    const letzte = fuenfen[fuenfen.length - 1];
    if (letzte && Number.isFinite(letzte.wall) && jetzt - letzte.wall < 24 * 3600000) {
      return fertig("die letzte Sprosse 5 ist weniger als 24 h her");
    }
  }

  // ===========================================================================
  // Alle acht halten.
  // ===========================================================================
  raus.bedingungen.alleErfuellt = true;

  if (!scharf) {
    ns.print("TROCKENLAUF: alle acht Vorbedingungen halten. Ohne das Argument"
      + " 'scharf' wird NICHTS eingebaut.");
    raus.trockenlauf = "alle acht Vorbedingungen halten - nichts eingebaut";
    return fertig(null);
  }

  // Der Rueckruf ist `boot.js`: es raeumt die knotengebundenen Dateien und
  // startet den Kern. Ohne Rueckruf laeuft nach dem Einbau gar nichts, und der
  // Bot stuende bis zum naechsten Menschen.
  // DER HANDSCHLAG VOR DEM EINBAU (Auftrag 7.2, gebaut 04.09.2026).
  //
  // Anders als beim Sprung wird hier NICHT gehandelt, wenn keine Sicherung
  // zustande kommt: ein Einbau ist beliebig oft nachholbar, der Verlust bei
  // einem Fehlgriff betraegt Tage. `handschlag` setzt in dem Fall selbst
  // `data/install-sperre.txt`.
  //
  // Das gilt fuer Sprosse 5 ausdruecklich genauso wie fuer bn4rep.js - der
  // Auftrag nennt beide Stellen (7.2: "der Einbau (bn4rep.js:1169, ebenso
  // Sprosse 5) setzt install-sperre.txt und wartet").
  {
    const hs = await handschlag(ns, "install",
      String(wartende) + " Augmentierung(en)", ri.lastNodeReset,
      (t) => ns.print(t));
    if (!hs.darf) {
      return fertig("Einbau ausgesetzt: " + hs.grund
        + " (gewartet " + Math.round(hs.wartezeitMs / 1000) + " s)");
    }
    if (!hs.gesichert) {
      ns.print("HINWEIS: Einbau ohne frische Sicherung - letzte gruene ist "
        + (Number.isFinite(hs.alterMs) ? (hs.alterMs / 3600000).toFixed(1) + " h" : "unbekannt")
        + " alt.");
    }
  }

  // `wartende` IST EINE ZAHL, keine Liste (Skeptiker, Gesamtbild). Hier stand
  // `wartende.length` - das Protokoll der teuersten Handlung des Bots meldete
  // "baue undefined Augmentierung(en) ein".
  ns.print("SPROSSE 5: baue " + wartende + " Augmentierung(en) ein. "
    + "Rueckruf boot.js.");
  try {
    ns.singularity.installAugmentations("boot.js");
    // Diese Zeile wird nie erreicht - installAugmentations laedt das Spiel neu.
    raus.ausgefuehrt = true;
    return fertig(null);
  } catch (e) {
    return fertig("installAugmentations warf: "
      + String(e && e.message ? e.message : e).slice(0, 160));
  }
}
