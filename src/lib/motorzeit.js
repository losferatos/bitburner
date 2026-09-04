/**
 * Motorzeit - die Uhr, die zaehlt, wie lange der Bot WIRKLICH gearbeitet hat.
 *
 * ===========================================================================
 * WARUM ES DIESE UHR BRAUCHT
 * ===========================================================================
 *
 * Keine der drei Uhren des Spiels misst "das Spiel lief":
 *
 *  - `Date.now()` laeuft weiter, wenn der Rechner aus ist. Eine Rate daraus ist
 *    nach einer Nacht um Faktor drei zu niedrig und meldet Stillstand, wo nur
 *    niemand gespielt hat.
 *  - `totalPlaytime` zaehlt Offline-Zeit VOLL mit (`engine.tsx`). Beim Laden
 *    bucht die Engine die gesamte Abwesenheit in einem Klumpen nach.
 *  - Die Zahl der Motorrunden allein sagt nichts, solange die Rundendauer
 *    zwischen 10 Sekunden und einer Minute schwankt.
 *
 * Motorzeit ist die Summe der Rundenabstaende, aber nur solange sie plausibel
 * sind. Grosse Spruenge zaehlen NULL - sie sind Offline-Zeit oder ein
 * Nachholklumpen, keine Arbeit.
 *
 * ===========================================================================
 * DER DECKEL IST 12 x TAKT, NICHT 2 x
 * ===========================================================================
 *
 * Das ist die wichtigste Zahl hier, und sie ist gegen die naheliegende Wahl
 * entschieden. Ein verdeckter Browser-Tab bekommt genau EINE Timer-Weckung je
 * Minute; bei 10-Sekunden-Takt sind das 6 x Takt zwischen zwei Runden, im
 * Normalfall. Mit einem Deckel von 2 x Takt zaehlte eine gedrosselte Stunde
 * nur 20 Minuten - jede Rate waere um Faktor drei zu gut, und der gedrosselte
 * Nachtbetrieb saehe im Bericht besser aus als der wache Tagbetrieb.
 *
 * Mit 12 x Takt zaehlt die gedrosselte Stunde als Stunde, und erst ein
 * Abstand ueber zwei Minuten gilt als Unterbrechung.
 *
 * ===========================================================================
 * DIE ZWEITE BEDINGUNG: totalPlaytime MUSS MITGEGANGEN SEIN
 * ===========================================================================
 *
 * Ein Rundenabstand kann klein sein und trotzdem keine Arbeit bedeuten - naemlich
 * dann, wenn die Engine dazwischen einen Offline-Klumpen verarbeitet hat. Dann
 * springt `totalPlaytime` um Stunden, waehrend die Wanduhr Sekunden zeigt.
 * Deshalb zaehlt eine Runde nur, wenn BEIDE Uhren zusammenpassen:
 *
 *     Delta wall <= 12 x Takt   UND   Delta totalPlaytime <= Delta wall + 60 s
 *
 * Die 60 Sekunden Toleranz fangen die normale Ungenauigkeit ab.
 */

/** Erzeugt einen frischen Zustand. Der Aufrufer haelt ihn und speichert ihn. */
export function neuerZustand(taktMs = 10000) {
  return {
    version: 1,
    taktMs,
    motorTimeMs: 0,
    letzteWall: null,
    letztePlaytime: null,
    runden: 0,
    gezaehlteRunden: 0,
    verworfeneRunden: 0,
    letzterSprungWall: null,
    /** Grund der letzten Verwerfung - fuer die Fehlersuche im Nachhinein. */
    letzterGrund: null,
  };
}

/**
 * Eine Runde verbuchen.
 *
 * @param {object} z Zustand aus neuerZustand()
 * @param {number} wall Date.now() dieser Runde
 * @param {number} playtime ns.getPlayer().totalPlaytime dieser Runde
 * @returns {{gezaehlt: boolean, deltaMs: number, grund: string|null, sprung: boolean}}
 */
export function runde(z, wall, playtime) {
  z.runden++;

  if (z.letzteWall === null) {
    z.letzteWall = wall;
    z.letztePlaytime = playtime;
    return { gezaehlt: false, deltaMs: 0, grund: "erste Runde", sprung: false };
  }

  const dWall = wall - z.letzteWall;
  const dPlay = playtime - z.letztePlaytime;
  const deckel = 12 * z.taktMs;

  z.letzteWall = wall;
  z.letztePlaytime = playtime;

  // Rueckwaerts laufende Uhren gibt es: Systemzeitkorrektur, Sommerzeit,
  // ein wiederhergestellter Spielstand. Sie zaehlen nie.
  if (dWall < 0 || dPlay < 0) {
    z.verworfeneRunden++;
    z.letzterGrund = "Uhr rueckwaerts";
    z.letzterSprungWall = wall;
    return { gezaehlt: false, deltaMs: dWall, grund: z.letzterGrund, sprung: true };
  }

  if (dWall > deckel) {
    z.verworfeneRunden++;
    z.letzterGrund = "Abstand " + Math.round(dWall / 1000) + " s ueber dem Deckel von " +
      Math.round(deckel / 1000) + " s";
    z.letzterSprungWall = wall;
    return { gezaehlt: false, deltaMs: dWall, grund: z.letzterGrund, sprung: true };
  }

  if (dPlay > dWall + 60000) {
    z.verworfeneRunden++;
    z.letzterGrund = "Nachholklumpen: Spielzeit +" + Math.round(dPlay / 1000) +
      " s bei nur " + Math.round(dWall / 1000) + " s Wanduhr";
    z.letzterSprungWall = wall;
    return { gezaehlt: false, deltaMs: dWall, grund: z.letzterGrund, sprung: true };
  }

  z.motorTimeMs += dWall;
  z.gezaehlteRunden++;
  return { gezaehlt: true, deltaMs: dWall, grund: null, sprung: false };
}

/** Motorzeit in Stunden - die Einheit, in der alle Fristen stehen. */
export function motorStunden(z) {
  return z.motorTimeMs / 3600000;
}

/**
 * Liegt ein Zeitsprung so kurz zurueck, dass Fristen noch nicht gelten?
 *
 * Nach einem Sprung sind alle Telemetrien stundenalt, und die Strafleiter waere
 * beim Aufwachen sofort scharf, obwohl niemand etwas falsch gemacht hat. Die
 * Karenz laeuft in WANDUHR, nicht in Motorzeit: sie soll verstreichen, waehrend
 * der Bot sich sortiert.
 */
export function inKarenz(z, wall, karenzMs = 10 * 60000) {
  if (z.letzterSprungWall === null) return false;
  return wall - z.letzterSprungWall < karenzMs;
}

/**
 * Setzt die Uhr auf null - nach einem Prestige (Einbau oder Knotenwechsel).
 * Der Takt und die Version bleiben; alles andere beginnt neu, weil Fristen und
 * Raten sich immer auf den laufenden Lauf beziehen.
 */
export function zuruecksetzen(z, grund) {
  const alt = z.motorTimeMs;
  z.motorTimeMs = 0;
  z.letzteWall = null;
  z.letztePlaytime = null;
  z.runden = 0;
  z.gezaehlteRunden = 0;
  z.verworfeneRunden = 0;
  z.letzterSprungWall = null;
  z.letzterGrund = "zurueckgesetzt: " + grund + " (vorher " +
    (alt / 3600000).toFixed(2) + " h)";
  return z;
}

/**
 * Laedt einen gespeicherten Zustand und wandert ihn bei Bedarf.
 *
 * Die Datei liegt auf home und ueberlebt Einbau und Knotenwechsel. Wird ein Feld
 * umbenannt, MUSS es hier wandern - sonst fuellt die Ergaenzungslogik das
 * fehlende Feld aus der Vorlage auf, und die Uhr beginnt still bei null,
 * waehrend der Bericht weiter Stunden meldet.
 */
export function laden(roh, taktMs = 10000) {
  if (!roh) return neuerZustand(taktMs);
  let z;
  try {
    z = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch {
    return neuerZustand(taktMs);
  }
  if (!z || typeof z !== "object") return neuerZustand(taktMs);

  const frisch = neuerZustand(taktMs);
  // Version 0 kannte weder verworfeneRunden noch letzterSprungWall.
  const gewandert = { ...frisch, ...z, version: 1, taktMs };
  if (!Number.isFinite(gewandert.motorTimeMs)) gewandert.motorTimeMs = 0;
  // Nach dem Laden ist die Wanduhr-Kette unterbrochen: der Prozess war weg.
  // Die naechste Runde darf deshalb keinen Abstand verbuchen.
  gewandert.letzteWall = null;
  gewandert.letztePlaytime = null;
  return gewandert;
}
