/**
 * Die Endspurt-Regel - was sich vor einem Knotenwechsel noch lohnt.
 *
 * ===========================================================================
 * DIE REGEL, WOERTLICH (Auftrag 3, gilt in allen 40 Laeufen)
 * ===========================================================================
 *
 * Beim Knotenwechsel verfallen Geld (es bleiben 1.262 $), alle gekauften
 * Server, Programme, Faktionen, Favor und Hacknet. Daraus folgen zwei
 * gegenlaeufige Gebote, und beide brauchen dieselbe Zahl:
 *
 *   1. Faellt `eta_min` unter die DAUER eines Postens, wird der Posten nicht
 *      mehr begonnen: kein Graft, kein Aug-Kauf, kein Mietrechner, der sich
 *      nicht mehr amortisiert, kein home-Ausbau.
 *   2. Unter `eta_min < 60` ist Geld eine verderbliche Ware - was jetzt nicht
 *      ausgegeben wird, ist beim Sprung weg.
 *
 * ===========================================================================
 * WARUM DAS EIN EIGENES MODUL IST
 * ===========================================================================
 *
 * Die fuenf Posten der Regel liegen heute in fuenf verschiedenen Dateien -
 * `bn4net.js` (Mietrechner), `homegrow.js` (home-Ausbau), `bn4rep.js`
 * (Aug-Kauf), `graft.js` (Graft), `hashes.js` (Hash-Tausch) - und KEINE davon
 * liest `data/ausgang.json`. Jede fuer sich waere eine eigene Auslegung der
 * Regel; fuenf Auslegungen sind vier zu viel.
 *
 * ===========================================================================
 * DIE AUSFALLRICHTUNG: IM ZWEIFEL NORMALBETRIEB
 * ===========================================================================
 *
 * Ist `ausgang.json` alt, unlesbar oder ohne `eta_min`, gilt: KEIN Endspurt.
 * Also nichts blockieren und nichts verschleudern.
 *
 * Die andere Richtung waere gefaehrlicher. Wer bei fehlender Datei "Sprung
 * steht bevor" annimmt, blockiert jeden Graft und jeden Aug-Kauf - dauerhaft,
 * lautlos, und mit der Begruendung eines Sprungs, der nie kommt. Genau die
 * Fehlerklasse, die dieser Umbau abschafft: Stillstand ohne Ruf.
 */

/** Aelter als das, gilt die Datei als nicht aussagekraeftig. */
export const HOECHSTALTER_MS = 15 * 60000;

/** Unter dieser Restzeit ist Geld eine verderbliche Ware (Auftrag 3). */
export const VERDERBLICH_AB_MIN = 60;

/**
 * Holt eine Datei von home und liest sie - der einzige verlaessliche Weg.
 *
 * Dieselbe Hilfe hat `ausgang.js:112-118` seit langem; sie fehlte hier, und
 * das waere der stillste Fehler des ganzen Umbaus geworden.
 *
 * @returns {string|null} null, wenn es die Datei auf home nicht gibt
 */
function liesVonHome(ns, datei) {
  try {
    if (!ns.fileExists(datei, "home")) return null;
    if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
    return ns.read(datei);
  } catch {
    return null;
  }
}

/**
 * Liest die Lage aus `data/ausgang.json`.
 *
 * @param {NS} ns
 * @param {number} jetzt Date.now()
 * @returns {{gilt: boolean, etaMin: number|null, sicher: boolean, offen: boolean,
 *            routeState: string, alterMs: number|null, grund: string}}
 */
export function lage(ns, jetzt) {
  const unbekannt = {
    gilt: false, etaMin: null, sicher: false, offen: false,
    routeState: "open", alterMs: null, grund: "",
  };
  // LESEN VON home, NICHT VOM EIGENEN RECHNER.
  //
  // `ns.read` hat KEINEN Host-Parameter - es liest immer vom Server des
  // aufrufenden Skripts (`NetscriptFunctions.ts:1120-1122`), waehrend
  // `ns.fileExists` einen nimmt (`:1056-1058`). Wer auf "home" prueft und dann
  // lokal liest, bekommt auf jedem Fremdrechner eine leere Zeichenkette -
  // ohne Wurf, ohne Log. `Number("")` ist 0, `JSON.parse("")` wirft.
  //
  // Das ist keine Randbedingung: die Werkzeuge laufen auf der Werkbank,
  // "praktisch nie home" (`bn4net.js:2716-2719`). Ein Interlock, der dort
  // still "keine Lage" meldet, erlaubt den Einbau genau dann, wenn er ihn
  // verhindern soll.
  const roh = liesVonHome(ns, "data/ausgang.json");
  if (roh === null) return { ...unbekannt, grund: "ausgang.json fehlt" };
  let a;
  try {
    a = JSON.parse(roh);
  } catch {
    return { ...unbekannt, grund: "ausgang.json unlesbar" };
  }
  if (!a || typeof a !== "object") return { ...unbekannt, grund: "ausgang.json kein Objekt" };

  const alterMs = Number.isFinite(a.zeit) ? jetzt - a.zeit : null;
  if (alterMs === null) return { ...unbekannt, grund: "ausgang.json ohne Zeitstempel" };
  if (alterMs > HOECHSTALTER_MS) {
    return { ...unbekannt, alterMs,
      grund: "ausgang.json ist " + Math.round(alterMs / 60000) + " min alt - ausgang.js laeuft nicht" };
  }
  // Eine Datei aus der Zukunft ist ein Uhrensprung, keine frische Lage.
  if (alterMs < -60000) {
    return { ...unbekannt, alterMs, grund: "ausgang.json traegt eine Zukunftszeit" };
  }

  const offen = a.offen === true;
  const etaMin = Number.isFinite(a.eta_min) ? a.eta_min : (offen ? 0 : null);

  return {
    gilt: true,
    etaMin,
    sicher: a.eta_sicher === true,
    offen,
    routeState: typeof a.route_state === "string" ? a.route_state : "open",
    alterMs,
    grund: "",
  };
}

/**
 * Darf ein Posten begonnen werden, der `dauerMin` Minuten braucht, bis er sich
 * auszahlt?
 *
 * DIE DAUER IST NICHT DIE LAUFZEIT, SONDERN DIE AMORTISATION. Ein Mietrechner
 * ist nach zehn Sekunden gekauft, aber erst nach Stunden bezahlt. Ein Graft
 * ist erst mit dem letzten Prozent etwas wert - bricht der Sprung mittendrin
 * herein, war die ganze Zeit umsonst.
 *
 * @param {object} l Ergebnis aus lage()
 * @param {number} dauerMin wie lange, bis sich der Posten auszahlt
 * @returns {{ok: boolean, grund: string}}
 */
export function lohntSich(l, dauerMin) {
  if (!l || !l.gilt) return { ok: true, grund: "keine Lage - Normalbetrieb" };
  if (l.etaMin === null) return { ok: true, grund: "eta_min nicht schaetzbar - Normalbetrieb" };
  if (!Number.isFinite(dauerMin) || dauerMin <= 0) return { ok: true, grund: "Posten ohne Dauer" };

  // Auch hier: eine unsichere Schaetzung (untere Schranke vom Rangweg) darf
  // keinen Posten verhindern. Sie taugt zum Berichten, nicht zum Sperren.
  if (!l.sicher) return { ok: true, grund: "Schaetzung unsicher - Normalbetrieb" };

  if (l.etaMin < dauerMin) {
    return {
      ok: false,
      grund: "Sprung in " + l.etaMin.toFixed(0) + " min, der Posten braucht " +
        dauerMin.toFixed(0) + " min - er wuerde beim Wechsel verfallen",
    };
  }
  return { ok: true, grund: "" };
}

/**
 * Ist Geld ab jetzt eine verderbliche Ware?
 *
 * Wenn ja, wird nicht mehr gespart: was beim Sprung auf dem Konto liegt, ist
 * verloren (es bleiben 1.262 $). Die Wirtreserve fuer `exit.js` ist davon
 * ausdruecklich AUSGENOMMEN - sie wird VOR dieser Regel abgezogen, sonst
 * verbrennt der Endspurt genau das Geld, mit dem der Sprung bezahlt wird
 * (ARCHITEKTUR E10).
 */
export function geldIstVerderblich(l) {
  if (!l || !l.gilt || l.etaMin === null) return false;
  return l.etaMin < VERDERBLICH_AB_MIN;
}

/**
 * Eine Zeile fuer das Protokoll - damit im Log steht, WARUM etwas unterblieb.
 *
 * Ohne diese Zeile sieht ein unterlassener Aug-Kauf wie ein Fehler aus, und
 * jemand sucht stundenlang nach einem Bug, der eine Regel ist.
 */
export function zeile(l) {
  if (!l || !l.gilt) return "Endspurt: keine Lage (" + (l && l.grund ? l.grund : "?") + ")";
  if (l.etaMin === null) return "Endspurt: eta_min nicht schaetzbar";
  return "Endspurt: Sprung in etwa " + l.etaMin.toFixed(0) + " min" +
    (l.sicher ? "" : " (unsicher)") +
    (geldIstVerderblich(l) ? " - Geld ist ab hier verderblich" : "");
}

/**
 * Der Ausgangs-Interlock: darf jetzt eingebaut werden?
 *
 * ===========================================================================
 * DER EIGENTLICHE DEADLOCK - UND WARUM EINE GELDRESERVE IHN NICHT LOEST
 * ===========================================================================
 *
 * Die Annahme war lange: der Bot gibt vor dem Wechsel sein Geld aus und kann
 * dann den Wirt fuer `exit.js` nicht mehr bezahlen. Ein Skeptikerlauf am
 * 04.09.2026 hat das widerlegt. Was den Zustand "kein Wirt UND kein Geld"
 * erzeugt, ist nicht das Ausgeben, sondern der EINBAU:
 *
 *   `installAugmentations` loescht ueber `prestigeAugmentation` ALLE gekauften
 *   Rechner (`Prestige.ts:73`) und setzt das Guthaben auf 1000 Dollar - in
 *   EINEM Engine-Schritt.
 *
 * Gegen ein genulltes Konto ist jede Geldreserve wirkungslos, egal wie gut sie
 * gebaut und verfallgesichert ist. Der Schnitt gehoert davor: kein Einbau,
 * solange der Ausgang offen oder nah ist.
 *
 * ===========================================================================
 * DER BESTEHENDE RIEGEL DECKT NUR EIN VIERTEL DER ROUTE
 * ===========================================================================
 *
 * `bn4rep.js:909` hat bereits eine Sperre - aber sie haengt an
 * `ausgangSteht = eingebauteAugs.includes("The Red Pill")` (`:887`). The Red
 * Pill gibt es nur im V1-Weg. In den 30 Bladeburner-Laeufen der Route ist
 * `ausgangSteht` NIE wahr, der Riegel greift nie, und `bn4rep` darf in genau
 * dem Moment einbauen, in dem alle 21 Black Ops gefallen sind und `ausgang.js`
 * `exit.js` starten will.
 *
 * Dieser Interlock ist verfahrensunabhaengig: er liest `data/ausgang.json` und
 * fragt nicht, welche Tuer offen steht.
 *
 * ===========================================================================
 * DIE OBERGRENZE - DAMIT DER RIEGEL KEIN STILLSTAND WIRD
 * ===========================================================================
 *
 * Steht der Ausgang offen und der Sprung gelingt trotzdem nicht (exit.js
 * scheitert, kein Wirt, abgelehntes Ziel), wuerde ein Interlock ohne Grenze
 * den Einbau FUER IMMER blockieren - und damit den einzigen Weg, auf dem der
 * Bot noch besser wird. Genau die Fehlerklasse "Stillstand ohne Ruf".
 *
 * Deshalb: nach `SPERRE_HOECHSTENS_MS` gibt der Interlock auf und laesst den
 * Einbau zu. Wer so lange nicht springen konnte, hat ein anderes Problem, und
 * das Aussitzen macht es nicht kleiner.
 */

/** So lange blockiert ein offener Ausgang den Einbau, dann nicht mehr. */
export const SPERRE_HOECHSTENS_MS = 6 * 3600000;

/**
 * Wie lange der Wiederaufbau nach einem Einbau dauert (gemessen 3,1 h,
 * `kpi.json`-Feld `t_rebuild_h`). Ein Einbau, dessen Aufbau der Sprung
 * ohnehin zerreisst, ist verlorene Zeit.
 */
export const WIEDERAUFBAU_MIN = 186;

/**
 * @param {object} l Ergebnis aus lage()
 * @param {number} jetzt Date.now()
 * @param {number|null} offenSeit Wanduhrzeit, seit der `offen` beobachtet wird
 * @returns {{ok: boolean, grund: string}}
 */
export function einbauErlaubt(l, jetzt, offenSeit = null) {
  if (!l || !l.gilt) return { ok: true, grund: "" };

  if (l.offen) {
    if (offenSeit !== null && Number.isFinite(offenSeit) &&
        jetzt - offenSeit > SPERRE_HOECHSTENS_MS) {
      return {
        ok: true,
        grund: "Ausgang steht seit " + Math.round((jetzt - offenSeit) / 3600000) +
          " h offen, ohne dass der Sprung gelingt - der Interlock gibt auf",
      };
    }
    return {
      ok: false,
      grund: "Der Ausgang steht OFFEN. Ein Einbau wuerde jetzt den Rechnerpark " +
        "loeschen und das Konto auf 1000 Dollar setzen - genau die Mittel, mit " +
        "denen exit.js gestartet wird.",
    };
  }

  // NUR EINE SICHERE SCHAETZUNG DARF EINEN EINBAU VERHINDERN.
  //
  // Auf dem Bladeburner-Weg ist eta_min eine UNTERE Schranke: sie misst die
  // Zeit bis zur Rangschwelle der letzten Black Op, nicht bis zu ihrer
  // Ausfuehrung. Sie ist also immer zu kurz. Wuerde der Riegel darauf
  // ansprechen, blockierte er den Einbau stundenlang zu frueh - und Einbauten
  // sind der einzige Weg, auf dem der Bot ueberhaupt besser wird.
  //
  // Die harte Sperre haengt deshalb allein an `offen`: das ist eine Beobachtung,
  // keine Schaetzung.
  if (l.etaMin !== null && l.sicher && l.etaMin < WIEDERAUFBAU_MIN) {
    return {
      ok: false,
      grund: "Sprung in etwa " + l.etaMin.toFixed(0) + " min, der Wiederaufbau nach " +
        "einem Einbau braucht rund " + WIEDERAUFBAU_MIN + " min - er waere umsonst.",
    };
  }

  return { ok: true, grund: "" };
}

/**
 * DIE EINBAUSPERRE IM KAMPFKNOTEN (22.09.2026).
 *
 * Im Bladeburner-Knoten setzt jeder Einbau die vier Kampfwerte auf 1, und der
 * Wiederaufbau kostet Stunden (BitNode 9: je nach Augmentierungen 5-20 h).
 * Nach einem Einbau sind Augmentierungen billig, drei Stueck liegen schnell
 * in der Warteschlange - am 22.09. baute der Bot um 16:21 (Kampfwerte 100,
 * Rang 0) und um 20:38 (Kampfwerte 89) ein. Ein Knoten kommt so nie ueber den
 * Anlauf hinaus.
 *
 * Gesperrt ist, solange
 *   (1) der Wiederaufbau laeuft (Tiefstand < 100), oder
 *   (2) seit seinem ENDE weniger Spielzeit vergangen ist als
 *       max(12 h, 2 x Dauer des Wiederaufbaus).
 * Gezaehlt wird ab dem Ende, nicht ab dem Einbau (Skeptiker Runde 2, H2):
 * bei 20 h Wiederaufbau liessen "24 h ab Einbau" nur 4 h mit Rang uebrig, und
 * der Einbau direkt beim Erreichen von 100 (16:21, Rang 0) bliebe erlaubt.
 * Mit dem Faktor 2 entsteht in mindestens zwei Dritteln der Zeit Rang. Das ist
 * eine Schranke gegen den Kreislauf, keine gerechnete Optimalstelle.
 *
 * Gemessen in totalPlaytime. Die zaehlt Offline-Zeit mit (engine.tsx:346-352):
 * eine Nacht offline verbraucht die Sperre, obwohl Rang erst nach dem Laden
 * aus Bonuszyklen entsteht. Das schwaecht sie, macht sie aber nie endlos.
 * ns.getPlayer() liefert keine Spielzeit seit dem Einbau; bn4rep.js fuehrt
 * sie selbst (data/einbau-uhr.json). Unbekannte Zeiten (null) sperren nicht -
 * dann gilt nur (1).
 *
 * Rein, ohne ns - damit tools/test-endspurt.js sie ohne Spiel prueft.
 *
 * @param {{strength:number, defense:number, dexterity:number, agility:number}} skills
 * @param {{aufbauDauerMs?: number|null, seitAufbauMs?: number|null}} uhr
 */
export const KAMPF_EINBAU_MIN_MS = 12 * 3600000;
export function kampfEinbauSperre(skills, uhr = {}) {
  const k = skills || {};
  const tief = Math.min(Number(k.strength), Number(k.defense), Number(k.dexterity), Number(k.agility));
  const aufbau = Number.isFinite(tief) && tief < 100;
  const zahl = (x) => (x == null ? NaN : Number(x));
  const dauer = zahl(uhr && uhr.aufbauDauerMs);
  const seit = zahl(uhr && uhr.seitAufbauMs);
  const noetig = Math.max(KAMPF_EINBAU_MIN_MS, Number.isFinite(dauer) ? 2 * dauer : 0);
  const zuFrueh = !aufbau && Number.isFinite(seit) && seit < noetig;
  return { aufbau, zuFrueh, noetigMs: noetig, gesperrt: aufbau || zuFrueh };
}

/**
 * Die Aug-Ruecklage: was bn4rep.js fuer verdiente Augmentierungen zurueckhaelt
 * (data/geldbedarf.txt). Sechs Gewerke lesen sie und geben nur aus, was
 * darueber liegt (bn4net, homegrow, bn4life, graftauto, hashes, hacknet).
 *
 * NUR ERREICHBARE STUECKE (23.09.2026). Bis heute war es die Summe ALLER
 * verdienten Augs. Am 23.09. 08:57 stand sie bei 92 Billionen gegen 1-2 Mrd
 * Konto - fast alles ein einziges Stueck: Blade's Simulacrum (Grundpreis
 * 150 Mrd, Augmentations.ts:286, nur 1.250 Bladeburner-Ruf) mal 1,9^10 = 613
 * fuer zehn wartende Stuecke. Eine solche Summe wird nie erreicht und sperrte
 * alle sechs Leser fuer den ganzen Zyklus; die billigen, erreichbaren Augs
 * waren darin nur Rauschen. Jetzt zaehlt jedes Stueck einzeln, und nur, wenn
 * es hoechstens das RUECKLAGE_REICHWEITE-fache des Kontos kostet - bei
 * ~1 Mrd Konto und ~5 Mrd/h aus Hashes rund zwei Stunden Sparen.
 *
 * @param {{preis:number, rep:number, repReq:number}[]} kandidaten
 * @param {number} geld aktuelles Konto
 */
export const RUECKLAGE_REICHWEITE = 10;
export function augRuecklage(kandidaten, geld) {
  const grenze = RUECKLAGE_REICHWEITE * Math.max(0, Number(geld) || 0);
  return (kandidaten || [])
    .filter((k) => k && k.rep >= k.repReq && Number.isFinite(k.preis) && k.preis <= grenze)
    .reduce((n, k) => n + k.preis, 0);
}
