/**
 * Routenlogik - welcher Knoten kommt als naechster, und ist ein Ziel erlaubt?
 *
 * ===========================================================================
 * WARUM DIESE FUNKTION EIN EIGENES MODUL IST
 * ===========================================================================
 *
 * Sie stand bisher in `ausgang.js` und war dort schon rein und getestet
 * (`tools/test-route.js`, alle 40 Uebergaenge). Gebraucht wird sie jetzt auch
 * von `exit.js` - der Datei, die den Knoten tatsaechlich verlaesst und heute
 * jeden Zahlwert zwischen 1 und 15 ungeprueft an `destroyW0r1dD43m0n`
 * durchreicht (`exit.js:35,44-47,90,141`).
 *
 * Ein Import aus `ausgang.js` waere der naheliegende Weg und der falsche: der
 * RAM-Rechner des Spiels laeuft ueber den AST der importierten Datei
 * (`Script/RamCalculations.ts`) und schlaegt exit.js damit den gesamten
 * ns-Verbrauch von ausgang.js auf - `ns.scan`, `ns.ps`, `ns.getScriptRam`,
 * `ns.hasRootAccess` und die ganze Singularity-Familie, jede mal 16
 * ausserhalb von BitNode 4. Genau die Namensblindheit, die `wakelock.js`
 * 32 GB gekostet hat.
 *
 * Dieses Modul ruft NICHTS auf `ns` auf. Es kostet damit nichts, und beide
 * Seiten rechnen dieselbe Route.
 *
 * ===========================================================================
 * DIE ROUTE AENDERT NIEMAND AUF ZURUF
 * ===========================================================================
 *
 * Die REIHENFOLGE der Eintraege in `src/route.json` ist unveraenderlich -
 * auch nicht mit einer neuen Quelle und einem gruenen Test. Dieses Modul
 * liest sie, es sortiert sie nicht.
 */

/**
 * Reine Routenlogik. `sf` ist eine Map oder ein Objekt Knoten -> Stufe;
 * `vorhanden(datei)` sagt, ob ein in `braucht` genanntes Gewerk auf home liegt.
 * Liefert { lauf, ziel, verfahren, fertig, grund, uebersprungen }.
 *
 * `braucht` haelt den Bot NICHT an (Skeptiker 02.09.: ein Stillstand ohne
 * Ruf ist genau die Fehlerklasse, die dieser Umbau abschafft). Ein Eintrag,
 * dessen Gewerk fehlt, wird uebersprungen und steht in `uebersprungen`;
 * sobald die Datei liegt, ist er wieder der erste offene Eintrag.
 */
export function planeRoute(route, cur, sf, vorhanden = () => true) {
  const stufe = (n) => {
    const v = sf instanceof Map ? sf.get(n) : sf[n];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };
  const nachDiesemLauf = (n) => stufe(n) + (n === cur ? 1 : 0);
  const eintraege = Array.isArray(route) ? route : [];
  const leer = { lauf: null, ziel: null, verfahren: "V2", fertig: false, uebersprungen: [] };

  for (const e of eintraege) {
    const ok = e && Number.isInteger(e.node) && e.node >= 1 && e.node <= 15
      && [1, 2, 3].includes(e.level) && ["V1", "V2", "V1b"].includes(e.verfahren);
    if (!ok) return { ...leer, grund: "Routeneintrag ungueltig: " + JSON.stringify(e) };
  }

  const lauf = eintraege.find((e) => e.node === cur && stufe(cur) < e.level) || null;
  const letzterFuerCur = [...eintraege].reverse().find((e) => e.node === cur);
  const verfahren = lauf ? lauf.verfahren : (letzterFuerCur ? letzterFuerCur.verfahren : "V2");

  const uebersprungen = [];
  let ziel = null;
  for (const e of eintraege) {
    if (!(nachDiesemLauf(e.node) < e.level)) continue;
    if (e.braucht && !vorhanden(e.braucht)) { uebersprungen.push(e); continue; }
    ziel = e; break;
  }

  if (!ziel) {
    return { lauf, ziel: null, verfahren, fertig: uebersprungen.length === 0, uebersprungen,
      grund: uebersprungen.length ? "nur noch Eintraege mit fehlendem Gewerk offen" : "Route abgearbeitet" };
  }
  return { lauf, ziel, verfahren, fertig: false, uebersprungen,
    grund: lauf ? "" : "aktueller Knoten " + cur + " steht nicht offen in der Route" };
}

/**
 * Darf in diesen Knoten gesprungen werden?
 *
 * ===========================================================================
 * WARUM DAS GEPRUEFT GEHOERT
 * ===========================================================================
 *
 * `exit.js` prueft heute nur, ob das Argument eine Zahl zwischen 1 und 15 ist
 * (`exit.js:44-47`), und reicht es dann an zwei Stellen unveraendert an
 * `destroyW0r1dD43m0n` durch (`:90`, `:141`). Ein vertippter, veralteter oder
 * aus einer alten Telemetrie gelesener Wert landet damit ungeprueft im
 * Sprung - und ein Sprung ist die einzige Handlung des Bots, die sich nicht
 * zuruecknehmen laesst. Der Lauf ist weg, der Knoten ist betreten, und die
 * Route ist um einen Eintrag verschoben, den niemand vorgesehen hat.
 *
 * ===========================================================================
 * KEIN UEBERSTIMMUNGSFLAG
 * ===========================================================================
 *
 * Es waere leicht, ein `--trotzdem` einzubauen. Es gibt hier keins: die Route
 * ist unveraenderlich (Auftrag 2.1 woertlich), und ein Flag, das sie aushebelt,
 * ist genau der Zuruf, den die Regel ausschliesst. Wer wirklich woanders hin
 * will, aendert `src/route.json` - sichtbar, versioniert, mit Commit.
 *
 * Bleibt der Bot dadurch im Knoten stehen, weil Route und Spielstand
 * auseinanderlaufen? Ja. Und das ist die richtige Seite des Fehlers: ein
 * stehender Bot kostet Stunden, ein falscher Sprung kostet den Lauf.
 *
 * @param {Array} route Inhalt von src/route.json
 * @param {number} cur aktueller BitNode
 * @param {object|Map} sf ownedSF aus getResetInfo()
 * @param {number} ziel der Knoten, in den gesprungen werden soll
 * @param {Function} vorhanden (datei) => bool, fuer `braucht`
 * @returns {{ok: boolean, grund: string, erwartet: number|null, plan: object}}
 */
export function zielErlaubt(route, cur, sf, ziel, vorhanden = () => true) {
  const plan = planeRoute(route, cur, sf, vorhanden);

  if (!Number.isInteger(ziel) || ziel < 1 || ziel > 15) {
    return { ok: false, grund: "Ziel " + ziel + " ist kein Knoten zwischen 1 und 15.",
      erwartet: plan.ziel ? plan.ziel.node : null, plan };
  }

  // Eine ungueltige Route ist kein Freibrief. planeRoute meldet den Grund;
  // ohne gueltige Route gibt es kein "erwartetes" Ziel, gegen das zu pruefen
  // waere - also wird nicht gesprungen.
  if (plan.grund && plan.grund.startsWith("Routeneintrag ungueltig")) {
    return { ok: false, grund: plan.grund, erwartet: null, plan };
  }

  if (!plan.ziel) {
    const grund = plan.fertig
      ? "Die Route ist abgearbeitet - es gibt keinen naechsten Knoten."
      : "Kein Ziel offen: " + (plan.grund || "unbekannt") +
        (plan.uebersprungen.length
          ? " (uebersprungen: " + plan.uebersprungen.map((e) => e.node + "/" + e.level).join(", ") +
            " - das fehlende Gewerk liegt nicht auf home)"
          : "");
    return { ok: false, grund, erwartet: null, plan };
  }

  if (plan.ziel.node !== ziel) {
    return {
      ok: false,
      grund: "Ziel " + ziel + " ist NICHT der naechste Routeneintrag. Erwartet: " +
        plan.ziel.node + " (Stufe " + plan.ziel.level + ", " + plan.ziel.verfahren + ")." +
        " Die Reihenfolge der Route wird nicht auf Zuruf geaendert.",
      erwartet: plan.ziel.node,
      plan,
    };
  }

  return { ok: true, grund: "", erwartet: plan.ziel.node, plan };
}

/**
 * Der Routenzustand als ein Wort - das Feld `route_state` aus kpi.json.
 *
 *   "open"     ein Ziel steht offen, der Weg ist frei
 *   "blocked"  es gibt offene Eintraege, aber allen fehlt ihr Gewerk
 *   "done"     die Route ist abgearbeitet
 *
 * `blocked` ist der Zustand, den es zu sehen gilt: der Bot laeuft weiter,
 * kommt aber nicht mehr vom Fleck, weil eine Datei fehlt. Ohne eigenes Wort
 * dafuer sieht das aus wie `open` mit einem langsamen Knoten.
 */
export function routeZustand(plan) {
  if (!plan) return "open";
  if (plan.ziel) return "open";
  if (plan.uebersprungen && plan.uebersprungen.length) return "blocked";
  if (plan.fertig) return "done";
  return "blocked";
}

/**
 * ===========================================================================
 * EPOCHEN: LAUF 1 UND LAUF 2 HABEN JE EINE EIGENE ROUTE (K01, 14.11.2026)
 * ===========================================================================
 *
 * `route.json` ist die Route von LAUF 1 (BN8 ist der letzte Eintrag) und
 * bleibt es: Zeichen fuer Zeichen unveraendert, auch nach dem Merge dieses
 * Postens. Die Route von LAUF 2 (frischer Spielstand, BN1.1 -> BN4.1 -> ...)
 * liegt in `route-lauf2.json` und gilt NUR, wenn die Epoche `lauf2` heisst.
 *
 * WARUM EINE EIGENE DATEI STATT EINER NEUEN `route.json`
 * Wuerde `route.json` selbst umgeschrieben, hinge Lauf 1 (BN8.x laeuft live)
 * am Zeitpunkt des Merges: ausgang.js und exit.js lesen die Datei bei jedem
 * Durchgang, die Bruecke schiebt sie sofort ins Spiel, und ein Lauf-2-Anfang
 * in einem Lauf-1-Spielstand verlangt "BN1 -> BN4" statt "BN8 L3" - das ist
 * ein Fehlsprung, und ein Sprung laesst sich nicht zuruecknehmen.
 *
 * WIE DIE EPOCHE KOMMT
 * Aus einer Datei, die der Wirt liest (`EPOCHE_DATEI`, auf home). Fehlt sie
 * oder ist sie leer, gilt `lauf1` - der heutige Pfad. Eine Epoche, die da
 * steht, aber niemand kennt (Tippfehler, halb geschriebene Datei), ist KEIN
 * `lauf1`: `leseEpoche` liefert null, `ladeRoute` liefert dann eine leere
 * Route, und leere Routen erlauben keinen Sprung (test-zielvalidierung).
 * Der Bot steht lieber, als dass er mit der falschen Route springt.
 * Die Bruecken-Konfiguration auf dem Rechner (sync/, Epoche `lauf1`/`lauf2`)
 * ist eine ANDERE Datei: das Spiel sieht den Rechner nicht. Beide muessen
 * beim Wechsel von Hand zusammen gesetzt werden (tools/lauf2-uebergabe.js).
 *
 * DIE ZWEITE LEINE: `ladeRoute` prueft den Spielstand gegen die Route. Die
 * Lauf-1-Route laesst die Stufe 1 von BN1/4/5/6/10 aus - sie setzt voraus,
 * dass diese SF schon da sind. Aus der Datei abgeleitet: jeder Knoten, dessen
 * erster Eintrag Stufe m > 1 hat, verlangt SF >= m-1. Ein frisches Spiel mit
 * vergessener Epochendatei (BN1.1, keine SF) faellt damit durch - es bekaeme
 * sonst "Ziel BN10" und wuerde dorthin springen.
 *
 * EINBAU IN DIE LESER (nicht Teil dieses Postens; ausgang.js ~Z.206, exit.js
 * ~Z.71-79, beide vor dem ersten Lauf-2-Start, NICHT vorher):
 *
 *   const epoche = leseEpoche(ns.read(EPOCHE_DATEI));            // "" -> lauf1
 *   const geladen = ladeRoute(ns.read(routeDatei(epoche) || ROUTE_DATEI.lauf1),
 *                             epoche, info.currentNode, info.ownedSF);
 *   const route = geladen.route;      // leer = kein Ausgang, Grund in geladen.grund
 *
 * und `route-lauf2.json` + `epoche.json` in ausgang.js `BIBLIOTHEKEN` (scp
 * auf Fremdrechner) bzw. in exit.js neben `route.json` aufnehmen.
 */
export const EPOCHEN = ["lauf1", "lauf2"];
export const STANDARD_EPOCHE = "lauf1";
export const EPOCHE_DATEI = "epoche.json";
export const ROUTE_DATEI = { lauf1: "route.json", lauf2: "route-lauf2.json" };

/**
 * Epoche aus beliebiger Quelle lesen. Reine Funktion, kein ns.
 *
 * Nimmt: nichts / "" -> lauf1 (heutiger Pfad); den Namen als Text ("lauf2");
 * JSON-Text oder Objekt mit Feld `epoche` ({"epoche":"lauf2"}); ein JSON ohne
 * dieses Feld -> lauf1. Ein Byte-Order-Mark vorn stoert nicht.
 * Liefert "lauf1" | "lauf2", oder null, wenn etwas dasteht, das keine
 * bekannte Epoche ist (unlesbar, falscher Typ, unbekannter Name).
 */
export function leseEpoche(quelle) {
  if (quelle === undefined || quelle === null) return STANDARD_EPOCHE;
  let wert = quelle;
  if (typeof wert === "string") {
    const t = wert.replace(/^﻿/, "").trim();
    if (t === "") return STANDARD_EPOCHE;
    if (t[0] === "{") {
      try { wert = JSON.parse(t); } catch { return null; }
    } else {
      wert = { epoche: t };
    }
  }
  if (typeof wert !== "object" || Array.isArray(wert)) return null;
  const roh = wert.epoche;
  if (roh === undefined || roh === null || roh === "") return STANDARD_EPOCHE;
  if (typeof roh !== "string") return null;
  const name = roh.trim().toLowerCase();
  return EPOCHEN.includes(name) ? name : null;
}

/** Dateiname der Route einer Epoche, null bei unbekannter Epoche. */
export function routeDatei(epoche) {
  return Object.prototype.hasOwnProperty.call(ROUTE_DATEI, epoche) ? ROUTE_DATEI[epoche] : null;
}

/**
 * Routendatei einer Epoche laden und gegen Epoche und Spielstand pruefen.
 *
 * @param {string} inhalt Text der Routendatei (routeDatei(epoche))
 * @param {string|null} epoche Ergebnis von leseEpoche
 * @param {number|null} cur aktueller BitNode (nur fuer die Meldung)
 * @param {object|Map} sf ownedSF aus getResetInfo()
 * @returns {{ok: boolean, epoche: string|null, datei: string|null, route: Array, grund: string}}
 *   Bei ok=false ist `route` LEER - die Leser behandeln das als "kein Sprung".
 */
export function ladeRoute(inhalt, epoche, cur = null, sf = {}) {
  const datei = routeDatei(epoche);
  const nein = (grund) => ({ ok: false, epoche: epoche ?? null, datei, route: [], grund });
  if (!datei) return nein("Epoche unbekannt: " + JSON.stringify(epoche) + " - kein Sprung.");

  let doc;
  try { doc = JSON.parse(inhalt); } catch { return nein(datei + " fehlt oder ist unlesbar."); }
  const route = doc && Array.isArray(doc.route) ? doc.route : null;
  if (!route || !route.length) return nein(datei + " enthaelt keine Route.");

  // route.json (Lauf 1) traegt kein Feld `epoche` und gilt als lauf1.
  const deklariert = doc.epoche === undefined ? STANDARD_EPOCHE : doc.epoche;
  if (deklariert !== epoche) {
    return nein(datei + " gehoert zu Epoche " + JSON.stringify(deklariert)
      + ", verlangt ist " + epoche + " - kein Sprung.");
  }

  // Voraussetzung der Route: fehlende Stufe-1-Eintraege heissen "SF schon da".
  const stufe = (n) => {
    const v = sf instanceof Map ? sf.get(n) : (sf ? sf[n] : 0);
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };
  const kleinste = {};
  for (const e of route) {
    if (e && Number.isInteger(e.node) && Number.isInteger(e.level)) {
      if (!(e.node in kleinste) || e.level < kleinste[e.node]) kleinste[e.node] = e.level;
    }
  }
  const fehlt = [];
  for (const [n, m] of Object.entries(kleinste)) {
    if (stufe(Number(n)) < m - 1) fehlt.push("SF" + n + " >= " + (m - 1));
  }
  if (fehlt.length) {
    return nein("Spielstand passt nicht zur Route " + epoche + " (" + datei + " setzt " + fehlt.join(", ")
      + " voraus; BitNode " + cur + "). Epochendatei vergessen? - kein Sprung.");
  }
  return { ok: true, epoche, datei, route, grund: "" };
}
