/**
 * Die drei Uhren des Waechters - und die Regel, welche Frist welche benutzt.
 *
 * ===========================================================================
 * DER FEHLER, DEN DIESE DATEI VERHINDERT
 * ===========================================================================
 *
 * Die Motorzeit des Kerns darf KEINE EINZIGE Waechterfrist tragen.
 *
 * Sobald der Kern haengt, steht seine Uhr. Eine in ihr gemessene Frist liefe
 * dann genau in dem Fall nie ab, fuer den sie gebaut wurde - der Waechter
 * wartete ewig auf einen Zeitpunkt, den ein haengender Motor nie erreicht.
 *
 * Deshalb traegt hier jeder Bezeichner seine Uhr im Namen: `waitWatchdogMs`,
 * `waitEngineMs`, `waitMotorMs`. Und `pruefeFristen()` weist jede
 * waitMotorMs-Frist in den Sprossen 0 bis 3 zurueck - das ist der Lint, den
 * ARCHITEKTUR 5.3 ausdruecklich verlangt.
 *
 * ===========================================================================
 * DIE DREI UHREN
 * ===========================================================================
 *
 *   guardTimeMs   Summe der eigenen Rundenabstaende, sofern plausibel.
 *                 Laeuft auch, wenn der Kern steht - das ist der Punkt.
 *   engineTimeMs  Delta totalPlaytime. Sagt, ob die Engine ueberhaupt tickt.
 *   motorTimeMs   vom Kern veroeffentlicht. GELESEN, NIE GERECHNET.
 *
 * Die dritte selbst zu rechnen, waere teuer und falsch: teuer, weil der
 * Waechter dafuer Werte lesen muesste, die 4 GB und mehr kosten; falsch, weil
 * zwei Uhren fuer dieselbe Sache unweigerlich auseinanderlaufen.
 */

/** Hoechster eigener Rundenabstand, der noch als zusammenhaengend zaehlt. */
export const GUARD_DECKEL_MS = 120000;

/** Toleranz, um die die Spielzeit die Wanduhr ueberholen darf. */
export const PLAYTIME_TOLERANZ_MS = 60000;

/** Nach einem Zeitsprung ruhen die Fristen so lange (Wanduhr des Waechters). */
export const KARENZ_MS = 10 * 60000;

/** Ein frischer Uhrensatz. */
export function neu() {
  return {
    version: 1,
    guardTimeMs: 0,
    letzteWall: null,
    letztePlaytime: null,
    runden: 0,
    verworfen: 0,
    letzterSprungWall: null,
    letzterGrund: null,
    /** Fuer den Engine-Puls: ein kurzes Fenster der letzten Messungen. */
    puls: [],
  };
}

/**
 * Eine Waechterrunde verbuchen.
 *
 * Der Deckel ist 120 s = 12 x Takt bei 10 s Takt. Nicht 2 x: ein verdeckter
 * Browser-Tab liefert belegt genau eine Weckung je Minute. Bei 20 s Deckel
 * ueberschritte JEDE Nachtrunde ihn, zaehlte null und loeste eine
 * Zeitsprung-Karenz aus - die Leiter waere nachts nie scharf, und Stufe B
 * verlangt ausdruecklich eine Nacht mit verdecktem Tab.
 *
 * @returns {{gezaehlt: boolean, dWall: number, dPlay: number, sprung: boolean}}
 */
export function runde(u, wall, playtime) {
  u.runden++;
  if (u.letzteWall === null) {
    u.letzteWall = wall;
    u.letztePlaytime = playtime;
    return { gezaehlt: false, dWall: 0, dPlay: 0, sprung: false };
  }

  const dWall = wall - u.letzteWall;
  const dPlay = playtime - u.letztePlaytime;
  u.letzteWall = wall;
  u.letztePlaytime = playtime;

  if (dWall < 0 || dPlay < 0) {
    u.verworfen++;
    u.letzterGrund = "Uhr rueckwaerts";
    u.letzterSprungWall = wall;
    return { gezaehlt: false, dWall, dPlay, sprung: true };
  }
  if (dWall > GUARD_DECKEL_MS) {
    u.verworfen++;
    u.letzterGrund = "Abstand " + Math.round(dWall / 1000) + " s ueber dem Deckel";
    u.letzterSprungWall = wall;
    return { gezaehlt: false, dWall, dPlay, sprung: true };
  }
  if (dPlay > dWall + PLAYTIME_TOLERANZ_MS) {
    u.verworfen++;
    u.letzterGrund = "Nachholklumpen: Spielzeit +" + Math.round(dPlay / 1000) + " s";
    u.letzterSprungWall = wall;
    return { gezaehlt: false, dWall, dPlay, sprung: true };
  }

  u.guardTimeMs += dWall;
  // Der Puls ist das VERHAELTNIS der beiden Uhren, kein Bestand. Er braucht
  // ein Fenster, weil eine einzelne Runde zu verrauscht ist.
  u.puls.push({ wall, dWall, dPlay });
  while (u.puls.length > 60) u.puls.shift();
  return { gezaehlt: true, dWall, dPlay, sprung: false };
}

/**
 * Der Engine-Puls: Delta totalPlaytime geteilt durch Delta Wanduhr, ueber ein
 * Fenster von mindestens `fensterMs`.
 *
 * Unter 0,2 laeuft die Engine nicht mehr mit - das ist S3b.
 *
 * @returns {{puls: number, fensterMs: number}|null} null, wenn das Fenster
 *   noch nicht voll ist. Nie eine geratene Zahl.
 */
export function enginePuls(u, fensterMs = 3 * 60000) {
  if (!u.puls.length) return null;
  const bis = u.puls[u.puls.length - 1].wall;
  let wall = 0;
  let play = 0;
  for (let i = u.puls.length - 1; i >= 0; i--) {
    wall += u.puls[i].dWall;
    play += u.puls[i].dPlay;
    if (wall >= fensterMs) break;
  }
  if (wall < fensterMs) return null;
  return { puls: play / wall, fensterMs: wall, bis };
}

/** Ruhen die Fristen gerade wegen eines Zeitsprungs? */
export function inKarenz(u, wall, karenzMs = KARENZ_MS) {
  if (u.letzterSprungWall === null) return false;
  return wall - u.letzterSprungWall < karenzMs;
}

/**
 * Welche Uhr darf eine Frist benutzen?
 *
 * Das ist der Lint aus ARCHITEKTUR 5.3, als Funktion statt als Kommentar:
 * eine Frist der Sprossen 0 bis 3 darf NIE in Motorzeit laufen.
 *
 * @param {Array} fristen [{name, uhr, sprosse}]
 * @returns {string[]} Beanstandungen, leer wenn alles stimmt
 */
export function pruefeFristen(fristen) {
  const schlecht = [];
  for (const f of fristen || []) {
    if (!["guard", "engine", "motor", "wand", "keine"].includes(f.uhr)) {
      schlecht.push(f.name + ": unbekannte Uhr '" + f.uhr + "'");
      continue;
    }
    if (f.uhr === "motor" && Number.isFinite(f.sprosse) && f.sprosse <= 3) {
      schlecht.push(f.name + ": Sprosse " + f.sprosse + " darf nicht in Motorzeit laufen - " +
        "haengt der Kern, steht seine Uhr, und die Frist liefe nie ab");
    }
  }
  return schlecht;
}

/**
 * Die Fristentabelle des Waechters, als Daten statt als verstreute Konstanten.
 * `pruefeFristen()` laeuft in Ebene 0 darueber.
 */
export const FRISTEN = [
  { name: "karenzNachReset", uhr: "guard", sprosse: null, ms: 10 * 60000 },
  { name: "karenzNachZeitsprung", uhr: "guard", sprosse: null, ms: 10 * 60000 },
  { name: "s1Freshness", uhr: "motor", sprosse: null, ms: 600000 },
  { name: "s2Stillstand", uhr: "motor", sprosse: null, ms: 45 * 60000 },
  { name: "s3aHerzschlag", uhr: "guard", sprosse: null, ms: 10 * 60000 },
  { name: "s3bFenster", uhr: "engine", sprosse: null, ms: 3 * 60000 },
  { name: "s6ErrStreak", uhr: "keine", sprosse: null, ms: 0 },

  { name: "sprosse0Karenz", uhr: "guard", sprosse: 0, ms: 60000 },
  { name: "sprosse1Karenz", uhr: "guard", sprosse: 1, ms: 120000 },
  { name: "sprosse1Wirkung", uhr: "guard", sprosse: 1, ms: 180000 },
  { name: "sprosse2Karenz", uhr: "guard", sprosse: 2, ms: 300000 },
  { name: "sprosse2Wirkung", uhr: "guard", sprosse: 2, ms: 300000 },
  { name: "sprosse3Karenz", uhr: "guard", sprosse: 3, ms: 600000 },
  { name: "sprosse3Wirkung", uhr: "guard", sprosse: 3, ms: 600000 },

  // Ab Sprosse 4 sind die Uhren andere - dort haengt der Erfolg an der Engine
  // beziehungsweise am Spielfortschritt, nicht an der Waechterzeit.
  { name: "sprosse4aAusloesung", uhr: "engine", sprosse: 4, ms: 300000 },
  { name: "sprosse4aWirkung", uhr: "engine", sprosse: 4, ms: 180000 },
  { name: "sprosse5Ausloesung", uhr: "motor", sprosse: 5, ms: 6 * 3600000 },
  { name: "sprosse5Wirkung", uhr: "guard", sprosse: 5, ms: 600000 },

  // Backoff-DAUERN laufen in Wanduhr: sie sollen reale Zeit verstreichen
  // lassen, nicht gearbeitete.
  { name: "backoffKurz", uhr: "wand", sprosse: null, ms: 5 * 60000 },
  { name: "backoffMittel", uhr: "wand", sprosse: null, ms: 15 * 60000 },
  { name: "backoffLang", uhr: "wand", sprosse: null, ms: 30 * 60000 },

  { name: "blockedHosts", uhr: "guard", sprosse: null, ms: 60 * 60000 },
  { name: "exhaustedMeldung", uhr: "guard", sprosse: null, ms: 12 * 3600000 },
];

/** Laedt einen Uhrensatz und wandert ihn. */
export function laden(roh, nodeReset = null) {
  if (!roh) return neu();
  let u;
  try {
    u = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch {
    return neu();
  }
  if (!u || typeof u !== "object") return neu();
  const frisch = neu();
  const g = { ...frisch, ...u, version: 1 };
  if (!Number.isFinite(g.guardTimeMs)) g.guardTimeMs = 0;
  if (!Array.isArray(g.puls)) g.puls = [];
  // Nach dem Laden ist die Kette unterbrochen - der Prozess war weg.
  g.letzteWall = null;
  g.letztePlaytime = null;
  // Passt der Lauf nicht, beginnt die Zaehlung neu. Ohne das traegt eine
  // Sprossenzaehlung aus dem vorigen Knoten in den neuen hinein.
  if (nodeReset !== null && Number.isFinite(u.nodeReset) && u.nodeReset !== nodeReset) {
    const n = neu();
    n.nodeReset = nodeReset;
    return n;
  }
  if (nodeReset !== null) g.nodeReset = nodeReset;
  return g;
}
