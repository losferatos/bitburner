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

/**
 * Das Kampfwert-Ziel, ab dem die Figur nicht mehr ins Gym muss. EINE Konstante
 * fuer blade.js (BBTRAIN_ZIEL), bbtrain.js (Standard von args[0]) und das
 * Simulacrum-Gate in bn4rep.js - sonst laeuft das Gate gegen ein anderes Ziel
 * als das Training.
 */
export const KAMPFZIEL_STANDARD = 100;

/** Rangfolge: kleiner gewinnt. */
export const PRIO = {
  deadlock: 0,      // Sprosse 0, Konto negativ - schlaegt alles
  graft: 10,
  bladeburner: 20,
  faktion: 30,
  beitritt: 25,
  gym: 40,
  verbrechen: 50,
};

/**
 * WARUM `beitritt` ZWISCHEN `faktion` UND `gym` STEHT (26.09.2026,
 * Skeptiker-Rework nach Paket C.2).
 *
 * `joinrun.js` beantragte die Figur bisher mit `gym` (40) - und verlor damit
 * IMMER gegen laufende Faktionsarbeit (`faktion`, 30), die bn4rep in einem
 * V1-Knoten praktisch pausenlos anfragt. joinrun war dort der einzige
 * Gym-Trainer und trainierte damit faktisch nie.
 *
 * `beitritt` (25) gewinnt gegen `faktion` (30), verliert aber weiterhin
 * gegen `graft` (10) und `bladeburner` (20) - ein laufender Graft oder eine
 * Bladeburner-Aktion wird also nicht unterbrochen. Der Preis ist begrenzt:
 * joinrun haelt sich hoechstens `FRIST_MS` (45 min) an der Figur fest, dann
 * gibt es auf. Das ist der Tausch, den der Auftrag ausdruecklich zulaesst -
 * Faktionsarbeit verliert fuer maximal 45 Minuten, nicht auf Dauer.
 *
 * `bbtrain.js` bleibt bewusst bei `gym` (40): es traegt 30 der 40
 * BitNode-Laeufe (Bladeburner-Weg) und hat dort KEINEN Konkurrenten um Prio
 * 30 - eine Anhebung dort wuerde nur Risiko ohne Nutzen hinzufuegen.
 */

/**
 * Wie lange eine Vergabe ohne Erneuerung gilt.
 *
 * NICHT GENUG FUER EINEN GRAFT (Skeptiker Fehlermodi, 04.09.2026). Die
 * Graftdauer ist `(3600000 * log2(Summe der Multiplikatoren) + 1800000) / 2`
 * geteilt durch den Intelligenzbonus (`GraftableAugmentation.ts:25-29`) - das
 * MINIMUM sind 15 Minuten, gemessen wurden 17,6 bis 88.
 *
 * Der Lease lief damit bei JEDEM Graft mitten drin ab, und die Figur ging an
 * den naechsten Antragsteller. Dass dabei noch kein Geld verbrannt ist, lag
 * nicht am Vergabepunkt, sondern an den handgepflegten `type ===
 * "GRAFTING"`-Bremsen in vier Dateien - also genau an dem, was C.11 abloesen
 * sollte.
 *
 * Deshalb hat `graft` einen eigenen Lease. Zwei Stunden decken auch das
 * teuerste Stueck; laenger darf er nicht sein, denn ein toter Antragsteller
 * parkt die Figur genau so lange.
 */
export const LEASE_MS = 15 * 60000;
export const LEASE_GRAFT_MS = 2 * 3600000;


/** Der Lease fuer eine bestimmte Handlung. */
export function leaseFuer(action) {
  return action === "graft" ? LEASE_GRAFT_MS : LEASE_MS;
}

/**
 * Wie lange ein Antrag gilt, wenn er keine eigene TTL nennt.
 *
 * ZWEIEINHALB TAKTE, NICHT EINER (04.09.2026). Hier stand 60 s - genau der
 * Takt von `bbtrain.js`, `bn4rep.js` und `graftauto.js`. Im verdeckten Tab
 * wird aus `sleep(60000)` real 60 bis 120 s (ein Timer-Wake je Minute ist ein
 * harter Deckel), ihre Antraege waren beim Lesen des Kerns also oefter
 * abgelaufen als nicht.
 *
 * Das ist dieselbe Fehlerklasse wie "eine Sekunde daneben, jedes Mal" vom
 * 30.08.: eine Frist, die genauso gross ist wie der Abstand, den sie
 * ueberbruecken soll, greift im Mittel in der Haelfte aller Faelle nicht.
 */
export const ANTRAG_TTL_MS = 150000;

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
 * EIN TOTER BESITZER HAELT NICHTS MEHR (Skeptiker Runde 3, W9, 04.09.2026).
 *
 * Bisher lief eine Lease immer bis zum Zeitablauf - auch dann, wenn der
 * Besitzer laengst nicht mehr lief. Bei 15 Minuten war das eine Viertelstunde
 * Stillstand nach jedem Absturz und jedem Speicherverdraengen; seit die
 * Graft-Lease zwei Stunden betraegt (B2), waeren es zwei Stunden gewesen, in
 * denen kein anderes Gewerk die Figur bekommt.
 *
 * Der Vergabepunkt im Kern kennt die laufenden Prozesse ohnehin (`ns.ps`) und
 * reicht die Auskunft als `lebt` herein. Fehlt sie, bleibt es beim alten
 * Verhalten - so kann kein Aufrufer, der die Prozessliste nicht hat, aus
 * Versehen jede Lease brechen.
 *
 * @param {Array} antraege
 * @param {object|null} bisher aktuelle Vergabe aus figure.txt
 * @param {number} jetzt
 * @param {number} nodeReset
 * @param {(tool: string) => boolean} [lebt] laeuft dieses Werkzeug noch?
 * @returns {{vergabe: object|null, grund: string, wechsel: boolean}}
 */
/**
 * STELLVERTRETER IN DER LEBENDPRUEFUNG (Uhren-Audit 08.10.2026).
 *
 * graft.js startet den Graft und beendet sich sofort; den Antrag auf seinen
 * Namen haelt danach graftauto.js am Leben. Die Prozessliste kennt graft.js
 * also nie - ohne Stellvertreter galt der Besitzer als tot, die 2-h-Lease
 * fiel sofort, und ein Faktions- oder Gym-Antrag bekam die Figur. Dessen
 * workForFaction/gymWorkout bricht den Graft ab, ohne Erstattung
 * (GraftingWork.tsx:75-83; Simulacrum 450 Mrd). Ein Besitzer gilt deshalb
 * auch dann als lebend, wenn einer seiner Stellvertreter laeuft.
 */
export const ALIVE_PROXIES = { "graft.js": ["graftauto.js"] };

/**
 * Lebt der Besitzer - selbst oder ueber einen Stellvertreter? Der
 * Stellvertreter zaehlt nur, solange der Besitzer einen GUELTIGEN eigenen
 * Antrag hat: graftauto.js erneuert den Antrag "graft.js" nur bei laufendem
 * Graft. Endet der Graft oder schlaegt der Start fehl, verfaellt der Antrag
 * nach ANTRAG_TTL_MS und die Lease faellt wie bisher (Skeptiker 08.10.: ohne
 * diese Bedingung hielte die 2-h-Lease die Figur nach Graftende fest).
 */
function ownerAlive(owner, lebt, gueltig) {
  if (lebt(owner)) return true;
  const proxies = ALIVE_PROXIES[owner] || [];
  return proxies.some((p) => lebt(p)) && gueltig.some((a) => a.tool === owner);
}

function vergibEinzel(antraege, bisher, jetzt, nodeReset, lebt) {
  const gueltig = (antraege || []).filter((a) => antragGilt(a, jetzt, nodeReset));

  // Der tote Besitzer: die Lease wird sofort fallengelassen, und die Vergabe
  // laeuft weiter, als haette es sie nie gegeben. Ein Antrag des Toten steht
  // in der Regel noch in der Liste - er faellt mit, weil `antragGilt` nach
  // ANTRAG_TTL_MS (150 s) greift und ein toter Antragsteller nicht erneuert.
  if (typeof lebt === "function" && bisher && bisher.owner && !ownerAlive(bisher.owner, lebt, gueltig)) {
    const uebrig = gueltig.filter((a) => a.tool !== bisher.owner);
    if (!uebrig.length) {
      return { vergabe: null, grund: "Besitzer " + bisher.owner + " laeuft nicht mehr", wechsel: true };
    }
    return {
      vergabe: neueVergabe(besterAntrag(uebrig), jetzt, nodeReset, (bisher.seq || 0) + 1),
      grund: "Besitzer " + bisher.owner + " laeuft nicht mehr - neu vergeben",
      wechsel: true,
    };
  }

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
          vergabe: { ...bisher, leaseBis: jetzt + leaseFuer(bisher.action), wall: jetzt },
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

  const gewinner = besterAntrag(gueltig);
  const seq = (bisher && Number.isFinite(bisher.seq) ? bisher.seq : 0) + 1;
  return {
    vergabe: neueVergabe(gewinner, jetzt, nodeReset, seq),
    grund: gewinner.reason || gewinner.action,
    wechsel: !bisher || bisher.owner !== gewinner.tool,
  };
}

/**
 * Aktionen, die NEBEN einer Bladeburner-Aktion laufen duerfen, sobald
 * `The Blade's Simulacrum` installiert ist (07.10.2026, Befund B5).
 *
 * Das Spiel bricht eine Bladeburner-Aktion nur ab, wenn das Simulacrum fehlt
 * (`Bladeburner.ts:178` beim Start, `:1354` je Tick). Mit ihm laufen
 * Faktions- und Firmenarbeit daneben (`startWork` fasst Bladeburner nicht an,
 * `PlayerObjectWorkMethods.ts:5-10`). Gym, Graft und Verbrechen gehoeren NICHT
 * dazu: ein Graft hat Prio 10 und wird ohnehin nie von Bladeburner verdraengt,
 * Gym/Verbrechen sind keine Arbeit, die Rang nebenher verdienen soll.
 */
export const PARALLEL_ZU_BLADEBURNER = new Set(["faktion", "arbeit"]);

/**
 * Die Vergabe. Ohne `opts.simulacrum` ist das EXAKT die Einzelvergabe von
 * frueher (gleiches Objekt, kein neues Feld) - das Verhalten ohne Simulacrum
 * bleibt bitgleich.
 *
 * Mit `opts.simulacrum` und einer Vergabe an eine Bladeburner-Aktion kann
 * zusaetzlich EIN Faktions-/Firmenantrag mitlaufen: die Vergabe bekommt
 * `mit: [werkzeug]` und `mitAktion`. Der Besitzer und die Lease bleiben die
 * der Bladeburner-Aktion. Das Feld wird in JEDER Runde frisch berechnet -
 * die Lease-Verlaengerung kopiert die alte Vergabe, ein veraltetes `mit`
 * wuerde sonst haengen bleiben.
 *
 * Nur die Sperre in bn4rep zu lockern waere ein stiller No-op: Prio 20
 * (Bladeburner) bricht sonst jeden Antrag mit Prio 30.
 *
 * @param {Array} antraege
 * @param {object|null} bisher
 * @param {number} jetzt
 * @param {number} nodeReset
 * @param {(tool: string) => boolean} [lebt]
 * @param {{simulacrum?: boolean}} [opts]
 */
export function vergib(antraege, bisher, jetzt, nodeReset, lebt, opts) {
  const e = vergibEinzel(antraege, bisher, jetzt, nodeReset, lebt);
  const v = e.vergabe;
  if (!v || typeof v !== "object") return e;
  const hatMit = Object.prototype.hasOwnProperty.call(v, "mit")
    || Object.prototype.hasOwnProperty.call(v, "mitAktion");
  const sim = !!(opts && opts.simulacrum);
  if (!sim && !hatMit) return e;
  const neu = { ...v };
  delete neu.mit;
  delete neu.mitAktion;
  if (sim && v.owner && v.action === "bladeburner") {
    const kand = (antraege || []).filter((a) => antragGilt(a, jetzt, nodeReset)
      && a.tool !== v.owner && PARALLEL_ZU_BLADEBURNER.has(a.action)
      && (typeof lebt !== "function" || lebt(a.tool)));
    if (kand.length) {
      const b = besterAntrag(kand);
      neu.mit = [b.tool];
      neu.mitAktion = b.action;
    }
  }
  return { ...e, vergabe: neu };
}

/** Kleinste prio gewinnt; bei Gleichstand der AELTERE Antrag (kein Ping-Pong). */
function besterAntrag(gueltig) {
  return [...gueltig].sort((a, b) => (a.prio - b.prio) || (a.wall - b.wall))[0];
}

function neueVergabe(a, jetzt, nodeReset, seq) {
  return {
    owner: a.tool,
    action: a.action,
    prio: a.prio,
    since: jetzt,
    leaseMs: leaseFuer(a.action),
    leaseBis: jetzt + leaseFuer(a.action),
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
  // Neben einer Bladeburner-Aktion darf mit Simulacrum EIN Faktions-/Firmen-
  // antrag mitlaufen (`vergib` setzt `mit`). Ohne Simulacrum gibt es das Feld nie.
  if (vergabe.owner !== tool
      && !(Array.isArray(vergabe.mit) && vergabe.mit.includes(tool))) {
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
  // Parallelarbeit (Simulacrum): die Figur tut dann die Mitaktion statt der
  // Bladeburner-Aktion, ohne dass jemand an der Vergabe vorbeigreift.
  if (vergabe.mitAktion && tatsaechlich === vergabe.mitAktion) {
    return { stimmt: true, grund: "" };
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
