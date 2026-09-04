/**
 * Der Figur-Vergabepunkt - wer darf die Spielfigur bewegen?
 *
 * ===========================================================================
 * DAS PROBLEM, DAS ES GIBT
 * ===========================================================================
 *
 * Sieben Dateien greifen heute auf dieselbe Figur zu: `blade.js` schickt sie
 * ins Gym, `graft.js` an die Werkbank, `bbtrain.js` wieder ins Gym,
 * `bn4life.js` auf ein Verbrechen, `bn4rep.js` zur Faktionsarbeit. Jede fuer
 * sich richtig, alle zusammen ein Ping-Pong: `bbtrain` ruft `stopAction()` bei
 * Konto unter 5 Mio, `joinrun` meldet "kein Kurs", schickt sie ins Gym,
 * `bbtrain` stoppt wieder.
 *
 * Teuer wird das beim Grafting. Ein laufender Graft, den ein anderes Skript
 * mit `stopAction()` unterbricht, ist NICHT pausiert - er ist weg, samt
 * bezahltem Geld. Bei Violet Congruity sind das 14,63 Milliarden.
 *
 * ===========================================================================
 * ENTSCHEIDUNG, AUSFUEHRUNG UND KONTROLLE LIEGEN AUSEINANDER
 * ===========================================================================
 *
 * Die ENTSCHEIDUNG liegt im Kern: Antraege lesen, Rangfolge anwenden,
 * `data/figure.txt` schreiben. Das kostet 0 GB, weil `ns.read` und `ns.write`
 * nichts kosten.
 *
 * Die AUSFUEHRUNG liegt beim Besitzer und ist ausnahmslos Singularity oder
 * Bladeburner. Der Kern fasst keine davon an - `commitCrime` allein waere
 * 80 GB, und er waere im Kaltstart nicht mehr startbar.
 *
 * Die KONTROLLE liegt in `figwatch.js` auf der Werkbank, wo die 35 GB nicht
 * stoeren.
 *
 * ===========================================================================
 * DREI EIGENSCHAFTEN, OHNE DIE EINE DATEI NICHTS REGELT
 * ===========================================================================
 *
 * 1. LEASE STATT BESITZ. `leaseBis` laeuft ab. Ein toter Besitzer hielte die
 *    Figur sonst bis zum naechsten Reset - und "tot" ist der Normalfall, wenn
 *    ein Werkzeug weggeraeumt wurde.
 *
 * 2. `seq` MONOTON. Wer eine kleinere Folgenummer sieht als beim letzten Mal,
 *    liest eine veraltete Datei (das Rennen zwischen Werkbank und home) und
 *    handelt NICHT. Ohne das gewinnt gelegentlich der langsamere Leser.
 *
 * 3. `nodeReset` GESTEMPELT. Nach einem Sprung ist jede Vergabe ungueltig.
 *    `figure.txt` steht NICHT in den Raeumlisten von boot.js; der Stempel
 *    ersetzt das Loeschen und ueberlebt den Einbau, nach dem genau ein Skript
 *    ins Gym will.
 */

/** Rangfolge: kleiner gewinnt. */
export const PRIO = {
  deadlock: 0,      // Sprosse 0, Konto negativ - schlaegt alles
  graft: 10,
  bladeburner: 20,
  faktion: 30,
  gym: 40,
  verbrechen: 50,
};

/** Wie lange eine Vergabe ohne Erneuerung gilt. */
export const LEASE_MS = 15 * 60000;

/** Wie lange ein Antrag gilt, wenn er keine eigene TTL nennt. */
export const ANTRAG_TTL_MS = 60000;

/**
 * Baut einen Antrag. Das Gewerk schreibt ihn nach
 * `data/figure-request-<tool>.json`, bevor es die Figur anfassen will.
 */
export function antrag(tool, prio, action, detail, reason, uhren, ttlMs = ANTRAG_TTL_MS) {
  return {
    tool, prio, action,
    detail: detail || null,
    reason: reason || "",
    wall: uhren.wall,
    motorTimeMs: uhren.motorTimeMs || 0,
    nodeReset: uhren.nodeReset || 0,
    ttlMs,
  };
}

/** Gilt ein Antrag noch? */
export function antragGilt(a, jetzt, nodeReset) {
  if (!a || typeof a !== "object") return false;
  if (!a.tool || !Number.isFinite(a.prio)) return false;
  if (!Number.isFinite(a.wall)) return false;
  // Nach einem Sprung ist jeder Antrag aus dem alten Knoten ungueltig.
  if (Number.isFinite(nodeReset) && Number.isFinite(a.nodeReset)
      && a.nodeReset !== nodeReset) return false;
  const ttl = Number.isFinite(a.ttlMs) ? a.ttlMs : ANTRAG_TTL_MS;
  return jetzt - a.wall <= ttl;
}

/**
 * Die Vergabe: aus allen geltenden Antraegen den mit der kleinsten `prio`.
 *
 * BEI GLEICHSTAND GEWINNT DER AELTERE ANTRAG. Das ist kein Detail: bei
 * Gleichstand nach Zufall oder nach Dateireihenfolge zu entscheiden erzeugt
 * genau das Ping-Pong, das hier aufhoeren soll - zwei Gewerke mit derselben
 * Prioritaet wechselten sich sonst im Sekundentakt ab.
 *
 * @param {Array} antraege
 * @param {object|null} bisher aktuelle Vergabe aus figure.txt
 * @param {number} jetzt
 * @param {number} nodeReset
 * @returns {{vergabe: object|null, grund: string, wechsel: boolean}}
 */
export function vergib(antraege, bisher, jetzt, nodeReset) {
  const gueltig = (antraege || []).filter((a) => antragGilt(a, jetzt, nodeReset));

  // Laeuft die bisherige Vergabe noch, und hat ihr Besitzer einen geltenden
  // Antrag? Dann bleibt sie - eine Lease wird durch einen neuen Antrag
  // verlaengert, nicht durch Zeitablauf beendet.
  const leaseLaeuft = vergabeGilt(bisher, jetzt, nodeReset);
  if (leaseLaeuft) {
    const eigener = gueltig.find((a) => a.tool === bisher.owner);
    const besserer = gueltig.find((a) => a.prio < (eigener ? eigener.prio : bisher.prio ?? 99));
    if (!besserer) {
      if (eigener) {
        return {
          vergabe: { ...bisher, leaseBis: jetzt + LEASE_MS, wall: jetzt },
          grund: "Lease verlaengert",
          wechsel: false,
        };
      }
      // Kein eigener Antrag mehr: die Lease laeuft aus, wird aber nicht
      // vorzeitig entzogen. Ein Gewerk, das gerade arbeitet und den Antrag
      // eine Runde zu spaet erneuert, verliert die Figur sonst mitten im Zug.
      return { vergabe: bisher, grund: "Lease laeuft noch aus", wechsel: false };
    }
    // Ein hoeher priorisierter Antrag bricht die Lease. Das ist der einzige
    // Fall, in dem das passiert - und er ist der Grund, warum der
    // Geld-Deadlock prio 0 hat.
    return {
      vergabe: neueVergabe(besserer, jetzt, nodeReset, (bisher.seq || 0) + 1),
      grund: "hoehere Prioritaet (" + besserer.prio + " vor " +
        (eigener ? eigener.prio : bisher.prio) + ")",
      wechsel: true,
    };
  }

  if (!gueltig.length) {
    return { vergabe: null, grund: "kein geltender Antrag", wechsel: !!bisher };
  }

  // Kleinste prio gewinnt; bei Gleichstand der aeltere Antrag.
  const sortiert = [...gueltig].sort((a, b) => (a.prio - b.prio) || (a.wall - b.wall));
  const gewinner = sortiert[0];
  const seq = (bisher && Number.isFinite(bisher.seq) ? bisher.seq : 0) + 1;
  return {
    vergabe: neueVergabe(gewinner, jetzt, nodeReset, seq),
    grund: gewinner.reason || gewinner.action,
    wechsel: !bisher || bisher.owner !== gewinner.tool,
  };
}

function neueVergabe(a, jetzt, nodeReset, seq) {
  return {
    owner: a.tool,
    action: a.action,
    prio: a.prio,
    since: jetzt,
    leaseMs: LEASE_MS,
    leaseBis: jetzt + LEASE_MS,
    wall: jetzt,
    nodeReset,
    seq,
  };
}

/** Gilt eine Vergabe noch? */
export function vergabeGilt(v, jetzt, nodeReset) {
  if (!v || typeof v !== "object" || !v.owner) return false;
  if (Number.isFinite(nodeReset) && Number.isFinite(v.nodeReset)
      && v.nodeReset !== nodeReset) return false;
  if (!Number.isFinite(v.leaseBis)) return false;
  return jetzt <= v.leaseBis;
}

/**
 * Darf dieses Werkzeug die Figur JETZT anfassen?
 *
 * Das ist die Funktion, die in jedem figurberuehrenden Gewerk vor dem Aufruf
 * steht. Sie kostet nichts und ist deshalb auch fuer `bn4rep.js` (850 GB) und
 * `kampfaugs.js` (388 GB) tragbar - dort ist sie der Unterschied zwischen
 * "geht" und "geht nicht".
 *
 * @param {object|null} vergabe aus figure.txt
 * @param {string} tool eigener Dateiname
 * @param {number} jetzt
 * @param {number} nodeReset
 * @param {number|null} letzteSeq zuletzt gesehene Folgenummer
 * @returns {{darf: boolean, grund: string, veraltet: boolean}}
 */
export function darfFigur(vergabe, tool, jetzt, nodeReset, letzteSeq = null) {
  if (!vergabe) {
    return { darf: false, grund: "keine Vergabe - erst beantragen", veraltet: false };
  }
  // DIE VERALTUNGSPRUEFUNG. Eine kleinere Folgenummer als beim letzten Mal
  // heisst: diese Datei ist aelter als das, was schon gelesen wurde - das
  // Rennen zwischen Werkbank und home. Wer darauf handelt, handelt auf einem
  // Stand, den es nicht mehr gibt.
  if (letzteSeq !== null && Number.isFinite(vergabe.seq) && vergabe.seq < letzteSeq) {
    return { darf: false, grund: "figure.txt ist veraltet (seq " + vergabe.seq +
      " nach " + letzteSeq + ")", veraltet: true };
  }
  if (!vergabeGilt(vergabe, jetzt, nodeReset)) {
    return { darf: false, grund: "Vergabe abgelaufen oder aus einem anderen Lauf",
      veraltet: false };
  }
  if (vergabe.owner !== tool) {
    return { darf: false, grund: "Figur gehoert gerade " + vergabe.owner +
      " (" + vergabe.action + ")", veraltet: false };
  }
  return { darf: true, grund: "", veraltet: false };
}

/**
 * Hat der Besitzer getan, was er beantragt hat?
 *
 * Das ist die Laufzeiterkennung fuer `figwatch.js`: vergebene gegen
 * tatsaechliche Handlung. Weichen sie ab, greift ein Gewerk an der Vergabe
 * vorbei - und genau das soll auffallen, statt sich als "der Graft war ploetzlich
 * weg" zu aeussern.
 *
 * @param {object} vergabe
 * @param {string|null} tatsaechlich was die Figur wirklich tut
 * @returns {{stimmt: boolean, grund: string}}
 */
export function pruefeHandlung(vergabe, tatsaechlich) {
  if (!vergabe || !vergabe.owner) {
    return { stimmt: tatsaechlich === null,
      grund: tatsaechlich ? "niemand hat die Figur, sie tut aber " + tatsaechlich : "" };
  }
  if (tatsaechlich === null) {
    return { stimmt: false,
      grund: vergabe.owner + " hat die Figur fuer " + vergabe.action + ", sie tut aber nichts" };
  }
  if (vergabe.action && tatsaechlich !== vergabe.action) {
    return { stimmt: false,
      grund: "vergeben fuer " + vergabe.action + ", tatsaechlich " + tatsaechlich };
  }
  return { stimmt: true, grund: "" };
}

/** Der Dateiname des Antrags eines Werkzeugs. */
export function antragsDatei(tool) {
  return "data/figure-request-" + String(tool).replace(/[^\w.-]/g, "_") + ".json";
}
