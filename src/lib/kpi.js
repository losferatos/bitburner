/**
 * `data/kpi.json` - der Kennzahlen-Kontrakt.
 *
 * ===========================================================================
 * WARUM DIE FELDLISTE CODE IST UND KEINE DOKUMENTATION
 * ===========================================================================
 *
 * Auftrag 8, Phase C, woertlich: `tools/checkin.js` liest NUR Felder aus dieser
 * Liste und meldet unbekannte oder fehlende als Befund. Eine Liste, die nur in
 * einer Markdown-Datei steht, kann das nicht leisten - sie weicht ab, sobald
 * Gewerk 3 einen anderen Namen schreibt als Gewerk 7, und niemand merkt es,
 * weil beide Dateien fuer sich betrachtet plausibel aussehen.
 *
 * Deshalb steht je Feld hier: Einheit, UHR und Sollwert. Die Uhr ist kein
 * Beiwerk. Die vier Fehlrechnungen vom 30.08.2026 gingen samt und sonders
 * darauf zurueck, dass eine Groesse in der falschen Zeit gemessen wurde.
 *
 * ===========================================================================
 * DREI UHREN, UND JEDES FELD NENNT SEINE
 * ===========================================================================
 *
 *   "wand"    Date.now() - laeuft auch, wenn der Rechner aus ist
 *   "motor"   Motorzeit  - zaehlt nur, was der Bot wirklich gearbeitet hat
 *   "bonus"   Delta getBonusTime() - Bladeburner-Eigenzeit
 *   "-"       zaehlt Ereignisse, misst keine Zeit
 *
 * `T2_h` und `vorrat_deckung` laufen ausdruecklich NICHT in Motorzeit
 * (ARCHITEKTUR 4.2): gedrosselt bekommt Bladeburner 25 von 300 Zyklen. Ein
 * Nenner, der nicht messbar ist, fuehrt zum VERWERFEN des Fensters, nie zum
 * Schaetzen.
 *
 * ===========================================================================
 * DIE DATEI UEBERLEBT EINBAU UND KNOTENWECHSEL
 * ===========================================================================
 *
 * Sie liegt auf home. Ein Feldwechsel braucht deshalb zwingend eine Wanderung
 * beim Laden - sonst fuellt die Ergaenzungslogik das fehlende Feld aus der
 * Vorlage auf, und der Bericht meldet weiter Werte, die niemand mehr schreibt.
 */

export const KPI_VERSION = 2;

/**
 * Die vollstaendige Feldliste. Schluessel = Feldname in `data/kpi.json`.
 *
 *   einheit  wofuer die Zahl steht
 *   uhr      wand | motor | bonus | -
 *   soll     Zielwert oder null; `checkin.js` meldet Abweichungen
 *   art      zahl | text | objekt | null-oder-objekt
 *   klasse   lauf | autonomie | effizienz - nur fuer die Gruppierung im Bericht
 */
export const FELDER = {
  // --- Zuordnung zum Lauf ---------------------------------------------------
  version: { einheit: "Schema", uhr: "-", soll: KPI_VERSION, art: "zahl", klasse: "lauf" },
  nodeReset: { einheit: "ms", uhr: "wand", soll: null, art: "zahl", klasse: "lauf" },
  augReset: { einheit: "ms", uhr: "wand", soll: null, art: "zahl", klasse: "lauf" },
  node: { einheit: "Knoten", uhr: "-", soll: null, art: "zahl", klasse: "lauf" },
  level: { einheit: "Lauf", uhr: "-", soll: null, art: "zahl", klasse: "lauf" },
  verfahren: { einheit: "Name", uhr: "-", soll: null, art: "text", klasse: "lauf" },
  motorTimeSinceNodeMs: { einheit: "ms", uhr: "motor", soll: null, art: "zahl", klasse: "lauf" },
  motorTimeSinceAugMs: { einheit: "ms", uhr: "motor", soll: null, art: "zahl", klasse: "lauf" },

  // --- Autonomie (Ziel null bzw. unter Schwelle) ----------------------------
  manual_actions: { einheit: "Zahl je Lauf", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  jump_latency_min: { einheit: "min", uhr: "wand", soll: 2, art: "zahl", klasse: "autonomie",
    hinweis: "abzueglich backup_wait_min" },
  backup_wait_min: { einheit: "min", uhr: "wand", soll: null, art: "zahl", klasse: "autonomie",
    hinweis: "Kennzahl der Bruecke, kein Fehler - getrennt gefuehrt" },
  wirt_fehlt_count: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  boot_latency_min: { einheit: "min", uhr: "wand", soll: 5, art: "zahl", klasse: "autonomie" },
  workbench_wait_h: { einheit: "h", uhr: "motor", soll: null, art: "zahl", klasse: "autonomie",
    hinweis: "Soll: <= 2 x Bestwert" },
  negative_balance_min: { einheit: "min", uhr: "wand", soll: 0, art: "zahl", klasse: "autonomie" },
  false_kill_count: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  false_penalty_count: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  ladder_rungs_ge3_per_week: { einheit: "Zahl", uhr: "wand", soll: 0, art: "zahl", klasse: "autonomie",
    hinweis: "jede ist ein Befund" },
  bridge_restarts: { einheit: "Zahl", uhr: "wand", soll: null, art: "zahl", klasse: "autonomie",
    hinweis: "Neustart binnen 10 s" },
  backup_age_h: { einheit: "h", uhr: "wand", soll: 1, art: "zahl", klasse: "autonomie" },
  queued_augs_at_jump: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  graft_aborted: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  skipped_route_entries: { einheit: "Zahl", uhr: "-", soll: 0, art: "zahl", klasse: "autonomie" },
  route_state: { einheit: "open|done|blocked", uhr: "-", soll: null, art: "text", klasse: "autonomie" },
  // Nachgetragen 04.09.2026: ausgang.js schreibt das Feld, der Kontrakt kannte
  // es nicht. Ein Feld ohne Kontrakteintrag faellt bei checkin.js still durch
  // die Feldpruefung - es kann wochenlang falsch sein, ohne aufzufallen.
  eta_min: { einheit: "min", uhr: "wand", soll: null, art: "zahl", klasse: "autonomie",
    hinweis: "null heisst nicht schaetzbar - nie eine geratene Zahl" },
  eta_sicher: { einheit: "ja|nein", uhr: "-", soll: null, art: "bool", klasse: "autonomie" },
  blocked_dialog: { einheit: "Text", uhr: "-", soll: null, art: "text-oder-null", klasse: "autonomie" },
  wasted_money_at_jump: { einheit: "$", uhr: "-", soll: null, art: "zahl", klasse: "autonomie",
    hinweis: "> 10 % Knotenumsatz = Befund" },
  registry: { einheit: "Zaehlwerk", uhr: "-", soll: null, art: "objekt", klasse: "autonomie",
    felder: ["gilt", "running", "absent", "unbuilt", "vanished", "degraded", "wartetGb"] },
  exhausted: { einheit: "Zustand", uhr: "wand", soll: null, art: "null-oder-objekt", klasse: "autonomie",
    felder: ["since", "lastRung", "signal"], hinweis: "erste Zeile von checkin.js" },

  // --- Effizienz je Phase ---------------------------------------------------
  t_workbench: { einheit: "h", uhr: "motor", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "Bestwert = Knotenpreis / Kaltstart-Einkommen" },
  contract_stock_usd: { einheit: "$", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "Bestand - liegengebliebene Vertraege sind KEIN Zufluss" },
  t_gate: { einheit: "h", uhr: "motor", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "zur Laufzeit aus dem Zustand gerechnet, nie Konstante" },
  idle_ram_pct: { einheit: "%", uhr: "motor", soll: 20, art: "zahl", klasse: "effizienz",
    hinweis: "< 20 % ueber 10 min" },
  throttle_rounds_per_min: { einheit: "1/min", uhr: "wand", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "ohne Patch = 1 (belegt)" },
  mult_product: { einheit: "-", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "V1, gegen Obergrenze 23,1" },
  favor_target_pct: { einheit: "%", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "gegen 462.490 Rep" },
  graft_busy_pct: { einheit: "%", uhr: "motor", soll: 100, art: "zahl", klasse: "effizienz",
    hinweis: "Reisezeit zaehlt mit" },
  t_rebuild_h: { einheit: "h", uhr: "motor", soll: 3.1, art: "zahl", klasse: "effizienz",
    hinweis: "> 30 % Abweichung = Figur-Konflikt" },
  T2_h: { einheit: "h", uhr: "bonus", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "NICHT Motorzeit - Delta getBonusTime()" },
  work_share: { einheit: "-", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "1 minus Kammeranteil" },
  vorrat_deckung: { einheit: "h je Aktionsart", uhr: "bonus", soll: 0.5, art: "objekt", klasse: "effizienz",
    hinweis: "Alarm < 0,5 h; NICHT Motorzeit" },
  rang_je_vorratseinheit: { einheit: "Rang/Auftrag", uhr: "-", soll: null, art: "objekt", klasse: "effizienz",
    hinweis: "< halbe beste Art = Vorrat wird verbrannt" },
  comms_rest: { einheit: "Zahl je Stadt", uhr: "-", soll: null, art: "objekt", klasse: "effizienz" },
  next_blackop_chance: { einheit: "0-1", uhr: "-", soll: 0.35, art: "zahl", klasse: "effizienz" },
  hp_max: { einheit: "HP", uhr: "-", soll: null, art: "zahl", klasse: "effizienz" },
  hp_loss_fail: { einheit: "HP", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "Verhaeltnis hp_max/hp_loss_fail >= 2" },
  chaos_city: { einheit: "-", uhr: "-", soll: 50, art: "objekt", klasse: "effizienz" },
  exp_rate_eff: { einheit: "EXP/s", uhr: "motor", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "V1; gemessen 1,4-2,2e6" },
  v1_stage: { einheit: "1-6", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "S2 nimmt je Stufe einen anderen Traeger" },
  bn8_phase: { einheit: "1|2", uhr: "-", soll: null, art: "zahl", klasse: "effizienz",
    hinweis: "Traegerwechsel Depot -> Hacking-Level" },
  traeger: { einheit: "Leitgroesse", uhr: "motor", soll: null, art: "objekt", klasse: "effizienz",
    felder: ["name", "wert", "motorTimeMs"],
    hinweis: "vom KERN gerechnet, vom Waechter nur gelesen - sonst sprengt getRank den 8-GB-Deckel" },
  bestwertStatus: { einheit: "geeicht|ungeeicht", uhr: "-", soll: null, art: "text", klasse: "effizienz",
    hinweis: "ungeeicht erzeugt KEIN E1" },
};

/** Felder, die nie fehlen duerfen - ohne sie ist die Datei nicht zuzuordnen. */
export const PFLICHT = ["version", "nodeReset", "augReset", "node", "level"];

/**
 * Ein leerer, gueltiger Satz. Alle Zaehler auf 0, alle Messwerte auf null.
 *
 * NULL UND NULLWERT SIND VERSCHIEDEN, und der Unterschied traegt hier
 * Bedeutung: `0` heisst "gemessen, war null"; `null` heisst "nie gemessen".
 * Ein Bericht, der beides verwechselt, meldet fuer eine nie gelaufene Phase
 * einen Bestwert von 0 h.
 */
export function leer(jetzt = 0) {
  const k = { version: KPI_VERSION, erzeugtAm: jetzt };
  for (const [name, def] of Object.entries(FELDER)) {
    if (name === "version") continue;
    if (def.klasse === "autonomie" && def.art === "zahl" && def.soll === 0) {
      k[name] = 0;          // ein Fehlerzaehler beginnt gemessen bei null
    } else if (def.art === "objekt") {
      k[name] = null;
    } else {
      k[name] = null;       // nie gemessen
    }
  }
  return k;
}

/**
 * Prueft eine geladene Datei gegen den Kontrakt.
 *
 * @returns {{unbekannt: string[], fehlend: string[], falscheArt: string[], ok: boolean}}
 */
export function pruefe(k) {
  const unbekannt = [];
  const fehlend = [];
  const falscheArt = [];
  if (!k || typeof k !== "object") {
    return { unbekannt, fehlend: [...PFLICHT], falscheArt, ok: false };
  }
  // Felder, die der Schreiber kennt, der Kontrakt aber nicht.
  const bekannt = new Set(Object.keys(FELDER));
  bekannt.add("erzeugtAm");
  bekannt.add("gewandertVon");
  for (const name of Object.keys(k)) {
    if (!bekannt.has(name)) unbekannt.push(name);
  }
  for (const name of PFLICHT) {
    if (k[name] == null) fehlend.push(name);
  }
  for (const [name, def] of Object.entries(FELDER)) {
    const v = k[name];
    if (v == null) continue;
    if (def.art === "zahl" && !Number.isFinite(v)) falscheArt.push(name + " (soll Zahl)");
    if (def.art === "text" && typeof v !== "string") falscheArt.push(name + " (soll Text)");
    if (def.art === "objekt" && typeof v !== "object") falscheArt.push(name + " (soll Objekt)");
  }
  return {
    unbekannt,
    fehlend,
    falscheArt,
    ok: unbekannt.length === 0 && fehlend.length === 0 && falscheArt.length === 0,
  };
}

/**
 * Laedt und wandert.
 *
 * REGEL 4 AUS ARCHITEKTUR 4.3, und sie ist die wichtigste: ist die `version`
 * GROESSER als die des lesenden Codes, wird die Datei NICHT geschrieben. Das
 * ist der Rollback-Fall - eine neuere Fassung hat Felder angelegt, die dieser
 * Code nicht kennt, und ein Schreiben wuerde sie loeschen.
 *
 * @param {string|object} roh Dateiinhalt
 * @param {number} nodeResetJetzt aus getResetInfo - Regel 3
 * @returns {{kpi: object, schreibsperre: boolean, befund: string|null}}
 */
export function laden(roh, nodeResetJetzt = null) {
  if (!roh) return { kpi: leer(), schreibsperre: false, befund: null };
  let k;
  try {
    k = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch {
    return { kpi: leer(), schreibsperre: false, befund: "kpi.json unlesbar - neu begonnen" };
  }
  if (!k || typeof k !== "object") {
    return { kpi: leer(), schreibsperre: false, befund: "kpi.json kein Objekt - neu begonnen" };
  }

  const v = Number.isFinite(k.version) ? k.version : 0;

  // Regel 4: neuere Datei - nicht anfassen.
  if (v > KPI_VERSION) {
    return {
      kpi: k,
      schreibsperre: true,
      befund: "kpi.json hat Version " + v + ", dieser Code kennt nur " + KPI_VERSION +
        " - es wird NICHT geschrieben (Rollback-Fall)",
    };
  }

  let befund = null;
  if (v < KPI_VERSION) {
    k = wandere(k, v);
    befund = "kpi.json von Version " + v + " auf " + KPI_VERSION + " gewandert";
  }

  // Regel 3: passt der Lauf nicht, beginnen die laufbezogenen Felder neu.
  if (nodeResetJetzt != null && Number.isFinite(k.nodeReset) && k.nodeReset !== nodeResetJetzt) {
    k = neuerLauf(k, nodeResetJetzt);
    befund = (befund ? befund + "; " : "") + "neuer Lauf erkannt - laufbezogene Felder auf 0";
  }

  return { kpi: k, schreibsperre: false, befund };
}

/**
 * Wanderung durch benannte Schritte. Jeder Schritt ist einzeln testbar.
 *
 * Ein Feld, das die Wanderung nicht kennt, bekommt den NULLWERT - nie einen
 * Wert aus der Vorlage.
 */
export function wandere(k, von) {
  const aus = { ...k };
  if (von < 2) {
    // v1 -> v2: die Autonomie- und Effizienzfelder kamen dazu. Fehlerzaehler
    // beginnen bei 0 (sie sind ab jetzt gemessen), Messwerte bleiben null
    // (sie wurden nie gemessen - eine 0 waere hier eine Behauptung).
    for (const [name, def] of Object.entries(FELDER)) {
      if (name in aus) continue;
      aus[name] = (def.klasse === "autonomie" && def.art === "zahl" && def.soll === 0) ? 0 : null;
    }
  }
  aus.version = KPI_VERSION;
  aus.gewandertVon = von;
  return aus;
}

/** Setzt alle laufbezogenen Felder zurueck - Regel 3 aus ARCHITEKTUR 4.3. */
export function neuerLauf(k, nodeResetJetzt) {
  const aus = { ...k };
  aus.nodeReset = nodeResetJetzt;
  aus.motorTimeSinceNodeMs = 0;
  for (const [name, def] of Object.entries(FELDER)) {
    if (def.klasse !== "autonomie") continue;
    if (def.art === "zahl" && def.soll === 0) aus[name] = 0;
  }
  // Effizienzwerte des alten Laufs sind fuer den neuen bedeutungslos.
  for (const [name, def] of Object.entries(FELDER)) {
    if (def.klasse === "effizienz") aus[name] = null;
  }
  aus.karenzBis = null;   // vom Aufrufer gesetzt: jetzt + 10 min
  return aus;
}

/** Alle Felder einer Klasse - fuer die Gruppierung im Bericht. */
export function felderDerKlasse(klasse) {
  return Object.entries(FELDER)
    .filter(([, d]) => d.klasse === klasse)
    .map(([n]) => n);
}

/**
 * Verletzt ein Wert sein Soll?
 *
 * Die Richtung steckt in der Bedeutung des Feldes, nicht im Sollwert: bei
 * `graft_busy_pct` (Soll 100) ist WENIGER schlecht, bei `backup_age_h`
 * (Soll 1) ist MEHR schlecht. Ohne diese Unterscheidung meldet der Bericht
 * jeden guten Wert als Abweichung.
 */
const MEHR_IST_BESSER = new Set(["graft_busy_pct", "next_blackop_chance", "vorrat_deckung"]);

export function verletzt(name, wert) {
  const def = FELDER[name];
  if (!def || def.soll == null || wert == null) return false;
  if (!Number.isFinite(wert) || !Number.isFinite(def.soll)) return false;
  return MEHR_IST_BESSER.has(name) ? wert < def.soll : wert > def.soll;
}
