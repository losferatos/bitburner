/**
 * Welches Stueck wird als naechstes gegraftet?
 *
 * ===========================================================================
 * WARUM DAS EIN EIGENES MODUL IST
 * ===========================================================================
 *
 * Heute entscheidet ein Mensch: `tools/graftnext.js` liest die Reihenfolge
 * ueber die Bruecke und legt einen Auftrag ab, auf Zuruf. Damit ist Grafting
 * das einzige Gewerk, das jemanden braucht - und es steht still, sobald
 * niemand hinsieht.
 *
 * Der Auftrag nennt Grafting den groessten Posten nach der Route: Faktor 10
 * bis 20 auf den Rangweg, wirksam in 30 der 40 Restlaeufe.
 *
 * Die Auswahl ist eine reine Funktion. Das ist Absicht: sie laesst sich
 * vollstaendig ohne Spiel pruefen, und der teure Teil (`ns.grafting.*`,
 * `ns.singularity.*`) bleibt in `graft.js`, wo er ohnehin schon steht.
 *
 * ===========================================================================
 * DIE DREI REGELN
 * ===========================================================================
 *
 * 1. VIOLET CONGRUITY, SOBALD BEZAHLBAR - ABER NIEMAND WARTET AUF IHN.
 *
 *    Es loescht die Entropie rueckwirkend (`AugmentationHelpers.ts:45-49`),
 *    und danach erzeugt kein Graft mehr welche (`GraftingWork.tsx:61-64`).
 *
 *    KORRIGIERTE BEGRUENDUNG (04.09.2026, Skeptiker Substanz). Hier stand:
 *    "wer zuerst graftet, arbeitet den Rest mit vollen Multiplikatoren ab
 *    statt mit 0,98^n". Das ist falsch. `applyEntropy` ruft
 *    `reapplyAllAugmentations()` und rechnet die Multiplikatoren JEDES MAL von
 *    Grund auf neu (`PlayerObjectAugmentationMethods.ts:8-25`,
 *    `EntropyAccumulation.ts:6-7`) - das Endergebnis ist reihenfolgeunabhaengig.
 *
 *    Und der Preis des Wartens ist gewaltig: Congruity kostet als Graft
 *    150 Billionen (`Augmentations.ts:391`, dreifacher Grundpreis nach
 *    `GraftableAugmentation.ts:21`), mit dem Puffer also 300 Billionen. Die
 *    restlichen 38 Stuecke kosten zusammen 0,42 Billionen - Faktor 360
 *    weniger. Wer auf Congruity wartet, graftet monatelang gar nichts.
 *
 *    Deshalb: WENN bezahlbar, dann zuerst - der Vorteil waehrend der
 *    Graftphase ist real, wenn auch voruebergehend. Wenn nicht, wird die Liste
 *    abgearbeitet, und Congruity kommt, wenn das Geld da ist.
 *
 * 2. DANN DIE LISTE, der Reihe nach. Sie ist greedy nach Zuwachs der
 *    Erfolgschance je Stunde hergeleitet, mit eingerechneten
 *    Voraussetzungsketten.
 *
 * 3. NICHTS BEGINNEN, WAS DER SPRUNG ZERREISST. Ein Graft ist erst mit dem
 *    letzten Prozent etwas wert; bricht der Knotenwechsel mittendrin herein,
 *    war die ganze Zeit und das ganze Geld umsonst.
 */

/**
 * Wie viel Geld nach dem Graft uebrig bleiben muss.
 *
 * NICHT NULL. Ein Graft, der das Konto leerraeumt, blockiert danach jeden
 * Augmentierungskauf und jeden Rechnerausbau - und beides ist der eigentliche
 * Fortschritt. Der Faktor ist derselbe wie beim Rechnerkauf des Kerns.
 */
export const PUFFER_FAKTOR = 2;

/**
 * @param {object} lage
 * @param {object} lage.plan          aus src/graftplan.json
 * @param {string[]} lage.besitzt     bereits eingebaute oder gegraftete Stuecke
 * @param {object} lage.preise        {name: kosten} - nur was graftbar ist
 * @param {object} lage.dauern        {name: ms}
 * @param {number} lage.geld
 * @param {number|null} lage.etaMin   Restzeit bis zum Sprung, null = unbekannt
 * @param {boolean} lage.etaSicher    ist die Restzeit belastbar?
 * @param {string|null} lage.laeuft   was gerade gegraftet wird
 * @returns {{name: string|null, grund: string, wartet: boolean}}
 */
export function naechstes(lage) {
  const plan = lage.plan || {};
  // Warum der Vorzug diesmal nicht drankam - fuer den Bericht, nicht fuer die
  // Entscheidung.
  let grundVorzug = null;
  const liste = Array.isArray(plan.reihenfolge) ? plan.reihenfolge : [];
  const besitzt = new Set(lage.besitzt || []);
  const preise = lage.preise || {};
  const dauern = lage.dauern || {};

  if (lage.laeuft) {
    return { name: null, grund: "es laeuft bereits: " + lage.laeuft, wartet: false };
  }
  if (!liste.length) {
    return { name: null, grund: "kein Graftplan vorhanden", wartet: false };
  }

  // Regel 1: der Vorzug, sobald bezahlbar.
  const v = plan.vorzug;
  if (v && v.name && !besitzt.has(v.name)) {
    const p = preise[v.name];
    if (Number.isFinite(p)) {
      const pruefung = bezahlbar(p, lage.geld);
      if (pruefung.ok) {
        const z = passtInDieZeit(dauern[v.name], lage);
        if (z.ok) return { name: v.name, grund: v.regel || "Vorzug", wartet: false };
        return { name: null, grund: v.name + ": " + z.grund, wartet: true };
      }
      // WEITERGEHEN, NICHT WARTEN (04.09.2026, Skeptiker Substanz).
      //
      // Hier stand das Gegenteil, mit der Begruendung, der Vorzug muesse VOR
      // den anderen kommen. Der Grund dafuer war falsch (siehe Regel 1 oben:
      // das Entropie-Endergebnis ist reihenfolgeunabhaengig), und die Folge
      // waere schwer gewesen: Congruity kostet mit Puffer 300 Billionen, die
      // restlichen 38 Stuecke zusammen 0,42 - das Gewerk haette ab der ersten
      // Runde stillgestanden, bis ein Betrag zusammen ist, den der Bot auf
      // dieser Route nie erreicht.
      //
      // `wartet` bleibt trotzdem false: das Gewerk WARTET nicht, es geht
      // weiter. Der Zustand "blocked" waere hier eine Fehlmeldung.
      grundVorzug = v.name + ": " + pruefung.grund + " - die Liste geht vor";
    }
    // Nicht graftbar (noch nicht freigeschaltet): dann geht es weiter.
  }

  // Regel 2: die Liste der Reihe nach.
  for (const name of liste) {
    if (besitzt.has(name)) continue;
    const p = preise[name];
    if (!Number.isFinite(p)) continue;      // nicht graftbar, ueberspringen
    const pruefung = bezahlbar(p, lage.geld);
    if (!pruefung.ok) {
      return { name: null, grund: name + ": " + pruefung.grund, wartet: true };
    }
    const z = passtInDieZeit(dauern[name], lage);
    if (!z.ok) return { name: null, grund: name + ": " + z.grund, wartet: true };
    return {
      name,
      grund: "naechster offener Eintrag"
        + (grundVorzug ? " (" + grundVorzug + ")" : ""),
      wartet: false,
    };
  }

  return { name: null, grund: "alles gegraftet, was der Plan kennt", wartet: false };
}

/**
 * Reicht das Geld - mit Puffer?
 *
 * Ein Graft, der das Konto leerraeumt, blockiert danach jeden
 * Augmentierungskauf. Deshalb muss das Doppelte da sein, nicht der Preis.
 */
export function bezahlbar(preis, geld) {
  if (!Number.isFinite(preis) || preis <= 0) {
    return { ok: false, grund: "kein Preis bekannt" };
  }
  if (!Number.isFinite(geld)) return { ok: false, grund: "Kontostand unbekannt" };
  if (geld < preis * PUFFER_FAKTOR) {
    return {
      ok: false,
      grund: "kostet " + (preis / 1e9).toFixed(2) + " Mrd, noetig mit Puffer "
        + (preis * PUFFER_FAKTOR / 1e9).toFixed(2) + " Mrd, vorhanden "
        + (geld / 1e9).toFixed(2) + " Mrd",
    };
  }
  return { ok: true, grund: "" };
}

/**
 * Passt der Graft noch vor den Knotenwechsel?
 *
 * DIE UNSICHERE SCHAETZUNG BLOCKIERT NICHT. Auf dem Bladeburner-Weg ist
 * `eta_min` eine untere Schranke (sie misst bis zur Rangschwelle, nicht bis
 * zur Ausfuehrung der Black Ops) und damit immer zu kurz. Wer darauf
 * reagiert, graftet stundenlang gar nicht mehr - und Grafting ist der groesste
 * Ertragsposten ueberhaupt.
 */
export function passtInDieZeit(dauerMs, lage) {
  if (!Number.isFinite(dauerMs) || dauerMs <= 0) return { ok: true, grund: "" };
  if (lage.etaMin === null || lage.etaMin === undefined) return { ok: true, grund: "" };
  if (!lage.etaSicher) return { ok: true, grund: "" };

  const dauerMin = dauerMs / 60000;
  if (lage.etaMin < dauerMin) {
    return {
      ok: false,
      grund: "braucht " + dauerMin.toFixed(0) + " min, der Sprung kommt in "
        + Number(lage.etaMin).toFixed(0) + " min - er wuerde mittendrin abbrechen",
    };
  }
  return { ok: true, grund: "" };
}

/**
 * Wie weit ist der Plan?
 *
 * Fuer den Bericht - und fuer `graft_busy_pct`, das gegen 100 % laufen soll.
 */
export function fortschritt(plan, besitzt) {
  const liste = Array.isArray(plan && plan.reihenfolge) ? plan.reihenfolge : [];
  const hat = new Set(besitzt || []);
  const fertig = liste.filter((n) => hat.has(n)).length;
  return {
    gesamt: liste.length,
    fertig,
    offen: liste.length - fertig,
    prozent: liste.length ? Math.round((fertig / liste.length) * 100) : 0,
  };
}
