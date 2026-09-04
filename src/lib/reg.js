/**
 * Der Registry-Leser - EIN Ort fuer "was laeuft wo, unter welchen Bedingungen".
 *
 * ===========================================================================
 * WAS ER ERSETZT
 * ===========================================================================
 *
 * Heute stehen dieselben Angaben an zwei Stellen in `bn4net.js`: die
 * `WERKZEUGE`-Liste (was gestartet wird) und die `TELEMETRIE`-Tabelle (was
 * ueberwacht wird). Beide sind von Hand gepflegt, beide muessen zusammenpassen,
 * und niemand merkt es, wenn sie es nicht tun - ein Werkzeug ohne
 * Telemetrieeintrag laeuft unbeaufsichtigt, ein Telemetrieeintrag ohne
 * Werkzeug meldet ewig "veraltet".
 *
 * ===========================================================================
 * DER ROLLEN-RIEGEL (ARCHITEKTUR 3.2)
 * ===========================================================================
 *
 * Ohne ihn ist die Registry GEFAEHRLICHER als die heutige Liste.
 *
 * `data/verfahren.txt` enthaelt die Rolle des laufenden Knotens ("V2 10 2").
 * `boot.js` loescht sie beim Neuanlauf absichtlich NICHT (`boot.js:94-99`) -
 * nach einem Knotensprung steht dort also einige Sekunden lang die Rolle des
 * ALTEN Knotens. Wer in diesem Fenster startet, startet das Gewerk des
 * vorigen Laufs.
 *
 * Die heutige Liste macht diesen Fehler auch, aber seltener: sie bewertet
 * weniger Bedingungen. Die Registry bewertet alle Eintraege gleichzeitig und
 * traefe die falsche Wahl gleich mehrfach.
 *
 * Deshalb: die Knotennummer in der Datei wird gegen `getResetInfo().currentNode`
 * gehalten. Passt sie nicht, ist die Rolle UNBEKANNT, und es starten nur
 * Eintraege mit `verfahren: "alle"`. Das ist die vorsichtige Seite - diese
 * Eintraege laufen in jedem Knoten.
 *
 * ===========================================================================
 * KOSTET NICHTS
 * ===========================================================================
 *
 * Dieses Modul ruft keine teure ns-Funktion auf. Alles, was es braucht, gibt
 * der Aufrufer herein: den Zustand aus `getResetInfo()` (den der Kern ohnehin
 * liest) und den Dateiinhalt. Damit ist es auch ohne Spiel testbar.
 */

/** Schemaversion, die dieser Leser versteht. */
export const REG_SCHEMA = 1;

/**
 * Liest die Rolle aus dem Inhalt von `data/verfahren.txt`.
 *
 * Format: `"<verfahren> <knoten> <stufe>"`, z. B. `"V2 10 2"`.
 *
 * @returns {{verfahren: string, node: number|null, level: number|null}}
 */
export function leseRolle(inhalt) {
  const teile = String(inhalt || "").trim().split(/\s+/);
  const verfahren = teile[0] || "";
  const node = Number.isFinite(Number(teile[1])) && teile[1] !== "" ? Number(teile[1]) : null;
  const level = Number.isFinite(Number(teile[2])) && teile[2] !== "" ? Number(teile[2]) : null;
  return { verfahren, node, level };
}

/**
 * Der Riegel: gilt die Rolle aus der Datei fuer den laufenden Knoten?
 *
 * @param {object} rolle aus leseRolle()
 * @param {number} currentNode aus getResetInfo()
 * @returns {{verfahren: string, gilt: boolean, grund: string}}
 */
export function pruefeRolle(rolle, currentNode) {
  if (!rolle || !rolle.verfahren) {
    return { verfahren: "unbekannt", gilt: false, grund: "verfahren.txt ist leer oder fehlt" };
  }
  if (rolle.node === null) {
    return { verfahren: "unbekannt", gilt: false, grund: "verfahren.txt nennt keinen Knoten" };
  }
  if (rolle.node !== currentNode) {
    return {
      verfahren: "unbekannt",
      gilt: false,
      grund: "verfahren.txt steht auf Knoten " + rolle.node + ", der Lauf ist in " +
        currentNode + " - die Datei stammt noch aus dem vorigen Knoten",
    };
  }
  return { verfahren: rolle.verfahren, gilt: true, grund: "" };
}

/**
 * Gilt ein einzelner Eintrag?
 *
 * @param {object} e Registry-Eintrag
 * @param {object} lage {node, verfahren, phase, dateiDa, features}
 *   - `dateiDa(name)` sagt, ob die Datei auf home liegt
 *   - `features` z. B. {sf9: 1} fuer knotenunabhaengige Freischaltungen
 * @returns {{gilt: boolean, grund: string}}
 */
export function gilt(e, lage) {
  if (!e || !e.name) return { gilt: false, grund: "Eintrag ohne Namen" };

  // Ein noch nicht gebautes Gewerk ist KEIN Haenger (ARCHITEKTUR E6). Es wird
  // uebersprungen, ohne die Strafleiter zu speisen - sonst bestrafte der
  // Waechter den Bot dafuer, dass eine Datei noch nicht geschrieben wurde.
  if (e.unbuilt || e.ramBaseGb === null || e.ramBaseGb === undefined) {
    return { gilt: false, grund: "noch nicht gebaut" };
  }

  if (typeof lage.dateiDa === "function" && !lage.dateiDa(e.name)) {
    return { gilt: false, grund: "Datei liegt nicht auf home" };
  }

  // Knoten: "alle" oder eine Liste.
  if (Array.isArray(e.knoten)) {
    if (!e.knoten.includes(lage.node)) {
      return { gilt: false, grund: "gilt nur in Knoten " + e.knoten.join("/") };
    }
  } else if (e.knoten !== "alle" && Number(e.knoten) !== lage.node) {
    return { gilt: false, grund: "gilt nur in Knoten " + e.knoten };
  }

  // Verfahren: "alle" laeuft immer - das ist die Seite, auf die der
  // Rollen-Riegel im Zweifel zurueckfaellt.
  if (e.verfahren !== "alle") {
    if (lage.verfahren === "unbekannt") {
      return { gilt: false, grund: "Rolle unbekannt, nur 'alle' laeuft" };
    }
    const erlaubt = Array.isArray(e.verfahren) ? e.verfahren : [e.verfahren];
    if (!erlaubt.includes(lage.verfahren)) {
      return { gilt: false, grund: "gilt nur fuer " + erlaubt.join("/") };
    }
  }

  // Phase: "beide", "kaltstart" oder "normal".
  if (e.phase !== "beide" && e.phase !== lage.phase) {
    return { gilt: false, grund: "gilt nur in Phase " + e.phase };
  }

  // Vorbedingungen an Dateien.
  const p = e.precondition || {};
  if (typeof lage.dateiDa === "function") {
    if (p.requiresFile && !lage.dateiDa(p.requiresFile)) {
      return { gilt: false, grund: "wartet auf " + p.requiresFile };
    }
    if (p.forbidsFile && lage.dateiDa(p.forbidsFile)) {
      return { gilt: false, grund: "blockiert durch " + p.forbidsFile };
    }
  }
  if (p.requiresFeature) {
    const f = (lage.features || {})[p.requiresFeature];
    if (!f) return { gilt: false, grund: "Freischaltung fehlt: " + p.requiresFeature };
  }

  return { gilt: true, grund: "" };
}

/**
 * Alle geltenden Eintraege, nach `priority` sortiert.
 *
 * Die Sortierung ist stabil und aufsteigend: kleinere Zahl = frueher starten.
 * Bei gleicher Prioritaet bleibt die Reihenfolge der Registry erhalten - so
 * laesst sich die heutige Startreihenfolge exakt nachbilden.
 */
export function auswahl(registry, lage) {
  const eintraege = (registry && registry.eintraege) || [];
  const mit = [];
  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i];
    const g = gilt(e, lage);
    if (g.gilt) mit.push({ e, i });
  }
  mit.sort((a, b) => (a.e.priority - b.e.priority) || (a.i - b.i));
  return mit.map((x) => x.e);
}

/**
 * Die Zaehlwerte fuer `kpi.json` (ARCHITEKTUR E6).
 *
 *   gilt      Eintraege, die laufen sollen
 *   running   davon laufend
 *   absent    sollen laufen, tun es nicht
 *   unbuilt   Gewerk noch nicht gebaut - KEIN Fehler
 *   vanished  Datei war da und ist weg
 *   degraded  laufen, aber die Telemetrie ist veraltet
 *   wartetGb  RAM, den ein wartender Eintrag braeuchte
 */
export function zaehlwerk(registry, lage, laeuft, telemetrieFrisch) {
  const z = { gilt: 0, running: 0, absent: 0, unbuilt: 0, vanished: 0, degraded: 0, wartetGb: 0 };
  for (const e of (registry && registry.eintraege) || []) {
    if (e.unbuilt || e.ramBaseGb === null || e.ramBaseGb === undefined) { z.unbuilt++; continue; }
    const g = gilt(e, lage);
    if (!g.gilt) {
      // "Datei liegt nicht auf home" bei einem sonst gueltigen Eintrag heisst:
      // sie ist verschwunden. Das ist etwas anderes als "nie gebaut".
      if (g.grund === "Datei liegt nicht auf home") z.vanished++;
      continue;
    }
    z.gilt++;
    if (typeof laeuft === "function" && laeuft(e)) {
      z.running++;
      if (typeof telemetrieFrisch === "function" && !telemetrieFrisch(e)) z.degraded++;
    } else {
      z.absent++;
      z.wartetGb += ramBedarf(e, lage);
    }
  }
  return z;
}

/**
 * RAM-Bedarf eines Eintrags in der laufenden Umgebung.
 *
 * Die Formel steht in der Registry selbst (`ramFormel`), damit sie nicht an
 * zwei Orten gepflegt wird:
 *
 *     ramBaseGb + ramSingGb * (node === 4 ? 1 : sf4 <= 1 ? 16 : sf4 === 2 ? 4 : 1)
 *
 * Der Faktor kommt aus `RamCostGenerator.ts`: Singularity-Funktionen kosten
 * ausserhalb von BitNode 4 das Sechzehnfache, bis SF4 Stufe 2 (dann 4) und
 * Stufe 3 (dann 1) das abschwaechen.
 */
export function ramBedarf(e, lage) {
  const basis = Number.isFinite(e.ramBaseGb) ? e.ramBaseGb : 0;
  const sing = Number.isFinite(e.ramSingGb) ? e.ramSingGb : 0;
  if (sing === 0) return basis;
  const node = lage.node;
  const sf4 = Number((lage.ownedSF || {})[4] ?? (lage.sf4 ?? 0));
  const faktor = node === 4 ? 1 : (sf4 <= 1 ? 16 : (sf4 === 2 ? 4 : 1));
  return basis + sing * faktor;
}

/**
 * Die Telemetrie-Tabelle, wie sie der Kern heute von Hand fuehrt:
 * [name, telemetryFile, freshnessMs].
 *
 * Sie wird aus denselben Eintraegen gebildet wie die Startliste - damit kann
 * ein Werkzeug nicht mehr laufen, ohne ueberwacht zu werden.
 */
export function telemetrieTabelle(registry, lage) {
  return auswahl(registry, lage)
    .filter((e) => e.telemetryFile)
    .map((e) => [e.name, e.telemetryFile, e.freshnessMs || 600000]);
}

/** Laedt die Registry aus einem Dateiinhalt. Unlesbares ergibt eine leere. */
export function laden(roh) {
  if (!roh) return { schema: REG_SCHEMA, eintraege: [], fehler: "registry.json fehlt" };
  let r;
  try {
    r = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch (e) {
    return { schema: REG_SCHEMA, eintraege: [], fehler: "registry.json unlesbar: " + e.message };
  }
  if (!r || !Array.isArray(r.eintraege)) {
    return { schema: REG_SCHEMA, eintraege: [], fehler: "registry.json ohne Eintraege" };
  }
  // Eine neuere Registry wird NICHT stillschweigend halb verstanden.
  if (Number.isFinite(r.schema) && r.schema > REG_SCHEMA) {
    return { ...r, fehler: "registry.json hat Schema " + r.schema +
      ", dieser Leser kennt nur " + REG_SCHEMA };
  }
  return r;
}
