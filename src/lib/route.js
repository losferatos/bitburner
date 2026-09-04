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
